import Breadcrumb from '../components/layout/Breadcrumb.jsx'

export default function PlaceholderPage({ title, breadcrumb }) {
  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>
      <div className="page-placeholder">
        <p>Diese Seite ist noch nicht eingerichtet.</p>
      </div>
    </div>
  )
}
