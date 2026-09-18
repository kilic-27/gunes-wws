import { useState } from 'react'
import Dialog from './Dialog.jsx'

/**
 * Wiederverwendbares Formular-Dialog-Muster zum Anlegen und Bearbeiten von
 * Einträgen. onSubmit darf ein Promise zurückgeben (z. B. Supabase-Aufruf);
 * bei Erfolg schließt sich der Dialog automatisch, bei Fehler bleibt er offen
 * und zeigt die Fehlermeldung an.
 */
export default function FormDialog({ open, title, onClose, onSubmit, submitLabel = 'Speichern', children, size }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(event)
      onClose()
    } catch (err) {
      setError(err?.message || 'Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    if (submitting) return
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} title={title} onClose={handleClose} size={size}>
      <form className="dialog-form" onSubmit={handleSubmit}>
        <div className="dialog-body">
          {children}
          {error && <p className="login-error">{error}</p>}
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={submitting}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Speichert…' : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
