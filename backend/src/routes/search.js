import { Router } from 'express';
import { supabase } from '../db.js';

const router = Router();

const RAM_CACHE    = new Map();
const RAM_TTL_MS   = 2 * 60 * 1000;  
const DB_CACHE_TTL = 10 * 60 * 1000; 

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

async function readDbCache(queryLower) {
  try {
    const { data } = await supabase
      .from('search_cache')
      .select('results, cached_at')
      .eq('query', queryLower)
      .single();

    if (!data) return null;
    const age = Date.now() - new Date(data.cached_at).getTime();
    if (age > DB_CACHE_TTL) return null; 
    return data.results; 
  } catch {
    return null; 
  }
}

async function writeCache(queryLower, results) {
  
  RAM_CACHE.set(queryLower, { timestamp: Date.now(), data: results });

  try {
    await supabase.from('search_cache').upsert(
      { query: queryLower, results, cached_at: new Date().toISOString() },
      { onConflict: 'query' }
    );
  } catch {
    
  }
}

export async function invalidateSearchCache() {
  RAM_CACHE.clear();
  try {
    
    await supabase
      .from('search_cache')
      .delete()
      .neq('query', '__sentinel__'); 
    console.log('[search] Cache fully invalidated (product add/delete event)');
  } catch (e) {
    console.warn('[search] Cache invalidation DB flush failed (non-fatal):', e.message);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      const err = new Error('Missing search query parameter "q"');
      err.status = 400;
      throw err;
    }

    const queryLower = q.trim().toLowerCase();

    const ramHit = RAM_CACHE.get(queryLower);
    if (ramHit && Date.now() - ramHit.timestamp < RAM_TTL_MS) {
      return res.json(ramHit.data);
    }

    const dbHit = await readDbCache(queryLower);
    if (dbHit) {
      
      RAM_CACHE.set(queryLower, { timestamp: Date.now(), data: dbHit });
      return res.json(dbHit);
    }

    const itemMap = new Map();

    const terms = queryLower.split(/\\s+/).filter(Boolean);
    const numId = parseInt(queryLower.replace(/[^0-9]/g, ''));

    const pCatalogFts = supabase
      .from('catalog')
      .select('id, name, url, image_url')
      .textSearch('search_vector', queryLower, { type: 'websearch', config: 'english' })
      .limit(50);

    let qCatalogIlike = supabase.from('catalog').select('id, name, url, image_url');
    for (const term of terms) qCatalogIlike = qCatalogIlike.ilike('name', `%${term}%`);
    const pCatalogIlike = qCatalogIlike.limit(50);

    const pProductsFts = supabase
      .from('products')
      .select('id, name, external_id')
      .textSearch('search_vector', queryLower, { type: 'websearch', config: 'english' })
      .limit(50);

    let qProductsIlike = supabase.from('products').select('id, name, external_id');
    for (const term of terms) qProductsIlike = qProductsIlike.ilike('name', `%${term}%`);
    const pProductsIlike = qProductsIlike.limit(50);

    const pDirectApi = (async () => {
      if (!numId) return null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); 
      try {
        const res = await fetch(`https://demo.inelabteamdev.com/api/product/${numId}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) return await res.json();
      } catch {  }
      return null;
    })();

    const [resCatFts, resCatIlike, resProdFts, resProdIlike, resApi] = await Promise.allSettled([
      pCatalogFts, pCatalogIlike, pProductsFts, pProductsIlike, pDirectApi
    ]);

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

    await writeCache(queryLower, results);

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
