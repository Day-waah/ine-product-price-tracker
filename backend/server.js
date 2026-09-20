require('dotenv').config();
const express = require('express');
const cors = require('cors');

const productsRoutes = require('./routes/products.routes');
const trackingRoutes = require('./routes/tracking.routes');
const scrapeRoutes = require('./routes/scrape.routes');
const historyRoutes = require('./routes/history.routes');
const logsRoutes = require('./routes/logs.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/products', productsRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/scrape', scrapeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/logs', logsRoutes);

// 404 for anything unmatched
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Central error handler - catches anything thrown/passed to next() that
// individual routes didn't already handle themselves.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});