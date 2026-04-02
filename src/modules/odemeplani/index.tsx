'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Search,
  Trash2,
  Download,
  FileSpreadsheet,
} from 'lucide-react'
import type { AppCtx } from '@/app/page'
import { ConfirmModal, ErrorMsg, Field, Loading, Modal, cls } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'

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
  ertelendi_mi?: boolean
  ertelenen_tarih?: string | null
  erteleme_nedeni?: string | null
  readonly?: boolean
}

type Proje = {
  id: string
  ad: string
  firma_id: string
}

type Musteri = {
  id: string
  ad: string
  kisa_ad?: string | null
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
const DURUM_SECENEKLERI = ['bekliyor', 'odendi', 'ertelendi', 'iptal']

const EMPTY_FORM: Partial<OdemeKaydi> = {
  baslik: '',
  tur: 'Vergi Odemeleri',
  kaynak: 'Odeme Plani',
  cari_ekip: '',
  vade: new Date().toISOString().split('T')[0],
  durum: 'bekliyor',
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
    const aTime = new Date(`${a.vade}T00:00:00`).getTime()
    const bTime = new Date(`${b.vade}T00:00:00`).getTime()
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
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d
}

function subDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() - days)
  return d
}

function isReminderDue(vade: string) {
  const now = new Date()
  const reminderDate = subDays(vade, 3)
  return now >= reminderDate && now <= addDays(vade, 1)
}

