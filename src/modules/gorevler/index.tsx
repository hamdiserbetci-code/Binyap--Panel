'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  CheckSquare, Plus, Edit, Trash2, Search, Bell, Clock,
  AlertTriangle, CheckCircle, Upload, Download, Eye, X,
  ChevronDown, Filter, Calendar, Paperclip, RotateCcw, Flag
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ─── Sabitler ────────────────────────────────────────────────
const ONCELIK = {
  dusuk:   { l: 'Düşük',   v: 'gray'   as const, renk: 'text-gray-500',   bg: 'bg-gray-100',   icon: '○' },
  normal:  { l: 'Normal',  v: 'blue'   as const, renk: 'text-blue-600',   bg: 'bg-blue-50',    icon: '◎' },
  yuksek:  { l: 'Yüksek',  v: 'orange' as const, renk: 'text-orange-600', bg: 'bg-orange-50',  icon: '●' },
  kritik:  { l: 'Kritik',  v: 'red'    as const, renk: 'text-red-600',    bg: 'bg-red-50',     icon: '⬤' },
}

const KATEGORI = {
  genel:   { l: 'Genel',   emoji: '📋' },
  finans:  { l: 'Finans',  emoji: '💰' },
  ik:      { l: 'İK',      emoji: '👥' },
  hukuk:   { l: 'Hukuk',   emoji: '⚖️'  },
  vergi:   { l: 'Vergi',   emoji: '🧾' },
  proje:   { l: 'Proje',   emoji: '🏗️'  },
  diger:   { l: 'Diğer',   emoji: '📌' },
}

const DURUM = {
  bekliyor:    { l: 'Bekliyor',     v: 'gray'   as const, icon: Clock         },
  devam:       { l: 'Devam Ediyor', v: 'yellow' as const, icon: AlertTriangle },
  tamamlandi:  { l: 'Tamamlandı',   v: 'green'  as const, icon: CheckCircle   },
  ertelendi:   { l: 'Ertelendi',    v: 'blue'   as const, icon: RotateCcw     },
  iptal:       { l: 'İptal',        v: 'red'    as const, icon: X             },
}

const emptyForm = {
  baslik: '', aciklama: '', oncelik: 'normal', kategori: 'genel',
  durum: 'bekliyor', atanan_kisi: '', son_tarih: '', hatirlatma_tarihi: '',
}

const emptyErteleme = { erteleme_tarihi: '', erteleme_notu: '' }

