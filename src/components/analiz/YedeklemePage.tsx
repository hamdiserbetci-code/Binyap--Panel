'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import { Download, Upload, Database, AlertCircle } from 'lucide-react'
import { btnPrimary, btnSecondary } from '@/components/ui/Modal'

interface Props { firma: Firma; userId: string }

const TABLOLAR = ['kasa', 'cari_hesaplar', 'cari_hareketler', 'odeme_plani', 'bordro', 'sgk_bildirgeler', 'icra_takibi', 'kar_zarar', 'is_takibi', 'evraklar', 'gunluk_isler', 'projeler', 'ekipler']

export default function YedeklemePage({ firma, userId }: Props) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [log, setLog] = useState<string[]>([])

  async function exportAll() {
    setExporting(true)
    setLog(['Veriler dışa aktarılıyor...'])
    const backup: Record<string, any[]> = { _meta: { firma_id: firma.id, firma_ad: firma.ad, tarih: new Date().toISOString(), versiyon: '1.0' } as any }

    for (const tablo of TABLOLAR) {
      const { data } = await supabase.from(tablo).select('*').eq('firma_id', firma.id)
      backup[tablo] = data || []
      setLog(l => [...l, `✓ ${tablo}: ${(data || []).length} kayıt`])
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${firma.ad}_yedek_${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setLog(l => [...l, '✅ Yedekleme tamamlandı!'])
    setExporting(false)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('Bu işlem mevcut verilerin üzerine yazabilir. Devam etmek istiyor musunuz?')) return

    setImporting(true)
    setLog(['Yedek dosyası okunuyor...'])

    try {
      const text = await file.text()
      const backup = JSON.parse(text)

      for (const tablo of TABLOLAR) {
        if (!backup[tablo] || backup[tablo].length === 0) continue
        const rows = backup[tablo].map((r: any) => ({ ...r, firma_id: firma.id }))
        const { error } = await supabase.from(tablo).upsert(rows, { onConflict: 'id' })
        if (error) {
          setLog(l => [...l, `✗ ${tablo}: ${error.message}`])
        } else {
          setLog(l => [...l, `✓ ${tablo}: ${rows.length} kayıt içe aktarıldı`])
        }
      }
      setLog(l => [...l, '✅ İçe aktarma tamamlandı!'])
    } catch (err: any) {
      setLog(l => [...l, `❌ Hata: ${err.message}`])
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Yedekleme</h2>
        <p className="text-xs text-slate-400 mt-0.5">Tüm firma verilerini JSON formatında dışa/içe aktarın</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Download size={16} className="text-blue-600"/>
            <h3 className="font-semibold text-slate-700 text-sm">Dışa Aktar</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">Tüm veriler JSON dosyasına aktarılır. Yedek almak için kullanın.</p>
          <button onClick={exportAll} disabled={exporting} className={btnPrimary + ' w-full flex items-center justify-center gap-2'}>
            <Download size={13}/> {exporting ? 'Aktarılıyor...' : 'Yedek Al'}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Upload size={16} className="text-blue-600"/>
            <h3 className="font-semibold text-slate-700 text-sm">İçe Aktar</h3>
          </div>
          <p className="text-xs text-slate-400 mb-2">Daha önce alınan JSON yedek dosyasını geri yükleyin.</p>
          <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mb-3">
            <AlertCircle size={10}/> Mevcut veriler etkilenebilir
          </div>
          <label className={btnSecondary + ' w-full flex items-center justify-center gap-2 cursor-pointer'}>
            <Upload size={13}/> {importing ? 'Yükleniyor...' : 'Dosya Seç'}
            <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={importing}/>
          </label>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database size={15} className="text-slate-400"/>
          <h3 className="font-semibold text-slate-700 text-sm">Kapsam</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABLOLAR.map(t => (
            <span key={t} className="text-[10px] font-mono bg-slate-50 border border-slate-100 text-slate-500 px-2 py-1 rounded-lg">{t}</span>
          ))}
        </div>
      </div>

      {log.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs text-slate-300 space-y-0.5 max-h-48 overflow-y-auto">
          {log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      )}
    </div>
  )
}
