import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext.jsx'
import Logo from '../components/ui/Logo.jsx'
import PasswortForm from '../components/auth/PasswortForm.jsx'

/**
 * Vollbild-Seite: erscheint beim ersten Login mit dem vorläufigen Passwort und nach dem Link
 * "Passwort vergessen". Erst nach dem Setzen eines eigenen Passworts geht es in die App.
 */
export default function PasswortSetzenPage({ recovery }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Logo variant="login" />
        </div>
        <h1 className="login-title">{t('auth.setPasswordTitle')}</h1>
        <p className="login-subtitle">{recovery ? t('auth.setPasswordRecovery') : t('auth.setPasswordFirstLogin')}</p>
        {/* Nach dem Speichern aktualisiert sich die Sitzung; die App öffnet sich dann von selbst. */}
        <PasswortForm withOld={!recovery} submitLabel={t('auth.setPasswordButton')} pageStyle />
        <button type="button" className="login-forgot" onClick={() => signOut()}>
          {t('header.logout')}
        </button>
      </div>
    </div>
  )
}
