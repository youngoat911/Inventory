import { useCallback, useEffect, useState } from 'react'
import { assetsApi, categoriesApi, locationsApi } from '../api/client'
import { BUDGET_TYPES, budgetTypeLabel } from '../constants'
import { findCategoryNode, isAssetCategoryLeaf } from '../categoryTree'
import CascadingCategoryPicker from '../components/CascadingCategoryPicker'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useStatusMaster } from '../hooks/useStatusMaster'

const SMALL_VALUE_ASSET_LIMIT = 2000

const emptyForm = {
  name: '',
  category_id: '',
  tracking: 'individual',
  quantity: 1,
  low_stock_threshold: 0,
  cost: '',
  capitalization_date: '',
  condition: 'good',
  status: 'available',
  brand_model: '',
  serial_no: '',
  description: '',
  is_issuable: true,
  location_id: '',
  issued_to: '',
  incharge_name: '',
  incharge_phone: '',
  invoice_no: '',
  invoice_date: '',
  budget_type: '',
  budget_head: '',
}

const CUSTODY_FIELDS = [
  'location_id', 'issued_to', 'incharge_name', 'incharge_phone',
  'invoice_no', 'invoice_date', 'budget_type', 'budget_head',
]

function custodyPayload(form, emptyValue) {
  return Object.fromEntries(
    CUSTODY_FIELDS.map((key) => [key, String(form[key] ?? '').trim() || emptyValue])
  )
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : ''
}

