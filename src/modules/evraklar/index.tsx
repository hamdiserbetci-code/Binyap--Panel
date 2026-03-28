'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Briefcase,
  Building2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal, Field, ConfirmModal, cls, Loading, ErrorMsg, Empty } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Musteri, Proje, Dokuman, DokumanTipi } from '@/types'
import { DOKUMAN_TIP_LABEL } from '@/lib/utils'

type ArsivAlani = 'firma_genel' | 'genel_yonetim' | 'projeler'

type UploadForm = {
  alan: ArsivAlani
  modul: DokumanTipi
  musteriId: string
  projeId: string
  dosyaAdi: string
  aciklama: string
  etiketler: string
}

const ARSIV_ALANLARI: Array<{
  id: ArsivAlani
  label: string
  title: string
  description: string
  icon: typeof Building2
  accent: string
}> = [
  {
    id: 'firma_genel',
    label: 'Firma Geneli',
    title: 'Firma Genel Arsivi',
    description: 'Resmi evraklar, sozlesmeler, genel klasorler ve kurum capinda ortak dosyalar.',
    icon: Building2,
    accent: 'from-slate-600/80 to-slate-500/50',
  },
  {
    id: 'genel_yonetim',
    label: 'Genel Yonetim',
    title: 'Yonetim ve Ic Evraklar',
    description: 'IK, yonetim kararleri, ic yazismalar, prosedurler ve operasyonel yonetim dosyalari.',
    icon: ShieldCheck,
    accent: 'from-blue-700/80 to-cyan-600/50',
  },
  {
    id: 'projeler',
    label: 'Projeler',
    title: 'Proje Bazli Evrak Takibi',
    description: 'Proje dosyalari, saha evraklari, teslim klasorleri ve musteriye bagli dokumanlar.',
    icon: FolderKanban,
    accent: 'from-emerald-700/80 to-teal-600/50',
  },
]

const EMPTY_UPLOAD_FORM: UploadForm = {
  alan: 'firma_genel',
  modul: 'genel_evrak',
  musteriId: 'all',
  projeId: 'all',
  dosyaAdi: '',
  aciklama: '',
  etiketler: '',
}

function getArsivAlani(doc: Dokuman): ArsivAlani {
  if (doc.kategori === 'firma_genel' || doc.kategori === 'genel_yonetim' || doc.kategori === 'projeler') {
    return doc.kategori
  }
  if (doc.proje_id) return 'projeler'
  return 'firma_genel'
}

