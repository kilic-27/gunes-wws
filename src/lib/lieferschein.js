import { useMemo } from 'react'
import { useSupabaseTable } from './useSupabaseTable.js'

const euroFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export const formatEuro = (value) => euroFormatter.format(Number(value) || 0)

export function formatMenge(value) {
  return Number(value).toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

export const lsNummer = (ls) => (ls?.nr ? `LF-${ls.nr}` : ls?.nummer || '–')

export const personName = (m) => (m ? `${m.vorname ?? ''} ${m.nachname ?? ''}`.trim() || m.username || '–' : '–')

export const unitOf = (artikel) => artikel?.vpe || 'Stück'

// Ab so vielen Tagen gilt ein offener Lieferschein als "überfällig".
export const OVERDUE_DAYS = 14

// Angefangene Kalendertage, die ein Stück ausgegeben war (mindestens 1).
export function leihTage(position, now = new Date()) {
  const start = new Date(position.erstellt_am)
  const end = position.zurueck_am ? new Date(position.zurueck_am) : now
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.max(1, Math.round((endDay - startDay) / 86400000) + 1)
}

export function ageInDays(iso, now = new Date()) {
  if (!iso) return 0
  return Math.floor((now - new Date(iso)) / 86400000)
}

/** Kosten und Zähler eines Lieferscheins aus seinen Positionen. */
export function summarize(positions) {
  let verbrauch = 0
  let leih = 0
  let proTag = 0
  let stueckOffen = 0
  let stueckZurueck = 0
  let stueckGesamt = 0
  const mengen = new Map()
  for (const p of positions) {
    if (p.art === 'verbrauch') {
      verbrauch += Number(p.menge) * Number(p.einzelpreis)
    } else {
      stueckGesamt += 1
      leih += Number(p.tagespreis) * leihTage(p)
      if (p.zurueck_am) {
        stueckZurueck += 1
      } else {
        stueckOffen += 1
        proTag += Number(p.tagespreis)
      }
    }
  }
  return { verbrauch, leih, proTag, gesamt: verbrauch + leih, stueckOffen, stueckZurueck, stueckGesamt, mengen }
}

/** Gemeinsame Stammdaten, die jede Lieferschein-Seite braucht. */
export function useLieferscheinStammdaten() {
  const lieferscheine = useSupabaseTable('lieferscheine', { orderBy: 'erstellt_am', ascending: false })
  const positionen = useSupabaseTable('lieferschein_positionen', { orderBy: 'erstellt_am', ascending: true })
  const baustellen = useSupabaseTable('baustellen', { orderBy: 'erstellt_am', ascending: false })
  const auftraggeber = useSupabaseTable('auftraggeber', { orderBy: 'name', ascending: true })
  const mitarbeiter = useSupabaseTable('mitarbeiter', { orderBy: 'nachname', ascending: true })
  const firmen = useSupabaseTable('firmen', { orderBy: 'name', ascending: true })
  const orte = useSupabaseTable('orte', { orderBy: 'name', ascending: true })
  const artikel = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const gewerke = useSupabaseTable('gewerke', { orderBy: 'name', ascending: true })

  const maps = useMemo(
    () => ({
      baustelle: new Map(baustellen.rows.map((b) => [b.id, b])),
      auftraggeber: new Map(auftraggeber.rows.map((a) => [a.id, a])),
      mitarbeiter: new Map(mitarbeiter.rows.map((m) => [m.id, m])),
      firma: new Map(firmen.rows.map((f) => [f.id, f])),
      ort: new Map(orte.rows.map((o) => [o.id, o])),
      artikel: new Map(artikel.rows.map((a) => [a.id, a])),
      gewerk: new Map(gewerke.rows.map((g) => [g.id, g])),
    }),
    [baustellen.rows, auftraggeber.rows, mitarbeiter.rows, firmen.rows, orte.rows, artikel.rows, gewerke.rows],
  )

  const positionenByLs = useMemo(() => {
    const map = new Map()
    for (const p of positionen.rows) {
      if (!map.has(p.lieferschein_id)) map.set(p.lieferschein_id, [])
      map.get(p.lieferschein_id).push(p)
    }
    return map
  }, [positionen.rows])

  /** Lieferschein + aufgelöste Baustelle/Auftraggeber/Mitarbeiter/Kosten. */
  const resolved = useMemo(
    () =>
      lieferscheine.rows.map((ls) => {
        const baustelle = maps.baustelle.get(ls.baustelle_id)
        const ort = baustelle ? maps.ort.get(baustelle.ort_id) : null
        const ag = baustelle ? maps.auftraggeber.get(baustelle.auftraggeber_id) : null
        const ma = maps.mitarbeiter.get(ls.mitarbeiter_id)
        const firma = maps.firma.get(ls.firma_id)
        const pos = positionenByLs.get(ls.id) ?? []
        const sum = summarize(pos)
        return {
          ...ls,
          nummer_label: lsNummer(ls),
          baustelle,
          strasse: ort?.strasse ?? '',
          ort_name: ort?.name ?? '',
          plz: ort?.plz ?? '',
          adresse: [ort?.strasse, [ort?.plz, ort?.name].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          auftraggeber_id: baustelle?.auftraggeber_id ?? null,
          auftraggeber_name: ag?.name ?? '',
          auftraggeber_logo: ag?.logo_url ?? null,
          mitarbeiter_name: personName(ma),
          mitarbeiter_foto: ma?.foto_url ?? null,
          firma_name: firma?.name ?? '',
          positionen: pos,
          anzahl_positionen: pos.length,
          summe: sum,
          gesamtkosten: sum.gesamt,
          stueck_offen: sum.stueckOffen,
          alter_tage: ageInDays(ls.erstellt_am),
        }
      }),
    [lieferscheine.rows, maps, positionenByLs],
  )

  const loading =
    lieferscheine.loading || positionen.loading || baustellen.loading || mitarbeiter.loading || artikel.loading

  return {
    lieferscheine,
    positionen,
    baustellen,
    auftraggeber,
    mitarbeiter,
    firmen,
    orte,
    artikel,
    gewerke,
    maps,
    resolved,
    loading,
  }
}
