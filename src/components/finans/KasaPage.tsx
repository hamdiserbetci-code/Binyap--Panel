'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

interface Props { firma: Firma; userId: string }

interface KasaHareket {
  id: string
  firma_id: string
  tarih: string
  aciklama: string
  tur: 'giris' | 'cikis'
  tutar: number
  bakiye: number
  kategori: string
}

const KATEGORILER = ['Satış', 'Tahsilat', 'Alım', 'Gider', 'Maaş', 'Vergi', 'Kira', 'Diğer']
const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'

export default function KasaPage({ firma, userId }: Props) {
  const [items, setItems] = useState<KasaHareket[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<KasaHareket | null>(null)
  const [turFilter, setTurFilter] = useState<'hepsi' | 'giris' | 'cikis'>('hepsi')
  const empty = { tarih: new Date().toISOString().split('T')[0], aciklama: '', tur: 'giris' as const, tutar: '', kategori: 'Diğer' }
  const [form, setForm] = useState<any>(empty)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('kasa').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }).order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetchData() }, [fetchData])

  function openModal(item?: KasaHareket) {
    setEditing(item || null)
    setForm(item ? { tarih: item.tarih, aciklama: item.aciklama, tur: item.tur, tutar: String(item.tutar), kategori: item.kategori } : empty)
    setModal(true)
  }

  async function save() {
    if (!form.aciklama.trim() || !form.tutar) return
    const tutar = parseFloat(form.tutar)
    // Calculate running bakiye
    const { data: last } = await supabase.from('kasa').select('bakiye').eq('firma_id', firma.id).order('tarih', { ascending: false }).order('created_at', { ascending: false }).limit(1)
    const prevBakiye = last && last.length > 0 ? last[0].bakiye : 0
    const bakiye = form.tur === 'giris' ? prevBakiye + tutar : prevBakiye - tutar
    const payload = { firma_id: firma.id, tarih: form.tarih, aciklama: form.aciklama, tur: form.tur, tutar, bakiye, kategori: form.kategori }
    if (editing) await supabase.from('kasa').update({ tarih: form.tarih, aciklama: form.aciklama, tur: form.tur, tutar, kategori: form.kategori }).eq('id', editing.id)
    else await supabase.from('kasa').insert(payload)
    setModal(false); fetchData()
  }

  async function del(id: string) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('kasa').delete().eq('id', id); fetchData()
  }

  const filtered = turFilter === 'hepsi' ? items : items.filter(i => i.tur === turFilter)
  const toplamGiris = items.filter(i => i.tur === 'giris').reduce((s, i) => s + i.tutar, 0)
  const toplamCikis = items.filter(i => i.tur === 'cikis').reduce((s, i) => s + i.tutar, 0)
  const mevcutBakiye = items.length > 0 ? items[0].bakiye : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">Kasa</h2>
        <button onClick={() => openModal()} className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Hareket Ekle</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-emerald-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Giriş</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(toplamGiris)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Çıkış</p>
          <p className="text-xl font-bold text-red-500">{fmt(toplamCikis)}</p>
        </div>
        <div className={`bg-white rounded-2xl border p-4 ${mevcutBakiye >= 0 ? 'border-blue-100' : 'border-red-100'}`}>
          <p className="text-xs text-slate-500 mb-1">Mevcut Bakiye</p>
          <p className={`text-xl font-bold ${mevcutBakiye >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(mevcutBakiye)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['hepsi', 'giris', 'cikis'] as const).map(f => (
          <button key={f} onClick={() => setTurFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${turFilter === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {f === 'hepsi' ? 'Tümü' : f === 'giris' ? 'Girişler' : 'Çıkışlar'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tarih</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Açıklama</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Kategori</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Tutar</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Bakiye</th>
              <th className="px-4 py-3"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">Yükleniyor...</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-xs text-slate-500">{item.tarih}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {item.tur === 'giris' ? <ArrowUpCircle size={14} className="text-emerald-500 flex-shrink-0"/> : <ArrowDownCircle size={14} className="text-red-400 flex-shrink-0"/>}
                    <span className="font-medium text-slate-700">{item.aciklama}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.kategori}</span></td>
                <td className={`px-4 py-3 text-right font-semibold ${item.tur === 'giris' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {item.tur === 'giris' ? '+' : '-'}{fmt(item.tutar)}
                </td>
                <td className="px-4 py-3 text-right text-slate-700 font-medium text-xs">{fmt(item.bakiye)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openModal(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={13}/></button>
                    <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-300 text-sm">Kayıt bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Hareket Düzenle' : 'Yeni Hareket'} onClose={() => setModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={save}>Kaydet</button></>
        }>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tür">
              <select className={inputCls} value={form.tur} onChange={e => setForm((f: any) => ({...f, tur: e.target.value}))}>
                <option value="giris">Giriş</option>
                <option value="cikis">Çıkış</option>
              </select>
            </FormField>
            <FormField label="Tarih">
              <input type="date" className={inputCls} value={form.tarih} onChange={e => setForm((f: any) => ({...f, tarih: e.target.value}))}/>
            </FormField>
          </div>
          <FormField label="Açıklama" required>
            <input className={inputCls} value={form.aciklama} onChange={e => setForm((f: any) => ({...f, aciklama: e.target.value}))} autoFocus/>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tutar (₺)" required>
              <input type="number" className={inputCls} value={form.tutar} onChange={e => setForm((f: any) => ({...f, tutar: e.target.value}))} placeholder="0"/>
            </FormField>
            <FormField label="Kategori">
              <select className={inputCls} value={form.kategori} onChange={e => setForm((f: any) => ({...f, kategori: e.target.value}))}>
                {KATEGORILER.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
