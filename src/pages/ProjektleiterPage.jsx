import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = { name: '', telefon: '', email: '', ort_id: '', auftraggeber_id: '' }

function toFormValues(row) {
  if (!row) return emptyForm
  return {
    name: row.name ?? '',
    telefon: row.telefon ?? '',
    email: row.email ?? '',
    ort_id: row.ort_id ?? '',
    auftraggeber_id: row.auftraggeber_id ?? '',
  }
}

function toPayload(values) {
  return {
    name: values.name,
    telefon: values.telefon || null,
    email: values.email || null,
    ort_id: values.ort_id || null,
    auftraggeber_id: values.auftraggeber_id || null,
  }
}

export default function ProjektleiterPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('projektleiter', { orderBy: 'name', ascending: true })
  const { rows: auftraggeberRows } = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const { rows: orte } = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  const ortOptions = useMemo(() => orte.filter((o) => o.typ === 'adresse' && o.aktiv), [orte])
  const ortMap = useMemo(() => new Map(orte.map((o) => [o.id, o])), [orte])
  const landMap = useMemo(() => new Map(laender.map((l) => [l.id, l.name])), [laender])
  const auftraggeberOptions = useMemo(() => auftraggeberRows.filter((a) => a.aktiv), [auftraggeberRows])
  const auftraggeberMap = useMemo(() => new Map(auftraggeberRows.map((a) => [a.id, a.name])), [auftraggeberRows])

  function landNameForOrt(ortId) {
    const ort = ortMap.get(ortId)
    if (!ort?.land_id) return null
    return landMap.get(ort.land_id) ?? null
  }

  const rowsResolved = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        ort_name: ortMap.get(row.ort_id)?.name ?? '–',
        auftraggeber_name: auftraggeberMap.get(row.auftraggeber_id) ?? '–',
      })),
    [rows, ortMap, auftraggeberMap],
  )

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(row) {
    setFormValues(toFormValues(row))
    setDialog({ mode: 'edit', row })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    const payload = toPayload(formValues)
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

  const selectedLandName = landNameForOrt(formValues.ort_id)

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

          <div className="field-row">
            <Field label={t('fields.ort')}>
              <select value={formValues.ort_id} onChange={(event) => updateField('ort_id', event.target.value)}>
                <option value="">{t('common.noSelection')}</option>
                {ortOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('fields.land')}>
              <select value="" disabled>
                <option value="">{selectedLandName ?? '–'}</option>
              </select>
            </Field>
          </div>

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
