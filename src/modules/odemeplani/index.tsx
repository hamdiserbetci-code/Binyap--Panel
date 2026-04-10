'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Trash2,
  Download,
  FileSpreadsheet,
  CreditCard,
  CheckCircle,
  X,
} from 'lucide-react'
import type { AppCtx } from '@/app/page'
import { ConfirmModal, ErrorMsg, Field, Loading, cls } from '@/components/ui'
import { supabase } from '@/lib/supabase'

type OdemeKaydi = {
  id: string
  created_at: string
  firma_id: string
  user_id: string
  proje_id: string | null
  musteri_id: string | null
  baslik: string
  tur: string
  kaynak: string
  cari_ekip: string | null
  vade: string
  durum: string
  hatirlatma: string | null
  tutar: number
  aciklama?: string | null
  cari_hesap?: string | null
  ertelendi_mi?: boolean
  ertelenen_tarih?: string | null
  erteleme_nedeni?: string | null
  readonly?: boolean
}

function parseSafeDateStr(val: any): string {
  if (!val) return ''
  let str = String(val).trim()
  if (str.includes('T')) str = str.split('T')[0]
  if (str.includes(' ')) str = str.split(' ')[0]
  if (str.includes('.')) {
    const p = str.split('.')
    if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1]}-${p[0]}`
  }
  if (str.includes('/')) {
    const p = str.split('/')
    if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1]}-${p[0]}`
  }
  return str
}

function getSafeTime(val: any, isEnd = false): number {
  const str = parseSafeDateStr(val)
  if (!str) return NaN
  const d = new Date(`${str}${isEnd ? 'T23:59:59' : 'T00:00:00'}`)
  return d.getTime()
}

type Proje = {
  id: string
  ad: string
  firma_id: string
}


const TUR_SECENEKLERI = [
  'Vergi Odemeleri',
  'SGK Odemeleri',
  'Maas Odemeleri',
  'Cari Hesap Odemeleri',
  'Diger Odemeler',
  'Cek Odemeleri',
]

const MANUEL_TUR_SECENEKLERI = [
  'Vergi Odemeleri',
  'SGK Odemeleri',
  'Maas Odemeleri',
  'Cari Hesap Odemeleri',
  'Diger Odemeler',
]

const KAYNAK_SECENEKLERI = ['Odeme Plani']

const EMPTY_FORM: Partial<OdemeKaydi> = {
  baslik: '',
  tur: 'Vergi Odemeleri',
  kaynak: 'Odeme Plani',
  cari_ekip: '',
  vade: new Date().toISOString().split('T')[0],
  durum: 'odenecek',
  hatirlatma: '',
  tutar: 0,
  proje_id: '',
  musteri_id: '',
}

function toNumber(val: unknown) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0

  const normalized = String(val)
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  const num = Number(normalized)
  return Number.isFinite(num) ? num : 0
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(value)
}

function sortByDateAsc(items: OdemeKaydi[]) {
  return [...items].sort((a, b) => {
    const aTime = getSafeTime(a.vade) || 0
    const bTime = getSafeTime(b.vade) || 0
    return aTime - bTime
  })
}

function cleanTr(text: string) {
  return String(text ?? '')
    .replace(/İ/g, 'I')
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
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, '-')
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${parseSafeDateStr(dateStr)}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d
}

function subDays(dateStr: string, days: number) {
  const d = new Date(`${parseSafeDateStr(dateStr)}T00:00:00`)
  d.setDate(d.getDate() - days)
  return d
}

function isReminderDue(vade: string) {
  const safeVade = parseSafeDateStr(vade)
  if (!safeVade) return false
  const now = new Date()
  const reminderDate = subDays(safeVade, 3)
  return now >= reminderDate && now <= addDays(safeVade, 1)
}


function getTurColorTheme(tur: string) {
  const key = String(tur || '').toLocaleLowerCase('tr-TR')
  if (key.includes('vergi')) return { pdfFill: [254, 226, 226] as [number, number, number], pdfText: [185, 28, 28] as [number, number, number], xBg: 'FEE2E2', xText: 'B91C1C' }
  if (key.includes('sgk')) return { pdfFill: [219, 234, 254] as [number, number, number], pdfText: [30, 64, 175] as [number, number, number], xBg: 'DBEAFE', xText: '1E40AF' }
  if (key.includes('maas') || key.includes('maaş')) return { pdfFill: [220, 252, 231] as [number, number, number], pdfText: [22, 101, 52] as [number, number, number], xBg: 'DCFCE7', xText: '166534' }
  if (key.includes('cari')) return { pdfFill: [237, 233, 254] as [number, number, number], pdfText: [91, 33, 182] as [number, number, number], xBg: 'EDE9FE', xText: '5B21B6' }
  if (key.includes('cek') || key.includes('çek')) return { pdfFill: [254, 243, 199] as [number, number, number], pdfText: [146, 64, 14] as [number, number, number], xBg: 'FEF3C7', xText: '92400E' }
  return { pdfFill: [241, 245, 249] as [number, number, number], pdfText: [71, 85, 105] as [number, number, number], xBg: 'F1F5F9', xText: '475569' }
}

