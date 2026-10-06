import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, MessageCircle, Send } from 'lucide-react'
import Dialog from '../ui/Dialog.jsx'
import Segmented from '../ui/Segmented.jsx'
import Field from '../ui/Field.jsx'
import { useSupabaseTable } from '../../lib/useSupabaseTable.js'
import { supabase } from '../../lib/supabaseClient.js'
import { getSignedImageUrl } from '../../lib/storage.js'
import { lieferscheinPdfBlob } from '../../lib/lieferscheinPdf.js'
import { fillPlaceholders, isEmail, mailtoUrl, normalizePhone, whatsappUrl } from '../../lib/versand.js'
import { formatDateTimeDE } from '../../lib/date.js'

const BUCKET = 'lieferschein-belege'
const LINK_TOKEN = '{{Link}}'
const THIRTY_DAYS = 60 * 60 * 24 * 30

const DEFAULT_TEXT = {
  whatsapp: 'Hallo {{Mitarbeitername}}, dein Lieferschein {{Lieferscheinnummer}} für die Baustelle {{Baustelle}} vom {{Datum}} steht bereit:\n{{Link}}',
  email: 'Hallo {{Mitarbeitername}},\n\nanbei dein Lieferschein {{Lieferscheinnummer}} für die Baustelle {{Baustelle}} vom {{Datum}}.\n\nLieferschein als PDF:\n{{Link}}\n\nViele Grüße\nGünes Sanierung GmbH',
}
const DEFAULT_SUBJECT = 'Lieferschein {{Lieferscheinnummer}} – {{Baustelle}}'

/**
 * Dialog "Lieferschein senden": wählt Kanal (Standard = Benachrichtigungsmethode des
 * Mitarbeiters), erzeugt das PDF, legt es als Beleg ab und öffnet WhatsApp bzw. das
 * E-Mail-Programm mit fertig ausgefülltem Text und Link zum PDF.
 */
