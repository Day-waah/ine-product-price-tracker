const express = require('express');
const { chromium } = require('playwright');
const supabase = require('../supabase');
const { scrapeProduct } = require('../scraper.service');

const router = express.Router();

// ============================================================
// Scheduled / batch scrape helpers
// ============================================================

function checkCronSecret(req, res) {
  const provided = req.header('X-Cron-Secret');
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error(
      'CRON_SECRET is not set in environment - refusing all scrape-all requests.'
    );

    res.status(500).json({
      error: 'Server misconfiguration: CRON_SECRET is not set.',
    });

    return false;
  }

  if (!provided || provided !== expected) {
    res.status(401).json({
      error: 'Unauthorized: missing or invalid X-Cron-Secret header.',
    });

    return false;
  }

  return true;
}

async function scrapeOneTrackedProduct(browser, trackedProduct) {
  const startedAt = new Date().toISOString();

  const product = {
    id: trackedProduct.product_id,
    name: trackedProduct.name,
    url: trackedProduct.url,
  };

  try {
    console.log(
      `[scrape-all] Scraping tracked product ${trackedProduct.id} (${trackedProduct.name})...`
    );

    const result = await scrapeProduct(browser, product);

    if (
      !Number.isFinite(result.price) ||
      result.price <= 0 ||
      !Number.isFinite(result.stock) ||
      result.stock < 0
    ) {
      throw new Error(
        `Scraper returned invalid values: price=${result.price}, stock=${result.stock}`
      );
    }

    const { error: historyError } = await supabase
      .from('price_history')
      .insert({
        tracked_product_id: trackedProduct.id,
        price: result.price,
        stock: result.stock,
      });

    if (historyError) {
      throw new Error(
        `Scrape succeeded but saving history failed: ${historyError.message}`
      );
    }

    await supabase.from('scrape_logs').insert({
      tracked_product_id: trackedProduct.id,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: 'success',
      attempts: null,
      price: result.price,
      stock: result.stock,
      error_message: null,
    });

    console.log(
      `[scrape-all] SUCCESS - ${trackedProduct.name}: ₹${result.price}, stock ${result.stock}`
    );

    return {
      trackedProductId: trackedProduct.id,
      productId: result.productId,
      name: result.name,
      status: 'success',
      price: result.price,
      stock: result.stock,
      error: null,
    };
  } catch (err) {
    console.error(
      `[scrape-all] FAILED - ${trackedProduct.name}: ${err.message}`
    );

    await supabase.from('scrape_logs').insert({
      tracked_product_id: trackedProduct.id,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: 'failed',
      attempts: null,
      price: null,
      stock: null,
      error_message: err.message,
    });

    return {
      trackedProductId: trackedProduct.id,
      productId: trackedProduct.product_id,
      name: trackedProduct.name,
      status: 'failed',
      price: null,
      stock: null,
      error: err.message,
    };
  }
}

// ============================================================
// Scheduled / batch scrape route
// IMPORTANT: This must come BEFORE /:trackedProductId
// ============================================================

// POST /api/scrape/scrape-all
router.post('/scrape-all', async (req, res) => {
  if (!checkCronSecret(req, res)) {
    return;
  }

  console.log('[scrape-all] Batch scrape started.');

  const { data: activeProducts, error: fetchError } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('is_active', true);

  if (fetchError) {
    console.error(
      '[scrape-all] Failed to load active tracked products:',
      fetchError.message
    );

    return res.status(500).json({
      error: 'Failed to load tracked products.',
      details: fetchError.message,
    });
  }

  if (!activeProducts || activeProducts.length === 0) {
    console.log(
      '[scrape-all] No active tracked products found. Nothing to do.'
    );

    return res.status(200).json({
      success: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    });
  }

  let browser = null;
  const results = [];

  try {
    browser = await chromium.launch({
      headless: true,
    });

    // Sequential scraping keeps the process predictable
    // and avoids hitting the mock store with many browsers at once.
    for (const trackedProduct of activeProducts) {
      const result = await scrapeOneTrackedProduct(
        browser,
        trackedProduct
      );

      results.push(result);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  const succeeded = results.filter(
    (result) => result.status === 'success'
  ).length;

  const failed = results.filter(
    (result) => result.status === 'failed'
  ).length;

  console.log(
    `[scrape-all] Batch scrape finished. Processed: ${results.length}, Succeeded: ${succeeded}, Failed: ${failed}.`
  );

  return res.status(200).json({
    success: true,
    processed: results.length,
    succeeded,
    failed,
    results,
  });
});

// ============================================================
// Existing manual scrape route
// ============================================================

// POST /api/scrape/:trackedProductId
router.post('/:trackedProductId', async (req, res) => {
  const { trackedProductId } = req.params;

  const { data: trackedProduct, error: fetchError } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', trackedProductId)
    .maybeSingle();

  if (fetchError) {
    console.error(
      'Fetching tracked product for scrape failed:',
      fetchError.message
    );

    return res.status(500).json({
      error: 'Failed to load tracked product.',
      details: fetchError.message,
    });
  }

  if (!trackedProduct) {
    return res.status(404).json({
      error: 'Tracked product not found.',
    });
  }

  const startedAt = new Date().toISOString();
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const product = {
      id: trackedProduct.product_id,
      name: trackedProduct.name,
      url: trackedProduct.url,
    };

    const result = await scrapeProduct(browser, product);

    if (
      !Number.isFinite(result.price) ||
      result.price <= 0 ||
      !Number.isFinite(result.stock) ||
      result.stock < 0
    ) {
      throw new Error(
        `Scraper returned invalid values: price=${result.price}, stock=${result.stock}`
      );
    }

    const { error: historyError } = await supabase
      .from('price_history')
      .insert({
        tracked_product_id: trackedProduct.id,
        price: result.price,
        stock: result.stock,
      });

    if (historyError) {
      throw new Error(
        `Scrape succeeded but saving history failed: ${historyError.message}`
      );
    }

    await supabase.from('scrape_logs').insert({
      tracked_product_id: trackedProduct.id,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: 'success',
      attempts: null,
      price: result.price,
      stock: result.stock,
      error_message: null,
    });

    return res.status(200).json({
      result: {
        trackedProductId: trackedProduct.id,
        productId: result.productId,
        name: result.name,
        price: result.price,
        stock: result.stock,
      },
    });
  } catch (err) {
    console.error(
      `Scrape failed for tracked product ${trackedProductId}:`,
      err.message
    );

    await supabase.from('scrape_logs').insert({
      tracked_product_id: trackedProduct.id,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: 'failed',
      attempts: null,
      price: null,
      stock: null,
      error_message: err.message,
    });

    return res.status(500).json({
      error: 'Scrape failed.',
      details: err.message,
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

module.exports = router;