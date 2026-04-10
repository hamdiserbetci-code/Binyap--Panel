'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma, GunlukIs } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Trash2, CheckCircle2, Circle, Star } from 'lucide-react'

interface Props { firma: Firma; userId: string }

const ONCELIK_COLORS: Record<string, string> = {
  yuksek: 'bg-red-50 text-red-600 border-red-200',
  orta:   'bg-amber-50 text-amber-600 border-amber-200',
  dusuk:  'bg-slate-50 text-slate-500 border-slate-200',
}
const ONCELIK_LABEL: Record<string, string> = { yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' }

export default function GunlukIslerPage({ firma, userId }: Props) {
  const [items, setItems] = useState<GunlukIs[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [filtre, setFiltre] = useState<'hepsi' | 'bekleyen' | 'tamamlandi'>('bekleyen')
  const [form, setForm] = useState({ baslik: '', oncelik: 'orta', tarih: new Date().toISOString().split('T')[0] })

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('gunluk_isler').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }).order('oncelik')
    setItems(data || [])
    setLoading(false)
  }, [firma.id])

  useEffect(() => { fetch() }, [fetch])

  async function toggle(item: GunlukIs) {
    await supabase.from('gunluk_isler').update({ tamamlandi: !item.tamamlandi }).eq('id', item.id)
    fetch()
  }

  async function del(id: string) {
    await supabase.from('gunluk_isler').delete().eq('id', id)
    fetch()
  }

  async function add() {
    if (!form.baslik.trim()) return
    await supabase.from('gunluk_isler').insert({ ...form, firma_id: firma.id, user_id: userId, tamamlandi: false })
    setModal(false)
    setForm({ baslik: '', oncelik: 'orta', tarih: new Date().toISOString().split('T')[0] })
    fetch()
  }

  const filtered = items.filter(i => {
    if (filtre === 'bekleyen') return !i.tamamlandi
    if (filtre === 'tamamlandi') return i.tamamlandi
    return true
  })

  const bekleyen = items.filter(i => !i.tamamlandi).length
  const tamamlandi = items.filter(i => i.tamamlandi).length

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Günlük İşler</h2>
          <p className="text-xs text-slate-400 mt-0.5">{bekleyen} bekleyen · {tamamlandi} tamamlandı</p>
        </div>
        <button onClick={() => setModal(true)} className={btnPrimary + ' flex items-center gap-1.5'}>
          <Plus size={14}/> Görev Ekle
        </button>
      </div>

      <div className="flex gap-2">
        {(['bekleyen', 'hepsi', 'tamamlandi'] as const).map(f => (
          <button key={f} onClick={() => setFiltre(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filtre === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {f === 'bekleyen' ? 'Bekleyen' : f === 'tamamlandi' ? 'Tamamlanan' : 'Tümü'}
          </button>
        ))}
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
          <CheckCircle2 size={32} className="text-slate-200 mx-auto mb-2"/>
          <p className="text-slate-400 text-sm">Görev bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${item.tamamlandi ? 'opacity-60 border-slate-100' : 'border-slate-200 hover:border-slate-300'}`}>
              <button onClick={() => toggle(item)} className="flex-shrink-0">
                {item.tamamlandi ? <CheckCircle2 size={20} className="text-emerald-500"/> : <Circle size={20} className="text-slate-300 hover:text-blue-400"/>}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.tamamlandi ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.baslik}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.tarih}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ONCELIK_COLORS[item.oncelik]}`}>
                {ONCELIK_LABEL[item.oncelik]}
              </span>
              <button onClick={() => del(item.id)} className="text-slate-300 hover:text-red-400 flex-shrink-0">
                <Trash2 size={14}/>
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title="Yeni Görev" onClose={() => setModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={add}>Ekle</button></>
        }>
          <FormField label="Görev Başlığı" required>
            <input className={inputCls} value={form.baslik} onChange={e => setForm(f => ({...f, baslik: e.target.value}))} placeholder="Yapılacak iş..." autoFocus/>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tarih">
              <input type="date" className={inputCls} value={form.tarih} onChange={e => setForm(f => ({...f, tarih: e.target.value}))}/>
            </FormField>
            <FormField label="Öncelik">
              <select className={inputCls} value={form.oncelik} onChange={e => setForm(f => ({...f, oncelik: e.target.value}))}>
                <option value="yuksek">Yüksek</option>
                <option value="orta">Orta</option>
                <option value="dusuk">Düşük</option>
              </select>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
