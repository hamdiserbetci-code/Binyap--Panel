'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Ekip, Proje, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'

interface Props { userId: string; firma: Firma; proje: Proje }

export default function EkiplerPage({ userId, firma, proje }: Props) {
  const [ekipler, setEkipler] = useState<Ekip[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Ekip | null>(null)
  const [form, setForm] = useState({ ad_soyad:'', tc_kimlik:'', pozisyon:'', ise_giris:'', gunluk_ucret:'', iban:'', telefon:'', sgk_no:'', durum:'aktif' })

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('ekipler').select('*').eq('proje_id', proje.id).order('ad_soyad')
    setEkipler(data || [])
    setLoading(false)
  }, [proje.id])

  useEffect(() => { fetch() }, [fetch])

  function openModal(e?: Ekip) {
    setEditing(e || null)
    setForm(e ? { ad_soyad:e.ad_soyad, tc_kimlik:e.tc_kimlik||'', pozisyon:e.pozisyon||'', ise_giris:e.ise_giris||'', gunluk_ucret:String(e.gunluk_ucret||''), iban:e.iban||'', telefon:e.telefon||'', sgk_no:e.sgk_no||'', durum:e.durum } : { ad_soyad:'', tc_kimlik:'', pozisyon:'', ise_giris:'', gunluk_ucret:'', iban:'', telefon:'', sgk_no:'', durum:'aktif' })
    setModal(true)
  }

  async function handleSave() {
    if (!form.ad_soyad.trim()) return
    const data = { ...form, gunluk_ucret: form.gunluk_ucret ? parseFloat(form.gunluk_ucret) : null, proje_id: proje.id, firma_id: firma.id, user_id: userId }
    if (editing) await supabase.from('ekipler').update(data).eq('id', editing.id)
    else await supabase.from('ekipler').insert(data)
    setModal(false); fetch()
  }

  async function handleDelete(e: Ekip) {
    if (!confirm(`"${e.ad_soyad}" kişisini silmek istediğinize emin misiniz?`)) return
    await supabase.from('ekipler').delete().eq('id', e.id)
    fetch()
  }

  const toplamGunlukUcret = ekipler.filter(e=>e.durum==='aktif').reduce((s,e)=>s+(e.gunluk_ucret||0),0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Ekip Üyeleri</h2>
          <p className="text-xs text-slate-400 mt-0.5">{proje.ad} — {ekipler.length} kişi</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14} /> Ekip Üyesi Ekle
        </button>
      </div>

      {toplamGunlukUcret > 0 && (
        <div className="bg-blue-500/10 border border-blue-100 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-blue-400">Toplam günlük işçilik: <span className="font-semibold">{toplamGunlukUcret.toLocaleString('tr-TR')} ₺</span></p>
        </div>
      )}

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        ekipler.length === 0 ? (
          <div className="text-center py-12">
            <Users size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Bu projeye henüz ekip üyesi eklenmedi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ekipler.map(e => (
              <div key={e.id} className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center font-semibold text-slate-300 text-sm flex-shrink-0">
                  {e.ad_soyad.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white">{e.ad_soyad}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${e.durum==='aktif'?'bg-emerald-500/10 text-emerald-300':'bg-white/[0.06] text-slate-400'}`}>{e.durum==='aktif'?'Aktif':'Pasif'}</span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
                    {e.pozisyon && <span>{e.pozisyon}</span>}
                    {e.tc_kimlik && <span>TC: {e.tc_kimlik}</span>}
                    {e.telefon && <span>{e.telefon}</span>}
                    {e.gunluk_ucret && <span className="text-blue-500 font-medium">{e.gunluk_ucret.toLocaleString('tr-TR')} ₺/gün</span>}
                  </div>
                  {e.iban && <p className="text-[11px] text-slate-400 mt-0.5">IBAN: {e.iban}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>openModal(e)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-white/[0.04] flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                  <button onClick={()=>handleDelete(e)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-red-500/10 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={editing ? 'Ekip Üyesini Düzenle' : 'Yeni Ekip Üyesi'} onClose={() => setModal(false)} size="lg"
          footer={<><button className={btnSecondary} onClick={()=>setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <FormField label="Ad Soyad" required>
              <input className={inputCls} value={form.ad_soyad} onChange={e=>setForm({...form,ad_soyad:e.target.value})} placeholder="Ad Soyad" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="TC Kimlik No">
                <input className={inputCls} value={form.tc_kimlik} onChange={e=>setForm({...form,tc_kimlik:e.target.value})} placeholder="11 haneli TC" maxLength={11} />
              </FormField>
              <FormField label="SGK No">
                <input className={inputCls} value={form.sgk_no} onChange={e=>setForm({...form,sgk_no:e.target.value})} placeholder="SGK sicil no" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Pozisyon">
                <input className={inputCls} value={form.pozisyon} onChange={e=>setForm({...form,pozisyon:e.target.value})} placeholder="İşçi, Usta, Mühendis..." />
              </FormField>
              <FormField label="Günlük Ücret (₺)">
                <input type="number" className={inputCls} value={form.gunluk_ucret} onChange={e=>setForm({...form,gunluk_ucret:e.target.value})} placeholder="0.00" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="İşe Giriş Tarihi">
                <input type="date" className={inputCls} value={form.ise_giris} onChange={e=>setForm({...form,ise_giris:e.target.value})} />
              </FormField>
              <FormField label="Telefon">
                <input className={inputCls} value={form.telefon} onChange={e=>setForm({...form,telefon:e.target.value})} placeholder="0555 xxx xx xx" />
              </FormField>
            </div>
            <FormField label="IBAN">
              <input className={inputCls} value={form.iban} onChange={e=>setForm({...form,iban:e.target.value})} placeholder="TR..." />
            </FormField>
            <FormField label="Durum">
              <select className={inputCls} value={form.durum} onChange={e=>setForm({...form,durum:e.target.value})}>
                <option value="aktif">Aktif</option>
                <option value="pasif">Pasif</option>
              </select>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
