import { useState } from 'react'
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

const columns = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    render: (row) => <EntityCell bucket="public-media" path={row.logo_url} isPublic name={row.name} />,
  },
  { key: 'ort', label: 'Ort', sortable: true },
  { key: 'telefon', label: 'Telefon' },
  { key: 'email', label: 'E-Mail' },
  { key: 'aktiv', label: 'Status', sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
]

export default function FirmenPage({ breadcrumb, title }) {
  const { rows, loading, insert, update } = useSupabaseTable('firmen', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null) // { mode: 'create' | 'edit', firma? }
  const [formValues, setFormValues] = useState(emptyForm)

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
          Neue Firma
        </button>
      </div>

      <DataTable
        columns={tableColumns}
        rows={rows}
        loading={loading}
        searchPlaceholder="Firmen durchsuchen…"
        emptyMessage="Es wurden noch keine Firmen angelegt."
      />

      {dialog && (
        <FormDialog
          open
          size="lg"
          title={dialog.mode === 'create' ? 'Neue Firma anlegen' : 'Firma bearbeiten'}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label="Name">
            <input
              required
              value={formValues.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </Field>

          <div className="field">
            <span>Logo</span>
            <ImageUpload
              bucket="public-media"
              folder="firmen"
              isPublic
              label="Firmenlogo"
              value={formValues.logo_url}
              onChange={(path) => updateField('logo_url', path)}
            />
          </div>

          <div className="field-row">
            <Field label="Geschäftsführer">
              <input
                value={formValues.geschaeftsfuehrer}
                onChange={(event) => updateField('geschaeftsfuehrer', event.target.value)}
              />
            </Field>
            <Field label="USt-ID">
              <input value={formValues.ust_id} onChange={(event) => updateField('ust_id', event.target.value)} />
            </Field>
          </div>

          <div className="field-row">
            <Field label="Registergericht">
              <input
                value={formValues.registergericht}
                onChange={(event) => updateField('registergericht', event.target.value)}
              />
            </Field>
            <Field label="Registernummer">
              <input
                value={formValues.registernummer}
                onChange={(event) => updateField('registernummer', event.target.value)}
              />
            </Field>
          </div>

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

          <div className="field-row">
            <Field label="Telefon">
              <input value={formValues.telefon} onChange={(event) => updateField('telefon', event.target.value)} />
            </Field>
            <Field label="E-Mail">
              <input
                type="email"
                value={formValues.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </Field>
          </div>

          <Field label="Webseite">
            <input value={formValues.webseite} onChange={(event) => updateField('webseite', event.target.value)} />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
