import { useCallback, useEffect, useState } from 'react'
import { alertsApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Alerts() {
  usePageTitle('Alerts')
  const { isAdmin, isSuperAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    type: 'custom',
    severity: 'medium',
    title: '',
    message: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await alertsApi.list({
        page,
        limit: 20,
        status: status || undefined,
      })
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    load()
  }, [load])

  async function runAction(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await alertsApi.create({
        type: form.type,
        severity: form.severity,
        title: form.title.trim(),
        message: form.message.trim(),
      })
      setShowCreate(false)
      setForm({ type: 'custom', severity: 'medium', title: '', message: '' })
      setPage(1)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Alerts</h1>
          <p>Stock, overdue, and system notifications.</p>
        </div>
        {isAdmin ? (
          <div className="row-actions">
            {isSuperAdmin ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => runAction(() => alertsApi.autoResolve())}
                >
                  Auto-resolve
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => runAction(() => alertsApi.generate())}
                >
                  Generate alerts
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Create alert
            </button>
          </div>
        ) : null}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="tabs">
        {[
          ['open', 'Open'],
          ['acknowledged', 'Acknowledged'],
          ['resolved', 'Resolved'],
          ['dismissed', 'Dismissed'],
          ['', 'All'],
        ].map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            className={`tab ${status === value ? 'active' : ''}`}
            onClick={() => {
              setPage(1)
              setStatus(value)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="bell"
              title="No alerts in this view"
              description="System alerts and stock warnings will appear here."
            />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Type</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((alert) => (
                  <tr key={alert.id}>
                    <td data-label="Title" data-card-title>
                      <div>{alert.title}</div>
                      <div className="muted">{alert.message}</div>
                    </td>
                    <td className="muted" data-label="Type">{alert.type?.replace(/_/g, ' ')}</td>
                    <td data-label="Severity">
                      <StatusBadge value={alert.severity} />
                    </td>
                    <td data-label="Status">
                      <StatusBadge value={alert.status} />
                    </td>
                    <td data-actions>
                      <div className="row-actions">
                        {isAdmin && alert.status === 'open' ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => runAction(() => alertsApi.acknowledge(alert.id))}
                          >
                            Ack
                          </button>
                        ) : null}
                        {isAdmin && (alert.status === 'open' || alert.status === 'acknowledged') ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy}
                              onClick={() => runAction(() => alertsApi.resolve(alert.id))}
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => runAction(() => alertsApi.dismiss(alert.id))}
                            >
                              Dismiss
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {showCreate && isAdmin ? (
        <Modal
          title="Create alert"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-alert" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </button>
            </>
          }
        >
          <form id="create-alert" className="form" onSubmit={handleCreate}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="type">Type</label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="custom">Custom</option>
                  <option value="low_stock">Low stock</option>
                  <option value="overdue_loan">Overdue loan</option>
                  <option value="system">System</option>
                  <option value="maintenance_due">Maintenance due</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="severity">Severity</label>
                <select
                  id="severity"
                  value={form.severity}
                  onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                required
              />
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
