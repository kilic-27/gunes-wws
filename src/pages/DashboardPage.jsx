import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardCheck,
  FileText,
  HardHat,
  Languages,
  PackageOpen,
  TrendingDown,
  TrendingUp,
  Truck,
  Wind,
  Wrench,
} from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Logo from '../components/ui/Logo.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { changeLanguage } from '../i18n/index.js'
import { useLanguageOptions } from '../i18n/useLanguageOptions.js'
import { usePermissions } from '../auth/usePermissions.js'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { OVERDUE_DAYS, formatEuro, formatMenge, nettoMenge, unitOf, useLieferscheinStammdaten } from '../lib/lieferschein.js'

const DAY = 86400000
const dayKey = (value) => {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Kpi({ icon: Icon, label, value, sub, tone, to, state }) {
  const navigate = useNavigate()
  const clickable = Boolean(to)
  return (
    <button
      type="button"
      className={'dash-kpi' + (tone ? ' dash-kpi-' + tone : '') + (clickable ? ' dash-kpi-link' : '')}
      onClick={clickable ? () => navigate(to, { state }) : undefined}
      disabled={!clickable}
    >
      <span className="dash-kpi-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="dash-kpi-body">
        <span className="dash-kpi-value">{value}</span>
        <span className="dash-kpi-label">{label}</span>
        {sub && <span className="dash-kpi-sub">{sub}</span>}
      </span>
    </button>
  )
}

function Card({ title, icon: Icon, count, to, linkLabel, children }) {
  return (
    <section className="ls-card dash-card">
      <div className="ls-card-head">
        <h2 className="section-title">
          {Icon && <Icon size={17} aria-hidden="true" />} {title}
          {count != null && <span className="ls-count">{count}</span>}
        </h2>
        {to && (
          <Link to={to} className="dash-more">
            {linkLabel} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export default function DashboardPage({ title, breadcrumb }) {
  const { t, i18n } = useTranslation()
  const languageOptions = useLanguageOptions()
  const { hasAccess, mitarbeiter: me } = usePermissions()
  const data = useLieferscheinStammdaten()
  const verbrauch = useSupabaseTable('bestand_verbrauch', { orderBy: 'erstellt_am', ascending: false })
  const stuecke = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })

  const canLs = hasAccess('lieferscheine')
  const canBau = hasAccess('baustellen')
  const canArt = hasAccess('artikel')
  const canTd = hasAccess('trocknungsgeraete')

  const loading = data.loading || verbrauch.loading || stuecke.loading

  const stats = useMemo(() => {
    const now = new Date()
    const ls = data.resolved
    const offeneLs = ls.filter((l) => l.status === 'offen')
    const ueberfaellig = offeneLs.filter((l) => l.stueck_offen > 0 && l.alter_tage > OVERDUE_DAYS)
    const unkontrolliert = ls.filter((l) => !l.kontrolliert)
    const offenePos = data.positionen.rows.filter((p) => p.art !== 'verbrauch' && !p.zurueck_am)
    const openStueckIds = new Set(offenePos.map((p) => p.bestand_stueck_id).filter(Boolean))
    const verliehenStuecke = stuecke.rows.filter((s) => s.status === 'verliehen')
    const ohneLieferschein = verliehenStuecke.filter((s) => !openStueckIds.has(s.id)).length
    const geraete = data.geraete.rows
    const geraeteImEinsatz = geraete.filter((g) => g.status === 'verliehen').length
    const geraeteFrei = geraete.filter((g) => g.status === 'verfuegbar').length
    const geraeteProblem = geraete.filter((g) => ['defekt', 'reparatur', 'verlust'].includes(g.status))
    const stueckProblem = stuecke.rows.filter((s) => ['defekt', 'reparatur', 'verlust'].includes(s.status))

    // Verbrauch: knapp / leer
    const summe = new Map()
    for (const v of verbrauch.rows) summe.set(v.artikel_id, (summe.get(v.artikel_id) ?? 0) + Number(v.menge))
    const knapp = data.artikel.rows
      .filter((a) => a.aktiv && a.typ === 'verbrauchsmaterial')
      .map((a) => ({ a, menge: summe.get(a.id) ?? 0, melde: Number(a.meldebestand ?? 0) }))
      .filter((x) => x.menge <= 0 || (x.melde > 0 && x.menge <= x.melde))
      .sort((x, y) => x.menge - y.menge)

    // Lieferscheine pro Tag (letzte 14 Tage)
    const tage = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY)
      tage.push({ key: dayKey(d), label: d.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2), datum: d, anzahl: 0 })
    }
    const tageMap = new Map(tage.map((x) => [x.key, x]))
    for (const l of ls) {
      const e = tageMap.get(dayKey(l.erstellt_am))
      if (e) e.anzahl += 1
    }

    // Kosten dieser / letzter Monat
    const monat = (offset) => {
      const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
      const liste = ls.filter((l) => new Date(l.erstellt_am) >= start && new Date(l.erstellt_am) < end)
      return { anzahl: liste.length, kosten: liste.reduce((s, l) => s + l.summe.gesamt, 0) }
    }
    const dieser = monat(0)
    const letzter = monat(-1)

    // Top-Verbrauch der letzten 30 Tage
    const grenze = now.getTime() - 30 * DAY
    const verbrauchMap = new Map()
    for (const p of data.positionen.rows) {
      if (p.art !== 'verbrauch' || new Date(p.erstellt_am).getTime() < grenze) continue
      const e = verbrauchMap.get(p.artikel_id) ?? { menge: 0, kosten: 0 }
      e.menge += nettoMenge(p)
      e.kosten += nettoMenge(p) * Number(p.einzelpreis)
      verbrauchMap.set(p.artikel_id, e)
    }
    const topVerbrauch = [...verbrauchMap.entries()]
      .map(([id, e]) => ({ a: data.maps.artikel.get(id), ...e }))
      .filter((x) => x.a)
      .sort((x, y) => y.kosten - x.kosten)
      .slice(0, 5)

    // Wer hat die meisten Stücke draußen?
    const proMa = new Map()
    for (const l of offeneLs) {
      if (l.stueck_offen > 0) proMa.set(l.mitarbeiter_id, { name: l.mitarbeiter_name, foto: l.mitarbeiter_foto, n: (proMa.get(l.mitarbeiter_id)?.n ?? 0) + l.stueck_offen })
    }
    const topMitarbeiter = [...proMa.values()].sort((a, b) => b.n - a.n).slice(0, 5)

    // Aktive Baustellen mit offenen Lieferscheinen
    const baustellen = data.baustellen.rows
      .filter((b) => b.status !== 'abgeschlossen')
      .map((b) => {
        const ort = data.maps.ort.get(b.ort_id)
        const ag = data.maps.auftraggeber.get(b.auftraggeber_id)
        const lsB = offeneLs.filter((l) => l.baustelle_id === b.id)
        return {
          b,
          adresse: [ort?.strasse, [ort?.plz, ort?.name].filter(Boolean).join(' ')].filter(Boolean).join(', ') || b.projekt_nr || '–',
          ag,
          offeneLs: lsB.length,
          draussen: lsB.reduce((s, l) => s + l.stueck_offen, 0),
          kosten: ls.filter((l) => l.baustelle_id === b.id).reduce((s, l) => s + l.summe.gesamt, 0),
        }
      })
      .sort((x, y) => y.offeneLs - x.offeneLs || y.kosten - x.kosten)

    return {
      ls, offeneLs, ueberfaellig, unkontrolliert, offenePos, ohneLieferschein, verliehenStuecke: verliehenStuecke.length,
      geraete, geraeteImEinsatz, geraeteFrei, geraeteProblem, stueckProblem, knapp, tage, dieser, letzter, topVerbrauch,
      topMitarbeiter, baustellen,
    }
  }, [data.resolved, data.positionen.rows, data.geraete.rows, data.artikel.rows, data.baustellen.rows, data.maps, verbrauch.rows, stuecke.rows])

  const hour = new Date().getHours()
  const gruss = hour < 11 ? t('dashboard.morgen') : hour < 18 ? t('dashboard.tag') : t('dashboard.abend')
  const maxTag = Math.max(1, ...stats.tage.map((x) => x.anzahl))
  const kostenTrend = stats.letzter.kosten > 0 ? ((stats.dieser.kosten - stats.letzter.kosten) / stats.letzter.kosten) * 100 : null
  const problemAnzahl = stats.geraeteProblem.length + stats.stueckProblem.length
  const draussen = stats.verliehenStuecke + stats.geraeteImEinsatz

  // Handlungsbedarf: was heute wichtig ist
  const aufgaben = []
  if (canLs) {
    for (const l of stats.ueberfaellig.slice(0, 4)) {
      aufgaben.push({ key: 'u' + l.id, tone: 'red', text: t('dashboard.aufgabe.ueberfaellig', { nr: l.nummer_label, name: l.mitarbeiter_name, tage: l.alter_tage, stuecke: l.stueck_offen }), to: `/lieferscheine/${l.id}` })
    }
    const abgeschlossenUnkontrolliert = stats.unkontrolliert.filter((l) => l.status === 'abgeschlossen')
    if (abgeschlossenUnkontrolliert.length)
      aufgaben.push({ key: 'k', tone: 'amber', text: t('dashboard.aufgabe.unkontrolliert', { count: abgeschlossenUnkontrolliert.length }), to: '/lieferscheine/uebersicht', state: { chip: 'unkontrolliert' } })
  }
  if (canArt && stats.knapp.length) aufgaben.push({ key: 'b', tone: 'amber', text: t('dashboard.aufgabe.knapp', { count: stats.knapp.length, name: stats.knapp[0].a.name }), to: '/artikel/bestand' })
  if (problemAnzahl) aufgaben.push({ key: 'd', tone: 'red', text: t('dashboard.aufgabe.defekt', { count: problemAnzahl }), to: '/artikel/reparaturuebersicht' })
  if (canArt && stats.ohneLieferschein > 0)
    aufgaben.push({ key: 'o', tone: 'blue', text: t('dashboard.aufgabe.ohneLieferschein', { count: stats.ohneLieferschein }), to: '/artikel/bestand' })

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="dashboard-hero">
        <div className="dashboard-hero-main">
          <Logo variant="dashboard" />
          <div>
            <h1 className="page-title dashboard-hero-title">{title}</h1>
            <p className="dash-greeting">
              {gruss}
              {me?.vorname ? `, ${me.vorname}` : ''} · {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {languageOptions.length > 0 && (
          <div className="dashboard-language-switcher">
            <Languages size={16} aria-hidden="true" />
            <select value={i18n.language} onChange={(event) => changeLanguage(event.target.value)} aria-label={t('header.language')}>
              {languageOptions.map((sprache) => (
                <option key={sprache.id} value={sprache.code}>
                  {sprache.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="field-hint">{t('common.loading')}</p>
      ) : (
        <div className="page-stack">
          <div className="dash-kpis">
            {canBau && <Kpi icon={HardHat} label={t('dashboard.kpi.baustellen')} value={stats.baustellen.length} sub={t('dashboard.kpi.baustellenSub', { count: data.baustellen.rows.length })} to="/baustellen" />}
            {canLs && <Kpi icon={FileText} label={t('dashboard.kpi.lieferscheine')} value={stats.offeneLs.length} sub={t('dashboard.kpi.lieferscheineSub', { count: stats.ls.length })} to="/lieferscheine/uebersicht" state={{ chip: 'offen' }} />}
            {(canArt || canTd) && <Kpi icon={Truck} label={t('dashboard.kpi.draussen')} value={draussen} sub={t('dashboard.kpi.draussenSub', { stuecke: stats.verliehenStuecke, geraete: stats.geraeteImEinsatz })} tone={draussen > 0 ? 'amber' : undefined} to="/artikel/bestand" />}
            {canLs && <Kpi icon={AlertTriangle} label={t('dashboard.kpi.ueberfaellig', { days: OVERDUE_DAYS })} value={stats.ueberfaellig.length} tone={stats.ueberfaellig.length ? 'red' : 'green'} to="/lieferscheine/uebersicht" state={{ chip: 'ueberfaellig' }} />}
            {canLs && <Kpi icon={ClipboardCheck} label={t('dashboard.kpi.unkontrolliert')} value={stats.unkontrolliert.length} tone={stats.unkontrolliert.length ? 'amber' : 'green'} to="/lieferscheine/uebersicht" state={{ chip: 'unkontrolliert' }} />}
            {canTd && <Kpi icon={Wind} label={t('dashboard.kpi.trocknung')} value={`${stats.geraeteImEinsatz}/${stats.geraete.length}`} sub={t('dashboard.kpi.trocknungSub', { count: stats.geraeteFrei })} to="/trocknungsgeraete/dashboard" />}
            {canArt && <Kpi icon={Boxes} label={t('dashboard.kpi.knapp')} value={stats.knapp.length} tone={stats.knapp.length ? 'amber' : 'green'} to="/artikel/bestand" />}
            {(canArt || canTd) && <Kpi icon={Wrench} label={t('dashboard.kpi.defekt')} value={problemAnzahl} tone={problemAnzahl ? 'red' : 'green'} to="/artikel/reparaturuebersicht" />}
          </div>

          <div className="dash-columns">
            <div className="dash-col">
              <Card title={t('dashboard.handlungsbedarf')} icon={AlertTriangle} count={aufgaben.length || null}>
                {aufgaben.length === 0 ? (
                  <p className="field-hint">{t('dashboard.allesGut')}</p>
                ) : (
                  <ul className="dash-tasks">
                    {aufgaben.map((a) => (
                      <li key={a.key}>
                        <Link to={a.to} state={a.state} className={'dash-task dash-task-' + a.tone}>
                          <span className="dash-task-dot" />
                          <span>{a.text}</span>
                          <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {canBau && (
                <Card title={t('dashboard.aktiveBaustellen')} icon={HardHat} count={stats.baustellen.length} to="/baustellen" linkLabel={t('dashboard.alle')}>
                  {stats.baustellen.length === 0 ? (
                    <p className="field-hint">{t('dashboard.keineBaustellen')}</p>
                  ) : (
                    <ul className="ls-result-list">
                      {stats.baustellen.slice(0, 6).map(({ b, adresse, ag, offeneLs, draussen: dr, kosten }) => (
                        <li key={b.id} className="ls-result">
                          <EntityCell bucket="public-media" path={ag?.logo_url} isPublic name={adresse} subtitle={[ag?.name, b.projekt_nr && `Proj. ${b.projekt_nr}`].filter(Boolean).join(' · ')} size={34} />
                          <span className="ls-result-main" />
                          <span className="dash-numbers">
                            <span title={t('dashboard.offeneLieferscheine')}>
                              <FileText size={13} /> {offeneLs}
                            </span>
                            {dr > 0 && (
                              <span title={t('dashboard.stueckeDraussen')}>
                                <Truck size={13} /> {dr}
                              </span>
                            )}
                            <strong>{formatEuro(kosten)}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {canLs && (
                <Card title={t('dashboard.neuesteLieferscheine')} icon={FileText} to="/lieferscheine/uebersicht" linkLabel={t('dashboard.alle')}>
                  {stats.ls.length === 0 ? (
                    <p className="field-hint">{t('dashboard.keineLieferscheine')}</p>
                  ) : (
                    <ul className="ls-result-list">
                      {stats.ls.slice(0, 6).map((l) => (
                        <li key={l.id}>
                          <Link to={`/lieferscheine/${l.id}`} className="ls-result">
                            <span className="mono-text ls-nr">{l.nummer_label}</span>
                            <span className="ls-result-main">
                              <strong>{l.adresse || '–'}</strong>
                              <span className="cell-person-sub">{[l.mitarbeiter_name, new Date(l.erstellt_am).toLocaleDateString('de-DE')].filter(Boolean).join(' · ')}</span>
                            </span>
                            <span>{formatEuro(l.summe.gesamt)}</span>
                            <Badge label={t('lieferschein.status.' + l.status)} tone={l.status === 'offen' ? 'amber' : 'green'} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </div>

            <div className="dash-col">
              {canLs && (
                <Card title={t('dashboard.aktivitaet')} icon={TrendingUp}>
                  <div className="dash-bars" role="img" aria-label={t('dashboard.aktivitaetAria')}>
                    {stats.tage.map((x) => (
                      <div key={x.key} className="dash-bar-col" title={`${x.datum.toLocaleDateString('de-DE')}: ${x.anzahl}`}>
                        <span className="dash-bar-value">{x.anzahl || ''}</span>
                        <span className="dash-bar" style={{ height: `${(x.anzahl / maxTag) * 100}%` }} />
                        <span className="dash-bar-label">{x.label}</span>
                      </div>
                    ))}
                  </div>
                  <dl className="ls-totals">
                    <div>
                      <dt>{t('dashboard.dieserMonat')}</dt>
                      <dd>
                        {t('dashboard.lsKosten', { count: stats.dieser.anzahl, kosten: formatEuro(stats.dieser.kosten) })}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('dashboard.letzterMonat')}</dt>
                      <dd>
                        {t('dashboard.lsKosten', { count: stats.letzter.anzahl, kosten: formatEuro(stats.letzter.kosten) })}
                      </dd>
                    </div>
                    {kostenTrend != null && (
                      <div>
                        <dt>{t('dashboard.entwicklung')}</dt>
                        <dd className={kostenTrend > 0 ? 'dash-trend-up' : 'dash-trend-down'}>
                          {kostenTrend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {kostenTrend > 0 ? '+' : ''}
                          {kostenTrend.toFixed(0)} %
                        </dd>
                      </div>
                    )}
                  </dl>
                </Card>
              )}

              {canTd && stats.geraete.length > 0 && (
                <Card title={t('dashboard.trocknung')} icon={Wind} to="/trocknungsgeraete/dashboard" linkLabel={t('dashboard.alle')}>
                  <div className="dash-stack-bar" aria-hidden="true">
                    <span className="dash-stack-frei" style={{ flex: stats.geraeteFrei }} />
                    <span className="dash-stack-einsatz" style={{ flex: stats.geraeteImEinsatz }} />
                    <span className="dash-stack-problem" style={{ flex: stats.geraeteProblem.length }} />
                  </div>
                  <div className="dash-legend">
                    <span>
                      <i className="dash-dot dash-stack-frei" /> {t('trocknung.status.verfuegbar')} {stats.geraeteFrei}
                    </span>
                    <span>
                      <i className="dash-dot dash-stack-einsatz" /> {t('trocknung.imEinsatz')} {stats.geraeteImEinsatz}
                    </span>
                    <span>
                      <i className="dash-dot dash-stack-problem" /> {t('trocknung.defektVerlust')} {stats.geraeteProblem.length}
                    </span>
                  </div>
                </Card>
              )}

              {canArt && stats.knapp.length > 0 && (
                <Card title={t('dashboard.bestandWarnung')} icon={PackageOpen} count={stats.knapp.length} to="/artikel/bestand" linkLabel={t('dashboard.alle')}>
                  <ul className="ls-result-list">
                    {stats.knapp.slice(0, 6).map(({ a, menge, melde }) => (
                      <li key={a.id} className="ls-result">
                        <span className="ls-result-main">
                          <strong>{a.name}</strong>
                          {melde > 0 && <span className="cell-person-sub">{t('dashboard.meldebestand', { menge: formatMenge(melde), unit: unitOf(a) })}</span>}
                        </span>
                        <Badge label={`${formatMenge(menge)} ${unitOf(a)}`} tone={menge <= 0 ? 'red' : 'amber'} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {canLs && stats.topVerbrauch.length > 0 && (
                <Card title={t('dashboard.topVerbrauch')} icon={Boxes}>
                  <ul className="ls-result-list">
                    {stats.topVerbrauch.map(({ a, menge, kosten }) => (
                      <li key={a.id} className="ls-result">
                        <span className="ls-result-main">
                          <strong>{a.name}</strong>
                          <span className="cell-person-sub">
                            {formatMenge(menge)} {unitOf(a)}
                          </span>
                        </span>
                        <strong>{formatEuro(kosten)}</strong>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {canLs && stats.topMitarbeiter.length > 0 && (
                <Card title={t('dashboard.wemHatWas')} icon={Truck}>
                  <ul className="ls-result-list">
                    {stats.topMitarbeiter.map((m) => (
                      <li key={m.name} className="ls-result">
                        <EntityCell bucket="mitarbeiter-fotos" path={m.foto} isPublic={false} name={m.name} size={32} />
                        <span className="ls-result-main" />
                        <Badge label={t('dashboard.stueckAnzahl', { count: m.n })} tone="amber" />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
