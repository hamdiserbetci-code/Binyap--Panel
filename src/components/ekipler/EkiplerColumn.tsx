'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Proje, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, Users, UserPlus } from 'lucide-react'

interface Ekip {
  id: string; ad_soyad: string; pozisyon?: string; gunluk_ucret?: number
  tc_kimlik?: string; telefon?: string; iban?: string; sgk_no?: string; durum: string
}

interface Props { userId: string; firma: Firma; proje: Proje }

export default function EkiplerColumn({ userId, firma, proje }: Props) {
  const [ekipler, setEkipler] = useState<Ekip[]>([])
  const [loading, setLoading] = useState(true)
  const [ekipModal, setEkipModal] = useState(false)
  const [editingEkip, setEditingEkip] = useState<Ekip | null>(null)
  const [ekipForm, setEkipForm] = useState({ ad_soyad:'', tc_kimlik:'', pozisyon:'', gunluk_ucret:'', iban:'', telefon:'', sgk_no:'', durum:'aktif' })

  const fetchEkipler = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('ekipler').select('*').eq('proje_id', proje.id).order('ad_soyad')
    setEkipler(data || [])
    setLoading(false)
  }, [proje.id])

  useEffect(() => { fetchEkipler() }, [fetchEkipler])

  function openEkipModal(ekip?: Ekip) {
    setEditingEkip(ekip || null)
    setEkipForm(ekip ? { ad_soyad:ekip.ad_soyad, tc_kimlik:ekip.tc_kimlik||'', pozisyon:ekip.pozisyon||'', gunluk_ucret:String(ekip.gunluk_ucret||''), iban:ekip.iban||'', telefon:ekip.telefon||'', sgk_no:ekip.sgk_no||'', durum:ekip.durum } : { ad_soyad:'', tc_kimlik:'', pozisyon:'', gunluk_ucret:'', iban:'', telefon:'', sgk_no:'', durum:'aktif' })
    setEkipModal(true)
  }

  async function handleEkipSave() {
    if (!ekipForm.ad_soyad.trim()) return
    const data = { ...ekipForm, gunluk_ucret:ekipForm.gunluk_ucret?parseFloat(ekipForm.gunluk_ucret):null, proje_id:proje.id, firma_id:firma.id, user_id:userId }
    if (editingEkip) await supabase.from('ekipler').update(data).eq('id', editingEkip.id)
    else await supabase.from('ekipler').insert(data)
    setEkipModal(false); fetchEkipler()
  }

  async function handleEkipDelete(ekipId: string) {
    if (!confirm('Bu ekip üyesini silmek istediğinize emin misiniz?')) return
    await supabase.from('ekipler').delete().eq('id', ekipId)
    fetchEkipler()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Ekipler</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{proje.ad} • {ekipler.length} üye</p>
        </div>
        <button onClick={() => openEkipModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors">
          <UserPlus size={13}/> Yeni Ekip Üyesi
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5">
        {loading ? <p className="text-center text-slate-400 py-8 text-xs">Yükleniyor...</p> :
          ekipler.length === 0 ? (
            <div className="text-center py-10 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
              <Users size={28} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-400 text-xs mb-2">Ekip üyesi yok</p>
              <button onClick={() => openEkipModal()} className="text-blue-400 text-xs hover:underline">Ekle</button>
            </div>
          ) : ekipler.map(e => (
            <div key={e.id} className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3 flex items-center gap-2.5 hover:border-white/[0.08] transition-all">
              <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center font-semibold text-slate-300 text-xs flex-shrink-0">
                {e.ad_soyad.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-medium text-white truncate">{e.ad_soyad}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${e.durum==='aktif'?'bg-emerald-500/10 text-emerald-300':'bg-white/[0.06] text-slate-400'}`}>{e.durum==='aktif'?'Aktif':'Pasif'}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                  {e.pozisyon && <span>{e.pozisyon}</span>}
                  {e.tc_kimlik && <span>TC: {e.tc_kimlik}</span>}
                  {e.gunluk_ucret && <span className="text-blue-500 font-medium">{e.gunluk_ucret.toLocaleString('tr-TR')} ₺/gün</span>}
                </div>
                {e.iban && <p className="text-[10px] text-slate-400 mt-0.5 truncate">IBAN: {e.iban}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={()=>openEkipModal(e)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-300"><Pencil size={11}/></button>
                <button onClick={()=>handleEkipDelete(e.id)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={11}/></button>
              </div>
            </div>
          ))
        }
      </div>

      {ekipModal && (
        <Modal title={editingEkip?'Ekip Üyesini Düzenle':'Yeni Ekip Üyesi'} onClose={()=>setEkipModal(false)} size="lg"
          footer={<><button className={btnSecondary} onClick={()=>setEkipModal(false)}>İptal</button><button className={btnPrimary} onClick={handleEkipSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <FormField label="Ad Soyad" required><input className={inputCls} value={ekipForm.ad_soyad} onChange={e=>setEkipForm({...ekipForm,ad_soyad:e.target.value})} placeholder="Ad Soyad"/></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="TC Kimlik"><input className={inputCls} value={ekipForm.tc_kimlik} onChange={e=>setEkipForm({...ekipForm,tc_kimlik:e.target.value})} placeholder="11 haneli TC" maxLength={11}/></FormField>
              <FormField label="SGK No"><input className={inputCls} value={ekipForm.sgk_no} onChange={e=>setEkipForm({...ekipForm,sgk_no:e.target.value})} placeholder="SGK sicil no"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Pozisyon"><input className={inputCls} value={ekipForm.pozisyon} onChange={e=>setEkipForm({...ekipForm,pozisyon:e.target.value})} placeholder="İşçi, Usta..."/></FormField>
              <FormField label="Günlük Ücret (₺)"><input type="number" className={inputCls} value={ekipForm.gunluk_ucret} onChange={e=>setEkipForm({...ekipForm,gunluk_ucret:e.target.value})} placeholder="0.00"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Telefon"><input className={inputCls} value={ekipForm.telefon} onChange={e=>setEkipForm({...ekipForm,telefon:e.target.value})} placeholder="0555 xxx xx xx"/></FormField>
              <FormField label="Durum"><select className={inputCls} value={ekipForm.durum} onChange={e=>setEkipForm({...ekipForm,durum:e.target.value})}><option value="aktif">Aktif</option><option value="pasif">Pasif</option></select></FormField>
            </div>
            <FormField label="IBAN"><input className={inputCls} value={ekipForm.iban} onChange={e=>setEkipForm({...ekipForm,iban:e.target.value})} placeholder="TR..."/></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
