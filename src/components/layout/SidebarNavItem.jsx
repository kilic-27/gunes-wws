import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

// Ein einzelner Sidebar-Eintrag: entweder ein direkter Link (mit Icon)
// oder eine ausklappbare Gruppe mit Unterpunkten.
export default function SidebarNavItem({ item, isOpen, onToggle, collapsed, onNavigate }) {
  const Icon = item.icon
  const itemRef = useRef(null)
  const [flyoutStyle, setFlyoutStyle] = useState(null)

  // Im eingeklappten Zustand hat die Sidebar ihr eigenes overflow-y: auto
  // (unabhängiges Scrollen) — ein absolut positioniertes Flyout würde daran
  // an der rechten Kante abgeschnitten. Deshalb wird die Position hier via
  // getBoundingClientRect berechnet und als "position: fixed" gesetzt, was
  // jede Ancestor-Overflow-Clipping umgeht.
  function handleMouseEnter() {
    if (!collapsed || !item.children || !itemRef.current) return
    const rect = itemRef.current.getBoundingClientRect()
    setFlyoutStyle({ position: 'fixed', top: rect.top, left: rect.right + 8 })
  }

  if (!item.children) {
    return (
      <li className="nav-leaf">
        <NavLink
          to={item.path}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          onClick={onNavigate}
        >
          {Icon && <Icon size={19} className="nav-icon" aria-hidden="true" />}
          <span className="nav-label">{item.label}</span>
        </NavLink>
      </li>
    )
  }

  return (
    <li
      ref={itemRef}
      className={'nav-group has-children' + (isOpen ? ' open' : '')}
      onMouseEnter={handleMouseEnter}
    >
      <button
        type="button"
        className="nav-link nav-group-trigger"
        title={collapsed ? item.label : undefined}
        aria-expanded={isOpen}
        onClick={() => onToggle(item.label)}
      >
        {Icon && <Icon size={19} className="nav-icon" aria-hidden="true" />}
        <span className="nav-label">{item.label}</span>
        <ChevronDown size={16} className="nav-chevron" aria-hidden="true" />
      </button>
      <div className="submenu-wrap" style={collapsed ? flyoutStyle ?? undefined : undefined}>
        <span className="submenu-title">{item.label}</span>
        <ul className="submenu">
          {item.children.map((child) => (
            <li key={child.path}>
              <NavLink
                to={child.path}
                className={({ isActive }) => 'nav-link nav-sublink' + (isActive ? ' active' : '')}
                onClick={onNavigate}
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}
