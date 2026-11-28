const TOKEN_KEY = 'gi_access_token'
const REFRESH_KEY = 'gi_refresh_token'
const USER_KEY = 'gi_user'

// Use VITE_API_URL from .env if set, otherwise fall back to empty string (relative URLs for dev proxy)
const API_BASE = import.meta.env.VITE_API_URL || ''

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession({ token, refresh_token, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

function paginationFromMeta(meta = {}) {
  if (meta.pagination) return meta.pagination
  return {
    page: meta.page ?? 1,
    limit: meta.limit ?? 20,
    total: meta.total ?? 0,
    pages: meta.pages ?? 1,
  }
}

export function qs(params = {}) {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  ).toString()
  return q ? `?${q}` : ''
}

async function refreshAccessToken() {
  const refresh_token = getRefreshToken()
  if (!refresh_token) return null

  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  })

  if (!res.ok) {
    clearSession()
    return null
  }

  const data = await res.json()
  setSession({
    token: data.token,
    refresh_token: data.refresh_token,
    user: getStoredUser(),
  })
  return data.token
}

export async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const opts = {
    method,
    headers: { ...headers },
  }

  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }

  if (auth) {
    const token = getToken()
    if (token) opts.headers.Authorization = `Bearer ${token}`
  }

  let res = await fetch(`${API_BASE}/api/v1${path}`, opts)

  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      opts.headers.Authorization = `Bearer ${newToken}`
      res = await fetch(`${API_BASE}/api/v1${path}`, opts)
    }
  }

  if (res.status === 204) return { data: null }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('text/csv')) {
    const text = await res.text()
    if (!res.ok) {
      const err = new Error(`Request failed (${res.status})`)
      err.status = res.status
      throw err
    }
    return { data: text, csv: true }
  }

  const payload = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(payload?.error?.message || `Request failed (${res.status})`)
    err.status = res.status
    err.code = payload?.error?.code
    err.details = payload?.error?.details || []
    throw err
  }

  if (Array.isArray(payload.data)) {
    return {
      data: payload.data,
      pagination: paginationFromMeta(payload.meta || {}),
    }
  }

  return payload
}

