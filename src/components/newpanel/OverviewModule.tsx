'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Banknote, FolderOpen, CheckSquare, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

// ── Tipler ──────────────────────────────────────────────────────────────────

interface TaskRecord { id: string; durum: string }
interface TaxRecord { id: string; proje_id: string | null; surec_turu: string; son_tarih: string; durum: string; tutar: number }
interface CariHareketRow {
  id: string; cari_hesap_id: string; hareket_turu: string
  tutar: number; tarih: string; vade_tarihi: string | null
  cek_no: string | null; cek_banka: string | null; durum: string
  cariAd: string
}
interface Props { firma: FirmaRecord }

// ── Yardımcı ────────────────────────────────────────────────────────────────

function money(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
}

const AY_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const TAX_LABELS: Record<string, string> = { kdv: 'KDV', muhtasar_sgk: 'Muhtasar/SGK', gecici_vergi: 'Geçici Vergi', kurumlar_vergisi: 'Kurumlar V.', edefter: 'e-Defter' }

// ── Pasta Grafik (SVG Donut) ─────────────────────────────────────────────────

function DonutChart({ segments, size = 80, strokeWidth = 14 }: {
  segments: { value: number; color: string; label: string }[]
  size?: number
  strokeWidth?: number
}) {
  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0)

  if (total === 0) {
    return (
      <svg width={size} height={size} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.2)" fontSize="7">Veri yok</text>
      </svg>
    )
  }

  let cumulative = 0
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const length = (seg.value / total) * circumference
        const dasharray = `${length} ${circumference - length}`
        const dashoffset = -cumulative
        cumulative += length
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={dasharray} strokeDashoffset={dashoffset}
          />
        )
      })}
    </svg>
  )
}

