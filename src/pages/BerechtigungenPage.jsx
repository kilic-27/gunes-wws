import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Wand2 } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { PERMISSIONS_CHANGED_EVENT, usePermissions } from '../auth/usePermissions.js'

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

// Vorschlag für sinnvolle Standardrechte je Position (V = voll, B = bearbeiten, L = lesen, K = kein Zugriff).
// Reihenfolge wie BEREICHE: dashboard, baustellen, kunden, lieferscheine, artikel, trocknung, kleidung, lager, bestellungen, benutzer, einstellungen, sonstiges
const SHORT = { V: 'voll', B: 'bearbeiten', L: 'lesen', K: 'keins' }
const PRESETS = {
  'Administrator': 'VVVVVVVVVVVV',
  'Geschäftsführer/in': 'VVVVVVVVVVVV',
  'Verwaltung': 'LBBBLLLLBLKL',
  'Bürokraft': 'LBBBLLLLBLKL',
  'Buchhaltung': 'LBBBLLLLBLKL',
  'Lagerist/in': 'LLLBBBBBBKKK',
  'Bauleiter/in': 'LBLBLLLLKKKK',
  'Einsatzleiter': 'LBLBLLLLKKKK',
  'Vorarbeiter/in': 'LLKBLLLKKKKK',
  'Trocknungstechniker/in': 'LLKBLBKKKKKK',
  'Qualitätsmanagement': 'LLLLLLLLKKKK',
  'SFA': 'LKKLLKKKKKKK',
  'Maler/in': 'LKKLLKKKKKKK',
  'Sub Unternehmer': 'LKKLLKKKKKKK',
}
const FALLBACK_PRESET = 'LKKLLKKKKKKK'

