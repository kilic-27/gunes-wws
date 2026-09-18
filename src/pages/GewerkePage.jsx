import { useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const DEFAULT_COLOR = '#17b3f2'

const emptyForm = { name: '', farbe: '' }

function toFormValues(gewerk) {
  if (!gewerk) return emptyForm
  return {
    name: gewerk.name ?? '',
    farbe: gewerk.farbe ?? '',
  }
}

const columns = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    render: (row) => (
      <div className="cell-person">
        {row.farbe && <span className="color-swatch" style={{ background: row.farbe }} />}
        <span className="cell-person-name">{row.name}</span>
      </div>
    ),
  },
  { key: 'aktiv', label: 'Status', sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
]

export default function GewerkePage({ breadcrumb, title }) {
  const { rows, loading, insert, update } = useSupabaseTable('gewerke', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(gewerk) {
    setFormValues(toFormValues(gewerk))
    setDialog({ mode: 'edit', gewerk })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    const payload = { name: formValues.name, farbe: formValues.farbe || null }
    if (dialog.mode === 'create') {
      await insert(payload)
    } else {
      await update(dialog.gewerk.id, payload)
    }
  }

  async function toggleActive(gewerk) {
    await update(gewerk.id, { aktiv: !gewerk.aktiv })
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
          Neues Gewerk
        </button>
      </div>

      <DataTable
        columns={tableColumns}
        rows={rows}
        loading={loading}
        searchPlaceholder="Gewerke durchsuchen…"
        emptyMessage="Es wurden noch keine Gewerke angelegt."
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? 'Neues Gewerk anlegen' : 'Gewerk bearbeiten'}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label="Name">
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>

          <div className="field">
            <span>Farbe fürs Badge (optional)</span>
            <div className="color-field">
              <input
                type="color"
                value={formValues.farbe || DEFAULT_COLOR}
                onChange={(event) => updateField('farbe', event.target.value)}
              />
              {formValues.farbe && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateField('farbe', '')}>
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>
        </FormDialog>
      )}
    </div>
  )
}
