// frontend/src/components/NotificationIcon.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import Icon from './Icon'

function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)

  if (diffSec < 45) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 172800) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getEntityIcon(entityType) {
  switch (entityType) {
    case 'assets':
    case 'asset':
      return 'box'
    case 'issues':
    case 'issue':
      return 'hand-helping'
    case 'transfers':
    case 'transfer':
      return 'arrow-left-right'
    case 'maintenance':
      return 'wrench'
    case 'disposals':
    case 'disposal':
      return 'archive'
    case 'alerts':
    case 'alert':
      return 'alert-triangle'
    case 'users':
    case 'user':
      return 'users'
    case 'verifications':
      return 'clipboard-check'
    default:
      return 'bell'
  }
}

export default function NotificationIcon() {
  const { notifications, unreadCount, connected, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return undefined

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function handleItemClick(notification) {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    setOpen(false)

    // Optional navigation to entity page
    if (notification.entity_type) {
      const targetPage = `/${notification.entity_type.replace(/_/g, '-')}`
      navigate(targetPage)
    } else {
      navigate('/notifications')
    }
  }

  const recentList = notifications.slice(0, 8)

  return (
    <div className="notification-icon-wrapper" ref={containerRef}>
      <button
        type="button"
        className={`btn btn-ghost btn-sm notification-trigger ${open ? 'active' : ''}`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
        title={connected ? 'Live notifications connected' : 'Connecting to live notifications...'}
      >
        <span className="notification-trigger-icon">
          <Icon name="bell" size={18} />
          {connected && <span className="live-status-dot" title="Live WebSocket connected" />}
          {unreadCount > 0 && (
            <span className="notification-badge" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="notification-popover" role="dialog" aria-label="Notifications panel">
          <div className="notification-popover-header">
            <div className="notification-popover-title">
              <strong>Notifications</strong>
              {connected ? (
                <span className="live-pill" title="Real-time WebSocket connected">
                  <span className="pulse-dot" /> Live
                </span>
              ) : (
                <span className="offline-pill" title="Reconnecting...">
                  Offline
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-xs mark-all-btn"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-popover-body">
            {recentList.length === 0 ? (
              <div className="notification-popover-empty">
                <Icon name="inbox" size={32} className="muted" />
                <p>No notifications yet</p>
                <span>You'll see real-time updates when team members make changes.</span>
              </div>
            ) : (
              <ul className="notification-popover-list">
                {recentList.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`notification-popover-item ${n.is_read ? 'read' : 'unread'}`}
                      onClick={() => handleItemClick(n)}
                    >
                      <div className="item-icon-wrap">
                        <Icon name={getEntityIcon(n.entity_type)} size={16} />
                      </div>
                      <div className="item-content">
                        <div className="item-header-row">
                          <strong className="item-title">{n.title || 'Notification'}</strong>
                          <span className="item-time">{formatRelativeTime(n.created_at)}</span>
                        </div>
                        {n.message && <p className="item-message">{n.message}</p>}
                      </div>
                      {!n.is_read && <span className="unread-dot" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="notification-popover-footer">
            <Link
              to="/notifications"
              className="view-all-link"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

