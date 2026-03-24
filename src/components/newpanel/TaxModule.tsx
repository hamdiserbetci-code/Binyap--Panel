'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, ChevronLeft, CheckCircle2, XCircle, Clock,
  AlertTriangle, FileText, Upload, RefreshCw, Building, ShieldCheck,
  CalendarDays, TrendingUp, FileCheck, BookOpen, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

// ── Tipler ──────────────────────────────────────────────────────────────────

interface Beyanname {
  id: string; firma_id: string; sirket: string
  tur: string; yil: number; ay: number
  durum: string
  son_verilme_tarihi: string | null
  verilme_tarihi: string | null
  matrah: number; kdv_tutari: number
  indirilecek_kdv: number; odenecek_tutar: number
  odeme_tarihi: string | null; belge_no: string | null; aciklama: string | null
}

interface Props { firma: FirmaRecord; role?: string | null }

// ── Sabitler ─────────────────────────────────────────────────────────────────

const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
               'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const DURUMLAR = [
  { id: 'beklemede', label: 'Beklemede', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', icon: Clock },
  { id: 'verildi',   label: 'Verildi',   color: '#34D399', bg: 'rgba(52,211,153,0.15)',  icon: CheckCircle2 },
  { id: 'gecikti',   label: 'Gecikti',   color: '#F87171', bg: 'rgba(248,113,113,0.15)', icon: AlertTriangle },
  { id: 'odendi',    label: 'Ödendi',    color: '#60A5FA', bg: 'rgba(96,165,250,0.15)',  icon: CheckCircle2 },
  { id: 'iptal',     label: 'İptal',     color: '#6B7280', bg: 'rgba(107,114,128,0.15)', icon: XCircle },
]

// Her türün son verilme tarihi hesabı
function sonVerilme(tur: string, yil: number, ay: number): string {
  if (tur === 'kdv' || tur === 'muhtasar') {
    const d = new Date(ay === 12 ? yil + 1 : yil, ay === 12 ? 0 : ay, 26)
    return d.toISOString().split('T')[0]
  }
  if (tur === 'sgk') {
    const d = new Date(ay === 12 ? yil + 1 : yil, ay === 12 ? 0 : ay, 23)
    return d.toISOString().split('T')[0]
  }
  if (tur === 'gecici_vergi') {
    const map: Record<number, [number, number]> = { 3: [yil, 4], 6: [yil, 8], 9: [yil, 11] }
    const [y, m] = map[ay] || [yil, 4]
    return `${y}-${String(m).padStart(2, '0')}-17`
  }
  if (tur === 'kurumlar') {
    return `${yil + 1}-04-25`
  }
  if (tur === 'edefter') {
    // Q1→May10, Q2→Sep10, Q3→Dec10, Q4→May10(+1yıl)
    const map: Record<number, [number, number]> = {
      3:  [yil, 5], 6: [yil, 9], 9: [yil, 12], 12: [yil + 1, 5]
    }
    const [y, m] = map[ay] || [yil, 5]
    return `${y}-${String(m).padStart(2, '0')}-10`
  }
  return ''
}

// Aylık dönem listesi (tab türüne göre)
function donemler(tur: string): number[] {
  if (tur === 'kdv' || tur === 'muhtasar' || tur === 'sgk') return [1,2,3,4,5,6,7,8,9,10,11,12]
  if (tur === 'gecici_vergi') return [3, 6, 9]
  if (tur === 'kurumlar') return [12]
  if (tur === 'edefter') return [3, 6, 9, 12]
  return []
}

function donemEtiketi(tur: string, ay: number): string {
  if (tur === 'kdv' || tur === 'muhtasar' || tur === 'sgk') return AYLAR[ay - 1]
  if (tur === 'gecici_vergi') {
    return { 3: '1. Dönem (Oca-Mar)', 6: '2. Dönem (Nis-Haz)', 9: '3. Dönem (Tem-Eyl)' }[ay] || ''
  }
  if (tur === 'kurumlar') return 'Yıllık'
  if (tur === 'edefter') return {
    3: '1. Çeyrek (Q1)', 6: '2. Çeyrek (Q2)', 9: '3. Çeyrek (Q3)', 12: '4. Çeyrek (Q4)',
  }[ay] || ''
  return ''
}