export default function Assets() {
  usePageTitle('Assets')
  const { isAdmin } = useAuth()
  const { statuses, conditions, statusMeta, conditionMeta } = useStatusMaster()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [categoryTree, setCategoryTree] = useState([])
  const [locations, setLocations] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [qrInfo, setQrInfo] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await assetsApi.list({
        page,
        limit: 20,
        q: q || undefined,
        status: status || undefined,
        category_id: categoryId || undefined,
      })
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, q, status, categoryId])

  useEffect(() => {
    load()
  }, [load])

  useAutoRefresh(['assets'], () => {
    load()
  })

  useEffect(() => {
    categoriesApi
      .tree()
      .then((res) => setCategoryTree(res.data || []))
      .catch(() => setCategoryTree([]))
    locationsApi
      .list({ limit: 100 })
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]))
  }, [])

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (!isAssetCategoryLeaf(categoryTree, form.category_id)) {
      setError('Choose a Level 2 to 4 leaf sub-category before saving this asset.')
      return
    }
    setSaving(true)
    try {
      await assetsApi.create({
        name: form.name.trim(),
        category_id: form.category_id,
        tracking: form.tracking,
        quantity: Number(form.quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
        cost: form.cost !== '' ? Number(form.cost) : undefined,
        capitalization_date: form.capitalization_date || undefined,
        condition: form.condition,
        status: form.status,
        brand_model: form.brand_model.trim() || undefined,
        serial_no: form.serial_no.trim() || undefined,
        description: form.description.trim() || undefined,
        is_issuable: form.is_issuable,
        ...custodyPayload(form, undefined),
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
    setError('')
    if (!isAssetCategoryLeaf(categoryTree, form.category_id)) {
      setError('Choose a Level 2 to 4 leaf sub-category before saving this asset.')
      return
    }
    setSaving(true)
    try {
      await assetsApi.update(editItem.id, {
        name: form.name.trim(),
        category_id: form.category_id,
        tracking: form.tracking,
        quantity: Number(form.quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
        cost: form.cost !== '' ? Number(form.cost) : undefined,
        capitalization_date: form.capitalization_date || undefined,
        condition: form.condition,
        status: form.status,
        brand_model: form.brand_model.trim() || undefined,
        serial_no: form.serial_no.trim() || undefined,
        description: form.description.trim() || undefined,
        is_issuable: form.is_issuable,
        ...custodyPayload(form, null),
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
    if (!confirm('Delete this asset?')) return
    try {
      await assetsApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleExport() {
    try {
      const res = await assetsApi.export({
        format: 'csv',
        q: q || undefined,
        status: status || undefined,
        category_id: categoryId || undefined,
      })
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'assets-export.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleGenerateQr(id) {
    try {
      const res = await assetsApi.generateQr(id)
      setQrInfo(res.data)
    } catch (err) {
      setError(err.message)
    }
  }

  function openEdit(asset) {
    setEditItem(asset)
    setForm({
      name: asset.name || '',
      category_id: asset.category_id || '',
      tracking: asset.tracking || 'individual',
      quantity: asset.quantity ?? 1,
      low_stock_threshold: asset.low_stock_threshold ?? 0,
      cost: asset.cost != null ? String(asset.cost) : '',
      capitalization_date: asset.capitalization_date ? String(asset.capitalization_date).slice(0, 10) : '',
      condition: asset.condition || 'good',
      status: asset.status || 'available',
      brand_model: asset.brand_model || '',
      serial_no: asset.serial_no || '',
      description: asset.description || '',
      is_issuable: asset.is_issuable !== false,
      location_id: asset.location_id || '',
      issued_to: asset.issued_to || '',
      incharge_name: asset.incharge_name || '',
      incharge_phone: asset.incharge_phone || '',
      invoice_no: asset.invoice_no || '',
      invoice_date: formatDate(asset.invoice_date),
      budget_type: asset.budget_type || '',
      budget_head: asset.budget_head || '',
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Assets</h1>
          <p>Search, filter, and register equipment.</p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={handleExport}>
            Export CSV
          </button>
          {isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Add asset
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search assets…"
          value={q}
          onChange={(e) => {
            setPage(1)
            setQ(e.target.value)
          }}
        />
        <select
          className="select"
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
        </select>
        <CascadingCategoryPicker
          tree={categoryTree}
          value={categoryId}
          onChange={(id) => {
            setPage(1)
            setCategoryId(id)
          }}
          mode="any"
        />
      </div>

      <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={7} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="box"
              title="No assets found"
              description={isAdmin ? 'Add an asset to get started with inventory tracking.' : undefined}
              action={isAdmin ? { label: 'Add asset', onClick: () => { setForm(emptyForm); setShowCreate(true) } } : undefined}
            />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Location / Issued to</th>
                  <th scope="col">Status</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Tracking</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((asset) => (
                  <tr key={asset.id}>
                    <td data-label="Name" data-card-title>
                      <div>{asset.name}</div>
                      <div className="muted">
                        {asset.asset_tag || asset.brand_model || asset.id.slice(0, 8)}
                      </div>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {asset.category_path || asset.category_name || '—'}
                        {asset.category_is_legacy ? (
                          <span className="badge badge-warn" style={{ marginLeft: '0.4rem' }}>
                            Needs reclassification
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Location / Issued to">
                      <div>{asset.location_name || <span className="muted">—</span>}</div>
                      {asset.issued_to ? <div className="muted">{asset.issued_to}</div> : null}
                    </td>
                    <td data-label="Status">
                      <StatusBadge value={asset.status} meta={statusMeta(asset.status)} />
                    </td>
                    <td data-label="Condition">
                      <StatusBadge value={asset.condition} meta={conditionMeta(asset.condition)} />
                    </td>
                    <td data-label="Qty">{asset.quantity}</td>
                    <td className="muted" data-label="Tracking">{asset.tracking}</td>
                    <td data-actions>
                      <div className="row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailItem(asset)}>
                          Details
                        </button>
                        {isAdmin ? (
                          <>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(asset)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleGenerateQr(asset.id)}
                            >
                              QR
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(asset.id)}
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
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {showCreate || editItem ? (
        <Modal
          title={editItem ? 'Edit asset' : 'Add asset'}
          onClose={() => {
            setShowCreate(false)
            setEditItem(null)
            setForm(emptyForm)
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowCreate(false)
                  setEditItem(null)
                  setForm(emptyForm)
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form={editItem ? 'edit-asset' : 'create-asset'}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving…' : editItem ? 'Save' : 'Create'}
              </button>
            </>
          }
        >
          <form
            id={editItem ? 'edit-asset' : 'create-asset'}
            className="form"
            onSubmit={editItem ? handleUpdate : handleCreate}
          >
            {error ? <div className="error-banner" role="alert">{error}</div> : null}
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                required
              />
            </div>
            <CascadingCategoryPicker
              tree={categoryTree}
              value={form.category_id}
              onChange={(id) => updateForm('category_id', id)}
              mode="leaf"
              required
            />
            <div className="form-row">
              <div className="field">
                <label htmlFor="cost">Cost (₹)</label>
                <input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => updateForm('cost', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="capitalization_date">Capitalization date</label>
                <input
                  id="capitalization_date"
                  type="date"
                  value={form.capitalization_date}
                  onChange={(e) => updateForm('capitalization_date', e.target.value)}
                />
              </div>
            </div>
            {(() => {
              const selectedCat = form.category_id ? findCategoryNode(categoryTree, form.category_id) : null
              const costNum = form.cost !== '' ? Number(form.cost) : 0
              const rate = selectedCat?.effective_dep_rate_percent
              const estAnnual = rate != null && costNum > 0 ? Math.round((costNum * rate) / 100 * 100) / 100 : null
              return (
                <>
                  {costNum > 0 && costNum <= SMALL_VALUE_ASSET_LIMIT ? (
                    <div className="muted" style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                      Hint: Cost is ₹{SMALL_VALUE_ASSET_LIMIT.toLocaleString('en-IN')} or less (Small Value Asset threshold).
                    </div>
                  ) : null}
                  {rate != null && costNum > 0 ? (
                    <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      Effective depreciation rate: <strong>{rate}%</strong> — Est. annual depreciation:{' '}
                      <strong>₹{estAnnual.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  ) : null}
                </>
              )
            })()}
            <div className="form-row">
              <div className="field">
                <label htmlFor="tracking">Tracking</label>
                <select
                  id="tracking"
                  value={form.tracking}
                  onChange={(e) => updateForm('tracking', e.target.value)}
                >
                  <option value="individual">Individual</option>
                  <option value="quantity">Quantity</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="quantity">Quantity</label>
                <input
                  id="quantity"
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => updateForm('quantity', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="condition">Condition</label>
                <select
                  id="condition"
                  value={form.condition}
                  onChange={(e) => updateForm('condition', e.target.value)}
                >
                  {conditions.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  {form.condition && !conditionMeta(form.condition) ? <option value={form.condition}>{form.condition}</option> : null}
                </select>
              </div>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => updateForm('status', e.target.value)}
                >
                  {statuses.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                  {form.status && !statusMeta(form.status) ? <option value={form.status}>{form.status}</option> : null}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="brand_model">Brand / model</label>
                <input
                  id="brand_model"
                  value={form.brand_model}
                  onChange={(e) => updateForm('brand_model', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="serial_no">Serial no.</label>
                <input
                  id="serial_no"
                  value={form.serial_no}
                  onChange={(e) => updateForm('serial_no', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="location_id">Location</label>
                <select
                  id="location_id"
                  value={form.location_id}
                  onChange={(e) => updateForm('location_id', e.target.value)}
                >
                  <option value="">Not set</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="issued_to">Issued to</label>
                <input
                  id="issued_to"
                  value={form.issued_to}
                  onChange={(e) => updateForm('issued_to', e.target.value)}
                  placeholder="Person, lab or department"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="incharge_name">Person in-charge</label>
                <input
                  id="incharge_name"
                  value={form.incharge_name}
                  onChange={(e) => updateForm('incharge_name', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="incharge_phone">In-charge phone no.</label>
                <input
                  id="incharge_phone"
                  type="tel"
                  value={form.incharge_phone}
                  onChange={(e) => updateForm('incharge_phone', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="budget_type">Budget type</label>
                <select
                  id="budget_type"
                  value={form.budget_type}
                  onChange={(e) => updateForm('budget_type', e.target.value)}
                >
                  <option value="">Not specified</option>
                  {BUDGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="budget_head">Budget head / sponsor</label>
                <input
                  id="budget_head"
                  value={form.budget_head}
                  onChange={(e) => updateForm('budget_head', e.target.value)}
                  placeholder="Project, grant, sponsor or donor"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="invoice_no">Invoice number</label>
                <input
                  id="invoice_no"
                  value={form.invoice_no}
                  onChange={(e) => updateForm('invoice_no', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="invoice_date">Invoice date</label>
                <input
                  id="invoice_date"
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => updateForm('invoice_date', e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
            </div>
          </form>
        </Modal>
      ) : null}

      {detailItem ? (
        <Modal
          title={detailItem.name}
          onClose={() => setDetailItem(null)}
          footer={
            <button type="button" className="btn btn-ghost" onClick={() => setDetailItem(null)}>
              Close
            </button>
          }
        >
          <div className="form" style={{ gap: '0.65rem' }}>
            <div><strong>Category:</strong> {detailItem.category_path || detailItem.category_name || '—'}</div>
            <div><strong>Asset tag:</strong> {detailItem.asset_tag || '—'}</div>
            <div><strong>Location:</strong> {detailItem.location_name || '—'}</div>
            <div><strong>Issued to:</strong> {detailItem.issued_to || '—'}</div>
            <div>
              <strong>Person in-charge:</strong> {detailItem.incharge_name || '—'}
              {detailItem.incharge_phone ? ` (${detailItem.incharge_phone})` : ''}
            </div>
            <div>
              <strong>Budget:</strong> {detailItem.budget_type ? budgetTypeLabel(detailItem.budget_type) : '—'}
              {detailItem.budget_head ? ` — ${detailItem.budget_head}` : ''}
            </div>
            <div>
              <strong>Invoice:</strong> {detailItem.invoice_no || '—'}
              {detailItem.invoice_date ? ` dated ${formatDate(detailItem.invoice_date)}` : ''}
            </div>
            <div><strong>Status / Condition:</strong> {statusMeta(detailItem.status)?.label || detailItem.status} / {conditionMeta(detailItem.condition)?.label || detailItem.condition}</div>
            <div>
              <strong>Cost:</strong>{' '}
              {detailItem.cost != null ? `₹${Number(detailItem.cost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </div>
            <div>
              <strong>Capitalization date:</strong>{' '}
              {detailItem.capitalization_date ? String(detailItem.capitalization_date).slice(0, 10) : '—'}
            </div>
            <div>
              <strong>Depreciation rate:</strong>{' '}
              {detailItem.effective_dep_rate_percent != null ? `${detailItem.effective_dep_rate_percent}%` : '—'}
            </div>
            <div>
              <strong>Accumulated depreciation:</strong>{' '}
              {detailItem.accumulated_depreciation != null
                ? `₹${Number(detailItem.accumulated_depreciation).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </div>
            <div>
              <strong>Current book value:</strong>{' '}
              {detailItem.current_book_value != null
                ? `₹${Number(detailItem.current_book_value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </div>
          </div>
        </Modal>
      ) : null}

      {qrInfo ? (
        <Modal
          title="Asset QR token"
          onClose={() => setQrInfo(null)}
          footer={
            <button type="button" className="btn btn-ghost" onClick={() => setQrInfo(null)}>
              Close
            </button>
          }
        >
          <pre className="code-block">{JSON.stringify(qrInfo, null, 2)}</pre>
        </Modal>
      ) : null}
    </div>
  )
}
