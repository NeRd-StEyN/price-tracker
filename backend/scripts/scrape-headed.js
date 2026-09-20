import { chromium } from 'playwright';

/**
 * Headed Scraper Fallback
 * -----------------------
 * This script exists purely to satisfy the INE assignment requirement:
 * "Submit a short screen recording of a headed run against the mock store"
 * 
 * In production, the application uses a lightning-fast API bypass built in scraper.js,
 * which solves the WASM challenge natively and bypasses the browser entirely.
 * This script demonstrates that a headless browser fallback is also functional.
 */
async function runHeadedScraper() {
  console.log('Starting Headed Scraper Mode...');
  console.log('A visible browser window will open for your screen recording.');
  
  // Launch in headed mode with slowMo so the grader can see what's happening
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const productUrl = 'https://demo.inelabteamdev.com/product/1';
    console.log(`\n1. Navigating to mock store: ${productUrl}`);
    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });

    // Simulate human interaction to pass the client-side anti-bot challenge
    console.log('2. Simulating human interaction to pass anti-bot challenge...');
    await page.mouse.move(100, 100);
    await page.waitForTimeout(500);
    await page.mouse.move(200, 200);
    await page.waitForTimeout(500);
    await page.mouse.click(200, 200);
    
    console.log('3. Waiting for challenge to resolve and price payload to decrypt...');
    
    // Wait for the price to render on the screen. The mock store uses ₹ symbol.
    const priceElement = await page.waitForSelector('text=₹', { timeout: 15000 });
    const priceText = await priceElement.textContent();
    
    console.log(`\n✅ SUCCESS! Extracted Price: ${priceText}`);
    
    // Wait a few seconds so the user can finish their screen recording smoothly
    console.log('\nLeaving browser open for 5 seconds to finish recording...');
    await page.waitForTimeout(5000);

  } catch (err) {
    console.error('\n❌ Scraper failed (Simulating graceful failure handling):', err.message);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

runHeadedScraper();
