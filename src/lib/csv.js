/**
 * Lädt eine Tabelle als CSV-Datei herunter, die sich in deutschem Excel per Doppelklick richtig öffnet
 * (Semikolon als Trenner, UTF-8 mit BOM, damit Umlaute stimmen).
 */
export function downloadCsv(filename, head, rows) {
  const esc = (value) => {
    const text = String(value ?? '')
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const csv = [head, ...rows].map((row) => row.map(esc).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
