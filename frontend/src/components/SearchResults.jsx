export default function SearchResults({ results, loading, error, trackedProductIds, onTrack }) {
  if (loading) return <p className="status-text">Searching...</p>;
  if (error) return <p className="status-text error-text">{error}</p>;
  if (results.length === 0) return <p className="status-text">No products found.</p>;

  return (
    <div className="card-grid">
      {results.map((product) => {
        const isTracked = trackedProductIds.has(String(product.id));
        return (
          <div className="card" key={product.id}>
            <h3>{product.name}</h3>
            <p className="muted">{product.brand} · {product.category}</p>
            <p className="muted">SKU: {product.sku}</p>
            {isTracked ? (
              <button disabled>Already tracked</button>
            ) : (
              <button onClick={() => onTrack(product)}>Track</button>
            )}
          </div>
        );
      })}
    </div>
  );
}