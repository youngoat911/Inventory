/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), embedded
 * commas/newlines, CRLF line endings and a UTF-8 BOM. Returns rows of strings.
 */
export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

/** Parse CSV text into { headers, records } where records are objects keyed by header. */
export function csvToRecords(text) {
  const [headerRow, ...dataRows] = parseCsv(text)
  if (!headerRow) return { headers: [], records: [] }
  const headers = headerRow.map((h) => h.trim())
  const records = dataRows.map((cells) =>
    Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]).filter(([h]) => h))
  )
  return { headers, records }
}

export function toCsv(rows) {
  return rows
    .map((r) => r.map((cell) => {
      const s = String(cell ?? '')
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','))
    .join('\r\n')
}
