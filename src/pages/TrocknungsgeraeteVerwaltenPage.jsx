import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Euro, Layers, PackagePlus } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { euro, useTrocknung } from '../lib/trocknung.js'

/**
 * Modell-Verwaltung: alle Geräte eines Modells auf einen Blick, Tagespreis für ein ganzes
 * Modell auf einmal setzen und mehrere Geräte mit fortlaufenden Barcodes anlegen.
 */
export default function TrocknungsgeraeteVerwaltenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const data = useTrocknung()
  const [dialog, setDialog] = useState(null)
  const [price, setPrice] = useState('')
  const [bulk, setBulk] = useState({ name: '', gruppe_id: '', lager_id: '', tagespreis: '', anzahl: 1 })

  const modelle = useMemo(() => {
    const map = new Map()
    for (const g of data.rows) {
      const key = `${g.name}|${g.gruppe_id ?? ''}`
      const m = map.get(key) ?? { key, name: g.name, gruppe_id: g.gruppe_id, gruppe_name: g.gruppe_name, gesamt: 0, verfuegbar: 0, verliehen: 0, defekt: 0, preise: new Set(), ids: [] }
      m.gesamt += 1
      if (g.status === 'verfuegbar') m.verfuegbar += 1
      if (g.status === 'verliehen') m.verliehen += 1
      if (g.status === 'defekt' || g.status === 'verlust' || g.status === 'reparatur') m.defekt += 1
      m.preise.add(g.tagespreis_num)
      m.ids.push(g.id)
      map.set(key, m)
    }
    return [...map.values()].map((m) => ({
      ...m,
      preis_text: m.preise.size === 1 ? euro([...m.preise][0]) : `${euro(Math.min(...m.preise))} – ${euro(Math.max(...m.preise))}`,
      preis_min: Math.min(...m.preise),
    }))
  }, [data.rows])

  function openPrice(m) {
    setPrice(m.preise.size === 1 ? String([...m.preise][0]) : '')
    setDialog({ mode: 'preis', modell: m })
  }

  function openBulk(m) {
    setBulk({
      name: m?.name ?? '',
      gruppe_id: m?.gruppe_id ?? '',
      lager_id: data.lager.rows.find((l) => l.aktiv && /günes/i.test(l.bezeichnung))?.id ?? '',
      tagespreis: m && m.preise.size === 1 ? String([...m.preise][0]) : '',
      anzahl: 1,
    })
    setDialog({ mode: 'bulk' })
  }

  async function submitPrice() {
    const value = Number(price)
    if (!(value >= 0)) throw new Error(t('trocknung.preisUngueltig'))
    for (let i = 0; i < dialog.modell.ids.length; i += 100) {
      await data.geraete.updateMany(dialog.modell.ids.slice(i, i + 100), { tagespreis: value })
    }
  }

  async function submitBulk() {
    const count = Math.max(1, Math.min(200, Math.floor(Number(bulk.anzahl))))
    const rows = Array.from({ length: count }, () => ({
      name: bulk.name.trim(),
      gruppe_id: bulk.gruppe_id || null,
      lager_id: bulk.lager_id || null,
      tagespreis: bulk.tagespreis === '' ? 0 : Number(bulk.tagespreis),
      erstellt_von: user?.email ?? null,
    }))
    await data.geraete.insertMany(rows)
  }

  const columns = [
    {
      key: 'name',
      label: t('trocknung.modell'),
      sortable: true,
      render: (m) => (
        <div>
          <div className="cell-person-name">{m.name}</div>
          {m.gruppe_name && <div className="cell-person-sub">{m.gruppe_name}</div>}
        </div>
      ),
    },
    { key: 'gesamt', label: t('common.total'), sortable: true },
    { key: 'verfuegbar', label: t('trocknung.status.verfuegbar'), sortable: true },
    { key: 'verliehen', label: t('trocknung.status.verliehen'), sortable: true },
    { key: 'defekt', label: t('trocknung.defektVerlust'), sortable: true },
    { key: 'preis_min', label: t('trocknung.tagespreis'), sortable: true, render: (m) => m.preis_text },
    {
      key: 'actions',
      label: '',
      render: (m) => (
        <div className="data-table-row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openPrice(m)}>
            <Euro size={14} />
            {t('trocknung.tagespreisSetzen')}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openBulk(m)}>
            <PackagePlus size={14} />
            {t('trocknung.mehrAnlegen')}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <button type="button" className="btn btn-primary" onClick={() => openBulk(null)}>
          <Layers size={16} />
          {t('trocknung.mehrAnlegen')}
        </button>
      </div>
      <p className="field-hint">{t('trocknung.verwaltenHinweis')}</p>

      <DataTable
        columns={columns}
        rows={modelle}
        getRowId={(m) => m.key}
        loading={data.loading}
        statusChips={false}
        searchPlaceholder={t('trocknung.modellSuchen')}
        emptyMessage={t('trocknung.leer')}
        searchKeys={['gruppe_name']}
        filters={[{ key: 'gruppe_id', label: t('trocknung.alleGruppen'), options: data.gruppen.rows.map((g) => ({ value: g.id, label: g.name })) }]}
      />

      {dialog?.mode === 'preis' && (
        <FormDialog open title={t('trocknung.tagespreisSetzen')} onClose={() => setDialog(null)} onSubmit={submitPrice} submitLabel={t('common.save')}>
          <p>{t('trocknung.preisFuerModell', { name: dialog.modell.name, count: dialog.modell.gesamt })}</p>
          <Field label={t('trocknung.tagespreisFeld')}>
            <input type="number" min="0" step="0.01" required autoFocus value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </FormDialog>
      )}

      {dialog?.mode === 'bulk' && (
        <FormDialog open title={t('trocknung.mehrAnlegen')} onClose={() => setDialog(null)} onSubmit={submitBulk} submitLabel={t('common.create')}>
          <div className="field-row">
            <Field label={t('fields.name')}>
              <input required value={bulk.name} onChange={(e) => setBulk((b) => ({ ...b, name: e.target.value }))} />
            </Field>
            <Field label={t('trocknung.gruppe')}>
              <select value={bulk.gruppe_id} onChange={(e) => setBulk((b) => ({ ...b, gruppe_id: e.target.value }))}>
                <option value="">{t('common.noSelection')}</option>
                {data.gruppen.rows.filter((g) => g.aktiv).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label={t('fields.lager')}>
              <select value={bulk.lager_id} onChange={(e) => setBulk((b) => ({ ...b, lager_id: e.target.value }))}>
                <option value="">{t('common.noSelection')}</option>
                {data.lager.rows.filter((l) => l.aktiv).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.bezeichnung}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('trocknung.tagespreisFeld')}>
              <input type="number" min="0" step="0.01" value={bulk.tagespreis} onChange={(e) => setBulk((b) => ({ ...b, tagespreis: e.target.value }))} />
            </Field>
          </div>
          <Field label={t('trocknung.anzahl')}>
            <input type="number" min="1" max="200" required value={bulk.anzahl} onChange={(e) => setBulk((b) => ({ ...b, anzahl: e.target.value }))} />
          </Field>
          <p className="field-hint">{t('trocknung.mehrHinweis')}</p>
        </FormDialog>
      )}
    </div>
  )
}
