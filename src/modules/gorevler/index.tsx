'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  CheckSquare, Plus, Edit, Trash2, Search, Bell,
  Clock, AlertTriangle, CheckCircle, Upload, Download,
  X, RotateCcw, Flag, Calendar, Paperclip, GripVertical, Filter
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal, Btn, Field, inputCls, ConfirmDialog, Badge, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ─── Sabitler ─────────────────────────────────────────────────
const ONCELIK = {
  dusuk:  { l: 'Dusuk',  v: 'gray'   as const, renk: 'text-gray-500',   bg: 'bg-gray-100',  dot: 'bg-gray-400'   },
  normal: { l: 'Normal', v: 'blue'   as const, renk: 'text-blue-600',   bg: 'bg-blue-50',   dot: 'bg-blue-500'   },
  yuksek: { l: 'Yuksek', v: 'orange' as const, renk: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  kritik: { l: 'Kritik', v: 'red'    as const, renk: 'text-red-600',    bg: 'bg-red-50',    dot: 'bg-red-500'    },
}

const KATEGORI = {
  genel:  { l: 'Genel',  emoji: '📋' },
  finans: { l: 'Finans', emoji: '💰' },
  ik:     { l: 'IK',     emoji: '👥' },
  hukuk:  { l: 'Hukuk',  emoji: '⚖️'  },
  vergi:  { l: 'Vergi',  emoji: '🧾' },
  proje:  { l: 'Proje',  emoji: '🏗️'  },
  diger:  { l: 'Diger',  emoji: '📌' },
}

// Kanban kolonlari
const KOLONLAR = [
  { id: 'bekliyor',   l: 'Bekliyor',     renk: 'border-gray-300',   bg: 'bg-gray-50',    baslik: 'bg-gray-100 text-gray-700',   sayi: 'bg-gray-200 text-gray-700'   },
  { id: 'devam',      l: 'Devam Ediyor', renk: 'border-blue-300',   bg: 'bg-blue-50/40', baslik: 'bg-blue-100 text-blue-700',   sayi: 'bg-blue-200 text-blue-700'   },
  { id: 'ertelendi',  l: 'Ertelendi',    renk: 'border-amber-300',  bg: 'bg-amber-50/40',baslik: 'bg-amber-100 text-amber-700', sayi: 'bg-amber-200 text-amber-700' },
  { id: 'tamamlandi', l: 'Tamamlandi',   renk: 'border-green-300',  bg: 'bg-green-50/40',baslik: 'bg-green-100 text-green-700', sayi: 'bg-green-200 text-green-700' },
  { id: 'iptal',      l: 'Iptal',        renk: 'border-red-200',    bg: 'bg-red-50/30',  baslik: 'bg-red-100 text-red-600',     sayi: 'bg-red-200 text-red-600'     },
]

const emptyForm = {
  baslik: '', aciklama: '', oncelik: 'normal', kategori: 'genel',
  durum: 'bekliyor', atanan_kisi: '', son_tarih: '', hatirlatma_tarihi: '',
}

// ─── Ana Modul ─────────────────────────────────────────────────
export default function GorevlerModule({ firma }: AppCtx) {
  const [gorevler, setGorevler] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [oncelikF, setOncelikF] = useState('hepsi')
  const [kategoriF, setKategoriF] = useState('hepsi')
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<any | null>(null)
  const [delId, setDelId]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState(emptyForm)
  const [detayGorev, setDetayGorev] = useState<any | null>(null)
  const [dragId, setDragId]     = useState<string | null>(null)
  const [filtrePaneli, setFiltrePaneli] = useState(false)
  // Yeni kart inline ekleme
  const [inlineKolon, setInlineKolon] = useState<string | null>(null)
  const [inlineBaslik, setInlineBaslik] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('gorevler').select('*')
      .eq('firma_id', firma.id).order('created_at', { ascending: false })
    setGorevler(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const hatirlatmalar = useMemo(() => {
    return gorevler.filter(g => {
      if (['tamamlandi','iptal'].includes(g.durum)) return false
      if (g.hatirlatma_tarihi && new Date(g.hatirlatma_tarihi) <= new Date()) return true
      if (g.son_tarih) {
        const fark = Math.floor((new Date(g.son_tarih).getTime() - Date.now()) / 86400000)
        return fark <= 1
      }
      return false
    })
  }, [gorevler])

  const filtered = useMemo(() => gorevler.filter(g => {
    if (oncelikF !== 'hepsi' && g.oncelik !== oncelikF) return false
    if (kategoriF !== 'hepsi' && g.kategori !== kategoriF) return false
    if (search) {
      const q = search.toLowerCase()
      return g.baslik?.toLowerCase().includes(q) || g.atanan_kisi?.toLowerCase().includes(q)
    }
    return true
  }), [gorevler, oncelikF, kategoriF, search])

  const kolonGorevler = useMemo(() => {
    const map: Record<string, any[]> = {}
    KOLONLAR.forEach(k => { map[k.id] = [] })
    filtered.forEach(g => { if (map[g.durum]) map[g.durum].push(g) })
    return map
  }, [filtered])

  const summary = useMemo(() => ({
    toplam:     gorevler.length,
    bekliyor:   gorevler.filter(g => g.durum === 'bekliyor').length,
    devam:      gorevler.filter(g => g.durum === 'devam').length,
    tamamlandi: gorevler.filter(g => g.durum === 'tamamlandi').length,
    gecikti:    gorevler.filter(g => !['tamamlandi','iptal'].includes(g.durum) && g.son_tarih && new Date(g.son_tarih) < new Date()).length,
  }), [gorevler])

  function openNew(durum = 'bekliyor') {
    setForm({ ...emptyForm, durum })
    setEditing(null); setModal(true)
  }
  function openEdit(g: any) {
    setForm({ baslik: g.baslik||'', aciklama: g.aciklama||'', oncelik: g.oncelik||'normal', kategori: g.kategori||'genel', durum: g.durum||'bekliyor', atanan_kisi: g.atanan_kisi||'', son_tarih: g.son_tarih||'', hatirlatma_tarihi: g.hatirlatma_tarihi ? g.hatirlatma_tarihi.split('T')[0] : '' })
    setEditing(g); setModal(true)
  }

  async function save() {
    if (!form.baslik) return alert('Baslik zorunludur')
    setSaving(true)
    const payload = { baslik: form.baslik, aciklama: form.aciklama||null, oncelik: form.oncelik, kategori: form.kategori, durum: form.durum, atanan_kisi: form.atanan_kisi||null, son_tarih: form.son_tarih||null, hatirlatma_tarihi: form.hatirlatma_tarihi ? new Date(form.hatirlatma_tarihi).toISOString() : null, updated_at: new Date().toISOString() }
    if (editing) { await supabase.from('gorevler').update(payload).eq('id', editing.id) }
    else { await supabase.from('gorevler').insert({ ...payload, firma_id: firma.id }) }
    setSaving(false); setModal(false); load()
  }

  async function inlineEkle(durum: string) {
    if (!inlineBaslik.trim()) { setInlineKolon(null); return }
    await supabase.from('gorevler').insert({ firma_id: firma.id, baslik: inlineBaslik.trim(), durum, oncelik: 'normal', kategori: 'genel' })
    setInlineBaslik(''); setInlineKolon(null); load()
  }

  async function durumGuncelle(id: string, durum: string) {
    await supabase.from('gorevler').update({ durum, tamamlanma_tarihi: durum === 'tamamlandi' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  // Drag & Drop
  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  async function onDrop(e: React.DragEvent, kolonId: string) {
    e.preventDefault()
    if (!dragId || dragId === kolonId) return
    await durumGuncelle(dragId, kolonId)
    setDragId(null)
  }

  const sf = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      {/* Baslik */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center"><CheckSquare className="w-4 h-4 text-violet-600" /></span>
            Gorev Takibi
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 ml-10">
            {summary.toplam} gorev &middot; {summary.devam} devam &middot; {summary.tamamlandi} tamamlandi
            {summary.gecikti > 0 && <span className="text-red-500 ml-2">· {summary.gecikti} gecikti</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hatirlatmalar.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-700">{hatirlatmalar.length} hatirlatma</span>
            </div>
          )}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 w-36" />
          </div>
          <button onClick={() => setFiltrePaneli(p => !p)} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${filtrePaneli || oncelikF !== 'hepsi' || kategoriF !== 'hepsi' ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            <Filter className="w-3.5 h-3.5" />Filtre
          </button>
          <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => openNew()}>Yeni Gorev</Btn>
        </div>
      </div>

      {/* Filtre Paneli */}
      {filtrePaneli && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-3">
          <select value={oncelikF} onChange={e => setOncelikF(e.target.value)} className={inputCls + ' w-auto text-sm'}>
            <option value="hepsi">Tum Oncelikler</option>
            {Object.entries(ONCELIK).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <select value={kategoriF} onChange={e => setKategoriF(e.target.value)} className={inputCls + ' w-auto text-sm'}>
            <option value="hepsi">Tum Kategoriler</option>
            {Object.entries(KATEGORI).map(([k,v]) => <option key={k} value={k}>{v.emoji} {v.l}</option>)}
          </select>
          {(oncelikF !== 'hepsi' || kategoriF !== 'hepsi') && (
            <button onClick={() => { setOncelikF('hepsi'); setKategoriF('hepsi') }} className="text-xs text-red-500 hover:underline flex items-center gap-1"><X className="w-3 h-3" />Temizle</button>
          )}
        </div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
          {KOLONLAR.map(kolon => {
            const gorevListesi = kolonGorevler[kolon.id] || []
            return (
              <div key={kolon.id}
                className={`flex-shrink-0 w-72 rounded-xl border-2 ${kolon.renk} ${kolon.bg} flex flex-col`}
                onDragOver={onDragOver}
                onDrop={e => onDrop(e, kolon.id)}
              >
                {/* Kolon Baslik */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${kolon.baslik}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{kolon.l}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${kolon.sayi}`}>{gorevListesi.length}</span>
                  </div>
                  <button onClick={() => { setInlineKolon(kolon.id); setInlineBaslik('') }} className="p-0.5 rounded hover:bg-black/10 transition-colors" title="Hizli Ekle">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Kartlar */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {gorevListesi.map(g => (
                    <KanbanKart
                      key={g.id}
                      gorev={g}
                      firmaId={firma.id}
                      onEdit={() => openEdit(g)}
                      onDelete={() => setDelId(g.id)}
                      onDetay={() => setDetayGorev(g)}
                      onDurumGuncelle={durumGuncelle}
                      onDragStart={e => onDragStart(e, g.id)}
                      isDragging={dragId === g.id}
                    />
                  ))}

                  {/* Inline Ekle */}
                  {inlineKolon === kolon.id ? (
                    <div className="bg-white rounded-lg border-2 border-violet-300 p-2 space-y-2">
                      <textarea
                        autoFocus
                        rows={2}
                        value={inlineBaslik}
                        onChange={e => setInlineBaslik(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); inlineEkle(kolon.id) } if (e.key === 'Escape') setInlineKolon(null) }}
                        placeholder="Gorev basligini yaz..."
                        className="w-full text-sm border-0 outline-none resize-none text-gray-800 placeholder-gray-400"
                      />
                      <div className="flex gap-2">
                        <Btn size="sm" onClick={() => inlineEkle(kolon.id)}>Ekle</Btn>
                        <button onClick={() => setInlineKolon(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setInlineKolon(kolon.id); setInlineBaslik('') }}
                      className="w-full text-left text-xs text-gray-400 hover:text-gray-600 hover:bg-white/60 px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Kart ekle
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Gorev Detay Modal */}
      {detayGorev && (
        <GorevDetayModal
          gorev={detayGorev}
          firmaId={firma.id}
          onClose={() => setDetayGorev(null)}
          onEdit={() => { openEdit(detayGorev); setDetayGorev(null) }}
          onDurumGuncelle={async (id, durum) => { await durumGuncelle(id, durum); setDetayGorev(null) }}
        />
      )}

      {/* Yeni/Duzenle Modal */}
      {modal && (
        <Modal title={editing ? 'Gorevi Duzenle' : 'Yeni Gorev'} onClose={() => setModal(false)} size="lg"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>Iptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <Field label="Baslik" required>
              <input type="text" value={form.baslik} onChange={sf('baslik')} className={inputCls} placeholder="Gorev basligi..." />
            </Field>
            <Field label="Aciklama">
              <textarea rows={3} value={form.aciklama} onChange={sf('aciklama')} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Oncelik">
                <select value={form.oncelik} onChange={sf('oncelik')} className={inputCls}>
                  {Object.entries(ONCELIK).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
                </select>
              </Field>
              <Field label="Kategori">
                <select value={form.kategori} onChange={sf('kategori')} className={inputCls}>
                  {Object.entries(KATEGORI).map(([k,v]) => <option key={k} value={k}>{v.emoji} {v.l}</option>)}
                </select>
              </Field>
              <Field label="Durum">
                <select value={form.durum} onChange={sf('durum')} className={inputCls}>
                  {KOLONLAR.map(k => <option key={k.id} value={k.id}>{k.l}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Son Tarih">
                <input type="date" value={form.son_tarih} onChange={sf('son_tarih')} className={inputCls} />
              </Field>
              <Field label="Hatirlatma">
                <input type="datetime-local" value={form.hatirlatma_tarihi} onChange={sf('hatirlatma_tarihi')} className={inputCls} />
              </Field>
            </div>
            <Field label="Atanan Kisi">
              <input type="text" value={form.atanan_kisi} onChange={sf('atanan_kisi')} className={inputCls} placeholder="Ad Soyad" />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu gorevi silmek istediginize emin misiniz?"
          onConfirm={async () => { await supabase.from('gorevler').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}

// ─── Kanban Kart ──────────────────────────────────────────────
function KanbanKart({ gorev: g, firmaId, onEdit, onDelete, onDetay, onDurumGuncelle, onDragStart, isDragging }: {
  gorev: any; firmaId: string
  onEdit: () => void; onDelete: () => void; onDetay: () => void
  onDurumGuncelle: (id: string, durum: string) => void
  onDragStart: (e: React.DragEvent) => void; isDragging: boolean
}) {
  const onc = ONCELIK[g.oncelik as keyof typeof ONCELIK] || ONCELIK.normal
  const kat = KATEGORI[g.kategori as keyof typeof KATEGORI] || KATEGORI.genel
  const gecikti = !['tamamlandi','iptal'].includes(g.durum) && g.son_tarih && new Date(g.son_tarih) < new Date()
  const tamamlandi = g.durum === 'tamamlandi'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all group ${isDragging ? 'opacity-40 scale-95' : ''} ${gecikti ? 'border-l-4 border-l-red-400' : g.oncelik === 'kritik' ? 'border-l-4 border-l-red-500' : g.oncelik === 'yuksek' ? 'border-l-4 border-l-orange-400' : ''}`}
    >
      {/* Ust kisim */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${onc.dot}`} />
          <span className="text-xs text-gray-500">{kat.emoji} {kat.l}</span>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Edit className="w-3 h-3" /></button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Baslik */}
      <p onClick={onDetay} className={`text-sm font-medium leading-snug mb-2 cursor-pointer hover:text-violet-700 ${tamamlandi ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {g.baslik}
      </p>

      {/* Aciklama ozeti */}
      {g.aciklama && (
        <p className="text-xs text-gray-400 truncate mb-2">{g.aciklama}</p>
      )}

      {/* Alt bilgiler */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {g.son_tarih && (
            <span className={`text-xs flex items-center gap-0.5 ${gecikti ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
              <Calendar className="w-3 h-3" />{fmtDate(g.son_tarih)}
            </span>
          )}
          {g.atanan_kisi && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {g.atanan_kisi.split(' ')[0]}
            </span>
          )}
        </div>
        {/* Hizli tamamla */}
        {!tamamlandi && (
          <button onClick={() => onDurumGuncelle(g.id, 'tamamlandi')}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-green-500 rounded" title="Tamamla">
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Gorev Detay Modal ────────────────────────────────────────
function GorevDetayModal({ gorev: g, firmaId, onClose, onEdit, onDurumGuncelle }: {
  gorev: any; firmaId: string
  onClose: () => void; onEdit: () => void
  onDurumGuncelle: (id: string, durum: string) => void
}) {
  const [belgeler, setBelgeler] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const onc = ONCELIK[g.oncelik as keyof typeof ONCELIK] || ONCELIK.normal
  const kat = KATEGORI[g.kategori as keyof typeof KATEGORI] || KATEGORI.genel
  const gecikti = !['tamamlandi','iptal'].includes(g.durum) && g.son_tarih && new Date(g.son_tarih) < new Date()

  useEffect(() => { loadBelgeler() }, [])

  async function loadBelgeler() {
    const { data } = await supabase.from('gorev_belgeler').select('*').eq('gorev_id', g.id).order('created_at')
    setBelgeler(data || [])
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const path = `${firmaId}/${g.id}/${Date.now()}_${safeName}`
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const { error } = await supabase.storage.from('gorev-belgeler').upload(path, file)
    if (error) { alert('Yukleme hatasi: ' + error.message); setUploading(false); return }
    await supabase.from('gorev_belgeler').insert({ gorev_id: g.id, firma_id: firmaId, dosya_adi: file.name, storage_path: path, belge_tipi: ext })
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    loadBelgeler()
  }

  async function belgeIndir(b: any) {
    const { data } = await supabase.storage.from('gorev-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = b.dosya_adi; a.click() }
  }

  async function belgeSil(b: any) {
    if (!confirm(`"${b.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('gorev-belgeler').remove([b.storage_path])
    await supabase.from('gorev_belgeler').delete().eq('id', b.id)
    loadBelgeler()
  }

  const kolon = KOLONLAR.find(k => k.id === g.durum)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className={`px-5 py-4 rounded-t-2xl ${kolon?.baslik || 'bg-gray-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`w-2.5 h-2.5 rounded-full ${onc.dot}`} />
                <span className="text-xs font-semibold">{onc.l}</span>
                <span className="text-xs">{kat.emoji} {kat.l}</span>
                {gecikti && <span className="text-xs text-red-600 font-semibold flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />Gecikti</span>}
              </div>
              <h2 className="font-bold text-gray-900 text-base leading-snug">{g.baslik}</h2>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-white/50"><Edit className="w-4 h-4" /></button>
              <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-white/50"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Icerik */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Meta bilgiler */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {g.atanan_kisi && <div><p className="text-xs text-gray-400 mb-0.5">Atanan</p><p className="font-medium text-gray-700">👤 {g.atanan_kisi}</p></div>}
            {g.son_tarih && <div><p className="text-xs text-gray-400 mb-0.5">Son Tarih</p><p className={`font-medium ${gecikti ? 'text-red-600' : 'text-gray-700'}`}>📅 {fmtDate(g.son_tarih)}</p></div>}
            {g.hatirlatma_tarihi && <div><p className="text-xs text-gray-400 mb-0.5">Hatirlatma</p><p className="font-medium text-gray-700">🔔 {new Date(g.hatirlatma_tarihi).toLocaleString('tr-TR')}</p></div>}
            {g.tamamlanma_tarihi && <div><p className="text-xs text-gray-400 mb-0.5">Tamamlandi</p><p className="font-medium text-green-600">✓ {fmtDate(g.tamamlanma_tarihi)}</p></div>}
          </div>

          {/* Aciklama */}
          {g.aciklama && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">ACIKLAMA</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{g.aciklama}</p>
            </div>
          )}

          {/* Durum Degistir */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">DURUMU DEGISTIR</p>
            <div className="flex flex-wrap gap-2">
              {KOLONLAR.map(k => (
                <button key={k.id} onClick={() => onDurumGuncelle(g.id, k.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${g.durum === k.id ? `${k.baslik} border-current` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {k.l}
                </button>
              ))}
            </div>
          </div>

          {/* Belgeler */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><Paperclip className="w-3 h-3" />EKLER ({belgeler.length})</p>
              <div>
                <input ref={inputRef} type="file" onChange={handleUpload} className="hidden" id={`detay-up-${g.id}`} accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png" />
                <label htmlFor={`detay-up-${g.id}`} className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer border transition-colors ${uploading ? 'border-gray-300 text-gray-400' : 'border-violet-300 text-violet-600 hover:bg-violet-50'}`}>
                  {uploading ? <><div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />Yukleniyor</> : <><Upload className="w-3 h-3" />Evrak Yukle</>}
                </label>
              </div>
            </div>
            {belgeler.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-lg">Henuz evrak eklenmedi</p>
            ) : (
              <div className="space-y-1.5">
                {belgeler.map(b => {
                  const ICONS: Record<string,string> = { pdf:'📄', doc:'📝', docx:'📝', xlsx:'📊', xls:'📊', jpg:'🖼', jpeg:'🖼', png:'🖼' }
                  return (
                    <div key={b.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group">
                      <span className="text-sm">{ICONS[b.belge_tipi]||'📎'}</span>
                      <span className="text-xs text-gray-700 truncate flex-1">{b.dosya_adi}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => belgeIndir(b)} className="p-0.5 text-gray-400 hover:text-green-600"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => belgeSil(b)} className="p-0.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
