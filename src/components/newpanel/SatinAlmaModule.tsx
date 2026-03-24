'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Search, ChevronLeft, Loader2,
  ShoppingCart, ClipboardList, Truck, Building, Package,
  CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight,
  ArrowRight, Filter,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

// ── Tipler ──────────────────────────────────────────────────────────────────

interface Proje { id: string; ad: string; sirket: string | null }

interface Tedarikci {
  id: string; firma_id: string; sirket: string; ad: string
  vkn_tckn: string | null; telefon: string | null; email: string | null
  adres: string | null; kategori: string | null; notlar: string | null
}

interface Talep {
  id: string; firma_id: string; sirket: string; proje_id: string | null
  talep_no: string | null; baslik: string; talep_tarihi: string
  ihtiyac_tarihi: string | null; oncelik: string; durum: string
  aciklama: string | null; toplam_tutar: number
}

interface Siparis {
  id: string; firma_id: string; sirket: string; proje_id: string | null
  talep_id: string | null; tedarikci_id: string | null
  siparis_no: string | null; baslik: string
  siparis_tarihi: string; teslim_tarihi: string | null
  durum: string; toplam_tutar: number; aciklama: string | null
}

interface Props { firma: FirmaRecord; role?: string | null }

// ── Sabitler ────────────────────────────────────────────────────────────────

