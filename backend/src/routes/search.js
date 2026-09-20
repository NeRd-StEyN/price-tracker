import { Router } from 'express';
import { supabase } from '../db.js';

const router = Router();

// ---------------------------------------------------------------------------
// SCALE ARCHITECTURE:
//
//  Layer 1: RAM Cache (Map)           — fastest, ~0ms, lost on restart
//  Layer 2: Supabase search_cache     — persistent, survives restarts, ~10ms
//  Layer 3: Supabase FTS (GIN index)  — live, handles adds/deletes, ~20ms
//
// Why this beats ilike('%query%'):
//   - ilike does a full sequential table scan → O(N) for N rows
//   - FTS uses a pre-built GIN index → O(log N), works for billions of rows
//   - GIN index auto-updates when rows are inserted/deleted (Postgres handles it)
//   - No manual sync required — the DB IS the source of truth
//
// Cache invalidation strategy:
//   - When a product is ADDED   → call invalidateSearchCache() in products.js
//   - When a product is DELETED → call invalidateSearchCache() in products.js
//   - TTL fallback: 10 minutes ensures eventual consistency even if invalidation fails
// ---------------------------------------------------------------------------

const RAM_CACHE    = new Map();
const RAM_TTL_MS   = 2 * 60 * 1000;  // 2 min in RAM (short, stale-safe)
const DB_CACHE_TTL = 10 * 60 * 1000; // 10 min in DB cache

// ── Helper: infer brand & category from product name ───────────────────────
function inferMetadata(name = '') {
  const brandList = [
    'Nordkraft', 'Vantablack', 'Larkspur', 'Helix', 'Ironwood',
    'Meridian', 'Cobalt', 'Auralite', 'Vista', 'Amperage',
    'Domus', 'Basecamp', 'Copperpot', 'Summit'
  ];
  let brand = null;
  for (const b of brandList) {
    if (name.toLowerCase().includes(b.toLowerCase())) { brand = b; break; }
  }

  let category = 'General';
  const n = name.toLowerCase();
  if (n.includes('headphone') || n.includes('earbud') || n.includes('speaker') ||
      n.includes('soundbar')  || n.includes('audio')  || n.includes('turntable') ||
      n.includes('amplifier') || n.includes('receiver')) {
    category = 'Audio';
  } else if (n.includes('book') || n.includes('laptop') || n.includes('workstation') ||
             n.includes('convertible') || n.includes('notebook') || n.includes('cloudbook')) {
    category = 'Laptops';
  } else if (n.includes('monitor') || n.includes('display') || n.includes('ultrawide') || n.includes('screen')) {
    category = 'Monitors';
  } else if (n.includes('watch') || n.includes('band') || n.includes('ring') ||
             n.includes('glasses') || n.includes('tracker')) {
    category = 'Wearables';
  } else if (n.includes('keyboard') || n.includes('mouse') || n.includes('trackpad') ||
             n.includes('webcam')   || n.includes('tablet') || n.includes('controller')) {
    category = 'Peripherals';
  } else if (n.includes('power') || n.includes('charger') || n.includes('battery') ||
             n.includes('bank')  || n.includes('solar')) {
    category = 'Power';
  } else if (n.includes('thermostat') || n.includes('smart') || n.includes('kettle') || n.includes('home')) {
    category = 'Smart Home';
  }

  return { brand, category };
}

// ── Cache helpers ───────────────────────────────────────────────────────────

/**
 * Read from persistent DB cache.
 * Returns parsed results[] or null if miss / expired.
 */
async function readDbCache(queryLower) {
  try {
    const { data } = await supabase
      .from('search_cache')
      .select('results, cached_at')
      .eq('query', queryLower)
      .single();

    if (!data) return null;
    const age = Date.now() - new Date(data.cached_at).getTime();
    if (age > DB_CACHE_TTL) return null; // expired
    return data.results; // JSONB array
  } catch {
    return null; // table might not exist yet — graceful degradation
  }
}

/**
 * Write results to both RAM and DB cache.
 */
async function writeCache(queryLower, results) {
  // RAM
  RAM_CACHE.set(queryLower, { timestamp: Date.now(), data: results });

  // DB (upsert so repeated queries update timestamp)
  try {
    await supabase.from('search_cache').upsert(
      { query: queryLower, results, cached_at: new Date().toISOString() },
      { onConflict: 'query' }
    );
  } catch {
    // Non-fatal: search still works without persistent cache
  }
}

/**
 * Invalidate ALL cache entries.
 * Call this whenever a product is added or deleted so search reflects reality.
 *
 * At billion-scale you would invalidate only relevant keys by prefix,
 * but for this project a full flush is safe since FTS re-queries are fast.
 */
export async function invalidateSearchCache() {
  RAM_CACHE.clear();
  try {
    // Delete all rows — the table is rebuilt on demand
    await supabase
      .from('search_cache')
      .delete()
      .neq('query', '__sentinel__'); // delete everything
    console.log('[search] Cache fully invalidated (product add/delete event)');
  } catch (e) {
    console.warn('[search] Cache invalidation DB flush failed (non-fatal):', e.message);
  }
}

