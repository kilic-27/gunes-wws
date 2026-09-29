import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = { name: '', ansprechpartner: '', telefon: '', email: '', ort_id: '', land_id: '' }

function toFormValues(row) {
  if (!row) return emptyForm
  return {
    name: row.name ?? '',
    ansprechpartner: row.ansprechpartner ?? '',
    telefon: row.telefon ?? '',
    email: row.email ?? '',
    ort_id: row.ort_id ?? '',
    land_id: row.land_id ?? '',
  }
}

function toPayload(values) {
  return {
    name: values.name,
    ansprechpartner: values.ansprechpartner || null,
    telefon: values.telefon || null,
    email: values.email || null,
    ort_id: values.ort_id || null,
    land_id: values.land_id || null,
  }
}

export default function AuftraggeberPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const { rows: orte } = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  const ortOptions = useMemo(() => orte.filter((o) => o.typ === 'adresse' && o.aktiv), [orte])
  const ortMap = useMemo(() => new Map(orte.map((o) => [o.id, o.name])), [orte])
  const landOptions = useMemo(() => laender.filter((l) => l.aktiv), [laender])

  const rowsResolved = useMemo(
    () => rows.map((row) => ({ ...row, ort_name: ortMap.get(row.ort_id) ?? '–' })),
    [rows, ortMap],
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

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          {t('auftraggeber.newButton')}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rowsResolved}
        loading={loading}
        searchPlaceholder={t('auftraggeber.searchPlaceholder')}
        emptyMessage={t('auftraggeber.emptyMessage')}
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? t('auftraggeber.createTitle') : t('auftraggeber.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label={t('fields.name')}>
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>

          <Field label={t('fields.ansprechpartnerOptional')}>
            <input
              value={formValues.ansprechpartner}
              onChange={(event) => updateField('ansprechpartner', event.target.value)}
            />
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
              <select value={formValues.land_id} onChange={(event) => updateField('land_id', event.target.value)}>
                <option value="">{t('common.noSelection')}</option>
                {landOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  )
}
