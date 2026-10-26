import Icon from './Icon'

export default function EmptyState({
  icon = 'inbox',
  title = 'Nothing here yet',
  description,
  action,
  message, // backward compat
}) {
  const displayTitle = title !== 'Nothing here yet' ? title : (message || title)
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} size={40} />
      </div>
      <p className="empty-state-title">{displayTitle}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
