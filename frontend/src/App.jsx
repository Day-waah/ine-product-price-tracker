import { useState, useEffect, useMemo } from 'react';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import TrackedOverview from './components/TrackedOverview';
import ProductDetails from './components/ProductDetails';
import PriceHistory from './components/PriceHistory';
import ScrapeLogs from './components/ScrapeLogs';
import {
  searchProducts,
  getTrackedProducts,
  trackProduct,
  scrapeProduct,
  getHistory,
  getLogs,
} from './api';
import './index.css';

export default function App() {
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [trackedProducts, setTrackedProducts] = useState([]);
  const [trackedLoading, setTrackedLoading] = useState(false);
  const [overviewMap, setOverviewMap] = useState({});

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);

  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTrackedProducts();
  }, []);

  async function loadTrackedProducts() {
    setTrackedLoading(true);
    try {
      const results = await getTrackedProducts();
      setTrackedProducts(results);
      loadOverviewData(results);
    } catch (err) {
      setError(`Backend unavailable: ${err.message}`);
    } finally {
      setTrackedLoading(false);
    }
  }

  async function loadOverviewData(products) {
    if (!products || products.length === 0) {
      setOverviewMap({});
      return;
    }

    const settled = await Promise.allSettled(
      products.map(async (product) => {
        const productHistory = await getHistory(product.id);
        const latest = productHistory.length > 0 ? productHistory[productHistory.length - 1] : null;
        return {
          id: product.id,
          price: latest ? latest.price : null,
          stock: latest ? latest.stock : null,
        };
      })
    );

    const map = {};
    settled.forEach((result, idx) => {
      const productId = products[idx].id;
      if (result.status === 'fulfilled') {
        map[result.value.id] = { price: result.value.price, stock: result.value.stock };
      } else {
        map[productId] = { price: null, stock: null };
      }
    });

    setOverviewMap(map);
  }

  const trackedProductIds = useMemo(
    () => new Set(trackedProducts.map((p) => String(p.product_id))),
    [trackedProducts]
  );

  async function handleSearch(query) {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const results = await searchProducts(query);
      setSearchResults(results);
    } catch (err) {
      setSearchError(err.message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleTrack(product) {
    setMessage(null);
    setError(null);
    try {
      await trackProduct({
        productId: product.id,
        name: product.name,
        url: product.url,
        sku: product.sku,
        brand: product.brand,
        category: product.category,
      });
      setMessage(`"${product.name}" is now being tracked.`);
      await loadTrackedProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSelectProduct(product) {
    setSelectedProduct(product);
    setMessage(null);
    setError(null);
    setDetailLoading(true);
    try {
      const [historyData, logsData] = await Promise.all([
        getHistory(product.id),
        getLogs(product.id),
      ]);
      setHistory(historyData);
      setLogs(logsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleScrapeNow() {
    if (!selectedProduct) return;
    setScrapeLoading(true);
    setMessage(null);
    setError(null);

    try {
      const result = await scrapeProduct(selectedProduct.id);
      setMessage(`Scraped successfully: ₹${result.price} · ${result.stock} in stock.`);
    } catch (err) {
      setError(`Scrape failed: ${err.message}`);
    }

    try {
      const [historyData, logsData] = await Promise.all([
        getHistory(selectedProduct.id),
        getLogs(selectedProduct.id),
      ]);
      setHistory(historyData);
      setLogs(logsData);
      loadOverviewData(trackedProducts);
    } catch (reloadErr) {
      console.error('Failed to reload history/logs after scrape:', reloadErr.message);
    }

    setScrapeLoading(false);
  }

  const latest = history.length > 0 ? history[history.length - 1] : null;
  const currentPrice = latest ? latest.price : null;
  const currentStock = latest ? latest.stock : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>INE Product Price Tracker</h1>
        <p className="subtitle">Track price and stock over time</p>
      </header>

      <main>
        {message && <div className="banner success">{message}</div>}
        {error && <div className="banner error">{error}</div>}

        <section className="panel">
          <h2>Search</h2>
          <SearchBar onSearch={handleSearch} loading={searchLoading} />
          <SearchResults
            results={searchResults}
            loading={searchLoading}
            error={searchError}
            trackedProductIds={trackedProductIds}
            onTrack={handleTrack}
          />
        </section>

        <section className="panel">
          <h2>Tracked Products</h2>
          {trackedLoading ? (
            <p className="status-text">Loading tracked products...</p>
          ) : (
            <TrackedOverview
              trackedProducts={trackedProducts}
              overviewMap={overviewMap}
              onSelect={handleSelectProduct}
            />
          )}
        </section>

        {selectedProduct && (
          <section>
            <ProductDetails
              product={selectedProduct}
              currentPrice={currentPrice}
              currentStock={currentStock}
              onScrapeNow={handleScrapeNow}
              scrapeLoading={scrapeLoading}
              loading={detailLoading}
            />
            <PriceHistory history={history} />
            <ScrapeLogs logs={logs} />
          </section>
        )}
      </main>
    </div>
  );
}