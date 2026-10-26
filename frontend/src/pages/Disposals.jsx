import { useCallback, useEffect, useState } from 'react'
import { api, qs } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'

const emptyForm = { asset_id: '', reason: '', notes: '', disposal_method: 'written_off' }

export default function Disposals() {
  usePageTitle('Disposals')
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null) // { id, action }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api(`/disposals${qs({ page, limit: 20 })}`)
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [page]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api('/disposals', { method: 'POST', body: form })
      setShowCreate(false)
      setForm(emptyForm)
      toast.success('Disposal request submitted')
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAction(id, action) {
    try {
      await api(`/disposals/${id}/${action}`, { method: 'POST', body: {} })
      toast.success(`Disposal ${action}d`)
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setConfirm(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Disposals</h1>
          <p>Request and track asset disposal.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Request disposal
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="archive"
          title="No disposals yet"
          description="Request disposal of assets that are damaged, lost, or no longer needed."
          action={{ label: 'Request disposal', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Method</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Status</th>
                  {isAdmin && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Asset" data-card-title>{item.asset_name ?? item.asset_id?.slice(0, 8)}</td>
                    <td data-label="Method">{item.disposal_method?.replace(/_/g, ' ')}</td>
                    <td data-label="Reason">{item.reason}</td>
                    <td data-label="Status"><StatusBadge value={item.status} /></td>
                    {isAdmin && (
                      <td data-actions>
                        <div className="row-actions">
                          {item.status === 'requested' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => setConfirm({ id: item.id, action: 'approve' })}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => setConfirm({ id: item.id, action: 'reject' })}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onChange={setPage} />
        </>
      )}

      {showCreate && (
        <Modal
          title="Request disposal"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" form="disposal-form" className="btn btn-primary" disabled={saving}>
                {saving ? 'Submitting…' : 'Submit'}
              </button>
            </>
          }
        >
          <form id="disposal-form" className="form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="d-asset">Asset ID</label>
              <input
                id="d-asset"
                value={form.asset_id}
                onChange={(e) => setForm((f) => ({ ...f, asset_id: e.target.value }))}
                required
                placeholder="UUID of asset"
              />
            </div>
            <div className="field">
              <label htmlFor="d-method">Method</label>
              <select
                id="d-method"
                value={form.disposal_method}
                onChange={(e) => setForm((f) => ({ ...f, disposal_method: e.target.value }))}
              >
                <option value="written_off">Written off</option>
                <option value="sold">Sold</option>
                <option value="donated">Donated</option>
                <option value="scrapped">Scrapped</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-reason">Reason</label>
              <textarea
                id="d-reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={`${confirm.action === 'approve' ? 'Approve' : 'Reject'} disposal?`}
          message={`This will ${confirm.action} the disposal request.`}
          confirmLabel={confirm.action === 'approve' ? 'Approve' : 'Reject'}
          confirmVariant={confirm.action === 'approve' ? 'primary' : 'danger'}
          onConfirm={() => handleAction(confirm.id, confirm.action)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
