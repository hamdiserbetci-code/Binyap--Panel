'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, CalendarDays, TrendingUp, ChevronRight, Landmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg, DurumBadge, OncelikBadge, KalanGunBadge } from '@/components/ui'
import { TARIH, kalanGun, TIP_LABEL } from '@/lib/utils'
import type { AppCtx } from '@/app/page'
import type { Gorev, BordroSurec, Cek } from '@/types'

interface Stats {
  bugun: number
  geciken: number
  kritik: number
  tamamlananBuAy: number
  toplamBuAy: number
}

export default function Dashboard({ firma, navigate }: AppCtx) {
  const [stats, setStats]       = useState<Stats | null>(null)
  const [yaklasan, setYaklasan] = useState<Gorev[]>([])
  const [geciken, setGeciken]   = useState<Gorev[]>([])
  const [bordro, setBordro]     = useState<BordroSurec | null>(null)
  const [ceklerList, setCeklerList] = useState<Cek[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => { load() }, [firma.id])

  async function load() {
    try {
      setLoading(true)
      const bugun = new Date().toISOString().split('T')[0]
      const ayBas = bugun.slice(0, 7) + '-01'
      const donem = bugun.slice(0, 7)

      const [gorevRes, tamamRes, bordroRes, cekRes] = await Promise.all([
        supabase.from('gorevler').select('*, sorumlu:kullanici_profilleri!gorevler_sorumlu_id_fkey(ad_soyad, email)')
          .eq('firma_id', firma.id).neq('durum', 'tamamlandi').neq('durum', 'iptal')
          .order('son_tarih'),
        supabase.from('gorevler').select('id', { count: 'exact', head: true })
          .eq('firma_id', firma.id).eq('durum', 'tamamlandi')
          .gte('tamamlandi_at', ayBas),
        supabase.from('bordro_surecler').select('*')
          .eq('firma_id', firma.id).eq('donem', donem).maybeSingle(),
        supabase.from('cekler').select('*')
          .eq('firma_id', firma.id).eq('durum', 'bekliyor').gte('vade_tarihi', bugun)
          .order('vade_tarihi').limit(5)
      ])

      const gorevler = (gorevRes.data || []) as Gorev[]
      const bugunList = gorevler.filter(g => g.son_tarih === bugun)
      const gecikenList = gorevler.filter(g => g.son_tarih < bugun)
      const kritikList = gorevler.filter(g => g.oncelik === 'kritik')
      const yaklaşan7 = gorevler.filter(g => {
        const k = kalanGun(g.son_tarih)
        return k >= 0 && k <= 7
      })

      const ayToplamRes = await supabase.from('gorevler')
        .select('id', { count: 'exact', head: true })
        .eq('firma_id', firma.id).gte('son_tarih', ayBas)

      setStats({
        bugun: bugunList.length,
        geciken: gecikenList.length,
        kritik: kritikList.length,
        tamamlananBuAy: tamamRes.count || 0,
        toplamBuAy: ayToplamRes.count || 0,
      })
      setYaklasan(yaklaşan7.slice(0, 8))
      setGeciken(gecikenList.slice(0, 5))
      setBordro(bordroRes.data as BordroSurec | null)
      setCeklerList(cekRes.data as Cek[] || [])
    } catch (e: any) {
      setError(e?.message || 'Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />
  if (!stats) return null

  const tamamOran = stats.toplamBuAy > 0 ? Math.round((stats.tamamlananBuAy / stats.toplamBuAy) * 100) : 0

  const BORDRO_ADIMLAR: { key: keyof BordroSurec; label: string }[] = [
    { key: 'puantaj_durum',  label: 'Puantaj' },
    { key: 'bordro_durum',   label: 'Bordro' },
    { key: 'teyit_durum',    label: 'Teyit' },
    { key: 'odeme_durum',    label: 'Ödeme' },
    { key: 'santiye_durum',  label: 'Şantiye' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 items-start bg-black/20 p-5 rounded-2xl border border-white/5 backdrop-blur-xl shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight text-white uppercase">Dashboard</h1>
        <p className="text-sm font-medium text-slate-400">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Bugün', value: stats.bugun, icon: CalendarDays, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', onClick: () => navigate('gorevler') },
          { label: 'Geciken', value: stats.geciken, icon: AlertTriangle, color: stats.geciken > 0 ? 'text-red-400' : 'text-slate-400', bg: stats.geciken > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10', onClick: () => navigate('gorevler') },
          { label: 'Kritik İş', value: stats.kritik, icon: Clock, color: stats.kritik > 0 ? 'text-amber-400' : 'text-slate-400', bg: stats.kritik > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/10', onClick: () => navigate('gorevler') },
          { label: 'Bu Ay Biten', value: `${stats.tamamlananBuAy}/${stats.toplamBuAy}`, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', onClick: () => navigate('raporlar') },
        ].map(card => {
          const Icon = card.icon
          return (
            <button key={card.label} onClick={card.onClick}
              className={`bg-black/20 border ${card.bg} rounded-2xl p-5 text-left hover:scale-[1.02] hover:bg-black/40 transition-all group backdrop-blur-xl shadow-lg`}>
              <div className={`w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center mb-4 shadow-inner border border-white/5`}>
                <Icon size={18} className={`${card.color} group-hover:scale-110 transition-transform`} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Yaklaşan İşler */}
        <div className="md:col-span-2 bg-black/20 border border-white/10 rounded-2xl backdrop-blur-xl shadow-lg flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
            <h2 className="text-sm font-bold tracking-widest uppercase text-slate-300">Yaklaşan İşler (7 Gün)</h2>
            <button onClick={() => navigate('gorevler')} className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">Tümü <ChevronRight size={14} /></button>
          </div>
          <div className="flex-1 overflow-auto">
            {yaklasan.length === 0 ? (
              <div className="py-12 flex items-center justify-center">
                <p className="text-sm font-medium text-slate-500 bg-white/5 px-6 py-3 rounded-full border border-dashed border-white/10">Bu hafta yaklaşan iş bulunmuyor.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {yaklasan.map(g => {
                  const kalan = kalanGun(g.son_tarih)
                  const rowColor = kalan < 0 ? 'bg-red-500/10' : kalan === 0 ? 'bg-amber-500/10' : 'hover:bg-white/5'
                  return (
                    <div key={g.id} className={`flex items-center gap-4 px-6 py-4 transition-colors ${rowColor}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate group-hover:text-blue-400">{g.ad}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 bg-black/40 px-2 py-0.5 rounded-md border border-white/5">{TIP_LABEL[g.tip]}</span>
                          {g.donem && <span className="text-[10px] font-bold text-slate-500">· {g.donem}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <OncelikBadge oncelik={g.oncelik} />
                          <DurumBadge durum={g.durum} />
                        </div>
                        <KalanGunBadge gun={kalan} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sağ panel */}
        <div className="space-y-5">
          {/* Bordro Süreci */}
          <div className="bg-black/20 border border-white/10 rounded-2xl backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">Bordro Süreci</h2>
              <button onClick={() => navigate('bordro')} className="text-[11px] font-bold text-blue-400 hover:text-blue-300">Detay</button>
            </div>
            <div className="p-5">
              {!bordro ? (
                <div className="text-xs font-medium text-slate-500 text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">Bu dönem bordro başlatılmadı</div>
              ) : (
                <div className="space-y-3">
                  {BORDRO_ADIMLAR.map((adim, i) => {
                    const val = bordro[adim.key] as string
                    const tamam = val === 'tamamlandi'
                    return (
                      <div key={adim.key} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${tamam ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-black/40 border-white/10 text-slate-500'}`}>
                          {tamam ? <CheckCircle2 size={14} className="text-emerald-400" /> : <span className="text-[10px] font-bold">{i+1}</span>}
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-widest ${tamam ? 'text-emerald-400' : 'text-slate-400'}`}>{adim.label}</span>
                        {!tamam && i > 0 && (bordro[BORDRO_ADIMLAR[i-1].key] as string) === 'tamamlandi' && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400 ml-auto bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Sırada</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bu Ay Tamamlama */}
          <div className="bg-black/20 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-4">Aylık Efor</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-black/40 rounded-full h-3 border border-white/5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${tamamOran}%` }} />
              </div>
              <span className="text-sm font-black text-emerald-400 shrink-0">%{tamamOran}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-3">{stats.tamamlananBuAy} / {stats.toplamBuAy} İŞ TAMAMLANDI</p>
          </div>

          {/* Geciken */}
          {geciken.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl overflow-hidden backdrop-blur-xl shadow-[0_0_20px_rgba(239,68,68,0.1)]">
              <div className="px-5 py-3 border-b border-red-500/20 bg-red-500/10 flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-red-400">Gecikenler ({geciken.length})</h2>
              </div>
              <div className="divide-y divide-red-500/10">
                {geciken.map(g => (
                  <div key={g.id} className="px-5 py-3.5 hover:bg-black/20 transition-colors">
                    <p className="text-sm font-bold text-red-100 truncate">{g.ad}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold bg-black/40 text-slate-400 px-2 py-0.5 rounded border border-white/5">{TARIH(g.son_tarih)}</span>
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{Math.abs(kalanGun(g.son_tarih))} GÜN GECİKTİ</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yaklaşan Çekler */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl overflow-hidden backdrop-blur-xl shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center gap-2">
                <Landmark size={15} className="text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400">Önümüzdeki Çek VADELERİ</h2>
              </div>
              <button onClick={() => navigate('cekler')} className="text-[10px] font-bold text-blue-400 hover:text-blue-300">Tümü &rarr;</button>
            </div>
            {ceklerList.length === 0 ? (
               <div className="p-4 text-center text-xs text-blue-400/60 font-medium">Yaklaşan çek ödemesi / tahsilatı yok.</div>
            ) : (
              <div className="divide-y divide-blue-500/10">
                {ceklerList.map(c => {
                  const outDir = c.tip === 'verilen'
                  return (
                    <div key={c.id} className="px-5 py-3.5 hover:bg-black/20 transition-colors flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-blue-100 truncate">{c.cek_no}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${outDir ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                            {outDir ? 'VERİLEN' : 'ALINAN'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{TARIH(c.vade_tarihi)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                         <p className={`text-sm font-bold ${outDir ? 'text-orange-400' : 'text-emerald-400'}`}>
                           {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(c.tutar))}
                         </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
