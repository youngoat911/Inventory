import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { SkeletonLine } from './components/Skeleton'

const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Assets         = lazy(() => import('./pages/Assets'))
const Issues         = lazy(() => import('./pages/Issues'))
const Transfers      = lazy(() => import('./pages/Transfers'))
const Alerts         = lazy(() => import('./pages/Alerts'))
const Catalog        = lazy(() => import('./pages/Catalog'))
const Purchases      = lazy(() => import('./pages/Purchases'))
const Vendors        = lazy(() => import('./pages/Vendors'))
const Users          = lazy(() => import('./pages/Users'))
const Blocks         = lazy(() => import('./pages/Blocks'))
const Reports        = lazy(() => import('./pages/Reports'))
const AuditLog       = lazy(() => import('./pages/AuditLog'))
const Login          = lazy(() => import('./pages/Login'))
const Register       = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const NotFound       = lazy(() => import('./pages/NotFound'))
const Forbidden      = lazy(() => import('./pages/Forbidden'))
const Disposals      = lazy(() => import('./pages/Disposals'))
const Maintenance    = lazy(() => import('./pages/Maintenance'))
const Notifications  = lazy(() => import('./pages/Notifications'))
const Verifications  = lazy(() => import('./pages/Verifications'))

function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite" aria-label="Loading page">
      <div className="loading-card" aria-hidden="true">
        <SkeletonLine width="42%" height="1.5rem" />
        <SkeletonLine width="72%" height="0.9rem" />
        <SkeletonLine width="100%" height="8rem" />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!isAdmin) return <Forbidden />
  return children
}

function AuditRoute({ children }) {
  const { canViewAuditLog, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!canViewAuditLog) return <Forbidden />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="assets" element={<Assets />} />
          <Route path="issues" element={<Issues />} />
          <Route path="transfers" element={<Transfers />} />
          <Route path="disposals" element={<Disposals />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="vendors" element={<AdminRoute><Vendors /></AdminRoute>} />
          <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="blocks" element={<AdminRoute><Blocks /></AdminRoute>} />
          <Route path="verifications" element={<AdminRoute><Verifications /></AdminRoute>} />
          <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
          <Route path="audit-log" element={<AuditRoute><AuditLog /></AuditRoute>} />
          <Route path="drop-boxes" element={<Navigate to="/catalog?tab=drop-boxes" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
