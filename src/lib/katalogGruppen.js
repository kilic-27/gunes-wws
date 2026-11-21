// Katalog-Ansicht: gleiche Artikel zusammenfassen, ohne die Gerätenummer vorne ("G 45 FUCHSSCHWANZ" -> "FUCHSSCHWANZ").
// Das betrifft nur die Anzeige im Katalog. Bestand und Lieferscheine zeigen weiter jedes Stück einzeln mit Nummer.

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })

/** Name ohne führende Gerätenummer wie "G 45", "G45" oder "G 2.1". */
export function basisName(name) {
  const sauber = String(name ?? '').replace(/\s+/g, ' ').trim()
  return sauber.replace(/^G\s*\d+(?:\.\d+)?\s*/i, '').trim() || sauber
}

const zahlen = (liste) => liste.filter((n) => n != null && !Number.isNaN(n))

/** Von-bis-Text: ein Wert, wenn alle gleich sind, sonst "min – max" (Format übernimmt format). */
function spanne(werte, format) {
  const z = zahlen(werte)
  if (z.length === 0) return ''
  const min = Math.min(...z)
  const max = Math.max(...z)
  return min === max ? format(min) : `${format(min)} – ${format(max)}`
}

/**
 * Fasst Katalog-Zeilen (rowsEnriched) nach Typ und Basisname zusammen. Jede Gruppe enthält ihre Artikel in members
 * und die Summen/Spannen, die die Tabelle zeigt.
 */
export function gruppiereArtikel(rows, formatEuro) {
  const map = new Map()
  for (const row of rows) {
    const basis = basisName(row.name)
    const key = `${row.typ}|${basis.toLowerCase()}`
    let g = map.get(key)
    if (!g) {
      g = { id: key, name: basis, typ: row.typ, members: [] }
      map.set(key, g)
    }
    g.members.push(row)
  }

  return [...map.values()]
    .map((g) => {
      const members = g.members.sort((a, b) => collator.compare(a.name, b.name))
      const first = members.find((m) => m.foto_url) ?? members[0]
      const stats = {}
      for (const m of members) for (const [k, v] of Object.entries(m.stueck_stats ?? {})) stats[k] = (stats[k] ?? 0) + v
      const aktiv = members.filter((m) => m.aktiv).length
      return {
        ...g,
        members,
        foto_url: first.foto_url ?? null,
        gewerk_id: first.gewerk_id,
        gewerk_name: first.gewerk_name,
        standard_lager_id: first.standard_lager_id,
        lager_name: first.lager_name,
        vpe: first.vpe,
        artikel_count: members.length,
        aktiv_count: aktiv,
        aktiv: aktiv > 0,
        stueck_stats: stats,
        stueck_total: members.reduce((s, m) => s + (m.stueck_total ?? 0), 0),
        preis_num: zahlen(members.map((m) => m.preis_num)).length ? Math.min(...zahlen(members.map((m) => m.preis_num))) : null,
        preis_text: spanne(members.map((m) => m.preis_num), formatEuro),
        tagespreis_text: spanne(members.map((m) => (m.tagespreis == null || m.tagespreis === '' ? null : Number(m.tagespreis))), formatEuro),
        // nur zum Suchen: Barcodes und Namen der enthaltenen Artikel
        barcode: members.map((m) => m.barcode).filter(Boolean).join(' '),
        beschreibung: members.map((m) => m.name).join(' '),
      }
    })
    .sort((a, b) => collator.compare(a.name, b.name))
}