function formatBytes(size?: number | null) {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function EvraklarModule({ firma, profil }: AppCtx) {
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [dokumanlar, setDokumanlar] = useState<Dokuman[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [aktifAlan, setAktifAlan] = useState<ArsivAlani>('firma_genel')
  const [selMusteri, setSelMusteri] = useState('all')
  const [selProje, setSelProje] = useState('all')
  const [selTip, setSelTip] = useState<'all' | DokumanTipi>('all')
  const [search, setSearch] = useState('')
  const [selTags, setSelTags] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)

  const [uploadForm, setUploadForm] = useState<UploadForm>(EMPTY_UPLOAD_FORM)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [formErr, setFormErr] = useState('')

  const [tagModal, setTagModal] = useState<Dokuman | null>(null)
  const [newTag, setNewTag] = useState('')
  const [deletingId, setDeletingId] = useState<Dokuman | null>(null)
  const [editModal, setEditModal] = useState<Dokuman | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
  }, [firma.id])

  useEffect(() => {
    setUploadForm(prev => ({
      ...prev,
      alan: aktifAlan,
      projeId: aktifAlan === 'projeler' ? prev.projeId : 'all',
      musteriId: aktifAlan === 'projeler' ? prev.musteriId : prev.musteriId,
    }))
  }, [aktifAlan])

  async function load() {
    setLoading(true)
    setError('')

    const [
      { data: m, error: me },
      { data: p, error: pe },
      { data: d, error: de },
    ] = await Promise.all([
      supabase.from('musteriler').select('id,ad,kisa_ad').eq('firma_id', firma.id).eq('aktif', true).order('ad'),
      supabase.from('projeler').select('id,ad,musteri_id').eq('firma_id', firma.id).neq('durum', 'iptal').order('ad'),
      supabase.from('dokumanlar').select('*').eq('firma_id', firma.id).order('created_at', { ascending: false }),
    ])

    if (me || pe || de) {
      setError(me?.message || pe?.message || de?.message || 'Bilinmeyen hata')
      setLoading(false)
      return
    }

    setMusteriler((m || []) as Musteri[])
    setProjeler((p || []) as Proje[])
    setDokumanlar((d || []) as Dokuman[])
    setLoading(false)
  }

  const musteriMap = useMemo(
    () => Object.fromEntries(musteriler.map(item => [item.id, item.kisa_ad || item.ad])),
    [musteriler]
  )

  const projeMap = useMemo(
    () => Object.fromEntries(projeler.map(item => [item.id, item.ad])),
    [projeler]
  )

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    dokumanlar.forEach(doc => doc.etiketler?.forEach(tag => tagSet.add(tag)))
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [dokumanlar])

  const alanSayilari = useMemo(() => {
    return ARSIV_ALANLARI.reduce(
      (acc, alan) => {
        acc[alan.id] = dokumanlar.filter(doc => getArsivAlani(doc) === alan.id).length
        return acc
      },
      {
        firma_genel: 0,
        genel_yonetim: 0,
        projeler: 0,
      } as Record<ArsivAlani, number>
    )
  }, [dokumanlar])

  const aktifAlanaAitProjeler = useMemo(() => {
    if (selMusteri === 'all') return projeler
    return projeler.filter(proje => proje.musteri_id === selMusteri)
  }, [projeler, selMusteri])

  const filteredDocs = useMemo(() => {
    return dokumanlar.filter(doc => {
      if (getArsivAlani(doc) !== aktifAlan) return false
      if (search && !doc.dosya_adi.toLowerCase().includes(search.toLowerCase())) return false
      if (selMusteri !== 'all' && doc.musteri_id !== selMusteri) return false
      if (selProje !== 'all' && doc.proje_id !== selProje) return false
      if (selTip !== 'all' && doc.modul !== selTip) return false
      if (selTags.length > 0) {
        if (!doc.etiketler?.length) return false
        if (!selTags.every(tag => doc.etiketler?.includes(tag))) return false
      }
      return true
    })
  }, [aktifAlan, dokumanlar, search, selMusteri, selProje, selTags, selTip])

  const groupedDocs = useMemo(() => {
    const groups = new Map<string, Dokuman[]>()

    filteredDocs.forEach(doc => {
      let key = 'Genel Klasor'
      if (aktifAlan === 'genel_yonetim') {
        key = doc.aciklama?.trim() ? 'Aciklamali Evraklar' : 'Yonetim Dosyalari'
      } else if (aktifAlan === 'projeler') {
        key = doc.proje_id ? projeMap[doc.proje_id] || 'Bagli Proje' : 'Projesiz Klasor'
      } else if (doc.musteri_id) {
        key = musteriMap[doc.musteri_id] || 'Firma Evraklari'
      }

      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(doc)
    })

    return Array.from(groups.entries())
  }, [aktifAlan, filteredDocs, musteriMap, projeMap])

  const toplamBoyut = useMemo(
    () => filteredDocs.reduce((sum, doc) => sum + (doc.dosya_boyutu || 0), 0),
    [filteredDocs]
  )

  function resetUploadForm() {
    setUploadForm({
      ...EMPTY_UPLOAD_FORM,
      alan: aktifAlan,
      musteriId: selMusteri,
      projeId: selProje,
    })
    setPendingFiles([])
    setFormErr('')
  }

  function handlePendingFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files)
    if (nextFiles.length === 0) return
    setPendingFiles(nextFiles)
    setFormErr('')
    if (!uploadForm.dosyaAdi && nextFiles.length === 1) {
      setUploadForm(prev => ({ ...prev, dosyaAdi: nextFiles[0].name.replace(/\.[^.]+$/, '') }))
    }
  }

  async function uploadDosyalar() {
    if (pendingFiles.length === 0) {
      setFormErr('En az bir dosya secmeniz gerekir.')
      return
    }
    if (uploadForm.alan === 'projeler' && uploadForm.projeId === 'all') {
      setFormErr('Proje arsivi icin bir proje secmelisiniz.')
      return
    }

    setUploading(true)
    setFormErr('')

    const tagList = uploadForm.etiketler
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean)

    for (let index = 0; index < pendingFiles.length; index += 1) {
      const file = pendingFiles[index]
      const safeName = `${Date.now()}_${index}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const musteriPath = uploadForm.musteriId !== 'all' ? uploadForm.musteriId : 'genel'
      const projePath = uploadForm.projeId !== 'all' ? uploadForm.projeId : 'genel'
      const path = `evraklar/${firma.id}/${uploadForm.alan}/${musteriPath}/${projePath}/${safeName}`

      const { error: upErr } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
      if (upErr) {
        setFormErr(`Depolama hatasi: ${upErr.message}`)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
      const finalName =
        pendingFiles.length === 1 && uploadForm.dosyaAdi.trim()
          ? `${uploadForm.dosyaAdi.trim()}${file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''}`
          : file.name

      const { error: insertErr } = await supabase.from('dokumanlar').insert({
        firma_id: firma.id,
        musteri_id: uploadForm.musteriId !== 'all' ? uploadForm.musteriId : null,
        proje_id: uploadForm.projeId !== 'all' ? uploadForm.projeId : null,
        yukleyen_id: profil.auth_user_id,
        modul: uploadForm.modul,
        kategori: uploadForm.alan,
        dosya_adi: finalName,
        dosya_url: urlData.publicUrl,
        mime_type: file.type || null,
        dosya_boyutu: file.size || null,
        aciklama: uploadForm.aciklama.trim() || null,
        etiketler: tagList.length > 0 ? tagList : null,
      })

      if (insertErr) {
        setFormErr(`Kayit hatasi: ${insertErr.message}`)
        setUploading(false)
        return
      }
    }

    setUploading(false)
    resetUploadForm()
    load()
  }

  async function deleteDokuman() {
    if (!deletingId) return
    try {
      const url = new URL(deletingId.dosya_url)
      const objectPath = url.pathname.split('/object/public/arsiv/')[1]
      if (objectPath) await supabase.storage.from('arsiv').remove([objectPath])
    } catch {}

    await supabase.from('dokumanlar').delete().eq('id', deletingId.id)
    setDeletingId(null)
    load()
  }

  async function updateTags(doc: Dokuman, tags: string[]) {
    await supabase.from('dokumanlar').update({ etiketler: tags.length > 0 ? tags : null }).eq('id', doc.id)
    setDokumanlar(prev => prev.map(item => (item.id === doc.id ? { ...item, etiketler: tags.length > 0 ? tags : null } : item)))
  }

  async function saveEdit() {
    if (!editModal?.dosya_adi?.trim()) {
      setFormErr('Dosya adi zorunludur.')
      return
    }

    setSaving(true)
    setFormErr('')

    const { error: updateErr } = await supabase
      .from('dokumanlar')
      .update({
        dosya_adi: editModal.dosya_adi.trim(),
        modul: editModal.modul,
        kategori: getArsivAlani(editModal),
        musteri_id: editModal.musteri_id || null,
        proje_id: editModal.proje_id || null,
        aciklama: editModal.aciklama?.trim() || null,
      })
      .eq('id', editModal.id)

    setSaving(false)
    if (updateErr) {
      setFormErr(updateErr.message)
      return
    }

    setEditModal(null)
    load()
  }

  const aktifAlanMeta = ARSIV_ALANLARI.find(item => item.id === aktifAlan) || ARSIV_ALANLARI[0]

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,41,59,0.78))] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-300 uppercase">
                <Archive size={14} />
                Evrak Yonetim Merkezi
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Firma, yonetim ve proje arsivlerini tek merkezden yonetin</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Evrak akislarini kurumsal klasor mantigiyla ayirin, dosyalari ilgili firma veya projeye baglayin, yonetsel arsivi duzenli tutun.
                </p>
              </div>
            </div>

            <div className="grid min-w-[250px] gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Toplam Evrak</div>
                <div className="mt-2 text-3xl font-semibold text-white">{dokumanlar.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Aktif Arsiv</div>
                <div className="mt-2 text-lg font-semibold text-white">{aktifAlanMeta.title}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Filtrelenen Boyut</div>
                <div className="mt-2 text-2xl font-semibold text-white">{formatBytes(toplamBoyut)}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {ARSIV_ALANLARI.map(alan => {
              const Icon = alan.icon
              const active = aktifAlan === alan.id
              return (
                <button
                  key={alan.id}
                  onClick={() => {
                    setAktifAlan(alan.id)
                    setSelProje('all')
                    setShowFilters(false)
                  }}
                  className={`rounded-[24px] border p-4 text-left transition-all ${
                    active
                      ? 'border-white/20 bg-white/12 shadow-[0_20px_45px_rgba(15,23,42,0.28)]'
                      : 'border-white/8 bg-white/5 hover:bg-white/8'
                  }`}
                >
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${alan.accent} text-white shadow-lg`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{alan.title}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">{alan.description}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm font-semibold text-slate-100">
                      {alanSayilari[alan.id]}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/8 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Yukleme Merkezi</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Profesyonel arsiv kaydi olustur</h3>
            </div>
            <button
              onClick={resetUploadForm}
              className="rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Formu Temizle
            </button>
          </div>

          <div
            className={`mt-5 rounded-[24px] border-2 border-dashed p-5 transition-all ${
              dragOver ? 'border-cyan-400/60 bg-cyan-500/8' : 'border-white/10 bg-black/15'
            }`}
            onDragEnter={e => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragOver={e => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
            }}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              handlePendingFiles(e.dataTransfer.files)
            }}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-cyan-300">
                <Upload size={22} />
              </div>
              <div className="text-base font-semibold text-white">Dosyalari surukleyin veya secin</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Evraklari aktif arsiv alanina uygun metaveri ile kaydedin. PDF, Excel, gorsel ve ofis dosyalari ayni akista izlenir.
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-4 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16"
              >
                Dosya Sec
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files) handlePendingFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Arsiv Alani">
              <select
                className={cls.input}
                value={uploadForm.alan}
                onChange={e => {
                  const next = e.target.value as ArsivAlani
                  setUploadForm(prev => ({
                    ...prev,
                    alan: next,
                    projeId: next === 'projeler' ? prev.projeId : 'all',
                  }))
                }}
              >
                {ARSIV_ALANLARI.map(alan => (
                  <option key={alan.id} value={alan.id}>
                    {alan.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Dokuman Tipi">
              <select
                className={cls.input}
                value={uploadForm.modul}
                onChange={e => setUploadForm(prev => ({ ...prev, modul: e.target.value as DokumanTipi }))}
              >
                {Object.entries(DOKUMAN_TIP_LABEL).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Firma / Musteri Baglantisi">
              <select
                className={cls.input}
                value={uploadForm.musteriId}
                onChange={e => {
                  const next = e.target.value
                  setUploadForm(prev => ({ ...prev, musteriId: next, projeId: 'all' }))
                }}
              >
                <option value="all">Genel Klasor</option>
                {musteriler.map(musteri => (
                  <option key={musteri.id} value={musteri.id}>
                    {musteri.kisa_ad || musteri.ad}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Proje Baglantisi">
              <select
                className={`${cls.input} ${uploadForm.alan !== 'projeler' ? 'opacity-60' : ''}`}
                value={uploadForm.projeId}
                onChange={e => setUploadForm(prev => ({ ...prev, projeId: e.target.value }))}
                disabled={uploadForm.alan !== 'projeler'}
              >
                <option value="all">Proje Secin</option>
                {aktifAlanaAitProjeler.map(proje => (
                  <option key={proje.id} value={proje.id}>
                    {proje.ad}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Dosya Basligi">
              <input
                className={cls.input}
                placeholder="Tek dosya yuklemelerinde gorunecek ad"
                value={uploadForm.dosyaAdi}
                onChange={e => setUploadForm(prev => ({ ...prev, dosyaAdi: e.target.value }))}
              />
            </Field>

            <Field label="Etiketler">
              <input
                className={cls.input}
                placeholder="ornek: sozlesme, 2026, yonetim"
                value={uploadForm.etiketler}
                onChange={e => setUploadForm(prev => ({ ...prev, etiketler: e.target.value }))}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Aciklama">
              <textarea
                className={`${cls.input} min-h-[92px] resize-none`}
                placeholder="Evragin icerigi, klasor amaci veya operasyon notu"
                value={uploadForm.aciklama}
                onChange={e => setUploadForm(prev => ({ ...prev, aciklama: e.target.value }))}
              />
            </Field>
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Secilen Dosyalar</div>
                <div className="mt-1 text-xs text-slate-400">{pendingFiles.length === 0 ? 'Henuz dosya secilmedi.' : `${pendingFiles.length} dosya hazir.`}</div>
              </div>
              <div className="text-xs font-medium text-slate-400">{pendingFiles.reduce((sum, file) => sum + file.size, 0) > 0 ? formatBytes(pendingFiles.reduce((sum, file) => sum + file.size, 0)) : '-'}</div>
            </div>

            {pendingFiles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingFiles.map(file => (
                  <span key={`${file.name}-${file.size}`} className="rounded-xl border border-white/10 bg-white/7 px-3 py-2 text-xs font-medium text-slate-200">
                    {file.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {formErr && <p className="mt-4 text-sm font-medium text-rose-300">{formErr}</p>}

          <button
            onClick={uploadDosyalar}
            disabled={uploading}
            className={cls.btnPrimary + ' mt-5 w-full justify-center'}
          >
            {uploading ? 'Dosyalar kaydediliyor...' : 'Evraklari Kurumsal Arsive Kaydet'}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/7 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Arsiv Filtreleri</div>
            <h3 className="mt-2 text-xl font-semibold text-white">{aktifAlanMeta.title}</h3>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(prev => !prev)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${showFilters ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200' : 'border-white/10 bg-white/6 text-slate-200'}`}
            >
              <span className="inline-flex items-center gap-2">
                <Filter size={16} />
                Filtreler
              </span>
            </button>

            <div className="flex rounded-xl border border-white/10 bg-black/15 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`rounded-lg p-2 transition ${viewMode === 'grid' ? 'bg-white/12 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-lg p-2 transition ${viewMode === 'list' ? 'bg-white/12 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className={`mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5 ${showFilters ? 'grid' : 'hidden lg:grid'}`}>
          <div className="relative xl:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${cls.input} pl-10`}
              placeholder="Dosya adi, anahtar kelime veya referans ara"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className={cls.input}
            value={selMusteri}
            onChange={e => {
              setSelMusteri(e.target.value)
              setSelProje('all')
            }}
          >
            <option value="all">Tum Firmalar / Musteriler</option>
            {musteriler.map(musteri => (
              <option key={musteri.id} value={musteri.id}>
                {musteri.kisa_ad || musteri.ad}
              </option>
            ))}
          </select>

          <select
            className={`${cls.input} ${aktifAlan !== 'projeler' ? 'opacity-60' : ''}`}
            value={selProje}
            onChange={e => setSelProje(e.target.value)}
            disabled={aktifAlan !== 'projeler'}
          >
            <option value="all">Tum Projeler</option>
            {aktifAlanaAitProjeler.map(proje => (
              <option key={proje.id} value={proje.id}>
                {proje.ad}
              </option>
            ))}
          </select>

          <select className={cls.input} value={selTip} onChange={e => setSelTip(e.target.value as 'all' | DokumanTipi)}>
            <option value="all">Tum Dokuman Tipleri</option>
            {Object.entries(DOKUMAN_TIP_LABEL).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className={`mt-3 flex flex-wrap items-center gap-2 ${showFilters ? 'flex' : 'hidden lg:flex'}`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/6 px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            <Tag size={12} />
            Etiketler
          </div>
          {allTags.length === 0 && <span className="text-sm text-slate-500">Kayitli etiket bulunmuyor.</span>}
          {allTags.map(tag => {
            const active = selTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => setSelTags(prev => (active ? prev.filter(item => item !== tag) : [...prev, tag]))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active ? 'border-cyan-400/40 bg-cyan-500/14 text-cyan-200' : 'border-white/10 bg-black/15 text-slate-300 hover:bg-white/8'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/7 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Arsiv Sonuclari</div>
            <h3 className="mt-2 text-xl font-semibold text-white">{filteredDocs.length} evrak listeleniyor</h3>
            <p className="mt-1 text-sm text-slate-400">Kurumsal arsiv klasorleri, secilen alan ve iliski bazinda gruplanir.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Bagli Firma</div>
              <div className="mt-2 text-sm font-semibold text-white">{selMusteri === 'all' ? 'Tum Kayitlar' : musteriMap[selMusteri] || 'Secili Musteri'}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Proje Odagi</div>
              <div className="mt-2 text-sm font-semibold text-white">{selProje === 'all' ? 'Tum Projeler' : projeMap[selProje] || 'Secili Proje'}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Dokuman Tipi</div>
              <div className="mt-2 text-sm font-semibold text-white">{selTip === 'all' ? 'Tum Tipler' : DOKUMAN_TIP_LABEL[selTip]}</div>
            </div>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <Empty
            icon={() => <FileText size={32} className="text-slate-500" />}
            title="Evrak bulunamadi"
            description="Secili arsiv alani ve filtrelere uygun dosya kaydi yok."
          />
        ) : (
          <div className="space-y-6">
            {groupedDocs.map(([groupName, docs]) => (
              <div key={groupName} className="rounded-[24px] border border-white/8 bg-black/12 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-slate-200">
                      {aktifAlan === 'projeler' ? <FolderKanban size={18} /> : aktifAlan === 'genel_yonetim' ? <Users size={18} /> : <Briefcase size={18} />}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">{groupName}</div>
                      <div className="text-xs text-slate-400">{docs.length} evrak</div>
                    </div>
                  </div>
                </div>

                {viewMode === 'grid' ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {docs.map(doc => (
                      <DocumentCard
                        key={doc.id}
                        doc={doc}
                        musteriMap={musteriMap}
                        projeMap={projeMap}
                        onEdit={setEditModal}
                        onDelete={setDeletingId}
                        onTag={setTagModal}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {docs.map(doc => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        musteriMap={musteriMap}
                        projeMap={projeMap}
                        onEdit={setEditModal}
                        onDelete={setDeletingId}
                        onTag={setTagModal}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      
      {tagModal && (
        <Modal
          title="Etiket Yonetimi"
          onClose={() => setTagModal(null)}
          size="sm"
          footer={<button onClick={() => setTagModal(null)} className={cls.btnPrimary}>Kapat</button>}
        >
          <div className="space-y-4">
            <p className="rounded-xl border border-white/8 bg-black/15 p-3 text-center text-xs font-semibold text-slate-300 break-all">{tagModal.dosya_adi}</p>
            <div className="flex min-h-[84px] flex-wrap gap-2 rounded-2xl border border-white/8 bg-black/15 p-4">
              {(tagModal.etiketler || []).map(tag => (
                <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
                  {tag}
                  <button
                    onClick={() => updateTags(tagModal, tagModal.etiketler!.filter(item => item !== tag))}
                    className="rounded-full p-0.5 text-cyan-100 transition hover:bg-white/10"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {(!tagModal.etiketler || tagModal.etiketler.length === 0) && <span className="flex w-full items-center justify-center text-sm text-slate-500">Bu dosya icin henuz etiket yok.</span>}
            </div>

            <div className="flex gap-2">
              <input
                className={`${cls.input} flex-1`}
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    const tag = newTag.trim().toLowerCase()
                    if (!tagModal.etiketler?.includes(tag)) updateTags(tagModal, [...(tagModal.etiketler || []), tag])
                    setNewTag('')
                  }
                }}
                placeholder="Yeni etiket"
              />
              <button
                className={cls.btnSecondary}
                disabled={!newTag.trim()}
                onClick={() => {
                  const tag = newTag.trim().toLowerCase()
                  if (!tagModal.etiketler?.includes(tag)) updateTags(tagModal, [...(tagModal.etiketler || []), tag])
                  setNewTag('')
                }}
              >
                Ekle
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editModal && (
        <Modal
          title="Evrak Duzenle"
          onClose={() => setEditModal(null)}
          size="sm"
          footer={
            <>
              <button onClick={() => setEditModal(null)} className={cls.btnSecondary}>Iptal</button>
              <button onClick={saveEdit} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </>
          }
        >
          <div className="space-y-5">
            <Field label="Dosya Adi" required error={formErr}>
              <input
                className={cls.input}
                value={editModal.dosya_adi}
                onChange={e => setEditModal(prev => (prev ? { ...prev, dosya_adi: e.target.value } : prev))}
                autoFocus
              />
            </Field>

            <Field label="Arsiv Alani">
              <select
                className={cls.input}
                value={getArsivAlani(editModal)}
                onChange={e =>
                  setEditModal(prev =>
                    prev
                      ? {
                          ...prev,
                          kategori: e.target.value,
                          proje_id: e.target.value === 'projeler' ? prev.proje_id : null,
                        }
                      : prev
                  )
                }
              >
                {ARSIV_ALANLARI.map(alan => (
                  <option key={alan.id} value={alan.id}>
                    {alan.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Dokuman Tipi">
              <select
                className={cls.input}
                value={editModal.modul}
                onChange={e => setEditModal(prev => (prev ? { ...prev, modul: e.target.value as DokumanTipi } : prev))}
              >
                {Object.entries(DOKUMAN_TIP_LABEL).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Musteri / Firma Baglantisi">
              <select
                className={cls.input}
                value={editModal.musteri_id || 'all'}
                onChange={e => setEditModal(prev => (prev ? { ...prev, musteri_id: e.target.value === 'all' ? null : e.target.value } : prev))}
              >
                <option value="all">Genel Klasor</option>
                {musteriler.map(musteri => (
                  <option key={musteri.id} value={musteri.id}>
                    {musteri.kisa_ad || musteri.ad}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Proje Baglantisi">
              <select
                className={`${cls.input} ${getArsivAlani(editModal) !== 'projeler' ? 'opacity-60' : ''}`}
                value={editModal.proje_id || 'all'}
                disabled={getArsivAlani(editModal) !== 'projeler'}
                onChange={e => setEditModal(prev => (prev ? { ...prev, proje_id: e.target.value === 'all' ? null : e.target.value } : prev))}
              >
                <option value="all">Proje Secin</option>
                {projeler
                  .filter(proje => !editModal.musteri_id || proje.musteri_id === editModal.musteri_id)
                  .map(proje => (
                    <option key={proje.id} value={proje.id}>
                      {proje.ad}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Aciklama">
              <textarea
                className={`${cls.input} min-h-[92px] resize-none`}
                value={editModal.aciklama || ''}
                onChange={e => setEditModal(prev => (prev ? { ...prev, aciklama: e.target.value } : prev))}
              />
            </Field>
          </div>
        </Modal>
      )}

      {deletingId && (
        <ConfirmModal
          title="Evrak Sil"
          message={`"${deletingId.dosya_adi}" dosyasi kalici olarak silinecek. Devam edilsin mi?`}
          danger
          onConfirm={deleteDokuman}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}

function getDocVisual(doc: Dokuman) {
  const isImage = doc.mime_type?.startsWith('image/')
  const isExcel = doc.mime_type?.includes('sheet') || /\.xlsx?$/i.test(doc.dosya_adi)
  const isPdf = doc.mime_type === 'application/pdf' || /\.pdf$/i.test(doc.dosya_adi)

  return {
    isImage,
    isPdf,
    Icon: isImage ? ImageIcon : isExcel ? FileSpreadsheet : FileText,
    color: isPdf ? '#ef4444' : isExcel ? '#10b981' : isImage ? '#38bdf8' : '#cbd5e1',
    bg: isPdf ? 'rgba(239,68,68,0.12)' : isExcel ? 'rgba(16,185,129,0.12)' : isImage ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.06)',
  }
}

function DocumentCard({
  doc,
  musteriMap,
  projeMap,
  onEdit,
  onDelete,
  onTag,
}: {
  doc: Dokuman
  musteriMap: Record<string, string>
  projeMap: Record<string, string>
  onEdit: (doc: Dokuman) => void
  onDelete: (doc: Dokuman) => void
  onTag: (doc: Dokuman) => void
}) {
  const visual = getDocVisual(doc)

  return (
    <div className="group overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.32),rgba(15,23,42,0.18))] transition hover:border-cyan-400/25 hover:shadow-[0_18px_45px_rgba(8,145,178,0.12)]">
      <div className="relative flex h-40 items-center justify-center border-b border-white/8 bg-black/18">
        {visual.isImage ? (
          <div className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${doc.dosya_url})` }} />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8" style={{ background: visual.bg }}>
            <visual.Icon size={30} style={{ color: visual.color }} />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/55 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          <button onClick={() => onTag(doc)} className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-white transition hover:bg-white/16">
            <Tag size={16} />
          </button>
          <a href={doc.dosya_url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-white transition hover:bg-emerald-500/20">
            <Download size={16} />
          </a>
          <button onClick={() => onDelete(doc)} className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-white transition hover:bg-rose-500/20">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <button className="line-clamp-2 text-left text-sm font-semibold text-white transition hover:text-cyan-200" onClick={() => onEdit(doc)}>
            {doc.dosya_adi}
          </button>
          <div className="mt-2 text-xs text-slate-400">
            {new Date(doc.created_at).toLocaleDateString('tr-TR')} · {formatBytes(doc.dosya_boyutu)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-300">
          <span className="rounded-full border border-white/8 bg-white/7 px-2.5 py-1">{DOKUMAN_TIP_LABEL[doc.modul]}</span>
          {doc.musteri_id && <span className="rounded-full border border-white/8 bg-white/7 px-2.5 py-1">{musteriMap[doc.musteri_id] || 'Firma'}</span>}
          {doc.proje_id && <span className="rounded-full border border-white/8 bg-white/7 px-2.5 py-1">{projeMap[doc.proje_id] || 'Proje'}</span>}
        </div>

        {doc.aciklama && <p className="line-clamp-2 text-xs leading-5 text-slate-400">{doc.aciklama}</p>}

        {doc.etiketler && doc.etiketler.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {doc.etiketler.slice(0, 4).map(tag => (
              <span key={tag} className="rounded-full border border-cyan-400/15 bg-cyan-500/8 px-2.5 py-1 text-[10px] font-semibold text-cyan-100">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DocumentRow({
  doc,
  musteriMap,
  projeMap,
  onEdit,
  onDelete,
  onTag,
}: {
  doc: Dokuman
  musteriMap: Record<string, string>
  projeMap: Record<string, string>
  onEdit: (doc: Dokuman) => void
  onDelete: (doc: Dokuman) => void
  onTag: (doc: Dokuman) => void
}) {
  const visual = getDocVisual(doc)

  return (
    <div className="group flex items-center gap-4 rounded-[22px] border border-white/8 bg-black/12 px-4 py-3 transition hover:border-white/12 hover:bg-white/6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8" style={{ background: visual.bg }}>
        <visual.Icon size={22} style={{ color: visual.color }} />
      </div>

      <div className="min-w-0 flex-1">
        <button className="truncate text-left text-sm font-semibold text-white transition hover:text-cyan-200" onClick={() => onEdit(doc)}>
          {doc.dosya_adi}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{new Date(doc.created_at).toLocaleDateString('tr-TR')}</span>
          <span>·</span>
          <span>{formatBytes(doc.dosya_boyutu)}</span>
          <span>·</span>
          <span>{DOKUMAN_TIP_LABEL[doc.modul]}</span>
          {doc.musteri_id && (
            <>
              <span>·</span>
              <span>{musteriMap[doc.musteri_id] || 'Firma'}</span>
            </>
          )}
          {doc.proje_id && (
            <>
              <span>·</span>
              <span>{projeMap[doc.proje_id] || 'Proje'}</span>
            </>
          )}
        </div>
        {doc.etiketler && doc.etiketler.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {doc.etiketler.slice(0, 5).map(tag => (
              <span key={tag} className="rounded-full border border-cyan-400/15 bg-cyan-500/8 px-2.5 py-1 text-[10px] font-semibold text-cyan-100">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
        <button onClick={() => onTag(doc)} className="rounded-xl border border-white/10 bg-white/8 p-2.5 text-slate-200 transition hover:bg-white/14">
          <Tag size={15} />
        </button>
        <a href={doc.dosya_url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/8 p-2.5 text-slate-200 transition hover:bg-emerald-500/20">
          <Download size={15} />
        </a>
        <button onClick={() => onDelete(doc)} className="rounded-xl border border-white/10 bg-white/8 p-2.5 text-slate-200 transition hover:bg-rose-500/20">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
