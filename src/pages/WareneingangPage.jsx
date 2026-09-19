import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PackagePlus } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Field from '../components/ui/Field.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { formatDateDE } from '../lib/date.js'

const emptyForm = { artikel_id: '', lager_id: '', menge: '', barcode: '', seriennummer: '', notiz: '' }

export default function WareneingangPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows: artikel } = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const bestandVerbrauchTable = useSupabaseTable('bestand_verbrauch', { orderBy: 'erstellt_am', ascending: false })
  const bestandStueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const wareneingaengeTable = useSupabaseTable('wareneingaenge', { orderBy: 'eingang_am', ascending: false })

  const [values, setValues] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const artikelMap = useMemo(() => new Map(artikel.map((a) => [a.id, a])), [artikel])
  const lagerMap = useMemo(() => new Map(lager.map((l) => [l.id, l.bezeichnung])), [lager])
  const stueckMap = useMemo(() => new Map(bestandStueckTable.rows.map((s) => [s.id, s])), [bestandStueckTable.rows])

  const artikelOptions = useMemo(() => artikel.filter((a) => a.aktiv), [artikel])
  const lagerOptions = useMemo(() => lager.filter((l) => l.aktiv), [lager])

  const selectedArtikel = artikelMap.get(values.artikel_id)
  const isVerbrauch = selectedArtikel?.typ === 'verbrauchsmaterial'
  const isWerkzeug = selectedArtikel?.typ === 'werkzeug'

  function updateField(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!values.artikel_id || !values.lager_id) {
      setError(t('wareneingang.errArtikelLager'))
      return
    }

    setSubmitting(true)
    try {
      if (isVerbrauch) {
        const menge = Number(values.menge)
        if (!menge || menge <= 0) {
          throw new Error(t('wareneingang.errMenge'))
        }
        const existing = bestandVerbrauchTable.rows.find(
          (r) => r.artikel_id === values.artikel_id && r.lager_id === values.lager_id,
        )
        if (existing) {
          await bestandVerbrauchTable.update(existing.id, { menge: Number(existing.menge) + menge })
        } else {
          await bestandVerbrauchTable.insert({ artikel_id: values.artikel_id, lager_id: values.lager_id, menge })
        }
        await wareneingaengeTable.insert({
          artikel_id: values.artikel_id,
          lager_id: values.lager_id,
          menge,
          notiz: values.notiz || null,
        })
        setSuccess(t('wareneingang.successVerbrauch', { menge, name: selectedArtikel.name }))
        setValues((current) => ({ ...current, menge: '', notiz: '' }))
      } else if (isWerkzeug) {
        const neuesStueck = await bestandStueckTable.insert({
          artikel_id: values.artikel_id,
          barcode: values.barcode || null,
          seriennummer: values.seriennummer || null,
          lager_id: values.lager_id,
        })
        await wareneingaengeTable.insert({
          artikel_id: values.artikel_id,
          lager_id: values.lager_id,
          bestand_stueck_id: neuesStueck.id,
          notiz: values.notiz || null,
        })
        setSuccess(t('wareneingang.successStueck', { name: selectedArtikel.name }))
        setValues((current) => ({ ...current, barcode: '', seriennummer: '', notiz: '' }))
      } else {
        throw new Error(t('wareneingang.errArtikelFirst'))
      }
    } catch (err) {
      setError(err?.message || t('wareneingang.errFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const logRows = useMemo(
    () =>
      wareneingaengeTable.rows.map((row) => {
        const art = artikelMap.get(row.artikel_id)
        const stk = row.bestand_stueck_id ? stueckMap.get(row.bestand_stueck_id) : null
        return {
          ...row,
          artikel_name: art?.name ?? '–',
          artikel_foto: art?.foto_url ?? null,
          lager_name: lagerMap.get(row.lager_id) ?? '–',
          menge_stueck:
            row.menge != null
              ? `${row.menge} ${art?.vpe || ''}`.trim()
              : stk?.barcode
                ? t('wareneingang.stueckMitBarcode', { barcode: stk.barcode })
                : t('wareneingang.stueckOhne'),
        }
      }),
    [wareneingaengeTable.rows, artikelMap, lagerMap, stueckMap, t],
  )

  const logColumns = [
    {
      key: 'artikel_name',
      label: t('fields.artikel'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.artikel_foto} isPublic name={row.artikel_name} />,
    },
    { key: 'menge_stueck', label: t('wareneingang.colMengeStueck') },
    { key: 'lager_name', label: t('fields.lager'), sortable: true },
    { key: 'eingang_am', label: t('wareneingang.colDatum'), sortable: true, render: (row) => formatDateDE(row.eingang_am) },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>

      <form className="wareneingang-form" onSubmit={handleSubmit}>
        <div className="field-row">
          <Field label={t('fields.artikel')}>
            <select
              required
              value={values.artikel_id}
              onChange={(event) => updateField('artikel_id', event.target.value)}
            >
              <option value="">{t('common.pleaseSelect')}</option>
              {artikelOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fields.lager')}>
            <select required value={values.lager_id} onChange={(event) => updateField('lager_id', event.target.value)}>
              <option value="">{t('common.pleaseSelect')}</option>
              {lagerOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.bezeichnung}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isVerbrauch && (
          <Field label={`${t('fields.menge')}${selectedArtikel?.vpe ? ` (${selectedArtikel.vpe})` : ''}`}>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={values.menge}
              onChange={(event) => updateField('menge', event.target.value)}
            />
          </Field>
        )}

        {isWerkzeug && (
          <div className="field-row">
            <Field label={t('fields.barcode')}>
              <input value={values.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
            </Field>
            <Field label={t('fields.seriennummer')}>
              <input
                value={values.seriennummer}
                onChange={(event) => updateField('seriennummer', event.target.value)}
              />
            </Field>
          </div>
        )}

        <Field label={t('fields.notizOptional')}>
          <input value={values.notiz} onChange={(event) => updateField('notiz', event.target.value)} />
        </Field>

        {error && <p className="login-error">{error}</p>}
        {success && <p className="login-success">{success}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting || !values.artikel_id}>
          <PackagePlus size={16} />
          {submitting ? t('wareneingang.submitting') : t('wareneingang.submitButton')}
        </button>
      </form>

      <h2 className="section-title">{t('wareneingang.logTitle')}</h2>
      <DataTable
        columns={logColumns}
        rows={logRows}
        loading={wareneingaengeTable.loading}
        searchPlaceholder={t('wareneingang.logSearchPlaceholder')}
        emptyMessage={t('wareneingang.logEmptyMessage')}
      />
    </div>
  )
}