export default function BerechtigungenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const positionen = useSupabaseTable('positionen', { orderBy: 'name', ascending: true })
  const rechte = useSupabaseTable('rollen_rechte', { orderBy: 'bereich' })
  const mitarbeiter = useSupabaseTable('mitarbeiter', { orderBy: 'nachname', ascending: true })
  const { position: ownPosition, unrestricted, configured } = usePermissions()

  const [presetOpen, setPresetOpen] = useState(false)
  const [error, setError] = useState('')

  const columns = useMemo(() => positionen.rows.filter((p) => p.aktiv), [positionen.rows])

  const rechteMap = useMemo(() => {
    const map = new Map()
    for (const row of rechte.rows) {
      if (row.position_id) map.set(`${row.position_id}_${row.bereich}`, row)
    }
    return map
  }, [rechte.rows])

  const countByPosition = useMemo(() => {
    const map = new Map()
    for (const m of mitarbeiter.rows) {
      if (m.position_id && m.aktiv) map.set(m.position_id, (map.get(m.position_id) ?? 0) + 1)
    }
    return map
  }, [mitarbeiter.rows])

  const configuredPositions = useMemo(() => new Set(rechte.rows.filter((r) => r.position_id).map((r) => r.position_id)), [rechte.rows])
  const unconfigured = columns.filter((p) => !configuredPositions.has(p.id))

  const levelFor = (positionId, bereich) => rechteMap.get(`${positionId}_${bereich}`)?.rechte ?? 'keins'
  const notifyChanged = () => window.dispatchEvent(new Event(PERMISSIONS_CHANGED_EVENT))

  async function run(fn) {
    setError('')
    try {
      await fn()
      notifyChanged()
    } catch (err) {
      setError(err?.message || t('common.saveFailed'))
    }
  }

  async function setLevel(positionId, bereich, level) {
    await run(async () => {
      const existing = rechteMap.get(`${positionId}_${bereich}`)
      if (existing) await rechte.update(existing.id, { rechte: level })
      else await rechte.insert({ position_id: positionId, bereich, rechte: level })
    })
  }

  async function setAll(positionId, level) {
    if (!level) return
    await run(() => writeLevels(positionId, Object.fromEntries(BEREICHE.map((b) => [b.key, level]))))
  }

  async function writeLevels(positionId, levels) {
    const toInsert = []
    for (const b of BEREICHE) {
      const level = levels[b.key]
      const existing = rechteMap.get(`${positionId}_${b.key}`)
      if (existing) {
        if (existing.rechte !== level) await rechte.update(existing.id, { rechte: level })
      } else {
        toInsert.push({ position_id: positionId, bereich: b.key, rechte: level })
      }
    }
    if (toInsert.length > 0) await rechte.insertMany(toInsert)
  }

  async function applyPresets() {
    for (const p of unconfigured) {
      const code = PRESETS[p.name] ?? FALLBACK_PRESET
      const levels = Object.fromEntries(BEREICHE.map((b, i) => [b.key, SHORT[code[i]]]))
      await writeLevels(p.id, levels)
    }
    notifyChanged()
  }

  const loading = positionen.loading || rechte.loading

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <div className="page-toolbar-actions">
          {unconfigured.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => setPresetOpen(true)}>
              <Wand2 size={16} />
              {t('berechtigungen.vorschlagButton')}
            </button>
          )}
        </div>
      </div>

      <p className="page-hint">
        {t('berechtigungen.intro')} <Link to="/einstellungen/positionen">{t('berechtigungen.positionenVerwalten')}</Link>
      </p>
      <p className="page-hint">
        {!configured
          ? t('berechtigungen.nichtEingerichtet')
          : unrestricted
            ? t('berechtigungen.ownRoleHint')
            : t('berechtigungen.ownRoleHintAssigned', { role: ownPosition?.name ?? '–' })}
      </p>
      {configured && unconfigured.length > 0 && (
        <p className="page-hint">{t('berechtigungen.ohneRechte', { names: unconfigured.map((p) => p.name).join(', ') })}</p>
      )}
      {error && <p className="login-error">{error}</p>}

      {loading ? (
        <p className="page-hint">{t('common.loading')}</p>
      ) : columns.length === 0 ? (
        <p className="page-hint">{t('berechtigungen.noRoles')}</p>
      ) : (
        <div className="data-table-wrap">
          <div className="data-table-scroll">
            <table className="rechte-matrix">
              <thead>
                <tr>
                  <th className="rechte-matrix-bereich-col">{t('berechtigungen.bereichColumn')}</th>
                  {columns.map((position) => (
                    <th key={position.id}>
                      <div className="rechte-matrix-role-head">
                        <span>{position.name}</span>
                        <span className="cell-person-sub">{t('berechtigungen.mitarbeiterAnzahl', { count: countByPosition.get(position.id) ?? 0 })}</span>
                        <select
                          className="rechte-quick"
                          value=""
                          aria-label={t('berechtigungen.alleSetzen')}
                          onChange={(event) => setAll(position.id, event.target.value)}
                        >
                          <option value="">{t('berechtigungen.alleSetzen')}</option>
                          {LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {t(`berechtigungen.level_${level}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BEREICHE.map((bereich) => (
                  <tr key={bereich.key}>
                    <td className="rechte-matrix-bereich-col">{t(bereich.labelKey)}</td>
                    {columns.map((position) => (
                      <td key={position.id}>
                        <select
                          value={levelFor(position.id, bereich.key)}
                          onChange={(event) => setLevel(position.id, bereich.key, event.target.value)}
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

      {presetOpen && (
        <FormDialog
          open
          title={t('berechtigungen.vorschlagTitel')}
          submitLabel={t('berechtigungen.vorschlagUebernehmen')}
          onClose={() => setPresetOpen(false)}
          onSubmit={applyPresets}
        >
          <p>{t('berechtigungen.vorschlagText', { count: unconfigured.length })}</p>
          <ul className="rechte-preset-list">
            {unconfigured.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
          <p className="field-hint">{t('berechtigungen.vorschlagHinweis')}</p>
        </FormDialog>
      )}
    </div>
  )
}
