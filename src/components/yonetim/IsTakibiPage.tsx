'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma, IsTakibi } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ClipboardList } from 'lucide-react'

interface Props { firma: Firma; userId: string }

const DURUM_COLS = [
  { id: 'beklemede', label: 'Beklemede', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { id: 'devam',     label: 'Devam Ediyor', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'tamamlandi', label: 'Tamamlandı', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
]
const ONCELIK_COLOR: Record<string, string> = {
  yuksek: 'bg-red-100 text-red-600', orta: 'bg-amber-100 text-amber-600', dusuk: 'bg-slate-100 text-slate-500'
}

export default function IsTakibiPage({ firma, userId }: Props) {
  const [items, setItems] = useState<IsTakibi[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<IsTakibi | null>(null)
  const empty = { baslik: '', durum: 'beklemede', oncelik: 'orta', baslangic: '', bitis: '', sorumlu: '' }
  const [form, setForm] = useState<any>(empty)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('is_takibi').select('*').eq('firma_id', firma.id).order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetch() }, [fetch])

  function openModal(item?: IsTakibi) {
    setEditing(item || null)
    setForm(item ? { baslik: item.baslik, durum: item.durum, oncelik: item.oncelik, baslangic: item.baslangic || '', bitis: item.bitis || '', sorumlu: item.sorumlu || '' } : empty)
    setModal(true)
  }

  async function save() {
    if (!form.baslik.trim()) return
    const payload = { ...form, firma_id: firma.id }
    if (editing) await supabase.from('is_takibi').update(payload).eq('id', editing.id)
    else await supabase.from('is_takibi').insert(payload)
    setModal(false); fetch()
  }

  async function del(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('is_takibi').delete().eq('id', id); fetch()
  }

  async function changeStatus(item: IsTakibi, durum: string) {
    await supabase.from('is_takibi').update({ durum }).eq('id', item.id); fetch()
  }

  if (loading) return <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">İş Takibi</h2>
        <button onClick={() => openModal()} className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> İş Ekle</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {DURUM_COLS.map(col => {
          const colItems = items.filter(i => i.durum === col.id)
          return (
            <div key={col.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className={`px-4 py-3 border-b ${col.color} flex items-center justify-between`}>
                <span className="text-xs font-bold uppercase tracking-wide">{col.label}</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-white/70 rounded-full">{colItems.length}</span>
              </div>
              <div className="p-3 space-y-2 min-h-[120px]">
                {colItems.map(item => (
                  <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-slate-700 leading-snug">{item.baslik}</p>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openModal(item)} className="text-slate-300 hover:text-blue-500"><Pencil size={12}/></button>
                        <button onClick={() => del(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ONCELIK_COLOR[item.oncelik]}`}>{item.oncelik}</span>
                      {item.sorumlu && <span className="text-[10px] text-slate-400">{item.sorumlu}</span>}
                      {item.bitis && <span className="text-[10px] text-slate-400">→ {item.bitis}</span>}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {DURUM_COLS.filter(d => d.id !== col.id).map(d => (
                        <button key={d.id} onClick={() => changeStatus(item, d.id)}
                          className="text-[9px] px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-slate-600">
                          → {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {colItems.length === 0 && <p className="text-center text-slate-300 text-xs py-4">Boş</p>}
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <Modal title={editing ? 'İş Düzenle' : 'Yeni İş'} onClose={() => setModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={save}>Kaydet</button></>
        }>
          <FormField label="Başlık" required>
            <input className={inputCls} value={form.baslik} onChange={e => setForm((f:any) => ({...f, baslik: e.target.value}))} autoFocus/>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Durum">
              <select className={inputCls} value={form.durum} onChange={e => setForm((f:any) => ({...f, durum: e.target.value}))}>
                <option value="beklemede">Beklemede</option>
                <option value="devam">Devam Ediyor</option>
                <option value="tamamlandi">Tamamlandı</option>
              </select>
            </FormField>
            <FormField label="Öncelik">
              <select className={inputCls} value={form.oncelik} onChange={e => setForm((f:any) => ({...f, oncelik: e.target.value}))}>
                <option value="yuksek">Yüksek</option>
                <option value="orta">Orta</option>
                <option value="dusuk">Düşük</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Başlangıç"><input type="date" className={inputCls} value={form.baslangic} onChange={e => setForm((f:any) => ({...f, baslangic: e.target.value}))}/></FormField>
            <FormField label="Bitiş"><input type="date" className={inputCls} value={form.bitis} onChange={e => setForm((f:any) => ({...f, bitis: e.target.value}))}/></FormField>
          </div>
          <FormField label="Sorumlu">
            <input className={inputCls} value={form.sorumlu} onChange={e => setForm((f:any) => ({...f, sorumlu: e.target.value}))} placeholder="Ad Soyad"/>
          </FormField>
        </Modal>
      )}
    </div>
  )
}
