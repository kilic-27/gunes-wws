import { useMemo, useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ImageUpload from '../components/ui/ImageUpload.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const PHOTO_BUCKET = 'mitarbeiter-fotos'

const emptyForm = {
  username: '',
  vorname: '',
  nachname: '',
  email: '',
  mobil: '',
  strasse: '',
  plz: '',
  ort: '',
  position_id: '',
  anstellungsverhaeltnis: '',
  vertragsende: '',
  geschlecht: '',
  geburtsdatum: '',
  benachrichtigung: true,
  app_zugang: false,
  foto_url: null,
  bemerkung: '',
}

function toFormValues(mitarbeiter) {
  if (!mitarbeiter) return emptyForm
  return {
    username: mitarbeiter.username ?? '',
    vorname: mitarbeiter.vorname ?? '',
    nachname: mitarbeiter.nachname ?? '',
    email: mitarbeiter.email ?? '',
    mobil: mitarbeiter.mobil ?? '',
    strasse: mitarbeiter.strasse ?? '',
    plz: mitarbeiter.plz ?? '',
    ort: mitarbeiter.ort ?? '',
    position_id: mitarbeiter.position_id ?? '',
    anstellungsverhaeltnis: mitarbeiter.anstellungsverhaeltnis ?? '',
    vertragsende: mitarbeiter.vertragsende ?? '',
    geschlecht: mitarbeiter.geschlecht ?? '',
    geburtsdatum: mitarbeiter.geburtsdatum ?? '',
    benachrichtigung: mitarbeiter.benachrichtigung ?? true,
    app_zugang: mitarbeiter.app_zugang ?? false,
    foto_url: mitarbeiter.foto_url ?? null,
    bemerkung: mitarbeiter.bemerkung ?? '',
  }
}

function toPayload(values) {
  return {
    ...values,
    position_id: values.position_id === '' ? null : values.position_id,
    vertragsende: values.vertragsende === '' ? null : values.vertragsende,
    geburtsdatum: values.geburtsdatum === '' ? null : values.geburtsdatum,
  }
}

export default function MitarbeiterPage({ breadcrumb, title }) {
  const { rows, loading, insert, update } = useSupabaseTable('mitarbeiter', {
    orderBy: 'nachname',
    ascending: true,
  })
  const { rows: positionen } = useSupabaseTable('positionen', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  const positionMap = useMemo(() => new Map(positionen.map((p) => [p.id, p.name])), [positionen])
  const rowsWithPosition = useMemo(
    () => rows.map((row) => ({ ...row, position_name: positionMap.get(row.position_id) ?? '–' })),
    [rows, positionMap],
  )
  const positionOptions = useMemo(
    () => positionen.filter((p) => p.aktiv || p.id === formValues.position_id),
    [positionen, formValues.position_id],
  )

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(mitarbeiter) {
    setFormValues(toFormValues(mitarbeiter))
    setDialog({ mode: 'edit', mitarbeiter })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    const payload = toPayload(formValues)
    if (dialog.mode === 'create') {
      await insert(payload)
    } else {
      await update(dialog.mitarbeiter.id, payload)
    }
  }

  async function toggleActive(mitarbeiter) {
    await update(mitarbeiter.id, { aktiv: !mitarbeiter.aktiv })
  }

  const tableColumns = [
    {
      key: 'nachname',
      label: 'Name / Username',
      sortable: true,
      render: (row) => (
        <EntityCell
          bucket={PHOTO_BUCKET}
          path={row.foto_url}
          isPublic={false}
          name={`${row.vorname} ${row.nachname}`.trim()}
          subtitle={row.username ? `@${row.username}` : null}
        />
      ),
    },
    { key: 'position_name', label: 'Position', sortable: true },
    { key: 'aktiv', label: 'Status', sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
    {
      key: 'mobil',
      label: 'Mobil / E-Mail',
      sortable: true,
      render: (row) => (
        <div>
          <div>{row.mobil || '–'}</div>
          {row.email && <div className="cell-person-sub">{row.email}</div>}
        </div>
      ),
    },
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
          Neuer Mitarbeiter
        </button>
      </div>

      <DataTable
        columns={tableColumns}
        rows={rowsWithPosition}
        loading={loading}
        searchPlaceholder="Mitarbeiter durchsuchen…"
        emptyMessage="Es wurden noch keine Mitarbeiter angelegt."
        searchKeys={['vorname', 'username', 'email']}
      />

      {dialog && (
        <FormDialog
          open
          size="lg"
          title={dialog.mode === 'create' ? 'Neuen Mitarbeiter anlegen' : 'Mitarbeiter bearbeiten'}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <div className="field">
            <span>Foto</span>
            <ImageUpload
              bucket={PHOTO_BUCKET}
              folder="mitarbeiter"
              isPublic={false}
              shape="circle"
              label="Mitarbeiterfoto"
              value={formValues.foto_url}
              onChange={(path) => updateField('foto_url', path)}
            />
          </div>

          <div className="field-row">
            <Field label="Vorname">
              <input value={formValues.vorname} onChange={(event) => updateField('vorname', event.target.value)} />
            </Field>
            <Field label="Nachname">
              <input value={formValues.nachname} onChange={(event) => updateField('nachname', event.target.value)} />
            </Field>
          </div>

          <div className="field-row">
            <Field label="Username">
              <input value={formValues.username} onChange={(event) => updateField('username', event.target.value)} />
            </Field>
            <Field label="E-Mail">
              <input
                type="email"
                value={formValues.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </Field>
          </div>

          <div className="field-row">
            <Field label="Mobil">
              <input value={formValues.mobil} onChange={(event) => updateField('mobil', event.target.value)} />
            </Field>
            <Field label="Position">
              <select
                value={formValues.position_id}
                onChange={(event) => updateField('position_id', event.target.value)}
              >
                <option value="">– Keine Angabe –</option>
                {positionOptions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
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
            <Field label="Anstellungsverhältnis">
              <input
                value={formValues.anstellungsverhaeltnis}
                onChange={(event) => updateField('anstellungsverhaeltnis', event.target.value)}
              />
            </Field>
            <Field label="Vertragsende">
              <input
                type="date"
                value={formValues.vertragsende}
                onChange={(event) => updateField('vertragsende', event.target.value)}
              />
            </Field>
          </div>

          <div className="field-row">
            <Field label="Geschlecht">
              <select
                value={formValues.geschlecht}
                onChange={(event) => updateField('geschlecht', event.target.value)}
              >
                <option value="">– Keine Angabe –</option>
                <option value="weiblich">weiblich</option>
                <option value="männlich">männlich</option>
                <option value="divers">divers</option>
              </select>
            </Field>
            <Field label="Geburtsdatum">
              <input
                type="date"
                value={formValues.geburtsdatum}
                onChange={(event) => updateField('geburtsdatum', event.target.value)}
              />
            </Field>
          </div>

          <div className="field-row">
            <label className="field field-checkbox">
              <input
                type="checkbox"
                checked={formValues.benachrichtigung}
                onChange={(event) => updateField('benachrichtigung', event.target.checked)}
              />
              <span>Benachrichtigungen erhalten</span>
            </label>
            <label className="field field-checkbox">
              <input
                type="checkbox"
                checked={formValues.app_zugang}
                onChange={(event) => updateField('app_zugang', event.target.checked)}
              />
              <span>App-Zugang</span>
            </label>
          </div>

          <Field label="Bemerkung">
            <textarea
              value={formValues.bemerkung}
              onChange={(event) => updateField('bemerkung', event.target.value)}
            />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
