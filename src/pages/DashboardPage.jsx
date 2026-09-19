import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Logo from '../components/ui/Logo.jsx'
import { changeLanguage } from '../i18n/index.js'
import { useLanguageOptions } from '../i18n/useLanguageOptions.js'

export default function DashboardPage({ title, breadcrumb }) {
  const { t, i18n } = useTranslation()
  const languageOptions = useLanguageOptions()

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="dashboard-hero">
        <div className="dashboard-hero-main">
          <Logo variant="dashboard" />
          <h1 className="page-title dashboard-hero-title">{title}</h1>
        </div>

        {languageOptions.length > 0 && (
          <div className="dashboard-language-switcher">
            <Languages size={16} aria-hidden="true" />
            <select
              value={i18n.language}
              onChange={(event) => changeLanguage(event.target.value)}
              aria-label={t('header.language')}
            >
              {languageOptions.map((sprache) => (
                <option key={sprache.id} value={sprache.code}>
                  {sprache.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="page-placeholder">
        <p>{t('placeholder.notReady')}</p>
      </div>
    </div>
  )
}
