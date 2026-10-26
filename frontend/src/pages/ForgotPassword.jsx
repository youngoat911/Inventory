import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle'

export default function ForgotPassword() {
  usePageTitle('Forgot password')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      await authApi.forgotPassword(email.trim())
      setMessage('If that email exists, a reset link/token has been sent.')
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">Gymkhana Inventory</div>
        <p className="auth-sub">Reset your password.</p>
        {error ? <div className="error-banner">{error}</div> : null}
        {message ? <div className="success-banner">{message}</div> : null}
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Institute email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset'}
          </button>
        </form>
        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
          {' · '}
          <Link to="/reset-password">Have a token?</Link>
        </p>
      </div>
    </div>
  )
}
