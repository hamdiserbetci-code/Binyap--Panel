'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Save, BarChart2, Calculator, Calendar, Filter, TrendingUp, TrendingDown, Layers, FileSpreadsheet, FileText } from 'lucide-react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg } from '@/components/ui'
import type { AppCtx } from '@/app/page'

interface KZRaw {
  satis_yurt_ici: number; satis_yurt_disi: number; satis_iade: number
  donem_basi_stok: number; donem_sonu_stok: number
  alis_malzeme: number; alis_efatura: number; alis_arsiv: number; alis_utts: number; alis_iscilik: number
  gider_personel: number; gider_kira: number; gider_fatura: number; gider_amortisman: number; gider_diger: number; gider_finansal: number
}

interface KZDonem {
  id?: string
  firma_id: string
  donem: string
  musteri_id?: string | null  // artık kullanılmıyor, geriye dönük uyumluluk için
  satis_yurt_ici: number;  satis_yurt_disi: number;  satis_iade: number
  donem_basi_stok: number; donem_sonu_stok: number
  alis_malzeme: number;    alis_efatura: number;      alis_arsiv: number
  alis_utts: number;       alis_iscilik: number
  gider_personel: number;  gider_kira: number;        gider_fatura: number
  gider_amortisman: number; gider_diger: number; gider_finansal: number
  vergi_orani: number
  notlar: string | null
}

// ── Saf bileşenler ────────────────────────────────────────────────────────────
function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5"
      style={{ background: `${color}12`, borderLeft: `3px solid ${color}`, borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{title}</p>
    </div>
  )
}

