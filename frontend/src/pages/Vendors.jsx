import { useCallback, useEffect, useState } from 'react'
import { vendorsApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import { usePageTitle } from '../hooks/usePageTitle'

const emptyForm = {
  name: '',
  code: '',
  contact_person: '',
  email: '',
  phone: '',
  city: '',
  notes: '',
  is_active: true,
}

export default function Vendors() {
  usePageTitle('Vendors')
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await vendorsApi.list({ page, limit: 20, search: search || undefined })
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await vendorsApi.create({
        name: form.name.trim(),
        code: form.code.trim(),
        contact_person: form.contact_person.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        city: form.city.trim() || undefined,
        notes: form.notes.trim() || undefined,
        is_active: form.is_active,
      })
      setShowCreate(false)
      setForm(emptyForm)
      setPage(1)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await vendorsApi.update(editItem.id, {
        name: form.name.trim(),
        code: form.code.trim(),
        contact_person: form.contact_person.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      })
      setEditItem(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this vendor?')) return
    try {
      await vendorsApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      name: item.name || '',
      code: item.code || '',
      contact_person: item.contact_person || '',
      email: item.email || '',
      phone: item.phone || '',
      city: item.city || '',
      notes: item.notes || '',
      is_active: item.is_active !== false,
    })
  }

  const formFields = (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" value={form.name} onChange={(e) => updateForm('name', e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="code">Code</label>
          <input id="code" value={form.code} onChange={(e) => updateForm('code', e.target.value)} required />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="contact_person">Contact</label>
          <input
            id="contact_person"
            value={form.contact_person}
            onChange={(e) => updateForm('contact_person', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => updateForm('email', e.target.value)}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="city">City</label>
          <input id="city" value={form.city} onChange={(e) => updateForm('city', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} />
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => updateForm('is_active', e.target.checked)}
          />{' '}
          Active
        </label>
      </div>
    </>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Vendors</h1>
          <p>Suppliers linked to purchases.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setForm(emptyForm)
            setShowCreate(true)
          }}
        >
          Add vendor
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search vendors…"
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
        />
      </div>

      <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="truck"
              title="No vendors yet"
              description="Add vendors to link with purchase orders."
              action={{ label: 'New vendor', onClick: () => { setForm(emptyForm); setShowCreate(true) } }}
            />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Code</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Active</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Name" data-card-title>{item.name}</td>
                    <td className="muted" data-label="Code">{item.code}</td>
                    <td className="muted" data-label="Contact">{item.contact_person || item.email || '—'}</td>
                    <td data-label="Active">
                      <span className={`badge ${item.is_active !== false ? 'badge-ok' : 'badge-danger'}`}>
                        {item.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-actions>
                      <div className="row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>
                          Edit
                        </button>
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
          title="Add vendor"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-vendor" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </button>
            </>
          }
        >
          <form id="create-vendor" className="form" onSubmit={handleCreate}>
            {formFields}
          </form>
        </Modal>
      ) : null}

      {editItem ? (
        <Modal
          title="Edit vendor"
          onClose={() => setEditItem(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setEditItem(null)}>
                Cancel
              </button>
              <button type="submit" form="edit-vendor" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <form id="edit-vendor" className="form" onSubmit={handleUpdate}>
            {formFields}
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