export default function OdemePlaniModule({ firma, firmalar, firmaIds, profil }: AppCtx) {
  const [kayitlar, setKayitlar] = useState<OdemeKaydi[]>([])
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTur, setSelectedTur] = useState('Tum')
  const [selectedProje, setSelectedProje] = useState('Tum')
  const [modal, setModal] = useState<Partial<OdemeKaydi> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [postponeItem, setPostponeItem] = useState<OdemeKaydi | null>(null)
  const [postponeDate, setPostponeDate] = useState('')
  const [postponeReason, setPostponeReason] = useState('')
  const [toast, setToast] = useState('')
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  })

  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  useEffect(() => {
    if (!firmaIds.length) return
    load()
  }, [firmaIds.join(',')])


  async function load() {
    if (!firmaIds.length) return

    setLoading(true)
    setError('')

    try {
      const [odemeRes, projeRes, cekRes] = await Promise.all([
        supabase
          .from('odeme_plani')
          .select('*')
          .in('firma_id', firmaIds)
          .order('vade', { ascending: true })
          .order('created_at', { ascending: false }),

        supabase
          .from('projeler')
          .select('id, ad, firma_id')
          .in('firma_id', firmaIds)
          .order('ad', { ascending: true }),

        supabase
          .from('cekler')
          .select('*')
          .in('firma_id', firmaIds),
      ])

      if (odemeRes.error) throw odemeRes.error
      if (projeRes.error) throw projeRes.error

      const manuel = Array.isArray(odemeRes.data) ? (odemeRes.data as OdemeKaydi[]) : []
      const projeList = Array.isArray(projeRes.data) ? (projeRes.data as Proje[]) : []

      const cekMapped: OdemeKaydi[] = Array.isArray(cekRes.data)
        ? cekRes.data.map((c: any) => ({
            id: String(c.id),
            created_at: c.created_at || new Date().toISOString(),
            firma_id: c.firma_id,
            user_id: c.user_id || '',
            proje_id: c.proje_id || null,
            musteri_id: c.musteri_id || null,
            baslik: c.baslik || c.no || c.cek_no ? `Cek ${c.no || c.cek_no || ''}`.trim() : 'Cek',
            tur: 'Cek Odemeleri',
            kaynak: 'Cek Takibi',
            cari_ekip: c.cari_ekip || c.firma_adi || c.cari || null,
            cari_hesap: c.cari_hesap || c.cari_ekip || c.firma_adi || c.cari || null,
            vade: c.vade || c.vade_tarihi || new Date().toISOString().split('T')[0],
            durum: ['tahsil_edildi', 'odendi'].includes(c.durum) ? 'odendi' : 'odenecek',
            hatirlatma: null,
            tutar: toNumber(c.tutar),
            readonly: true,
          }))
        : []

      setKayitlar([...manuel, ...cekMapped])
      setProjeler(projeList)
    } catch (err: any) {
      setError(err?.message || 'Odeme verileri alinamadi.')
      setKayitlar([])
      setProjeler([])
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    const baslik = String(modal?.baslik || '').trim()
    const tur = String(modal?.tur || '').trim()
    const kaynak = String(modal?.kaynak || '').trim()
    const cari_ekip = String(modal?.cari_ekip || '').trim()
    const vade = String(modal?.vade || '').trim()
    const durum = String(modal?.durum || '').trim()
    const hatirlatma = String(modal?.hatirlatma || '').trim()
    const tutar = toNumber(modal?.tutar)
    const proje_id = String(modal?.proje_id || '').trim()
    const musteri_id = ''

    if (!baslik || !tur || !kaynak || !vade || !durum || tutar <= 0) {
      alert('Baslik, tur, kaynak, vade, durum ve tutar zorunludur.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        firma_id: modal && (modal as any).id ? ((modal as any).firma_id || firma.id) : selFirmaId,
        user_id: profil.id,
        proje_id: proje_id || null,
        musteri_id: musteri_id || null,
        baslik,
        tur,
        kaynak,
        cari_ekip: cari_ekip || null,
        vade,
        durum,
        hatirlatma: hatirlatma || null,
        tutar,
      }

      const isUpdate = !!(modal && modal.id)
      const { error: saveError } = isUpdate
        ? await supabase.from('odeme_plani').update(payload).eq('id', modal!.id)
        : await supabase.from('odeme_plani').insert(payload)

      if (saveError) throw saveError

      setModal(null)
      setToast(isUpdate ? 'Kayıt başarıyla güncellendi!' : 'Ödeme başarıyla eklendi!')
      setTimeout(() => setToast(''), 3000)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Kayit kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteKayit() {
    if (!deleteId) return

    try {
      const { error: deleteError } = await supabase.from('odeme_plani').delete().eq('id', deleteId)
      if (deleteError) throw deleteError
      setDeleteId(null)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Kayit silinemedi.')
    }
  }

  async function postponeKayit() {
    if (!postponeItem || !postponeDate) return

    try {
      const { error: postponeError } = await supabase
        .from('odeme_plani')
        .update({
          vade: postponeDate,
          ertelendi_mi: true,
          ertelenen_tarih: postponeDate,
          erteleme_nedeni: postponeReason || null,
          hatirlatma: `${postponeDate}T09:00`,
        })
        .eq('id', postponeItem.id)

      if (postponeError) throw postponeError

      setPostponeItem(null)
      setPostponeDate('')
      setPostponeReason('')
      await load()
    } catch (err: any) {
      alert(err?.message || 'Erteleme yapilamadi.')
    }
  }

  const projeMap = useMemo(() => {
    return Object.fromEntries(projeler.map((p) => [p.id, p]))
  }, [projeler])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR')
    const hasStart = !!dateRange.start
    const hasEnd = !!dateRange.end
    const startDate = hasStart ? getSafeTime(dateRange.start) : 0
    const endDate = hasEnd ? getSafeTime(dateRange.end, true) : Infinity

    const result = kayitlar.filter((item) => {
      const itemDate = getSafeTime(item.vade)
      if (hasStart || hasEnd) {
        if (Number.isNaN(itemDate)) return false
        if (hasStart && itemDate < startDate) return false
        if (hasEnd && itemDate > endDate) return false
      }
      if (selectedTur !== 'Tum' && item.tur !== selectedTur) return false
      if (selectedProje !== 'Tum' && (item.proje_id || '') !== selectedProje) return false

      if (!needle) return true

      const projeAdi = item.proje_id ? projeMap[item.proje_id]?.ad : ''

      return [
        item.baslik,
        item.tur,
        item.kaynak,
        item.cari_ekip,
        item.durum,
        projeAdi,
        String(item.tutar),
      ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(needle))
    })

    return sortByDateAsc(result)
  }, [kayitlar, query, dateRange, selectedTur, selectedProje, projeMap])

  const stats = useMemo(() => {
    const toplam    = filtered.reduce((sum, x) => sum + toNumber(x.tutar), 0)
    const bekleyen  = filtered.filter(x => x.durum === 'odenecek').reduce((sum, x) => sum + toNumber(x.tutar), 0)
    const odenen    = filtered.filter(x => x.durum === 'odendi').reduce((sum, x) => sum + toNumber(x.tutar), 0)
    return { toplam, bekleyen, odenen }
  }, [filtered])


  // Panelde sadece bekleyen ödemeler — Excel için `filtered` değişmez
  const panelGrouped = useMemo(() => {
    const pending = filtered.filter(x => x.durum !== 'odendi')
    const groupedMap = pending.reduce((acc, item) => {
      const key = item.tur || 'Diger Odemeler'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {} as Record<string, OdemeKaydi[]>)
    const orderedEntries = Object.entries(groupedMap).sort((a, b) => {
      const aTime = a[1][0] ? (getSafeTime(a[1][0].vade) || 0) : 0
      const bTime = b[1][0] ? (getSafeTime(b[1][0].vade) || 0) : 0
      return aTime - bTime
    })
    return Object.fromEntries(orderedEntries)
  }, [filtered])

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  useEffect(() => {
    const nextState: Record<string, boolean> = {}
    Object.keys(panelGrouped).forEach((groupName) => {
      nextState[groupName] = expandedGroups[groupName] ?? false  // varsayılan kapalı
    })
    setExpandedGroups(nextState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(panelGrouped).join('|')])

  async function exportPDF() {
  try {
    const jsPDFModule = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const jsPDF = jsPDFModule.default
    const autoTable = autoTableModule.default
    const doc = new jsPDF('l', 'mm', 'a4')
    const W = doc.internal.pageSize.width
    const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })

    const toplamTutar = filtered.reduce((s, x) => s + toNumber(x.tutar), 0)
    const bekleyenTutar = filtered.filter(x => x.durum === 'odenecek').reduce((s, x) => s + toNumber(x.tutar), 0)
    const odenenTutar  = filtered.filter(x => x.durum === 'odendi').reduce((s, x) => s + toNumber(x.tutar), 0)
    const odemeYapilan = (item: OdemeKaydi) =>
      item.cari_ekip || '-'
    const cariHesap = (item: OdemeKaydi) =>
      item.cari_hesap || (String(item.tur || '').toLocaleLowerCase('tr-TR').includes('cek') ? (item.cari_ekip || '-') : '-')

    // ── Header band ─────────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, W, 22, 'F')
    doc.setFillColor(37, 99, 235)
    doc.rect(0, 22, W, 3, 'F')

    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(255, 255, 255)
    doc.text(cleanTr(firma.ad || ''), 14, 14)

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('ODEME PLANI RAPORU', W - 14, 10, { align: 'right' })
    doc.text(cleanTr(`Donem: ${dateRange.start || 'Tumu'} - ${dateRange.end || 'Tumu'}`), W - 14, 16, { align: 'right' })

    // ── Summary cards ────────────────────────────────────────────────────────
    const cards = [
      { label: 'Toplam Tutar',   value: formatMoney(toplamTutar),  bg: [30, 41, 59]   as [number,number,number], accent: [99, 102, 241] as [number,number,number] },
      { label: 'Bekleyen',       value: formatMoney(bekleyenTutar), bg: [30, 41, 59]   as [number,number,number], accent: [234, 179, 8]  as [number,number,number] },
      { label: 'Odenen',         value: formatMoney(odenenTutar),   bg: [30, 41, 59]   as [number,number,number], accent: [16, 185, 129] as [number,number,number] },
      { label: 'Kayit Sayisi',   value: String(filtered.length) + ' adet', bg: [30, 41, 59] as [number,number,number], accent: [148, 163, 184] as [number,number,number] },
    ]
    const cardW = (W - 28 - 9) / 4
    cards.forEach((c, i) => {
      const x = 14 + i * (cardW + 3)
      doc.setFillColor(...c.bg)
      doc.roundedRect(x, 28, cardW, 16, 2, 2, 'F')
      doc.setFillColor(...c.accent)
      doc.roundedRect(x, 28, 2, 16, 1, 1, 'F')
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(cleanTr(c.label.toUpperCase()), x + 5, 34)
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(cleanTr(c.value), x + 5, 40)
    })

    // ── Table ────────────────────────────────────────────────────────────────
    const durumLabel = (d: string) => ({ odenecek: 'Ödenecek', odendi: 'Ödendi' }[d] || d)

    autoTable(doc, {
      startY: 48,
      head: [['Baslik', 'Tur', 'Odeme Yapilan', 'Cari Hesap', 'Proje', 'Vade', 'Durum', 'Tutar (TRY)', 'Aciklama']],
      body: filtered.map((item) => [
        cleanTr(item.baslik),
        cleanTr(item.tur),
        cleanTr(odemeYapilan(item)),
        cleanTr(cariHesap(item)),
        cleanTr(item.proje_id ? (projeMap[item.proje_id]?.ad || '-') : '-'),
        (item.vade && parseSafeDateStr(item.vade)) ? new Date(`${parseSafeDateStr(item.vade)}T00:00:00`).toLocaleDateString('tr-TR') : '-',
        cleanTr(durumLabel(item.durum)),
        new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(toNumber(item.tutar)),
        cleanTr(item.aciklama || '-'),
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', textColor: [30, 41, 59] },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 24 },
        2: { cellWidth: 33 },
        3: { cellWidth: 28 },
        4: { cellWidth: 24 },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 20, halign: 'center' },
        7: { cellWidth: 22, halign: 'right' },
        8: { cellWidth: 50 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const tur = filtered[data.row.index]?.tur || ''
          const tone = getTurColorTheme(tur)
          data.cell.styles.fillColor = tone.pdfFill
          data.cell.styles.textColor = tone.pdfText
          data.cell.styles.fontStyle = 'bold'
        }
        if (data.section === 'body' && data.column.index === 6) {
          const d = filtered[data.row.index]?.durum
          if (d === 'odendi')    { data.cell.styles.textColor = [5, 150, 105];   data.cell.styles.fontStyle = 'bold' }
          if (d === 'odenecek')  { data.cell.styles.textColor = [161, 98, 7] }
        }
        if (data.section === 'body' && data.column.index === 7) {
          data.cell.styles.fontStyle = 'bold'
        }
      },
      foot: [[
        { content: 'GENEL TOPLAM', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255 } },
        { content: new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(toplamTutar), styles: { halign: 'right', fontStyle: 'bold', fillColor: [37, 99, 235], textColor: 255 } },
        { content: '-', styles: { halign: 'center', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255 } },
      ]],
      footStyles: { fontSize: 9 },
      margin: { left: 14, right: 14, bottom: 14 },
      didDrawPage: (data) => {
        const pageH = doc.internal.pageSize.height
        doc.setFillColor(15, 23, 42)
        doc.rect(0, pageH - 10, W, 10, 'F')
        doc.setFont('Helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text(cleanTr(`${firma.ad} - Odeme Plani Raporu`), 14, pageH - 4)
        doc.text(cleanTr(`Olusturulma: ${today}  |  Sayfa ${data.pageNumber}`), W - 14, pageH - 4, { align: 'right' })
      },
    })

    doc.save(`Odeme-Plani_${firma.ad}_${dateRange.start || 'Tumu'}_${dateRange.end || 'Tumu'}.pdf`)
  } catch (err) {
    console.error('PDF oluşturma hatası:', err)
    alert('PDF oluşturulamadı: ' + (err instanceof Error ? err.message : String(err)))
  }
  }

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    type S = Record<string, any>
    const sc = (v: any, t: string, s: S = {}) => ({ v, t, s })

    // ── Renk paleti ──────────────────────────────────────────────
    const P = {
      navy0:   '0A1628',  // en koyu lacivert (header bg)
      navy1:   '0F2044',  // koyu lacivert
      navy2:   '1A3461',  // orta lacivert (col header)
      navy3:   '1E4080',  // açık lacivert (accent)
      silver:  'E8EDF4',  // tablo ayırıcı
      white:   'FFFFFF',
      row0:    'FFFFFF',  // normal satır
      row1:    'F4F7FB',  // alternatif satır (zebra)
      text:    '1E293B',  // ana metin
      textSub: '64748B',  // ikincil metin
      textMut: 'B0BEC5',  // soluk metin
      // Tutar
      tutar0:  'EBF3FF',  // tutar hücresi bg
      tutar1:  'D6E8FF',  // tutar alt satır bg
      tutarTx: '1A3461',  // tutar metin
      // Ödenen
      paid0:   'EDFAF1',
      paid1:   'D5F0E0',
      paidTx:  '145A32',
      paidBdr: '52BE80',
      // Kalan
      kalan0:  'FEF9EC',
      kalan1:  'FDEFC8',
      kalanTx: '7D4E00',
      kalanBdr:'F0B429',
      // Durum
      dOdTx:   '14532D',
      dOdBg:   'D1FAE5',
      dOdBdr:  '6EE7B7',
      dBkTx:   '78350F',
      dBkBg:   'FEF3C7',
      dBkBdr:  'FCD34D',
      // Toplam satırı
      totBg:   '0A1628',
      totTutar:'1D4ED8',
      totPaid: '15803D',
      totKalan:'B45309',
    }

    // ── Border yardımcıları ───────────────────────────────────────
    const bd = (color: string, style: 'thin'|'medium'|'hair' = 'thin') =>
      ({ style, color: { rgb: color } })
    const bAll = (c: string, s: 'thin'|'medium'|'hair' = 'thin') =>
      ({ top: bd(c,s), bottom: bd(c,s), left: bd(c,s), right: bd(c,s) })
    const bInner = (c = 'D4DCE8') =>
      ({ top: bd(c), bottom: bd(c), left: bd(c), right: bd(c) })

    // ── Boş hücre ────────────────────────────────────────────────
    const empty = (bg = P.navy0): S => sc('', 's', { fill: { fgColor: { rgb: bg } } })

    // ── Başlık bandı ─────────────────────────────────────────────
    const mainHeader = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 20, color: { rgb: P.white }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy0 } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    })
    const subHeader = (v: string): S => sc(v, 's', {
      font:      { italic: true, sz: 9, color: { rgb: '8FA8C8' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy1 } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    })
    const logoCell = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 10, color: { rgb: '8FA8C8' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy0 } },
      alignment: { horizontal: 'right', vertical: 'center' },
    })

    // ── KPI kartları ─────────────────────────────────────────────
    const kpiLabel = (v: string, bg: string, fc: string): S => sc(v, 's', {
      font:      { bold: true, sz: 8, color: { rgb: fc }, name: 'Calibri' },
      fill:      { fgColor: { rgb: bg } },
      alignment: { horizontal: 'center', vertical: 'bottom' },
      border:    { top: bd(bg), left: bd(bg), right: bd(bg), bottom: bd('D4DCE8', 'hair') },
    })
    const kpiValue = (v: string, bg: string, fc: string): S => sc(v, 's', {
      font:      { bold: true, sz: 15, color: { rgb: fc }, name: 'Calibri' },
      fill:      { fgColor: { rgb: bg } },
      alignment: { horizontal: 'center', vertical: 'top' },
      border:    { top: bd('D4DCE8', 'hair'), left: bd(bg), right: bd(bg), bottom: bd(bg) },
    })

    // ── Kolon başlıkları ─────────────────────────────────────────
    const colHead = (v: string, align = 'left'): S => sc(v, 's', {
      font:      { bold: true, sz: 9, color: { rgb: P.white }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy2 } },
      alignment: { horizontal: align, vertical: 'center' },
      border:    { top: bd(P.navy3,'medium'), bottom: bd(P.navy3,'medium'), left: bd(P.navy1), right: bd(P.navy1) },
    })
    const colHeadMoney = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 9, color: { rgb: 'BDD8F5' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy2 } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    { top: bd(P.navy3,'medium'), bottom: bd(P.navy3,'medium'), left: bd(P.navy1), right: bd(P.navy1) },
    })
    const colHeadPaid = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 9, color: { rgb: '86EFAC' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy2 } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    { top: bd(P.navy3,'medium'), bottom: bd(P.navy3,'medium'), left: bd(P.navy1), right: bd(P.navy1) },
    })
    const colHeadKalan = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 9, color: { rgb: 'FDE68A' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy2 } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    { top: bd(P.navy3,'medium'), bottom: bd(P.navy3,'medium'), left: bd(P.navy1), right: bd(P.navy1) },
    })

    // ── Veri hücreleri ───────────────────────────────────────────
    const cell = (v: string, align: 'left'|'center'|'right' = 'left', bold = false, alt = false): S => sc(v, 's', {
      font:      { sz: 9, bold, name: 'Calibri', color: { rgb: P.text } },
      fill:      { fgColor: { rgb: alt ? P.row1 : P.row0 } },
      alignment: { horizontal: align, vertical: 'center', wrapText: true },
      border:    bInner(),
    })
    const seqCell = (n: number, alt = false): S => sc(n, 'n', {
      font:      { sz: 8, name: 'Calibri', color: { rgb: P.textMut } },
      fill:      { fgColor: { rgb: alt ? P.row1 : P.row0 } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    bInner(),
    })
    const numFmt = '#,##0.00'
    const tutarCell = (v: number, alt = false): S => sc(v, 'n', {
      font:      { sz: 9, bold: true, name: 'Calibri', color: { rgb: P.tutarTx } },
      fill:      { fgColor: { rgb: alt ? P.tutar1 : P.tutar0 } },
      numFmt,
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bInner('A8C4E8'),
    })
    const paidCell = (v: number, alt = false): S => sc(v, 'n', {
      font:      { sz: 9, bold: true, name: 'Calibri', color: { rgb: P.paidTx } },
      fill:      { fgColor: { rgb: alt ? P.paid1 : P.paid0 } },
      numFmt,
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bInner(P.paidBdr),
    })
    const kalanCell = (v: number, alt = false): S => sc(v, 'n', {
      font:      { sz: 9, bold: true, name: 'Calibri', color: { rgb: P.kalanTx } },
      fill:      { fgColor: { rgb: alt ? P.kalan1 : P.kalan0 } },
      numFmt,
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bInner(P.kalanBdr),
    })
    const zeroDash = (alt = false): S => sc('-', 's', {
      font:      { sz: 9, name: 'Calibri', color: { rgb: P.textMut } },
      fill:      { fgColor: { rgb: alt ? P.row1 : P.row0 } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bInner(),
    })

    const durumCell = (d: string, alt = false): S => {
      const isOdendi = d === 'odendi'
      return sc(isOdendi ? 'Odendi' : 'Bekliyor', 's', {
        font:      { sz: 8, bold: true, color: { rgb: isOdendi ? P.dOdTx : P.dBkTx }, name: 'Calibri' },
        fill:      { fgColor: { rgb: isOdendi ? P.dOdBg : P.dBkBg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    bAll(isOdendi ? P.dOdBdr : P.dBkBdr, 'hair'),
      })
    }
    const turCell = (tur: string, alt = false): S => {
      const tone = getTurColorTheme(tur)
      return sc(cleanTr(tur || '-'), 's', {
        font:      { sz: 8, bold: true, color: { rgb: tone.xText }, name: 'Calibri' },
        fill:      { fgColor: { rgb: tone.xBg } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border:    bInner(tone.xBg),
      })
    }

    // ── Toplam satırı ────────────────────────────────────────────
    const totEmpty = (): S => sc('', 's', {
      fill:  { fgColor: { rgb: P.totBg } },
      border: bInner(P.navy1),
    })
    const totLabel = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 9, color: { rgb: '94A3B8' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.totBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bInner(P.navy1),
    })
    const totNum = (v: number, bg: string, fc: string): S => sc(v, 'n', {
      font:      { bold: true, sz: 11, color: { rgb: fc }, name: 'Calibri' },
      fill:      { fgColor: { rgb: bg } },
      numFmt,
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bAll(bg),
    })

    // ── Hesaplamalar ─────────────────────────────────────────────
    const toplamTutar   = filtered.reduce((s, x) => s + toNumber(x.tutar), 0)
    const odenenTutar   = filtered.filter(x => x.durum === 'odendi').reduce((s, x) => s + toNumber(x.tutar), 0)
    const bekleyenTutar = filtered.filter(x => x.durum === 'odenecek').reduce((s, x) => s + toNumber(x.tutar), 0)
    const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(n) + ' TL'
    const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    const odemeYapilan = (item: OdemeKaydi) =>
      item.cari_ekip || '-'
    const cariHesap = (item: OdemeKaydi) =>
      item.cari_hesap || (String(item.tur || '').toLocaleLowerCase('tr-TR').includes('cek') ? (item.cari_ekip || '-') : '-')

    // ── Tablo (AOA) ──────────────────────────────────────────────
    // Kolon sırası:  # | Başlık | Tür | Ödeme Yapılan | Cari Hesap | Proje | Vade | Durum | Tutar | Ödenen | Kalan | Açıklama
    const COLS = 12
    // Kolon grup başlıkları (satır 6): bilgi grubu + finansal grup
    const grpInfo = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 7, color: { rgb: '8FA8C8' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy1 } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    { top: bd(P.navy0,'medium'), bottom: bd(P.navy2,'thin'), left: bd(P.navy0), right: bd(P.navy0) },
    })
    const grpMoney = (v: string, fc: string): S => sc(v, 's', {
      font:      { bold: true, sz: 7, color: { rgb: fc }, name: 'Calibri' },
      fill:      { fgColor: { rgb: P.navy1 } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    { top: bd(P.navy0,'medium'), bottom: bd(P.navy2,'thin'), left: bd(P.navy0), right: bd(P.navy0) },
    })

    const aoa: any[][] = [
      // ── Satır 1: Şirket adı (sol) + tarih aralığı (sağ) ────────
      [
        mainHeader(cleanTr(firma.ad || 'Firma')),
        ...Array(COLS - 3).fill(empty(P.navy0)),
        logoCell('ODEME PLANI'),
        logoCell(dateRange.start || 'Tum Tarihler'),
        logoCell(dateRange.end ? ('— ' + dateRange.end) : ''),
      ],
      // ── Satır 2: Alt başlık ─────────────────────────────────────
      [
        subHeader(cleanTr(`Rapor Tarihi: ${today}  |  Toplam ${filtered.length} kayit  |  Donem: ${dateRange.start || 'Baslangic'} - ${dateRange.end || 'Bitis'}`)),
        ...Array(COLS - 1).fill(empty(P.navy1)),
      ],
      // ── Satır 3: İnce ayırıcı ───────────────────────────────────
      Array(COLS).fill(sc('', 's', { fill: { fgColor: { rgb: P.navy3 } }, border: bAll(P.navy3) })),
      // ── Satır 4: KPI etiketleri ─────────────────────────────────
      [
        kpiLabel('TOPLAM TUTAR (TL)', 'EBF3FF', '1A3461'),
        kpiLabel('TOPLAM TUTAR (TL)', 'EBF3FF', '1A3461'),
        kpiLabel('TOPLAM TUTAR (TL)', 'EBF3FF', '1A3461'),
        kpiLabel('ODENEN TUTAR (TL)', 'E8F8F0', '145A32'),
        kpiLabel('ODENEN TUTAR (TL)', 'E8F8F0', '145A32'),
        kpiLabel('ODENEN TUTAR (TL)', 'E8F8F0', '145A32'),
        kpiLabel('KALAN BAKİYE (TL)', 'FEF9EC', '7D4E00'),
        kpiLabel('KALAN BAKİYE (TL)', 'FEF9EC', '7D4E00'),
        kpiLabel('KALAN BAKİYE (TL)', 'FEF9EC', '7D4E00'),
        kpiLabel('ODENEN KAYIT', 'F4F7FB', '2E4A7F'),
        kpiLabel('BEKLEYEN KAYIT', 'FEF9EC', '7D4E00'),
        kpiLabel('TOPLAM', 'F4F7FB', '2E4A7F'),
      ],
      // ── Satır 5: KPI değerleri ───────────────────────────────────
      [
        kpiValue(fmt(toplamTutar), 'EBF3FF', '0D2B6E'),
        kpiValue(fmt(toplamTutar), 'EBF3FF', '0D2B6E'),
        kpiValue(fmt(toplamTutar), 'EBF3FF', '0D2B6E'),
        kpiValue(fmt(odenenTutar), 'E8F8F0', '145A32'),
        kpiValue(fmt(odenenTutar), 'E8F8F0', '145A32'),
        kpiValue(fmt(odenenTutar), 'E8F8F0', '145A32'),
        kpiValue(fmt(bekleyenTutar), 'FEF9EC', '7D4E00'),
        kpiValue(fmt(bekleyenTutar), 'FEF9EC', '7D4E00'),
        kpiValue(fmt(bekleyenTutar), 'FEF9EC', '7D4E00'),
        kpiValue(String(filtered.filter(x => x.durum === 'odendi').length) + ' adet', 'F4F7FB', '2E4A7F'),
        kpiValue(String(filtered.filter(x => x.durum === 'odenecek').length) + ' adet', 'FEF9EC', '7D4E00'),
        kpiValue(String(filtered.length) + ' adet', 'F4F7FB', '2E4A7F'),
      ],
      // ── Satır 6: Grup başlıkları ─────────────────────────────────
      [
        grpInfo(''),
        grpInfo('BILGI ALANLARI'),
        grpInfo(''),
        grpInfo(''),
        grpInfo(''),
        grpInfo(''),
        grpInfo(''),
        grpInfo(''),
        grpMoney('TUTAR', 'BDD8F5'),
        grpMoney('ODENEN', '86EFAC'),
        grpMoney('KALAN BAKIYE', 'FDE68A'),
        grpInfo(''),
      ],
      // ── Satır 7: Kolon başlıkları ────────────────────────────────
      [
        colHead('#', 'center'),
        colHead('BASLIK'),
        colHead('TUR'),
        colHead('ODEME YAPILAN'),
        colHead('CARI HESAP'),
        colHead('PROJE'),
        colHead('VADE TARIHI', 'center'),
        colHead('DURUM', 'center'),
        colHeadMoney('TUTAR (TL)'),
        colHeadPaid('ODENEN (TL)'),
        colHeadKalan('KALAN (TL)'),
        colHead('ACIKLAMA'),
      ],
      // ── Veri satırları ───────────────────────────────────────────
      ...filtered.map((item, idx) => {
        const alt = idx % 2 === 1
        const tutar = toNumber(item.tutar)
        const isOdendi = item.durum === 'odendi'
        return [
          seqCell(idx + 1, alt),
          cell(cleanTr(item.baslik), 'left', true, alt),
          turCell(item.tur, alt),
          cell(cleanTr(odemeYapilan(item)), 'left', false, alt),
          cell(cleanTr(cariHesap(item)), 'left', false, alt),
          cell(cleanTr(item.proje_id ? (projeMap[item.proje_id]?.ad || '-') : '-'), 'left', false, alt),
          cell((item.vade && parseSafeDateStr(item.vade)) ? new Date(`${parseSafeDateStr(item.vade)}T00:00:00`).toLocaleDateString('tr-TR') : '-', 'center', false, alt),
          durumCell(item.durum, alt),
          tutarCell(tutar, alt),
          isOdendi ? paidCell(tutar, alt) : zeroDash(alt),
          isOdendi ? zeroDash(alt) : kalanCell(tutar, alt),
          cell(cleanTr(item.aciklama || '-'), 'left', false, alt),
        ]
      }),
      // ── Toplam satırı ─────────────────────────────────────────────
      [
        totEmpty(), totEmpty(), totEmpty(), totEmpty(), totEmpty(), totEmpty(), totEmpty(),
        totLabel('GENEL TOPLAM  ▶'),
        totNum(toplamTutar, P.totTutar, P.white),
        totNum(odenenTutar, P.totPaid,  P.white),
        totNum(bekleyenTutar, P.totKalan, P.white),
        totEmpty(),
      ],
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Kolon genişlikleri
    ws['!cols'] = [
      { wch: 5  },  // #
      { wch: 30 },  // Başlık
      { wch: 16 },  // Tür
      { wch: 22 },  // Ödeme Yapılan
      { wch: 20 },  // Cari Hesap
      { wch: 16 },  // Proje
      { wch: 13 },  // Vade
      { wch: 11 },  // Durum
      { wch: 16 },  // Tutar
      { wch: 16 },  // Ödenen
      { wch: 16 },  // Kalan
      { wch: 34 },  // Açıklama
    ]
    // Satır yükseklikleri
    ws['!rows'] = [
      { hpt: 40 },  // Şirket adı
      { hpt: 16 },  // Alt başlık
      { hpt: 4  },  // Ayırıcı
      { hpt: 18 },  // KPI etiket
      { hpt: 30 },  // KPI değer
      { hpt: 14 },  // Grup başlık
      { hpt: 22 },  // Kolon başlık
      ...Array(filtered.length).fill({ hpt: 18 }),
      { hpt: 24 },  // Toplam
    ]
    // Birleştirmeler
    ws['!merges'] = [
      // Başlık
      { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
      // KPI satırı 4 (etiket)
      { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
      { s: { r: 3, c: 3 }, e: { r: 3, c: 5 } },
      { s: { r: 3, c: 6 }, e: { r: 3, c: 8 } },
      // KPI satırı 5 (değer)
      { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
      { s: { r: 4, c: 3 }, e: { r: 4, c: 5 } },
      { s: { r: 4, c: 6 }, e: { r: 4, c: 8 } },
      // Grup başlığı (satır 6)
      { s: { r: 5, c: 0 }, e: { r: 5, c: 0 } },
      { s: { r: 5, c: 1 }, e: { r: 5, c: 7 } },
      // Toplam satırı
      { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 6 } },
    ]
    ws['!autofilter'] = { ref: `A8:L${7 + filtered.length}` }
    ws['!freeze']     = { xSplit: 0, ySplit: 8 }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Odeme Plani')
    XLSX.writeFile(wb, `Odeme-Plani_${cleanTr(firma.ad || 'Rapor')}_${dateRange.start || 'Tumu'}_${dateRange.end || 'Tumu'}.xlsx`)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="w-full px-0">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-blue-100 bg-white px-4 py-4 shadow-xl backdrop-blur-2xl">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1fr_auto]">
            <Field label="Baslangic Tarihi">
              <input
                type="date"
                className={`${cls.input} text-sm font-medium`}
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              />
            </Field>

            <Field label="Bitis Tarihi">
              <input
                type="date"
                className={`${cls.input} text-sm font-medium`}
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              />
            </Field>

            <Field label="Tur">
              <select
                className={`${cls.input} text-sm font-medium`}
                value={selectedTur}
                onChange={(e) => setSelectedTur(e.target.value)}
              >
                <option value="Tum">Tumu</option>
                {TUR_SECENEKLERI.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Proje">
              <select
                className={`${cls.input} text-sm font-medium`}
                value={selectedProje}
                onChange={(e) => setSelectedProje(e.target.value)}
              >
                <option value="Tum">Tum Projeler</option>
                <option value="">Genel Firma</option>
                {projeler.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.ad}
                  </option>
                ))}
              </select>
            </Field>

            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-slate-500">Arama</label>
              <Search size={16} className="absolute left-4 top-[42px] -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Baslik, cari, proje..."
                className="w-full rounded-xl border border-blue-100 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium placeholder:text-slate-500 transition-colors focus:border-blue-400"
              />
            </div>

            <div className="flex items-end gap-2">
              <button onClick={exportPDF} className={`${cls.btnSecondary} transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105`}>
                <Download size={15} /> PDF
              </button>
              <button onClick={exportExcel} className={`${cls.btnSecondary} transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105`}>
                <FileSpreadsheet size={15} /> Excel
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white px-4 py-4 shadow-xl backdrop-blur-2xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-600">
                <CalendarDays size={18} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Odeme Merkezi</h1>
                <p className="text-sm font-medium text-slate-500">
                  Raporlu, hatirlatmali ve ertelemeli odeme plani yonetimi.
                </p>
              </div>
            </div>

            <button onClick={() => setModal({ ...EMPTY_FORM })} className={`${cls.btnPrimary} transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105`}>
              <Plus size={15} /> Yeni Kayit
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="Toplam Tutar" value={stats.toplam} tone="cyan" money />
          <SummaryCard label="Kalan Bakiye" value={stats.bekleyen} tone="amber" money />
          <SummaryCard label="Odenen Toplam" value={stats.odenen} tone="emerald" money />
        </div>

        {Object.keys(panelGrouped).length === 0 ? (
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-14 text-center text-sm font-medium text-slate-500">Bekleyen ödeme bulunamadı.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {Object.entries(panelGrouped).map(([groupName, items]) => {
              const groupTotal = items.reduce((sum, item) => sum + toNumber(item.tutar), 0)
              const isGroupOpen = expandedGroups[groupName] ?? false
              const tone = getTurColorTheme(groupName)
              const accentColor = `#${tone.xText}`

              return (
                <div key={groupName} className="rounded-2xl border border-blue-100 bg-white overflow-hidden backdrop-blur-xl">
                  {/* Grup başlığı */}
                  <button
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-white transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-1.5 h-5 rounded-full shrink-0"
                        style={{ backgroundColor: accentColor, opacity: 0.8 }}
                      />
                      <span className="text-[14px] font-bold text-slate-800">{groupName}</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: accentColor, backgroundColor: `#${tone.xBg}22` }}
                      >
                        {items.length} kayıt
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[14px] font-bold text-slate-600">{formatMoney(groupTotal)}</span>
                      <ChevronDown
                        size={15}
                        className={`text-slate-500 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Ödeme listesi */}
                  {isGroupOpen && (
                    <div className="flex flex-col gap-1 px-4 pb-3 border-t border-blue-100">
                      {items.map((item) => {
                        const itemKey = `${item.kaynak}-${item.id}`
                        const isOpen = expandedItems.has(itemKey)
                        const vadeTarihi = (item.vade && parseSafeDateStr(item.vade))
                          ? new Date(`${parseSafeDateStr(item.vade)}T00:00:00`).toLocaleDateString('tr-TR')
                          : '-'
                        const yaklasiyor = isReminderDue(item.vade)

                        return (
                          <div key={itemKey} className="border-b border-slate-100 last:border-0">
                            {/* Ödeme başlığı */}
                            <button
                              onClick={() => toggleItem(itemKey)}
                              className="w-full flex items-center justify-between gap-2 py-2.5 hover:opacity-80 transition-opacity text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <CreditCard size={12} className="shrink-0 text-amber-400/70" />
                                <span className="text-[12px] font-medium text-slate-700 truncate">{item.baslik}</span>
                                {yaklasiyor && (
                                  <span className="shrink-0 text-[9px] font-bold text-orange-400 bg-orange-400/10 rounded-full px-1.5 py-0.5">!</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[12px] font-semibold text-slate-600">{formatMoney(toNumber(item.tutar))}</span>
                                <ChevronDown
                                  size={12}
                                  className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                />
                              </div>
                            </button>

                            {/* Detay */}
                            {isOpen && (
                              <div className="flex flex-col gap-2 pb-2.5">
                                <div className="flex items-center justify-between text-[10px] bg-white rounded-lg px-3 py-2">
                                  <span className="text-slate-500 font-medium">{vadeTarihi}</span>
                                  <span className="text-slate-400 truncate max-w-[160px] text-right">
                                    {item.cari_ekip || '-'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                                  <span>{item.proje_id ? projeMap[item.proje_id]?.ad || '-' : 'Genel Firma'}</span>
                                  {item.aciklama && <span className="truncate max-w-[180px] text-right italic text-slate-400">{item.aciklama}</span>}
                                </div>
                                {!item.readonly && (
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <button
                                      onClick={() => { setPostponeItem(item); setPostponeDate(item.vade); setPostponeReason(item.erteleme_nedeni || '') }}
                                      className="flex-1 h-7 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1"
                                    >
                                      <CalendarDays size={11} /> Ertele
                                    </button>
                                    <button
                                      onClick={() => setModal({ ...item })}
                                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteId(item.id)}
                                      className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-colors"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-md h-full bg-white border-l border-blue-100 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-blue-100 shrink-0 bg-white">
              <h3 className="text-[18px] font-bold text-slate-800 tracking-wide drop-shadow-md">
                {modal.id ? 'Kaydı Düzenle' : 'Yeni Kayıt'}
              </h3>
              <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-5">
              {!(modal as any)?.id && firmalar.length > 1 && (
                <Field label="Firma">
                  <select className={cls.input} value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                    {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Başlık" required>
                <input className={cls.input} value={modal.baslik || ''} onChange={(e) => setModal((prev) => ({ ...prev!, baslik: e.target.value }))} autoFocus />
              </Field>
              
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tutar" required>
                  <input type="number" step="0.01" min="0" className={cls.input} value={modal.tutar ?? ''} onChange={(e) => setModal((prev) => ({ ...prev!, tutar: e.target.value === '' ? 0 : Number(e.target.value) }))} />
                </Field>
                <Field label="Vade" required>
                  <input type="date" className={`${cls.input} `} value={modal.vade || ''} onChange={(e) => setModal((prev) => ({ ...prev!, vade: e.target.value }))} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Tür" required>
                  <select className={cls.input} value={modal.tur || MANUEL_TUR_SECENEKLERI[0]} onChange={(e) => setModal((prev) => ({ ...prev!, tur: e.target.value }))}>
                    {MANUEL_TUR_SECENEKLERI.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Kaynak" required>
                  <select className={cls.input} value={modal.kaynak || 'Odeme Plani'} onChange={(e) => setModal((prev) => ({ ...prev!, kaynak: e.target.value }))}>
                    {KAYNAK_SECENEKLERI.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Cari / Ekip">
                <input className={cls.input} value={modal.cari_ekip || ''} onChange={(e) => setModal((prev) => ({ ...prev!, cari_ekip: e.target.value }))} />
              </Field>

              <Field label="Proje">
                <select className={cls.input} value={modal.proje_id || ''} onChange={(e) => setModal((prev) => ({ ...prev!, proje_id: e.target.value }))}>
                  <option value="">Genel Firma</option>
                  {projeler.map((item) => <option key={item.id} value={item.id}>{item.ad}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Durum" required>
                  <select className={cls.input} value={modal.durum || 'odenecek'} onChange={(e) => setModal((prev) => ({ ...prev!, durum: e.target.value }))}>
                    <option value="odenecek">Ödenecek</option>
                    <option value="odendi">Ödendi</option>
                  </select>
                </Field>
                <Field label="Hatırlatma">
                  <div className="relative">
                    <Bell size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="datetime-local" className={`${cls.input} pl-10 `} value={modal.hatirlatma ? String(modal.hatirlatma).slice(0, 16) : ''} onChange={(e) => setModal((prev) => ({ ...prev!, hatirlatma: e.target.value }))} />
                  </div>
                </Field>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-blue-100 bg-slate-50 shrink-0 flex items-center justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105">
                İptal
              </button>
              <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {postponeItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => setPostponeItem(null)} />
          <div className="relative w-full max-w-md h-full bg-white border-l border-blue-100 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-5 border-b border-blue-100 shrink-0 bg-white">
              <h3 className="text-[18px] font-bold text-slate-800 tracking-wide drop-shadow-md">
                Ödeme Tarihini Ertele
              </h3>
              <button onClick={() => setPostponeItem(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-5">
              <Field label="Yeni Vade Tarihi" required>
                <input type="date" className={`${cls.input} `} value={postponeDate} onChange={(e) => setPostponeDate(e.target.value)} />
              </Field>
              <Field label="Erteleme Nedeni">
                <textarea className={`${cls.input} min-h-24 resize-y`} value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} placeholder="Kısa açıklama..." />
              </Field>
            </div>
            
            <div className="p-6 border-t border-blue-100 bg-slate-50 shrink-0 flex items-center justify-end gap-3">
              <button onClick={() => setPostponeItem(null)} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105">
                İptal
              </button>
              <button onClick={postponeKayit} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105">
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmModal
          title="Kaydi Sil"
          message="Bu kaydi silmek istediginizden emin misiniz?"
          danger
          onConfirm={deleteKayit}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {toast && (
        <div className="fixed top-6 right-6 z-[100] flex items-center gap-2 bg-emerald-500/90 border border-emerald-400/50 backdrop-blur-md text-slate-800 px-4 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300">
          <CheckCircle size={18} />
          <span className="text-sm font-bold tracking-wide">{toast}</span>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
  money = false,
}: {
  label: string
  value: number
  tone: 'cyan' | 'emerald' | 'amber'
  money?: boolean
}) {
  const tones = {
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold">{money ? formatMoney(value) : value}</p>
    </div>
  )
}
