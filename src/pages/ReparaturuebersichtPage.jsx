import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Dialog from '../components/ui/Dialog.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { daysBetween, formatDateDE } from '../lib/date.js'

function mitarbeiterName(m) {
  if (!m) return '–'
  return `${m.vorname} ${m.nachname}`.trim()
}

export default function ReparaturuebersichtPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows: artikel } = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const { rows: mitarbeiter } = useSupabaseTable('mitarbeiter', { orderBy: 'nachname', ascending: true })
  const { rows: stueck } = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const { rows: reparaturen, loading } = useSupabaseTable('reparaturen', { orderBy: 'gemeldet_am', ascending: false })

  const [filter, setFilter] = useState('offen')
  const [historyFor, setHistoryFor] = useState(null) // bestand_stueck_id

  const FILTER_OPTIONS = [
    { value: 'offen', label: t('reparatur.filterOffen') },
    { value: 'alle', label: t('common.all') },
  ]
  const STATUS_META = {
    offen: { label: t('reparatur.statusOffen'), tone: 'amber' },
    abgeschlossen: { label: t('reparatur.statusAbgeschlossen'), tone: 'green' },
  }

  const artikelMap = useMemo(() => new Map(artikel.map((a) => [a.id, a])), [artikel])
  const lagerMap = useMemo(() => new Map(lager.map((l) => [l.id, l.bezeichnung])), [lager])
  const mitarbeiterMap = useMemo(() => new Map(mitarbeiter.map((m) => [m.id, m])), [mitarbeiter])
  const stueckMap = useMemo(() => new Map(stueck.map((s) => [s.id, s])), [stueck])

  const enrichedRows = useMemo(
    () =>
      reparaturen.map((r) => {
        const stk = stueckMap.get(r.bestand_stueck_id)
        const art = stk ? artikelMap.get(stk.artikel_id) : null
        return {
          ...r,
          barcode: stk?.barcode || '–',
          lager_name: stk ? lagerMap.get(stk.lager_id) ?? '–' : '–',
          artikel_name: art?.name ?? '–',
          artikel_foto: art?.foto_url ?? null,
          tage: daysBetween(r.gemeldet_am, r.repariert_am),
        }
      }),
    [reparaturen, stueckMap, artikelMap, lagerMap],
  )

  const filteredRows = useMemo(
    () => (filter === 'offen' ? enrichedRows.filter((r) => r.status === 'offen') : enrichedRows),
    [enrichedRows, filter],
  )

  const historyRows = useMemo(() => {
    if (!historyFor) return []
    return reparaturen
      .filter((r) => r.bestand_stueck_id === historyFor)
      .slice()
      .sort((a, b) => (a.gemeldet_am < b.gemeldet_am ? 1 : -1))
  }, [reparaturen, historyFor])

  const historyStueck = historyFor ? stueckMap.get(historyFor) : null
  const historyArtikel = historyStueck ? artikelMap.get(historyStueck.artikel_id) : null

  const columns = [
    {
      key: 'artikel_name',
      label: t('fields.artikel'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.artikel_foto} isPublic name={row.artikel_name} />,
    },
    { key: 'barcode', label: t('fields.barcode'), sortable: true },
    { key: 'lager_name', label: t('fields.lager'), sortable: true },
    { key: 'gemeldet_am', label: t('reparatur.colGemeldetAm'), sortable: true, render: (row) => formatDateDE(row.gemeldet_am) },
    {
      key: 'tage',
      label: t('reparatur.colTageSeitDefekt'),
      sortable: true,
      render: (row) => (row.tage == null ? '–' : row.tage),
    },
    {
      key: 'status',
      label: t('common.status'),
      sortable: true,
      render: (row) => {
        const meta = STATUS_META[row.status] ?? { label: row.status, tone: 'gray' }
        return <Badge label={meta.label} tone={meta.tone} />
      },
    },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>

      <Segmented options={FILTER_OPTIONS} value={filter} onChange={setFilter} />

      <DataTable
        columns={columns}
        rows={filteredRows}
        loading={loading}
        getRowId={(row) => row.id}
        searchPlaceholder={t('reparatur.searchPlaceholder')}
        emptyMessage={t('reparatur.emptyMessage')}
        onRowClick={(row) => setHistoryFor(row.bestand_stueck_id)}
      />

      <Dialog
        open={Boolean(historyFor)}
        title={historyArtikel ? t('reparatur.historyTitleWithName', { name: historyArtikel.name }) : t('reparatur.historyTitle')}
        onClose={() => setHistoryFor(null)}
      >
        <div className="dialog-body">
          {historyStueck?.barcode && (
            <p className="field-hint">{t('reparatur.barcodeLabel', { barcode: historyStueck.barcode })}</p>
          )}
          {historyRows.length === 0 && <p>{t('reparatur.historyEmpty')}</p>}
          {historyRows.map((entry) => {
            const meta = STATUS_META[entry.status] ?? { label: entry.status, tone: 'gray' }
            return (
              <div key={entry.id} className="history-entry">
                <div className="history-entry-row">
                  <span>
                    <strong>{t('reparatur.historyGemeldet')}</strong> {formatDateDE(entry.gemeldet_am)}
                  </span>
                  <Badge label={meta.label} tone={meta.tone} />
                </div>
                <div className="history-entry-row">
                  <span>
                    <strong>{t('reparatur.historyRepariert')}</strong> {formatDateDE(entry.repariert_am)}
                  </span>
                  <span>{mitarbeiterName(mitarbeiterMap.get(entry.repariert_von))}</span>
                </div>
                {entry.notiz && <p className="cell-person-sub">{entry.notiz}</p>}
              </div>
            )
          })}
        </div>
      </Dialog>
    </div>
  )
}
