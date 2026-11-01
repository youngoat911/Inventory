import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Register() {
  usePageTitle('Register')
  const { register, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '',
    institute_email: '',
    roll_no: '',
    programme: '',
    phone: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && isAuthenticated) return <Navigate to="/" replace />

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register({
        full_name: form.full_name.trim(),
        institute_email: form.institute_email.trim(),
        roll_no: form.roll_no.trim(),
        programme: form.programme.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">Create account</div>
        <p className="auth-sub">Register with your institute credentials.</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="institute_email">Institute email</label>
            <input
              id="institute_email"
              type="email"
              value={form.institute_email}
              onChange={(e) => update('institute_email', e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="roll_no">Roll number</label>
              <input
                id="roll_no"
                value={form.roll_no}
                onChange={(e) => update('roll_no', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="programme">Programme</label>
              <input
                id="programme"
                value={form.programme}
                onChange={(e) => update('programme', e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
