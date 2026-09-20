# Design Note: Scraping Reliability & Architectural Trade-offs

## 1. Scraping Reliability Strategy

INE's mock storefront (`https://demo.inelabteamdev.com`) incorporates several deliberate anti-scraping mechanisms:
- Client-side WebAssembly Proof-of-Work challenge computation (`/api/challenge`).
- Short-lived XOR-encrypted session token exchange (`/api/session`).
- Simulated transient 503 errors and session rejections (`SESSION_REJECTED`).
- Dynamic rate-limiting and asynchronous DOM loading delays.

To achieve **100% unattended scraping reliability**, we implemented a 4-pillar strategy:

1. **Native WebAssembly & Proof-of-Work Solver:** Bypassed client-side browser overhead by compiling and instantiating the WebAssembly challenge in Node.js, solving SHA-256 nonces natively in `<100ms`.
2. **Exponential Backoff Retry Engine (`scrapeWithRetry`):** Automatically retries up to 5 attempts when transient `503` or `SESSION_REJECTED` errors occur, waiting `500ms`, `1s`, `2s`, `4s` between attempts.
3. **Data Preservation Principle (No Fake Data):** When all retry attempts fail, the system **never** stores `$0` or `N/A` in price history. Instead, it preserves the last known valid price and flags the record honestly with status `Failed`.
4. **Automated Error Code Mapping:** Maps raw error messages into standardized error codes (`STRUCTURE_CHANGED`, `SESSION_REJECTED`, `503`, `TIMEOUT`, `NOT_FOUND`).

---

## 2. Architectural Trade-offs: HTTP API vs. Headed Playwright

| Dimension | Reverse-Engineered HTTP API (Primary) | Headed Playwright Browser (Fallback) |
| :--- | :--- | :--- |
| **Execution Speed** | **<100ms** per scrape | **15–20 seconds** per scrape |
| **Resource Usage** | Lightweight (~10MB RAM) | Heavy (~500MB+ RAM per instance) |
| **Reliability on Free Tiers** | High (Does not time out on Render/Vercel) | Fragile (Prone to memory caps & process kills) |
| **Observability** | Telemetry logs in database | Visual browser DOM execution |

**Decision:** We selected the native HTTP API approach for all production automated runs, providing a separate Playwright script (`scrape:headed`) for visual demonstration and screen recordings.

---

## 3. What AI Tools Got Wrong & How It Was Corrected

1. **Initial Misconception: Over-reliance on Headless Browsers**
   - *AI Flaw:* AI tools initially attempted to spin up full Playwright headless browser instances for every scrape request.
   - *Failure:* Render's free tier memory limit caused browser instances to crash or hang during batch scrapes.
   - *Correction:* We reverse-engineered the store's network requests (`/api/challenge`, `/api/session`, `/api/product/:id/price`), solving the WebAssembly proof natively in Node.

2. **Database Schema Mismatch on Remote Supabase**
   - *AI Flaw:* AI tools attempted to write non-existent columns (`brand`, `sku`, `error_code`) directly to Supabase tables, causing `PGRST204` schema cache errors.
   - *Correction:* Aligned database writes strictly with remote table schemas and derived UI metadata dynamically in JavaScript memory.

3. **Silent Failure vs. Honest Logging**
   - *AI Flaw:* AI tools initially swallowed scrape errors or returned dummy fallback values (`$0.00`).
   - *Correction:* Implemented honest logging where failures are recorded as `status: 'failed'` in telemetry logs while preserving the last verified good price history.
