import { useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import Badge from '../components/ui/Badge.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = { name: '', code: '', ist_standard: false }

function toFormValues(sprache) {
  if (!sprache) return emptyForm
  return {
    name: sprache.name ?? '',
    code: sprache.code ?? '',
    ist_standard: sprache.ist_standard ?? false,
  }
}

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'code', label: 'Code', sortable: true },
  {
    key: 'ist_standard',
    label: 'Standard',
    sortable: true,
    render: (row) => (row.ist_standard ? <Badge label="Standard" tone="blue" /> : '–'),
  },
  { key: 'aktiv', label: 'Status', sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
]

export default function SprachenPage({ breadcrumb, title }) {
  const { rows, loading, insert, update } = useSupabaseTable('sprachen', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(sprache) {
    setFormValues(toFormValues(sprache))
    setDialog({ mode: 'edit', sprache })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    if (dialog.mode === 'create') {
      await insert(formValues)
    } else {
      await update(dialog.sprache.id, formValues)
    }
  }

  async function toggleActive(sprache) {
    await update(sprache.id, { aktiv: !sprache.aktiv })
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
            Bearbeiten
          </button>
          <button
            type="button"
            className={'btn btn-sm ' + (row.aktiv ? 'btn-danger-ghost' : 'btn-ghost')}
            onClick={() => toggleActive(row)}
          >
            <Power size={14} />
            {row.aktiv ? 'Deaktivieren' : 'Aktivieren'}
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
          Neue Sprache
        </button>
      </div>

      <DataTable
        columns={tableColumns}
        rows={rows}
        loading={loading}
        searchPlaceholder="Sprachen durchsuchen…"
        emptyMessage="Es wurden noch keine Sprachen angelegt."
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? 'Neue Sprache anlegen' : 'Sprache bearbeiten'}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label="Name">
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>

          <Field label="Code">
            <input
              placeholder="z. B. de"
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
            <span>Standard-Sprache</span>
          </label>
        </FormDialog>
      )}
    </div>
  )
}