// ─── Ana Modül ────────────────────────────────────────────────
export default function GorevlerModule({ firma }: AppCtx) {
  const [gorevler, setGorevler]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [durumF, setDurumF]       = useState('hepsi')
  const [oncelikF, setOncelikF]   = useState('hepsi')
  const [kategoriF, setKategoriF] = useState('hepsi')
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState<any | null>(null)
  const [delId, setDelId]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(emptyForm)
  const [ertelemeModal, setErtelemeModal] = useState<any | null>(null)
  const [ertelemeForm, setErtelemeForm]   = useState(emptyErteleme)
  const [detayId, setDetayId]     = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('gorevler')
      .select('*')
      .eq('firma_id', firma.id)
      .order('created_at', { ascending: false })
    setGorevler(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  // Hatırlatma kontrolü
  const hatirlatmalar = useMemo(() => {
    const bugun = new Date(); bugun.setHours(0,0,0,0)
    return gorevler.filter(g => {
      if (g.durum === 'tamamlandi' || g.durum === 'iptal') return false
      if (g.hatirlatma_tarihi && new Date(g.hatirlatma_tarihi) <= new Date()) return true
      if (g.son_tarih) {
        const st = new Date(g.son_tarih); st.setHours(0,0,0,0)
        const fark = Math.floor((st.getTime() - bugun.getTime()) / 86400000)
        return fark <= 1
      }
      return false
    })
  }, [gorevler])

  const filtered = useMemo(() => gorevler.filter(g => {
    if (durumF !== 'hepsi' && g.durum !== durumF) return false
    if (oncelikF !== 'hepsi' && g.oncelik !== oncelikF) return false
    if (kategoriF !== 'hepsi' && g.kategori !== kategoriF) return false
    if (search) {
      const q = search.toLowerCase()
      return g.baslik?.toLowerCase().includes(q) || g.aciklama?.toLowerCase().includes(q) || g.atanan_kisi?.toLowerCase().includes(q)
    }
    return true
  }), [gorevler, durumF, oncelikF, kategoriF, search])

  const summary = useMemo(() => ({
    toplam:     gorevler.length,
    bekliyor:   gorevler.filter(g => g.durum === 'bekliyor').length,
    devam:      gorevler.filter(g => g.durum === 'devam').length,
    tamamlandi: gorevler.filter(g => g.durum === 'tamamlandi').length,
    gecikti:    gorevler.filter(g => g.durum !== 'tamamlandi' && g.durum !== 'iptal' && g.son_tarih && new Date(g.son_tarih) < new Date()).length,
  }), [gorevler])

  function openNew() { setForm(emptyForm); setEditing(null); setModal(true) }
  function openEdit(g: any) {
    setForm({
      baslik: g.baslik || '', aciklama: g.aciklama || '',
      oncelik: g.oncelik || 'normal', kategori: g.kategori || 'genel',
      durum: g.durum || 'bekliyor', atanan_kisi: g.atanan_kisi || '',
      son_tarih: g.son_tarih || '',
      hatirlatma_tarihi: g.hatirlatma_tarihi ? g.hatirlatma_tarihi.split('T')[0] : '',
    })
    setEditing(g); setModal(true)
  }

  async function save() {
    if (!form.baslik) return alert('Başlık zorunludur')
    setSaving(true)
    const payload = {
      baslik: form.baslik, aciklama: form.aciklama || null,
      oncelik: form.oncelik, kategori: form.kategori,
      durum: form.durum, atanan_kisi: form.atanan_kisi || null,
      son_tarih: form.son_tarih || null,
      hatirlatma_tarihi: form.hatirlatma_tarihi ? new Date(form.hatirlatma_tarihi).toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await supabase.from('gorevler').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('gorevler').insert({ ...payload, firma_id: firma.id })
    }
    setSaving(false); setModal(false); load()
  }

  async function durumGuncelle(id: string, durum: string) {
    await supabase.from('gorevler').update({
      durum,
      tamamlanma_tarihi: durum === 'tamamlandi' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    load()
  }

  async function ertele() {
    if (!ertelemeForm.erteleme_tarihi) return alert('Erteleme tarihi zorunludur')
    await supabase.from('gorevler').update({
      durum: 'ertelendi',
      erteleme_tarihi: ertelemeForm.erteleme_tarihi,
      erteleme_notu: ertelemeForm.erteleme_notu || null,
      son_tarih: ertelemeForm.erteleme_tarihi,
      updated_at: new Date().toISOString(),
    }).eq('id', ertelemeModal.id)
    setErtelemeModal(null); setErtelemeForm(emptyErteleme); load()
  }

  const sf = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  // Bugün gecikmiş mi?
  function isGecikti(g: any) {
    return g.durum !== 'tamamlandi' && g.durum !== 'iptal' && g.son_tarih && new Date(g.son_tarih) < new Date()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CheckSquare className="w-5 h-5 text-violet-600" />}
        title="Görev Takibi"
        subtitle="Günlük iş listesi, hatırlatmalar ve evrak yönetimi"
        iconBg="bg-violet-50"
        action={
          <div className="flex items-center gap-2">
            {hatirlatmalar.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <Bell className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700">{hatirlatmalar.length} hatırlatma</span>
              </div>
            )}
            <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Görev</Btn>
          </div>
        }
      />

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: 'Toplam',      v: summary.toplam,     c: 'text-gray-700',   bg: 'bg-white'       },
          { l: 'Bekliyor',    v: summary.bekliyor,   c: 'text-gray-600',   bg: 'bg-white'       },
          { l: 'Devam',       v: summary.devam,      c: 'text-yellow-600', bg: 'bg-yellow-50'   },
          { l: 'Tamamlandı',  v: summary.tamamlandi, c: 'text-green-600',  bg: 'bg-green-50'    },
          { l: 'Gecikmiş',    v: summary.gecikti,    c: 'text-red-600',    bg: summary.gecikti > 0 ? 'bg-red-50' : 'bg-white' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl border border-gray-200 p-4`}>
            <p className="text-xs text-gray-500 mb-1">{s.l}</p>
            <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Hatırlatma Bandı */}
      {hatirlatmalar.length > 0 && (
        <div className="space-y-2">
          {hatirlatmalar.map(g => {
            const onc = ONCELIK[g.oncelik as keyof typeof ONCELIK]
            return (
              <div key={g.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Bell className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-amber-900">{g.baslik}</span>
                  {g.son_tarih && <span className="text-xs text-amber-700 ml-2">Son: {fmtDate(g.son_tarih)}</span>}
                </div>
                <button onClick={() => setDetayId(g.id)} className="text-xs text-amber-700 hover:underline">Görüntüle</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Filtreler */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Görev ara..." value={search}
              onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`} />
          </div>
          <select value={durumF} onChange={e => setDurumF(e.target.value)} className={inputCls + ' w-auto'}>
            <option value="hepsi">Tüm Durumlar</option>
            {Object.entries(DURUM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <select value={oncelikF} onChange={e => setOncelikF(e.target.value)} className={inputCls + ' w-auto'}>
            <option value="hepsi">Tüm Öncelikler</option>
            {Object.entries(ONCELIK).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <select value={kategoriF} onChange={e => setKategoriF(e.target.value)} className={inputCls + ' w-auto'}>
            <option value="hepsi">Tüm Kategoriler</option>
            {Object.entries(KATEGORI).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.l}</option>)}
          </select>
        </div>
      </Card>

      {/* Görev Listesi */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card><EmptyState icon={<CheckSquare className="w-10 h-10" />} message="Görev bulunamadı" /></Card>
        ) : (
          filtered.map(g => (
            <GorevKarti
              key={g.id}
              gorev={g}
              firma={firma}
              isDetay={detayId === g.id}
              onDetay={() => setDetayId(detayId === g.id ? null : g.id)}
              onEdit={() => openEdit(g)}
              onDelete={() => setDelId(g.id)}
              onDurumGuncelle={durumGuncelle}
              onErtele={() => { setErtelemeModal(g); setErtelemeForm(emptyErteleme) }}
              gecikti={isGecikti(g)}
            />
          ))
        )}
      </div>

      {/* Yeni/Düzenle Modal */}
      {modal && (
        <Modal
          title={editing ? 'Görevi Düzenle' : 'Yeni Görev'}
          onClose={() => setModal(false)}
          size="lg"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}
        >
          <div className="space-y-4">
            <Field label="Başlık" required>
              <input type="text" value={form.baslik} onChange={sf('baslik')} className={inputCls} placeholder="Görev başlığı..." />
            </Field>
            <Field label="Açıklama">
              <textarea rows={3} value={form.aciklama} onChange={sf('aciklama')} className={inputCls} placeholder="Detaylı açıklama..." />
            </Field>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Öncelik">
                <select value={form.oncelik} onChange={sf('oncelik')} className={inputCls}>
                  {Object.entries(ONCELIK).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.l}</option>)}
                </select>
              </Field>
              <Field label="Kategori">
                <select value={form.kategori} onChange={sf('kategori')} className={inputCls}>
                  {Object.entries(KATEGORI).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.l}</option>)}
                </select>
              </Field>
              <Field label="Durum">
                <select value={form.durum} onChange={sf('durum')} className={inputCls}>
                  {Object.entries(DURUM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Son Tarih">
                <input type="date" value={form.son_tarih} onChange={sf('son_tarih')} className={inputCls} />
              </Field>
              <Field label="Hatırlatma Tarihi">
                <input type="datetime-local" value={form.hatirlatma_tarihi} onChange={sf('hatirlatma_tarihi')} className={inputCls} />
              </Field>
            </div>
            <Field label="Atanan Kişi">
              <input type="text" value={form.atanan_kisi} onChange={sf('atanan_kisi')} className={inputCls} placeholder="Ad Soyad" />
            </Field>
          </div>
        </Modal>
      )}

      {/* Erteleme Modal */}
      {ertelemeModal && (
        <Modal
          title={`Görevi Ertele — ${ertelemeModal.baslik}`}
          onClose={() => setErtelemeModal(null)}
          size="sm"
          footer={<><Btn variant="secondary" onClick={() => setErtelemeModal(null)}>İptal</Btn><Btn onClick={ertele}>Ertele</Btn></>}
        >
          <div className="space-y-4">
            <Field label="Yeni Tarih" required>
              <input type="date" value={ertelemeForm.erteleme_tarihi}
                onChange={e => setErtelemeForm(p => ({ ...p, erteleme_tarihi: e.target.value }))}
                className={inputCls} min={new Date().toISOString().split('T')[0]} />
            </Field>
            <Field label="Erteleme Notu">
              <textarea rows={2} value={ertelemeForm.erteleme_notu}
                onChange={e => setErtelemeForm(p => ({ ...p, erteleme_notu: e.target.value }))}
                className={inputCls} placeholder="Neden erteleniyor?" />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog
          message="Bu görevi silmek istediğinize emin misiniz?"
          onConfirm={async () => { await supabase.from('gorevler').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)}
        />
      )}
    </div>
  )
}

