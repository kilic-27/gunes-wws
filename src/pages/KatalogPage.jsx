import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power, FileText, Trash2, Download, List } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import ArtikelFormDialog from '../components/katalog/ArtikelFormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import StatChips from '../components/ui/StatChips.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { supabase } from '../lib/supabaseClient.js'
import Dialog from '../components/ui/Dialog.jsx'
import { downloadCsv } from '../lib/csv.js'
import { gruppiereArtikel } from '../lib/katalogGruppen.js'
import { todayISO } from '../lib/date.js'
import { usePermissions } from '../auth/usePermissions.js'
import { showTablePdf, pdfSubtitle, pdfT } from '../lib/pdf.js'

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

const STUECK_STATUS = ['verfuegbar', 'verliehen', 'defekt', 'verlust', 'entsorgt', 'reparatur']
const statusKey = (status) => 'bestand.status' + status.charAt(0).toUpperCase() + status.slice(1)

export default function KatalogPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update, refresh } = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const { hasAccess } = usePermissions()
  const canDelete = hasAccess('artikel', 'voll')
  const [loeschDialog, setLoeschDialog] = useState(null)
  const [loeschGrund, setLoeschGrund] = useState('')
  const { rows: gewerke } = useSupabaseTable('gewerke', { orderBy: 'name', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const { rows: stueckRows } = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const { rows: allgemein } = useSupabaseTable('einstellungen_allgemein', { orderBy: 'id', ascending: true })
  const [typFilter, setTypFilter] = useState('alle')
  const [statusFilter, setStatusFilter] = useState('alle')
  const [mode, setMode] = useState('liste')
  const [ansicht, setAnsicht] = useState('gruppiert') // gruppiert: gleiche Artikel ohne Gerätenummer zusammen; einzeln: jeder Artikel
  const [gruppeKey, setGruppeKey] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const [dialog, setDialog] = useState(null)

  const TYP_LABELS = {
    verbrauchsmaterial: { label: t('katalog.typVerbrauchsmaterial'), tone: 'blue' },
    werkzeug: { label: t('katalog.typWerkzeug'), tone: 'amber' },
  }
  const TYP_FILTER_OPTIONS = [
    { value: 'alle', label: t('common.all') },
    { value: 'verbrauchsmaterial', label: t('katalog.typVerbrauchsmaterial') },
    { value: 'werkzeug', label: t('katalog.typWerkzeug') },
  ]

  const gewerkMap = useMemo(() => new Map(gewerke.map((g) => [g.id, g.name])), [gewerke])
  const lagerMap = useMemo(() => new Map(lager.map((l) => [l.id, l.bezeichnung])), [lager])

  const stueckStats = useMemo(() => {
    const map = new Map()
    for (const stueck of stueckRows) {
      const entry = map.get(stueck.artikel_id) ?? { total: 0 }
      entry.total += 1
      entry[stueck.status] = (entry[stueck.status] ?? 0) + 1
      map.set(stueck.artikel_id, entry)
    }
    return map
  }, [stueckRows])

  const rowsEnriched = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        gewerk_name: gewerkMap.get(row.gewerk_id) ?? '–',
        lager_name: lagerMap.get(row.standard_lager_id) ?? '–',
        preis_num: row.preis == null ? null : Number(row.preis),
        stueck_stats: stueckStats.get(row.id) ?? {},
        stueck_total: stueckStats.get(row.id)?.total ?? 0,
      })),
    [rows, gewerkMap, lagerMap, stueckStats],
  )

  const typRows = useMemo(
    () => (typFilter === 'alle' ? rowsEnriched : rowsEnriched.filter((row) => row.typ === typFilter)),
    [rowsEnriched, typFilter],
  )
  const counts = useMemo(
    () => ({
      alle: typRows.length,
      aktiv: typRows.filter((row) => row.aktiv).length,
      inaktiv: typRows.filter((row) => !row.aktiv).length,
    }),
    [typRows],
  )
  const filteredRows = useMemo(() => {
    if (statusFilter === 'aktiv') return typRows.filter((row) => row.aktiv)
    if (statusFilter === 'inaktiv') return typRows.filter((row) => !row.aktiv)
    if (STUECK_STATUS.includes(statusFilter)) return typRows.filter((row) => (row.stueck_stats[statusFilter] ?? 0) > 0)
    return typRows
  }, [typRows, statusFilter])

  const gruppenRows = useMemo(() => gruppiereArtikel(filteredRows, (n) => currencyFormatter.format(n)), [filteredRows])
  const gruppiert = mode === 'liste' && ansicht === 'gruppiert'
  const aktiveGruppe = gruppeKey ? gruppenRows.find((g) => g.id === gruppeKey) ?? null : null

  const statItems = [
    { key: 'alle', label: t('common.total'), value: counts.alle },
    { key: 'aktiv', label: t('katalog.statAktiv'), value: counts.aktiv },
    { key: 'inaktiv', label: t('katalog.statInaktiv'), value: counts.inaktiv, tone: 'amber' },
  ]
  if (typFilter !== 'verbrauchsmaterial') {
    for (const status of STUECK_STATUS) {
      const value = typRows.filter((row) => (row.stueck_stats[status] ?? 0) > 0).length
      if (status === 'reparatur' && value === 0) continue
      statItems.push({
        key: status,
        label: t(statusKey(status)),
        value,
        tone: status === 'defekt' || status === 'verlust' ? 'red' : undefined,
      })
    }
  }
  const tableFilters = [
    {
      key: 'gewerk_id',
      label: t('katalog.filterGewerk'),
      options: gewerke.map((g) => ({ value: g.id, label: g.name })),
    },
    {
      key: 'standard_lager_id',
      label: t('katalog.filterLager'),
      options: lager.map((l) => ({ value: l.id, label: l.bezeichnung })),
    },
  ]

  // Vollständige Katalogliste als Excel/CSV. Es gelten der gewählte Typ-Reiter und die Status-Kachel:
  // mit "Alle" und "Gesamt" kommt der ganze Katalog.
  function exportKatalogCsv() {
    const num = (value) => (value == null || value === '' ? '' : String(value).replace('.', ','))
    if (gruppiert) {
      // Gruppierte Liste: ein Artikel je Zeile (ohne Gerätenummer), mit Anzahl der Artikel und Stücke
      const spanne = (g, wert) => {
        const z = g.members.map(wert).filter((n) => n != null && !Number.isNaN(n))
        if (z.length === 0) return ''
        const min = Math.min(...z)
        const max = Math.max(...z)
        return min === max ? num(min) : `${num(min)} – ${num(max)}`
      }
      downloadCsv(
        `Katalog-gruppiert-${todayISO()}.csv`,
        [t('fields.name'), t('fields.typ'), t('fields.gewerk'), t('fields.vpe'), t('fields.preis'), t('fields.tagespreis'), t('katalog.colArtikelAnzahl'), t('katalog.colEinzelstuecke'), t('common.status')],
        gruppenRows.map((g) => [
          g.name,
          (TYP_LABELS[g.typ] ?? { label: g.typ }).label,
          g.gewerk_name === '–' ? '' : g.gewerk_name,
          g.typ === 'verbrauchsmaterial' ? g.vpe || 'Stück' : '',
          spanne(g, (m) => m.preis_num),
          g.typ === 'werkzeug' ? spanne(g, (m) => (m.tagespreis == null || m.tagespreis === '' ? null : Number(m.tagespreis))) : '',
          g.artikel_count,
          g.typ === 'werkzeug' ? g.stueck_total : '',
          g.aktiv_count === g.artikel_count ? t('common.active') : g.aktiv_count === 0 ? t('common.inactive') : t('katalog.aktivTeil', { aktiv: g.aktiv_count, gesamt: g.artikel_count }),
        ]),
      )
      return
    }
    const list = [...filteredRows].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }))
    downloadCsv(
      `Katalog-${todayISO()}.csv`,
      [
        t('fields.name'),
        t('fields.typ'),
        t('fields.barcode'),
        t('fields.gewerk'),
        t('fields.vpe'),
        t('fields.preis'),
        t('fields.tagespreis'),
        t('fields.meldebestand'),
        t('fields.lager'),
        t('katalog.colEinzelstuecke'),
        t('common.status'),
        t('fields.beschreibung'),
      ],
      list.map((row) => [
        row.name,
        (TYP_LABELS[row.typ] ?? { label: row.typ }).label,
        row.barcode || '',
        row.gewerk_name === '–' ? '' : row.gewerk_name,
        row.typ === 'verbrauchsmaterial' ? row.vpe || 'Stück' : '',
        num(row.preis),
        row.typ === 'werkzeug' ? num(row.tagespreis) : '',
        num(row.meldebestand),
        row.lager_name === '–' ? '' : row.lager_name,
        row.typ === 'werkzeug' ? row.stueck_total : '',
        row.aktiv ? t('common.active') : t('common.inactive'),
        row.beschreibung || '',
      ]),
    )
  }

  async function exportBarcodesPdf() {
    setPdfError('')
    const list = filteredRows.filter((row) => row.barcode)
    const filterParts = [
      typFilter === 'alle' ? null : pdfT(typFilter === 'werkzeug' ? 'katalog.typWerkzeug' : 'katalog.typVerbrauchsmaterial'),
      statusFilter === 'alle'
        ? null
        : pdfT(
            { aktiv: 'katalog.statAktiv', inaktiv: 'katalog.statInaktiv' }[statusFilter] ?? statusKey(statusFilter),
          ),
    ].filter(Boolean)
    try {
      await showTablePdf({
        title: `${pdfT('pdf.barcodesTitle')} - ${pdfT('nav.artikel_katalog')}`,
        subtitle: pdfSubtitle(list.length, filterParts.join(', ')),
        head: [pdfT('fields.name'), pdfT('fields.barcode'), pdfT('pdf.colBarcodeImage')],
        body: list.map((row) => [row.name, row.barcode, row.barcode]),
        barcodeImageColumn: 2,
      })
    } catch {
      setPdfError(t('pdf.failed'))
    }
  }

  const barcodeColumns = [
    {
      key: 'name',
      label: t('fields.name'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.foto_url} isPublic name={row.name} />,
    },
    {
      key: 'barcode',
      label: t('fields.barcode'),
      sortable: true,
      render: (row) => (row.barcode ? <span className="mono-text">{row.barcode}</span> : '–'),
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
  ]

  function openCreate() {
    setDialog({ mode: 'create' })
  }

  function openEdit(artikel) {
    setDialog({ mode: 'edit', artikel })
  }

  async function handleSubmit(payload) {
    if (dialog.mode === 'create') {
      await insert(payload)
    } else {
      await update(dialog.artikel.id, payload)
    }
  }

  async function toggleActive(artikel) {
    await update(artikel.id, { aktiv: !artikel.aktiv })
  }

  function openDelete(artikel) {
    setLoeschGrund('')
    setLoeschDialog(artikel)
  }

  async function handleDelete() {
    const { error } = await supabase.rpc('artikel_loeschen', { p_artikel: loeschDialog.id, p_grund: loeschGrund.trim() })
    if (error) {
      // Datenbankfunktion noch nicht eingerichtet (sql/artikel_loeschen.sql)
      throw new Error(/artikel_loeschen/.test(error.message) && /find the function/i.test(error.message) ? t('katalog.deleteNotSetUp') : error.message)
    }
    await refresh()
  }

  const tableColumns = [
    {
      key: 'name',
      label: t('fields.name'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.foto_url} isPublic name={row.name} />,
    },
    { key: 'barcode', label: t('fields.barcode'), sortable: true, render: (row) => row.barcode || '–' },
    {
      key: 'typ',
      label: t('fields.typ'),
      sortable: true,
      render: (row) => {
        const meta = TYP_LABELS[row.typ] ?? { label: row.typ, tone: 'gray' }
        return <Badge label={meta.label} tone={meta.tone} />
      },
    },
    { key: 'gewerk_name', label: t('fields.gewerk'), sortable: true },
    {
      key: 'vpe',
      label: t('fields.vpe'),
      sortable: true,
      render: (row) => (row.typ === 'verbrauchsmaterial' ? row.vpe || 'Stück' : '–'),
    },
    {
      key: 'preis_num',
      label: t('fields.preis'),
      sortable: true,
      render: (row) => (row.preis_num == null ? '–' : currencyFormatter.format(row.preis_num)),
    },
    {
      key: 'stueck_total',
      label: t('katalog.colEinzelstuecke'),
      sortable: true,
      render: (row) => {
        if (row.typ !== 'werkzeug' || row.stueck_total === 0) return '–'
        const details = STUECK_STATUS.filter((status) => status !== 'verfuegbar' && row.stueck_stats[status] > 0)
          .map((status) => row.stueck_stats[status] + ' ' + t(statusKey(status)))
          .join(' · ')
        return (
          <div>
            <div>{row.stueck_total}</div>
            {details && <div className="cell-person-sub">{details}</div>}
          </div>
        )
      },
    },
    { key: 'aktiv', label: t('common.status'), sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="data-table-row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(row)}>
            <Pencil size={14} />
            {t('common.edit')}
          </button>
          <button
            type="button"
            className={'btn btn-sm ' + (row.aktiv ? 'btn-danger-ghost' : 'btn-ghost')}
            onClick={() => toggleActive(row)}
          >
            <Power size={14} />
            {row.aktiv ? t('common.deactivate') : t('common.activate')}
          </button>
          {canDelete && (
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => openDelete(row)}>
              <Trash2 size={14} />
              {t('common.delete')}
            </button>
          )}
        </div>
      ),
    },
  ]

  // Gruppierte Ansicht: eine Zeile je Artikelname ohne Gerätenummer; die einzelnen Artikel stehen im Detail-Fenster.
  const gruppenColumns = [
    {
      key: 'name',
      label: t('fields.name'),
      sortable: true,
      render: (row) => (
        <EntityCell
          bucket="public-media"
          path={row.foto_url}
          isPublic
          name={row.name}
          subtitle={row.artikel_count > 1 ? t('katalog.artikelAnzahl', { count: row.artikel_count }) : null}
        />
      ),
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
    { key: 'gewerk_name', label: t('fields.gewerk'), sortable: true },
    {
      key: 'vpe',
      label: t('fields.vpe'),
      sortable: true,
      render: (row) => (row.typ === 'verbrauchsmaterial' ? row.vpe || 'Stück' : '–'),
    },
    { key: 'preis_num', label: t('fields.preis'), sortable: true, render: (row) => row.preis_text || '–' },
    {
      key: 'stueck_total',
      label: t('katalog.colEinzelstuecke'),
      sortable: true,
      render: (row) => {
        if (row.typ !== 'werkzeug' || row.stueck_total === 0) return '–'
        const details = STUECK_STATUS.filter((status) => status !== 'verfuegbar' && row.stueck_stats[status] > 0)
          .map((status) => row.stueck_stats[status] + ' ' + t(statusKey(status)))
          .join(' · ')
        return (
          <div>
            <div>{row.stueck_total}</div>
            {details && <div className="cell-person-sub">{details}</div>}
          </div>
        )
      },
    },
    {
      key: 'aktiv',
      label: t('common.status'),
      sortable: true,
      render: (row) =>
        row.aktiv_count === row.artikel_count || row.aktiv_count === 0 ? (
          <StatusBadge active={row.aktiv_count > 0} />
        ) : (
          <Badge label={t('katalog.aktivTeil', { aktiv: row.aktiv_count, gesamt: row.artikel_count })} tone="amber" />
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="data-table-row-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(event) => {
              event.stopPropagation()
              setGruppeKey(row.id)
            }}
          >
            <List size={14} />
            {t('katalog.einzelartikel')}
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
        <div className="page-toolbar-actions">
          <button type="button" className="btn btn-ghost" onClick={exportBarcodesPdf}>
            <FileText size={16} />
            {t('pdf.barcodesButton')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportKatalogCsv}>
            <Download size={16} />
            {t('katalog.exportButton')}
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            {t('katalog.newButton')}
          </button>
        </div>
      </div>

      <div className="page-stack">
        <Segmented options={TYP_FILTER_OPTIONS} value={typFilter} onChange={setTypFilter} />
        <StatChips items={statItems} value={statusFilter} onChange={setStatusFilter} />
        {typFilter !== 'verbrauchsmaterial' && <p className="field-hint">{t('katalog.statusHint')}</p>}
        <Segmented
          options={[
            { value: 'liste', label: t('common.viewList') },
            { value: 'barcodes', label: t('common.viewBarcodes') },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'liste' && (
          <>
            <Segmented
              options={[
                { value: 'gruppiert', label: t('katalog.ansichtGruppiert') },
                { value: 'einzeln', label: t('katalog.ansichtEinzeln') },
              ]}
              value={ansicht}
              onChange={setAnsicht}
            />
            {ansicht === 'gruppiert' && <p className="field-hint">{t('katalog.gruppeHinweis')}</p>}
          </>
        )}
        {pdfError && <p className="login-error">{pdfError}</p>}
      </div>

      <DataTable
        columns={mode === 'barcodes' ? barcodeColumns : gruppiert ? gruppenColumns : tableColumns}
        statusChips={false}
        filters={mode === 'barcodes' ? undefined : tableFilters}
        rows={gruppiert ? gruppenRows : filteredRows}
        loading={loading}
        searchPlaceholder={t('katalog.searchPlaceholder')}
        emptyMessage={statusFilter === 'alle' ? t('katalog.emptyMessage') : t('common.noMatch')}
        searchKeys={['beschreibung', 'barcode']}
        onRowClick={gruppiert ? (row) => setGruppeKey(row.id) : undefined}
      />

      {aktiveGruppe && (
        <Dialog open title={t('katalog.gruppeTitel', { name: aktiveGruppe.name })} size="lg" onClose={() => setGruppeKey(null)}>
          <div className="dialog-body">
            <p className="field-hint">{t('katalog.gruppeDialogHinweis')}</p>
            <div className="data-table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('fields.name')}</th>
                    <th>{t('fields.barcode')}</th>
                    <th>{t('katalog.colEinzelstuecke')}</th>
                    <th>{t('common.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {aktiveGruppe.members.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <EntityCell bucket="public-media" path={row.foto_url} isPublic name={row.name} size={30} />
                      </td>
                      <td>{row.barcode || '–'}</td>
                      <td>{row.typ === 'werkzeug' ? row.stueck_total : '–'}</td>
                      <td>
                        <StatusBadge active={row.aktiv} />
                      </td>
                      <td>
                        <div className="data-table-row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setGruppeKey(null)
                              openEdit(row)
                            }}
                          >
                            <Pencil size={14} />
                            {t('common.edit')}
                          </button>
                          <button type="button" className={'btn btn-sm ' + (row.aktiv ? 'btn-danger-ghost' : 'btn-ghost')} onClick={() => toggleActive(row)}>
                            <Power size={14} />
                            {row.aktiv ? t('common.deactivate') : t('common.activate')}
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-sm"
                              onClick={() => {
                                setGruppeKey(null)
                                openDelete(row)
                              }}
                            >
                              <Trash2 size={14} />
                              {t('common.delete')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-primary" onClick={() => setGruppeKey(null)}>
              {t('common.close')}
            </button>
          </div>
        </Dialog>
      )}

      {loeschDialog && (
        <FormDialog
          open
          title={t('katalog.deleteTitle', { name: loeschDialog.name })}
          submitLabel={t('common.delete')}
          onClose={() => setLoeschDialog(null)}
          onSubmit={handleDelete}
        >
          <p>{t('katalog.deleteInfo')}</p>
          <Field label={t('katalog.deleteReason')}>
            <textarea
              required
              minLength={3}
              rows={3}
              autoFocus
              value={loeschGrund}
              placeholder={t('katalog.deleteReasonPlaceholder')}
              onChange={(event) => setLoeschGrund(event.target.value)}
            />
          </Field>
        </FormDialog>
      )}

      {dialog && (
        <ArtikelFormDialog
          mode={dialog.mode}
          artikel={dialog.artikel}
          // Standard-Lager aus den allgemeinen Einstellungen als Vorbelegung übernehmen.
          standardLagerId={allgemein[0]?.standard_lager_id ?? ''}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}
