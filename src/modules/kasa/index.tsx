'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight,
  Wallet, TrendingUp, TrendingDown, Pencil, Trash2, X, Calendar,
  Banknote, CreditCard, ArrowLeftRight, FileText,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal, Field, ConfirmModal, cls, Loading, ErrorMsg } from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ── Tipler ────────────────────────────────────────────────────────────────────
interface KasaHareket {
  id: string
  firma_id: string
  tarih: string
  tur: 'gelir' | 'gider'
  kategori: string | null
  aciklama: string
  tutar: number
  odeme_sekli: 'nakit' | 'havale' | 'kart' | 'cek' | 'diger'
  created_at: string
}

const GELIR_KATEGORILER = ['Satış', 'Hizmet Bedeli', 'Kira Geliri', 'Tahsilat', 'Faiz', 'Diğer Gelir']
const GIDER_KATEGORILER = ['Kira', 'Fatura', 'Maaş / Avans', 'Malzeme', 'Ulaşım', 'Yemek', 'Vergi / SGK', 'Kırtasiye', 'Diğer Gider']

const ODEME_SEKLI_LABEL: Record<string, string> = {
  nakit: 'Nakit', havale: 'Havale / EFT', kart: 'Kart', cek: 'Çek', diger: 'Diğer',
}

const ODEME_ICON: Record<string, typeof Banknote> = {
  nakit: Banknote, havale: ArrowLeftRight, kart: CreditCard, cek: FileText, diger: Wallet,
}

