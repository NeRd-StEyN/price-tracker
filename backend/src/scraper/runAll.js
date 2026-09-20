import { supabase } from '../db.js';
import { scrapeWithRetry, closeScraper } from './scraper.js';

export let isScraping = false;

export async function runAllScrapes() {
  isScraping = true;
  console.log('Starting scheduled scraper run...');
  const startTime = Date.now();

  try {
    // Fetch all tracked products
    const { data: products, error } = await supabase.from('products').select('*');
    if (error) throw error;
    
    console.log(`Found ${products?.length || 0} products to scrape.`);

    if (products) {
      for (const product of products) {
        console.log(`Scraping product: ${product.name} (ID: ${product.id})`);
        
        const scrapeStart = Date.now();
        let result;
        try {
          result = await scrapeWithRetry(product.external_id || product.url);
        } catch (err) {
          // Fallback catch if scrapeWithRetry throws instead of returning object
          result = {
            ok: false,
            attempts: 3,
            status: 'failed',
            message: err.message || 'Unknown fatal error in scraper'
          };
        }
        
        const durationMs = Date.now() - scrapeStart;

        // Insert into scrape_logs always
        const { error: logErr } = await supabase.from('scrape_logs').insert({
          product_id: product.id,
          status: result.status,
          message: result.message,
          attempts: result.attempts,
          duration_ms: durationMs
        });
        
        if (logErr) console.error(`Log DB error for ${product.id}:`, logErr);

        // If successful, insert into price_history
        if (result.ok && result.data) {
          const { error: histErr } = await supabase.from('price_history').insert({
            product_id: product.id,
            price: result.data.price,
            in_stock: result.data.inStock ? true : false
          });
          
          if (histErr) {
            console.error(`History DB error for ${product.id}:`, histErr);
          } else {
            console.log(`[SUCCESS] ${product.name}: $${result.data.price} (${result.data.inStock ? 'In Stock' : 'Out of Stock'})`);
          }
        } else {
          console.log(`[FAILED] ${product.name}: ${result.message}`);
        }

        // Polite delay between products – gives the upstream demo server breathing room
        // to avoid triggering 503 "upstream_error" responses
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  } catch (err) {
    console.error('Fatal error during runAllScrapes loop:', err);
  } finally {
    await closeScraper();
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Scheduled scraper run completed in ${totalTime}s.`);
    isScraping = false;
  }
}