export default function SendDialog({ ls, mitarbeiter, auftraggeberName, buildPdfContext, onClose, onSent, initialKanal }) {
  const { t } = useTranslation()
  const ereignisse = useSupabaseTable('benachrichtigungs_ereignisse', { orderBy: 'name', ascending: true })
  const sprachen = useSupabaseTable('sprachen', { orderBy: 'name', ascending: true })
  const vorlagen = useSupabaseTable('nachrichtenvorlagen')

  const defaultKanal = initialKanal ?? (mitarbeiter?.benachrichtigungsart === 'email' ? 'email' : 'whatsapp')
  const [kanal, setKanal] = useState(defaultKanal)
  const [edits, setEdits] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const values = {
    Mitarbeitername: mitarbeiter ? `${mitarbeiter.vorname ?? ''} ${mitarbeiter.nachname ?? ''}`.trim() : '',
    Lieferscheinnummer: ls.nummer_label,
    Baustelle: ls.adresse || '–',
    Kundenname: auftraggeberName || '',
    Datum: new Date(ls.erstellt_am).toLocaleDateString('de-DE'),
  }

  // Vorlage aus "E-Mail/WhatsApp Inhalte" (Ereignis "Lieferschein erstellt"), sonst Standardtext.
  const vorlage = useMemo(() => {
    const ereignis = ereignisse.rows.find((e) => /lieferschein/i.test(e.name))
    if (!ereignis) return null
    const de = sprachen.rows.find((s) => (s.code ?? '').toLowerCase() === 'de')
    const candidates = vorlagen.rows.filter((v) => v.ereignis_id === ereignis.id && v.kanal === kanal && (v.text ?? '').trim())
    return candidates.find((v) => v.sprache_id === de?.id) ?? candidates[0] ?? null
  }, [ereignisse.rows, sprachen.rows, vorlagen.rows, kanal])

  const initialText = fillPlaceholders(vorlage?.text || DEFAULT_TEXT[kanal], values)
  const initialSubject = fillPlaceholders(vorlage?.betreff || DEFAULT_SUBJECT, values)
  const initialRecipient = kanal === 'whatsapp' ? (mitarbeiter?.mobil ?? '') : (mitarbeiter?.email ?? '')

  const text = edits[kanal + '_text'] ?? initialText
  const subject = edits[kanal + '_subject'] ?? initialSubject
  const recipient = edits[kanal + '_recipient'] ?? initialRecipient
  const setEdit = (key, value) => setEdits((current) => ({ ...current, [kanal + '_' + key]: value }))

  const recipientValid = kanal === 'whatsapp' ? normalizePhone(recipient).length >= 8 : isEmail(recipient)

  async function send() {
    setError('')
    setBusy(true)
    // WhatsApp öffnet in einem neuen Tab: sofort (innerhalb des Klicks) reservieren, sonst blockiert der Browser.
    const win = kanal === 'whatsapp' ? window.open('', '_blank') : null
    try {
      const blob = await lieferscheinPdfBlob(buildPdfContext())
      const pfad = `${ls.id}/versand-${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(pfad, blob, { contentType: 'application/pdf' })
      if (uploadError) throw uploadError
      await supabase.from('lieferschein_belege').insert({ lieferschein_id: ls.id, bezeichnung: `${ls.nummer_label}.pdf (${formatDateTimeDE(new Date().toISOString())})`, pfad })
      const link = await getSignedImageUrl(BUCKET, pfad, THIRTY_DAYS)
      const body = text.includes(LINK_TOKEN) ? text.split(LINK_TOKEN).join(link) : `${text}\n${link}`

      const kanalLabel = kanal === 'whatsapp' ? 'WhatsApp' : 'E-Mail'
      await onSent(`Lieferschein per ${kanalLabel} an ${values.Mitarbeitername || recipient} gesendet (${recipient})`)

      if (kanal === 'whatsapp') {
        const url = whatsappUrl(recipient, body)
        if (win) win.location.href = url
        else window.open(url, '_blank')
      } else {
        window.location.href = mailtoUrl(recipient, subject, body)
      }
      onClose()
    } catch (err) {
      win?.close()
      setError(err?.message || t('lieferschein.senden.fehler'))
      setBusy(false)
    }
  }

  return (
    <Dialog open title={t('lieferschein.senden.titel', { nummer: ls.nummer_label })} size="lg" onClose={busy ? () => {} : onClose}>
      <div className="dialog-body">
        <Segmented
          options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'E-Mail' },
          ]}
          value={kanal}
          onChange={setKanal}
        />
        {mitarbeiter?.benachrichtigungsart && (
          <p className="field-hint">
            {t('lieferschein.senden.bevorzugt', { name: values.Mitarbeitername, kanal: mitarbeiter.benachrichtigungsart === 'email' ? 'E-Mail' : 'WhatsApp' })}
          </p>
        )}

        <Field label={kanal === 'whatsapp' ? t('lieferschein.senden.handynummer') : t('lieferschein.senden.emailadresse')}>
          <input
            type={kanal === 'whatsapp' ? 'tel' : 'email'}
            value={recipient}
            onChange={(event) => setEdit('recipient', event.target.value)}
            placeholder={kanal === 'whatsapp' ? '+49 170 1234567' : 'name@firma.de'}
          />
        </Field>
        {!recipientValid && <p className="login-error">{t(kanal === 'whatsapp' ? 'lieferschein.senden.nummerFehlt' : 'lieferschein.senden.mailFehlt')}</p>}

        {kanal === 'email' && (
          <Field label={t('vorlagen.subjectLabel')}>
            <input value={subject} onChange={(event) => setEdit('subject', event.target.value)} />
          </Field>
        )}
        <Field label={t('lieferschein.senden.nachricht')}>
          <textarea rows={kanal === 'email' ? 9 : 6} value={text} onChange={(event) => setEdit('text', event.target.value)} />
        </Field>
        <p className="field-hint">{t('lieferschein.senden.hinweis')}</p>
        {error && <p className="login-error">{error}</p>}
      </div>
      <div className="dialog-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-primary" onClick={send} disabled={busy || !recipientValid}>
          {kanal === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />}
          {busy ? t('lieferschein.senden.bereite') : kanal === 'whatsapp' ? t('lieferschein.senden.whatsappOeffnen') : t('lieferschein.senden.mailOeffnen')}
          {!busy && <Send size={14} />}
        </button>
      </div>
    </Dialog>
  )
}
