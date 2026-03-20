'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma } from '@/lib/supabase'
import { RefreshCw } from 'lucide-react'

interface Props { userId: string; firma: Firma; onNavigate: (page: string) => void }

export default function DashboardPage({ userId, firma, onNavigate }: Props) {
  const [loading, setLoading] = useState(true)
  const [kasaBakiye, setKasaBakiye] = useState(0)
  const [bekleyenOdeme, setBekleyenOdeme] = useState(0)
  const [aktifProjeler, setAktifProjeler] = useState(0)
  const [bankaBakiye, setBankaBakiye] = useState(0)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [kasaRes, odemeRes, projelerRes, bankaRes] = await Promise.all([
        supabase.from('kasa').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }).limit(1),
        supabase.from('odeme_plani').select('*').eq('firma_id', firma.id).eq('durum', 'beklemede'),
        supabase.from('projeler').select('*').eq('firma_id', firma.id),
        supabase.from('bankalar').select('*').eq('firma_id', firma.id),
      ])

      if (kasaRes.data?.length) setKasaBakiye(kasaRes.data[0].bakiye)
      if (odemeRes.data) setBekleyenOdeme(odemeRes.data.reduce((s, o: any) => s + o.tutar, 0))
      if (projelerRes.data) setAktifProjeler(projelerRes.data.length)
      if (bankaRes.data) setBankaBakiye(bankaRes.data.reduce((s, b: any) => s + (b.bakiye || 0), 0))
    } catch (error) {
      console.error('Dashboard yükleme hatası:', error)
    }
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  const clearAllData = async () => {
    if (!confirm('Tüm verileri silmek istediğinize emin misiniz?')) return
    setLoading(true)
    try {
      const tables = ['kasa', 'bankalar', 'odeme_plani', 'maliyet', 'projeler', 'ekipler', 'gorevler', 'puantaj', 'vergi_surecleri', 'malatya_maliyet', 'cekler', 'senetler', 'cari_hesap', 'cari_hareket']
      for (const table of tables) {
        await supabase.from(table).delete().eq('firma_id', firma.id)
      }
      await fetchAll()
      alert('Veriler temizlendi.')
    } catch (error) {
      console.error('Silme hatası:', error)
    }
    setLoading(false)
  }

  const fmt = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={16} className="animate-spin text-slate-400"/>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">{firma.ad}</p>
        </div>
        <button onClick={clearAllData} className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100">
          Tüm Verileri Temizle
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div onClick={() => onNavigate('projeler')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-blue-200">
          <p className="text-xs text-slate-500 font-medium">Aktif Proje</p>
          <p className="text-2xl font-bold text-blue-600">{aktifProjeler}</p>
        </div>
        <div onClick={() => onNavigate('banka')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-indigo-200">
          <p className="text-xs text-slate-500 font-medium">Banka Bakiyesi</p>
          <p className="text-2xl font-bold text-indigo-600">{fmt(bankaBakiye)}</p>
        </div>
        <div onClick={() => onNavigate('odeme')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-amber-200">
          <p className="text-xs text-slate-500 font-medium">Bekleyen Ödemeler</p>
          <p className="text-2xl font-bold text-amber-600">{fmt(bekleyenOdeme)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 font-medium">Kasa Bakiyesi</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(kasaBakiye)}</p>
        </div>
      </div>
    </div>
  )
}
