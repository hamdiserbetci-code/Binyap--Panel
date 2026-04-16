'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  ShieldCheck, Plus, Edit, Trash2, Search,
  AlertTriangle, CheckCircle, Clock, Upload,
  Download, Eye, X, ChevronDown, ChevronRight, RefreshCw, FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, StatCard, Card, Modal, Btn, Field,
  inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate
} from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ─── Sabitler ────────────────────────────────────────────────
const SIGORTA_TURLERI = [
  { v: 'arac_kasko',    l: 'Araç Kasko',        emoji: '🚗', renk: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  { v: 'arac_trafik',   l: 'Araç Trafik',       emoji: '🛣️',  renk: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { v: 'ferdi_kaza',    l: 'Ferdi Kaza',        emoji: '🧑',  renk: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200'   },
  { v: 'isyeri',        l: 'İşyeri Sigortası',  emoji: '🏢',  renk: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200'  },
  { v: 'sorumluluk',    l: 'Sorumluluk',        emoji: '⚖️',  renk: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  { v: 'diger',         l: 'Diğer',             emoji: '📋',  renk: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200'   },
]

const DURUMLAR: Record<string, { l: string; v: 'green'|'red'|'gray'|'blue' }> = {
  aktif:        { l: 'Aktif',         v: 'green' },
  suresi_doldu: { l: 'Süresi Doldu',  v: 'red'   },
  iptal:        { l: 'İptal',         v: 'gray'  },
  yenilendi:    { l: 'Yenilendi',     v: 'blue'  },
}

const BELGE_TURLERI = [
  { v: 'police',    l: 'Poliçe',    emoji: '📄' },
  { v: 'zeyilname', l: 'Zeyilname', emoji: '📝' },
  { v: 'hasar',     l: 'Hasar',     emoji: '⚠️'  },
  { v: 'diger',     l: 'Diğer',     emoji: '📎' },
]

const ODEME_SEKLI = [
  { v: 'yillik',   l: 'Yıllık'   },
  { v: 'aylik',    l: 'Aylık'    },
  { v: 'taksitli', l: 'Taksitli' },
]

const emptyForm = {
  police_no: '', sigorta_turu: 'arac_kasko', sigorta_sirketi: '',
  acente_adi: '', acente_telefon: '', sigortali_varlik: '', plaka: '',
  prim_tutari: '', odeme_sekli: 'yillik',
  baslangic_tarihi: '', bitis_tarihi: '', yenileme_tarihi: '',
  durum: 'aktif', notlar: '',
}

// ─── Ana Modül ────────────────────────────────────────────────
export default function PoliceModule({ firma }: AppCtx) {
  const [policeler, setPoliceler] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [turF, setTurF]           = useState('hepsi')
  const [durumF, setDurumF]       = useState('hepsi')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState<any | null>(null)
  const [delId, setDelId]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(emptyForm)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('policeler')
      .select('*')
      .eq('firma_id', firma.id)
      .order('bitis_tarihi', { ascending: true })
    // Süresi dolmuş poliçeleri otomatik güncelle
    const bugun = new Date().toISOString().split('T')[0]
    const guncelle = (data || []).filter(p => p.durum === 'aktif' && p.bitis_tarihi < bugun)
    if (guncelle.length > 0) {
      await supabase.from('policeler').update({ durum: 'suresi_doldu' })
        .in('id', guncelle.map(p => p.id))
    }
    setPoliceler(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const filtered = useMemo(() => policeler.filter(p => {
    if (turF !== 'hepsi' && p.sigorta_turu !== turF) return false
    if (durumF !== 'hepsi' && p.durum !== durumF) return false
    if (search) {
      const q = search.toLowerCase()
      return p.police_no?.toLowerCase().includes(q) ||
        p.sigorta_sirketi?.toLowerCase().includes(q) ||
        p.sigortali_varlik?.toLowerCase().includes(q) ||
        p.plaka?.toLowerCase().includes(q)
    }
    return true
  }), [policeler, turF, durumF, search])

  const summary = useMemo(() => {
    const bugun = new Date(); bugun.setHours(0,0,0,0)
    const yedi  = new Date(bugun); yedi.setDate(yedi.getDate() + 30)
    return {
      toplam:      policeler.length,
      aktif:       policeler.filter(p => p.durum === 'aktif').length,
      doldu:       policeler.filter(p => p.durum === 'suresi_doldu').length,
      yaklasan:    policeler.filter(p => p.durum === 'aktif' && new Date(p.bitis_tarihi) <= yedi).length,
      toplamPrim:  policeler.filter(p => p.durum === 'aktif').reduce((s, p) => s + Number(p.prim_tutari || 0), 0),
    }
  }, [policeler])

  const [yeniPoliceId, setYeniPoliceId] = useState<string | null>(null)

  function openNew() { setForm(emptyForm); setEditing(null); setYeniPoliceId(null); setModal(true) }
  function openEdit(p: any) {
    setForm({
      police_no: p.police_no || '', sigorta_turu: p.sigorta_turu || 'arac_kasko',
      sigorta_sirketi: p.sigorta_sirketi || '', acente_adi: p.acente_adi || '',
      acente_telefon: p.acente_telefon || '', sigortali_varlik: p.sigortali_varlik || '',
      plaka: p.plaka || '', prim_tutari: String(p.prim_tutari || ''),
      odeme_sekli: p.odeme_sekli || 'yillik',
      baslangic_tarihi: p.baslangic_tarihi || '', bitis_tarihi: p.bitis_tarihi || '',
      yenileme_tarihi: p.yenileme_tarihi || '', durum: p.durum || 'aktif', notlar: p.notlar || '',
    })
    setEditing(p); setYeniPoliceId(null); setModal(true)
  }

  async function save() {
    if (!form.police_no || !form.sigorta_sirketi || !form.baslangic_tarihi || !form.bitis_tarihi)
      return alert('Poliçe no, sigorta şirketi ve tarihler zorunludur')
    setSaving(true)
    const payload = {
      police_no: form.police_no, sigorta_turu: form.sigorta_turu,
      sigorta_sirketi: form.sigorta_sirketi, acente_adi: form.acente_adi || null,
      acente_telefon: form.acente_telefon || null,
      sigortali_varlik: form.sigortali_varlik || null, plaka: form.plaka || null,
      prim_tutari: form.prim_tutari ? Number(form.prim_tutari) : null,
      odeme_sekli: form.odeme_sekli,
      baslangic_tarihi: form.baslangic_tarihi, bitis_tarihi: form.bitis_tarihi,
      yenileme_tarihi: form.yenileme_tarihi || null,
      durum: form.durum, notlar: form.notlar || null,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await supabase.from('policeler').update(payload).eq('id', editing.id)
      setSaving(false); setModal(false); load()
    } else {
      const { data: newRec, error } = await supabase
        .from('policeler').insert({ ...payload, firma_id: firma.id }).select().single()
      if (error) { alert('Hata: ' + error.message); setSaving(false); return }
      setSaving(false)
      setYeniPoliceId(newRec.id) // PDF yükleme adımına geç
      load()
    }
  }

  const sf = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  // 30 gün içinde dolacak uyarı bandı
  const yaklasanlar = policeler.filter(p => {
    if (p.durum !== 'aktif') return false
    const bugun = new Date(); bugun.setHours(0,0,0,0)
    const bitis = new Date(p.bitis_tarihi); bitis.setHours(0,0,0,0)
    const fark  = Math.floor((bitis.getTime() - bugun.getTime()) / 86400000)
    return fark >= 0 && fark <= 30
  })

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
        title="Poliçe Takibi"
        subtitle="Araç, ferdi kaza ve diğer sigorta poliçeleri"
        iconBg="bg-emerald-50"
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>Yenile</Btn>
            <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Poliçe</Btn>
          </div>
        }
      />

      {/* Özet */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Toplam"        value={summary.toplam}              color="text-gray-700" />
        <StatCard label="Aktif"         value={summary.aktif}               color="text-green-600" />
        <StatCard label="Süresi Doldu"  value={summary.doldu}               color="text-red-600" />
        <StatCard label="30 Gün İçinde" value={summary.yaklasan}            color="text-amber-600" />
        <StatCard label="Toplam Prim"   value={fmt(summary.toplamPrim)}     color="text-emerald-600" />
      </div>

      {/* Yaklaşan Uyarı Bandı */}
      {yaklasanlar.length > 0 && (
        <div className="space-y-2">
          {yaklasanlar.map(p => {
            const bugun = new Date(); bugun.setHours(0,0,0,0)
            const bitis = new Date(p.bitis_tarihi); bitis.setHours(0,0,0,0)
            const fark  = Math.floor((bitis.getTime() - bugun.getTime()) / 86400000)
            const tur   = SIGORTA_TURLERI.find(t => t.v === p.sigorta_turu)
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-amber-900">
                    {tur?.emoji} {p.police_no} — {p.sigorta_sirketi}
                  </span>
                  {p.sigortali_varlik && <span className="text-xs text-amber-700 ml-2">({p.sigortali_varlik})</span>}
                  {p.plaka && <span className="text-xs text-amber-700 ml-1">[{p.plaka}]</span>}
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${fark === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {fark === 0 ? 'Bugün bitiyor!' : `${fark} gün kaldı`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Tip Filtreleri */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTurF('hepsi')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${turF === 'hepsi' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
          Tümü
        </button>
        {SIGORTA_TURLERI.map(t => (
          <button key={t.v} onClick={() => setTurF(turF === t.v ? 'hepsi' : t.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${turF === t.v ? `${t.bg} ${t.renk} ${t.border}` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {t.emoji} {t.l}
          </button>
        ))}
        <select value={durumF} onChange={e => setDurumF(e.target.value)} className={inputCls + ' w-auto text-xs py-1.5'}>
          <option value="hepsi">Tüm Durumlar</option>
          {Object.entries(DURUMLAR).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
        </select>
      </div>

      {/* Arama */}
      <Card className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Poliçe no, şirket, araç veya plaka..."
            value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`} />
        </div>
      </Card>

      {/* Master Grid */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="w-10 h-10" />} message="Poliçe bulunamadı" />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(p => (
              <PoliceSatiri
                key={p.id}
                police={p}
                firma={firma}
                expanded={expanded === p.id}
                onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                onEdit={() => openEdit(p)}
                onDelete={() => setDelId(p.id)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      {modal && (
        <Modal
          title={yeniPoliceId ? '✓ Poliçe Kaydedildi — PDF Yükle' : editing ? 'Poliçe Düzenle' : 'Yeni Poliçe'}
          onClose={() => { setModal(false); setYeniPoliceId(null) }}
          size="xl"
          footer={
            yeniPoliceId ? (
              <Btn onClick={() => { setModal(false); setYeniPoliceId(null) }}>Tamamla</Btn>
            ) : (
              <><Btn variant="secondary" onClick={() => { setModal(false); setYeniPoliceId(null) }}>İptal</Btn>
              <Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet ve PDF Yükle'}</Btn></>
            )
          }
        >
          {yeniPoliceId ? (
            /* ── PDF Yükleme Adımı ── */
            <div className="space-y-5">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-semibold text-green-800">Poliçe kaydedildi!</p>
                  <p className="text-sm text-green-600">Poliçe PDF'ini hemen yükleyebilirsiniz.</p>
                </div>
              </div>

              <PoliceHizliYukle
                policeId={yeniPoliceId}
                firmaId={firma.id}
              />

              <p className="text-xs text-gray-400 text-center">
                PDF'i daha sonra da yükleyebilirsiniz. Poliçe satırına tıklayarak detay panelinden erişebilirsiniz.
              </p>
            </div>
          ) : (
            /* ── Form Alanları ── */
            <div className="space-y-5">
            {/* Sigorta Türü */}
            <Field label="Sigorta Türü" required>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SIGORTA_TURLERI.map(t => (
                  <button key={t.v} type="button"
                    onClick={() => setForm(p => ({ ...p, sigorta_turu: t.v }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.sigorta_turu === t.v ? `${t.bg} ${t.renk} ${t.border}` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <span>{t.emoji}</span>{t.l}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Poliçe No" required>
                <input type="text" value={form.police_no} onChange={sf('police_no')} className={inputCls} placeholder="POL-2025-001" />
              </Field>
              <Field label="Sigorta Şirketi" required>
                <input type="text" value={form.sigorta_sirketi} onChange={sf('sigorta_sirketi')} className={inputCls} placeholder="Allianz, Axa, Mapfre..." />
              </Field>
              <Field label="Acente Adı">
                <input type="text" value={form.acente_adi} onChange={sf('acente_adi')} className={inputCls} />
              </Field>
              <Field label="Acente Telefon">
                <input type="text" value={form.acente_telefon} onChange={sf('acente_telefon')} className={inputCls} />
              </Field>
              <Field label="Sigortalı Varlık / Kişi">
                <input type="text" value={form.sigortali_varlik} onChange={sf('sigortali_varlik')} className={inputCls} placeholder="Araç modeli, kişi adı..." />
              </Field>
              <Field label="Plaka">
                <input type="text" value={form.plaka} onChange={sf('plaka')} className={`${inputCls} uppercase`} placeholder="34 ABC 123" />
              </Field>
              <Field label="Prim Tutarı (₺)">
                <input type="number" step="0.01" value={form.prim_tutari} onChange={sf('prim_tutari')} className={inputCls} />
              </Field>
              <Field label="Ödeme Şekli">
                <select value={form.odeme_sekli} onChange={sf('odeme_sekli')} className={inputCls}>
                  {ODEME_SEKLI.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
              <Field label="Başlangıç Tarihi" required>
                <input type="date" value={form.baslangic_tarihi} onChange={sf('baslangic_tarihi')} className={inputCls} />
              </Field>
              <Field label="Bitiş Tarihi" required>
                <input type="date" value={form.bitis_tarihi} onChange={sf('bitis_tarihi')} className={inputCls} />
              </Field>
              <Field label="Yenileme Tarihi">
                <input type="date" value={form.yenileme_tarihi} onChange={sf('yenileme_tarihi')} className={inputCls} />
              </Field>
              <Field label="Durum">
                <select value={form.durum} onChange={sf('durum')} className={inputCls}>
                  {Object.entries(DURUMLAR).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                </select>
              </Field>
              <Field label="Notlar" className="md:col-span-2">
                <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
              </Field>
            </div>
            </div>
          )}
        </Modal>
      )}

      {delId && (
        <ConfirmDialog
          message="Bu poliçeyi silmek istediğinize emin misiniz?"
          onConfirm={async () => { await supabase.from('policeler').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)}
        />
      )}
    </div>
  )
}

// ─── Poliçe Satırı (Master + Detail) ─────────────────────────
interface PoliceSatiriProps {
  police: any
  firma: { id: string }
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

function PoliceSatiri({ police: p, firma, expanded, onToggle, onEdit, onDelete, onRefresh }: PoliceSatiriProps) {
  const [belgeler, setBelgeler]   = useState<any[]>([])
  const [loadingB, setLoadingB]   = useState(false)
  const [belgeModal, setBelgeModal] = useState(false)
  const [belgeForm, setBelgeForm] = useState({ belge_turu: 'police', aciklama: '' })
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]     = useState<{ url: string; adi: string } | null>(null)

  const tur    = SIGORTA_TURLERI.find(t => t.v === p.sigorta_turu)
  const durum  = DURUMLAR[p.durum] || DURUMLAR.aktif

  const bugun  = new Date(); bugun.setHours(0,0,0,0)
  const bitis  = new Date(p.bitis_tarihi); bitis.setHours(0,0,0,0)
  const kalanGun = Math.floor((bitis.getTime() - bugun.getTime()) / 86400000)
  const yaklasan = p.durum === 'aktif' && kalanGun >= 0 && kalanGun <= 30
  const doldu    = p.durum === 'suresi_doldu' || (p.durum === 'aktif' && kalanGun < 0)

  useEffect(() => {
    if (expanded && belgeler.length === 0) loadBelgeler()
  }, [expanded])

  async function loadBelgeler() {
    setLoadingB(true)
    const { data } = await supabase.from('police_belgeler').select('*').eq('police_id', p.id).order('created_at', { ascending: false })
    setBelgeler(data || [])
    setLoadingB(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const safeName = file.name
      .replace(/[ğ]/g,'g').replace(/[Ğ]/g,'G').replace(/[ü]/g,'u').replace(/[Ü]/g,'U')
      .replace(/[ş]/g,'s').replace(/[Ş]/g,'S').replace(/[ı]/g,'i').replace(/[İ]/g,'I')
      .replace(/[ö]/g,'o').replace(/[Ö]/g,'O').replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
      .replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const ext  = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${firma.id}/${p.id}/${belgeForm.belge_turu}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('police-belgeler').upload(path, file)
    if (error) { alert('Yükleme hatası: ' + error.message); setUploading(false); return }
    await supabase.from('police_belgeler').insert({
      police_id: p.id, firma_id: firma.id,
      belge_turu: belgeForm.belge_turu,
      belge_tarihi: new Date().toISOString().split('T')[0],
      dosya_adi: file.name, storage_path: path,
      aciklama: belgeForm.aciklama || null,
    })
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    setBelgeModal(false)
    loadBelgeler()
  }

  async function belgeIndir(b: any) {
    const { data } = await supabase.storage.from('police-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = b.dosya_adi; a.click() }
  }

  async function belgeOnizle(b: any) {
    const { data } = await supabase.storage.from('police-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) setPreview({ url: data.signedUrl, adi: b.dosya_adi })
  }

  async function belgeSil(b: any) {
    if (!confirm(`"${b.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('police-belgeler').remove([b.storage_path])
    await supabase.from('police_belgeler').delete().eq('id', b.id)
    loadBelgeler()
  }

  return (
    <div>
      {/* Master Satır */}
      <div
        className={`flex items-center gap-3 px-4 py-4 hover:bg-gray-50 cursor-pointer ${doldu ? 'bg-red-50/30' : yaklasan ? 'bg-amber-50/30' : ''}`}
        onClick={onToggle}
      >
        <span className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        {/* Tür Rozeti */}
        <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border ${tur?.bg} ${tur?.renk} ${tur?.border}`}>
          {tur?.emoji} {tur?.l}
        </div>

        {/* Bilgiler */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm font-mono">{p.police_no}</span>
            <span className="text-sm text-gray-700">{p.sigorta_sirketi}</span>
            {p.plaka && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono font-bold">{p.plaka}</span>}
            {p.sigortali_varlik && <span className="text-xs text-gray-500">{p.sigortali_varlik}</span>}
            <Badge label={durum.l} variant={durum.v} />
            {yaklasan && (
              <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{kalanGun === 0 ? 'Bugün bitiyor!' : `${kalanGun} gün kaldı`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-gray-400">{fmtDate(p.baslangic_tarihi)} — {fmtDate(p.bitis_tarihi)}</span>
            {p.prim_tutari && <span className="text-xs font-semibold text-emerald-600">{fmt(Number(p.prim_tutari))}</span>}
            {p.acente_adi && <span className="text-xs text-gray-400">Acente: {p.acente_adi}</span>}
          </div>
        </div>

        {/* Aksiyonlar */}
        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail Panel */}
      {expanded && (
        <div className="bg-slate-50 border-t border-gray-200 px-4 py-5 space-y-4">
          {loadingB ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Poliçe Detay Bilgileri */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { l: 'Başlangıç',  v: fmtDate(p.baslangic_tarihi) },
                  { l: 'Bitiş',      v: fmtDate(p.bitis_tarihi)     },
                  { l: 'Prim',       v: p.prim_tutari ? fmt(Number(p.prim_tutari)) : '-' },
                  { l: 'Ödeme',      v: ODEME_SEKLI.find(o => o.v === p.odeme_sekli)?.l || '-' },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">{s.l}</p>
                    <p className="text-sm font-semibold text-gray-900">{s.v}</p>
                  </div>
                ))}
              </div>

              {p.notlar && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">NOTLAR</p>
                  <p className="text-sm text-gray-700">{p.notlar}</p>
                </div>
              )}

              {/* Belgeler */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4" />Belgeler ({belgeler.length})
                  </p>
                  <Btn size="sm" icon={<Upload className="w-3 h-3" />} onClick={() => setBelgeModal(true)}>
                    Belge Yükle
                  </Btn>
                </div>

                {belgeler.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Henüz belge eklenmedi</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {belgeler.map(b => {
                      const bt = BELGE_TURLERI.find(t => t.v === b.belge_turu)
                      return (
                        <div key={b.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3 py-2.5 group hover:border-emerald-300 transition-colors">
                          <span className="text-lg flex-shrink-0">{bt?.emoji || '📎'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">{b.dosya_adi}</p>
                            <p className="text-xs text-gray-400">{bt?.l} · {fmtDate(b.belge_tarihi)}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={() => belgeOnizle(b)} className="p-1 text-gray-400 hover:text-blue-600" title="Görüntüle">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => belgeIndir(b)} className="p-1 text-gray-400 hover:text-green-600" title="İndir">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => belgeSil(b)} className="p-1 text-gray-400 hover:text-red-500" title="Sil">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Belge Yükleme Modal */}
      {belgeModal && (
        <Modal title="Belge Yükle" onClose={() => setBelgeModal(false)} size="sm"
          footer={<Btn variant="secondary" onClick={() => setBelgeModal(false)}>Kapat</Btn>}>
          <div className="space-y-4">
            <Field label="Belge Türü">
              <select value={belgeForm.belge_turu}
                onChange={e => setBelgeForm(p => ({ ...p, belge_turu: e.target.value }))}
                className={inputCls}>
                {BELGE_TURLERI.map(t => <option key={t.v} value={t.v}>{t.emoji} {t.l}</option>)}
              </select>
            </Field>
            <Field label="Açıklama">
              <input type="text" value={belgeForm.aciklama}
                onChange={e => setBelgeForm(p => ({ ...p, aciklama: e.target.value }))}
                className={inputCls} placeholder="İsteğe bağlı..." />
            </Field>
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleUpload} className="hidden" id={`police-up-${p.id}`} />
            <label htmlFor={`police-up-${p.id}`}
              className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploading ? 'border-gray-300 text-gray-400' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>
              {uploading
                ? <><div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />Yükleniyor...</>
                : <><Upload className="w-5 h-5" />PDF / Resim Seç ve Yükle</>}
            </label>
          </div>
        </Modal>
      )}

      {/* Önizleme */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm truncate">{preview.adi}</span>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {preview.adi.toLowerCase().endsWith('.pdf')
                ? <iframe src={preview.url} className="w-full h-[70vh] rounded border" title={preview.adi} />
                : <img src={preview.url} alt={preview.adi} className="max-w-full mx-auto rounded" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hızlı PDF Yükleme (Yeni Kayıt Sonrası) ─────────────────
function PoliceHizliYukle({ policeId, firmaId }: { policeId: string; firmaId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [yuklenenler, setYuklenenler] = useState<string[]>([])
  const [belge_turu, setBelgeTuru] = useState('police')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const safeName = file.name
      .replace(/[ğ]/g,'g').replace(/[Ğ]/g,'G').replace(/[ü]/g,'u').replace(/[Ü]/g,'U')
      .replace(/[ş]/g,'s').replace(/[Ş]/g,'S').replace(/[ı]/g,'i').replace(/[İ]/g,'I')
      .replace(/[ö]/g,'o').replace(/[Ö]/g,'O').replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
      .replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const path = `${firmaId}/${policeId}/${belge_turu}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('police-belgeler').upload(path, file)
    if (error) { alert('Yükleme hatası: ' + error.message); setUploading(false); return }
    await supabase.from('police_belgeler').insert({
      police_id: policeId, firma_id: firmaId,
      belge_turu, belge_tarihi: new Date().toISOString().split('T')[0],
      dosya_adi: file.name, storage_path: path,
    })
    setYuklenenler(p => [...p, file.name])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Belge türü seçimi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Belge Türü</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {BELGE_TURLERI.map(t => (
            <button key={t.v} type="button"
              onClick={() => setBelgeTuru(t.v)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${belge_turu === t.v ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              <span>{t.emoji}</span>{t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Yükleme Alanı */}
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={handleFile} className="hidden" id={`police-hizli-${policeId}`} />
      <label htmlFor={`police-hizli-${policeId}`}
        className={`flex flex-col items-center justify-center gap-3 w-full py-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploading ? 'border-gray-300 bg-gray-50' : 'border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400'}`}>
        {uploading ? (
          <>
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Yükleniyor...</span>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <Upload className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-emerald-700">PDF veya Resim Yükle</p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC desteklenir</p>
            </div>
          </>
        )}
      </label>

      {/* Yüklenenler */}
      {yuklenenler.length > 0 && (
        <div className="space-y-2">
          {yuklenenler.map((ad, i) => (
            <div key={i} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm text-green-700 truncate">{ad}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