const EMPTY_FORM = {
  tur: 'gelir' as 'gelir' | 'gider',
  aciklama: '',
  tutar: '',
  kategori: '',
  odeme_sekli: 'nakit' as KasaHareket['odeme_sekli'],
  tarih: new Date().toISOString().slice(0, 10),
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function gunLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  const today = new Date().toISOString().slice(0, 10)
  if (iso === today) return 'Bugün'
  return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function prevDay(iso: string) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
}
function nextDay(iso: string) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
}

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function Kasa({ firma }: AppCtx) {
  const [hareketler, setHareketler] = useState<KasaHareket[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [tarih, setTarih]           = useState(new Date().toISOString().slice(0, 10))
  const [view, setView]             = useState<'gun' | 'ay'>('gun')

  const [modal, setModal]           = useState<'add' | 'edit' | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [formErr, setFormErr]       = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Mevcut ayın başından yükle — hem günlük hem aylık görünüm için
  useEffect(() => { load() }, [firma.id, tarih, view])

  async function load() {
    setLoading(true); setError('')
    let query = supabase
      .from('kasa_hareketleri')
      .select('*')
      .eq('firma_id', firma.id)
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false })

    if (view === 'gun') {
      query = query.eq('tarih', tarih)
    } else {
      const ay = tarih.slice(0, 7)
      query = query.gte('tarih', `${ay}-01`).lte('tarih', `${ay}-31`)
    }

    const { data, error: e } = await query
    if (e) { setError(e.message); setLoading(false); return }
    setHareketler((data || []) as KasaHareket[])
    setLoading(false)
  }

  async function save() {
    const tutarNum = parseFloat(form.tutar.replace(',', '.'))
    if (!form.aciklama.trim()) { setFormErr('Açıklama zorunludur'); return }
    if (isNaN(tutarNum) || tutarNum <= 0) { setFormErr('Geçerli bir tutar girin'); return }

    setSaving(true); setFormErr('')
    const payload = {
      firma_id: firma.id,
      tarih: form.tarih,
      tur: form.tur,
      kategori: form.kategori || null,
      aciklama: form.aciklama.trim(),
      tutar: tutarNum,
      odeme_sekli: form.odeme_sekli,
    }

    const { error: e } = modal === 'add'
      ? await supabase.from('kasa_hareketleri').insert(payload)
      : await supabase.from('kasa_hareketleri').update(payload).eq('id', editingId!)

    setSaving(false)
    if (e) { setFormErr(e.message); return }
    setModal(null); load()
  }

  async function deleteHareket() {
    await supabase.from('kasa_hareketleri').delete().eq('id', deletingId!)
    setDeletingId(null); load()
  }

  // ── Hesaplamalar ──────────────────────────────────────────────────────────
  const toplamGelir  = useMemo(() => hareketler.filter(h => h.tur === 'gelir').reduce((s, h) => s + h.tutar, 0), [hareketler])
  const toplamGider  = useMemo(() => hareketler.filter(h => h.tur === 'gider').reduce((s, h) => s + h.tutar, 0), [hareketler])
  const netBakiye    = toplamGelir - toplamGider

  // Ay görünümü için günlere grupla
  const gruplar = useMemo(() => {
    if (view === 'gun') return { [tarih]: hareketler }
    const map: Record<string, KasaHareket[]> = {}
    for (const h of hareketler) {
      if (!map[h.tarih]) map[h.tarih] = []
      map[h.tarih].push(h)
    }
    return map
  }, [hareketler, view, tarih])

  const gunler = Object.keys(gruplar).sort((a, b) => b.localeCompare(a))

  function openAdd() {
    setForm({ ...EMPTY_FORM, tarih: view === 'gun' ? tarih : new Date().toISOString().slice(0, 10) })
    setEditingId(null); setFormErr(''); setModal('add')
  }

  function openEdit(h: KasaHareket) {
    setForm({
      tur: h.tur, aciklama: h.aciklama,
      tutar: String(h.tutar), kategori: h.kategori || '',
      odeme_sekli: h.odeme_sekli, tarih: h.tarih,
    })
    setEditingId(h.id); setFormErr(''); setModal('edit')
  }

  if (loading) return <Loading />
  if (error)   return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-0 -mx-3 md:-mx-5 -mt-3 md:-mt-5">

      {/* ── Üst Bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-[rgba(60,60,67,0.36)] shrink-0 flex-wrap"
        style={{ background: 'rgba(28,28,30,0.95)' }}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white flex-1 uppercase">
          Kasa
        </h1>

        {/* Görünüm seçici */}
        <div className="flex rounded-[10px] overflow-hidden border border-[rgba(60,60,67,0.5)]">
          {(['gun', 'ay'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: view === v ? '#0A84FF' : 'rgba(44,44,46,0.8)',
                color: view === v ? '#fff' : 'rgba(235,235,245,0.5)',
              }}>
              {v === 'gun' ? 'Günlük' : 'Aylık'}
            </button>
          ))}
        </div>

        <button onClick={openAdd} className={cls.btnPrimary}>
          <Plus size={14} /> Yeni Kayıt
        </button>
      </div>

      {/* ── Tarih Navigasyon ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(60,60,67,0.2)]"
        style={{ background: '#1C1C1E' }}>
        <button
          onClick={() => setTarih(view === 'gun' ? prevDay(tarih) : (() => {
            const d = new Date(tarih + '-01T12:00:00'); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) + '-01'
          })())}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[rgba(235,235,245,0.5)] hover:text-white hover:bg-[rgba(60,60,67,0.5)] transition-all">
          <ChevronLeft size={18} />
        </button>

        <div className="flex-1 flex items-center justify-center gap-2">
          <Calendar size={14} className="text-[#0A84FF]" />
          <label className="relative cursor-pointer">
            <span className="text-sm font-semibold text-white">
              {view === 'gun'
                ? gunLabel(tarih)
                : new Date(tarih + 'T12:00:00').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
              }
            </span>
            <input
              type={view === 'gun' ? 'date' : 'month'}
              value={view === 'gun' ? tarih : tarih.slice(0, 7)}
              onChange={e => setTarih(view === 'gun' ? e.target.value : e.target.value + '-01')}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
          </label>
        </div>

        <button
          onClick={() => setTarih(view === 'gun' ? nextDay(tarih) : (() => {
            const d = new Date(tarih + 'T12:00:00'); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7) + '-01'
          })())}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[rgba(235,235,245,0.5)] hover:text-white hover:bg-[rgba(60,60,67,0.5)] transition-all">
          <ChevronRight size={18} />
        </button>

        {/* Bugüne dön */}
        {tarih !== new Date().toISOString().slice(0, 10) && view === 'gun' && (
          <button onClick={() => setTarih(new Date().toISOString().slice(0, 10))}
            className="text-[10px] font-semibold text-[#0A84FF] px-2.5 py-1 rounded-full border border-[rgba(10,132,255,0.3)] hover:bg-[rgba(10,132,255,0.1)] transition-all">
            Bugün
          </button>
        )}
      </div>

      {/* ── Özet Kartlar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4" style={{ background: '#000000' }}>
        {/* Gelir */}
        <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)' }}>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} style={{ color: '#30D158' }} />
            <span className="text-[11px] font-semibold text-[rgba(235,235,245,0.6)]">Gelir</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-[#30D158] leading-none">
            ₺{fmt(toplamGelir)}
          </p>
          <p className="text-[10px] text-[rgba(235,235,245,0.3)]">
            {hareketler.filter(h => h.tur === 'gelir').length} işlem
          </p>
        </div>

        {/* Gider */}
        <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)' }}>
          <div className="flex items-center gap-1.5">
            <TrendingDown size={14} style={{ color: '#FF453A' }} />
            <span className="text-[11px] font-semibold text-[rgba(235,235,245,0.6)]">Gider</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-[#FF453A] leading-none">
            ₺{fmt(toplamGider)}
          </p>
          <p className="text-[10px] text-[rgba(235,235,245,0.3)]">
            {hareketler.filter(h => h.tur === 'gider').length} işlem
          </p>
        </div>

        {/* Net Bakiye */}
        <div className="rounded-2xl p-4 flex flex-col gap-2" style={{
          background: netBakiye >= 0 ? 'rgba(10,132,255,0.1)' : 'rgba(255,159,10,0.1)',
          border: `1px solid ${netBakiye >= 0 ? 'rgba(10,132,255,0.2)' : 'rgba(255,159,10,0.2)'}`,
        }}>
          <div className="flex items-center gap-1.5">
            <Wallet size={14} style={{ color: netBakiye >= 0 ? '#0A84FF' : '#FF9F0A' }} />
            <span className="text-[11px] font-semibold text-[rgba(235,235,245,0.6)]">Net</span>
          </div>
          <p className="text-base sm:text-lg font-bold leading-none"
            style={{ color: netBakiye >= 0 ? '#0A84FF' : '#FF9F0A' }}>
            {netBakiye >= 0 ? '+' : ''}₺{fmt(netBakiye)}
          </p>
          <p className="text-[10px] text-[rgba(235,235,245,0.3)]">
            {hareketler.length} toplam işlem
          </p>
        </div>
      </div>

      {/* ── Hareket Listesi ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-8 space-y-4" style={{ background: '#000000' }}>
        {gunler.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(60,60,67,0.3)' }}>
              <Wallet size={28} className="text-[rgba(235,235,245,0.3)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[rgba(235,235,245,0.5)]">Kayıt yok</p>
              <p className="text-xs text-[rgba(235,235,245,0.3)] mt-1">Yeni kayıt ekleyerek başlayın</p>
            </div>
            <button onClick={openAdd} className={cls.btnPrimary}>
              <Plus size={14} /> Yeni Kayıt
            </button>
          </div>
        ) : (
          gunler.map(gun => {
            const gunHareketler = gruplar[gun]
            const gunGelir = gunHareketler.filter(h => h.tur === 'gelir').reduce((s, h) => s + h.tutar, 0)
            const gunGider = gunHareketler.filter(h => h.tur === 'gider').reduce((s, h) => s + h.tutar, 0)
            return (
              <div key={gun}>
                {/* Gün başlığı — aylık görünümde göster */}
                {view === 'ay' && (
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[rgba(235,235,245,0.5)]">
                      {new Date(gun + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-[#30D158]">+₺{fmt(gunGelir)}</span>
                      <span className="text-[10px] font-bold text-[#FF453A]">-₺{fmt(gunGider)}</span>
                    </div>
                  </div>
                )}

                {/* İşlem kartları */}
                <div className="rounded-2xl overflow-hidden border border-[rgba(60,60,67,0.36)]"
                  style={{ background: '#1C1C1E' }}>
                  {gunHareketler.map((h, idx) => {
                    const OdemeIcon = ODEME_ICON[h.odeme_sekli] ?? Banknote
                    const isGelir = h.tur === 'gelir'
                    return (
                      <div key={h.id}
                        className={`flex items-center gap-3 px-4 py-3.5 group transition-colors hover:bg-[rgba(255,255,255,0.03)] ${
                          idx < gunHareketler.length - 1 ? 'border-b border-[rgba(60,60,67,0.2)]' : ''
                        }`}>

                        {/* Tür ikonu */}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: isGelir ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)' }}>
                          {isGelir
                            ? <ArrowDownLeft size={18} style={{ color: '#30D158' }} />
                            : <ArrowUpRight  size={18} style={{ color: '#FF453A' }} />
                          }
                        </div>

                        {/* Açıklama */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{h.aciklama}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {h.kategori && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: isGelir ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
                                  color: isGelir ? '#30D158' : '#FF453A',
                                }}>
                                {h.kategori}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <OdemeIcon size={10} className="text-[rgba(235,235,245,0.3)]" />
                              <span className="text-[10px] text-[rgba(235,235,245,0.3)]">
                                {ODEME_SEKLI_LABEL[h.odeme_sekli]}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Tutar */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <p className="text-base font-bold"
                            style={{ color: isGelir ? '#30D158' : '#FF453A' }}>
                            {isGelir ? '+' : '-'}₺{fmt(h.tutar)}
                          </p>
                        </div>

                        {/* Aksiyon butonları */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openEdit(h)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(235,235,245,0.4)] hover:text-[#0A84FF] hover:bg-[rgba(10,132,255,0.1)] transition-all">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeletingId(h.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgba(235,235,245,0.4)] hover:text-[#FF453A] hover:bg-[rgba(255,69,58,0.1)] transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Yeni / Düzenle Modal ─────────────────────────────────────────────── */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Yeni Kasa Kaydı' : 'Kaydı Düzenle'}
          onClose={() => setModal(null)}
          size="md"
          footer={<>
            <button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button>
            <button onClick={save} disabled={saving} className={cls.btnPrimary}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>}>

          <div className="space-y-4">
            {/* Gelir / Gider toggle */}
            <div>
              <p className="text-xs font-semibold text-[rgba(235,235,245,0.5)] mb-2 uppercase tracking-wide">İşlem Türü</p>
              <div className="flex rounded-[12px] overflow-hidden border border-[rgba(60,60,67,0.5)]">
                {(['gelir', 'gider'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(p => ({ ...p, tur: t, kategori: '' }))}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all"
                    style={{
                      background: form.tur === t
                        ? t === 'gelir' ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'
                        : 'rgba(44,44,46,0.6)',
                      color: form.tur === t
                        ? t === 'gelir' ? '#30D158' : '#FF453A'
                        : 'rgba(235,235,245,0.4)',
                      borderRight: t === 'gelir' ? '1px solid rgba(60,60,67,0.5)' : undefined,
                    }}>
                    {t === 'gelir'
                      ? <><ArrowDownLeft size={16} /> Gelir</>
                      : <><ArrowUpRight  size={16} /> Gider</>
                    }
                  </button>
                ))}
              </div>
            </div>

            <Field label="Açıklama" required error={formErr}>
              <input className={cls.input} placeholder="Açıklama girin..." autoFocus
                value={form.aciklama} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))} />
            </Field>

            <Field label="Tutar (₺)" required>
              <input className={cls.input} placeholder="0,00" type="number" min="0" step="0.01"
                value={form.tutar} onChange={e => setForm(p => ({ ...p, tutar: e.target.value }))} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kategori">
                <select className={cls.input} value={form.kategori}
                  onChange={e => setForm(p => ({ ...p, kategori: e.target.value }))}>
                  <option value="">— Seçin —</option>
                  {(form.tur === 'gelir' ? GELIR_KATEGORILER : GIDER_KATEGORILER).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </Field>

              <Field label="Ödeme Şekli">
                <select className={cls.input} value={form.odeme_sekli}
                  onChange={e => setForm(p => ({ ...p, odeme_sekli: e.target.value as KasaHareket['odeme_sekli'] }))}>
                  {Object.entries(ODEME_SEKLI_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Tarih">
              <input className={cls.input} type="date"
                value={form.tarih} onChange={e => setForm(p => ({ ...p, tarih: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {/* ── Sil Onay ─────────────────────────────────────────────────────────── */}
      {deletingId && (
        <ConfirmModal
          title="Kaydı Sil"
          message="Bu kasa kaydını silmek istediğinizden emin misiniz?"
          danger
          onConfirm={deleteHareket}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}
