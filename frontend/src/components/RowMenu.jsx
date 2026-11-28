import { useEffect, useRef, useState } from 'react'

const MENU_WIDTH = 176

/**
 * Compact "More" menu for table rows. Uses fixed positioning so it is not
 * clipped by scrolling table wrappers or panels with overflow: hidden.
 * items: [{ label, onClick, danger? }]
 */
export default function RowMenu({ items, label = 'More' }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!pos) return undefined
    const close = () => {
      if (ref.current) ref.current.open = false
      setPos(null)
    }
    function onDown(e) {
      if (!ref.current?.contains(e.target)) close()
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        close()
        ref.current?.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [pos])

  function onToggle(e) {
    if (!e.currentTarget.open) {
      setPos(null)
      return
    }
    const rect = e.currentTarget.querySelector('summary').getBoundingClientRect()
    const menuHeight = items.length * 38 + 10
    const openUp = rect.bottom + menuHeight > window.innerHeight - 8
    setPos({
      top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    })
  }

  return (
    <details ref={ref} className="row-menu" onToggle={onToggle}>
      <summary className="btn btn-ghost btn-sm" aria-label={`${label} actions`} aria-haspopup="menu">
        {label} ▾
      </summary>
      {pos ? (
        <div
          className="row-menu-list"
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, right: 'auto', width: MENU_WIDTH }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'danger' : undefined}
              onClick={() => {
                if (ref.current) ref.current.open = false
                setPos(null)
                item.onClick()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </details>
  )
}
