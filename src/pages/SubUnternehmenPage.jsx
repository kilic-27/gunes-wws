import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power, Check } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = { name: '', ansprechpartner: '', telefon: '', email: '', ort_id: '', land_id: '', auftraggeberIds: [] }

function toFormValues(row, auftraggeberIds) {
  if (!row) return emptyForm
  return {
    name: row.name ?? '',
    ansprechpartner: row.ansprechpartner ?? '',
    telefon: row.telefon ?? '',
    email: row.email ?? '',
    ort_id: row.ort_id ?? '',
    land_id: row.land_id ?? '',
    auftraggeberIds,
  }
}

function toPayload(values) {
  return {
    name: values.name,
    ansprechpartner: values.ansprechpartner || null,
    telefon: values.telefon || null,
    email: values.email || null,
    ort_id: values.ort_id || null,
    land_id: values.land_id || null,
  }
}

export default function SubUnternehmenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('sub_unternehmen', { orderBy: 'name', ascending: true })
  const { rows: auftraggeberRows } = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const junction = useSupabaseTable('sub_unternehmen_auftraggeber', { orderBy: 'id', ascending: true })
  const { rows: orte } = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  const ortOptions = useMemo(() => orte.filter((o) => o.typ === 'adresse' && o.aktiv), [orte])
  const ortMap = useMemo(() => new Map(orte.map((o) => [o.id, o.name])), [orte])
  const landOptions = useMemo(() => laender.filter((l) => l.aktiv), [laender])
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
      rows.map((row) => ({
        ...row,
        ort_name: ortMap.get(row.ort_id) ?? '–',
        auftraggeber_names: (auftraggeberNamesBySub.get(row.id) ?? []).join(', ') || '–',
      })),
    [rows, ortMap, auftraggeberNamesBySub],
  )

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(row) {
    const currentIds = junction.rows.filter((j) => j.sub_unternehmen_id === row.id).map((j) => j.auftraggeber_id)
    setFormValues(toFormValues(row, currentIds))
    setDialog({ mode: 'edit', row })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
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
    const payload = toPayload(formValues)
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

          <div className="field-row">
            <Field label={t('fields.ort')}>
              <select value={formValues.ort_id} onChange={(event) => updateField('ort_id', event.target.value)}>
                <option value="">{t('common.noSelection')}</option>
                {ortOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('fields.land')}>
              <select value={formValues.land_id} onChange={(event) => updateField('land_id', event.target.value)}>
                <option value="">{t('common.noSelection')}</option>
                {landOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

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
