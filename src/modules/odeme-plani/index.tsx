'use client'
import React, { useEffect, useState, useMemo } from 'react'
import {
  Clock, Plus, Edit, Trash2, RefreshCw, Search,
  CheckCircle, AlertTriangle, FileText, CreditCard,
  Receipt, Users, Shield, MoreHorizontal, Download
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { OdemePlani } from '@/types'

// ─── Sabitler ────────────────────────────────────────────────
const TIPLER = [
  { v: 'cek',   l: 'Çek',          icon: CreditCard, color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { v: 'maas',  l: 'Maaş',         icon: Users,      color: 'text-sky-600',    bg: 'bg-sky-50'    },
  { v: 'sgk',   l: 'SGK',          icon: Shield,     color: 'text-green-600',  bg: 'bg-green-50'  },
  { v: 'vergi', l: 'Vergi',        icon: Receipt,    color: 'text-red-600',    bg: 'bg-red-50'    },
  { v: 'cari',  l: 'Cari Hesap',   icon: FileText,   color: 'text-purple-600', bg: 'bg-purple-50' },
  { v: 'diger', l: 'Diğer',        icon: MoreHorizontal, color: 'text-gray-600', bg: 'bg-gray-50' },
]

const DURUMLAR: Record<string, { l: string; v: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }> = {
  bekliyor: { l: 'Bekliyor', v: 'yellow' },
  odendi:   { l: 'Ödendi',   v: 'green'  },
  kismi:    { l: 'Kısmi',    v: 'blue'   },
  iptal:    { l: 'İptal',    v: 'red'    },
}

const empty = {
  odeme_tipi: 'cek',
  aciklama: '',
  tutar: '',
  odenen_tutar: '0',
  vade_tarihi: '',
  odeme_tarihi: '',
  durum: 'bekliyor',
  cek_no: '',
  cek_banka: '',
  cek_kesideci: '',
  cek_tarihi: '',
  cari_unvan: '',
  vergi_turu: '',
  vergi_donemi: '',
  sgk_donemi: '',
  maas_donemi: '',
  personel_sayisi: '',
  banka_hesabi: '',
  notlar: '',
  hatirlatici_gun: '3',
}

type FormState = typeof empty

export default function OdemePlaniModule({ firma }: AppCtx) {
  const [data, setData]       = useState<OdemePlani[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [activeTab, setActiveTab] = useState('hepsi')
  const [durumF, setDurumF]   = useState('hepsi')
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState<OdemePlani | null>(null)
  const [delId, setDelId]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState<FormState>(empty)

  async function load() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('odeme_plani')
      .select('*')
      .eq('firma_id', firma.id)
      .order('vade_tarihi', { ascending: true })
    if (error) console.error('Ödeme planı yükleme hatası:', error.message)
    setData(rows || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  // ─── Export Fonksiyonları ─────────────────────────────────
  async function exportExcel() {
    const XLSXStyle = await import('xlsx-js-style')
    const { utils, writeFile } = XLSXStyle

    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)

    // ─── Stil Tanımları ───────────────────────────────────────
    const S = {
      // Başlık bandı
      firmaBandi: {
        font:      { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '0F172A' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      },
      raporBandi: {
        font:      { name: 'Calibri', sz: 10, color: { rgb: '94A3B8' } },
        fill:      { fgColor: { rgb: '0F172A' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      },
      tarihBandi: {
        font:      { name: 'Calibri', sz: 9, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '0F172A' } },
        alignment: { horizontal: 'right', vertical: 'center' },
      },
      // Özet kartlar
      ozetBaslik: {
        font:      { name: 'Calibri', sz: 8, color: { rgb: '64748B' } },
        fill:      { fgColor: { rgb: 'F8FAFC' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      },
      ozetDeger: {
        font:      { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
        fill:      { fgColor: { rgb: 'F8FAFC' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      },
      // Tablo başlığı
      thNormal: {
        font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '2563EB' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border:    { top: { style: 'thin', color: { rgb: '1D4ED8' } }, bottom: { style: 'medium', color: { rgb: '1D4ED8' } }, left: { style: 'thin', color: { rgb: '1D4ED8' } }, right: { style: 'thin', color: { rgb: '1D4ED8' } } },
      },
      // Veri satırları
      tdNormal: {
        font:      { name: 'Calibri', sz: 9, color: { rgb: '0F172A' } },
        fill:      { fgColor: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center', wrapText: false },
        border:    { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      },
      tdZebra: {
        font:      { name: 'Calibri', sz: 9, color: { rgb: '0F172A' } },
        fill:      { fgColor: { rgb: 'F8FAFC' } },
        alignment: { vertical: 'center', wrapText: false },
        border:    { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      },
      // Koşullu — Gecikmiş
      tdGecikti: {
        font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: 'DC2626' } },
        fill:      { fgColor: { rgb: 'FEF2F2' } },
        alignment: { vertical: 'center' },
        border:    { top: { style: 'thin', color: { rgb: 'FECACA' } }, bottom: { style: 'thin', color: { rgb: 'FECACA' } }, left: { style: 'thin', color: { rgb: 'FECACA' } }, right: { style: 'thin', color: { rgb: 'FECACA' } } },
      },
      // Koşullu — Ödendi
      tdOdendi: {
        font:      { name: 'Calibri', sz: 9, color: { rgb: '16A34A' } },
        fill:      { fgColor: { rgb: 'F0FDF4' } },
        alignment: { vertical: 'center' },
        border:    { top: { style: 'thin', color: { rgb: 'BBF7D0' } }, bottom: { style: 'thin', color: { rgb: 'BBF7D0' } }, left: { style: 'thin', color: { rgb: 'BBF7D0' } }, right: { style: 'thin', color: { rgb: 'BBF7D0' } } },
      },
      // Koşullu — Bugün
      tdBugun: {
        font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: 'D97706' } },
        fill:      { fgColor: { rgb: 'FFFBEB' } },
        alignment: { vertical: 'center' },
        border:    { top: { style: 'thin', color: { rgb: 'FDE68A' } }, bottom: { style: 'thin', color: { rgb: 'FDE68A' } }, left: { style: 'thin', color: { rgb: 'FDE68A' } }, right: { style: 'thin', color: { rgb: 'FDE68A' } } },
      },
      // Para formatı
      para: {
        font:      { name: 'Calibri', sz: 9, color: { rgb: '0F172A' } },
        fill:      { fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt:    '#,##0.00 ₺',
        border:    { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      },
      paraZebra: {
        font:      { name: 'Calibri', sz: 9, color: { rgb: '0F172A' } },
        fill:      { fgColor: { rgb: 'F8FAFC' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt:    '#,##0.00 ₺',
        border:    { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      },
      paraGecikti: {
        font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: 'DC2626' } },
        fill:      { fgColor: { rgb: 'FEF2F2' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt:    '#,##0.00 ₺',
        border:    { top: { style: 'thin', color: { rgb: 'FECACA' } }, bottom: { style: 'thin', color: { rgb: 'FECACA' } }, left: { style: 'thin', color: { rgb: 'FECACA' } }, right: { style: 'thin', color: { rgb: 'FECACA' } } },
      },
      paraOdendi: {
        font:      { name: 'Calibri', sz: 9, color: { rgb: '16A34A' } },
        fill:      { fgColor: { rgb: 'F0FDF4' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt:    '#,##0.00 ₺',
        border:    { top: { style: 'thin', color: { rgb: 'BBF7D0' } }, bottom: { style: 'thin', color: { rgb: 'BBF7D0' } }, left: { style: 'thin', color: { rgb: 'BBF7D0' } }, right: { style: 'thin', color: { rgb: 'BBF7D0' } } },
      },
      // Toplam satırı
      toplamBaslik: {
        font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '1E293B' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border:    { top: { style: 'medium', color: { rgb: '0F172A' } }, bottom: { style: 'medium', color: { rgb: '0F172A' } }, left: { style: 'thin', color: { rgb: '0F172A' } }, right: { style: 'thin', color: { rgb: '0F172A' } } },
      },
      toplamPara: {
        font:      { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '1E293B' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt:    '#,##0.00 ₺',
        border:    { top: { style: 'medium', color: { rgb: '0F172A' } }, bottom: { style: 'medium', color: { rgb: '0F172A' } }, left: { style: 'thin', color: { rgb: '0F172A' } }, right: { style: 'thin', color: { rgb: '0F172A' } } },
      },
    }

    // ─── Satır Durumu Belirle ─────────────────────────────────
    function rowDurum(r: OdemePlani): 'gecikti' | 'bugun' | 'odendi' | 'normal' {
      if (r.durum === 'odendi' || r.durum === 'iptal') return 'odendi'
      const vade = new Date(r.vade_tarihi); vade.setHours(0,0,0,0)
      const fark = Math.floor((vade.getTime() - bugun.getTime()) / 86400000)
      if (fark < 0)  return 'gecikti'
      if (fark === 0) return 'bugun'
      return 'normal'
    }

    // ─── Hücre Oluştur ────────────────────────────────────────
    function c(v: any, s: any): any { return { v, s, t: typeof v === 'number' ? 'n' : 's' } }

    // ─── Çalışma Sayfası Verisi ───────────────────────────────
    const COLS = 11
    const ws: any = {}
    const merges: any[] = []
    let row = 0

    // Satır 0 — Firma adı bandı
    ws[utils.encode_cell({ r: row, c: 0 })] = c(firma.ad.toUpperCase(), S.firmaBandi)
    for (let i = 1; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', S.firmaBandi)
    ws[utils.encode_cell({ r: row, c: COLS - 1 })] = c(new Date().toLocaleDateString('tr-TR'), S.tarihBandi)
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
    row++

    // Satır 1 — Rapor adı
    for (let i = 0; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c(i === 0 ? 'ÖDEME PLANI RAPORU' : '', S.raporBandi)
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
    row++

    // Satır 2 — Boş
    for (let i = 0; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', { fill: { fgColor: { rgb: '0F172A' } } })
    row++

    // Satır 3-4 — Özet kartlar (2 satır: başlık + değer)
    const ozetler = [
      { l: 'TOPLAM TUTAR',  v: genelOzet.toplam  },
      { l: 'ÖDENEN',        v: genelOzet.odenen  },
      { l: 'KALAN',         v: genelOzet.kalan   },
      { l: 'GECİKMİŞ',      v: genelOzet.gecikti },
      { l: 'KAYIT SAYISI',  v: filtered.length   },
    ]
    // Başlık satırı
    ozetler.forEach((o, i) => {
      const col = i * 2
      ws[utils.encode_cell({ r: row, c: col })] = c(o.l, S.ozetBaslik)
      if (col + 1 < COLS) ws[utils.encode_cell({ r: row, c: col + 1 })] = c('', S.ozetBaslik)
      merges.push({ s: { r: row, c: col }, e: { r: row, c: Math.min(col + 1, COLS - 1) } })
    })
    row++
    // Değer satırı
    ozetler.forEach((o, i) => {
      const col = i * 2
      const val = typeof o.v === 'number' && i < 3 ? o.v : String(o.v)
      const s = { ...S.ozetDeger, ...(i < 3 ? { numFmt: '#,##0.00 ₺' } : {}) }
      ws[utils.encode_cell({ r: row, c: col })] = { v: val, s, t: typeof val === 'number' ? 'n' : 's' }
      if (col + 1 < COLS) ws[utils.encode_cell({ r: row, c: col + 1 })] = c('', S.ozetDeger)
      merges.push({ s: { r: row, c: col }, e: { r: row, c: Math.min(col + 1, COLS - 1) } })
    })
    row++

    // Satır 5 — Boş ayırıcı
    for (let i = 0; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', {})
    row++

    // Satır 6 — Tablo başlığı
    const headers = ['Tip', 'Açıklama', 'Çek No', 'Keşideci / Cari', 'Tutar', 'Ödenen', 'Kalan', 'Vade Tarihi', 'Ödeme Tarihi', 'Durum', 'Notlar']
    headers.forEach((h, i) => { ws[utils.encode_cell({ r: row, c: i })] = c(h, S.thNormal) })
    const headerRow = row
    row++

    // Veri satırları
    filtered.forEach((r2, idx) => {
      const durum = rowDurum(r2)
      const isZebra = idx % 2 === 1
      const td   = durum === 'gecikti' ? S.tdGecikti : durum === 'odendi' ? S.tdOdendi : durum === 'bugun' ? S.tdBugun : isZebra ? S.tdZebra : S.tdNormal
      const para = durum === 'gecikti' ? S.paraGecikti : durum === 'odendi' ? S.paraOdendi : isZebra ? S.paraZebra : S.para

      const detay = [
        (r2 as any).cek_no       ? `Çek: ${(r2 as any).cek_no}` : '',
        (r2 as any).cek_kesideci ? (r2 as any).cek_kesideci : '',
        (r2 as any).cari_unvan   ? (r2 as any).cari_unvan : '',
      ].filter(Boolean).join(' · ')

      const cells = [
        c(TIPLER.find(t => t.v === r2.odeme_tipi)?.l || r2.odeme_tipi, td),
        c(r2.aciklama || '', td),
        c((r2 as any).cek_no || '', td),
        c(detay, td),
        { v: Number(r2.tutar),        s: para, t: 'n' },
        { v: Number(r2.odenen_tutar), s: para, t: 'n' },
        { v: Number(r2.kalan_tutar),  s: para, t: 'n' },
        c(fmtDate(r2.vade_tarihi),    td),
        c(fmtDate(r2.odeme_tarihi),   td),
        c(DURUMLAR[r2.durum]?.l || r2.durum, td),
        c(r2.notlar || '', td),
      ]
      cells.forEach((cell, i) => { ws[utils.encode_cell({ r: row, c: i })] = cell })
      row++
    })

    // Toplam satırı
    const toplamCells = [
      c('TOPLAM', S.toplamBaslik), c('', S.toplamBaslik), c('', S.toplamBaslik), c('', S.toplamBaslik),
      { v: genelOzet.toplam,  s: S.toplamPara, t: 'n' },
      { v: genelOzet.odenen,  s: S.toplamPara, t: 'n' },
      { v: genelOzet.kalan,   s: S.toplamPara, t: 'n' },
      c('', S.toplamBaslik), c('', S.toplamBaslik), c('', S.toplamBaslik), c('', S.toplamBaslik),
    ]
    toplamCells.forEach((cell, i) => { ws[utils.encode_cell({ r: row, c: i })] = cell })
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } })
    row++

    // Boş + imza satırı
    row++
    ws[utils.encode_cell({ r: row, c: 0 })] = c(`Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}  |  ${firma.ad}  |  Gizli ve Kurumsal Belge`, {
      font: { name: 'Calibri', sz: 8, italic: true, color: { rgb: '94A3B8' } },
      alignment: { horizontal: 'left' },
    })
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })

    // ─── Kolon Genişlikleri ───────────────────────────────────
    ws['!cols'] = [
      { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 22 },
      { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 28 },
    ]

    // ─── Satır Yükseklikleri ──────────────────────────────────
    ws['!rows'] = Array(row + 1).fill(null).map((_, i) => {
      if (i === 0) return { hpt: 28 }
      if (i === 1) return { hpt: 18 }
      if (i === 3 || i === 4) return { hpt: 20 }
      if (i === headerRow) return { hpt: 22 }
      return { hpt: 18 }
    })

    ws['!merges'] = merges
    ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })

    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Ödeme Planı')
    writeFile(wb, `odeme-plani-${firma.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function exportPDF() {
    try {
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default
      const { registerFont, drawPdfHeader, drawPdfFooter, tableStyles, BRAND } = await import('@/lib/export')

    const doc       = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageH     = doc.internal.pageSize.getHeight()

    await registerFont(doc)

    const startY = drawPdfHeader({
      doc,
      title:    'ÖDEME PLANI RAPORU',
      subtitle: 'Ödeme Planı',
      firmaAdi: firma.ad,
      pageWidth,
      meta: [
        { label: 'TOPLAM TUTAR',  value: fmt(genelOzet.toplam)  },
        { label: 'ÖDENEN',        value: fmt(genelOzet.odenen)  },
        { label: 'KALAN',         value: fmt(genelOzet.kalan)   },
        { label: 'GECİKMİŞ',      value: `${genelOzet.gecikti} adet` },
        { label: 'KAYIT SAYISI',  value: `${filtered.length} adet`   },
      ],
    })

    const { styles, headStyles, alternateRowStyles } = tableStyles()

    autoTable(doc, {
      startY,
      head: [['Tip', 'Açıklama / Detay', 'Tutar', 'Ödenen', 'Kalan', 'Vade Tarihi', 'Durum']],
      body: filtered.map(r => [
        TIPLER.find(t => t.v === r.odeme_tipi)?.l || r.odeme_tipi,
        [
          r.aciklama,
          (r as any).cek_no       ? `Çek: ${(r as any).cek_no}` : '',
          (r as any).cek_kesideci ? `Keşideci: ${(r as any).cek_kesideci}` : '',
          (r as any).cari_unvan   ? `Cari: ${(r as any).cari_unvan}` : '',
          (r as any).vergi_turu   ? `Vergi: ${(r as any).vergi_turu}` : '',
          (r as any).sgk_donemi   ? `SGK: ${(r as any).sgk_donemi}` : '',
          (r as any).maas_donemi  ? `Maaş: ${(r as any).maas_donemi}` : '',
        ].filter(Boolean).join('  ·  ') || '-',
        fmt(Number(r.tutar)),
        fmt(Number(r.odenen_tutar)),
        fmt(Number(r.kalan_tutar)),
        fmtDate(r.vade_tarihi),
        DURUMLAR[r.durum]?.l || r.durum,
      ]),
      styles,
      headStyles,
      alternateRowStyles,
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 80 },
        2: { cellWidth: 26, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 24 },
        6: { cellWidth: 22 },
      },
      margin: { left: 14, right: 14, bottom: 12 },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const r = filtered[data.row.index]
          if (!r) return
          const overdue = r.durum === 'bekliyor' && new Date(r.vade_tarihi) < new Date()
          if (overdue) {
            data.cell.styles.textColor = BRAND.red
            data.cell.styles.fontStyle = 'bold'
          }
          if (r.durum === 'odendi') {
            data.cell.styles.textColor = BRAND.green
          }
        }
      },
      didDrawPage: () => {
        // Her sayfada header tekrar çiz
        doc.setFillColor(...BRAND.dark)
        doc.rect(0, 0, pageWidth, 22, 'F')
        doc.setFillColor(...BRAND.accent)
        doc.rect(0, 22, pageWidth, 1.5, 'F')
        doc.setFont('Roboto', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(255, 255, 255)
        doc.text(firma.ad.toUpperCase(), 14, 9)
        doc.setFont('Roboto', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text('ÖDEME PLANI RAPORU', 14, 16)
      },
    })

    drawPdfFooter(doc, pageWidth, pageH)
    doc.save(`odeme-plani-${firma.ad}-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err: any) {
      console.error('PDF hatası:', err)
      alert('PDF oluşturma hatası: ' + (err?.message || err))
    }
  }

  // Filtrelenmiş veri
  const filtered = useMemo(() => data.filter(r => {
    if (activeTab !== 'hepsi' && r.odeme_tipi !== activeTab) return false
    if (durumF !== 'hepsi' && r.durum !== durumF) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.aciklama?.toLowerCase().includes(q) ||
        (r as any).cek_no?.toLowerCase().includes(q) ||
        (r as any).cari_unvan?.toLowerCase().includes(q) ||
        (r as any).cek_kesideci?.toLowerCase().includes(q)
      )
    }
    return true
  }), [data, activeTab, durumF, search])

  // Tip bazlı özet
  const tipOzet = useMemo(() => {
    return TIPLER.map(t => {
      const rows = data.filter(r => r.odeme_tipi === t.v)
      return {
        ...t,
        toplam: rows.reduce((s, r) => s + Number(r.tutar), 0),
        kalan:  rows.filter(r => r.durum !== 'odendi' && r.durum !== 'iptal').reduce((s, r) => s + Number(r.kalan_tutar), 0),
        bekleyen: rows.filter(r => r.durum === 'bekliyor').length,
        gecikti: rows.filter(r => r.durum === 'bekliyor' && new Date(r.vade_tarihi) < new Date()).length,
      }
    })
  }, [data])

  const genelOzet = useMemo(() => ({
    toplam:   filtered.reduce((s, r) => s + Number(r.tutar), 0),
    odenen:   filtered.reduce((s, r) => s + Number(r.odenen_tutar), 0),
    kalan:    filtered.filter(r => r.durum !== 'odendi' && r.durum !== 'iptal').reduce((s, r) => s + Number(r.kalan_tutar), 0),
    gecikti:  filtered.filter(r => r.durum === 'bekliyor' && new Date(r.vade_tarihi) < new Date()).length,
  }), [filtered])

  // Modal aç
  function openNew() {
    setForm({ ...empty, odeme_tipi: activeTab === 'hepsi' ? 'cek' : activeTab })
    setEditing(null)
    setModal(true)
  }
  function openEdit(r: OdemePlani) {
    const extra = r as any
    setForm({
      odeme_tipi:      r.odeme_tipi,
      aciklama:        r.aciklama || '',
      tutar:           String(r.tutar),
      odenen_tutar:    String(r.odenen_tutar),
      vade_tarihi:     r.vade_tarihi,
      odeme_tarihi:    r.odeme_tarihi || '',
      durum:           r.durum,
      cek_no:          extra.cek_no || '',
      cek_banka:       extra.cek_banka || '',
      cek_kesideci:    extra.cek_kesideci || '',
      cek_tarihi:      extra.cek_tarihi || '',
      cari_unvan:      extra.cari_unvan || '',
      vergi_turu:      extra.vergi_turu || '',
      vergi_donemi:    extra.vergi_donemi || '',
      sgk_donemi:      extra.sgk_donemi || '',
      maas_donemi:     extra.maas_donemi || '',
      personel_sayisi: extra.personel_sayisi ? String(extra.personel_sayisi) : '',
      banka_hesabi:    extra.banka_hesabi || '',
      notlar:          r.notlar || '',
      hatirlatici_gun: String(extra.hatirlatici_gun || '3'),
    })
    setEditing(r)
    setModal(true)
  }

  async function save() {
    if (!form.tutar || !form.vade_tarihi) return alert('Tutar ve vade tarihi zorunludur')
    setSaving(true)
    const tutar  = Number(form.tutar)
    const odenen = Number(form.odenen_tutar)
    const payload: any = {
      odeme_tipi:   form.odeme_tipi,
      aciklama:     form.aciklama || null,
      tutar,
      odenen_tutar: odenen,
      kalan_tutar:  tutar - odenen,
      vade_tarihi:  form.vade_tarihi,
      odeme_tarihi: form.odeme_tarihi || null,
      durum:        form.durum,
      banka_hesabi: form.banka_hesabi || null,
      notlar:       form.notlar || null,
      hatirlatici_gun: Number(form.hatirlatici_gun) || 3,
      cek_no:       form.cek_no || null,
      cek_banka:    form.cek_banka || null,
      cek_kesideci: form.cek_kesideci || null,
      cek_tarihi:   form.cek_tarihi || null,
      cari_unvan:   form.cari_unvan || null,
      vergi_turu:   form.vergi_turu || null,
      vergi_donemi: form.vergi_donemi || null,
      sgk_donemi:   form.sgk_donemi || null,
      maas_donemi:  form.maas_donemi || null,
      personel_sayisi: form.personel_sayisi ? Number(form.personel_sayisi) : null,
    }
    let savedId: string | null = null
    let error: any = null
    if (editing) {
      const res = await supabase.from('odeme_plani').update(payload).eq('id', editing.id)
      error = res.error
      savedId = editing.id
    } else {
      const res = await supabase.from('odeme_plani').insert({ ...payload, firma_id: firma.id }).select().single()
      error = res.error
      savedId = res.data?.id || null
    }
    if (error) { alert('Kaydetme hatası: ' + error.message); console.error(error) }
    // Cari tipinde ise cari hesaba otomatik hareket ekle
    if (!error && !editing && form.odeme_tipi === 'cari' && form.cari_unvan && savedId) {
      const { data: cariHesap } = await supabase.from('cari_hesaplar')
        .select('id').eq('firma_id', firma.id).ilike('ad', form.cari_unvan).maybeSingle()
      if (cariHesap?.id) {
        await supabase.from('cari_hareketler').insert({
          firma_id: firma.id, cari_hesap_id: cariHesap.id,
          tarih: form.vade_tarihi, tur: 'borc',
          tutar: Number(form.tutar),
          aciklama: form.aciklama || null,
          odeme_durumu: form.durum,
          kaynak: 'odeme_plani', kaynak_id: savedId,
        })
      }
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const sf = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  // Ödeme tipine göre ek alanlar
  const renderExtraFields = () => {
    switch (form.odeme_tipi) {
      case 'cek':
        return <>
          <Field label="Çek No" required>
            <input type="text" value={form.cek_no} onChange={sf('cek_no')} className={inputCls} placeholder="123456" />
          </Field>
          <Field label="Çek Bankası">
            <input type="text" value={form.cek_banka} onChange={sf('cek_banka')} className={inputCls} placeholder="Garanti BBVA" />
          </Field>
          <Field label="Keşideci">
            <input type="text" value={form.cek_kesideci} onChange={sf('cek_kesideci')} className={inputCls} placeholder="Firma / Kişi adı" />
          </Field>
          <Field label="Çek Tarihi">
            <input type="date" value={form.cek_tarihi} onChange={sf('cek_tarihi')} className={inputCls} />
          </Field>
        </>
      case 'cari':
        return <>
          <Field label="Cari Ünvan" required className="md:col-span-2">
            <input type="text" value={form.cari_unvan} onChange={sf('cari_unvan')} className={inputCls} placeholder="Firma / Kişi adı" />
          </Field>
        </>
      case 'vergi':
        return <>
          <Field label="Vergi Türü" required>
            <select value={form.vergi_turu} onChange={sf('vergi_turu')} className={inputCls}>
              <option value="">Seçiniz</option>
              <option value="kdv">KDV</option>
              <option value="muhtasar">Muhtasar</option>
              <option value="kurumlar">Kurumlar Vergisi</option>
              <option value="gecici">Geçici Vergi</option>
              <option value="damga">Damga Vergisi</option>
              <option value="diger">Diğer</option>
            </select>
          </Field>
          <Field label="Vergi Dönemi">
            <input type="text" value={form.vergi_donemi} onChange={sf('vergi_donemi')} className={inputCls} placeholder="2025-01" />
          </Field>
        </>
      case 'sgk':
        return <>
          <Field label="SGK Dönemi" required className="md:col-span-2">
            <input type="text" value={form.sgk_donemi} onChange={sf('sgk_donemi')} className={inputCls} placeholder="2025-01" />
          </Field>
        </>
      case 'maas':
        return <>
          <Field label="Maaş Dönemi" required>
            <input type="text" value={form.maas_donemi} onChange={sf('maas_donemi')} className={inputCls} placeholder="Ocak 2025" />
          </Field>
          <Field label="Personel Sayısı">
            <input type="number" value={form.personel_sayisi} onChange={sf('personel_sayisi')} className={inputCls} />
          </Field>
        </>
      default:
        return null
    }
  }

  // Tabloda ek bilgi göster
  const renderExtraInfo = (r: OdemePlani) => {
    const x = r as any
    switch (r.odeme_tipi) {
      case 'cek':   return x.cek_no ? <span className="text-xs text-gray-500">Çek: {x.cek_no}{x.cek_kesideci ? ` · ${x.cek_kesideci}` : ''}</span> : null
      case 'cari':  return (x.cari_unvan || x.banka_hesabi) ? (
        <div className="flex flex-col gap-0.5">
          {x.cari_unvan && <span className="text-xs text-gray-500">{x.cari_unvan}</span>}
          {x.banka_hesabi && <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit">{x.banka_hesabi}</span>}
        </div>
      ) : null
      case 'vergi': return x.vergi_turu ? <span className="text-xs text-gray-500">{x.vergi_turu.toUpperCase()}{x.vergi_donemi ? ` · ${x.vergi_donemi}` : ''}</span> : null
      case 'sgk':   return x.sgk_donemi ? <span className="text-xs text-gray-500">Dönem: {x.sgk_donemi}</span> : null
      case 'maas':  return x.maas_donemi ? <span className="text-xs text-gray-500">{x.maas_donemi}{x.personel_sayisi ? ` · ${x.personel_sayisi} kişi` : ''}</span> : null
      default:      return null
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Clock className="w-5 h-5 text-amber-600" />}
        title="Ödeme Planı"
        subtitle="Çek, maaş, SGK, vergi, cari ve diğer ödemeleri takip edin"
        iconBg="bg-amber-50"
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportExcel}>Excel</Btn>
            <Btn variant="secondary" size="sm" icon={<FileText className="w-4 h-4" />} onClick={exportPDF}>PDF</Btn>
            <Btn variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>Yenile</Btn>
            <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Ödeme</Btn>
          </div>
        }
      />

      {/* Tip Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tipOzet.map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.v
          return (
            <button
              key={t.v}
              onClick={() => setActiveTab(isActive ? 'hepsi' : t.v)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                isActive
                  ? `border-current ${t.bg} ${t.color}`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`flex items-center gap-2 mb-2 ${isActive ? t.color : 'text-gray-500'}`}>
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold">{t.l}</span>
                {t.gecikti > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {t.gecikti}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-gray-900">{fmt(t.kalan)}</p>
              <p className="text-xs text-gray-400">{t.bekleyen} bekliyor</p>
            </button>
          )
        })}
      </div>

      {/* Genel Özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Toplam</p>
          <p className="text-xl font-bold text-gray-900">{fmt(genelOzet.toplam)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Ödenen</p>
          <p className="text-xl font-bold text-green-600">{fmt(genelOzet.odenen)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Kalan</p>
          <p className="text-xl font-bold text-amber-600">{fmt(genelOzet.kalan)}</p>
        </Card>
        <Card className={`p-4 ${genelOzet.gecikti > 0 ? 'bg-red-50 border-red-200' : ''}`}>
          <p className="text-xs text-gray-500 mb-1">Gecikmiş</p>
          <p className={`text-xl font-bold ${genelOzet.gecikti > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {genelOzet.gecikti} adet
          </p>
        </Card>
      </div>

      {/* Filtreler */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Açıklama, çek no, cari ünvan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={durumF} onChange={e => setDurumF(e.target.value)} className={inputCls + ' w-auto'}>
            <option value="hepsi">Tüm Durumlar</option>
            {Object.entries(DURUMLAR).map(([k, v]) => (
              <option key={k} value={k}>{v.l}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tablo */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Tip', 'Açıklama / Detay', 'Tutar', 'Ödenen', 'Kalan', 'Vade Tarihi', 'Durum', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const tip   = TIPLER.find(t => t.v === r.odeme_tipi)
                  const durum = DURUMLAR[r.durum]
                  const TipIcon = tip?.icon || MoreHorizontal
                  const overdue = r.durum === 'bekliyor' && new Date(r.vade_tarihi) < new Date()
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${tip?.bg} ${tip?.color}`}>
                          <TipIcon className="w-3 h-3" />
                          {tip?.l}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-sm text-gray-800 truncate">{r.aciklama || '-'}</div>
                        {renderExtraInfo(r)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(Number(r.tutar))}</td>
                      <td className="px-4 py-3 text-sm text-green-700 whitespace-nowrap">{fmt(Number(r.odenen_tutar))}</td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-700 whitespace-nowrap">{fmt(Number(r.kalan_tutar))}</td>
                      <td className={`px-4 py-3 text-sm whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {fmtDate(r.vade_tarihi)}
                        {overdue && <span className="ml-1 text-red-500">⚠</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={durum?.l || r.durum} variant={durum?.v || 'gray'} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-blue-600">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDelId(r.id)} className="p-1 text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <EmptyState icon={<Clock className="w-10 h-10" />} message="Ödeme kaydı bulunamadı" />
            )}
          </div>
        )}
      </Card>

      {/* Modal */}
      {modal && (
        <Modal
          title={editing ? 'Ödeme Düzenle' : 'Yeni Ödeme'}
          onClose={() => setModal(false)}
          size="lg"
          footer={
            <>
              <Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn>
              <Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn>
            </>
          }
        >
          <div className="space-y-5">
            {/* Tip Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ödeme Tipi</label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {TIPLER.map(t => {
                  const Icon = t.icon
                  const active = form.odeme_tipi === t.v
                  return (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, odeme_tipi: t.v }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                        active ? `border-current ${t.bg} ${t.color}` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {t.l}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ortak alanlar */}
              <Field label="Açıklama" className="md:col-span-2">
                <input type="text" value={form.aciklama} onChange={sf('aciklama')} className={inputCls} placeholder="Ödeme açıklaması..." />
              </Field>

              <Field label="Tutar (₺)" required>
                <input type="number" step="0.01" value={form.tutar} onChange={sf('tutar')} className={inputCls} placeholder="0.00" />
              </Field>
              <Field label="Ödenen Tutar (₺)">
                <input type="number" step="0.01" value={form.odenen_tutar} onChange={sf('odenen_tutar')} className={inputCls} placeholder="0.00" />
              </Field>

              <Field label="Vade Tarihi" required>
                <input type="date" value={form.vade_tarihi} onChange={sf('vade_tarihi')} className={inputCls} />
              </Field>
              <Field label="Ödeme Tarihi">
                <input type="date" value={form.odeme_tarihi} onChange={sf('odeme_tarihi')} className={inputCls} />
              </Field>

              <Field label="Durum">
                <select value={form.durum} onChange={sf('durum')} className={inputCls}>
                  {Object.entries(DURUMLAR).map(([k, v]) => (
                    <option key={k} value={k}>{v.l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Banka Hesabı">
                <input type="text" value={form.banka_hesabi} onChange={sf('banka_hesabi')} className={inputCls} placeholder="Ödeme yapılan hesap" />
              </Field>

              {/* Tipe özel alanlar */}
              {renderExtraFields()}

              <Field label="Notlar" className="md:col-span-2">
                <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
              </Field>

              <Field label="Hatırlatıcı">
                <select value={form.hatirlatici_gun} onChange={sf('hatirlatici_gun')} className={inputCls}>
                  <option value="1">Vade 1 gün önce</option>
                  <option value="3">Vade 3 gün önce</option>
                  <option value="5">Vade 5 gün önce</option>
                  <option value="7">Vade 7 gün önce</option>
                  <option value="14">Vade 14 gün önce</option>
                </select>
              </Field>
            </div>

            {/* Kalan tutar önizleme */}
            {form.tutar && (
              <div className="bg-amber-50 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-gray-600">Kalan Tutar:</span>
                <span className="font-bold text-amber-700">
                  {fmt(Number(form.tutar || 0) - Number(form.odenen_tutar || 0))}
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog
          message="Bu ödemeyi silmek istediğinize emin misiniz?"
          onConfirm={async () => {
            await supabase.from('odeme_plani').delete().eq('id', delId)
            setDelId(null)
            load()
          }}
          onCancel={() => setDelId(null)}
        />
      )}
    </div>
  )
}
