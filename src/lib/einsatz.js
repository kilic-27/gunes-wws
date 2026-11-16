import { leihTage } from './lieferschein.js'

/**
 * Baut aus den Lieferscheinen den Einsatz-Verlauf jedes Einzelstücks und Trocknungsgeräts:
 * wo (Baustelle), wann (ausgegeben/zurück) und bei wem es war.
 * resolved = useLieferscheinStammdaten().resolved. Ergebnis: Map mit Schlüssel "s:<stueckId>" bzw. "g:<geraetId>"
 * und der Liste der Einsätze, neueste zuerst.
 */
export function buildEinsatzIndex(resolved) {
  const index = new Map()
  for (const ls of resolved) {
    for (const p of ls.positionen) {
      if (p.art === 'verbrauch') continue
      const key = p.art === 'trocknung' ? `g:${p.trocknungsgeraet_id}` : `s:${p.bestand_stueck_id}`
      const list = index.get(key) ?? []
      list.push({
        id: p.id,
        typ: 'lieferschein',
        lieferscheinId: ls.id,
        nummer: ls.nummer_label,
        adresse: ls.adresse || '',
        auftraggeber: ls.auftraggeber_name || '',
        mitarbeiter: ls.mitarbeiter_name && ls.mitarbeiter_name !== '–' ? ls.mitarbeiter_name : '',
        von: p.erstellt_am,
        bis: p.zurueck_am ?? null,
        offen: !p.zurueck_am,
        tage: leihTage(p),
        defekt: Boolean(p.defekt),
        sauberkeit: p.sauberkeit ?? null,
      })
      index.set(key, list)
    }
  }
  for (const list of index.values()) list.sort((a, b) => (a.von < b.von ? 1 : -1))
  return index
}

/** Der aktuell offene Einsatz (Gerät ist noch draußen) oder null. */
export const aktuellerEinsatz = (entries) => (entries ?? []).find((e) => e.offen) ?? null
