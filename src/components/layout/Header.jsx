import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, PanelLeftClose, PanelLeftOpen, ChevronDown, LogOut, Languages, Check } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { changeLanguage } from '../../i18n/index.js'
import { useLanguageOptions } from '../../i18n/useLanguageOptions.js'
import Logo from '../ui/Logo.jsx'

function getInitials(email) {
  if (!email) return '?'
  return email.slice(0, 2).toUpperCase()
}

export default function Header({ collapsed, onToggleCollapsed, onToggleMobile }) {
  const { t, i18n } = useTranslation()
  const { user, signOut } = useAuth()
  const aktiveSprachen = useLanguageOptions()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          type="button"
          className="icon-button mobile-only"
          aria-label={t('header.openNav')}
          onClick={onToggleMobile}
        >
          <Menu size={20} />
        </button>
        <button
          type="button"
          className="icon-button desktop-only"
          aria-label={collapsed ? t('header.expandSidebar') : t('header.collapseSidebar')}
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
            <span className="user-name">{user?.email ?? t('header.user')}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <div className="dropdown-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="user-menu-dropdown">
                {aktiveSprachen.length > 0 && (
                  <>
                    <span className="user-menu-section-label">
                      <Languages size={13} />
                      {t('header.language')}
                    </span>
                    {aktiveSprachen.map((sprache) => (
                      <button
                        key={sprache.id}
                        type="button"
                        className="user-menu-item"
                        onClick={() => {
                          changeLanguage(sprache.code)
                          setMenuOpen(false)
                        }}
                      >
                        {i18n.language === sprache.code ? <Check size={16} /> : <span className="user-menu-item-spacer" />}
                        {sprache.name}
                      </button>
                    ))}
                    <div className="user-menu-divider" />
                  </>
                )}
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    signOut()
                  }}
                >
                  <LogOut size={16} />
                  {t('header.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
