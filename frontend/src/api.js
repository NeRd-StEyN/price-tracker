
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

let activeSlowTimeouts = new Set();
let activeRequestCount = 0;

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

export async function getStats() {
  return fetchWithSlowWarning(`${API_URL}/api/stats`);
}

export async function searchProducts(query, signal) {
  if (!query) return [];
  return fetchWithSlowWarning(`${API_URL}/api/search?q=${encodeURIComponent(query)}`, { signal });
}

export async function trackProduct(name, url, imageUrl, brand, sku, category, description, specs) {
  return fetchWithSlowWarning(`${API_URL}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url, image_url: imageUrl, brand, sku, category, description, specs })
  });
}

export async function getProducts() {
  return fetchWithSlowWarning(`${API_URL}/api/products`);
}

export async function getProductDetail(id) {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}`);
}

export async function getProductHistory(id, range = 'all') {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}/history?range=${range}`);
}

export async function getProductLogs(id, limit = 50, status = '') {
  const query = `limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ''}`;
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}/logs?${query}`);
}

export async function retrackProduct(id) {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}/scrape`, {
    method: 'POST'
  });
}

export async function updateScrapeInterval(id, intervalMinutes) {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scrape_interval_minutes: Number(intervalMinutes) })
  });
}

export async function untrackProduct(id) {
  return fetchWithSlowWarning(`${API_URL}/api/products/${id}`, {
    method: 'DELETE'
  });
}

export async function untrackAllProducts() {
  return fetchWithSlowWarning(`${API_URL}/api/products`, {
    method: 'DELETE'
  });
}

export async function retrackAllProducts() {
  return fetchWithSlowWarning(`${API_URL}/api/products/scrape-all`, {
    method: 'POST'
  });
}

