// Hilfen zum Versenden von Lieferscheinen per WhatsApp (Klick-zum-Chat) und E-Mail (mailto).

export const KANAELE = ['whatsapp', 'email']

/** Macht aus "+49 152 5517-6611", "0152 5517 6611" oder "0049…" eine WhatsApp-taugliche Nummer (nur Ziffern, mit Landesvorwahl). */
export function normalizePhone(raw) {
  if (!raw) return ''
  let digits = String(raw).replace(/[^\d+]/g, '')
  const hasPlus = digits.startsWith('+')
  digits = digits.replace(/\D/g, '')
  if (!digits) return ''
  if (hasPlus) return digits
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return '49' + digits.slice(1)
  return digits
}

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value ?? '').trim())

/** Ersetzt {{Platzhalter}} durch Werte (Schlüssel ohne Klammern). */
export function fillPlaceholders(text, values) {
  return (text ?? '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => (key in values ? values[key] : match))
}

export const whatsappUrl = (phone, text) => `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`

export const mailtoUrl = (email, subject, body) =>
  `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
