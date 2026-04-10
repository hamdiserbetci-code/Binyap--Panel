'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma, KarZarar } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

interface Props { firma: Firma; userId: string }

const AY = ['', 'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'

export default function KarZararPage({ firma, userId }: Props) {
  const [items, setItems] = useState<KarZarar[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<KarZarar | null>(null)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const yillar = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const empty = { donem: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`, gelir: '', gider: '', aciklama: '' }
  const [form, setForm] = useState<any>(empty)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('kar_zarar').select('*').eq('firma_id', firma.id)
      .gte('donem', `${selectedYil}-01`).lte('donem', `${selectedYil}-12`).order('donem')
    setItems(data || [])
    setLoading(false)
  }, [firma.id, selectedYil])

  useEffect(() => { fetch() }, [fetch])

  function openModal(item?: KarZarar) {
    setEditing(item || null)
    setForm(item ? { donem: item.donem, gelir: String(item.gelir), gider: String(item.gider), aciklama: item.aciklama || '' } : empty)
    setModal(true)
  }

  async function save() {
    const payload = { firma_id: firma.id, donem: form.donem, gelir: parseFloat(form.gelir)||0, gider: parseFloat(form.gider)||0, aciklama: form.aciklama }
    if (editing) await supabase.from('kar_zarar').update(payload).eq('id', editing.id)
    else await supabase.from('kar_zarar').insert(payload)
    setModal(false); fetch()
  }

  async function del(id: string) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('kar_zarar').delete().eq('id', id); fetch()
  }

  const toplamGelir = items.reduce((s, i) => s + i.gelir, 0)
  const toplamGider = items.reduce((s, i) => s + i.gider, 0)
  const net = toplamGelir - toplamGider

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">Kar / Zarar Takibi</h2>
        <div className="flex gap-2">
          <select value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))} className={inputCls + ' w-auto'}>
            {yillar.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => openModal()} className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Dönem Ekle</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Toplam Gelir', value: toplamGelir, icon: TrendingUp, color: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Toplam Gider', value: toplamGider, icon: TrendingDown, color: 'text-red-500', border: 'border-red-100' },
          { label: 'Net Kar/Zarar', value: net, icon: DollarSign, color: net >= 0 ? 'text-emerald-600' : 'text-red-500', border: net >= 0 ? 'border-emerald-100' : 'border-red-100' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-2xl border ${c.border} p-4`}>
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Dönem</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Gelir</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Gider</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Net</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Açıklama</th>
              <th className="px-4 py-3"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map(item => {
              const [yil, ay] = item.donem.split('-')
              const net = item.gelir - item.gider
              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">{AY[parseInt(ay)]} {yil}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{fmt(item.gelir)}</td>
                  <td className="px-4 py-3 text-right text-red-500 font-semibold">{fmt(item.gider)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(net)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{item.aciklama}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openModal(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={13}/></button>
                      <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="text-center py-10 text-slate-300 text-sm">Kayıt bulunamadı</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Dönem Düzenle' : 'Yeni Dönem'} onClose={() => setModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={save}>Kaydet</button></>
        }>
          <FormField label="Dönem (YYYY-AA)" required>
            <input type="month" className={inputCls} value={form.donem} onChange={e => setForm((f:any) => ({...f, donem: e.target.value}))}/>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Gelir (₺)">
              <input type="number" className={inputCls} value={form.gelir} onChange={e => setForm((f:any) => ({...f, gelir: e.target.value}))} placeholder="0"/>
            </FormField>
            <FormField label="Gider (₺)">
              <input type="number" className={inputCls} value={form.gider} onChange={e => setForm((f:any) => ({...f, gider: e.target.value}))} placeholder="0"/>
            </FormField>
          </div>
          <FormField label="Açıklama">
            <input className={inputCls} value={form.aciklama} onChange={e => setForm((f:any) => ({...f, aciklama: e.target.value}))} placeholder="Opsiyonel not"/>
          </FormField>
        </Modal>
      )}
    </div>
  )
}
