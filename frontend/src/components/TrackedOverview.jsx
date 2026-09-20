export default function TrackedOverview({ trackedProducts, overviewMap, onSelect }) {
  if (trackedProducts.length === 0) {
    return <p className="status-text">No tracked products yet.</p>;
  }

  return (
    <div className="overview-grid">
      {trackedProducts.map((product) => {
        const overview = overviewMap[product.id];
        const price = overview ? overview.price : null;
        const stock = overview ? overview.stock : null;

        return (
          <div className="overview-card" key={product.id}>
            <div className="overview-card-top">
              <h4>{product.name}</h4>
              <span className={`badge ${product.is_active ? 'badge-active' : 'badge-inactive'}`}>
                {product.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="overview-stats">
              <div>
                <p className="muted">Price</p>
                <p className="overview-value">{price != null ? `₹${price}` : '—'}</p>
              </div>
              <div>
                <p className="muted">Stock</p>
                <p className="overview-value">{stock != null ? stock : '—'}</p>
              </div>
            </div>
            <button onClick={() => onSelect(product)}>View</button>
          </div>
        );
      })}
    </div>
  );
}