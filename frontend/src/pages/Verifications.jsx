import { useCallback, useEffect, useState } from 'react'
import { api, qs } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Verifications() {
  usePageTitle('Verifications')
  const toast = useToast()
  const [cycles, setCycles] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api(`/verifications/cycles${qs({ page, limit: 20 })}`)
      setCycles(res.data || [])
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
      await api('/verifications/cycles', { method: 'POST', body: form })
      setShowCreate(false)
      setForm({ name: '', description: '', start_date: '', end_date: '' })
      toast.success('Verification cycle created')
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Verifications</h1>
          <p>Manage asset verification cycles.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          New cycle
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : cycles.length === 0 ? (
        <EmptyState icon="clipboard-check" title="No verification cycles" description="Create a verification cycle to audit your asset inventory." action={{ label: 'New cycle', onClick: () => setShowCreate(true) }} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Start</th>
                  <th scope="col">End</th>
                  <th scope="col">Status</th>
                  <th scope="col">Progress</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => {
                  const pct = c.total_assets > 0 ? Math.round((c.verified_count / c.total_assets) * 100) : 0
                  return (
                    <tr key={c.id}>
                      <td data-label="Name" data-card-title>{c.name}</td>
                      <td data-label="Start" className="muted">{c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'}</td>
                      <td data-label="End" className="muted">{c.end_date ? new Date(c.end_date).toLocaleDateString() : '—'}</td>
                      <td data-label="Status"><StatusBadge value={c.status} /></td>
                      <td data-label="Progress">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: 'var(--line)', borderRadius: '3px' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s' }} />
                          </div>
                          <span className="muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onChange={setPage} />
        </>
      )}

      {showCreate && (
        <Modal
          title="New verification cycle"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" form="cycle-form" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
            </>
          }
        >
          <form id="cycle-form" className="form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="c-name">Cycle name</label>
              <input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="field">
              <label htmlFor="c-desc">Description</label>
              <textarea id="c-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="c-start">Start date</label>
                <input id="c-start" type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} required />
              </div>
              <div className="field">
                <label htmlFor="c-end">End date</label>
                <input id="c-end" type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

