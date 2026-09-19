import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Field from '../components/ui/Field.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

function toValues(row) {
  return {
    firmenname: row.firmenname ?? '',
    standard_sprache_id: row.standard_sprache_id ?? '',
    standard_land_id: row.standard_land_id ?? '',
    standard_lager_id: row.standard_lager_id ?? '',
    zeitzone: row.zeitzone ?? '',
    datumsformat: row.datumsformat ?? '',
    standardwaehrung: row.standardwaehrung ?? '',
    standard_mwst_satz: row.standard_mwst_satz ?? '',
    support_email: row.support_email ?? '',
  }
}

export default function AllgemeinPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, update } = useSupabaseTable('einstellungen_allgemein', { orderBy: 'id', ascending: true })
  const { rows: sprachen } = useSupabaseTable('sprachen', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })

  const [values, setValues] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (rows[0] && !values) {
      setValues(toValues(rows[0]))
    }
  }, [rows, values])

  function updateField(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const payload = {
        ...values,
        standard_sprache_id: values.standard_sprache_id || null,
        standard_land_id: values.standard_land_id || null,
        standard_lager_id: values.standard_lager_id || null,
        standard_mwst_satz: values.standard_mwst_satz === '' ? null : Number(values.standard_mwst_satz),
      }
      await update(1, payload)
      setSuccess(t('allgemein.saved'))
    } catch (err) {
      setError(err?.message || t('common.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const sprachenOptions = sprachen.filter((s) => s.aktiv)
  const laenderOptions = laender.filter((l) => l.aktiv)
  const lagerOptions = lager.filter((l) => l.aktiv)

  if (loading || !values) {
    return (
      <div className="page">
        <Breadcrumb items={breadcrumb} />
        <h1 className="page-title">{title}</h1>
        <p>{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>

      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label={t('allgemein.firmenname')}>
          <input value={values.firmenname} onChange={(event) => updateField('firmenname', event.target.value)} />
        </Field>

        <div className="field-row">
          <Field label={t('fields.standardSprache')}>
            <select
              value={values.standard_sprache_id}
              onChange={(event) => updateField('standard_sprache_id', event.target.value)}
            >
              <option value="">{t('common.noSelection')}</option>
              {sprachenOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fields.standardLand')}>
            <select
              value={values.standard_land_id}
              onChange={(event) => updateField('standard_land_id', event.target.value)}
            >
              <option value="">{t('common.noSelection')}</option>
              {laenderOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t('fields.standardLager')}>
          <select
            value={values.standard_lager_id}
            onChange={(event) => updateField('standard_lager_id', event.target.value)}
          >
            <option value="">{t('common.noSelection')}</option>
            {lagerOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.bezeichnung}
              </option>
            ))}
          </select>
        </Field>

        <div className="field-row">
          <Field label={t('allgemein.zeitzone')}>
            <input value={values.zeitzone} onChange={(event) => updateField('zeitzone', event.target.value)} />
          </Field>
          <Field label={t('allgemein.datumsformat')}>
            <input
              value={values.datumsformat}
              onChange={(event) => updateField('datumsformat', event.target.value)}
            />
          </Field>
        </div>

        <div className="field-row">
          <Field label={t('allgemein.standardwaehrung')}>
            <input
              value={values.standardwaehrung}
              onChange={(event) => updateField('standardwaehrung', event.target.value)}
            />
          </Field>
          <Field label={t('allgemein.mwstSatz')}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.standard_mwst_satz}
              onChange={(event) => updateField('standard_mwst_satz', event.target.value)}
            />
          </Field>
        </div>

        <Field label={t('allgemein.supportEmail')}>
          <input
            type="email"
            value={values.support_email}
            onChange={(event) => updateField('support_email', event.target.value)}
          />
        </Field>

        {error && <p className="login-error">{error}</p>}
        {success && <p className="login-success">{success}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Save size={16} />
          {submitting ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  )
}
