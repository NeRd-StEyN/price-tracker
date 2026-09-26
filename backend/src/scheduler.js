import { supabase } from './db.js';
import { scrapeWithRetry } from './scraper/scraper.js';
import { syncCatalog } from './scraper/syncCatalog.js';

let lastCatalogSyncTime = 0;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function runScheduledScrapes() {
  try {
    const now = Date.now();

    // Trigger daily catalog sync if 24 hours have elapsed
    if (now - lastCatalogSyncTime >= ONE_DAY_MS) {
      lastCatalogSyncTime = now;
      console.log('[SCHEDULER] Daily catalog sync with INE official store is due. Starting background sync...');
      syncCatalog().catch(err => console.error('[SCHEDULER] Catalog sync error:', err));
    }

    const { data: products, error } = await supabase.from('products').select('*');
    if (error || !products || products.length === 0) return;

    for (const product of products) {
      const intervalMinutes = product.scrape_interval_minutes || 120;
      const intervalMs = intervalMinutes * 60 * 1000;

      const { data: lastLog } = await supabase
        .from('scrape_logs')
        .select('scraped_at')
        .eq('product_id', product.id)
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      const lastScrapedAt = lastLog ? new Date(lastLog.scraped_at).getTime() : 0;

      // Add a 5 minute grace period to account for cron jobs running a few seconds/minutes early
      if (now - lastScrapedAt >= (intervalMs - 5 * 60 * 1000)) {
        console.log(`[SCHEDULER] Product "${product.name}" is due for rescrape (Interval: ${intervalMinutes}m). Scraping...`);
        const startTime = Date.now();
        const scrapeResult = await scrapeWithRetry(product.external_id);
        const durationMs = Date.now() - startTime;

        await supabase.from('scrape_logs').insert({
          product_id: product.id,
          status: scrapeResult.status,
          attempts: scrapeResult.attempts,
          message: scrapeResult.message,
          duration_ms: durationMs
        });

        if (scrapeResult.ok && scrapeResult.data) {
          await supabase.from('price_history').insert({
            product_id: product.id,
            price: scrapeResult.data.price,
            in_stock: scrapeResult.data.inStock
          });
        }
      }
    }
  } catch (err) {
    console.error('[SCHEDULER ERROR]:', err);
  }
}

