import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { navGroups } from '../../nav/navConfig.js'
import SidebarNavItem from './SidebarNavItem.jsx'

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile, onNavigate }) {
  const { t } = useTranslation()
  const location = useLocation()
  // Keys der Gruppen, die aufgrund der aktuellen Route standardmäßig offen sein sollen.
  const activeGroupKeys = useMemo(() => {
    const set = new Set()
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.children?.some((child) => child.path === location.pathname)) {
          set.add(item.labelKey)
        }
      }
    }
    return set
  }, [location.pathname])

  // Nur explizit vom Nutzer umgeschaltete Gruppen werden hier gespeichert;
  // alles andere richtet sich nach der aktiven Route (siehe isGroupOpen).
  const [openOverrides, setOpenOverrides] = useState(() => new Map())

  function isGroupOpen(key) {
    return openOverrides.has(key) ? openOverrides.get(key) : activeGroupKeys.has(key)
  }

  function toggleGroup(key) {
    setOpenOverrides((prev) => {
      const next = new Map(prev)
      next.set(key, !isGroupOpen(key))
      return next
    })
  }

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (mobileOpen ? ' mobile-open' : '')}>
        <nav className="sidebar-nav" aria-label={t('nav.mainNavigation')}>
          {navGroups.map((group) => (
            <div className="nav-group-section" key={group.labelKey}>
              <span className="nav-group-label">{t(group.labelKey)}</span>
              <ul>
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.labelKey}
                    item={item}
                    collapsed={collapsed}
                    isOpen={isGroupOpen(item.labelKey)}
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
