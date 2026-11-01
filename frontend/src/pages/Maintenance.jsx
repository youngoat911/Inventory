import { useCallback, useEffect, useState } from 'react'
import { api, qs } from '../api/client'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'

const emptyForm = { asset_id: '', description: '', scheduled_date: '', estimated_cost: '' }

export default function Maintenance() {
  usePageTitle('Maintenance')
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api(`/maintenance${qs({ page, limit: 20 })}`)
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
      await api('/maintenance', {
        method: 'POST',
        body: {
          asset_id: form.asset_id,
          type: 'repair',
          description: form.description,
          cost: form.estimated_cost ? Number(form.estimated_cost) : undefined,
        },
      })
      setShowCreate(false)
      setForm(emptyForm)
      toast.success('Maintenance record created')
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleResolve(id) {
    try {
      await api(`/maintenance/${id}/resolve`, { method: 'POST', body: {} })
      toast.success('Marked as resolved')
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
          <h1>Maintenance</h1>
          <p>Track repairs and scheduled maintenance.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Log maintenance
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : items.length === 0 ? (
        <EmptyState icon="wrench" title="No maintenance records" description="Log maintenance work to track repair history and costs." action={{ label: 'Log maintenance', onClick: () => setShowCreate(true) }} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Description</th>
                  <th scope="col">Scheduled</th>
                  <th scope="col">Status</th>
                  {isAdmin && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Asset" data-card-title>{item.asset_name ?? item.asset_id?.slice(0, 8)}</td>
                    <td data-label="Description">{item.description}</td>
                    <td data-label="Scheduled" className="muted">{item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString() : '—'}</td>
                    <td data-label="Status"><StatusBadge value={item.status} /></td>
                    {isAdmin && (
                      <td data-actions>
                        <div className="row-actions">
                          {item.status === 'open' || item.status === 'in_progress' ? (
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => setConfirm(item.id)}>Resolve</button>
                          ) : null}
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
          title="Log maintenance"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" form="maint-form" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
            </>
          }
        >
          <form id="maint-form" className="form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="m-asset">Asset ID</label>
              <input id="m-asset" value={form.asset_id} onChange={(e) => setForm((f) => ({ ...f, asset_id: e.target.value }))} required placeholder="UUID of asset" />
            </div>
            <div className="field">
              <label htmlFor="m-desc">Description</label>
              <textarea id="m-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="m-date">Scheduled date</label>
                <input id="m-date" type="date" value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="m-cost">Est. cost (₹)</label>
                <input id="m-cost" type="number" min="0" step="0.01" value={form.estimated_cost} onChange={(e) => setForm((f) => ({ ...f, estimated_cost: e.target.value }))} />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title="Mark as resolved?"
          message="This will close the maintenance record."
          confirmLabel="Resolve"
          confirmVariant="primary"
          onConfirm={() => handleResolve(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

