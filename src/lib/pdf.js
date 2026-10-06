import i18n from '../i18n/index.js'

// PDFs werden immer mit deutschen Beschriftungen erzeugt: die eingebaute
// PDF-Schrift kennt nur westeuropäische Zeichen (kein Kyrillisch/Türkisch).
export const pdfT = i18n.getFixedT('de')

export async function loadLibs() {
  const [{ jsPDF }, autoTableModule, barcodeModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('jsbarcode'),
  ])
  return {
    jsPDF,
    autoTable: autoTableModule.default ?? autoTableModule.autoTable,
    JsBarcode: barcodeModule.default,
  }
}

export function barcodeImage(JsBarcode, cache, text) {
  if (cache.has(text)) return cache.get(text)
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, text, { format: 'CODE128', displayValue: false, margin: 0, height: 50, width: 2 })
  const url = canvas.toDataURL('image/png')
  cache.set(text, url)
  return url
}

/**
 * Erzeugt ein PDF mit einer Tabelle und öffnet es in einem neuen Tab.
 * head: Spaltenüberschriften, body: Zeilen (Arrays von Texten).
 * barcodeImageColumn: optional Spaltenindex, in dem zusätzlich zum Text ein
 * scannbarer Code128-Strichcode (aus dem Text dieser Spalte) gezeichnet wird.
 */
export async function showTablePdf({ title, subtitle, head, body, barcodeImageColumn, landscape = false }) {
  // Tab sofort öffnen (innerhalb des Klicks), damit Popup-Blocker nicht greifen.
  const win = window.open('', '_blank')
  try {
    const { jsPDF, autoTable, JsBarcode } = await loadLibs()
    const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true })
    const cache = new Map()
    const hasImage = barcodeImageColumn != null

    doc.setFontSize(16)
    doc.text(title, 14, 16)
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(subtitle, 14, 22)
    doc.setTextColor(0)

    autoTable(doc, {
      startY: 27,
      head: [head],
      body,
      styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
      headStyles: { fillColor: [23, 179, 242] },
      alternateRowStyles: { fillColor: [246, 248, 250] },
      didParseCell: (data) => {
        if (hasImage && data.section === 'body') {
          data.cell.styles.minCellHeight = 13
          if (data.column.index === barcodeImageColumn) data.cell.text = []
        }
      },
      didDrawCell: (data) => {
        if (hasImage && data.section === 'body' && data.column.index === barcodeImageColumn) {
          const text = String(body[data.row.index][data.column.index] ?? '')
          if (!text) return
          doc.addImage(
            barcodeImage(JsBarcode, cache, text),
            'PNG',
            data.cell.x + 2,
            data.cell.y + 2,
            data.cell.width - 4,
            data.cell.height - 4,
            undefined,
            'FAST',
          )
        }
      },
    })

    const pages = doc.getNumberOfPages()
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.setTextColor(120)
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page)
      doc.text(`${pdfT('pdf.page')} ${page} ${pdfT('pdf.of')} ${pages}`, width - 14, height - 8, { align: 'right' })
    }

    const url = doc.output('bloburl')
    if (win) win.location.href = url
    else window.open(url, '_blank')
  } catch (error) {
    win?.close()
    throw error
  }
}

export function pdfSubtitle(count, filterLabel) {
  const date = new Date().toLocaleDateString('de-DE')
  const parts = [`${pdfT('pdf.createdOn')} ${date}`, `${count} ${pdfT('pdf.entries')}`]
  if (filterLabel) parts.push(filterLabel)
  return parts.join('  |  ')
}
