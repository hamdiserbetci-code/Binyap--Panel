'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma } from '@/lib/supabase'
import { FileDown, Printer, RefreshCw, ClipboardList, Loader2 } from 'lucide-react'
import * as XLSXStyle from 'xlsx-js-style'

interface Props { firmalar: Firma[] }

interface MizanSatir {
  grup: string
  hesap_adi: string
  tur?: string
  borc: number
  alacak: number
  bakiye: number
}

export default function MizanPage({ firmalar }: Props) {
  const [selectedFirmaId, setSelectedFirmaId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MizanSatir[]>([])

  useEffect(() => {
    if (firmalar.length > 0 && !selectedFirmaId) {
      setSelectedFirmaId(firmalar[0].id)
    }
  }, [firmalar, selectedFirmaId])

  const fetchMizan = useCallback(async () => {
    if (!selectedFirmaId) return
    setLoading(true)
    const list: MizanSatir[] = []

    try {
      // 1. Kasa Bakiyesi (Toplam giriş ve çıkışlardan net bakiye bulunur)
      const { data: kasaData } = await supabase.from('kasa').select('tutar, tur').eq('firma_id', selectedFirmaId)
      if (kasaData) {
        let kasaGiris = 0, kasaCikis = 0
        kasaData.forEach(k => { if (k.tur === 'giris') kasaGiris += k.tutar; else kasaCikis += k.tutar })
        const kasaBakiye = kasaGiris - kasaCikis
        if (kasaGiris > 0 || kasaCikis > 0) {
          list.push({ grup: 'Kasa Hesapları', hesap_adi: 'Merkez Kasa', borc: kasaGiris > kasaCikis ? kasaBakiye : 0, alacak: kasaCikis > kasaGiris ? Math.abs(kasaBakiye) : 0, bakiye: kasaBakiye })
        }
      }

      // 2. Banka Hesapları
      const { data: bankalar } = await supabase.from('bankalar').select('banka_adi, para_birimi, bakiye').eq('firma_id', selectedFirmaId)
      if (bankalar) {
        bankalar.forEach(b => {
          const isBorc = b.bakiye >= 0
          list.push({
            grup: 'Banka Hesapları',
            hesap_adi: `${b.banka_adi} (${b.para_birimi})`,
            borc: isBorc ? b.bakiye : 0,
            alacak: !isBorc ? Math.abs(b.bakiye) : 0,
            bakiye: b.bakiye
          })
        })
      }

      // 3. Cari Hesaplar
      const { data: cariler } = await supabase.from('cari_hesaplar').select('ad, tip, bakiye').eq('firma_id', selectedFirmaId)
      if (cariler) {
        cariler.forEach(c => {
          const isBorc = c.bakiye >= 0
          list.push({
            grup: 'Cari Hesaplar',
            hesap_adi: c.ad,
            tur: c.tip === 'musteri' ? 'Müşteri' : c.tip === 'tedarikci' ? 'Tedarikçi' : 'Diğer',
            borc: isBorc ? c.bakiye : 0,
            alacak: !isBorc ? Math.abs(c.bakiye) : 0,
            bakiye: c.bakiye
          })
        })
      }

      setData(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedFirmaId])

  useEffect(() => {
    fetchMizan()
  }, [fetchMizan])

  const gruplar = ['Kasa Hesapları', 'Banka Hesapları', 'Cari Hesaplar']
  
  const toplamBorc = data.reduce((s, i) => s + i.borc, 0)
  const toplamAlacak = data.reduce((s, i) => s + i.alacak, 0)
  const toplamBakiye = data.reduce((s, i) => s + i.bakiye, 0) // Net Varlık Durumu

  const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'

  const downloadExcel = () => {
    const wb = XLSXStyle.utils.book_new()
    const wsData: any[][] = []

    // Başlık
    wsData.push([{ v: 'MİZAN RAPORU (KASA, BANKA, CARİ)', s: { font: { bold: true, sz: 14 } } }])
    wsData.push([])

    // Kolon İsimleri
    const headers = ['Hesap Grubu', 'Hesap Adı', 'Tür', 'Borç Bakiyesi', 'Alacak Bakiyesi', 'Net Bakiye']
    wsData.push(headers.map(h => ({ v: h, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '334155' } } } })))

    data.forEach(d => {
      wsData.push([
        { v: d.grup },
        { v: d.hesap_adi },
        { v: d.tur || '-' },
        { v: d.borc, t: 'n', z: '#,##0.00' },
        { v: d.alacak, t: 'n', z: '#,##0.00' },
        { v: d.bakiye, t: 'n', z: '#,##0.00' },
      ])
    })

    // Genel Toplamlar
    wsData.push([])
    wsData.push([
      { v: 'GENEL TOPLAM', s: { font: { bold: true } } }, '', '',
      { v: toplamBorc, t: 'n', z: '#,##0.00', s: { font: { bold: true } } },
      { v: toplamAlacak, t: 'n', z: '#,##0.00', s: { font: { bold: true } } },
      { v: toplamBakiye, t: 'n', z: '#,##0.00', s: { font: { bold: true } } }
    ])

    const ws = XLSXStyle.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]

    XLSXStyle.utils.book_append_sheet(wb, ws, 'Mizan')
    XLSXStyle.writeFile(wb, `Mizan_Raporu_${new Date().getTime()}.xlsx`)
  }

  const printDocument = () => {
    window.print()
  }

  // Renklendirme fonksiyonları
  const cellColor = (val: number, isBorc: boolean) => {
    if (val === 0) return 'text-slate-500'
    if (isBorc) return 'text-emerald-400 font-medium' // Varlık/Alacaklar (Aktif Hesap Bakiyesi)
    return 'text-red-400 font-medium' // Borçlarımız (Pasif Hesap Bakiyesi)
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Özel Print Stilleri (Diğer bileşenlerin / taşmaların engellenmesi için) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, div, main, .h-screen, .overflow-hidden, .overflow-y-auto {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print-table { color: #000; border-collapse: collapse; width: 100%; font-size: 12px; }
          .print-table th { border: 1px solid #ddd; padding: 6px; background: #f1f5f9; text-align: left; }
          .print-table td { border: 1px solid #ddd; padding: 6px; }
          .print-table-header { padding: 20px 0; border-bottom: 2px solid #000; margin-bottom: 20px; }
        }
      `}} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardList className="text-blue-400" size={20} /> Mizan Raporu
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Tüm modüllerdeki (Kasa, Banka, Cari) hesapların güncel bakiyeleri</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedFirmaId} onChange={e => setSelectedFirmaId(e.target.value)}
            className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2 text-sm text-slate-200 outline-none">
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>

          <button onClick={fetchMizan} disabled={loading}
            className="h-9 px-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-slate-300 hover:bg-white/[0.06] flex items-center gap-2 text-sm transition-colors">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
          </button>

          <button onClick={downloadExcel} disabled={data.length === 0}
            className="h-9 px-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50">
            <FileDown size={16} /> Excel 
          </button>

          <button onClick={printDocument} disabled={data.length === 0}
            className="h-9 px-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50">
            <Printer size={16} /> Yazdır / PDF
          </button>
        </div>
      </div>

      {/* Yazdırılabilir PDF Başlığı */}
      <div className="hidden print:block print-table-header">
        <h1 style={{fontSize: '24px', fontWeight: 'bold', margin: '0 0 5px 0'}}>Genel Mizan Raporu</h1>
        <p style={{fontSize: '12px', margin: 0, color: '#666'}}>
          Firma: {firmalar.find(f => f.id === selectedFirmaId)?.ad} <br/>
          Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-slate-400 print:hidden"><Loader2 size={24} className="animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08] print:hidden">
          <p className="text-slate-400 text-sm">Seçili firma için mizan verisi bulunamadı.</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden print:border-0 print:bg-transparent">
          
          {/* EKRAN TABLOSU (Mizan) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print-table">
              <thead>
                <tr className="bg-white/[0.04] text-slate-400 text-xs border-b border-white/[0.05] print:bg-gray-100 print:text-black">
                  <th className="font-semibold p-3 w-1/4">Hesap Grubu</th>
                  <th className="font-semibold p-3 w-1/3">Hesap Adı</th>
                  <th className="font-semibold p-3">Tür</th>
                  <th className="font-semibold p-3 text-right">Borç Bakiyesi</th>
                  <th className="font-semibold p-3 text-right">Alacak Bakiyesi</th>
                  <th className="font-semibold p-3 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {gruplar.map((grupAd) => {
                  const grupVerisi = data.filter(d => d.grup === grupAd)
                  if (grupVerisi.length === 0) return null
                  
                  // Grup içi toplamlar
                  const gBorc = grupVerisi.reduce((s, d) => s + d.borc, 0)
                  const gAlacak = grupVerisi.reduce((s, d) => s + d.alacak, 0)
                  const gNet = grupVerisi.reduce((s, d) => s + d.bakiye, 0)

                  return (
                    <>
                      {/* Grup Başlığı */}
                      <tr className="bg-white/[0.01] border-b border-white/[0.02]">
                        <td colSpan={6} className="p-3 text-sm font-bold text-slate-300 print:text-black print:bg-gray-50 uppercase tracking-wider bg-white/[0.03]">
                          {grupAd}
                        </td>
                      </tr>
                      {/* Grup Satırları */}
                      {grupVerisi.map((satir, i) => (
                        <tr key={i} className="border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] transition-colors text-sm text-slate-300 print:text-black">
                          <td className="p-3"></td>
                          <td className="p-3">{satir.hesap_adi}</td>
                          <td className="p-3 text-xs text-slate-500">{satir.tur || '-'}</td>
                          <td className={`p-3 text-right ${cellColor(satir.borc, true)}`}>{satir.borc > 0 ? fmt(satir.borc) : '-'}</td>
                          <td className={`p-3 text-right ${cellColor(satir.alacak, false)}`}>{satir.alacak > 0 ? fmt(satir.alacak) : '-'}</td>
                          <td className={`p-3 text-right font-bold ${cellColor(satir.bakiye, satir.bakiye >= 0)}`}>{fmt(satir.bakiye)}</td>
                        </tr>
                      ))}
                      {/* Grup Sonu Özet (Ekranda pek gerekmeyebilir ama netliği artırır, şimdilik gizliyorum genel toplam yeterli) */}
                    </>
                  )
                })}
              </tbody>
              <tfoot>
                {/* Genel Toplam */}
                <tr className="bg-blue-600/10 border-t border-blue-500/20 text-blue-100 font-bold print:bg-gray-200 print:text-black">
                  <td colSpan={3} className="p-4 text-right">GENEL TOPLAM</td>
                  <td className="p-4 text-right text-emerald-400 print:text-black">{fmt(toplamBorc)}</td>
                  <td className="p-4 text-right text-red-400 print:text-black">{fmt(toplamAlacak)}</td>
                  <td className={`p-4 text-right text-lg ${toplamBakiye >= 0 ? 'text-emerald-400' : 'text-red-400'} print:text-black`}>{fmt(toplamBakiye)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
