import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext.jsx'
import Logo from '../components/ui/Logo.jsx'

export default function LoginPage() {
  const { t } = useTranslation()
  const { signInWithPassword, resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [resetMessage, setResetMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setResetMessage('')
    setSubmitting(true)
    const { error: signInError } = await signInWithPassword(email, password)
    setSubmitting(false)
    if (signInError) {
      setError(t('auth.loginFailed'))
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault()
    setError('')
    setResetMessage('')
    if (!email) {
      setError(t('auth.enterEmailFirst'))
      return
    }
    const { error: resetError } = await resetPasswordForEmail(email)
    if (resetError) {
      setError(t('auth.resetFailed'))
    } else {
      setResetMessage(t('auth.resetSent'))
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Logo variant="login" />
        </div>

        <h1 className="login-title">{t('auth.loginTitle')}</h1>
        <p className="login-subtitle">{t('auth.loginSubtitle')}</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>{t('auth.email')}</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@firma.de"
            />
          </label>

          <label className="login-field">
            <span>{t('auth.password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="login-error">{error}</p>}
          {resetMessage && <p className="login-success">{resetMessage}</p>}

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>

          <button type="button" className="login-forgot" onClick={handleForgotPassword}>
            {t('auth.forgotPassword')}
          </button>
        </form>
      </div>
    </div>
  )
}
