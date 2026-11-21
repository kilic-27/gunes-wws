import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, X, FileText, HardHat, User, Building2, Package, Wind, PanelLeft } from 'lucide-react'
import { navGroups } from '../../nav/navConfig.js'
import { usePermissions } from '../../auth/usePermissions.js'
import { useSupabaseTable } from '../../lib/useSupabaseTable.js'
import { formatDateTimeDE } from '../../lib/date.js'
import { personName, useLieferscheinStammdaten } from '../../lib/lieferschein.js'
import { basisName } from '../../lib/katalogGruppen.js'

const PRO_GRUPPE = 5

// Alle Textwerte einer Zeile (ohne IDs) zu einem Suchtext zusammenfassen; wird je Zeile nur einmal berechnet.
const cache = new WeakMap()
function suchtext(row, extra = []) {
  let text = cache.get(row)
  if (text === undefined) {
    text = Object.entries(row)
      .filter(([key, value]) => (typeof value === 'string' || typeof value === 'number') && key !== 'id' && !key.endsWith('_id') && !key.endsWith('_url'))
      .map(([, value]) => String(value))
      .join(' ')
      .toLowerCase()
    cache.set(row, text)
  }
  return extra.length ? `${text} ${extra.filter(Boolean).join(' ').toLowerCase()}` : text
}

const trefferFuer = (text, woerter) => woerter.every((w) => text.includes(w))

function Gruppe({ icon, titel, treffer, children, onPick }) {
  const { t } = useTranslation()
  if (treffer.length === 0) return null
  return (
    <section className="gs-group">
      <h3 className="gs-group-title">
        {icon}
        {titel} <span className="ls-count">{treffer.length}</span>
      </h3>
      <ul>
        {treffer.slice(0, PRO_GRUPPE).map((eintrag) => (
          <li key={eintrag.key}>
            <Link to={eintrag.to} className="gs-item" onClick={onPick}>
              <span className="gs-item-main">{eintrag.haupt}</span>
              <span className="gs-item-sub">{eintrag.neben}</span>
            </Link>
          </li>
        ))}
      </ul>
      {treffer.length > PRO_GRUPPE && <p className="gs-more">{t('suche.weitere', { count: treffer.length - PRO_GRUPPE })}</p>}
      {children}
    </section>
  )
}

