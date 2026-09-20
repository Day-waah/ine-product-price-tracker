export default function TrackedProducts({ trackedProducts, loading, selectedId, onSelect }) {
  if (loading) return <p className="status-text">Loading tracked products...</p>;
  if (trackedProducts.length === 0) return <p className="status-text">No tracked products yet.</p>;

  return (
    <div className="card-grid">
      {trackedProducts.map((product) => (
        <div
          className={`card ${selectedId === product.id ? 'card-selected' : ''}`}
          key={product.id}
        >
          <h3>{product.name}</h3>
          <p className="muted">SKU: {product.sku}</p>
          <p className="muted">{product.is_active ? 'Active' : 'Inactive'}</p>
          <button onClick={() => onSelect(product)}>View</button>
        </div>
      ))}
    </div>
  );
}