import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import AddressFields from '../components/ui/AddressFields.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { resolveOrtId } from '../lib/addressLookup.js'
import { formatDateDE } from '../lib/date.js'

const STATUS_OPTIONS = ['offen', 'abgeschlossen']

function emptyFormFor(standardLandId) {
  return {
    projekt_nr: '',
    auftraggeber_id: '',
    strasse: '',
    plz: '',
    ort: '',
    land_id: standardLandId ?? '',
    start_datum: '',
    ende_datum: '',
    status: 'offen',
    gesamtkosten: '',
    bemerkung: '',
  }
}

function toFormValues(row, ortMap) {
  if (!row) return emptyFormFor('')
  const ort = ortMap.get(row.ort_id)
  return {
    projekt_nr: row.projekt_nr ?? '',
    auftraggeber_id: row.auftraggeber_id ?? '',
    strasse: ort?.strasse ?? '',
    plz: ort?.plz ?? '',
    ort: ort?.name ?? '',
    land_id: ort?.land_id ?? '',
    start_datum: row.start_datum ?? '',
    ende_datum: row.ende_datum ?? '',
    status: row.status ?? 'offen',
    gesamtkosten: row.gesamtkosten ?? '',
    bemerkung: row.bemerkung ?? '',
  }
}

export default function BaustellenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('baustellen', {
    orderBy: 'erstellt_am',
    ascending: false,
  })
  const { rows: auftraggeberRows } = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const orteTable = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyFormFor(''))

  const ortMap = useMemo(() => new Map(orteTable.rows.map((o) => [o.id, o])), [orteTable.rows])
  const standardLandId = useMemo(() => laender.find((l) => l.ist_standard)?.id ?? '', [laender])
  const auftraggeberOptions = useMemo(() => auftraggeberRows.filter((a) => a.aktiv), [auftraggeberRows])
  const auftraggeberMap = useMemo(() => new Map(auftraggeberRows.map((a) => [a.id, a])), [auftraggeberRows])

  const STATUS_META = {
    offen: { label: t('baustellen.statusOffen'), tone: 'amber' },
    abgeschlossen: { label: t('baustellen.statusAbgeschlossen'), tone: 'green' },
  }

  const rowsResolved = useMemo(
    () =>
      rows.map((row) => {
        const ort = ortMap.get(row.ort_id)
        const auftraggeber = auftraggeberMap.get(row.auftraggeber_id)
        return {
          ...row,
          strasse: ort?.strasse ?? '',
          ort_name: ort?.name ?? '',
          plz: ort?.plz ?? '',
          auftraggeber_name: auftraggeber?.name ?? '–',
          auftraggeber_logo: auftraggeber?.logo_url ?? null,
        }
      }),
    [rows, ortMap, auftraggeberMap],
  )

  function openCreate() {
    setFormValues(emptyFormFor(standardLandId))
    setDialog({ mode: 'create' })
  }

  function openEdit(row) {
    setFormValues(toFormValues(row, ortMap))
    setDialog({ mode: 'edit', row })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  function updateAddress(patch) {
    setFormValues((current) => ({ ...current, ...patch }))
  }

  async function handleSubmit() {
    const ortId = await resolveOrtId(
      { strasse: formValues.strasse, plz: formValues.plz, ort: formValues.ort, land_id: formValues.land_id },
      orteTable.rows,
      orteTable,
    )
    const payload = {
      projekt_nr: formValues.projekt_nr || null,
      auftraggeber_id: formValues.auftraggeber_id || null,
      ort_id: ortId,
      start_datum: formValues.start_datum || null,
      ende_datum: formValues.ende_datum || null,
      status: formValues.status,
      gesamtkosten: formValues.gesamtkosten === '' ? null : Number(formValues.gesamtkosten),
      bemerkung: formValues.bemerkung || null,
    }
    if (dialog.mode === 'create') {
      await insert(payload)
    } else {
      await update(dialog.row.id, payload)
    }
  }

  async function toggleActive(row) {
    await update(row.id, { aktiv: !row.aktiv })
  }

  const columns = [
    { key: 'projekt_nr', label: t('baustellen.colProjektNr'), sortable: true, render: (row) => row.projekt_nr || '–' },
    {
      key: 'auftraggeber_name',
      label: t('fields.auftraggeber'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.auftraggeber_logo} isPublic name={row.auftraggeber_name} />,
    },
    {
      key: 'ort_name',
      label: t('auftraggeber.colAdresse'),
      render: (row) =>
        row.strasse || row.ort_name ? (
          <div>
            {row.strasse && <div>{row.strasse}</div>}
            {row.ort_name && (
              <div className="cell-person-sub">{[row.plz, row.ort_name].filter(Boolean).join(' ')}</div>
            )}
          </div>
        ) : (
          '–'
        ),
    },
    {
      key: 'start_datum',
      label: t('baustellen.colStart'),
      sortable: true,
      render: (row) => (row.start_datum ? formatDateDE(row.start_datum) : '–'),
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
    {
      key: 'gesamtkosten',
      label: t('baustellen.colGesamtkosten'),
      sortable: true,
      render: (row) =>
        row.gesamtkosten != null
          ? `${Number(row.gesamtkosten).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
          : '–',
    },
    { key: 'aktiv', label: '', sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
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
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          {t('baustellen.newButton')}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rowsResolved}
        loading={loading}
        searchPlaceholder={t('baustellen.searchPlaceholder')}
        emptyMessage={t('baustellen.emptyMessage')}
        searchKeys={['projekt_nr', 'auftraggeber_name', 'ort_name']}
      />

      {dialog && (
        <FormDialog
          open
          size="lg"
          title={dialog.mode === 'create' ? t('baustellen.createTitle') : t('baustellen.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <div className="field-row">
            <Field label={t('baustellen.projektNr')}>
              <input
                value={formValues.projekt_nr}
                onChange={(event) => updateField('projekt_nr', event.target.value)}
              />
            </Field>
            <Field label={t('fields.auftraggeber')}>
              <select
                value={formValues.auftraggeber_id}
                onChange={(event) => updateField('auftraggeber_id', event.target.value)}
              >
                <option value="">{t('common.noSelection')}</option>
                {auftraggeberOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <AddressFields values={formValues} onChange={updateAddress} orte={orteTable.rows} laender={laender} />

          <div className="field-row">
            <Field label={t('baustellen.startDatum')}>
              <input
                type="date"
                value={formValues.start_datum}
                onChange={(event) => updateField('start_datum', event.target.value)}
              />
            </Field>
            <Field label={t('baustellen.endeDatum')}>
              <input
                type="date"
                value={formValues.ende_datum}
                onChange={(event) => updateField('ende_datum', event.target.value)}
              />
            </Field>
          </div>

          <div className="field-row">
            <Field label={t('common.status')}>
              <select value={formValues.status} onChange={(event) => updateField('status', event.target.value)}>
                {STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_META[value].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('baustellen.gesamtkosten')}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formValues.gesamtkosten}
                onChange={(event) => updateField('gesamtkosten', event.target.value)}
              />
            </Field>
          </div>

          <Field label={t('fields.bemerkung')}>
            <textarea value={formValues.bemerkung} onChange={(event) => updateField('bemerkung', event.target.value)} />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
