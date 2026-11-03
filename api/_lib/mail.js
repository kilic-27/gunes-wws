// E-Mail direkt versenden (Brevo oder Resend, je nachdem welcher Schlüssel in Vercel hinterlegt ist).
// MAIL_FROM = Absenderadresse (beim Dienst bestätigt/verifiziert), MAIL_FROM_NAME optional.
export async function sendMail({ to, subject, text }) {
  const from = process.env.MAIL_FROM
  const fromName = process.env.MAIL_FROM_NAME || 'Günes Sanierung GmbH'
  const provider = process.env.BREVO_API_KEY ? 'brevo' : process.env.RESEND_API_KEY ? 'resend' : null
  if (!from || !provider) return { gesendet: false, grund: 'nicht_eingerichtet' }
  try {
    const response =
      provider === 'brevo'
        ? await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ sender: { name: fromName, email: from }, to: [{ email: to }], subject, textContent: text }),
          })
        : await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
            body: JSON.stringify({ from: `${fromName} <${from}>`, to: [to], subject, text }),
          })
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 200)
      return { gesendet: false, grund: 'fehler', fehler: `${provider} ${response.status}: ${detail}` }
    }
    return { gesendet: true, dienst: provider }
  } catch (error) {
    return { gesendet: false, grund: 'fehler', fehler: error?.message || 'Netzwerkfehler' }
  }
}
