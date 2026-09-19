import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Dialog from '../components/ui/Dialog.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { daysBetween, formatDateDE, todayISO } from '../lib/date.js'

function mitarbeiterName(m) {
  if (!m) return '–'
  return `${m.vorname} ${m.nachname}`.trim()
}

export default function LeihartikelPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows: artikel } = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const { rows: mitarbeiter } = useSupabaseTable('mitarbeiter', { orderBy: 'nachname', ascending: true })
  const { rows: stueck } = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const { rows: leihvorgaenge, loading } = useSupabaseTable('leihvorgaenge', {
    orderBy: 'ausgeliehen_am',
    ascending: false,
  })

  const [filter, setFilter] = useState('verliehen')
  const [historyFor, setHistoryFor] = useState(null) // bestand_stueck_id

  const FILTER_OPTIONS = [
    { value: 'verliehen', label: t('leihartikel.filterVerliehen') },
    { value: 'alle', label: t('common.all') },
  ]
  const STATUS_META = {
    verliehen: { label: t('leihartikel.statusVerliehen'), tone: 'blue' },
    zurueckgegeben: { label: t('leihartikel.statusZurueckgegeben'), tone: 'green' },
  }

  const artikelMap = useMemo(() => new Map(artikel.map((a) => [a.id, a])), [artikel])
  const lagerMap = useMemo(() => new Map(lager.map((l) => [l.id, l.bezeichnung])), [lager])
  const mitarbeiterMap = useMemo(() => new Map(mitarbeiter.map((m) => [m.id, m])), [mitarbeiter])
  const stueckMap = useMemo(() => new Map(stueck.map((s) => [s.id, s])), [stueck])

  const today = todayISO()

  const enrichedRows = useMemo(
    () =>
      leihvorgaenge.map((l) => {
        const stk = stueckMap.get(l.bestand_stueck_id)
        const art = stk ? artikelMap.get(stk.artikel_id) : null
        return {
          ...l,
          barcode: stk?.barcode || '–',
          lager_name: stk ? lagerMap.get(stk.lager_id) ?? '–' : '–',
          artikel_name: art?.name ?? '–',
          artikel_foto: art?.foto_url ?? null,
          mitarbeiter_name: mitarbeiterName(mitarbeiterMap.get(l.mitarbeiter_id)),
          tage: daysBetween(l.ausgeliehen_am, l.rueckgabe_am),
          ueberfaellig: l.status === 'verliehen' && l.rueckgabe_geplant_am && l.rueckgabe_geplant_am < today,
        }
      }),
    [leihvorgaenge, stueckMap, artikelMap, lagerMap, mitarbeiterMap, today],
  )

  const filteredRows = useMemo(
    () => (filter === 'verliehen' ? enrichedRows.filter((r) => r.status === 'verliehen') : enrichedRows),
    [enrichedRows, filter],
  )

  const historyRows = useMemo(() => {
    if (!historyFor) return []
    return leihvorgaenge
      .filter((l) => l.bestand_stueck_id === historyFor)
      .slice()
      .sort((a, b) => (a.ausgeliehen_am < b.ausgeliehen_am ? 1 : -1))
  }, [leihvorgaenge, historyFor])

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
    { key: 'mitarbeiter_name', label: t('leihartikel.colAnWen'), sortable: true },
    { key: 'ausgeliehen_am', label: t('leihartikel.colSeitWann'), sortable: true, render: (row) => formatDateDE(row.ausgeliehen_am) },
    {
      key: 'tage',
      label: t('leihartikel.colTageVerliehen'),
      sortable: true,
      render: (row) => (row.tage == null ? '–' : row.tage),
    },
    {
      key: 'rueckgabe_geplant_am',
      label: t('leihartikel.colRueckgabeGeplant'),
      sortable: true,
      render: (row) =>
        row.rueckgabe_geplant_am ? (
          <span className={row.ueberfaellig ? 'text-danger' : undefined}>
            {formatDateDE(row.rueckgabe_geplant_am)}
            {row.ueberfaellig && t('leihartikel.ueberfaellig')}
          </span>
        ) : (
          '–'
        ),
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
        searchPlaceholder={t('leihartikel.searchPlaceholder')}
        emptyMessage={t('leihartikel.emptyMessage')}
        onRowClick={(row) => setHistoryFor(row.bestand_stueck_id)}
      />

      <Dialog
        open={Boolean(historyFor)}
        title={historyArtikel ? t('leihartikel.historyTitleWithName', { name: historyArtikel.name }) : t('leihartikel.historyTitle')}
        onClose={() => setHistoryFor(null)}
      >
        <div className="dialog-body">
          {historyStueck?.barcode && (
            <p className="field-hint">{t('leihartikel.barcodeLabel', { barcode: historyStueck.barcode })}</p>
          )}
          {historyRows.length === 0 && <p>{t('leihartikel.historyEmpty')}</p>}
          {historyRows.map((entry) => {
            const meta = STATUS_META[entry.status] ?? { label: entry.status, tone: 'gray' }
            return (
              <div key={entry.id} className="history-entry">
                <div className="history-entry-row">
                  <span>
                    <strong>{mitarbeiterName(mitarbeiterMap.get(entry.mitarbeiter_id))}</strong>
                  </span>
                  <Badge label={meta.label} tone={meta.tone} />
                </div>
                <div className="history-entry-row">
                  <span>{t('leihartikel.historyAusgeliehen', { date: formatDateDE(entry.ausgeliehen_am) })}</span>
                  <span>{t('leihartikel.historyRueckgabe', { date: formatDateDE(entry.rueckgabe_am) })}</span>
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
