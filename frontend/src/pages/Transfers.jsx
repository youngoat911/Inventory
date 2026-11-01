import { useCallback, useEffect, useState } from 'react'
import { assetsApi, locationsApi, orgUnitsApi, transfersApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Transfers() {
  usePageTitle('Transfers')
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [assets, setAssets] = useState([])
  const [orgs, setOrgs] = useState([])
  const [locations, setLocations] = useState([])
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [rejectModal, setRejectModal] = useState(null)
  const [cancelModal, setCancelModal] = useState(null)
  const [reason, setReason] = useState('')
  const [form, setForm] = useState({
    asset_id: '',
    quantity: 1,
    from_org_id: '',
    to_org_id: '',
    from_location_id: '',
    to_location_id: '',
    reason: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await transfersApi.list({ page, limit: 20, status: status || undefined })
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

  useEffect(() => {
    Promise.all([
      assetsApi.list({ limit: 100 }).catch(() => ({ data: [] })),
      orgUnitsApi.list({ limit: 100 }).catch(() => ({ data: [] })),
      locationsApi.list({ limit: 100 }).catch(() => ({ data: [] })),
    ]).then(([a, o, l]) => {
      setAssets(a.data || [])
      setOrgs(o.data || [])
      setLocations(l.data || [])
    })
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await transfersApi.create({
        asset_id: form.asset_id,
        quantity: Number(form.quantity),
        from_org_id: form.from_org_id || undefined,
        to_org_id: form.to_org_id || undefined,
        from_location_id: form.from_location_id || undefined,
        to_location_id: form.to_location_id || undefined,
        reason: form.reason.trim(),
      })
      setShowCreate(false)
      setForm({
        asset_id: '',
        quantity: 1,
        from_org_id: '',
        to_org_id: '',
        from_location_id: '',
        to_location_id: '',
        reason: '',
      })
      setPage(1)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function runAction(fn) {
    setError('')
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReject(e) {
    e.preventDefault()
    await runAction(() => transfersApi.reject(rejectModal, { rejection_reason: reason.trim() }))
    setRejectModal(null)
    setReason('')
  }

  async function handleCancel(e) {
    e.preventDefault()
    await runAction(() => transfersApi.cancel(cancelModal, { cancellation_reason: reason.trim() }))
    setCancelModal(null)
    setReason('')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Transfers</h1>
          <p>Move assets between orgs and locations.</p>
        </div>
        {isAdmin ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Request transfer
          </button>
        ) : null}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="tabs">
        {[
          ['', 'All'],
          ['requested', 'Requested'],
          ['approved', 'Approved'],
          ['rejected', 'Rejected'],
          ['completed', 'Completed'],
          ['cancelled', 'Cancelled'],
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
              icon="arrow-left-right"
              title="No transfers in this view"
              description="Request a transfer to move equipment between locations or organizations."
              action={{ label: 'New transfer', onClick: () => setShowCreate(true) }}
            />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Asset" data-card-title>
                      <div>{item.asset_name || item.asset_id?.slice(0, 8)}</div>
                      <div className="muted">{item.id.slice(0, 8)}</div>
                    </td>
                    <td data-label="Qty">{item.quantity}</td>
                    <td data-label="Status">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="muted" data-label="Reason">{item.reason || '—'}</td>
                    <td data-actions>
                      <div className="row-actions">
                        {isAdmin && item.status === 'requested' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => runAction(() => transfersApi.approve(item.id))}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setReason('')
                                setRejectModal(item.id)
                              }}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setReason('')
                                setCancelModal(item.id)
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}
                        {isAdmin && item.status === 'approved' ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => runAction(() => transfersApi.complete(item.id))}
                          >
                            Complete
                          </button>
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
          title="Request transfer"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-transfer" className="btn btn-primary" disabled={saving}>
                {saving ? 'Submitting…' : 'Submit'}
              </button>
            </>
          }
        >
          <form id="create-transfer" className="form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="asset_id">Asset</label>
              <select
                id="asset_id"
                value={form.asset_id}
                onChange={(e) => setForm((p) => ({ ...p, asset_id: e.target.value }))}
                required
              >
                <option value="">Select asset</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="from_org_id">From org</label>
                <select
                  id="from_org_id"
                  value={form.from_org_id}
                  onChange={(e) => setForm((p) => ({ ...p, from_org_id: e.target.value }))}
                >
                  <option value="">Optional</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="to_org_id">To org</label>
                <select
                  id="to_org_id"
                  value={form.to_org_id}
                  onChange={(e) => setForm((p) => ({ ...p, to_org_id: e.target.value }))}
                >
                  <option value="">Optional</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="from_location_id">From location</label>
                <select
                  id="from_location_id"
                  value={form.from_location_id}
                  onChange={(e) => setForm((p) => ({ ...p, from_location_id: e.target.value }))}
                >
                  <option value="">Optional</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="to_location_id">To location</label>
                <select
                  id="to_location_id"
                  value={form.to_location_id}
                  onChange={(e) => setForm((p) => ({ ...p, to_location_id: e.target.value }))}
                >
                  <option value="">Optional</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="reason">Reason</label>
              <textarea
                id="reason"
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                required
              />
            </div>
          </form>
        </Modal>
      ) : null}

      {rejectModal && isAdmin ? (
        <Modal
          title="Reject transfer"
          onClose={() => setRejectModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setRejectModal(null)}>
                Back
              </button>
              <button type="submit" form="reject-transfer" className="btn btn-danger">
                Reject
              </button>
            </>
          }
        >
          <form id="reject-transfer" className="form" onSubmit={handleReject}>
            <div className="field">
              <label htmlFor="rejection_reason">Reason</label>
              <textarea id="rejection_reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
          </form>
        </Modal>
      ) : null}

      {cancelModal && isAdmin ? (
        <Modal
          title="Cancel transfer"
          onClose={() => setCancelModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setCancelModal(null)}>
                Back
              </button>
              <button type="submit" form="cancel-transfer" className="btn btn-danger">
                Cancel transfer
              </button>
            </>
          }
        >
          <form id="cancel-transfer" className="form" onSubmit={handleCancel}>
            <div className="field">
              <label htmlFor="cancellation_reason">Reason</label>
              <textarea
                id="cancellation_reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
