export function SkeletonLine({ width = '100%', height = '1rem' }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: '4px' }}
      aria-hidden="true"
    />
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Loading…">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><SkeletonLine width="80%" height="0.75rem" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><SkeletonLine width={c === 0 ? '70%' : '50%'} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="stat" aria-busy="true" aria-label="Loading…">
      <div className="label"><SkeletonLine width="60%" height="0.75rem" /></div>
      <div className="value"><SkeletonLine width="40%" height="2rem" /></div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="panel" aria-busy="true" aria-label="Loading…" style={{ padding: '1.25rem' }}>
      <SkeletonLine width="40%" height="1rem" />
      <div style={{ marginTop: '0.75rem' }}>
        <SkeletonLine width="100%" />
        <SkeletonLine width="85%" />
        <SkeletonLine width="90%" />
      </div>
    </div>
  )
}
