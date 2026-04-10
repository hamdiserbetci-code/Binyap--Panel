'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary, btnDanger } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ArrowLeft, Users } from 'lucide-react'

interface Props { firma: Firma; userId: string }

interface CariHesap {
  id: string; firma_id: string; ad: string; tur: 'musteri' | 'tedarikci'; bakiye: number
}
interface CariHareket {
  id: string; firma_id: string; cari_id: string; tarih: string; aciklama: string; borc: number; alacak: number
}

const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'

export default function CariHesapPage({ firma, userId }: Props) {
  const [hesaplar, setHesaplar] = useState<CariHesap[]>([])
  const [hareketler, setHareketler] = useState<CariHareket[]>([])
  const [selected, setSelected] = useState<CariHesap | null>(null)
  const [loading, setLoading] = useState(true)
  const [hesapModal, setHesapModal] = useState(false)
  const [hareketModal, setHareketModal] = useState(false)
  const [editingHesap, setEditingHesap] = useState<CariHesap | null>(null)
  const [editingHareket, setEditingHareket] = useState<CariHareket | null>(null)
  const [turFilter, setTurFilter] = useState<'hepsi' | 'musteri' | 'tedarikci'>('hepsi')
  const [hesapForm, setHesapForm] = useState({ ad: '', tur: 'musteri' as 'musteri' | 'tedarikci' })
  const [hareketForm, setHareketForm] = useState({ tarih: new Date().toISOString().split('T')[0], aciklama: '', borc: '', alacak: '' })

  const fetchHesaplar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id).order('ad')
    setHesaplar(data || [])
    setLoading(false)
  }, [firma.id])

  const fetchHareketler = useCallback(async (cariId: string) => {
    const { data } = await supabase.from('cari_hareketler').select('*').eq('cari_id', cariId).order('tarih', { ascending: false })
    setHareketler(data || [])
  }, [])

  useEffect(() => { fetchHesaplar() }, [fetchHesaplar])
  useEffect(() => { if (selected) fetchHareketler(selected.id) }, [selected, fetchHareketler])

  async function saveHesap() {
    if (!hesapForm.ad.trim()) return
    const payload = { firma_id: firma.id, ad: hesapForm.ad, tur: hesapForm.tur, bakiye: 0 }
    if (editingHesap) await supabase.from('cari_hesaplar').update({ ad: hesapForm.ad, tur: hesapForm.tur }).eq('id', editingHesap.id)
    else await supabase.from('cari_hesaplar').insert(payload)
    setHesapModal(false); fetchHesaplar()
  }

  async function saveHareket() {
    if (!hareketForm.aciklama.trim()) return
    const borc = parseFloat(hareketForm.borc) || 0
    const alacak = parseFloat(hareketForm.alacak) || 0
    const payload = { firma_id: firma.id, cari_id: selected!.id, tarih: hareketForm.tarih, aciklama: hareketForm.aciklama, borc, alacak }
    if (editingHareket) await supabase.from('cari_hareketler').update({ tarih: hareketForm.tarih, aciklama: hareketForm.aciklama, borc, alacak }).eq('id', editingHareket.id)
    else await supabase.from('cari_hareketler').insert(payload)
    // Update bakiye
    const { data: all } = await supabase.from('cari_hareketler').select('borc,alacak').eq('cari_id', selected!.id)
    const bakiye = (all || []).reduce((s, h) => s + h.alacak - h.borc, 0)
    await supabase.from('cari_hesaplar').update({ bakiye }).eq('id', selected!.id)
    setHareketModal(false); fetchHesaplar(); fetchHareketler(selected!.id)
  }

  async function delHesap(id: string) {
    if (!confirm('Bu hesap ve tüm hareketleri silinsin mi?')) return
    await supabase.from('cari_hareketler').delete().eq('cari_id', id)
    await supabase.from('cari_hesaplar').delete().eq('id', id)
    setSelected(null); fetchHesaplar()
  }

  async function delHareket(id: string) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('cari_hareketler').delete().eq('id', id)
    fetchHareketler(selected!.id); fetchHesaplar()
  }

  const filteredHesaplar = turFilter === 'hepsi' ? hesaplar : hesaplar.filter(h => h.tur === turFilter)

  if (selected) {
    const toplamBorc = hareketler.reduce((s, h) => s + h.borc, 0)
    const toplamAlacak = hareketler.reduce((s, h) => s + h.alacak, 0)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600"><ArrowLeft size={18}/></button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{selected.ad}</h2>
            <p className="text-xs text-slate-400">{selected.tur === 'musteri' ? 'Müşteri' : 'Tedarikçi'}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setEditingHareket(null); setHareketForm({ tarih: new Date().toISOString().split('T')[0], aciklama: '', borc: '', alacak: '' }); setHareketModal(true) }}
              className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Hareket Ekle</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-red-100 p-4">
            <p className="text-xs text-slate-500 mb-1">Toplam Borç</p>
            <p className="text-xl font-bold text-red-500">{fmt(toplamBorc)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 p-4">
            <p className="text-xs text-slate-500 mb-1">Toplam Alacak</p>
            <p className="text-xl font-bold text-emerald-600">{fmt(toplamAlacak)}</p>
          </div>
          <div className={`bg-white rounded-2xl border p-4 ${selected.bakiye >= 0 ? 'border-blue-100' : 'border-red-100'}`}>
            <p className="text-xs text-slate-500 mb-1">Bakiye</p>
            <p className={`text-xl font-bold ${selected.bakiye >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(selected.bakiye)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tarih</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Açıklama</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Borç</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Alacak</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {hareketler.map(h => (
                <tr key={h.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-xs text-slate-500">{h.tarih}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{h.aciklama}</td>
                  <td className="px-4 py-3 text-right text-red-500 font-semibold">{h.borc > 0 ? fmt(h.borc) : '-'}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{h.alacak > 0 ? fmt(h.alacak) : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditingHareket(h); setHareketForm({ tarih: h.tarih, aciklama: h.aciklama, borc: String(h.borc), alacak: String(h.alacak) }); setHareketModal(true) }} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={13}/></button>
                      <button onClick={() => delHareket(h.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {hareketler.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-300 text-sm">Hareket bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>

        {hareketModal && (
          <Modal title={editingHareket ? 'Hareket Düzenle' : 'Yeni Hareket'} onClose={() => setHareketModal(false)} footer={
            <><button className={btnSecondary} onClick={() => setHareketModal(false)}>İptal</button><button className={btnPrimary} onClick={saveHareket}>Kaydet</button></>
          }>
            <FormField label="Tarih"><input type="date" className={inputCls} value={hareketForm.tarih} onChange={e => setHareketForm(f => ({...f, tarih: e.target.value}))}/></FormField>
            <FormField label="Açıklama" required><input className={inputCls} value={hareketForm.aciklama} onChange={e => setHareketForm(f => ({...f, aciklama: e.target.value}))} autoFocus/></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Borç (₺)"><input type="number" className={inputCls} value={hareketForm.borc} onChange={e => setHareketForm(f => ({...f, borc: e.target.value}))} placeholder="0"/></FormField>
              <FormField label="Alacak (₺)"><input type="number" className={inputCls} value={hareketForm.alacak} onChange={e => setHareketForm(f => ({...f, alacak: e.target.value}))} placeholder="0"/></FormField>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">Cari Hesap</h2>
        <button onClick={() => { setEditingHesap(null); setHesapForm({ ad: '', tur: 'musteri' }); setHesapModal(true) }}
          className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Hesap Ekle</button>
      </div>

      <div className="flex gap-2">
        {(['hepsi', 'musteri', 'tedarikci'] as const).map(f => (
          <button key={f} onClick={() => setTurFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${turFilter === f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {f === 'hepsi' ? 'Tümü' : f === 'musteri' ? 'Müşteriler' : 'Tedarikçiler'}
          </button>
        ))}
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredHesaplar.map(h => (
            <div key={h.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-all cursor-pointer" onClick={() => setSelected(h)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${h.tur === 'musteri' ? 'bg-blue-50' : 'bg-amber-50'}`}>
                    <Users size={13} className={h.tur === 'musteri' ? 'text-blue-600' : 'text-amber-600'}/>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${h.tur === 'musteri' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                    {h.tur === 'musteri' ? 'Müşteri' : 'Tedarikçi'}
                  </span>
                </div>
                <button onClick={e => { e.stopPropagation(); delHesap(h.id) }} className="text-slate-200 hover:text-red-400"><Trash2 size={13}/></button>
              </div>
              <p className="font-semibold text-slate-800 text-sm mb-1">{h.ad}</p>
              <p className={`text-lg font-bold ${h.bakiye >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(h.bakiye)}</p>
            </div>
          ))}
          {filteredHesaplar.length === 0 && (
            <div className="col-span-3 text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-300 text-sm">Hesap bulunamadı</p>
            </div>
          )}
        </div>
      )}

      {hesapModal && (
        <Modal title="Yeni Cari Hesap" onClose={() => setHesapModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setHesapModal(false)}>İptal</button><button className={btnPrimary} onClick={saveHesap}>Kaydet</button></>
        }>
          <FormField label="Ad / Unvan" required><input className={inputCls} value={hesapForm.ad} onChange={e => setHesapForm(f => ({...f, ad: e.target.value}))} autoFocus/></FormField>
          <FormField label="Tür">
            <select className={inputCls} value={hesapForm.tur} onChange={e => setHesapForm(f => ({...f, tur: e.target.value as 'musteri' | 'tedarikci'}))}>
              <option value="musteri">Müşteri</option>
              <option value="tedarikci">Tedarikçi</option>
            </select>
          </FormField>
        </Modal>
      )}
    </div>
  )
}
