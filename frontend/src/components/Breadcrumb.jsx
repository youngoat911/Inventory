import { Link } from 'react-router-dom'

/**
 * @param {Array<{label: string, to?: string}>} items
 */
export default function Breadcrumb({ items = [] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol>
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} aria-current={isLast ? 'page' : undefined}>
              {isLast || !item.to ? (
                <span>{item.label}</span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
