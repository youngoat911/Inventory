import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { alertsApi, dashboardApi, issuesApi } from '../api/client'
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
  const [overdue, setOverdue] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useAutoRefresh(['assets', 'issues', 'alerts', 'transfers', 'maintenance', 'disposals'], () => {
    setReloadKey((k) => k + 1)
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      dashboardApi.summary().catch((e) => { toast.error(`Dashboard: ${e.message}`); return null }),
      issuesApi.list({ status: 'overdue', limit: 6 }).catch(() => ({ data: [] })),
      alertsApi.list({ status: 'open', limit: 6 }).catch(() => ({ data: [] })),
    ]).then(([sum, ov, al]) => {
      if (cancelled) return
      setSummary(sum?.data ?? null)
      setOverdue(ov?.data ?? [])
      setAlerts(al?.data ?? [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = [
    { label: 'Total assets',    value: summary?.total_assets ?? '—',     color: '' },
    { label: 'Active loans',    value: summary?.active_issues ?? '—',    color: '' },
    { label: 'Overdue',         value: summary?.overdue_count ?? '—',    color: 'warn' },
    { label: 'Low stock',       value: summary?.low_stock_count ?? '—',  color: 'danger' },
    { label: 'In maintenance',  value: summary?.open_maintenance ?? '—', color: '' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Snapshot of inventory health and open loans.</p>
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
            <h2>Overdue loans</h2>
            <Link to="/issues?status=overdue" className="muted">View all</Link>
          </div>
          {loading ? (
            <SkeletonTable rows={4} cols={3} />
          ) : overdue?.length === 0 ? (
            <EmptyState icon="check-circle" title="No overdue loans" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Asset</th>
                    <th scope="col">Due</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((item) => (
                    <tr key={item.id} className={item.status === 'overdue' ? 'row-overdue' : ''}>
                      <td>{item.asset_name || item.asset_id?.slice(0, 8)}</td>
                      <td className="muted">
                        {item.due_at ? new Date(item.due_at).toLocaleDateString() : '—'}
                      </td>
                      <td><StatusBadge value={item.status} /></td>
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
