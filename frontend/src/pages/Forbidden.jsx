import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import Icon from '../components/Icon'

export default function Forbidden() {
  usePageTitle('Access denied')
  return (
    <div className="error-page">
      <div className="error-page-icon"><Icon name="shield-x" size={64} /></div>
      <h1>Access denied</h1>
      <p className="muted">You don't have permission to view this page.</p>
      <div className="row-actions" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
        <Link to="/" className="btn btn-primary">Go to dashboard</Link>
        <button type="button" className="btn btn-ghost" onClick={() => history.back()}>
          Go back
        </button>
      </div>
    </div>
  )
}
