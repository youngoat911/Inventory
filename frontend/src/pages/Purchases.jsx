import { useCallback, useEffect, useState } from 'react'
import { orgUnitsApi, purchasesApi, vendorsApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../auth/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

const emptyForm = {
  purchase_order_no: '',
  vendor_id: '',
  org_unit_id: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  total_amount: '',
  tax_amount: 0,
  shipping_cost: 0,
  other_charges: 0,
  payment_status: 'pending',
  notes: '',
}

export default function Purchases() {
  usePageTitle('Purchases')
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [vendors, setVendors] = useState([])
  const [orgs, setOrgs] = useState([])
  const [page, setPage] = useState(1)
  const [paymentStatus, setPaymentStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailItems, setDetailItems] = useState([])
  const [itemForm, setItemForm] = useState({ description: '', quantity: 1, unit_price: '' })
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await purchasesApi.list({
        page,
        limit: 20,
        payment_status: paymentStatus || undefined,
      })
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, paymentStatus])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    Promise.all([
      vendorsApi.list({ limit: 100 }).catch(() => ({ data: [] })),
      orgUnitsApi.list({ limit: 100 }).catch(() => ({ data: [] })),
    ]).then(([v, o]) => {
      setVendors(v.data || [])
      setOrgs(o.data || [])
    })
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await purchasesApi.create({
        purchase_order_no: form.purchase_order_no.trim(),
        vendor_id: form.vendor_id,
        org_unit_id: form.org_unit_id,
        purchase_date: form.purchase_date,
        total_amount: Number(form.total_amount),
        tax_amount: Number(form.tax_amount) || 0,
        shipping_cost: Number(form.shipping_cost) || 0,
        other_charges: Number(form.other_charges) || 0,
        payment_status: form.payment_status,
        notes: form.notes.trim() || undefined,
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

  async function openDetail(purchase) {
    setDetail(purchase)
    setError('')
    try {
      const res = await purchasesApi.getItems(purchase.id)
      setDetailItems(res.data || [])
    } catch (err) {
      setError(err.message)
      setDetailItems([])
    }
  }

  async function handleAddItem(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await purchasesApi.addItem(detail.id, {
        description: itemForm.description.trim(),
        quantity: Number(itemForm.quantity),
        unit_price: Number(itemForm.unit_price),
      })
      setItemForm({ description: '', quantity: 1, unit_price: '' })
      const res = await purchasesApi.getItems(detail.id)
      setDetailItems(res.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteItem(itemId) {
    if (!confirm('Remove this line item?')) return
    try {
      await purchasesApi.removeItem(detail.id, itemId)
      const res = await purchasesApi.getItems(detail.id)
      setDetailItems(res.data || [])
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this purchase?')) return
    try {
      await purchasesApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Purchases</h1>
          <p>Purchase orders and line items.</p>
        </div>
        {isAdmin ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            New purchase
          </button>
        ) : null}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="tabs">
        {[
          ['', 'All'],
          ['pending', 'Pending'],
          ['partial', 'Partial'],
          ['paid', 'Paid'],
        ].map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            className={`tab ${paymentStatus === value ? 'active' : ''}`}
            onClick={() => {
              setPage(1)
              setPaymentStatus(value)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="shopping-cart"
              title="No purchases yet"
              description="Record purchases to track equipment orders."
              action={isAdmin ? { label: 'New purchase', onClick: () => { setForm(emptyForm); setShowCreate(true) } } : undefined}
            />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">PO no.</th>
                  <th scope="col">Date</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="PO no." data-card-title>
                      <div>{item.purchase_order_no}</div>
                      <div className="muted">{item.vendor_name || item.vendor_id?.slice(0, 8)}</div>
                    </td>
                    <td className="muted" data-label="Date">{item.purchase_date}</td>
                    <td data-label="Amount">{item.grand_total ?? item.total_amount}</td>
                    <td data-label="Payment">
                      <StatusBadge value={item.payment_status} />
                    </td>
                    <td data-actions>
                      <div className="row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDetail(item)}>
                          Items
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </button>
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

      {showCreate && isAdmin ? (
        <Modal
          title="New purchase"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" form="create-purchase" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
              </button>
            </>
          }
        >
          <form id="create-purchase" className="form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="purchase_order_no">PO number</label>
              <input
                id="purchase_order_no"
                value={form.purchase_order_no}
                onChange={(e) => setForm((p) => ({ ...p, purchase_order_no: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="vendor_id">Vendor</label>
              <select
                id="vendor_id"
                value={form.vendor_id}
                onChange={(e) => setForm((p) => ({ ...p, vendor_id: e.target.value }))}
                required
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="org_unit_id">Org unit</label>
              <select
                id="org_unit_id"
                value={form.org_unit_id}
                onChange={(e) => setForm((p) => ({ ...p, org_unit_id: e.target.value }))}
                required
              >
                <option value="">Select org unit</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="purchase_date">Purchase date</label>
                <input
                  id="purchase_date"
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm((p) => ({ ...p, purchase_date: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="total_amount">Total amount</label>
                <input
                  id="total_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.total_amount}
                  onChange={(e) => setForm((p) => ({ ...p, total_amount: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="payment_status">Payment status</label>
              <select
                id="payment_status"
                value={form.payment_status}
                onChange={(e) => setForm((p) => ({ ...p, payment_status: e.target.value }))}
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </form>
        </Modal>
      ) : null}

      {detail ? (
        <Modal
          title={`Items — ${detail.purchase_order_no}`}
          onClose={() => setDetail(null)}
          footer={
            <button type="button" className="btn btn-ghost" onClick={() => setDetail(null)}>
              Close
            </button>
          }
        >
          {isAdmin ? (
            <form className="form" onSubmit={handleAddItem}>
            <div className="field">
              <label htmlFor="item_description">Description</label>
              <input
                id="item_description"
                value={itemForm.description}
                onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="item_qty">Qty</label>
                <input
                  id="item_qty"
                  type="number"
                  min="1"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((p) => ({ ...p, quantity: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="item_price">Unit price</label>
                <input
                  id="item_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.unit_price}
                  onChange={(e) => setItemForm((p) => ({ ...p, unit_price: e.target.value }))}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add item'}
            </button>
            </form>
          ) : null}
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            {detailItems.length === 0 ? (
              <EmptyState message="No line items yet." />
            ) : (
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {detailItems.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Description" data-card-title>{row.description}</td>
                      <td data-label="Qty">{row.quantity}</td>
                      <td data-label="Unit">{row.unit_price}</td>
                      <td data-actions>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteItem(row.id)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
