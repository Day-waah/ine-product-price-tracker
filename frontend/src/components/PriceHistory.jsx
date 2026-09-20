function formatTimestamp(value) {
  return new Date(value).toLocaleString();
}

function formatShortTime(value) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PriceChart({ history }) {
  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 32, left: 56 };

  const prices = history.map((row) => row.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  // Avoid a flat zero-height line when all prices happen to be identical.
  const priceRange = maxPrice - minPrice || 1;

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = history.map((row, index) => {
    const x = padding.left + (history.length === 1 ? plotWidth / 2 : (index / (history.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - ((row.price - minPrice) / priceRange) * plotHeight;
    return { x, y, row };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Show at most 5 x-axis labels so it stays readable regardless of how
  // many history points exist.
  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="price-chart-svg"
      role="img"
      aria-label="Price history line chart"
    >
      {/* Y-axis gridlines and labels (min, mid, max) */}
      {[0, 0.5, 1].map((fraction) => {
        const y = padding.top + plotHeight * (1 - fraction);
        const value = Math.round(minPrice + priceRange * fraction);
        return (
          <g key={fraction}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              className="chart-gridline"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
              ₹{value}
            </text>
          </g>
        );
      })}

      {/* Line path */}
      <path d={linePath} className="chart-line" fill="none" />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" className="chart-point">
          <title>{`${formatTimestamp(p.row.scraped_at)} — ₹${p.row.price}`}</title>
        </circle>
      ))}

      {/* X-axis labels */}
      {xLabels.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={height - padding.bottom + 20}
          textAnchor="middle"
          className="chart-axis-label"
        >
          {formatShortTime(p.row.scraped_at)}
        </text>
      ))}
    </svg>
  );
}

export default function PriceHistory({ history }) {
  const hasEnoughData = history.length >= 2;

  return (
    <div className="table-card">
      <h3>Price History</h3>

      {history.length === 0 ? (
        <p className="status-text">No history yet.</p>
      ) : hasEnoughData ? (
        <div className="chart-wrapper">
          <PriceChart history={history} />
        </div>
      ) : (
        <p className="status-text">Not enough historical data yet.</p>
      )}

      {history.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Price</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{formatTimestamp(row.scraped_at)}</td>
                <td>₹{row.price}</td>
                <td>{row.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}