import { Navigate, Route, Routes } from 'react-router-dom'
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
}

const pages = flattenPages()
const placeholderPages = pages.filter((page) => !customPages[page.path])

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="auth-loading">Lädt…</div>
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
                element={<CustomPage title={page.title} breadcrumb={page.breadcrumb} />}
              />
            )
          })}
        {placeholderPages.map((page) => (
          <Route
            key={page.path}
            path={page.path.slice(1)}
            element={<PlaceholderPage title={page.title} breadcrumb={page.breadcrumb} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App
