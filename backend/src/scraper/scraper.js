import crypto from 'crypto';

// Replaces Playwright with direct reverse-engineered API requests
const BASE_URL = 'https://demo.inelabteamdev.com';
const LR = 'ine-mock-store-shared-k3y'; // Shared secret derived from frontend bundle

function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function solvePoW(salt, difficulty) {
  const target = '0'.repeat(difficulty);
  let nonce = 0;
  while (sha256(salt + ':' + nonce).slice(0, difficulty) !== target) {
    nonce++;
  }
  return nonce;
}

async function runWasm(wasmBase64, seed) {
  const wasmBytes = Buffer.from(wasmBase64, 'base64');
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(wasmModule);
  return instance.exports.f(seed) | 0;
}

function decryptPrice(enc64, token) {
  const keyHex = sha256(LR + '|enc|' + token);
  const keyBytes = Buffer.from(keyHex, 'hex');
  const enc = Buffer.from(enc64, 'base64');
  const dec = Buffer.alloc(enc.length);
  for (let i = 0; i < enc.length; i++) dec[i] = enc[i] ^ keyBytes[i % 32];
  return JSON.parse(dec.toString('utf8'));
}

/**
 * A tagged error that carries an HTTP status code.
 * Used to distinguish permanent failures (404) from transient ones (503, 500).
 */
class ScraperError extends Error {
  constructor(message, httpStatus) {
    super(message);
    this.httpStatus = httpStatus;
  }
  get isTransient() {
    // 500, 502, 503, 504 are server-side transient errors - always retry
    return this.httpStatus >= 500;
  }
  get isPermanent() {
    // 404 means the product simply doesn't exist
    return this.httpStatus === 404;
  }
}

/**
 * Fetch with a timeout so we never hang indefinitely.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scrape a specific product by directly interacting with the backend API.
 * Bypasses the client-side anti-bot check completely by solving the
 * cryptographic challenge natively in Node.js.
 */
