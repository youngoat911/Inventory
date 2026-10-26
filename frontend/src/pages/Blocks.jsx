import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { blocksApi, usersApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Blocks() {
  usePageTitle('Borrower Blocks')
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ user_id: '', reason: '', blocked_until: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await blocksApi.list({ page, limit: 20 })
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    usersApi
      .list({ limit: 100 })
      .then((res) => setUsers(res.data || []))
      .catch(() => setUsers([]))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await blocksApi.create({
        user_id: form.user_id,
        reason: form.reason.trim(),
        blocked_by: user.id,
        blocked_until: form.blocked_until || undefined,
        is_active: true,
      })
      setShowCreate(false)
      setForm({ user_id: '', reason: '', blocked_until: '' })
      setPage(1)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLift(id) {
    try {
      await blocksApi.update(id, {
        is_active: false,
        lifted_by: user.id,
        lifted_at: new Date().toISOString().slice(0, 10),
      })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this block record?')) return
    try {
      await blocksApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Borrower blocks</h1>
          <p>Restrict users who cannot borrow equipment.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Block user
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="ban"
              title="No borrower blocks"
              description="Users with active blocks will appear here."
              action={{ label: 'Block user', onClick: () => setShowCreate(true) }}
            />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Until</th>
                  <th scope="col">Active</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="User" data-card-title>
                      <div>{item.user_name || item.user_id?.slice(0, 8)}</div>
                      <div className="muted">{item.user_email || ''}</div>
                    </td>
                    <td className="muted" data-label="Reason">{item.reason}</td>
                    <td className="muted" data-label="Until">{item.blocked_until || 'Indefinite'}</td>
                    <td data-label="Active">
                      <span className={`badge ${item.is_active ? 'badge-danger' : 'badge-ok'}`}>
                        {item.is_active ? 'Active' : 'Lifted'}
                      </span>
                    </td>
                    <td data-actions>
                      <div className="row-actions">
                        {item.is_active ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleLift(item.id)}
                          >
                            Lift
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
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
          title="Block user"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-block" className="btn btn-danger" disabled={saving}>
                {saving ? 'Saving…' : 'Block'}
              </button>
            </>
          }
        >
          <form id="create-block" className="form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="user_id">User</label>
              <select
                id="user_id"
                value={form.user_id}
                onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
                required
              >
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.institute_email})
                  </option>
                ))}
              </select>
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
            <div className="field">
              <label htmlFor="blocked_until">Blocked until</label>
              <input
                id="blocked_until"
                type="date"
                value={form.blocked_until}
                onChange={(e) => setForm((p) => ({ ...p, blocked_until: e.target.value }))}
              />
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
