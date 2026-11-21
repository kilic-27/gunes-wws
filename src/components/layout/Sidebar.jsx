import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { navGroups } from '../../nav/navConfig.js'
import { usePermissions } from '../../auth/usePermissions.js'
import SidebarNavItem from './SidebarNavItem.jsx'

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile, onNavigate }) {
  const { t } = useTranslation()
  const location = useLocation()
  const { hasAccess } = usePermissions()

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.bald && hasAccess(item.bereich)),
        }))
        .filter((group) => group.items.length > 0),
    [hasAccess],
  )
  // Menü-Suche: filtert alle sichtbaren Seiten (Untermenüs eingeschlossen) nach dem übersetzten Namen.
  const [filter, setFilter] = useState('')
  const filterWoerter = filter.toLowerCase().split(/\s+/).filter(Boolean)
  const menuTreffer = useMemo(() => {
    const woerter = filter.toLowerCase().split(/\s+/).filter(Boolean)
    if (woerter.length === 0) return []
    const liste = []
    for (const group of visibleGroups) {
      for (const item of group.items) {
        for (const e of item.children ?? [item]) {
          const text = `${t(e.labelKey)} ${t(item.labelKey)}`.toLowerCase()
          if (woerter.every((w) => text.includes(w))) liste.push({ path: e.path, labelKey: e.labelKey, parentKey: item.children ? item.labelKey : null })
        }
      }
    }
    return liste
  }, [filter, visibleGroups, t])

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
          {!collapsed && (
            <div className="sidebar-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t('suche.menuePlaceholder')}
                aria-label={t('suche.menuePlaceholder')}
                autoComplete="off"
              />
            </div>
          )}
          {filterWoerter.length > 0 && !collapsed ? (
            <ul className="sidebar-search-results">
              {menuTreffer.length === 0 && <li className="sidebar-search-empty">{t('suche.keineTreffer')}</li>}
              {menuTreffer.map((e) => (
                <li key={e.path}>
                  <NavLink
                    to={e.path}
                    className={({ isActive }) => 'nav-link nav-sublink' + (isActive ? ' active' : '')}
                    onClick={() => {
                      setFilter('')
                      onNavigate?.()
                    }}
                  >
                    <span className="sidebar-search-label">{t(e.labelKey)}</span>
                    {e.parentKey && <span className="sidebar-search-parent">{t(e.parentKey)}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : (
          visibleGroups.map((group) => (
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
          ))
          )}
        </nav>
      </aside>
    </>
  )
}
