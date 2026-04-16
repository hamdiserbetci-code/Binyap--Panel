'use client'
import React, { useEffect, useState } from 'react'
import { Wallet, Clock, TrendingUp, Users, FolderOpen, AlertTriangle, Scale } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { StatCard, Card, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { ModuleId } from '@/types'

interface Props extends AppCtx { onNavigate: (id: ModuleId) => void }

export default function Dashboard({ firma, onNavigate }: Props) {
  const [stats, setStats] = useState({
    kasaBakiye: 0,
    bekleyenOdeme: 0,
    bekleyenOdemeTutar: 0,
    aktifProje: 0,
    aktifPersonel: 0,
    aktifIcra: 0,
    icraToplamBorc: 0,
    sgkBekleyen: 0,
  })
  const [uyarilar, setUyarilar] = useState<{ tip: string; mesaj: string; modul: ModuleId }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [firma.id])

  async function load() {
    setLoading(true)
    const fid = firma.id

    const [kasa, odeme, proje, personel, icra, sgk] = await Promise.all([
      supabase.from('kasa_hareketleri').select('islem_tipi, tutar').eq('firma_id', fid),
      supabase.from('odeme_plani').select('tutar, durum').eq('firma_id', fid),
      supabase.from('projeler').select('durum').eq('firma_id', fid),
      supabase.from('personeller').select('aktif').eq('firma_id', fid),
      supabase.from('icra_takibi').select('durum, toplam_borc, odenen_tutar').eq('firma_id', fid),
      supabase.from('sgk_beyan').select('durum').eq('firma_id', fid),
    ])

    const kasaBakiye = (kasa.data || []).reduce((s, r) =>
      r.islem_tipi === 'giris' ? s + Number(r.tutar) : s - Number(r.tutar), 0)

    const bekleyenOdeme = (odeme.data || []).filter(r => r.durum === 'bekliyor')
    const aktifProje    = (proje.data || []).filter(r => r.durum === 'devam').length
    const aktifPersonel = (personel.data || []).filter(r => r.aktif).length
    const aktifIcra     = (icra.data || []).filter(r => r.durum === 'aktif')
    const sgkBekleyen   = (sgk.data || []).filter(r => r.durum === 'bekliyor').length

    const uyList: typeof uyarilar = []
    if (bekleyenOdeme.length > 0)
      uyList.push({ tip: 'warning', mesaj: `${bekleyenOdeme.length} bekleyen ödeme var`, modul: 'odeme-plani' })
    if (aktifIcra.length > 0)
      uyList.push({ tip: 'danger', mesaj: `${aktifIcra.length} aktif icra dosyası`, modul: 'icra' })
    if (sgkBekleyen > 0)
      uyList.push({ tip: 'warning', mesaj: `${sgkBekleyen} SGK beyanı bekliyor`, modul: 'sgk' })

    setStats({
      kasaBakiye,
      bekleyenOdeme: bekleyenOdeme.length,
      bekleyenOdemeTutar: bekleyenOdeme.reduce((s, r) => s + Number(r.tutar), 0),
      aktifProje,
      aktifPersonel,
      aktifIcra: aktifIcra.length,
      icraToplamBorc: aktifIcra.reduce((s, r) => s + Number(r.toplam_borc || 0) - Number(r.odenen_tutar || 0), 0),
      sgkBekleyen,
    })
    setUyarilar(uyList)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">{firma.ad}</h1>
        <p className="text-slate-400 text-sm">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Uyarılar */}
      {uyarilar.length > 0 && (
        <div className="space-y-2">
          {uyarilar.map((u, i) => (
            <button key={i} onClick={() => onNavigate(u.modul)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-shadow hover:shadow-md ${u.tip === 'danger' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${u.tip === 'danger' ? 'text-red-500' : 'text-yellow-500'}`} />
              <span className={`text-sm font-medium ${u.tip === 'danger' ? 'text-red-800' : 'text-yellow-800'}`}>{u.mesaj}</span>
              <span className="ml-auto text-xs text-gray-400">Görüntüle →</span>
            </button>
          ))}
        </div>
      )}

      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Kasa Bakiyesi" value={fmt(stats.kasaBakiye)}
          icon={<Wallet className="w-6 h-6" />} color="text-emerald-600"
          onClick={() => onNavigate('kasa')} />
        <StatCard label="Bekleyen Ödeme" value={stats.bekleyenOdeme}
          sub={fmt(stats.bekleyenOdemeTutar)}
          icon={<Clock className="w-6 h-6" />} color="text-amber-600"
          onClick={() => onNavigate('odeme-plani')} />
        <StatCard label="Aktif Proje" value={stats.aktifProje}
          icon={<FolderOpen className="w-6 h-6" />} color="text-purple-600"
          onClick={() => onNavigate('projeler')} />
        <StatCard label="Aktif Personel" value={stats.aktifPersonel}
          icon={<Users className="w-6 h-6" />} color="text-sky-600"
          onClick={() => onNavigate('personel')} />
        <StatCard label="Aktif İcra" value={stats.aktifIcra}
          sub={stats.aktifIcra > 0 ? `Kalan: ${fmt(stats.icraToplamBorc)}` : undefined}
          icon={<Scale className="w-6 h-6" />} color="text-rose-600"
          onClick={() => onNavigate('icra')} />
        <StatCard label="SGK Bekleyen" value={stats.sgkBekleyen}
          icon={<TrendingUp className="w-6 h-6" />} color="text-green-600"
          onClick={() => onNavigate('sgk')} />
      </div>

      {/* Hızlı Erişim */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Hızlı Erişim</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { id: 'kasa',        label: 'Kasa İşlemi',  icon: Wallet,     color: 'bg-emerald-50 text-emerald-700' },
            { id: 'odeme-plani', label: 'Ödeme Ekle',   icon: Clock,      color: 'bg-amber-50 text-amber-700' },
            { id: 'projeler',    label: 'Proje Ekle',   icon: FolderOpen, color: 'bg-purple-50 text-purple-700' },
            { id: 'personel',    label: 'Personel',     icon: Users,      color: 'bg-sky-50 text-sky-700' },
          ] as const).map(item => {
            const Icon = item.icon
            return (
              <button key={item.id} onClick={() => onNavigate(item.id as ModuleId)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl ${item.color} hover:opacity-80 transition-opacity`}>
                <Icon className="w-6 h-6" />
                <span className="text-xs font-semibold">{item.label}</span>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