function money(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function durumBadge(durum: string) {
  const d = DURUMLAR.find(x => x.id === durum) || DURUMLAR[0]
  const Icon = d.icon
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: d.color, background: d.bg }}>
      <Icon size={11} />{d.label}
    </span>
  )
}

function isGecikti(sonTarih: string | null, durum: string): boolean {
  if (!sonTarih || durum === 'verildi' || durum === 'odendi' || durum === 'iptal') return false
  return new Date(sonTarih) < new Date()
}

// ── Tab Konfigürasyonu ────────────────────────────────────────────────────────

const TABS = [
  { id: 'kdv',          label: 'KDV',           icon: FileText,    color: '#60A5FA', desc: 'Aylık KDV Beyannamesi • Son: Ertesi ayın 26\'sı' },
  { id: 'muhtasar',     label: 'Muhtasar',       icon: BookOpen,    color: '#A78BFA', desc: 'Aylık Muhtasar Beyannamesi • Son: Ertesi ayın 26\'sı' },
  { id: 'sgk',          label: 'SGK',            icon: ShieldCheck, color: '#34D399', desc: 'Aylık SGK Bildirimi • Son: Ertesi ayın 23\'ü' },
  { id: 'gecici_vergi', label: 'Geçici Vergi',   icon: TrendingUp,  color: '#FBBF24', desc: '3 Aylık Geçici Vergi • Q1→Nis 17, Q2→Ağu 17, Q3→Kas 17' },
  { id: 'kurumlar',     label: 'Kurumlar V.',    icon: Building,    color: '#F97316', desc: 'Yıllık Kurumlar Vergisi • Son: 25 Nisan' },
  { id: 'edefter',      label: 'E-Defter',       icon: FileCheck,   color: '#06B6D4', desc: '3 Aylık E-Defter/Berat • Geçici V.+1 ay, 10\'una kadar' },
]

// ── Ana Bileşen ───────────────────────────────────────────────────────────────

