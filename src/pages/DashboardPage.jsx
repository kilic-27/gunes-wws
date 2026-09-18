import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Logo from '../components/ui/Logo.jsx'

export default function DashboardPage({ title, breadcrumb }) {
  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="dashboard-hero">
        <Logo variant="dashboard" />
        <h1 className="page-title dashboard-hero-title">{title}</h1>
      </div>
      <div className="page-placeholder">
        <p>Diese Seite ist noch nicht eingerichtet.</p>
      </div>
    </div>
  )
}
