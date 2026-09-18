import { useMemo, useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const VIEW_OPTIONS = [
  { value: 'adresse', label: 'Adress-Orte' },
  { value: 'firmenstandort', label: 'Firmenstandorte' },
]

function emptyFormFor(typ) {
  return typ === 'adresse'
    ? { typ, name: '', plz: '' }
    : { typ, name: '', strasse: '', plz: '', ort: '', telefon: '' }
}

function toFormValues(row) {
  if (!row) return emptyFormFor('adresse')
  if (row.typ === 'adresse') {
    return { typ: row.typ, name: row.name ?? '', plz: row.plz ?? '' }
  }
  return {
    typ: row.typ,
    name: row.name ?? '',
    strasse: row.strasse ?? '',
    plz: row.plz ?? '',
    ort: row.ort ?? '',
    telefon: row.telefon ?? '',
  }
}

const adresseColumns = [
  { key: 'name', label: 'Ort', sortable: true },
  { key: 'plz', label: 'PLZ', sortable: true },
]

const firmenstandortColumns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'strasse', label: 'Straße' },
  { key: 'plz', label: 'PLZ' },
  { key: 'ort', label: 'Ort', sortable: true },
  { key: 'telefon', label: 'Telefon' },
]

export default function OrtePage({ breadcrumb, title }) {
  const { rows, loading, insert, update } = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const [view, setView] = useState('adresse')
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyFormFor('adresse'))

  const filteredRows = useMemo(() => rows.filter((row) => row.typ === view), [rows, view])

  function openCreate() {
    setFormValues(emptyFormFor(view))
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
    if (dialog.mode === 'create') {
      await insert(formValues)
    } else {
      await update(dialog.row.id, formValues)
    }
  }

  async function toggleActive(row) {
    await update(row.id, { aktiv: !row.aktiv })
  }

  const baseColumns = view === 'adresse' ? adresseColumns : firmenstandortColumns
  const tableColumns = [
    ...baseColumns,
    { key: 'aktiv', label: 'Status', sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
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

  const isAdresseDialog = dialog?.typ === 'adresse'
  const createLabel = view === 'adresse' ? 'Neuer Ort' : 'Neuer Standort'
  const dialogTitle = dialog
    ? dialog.mode === 'create'
      ? isAdresseDialog
        ? 'Neuen Ort anlegen'
        : 'Neuen Standort anlegen'
      : isAdresseDialog
        ? 'Ort bearbeiten'
        : 'Standort bearbeiten'
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
        searchPlaceholder="Orte durchsuchen…"
        emptyMessage={view === 'adresse' ? 'Es wurden noch keine Adress-Orte angelegt.' : 'Es wurden noch keine Firmenstandorte angelegt.'}
      />

      {dialog && (
        <FormDialog
          open
          title={dialogTitle}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          {isAdresseDialog ? (
            <>
              <Field label="Ort">
                <input
                  required
                  value={formValues.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </Field>
              <Field label="PLZ">
                <input value={formValues.plz} onChange={(event) => updateField('plz', event.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Name">
                <input
                  required
                  value={formValues.name}
                  onChange={(event) => updateField('name', event.target.value)}
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
              <Field label="Telefon (optional)">
                <input value={formValues.telefon} onChange={(event) => updateField('telefon', event.target.value)} />
              </Field>
            </>
          )}
        </FormDialog>
      )}
    </div>
  )
}
