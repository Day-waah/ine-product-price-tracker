const express = require('express');
const { chromium } = require('playwright');
const supabase = require('../supabase');
const { scrapeProduct } = require('../scraper.service');

const router = express.Router();

// POST /api/scrape/:trackedProductId
router.post('/:trackedProductId', async (req, res) => {
  const { trackedProductId } = req.params;

  const { data: trackedProduct, error: fetchError } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', trackedProductId)
    .maybeSingle();

  if (fetchError) {
    console.error('Fetching tracked product for scrape failed:', fetchError.message);
    return res.status(500).json({ error: 'Failed to load tracked product.', details: fetchError.message });
  }

  if (!trackedProduct) {
    return res.status(404).json({ error: 'Tracked product not found.' });
  }

  const startedAt = new Date().toISOString();
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });

    const product = {
      id: trackedProduct.product_id,
      name: trackedProduct.name,
      url: trackedProduct.url,
    };

    // scrapeProduct already retries internally and throws a meaningful
    // error after exhausting its attempts - we don't add another retry
    // layer here, we just react to success or final failure.
    const result = await scrapeProduct(browser, product);

    if (!Number.isFinite(result.price) || result.price <= 0 || !Number.isFinite(result.stock) || result.stock < 0) {
      throw new Error(`Scraper returned invalid values: price=${result.price}, stock=${result.stock}`);
    }

    const { error: historyError } = await supabase.from('price_history').insert({
      tracked_product_id: trackedProduct.id,
      price: result.price,
      stock: result.stock,
    });

    if (historyError) {
      throw new Error(`Scrape succeeded but saving history failed: ${historyError.message}`);
    }

    await supabase.from('scrape_logs').insert({
      tracked_product_id: trackedProduct.id,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: 'success',
      attempts: null, // scraper.service does not currently expose attempt count externally
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
    console.error(`Scrape failed for tracked product ${trackedProductId}:`, err.message);

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

    return res.status(500).json({ error: 'Scrape failed.', details: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

module.exports = router;