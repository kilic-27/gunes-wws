import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext.jsx'

const MIN_LENGTH = 8

/**
 * Formular zum Ändern des Passworts. Mit withOld wird das aktuelle Passwort abgefragt und geprüft
 * (nicht beim Zurücksetzen über den E-Mail-Link). onDone wird nach dem Speichern aufgerufen.
 */
export default function PasswortForm({ withOld = true, onDone, onCancel, submitLabel, pageStyle = false }) {
  const { t } = useTranslation()
  const { changePassword } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password.length < MIN_LENGTH) {
      setError(t('auth.passwordTooShort', { min: MIN_LENGTH }))
      return
    }
    if (password !== repeat) {
      setError(t('auth.passwordMismatch'))
      return
    }
    if (withOld && password === oldPassword) {
      setError(t('auth.passwordSame'))
      return
    }
    setSubmitting(true)
    const { error: changeError } = await changePassword(password, withOld ? oldPassword : undefined)
    setSubmitting(false)
    if (changeError) {
      setError(changeError.code === 'wrong_password' ? t('auth.oldPasswordWrong') : t('auth.passwordChangeFailed'))
      return
    }
    onDone?.()
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {withOld && (
        <label className="login-field">
          <span>{t('auth.oldPassword')}</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
          />
        </label>
      )}
      <label className="login-field">
        <span>{t('auth.newPassword')}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="login-field">
        <span>{t('auth.repeatPassword')}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
      </label>
      <p className="field-hint">{t('auth.passwordHint', { min: MIN_LENGTH })}</p>
      {error && <p className="login-error">{error}</p>}
      {pageStyle ? (
        <button type="submit" className="login-submit" disabled={submitting}>
          {submitting ? t('common.saving') : (submitLabel ?? t('common.save'))}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
              {t('common.cancel')}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? t('common.saving') : (submitLabel ?? t('common.save'))}
          </button>
        </div>
      )}
    </form>
  )
}
