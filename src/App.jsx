import { Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AppLayout from './components/layout/AppLayout.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import FirmenPage from './pages/FirmenPage.jsx'
import LagerPage from './pages/LagerPage.jsx'
import MitarbeiterPage from './pages/MitarbeiterPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import KatalogPage from './pages/KatalogPage.jsx'
import BestandPage from './pages/BestandPage.jsx'
import ReparaturuebersichtPage from './pages/ReparaturuebersichtPage.jsx'
import LeihartikelPage from './pages/LeihartikelPage.jsx'
import WareneingangPage from './pages/WareneingangPage.jsx'
import SprachenPage from './pages/SprachenPage.jsx'
import LaenderPage from './pages/LaenderPage.jsx'
import OrtePage from './pages/OrtePage.jsx'
import GewerkePage from './pages/GewerkePage.jsx'
import { flattenPages } from './nav/navConfig.js'
import { useAuth } from './auth/AuthContext.jsx'

// Seiten, die bereits an echte Module angebunden sind (statt Platzhalter).
const customPages = {
  '/einstellungen/firmen': FirmenPage,
  '/lager': LagerPage,
  '/benutzer/mitarbeiter': MitarbeiterPage,
  '/dashboard': DashboardPage,
  '/artikel/katalog': KatalogPage,
  '/artikel/bestand': BestandPage,
  '/artikel/reparaturuebersicht': ReparaturuebersichtPage,
  '/artikel/leihartikel': LeihartikelPage,
  '/artikel/wareneingang': WareneingangPage,
  '/einstellungen/sprachen': SprachenPage,
  '/einstellungen/laender': LaenderPage,
  '/einstellungen/orte': OrtePage,
  '/einstellungen/gewerke': GewerkePage,
}

const pages = flattenPages()
const placeholderPages = pages.filter((page) => !customPages[page.path])

function App() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="auth-loading">{t('auth.loadingApp')}</div>
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {pages
          .filter((page) => customPages[page.path])
          .map((page) => {
            const CustomPage = customPages[page.path]
            return (
              <Route
                key={page.path}
                path={page.path.slice(1)}
                element={<CustomPage title={t(page.titleKey)} breadcrumb={page.breadcrumbKeys.map((key) => t(key))} />}
              />
            )
          })}
        {placeholderPages.map((page) => (
          <Route
            key={page.path}
            path={page.path.slice(1)}
            element={<PlaceholderPage title={t(page.titleKey)} breadcrumb={page.breadcrumbKeys.map((key) => t(key))} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App
