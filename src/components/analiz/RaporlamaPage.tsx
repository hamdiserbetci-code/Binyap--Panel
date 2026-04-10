'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import { FileSpreadsheet, Printer, Download } from 'lucide-react'
import { btnPrimary, btnSecondary } from '@/components/ui/Modal'

interface Props { firma: Firma; userId: string }

export default function RaporlamaPage({ firma, userId }: Props) {
  const [loading, setLoading] = useState(false)

  async function downloadExcel(type: string) {
    setLoading(true)
    try {
      const XLSX = (await import('xlsx')).default
      const wb = XLSX.utils.book_new()

      if (type === 'kasa' || type === 'all') {
        const { data } = await supabase.from('kasa').select('*').eq('firma_id', firma.id).order('tarih')
        const rows = (data || []).map((r: any) => ({ Tarih: r.tarih, Açıklama: r.aciklama, Tür: r.tur, Tutar: r.tutar, Bakiye: r.bakiye, Kategori: r.kategori }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Kasa')
      }

      if (type === 'cari' || type === 'all') {
        const { data } = await supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id)
        const rows = (data || []).map((r: any) => ({ Ad: r.ad, Tür: r.tur, Bakiye: r.bakiye }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Cari Hesaplar')
      }

      if (type === 'odeme' || type === 'all') {
        const { data } = await supabase.from('odeme_plani').select('*').eq('firma_id', firma.id).order('vade')
        const rows = (data || []).map((r: any) => ({ Başlık: r.baslik, Tür: r.tur, Vade: r.vade, Tutar: r.tutar, Durum: r.durum, 'Çek No': r.cek_no }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Ödeme Planı')
      }

      if (type === 'bordro' || type === 'all') {
        const { data: b } = await supabase.from('bordro').select('*, ekipler(ad_soyad), projeler(ad)').eq('firma_id', firma.id).order('donem', { ascending: false })
        const rows = (b || []).map((r: any) => ({ Dönem: r.donem, Proje: r.projeler?.ad, Personel: r.ekipler?.ad_soyad, Brüt: r.brut, SGK_İşçi: r.sgk_isci, Vergi: r.vergi, Avans: r.avans, Net: r.net }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Bordro')
      }

      if (type === 'karzarar' || type === 'all') {
        const { data } = await supabase.from('kar_zarar').select('*').eq('firma_id', firma.id).order('donem')
        const rows = (data || []).map((r: any) => ({ Dönem: r.donem, Gelir: r.gelir, Gider: r.gider, Net: r.gelir - r.gider, Açıklama: r.aciklama }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Kar-Zarar')
      }

      if (type === 'istakibi' || type === 'all') {
        const { data } = await supabase.from('is_takibi').select('*').eq('firma_id', firma.id)
        const rows = (data || []).map((r: any) => ({ Başlık: r.baslik, Durum: r.durum, Öncelik: r.oncelik, Sorumlu: r.sorumlu, Başlangıç: r.baslangic, Bitiş: r.bitis }))
        const ws = XLSX.utils.json_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'İş Takibi')
      }

      if (wb.SheetNames.length === 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Bilgi: 'Veri bulunamadı' }]), 'Rapor')
      }

      XLSX.writeFile(wb, `${firma.ad}_${type}_rapor_${new Date().toISOString().slice(0,10)}.xlsx`)
    } finally {
      setLoading(false)
    }
  }

  function printPage() {
    window.print()
  }

  const MODULES = [
    { key: 'kasa',      label: 'Kasa Raporu',         desc: 'Tüm kasa giriş/çıkış hareketleri' },
    { key: 'cari',      label: 'Cari Hesap Raporu',   desc: 'Müşteri ve tedarikçi bakiyeleri' },
    { key: 'odeme',     label: 'Ödeme Planı Raporu',  desc: 'Vade takip ve ödeme durumları' },
    { key: 'bordro',    label: 'Bordro Raporu',        desc: 'Proje bazlı personel bordroları' },
    { key: 'karzarar',  label: 'Kar/Zarar Raporu',    desc: 'Dönemsel gelir/gider özeti' },
    { key: 'istakibi',  label: 'İş Takibi Raporu',    desc: 'Görev ve iş durumları' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Raporlama</h2>
          <p className="text-xs text-slate-400 mt-0.5">{firma.ad} · Excel ve PDF raporları</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadExcel('all')} disabled={loading}
            className={btnPrimary + ' flex items-center gap-2'}>
            <Download size={14}/>
            {loading ? 'Hazırlanıyor...' : 'Tüm Rapor (Excel)'}
          </button>
          <button onClick={printPage} className={btnSecondary + ' flex items-center gap-2'}>
            <Printer size={14}/> PDF / Yazdır
          </button>
        </div>
      </div>

      <div id="print-area" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map(m => (
          <div key={m.key} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <FileSpreadsheet size={16} className="text-blue-600"/>
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{m.label}</p>
                <p className="text-[11px] text-slate-400">{m.desc}</p>
              </div>
            </div>
            <button onClick={() => downloadExcel(m.key)} disabled={loading}
              className="w-full text-xs font-medium bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 hover:text-blue-600 text-slate-600 rounded-xl py-2 transition-all flex items-center justify-center gap-1.5">
              <FileSpreadsheet size={12}/> Excel İndir
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          body > *:not(#print-area) { display: none !important; }
          #print-area { display: block !important; }
          header, aside, nav { display: none !important; }
        }
      `}</style>
    </div>
  )
}
