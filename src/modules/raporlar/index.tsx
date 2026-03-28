'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarRange, Download, FileSpreadsheet, FileText, Landmark, Receipt, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, ErrorMsg, Loading } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { BordroSurec, Cek, KullaniciProfil, MaliyetSureci, Musteri, Proje } from '@/types'

type ReportType = 'all' | 'gunluk' | 'periyodik' | 'bordro' | 'maliyet' | 'cekler' | 'kasa'

type FilterStatus = 'all' | 'tamamlandi' | 'bekleyen'

interface GunlukIs {
  id: string
  baslik: string
  aciklama: string | null
  matris: string
  durum: 'bekliyor' | 'tamamlandi'
  tarih: string
  hatirlatici: string | null
  created_at: string
}

interface IsTakip {
  id: string
  musteri_id: string | null
  tip: string
  donem: string
  adim1_durum: 'bekliyor' | 'tamamlandi'
  adim1_tarihi: string | null
  adim2_durum: 'bekliyor' | 'tamamlandi'
  adim2_tarihi: string | null
  durum: 'aktif' | 'tamamlandi'
  notlar: string | null
  hatirlatici_tarihi: string | null
  hatirlatici_saati: string | null
  created_at: string
}

interface KasaHareket {
  id: string
  tarih: string
  tur?: 'gelir' | 'gider'
  hareket_turu?: 'gelir' | 'gider'
  kategori: string | null
  aciklama: string | null
  tutar: number
  odeme_sekli?: string | null
  created_at: string
}

interface ReportSheet {
  key: string
  title: string
  subtitle: string
  accent: string
  headers: string[]
  rows: (string | number)[][]
  summary: { label: string; value: string | number }[]
}

interface ReportCard {
  key: string
  title: string
  description: string
  icon: typeof Receipt
  accent: string
  count: number
  exportExcel: () => Promise<void>
  exportPdf: () => Promise<void>
}

const PERIOD_OPTIONS = [
  { value: 'bu_ay', label: 'Bu Ay' },
  { value: 'son3ay', label: 'Son 3 Ay' },
  { value: 'son6ay', label: 'Son 6 Ay' },
  { value: 'son1yil', label: 'Son 1 Yil' },
] as const

const PERIOD_LABEL: Record<string, string> = {
  bu_ay: 'Bu Ay',
  son3ay: 'Son 3 Ay',
  son6ay: 'Son 6 Ay',
  son1yil: 'Son 1 Yil',
}

const REPORT_TYPE_OPTIONS: Array<{ value: ReportType; label: string }> = [
  { value: 'all', label: 'Tum Surecler' },
  { value: 'gunluk', label: 'Gunluk Isler' },
  { value: 'periyodik', label: 'Periyodik Isler' },
  { value: 'bordro', label: 'Bordro Surecleri' },
  { value: 'maliyet', label: 'Aylik Maliyet' },
  { value: 'cekler', label: 'Cek Takibi' },
  { value: 'kasa', label: 'Kasa Hareketleri' },
]

const STATUS_OPTIONS: Array<{ value: FilterStatus; label: string }> = [
  { value: 'all', label: 'Tum Durumlar' },
  { value: 'tamamlandi', label: 'Tamamlananlar' },
  { value: 'bekleyen', label: 'Bekleyenler' },
]

const IS_TIP_LABEL: Record<string, string> = {
  kdv: 'KDV Beyannamesi',
  muhtsar_sgk: 'Muhtasar ve SGK',
  gecici_vergi: 'Gecici Vergi',
  kurumlar_vergisi: 'Kurumlar Vergisi',
  edefter: 'E-Defter Gonderimi',
  sgk_proje: 'SGK Tahakkuku (Proje)',
  banka_mutabakat: 'Banka Mutabakati',
}

const PRIORITY_LABEL: Record<string, string> = {
  q1: 'Kritik',
  q2: 'Yuksek',
  q3: 'Orta',
  q4: 'Dusuk',
}

const MONEY = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatMoney(value: number) {
  return `${MONEY.format(value)} TL`
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('tr-TR') : '-'
}

function getPeriodStart(period: string) {
  const today = new Date()
  if (period === 'bu_ay') return new Date(today.getFullYear(), today.getMonth(), 1)
  if (period === 'son3ay') return new Date(today.getFullYear(), today.getMonth() - 3, 1)
  if (period === 'son6ay') return new Date(today.getFullYear(), today.getMonth() - 6, 1)
  return new Date(today.getFullYear() - 1, today.getMonth(), 1)
}