export async function scrapeProduct(productUrlOrId) {
  // Extract numeric ID from URL or use directly
  let productId = productUrlOrId;
  if (String(productUrlOrId).startsWith('http')) {
    const match = productUrlOrId.match(/\/product\/(\d+)/);
    if (match) productId = match[1];
  }
  productId = Number(productId);

  // ── Step 1: Fetch product metadata ───────────────────────────────────────
  const prodRes = await fetchWithTimeout(`${BASE_URL}/api/product/${productId}`);
  if (prodRes.status === 404) {
    throw new ScraperError('Product not found (404)', 404);
  }
  if (!prodRes.ok) {
    throw new ScraperError(`Product metadata fetch failed: ${prodRes.status}`, prodRes.status);
  }
  const productData = await prodRes.json();

  // ── Step 2: Get a fresh anti-bot challenge ────────────────────────────────
  const cr = await fetchWithTimeout(`${BASE_URL}/api/challenge`);
  if (!cr.ok) {
    throw new ScraperError(`Challenge endpoint returned ${cr.status}`, cr.status);
  }
  const challenge = await cr.json();

  // ── Step 3: Build a synthetic but mathematically valid fingerprint ────────
  const now = Date.now();
  const snapshotIx = {
    hoverAt: now - 1200,
    dwellMs: 1200,
    moves: [
      [150, 200, now - 1200], [155, 205, now - 1100], [160, 210, now - 1000],
      [165, 215, now - 900],  [170, 220, now - 800],  [175, 225, now - 700],
      [180, 230, now - 600],  [185, 235, now - 500]
    ],
    clickAt: now,
    trusted: true   // crucial – server rejects untrusted events
  };

  const fingerprintObj = {
    env: {
      canvas: 'a1b2c3d4e5f6a7b8',
      gl: 'b2c3d4e5f6a7b8c9',
      hc: 4,
      scr: [1920, 1080, 1],
      frames: [16.7, 16.8, 16.6, 16.9, 16.7, 16.8, 16.7, 16.9],
      at: now
    },
    ix: snapshotIx
  };

  const fingerprintJSON = JSON.stringify(fingerprintObj);
  const fpHash = sha256(fingerprintJSON);

  // ── Step 4: Cryptographic proof computation ───────────────────────────────
  const wasmSeed = parseInt(sha256(LR + '|seed|' + challenge.salt + '|' + fpHash).slice(0, 8), 16) | 0;
  const wasmOut  = await runWasm(challenge.wasm, wasmSeed);
  const nonce    = solvePoW(challenge.salt, challenge.difficulty);
  const derived  = sha256(LR + '|derive|' + challenge.salt + '|' + (wasmOut | 0) + '|' + fpHash);

  // ── Step 5: Exchange proof for a session token ────────────────────────────
  const sessionBody = { ...challenge, nonce, derived, wasmOut, att: fingerprintJSON, productId };
  const sr = await fetchWithTimeout(`${BASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionBody)
  });

  if (!sr.ok) {
    const text = await sr.text().catch(() => '');
    throw new ScraperError(`Session token exchange failed (${sr.status}): ${text.slice(0, 120)}`, sr.status);
  }

  const { token } = await sr.json();

  // ── Step 6: Fetch the encrypted price payload ─────────────────────────────
  const pr = await fetchWithTimeout(`${BASE_URL}/api/products/${productId}/price`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!pr.ok) {
    const text = await pr.text().catch(() => '');
    throw new ScraperError(`Price endpoint returned ${pr.status}: ${text.slice(0, 120)}`, pr.status);
  }

  const prData = await pr.json();

  // ── Step 7: Decrypt the XOR-encrypted price JSON ──────────────────────────
  const decrypted = decryptPrice(prData.e, token);

  // ── Step 8: Normalise into a standard result object ───────────────────────
  // The shown price is always `p`. Fallback chain: p → n (sale) → m (MRP).
  const priceVal = decrypted.p ?? decrypted.n ?? decrypted.m;
  const numPrice = typeof priceVal === 'number' ? priceVal : parseFloat(String(priceVal).replace(/[^0-9.]/g, ''));
  const mrpVal = decrypted.m != null ? (typeof decrypted.m === 'number' ? decrypted.m : parseFloat(String(decrypted.m))) : null;
  const saleVal = decrypted.n != null ? (typeof decrypted.n === 'number' ? decrypted.n : parseFloat(String(decrypted.n))) : null;

  const stockUnits = typeof decrypted.s === 'number' ? decrypted.s : (decrypted.s ? 1 : 0);
  const inStock = stockUnits > 0;

  return {
    name: productData.name,
    brand: productData.brand || null,
    sku: productData.sku || null,
    category: productData.category || null,
    description: productData.description || null,
    specs: productData.specs || {},
    reviews: productData.reviews || [],
    price: numPrice,
    mrp: mrpVal,
    sale_price: saleVal,
    currency: decrypted.c || 'INR',
    stock_units: stockUnits,
    inStock,
    rating: decrypted.r ?? null,
    rating_count: decrypted.rc ?? null,
    seller: decrypted.sl ?? null,
    delivery_days: decrypted.d ?? null
  };
}


class RequestQueue {
  constructor(concurrency, delayMs) {
    this.concurrency = Math.max(1, concurrency);
    this.delayMs = delayMs;
    this.active = 0;
    this.queue = [];
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.active >= this.concurrency || this.queue.length === 0) return;
    this.active++;
    const { task, resolve, reject } = this.queue.shift();
    try {
      const result = await task();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      setTimeout(() => {
        this.active--;
        this.processNext();
      }, this.delayMs);
    }
  }
}

// Global queue: Max 1 concurrent scrape, with 1500ms delay to perfectly respect strict rate limits
const globalScrapeQueue = new RequestQueue(1, 1500);

/**
 * Core scraping logic wrapped with smart retry.
 */
async function _scrapeWithRetryCore(product) {
  const MAX_ATTEMPTS = 5;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await scrapeProduct(product);
      return {
        ok: true,
        data,
        attempts: attempt,
        status: attempt === 1 ? 'success' : 'retried',
        message: 'Scraped successfully'
      };
    } catch (err) {
      lastError = err;

      // Never retry permanent errors
      if (err instanceof ScraperError && err.isPermanent) {
        break;
      }

      // If we have more attempts left, wait with exponential backoff
      if (attempt < MAX_ATTEMPTS) {
        // 500ms, 1s, 2s, 4s between attempts
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 4000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    ok: false,
    data: null,
    attempts: MAX_ATTEMPTS,
    status: 'failed',
    message: lastError ? lastError.message : 'Unknown error'
  };
}

/**
 * Wraps _scrapeWithRetryCore in a global queue to strictly prevent 429 errors from bulk requests.
 */
export async function scrapeWithRetry(product) {
  return globalScrapeQueue.enqueue(() => _scrapeWithRetryCore(product));
}

/**
 * Retained for backwards compatibility (no-op: no browser to close).
 */
export async function closeScraper() {
  return Promise.resolve();
}
