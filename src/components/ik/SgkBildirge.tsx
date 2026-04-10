'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Props { firma: Firma; userId: string }

interface SgkBildirgesi {
  id: string; firma_id: string; donem: string; bildirge_no: string; gonderim_tarihi: string; durum: string; tutar: number
}

const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'
const AY = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const DURUM_CONFIG: Record<string, { label: string; cls: string }> = {
  gonderildi: { label: 'Gönderildi', cls: 'bg-emerald-50 text-emerald-600' },
  bekleyen:   { label: 'Bekleyen',   cls: 'bg-amber-50 text-amber-600' },
  iptal:      { label: 'İptal',      cls: 'bg-red-50 text-red-600' },
}

export default function SgkBildirge({ firma, userId }: Props) {
  const [items, setItems] = useState<SgkBildirgesi[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<SgkBildirgesi | null>(null)
  const empty = { donem: new Date().toISOString().slice(0, 7), bildirge_no: '', gonderim_tarihi: '', durum: 'bekleyen', tutar: '' }
  const [form, setForm] = useState<any>(empty)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sgk_bildirgeler').select('*').eq('firma_id', firma.id).order('donem', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetchData() }, [fetchData])

  function openModal(item?: SgkBildirgesi) {
    setEditing(item || null)
    setForm(item ? { donem: item.donem, bildirge_no: item.bildirge_no, gonderim_tarihi: item.gonderim_tarihi || '', durum: item.durum, tutar: String(item.tutar) } : empty)
    setModal(true)
  }

  async function save() {
    const payload = { firma_id: firma.id, donem: form.donem, bildirge_no: form.bildirge_no, gonderim_tarihi: form.gonderim_tarihi || null, durum: form.durum, tutar: parseFloat(form.tutar) || 0 }
    if (editing) await supabase.from('sgk_bildirgeler').update(payload).eq('id', editing.id)
    else await supabase.from('sgk_bildirgeler').insert(payload)
    setModal(false); fetchData()
  }

  async function del(id: string) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('sgk_bildirgeler').delete().eq('id', id); fetchData()
  }

  const toplamTutar = items.filter(i => i.durum === 'gonderildi').reduce((s, i) => s + i.tutar, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">SGK Bildirgesi</h2>
          <p className="text-xs text-slate-400 mt-0.5">{items.length} bildirge · {fmt(toplamTutar)} gönderildi</p>
        </div>
        <button onClick={() => openModal()} className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Bildirge Ekle</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Dönem</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Bildirge No</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Gönderim Tarihi</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Tutar</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Durum</th>
              <th className="px-4 py-3"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">Yükleniyor...</td></tr> :
            items.map(item => {
              const [y, m] = item.donem.split('-')
              const cfg = DURUM_CONFIG[item.durum] || DURUM_CONFIG.bekleyen
              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">{AY[parseInt(m)]} {y}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">{item.bildirge_no || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.gonderim_tarihi || '-'}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(item.tutar)}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openModal(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={13}/></button>
                      <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-300 text-sm">Bildirge bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Bildirge Düzenle' : 'Yeni Bildirge'} onClose={() => setModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={save}>Kaydet</button></>
        }>
          <FormField label="Dönem" required><input type="month" className={inputCls} value={form.donem} onChange={e => setForm((f: any) => ({...f, donem: e.target.value}))}/></FormField>
          <FormField label="Bildirge No"><input className={inputCls} value={form.bildirge_no} onChange={e => setForm((f: any) => ({...f, bildirge_no: e.target.value}))} placeholder="Opsiyonel"/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Gönderim Tarihi"><input type="date" className={inputCls} value={form.gonderim_tarihi} onChange={e => setForm((f: any) => ({...f, gonderim_tarihi: e.target.value}))}/></FormField>
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={form.tutar} onChange={e => setForm((f: any) => ({...f, tutar: e.target.value}))} placeholder="0"/></FormField>
          </div>
          <FormField label="Durum">
            <select className={inputCls} value={form.durum} onChange={e => setForm((f: any) => ({...f, durum: e.target.value}))}>
              <option value="bekleyen">Bekleyen</option>
              <option value="gonderildi">Gönderildi</option>
              <option value="iptal">İptal</option>
            </select>
          </FormField>
        </Modal>
      )}
    </div>
  )
}
