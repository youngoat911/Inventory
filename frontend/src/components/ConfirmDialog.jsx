import { useEffect, useRef } from 'react'

/**
 * Accessible confirm dialog using native <dialog>.
 * Props: title, message, confirmLabel, confirmVariant ('danger'|'primary'), onConfirm, onCancel
 */
export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) el.showModal()
    return () => { if (el?.open) el.close() }
  }, [])

  function handleBackdrop(e) {
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    const outside =
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top  || e.clientY > rect.bottom
    if (outside) onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onClose={onCancel}
      onClick={handleBackdrop}
      aria-labelledby="cd-title"
      aria-describedby={message ? 'cd-msg' : undefined}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <h2 id="cd-title" className="confirm-dialog-title">{title}</h2>
        {message && <p id="cd-msg" className="confirm-dialog-message">{message}</p>}
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-${confirmVariant}`}
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
