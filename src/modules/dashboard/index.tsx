'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, CalendarDays, TrendingUp, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg, DurumBadge, OncelikBadge, KalanGunBadge } from '@/components/ui'
import { TARIH, kalanGun, TIP_LABEL } from '@/types'
import type { AppCtx } from '@/app/page'
import type { Gorev, BordroSurec } from '@/types'

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
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => { load() }, [firma.id])

  async function load() {
    try {
      setLoading(true)
      const bugun = new Date().toISOString().split('T')[0]
      const ayBas = bugun.slice(0, 7) + '-01'
      const donem = bugun.slice(0, 7)

      const [gorevRes, tamamRes, bordroRes] = await Promise.all([
        supabase.from('gorevler').select('*, sorumlu:kullanici_profilleri!gorevler_sorumlu_id_fkey(ad_soyad, email)')
          .eq('firma_id', firma.id).neq('durum', 'tamamlandi').neq('durum', 'iptal')
          .order('son_tarih'),
        supabase.from('gorevler').select('id', { count: 'exact', head: true })
          .eq('firma_id', firma.id).eq('durum', 'tamamlandi')
          .gte('tamamlandi_at', ayBas),
        supabase.from('bordro_surecler').select('*')
          .eq('firma_id', firma.id).eq('donem', donem).maybeSingle(),
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
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Bugün', value: stats.bugun, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => navigate('gorevler') },
          { label: 'Geciken', value: stats.geciken, icon: AlertTriangle, color: stats.geciken > 0 ? 'text-red-600' : 'text-slate-400', bg: stats.geciken > 0 ? 'bg-red-50' : 'bg-slate-50', onClick: () => navigate('gorevler') },
          { label: 'Kritik İş', value: stats.kritik, icon: Clock, color: stats.kritik > 0 ? 'text-amber-600' : 'text-slate-400', bg: stats.kritik > 0 ? 'bg-amber-50' : 'bg-slate-50', onClick: () => navigate('gorevler') },
          { label: 'Bu Ay Tamamlanan', value: `${stats.tamamlananBuAy}/${stats.toplamBuAy}`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => navigate('raporlar') },
        ].map(card => {
          const Icon = card.icon
          return (
            <button key={card.label} onClick={card.onClick}
              className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow-md transition-shadow group">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={card.color} />
              </div>
              <p className="text-xs text-slate-500 mb-0.5">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Yaklaşan İşler */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Yaklaşan İşler (7 Gün)</h2>
            <button onClick={() => navigate('gorevler')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">Tümü <ChevronRight size={12} /></button>
          </div>
          {yaklasan.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Bu hafta yaklaşan iş yok</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {yaklasan.map(g => {
                const kalan = kalanGun(g.son_tarih)
                const rowColor = kalan < 0 ? 'bg-red-50/50' : kalan === 0 ? 'bg-amber-50/50' : ''
                return (
                  <div key={g.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 ${rowColor}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{g.ad}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{TIP_LABEL[g.tip]}</span>
                        {g.donem && <span className="text-xs text-slate-400">· {g.donem}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <OncelikBadge oncelik={g.oncelik} />
                      <DurumBadge durum={g.durum} />
                      <KalanGunBadge gun={kalan} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sağ panel */}
        <div className="space-y-4">
          {/* Bordro Süreci */}
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Bordro Süreci</h2>
              <button onClick={() => navigate('bordro')} className="text-xs text-blue-600 hover:underline">Detay</button>
            </div>
            <div className="p-4">
              {!bordro ? (
                <div className="text-xs text-slate-400 text-center py-2">Bu dönem bordro başlatılmadı</div>
              ) : (
                <div className="space-y-2">
                  {BORDRO_ADIMLAR.map((adim, i) => {
                    const val = bordro[adim.key] as string
                    const tamam = val === 'tamamlandi'
                    return (
                      <div key={adim.key} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${tamam ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {tamam ? <CheckCircle2 size={12} className="text-white" /> : <span className="text-[9px] text-slate-400 font-bold">{i+1}</span>}
                        </div>
                        <span className={`text-xs ${tamam ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>{adim.label}</span>
                        {!tamam && i > 0 && (bordro[BORDRO_ADIMLAR[i-1].key] as string) === 'tamamlandi' && (
                          <span className="text-[10px] text-blue-500 ml-auto">Sırada</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bu Ay Tamamlama */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Bu Ay Tamamlama</h2>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${tamamOran}%` }} />
              </div>
              <span className="text-sm font-bold text-emerald-600 shrink-0">%{tamamOran}</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">{stats.tamamlananBuAy} / {stats.toplamBuAy} iş tamamlandı</p>
          </div>

          {/* Geciken */}
          {geciken.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl">
              <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500" />
                <h2 className="text-sm font-semibold text-red-700">Geciken İşler ({geciken.length})</h2>
              </div>
              <div className="divide-y divide-red-100">
                {geciken.map(g => (
                  <div key={g.id} className="px-4 py-2.5">
                    <p className="text-xs font-medium text-red-800 truncate">{g.ad}</p>
                    <p className="text-[10px] text-red-500 mt-0.5">{TARIH(g.son_tarih)} · {Math.abs(kalanGun(g.son_tarih))} gün gecikti</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