const TALEP_DURUM = [
  { id: 'beklemede',      label: 'Beklemede',      color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { id: 'onaylandi',      label: 'Onaylandı',      color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  { id: 'siparis_verildi',label: 'Sipariş Verildi',color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { id: 'teslim_alindi',  label: 'Teslim Alındı',  color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
  { id: 'tamamlandi',     label: 'Tamamlandı',     color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  { id: 'reddedildi',     label: 'Reddedildi',     color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
]

const SIPARIS_DURUM = [
  { id: 'hazirlaniyor',   label: 'Hazırlanıyor',   color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { id: 'onaylandi',      label: 'Onaylandı',      color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  { id: 'gonderildi',     label: 'Gönderildi',     color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { id: 'teslim_alindi',  label: 'Teslim Alındı',  color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
  { id: 'fatura_kesildi', label: 'Fatura Kesildi', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  { id: 'tamamlandi',     label: 'Tamamlandı',     color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  { id: 'iptal',          label: 'İptal',           color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
]

const ONCELIK = [
  { id: 'dusuk',  label: 'Düşük',  color: '#6B7280' },
  { id: 'normal', label: 'Normal', color: '#3B82F6' },
  { id: 'yuksek', label: 'Yüksek', color: '#F59E0B' },
  { id: 'acil',   label: 'Acil',   color: '#EF4444' },
]

const TEDARİKCI_KATEGORILER = ['Malzeme', 'Ekipman', 'Hizmet', 'Taşıma', 'Alt Yüklenici', 'Diğer']

function money(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
}

function durumBadge(durum: string, list: typeof TALEP_DURUM) {
  const d = list.find(x => x.id === durum) || list[0]
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: d.color, background: d.bg }}>
      {d.label}
    </span>
  )
}

function oncelikBadge(oncelik: string) {
  const o = ONCELIK.find(x => x.id === oncelik) || ONCELIK[1]
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ color: o.color, border: `1px solid ${o.color}33` }}>
      {o.label}
    </span>
  )
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function SatinAlmaModule({ firma, role }: Props) {
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const [tab, setTab] = useState<'talepler' | 'siparisler' | 'tedarikciler'>('talepler')
  const [arama, setArama] = useState('')
  const [durumFiltre, setDurumFiltre] = useState('')
  const [projeFiltre, setProjeFiltre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [projeler, setProjeler] = useState<Proje[]>([])
  const [talepler, setTalepler] = useState<Talep[]>([])
  const [siparisler, setSiparisler] = useState<Siparis[]>([])
  const [tedarikciler, setTedarikciler] = useState<Tedarikci[]>([])

  // Talep modal
  const [talepModal, setTalepModal] = useState(false)
  const [editingTalep, setEditingTalep] = useState<Talep | null>(null)
  const emptyTalep = { baslik: '', proje_id: '', talep_tarihi: new Date().toISOString().split('T')[0], ihtiyac_tarihi: '', oncelik: 'normal', durum: 'beklemede', aciklama: '', toplam_tutar: '' }
  const [tForm, setTForm] = useState(emptyTalep)

  // Sipariş modal
  const [siparisModal, setSiparisModal] = useState(false)
  const [editingSiparis, setEditingSiparis] = useState<Siparis | null>(null)
  const emptySiparis = { baslik: '', proje_id: '', talep_id: '', tedarikci_id: '', siparis_tarihi: new Date().toISOString().split('T')[0], teslim_tarihi: '', durum: 'hazirlaniyor', toplam_tutar: '', aciklama: '' }
  const [sForm, setSForm] = useState(emptySiparis)

  // Tedarikçi modal
  const [tedModal, setTedModal] = useState(false)
  const [editingTed, setEditingTed] = useState<Tedarikci | null>(null)
  const emptyTed = { ad: '', vkn_tckn: '', telefon: '', email: '', adres: '', kategori: 'Malzeme', notlar: '' }
  const [tedForm, setTedForm] = useState(emptyTed)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProjeler = useCallback(async () => {
    if (!sirket) return
    const { data } = await supabase.from('projeler').select('id, ad, sirket').eq('firma_id', firma.id).order('ad')
    const all = (data || []) as Proje[]
    setProjeler(sirket === 'ETM' ? all.filter(p => !p.sirket || p.sirket === 'ETM') : all.filter(p => p.sirket === sirket))
  }, [firma.id, sirket])

  const fetchTalepler = useCallback(async () => {
    if (!sirket) return
    setLoading(true)
    const q = sirket === 'ETM'
      ? supabase.from('satinalma_talepleri').select('*').eq('firma_id', firma.id).or('sirket.eq.ETM,sirket.is.null')
      : supabase.from('satinalma_talepleri').select('*').eq('firma_id', firma.id).eq('sirket', sirket)
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTalepler((data || []) as Talep[])
    setLoading(false)
  }, [firma.id, sirket])

  const fetchSiparisler = useCallback(async () => {
    if (!sirket) return
    const q = sirket === 'ETM'
      ? supabase.from('satinalma_siparisleri').select('*').eq('firma_id', firma.id).or('sirket.eq.ETM,sirket.is.null')
      : supabase.from('satinalma_siparisleri').select('*').eq('firma_id', firma.id).eq('sirket', sirket)
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setSiparisler((data || []) as Siparis[])
  }, [firma.id, sirket])

  const fetchTedarikciler = useCallback(async () => {
    if (!sirket) return
    const q = sirket === 'ETM'
      ? supabase.from('tedarikciler').select('*').eq('firma_id', firma.id).or('sirket.eq.ETM,sirket.is.null')
      : supabase.from('tedarikciler').select('*').eq('firma_id', firma.id).eq('sirket', sirket)
    const { data, error } = await q.order('ad')
    if (error) setError(error.message)
    else setTedarikciler((data || []) as Tedarikci[])
  }, [firma.id, sirket])

  useEffect(() => {
    if (!sirket) return
    setArama(''); setDurumFiltre(''); setProjeFiltre('')
    fetchProjeler()
    fetchTalepler()
    fetchSiparisler()
    fetchTedarikciler()
  }, [sirket, fetchProjeler, fetchTalepler, fetchSiparisler, fetchTedarikciler])

  // ── Talep CRUD ─────────────────────────────────────────────────────────────

  function openTalepModal(t?: Talep) {
    setEditingTalep(t || null)
    setTForm(t ? { baslik: t.baslik, proje_id: t.proje_id || '', talep_tarihi: t.talep_tarihi, ihtiyac_tarihi: t.ihtiyac_tarihi || '', oncelik: t.oncelik, durum: t.durum, aciklama: t.aciklama || '', toplam_tutar: t.toplam_tutar?.toString() || '' } : emptyTalep)
    setTalepModal(true); setError('')
  }

  async function saveTalep() {
    if (!tForm.baslik.trim()) { setError('Başlık zorunludur.'); return }
    const payload: any = {
      firma_id: firma.id, sirket,
      baslik: tForm.baslik.trim(),
      proje_id: tForm.proje_id || null,
      talep_tarihi: tForm.talep_tarihi,
      ihtiyac_tarihi: tForm.ihtiyac_tarihi || null,
      oncelik: tForm.oncelik,
      durum: tForm.durum,
      aciklama: tForm.aciklama || null,
      toplam_tutar: tForm.toplam_tutar ? Number(tForm.toplam_tutar) : 0,
    }
    const res = editingTalep
      ? await (supabase as any).from('satinalma_talepleri').update(payload).eq('id', editingTalep.id)
      : await (supabase as any).from('satinalma_talepleri').insert(payload)
    if (res.error) { setError(res.error.message); return }
    setTalepModal(false); fetchTalepler()
  }

  async function deleteTalep(id: string) {
    if (!confirm('Bu talebi silmek istediğinize emin misiniz?')) return
    await (supabase as any).from('satinalma_talepleri').delete().eq('id', id)
    fetchTalepler()
  }

  // ── Sipariş CRUD ───────────────────────────────────────────────────────────

  function openSiparisModal(s?: Siparis) {
    setEditingSiparis(s || null)
    setSForm(s ? { baslik: s.baslik, proje_id: s.proje_id || '', talep_id: s.talep_id || '', tedarikci_id: s.tedarikci_id || '', siparis_tarihi: s.siparis_tarihi, teslim_tarihi: s.teslim_tarihi || '', durum: s.durum, toplam_tutar: s.toplam_tutar?.toString() || '', aciklama: s.aciklama || '' } : emptySiparis)
    setSiparisModal(true); setError('')
  }

  async function saveSiparis() {
    if (!sForm.baslik.trim()) { setError('Başlık zorunludur.'); return }
    const payload: any = {
      firma_id: firma.id, sirket,
      baslik: sForm.baslik.trim(),
      proje_id: sForm.proje_id || null,
      talep_id: sForm.talep_id || null,
      tedarikci_id: sForm.tedarikci_id || null,
      siparis_tarihi: sForm.siparis_tarihi,
      teslim_tarihi: sForm.teslim_tarihi || null,
      durum: sForm.durum,
      toplam_tutar: sForm.toplam_tutar ? Number(sForm.toplam_tutar) : 0,
      aciklama: sForm.aciklama || null,
    }
    const res = editingSiparis
      ? await (supabase as any).from('satinalma_siparisleri').update(payload).eq('id', editingSiparis.id)
      : await (supabase as any).from('satinalma_siparisleri').insert(payload)
    if (res.error) { setError(res.error.message); return }
    setSiparisModal(false); fetchSiparisler()
  }

  async function deleteSiparis(id: string) {
    if (!confirm('Bu siparişi silmek istediğinize emin misiniz?')) return
    await (supabase as any).from('satinalma_siparisleri').delete().eq('id', id)
    fetchSiparisler()
  }

  // ── Tedarikçi CRUD ─────────────────────────────────────────────────────────

  function openTedModal(t?: Tedarikci) {
    setEditingTed(t || null)
    setTedForm(t ? { ad: t.ad, vkn_tckn: t.vkn_tckn || '', telefon: t.telefon || '', email: t.email || '', adres: t.adres || '', kategori: t.kategori || 'Malzeme', notlar: t.notlar || '' } : emptyTed)
    setTedModal(true); setError('')
  }

  async function saveTed() {
    if (!tedForm.ad.trim()) { setError('Tedarikçi adı zorunludur.'); return }
    const payload: any = {
      firma_id: firma.id, sirket,
      ad: tedForm.ad.trim(),
      vkn_tckn: tedForm.vkn_tckn || null,
      telefon: tedForm.telefon || null,
      email: tedForm.email || null,
      adres: tedForm.adres || null,
      kategori: tedForm.kategori || null,
      notlar: tedForm.notlar || null,
    }
    const res = editingTed
      ? await (supabase as any).from('tedarikciler').update(payload).eq('id', editingTed.id)
      : await (supabase as any).from('tedarikciler').insert(payload)
    if (res.error) { setError(res.error.message); return }
    setTedModal(false); fetchTedarikciler()
  }

  async function deleteTed(id: string) {
    if (!confirm('Bu tedarikçiyi silmek istediğinize emin misiniz?')) return
    await (supabase as any).from('tedarikciler').delete().eq('id', id)
    fetchTedarikciler()
  }

  // ── Filtreleme ─────────────────────────────────────────────────────────────

  const filteredTalepler = useMemo(() => {
    return talepler.filter(t => {
      const matchArama = !arama || t.baslik.toLowerCase().includes(arama.toLowerCase())
      const matchDurum = !durumFiltre || t.durum === durumFiltre
      const matchProje = !projeFiltre || t.proje_id === projeFiltre
      return matchArama && matchDurum && matchProje
    })
  }, [talepler, arama, durumFiltre, projeFiltre])

  const filteredSiparisler = useMemo(() => {
    return siparisler.filter(s => {
      const matchArama = !arama || s.baslik.toLowerCase().includes(arama.toLowerCase()) || (s.siparis_no || '').toLowerCase().includes(arama.toLowerCase())
      const matchDurum = !durumFiltre || s.durum === durumFiltre
      const matchProje = !projeFiltre || s.proje_id === projeFiltre
      return matchArama && matchDurum && matchProje
    })
  }, [siparisler, arama, durumFiltre, projeFiltre])

  const filteredTedarikciler = useMemo(() => {
    return tedarikciler.filter(t => !arama || t.ad.toLowerCase().includes(arama.toLowerCase()) || (t.kategori || '').toLowerCase().includes(arama.toLowerCase()))
  }, [tedarikciler, arama])

  // ── Özet istatistikler ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const bekleyen = talepler.filter(t => t.durum === 'beklemede').length
    const aktifSiparis = siparisler.filter(s => !['tamamlandi','iptal'].includes(s.durum)).length
    const toplamSiparisTutar = siparisler.filter(s => s.durum !== 'iptal').reduce((a, s) => a + (s.toplam_tutar || 0), 0)
    const tamamlanan = siparisler.filter(s => s.durum === 'tamamlandi').length
    return { bekleyen, aktifSiparis, toplamSiparisTutar, tamamlanan }
  }, [talepler, siparisler])

  // ── Firma seçimi ekranı ────────────────────────────────────────────────────
  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[400px] gap-6">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)' }}>
            <ShoppingCart size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Satın Alma Yönetimi</h2>
          <p className="text-sm text-slate-500 mt-1">Firma seçerek devam edin</p>
        </div>
        <div className="flex gap-4">
          {(['ETM', 'BİNYAPI'] as const).map(s => (
            <button key={s} onClick={() => setSirket(s)}
              className="group relative px-10 py-6 rounded-2xl text-left transition-all duration-200 hover:scale-105"
              style={{ background: '#161B27', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = s === 'ETM' ? '#3B82F6' : '#F59E0B'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
            >
              <Building size={28} className="mb-3" style={{ color: s === 'ETM' ? '#3B82F6' : '#F59E0B' }} />
              <p className="text-lg font-bold text-white">{s}</p>
              <p className="text-xs text-slate-500 mt-0.5">Satın alma süreçleri</p>
              <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Proje adı yardımcısı ───────────────────────────────────────────────────
  function projeAdi(id: string | null) {
    if (!id) return '—'
    return projeler.find(p => p.id === id)?.ad || '—'
  }
  function tedarikciAdi(id: string | null) {
    if (!id) return '—'
    return tedarikciler.find(t => t.id === id)?.ad || '—'
  }

  const canEdit = !role || role === 'yonetici' || role === 'muhasebe'

  // ── Ana render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => setSirket(null)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-white transition-colors">
            <ChevronLeft size={15} /> Firma
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: sirket === 'ETM' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)' }}>
              <ShoppingCart size={14} style={{ color: sirket === 'ETM' ? '#3B82F6' : '#F59E0B' }} />
            </div>
            <div>
              <p className="text-xs text-slate-500 leading-none">Satın Alma</p>
              <p className="text-[13px] font-bold text-white leading-snug">{sirket}</p>
            </div>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Bekleyen Talep',    value: stats.bekleyen,               icon: ClipboardList, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Aktif Sipariş',     value: stats.aktifSiparis,           icon: Package,       color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
          { label: 'Toplam Sipariş',    value: money(stats.toplamSiparisTutar), icon: Truck,      color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', isText: true },
          { label: 'Tamamlanan',        value: stats.tamamlanan,             icon: CheckCircle2,  color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4" style={{ background: '#161B27', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-500">{card.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                <card.icon size={13} style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + araçlar */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#161B27', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-4 pt-3 pb-0 gap-3 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Tabs */}
          <div className="flex gap-0">
            {([
              { id: 'talepler',     label: 'Talepler',     icon: ClipboardList, count: talepler.length },
              { id: 'siparisler',   label: 'Siparişler',   icon: ShoppingCart,  count: siparisler.length },
              { id: 'tedarikciler', label: 'Tedarikçiler', icon: Building,      count: tedarikciler.length },
            ] as const).map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setArama(''); setDurumFiltre('') }}
                className="flex items-center gap-2 px-4 py-3 text-[12.5px] font-medium transition-colors relative"
                style={{ color: tab === t.id ? '#F1F5F9' : '#4B5563', borderBottom: tab === t.id ? '2px solid #3B82F6' : '2px solid transparent' }}
              >
                <t.icon size={14} />
                {t.label}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: tab === t.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', color: tab === t.id ? '#60A5FA' : '#4B5563' }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Araçlar */}
          <div className="flex items-center gap-2 pb-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Ara..." value={arama} onChange={e => setArama(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg text-[12px] text-white placeholder:text-slate-600 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', width: '160px' }}
              />
            </div>
            {tab !== 'tedarikciler' && (
              <>
                <select value={projeFiltre} onChange={e => setProjeFiltre(e.target.value)}
                  className="py-1.5 px-2 rounded-lg text-[12px] text-slate-400 outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <option value="" className="bg-slate-900">Tüm Projeler</option>
                  {projeler.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.ad}</option>)}
                </select>
                <select value={durumFiltre} onChange={e => setDurumFiltre(e.target.value)}
                  className="py-1.5 px-2 rounded-lg text-[12px] text-slate-400 outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <option value="" className="bg-slate-900">Tüm Durumlar</option>
                  {(tab === 'talepler' ? TALEP_DURUM : SIPARIS_DURUM).map(d => (
                    <option key={d.id} value={d.id} className="bg-slate-900">{d.label}</option>
                  ))}
                </select>
              </>
            )}
            {canEdit && (
              <button
                onClick={() => tab === 'talepler' ? openTalepModal() : tab === 'siparisler' ? openSiparisModal() : openTedModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors"
                style={{ background: '#2563EB' }}
              >
                <Plus size={13} />
                {tab === 'talepler' ? 'Talep' : tab === 'siparisler' ? 'Sipariş' : 'Tedarikçi'}
              </button>
            )}
          </div>
        </div>

        {/* İçerik */}
        <div className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Yükleniyor...
            </div>
          ) : (
            <>
              {/* ── TALEPLER ── */}
              {tab === 'talepler' && (
                filteredTalepler.length === 0 ? (
                  <EmptyState icon={ClipboardList} label="Henüz talep yok" sub="İlk satın alma talebini oluşturun" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          {['Başlık', 'Proje', 'Talep Tarihi', 'İhtiyaç Tarihi', 'Öncelik', 'Durum', 'Tutar', ''].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#374151' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTalepler.map((t, i) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td className="px-4 py-3 font-medium text-white text-[13px]">{t.baslik}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{projeAdi(t.proje_id)}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{t.talep_tarihi}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{t.ihtiyac_tarihi || '—'}</td>
                            <td className="px-4 py-3">{oncelikBadge(t.oncelik)}</td>
                            <td className="px-4 py-3">{durumBadge(t.durum, TALEP_DURUM)}</td>
                            <td className="px-4 py-3 text-[12px] font-semibold text-slate-200">{t.toplam_tutar ? money(t.toplam_tutar) : '—'}</td>
                            <td className="px-4 py-3">
                              {canEdit && (
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => openTalepModal(t)} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"><Pencil size={13} /></button>
                                  <button onClick={() => deleteTalep(t.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={13} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* ── SİPARİŞLER ── */}
              {tab === 'siparisler' && (
                filteredSiparisler.length === 0 ? (
                  <EmptyState icon={ShoppingCart} label="Henüz sipariş yok" sub="Yeni sipariş oluşturun" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          {['Başlık', 'Proje', 'Tedarikçi', 'Sipariş Tarihi', 'Teslim Tarihi', 'Durum', 'Tutar', ''].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#374151' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSiparisler.map((s, i) => (
                          <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td className="px-4 py-3 font-medium text-white text-[13px]">
                              {s.baslik}
                              {s.siparis_no && <span className="ml-2 text-[10px] text-slate-600">#{s.siparis_no}</span>}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{projeAdi(s.proje_id)}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{tedarikciAdi(s.tedarikci_id)}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{s.siparis_tarihi}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{s.teslim_tarihi || '—'}</td>
                            <td className="px-4 py-3">{durumBadge(s.durum, SIPARIS_DURUM)}</td>
                            <td className="px-4 py-3 text-[12px] font-semibold text-slate-200">{s.toplam_tutar ? money(s.toplam_tutar) : '—'}</td>
                            <td className="px-4 py-3">
                              {canEdit && (
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => openSiparisModal(s)} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"><Pencil size={13} /></button>
                                  <button onClick={() => deleteSiparis(s.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={13} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* ── TEDARİKÇİLER ── */}
              {tab === 'tedarikciler' && (
                filteredTedarikciler.length === 0 ? (
                  <EmptyState icon={Building} label="Henüz tedarikçi yok" sub="Tedarikçi ekleyin" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          {['Tedarikçi Adı', 'Kategori', 'VKN / TCKN', 'Telefon', 'E-Posta', ''].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#374151' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTedarikciler.map((t, i) => (
                          <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td className="px-4 py-3 font-medium text-white text-[13px]">{t.ad}</td>
                            <td className="px-4 py-3">
                              {t.kategori && (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>{t.kategori}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{t.vkn_tckn || '—'}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{t.telefon || '—'}</td>
                            <td className="px-4 py-3 text-[12px] text-slate-400">{t.email || '—'}</td>
                            <td className="px-4 py-3">
                              {canEdit && (
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => openTedModal(t)} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"><Pencil size={13} /></button>
                                  <button onClick={() => deleteTed(t.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"><Trash2 size={13} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ TALEP MODAL ══════════════════════════════════════════════════════ */}
      {talepModal && (
        <Modal
          title={editingTalep ? 'Talep Düzenle' : 'Yeni Satın Alma Talebi'}
          onClose={() => setTalepModal(false)}
          size="md"
          footer={<><button className={btnSecondary} onClick={() => setTalepModal(false)}>İptal</button><button className={btnPrimary} onClick={saveTalep}>Kaydet</button></>}
        >
          <div className="space-y-3">
            {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
            <FormField label="Başlık" required>
              <input className={inputCls} value={tForm.baslik} onChange={e => setTForm({ ...tForm, baslik: e.target.value })} placeholder="Talep başlığı..." />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Proje">
                <select className={inputCls} value={tForm.proje_id} onChange={e => setTForm({ ...tForm, proje_id: e.target.value })}>
                  <option value="" className="bg-slate-900">Genel</option>
                  {projeler.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.ad}</option>)}
                </select>
              </FormField>
              <FormField label="Öncelik">
                <select className={inputCls} value={tForm.oncelik} onChange={e => setTForm({ ...tForm, oncelik: e.target.value })}>
                  {ONCELIK.map(o => <option key={o.id} value={o.id} className="bg-slate-900">{o.label}</option>)}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Talep Tarihi" required>
                <input type="date" className={inputCls} value={tForm.talep_tarihi} onChange={e => setTForm({ ...tForm, talep_tarihi: e.target.value })} />
              </FormField>
              <FormField label="İhtiyaç Tarihi">
                <input type="date" className={inputCls} value={tForm.ihtiyac_tarihi} onChange={e => setTForm({ ...tForm, ihtiyac_tarihi: e.target.value })} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Durum">
                <select className={inputCls} value={tForm.durum} onChange={e => setTForm({ ...tForm, durum: e.target.value })}>
                  {TALEP_DURUM.map(d => <option key={d.id} value={d.id} className="bg-slate-900">{d.label}</option>)}
                </select>
              </FormField>
              <FormField label="Tahmini Tutar (₺)">
                <input type="number" className={inputCls} value={tForm.toplam_tutar} onChange={e => setTForm({ ...tForm, toplam_tutar: e.target.value })} placeholder="0.00" />
              </FormField>
            </div>
            <FormField label="Açıklama">
              <textarea className={inputCls} rows={3} value={tForm.aciklama} onChange={e => setTForm({ ...tForm, aciklama: e.target.value })} placeholder="Talep detayları..." />
            </FormField>
          </div>
        </Modal>
      )}

      {/* ══ SİPARİŞ MODAL ════════════════════════════════════════════════════ */}
      {siparisModal && (
        <Modal
          title={editingSiparis ? 'Sipariş Düzenle' : 'Yeni Satın Alma Siparişi'}
          onClose={() => setSiparisModal(false)}
          size="md"
          footer={<><button className={btnSecondary} onClick={() => setSiparisModal(false)}>İptal</button><button className={btnPrimary} onClick={saveSiparis}>Kaydet</button></>}
        >
          <div className="space-y-3">
            {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
            <FormField label="Sipariş Başlığı" required>
              <input className={inputCls} value={sForm.baslik} onChange={e => setSForm({ ...sForm, baslik: e.target.value })} placeholder="Sipariş başlığı..." />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Proje">
                <select className={inputCls} value={sForm.proje_id} onChange={e => setSForm({ ...sForm, proje_id: e.target.value })}>
                  <option value="" className="bg-slate-900">Genel</option>
                  {projeler.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.ad}</option>)}
                </select>
              </FormField>
              <FormField label="Tedarikçi">
                <select className={inputCls} value={sForm.tedarikci_id} onChange={e => setSForm({ ...sForm, tedarikci_id: e.target.value })}>
                  <option value="" className="bg-slate-900">Seçin...</option>
                  {tedarikciler.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.ad}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="İlgili Talep">
              <select className={inputCls} value={sForm.talep_id} onChange={e => setSForm({ ...sForm, talep_id: e.target.value })}>
                <option value="" className="bg-slate-900">— Talep bağlama (opsiyonel)</option>
                {talepler.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.baslik}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Sipariş Tarihi" required>
                <input type="date" className={inputCls} value={sForm.siparis_tarihi} onChange={e => setSForm({ ...sForm, siparis_tarihi: e.target.value })} />
              </FormField>
              <FormField label="Teslim Tarihi">
                <input type="date" className={inputCls} value={sForm.teslim_tarihi} onChange={e => setSForm({ ...sForm, teslim_tarihi: e.target.value })} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Durum">
                <select className={inputCls} value={sForm.durum} onChange={e => setSForm({ ...sForm, durum: e.target.value })}>
                  {SIPARIS_DURUM.map(d => <option key={d.id} value={d.id} className="bg-slate-900">{d.label}</option>)}
                </select>
              </FormField>
              <FormField label="Toplam Tutar (₺)">
                <input type="number" className={inputCls} value={sForm.toplam_tutar} onChange={e => setSForm({ ...sForm, toplam_tutar: e.target.value })} placeholder="0.00" />
              </FormField>
            </div>
            <FormField label="Açıklama">
              <textarea className={inputCls} rows={2} value={sForm.aciklama} onChange={e => setSForm({ ...sForm, aciklama: e.target.value })} placeholder="Sipariş notu..." />
            </FormField>
          </div>
        </Modal>
      )}

      {/* ══ TEDARİKÇİ MODAL ══════════════════════════════════════════════════ */}
      {tedModal && (
        <Modal
          title={editingTed ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}
          onClose={() => setTedModal(false)}
          size="md"
          footer={<><button className={btnSecondary} onClick={() => setTedModal(false)}>İptal</button><button className={btnPrimary} onClick={saveTed}>Kaydet</button></>}
        >
          <div className="space-y-3">
            {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tedarikçi Adı" required>
                <input className={inputCls} value={tedForm.ad} onChange={e => setTedForm({ ...tedForm, ad: e.target.value })} placeholder="Firma veya kişi adı..." />
              </FormField>
              <FormField label="Kategori">
                <select className={inputCls} value={tedForm.kategori} onChange={e => setTedForm({ ...tedForm, kategori: e.target.value })}>
                  {TEDARİKCI_KATEGORILER.map(k => <option key={k} value={k} className="bg-slate-900">{k}</option>)}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="VKN / TCKN">
                <input className={inputCls} value={tedForm.vkn_tckn} onChange={e => setTedForm({ ...tedForm, vkn_tckn: e.target.value })} placeholder="Vergi/TC kimlik no" />
              </FormField>
              <FormField label="Telefon">
                <input className={inputCls} value={tedForm.telefon} onChange={e => setTedForm({ ...tedForm, telefon: e.target.value })} placeholder="0(5xx) xxx xx xx" />
              </FormField>
            </div>
            <FormField label="E-Posta">
              <input type="email" className={inputCls} value={tedForm.email} onChange={e => setTedForm({ ...tedForm, email: e.target.value })} placeholder="ornek@firma.com" />
            </FormField>
            <FormField label="Adres">
              <textarea className={inputCls} rows={2} value={tedForm.adres} onChange={e => setTedForm({ ...tedForm, adres: e.target.value })} placeholder="Açık adres..." />
            </FormField>
            <FormField label="Notlar">
              <textarea className={inputCls} rows={2} value={tedForm.notlar} onChange={e => setTedForm({ ...tedForm, notlar: e.target.value })} placeholder="Ekstra notlar..." />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <Icon size={20} className="text-slate-600" />
      </div>
      <p className="text-[13px] font-semibold text-slate-400">{label}</p>
      <p className="text-[12px] text-slate-600">{sub}</p>
    </div>
  )
}
