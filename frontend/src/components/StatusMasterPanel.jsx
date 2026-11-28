import { useCallback, useEffect, useState } from 'react'
import { statusMasterApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Modal from './Modal'
import StatusBadge from './StatusBadge'
import { SkeletonTable } from './Skeleton'

const COLORS = [
  { value: 'ok', label: 'Green' },
  { value: 'info', label: 'Blue' },
  { value: 'warn', label: 'Amber' },
  { value: 'danger', label: 'Red' },
  { value: 'neutral', label: 'Grey' },
]

const KINDS = [
  { id: 'status', title: 'Asset statuses', singular: 'status' },
  { id: 'condition', title: 'Asset conditions', singular: 'condition' },
]

function MasterTable({ kind, title, singular, canManage }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | row
  const [form, setForm] = useState({ label: '', color: 'neutral', sort_order: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await statusMasterApi.list(kind, { include_inactive: true })
      setItems(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [kind])

  useEffect(() => { load() }, [load])

  function openNew() {
    setForm({ label: '', color: 'neutral', sort_order: '' })
    setEditing('new')
  }

  function openEdit(row) {
    setForm({ label: row.label, color: row.color, sort_order: String(row.sort_order) })
    setEditing(row)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      label: form.label.trim(),
      color: form.color,
      sort_order: form.sort_order !== '' ? Number(form.sort_order) : undefined,
    }
    try {
      if (editing === 'new') await statusMasterApi.create(kind, body)
      else await statusMasterApi.update(kind, editing.code, body)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row) {
    try {
      await statusMasterApi.update(kind, row.code, { is_active: !row.is_active })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(row) {
    if (!confirm(`Delete ${singular} "${row.label}"?`)) return
    try {
      await statusMasterApi.remove(kind, row.code)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="panel" style={{ marginBottom: '1.25rem' }}>
      <div className="page-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h2>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>
            Add {singular}
          </button>
        ) : null}
      </div>
      {error && !editing ? <div className="error-banner">{error}</div> : null}
      <div className="table-wrap">
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : (
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Code</th>
                <th>Order</th>
                <th>Assets</th>
                <th>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.code}>
                  <td data-label="Label" data-card-title>
                    <StatusBadge value={row.code} meta={row} />
                    {row.is_system ? <span className="muted" style={{ marginLeft: '0.4rem', fontSize: '0.8rem' }}>built-in</span> : null}
                  </td>
                  <td className="muted" data-label="Code">{row.code}</td>
                  <td data-label="Order">{row.sort_order}</td>
                  <td data-label="Assets">{row.asset_count ?? 0}</td>
                  <td data-label="State">{row.is_active ? 'Active' : <span className="muted">Inactive</span>}</td>
                  <td data-actions>
                    {canManage ? (
                      <div className="row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                        {!row.is_system ? (
                          <>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(row)}>
                              {row.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(row)}>
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing ? (
        <Modal
          title={editing === 'new' ? `Add ${singular}` : `Edit ${singular}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" form={`master-${kind}`} className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <form id={`master-${kind}`} className="form" onSubmit={save}>
            {error ? <div className="error-banner" role="alert">{error}</div> : null}
            <div className="field">
              <label htmlFor={`${kind}-label`}>Label</label>
              <input
                id={`${kind}-label`}
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={kind === 'condition' ? 'e.g. Good maintenance' : 'e.g. Under inspection'}
                required
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor={`${kind}-color`}>Badge colour</label>
                <select
                  id={`${kind}-color`}
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                >
                  {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${kind}-order`}>Display order</label>
                <input
                  id={`${kind}-order`}
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

export default function StatusMasterPanel() {
  const { isAdmin } = useAuth()
  return (
    <div>
      {KINDS.map((k) => (
        <MasterTable key={k.id} kind={k.id} title={k.title} singular={k.singular} canManage={isAdmin} />
      ))}
    </div>
  )
}
