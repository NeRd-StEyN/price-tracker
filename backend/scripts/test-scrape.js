import { scrapeWithRetry, closeScraper } from '../src/scraper/scraper.js';

async function main() {
  // Get the product ID or URL from command line arguments
  const product = process.argv[2];
  if (!product) {
    console.error('Please provide a product ID or URL.\nUsage: npm run test:scrape <id>  OR  node scripts/test-scrape.js <id>');
    process.exit(1);
  }

  console.log(`Starting 20 scrape tests for product: ${product}`);
  
  let successCount = 0;
  let retriedCount = 0;
  let failedCount = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  // Run the test 20 times in a row
  for (let i = 1; i <= 20; i++) {
    console.log(`\n--- Test ${i}/20 ---`);
    const result = await scrapeWithRetry(product);
    
    // Tally the status
    if (result.status === 'success') {
      successCount++;
    } else if (result.status === 'retried') {
      retriedCount++;
    } else {
      failedCount++;
    }

    // Extract price for min/max tracking if successful
    if (result.ok && result.data && result.data.price) {
      const price = result.data.price;
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
      console.log(`Result: OK (${result.status}) in ${result.attempts} attempt(s) | Price: ${price} | Stock: ${result.data.inStock}`);
    } else {
      console.log(`Result: FAILED in ${result.attempts} attempt(s) | Error: ${result.message}`);
    }
  }

  // Clean up Playwright resources
  await closeScraper();

  // Print final summary
  console.log('\n==============================');
  console.log('       FINAL SUMMARY          ');
  console.log('==============================');
  console.log(`Success (1st try): ${successCount}`);
  console.log(`Retried (Success): ${retriedCount}`);
  console.log(`Failed (All tries): ${failedCount}`);
  
  if (minPrice !== Infinity) {
    console.log(`Min Price Found: ${minPrice}`);
    console.log(`Max Price Found: ${maxPrice}`);
  } else {
    console.log(`Min/Max Price: N/A (no successful scrapes)`);
  }
}

// Execute the main function and handle any uncaught top-level errors
main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
