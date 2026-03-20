'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Proje, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, FolderOpen, ChevronRight } from 'lucide-react'

interface Props {
  userId: string
  firma: Firma
  onProjeSelect: (proje: Proje | null) => void
  onProjelerUpdate?: (projeler: Proje[]) => void
  selectedProjeId?: string
}

const DC: Record<string,string> = { aktif:'bg-emerald-500/10 text-emerald-300', tamamlandi:'bg-blue-500/10 text-blue-300', durduruldu:'bg-red-500/10 text-red-400' }
const DL: Record<string,string> = { aktif:'Aktif', tamamlandi:'Tamamlandı', durduruldu:'Durduruldu' }

export default function ProjelerPage({ userId, firma, onProjeSelect, onProjelerUpdate, selectedProjeId }: Props) {
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Proje | null>(null)
  const [form, setForm] = useState({ ad:'', aciklama:'', baslangic_tarihi:'', bitis_tarihi:'', durum:'aktif' })

  const fetchProjeler = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
    const list = data || []
    setProjeler(list)
    if (onProjelerUpdate) onProjelerUpdate(list)
    setLoading(false)
  }, [firma.id, onProjelerUpdate])

  useEffect(() => { fetchProjeler() }, [fetchProjeler])

  function openModal(p?: Proje) {
    setEditing(p || null)
    setForm(p ? { ad:p.ad, aciklama:p.aciklama||'', baslangic_tarihi:p.baslangic_tarihi||'', bitis_tarihi:p.bitis_tarihi||'', durum:p.durum } : { ad:'', aciklama:'', baslangic_tarihi:'', bitis_tarihi:'', durum:'aktif' })
    setModal(true)
  }

  async function handleSave() {
    if (!form.ad.trim()) {
      alert('Proje adı gereklidir.')
      return
    }
    try {
      const data = {
        ad: form.ad,
        aciklama: form.aciklama || null,
        baslangic_tarihi: form.baslangic_tarihi || null,
        bitis_tarihi: form.bitis_tarihi || null,
        durum: form.durum,
        firma_id: firma.id,
        user_id: userId
      }
      if (editing) {
        const { error } = await supabase.from('projeler').update(data).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('projeler').insert(data)
        if (error) throw error
      }
      setModal(false)
      await fetchProjeler()
    } catch (error: any) {
      console.error('Proje kaydetme hatası:', error)
      alert('Proje kaydedilemedi: ' + error.message)
    }
  }

  async function handleDelete(p: Proje) {
    if (!confirm(`"${p.ad}" projesini silmek istediğinize emin misiniz?`)) return
    try {
      const { error } = await supabase.from('projeler').delete().eq('id', p.id)
      if (error) throw error
      if (selectedProjeId === p.id) onProjeSelect(null)
      await fetchProjeler()
    } catch (error: any) {
      console.error('Proje silme hatası:', error)
      alert('Proje silinemiyor: ' + error.message)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Projeler</h3>
        <button onClick={() => openModal()} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium">
          <Plus size={11}/> Ekle
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5">
        {loading ? <p className="text-center text-slate-400 py-8 text-xs">Yükleniyor...</p> :
          projeler.length === 0 ? (
            <div className="text-center py-10 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
              <FolderOpen size={28} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-400 text-xs">Proje yok</p>
            </div>
          ) : projeler.map(p => (
            <div key={p.id} onClick={() => onProjeSelect(p)}
              className={`bg-white/[0.02] rounded-xl border p-3 cursor-pointer hover:border-blue-300 transition-all flex items-center gap-2.5 ${selectedProjeId===p.id?'border-blue-400 bg-blue-500/10':'border-white/[0.05]'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedProjeId===p.id?'bg-blue-600':'bg-white/[0.06]'}`}>
                <FolderOpen size={14} className={selectedProjeId===p.id?'text-white':'text-slate-400'}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${selectedProjeId===p.id?'text-blue-300':'text-white'}`}>{p.ad}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DC[p.durum]}`}>{DL[p.durum]}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                <button onClick={()=>openModal(p)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-300"><Pencil size={10}/></button>
                <button onClick={()=>handleDelete(p)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={10}/></button>
              </div>
              {selectedProjeId===p.id && <ChevronRight size={13} className="text-blue-400 flex-shrink-0"/>}
            </div>
          ))
        }
      </div>

      {modal && (
        <Modal title={editing?'Projeyi Düzenle':'Yeni Proje Ekle'} onClose={()=>setModal(false)}
          footer={<><button className={btnSecondary} onClick={()=>setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <FormField label="Proje Adı" required><input className={inputCls} value={form.ad} onChange={e=>setForm({...form,ad:e.target.value})} placeholder="Proje adı"/></FormField>
            <FormField label="Açıklama"><textarea className={inputCls} rows={2} value={form.aciklama} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Açıklama"/></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Başlangıç"><input type="date" className={inputCls} value={form.baslangic_tarihi} onChange={e=>setForm({...form,baslangic_tarihi:e.target.value})}/></FormField>
              <FormField label="Bitiş"><input type="date" className={inputCls} value={form.bitis_tarihi} onChange={e=>setForm({...form,bitis_tarihi:e.target.value})}/></FormField>
            </div>
            <FormField label="Durum">
              <select className={inputCls} value={form.durum} onChange={e=>setForm({...form,durum:e.target.value})}>
                <option value="aktif">Aktif</option><option value="tamamlandi">Tamamlandı</option><option value="durduruldu">Durduruldu</option>
              </select>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
