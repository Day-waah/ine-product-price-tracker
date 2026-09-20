const express = require('express');
const { searchProducts } = require('../product.service');

const router = express.Router();

// GET /api/products/search?q=bulb
router.get('/search', async (req, res) => {
  const q = req.query.q;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Query parameter "q" is required and cannot be empty.' });
  }

  try {
    const results = await searchProducts(q);
    return res.status(200).json({ results });
  } catch (err) {
    console.error('Product search failed:', err.message);
    return res.status(500).json({ error: 'Product search failed.', details: err.message });
  }
});

module.exports = router;