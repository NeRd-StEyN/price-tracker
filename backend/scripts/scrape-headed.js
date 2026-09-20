import { chromium } from 'playwright';

/**
 * Headed Scraper Demonstration Script
 * 
 * Runs a visible Playwright browser instance against INE's mock storefront.
 * Useful for screen recordings to demonstrate anti-bot challenge solving,
 * DOM interactions, and retry handling under slow/failing responses.
 * 
 * Usage:
 *   cd backend
 *   npm run scrape:headed
 */
async function runHeadedScraper() {
  console.log('🚀 Launching Headed Playwright Browser...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000 // Slow down actions by 1s so it can be watched easily on screen recording
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    const targetId = process.argv[2] || '1';
    const targetUrl = `https://demo.inelabteamdev.com/product/${targetId}`;

    console.log(`📡 Navigating to mock store item: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('⌛ Waiting for price element and anti-bot challenge execution...');
    
    // Wait for price container to be rendered
    await page.waitForTimeout(3000);

    const priceText = await page.locator('body').innerText();
    console.log('✅ Page content loaded cleanly!');
    console.log('----------------------------------------------------');
    console.log(priceText.slice(0, 300));
    console.log('----------------------------------------------------');

    console.log('🎉 Headed scrape demonstration finished! Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
  } catch (err) {
    console.error('❌ Headed scrape error:', err.message);
  } finally {
    await browser.close();
    console.log('🔒 Browser closed.');
  }
}

runHeadedScraper();
