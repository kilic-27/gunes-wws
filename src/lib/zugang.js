import { supabase } from './supabaseClient.js'
import { isEmail } from './versand.js'

/** Was fehlt noch, damit für den Mitarbeiter ein Zugang eingerichtet werden kann? (Schlüssel für i18n: zugang.fehlt_*) */
export function fehlendeVoraussetzungen(mitarbeiter) {
  const fehlt = []
  if (!isEmail(mitarbeiter.email)) fehlt.push('email')
  if (!(mitarbeiter.mobil ?? '').trim()) fehlt.push('mobil')
  if (!mitarbeiter.position_id) fehlt.push('position')
  if (mitarbeiter.aktiv === false) fehlt.push('aktiv')
  return fehlt
}

/** Ruft die Serverfunktion api/mitarbeiter-zugang auf. Wirft einen Fehler mit .code. */
async function aufruf(payload) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  let response
  try {
    response = await fetch('/api/mitarbeiter-zugang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
  } catch {
    throw Object.assign(new Error('network'), { code: 'network' })
  }
  let body = null
  try {
    body = await response.json()
  } catch {
    // keine JSON-Antwort: die Funktion läuft hier nicht (z. B. lokal mit npm run dev)
    throw Object.assign(new Error('not_available'), { code: 'not_available' })
  }
  if (!response.ok) throw Object.assign(new Error(body?.error || 'Fehler'), { code: body?.code ?? 'error', version: body?.version, status: response.status, detail: body?.detail })
  return body
}

/**
 * Legt den Login an bzw. vergibt ein neues Passwort. Liefert { email, password, neu }.
 * Das Passwort steht nur in dieser Antwort und wird nirgends gespeichert.
 */
// mail: { subject, text } -> die Serverfunktion schickt die E-Mail direkt (im Text steht __PASSWORT__ als Platzhalter)
// passwort (optional): vom Verwalter festgelegtes vorläufiges Passwort statt eines erzeugten
export const zugangEinrichten = (mitarbeiterId, mail, passwort) => aufruf({ action: 'einrichten', mitarbeiter_id: mitarbeiterId, mail, passwort })

/** Login sperren (Mitarbeiter deaktiviert) bzw. wieder freigeben. */
export const zugangSperren = (mitarbeiterId, sperren) => aufruf({ action: sperren ? 'sperren' : 'entsperren', mitarbeiter_id: mitarbeiterId })

/** Login entfernen, nachdem der Mitarbeiter gelöscht wurde. */
export const zugangEntfernen = (authUserId) => aufruf({ action: 'entfernen', auth_user_id: authUserId })