export const authApi = {
  login: (email, password) =>
    api('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (body) =>
    api('/auth/register', { method: 'POST', body, auth: false }),
  logout: (refresh_token) =>
    api('/auth/logout', { method: 'POST', body: { refresh_token }, auth: false }),
  forgotPassword: (email) =>
    api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token, password) =>
    api('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),
  me: () => api('/users/me'),
}

export const usersApi = {
  list: (params = {}) => api(`/users${qs(params)}`),
  get: (id) => api(`/users/${id}`),
  create: (body) => api('/users', { method: 'POST', body }),
  update: (id, body) => api(`/users/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/users/${id}`, { method: 'DELETE' }),
  listRoles: (userId) => api(`/users/${userId}/roles`),
  addRole: (userId, body) => api(`/users/${userId}/roles`, { method: 'POST', body }),
  updateRole: (userId, roleId, body) =>
    api(`/users/${userId}/roles/${roleId}`, { method: 'PATCH', body }),
  removeRole: (userId, roleId) =>
    api(`/users/${userId}/roles/${roleId}`, { method: 'DELETE' }),
}

export const assetsApi = {
  list: (params = {}) => api(`/assets${qs(params)}`),
  get: (id) => api(`/assets/${id}`),
  create: (body) => api('/assets', { method: 'POST', body }),
  batchCreate: (assets) => api('/assets/batch-create', { method: 'POST', body: { assets } }),
  update: (id, body) => api(`/assets/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/assets/${id}`, { method: 'DELETE' }),
  export: (params = {}) => api(`/assets/export${qs(params)}`),
  resolveQr: (qrToken) => api(`/assets/qr/${encodeURIComponent(qrToken)}`),
  generateQr: (id) => api(`/assets/${id}/qr`, { method: 'POST', body: {} }),
}

export const issuesApi = {
  list: (params = {}) => api(`/issues${qs(params)}`),
  overdue: () => api('/issues/overdue'),
  dropped: () => api('/issues/dropped'),
  get: (id) => api(`/issues/${id}`),
  create: (body) => api('/issues', { method: 'POST', body }),
  update: (id, body) => api(`/issues/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/issues/${id}`, { method: 'DELETE' }),
  issue: (id, body = {}) => api(`/issues/${id}/issue`, { method: 'POST', body }),
  drop: (id, body) => api(`/issues/${id}/drop`, { method: 'POST', body }),
  receive: (id, body) => api(`/issues/${id}/receive`, { method: 'POST', body }),
  return: (id, body) => api(`/issues/${id}/return`, { method: 'POST', body }),
  cancel: (id, body) => api(`/issues/${id}/cancel`, { method: 'POST', body }),
  renew: (id, body = {}) => api(`/issues/${id}/renew`, { method: 'POST', body }),
}

export const alertsApi = {
  list: (params = {}) => api(`/alerts${qs(params)}`),
  summary: (params = {}) => api(`/alerts/summary${qs(params)}`),
  get: (id) => api(`/alerts/${id}`),
  create: (body) => api('/alerts', { method: 'POST', body }),
  update: (id, body) => api(`/alerts/${id}`, { method: 'PATCH', body }),
  generate: () => api('/alerts/generate', { method: 'POST', body: {} }),
  autoResolve: () => api('/alerts/auto-resolve', { method: 'POST', body: {} }),
  acknowledge: (id, body = {}) => api(`/alerts/${id}/acknowledge`, { method: 'POST', body }),
  resolve: (id, body = {}) => api(`/alerts/${id}/resolve`, { method: 'POST', body }),
  dismiss: (id) => api(`/alerts/${id}/dismiss`, { method: 'POST', body: {} }),
}

export const dashboardApi = {
  summary: () => api('/dashboard/summary'),
  org: (orgId) => api(`/dashboard/org/${orgId}`),
}

export const reportsApi = {
  assetInventory: (params = {}) => api(`/reports/asset-inventory${qs(params)}`),
  borrowingHistory: (params = {}) => api(`/reports/borrowing-history${qs(params)}`),
  overdueLoans: (params = {}) => api(`/reports/overdue-loans${qs(params)}`),
  maintenanceCosts: (params = {}) => api(`/reports/maintenance-costs${qs(params)}`),
  disposalSummary: (params = {}) => api(`/reports/disposal-summary${qs(params)}`),
  verificationProgress: (params = {}) => api(`/reports/verification-progress${qs(params)}`),
  assetUtilization: (params = {}) => api(`/reports/asset-utilization${qs(params)}`),
  depreciation: (params = {}) => api(`/reports/depreciation${qs(params)}`),
}

export const categoriesApi = {
  list: (params = {}) => api(`/categories${qs(params)}`),
  tree: () => api('/categories/tree'),
  get: (id) => api(`/categories/${id}`),
  path: (id) => api(`/categories/${id}/path`),
  create: (body) => api('/categories', { method: 'POST', body }),
  update: (id, body) => api(`/categories/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/categories/${id}`, { method: 'DELETE' }),
  children: (id) => api(`/categories/${id}/children`),
}

export const locationsApi = {
  list: (params = {}) => api(`/locations${qs(params)}`),
  get: (id) => api(`/locations/${id}`),
  create: (body) => api('/locations', { method: 'POST', body }),
  update: (id, body) => api(`/locations/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/locations/${id}`, { method: 'DELETE' }),
  children: (id) => api(`/locations/${id}/children`),
}

export const orgUnitsApi = {
  list: (params = {}) => api(`/org-units${qs(params)}`),
  get: (id) => api(`/org-units/${id}`),
  create: (body) => api('/org-units', { method: 'POST', body }),
  update: (id, body) => api(`/org-units/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/org-units/${id}`, { method: 'DELETE' }),
  children: (id) => api(`/org-units/${id}/children`),
}

export const vendorsApi = {
  list: (params = {}) => api(`/vendors${qs(params)}`),
  get: (id) => api(`/vendors/${id}`),
  create: (body) => api('/vendors', { method: 'POST', body }),
  update: (id, body) => api(`/vendors/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/vendors/${id}`, { method: 'DELETE' }),
}

export const purchasesApi = {
  list: (params = {}) => api(`/purchases${qs(params)}`),
  get: (id) => api(`/purchases/${id}`),
  create: (body) => api('/purchases', { method: 'POST', body }),
  update: (id, body) => api(`/purchases/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/purchases/${id}`, { method: 'DELETE' }),
  getItems: (id) => api(`/purchases/${id}/items`),
  addItem: (id, body) => api(`/purchases/${id}/items`, { method: 'POST', body }),
  updateItem: (id, itemId, body) =>
    api(`/purchases/${id}/items/${itemId}`, { method: 'PATCH', body }),
  removeItem: (id, itemId) => api(`/purchases/${id}/items/${itemId}`, { method: 'DELETE' }),
}

export const dropBoxesApi = {
  list: (params = {}) => api(`/drop-boxes${qs(params)}`),
  get: (id) => api(`/drop-boxes/${id}`),
  create: (body) => api('/drop-boxes', { method: 'POST', body }),
  update: (id, body) => api(`/drop-boxes/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/drop-boxes/${id}`, { method: 'DELETE' }),
}

export const blocksApi = {
  list: (params = {}) => api(`/blocks${qs(params)}`),
  get: (id) => api(`/blocks/${id}`),
  activeForUser: (userId) => api(`/blocks/active/${userId}`),
  create: (body) => api('/blocks', { method: 'POST', body }),
  update: (id, body) => api(`/blocks/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/blocks/${id}`, { method: 'DELETE' }),
}

export const transfersApi = {
  list: (params = {}) => api(`/transfers${qs(params)}`),
  get: (id) => api(`/transfers/${id}`),
  create: (body) => api('/transfers', { method: 'POST', body }),
  update: (id, body) => api(`/transfers/${id}`, { method: 'PATCH', body }),
  approve: (id, body = {}) => api(`/transfers/${id}/approve`, { method: 'POST', body }),
  reject: (id, body) => api(`/transfers/${id}/reject`, { method: 'POST', body }),
  complete: (id, body = {}) => api(`/transfers/${id}/complete`, { method: 'POST', body }),
  cancel: (id, body) => api(`/transfers/${id}/cancel`, { method: 'POST', body }),
}

export const auditLogApi = {
  list: (params = {}) => api(`/audit-log${qs(params)}`),
  get: (id) => api(`/audit-log/${id}`),
  byEntity: (entityType, entityId) => api(`/audit-log/entity/${entityType}/${entityId}`),
}
