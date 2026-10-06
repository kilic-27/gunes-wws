import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Wind } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import StatChips from '../components/ui/StatChips.jsx'
import { STATUS_TONE, euro, useTrocknung } from '../lib/trocknung.js'

// Ab so vielen Tagen im Einsatz wird ein Gerät hervorgehoben (z. B. für Rückholung).
const LONG_USE_DAYS = 28

export default function TrocknungsgeraeteDashboardPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useTrocknung()

  const count = (status) => data.rows.filter((r) => r.status === status).length
  const problem = data.rows.filter((r) => ['defekt', 'verlust', 'reparatur'].includes(r.status))

  const gruppen = useMemo(() => {
    const map = new Map()
    for (const r of data.rows) {
      const key = r.gruppe_name || t('trocknung.ohneGruppe')
      const g = map.get(key) ?? { name: key, gesamt: 0, verfuegbar: 0, verliehen: 0 }
      g.gesamt += 1
      if (r.status === 'verfuegbar') g.verfuegbar += 1
      if (r.status === 'verliehen') g.verliehen += 1
      map.set(key, g)
    }
    return [...map.values()].sort((a, b) => b.gesamt - a.gesamt)
  }, [data.rows, t])

  const imEinsatz = useMemo(() => data.rows.filter((r) => r.einsatz).sort((a, b) => b.einsatz.tage - a.einsatz.tage), [data.rows])
  const wert = imEinsatz.reduce((sum, r) => sum + r.tagespreis_num, 0)

  const chips = [
    { key: 'alle', label: t('common.total'), value: data.rows.length },
    { key: 'verfuegbar', label: t('trocknung.status.verfuegbar'), value: count('verfuegbar') },
    { key: 'verliehen', label: t('trocknung.imEinsatz'), value: count('verliehen'), tone: 'amber' },
    { key: 'problem', label: t('trocknung.defektVerlust'), value: problem.length, tone: 'red' },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
      </div>

      {data.loading ? (
        <p className="field-hint">{t('common.loading')}</p>
      ) : (
        <div className="page-stack">
          <StatChips items={chips} value="" onChange={(key) => navigate('/trocknungsgeraete/auflistung', { state: { chip: key } })} />

          <section className="ls-card">
            <h2 className="section-title">
              <Wind size={18} aria-hidden="true" /> {t('trocknung.nachGruppe')}
            </h2>
            <div className="td-grid">
              {gruppen.map((g) => (
                <div key={g.name} className="td-group-card">
                  <div className="td-group-head">
                    <strong>{g.name}</strong>
                    <span>{g.gesamt}</span>
                  </div>
                  <div className="ls-progress-bar">
                    <div style={{ width: `${g.gesamt ? (g.verfuegbar / g.gesamt) * 100 : 0}%` }} />
                  </div>
                  <div className="cell-person-sub">
                    {t('trocknung.gruppeStatus', { verfuegbar: g.verfuegbar, verliehen: g.verliehen })}
                  </div>
                </div>
              ))}
              {gruppen.length === 0 && <p className="field-hint">{t('trocknung.leer')}</p>}
            </div>
          </section>

          <section className="ls-card">
            <div className="ls-card-head">
              <h2 className="section-title">
                {t('trocknung.aktuellImEinsatz')} <span className="ls-count">{imEinsatz.length}</span>
              </h2>
              {wert > 0 && <span className="field-hint">{t('trocknung.einsatzProTag', { betrag: euro(wert) })}</span>}
            </div>
            {imEinsatz.length === 0 ? (
              <p className="field-hint">{t('trocknung.keinEinsatz')}</p>
            ) : (
              <ul className="ls-result-list">
                {imEinsatz.map((r) => (
                  <li key={r.id} className="ls-result">
                    <EntityCell bucket="public-media" path={null} isPublic name={r.name} size={32} subtitle={<span className="mono-text">{r.barcode}</span>} />
                    <span className="ls-result-main">
                      <Link to={`/lieferscheine/${r.einsatz.ls.id}`} className="link-button">
                        {r.einsatz.ls.nummer_label}
                      </Link>
                      <span className="cell-person-sub">{[r.einsatz.ls.mitarbeiter_name, r.einsatz.ls.adresse].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={r.einsatz.tage > LONG_USE_DAYS ? 'ls-overdue' : ''}>
                      {r.einsatz.tage > LONG_USE_DAYS && <AlertTriangle size={12} aria-hidden="true" />} {t('trocknung.tageImEinsatz', { count: r.einsatz.tage })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {problem.length > 0 && (
            <section className="ls-card">
              <h2 className="section-title">
                {t('trocknung.defektVerlust')} <span className="ls-count">{problem.length}</span>
              </h2>
              <ul className="ls-result-list">
                {problem.map((r) => (
                  <li key={r.id} className="ls-result">
                    <EntityCell bucket="public-media" path={null} isPublic name={r.name} size={32} subtitle={<span className="mono-text">{r.barcode}</span>} />
                    <span className="ls-result-main cell-person-sub">{[r.gruppe_name, r.geraetenummer, r.lager_name].filter(Boolean).join(' · ')}</span>
                    <Badge label={t('trocknung.status.' + r.status)} tone={STATUS_TONE[r.status]} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
