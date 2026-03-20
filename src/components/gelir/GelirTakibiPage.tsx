'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma, Proje, AY_LABELS } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'

interface Props { userId: string; firma: Firma }

export default function GelirTakibiPage({ userId, firma }: Props) {
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [selectedProje, setSelectedProje] = useState<Proje | null>(null)
  const [gelirler, setGelirler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ baslik:'', tutar:'', vade_tarihi:'', durum:'beklemede', aciklama:'', tur:'hakedis' })
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())

  const fetchProjeler = useCallback(async () => {
    const { data } = await supabase.from('projeler').select('id,ad,firma_id').eq('firma_id', firma.id).order('ad')
    setProjeler((data as Proje[]) || [])
    if (!selectedProje && data?.length) setSelectedProje((data as Proje[])[0])
  }, [firma.id, selectedProje])

  const fetchGelirler = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('odeme_plani').select('*')
      .eq('firma_id', firma.id).in('tur', ['hakedis', 'diger_satis'])
      .order('vade_tarihi', { ascending: true })
    if (selectedProje) query = query.eq('proje_id', selectedProje.id)
    const { data } = await query
    setGelirler(data || [])
    setLoading(false)
  }, [firma.id, selectedProje])

  useEffect(() => { fetchProjeler() }, [fetchProjeler])
  useEffect(() => { fetchGelirler() }, [fetchGelirler])

  function openModal(g?: any) {
    setEditing(g || null)
    setForm(g ? {
      baslik: g.baslik || '', tutar: String(g.tutar || ''), vade_tarihi: g.vade_tarihi || '',
      durum: g.durum || 'beklemede', aciklama: g.aciklama || '', tur: g.tur || 'hakedis'
    } : { baslik:'', tutar:'', vade_tarihi:'', durum:'beklemede', aciklama:'', tur:'hakedis' })
    setModal(true)
  }

  async function handleSave() {
    if (!selectedProje) return
    if (!form.baslik || !form.vade_tarihi || !form.tutar) return

    const payload: any = {
      baslik: form.baslik,
      tur: 'gelir',
      tutar: parseFloat(form.tutar) || 0,
      vade_tarihi: form.vade_tarihi,
      durum: form.durum,
      aciklama: form.aciklama,
      proje_id: selectedProje.id,
      firma_id: firma.id,
      user_id: userId
    }

    if (editing) await supabase.from('odeme_plani').update(payload).eq('id', editing.id)
    else await supabase.from('odeme_plani').insert(payload)

    setModal(false)
    fetchGelirler()
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu geliri silmek istediğinize emin misiniz?')) return
    await supabase.from('odeme_plani').delete().eq('id', id)
    fetchGelirler()
  }

  async function markPaid(item: any) {
    await supabase.from('odeme_plani').update({ durum: 'odendi', odeme_tarihi: new Date().toISOString().split('T')[0] }).eq('id', item.id)
    fetchGelirler()
  }

  const toplamGelir = gelirler.reduce((sum, o) => sum + (o.tutar || 0), 0)
  const odendi = gelirler.filter(o => o.durum === 'odendi').reduce((sum, o) => sum + (o.tutar || 0), 0)
  const bekleyen = gelirler.filter(o => o.durum === 'beklemede').reduce((sum, o) => sum + (o.tutar || 0), 0)

  const fmt = (v:number) => v.toLocaleString('tr-TR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' ₺'

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Gelir Takibi</h2>
          <p className="text-xs text-slate-400 mt-0.5">{firma.ad} — {AY_LABELS[selectedAy]} {selectedYil}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedProje?.id || ''} onChange={e => setSelectedProje(projeler.find(p => p.id === e.target.value) || null)}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm">
            <option value="">Tüm projeler</option>
            {projeler.map(p => <option key={p.id} value={p.id}>{p.ad}</option>)}
          </select>
          <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            Gelir Ekle
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs">
          {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option> })}
        </select>
        {AY_LABELS.slice(1).map((ay,i)=>(
          <button key={i} onClick={() => setSelectedAy(i+1)} className={`px-3 py-1.5 rounded-xl text-xs ${selectedAy === i+1 ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
            {ay}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">Toplam Gelir</p>
          <p className="text-2xl font-bold text-emerald-500">{fmt(toplamGelir)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">Tahsil Edilen</p>
          <p className="text-2xl font-bold text-blue-600">{fmt(odendi)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-400">Bekleyen</p>
          <p className="text-2xl font-bold text-amber-500">{fmt(bekleyen)}</p>
        </div>
      </div>

      {!selectedProje ? (
        <div className="p-5 bg-white/5 rounded-xl border border-dashed border-slate-700 text-slate-300">Proje seçiniz.</div>
      ) : loading ? (
        <p className="text-slate-400 text-sm">Yükleniyor...</p>
      ) : gelirler.length === 0 ? (
        <div className="text-center py-10 bg-white/5 rounded-xl border border-dashed border-slate-700">
          <p className="text-slate-400">Kayıt bulunamadı</p>
        </div>
      ) : (
        <div className="bg-white/5 rounded-xl border border-slate-700 overflow-hidden">
          <div className="grid grid-cols-7 gap-2 bg-slate-900/70 text-slate-300 text-xs font-medium px-3 py-2">
            <div>Tarih</div><div>Açıklama</div><div className="text-right">Tutar</div><div>Durum</div><div>Ödeme</div><div className="col-span-2 text-center">İşlemler</div>
          </div>
          {gelirler.map((o:any) => (
            <div key={o.id} className="grid grid-cols-7 gap-2 px-3 py-2 border-b border-slate-800 text-sm text-slate-100 items-center">
              <div>{o.vade_tarihi || '-'}</div>
              <div className="truncate">{o.baslik || o.aciklama || '-'}</div>
              <div className="text-right font-semibold">{fmt(o.tutar || 0)}</div>
              <div>{o.durum}</div>
              <div>{o.odeme_tarihi || '-'}</div>
              <div className="flex items-center justify-center gap-1">
                {o.durum !== 'odendi' && (
                  <button onClick={() => markPaid(o)} className="px-2 py-1 text-[11px] bg-emerald-500/15 text-emerald-200 rounded-lg">Ödendi</button>
                )}
              </div>
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => openModal(o)} className="px-2 py-1 text-[11px] bg-blue-500/15 text-blue-200 rounded-lg">Düzenle</button>
                <button onClick={() => handleDelete(o.id)} className="px-2 py-1 text-[11px] bg-red-500/15 text-red-200 rounded-lg">Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editing ? 'Geliri Düzenle' : 'Gelir Ekle'} onClose={() => setModal(false)}
          footer={
            <>
              <button className={btnSecondary} onClick={() => setModal(false)}>İptal</button>
              <button className={btnPrimary} onClick={handleSave}>Kaydet</button>
            </>
          }>
          <div className="space-y-3">
            <FormField label="Başlık" required>
              <input className={inputCls} value={form.baslik} onChange={e=>setForm({...form,baslik:e.target.value})} placeholder="Gelir başlığı" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tutar (₺)" required>
                <input type="number" className={inputCls} value={form.tutar} onChange={e=>setForm({...form,tutar:e.target.value})} placeholder="0.00" />
              </FormField>
              <FormField label="Vade Tarihi" required>
                <input type="date" className={inputCls} value={form.vade_tarihi} onChange={e=>setForm({...form,vade_tarihi:e.target.value})} />
              </FormField>
            </div>
            <FormField label="Tür" required> 
              <select className={inputCls} value={form.tur} onChange={e=>setForm({...form,tur:e.target.value})}>
                <option value="hakedis">Hakediş</option>
                <option value="diger_satis">Diğer Satış</option>
              </select>
            </FormField>
            <FormField label="Durum"> 
              <select className={inputCls} value={form.durum} onChange={e=>setForm({...form,durum:e.target.value})}>
                <option value="beklemede">Beklemede</option>
                <option value="odendi">Ödendi</option>
                <option value="gecikti">Gecikti</option>
                <option value="iptal">İptal</option>
              </select>
            </FormField>
            <FormField label="Açıklama">
              <textarea className={inputCls} rows={3} value={form.aciklama} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Açıklama" />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

