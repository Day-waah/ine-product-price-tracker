const express = require('express');
const supabase = require('../supabase');

const router = express.Router();

// GET /api/history/:trackedProductId
router.get('/:trackedProductId', async (req, res) => {
  const { trackedProductId } = req.params;

  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('tracked_product_id', trackedProductId)
    .order('scraped_at', { ascending: true });

  if (error) {
    console.error('Fetching price history failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch price history.', details: error.message });
  }

  return res.status(200).json({ results: data });
});

module.exports = router;