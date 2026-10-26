import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'

export default function ResetPassword() {
  usePageTitle('Reset password')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await authApi.resetPassword(token.trim(), password)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Reset failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">Gymkhana Inventory</div>
        <p className="auth-sub">Choose a new password.</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="token">Reset token</label>
            <input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Saving…' : 'Reset password'}
          </button>
        </form>
        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
