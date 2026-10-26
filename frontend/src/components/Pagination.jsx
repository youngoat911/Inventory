import Icon from './Icon'

export default function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.pages <= 1) return null

  const { page, pages, total } = pagination

  return (
    <div className="pagination" role="navigation" aria-label="Pagination">
      <span className="muted" aria-live="polite" aria-atomic="true">
        Page {page} of {pages} · {total} total
      </span>
      <div className="pagination-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm icon-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          let p
          if (pages <= 7) p = i + 1
          else if (page <= 4) p = i + 1
          else if (page >= pages - 3) p = pages - 6 + i
          else p = page - 3 + i
          return (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onChange(p)}
              aria-label={`Page ${p}`}
              aria-current={page === p ? 'page' : undefined}
            >
              {p}
            </button>
          )
        })}
        <button
          type="button"
          className="btn btn-ghost btn-sm icon-btn"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </div>
  )
}
