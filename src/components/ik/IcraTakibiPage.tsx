'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Props { firma: Firma; userId: string }

interface IcraTakibi {
  id: string; firma_id: string; ekip_id?: string; dosya_no: string; mahkeme: string; tutar: number; teblig_tarihi: string; durum: string; aciklama?: string
}

interface Ekip { id: string; ad_soyad: string }

const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'

const DURUM_CONFIG: Record<string, string> = {
  devam:     'bg-blue-50 text-blue-600',
  tamamlandi:'bg-emerald-50 text-emerald-600',
  iptal:     'bg-slate-100 text-slate-500',
  itiraz:    'bg-amber-50 text-amber-600',
}

export default function IcraTakibiPage({ firma, userId }: Props) {
  const [items, setItems] = useState<IcraTakibi[]>([])
  const [ekipler, setEkipler] = useState<Ekip[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<IcraTakibi | null>(null)
  const empty = { dosya_no: '', mahkeme: '', tutar: '', teblig_tarihi: new Date().toISOString().split('T')[0], durum: 'devam', ekip_id: '', aciklama: '' }
  const [form, setForm] = useState<any>(empty)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: i }, { data: e }] = await Promise.all([
      supabase.from('icra_takibi').select('*').eq('firma_id', firma.id).order('teblig_tarihi', { ascending: false }),
      supabase.from('ekipler').select('id,ad_soyad').eq('firma_id', firma.id),
    ])
    setItems(i || [])
    setEkipler(e || [])
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetchData() }, [fetchData])

  function openModal(item?: IcraTakibi) {
    setEditing(item || null)
    setForm(item ? { dosya_no: item.dosya_no, mahkeme: item.mahkeme, tutar: String(item.tutar), teblig_tarihi: item.teblig_tarihi, durum: item.durum, ekip_id: item.ekip_id || '', aciklama: item.aciklama || '' } : empty)
    setModal(true)
  }

  async function save() {
    if (!form.dosya_no.trim()) return
    const payload = { firma_id: firma.id, dosya_no: form.dosya_no, mahkeme: form.mahkeme, tutar: parseFloat(form.tutar) || 0, teblig_tarihi: form.teblig_tarihi, durum: form.durum, ekip_id: form.ekip_id || null, aciklama: form.aciklama }
    if (editing) await supabase.from('icra_takibi').update(payload).eq('id', editing.id)
    else await supabase.from('icra_takibi').insert(payload)
    setModal(false); fetchData()
  }

  async function del(id: string) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('icra_takibi').delete().eq('id', id); fetchData()
  }

  const toplamTutar = items.filter(i => i.durum === 'devam').reduce((s, i) => s + i.tutar, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">İcra Takibi</h2>
          <p className="text-xs text-slate-400 mt-0.5">{items.filter(i => i.durum === 'devam').length} aktif dosya · {fmt(toplamTutar)}</p>
        </div>
        <button onClick={() => openModal()} className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Dosya Ekle</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Dosya No</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Mahkeme</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Personel</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tebliğ Tarihi</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Tutar</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Durum</th>
              <th className="px-4 py-3"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">Yükleniyor...</td></tr> :
            items.map(item => {
              const ekip = ekipler.find(e => e.id === item.ekip_id)
              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{item.dosya_no}</td>
                  <td className="px-4 py-3 text-slate-600 text-sm">{item.mahkeme}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{ekip?.ad_soyad || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.teblig_tarihi}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(item.tutar)}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${DURUM_CONFIG[item.durum] || 'bg-slate-100 text-slate-600'}`}>{item.durum}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openModal(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={13}/></button>
                      <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && items.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-slate-300 text-sm">Dosya bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Dosya Düzenle' : 'Yeni İcra Dosyası'} onClose={() => setModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={save}>Kaydet</button></>
        }>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Dosya No" required><input className={inputCls} value={form.dosya_no} onChange={e => setForm((f: any) => ({...f, dosya_no: e.target.value}))} autoFocus/></FormField>
            <FormField label="Mahkeme"><input className={inputCls} value={form.mahkeme} onChange={e => setForm((f: any) => ({...f, mahkeme: e.target.value}))} placeholder="İcra Müdürlüğü"/></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={form.tutar} onChange={e => setForm((f: any) => ({...f, tutar: e.target.value}))} placeholder="0"/></FormField>
            <FormField label="Tebliğ Tarihi"><input type="date" className={inputCls} value={form.teblig_tarihi} onChange={e => setForm((f: any) => ({...f, teblig_tarihi: e.target.value}))}/></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Personel">
              <select className={inputCls} value={form.ekip_id} onChange={e => setForm((f: any) => ({...f, ekip_id: e.target.value}))}>
                <option value="">Seçin (Opsiyonel)</option>
                {ekipler.map(e => <option key={e.id} value={e.id}>{e.ad_soyad}</option>)}
              </select>
            </FormField>
            <FormField label="Durum">
              <select className={inputCls} value={form.durum} onChange={e => setForm((f: any) => ({...f, durum: e.target.value}))}>
                <option value="devam">Devam Ediyor</option>
                <option value="itiraz">İtiraz</option>
                <option value="tamamlandi">Tamamlandı</option>
                <option value="iptal">İptal</option>
              </select>
            </FormField>
          </div>
          <FormField label="Açıklama"><textarea className={inputCls} rows={2} value={form.aciklama} onChange={e => setForm((f: any) => ({...f, aciklama: e.target.value}))}/></FormField>
        </Modal>
      )}
    </div>
  )
}
