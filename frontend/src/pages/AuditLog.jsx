import { useCallback, useEffect, useState } from 'react'
import { auditLogApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import StatusBadge from '../components/StatusBadge'
import { usePageTitle } from '../hooks/usePageTitle'

export default function AuditLog() {
  usePageTitle('Audit Log')
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 })
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [tableName, setTableName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await auditLogApi.list({
        page,
        limit: 20,
        action: action || undefined,
        table_name: tableName || undefined,
      })
      setItems(res.data || [])
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, pages: 1 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, action, tableName])

  useEffect(() => {
    load()
  }, [load])

  async function openDetail(id) {
    try {
      const res = await auditLogApi.get(id)
      setDetail(res.data)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit log</h1>
          <p>Track creates, updates, and deletes.</p>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Table name…"
          value={tableName}
          onChange={(e) => {
            setPage(1)
            setTableName(e.target.value)
          }}
        />
        <select
          className="select"
          value={action}
          onChange={(e) => {
            setPage(1)
            setAction(e.target.value)
          }}
        >
          <option value="">All actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
      </div>

      <div className="panel">
        <div className="table-wrap">
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : items.length === 0 ? (
            <EmptyState icon="scroll-text" title="No audit entries" description="Changes and administrative actions will be recorded here." />
          ) : (
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Table</th>
                  <th scope="col">Action</th>
                  <th scope="col">Record</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="muted" data-label="When" data-card-title>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                    </td>
                    <td data-label="Table">{item.table_name}</td>
                    <td data-label="Action">
                      <StatusBadge value={item.action} />
                    </td>
                    <td className="muted" data-label="Record">{item.record_id?.slice(0, 8) || '—'}</td>
                    <td data-actions>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDetail(item.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {detail ? (
        <Modal
          title="Audit entry"
          onClose={() => setDetail(null)}
          footer={
            <button type="button" className="btn btn-ghost" onClick={() => setDetail(null)}>
              Close
            </button>
          }
        >
          <div className="form">
            <div className="field">
              <label>Table</label>
              <div>{detail.table_name}</div>
            </div>
            <div className="field">
              <label>Action</label>
              <div>{detail.action}</div>
            </div>
            <div className="field">
              <label>Old data</label>
              <pre className="code-block">{JSON.stringify(detail.old_data, null, 2)}</pre>
            </div>
            <div className="field">
              <label>New data</label>
              <pre className="code-block">{JSON.stringify(detail.new_data, null, 2)}</pre>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
