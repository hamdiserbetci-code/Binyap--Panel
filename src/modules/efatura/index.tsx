'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Receipt, Plus, Pencil, Trash2, Search, RefreshCw,
  CheckCircle2, Clock, AlertCircle, FileDown, X,
  BookOpen, Archive, FileText, ChevronDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, Modal, Field, Loading, ConfirmModal } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Sirket } from '@/types'

// ── Tipler ────────────────────────────────────────────────────────────────────

type EFaturaTip = 'efatura' | 'earsiv' | 'edefter'
type EFaturaDurum = 'bekliyor' | 'hazirlaniyor' | 'yuklendi' | 'onaylandi' | 'reddedildi' | 'iptal'
type EDefterTip = 'yevmiye' | 'kebir'

interface EFaturaKayit {
  id: string
  firma_id: string
  sirket_id?: string | null
  sirket?: Sirket | null
  tip: EFaturaTip
  donem: string
  belge_no?: string | null
  taraf_adi?: string | null
  taraf_vkn?: string | null
  tutar: number
  kdv_tutari: number
  toplam_tutar: number
  durum: EFaturaDurum
  yukleme_tarihi?: string | null
  onay_tarihi?: string | null
  gib_referans_no?: string | null
  edefter_tip?: EDefterTip | null
  notlar?: string | null
  created_at?: string
}

// ── Sabitler ──────────────────────────────────────────────────────────────────

const TIP_LABEL: Record<EFaturaTip, string> = {
  efatura: 'E-Fatura',
  earsiv: 'E-Arşiv',
  edefter: 'E-Defter',
}

const TIP_COLOR: Record<EFaturaTip, string> = {
  efatura: 'bg-blue-50 text-blue-700 border-blue-200',
  earsiv: 'bg-violet-50 text-violet-700 border-violet-200',
  edefter: 'bg-teal-50 text-teal-700 border-teal-200',
}

const TIP_ICON: Record<EFaturaTip, typeof Receipt> = {
  efatura: Receipt,
  earsiv: Archive,
  edefter: BookOpen,
}

const DURUM_LABEL: Record<EFaturaDurum, string> = {
  bekliyor: 'Bekliyor',
  hazirlaniyor: 'Hazırlanıyor',
  yuklendi: 'GİB\'e Yüklendi',
  onaylandi: 'Onaylandı',
  reddedildi: 'Reddedildi',
  iptal: 'İptal',
}

const DURUM_COLOR: Record<EFaturaDurum, string> = {
  bekliyor: 'bg-slate-100 text-slate-600 border-slate-200',
  hazirlaniyor: 'bg-amber-50 text-amber-700 border-amber-200',
  yuklendi: 'bg-blue-50 text-blue-700 border-blue-200',
  onaylandi: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reddedildi: 'bg-rose-50 text-rose-700 border-rose-200',
  iptal: 'bg-slate-100 text-slate-400 border-slate-200',
}

const EDEFTER_TIP_LABEL: Record<EDefterTip, string> = {
  yevmiye: 'Yevmiye Defteri',
  kebir: 'Büyük Defter (Kebir)',
}

