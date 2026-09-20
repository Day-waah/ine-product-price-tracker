const express = require('express');
const supabase = require('../supabase');

const router = express.Router();

// GET /api/logs/:trackedProductId
router.get('/:trackedProductId', async (req, res) => {
  const { trackedProductId } = req.params;

  const { data, error } = await supabase
    .from('scrape_logs')
    .select('*')
    .eq('tracked_product_id', trackedProductId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Fetching scrape logs failed:', error.message);
    return res.status(500).json({ error: 'Failed to fetch scrape logs.', details: error.message });
  }

  return res.status(200).json({ results: data });
});

module.exports = router;