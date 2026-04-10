'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Search, FolderKanban, X,
  CalendarRange, CheckCircle2, Clock4, PauseCircle,
  ChevronDown, ChevronRight, Users, Wrench, Trees,
  HardHat, UserCog, MoreHorizontal,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, Loading, ErrorMsg, Modal, Field } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Ekip, Proje } from '@/types'

// ── Kategori Tanımları ────────────────────────────────────────────────────
export const EKİP_KATEGORİLER: {
  key: string
  label: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
}[] = [
  { key: 'demirci',     label: 'Demirci',     icon: Wrench,       color: 'text-orange-300',  bg: 'bg-orange-500/10',  border: 'border-orange-500/25'  },
  { key: 'ahsapci',     label: 'Ahşapçı',     icon: Trees,        color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25'   },
  { key: 'tunel_kalip', label: 'Tünel Kalıp', icon: HardHat,      color: 'text-cyan-300',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/25'    },
  { key: 'personel',    label: 'Personel',    icon: UserCog,      color: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25'    },
  { key: 'diger',       label: 'Diğer',       icon: MoreHorizontal, color: 'text-slate-400', bg: 'bg-slate-500/10',   border: 'border-slate-500/25'   },
]

export function getKategori(key?: string | null) {
  return EKİP_KATEGORİLER.find(k => k.key === key) ?? EKİP_KATEGORİLER[4]
}

// ── Proje Durum Tanımları ─────────────────────────────────────────────────
const DURUM_OPTIONS: { value: Proje['durum']; label: string }[] = [
  { value: 'aktif',      label: 'Aktif'      },
  { value: 'beklemede',  label: 'Beklemede'  },
  { value: 'tamamlandi', label: 'Tamamlandı' },
]

const DURUM_STYLE: Record<Proje['durum'], { icon: React.ElementType; bg: string; text: string; border: string }> = {
  aktif:      { icon: CheckCircle2, bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/25' },
  beklemede:  { icon: PauseCircle,  bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/25'   },
  tamamlandi: { icon: Clock4,       bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/25'   },
}

const PROJE_EMPTY: Omit<Proje, 'id' | 'firma_id'> = {
  ad: '', durum: 'aktif', baslangic: '', bitis: '', sgk_sicil_no: '',
}

const EKİP_EMPTY: Omit<Ekip, 'id' | 'firma_id' | 'proje_id'> = {
  ad: '', kategori: 'demirci', renk: '#4b9cf5', aktif: true,
}

// ── Component ─────────────────────────────────────────────────────────────
export default function ProjelerModule({ firma, firmalar, firmaIds }: AppCtx) {
  const [projeler, setProjeler]   = useState<Proje[]>([])
  const [ekipler, setEkipler]     = useState<Ekip[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [filterDurum, setFilterDurum] = useState<Proje['durum'] | 'hepsi'>('hepsi')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Proje modal
  const [projeModal, setProjeModal] = useState<Partial<Proje> | null>(null)
  const [delProje, setDelProje]     = useState<Proje | null>(null)
  const [projeErr, setProjeErr]     = useState('')
  const [projeSaving, setProjeSaving] = useState(false)
  const [projeDeleting, setProjeDeleting] = useState(false)

  // Ekip modal
  const [ekipModal, setEkipModal]   = useState<{ proje_id: string; ekip: Partial<Ekip> } | null>(null)
  const [delEkip, setDelEkip]       = useState<Ekip | null>(null)
  const [ekipErr, setEkipErr]       = useState('')
  const [ekipSaving, setEkipSaving] = useState(false)
  const [ekipDeleting, setEkipDeleting] = useState(false)

  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  useEffect(() => { void load() }, [firmaIds.join(',')])

  async function load() {
    setLoading(true); setError('')
    const [{ data: p, error: pe }, { data: e, error: ee }] = await Promise.all([
      supabase.from('projeler').select('*').in('firma_id', firmaIds).order('ad'),
      supabase.from('ekipler').select('*').in('firma_id', firmaIds).order('ad'),
    ])
    if (pe || ee) { setError(pe?.message || ee?.message || 'Hata'); setLoading(false); return }
    setProjeler((p || []) as Proje[])
    setEkipler((e || []) as Ekip[])
    setLoading(false)
  }

  // ── Filtreler ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => projeler.filter(p => {
    const matchSearch = !search ||
      p.ad.toLowerCase().includes(search.toLowerCase()) ||
      (p.sgk_sicil_no || '').toLowerCase().includes(search.toLowerCase())
    const matchDurum = filterDurum === 'hepsi' || p.durum === filterDurum
    return matchSearch && matchDurum
  }), [projeler, search, filterDurum])

  const counts = useMemo(() => ({
    aktif:      projeler.filter(p => p.durum === 'aktif').length,
    beklemede:  projeler.filter(p => p.durum === 'beklemede').length,
    tamamlandi: projeler.filter(p => p.durum === 'tamamlandi').length,
  }), [projeler])

  // ── Proje İşlemleri ───────────────────────────────────────────────────
  async function saveProje() {
    if (!projeModal?.ad?.trim()) { setProjeErr('Proje adı zorunludur'); return }
    setProjeSaving(true); setProjeErr('')
    const payload = {
      firma_id: projeModal.id ? (projeModal.firma_id || firma.id) : selFirmaId,
      ad: projeModal.ad.trim(),
      durum: projeModal.durum ?? 'aktif',
      baslangic: projeModal.baslangic || null,
      bitis: projeModal.bitis || null,
      sgk_sicil_no: projeModal.sgk_sicil_no?.trim() || null,
    }
    if (projeModal.id) {
      const { error: e } = await supabase.from('projeler').update(payload).eq('id', projeModal.id)
      if (e) { setProjeErr(e.message); setProjeSaving(false); return }
      setProjeler(prev => prev.map(p => p.id === projeModal.id ? { ...p, ...payload } as Proje : p))
    } else {
      const { data, error: e } = await supabase.from('projeler').insert(payload).select().single()
      if (e) { setProjeErr(e.message); setProjeSaving(false); return }
      if (data) {
        setProjeler(prev => [...prev, data as Proje].sort((a, b) => a.ad.localeCompare(b.ad, 'tr')))
        setExpandedId((data as Proje).id)
      }
    }
    setProjeSaving(false); setProjeModal(null)
  }

  async function deleteProje() {
    if (!delProje) return
    setProjeDeleting(true)
    const { error: e } = await supabase.from('projeler').delete().eq('id', delProje.id)
    setProjeDeleting(false)
    if (e) { alert(e.message); return }
    setProjeler(prev => prev.filter(p => p.id !== delProje.id))
    setEkipler(prev => prev.filter(e => e.proje_id !== delProje.id))
    if (expandedId === delProje.id) setExpandedId(null)
    setDelProje(null)
  }

  // ── Ekip İşlemleri ────────────────────────────────────────────────────
  async function saveEkip() {
    if (!ekipModal?.ekip?.ad?.trim()) { setEkipErr('Ekip adı zorunludur'); return }
    setEkipSaving(true); setEkipErr('')
    const { ekip, proje_id } = ekipModal
    const payload = {
      firma_id: ekip.id ? (ekip.firma_id || firma.id) : selFirmaId,
      proje_id,
      ad: ekip.ad!.trim(),
      kategori: ekip.kategori || 'diger',
      renk: ekip.renk || '#4b9cf5',
      aktif: ekip.aktif ?? true,
    }
    if (ekip.id) {
      const { error: e } = await supabase.from('ekipler').update(payload).eq('id', ekip.id)
      if (e) { setEkipErr(e.message); setEkipSaving(false); return }
      setEkipler(prev => prev.map(x => x.id === ekip.id ? { ...x, ...payload } as Ekip : x))
    } else {
      const { data, error: e } = await supabase.from('ekipler').insert(payload).select().single()
      if (e) { setEkipErr(e.message); setEkipSaving(false); return }
      if (data) setEkipler(prev => [...prev, data as Ekip])
    }
    setEkipSaving(false); setEkipModal(null)
  }

  async function deleteEkip() {
    if (!delEkip) return
    setEkipDeleting(true)
    const { error: e } = await supabase.from('ekipler').delete().eq('id', delEkip.id)
    setEkipDeleting(false)
    if (e) { alert(e.message); return }
    setEkipler(prev => prev.filter(x => x.id !== delEkip.id))
    setDelEkip(null)
  }

  if (loading) return <Loading />
  if (error)   return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">Proje & Ekip Yönetimi</h1>
          <p className="text-xs text-slate-500 mt-0.5">{projeler.length} proje · {ekipler.length} ekip</p>
        </div>
        <button onClick={() => { setProjeErr(''); setProjeModal({ ...PROJE_EMPTY }) }} className={cls.btnPrimary}>
          <Plus size={15} /> Yeni Proje
        </button>
      </div>

      {/* ── Özet Kartlar ── */}
      <div className="grid grid-cols-3 gap-3">
        {DURUM_OPTIONS.map(({ value, label }) => {
          const st = DURUM_STYLE[value]
          const Icon = st.icon
          const isActive = filterDurum === value
          return (
            <button key={value}
              onClick={() => setFilterDurum(isActive ? 'hepsi' : value)}
              className={[
                'flex flex-col items-start gap-1 px-4 py-3 rounded-xl border transition-all text-left',
                isActive ? `${st.bg} ${st.border} ring-1 ring-inset ring-current`
                  : 'border-slate-100 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <Icon size={13} className={isActive ? st.text : 'text-slate-400'} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? st.text : 'text-slate-500'}`}>{label}</span>
              </div>
              <span className="text-2xl font-bold text-slate-800 tabular-nums">{counts[value]}</span>
            </button>
          )
        })}
      </div>

      {/* ── Arama ── */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Proje adı veya SGK sicil no ara..."
          className={cls.input + ' pl-9'}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 transition">
            <X size={12} className="text-slate-500" />
          </button>
        )}
      </div>

      {/* ── Proje Listesi ── */}
      {filtered.length === 0 ? (
        <div className={`${cls.card} flex flex-col items-center justify-center py-16 gap-3`}>
          <FolderKanban size={32} className="text-slate-300" />
          <p className="text-sm text-slate-400 font-medium">
            {search || filterDurum !== 'hepsi' ? 'Eşleşen proje bulunamadı' : 'Henüz proje eklenmemiş'}
          </p>
          {!search && filterDurum === 'hepsi' && (
            <button onClick={() => { setProjeErr(''); setProjeModal({ ...PROJE_EMPTY }) }} className={cls.btnPrimary + ' mt-1'}>
              <Plus size={14} /> İlk Projeyi Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(proje => {
            const st = DURUM_STYLE[proje.durum]
            const Icon = st.icon
            const isExpanded = expandedId === proje.id
            const projeEkipler = ekipler.filter(e => e.proje_id === proje.id)
            const ekipCount = projeEkipler.length

            return (
              <div key={proje.id} className={`${cls.card} overflow-hidden transition-all`}>
                {/* ── Proje Başlığı ── */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : proje.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hover:bg-slate-100 transition"
                  >
                    {isExpanded
                      ? <ChevronDown size={14} className="text-slate-500" />
                      : <ChevronRight size={14} className="text-slate-500" />
                    }
                  </button>

                  {/* İkon */}
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${st.bg} ${st.border}`}>
                    <FolderKanban size={15} className={st.text} />
                  </div>

                  {/* Bilgi */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : proje.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{proje.ad}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.text} ${st.border}`}>
                        <Icon size={10} />{DURUM_OPTIONS.find(d => d.value === proje.durum)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Users size={10} />
                        {ekipCount} ekip
                        {ekipCount > 0 && (
                          <span className="ml-1">
                            {EKİP_KATEGORİLER.filter(k => projeEkipler.some(e => (e.kategori || 'diger') === k.key))
                              .map(k => (
                                <span key={k.key} className={`${k.color} opacity-70 text-[10px] font-semibold mr-1`}>{k.label}</span>
                              ))}
                          </span>
                        )}
                      </span>
                      {proje.sgk_sicil_no && (
                        <span className="text-xs text-slate-400">SGK: {proje.sgk_sicil_no}</span>
                      )}
                      {(proje.baslangic || proje.bitis) && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <CalendarRange size={10} />
                          {proje.baslangic ? new Date(proje.baslangic).toLocaleDateString('tr-TR') : '—'}
                          {' → '}
                          {proje.bitis ? new Date(proje.bitis).toLocaleDateString('tr-TR') : '—'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aksiyonlar */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setProjeErr(''); setProjeModal({ ...proje }) }}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDelProje(proje)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* ── Ekipler (Expanded) ── */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
                    {/* Başlık */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Ekipler
                      </span>
                      <button
                        onClick={() => { setEkipErr(''); setEkipModal({ proje_id: proje.id, ekip: { ...EKİP_EMPTY } }) }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-slate-900 transition px-2 py-1 rounded-lg hover:bg-blue-50"
                      >
                        <Plus size={12} /> Ekip Ekle
                      </button>
                    </div>

                    {projeEkipler.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-xs text-slate-400">Bu projeye henüz ekip atanmamış</p>
                        <button
                          onClick={() => { setEkipErr(''); setEkipModal({ proje_id: proje.id, ekip: { ...EKİP_EMPTY } }) }}
                          className="mt-2 text-xs text-blue-500 hover:text-slate-900 transition font-semibold"
                        >
                          + İlk ekibi ekle
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {EKİP_KATEGORİLER.map(kat => {
                          const katEkipler = projeEkipler.filter(e => (e.kategori || 'diger') === kat.key)
                          if (katEkipler.length === 0) return null
                          const KatIcon = kat.icon
                          return (
                            <div key={kat.key}>
                              {/* Kategori Başlığı */}
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-2 ${kat.bg} border ${kat.border}`}>
                                <KatIcon size={12} className={kat.color} />
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${kat.color}`}>{kat.label}</span>
                                <span className="text-[10px] text-slate-500 ml-auto">{katEkipler.length} ekip</span>
                              </div>
                              {/* Ekip Kartları */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-1">
                                {katEkipler.map(ekip => (
                                  <div key={ekip.id}
                                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-100 bg-white group hover:border-slate-200 transition"
                                  >
                                    <div
                                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-slate-800 font-bold text-xs"
                                      style={{ backgroundColor: ekip.renk ? `${ekip.renk}33` : '#4b9cf533', border: `1px solid ${ekip.renk || '#4b9cf5'}44` }}
                                    >
                                      {ekip.ad.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-slate-800 truncate">{ekip.ad}</p>
                                      {ekip.aktif === false && (
                                        <span className="text-[10px] text-rose-400">Pasif</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                                      <button
                                        onClick={() => { setEkipErr(''); setEkipModal({ proje_id: proje.id, ekip: { ...ekip } }) }}
                                        className="p-1 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition"
                                      >
                                        <Pencil size={11} />
                                      </button>
                                      <button
                                        onClick={() => setDelEkip(ekip)}
                                        className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Proje Modal ── */}
      {projeModal && (
        <Modal title={projeModal.id ? 'Projeyi Düzenle' : 'Yeni Proje'} onClose={() => setProjeModal(null)}>
          <div className="space-y-4 p-4">
            {!projeModal.id && firmalar.length > 1 && (
              <Field label="Firma">
                <select className={cls.input} value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                  {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
                </select>
              </Field>
            )}
            <Field label="Proje Adı *">
              <input className={cls.input} autoFocus
                value={projeModal.ad ?? ''}
                onChange={e => setProjeModal(m => m ? { ...m, ad: e.target.value } : m)}
                placeholder="Proje adını girin"
              />
            </Field>
            <Field label="Durum">
              <select className={cls.input}
                value={projeModal.durum ?? 'aktif'}
                onChange={e => setProjeModal(m => m ? { ...m, durum: e.target.value as Proje['durum'] } : m)}
              >
                {DURUM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="SGK Sicil No">
              <input className={cls.input}
                value={projeModal.sgk_sicil_no ?? ''}
                onChange={e => setProjeModal(m => m ? { ...m, sgk_sicil_no: e.target.value } : m)}
                placeholder="Opsiyonel"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Başlangıç">
                <input type="date" className={cls.input}
                  value={projeModal.baslangic ?? ''}
                  onChange={e => setProjeModal(m => m ? { ...m, baslangic: e.target.value } : m)}
                />
              </Field>
              <Field label="Bitiş">
                <input type="date" className={cls.input}
                  value={projeModal.bitis ?? ''}
                  onChange={e => setProjeModal(m => m ? { ...m, bitis: e.target.value } : m)}
                />
              </Field>
            </div>
            {projeErr && <p className="text-xs text-red-400 font-medium">{projeErr}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setProjeModal(null)} className={cls.btnSecondary + ' flex-1'}>İptal</button>
              <button onClick={saveProje} disabled={projeSaving} className={cls.btnPrimary + ' flex-1'}>
                {projeSaving ? 'Kaydediliyor...' : projeModal.id ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Proje Sil ── */}
      {delProje && (
        <Modal title="Projeyi Sil" onClose={() => setDelProje(null)}>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              <span className="text-slate-800 font-semibold">{delProje.ad}</span> projesini ve bu projeye bağlı tüm ekipleri silmek istediğinizden emin misiniz?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDelProje(null)} className={cls.btnSecondary + ' flex-1'}>İptal</button>
              <button onClick={deleteProje} disabled={projeDeleting} className={cls.btnDanger + ' flex-1'}>
                {projeDeleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Ekip Modal ── */}
      {ekipModal && (
        <Modal title={ekipModal.ekip.id ? 'Ekibi Düzenle' : 'Yeni Ekip'} onClose={() => setEkipModal(null)}>
          <div className="space-y-4 p-4">
            <Field label="Ekip Adı *">
              <input className={cls.input} autoFocus
                value={ekipModal.ekip.ad ?? ''}
                onChange={e => setEkipModal(m => m ? { ...m, ekip: { ...m.ekip, ad: e.target.value } } : m)}
                placeholder="Ekip adını girin"
              />
            </Field>
            <Field label="Kategori">
              <div className="grid grid-cols-2 gap-2">
                {EKİP_KATEGORİLER.map(kat => {
                  const KatIcon = kat.icon
                  const isSelected = (ekipModal.ekip.kategori || 'diger') === kat.key
                  return (
                    <button key={kat.key}
                      onClick={() => setEkipModal(m => m ? { ...m, ekip: { ...m.ekip, kategori: kat.key } } : m)}
                      className={[
                        'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all text-left',
                        isSelected ? `${kat.bg} ${kat.border} ${kat.color}` : 'border-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-900',
                      ].join(' ')}
                    >
                      <KatIcon size={14} />
                      {kat.label}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Ekip Rengi">
              <div className="flex items-center gap-3">
                <input type="color"
                  value={ekipModal.ekip.renk ?? '#4b9cf5'}
                  onChange={e => setEkipModal(m => m ? { ...m, ekip: { ...m.ekip, renk: e.target.value } } : m)}
                  className="w-10 h-10 rounded-lg border border-slate-200 bg-transparent cursor-pointer"
                />
                <span className="text-sm text-slate-500 font-mono">{ekipModal.ekip.renk ?? '#4b9cf5'}</span>
              </div>
            </Field>
            <Field label="Durum">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                  checked={ekipModal.ekip.aktif ?? true}
                  onChange={e => setEkipModal(m => m ? { ...m, ekip: { ...m.ekip, aktif: e.target.checked } } : m)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="text-sm text-slate-600">Aktif ekip</span>
              </label>
            </Field>
            {ekipErr && <p className="text-xs text-red-400 font-medium">{ekipErr}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEkipModal(null)} className={cls.btnSecondary + ' flex-1'}>İptal</button>
              <button onClick={saveEkip} disabled={ekipSaving} className={cls.btnPrimary + ' flex-1'}>
                {ekipSaving ? 'Kaydediliyor...' : ekipModal.ekip.id ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Ekip Sil ── */}
      {delEkip && (
        <Modal title="Ekibi Sil" onClose={() => setDelEkip(null)}>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              <span className="text-slate-800 font-semibold">{delEkip.ad}</span> ekibini silmek istediğinizden emin misiniz?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDelEkip(null)} className={cls.btnSecondary + ' flex-1'}>İptal</button>
              <button onClick={deleteEkip} disabled={ekipDeleting} className={cls.btnDanger + ' flex-1'}>
                {ekipDeleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
