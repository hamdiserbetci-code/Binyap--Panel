/**
 * ETM BİNYAPI — İcra Cevap Yazısı Word Belgesi Oluşturucu
 * Gerçek .docx formatı, profesyonel kurumsal stil
 */

export interface IcraWordData {
  firma: { ad: string; vergi_no?: string | null }
  icra: {
    dosya_no: string
    icra_dairesi: string | null
    alacakli: string | null
    toplam_borc: number
    odenen_tutar: number
    kalan_borc: number
    aylik_kesinti: number
    baslangic_tarihi: string | null
    personel_cikis_tarihi?: string | null
  }
  personel: {
    ad_soyad: string
    tc_kimlik?: string | null
    pozisyon?: string | null
    aktif?: boolean
    isten_cikis_tarihi?: string | null
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n)
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function icraWordIndir(data: IcraWordData) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, HeadingLevel, WidthType, ShadingType,
    VerticalAlign, PageOrientation, convertInchesToTwip,
  } = await import('docx')

  const { firma, icra, personel } = data
  const bugun = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })

  const devamMi = personel.aktif !== false && !icra.personel_cikis_tarihi
  const cikisTarihi = icra.personel_cikis_tarihi || personel.isten_cikis_tarihi

  // ─── Renk Sabitleri ──────────────────────────────────────────
  const KOYU   = '0F172A'
  const MAVİ   = '1E40AF'
  const ACIK   = 'EFF6FF'
  const BORDER = 'CBD5E1'
  const YESIL  = '166534'
  const KIRMIZI = '991B1B'

  // ─── Yardımcı Fonksiyonlar ───────────────────────────────────
  const bold = (text: string, size = 22, color = KOYU) =>
    new TextRun({ text, bold: true, size, color, font: 'Calibri' })

  const normal = (text: string, size = 20, color = KOYU) =>
    new TextRun({ text, size, color, font: 'Calibri' })

  const para = (children: any[], alignment: any = AlignmentType.LEFT, spacingAfter = 120) =>
    new Paragraph({ children, alignment, spacing: { after: spacingAfter } })

  const emptyLine = () => new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } })

  // ─── Tablo Hücresi ───────────────────────────────────────────
  const cell = (text: string, isHeader = false, width = 50) =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: isHeader, size: isHeader ? 18 : 19, color: isHeader ? 'FFFFFF' : KOYU, font: 'Calibri' })],
        spacing: { before: 60, after: 60 },
      })],
      shading: isHeader ? { type: ShadingType.SOLID, color: MAVİ } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      width: { size: width, type: WidthType.PERCENTAGE },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
    })

  // ─── BELGE YAPISI ─────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: KOYU },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1.2),
            bottom: convertInchesToTwip(1.0),
            left:   convertInchesToTwip(1.4),
            right:  convertInchesToTwip(1.2),
          },
        },
      },
      children: [

        // ── ÜST BANT: Firma Adı ──────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: firma.ad.toUpperCase(), bold: true, size: 32, color: 'FFFFFF', font: 'Calibri' })],
                    spacing: { before: 100, after: 40 },
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: firma.vergi_no ? `Vergi No: ${firma.vergi_no}` : 'Kurumsal Yönetim Sistemi', size: 16, color: 'BFDBFE', font: 'Calibri' })],
                    spacing: { after: 100 },
                  }),
                ],
                shading: { type: ShadingType.SOLID, color: KOYU },
                margins: { top: 120, bottom: 120, left: 200, right: 200 },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: bugun, size: 18, color: 'BFDBFE', font: 'Calibri' })],
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 100, after: 40 },
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: 'CEVAP YAZISI', bold: true, size: 20, color: 'FFFFFF', font: 'Calibri' })],
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 100 },
                  }),
                ],
                shading: { type: ShadingType.SOLID, color: KOYU },
                margins: { top: 120, bottom: 120, left: 200, right: 200 },
              }),
            ],
          })],
        }),

        // ── Mavi Accent Çizgi ─────────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [new TableRow({
            height: { value: 80, rule: 'exact' as any },
            children: [new TableCell({
              children: [new Paragraph({ children: [] })],
              shading: { type: ShadingType.SOLID, color: '3B82F6' },
            })],
          })],
        }),

        emptyLine(),

        // ── Muhatap Bilgisi ───────────────────────────────────────
        para([bold(`${icra.icra_dairesi?.toUpperCase() || 'İCRA DAİRESİ'} MÜDÜRLÜĞÜNE`, 22, MAVİ)]),
        emptyLine(),

        // ── Konu / İlgi ───────────────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            left:   { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            right:  { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            insideHorizontal:{ style: BorderStyle.SINGLE, size: 1, color: BORDER },
            insideVertical:{ style: BorderStyle.SINGLE, size: 1, color: BORDER },
          },
          rows: [
            new TableRow({ children: [
              new TableCell({
                children: [new Paragraph({ children: [bold('Konu', 19, MAVİ)], spacing: { before: 60, after: 60 } })],
                shading: { type: ShadingType.SOLID, color: ACIK },
                width: { size: 15, type: WidthType.PERCENTAGE },
                margins: { left: 120, right: 120 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [normal(`${icra.dosya_no} Sayılı İcra Dosyasına Cevap`, 19)], spacing: { before: 60, after: 60 } })],
                width: { size: 85, type: WidthType.PERCENTAGE },
                margins: { left: 120, right: 120 },
              }),
            ]}),
            new TableRow({ children: [
              new TableCell({
                children: [new Paragraph({ children: [bold('İlgi', 19, MAVİ)], spacing: { before: 60, after: 60 } })],
                shading: { type: ShadingType.SOLID, color: ACIK },
                margins: { left: 120, right: 120 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [normal(`${icra.dosya_no} sayılı icra dosyası tebligatı`, 19)], spacing: { before: 60, after: 60 } })],
                margins: { left: 120, right: 120 },
              }),
            ]}),
          ],
        }),

        emptyLine(),

        // ── Giriş Paragrafı ───────────────────────────────────────
        para([
          normal('Müdürlüğünüzün '),
          bold(icra.dosya_no),
          normal(' sayılı icra dosyası kapsamında borçlu '),
          bold(personel.ad_soyad),
          normal(' hakkında tarafımıza tebligat yapılmış olup aşağıdaki bilgileri saygılarımızla arz ederiz.'),
        ], AlignmentType.BOTH, 200),

        // ── Borçlu Bilgileri Tablosu ──────────────────────────────
        para([bold('BORÇLU BİLGİLERİ', 20, MAVİ)], AlignmentType.LEFT, 80),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            left:   { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            right:  { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            insideHorizontal:{ style: BorderStyle.SINGLE, size: 1, color: BORDER },
            insideVertical:{ style: BorderStyle.SINGLE, size: 1, color: BORDER },
          },
          rows: [
            new TableRow({ children: [cell('Ad Soyad', true, 30), cell(personel.ad_soyad, false, 70)] }),
            new TableRow({ children: [cell('TC Kimlik No', true, 30), cell(personel.tc_kimlik || '-', false, 70)] }),
            new TableRow({ children: [cell('Pozisyon / Görevi', true, 30), cell(personel.pozisyon || '-', false, 70)] }),
          ],
        }),

        emptyLine(),

        // ── Çalışma Durumu ────────────────────────────────────────
        para([bold('ÇALIŞMA DURUMU', 20, MAVİ)], AlignmentType.LEFT, 80),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 2, color: devamMi ? '16A34A' : '991B1B' },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: devamMi ? '16A34A' : '991B1B' },
            left:   { style: BorderStyle.SINGLE, size: 2, color: devamMi ? '16A34A' : '991B1B' },
            right:  { style: BorderStyle.SINGLE, size: 2, color: devamMi ? '16A34A' : '991B1B' },
            insideHorizontal:{ style: BorderStyle.NONE },
            insideVertical:{ style: BorderStyle.NONE },
          },
          rows: [new TableRow({
            children: [new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: devamMi
                        ? '✓  ÇALIŞMAYA DEVAM ETMEKTEDİR'
                        : `✗  FİRMAMIZDAN AYRILMIŞTIR${cikisTarihi ? ' — ' + fmtDate(cikisTarihi) : ''}`,
                      bold: true,
                      size: 24,
                      color: devamMi ? YESIL : KIRMIZI,
                      font: 'Calibri',
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 120, after: 120 },
                }),
                ...(devamMi ? [new Paragraph({
                  children: [new TextRun({
                    text: `Bir sonraki maaşından 1/4 oranında kesinti yapılarak ${icra.dosya_no} sayılı dosya numarasına aktarılacaktır.`,
                    size: 19,
                    color: KOYU,
                    font: 'Calibri',
                  })],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 100 },
                })] : [new Paragraph({
                  children: [new TextRun({
                    text: 'Hizmet akdi sona ermiş olup kesinti yapılması mümkün değildir.',
                    size: 19,
                    color: KOYU,
                    font: 'Calibri',
                  })],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 100 },
                })]),
              ],
              shading: { type: ShadingType.SOLID, color: devamMi ? 'F0FDF4' : 'FEF2F2' },
              margins: { top: 100, bottom: 100, left: 200, right: 200 },
            })],
          })],
        }),

        emptyLine(),

        // ── Borç Bilgileri Tablosu ────────────────────────────────
        para([bold('BORÇ BİLGİLERİ', 20, MAVİ)], AlignmentType.LEFT, 80),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            left:   { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            right:  { style: BorderStyle.SINGLE, size: 1, color: BORDER },
            insideHorizontal:{ style: BorderStyle.SINGLE, size: 1, color: BORDER },
            insideVertical:{ style: BorderStyle.SINGLE, size: 1, color: BORDER },
          },
          rows: [
            new TableRow({ children: [cell('Toplam Borç', true, 40), cell(fmt(icra.toplam_borc), false, 60)] }),
            new TableRow({ children: [cell('Ödenen Tutar', true, 40), cell(fmt(icra.odenen_tutar || 0), false, 60)] }),
            new TableRow({ children: [cell('Kalan Borç', true, 40), cell(fmt(icra.kalan_borc || icra.toplam_borc), false, 60)] }),
            ...(devamMi ? [new TableRow({ children: [cell('Aylık Kesinti Tutarı', true, 40), cell(fmt(icra.aylik_kesinti), false, 60)] })] : []),
          ],
        }),

        emptyLine(),
        emptyLine(),

        // ── İmza Alanı ────────────────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [new TableRow({
            children: [
              new TableCell({
                children: [
                  para([normal('Saygılarımızla,', 19)]),
                  emptyLine(),
                  emptyLine(),
                  para([bold(firma.ad.toUpperCase(), 20, KOYU)]),
                  para([normal(bugun, 18, '64748B')]),
                ],
                width: { size: 50, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: 'Kaşe / İmza', size: 18, color: '94A3B8', font: 'Calibri' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400, after: 40 },
                  }),
                  new Table({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
                    rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [] })], margins: { top: 400 } })] })],
                  }),
                ],
                width: { size: 50, type: WidthType.PERCENTAGE },
              }),
            ],
          })],
        }),

        // ── Alt Bilgi Çizgisi ─────────────────────────────────────
        emptyLine(),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [new TableRow({
            height: { value: 40, rule: 'exact' as any },
            children: [new TableCell({
              children: [new Paragraph({ children: [] })],
              shading: { type: ShadingType.SOLID, color: KOYU },
            })],
          })],
        }),
        new Paragraph({
          children: [new TextRun({ text: `${firma.ad}  |  Gizli ve Kurumsal Belge  |  ${bugun}`, size: 14, color: '94A3B8', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60 },
        }),
      ],
    }],
  })

  // ── İndir ─────────────────────────────────────────────────────
  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `icra-cevap-${icra.dosya_no}-${new Date().toISOString().split('T')[0]}.docx`
  a.click()
  URL.revokeObjectURL(url)
}


