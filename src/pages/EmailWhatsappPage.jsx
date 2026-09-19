import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Field from '../components/ui/Field.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const KANAELE = ['email', 'whatsapp']

function substitute(text, platzhalter) {
  if (!text) return ''
  let result = text
  for (const p of platzhalter) {
    if (!p.key) continue
    result = result.split(p.key).join(p.beispielwert ?? p.key)
  }
  return result
}

export default function EmailWhatsappPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows: ereignisse } = useSupabaseTable('benachrichtigungs_ereignisse', { orderBy: 'name', ascending: true })
  const { rows: sprachen } = useSupabaseTable('sprachen', { orderBy: 'name', ascending: true })
  const { rows: platzhalter } = useSupabaseTable('platzhalter', { orderBy: 'key', ascending: true })
  const { rows: vorlagen, insert, update } = useSupabaseTable('nachrichtenvorlagen')

  const sprachenOptions = useMemo(() => sprachen.filter((s) => s.aktiv), [sprachen])

  const [ereignisId, setEreignisId] = useState('')
  const [spracheId, setSpracheId] = useState('')
  const [kanal, setKanal] = useState('email')
  const [betreff, setBetreff] = useState('')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!ereignisId && ereignisse.length > 0) setEreignisId(ereignisse[0].id)
  }, [ereignisse, ereignisId])

  useEffect(() => {
    if (!spracheId && sprachenOptions.length > 0) setSpracheId(sprachenOptions[0].id)
  }, [sprachenOptions, spracheId])

  const currentVorlage = useMemo(
    () => vorlagen.find((v) => v.ereignis_id === ereignisId && v.sprache_id === spracheId && v.kanal === kanal),
    [vorlagen, ereignisId, spracheId, kanal],
  )

  useEffect(() => {
    setBetreff(currentVorlage?.betreff ?? '')
    setText(currentVorlage?.text ?? '')
    setSuccess('')
    setError('')
  }, [currentVorlage])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const payload = {
        ereignis_id: ereignisId,
        sprache_id: spracheId,
        kanal,
        betreff: kanal === 'email' ? betreff || null : null,
        text: text || null,
      }
      if (currentVorlage) {
        await update(currentVorlage.id, payload)
      } else {
        await insert(payload)
      }
      setSuccess(t('vorlagen.savedHint'))
    } catch (err) {
      setError(err?.message || t('common.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const previewBetreff = substitute(betreff, platzhalter)
  const previewText = substitute(text, platzhalter)

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>

      <div className="field-row">
        <Field label={t('vorlagen.eventLabel')}>
          <select value={ereignisId} onChange={(event) => setEreignisId(event.target.value)}>
            {ereignisse.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('vorlagen.languageLabel')}>
          <select value={spracheId} onChange={(event) => setSpracheId(event.target.value)}>
            {sprachenOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('vorlagen.channelLabel')}>
          <select value={kanal} onChange={(event) => setKanal(event.target.value)}>
            {KANAELE.map((k) => (
              <option key={k} value={k}>
                {t(`vorlagen.channel_${k}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="vorlagen-layout">
        <form className="settings-form vorlagen-form" onSubmit={handleSubmit}>
          {kanal === 'email' && (
            <Field label={t('vorlagen.subjectLabel')}>
              <input
                value={betreff}
                onChange={(event) => setBetreff(event.target.value)}
                placeholder={t('vorlagen.subjectPlaceholder')}
              />
            </Field>
          )}
          <Field label={t('vorlagen.textLabel')}>
            <textarea
              rows={10}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('vorlagen.textPlaceholder')}
            />
          </Field>

          {error && <p className="login-error">{error}</p>}
          {success && <p className="login-success">{success}</p>}

          <button type="submit" className="btn btn-primary" disabled={submitting || !ereignisId || !spracheId}>
            <Save size={16} />
            {submitting ? t('common.saving') : t('common.save')}
          </button>
        </form>

        <aside className="vorlagen-side">
          <div className="vorlagen-preview">
            <h2>{t('vorlagen.previewTitle')}</h2>
            {kanal === 'email' && previewBetreff && <p className="vorlagen-preview-subject">{previewBetreff}</p>}
            <p className="vorlagen-preview-text">{previewText || t('vorlagen.emptyPreview')}</p>
          </div>

          <div className="vorlagen-placeholders">
            <h2>{t('vorlagen.placeholdersTitle')}</h2>
            <ul>
              {platzhalter.map((p) => (
                <li key={p.id}>
                  <code>{p.key}</code>
                  {p.beschreibung && <span> — {p.beschreibung}</span>}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
