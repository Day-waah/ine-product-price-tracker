function formatTimestamp(value) {
  return new Date(value).toLocaleString();
}

export default function ScrapeLogs({ logs }) {
  return (
    <div className="table-card">
      <h3>Scrape Logs</h3>
      {logs.length === 0 ? (
        <p className="status-text">No scrape logs yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatTimestamp(log.started_at)}</td>
                <td className={log.status === 'success' ? 'status-success' : 'status-failed'}>
                  {log.status.toUpperCase()}
                </td>
                <td>{log.attempts ?? '-'}</td>
                <td>{log.price != null ? `₹${log.price}` : '-'}</td>
                <td>{log.stock != null ? log.stock : '-'}</td>
                <td>{log.error_message || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}