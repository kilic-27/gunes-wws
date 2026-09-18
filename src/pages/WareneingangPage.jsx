import { useMemo, useState } from 'react'
import { PackagePlus } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Field from '../components/ui/Field.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { formatDateDE } from '../lib/date.js'

const emptyForm = { artikel_id: '', lager_id: '', menge: '', barcode: '', seriennummer: '', notiz: '' }

export default function WareneingangPage({ breadcrumb, title }) {
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
      setError('Bitte Artikel und Lager auswählen.')
      return
    }

    setSubmitting(true)
    try {
      if (isVerbrauch) {
        const menge = Number(values.menge)
        if (!menge || menge <= 0) {
          throw new Error('Bitte eine Menge größer 0 eingeben.')
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
        setSuccess(`${menge} × „${selectedArtikel.name}“ erfasst.`)
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
        setSuccess(`„${selectedArtikel.name}“ als neues Stück erfasst.`)
        setValues((current) => ({ ...current, barcode: '', seriennummer: '', notiz: '' }))
      } else {
        throw new Error('Bitte zuerst einen Artikel auswählen.')
      }
    } catch (err) {
      setError(err?.message || 'Erfassen fehlgeschlagen.')
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
          menge_stueck: row.menge != null ? `${row.menge} ${art?.vpe || ''}`.trim() : stk?.barcode ? `1 Stück (${stk.barcode})` : '1 Stück',
        }
      }),
    [wareneingaengeTable.rows, artikelMap, lagerMap, stueckMap],
  )

  const logColumns = [
    {
      key: 'artikel_name',
      label: 'Artikel',
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.artikel_foto} isPublic name={row.artikel_name} />,
    },
    { key: 'menge_stueck', label: 'Menge / Stück' },
    { key: 'lager_name', label: 'Lager', sortable: true },
    { key: 'eingang_am', label: 'Datum', sortable: true, render: (row) => formatDateDE(row.eingang_am) },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>

      <form className="wareneingang-form" onSubmit={handleSubmit}>
        <div className="field-row">
          <Field label="Artikel">
            <select
              required
              value={values.artikel_id}
              onChange={(event) => updateField('artikel_id', event.target.value)}
            >
              <option value="">– Bitte wählen –</option>
              {artikelOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lager">
            <select required value={values.lager_id} onChange={(event) => updateField('lager_id', event.target.value)}>
              <option value="">– Bitte wählen –</option>
              {lagerOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.bezeichnung}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isVerbrauch && (
          <Field label={`Menge${selectedArtikel?.vpe ? ` (${selectedArtikel.vpe})` : ''}`}>
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
            <Field label="Barcode">
              <input value={values.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
            </Field>
            <Field label="Seriennummer">
              <input
                value={values.seriennummer}
                onChange={(event) => updateField('seriennummer', event.target.value)}
              />
            </Field>
          </div>
        )}

        <Field label="Notiz (optional)">
          <input value={values.notiz} onChange={(event) => updateField('notiz', event.target.value)} />
        </Field>

        {error && <p className="login-error">{error}</p>}
        {success && <p className="login-success">{success}</p>}

        <button type="submit" className="btn btn-primary" disabled={submitting || !values.artikel_id}>
          <PackagePlus size={16} />
          {submitting ? 'Erfasst…' : 'Erfassen'}
        </button>
      </form>

      <h2 className="section-title">Letzte Wareneingänge</h2>
      <DataTable
        columns={logColumns}
        rows={logRows}
        loading={wareneingaengeTable.loading}
        searchPlaceholder="Wareneingänge durchsuchen…"
        emptyMessage="Es wurden noch keine Wareneingänge erfasst."
      />
    </div>
  )
}
