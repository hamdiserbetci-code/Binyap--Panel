'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

// ── Tipler ──────────────────────────────────────────────────────────────────

interface IncomeRecord {
  id: string; proje_id?: string; kayit_turu?: string; evrak_no?: string | null
  cari_unvan?: string | null; tarih: string; tutar: number; sirket?: string | null
  tahsilat_durumu?: string; aciklama?: string | null
}
interface ExpenseRecord {
  id: string; proje_id?: string; kategori?: string; tedarikci?: string | null
  belge_no?: string | null; tarih: string; tutar: number; sirket?: string | null
  odeme_durumu?: string; aciklama?: string | null
}
interface Props { firma: FirmaRecord }

// ── Yardımcı ────────────────────────────────────────────────────────────────

function money(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
}

const AY_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

const KAYIT_LABELS: Record<string, string> = {
  hakedis: 'Hakediş', fatura: 'Fatura', avans: 'Avans', kira: 'Kira',
  diger: 'Diğer', satis_fatura: 'Satış Fatura', diger_alacak: 'Diğer Alacak',
}
const KATEGORI_LABELS: Record<string, string> = {
  malzeme: 'Malzeme', iscilik: 'İşçilik', ekipman: 'Ekipman', nakliye: 'Nakliye',
  kira: 'Kira', hizmet: 'Hizmet', vergi: 'Vergi', diger: 'Diğer',
  alis_fatura: 'Alış Fatura', diger_borc: 'Diğer Borç',
}
const DURUM_CLS: Record<string, string> = {
  tamamlandi: 'bg-emerald-500/10 text-emerald-400',
  bekleniyor: 'bg-amber-500/10 text-amber-400',
  beklemede: 'bg-amber-500/10 text-amber-400',
  iptal: 'bg-rose-500/10 text-rose-400',
}

// ── Pasta Grafik (SVG Donut) ──────────────────────────────────────────────

function DonutChart({ segments, size = 110, strokeWidth = 16 }: {
  segments: { value: number; color: string; label: string }[]
  size?: number; strokeWidth?: number
}) {
  const r = (size - strokeWidth) / 2
  const cx = size / 2; const cy = size / 2
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0)

  if (total === 0) return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.2)" fontSize="9">Veri yok</text>
    </svg>
  )

  let cumulative = 0
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const length = (seg.value / total) * circumference
        const dasharray = `${length} ${circumference - length}`
        const dashoffset = -cumulative
        cumulative += length
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeDasharray={dasharray} strokeDashoffset={dashoffset} />
      })}
    </svg>
  )
}

// ── Maliyet Kartı ─────────────────────────────────────────────────────────

type FilterTuru = 'tum_zamanlar' | 'donemlik' | 'kumulatif'
type DetayTuru = 'gelir' | 'gider' | null

