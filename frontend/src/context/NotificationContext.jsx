// frontend/src/context/NotificationContext.jsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, getToken, qs } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './ToastContext'

const NotificationContext = createContext(null)

function getWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }

  const apiBase = import.meta.env.VITE_API_URL
  if (apiBase) {
    const wsBase = apiBase.replace(/^http(s?):/, 'ws$1:')
    return `${wsBase.replace(/\/+$/, '')}/ws`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  const toast = useToast()

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [connected, setConnected] = useState(false)

  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)

  // Fetch initial notifications from REST API
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await api(`/notifications${qs({ limit: 30 })}`)
      const list = res.data || []
      setNotifications(list)
      setUnreadCount(list.filter((n) => !n.is_read).length)
    } catch {
      // Ignore background fetch errors
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [isAuthenticated, fetchNotifications])

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'POST', body: {} })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // Ignore error
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api('/notifications/read-all', { method: 'POST', body: {} })
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (err) {
      toast.error(err.message || 'Failed to mark notifications read')
    }
  }, [toast])

  // Connect and manage WebSocket lifecycle
  useEffect(() => {
    if (!isAuthenticated) {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
      return undefined
    }

    let isDisposed = false

    function connect() {
      if (isDisposed) return

      const token = getToken()
      if (!token) return

      try {
        const baseUrl = getWebSocketUrl()
        const wsUrl = `${baseUrl}?token=${encodeURIComponent(token)}`

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (isDisposed) {
            ws.close()
            return
          }
          setConnected(true)
          reconnectAttemptsRef.current = 0
        }

        ws.onmessage = (event) => {
          if (isDisposed) return
          try {
            const message = JSON.parse(event.data)

            // Handle incoming real-time notification
            if (message.type === 'NOTIFICATION' && message.data) {
              const newNotification = message.data
              setNotifications((prev) => [newNotification, ...prev.slice(0, 49)])
              setUnreadCount((c) => c + 1)

              // Show toast banner alert to user
              toast.info(
                `${newNotification.title}: ${newNotification.message}`
              )
            }

            // Handle real-time entity change event
            if (message.type === 'ENTITY_CHANGED') {
              window.dispatchEvent(
                new CustomEvent('inventory:change', {
                  detail: message,
                })
              )
            }
          } catch (e) {
            // Ignore parse errors
          }
        }

        ws.onclose = () => {
          if (isDisposed) return
          setConnected(false)
          wsRef.current = null

          // Exponential backoff reconnect
          const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 15000)
          reconnectAttemptsRef.current += 1
          reconnectTimeoutRef.current = setTimeout(connect, delay)
        }

        ws.onerror = () => {
          ws.close()
        }
      } catch {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 15000)
        reconnectAttemptsRef.current += 1
        reconnectTimeoutRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      isDisposed = true
      clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
    }
  }, [isAuthenticated, toast])

  const value = {
    notifications,
    unreadCount,
    connected,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return ctx
}