// ── Main search route ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      const err = new Error('Missing search query parameter "q"');
      err.status = 400;
      throw err;
    }

    const queryLower = q.trim().toLowerCase();

    // ── Layer 1: RAM Cache (fastest) ────────────────────────────────────
    const ramHit = RAM_CACHE.get(queryLower);
    if (ramHit && Date.now() - ramHit.timestamp < RAM_TTL_MS) {
      return res.json(ramHit.data);
    }

    // ── Layer 2: Persistent DB Cache ─────────────────────────────────────
    const dbHit = await readDbCache(queryLower);
    if (dbHit) {
      // Re-warm RAM cache from DB hit (avoids DB round-trip on next request)
      RAM_CACHE.set(queryLower, { timestamp: Date.now(), data: dbHit });
      return res.json(dbHit);
    }

    // ── Layer 3: Live Supabase FTS (GIN index) ────────────────────────────
    // True source of truth. Handles adds/deletes automatically.
    // GIN index makes this O(log N) even for billions of rows.
    // FALLBACK: if FTS column doesn't exist yet, falls back to ilike.
    const itemMap = new Map();

    const terms = queryLower.split(/\\s+/).filter(Boolean);
    const numId = parseInt(queryLower.replace(/[^0-9]/g, ''));

    // Prepare Catalog FTS
    const pCatalogFts = supabase
      .from('catalog')
      .select('id, name, url, image_url')
      .textSearch('search_vector', queryLower, { type: 'websearch', config: 'english' })
      .limit(50);

    // Prepare Catalog ILIKE
    let qCatalogIlike = supabase.from('catalog').select('id, name, url, image_url');
    for (const term of terms) qCatalogIlike = qCatalogIlike.ilike('name', `%${term}%`);
    const pCatalogIlike = qCatalogIlike.limit(50);

    // Prepare Products FTS
    const pProductsFts = supabase
      .from('products')
      .select('id, name, external_id')
      .textSearch('search_vector', queryLower, { type: 'websearch', config: 'english' })
      .limit(50);

    // Prepare Products ILIKE
    let qProductsIlike = supabase.from('products').select('id, name, external_id');
    for (const term of terms) qProductsIlike = qProductsIlike.ilike('name', `%${term}%`);
    const pProductsIlike = qProductsIlike.limit(50);

    // Prepare Direct API
    const pDirectApi = (async () => {
      if (!numId) return null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s max
      try {
        const res = await fetch(`https://demo.inelabteamdev.com/api/product/${numId}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) return await res.json();
      } catch { /* skip */ }
      return null;
    })();

    // ── FIRE ALL QUERIES IN PARALLEL ──────────────────────────────────────────
    const [resCatFts, resCatIlike, resProdFts, resProdIlike, resApi] = await Promise.allSettled([
      pCatalogFts, pCatalogIlike, pProductsFts, pProductsIlike, pDirectApi
    ]);

    // Process Catalog FTS
    if (resCatFts.status === 'fulfilled' && !resCatFts.value.error && resCatFts.value.data) {
      resCatFts.value.data.forEach(item => {
        const extId = parseInt(item.id) || item.id;
        const { brand, category } = inferMetadata(item.name);
        itemMap.set(String(extId), {
          id: String(item.id), name: item.name, brand, sku: `SKU-${extId}`, category,
          external_id: extId, url: item.url || `https://demo.inelabteamdev.com/product/${extId}`, _source: 'fts_catalog'
        });
      });
    }

    // Process Catalog ILIKE
    if (resCatIlike.status === 'fulfilled' && !resCatIlike.value.error && resCatIlike.value.data) {
      resCatIlike.value.data.forEach(item => {
        const extId = parseInt(item.id) || item.id;
        if (!itemMap.has(String(extId))) {
          const { brand, category } = inferMetadata(item.name);
          itemMap.set(String(extId), {
            id: String(item.id), name: item.name, brand, sku: `SKU-${extId}`, category,
            external_id: extId, url: item.url || `https://demo.inelabteamdev.com/product/${extId}`, _source: 'ilike_catalog'
          });
        }
      });
    }

    // Process Products FTS
    if (resProdFts.status === 'fulfilled' && !resProdFts.value.error && resProdFts.value.data) {
      resProdFts.value.data.forEach(p => {
        const rawExt = String(p.external_id || '').replace(/[^0-9]/g, '') || String(p.id);
        const extId = parseInt(rawExt) || p.external_id || p.id;
        if (!itemMap.has(String(extId))) {
          const { brand, category } = inferMetadata(p.name);
          itemMap.set(String(extId), {
            id: String(p.id), name: p.name, brand, sku: `SKU-${extId}`, category,
            external_id: extId, url: `https://demo.inelabteamdev.com/product/${extId}`, _source: 'fts_products'
          });
        }
      });
    }

    // Process Products ILIKE
    if (resProdIlike.status === 'fulfilled' && !resProdIlike.value.error && resProdIlike.value.data) {
      resProdIlike.value.data.forEach(p => {
        const rawExt = String(p.external_id || '').replace(/[^0-9]/g, '') || String(p.id);
        const extId = parseInt(rawExt) || p.external_id || p.id;
        if (!itemMap.has(String(extId))) {
          const { brand, category } = inferMetadata(p.name);
          itemMap.set(String(extId), {
            id: String(p.id), name: p.name, brand, sku: `SKU-${extId}`, category,
            external_id: extId, url: `https://demo.inelabteamdev.com/product/${extId}`, _source: 'ilike_products'
          });
        }
      });
    }

    // Process Direct API
    if (resApi.status === 'fulfilled' && resApi.value) {
      const p = resApi.value;
      if (!itemMap.has(String(p.id))) {
        const { brand, category } = inferMetadata(p.name);
        itemMap.set(String(p.id), {
          id: String(p.id), name: p.name, brand: p.brand || brand, sku: p.sku || `SKU-${p.id}`,
          category: p.category || category, external_id: parseInt(p.id) || p.id, url: `https://demo.inelabteamdev.com/product/${p.id}`, _source: 'direct_api'
        });
      }
    }

    const results = Array.from(itemMap.values());

    // Write to both cache layers
    await writeCache(queryLower, results);

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
