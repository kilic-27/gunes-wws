import { useMemo } from 'react'
import { useSupabaseTable } from './useSupabaseTable.js'
import { leihTage, useLieferscheinStammdaten } from './lieferschein.js'

export const GERAET_STATUS = ['verfuegbar', 'verliehen', 'reparatur', 'defekt', 'verlust', 'entsorgt']

export const STATUS_TONE = {
  verfuegbar: 'green',
  verliehen: 'amber',
  reparatur: 'blue',
  defekt: 'red',
  verlust: 'red',
  entsorgt: 'gray',
}

const euroFormatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export const euro = (value) => euroFormatter.format(Number(value) || 0)

/** Stammdaten + Einsatz-Zuordnung (welches Gerät ist auf welchem Lieferschein/Baustelle) für alle Trocknungsgeräte-Seiten. */
export function useTrocknung() {
  const geraete = useSupabaseTable('trocknungsgeraete', { orderBy: 'barcode', ascending: true })
  const gruppen = useSupabaseTable('trocknungsgeraet_gruppen', { orderBy: 'name', ascending: true })
  const lager = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const ls = useLieferscheinStammdaten()

  const gruppeMap = useMemo(() => new Map(gruppen.rows.map((g) => [g.id, g])), [gruppen.rows])
  const lagerMap = useMemo(() => new Map(lager.rows.map((l) => [l.id, l])), [lager.rows])

  // Gerät -> offene Lieferschein-Position (Einsatz)
  const einsatz = useMemo(() => {
    const lsById = new Map(ls.resolved.map((l) => [l.id, l]))
    const map = new Map()
    for (const p of ls.positionen.rows) {
      if (p.art !== 'trocknung' || p.zurueck_am || !p.trocknungsgeraet_id) continue
      const lieferschein = lsById.get(p.lieferschein_id)
      if (lieferschein) map.set(p.trocknungsgeraet_id, { position: p, ls: lieferschein, tage: leihTage(p) })
    }
    return map
  }, [ls.resolved, ls.positionen.rows])

  const rows = useMemo(
    () =>
      geraete.rows.map((g) => {
        const e = einsatz.get(g.id)
        return {
          ...g,
          gruppe_name: gruppeMap.get(g.gruppe_id)?.name ?? '',
          lager_name: lagerMap.get(g.lager_id)?.bezeichnung ?? '',
          tagespreis_num: Number(g.tagespreis) || 0,
          einsatz: e ?? null,
          einsatz_text: e ? `${e.ls.nummer_label} ${e.ls.mitarbeiter_name} ${e.ls.adresse}` : '',
        }
      }),
    [geraete.rows, gruppeMap, lagerMap, einsatz],
  )

  const loading = geraete.loading || gruppen.loading || lager.loading || ls.loading
  return { geraete, gruppen, lager, ls, gruppeMap, lagerMap, einsatz, rows, loading }
}