function MaliyetKarti({ sirketAd, renk, harf, incomeRecords, expenseRecords }: {
  sirketAd: string; renk: 'blue' | 'indigo'; harf: string
  incomeRecords: IncomeRecord[]; expenseRecords: ExpenseRecord[]
}) {
  const [tur, setTur] = useState<FilterTuru>('tum_zamanlar')
  const [yil, setYil] = useState(new Date().getFullYear())
  const [ay, setAy] = useState(new Date().getMonth() + 1)
  const [dbm, setDbm] = useState<number | ''>('')
  const [detay, setDetay] = useState<DetayTuru>(null)

  const borderCls = renk === 'blue' ? 'border-blue-500/20 bg-blue-500/[0.02]' : 'border-indigo-500/20 bg-indigo-500/[0.02]'
  const accentCls = renk === 'blue' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30' : 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30'
  const dbmBorderCls = renk === 'blue' ? 'border-blue-500/20 bg-blue-500/[0.04]' : 'border-indigo-500/20 bg-indigo-500/[0.04]'
  const inputFocusCls = renk === 'blue' ? 'border-blue-500/30 focus:border-blue-400 focus:ring-blue-500/20' : 'border-indigo-500/30 focus:border-indigo-400 focus:ring-indigo-500/20'

  const filteredInc = useMemo(() => {
    let inc = [...incomeRecords]
    if (tur === 'donemlik') {
      const prefix = `${yil}-${String(ay).padStart(2, '0')}`
      inc = inc.filter(r => r.tarih?.startsWith(prefix))
    } else if (tur === 'kumulatif') {
      const start = `${yil}-01`; const end = `${yil}-${String(ay).padStart(2, '0')}`
      inc = inc.filter(r => { const m = r.tarih?.substring(0, 7); return m >= start && m <= end })
    }
    return inc.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
  }, [incomeRecords, tur, yil, ay])

  const filteredExp = useMemo(() => {
    let exp = [...expenseRecords]
    if (tur === 'donemlik') {
      const prefix = `${yil}-${String(ay).padStart(2, '0')}`
      exp = exp.filter(r => r.tarih?.startsWith(prefix))
    } else if (tur === 'kumulatif') {
      const start = `${yil}-01`; const end = `${yil}-${String(ay).padStart(2, '0')}`
      exp = exp.filter(r => { const m = r.tarih?.substring(0, 7); return m >= start && m <= end })
    }
    return exp.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
  }, [expenseRecords, tur, yil, ay])

  const ozet = useMemo(() => {
    const dbmVal = tur !== 'donemlik' ? (Number(dbm) || 0) : 0
    const gelir = filteredInc.reduce((s, r) => s + Number(r.tutar || 0), 0)
    const gider = filteredExp.reduce((s, r) => s + Number(r.tutar || 0), 0) + dbmVal
    return { gelir, gider, net: gelir - gider }
  }, [filteredInc, filteredExp, dbm, tur])

  const donutSegs = [
    { value: ozet.gelir, color: '#34d399', label: 'Gelir' },
    { value: ozet.gider, color: '#f87171', label: 'Gider' },
  ]

  function toggleDetay(t: DetayTuru) {
    setDetay(prev => prev === t ? null : t)
  }

  return (
    <section className={`flex flex-col rounded-2xl border ${borderCls} p-5 gap-4`}>

      {/* Başlık + Filtre */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${accentCls}`}>{harf}</div>
          <h3 className="text-lg font-bold text-white tracking-tight">{sirketAd}</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/5">
          <select className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer font-medium" value={tur} onChange={e => setTur(e.target.value as FilterTuru)}>
            <option value="tum_zamanlar" className="bg-slate-900">Genel</option>
            <option value="kumulatif" className="bg-slate-900">Kümülatif</option>
            <option value="donemlik" className="bg-slate-900">Aylık</option>
          </select>
          {tur !== 'tum_zamanlar' && (<>
            <div className="w-px h-3.5 bg-white/10" />
            <select className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer" value={yil} onChange={e => setYil(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
            </select>
            <div className="w-px h-3.5 bg-white/10" />
            <select className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer" value={ay} onChange={e => setAy(Number(e.target.value))}>
              {AY_LABELS.map((a, i) => <option key={i + 1} value={i + 1} className="bg-slate-900">{a}</option>)}
            </select>
          </>)}
        </div>
      </div>

      {/* Dönem Başı Maliyet */}
      {tur !== 'donemlik' && (
        <div className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${dbmBorderCls}`}>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dönem Başı Maliyet</span>
            <span className="text-[10px] text-slate-600 mt-0.5">Geçmiş dönem bakiye girişi (₺)</span>
          </div>
          <input
            type="number"
            className={`ml-auto w-44 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-100 bg-white/[0.04] outline-none transition-colors placeholder:text-slate-600 focus:ring-1 ${inputFocusCls}`}
            value={dbm}
            onChange={e => setDbm(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="0,00"
          />
        </div>
      )}

      {/* İstatistikler + Donut */}
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="relative shrink-0">
          <DonutChart segments={donutSegs} size={110} strokeWidth={16} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
            <span className={`text-[10px] font-bold tracking-widest ${ozet.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>NET</span>
            <span className={`text-xs font-bold ${ozet.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{ozet.net >= 0 ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Stat Kartları */}
        <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
          {/* Gelir */}
          <button
            onClick={() => toggleDetay('gelir')}
            className={`rounded-2xl border p-3 text-left transition-all ${detay === 'gelir' ? 'border-emerald-400/40 bg-emerald-500/10 ring-1 ring-emerald-500/20' : 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Gelir</p>
              <span className="text-[10px] text-emerald-600">{filteredInc.length} kayıt</span>
            </div>
            <p className="text-xl font-bold text-emerald-300 truncate">{money(ozet.gelir)}</p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[9px] text-emerald-600">Detay</span>
              {detay === 'gelir' ? <ChevronUp size={10} className="text-emerald-500" /> : <ChevronDown size={10} className="text-emerald-600" />}
            </div>
          </button>

          {/* Gider */}
          <button
            onClick={() => toggleDetay('gider')}
            className={`rounded-2xl border p-3 text-left transition-all ${detay === 'gider' ? 'border-rose-400/40 bg-rose-500/10 ring-1 ring-rose-500/20' : 'border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold">Gider</p>
              <span className="text-[10px] text-rose-600">{filteredExp.length} kayıt</span>
            </div>
            <p className="text-xl font-bold text-rose-300 truncate">{money(ozet.gider)}</p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[9px] text-rose-600">Detay</span>
              {detay === 'gider' ? <ChevronUp size={10} className="text-rose-500" /> : <ChevronDown size={10} className="text-rose-600" />}
            </div>
          </button>

          {/* Net */}
          <div className={`rounded-2xl border p-3 ${ozet.net >= 0 ? 'border-sky-500/20 bg-sky-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
            <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${ozet.net >= 0 ? 'text-sky-400' : 'text-amber-400'}`}>Net Kâr/Zarar</p>
            <p className={`text-xl font-bold truncate ${ozet.net >= 0 ? 'text-sky-300' : 'text-amber-300'}`}>{money(ozet.net)}</p>
            <p className={`text-[9px] mt-1.5 font-medium ${ozet.net >= 0 ? 'text-sky-600' : 'text-amber-600'}`}>
              {ozet.gelir > 0 ? `Kâr oranı %${Math.round((ozet.net / ozet.gelir) * 100)}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Detay Paneli */}
      {detay && (
        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className={`text-sm font-bold ${detay === 'gelir' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {detay === 'gelir' ? 'Gelir Kayıtları' : 'Gider Kayıtları'}
              <span className="ml-2 text-[10px] font-normal text-slate-500">
                {detay === 'gelir' ? filteredInc.length : filteredExp.length} kayıt •{' '}
                {money(detay === 'gelir' ? ozet.gelir : ozet.gider)}
              </span>
            </h4>
            <button onClick={() => setDetay(null)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
            {detay === 'gelir' && (
              filteredInc.length === 0
                ? <p className="text-xs text-slate-500 py-6 text-center">Bu dönem için gelir kaydı bulunamadı.</p>
                : filteredInc.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 truncate">{r.cari_unvan || '—'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">{r.tarih}</span>
                        {r.kayit_turu && <span className="text-[10px] text-slate-600">• {KAYIT_LABELS[r.kayit_turu] || r.kayit_turu}</span>}
                        {r.evrak_no && <span className="text-[10px] text-slate-600">• {r.evrak_no}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.tahsilat_durumu && (
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${DURUM_CLS[r.tahsilat_durumu] || 'bg-slate-500/10 text-slate-400'}`}>
                          {r.tahsilat_durumu}
                        </span>
                      )}
                      <span className="text-sm font-bold text-emerald-300">{money(Number(r.tutar))}</span>
                    </div>
                  </div>
                ))
            )}

            {detay === 'gider' && (
              filteredExp.length === 0
                ? <p className="text-xs text-slate-500 py-6 text-center">Bu dönem için gider kaydı bulunamadı.</p>
                : filteredExp.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 truncate">{r.tedarikci || '—'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">{r.tarih}</span>
                        {r.kategori && <span className="text-[10px] text-slate-600">• {KATEGORI_LABELS[r.kategori] || r.kategori}</span>}
                        {r.belge_no && <span className="text-[10px] text-slate-600">• {r.belge_no}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.odeme_durumu && (
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${DURUM_CLS[r.odeme_durumu] || 'bg-slate-500/10 text-slate-400'}`}>
                          {r.odeme_durumu}
                        </span>
                      )}
                      <span className="text-sm font-bold text-rose-300">{money(Number(r.tutar))}</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function OverviewModule({ firma }: Props) {
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([])
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([])
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setError('')
    const [incomeRes, expenseRes, cariHesaplarRes, cariHareketlerRes] = await Promise.all([
      supabase.from('gelir_kayitlari').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }),
      supabase.from('gider_kayitlari').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }),
      supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id),
      supabase.from('cari_hareketler').select('*').eq('firma_id', firma.id),
    ])

    if (incomeRes.error || expenseRes.error) setError('Bazı finans verileri yüklenemedi.')

    const hesapMap = new Map((cariHesaplarRes.data || []).map((c: any) => [c.id, c]))
    const getSirket = (h: any) => (hesapMap.get(h.cari_hesap_id) as any)?.sirket || 'ETM'

    const allCari = (cariHareketlerRes.data || []) as any[]

    const cariIncomes: IncomeRecord[] = allCari
      .filter(r => ['satis_fatura', 'diger_alacak'].includes(r.hareket_turu))
      .map(r => ({
        id: r.id, tarih: r.tarih, tutar: r.tutar,
        sirket: getSirket(r), cari_unvan: (hesapMap.get(r.cari_hesap_id) as any)?.ad || '—',
        kayit_turu: r.hareket_turu, tahsilat_durumu: r.durum,
      }))

    const cariExpenses: ExpenseRecord[] = allCari
      .filter(r => ['alis_fatura', 'diger_borc'].includes(r.hareket_turu))
      .map(r => ({
        id: r.id, tarih: r.tarih, tutar: r.tutar,
        sirket: getSirket(r), tedarikci: (hesapMap.get(r.cari_hesap_id) as any)?.ad || '—',
        kategori: r.hareket_turu, odeme_durumu: r.durum,
      }))

    setIncomeRecords([...(incomeRes.data as IncomeRecord[] || []), ...cariIncomes])
    setExpenseRecords([...(expenseRes.data as ExpenseRecord[] || []), ...cariExpenses])
  }, [firma.id])

  useEffect(() => { fetchData() }, [fetchData])

  const etmInc = useMemo(() => incomeRecords.filter(r => r.sirket !== 'BİNYAPI'), [incomeRecords])
  const etmExp = useMemo(() => expenseRecords.filter(r => r.sirket !== 'BİNYAPI'), [expenseRecords])
  const binInc = useMemo(() => incomeRecords.filter(r => r.sirket === 'BİNYAPI'), [incomeRecords])
  const binExp = useMemo(() => expenseRecords.filter(r => r.sirket === 'BİNYAPI'), [expenseRecords])

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-xs text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">{error}</p>}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <MaliyetKarti sirketAd="ETM A.Ş." renk="blue" harf="E" incomeRecords={etmInc} expenseRecords={etmExp} />
        <MaliyetKarti sirketAd="BİNYAPI" renk="indigo" harf="B" incomeRecords={binInc} expenseRecords={binExp} />
      </div>
    </div>
  )
}
