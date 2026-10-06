import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { formatDateTimeDE } from '../lib/date.js'
import { formatEuro, formatMenge, unitOf, useLieferscheinStammdaten } from '../lib/lieferschein.js'

const LIMIT = 25

const statusTone = { verfuegbar: 'green', verliehen: 'amber', defekt: 'red', verlust: 'red', entsorgt: 'gray', reparatur: 'blue' }

export default function LieferscheinSuchePage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const data = useLieferscheinStammdaten()
  const stueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const [term, setTerm] = useState('')
  const needle = term.trim().toLowerCase()

  const lsById = useMemo(() => new Map(data.resolved.map((ls) => [ls.id, ls])), [data.resolved])

  const lieferscheine = useMemo(() => {
    if (!needle) return []
    return data.resolved.filter((ls) =>
      [ls.nummer_label, String(ls.nr ?? ''), ls.projektnummer, ls.adresse, ls.auftraggeber_name, ls.mitarbeiter_name, ls.firma_name].some(
        (value) => value && String(value).toLowerCase().includes(needle),
      ),
    )
  }, [data.resolved, needle])

  const stuecke = useMemo(() => {
    if (needle.length < 2) return []
    return stueckTable.rows
      .map((s) => ({ stueck: s, artikel: data.maps.artikel.get(s.artikel_id) }))
      .filter(({ stueck, artikel }) => (stueck.barcode ?? '').toLowerCase().includes(needle) || (artikel?.name ?? '').toLowerCase().includes(needle))
      .map(({ stueck, artikel }) => {
        const position = data.positionen.rows.find((p) => p.bestand_stueck_id === stueck.id && !p.zurueck_am)
        return { stueck, artikel, ls: position ? lsById.get(position.lieferschein_id) : null }
      })
      .sort((x, y) => Number((y.stueck.barcode ?? '').toLowerCase() === needle) - Number((x.stueck.barcode ?? '').toLowerCase() === needle))
  }, [stueckTable.rows, data.maps.artikel, data.positionen.rows, lsById, needle])

  const geraeteTreffer = useMemo(() => {
    if (needle.length < 2) return []
    return data.geraete.rows
      .filter((g) => (g.barcode ?? '').toLowerCase().includes(needle) || g.name.toLowerCase().includes(needle) || (g.geraetenummer ?? '').toLowerCase().includes(needle) || (g.seriennummer ?? '').toLowerCase().includes(needle))
      .map((g) => {
        const position = data.positionen.rows.find((p) => p.trocknungsgeraet_id === g.id && !p.zurueck_am)
        return { geraet: g, ls: position ? lsById.get(position.lieferschein_id) : null }
      })
      .sort((x, y) => Number((y.geraet.barcode ?? '').toLowerCase() === needle) - Number((x.geraet.barcode ?? '').toLowerCase() === needle))
  }, [data.geraete.rows, data.positionen.rows, lsById, needle])

  const artikelTreffer = useMemo(() => {
    if (needle.length < 2) return []
    const map = new Map()
    for (const p of data.positionen.rows) {
      const artikel = data.maps.artikel.get(p.artikel_id)
      if (!artikel?.name.toLowerCase().includes(needle)) continue
      const entry = map.get(p.lieferschein_id) ?? { ls: lsById.get(p.lieferschein_id), items: new Map() }
      const key = artikel.id
      const prev = entry.items.get(key) ?? { artikel, menge: 0 }
      prev.menge += Number(p.menge)
      entry.items.set(key, prev)
      map.set(p.lieferschein_id, entry)
    }
    return [...map.values()].filter((e) => e.ls)
  }, [data.positionen.rows, data.maps.artikel, lsById, needle])

  const loading = data.loading || stueckTable.loading

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
      </div>

      <div className="ls-search-box">
        <Search size={20} aria-hidden="true" />
        <input
          autoFocus
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t('lieferschein.suche.placeholder')}
          aria-label={t('lieferschein.suche.placeholder')}
        />
      </div>

      {!needle && <p className="field-hint">{t('lieferschein.suche.hinweis')}</p>}
      {needle && loading && <p className="field-hint">{t('common.loading')}</p>}
      {needle && !loading && lieferscheine.length === 0 && stuecke.length === 0 && geraeteTreffer.length === 0 && artikelTreffer.length === 0 && (
        <p className="field-hint">{t('common.noMatch')}</p>
      )}

      {lieferscheine.length > 0 && (
        <section className="ls-card">
          <h2 className="section-title">
            {t('lieferschein.suche.lieferscheine')} <span className="ls-count">{lieferscheine.length}</span>
          </h2>
          <ul className="ls-result-list">
            {lieferscheine.slice(0, LIMIT).map((ls) => (
              <li key={ls.id}>
                <Link to={`/lieferscheine/${ls.id}`} className="ls-result">
                  <span className="mono-text ls-nr">{ls.nummer_label}</span>
                  <span className="ls-result-main">
                    <strong>{ls.adresse || '–'}</strong>
                    <span className="cell-person-sub">
                      {[ls.auftraggeber_name, ls.mitarbeiter_name, formatDateTimeDE(ls.erstellt_am)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span>{formatEuro(ls.gesamtkosten)}</span>
                  <Badge label={t('lieferschein.status.' + ls.status)} tone={ls.status === 'offen' ? 'amber' : 'green'} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stuecke.length > 0 && (
        <section className="ls-card">
          <h2 className="section-title">
            {t('lieferschein.suche.stuecke')} <span className="ls-count">{stuecke.length}</span>
          </h2>
          <ul className="ls-result-list">
            {stuecke.slice(0, LIMIT).map(({ stueck, artikel, ls }) => (
              <li key={stueck.id} className="ls-result">
                <EntityCell bucket="public-media" path={artikel?.foto_url} isPublic name={artikel?.name ?? '–'} size={32} subtitle={<span className="mono-text">{stueck.barcode}</span>} />
                <span className="ls-result-main">
                  {ls ? (
                    <>
                      <Link to={`/lieferscheine/${ls.id}`} className="link-button">
                        {ls.nummer_label}
                      </Link>
                      <span className="cell-person-sub">{[ls.mitarbeiter_name, ls.adresse].filter(Boolean).join(' · ')}</span>
                    </>
                  ) : (
                    <span className="cell-person-sub">{t('lieferschein.suche.imLager')}</span>
                  )}
                </span>
                <Badge label={t('bestand.status' + stueck.status.charAt(0).toUpperCase() + stueck.status.slice(1))} tone={statusTone[stueck.status] ?? 'gray'} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {geraeteTreffer.length > 0 && (
        <section className="ls-card">
          <h2 className="section-title">
            {t('nav.trocknungsgeraete')} <span className="ls-count">{geraeteTreffer.length}</span>
          </h2>
          <ul className="ls-result-list">
            {geraeteTreffer.slice(0, LIMIT).map(({ geraet, ls }) => (
              <li key={geraet.id} className="ls-result">
                <EntityCell bucket="public-media" path={null} isPublic name={geraet.name} size={32} subtitle={<span className="mono-text">{geraet.barcode}</span>} />
                <span className="ls-result-main">
                  {ls ? (
                    <>
                      <Link to={`/lieferscheine/${ls.id}`} className="link-button">
                        {ls.nummer_label}
                      </Link>
                      <span className="cell-person-sub">{[ls.mitarbeiter_name, ls.adresse].filter(Boolean).join(' · ')}</span>
                    </>
                  ) : (
                    <span className="cell-person-sub">{t('lieferschein.suche.imLager')}</span>
                  )}
                </span>
                <Badge label={t('trocknung.status.' + geraet.status)} tone={statusTone[geraet.status] ?? 'gray'} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {artikelTreffer.length > 0 && (
        <section className="ls-card">
          <h2 className="section-title">
            {t('lieferschein.suche.artikelIn')} <span className="ls-count">{artikelTreffer.length}</span>
          </h2>
          <ul className="ls-result-list">
            {artikelTreffer.slice(0, LIMIT).map(({ ls, items }) => (
              <li key={ls.id}>
                <Link to={`/lieferscheine/${ls.id}`} className="ls-result">
                  <span className="mono-text ls-nr">{ls.nummer_label}</span>
                  <span className="ls-result-main">
                    <strong>{[...items.values()].map(({ artikel, menge }) => `${formatMenge(menge)} ${unitOf(artikel)} ${artikel.name}`).join(', ')}</strong>
                    <span className="cell-person-sub">{[ls.adresse, ls.mitarbeiter_name].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Badge label={t('lieferschein.status.' + ls.status)} tone={ls.status === 'offen' ? 'amber' : 'green'} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
