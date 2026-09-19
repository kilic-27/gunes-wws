export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// Ganze Tage zwischen zwei ISO-Datumsangaben (endISO fehlt -> bis heute).
export function daysBetween(startISO, endISO) {
  if (!startISO) return null
  const start = new Date(startISO + 'T00:00:00')
  const end = new Date((endISO ?? todayISO()) + 'T00:00:00')
  return Math.max(0, Math.round((end - start) / 86400000))
}

export function formatDateDE(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE')
}

export function formatDateTimeDE(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('de-DE')
}
