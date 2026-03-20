'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, CheckCircle, TrendingDown } from 'lucide-react'

interface Gider {
  id: string; kategori: string; tarih: string; tutar: number
  aciklama?: string; belge_no?: string; odeme_durumu: string; odeme_tarihi?: string
}

interface Props { userId: string }

const KATEGORILER = [
  'Nakliye Giderleri',
  'Malzeme Alış Giderleri',
  'Kiralama Giderleri',
  'Personel Ücretleri',
  'SGK Ödemeleri',
  'Muhtasar Ödemeleri',
  'Muhasebe Ödemeleri',
  'SMMM Ödemeleri',
  'Arabuluculuk Giderleri',
  'Poliçe Giderleri',
  'Avans Ödemeleri',
  'Geçici Vergi Ödemeleri',
  'Kurumlar Vergisi Ödemeleri',
  'MTV Ödemeleri',
  'Trafik Cezaları',
  'Diğer',
]

const KAT_COLORS: Record<string, string> = {
  'Nakliye Giderleri': 'bg-blue-500/10 text-blue-300',
  'Malzeme Alış Giderleri': 'bg-orange-50 text-orange-700',
  'Kiralama Giderleri': 'bg-purple-500/10 text-purple-700',
  'Personel Ücretleri': 'bg-emerald-500/10 text-emerald-300',
  'SGK Ödemeleri': 'bg-teal-50 text-teal-700',
  'Muhtasar Ödemeleri': 'bg-red-500/10 text-red-700',
  'Muhasebe Ödemeleri': 'bg-indigo-500/10 text-indigo-700',
  'SMMM Ödemeleri': 'bg-violet-500/10 text-violet-700',
  'Arabuluculuk Giderleri': 'bg-amber-500/10 text-amber-300',
  'Poliçe Giderleri': 'bg-cyan-500/10 text-cyan-700',
  'Avans Ödemeleri': 'bg-pink-50 text-pink-700',
  'Geçici Vergi Ödemeleri': 'bg-rose-50 text-rose-700',
  'Kurumlar Vergisi Ödemeleri': 'bg-red-500/10 text-red-800',
  'MTV Ödemeleri': 'bg-white/[0.06] text-slate-200',
  'Trafik Cezaları': 'bg-red-100 text-red-800',
  'Diğer': 'bg-white/[0.06] text-slate-300',
}

