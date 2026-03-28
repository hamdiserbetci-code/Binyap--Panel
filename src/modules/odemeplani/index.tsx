'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { AppCtx } from '@/app/page'
import { ConfirmModal, ErrorMsg, Field, Loading, Modal, cls } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'

type OdemeKaydi = {
  id: string
  created_at: string
  firma_id: string
  user_id: string
  proje_id: string | null
  baslik: string
  tur: string
  kaynak: string
  cari_ekip: string | null
  vade: string
  durum: string
  hatirlatma: string | null
  tutar: number
  readonly?: boolean
}

type Proje = {
  id: string
  ad: string
  firma_id: string
}

const TUR_SECENEKLERI = [
  'Vergi Odemeleri',
  'SGK Odemeleri',
  'Maas Odemeleri',
  'Cari Hesap Odemeleri',
  'Diger Odemeler',
  'Cek Odemeleri',
]

const MANUEL_TUR_SECENEKLERI = [
  'Vergi Odemeleri',
  'SGK Odemeleri',
  'Maas Odemeleri',
  'Cari Hesap Odemeleri',
  'Diger Odemeler',
]

const KAYNAK_SECENEKLERI = ['Odeme Plani']

const DURUM_SECENEKLERI = ['Bekliyor', 'Odendi', 'Iptal']

const EMPTY_FORM: Partial<OdemeKaydi> = {
  baslik: '',
  tur: 'Vergi Odemeleri',
  kaynak: 'Odeme Plani',
  cari_ekip: '',
  vade: new Date().toISOString().split('T')[0],
  durum: 'Bekliyor',
  hatirlatma: '',
  tutar: 0,
  proje_id: '',
}

function toNumber(val: unknown) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0

  const normalized = String(val)
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  const num = Number(normalized)
  return Number.isFinite(num) ? num : 0
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(value)
}

