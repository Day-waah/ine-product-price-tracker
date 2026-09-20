function formatTimestamp(value) {
  return new Date(value).toLocaleString();
}

export default function PriceHistory({ history }) {
  return (
    <div className="table-card">
      <h3>Price History</h3>
      {history.length === 0 ? (
        <p className="status-text">No history yet.</p>
      ) : (
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