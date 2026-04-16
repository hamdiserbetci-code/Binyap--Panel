/**
 * ETM BİNYAPI — Kurumsal PDF & Excel Export Yardımcıları
 */
import type jsPDF from 'jspdf'

// ─── Marka Renkleri ───────────────────────────────────────────
export const BRAND = {
  dark:    [15,  23,  42]  as [number, number, number], // slate-900
  primary: [37,  99,  235] as [number, number, number], // blue-600
  accent:  [6,   182, 212] as [number, number, number], // cyan-500
  light:   [248, 250, 252] as [number, number, number], // slate-50
  border:  [226, 232, 240] as [number, number, number], // slate-200
  text:    [15,  23,  42]  as [number, number, number], // slate-900
  muted:   [100, 116, 139] as [number, number, number], // slate-500
  red:     [220, 38,  38]  as [number, number, number], // red-600
  green:   [22,  163, 74]  as [number, number, number], // green-600
  yellow:  [202, 138, 4]   as [number, number, number], // yellow-600
}

// ─── Font Yükle ───────────────────────────────────────────────
export async function registerFont(doc: jsPDF) {
  try {
    const load = async (url: string) => {
      const res = await fetch(url)
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let b = ''
      for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i])
      return btoa(b)
    }
    const reg  = await load('/fonts/Roboto-Regular.ttf')
    const bold = await load('/fonts/Roboto-Bold.ttf')
    doc.addFileToVFS('Roboto-Regular.ttf', reg)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFileToVFS('Roboto-Bold.ttf', bold)
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
    doc.setFont('Roboto', 'normal')
  } catch { /* varsayılan font */ }
}

// ─── PDF Başlık Bloğu ─────────────────────────────────────────
export interface PdfHeaderOptions {
  doc: jsPDF
  title: string
  subtitle?: string
  firmaAdi: string
  meta?: { label: string; value: string }[]
  pageWidth: number
}

export function drawPdfHeader(opts: PdfHeaderOptions): number {
  const { doc, title, subtitle, firmaAdi, meta = [], pageWidth } = opts

  // Üst bant
  doc.setFillColor(...BRAND.dark)
  doc.rect(0, 0, pageWidth, 22, 'F')

  // Firma adı — sol
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(firmaAdi.toUpperCase(), 14, 9)

  // Rapor başlığı — sol alt
  doc.setFontSize(8)
  doc.setFont('Roboto', 'normal')
  doc.setTextColor(148, 163, 184) // slate-400
  doc.text(title.toUpperCase(), 14, 16)

  // Tarih — sağ
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(dateStr, pageWidth - 14, 9, { align: 'right' })

  // Accent çizgi
  doc.setFillColor(...BRAND.accent)
  doc.rect(0, 22, pageWidth, 1.5, 'F')

  let y = 30

  // Alt başlık
  if (subtitle) {
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...BRAND.dark)
    doc.text(subtitle, 14, y)
    y += 7
  }

  // Meta bilgiler (özet kartlar)
  if (meta.length > 0) {
    const cardW = (pageWidth - 28 - (meta.length - 1) * 4) / meta.length
    meta.forEach((m, i) => {
      const x = 14 + i * (cardW + 4)
      doc.setFillColor(...BRAND.light)
      doc.setDrawColor(...BRAND.border)
      doc.roundedRect(x, y, cardW, 12, 2, 2, 'FD')
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...BRAND.muted)
      doc.text(m.label, x + cardW / 2, y + 4.5, { align: 'center' })
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...BRAND.dark)
      doc.text(m.value, x + cardW / 2, y + 9.5, { align: 'center' })
    })
    y += 17
  }

  return y
}

// ─── PDF Alt Bilgi ────────────────────────────────────────────
export function drawPdfFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(...BRAND.dark)
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('ETM BİNYAPI — Gizli ve Kurumsal Belge', 14, pageHeight - 3)
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth - 14, pageHeight - 3, { align: 'right' })
  }
}

// ─── autoTable Varsayılan Stiller ─────────────────────────────
export function tableStyles() {
  return {
    styles: {
      font:        'Roboto',
      fontSize:    8,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      textColor:   BRAND.text,
    } as any,
    headStyles: {
      font:        'Roboto',
      fontStyle:   'bold',
      fontSize:    8,
      fillColor:   BRAND.primary,
      textColor:   [255, 255, 255] as [number, number, number],
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
    } as any,
    alternateRowStyles: {
      fillColor: BRAND.light,
    } as any,
  }
}

// ─── Excel Yardımcıları ───────────────────────────────────────
export interface ExcelSheetOptions {
  title: string
  firmaAdi: string
  subtitle?: string
  headers: string[]
  rows: (string | number)[][]
  colWidths?: number[]
  fileName: string
}

export async function exportExcelPro(opts: ExcelSheetOptions) {
  const { utils, writeFile } = await import('xlsx')
  const { title, firmaAdi, subtitle, headers, rows, colWidths, fileName } = opts

  const wsData: any[][] = []

  // Firma adı satırı
  wsData.push([firmaAdi.toUpperCase()])
  wsData.push([title])
  if (subtitle) wsData.push([subtitle])
  wsData.push([`Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`])
  wsData.push([]) // boş satır
  wsData.push(headers)
  rows.forEach(r => wsData.push(r))
  wsData.push([]) // boş satır
  wsData.push([`Toplam ${rows.length} kayıt`])

  const ws = utils.aoa_to_sheet(wsData)

  // Kolon genişlikleri
  if (colWidths) {
    ws['!cols'] = colWidths.map(w => ({ wch: w }))
  }

  // Hücre birleştirme — başlık satırları
  const mergeCount = headers.length - 1
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: mergeCount } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: mergeCount } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: mergeCount } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: mergeCount } },
  ]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, title.substring(0, 31))
  writeFile(wb, fileName)
}
