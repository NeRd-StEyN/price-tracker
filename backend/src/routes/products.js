import { Router } from 'express';
import { supabase } from '../db.js';
import { scrapeWithRetry } from '../scraper/scraper.js';
import { invalidateSearchCache } from './search.js';

const router = Router();

// In-memory rate limiter map for POST /api/products/:id/scrape (30s per product)
const scrapeRateLimitMap = new Map();

function mapErrorCode(status, message) {
  if (status === 'success' || status === 'retried') return null;
  const msg = (message || '').toUpperCase();
  if (msg.includes('PRICE_PENDING')) return 'PRICE_PENDING';
  if (msg.includes('503') || msg.includes('SERVICE UNAVAILABLE')) return '503';
  if (msg.includes('TIMEOUT') || msg.includes('ABORT')) return 'TIMEOUT';
  if (msg.includes('STRUCTURE_CHANGED')) return 'STRUCTURE_CHANGED';
  if (msg.includes('SESSION_REJECTED') || msg.includes('SESSION TOKEN EXCHANGE FAILED')) return 'SESSION_REJECTED';
  if (msg.includes('404') || msg.includes('NOT FOUND')) return 'NOT_FOUND';
  return 'FAILED';
}

function inferMetadata(name = '', external_id = '') {
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

  const cleanNum = String(external_id || '').replace(/[^0-9]/g, '');
  const sku = cleanNum ? `SKU-${cleanNum}` : null;

  return { brand, category, sku };
}

function formatProduct(product, historyList = [], logsList = []) {
  const latestGoodRow = historyList.length > 0 ? historyList[0] : null;
  const lastAttemptRow = logsList.length > 0 ? logsList[0] : null;

  const meta = inferMetadata(product.name, product.external_id);

  const latest_good = latestGoodRow ? {
    price: parseFloat(latestGoodRow.price),
    mrp: latestGoodRow.mrp != null ? parseFloat(latestGoodRow.mrp) : null,
    sale_price: latestGoodRow.sale_price != null ? parseFloat(latestGoodRow.sale_price) : null,
    currency: latestGoodRow.currency || 'INR',
    stock_units: latestGoodRow.stock_units ?? (latestGoodRow.in_stock ? 1 : 0),
    in_stock: Boolean(latestGoodRow.in_stock),
    scraped_at: latestGoodRow.scraped_at
  } : null;

  const last_attempt = lastAttemptRow ? {
    status: lastAttemptRow.status,
    attempts: lastAttemptRow.attempts,
    error_code: lastAttemptRow.error_code || mapErrorCode(lastAttemptRow.status, lastAttemptRow.message),
    message: lastAttemptRow.message,
    scraped_at: lastAttemptRow.scraped_at
  } : null;

  const stale = Boolean(last_attempt && last_attempt.status === 'failed' && latest_good !== null);

  const intervalMinutes = product.scrape_interval_minutes || 120;
  const intervalMs = intervalMinutes * 60 * 1000;
  const lastAttemptTime = last_attempt ? new Date(last_attempt.scraped_at).getTime() : 0;
  const overdue = Boolean(last_attempt && (Date.now() - lastAttemptTime) > 2 * intervalMs);

  let stock_state = 'unknown';
  if (latest_good !== null) {
    stock_state = latest_good.in_stock ? 'in_stock' : 'out_of_stock';
  }

  let price_change_pct = null;
  if (historyList.length >= 2) {
    const currentP = parseFloat(historyList[0].price);
    const previousP = parseFloat(historyList[1].price);
    if (previousP > 0) {
      price_change_pct = Math.round(((currentP - previousP) / previousP) * 1000) / 10;
    }
  }

  return {
    id: product.id,
    name: product.name,
    brand: product.brand || meta.brand,
    sku: product.sku || meta.sku,
    category: product.category || meta.category,
    description: product.description || null,
    specs: product.specs || {},
    external_id: parseInt(product.external_id) || product.external_id,
    scrape_interval_minutes: intervalMinutes,
    latest_good,
    last_attempt,
    stale,
    overdue,
    stock_state,
    price_change_pct
  };
}

