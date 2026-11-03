import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, MessageCircle, Copy, Check, Send } from 'lucide-react'
import Dialog from '../ui/Dialog.jsx'
import Segmented from '../ui/Segmented.jsx'
import Field from '../ui/Field.jsx'
import { zugangEinrichten } from '../../lib/zugang.js'
import { mailtoUrl, whatsappUrl } from '../../lib/versand.js'

const SPRACHEN = [
  { value: 'de', label: 'Deutsch' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'bg', label: 'Български' },
  { value: 'pl', label: 'Polski' },
  { value: 'en', label: 'English' },
]

/**
 * "Zugang einrichten": legt den Login an, erzeugt ein vorläufiges Passwort und öffnet WhatsApp
 * bzw. das E-Mail-Programm mit der fertigen Nachricht (Kanal = Benachrichtigungsart des Mitarbeiters).
 * Beim ersten Login vergibt der Mitarbeiter ein eigenes Passwort.
 */
export default function ZugangDialog({ mitarbeiter, onClose, onDone }) {
  const { t } = useTranslation()
  const name = `${mitarbeiter.vorname ?? ''} ${mitarbeiter.nachname ?? ''}`.trim()
  const hatZugang = Boolean(mitarbeiter.zugang_eingerichtet_am)

  const [kanal, setKanal] = useState(mitarbeiter.benachrichtigungsart === 'email' ? 'email' : 'whatsapp')
  const [sprache, setSprache] = useState('de')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { email, password, text, subject, url }
  const [copied, setCopied] = useState(false)

  function buildMessage(zugang, kanalWahl, lng) {
    const values = { name, url: window.location.origin, email: zugang.email, password: zugang.password, lng, interpolation: { escapeValue: false } }
    const text = t(kanalWahl === 'email' ? 'zugang.nachricht.email' : 'zugang.nachricht.whatsapp', values)
    const subject = t('zugang.nachricht.betreff', values)
    const url = kanalWahl === 'email' ? mailtoUrl(zugang.email, subject, text) : whatsappUrl(mitarbeiter.mobil, text)
    return { text, subject, url }
  }

  async function start() {
    setError('')
    setBusy(true)
    // WhatsApp öffnet in einem neuen Tab: sofort (innerhalb des Klicks) reservieren, sonst blockiert der Browser.
    const win = kanal === 'whatsapp' ? window.open('', '_blank') : null
    try {
      const zugang = await zugangEinrichten(mitarbeiter.id)
      const nachricht = buildMessage(zugang, kanal, sprache)
      setResult({ ...zugang, ...nachricht })
      onDone?.()
      if (kanal === 'whatsapp') {
        if (win) win.location.href = nachricht.url
        else window.open(nachricht.url, '_blank')
      } else {
        window.location.assign(nachricht.url)
      }
    } catch (err) {
      win?.close()
      const known = ['not_available', 'network', 'not_configured', 'missing', 'inactive', 'self', 'exists']
      setError(known.includes(err.code) ? t(`zugang.fehler.${err.code}`) : err.message || t('zugang.fehler.error'))
    } finally {
      setBusy(false)
    }
  }

  function openAgain() {
    if (!result) return
    if (kanal === 'whatsapp') window.open(result.url, '_blank')
    else window.location.assign(result.url)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Zwischenablage nicht verfügbar: der Text steht zum Markieren im Feld
    }
  }

  return (
    <Dialog open title={t('zugang.titel', { name })} size="lg" onClose={busy ? () => {} : onClose}>
      <div className="dialog-body">
        {!result ? (
          <>
            <p>{hatZugang ? t('zugang.infoNeu', { name }) : t('zugang.info', { name })}</p>
            <ul className="field-hint" style={{ margin: '0 0 8px 18px' }}>
              <li>{t('zugang.empfaenger', { email: mitarbeiter.email, mobil: mitarbeiter.mobil, position: mitarbeiter.position_name || '–' })}</li>
              <li>{t('zugang.ersterLogin', { name })}</li>
            </ul>
            <Field label={t('zugang.kanal')}>
              <Segmented
                options={[
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'email', label: 'E-Mail' },
                ]}
                value={kanal}
                onChange={setKanal}
              />
            </Field>
            <Field label={t('zugang.sprache')}>
              <select value={sprache} onChange={(event) => setSprache(event.target.value)}>
                {SPRACHEN.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            {hatZugang && <p className="login-error">{t('zugang.warnungAltesPasswort')}</p>}
            {error && <p className="login-error">{error}</p>}
          </>
        ) : (
          <>
            <p className="login-success">{t('zugang.fertig', { kanal: kanal === 'whatsapp' ? 'WhatsApp' : 'E-Mail' })}</p>
            <Field label={t('zugang.passwort')}>
              <input readOnly className="mono-text" value={result.password} onFocus={(event) => event.target.select()} />
            </Field>
            <Field label={t('lieferschein.senden.nachricht')}>
              <textarea readOnly rows={kanal === 'email' ? 9 : 6} value={result.text} />
            </Field>
            <p className="field-hint">{t('zugang.einmalig')}</p>
          </>
        )}
      </div>
      <div className="dialog-footer">
        {!result ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={start} disabled={busy}>
              {kanal === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />}
              {busy ? t('zugang.richteEin') : hatZugang ? t('zugang.buttonNeu') : t('zugang.button')}
              {!busy && <Send size={14} />}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t('zugang.kopiert') : t('zugang.kopieren')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={openAgain}>
              {kanal === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />}
              {t('zugang.nochmalOeffnen')}
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('common.close')}
            </button>
          </>
        )}
      </div>
    </Dialog>
  )
}
