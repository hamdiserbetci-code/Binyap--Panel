'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, Building2, ChevronRight } from 'lucide-react'

interface Props { userId: string; onFirmaSelect: (firma: Firma) => void; selectedFirmaId?: string }

const emptyForm = { ad:'', vergi_no:'', vergi_dairesi:'', adres:'', telefon:'', email:'', yetkili:'', notlar:'' }

export default function FirmalarPage({ userId, onFirmaSelect, selectedFirmaId }: Props) {
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Firma | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('firmalar').select('*').order('ad')
    setFirmalar(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openModal(f?: Firma) {
    setEditing(f || null)
    setForm(f ? { ad:f.ad, vergi_no:(f as any).vergi_no||'', vergi_dairesi:(f as any).vergi_dairesi||'', adres:(f as any).adres||'', telefon:(f as any).telefon||'', email:(f as any).email||'', yetkili:(f as any).yetkili||'', notlar:(f as any).notlar||'' } : emptyForm)
    setError(''); setModal(true)
  }

  async function handleSave() {
    if (!form.ad.trim()) { setError('Firma adı zorunludur.'); return }
    const data = { ...form, user_id: userId, aktif: true }
    const { error: err } = editing
      ? await supabase.from('firmalar').update(data).eq('id', editing.id)
      : await supabase.from('firmalar').insert(data)
    if (err) { setError(err.message); return }
    setModal(false); fetch()
  }

  async function handleDelete(f: Firma) {
    if (!confirm(`"${f.ad}" firmasını silmek istediğinize emin misiniz?`)) return
    await supabase.from('firmalar').delete().eq('id', f.id)
    fetch()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Firmalar</h2>
          <p className="text-xs text-slate-400 mt-0.5">{firmalar.length} firma tanımlı</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={14} /> Firma Ekle
        </button>
      </div>

      {loading ? <p className="text-center text-slate-400 py-12 text-sm">Yükleniyor...</p> :
        firmalar.length === 0 ? (
          <div className="text-center py-16">
            <Building2 size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Henüz firma eklenmedi</p>
            <button onClick={() => openModal()} className="mt-3 text-blue-400 text-sm hover:underline">İlk firmayı ekle</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {firmalar.map(f => (
              <div key={f.id} className={`bg-white/[0.02] rounded-xl border p-4 cursor-pointer hover:border-blue-300 transition-all ${selectedFirmaId === f.id ? 'border-blue-400 ring-2 ring-blue-50' : 'border-white/[0.05]'}`}
                onClick={() => onFirmaSelect(f)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{f.ad}</p>
                      {f.vergi_no && <p className="text-xs text-slate-400 mt-0.5">VKN: {f.vergi_no}</p>}
                      {f.yetkili && <p className="text-xs text-slate-400">{f.yetkili}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openModal(f)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-white/[0.04] flex items-center justify-center text-slate-400 hover:text-slate-300"><Pencil size={12}/></button>
                    <button onClick={() => handleDelete(f)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-red-500/10 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.02]">
                  {f.telefon && <span className="text-xs text-slate-400">{f.telefon}</span>}
                  {f.email && <span className="text-xs text-slate-400">{f.email}</span>}
                  <span className="ml-auto text-blue-500 text-xs flex items-center gap-1">Detaylar <ChevronRight size={12}/></span>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={editing ? 'Firmayı Düzenle' : 'Yeni Firma Ekle'} onClose={() => setModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <FormField label="Firma Adı" required>
              <input className={inputCls} value={form.ad} onChange={e=>setForm({...form,ad:e.target.value})} placeholder="Firma adı" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Vergi No">
                <input className={inputCls} value={form.vergi_no} onChange={e=>setForm({...form,vergi_no:e.target.value})} placeholder="VKN" />
              </FormField>
              <FormField label="Vergi Dairesi">
                <input className={inputCls} value={form.vergi_dairesi} onChange={e=>setForm({...form,vergi_dairesi:e.target.value})} placeholder="Vergi dairesi" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Telefon">
                <input className={inputCls} value={form.telefon} onChange={e=>setForm({...form,telefon:e.target.value})} placeholder="0555 xxx xx xx" />
              </FormField>
              <FormField label="E-posta">
                <input className={inputCls} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="firma@mail.com" />
              </FormField>
            </div>
            <FormField label="Yetkili Kişi">
              <input className={inputCls} value={form.yetkili} onChange={e=>setForm({...form,yetkili:e.target.value})} placeholder="Ad Soyad" />
            </FormField>
            <FormField label="Adres">
              <input className={inputCls} value={form.adres} onChange={e=>setForm({...form,adres:e.target.value})} placeholder="Adres" />
            </FormField>
            <FormField label="Notlar">
              <textarea className={inputCls} rows={2} value={form.notlar} onChange={e=>setForm({...form,notlar:e.target.value})} placeholder="Opsiyonel not" />
            </FormField>
            {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}
