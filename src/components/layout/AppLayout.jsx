import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'

const COLLAPSE_KEY = 'wws.sidebar.collapsed'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return (
    <div className="app-shell">
      <Header
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />
      <div className="app-body">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onNavigate={() => setMobileOpen(false)}
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
