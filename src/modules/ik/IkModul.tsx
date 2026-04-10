'use client'

import { useEffect, useRef, useState } from 'react'

import {
  Building2, CheckCircle2, ChevronDown, ChevronUp,
  FileText, Plus, Search, ScanText, Trash2, Upload, UserCheck,
  UserMinus, UserPlus, Users, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, ErrorMsg, Loading } from '@/components/ui'
import { pdfMetinOku, sgkBelgeParse, type ParsedPersonel } from '@/lib/pdfOkuyucu'
import type { AppCtx } from '@/app/page'
import type { Ekip, IkBelge, IkBelgeTipi, IkPersonel, Musteri, Proje } from '@/types'

// ── Config ──────────────────────────────────────────────────────────────────
const BELGE_TIPLER: { key: IkBelgeTipi; label: string; color: string }[] = [
  { key: 'giris_bildirgesi', label: 'İşe Giriş Bildirgesi', color: 'text-blue-600'    },
  { key: 'cikis_bildirgesi', label: 'İşten Çıkış Bildirgesi',color: 'text-rose-600'   },
  { key: 'kimlik',           label: 'Kimlik / TC',           color: 'text-amber-600'  },
  { key: 'diploma',          label: 'Diploma / Sertifika',   color: 'text-violet-600' },
  { key: 'saglik',           label: 'Sağlık Raporu',         color: 'text-emerald-600'},
  { key: 'sozlesme',         label: 'İş Sözleşmesi',         color: 'text-cyan-600'   },
  { key: 'diger',            label: 'Diğer',                 color: 'text-slate-500'  },
]

const BELGE_LABEL: Record<IkBelgeTipi, string> = Object.fromEntries(
  BELGE_TIPLER.map(b => [b.key, b.label])
) as Record<IkBelgeTipi, string>

const BELGE_COLOR: Record<IkBelgeTipi, string> = Object.fromEntries(
  BELGE_TIPLER.map(b => [b.key, b.color])
) as Record<IkBelgeTipi, string>

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*'

