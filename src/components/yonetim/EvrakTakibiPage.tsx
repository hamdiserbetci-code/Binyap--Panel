'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma, Evrak } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, FolderOpen, ExternalLink } from 'lucide-react'

interface Props { firma: Firma; userId: string }

const KATEGORILER = ['Sözleşme', 'Fatura', 'Makbuz', 'Teklif', 'Hakediş', 'Teminat', 'İzin Belgesi', 'SGK', 'Vergi', 'Diğer']
const KAT_COLOR: Record<string, string> = {
  'Sözleşme': 'bg-blue-50 text-blue-700', 'Fatura': 'bg-amber-50 text-amber-700',
  'Hakediş': 'bg-emerald-50 text-emerald-700', 'Teminat': 'bg-violet-50 text-violet-700',
  'SGK': 'bg-teal-50 text-teal-700', 'Vergi': 'bg-red-50 text-red-700',
}

export default function EvrakTakibiPage({ firma, userId }: Props) {
  const [items, setItems] = useState<Evrak[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Evrak | null>(null)
  const [searchKat, setSearchKat] = useState('hepsi')
  const empty = { ad: '', kategori: KATEGORILER[0], tarih: new Date().toISOString().split('T')[0], dosya_url: '', notlar: '' }
  const [form, setForm] = useState<any>(empty)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('evraklar').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetch() }, [fetch])

  function openModal(item?: Evrak) {
    setEditing(item || null)
    setForm(item ? { ad: item.ad, kategori: item.kategori, tarih: item.tarih, dosya_url: item.dosya_url || '', notlar: item.notlar || '' } : empty)
    setModal(true)
  }

  async function save() {
    if (!form.ad.trim()) return
    const payload = { ...form, firma_id: firma.id }
    if (editing) await supabase.from('evraklar').update(payload).eq('id', editing.id)
    else await supabase.from('evraklar').insert(payload)
    setModal(false); fetch()
  }

  async function del(id: string) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('evraklar').delete().eq('id', id); fetch()
  }

  const filtered = searchKat === 'hepsi' ? items : items.filter(i => i.kategori === searchKat)
  const kategoriler = Array.from(new Set(items.map(i => i.kategori)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">Evrak Takibi</h2>
        <button onClick={() => openModal()} className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Evrak Ekle</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSearchKat('hepsi')} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${searchKat === 'hepsi' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Tümü ({items.length})</button>
        {kategoriler.map(k => (
          <button key={k} onClick={() => setSearchKat(k)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${searchKat === k ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {k} ({items.filter(i => i.kategori === k).length})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Evrak Adı</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Kategori</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tarih</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Not</th>
              <th className="px-4 py-3"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={14} className="text-slate-300 flex-shrink-0"/>
                    <span className="font-medium text-slate-700">{item.ad}</span>
                    {item.dosya_url && <a href={item.dosya_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600"><ExternalLink size={12}/></a>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${KAT_COLOR[item.kategori] || 'bg-slate-100 text-slate-600'}`}>{item.kategori}</span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{item.tarih}</td>
                <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[160px]">{item.notlar}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openModal(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={13}/></button>
                    <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-300 text-sm">Evrak bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Evrak Düzenle' : 'Yeni Evrak'} onClose={() => setModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={save}>Kaydet</button></>
        }>
          <FormField label="Evrak Adı" required>
            <input className={inputCls} value={form.ad} onChange={e => setForm((f:any) => ({...f, ad: e.target.value}))} autoFocus placeholder="Sözleşme - Proje A"/>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Kategori">
              <select className={inputCls} value={form.kategori} onChange={e => setForm((f:any) => ({...f, kategori: e.target.value}))}>
                {KATEGORILER.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </FormField>
            <FormField label="Tarih">
              <input type="date" className={inputCls} value={form.tarih} onChange={e => setForm((f:any) => ({...f, tarih: e.target.value}))}/>
            </FormField>
          </div>
          <FormField label="Dosya URL">
            <input className={inputCls} value={form.dosya_url} onChange={e => setForm((f:any) => ({...f, dosya_url: e.target.value}))} placeholder="https://..."/>
          </FormField>
          <FormField label="Notlar">
            <textarea className={inputCls} rows={2} value={form.notlar} onChange={e => setForm((f:any) => ({...f, notlar: e.target.value}))} placeholder="Opsiyonel açıklama"/>
          </FormField>
        </Modal>
      )}
    </div>
  )
}
