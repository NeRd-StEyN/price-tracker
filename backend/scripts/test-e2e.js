import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\pc\\.gemini\\antigravity-ide\\brain\\95283c04-41b8-4b4a-826c-09adca025fd2';

async function runTests() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to Dashboard...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_dashboard.png') });
    console.log('Dashboard screenshot saved.');

    console.log('Navigating to Search...');
    await page.click('text=Search & Track');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_search_empty.png') });
    
    console.log('Searching for Auralite...');
    await page.fill('input[placeholder="Type to search products..."]', 'Auralite');
    await page.waitForTimeout(2000); // Wait for debounce and API response
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_search_results.png') });
    console.log('Search results screenshot saved.');

    // We'll click the first "Track Product" button if available
    const trackBtns = await page.$$('text=Track Product');
    if (trackBtns.length > 0) {
      console.log('Clicking Track Product...');
      await trackBtns[0].click();
      await page.waitForTimeout(1000);
    } else {
      console.log('No untracked products found to track.');
    }

    console.log('Returning to Dashboard...');
    await page.click('text=Tracked Products');
    await page.waitForTimeout(1000);

    // Click the first product card (View history link)
    console.log('Navigating to Product Detail...');
    const viewHistoryLinks = await page.$$('text=View history');
    if (viewHistoryLinks.length > 0) {
      await viewHistoryLinks[0].click();
      await page.waitForTimeout(1500); // Wait for data to load
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_detail.png'), fullPage: true });
      console.log('Product detail screenshot saved.');
    } else {
      console.log('No tracked products found on dashboard.');
    }

    console.log('E2E testing completed successfully.');
  } catch (err) {
    console.error('Error during testing:', err);
  } finally {
    await browser.close();
  }
}

runTests();
