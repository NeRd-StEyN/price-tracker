# Store Analysis: demo.inelabteamdev.com

This document contains the findings from inspecting the target e-commerce demo storefront.

## 1. Product Listings & URL Patterns
- **Product Listing:** Products are listed on the main page via a grid layout. The product data for the main page is fetched dynamically as JSON from the `/api/catalog` endpoint.
- **Product Page URL:** `https://demo.inelabteamdev.com/product/:id` (e.g., `/product/148`).
- **Search URL:** The frontend handles search dynamically, and fetches matching results from the API using `https://demo.inelabteamdev.com/api/catalog?q=searchTerm`.

## 2. Price and Stock Data Source
- **Raw HTML:** No. The application is a client-side rendered (CSR) React app. The raw HTML only contains a `<div id="root"></div>` mount point.
- **Network/API Request:** Surprisingly, **there is NO network/API request** for the price or stock data. The `/api/product/:id` endpoint returns product metadata (name, description, specs, reviews) but intentionally omits price and stock. 
- **How it loads:** The price and stock are generated/revealed entirely **client-side** by obfuscated JavaScript logic. This happens only after completing an anti-bot challenge (hovering the mouse over the price area to fulfill a `minMoves` and `minDwellMs` threshold) and then clicking the "Reveal price" button.

## 3. CSS Selectors
The following selectors hold the core product data:
- **Product Name:** `h1`
- **Price:** `.price-value` or `.price-current` (rendered inside `.price-block` only after clicking the reveal button).
- **Stock Status:** `.stock-badge` or `.stock-status` (rendered inside `.price-block` only after clicking the reveal button).
- **Product Image:** `.detail-media svg` (The site uses inline SVG category icons instead of standard `<img>` tags).
- **Product Description:** `.detail-desc`

## 4. "Awkward" Behaviors (After 10+ Reloads)
- **Anti-Bot Interaction Wall:** The "Reveal price" button is initially `disabled`. It requires specific human-like interaction (moving the mouse over `.price-block` repeatedly and dwelling on it for a few seconds) to become enabled.
- **Fake Loading Delays:** Once the button is enabled and clicked, the UI intentionally delays the price reveal with a "Loading current price…" status, artificially slowing down data extraction.
- **Layout Blocking:** A cookie consent banner (`.cookie-overlay`) frequently blocks the bottom of the screen, which intercepts mouse clicks/hovers unless the "Accept" button is clicked first.
- **Consistency:** No HTTP errors (500s/403s) were observed on the main API endpoints (`/api/catalog` and `/api/product/:id`) during heavy reloading.

## 5. Recommendation & Justification
**Recommendation:** **Headless Playwright**.

**Justification:** 
A plain HTTP fetch + Cheerio approach will completely fail because the site is a Single Page Application with an empty raw HTML body. 
Calling the JSON API directly (`/api/catalog` or `/api/product/:id`) will also fail to retrieve price and stock because those fields are intentionally excluded from the backend payloads. 
Since the price is calculated and injected strictly via client-side JavaScript—and protected by a mouse-movement anti-bot check and a disabled button—we absolutely need a full headless browser (like Playwright) to execute the JS, bypass the cookie banner, simulate human mouse movements, click the reveal button, wait for the fake loading delay, and extract the rendered text from the DOM.
