import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { navGroups } from '../../nav/navConfig.js'
import SidebarNavItem from './SidebarNavItem.jsx'

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile, onNavigate }) {
  const location = useLocation()
  // Labels der Gruppen, die aufgrund der aktuellen Route standardmäßig offen sein sollen.
  const activeGroupLabels = useMemo(() => {
    const set = new Set()
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.children?.some((child) => child.path === location.pathname)) {
          set.add(item.label)
        }
      }
    }
    return set
  }, [location.pathname])

  // Nur explizit vom Nutzer umgeschaltete Gruppen werden hier gespeichert;
  // alles andere richtet sich nach der aktiven Route (siehe isGroupOpen).
  const [openOverrides, setOpenOverrides] = useState(() => new Map())

  function isGroupOpen(label) {
    return openOverrides.has(label) ? openOverrides.get(label) : activeGroupLabels.has(label)
  }

  function toggleGroup(label) {
    setOpenOverrides((prev) => {
      const next = new Map(prev)
      next.set(label, !isGroupOpen(label))
      return next
    })
  }

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (mobileOpen ? ' mobile-open' : '')}>
        <nav className="sidebar-nav" aria-label="Hauptnavigation">
          {navGroups.map((group) => (
            <div className="nav-group-section" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              <ul>
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.label}
                    item={item}
                    collapsed={collapsed}
                    isOpen={isGroupOpen(item.label)}
                    onToggle={toggleGroup}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