function NumRow({ label, value, onChange, minus }: {
  label: string; value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  minus?: boolean
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 hover:bg-blue-50/40 transition-colors">
      <span className="flex-1 text-[12px] font-medium text-slate-700 leading-4 min-w-0">{label}</span>
      <div className="relative w-40 shrink-0">
        {minus && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-red-400 font-bold">−</span>}
        <span className="absolute top-1/2 -translate-y-1/2 text-[11px] text-slate-400" style={{ left: minus ? '1.3rem' : '0.6rem' }}>₺</span>
        <input
          type="text" inputMode="decimal" autoComplete="off"
          className="w-full h-8 bg-white border border-slate-200 text-slate-800 text-[12px] tabular-nums rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 text-right pr-3 transition-all"
          style={{ paddingLeft: minus ? '2rem' : '1.4rem' }}
          placeholder="0,00" value={value} onChange={onChange}
        />
      </div>
    </div>
  )
}

function PRow({ label, value, sub, bold, color, indent, separator }: {
  label: string; value: number; sub?: string
  bold?: boolean; color?: string; indent?: boolean; separator?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1 ${separator ? 'border-t border-slate-200 mt-1 pt-2' : ''} ${indent ? 'pl-4' : ''}`}>
      <div className="min-w-0 flex-1">
        <span className={`block leading-4 ${bold ? 'font-bold text-slate-800 text-[12px]' : 'text-slate-600 text-[11px]'}`}>{label}</span>
        {sub && <span className="block text-[10px] text-slate-400 mt-0.5">{sub}</span>}
      </div>
      <span
        className={`text-[12px] tabular-nums whitespace-nowrap shrink-0 ${bold ? 'font-bold' : 'font-semibold'}`}
        style={{ color: color ?? (bold ? (value >= 0 ? '#16a34a' : '#dc2626') : '#374151') }}
      >
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

function getPreviousPeriod(start: string, end: string): { prevStart: string; prevEnd: string } {
  const startDate = new Date(start + '-01T00:00:00Z');
  const endDate = new Date(end + '-01T00:00:00Z');

  const durationMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;

  const prevEndDate = new Date(startDate);
  prevEndDate.setUTCDate(0); // Go to the last day of the month before start

  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setUTCMonth(prevStartDate.getUTCMonth() - (durationMonths - 1));
  prevStartDate.setUTCDate(1);

  return {
    prevStart: prevStartDate.toISOString().slice(0, 7),
    prevEnd: prevEndDate.toISOString().slice(0, 7),
  };
}

function calculateChange(current: number, previous: number): { value: string; color: string } {
  if (previous === 0 && current === 0) {
    return { value: '—', color: '#94a3b8' };
  }
  // If previous is 0, but current is not, it's an "infinite" or new value change.
  // We'll represent it as 'Yeni' (New) for simplicity or show current value if it's new.
  // To avoid division by zero, handle this edge case.
  if (previous === 0) { // If previous is 0 and current is not 0
    if (current > 0) return { value: `Yeni (+${fmt(current)})`, color: '#30D158' };
    return { value: `Yeni (${fmt(current)})`, color: '#FF453A' };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.1) return { value: '≈0%', color: '#94a3b8' };
  const formattedChange = `${change > 0 ? '+' : ''}${change.toFixed(0)}%`;
  return { value: formattedChange, color: change > 0 ? '#30D158' : '#FF453A' };
}

// Bir kayıttan K/Z hesapla
function calcRow(r: KZDonem) {
  const netSatis     = r.satis_yurt_ici + r.satis_yurt_disi - r.satis_iade
  const toplamAlis   = r.alis_malzeme + r.alis_efatura + r.alis_arsiv + r.alis_utts + r.alis_iscilik
  const smm          = r.donem_basi_stok + toplamAlis - r.donem_sonu_stok
  const brutKar      = netSatis - smm
  const toplamGyg    = r.gider_personel + r.gider_kira + r.gider_fatura + r.gider_amortisman + r.gider_diger + r.gider_finansal
  const faaliyetKari = brutKar - toplamGyg
  const vergi        = faaliyetKari > 0 ? faaliyetKari * (r.vergi_orani / 100) : 0
  const netKar       = faaliyetKari - vergi
  return { netSatis, toplamAlis, smm, brutKar, toplamGyg, faaliyetKari, vergi, netKar,
    brutKarMarji: netSatis !== 0 ? (brutKar / netSatis) * 100 : 0,
    netKarMarji:  netSatis !== 0 ? (netKar  / netSatis) * 100 : 0 }
}

// Birden fazla kaydı topla (kümülatif)
function calcCumulative(rows: KZDonem[]) {
  if (rows.length === 0) return calcRow({ firma_id: '', donem: '', satis_yurt_ici: 0, satis_yurt_disi: 0, satis_iade: 0, donem_basi_stok: 0, donem_sonu_stok: 0, alis_malzeme: 0, alis_efatura: 0, alis_arsiv: 0, alis_utts: 0, alis_iscilik: 0, gider_personel: 0, gider_kira: 0, gider_fatura: 0, gider_amortisman: 0, gider_diger: 0, gider_finansal: 0, vergi_orani: 22, notlar: null })
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
    gider_finansal:  rows.reduce((s, r) => s + r.gider_finansal, 0),
    vergi_orani:     rows[rows.length - 1].vergi_orani,
    notlar: null,
  }
  return calcRow(sum)
}

function cleanTr(text: string) {
  return String(text ?? '');
}

async function loadRobotoFont(doc: any) {
  const [regRes, boldRes] = await Promise.all([
    fetch('/fonts/Roboto-Regular.ttf'),
    fetch('/fonts/Roboto-Bold.ttf'),
  ])
  const toBase64 = async (res: Response) => {
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let b64 = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      b64 += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)))
    }
    return btoa(b64)
  }
  const [regB64, boldB64] = await Promise.all([toBase64(regRes), toBase64(boldRes)])
  doc.addFileToVFS('Roboto-Regular.ttf', regB64)
  doc.addFileToVFS('Roboto-Bold.ttf', boldB64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
}
const EMPTY_FORM = {
  satis_yurt_ici: '', satis_yurt_disi: '', satis_iade: '',
  donem_basi_stok: '', donem_sonu_stok: '',
  alis_malzeme: '', alis_efatura: '', alis_arsiv: '', alis_utts: '', alis_iscilik: '',
  gider_personel: '', gider_kira: '', gider_fatura: '', gider_amortisman: '', gider_diger: '', gider_finansal: '',
  vergi_orani: '22', notlar: '', musteri_id: '',
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
    gider_fatura: k(row.gider_fatura), gider_amortisman: k(row.gider_amortisman), gider_diger: k(row.gider_diger), gider_finansal: k(row.gider_finansal),
    vergi_orani: String(row.vergi_orani), notlar: row.notlar || '',
    musteri_id: row.musteri_id || '',
  }
}

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function KarZarar({ firma, firmalar, firmaIds }: AppCtx) {
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
  const [view, setView]         = useState<'aylik' | 'ozet'>('aylik')
  const [rangeStart, setRangeStart] = useState(`${thisYear}-01`)
  const [rangeEnd,   setRangeEnd]   = useState(thisMonth)
  const [rangeRows,  setRangeRows]  = useState<KZDonem[]>([])
  const [prevRangeRows, setPrevRangeRows] = useState<KZDonem[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false)
  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  // Mobil sekme
  const [mobileTab, setMobileTab] = useState<'giris' | 'tablo'>('giris')
  const loadDonemRequestRef = useRef(0)

  const ViewToggle = ({ view, setView }: { view: 'aylik' | 'ozet', setView: (v: 'aylik' | 'ozet') => void }) => {
    const menus = [
      { id: 'aylik', label: 'Aylık Giriş',  Icon: Calculator,  color: 'from-blue-500 to-indigo-600' },
      { id: 'ozet',  label: 'Kümülatif',     Icon: TrendingUp,  color: 'from-emerald-500 to-teal-600' },
    ] as const;

    return (
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll">
        {menus.map((m) => (
          <button key={m.id} onClick={() => setView(m.id as any)}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200 border text-xs font-semibold ${view === m.id ? 'bg-blue-500 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
            <m.Icon size={12} />
            {m.label}
          </button>
        ))}
      </div>
    )
  }

  useEffect(() => { loadDonem() }, [firma.id, donem])
  useEffect(() => { if (view === 'ozet') loadRange() }, [firma.id, view, rangeStart, rangeEnd])

  function getCalcFromForm(formState: FormState) {
    return calcRow({
      firma_id: firma.id,
      donem,
      musteri_id: null,
      satis_yurt_ici: n(formState.satis_yurt_ici),
      satis_yurt_disi: n(formState.satis_yurt_disi),
      satis_iade: n(formState.satis_iade),
      donem_basi_stok: n(formState.donem_basi_stok),
      donem_sonu_stok: n(formState.donem_sonu_stok),
      alis_malzeme: n(formState.alis_malzeme),
      alis_efatura: n(formState.alis_efatura),
      alis_arsiv: n(formState.alis_arsiv),
      alis_utts: 0,
      alis_iscilik: n(formState.alis_iscilik),
      gider_personel: n(formState.gider_personel),
      gider_kira: n(formState.gider_kira),
      gider_fatura: n(formState.gider_fatura),
      gider_amortisman: n(formState.gider_amortisman),
      gider_diger: n(formState.gider_diger),
      gider_finansal: n(formState.gider_finansal),
      vergi_orani: n(formState.vergi_orani) || 22,
      notlar: formState.notlar || null,
    })
  }

  async function loadDonem() {
    const requestId = ++loadDonemRequestRef.current
    setLoading(true); setError('')
    const q = supabase.from('kar_zarar_donem').select('*').eq('firma_id', selFirmaId).eq('donem', donem).is('musteri_id', null)
    const { data, error: e } = await q.maybeSingle()
    if (requestId !== loadDonemRequestRef.current) return
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
    setRangeLoading(true);
    setPrevRangeRows([]); // Reset previous data on new load

    const { prevStart, prevEnd } = getPreviousPeriod(rangeStart, rangeEnd);

    const currentPeriodQuery = supabase.from('kar_zarar_donem').select('*')
      .in('firma_id', firmaIds)
      .gte('donem', rangeStart).lte('donem', rangeEnd)
      .order('donem', { ascending: true });

    const prevPeriodQuery = supabase.from('kar_zarar_donem').select('*')
      .in('firma_id', firmaIds)
      .gte('donem', prevStart).lte('donem', prevEnd)
      .order('donem', { ascending: true });

    currentPeriodQuery.is('musteri_id', null);
    prevPeriodQuery.is('musteri_id', null);

    const [currentResult, prevResult] = await Promise.all([
      currentPeriodQuery,
      prevPeriodQuery
    ]);

    if (!currentResult.error) setRangeRows((currentResult.data || []) as KZDonem[]);
    if (!prevResult.error) setPrevRangeRows((prevResult.data || []) as KZDonem[]);
    
    setRangeLoading(false);
  }

  async function save() {
    setSaving(true); setError('')
    const payload: Omit<KZDonem, 'id'> = {
      firma_id: selFirmaId, donem,
      musteri_id: null,
      satis_yurt_ici: n(form.satis_yurt_ici), satis_yurt_disi: n(form.satis_yurt_disi), satis_iade: n(form.satis_iade),
      donem_basi_stok: n(form.donem_basi_stok), donem_sonu_stok: n(form.donem_sonu_stok),
      alis_malzeme: n(form.alis_malzeme), alis_efatura: n(form.alis_efatura),
      alis_arsiv: n(form.alis_arsiv), alis_utts: 0, alis_iscilik: n(form.alis_iscilik),
      gider_personel: n(form.gider_personel), gider_kira: n(form.gider_kira),
      gider_fatura: n(form.gider_fatura), gider_amortisman: n(form.gider_amortisman), gider_diger: n(form.gider_diger), gider_finansal: n(form.gider_finansal),
      vergi_orani: n(form.vergi_orani) || 22, notlar: form.notlar || null,
    }

    const { data: samePeriodRows } = await supabase
      .from('kar_zarar_donem')
      .select('id, musteri_id')
      .eq('firma_id', selFirmaId)
      .eq('donem', donem)

    const targetRow = (samePeriodRows || []).find((row: any) => row.musteri_id == null)
    const targetId = targetRow?.id || null

    let { error: e } = targetId
      ? await supabase.from('kar_zarar_donem').update(payload).eq('id', targetId)
      : await supabase.from('kar_zarar_donem').insert(payload)

    if (e?.code === '23505') {
      // Yaris kosulu veya eski/veri tekrarindan kaynakli cakismada mevcut satiri bulup guncelle.
      const { data: retryRows } = await supabase
        .from('kar_zarar_donem')
        .select('id, musteri_id')
        .eq('firma_id', selFirmaId)
        .eq('donem', donem)

      const retryTarget = (retryRows || []).find((row: any) => row.musteri_id == null)

      if (retryTarget?.id) {
        const { error: retryError } = await supabase
          .from('kar_zarar_donem')
          .update(payload)
          .eq('id', retryTarget.id)
        e = retryError || null
      } else {
        const hasOtherRowInSamePeriod = (retryRows || []).length > 0
        e = {
          ...e,
          message: hasOtherRowInSamePeriod
            ? 'Bu veritabaninda kar_zarar_donem icin benzersizlik kuralı musteri bazli degil. SQL Editor’de setup_kar_zarar_unique_fix.sql dosyasini calistirin.'
            : 'Ayni donem icin cakisan kayit algilandi. Lutfen tekrar deneyin.'
        } as any
      }
    }

    setSaving(false)
    if (e) { setError(e.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    loadDonem()
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExportExcel() {
    const XLSX = (await import('xlsx-js-style')).default
    const isOzet = view === 'ozet'
    const c   = isOzet ? cumCalc : calc
    const raw = isOzet ? cumRaw : calcRaw
    const per = isOzet ? `${ayKisa(rangeStart)} - ${ayKisa(rangeEnd)}` : ayLabel(donem)
    const wb  = XLSX.utils.book_new()

    // ── Stil yardımcıları ────────────────────────────────────────────────────
    type CellStyle = { v: any; t: string; s: Record<string, any> }
    const border = (color = 'D1D5DB') => ({
      top:    { style: 'thin', color: { rgb: color } },
      bottom: { style: 'thin', color: { rgb: color } },
      left:   { style: 'thin', color: { rgb: color } },
      right:  { style: 'thin', color: { rgb: color } },
    })
    const borderThinRight = (color = 'D1D5DB') => ({ right: { style: 'thin', color: { rgb: color } } });

    const sc = (v: any, t: string, s: Record<string, any> = {}): CellStyle => ({ v, t, s })

    // For section headers, merge across 5 columns now
    const sectionLabel = (v: string, bg: string, color: string): CellStyle => sc(v, 's', {
      font:      { bold: true, sz: 9, color: { rgb: color }, name: 'Calibri' },
      fill:      { fgColor: { rgb: bg }, patternType: 'solid' },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border:    { bottom: { style: 'medium', color: { rgb: 'CBD5E1' } } },
    })

    const mainHeader = (v: string): CellStyle => sc(v, 's', {
      font:      { bold: true, sz: 16, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: '0F172A' }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    })
    const subHeader = (v: string): CellStyle => sc(v, 's', {
      font:      { sz: 10, color: { rgb: '94A3B8' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: '1E293B' }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
    })
    const colHead = (v: string, align: string = 'right'): CellStyle => sc(v, 's', {
      font:      { bold: true, sz: 9, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
      fill:      { fgColor: { rgb: '334155' }, patternType: 'solid' },
      alignment: { horizontal: align, vertical: 'center' },
      border:    border('475569'),
    })
    const label = (v: string, indent = false): CellStyle => sc(v, 's', {
      font:      { sz: 10, color: { rgb: '374151' }, name: 'Calibri' },
      alignment: { horizontal: 'left', vertical: 'center', indent: indent ? 2 : 1 },
      border:    border(),
    })
    const money = (v: number, color = '1F2937', bold = false, bg?: string): CellStyle => sc(v, 'n', {
      font:      { sz: 10, color: { rgb: color }, bold, name: 'Calibri' },
      fill:      bg ? { fgColor: { rgb: bg }, patternType: 'solid' } : undefined,
      numFmt:    '#,##0.00 ₺',
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    border(),
    })
    const pctCell = (v: string, color = '64748B', bold = true): CellStyle => sc(v, 's', {
      font:      { sz: 9, color: { rgb: color }, italic: true, bold, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    border(),
    })
    const highlightRow = (lbl: string, val: number, marj: string, bg: string, fc: string) => [
      sc(lbl, 's', { font: { bold: true, sz: 11, color: { rgb: fc }, name: 'Calibri' }, fill: { fgColor: { rgb: bg }, patternType: 'solid' }, alignment: { horizontal: 'left', vertical: 'center', indent: 1 }, border: border(fc + '40') }),
      sc(val, 'n', { font: { bold: true, sz: 12, color: { rgb: fc }, name: 'Calibri' }, fill: { fgColor: { rgb: bg }, patternType: 'solid' }, numFmt: '#,##0.00 ₺', alignment: { horizontal: 'right', vertical: 'center' }, border: border(fc + '40') }),
      sc(marj, 's', { font: { bold: true, sz: 9, color: { rgb: fc }, italic: true, name: 'Calibri' }, fill: { fgColor: { rgb: bg }, patternType: 'solid' }, alignment: { horizontal: 'center', vertical: 'center' }, border: border(fc + '40') }),
    ]
    const empty = (bg?: string): CellStyle => sc('', 's', bg ? { fill: { fgColor: { rgb: bg }, patternType: 'solid' } } : {})

    // ════════════════════════════════════════════════════════════════════════
    // Sheet 1 — K/Z Özeti (3 sütun: Kalem | Tutar | Marj)
    // ════════════════════════════════════════════════════════════════════════
    // r0  Ana başlık
    // r1  firma/period/tarih
    // r2  boş
    // r3  Sütun başlıkları
    // r4  SATIŞLAR section   (merge)
    // r5  Yurt İçi
    // r6  Yurt Dışı
    // r7  Satış İadeleri
    // r8  Net Satışlar (highlight)
    // r9  boş
    // r10 STOK BİLGİLERİ section (merge)
    // r11 Dönem Başı Stok
    // r12 Dönem Sonu Stok
    // r13 boş
    // r14 ALIŞLAR & MALİYETLER section (merge)
    // r15 Malzeme
    // r16 E-Fatura
    // r17 E-Arşiv

    // r19 İşçilik
    // r20 Toplam Alışlar & İşçilik
    // r21 SMM
    // r22 BRÜT KAR (highlight)
    // r23 boş
    // r24 GENEL YÖNETİM GİDERLERİ section (merge)
    // r25 Personel
    // r26 Kira
    // r27 Fatura/Abonelik
    // r28 Amortisman
    // r29 Diğer
    // r30 Toplam GYG
    // r31 boş
    // r32 FAALİYET KARI (highlight)
    const ozRows: any[][] = [
      [mainHeader('KAR / ZARAR TABLOSU'), empty('0F172A'), empty('0F172A')],                                            // r0
      [subHeader(firma.ad), subHeader(per), subHeader(new Date().toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' }))], // r1
      [empty(), empty(), empty()],                                                                                       // r2
      [colHead('KALEM', 'left'), colHead('TUTAR (₺)'), colHead('MARJ')],                                               // r3
      // ── Satışlar ──────────────────────────────────────────────────────────
      [sectionLabel('SATIŞLAR', 'DCFCE7', '15803D'), empty('DCFCE7'), empty('DCFCE7')],                                // r4
      [label('Hakedişler',  true), money(raw.satis_yurt_ici,  '374151'), pctCell('')],                          // r5
      [label('Diğer Satışlar', true), money(raw.satis_yurt_disi, '374151'), pctCell('')],                          // r6
      [label('Satış İadeleri (−)', true), money(raw.satis_iade,      'DC2626'), pctCell('')],                          // r7
      [...highlightRow('Net Satışlar', c.netSatis, '100%', 'DBEAFE', '1D4ED8')],                                       // r8
      [empty(), empty(), empty()],                                                                                       // r9
      // ── Stok Bilgileri ────────────────────────────────────────────────────
      [sectionLabel('STOK BİLGİLERİ', 'DBEAFE', '1D4ED8'), empty('DBEAFE'), empty('DBEAFE')],                         // r10
      [label('Dönem Başı Stok', true), money(raw.donem_basi_stok, '374151'), pctCell('')],                             // r11
      [label('Dönem Sonu Stok', true), money(raw.donem_sonu_stok, '374151'), pctCell('')],                             // r12
      [empty(), empty(), empty()],                                                                                       // r13
      // ── Alışlar & Maliyetler ───────────────────────────────────────────────
      [sectionLabel('ALIŞLAR & MALİYETLER', 'FFF7ED', 'B45309'), empty('FFF7ED'), empty('FFF7ED')],                   // r14
      [label('%1 Alışlar',  true), money(raw.alis_malzeme,  '374151'), pctCell('')],                             // r15
      [label('%10 Alışlar', true), money(raw.alis_efatura,  '374151'), pctCell('')],                             // r16
      [label('%20 Alışlar',  true), money(raw.alis_arsiv,    '374151'), pctCell('')],                             // r17
      [label('İşçilik Giderleri', true), money(raw.alis_iscilik,  '374151'), pctCell('')],                             // r19
      [label('Toplam Alışlar & İşçilik', true), money(c.toplamAlis, '92400E', true), pctCell('')],                     // r20
      [label('Satılan Mal Maliyeti (SMM)', true), money(c.smm,      'B45309', true), pctCell('')],                     // r21
      [...highlightRow('BRÜT KAR', c.brutKar, pct(c.brutKar, c.netSatis), c.brutKar >= 0 ? 'DCFCE7' : 'FEE2E2', c.brutKar >= 0 ? '15803D' : 'DC2626')], // r22
      [empty(), empty(), empty()],                                                                                       // r23
      // ── Genel Yönetim Giderleri ────────────────────────────────────────────
      [sectionLabel('GENEL YÖNETİM GİDERLERİ', 'F5F3FF', '6D28D9'), empty('F5F3FF'), empty('F5F3FF')],               // r24 (-1)
      [label('Kira Giderleri',     true), money(raw.gider_kira,       '374151'), pctCell('')],                         // r25 (-1)
      [label('Sigorta Giderleri',  true), money(raw.gider_fatura,     '374151'), pctCell('')],                         // r26 (-1)
      [label('Amortisman',         true), money(raw.gider_amortisman, '374151'), pctCell('')],                         // r27 (-1)
      [label('Diğer Giderler',     true), money(raw.gider_diger,      '374151'), pctCell('')],                         // r28 (-1)
      [label('Finansal Giderler',  true), money(raw.gider_finansal,   '374151'), pctCell('')],                         // r29 (-1)
      [label('Toplam GYG',         true), money(c.toplamGyg, '6D28D9', true), pctCell('')],                           // r29 (-1)
      [empty(), empty(), empty()],                                                                                       // r30 (-1)
      [...highlightRow('FAALİYET KARI', c.faaliyetKari, pct(c.faaliyetKari, c.netSatis), c.faaliyetKari >= 0 ? 'DBEAFE' : 'FEE2E2', c.faaliyetKari >= 0 ? '1D4ED8' : 'DC2626')], // r31 (-1)
    ]

    const ws1 = XLSX.utils.aoa_to_sheet(ozRows)
    ws1['!cols']   = [{ wch: 36 }, { wch: 20 }, { wch: 12 }]
    ws1['!rows']   = [{ hpt: 32 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 }]
    ws1['!merges'] = [
      { s: { r:  0, c: 0 }, e: { r:  0, c: 2 } }, // Ana başlık
      { s: { r:  4, c: 0 }, e: { r:  4, c: 2 } }, // Satışlar
      { s: { r: 10, c: 0 }, e: { r: 10, c: 2 } }, // Stok Bilgileri
      { s: { r: 14, c: 0 }, e: { r: 14, c: 2 } }, // Alışlar & Maliyetler
      { s: { r: 23, c: 0 }, e: { r: 23, c: 2 } }, // Genel Yönetim Giderleri (r24 -> r23)
    ]
    XLSX.utils.book_append_sheet(wb, ws1, 'K-Z Özeti')

    // ════════════════════════════════════════════════════════════════════════
    // Sheet 2 — Aylık Dağılım (sadece rapor modunda)
    // ════════════════════════════════════════════════════════════════════════
    if (isOzet && rowCalcs.length > 0) {
      const COLS = 11
      const aylikHead = (v: string, bg: string, fc: string, align = 'right') => sc(v, 's', {
        font:      { bold: true, sz: 9, color: { rgb: fc }, name: 'Calibri' },
        fill:      { fgColor: { rgb: bg }, patternType: 'solid' },
        alignment: { horizontal: align, vertical: 'center', wrapText: true },
        border:    border('475569'),
      })
      const dataCell = (v: any, t: string, bg: string, color: string, bold = false, fmt = '#,##0.00 ₺') => sc(v, t, {
        font:      { sz: 9, color: { rgb: color }, bold, name: 'Calibri' },
        fill:      { fgColor: { rgb: bg }, patternType: 'solid' },
        numFmt:    t === 'n' ? fmt : undefined,
        alignment: { horizontal: t === 'n' ? 'right' : 'left', vertical: 'center' },
        border:    border(),
      })
      const totalCell = (v: any, t: string, color: string, fmt = '#,##0.00 ₺') => sc(v, t, {
        font:      { bold: true, sz: 10, color: { rgb: color }, name: 'Calibri' },
        fill:      { fgColor: { rgb: 'EFF6FF' }, patternType: 'solid' },
        numFmt:    t === 'n' ? fmt : undefined,
        alignment: { horizontal: t === 'n' ? 'right' : 'left', vertical: 'center' },
        border:    { top: { style: 'medium', color: { rgb: '3B82F6' } }, bottom: { style: 'medium', color: { rgb: '3B82F6' } }, left: { style: 'thin', color: { rgb: 'D1D5DB' } }, right: { style: 'thin', color: { rgb: 'D1D5DB' } } },
      })

      const ayRows: any[][] = [
        // Başlık
        [mainHeader('KAR / ZARAR — AYLIK DAĞILIM'), ...Array(COLS - 1).fill(empty('0F172A'))],
        [subHeader(firma.ad), ...Array(COLS - 1).fill(subHeader(''))],
        [subHeader(per), ...Array(COLS - 1).fill(subHeader(''))],
        [empty(), ...Array(COLS - 1).fill(empty())],
        // Sütun başlıkları — 3 renk grubu
        [
          aylikHead('DÖNEM',        '1E293B', 'FFFFFF', 'left'),
          aylikHead('NET SATIŞ',    '1E3A5F', 'FFFFFF'),
          aylikHead('%1 ALIŞ',      '7C2D12', 'FFFFFF'),
          aylikHead('%10 ALIŞ',     '7C2D12', 'FFFFFF'),
          aylikHead('%20 ALIŞ',     '7C2D12', 'FFFFFF'),
          aylikHead('İŞÇİLİK',      '7C2D12', 'FFFFFF'),
          aylikHead('TOP. ALIŞ',    '92400E', 'FFFFFF'),
          aylikHead('BRÜT KAR',     '14532D', 'FFFFFF'),
          aylikHead('TOPLAM GYG',   '4C1D95', 'FFFFFF'),
          aylikHead('FAALİYET KARI','1E3A5F', 'FFD700'),
        ],
        // Veri satırları
        ...rowCalcs.map((r, i) => {
          const bg = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC'
          const fkColor = r.faaliyetKari >= 0 ? '15803D' : 'DC2626'
          const bkColor = r.brutKar >= 0 ? '15803D' : 'DC2626'
          return [
            dataCell(ayKisa(r.donem), 's', bg, '1E293B', true),
            dataCell(r.netSatis, 'n', bg, '1D4ED8', false),
            dataCell(r.alis_malzeme, 'n', bg, '92400E', false),
            dataCell(r.alis_efatura, 'n', bg, '92400E', false),
            dataCell(r.alis_arsiv, 'n', bg, '92400E', false),
            dataCell(r.alis_iscilik, 'n', bg, '92400E', false),
            dataCell(r.toplamAlis, 'n', bg, 'B45309', true),
            dataCell(r.brutKar, 'n', bg, bkColor, true),
            dataCell(r.toplamGyg, 'n', bg, '6D28D9', false),
            dataCell(r.faaliyetKari, 'n', bg, fkColor, true),
          ]
        }),
        // Toplam satırı
        [
          totalCell('TOPLAM', 's', '0F172A'),
          totalCell(cumCalc.netSatis, 'n', '1D4ED8'),
          totalCell(cumAlis.malzeme, 'n', 'B45309'),
          totalCell(cumAlis.efatura, 'n', 'B45309'),
          totalCell(cumAlis.arsiv, 'n', 'B45309'),
          totalCell(cumAlis.iscilik, 'n', 'B45309'),
          totalCell(cumCalc.toplamAlis, 'n', 'B45309'),
          totalCell(cumCalc.brutKar, 'n', cumCalc.brutKar >= 0 ? '15803D' : 'DC2626'),
          totalCell(cumCalc.toplamGyg, 'n', '6D28D9'),
          totalCell(cumCalc.faaliyetKari, 'n', cumCalc.faaliyetKari >= 0 ? '1D4ED8' : 'DC2626'),
        ],
      ]

      const ws2 = XLSX.utils.aoa_to_sheet(ayRows)
      ws2['!cols']   = [{ wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 16 }]
      ws2['!rows']   = [{ hpt: 28 }, { hpt: 16 }, { hpt: 16 }, { hpt: 6 }, { hpt: 36 }]
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: COLS - 1 } },
      ]
      ws2['!freeze'] = { xSplit: 1, ySplit: 5 } // Dönem kolonu + başlıklar donduruldu
      XLSX.utils.book_append_sheet(wb, ws2, 'Aylık Dağılım')
    }

    const fileName = isOzet ? `KarZarar_Ozet_${firma.ad}_${rangeStart}_${rangeEnd}.xlsx` : `KarZarar_${firma.ad}_${donem}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  async function handleExportPDF() {
    try {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF('p', 'mm', 'a4')
    let fontName = 'Helvetica'
    try {
      await loadRobotoFont(doc)
      fontName = 'Roboto'
    } catch (e) {
      console.warn('Roboto font yuklenemedi, Helvetica kullaniliyor:', e)
    }

    // Helper function to convert hex color to RGB array for jspdf
    const hexToRgb = (hex: string): [number, number, number] => {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
    }

    const lightenHex = (hex: string, factor: number): [number, number, number] => {
      const rgb = hexToRgb(hex);
      return rgb.map(c => Math.min(255, Math.floor(c + (255 - c) * factor))) as [number, number, number];
    }

    const isOzet = view === 'ozet'
    const c   = isOzet ? cumCalc : calc
    const raw = isOzet ? cumRaw : calcRaw
    const per = isOzet ? `${ayKisa(rangeStart)} - ${ayKisa(rangeEnd)}` : ayLabel(donem)
    const color = (v: number, pos = '#16a34a', neg = '#dc2626') => v >= 0 ? pos : neg

    // Her bölüm: [başlık?, girintili?, etiket, tutar, marj, kalın?, renk]
    type KZRow = { section?: string; sectionColor?: string; label: string; value: string; marj?: string; bold?: boolean; color?: string; indent?: boolean; highlight?: string }
    const kzRows: KZRow[] = [
      // Satışlar
      { section: 'SATIŞLAR', sectionColor: '#15803d', label: '', value: '' },
      { label: 'Hakedişler',  value: fmt(raw.satis_yurt_ici),  indent: true },
      { label: 'Diğer Satışlar', value: fmt(raw.satis_yurt_disi), indent: true },
      { label: 'Satış İadeleri (−)', value: fmt(raw.satis_iade),      indent: true, color: '#dc2626' },
      { label: 'Net Satışlar', value: fmt(c.netSatis), marj: '100%', bold: true, color: '#1d4ed8', highlight: '#eff6ff' },
      // Stok Bilgileri
      { section: 'STOK BİLGİLERİ', sectionColor: '#1d4ed8', label: '', value: '' },
      { label: 'Dönem Başı Stok', value: fmt(raw.donem_basi_stok), indent: true },
      { label: 'Dönem Sonu Stok', value: fmt(raw.donem_sonu_stok), indent: true },
      // Alışlar & Maliyetler
      { section: 'ALIŞLAR & MALİYETLER', sectionColor: '#b45309', label: '', value: '' },
      { label: '%1 Alışlar',  value: fmt(raw.alis_malzeme),  indent: true },
      { label: '%10 Alışlar', value: fmt(raw.alis_efatura),  indent: true },
      { label: '%20 Alışlar',  value: fmt(raw.alis_arsiv),    indent: true },
      { label: 'İşçilik Giderleri', value: fmt(raw.alis_iscilik),  indent: true },
      { label: 'Toplam Alışlar & İşçilik', value: fmt(c.toplamAlis), bold: true, color: '#92400e' },
      { label: 'Satılan Mal Maliyeti (SMM)', value: fmt(c.smm), bold: true, color: '#b45309' },
      { label: 'BRÜT KAR', value: fmt(c.brutKar), marj: pct(c.brutKar, c.netSatis), bold: true, color: color(c.brutKar), highlight: c.brutKar >= 0 ? '#dcfce7' : '#fee2e2' },
      // Genel Yönetim Giderleri
      { section: 'GENEL YÖNETİM GİDERLERİ', sectionColor: '#6d28d9', label: '', value: '' },
      { label: 'Kira Giderleri',     value: fmt(raw.gider_kira),       indent: true },
      { label: 'Sigorta Giderleri',  value: fmt(raw.gider_fatura),     indent: true },
      { label: 'Amortisman',         value: fmt(raw.gider_amortisman), indent: true },
      { label: 'Diğer Giderler',     value: fmt(raw.gider_diger),      indent: true },
      { label: 'Finansal Giderler',  value: fmt(raw.gider_finansal),   indent: true },
      { label: 'Toplam GYG', value: fmt(c.toplamGyg), bold: true, color: '#6d28d9' },
      // Sonuç
      { label: 'FAALİYET KARI', value: fmt(c.faaliyetKari), marj: pct(c.faaliyetKari, c.netSatis), bold: true, color: color(c.faaliyetKari), highlight: c.faaliyetKari >= 0 ? '#dbeafe' : '#fee2e2' },
    ]

    // Header
    doc.setFont(fontName, 'bold')
    doc.setFontSize(16)
    doc.text(`KAR / ZARAR TABLOSU - ${firma.ad}`, 14, 18)
    doc.setFontSize(10)
    doc.setFont(fontName, 'normal')
    doc.text(`Dönem: ${per}`, 14, 25)
    doc.text(`Oluşturulma: ${new Date().toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' })}`, 14, 30)

    // Summary Table
    autoTable(doc, {
      startY: 40,
      head: [['Kalem', 'Tutar (₺)', 'Marj']],
      body: kzRows.map(row => {
        if (row.section) {
          return [{
            content: cleanTr(row.section!),
            colSpan: 3,
            styles: {
              fillColor: lightenHex(row.sectionColor!, 0.85), // Lighter background
              textColor: hexToRgb(row.sectionColor!),
              fontStyle: 'bold',
              fontSize: 9,
              halign: 'left',
              valign: 'middle',
              cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
              lineColor: lightenHex(row.sectionColor!, 0.7), // Slightly lighter border
              lineWidth: { top: 0.2, bottom: 0.2, left: 0, right: 0 },
            }
          }]
        }
        return [
          {
            content: cleanTr(row.label),
            styles: {
              fontStyle: row.bold ? 'bold' : 'normal',
              textColor: hexToRgb(row.color || '#374151'),
              halign: 'left',
              cellPadding: { left: row.indent ? 8 : 4 },
            }
          },
          {
            content: `₺${row.value}`, // This is where the error was reported
            styles: {
              fontStyle: row.bold ? 'bold' : 'normal',
              textColor: hexToRgb(row.color || '#374151'),
              halign: 'right',
            }
          },
          {
            content: row.marj || '',
            styles: {
              fontStyle: row.bold ? 'bold' : 'normal',
              textColor: hexToRgb(row.color || '#64748B'),
              halign: 'center',
            }
          }
        ]
      }),
      theme: 'grid',
      styles: {
        font: fontName,
        fontSize: 10,
        cellPadding: 2,
        lineColor: '#e2e8f0', // Light gray borders
        lineWidth: 0.1,
        textColor: '#1e293b',
      },
      headStyles: {
        fillColor: '#1e293b', // Dark background for header
        textColor: '#ffffff',
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 10,
      },
      columnStyles: {
        0: { cellWidth: 70 }, // Kalem
        1: { cellWidth: 40 }, // Tutar
        2: { cellWidth: 20 }, // Marj
      },
      didParseCell: function (data: any) {
        // Apply highlight background for specific rows
        const rowData = kzRows[data.row.index];
        if (rowData && rowData.highlight) {
          data.cell.styles.fillColor = hexToRgb(rowData.highlight);
        }
        // Apply specific text color for highlight rows
        if (rowData && rowData.color && rowData.highlight) {
          data.cell.styles.textColor = hexToRgb(rowData.color);
        }
      },
      margin: { top: 10, bottom: 10, left: 14, right: 14 },
    })

    // Monthly Table (if in report view)
    if (isOzet && rowCalcs.length > 0) {
      doc.addPage('a4', 'landscape') // Add a new page for the monthly table, in landscape
      doc.setFont(fontName, 'bold')
      doc.setFontSize(14)
      doc.text('AYLIK DAĞILIM', 14, 18)
      doc.setFontSize(10)
      doc.setFont(fontName, 'normal')
      doc.text(`Dönem: ${per}`, 14, 25)
      const monthlyHead = [['Dönem', 'Net Satış', '%1 Alis', '%10 Alis', '%20 Alis', 'Iscilik', 'Top. Alis', 'Brut Kar', 'Toplam GYG', 'Faal. Kari']]
      const monthlyBody = rowCalcs.map(r => {
        return [
          cleanTr(ayKisa(r.donem)),
          `₺${fmt(r.netSatis)}`,
          `₺${fmt(r.alis_malzeme)}`,
          `₺${fmt(r.alis_efatura)}`,
          `₺${fmt(r.alis_arsiv)}`,
          `₺${fmt(r.alis_iscilik)}`,
          `₺${fmt(r.toplamAlis)}`,
          `${r.brutKar < 0 ? '-' : ''}₺${fmt(Math.abs(r.brutKar))}`,
          `₺${fmt(r.toplamGyg)}`,
          `${r.faaliyetKari < 0 ? '-' : ''}₺${fmt(Math.abs(r.faaliyetKari))}`,
        ]
      })
      const totalRow = [
        'TOPLAM',
        `₺${fmt(cumCalc.netSatis)}`,
        `₺${fmt(cumAlis.malzeme)}`,
        `₺${fmt(cumAlis.efatura)}`,
        `₺${fmt(cumAlis.arsiv)}`,
        `₺${fmt(cumAlis.iscilik)}`,
        `₺${fmt(cumCalc.toplamAlis)}`,
        `${cumCalc.brutKar < 0 ? '-' : ''}₺${fmt(Math.abs(cumCalc.brutKar))}`,
        `₺${fmt(cumCalc.toplamGyg)}`,
        `${cumCalc.faaliyetKari < 0 ? '-' : ''}₺${fmt(Math.abs(cumCalc.faaliyetKari))}`,
      ]

      autoTable(doc, {
        startY: 35,
        head: monthlyHead,
        body: [...monthlyBody, totalRow],
        theme: 'grid',
        styles: {
          font: fontName,
          fontSize: 8,
          cellPadding: 1.5,
          lineColor: '#e2e8f0',
          lineWidth: 0.1,
          textColor: '#1e293b',
        },
        headStyles: {
          fillColor: '#1e293b',
          textColor: '#ffffff',
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 9,
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 20 }, // Dönem
          1: { halign: 'right', cellWidth: 25 }, // Net Satış
          2: { halign: 'right', cellWidth: 22 }, // %1 Alış
          3: { halign: 'right', cellWidth: 22 }, // %10 Alış
          4: { halign: 'right', cellWidth: 22 }, // %20 Alış
          5: { halign: 'right', cellWidth: 22 }, // İşçilik
          6: { halign: 'right', cellWidth: 25 }, // Top. Alış
          7: { halign: 'right', cellWidth: 25 }, // Brüt Kar
          8: { halign: 'right', cellWidth: 25 }, // Toplam GYG
          9: { halign: 'right', cellWidth: 25 }, // Faal. Karı
        },
        didParseCell: function (data: any) {
          // Apply specific colors for Brüt Kar and Faaliyet Karı columns
          if (data.section === 'body') {
            const rowData = rowCalcs[data.row.index];
            if (rowData) {
              if (data.column.index === 7) { // Brüt Kar
                data.cell.styles.textColor = hexToRgb(rowData.brutKar >= 0 ? '#15803D' : '#DC2626');
                data.cell.styles.fontStyle = 'bold';
              } else if (data.column.index === 9) { // Faaliyet Karı
                data.cell.styles.textColor = hexToRgb(rowData.faaliyetKari >= 0 ? '#1D4ED8' : '#DC2626');
                data.cell.styles.fontStyle = 'bold';
              }
            }
            // Total row styling
            if (data.row.index === monthlyBody.length) { // Last row is total
              data.cell.styles.fillColor = hexToRgb('#EFF6FF');
              data.cell.styles.textColor = hexToRgb('#1e293b');
              data.cell.styles.fontStyle = 'bold';
              if (data.column.index === 0) { // TOPLAM label
                data.cell.styles.halign = 'left';
              }
              if (data.column.index === 8) { // Brüt Kar total
                data.cell.styles.textColor = hexToRgb(cumCalc.brutKar >= 0 ? '#15803D' : '#DC2626');
              } else if (data.column.index === 10) { // Faaliyet Karı total
                data.cell.styles.textColor = hexToRgb(cumCalc.faaliyetKari >= 0 ? '#1D4ED8' : '#DC2626');
              }
            }
          }
        },
        margin: { top: 10, bottom: 10, left: 14, right: 14 },
      })
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`${firma.ad} — Kar / Zarar Raporu`, 14, (doc as any).internal.pageSize.height - 10);
      doc.text(`${per}`, (doc as any).internal.pageSize.width - 14, (doc as any).internal.pageSize.height - 10, { align: 'right' });
      doc.text(`Sayfa ${i} / ${pageCount}`, (doc as any).internal.pageSize.width / 2, (doc as any).internal.pageSize.height - 10, { align: 'center' });
    }

    const fileName = isOzet ? `KarZarar_Ozet_${firma.ad}_${rangeStart}_${rangeEnd}.pdf` : `KarZarar_${firma.ad}_${donem}.pdf`
    doc.save(fileName)
    } catch (err) {
      console.error('PDF oluşturma hatası:', err)
    }
  }

  // Aylık hesap (form'dan)
  const calc = useMemo(() => calcRow({
    firma_id: selFirmaId, donem, notlar: null,
    satis_yurt_ici: n(form.satis_yurt_ici), satis_yurt_disi: n(form.satis_yurt_disi), satis_iade: n(form.satis_iade),
    donem_basi_stok: n(form.donem_basi_stok), donem_sonu_stok: n(form.donem_sonu_stok),
    alis_malzeme: n(form.alis_malzeme), alis_efatura: n(form.alis_efatura),
    alis_arsiv: n(form.alis_arsiv), alis_utts: 0, alis_iscilik: n(form.alis_iscilik),
    gider_personel: n(form.gider_personel), gider_kira: n(form.gider_kira),
    gider_fatura: n(form.gider_fatura), gider_amortisman: n(form.gider_amortisman), gider_diger: n(form.gider_diger), gider_finansal: n(form.gider_finansal),
    vergi_orani: n(form.vergi_orani) || 22,
  }), [form])

  // Ham veri (bireysel satırlar için)
  const calcRaw = useMemo<KZRaw>(() => ({
    satis_yurt_ici: n(form.satis_yurt_ici), satis_yurt_disi: n(form.satis_yurt_disi), satis_iade: n(form.satis_iade),
    donem_basi_stok: n(form.donem_basi_stok), donem_sonu_stok: n(form.donem_sonu_stok),
    alis_malzeme: n(form.alis_malzeme), alis_efatura: n(form.alis_efatura),
    alis_arsiv: n(form.alis_arsiv), alis_utts: 0, alis_iscilik: n(form.alis_iscilik),
    gider_personel: n(form.gider_personel), gider_kira: n(form.gider_kira),
    gider_fatura: n(form.gider_fatura), gider_amortisman: n(form.gider_amortisman), gider_diger: n(form.gider_diger), gider_finansal: n(form.gider_finansal),
  }), [form])

  // Kümülatif hesap
  const cumCalc     = useMemo(() => calcCumulative(rangeRows), [rangeRows])
  const prevCumCalc = useMemo(() => calcCumulative(prevRangeRows), [prevRangeRows]);
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

  const cumRaw = useMemo<KZRaw>(() => {
    const sorted = [...rangeRows].sort((a, b) => a.donem.localeCompare(b.donem))
    return {
      satis_yurt_ici:   rangeRows.reduce((s, r) => s + r.satis_yurt_ici, 0),
      satis_yurt_disi:  rangeRows.reduce((s, r) => s + r.satis_yurt_disi, 0),
      satis_iade:       rangeRows.reduce((s, r) => s + r.satis_iade, 0),
      donem_basi_stok:  sorted[0]?.donem_basi_stok ?? 0,
      donem_sonu_stok:  sorted[sorted.length - 1]?.donem_sonu_stok ?? 0,
      alis_malzeme:     rangeRows.reduce((s, r) => s + r.alis_malzeme, 0),
      alis_efatura:     rangeRows.reduce((s, r) => s + r.alis_efatura, 0),
      alis_arsiv:       rangeRows.reduce((s, r) => s + r.alis_arsiv, 0),
      alis_utts:        rangeRows.reduce((s, r) => s + r.alis_utts, 0),
      alis_iscilik:     rangeRows.reduce((s, r) => s + r.alis_iscilik, 0),
      gider_personel:   rangeRows.reduce((s, r) => s + r.gider_personel, 0),
      gider_kira:       rangeRows.reduce((s, r) => s + r.gider_kira, 0),
      gider_fatura:     rangeRows.reduce((s, r) => s + r.gider_fatura, 0),
      gider_amortisman: rangeRows.reduce((s, r) => s + r.gider_amortisman, 0),
      gider_diger:      rangeRows.reduce((s, r) => s + r.gider_diger, 0),
      gider_finansal:   rangeRows.reduce((s, r) => s + r.gider_finansal, 0),
    }
  }, [rangeRows])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }))

  if (loading) return <Loading />
  if (error && !saving) return <ErrorMsg message={error} onRetry={loadDonem} />

  // ── K/Z Tablosu ────────────────────────────────────────────────────────────
  const KZTablo = ({ c, baslik, subtitle, raw }: { c: ReturnType<typeof calcRow>; baslik: string; subtitle?: string; raw?: KZRaw }) => {
    const kar = c.faaliyetKari
    const karRenk = kar >= 0 ? '#16a34a' : '#dc2626'
    const karBg   = kar >= 0 ? '#f0fdf4' : '#fef2f2'
    const karBorder = kar >= 0 ? '#bbf7d0' : '#fecaca'

    const chartData = [
      { name: 'Satışlar',    tutar: c.netSatis,     fill: '#3b82f6' },
      { name: 'Maliyetler',  tutar: c.smm,          fill: '#f97316' },
      { name: 'Giderler',    tutar: c.toplamGyg,    fill: '#a855f7' },
      { name: 'Brüt Kâr',   tutar: Math.max(0, c.brutKar),    fill: '#22c55e' },
      { name: 'Net Kâr',     tutar: Math.max(0, c.faaliyetKari), fill: kar >= 0 ? '#16a34a' : '#ef4444' },
    ]

    return (
      <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
        {/* Başlık */}
        <div className="px-4 py-2.5 border-b border-blue-50 bg-blue-50/60 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">{baslik}</p>
            {subtitle && <p className="text-[13px] font-bold text-slate-700 mt-0.5">{subtitle}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-medium">Faaliyet Kârı</p>
            <p className="text-[18px] font-black tabular-nums" style={{ color: karRenk }}>
              {kar < 0 ? '−' : '+'}₺{fmt(Math.abs(kar))}
            </p>
          </div>
        </div>

        {/* Özet Kartlar */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
          {[
            { label: '💰 Net Satış',   value: c.netSatis,    color: '#2563eb' },
            { label: '🛒 Toplam Maliyet', value: c.smm + c.toplamGyg, color: '#ea580c' },
            { label: kar >= 0 ? '📈 Kâr' : '📉 Zarar', value: kar, color: karRenk },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-3 py-2 text-center">
              <p className="text-[9px] font-semibold text-slate-400 mb-0.5">{label}</p>
              <p className="text-[13px] font-bold tabular-nums leading-none" style={{ color }}>₺{fmt(Math.abs(value))}</p>
            </div>
          ))}
        </div>

        {/* Grafik */}
        <div className="px-3 pt-3 pb-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Görsel Özet</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v) => `₺${fmt(Number(v))}`}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}
              />
              <Bar dataKey="tutar" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tablo */}
        <div className="px-4 py-2 space-y-0 divide-y divide-slate-50">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pb-1">📊 Detay</p>

          {/* Satışlar */}
          <div className="py-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-green-600 mb-0.5">Gelirler</p>
            {raw && <>
              <PRow label="Hakedişler"    value={raw.satis_yurt_ici}  indent />
              <PRow label="Diğer Satışlar" value={raw.satis_yurt_disi} indent />
              {raw.satis_iade > 0 && <PRow label="İadeler (−)" value={raw.satis_iade} indent color="#dc2626" />}
            </>}
            <PRow label="NET SATIŞLAR" value={c.netSatis} bold separator color="#2563eb" />
          </div>

          {/* Stok */}
          {raw && (raw.donem_basi_stok > 0 || raw.donem_sonu_stok > 0) && (
            <div className="py-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-0.5">Stok</p>
              <PRow label="Başlangıç Stoğu" value={raw.donem_basi_stok} indent />
              <PRow label="Bitiş Stoğu"     value={raw.donem_sonu_stok} indent />
            </div>
          )}

          {/* Maliyetler */}
          <div className="py-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-orange-500 mb-0.5">Maliyetler</p>
            {raw && <>
              <PRow label="%1 KDV'li Alışlar"  value={raw.alis_malzeme}  indent />
              <PRow label="%10 KDV'li Alışlar" value={raw.alis_efatura}  indent />
              <PRow label="%20 KDV'li Alışlar" value={raw.alis_arsiv}    indent />
              <PRow label="İşçilik"             value={raw.alis_iscilik}  indent />
            </>}
            <PRow label="SATILAN MAL MALİYETİ" value={c.smm} bold separator color="#ea580c" />
          </div>

          {/* Brüt Kâr */}
          <div className="py-1.5 px-2 rounded-lg my-1" style={{ background: c.brutKar >= 0 ? '#f0fdf4' : '#fef2f2' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-700">Brüt Kâr</p>
                <p className="text-[9px] text-slate-400">Satışlar − Maliyetler · Marj: {pct(c.brutKar, c.netSatis)}</p>
              </div>
              <p className="text-[15px] font-black tabular-nums" style={{ color: c.brutKar >= 0 ? '#16a34a' : '#dc2626' }}>
                {c.brutKar < 0 ? '−' : '+'}₺{fmt(Math.abs(c.brutKar))}
              </p>
            </div>
          </div>

          {/* GYG */}
          <div className="py-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-purple-500 mb-0.5">İşletme Giderleri</p>
            {raw && <>
              <PRow label="Kira"      value={raw.gider_kira}       indent />
              <PRow label="Sigorta"   value={raw.gider_fatura}     indent />
              <PRow label="Amortisman" value={raw.gider_amortisman} indent />
              <PRow label="Diğer"     value={raw.gider_diger}      indent />
              <PRow label="Banka/Faiz" value={raw.gider_finansal}  indent />
            </>}
            <PRow label="TOPLAM GİDERLER" value={c.toplamGyg} bold separator color="#7c3aed" />
          </div>

          {/* Sonuç */}
          <div className="py-2 px-2 rounded-xl mt-1" style={{ background: karBg, border: `1px solid ${karBorder}` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-black text-slate-800">
                  {kar >= 0 ? '🟢 KÂR EDİYORSUNUZ' : '🔴 ZARAR EDİYORSUNUZ'}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  Satışların {pct(kar, c.netSatis)}'i net kâra dönüştü
                </p>
              </div>
              <p className="text-[20px] font-black tabular-nums" style={{ color: karRenk }}>
                {kar < 0 ? '−' : '+'}₺{fmt(Math.abs(kar))}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Aylık veri girişi formu ────────────────────────────────────────────────
  const GirişFormu = () => (
    <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
      <SectionHeader title="💰 Satışlar — Ne Kazandık?" color="#16a34a" />
      <div className="py-1 divide-y divide-slate-50">
        <NumRow label="Hakedişler (Tahsilat)"  value={form.satis_yurt_ici}  onChange={set('satis_yurt_ici')} />
        <NumRow label="Diğer Satışlar"         value={form.satis_yurt_disi} onChange={set('satis_yurt_disi')} />
        <NumRow label="Satış İadeleri"         value={form.satis_iade}      onChange={set('satis_iade')} minus />
      </div>
      <SectionHeader title="📦 Stok Bilgileri — Depodaki Mal" color="#2563eb" />
      <div className="py-1 divide-y divide-slate-50">
        <NumRow label="Dönem Başı Stok (Ay başı depoda ne vardı?)" value={form.donem_basi_stok} onChange={set('donem_basi_stok')} />
        <NumRow label="Dönem Sonu Stok (Ay sonu depoda ne kaldı?)" value={form.donem_sonu_stok} onChange={set('donem_sonu_stok')} />
      </div>
      <SectionHeader title="🛒 Alışlar & Maliyetler — Ne Harcadık?" color="#d97706" />
      <div className="py-1 divide-y divide-slate-50">
        <NumRow label="%1 KDV'li Alışlar"   value={form.alis_malzeme}  onChange={set('alis_malzeme')} />
        <NumRow label="%10 KDV'li Alışlar"  value={form.alis_efatura}  onChange={set('alis_efatura')} />
        <NumRow label="%20 KDV'li Alışlar"  value={form.alis_arsiv}    onChange={set('alis_arsiv')} />
        <NumRow label="İşçilik Giderleri"   value={form.alis_iscilik}  onChange={set('alis_iscilik')} />
      </div>
      <SectionHeader title="🏢 Genel Giderler — İşletme Masrafları" color="#7c3aed" />
      <div className="py-1 divide-y divide-slate-50">
        <NumRow label="Kira"           value={form.gider_kira}       onChange={set('gider_kira')} />
        <NumRow label="Sigorta"        value={form.gider_fatura}     onChange={set('gider_fatura')} />
        <NumRow label="Amortisman"     value={form.gider_amortisman} onChange={set('gider_amortisman')} />
        <NumRow label="Diğer Giderler" value={form.gider_diger}      onChange={set('gider_diger')} />
        <NumRow label="Banka / Faiz"   value={form.gider_finansal}   onChange={set('gider_finansal')} />
      </div>
      <div className="px-3 py-2 border-t border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notlar</p>
        <textarea className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700 px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 transition-all" rows={2}
          placeholder="Bu döneme ait notlar..." value={form.notlar} onChange={set('notlar')} />
      </div>
    </div>
  )

  if (view === 'aylik') {
    return (
      <div className="w-full max-w-none flex flex-col gap-0 -mt-3 md:-mt-5 md:-mx-4 xl:-mx-6 2xl:-mx-8">

        {/* ── Üst Bar ── */}
        <div className="flex items-center gap-3 px-4 md:px-5 xl:px-6 py-3.5 border-b border-blue-100 flex-wrap"
          style={{ background: '#DCEEFA' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
              <BarChart2 size={15} className="text-blue-500" />
            </div>
            <div>
              <h1 className="text-[14px] font-bold text-slate-800 tracking-wide leading-none">Kar / Zarar</h1>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Aylık gelir ve gider analizi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle view={view} setView={setView} />
            <button onClick={handleExportExcel} title="Excel olarak indir"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all">
              <FileSpreadsheet size={13} className="text-emerald-600" />
              <span className="text-[11px] font-semibold text-emerald-600">Excel</span>
            </button>
          </div>
        </div>

        {/* ── Dönem Seçici ── */}
        <div className="flex items-center gap-3 px-4 md:px-5 xl:px-6 py-2 border-b border-blue-100"
          style={{ background: '#E8F4FD' }}>
          <div className="flex items-center gap-1 bg-white border border-blue-200 rounded-xl px-1 py-1 shadow-sm">
            {firmalar.length > 1 && (
              <select className="text-[12px] font-semibold text-slate-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 outline-none mr-2"
                value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
              </select>
            )}
            <button onClick={() => setDonem(prevMonth(donem))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <label className="relative cursor-pointer px-3 min-w-[120px] text-center">
              <span className="text-[13px] font-bold text-slate-700">{ayLabel(donem)}</span>
              <input type="month" value={donem} onChange={e => setDonem(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
            <button onClick={() => setDonem(nextMonth(donem))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
          {existingId && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              ✓ Kayıtlı
            </span>
          )}
        </div>

        {/* ── Tek Panel ── */}
        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.2fr)_minmax(460px,0.8fr)] gap-5 p-4 md:p-5 xl:p-6 items-start" style={{ background: '#E8F4FD' }}>
          {/* Mobil sekme */}
          <div className="flex 2xl:hidden pb-3 border-b border-blue-100 mb-1">
            <div className="flex w-full p-1 rounded-xl bg-white border border-blue-200 shadow-sm">
              {(['giris', 'tablo'] as const).map(t => (
                <button key={t} onClick={() => setMobileTab(t)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${mobileTab === t ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t === 'giris' ? <><Calculator size={13} /> Veri Girişi</> : <><BarChart2 size={13} /> K/Z Tablosu</>}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="col-span-full px-4 py-3 rounded-xl text-xs text-red-600 border border-red-200 bg-red-50">{error}</div>}

          <div className={mobileTab === 'giris' ? 'block' : 'hidden 2xl:block'}>
            {loading ? <Loading /> : GirişFormu()}
            <div className="mt-4 flex items-center gap-3">
              <button onClick={save} disabled={saving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${saved ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600 shadow-sm'}`}>
                <Save size={14} />
                {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi!' : 'Kaydet'}
              </button>
              <button onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all">
                <FileSpreadsheet size={14} /> Excel
              </button>
            </div>
          </div>

          <div className={`${mobileTab === 'tablo' ? 'block' : 'hidden 2xl:block'} 2xl:sticky 2xl:top-4`}>
            {KZTablo({ c: calc, baslik: 'Kar / Zarar Tablosu', subtitle: ayLabel(donem), raw: calcRaw })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none flex flex-col gap-0 -mt-3 md:-mt-5 md:-mx-4 xl:-mx-6 2xl:-mx-8">

      {/* ── Üst Bar ── */}
      <div className="flex items-center gap-3 px-4 md:px-5 xl:px-6 py-3.5 border-b border-blue-100 flex-wrap"
        style={{ background: '#DCEEFA' }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
            <BarChart2 size={15} className="text-blue-500" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold text-slate-800 tracking-wide leading-none">Kar / Zarar</h1>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Kümülatif finansal analiz</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} setView={setView} />
          <button onClick={handleExportExcel} title="Excel olarak indir"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all">
            <FileSpreadsheet size={13} className="text-emerald-600" />
            <span className="text-[11px] font-semibold text-emerald-600">Excel</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          KÜMÜLATİF GÖRÜNÜM
      ════════════════════════════════════════════════════════════════════════ */}
      {view === 'ozet' && (
        <>
          <div className="flex items-center gap-4 px-4 md:px-5 xl:px-6 py-2.5 border-b border-blue-100 flex-wrap"
            style={{ background: '#E8F4FD' }}>
            <ViewToggle view={view} setView={setView} />
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <Filter size={14} className="text-blue-500 shrink-0" />
              <span className="text-xs text-slate-500 shrink-0">Başlangıç</span>
              <input type="month" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                className="bg-white border border-blue-200 text-slate-700 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 shadow-sm" />
              <span className="text-xs text-slate-400 shrink-0">→</span>
              <span className="text-xs text-slate-500 shrink-0">Bitiş</span>
              <input type="month" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                className="bg-white border border-blue-200 text-slate-700 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 shadow-sm" />
              <span className="text-[10px] text-slate-400 ml-auto">{rangeRows.length} ay kayıt</span>
            </div>
          </div>

          {rangeLoading ? <Loading /> : (
            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.2fr)_minmax(460px,0.8fr)] gap-5 p-4 md:p-5 xl:p-6 items-start" style={{ background: '#E8F4FD' }}>
              <div>
                {rangeRows.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm">Bu dönemde kayıt bulunamadı.</div>
                ) : (
              KZTablo({ c: cumCalc, baslik: 'Kümülatif Kar / Zarar', subtitle: `${ayKisa(rangeStart)} – ${ayKisa(rangeEnd)}`, raw: cumRaw })
                )}
              </div>
              <div className="2xl:sticky 2xl:top-4" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
