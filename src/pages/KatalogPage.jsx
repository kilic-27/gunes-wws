import { useMemo, useState } from 'react'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import Badge from '../components/ui/Badge.jsx'
import ImageUpload from '../components/ui/ImageUpload.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const TYP_LABELS = {
  verbrauchsmaterial: { label: 'Verbrauchsmaterial', tone: 'blue' },
  werkzeug: { label: 'Werkzeug & Geräte', tone: 'amber' },
}

const TYP_FILTER_OPTIONS = [
  { value: 'alle', label: 'Alle' },
  { value: 'verbrauchsmaterial', label: 'Verbrauchsmaterial' },
  { value: 'werkzeug', label: 'Werkzeug & Geräte' },
]

const currencyFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

const emptyForm = {
  name: '',
  foto_url: null,
  typ: 'verbrauchsmaterial',
  beschreibung: '',
  preis: '',
  vpe: '',
  gewerk_id: '',
  standard_lager_id: '',
  meldebestand: '',
}

function toFormValues(artikel) {
  if (!artikel) return emptyForm
  return {
    name: artikel.name ?? '',
    foto_url: artikel.foto_url ?? null,
    typ: artikel.typ ?? 'verbrauchsmaterial',
    beschreibung: artikel.beschreibung ?? '',
    preis: artikel.preis ?? '',
    vpe: artikel.vpe ?? '',
    gewerk_id: artikel.gewerk_id ?? '',
    standard_lager_id: artikel.standard_lager_id ?? '',
    meldebestand: artikel.meldebestand ?? '',
  }
}

function toPayload(values) {
  return {
    ...values,
    preis: values.preis === '' ? null : Number(values.preis),
    meldebestand: values.meldebestand === '' ? null : Number(values.meldebestand),
    gewerk_id: values.gewerk_id === '' ? null : values.gewerk_id,
    standard_lager_id: values.standard_lager_id === '' ? null : values.standard_lager_id,
  }
}

export default function KatalogPage({ breadcrumb, title }) {
  const { rows, loading, insert, update } = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const { rows: gewerke } = useSupabaseTable('gewerke', { orderBy: 'name', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const [typFilter, setTypFilter] = useState('alle')
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  const gewerkMap = useMemo(() => new Map(gewerke.map((g) => [g.id, g.name])), [gewerke])
  const lagerMap = useMemo(() => new Map(lager.map((l) => [l.id, l.bezeichnung])), [lager])

  const rowsEnriched = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        gewerk_name: gewerkMap.get(row.gewerk_id) ?? '–',
        lager_name: lagerMap.get(row.standard_lager_id) ?? '–',
        preis_num: row.preis == null ? null : Number(row.preis),
      })),
    [rows, gewerkMap, lagerMap],
  )

  const filteredRows = useMemo(
    () => (typFilter === 'alle' ? rowsEnriched : rowsEnriched.filter((row) => row.typ === typFilter)),
    [rowsEnriched, typFilter],
  )

  const gewerkOptions = useMemo(
    () => gewerke.filter((g) => g.aktiv || g.id === formValues.gewerk_id),
    [gewerke, formValues.gewerk_id],
  )
  const lagerOptions = useMemo(
    () => lager.filter((l) => l.aktiv || l.id === formValues.standard_lager_id),
    [lager, formValues.standard_lager_id],
  )

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(artikel) {
    setFormValues(toFormValues(artikel))
    setDialog({ mode: 'edit', artikel })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    const payload = toPayload(formValues)
    if (dialog.mode === 'create') {
      await insert(payload)
    } else {
      await update(dialog.artikel.id, payload)
    }
  }

  async function toggleActive(artikel) {
    await update(artikel.id, { aktiv: !artikel.aktiv })
  }

  const tableColumns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.foto_url} isPublic name={row.name} />,
    },
    {
      key: 'typ',
      label: 'Typ',
      sortable: true,
      render: (row) => {
        const meta = TYP_LABELS[row.typ] ?? { label: row.typ, tone: 'gray' }
        return <Badge label={meta.label} tone={meta.tone} />
      },
    },
    { key: 'gewerk_name', label: 'Gewerk', sortable: true },
    {
      key: 'preis_num',
      label: 'Preis',
      sortable: true,
      render: (row) => (row.preis_num == null ? '–' : currencyFormatter.format(row.preis_num)),
    },
    { key: 'lager_name', label: 'Standard-Lager', sortable: true },
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

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Neuer Artikel
        </button>
      </div>

      <Segmented options={TYP_FILTER_OPTIONS} value={typFilter} onChange={setTypFilter} />

      <DataTable
        columns={tableColumns}
        rows={filteredRows}
        loading={loading}
        searchPlaceholder="Artikel durchsuchen…"
        emptyMessage="Es wurden noch keine Artikel angelegt."
        searchKeys={['beschreibung']}
      />

      {dialog && (
        <FormDialog
          open
          size="lg"
          title={dialog.mode === 'create' ? 'Neuen Artikel anlegen' : 'Artikel bearbeiten'}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <div className="field">
            <span>Foto</span>
            <ImageUpload
              bucket="public-media"
              folder="artikel"
              isPublic
              label="Artikelfoto"
              value={formValues.foto_url}
              onChange={(path) => updateField('foto_url', path)}
            />
          </div>

          <Field label="Name">
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>

          <div className="field-row">
            <Field label="Typ">
              <select value={formValues.typ} onChange={(event) => updateField('typ', event.target.value)}>
                <option value="verbrauchsmaterial">Verbrauchsmaterial</option>
                <option value="werkzeug">Werkzeug & Geräte</option>
              </select>
            </Field>
            <Field label="Gewerk">
              <select
                value={formValues.gewerk_id}
                onChange={(event) => updateField('gewerk_id', event.target.value)}
              >
                <option value="">– Keine Angabe –</option>
                {gewerkOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Beschreibung">
            <textarea
              value={formValues.beschreibung}
              onChange={(event) => updateField('beschreibung', event.target.value)}
            />
          </Field>

          <div className="field-row">
            <Field label="Preis (€)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={formValues.preis}
                onChange={(event) => updateField('preis', event.target.value)}
              />
            </Field>
            <Field label="VPE (Verpackungseinheit)">
              <input
                placeholder="z. B. Stück"
                value={formValues.vpe}
                onChange={(event) => updateField('vpe', event.target.value)}
              />
            </Field>
          </div>

          <div className="field-row">
            <Field label="Standard-Lager">
              <select
                value={formValues.standard_lager_id}
                onChange={(event) => updateField('standard_lager_id', event.target.value)}
              >
                <option value="">– Keine Angabe –</option>
                {lagerOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.bezeichnung}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Meldebestand">
              <input
                type="number"
                step="1"
                min="0"
                value={formValues.meldebestand}
                onChange={(event) => updateField('meldebestand', event.target.value)}
              />
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  )
}
