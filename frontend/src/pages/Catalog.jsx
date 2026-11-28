import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { categoriesApi, locationsApi, orgUnitsApi } from '../api/client'
import { flattenCategoryTree } from '../categoryTree'
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

function collectExpandableIds(nodes, ids = new Set()) {
  for (const node of nodes) {
    if (node.children?.length) {
      ids.add(node.id)
      collectExpandableIds(node.children, ids)
    }
  }
  return ids
}

export default function Catalog() {
  usePageTitle('Catalog')
  const { isAdmin, isSuperAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const tab = tabs.some((item) => item.id === requestedTab) ? requestedTab : 'categories'
  const [items, setItems] = useState([])
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createParent, setCreateParent] = useState(null)
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
      if (tab === 'categories') res = await categoriesApi.tree()
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

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function blankForm(parentNode = null) {
    if (tab === 'categories') {
      return {
        name: '',
        code: '',
        parent_id: parentNode?.id || '',
        default_loan_days: parentNode?.default_loan_days ?? 7,
        default_low_stock_threshold: parentNode?.default_low_stock_threshold ?? 0,
        max_renewals: parentNode?.max_renewals ?? 0,
      }
    }
    if (tab === 'locations') {
      return { name: '', type: 'storage', building: '', floor: '', room_number: '' }
    }
    return { name: '', code: '', type: 'club' }
  }

  function openCreate(parentNode = null) {
    setCreateParent(parentNode)
    setForm(blankForm(parentNode))
    setShowCreate(true)
  }

  function openEdit(item) {
    if (tab === 'categories') {
      setForm({
        name: item.name || '',
        code: item.code || '',
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
        code: form.code?.trim() || undefined,
        default_loan_days: Number(form.default_loan_days),
        default_low_stock_threshold: Number(form.default_low_stock_threshold),
        max_renewals: Number(form.max_renewals),
      }
      if (isEdit) {
        await categoriesApi.update(editItem.id, body)
      } else {
        await categoriesApi.create({
          ...body,
          parent_id: form.parent_id,
        })
        if (form.parent_id) {
          setExpandedIds((prev) => new Set([...prev, form.parent_id]))
        }
      }
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
      setCreateParent(null)
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
    setError('')
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
          {createParent && !editItem ? (
            <div className="field">
              <label>Parent category</label>
              <div className="muted" style={{ padding: '0.35rem 0' }}>
                {createParent.full_path || createParent.name} (Level {createParent.level})
              </div>
            </div>
          ) : null}
          <div className="form-row">
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
              <label htmlFor="code">Code (optional, auto-assigned)</label>
              <input
                id="code"
                value={form.code || ''}
                placeholder="e.g. 01"
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              />
            </div>
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
  const visibleCategoryRows = tab === 'categories' ? flattenCategoryTree(items, expandedIds) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Catalog</h1>
          <p>4-level asset classification, locations, organization units, and return drop boxes.</p>
        </div>
        {tab === 'categories' ? (
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExpandedIds(collectExpandableIds(items))}
            >
              Expand all
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExpandedIds(new Set())}
            >
              Collapse all
            </button>
          </div>
        ) : canManageTab ? (
          <button type="button" className="btn btn-primary" onClick={() => openCreate()}>
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
                  <th>Classification</th>
                  <th>Code</th>
                  <th>Level</th>
                  <th>Dep. rate</th>
                  <th>Assets</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleCategoryRows.map((item) => {
                  const hasChildren = item.children && item.children.length > 0
                  const isExpanded = expandedIds.has(item.id)
                  const level = item.level || 1
                  const indentPx = (level - 1) * 24
                  const isLevel1 = item.is_system || item.level === 1

                  return (
                    <tr key={item.id}>
                      <td data-label="Classification" data-card-title>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: `${indentPx}px` }}>
                          {hasChildren ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '0.15rem 0.45rem', minWidth: '1.75rem' }}
                              aria-label={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                              onClick={() => toggleExpand(item.id)}
                            >
                              {isExpanded ? '▾' : '▸'}
                            </button>
                          ) : (
                            <span style={{ display: 'inline-block', width: '1.75rem', textAlign: 'center' }} className="muted">
                              •
                            </span>
                          )}
                          <span style={{ fontWeight: isLevel1 ? 600 : 400 }}>{item.name}</span>
                          {item.is_legacy ? (
                            <span className="badge badge-warn">Needs reclassification</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="muted" data-label="Code">
                        {item.code_path || item.code || '—'}
                      </td>
                      <td data-label="Level">
                        {item.is_legacy ? (
                          <span className="muted">Legacy</span>
                        ) : (
                          <span className="badge">L{item.level}</span>
                        )}
                      </td>
                      <td data-label="Dep. rate">
                        {item.is_legacy || item.effective_dep_rate_percent == null ? (
                          <span className="muted">—</span>
                        ) : isLevel1 ? (
                          <span>
                            {item.top_level_amortization_life_years
                              ? `${item.effective_dep_rate_percent}% (${item.top_level_amortization_life_years} yrs)`
                              : `${item.effective_dep_rate_percent}%`}
                          </span>
                        ) : (
                          <span className="muted" title="Inherited from Level 1">
                            {item.effective_dep_rate_percent}% (inherited)
                          </span>
                        )}
                      </td>
                      <td data-label="Assets">{item.asset_count ?? 0}</td>
                      <td data-actions>
                        <div className="row-actions">
                          {canManageTab && !item.is_legacy ? (
                            isLevel1 ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => openCreate(item)}
                              >
                                Add sub-category
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={item.level >= 4}
                                  title={item.level >= 4 ? 'Maximum depth (Level 4) reached' : undefined}
                                  onClick={() => openCreate(item)}
                                >
                                  Add sub-category
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => openEdit(item)}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  Delete
                                </button>
                              </>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
          title={
            tab === 'categories' && createParent
              ? `Add Level ${createParent.level + 1} sub-category`
              : `Add ${tabs.find((t) => t.id === tab)?.label.slice(0, -1).toLowerCase()}`
          }
          onClose={() => {
            setShowCreate(false)
            setCreateParent(null)
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowCreate(false)
                  setCreateParent(null)
                }}
              >
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
          title={
            tab === 'categories'
              ? `Rename / edit sub-category`
              : `Edit ${tabs.find((t) => t.id === tab)?.label.slice(0, -1).toLowerCase()}`
          }
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
