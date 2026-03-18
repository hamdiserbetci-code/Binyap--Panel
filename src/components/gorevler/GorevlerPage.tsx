'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Gorev, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, Bell, AlertTriangle, Clock } from 'lucide-react'

interface Props { userId: string; firmalar: Firma[] }

const ONCELIK_COLORS: Record<string, string> = { dusuk:'bg-slate-100 text-slate-600', orta:'bg-blue-50 text-blue-600', yuksek:'bg-amber-50 text-amber-600', kritik:'bg-red-50 text-red-600' }
const ONCELIK_LABELS: Record<string, string> = { dusuk:'Düşük', orta:'Orta', yuksek:'Yüksek', kritik:'Kritik' }
const DURUM_COLORS: Record<string, string> = { beklemede:'bg-slate-100 text-slate-600', devam:'bg-blue-50 text-blue-600', tamamlandi:'bg-emerald-50 text-emerald-600' }

export default function GorevlerPage({ userId, firmalar }: Props) {
  const [gorevler, setGorevler] = useState<Gorev[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Gorev | null>(null)
  const [filtre, setFiltre] = useState('hepsi')
  const [filtreOncelik, setFiltreOncelik] = useState('hepsi')
  const today = new Date().toISOString().split('T')[0]

  const emptyForm = { firma_id:'', baslik:'', aciklama:'', oncelik:'orta', durum:'beklemede', yapilma_yuzdesi:'0', gecikme_sebebi:'', son_tarih:'', hatirlatici:false, sorumlu:'', hatirlama_saati:'', erteleme_dakika:'0' }
  const [form, setForm] = useState(emptyForm)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('gorevler').select('*').order('son_tarih', { ascending: true, nullsFirst: false })
    setGorevler(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openModal(g?: Gorev) {
    setEditing(g || null)
    setForm(g ? { firma_id:g.firma_id||'', baslik:g.baslik, aciklama:g.aciklama||'', oncelik:g.oncelik, durum:g.durum, yapilma_yuzdesi:String(g.yapilma_yuzdesi), gecikme_sebebi:g.gecikme_sebebi||'', son_tarih:g.son_tarih||'', hatirlatici:g.hatirlatici, sorumlu:g.sorumlu||'', hatirlama_saati:g.hatirlama_saati||'', erteleme_dakika:String(g.erteleme_dakika||0) } : emptyForm)
    setModal(true)
  }

  async function handleSave() {
    if (!form.baslik.trim()) return
    const data = { ...form, yapilma_yuzdesi:parseInt(form.yapilma_yuzdesi)||0, firma_id:form.firma_id||null, user_id:userId }
    if (editing) await supabase.from('gorevler').update(data).eq('id', editing.id)
    else await supabase.from('gorevler').insert(data)
    setModal(false); fetch()
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('gorevler').delete().eq('id', id)
    fetch()
  }

  async function toggleDurum(g: Gorev) {
    const durum = g.durum === 'tamamlandi' ? 'beklemede' : g.durum === 'beklemede' ? 'devam' : 'tamamlandi'
    await supabase.from('gorevler').update({ durum, ...(durum === 'tamamlandi' ? { yapilma_yuzdesi: 100 } : {}) }).eq('id', g.id)
    fetch()
  }

  const filtered = gorevler
    .filter(g => filtre === 'hepsi' ? true : g.durum === filtre)
    .filter(g => filtreOncelik === 'hepsi' ? true : g.oncelik === filtreOncelik)

  const aktif = gorevler.filter(g=>g.durum!=='tamamlandi').length
  const gecikti = gorevler.filter(g=>g.durum!=='tamamlandi'&&g.son_tarih&&g.son_tarih<today).length
  const hatirlatici = gorevler.filter(g=>g.hatirlatici&&g.durum!=='tamamlandi'&&g.son_tarih&&g.son_tarih<=today)

  const getFirmaAdi = (id?: string) => firmalar.find(f=>f.id===id)?.ad || ''

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Yapılacak İşler</h2>
          <p className="text-xs text-slate-400 mt-0.5">{aktif} aktif görev</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14} /> Görev Ekle
        </button>
      </div>

      {hatirlatici.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
          <Bell size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800"><span className="font-medium">{hatirlatici.length} hatırlatıcı: </span>{hatirlatici.slice(0,2).map(g=>`"${g.baslik}"`).join(', ')}{hatirlatici.length>2&&` ve ${hatirlatici.length-2} daha...`}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-xs text-slate-500 mb-1">Toplam Görev</p>
          <p className="text-xl font-semibold text-slate-800">{gorevler.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-xs text-slate-500 mb-1">Aktif</p>
          <p className="text-xl font-semibold text-blue-600">{aktif}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <p className="text-xs text-slate-500 mb-1">Gecikmiş</p>
          <p className="text-xl font-semibold text-red-500">{gecikti}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[['hepsi','Tümü'],['beklemede','Beklemede'],['devam','Devam'],['tamamlandi','Tamamlandı']].map(([v,l])=>(
          <button key={v} onClick={()=>setFiltre(v)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtre===v?'bg-blue-600 text-white':'bg-white border border-slate-200 text-slate-600'}`}>{l}</button>
        ))}
        <select value={filtreOncelik} onChange={e=>setFiltreOncelik(e.target.value)} className="ml-auto bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 outline-none">
          <option value="hepsi">Tüm Öncelikler</option>
          {Object.entries(ONCELIK_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        filtered.length === 0 ? <p className="text-center text-slate-400 py-8 text-sm">Görev bulunamadı</p> :
        <div className="space-y-2">
          {filtered.map(g => {
            const over = g.durum!=='tamamlandi'&&g.son_tarih&&g.son_tarih<today
            const bugun = g.son_tarih===today
            return (
              <div key={g.id} className={`bg-white rounded-xl border p-3.5 ${over?'border-l-4 border-l-red-400 border-y-slate-100 border-r-slate-100':bugun?'border-l-4 border-l-amber-400 border-y-slate-100 border-r-slate-100':'border-slate-100'}`}>
                <div className="flex items-start gap-3">
                  <button onClick={()=>toggleDurum(g)} className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${g.durum==='tamamlandi'?'bg-emerald-500 border-emerald-500':g.durum==='devam'?'border-blue-400 bg-blue-50':'border-slate-300 hover:border-blue-400'}`}>
                    {g.durum==='tamamlandi'&&<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6 8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    {g.durum==='devam'&&<div className="w-2 h-2 rounded-full bg-blue-400"/>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium mb-1 ${g.durum==='tamamlandi'?'line-through text-slate-400':'text-slate-800'}`}>{g.baslik}</p>
                    <div className="flex flex-wrap gap-1.5 items-center mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ONCELIK_COLORS[g.oncelik]}`}>{ONCELIK_LABELS[g.oncelik]}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${DURUM_COLORS[g.durum]}`}>{g.durum==='beklemede'?'Beklemede':g.durum==='devam'?'Devam Ediyor':'Tamamlandı'}</span>
                      {g.firma_id && <span className="text-[10px] text-slate-400">{getFirmaAdi(g.firma_id)}</span>}
                      {g.sorumlu && <span className="text-[10px] text-slate-400">{g.sorumlu}</span>}
                      {g.son_tarih && <span className={`text-[10px] flex items-center gap-1 ${over?'text-red-500':bugun?'text-amber-500':'text-slate-400'}`}>{over?<AlertTriangle size={10}/>:bugun?<Clock size={10}/>:null}{over?'Geçti: ':bugun?'Bugün: ':''}{g.son_tarih}</span>}
                    </div>
                    {g.yapilma_yuzdesi > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-blue-500 rounded-full h-1.5 transition-all" style={{width:`${g.yapilma_yuzdesi}%`}}/>
                        </div>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{g.yapilma_yuzdesi}%</span>
                      </div>
                    )}
                    {g.gecikme_sebebi && <p className="text-[11px] text-red-400 mt-1">⚠ {g.gecikme_sebebi}</p>}
                    {g.hatirlatici && g.durum!=='tamamlandi' && <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1"><Bell size={10}/>Hatırlatıcı aktif{g.hatirlama_saati ? ` — ${g.hatirlama_saati.slice(0,5)}` : ''}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={()=>openModal(g)} className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                    <button onClick={()=>handleDelete(g.id)} className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      }

      {modal && (
        <Modal title={editing ? 'Görevi Düzenle' : 'Yeni Görev Ekle'} onClose={() => setModal(false)} size="lg"
          footer={<><button className={btnSecondary} onClick={()=>setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <FormField label="Görev Başlığı" required><input className={inputCls} value={form.baslik} onChange={e=>setForm({...form,baslik:e.target.value})} placeholder="Görev adı" /></FormField>
            <FormField label="Açıklama"><textarea className={inputCls} rows={2} value={form.aciklama} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Detaylar..." /></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Öncelik">
                <select className={inputCls} value={form.oncelik} onChange={e=>setForm({...form,oncelik:e.target.value})}>
                  {Object.entries(ONCELIK_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Durum">
                <select className={inputCls} value={form.durum} onChange={e=>setForm({...form,durum:e.target.value})}>
                  <option value="beklemede">Beklemede</option>
                  <option value="devam">Devam Ediyor</option>
                  <option value="tamamlandi">Tamamlandı</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="İlgili Firma">
                <select className={inputCls} value={form.firma_id} onChange={e=>setForm({...form,firma_id:e.target.value})}>
                  <option value="">Genel</option>
                  {firmalar.map(f=><option key={f.id} value={f.id}>{f.ad}</option>)}
                </select>
              </FormField>
              <FormField label="Sorumlu Kişi"><input className={inputCls} value={form.sorumlu} onChange={e=>setForm({...form,sorumlu:e.target.value})} placeholder="Ad Soyad" /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Son Tarih"><input type="date" className={inputCls} value={form.son_tarih} onChange={e=>setForm({...form,son_tarih:e.target.value})} /></FormField>
              <FormField label="Hatırlatma Saati"><input type="time" className={inputCls} value={form.hatirlama_saati} onChange={e=>setForm({...form,hatirlama_saati:e.target.value})} /></FormField>
              <FormField label="Yapılma % (0-100)"><input type="number" className={inputCls} value={form.yapilma_yuzdesi} onChange={e=>setForm({...form,yapilma_yuzdesi:e.target.value})} min="0" max="100" /></FormField>
            </div>
            <FormField label="Gecikme Sebebi"><input className={inputCls} value={form.gecikme_sebebi} onChange={e=>setForm({...form,gecikme_sebebi:e.target.value})} placeholder="Yapılmadıysa sebebi..." /></FormField>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.hatirlatici} onChange={e=>setForm({...form,hatirlatici:e.target.checked})} className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-slate-700">Hatırlatıcı aktif et</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
