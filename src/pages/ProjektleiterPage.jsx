import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const emptyForm = { name: '', telefon: '', email: '', ort_id: '', land_id: '', sub_unternehmen_id: '' }

function toFormValues(row) {
  if (!row) return emptyForm
  return {
    name: row.name ?? '',
    telefon: row.telefon ?? '',
    email: row.email ?? '',
    ort_id: row.ort_id ?? '',
    land_id: row.land_id ?? '',
    sub_unternehmen_id: row.sub_unternehmen_id ?? '',
  }
}

function toPayload(values) {
  return {
    name: values.name,
    telefon: values.telefon || null,
    email: values.email || null,
    ort_id: values.ort_id || null,
    land_id: values.land_id || null,
    sub_unternehmen_id: values.sub_unternehmen_id || null,
  }
}

export default function ProjektleiterPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading, insert, update } = useSupabaseTable('projektleiter', { orderBy: 'name', ascending: true })
  const { rows: subUnternehmenRows } = useSupabaseTable('sub_unternehmen', { orderBy: 'name', ascending: true })
  const { rows: auftraggeberRows } = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const { rows: junctionRows } = useSupabaseTable('sub_unternehmen_auftraggeber', { orderBy: 'id', ascending: true })
  const { rows: orte } = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const { rows: laender } = useSupabaseTable('laender', { orderBy: 'name', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [formValues, setFormValues] = useState(emptyForm)

  const ortOptions = useMemo(() => orte.filter((o) => o.typ === 'adresse' && o.aktiv), [orte])
  const ortMap = useMemo(() => new Map(orte.map((o) => [o.id, o.name])), [orte])
  const landOptions = useMemo(() => laender.filter((l) => l.aktiv), [laender])
  const subUnternehmenOptions = useMemo(() => subUnternehmenRows.filter((s) => s.aktiv), [subUnternehmenRows])
  const subUnternehmenMap = useMemo(() => new Map(subUnternehmenRows.map((s) => [s.id, s.name])), [subUnternehmenRows])
  const auftraggeberMap = useMemo(() => new Map(auftraggeberRows.map((a) => [a.id, a.name])), [auftraggeberRows])

  const auftraggeberNamesBySub = useMemo(() => {
    const map = new Map()
    for (const j of junctionRows) {
      const list = map.get(j.sub_unternehmen_id) ?? []
      list.push(auftraggeberMap.get(j.auftraggeber_id) ?? '–')
      map.set(j.sub_unternehmen_id, list)
    }
    return map
  }, [junctionRows, auftraggeberMap])

  const rowsResolved = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        sub_unternehmen_name: subUnternehmenMap.get(row.sub_unternehmen_id) ?? '–',
        auftraggeber_names: row.sub_unternehmen_id
          ? (auftraggeberNamesBySub.get(row.sub_unternehmen_id) ?? []).join(', ') || '–'
          : '–',
      })),
    [rows, subUnternehmenMap, auftraggeberNamesBySub],
  )

  function openCreate() {
    setFormValues(emptyForm)
    setDialog({ mode: 'create' })
  }

  function openEdit(row) {
    setFormValues(toFormValues(row))
    setDialog({ mode: 'edit', row })
  }

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    const payload = toPayload(formValues)
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
    { key: 'name', label: t('fields.name'), sortable: true },
    { key: 'sub_unternehmen_name', label: t('projektleiter.colSubUnternehmen'), sortable: true },
    { key: 'auftraggeber_names', label: t('projektleiter.colAuftraggeber') },
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

  const selectedSubName = formValues.sub_unternehmen_id ? subUnternehmenMap.get(formValues.sub_unternehmen_id) : null
  const selectedAuftraggeberNames = formValues.sub_unternehmen_id
    ? (auftraggeberNamesBySub.get(formValues.sub_unternehmen_id) ?? []).join(', ')
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
          {t('projektleiter.newButton')}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rowsResolved}
        loading={loading}
        searchPlaceholder={t('projektleiter.searchPlaceholder')}
        emptyMessage={t('projektleiter.emptyMessage')}
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? t('projektleiter.createTitle') : t('projektleiter.editTitle')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
        >
          <Field label={t('fields.name')}>
            <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
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

          <Field label={t('projektleiter.subUnternehmenLabel')}>
            <select
              value={formValues.sub_unternehmen_id}
              onChange={(event) => updateField('sub_unternehmen_id', event.target.value)}
            >
              <option value="">{t('common.noSelection')}</option>
              {subUnternehmenOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          {selectedSubName && (
            <p className="field-hint">
              {t('projektleiter.colAuftraggeber')}: {selectedAuftraggeberNames || '–'}
            </p>
          )}
        </FormDialog>
      )}
    </div>
  )
}
