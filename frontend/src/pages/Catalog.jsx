import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { categoriesApi, locationsApi, orgUnitsApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { SkeletonTable } from '../components/Skeleton'
import { usePageTitle } from '../hooks/usePageTitle'
import DropBoxes from './DropBoxes'

const tabs = [
  { id: 'categories', label: 'Categories' },
  { id: 'locations', label: 'Locations' },
  { id: 'orgs', label: 'Org units' },
  { id: 'drop-boxes', label: 'Drop boxes' },
]

export default function Catalog() {
  usePageTitle('Catalog')
  const { isAdmin, isSuperAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const tab = tabs.some((item) => item.id === requestedTab) ? requestedTab : 'categories'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  const load = useCallback(async () => {
    if (tab === 'drop-boxes') {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      let res
      if (tab === 'categories') res = await categoriesApi.list({ limit: 50 })
      else if (tab === 'locations') res = await locationsApi.list({ limit: 50 })
      else res = await orgUnitsApi.list({ limit: 50 })
      setItems(res.data || [])
    } catch (err) {
      setError(err.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  function blankForm() {
    if (tab === 'categories') {
      return { name: '', default_loan_days: 7, default_low_stock_threshold: 0, max_renewals: 0 }
    }
    if (tab === 'locations') {
      return { name: '', type: 'storage', building: '', floor: '', room_number: '' }
    }
    return { name: '', code: '', type: 'club' }
  }

  function openCreate() {
    setForm(blankForm())
    setShowCreate(true)
  }

  function openEdit(item) {
    if (tab === 'categories') {
      setForm({
        name: item.name || '',
        default_loan_days: item.default_loan_days ?? 7,
        default_low_stock_threshold: item.default_low_stock_threshold ?? 0,
        max_renewals: item.max_renewals ?? 0,
      })
    } else if (tab === 'locations') {
      setForm({
        name: item.name || '',
        type: item.type || 'storage',
        building: item.building || '',
        floor: item.floor || '',
        room_number: item.room_number || '',
      })
    } else {
      setForm({
        name: item.name || '',
        code: item.code || '',
        type: item.type || 'club',
      })
    }
    setEditItem(item)
  }

  async function persist(isEdit) {
    if (tab === 'categories') {
      const body = {
        name: form.name.trim(),
        default_loan_days: Number(form.default_loan_days),
        default_low_stock_threshold: Number(form.default_low_stock_threshold),
        max_renewals: Number(form.max_renewals),
      }
      if (isEdit) await categoriesApi.update(editItem.id, body)
      else await categoriesApi.create(body)
    } else if (tab === 'locations') {
      const body = {
        name: form.name.trim(),
        type: form.type.trim(),
        building: form.building.trim() || undefined,
        floor: form.floor.trim() || undefined,
        room_number: form.room_number.trim() || undefined,
      }
      if (isEdit) await locationsApi.update(editItem.id, body)
      else await locationsApi.create(body)
    } else {
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        type: form.type.trim(),
      }
      if (isEdit) await orgUnitsApi.update(editItem.id, body)
      else await orgUnitsApi.create(body)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await persist(false)
      setShowCreate(false)
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
      await persist(true)
      setEditItem(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this item?')) return
    try {
      if (tab === 'categories') await categoriesApi.remove(id)
      else if (tab === 'locations') await locationsApi.remove(id)
      else await orgUnitsApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const formFields = (
    <>
      {tab === 'categories' ? (
        <>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={form.name || ''}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="default_loan_days">Default loan days</label>
              <input
                id="default_loan_days"
                type="number"
                min="1"
                value={form.default_loan_days}
                onChange={(e) => setForm((p) => ({ ...p, default_loan_days: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="default_low_stock_threshold">Low stock threshold</label>
              <input
                id="default_low_stock_threshold"
                type="number"
                min="0"
                value={form.default_low_stock_threshold}
                onChange={(e) => setForm((p) => ({ ...p, default_low_stock_threshold: e.target.value }))}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="max_renewals">Max renewals</label>
            <input
              id="max_renewals"
              type="number"
              min="0"
              value={form.max_renewals}
              onChange={(e) => setForm((p) => ({ ...p, max_renewals: e.target.value }))}
            />
          </div>
        </>
      ) : null}

      {tab === 'locations' ? (
        <>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={form.name || ''}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="type">Type</label>
            <input
              id="type"
              value={form.type || ''}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="building">Building</label>
              <input
                id="building"
                value={form.building || ''}
                onChange={(e) => setForm((p) => ({ ...p, building: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="floor">Floor</label>
              <input
                id="floor"
                value={form.floor || ''}
                onChange={(e) => setForm((p) => ({ ...p, floor: e.target.value }))}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="room_number">Room</label>
            <input
              id="room_number"
              value={form.room_number || ''}
              onChange={(e) => setForm((p) => ({ ...p, room_number: e.target.value }))}
            />
          </div>
        </>
      ) : null}

      {tab === 'orgs' ? (
        <>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={form.name || ''}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="code">Code</label>
              <input
                id="code"
                value={form.code || ''}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="type">Type</label>
              <input
                id="type"
                value={form.type || ''}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                required
              />
            </div>
          </div>
        </>
      ) : null}
    </>
  )
  const canManageTab = tab === 'drop-boxes' ? false : tab === 'locations' ? isAdmin : isSuperAdmin

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Catalog</h1>
          <p>Categories, locations, organization units, and return drop boxes.</p>
        </div>
        {canManageTab ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add {tabs.find((t) => t.id === tab)?.label.slice(0, -1).toLowerCase()}
          </button>
        ) : null}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            aria-pressed={tab === t.id}
            onClick={() => setSearchParams(t.id === 'categories' ? {} : { tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'drop-boxes' ? <DropBoxes embedded /> : <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : items.length === 0 ? (
            <EmptyState icon="layout-grid" title="Nothing in this catalog yet" />
          ) : tab === 'categories' ? (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Loan days</th>
                  <th>Low stock</th>
                  <th>Max renewals</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Name" data-card-title>{item.name}</td>
                    <td data-label="Loan days">{item.default_loan_days}</td>
                    <td data-label="Low stock">{item.default_low_stock_threshold}</td>
                    <td data-label="Max renewals">{item.max_renewals}</td>
                    <td data-actions>
                      <div className="row-actions">
                        {canManageTab ? (
                          <>
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
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'locations' ? (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Building</th>
                  <th>Room</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Name" data-card-title>{item.name}</td>
                    <td className="muted" data-label="Type">{item.type}</td>
                    <td className="muted" data-label="Building">{item.building || '—'}</td>
                    <td className="muted" data-label="Room">
                      {[item.floor, item.room_number].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td data-actions>
                      <div className="row-actions">
                        {canManageTab ? (
                          <>
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
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Name" data-card-title>{item.name}</td>
                    <td className="muted" data-label="Code">{item.code}</td>
                    <td className="muted" data-label="Type">{item.type}</td>
                    <td data-label="Active">
                      <StatusPill active={item.is_active !== false} />
                    </td>
                    <td data-actions>
                      <div className="row-actions">
                        {canManageTab ? (
                          <>
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
      </div>}

      {showCreate && canManageTab ? (
        <Modal
          title={`Add ${tabs.find((t) => t.id === tab)?.label.slice(0, -1).toLowerCase()}`}
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-catalog" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </button>
            </>
          }
        >
          <form id="create-catalog" className="form" onSubmit={handleCreate}>
            {formFields}
          </form>
        </Modal>
      ) : null}

      {editItem && canManageTab ? (
        <Modal
          title={`Edit ${tabs.find((t) => t.id === tab)?.label.slice(0, -1).toLowerCase()}`}
          onClose={() => setEditItem(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setEditItem(null)}>
                Cancel
              </button>
              <button type="submit" form="edit-catalog" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <form id="edit-catalog" className="form" onSubmit={handleUpdate}>
            {formFields}
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

function StatusPill({ active }) {
  return (
    <span className={`badge ${active ? 'badge-ok' : 'badge-danger'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