// ── Ekip renkleri ────────────────────────────────────────────────────────────
const EKIP_RENKLER = [
  { key: 'blue',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  { key: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { key: 'violet',  bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200'  },
  { key: 'amber',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  { key: 'rose',    bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
  { key: 'cyan',    bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200'    },
  { key: 'orange',  bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
  { key: 'pink',    bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200'    },
]

function ekipRenk(renk: string) {
  return EKIP_RENKLER.find(r => r.key === renk) ?? EKIP_RENKLER[0]
}

function EkipEtiket({ ekip, onClick, aktif }: { ekip: Ekip; onClick?: () => void; aktif?: boolean }) {
  const r = ekipRenk(ekip.renk)
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all',
        r.bg, r.text, r.border,
        aktif ? 'ring-1 ring-offset-1 ring-offset-transparent ' + r.border : '',
        onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
      ].join(' ')}
    >
      <Users size={9} /> {ekip.ad}
    </button>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function dateFmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR')
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

type Tab = 'personel' | 'ekipler' | 'toplu_yukle' | 'arsiv'

type PersonelForm = {
  ad_soyad: string
  tc_no: string
  dogum_tarihi: string
  ise_giris_tarihi: string
  isten_cikis_tarihi: string
  gorev: string
  maas: string
  proje_id: string
  ekip_id: string
  durum: 'aktif' | 'ayrildi'
  notlar: string
}

const EMPTY_FORM: PersonelForm = {
  ad_soyad: '', tc_no: '', dogum_tarihi: '', ise_giris_tarihi: todayStr(),
  isten_cikis_tarihi: '', gorev: '', maas: '', proje_id: '', ekip_id: '', durum: 'aktif', notlar: '',
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, action }: {
  icon: React.ElementType; title: string; subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl border border-slate-200 bg-blue-50 grid place-items-center">
          <Icon size={16} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function IkModul({ firma, firmalar, firmaIds }: AppCtx) {
  const [tab, setTab]               = useState<Tab>('personel')
  const [projeler, setProjeler]     = useState<Proje[]>([])
  const [, setMusteriler] = useState<Musteri[]>([])
  const [personeller, setPersoneller] = useState<IkPersonel[]>([])
  const [belgeler, setBelgeler]     = useState<IkBelge[]>([])
  const [ekipler, setEkipler]       = useState<Ekip[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // Ekip yönetimi
  const [ekipModal, setEkipModal]   = useState(false)
  const [ekipAd, setEkipAd]         = useState('')
  const [ekipRenkSec, setEkipRenkSec] = useState('blue')
  const [ekipProjeId, setEkipProjeId] = useState('')
  const [ekipEditId, setEkipEditId] = useState<string | null>(null)
  const [ekipSaving, setEkipSaving] = useState(false)

  // Personel form
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [form, setForm]             = useState<PersonelForm>(EMPTY_FORM)
  const [formErr, setFormErr]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [delId, setDelId]           = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filtreler
  const [q, setQ]                   = useState('')
  const [filtreDurum, setFiltreDurum] = useState<'tumu' | 'aktif' | 'ayrildi'>('tumu')
  const [filtreProje, setFiltreProje] = useState('')
  const [filtreEkip, setFiltreEkip] = useState('')

  // Toplu yükleme
  const [topluProjeId, setTopluProjeId]   = useState('')
  const [topluBelgeTipi, setTopluBelgeTipi] = useState<IkBelgeTipi>('giris_bildirgesi')
  const [topluPersonelId, setTopluPersonelId] = useState('')
  const [topluFiles, setTopluFiles]       = useState<File[]>([])
  const [uploading, setUploading]         = useState(false)
  const [topluSonuc, setTopluSonuc]       = useState<{ ok: number; fail: string[] } | null>(null)
  const topluRef = useRef<HTMLInputElement>(null)

  // Belge yükleme (personel detay)
  const [belgePersonelId, setBelgePersonelId] = useState<string | null>(null)
  const [belgeTipi, setBelgeTipi]         = useState<IkBelgeTipi>('giris_bildirgesi')
  const belgeRef = useRef<HTMLInputElement>(null)

  // Arşiv filtreleri
  const [arsivProjeId, setArsivProjeId]   = useState('')
  const [arsivTip, setArsivTip]           = useState<IkBelgeTipi | ''>('')

  // PDF parse modal
  const [parseModal, setParseModal]       = useState<{ belge: IkBelge; parsed: ParsedPersonel } | null>(null)
  const [parsing, setParsing]             = useState<string | null>(null) // belge id
  const [parseForm, setParseForm]         = useState<ParsedPersonel>({})
  const [parseSaving, setParseSaving]     = useState(false)
  const [parseHamMetin, setParseHamMetin] = useState('')

  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  useEffect(() => { void load() }, [firmaIds.join(',')])

  async function load() {
    setLoading(true); setError('')
    const [
      { data: p, error: pErr },
      { data: m },
      { data: per, error: perErr },
      { data: bel, error: belErr },
      { data: ekip },
    ] = await Promise.all([
      supabase.from('projeler').select('*').in('firma_id', firmaIds).order('ad'),
      supabase.from('musteriler').select('id,ad,kisa_ad').in('firma_id', firmaIds).eq('aktif', true).order('ad'),
      supabase.from('ik_personel').select('*').in('firma_id', firmaIds).order('ad_soyad'),
      supabase.from('ik_belge').select('*').in('firma_id', firmaIds).order('created_at', { ascending: false }),
      supabase.from('ekipler').select('*').in('firma_id', firmaIds).order('ad'),
    ])
    const firstErr = pErr || perErr || belErr
    if (firstErr) { setError(firstErr.message); setLoading(false); return }
    if (!p || !per) { setError('Veriler yüklenemedi'); setLoading(false); return }
    setProjeler((p || []) as Proje[])
    setMusteriler((m || []) as Musteri[])
    setPersoneller((per || []) as IkPersonel[])
    setBelgeler((bel || []) as IkBelge[])
    setEkipler((ekip || []) as Ekip[])
    setLoading(false)
  }

  const setF = (patch: Partial<PersonelForm>) => setForm(prev => ({ ...prev, ...patch }))

  function openNew() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setFormErr('')
    setShowForm(true)
  }

  function openEdit(p: IkPersonel) {
    setEditId(p.id)
    setForm({
      ad_soyad: p.ad_soyad,
      tc_no: p.tc_no ?? '',
      dogum_tarihi: p.dogum_tarihi ?? '',
      ise_giris_tarihi: p.ise_giris_tarihi,
      isten_cikis_tarihi: p.isten_cikis_tarihi ?? '',
      gorev: p.gorev ?? '',
      maas: p.maas ? String(p.maas) : '',
      proje_id: p.proje_id ?? '',
      ekip_id: p.ekip_id ?? '',
      durum: p.durum,
      notlar: p.notlar ?? '',
    })
    setFormErr('')
    setShowForm(true)
  }

  async function savePersonel() {
    if (!form.ad_soyad.trim()) { setFormErr('Ad Soyad zorunludur'); return }
    if (!form.ise_giris_tarihi) { setFormErr('İşe giriş tarihi zorunludur'); return }
    setSaving(true); setFormErr('')
    const payload = {
      firma_id: editId ? firma.id : selFirmaId,
      proje_id: form.proje_id || null,
      ekip_id: form.ekip_id || null,
      ad_soyad: form.ad_soyad.trim(),
      tc_no: form.tc_no.trim() || null,
      dogum_tarihi: form.dogum_tarihi || null,
      ise_giris_tarihi: form.ise_giris_tarihi,
      isten_cikis_tarihi: form.isten_cikis_tarihi || null,
      gorev: form.gorev.trim() || null,
      maas: form.maas ? Number(form.maas) : null,
      durum: form.durum,
      notlar: form.notlar.trim() || null,
    }
    const { error: e } = editId
      ? await supabase.from('ik_personel').update(payload).eq('id', editId)
      : await supabase.from('ik_personel').insert(payload)
    setSaving(false)
    if (e) { setFormErr(e.message); return }
    setShowForm(false)
    await load()
  }

  async function deletePersonel() {
    if (!delId) return
    await supabase.from('ik_personel').delete().eq('id', delId)
    setDelId(null)
    await load()
  }

  // ── Ekip CRUD ──────────────────────────────────────────────────────────────
  function openEkipNew() {
    setEkipEditId(null); setEkipAd(''); setEkipRenkSec('blue'); setEkipProjeId(''); setEkipModal(true)
  }
  function openEkipEdit(e: Ekip) {
    setEkipEditId(e.id); setEkipAd(e.ad); setEkipRenkSec(e.renk); setEkipProjeId(e.proje_id ?? ''); setEkipModal(true)
  }
  async function saveEkip() {
    if (!ekipAd.trim()) { alert('Ekip adı zorunludur'); return }
    if (!ekipProjeId) { alert('İşyeri / Proje seçimi zorunludur'); return }
    setEkipSaving(true)
    const payload = { firma_id: ekipEditId ? firma.id : selFirmaId, proje_id: ekipProjeId, ad: ekipAd.trim(), renk: ekipRenkSec, aktif: true }
    const { error: e } = ekipEditId
      ? await supabase.from('ekipler').update(payload).eq('id', ekipEditId)
      : await supabase.from('ekipler').insert(payload)
    setEkipSaving(false)
    if (e) { alert('Ekip kaydedilemedi: ' + e.message); return }
    setEkipModal(false)
    await load()
  }
  async function deleteEkip(id: string) {
    await supabase.from('ekipler').delete().eq('id', id)
    await load()
  }

  // ── Dosya yükleme (personel detay) ────────────────────────────────────────
  async function uploadBelge(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length || !belgePersonelId) return
    const personel = personeller.find(p => p.id === belgePersonelId)
    setUploading(true)
    for (const file of Array.from(files)) {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `ik/${firma.id}/${belgePersonelId}/${safeName}`
      const { error: sErr } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
      if (sErr) { alert(sErr.message); continue }
      const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
      await supabase.from('ik_belge').insert({
        firma_id: firma.id,
        personel_id: belgePersonelId,
        proje_id: personel?.proje_id ?? null,
        belge_tipi: belgeTipi,
        dosya_adi: file.name,
        dosya_url: urlData.publicUrl,
        mime_type: file.type || null,
        dosya_boyutu: file.size || null,
      })
    }
    setUploading(false)
    setBelgePersonelId(null)
    if (belgeRef.current) belgeRef.current.value = ''
    await load()
  }

  // ── Toplu yükleme ─────────────────────────────────────────────────────────
  async function topluYukle() {
    if (!topluFiles.length) return
    setUploading(true)
    setTopluSonuc(null)
    let ok = 0
    const fail: string[] = []
    for (const file of topluFiles) {
      try {
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const path = `ik/${firma.id}/toplu/${topluProjeId || 'genel'}/${safeName}`
        const { error: sErr } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
        if (sErr) { fail.push(`${file.name}: ${sErr.message}`); continue }
        const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
        const { error: iErr } = await supabase.from('ik_belge').insert({
          firma_id: firma.id,
          personel_id: topluPersonelId || null,
          proje_id: topluProjeId || null,
          belge_tipi: topluBelgeTipi,
          dosya_adi: file.name,
          dosya_url: urlData.publicUrl,
          mime_type: file.type || null,
          dosya_boyutu: file.size || null,
        })
        if (iErr) { fail.push(`${file.name}: ${iErr.message}`); continue }
        ok++
      } catch (e: any) {
        fail.push(`${file.name}: ${e?.message ?? 'Bilinmeyen hata'}`)
      }
    }
    setUploading(false)
    setTopluFiles([])
    if (topluRef.current) topluRef.current.value = ''
    setTopluSonuc({ ok, fail })
    await load()
    if (ok > 0 && fail.length === 0) setTab('arsiv')
  }

  async function deleteBelge(id: string) {
    await supabase.from('ik_belge').delete().eq('id', id)
    setBelgeler(prev => prev.filter(b => b.id !== id))
  }

  async function belgeParse(belge: IkBelge) {
    setParsing(belge.id)
    try {
      const metin = await pdfMetinOku(belge.dosya_url)
      console.log('PDF metin (tümü):', metin)
      setParseHamMetin(metin)
      const parsed = sgkBelgeParse(metin)
      setParseForm(parsed)
      setParseModal({ belge, parsed })
    } catch (e: any) {
      setParseForm({})
      setParseModal({ belge, parsed: {} })
      console.error('PDF parse hatası:', e)
      alert('PDF hatası: ' + (e?.message ?? String(e)))
    } finally {
      setParsing(null)
    }
  }

  async function parseKaydet() {
    if (!parseModal) return
    setParseSaving(true)
    // Aynı TC varsa güncelle, yoksa yeni ekle
    const existingByTc = parseForm.tc_no
      ? personeller.find(p => p.tc_no === parseForm.tc_no)
      : null

    const payload = {
      firma_id: firma.id,
      proje_id: parseModal.belge.proje_id ?? null,
      ad_soyad: parseForm.ad_soyad?.trim() || 'İsimsiz',
      tc_no: parseForm.tc_no?.trim() || null,
      dogum_tarihi: parseForm.dogum_tarihi || null,
      ise_giris_tarihi: parseForm.ise_giris_tarihi || new Date().toISOString().split('T')[0],
      isten_cikis_tarihi: parseForm.isten_cikis_tarihi || null,
      gorev: parseForm.gorev?.trim() || null,
      maas: parseForm.maas ? Number(parseForm.maas) : null,
      durum: parseForm.isten_cikis_tarihi ? 'ayrildi' : 'aktif',
    }

    if (existingByTc) {
      await supabase.from('ik_personel').update(payload).eq('id', existingByTc.id)
    } else {
      await supabase.from('ik_personel').insert(payload)
    }
    setParseSaving(false)
    setParseModal(null)
    await load()
    setTab('personel')
  }

  if (loading) return <Loading />
  if (error)   return <ErrorMsg message={error} onRetry={load} />

  // ── Filtre uygulaması ─────────────────────────────────────────────────────
  const filteredPersonel = personeller.filter(p => {
    if (filtreDurum !== 'tumu' && p.durum !== filtreDurum) return false
    if (filtreProje && p.proje_id !== filtreProje) return false
    if (filtreEkip === '__yok__' && p.ekip_id) return false
    if (filtreEkip && filtreEkip !== '__yok__' && p.ekip_id !== filtreEkip) return false
    if (q) {
      const needle = q.toLowerCase()
      if (!p.ad_soyad.toLowerCase().includes(needle) &&
          !(p.tc_no || '').includes(needle) &&
          !(p.gorev || '').toLowerCase().includes(needle)) return false
    }
    return true
  })

  const arsivBelgeler = belgeler.filter(b => {
    if (arsivProjeId && b.proje_id !== arsivProjeId) return false
    if (arsivTip && b.belge_tipi !== arsivTip) return false
    return true
  })

  return (
    <div className="space-y-5">
      {/* Gizli file input'lar */}
      <input ref={belgeRef}  type="file" multiple accept={ACCEPTED} className="hidden" onChange={uploadBelge} />
      <input ref={topluRef}  type="file" multiple accept={ACCEPTED} className="hidden"
        onChange={e => { if (e.target.files) setTopluFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = '' }} />

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 border-b border-blue-100">
        {([
          { key: 'personel',    label: 'Personel Listesi', icon: UserCheck  },
          { key: 'ekipler',     label: 'Ekipler',          icon: Users      },
          { key: 'toplu_yukle', label: 'Toplu Yükleme',    icon: Upload     },
          { key: 'arsiv',       label: 'Belge Arşivi',     icon: FileText   },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={['flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-blue-600 text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1 — Personel Listesi
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'personel' && (
        <>
          <SectionHeader
            icon={UserCheck}
            title="Personel Listesi"
            subtitle={`${personeller.filter(p => p.durum === 'aktif').length} aktif · ${personeller.filter(p => p.durum === 'ayrildi').length} ayrılan`}
            action={
              <button onClick={openNew} className={cls.btnPrimary}>
                <UserPlus size={14} /> Personel Ekle
              </button>
            }
          />

          {/* Arama + select filtreler */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="İsim, TC, görev..."
                className={`${cls.input} pl-8 text-xs`}
              />
            </div>
            <select value={filtreDurum} onChange={e => setFiltreDurum(e.target.value as typeof filtreDurum)} className={`${cls.input} w-auto text-xs`}>
              <option value="tumu">Tüm Durumlar</option>
              <option value="aktif">Aktif</option>
              <option value="ayrildi">Ayrılan</option>
            </select>
            <select value={filtreProje} onChange={e => setFiltreProje(e.target.value)} className={`${cls.input} w-auto text-xs`}>
              <option value="">Tüm İşyerleri</option>
              {projeler.map(p => (
                <option key={p.id} value={p.id}>{p.ad}{p.sgk_sicil_no ? ` (${p.sgk_sicil_no})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Ekip etiket filtreleri */}
          {ekipler.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFiltreEkip('')}
                className={[
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all',
                  filtreEkip === ''
                    ? 'bg-blue-100 text-blue-600 border-blue-300'
                    : 'bg-transparent text-slate-500 border-slate-100 hover:border-slate-300',
                ].join(' ')}
              >
                Tümü ({personeller.length})
              </button>
              {ekipler.map(e => {
                const sayi = personeller.filter(p => p.ekip_id === e.id).length
                return (
                  <EkipEtiket
                    key={e.id}
                    ekip={{ ...e, ad: `${e.ad} (${sayi})` }}
                    onClick={() => setFiltreEkip(filtreEkip === e.id ? '' : e.id)}
                    aktif={filtreEkip === e.id}
                  />
                )
              })}
              {personeller.filter(p => !p.ekip_id).length > 0 && (
                <button
                  onClick={() => setFiltreEkip('__yok__')}
                  className={[
                    'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all',
                    filtreEkip === '__yok__'
                      ? 'bg-slate-500/15 text-slate-300 border-slate-500/30'
                      : 'bg-transparent text-slate-500 border-slate-100 hover:border-slate-300',
                  ].join(' ')}
                >
                  Ekipsiz ({personeller.filter(p => !p.ekip_id).length})
                </button>
              )}
            </div>
          )}

          {/* Liste */}
          <div className={`${cls.card} overflow-hidden`}>
            {filteredPersonel.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">Kayıt bulunamadı.</div>
            ) : filteredPersonel.map((p, idx) => {
              const proje    = projeler.find(pr => pr.id === p.proje_id)
              const ekip     = ekipler.find(e => e.id === p.ekip_id)
              const pBelgeler = belgeler.filter(b => b.personel_id === p.id)
              const isExp    = expandedId === p.id
              return (
                <div key={p.id}>
                  {idx > 0 && <div className="h-px bg-slate-200 mx-4" />}
                  {/* Satır */}
                  <div className={`px-4 py-3 flex items-center gap-3 transition-colors ${isExp ? 'bg-slate-100' : 'hover:bg-slate-100'}`}>
                    {/* İkon */}
                    <div className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${p.durum === 'aktif' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {p.durum === 'aktif' ? <UserCheck size={14} /> : <UserMinus size={14} />}
                    </div>
                    {/* İsim / Görev */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{p.ad_soyad}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.durum === 'aktif' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                          {p.durum === 'aktif' ? 'Aktif' : 'Ayrıldı'}
                        </span>
                        {ekip && <EkipEtiket ekip={ekip} />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {p.gorev && <span className="text-[11px] text-slate-500">{p.gorev}</span>}
                        {proje && (
                          <span className="flex items-center gap-1 text-[11px] text-blue-500">
                            <Building2 size={10} /> {proje.ad}{proje.sgk_sicil_no ? ` · ${proje.sgk_sicil_no}` : ''}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">Giriş: {dateFmt(p.ise_giris_tarihi)}</span>
                        {p.isten_cikis_tarihi && <span className="text-[11px] text-rose-300/60">Çıkış: {dateFmt(p.isten_cikis_tarihi)}</span>}
                      </div>
                    </div>
                    {/* Belge sayısı */}
                    {pBelgeler.length > 0 && (
                      <span className="shrink-0 text-[10px] font-semibold text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        {pBelgeler.length} belge
                      </span>
                    )}
                    {/* Aksiyonlar */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setBelgePersonelId(p.id)
                          setBelgeTipi('giris_bildirgesi')
                          belgeRef.current?.click()
                        }}
                        title="Belge Yükle"
                        className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 grid place-items-center transition"
                      >
                        <Upload size={12} className="text-blue-500" />
                      </button>
                      <button onClick={() => openEdit(p)} title="Düzenle"
                        className="w-7 h-7 rounded-lg hover:bg-slate-200 grid place-items-center transition">
                        <Plus size={12} className="text-slate-500 rotate-45" />
                      </button>
                      <button onClick={() => setDelId(p.id)} title="Sil"
                        className="w-7 h-7 rounded-lg hover:bg-rose-500/10 grid place-items-center transition">
                        <Trash2 size={12} className="text-rose-400/50 hover:text-rose-400" />
                      </button>
                      <button onClick={() => setExpandedId(isExp ? null : p.id)}
                        className="w-7 h-7 rounded-lg hover:bg-slate-200 grid place-items-center transition">
                        {isExp ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
                      </button>
                    </div>
                  </div>

                  {/* Detay — Belgeler */}
                  {isExp && (
                    <div className="px-4 pb-3 pt-1 bg-slate-50 border-t border-slate-200">
                      {/* Belge tipi seçici + yükle */}
                      <div className="flex items-center gap-2 mb-3">
                        <select
                          value={belgeTipi}
                          onChange={e => setBelgeTipi(e.target.value as IkBelgeTipi)}
                          className={`${cls.input} w-auto text-xs`}
                        >
                          {BELGE_TIPLER.map(bt => (
                            <option key={bt.key} value={bt.key}>{bt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setBelgePersonelId(p.id); belgeRef.current?.click() }}
                          disabled={uploading}
                          className={`${cls.btnSecondary} text-xs`}
                        >
                          <Upload size={12} />
                          {uploading && belgePersonelId === p.id ? 'Yükleniyor...' : 'Belge Yükle'}
                        </button>
                      </div>

                      {pBelgeler.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Henüz belge yüklenmedi.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {pBelgeler.map(b => (
                            <div key={b.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 group/b">
                              <FileText size={12} className={`shrink-0 ${BELGE_COLOR[b.belge_tipi]}`} />
                              <div className="flex-1 min-w-0">
                                <a href={b.dosya_url} target="_blank" rel="noreferrer"
                                  className="block text-[11px] text-blue-500 hover:text-white truncate transition">
                                  {b.dosya_adi}
                                </a>
                                <span className={`text-[10px] font-semibold ${BELGE_COLOR[b.belge_tipi]}`}>
                                  {BELGE_LABEL[b.belge_tipi]}
                                </span>
                              </div>
                              <button onClick={() => deleteBelge(b.id)}
                                className="shrink-0 opacity-0 group-hover/b:opacity-100 text-rose-400/50 hover:text-rose-400 transition">
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2 — Ekipler
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'ekipler' && (
        <>
          <SectionHeader icon={Users} title="Ekip Yönetimi"
            subtitle="Personeli ekiplere ayırarak listede etiketle filtreleyin"
            action={
              <button onClick={openEkipNew} className={cls.btnPrimary}>
                <Plus size={14} /> Ekip Ekle
              </button>
            }
          />

          {ekipler.length === 0 ? (
            <div className={`${cls.card} py-12 text-center text-sm text-slate-500`}>
              Henüz ekip oluşturulmadı.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Projeye bağlı ekipler — proje bazlı grupla */}
              {projeler.map(proje => {
                const projeEkipleri = ekipler.filter(e => e.proje_id === proje.id)
                if (projeEkipleri.length === 0) return null
                return (
                  <div key={proje.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 size={13} className="text-blue-500" />
                      <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">{proje.ad}</span>
                      {proje.sgk_sicil_no && <span className="text-[10px] text-slate-400">{proje.sgk_sicil_no}</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {projeEkipleri.map(e => <EkipKart key={e.id} ekip={e} personeller={personeller} onEdit={openEkipEdit} onDelete={deleteEkip} />)}
                    </div>
                  </div>
                )
              })}
              {/* Projeye bağlı olmayan ekipler */}
              {ekipler.filter(e => !e.proje_id).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={13} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Genel Ekipler</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ekipler.filter(e => !e.proje_id).map(e => <EkipKart key={e.id} ekip={e} personeller={personeller} onEdit={openEkipEdit} onDelete={deleteEkip} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3 — Toplu Yükleme
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'toplu_yukle' && (
        <>
          <SectionHeader icon={Upload} title="Toplu Bildirge Yükleme"
            subtitle="Birden fazla dosyayı aynı anda, işyeri sicil numarasına göre arşivleyin" />

          <div className={`${cls.card} p-5 space-y-4`}>
            {/* İşyeri seçimi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  İşyeri / Proje <span className="normal-case text-slate-400">(SGK Sicil No)</span>
                </label>
                <select value={topluProjeId} onChange={e => setTopluProjeId(e.target.value)} className={cls.input}>
                  <option value="">— İşyeri Seçin —</option>
                  {projeler.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.sgk_sicil_no ? `[${p.sgk_sicil_no}] ` : ''}{p.ad}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Belge Tipi</label>
                <select value={topluBelgeTipi} onChange={e => setTopluBelgeTipi(e.target.value as IkBelgeTipi)} className={cls.input}>
                  {BELGE_TIPLER.map(bt => <option key={bt.key} value={bt.key}>{bt.label}</option>)}
                </select>
              </div>
            </div>

            {/* İsteğe bağlı personel eşleştirme */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Personel <span className="normal-case text-slate-400">(opsiyonel — personele bağlamak için seçin)</span>
              </label>
              <select value={topluPersonelId} onChange={e => setTopluPersonelId(e.target.value)} className={cls.input}>
                <option value="">— Personele Bağlama —</option>
                {personeller
                  .filter(p => !topluProjeId || p.proje_id === topluProjeId)
                  .map(p => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)}
              </select>
            </div>

            {/* Dosya seçici */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Dosyalar</label>
              <div
                onClick={() => topluRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-xl p-6 text-center cursor-pointer transition-colors group"
              >
                <Upload size={22} className="mx-auto mb-2 text-slate-400 group-hover:text-blue-500 transition-colors" />
                <p className="text-sm text-slate-500">Dosyaları buraya sürükleyin veya tıklayın</p>
                <p className="text-[11px] text-slate-400 mt-1">PDF, JPG, PNG — çoklu seçim desteklenir</p>
              </div>
            </div>

            {/* Seçilen dosyalar listesi */}
            {topluFiles.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">{topluFiles.length} dosya seçildi</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto space-y-1.5">
                  {topluFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 group/tf">
                      <FileText size={11} className="text-slate-500 shrink-0" />
                      <span className="flex-1 min-w-0 text-[11px] text-slate-500 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setTopluFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="opacity-0 group-hover/tf:opacity-100 text-rose-400/50 hover:text-rose-400 transition">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sonuç mesajı */}
            {topluSonuc && (
              <div className="space-y-1.5">
                {topluSonuc.ok > 0 && (
                  <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    {topluSonuc.ok} dosya başarıyla arşivlendi.
                  </p>
                )}
                {topluSonuc.fail.map((msg, i) => (
                  <p key={i} className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{msg}</p>
                ))}
              </div>
            )}

            {/* Yükle butonu */}
            <div className="flex justify-end pt-1">
              <button
                onClick={topluYukle}
                disabled={uploading || topluFiles.length === 0}
                className={cls.btnPrimary}
              >
                {uploading
                  ? <><div className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" /> Yükleniyor...</>
                  : <><CheckCircle2 size={14} /> {topluFiles.length} Dosyayı Arşivle</>
                }
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3 — Belge Arşivi
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'arsiv' && (
        <>
          <SectionHeader icon={FileText} title="Belge Arşivi"
            subtitle={`Toplam ${belgeler.length} belge`} />

          {/* Filtreler */}
          <div className="flex flex-wrap gap-2">
            <select value={arsivProjeId} onChange={e => setArsivProjeId(e.target.value)} className={`${cls.input} w-auto text-xs`}>
              <option value="">Tüm İşyerleri</option>
              {projeler.map(p => (
                <option key={p.id} value={p.id}>{p.sgk_sicil_no ? `[${p.sgk_sicil_no}] ` : ''}{p.ad}</option>
              ))}
            </select>
            <select value={arsivTip} onChange={e => setArsivTip(e.target.value as IkBelgeTipi | '')} className={`${cls.input} w-auto text-xs`}>
              <option value="">Tüm Belge Tipleri</option>
              {BELGE_TIPLER.map(bt => <option key={bt.key} value={bt.key}>{bt.label}</option>)}
            </select>
          </div>

          {/* İşyeri bazlı gruplu liste */}
          {arsivProjeId ? (
            <BelgeGrubu
              proje={projeler.find(p => p.id === arsivProjeId) ?? null}
              belgeler={arsivBelgeler}
              personeller={personeller}
              onDelete={deleteBelge}
              onParse={belgeParse}
              parsing={parsing}
            />
          ) : (
            <div className="space-y-4">
              {/* Projeye bağlı belgeler — proje bazlı grupla */}
              {projeler.map(proje => {
                const prBelgeler = arsivBelgeler.filter(b => b.proje_id === proje.id)
                if (prBelgeler.length === 0) return null
                return (
                  <BelgeGrubu key={proje.id} proje={proje} belgeler={prBelgeler}
                    personeller={personeller} onDelete={deleteBelge}
                    onParse={belgeParse} parsing={parsing} />
                )
              })}
              {/* Projeye bağlı olmayan belgeler */}
              {(() => {
                const orphans = arsivBelgeler.filter(b => !b.proje_id)
                if (!orphans.length) return null
                return <BelgeGrubu proje={null} belgeler={orphans} personeller={personeller} onDelete={deleteBelge} onParse={belgeParse} parsing={parsing} />
              })()}
              {arsivBelgeler.length === 0 && (
                <div className={`${cls.card} py-12 text-center text-sm text-slate-500`}>
                  Henüz belge arşivlenmedi.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Personel Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-white text-base">{editId ? 'Personeli Düzenle' : 'Yeni Personel'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-200 transition">
                <X size={15} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {formErr && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{formErr}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Ad Soyad *</label>
                  <input className={cls.input} value={form.ad_soyad} onChange={e => setF({ ad_soyad: e.target.value })} placeholder="Ad Soyad" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">TC No</label>
                  <input className={cls.input} value={form.tc_no} onChange={e => setF({ tc_no: e.target.value })} placeholder="11 hane" maxLength={11} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Doğum Tarihi</label>
                  <input type="date" className={`${cls.input} [color-scheme:dark]`} value={form.dogum_tarihi} onChange={e => setF({ dogum_tarihi: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">İşe Giriş Tarihi *</label>
                  <input type="date" className={`${cls.input} [color-scheme:dark]`} value={form.ise_giris_tarihi} onChange={e => setF({ ise_giris_tarihi: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">İşten Çıkış Tarihi</label>
                  <input type="date" className={`${cls.input} [color-scheme:dark]`} value={form.isten_cikis_tarihi} onChange={e => setF({ isten_cikis_tarihi: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Görev / Pozisyon</label>
                  <input className={cls.input} value={form.gorev} onChange={e => setF({ gorev: e.target.value })} placeholder="Mühendis, İşçi..." />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Maaş (₺)</label>
                  <input type="number" className={cls.input} value={form.maas} onChange={e => setF({ maas: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">İşyeri / Proje</label>
                  <select className={cls.input} value={form.proje_id} onChange={e => setF({ proje_id: e.target.value })}>
                    <option value="">— Seçin —</option>
                    {projeler.map(p => (
                      <option key={p.id} value={p.id}>{p.ad}{p.sgk_sicil_no ? ` (${p.sgk_sicil_no})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Ekip</label>
                  <select className={cls.input} value={form.ekip_id} onChange={e => setF({ ekip_id: e.target.value })}>
                    <option value="">— Ekip Yok —</option>
                    {ekipler.map(e => (
                      <option key={e.id} value={e.id}>{e.ad}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Durum</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([['aktif', 'Aktif', 'emerald'], ['ayrildi', 'Ayrıldı', 'rose']] as const).map(([val, lbl, color]) => (
                      <button key={val} type="button" onClick={() => setF({ durum: val })}
                        className={['flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition',
                          form.durum === val
                            ? color === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300',
                        ].join(' ')}
                      >
                        {val === 'aktif' ? <UserCheck size={12} /> : <UserMinus size={12} />} {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Notlar</label>
                  <textarea className={`${cls.input} min-h-[64px]`} value={form.notlar} onChange={e => setF({ notlar: e.target.value })} placeholder="Ek notlar..." />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setShowForm(false)} className={cls.btnSecondary}>İptal</button>
              <button onClick={savePersonel} disabled={saving} className={cls.btnPrimary}>
                {saving ? 'Kaydediliyor...' : editId ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ekip Modal ── */}
      {ekipModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEkipModal(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-white text-base">{ekipEditId ? 'Ekibi Düzenle' : 'Yeni Ekip'}</h3>
              <button onClick={() => setEkipModal(false)} className="p-1.5 rounded-lg hover:bg-slate-200 transition">
                <X size={15} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Ekip Adı</label>
                <input
                  className={cls.input} value={ekipAd}
                  onChange={e => setEkipAd(e.target.value)}
                  placeholder="Örn: Demir Ekibi, A Grubu..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">İşyeri / Proje</label>
                <select className={cls.input} value={ekipProjeId} onChange={e => setEkipProjeId(e.target.value)}>
                  <option value="">— Tüm Projeler —</option>
                  {projeler.map(p => (
                    <option key={p.id} value={p.id}>{p.ad}{p.sgk_sicil_no ? ` (${p.sgk_sicil_no})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Renk</label>
                <div className="flex flex-wrap gap-2">
                  {EKIP_RENKLER.map(r => (
                    <button
                      key={r.key}
                      onClick={() => setEkipRenkSec(r.key)}
                      className={[
                        'w-7 h-7 rounded-full border-2 transition-all',
                        r.bg, r.border,
                        ekipRenkSec === r.key ? 'scale-125 ring-2 ring-white/20' : 'opacity-60 hover:opacity-100',
                      ].join(' ')}
                      title={r.key}
                    />
                  ))}
                </div>
              </div>
              {/* Önizleme */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Önizleme:</span>
                <EkipEtiket ekip={{ id: '', firma_id: '', proje_id: '', ad: ekipAd || 'Ekip Adı', renk: ekipRenkSec, aktif: true }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setEkipModal(false)} className={cls.btnSecondary}>İptal</button>
              <button onClick={saveEkip} disabled={ekipSaving || !ekipAd.trim()} className={cls.btnPrimary}>
                {ekipSaving ? 'Kaydediliyor...' : ekipEditId ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Silme Onayı ── */}
      {delId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDelId(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-base mb-2">Personeli Sil</h3>
            <p className="text-sm text-slate-500 mb-5">Bu personel ve tüm belgeleri kalıcı olarak silinecektir.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDelId(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={deletePersonel} className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm font-bold text-white transition">
                <Trash2 size={13} /> Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Parse Modalı ── */}
      {parseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setParseModal(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-white text-base">PDF'den Okunan Veriler</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{parseModal.belge.dosya_adi}</p>
              </div>
              <button onClick={() => setParseModal(null)} className="p-1.5 rounded-lg hover:bg-slate-200 transition">
                <X size={15} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {parseHamMetin && (
                <details className="mb-2">
                  <summary className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none mb-1">Ham PDF Metni (debug)</summary>
                  <pre className="mt-2 text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">{parseHamMetin}</pre>
                </details>
              )}
              {Object.keys(parseForm).length === 0 ? (
                <p className="text-sm text-slate-500 italic">Bu PDF'den veri okunamadı. Taranmış görüntü olabilir.</p>
              ) : (
                <>
                  {([
                    ['ad_soyad',           'Ad Soyad'],
                    ['tc_no',              'TC No'],
                    ['dogum_tarihi',       'Doğum Tarihi'],
                    ['ise_giris_tarihi',   'İşe Giriş Tarihi'],
                    ['isten_cikis_tarihi', 'İşten Çıkış Tarihi'],
                    ['gorev',              'Görev'],
                    ['maas',               'Maaş'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</label>
                      <input
                        className={cls.input}
                        value={(parseForm as any)[key] ?? ''}
                        onChange={e => setParseForm(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={`${label} girilmedi`}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setParseModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={parseKaydet} disabled={parseSaving} className={cls.btnPrimary}>
                {parseSaving ? 'Kaydediliyor...' : 'Personele Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ekip Kart bileşeni ──────────────────────────────────────────────────────
function EkipKart({ ekip, personeller, onEdit, onDelete }: {
  ekip: Ekip
  personeller: IkPersonel[]
  onEdit: (e: Ekip) => void
  onDelete: (id: string) => void
}) {
  const r = ekipRenk(ekip.renk)
  const uyeler = personeller.filter(p => p.ekip_id === ekip.id)
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-3`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${r.bg} border ${r.border} shrink-0`} />
          <span className="font-bold text-white text-sm truncate">{ekip.ad}</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-2">{uyeler.length} personel</p>
        {uyeler.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {uyeler.slice(0, 5).map(u => (
              <span key={u.id} className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                {u.ad_soyad.split(' ')[0]}
              </span>
            ))}
            {uyeler.length > 5 && <span className="text-[10px] text-slate-400">+{uyeler.length - 5}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={() => onEdit(ekip)}
          className="w-7 h-7 rounded-lg hover:bg-slate-200 grid place-items-center transition">
          <Plus size={12} className="text-slate-500 rotate-45" />
        </button>
        <button onClick={() => onDelete(ekip.id)}
          className="w-7 h-7 rounded-lg hover:bg-rose-500/10 grid place-items-center transition">
          <Trash2 size={12} className="text-rose-400/50 hover:text-rose-400" />
        </button>
      </div>
    </div>
  )
}

// ── Belge Grubu bileşeni ────────────────────────────────────────────────────
function BelgeGrubu({ proje, belgeler, personeller, onDelete, onParse, parsing }: {
  proje: Proje | null
  belgeler: IkBelge[]
  personeller: IkPersonel[]
  onDelete: (id: string) => void
  onParse: (belge: IkBelge) => void
  parsing: string | null
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className={`${cls.card} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition text-left"
      >
        <Building2 size={14} className="text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">
            {proje ? proje.ad : 'İşyerine Bağlı Olmayan Belgeler'}
          </span>
          {proje?.sgk_sicil_no && (
            <span className="ml-2 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
              SGK: {proje.sgk_sicil_no}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500 shrink-0">{belgeler.length} belge</span>
        {open ? <ChevronUp size={13} className="text-slate-500 shrink-0" /> : <ChevronDown size={13} className="text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-slate-200 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {belgeler.map(b => {
              const personel = personeller.find(p => p.id === b.personel_id)
              return (
                <div key={b.id} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 group/b">
                  <FileText size={13} className={`shrink-0 mt-0.5 ${BELGE_COLOR[b.belge_tipi]}`} />
                  <div className="flex-1 min-w-0">
                    <a href={b.dosya_url} target="_blank" rel="noreferrer"
                      className="block text-[11px] text-blue-500 hover:text-white truncate transition">
                      {b.dosya_adi}
                    </a>
                    <span className={`block text-[10px] font-semibold ${BELGE_COLOR[b.belge_tipi]}`}>
                      {BELGE_LABEL[b.belge_tipi]}
                    </span>
                    {personel && <span className="block text-[10px] text-slate-400">{personel.ad_soyad}</span>}
                    <span className="block text-[10px] text-slate-400">
                      {new Date(b.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover/b:opacity-100 transition mt-0.5">
                    {b.mime_type?.includes('pdf') || b.dosya_adi.toLowerCase().endsWith('.pdf') ? (
                      <button onClick={() => onParse(b)} title="PDF'den Veri Oku"
                        disabled={parsing === b.id}
                        className="text-blue-500 hover:text-white transition">
                        {parsing === b.id
                          ? <div className="w-3 h-3 rounded-full border border-blue-200 border-t-blue-600 animate-spin" />
                          : <ScanText size={11} />}
                      </button>
                    ) : null}
                    <button onClick={() => onDelete(b.id)}
                      className="text-rose-400/50 hover:text-rose-400 transition">
                      <X size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
