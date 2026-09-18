import { useState } from 'react'
import { Menu, PanelLeftClose, PanelLeftOpen, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import Logo from '../ui/Logo.jsx'

function getInitials(email) {
  if (!email) return '?'
  return email.slice(0, 2).toUpperCase()
}

export default function Header({ collapsed, onToggleCollapsed, onToggleMobile }) {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          type="button"
          className="icon-button mobile-only"
          aria-label="Navigation öffnen"
          onClick={onToggleMobile}
        >
          <Menu size={20} />
        </button>
        <button
          type="button"
          className="icon-button desktop-only"
          aria-label={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <div className="app-logo">
          <Logo variant="header" />
        </div>
      </div>

      <div className="app-header-right">
        <div className="user-menu-wrap">
          <button
            type="button"
            className="user-menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="user-avatar">{getInitials(user?.email)}</span>
            <span className="user-name">{user?.email ?? 'Benutzer'}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <div className="dropdown-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="user-menu-dropdown">
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    signOut()
                  }}
                >
                  <LogOut size={16} />
                  Abmelden
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
