import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { formatDateTimeDE } from '../lib/date.js'
import { formatMenge } from '../lib/lieferschein.js'

/** Nur zur Ansicht: welche Artikel gelöscht wurden, wann, von wem und warum. */
export default function GeloeschteArtikelPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading } = useSupabaseTable('artikel', { orderBy: 'geloescht_am', ascending: false, nurGeloeschte: true })
  const stueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false, nurGeloeschte: true })
  const verbrauchTable = useSupabaseTable('bestand_verbrauch', { orderBy: 'erstellt_am', ascending: false, nurGeloeschte: true })
  const [typFilter, setTypFilter] = useState('alle')

  const TYP_LABELS = {
    verbrauchsmaterial: { label: t('katalog.typVerbrauchsmaterial'), tone: 'blue' },
    werkzeug: { label: t('katalog.typWerkzeug'), tone: 'amber' },
  }

  const stueckByArtikel = useMemo(() => {
    const map = new Map()
    for (const s of stueckTable.rows) {
      if (!map.has(s.artikel_id)) map.set(s.artikel_id, [])
      map.get(s.artikel_id).push(s)
    }
    return map
  }, [stueckTable.rows])

  const restByArtikel = useMemo(() => {
    const map = new Map()
    for (const v of verbrauchTable.rows) map.set(v.artikel_id, (map.get(v.artikel_id) ?? 0) + Number(v.menge))
    return map
  }, [verbrauchTable.rows])

  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const stuecke = stueckByArtikel.get(row.id) ?? []
        return {
          ...row,
          stuecke_text: stuecke.map((s) => s.barcode).filter(Boolean).join(', '),
          rest_menge: restByArtikel.get(row.id) ?? null,
        }
      }),
    [rows, stueckByArtikel, restByArtikel],
  )

  const filtered = useMemo(() => (typFilter === 'alle' ? enriched : enriched.filter((row) => row.typ === typFilter)), [enriched, typFilter])

  const typOptions = [
    { value: 'alle', label: t('common.all') },
    { value: 'werkzeug', label: t('katalog.typWerkzeug') },
    { value: 'verbrauchsmaterial', label: t('katalog.typVerbrauchsmaterial') },
  ]

  const columns = [
    {
      key: 'name',
      label: t('fields.name'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.foto_url} isPublic name={row.name} />,
    },
    {
      key: 'typ',
      label: t('fields.typ'),
      sortable: true,
      render: (row) => {
        const meta = TYP_LABELS[row.typ] ?? { label: row.typ, tone: 'gray' }
        return <Badge label={meta.label} tone={meta.tone} />
      },
    },
    { key: 'barcode', label: t('fields.barcode'), sortable: true, render: (row) => row.stuecke_text || row.barcode || '–' },
    {
      key: 'rest_menge',
      label: t('geloescht.colRest'),
      sortable: true,
      render: (row) => (row.rest_menge == null ? '–' : `${formatMenge(row.rest_menge)} ${row.vpe || 'Stück'}`),
    },
    {
      key: 'geloescht_am',
      label: t('geloescht.colAm'),
      sortable: true,
      render: (row) => (row.geloescht_am ? formatDateTimeDE(row.geloescht_am) : '–'),
    },
    { key: 'geloescht_von', label: t('geloescht.colVon'), sortable: true, render: (row) => row.geloescht_von || '–' },
    {
      key: 'geloescht_grund',
      label: t('geloescht.colGrund'),
      render: (row) => <span style={{ whiteSpace: 'pre-wrap' }}>{row.geloescht_grund || '–'}</span>,
    },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
      </div>
      <div className="page-stack">
        <p className="field-hint">{t('geloescht.hint')}</p>
        <Segmented options={typOptions} value={typFilter} onChange={setTypFilter} />
      </div>
      <DataTable
        columns={columns}
        statusChips={false}
        rows={filtered}
        loading={loading || stueckTable.loading || verbrauchTable.loading}
        searchPlaceholder={t('geloescht.searchPlaceholder')}
        emptyMessage={t('geloescht.empty')}
        searchKeys={['geloescht_grund', 'geloescht_von', 'barcode', 'stuecke_text']}
      />
    </div>
  )
}