// ─── Görev Kartı ─────────────────────────────────────────────
interface GorevKartiProps {
  gorev: any
  firma: { id: string }
  isDetay: boolean
  onDetay: () => void
  onEdit: () => void
  onDelete: () => void
  onDurumGuncelle: (id: string, durum: string) => void
  onErtele: () => void
  gecikti: boolean
}

function GorevKarti({ gorev: g, firma, isDetay, onDetay, onEdit, onDelete, onDurumGuncelle, onErtele, gecikti }: GorevKartiProps) {
  const [belgeler, setBelgeler] = useState<any[]>([])
  const [loadingB, setLoadingB] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const detayInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onc   = ONCELIK[g.oncelik as keyof typeof ONCELIK] || ONCELIK.normal
  const kat   = KATEGORI[g.kategori as keyof typeof KATEGORI] || KATEGORI.genel
  const dur   = DURUM[g.durum as keyof typeof DURUM] || DURUM.bekliyor
  const DurIcon = dur.icon

  useEffect(() => {
    if (isDetay && belgeler.length === 0) loadBelgeler()
  }, [isDetay])

  async function loadBelgeler() {
    setLoadingB(true)
    const { data } = await supabase.from('gorev_belgeler').select('*').eq('gorev_id', g.id).order('created_at')
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
    const path = `${firma.id}/${g.id}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('gorev-belgeler').upload(path, file)
    if (error) { alert('Yükleme hatası: ' + error.message); setUploading(false); return }
    await supabase.from('gorev_belgeler').insert({
      gorev_id: g.id, firma_id: firma.id,
      dosya_adi: file.name, storage_path: path, belge_tipi: ext,
    })
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (detayInputRef.current) detayInputRef.current.value = ''
    loadBelgeler()
  }

  async function belgeIndir(belge: any) {
    const { data } = await supabase.storage.from('gorev-belgeler').createSignedUrl(belge.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = belge.dosya_adi; a.click() }
  }

  async function belgeSil(belge: any) {
    if (!confirm(`"${belge.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('gorev-belgeler').remove([belge.storage_path])
    await supabase.from('gorev_belgeler').delete().eq('id', belge.id)
    loadBelgeler()
  }

  const tamamlandi = g.durum === 'tamamlandi'
  const iptal      = g.durum === 'iptal'

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${
      gecikti && !tamamlandi ? 'border-red-200 bg-red-50/30' :
      tamamlandi ? 'border-green-200 bg-green-50/20 opacity-75' :
      g.durum === 'ertelendi' ? 'border-blue-200' :
      g.oncelik === 'kritik' ? 'border-orange-200' : 'border-gray-200'
    }`}>
      {/* Ana Satır */}
      <div className="flex items-start gap-3 p-4">
        {/* Tamamla Checkbox */}
        <button
          onClick={() => onDurumGuncelle(g.id, tamamlandi ? 'bekliyor' : 'tamamlandi')}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            tamamlandi ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {tamamlandi && <CheckCircle className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* İçerik */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onDetay}>
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${tamamlandi ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {g.baslik}
            </span>
            {/* Öncelik */}
            <span className={`text-xs font-bold ${onc.renk}`}>{onc.icon} {onc.l}</span>
            {/* Kategori */}
            <span className="text-xs text-gray-500">{kat.emoji} {kat.l}</span>
            {/* Durum */}
            <Badge label={dur.l} variant={dur.v} />
            {/* Gecikmiş */}
            {gecikti && !tamamlandi && (
              <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />Gecikmiş
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {g.son_tarih && (
              <span className={`text-xs flex items-center gap-1 ${gecikti && !tamamlandi ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                <Calendar className="w-3 h-3" />{fmtDate(g.son_tarih)}
              </span>
            )}
            {g.atanan_kisi && <span className="text-xs text-gray-400">👤 {g.atanan_kisi}</span>}
            {g.erteleme_tarihi && <span className="text-xs text-blue-500">↷ {fmtDate(g.erteleme_tarihi)}'e ertelendi</span>}
            {g.tamamlanma_tarihi && <span className="text-xs text-green-500">✓ {fmtDate(g.tamamlanma_tarihi)}</span>}
          </div>

          {g.aciklama && !isDetay && (
            <p className="text-xs text-gray-500 mt-1 truncate">{g.aciklama}</p>
          )}
        </div>

        {/* Aksiyonlar */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!tamamlandi && !iptal && (
            <>
              {g.durum !== 'devam' && (
                <button onClick={() => onDurumGuncelle(g.id, 'devam')}
                  className="text-xs px-2 py-1 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium border border-yellow-200 transition-colors">
                  Başla
                </button>
              )}
              <button onClick={onErtele}
                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="Ertele">
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
          {/* Evrak Yükle — her zaman görünür */}
          <div>
            <input ref={inputRef} type="file" onChange={handleUpload} className="hidden"
              id={`gorev-up-${g.id}`} accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png" />
            <label htmlFor={`gorev-up-${g.id}`}
              title="Evrak Yükle"
              className={`p-1.5 rounded-lg cursor-pointer flex items-center transition-colors ${uploading ? 'text-gray-300' : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'}`}>
              {uploading
                ? <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                : <Upload className="w-4 h-4" />}
            </label>
          </div>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onDetay} className={`p-1.5 rounded-lg transition-colors ${isDetay ? 'text-violet-600 bg-violet-50' : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'}`}
            title={isDetay ? 'Kapat' : 'Detay & Ekler'}>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDetay ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Detay Panel */}
      {isDetay && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50 space-y-4">
          {/* Açıklama */}
          {g.aciklama && (
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">AÇIKLAMA</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{g.aciklama}</p>
            </div>
          )}

          {/* Erteleme Notu */}
          {g.erteleme_notu && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
              <p className="text-xs font-semibold text-blue-600 mb-1">ERTELEME NOTU</p>
              <p className="text-sm text-blue-800">{g.erteleme_notu}</p>
            </div>
          )}

          {/* Belgeler */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <Paperclip className="w-3 h-3" />EKLER ({belgeler.length})
              </p>
              <div>
                <input ref={detayInputRef} type="file" onChange={handleUpload} className="hidden"
                  id={`gorev-up-detay-${g.id}`} accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png" />
                <label htmlFor={`gorev-up-detay-${g.id}`}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer border transition-colors ${uploading ? 'border-gray-300 text-gray-400' : 'border-violet-300 text-violet-600 hover:bg-violet-50'}`}>
                  {uploading ? <><div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />Yükleniyor</> : <><Upload className="w-3 h-3" />Evrak Yükle</>}
                </label>
              </div>
            </div>

            {loadingB ? (
              <div className="flex justify-center py-3"><div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : belgeler.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Henüz evrak eklenmedi</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {belgeler.map(b => {
                  const ICONS: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', xlsx: '📊', xls: '📊', jpg: '🖼', jpeg: '🖼', png: '🖼' }
                  const icon = ICONS[b.belge_tipi] || '📎'
                  return (
                    <div key={b.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 group">
                      <span className="text-sm flex-shrink-0">{icon}</span>
                      <span className="text-xs text-gray-700 truncate flex-1 min-w-0" title={b.dosya_adi}>{b.dosya_adi}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => belgeIndir(b)} className="p-0.5 text-gray-400 hover:text-green-600"><Download className="w-3 h-3" /></button>
                        <button onClick={() => belgeSil(b)} className="p-0.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Hızlı Durum Değiştir */}
          {!tamamlandi && !iptal && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => onDurumGuncelle(g.id, 'tamamlandi')}
                className="flex-1 text-xs py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-semibold border border-green-200 transition-colors flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />Tamamlandı
              </button>
              <button onClick={() => onDurumGuncelle(g.id, 'iptal')}
                className="text-xs px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition-colors">
                İptal
              </button>
            </div>
          )}
          {tamamlandi && (
            <button onClick={() => onDurumGuncelle(g.id, 'bekliyor')}
              className="w-full text-xs py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition-colors">
              Tamamlandıyı Geri Al
            </button>
          )}
        </div>
      )}
    </div>
  )
}
