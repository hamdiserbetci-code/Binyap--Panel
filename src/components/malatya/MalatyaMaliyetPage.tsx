'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, CheckCircle, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'

interface Kayit {
  id: string
  ana_grup: string
  alt_kategori: string
  tarih: string
  tutar: number
  aciklama?: string
  belge_no?: string
  odeme_durumu: string
  odeme_tarihi?: string
}

interface Props { userId: string }

const GRUPLAR: { id: string; label: string; renkBg: string; renkText: string; renkBorder: string; alt: string[] }[] = [
  {
    id: 'mal_hizmet',
    label: 'MAL HİZMET ALIŞLARI',
    renkBg: 'bg-blue-50',
    renkText: 'text-blue-700',
    renkBorder: 'border-blue-200',
    alt: ['NAKLİYE', 'MALZEME', 'BAKIM ONARIM'],
  },
  {
    id: 'personel',
    label: 'PERSONEL GİDERLERİ',
    renkBg: 'bg-emerald-50',
    renkText: 'text-emerald-700',
    renkBorder: 'border-emerald-200',
    alt: ['ÜCRET', 'AVANS', 'SGK', 'MUHTASAR', 'ARABULUCU', 'FERDİ KAZA'],
  },
  {
    id: 'cesitli',
    label: 'ÇEŞİTLİ GİDERLER',
    renkBg: 'bg-violet-50',
    renkText: 'text-violet-700',
    renkBorder: 'border-violet-200',
    alt: ['POLİÇE', 'VERGİ', 'MUHASEBE'],
  },
]

