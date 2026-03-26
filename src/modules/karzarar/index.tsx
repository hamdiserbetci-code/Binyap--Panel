'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Save, BarChart2, Calculator,
  Calendar, Filter, TrendingUp, TrendingDown, Layers,
  FileSpreadsheet, FileText,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, Loading, ErrorMsg } from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ── Tipler ────────────────────────────────────────────────────────────────────
interface KZDonem {
  id?: string
  firma_id: string
  donem: string
  satis_yurt_ici: number;  satis_yurt_disi: number;  satis_iade: number
  donem_basi_stok: number; donem_sonu_stok: number
  alis_malzeme: number;    alis_efatura: number;      alis_arsiv: number
  alis_utts: number;       alis_iscilik: number
  gider_personel: number;  gider_kira: number;        gider_fatura: number
  gider_amortisman: number; gider_diger: number
  vergi_orani: number
  notlar: string | null
}

// ── Saf bileşenler ────────────────────────────────────────────────────────────
function InputCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[rgba(60,60,67,0.36)] overflow-hidden" style={{ background: '#1C1C1E' }}>
      <div className="px-4 py-2.5 border-b border-[rgba(60,60,67,0.3)]"
        style={{ background: `${color}18`, borderLeft: `3px solid ${color}` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{title}</p>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  )
}

function NumRow({ label, value, onChange, minus }: {
  label: string; value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  minus?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs text-[rgba(235,235,245,0.6)] truncate">{label}</span>
      <div className="relative w-36">
        {minus && <span className="absolute top-1/2 -translate-y-1/2 text-xs text-[#FF453A] font-bold" style={{ left: '0.75rem' }}>−</span>}
        <span className="absolute top-1/2 -translate-y-1/2 text-xs text-[rgba(235,235,245,0.3)]"
          style={{ left: minus ? '1.375rem' : '0.75rem' }}>₺</span>
        <input type="number" min="0" step="0.01"
          className="w-full bg-[#2C2C2E] border border-[rgba(60,60,67,0.5)] text-white text-xs rounded-[8px] py-2 outline-none focus:border-[#0A84FF] text-right pr-3"
          style={{ paddingLeft: minus ? '2.25rem' : '1.5rem' }}
          placeholder="0,00" value={value} onChange={onChange} />
      </div>
    </div>
  )
}

