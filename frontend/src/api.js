const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function handleResponse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body - leave data as null
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data;
}

export async function searchProducts(query) {
  const res = await fetch(`${BASE_URL}/api/products/search?q=${encodeURIComponent(query)}`);
  const data = await handleResponse(res);
  return data.results;
}

export async function getTrackedProducts() {
  const res = await fetch(`${BASE_URL}/api/tracking`);
  const data = await handleResponse(res);
  return data.results;
}

export async function trackProduct(product) {
  const res = await fetch(`${BASE_URL}/api/tracking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  const data = await handleResponse(res);
  return data.result;
}

export async function scrapeProduct(trackedProductId) {
  const res = await fetch(`${BASE_URL}/api/scrape/${trackedProductId}`, {
    method: 'POST',
  });
  const data = await handleResponse(res);
  return data.result;
}

export async function getHistory(trackedProductId) {
  const res = await fetch(`${BASE_URL}/api/history/${trackedProductId}`);
  const data = await handleResponse(res);
  return data.results;
}

export async function getLogs(trackedProductId) {
  const res = await fetch(`${BASE_URL}/api/logs/${trackedProductId}`);
  const data = await handleResponse(res);
  return data.results;
}