export default function TaxModule({ firma, role }: Props) {
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const [yil, setYil] = useState(new Date().getFullYear())
  const [tab, setTab] = useState('kdv')
  const [beyannameler, setBeyannameler] = useState<Beyanname[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // CRUD modal
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const emptyForm = { durum: 'beklemede', verilme_tarihi: '', matrah: '', kdv_tutari: '', indirilecek_kdv: '', odenecek_tutar: '', odeme_tarihi: '', belge_no: '', aciklama: '' }
  const [form, setForm] = useState(emptyForm)
  const [modalAy, setModalAy] = useState(1)

  // KDV Karşılaştırma modal
  const [kdvModal, setKdvModal] = useState(false)
  const [kdvAy, setKdvAy] = useState(1)
  const [kdvLoading, setKdvLoading] = useState(false)
  const [pdfForm, setPdfForm] = useState({ matrah: '', hesaplanan_kdv: '', indirilecek_kdv: '', odenecek_kdv: '' })
  const [sistemValues, setSistemValues] = useState<{ matrah: number; hesaplananKdv: number; indirilecekKdv: number; odenecekKdv: number } | null>(null)
  const [karsilastirmaYapildi, setKarsilastirmaYapildi] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchBeyannameler = useCallback(async () => {
    if (!sirket) return
    setLoading(true)
    const q = sirket === 'ETM'
      ? supabase.from('vergi_beyannameleri').select('*').eq('firma_id', firma.id).or('sirket.eq.ETM,sirket.is.null').eq('yil', yil)
      : supabase.from('vergi_beyannameleri').select('*').eq('firma_id', firma.id).eq('sirket', sirket).eq('yil', yil)
    const { data, error } = await q.order('ay')
    if (error) setError(error.message)
    else setBeyannameler((data || []) as Beyanname[])
    setLoading(false)
  }, [firma.id, sirket, yil])

  useEffect(() => { if (sirket) { setError(''); fetchBeyannameler() } }, [sirket, yil, fetchBeyannameler])

  // ── Sistem KDV verisi ────────────────────────────────────────────────────

  async function fetchSistemKdv(ay: number) {
    setKdvLoading(true)
    setSistemValues(null)
    try {
      // cari_hareketler'de sirket kolonu yok — önce bu firmaya/şirkete ait hesap ID'lerini al
      const hesapQ = supabase.from('cari_hesaplar').select('id').eq('firma_id', firma.id)
      const { data: hesaplar } = sirket === 'ETM'
        ? await (hesapQ as any).or('sirket.eq.ETM,sirket.is.null')
        : await hesapQ.eq('sirket', sirket)
      const hesapIds: string[] = ((hesaplar || []) as any[]).map((h: any) => h.id)

      if (hesapIds.length === 0) {
        setSistemValues({ matrah: 0, hesaplananKdv: 0, indirilecekKdv: 0, odenecekKdv: 0 })
        setKdvLoading(false)
        return
      }

      const from = `${yil}-${String(ay).padStart(2, '0')}-01`
      const sonGun = new Date(yil, ay, 0).getDate()
      const to = `${yil}-${String(ay).padStart(2, '0')}-${String(sonGun).padStart(2, '0')}`

      const { data, error } = await supabase.from('cari_hareketler')
        .select('hareket_turu, tutar, kdv_tutari')
        .in('cari_hesap_id', hesapIds)
        .gte('tarih', from).lte('tarih', to)

      if (error) { setError('Sistem verisi alınamadı: ' + error.message); setKdvLoading(false); return }

      let matrah = 0, hesaplananKdv = 0, indirilecekKdv = 0
      for (const h of (data || []) as any[]) {
        if (h.hareket_turu === 'satis_fatura') {
          matrah += Number(h.tutar || 0)
          hesaplananKdv += Number(h.kdv_tutari || 0)
        } else if (h.hareket_turu === 'alis_fatura') {
          indirilecekKdv += Number(h.kdv_tutari || 0)
        }
      }
      const odenecekKdv = Math.max(0, hesaplananKdv - indirilecekKdv)
      setSistemValues({ matrah, hesaplananKdv, indirilecekKdv, odenecekKdv })
    } catch (e: any) {
      setError('Sistem verisi alınamadı: ' + e.message)
    }
    setKdvLoading(false)
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  function openModal(ay: number, existing?: Beyanname) {
    setModalAy(ay)
    setEditingId(existing?.id || null)
    setForm(existing ? {
      durum: existing.durum,
      verilme_tarihi: existing.verilme_tarihi || '',
      matrah: existing.matrah?.toString() || '',
      kdv_tutari: existing.kdv_tutari?.toString() || '',
      indirilecek_kdv: existing.indirilecek_kdv?.toString() || '',
      odenecek_tutar: existing.odenecek_tutar?.toString() || '',
      odeme_tarihi: existing.odeme_tarihi || '',
      belge_no: existing.belge_no || '',
      aciklama: existing.aciklama || '',
    } : emptyForm)
    setModal(true); setError('')
  }

  async function saveBeyanname() {
    const payload: any = {
      firma_id: firma.id, sirket, tur: tab, yil, ay: modalAy,
      durum: form.durum,
      son_verilme_tarihi: sonVerilme(tab, yil, modalAy),
      verilme_tarihi: form.verilme_tarihi || null,
      matrah: form.matrah ? Number(form.matrah) : 0,
      kdv_tutari: form.kdv_tutari ? Number(form.kdv_tutari) : 0,
      indirilecek_kdv: form.indirilecek_kdv ? Number(form.indirilecek_kdv) : 0,
      odenecek_tutar: form.odenecek_tutar ? Number(form.odenecek_tutar) : 0,
      odeme_tarihi: form.odeme_tarihi || null,
      belge_no: form.belge_no || null,
      aciklama: form.aciklama || null,
    }
    const res = editingId
      ? await (supabase as any).from('vergi_beyannameleri').update(payload).eq('id', editingId)
      : await (supabase as any).from('vergi_beyannameleri').insert(payload)
    if (res.error) { setError(res.error.message); return }
    setModal(false); fetchBeyannameler()
  }

  async function deleteBeyanname(id: string) {
    if (!confirm('Bu kaydı silmek istiyor musunuz?')) return
    await (supabase as any).from('vergi_beyannameleri').delete().eq('id', id)
    fetchBeyannameler()
  }

  // ── Mevcut dönem verisi ───────────────────────────────────────────────────

  const tabData = useMemo(() => beyannameler.filter(b => b.tur === tab), [beyannameler, tab])

  function donemBeyanname(ay: number) {
    return tabData.find(b => b.ay === ay) || null
  }

  // ── Özet istatistikler ────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const all = beyannameler
    const verildi = all.filter(b => b.durum === 'verildi' || b.durum === 'odendi').length
    const bekleyen = all.filter(b => b.durum === 'beklemede').length
    const gecikti = all.filter(b => isGecikti(b.son_verilme_tarihi, b.durum)).length
    const toplamOdeme = all.reduce((s, b) => s + (b.odenecek_tutar || 0), 0)
    return { verildi, bekleyen, gecikti, toplamOdeme }
  }, [beyannameler])

  const canEdit = !role || role === 'yonetici' || role === 'muhasebe'

  // ── Firma seçimi ──────────────────────────────────────────────────────────

  if (!sirket) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[400px] gap-6">
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)', boxShadow: '0 0 30px rgba(99,102,241,0.3)' }}>
          <ShieldCheck size={26} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white">Vergi Takip</h2>
        <p className="text-sm text-slate-500 mt-1">Firma seçerek devam edin</p>
      </div>
      <div className="flex gap-4">
        {(['ETM', 'BİNYAPI'] as const).map(s => (
          <button key={s} onClick={() => setSirket(s)}
            className="group relative px-10 py-6 rounded-2xl text-left transition-all duration-200 hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = s === 'ETM' ? '#3B82F6' : '#F59E0B'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
          >
            <Building size={28} className="mb-3" style={{ color: s === 'ETM' ? '#3B82F6' : '#F59E0B' }} />
            <p className="text-lg font-bold text-white">{s}</p>
            <p className="text-xs text-slate-500 mt-0.5">Vergi beyannameleri</p>
          </button>
        ))}
      </div>
    </div>
  )

  const activeTab = TABS.find(t => t.id === tab)!

  // ── Ana render ────────────────────────────────────────────────────────────

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
              <ShieldCheck size={14} style={{ color: sirket === 'ETM' ? '#3B82F6' : '#F59E0B' }} />
            </div>
            <p className="text-[13px] font-bold text-white">{sirket} — Vergi Takip</p>
          </div>
        </div>

        {/* Yıl seçici */}
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-slate-500" />
          <select
            value={yil}
            onChange={e => setYil(Number(e.target.value))}
            className="py-1.5 px-3 rounded-lg text-[13px] font-semibold text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {[yil - 2, yil - 1, yil, yil + 1].map(y => (
              <option key={y} value={y} className="bg-slate-900">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-400/10 px-4 py-2 rounded-xl">{error}</p>}

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `${yil} Toplam Beyan`,  value: beyannameler.length,   icon: FileText,    color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Verildi / Ödendi',      value: stats.verildi,          icon: CheckCircle2,color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Bekleyen',              value: stats.bekleyen,          icon: Clock,       color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
          { label: 'Toplam Ödenecek',       value: `₺${money(stats.toplamOdeme)}`, icon: TrendingUp, color: '#F97316', bg: 'rgba(249,115,22,0.1)', isText: true },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-500">{c.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: c.bg }}>
                <c.icon size={13} style={{ color: c.color }} />
              </div>
            </div>
            <p className="text-xl font-bold text-white">{c.value}</p>
            {stats.gecikti > 0 && c.label === 'Bekleyen' && (
              <p className="text-[11px] text-red-400 mt-0.5">⚠ {stats.gecikti} adet gecikmiş</p>
            )}
          </div>
        ))}
      </div>

      {/* Ana kart: tabs + içerik */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>

        {/* Tab bar */}
        <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError('') }}
              className="flex items-center gap-2 px-5 py-4 text-[13px] font-semibold whitespace-nowrap transition-all duration-150 relative flex-shrink-0"
              style={{
                color: tab === t.id ? t.color : 'rgba(255,255,255,0.35)',
                borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                background: tab === t.id ? `${t.color}10` : 'transparent',
              }}
            >
              <t.icon size={15} />
              {t.label}
              {/* gecikti sayısı badge */}
              {(() => {
                const n = beyannameler.filter(b => b.tur === t.id && isGecikti(b.son_verilme_tarihi, b.durum)).length
                return n > 0 ? <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{n}</span> : null
              })()}
            </button>
          ))}
        </div>

        {/* Tab açıklaması */}
        <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }}>
          <p className="text-[12px] text-slate-500">{activeTab.desc}</p>
          {tab === 'kdv' && (
            <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
              <FileText size={12} /> Her satırın sağındaki <FileText size={11} className="inline" /> ikonuna tıklayarak karşılaştırma yapın
            </p>
          )}
        </div>

        {/* Dönemler tablosu */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
            <Loader2 size={18} className="animate-spin" /> Yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Dönem', 'Son Verilme', 'Verilme Tarihi', 'Matrah / Tutar', 'Ödenecek', 'Durum', 'Belge No', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-[10.5px] uppercase tracking-widest font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donemler(tab).map((ay, idx) => {
                  const b = donemBeyanname(ay)
                  const son = sonVerilme(tab, yil, ay)
                  const gecikti = isGecikti(b?.son_verilme_tarihi || son, b?.durum || 'beklemede')
                  const etik = donemEtiketi(tab, ay)
                  return (
                    <tr
                      key={ay}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}
                    >
                      {/* Dönem */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {gecikti && !b && <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                          <span className="text-[13.5px] font-semibold text-white">{etik}</span>
                        </div>
                      </td>

                      {/* Son verilme */}
                      <td className="px-5 py-3.5">
                        <span className={`text-[12px] font-medium ${gecikti && !b ? 'text-red-400' : 'text-slate-400'}`}>
                          {son}
                        </span>
                      </td>

                      {/* Verilme tarihi */}
                      <td className="px-5 py-3.5 text-[12px] text-slate-400">
                        {b?.verilme_tarihi || '—'}
                      </td>

                      {/* Matrah */}
                      <td className="px-5 py-3.5 text-[12px] font-medium text-slate-300">
                        {b ? `₺${money(b.matrah || 0)}` : '—'}
                      </td>

                      {/* Ödenecek */}
                      <td className="px-5 py-3.5 text-[12.5px] font-bold" style={{ color: b?.odenecek_tutar ? '#FBBF24' : 'rgba(255,255,255,0.3)' }}>
                        {b?.odenecek_tutar ? `₺${money(b.odenecek_tutar)}` : '—'}
                      </td>

                      {/* Durum */}
                      <td className="px-5 py-3.5">
                        {b ? durumBadge(gecikti && b.durum === 'beklemede' ? 'gecikti' : b.durum)
                           : <span className="text-[11px] text-slate-600">Girilmedi</span>}
                      </td>

                      {/* Belge no */}
                      <td className="px-5 py-3.5 text-[12px] text-slate-500">
                        {b?.belge_no || '—'}
                      </td>

                      {/* Aksiyonlar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          {tab === 'kdv' && (
                            <button
                              title="PDF Karşılaştır"
                              onClick={() => { setKdvAy(ay); setPdfForm({ matrah: '', hesaplanan_kdv: '', indirilecek_kdv: '', odenecek_kdv: '' }); setSistemValues(null); setKarsilastirmaYapildi(false); fetchSistemKdv(ay); setKdvModal(true) }}
                              className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-blue-400 hover:bg-blue-400/10"
                            >
                              <FileText size={14} />
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button onClick={() => openModal(ay, b || undefined)} className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10">
                                <Plus size={14} />
                              </button>
                              {b && (
                                <>
                                  <button onClick={() => openModal(ay, b)} className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-blue-400 hover:bg-blue-400/10">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => deleteBeyanname(b.id)} className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-red-400 hover:bg-red-400/10">
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
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

      {/* ══ BEYANNAME EKLE/DÜZENLE MODAL ══════════════════════════════════════ */}
      {modal && (
        <Modal
          title={`${AYLAR[modalAy - 1]} ${yil} — ${activeTab.label} ${editingId ? 'Düzenle' : 'Ekle'}`}
          onClose={() => setModal(false)}
          size="md"
          footer={<><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={saveBeyanname}>Kaydet</button></>}
        >
          <div className="space-y-3">
            {error && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Durum">
                <select className={inputCls} value={form.durum} onChange={e => setForm({ ...form, durum: e.target.value })}>
                  {DURUMLAR.map(d => <option key={d.id} value={d.id} className="bg-slate-900">{d.label}</option>)}
                </select>
              </FormField>
              <FormField label="Verilme Tarihi">
                <input type="date" className={inputCls} value={form.verilme_tarihi} onChange={e => setForm({ ...form, verilme_tarihi: e.target.value })} />
              </FormField>
            </div>
            {(tab === 'kdv' || tab === 'muhtasar' || tab === 'gecici_vergi' || tab === 'kurumlar') && (
              <>
                <FormField label="Matrah (₺)">
                  <input type="number" className={inputCls} value={form.matrah} onChange={e => setForm({ ...form, matrah: e.target.value })} placeholder="0.00" />
                </FormField>
                {tab === 'kdv' && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Hesaplanan KDV (₺)">
                      <input type="number" className={inputCls} value={form.kdv_tutari} onChange={e => setForm({ ...form, kdv_tutari: e.target.value })} placeholder="0.00" />
                    </FormField>
                    <FormField label="İndirilecek KDV (₺)">
                      <input type="number" className={inputCls} value={form.indirilecek_kdv} onChange={e => setForm({ ...form, indirilecek_kdv: e.target.value })} placeholder="0.00" />
                    </FormField>
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ödenecek Tutar (₺)">
                <input type="number" className={inputCls} value={form.odenecek_tutar} onChange={e => setForm({ ...form, odenecek_tutar: e.target.value })} placeholder="0.00" />
              </FormField>
              <FormField label="Ödeme Tarihi">
                <input type="date" className={inputCls} value={form.odeme_tarihi} onChange={e => setForm({ ...form, odeme_tarihi: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Belge No / Tahakkuk No">
              <input className={inputCls} value={form.belge_no} onChange={e => setForm({ ...form, belge_no: e.target.value })} placeholder="Belge/tahakkuk numarası..." />
            </FormField>
            <FormField label="Açıklama">
              <textarea className={inputCls} rows={2} value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} placeholder="Notlar..." />
            </FormField>
          </div>
        </Modal>
      )}

      {/* ══ KDV PDF KARŞILAŞTIRMA MODAL ═══════════════════════════════════════ */}
      {kdvModal && (
        <Modal
          title={`KDV Beyannamesi Karşılaştırma — ${AYLAR[kdvAy - 1]} ${yil}`}
          onClose={() => { setKdvModal(false); setKarsilastirmaYapildi(false) }}
          size="lg"
          footer={
            <div className="flex gap-3 w-full">
              <button className={btnSecondary} onClick={() => setKdvModal(false)}>Kapat</button>
              <button
                className={btnPrimary}
                onClick={() => setKarsilastirmaYapildi(true)}
                disabled={!pdfForm.matrah || kdvLoading}
              >
                <RefreshCw size={14} className="inline mr-2" />Karşılaştır
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Açıklama */}
            <div className="rounded-xl p-3 text-[12px]" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#93C5FD' }}>
              <strong>Nasıl kullanılır:</strong> KDV beyannamenizden değerleri sol sütuna girin. Sağ sütun sistemdeki cari hareketlerden otomatik hesaplanır. "Karşılaştır" butonuna tıklayın.
            </div>

            {/* Karşılaştırma tablosu */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-widest font-bold text-slate-500">Kalem</th>
                    <th className="text-right px-4 py-3 text-[11px] uppercase tracking-widest font-bold text-blue-400">Beyanname (PDF)</th>
                    <th className="text-right px-4 py-3 text-[11px] uppercase tracking-widest font-bold text-emerald-400">Sistem Verisi</th>
                    <th className="text-right px-4 py-3 text-[11px] uppercase tracking-widest font-bold text-slate-500">Fark</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'matrah',         label: 'KDV Matrahı',         pdfKey: 'matrah',         sysKey: 'matrah' },
                    { key: 'hesaplanan_kdv', label: 'Hesaplanan KDV',      pdfKey: 'hesaplanan_kdv', sysKey: 'hesaplananKdv' },
                    { key: 'indirilecek_kdv',label: 'İndirilecek KDV',    pdfKey: 'indirilecek_kdv',sysKey: 'indirilecekKdv' },
                    { key: 'odenecek_kdv',   label: 'Ödenecek KDV',        pdfKey: 'odenecek_kdv',  sysKey: 'odenecekKdv' },
                  ].map((row, i) => {
                    const pdfVal = pdfForm[row.pdfKey as keyof typeof pdfForm] ? Number(pdfForm[row.pdfKey as keyof typeof pdfForm]) : null
                    const sysVal = sistemValues ? (sistemValues as any)[row.sysKey] as number : null
                    const fark = karsilastirmaYapildi && pdfVal !== null && sysVal !== null ? pdfVal - sysVal : null
                    const farkOk = fark !== null && Math.abs(fark) <= 1
                    const farkBad = fark !== null && Math.abs(fark) > 1
                    return (
                      <tr key={row.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: farkBad ? 'rgba(248,113,113,0.06)' : farkOk ? 'rgba(52,211,153,0.04)' : 'transparent' }}>
                        <td className="px-4 py-3 text-[13px] font-semibold text-slate-300">{row.label}</td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            className="w-36 text-right bg-transparent text-[13px] font-bold text-white outline-none border-b focus:border-blue-400 transition-colors"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#E0E7FF' }}
                            placeholder="0.00"
                            value={pdfForm[row.pdfKey as keyof typeof pdfForm]}
                            onChange={e => setPdfForm({ ...pdfForm, [row.pdfKey]: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold" style={{ color: '#34D399' }}>
                          {kdvLoading ? <Loader2 size={14} className="animate-spin inline" /> : sysVal !== null ? `₺${money(sysVal)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] font-bold">
                          {karsilastirmaYapildi && fark !== null ? (
                            <span style={{ color: farkOk ? '#34D399' : '#F87171' }}>
                              {farkOk ? '✓' : `₺${money(Math.abs(fark))} ${fark > 0 ? '↑' : '↓'}`}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Sonuç */}
            {karsilastirmaYapildi && sistemValues && pdfForm.matrah && (
              (() => {
                const rows = [
                  { pdf: Number(pdfForm.matrah), sys: sistemValues.matrah },
                  { pdf: Number(pdfForm.hesaplanan_kdv || 0), sys: sistemValues.hesaplananKdv },
                  { pdf: Number(pdfForm.indirilecek_kdv || 0), sys: sistemValues.indirilecekKdv },
                  { pdf: Number(pdfForm.odenecek_kdv || 0), sys: sistemValues.odenecekKdv },
                ]
                const allOk = rows.every(r => Math.abs(r.pdf - r.sys) <= 1)
                return (
                  <div className="rounded-xl p-4 flex items-center gap-3" style={{
                    background: allOk ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${allOk ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                  }}>
                    {allOk
                      ? <><CheckCircle2 size={22} className="text-emerald-400 shrink-0" /><div><p className="text-[14px] font-bold text-emerald-400">Tutarlar Eşleşiyor ✓</p><p className="text-[12px] text-emerald-400/70 mt-0.5">Beyanname değerleri sistem verileriyle uyumlu.</p></div></>
                      : <><AlertTriangle size={22} className="text-red-400 shrink-0" /><div><p className="text-[14px] font-bold text-red-400">Fark Tespit Edildi</p><p className="text-[12px] text-red-400/70 mt-0.5">Kırmızı satırları kontrol edin. Cari hareketlerde eksik kayıt olabilir.</p></div></>
                    }
                  </div>
                )
              })()
            )}

            {/* Sistem verisi notu */}
            <p className="text-[11px] text-slate-600">
              * Sistem verisi: {AYLAR[kdvAy - 1]} {yil} tarihli <strong className="text-slate-500">satis_fatura</strong> ve <strong className="text-slate-500">alis_fatura</strong> kayıtlarından hesaplanmıştır.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