export default function OdemePlaniModule({ firma, profil }: AppCtx) {
  const [kayitlar, setKayitlar] = useState<OdemeKaydi[]>([])
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTur, setSelectedTur] = useState('Tum')
  const [selectedProje, setSelectedProje] = useState('Tum')
  const [modal, setModal] = useState<Partial<OdemeKaydi> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date()
    return {
      start: format(startOfMonth(today), 'yyyy-MM-dd'),
      end: format(endOfMonth(today), 'yyyy-MM-dd'),
    }
  })

  useEffect(() => {
    if (!firma?.id) return
    load()
  }, [firma?.id])

  async function load() {
    if (!firma?.id) return

    setLoading(true)
    setError('')

    try {
      const [odemeRes, projeRes, cekRes] = await Promise.all([
        supabase
          .from('odeme_plani')
          .select('*')
          .eq('firma_id', firma.id)
          .order('vade', { ascending: true })
          .order('created_at', { ascending: false }),

        supabase
          .from('projeler')
          .select('id, ad, firma_id')
          .eq('firma_id', firma.id)
          .order('ad', { ascending: true }),

        supabase
          .from('cekler')
          .select('*')
          .eq('firma_id', firma.id),
      ])

      if (odemeRes.error) throw odemeRes.error
      if (projeRes.error) throw projeRes.error

      const manuel = Array.isArray(odemeRes.data) ? (odemeRes.data as OdemeKaydi[]) : []
      const projeList = Array.isArray(projeRes.data) ? (projeRes.data as Proje[]) : []

      const cekMapped: OdemeKaydi[] = Array.isArray(cekRes.data)
        ? cekRes.data.map((c: any) => ({
            id: String(c.id),
            created_at: c.created_at || new Date().toISOString(),
            firma_id: c.firma_id,
            user_id: c.user_id || '',
            proje_id: c.proje_id || null,
            baslik: c.baslik || c.no || c.cek_no ? `Cek ${c.no || c.cek_no || ''}`.trim() : 'Cek',
            tur: 'Cek Odemeleri',
            kaynak: 'Cek Takibi',
            cari_ekip: c.cari_ekip || c.firma_adi || c.cari || null,
            vade: c.vade || c.vade_tarihi || new Date().toISOString().split('T')[0],
            durum: c.durum || 'Bekliyor',
            hatirlatma: null,
            tutar: toNumber(c.tutar),
            readonly: true,
          }))
        : []

      setKayitlar([...manuel, ...cekMapped])
      setProjeler(projeList)
    } catch (err: any) {
      setError(err?.message || 'Odeme verileri alinamadi.')
      setKayitlar([])
      setProjeler([])
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    const baslik = String(modal?.baslik || '').trim()
    const tur = String(modal?.tur || '').trim()
    const kaynak = String(modal?.kaynak || '').trim()
    const cari_ekip = String(modal?.cari_ekip || '').trim()
    const vade = String(modal?.vade || '').trim()
    const durum = String(modal?.durum || '').trim()
    const hatirlatma = String(modal?.hatirlatma || '').trim()
    const tutar = toNumber(modal?.tutar)
    const proje_id = String(modal?.proje_id || '').trim()

    if (!baslik || !tur || !kaynak || !vade || !durum || tutar <= 0) {
      alert('Baslik, tur, kaynak, vade, durum ve tutar zorunludur.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        firma_id: firma.id,
        user_id: profil.id,
        proje_id: proje_id || null,
        baslik,
        tur,
        kaynak,
        cari_ekip: cari_ekip || null,
        vade,
        durum,
        hatirlatma: hatirlatma || null,
        tutar,
      }

      const { error: saveError } = modal?.id
        ? await supabase.from('odeme_plani').update(payload).eq('id', modal.id)
        : await supabase.from('odeme_plani').insert(payload)

      if (saveError) throw saveError

      setModal(null)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Kayit kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteKayit() {
    if (!deleteId) return

    try {
      const { error: deleteError } = await supabase.from('odeme_plani').delete().eq('id', deleteId)
      if (deleteError) throw deleteError
      setDeleteId(null)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Kayit silinemedi.')
    }
  }

  const projeMap = useMemo(() => {
    return Object.fromEntries(projeler.map((p) => [p.id, p]))
  }, [projeler])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR')
    const startDate = new Date(`${dateRange.start}T00:00:00`).getTime()
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime()

    return kayitlar.filter((item) => {
      const itemDate = new Date(`${item.vade}T00:00:00`).getTime()
      if (Number.isNaN(itemDate)) return false
      if (itemDate < startDate || itemDate > endDate) return false
      if (selectedTur !== 'Tum' && item.tur !== selectedTur) return false
      if (selectedProje !== 'Tum' && (item.proje_id || '') !== selectedProje) return false

      if (!needle) return true

      const projeAdi = item.proje_id ? projeMap[item.proje_id]?.ad : ''

      return [
        item.baslik,
        item.tur,
        item.kaynak,
        item.cari_ekip,
        item.durum,
        projeAdi,
        String(item.tutar),
      ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(needle))
    })
  }, [kayitlar, query, dateRange, selectedTur, selectedProje, projeMap])

  const stats = useMemo(() => {
    const toplam = filtered.reduce((sum, x) => sum + toNumber(x.tutar), 0)
    const bekleyen = filtered.filter((x) => x.durum === 'Bekliyor').length
    const odenen = filtered.filter((x) => x.durum === 'Odendi').length
    return { toplam, bekleyen, odenen }
  }, [filtered])

  const grouped = useMemo(() => {
    return filtered.reduce((acc, item) => {
      const key = item.tur || 'Diger Odemeler'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {} as Record<string, OdemeKaydi[]>)
  }, [filtered])

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-300">
              <CalendarDays size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Odeme Merkezi</h1>
              <p className="text-sm text-slate-400">
                Firma ve proje bazli odemeleri tek ekranda yonetin.
              </p>
            </div>
          </div>

          <button onClick={() => setModal({ ...EMPTY_FORM })} className={cls.btnPrimary}>
            <Plus size={15} /> Yeni Kayit
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Tutar" value={stats.toplam} tone="cyan" money />
        <SummaryCard label="Bekleyen" value={stats.bekleyen} tone="amber" />
        <SummaryCard label="Odenen" value={stats.odenen} tone="emerald" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/5 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Baslik, tur, cari, proje veya tutar ara..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-blue-500"
              />
            </div>

            <Field label="Tur">
              <select className={cls.input} value={selectedTur} onChange={(e) => setSelectedTur(e.target.value)}>
                <option value="Tum">Tumu</option>
                {TUR_SECENEKLERI.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Proje">
              <select className={cls.input} value={selectedProje} onChange={(e) => setSelectedProje(e.target.value)}>
                <option value="Tum">Tum Projeler</option>
                <option value="">Genel Firma</option>
                {projeler.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.ad}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Baslangic">
                <input
                  type="date"
                  className={cls.input}
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                />
              </Field>

              <Field label="Bitis">
                <input
                  type="date"
                  className={cls.input}
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-4">
          {Object.keys(grouped).length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">Kayit bulunamadi.</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([tur, items]) => {
                const grupToplam = items.reduce((sum, x) => sum + toNumber(x.tutar), 0)

                return (
                  <div key={tur}>
                    <div className="mb-3 flex items-center justify-between px-2">
                      <div>
                        <h3 className="text-sm font-bold text-white">{tur}</h3>
                        <p className="text-xs text-slate-400">{items.length} kayit</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-cyan-300">
                        {formatMoney(grupToplam)}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {items.map((item) => {
                        const durumTone =
                          item.durum === 'Odendi'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : item.durum === 'Iptal'
                            ? 'bg-rose-500/10 text-rose-300'
                            : 'bg-amber-500/10 text-amber-300'

                        return (
                          <div key={`${item.kaynak}-${item.id}`} className="rounded-2xl bg-slate-950/40 p-4 transition-colors hover:bg-slate-900">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-white">{item.baslik}</p>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${durumTone}`}>
                                    {item.durum}
                                  </span>
                                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                                    {item.kaynak}
                                  </span>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                  <span>Cari / Ekip: {item.cari_ekip || '-'}</span>
                                  <span>Proje: {item.proje_id ? projeMap[item.proje_id]?.ad || '-' : 'Genel Firma'}</span>
                                  <span>Vade: {new Date(`${item.vade}T00:00:00`).toLocaleDateString('tr-TR')}</span>
                                  <span>
                                    Hatirlatma: {item.hatirlatma ? new Date(item.hatirlatma).toLocaleString('tr-TR') : '-'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-base font-bold text-white">{formatMoney(toNumber(item.tutar))}</p>
                                </div>

                                {!item.readonly && (
                                  <>
                                    <button
                                      onClick={() => setModal({ ...item })}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                                    >
                                      <Pencil size={14} />
                                    </button>

                                    <button
                                      onClick={() => setDeleteId(item.id)}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-400"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.id ? 'Kaydi Duzenle' : 'Yeni Kayit'}
          onClose={() => setModal(null)}
          size="lg"
          footer={
            <>
              <button onClick={() => setModal(null)} className={cls.btnSecondary}>
                Iptal
              </button>
              <button onClick={save} disabled={saving} className={cls.btnPrimary}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Baslik" required>
              <input
                className={cls.input}
                value={modal.baslik || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, baslik: e.target.value }))}
              />
            </Field>

            <Field label="Tur" required>
              <select
                className={cls.input}
                value={modal.tur || MANUEL_TUR_SECENEKLERI[0]}
                onChange={(e) => setModal((prev) => ({ ...prev!, tur: e.target.value }))}
              >
                {MANUEL_TUR_SECENEKLERI.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kaynak" required>
              <select
                className={cls.input}
                value={modal.kaynak || 'Odeme Plani'}
                onChange={(e) => setModal((prev) => ({ ...prev!, kaynak: e.target.value }))}
              >
                {KAYNAK_SECENEKLERI.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Proje">
              <select
                className={cls.input}
                value={modal.proje_id || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, proje_id: e.target.value }))}
              >
                <option value="">Genel Firma</option>
                {projeler.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.ad}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cari / Ekip">
              <input
                className={cls.input}
                value={modal.cari_ekip || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, cari_ekip: e.target.value }))}
              />
            </Field>

            <Field label="Vade" required>
              <input
                type="date"
                className={cls.input}
                value={modal.vade || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, vade: e.target.value }))}
              />
            </Field>

            <Field label="Durum" required>
              <select
                className={cls.input}
                value={modal.durum || 'Bekliyor'}
                onChange={(e) => setModal((prev) => ({ ...prev!, durum: e.target.value }))}
              >
                {DURUM_SECENEKLERI.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Hatirlatma">
              <div className="relative">
                <Bell size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  className={`${cls.input} pl-10`}
                  value={modal.hatirlatma ? String(modal.hatirlatma).slice(0, 16) : ''}
                  onChange={(e) => setModal((prev) => ({ ...prev!, hatirlatma: e.target.value }))}
                />
              </div>
            </Field>

            <Field label="Tutar" required>
              <input
                type="number"
                step="0.01"
                min="0"
                className={cls.input}
                value={modal.tutar ?? ''}
                onChange={(e) =>
                  setModal((prev) => ({
                    ...prev!,
                    tutar: e.target.value === '' ? 0 : Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmModal
          title="Kaydi Sil"
          message="Bu kaydi silmek istediginizden emin misiniz?"
          danger
          onConfirm={deleteKayit}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
  money = false,
}: {
  label: string
  value: number
  tone: 'cyan' | 'emerald' | 'amber'
  money?: boolean
}) {
  const tones = {
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  }

  return (
    <div className={`rounded-2xl border px-5 py-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold">
        {money ? formatMoney(value) : value}
      </p>
    </div>
  )
}