export default function MalatyaPage({ userId }: Props) {
  const [giderler, setGiderler] = useState<Gider[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Gider | null>(null)
  const [filtre, setFiltre] = useState('hepsi')
  const [filtreDurum, setFiltreDurum] = useState('hepsi')
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const [selectedAy, setSelectedAy] = useState(0) // 0 = tüm aylar
  const today = new Date().toISOString().split('T')[0]

  const emptyForm = { kategori: KATEGORILER[0], tarih: today, tutar: '', aciklama: '', belge_no: '', odeme_durumu: 'beklemede', odeme_tarihi: '' }
  const [form, setForm] = useState<any>(emptyForm)

  const AY_LABELS = ['Tüm Aylar', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
  const yillar = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  const fetchGiderler = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('malatya_giderler').select('*').eq('user_id', userId)
    q = q.gte('tarih', `${selectedYil}-01-01`).lte('tarih', `${selectedYil}-12-31`)
    if (selectedAy > 0) {
      const pad = String(selectedAy).padStart(2, '0')
      const lastDay = new Date(selectedYil, selectedAy, 0).getDate()
      q = q.gte('tarih', `${selectedYil}-${pad}-01`).lte('tarih', `${selectedYil}-${pad}-${lastDay}`)
    }
    const { data } = await q.order('tarih', { ascending: false })
    setGiderler(data || [])
    setLoading(false)
  }, [userId, selectedYil, selectedAy])

  useEffect(() => { fetchGiderler() }, [fetchGiderler])

  function openModal(g?: Gider) {
    setEditing(g || null)
    setForm(g ? {
      kategori: g.kategori, tarih: g.tarih, tutar: String(g.tutar),
      aciklama: g.aciklama || '', belge_no: g.belge_no || '',
      odeme_durumu: g.odeme_durumu, odeme_tarihi: g.odeme_tarihi || ''
    } : emptyForm)
    setModal(true)
  }

  async function handleSave() {
    if (!form.tutar || !form.tarih) return
    const data = {
      kategori: form.kategori, tarih: form.tarih, tutar: parseFloat(form.tutar) || 0,
      aciklama: form.aciklama, belge_no: form.belge_no,
      odeme_durumu: form.odeme_durumu, odeme_tarihi: form.odeme_tarihi || null,
      user_id: userId
    }
    if (editing) await supabase.from('malatya_giderler').update(data).eq('id', editing.id)
    else await supabase.from('malatya_giderler').insert(data)
    setModal(false); fetchGiderler()
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('malatya_giderler').delete().eq('id', id)
    fetchGiderler()
  }

  async function markOdendi(g: Gider) {
    await supabase.from('malatya_giderler').update({ odeme_durumu: 'odendi', odeme_tarihi: today }).eq('id', g.id)
    fetchGiderler()
  }

  const filtered = giderler.filter(g => {
    if (filtre !== 'hepsi' && g.kategori !== filtre) return false
    if (filtreDurum !== 'hepsi' && g.odeme_durumu !== filtreDurum) return false
    return true
  })

  const toplamTutar = filtered.reduce((s, g) => s + g.tutar, 0)
  const odenenTutar = filtered.filter(g => g.odeme_durumu === 'odendi').reduce((s, g) => s + g.tutar, 0)
  const bekleyenTutar = filtered.filter(g => g.odeme_durumu === 'beklemede').reduce((s, g) => s + g.tutar, 0)

  // Kategori bazlı özet
  const katOzet = KATEGORILER.map(k => {
    const katGiderler = giderler.filter(g => g.kategori === k)
    if (katGiderler.length === 0) return null
    return { kategori: k, toplam: katGiderler.reduce((s, g) => s + g.tutar, 0), adet: katGiderler.length }
  }).filter(Boolean) as { kategori: string; toplam: number; adet: number }[]

  const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Malatya Gider Takibi</h2>
          <p className="text-xs text-slate-400 mt-0.5">{AY_LABELS[selectedAy]} {selectedYil}</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14}/> Gider Ekle
        </button>
      </div>

      {/* Dönem seçici */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))}
          className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 py-2 text-sm outline-none">
          {yillar.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {AY_LABELS.map((ay, i) => (
            <button key={i} onClick={() => setSelectedAy(i)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedAy===i?'bg-blue-600 text-white':'bg-white/[0.02] border border-white/[0.08] text-slate-300'}`}>
              {ay}
            </button>
          ))}
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4">
          <p className="text-xs text-slate-400 mb-1">Toplam Gider</p>
          <p className="text-xl font-bold text-white">{fmt(toplamTutar)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{filtered.length} kayıt</p>
        </div>
        <div className="bg-white/[0.02] rounded-xl border border-red-100 p-4">
          <p className="text-xs text-slate-400 mb-1">Bekleyen</p>
          <p className="text-xl font-bold text-red-400">{fmt(bekleyenTutar)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{filtered.filter(g=>g.odeme_durumu==='beklemede').length} ödeme</p>
        </div>
        <div className="bg-white/[0.02] rounded-xl border border-emerald-100 p-4">
          <p className="text-xs text-slate-400 mb-1">Ödenen</p>
          <p className="text-xl font-bold text-emerald-400">{fmt(odenenTutar)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{filtered.filter(g=>g.odeme_durumu==='odendi').length} ödeme</p>
        </div>
      </div>

      {/* Kategori özeti */}
      {katOzet.length > 0 && (
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4 mb-4">
          <p className="text-xs font-medium text-slate-400 mb-3">Kategori Bazlı Özet</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {katOzet.map(k => (
              <div key={k.kategori} onClick={() => setFiltre(filtre === k.kategori ? 'hepsi' : k.kategori)}
                className={`rounded-xl border p-3 cursor-pointer transition-all hover:shadow-xl shadow-black/20-lg shadow-xl shadow-black/20-black/20 ${filtre===k.kategori?'ring-2 ring-blue-400':''} ${KAT_COLORS[k.kategori]||'bg-white/[0.04] text-slate-300'}`}>
                <p className="text-[10px] font-semibold truncate mb-1">{k.kategori}</p>
                <p className="text-sm font-bold">{fmt(k.toplam)}</p>
                <p className="text-[10px] opacity-70">{k.adet} kayıt</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="flex gap-1">
          {['hepsi', 'beklemede', 'odendi'].map(d => (
            <button key={d} onClick={() => setFiltreDurum(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filtreDurum===d?'bg-blue-600 text-white':'bg-white/[0.02] border border-white/[0.08] text-slate-300'}`}>
              {d === 'hepsi' ? 'Tümü' : d === 'beklemede' ? 'Bekleyen' : 'Ödenen'}
            </button>
          ))}
        </div>
        {filtre !== 'hepsi' && (
          <button onClick={() => setFiltre('hepsi')} className="text-xs text-blue-400 hover:underline">
            × {filtre} filtresini kaldır
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        filtered.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
            <TrendingDown size={36} className="text-slate-200 mx-auto mb-2"/>
            <p className="text-slate-400 text-sm">Kayıt bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(g => (
              <div key={g.id} className={`bg-white/[0.02] rounded-xl border p-3.5 flex items-center gap-3 hover:border-white/[0.08] transition-all ${g.odeme_durumu==='odendi'?'border-emerald-100':'border-white/[0.05]'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-center leading-tight p-1 ${KAT_COLORS[g.kategori]||'bg-white/[0.06] text-slate-300'}`}>
                  {g.kategori.split(' ').map(w => w[0]).join('').slice(0,3)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-medium text-white">{g.kategori}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${g.odeme_durumu==='odendi'?'bg-emerald-500/10 text-emerald-300':'bg-amber-500/10 text-amber-300'}`}>
                      {g.odeme_durumu === 'odendi' ? '✓ Ödendi' : 'Beklemede'}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span>{g.tarih}</span>
                    {g.belge_no && <span>Belge: {g.belge_no}</span>}
                    {g.odeme_tarihi && <span className="text-emerald-400">Ödeme: {g.odeme_tarihi}</span>}
                    {g.aciklama && <span>{g.aciklama}</span>}
                  </div>
                </div>
                <p className="text-sm font-semibold text-red-400 flex-shrink-0">{fmt(g.tutar)}</p>
                <div className="flex gap-1 flex-shrink-0">
                  {g.odeme_durumu === 'beklemede' && (
                    <button onClick={() => markOdendi(g)} title="Ödendi"
                      className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-emerald-500/10 hover:border-emerald-200 flex items-center justify-center text-slate-400 hover:text-emerald-500">
                      <CheckCircle size={12}/>
                    </button>
                  )}
                  <button onClick={() => openModal(g)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-white/[0.04] flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                  <button onClick={() => handleDelete(g.id)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-red-500/10 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={editing ? 'Gider Düzenle' : 'Gider Ekle'} onClose={() => setModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <FormField label="Kategori" required>
              <select className={inputCls} value={form.kategori} onChange={e => setForm({...form, kategori: e.target.value})}>
                {KATEGORILER.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tarih" required>
                <input type="date" className={inputCls} value={form.tarih} onChange={e => setForm({...form, tarih: e.target.value})}/>
              </FormField>
              <FormField label="Tutar (₺)" required>
                <input type="number" className={inputCls} value={form.tutar} onChange={e => setForm({...form, tutar: e.target.value})} placeholder="0.00"/>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Belge No">
                <input className={inputCls} value={form.belge_no} onChange={e => setForm({...form, belge_no: e.target.value})} placeholder="Fatura/makbuz no"/>
              </FormField>
              <FormField label="Ödeme Durumu">
                <select className={inputCls} value={form.odeme_durumu} onChange={e => setForm({...form, odeme_durumu: e.target.value})}>
                  <option value="beklemede">Beklemede</option>
                  <option value="odendi">Ödendi</option>
                </select>
              </FormField>
            </div>
            {form.odeme_durumu === 'odendi' && (
              <FormField label="Ödeme Tarihi">
                <input type="date" className={inputCls} value={form.odeme_tarihi} onChange={e => setForm({...form, odeme_tarihi: e.target.value})}/>
              </FormField>
            )}
            <FormField label="Açıklama">
              <input className={inputCls} value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} placeholder="Opsiyonel not"/>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
