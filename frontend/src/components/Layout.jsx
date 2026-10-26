import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Icon from './Icon'

const links = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/assets', label: 'Assets', icon: 'box' },
  { to: '/issues', label: 'Borrowing', icon: 'hand-helping' },
  { to: '/transfers', label: 'Transfers', icon: 'arrow-left-right' },
  { to: '/disposals', label: 'Disposals', icon: 'archive' },
  { to: '/maintenance', label: 'Maintenance', icon: 'wrench' },
  { to: '/alerts', label: 'Alerts', icon: 'bell' },
  { to: '/notifications', label: 'Notifications', icon: 'inbox' },
  { to: '/catalog', label: 'Catalog', icon: 'layout-grid' },
  { to: '/purchases', label: 'Purchases', icon: 'shopping-cart' },
  { to: '/vendors', label: 'Vendors', icon: 'truck', adminOnly: true },
  { to: '/users', label: 'Users', icon: 'users', adminOnly: true },
  { to: '/blocks', label: 'Blocks', icon: 'ban', adminOnly: true },
  { to: '/verifications', label: 'Verifications', icon: 'clipboard-check', adminOnly: true },
  { to: '/reports', label: 'Reports', icon: 'bar-chart-2', adminOnly: true },
  { to: '/audit-log', label: 'Audit Log', icon: 'scroll-text', auditAccessOnly: true },
]

export default function Layout() {
  const { user, logout, isAdmin, canViewAuditLog } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const [openPath, setOpenPath] = useState(null)
  const location = useLocation()
  const menuOpen = openPath === location.pathname
  const toggleRef = useRef(null)
  const closeRef = useRef(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (!menuOpen) return undefined
    const toggle = toggleRef.current
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function handleKeyDown(e) {
      if (e.key === 'Escape') { setOpenPath(null); return }
      if (e.key !== 'Tab') return
      const focusable = [...document.querySelectorAll(
        '.sidebar[aria-modal="true"] a[href], .sidebar[aria-modal="true"] button:not(:disabled)'
      )]
      const first = focusable[0], last = focusable.at(-1)
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKeyDown)
      if (wasOpen.current) toggle?.focus()
    }
  }, [menuOpen])

  useEffect(() => { wasOpen.current = menuOpen }, [menuOpen])

  const initials = (user?.full_name || user?.institute_email || 'U')
    .trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

  const visibleLinks = links.filter(
    (l) => (!l.adminOnly || isAdmin) && (!l.auditAccessOnly || canViewAuditLog)
  )

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <header className="mobile-topbar">
        <button
          ref={toggleRef}
          type="button"
          className="mobile-menu-toggle"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setOpenPath(location.pathname)}
        >
          <Icon name="menu" size={22} />
        </button>
        <strong>Gymkhana Inventory</strong>
        <span className="user-avatar" aria-label={user?.full_name || user?.institute_email || 'User'}>
          {initials}
        </span>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="Close navigation menu"
          tabIndex={-1}
          onClick={() => setOpenPath(null)}
        />
      )}

      <aside
        className={`sidebar${menuOpen ? ' menu-open' : ''}`}
        aria-modal={menuOpen ? 'true' : undefined}
        role={menuOpen ? 'dialog' : undefined}
        aria-label={menuOpen ? 'Navigation menu' : undefined}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            Gymkhana Inventory
            <span>BERM equipment desk</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="mobile-menu-toggle btn btn-ghost btn-sm"
            aria-label="Close navigation menu"
            onClick={() => setOpenPath(null)}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <nav className="nav" id="primary-navigation" aria-label="Primary navigation">
          {visibleLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setOpenPath(null)}>
              <Icon name={link.icon} size={18} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="user-avatar user-avatar-sm">{initials}</div>
            <div>
              <strong>{user?.full_name || 'User'}</strong>
              <span>{user?.institute_email || user?.email}</span>
            </div>
          </div>
          <div className="sidebar-user-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm icon-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={logout}
            >
              <Icon name="log-out" size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
