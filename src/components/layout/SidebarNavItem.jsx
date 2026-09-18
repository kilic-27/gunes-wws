import { NavLink } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

// Ein einzelner Sidebar-Eintrag: entweder ein direkter Link (mit Icon)
// oder eine ausklappbare Gruppe mit Unterpunkten.
export default function SidebarNavItem({ item, isOpen, onToggle, collapsed, onNavigate }) {
  const Icon = item.icon

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
    <li className={'nav-group has-children' + (isOpen ? ' open' : '')}>
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
      <div className="submenu-wrap">
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
