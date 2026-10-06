import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FileDown, Plus } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StatChips from '../components/ui/StatChips.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { formatDateTimeDE } from '../lib/date.js'
import { OVERDUE_DAYS, formatEuro, useLieferscheinStammdaten } from '../lib/lieferschein.js'
import { pdfSubtitle, pdfT, showTablePdf } from '../lib/pdf.js'

const isOverdue = (ls) => ls.status === 'offen' && ls.stueck_offen > 0 && ls.alter_tage > OVERDUE_DAYS

const CHIP_FILTERS = {
  alle: () => true,
  offen: (ls) => ls.status === 'offen',
  abgeschlossen: (ls) => ls.status === 'abgeschlossen',
  unkontrolliert: (ls) => !ls.kontrolliert,
  stuecke: (ls) => ls.stueck_offen > 0,
  ueberfaellig: isOverdue,
}

export default function LieferscheineUebersichtPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useLieferscheinStammdaten()
  const [chip, setChip] = useState('alle')

  const counts = useMemo(
    () => Object.fromEntries(Object.entries(CHIP_FILTERS).map(([key, fn]) => [key, data.resolved.filter(fn).length])),
    [data.resolved],
  )
  const rows = useMemo(() => data.resolved.filter(CHIP_FILTERS[chip]), [data.resolved, chip])

  const chipItems = [
    { key: 'alle', label: t('common.total'), value: counts.alle },
    { key: 'offen', label: t('lieferschein.status.offen'), value: counts.offen, tone: 'amber' },
    { key: 'abgeschlossen', label: t('lieferschein.status.abgeschlossen'), value: counts.abgeschlossen },
    { key: 'unkontrolliert', label: t('lieferschein.unkontrolliert'), value: counts.unkontrolliert, tone: 'amber' },
    { key: 'stuecke', label: t('lieferschein.mitOffenenStuecken'), value: counts.stuecke },
    { key: 'ueberfaellig', label: t('lieferschein.ueberfaellig', { days: OVERDUE_DAYS }), value: counts.ueberfaellig, tone: 'red' },
  ]

  async function toggleKontrolliert(event, ls) {
    event.stopPropagation()
    await data.lieferscheine.update(ls.id, { kontrolliert: !ls.kontrolliert })
  }

  function exportPdf() {
    const filterLabel = chip === 'alle' ? null : chipItems.find((c) => c.key === chip)?.label
    return showTablePdf({
      title: pdfT('lieferschein.pdf.listTitle'),
      subtitle: pdfSubtitle(rows.length, filterLabel),
      landscape: true,
      head: ['Nr.', pdfT('lieferschein.baustelle'), pdfT('lieferschein.mitarbeiter'), pdfT('lieferschein.angelegt'), 'Status', pdfT('lieferschein.offeneStuecke'), pdfT('lieferschein.gesamtkosten')],
      body: rows.map((ls) => [
        ls.nummer_label,
        [ls.adresse, ls.auftraggeber_name && `(${ls.auftraggeber_name})`].filter(Boolean).join(' '),
        ls.mitarbeiter_name,
        formatDateTimeDE(ls.erstellt_am),
        pdfT('lieferschein.status.' + ls.status),
        String(ls.stueck_offen),
        formatEuro(ls.gesamtkosten),
      ]),
    })
  }

  const columns = [
    {
      key: 'nr',
      label: t('lieferschein.nummer'),
      sortable: true,
      render: (ls) => <span className="mono-text ls-nr">{ls.nummer_label}</span>,
    },
    {
      key: 'adresse',
      label: t('lieferschein.baustelle'),
      sortable: true,
      render: (ls) => (
        <EntityCell
          bucket="public-media"
          path={ls.auftraggeber_logo}
          isPublic
          name={ls.strasse || ls.ort_name || '–'}
          subtitle={[[ls.plz, ls.ort_name].filter(Boolean).join(' '), ls.auftraggeber_name].filter(Boolean).join(' · ')}
        />
      ),
    },
    {
      key: 'mitarbeiter_name',
      label: t('lieferschein.mitarbeiter'),
      sortable: true,
      render: (ls) => <EntityCell bucket="mitarbeiter-fotos" path={ls.mitarbeiter_foto} isPublic={false} name={ls.mitarbeiter_name} subtitle={ls.firma_name || null} />,
    },
    {
      key: 'erstellt_am',
      label: t('lieferschein.angelegt'),
      sortable: true,
      render: (ls) => (
        <div>
          <div>{formatDateTimeDE(ls.erstellt_am)}</div>
          {isOverdue(ls) && (
            <span className="ls-overdue">
              <AlertTriangle size={12} aria-hidden="true" /> {t('lieferschein.seitTagen', { days: ls.alter_tage })}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'anzahl_positionen',
      label: t('lieferschein.waren'),
      sortable: true,
      render: (ls) => (
        <div>
          <div>{ls.anzahl_positionen}</div>
          {ls.stueck_offen > 0 && <div className="cell-person-sub">{t('lieferschein.nochDraussen', { count: ls.stueck_offen })}</div>}
        </div>
      ),
    },
    {
      key: 'gesamtkosten',
      label: t('lieferschein.gesamtkosten'),
      sortable: true,
      render: (ls) => formatEuro(ls.gesamtkosten),
    },
    {
      key: 'status',
      label: t('common.status'),
      sortable: true,
      render: (ls) => <Badge label={t('lieferschein.status.' + ls.status)} tone={ls.status === 'offen' ? 'amber' : 'green'} />,
    },
    {
      key: 'kontrolliert',
      label: t('lieferschein.kontrolliert'),
      render: (ls) => (
        <button type="button" className="badge-button" onClick={(event) => toggleKontrolliert(event, ls)} title={t('lieferschein.kontrolleUmschalten')}>
          <Badge label={ls.kontrolliert ? t('lieferschein.ja') : t('lieferschein.nein')} tone={ls.kontrolliert ? 'green' : 'red'} />
        </button>
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
          <button type="button" className="btn btn-ghost" onClick={exportPdf}>
            <FileDown size={16} />
            {t('lieferschein.listeAlsPdf')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/lieferscheine/erstellen')}>
            <Plus size={16} />
            {t('lieferschein.neu')}
          </button>
        </div>
      </div>

      <div className="page-stack">
        <StatChips items={chipItems} value={chip} onChange={setChip} />
        <DataTable
          columns={columns}
          rows={rows}
          loading={data.loading}
          statusChips={false}
          onRowClick={(ls) => navigate(`/lieferscheine/${ls.id}`)}
          searchPlaceholder={t('lieferschein.suchePlaceholder')}
          emptyMessage={t('lieferschein.leer')}
          searchKeys={['nummer_label', 'projektnummer', 'adresse', 'auftraggeber_name', 'mitarbeiter_name', 'firma_name']}
          filters={[
            {
              key: 'mitarbeiter_id',
              label: t('lieferschein.filterMitarbeiter'),
              options: data.mitarbeiter.rows.map((m) => ({ value: m.id, label: `${m.vorname ?? ''} ${m.nachname ?? ''}`.trim() })),
            },
            {
              key: 'baustelle_id',
              label: t('lieferschein.filterBaustelle'),
              options: data.baustellen.rows.map((b) => {
                const ort = data.maps.ort.get(b.ort_id)
                return { value: b.id, label: [ort?.strasse, ort?.name].filter(Boolean).join(', ') || b.projekt_nr || '–' }
              }),
            },
            {
              key: 'auftraggeber_id',
              label: t('lieferschein.filterAuftraggeber'),
              options: data.auftraggeber.rows.map((a) => ({ value: a.id, label: a.name })),
            },
            {
              key: 'firma_id',
              label: t('lieferschein.filterFirma'),
              options: data.firmen.rows.map((f) => ({ value: f.id, label: f.name })),
            },
          ]}
        />
      </div>
    </div>
  )
}