function normalizeDonemToDate(value?: string | null) {
  if (!value) return null
  if (/^\d{4}-\d{2}$/.test(value)) return new Date(`${value}-01T00:00:00`)
  const q = value.match(/^(\d{4})-Q([1-4])$/)
  if (q) return new Date(Number(q[1]), (Number(q[2]) - 1) * 3, 1)
  if (/^\d{4}$/.test(value)) return new Date(Number(value), 0, 1)
  return null
}


function sanitizeSheetName(name: string) {
  return name.replace(/[\\/*?:[\]]/g, '').slice(0, 31)
}

function normalizeText(value?: string | number | null) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function includesSearch(values: Array<string | number | null | undefined>, query: string) {
  if (!query) return true
  const q = normalizeText(query)
  return values.some((value) => normalizeText(value).includes(q))
}

function toPdfText(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/İ/g, 'I')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c')
    .replace(/Â·/g, ' - ')
    .replace(/·/g, ' - ')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
}

async function exportStyledExcel(fileName: string, sheet: ReportSheet | ReportSheet[]) {
  const XLSX = await import('xlsx-js-style')
  const workbook = XLSX.utils.book_new()
  const sheets = Array.isArray(sheet) ? sheet : [sheet]

  sheets.forEach((item) => {
    const summaryRows = item.summary.map((entry) => [entry.label, String(entry.value)])
    const aoa: (string | number)[][] = [
      [item.title],
      [item.subtitle],
      [],
      ['Rapor Ozeti'],
      ...summaryRows,
      [],
      item.headers,
      ...item.rows,
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const widthFromRows = item.headers.map((header, index) => {
      const maxRowLen = Math.max(
        header.length,
        ...item.rows.map((row) => String(row[index] ?? '').length),
      )
      return { wch: Math.min(Math.max(maxRowLen + 2, 14), 34) }
    })
    ws['!cols'] = widthFromRows
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(item.headers.length - 1, 1) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(item.headers.length - 1, 1) } },
    ]
    ws['!freeze'] = { xSplit: 0, ySplit: 7 }

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let row = 0; row <= range.e.r; row++) {
      for (let col = 0; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (!ws[cellAddress]) continue

        const isHeader = row === 6
        const isTitle = row === 0
        const isSubtitle = row === 1
        const isSummaryTitle = row === 3
        const isSummaryBody = row >= 4 && row < 4 + item.summary.length
        const isData = row > 6

        ws[cellAddress].s = {
          font: {
            name: 'Aptos',
            sz: isTitle ? 16 : isSubtitle ? 10 : isHeader ? 11 : 10,
            bold: isTitle || isHeader || isSummaryTitle || (isSummaryBody && col === 0),
            color: { rgb: isTitle ? 'FFFFFF' : isSubtitle ? 'D8E2F0' : '243246' },
          },
          alignment: { vertical: 'center', horizontal: col === 0 ? 'left' : 'center', wrapText: true },
          fill: {
            fgColor: {
              rgb: isTitle ? item.accent : isSubtitle ? '27405B' : isHeader ? 'DCE6F5' : isSummaryTitle ? 'E8EEF8' : isSummaryBody ? 'F5F8FC' : row % 2 === 0 ? 'F9FBFD' : 'FFFFFF',
            },
          },
          border: {
            top: { style: 'thin', color: { rgb: 'D7E0EC' } },
            bottom: { style: 'thin', color: { rgb: 'D7E0EC' } },
            left: { style: 'thin', color: { rgb: 'D7E0EC' } },
            right: { style: 'thin', color: { rgb: 'D7E0EC' } },
          },
        }

        if (isData && typeof ws[cellAddress].v === 'number') {
          ws[cellAddress].s.numFmt = '#,##0.00'
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName(item.title))
  })

  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}

async function exportStyledPdf(fileName: string, sheet: ReportSheet) {
  const jsPDFModule = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const jsPDF = jsPDFModule.default
  const autoTable = autoTableModule.default
  const doc = new jsPDF('landscape')
  const pdfHeaders = sheet.headers.map((header) => toPdfText(header))
  const pdfRows = sheet.rows.map((row) => row.map((cell) => toPdfText(cell)))
  const pdfSummary = sheet.summary.map((entry) => ({
    label: toPdfText(entry.label),
    value: toPdfText(entry.value),
  }))

  doc.setFillColor(11, 20, 34)
  doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text(toPdfText(sheet.title), 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(toPdfText(sheet.subtitle), 14, 25)

  doc.setTextColor(36, 50, 70)
  let summaryX = 14
  pdfSummary.forEach((entry) => {
    doc.setFillColor(244, 247, 251)
    doc.roundedRect(summaryX, 36, 62, 18, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(entry.label.toUpperCase(), summaryX + 4, 43)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(entry.value, summaryX + 4, 50)
    summaryX += 66
  })

  autoTable(doc, {
    startY: 62,
    head: [pdfHeaders],
    body: pdfRows,
    theme: 'grid',
    headStyles: { fillColor: [76, 139, 245], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor: [36, 50, 70], lineColor: [220, 230, 245], lineWidth: 0.2, fontSize: 8, font: 'helvetica' },
    alternateRowStyles: { fillColor: [248, 251, 253] },
    margin: { left: 10, right: 10, top: 20, bottom: 14 },
    styles: { overflow: 'linebreak', cellPadding: 2.6, font: 'helvetica' },
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(115, 130, 150)
      doc.text(toPdfText(`Olusturulma: ${new Date().toLocaleString('tr-TR')}`), 14, doc.internal.pageSize.height - 6)
      doc.text(toPdfText(`Sayfa ${doc.getNumberOfPages()}`), doc.internal.pageSize.width - 22, doc.internal.pageSize.height - 6)
    },
  })

  doc.save(`${fileName}.pdf`)
}

export default function Raporlar({ firma }: AppCtx) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('son3ay')
  const [reportType, setReportType] = useState<ReportType>('all')
  const [selectedMusteri, setSelectedMusteri] = useState('all')
  const [selectedProje, setSelectedProje] = useState('all')
  const [selectedKullanici, setSelectedKullanici] = useState('all')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [gunluk, setGunluk] = useState<GunlukIs[]>([])
  const [isTakip, setIsTakip] = useState<IsTakip[]>([])
  const [bordro, setBordro] = useState<BordroSurec[]>([])
  const [maliyet, setMaliyet] = useState<MaliyetSureci[]>([])
  const [cekler, setCekler] = useState<Cek[]>([])
  const [kasa, setKasa] = useState<KasaHareket[]>([])
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [kullanicilar, setKullanicilar] = useState<KullaniciProfil[]>([])
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => { load() }, [firma.id, period])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const periodStart = getPeriodStart(period)
      const periodStartIso = periodStart.toISOString().split('T')[0]
      const [
        gunlukRes,
        isTakipRes,
        bordroRes,
        maliyetRes,
        cekRes,
        kasaRes,
        musteriRes,
        projeRes,
        kullaniciRes,
      ] = await Promise.all([
        supabase.from('gunluk_isler').select('*').eq('firma_id', firma.id).gte('tarih', periodStartIso).order('tarih', { ascending: false }),
        supabase.from('is_takip').select('*').eq('firma_id', firma.id).order('donem', { ascending: false }),
        supabase.from('bordro_surecler').select('*').eq('firma_id', firma.id).order('donem', { ascending: false }),
        supabase.from('maliyet_surecler').select('*').eq('firma_id', firma.id).order('donem', { ascending: false }),
        supabase.from('cekler').select('*').eq('firma_id', firma.id).gte('vade_tarihi', periodStartIso).order('vade_tarihi', { ascending: false }),
        supabase.from('kasa_hareketleri').select('*').eq('firma_id', firma.id).gte('tarih', periodStartIso).order('tarih', { ascending: false }),
        supabase.from('musteriler').select('*').eq('firma_id', firma.id).order('ad'),
        supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad'),
        supabase.from('kullanici_profilleri').select('*').eq('firma_id', firma.id).eq('aktif', true).order('ad_soyad'),
      ])

      const firstError = [
        gunlukRes.error,
        isTakipRes.error,
        bordroRes.error,
        maliyetRes.error,
        cekRes.error,
        kasaRes.error,
        musteriRes.error,
        projeRes.error,
        kullaniciRes.error,
      ].find(Boolean)

      if (firstError) throw firstError

      const donemFilter = (value?: string | null) => {
        const date = normalizeDonemToDate(value)
        return date ? date >= periodStart : true
      }

      setGunluk((gunlukRes.data || []) as GunlukIs[])
      setIsTakip(((isTakipRes.data || []) as IsTakip[]).filter((item) => donemFilter(item.donem)))
      setBordro(((bordroRes.data || []) as BordroSurec[]).filter((item) => donemFilter(item.donem)))
      setMaliyet(((maliyetRes.data || []) as MaliyetSureci[]).filter((item) => donemFilter(item.donem)))
      setCekler((cekRes.data || []) as Cek[])
      setKasa((kasaRes.data || []) as KasaHareket[])
      setMusteriler((musteriRes.data || []) as Musteri[])
      setProjeler((projeRes.data || []) as Proje[])
      setKullanicilar((kullaniciRes.data || []) as KullaniciProfil[])
    } catch (e: any) {
      setError(e?.message || 'Raporlar yuklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const projeOptions = useMemo(() => {
    if (selectedMusteri === 'all') return projeler
    return projeler.filter((item) => item.musteri_id === selectedMusteri)
  }, [projeler, selectedMusteri])

  const filteredGunluk = useMemo(() => {
    return gunluk.filter((item) => {
      if (reportType !== 'all' && reportType !== 'gunluk') return false
      if (statusFilter === 'tamamlandi' && item.durum !== 'tamamlandi') return false
      if (statusFilter === 'bekleyen' && item.durum === 'tamamlandi') return false
      return includesSearch([item.baslik, item.aciklama, item.matris, item.hatirlatici], search)
    })
  }, [gunluk, reportType, search, statusFilter])

  const filteredIsTakip = useMemo(() => {
    return isTakip.filter((item) => {
      if (reportType !== 'all' && reportType !== 'periyodik') return false
      if (selectedMusteri !== 'all' && item.musteri_id !== selectedMusteri) return false
      if (statusFilter === 'tamamlandi' && item.durum !== 'tamamlandi') return false
      if (statusFilter === 'bekleyen' && item.durum === 'tamamlandi') return false
      const musteri = musteriler.find((m) => m.id === item.musteri_id)
      return includesSearch([item.tip, item.donem, item.notlar, musteri?.ad, musteri?.kisa_ad], search)
    })
  }, [isTakip, musteriler, reportType, search, selectedMusteri, statusFilter])

  const filteredBordro = useMemo(() => {
    return bordro.filter((item) => {
      if (reportType !== 'all' && reportType !== 'bordro') return false
      if (selectedProje !== 'all' && item.proje_id !== selectedProje) return false
      if (selectedMusteri !== 'all') {
        const proje = projeler.find((p) => p.id === item.proje_id)
        if (proje?.musteri_id !== selectedMusteri) return false
      }
      const isDone = [item.puantaj_durum, item.bordro_durum, item.teyit_durum, item.odeme_durum, item.santiye_durum].every((step) => step === 'tamamlandi')
      if (statusFilter === 'tamamlandi' && !isDone) return false
      if (statusFilter === 'bekleyen' && isDone) return false
      const proje = projeler.find((p) => p.id === item.proje_id)
      return includesSearch([item.donem, item.notlar, proje?.ad], search)
    })
  }, [bordro, projeler, reportType, search, selectedMusteri, selectedProje, statusFilter])

  const filteredMaliyet = useMemo(() => {
    return maliyet.filter((item) => {
      if (reportType !== 'all' && reportType !== 'maliyet') return false
      if (selectedKullanici !== 'all' && item.sorumlu_id !== selectedKullanici) return false
      if (statusFilter === 'tamamlandi' && item.durum !== 'tamamlandi') return false
      if (statusFilter === 'bekleyen' && item.durum === 'tamamlandi') return false
      const sorumlu = kullanicilar.find((k) => k.id === item.sorumlu_id)
      return includesSearch([item.donem, item.notlar, sorumlu?.ad_soyad, sorumlu?.email], search)
    })
  }, [kullanicilar, maliyet, reportType, search, selectedKullanici, statusFilter])

  const filteredCekler = useMemo(() => {
    return cekler.filter((item) => {
      if (reportType !== 'all' && reportType !== 'cekler') return false
      if (selectedMusteri !== 'all' && item.musteri_id !== selectedMusteri) return false
      const isDone = item.durum !== 'bekliyor'
      if (statusFilter === 'tamamlandi' && !isDone) return false
      if (statusFilter === 'bekleyen' && isDone) return false
      const musteri = musteriler.find((m) => m.id === item.musteri_id)
      return includesSearch([item.cek_no, item.banka, item.aciklama, item.durum, musteri?.ad, musteri?.kisa_ad], search)
    })
  }, [cekler, musteriler, reportType, search, selectedMusteri, statusFilter])

  const cekReportRows = useMemo(() => {
    const grouped = new Map<string, Cek[]>()

    filteredCekler.forEach((item) => {
      const musteriAdi =
        musteriler.find((m) => m.id === item.musteri_id)?.kisa_ad ||
        musteriler.find((m) => m.id === item.musteri_id)?.ad ||
        'Diger'

      if (!grouped.has(musteriAdi)) grouped.set(musteriAdi, [])
      grouped.get(musteriAdi)?.push(item)
    })

    const rows: (string | number)[][] = []

    Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
      .forEach(([musteriAdi, items]) => {
        items.forEach((item) => {
          rows.push([
            item.tip === 'alinan' ? 'Alinan' : 'Verilen',
            musteriAdi,
            item.cek_no,
            item.banka || '-',
            formatDate(item.vade_tarihi),
            item.durum,
            item.tutar,
            item.aciklama || '-',
          ])
        })

        rows.push([
          '',
          `${musteriAdi} Ara Toplam`,
          '',
          '',
          '',
          '',
          items.reduce((sum, item) => sum + Number(item.tutar || 0), 0),
          '',
        ])
      })

    if (rows.length > 0) {
      rows.push([
        '',
        'Genel Toplam',
        '',
        '',
        '',
        '',
        filteredCekler.reduce((sum, item) => sum + Number(item.tutar || 0), 0),
        '',
      ])
    }

    return rows
  }, [filteredCekler, musteriler])

  const filteredKasa = useMemo(() => {
    return kasa.filter((item) => {
      if (reportType !== 'all' && reportType !== 'kasa') return false
      const isIncome = (item.tur || item.hareket_turu) === 'gelir'
      if (statusFilter === 'tamamlandi' && !isIncome) return false
      if (statusFilter === 'bekleyen' && isIncome) return false
      return includesSearch([item.kategori, item.aciklama, item.odeme_sekli, item.tur, item.hareket_turu], search)
    })
  }, [kasa, reportType, search, statusFilter])

  const sheets = useMemo(() => {
    const gunlukSheet: ReportSheet = {
      key: 'gunluk',
      title: 'Gunluk Isler Raporu',
      subtitle: `${firma.ad} · ${PERIOD_LABEL[period]} · Operasyonel takip listesi`,
      accent: '193B6A',
      headers: ['Tarih', 'Baslik', 'Oncelik', 'Durum', 'Hatirlatici', 'Aciklama'],
      rows: filteredGunluk.map((item) => [
        formatDate(item.tarih),
        item.baslik,
        PRIORITY_LABEL[item.matris] || item.matris,
        item.durum === 'tamamlandi' ? 'Tamamlandi' : 'Bekliyor',
        item.hatirlatici || '-',
        item.aciklama || '-',
      ]),
      summary: [
        { label: 'Toplam Kayit', value: filteredGunluk.length },
        { label: 'Tamamlanan', value: filteredGunluk.filter((item) => item.durum === 'tamamlandi').length },
        { label: 'Bekleyen', value: filteredGunluk.filter((item) => item.durum !== 'tamamlandi').length },
      ],
    }

    const periyodikSheet: ReportSheet = {
      key: 'periyodik',
      title: 'Periyodik Isler Raporu',
      subtitle: `${firma.ad} · ${PERIOD_LABEL[period]} · Beyanname ve takip surecleri`,
      accent: '315BA8',
      headers: ['Donem', 'Musteri', 'Is Tipi', 'Adim 1', 'Adim 2', 'Genel Durum', 'Hatirlatma', 'Not'],
      rows: filteredIsTakip.map((item) => [
        item.donem,
        musteriler.find((m) => m.id === item.musteri_id)?.kisa_ad || musteriler.find((m) => m.id === item.musteri_id)?.ad || '-',
        IS_TIP_LABEL[item.tip] || item.tip,
        item.adim1_durum === 'tamamlandi' ? `Tamamlandi (${formatDate(item.adim1_tarihi)})` : 'Bekliyor',
        item.adim2_durum === 'tamamlandi' ? `Tamamlandi (${formatDate(item.adim2_tarihi)})` : 'Bekliyor',
        item.durum === 'tamamlandi' ? 'Tamamlandi' : 'Aktif',
        item.hatirlatici_tarihi ? `${formatDate(item.hatirlatici_tarihi)} ${item.hatirlatici_saati || ''}` : '-',
        item.notlar || '-',
      ]),
      summary: [
        { label: 'Toplam Kayit', value: filteredIsTakip.length },
        { label: 'Tamamlanan', value: filteredIsTakip.filter((item) => item.durum === 'tamamlandi').length },
        { label: 'Aktif', value: filteredIsTakip.filter((item) => item.durum !== 'tamamlandi').length },
      ],
    }

    const bordroSheet: ReportSheet = {
      key: 'bordro',
      title: 'Bordro Surecleri Raporu',
      subtitle: `${firma.ad} · ${PERIOD_LABEL[period]} · Proje bazli bordro surecleri`,
      accent: '2A7C6F',
      headers: ['Donem', 'Proje', 'Puantaj', 'Bordro', 'Teyit', 'Odeme', 'Santiye', 'Not'],
      rows: filteredBordro.map((item) => [
        item.donem,
        projeler.find((p) => p.id === item.proje_id)?.ad || '-',
        item.puantaj_durum,
        item.bordro_durum,
        item.teyit_durum,
        item.odeme_durum,
        item.santiye_durum,
        item.notlar || '-',
      ]),
      summary: [
        { label: 'Toplam Donem', value: filteredBordro.length },
        { label: 'Tam Akis Tamamlanan', value: filteredBordro.filter((item) => [item.puantaj_durum, item.bordro_durum, item.teyit_durum, item.odeme_durum, item.santiye_durum].every((step) => step === 'tamamlandi')).length },
        { label: 'Bekleyen Donem', value: filteredBordro.filter((item) => [item.puantaj_durum, item.bordro_durum, item.teyit_durum, item.odeme_durum, item.santiye_durum].some((step) => step !== 'tamamlandi')).length },
      ],
    }

    const maliyetSheet: ReportSheet = {
      key: 'maliyet',
      title: 'Aylik Maliyet Surecleri Raporu',
      subtitle: `${firma.ad} · ${PERIOD_LABEL[period]} · Donem bazli maliyet takip listesi`,
      accent: '7A4FC6',
      headers: ['Donem', 'Sorumlu', 'Son Teslim', 'E-Fatura', 'E-Arsiv', 'UTTS', 'Bordro', 'Satis', 'Genel Durum'],
      rows: filteredMaliyet.map((item) => [
        item.donem,
        kullanicilar.find((k) => k.id === item.sorumlu_id)?.ad_soyad || kullanicilar.find((k) => k.id === item.sorumlu_id)?.email || '-',
        item.teslim_gunu || '-',
        `${item.efatura_kontrol ? 'Kontrol' : '-'} / ${item.efatura_luca ? 'Luca' : '-'}`,
        `${item.earsiv_kontrol ? 'Kontrol' : '-'} / ${item.earsiv_luca ? 'Luca' : '-'}`,
        `${item.utts_kontrol ? 'Kontrol' : '-'} / ${item.utts_luca ? 'Luca' : '-'}`,
        `${item.bordro_kontrol ? 'Kontrol' : '-'} / ${item.bordro_luca ? 'Luca' : '-'}`,
        `${item.satis_kontrol ? 'Kontrol' : '-'} / ${item.satis_luca ? 'Luca' : '-'}`,
        item.durum === 'tamamlandi' ? 'Tamamlandi' : 'Bekliyor',
      ]),
      summary: [
        { label: 'Toplam Donem', value: filteredMaliyet.length },
        { label: 'Tamamlanan', value: filteredMaliyet.filter((item) => item.durum === 'tamamlandi').length },
        { label: 'Bekleyen', value: filteredMaliyet.filter((item) => item.durum !== 'tamamlandi').length },
      ],
    }

    const cekSheet: ReportSheet = {
      key: 'cekler',
      title: 'Cek Takibi Raporu',
      subtitle: `${firma.ad} · ${PERIOD_LABEL[period]} · Alinan ve verilen cek hareketleri`,
      accent: '996C1F',
      headers: ['Tip', 'Musteri', 'Cek No', 'Banka', 'Vade Tarihi', 'Durum', 'Tutar', 'Aciklama'],
      rows: cekReportRows,
      summary: [
        { label: 'Toplam Cek', value: filteredCekler.length },
        { label: 'Genel Toplam', value: MONEY.format(filteredCekler.reduce((sum, item) => sum + Number(item.tutar || 0), 0)) + ' TL' },
        { label: 'Bekleyen Tutar', value: MONEY.format(filteredCekler.filter((item) => item.durum === 'bekliyor').reduce((sum, item) => sum + Number(item.tutar || 0), 0)) + ' TL' },
        { label: 'Islem Gormus', value: filteredCekler.filter((item) => item.durum !== 'bekliyor').length },
      ],
    }

    const kasaSheet: ReportSheet = {
      key: 'kasa',
      title: 'Kasa Hareketleri Raporu',
      subtitle: `${firma.ad} · ${PERIOD_LABEL[period]} · Gelir ve gider hareketleri`,
      accent: '245B5A',
      headers: ['Tarih', 'Tur', 'Kategori', 'Aciklama', 'Odeme Sekli', 'Tutar'],
      rows: filteredKasa.map((item) => [
        formatDate(item.tarih),
        (item.tur || item.hareket_turu) === 'gelir' ? 'Gelir' : 'Gider',
        item.kategori || '-',
        item.aciklama || '-',
        item.odeme_sekli || '-',
        item.tutar,
      ]),
      summary: [
        { label: 'Toplam Hareket', value: filteredKasa.length },
        { label: 'Toplam Gelir', value: MONEY.format(filteredKasa.filter((item) => (item.tur || item.hareket_turu) === 'gelir').reduce((sum, item) => sum + Number(item.tutar || 0), 0)) + ' TL' },
        { label: 'Toplam Gider', value: MONEY.format(filteredKasa.filter((item) => (item.tur || item.hareket_turu) === 'gider').reduce((sum, item) => sum + Number(item.tutar || 0), 0)) + ' TL' },
      ],
    }

    return [gunlukSheet, periyodikSheet, bordroSheet, maliyetSheet, cekSheet, kasaSheet]
  }, [cekReportRows, filteredBordro, filteredCekler, filteredGunluk, filteredIsTakip, filteredKasa, filteredMaliyet, firma.ad, kullanicilar, musteriler, period, projeler])

  const cards: ReportCard[] = useMemo(() => {
    const iconMap = {
      gunluk: CalendarRange,
      periyodik: Receipt,
      bordro: BarChart3,
      maliyet: FileSpreadsheet,
      cekler: Landmark,
      kasa: Wallet,
    }

    return sheets.map((sheet) => ({
      key: sheet.key,
      title: sheet.title,
      description: sheet.subtitle,
      icon: iconMap[sheet.key as keyof typeof iconMap] || FileText,
      accent: sheet.accent,
      count: sheet.rows.length,
      exportExcel: async () => {
        setExporting(`${sheet.key}-xlsx`)
        await exportStyledExcel(`${sheet.title}-${new Date().toISOString().slice(0, 10)}`, sheet)
        setExporting(null)
      },
      exportPdf: async () => {
        setExporting(`${sheet.key}-pdf`)
        await exportStyledPdf(`${sheet.title}-${new Date().toISOString().slice(0, 10)}`, sheet)
        setExporting(null)
      },
    }))
  }, [sheets])

  const visibleSheets = useMemo(() => {
    if (reportType === 'all') return sheets
    return sheets.filter((sheet) => sheet.key === reportType)
  }, [reportType, sheets])

  const visibleCards = useMemo(() => {
    const visibleKeys = new Set(visibleSheets.map((sheet) => sheet.key))
    return cards.filter((card) => visibleKeys.has(card.key))
  }, [cards, visibleSheets])

  const totalVisibleRows = useMemo(
    () => visibleSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
    [visibleSheets]
  )

  async function exportAllSheets() {
    setExporting('all-xlsx')
    await exportStyledExcel(`Tum-Surecler-Raporu-${new Date().toISOString().slice(0, 10)}`, visibleSheets)
    setExporting(null)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[rgba(116,166,255,0.82)]">Rapor Merkezi</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Profesyonel Excel ve PDF surec raporlari</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[rgba(230,236,245,0.72)]">
              Tum surecler icin kurumsal formatta disa aktarim alin. Tek bir Excel dosyasi icinde tum surecler ayri sheet olarak olusturulur;
              ayrica her surec icin ozel PDF ve Excel ciktilari uretilir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select className={cls.input} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button onClick={exportAllSheets} className={cls.btnPrimary} disabled={exporting === 'all-xlsx'}>
              <FileSpreadsheet size={16} /> {exporting === 'all-xlsx' ? 'Hazirlaniyor...' : reportType === 'all' ? 'Tum Surecler Tek Excel' : 'Secili Raporu Excel Al'}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Gelismis Filtreler</h2>
              <p className="mt-1 text-sm text-[rgba(230,236,245,0.64)]">
                Raporlari surec turu, musteri, proje, sorumlu, durum ve serbest arama kriterlerine gore daraltin.
              </p>
            </div>
            <button
              onClick={() => {
                setReportType('all')
                setSelectedMusteri('all')
                setSelectedProje('all')
                setSelectedKullanici('all')
                setStatusFilter('all')
                setSearch('')
              }}
              className={cls.btnSecondary}
            >
              Filtreleri Temizle
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select className={cls.input} value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
              {REPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className={cls.input} value={selectedMusteri} onChange={(e) => { setSelectedMusteri(e.target.value); setSelectedProje('all') }}>
              <option value="all">Tum Musteriler</option>
              {musteriler.map((item) => <option key={item.id} value={item.id}>{item.kisa_ad || item.ad}</option>)}
            </select>
            <select className={`${cls.input} ${reportType === 'gunluk' || reportType === 'maliyet' || reportType === 'kasa' ? 'opacity-60' : ''}`} value={selectedProje} onChange={(e) => setSelectedProje(e.target.value)} disabled={reportType === 'gunluk' || reportType === 'maliyet' || reportType === 'kasa'}>
              <option value="all">Tum Projeler</option>
              {projeOptions.map((item) => <option key={item.id} value={item.id}>{item.ad}</option>)}
            </select>
            <select className={`${cls.input} ${reportType !== 'all' && reportType !== 'maliyet' ? 'opacity-60' : ''}`} value={selectedKullanici} onChange={(e) => setSelectedKullanici(e.target.value)} disabled={reportType !== 'all' && reportType !== 'maliyet'}>
              <option value="all">Tum Sorumlular</option>
              {kullanicilar.map((item) => <option key={item.id} value={item.id}>{item.ad_soyad || item.email}</option>)}
            </select>
            <select className={cls.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input className={cls.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Baslik, not, cek no, kategori..." />
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-[rgba(162,180,206,0.14)] bg-[rgba(8,18,34,0.52)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[rgba(155,176,206,0.64)]">Secili Surec</p>
              <p className="mt-2 text-sm font-semibold text-white">{REPORT_TYPE_OPTIONS.find((item) => item.value === reportType)?.label}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(162,180,206,0.14)] bg-[rgba(8,18,34,0.52)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[rgba(155,176,206,0.64)]">Gorunen Sheet</p>
              <p className="mt-2 text-sm font-semibold text-white">{visibleSheets.length}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(162,180,206,0.14)] bg-[rgba(8,18,34,0.52)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[rgba(155,176,206,0.64)]">Toplam Kayit</p>
              <p className="mt-2 text-sm font-semibold text-white">{totalVisibleRows}</p>
            </div>
            <div className="rounded-2xl border border-[rgba(162,180,206,0.14)] bg-[rgba(8,18,34,0.52)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[rgba(155,176,206,0.64)]">Durum Filtresi</p>
              <p className="mt-2 text-sm font-semibold text-white">{STATUS_OPTIONS.find((item) => item.value === statusFilter)?.label}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.key} className="glass-panel rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `#${card.accent}20`, border: `1px solid #${card.accent}35` }}>
                    <Icon size={22} style={{ color: `#${card.accent}` }} />
                  </div>
                  <h3 className="text-lg font-bold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[rgba(230,236,245,0.68)]">{card.description}</p>
                </div>
                <span className="rounded-full border border-[rgba(162,180,206,0.16)] bg-[rgba(18,32,54,0.72)] px-3 py-1 text-xs font-semibold text-[rgba(245,247,251,0.85)]">
                  {card.count} satir
                </span>
              </div>
              <div className="mt-5 flex gap-3">
                <button onClick={card.exportExcel} className={cls.btnPrimary} disabled={exporting === `${card.key}-xlsx`}>
                  <FileSpreadsheet size={15} /> {exporting === `${card.key}-xlsx` ? 'Hazirlaniyor...' : 'Excel Al'}
                </button>
                <button onClick={card.exportPdf} className={cls.btnSecondary} disabled={exporting === `${card.key}-pdf`}>
                  <FileText size={15} /> {exporting === `${card.key}-pdf` ? 'Hazirlaniyor...' : 'PDF Al'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="glass-panel rounded-3xl p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white">Rapor Kapsami</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleSheets.map((sheet) => (
            <div key={sheet.key} className="rounded-2xl border border-[rgba(162,180,206,0.14)] bg-[rgba(8,18,34,0.52)] p-4">
              <p className="text-sm font-semibold text-white">{sheet.title}</p>
              <p className="mt-1 text-xs text-[rgba(230,236,245,0.56)]">{sheet.rows.length} kayit · {sheet.headers.length} kolon</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
