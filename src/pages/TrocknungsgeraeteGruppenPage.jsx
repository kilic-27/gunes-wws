import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Power } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

export default function TrocknungsgeraeteGruppenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const gruppen = useSupabaseTable('trocknungsgeraet_gruppen', { orderBy: 'name', ascending: true })
  const geraete = useSupabaseTable('trocknungsgeraete', { orderBy: 'barcode', ascending: true })
  const [dialog, setDialog] = useState(null)
  const [name, setName] = useState('')

  const rows = useMemo(
    () =>
      gruppen.rows.map((g) => {
        const own = geraete.rows.filter((x) => x.gruppe_id === g.id)
        return { ...g, anzahl: own.length, verfuegbar: own.filter((x) => x.status === 'verfuegbar').length }
      }),
    [gruppen.rows, geraete.rows],
  )

  function openCreate() {
    setName('')
    setDialog({ mode: 'create' })
  }

  function openEdit(row) {
    setName(row.name)
    setDialog({ mode: 'edit', row })
  }

  async function submit() {
    const payload = { name: name.trim() }
    if (dialog.mode === 'create') await gruppen.insert(payload)
    else await gruppen.update(dialog.row.id, payload)
  }

  const columns = [
    { key: 'name', label: t('fields.name'), sortable: true },
    { key: 'anzahl', label: t('trocknung.anzahlGeraete'), sortable: true },
    { key: 'verfuegbar', label: t('trocknung.status.verfuegbar'), sortable: true },
    { key: 'aktiv', label: t('common.status'), sortable: true, render: (r) => <StatusBadge active={r.aktiv} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="data-table-row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>
            <Pencil size={14} />
            {t('common.edit')}
          </button>
          <button
            type="button"
            className={'btn btn-sm ' + (r.aktiv ? 'btn-danger-ghost' : 'btn-ghost')}
            onClick={() => gruppen.update(r.id, { aktiv: !r.aktiv })}
          >
            <Power size={14} />
            {r.aktiv ? t('common.deactivate') : t('common.activate')}
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
          {t('trocknung.neueGruppe')}
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={gruppen.loading || geraete.loading}
        searchPlaceholder={t('trocknung.gruppeSuchen')}
        emptyMessage={t('trocknung.keineGruppen')}
      />

      {dialog && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? t('trocknung.neueGruppe') : t('trocknung.gruppeBearbeiten')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={submit}
        >
          <Field label={t('fields.name')}>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}