// -------------------------------------------------------------------
// 1. GET /api/stats -> Summary metrics
// -------------------------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Parallelize both independent database queries
    const [
      { data: products, error: pErr },
      { data: logs7d, error: lErr }
    ] = await Promise.all([
      supabase
        .from('products')
        .select(`
          id,
          price_history ( price, in_stock, scraped_at )
        `)
        .order('scraped_at', { referencedTable: 'price_history', ascending: false })
        .limit(1, { referencedTable: 'price_history' }),
      supabase
        .from('scrape_logs')
        .select('status, scraped_at')
        .gte('scraped_at', sevenDaysAgo)
        .order('scraped_at', { ascending: false })
    ]);

    if (pErr) throw new Error(`Database error: ${pErr.message}`);
    if (lErr) console.error('Failed to fetch 7d stats logs:', lErr);

    let tracked = products.length;
    let in_stock = 0;
    let out_of_stock = 0;
    let unknown = 0;

    products.forEach(p => {
      if (!p.price_history || p.price_history.length === 0) {
        unknown++;
      } else if (p.price_history[0].in_stock) {
        in_stock++;
      } else {
        out_of_stock++;
      }
    });

    const attempts_7d = logs7d ? logs7d.length : 0;
    const successful_7d = logs7d ? logs7d.filter(l => ['success', 'retried'].includes(l.status)).length : 0;
    const success_rate_7d = attempts_7d > 0 ? Math.round((successful_7d / attempts_7d) * 100) : 0;
    const last_run_at = logs7d && logs7d.length > 0 ? logs7d[0].scraped_at : null;

    res.json({
      tracked,
      in_stock,
      out_of_stock,
      unknown,
      success_rate_7d,
      attempts_7d,
      last_run_at
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 2. GET /api/products -> All tracked products formatted strictly
// -------------------------------------------------------------------
router.get('/products', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        price_history ( * ),
        scrape_logs ( * )
      `)
      .order('scraped_at', { referencedTable: 'price_history', ascending: false })
      .limit(2, { referencedTable: 'price_history' })
      .order('scraped_at', { referencedTable: 'scrape_logs', ascending: false })
      .limit(1, { referencedTable: 'scrape_logs' });

    if (error) throw new Error(`Database error: ${error.message}`);

    const results = data.map(p => formatProduct(p, p.price_history || [], p.scrape_logs || []));
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 3. GET / POST /api/products/scrape-all -> Rescrape all tracked products
// MUST BE REGISTERED BEFORE /products/:id to prevent Express path collision!
// -------------------------------------------------------------------
router.all('/products/scrape-all', async (req, res, next) => {
  try {
    const { data: products, error } = await supabase.from('products').select('*');
    if (error) throw new Error(`Database error: ${error.message}`);

    // Fire and forget scraping to avoid HTTP timeouts and "Server warming up" warnings
    Promise.allSettled(products.map(async (product) => {
      const startTime = Date.now();
      const scrapeResult = await scrapeWithRetry(product.external_id);
      const durationMs = Date.now() - startTime;
      const errorCode = mapErrorCode(scrapeResult.status, scrapeResult.message);

      await supabase.from('scrape_logs').insert({
        product_id: product.id,
        status: scrapeResult.status,
        attempts: scrapeResult.attempts,
        message: scrapeResult.message,
        duration_ms: durationMs
      });

      if (scrapeResult.ok && scrapeResult.data) {
        const sd = scrapeResult.data;
        await supabase.from('price_history').insert({
          product_id: product.id,
          price: sd.price,
          in_stock: sd.inStock
        });
      }
    })).catch(err => console.error('Background scrape-all failed:', err));

    res.status(202).json({ ok: true, message: `Background scrape started for ${products.length} products.` });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 4. GET /api/products/:id -> Single product full details
// -------------------------------------------------------------------
router.get('/products/:id', async (req, res, next) => {
  try {
    const { data: p, error } = await supabase
      .from('products')
      .select(`
        *,
        price_history ( * ),
        scrape_logs ( * )
      `)
      .eq('id', req.params.id)
      .order('scraped_at', { referencedTable: 'price_history', ascending: false })
      .limit(50, { referencedTable: 'price_history' })
      .order('scraped_at', { referencedTable: 'scrape_logs', ascending: false })
      .limit(1, { referencedTable: 'scrape_logs' })
      .single();

    if (error || !p) {
      const err = new Error('Product not found');
      err.status = 404;
      throw err;
    }

    const formatted = formatProduct(p, p.price_history || [], p.scrape_logs || []);

    const validPrices = (p.price_history || []).map(h => parseFloat(h.price)).filter(pr => pr > 0);
    const min_price = validPrices.length > 0 ? Math.min(...validPrices) : null;
    const max_price = validPrices.length > 0 ? Math.max(...validPrices) : null;
    const avg_price = validPrices.length > 0 
      ? Math.round((validPrices.reduce((sum, val) => sum + val, 0) / validPrices.length) * 100) / 100 
      : null;

    res.json({
      ...formatted,
      min_price,
      max_price,
      avg_price
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 5. GET /api/products/:id/history?range=24h|7d|30d|all
// -------------------------------------------------------------------
router.get('/products/:id/history', async (req, res, next) => {
  try {
    const { range } = req.query;
    let query = supabase
      .from('price_history')
      .select('*')
      .eq('product_id', req.params.id)
      .gt('price', 0);

    if (range === '24h') {
      const t24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('scraped_at', t24h);
    } else if (range === '7d') {
      const t7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('scraped_at', t7d);
    } else if (range === '30d') {
      const t30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('scraped_at', t30d);
    }

    query = query.order('scraped_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw new Error(`Database error: ${error.message}`);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 6. GET /api/products/:id/logs?limit=50&status=...
// -------------------------------------------------------------------
router.get('/products/:id/logs', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { status } = req.query;

    let query = supabase
      .from('scrape_logs')
      .select('*')
      .eq('product_id', req.params.id);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('scraped_at', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Database error: ${error.message}`);

    const mapped = data.map(log => ({
      ...log,
      error_code: log.error_code || mapErrorCode(log.status, log.message)
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 7. POST /api/products/:id/scrape -> Single rescrape (Rate-limit 1/30s)
// -------------------------------------------------------------------
router.post('/products/:id/scrape', async (req, res, next) => {
  try {
    const productId = req.params.id;
    const now = Date.now();
    const lastScrapeTime = scrapeRateLimitMap.get(productId) || 0;

    if (now - lastScrapeTime < 30000) {
      const waitSec = Math.ceil((30000 - (now - lastScrapeTime)) / 1000);
      return res.status(429).json({
        error: `Rate limited: Please wait ${waitSec}s before scraping this product again.`
      });
    }

    scrapeRateLimitMap.set(productId, now);

    const { data: product, error: findError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (findError || !product) {
      const err = new Error('Product not found');
      err.status = 404;
      throw err;
    }

    const startTime = Date.now();
    const scrapeResult = await scrapeWithRetry(product.external_id);
    const durationMs = Date.now() - startTime;
    const errorCode = mapErrorCode(scrapeResult.status, scrapeResult.message);

    const { data: logData, error: logError } = await supabase
      .from('scrape_logs')
      .insert({
        product_id: product.id,
        status: scrapeResult.status,
        attempts: scrapeResult.attempts,
        message: scrapeResult.message,
        duration_ms: durationMs
      })
      .select()
      .single();

    if (logError) console.error('Failed to insert scrape log:', logError);

    if (scrapeResult.ok && scrapeResult.data) {
      const sd = scrapeResult.data;
      await supabase.from('price_history').insert({
        product_id: product.id,
        price: sd.price,
        in_stock: sd.inStock
      });
    }

    res.json(logData ? { ...logData, error_code: errorCode } : {
      product_id: product.id,
      status: scrapeResult.status,
      attempts: scrapeResult.attempts,
      error_code: errorCode,
      message: scrapeResult.message,
      duration_ms: durationMs,
      scraped_at: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 8. PATCH /api/products/:id { scrape_interval_minutes }
// -------------------------------------------------------------------
router.patch('/products/:id', async (req, res, next) => {
  try {
    const { scrape_interval_minutes } = req.body;
    const allowed = [60, 120, 360, 720, 1440];

    if (!allowed.includes(Number(scrape_interval_minutes))) {
      return res.status(400).json({
        error: `Invalid scrape_interval_minutes. Allowed values: ${allowed.join(', ')}`
      });
    }

    const { data: updated, error } = await supabase
      .from('products')
      .update({ scrape_interval_minutes: Number(scrape_interval_minutes) })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new Error(`Database error: ${error.message}`);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 9. POST /api/track -> Track product
// -------------------------------------------------------------------
router.post('/track', async (req, res, next) => {
  try {
    const { name, url, external_id, image_url } = req.body;
    const extId = String(url || external_id);

    if (!name || !extId) {
      const err = new Error('Missing name or url/external_id in request body');
      err.status = 400;
      throw err;
    }

    const { data: productData, error: productError } = await supabase
      .from('products')
      .upsert(
        { 
          name, 
          external_id: extId, 
          image_url: image_url || null
        },
        { onConflict: 'external_id' }
      )
      .select()
      .single();

    if (productError) throw new Error(`Database error: ${productError.message}`);

    const productId = productData.id;
    const startTime = Date.now();
    const scrapeResult = await scrapeWithRetry(extId);
    const durationMs = Date.now() - startTime;
    const errorCode = mapErrorCode(scrapeResult.status, scrapeResult.message);

    await supabase.from('scrape_logs').insert({
      product_id: productId,
      status: scrapeResult.status,
      attempts: scrapeResult.attempts,
      message: scrapeResult.message,
      duration_ms: durationMs
    });

    if (scrapeResult.ok && scrapeResult.data) {
      const sd = scrapeResult.data;
      await supabase.from('price_history').insert({
        product_id: productId,
        price: sd.price,
        in_stock: sd.inStock
      });
    }

    // Invalidate search cache so new product appears immediately in search results
    await invalidateSearchCache();

    res.status(201).json({
      message: 'Product tracked and scraped',
      product: productData,
      scrape_status: scrapeResult.status,
      scraped_data: scrapeResult.data || null
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 10. DELETE /api/products -> Untrack all
// -------------------------------------------------------------------
router.delete('/products', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw new Error(`Database error: ${error.message}`);

    // Invalidate search cache so deleted products disappear from results immediately
    await invalidateSearchCache();

    res.json({ ok: true, message: 'All products untracked' });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 11. DELETE /api/products/:id -> Untrack single product
// -------------------------------------------------------------------
router.delete('/products/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);

    if (error) throw new Error(`Database error: ${error.message}`);

    // Invalidate search cache so deleted product disappears from results immediately
    await invalidateSearchCache();

    res.json({ ok: true, message: 'Product untracked' });
  } catch (err) {
    next(err);
  }
});

export default router;
