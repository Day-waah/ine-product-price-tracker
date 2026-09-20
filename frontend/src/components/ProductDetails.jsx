export default function ProductDetails({ product, currentPrice, currentStock, onScrapeNow, scrapeLoading, loading }) {
  return (
    <div className="detail-card">
      <h2>{product.name}</h2>

      {loading ? (
        <p className="status-text">Loading details...</p>
      ) : (
        <div className="detail-stats">
          <div>
            <p className="muted">Current Price</p>
            <p className="stat-value">{currentPrice != null ? `₹${currentPrice}` : 'No data yet'}</p>
          </div>
          <div>
            <p className="muted">Current Stock</p>
            <p className="stat-value">{currentStock != null ? currentStock : 'No data yet'}</p>
          </div>
        </div>
      )}

      <button onClick={onScrapeNow} disabled={scrapeLoading}>
        {scrapeLoading ? 'Scraping...' : 'Scrape Now'}
      </button>
    </div>
  );
}