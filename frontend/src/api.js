// Base URL for the API. Read from Vite's env and strip trailing slashes to prevent double-slash 404 errors.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

let activeSlowTimeouts = new Set();
let activeRequestCount = 0;

/**
 * Fetch wrapper that dispatches a slow warning event ONLY if a request takes >3 seconds.
 * Immediately clears the warning banner when requests complete.
 */
async function fetchWithSlowWarning(url, options = {}) {
  activeRequestCount++;
  let slowTimeoutId = null;

  slowTimeoutId = setTimeout(() => {
    document.dispatchEvent(new CustomEvent('api:slow-response'));
  }, 6000);

  activeSlowTimeouts.add(slowTimeoutId);

  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      const errBody = await res.text();
      let errMsg = `Request failed with status ${res.status}`;
      try {
        const json = JSON.parse(errBody);
        if (json.error) errMsg = json.error;
      } catch (e) {}
      throw new Error(errMsg);
    }

    return await res.json();
  } finally {
    clearTimeout(slowTimeoutId);
    activeSlowTimeouts.delete(slowTimeoutId);
    activeRequestCount--;

    if (activeRequestCount === 0) {
      document.dispatchEvent(new CustomEvent('api:resolved'));
    }
  }
}

// 1. Summary Stats for Dashboard Header
export async function getStats() {
  return fetchWithSlowWarning(`${API_URL}/api/stats`);
}

// 2. Search Store Catalog
export async function searchProducts(query, signal) {
  if (!query) return [];
  return fetchWithSlowWarning(`${API_URL}/api/search?q=${encodeURIComponent(query)}`, { signal });
}

// 3. Track Product
export async function trackProduct(name, url, imageUrl, brand, sku, category, description, specs) {
  return fetchWithSlowWarning(`${API_URL}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, image_url: imageUrl, brand, sku, category, description, specs })
  });
}

// 4. Get All Tracked Products
export async function getProducts() {
  return fetchWithSlowWarning(`${API_URL}/api/products`);
}

// 5. Get Single Product Details
export async function getProductDetail(id) {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}`);
}

// 6. Get Product Price History (Good Reads Only, Oldest First)
export async function getProductHistory(id, range = 'all') {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}/history?range=${range}`);
}

// 7. Get Product Telemetry Logs (Newest First)
export async function getProductLogs(id, limit = 50, status = '') {
  const query = `limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ''}`;
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}/logs?${query}`);
}

// 8. Manual Scrape / Retrack Single Product (Rate-limited to 1 per 30s)
export async function retrackProduct(id) {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}/scrape`, {
    method: 'POST'
  });
}

// 9. Update Product Scrape Interval
export async function updateScrapeInterval(id, intervalMinutes) {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scrape_interval_minutes: Number(intervalMinutes) })
  });
}

// 10. Untrack Single Product
export async function untrackProduct(id) {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}`, {
    method: 'DELETE'
  });
}

// 11. Untrack All Products
export async function untrackAllProducts() {
  return fetchWithSlowWarning(`${API_URL}/api/products`, {
    method: 'DELETE'
  });
}

// 12. Retrack All Products
export async function retrackAllProducts() {
  return fetchWithSlowWarning(`${API_URL}/api/products/scrape-all`, {
    method: 'POST'
  });
}

