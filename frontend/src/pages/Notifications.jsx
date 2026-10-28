import { useCallback, useEffect, useState } from 'react'
import { api, qs } from '../api/client'
import EmptyState from '../components/EmptyState'
import { SkeletonTable } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

export default function Notifications() {
  usePageTitle('Notifications')
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('') // '' | 'unread'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api(`/notifications${qs({ is_read: filter === 'unread' ? false : undefined, limit: 50 })}`)
      setItems(res.data || [])
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  useAutoRefresh(['notifications'], () => {
    load()
  })

  async function markRead(id) {
    try {
      await api(`/notifications/${id}/read`, { method: 'POST', body: {} })
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function markAllRead() {
    try {
      await api('/notifications/read-all', { method: 'POST', body: {} })
      toast.success('All notifications marked as read')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const unreadCount = items.filter((n) => !n.is_read).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>{unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}</p>
        </div>
        <div className="row-actions">
          {unreadCount > 0 && (
            <button type="button" className="btn btn-ghost" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        {[['', 'All'], ['unread', 'Unread']].map(([val, label]) => (
          <button key={val} type="button" className={`tab ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={3} />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title="No notifications" description={filter === 'unread' ? 'You have no unread notifications.' : 'No notifications yet.'} />
      ) : (
        <div className="notification-list">
          {items.map((n) => (
            <div key={n.id} className={`notification-item${n.is_read ? '' : ' unread'}`}>
              <div className="notification-body">
                <strong>{n.title ?? n.type?.replace(/_/g, ' ')}</strong>
                {n.message && <p>{n.message}</p>}
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </span>
              </div>
              {!n.is_read && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

