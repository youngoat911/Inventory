import { useCallback, useEffect, useState } from 'react'
import { assetsApi, categoriesApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const emptyForm = {
  name: '',
  category_id: '',
  tracking: 'individual',
  quantity: 1,
  low_stock_threshold: 0,
  condition: 'good',
  status: 'available',
  brand_model: '',
  serial_no: '',
  description: '',
  is_issuable: true,
}

export default function Assets() {
  usePageTitle('Assets')
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [categories, setCategories] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState(null)
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
      })
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, q, status])

  useEffect(() => {
    load()
  }, [load])

  useAutoRefresh(['assets'], () => {
    load()
  })

  useEffect(() => {
    categoriesApi
      .list({ limit: 100 })
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]))
  }, [])

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await assetsApi.create({
        name: form.name.trim(),
        category_id: form.category_id,
        tracking: form.tracking,
        quantity: Number(form.quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
        condition: form.condition,
        status: form.status,
        brand_model: form.brand_model.trim() || undefined,
        serial_no: form.serial_no.trim() || undefined,
        description: form.description.trim() || undefined,
        is_issuable: form.is_issuable,
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
      await assetsApi.update(editItem.id, {
        name: form.name.trim(),
        category_id: form.category_id,
        tracking: form.tracking,
        quantity: Number(form.quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
        condition: form.condition,
        status: form.status,
        brand_model: form.brand_model.trim() || undefined,
        serial_no: form.serial_no.trim() || undefined,
        description: form.description.trim() || undefined,
        is_issuable: form.is_issuable,
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
      condition: asset.condition || 'good',
      status: asset.status || 'available',
      brand_model: asset.brand_model || '',
      serial_no: asset.serial_no || '',
      description: asset.description || '',
      is_issuable: asset.is_issuable !== false,
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
          <option value="available">Available</option>
          <option value="issued">Issued</option>
          <option value="in_maintenance">In maintenance</option>
          <option value="reserved">Reserved</option>
          <option value="disposed">Disposed</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={6} />
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
                    </td>
                    <td data-label="Status">
                      <StatusBadge value={asset.status} />
                    </td>
                    <td data-label="Condition">
                      <StatusBadge value={asset.condition} />
                    </td>
                    <td data-label="Qty">{asset.quantity}</td>
                    <td className="muted" data-label="Tracking">{asset.tracking}</td>
                    <td data-actions>
                      <div className="row-actions">
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
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="category_id">Category</label>
              <select
                id="category_id"
                value={form.category_id}
                onChange={(e) => updateForm('category_id', e.target.value)}
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {categories.length === 0 ? (
                <span className="muted">Create a category under Catalog first.</span>
              ) : null}
            </div>
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
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="damaged">Damaged</option>
                  <option value="under_repair">Under repair</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => updateForm('status', e.target.value)}
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="issued">Issued</option>
                  <option value="in_maintenance">In maintenance</option>
                  <option value="disposed">Disposed</option>
                  <option value="lost">Lost</option>
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
