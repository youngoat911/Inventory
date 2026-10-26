const STATUS_CONFIG = {
  available:      { color: 'ok',      dot: true },
  active:         { color: 'ok',      dot: true },
  issued:         { color: 'info',    dot: true },
  approved:       { color: 'ok',      dot: true },
  completed:      { color: 'ok',      dot: false },
  resolved:       { color: 'ok',      dot: false },
  returned:       { color: 'ok',      dot: false },
  requested:      { color: 'info',    dot: true },
  pending:        { color: 'info',    dot: true },
  in_transit:     { color: 'info',    dot: true },
  in_maintenance: { color: 'warn',    dot: true },
  overdue:        { color: 'danger',  dot: true },
  rejected:       { color: 'danger',  dot: false },
  cancelled:      { color: 'danger',  dot: false },
  disposed:       { color: 'danger',  dot: false },
  lost:           { color: 'danger',  dot: false },
  blocked:        { color: 'danger',  dot: true },
  reserved:       { color: 'warn',    dot: true },
  low:            { color: 'warn',    dot: false },
  high:           { color: 'danger',  dot: false },
  critical:       { color: 'danger',  dot: true },
  info:           { color: 'info',    dot: false },
  warning:        { color: 'warn',    dot: false },
  error:          { color: 'danger',  dot: false },
  success:        { color: 'ok',      dot: false },
  excellent:      { color: 'ok',      dot: false },
  good:           { color: 'ok',      dot: false },
  fair:           { color: 'warn',    dot: false },
  poor:           { color: 'danger',  dot: false },
  damaged:        { color: 'danger',  dot: false },
}

export default function StatusBadge({ value }) {
  if (!value) return <span className="muted">—</span>
  const key = String(value).toLowerCase().replace(/[\s-]+/g, '_')
  const cfg = STATUS_CONFIG[key] || {}
  const label = String(value).replace(/_/g, ' ')
  return (
    <span className={`badge badge-${cfg.color || 'neutral'}`} data-status={key}>
      {cfg.dot && <span className="badge-dot" aria-hidden="true" />}
      {label}
    </span>
  )
}
