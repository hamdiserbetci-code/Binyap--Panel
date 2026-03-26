'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, CheckCircle2, AlertTriangle, Users, BarChart2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Gorev, KullaniciProfil } from '@/types'
import { TIP_LABEL, DURUM_LABEL, DURUM_COLOR } from '@/types'

interface RaporData {
  toplamGorev: number
  tamamlanan: number
  geciken: number
  iptal: number
  bekliyor: number
  tipDagilim: Record<string, number>
  durumDagilim: Record<string, number>
  sorumluPerformans: { id: string; ad: string; tamamlanan: number; geciken: number; toplam: number }[]
  aylikTrend: { ay: string; tamamlanan: number; geciken: number }[]
}

export default function Raporlar({ firma }: AppCtx) {
  const [data, setData]     = useState<RaporData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [donem, setDonem]   = useState('son3ay')

  useEffect(() => { load() }, [firma.id, donem])

  async function load() {
    try {
      setLoading(true)
      const bugun = new Date().toISOString().split('T')[0]
      let basTarih: string

      if (donem === 'bu_ay') {
        basTarih = bugun.slice(0, 7) + '-01'
      } else if (donem === 'son3ay') {
        const d = new Date(); d.setMonth(d.getMonth() - 3)
        basTarih = d.toISOString().split('T')[0]
      } else if (donem === 'son6ay') {
        const d = new Date(); d.setMonth(d.getMonth() - 6)
        basTarih = d.toISOString().split('T')[0]
      } else {
        const d = new Date(); d.setFullYear(d.getFullYear() - 1)
        basTarih = d.toISOString().split('T')[0]
      }

      const { data: gorevler, error: e } = await supabase
        .from('gorevler').select('*, sorumlu:kullanici_profilleri!gorevler_sorumlu_id_fkey(id, ad_soyad, email)')
        .eq('firma_id', firma.id).gte('son_tarih', basTarih)
      if (e) throw e

      const gs = (gorevler || []) as (Gorev & { sorumlu: KullaniciProfil | null })[]

      const tipDagilim: Record<string, number> = {}
      const durumDagilim: Record<string, number> = {}
      const sorumluMap: Record<string, { ad: string; tamamlanan: number; geciken: number; toplam: number }> = {}

      gs.forEach(g => {
        tipDagilim[g.tip] = (tipDagilim[g.tip] || 0) + 1
        durumDagilim[g.durum] = (durumDagilim[g.durum] || 0) + 1

        if (g.sorumlu_id) {
          if (!sorumluMap[g.sorumlu_id]) {
            sorumluMap[g.sorumlu_id] = {
              ad: g.sorumlu?.ad_soyad || g.sorumlu?.email || g.sorumlu_id,
              tamamlanan: 0, geciken: 0, toplam: 0
            }
          }
          sorumluMap[g.sorumlu_id].toplam++
          if (g.durum === 'tamamlandi') sorumluMap[g.sorumlu_id].tamamlanan++
          if (g.son_tarih < bugun && g.durum !== 'tamamlandi' && g.durum !== 'iptal') sorumluMap[g.sorumlu_id].geciken++
        }
      })

      // Aylık trend (son 6 ay)
      const aylikMap: Record<string, { tamamlanan: number; geciken: number }> = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i)
        const key = d.toISOString().slice(0, 7)
        aylikMap[key] = { tamamlanan: 0, geciken: 0 }
      }
      gs.forEach(g => {
        const ayKey = g.son_tarih.slice(0, 7)
        if (aylikMap[ayKey]) {
          if (g.durum === 'tamamlandi') aylikMap[ayKey].tamamlanan++
          else if (g.son_tarih < bugun) aylikMap[ayKey].geciken++
        }
      })

      const aylikTrend = Object.entries(aylikMap).map(([ay, v]) => ({ ay, ...v }))

      setData({
        toplamGorev: gs.length,
        tamamlanan: durumDagilim['tamamlandi'] || 0,
        geciken: gs.filter(g => g.son_tarih < bugun && g.durum !== 'tamamlandi' && g.durum !== 'iptal').length,
        iptal: durumDagilim['iptal'] || 0,
        bekliyor: durumDagilim['bekliyor'] || 0,
        tipDagilim,
        durumDagilim,
        sorumluPerformans: Object.entries(sorumluMap).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.tamamlanan - a.tamamlanan),
        aylikTrend,
      })
    } catch (e: any) {
      setError(e?.message || 'Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />
  if (!data) return null

  const tamamOran = data.toplamGorev > 0 ? Math.round((data.tamamlanan / data.toplamGorev) * 100) : 0
  const maxAylik = Math.max(...data.aylikTrend.map(a => a.tamamlanan + a.geciken), 1)

  function ayLabel(ay: string) {
    const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
    const [, m] = ay.split('-')
    return months[parseInt(m)-1]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Raporlar</h1>
          <p className="text-sm text-slate-500 mt-0.5">İş takip analizi ve performans özeti</p>
        </div>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 outline-none focus:border-blue-500"
          value={donem} onChange={e => setDonem(e.target.value)}>
          <option value="bu_ay">Bu Ay</option>
          <option value="son3ay">Son 3 Ay</option>
          <option value="son6ay">Son 6 Ay</option>
          <option value="son1yil">Son 1 Yıl</option>
        </select>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam İş', value: data.toplamGorev, icon: BarChart2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Tamamlanan', value: data.tamamlanan, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Geciken', value: data.geciken, icon: AlertTriangle, color: data.geciken > 0 ? 'text-red-600' : 'text-slate-400', bg: data.geciken > 0 ? 'bg-red-50' : 'bg-slate-50' },
          { label: 'Tamamlama Oranı', value: `%${tamamOran}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={card.color} />
              </div>
              <p className="text-xs text-slate-500 mb-0.5">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Aylık trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Aylık Trend</h3>
          <div className="flex items-end gap-2 h-32">
            {data.aylikTrend.map(ay => {
              const tamPct = ((ay.tamamlanan / maxAylik) * 100)
              const gecPct = ((ay.geciken / maxAylik) * 100)
              return (
                <div key={ay.ay} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                    {ay.geciken > 0 && (
                      <div className="w-full rounded-sm bg-red-400 mb-0.5" style={{ height: `${gecPct}px` }} title={`${ay.geciken} geciken`} />
                    )}
                    {ay.tamamlanan > 0 && (
                      <div className="w-full rounded-sm bg-emerald-500" style={{ height: `${tamPct}px` }} title={`${ay.tamamlanan} tamamlanan`} />
                    )}
                    {ay.tamamlanan === 0 && ay.geciken === 0 && (
                      <div className="w-full rounded-sm bg-slate-100" style={{ height: '4px' }} />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">{ayLabel(ay.ay)}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500" /><span className="text-xs text-slate-500">Tamamlanan</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-400" /><span className="text-xs text-slate-500">Geciken</span></div>
          </div>
        </div>

        {/* İş tipi dağılımı */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">İş Tipi Dağılımı</h3>
          <div className="space-y-2.5">
            {Object.entries(data.tipDagilim).sort((a, b) => b[1] - a[1]).map(([tip, count]) => {
              const pct = data.toplamGorev > 0 ? Math.round((count / data.toplamGorev) * 100) : 0
              return (
                <div key={tip}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600">{TIP_LABEL[tip as keyof typeof TIP_LABEL] || tip}</span>
                    <span className="text-xs font-semibold text-slate-700">{count} <span className="text-slate-400 font-normal">(%{pct})</span></span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(data.tipDagilim).length === 0 && (
              <p className="text-xs text-slate-400">Veri yok</p>
            )}
          </div>
        </div>

        {/* Durum dağılımı */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Durum Dağılımı</h3>
          <div className="space-y-2">
            {Object.entries(data.durumDagilim).sort((a, b) => b[1] - a[1]).map(([durum, count]) => {
              const pct = data.toplamGorev > 0 ? Math.round((count / data.toplamGorev) * 100) : 0
              return (
                <div key={durum} className="flex items-center gap-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold w-28 justify-center ${DURUM_COLOR[durum as keyof typeof DURUM_COLOR] || 'bg-slate-100 text-slate-600'}`}>
                    {DURUM_LABEL[durum as keyof typeof DURUM_LABEL] || durum}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 w-8 text-right">{count}</span>
                </div>
              )
            })}
            {Object.keys(data.durumDagilim).length === 0 && (
              <p className="text-xs text-slate-400">Veri yok</p>
            )}
          </div>
        </div>

        {/* Sorumlu performansı */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Users size={15} />Sorumlu Performansı
          </h3>
          {data.sorumluPerformans.length === 0 ? (
            <p className="text-xs text-slate-400">Sorumlu atanmış iş yok</p>
          ) : (
            <div className="space-y-3">
              {data.sorumluPerformans.map(s => {
                const pct = s.toplam > 0 ? Math.round((s.tamamlanan / s.toplam) * 100) : 0
                return (
                  <div key={s.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700">{s.ad}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-600 font-semibold">{s.tamamlanan}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-600">{s.toplam}</span>
                        {s.geciken > 0 && <span className="text-red-500 font-semibold">({s.geciken} gecik)</span>}
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
