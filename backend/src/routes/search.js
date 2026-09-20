import { Router } from 'express';
import { supabase } from '../db.js';

const router = Router();

// In-Memory RAM Cache to simulate Redis
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Helper to infer brand & category from product name if missing in catalog
function inferMetadata(name) {
  const brandList = [
    'Nordkraft', 'Vantablack', 'Larkspur', 'Helix', 'Ironwood', 
    'Meridian', 'Cobalt', 'Auralite', 'Vista', 'Amperage', 
    'Domus', 'Basecamp', 'Copperpot', 'Summit'
  ];
  let brand = null;
  for (const b of brandList) {
    if (name.toLowerCase().includes(b.toLowerCase())) {
      brand = b;
      break;
    }
  }

  let category = 'General';
  const nLower = name.toLowerCase();
  if (nLower.includes('headphone') || nLower.includes('earbud') || nLower.includes('speaker') || nLower.includes('soundbar') || nLower.includes('audio') || nLower.includes('turntable') || nLower.includes('amplifier') || nLower.includes('receiver')) {
    category = 'Audio';
  } else if (nLower.includes('book') || nLower.includes('laptop') || nLower.includes('workstation') || nLower.includes('convertible') || nLower.includes('notebook') || nLower.includes('cloudbook')) {
    category = 'Laptops';
  } else if (nLower.includes('monitor') || nLower.includes('display') || nLower.includes('ultrawide') || nLower.includes('screen')) {
    category = 'Monitors';
  } else if (nLower.includes('watch') || nLower.includes('band') || nLower.includes('ring') || nLower.includes('glasses') || nLower.includes('tracker')) {
    category = 'Wearables';
  } else if (nLower.includes('keyboard') || nLower.includes('mouse') || nLower.includes('trackpad') || nLower.includes('webcam') || nLower.includes('tablet') || nLower.includes('controller')) {
    category = 'Peripherals';
  } else if (nLower.includes('power') || nLower.includes('charger') || nLower.includes('battery') || nLower.includes('bank') || nLower.includes('solar')) {
    category = 'Power';
  } else if (nLower.includes('thermostat') || nLower.includes('smart') || nLower.includes('kettle') || nLower.includes('home')) {
    category = 'Smart Home';
  }

  return { brand, category };
}

router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      const err = new Error('Missing search query parameter "q"');
      err.status = 400;
      throw err;
    }

    const queryLower = q.trim().toLowerCase();

    // 1. Check RAM Cache
    if (searchCache.has(queryLower)) {
      const cachedEntry = searchCache.get(queryLower);
      if (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
        return res.json(cachedEntry.data);
      } else {
        searchCache.delete(queryLower);
      }
    }

    const itemMap = new Map();

    // 2. Query 'catalog' table safely (id, name, url, image_url)
    try {
      const { data: catalogData } = await supabase
        .from('catalog')
        .select('id, name, url, image_url')
        .ilike('name', `%${queryLower}%`)
        .limit(100);

      if (catalogData) {
        catalogData.forEach(item => {
          const extId = parseInt(item.id) || item.id;
          const { brand, category } = inferMetadata(item.name);
          itemMap.set(String(extId), {
            id: String(item.id),
            name: item.name,
            brand,
            sku: `SKU-${extId}`,
            category,
            external_id: extId,
            url: item.url || `https://demo.inelabteamdev.com/product/${extId}`
          });
        });
      }
    } catch (e) {
      console.error('Catalog query error:', e);
    }

    // 3. Query 'products' table safely (id, name, external_id)
    try {
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, external_id')
        .ilike('name', `%${queryLower}%`)
        .limit(100);

      if (productsData) {
        productsData.forEach(p => {
          const rawExt = String(p.external_id || '').replace(/[^0-9]/g, '') || String(p.id);
          const extId = parseInt(rawExt) || p.external_id || p.id;
          const { brand, category } = inferMetadata(p.name);
          const key = String(extId);
          if (!itemMap.has(key)) {
            itemMap.set(key, {
              id: String(p.id),
              name: p.name,
              brand,
              sku: `SKU-${extId}`,
              category,
              external_id: extId,
              url: `https://demo.inelabteamdev.com/product/${extId}`
            });
          }
        });
      }
    } catch (e) {
      console.error('Products query error:', e);
    }

    // 4. If numeric Product ID (e.g. "1" or "251"), try direct INE store fetch if missing
    const numId = parseInt(queryLower.replace(/[^0-9]/g, ''));
    if (numId && !itemMap.has(String(numId))) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const directRes = await fetch(`https://demo.inelabteamdev.com/api/product/${numId}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (directRes.ok) {
          const p = await directRes.json();
          const { brand, category } = inferMetadata(p.name);
          itemMap.set(String(p.id), {
            id: String(p.id),
            name: p.name,
            brand: p.brand || brand,
            sku: p.sku || `SKU-${p.id}`,
            category: p.category || category,
            external_id: parseInt(p.id) || p.id,
            url: `https://demo.inelabteamdev.com/product/${p.id}`
          });
        }
      } catch (e) {}
    }

    const results = Array.from(itemMap.values());

    // 5. Save to RAM Cache
    searchCache.set(queryLower, {
      timestamp: Date.now(),
      data: results
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
