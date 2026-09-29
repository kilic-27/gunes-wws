import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

function emptyFormFor(typ, standardLandId) {
  return typ === 'adresse'
    ? { typ, name: '', plz: '', land_id: standardLandId ?? '' }
    : { typ, name: '', strasse: '', plz: '', ort: '', telefon: '', land_id: standardLandId ?? '' }
}

function toFormValues(row) {
  if (!row) return emptyFormFor('adresse', '')
  if (row.typ === 'adresse') {
    return { typ: row.typ, name: row.name ?? '', plz: row.plz ?? '', land_id: row.land_id ?? '' }
  }
  return {
    typ: row.typ,
    name: row.name ?? '',
    strasse: row.strasse ?? '',
    plz: row.plz ?? '',
    ort: row.ort ?? '',
    telefon: row.telefon ?? '',
    land_id: row.land_id ?? '',
  }
}

export default function OrtePage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [view, setView] = useState('adresse')
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyFormFor('adresse'))

  const landOptions = useMemo(() => laender.filter((l) => l.aktiv), [laender])
  const landMap = useMemo(() => new Map(laender.map((l) => [l.id, l.name])), [laender])
  const standardLandId = useMemo(() => laender.find((l) => l.ist_standard)?.id ?? '', [laender])

  const VIEW_OPTIONS = [
    { value: 'adresse', label: t('orte.viewAdresse') },
    { value: 'firmenstandort', label: t('orte.viewFirmenstandort') },
  ]
  const adresseColumns = [
    { key: 'name', label: t('fields.ort'), sortable: true },
    { key: 'plz', label: t('fields.plz'), sortable: true },
    { key: 'land_name', label: t('fields.land'), sortable: true },
  ]
  const firmenstandortColumns = [
    { key: 'name', label: t('fields.name'), sortable: true },
    { key: 'strasse', label: t('fields.strasse') },
    { key: 'plz', label: t('fields.plz') },
    { key: 'ort', label: t('fields.ort'), sortable: true },
    { key: 'telefon', label: t('fields.telefon') },
    { key: 'land_name', label: t('fields.land'), sortable: true },
  ]

  const filteredRows = useMemo(
    () => rows.filter((row) => row.typ === view).map((row) => ({ ...row, land_name: landMap.get(row.land_id) ?? '–' })),
    [rows, view, landMap],
  )

  function openCreate() {
    setFormValues(emptyFormFor(view, standardLandId))
    setDialog({ mode: 'create', typ: view })
  }

  function openEdit(row) {
    setFormValues(toFormValues(row))
    setDialog({ mode: 'edit', typ: row.typ, row })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    const payload = { ...formValues, land_id: formValues.land_id || null }
    if (dialog.mode === 'create') {
      await insert(payload)
    } else {
      await update(dialog.row.id, payload)
    }
  }

  async function toggleActive(row) {
    await update(row.id, { aktiv: !row.aktiv })
  }

  const baseColumns = view === 'adresse' ? adresseColumns : firmenstandortColumns
  const tableColumns = [
    ...baseColumns,
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

  const isAdresseDialog = dialog?.typ === 'adresse'
  const createLabel = view === 'adresse' ? t('orte.newOrtButton') : t('orte.newStandortButton')
  const dialogTitle = dialog
    ? dialog.mode === 'create'
      ? isAdresseDialog
        ? t('orte.createOrtTitle')
        : t('orte.createStandortTitle')
      : isAdresseDialog
        ? t('orte.editOrtTitle')
        : t('orte.editStandortTitle')
    : ''

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          {createLabel}
        </button>
      </div>

      <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} />

      <DataTable
        columns={tableColumns}
        rows={filteredRows}
        loading={loading}
        searchPlaceholder={t('orte.searchPlaceholder')}
        emptyMessage={view === 'adresse' ? t('orte.emptyMessageAdresse') : t('orte.emptyMessageStandort')}
      />

      {dialog && (
        <FormDialog
          open
          title={dialogTitle}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          {isAdresseDialog ? (
            <>
              <Field label={t('fields.ort')}>
                <input
                  required
                  value={formValues.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </Field>
              <Field label={t('fields.plz')}>
                <input value={formValues.plz} onChange={(event) => updateField('plz', event.target.value)} />
              </Field>
              <Field label={t('fields.land')}>
                <select value={formValues.land_id} onChange={(event) => updateField('land_id', event.target.value)}>
                  <option value="">{t('common.noSelection')}</option>
                  {landOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label={t('fields.name')}>
                <input
                  required
                  value={formValues.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </Field>
              <Field label={t('fields.strasse')}>
                <input value={formValues.strasse} onChange={(event) => updateField('strasse', event.target.value)} />
              </Field>
              <div className="field-row">
                <Field label={t('fields.plz')}>
                  <input value={formValues.plz} onChange={(event) => updateField('plz', event.target.value)} />
                </Field>
                <Field label={t('fields.ort')}>
                  <input value={formValues.ort} onChange={(event) => updateField('ort', event.target.value)} />
                </Field>
              </div>
              <Field label={t('fields.telefonOptional')}>
                <input value={formValues.telefon} onChange={(event) => updateField('telefon', event.target.value)} />
              </Field>
              <Field label={t('fields.land')}>
                <select value={formValues.land_id} onChange={(event) => updateField('land_id', event.target.value)}>
                  <option value="">{t('common.noSelection')}</option>
                  {landOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </FormDialog>
      )}
    </div>
  )
}
