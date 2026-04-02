'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Save, BarChart2, Calculator, Calendar, Filter, TrendingUp, TrendingDown, Layers, FileSpreadsheet, FileText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { cls, Loading, ErrorMsg } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Musteri } from '@/types'

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
  musteri_id?: string | null
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
    <div className="flex items-center gap-2 px-4 py-2.5"
      style={{ background: `${color}15`, borderLeft: `4px solid ${color}`, borderTop: '1px solid rgba(60,60,67,0.25)', borderBottom: '1px solid rgba(60,60,67,0.25)' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{title}</p>
    </div>
  )
}

function NumRow({ label, value, onChange, minus, section, sectionColor }: {
  label: string; value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  minus?: boolean; section?: string; sectionColor?: string
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(220px,260px)] gap-2 md:gap-3 px-4 py-2 items-center">
      <span className="text-sm font-medium text-[rgba(255,255,255,0.88)] leading-5 break-words">{label}</span>
      {section ? (
        <span
          className="justify-self-start md:justify-self-center text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap"
          style={{ color: sectionColor, background: `${sectionColor}22` }}
        >
          {section}
        </span>
      ) : <span className="hidden md:block" />}
      <div className="relative w-full">
        {minus && <span className="absolute top-1/2 -translate-y-1/2 text-sm text-[#FF453A] font-bold" style={{ left: '0.75rem' }}>−</span>}
        <span
          className="absolute top-1/2 -translate-y-1/2 text-sm text-[rgba(235,235,245,0.38)] font-medium"
          style={{ left: minus ? '1.5rem' : '0.85rem' }}
        >
          ₺
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full h-11 bg-[#111113] border border-[rgba(255,255,255,0.08)] text-white text-base md:text-lg tabular-nums rounded-xl outline-none focus:border-[#0A84FF] focus:ring-2 focus:ring-[rgba(10,132,255,0.18)] text-right pr-4"
          style={{ paddingLeft: minus ? '2.5rem' : '1.85rem' }}
          placeholder="0,00"
          value={value}
          onChange={onChange}
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
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-start md:items-center gap-2 py-2 ${separator ? 'border-t border-[rgba(60,60,67,0.4)] mt-2 pt-3' : ''} ${indent ? 'pl-4 md:pl-5' : ''}`}>
      <div className="min-w-0">
        <span className={`block leading-5 ${bold ? 'font-bold text-white text-sm' : 'text-[rgba(235,235,245,0.72)] text-sm'}`}>{label}</span>
        {sub && <span className="block text-[11px] text-[rgba(235,235,245,0.38)] mt-0.5">{sub}</span>}
      </div>
      <span
        className={`text-sm md:text-base tabular-nums whitespace-nowrap ${bold ? 'font-bold' : 'font-semibold'}`}
        style={{ color: color ?? (bold ? (value >= 0 ? '#30D158' : '#FF453A') : 'rgba(255,255,255,0.88)') }}
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
    return { value: '—', color: 'rgba(235,235,245,0.4)' };
  }
  // If previous is 0, but current is not, it's an "infinite" or new value change.
  // We'll represent it as 'Yeni' (New) for simplicity or show current value if it's new.
  // To avoid division by zero, handle this edge case.
  if (previous === 0) { // If previous is 0 and current is not 0
    if (current > 0) return { value: `Yeni (+${fmt(current)})`, color: '#30D158' };
    return { value: `Yeni (${fmt(current)})`, color: '#FF453A' };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.1) return { value: '≈0%', color: 'rgba(235,235,245,0.4)' };
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
export default function KarZarar({ firma }: AppCtx) {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisYear  = thisMonth.slice(0, 4)

  // Müşteri filtresi
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [selectedMusteri, setSelectedMusteri] = useState('')

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
  const [prevRangeRows, setPrevRangeRows] = useState<KZDonem[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false)

  // Mobil sekme
  const [mobileTab, setMobileTab] = useState<'giris' | 'tablo'>('giris')

  const ViewToggle = ({ view, setView }: { view: 'aylik' | 'rapor', setView: (v: 'aylik' | 'rapor') => void }) => (
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
  );

  useEffect(() => { loadMusteriler() }, [firma.id])
  useEffect(() => {
    if (musteriler.length > 0 && !selectedMusteri) {
      const binyapi = musteriler.find(m => m.kisa_ad === 'Binyapı' || m.ad.includes('Binyapı'))
      if (binyapi) {
        setSelectedMusteri(binyapi.id)
      } else if (musteriler.length > 0) {
        setSelectedMusteri(musteriler[0].id)
      }
    }
  }, [musteriler, selectedMusteri])
  useEffect(() => { loadDonem() }, [firma.id, donem, selectedMusteri])
  useEffect(() => { if (view === 'rapor') loadRange() }, [firma.id, view, rangeStart, rangeEnd, selectedMusteri])

  async function loadMusteriler() {
    const { data } = await supabase
      .from('musteriler').select('id, ad, kisa_ad')
      .eq('firma_id', firma.id).eq('aktif', true).order('ad')
    if (data) setMusteriler(data as Musteri[])
  }

  async function loadDonem() {
    setLoading(true); setError('')
    let q = supabase.from('kar_zarar_donem').select('*').eq('firma_id', firma.id).eq('donem', donem)
    if (selectedMusteri) q = q.eq('musteri_id', selectedMusteri)
    else q = q.is('musteri_id', null)
    const { data, error: e } = await q.maybeSingle()
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
      .eq('firma_id', firma.id)
      .gte('donem', rangeStart).lte('donem', rangeEnd)
      .order('donem', { ascending: true });
    
    const prevPeriodQuery = supabase.from('kar_zarar_donem').select('*')
      .eq('firma_id', firma.id)
      .gte('donem', prevStart).lte('donem', prevEnd)
      .order('donem', { ascending: true });

    if (selectedMusteri) {
      currentPeriodQuery.eq('musteri_id', selectedMusteri);
      prevPeriodQuery.eq('musteri_id', selectedMusteri);
    } else {
      currentPeriodQuery.is('musteri_id', null);
      prevPeriodQuery.is('musteri_id', null);
    }

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
      firma_id: firma.id, donem,
      musteri_id: selectedMusteri || null,
      satis_yurt_ici: n(form.satis_yurt_ici), satis_yurt_disi: n(form.satis_yurt_disi), satis_iade: n(form.satis_iade),
      donem_basi_stok: n(form.donem_basi_stok), donem_sonu_stok: n(form.donem_sonu_stok),
      alis_malzeme: n(form.alis_malzeme), alis_efatura: n(form.alis_efatura),
      alis_arsiv: n(form.alis_arsiv), alis_utts: 0, alis_iscilik: n(form.alis_iscilik),
      gider_personel: n(form.gider_personel), gider_kira: n(form.gider_kira),
      gider_fatura: n(form.gider_fatura), gider_amortisman: n(form.gider_amortisman), gider_diger: n(form.gider_diger), gider_finansal: n(form.gider_finansal),
      vergi_orani: n(form.vergi_orani) || 22, notlar: form.notlar || null,
    }

    let targetId = existingId

    // existingId yoksa önce mevcut kayıt var mı kontrol et
    if (!targetId) {
      let q = supabase.from('kar_zarar_donem').select('id').eq('firma_id', firma.id).eq('donem', donem)
      if (selectedMusteri) q = q.eq('musteri_id', selectedMusteri)
      else q = q.is('musteri_id', null)
      const { data: existing } = await q.maybeSingle()
      if (existing?.id) targetId = existing.id
    }

    let { error: e } = targetId
      ? await supabase.from('kar_zarar_donem').update(payload).eq('id', targetId)
      : await supabase.from('kar_zarar_donem').insert(payload)

    // Unique constraint ihlali — musteri_id olmadan kayıt var, onu güncelle
    if (e?.code === '23505') {
      const { data: anyExisting } = await supabase.from('kar_zarar_donem').select('id')
        .eq('firma_id', firma.id).eq('donem', donem).maybeSingle()
      if (anyExisting?.id) {
        targetId = anyExisting.id
        const { error: e2 } = await supabase.from('kar_zarar_donem').update(payload).eq('id', targetId)
        e = e2
      }
    }

    setSaving(false)
    if (e) { setError(e.message); return }
    if (targetId && !existingId) setExistingId(targetId)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    if (!existingId && !targetId) loadDonem()
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExportExcel() {
    const XLSX = (await import('xlsx-js-style')).default
    const c   = view === 'rapor' ? cumCalc : calc
    const raw = view === 'rapor' ? cumRaw  : calcRaw
    const per = view === 'rapor' ? `${ayLabel(rangeStart)} - ${ayLabel(rangeEnd)}` : ayLabel(donem)
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
      [label('Yurt İçi Satışlar',  true), money(raw.satis_yurt_ici,  '374151'), pctCell('')],                          // r5
      [label('Yurt Dışı Satışlar', true), money(raw.satis_yurt_disi, '374151'), pctCell('')],                          // r6
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
    if (view === 'rapor' && rowCalcs.length > 0) {
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

    XLSX.writeFile(wb, `KarZarar_${firma.ad}_${view === 'rapor' ? `${rangeStart}_${rangeEnd}` : donem}.xlsx`)
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

    const c   = view === 'rapor' ? cumCalc : calc
    const raw = view === 'rapor' ? cumRaw  : calcRaw
    const per = view === 'rapor' ? `${ayLabel(rangeStart)} — ${ayLabel(rangeEnd)}` : ayLabel(donem)
    const color = (v: number, pos = '#16a34a', neg = '#dc2626') => v >= 0 ? pos : neg

    // Her bölüm: [başlık?, girintili?, etiket, tutar, marj, kalın?, renk]
    type KZRow = { section?: string; sectionColor?: string; label: string; value: string; marj?: string; bold?: boolean; color?: string; indent?: boolean; highlight?: string }
    const kzRows: KZRow[] = [
      // Satışlar
      { section: 'SATIŞLAR', sectionColor: '#15803d', label: '', value: '' },
      { label: 'Yurt İçi Satışlar',  value: fmt(raw.satis_yurt_ici),  indent: true },
      { label: 'Yurt Dışı Satışlar', value: fmt(raw.satis_yurt_disi), indent: true },
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
    if (view === 'rapor' && rowCalcs.length > 0) {
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

    doc.save(`KarZarar_${firma.ad}_${view === 'rapor' ? `${rangeStart}_${rangeEnd}` : donem}.pdf`)
    } catch (err) {
      console.error('PDF oluşturma hatası:', err)
    }
  }

  // Aylık hesap (form'dan)
  const calc = useMemo(() => calcRow({
    firma_id: firma.id, donem, notlar: null,
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

  // ── K/Z Tablosu (tek dönem veya kümülatif için ortak) ─────────────────────
  const KZTablo = ({ c, baslik, subtitle, raw }: { c: ReturnType<typeof calcRow>; baslik: string; subtitle?: string; raw?: KZRaw }) => (
    <div className="rounded-2xl border border-[rgba(60,60,67,0.36)] overflow-hidden" style={{ background: '#1C1C1E' }}>
      <div className="px-4 py-3 border-b border-[rgba(60,60,67,0.36)]" style={{ background: 'rgba(10,132,255,0.1)' }}>
        <p className="text-xs font-bold uppercase tracking-widest text-[#0A84FF]">{baslik}</p>
        {subtitle && <p className="text-sm font-semibold text-white mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-4 md:px-5 py-4 space-y-1">

        {/* Satışlar */}
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#30D158' }}>Satışlar</p>
        {raw && <>
          <PRow label="Yurt İçi Satışlar"  value={raw.satis_yurt_ici}  indent color="rgba(235,235,245,0.7)" />
          <PRow label="Yurt Dışı Satışlar" value={raw.satis_yurt_disi} indent color="rgba(235,235,245,0.7)" />
          {raw.satis_iade > 0 && <PRow label="Satış İadeleri (−)" value={raw.satis_iade} indent color="#FF453A" />}
        </>}
        <PRow label="NET SATIŞLAR" value={c.netSatis} bold separator
          sub={c.netSatis > 0 ? '100%' : undefined} color={c.netSatis >= 0 ? '#0A84FF' : '#FF453A'} />

        {/* Stok Bilgileri */}
        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#0A84FF' }}>Stok Bilgileri</p>
          {raw && <>
            <PRow label="Dönem Başı Stok" value={raw.donem_basi_stok} indent color="rgba(235,235,245,0.7)" />
            <PRow label="Dönem Sonu Stok" value={raw.donem_sonu_stok} indent color="rgba(235,235,245,0.7)" />
          </>}
        </div>

        {/* Alışlar & Maliyetler */}
        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#FF9F0A' }}>Alışlar & Maliyetler</p>
          {raw && <>
            <PRow label="%1 Alışlar"  value={raw.alis_malzeme}  indent color="rgba(235,235,245,0.7)" />
            <PRow label="%10 Alışlar" value={raw.alis_efatura}  indent color="rgba(235,235,245,0.7)" />
            <PRow label="%20 Alışlar"  value={raw.alis_arsiv}    indent color="rgba(235,235,245,0.7)" />
            <PRow label="İşçilik Giderleri" value={raw.alis_iscilik}  indent color="rgba(235,235,245,0.7)" />
          </>}
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
            <p className="text-lg md:text-2xl font-bold tabular-nums whitespace-nowrap" style={{ color: c.brutKar >= 0 ? '#30D158' : '#FF453A' }}>
              ₺{fmt(Math.abs(c.brutKar))}
            </p>
          </div>
        </div>

        {/* Genel Yönetim Giderleri */}
        <div className="pt-1">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#BF5AF2' }}>Genel Yönetim Giderleri</p>
          {raw && (
            <>
              <PRow label="Kira Giderleri"     value={raw.gider_kira}       indent color="rgba(235,235,245,0.7)" />
              <PRow label="Sigorta Giderleri"  value={raw.gider_fatura}     indent color="rgba(235,235,245,0.7)" />
              <PRow label="Amortisman"         value={raw.gider_amortisman} indent color="rgba(235,235,245,0.7)" />
              <PRow label="Diğer Giderler"     value={raw.gider_diger}      indent color="rgba(235,235,245,0.7)" />
              <PRow label="Finansal Giderler"  value={raw.gider_finansal}   indent color="rgba(235,235,245,0.7)" />
            </>
          )}
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
            <p className="text-xl md:text-3xl font-bold tabular-nums whitespace-nowrap" style={{ color: c.faaliyetKari >= 0 ? '#0A84FF' : '#FF453A' }}>
              {c.faaliyetKari < 0 ? '-' : '+'}₺{fmt(Math.abs(c.faaliyetKari))}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Aylık veri girişi formu ────────────────────────────────────────────────
  const GirişFormu = () => (
    <div className="rounded-2xl border border-[rgba(60,60,67,0.36)] overflow-hidden" style={{ background: '#1C1C1E' }}>
      {/* Satışlar */}
      <SectionHeader title="Satışlar" color="#30D158" />
      <div className="py-1.5 space-y-0.5">
        <NumRow label="Yurt İçi Satışlar"  value={form.satis_yurt_ici}  onChange={set('satis_yurt_ici')}  section="Satışlar" sectionColor="#30D158" />
        <NumRow label="Yurt Dışı Satışlar" value={form.satis_yurt_disi} onChange={set('satis_yurt_disi')} section="Satışlar" sectionColor="#30D158" />
        <NumRow label="Satış İadeleri (−)" value={form.satis_iade}      onChange={set('satis_iade')}       section="Satışlar" sectionColor="#30D158" minus />
      </div>
      {/* Stok Bilgileri */}
      <SectionHeader title="Stok Bilgileri" color="#0A84FF" />
      <div className="py-1.5 space-y-0.5">
        <NumRow label="Dönem Başı Stok" value={form.donem_basi_stok} onChange={set('donem_basi_stok')} section="Stok" sectionColor="#0A84FF" />
        <NumRow label="Dönem Sonu Stok" value={form.donem_sonu_stok} onChange={set('donem_sonu_stok')} section="Stok" sectionColor="#0A84FF" />
      </div>
      {/* Alışlar & Maliyetler */}
      <SectionHeader title="Alışlar & Maliyetler" color="#FF9F0A" />
      <div className="py-1.5 space-y-0.5">
        <NumRow label="%1 Alışlar"   value={form.alis_malzeme}  onChange={set('alis_malzeme')}  section="Alışlar" sectionColor="#FF9F0A" />
        <NumRow label="%10 Alışlar"  value={form.alis_efatura}  onChange={set('alis_efatura')}  section="Alışlar" sectionColor="#FF9F0A" />
        <NumRow label="%20 Alışlar"  value={form.alis_arsiv}    onChange={set('alis_arsiv')}    section="Alışlar" sectionColor="#FF9F0A" />
        <NumRow label="İşçilik Giderleri" value={form.alis_iscilik}  onChange={set('alis_iscilik')}  section="Alışlar" sectionColor="#FF9F0A" />
      </div>
      {/* Genel Yönetim Giderleri */}
      <SectionHeader title="Genel Yönetim Giderleri" color="#BF5AF2" />
      <div className="py-1.5 space-y-0.5">
        <NumRow label="Kira Giderleri"     value={form.gider_kira}       onChange={set('gider_kira')}       section="GYG" sectionColor="#BF5AF2" />
        <NumRow label="Sigorta Giderleri"  value={form.gider_fatura}     onChange={set('gider_fatura')}     section="GYG" sectionColor="#BF5AF2" />
        <NumRow label="Amortisman"         value={form.gider_amortisman} onChange={set('gider_amortisman')} section="GYG" sectionColor="#BF5AF2" />
        <NumRow label="Diğer Giderler"     value={form.gider_diger}      onChange={set('gider_diger')}      section="GYG" sectionColor="#BF5AF2" />
        <NumRow label="Finansal Giderler"  value={form.gider_finansal}   onChange={set('gider_finansal')}   section="GYG" sectionColor="#BF5AF2" />
      </div>
      {/* Notlar */}
      <div className="px-4 py-3 border-t border-[rgba(60,60,67,0.25)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(235,235,245,0.3)] mb-1.5">Notlar</p>
        <textarea className={`${cls.input} resize-none w-full`} rows={2}
          placeholder="Dönem notları..." value={form.notlar} onChange={set('notlar')} />
      </div>
    </div>
  )

  return (
    <div className="w-full max-w-none flex flex-col gap-0 -mt-3 md:-mt-5 md:-mx-4 xl:-mx-6 2xl:-mx-8">

      {/* ── Üst Bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 md:px-5 xl:px-6 py-4 border-b border-[rgba(60,60,67,0.36)] flex-wrap shrink-0"
        style={{ background: 'rgba(28,28,30,0.95)' }}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white flex-1 uppercase">Kar / Zarar</h1>

        {/* Müşteri Filtresi */}
        <select
          value={selectedMusteri}
          onChange={e => setSelectedMusteri(e.target.value)}
          className="bg-[#2C2C2E] border border-[rgba(60,60,67,0.5)] text-white text-xs rounded-[10px] px-3 py-2 outline-none focus:border-[#0A84FF] min-w-[160px]"
        >
          {musteriler.map(m => (
            <option key={m.id} value={m.id}>{m.kisa_ad || m.ad}</option>
          ))}
        </select>

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
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          AYLIK GİRİŞ GÖRÜNÜMÜ
      ════════════════════════════════════════════════════════════════════════ */}
      {view === 'aylik' && (
        <>
          {/* Dönem Seçici */}
          <div className="flex items-center gap-4 px-4 md:px-5 xl:px-6 py-3 border-b border-[rgba(60,60,67,0.2)] flex-wrap"
            style={{ background: '#1C1C1E' }}>
            <ViewToggle view={view} setView={setView} />
            <div className="flex-1 flex items-center justify-center gap-3 flex-wrap">
              <button onClick={() => setDonem(prevMonth(donem))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[rgba(235,235,245,0.5)] hover:text-white hover:bg-[rgba(60,60,67,0.5)] transition-all">
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center justify-center gap-2">
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
                {selectedMusteri && (
                  <span className="text-[10px] font-semibold text-[#0A84FF] bg-[rgba(10,132,255,0.12)] px-2 py-0.5 rounded-full border border-[rgba(10,132,255,0.2)]">
                    {musteriler.find(m => m.id === selectedMusteri)?.kisa_ad || musteriler.find(m => m.id === selectedMusteri)?.ad}
                  </span>
                )}
              </div>
              <button onClick={() => setDonem(nextMonth(donem))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[rgba(235,235,245,0.5)] hover:text-white hover:bg-[rgba(60,60,67,0.5)] transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Mobil sekme */}
          <div className="flex xl:hidden border-b border-[rgba(60,60,67,0.36)] shrink-0" style={{ background: '#1C1C1E' }}>
            {(['giris', 'tablo'] as const).map(t => (
              <button key={t} onClick={() => setMobileTab(t as typeof mobileTab)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${mobileTab === t ? 'text-[#0A84FF] border-b-2 border-[#0A84FF]' : 'text-[rgba(235,235,245,0.4)]'}`}>
                {t === 'giris' ? <><Calculator size={13} /> Veri Girişi</> : <><BarChart2 size={13} /> K/Z Tablosu</>}
              </button>
            ))}
          </div>

          {error && saving && (
            <div className="mx-4 mt-3 px-4 py-3 rounded-xl text-xs text-[#FF453A] border border-[rgba(255,69,58,0.3)]"
              style={{ background: 'rgba(255,69,58,0.1)' }}>{error}</div>
          )}

          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.2fr)_minmax(460px,0.8fr)] gap-5 p-4 lg:p-5 items-start" style={{ background: '#000000' }}>
            <div className={mobileTab === 'giris' ? 'block' : 'hidden 2xl:block'}>{GirişFormu()}</div>
            <div className={`${mobileTab === 'tablo' ? 'block' : 'hidden 2xl:block'} 2xl:sticky 2xl:top-4`}>
              {KZTablo({ c: calc, baslik: 'Kar / Zarar Tablosu', subtitle: ayLabel(donem), raw: calcRaw })}
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
          <div className="flex items-center gap-4 px-4 md:px-5 xl:px-6 py-3 border-b border-[rgba(60,60,67,0.2)] flex-wrap"
            style={{ background: '#1C1C1E' }}>
            <ViewToggle view={view} setView={setView} />
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <Filter size={14} className="text-[#0A84FF] shrink-0" />
              <span className="text-xs text-[rgba(235,235,245,0.5)] shrink-0">Başlangıç</span>
              <input type="month" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                className="bg-[#2C2C2E] border border-[rgba(60,60,67,0.5)] text-white text-xs rounded-[10px] px-3 py-2 outline-none focus:border-[#0A84FF]" />
              <span className="text-xs text-[rgba(235,235,245,0.3)] shrink-0">→</span>
              <span className="text-xs text-[rgba(235,235,245,0.5)] shrink-0">Bitiş</span>
              <input type="month" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                className="bg-[#2C2C2E] border border-[rgba(60,60,67,0.5)] text-white text-xs rounded-[10px] px-3 py-2 outline-none focus:border-[#0A84FF]" />
              <span className="text-[10px] text-[rgba(235,235,245,0.3)] ml-auto">
                {rangeRows.length} dönem kayıtlı
              </span>
            </div>
          </div>

          {rangeLoading ? <Loading /> : (
            <div className="w-full px-4 md:px-5 xl:px-6 2xl:px-8 py-4 space-y-5" style={{ background: '#000000' }}>

              {/* Özet Kartlar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 xl:gap-4 w-full">
                {[
                  { label: 'Toplam Net Satış', value: cumCalc.netSatis, prevValue: prevCumCalc.netSatis, color: '#0A84FF', icon: TrendingUp },
                  { label: 'Toplam Brüt Kar',  value: cumCalc.brutKar,  prevValue: prevCumCalc.brutKar, color: '#30D158', icon: TrendingUp },
                  { label: 'Toplam Net Kar',   value: cumCalc.netKar,   prevValue: prevCumCalc.netKar, color: cumCalc.netKar >= 0 ? '#30D158' : '#FF453A', icon: cumCalc.netKar >= 0 ? TrendingUp : TrendingDown },
                ].map(({ label, value, prevValue, color, icon: Icon }) => {
                  const change = calculateChange(value, prevValue);
                  return (
                    <div key={label} className="rounded-2xl p-4 md:p-5 flex flex-col gap-2 min-w-0"
                      style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} style={{ color }} />
                        <span className="text-[10px] font-semibold text-[rgba(235,235,245,0.5)] truncate">{label}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <p className="text-xl md:text-2xl font-bold leading-none tabular-nums break-all" style={{ color }}>
                          {value < 0 ? '-' : ''}₺{fmt(Math.abs(value))}
                        </p>
                        {prevRangeRows.length > 0 && (
                          <span className="text-xs font-bold" style={{ color: change.color }}>{change.value}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[rgba(235,235,245,0.3)] mt-auto pt-1">{ayKisa(rangeStart)} — {ayKisa(rangeEnd)}</p>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-5 w-full">

                {/* Aylık Detay Tablosu */}
                <div className="rounded-2xl border border-[rgba(60,60,67,0.36)] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.22)]" style={{ background: '#1C1C1E' }}>
                  <div className="px-4 py-3 border-b border-[rgba(60,60,67,0.3)]" style={{ background: 'rgba(94,92,230,0.12)', borderLeft: '3px solid #5E5CE6' }}>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#5E5CE6]">Aylık Dağılım</p>
                    <p className="text-[10px] text-[rgba(235,235,245,0.4)] mt-0.5">{ayKisa(rangeStart)} – {ayKisa(rangeEnd)}</p>
                  </div>

                  {rowCalcs.length < 2 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-xs text-[rgba(235,235,245,0.3)]">Grafik için en az 2 dönemlik veri gereklidir.</p>
                    </div>
                  ) : (
                    <>
                      {/* Aylık Dağılım Grafiği */}
                      <div className="p-4 md:p-5 h-[320px] xl:h-[360px] border-b border-[rgba(60,60,67,0.3)]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={rowCalcs} margin={{ top: 12, right: 30, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis dataKey="donem" tickFormatter={ayKisa} tick={{ fontSize: 11, fill: 'rgba(235,235,245,0.72)' }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} />
                            <YAxis width={72} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'rgba(235,235,245,0.72)' }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                background: '#1C1C1E',
                                border: '1px solid rgba(60,60,67,0.36)',
                                borderRadius: '10px',
                                color: '#fff',
                                fontSize: '13px'
                              }}
                              labelFormatter={(label) => {
                                if (typeof label === 'string' && /^\d{4}-\d{2}$/.test(label)) {
                                  return ayLabel(label);
                                }
                                return label;
                              }}
                              formatter={(value) => [`₺${fmt(Number(value ?? 0))}`, '']}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#fff', paddingTop: '10px' }} />
                            <Bar dataKey="netSatis" name="Net Satış" fill="#0A84FF" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="smm" name="Satılan Mal Maliyeti" fill="#FF9F0A" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="faaliyetKari" name="Faaliyet Karı" fill="#30D158" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="overflow-x-auto bg-[#161618] [scrollbar-width:thin]">
                        <table className="text-sm table-fixed" style={{ minWidth: '1640px', width: '100%' }}>
                          <thead>
                            <tr className="border-b border-[rgba(60,60,67,0.3)]">
                              <th className="w-[140px] px-5 py-3.5 text-left font-semibold text-[rgba(235,235,245,0.72)] text-[11px] uppercase tracking-wider whitespace-nowrap sticky left-0 z-10" style={{ background: '#1C1C1E' }}>Dönem</th>
                              <th className="w-[140px] px-5 py-3.5 text-right font-semibold text-[rgba(235,235,245,0.72)] text-[11px] uppercase tracking-wider whitespace-nowrap">Net Satış</th>
                              <th className="w-[130px] px-4 py-3.5 text-right font-semibold text-[#FFB340] text-[11px] uppercase tracking-wider whitespace-nowrap border-l border-[rgba(255,159,10,0.2)]">%1 Alış</th>
                              <th className="w-[130px] px-4 py-3.5 text-right font-semibold text-[#FFB340] text-[11px] uppercase tracking-wider whitespace-nowrap">%10 Alış</th>
                              <th className="w-[130px] px-4 py-3.5 text-right font-semibold text-[#FFB340] text-[11px] uppercase tracking-wider whitespace-nowrap">%20 Alış</th>
                              <th className="w-[130px] px-4 py-3.5 text-right font-semibold text-[#FFB340] text-[11px] uppercase tracking-wider whitespace-nowrap">İşçilik</th>
                              <th className="w-[145px] px-5 py-3.5 text-right font-semibold text-[rgba(235,235,245,0.72)] text-[11px] uppercase tracking-wider whitespace-nowrap border-l border-[rgba(60,60,67,0.3)]">Toplam Alış</th>
                              <th className="w-[145px] px-5 py-3.5 text-right font-semibold text-[rgba(235,235,245,0.72)] text-[11px] uppercase tracking-wider whitespace-nowrap">Brüt Kar</th>
                              <th className="w-[145px] px-4 py-3.5 text-right font-semibold text-[#D8A5FF] text-[11px] uppercase tracking-wider whitespace-nowrap border-l border-[rgba(191,90,242,0.2)]">Toplam GYG</th>
                              <th className="w-[150px] px-5 py-3.5 text-right font-semibold text-[rgba(235,235,245,0.72)] text-[11px] uppercase tracking-wider whitespace-nowrap border-l border-[rgba(60,60,67,0.3)]">Faaliyet Karı</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rowCalcs.map((r, i) => {
                              const bg = i % 2 === 0 ? '#1C1C1E' : 'rgba(44,44,46,0.9)'
                              return (
                                <tr key={r.donem}
                                  className={`border-b border-[rgba(60,60,67,0.15)] hover:bg-[rgba(255,255,255,0.03)] transition-colors ${i % 2 === 0 ? '' : 'bg-[rgba(60,60,67,0.08)]'}`}>
                                  <td className="px-5 py-3.5 font-semibold text-white whitespace-nowrap sticky left-0 z-10" style={{ background: bg }}>{ayKisa(r.donem)}</td>
                                  <td className="px-5 py-3.5 text-right tabular-nums text-white font-semibold whitespace-nowrap text-[15px]">₺{fmt(r.netSatis)}</td>
                                  <td className="px-4 py-3.5 text-right tabular-nums text-[rgba(255,255,255,0.88)] whitespace-nowrap text-[14px] border-l border-[rgba(255,159,10,0.15)]">₺{fmt(r.alis_malzeme)}</td>
                                  <td className="px-4 py-3.5 text-right tabular-nums text-[rgba(255,255,255,0.88)] whitespace-nowrap text-[14px]">₺{fmt(r.alis_efatura)}</td>
                                  <td className="px-4 py-3.5 text-right tabular-nums text-[rgba(255,255,255,0.88)] whitespace-nowrap text-[14px]">₺{fmt(r.alis_arsiv)}</td>
                                  <td className="px-4 py-3.5 text-right tabular-nums text-[rgba(255,255,255,0.88)] whitespace-nowrap text-[14px]">₺{fmt(r.alis_iscilik)}</td>
                                  <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-[#FFB340] whitespace-nowrap text-[15px] border-l border-[rgba(60,60,67,0.3)]">₺{fmt(r.toplamAlis)}</td>
                                  <td className="px-5 py-3.5 text-right tabular-nums font-semibold whitespace-nowrap text-[15px]" style={{ color: r.brutKar >= 0 ? '#30D158' : '#FF453A' }}>
                                    {r.brutKar < 0 ? '-' : ''}₺{fmt(Math.abs(r.brutKar))}
                                  </td>
                                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold whitespace-nowrap text-[#BF5AF2] text-[15px] border-l border-[rgba(191,90,242,0.15)]">₺{fmt(r.toplamGyg)}</td>
                                  <td className="px-5 py-3.5 text-right tabular-nums font-bold whitespace-nowrap text-[16px] border-l border-[rgba(60,60,67,0.3)]" style={{ color: r.faaliyetKari >= 0 ? '#30D158' : '#FF453A' }}>
                                    {r.faaliyetKari < 0 ? '-' : '+'}₺{fmt(Math.abs(r.faaliyetKari))}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-[rgba(60,60,67,0.5)] bg-[rgba(10,132,255,0.06)]">
                              <td className="px-5 py-4 font-bold text-white text-sm sticky left-0 z-10" style={{ background: 'rgba(10,132,255,0.06)' }}>TOPLAM</td>
                              <td className="px-5 py-4 text-right tabular-nums font-bold text-white text-[16px] whitespace-nowrap">₺{fmt(cumCalc.netSatis)}</td>
                              <td className="px-4 py-4 text-right tabular-nums font-bold text-[#FFB340] text-[16px] whitespace-nowrap border-l border-[rgba(255,159,10,0.15)]">₺{fmt(cumAlis.malzeme)}</td>
                              <td className="px-4 py-4 text-right tabular-nums font-bold text-[#FFB340] text-[16px] whitespace-nowrap">₺{fmt(cumAlis.efatura)}</td>
                              <td className="px-4 py-4 text-right tabular-nums font-bold text-[#FFB340] text-[16px] whitespace-nowrap">₺{fmt(cumAlis.arsiv)}</td>
                              <td className="px-4 py-4 text-right tabular-nums font-bold text-[#FFB340] text-[16px] whitespace-nowrap">₺{fmt(cumAlis.iscilik)}</td>
                              <td className="px-5 py-4 text-right tabular-nums font-bold text-[#FFB340] text-[16px] whitespace-nowrap border-l border-[rgba(60,60,67,0.3)]">₺{fmt(cumCalc.toplamAlis)}</td>
                              <td className="px-5 py-4 text-right tabular-nums font-bold text-[16px]" style={{ color: cumCalc.brutKar >= 0 ? '#30D158' : '#FF453A' }}>
                                {cumCalc.brutKar < 0 ? '-' : ''}₺{fmt(Math.abs(cumCalc.brutKar))}
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums font-bold text-[#BF5AF2] text-[16px] border-l border-[rgba(191,90,242,0.15)]">₺{fmt(cumCalc.toplamGyg)}</td>
                              <td className="px-5 py-4 text-right tabular-nums font-bold border-l text-[17px] whitespace-nowrap border-[rgba(60,60,67,0.3)]" style={{ color: cumCalc.faaliyetKari >= 0 ? '#30D158' : '#FF453A' }}>
                                {cumCalc.faaliyetKari < 0 ? '-' : '+'}₺{fmt(Math.abs(cumCalc.faaliyetKari))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* Kümülatif K/Z Tablosu */}
                {KZTablo({
                  c: cumCalc,
                  baslik: 'Kümülatif Kar / Zarar',
                  subtitle: `${ayLabel(rangeStart)} — ${ayLabel(rangeEnd)}`,
                  raw: cumRaw,
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
