import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power, Trash2 } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = { name: '' }

function toFormValues(position) {
  if (!position) return emptyForm
  return { name: position.name ?? '' }
}

export default function PositionenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update, remove } = useSupabaseTable('positionen', {
    orderBy: 'name',
    ascending: true,
  })
  const { rows: mitarbeiter } = useSupabaseTable('mitarbeiter', { orderBy: 'nachname', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const inUseIds = useMemo(() => new Set(mitarbeiter.map((m) => m.position_id).filter(Boolean)), [mitarbeiter])

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(position) {
    setFormValues(toFormValues(position))
    setDialog({ mode: 'edit', position })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    const payload = { name: formValues.name }
    if (dialog.mode === 'create') {
      await insert(payload)
    } else {
      await update(dialog.position.id, payload)
    }
  }

  async function toggleActive(position) {
    await update(position.id, { aktiv: !position.aktiv })
  }

  async function handleDelete() {
    await remove(deleteTarget.id)
  }

  const columns = [
    { key: 'name', label: t('fields.name'), sortable: true },
    { key: 'aktiv', label: t('common.status'), sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
    {
      key: 'actions',
      label: '',
      render: (row) => {
        const blocked = inUseIds.has(row.id)
        return (
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
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={blocked}
              title={blocked ? t('positionen.deleteBlockedHint') : undefined}
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 size={14} />
              {t('common.delete')}
            </button>
          </div>
        )
      },
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
          {t('positionen.newButton')}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        searchPlaceholder={t('positionen.searchPlaceholder')}
        emptyMessage={t('positionen.emptyMessage')}
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? t('positionen.createTitle') : t('positionen.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label={t('fields.name')}>
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>
        </FormDialog>
      )}

      {deleteTarget && (
        <FormDialog
          open
          title={t('positionen.deleteTitle')}
          submitLabel={t('common.delete')}
          onClose={() => setDeleteTarget(null)}
          onSubmit={handleDelete}
        >
          <p>{t('positionen.deleteBody', { name: deleteTarget.name })}</p>
        </FormDialog>
      )}
    </div>
  )
}
