'use client'

import { useEffect, useState, useRef } from 'react'
import { Folder, File, Upload, Search, Download, Trash2, FolderOpen, Tag, X, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg, ConfirmModal, cls, Modal, Field } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Dokuman, Musteri, Proje, DokumanTipi } from '@/types'
import { DOKUMAN_TIP_LABEL } from '@/lib/utils'

const DOKUMAN_TIPLERI: DokumanTipi[] = ['fatura', 'sozlesme', 'rapor', 'irsaliye', 'makbuz', 'genel_evrak', 'diger']

function buildTree(dokumanlar: Dokuman[]) {
  const tree: Record<string, Dokuman[]> = {}
  dokumanlar.forEach(d => {
    if (!tree[d.kategori || 'Diğer']) tree[d.kategori || 'Diğer'] = [] // Use kategori for tree for now
    tree[d.kategori || 'Diğer'].push(d)
  })
  return tree
}

function formatBytes(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// Helper function for robust slugification (URL-friendly string)
function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD') // Decompose Unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (combining accents)
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c') // Turkish specific character replacements
    .replace(/[^a-z0-9 -]/g, '') // Remove all non-alphanumeric chars except space and hyphen
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-'); // Replace multiple - with single -
}

const TagBadge = ({ tag, active, onClick }: { tag: string; active?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all
      ${active
        ? 'bg-blue-600 text-white'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }
    `}
  >
    {tag}
  </button>
);

export default function DosyaYukleme({ firma, profil }: AppCtx) {
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [projeler, setProjeler]     = useState<Proje[]>([])
  const [filterMusteri, setFilterMusteri] = useState('all')
  const [filterProje, setFilterProje] = useState('all')
  const [filterModul, setFilterModul] = useState('all') // Using 'modul' for document type
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [dokumanlar, setDokumanlar]   = useState<Dokuman[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [folder, setFolder]       = useState<string | null>(null) // Using 'kategori' for folder
  const [deleting, setDeleting]   = useState<Dokuman | null>(null)
  const [uploading, setUploading] = useState(false)
  const [allTags, setAllTags] = useState<string[]>([])
  const [editingFile, setEditingFile] = useState<Dokuman | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [savingTags, setSavingTags] = useState(false)

  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadFileType, setUploadFileType] = useState<DokumanTipi>('diger')
  const [uploadToProject, setUploadToProject] = useState<string | null>(null) // proje_id
  const [uploadToMusteri, setUploadToMusteri] = useState<string | null>(null) // musteri_id (eğer proje yoksa)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadDependencies() {
      try {
        const { data: musteriData } = await supabase.from('cari_hesaplar').select('id, ad').eq('tip', 'musteri').eq('firma_id', firma.id).order('ad')
        setMusteriler((musteriData || []) as sbase.from('projeler').select('id, ad, musteri').eq('firma_id', firma.id).order('ad')
        setProjeler((projeData || []) as any[] as Proje[])
        setError('Müşteri ve proje listesi yüklenemedi: ' + e.message)
      }
    }
    loadDependencies()
    load()
  }, [firma.id])

  async function load() {
    try {
      setLoading(true)
      const { data, error: e } = await supabase.from('dokumanlar').select('*')
        .eq('firma_id', firma.id).order('created_at', { ascending: false })
      if (e) throw e
      const files = (data || []) as Dokuman[]
      setDokumanlar(files)

      const uniqueTags = new Set<string>()
      files.forEach(d => {
        d.etiketler?.forEach(t => uniqueTags.add(t))
      })
      setAllTags(Array.from(uniqueTags).sort())
    } catch (e: any) {
      setError(e?.message || 'Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function handleUploadFiles(files: FileList) {
    if (!files.length) return
    setUploading(true)
    setUploadModalOpen(false) // Modalı kapat

    let musteriIdToUse: string | null = uploadToMusteri;
    let projectIdToUse: string | null = uploadToProject;

    // Eğer proje seçildiyse, müşteri ID'sini projeden al
    if (projectIdToUse && projectIdToUse !== 'none') {
      const selectedProje = projeler.find(p => p.id === projectIdToUse);
      if (selectedProje) {
      }
    } else {
      projectIdToUse = null; // "Proje yok" seçildiyse null yap
    }

    // Eğer müşteri seçildiyse (ve proje yoksa), onu kullan
    if (musteriIdToUse === 'none') {
      musteriIdToUse = null; // "Müşteri yok" seçildiyse null yap
    }

    const bugun = new Date()
    const yil = bugun.getFullYear().toString()
    const ay = String(bugun.getMonth() + 1).padStart(2, '0')

    let baseKlasor = '';
    const modulSlug = slugify(DOKUMAN_TIP_LABEL[uploadFileType]);

    if (projectIdToUse) {
      const proje = projeler.find(p => p.id === projectIdToUse);
      const musteri = musteriIdToUse ? musteriler.find(m => m.id === musteriIdToUse) : null;
      const musteriSlug = musteri ? slugify(musteri.kisa_ad || musteri.ad) : 'genel-musteri';
      const projeSlug = proje ? slugify(proje.ad) : 'genel-proje';
      baseKlasor = `/${musteriSlug}/${projeSlug}/${modulSlug}/${yil}-${ay}`;
    } else if (musteriIdToUse) {
      const musteri = musteriler.find(m => m.id === musteriIdToUse);
      const musteriSlug = musteri ? slugify(musteri.kisa_ad || musteri.ad) : 'genel-musteri';
      baseKlasor = `/${musteriSlug}/genel-evraklar/${modulSlug}/${yil}-${ay}`;
    } else {
      baseKlasor = `/firma-genel/${modulSlug}/${yil}-${ay}`;
    }

    for (const file of Array.from(files)) {
      const MAX_FILE_SIZE_MB = 100; // 100 MB
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`${file.name} dosyası ${MAX_FILE_SIZE_MB} MB'tan büyük olduğu için yüklenemedi.`);
        continue;
      }

      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `${firma.id}${baseKlasor}/${safeName}`

      const { data: upData, error: upErr } = await supabase.storage
        .from('dokumanlar').upload(path, file, { upsert: false })
      if (upErr) { alert(upErr.message); continue }

      const { data: urlData } = supabase.storage.from('dokumanlar').getPublicUrl(path)

      const dbPayload: any = {
        firma_id: firma.id,
        proje_id: projectIdToUse === 'none' ? null : projectIdToUse,
        modul: uploadFileType,
        kategori: baseKlasor,
        dosya_adi: file.name,
        dosya_url: urlData.publicUrl,
        mime_type: file.type || null,
        dosya_boyutu: file.size ?? null,
        aciklama: '',
      };

      if (musteriIdToUse && musteriIdToUse !== 'none') {
        dbPayload.bagli_tablo = 'cari_hesaplar';
        dbPayload.bagli_kayit_id = musteriIdToUse;
      }

      const { error: dbErr } = await supabase.from('dokumanlar').insert(dbPayload)

      if (dbErr) {
        alert(`Veritabanı hatası: ${dbErr.message}`)
        await supabase.storage.from('dokumanlar').remove([path])
        continue
      }
    }
    setUploading(false)
    await load()
  }

  async function saveTags() {
    if (!editingFile) return
    setSavingTags(true)

    const currentTags = editingFile.etiketler || []
    const newTags = tagInput.split(',').map(t => t.trim().toLowerCase()).filter(t => t && !currentTags.includes(t))
    const finalTags = [...currentTags, ...newTags]

    const { data, error } = await supabase.from('dokumanlar')
      .update({ etiketler: finalTags }) // Assuming etiketler (TEXT[]) exists
      .eq('id', editingFile.id)
      .select().single()

    if (error) {
      alert('Etiketler kaydedilemedi: ' + error.message)
    } else {
      setDokumanlar(prev => prev.map(f => f.id === editingFile.id ? data as Dokuman : f))
      const updatedAllTags = new Set([...allTags, ...finalTags])
      setAllTags(Array.from(updatedAllTags).sort())
      setEditingFile(null)
      setTagInput('')
    }
    setSavingTags(false)
  }

  async function removeTag(file: Dokuman, tagToRemove: string) {
    const updatedTags = (file.etiketler || []).filter(t => t !== tagToRemove)
    const { data, error } = await supabase.from('dokumanlar')
      .update({ etiketler: updatedTags }) // Assuming etiketler (TEXT[]) exists
      .eq('id', file.id)
      .select().single()

    if (error) {
      alert('Etiket silinemedi: ' + error.message)
    } else {
      setDokumanlar(prev => prev.map(f => f.id === file.id ? data as Dokuman : f))
    }
  }

  async function deleteDokuman(d: Dokuman) {
    const url = new URL(d.dosya_url)
    const storagePath = url.pathname.split('/object/public/dokumanlar/')[1] // Bucket name 'dokumanlar'
    if (storagePath) {
      await supabase.storage.from('dokumanlar').remove([storagePath])
    }
    await supabase.from('dokumanlar').delete().eq('id', d.id)
    setDokumanlar(prev => prev.filter(x => x.id !== d.id))
    setDeleting(null)
  }

  const filteredDokumanlar = dokumanlar.filter(d => {
    const matchSearch = !search || d.dosya_adi.toLowerCase().includes(search.toLowerCase()) || d.aciklama?.toLowerCase().includes(search.toLowerCase())
    const matchFolder = !folder || d.kategori === folder // Using kategori for folder filtering
    const matchMusteri = filterMusteri === 'all' || (d as any).bagli_kayit_id === filterMusteri
    const matchProje = filterProje === 'all' || d.proje_id === filterProje
    const matchModul = filterModul === 'all' || d.modul === filterModul // Filtering by 'modul' (document type)
    const matchTags = filterTags.length === 0 || filterTags.every(ft => d.etiketler?.includes(ft)) // Assuming etiketler exists
    return matchSearch && matchFolder && matchMusteri && matchProje && matchModul && matchTags
  })

  function toggleFilterTag(tag: string) {
    setFilterTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const tree = buildTree(dokumanlar)
  const folders = Object.keys(tree).sort()

  const filteredProjeler = projeler; // Projeler tablosundan musteri_id kaldırıldığı için filtreleme basitleştirildi
  const filteredMusterilerForUpload = musteriler;

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-0 -mx-3 md:-mx-5 -mt-3 md:-mt-5">
      {/* Üst Bar */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-[rgba(60,60,67,0.36)] shrink-0 flex-wrap"
        style={{ background: '#52BDE0' }}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white flex-1 uppercase">
          Dosya Yükleme
        </h1>
        <button onClick={() => setUploadModalOpen(true)} className={cls.btnPrimary}>
          <Plus size={14} /> Dosya Yükle
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Klasör ağacı */}
        <div className="hidden md:flex flex-col w-52 shrink-0 overflow-y-auto py-3 px-3 border-r border-[rgba(60,60,67,0.36)]" style={{ background: '#52BDE0' }}>
          <p className="text-[10px] font-bold text-[rgba(235,235,245,0.3)] uppercase tracking-widest px-2 mb-2">
            Klasörler
          </p>
          <button onClick={() => setFolder(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm transition-all mb-1 ${!folder ? 'bg-[rgba(10,132,255,0.18)] text-[#0A84FF]' : 'text-[rgba(235,235,245,0.55)] hover:bg-[rgba(60,60,67,0.3)]'}`}>
            <FolderOpen size={15} />
            <span className="font-medium">Tümü</span>
            <span className={`ml-auto text-[10px] font-bold ${!folder ? 'text-[#0A84FF]' : 'text-[rgba(235,235,245,0.4)]'}`}>{dokumanlar.length}</span>
          </button>
          {folders.map(f => (
            <button key={f} onClick={() => setFolder(f)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm transition-all ${folder === f ? 'bg-[rgba(10,132,255,0.18)] text-[#0A84FF]' : 'text-[rgba(235,235,245,0.55)] hover:bg-[rgba(60,60,67,0.3)]'}`}>
              <Folder size={14} className="shrink-0" />
              <span className="truncate text-xs">{f}</span>
              <span className={`ml-auto text-[10px] font-bold shrink-0 ${folder === f ? 'text-[#0A84FF]' : 'text-[rgba(235,235,245,0.4)]'}`}>{tree[f].length}</span>
            </button>
          ))}
          {folders.length === 0 && (
            <p className="text-xs text-[rgba(235,235,245,0.4)] px-3">Henüz klasör yok</p>
          )}
        </div>

        {/* Ana alan */}
        <div className="flex-1 flex flex-col min-w-0 space-y-4 p-4 md:p-5" style={{ background: '#52BDE0' }}>
          {/* Araç çubuğu */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <select className={cls.input} value={filterMusteri} onChange={e => { setFilterMusteri(e.target.value); setFilterProje('all'); }}>
                <option value="all">Tüm Müşteriler</option>
                {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
              </select>
              <select className={cls.input} value={filterProje} onChange={e => setFilterProje(e.target.value)} disabled={!filteredProjeler.length}>
                <option value="all">Tüm Projeler</option>
                {filteredProjeler.map(p => (
                  <option key={p.id} value={p.id}>{p.ad}</option>
                ))}
              </select>
              <select className={cls.input} value={filterModul} onChange={e => setFilterModul(e.target.value)}>
                <option value="all">Tüm Tipler</option>
                {DOKUMAN_TIPLERI.map(tip => (
                  <option key={tip} value={tip}>{DOKUMAN_TIP_LABEL[tip]}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(235,235,245,0.4)]" />
              <input className={`${cls.input} pl-9`} placeholder="Dosya veya açıklama ara..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Etiket Filtreleri */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-[rgba(60,60,67,0.36)]">
              <p className="text-[10px] font-semibold text-[rgba(235,235,245,0.4)] uppercase tracking-wider mr-2">Etiketler:</p>
              {allTags.map(tag => (
                <TagBadge key={tag} tag={tag}
                  active={filterTags.includes(tag)}
                  onClick={() => toggleFilterTag(tag)} />
              ))}
            </div>
          )}

          {/* Doküman listesi */}
          <div className="bg-[#1C1C1E] border border-[rgba(60,60,67,0.36)] rounded-xl overflow-hidden">
            {filteredDokumanlar.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[rgba(235,235,245,0.4)]">
                <File size={32} className="mb-3 opacity-40" />
                <p className="text-sm">{search ? 'Aramanızla eşleşen doküman bulunamadı' : 'Henüz doküman yok'}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#2C2C2E] border-b border-[rgba(60,60,67,0.36)]">
                  <tr>
                    <th className={cls.th}>Dosya Adı</th>
                    <th className={`${cls.th} hidden sm:table-cell`}>Tip</th>
                    <th className={`${cls.th} hidden md:table-cell`}>Klasör</th>
                    <th className={`${cls.th} hidden lg:table-cell`}>Boyut</th>
                    <th className={`${cls.th} hidden lg:table-cell`}>Tarih</th>
                    <th className={cls.th}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(60,60,67,0.2)]">
                  {filteredDokumanlar.map(d => (
                    <tr key={d.id} className="hover:bg-[rgba(60,60,67,0.1)]">
                      <td className={cls.td}>
                        <div className="flex items-center gap-2">
                          <FileIcon mime={d.mime_type ?? null} />
                          <div>
                            <p className="font-medium text-white truncate max-w-[200px]">{d.dosya_adi}</p>
                            {(d.etiketler || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {d.etiketler?.map(t => (
                                  <span key={t} className="inline-flex bg-[rgba(60,60,67,0.3)] text-[rgba(235,235,245,0.7)] px-2 py-0.5 rounded-full text-[10px] font-semibold">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`${cls.td} hidden sm:table-cell text-[rgba(235,235,245,0.7)] text-xs`}>{d.modul ? DOKUMAN_TIP_LABEL[d.modul] : '—'}</td>
                      <td className={`${cls.td} hidden md:table-cell text-[rgba(235,235,245,0.4)] text-xs`}>{d.kategori || d.modul}</td>
                      <td className={`${cls.td} hidden lg:table-cell text-[rgba(235,235,245,0.4)] text-xs`}>{formatBytes(d.dosya_boyutu ?? null)}</td>
                      <td className={`${cls.td} hidden lg:table-cell text-[rgba(235,235,245,0.4)] text-xs`}>{new Date(d.created_at).toLocaleDateString('tr-TR')}</td>
                      <td className={cls.td}>
                        <div className="flex items-center gap-1 justify-end">
                          <a href={d.dosya_url} target="_blank" rel="noreferrer"
                            className="w-7 h-7 rounded-lg hover:bg-[rgba(10,132,255,0.1)] flex items-center justify-center text-[rgba(235,235,245,0.4)] hover:text-[#0A84FF] transition-colors">
                            <Download size={13} />
                          </a>
                          <button onClick={() => { setEditingFile(d); setTagInput(''); }}
                            className="w-7 h-7 rounded-lg hover:bg-[rgba(60,60,67,0.3)] flex items-center justify-center text-[rgba(235,235,245,0.4)] hover:text-white transition-colors">
                            <Tag size={13} />
                          </button>
                          <button onClick={() => setDeleting(d)}
                            className="w-7 h-7 rounded-lg hover:bg-[rgba(255,69,58,0.1)] flex items-center justify-center text-[rgba(235,235,245,0.4)] hover:text-[#FF453A] transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {deleting && (
        <ConfirmModal
          title="Dokümanı Sil"
          message={`"${deleting.dosya_adi}" silinecek. Bu işlem geri alınamaz.`}
          danger
          onConfirm={() => deleteDokuman(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {editingFile && (
        <Modal
          title="Etiketleri Düzenle"
          onClose={() => setEditingFile(null)}
          size="md"
          footer={<>
            <button onClick={() => setEditingFile(null)} className={cls.btnSecondary}>İptal</button>
            <button onClick={saveTags} disabled={savingTags} className={cls.btnPrimary}>
              {savingTags ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700 font-medium truncate">Dosya: <span className="text-slate-900 font-bold">{editingFile.dosya_adi}</span></p>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">Mevcut Etiketler</p>
              {(editingFile.etiketler || []).length > 0 ? (
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {(editingFile.etiketler || []).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1.5 bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{tag}<button onClick={() => removeTag(editingFile, tag)} className="hover:text-red-500"><X size={10} /></button></span>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">Henüz etiket yok.</p>}
            </div>
            <Field label="Yeni Etiket Ekle" hint="Birden fazla etiket için virgül (,) kullanın.">
              <input className={cls.input} value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="fatura, kdv, mart-2024" autoFocus />
            </Field>
          </div>
        </Modal>
      )}

      {/* Yükleme Modalı */}
      {uploadModalOpen && (
        <Modal
          title="Dosya Yükle"
          onClose={() => setUploadModalOpen(false)}
          size="md"
          footer={<>
            <button onClick={() => setUploadModalOpen(false)} className={cls.btnSecondary}>İptal</button>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className={cls.btnPrimary}>
              {uploading ? 'Yükleniyor...' : 'Dosya Seç ve Yükle'}
            </button>
          </>}>
          <div className="space-y-4">
            <Field label="Dosya Tipi" required>
              <select className={cls.input} value={uploadFileType} onChange={e => setUploadFileType(e.target.value as DokumanTipi)}>
                {DOKUMAN_TIPLERI.map(tip => (
                  <option key={tip} value={tip}>{DOKUMAN_TIP_LABEL[tip]}</option>
                ))}
              </select>
            </Field>
            <Field label="Projeye Ait Mi?">
              <select className={cls.input} value={uploadToProject || 'none'} onChange={e => setUploadToProject(e.target.value === 'none' ? null : e.target.value)}>
                <option value="none">Hayır, bir projeye ait değil</option>
                {projeler.map(p => (
                  <option key={p.id} value={p.id}>{p.ad}</option>
                ))}
              </select>
            </Field>
            {!uploadToProject || uploadToProject === 'none' ? (
              <Field label="Müşteri (Proje yoksa)">
                <select className={cls.input} value={uploadToMusteri || 'none'} onChange={e => setUploadToMusteri(e.target.value === 'none' ? null : e.target.value)}>
                  <option value="none">Genel Firma Dokümanı</option>
                  {musteriler.map(m => (
                    <option key={m.id} value={m.id}>{m.ad}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={e => {
                if (e.target.files) {
                  handleUploadFiles(e.target.files);
                  e.target.value = ''; // Aynı dosyayı tekrar seçebilmek için inputu temizle
                }
              }}
            />
            <p className="text-xs text-[rgba(235,235,245,0.4)]">Maksimum dosya boyutu 100 MB.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}

function FileIcon({ mime }: { mime: string | null }) {
  const color = mime?.startsWith('image/') ? 'text-purple-500'
    : mime === 'application/pdf' ? 'text-red-500'
    : mime?.includes('spreadsheet') || mime?.includes('excel') ? 'text-emerald-500'
    : mime?.includes('word') ? 'text-blue-500'
    : 'text-slate-400'
  return <File size={15} className={`shrink-0 ${color}`} />
}