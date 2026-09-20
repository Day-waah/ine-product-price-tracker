const express = require('express');
const supabase = require('../supabase');

const router = express.Router();

function validateTrackingBody(body) {
  const errors = [];
  if (body.productId === undefined || body.productId === null || body.productId === '') {
    errors.push('productId is required');
  }
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('name is required');
  }
  if (!body.url || typeof body.url !== 'string' || body.url.trim().length === 0) {
    errors.push('url is required');
  }
  return errors;
}

// POST /api/tracking
router.post('/', async (req, res) => {
  const body = req.body || {};
  const errors = validateTrackingBody(body);

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid tracking request.', details: errors });
  }

  const record = {
    product_id: String(body.productId),
    name: body.name.trim(),
    url: body.url.trim(),
    sku: body.sku || null,
    brand: body.brand || null,
    category: body.category || null,
  };

  const { data, error } = await supabase
    .from('tracked_products')
    .insert(record)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // unique_violation on product_id
      return res.status(409).json({ error: 'This product is already being tracked.' });
    }
    console.error('Tracking insert failed:', error.message);
    return res.status(500).json({ error: 'Failed to save tracked product.', details: error.message });
  }

  return res.status(201).json({ result: data });
});

// GET /api/tracking
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('tracked_products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetching tracked products failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch tracked products.', details: error.message });
  }

  return res.status(200).json({ results: data });
});

// GET /api/tracking/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Fetching tracked product failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch tracked product.', details: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Tracked product not found.' });
  }

  return res.status(200).json({ result: data });
});

module.exports = router;