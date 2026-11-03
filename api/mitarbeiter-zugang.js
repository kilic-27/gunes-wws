// Vercel-Serverfunktion für die Logins der Mitarbeiter (einrichten, sperren, entsperren, entfernen).
// Läuft serverseitig, weil dafür der geheime service_role-Schlüssel nötig ist (niemals im Browser).
// Benötigte Umgebungsvariablen in Vercel: WWS_SUPABASE_SECRET_KEY (Secret key aus Supabase; alternativ SUPABASE_SERVICE_ROLE_KEY) und SUPABASE_URL.
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
// Eigene Variable bevorzugt: die von der Supabase-Verbindung verwalteten Einträge können leer oder veraltet sein.
const SERVICE_KEY = process.env.WWS_SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
// Der Anon-Schlüssel ist nur Beiwerk (apikey-Header); fehlt er, genügt der Secret key zusammen mit dem Token des Aufrufers.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SERVICE_KEY

// Ohne leicht verwechselbare Zeichen (0/O, 1/l/I), damit das Passwort auch abgetippt werden kann.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
function generatePassword(length = 10) {
  let password = ''
  for (let i = 0; i < length; i++) password += ALPHABET[randomInt(ALPHABET.length)]
  return password
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value ?? '').trim())
const authOptions = { auth: { persistSession: false, autoRefreshToken: false } }
const BAN_FOREVER = '876000h'

async function findUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 1000) break
  }
  return null
}

export default async function handler(req, res) {
  // version: welche Server-Version geantwortet hat (hilft bei der Fehlersuche, wenn mehrere Adressen/Deployments existieren)
  const version = (process.env.VERCEL_GIT_COMMIT_SHA || 'lokal').slice(0, 7)
  const fail = (status, error, code) => res.status(status).json({ error, code, version })

  if (req.method !== 'POST') return fail(405, 'Nur POST erlaubt')
  const fehlend = [!SUPABASE_URL && 'SUPABASE_URL', !SERVICE_KEY && 'WWS_SUPABASE_SECRET_KEY (SUPABASE_SERVICE_ROLE_KEY ist leer oder fehlt)'].filter(Boolean)
  if (fehlend.length) {
    return fail(500, `Der Server ist noch nicht eingerichtet. In Vercel fehlt (für die Umgebung Production): ${fehlend.join(', ')}`, 'not_configured')
  }

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'Nicht angemeldet')

  // Wer ruft auf, und darf er Zugänge verwalten? (Recht "Benutzer: voll")
  const caller = createClient(SUPABASE_URL, ANON_KEY, { ...authOptions, global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: callerData, error: callerError } = await caller.auth.getUser(token)
  if (callerError || !callerData?.user) return fail(401, 'Nicht angemeldet')
  const { data: erlaubt, error: rightError } = await caller.rpc('user_has_right', { p_bereich: 'benutzer', p_min_level: 'voll' })
  if (rightError || erlaubt !== true) return fail(403, 'Keine Berechtigung, Zugänge zu verwalten.')

  const { action = 'einrichten', mitarbeiter_id: mitarbeiterId, auth_user_id: authUserId } = req.body ?? {}
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, authOptions)

  try {
    // Login entfernen, nachdem der Mitarbeiter gelöscht wurde. Nur Logins, die über die App angelegt wurden,
    // und nur, wenn kein Mitarbeiter mehr darauf verweist.
    if (action === 'entfernen') {
      if (!authUserId) return fail(400, 'Login fehlt')
      if (authUserId === callerData.user.id) return fail(400, 'Der eigene Login kann nicht entfernt werden.')
      const { data: still } = await admin.from('mitarbeiter').select('id').eq('auth_user_id', authUserId).limit(1)
      if (still?.length) return fail(409, 'Der Login gehört noch zu einem Mitarbeiter.')
      const { data: found } = await admin.auth.admin.getUserById(authUserId)
      if (!found?.user) return res.status(200).json({ ok: true })
      if (found.user.user_metadata?.app_mitarbeiter !== true) return fail(403, 'Dieser Login wurde nicht über die App angelegt.')
      const { error } = await admin.auth.admin.deleteUser(authUserId)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    if (!mitarbeiterId) return fail(400, 'Mitarbeiter fehlt')
    const { data: m, error: mError } = await admin.from('mitarbeiter').select('*').eq('id', mitarbeiterId).maybeSingle()
    if (mError || !m) return fail(404, 'Mitarbeiter nicht gefunden')

    // Login sperren (Mitarbeiter deaktiviert) bzw. wieder freigeben
    if (action === 'sperren' || action === 'entsperren') {
      if (!m.auth_user_id) return res.status(200).json({ ok: true, ohneZugang: true })
      if (m.auth_user_id === callerData.user.id) return fail(400, 'Der eigene Login kann nicht gesperrt werden.', 'self')
      const { error } = await admin.auth.admin.updateUserById(m.auth_user_id, { ban_duration: action === 'sperren' ? BAN_FOREVER : 'none' })
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    if (action !== 'einrichten') return fail(400, 'Unbekannte Aktion')

    const fehlt = []
    if (!isEmail(m.email)) fehlt.push('E-Mail')
    if (!(m.mobil ?? '').trim()) fehlt.push('Telefonnummer')
    if (!m.position_id) fehlt.push('Position')
    if (fehlt.length) return fail(400, `Es fehlt: ${fehlt.join(', ')}`, 'missing')
    if (m.aktiv === false) return fail(400, 'Der Mitarbeiter ist deaktiviert.', 'inactive')

    const email = m.email.trim().toLowerCase()
    if (email === (callerData.user.email ?? '').toLowerCase()) {
      return fail(400, 'Das eigene Passwort bitte über das Benutzermenü ändern.', 'self')
    }

    // Login anlegen oder Passwort neu vergeben
    const password = generatePassword()
    const attributes = { password, email_confirm: true, user_metadata: { must_change_password: true, app_mitarbeiter: true } }
    let userId = m.auth_user_id
    let neu = false

    if (userId) {
      const { error } = await admin.auth.admin.updateUserById(userId, { ...attributes, email })
      if (error) {
        if (!/not found/i.test(error.message)) throw error
        userId = null // Login wurde inzwischen gelöscht -> neu anlegen
      }
    }

    if (!userId) {
      const bestehend = await findUserByEmail(admin, email)
      if (bestehend) {
        // Ein Login mit dieser E-Mail gibt es schon, aber nicht über die App angelegt (z. B. der Inhaber): nichts überschreiben.
        return fail(409, 'Für diese E-Mail gibt es bereits einen Zugang, der nicht über die App angelegt wurde.', 'exists')
      }
      const { data, error } = await admin.auth.admin.createUser({ email, ...attributes })
      if (error) throw error
      userId = data.user.id
      neu = true
    }

    const { error: saveError } = await admin
      .from('mitarbeiter')
      .update({ auth_user_id: userId, zugang_eingerichtet_am: new Date().toISOString(), app_zugang: true })
      .eq('id', m.id)
    if (saveError) throw saveError

    return res.status(200).json({ email, password, neu })
  } catch (error) {
    return fail(500, error?.message || 'Aktion fehlgeschlagen.')
  }
}
