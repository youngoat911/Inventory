import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const addToast = useCallback((type, message, duration = 5000) => {
    const id = ++toastId
    setToasts((prev) => [...prev.slice(-4), { id, type, message }])
    timers.current[id] = setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const pause = useCallback((id) => clearTimeout(timers.current[id]), [])
  const resume = useCallback((id, duration = 3000) => {
    timers.current[id] = setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const toast = {
    success: (msg, d) => addToast('success', msg, d),
    error:   (msg, d) => addToast('error', msg, d),
    info:    (msg, d) => addToast('info', msg, d),
    warn:    (msg, d) => addToast('warn', msg, d),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role={t.type === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
          >
            <span className="toast-message">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
