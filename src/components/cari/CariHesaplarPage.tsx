'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ChevronRight, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'

interface Cari { id:string; ad:string; tip:string; vkn_tckn?:string; telefon?:string; email?:string; adres?:string; bakiye:number; notlar?:string }
interface Hareket { id:string; cari_id:string; tarih:string; aciklama:string; borc:number; alacak:number; bakiye:number }
interface Props { userId:string; firma:Firma }

const TIP_COLORS:Record<string,string> = { musteri:'bg-emerald-500/10 text-emerald-300', tedarikci:'bg-blue-500/10 text-blue-300', diger:'bg-white/[0.06] text-slate-300' }
const TIP_LABELS:Record<string,string> = { musteri:'Müşteri', tedarikci:'Tedarikçi', diger:'Diğer' }

export default function CariHesaplarPage({ userId, firma }:Props) {
  const [cariler, setCariler] = useState<Cari[]>([])
  const [hareketler, setHareketler] = useState<Hareket[]>([])
  const [selectedCari, setSelectedCari] = useState<Cari|null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [hareketModal, setHareketModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [editingHareket, setEditingHareket] = useState<any>(null)
  const [filtre, setFiltre] = useState('hepsi')

  const emptyForm = { ad:'', tip:'musteri', vkn_tckn:'', telefon:'', email:'', adres:'', bakiye:'0', notlar:'' }
  const emptyHareket = { tarih:new Date().toISOString().split('T')[0], aciklama:'', borc:'0', alacak:'0' }
  const [form, setForm] = useState<any>(emptyForm)
  const [hareketForm, setHareketForm] = useState<any>(emptyHareket)

  const fetchCariler = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id).order('ad')
    if (filtre !== 'hepsi') q = q.eq('tip', filtre)
    const { data } = await q
    setCariler(data || [])
    setLoading(false)
  }, [firma.id, filtre])

  const fetchHareketler = useCallback(async (cariId:string) => {
    const { data } = await supabase.from('cari_hareketler').select('*').eq('cari_id', cariId).order('tarih', { ascending:false })
    setHareketler(data || [])
  }, [])

  useEffect(() => { fetchCariler() }, [fetchCariler])

  function openModal(cari?:Cari) {
    setEditing(cari||null)
    setForm(cari ? { ad:cari.ad, tip:cari.tip, vkn_tckn:cari.vkn_tckn||'', telefon:cari.telefon||'', email:cari.email||'', adres:cari.adres||'', bakiye:String(cari.bakiye), notlar:cari.notlar||'' } : emptyForm)
    setModal(true)
  }

  async function handleSave() {
    const data = { ...form, bakiye:parseFloat(form.bakiye)||0, firma_id:firma.id, user_id:userId }
    if (editing) await supabase.from('cari_hesaplar').update(data).eq('id', editing.id)
    else await supabase.from('cari_hesaplar').insert(data)
    setModal(false); fetchCariler()
  }

  async function handleDelete(id:string) {
    if (!confirm('Bu cari hesabı silmek istediğinize emin misiniz?')) return
    await supabase.from('cari_hesaplar').delete().eq('id', id)
    if (selectedCari?.id === id) setSelectedCari(null)
    fetchCariler()
  }

  function openHareketModal(h?:Hareket) {
    setEditingHareket(h||null)
    setHareketForm(h ? { tarih:h.tarih, aciklama:h.aciklama, borc:String(h.borc), alacak:String(h.alacak) } : emptyHareket)
    setHareketModal(true)
  }

  async function handleHareketSave() {
    if (!selectedCari) return
    const borc = parseFloat(hareketForm.borc)||0
    const alacak = parseFloat(hareketForm.alacak)||0
    // Bakiye hesapla
    const { data:prev } = await supabase.from('cari_hareketler').select('bakiye').eq('cari_id', selectedCari.id).order('tarih',{ascending:false}).limit(1).single()
    const oncekiBakiye = prev?.bakiye || selectedCari.bakiye || 0
    const yeniBakiye = oncekiBakiye + alacak - borc
    const data = { cari_id:selectedCari.id, firma_id:firma.id, tarih:hareketForm.tarih, aciklama:hareketForm.aciklama, borc, alacak, bakiye:yeniBakiye, user_id:userId }
    if (editingHareket) await supabase.from('cari_hareketler').update(data).eq('id', editingHareket.id)
    else await supabase.from('cari_hareketler').insert(data)
    // Cari bakiyesini güncelle
    await supabase.from('cari_hesaplar').update({ bakiye:yeniBakiye }).eq('id', selectedCari.id)
    setHareketModal(false)
    fetchHareketler(selectedCari.id)
    fetchCariler()
  }

  async function handleHareketDelete(id:string) {
    if (!confirm('Bu hareketi silmek istediğinize emin misiniz?')) return
    await supabase.from('cari_hareketler').delete().eq('id', id)
    if (selectedCari) fetchHareketler(selectedCari.id)
  }

  function selectCari(cari:Cari) {
    setSelectedCari(cari)
    fetchHareketler(cari.id)
  }

  const fmt = (v:number) => v.toLocaleString('tr-TR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' ₺'
  const toplam = cariler.reduce((s,c)=>s+c.bakiye,0)

  if (selectedCari) return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setSelectedCari(null)} className="w-8 h-8 rounded-xl border border-white/[0.08] flex items-center justify-center text-slate-400 hover:bg-white/[0.04]"><ArrowLeft size={14}/></button>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-white">{selectedCari.ad}</h2>
          <p className="text-xs text-slate-400">{TIP_LABELS[selectedCari.tip]} • Bakiye: <span className={selectedCari.bakiye>=0?'text-emerald-400':'text-red-400'}>{fmt(selectedCari.bakiye)}</span></p>
        </div>
        <button onClick={() => openHareketModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14}/> Hareket Ekle
        </button>
      </div>

      {/* Cari bilgileri */}
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {selectedCari.vkn_tckn && <div><p className="text-[10px] text-slate-400">VKN/TCKN</p><p className="text-sm text-slate-200">{selectedCari.vkn_tckn}</p></div>}
        {selectedCari.telefon && <div><p className="text-[10px] text-slate-400">Telefon</p><p className="text-sm text-slate-200">{selectedCari.telefon}</p></div>}
        {selectedCari.email && <div><p className="text-[10px] text-slate-400">E-posta</p><p className="text-sm text-slate-200">{selectedCari.email}</p></div>}
        {selectedCari.adres && <div className="col-span-2"><p className="text-[10px] text-slate-400">Adres</p><p className="text-sm text-slate-200">{selectedCari.adres}</p></div>}
      </div>

      {/* Hareketler */}
      {hareketler.length === 0 ? (
        <div className="text-center py-10 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
          <p className="text-slate-400 text-sm">Hareket kaydı yok</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] overflow-hidden">
          <div className="grid grid-cols-5 gap-2 px-4 py-2.5 bg-white/[0.04] border-b border-white/[0.05] text-xs font-medium text-slate-400">
            <div>Tarih</div><div>Açıklama</div><div className="text-right">Borç</div><div className="text-right">Alacak</div><div className="text-right">Bakiye</div>
          </div>
          {hareketler.map(h => (
            <div key={h.id} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-white/[0.02] last:border-0 text-sm hover:bg-white/[0.04]/50 group">
              <div className="text-slate-400 text-xs">{h.tarih}</div>
              <div className="text-slate-200 truncate">{h.aciklama}</div>
              <div className="text-right text-red-400 font-medium">{h.borc>0?fmt(h.borc):'-'}</div>
              <div className="text-right text-emerald-400 font-medium">{h.alacak>0?fmt(h.alacak):'-'}</div>
              <div className={`text-right font-semibold flex items-center justify-end gap-1 ${h.bakiye>=0?'text-emerald-400':'text-red-400'}`}>
                {fmt(h.bakiye)}
                <div className="hidden group-hover:flex gap-0.5">
                  <button onClick={() => openHareketModal(h)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/[0.08] text-slate-400"><Pencil size={10}/></button>
                  <button onClick={() => handleHareketDelete(h.id)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 text-slate-400 hover:text-red-400"><Trash2 size={10}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hareketModal && (
        <Modal title={editingHareket?'Hareket Düzenle':'Hareket Ekle'} onClose={()=>setHareketModal(false)}
          footer={<><button className={btnSecondary} onClick={()=>setHareketModal(false)}>İptal</button><button className={btnPrimary} onClick={handleHareketSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tarih"><input type="date" className={inputCls} value={hareketForm.tarih} onChange={e=>setHareketForm({...hareketForm,tarih:e.target.value})}/></FormField>
              <FormField label="Açıklama"><input className={inputCls} value={hareketForm.aciklama} onChange={e=>setHareketForm({...hareketForm,aciklama:e.target.value})} placeholder="Açıklama"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Borç (₺)"><input type="number" className={inputCls} value={hareketForm.borc} onChange={e=>setHareketForm({...hareketForm,borc:e.target.value})} placeholder="0"/></FormField>
              <FormField label="Alacak (₺)"><input type="number" className={inputCls} value={hareketForm.alacak} onChange={e=>setHareketForm({...hareketForm,alacak:e.target.value})} placeholder="0"/></FormField>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Cari Hesaplar</h2>
          <p className="text-xs text-slate-400 mt-0.5">{cariler.length} hesap • Toplam bakiye: <span className={toplam>=0?'text-emerald-400':'text-red-400'}>{fmt(toplam)}</span></p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14}/> Cari Ekle
        </button>
      </div>

      {/* Filtre */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[['hepsi','Hepsi'],['musteri','Müşteri'],['tedarikci','Tedarikçi'],['diger','Diğer']].map(([id,label])=>(
          <button key={id} onClick={()=>setFiltre(id)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filtre===id?'bg-blue-600 text-white':'bg-white/[0.02] border border-white/[0.08] text-slate-300 hover:border-blue-300'}`}>{label}</button>
        ))}
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        cariler.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
            <p className="text-slate-400 text-sm mb-2">Cari hesap kaydı yok</p>
            <button onClick={() => openModal()} className="text-blue-400 text-sm hover:underline">İlk cariyi ekle</button>
          </div>
        ) : (
          <div className="space-y-2">
            {cariler.map(c => (
              <div key={c.id} className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3.5 flex items-center gap-3 hover:border-white/[0.08] transition-all cursor-pointer group" onClick={() => selectCari(c)}>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-400 flex-shrink-0">
                  {c.ad.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-white truncate">{c.ad}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${TIP_COLORS[c.tip]}`}>{TIP_LABELS[c.tip]}</span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-400">
                    {c.vkn_tckn && <span>{c.vkn_tckn}</span>}
                    {c.telefon && <span>{c.telefon}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${c.bakiye>=0?'text-emerald-400':'text-red-400'}`}>{fmt(c.bakiye)}</p>
                  <p className="text-[10px] text-slate-400">bakiye</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 flex-shrink-0"/>
                <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100" onClick={e=>e.stopPropagation()}>
                  <button onClick={() => openModal(c)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-white/[0.04] flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                  <button onClick={() => handleDelete(c.id)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-red-500/10 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={editing?'Cari Düzenle':'Cari Hesap Ekle'} onClose={()=>setModal(false)}
          footer={<><button className={btnSecondary} onClick={()=>setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ad / Firma Adı" required><input className={inputCls} value={form.ad} onChange={e=>setForm({...form,ad:e.target.value})} placeholder="Cari adı"/></FormField>
              <FormField label="Tür">
                <select className={inputCls} value={form.tip} onChange={e=>setForm({...form,tip:e.target.value})}>
                  <option value="musteri">Müşteri</option>
                  <option value="tedarikci">Tedarikçi</option>
                  <option value="diger">Diğer</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="VKN / TCKN"><input className={inputCls} value={form.vkn_tckn} onChange={e=>setForm({...form,vkn_tckn:e.target.value})} placeholder="Vergi / TC no"/></FormField>
              <FormField label="Telefon"><input className={inputCls} value={form.telefon} onChange={e=>setForm({...form,telefon:e.target.value})} placeholder="0xxx"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="E-posta"><input className={inputCls} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@firma.com"/></FormField>
              <FormField label="Açılış Bakiyesi (₺)"><input type="number" className={inputCls} value={form.bakiye} onChange={e=>setForm({...form,bakiye:e.target.value})} placeholder="0"/></FormField>
            </div>
            <FormField label="Adres"><input className={inputCls} value={form.adres} onChange={e=>setForm({...form,adres:e.target.value})} placeholder="Adres"/></FormField>
            <FormField label="Notlar"><input className={inputCls} value={form.notlar} onChange={e=>setForm({...form,notlar:e.target.value})} placeholder="Opsiyonel"/></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
