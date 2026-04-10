'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface Props { firma: Firma; userId: string }

interface OdemePlani {
  id: string; firma_id: string; baslik: string; tur: string; vade: string; tutar: number; durum: string; cek_no?: string
}

const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'
const TURLER = ['Çek', 'Senet', 'Havale', 'EFT', 'Nakit', 'Kredi Kartı', 'Diğer']

export default function OdemePlaniPage({ firma, userId }: Props) {
  const [items, setItems] = useState<OdemePlani[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<OdemePlani | null>(null)
  const [durumFilter, setDurumFilter] = useState<'hepsi' | 'bekleyen' | 'odendi' | 'gecikti'>('hepsi')
  const empty = { baslik: '', tur: 'Çek', vade: new Date().toISOString().split('T')[0], tutar: '', durum: 'bekleyen', cek_no: '' }
  const [form, setForm] = useState<any>(empty)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('odeme_plani').select('*').eq('firma_id', firma.id).order('vade')
    setItems(data || [])
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetchData() }, [fetchData])

  function openModal(item?: OdemePlani) {
    setEditing(item || null)
    setForm(item ? { baslik: item.baslik, tur: item.tur, vade: item.vade, tutar: String(item.tutar), durum: item.durum, cek_no: item.cek_no || '' } : empty)
    setModal(true)
  }

  async function save() {
    if (!form.baslik.trim()) return
    const payload = { firma_id: firma.id, baslik: form.baslik, tur: form.tur, vade: form.vade, tutar: parseFloat(form.tutar) || 0, durum: form.durum, cek_no: form.cek_no }
    if (editing) await supabase.from('odeme_plani').update(payload).eq('id', editing.id)
    else await supabase.from('odeme_plani').insert(payload)
    setModal(false); fetchData()
  }

  async function del(id: string) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('odeme_plani').delete().eq('id', id); fetchData()
  }

  async function markPaid(item: OdemePlani) {
    await supabase.from('odeme_plani').update({ durum: 'odendi' }).eq('id', item.id); fetchData()
  }

  const today = new Date().toISOString().split('T')[0]
  const filtered = items.filter(i => {
    if (durumFilter === 'bekleyen') return i.durum === 'bekleyen' && i.vade >= today
    if (durumFilter === 'odendi') return i.durum === 'odendi'
    if (durumFilter === 'gecikti') return i.durum === 'bekleyen' && i.vade < today
    return true
  })

  const toplamBekleyen = items.filter(i => i.durum === 'bekleyen').reduce((s, i) => s + i.tutar, 0)
  const toplamOdendi = items.filter(i => i.durum === 'odendi').reduce((s, i) => s + i.tutar, 0)
  const gecikti = items.filter(i => i.durum === 'bekleyen' && i.vade < today).length

  const DURUM_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    bekleyen: { label: 'Bekleyen', icon: Clock, cls: 'bg-amber-50 text-amber-600' },
    odendi:   { label: 'Ödendi', icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-600' },
    gecikti:  { label: 'Gecikti', icon: AlertCircle, cls: 'bg-red-50 text-red-600' },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">Ödeme Planı</h2>
        <button onClick={() => openModal()} className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Ödeme Ekle</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-amber-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Bekleyen Toplam</p>
          <p className="text-xl font-bold text-amber-600">{fmt(toplamBekleyen)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Ödenen Toplam</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(toplamOdendi)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Geciken Ödeme</p>
          <p className="text-xl font-bold text-red-500">{gecikti} adet</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['hepsi', 'bekleyen', 'gecikti', 'odendi'] as const).map(f => (
          <button key={f} onClick={() => setDurumFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${durumFilter === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {f === 'hepsi' ? 'Tümü' : f === 'bekleyen' ? 'Bekleyen' : f === 'gecikti' ? 'Geciken' : 'Ödenen'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Başlık</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tür</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Vade</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Tutar</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Durum</th>
              <th className="px-4 py-3"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">Yükleniyor...</td></tr> :
            filtered.map(item => {
              const isLate = item.durum === 'bekleyen' && item.vade < today
              const durumKey = isLate ? 'gecikti' : item.durum
              const cfg = DURUM_CONFIG[durumKey] || DURUM_CONFIG.bekleyen
              const Icon = cfg.icon
              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {item.baslik}
                    {item.cek_no && <span className="ml-2 text-[10px] text-slate-400">#{item.cek_no}</span>}
                  </td>
                  <td className="px-4 py-3"><span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.tur}</span></td>
                  <td className={`px-4 py-3 text-xs font-medium ${isLate ? 'text-red-500' : 'text-slate-600'}`}>{item.vade}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(item.tutar)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 w-fit ${cfg.cls}`}>
                      <Icon size={10}/>{cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {item.durum === 'bekleyen' && (
                        <button onClick={() => markPaid(item)} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-medium">Ödendi</button>
                      )}
                      <button onClick={() => openModal(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={13}/></button>
                      <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-300 text-sm">Kayıt bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Ödeme Düzenle' : 'Yeni Ödeme'} onClose={() => setModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={save}>Kaydet</button></>
        }>
          <FormField label="Başlık" required><input className={inputCls} value={form.baslik} onChange={e => setForm((f: any) => ({...f, baslik: e.target.value}))} autoFocus/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tür">
              <select className={inputCls} value={form.tur} onChange={e => setForm((f: any) => ({...f, tur: e.target.value}))}>
                {TURLER.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Vade Tarihi"><input type="date" className={inputCls} value={form.vade} onChange={e => setForm((f: any) => ({...f, vade: e.target.value}))}/></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tutar (₺)" required><input type="number" className={inputCls} value={form.tutar} onChange={e => setForm((f: any) => ({...f, tutar: e.target.value}))} placeholder="0"/></FormField>
            <FormField label="Çek No"><input className={inputCls} value={form.cek_no} onChange={e => setForm((f: any) => ({...f, cek_no: e.target.value}))} placeholder="Opsiyonel"/></FormField>
          </div>
          <FormField label="Durum">
            <select className={inputCls} value={form.durum} onChange={e => setForm((f: any) => ({...f, durum: e.target.value}))}>
              <option value="bekleyen">Bekleyen</option>
              <option value="odendi">Ödendi</option>
            </select>
          </FormField>
        </Modal>
      )}
    </div>
  )
}
