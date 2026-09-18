import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import Logo from '../components/ui/Logo.jsx'

export default function LoginPage() {
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
      setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.')
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault()
    setError('')
    setResetMessage('')
    if (!email) {
      setError('Bitte zuerst deine E-Mail-Adresse eingeben.')
      return
    }
    const { error: resetError } = await resetPasswordForEmail(email)
    if (resetError) {
      setError('E-Mail zum Zurücksetzen konnte nicht gesendet werden.')
    } else {
      setResetMessage('E-Mail zum Zurücksetzen des Passworts wurde gesendet.')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Logo variant="login" />
        </div>

        <h1 className="login-title">Anmelden</h1>
        <p className="login-subtitle">Bitte melde dich mit deinen Zugangsdaten an.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>E-Mail</span>
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
            <span>Passwort</span>
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
            {submitting ? 'Anmelden…' : 'Einloggen'}
          </button>

          <button type="button" className="login-forgot" onClick={handleForgotPassword}>
            Passwort vergessen?
          </button>
        </form>
      </div>
    </div>
  )
}
