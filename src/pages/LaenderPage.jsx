import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import Badge from '../components/ui/Badge.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = { name: '', code: '', ist_standard: false }

function toFormValues(land) {
  if (!land) return emptyForm
  return {
    name: land.name ?? '',
    code: land.code ?? '',
    ist_standard: land.ist_standard ?? false,
  }
}

export default function LaenderPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  const columns = [
    { key: 'name', label: t('fields.name'), sortable: true },
    { key: 'code', label: t('fields.codeIso'), sortable: true },
    {
      key: 'ist_standard',
      label: t('sprachen.colStandard'),
      sortable: true,
      render: (row) => (row.ist_standard ? <Badge label={t('sprachen.badgeStandard')} tone="blue" /> : '–'),
    },
    { key: 'aktiv', label: t('common.status'), sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
  ]

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(land) {
    setFormValues(toFormValues(land))
    setDialog({ mode: 'edit', land })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    if (dialog.mode === 'create') {
      await insert(formValues)
    } else {
      await update(dialog.land.id, formValues)
    }
  }

  async function toggleActive(land) {
    await update(land.id, { aktiv: !land.aktiv })
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
          {t('laender.newButton')}
        </button>
      </div>

      <DataTable
        columns={tableColumns}
        rows={rows}
        loading={loading}
        searchPlaceholder={t('laender.searchPlaceholder')}
        emptyMessage={t('laender.emptyMessage')}
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? t('laender.createTitle') : t('laender.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label={t('fields.name')}>
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>

          <Field label={t('fields.codeIso')}>
            <input
              placeholder={t('laender.codePlaceholder')}
              value={formValues.code}
              onChange={(event) => updateField('code', event.target.value)}
            />
          </Field>

          <label className="field field-checkbox">
            <input
              type="checkbox"
              checked={formValues.ist_standard}
              onChange={(event) => updateField('ist_standard', event.target.checked)}
            />
            <span>{t('fields.standardLand')}</span>
          </label>
        </FormDialog>
      )}
    </div>
  )
}
