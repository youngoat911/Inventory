import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import Icon from '../components/Icon'

export default function NotFound() {
  usePageTitle('Page not found')
  return (
    <div className="error-page">
      <div className="error-page-icon"><Icon name="file-question" size={64} /></div>
      <h1>404 — Page not found</h1>
      <p className="muted">The page you're looking for doesn't exist or has been moved.</p>
      <div className="row-actions" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
        <Link to="/" className="btn btn-primary">Go to dashboard</Link>
        <button type="button" className="btn btn-ghost" onClick={() => history.back()}>
          Go back
        </button>
      </div>
    </div>
  )
}