/** Lädt erst, wenn die Suche zum ersten Mal benutzt wird (sonst würde jede Seite alle Tabellen laden). */
function Ergebnisse({ term, onPick }) {
  const { t } = useTranslation()
  const { hasAccess } = usePermissions()
  const data = useLieferscheinStammdaten()
  const stueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const woerter = useMemo(() => term.toLowerCase().split(/\s+/).filter(Boolean), [term])
  const aktiv = term.trim().length >= 2
  const loading = data.loading || stueckTable.loading

  const lsById = useMemo(() => new Map(data.resolved.map((ls) => [ls.id, ls])), [data.resolved])
  const offenePositionen = useMemo(() => {
    const stueck = new Map()
    const geraet = new Map()
    for (const p of data.positionen.rows) {
      if (p.zurueck_am) continue
      if (p.bestand_stueck_id) stueck.set(p.bestand_stueck_id, p.lieferschein_id)
      if (p.trocknungsgeraet_id) geraet.set(p.trocknungsgeraet_id, p.lieferschein_id)
    }
    return { stueck, geraet }
  }, [data.positionen.rows])

  const ergebnis = useMemo(() => {
    if (!aktiv) return null
    const { maps } = data

    const lieferscheine = data.resolved
      .filter((ls) => trefferFuer(suchtext(ls, [ls.nummer_label, ls.adresse, ls.auftraggeber_name, ls.mitarbeiter_name, ls.firma_name, ls.baustelle?.projekt_nr, ls.baustelle?.bemerkung]), woerter))
      .map((ls) => ({
        key: ls.id,
        to: `/lieferscheine/${ls.id}`,
        haupt: (
          <>
            <span className="mono-text">{ls.nummer_label}</span> {ls.adresse || '–'}
          </>
        ),
        neben: [ls.baustelle?.projekt_nr, ls.auftraggeber_name, ls.mitarbeiter_name, formatDateTimeDE(ls.erstellt_am)].filter(Boolean).join(' · '),
      }))

    const lsAnzahl = new Map()
    for (const ls of data.resolved) lsAnzahl.set(ls.baustelle_id, (lsAnzahl.get(ls.baustelle_id) ?? 0) + 1)

    const baustellen = data.baustellen.rows
      .map((b) => {
        const ort = maps.ort.get(b.ort_id)
        const ag = maps.auftraggeber.get(b.auftraggeber_id)
        const adresse = [ort?.strasse, [ort?.plz, ort?.name].filter(Boolean).join(' ')].filter(Boolean).join(', ')
        return { b, adresse, ag }
      })
      .filter(({ b, adresse, ag }) => trefferFuer(suchtext(b, [adresse, ag?.name]), woerter))
      .map(({ b, adresse, ag }) => ({
        key: b.id,
        to: `/baustellen?id=${b.id}`,
        haupt: (
          <>
            {b.projekt_nr && <span className="mono-text">{b.projekt_nr}</span>} {adresse || '–'}
          </>
        ),
        neben: [ag?.name, t('suche.lieferscheineAnzahl', { count: lsAnzahl.get(b.id) ?? 0 })].filter(Boolean).join(' · '),
      }))

    const mitarbeiter = data.mitarbeiter.rows
      .filter((m) => trefferFuer(suchtext(m, [personName(m)]), woerter))
      .map((m) => ({ key: m.id, to: '/benutzer/mitarbeiter', haupt: personName(m), neben: [m.email, m.telefon].filter(Boolean).join(' · ') }))

    const auftraggeber = data.auftraggeber.rows
      .filter((a) => trefferFuer(suchtext(a), woerter))
      .map((a) => ({ key: a.id, to: '/kunden/auftraggeber', haupt: a.name, neben: [a.email, a.telefon].filter(Boolean).join(' · ') }))

    // Wie im Katalog: gleiche Geräte (ohne Gerätenummer "G 45") nur einmal zeigen.
    const artikelGruppen = new Map()
    for (const a of data.artikel.rows) {
      if (!trefferFuer(suchtext(a), woerter)) continue
      const key = `${a.typ}|${basisName(a.name).toLowerCase()}`
      const g = artikelGruppen.get(key)
      if (g) g.anzahl += 1
      else artikelGruppen.set(key, { a, anzahl: 1 })
    }
    const artikel = [...artikelGruppen.entries()].map(([key, { a, anzahl }]) => ({
      key,
      to: '/artikel/katalog',
      haupt: basisName(a.name),
      neben: [t(a.typ === 'verbrauchsmaterial' ? 'katalog.typVerbrauchsmaterial' : 'katalog.typWerkzeug'), anzahl > 1 ? t('katalog.artikelAnzahl', { count: anzahl }) : a.barcode].filter(Boolean).join(' · '),
    }))

    const stuecke = stueckTable.rows
      .map((s) => ({ s, a: maps.artikel.get(s.artikel_id) }))
      .filter(({ s, a }) => trefferFuer(suchtext(s, [a?.name]), woerter))
      .map(({ s, a }) => {
        const ls = lsById.get(offenePositionen.stueck.get(s.id))
        return {
          key: s.id,
          to: ls ? `/lieferscheine/${ls.id}` : '/artikel/bestand',
          haupt: (
            <>
              {a?.name ?? '–'} <span className="mono-text">{s.barcode}</span>
            </>
          ),
          neben: ls ? [ls.nummer_label, ls.adresse, ls.mitarbeiter_name].filter(Boolean).join(' · ') : t('suche.imLager'),
        }
      })

    const geraete = data.geraete.rows
      .filter((g) => trefferFuer(suchtext(g), woerter))
      .map((g) => {
        const ls = lsById.get(offenePositionen.geraet.get(g.id))
        return {
          key: g.id,
          to: ls ? `/lieferscheine/${ls.id}` : '/trocknungsgeraete/auflistung',
          haupt: (
            <>
              {g.name} <span className="mono-text">{g.barcode}</span>
            </>
          ),
          neben: ls ? [ls.nummer_label, ls.adresse, ls.mitarbeiter_name].filter(Boolean).join(' · ') : t('suche.imLager'),
        }
      })

    const seiten = []
    for (const group of navGroups) {
      for (const item of group.items) {
        if (!hasAccess(item.bereich)) continue
        const eintraege = item.children ?? [item]
        for (const e of eintraege) {
          const label = t(e.labelKey)
          const text = `${label} ${t(item.labelKey)}`.toLowerCase()
          if (trefferFuer(text, woerter)) seiten.push({ key: e.path, to: e.path, haupt: label, neben: item.children ? t(item.labelKey) : '' })
        }
      }
    }

    return { lieferscheine, baustellen, mitarbeiter, auftraggeber, artikel, stuecke, geraete, seiten }
  }, [aktiv, woerter, data, stueckTable.rows, lsById, offenePositionen, hasAccess, t])

  if (!aktiv) return <p className="gs-hint">{t('suche.hinweis')}</p>
  if (!ergebnis) return null
  const summe = Object.values(ergebnis).reduce((s, l) => s + l.length, 0)

  return (
    <>
      {loading && <p className="gs-hint">{t('common.loading')}</p>}
      {!loading && summe === 0 && <p className="gs-hint">{t('suche.keineTreffer')}</p>}
      <Gruppe icon={<FileText size={14} />} titel={t('suche.lieferscheine')} treffer={ergebnis.lieferscheine} onPick={onPick} />
      <Gruppe icon={<HardHat size={14} />} titel={t('suche.baustellen')} treffer={ergebnis.baustellen} onPick={onPick} />
      <Gruppe icon={<User size={14} />} titel={t('suche.mitarbeiter')} treffer={ergebnis.mitarbeiter} onPick={onPick} />
      <Gruppe icon={<Building2 size={14} />} titel={t('suche.auftraggeber')} treffer={ergebnis.auftraggeber} onPick={onPick} />
      <Gruppe icon={<Package size={14} />} titel={t('suche.stuecke')} treffer={ergebnis.stuecke} onPick={onPick} />
      <Gruppe icon={<Wind size={14} />} titel={t('suche.geraete')} treffer={ergebnis.geraete} onPick={onPick} />
      <Gruppe icon={<Package size={14} />} titel={t('suche.artikel')} treffer={ergebnis.artikel} onPick={onPick} />
      <Gruppe icon={<PanelLeft size={14} />} titel={t('suche.seiten')} treffer={ergebnis.seiten} onPick={onPick} />
    </>
  )
}

