import { useRef, useState } from 'react'
import { assetsApi } from '../api/client'
import { csvToRecords, toCsv } from '../csv'
import Modal from './Modal'

const MAX_ROWS = 2000

const TEMPLATE_HEADERS = [
  'Unique Number', 'Name', 'Category Code', 'Category Path', 'Tracking', 'Quantity', 'Cost',
  'Capitalization Date', 'Serial Number', 'Brand/Model', 'Condition', 'Status', 'Location',
  'Issued To', 'Person In-charge', 'In-charge Phone', 'Invoice No', 'Invoice Date',
  'Budget Type', 'Budget Head', 'Can Be Loaned', 'Description',
]

const TEMPLATE_EXAMPLE = [
  '', 'Dell OptiPlex 7010', '', 'Computers and Peripherals > Desktops', 'individual', '1', '65000',
  '2026-04-01', 'SN12345', 'Dell OptiPlex 7010', 'Good', 'Available', '',
  'Robotics Lab', 'Dr. A. Kumar', '9876543210', 'INV-2026-001', '01/04/2026',
  'Institute budget', '', 'No', 'Leave Unique Number blank to auto-generate',
]

function downloadTemplate() {
  const blob = new Blob([toCsv([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE])], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'asset-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportAssetsModal({ onClose, onImported }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null) // { name, headers, records }
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function readFile(f) {
    setError('')
    setResult(null)
    if (!f) return
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') {
      setError('Please choose a .csv file (in Excel: File → Save As → CSV UTF-8).')
      return
    }
    try {
      const { headers, records } = csvToRecords(await f.text())
      if (records.length === 0) {
        setError('That file has no data rows below the header line.')
        return
      }
      if (records.length > MAX_ROWS) {
        setError(`That file has ${records.length} rows; import at most ${MAX_ROWS} at a time.`)
        return
      }
      setFile({ name: f.name, headers, records })
    } catch (err) {
      setError(`Could not read the file: ${err.message}`)
    }
  }

  async function submit(dryRun) {
    setBusy(true)
    setError('')
    try {
      const res = await assetsApi.importRows(file.records, dryRun)
      setResult(res.data)
      if (res.data.committed) onImported?.(res.data)
    } catch (err) {
      if (err.status === 422 && err.payload?.data) setResult(err.payload.data)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const committed = result?.committed
  const hasErrors = result?.errors?.length > 0

  return (
    <Modal
      title="Import items from CSV"
      size="lg"
      onClose={onClose}
      footer={
        committed ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-ghost" disabled={!file || busy} onClick={() => submit(true)}>
              {busy ? 'Checking…' : 'Check file'}
            </button>
            <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={() => submit(false)}>
              {busy ? 'Importing…' : `Import ${file ? file.records.length : ''} rows`}
            </button>
          </>
        )
      }
    >
      <div className="form">
        {error ? <div className="error-banner" role="alert">{error}</div> : null}

        {!committed ? (
          <div
            role="button"
            tabIndex={0}
            className={`drop-zone${dragging ? ' drop-zone-active' : ''}`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              readFile(e.dataTransfer.files?.[0])
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = '' }}
            />
            {file ? (
              <>
                <strong>{file.name}</strong>
                <div className="muted">{file.records.length} rows · {file.headers.length} columns — drop another file to replace</div>
              </>
            ) : (
              <>
                <strong>Drag and drop a CSV file here</strong>
                <div className="muted">or click to choose a file</div>
              </>
            )}
          </div>
        ) : null}

        {!file && !committed ? (
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Columns are matched by name, so a file exported from the Assets page works as-is.
            Each row needs a <strong>Name</strong> and a category, given as <strong>Category Code</strong>
            (e.g. 12-01), <strong>Category Path</strong> (Broad group &gt; Main &gt; Sub &gt; Item master), or the
            last-level category name. Leave <strong>Unique Number</strong> blank to auto-generate it. Nothing is
            saved unless every row is valid.{' '}
            <button type="button" className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
              Download template
            </button>
          </div>
        ) : null}

        {file && !result ? (
          <div className="table-wrap" style={{ maxHeight: '16rem', overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  {file.headers.slice(0, 6).map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {file.records.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td className="muted">{i + 2}</td>
                    {file.headers.slice(0, 6).map((h) => <td key={h}>{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {file.records.length > 8 ? (
              <div className="muted" style={{ padding: '0.4rem' }}>…and {file.records.length - 8} more rows</div>
            ) : null}
          </div>
        ) : null}

        {result ? (
          hasErrors ? (
            <>
              <div className="error-banner" role="alert">
                {result.errors.length} row(s) have problems — nothing was saved. Fix them in the file and drop it again.
              </div>
              <div className="table-wrap" style={{ maxHeight: '18rem', overflow: 'auto' }}>
                <table>
                  <thead><tr><th>Row</th><th>Problem</th></tr></thead>
                  <tbody>
                    {result.errors.map((e) => (
                      <tr key={`${e.row}-${e.error}`}>
                        <td>{e.row}</td>
                        <td>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : committed ? (
            <div className="success-banner" role="status">
              Imported {result.valid_rows} item(s).
              {result.skipped_blank_rows ? ` Skipped ${result.skipped_blank_rows} blank row(s).` : ''}
            </div>
          ) : (
            <div className="success-banner" role="status">
              All {result.valid_rows} row(s) look good. Click Import to save them.
            </div>
          )
        ) : null}
      </div>
    </Modal>
  )
}
