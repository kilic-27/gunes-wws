import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power, Check } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import AddressFields from '../components/ui/AddressFields.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { resolveOrtId } from '../lib/addressLookup.js'

function emptyFormFor(standardLandId) {
  return {
    name: '',
    ansprechpartner: '',
    telefon: '',
    email: '',
    strasse: '',
    plz: '',
    ort: '',
    land_id: standardLandId ?? '',
    auftraggeberIds: [],
  }
}

function toFormValues(row, ortMap, auftraggeberIds) {
  if (!row) return emptyFormFor('')
  const ort = ortMap.get(row.ort_id)
  return {
    name: row.name ?? '',
    ansprechpartner: row.ansprechpartner ?? '',
    telefon: row.telefon ?? '',
    email: row.email ?? '',
    strasse: ort?.strasse ?? '',
    plz: ort?.plz ?? '',
    ort: ort?.name ?? '',
    land_id: ort?.land_id ?? '',
    auftraggeberIds,
  }
}

export default function SubUnternehmenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('sub_unternehmen', { orderBy: 'name', ascending: true })
  const { rows: auftraggeberRows } = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const junction = useSupabaseTable('sub_unternehmen_auftraggeber', { orderBy: 'id', ascending: true })
  const orteTable = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyFormFor(''))

  const ortMap = useMemo(() => new Map(orteTable.rows.map((o) => [o.id, o])), [orteTable.rows])
  const landMap = useMemo(() => new Map(laender.map((l) => [l.id, l.name])), [laender])
  const standardLandId = useMemo(() => laender.find((l) => l.ist_standard)?.id ?? '', [laender])
  const auftraggeberOptions = useMemo(() => auftraggeberRows.filter((a) => a.aktiv), [auftraggeberRows])
  const auftraggeberMap = useMemo(() => new Map(auftraggeberRows.map((a) => [a.id, a.name])), [auftraggeberRows])

  const auftraggeberNamesBySub = useMemo(() => {
    const map = new Map()
    for (const j of junction.rows) {
      const list = map.get(j.sub_unternehmen_id) ?? []
      list.push(auftraggeberMap.get(j.auftraggeber_id) ?? '–')
      map.set(j.sub_unternehmen_id, list)
    }
    return map
  }, [junction.rows, auftraggeberMap])

  const rowsResolved = useMemo(
    () =>
      rows.map((row) => {
        const ort = ortMap.get(row.ort_id)
        return {
          ...row,
          ort_name: ort?.name ?? '–',
          land_name: (ort?.land_id && landMap.get(ort.land_id)) ?? '–',
          auftraggeber_names: (auftraggeberNamesBySub.get(row.id) ?? []).join(', ') || '–',
        }
      }),
    [rows, ortMap, landMap, auftraggeberNamesBySub],
  )

  function openCreate() {
    setFormValues(emptyFormFor(standardLandId))
    setDialog({ mode: 'create' })
  }

  function openEdit(row) {
    const currentIds = junction.rows.filter((j) => j.sub_unternehmen_id === row.id).map((j) => j.auftraggeber_id)
    setFormValues(toFormValues(row, ortMap, currentIds))
    setDialog({ mode: 'edit', row })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  function updateAddress(patch) {
    setFormValues((current) => ({ ...current, ...patch }))
  }

  function toggleAuftraggeber(id) {
    setFormValues((current) => ({
      ...current,
      auftraggeberIds: current.auftraggeberIds.includes(id)
        ? current.auftraggeberIds.filter((existing) => existing !== id)
        : [...current.auftraggeberIds, id],
    }))
  }

  async function syncJunction(subUnternehmenId) {
    const existing = junction.rows.filter((j) => j.sub_unternehmen_id === subUnternehmenId)
    const existingIds = existing.map((j) => j.auftraggeber_id)
    const toAdd = formValues.auftraggeberIds.filter((id) => !existingIds.includes(id))
    const toRemove = existing.filter((j) => !formValues.auftraggeberIds.includes(j.auftraggeber_id))

    if (toAdd.length > 0) {
      await junction.insertMany(
        toAdd.map((auftraggeber_id) => ({ sub_unternehmen_id: subUnternehmenId, auftraggeber_id })),
      )
    }
    for (const j of toRemove) {
      await junction.remove(j.id)
    }
  }

  async function handleSubmit() {
    const ortId = await resolveOrtId(
      { strasse: formValues.strasse, plz: formValues.plz, ort: formValues.ort, land_id: formValues.land_id },
      orteTable.rows,
      orteTable,
    )
    const payload = {
      name: formValues.name,
      ansprechpartner: formValues.ansprechpartner || null,
      telefon: formValues.telefon || null,
      email: formValues.email || null,
      ort_id: ortId,
    }
    if (dialog.mode === 'create') {
      const created = await insert(payload)
      await syncJunction(created.id)
    } else {
      await update(dialog.row.id, payload)
      await syncJunction(dialog.row.id)
    }
  }

  async function toggleActive(row) {
    await update(row.id, { aktiv: !row.aktiv })
  }

  const columns = [
    { key: 'name', label: t('fields.name'), sortable: true },
    { key: 'auftraggeber_names', label: t('subUnternehmen.colAuftraggeber') },
    { key: 'ort_name', label: t('fields.ort'), sortable: true },
    { key: 'land_name', label: t('fields.land'), sortable: true },
    { key: 'telefon', label: t('fields.telefon') },
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
          {t('subUnternehmen.newButton')}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rowsResolved}
        loading={loading}
        searchPlaceholder={t('subUnternehmen.searchPlaceholder')}
        emptyMessage={t('subUnternehmen.emptyMessage')}
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? t('subUnternehmen.createTitle') : t('subUnternehmen.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label={t('fields.name')}>
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>

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

          <div className="field">
            <span>{t('subUnternehmen.auftraggeberLabel')}</span>
            <div className="chip-toggle-group">
              {auftraggeberOptions.map((a) => {
                const active = formValues.auftraggeberIds.includes(a.id)
                return (
                  <button
                    type="button"
                    key={a.id}
                    className={'chip-toggle' + (active ? ' active' : '')}
                    onClick={() => toggleAuftraggeber(a.id)}
                  >
                    {active && <Check size={13} />}
                    {a.name}
                  </button>
                )
              })}
            </div>
          </div>
        </FormDialog>
      )}
    </div>
  )
}
