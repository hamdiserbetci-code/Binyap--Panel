'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

interface KasaKayit {
  id: string
  firma_id: string
  tarih: string
  aciklama: string
  tur: 'giris' | 'cikis'
  kategori: string
  tutar: number
  bakiye: number
  belge_no?: string
  notlar?: string
  user_id: string
}

interface Props { userId: string; firma: Firma }

const KAT_LABELS: Record<string, string> = {
  tahsilat: 'Tahsilat', odeme: 'Ödeme', maas: 'Maaş',
  vergi: 'Vergi', sgk: 'SGK', cek: 'Çek', diger: 'Diğer'
}

const KAT_COLORS: Record<string, string> = {
  tahsilat: 'bg-emerald-500/10 text-emerald-300',
  odeme: 'bg-red-500/10 text-red-700',
  maas: 'bg-blue-500/10 text-blue-300',
  vergi: 'bg-purple-500/10 text-purple-700',
  sgk: 'bg-orange-50 text-orange-700',
  cek: 'bg-indigo-500/10 text-indigo-700',
  diger: 'bg-white/[0.06] text-slate-300',
}

export default function KasaPage({ userId, firma }: Props) {
  const [kayitlar, setKayitlar] = useState<KasaKayit[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<KasaKayit | null>(null)
  const [filtre, setFiltre] = useState('hepsi')
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())

  const emptyForm = { tarih: new Date().toISOString().split('T')[0], aciklama: '', tur: 'giris', kategori: 'tahsilat', tutar: '', belge_no: '', notlar: '' }
  const [form, setForm] = useState<any>(emptyForm)

  const AY_LABELS = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
  const yillar = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  const fetch = useCallback(async () => {
    setLoading(true)
    const startDate = `${selectedYil}-${String(selectedAy).padStart(2, '0')}-01`
    const endDate = new Date(selectedYil, selectedAy, 0).toISOString().split('T')[0]
    const { data } = await supabase.from('kasa').select('*')
      .eq('firma_id', firma.id)
      .gte('tarih', startDate)
      .lte('tarih', endDate)
      .order('tarih', { ascending: false })
    setKayitlar(data || [])
    setLoading(false)
  }, [firma.id, selectedAy, selectedYil])

  useEffect(() => { fetch() }, [fetch])

  async function hesaplaBakiye() {
    // Tüm kayıtları al, bakiyeleri hesapla
    const { data: tumKayitlar } = await supabase.from('kasa').select('*')
      .eq('firma_id', firma.id).order('tarih').order('olusturulma')
    if (!tumKayitlar) return
    let bakiye = 0
    for (const k of tumKayitlar) {
      bakiye = k.tur === 'giris' ? bakiye + k.tutar : bakiye - k.tutar
      await supabase.from('kasa').update({ bakiye }).eq('id', k.id)
    }
    fetch()
  }

  function openModal(k?: KasaKayit) {
    setEditing(k || null)
    setForm(k ? { tarih: k.tarih, aciklama: k.aciklama, tur: k.tur, kategori: k.kategori, tutar: String(k.tutar), belge_no: k.belge_no || '', notlar: k.notlar || '' } : emptyForm)
    setModal(true)
  }

  async function handleSave() {
    if (!form.aciklama || !form.tutar) return
    const data = { ...form, tutar: parseFloat(form.tutar), firma_id: firma.id, user_id: userId, bakiye: 0 }
    if (editing) await supabase.from('kasa').update(data).eq('id', editing.id)
    else await supabase.from('kasa').insert(data)
    setModal(false)
    await hesaplaBakiye()
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    await supabase.from('kasa').delete().eq('id', id)
    await hesaplaBakiye()
  }

  const filtered = kayitlar.filter(k => filtre === 'hepsi' ? true : filtre === 'giris' ? k.tur === 'giris' : filtre === 'cikis' ? k.tur === 'cikis' : k.kategori === filtre)

  const toplamGiris = kayitlar.filter(k => k.tur === 'giris').reduce((s, k) => s + k.tutar, 0)
  const toplamCikis = kayitlar.filter(k => k.tur === 'cikis').reduce((s, k) => s + k.tutar, 0)
  const mevcutBakiye = toplamGiris - toplamCikis

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Kasa Takibi</h2>
          <p className="text-xs text-slate-400 mt-0.5">{firma.ad} — {AY_LABELS[selectedAy]} {selectedYil}</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={14} /> Kayıt Ekle
        </button>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400">Toplam Giriş</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">+{toplamGiris.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingDown size={16} className="text-red-400" />
            </div>
            <p className="text-xs text-slate-400">Toplam Çıkış</p>
          </div>
          <p className="text-2xl font-bold text-red-400">-{toplamCikis.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className={`rounded-xl border p-4 ${mevcutBakiye >= 0 ? 'bg-blue-600 border-blue-700' : 'bg-red-600 border-red-700'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/[0.02]/20 flex items-center justify-center">
              <Wallet size={16} className="text-white" />
            </div>
            <p className="text-xs text-white/80">Mevcut Bakiye</p>
          </div>
          <p className="text-2xl font-bold text-white">{mevcutBakiye.toLocaleString('tr-TR')} ₺</p>
        </div>
      </div>

      {/* Ay/Yıl seçimi */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))} className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 py-2 text-sm outline-none">
          {yillar.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {AY_LABELS.slice(1).map((ay, i) => (
            <button key={i+1} onClick={() => setSelectedAy(i+1)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedAy===i+1?'bg-blue-600 text-white':'bg-white/[0.02] border border-white/[0.08] text-slate-300'}`}>{ay}</button>
          ))}
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['hepsi','Tümü'],['giris','Girişler'],['cikis','Çıkışlar']].map(([v,l]) => (
          <button key={v} onClick={() => setFiltre(v)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filtre===v?'bg-blue-600 text-white':'bg-white/[0.02] border border-white/[0.08] text-slate-300'}`}>{l}</button>
        ))}
        {Object.entries(KAT_LABELS).map(([k,v]) => (
          <button key={k} onClick={() => setFiltre(k)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filtre===k?'bg-blue-600 text-white':'bg-white/[0.02] border border-white/[0.08] text-slate-300'}`}>{v}</button>
        ))}
      </div>

      {/* Kayıt listesi */}
      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        filtered.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
            <Wallet size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Bu dönem için kayıt yok</p>
          </div>
        ) : (
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] overflow-hidden">
            {/* Tablo başlığı */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-white/[0.04] border-b border-white/[0.05] text-xs font-medium text-slate-400">
              <div className="col-span-2">Tarih</div>
              <div className="col-span-4">Açıklama</div>
              <div className="col-span-2">Kategori</div>
              <div className="col-span-1 text-right">Giriş</div>
              <div className="col-span-1 text-right">Çıkış</div>
              <div className="col-span-1 text-right">Bakiye</div>
              <div className="col-span-1"></div>
            </div>

            {filtered.map((k, idx) => (
              <div key={k.id} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-white/[0.02] last:border-0 ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.04]/50'}`}>
                <div className="col-span-2 text-xs text-slate-400">{k.tarih}</div>
                <div className="col-span-4">
                  <p className="text-sm font-medium text-white truncate">{k.aciklama}</p>
                  {k.belge_no && <p className="text-[10px] text-slate-400">No: {k.belge_no}</p>}
                </div>
                <div className="col-span-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${KAT_COLORS[k.kategori]}`}>{KAT_LABELS[k.kategori]}</span>
                </div>
                <div className="col-span-1 text-right">
                  {k.tur === 'giris' && <span className="text-sm font-semibold text-emerald-400">+{k.tutar.toLocaleString('tr-TR')}</span>}
                </div>
                <div className="col-span-1 text-right">
                  {k.tur === 'cikis' && <span className="text-sm font-semibold text-red-400">-{k.tutar.toLocaleString('tr-TR')}</span>}
                </div>
                <div className="col-span-1 text-right">
                  <span className={`text-xs font-medium ${k.bakiye >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{k.bakiye.toLocaleString('tr-TR')}</span>
                </div>
                <div className="col-span-1 flex gap-1 justify-end">
                  <button onClick={() => openModal(k)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-300"><Pencil size={11}/></button>
                  <button onClick={() => handleDelete(k.id)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={11}/></button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={editing ? 'Kaydı Düzenle' : 'Yeni Kasa Kaydı'} onClose={() => setModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tür" required>
                <select className={inputCls} value={form.tur} onChange={e => setForm({...form, tur: e.target.value, kategori: e.target.value === 'giris' ? 'tahsilat' : 'odeme'})}>
                  <option value="giris">Giriş (+)</option>
                  <option value="cikis">Çıkış (-)</option>
                </select>
              </FormField>
              <FormField label="Kategori">
                <select className={inputCls} value={form.kategori} onChange={e => setForm({...form, kategori: e.target.value})}>
                  {Object.entries(KAT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Açıklama" required>
              <input className={inputCls} value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} placeholder="İşlem açıklaması" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tutar (₺)" required>
                <input type="number" className={inputCls} value={form.tutar} onChange={e => setForm({...form, tutar: e.target.value})} placeholder="0.00" />
              </FormField>
              <FormField label="Tarih" required>
                <input type="date" className={inputCls} value={form.tarih} onChange={e => setForm({...form, tarih: e.target.value})} />
              </FormField>
            </div>
            <FormField label="Belge No">
              <input className={inputCls} value={form.belge_no} onChange={e => setForm({...form, belge_no: e.target.value})} placeholder="Fatura/fiş no" />
            </FormField>
            <FormField label="Notlar">
              <input className={inputCls} value={form.notlar} onChange={e => setForm({...form, notlar: e.target.value})} placeholder="Opsiyonel not" />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
