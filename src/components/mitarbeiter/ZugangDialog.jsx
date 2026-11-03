import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, MessageCircle, Copy, Check, Send, ExternalLink } from 'lucide-react'
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

// Outlook im Web (Microsoft 365): öffnet direkt ein neues Mail-Fenster mit Empfänger, Betreff und Text.
const outlookWebUrl = (to, subject, body) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

/**
 * "Zugang einrichten": legt den Login an, erzeugt ein vorläufiges Passwort und bietet die fertige Nachricht
 * per WhatsApp, Outlook im Web oder E-Mail-Programm an. Der gewählte Weg öffnet sich gleich automatisch;
 * zusätzlich gibt es für jeden Weg einen eigenen Knopf (normale Links, die der Browser nie blockiert).
 * Beim ersten Login vergibt der Mitarbeiter ein eigenes Passwort.
 */
export default function ZugangDialog({ mitarbeiter, onClose, onDone }) {
  const { t } = useTranslation()
  const name = `${mitarbeiter.vorname ?? ''} ${mitarbeiter.nachname ?? ''}`.trim()
  const hatZugang = Boolean(mitarbeiter.zugang_eingerichtet_am)

  const [kanal, setKanal] = useState(mitarbeiter.benachrichtigungsart === 'email' ? 'direkt' : 'whatsapp')
  const [sprache, setSprache] = useState('de')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { email, password, whatsappText, mailText, subject, links }
  const [copied, setCopied] = useState(false)

  function buildMessages(zugang, lng) {
    const values = { name, url: window.location.origin, email: zugang.email, password: zugang.password, lng, interpolation: { escapeValue: false } }
    const whatsappText = t('zugang.nachricht.whatsapp', values)
    const mailText = t('zugang.nachricht.email', values)
    const subject = t('zugang.nachricht.betreff', values)
    return {
      whatsappText,
      mailText,
      subject,
      links: {
        whatsapp: whatsappUrl(mitarbeiter.mobil, whatsappText),
        outlook: outlookWebUrl(zugang.email, subject, mailText),
        mailto: mailtoUrl(zugang.email, subject, mailText),
      },
    }
  }

  async function start() {
    setError('')
    setBusy(true)
    // Neuer Tab muss innerhalb des Klicks reserviert werden, sonst blockiert der Browser ihn.
    const win = kanal === 'mailto' || kanal === 'direkt' ? null : window.open('', '_blank')
    try {
      // Direkt senden: der Server verschickt die E-Mail selbst; im Text steht __PASSWORT__ als Platzhalter.
      const mailPayload = kanal === 'direkt' ? buildMessages({ email: mitarbeiter.email, password: '__PASSWORT__' }, sprache) : null
      const zugang = await zugangEinrichten(mitarbeiter.id, mailPayload && { subject: mailPayload.subject, text: mailPayload.mailText })
      const nachricht = buildMessages(zugang, sprache)
      setResult({ ...zugang, ...nachricht })
      onDone?.()
      if (kanal === 'mailto') window.location.assign(nachricht.links.mailto)
      else if (win) win.location.href = nachricht.links[kanal]
    } catch (err) {
      win?.close()
      const known = ['not_available', 'network', 'missing', 'inactive', 'self', 'exists', 'auth']
      const text = known.includes(err.code) ? t(`zugang.fehler.${err.code}`) : err.message || t('zugang.fehler.error')
      // Technische Angaben für die Fehlersuche: Adresse der geöffneten App, HTTP-Status, Server-Version
      setError(`${text} [${window.location.host} · HTTP ${err.status ?? '–'} · Server ${err.version ?? '–'}${err.detail ? ' · ' + err.detail : ''}]`)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    const text = kanal === 'whatsapp' ? result.whatsappText : result.mailText
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Zwischenablage nicht verfügbar: der Text steht zum Markieren im Feld
    }
  }

  const kanalLabel = { whatsapp: 'WhatsApp', outlook: 'Outlook', mailto: 'E-Mail', direkt: 'E-Mail' }[kanal]

  // Ergebnis des direkten Versands (nur bei kanal "direkt"): gesendet, nicht eingerichtet oder Fehler
  const direkt = result?.mail
  const direktMeldung =
    kanal !== 'direkt' || !result
      ? null
      : direkt?.gesendet
        ? { ok: true, text: t('zugang.direktGesendet', { email: result.email }) }
        : direkt?.grund === 'nicht_eingerichtet'
          ? { ok: false, text: t('zugang.direktNichtEingerichtet') }
          : { ok: false, text: t('zugang.direktFehler', { fehler: direkt?.fehler || '–' }) }

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
                  { value: 'direkt', label: t('zugang.direktMail') },
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'outlook', label: t('zugang.outlookWeb') },
                  { value: 'mailto', label: t('zugang.mailProgramm') },
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
            <p className={direktMeldung && !direktMeldung.ok ? 'login-error' : 'login-success'}>
              {direktMeldung ? direktMeldung.text : t('zugang.fertigNeu', { kanal: kanalLabel })}
            </p>
            <Field label={t('zugang.passwort')}>
              <input readOnly className="mono-text" value={result.password} onFocus={(event) => event.target.select()} />
            </Field>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '4px 0 12px' }}>
              <a className={'btn ' + (kanal === 'whatsapp' ? 'btn-primary' : 'btn-ghost')} href={result.links.whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} />
                {t('zugang.whatsappOeffnen')}
                <ExternalLink size={13} />
              </a>
              <a className={'btn ' + (kanal === 'outlook' ? 'btn-primary' : 'btn-ghost')} href={result.links.outlook} target="_blank" rel="noopener noreferrer">
                <Mail size={16} />
                {t('zugang.outlookOeffnen')}
                <ExternalLink size={13} />
              </a>
              <a className={'btn ' + (kanal === 'mailto' ? 'btn-primary' : 'btn-ghost')} href={result.links.mailto}>
                <Mail size={16} />
                {t('zugang.mailProgrammOeffnen')}
              </a>
            </div>
            <Field label={t('lieferschein.senden.nachricht')}>
              <textarea readOnly rows={kanal === 'whatsapp' ? 6 : 9} value={kanal === 'whatsapp' ? result.whatsappText : result.mailText} />
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
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('common.close')}
            </button>
          </>
        )}
      </div>
    </Dialog>
  )
}
