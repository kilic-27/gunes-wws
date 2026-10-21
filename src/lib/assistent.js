// WWS-Assistent: beantwortet Fragen zu Baustellen, Lieferscheinen, Bestand, Geräten und Mitarbeitern –
// ohne externe KI, direkt aus der Datenbank (Rechte gelten wie in der App). Versteht Zeiträume,
// Namen und typische Formulierungen und lernt über „Merk dir …“ bzw. das Beibringen-Formular dazu.

import { supabase } from './supabaseClient.js'
import { abstand, benutztMerken, lernen, merkBefehl, MONATE, normalisieren, vergessen, wissenLaden, wissenSuchen, wortPasst, zeitWoerter } from './assistentWissen.js'
import { formatEuro, formatMenge, lsNummer, personName, summarize, unitOf } from './lieferschein.js'

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const heute = () => iso(new Date())
const tageAddieren = (isoDatum, tage) => {
  const d = new Date(`${isoDatum}T12:00`)
  d.setDate(d.getDate() + tage)
  return iso(d)
}
const datumDE = (value) => (value ? new Date(value).toLocaleDateString('de-DE') : '–')
const tageSeit = (value) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
const plural = (n, einzahl, mehrzahl) => `${n} ${n === 1 ? einzahl : mehrzahl}`

/** Erkennt einen Zeitraum in der Frage (null = keine Zeitangabe). */
export function zeitraumAus(frage) {
  const f = frage.toLowerCase()
  const h = new Date(`${heute()}T12:00`)
  const j = h.getFullYear()
  const m = h.getMonth()
  const monat = (jahr, mon, label) => ({ von: iso(new Date(jahr, mon, 1)), bis: iso(new Date(jahr, mon + 1, 0)), label: label ?? `im ${MONATE[mon]} ${jahr}` })
  if (/\bheute\b/.test(f)) return { von: heute(), bis: heute(), label: 'heute' }
  if (/\bgestern\b/.test(f)) return { von: tageAddieren(heute(), -1), bis: tageAddieren(heute(), -1), label: 'gestern' }
  if (/letzte[nr]? woche|vorwoche/.test(f)) {
    const mo = new Date(h)
    mo.setDate(h.getDate() - ((h.getDay() + 6) % 7) - 7)
    return { von: iso(mo), bis: tageAddieren(iso(mo), 6), label: 'letzte Woche' }
  }
  if (/diese[rn]? woche|aktuelle[rn]? woche/.test(f)) {
    const mo = new Date(h)
    mo.setDate(h.getDate() - ((h.getDay() + 6) % 7))
    return { von: iso(mo), bis: tageAddieren(iso(mo), 6), label: 'diese Woche' }
  }
  if (/letzte[nr]? monat|vormonat/.test(f)) return monat(m === 0 ? j - 1 : j, (m + 11) % 12, 'im letzten Monat')
  if (/diese[nm]? monat|aktuelle[nm]? monat/.test(f)) return monat(j, m, 'in diesem Monat')
  if (/letzte[sn]? jahr|vorjahr/.test(f)) return { von: `${j - 1}-01-01`, bis: `${j - 1}-12-31`, label: `im Vorjahr (${j - 1})` }
  const quartal = /(\d)\.?\s*quartal|\bq([1-4])\b/.exec(f)
  if (quartal) {
    const q = Number(quartal[1] || quartal[2]) - 1
    const jahr = Number(/20\d{2}/.exec(f)?.[0] ?? j)
    return { von: iso(new Date(jahr, q * 3, 1)), bis: iso(new Date(jahr, q * 3 + 3, 0)), label: `im ${q + 1}. Quartal ${jahr}` }
  }
  const mName = MONATE.findIndex((x) => new RegExp(`\\b${x.toLowerCase()}\\b`).test(f) || (x === 'März' && /\bmaerz\b/.test(f)))
  if (mName >= 0) return monat(Number(/20\d{2}/.exec(f)?.[0] ?? (mName > m ? j - 1 : j)), mName)
  const jahrNr = /\b(20\d{2})\b/.exec(f)
  if (jahrNr) return { von: `${jahrNr[1]}-01-01`, bis: `${jahrNr[1]}-12-31`, label: `im Jahr ${jahrNr[1]}` }
  if (/dieses jahr|diesem jahr|seit januar/.test(f)) return { von: `${j}-01-01`, bis: heute(), label: `${j} bis heute` }
  return null
}

// Daten-Cache: dieselben Tabellen werden pro Frage mehrfach gebraucht.
const cache = new Map()
const TTL = 20000

