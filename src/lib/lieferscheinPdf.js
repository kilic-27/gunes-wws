import { barcodeImage, loadLibs, pdfT } from './pdf.js'
import { formatEuro, formatMenge, leihTage, unitOf } from './lieferschein.js'
import { formatDateTimeDE } from './date.js'

/**
 * Erzeugt das Lieferschein-PDF (DIN A4) und öffnet es in einem neuen Tab.
 * ctx: { ls (aufgelöster Lieferschein), baustelle, ort, auftraggeber, mitarbeiter, firma,
 *        positionen, artikelMap, stueckMap, gewerkMap }
 */
async function createLieferscheinDoc(ctx) {
  {
    const { jsPDF, autoTable, JsBarcode } = await loadLibs()
    const { ls, firma, auftraggeber, mitarbeiter, ort, positionen, artikelMap, stueckMap, gewerkMap } = ctx
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    const cache = new Map()

    // Kopf: Firma links, Nummer + Strichcode rechts
    doc.setFontSize(15)
    doc.setFont(undefined, 'bold')
    doc.text(firma?.name ?? 'Günes Sanierung GmbH', 14, 17)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90)
    const firmaZeilen = [firma?.strasse, [firma?.plz, firma?.ort].filter(Boolean).join(' '), firma?.telefon].filter(Boolean)
    firmaZeilen.forEach((zeile, i) => doc.text(zeile, 14, 23 + i * 4.5))
    doc.setTextColor(0)

    doc.setFontSize(17)
    doc.setFont(undefined, 'bold')
    doc.text(`${pdfT('lieferschein.pdf.title')} ${ls.nummer_label}`, width - 14, 17, { align: 'right' })
    doc.setFont(undefined, 'normal')
    if (ls.nr) {
      doc.addImage(barcodeImage(JsBarcode, cache, ls.nummer_label), 'PNG', width - 64, 20, 50, 11, undefined, 'FAST')
    }

    // Eckdaten
    const info = [
      [pdfT('lieferschein.baustelle'), [ort?.strasse, [ort?.plz, ort?.name].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–'],
      [pdfT('fields.auftraggeber'), auftraggeber?.name ?? '–'],
      [pdfT('lieferschein.mitarbeiter'), mitarbeiter ? `${mitarbeiter.vorname ?? ''} ${mitarbeiter.nachname ?? ''}`.trim() : '–'],
      [pdfT('lieferschein.projektnummer'), ls.projektnummer || '–'],
      [pdfT('lieferschein.angelegt'), `${formatDateTimeDE(ls.erstellt_am)}${ls.erstellt_von ? ` (${ls.erstellt_von})` : ''}`],
      ['Status', pdfT('lieferschein.status.' + ls.status) + (ls.maler_lieferschein ? ` · ${pdfT('lieferschein.malerLieferschein')}` : '')],
    ]
    autoTable(doc, {
      startY: 38,
      body: info,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 } },
      margin: { left: 14, right: 14 },
    })

    // Positionen gruppiert nach Gewerk
    const groups = new Map()
    for (const p of positionen) {
      const key = p.gewerk_id ?? ''
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(p)
    }
    const ordered = [...groups.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : (gewerkMap.get(a)?.name ?? '').localeCompare(gewerkMap.get(b)?.name ?? '', 'de')))

    const body = []
    let nr = 0
    for (const [gid, list] of ordered) {
      body.push([{ content: gid ? (gewerkMap.get(gid)?.name ?? '') : pdfT('lieferschein.generell'), colSpan: 6, styles: { fontStyle: 'bold', fillColor: [232, 245, 252] } }])
      for (const p of list) {
        nr += 1
        const a = artikelMap.get(p.artikel_id)
        if (p.art === 'verbrauch') {
          body.push([String(nr), a?.name ?? '–', '', `${formatMenge(p.menge)} ${unitOf(a)}`, formatEuro(p.einzelpreis), formatEuro(Number(p.menge) * Number(p.einzelpreis))])
        } else {
          const tage = leihTage(p)
          body.push([
            String(nr),
            a?.name ?? '–',
            stueckMap.get(p.bestand_stueck_id)?.barcode ?? '',
            `1 ${pdfT('lieferschein.stueckUnit')}${p.zurueck_am ? ` (${pdfT('lieferschein.zurueck')})` : ''}`,
            p.tagespreis > 0 ? `${formatEuro(p.tagespreis)} / ${pdfT('lieferschein.tag')}` : '–',
            p.tagespreis > 0 ? formatEuro(Number(p.tagespreis) * tage) : '–',
          ])
        }
      }
    }

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [['#', pdfT('fields.artikel'), 'Barcode', pdfT('fields.menge'), pdfT('lieferschein.einzelpreis'), pdfT('lieferschein.summe')]],
      body,
      styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
      headStyles: { fillColor: [23, 179, 242] },
      columnStyles: { 0: { cellWidth: 10 }, 2: { font: 'courier', cellWidth: 32 }, 3: { cellWidth: 28 }, 4: { halign: 'right', cellWidth: 30 }, 5: { halign: 'right', cellWidth: 26 } },
      margin: { left: 14, right: 14 },
    })

    // Summen
    const summe = ls.summe
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 4,
      body: [
        [pdfT('lieferschein.verbrauchskosten'), formatEuro(summe.verbrauch)],
        [pdfT('lieferschein.leihkosten'), formatEuro(summe.leih)],
        [{ content: pdfT('lieferschein.gesamtkosten'), styles: { fontStyle: 'bold' } }, { content: formatEuro(summe.gesamt), styles: { fontStyle: 'bold' } }],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.2, halign: 'right' },
      columnStyles: { 0: { halign: 'right' }, 1: { cellWidth: 32 } },
      margin: { left: width - 100, right: 14 },
    })

    // Unterschriften (auf neue Seite, falls kein Platz)
    let y = doc.lastAutoTable.finalY + 26
    if (y > height - 30) {
      doc.addPage()
      y = 40
    }
    doc.setDrawColor(150)
    doc.line(14, y, 84, y)
    doc.line(width - 84, y, width - 14, y)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(pdfT('lieferschein.pdf.uebergeben'), 14, y + 4)
    doc.text(pdfT('lieferschein.pdf.empfangen'), width - 84, y + 4)
    doc.setTextColor(0)

    const pages = doc.getNumberOfPages()
    doc.setFontSize(8)
    doc.setTextColor(120)
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page)
      doc.text(`${ls.nummer_label}  |  ${pdfT('pdf.page')} ${page} ${pdfT('pdf.of')} ${pages}`, width - 14, height - 8, { align: 'right' })
    }

    return doc
  }
}

/** PDF als Blob (z. B. zum Hochladen und Versenden per Link). */
export async function lieferscheinPdfBlob(ctx) {
  const doc = await createLieferscheinDoc(ctx)
  return doc.output('blob')
}

export async function showLieferscheinPdf(ctx) {
  // Tab sofort öffnen (innerhalb des Klicks), damit Popup-Blocker nicht greifen.
  const win = window.open('', '_blank')
  try {
    const doc = await createLieferscheinDoc(ctx)
    const url = doc.output('bloburl')
    if (win) win.location.href = url
    else window.open(url, '_blank')
  } catch (error) {
    win?.close()
    throw error
  }
}
