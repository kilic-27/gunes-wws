import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import AddressFields from '../components/ui/AddressFields.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ImageUpload from '../components/ui/ImageUpload.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { resolveOrtId } from '../lib/addressLookup.js'

function emptyFormFor(standardLandId) {
  return {
    name: '',
    logo_url: null,
    ansprechpartner: '',
    telefon: '',
    email: '',
    strasse: '',
    plz: '',
    ort: '',
    land_id: standardLandId ?? '',
  }
}

function toFormValues(row, ortMap) {
  if (!row) return emptyFormFor('')
  const ort = ortMap.get(row.ort_id)
  return {
    name: row.name ?? '',
    logo_url: row.logo_url ?? null,
    ansprechpartner: row.ansprechpartner ?? '',
    telefon: row.telefon ?? '',
    email: row.email ?? '',
    strasse: ort?.strasse ?? '',
    plz: ort?.plz ?? '',
    ort: ort?.name ?? '',
    land_id: ort?.land_id ?? '',
  }
}

export default function AuftraggeberPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const orteTable = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyFormFor(''))

  const ortMap = useMemo(() => new Map(orteTable.rows.map((o) => [o.id, o])), [orteTable.rows])
  const landMap = useMemo(() => new Map(laender.map((l) => [l.id, l.name])), [laender])
  const standardLandId = useMemo(() => laender.find((l) => l.ist_standard)?.id ?? '', [laender])

  const rowsResolved = useMemo(
    () =>
      rows.map((row) => {
        const ort = ortMap.get(row.ort_id)
        return {
          ...row,
          strasse: ort?.strasse ?? '–',
          ort_name: ort?.name ?? '–',
          land_name: (ort?.land_id && landMap.get(ort.land_id)) ?? '–',
        }
      }),
    [rows, ortMap, landMap],
  )

  function openCreate() {
    setFormValues(emptyFormFor(standardLandId))
    setDialog({ mode: 'create' })
  }

  function openEdit(row) {
    setFormValues(toFormValues(row, ortMap))
    setDialog({ mode: 'edit', row })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  function updateAddress(patch) {
    setFormValues((current) => ({ ...current, ...patch }))
  }

  async function handleSubmit() {
    const ortId = await resolveOrtId(
      { strasse: formValues.strasse, plz: formValues.plz, ort: formValues.ort, land_id: formValues.land_id },
      orteTable.rows,
      orteTable,
    )
    const payload = {
      name: formValues.name,
      logo_url: formValues.logo_url,
      ansprechpartner: formValues.ansprechpartner || null,
      telefon: formValues.telefon || null,
      email: formValues.email || null,
      ort_id: ortId,
    }
    if (dialog.mode === 'create') {
      await insert(payload)
    } else {
      await update(dialog.row.id, payload)
    }
  }

  async function toggleActive(row) {
    await update(row.id, { aktiv: !row.aktiv })
  }

  const columns = [
    {
      key: 'name',
      label: t('fields.name'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.logo_url} isPublic name={row.name} />,
    },
    { key: 'strasse', label: t('fields.strasse') },
    { key: 'ort_name', label: t('fields.ort'), sortable: true },
    { key: 'land_name', label: t('fields.land'), sortable: true },
    { key: 'telefon', label: t('fields.telefon') },
    { key: 'email', label: t('fields.email') },
    { key: 'aktiv', label: t('common.status'), sortable: true, render: (row) => <StatusBadge active={row.aktiv} /> },
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
          {t('auftraggeber.newButton')}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rowsResolved}
        loading={loading}
        searchPlaceholder={t('auftraggeber.searchPlaceholder')}
        emptyMessage={t('auftraggeber.emptyMessage')}
      />

      {dialog && (
        <FormDialog
          open
          size="lg"
          title={dialog.mode === 'create' ? t('auftraggeber.createTitle') : t('auftraggeber.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label={t('fields.name')}>
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>

          <div className="field">
            <span>{t('fields.logo')}</span>
            <ImageUpload
              bucket="public-media"
              folder="auftraggeber"
              isPublic
              label={t('auftraggeber.logoAlt')}
              value={formValues.logo_url}
              onChange={(path) => updateField('logo_url', path)}
            />
          </div>

          <Field label={t('fields.ansprechpartnerOptional')}>
            <input
              value={formValues.ansprechpartner}
              onChange={(event) => updateField('ansprechpartner', event.target.value)}
            />
          </Field>

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

          <AddressFields values={formValues} onChange={updateAddress} orte={orteTable.rows} laender={laender} />
        </FormDialog>
      )}
    </div>
  )
}