const AY_LABELS = ['Tüm Aylar', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default function MalatyaMaliyetPage({ userId }: Props) {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Kayit | null>(null)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const [selectedAy, setSelectedAy] = useState(0)
  const [acikGruplar, setAcikGruplar] = useState<Record<string, boolean>>({ mal_hizmet: true, personel: true, cesitli: true })
  const today = new Date().toISOString().split('T')[0]
  const yillar = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  const emptyForm = {
    ana_grup: GRUPLAR[0].id,
    alt_kategori: GRUPLAR[0].alt[0],
    tarih: today,
    tutar: '',
    aciklama: '',
    belge_no: '',
    odeme_durumu: 'beklemede',
    odeme_tarihi: '',
  }
  const [form, setForm] = useState<any>(emptyForm)

  const fetchKayitlar = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('malatya_maliyet').select('*').eq('user_id', userId)
    q = q.gte('tarih', `${selectedYil}-01-01`).lte('tarih', `${selectedYil}-12-31`)
    if (selectedAy > 0) {
      const pad = String(selectedAy).padStart(2, '0')
      const lastDay = new Date(selectedYil, selectedAy, 0).getDate()
      q = q.gte('tarih', `${selectedYil}-${pad}-01`).lte('tarih', `${selectedYil}-${pad}-${lastDay}`)
    }
    const { data } = await q.order('tarih', { ascending: false })
    setKayitlar(data || [])
    setLoading(false)
  }, [userId, selectedYil, selectedAy])

  useEffect(() => { fetchKayitlar() }, [fetchKayitlar])

  function toggleGrup(id: string) {
    setAcikGruplar(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function openModal(k?: Kayit, anaGrupId?: string, altKat?: string) {
    setEditing(k || null)
    if (k) {
      setForm({
        ana_grup: k.ana_grup, alt_kategori: k.alt_kategori, tarih: k.tarih,
        tutar: String(k.tutar), aciklama: k.aciklama || '', belge_no: k.belge_no || '',
        odeme_durumu: k.odeme_durumu, odeme_tarihi: k.odeme_tarihi || '',
      })
    } else {
      const grupId = anaGrupId || GRUPLAR[0].id
      const grup = GRUPLAR.find(g => g.id === grupId) || GRUPLAR[0]
      setForm({ ...emptyForm, ana_grup: grupId, alt_kategori: altKat || grup.alt[0] })
    }
    setModal(true)
  }

  function handleAnaGrupChange(grupId: string) {
    const grup = GRUPLAR.find(g => g.id === grupId) || GRUPLAR[0]
    setForm((f: any) => ({ ...f, ana_grup: grupId, alt_kategori: grup.alt[0] }))
  }

  async function handleSave() {
    if (!form.tutar || !form.tarih) return
    const payload = {
      ana_grup: form.ana_grup, alt_kategori: form.alt_kategori,
      tarih: form.tarih, tutar: parseFloat(form.tutar) || 0,
      aciklama: form.aciklama, belge_no: form.belge_no,
      odeme_durumu: form.odeme_durumu, odeme_tarihi: form.odeme_tarihi || null,
      user_id: userId,
    }
    if (editing) await supabase.from('malatya_maliyet').update(payload).eq('id', editing.id)
    else await supabase.from('malatya_maliyet').insert(payload)
    setModal(false)
    fetchKayitlar()
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('malatya_maliyet').delete().eq('id', id)
    fetchKayitlar()
  }

  async function markOdendi(k: Kayit) {
    await supabase.from('malatya_maliyet').update({ odeme_durumu: 'odendi', odeme_tarihi: today }).eq('id', k.id)
    fetchKayitlar()
  }

  const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'

  const genelToplam = kayitlar.reduce((s, k) => s + k.tutar, 0)
  const genelOdenen = kayitlar.filter(k => k.odeme_durumu === 'odendi').reduce((s, k) => s + k.tutar, 0)
  const genelBekleyen = kayitlar.filter(k => k.odeme_durumu === 'beklemede').reduce((s, k) => s + k.tutar, 0)

  const altKategoriler = GRUPLAR.find(g => g.id === form.ana_grup)?.alt || []

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Malatya Proje Maliyet</h2>
          <p className="text-xs text-slate-400 mt-0.5">{AY_LABELS[selectedAy]} {selectedYil}</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14}/> Kayıt Ekle
        </button>
      </div>

      {/* Dönem seçici */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none">
          {yillar.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {AY_LABELS.map((ay, i) => (
            <button key={i} onClick={() => setSelectedAy(i)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedAy === i ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {ay}
            </button>
          ))}
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Maliyet</p>
          <p className="text-xl font-bold text-slate-800">{fmt(genelToplam)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kayitlar.length} kayıt</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Bekleyen</p>
          <p className="text-xl font-bold text-red-500">{fmt(genelBekleyen)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kayitlar.filter(k => k.odeme_durumu === 'beklemede').length} ödeme</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Ödenen</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(genelOdenen)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kayitlar.filter(k => k.odeme_durumu === 'odendi').length} ödeme</p>
        </div>
      </div>

      {/* Gruplar */}
      {loading ? (
        <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p>
      ) : (
        <div className="space-y-4">
          {GRUPLAR.map(grup => {
            const grupKayitlar = kayitlar.filter(k => k.ana_grup === grup.id)
            const grupToplam = grupKayitlar.reduce((s, k) => s + k.tutar, 0)
            const acik = acikGruplar[grup.id]

            return (
              <div key={grup.id} className={`rounded-2xl border ${grup.renkBorder} overflow-hidden`}>
                {/* Grup başlık */}
                <button
                  onClick={() => toggleGrup(grup.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 ${grup.renkBg}`}>
                  <div className="flex items-center gap-2">
                    {acik ? <ChevronDown size={15} className={grup.renkText}/> : <ChevronRight size={15} className={grup.renkText}/>}
                    <span className={`text-sm font-bold ${grup.renkText}`}>{grup.label}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium bg-white/60 ${grup.renkText}`}>
                      {grupKayitlar.length} kayıt
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${grup.renkText}`}>{fmt(grupToplam)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); openModal(undefined, grup.id) }}
                      className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-white/70 hover:bg-white font-medium ${grup.renkText} transition-all`}>
                      <Plus size={11}/> Ekle
                    </button>
                  </div>
                </button>

                {/* Alt kategoriler */}
                {acik && (
                  <div className="bg-white divide-y divide-slate-50">
                    {grup.alt.map(alt => {
                      const altKayitlar = grupKayitlar.filter(k => k.alt_kategori === alt)
                      const altToplam = altKayitlar.reduce((s, k) => s + k.tutar, 0)

                      return (
                        <div key={alt}>
                          {/* Alt kategori başlık */}
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-50/60">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0"/>
                              <span className="text-xs font-semibold text-slate-600">{alt}</span>
                              <span className="text-[10px] text-slate-400">{altKayitlar.length} kayıt</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-slate-700">{fmt(altToplam)}</span>
                              <button
                                onClick={() => openModal(undefined, grup.id, alt)}
                                className="text-[10px] text-slate-400 hover:text-blue-600 px-2 py-0.5 rounded-lg hover:bg-blue-50 transition-all flex items-center gap-0.5">
                                <Plus size={10}/> Ekle
                              </button>
                            </div>
                          </div>

                          {/* Kayıtlar */}
                          {altKayitlar.length === 0 ? (
                            <div className="px-6 py-2 text-[11px] text-slate-300 italic">Kayıt yok</div>
                          ) : (
                            <div className="divide-y divide-slate-50">
                              {altKayitlar.map(k => (
                                <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-all">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs text-slate-500">{k.tarih}</span>
                                      {k.belge_no && <span className="text-[10px] text-slate-400">#{k.belge_no}</span>}
                                      {k.aciklama && <span className="text-[11px] text-slate-600 truncate">{k.aciklama}</span>}
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${k.odeme_durumu === 'odendi' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {k.odeme_durumu === 'odendi' ? '✓ Ödendi' : 'Beklemede'}
                                      </span>
                                      {k.odeme_tarihi && <span className="text-[10px] text-emerald-500">Ödeme: {k.odeme_tarihi}</span>}
                                    </div>
                                  </div>
                                  <span className="text-sm font-semibold text-red-500 flex-shrink-0">{fmt(k.tutar)}</span>
                                  <div className="flex gap-1 flex-shrink-0">
                                    {k.odeme_durumu === 'beklemede' && (
                                      <button onClick={() => markOdendi(k)} title="Ödendi işaretle"
                                        className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center text-slate-400 hover:text-emerald-500">
                                        <CheckCircle size={12}/>
                                      </button>
                                    )}
                                    <button onClick={() => openModal(k)}
                                      className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-400">
                                      <Pencil size={12}/>
                                    </button>
                                    <button onClick={() => handleDelete(k.id)}
                                      className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500">
                                      <Trash2 size={12}/>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal
          title={editing ? 'Kaydı Düzenle' : 'Yeni Kayıt Ekle'}
          onClose={() => setModal(false)}
          footer={
            <>
              <button className={btnSecondary} onClick={() => setModal(false)}>İptal</button>
              <button className={btnPrimary} onClick={handleSave}>Kaydet</button>
            </>
          }>
          <div className="space-y-3">
            <FormField label="Ana Grup" required>
              <select className={inputCls} value={form.ana_grup} onChange={e => handleAnaGrupChange(e.target.value)}>
                {GRUPLAR.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </FormField>
            <FormField label="Alt Kategori" required>
              <select className={inputCls} value={form.alt_kategori} onChange={e => setForm({ ...form, alt_kategori: e.target.value })}>
                {altKategoriler.map(alt => <option key={alt} value={alt}>{alt}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tarih" required>
                <input type="date" className={inputCls} value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })}/>
              </FormField>
              <FormField label="Tutar (₺)" required>
                <input type="number" className={inputCls} value={form.tutar} onChange={e => setForm({ ...form, tutar: e.target.value })} placeholder="0.00"/>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Belge No">
                <input className={inputCls} value={form.belge_no} onChange={e => setForm({ ...form, belge_no: e.target.value })} placeholder="Fatura / makbuz no"/>
              </FormField>
              <FormField label="Ödeme Durumu">
                <select className={inputCls} value={form.odeme_durumu} onChange={e => setForm({ ...form, odeme_durumu: e.target.value })}>
                  <option value="beklemede">Beklemede</option>
                  <option value="odendi">Ödendi</option>
                </select>
              </FormField>
            </div>
            {form.odeme_durumu === 'odendi' && (
              <FormField label="Ödeme Tarihi">
                <input type="date" className={inputCls} value={form.odeme_tarihi} onChange={e => setForm({ ...form, odeme_tarihi: e.target.value })}/>
              </FormField>
            )}
            <FormField label="Açıklama">
              <input className={inputCls} value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} placeholder="Opsiyonel not"/>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
