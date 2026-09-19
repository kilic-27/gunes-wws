import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { usePermissions } from '../auth/usePermissions.js'

const BEREICHE = [
  { key: 'dashboard', labelKey: 'nav.dashboard' },
  { key: 'baustellen', labelKey: 'nav.baustellen' },
  { key: 'kunden', labelKey: 'nav.kunden' },
  { key: 'lieferscheine', labelKey: 'nav.lieferscheine' },
  { key: 'artikel', labelKey: 'nav.artikel' },
  { key: 'trocknungsgeraete', labelKey: 'nav.trocknungsgeraete' },
  { key: 'arbeitskleidung', labelKey: 'nav.arbeitskleidung' },
  { key: 'lager', labelKey: 'nav.lager' },
  { key: 'artikel_bestellungen', labelKey: 'nav.artikelBestellungen' },
  { key: 'benutzer', labelKey: 'nav.benutzer' },
  { key: 'einstellungen', labelKey: 'nav.einstellungen' },
  { key: 'sonstiges', labelKey: 'nav.sonstiges' },
]

const LEVELS = ['keins', 'lesen', 'bearbeiten', 'voll']

const emptyRoleForm = { name: '', beschreibung: '' }

export default function BerechtigungenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows: rollen, loading: rollenLoading, insert: insertRolle, remove: removeRolle } = useSupabaseTable(
    'rollen',
    { orderBy: 'name', ascending: true },
  )
  const { rows: rollenRechte, insert: insertRecht, update: updateRecht } = useSupabaseTable('rollen_rechte', {
    orderBy: 'bereich',
  })
  const { rolle: ownRolle, unrestricted } = usePermissions()

  const [createOpen, setCreateOpen] = useState(false)
  const [roleForm, setRoleForm] = useState(emptyRoleForm)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const rechteMap = useMemo(() => {
    const map = new Map()
    for (const row of rollenRechte) {
      map.set(`${row.rolle_id}_${row.bereich}`, row)
    }
    return map
  }, [rollenRechte])

  function levelFor(rolleId, bereich) {
    return rechteMap.get(`${rolleId}_${bereich}`)?.rechte ?? 'keins'
  }

  async function handleLevelChange(rolleId, bereich, rechte) {
    const existing = rechteMap.get(`${rolleId}_${bereich}`)
    if (existing) {
      await updateRecht(existing.id, { rechte })
    } else {
      await insertRecht({ rolle_id: rolleId, bereich, rechte })
    }
  }

  async function handleCreateRole() {
    await insertRolle({ name: roleForm.name, beschreibung: roleForm.beschreibung || null })
    setRoleForm(emptyRoleForm)
  }

  async function handleDeleteRole() {
    await removeRolle(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          {t('berechtigungen.newRoleButton')}
        </button>
      </div>

      <p className="page-hint">{t('berechtigungen.intro')}</p>
      <p className="page-hint">
        {unrestricted
          ? t('berechtigungen.ownRoleHint')
          : t('berechtigungen.ownRoleHintAssigned', { role: ownRolle?.name ?? '–' })}
      </p>

      {rollenLoading ? (
        <p className="page-hint">{t('common.loading')}</p>
      ) : rollen.length === 0 ? (
        <p className="page-hint">{t('berechtigungen.noRoles')}</p>
      ) : (
        <div className="data-table-wrap">
          <div className="data-table-scroll">
            <table className="rechte-matrix">
              <thead>
                <tr>
                  <th className="rechte-matrix-bereich-col">{t('berechtigungen.bereichColumn')}</th>
                  {rollen.map((rolle) => (
                    <th key={rolle.id}>
                      <div className="rechte-matrix-role-head">
                        <span>{rolle.name}</span>
                        <button
                          type="button"
                          className="icon-button icon-button-sm"
                          aria-label={t('berechtigungen.deleteRoleTitle')}
                          onClick={() => setDeleteTarget(rolle)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BEREICHE.map((bereich) => (
                  <tr key={bereich.key}>
                    <td className="rechte-matrix-bereich-col">{t(bereich.labelKey)}</td>
                    {rollen.map((rolle) => (
                      <td key={rolle.id}>
                        <select
                          value={levelFor(rolle.id, bereich.key)}
                          onChange={(event) => handleLevelChange(rolle.id, bereich.key, event.target.value)}
                        >
                          {LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {t(`berechtigungen.level_${level}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && (
        <FormDialog
          open
          title={t('berechtigungen.createRoleTitle')}
          submitLabel={t('common.create')}
          onClose={() => {
            setCreateOpen(false)
            setRoleForm(emptyRoleForm)
          }}
          onSubmit={handleCreateRole}
        >
          <Field label={t('berechtigungen.roleNameLabel')}>
            <input
              required
              placeholder={t('berechtigungen.roleNamePlaceholder')}
              value={roleForm.name}
              onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label={t('berechtigungen.roleDescriptionLabel')}>
            <input
              value={roleForm.beschreibung}
              onChange={(event) => setRoleForm((current) => ({ ...current, beschreibung: event.target.value }))}
            />
          </Field>
        </FormDialog>
      )}

      {deleteTarget && (
        <FormDialog
          open
          title={t('berechtigungen.deleteRoleTitle')}
          submitLabel={t('common.delete')}
          onClose={() => setDeleteTarget(null)}
          onSubmit={handleDeleteRole}
        >
          <p>{t('berechtigungen.deleteRoleBody', { name: deleteTarget.name })}</p>
        </FormDialog>
      )}
    </div>
  )
}
