import { useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = {
  bezeichnung: '',
  strasse: '',
  plz: '',
  ort: '',
}

function toFormValues(lager) {
  if (!lager) return emptyForm
  return {
    bezeichnung: lager.bezeichnung ?? '',
    strasse: lager.strasse ?? '',
    plz: lager.plz ?? '',
    ort: lager.ort ?? '',
  }
}

const columns = [
  { key: 'bezeichnung', label: 'Bezeichnung', sortable: true },
  { key: 'strasse', label: 'Straße' },
  { key: 'ort', label: 'Ort', sortable: true },
  { key: 'aktiv', label: 'Status', sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
]

export default function LagerPage({ breadcrumb, title }) {
  const { rows, loading, insert, update } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(lager) {
    setFormValues(toFormValues(lager))
    setDialog({ mode: 'edit', lager })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    if (dialog.mode === 'create') {
      await insert(formValues)
    } else {
      await update(dialog.lager.id, formValues)
    }
  }

  async function toggleActive(lager) {
    await update(lager.id, { aktiv: !lager.aktiv })
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
          Neues Lager
        </button>
      </div>

      <DataTable
        columns={tableColumns}
        rows={rows}
        loading={loading}
        searchPlaceholder="Lager durchsuchen…"
        emptyMessage="Es wurden noch keine Lager angelegt."
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? 'Neues Lager anlegen' : 'Lager bearbeiten'}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label="Bezeichnung">
            <input
              required
              value={formValues.bezeichnung}
              onChange={(event) => updateField('bezeichnung', event.target.value)}
            />
          </Field>

          <Field label="Straße">
            <input value={formValues.strasse} onChange={(event) => updateField('strasse', event.target.value)} />
          </Field>

          <div className="field-row">
            <Field label="PLZ">
              <input value={formValues.plz} onChange={(event) => updateField('plz', event.target.value)} />
            </Field>
            <Field label="Ort">
              <input value={formValues.ort} onChange={(event) => updateField('ort', event.target.value)} />
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  )
}