function PRow({ label, value, sub, bold, color, indent, separator }: {
  label: string; value: number; sub?: string
  bold?: boolean; color?: string; indent?: boolean; separator?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 py-1.5 ${separator ? 'border-t border-[rgba(60,60,67,0.4)] mt-1 pt-2.5' : ''} ${indent ? 'pl-4' : ''}`}>
      <span className={`flex-1 text-xs ${bold ? 'font-bold text-white' : 'text-[rgba(235,235,245,0.6)]'}`}>{label}</span>
      {sub && <span className="text-[10px] text-[rgba(235,235,245,0.3)]">{sub}</span>}
      <span className={`text-xs tabular-nums ${bold ? 'font-bold text-sm' : 'font-medium'}`}
        style={{ color: color ?? (bold ? (value >= 0 ? '#30D158' : '#FF453A') : 'rgba(235,235,245,0.8)') }}>
        ₺{fmt(Math.abs(value))}
      </span>
    </div>
  )
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────
const n   = (s: string | number) => parseFloat(String(s).replace(',', '.')) || 0
const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (v: number, base: number) => base !== 0 ? ((v / base) * 100).toFixed(1) + '%' : '—'

function ayLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                  'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  return `${months[parseInt(m) - 1]} ${y}`
}
function ayKisa(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  return `${months[parseInt(m) - 1]} ${y}`
}
function prevMonth(yyyymm: string) {
  const d = new Date(yyyymm + '-01'); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7)
}
function nextMonth(yyyymm: string) {
  const d = new Date(yyyymm + '-01'); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7)
}

// Bir kayıttan K/Z hesapla
function calcRow(r: KZDonem) {
  const netSatis     = r.satis_yurt_ici + r.satis_yurt_disi - r.satis_iade
  const toplamAlis   = r.alis_malzeme + r.alis_efatura + r.alis_arsiv + r.alis_utts + r.alis_iscilik
  const smm          = r.donem_basi_stok + toplamAlis - r.donem_sonu_stok
  const brutKar      = netSatis - smm
  const toplamGyg    = r.gider_personel + r.gider_kira + r.gider_fatura + r.gider_amortisman + r.gider_diger
  const faaliyetKari = brutKar - toplamGyg
  const vergi        = faaliyetKari > 0 ? faaliyetKari * (r.vergi_orani / 100) : 0
  const netKar       = faaliyetKari - vergi
  return { netSatis, toplamAlis, smm, brutKar, toplamGyg, faaliyetKari, vergi, netKar,
    brutKarMarji: netSatis !== 0 ? (brutKar / netSatis) * 100 : 0,
    netKarMarji:  netSatis !== 0 ? (netKar  / netSatis) * 100 : 0 }
}

// Birden fazla kaydı topla (kümülatif)
function calcCumulative(rows: KZDonem[]) {
  if (rows.length === 0) return calcRow({ firma_id: '', donem: '', satis_yurt_ici: 0, satis_yurt_disi: 0, satis_iade: 0, donem_basi_stok: 0, donem_sonu_stok: 0, alis_malzeme: 0, alis_efatura: 0, alis_arsiv: 0, alis_utts: 0, alis_iscilik: 0, gider_personel: 0, gider_kira: 0, gider_fatura: 0, gider_amortisman: 0, gider_diger: 0, vergi_orani: 22, notlar: null })
  const sorted = [...rows].sort((a, b) => a.donem.localeCompare(b.donem))
  const sum: KZDonem = {
    firma_id: rows[0].firma_id, donem: '',
    satis_yurt_ici:  rows.reduce((s, r) => s + r.satis_yurt_ici, 0),
    satis_yurt_disi: rows.reduce((s, r) => s + r.satis_yurt_disi, 0),
    satis_iade:      rows.reduce((s, r) => s + r.satis_iade, 0),
    donem_basi_stok: sorted[0].donem_basi_stok,
    donem_sonu_stok: sorted[sorted.length - 1].donem_sonu_stok,
    alis_malzeme:    rows.reduce((s, r) => s + r.alis_malzeme, 0),
    alis_efatura:    rows.reduce((s, r) => s + r.alis_efatura, 0),
    alis_arsiv:      rows.reduce((s, r) => s + r.alis_arsiv, 0),
    alis_utts:       rows.reduce((s, r) => s + r.alis_utts, 0),
    alis_iscilik:    rows.reduce((s, r) => s + r.alis_iscilik, 0),
    gider_personel:  rows.reduce((s, r) => s + r.gider_personel, 0),
    gider_kira:      rows.reduce((s, r) => s + r.gider_kira, 0),
    gider_fatura:    rows.reduce((s, r) => s + r.gider_fatura, 0),
    gider_amortisman:rows.reduce((s, r) => s + r.gider_amortisman, 0),
    gider_diger:     rows.reduce((s, r) => s + r.gider_diger, 0),
    vergi_orani:     rows[rows.length - 1].vergi_orani,
    notlar: null,
  }
  return calcRow(sum)
}

const EMPTY_FORM = {
  satis_yurt_ici: '', satis_yurt_disi: '', satis_iade: '',
  donem_basi_stok: '', donem_sonu_stok: '',
  alis_malzeme: '', alis_efatura: '', alis_arsiv: '', alis_utts: '', alis_iscilik: '',
  gider_personel: '', gider_kira: '', gider_fatura: '', gider_amortisman: '', gider_diger: '',
  vergi_orani: '22', notlar: '',
}
type FormState = typeof EMPTY_FORM

function dbToForm(row: KZDonem): FormState {
  const k = (v: number) => v === 0 ? '' : String(v)
  return {
    satis_yurt_ici: k(row.satis_yurt_ici), satis_yurt_disi: k(row.satis_yurt_disi), satis_iade: k(row.satis_iade),
    donem_basi_stok: k(row.donem_basi_stok), donem_sonu_stok: k(row.donem_sonu_stok),
    alis_malzeme: k(row.alis_malzeme), alis_efatura: k(row.alis_efatura),
    alis_arsiv: k(row.alis_arsiv), alis_utts: k(row.alis_utts), alis_iscilik: k(row.alis_iscilik),
    gider_personel: k(row.gider_personel), gider_kira: k(row.gider_kira),
    gider_fatura: k(row.gider_fatura), gider_amortisman: k(row.gider_amortisman), gider_diger: k(row.gider_diger),
    vergi_orani: String(row.vergi_orani), notlar: row.notlar || '',
  }
}

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function KarZarar({ firma }: AppCtx) {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisYear  = thisMonth.slice(0, 4)

  // Aylık giriş
  const [donem, setDonem]       = useState(thisMonth)
  const [form, setForm]         = useState<FormState>({ ...EMPTY_FORM })
  const [existingId, setExistingId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  // Kümülatif / rapor
  const [view, setView]         = useState<'aylik' | 'rapor'>('aylik')
  const [rangeStart, setRangeStart] = useState(`${thisYear}-01`)
  const [rangeEnd,   setRangeEnd]   = useState(thisMonth)
  const [rangeRows,  setRangeRows]  = useState<KZDonem[]>([])
  const [rangeLoading, setRangeLoading] = useState(false)

  // Mobil sekme (sadece aylık görünümde)
  const [mobileTab, setMobileTab] = useState<'giris' | 'tablo'>('giris')

  useEffect(() => { loadDonem() }, [firma.id, donem])
  useEffect(() => { if (view === 'rapor') loadRange() }, [firma.id, view, rangeStart, rangeEnd])

  async function loadDonem() {
    setLoading(true); setError('')
    const { data, error: e } = await supabase
      .from('kar_zarar_donem').select('*')
      .eq('firma_id', firma.id).eq('donem', donem).maybeSingle()
    if (e) {
      setError(e.message.includes('schema cache') || e.message.includes('does not exist')
        ? 'Tablo bulunamadı. SQL Editör\'de "kar_zarar_donem" tablosunu oluşturun.'
        : e.message)
      setLoading(false); return
    }
    if (data) { setForm(dbToForm(data as KZDonem)); setExistingId(data.id) }
    else       { setForm({ ...EMPTY_FORM }); setExistingId(null) }
    setLoading(false)
  }

  async function loadRange() {
    setRangeLoading(true)
    const { data, error: e } = await supabase
      .from('kar_zarar_donem').select('*')
      .eq('firma_id', firma.id)
      .gte('donem', rangeStart).lte('donem', rangeEnd)
      .order('donem', { ascending: true })
    if (!e) setRangeRows((data || []) as KZDonem[])
    setRangeLoading(false)
  }

  async function save() {
    setSaving(true); setError('')
    const payload: Omit<KZDonem, 'id'> = {
      firma_id: firma.id, donem,
      satis_yurt_ici: n(form.satis_yurt_ici), satis_yurt_disi: n(form.satis_yurt_disi), satis_iade: n(form.satis_iade),
      donem_basi_stok: n(form.donem_basi_stok), donem_sonu_stok: n(form.donem_sonu_stok),
      alis_malzeme: n(form.alis_malzeme), alis_efatura: n(form.alis_efatura),
      alis_arsiv: n(form.alis_arsiv), alis_utts: n(form.alis_utts), alis_iscilik: n(form.alis_iscilik),
      gider_personel: n(form.gider_personel), gider_kira: n(form.gider_kira),
      gider_fatura: n(form.gider_fatura), gider_amortisman: n(form.gider_amortisman), gider_diger: n(form.gider_diger),
      vergi_orani: n(form.vergi_orani) || 22, notlar: form.notlar || null,
    }
    const { error: e } = existingId
      ? await supabase.from('kar_zarar_donem').update(payload).eq('id', existingId)
      : await supabase.from('kar_zarar_donem').insert(payload)
    setSaving(false)
    if (e) { setError(e.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    if (!existingId) loadDonem()
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExportExcel() {
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()
    const c = view === 'rapor' ? cumCalc : calc
    const periodText = view === 'rapor' ? `${ayLabel(rangeStart)} - ${ayLabel(rangeEnd)}` : ayLabel(donem)

    const kzRows = [
      ['Kar / Zarar Tablosu'],
      [`${firma.ad} — ${periodText}`],
      [],
      ['Kalem', 'Tutar (₺)'],
      ['Net Satışlar', c.netSatis],
      ['Toplam Alışlar & İşçilik', c.toplamAlis],
      ['Satılan Mal Maliyeti (SMM)', c.smm],
      ['Brüt Kar', c.brutKar],
      ['Brüt Kar Marjı %', pct(c.brutKar, c.netSatis)],
      ['Toplam GYG', c.toplamGyg],
      ['Faaliyet Karı', c.faaliyetKari],
      ['Faaliyet Karı Marjı %', pct(c.faaliyetKari, c.netSatis)],
    ]

    if (view === 'rapor' && rowCalcs.length > 0) {
      const aylikRows = [
        [],
        ['Aylık Dağılım'],
        ['Dönem', 'Net Satış (₺)', 'Malzeme (₺)', 'E-Fatura (₺)', 'E-Arşiv (₺)', 'UTTS (₺)', 'İşçilik (₺)', 'Toplam Alış (₺)', 'Brüt Kar (₺)', 'Toplam GYG (₺)', 'Faaliyet Karı (₺)'],
        ...rowCalcs.map(r => [ayKisa(r.donem), r.netSatis, r.alis_malzeme, r.alis_efatura, r.alis_arsiv, r.alis_utts, r.alis_iscilik, r.toplamAlis, r.brutKar, r.toplamGyg, r.faaliyetKari]),
        ['TOPLAM', cumCalc.netSatis, cumAlis.malzeme, cumAlis.efatura, cumAlis.arsiv, cumAlis.utts, cumAlis.iscilik, cumCalc.toplamAlis, cumCalc.brutKar, cumCalc.toplamGyg, cumCalc.faaliyetKari],
      ]
      const ws = utils.aoa_to_sheet([...kzRows, ...aylikRows])
      ws['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 15 }]
      utils.book_append_sheet(wb, ws, 'Kar Zarar')
    } else {
      const ws = utils.aoa_to_sheet(kzRows)
      ws['!cols'] = [{ wch: 32 }, { wch: 18 }]
      utils.book_append_sheet(wb, ws, 'Kar Zarar')
    }

    writeFile(wb, `KarZarar_${firma.ad}_${view === 'rapor' ? `${rangeStart}_${rangeEnd}` : donem}.xlsx`)
  }

  async function handleExportPDF() {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const c = view === 'rapor' ? cumCalc : calc
    const periodText = view === 'rapor' ? `${ayLabel(rangeStart)} — ${ayLabel(rangeEnd)}` : ayLabel(donem)

    // Başlık
    doc.setFontSize(15); doc.setTextColor(20, 20, 20)
    doc.text('KAR / ZARAR TABLOSU', pageWidth / 2, 18, { align: 'center' })
    doc.setFontSize(9); doc.setTextColor(100, 100, 100)
    doc.text(`${firma.ad}  |  ${periodText}`, pageWidth / 2, 25, { align: 'center' })

    let y = 32

    if (view === 'rapor' && rowCalcs.length > 0) {
      const { default: jsPDFLandscape } = await import('jspdf')
      const docL = new jsPDFLandscape({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pw = docL.internal.pageSize.getWidth()
      docL.setFontSize(13); docL.setTextColor(20, 20, 20)
      docL.text('KAR / ZARAR — AYLIK DAĞILIM', pw / 2, 16, { align: 'center' })
      docL.setFontSize(8); docL.setTextColor(100, 100, 100)
      docL.text(`${firma.ad}  |  ${periodText}`, pw / 2, 22, { align: 'center' })
      autoTable(docL, {
        startY: 27,
        head: [['Dönem', 'Net Satış', 'Malzeme', 'E-Fatura', 'E-Arşiv', 'UTTS', 'İşçilik', 'Top. Alış', 'Brüt Kar', 'Top. GYG', 'Faal. Karı']],
        body: [
          ...rowCalcs.map(r => [
            ayKisa(r.donem), `₺${fmt(r.netSatis)}`,
            `₺${fmt(r.alis_malzeme)}`, `₺${fmt(r.alis_efatura)}`, `₺${fmt(r.alis_arsiv)}`,
            `₺${fmt(r.alis_utts)}`, `₺${fmt(r.alis_iscilik)}`,
            `₺${fmt(r.toplamAlis)}`, `₺${fmt(r.brutKar)}`,
            `₺${fmt(r.toplamGyg)}`, `₺${fmt(r.faaliyetKari)}`,
          ]),
          ['TOPLAM', `₺${fmt(cumCalc.netSatis)}`,
            `₺${fmt(cumAlis.malzeme)}`, `₺${fmt(cumAlis.efatura)}`, `₺${fmt(cumAlis.arsiv)}`,
            `₺${fmt(cumAlis.utts)}`, `₺${fmt(cumAlis.iscilik)}`,
            `₺${fmt(cumCalc.toplamAlis)}`, `₺${fmt(cumCalc.brutKar)}`,
            `₺${fmt(cumCalc.toplamGyg)}`, `₺${fmt(cumCalc.faaliyetKari)}`],
        ],
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [10, 132, 255], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' } },
      })
      docL.save(`KarZarar_${firma.ad}_AylikDagilim_${rangeStart}_${rangeEnd}.pdf`)
      y = 200
    }

    doc.setFontSize(8); doc.setTextColor(60, 60, 60)
    doc.text('Kar / Zarar Özeti', 14, y); y += 3
    autoTable(doc, {
      startY: y,
      head: [['Kalem', 'Tutar']],
      body: [
        ['Net Satışlar', `₺${fmt(c.netSatis)}`],
        ['Toplam Alışlar & İşçilik', `₺${fmt(c.toplamAlis)}`],
        ['Satılan Mal Maliyeti (SMM)', `₺${fmt(c.smm)}`],
        ['Brüt Kar', `₺${fmt(c.brutKar)}  (${pct(c.brutKar, c.netSatis)})`],
        ['Toplam Genel Yönetim Giderleri', `₺${fmt(c.toplamGyg)}`],
        ['Faaliyet Karı', `₺${fmt(c.faaliyetKari)}  (${pct(c.faaliyetKari, c.netSatis)})`],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left', cellWidth: 100 }, 1: { halign: 'right' } },
    })

    doc.save(`KarZarar_${firma.ad}_${view === 'rapor' ? `${rangeStart}_${rangeEnd}` : donem}.pdf`)
  }

  // Aylık hesap (form'dan)
  const calc = useMemo(() => calcRow({
    firma_id: firma.id, donem, notlar: null,
    satis_yurt_ici: n(form.satis_yurt_ici), satis_yurt_disi: n(form.satis_yurt_disi), satis_iade: n(form.satis_iade),
    donem_basi_stok: n(form.donem_basi_stok), donem_sonu_stok: n(form.donem_sonu_stok),
    alis_malzeme: n(form.alis_malzeme), alis_efatura: n(form.alis_efatura),
    alis_arsiv: n(form.alis_arsiv), alis_utts: n(form.alis_utts), alis_iscilik: n(form.alis_iscilik),
    gider_personel: n(form.gider_personel), gider_kira: n(form.gider_kira),
    gider_fatura: n(form.gider_fatura), gider_amortisman: n(form.gider_amortisman), gider_diger: n(form.gider_diger),
    vergi_orani: n(form.vergi_orani) || 22,
  }), [form])

  // Kümülatif hesap
  const cumCalc     = useMemo(() => calcCumulative(rangeRows), [rangeRows])
  const rowCalcs    = useMemo(() => rangeRows.map(r => ({
    donem: r.donem, ...calcRow(r),
    alis_malzeme: r.alis_malzeme, alis_efatura: r.alis_efatura,
    alis_arsiv: r.alis_arsiv, alis_utts: r.alis_utts, alis_iscilik: r.alis_iscilik,
  })), [rangeRows])
  const cumAlis = useMemo(() => ({
    malzeme:  rangeRows.reduce((s, r) => s + r.alis_malzeme, 0),
    efatura:  rangeRows.reduce((s, r) => s + r.alis_efatura, 0),
    arsiv:    rangeRows.reduce((s, r) => s + r.alis_arsiv, 0),
    utts:     rangeRows.reduce((s, r) => s + r.alis_utts, 0),
    iscilik:  rangeRows.reduce((s, r) => s + r.alis_iscilik, 0),
  }), [rangeRows])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }))

  if (loading) return <Loading />
  if (error && !saving) return <ErrorMsg message={error} onRetry={loadDonem} />

  // ── K/Z Tablosu (tek dönem veya kümülatif için ortak) ─────────────────────
  const KZTablo = ({ c, baslik, subtitle }: { c: ReturnType<typeof calcRow>; baslik: string; subtitle?: string }) => (
    <div className="rounded-2xl border border-[rgba(60,60,67,0.36)] overflow-hidden" style={{ background: '#1C1C1E' }}>
      <div className="px-4 py-3 border-b border-[rgba(60,60,67,0.36)]" style={{ background: 'rgba(10,132,255,0.1)' }}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#0A84FF]">{baslik}</p>
        {subtitle && <p className="text-sm font-semibold text-white mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-4 py-3 space-y-0.5">
        <p className="text-[10px] font-bold text-[rgba(235,235,245,0.3)] uppercase tracking-widest mb-1">Gelirler</p>
        <PRow label="NET SATIŞLAR" value={c.netSatis} bold separator
          sub={c.netSatis > 0 ? '100%' : undefined} color={c.netSatis >= 0 ? '#0A84FF' : '#FF453A'} />

        <div className="pt-2">
          <p className="text-[10px] font-bold text-[rgba(235,235,245,0.3)] uppercase tracking-widest mb-1">Satışların Maliyeti</p>
          <PRow label="Toplam Alışlar & İşçilik" value={c.toplamAlis} indent color="rgba(235,235,245,0.7)" />
          <PRow label="SATILAN MAL MALİYETİ" value={c.smm} bold separator color={c.smm >= 0 ? '#FF9F0A' : '#30D158'} />
        </div>

        <div className="py-2.5 my-1 rounded-xl px-3 -mx-1"
          style={{ background: c.brutKar >= 0 ? 'rgba(48,209,88,0.08)' : 'rgba(255,69,58,0.08)', border: `1px solid ${c.brutKar >= 0 ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'}` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">BRÜT KAR</p>
              <p className="text-[10px] mt-0.5" style={{ color: c.brutKar >= 0 ? '#30D158' : '#FF453A' }}>
                Marj: {pct(c.brutKar, c.netSatis)}
              </p>
            </div>
            <p className="text-base font-bold" style={{ color: c.brutKar >= 0 ? '#30D158' : '#FF453A' }}>
              ₺{fmt(Math.abs(c.brutKar))}
            </p>
          </div>
        </div>

        <div className="pt-1">
          <p className="text-[10px] font-bold text-[rgba(235,235,245,0.3)] uppercase tracking-widest mb-1">Genel Yönetim Giderleri</p>
          <PRow label="TOPLAM GYG" value={c.toplamGyg} bold separator color="#BF5AF2" />
        </div>

        <div className="py-3 mt-1.5 rounded-xl px-3 -mx-1"
          style={{ background: c.faaliyetKari >= 0 ? 'rgba(10,132,255,0.1)' : 'rgba(255,69,58,0.1)', border: `1px solid ${c.faaliyetKari >= 0 ? 'rgba(10,132,255,0.3)' : 'rgba(255,69,58,0.3)'}` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">FAALİYET KARI</p>
              <p className="text-[10px] mt-0.5" style={{ color: c.faaliyetKari >= 0 ? '#0A84FF' : '#FF453A' }}>
                Marj: {pct(c.faaliyetKari, c.netSatis)}
              </p>
            </div>
            <p className="text-xl font-bold" style={{ color: c.faaliyetKari >= 0 ? '#0A84FF' : '#FF453A' }}>
              {c.faaliyetKari < 0 ? '-' : '+'}₺{fmt(Math.abs(c.faaliyetKari))}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Aylık veri girişi formu ────────────────────────────────────────────────
  const GirişFormu = () => (
    <div className="space-y-3">
      <InputCard title="Satışlar" color="#30D158">
        <NumRow label="Yurt İçi Satışlar"  value={form.satis_yurt_ici}  onChange={set('satis_yurt_ici')} />
        <NumRow label="Yurt Dışı Satışlar" value={form.satis_yurt_disi} onChange={set('satis_yurt_disi')} />
        <NumRow label="Satış İadeleri (−)" value={form.satis_iade}       onChange={set('satis_iade')} minus />
      </InputCard>
      <InputCard title="Stok Bilgileri" color="#0A84FF">
        <NumRow label="Dönem Başı Stok" value={form.donem_basi_stok} onChange={set('donem_basi_stok')} />
        <NumRow label="Dönem Sonu Stok" value={form.donem_sonu_stok} onChange={set('donem_sonu_stok')} />
      </InputCard>
      <InputCard title="Alışlar & Maliyetler" color="#FF9F0A">
        <NumRow label="Malzeme Alışları"  value={form.alis_malzeme}  onChange={set('alis_malzeme')} />
        <NumRow label="E-Fatura Alışları" value={form.alis_efatura}  onChange={set('alis_efatura')} />
        <NumRow label="E-Arşiv Alışları"  value={form.alis_arsiv}    onChange={set('alis_arsiv')} />
        <NumRow label="UTTS Alışları"     value={form.alis_utts}     onChange={set('alis_utts')} />
        <NumRow label="İşçilik Giderleri" value={form.alis_iscilik}  onChange={set('alis_iscilik')} />
      </InputCard>
      <InputCard title="Genel Yönetim Giderleri" color="#BF5AF2">
        <NumRow label="Personel Giderleri" value={form.gider_personel}   onChange={set('gider_personel')} />
        <NumRow label="Kira Giderleri"     value={form.gider_kira}       onChange={set('gider_kira')} />
        <NumRow label="Fatura / Abonelik"  value={form.gider_fatura}     onChange={set('gider_fatura')} />
        <NumRow label="Amortisman"         value={form.gider_amortisman} onChange={set('gider_amortisman')} />
        <NumRow label="Diğer Giderler"     value={form.gider_diger}      onChange={set('gider_diger')} />
      </InputCard>
      <div className="rounded-2xl border border-[rgba(60,60,67,0.36)] overflow-hidden" style={{ background: '#1C1C1E' }}>
        <div className="px-4 py-2.5 border-b border-[rgba(60,60,67,0.3)]" style={{ background: 'rgba(60,60,67,0.2)' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-[rgba(235,235,245,0.4)]">Notlar</p>
        </div>
        <div className="p-3">
          <textarea className={`${cls.input} resize-none w-full`} rows={2}
            placeholder="Dönem notları..." value={form.notlar} onChange={set('notlar')} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-0 -mx-3 md:-mx-5 -mt-3 md:-mt-5">

      {/* ── Üst Bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-[rgba(60,60,67,0.36)] flex-wrap shrink-0"
        style={{ background: 'rgba(28,28,30,0.95)' }}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white flex-1 uppercase">Kar / Zarar</h1>

        {/* Görünüm seçici */}
        <div className="flex rounded-[10px] overflow-hidden border border-[rgba(60,60,67,0.5)]">
          {([['aylik', 'Aylık Giriş', Calculator], ['rapor', 'Kümülatif Rapor', Layers]] as const).map(([v, lbl, Icon]) => (
            <button key={v} onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all"
              style={{
                background: view === v ? '#0A84FF' : 'rgba(44,44,46,0.8)',
                color: view === v ? '#fff' : 'rgba(235,235,245,0.5)',
              }}>
              <Icon size={12} /> {lbl}
            </button>
          ))}
        </div>

        {view === 'aylik' && (
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: saved ? 'rgba(48,209,88,0.2)' : '#0A84FF', color: saved ? '#30D158' : '#fff' }}>
            <Save size={15} />
            {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi ✓' : 'Kaydet'}
          </button>
        )}

        {/* Export butonları */}
        <div className="flex rounded-[10px] overflow-hidden border border-[rgba(60,60,67,0.5)]">
          <button onClick={handleExportExcel} title="Excel olarak indir"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all hover:bg-[rgba(48,209,88,0.15)]"
            style={{ background: 'rgba(44,44,46,0.8)', color: '#30D158' }}>
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={handleExportPDF} title="PDF olarak indir"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all hover:bg-[rgba(255,69,58,0.15)] border-l border-[rgba(60,60,67,0.5)]"
            style={{ background: 'rgba(44,44,46,0.8)', color: '#FF453A' }}>
            <FileText size={13} /> PDF
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          AYLIK GİRİŞ GÖRÜNÜMÜ
      ════════════════════════════════════════════════════════════════════════ */}
      {view === 'aylik' && (
        <>
          {/* Dönem Seçici */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(60,60,67,0.2)]"
            style={{ background: '#1C1C1E' }}>
            <button onClick={() => setDonem(prevMonth(donem))}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[rgba(235,235,245,0.5)] hover:text-white hover:bg-[rgba(60,60,67,0.5)] transition-all">
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 flex items-center justify-center gap-2">
              <Calendar size={14} className="text-[#0A84FF]" />
              <label className="relative cursor-pointer">
                <span className="text-sm font-bold text-white">{ayLabel(donem)}</span>
                <input type="month" value={donem} onChange={e => setDonem(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full" />
              </label>
              {existingId && (
                <span className="text-[10px] font-semibold text-[#30D158] bg-[rgba(48,209,88,0.12)] px-2 py-0.5 rounded-full border border-[rgba(48,209,88,0.2)]">
                  Kayıtlı
                </span>
              )}
            </div>
            <button onClick={() => setDonem(nextMonth(donem))}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[rgba(235,235,245,0.5)] hover:text-white hover:bg-[rgba(60,60,67,0.5)] transition-all">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Mobil sekme */}
          <div className="flex lg:hidden border-b border-[rgba(60,60,67,0.36)] shrink-0" style={{ background: '#1C1C1E' }}>
            {(['giris', 'tablo'] as const).map(t => (
              <button key={t} onClick={() => setMobileTab(t)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${mobileTab === t ? 'text-[#0A84FF] border-b-2 border-[#0A84FF]' : 'text-[rgba(235,235,245,0.4)]'}`}>
                {t === 'giris' ? <><Calculator size={13} /> Veri Girişi</> : <><BarChart2 size={13} /> K/Z Tablosu</>}
              </button>
            ))}
          </div>

          {error && saving && (
            <div className="mx-4 mt-3 px-4 py-3 rounded-xl text-xs text-[#FF453A] border border-[rgba(255,69,58,0.3)]"
              style={{ background: 'rgba(255,69,58,0.1)' }}>{error}</div>
          )}

          <div className="grid lg:grid-cols-2 gap-4 p-4 items-start" style={{ background: '#000000' }}>
            <div className={mobileTab === 'giris' ? 'block' : 'hidden lg:block'}>{GirişFormu()}</div>
            <div className={`${mobileTab === 'tablo' ? 'block' : 'hidden lg:block'} lg:sticky lg:top-4`}>
              {KZTablo({ c: calc, baslik: 'Kar / Zarar Tablosu', subtitle: ayLabel(donem) })}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          KÜMÜLATİF RAPOR GÖRÜNÜMÜ
      ════════════════════════════════════════════════════════════════════════ */}
      {view === 'rapor' && (
        <>
          {/* Tarih Aralığı Filtresi */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(60,60,67,0.2)] flex-wrap"
            style={{ background: '#1C1C1E' }}>
            <Filter size={14} className="text-[#0A84FF] shrink-0" />
            <span className="text-xs text-[rgba(235,235,245,0.5)] shrink-0">Başlangıç</span>
            <input type="month" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
              className="bg-[#2C2C2E] border border-[rgba(60,60,67,0.5)] text-white text-xs rounded-[10px] px-3 py-2 outline-none focus:border-[#0A84FF]" />
            <span className="text-xs text-[rgba(235,235,245,0.3)] shrink-0">→</span>
            <span className="text-xs text-[rgba(235,235,245,0.5)] shrink-0">Bitiş</span>
            <input type="month" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
              className="bg-[#2C2C2E] border border-[rgba(60,60,67,0.5)] text-white text-xs rounded-[10px] px-3 py-2 outline-none focus:border-[#0A84FF]" />
            <span className="text-[10px] text-[rgba(235,235,245,0.3)]">
              {rangeRows.length} dönem kayıtlı
            </span>
          </div>

          {rangeLoading ? <Loading /> : (
            <div className="p-4 space-y-5" style={{ background: '#000000' }}>

              {/* Özet Kartlar */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Toplam Net Satış', value: cumCalc.netSatis, color: '#0A84FF', icon: TrendingUp },
                  { label: 'Toplam Brüt Kar',  value: cumCalc.brutKar,  color: '#30D158', icon: TrendingUp },
                  { label: 'Toplam Net Kar',   value: cumCalc.netKar,   color: cumCalc.netKar >= 0 ? '#30D158' : '#FF453A', icon: cumCalc.netKar >= 0 ? TrendingUp : TrendingDown },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="rounded-2xl p-4 flex flex-col gap-1.5"
                    style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} style={{ color }} />
                      <span className="text-[10px] font-semibold text-[rgba(235,235,245,0.5)] truncate">{label}</span>
                    </div>
                    <p className="text-sm sm:text-base font-bold leading-none" style={{ color }}>
                      {value < 0 ? '-' : ''}₺{fmt(Math.abs(value))}
                    </p>
                    <p className="text-[10px] text-[rgba(235,235,245,0.3)]">
                      {ayKisa(rangeStart)} — {ayKisa(rangeEnd)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid xl:grid-cols-2 gap-5">

                {/* Aylık Detay Tablosu */}
                <div className="rounded-2xl border border-[rgba(60,60,67,0.36)] overflow-hidden" style={{ background: '#1C1C1E' }}>
                  <div className="px-4 py-3 border-b border-[rgba(60,60,67,0.3)]" style={{ background: 'rgba(94,92,230,0.12)', borderLeft: '3px solid #5E5CE6' }}>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#5E5CE6]">Aylık Dağılım</p>
                    <p className="text-[10px] text-[rgba(235,235,245,0.4)] mt-0.5">{ayKisa(rangeStart)} – {ayKisa(rangeEnd)}</p>
                  </div>

                  {rowCalcs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-xs text-[rgba(235,235,245,0.3)]">Bu aralıkta kayıt yok</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="text-xs" style={{ minWidth: '900px', width: '100%' }}>
                        <thead>
                          <tr className="border-b border-[rgba(60,60,67,0.3)]">
                            <th className="px-3 py-2.5 text-left font-semibold text-[rgba(235,235,245,0.35)] text-[10px] uppercase tracking-wider whitespace-nowrap sticky left-0" style={{ background: '#1C1C1E' }}>Dönem</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[rgba(235,235,245,0.35)] text-[10px] uppercase tracking-wider whitespace-nowrap">Net Satış</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[#FF9F0A] text-[10px] uppercase tracking-wider whitespace-nowrap border-l border-[rgba(255,159,10,0.2)]">Malzeme</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[#FF9F0A] text-[10px] uppercase tracking-wider whitespace-nowrap">E-Fatura</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[#FF9F0A] text-[10px] uppercase tracking-wider whitespace-nowrap">E-Arşiv</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[#FF9F0A] text-[10px] uppercase tracking-wider whitespace-nowrap">UTTS</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[#FF9F0A] text-[10px] uppercase tracking-wider whitespace-nowrap">İşçilik</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[rgba(235,235,245,0.35)] text-[10px] uppercase tracking-wider whitespace-nowrap border-l border-[rgba(60,60,67,0.3)]">Toplam Alış</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[rgba(235,235,245,0.35)] text-[10px] uppercase tracking-wider whitespace-nowrap">Brüt Kar</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[#BF5AF2] text-[10px] uppercase tracking-wider whitespace-nowrap border-l border-[rgba(191,90,242,0.2)]">Toplam GYG</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-[rgba(235,235,245,0.35)] text-[10px] uppercase tracking-wider whitespace-nowrap border-l border-[rgba(60,60,67,0.3)]">Faaliyet Karı</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rowCalcs.map((r, i) => {
                            const bg = i % 2 === 0 ? '#1C1C1E' : 'rgba(44,44,46,0.9)'
                            return (
                              <tr key={r.donem}
                                className={`border-b border-[rgba(60,60,67,0.15)] hover:bg-[rgba(255,255,255,0.03)] transition-colors ${i % 2 === 0 ? '' : 'bg-[rgba(60,60,67,0.08)]'}`}>
                                <td className="px-3 py-2 font-semibold text-white whitespace-nowrap sticky left-0" style={{ background: bg }}>{ayKisa(r.donem)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[rgba(235,235,245,0.7)]">₺{fmt(r.netSatis)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[rgba(235,235,245,0.5)] border-l border-[rgba(255,159,10,0.15)]">₺{fmt(r.alis_malzeme)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[rgba(235,235,245,0.5)]">₺{fmt(r.alis_efatura)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[rgba(235,235,245,0.5)]">₺{fmt(r.alis_arsiv)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[rgba(235,235,245,0.5)]">₺{fmt(r.alis_utts)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-[rgba(235,235,245,0.5)]">₺{fmt(r.alis_iscilik)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium text-[#FF9F0A] border-l border-[rgba(60,60,67,0.3)]">₺{fmt(r.toplamAlis)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: r.brutKar >= 0 ? '#30D158' : '#FF453A' }}>
                                  {r.brutKar < 0 ? '-' : ''}₺{fmt(Math.abs(r.brutKar))}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium text-[#BF5AF2] border-l border-[rgba(191,90,242,0.15)]">₺{fmt(r.toplamGyg)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-bold whitespace-nowrap border-l border-[rgba(60,60,67,0.3)]" style={{ color: r.faaliyetKari >= 0 ? '#30D158' : '#FF453A' }}>
                                  {r.faaliyetKari < 0 ? '-' : '+'}₺{fmt(Math.abs(r.faaliyetKari))}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-[rgba(60,60,67,0.5)] bg-[rgba(10,132,255,0.06)]">
                            <td className="px-3 py-2.5 font-bold text-white text-[11px] sticky left-0" style={{ background: 'rgba(10,132,255,0.06)' }}>TOPLAM</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-white">₺{fmt(cumCalc.netSatis)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#FF9F0A] border-l border-[rgba(255,159,10,0.15)]">₺{fmt(cumAlis.malzeme)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#FF9F0A]">₺{fmt(cumAlis.efatura)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#FF9F0A]">₺{fmt(cumAlis.arsiv)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#FF9F0A]">₺{fmt(cumAlis.utts)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#FF9F0A]">₺{fmt(cumAlis.iscilik)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#FF9F0A] border-l border-[rgba(60,60,67,0.3)]">₺{fmt(cumCalc.toplamAlis)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: cumCalc.brutKar >= 0 ? '#30D158' : '#FF453A' }}>
                              {cumCalc.brutKar < 0 ? '-' : ''}₺{fmt(Math.abs(cumCalc.brutKar))}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#BF5AF2] border-l border-[rgba(191,90,242,0.15)]">₺{fmt(cumCalc.toplamGyg)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-bold border-l border-[rgba(60,60,67,0.3)]" style={{ color: cumCalc.faaliyetKari >= 0 ? '#30D158' : '#FF453A' }}>
                              {cumCalc.faaliyetKari < 0 ? '-' : '+'}₺{fmt(Math.abs(cumCalc.faaliyetKari))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Kümülatif K/Z Tablosu */}
                {KZTablo({
                  c: cumCalc,
                  baslik: 'Kümülatif Kar / Zarar',
                  subtitle: `${ayLabel(rangeStart)} — ${ayLabel(rangeEnd)}`,
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
