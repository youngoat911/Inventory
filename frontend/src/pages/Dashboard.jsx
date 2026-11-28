import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { alertsApi, assetsApi, dashboardApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import NotificationIcon from '../components/NotificationIcon'
import { SkeletonStat, SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

export default function Dashboard() {
  usePageTitle('Dashboard')
  const toast = useToast()

  const [summary, setSummary] = useState(null)
  const [recent, setRecent] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useAutoRefresh(['assets', 'alerts', 'transfers', 'maintenance', 'disposals'], () => {
    setReloadKey((k) => k + 1)
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      dashboardApi.summary().catch((e) => { toast.error(`Dashboard: ${e.message}`); return null }),
      assetsApi.list({ sort: '-updated_at', limit: 6 }).catch(() => ({ data: [] })),
      alertsApi.list({ status: 'open', limit: 6 }).catch(() => ({ data: [] })),
    ]).then(([sum, rec, al]) => {
      if (cancelled) return
      setSummary(sum?.data ?? null)
      setRecent(rec?.data ?? [])
      setAlerts(al?.data ?? [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = [
    { label: 'Total assets',    value: summary?.total_assets ?? '—',     color: '' },
    { label: 'Issued items',    value: summary?.issued_items ?? '—',     color: '' },
    { label: 'Can be loaned',   value: summary?.loanable_count ?? '—',   color: '' },
    { label: 'Low stock',       value: summary?.low_stock_count ?? '—',  color: 'danger' },
    { label: 'In maintenance',  value: summary?.open_maintenance ?? '—', color: '' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Snapshot of inventory health.</p>
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link to="/assets" className="btn btn-primary">Browse assets</Link>
          <span className="dashboard-notification">
            <NotificationIcon />
          </span>
        </div>
      </div>

      <div className="stats">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonStat key={i} />)
          : stats.map((s) => (
              <div key={s.label} className={`stat ${s.color}`}>
                <div className="label">{s.label}</div>
                <div className="value">{s.value}</div>
              </div>
            ))
        }
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>Recently updated items</h2>
            <Link to="/assets" className="muted">View all</Link>
          </div>
          {loading ? (
            <SkeletonTable rows={4} cols={3} />
          ) : recent?.length === 0 ? (
            <EmptyState icon="box" title="No items yet" />
          ) : (
            <div className="table-wrap">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Issued to / in-charge</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Item" data-card-title>
                        <div>{item.name}</div>
                        <div className="muted">{item.asset_tag || item.location_name || ''}</div>
                      </td>
                      <td className="muted" data-label="Issued to">
                        {item.issued_to || item.incharge_name || '—'}
                      </td>
                      <td data-label="Status"><StatusBadge value={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Open alerts</h2>
            <Link to="/alerts" className="muted">View all</Link>
          </div>
          {loading ? (
            <SkeletonTable rows={4} cols={2} />
          ) : alerts?.length === 0 ? (
            <EmptyState icon="check-circle" title="No open alerts" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Alert</th>
                    <th scope="col">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div>{item.title}</div>
                        <div className="muted">{item.type?.replace(/_/g, ' ')}</div>
                      </td>
                      <td><StatusBadge value={item.severity} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