export default function GlobalSearch() {
  const { t } = useTranslation()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [geladen, setGeladen] = useState(false)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const wrapRef = useRef(null)
  const verzoegert = useDeferredValue(term)

  function schliessen() {
    setOpen(false)
    setTerm('')
  }

  function oeffnen() {
    setGeladen(true)
    setOpen(true)
  }

  // Strg+K / Cmd+K springt in die Suche.
  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        oeffnen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Klick außerhalb schließt das Ergebnisfenster.
  useEffect(() => {
    if (!open) return undefined
    function onDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function links() {
    return [...(panelRef.current?.querySelectorAll('a.gs-item') ?? [])]
  }

  function onInputKey(event) {
    if (event.key === 'Escape') {
      schliessen()
      inputRef.current?.blur()
    } else if (event.key === 'Enter') {
      links()[0]?.click()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      links()[0]?.focus()
    }
  }

  function onPanelKey(event) {
    const alle = links()
    const index = alle.indexOf(document.activeElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      alle[Math.min(index + 1, alle.length - 1)]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (index <= 0) inputRef.current?.focus()
      else alle[index - 1]?.focus()
    } else if (event.key === 'Escape') {
      schliessen()
      inputRef.current?.focus()
    }
  }

  return (
    <div className="global-search" ref={wrapRef}>
      <div className="global-search-box">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value)
            oeffnen()
          }}
          onFocus={oeffnen}
          onKeyDown={onInputKey}
          placeholder={t('suche.placeholder')}
          aria-label={t('suche.placeholder')}
          autoComplete="off"
        />
        {term && (
          <button type="button" className="gs-clear" aria-label={t('suche.leeren')} onClick={() => { setTerm(''); inputRef.current?.focus() }}>
            <X size={14} />
          </button>
        )}
      </div>
      {geladen && (
        <div className="global-search-panel" ref={panelRef} onKeyDown={onPanelKey} hidden={!open}>
          <Ergebnisse term={verzoegert} onPick={schliessen} />
        </div>
      )}
    </div>
  )
}
