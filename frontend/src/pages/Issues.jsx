import { useCallback, useEffect, useState } from 'react'
import { assetsApi, dropBoxesApi, issuesApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

export default function Issues() {
  usePageTitle('Borrowing')
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [assets, setAssets] = useState([])
  const [dropBoxes, setDropBoxes] = useState([])
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ asset_id: '', quantity: 1, purpose: '' })
  const [saving, setSaving] = useState(false)
  const [returnModal, setReturnModal] = useState(null)
  const [returnCondition, setReturnCondition] = useState('good')
  const [receiveModal, setReceiveModal] = useState(null)
  const [receiveCondition, setReceiveCondition] = useState('good')
  const [dropModal, setDropModal] = useState(null)
  const [dropBoxId, setDropBoxId] = useState('')
  const [cancelModal, setCancelModal] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await issuesApi.list({
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

  useAutoRefresh(['issues', 'assets'], () => {
    load()
  })

  useEffect(() => {
    assetsApi
      .list({ limit: 100, status: 'available', is_issuable: true })
      .then((res) => setAssets(res.data || []))
      .catch(() => setAssets([]))
    dropBoxesApi
      .list({ limit: 100 })
      .then((res) => setDropBoxes(res.data || []))
      .catch(() => setDropBoxes([]))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await issuesApi.create({
        asset_id: form.asset_id,
        quantity: Number(form.quantity),
        purpose: form.purpose.trim() || undefined,
      })
      setShowCreate(false)
      setForm({ asset_id: '', quantity: 1, purpose: '' })
      setPage(1)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleIssue(id) {
    try {
      await issuesApi.issue(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReturn(e) {
    e.preventDefault()
    try {
      await issuesApi.return(returnModal, {
        return_condition: returnCondition,
      })
      setReturnModal(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCancel(e) {
    e.preventDefault()
    try {
      await issuesApi.cancel(cancelModal, {
        cancellation_reason: cancelReason.trim(),
      })
      setCancelModal(null)
      setCancelReason('')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRenew(id) {
    try {
      await issuesApi.renew(id, { reason: 'Extension requested from UI' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDrop(e) {
    e.preventDefault()
    try {
      await issuesApi.drop(dropModal, { drop_box_id: dropBoxId })
      setDropModal(null)
      setDropBoxId('')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleReceive(e) {
    e.preventDefault()
    try {
      await issuesApi.receive(receiveModal, {
        return_condition: receiveCondition,
      })
      setReceiveModal(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Borrowing</h1>
          <p>Request, issue, renew, and return equipment.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Request loan
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="tabs">
        {[
          ['', 'All'],
          ['requested', 'Requested'],
          ['active', 'Active'],
          ['dropped', 'Dropped'],
          ['returned', 'Returned'],
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
            <SkeletonTable rows={8} cols={6} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="hand-helping"
              title="No loans in this view"
              description="Request a loan to check out equipment."
              action={{ label: 'Request loan', onClick: () => setShowCreate(true) }}
            />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Status</th>
                  <th scope="col">Due</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((issue) => (
                  <tr key={issue.id}>
                    <td data-label="Asset" data-card-title>
                      <div>{issue.asset_name || issue.asset_id?.slice(0, 8)}</div>
                      <div className="muted">{issue.id.slice(0, 8)}</div>
                    </td>
                    <td data-label="Qty">{issue.quantity}</td>
                    <td data-label="Status">
                      <StatusBadge value={issue.status} />
                    </td>
                    <td className="muted" data-label="Due">
                      {issue.due_at ? new Date(issue.due_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="muted" data-label="Purpose">{issue.purpose || '—'}</td>
                    <td data-actions>
                      <div className="row-actions">
                        {issue.status === 'requested' ? (
                          <>
                            {isAdmin ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleIssue(issue.id)}
                              >
                                Issue
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setCancelModal(issue.id)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}
                        {issue.status === 'active' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setReturnCondition('good')
                                setReturnModal(issue.id)
                              }}
                            >
                              Return
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setDropBoxId('')
                                setDropModal(issue.id)
                              }}
                            >
                              Drop
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleRenew(issue.id)}
                            >
                              Renew
                            </button>
                          </>
                        ) : null}
                        {issue.status === 'dropped' ? (
                          isAdmin ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setReceiveCondition('good')
                                setReceiveModal(issue.id)
                              }}
                            >
                              Receive
                            </button>
                          ) : null
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

      {showCreate ? (
        <Modal
          title="Request loan"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-issue" className="btn btn-primary" disabled={saving}>
                {saving ? 'Submitting…' : 'Submit'}
              </button>
            </>
          }
        >
          <form id="create-issue" className="form" onSubmit={handleCreate}>
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
                    {a.name} ({a.quantity} avail.)
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
            <div className="field">
              <label htmlFor="purpose">Purpose</label>
              <textarea
                id="purpose"
                value={form.purpose}
                onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </form>
        </Modal>
      ) : null}

      {returnModal ? (
        <Modal
          title="Return asset"
          onClose={() => setReturnModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setReturnModal(null)}>
                Cancel
              </button>
              <button type="submit" form="return-issue" className="btn btn-primary">
                Confirm return
              </button>
            </>
          }
        >
          <form id="return-issue" className="form" onSubmit={handleReturn}>
            <div className="field">
              <label htmlFor="return_condition">Return condition</label>
              <select
                id="return_condition"
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
                required
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
          </form>
        </Modal>
      ) : null}

      {cancelModal ? (
        <Modal
          title="Cancel request"
          onClose={() => setCancelModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setCancelModal(null)}>
                Back
              </button>
              <button type="submit" form="cancel-issue" className="btn btn-danger">
                Cancel request
              </button>
            </>
          }
        >
          <form id="cancel-issue" className="form" onSubmit={handleCancel}>
            <div className="field">
              <label htmlFor="cancellation_reason">Reason</label>
              <textarea
                id="cancellation_reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
            </div>
          </form>
        </Modal>
      ) : null}

      {dropModal ? (
        <Modal
          title="Drop at box"
          onClose={() => setDropModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setDropModal(null)}>
                Cancel
              </button>
              <button type="submit" form="drop-issue" className="btn btn-primary">
                Confirm drop
              </button>
            </>
          }
        >
          <form id="drop-issue" className="form" onSubmit={handleDrop}>
            <div className="field">
              <label htmlFor="drop_box_id">Drop box</label>
              <select
                id="drop_box_id"
                value={dropBoxId}
                onChange={(e) => setDropBoxId(e.target.value)}
                required
              >
                <option value="">Select drop box</option>
                {dropBoxes.map((box) => (
                  <option key={box.id} value={box.id}>
                    {box.name}
                  </option>
                ))}
              </select>
              {dropBoxes.length === 0 ? (
                <span className="muted">Create a drop box first.</span>
              ) : null}
            </div>
          </form>
        </Modal>
      ) : null}

      {receiveModal ? (
        <Modal
          title="Receive from drop box"
          onClose={() => setReceiveModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setReceiveModal(null)}>
                Cancel
              </button>
              <button type="submit" form="receive-issue" className="btn btn-primary">
                Confirm receive
              </button>
            </>
          }
        >
          <form id="receive-issue" className="form" onSubmit={handleReceive}>
            <div className="field">
              <label htmlFor="receive_condition">Return condition</label>
              <select
                id="receive_condition"
                value={receiveCondition}
                onChange={(e) => setReceiveCondition(e.target.value)}
                required
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
