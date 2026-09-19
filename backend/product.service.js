const CATALOG_BASE_URL = 'https://demo.inelabteamdev.com/api/catalog';
const PAGE_SIZE = 20; // confirmed value the API returns per page
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes - avoids re-fetching all 50 pages on every search
const CONCURRENCY = 3; // lowered from 5 - concurrency of 5 was triggering 429s near the end of the run
const BATCH_GAP_MS = 300; // small pause between batches to further ease off the rate limiter
const PAGE_MAX_ATTEMPTS = 4;
const BASE_RETRY_DELAY_MS = 500;
const RATE_LIMIT_RETRY_DELAY_MS = 2000; // 429s need a much longer wait than a plain 503

let cachedCatalogMap = null; // Map<id, product> - accumulates across refreshes instead of being replaced
let cachedAt = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toProduct(item) {
  return {
    id: item.id,
    name: item.name,
    url: `https://demo.inelabteamdev.com/product/${item.id}`,
    sku: item.sku,
    brand: item.brand,
    category: item.category,
  };
}

async function fetchPage(page) {
  let lastError = null;

  for (let attempt = 1; attempt <= PAGE_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${CATALOG_BASE_URL}?page=${page}&pageSize=${PAGE_SIZE}`);

      if (res.status === 429) {
        const retryAfterHeader = res.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
        const waitMs = Number.isFinite(retryAfterMs) ? retryAfterMs : RATE_LIMIT_RETRY_DELAY_MS * attempt;
        lastError = new Error('HTTP 429 (rate limited)');
        console.warn(`Catalog page ${page} attempt ${attempt} rate-limited - waiting ${waitMs}ms before retry`);
        if (attempt < PAGE_MAX_ATTEMPTS) await delay(waitMs);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!Array.isArray(data.items)) {
        throw new Error('unexpected response shape: no items array');
      }
      return data;
    } catch (err) {
      lastError = err;
      console.warn(`Catalog page ${page} attempt ${attempt} failed: ${err.message}`);
      if (attempt < PAGE_MAX_ATTEMPTS) {
        await delay(BASE_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(`Catalog request failed for page ${page} after ${PAGE_MAX_ATTEMPTS} attempts: ${lastError.message}`);
}

async function fetchFullCatalog() {
  const first = await fetchPage(1);
  const totalPages = first.pages;
  if (!Number.isFinite(totalPages) || totalPages < 1) {
    throw new Error(`Catalog response did not include a valid "pages" count`);
  }

  const allItems = [...first.items];
  const failedPages = [];
  const remainingPages = [];
  for (let p = 2; p <= totalPages; p++) remainingPages.push(p);

  for (let i = 0; i < remainingPages.length; i += CONCURRENCY) {
    const batch = remainingPages.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(fetchPage));

    results.forEach((result, idx) => {
      const page = batch[idx];
      if (result.status === 'fulfilled') {
        allItems.push(...result.value.items);
      } else {
        console.warn(`Giving up on catalog page ${page}: ${result.reason.message}`);
        failedPages.push(page);
      }
    });

    if (i + CONCURRENCY < remainingPages.length) {
      await delay(BATCH_GAP_MS);
    }
  }

  if (failedPages.length > 0) {
    console.warn(`Catalog loaded with ${failedPages.length} page(s) missing (pages: ${failedPages.join(', ')}). Some products may not appear in search.`);
  }

  if (allItems.length === 0) {
    throw new Error('Catalog load failed completely - no pages returned data.');
  }

  // The store's underlying data can shift slightly while we're paginating
  // through 50 requests, so the same product can legitimately appear in more
  // than one page's response by the time we finish. Dedupe by id here rather
  // than trusting pagination to be perfectly stable.
  const uniqueById = new Map();
  for (const item of allItems) {
    uniqueById.set(item.id, item);
  }

  const dedupedCount = allItems.length - uniqueById.size;
  if (dedupedCount > 0) {
    console.warn(`Removed ${dedupedCount} duplicate catalog entries caused by pagination drift.`);
  }

  return [...uniqueById.values()].map(toProduct);
}

/**
 * Returns the full product catalog, using an in-memory cache to avoid
 * re-fetching all 50 pages on every call. New fetches are MERGED into the
 * existing cache rather than replacing it - a single crawl can miss items
 * due to pagination drift on this store, so accumulating across refreshes
 * gives more complete coverage over time than trusting any one crawl alone.
 */
async function getCatalog({ forceRefresh = false } = {}) {
  const isFresh = cachedCatalogMap && Date.now() - cachedAt < CACHE_TTL_MS;
  if (isFresh && !forceRefresh) {
    return [...cachedCatalogMap.values()];
  }

  try {
    const freshItems = await fetchFullCatalog();

    if (!cachedCatalogMap) {
      cachedCatalogMap = new Map();
    }
    for (const item of freshItems) {
      cachedCatalogMap.set(item.id, item); // add new, refresh existing
    }
    cachedAt = Date.now();

    return [...cachedCatalogMap.values()];
  } catch (err) {
    if (cachedCatalogMap && cachedCatalogMap.size > 0) {
      console.warn(`Catalog refresh failed (${err.message}) - serving existing cached catalog.`);
      return [...cachedCatalogMap.values()];
    }
    throw new Error(`Could not load product catalog: ${err.message}`);
  }
}

/**
 * Case-insensitive partial match on product name.
 * @param {string} query
 * @returns {Promise<Array<{id, name, url, sku, brand, category}>>}
 */
async function searchProducts(query) {
  if (typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }

  const catalog = await getCatalog();
  const needle = query.trim().toLowerCase();

  return catalog.filter((p) => p.name.toLowerCase().includes(needle));
}

module.exports = { searchProducts, getCatalog };