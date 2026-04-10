import * as XLSXStyle from 'xlsx-js-style'

export type ColDef = { key: string; label: string; width: number; type?: 'currency' | 'boolean' | 'text' }

export const headerStyle = {
  font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1E40AF' } },
  alignment: { vertical: 'center' as const, horizontal: 'center' as const, wrapText: true },
  border: { top: { style: 'thin', color: { rgb: 'FFFFFF' } }, bottom: { style: 'thin', color: { rgb: 'FFFFFF' } }, left: { style: 'thin', color: { rgb: 'FFFFFF' } }, right: { style: 'thin', color: { rgb: 'FFFFFF' } } }
}

export const baseStyle = {
  font: { name: 'Arial', sz: 9 },
  alignment: { vertical: 'center' as const, wrapText: true },
  border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } }
}

export const zebraStyle = { ...baseStyle, fill: { fgColor: { rgb: 'F8FAFC' } } }
export const currencyStyle = { ...baseStyle, numFmt: '#,##0.00', alignment: { vertical: 'center' as const, horizontal: 'right' as const } }
export const currencyZebraStyle = { ...zebraStyle, numFmt: '#,##0.00', alignment: { vertical: 'center' as const, horizontal: 'right' as const } }
export const totalStyle = { ...baseStyle, font: { name: 'Arial', sz: 9, bold: true }, fill: { fgColor: { rgb: 'DBEAFE' } }, numFmt: '#,##0.00', alignment: { vertical: 'center' as const, horizontal: 'right' as const } }
export const titleStyle = { font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '1E293B' } } }
export const subtitleStyle = { font: { name: 'Arial', sz: 10, color: { rgb: '64748B' } } }

export function buildSheet(rows: any[], cols: ColDef[], title: string, firmaAd: string, donem: string) {
  const ws: any = {}
  const HEADER_ROW = 4

  ws[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = { v: firmaAd, t: 's', s: titleStyle }
  ws[XLSXStyle.utils.encode_cell({ r: 1, c: 0 })] = { v: title, t: 's', s: subtitleStyle }
  ws[XLSXStyle.utils.encode_cell({ r: 2, c: 0 })] = { v: donem, t: 's', s: subtitleStyle }

  cols.forEach((col, C) => {
    ws[XLSXStyle.utils.encode_cell({ r: HEADER_ROW, c: C })] = { v: col.label, t: 's', s: headerStyle }
  })

  let totalRow: Record<string, number> = {}
  rows.forEach((row, ri) => {
    const isZebra = ri % 2 === 1
    cols.forEach((col, C) => {
      const ref = XLSXStyle.utils.encode_cell({ r: HEADER_ROW + 1 + ri, c: C })
      const val = row[col.key]
      if (col.type === 'boolean') {
        ws[ref] = { v: val ? 'Evet' : 'Hayır', t: 's', s: isZebra ? zebraStyle : baseStyle }
      } else if (col.type === 'currency') {
        const num = parseFloat(val) || 0
        ws[ref] = { v: num, t: 'n', s: isZebra ? currencyZebraStyle : currencyStyle }
        totalRow[col.key] = (totalRow[col.key] || 0) + num
      } else {
        ws[ref] = { v: val ?? '', t: 's', s: isZebra ? zebraStyle : baseStyle }
      }
    })
  })

  if (rows.length > 0) {
    const totalRowIdx = HEADER_ROW + 1 + rows.length
    cols.forEach((col, C) => {
      const ref = XLSXStyle.utils.encode_cell({ r: totalRowIdx, c: C })
      if (col.type === 'currency' && totalRow[col.key] !== undefined) {
        ws[ref] = { v: totalRow[col.key], t: 'n', s: totalStyle }
      } else if (C === 0) {
        ws[ref] = { v: 'TOPLAM', t: 's', s: { ...baseStyle, font: { name: 'Arial', sz: 9, bold: true }, fill: { fgColor: { rgb: 'DBEAFE' } } } }
      } else {
        ws[ref] = { v: '', t: 's', s: { ...baseStyle, fill: { fgColor: { rgb: 'DBEAFE' } } } }
      }
    })
  }

  const lastRow = HEADER_ROW + 1 + rows.length
  const lastCol = cols.length - 1
  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } })
  ws['!cols'] = cols.map(c => ({ wch: c.width }))
  ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 16 }, { hpt: 8 }, { hpt: 20 }]
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
  ]
  ws['!autofilter'] = { ref: XLSXStyle.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: HEADER_ROW, c: lastCol } }) }
  return ws
}

export function fmt(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
}
