import { supabase } from '../db.js';
import { scrapeWithRetry, closeScraper } from './scraper.js';
import { sendAlertEmail } from '../utils/email.js';

export let isScraping = false;

export async function runAllScrapes() {
  isScraping = true;
  console.log('Starting scheduled scraper run...');
  const startTime = Date.now();

  try {
    
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
          
          result = {
            ok: false,
            attempts: 3,
            status: 'failed',
            message: err.message || 'Unknown fatal error in scraper'
          };
        }
        
        const durationMs = Date.now() - scrapeStart;

        const { error: logErr } = await supabase.from('scrape_logs').insert({
          product_id: product.id,
          status: result.status,
          message: result.message,
          attempts: result.attempts,
          duration_ms: durationMs
        });
        
        if (logErr) console.error(`Log DB error for ${product.id}:`, logErr);

        if (result.ok && result.data) {
          const newPrice = parseFloat(result.data.price);
          const newInStock = result.data.inStock ? true : false;

          const { data: previousHistory } = await supabase
            .from('price_history')
            .select('price, in_stock')
            .eq('product_id', product.id)
            .order('scraped_at', { ascending: false })
            .limit(1)
            .single();

          if (previousHistory) {
            const oldPrice = parseFloat(previousHistory.price);
            const oldInStock = previousHistory.in_stock;

            if (newPrice < oldPrice) {
              const subject = `📉 Price Drop Alert: ${product.name}`;
              const htmlBody = `
                <h2>Price Drop Alert!</h2>
                <p>Great news! The price for <strong>${product.name}</strong> has dropped.</p>
                <ul>
                  <li><strong>Old Price:</strong> $${oldPrice}</li>
                  <li><strong>New Price:</strong> $${newPrice}</li>
                </ul>
                <p>Check your dashboard for more details.</p>
              `;
              await sendAlertEmail(subject, htmlBody);
            }

            if (oldInStock === false && newInStock === true) {
              const subject = `📦 Back in Stock Alert: ${product.name}`;
              const htmlBody = `
                <h2>Back in Stock Alert!</h2>
                <p>The product <strong>${product.name}</strong> is finally back in stock!</p>
                <p><strong>Current Price:</strong> $${newPrice}</p>
                <p>Hurry and check your dashboard to grab it.</p>
              `;
              await sendAlertEmail(subject, htmlBody);
            }
          }

          const { error: histErr } = await supabase.from('price_history').insert({
            product_id: product.id,
            price: newPrice,
            in_stock: newInStock
          });
          
          if (histErr) {
            console.error(`History DB error for ${product.id}:`, histErr);
          } else {
            console.log(`[SUCCESS] ${product.name}: $${newPrice} (${newInStock ? 'In Stock' : 'Out of Stock'})`);
          }
        } else {
          console.log(`[FAILED] ${product.name}: ${result.message}`);
        }

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