async function laden(tabelle, spalten = '*') {
  const key = `${tabelle}|${spalten}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < TTL) return hit.data
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(tabelle).select(spalten).order('id').range(from, from + 999)
    if (error) throw new Error(`Auf „${tabelle}“ kann ich gerade nicht zugreifen.`)
    rows.push(...data)
    if (data.length < 1000) break
  }
  cache.set(key, { t: Date.now(), data: rows })
  return rows
}

async function ladeSicher(tabelle, spalten) {
  try {
    return await laden(tabelle, spalten)
  } catch {
    return []
  }
}

const STOPP = new Set([
  'wie', 'viel', 'viele', 'wieviel', 'wieviele', 'welche', 'welcher', 'welches', 'welchen', 'sind', 'ist', 'noch', 'offen', 'offene', 'offenen', 'aktuell', 'aktuelle', 'aktuellen',
  'zeige', 'zeig', 'zeigen', 'mir', 'uns', 'die', 'der', 'das', 'den', 'dem', 'des', 'von', 'vom', 'bei', 'auf', 'im', 'in', 'an', 'am', 'zu', 'zum', 'zur', 'fuer', 'mit', 'und', 'oder',
  'alle', 'allen', 'aller', 'haben', 'hat', 'wir', 'ich', 'gibt', 'es', 'lager', 'bestand', 'liste', 'baustelle', 'baustellen', 'lieferschein', 'lieferscheine', 'lieferscheinen',
  'nicht', 'schon', 'bitte', 'mal', 'alles', 'was', 'wo', 'wer', 'wann', 'gerade', 'momentan', 'derzeit', 'eigentlich', 'insgesamt', 'gesamt', 'noch', 'ein', 'eine', 'einen',
  'ltr', 'liter', 'stueck', 'stk', 'kg', 'meter', 'rolle', 'rollen', 'paar', 'set', 'packung', 'karton', 'sack', 'dose', 'kartusche', 'lfm',
  'gebe', 'gib', 'sag', 'sage', 'suche', 'finde', 'such', 'heisst', 'name', 'namen', 'so', 'sich', 'ob', 'dort', 'hier', 'da', 'dann', 'denn', 'auch', 'nur', 'jetzt', 'gerade',
  'heute', 'gestern', 'woche', 'monat', 'jahr', 'letzte', 'letzten', 'diese', 'diesen', 'dieser', 'dieses', 'aktiv', 'aktive', 'aktiven', 'abgeschlossen', 'abgeschlossene', 'fertig',
  'unkontrolliert', 'unkontrollierte', 'kontrolliert', 'ueberfaellig', 'ueberfaellige', 'defekt', 'defekte', 'verliehen', 'draussen', 'verfuegbar', 'frei',
])

/** Inhaltswörter einer Frage (ohne Füllwörter, Einheiten und Zeitwörter). */
function inhalt(frage, extra = []) {
  const weg = new Set(extra)
  return normalisieren(frage)
    .split(' ')
    .filter((w) => w && !STOPP.has(w) && !weg.has(w) && !MONATE.some((m) => normalisieren(m) === w) && !/^20\d{2}$/.test(w))
}

/** Bewertet Einträge nach der Anzahl passender Wörter (0…1). */
function bewerten(tokens, liste, textFn) {
  if (!tokens.length) return []
  const res = []
  for (const item of liste) {
    const text = normalisieren(textFn(item))
    if (!text) continue
    const ws = text.split(' ')
    const kompakt = ws.join('')
    const treffer = tokens.filter((t) => ws.some((w) => wortPasst(t, w)) || (t.length >= 3 && kompakt.includes(t))).length
    if (treffer) res.push({ item, score: treffer / tokens.length, treffer })
  }
  // „AC 12“ / „AC12“: zusammengeschrieben vergleichen
  if (tokens.length >= 2) {
    const zusammen = tokens.join('')
    for (const item of liste) {
      const kompakt = normalisieren(textFn(item)).split(' ').join('')
      if (kompakt.includes(zusammen) && !res.some((r) => r.item === item)) res.push({ item, score: 1, treffer: tokens.length })
    }
  }
  return res.sort((a, b) => b.score - a.score || b.treffer - a.treffer)
}

// Einheitenwörter der Frage -> Schlüssel, der in der Artikel-Einheit (vpe) vorkommen muss.
const EINHEIT_WOERTER = [
  [/\b(ltr|liter|l)\b/, 'liter'],
  [/\b(stk|stueck|st)\b/, 'stueck'],
  [/\b(kg|kilogramm|kilo)\b/, 'kg'],
  [/\b(meter|m|lfm)\b/, 'meter'],
  [/\b(rolle|rollen)\b/, 'rolle'],
  [/\b(paar)\b/, 'paar'],
  [/\b(set)\b/, 'set'],
]
const einheitAusFrage = (f) => EINHEIT_WOERTER.find(([r]) => r.test(f))?.[1] ?? null
const einheitPasst = (a, schluessel) => normalisieren(a.vpe || 'Stück').includes(schluessel === 'meter' ? 'meter' : schluessel) || (schluessel === 'meter' && /lfm/.test(normalisieren(a.vpe)))

/** Ähnliche Artikel, wenn es keinen exakten Treffer gibt (Tippfehler, andere Nummer, passende Einheit). */
function aehnlicheArtikel(tokens, einheit, liste) {
  const res = []
  for (const a of liste) {
    const ws = normalisieren(a.name).split(' ')
    let score = 0
    for (const t of tokens) {
      if (ws.includes(t)) score += /^\d+$/.test(t) ? 1.2 : 1
      else if (!/^\d+$/.test(t) && ws.some((x) => x.length >= 2 && abstand(t, x) <= 1)) score += 0.6
    }
    if (einheit) score += einheitPasst(a, einheit) ? 0.8 : -0.6
    if (score >= 1.4) res.push({ a, score })
  }
  return res.sort((x, y) => y.score - x.score).slice(0, 6).map((r) => r.a)
}

const beste = (bewertet, minScore = 0.99) => {
  if (!bewertet.length) return []
  const top = bewertet[0].score
  return top >= minScore ? bewertet.filter((r) => r.score >= top - 0.0001) : []
}

const EINZELN = (liste, max = 10) => liste.slice(0, max)

// ---------------------------------------------------------------------------
// Datenmodelle
// ---------------------------------------------------------------------------

async function stammdaten() {
  const [baustellen, orte, auftraggeber, mitarbeiter, positionen, lieferscheine, lsPos, artikel, verbrauch, stuecke, lager, geraete, gruppen] = await Promise.all([
    ladeSicher('baustellen', 'id,projekt_nr,auftraggeber_id,ort_id,start_datum,ende_datum,status,gesamtkosten'),
    ladeSicher('orte', 'id,name,plz,strasse'),
    ladeSicher('auftraggeber', 'id,name,aktiv'),
    ladeSicher('mitarbeiter', 'id,vorname,nachname,username,mobil,email,position_id,aktiv,auftraggeber_id'),
    ladeSicher('positionen', 'id,name'),
    ladeSicher('lieferscheine', 'id,nr,nummer,baustelle_id,mitarbeiter_id,status,kontrolliert,datum,erstellt_am,projektnummer,firma_id'),
    ladeSicher('lieferschein_positionen', 'id,lieferschein_id,art,artikel_id,bestand_stueck_id,trocknungsgeraet_id,menge,zurueck_menge,zurueck_am,einzelpreis,tagespreis,erstellt_am'),
    ladeSicher('artikel', 'id,name,typ,vpe,barcode,aktiv,meldebestand,preis'),
    ladeSicher('bestand_verbrauch', 'id,artikel_id,lager_id,menge'),
    ladeSicher('bestand_stueck', 'id,artikel_id,barcode,lager_id,status'),
    ladeSicher('lager', 'id,bezeichnung'),
    ladeSicher('trocknungsgeraete', 'id,barcode,name,gruppe_id,lager_id,status,geraetenummer,seriennummer'),
    ladeSicher('trocknungsgeraet_gruppen', 'id,name'),
  ])
  const m = {
    orte: new Map(orte.map((o) => [o.id, o])),
    ag: new Map(auftraggeber.map((a) => [a.id, a])),
    ma: new Map(mitarbeiter.map((x) => [x.id, x])),
    pos: new Map(positionen.map((p) => [p.id, p])),
    bau: new Map(baustellen.map((b) => [b.id, b])),
    art: new Map(artikel.map((a) => [a.id, a])),
    lager: new Map(lager.map((l) => [l.id, l])),
    stueck: new Map(stuecke.map((s) => [s.id, s])),
    geraet: new Map(geraete.map((g) => [g.id, g])),
    gruppe: new Map(gruppen.map((g) => [g.id, g])),
  }
  const posByLs = new Map()
  for (const p of lsPos) {
    if (!posByLs.has(p.lieferschein_id)) posByLs.set(p.lieferschein_id, [])
    posByLs.get(p.lieferschein_id).push(p)
  }
  const adresse = (b) => {
    const o = b ? m.orte.get(b.ort_id) : null
    return [o?.strasse, [o?.plz, o?.name].filter(Boolean).join(' ')].filter(Boolean).join(', ') || b?.projekt_nr || '–'
  }
  const lieferscheineAufgeloest = lieferscheine.map((ls) => {
    const b = m.bau.get(ls.baustelle_id)
    const positionenDesLs = posByLs.get(ls.id) ?? []
    return {
      ...ls,
      nummer_label: lsNummer(ls),
      baustelle: b,
      adresse: adresse(b),
      auftraggeber_id: b?.auftraggeber_id ?? null,
      auftraggeber_name: m.ag.get(b?.auftraggeber_id)?.name ?? '',
      mitarbeiter_name: personName(m.ma.get(ls.mitarbeiter_id)),
      positionen: positionenDesLs,
      summe: summarize(positionenDesLs),
    }
  })
  const lsById = new Map(lieferscheineAufgeloest.map((l) => [l.id, l]))
  // Wer hat welches Stück / Gerät gerade? (offene Position -> Lieferschein)
  const einsatzStueck = new Map()
  const einsatzGeraet = new Map()
  for (const p of lsPos) {
    if (p.zurueck_am) continue
    const ls = lsById.get(p.lieferschein_id)
    if (!ls) continue
    if (p.art === 'stueck' && p.bestand_stueck_id) einsatzStueck.set(p.bestand_stueck_id, ls)
    if (p.art === 'trocknung' && p.trocknungsgeraet_id) einsatzGeraet.set(p.trocknungsgeraet_id, ls)
  }
  return {
    baustellen, auftraggeber, mitarbeiter, artikel, verbrauch, stuecke, lager, geraete, lsPos,
    lieferscheine: lieferscheineAufgeloest, lsById, m, adresse, einsatzStueck, einsatzGeraet,
  }
}

const mitarbeiterName = (x) => `${x.vorname ?? ''} ${x.nachname ?? ''}`.trim()
const lsZeile = (ls) =>
  `${ls.nummer_label} · ${ls.adresse}${ls.auftraggeber_name ? ` (${ls.auftraggeber_name})` : ''} · ${datumDE(ls.erstellt_am)} · ${ls.status === 'offen' ? 'offen' : 'abgeschlossen'} · ${formatEuro(ls.summe.gesamt)}`
const lsEintrag = (ls) => ({ text: lsZeile(ls), link: `/lieferscheine/${ls.id}` })

export const NAVIGATION = [
  [/dashboard|uebersicht/, '/dashboard', 'Dashboard'],
  [/baustelle/, '/baustellen', 'Baustellen'],
  [/lieferschein.*erstell|neuer lieferschein/, '/lieferscheine/erstellen', 'Lieferschein erstellen'],
  [/lieferschein/, '/lieferscheine/uebersicht', 'Lieferscheine'],
  [/auftraggeber/, '/kunden/auftraggeber', 'Auftraggeber'],
  [/projektleiter/, '/kunden/externe-projektleiter', 'Projektleiter'],
  [/sub.?unternehmen/, '/kunden/sub-unternehmen', 'SUB Unternehmen'],
  [/katalog|artikel/, '/artikel/katalog', 'Katalog'],
  [/bestand|lagerbestand/, '/artikel/bestand', 'Bestand'],
  [/wareneingang/, '/artikel/wareneingang', 'Wareneingang'],
  [/reparatur/, '/artikel/reparaturuebersicht', 'Reparaturübersicht'],
  [/trocknung/, '/trocknungsgeraete/dashboard', 'Trocknungsgeräte'],
  [/mitarbeiter/, '/benutzer/mitarbeiter', 'Mitarbeiter'],
  [/berechtigung/, '/benutzer/berechtigungen', 'Berechtigungen'],
  [/inventur/, '/einstellungen/inventur', 'Inventur'],
  [/lager\b/, '/lager', 'Lager'],
]

export const BEISPIELE = [
  'Welche Baustellen sind von Derewa noch offen?',
  'Wie viel Liter AC 12 haben wir noch auf Lager?',
  'Zeige mir die Lieferscheine von Ömer Kilic',
  'Wo ist UID232?',
  'Wer hat die Kabeltrommeln?',
  'Welche Lieferscheine sind noch nicht kontrolliert?',
  'Wie viele Trocknungsgeräte sind im Einsatz?',
  'Was muss nachbestellt werden?',
  'Welche Geräte sind defekt?',
  'Telefonnummer von Tolga Altintas',
  'Wie viele Mitarbeiter sind bei Derewa eingestellt?',
  'Bei welcher Firma arbeitet Tolga Altintas?',
  'Wie viele Maler arbeiten bei Derewa?',
  'Welche Mitarbeiter haben keine Firma?',
]

// ---------------------------------------------------------------------------
// Antworten
// ---------------------------------------------------------------------------

/** Wörter der Frage, die nicht zur gelernten Formulierung gehören (z. B. ein Name). */
function restWoerter(frage, ausloeser) {
  const bekannt = new Set(normalisieren(ausloeser).split(' '))
  return frage
    .replace(/[?!.,;:"„“]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !bekannt.has(normalisieren(w)))
    .join(' ')
}

/** Beantwortet eine Frage. Rückgabe: { text, liste?, link?, navigieren?, nichtVerstanden?, gelernt? } */
export async function beantworten(frage, { hatRecht, tiefe = 0 } = {}) {
  const f = normalisieren(frage)
  const darf = (bereich) => !hatRecht || hatRecht(bereich)
  const fehltRecht = (name) => ({ text: `Dafür fehlt dir das Recht „${name}“.` })
  if (!f) return { text: 'Frag mich etwas, z. B. „Welche Baustellen sind von Derewa noch offen?“' }

  // Beibringen per Chat: „Merk dir: …“, „Vergiss …“
  const befehl = tiefe === 0 ? merkBefehl(frage) : null
  if (befehl?.art === 'merken') {
    const r = await lernen({ art: 'antwort', ausloeser: [befehl.thema], antwort: befehl.antwort })
    return { text: r.error ? `Konnte ich mir nicht merken: ${r.error}` : `Gemerkt! 🧠 Wenn du nach „${befehl.thema}“ fragst, antworte ich: „${befehl.antwort}“`, gelernt: !r.error }
  }
  if (befehl?.art === 'umleitung') {
    const probe = await beantworten(befehl.ziel, { hatRecht, tiefe: 1 })
    const r = await lernen({ art: 'umleitung', ausloeser: [befehl.ausloeser], ziel_frage: befehl.ziel })
    if (r.error) return { text: `Konnte ich mir nicht merken: ${r.error}` }
    return {
      text: `Gemerkt! 🧠 „${befehl.ausloeser}“ verstehe ich ab jetzt wie „${befehl.ziel}“.${probe.nichtVerstanden ? ' Allein kann ich diese Frage noch nicht beantworten – nenne beim Fragen z. B. den Namen oder die Baustelle dazu.' : ''}`,
      gelernt: true,
    }
  }
  if (befehl?.art === 'vergessen') {
    const t = wissenSuchen(befehl.thema, await wissenLaden())
    if (!t || t.score < 0.75) return { text: `Zu „${befehl.thema}“ habe ich nichts gespeichert.` }
    const r = await vergessen(t.eintrag.id)
    return { text: r.error ? `Konnte ich nicht löschen: ${r.error}` : `Vergessen: „${t.ausloeser}“.` }
  }

  // Selbst beigebrachtes Wissen hat Vorrang
  const wissen = tiefe === 0 ? await wissenLaden() : []
  const treffer = wissenSuchen(frage, wissen)
  if (treffer && treffer.score >= 0.75) {
    benutztMerken(treffer.eintrag)
    const e = treffer.eintrag
    if (e.art === 'antwort') return { text: e.antwort, link: e.link ? { label: 'Öffnen', to: e.link } : undefined, gelernt: true, wissenId: e.id }
    const ziel = [e.ziel_frage, zeitWoerter(frage), restWoerter(frage, treffer.ausloeser)].filter(Boolean).join(' ')
    const antwort = await beantworten(ziel, { hatRecht, tiefe: tiefe + 1 })
    return { ...antwort, gelernt: true, wissenId: e.id }
  }
  const vielleicht = treffer && treffer.score >= 0.5 ? treffer : null

  try {
    if (/^(hilfe|was kannst du|wie funktioniert|beispiele?)/.test(f)) {
      return { text: 'Ich beantworte Fragen zu Baustellen, Lieferscheinen, Bestand, Geräten und Mitarbeitern. Zum Beispiel:', liste: BEISPIELE.map((b) => ({ text: b, frage: b })) }
    }

    // Navigation: „öffne …“, „geh zu …“
    if (/^(oeffne|geh|gehe|wechsel|navigier|bring mich)/.test(f)) {
      const ziel = NAVIGATION.find(([r]) => r.test(f))
      if (ziel) return { text: `Ich öffne ${ziel[2]}.`, navigieren: ziel[1] }
    }

    const d = await stammdaten()

    // ---- Barcode / einzelnes Stück oder Gerät ---------------------------------
    const code = /\b((?:uid|tid|id)\d{3,})\b/i.exec(frage)
    if (code) {
      const c = code[1].toLowerCase()
      const stueck = d.stuecke.find((s) => (s.barcode ?? '').toLowerCase() === c)
      const geraet = d.geraete.find((g) => (g.barcode ?? '').toLowerCase() === c)
      const art = d.artikel.find((a) => (a.barcode ?? '').toLowerCase() === c)
      if (geraet) {
        if (!darf('trocknungsgeraete')) return fehltRecht('Trocknungsgeräte')
        const ls = d.einsatzGeraet.get(geraet.id)
        return {
          text: `${geraet.name} (${geraet.barcode})${geraet.geraetenummer ? `, Gerätenummer ${geraet.geraetenummer}` : ''}: ${statusText(geraet.status)}${ls ? ` – auf ${ls.nummer_label} bei ${ls.mitarbeiter_name}, Baustelle ${ls.adresse} (seit ${tageSeit(ls.erstellt_am) + 1} Tagen)` : `, Lager ${d.m.lager.get(geraet.lager_id)?.bezeichnung ?? '–'}`}.`,
          link: ls ? { label: `${ls.nummer_label} öffnen`, to: `/lieferscheine/${ls.id}` } : { label: 'Trocknungsgeräte öffnen', to: '/trocknungsgeraete/auflistung' },
        }
      }
      if (stueck) {
        if (!darf('artikel')) return fehltRecht('Artikel')
        const a = d.m.art.get(stueck.artikel_id)
        const ls = d.einsatzStueck.get(stueck.id)
        return {
          text: `${a?.name ?? 'Stück'} (${stueck.barcode}): ${statusText(stueck.status)}${ls ? ` – auf ${ls.nummer_label} bei ${ls.mitarbeiter_name}, Baustelle ${ls.adresse} (seit ${tageSeit(ls.erstellt_am) + 1} Tagen)` : `, Lager ${d.m.lager.get(stueck.lager_id)?.bezeichnung ?? '–'}`}.`,
          link: ls ? { label: `${ls.nummer_label} öffnen`, to: `/lieferscheine/${ls.id}` } : { label: 'Bestand öffnen', to: '/artikel/bestand' },
        }
      }
      if (art) return antwortBestand(d, [art], darf, fehltRecht)
      return { text: `Den Barcode „${code[1]}“ kenne ich nicht.` }
    }

    // ---- Lieferschein per Nummer ----------------------------------------------
    const nr = /(?:lf-?|lieferschein\s*(?:nr\.?|nummer)?\s*#?\s*|#)(\d{3,6})\b/i.exec(frage)
    if (nr && /lieferschein|lf-?\d|#/.test(f + frage.toLowerCase())) {
      if (!darf('lieferscheine')) return fehltRecht('Lieferscheine')
      const ls = d.lieferscheine.find((l) => String(l.nr) === nr[1])
      if (!ls) return { text: `Einen Lieferschein mit der Nummer ${nr[1]} finde ich nicht.` }
      const offeneStuecke = ls.positionen.filter((p) => p.art !== 'verbrauch' && !p.zurueck_am).length
      return {
        text: `${ls.nummer_label}: ${ls.adresse}${ls.auftraggeber_name ? ` (${ls.auftraggeber_name})` : ''}, Mitarbeiter ${ls.mitarbeiter_name}, angelegt am ${datumDE(ls.erstellt_am)}, ${ls.status === 'offen' ? 'offen' : 'abgeschlossen'}${ls.kontrolliert ? ', kontrolliert' : ', noch nicht kontrolliert'}. ${ls.positionen.length} Positionen, Kosten ${formatEuro(ls.summe.gesamt)}${offeneStuecke ? `, ${plural(offeneStuecke, 'Stück ist', 'Stücke sind')} noch draußen` : ''}.`,
        link: { label: `${ls.nummer_label} öffnen`, to: `/lieferscheine/${ls.id}` },
      }
    }

    // ---- Wo ist / wer hat -----------------------------------------------------
    if (/\b(wo ist|wo sind|wer hat|wer hatte|bei wem|wo befindet|wo steht|wo liegt|wo liegen)\b/.test(f)) {
      const tokens = inhalt(frage, ['wo', 'ist', 'sind', 'wer', 'hat', 'hatte', 'wem', 'befindet', 'steht', 'liegt', 'liegen'])
      if (tokens.length) {
        // Werkzeug-/Geräte-Artikel oder Trocknungsgeräte-Modelle nach Namen
        const artTreffer = beste(bewerten(tokens, d.artikel.filter((a) => a.typ === 'werkzeug'), (a) => a.name), 0.5).map((r) => r.item)
        const geraeteTreffer = beste(bewerten(tokens, d.geraete, (g) => `${g.name} ${d.m.gruppe.get(g.gruppe_id)?.name ?? ''}`), 0.5).map((r) => r.item)
        const zeilen = []
        if (artTreffer.length && darf('artikel')) {
          const ids = new Set(artTreffer.map((a) => a.id))
          for (const s of d.stuecke.filter((x) => ids.has(x.artikel_id) && x.status === 'verliehen')) {
            const ls = d.einsatzStueck.get(s.id)
            zeilen.push({ text: `${d.m.art.get(s.artikel_id)?.name} (${s.barcode}) – ${ls ? `${ls.mitarbeiter_name}, ${ls.adresse}, ${ls.nummer_label}` : 'ausgegeben (kein Lieferschein hinterlegt, z. B. aus dem Altsystem)'}`, link: ls ? `/lieferscheine/${ls.id}` : '/artikel/bestand' })
          }
          if (!zeilen.length) {
            const frei = d.stuecke.filter((x) => ids.has(x.artikel_id))
            const proLager = new Map()
            for (const s of frei) proLager.set(d.m.lager.get(s.lager_id)?.bezeichnung ?? '–', (proLager.get(d.m.lager.get(s.lager_id)?.bezeichnung ?? '–') ?? 0) + 1)
            return {
              text: `${artTreffer.map((a) => a.name).slice(0, 3).join(', ')}: aktuell ist nichts verliehen. Vorhanden: ${frei.length} Stück${[...proLager.entries()].length ? ` (${[...proLager.entries()].map(([l, n]) => `${n} in ${l}`).join(', ')})` : ''}.`,
              link: { label: 'Bestand öffnen', to: '/artikel/bestand' },
            }
          }
        }
        if (geraeteTreffer.length && darf('trocknungsgeraete')) {
          for (const g of geraeteTreffer.filter((x) => x.status === 'verliehen')) {
            const ls = d.einsatzGeraet.get(g.id)
            zeilen.push({ text: `${g.name} (${g.barcode}) – ${ls ? `${ls.mitarbeiter_name}, ${ls.adresse}, ${ls.nummer_label}` : 'im Einsatz'}`, link: ls ? `/lieferscheine/${ls.id}` : '/trocknungsgeraete/auflistung' })
          }
        }
        if (zeilen.length) return { text: `${plural(zeilen.length, 'Treffer', 'Treffer')} – so ist es aktuell verteilt:`, liste: EINZELN(zeilen, 15) }
        if (artTreffer.length || geraeteTreffer.length) {
          return { text: `Von „${(artTreffer[0] ?? geraeteTreffer[0]).name}“ ist aktuell nichts auf einem Lieferschein.` }
        }
      }
    }

    // ---- Nachbestellen / knapper Bestand ------------------------------------
    if (/nachbestell|knapp|zu wenig|aufgebraucht|meldebestand|fast leer|ausgegangen|geht aus|wird knapp/.test(f) || (/\bleer\b/.test(f) && /lager|bestand|artikel/.test(f))) {
      if (!darf('artikel')) return fehltRecht('Artikel')
      const summe = new Map()
      for (const v of d.verbrauch) summe.set(v.artikel_id, (summe.get(v.artikel_id) ?? 0) + Number(v.menge))
      const knapp = d.artikel
        .filter((a) => a.aktiv && a.typ === 'verbrauchsmaterial')
        .map((a) => ({ a, menge: summe.get(a.id) ?? 0, melde: Number(a.meldebestand ?? 0) }))
        .filter((x) => x.menge <= 0 || (x.melde > 0 && x.menge <= x.melde))
        .sort((x, y) => x.menge - y.menge)
      if (!knapp.length) return { text: 'Aktuell ist nichts knapp oder aufgebraucht. 👍' }
      return {
        text: `${plural(knapp.length, 'Verbrauchsartikel ist', 'Verbrauchsartikel sind')} leer oder unter dem Meldebestand:`,
        liste: EINZELN(knapp, 12).map((x) => ({ text: `${x.a.name}: ${formatMenge(x.menge)} ${unitOf(x.a)}${x.melde > 0 ? ` (Meldebestand ${formatMenge(x.melde)})` : ''}`, link: '/artikel/bestand' })),
        link: { label: 'Bestand öffnen', to: '/artikel/bestand' },
      }
    }

    // ---- Defekte Geräte / Reparatur -----------------------------------------
    if (/defekt|kaputt|reparatur|verloren|verlust|fehlt/.test(f) && !/lieferschein|baustelle/.test(f)) {
      const zeilen = []
      if (darf('artikel')) {
        for (const s of d.stuecke.filter((x) => ['defekt', 'reparatur', 'verlust'].includes(x.status))) {
          zeilen.push({ text: `${d.m.art.get(s.artikel_id)?.name ?? '?'} (${s.barcode}) – ${statusText(s.status)}`, link: '/artikel/reparaturuebersicht' })
        }
      }
      if (darf('trocknungsgeraete')) {
        for (const g of d.geraete.filter((x) => ['defekt', 'reparatur', 'verlust'].includes(x.status))) {
          zeilen.push({ text: `${g.name} (${g.barcode}) – ${statusText(g.status)}`, link: '/trocknungsgeraete/auflistung' })
        }
      }
      if (!zeilen.length) return { text: 'Aktuell sind keine Geräte als defekt, in Reparatur oder verloren gemeldet. 👍' }
      return { text: `${plural(zeilen.length, 'Gerät ist', 'Geräte sind')} defekt, in Reparatur oder verloren:`, liste: EINZELN(zeilen, 15), link: { label: 'Reparaturübersicht', to: '/artikel/reparaturuebersicht' } }
    }

    // ---- Trocknungsgeräte ---------------------------------------------------
    if (/trocknung|kondens|entfeucht|ventilator|heizluefter|heizplatte|seitenkanal/.test(f) && !/lieferschein|baustelle/.test(f)) {
      if (!darf('trocknungsgeraete')) return fehltRecht('Trocknungsgeräte')
      const status = /einsatz|verliehen|draussen|ausgegeben|baustelle/.test(f) ? 'verliehen' : /verfuegbar|frei|lager/.test(f) ? 'verfuegbar' : null
      const tokens = inhalt(frage, ['trocknungsgeraete', 'trocknungsgeraet', 'trocknung', 'geraete', 'geraet', 'einsatz', 'verliehen', 'draussen', 'ausgegeben', 'kondenstrockner', 'kondens'])
      let liste = d.geraete.filter((g) => g.status !== 'entsorgt')
      const modell = beste(bewerten(tokens, liste, (g) => `${g.name} ${d.m.gruppe.get(g.gruppe_id)?.name ?? ''}`), 0.99).map((r) => r.item)
      if (tokens.length && modell.length) liste = modell
      const zaehl = (s) => liste.filter((g) => g.status === s).length
      if (status === 'verliehen') {
        const im = liste.filter((g) => g.status === 'verliehen')
        if (!im.length) return { text: 'Aktuell ist kein Trocknungsgerät im Einsatz.' }
        return {
          text: `${plural(im.length, 'Trocknungsgerät ist', 'Trocknungsgeräte sind')} im Einsatz:`,
          liste: EINZELN(im.map((g) => {
            const ls = d.einsatzGeraet.get(g.id)
            return { text: `${g.name} (${g.barcode}) – ${ls ? `${ls.adresse} · ${ls.mitarbeiter_name} · ${ls.nummer_label} · seit ${tageSeit(ls.erstellt_am) + 1} Tagen` : 'auf Lieferschein'}`, link: ls ? `/lieferscheine/${ls.id}` : '/trocknungsgeraete/auflistung' }
          }), 15),
          link: { label: 'Dashboard öffnen', to: '/trocknungsgeraete/dashboard' },
        }
      }
      const proGruppe = new Map()
      for (const g of liste) {
        const n = d.m.gruppe.get(g.gruppe_id)?.name ?? 'Ohne Gruppe'
        const e = proGruppe.get(n) ?? { frei: 0, einsatz: 0, gesamt: 0 }
        e.gesamt += 1
        if (g.status === 'verfuegbar') e.frei += 1
        if (g.status === 'verliehen') e.einsatz += 1
        proGruppe.set(n, e)
      }
      return {
        text: `${modell.length ? `„${modell[0].name}“ u. ä.: ` : ''}${liste.length} Trocknungsgeräte – ${zaehl('verfuegbar')} verfügbar, ${zaehl('verliehen')} im Einsatz, ${zaehl('defekt') + zaehl('reparatur') + zaehl('verlust')} defekt/Reparatur/Verlust.`,
        liste: [...proGruppe.entries()].sort((a, b) => b[1].gesamt - a[1].gesamt).slice(0, 8).map(([n, e]) => ({ text: `${n}: ${e.gesamt} (${e.frei} frei, ${e.einsatz} im Einsatz)`, link: '/trocknungsgeraete/auflistung' })),
        link: { label: 'Dashboard öffnen', to: '/trocknungsgeraete/dashboard' },
      }
    }

    // ---- Kontakt eines Mitarbeiters -------------------------------------------
    if (/telefon|nummer|handy|mobil|mail|erreich|anrufen/.test(f) && !/lieferschein|baustelle|barcode|seriennummer/.test(f)) {
      if (!darf('benutzer')) return fehltRecht('Benutzer')
      const tokens = inhalt(frage, ['telefonnummer', 'telefon', 'nummer', 'handynummer', 'handy', 'mobil', 'email', 'mail', 'adresse', 'erreiche', 'erreichen', 'anrufen', 'kontakt'])
      const hits = beste(bewerten(tokens, d.mitarbeiter, (x) => `${x.vorname} ${x.nachname} ${x.username}`), 0.99).map((r) => r.item)
      if (!hits.length) return { text: tokens.length ? `Einen Mitarbeiter „${tokens.join(' ')}“ finde ich nicht.` : 'Von wem brauchst du die Nummer? Nenne einen Namen.', nichtVerstanden: !tokens.length }
      return {
        text: hits.length === 1 ? `${mitarbeiterName(hits[0])}: ${[hits[0].mobil && `Mobil ${hits[0].mobil}`, hits[0].email].filter(Boolean).join(' · ') || 'keine Kontaktdaten hinterlegt'}` : `${hits.length} Treffer:`,
        liste: hits.length === 1 ? undefined : EINZELN(hits, 8).map((x) => ({ text: `${mitarbeiterName(x)}: ${[x.mobil, x.email].filter(Boolean).join(' · ') || '–'}`, link: '/benutzer/mitarbeiter' })),
        link: { label: 'Mitarbeiter öffnen', to: '/benutzer/mitarbeiter' },
      }
    }

    // ---- Mitarbeiter: Firma / Position / Anzahl -------------------------------
    const mitFrage = /mitarbeiter|angestellt|eingestellt|beschaeftigt|arbeitet|arbeiten|firma|gehoert zu|position|funktion|personal|belegschaft|wer ist|wer sind|wer arbeitet|ohne firma/.test(f)
    if (mitFrage && !/lieferschein|baustelle|trocknung|geraet|bestand|lager\b|artikel|defekt|barcode|werkzeug/.test(f)) {
      if (!darf('benutzer')) return fehltRecht('Benutzer')
      const firmaName = (x) => d.m.ag.get(x.auftraggeber_id)?.name ?? ''
      const posName = (x) => d.m.pos.get(x.position_id)?.name ?? ''
      const tokens = inhalt(frage, ['mitarbeiter', 'mitarbeiterin', 'mitarbeitern', 'angestellt', 'eingestellt', 'beschaeftigt', 'arbeitet', 'arbeiten', 'firma', 'firmen', 'position', 'funktion', 'gehoert', 'personal', 'belegschaft', 'wer', 'welcher', 'welche', 'welchem', 'als', 'hat', 'hier', 'ohne', 'keine', 'keiner', 'inaktive', 'inaktiv', 'deaktiviert', 'ausgeschieden', 'alle'])
      const ohneFirma = /ohne firma|keine firma|keiner firma|ohne zuordnung/.test(f)
      const ohnePosition = /ohne position|keine position/.test(f)
      const nurInaktiv = /inaktiv|deaktiviert|ausgeschieden|nicht mehr aktiv/.test(f)
      const mitInaktiven = /\balle\b|auch inaktive|inklusive inaktive|insgesamt/.test(f)
      const posNamen = [...new Set(d.mitarbeiter.map(posName).filter(Boolean))]
      const posHits = beste(bewerten(tokens, posNamen.map((n) => ({ n })), (x) => x.n), 0.99).map((r) => r.item.n)
      const firmaHits = beste(bewerten(tokens, d.auftraggeber, (a) => a.name), 0.99).map((r) => r.item)
      const maHits = beste(bewerten(tokens, d.mitarbeiter, (x) => `${x.vorname} ${x.nachname}`), 0.99).map((r) => r.item)
      // Ein einzelnes Wort, das auch eine Firma ist (z. B. „Derewa“), gilt als Firma, nicht als Mitarbeitername.
      const nameGilt = maHits.length > 0 && maHits.length <= 6 && (tokens.length >= 2 || !firmaHits.length) && !(posHits.length && tokens.length === 1)
      const link = { label: 'Mitarbeiter öffnen', to: '/benutzer/mitarbeiter' }
      const mitFirma = d.mitarbeiter.filter((x) => x.auftraggeber_id).length
      const pflegeHinweis = mitFirma < d.mitarbeiter.length / 2 ? ` Hinweis: Nur bei ${mitFirma} von ${d.mitarbeiter.length} Mitarbeitern ist eine Firma hinterlegt – pflege sie im Mitarbeiter-Profil, dann werden die Antworten genauer.` : ''

      // A) Fragen zu einer bestimmten Person
      if (nameGilt) {
        const fragtFirma = /firma|arbeitet|angestellt|eingestellt|beschaeftigt|gehoert/.test(f)
        const fragtPosition = /position|funktion|als was|was ist/.test(f)
        const zeilen = maHits.map((x) => {
          const fi = firmaName(x)
          const po = posName(x)
          const status = x.aktiv ? 'aktiv' : 'inaktiv'
          if (fragtFirma && !fragtPosition) return { text: `${mitarbeiterName(x)}: ${fi ? `arbeitet bei ${fi}` : 'keine Firma hinterlegt'}${po ? ` (Position ${po})` : ''}${x.aktiv ? '' : ' – inaktiv'}`, link: '/benutzer/mitarbeiter' }
          if (fragtPosition && !fragtFirma) return { text: `${mitarbeiterName(x)}: ${po ? `Position ${po}` : 'keine Position hinterlegt'}${fi ? ` bei ${fi}` : ''}`, link: '/benutzer/mitarbeiter' }
          return { text: `${mitarbeiterName(x)} – ${[po && `Position ${po}`, fi && `Firma ${fi}`, status, x.mobil && `Mobil ${x.mobil}`, x.email].filter(Boolean).join(' · ')}`, link: '/benutzer/mitarbeiter' }
        })
        if (zeilen.length === 1) return { text: zeilen[0].text + (fragtFirma && !firmaName(maHits[0]) ? pflegeHinweis : ''), link }
        return { text: `${plural(zeilen.length, 'Treffer', 'Treffer')}:`, liste: zeilen, link }
      }

      // B) Fragen zu einer Firma (und/oder Position, ohne Firma, ohne Position)
      if (firmaHits.length || ohneFirma || ohnePosition) {
        let liste = d.mitarbeiter
        if (nurInaktiv) liste = liste.filter((x) => !x.aktiv)
        else if (!mitInaktiven) liste = liste.filter((x) => x.aktiv)
        const filter = []
        if (ohneFirma) { liste = liste.filter((x) => !x.auftraggeber_id); filter.push('ohne Firma') }
        else if (firmaHits.length) {
          const ids = new Set(firmaHits.map((a) => a.id))
          liste = liste.filter((x) => ids.has(x.auftraggeber_id))
          filter.push(firmaHits.length === 1 ? firmaHits[0].name : `Firma ${firmaHits[0].name.split(' ')[0]}`)
        }
        if (ohnePosition) { liste = liste.filter((x) => !x.position_id); filter.push('ohne Position') }
        else if (posHits.length) { liste = liste.filter((x) => posHits.includes(posName(x))); filter.push(posHits.join(' / ')) }
        const status = nurInaktiv ? 'inaktive' : mitInaktiven ? '' : 'aktive'
        const adjektiv = status && liste.length === 1 ? `${status.slice(0, -1)}r ` : status ? `${status} ` : ''
        const kopf = `${liste.length} ${adjektiv}Mitarbeiter${filter.length ? ` – ${filter.join(', ')}` : ''}`
        if (!liste.length) return { text: `${kopf}: keine gefunden.${firmaHits.length ? pflegeHinweis : ''}`, link }
        const proFirma = new Map()
        const proPosition = new Map()
        for (const x of liste) {
          proFirma.set(firmaName(x) || 'ohne Firma', (proFirma.get(firmaName(x) || 'ohne Firma') ?? 0) + 1)
          proPosition.set(posName(x) || 'ohne Position', (proPosition.get(posName(x) || 'ohne Position') ?? 0) + 1)
        }
        const teile = []
        if (proFirma.size > 1) teile.push('Nach Firma: ' + [...proFirma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n} ${c}`).join(', '))
        if (proPosition.size > 1) teile.push('Nach Position: ' + [...proPosition.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n} ${c}`).join(', '))
        const nurAnzahl = /wie viele|anzahl/.test(f) && !/zeig|liste|wer\b/.test(f)
        return {
          text: `${kopf}${teile.length ? '. ' + teile.join('. ') : ''}.${nurAnzahl ? '' : liste.length > 15 ? ' (die ersten 15:)' : ''}`,
          liste: nurAnzahl ? undefined : EINZELN(liste, 15).map((x) => ({ text: `${mitarbeiterName(x)}${posName(x) ? ` · ${posName(x)}` : ''}${proFirma.size > 1 && firmaName(x) ? ` · ${firmaName(x)}` : ''}`, link: '/benutzer/mitarbeiter' })),
          link,
        }
      }

      // C) nur eine Position gefragt
      if (posHits.length) {
        const basis = nurInaktiv ? d.mitarbeiter.filter((x) => !x.aktiv) : mitInaktiven ? d.mitarbeiter : d.mitarbeiter.filter((x) => x.aktiv)
        const liste = basis.filter((x) => posHits.includes(posName(x)))
        const nurAnzahl = /wie viele|anzahl/.test(f) && !/zeig|liste|wer\b/.test(f)
        return {
          text: `${plural(liste.length, nurInaktiv ? 'inaktiver Mitarbeiter ist' : 'aktiver Mitarbeiter ist', nurInaktiv ? 'inaktive Mitarbeiter sind' : 'aktive Mitarbeiter sind')} ${posHits.join(' / ')}${nurAnzahl ? '.' : ':'}`,
          liste: nurAnzahl ? undefined : EINZELN(liste, 15).map((x) => ({ text: `${mitarbeiterName(x)}${firmaName(x) ? ` · ${firmaName(x)}` : ''}${x.mobil ? ` · ${x.mobil}` : ''}`, link: '/benutzer/mitarbeiter' })),
          link,
        }
      }

      // D) Überblick
      const aktive = d.mitarbeiter.filter((x) => x.aktiv)
      const proPosition = new Map()
      for (const x of aktive) proPosition.set(posName(x) || 'Ohne Position', (proPosition.get(posName(x) || 'Ohne Position') ?? 0) + 1)
      const proFirma = new Map()
      for (const x of aktive.filter((y) => y.auftraggeber_id)) proFirma.set(firmaName(x), (proFirma.get(firmaName(x)) ?? 0) + 1)
      return {
        text: `Es gibt ${d.mitarbeiter.length} Mitarbeiter, davon ${aktive.length} aktiv.${proFirma.size ? '' : pflegeHinweis}`,
        liste: [
          ...[...proPosition.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ text: `${n}: ${c}` })),
          ...[...proFirma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => ({ text: `Firma ${n}: ${c}` })),
        ],
        link,
      }
    }

    // ---- Lieferscheine --------------------------------------------------------
    if (/lieferschein/.test(f)) {
      if (!darf('lieferscheine')) return fehltRecht('Lieferscheine')
      const zeit = zeitraumAus(frage)
      const tokens = inhalt(frage, ['kontrolliert'])
      let liste = d.lieferscheine
      const filter = []
      // Mitarbeiter ODER Auftraggeber ODER Baustelle (Ort/Straße) aus den Wörtern bestimmen
      const maHits = beste(bewerten(tokens, d.mitarbeiter, (x) => `${x.vorname} ${x.nachname}`), 0.99).map((r) => r.item)
      const agHits = beste(bewerten(tokens, d.auftraggeber, (x) => x.name), 0.99).map((r) => r.item)
      const baustellenHits = beste(bewerten(tokens, d.baustellen, (b) => `${d.adresse(b)} ${b.projekt_nr ?? ''}`), 0.99).map((r) => r.item)
      if (agHits.length && (!maHits.length || agHits.length >= maHits.length)) {
        const ids = new Set(agHits.map((a) => a.id))
        liste = liste.filter((l) => ids.has(l.auftraggeber_id))
        filter.push(`Auftraggeber ${agHits.length === 1 ? agHits[0].name : agHits[0].name.split(' ')[0]}`)
      } else if (maHits.length) {
        const ids = new Set(maHits.map((x) => x.id))
        liste = liste.filter((l) => ids.has(l.mitarbeiter_id))
        filter.push(`Mitarbeiter ${maHits.length === 1 ? mitarbeiterName(maHits[0]) : maHits.map((x) => x.nachname).join('/')}`)
      } else if (baustellenHits.length) {
        const ids = new Set(baustellenHits.map((b) => b.id))
        liste = liste.filter((l) => ids.has(l.baustelle_id))
        filter.push(`Baustelle ${d.adresse(baustellenHits[0])}`)
      } else if (tokens.length) {
        return { text: `Zu „${tokens.join(' ')}“ finde ich weder einen Mitarbeiter, Auftraggeber noch eine Baustelle.`, nichtVerstanden: true }
      }
      if (/abgeschlossen|fertig|erledigt/.test(f)) { liste = liste.filter((l) => l.status === 'abgeschlossen'); filter.push('abgeschlossen') }
      else if (/\boffen|offene|laufend|aktuell/.test(f)) { liste = liste.filter((l) => l.status === 'offen'); filter.push('offen') }
      if (/unkontrolliert|nicht kontrolliert|ohne kontrolle|kontrolle fehlt/.test(f)) { liste = liste.filter((l) => !l.kontrolliert); filter.push('nicht kontrolliert') }
      if (/ueberfaellig|zu lange|lange draussen|nicht zurueck|noch draussen/.test(f)) {
        liste = liste.filter((l) => l.status === 'offen' && l.positionen.some((p) => p.art !== 'verbrauch' && !p.zurueck_am))
        if (/ueberfaellig|zu lange/.test(f)) liste = liste.filter((l) => tageSeit(l.erstellt_am) > 14)
        filter.push('mit Stücken draußen')
      }
      if (zeit) { liste = liste.filter((l) => l.erstellt_am && l.erstellt_am.slice(0, 10) >= zeit.von && l.erstellt_am.slice(0, 10) <= zeit.bis); filter.push(zeit.label) }
      liste = [...liste].sort((a, b) => String(b.erstellt_am).localeCompare(String(a.erstellt_am)))
      if (/wie viele|anzahl/.test(f) && !/zeig/.test(f)) {
        return { text: `${plural(liste.length, 'Lieferschein', 'Lieferscheine')}${filter.length ? ` (${filter.join(', ')})` : ''}, zusammen ${formatEuro(liste.reduce((s, l) => s + l.summe.gesamt, 0))}.`, link: { label: 'Lieferscheine öffnen', to: '/lieferscheine/uebersicht' } }
      }
      if (!liste.length) return { text: `Keine Lieferscheine gefunden${filter.length ? ` (${filter.join(', ')})` : ''}.` }
      return {
        text: `${plural(liste.length, 'Lieferschein', 'Lieferscheine')}${filter.length ? ` – ${filter.join(', ')}` : ''}, zusammen ${formatEuro(liste.reduce((s, l) => s + l.summe.gesamt, 0))}${liste.length > 10 ? ' (die neuesten 10):' : ':'}`,
        liste: EINZELN(liste, 10).map(lsEintrag),
        link: { label: 'Alle Lieferscheine', to: '/lieferscheine/uebersicht' },
      }
    }

    // ---- Baustellen -----------------------------------------------------------
    if (/baustelle|projekt/.test(f)) {
      if (!darf('baustellen')) return fehltRecht('Baustellen')
      const tokens = inhalt(frage, ['projekt', 'projekte', 'projektnummer'])
      const agHits = beste(bewerten(tokens, d.auftraggeber, (a) => a.name), 0.99).map((r) => r.item)
      let liste = d.baustellen
      const filter = []
      if (agHits.length) {
        const ids = new Set(agHits.map((a) => a.id))
        liste = liste.filter((b) => ids.has(b.auftraggeber_id))
        filter.push(`Auftraggeber ${agHits.length === 1 ? agHits[0].name : agHits[0].name.split(' ')[0]}`)
      } else if (tokens.length) {
        const orte = beste(bewerten(tokens, d.baustellen, (b) => `${d.adresse(b)} ${b.projekt_nr ?? ''}`), 0.99).map((r) => r.item)
        if (orte.length) {
          const ids = new Set(orte.map((b) => b.id))
          liste = liste.filter((b) => ids.has(b.id))
          filter.push(`„${tokens.join(' ')}“`)
        } else {
          return { text: `Zu „${tokens.join(' ')}“ finde ich keine Baustelle oder keinen Auftraggeber.`, nichtVerstanden: true }
        }
      }
      const abgeschlossen = /abgeschlossen|fertig|beendet|erledigt/.test(f)
      const nurOffen = /\boffen|offene|laufend|aktiv|aktuell|noch/.test(f) && !abgeschlossen
      if (abgeschlossen) liste = liste.filter((b) => b.status === 'abgeschlossen')
      else if (nurOffen) liste = liste.filter((b) => b.status !== 'abgeschlossen')
      const offeneLs = (b) => d.lieferscheine.filter((l) => l.baustelle_id === b.id && l.status === 'offen').length
      const sortiert = [...liste].sort((a, b) => String(b.start_datum ?? '').localeCompare(String(a.start_datum ?? '')))
      const status = abgeschlossen ? 'abgeschlossen' : nurOffen ? 'offen' : null
      if (/wie viele|anzahl/.test(f)) {
        return { text: `${plural(liste.length, 'Baustelle', 'Baustellen')}${status ? ` ${status}` : ''}${filter.length ? ` (${filter.join(', ')})` : ''}${!status ? `, davon ${liste.filter((b) => b.status !== 'abgeschlossen').length} offen` : ''}.`, link: { label: 'Baustellen öffnen', to: '/baustellen' } }
      }
      if (!liste.length) return { text: `Keine${status ? ` ${status}en` : ''} Baustellen gefunden${filter.length ? ` (${filter.join(', ')})` : ''}.` }
      return {
        text: `${plural(liste.length, 'Baustelle ist', 'Baustellen sind')}${status ? ` ${status}` : ''}${filter.length ? ` – ${filter.join(', ')}` : ''}${liste.length > 12 ? ' (die ersten 12):' : ':'}`,
        liste: EINZELN(sortiert, 12).map((b) => {
          const ag = d.m.ag.get(b.auftraggeber_id)?.name
          const n = offeneLs(b)
          return { text: `${d.adresse(b)}${ag ? ` · ${ag}` : ''}${b.projekt_nr ? ` · Proj. ${b.projekt_nr}` : ''}${b.start_datum ? ` · seit ${datumDE(b.start_datum)}` : ''} · ${b.status === 'abgeschlossen' ? 'abgeschlossen' : 'offen'}${n ? ` · ${plural(n, 'offener Lieferschein', 'offene Lieferscheine')}` : ''}`, link: '/baustellen' }
        }),
        link: { label: 'Baustellen öffnen', to: '/baustellen' },
      }
    }

    // ---- Bestand eines Artikels -------------------------------------------------
    if (/wie viel|wieviel|wie viele|bestand|auf lager|vorraet|haben wir|vorhanden|lagernd/.test(f)) {
      if (!darf('artikel')) return fehltRecht('Artikel')
      const tokens = inhalt(frage)
      if (!tokens.length) {
        const summe = new Map()
        for (const v of d.verbrauch) summe.set(v.artikel_id, (summe.get(v.artikel_id) ?? 0) + Number(v.menge))
        const niedrig = d.artikel.filter((a) => a.aktiv && a.typ === 'verbrauchsmaterial').map((a) => ({ a, menge: summe.get(a.id) ?? 0 })).sort((x, y) => x.menge - y.menge).slice(0, 8)
        return { text: 'Nenne einen Artikel, z. B. „Wie viel Müllsack haben wir?“. Das sind aktuell die Artikel mit dem niedrigsten Bestand:', liste: niedrig.map((x) => ({ text: `${x.a.name}: ${formatMenge(x.menge)} ${unitOf(x.a)}`, link: '/artikel/bestand' })) }
      }
      const aktive = d.artikel.filter((a) => a.aktiv)
      const einheit = einheitAusFrage(f)
      const bewertet = bewerten(tokens, aktive, (a) => `${a.name} ${a.barcode ?? ''}`)
      let hits = beste(bewertet, 0.99).map((r) => r.item)
      if (hits.length > 1 && einheit) {
        const passend = hits.filter((a) => einheitPasst(a, einheit))
        if (passend.length) hits = passend
      }
      if (hits.length) return antwortBestand(d, hits, darf, fehltRecht)
      const aehnlich = aehnlicheArtikel(tokens, einheit, aktive)
      if (!aehnlich.length) return { text: `Einen Artikel „${tokens.join(' ')}“ finde ich nicht im Katalog.`, nichtVerstanden: true }
      const antwort = antwortBestand(d, aehnlich, darf, fehltRecht)
      return { ...antwort, text: `Einen Artikel „${tokens.join(' ').toUpperCase()}“ gibt es nicht genau so. Das Ähnlichste:` }
    }

    // ---- Letzter Versuch: Navigation ohne „öffne“, sonst Namenssuche ---------
    const ziel = NAVIGATION.find(([r]) => r.test(f))
    if (ziel && f.split(' ').length <= 3) return { text: `Meinst du ${ziel[2]}?`, link: { label: `${ziel[2]} öffnen`, to: ziel[1] } }

    const tokens = inhalt(frage)
    if (tokens.length) {
      const sammel = []
      if (darf('benutzer')) for (const r of beste(bewerten(tokens, d.mitarbeiter, (x) => `${x.vorname} ${x.nachname}`), 0.99).slice(0, 3)) sammel.push({ text: `Lieferscheine von ${mitarbeiterName(r.item)}`, frage: `Lieferscheine von ${mitarbeiterName(r.item)}` })
      if (darf('baustellen')) for (const r of beste(bewerten(tokens, d.auftraggeber, (x) => x.name), 0.99).slice(0, 3)) sammel.push({ text: `Offene Baustellen von ${r.item.name}`, frage: `Welche Baustellen sind von ${r.item.name} offen?` })
      if (darf('artikel')) for (const r of beste(bewerten(tokens, d.artikel.filter((a) => a.aktiv), (x) => x.name), 0.99).slice(0, 3)) sammel.push({ text: `Bestand von ${r.item.name}`, frage: `Wie viel ${r.item.name} haben wir auf Lager?` })
      if (sammel.length) return { text: 'Was möchtest du dazu wissen?', liste: sammel }
    }
  } catch (error) {
    return { text: error.message || 'Da ist etwas schiefgelaufen.' }
  }
  if (vielleicht) return { text: `Meintest du „${vielleicht.ausloeser}“?`, liste: [{ text: `Ja: ${vielleicht.ausloeser}`, frage: vielleicht.ausloeser }], nichtVerstanden: true }
  return { text: 'Das habe ich noch nicht gelernt. Bring es mir bei – oder probier zum Beispiel:', liste: BEISPIELE.slice(0, 4).map((b) => ({ text: b, frage: b })), nichtVerstanden: true }
}

function statusText(s) {
  return { verfuegbar: 'verfügbar', verliehen: 'verliehen/im Einsatz', defekt: 'defekt', reparatur: 'in Reparatur', verlust: 'verloren', entsorgt: 'entsorgt' }[s] ?? s
}

/** Bestandsauskunft für eine Liste von Artikeln (Verbrauch: Mengen je Lager, Werkzeug: Stückzahlen je Status). */
function antwortBestand(d, artikelListe, darf, fehltRecht) {
  if (!darf('artikel')) return fehltRecht('Artikel')
  const zeilen = []
  for (const a of artikelListe.slice(0, 8)) {
    if (a.typ === 'verbrauchsmaterial') {
      const rows = d.verbrauch.filter((v) => v.artikel_id === a.id)
      const gesamt = rows.reduce((s, v) => s + Number(v.menge), 0)
      const proLager = rows.filter((v) => Number(v.menge) !== 0).map((v) => `${formatMenge(v.menge)} in ${d.m.lager.get(v.lager_id)?.bezeichnung ?? '?'}`)
      zeilen.push({ text: `${a.name}: ${formatMenge(gesamt)} ${unitOf(a)}${proLager.length > 1 ? ` (${proLager.join(', ')})` : proLager.length === 1 ? ` (${d.m.lager.get(rows.find((v) => Number(v.menge) !== 0).lager_id)?.bezeichnung ?? ''})` : ''}${Number(a.meldebestand) > 0 && gesamt <= Number(a.meldebestand) ? ' ⚠️ unter Meldebestand' : ''}`, link: '/artikel/bestand' })
    } else {
      const st = d.stuecke.filter((s) => s.artikel_id === a.id)
      const n = (s) => st.filter((x) => x.status === s).length
      zeilen.push({ text: `${a.name}: ${st.length} Stück – ${n('verfuegbar')} verfügbar, ${n('verliehen')} verliehen${n('defekt') + n('reparatur') ? `, ${n('defekt') + n('reparatur')} defekt/Reparatur` : ''}${n('verlust') ? `, ${n('verlust')} verloren` : ''}`, link: '/artikel/bestand' })
    }
  }
  if (zeilen.length === 1) {
    return { text: zeilen[0].text + '.', link: { label: 'Bestand öffnen', to: '/artikel/bestand' } }
  }
  return { text: `${plural(artikelListe.length, 'Artikel passt', 'Artikel passen')} zu deiner Frage:`, liste: zeilen, link: { label: 'Bestand öffnen', to: '/artikel/bestand' } }
}
