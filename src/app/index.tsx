'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  FileCheck, Calendar, Building2, Users2, Clock, Calculator, 
  ShieldCheck, CheckCircle2, FileUp, FileText, 
  FileSpreadsheet, Trash2, Plus, Download
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, Modal, Field } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Varsayılan olarak BİR ÖNCEKİ AYI donduran yardımcı fonksiyon
function getPreviousMonthStr() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const ADIMLAR = [
  { id: 'puantaj_bekliyor', label: 'Puantaj Bekliyor', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'hesaplamada',      label: 'Hesaplamada',      icon: Calculator, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'onay_bekliyor',    label: 'Onay Bekliyor',    icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { id: 'tamamlandi',       label: 'Tamamlandı',       icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
]

export default function PayrollsModule({ firma }: AppCtx) {
  const [projeler, setProjeler] = useState<any[]>([])
  const [selProjeId, setSelProjeId] = useState<string>('')
  const [donem, setDonem] = useState(getPreviousMonthStr())
  
  const [loading, setLoading] = useState(true)
  const [takip, setTakip] = useState<any>(null)
  const [ekipler, setEkipler] = useState<any[]>([])
  const [arsiv, setArsiv] = useState<any[]>([])

  // Ekip Ekleme Modalı
  const [ekipModal, setEkipModal] = useState<boolean>(false)
  const [ekipForm, setEkipForm] = useState({ ad: '', tur: 'Kendi Personelimiz', kisi_sayisi: 0 })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Projeleri Yükle
  useEffect(() => {
    async function fetchProjeler() {
      const { data } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('proje_adi')
      setProjeler(data || [])
      if (data && data.length > 0) setSelProjeId(data[0].id)
    }
    fetchProjeler()
  }, [firma.id])

  // 2. Seçili Proje ve Döneme Göre Verileri Yükle
  useEffect(() => {
    if (!selProjeId || !donem) return
    loadTakipData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selProjeId, donem])

  async function loadTakipData() {
    setLoading(true)
    
    // A. Ekipleri Çek
    const { data: eData } = await supabase.from('proje_ekipleri').select('*').eq('proje_id', selProjeId).order('created_at')
    setEkipler(eData || [])

    // B. Takip Sürecini Çek (Yoksa otomatik oluştur)
    let { data: tData } = await supabase.from('bordro_takipleri').select('*').eq('proje_id', selProjeId).eq('donem', donem).maybeSingle()
    
    if (!tData) {
      const { data: newTData } = await supabase.from('bordro_takipleri')
        .insert({ firma_id: firma.id, proje_id: selProjeId, donem, durum: 'puantaj_bekliyor' })
        .select().single()
      tData = newTData
    }
    setTakip(tData)

    // C. Arşiv Dosyalarını Çek
    if (tData) {
      const { data: aData } = await supabase.from('bordro_arsiv').select('*').eq('bordro_takip_id', tData.id).order('created_at', { ascending: false })
      setArsiv(aData || [])
    }

    setLoading(false)
  }

  async function updateDurum(yeniDurum: string) {
    if (!takip) return
    await supabase.from('bordro_takipleri').update({ durum: yeniDurum, updated_at: new Date().toISOString() }).eq('id', takip.id)
    setTakip({ ...takip, durum: yeniDurum })
  }

  async function saveEkip() {
    if (!ekipForm.ad) return alert('Ekip adı zorunludur.')
    await supabase.from('proje_ekipleri').insert({
      firma_id: firma.id,
      proje_id: selProjeId,
      ad: ekipForm.ad,
      tur: ekipForm.tur,
      kisi_sayisi: ekipForm.kisi_sayisi
    })
    setEkipModal(false)
    setEkipForm({ ad: '', tur: 'Kendi Personelimiz', kisi_sayisi: 0 })
    loadTakipData()
  }

  async function deleteEkip(id: string) {
    if(!confirm('Ekibi silmek istiyor musunuz?')) return
    await supabase.from('proje_ekipleri').delete().eq('id', id)
    loadTakipData()
  }

  // Dosya Yükleme (Metadata olarak DB'ye yazılır, gerçek dosya Supabase Storage'a atılmalıdır)
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !takip) return

    const ext = file.name.split('.').pop()?.toLowerCase() || 'belge'
    
    await supabase.from('bordro_arsiv').insert({
      firma_id: firma.id,
      bordro_takip_id: takip.id,
      dosya_adi: file.name,
      dosya_tipi: ext,
      dosya_boyutu: file.size
    })
    
    if (fileInputRef.current) fileInputRef.current.value = ''
    loadTakipData()
  }

  async function deleteArsiv(id: string) {
    if(!confirm('Dosyayı arşivden silmek istiyor musunuz?')) return
    await supabase.from('bordro_arsiv').delete().eq('id', id)
    loadTakipData()
  }

  // Raporlama (Export)
  function exportToExcel() {
    const selProje = projeler.find(p => p.id === selProjeId)
    const rows = ekipler.map(e => ({
      'Proje': selProje?.proje_adi,
      'Dönem': donem,
      'Ekip Adı': e.ad,
      'Tür': e.tur,
      'Kişi Sayısı': e.kisi_sayisi,
      'Süreç Durumu': ADIMLAR.find(a => a.id === takip?.durum)?.label || 'Bilinmiyor'
    }))
    
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Bilgi: 'Bu projede kayıtlı ekip yok' }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Puantaj Özeti')
    XLSX.writeFile(wb, `Puantaj_Ozet_${donem}.xlsx`)
  }

  function exportToPDF() {
    const selProje = projeler.find(p => p.id === selProjeId)
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Proje Bazli Puantaj ve Bordro Ozeti', 14, 15)
    doc.setFontSize(11)
    doc.text(`Proje: ${selProje?.proje_adi} | Donem: ${donem}`, 14, 23)
    doc.text(`Surec Durumu: ${ADIMLAR.find(a => a.id === takip?.durum)?.label}`, 14, 29)

    autoTable(doc, {
      startY: 35,
      head: [['Ekip Adi', 'Tur', 'Kisi Sayisi']],
      body: ekipler.map(e => [e.ad, e.tur, e.kisi_sayisi]),
      theme: 'grid',
      headStyles: { fillColor: [14, 116, 144] }
    })
    doc.save(`Puantaj_${donem}.pdf`)
  }

  const currentStepIndex = takip ? ADIMLAR.findIndex(a => a.id === takip.durum) : 0
  const toplamKisi = ekipler.reduce((sum, e) => sum + (e.kisi_sayisi || 0), 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header & Filters */}
      <div className="bg-white border border-cyan-100 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100">
            <FileCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Puantaj & Süreç Takibi</h1>
            <p className="text-sm text-slate-500">Proje bazlı puantaj toplama ve dijital arşiv</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Calendar size={16} className="text-slate-400 mr-2" />
            <input 
              type="month" 
              value={donem} 
              onChange={e => setDonem(e.target.value)} 
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-32"
              title="Bir önceki ay varsayılan olarak seçilidir"
            />
          </div>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Building2 size={16} className="text-slate-400 mr-2" />
            <select 
              value={selProjeId} 
              onChange={e => setSelProjeId(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-48 truncate"
            >
              {projeler.length === 0 && <option value="">Proje Bulunamadı</option>}
              {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!selProjeId ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">Lütfen Bir Proje Seçin</h3>
          <p className="text-slate-500">Süreç takibi yapabilmek için üst kısımdan proje seçmelisiniz.</p>
        </div>
      ) : loading ? (
        <div className="p-12 text-center text-slate-500 animate-pulse font-medium">Süreç bilgileri yükleniyor...</div>
      ) : (
        <>
          {/* Stepper (Süreç Durumu) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Süreç Durumu (Hesaplama Portalı Harici)</h2>
            <div className="relative flex items-center justify-between w-full">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${(currentStepIndex / (ADIMLAR.length - 1)) * 100}%` }} />
              
              {ADIMLAR.map((adim, idx) => {
                const isPassed = idx <= currentStepIndex
                const isCurrent = idx === currentStepIndex
                const Icon = adim.icon
                return (
                  <button 
                    key={adim.id}
                    onClick={() => updateDurum(adim.id)}
                    className={`relative flex flex-col items-center gap-2 group z-10 w-24 ${isPassed ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isCurrent ? `${adim.bg} ${adim.border} border-2 shadow-md shadow-${adim.color.split('-')[1]}-100` : isPassed ? 'bg-cyan-500 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                      <Icon size={20} className={isCurrent ? adim.color : isPassed ? 'text-white' : ''} />
                    </div>
                    <span className={`text-xs font-bold text-center leading-tight ${isCurrent ? adim.color : 'text-slate-500'}`}>{adim.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sol: Ekipler */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users2 size={18} className="text-cyan-600"/> Projedeki Ekipler</h3>
                  <p className="text-xs text-slate-500 mt-1">Toplam {toplamKisi} personel raporlandı.</p>
                </div>
                <button onClick={() => setEkipModal(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5">
                  <Plus size={14} /> Ekip Ekle
                </button>
              </div>
              
              <div className="p-5 flex-1 bg-slate-50/50">
                {ekipler.length === 0 ? (
                  <div className="text-center py-10 text-slate-400"><Users2 size={40} className="mx-auto mb-3 opacity-50"/>Bu projeye henüz ekip tanımlanmamış.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ekipler.map(e => (
                      <div key={e.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between group hover:border-cyan-200 transition-colors">
                        <div>
                          <h4 className="font-bold text-slate-700 text-sm">{e.ad}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{e.tur} • <span className="font-semibold text-cyan-600">{e.kisi_sayisi} Kişi</span></p>
                        </div>
                        <button onClick={() => deleteEkip(e.id)} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-100">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sağ: Dijital Arşiv */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileUp size={18} className="text-blue-600"/> Dijital Arşiv</h3>
                <p className="text-xs text-slate-500 mt-1">Excel & PDF Puantaj Dosyaları</p>
              </div>
              
              <div className="p-5 flex flex-col gap-4">
                <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl p-6 flex flex-col items-center justify-center transition-colors">
                  <FileUp size={24} className="mb-2" />
                  <span className="text-sm font-bold">Dosya Yükle</span>
                  <span className="text-xs font-medium opacity-70">Excel, PDF vb.</span>
                </button>
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.xlsx,.xls,.doc,.docx" />

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {arsiv.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-4">Henüz arşiv dosyası yok</p>
                  ) : (
                    arsiv.map(a => (
                      <div key={a.id} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-3 group">
                        {a.dosya_tipi === 'pdf' ? <FileText size={20} className="text-rose-500" /> : <FileSpreadsheet size={20} className="text-emerald-500" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate" title={a.dosya_adi}>{a.dosya_adi}</p>
                          <p className="text-[10px] text-slate-400">{(a.dosya_boyutu / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={() => deleteArsiv(a.id)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Raporlama Butonları */}
              <div className="mt-auto p-5 border-t border-slate-100 bg-slate-50 rounded-b-3xl space-y-2">
                <button onClick={exportToPDF} className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
                  <Download size={16} /> PDF Rapor İndir
                </button>
                <button onClick={exportToExcel} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors">
                  <FileSpreadsheet size={16} /> Excel Dışa Aktar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ekip Ekle Modal */}
      {ekipModal && (
        <Modal title="Yeni Ekip / Taşeron Ekle" onClose={() => setEkipModal(false)} size="sm" footer={
          <>
            <button onClick={() => setEkipModal(false)} className={cls.btnSecondary}>İptal</button>
            <button onClick={saveEkip} className={cls.btnPrimary}>Ekle</button>
          </>
        }>
          <div className="space-y-4">
            <Field label="Ekip Adı / Kodu">
              <input 
                className={cls.input} 
                value={ekipForm.ad} 
                onChange={e => setEkipForm({...ekipForm, ad: e.target.value})} 
                placeholder="Örn: Demirci Ekibi 1" 
                autoFocus 
              />
            </Field>
            <Field label="Tür">
              <select className={cls.input} value={ekipForm.tur} onChange={e => setEkipForm({...ekipForm, tur: e.target.value})}>
                <option value="Kendi Personelimiz">Kendi Personelimiz</option>
                <option value="Taşeron">Taşeron</option>
              </select>
            </Field>
            <Field label="Kişi Sayısı">
              <input 
                type="number" 
                className={cls.input} 
                value={ekipForm.kisi_sayisi} 
                onChange={e => setEkipForm({...ekipForm, kisi_sayisi: Number(e.target.value)})} 
              />
            </Field>
          </div>
        </Modal>
      )}

}
}