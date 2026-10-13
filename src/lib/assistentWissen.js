// Gedächtnis des Assistenten: selbst beigebrachte Antworten und Formulierungen.
// Vergleich unscharf: Groß/klein, Umlaute, Satzzeichen, Füllwörter und kleine Tippfehler egal.

import { supabase } from './supabaseClient.js'

export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const FUELLWOERTER = new Set(['wie', 'was', 'wer', 'wo', 'wann', 'ist', 'sind', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'ich', 'mir', 'mich', 'du', 'mal', 'bitte', 'eigentlich', 'denn', 'noch', 'gerade', 'jetzt', 'zeig', 'zeige', 'sag', 'sage', 'kannst', 'mein', 'meine', 'meinen', 'unser', 'unsere', 'es', 'gibt', 'hab', 'habe', 'haben', 'hast', 'hat', 'und', 'oder', 'zu', 'im', 'in', 'am', 'an', 'auf', 'fuer', 'mit', 'von', 'vom', 'bei', 'so', 'ja', 'nein', 'auch', 'wir', 'uns'])

export function normalisieren(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9€%\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function woerter(text) {
  return normalisieren(text)
    .split(' ')
    .filter((w) => w && !FUELLWOERTER.has(w))
}

export function abstand(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

/** Zwei (normalisierte) Wörter gelten als gleich: identisch, gleicher Wortanfang (Rechnung/Rechnungen) oder 1 Tippfehler. */
export function wortPasst(a, b) {
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true
  return a.length >= 5 && b.length >= 5 && abstand(a, b) <= 1
}

/** Ähnlichkeit 0…1 zwischen Frage und gelernter Formulierung. */
export function aehnlichkeit(frage, ausloeser) {
  const nf = normalisieren(frage)
  const na = normalisieren(ausloeser)
  if (!nf || !na) return 0
  if (nf === na) return 1
  const a = woerter(frage)
  const b = woerter(ausloeser)
  if (!a.length || !b.length) return 0
  const treffer = b.filter((w) => a.some((x) => wortPasst(x, w))).length
  const abdeckung = treffer / b.length
  const umgekehrt = a.filter((w) => b.some((x) => wortPasst(x, w))).length / a.length
  return Math.max(abdeckung * 0.85 + umgekehrt * 0.15, nf.includes(na) && na.length >= 4 ? 0.9 : 0)
}

let zwischenspeicher = null

export async function wissenLaden(neu = false) {
  if (zwischenspeicher && !neu) return zwischenspeicher
  const { data, error } = await supabase.from('assistent_wissen').select('*').order('erstellt_am')
  zwischenspeicher = error ? [] : (data ?? [])
  return zwischenspeicher
}

/** Bester gelernter Eintrag zur Frage. */
export function wissenSuchen(frage, liste) {
  let bester = null
  for (const e of liste) {
    for (const a of e.ausloeser) {
      const s = aehnlichkeit(frage, a)
      if (!bester || s > bester.score) bester = { eintrag: e, score: s, ausloeser: a }
    }
  }
  return bester
}

export async function benutztMerken(eintrag) {
  await supabase
    .from('assistent_wissen')
    .update({ benutzt: (eintrag.benutzt ?? 0) + 1, zuletzt_benutzt: new Date().toISOString() })
    .eq('id', eintrag.id)
}

/** Zeitangaben aus einer Frage, damit eine Umleitung den Zeitraum behält. */
export function zeitWoerter(frage) {
  const f = frage.toLowerCase()
  const muster = [
    /\bheute\b/,
    /\bgestern\b/,
    /(letzte[nr]?|diese[rn]?|aktuelle[rn]?|nächste[nr]?|naechste[nr]?) (woche|monat|jahr)/,
    /\bvorjahr\b|\bvormonat\b/,
    /\d\.?\s*quartal|q[1-4]\b/,
    /\b20\d{2}\b/,
    /dieses jahr|bisher|insgesamt/,
    new RegExp(`\\b(${MONATE.map((m) => m.toLowerCase()).join('|')}|maerz)\\b`),
  ]
  return muster
    .map((m) => m.exec(f)?.[0])
    .filter(Boolean)
    .join(' ')
}

export async function lernen({ art, ausloeser, antwort = '', ziel_frage = '', link = '' }) {
  const liste = [...new Set((Array.isArray(ausloeser) ? ausloeser : [ausloeser]).map((a) => a.trim()).filter(Boolean))]
  if (!liste.length) return { error: 'Bitte angeben, auf welche Frage er reagieren soll.' }
  // Gibt es die Formulierung schon? Dann ersetzen statt doppelt speichern.
  const vorhanden = (await wissenLaden(true)).find((e) => e.ausloeser.some((a) => liste.some((l) => normalisieren(a) === normalisieren(l))))
  const daten = {
    art,
    ausloeser: vorhanden ? [...new Set([...vorhanden.ausloeser, ...liste])] : liste,
    antwort: art === 'antwort' ? antwort.trim() : '',
    ziel_frage: art === 'umleitung' ? ziel_frage.trim() : '',
    link,
  }
  const { error } = vorhanden
    ? await supabase.from('assistent_wissen').update(daten).eq('id', vorhanden.id)
    : await supabase.from('assistent_wissen').insert(daten)
  await wissenLaden(true)
  return error ? { error: error.message } : { ersetzt: Boolean(vorhanden) }
}

export async function vergessen(id) {
  const { error } = await supabase.from('assistent_wissen').delete().eq('id', id)
  await wissenLaden(true)
  return error ? { error: error.message } : {}
}

/** „Merk dir: X ist Y“ / „Vergiss X“ im Chat erkennen. */
export function merkBefehl(frage) {
  const gleich = /^\s*(?:merk(?:e)?\s*dir|lerne?)\s*:?\s*[„"]?(.+?)[“"]?\s+(?:heißt|heisst|bedeutet|meint|ist dasselbe wie|ist das gleiche wie)\s+[„"]?(.+?)[“"]?\s*$/i.exec(frage)
  if (gleich && /\?\s*$|^(wie|was|wer|wo|wann|welche[rsn]?|zeig|öffne|oeffne|baustellen|lieferscheine|bestand)\b/i.test(gleich[2].trim())) {
    return { art: 'umleitung', ausloeser: gleich[1], ziel: gleich[2] }
  }
  const merk = /^\s*(?:merk(?:e)?\s*dir|lerne?|speicher(?:e)?|notier(?:e)?)\s*:?\s*(.+?)\s+(?:ist|sind|=|bedeutet|heißt|heisst|lautet|lauten|kostet|kosten)\s+(.+)$/i.exec(frage)
  if (merk) {
    return {
      art: 'merken',
      thema: merk[1].replace(/^(dass|die|der|das|unsere?|meine?)\s+/i, '').trim(),
      antwort: merk[0].replace(/^\s*(?:merk(?:e)?\s*dir|lerne?|speicher(?:e)?|notier(?:e)?)\s*:?\s*/i, '').trim(),
    }
  }
  const vergiss = /^\s*vergiss\s+(.+)$/i.exec(frage)
  if (vergiss) return { art: 'vergessen', thema: vergiss[1].trim() }
  // Ohne erkennbares Verb („Merk dir: Lager Köln öffnet um 7 Uhr“): die ersten zwei Wörter sind das Thema
  const locker = /^\s*(?:merk(?:e)?\s*dir|lerne?|speicher(?:e)?|notier(?:e)?)\s*:\s*(.+)$/i.exec(frage)
  if (locker) {
    const text = locker[1].trim()
    const ws = text.split(/\s+/)
    if (ws.length >= 3) return { art: 'merken', thema: ws.slice(0, 2).join(' '), antwort: text }
  }
  return null
}
