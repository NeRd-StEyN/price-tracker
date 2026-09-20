import crypto from 'crypto';

const BASE_URL = 'https://demo.inelabteamdev.com';
const LR = 'ine-mock-store-shared-k3y'; 

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

class ScraperError extends Error {
  constructor(message, httpStatus) {
    super(message);
    this.httpStatus = httpStatus;
  }
  get isTransient() {
    
    return this.httpStatus >= 500;
  }
  get isPermanent() {
    
    return this.httpStatus === 404;
  }
}

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

let lastHtmlHash = null;
let lastHtmlCheckTime = 0;

async function checkStoreHtmlChanges() {
  const now = Date.now();
  if (now - lastHtmlCheckTime < 60 * 60 * 1000) return; 
  lastHtmlCheckTime = now;
  try {
    const res = await fetchWithTimeout(BASE_URL, { method: 'GET' }, 5000);
    if (!res.ok) return;
    const html = await res.text();

    const structureOnly = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/[0-9]+/g, '');
      
    const currentHash = sha256(structureOnly);
    
    if (lastHtmlHash && lastHtmlHash !== currentHash) {
      console.warn('\n⚠️ ⚠️ [CHANGE DETECTION ALERT] ⚠️ ⚠️');
      console.warn('The mock store HTML structure has been modified by INE!');
      console.warn('Scraping logic may require an update if the WASM bridge broke.\n');
    }
    lastHtmlHash = currentHash;
  } catch (err) {
    
  }
}

export async function scrapeProduct(productUrlOrId) {
  
  await checkStoreHtmlChanges();

  let productId = productUrlOrId;
  if (String(productUrlOrId).startsWith('http')) {
    const match = productUrlOrId.match(/\/product\/(\d+)/);
    if (match) productId = match[1];
  }
  productId = Number(productId);

  const [prodRes, cr] = await Promise.all([
    fetchWithTimeout(`${BASE_URL}/api/product/${productId}`),
    fetchWithTimeout(`${BASE_URL}/api/challenge`)
  ]);

  if (prodRes.status === 404) {
    throw new ScraperError('Product not found (404)', 404);
  }
  if (!prodRes.ok) {
    throw new ScraperError(`Product metadata fetch failed: ${prodRes.status}`, prodRes.status);
  }
  const productData = await prodRes.json();

  if (!cr.ok) {
    throw new ScraperError(`Challenge endpoint returned ${cr.status}`, cr.status);
  }
  const challenge = await cr.json();

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
    trusted: true   
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

  const wasmSeed = parseInt(sha256(LR + '|seed|' + challenge.salt + '|' + fpHash).slice(0, 8), 16) | 0;
  const wasmOut  = await runWasm(challenge.wasm, wasmSeed);
  const nonce    = solvePoW(challenge.salt, challenge.difficulty);
  const derived  = sha256(LR + '|derive|' + challenge.salt + '|' + (wasmOut | 0) + '|' + fpHash);

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

  const pr = await fetchWithTimeout(`${BASE_URL}/api/products/${productId}/price`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!pr.ok) {
    const text = await pr.text().catch(() => '');
    throw new ScraperError(`Price endpoint returned ${pr.status}: ${text.slice(0, 120)}`, pr.status);
  }

  const prData = await pr.json();

  const decrypted = decryptPrice(prData.e, token);

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

  enqueue(task, priority = false) {
    return new Promise((resolve, reject) => {
      if (priority) {
        this.queue.unshift({ task, resolve, reject });
      } else {
        this.queue.push({ task, resolve, reject });
      }
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

const globalScrapeQueue = new RequestQueue(1, 1500);

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

      if (err instanceof ScraperError && err.isPermanent) {
        break;
      }

      if (attempt < MAX_ATTEMPTS) {
        
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

export async function scrapeWithRetry(product, priority = false) {
  return globalScrapeQueue.enqueue(() => _scrapeWithRetryCore(product), priority);
}

export async function closeScraper() {
  return Promise.resolve();
}
