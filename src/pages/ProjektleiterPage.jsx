import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import AddressFields from '../components/ui/AddressFields.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { resolveOrtId } from '../lib/addressLookup.js'

function emptyFormFor(standardLandId) {
  return {
    name: '',
    telefon: '',
    email: '',
    strasse: '',
    plz: '',
    ort: '',
    land_id: standardLandId ?? '',
    auftraggeber_id: '',
  }
}

function toFormValues(row, ortMap) {
  if (!row) return emptyFormFor('')
  const ort = ortMap.get(row.ort_id)
  return {
    name: row.name ?? '',
    telefon: row.telefon ?? '',
    email: row.email ?? '',
    strasse: ort?.strasse ?? '',
    plz: ort?.plz ?? '',
    ort: ort?.name ?? '',
    land_id: ort?.land_id ?? '',
    auftraggeber_id: row.auftraggeber_id ?? '',
  }
}

export default function ProjektleiterPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('projektleiter', { orderBy: 'name', ascending: true })
  const { rows: auftraggeberRows } = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const orteTable = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyFormFor(''))

  const ortMap = useMemo(() => new Map(orteTable.rows.map((o) => [o.id, o])), [orteTable.rows])
  const landMap = useMemo(() => new Map(laender.map((l) => [l.id, l.name])), [laender])
  const standardLandId = useMemo(() => laender.find((l) => l.ist_standard)?.id ?? '', [laender])
  const auftraggeberOptions = useMemo(() => auftraggeberRows.filter((a) => a.aktiv), [auftraggeberRows])
  const auftraggeberMap = useMemo(() => new Map(auftraggeberRows.map((a) => [a.id, a.name])), [auftraggeberRows])

  const rowsResolved = useMemo(
    () =>
      rows.map((row) => {
        const ort = ortMap.get(row.ort_id)
        return {
          ...row,
          ort_name: ort?.name ?? '–',
          land_name: (ort?.land_id && landMap.get(ort.land_id)) ?? '–',
          auftraggeber_name: auftraggeberMap.get(row.auftraggeber_id) ?? '–',
        }
      }),
    [rows, ortMap, landMap, auftraggeberMap],
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
      name: formValues.name,
      telefon: formValues.telefon || null,
      email: formValues.email || null,
      ort_id: ortId,
      auftraggeber_id: formValues.auftraggeber_id || null,
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
    { key: 'name', label: t('fields.name'), sortable: true },
    { key: 'auftraggeber_name', label: t('projektleiter.colAuftraggeber'), sortable: true },
    { key: 'ort_name', label: t('fields.ort'), sortable: true },
    { key: 'land_name', label: t('fields.land'), sortable: true },
    { key: 'telefon', label: t('fields.telefon') },
    { key: 'email', label: t('fields.email') },
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
          {t('projektleiter.newButton')}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rowsResolved}
        loading={loading}
        searchPlaceholder={t('projektleiter.searchPlaceholder')}
        emptyMessage={t('projektleiter.emptyMessage')}
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? t('projektleiter.createTitle') : t('projektleiter.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label={t('fields.name')}>
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>

          <div className="field-row">
            <Field label={t('fields.telefon')}>
              <input value={formValues.telefon} onChange={(event) => updateField('telefon', event.target.value)} />
            </Field>
            <Field label={t('fields.email')}>
              <input
                type="email"
                value={formValues.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </Field>
          </div>

          <AddressFields values={formValues} onChange={updateAddress} orte={orteTable.rows} laender={laender} />

          <Field label={t('projektleiter.auftraggeberLabel')}>
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
        </FormDialog>
      )}
    </div>
  )
}
