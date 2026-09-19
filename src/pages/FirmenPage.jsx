import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ImageUpload from '../components/ui/ImageUpload.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = {
  name: '',
  logo_url: null,
  geschaeftsfuehrer: '',
  ust_id: '',
  registergericht: '',
  registernummer: '',
  strasse: '',
  plz: '',
  ort: '',
  telefon: '',
  email: '',
  webseite: '',
}

function toFormValues(firma) {
  if (!firma) return emptyForm
  return {
    name: firma.name ?? '',
    logo_url: firma.logo_url ?? null,
    geschaeftsfuehrer: firma.geschaeftsfuehrer ?? '',
    ust_id: firma.ust_id ?? '',
    registergericht: firma.registergericht ?? '',
    registernummer: firma.registernummer ?? '',
    strasse: firma.strasse ?? '',
    plz: firma.plz ?? '',
    ort: firma.ort ?? '',
    telefon: firma.telefon ?? '',
    email: firma.email ?? '',
    webseite: firma.webseite ?? '',
  }
}

export default function FirmenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('firmen', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null) // { mode: 'create' | 'edit', firma? }
  const [formValues, setFormValues] = useState(emptyForm)

  const columns = [
    {
      key: 'name',
      label: t('fields.name'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.logo_url} isPublic name={row.name} />,
    },
    { key: 'ort', label: t('fields.ort'), sortable: true },
    { key: 'telefon', label: t('fields.telefon') },
    { key: 'email', label: t('fields.email') },
    { key: 'aktiv', label: t('common.status'), sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
  ]

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(firma) {
    setFormValues(toFormValues(firma))
    setDialog({ mode: 'edit', firma })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    if (dialog.mode === 'create') {
      await insert(formValues)
    } else {
      await update(dialog.firma.id, formValues)
    }
  }

  async function toggleActive(firma) {
    await update(firma.id, { aktiv: !firma.aktiv })
  }

  const tableColumns = [
    ...columns,
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
          {t('firmen.newButton')}
        </button>
      </div>

      <DataTable
        columns={tableColumns}
        rows={rows}
        loading={loading}
        searchPlaceholder={t('firmen.searchPlaceholder')}
        emptyMessage={t('firmen.emptyMessage')}
      />

      {dialog && (
        <FormDialog
          open
          size="lg"
          title={dialog.mode === 'create' ? t('firmen.createTitle') : t('firmen.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label={t('fields.name')}>
            <input
              required
              value={formValues.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </Field>

          <div className="field">
            <span>{t('fields.logo')}</span>
            <ImageUpload
              bucket="public-media"
              folder="firmen"
              isPublic
              label={t('firmen.logoAlt')}
              value={formValues.logo_url}
              onChange={(path) => updateField('logo_url', path)}
            />
          </div>

          <div className="field-row">
            <Field label={t('fields.geschaeftsfuehrer')}>
              <input
                value={formValues.geschaeftsfuehrer}
                onChange={(event) => updateField('geschaeftsfuehrer', event.target.value)}
              />
            </Field>
            <Field label={t('fields.ustId')}>
              <input value={formValues.ust_id} onChange={(event) => updateField('ust_id', event.target.value)} />
            </Field>
          </div>

          <div className="field-row">
            <Field label={t('fields.registergericht')}>
              <input
                value={formValues.registergericht}
                onChange={(event) => updateField('registergericht', event.target.value)}
              />
            </Field>
            <Field label={t('fields.registernummer')}>
              <input
                value={formValues.registernummer}
                onChange={(event) => updateField('registernummer', event.target.value)}
              />
            </Field>
          </div>

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

          <Field label={t('fields.webseite')}>
            <input value={formValues.webseite} onChange={(event) => updateField('webseite', event.target.value)} />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