const DURUM_AKIS: Record<EFaturaDurum, EFaturaDurum[]> = {
  bekliyor: ['hazirlaniyor'],
  hazirlaniyor: ['yuklendi', 'iptal'],
  yuklendi: ['onaylandi', 'reddedildi'],
  onaylandi: [],
  reddedildi: ['hazirlaniyor'],
  iptal: [],
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function getDonem() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EMPTY_FORM: Partial<EFaturaKayit> = {
  tip: 'efatura',
  donem: getDonem(),
  durum: 'bekliyor',
  tutar: 0,
  kdv_tutari: 0,
  toplam_tutar: 0,
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────

export default function EfaturaModule({ firma, firmalar, firmaIds }: AppCtx) {
  const [kayitlar, setKayitlar] = useState<EFaturaKayit[]>([])
  const [sirketler, setSirketler] = useState<Sirket[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTip, setFilterTip] = useState<EFaturaTip | 'all'>('all')
  const [filterDurum, setFilterDurum] = useState<EFaturaDurum | 'all'>('all')
  const [filterDonem, setFilterDonem] = useState('')
  const [modal, setModal] = useState<Partial<EFaturaKayit> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selFirmaId, setSelFirmaId] = useState(firma.id)
  const [activeTab, setActiveTab] = useState<EFaturaTip | 'all'>('all')

  useEffect(() => { loadAll() }, [firmaIds.join(',')])

  async function loadAll() {
    setLoading(true)
    const [kRes, sRes] = await Promise.all([
      supabase
        .from('efatura_kayitlari')
        .select('*, sirket:sirketler(*)')
        .in('firma_id', firmaIds)
        .order('donem', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('sirketler').select('*').in('firma_id', firmaIds).eq('aktif', true),
    ])
    setKayitlar((kRes.data || []) as EFaturaKayit[])
    setSirketler((sRes.data || []) as Sirket[])
    setLoading(false)
  }

  async function save() {
    if (!modal?.tip || !modal?.donem) { alert('Tip ve dönem zorunludur.'); return }
    setSaving(true)
    const payload = {
      firma_id: modal.id ? (modal.firma_id || firma.id) : selFirmaId,
      sirket_id: modal.sirket_id || null,
      tip: modal.tip,
      donem: modal.donem,
      belge_no: modal.belge_no || null,
      taraf_adi: modal.taraf_adi || null,
      taraf_vkn: modal.taraf_vkn || null,
      tutar: Number(modal.tutar || 0),
      kdv_tutari: Number(modal.kdv_tutari || 0),
      toplam_tutar: Number(modal.toplam_tutar || 0),
      durum: modal.durum || 'bekliyor',
      yukleme_tarihi: modal.yukleme_tarihi || null,
      onay_tarihi: modal.onay_tarihi || null,
      gib_referans_no: modal.gib_referans_no || null,
      edefter_tip: modal.tip === 'edefter' ? (modal.edefter_tip || 'yevmiye') : null,
      notlar: modal.notlar || null,
    }
    const { error } = modal.id
      ? await supabase.from('efatura_kayitlari').update(payload).eq('id', modal.id)
      : await supabase.from('efatura_kayitlari').insert(payload)
    setSaving(false)
    if (error) { alert(error.message); return }
    setModal(null)
    await loadAll()
  }

  async function updateDurum(k: EFaturaKayit, yeniDurum: EFaturaDurum) {
    const updates: Partial<EFaturaKayit> = { durum: yeniDurum }
    if (yeniDurum === 'yuklendi') updates.yukleme_tarihi = todayStr()
    if (yeniDurum === 'onaylandi') updates.onay_tarihi = todayStr()
    await supabase.from('efatura_kayitlari').update(updates).eq('id', k.id)
    await loadAll()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('efatura_kayitlari').delete().eq('id', deleteId)
    setDeleteId(null)
    await loadAll()
  }

  const filtered = useMemo(() => kayitlar.filter(k => {
    if (activeTab !== 'all' && k.tip !== activeTab) return false
    if (filterTip !== 'all' && k.tip !== filterTip) return false
    if (filterDurum !== 'all' && k.durum !== filterDurum) return false
    if (filterDonem && !k.donem.startsWith(filterDonem)) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        k.donem.includes(q) ||
        (k.belge_no || '').toLowerCase().includes(q) ||
        (k.taraf_adi || '').toLowerCase().includes(q) ||
        (k.taraf_vkn || '').toLowerCase().includes(q) ||
        (k.gib_referans_no || '').toLowerCase().includes(q)
      )
    }
    return true
  }), [kayitlar, activeTab, filterTip, filterDurum, filterDonem, search])

  const stats = useMemo(() => {
    const all = kayitlar
    return {
      efatura: all.filter(k => k.tip === 'efatura').length,
      earsiv: all.filter(k => k.tip === 'earsiv').length,
      edefter: all.filter(k => k.tip === 'edefter').length,
      bekliyor: all.filter(k => k.durum === 'bekliyor').length,
      onaylandi: all.filter(k => k.durum === 'onaylandi').length,
      reddedildi: all.filter(k => k.durum === 'reddedildi').length,
      toplamTutar: all.filter(k => k.tip !== 'edefter').reduce((s, k) => s + Number(k.toplam_tutar || 0), 0),
    }
  }, [kayitlar])

  if (loading) return <Loading />

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50">
              <Receipt size={18} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-slate-800">E-Fatura / E-Arşiv / E-Defter</h1>
              <p className="text-[12px] text-slate-500">GİB süreçlerini takip edin — yükleme, onay ve referans yönetimi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className={cls.btnSecondary}>
              <RefreshCw size={14} /> Yenile
            </button>
            <button
              onClick={() => setModal({ ...EMPTY_FORM, tip: activeTab === 'all' ? 'efatura' : activeTab })}
              className={cls.btnPrimary}
            >
              <Plus size={14} /> Yeni Kayıt
            </button>
          </div>
        </div>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="E-Fatura" value={stats.efatura} sub="kayıt" color="blue" icon={Receipt} onClick={() => setActiveTab('efatura')} active={activeTab === 'efatura'} />
        <StatCard label="E-Arşiv" value={stats.earsiv} sub="kayıt" color="violet" icon={Archive} onClick={() => setActiveTab('earsiv')} active={activeTab === 'earsiv'} />
        <StatCard label="E-Defter" value={stats.edefter} sub="kayıt" color="teal" icon={BookOpen} onClick={() => setActiveTab('edefter')} active={activeTab === 'edefter'} />
        <StatCard label="Bekliyor" value={stats.bekliyor} sub="işlem" color="amber" icon={Clock} onClick={() => setFilterDurum('bekliyor')} active={filterDurum === 'bekliyor'} />
        <StatCard label="Onaylandı" value={stats.onaylandi} sub="işlem" color="emerald" icon={CheckCircle2} onClick={() => setFilterDurum('onaylandi')} active={filterDurum === 'onaylandi'} />
        <StatCard label="Reddedildi" value={stats.reddedildi} sub="işlem" color="rose" icon={AlertCircle} onClick={() => setFilterDurum('reddedildi')} active={filterDurum === 'reddedildi'} />
      </div>

      {/* Sekme çubuğu */}
      <div className="flex items-center gap-1 border-b border-blue-100">
        {(['all', 'efatura', 'earsiv', 'edefter'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setActiveTab(t); setFilterTip('all') }}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${activeTab === t ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'all' ? 'Tümü' : TIP_LABEL[t]}
          </button>
        ))}
        {(activeTab !== 'all' || filterDurum !== 'all') && (
          <button
            onClick={() => { setActiveTab('all'); setFilterDurum('all') }}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={12} /> Filtreyi Temizle
          </button>
        )}
      </div>

      {/* Araç çubuğu */}
      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Belge no, taraf, referans ara..."
            className="w-full bg-slate-50 border border-blue-100 rounded-xl pl-9 pr-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterDurum}
          onChange={e => setFilterDurum(e.target.value as any)}
          className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
        >
          <option value="all">Tüm Durumlar</option>
          {Object.entries(DURUM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input
          type="month"
          value={filterDonem}
          onChange={e => setFilterDonem(e.target.value)}
          className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
          title="Döneme göre filtrele"
        />
      </div>

      {/* Tablo */}
      <div className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <FileText size={32} className="opacity-30" />
            <p className="text-[13px] font-medium">Gösterilecek kayıt bulunamadı.</p>
            <button
              onClick={() => setModal({ ...EMPTY_FORM, tip: activeTab === 'all' ? 'efatura' : activeTab })}
              className={cls.btnPrimary}
            >
              <Plus size={14} /> İlk Kaydı Ekle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-blue-100">
                <tr>
                  <th className={cls.th}>Tip</th>
                  <th className={cls.th}>Dönem</th>
                  <th className={cls.th}>Belge No</th>
                  <th className={cls.th}>Taraf</th>
                  <th className={cls.th}>Durum</th>
                  <th className={cls.th + ' text-right'}>Toplam Tutar</th>
                  <th className={cls.th}>GİB Ref. No</th>
                  <th className={cls.th}>Tarihler</th>
                  <th className={cls.th + ' text-right'}>İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(k => {
                  const Icon = TIP_ICON[k.tip]
                  const sonrakiDurumlar = DURUM_AKIS[k.durum]
                  return (
                    <tr key={k.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className={cls.td}>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${TIP_COLOR[k.tip]}`}>
                          <Icon size={11} />
                          {TIP_LABEL[k.tip]}
                          {k.tip === 'edefter' && k.edefter_tip && (
                            <span className="ml-0.5 opacity-70">· {EDEFTER_TIP_LABEL[k.edefter_tip]}</span>
                          )}
                        </span>
                        {k.sirket && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{k.sirket.kod}</div>
                        )}
                      </td>
                      <td className={cls.td}>
                        <span className="font-bold text-slate-700">{k.donem}</span>
                        {firmalar.length > 1 && (
                          <div className="text-[10px] text-slate-400">{firmalar.find(f => f.id === k.firma_id)?.kisa_ad || ''}</div>
                        )}
                      </td>
                      <td className={cls.td}>
                        <span className="font-mono text-[12px] text-slate-600">{k.belge_no || <span className="text-slate-300">—</span>}</span>
                      </td>
                      <td className={cls.td}>
                        {k.taraf_adi ? (
                          <>
                            <div className="font-medium text-slate-700 max-w-[160px] truncate">{k.taraf_adi}</div>
                            {k.taraf_vkn && <div className="text-[10px] text-slate-400 font-mono">{k.taraf_vkn}</div>}
                          </>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={cls.td}>
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${DURUM_COLOR[k.durum]}`}>
                          {DURUM_LABEL[k.durum]}
                        </span>
                      </td>
                      <td className={cls.td + ' text-right'}>
                        {k.tip !== 'edefter' ? (
                          <span className="font-semibold text-slate-700">
                            {Number(k.toplam_tutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={cls.td}>
                        <span className="font-mono text-[11px] text-slate-500">{k.gib_referans_no || <span className="text-slate-300">—</span>}</span>
                      </td>
                      <td className={cls.td}>
                        <div className="flex flex-col gap-0.5 text-[11px] text-slate-500">
                          {k.yukleme_tarihi && (
                            <span><span className="text-slate-400">Yükleme:</span> {new Date(k.yukleme_tarihi).toLocaleDateString('tr-TR')}</span>
                          )}
                          {k.onay_tarihi && (
                            <span><span className="text-emerald-500">Onay:</span> {new Date(k.onay_tarihi).toLocaleDateString('tr-TR')}</span>
                          )}
                        </div>
                      </td>
                      <td className={cls.td + ' text-right'}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {sonrakiDurumlar.map(sd => (
                            <button
                              key={sd}
                              onClick={() => updateDurum(k, sd)}
                              className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
                                sd === 'onaylandi' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                sd === 'reddedildi' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' :
                                sd === 'yuklendi' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                sd === 'iptal' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' :
                                'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              }`}
                            >
                              {DURUM_LABEL[sd]}
                            </button>
                          ))}
                          <button
                            onClick={() => setModal(k)}
                            className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 ml-1"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteId(k.id)}
                            className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alt bilgi */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-[12px] text-slate-400 px-1">
          <span>{filtered.length} kayıt gösteriliyor</span>
          {filtered.some(k => k.tip !== 'edefter') && (
            <span>
              Toplam Tutar:{' '}
              <span className="font-bold text-slate-600">
                {filtered.filter(k => k.tip !== 'edefter').reduce((s, k) => s + Number(k.toplam_tutar || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </span>
            </span>
          )}
        </div>
      )}

      {/* Kayıt Modal */}
      {modal && (
        <KayitModal
          modal={modal}
          setModal={setModal}
          firmalar={firmalar}
          sirketler={sirketler}
          selFirmaId={selFirmaId}
          setSelFirmaId={setSelFirmaId}
          saving={saving}
          onSave={save}
        />
      )}

      {deleteId && (
        <ConfirmModal
          title="Kaydı Sil"
          message="Bu kayıt kalıcı olarak silinecektir. Emin misiniz?"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

// ── Kayıt Modal ───────────────────────────────────────────────────────────────

function KayitModal({
  modal, setModal, firmalar, sirketler, selFirmaId, setSelFirmaId, saving, onSave
}: {
  modal: Partial<EFaturaKayit>
  setModal: (v: Partial<EFaturaKayit> | null) => void
  firmalar: any[]
  sirketler: Sirket[]
  selFirmaId: string
  setSelFirmaId: (v: string) => void
  saving: boolean
  onSave: () => void
}) {
  function set(patch: Partial<EFaturaKayit>) { setModal({ ...modal, ...patch }) }

  const isEdefter = modal.tip === 'edefter'

  return (
    <Modal
      title={modal.id ? 'Kaydı Düzenle' : 'Yeni Kayıt'}
      onClose={() => setModal(null)}
      size="lg"
      footer={
        <>
          <button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button>
          <button onClick={onSave} disabled={saving} className={cls.btnPrimary}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <div className="space-y-4">

        {/* Tip seçimi */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Kayıt Tipi</label>
          <div className="flex gap-2">
            {(['efatura', 'earsiv', 'edefter'] as EFaturaTip[]).map(t => {
              const Icon = TIP_ICON[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set({ tip: t, edefter_tip: t === 'edefter' ? 'yevmiye' : undefined })}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-[12px] font-semibold transition-all ${
                    modal.tip === t
                      ? `${TIP_COLOR[t]} border-current`
                      : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                  }`}
                >
                  <Icon size={16} />
                  {TIP_LABEL[t]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Firma + Şirket */}
        <div className="grid grid-cols-2 gap-4">
          {!modal.id && firmalar.length > 1 && (
            <Field label="Firma">
              <select className={cls.input} value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
              </select>
            </Field>
          )}
          {sirketler.length > 0 && (
            <Field label="Şirket">
              <select className={cls.input} value={modal.sirket_id || ''} onChange={e => set({ sirket_id: e.target.value || undefined })}>
                <option value="">Seçiniz</option>
                {sirketler
                  .filter(s => s.firma_id === (modal.id ? modal.firma_id : selFirmaId))
                  .map(s => <option key={s.id} value={s.id}>{s.kod} - {s.ad}</option>)}
              </select>
            </Field>
          )}
        </div>

        {/* Dönem + E-Defter tipi */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dönem" required>
            <input type="month" className={cls.input} value={modal.donem || ''} onChange={e => set({ donem: e.target.value })} />
          </Field>
          {isEdefter ? (
            <Field label="Defter Tipi">
              <select className={cls.input} value={modal.edefter_tip || 'yevmiye'} onChange={e => set({ edefter_tip: e.target.value as EDefterTip })}>
                {Object.entries(EDEFTER_TIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Belge No">
              <input className={cls.input} value={modal.belge_no || ''} onChange={e => set({ belge_no: e.target.value })} placeholder="INV-2025-001" />
            </Field>
          )}
        </div>

        {/* Taraf bilgileri (E-Fatura / E-Arşiv) */}
        {!isEdefter && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Taraf Adı">
              <input className={cls.input} value={modal.taraf_adi || ''} onChange={e => set({ taraf_adi: e.target.value })} placeholder="Müşteri / Tedarikçi adı" />
            </Field>
            <Field label="VKN / TCKN">
              <input className={cls.input} value={modal.taraf_vkn || ''} onChange={e => set({ taraf_vkn: e.target.value })} placeholder="1234567890" maxLength={11} />
            </Field>
          </div>
        )}

        {/* Tutar (E-Defter için gösterme) */}
        {!isEdefter && (
          <div className="grid grid-cols-3 gap-4">
            <Field label="Matrah (₺)">
              <input
                type="number" step="0.01" className={cls.input}
                value={modal.tutar || ''}
                onChange={e => {
                  const tutar = Number(e.target.value || 0)
                  const kdv = Number(modal.kdv_tutari || 0)
                  set({ tutar, toplam_tutar: tutar + kdv })
                }}
              />
            </Field>
            <Field label="KDV (₺)">
              <input
                type="number" step="0.01" className={cls.input}
                value={modal.kdv_tutari || ''}
                onChange={e => {
                  const kdv = Number(e.target.value || 0)
                  const tutar = Number(modal.tutar || 0)
                  set({ kdv_tutari: kdv, toplam_tutar: tutar + kdv })
                }}
              />
            </Field>
            <Field label="Toplam (₺)">
              <input
                type="number" step="0.01" className={cls.input + ' bg-slate-50 font-bold'}
                value={modal.toplam_tutar || ''}
                onChange={e => set({ toplam_tutar: Number(e.target.value || 0) })}
              />
            </Field>
          </div>
        )}

        {/* Durum */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Durum">
            <select className={cls.input} value={modal.durum || 'bekliyor'} onChange={e => set({ durum: e.target.value as EFaturaDurum })}>
              {Object.entries(DURUM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="GİB Referans No">
            <input className={cls.input} value={modal.gib_referans_no || ''} onChange={e => set({ gib_referans_no: e.target.value })} placeholder="GIB-..." />
          </Field>
        </div>

        {/* Tarihler */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Yükleme Tarihi">
            <input type="date" className={cls.input} value={modal.yukleme_tarihi || ''} onChange={e => set({ yukleme_tarihi: e.target.value })} />
          </Field>
          <Field label="Onay Tarihi">
            <input type="date" className={cls.input} value={modal.onay_tarihi || ''} onChange={e => set({ onay_tarihi: e.target.value })} />
          </Field>
        </div>

        {/* Notlar */}
        <Field label="Notlar">
          <textarea className={`${cls.input} resize-none`} rows={2} value={modal.notlar || ''} onChange={e => set({ notlar: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-200' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-200' },
}

function StatCard({ label, value, sub, color, icon: Icon, onClick, active }: {
  label: string; value: number; sub: string; color: string
  icon: typeof Receipt; onClick: () => void; active: boolean
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${active ? `${c.bg} ${c.border}` : 'bg-white border-blue-100 hover:border-blue-200'}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.bg}`}>
        <Icon size={15} className={c.text} />
      </div>
      <div className={`text-[22px] font-bold ${active ? c.text : 'text-slate-800'}`}>{value}</div>
      <div className="text-[11px] font-semibold text-slate-500 leading-tight">{label}</div>
      <div className="text-[10px] text-slate-400">{sub}</div>
    </button>
  )
}
