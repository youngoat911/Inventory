import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { alertsApi, assetsApi, dashboardApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { budgetTypeLabel } from '../constants'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icon'
import { SkeletonStat, SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useStatusMaster } from '../hooks/useStatusMaster'

const num = (v) => Number(v ?? 0)
const inr = (v) =>
  `₹${num(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ icon, label, value, hint, tone, to }) {
  return (
    <Link to={to} className={`stat stat-link${tone ? ` ${tone}` : ''}`}>
      <div className="stat-top">
        <span className="label">{label}</span>
        <span className="stat-icon"><Icon name={icon} size={18} /></span>
      </div>
      <div className="value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </Link>
  )
}

function Breakdown({ rows, total, colorFor, labelFor, valueFor }) {
  if (!rows.length) return <div className="muted" style={{ padding: '1rem 1.15rem' }}>No items yet.</div>
  return (
    <ul className="breakdown">
      {rows.map((row) => {
        const pct = total ? Math.round((row.count / total) * 100) : 0
        return (
          <li key={labelFor(row)}>
            <div className="breakdown-row">
              <span>{labelFor(row)}</span>
              <span className="muted">
                {row.count}{valueFor && valueFor(row) ? ` · ${valueFor(row)}` : ''}
              </span>
            </div>
            <div className="breakdown-track" aria-hidden="true">
              <div className={`breakdown-fill tone-${colorFor(row)}`} style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function Dashboard() {
  usePageTitle('Dashboard')
  const toast = useToast()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const { statusMeta } = useStatusMaster()

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

  const total = num(summary?.total_assets)
  const lowStock = num(summary?.low_stock_count)
  const inMaintenance = num(summary?.open_maintenance)
  const firstName = (user?.full_name || '').split(' ')[0]

  const stats = [
    {
      icon: 'package', label: 'Total items', value: total, to: '/assets',
      hint: summary?.total_value > 0 ? `${inr(summary.total_value)} recorded value` : 'All registered items',
    },
    {
      icon: 'users', label: 'Issued out', value: num(summary?.issued_items), to: '/assets',
      hint: total ? `${Math.round((num(summary?.issued_items) / total) * 100)}% of items` : null,
    },
    {
      icon: 'check-circle', label: 'Can be loaned', value: num(summary?.loanable_count), to: '/assets',
      hint: 'Marked as loanable',
    },
    {
      icon: 'alert-triangle', label: 'Low stock', value: lowStock, to: '/alerts',
      tone: lowStock > 0 ? 'danger' : null, hint: lowStock > 0 ? 'Needs restocking' : 'All stocked',
    },
    {
      icon: 'wrench', label: 'In maintenance', value: inMaintenance, to: '/maintenance',
      tone: inMaintenance > 0 ? 'warn' : null, hint: inMaintenance > 0 ? 'Currently being serviced' : 'Nothing in service',
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{firstName ? `${greeting()}, ${firstName}` : 'Dashboard'}</h1>
          <p>Here&apos;s how your inventory looks right now.</p>
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-ghost icon-btn"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <Icon name="refresh-cw" size={16} className={loading ? 'spin' : ''} />
          </button>
          {isAdmin ? (
            <Link to="/assets" className="btn btn-primary">
              <Icon name="plus" size={16} /> Add or import items
            </Link>
          ) : (
            <Link to="/assets" className="btn btn-primary">Browse assets</Link>
          )}
        </div>
      </div>

      <div className="stats">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonStat key={i} />)
          : stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <div className="panel">
          <div className="panel-header">
            <h2>Items by status</h2>
            <Link to="/catalog?tab=statuses" className="muted">Manage</Link>
          </div>
          {loading ? <SkeletonTable rows={3} cols={2} /> : (
            <Breakdown
              rows={summary?.by_status ?? []}
              total={total}
              labelFor={(r) => r.label}
              colorFor={(r) => r.color}
            />
          )}
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Items by budget</h2>
            <Link to="/purchases" className="muted">Purchases</Link>
          </div>
          {loading ? <SkeletonTable rows={3} cols={2} /> : (
            <Breakdown
              rows={summary?.by_budget ?? []}
              total={total}
              labelFor={(r) => (r.budget_type === 'unspecified' ? 'Not specified' : budgetTypeLabel(r.budget_type))}
              colorFor={(r) => (r.budget_type === 'unspecified' ? 'neutral' : 'info')}
              valueFor={(r) => (r.value > 0 ? inr(r.value) : null)}
            />
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>Recently updated</h2>
            <Link to="/assets" className="muted">View all</Link>
          </div>
          {loading ? (
            <SkeletonTable rows={4} cols={3} />
          ) : recent?.length === 0 ? (
            <EmptyState
              icon="box"
              title="No items yet"
              description="Add items one by one or import a CSV from the Assets page."
              action={isAdmin ? { label: 'Go to Assets', onClick: () => navigate('/assets') } : undefined}
            />
          ) : (
            <ul className="recent-list">
              {recent.map((item) => (
                <li key={item.id}>
                  <div className="recent-main">
                    <div className="recent-name">{item.name}</div>
                    <div className="muted recent-meta">
                      {[item.asset_tag, item.location_name, item.issued_to || item.incharge_name]
                        .filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <StatusBadge value={item.status} meta={statusMeta(item.status)} />
                </li>
              ))}
            </ul>
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
            <EmptyState icon="check-circle" title="All clear" description="No open alerts right now." />
          ) : (
            <ul className="recent-list">
              {alerts.map((item) => (
                <li key={item.id}>
                  <div className="recent-main">
                    <div className="recent-name">{item.title}</div>
                    <div className="muted recent-meta">{item.type?.replace(/_/g, ' ')}</div>
                  </div>
                  <StatusBadge value={item.severity} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
