// Vercel-Serverfunktion "Passwort vergessen": verschickt den Link zum Zurücksetzen über unseren eigenen Mail-Dienst
// (Brevo/Resend) statt über das eingeschränkte Standard-Mailsystem von Supabase.
// Öffentlich aufrufbar (der Mitarbeiter ist ja nicht angemeldet) und verrät nie, ob die E-Mail-Adresse existiert.
import { createClient } from '@supabase/supabase-js'
import { sendMail } from './_lib/mail.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.WWS_SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
// Hierhin führt der Link nach dem Klick (muss in Supabase unter Authentication > URL Configuration erlaubt sein).
const APP_URL = process.env.APP_URL || 'https://gunes-wws.vercel.app'

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value ?? '').trim())

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST erlaubt' })
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ ok: false, code: 'nicht_eingerichtet' })

  const email = String(req.body?.email ?? '').trim().toLowerCase()
  if (!isEmail(email)) return res.status(400).json({ ok: false, code: 'ungueltig' })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    // Nur für Logins, die zu einem aktiven Mitarbeiter gehören.
    const { data: mitarbeiter } = await admin.from('mitarbeiter').select('vorname,aktiv,auth_user_id').ilike('email', email).not('auth_user_id', 'is', null).limit(1)
    const m = mitarbeiter?.[0]
    if (m && m.aktiv !== false) {
      const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: APP_URL } })
      const link = data?.properties?.action_link
      if (!error && link) {
        const ergebnis = await sendMail({
          to: email,
          subject: 'Passwort zurücksetzen – WWS-App',
          text: `Hallo ${m.vorname ?? ''},\n\nüber diesen Link kannst du ein neues Passwort für die WWS-App festlegen:\n\n${link}\n\nWenn du das nicht angefordert hast, ignoriere diese E-Mail einfach. Dein Passwort bleibt dann unverändert.\n\nViele Grüße\nGünes Sanierung GmbH`,
        })
        // Mail-Dienst nicht eingerichtet: die App weicht dann auf das Supabase-Standardverfahren aus.
        if (ergebnis.grund === 'nicht_eingerichtet') return res.status(200).json({ ok: false, code: 'nicht_eingerichtet' })
      }
    }
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(200).json({ ok: true })
  }
}