export default function OdemePlaniModule({ firma, profil }: AppCtx) {
  const [kayitlar, setKayitlar] = useState<OdemeKaydi[]>([])
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTur, setSelectedTur] = useState('Tum')
  const [selectedProje, setSelectedProje] = useState('Tum')
  const [selectedMusteri, setSelectedMusteri] = useState('Tum')
  const [modal, setModal] = useState<Partial<OdemeKaydi> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [postponeItem, setPostponeItem] = useState<OdemeKaydi | null>(null)
  const [postponeDate, setPostponeDate] = useState('')
  const [postponeReason, setPostponeReason] = useState('')
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date()
    return {
      start: format(startOfMonth(today), 'yyyy-MM-dd'),
      end: format(endOfMonth(today), 'yyyy-MM-dd'),
    }
  })

  useEffect(() => {
    if (!firma?.id) return
    load()
  }, [firma?.id])

  function toggleGroup(groupName: string) {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  async function load() {
    if (!firma?.id) return

    setLoading(true)
    setError('')

    try {
      const [odemeRes, projeRes, musteriRes, cekRes] = await Promise.all([
        supabase
          .from('odeme_plani')
          .select('*')
          .eq('firma_id', firma.id)
          .order('vade', { ascending: true })
          .order('created_at', { ascending: false }),

        supabase
          .from('projeler')
          .select('id, ad, firma_id')
          .eq('firma_id', firma.id)
          .order('ad', { ascending: true }),

        supabase
          .from('musteriler')
          .select('id, ad, kisa_ad')
          .eq('firma_id', firma.id)
          .eq('aktif', true)
          .order('ad', { ascending: true }),

        supabase
          .from('cekler')
          .select('*')
          .eq('firma_id', firma.id),
      ])

      if (odemeRes.error) throw odemeRes.error
      if (projeRes.error) throw projeRes.error
      if (musteriRes.error) throw musteriRes.error

      const manuel = Array.isArray(odemeRes.data) ? (odemeRes.data as OdemeKaydi[]) : []
      const projeList = Array.isArray(projeRes.data) ? (projeRes.data as Proje[]) : []
      const musteriList = Array.isArray(musteriRes.data) ? (musteriRes.data as Musteri[]) : []

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
            vade: c.vade || c.vade_tarihi || new Date().toISOString().split('T')[0],
            durum: c.durum || 'bekliyor',
            hatirlatma: null,
            tutar: toNumber(c.tutar),
            readonly: true,
          }))
        : []

      setKayitlar([...manuel, ...cekMapped])
      setProjeler(projeList)
      setMusteriler(musteriList)
    } catch (err: any) {
      setError(err?.message || 'Odeme verileri alinamadi.')
      setKayitlar([])
      setProjeler([])
      setMusteriler([])
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
    const musteri_id = String(modal?.musteri_id || '').trim()

    if (!baslik || !tur || !kaynak || !vade || !durum || tutar <= 0) {
      alert('Baslik, tur, kaynak, vade, durum ve tutar zorunludur.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        firma_id: firma.id,
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

      const { error: saveError } = modal?.id
        ? await supabase.from('odeme_plani').update(payload).eq('id', modal.id)
        : await supabase.from('odeme_plani').insert(payload)

      if (saveError) throw saveError

      setModal(null)
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

  const musteriMap = useMemo(() => {
    return Object.fromEntries(musteriler.map((m) => [m.id, m]))
  }, [musteriler])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR')
    const startDate = new Date(`${dateRange.start}T00:00:00`).getTime()
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime()

    const result = kayitlar.filter((item) => {
      const itemDate = new Date(`${item.vade}T00:00:00`).getTime()
      if (Number.isNaN(itemDate)) return false
      if (itemDate < startDate || itemDate > endDate) return false
      if (selectedTur !== 'Tum' && item.tur !== selectedTur) return false
      if (selectedProje !== 'Tum' && (item.proje_id || '') !== selectedProje) return false
      if (selectedMusteri !== 'Tum' && (item.musteri_id || '') !== selectedMusteri) return false

      if (!needle) return true

      const projeAdi = item.proje_id ? projeMap[item.proje_id]?.ad : ''
      const musteriAdi = item.musteri_id ? (musteriMap[item.musteri_id]?.kisa_ad || musteriMap[item.musteri_id]?.ad) : ''

      return [
        item.baslik,
        item.tur,
        item.kaynak,
        item.cari_ekip,
        item.durum,
        projeAdi,
        musteriAdi,
        String(item.tutar),
      ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(needle))
    })

    return sortByDateAsc(result)
  }, [kayitlar, query, dateRange, selectedTur, selectedProje, selectedMusteri, projeMap, musteriMap])

  const stats = useMemo(() => {
    const toplam = filtered.reduce((sum, x) => sum + toNumber(x.tutar), 0)
    const bekleyen = filtered.filter((x) => x.durum === 'bekliyor').length
    const odenen = filtered.filter((x) => x.durum === 'odendi').length
    return { toplam, bekleyen, odenen }
  }, [filtered])

  const grouped = useMemo(() => {
    const groupedMap = filtered.reduce((acc, item) => {
      const key = item.tur || 'Diger Odemeler'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {} as Record<string, OdemeKaydi[]>)

    const orderedEntries = Object.entries(groupedMap).sort((a, b) => {
      const aTime = a[1][0] ? new Date(`${a[1][0].vade}T00:00:00`).getTime() : 0
      const bTime = b[1][0] ? new Date(`${b[1][0].vade}T00:00:00`).getTime() : 0
      return aTime - bTime
    })

    return Object.fromEntries(orderedEntries)
  }, [filtered])

  useEffect(() => {
    const nextState: Record<string, boolean> = {}
    Object.keys(grouped).forEach((groupName) => {
      nextState[groupName] = expandedGroups[groupName] ?? true
    })
    setExpandedGroups(nextState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(grouped).join('|')])

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
    const bekleyenTutar = filtered.filter(x => x.durum === 'bekliyor').reduce((s, x) => s + toNumber(x.tutar), 0)
    const odenenTutar  = filtered.filter(x => x.durum === 'odendi').reduce((s, x) => s + toNumber(x.tutar), 0)

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
    doc.text(cleanTr(`Donem: ${dateRange.start}  —  ${dateRange.end}`), W - 14, 16, { align: 'right' })

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
    const durumLabel = (d: string) => ({ bekliyor: 'Bekliyor', odendi: 'Odendi', ertelendi: 'Ertelendi', iptal: 'Iptal' }[d] || d)

    autoTable(doc, {
      startY: 48,
      head: [['Baslik', 'Tur', 'Musteri / Cari', 'Proje', 'Vade', 'Durum', 'Tutar (TRY)']],
      body: filtered.map((item) => [
        cleanTr(item.baslik),
        cleanTr(item.tur),
        cleanTr(item.musteri_id ? (musteriMap[item.musteri_id]?.kisa_ad || musteriMap[item.musteri_id]?.ad || item.cari_ekip || '-') : (item.cari_ekip || '-')),
        cleanTr(item.proje_id ? (projeMap[item.proje_id]?.ad || '-') : '-'),
        item.vade ? new Date(`${item.vade}T00:00:00`).toLocaleDateString('tr-TR') : '-',
        cleanTr(durumLabel(item.durum)),
        new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(toNumber(item.tutar)),
      ]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, overflow: 'linebreak', textColor: [30, 41, 59] },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 38 },
        2: { cellWidth: 46 },
        3: { cellWidth: 38 },
        4: { cellWidth: 24, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 32, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const d = filtered[data.row.index]?.durum
          if (d === 'odendi')    { data.cell.styles.textColor = [5, 150, 105];   data.cell.styles.fontStyle = 'bold' }
          if (d === 'bekliyor')  { data.cell.styles.textColor = [161, 98, 7] }
          if (d === 'iptal')     { data.cell.styles.textColor = [185, 28, 28] }
          if (d === 'ertelendi') { data.cell.styles.textColor = [109, 40, 217] }
        }
        if (data.section === 'body' && data.column.index === 6) {
          data.cell.styles.fontStyle = 'bold'
        }
      },
      foot: [[
        { content: 'GENEL TOPLAM', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: 255 } },
        { content: new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(toplamTutar), styles: { halign: 'right', fontStyle: 'bold', fillColor: [37, 99, 235], textColor: 255 } },
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
        doc.text(cleanTr(`${firma.ad} — Odeme Plani Raporu`), 14, pageH - 4)
        doc.text(cleanTr(`Olusturulma: ${today}  |  Sayfa ${data.pageNumber}`), W - 14, pageH - 4, { align: 'right' })
      },
    })

    doc.save(`Odeme-Plani_${firma.ad}_${dateRange.start}_${dateRange.end}.pdf`)
  } catch (err) {
    console.error('PDF oluşturma hatası:', err)
    alert('PDF oluşturulamadı: ' + (err instanceof Error ? err.message : String(err)))
  }
  }

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    type S = Record<string, any>
    const sc = (v: any, t: string, s: S = {}) => ({ v, t, s })
    const border = (color = 'E2E8F0') => ({
      top:    { style: 'thin', color: { rgb: color } },
      bottom: { style: 'thin', color: { rgb: color } },
      left:   { style: 'thin', color: { rgb: color } },
      right:  { style: 'thin', color: { rgb: color } },
    })

    const mainHeader = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 16, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    })
    const subHeader = (v: string): S => sc(v, 's', {
      font:      { sz: 10, color: { rgb: '94A3B8' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    })
    const statLabel = (v: string, bg: string, fc: string): S => sc(v, 's', {
      font:      { bold: true, sz: 9, color: { rgb: fc }, name: 'Calibri' },
      fill:      { fgColor: { rgb: bg } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    border(bg),
    })
    const statValue = (v: string, bg: string, fc: string): S => sc(v, 's', {
      font:      { bold: true, sz: 13, color: { rgb: fc }, name: 'Calibri' },
      fill:      { fgColor: { rgb: bg } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    border(bg),
    })
    const colHead = (v: string, align = 'left'): S => sc(v, 's', {
      font:      { bold: true, sz: 10, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: align, vertical: 'center' },
      border:    border('334155'),
    })
    const cell = (v: string, align: 'left'|'center'|'right' = 'left', bold = false): S => sc(v, 's', {
      font:      { sz: 10, bold, name: 'Calibri' },
      alignment: { horizontal: align, vertical: 'center', wrapText: true },
      border:    border(),
    })
    const moneyCell = (v: number): S => sc(v, 'n', {
      font:      { sz: 10, bold: true, name: 'Calibri' },
      numFmt:    '#,##0.00" ₺"',
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    border(),
    })
    const durumCell = (d: string): S => {
      const map: Record<string, [string, string]> = {
        bekliyor:  ['FEF9C3', 'A16207'],
        odendi:    ['DCFCE7', '15803D'],
        ertelendi: ['EDE9FE', '6D28D9'],
        iptal:     ['FEE2E2', 'B91C1C'],
      }
      const [bg, fc] = map[d] || ['F1F5F9', '475569']
      const label = { bekliyor: 'Bekliyor', odendi: 'Odendi', ertelendi: 'Ertelendi', iptal: 'Iptal' }[d] || d
      return sc(label, 's', {
        font:      { sz: 10, bold: true, color: { rgb: fc }, name: 'Calibri' },
        fill:      { fgColor: { rgb: bg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    border(bg),
      })
    }
    const totalLabel = (v: string): S => sc(v, 's', {
      font:      { bold: true, sz: 11, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    border('334155'),
    })
    const totalMoney = (v: number): S => sc(v, 'n', {
      font:      { bold: true, sz: 12, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: '2563EB' } },
      numFmt:    '#,##0.00" ₺"',
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    border('3B82F6'),
    })
    const empty = (bg = '0F172A'): S => sc('', 's', { fill: { fgColor: { rgb: bg } } })

    const toplamTutar   = filtered.reduce((s, x) => s + toNumber(x.tutar), 0)
    const bekleyenTutar = filtered.filter(x => x.durum === 'bekliyor').reduce((s, x) => s + toNumber(x.tutar), 0)
    const odenenTutar   = filtered.filter(x => x.durum === 'odendi').reduce((s, x) => s + toNumber(x.tutar), 0)
    const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })

    const COLS = 7
    const aoa: any[][] = [
      // Satır 1 — Ana başlık
      [mainHeader(cleanTr(firma.ad || 'Firma')), ...Array(COLS - 1).fill(empty())],
      // Satır 2 — Alt başlık
      [subHeader(cleanTr(`ODEME PLANI RAPORU  |  ${dateRange.start} — ${dateRange.end}  |  Olusturulma: ${today}`)), ...Array(COLS - 1).fill(empty('1E293B'))],
      // Satır 3 — Boş
      Array(COLS).fill(empty('1E293B')),
      // Satır 4 — İstatistik başlıkları
      [
        statLabel('TOPLAM TUTAR', 'EEF2FF', '3730A3'),
        statLabel('TOPLAM TUTAR', 'EEF2FF', '3730A3'),
        statLabel('BEKLEYEN', 'FEF9C3', 'A16207'),
        statLabel('BEKLEYEN', 'FEF9C3', 'A16207'),
        statLabel('ODENEN', 'DCFCE7', '15803D'),
        statLabel('ODENEN', 'DCFCE7', '15803D'),
        statLabel('KAYIT', 'F1F5F9', '475569'),
      ],
      // Satır 5 — İstatistik değerleri
      [
        statValue(new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(toplamTutar) + ' TL', 'EEF2FF', '3730A3'),
        statValue(new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(toplamTutar) + ' TL', 'EEF2FF', '3730A3'),
        statValue(new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(bekleyenTutar) + ' TL', 'FEF9C3', 'A16207'),
        statValue(new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(bekleyenTutar) + ' TL', 'FEF9C3', 'A16207'),
        statValue(new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(odenenTutar) + ' TL', 'DCFCE7', '15803D'),
        statValue(new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(odenenTutar) + ' TL', 'DCFCE7', '15803D'),
        statValue(String(filtered.length) + ' adet', 'F1F5F9', '475569'),
      ],
      // Satır 6 — Boş
      Array(COLS).fill(empty('F8FAFC')),
      // Satır 7 — Kolon başlıkları
      [
        colHead('Baslik'),
        colHead('Tur'),
        colHead('Musteri / Cari'),
        colHead('Proje'),
        colHead('Vade', 'center'),
        colHead('Durum', 'center'),
        colHead('Tutar', 'right'),
      ],
      // Veri satırları
      ...filtered.map((item) => [
        cell(cleanTr(item.baslik), 'left', true),
        cell(cleanTr(item.tur)),
        cell(cleanTr(item.musteri_id ? (musteriMap[item.musteri_id]?.kisa_ad || musteriMap[item.musteri_id]?.ad || item.cari_ekip || '-') : (item.cari_ekip || '-'))),
        cell(cleanTr(item.proje_id ? (projeMap[item.proje_id]?.ad || '-') : '-')),
        cell(item.vade ? new Date(`${item.vade}T00:00:00`).toLocaleDateString('tr-TR') : '-', 'center'),
        durumCell(item.durum),
        moneyCell(toNumber(item.tutar)),
      ]),
      // Toplam satırı
      [
        ...Array(COLS - 2).fill(totalLabel('')),
        totalLabel('GENEL TOPLAM'),
        totalMoney(toplamTutar),
      ],
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 18 }]
    ws['!rows'] = [{ hpt: 36 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 }, { hpt: 28 }, { hpt: 6 }, { hpt: 22 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
      { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
      { s: { r: 4, c: 2 }, e: { r: 4, c: 3 } },
      { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: COLS - 1 } },
      { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: COLS - 3 } },
      { s: { r: aoa.length - 1, c: COLS - 2 }, e: { r: aoa.length - 1, c: COLS - 2 } },
    ]
    ws['!autofilter'] = { ref: `A7:G${6 + filtered.length}` }
    ws['!freeze'] = { xSplit: 0, ySplit: 7 }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Odeme Plani')
    XLSX.writeFile(wb, `Odeme-Plani_${cleanTr(firma.ad || 'Rapor')}_${dateRange.start}_${dateRange.end}.xlsx`)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="w-full px-0">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-xl backdrop-blur-2xl">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1fr_auto]">
            <Field label="Baslangic Tarihi">
              <input
                type="date"
                className={`${cls.input} text-sm font-medium text-white [color-scheme:dark]`}
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              />
            </Field>

            <Field label="Bitis Tarihi">
              <input
                type="date"
                className={`${cls.input} text-sm font-medium text-white [color-scheme:dark]`}
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              />
            </Field>

            <Field label="Tur">
              <select
                className={`${cls.input} text-sm font-medium text-white`}
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
                className={`${cls.input} text-sm font-medium text-white`}
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

            <Field label="Musteri">
              <select
                className={`${cls.input} text-sm font-medium text-white`}
                value={selectedMusteri}
                onChange={(e) => setSelectedMusteri(e.target.value)}
              >
                <option value="Tum">Tum Musteriler</option>
                <option value="">Musterisiz</option>
                {musteriler.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.kisa_ad || item.ad}
                  </option>
                ))}
              </select>
            </Field>

            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-slate-300">Arama</label>
              <Search size={16} className="absolute left-4 top-[42px] -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Baslik, cari, proje..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-3 pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-500 transition-colors focus:border-blue-500"
              />
            </div>

            <div className="flex items-end gap-2">
              <button onClick={exportPDF} className={cls.btnSecondary}>
                <Download size={15} /> PDF
              </button>
              <button onClick={exportExcel} className={cls.btnSecondary}>
                <FileSpreadsheet size={15} /> Excel
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-xl backdrop-blur-2xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-300">
                <CalendarDays size={18} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Odeme Merkezi</h1>
                <p className="text-sm font-medium text-slate-300">
                  Raporlu, hatirlatmali ve ertelemeli odeme plani yonetimi.
                </p>
              </div>
            </div>

            <button onClick={() => setModal({ ...EMPTY_FORM })} className={cls.btnPrimary}>
              <Plus size={15} /> Yeni Kayit
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="Toplam Tutar" value={stats.toplam} tone="cyan" money />
          <SummaryCard label="Bekleyen" value={stats.bekleyen} tone="amber" />
          <SummaryCard label="Odenen" value={stats.odenen} tone="emerald" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/50 shadow-2xl backdrop-blur-xl">
          <div className="p-3 sm:p-4">
            {Object.keys(grouped).length === 0 ? (
              <div className="py-14 text-center text-sm font-medium text-slate-500">Kayit bulunamadi.</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(grouped).map(([groupName, items]) => {
                  const groupTotal = items.reduce((sum, item) => sum + toNumber(item.tutar), 0)
                  const isOpen = !!expandedGroups[groupName]

                  return (
                    <div key={groupName} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupName)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        <div>
                          <h3 className="text-base font-bold text-white">{groupName}</h3>
                          <p className="text-xs font-medium text-slate-400">{items.length} kayit</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-lg font-bold text-cyan-300">{formatMoney(groupTotal)}</p>
                            <p className="text-xs text-slate-500">{isOpen ? 'Gizle' : 'Detay'}</p>
                          </div>
                          <div className="text-slate-400">
                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-white/5 p-3">
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div
                                key={`${item.kaynak}-${item.id}`}
                                className="rounded-xl border border-white/5 bg-slate-900/80 px-4 py-3"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="truncate text-[15px] font-semibold text-white">{item.baslik}</p>

                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                          item.durum === 'odendi'
                                            ? 'bg-emerald-500/10 text-emerald-300'
                                            : item.durum === 'iptal'
                                            ? 'bg-rose-500/10 text-rose-300'
                                            : 'bg-amber-500/10 text-amber-300'
                                        }`}
                                      >
                                        {item.durum}
                                      </span>

                                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                                        {item.kaynak}
                                      </span>

                                      {!item.readonly && item.durum === 'bekliyor' && isReminderDue(item.vade) && (
                                        <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-300">
                                          3 gun kala
                                        </span>
                                      )}

                                      {item.ertelendi_mi && (
                                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                                          Ertelendi
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-2 grid gap-1 text-xs text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
                                      <span>
                                        <b className="text-slate-200">Musteri:</b>{' '}
                                        {item.musteri_id ? (musteriMap[item.musteri_id]?.kisa_ad || musteriMap[item.musteri_id]?.ad || '-') : '-'}
                                      </span>
                                      <span>
                                        <b className="text-slate-200">Cari / Ekip:</b> {item.cari_ekip || '-'}
                                      </span>
                                      <span>
                                        <b className="text-slate-200">Proje:</b>{' '}
                                        {item.proje_id ? projeMap[item.proje_id]?.ad || '-' : 'Genel Firma'}
                                      </span>
                                      <span>
                                        <b className="text-slate-200">Vade:</b>{' '}
                                        {new Date(`${item.vade}T00:00:00`).toLocaleDateString('tr-TR')}
                                      </span>
                                      <span>
                                        <b className="text-slate-200">Hatirlatma:</b>{' '}
                                        {item.hatirlatma ? new Date(item.hatirlatma).toLocaleString('tr-TR') : '-'}
                                      </span>
                                    </div>

                                    {item.erteleme_nedeni && (
                                      <p className="mt-2 text-xs text-slate-400">
                                        <b className="text-slate-300">Erteleme Nedeni:</b> {item.erteleme_nedeni}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-white">{formatMoney(toNumber(item.tutar))}</p>
                                    </div>

                                    {!item.readonly && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setPostponeItem(item)
                                            setPostponeDate(item.vade)
                                            setPostponeReason(item.erteleme_nedeni || '')
                                          }}
                                          className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
                                        >
                                          Ertele
                                        </button>

                                        <button
                                          onClick={() => setModal({ ...item })}
                                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                                        >
                                          <Pencil size={15} />
                                        </button>

                                        <button
                                          onClick={() => setDeleteId(item.id)}
                                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-400"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.id ? 'Kaydi Duzenle' : 'Yeni Kayit'}
          onClose={() => setModal(null)}
          size="lg"
          footer={
            <>
              <button onClick={() => setModal(null)} className={cls.btnSecondary}>
                Iptal
              </button>
              <button onClick={save} disabled={saving} className={cls.btnPrimary}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Firma" required>
              <input className={cls.input} value={String(firma?.ad || '')} readOnly />
            </Field>

            <Field label="Musteri">
              <select
                className={cls.input}
                value={modal.musteri_id || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, musteri_id: e.target.value }))}
              >
                <option value="">Musteri Sec</option>
                {musteriler.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.kisa_ad || item.ad}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Proje">
              <select
                className={cls.input}
                value={modal.proje_id || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, proje_id: e.target.value }))}
              >
                <option value="">Genel Firma</option>
                {projeler.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.ad}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Baslik" required>
              <input
                className={cls.input}
                value={modal.baslik || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, baslik: e.target.value }))}
              />
            </Field>

            <Field label="Tur" required>
              <select
                className={cls.input}
                value={modal.tur || MANUEL_TUR_SECENEKLERI[0]}
                onChange={(e) => setModal((prev) => ({ ...prev!, tur: e.target.value }))}
              >
                {MANUEL_TUR_SECENEKLERI.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kaynak" required>
              <select
                className={cls.input}
                value={modal.kaynak || 'Odeme Plani'}
                onChange={(e) => setModal((prev) => ({ ...prev!, kaynak: e.target.value }))}
              >
                {KAYNAK_SECENEKLERI.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cari / Ekip">
              <input
                className={cls.input}
                value={modal.cari_ekip || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, cari_ekip: e.target.value }))}
              />
            </Field>

            <Field label="Vade" required>
              <input
                type="date"
                className={`${cls.input} [color-scheme:dark]`}
                value={modal.vade || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, vade: e.target.value }))}
              />
            </Field>

            <Field label="Durum" required>
              <select
                className={cls.input}
                value={modal.durum || 'bekliyor'}
                onChange={(e) => setModal((prev) => ({ ...prev!, durum: e.target.value }))}
              >
                {DURUM_SECENEKLERI.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Hatirlatma">
              <div className="relative">
                <Bell size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  className={`${cls.input} pl-10 [color-scheme:dark]`}
                  value={modal.hatirlatma ? String(modal.hatirlatma).slice(0, 16) : ''}
                  onChange={(e) => setModal((prev) => ({ ...prev!, hatirlatma: e.target.value }))}
                />
              </div>
            </Field>

            <Field label="Tutar" required>
              <input
                type="number"
                step="0.01"
                min="0"
                className={cls.input}
                value={modal.tutar ?? ''}
                onChange={(e) =>
                  setModal((prev) => ({
                    ...prev!,
                    tutar: e.target.value === '' ? 0 : Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
        </Modal>
      )}

      {postponeItem && (
        <Modal
          title="Odeme Tarihini Ertele"
          onClose={() => setPostponeItem(null)}
          size="md"
          footer={
            <>
              <button onClick={() => setPostponeItem(null)} className={cls.btnSecondary}>
                Iptal
              </button>
              <button onClick={postponeKayit} className={cls.btnPrimary}>
                Kaydet
              </button>
            </>
          }
        >
          <div className="grid gap-4">
            <Field label="Yeni Vade Tarihi" required>
              <input
                type="date"
                className={`${cls.input} [color-scheme:dark]`}
                value={postponeDate}
                onChange={(e) => setPostponeDate(e.target.value)}
              />
            </Field>

            <Field label="Erteleme Nedeni">
              <textarea
                className={`${cls.input} min-h-24 resize-y`}
                value={postponeReason}
                onChange={(e) => setPostponeReason(e.target.value)}
                placeholder="Kisa aciklama..."
              />
            </Field>
          </div>
        </Modal>
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