function DonutLegend({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  return (
    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
          <span className="text-[9px] text-slate-400 truncate flex-1">{seg.label}</span>
          <span className="text-[9px] font-semibold text-slate-200 shrink-0">
            {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Maliyet Kartı (ETM veya BİNYAPI) ─────────────────────────────────────────

type FilterTuru = 'tum_zamanlar' | 'donemlik' | 'kumulatif'

function MaliyetKarti({ sirketAd, renk, harf, incomeRecords, expenseRecords }: {
  sirketAd: string; renk: 'blue' | 'indigo'; harf: string
  incomeRecords: any[]; expenseRecords: any[]
}) {
  const [tur, setTur] = useState<FilterTuru>('tum_zamanlar')
  const [yil, setYil] = useState(new Date().getFullYear())
  const [ay, setAy] = useState(new Date().getMonth() + 1)
  const [dbm, setDbm] = useState<number | ''>('')

  const border = renk === 'blue' ? 'border-blue-500/20 bg-blue-500/[0.02]' : 'border-indigo-500/20 bg-indigo-500/[0.02]'
  const accent = renk === 'blue' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30' : 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30'

  const ozet = useMemo(() => {
    let inc = [...incomeRecords]
    let exp = [...expenseRecords]
    if (tur === 'donemlik') {
      const prefix = `${yil}-${String(ay).padStart(2, '0')}`
      inc = inc.filter(r => r.tarih?.startsWith(prefix))
      exp = exp.filter(r => r.tarih?.startsWith(prefix))
    } else if (tur === 'kumulatif') {
      const start = `${yil}-01`
      const end = `${yil}-${String(ay).padStart(2, '0')}`
      inc = inc.filter(r => { const m = r.tarih?.substring(0, 7); return m >= start && m <= end })
      exp = exp.filter(r => { const m = r.tarih?.substring(0, 7); return m >= start && m <= end })
    }
    const dbmVal = tur !== 'donemlik' ? (Number(dbm) || 0) : 0
    const gelir = inc.reduce((s, r) => s + Number(r.tutar || 0), 0)
    const gider = exp.reduce((s, r) => s + Number(r.tutar || 0), 0) + dbmVal
    return { gelir, gider, net: gelir - gider }
  }, [incomeRecords, expenseRecords, tur, yil, ay, dbm])

  const donutSegs = [
    { value: ozet.gelir, color: '#34d399', label: 'Gelir' },
    { value: ozet.gider, color: '#f87171', label: 'Gider' },
  ]

  return (
    <section className={`flex flex-col rounded-2xl border ${border} p-4 gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold ${accent}`}>{harf}</div>
          <h3 className="text-sm font-bold text-white">{sirketAd}</h3>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] px-2 py-1 rounded-lg border border-white/5 flex-wrap">
          <select className="bg-transparent text-[9px] text-slate-300 outline-none cursor-pointer" value={tur} onChange={e => setTur(e.target.value as FilterTuru)}>
            <option value="tum_zamanlar" className="bg-slate-900">Genel</option>
            <option value="kumulatif" className="bg-slate-900">Küm.</option>
            <option value="donemlik" className="bg-slate-900">Aylık</option>
          </select>
          {tur !== 'tum_zamanlar' && (<>
            <div className="w-px h-3 bg-white/10" />
            <select className="bg-transparent text-[9px] text-slate-300 outline-none cursor-pointer" value={yil} onChange={e => setYil(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
            </select>
            <div className="w-px h-3 bg-white/10" />
            <select className="bg-transparent text-[9px] text-slate-300 outline-none cursor-pointer" value={ay} onChange={e => setAy(Number(e.target.value))}>
              {AY_LABELS.map((a, i) => <option key={i + 1} value={i + 1} className="bg-slate-900">{a}</option>)}
            </select>
          </>)}
          {tur !== 'donemlik' && (<>
            <div className="w-px h-3 bg-white/10" />
            <input type="number" className="w-12 bg-transparent text-[9px] text-slate-300 outline-none placeholder:text-slate-600" value={dbm} onChange={e => setDbm(e.target.value === '' ? '' : Number(e.target.value))} placeholder="DBM" />
          </>)}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <DonutChart segments={donutSegs} size={78} strokeWidth={14} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-[8px] font-bold ${ozet.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>NET</span>
            <span className={`text-[8px] font-bold ${ozet.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`} style={{ fontSize: '7px' }}>
              {ozet.net >= 0 ? '▲' : '▼'}
            </span>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-1.5 min-w-0">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2 text-center">
            <p className="text-[8px] uppercase tracking-wider text-emerald-400 font-semibold">Gelir</p>
            <p className="mt-0.5 text-[10px] font-bold text-emerald-300 truncate">{money(ozet.gelir)}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2 text-center">
            <p className="text-[8px] uppercase tracking-wider text-rose-400 font-semibold">Gider</p>
            <p className="mt-0.5 text-[10px] font-bold text-rose-300 truncate">{money(ozet.gider)}</p>
          </div>
          <div className={`rounded-xl border p-2 text-center ${ozet.net >= 0 ? 'border-sky-500/20 bg-sky-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
            <p className={`text-[8px] uppercase tracking-wider font-semibold ${ozet.net >= 0 ? 'text-sky-400' : 'text-amber-400'}`}>Net</p>
            <p className={`mt-0.5 text-[10px] font-bold truncate ${ozet.net >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>{money(ozet.net)}</p>
          </div>
        </div>

        <DonutLegend segments={donutSegs} />
      </div>
    </section>
  )
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function OverviewModule({ firma }: Props) {
  const [projects, setProjects] = useState<(ProjectRecord & { durum?: string })[]>([])
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [taxes, setTaxes] = useState<TaxRecord[]>([])
  const [incomeRecords, setIncomeRecords] = useState<any[]>([])
  const [expenseRecords, setExpenseRecords] = useState<any[]>([])
  const [nakitRows, setNakitRows] = useState<CariHareketRow[]>([])
  const [cekRows, setCekRows] = useState<CariHareketRow[]>([])
  const [modal, setModal] = useState<'nakit' | 'cek' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    const [projectsRes, tasksRes, taxesRes, incomeRes, expenseRes, cariHesaplarRes, cariHareketlerRes] = await Promise.all([
      supabase.from('projeler').select('id, ad, durum').eq('firma_id', firma.id),
      supabase.from('gorevler').select('id, durum').eq('firma_id', firma.id),
      supabase.from('vergi_surecleri').select('id, proje_id, surec_turu, son_tarih, durum, tutar').eq('firma_id', firma.id).order('son_tarih', { ascending: true }),
      supabase.from('gelir_kayitlari').select('tarih, tutar, sirket').eq('firma_id', firma.id),
      supabase.from('gider_kayitlari').select('tarih, tutar, sirket').eq('firma_id', firma.id),
      supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id),
      supabase.from('cari_hareketler').select('*').eq('firma_id', firma.id),
    ])

    if (incomeRes.error || expenseRes.error) setError('Bazı finans verileri yüklenemedi.')

    // cari_hesaplar: DB column is "Reklam" (case-sensitive)
    const hesapMap = new Map((cariHesaplarRes.data || []).map((c: any) => [c.id, c]))
    const getSirket = (h: any) => (hesapMap.get(h.cari_hesap_id) as any)?.sirket || 'ETM'

    const allCari: CariHareketRow[] = (cariHareketlerRes.data || []).map((h: any) => ({
      ...h,
      cariAd: (hesapMap.get(h.cari_hesap_id) as any)?.Reklam || '—',
    }))

    const cariIncomes = allCari.filter(r => ['satis_fatura', 'diger_alacak'].includes(r.hareket_turu))
      .map(r => ({ tarih: r.tarih, tutar: r.tutar, sirket: getSirket(r) }))
    const cariExpenses = allCari.filter(r => ['alis_fatura', 'diger_borc'].includes(r.hareket_turu))
      .map(r => ({ tarih: r.tarih, tutar: r.tutar, sirket: getSirket(r) }))

    setProjects((projectsRes.data as any[]) || [])
    setTasks((tasksRes.data as TaskRecord[]) || [])
    setTaxes((taxesRes.data as TaxRecord[]) || [])
    setIncomeRecords([...(incomeRes.data as any[] || []), ...cariIncomes])
    setExpenseRecords([...(expenseRes.data as any[] || []), ...cariExpenses])
    setNakitRows(allCari.filter(h => ['odeme_nakit', 'tahsilat_nakit'].includes(h.hareket_turu))
      .sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')))
    setCekRows(allCari.filter(h => ['odeme_cek', 'tahsilat_cek'].includes(h.hareket_turu))
      .sort((a, b) => (a.vade_tarihi || '').localeCompare(b.vade_tarihi || '')))
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetchData() }, [fetchData])

  // Firma bazlı gelir/gider
  const etmInc = useMemo(() => incomeRecords.filter(r => r.sirket !== 'BİNYAPI'), [incomeRecords])
  const etmExp = useMemo(() => expenseRecords.filter(r => r.sirket !== 'BİNYAPI'), [expenseRecords])
  const binInc = useMemo(() => incomeRecords.filter(r => r.sirket === 'BİNYAPI'), [incomeRecords])
  const binExp = useMemo(() => expenseRecords.filter(r => r.sirket === 'BİNYAPI'), [expenseRecords])

  // Proje durumu pasta
  const projeDonut = useMemo(() => {
    const counts: Record<string, number> = {}
    projects.forEach(p => { const d = p.durum || 'belirsiz'; counts[d] = (counts[d] || 0) + 1 })
    const colorMap: Record<string, string> = { devam_ediyor: '#60a5fa', tamamlandi: '#34d399', planlama: '#a78bfa', beklemede: '#fbbf24', iptal: '#f87171', belirsiz: '#64748b' }
    const labelMap: Record<string, string> = { devam_ediyor: 'Devam Ediyor', tamamlandi: 'Tamamlanan', planlama: 'Planlama', beklemede: 'Bekleyen', iptal: 'İptal', belirsiz: 'Belirsiz' }
    return Object.entries(counts).map(([k, v]) => ({ value: v, color: colorMap[k] || '#64748b', label: `${labelMap[k] || k} (${v})` }))
  }, [projects])

  // Görev durumu pasta
  const gorevDonut = useMemo(() => {
    const counts: Record<string, number> = {}
    tasks.forEach(t => { const d = t.durum || 'belirsiz'; counts[d] = (counts[d] || 0) + 1 })
    const colorMap: Record<string, string> = { tamamlandi: '#34d399', devam_ediyor: '#60a5fa', beklemede: '#fbbf24', iptal: '#f87171', belirsiz: '#64748b' }
    const labelMap: Record<string, string> = { tamamlandi: 'Tamamlanan', devam_ediyor: 'Devam Ediyor', beklemede: 'Bekleyen', iptal: 'İptal', belirsiz: 'Belirsiz' }
    return Object.entries(counts).map(([k, v]) => ({ value: v, color: colorMap[k] || '#64748b', label: `${labelMap[k] || k} (${v})` }))
  }, [tasks])

  const nakitToplam = nakitRows.reduce((s, r) => s + Number(r.tutar || 0), 0)
  const cekToplam = cekRows.reduce((s, r) => s + Number(r.tutar || 0), 0)
  const cekBekleyen = cekRows.filter(r => r.durum === 'beklemede').length
  const upcomingTaxes = useMemo(() => taxes.filter(t => t.durum !== 'tamamlandi').slice(0, 5), [taxes])

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">{error}</p>}

      {/* Satır 1: Maliyet Takibi */}
      <div className="grid gap-3 xl:grid-cols-2">
        <MaliyetKarti sirketAd="ETM A.Ş." renk="blue" harf="E" incomeRecords={etmInc} expenseRecords={etmExp} />
        <MaliyetKarti sirketAd="BİNYAPI" renk="indigo" harf="B" incomeRecords={binInc} expenseRecords={binExp} />
      </div>

      {/* Satır 2: Proje | Cari Hesap | Görev + Vergi */}
      <div className="grid gap-3 lg:grid-cols-3">

        {/* Proje Durumu */}
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={14} className="text-blue-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">Proje Durumu</h3>
            <span className="ml-auto text-[10px] text-slate-500">{projects.length} proje</span>
          </div>
          {loading
            ? <p className="text-xs text-slate-500">Yükleniyor...</p>
            : projeDonut.length === 0
              ? <p className="text-xs text-slate-500 py-4 text-center">Proje bulunamadı.</p>
              : <div className="flex items-center gap-4">
                  <DonutChart segments={projeDonut} size={76} strokeWidth={13} />
                  <DonutLegend segments={projeDonut} />
                </div>
          }
        </section>

        {/* Cari Hesap Özeti */}
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Banknote size={14} className="text-cyan-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">Cari Hesaplar</h3>
          </div>
          <div className="grid gap-2">
            <button onClick={() => setModal('nakit')} className="text-left rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 hover:bg-sky-500/10 transition-colors">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Nakit Hareketler</p>
                <span className="text-[10px] text-slate-500">{nakitRows.length} kayıt</span>
              </div>
              <p className="mt-1 text-base font-bold text-sky-300 truncate">{money(nakitToplam)}</p>
            </button>
            <button onClick={() => setModal('cek')} className="text-left rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 hover:bg-violet-500/10 transition-colors">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Çek Hareketler</p>
                <span className="text-[10px] text-slate-500">{cekRows.length} kayıt{cekBekleyen > 0 ? ` • ${cekBekleyen} bkl.` : ''}</span>
              </div>
              <p className="mt-1 text-base font-bold text-violet-300 truncate">{money(cekToplam)}</p>
            </button>
          </div>
        </section>

        {/* Görev Durumu + Vergi Takvimi */}
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} className="text-amber-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">Görev Durumu</h3>
            <span className="ml-auto text-[10px] text-slate-500">{tasks.length} görev</span>
          </div>
          {loading
            ? <p className="text-xs text-slate-500">Yükleniyor...</p>
            : gorevDonut.length === 0
              ? <p className="text-xs text-slate-500 py-2 text-center">Görev bulunamadı.</p>
              : <div className="flex items-center gap-4">
                  <DonutChart segments={gorevDonut} size={76} strokeWidth={13} />
                  <DonutLegend segments={gorevDonut} />
                </div>
          }

          {upcomingTaxes.length > 0 && (
            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck size={12} className="text-rose-400 shrink-0" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Yaklaşan Vergiler</span>
              </div>
              <div className="space-y-1.5">
                {upcomingTaxes.map(tax => (
                  <div key={tax.id} className="flex justify-between items-center gap-2">
                    <span className="text-[10px] text-slate-400 truncate">{TAX_LABELS[tax.surec_turu] || tax.surec_turu}</span>
                    <span className="text-[10px] font-medium text-teal-300 shrink-0">{tax.son_tarih}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      {modal === 'nakit' && <OzetModal title="Nakit Hareketler" rows={nakitRows} onClose={() => setModal(null)} />}
      {modal === 'cek' && <OzetModal title="Çek Hareketler" rows={cekRows} onClose={() => setModal(null)} showCek />}
    </div>
  )
}

// ── Özet Modal ───────────────────────────────────────────────────────────────

function OzetModal({ title, rows, onClose, showCek }: {
  title: string; rows: CariHareketRow[]; onClose: () => void; showCek?: boolean
}) {
  const LABELS: Record<string, string> = {
    odeme_nakit: 'Ödeme (Nakit)', tahsilat_nakit: 'Tahsilat (Nakit)',
    odeme_cek: 'Ödeme (Çek)', tahsilat_cek: 'Tahsilat (Çek)',
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
          {rows.length === 0
            ? <p className="py-8 text-center text-sm text-slate-500">Kayıt bulunamadı.</p>
            : rows.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{r.cariAd}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {LABELS[r.hareket_turu] || r.hareket_turu} • {r.tarih}
                    {r.vade_tarihi ? ` • Vade: ${r.vade_tarihi}` : ''}
                  </p>
                  {showCek && r.cek_no && (
                    <p className="text-[10px] text-violet-400 mt-0.5">Çek: {r.cek_no}{r.cek_banka ? ` (${r.cek_banka})` : ''}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${r.hareket_turu.startsWith('tahsilat') ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {money(r.tutar)}
                  </p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                    r.durum === 'tamamlandi' ? 'bg-emerald-500/10 text-emerald-400'
                    : r.durum === 'beklemede' ? 'bg-slate-500/10 text-slate-400'
                    : 'bg-rose-500/10 text-rose-400'
                  }`}>{r.durum}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
