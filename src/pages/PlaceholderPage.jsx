import { useTranslation } from 'react-i18next'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'

export default function PlaceholderPage({ title, breadcrumb }) {
  const { t } = useTranslation()
  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>
      <div className="page-placeholder">
        <p>{t('placeholder.notReady')}</p>
      </div>
    </div>
  )
}
