'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ArrowLeft, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

interface Banka { id:string; banka_adi:string; sube?:string; hesap_no?:string; iban?:string; para_birimi:string; bakiye:number; notlar?:string }
interface Hareket { id:string; banka_id:string; tarih:string; aciklama:string; tur:string; tutar:number; bakiye:number }
interface Props { userId:string; firma:Firma }

export default function BankalarPage({ userId, firma }:Props) {
  const [bankalar, setBankalar] = useState<Banka[]>([])
  const [hareketler, setHareketler] = useState<Hareket[]>([])
  const [selectedBanka, setSelectedBanka] = useState<Banka|null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [hareketModal, setHareketModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [editingHareket, setEditingHareket] = useState<any>(null)

  const emptyForm = { banka_adi:'', sube:'', hesap_no:'', iban:'', para_birimi:'TRY', bakiye:'0', notlar:'' }
  const emptyHareket = { tarih:new Date().toISOString().split('T')[0], aciklama:'', tur:'giris', tutar:'0' }
  const [form, setForm] = useState<any>(emptyForm)
  const [hareketForm, setHareketForm] = useState<any>(emptyHareket)

  const fetchBankalar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('bankalar').select('*').eq('firma_id', firma.id).order('banka_adi')
    setBankalar(data || [])
    setLoading(false)
  }, [firma.id])

  const fetchHareketler = useCallback(async (bankaId:string) => {
    const { data } = await supabase.from('banka_hareketler').select('*').eq('banka_id', bankaId).order('tarih', { ascending:false })
    setHareketler(data || [])
  }, [])

  useEffect(() => { fetchBankalar() }, [fetchBankalar])

  function openModal(b?:Banka) {
    setEditing(b||null)
    setForm(b ? { banka_adi:b.banka_adi, sube:b.sube||'', hesap_no:b.hesap_no||'', iban:b.iban||'', para_birimi:b.para_birimi, bakiye:String(b.bakiye), notlar:b.notlar||'' } : emptyForm)
    setModal(true)
  }

  async function handleSave() {
    const data = { ...form, bakiye:parseFloat(form.bakiye)||0, firma_id:firma.id, user_id:userId }
    if (editing) await supabase.from('bankalar').update(data).eq('id', editing.id)
    else await supabase.from('bankalar').insert(data)
    setModal(false); fetchBankalar()
  }

  async function handleDelete(id:string) {
    if (!confirm('Bu banka hesabını silmek istediğinize emin misiniz?')) return
    await supabase.from('bankalar').delete().eq('id', id)
    if (selectedBanka?.id === id) setSelectedBanka(null)
    fetchBankalar()
  }

  function openHareketModal(h?:Hareket) {
    setEditingHareket(h||null)
    setHareketForm(h ? { tarih:h.tarih, aciklama:h.aciklama, tur:h.tur, tutar:String(h.tutar) } : emptyHareket)
    setHareketModal(true)
  }

  async function handleHareketSave() {
    if (!selectedBanka) return
    const tutar = parseFloat(hareketForm.tutar)||0
    const { data:prev } = await supabase.from('banka_hareketler').select('bakiye').eq('banka_id', selectedBanka.id).order('tarih',{ascending:false}).limit(1).single()
    const oncekiBakiye = prev?.bakiye ?? selectedBanka.bakiye ?? 0
    const yeniBakiye = hareketForm.tur === 'giris' ? oncekiBakiye + tutar : oncekiBakiye - tutar
    const data = { banka_id:selectedBanka.id, firma_id:firma.id, tarih:hareketForm.tarih, aciklama:hareketForm.aciklama, tur:hareketForm.tur, tutar, bakiye:yeniBakiye, user_id:userId }
    if (editingHareket) await supabase.from('banka_hareketler').update(data).eq('id', editingHareket.id)
    else await supabase.from('banka_hareketler').insert(data)
    await supabase.from('bankalar').update({ bakiye:yeniBakiye }).eq('id', selectedBanka.id)
    setHareketModal(false)
    fetchHareketler(selectedBanka.id)
    fetchBankalar()
  }

  async function handleHareketDelete(id:string) {
    if (!confirm('Bu hareketi silmek istediğinize emin misiniz?')) return
    await supabase.from('banka_hareketler').delete().eq('id', id)
    if (selectedBanka) fetchHareketler(selectedBanka.id)
  }

  const fmt = (v:number) => v.toLocaleString('tr-TR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' ₺'
  const toplamBakiye = bankalar.reduce((s,b)=>s+b.bakiye,0)

  if (selectedBanka) return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setSelectedBanka(null)} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50"><ArrowLeft size={14}/></button>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-800">{selectedBanka.banka_adi}</h2>
          <p className="text-xs text-slate-400">{selectedBanka.sube||''} • Bakiye: <span className={selectedBanka.bakiye>=0?'text-emerald-600':'text-red-500'}>{fmt(selectedBanka.bakiye)}</span></p>
        </div>
        <button onClick={() => openHareketModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14}/> Hareket Ekle
        </button>
      </div>

      {/* Banka bilgileri */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {selectedBanka.hesap_no && <div><p className="text-[10px] text-slate-400">Hesap No</p><p className="text-sm text-slate-700">{selectedBanka.hesap_no}</p></div>}
        {selectedBanka.iban && <div className="col-span-2"><p className="text-[10px] text-slate-400">IBAN</p><p className="text-sm text-slate-700 font-mono">{selectedBanka.iban}</p></div>}
        <div><p className="text-[10px] text-slate-400">Para Birimi</p><p className="text-sm text-slate-700">{selectedBanka.para_birimi}</p></div>
      </div>

      {/* Hareketler */}
      {hareketler.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
          <p className="text-slate-400 text-sm">Hareket kaydı yok</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500">
            <div>Tarih</div><div>Açıklama</div><div className="text-right">Tutar</div><div className="text-right">Bakiye</div>
          </div>
          {hareketler.map(h => (
            <div key={h.id} className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-slate-50 last:border-0 text-sm hover:bg-slate-50/50 group">
              <div className="text-slate-500 text-xs">{h.tarih}</div>
              <div className="text-slate-700 truncate flex items-center gap-1.5">
                {h.tur==='giris' ? <ArrowUpCircle size={13} className="text-emerald-500 flex-shrink-0"/> : <ArrowDownCircle size={13} className="text-red-400 flex-shrink-0"/>}
                {h.aciklama}
              </div>
              <div className={`text-right font-medium ${h.tur==='giris'?'text-emerald-600':'text-red-500'}`}>{h.tur==='giris'?'+':'-'}{fmt(h.tutar)}</div>
              <div className={`text-right font-semibold flex items-center justify-end gap-1 ${h.bakiye>=0?'text-emerald-600':'text-red-500'}`}>
                {fmt(h.bakiye)}
                <div className="hidden group-hover:flex gap-0.5">
                  <button onClick={() => openHareketModal(h)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-200 text-slate-400"><Pencil size={10}/></button>
                  <button onClick={() => handleHareketDelete(h.id)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 text-slate-400 hover:text-red-500"><Trash2 size={10}/></button>
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
              <FormField label="Tür">
                <select className={inputCls} value={hareketForm.tur} onChange={e=>setHareketForm({...hareketForm,tur:e.target.value})}>
                  <option value="giris">Giriş</option>
                  <option value="cikis">Çıkış</option>
                </select>
              </FormField>
            </div>
            <FormField label="Açıklama"><input className={inputCls} value={hareketForm.aciklama} onChange={e=>setHareketForm({...hareketForm,aciklama:e.target.value})} placeholder="Açıklama"/></FormField>
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={hareketForm.tutar} onChange={e=>setHareketForm({...hareketForm,tutar:e.target.value})} placeholder="0"/></FormField>
          </div>
        </Modal>
      )}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Banka Hesapları</h2>
          <p className="text-xs text-slate-400 mt-0.5">{bankalar.length} hesap • Toplam: <span className={toplamBakiye>=0?'text-emerald-600':'text-red-500'}>{fmt(toplamBakiye)}</span></p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14}/> Banka Ekle
        </button>
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        bankalar.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm mb-2">Banka hesabı kaydı yok</p>
            <button onClick={() => openModal()} className="text-blue-600 text-sm hover:underline">İlk hesabı ekle</button>
          </div>
        ) : (
          <div className="space-y-2">
            {bankalar.map(b => (
              <div key={b.id} className="bg-white rounded-xl border border-slate-100 p-3.5 flex items-center gap-3 hover:border-slate-200 transition-all cursor-pointer group" onClick={() => { setSelectedBanka(b); fetchHareketler(b.id) }}>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-emerald-600">{b.banka_adi.slice(0,3).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{b.banka_adi}</p>
                  <div className="flex gap-3 text-[11px] text-slate-400">
                    {b.sube && <span>{b.sube}</span>}
                    {b.iban && <span className="font-mono truncate">{b.iban}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${b.bakiye>=0?'text-emerald-600':'text-red-500'}`}>{fmt(b.bakiye)}</p>
                  <p className="text-[10px] text-slate-400">{b.para_birimi}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100" onClick={e=>e.stopPropagation()}>
                  <button onClick={() => openModal(b)} className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                  <button onClick={() => handleDelete(b.id)} className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={editing?'Banka Düzenle':'Banka Hesabı Ekle'} onClose={()=>setModal(false)}
          footer={<><button className={btnSecondary} onClick={()=>setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Banka Adı" required><input className={inputCls} value={form.banka_adi} onChange={e=>setForm({...form,banka_adi:e.target.value})} placeholder="Banka adı"/></FormField>
              <FormField label="Şube"><input className={inputCls} value={form.sube} onChange={e=>setForm({...form,sube:e.target.value})} placeholder="Şube adı"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Hesap No"><input className={inputCls} value={form.hesap_no} onChange={e=>setForm({...form,hesap_no:e.target.value})} placeholder="Hesap no"/></FormField>
              <FormField label="Para Birimi">
                <select className={inputCls} value={form.para_birimi} onChange={e=>setForm({...form,para_birimi:e.target.value})}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </FormField>
            </div>
            <FormField label="IBAN"><input className={inputCls} value={form.iban} onChange={e=>setForm({...form,iban:e.target.value})} placeholder="TR00 0000 0000 0000 0000 0000 00"/></FormField>
            <FormField label="Açılış Bakiyesi (₺)"><input type="number" className={inputCls} value={form.bakiye} onChange={e=>setForm({...form,bakiye:e.target.value})} placeholder="0"/></FormField>
            <FormField label="Notlar"><input className={inputCls} value={form.notlar} onChange={e=>setForm({...form,notlar:e.target.value})} placeholder="Opsiyonel"/></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
