import { supabase } from './db.js';
import { scrapeWithRetry } from './scraper/scraper.js';

export async function runScheduledScrapes() {
  try {
    const { data: products, error } = await supabase.from('products').select('*');
    if (error || !products || products.length === 0) return;

    const now = Date.now();

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

      if (now - lastScrapedAt >= intervalMs) {
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
