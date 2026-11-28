import { budgetTypeLabel } from '../constants'
import { namedCategoryLevels } from '../categoryTree'
import StatusBadge from './StatusBadge'

const money = (v) =>
  v != null
    ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
const date = (v) => (v ? String(v).slice(0, 10) : '—')

function Section({ title, rows }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      <dl className="detail-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === null || value === undefined || value === '' ? '—' : value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Read-only view of an asset, grouped the same way as the edit form. */
export default function AssetDetails({ asset, statusMeta, conditionMeta }) {
  const levels = namedCategoryLevels(asset.category_path)
  return (
    <div className="detail-sections">
      <Section
        title="Item"
        rows={[
          ['Unique number', asset.asset_tag],
          ...(levels.length ? levels.map((l) => [l.label, l.name]) : [['Category', asset.category_name]]),
          ['Brand / model', asset.brand_model],
          ['Serial no.', asset.serial_no],
        ]}
      />
      <Section
        title="Stock & status"
        rows={[
          ['Status', <StatusBadge key="s" value={asset.status} meta={statusMeta(asset.status)} />],
          ['Condition', <StatusBadge key="c" value={asset.condition} meta={conditionMeta(asset.condition)} />],
          ['Quantity', `${asset.quantity}${asset.tracking === 'quantity' ? ' (bulk)' : ''}`],
          ['Can be loaned', asset.is_issuable ? 'Yes' : 'No'],
        ]}
      />
      <Section
        title="Location & custody"
        rows={[
          ['Location', asset.location_name],
          ['Owner', asset.owner_org_name],
          ['Issued to', asset.issued_to],
          ['Person in-charge', asset.incharge_name],
          ['In-charge phone', asset.incharge_phone ? <a key="p" href={`tel:${asset.incharge_phone}`}>{asset.incharge_phone}</a> : null],
        ]}
      />
      <Section
        title="Purchase & budget"
        rows={[
          ['Cost', money(asset.cost)],
          ['Capitalization date', date(asset.capitalization_date)],
          ['Invoice', asset.invoice_no],
          ['Invoice date', asset.invoice_date ? date(asset.invoice_date) : null],
          ['Budget type', asset.budget_type ? budgetTypeLabel(asset.budget_type) : null],
          ['Budget head', asset.budget_head],
        ]}
      />
      <Section
        title="Depreciation"
        rows={[
          ['Rate', asset.effective_dep_rate_percent != null ? `${asset.effective_dep_rate_percent}%` : null],
          ['Accumulated', money(asset.accumulated_depreciation)],
          ['Book value', money(asset.current_book_value)],
        ]}
      />
      {asset.description ? (
        <section className="detail-section">
          <h3>Notes</h3>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{asset.description}</p>
        </section>
      ) : null}
    </div>
  )
}
