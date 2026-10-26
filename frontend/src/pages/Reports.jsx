import { useState } from 'react'
import { reportsApi } from '../api/client'
import EmptyState from '../components/EmptyState'
import { SkeletonTable } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import { useFetch } from '../hooks/useFetch'
import { usePageTitle } from '../hooks/usePageTitle'

const TABS = [
  { id: 'inventory',   label: 'Inventory' },
  { id: 'borrowing',   label: 'Borrowing' },
  { id: 'overdue',     label: 'Overdue' },
  { id: 'maintenance', label: 'Maintenance costs' },
  { id: 'utilization', label: 'Utilization' },
]

function CssBar({ label, value, max, formatter = (v) => v }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="css-bar-row">
      <span className="css-bar-label">{label}</span>
      <div className="css-bar-track">
        <div className="css-bar-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
      <span className="css-bar-value">{formatter(value)}</span>
    </div>
  )
}

function downloadCsv(data, filename) {
  if (!data?.length) return
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map((r) => Object.values(r).map((v) => JSON.stringify(v ?? '')).join(',')).join('\n')
  const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  usePageTitle('Reports')
  const toast = useToast()
  const [tab, setTab] = useState('inventory')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const params = {
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo   ? { date_to: dateTo }     : {}),
  }

  const { data, loading, error } = useFetch(() => {
    switch (tab) {
      case 'inventory':   return reportsApi.assetInventory(params)
      case 'borrowing':   return reportsApi.borrowingHistory(params)
      case 'overdue':     return reportsApi.overdueLoans(params)
      case 'maintenance': return reportsApi.maintenanceCosts(params)
      case 'utilization': return reportsApi.assetUtilization(params)
      default:            return Promise.resolve({ data: [] })
    }
  }, [tab, dateFrom, dateTo])

  if (error) toast.error(error)

  const rows = data?.data ?? data ?? []
  const maxVal = rows.length
    ? Math.max(...rows.map((r) => r.total_count ?? r.count ?? r.total ?? 0))
    : 0

  function handleExport() {
    if (!rows.length) { toast.warn('No data to export'); return }
    downloadCsv(rows, `${tab}-report.csv`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Analytics and exports for inventory management.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={handleExport}>
          Export CSV
        </button>
      </div>

      <div className="toolbar">
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
          <label htmlFor="date-from" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 600 }}>From</label>
          <input
            id="date-from"
            type="date"
            className="search-input"
            style={{ width: 'auto' }}
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
          <label htmlFor="date-to" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 600 }}>To</label>
          <input
            id="date-to"
            type="date"
            className="search-input"
            style={{ width: 'auto' }}
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {(dateFrom || dateTo) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo('') }}>
            Clear dates
          </button>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon="bar-chart-2" title="No data" description="Try adjusting the date range or check back later." />
      ) : (
        <>
          {maxVal > 0 && (
            <div className="panel" style={{ marginBottom: '1.5rem' }}>
              <div className="panel-header"><h2>Summary chart</h2></div>
              <div style={{ padding: '1rem 0' }}>
                {rows.slice(0, 15).map((row, i) => {
                  const label = row.name ?? row.category_name ?? row.borrower_name ?? row.asset_name ?? `Row ${i + 1}`
                  const value = row.total_count ?? row.count ?? row.total ?? 0
                  return <CssBar key={i} label={label} value={value} max={maxVal} />
                })}
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((k) => (
                    <th scope="col" key={k}>{k.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => (
                      <td key={j}>{v == null ? '—' : String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
