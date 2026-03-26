'use client'

import { useEffect, useState, useRef } from 'react'
import { Folder, File, Upload, Search, X, Download, Trash2, FolderOpen, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg, ConfirmModal, cls } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { ArsivDosya } from '@/types'

function buildTree(dosyalar: ArsivDosya[]) {
  const tree: Record<string, ArsivDosya[]> = {}
  dosyalar.forEach(d => {
    if (!tree[d.klasor_yolu]) tree[d.klasor_yolu] = []
    tree[d.klasor_yolu].push(d)
  })
  return tree
}

function formatBytes(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export default function Arsiv({ firma }: AppCtx) {
  const [dosyalar, setDosyalar]   = useState<ArsivDosya[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [folder, setFolder]       = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<ArsivDosya | null>(null)
  const [uploading, setUploading] = useState(false)
  const [customPath, setCustomPath] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [firma.id])

  async function load() {
    try {
      setLoading(true)
      const { data, error: e } = await supabase.from('arsiv_dosyalar').select('*')
        .eq('firma_id', firma.id).order('created_at', { ascending: false })
      if (e) throw e
      setDosyalar((data || []) as ArsivDosya[])
    } catch (e: any) {
      setError(e?.message || 'Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  async function upload(files: FileList) {
    if (!files.length) return
    setUploading(true)
    const bugun = new Date()
    const yil = bugun.getFullYear().toString()
    const ay = String(bugun.getMonth() + 1).padStart(2, '0')
    const klasor = customPath || `/${yil}/${ay}/genel`

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() || ''
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `${firma.id}${klasor}/${safeName}`
      const { data: upData, error: upErr } = await supabase.storage
        .from('arsiv').upload(path, file, { upsert: false })
      if (upErr) { alert(upErr.message); continue }
      const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
      await supabase.from('arsiv_dosyalar').insert({
        firma_id: firma.id,
        klasor_yolu: klasor,
        dosya_adi: file.name,
        dosya_url: urlData.publicUrl,
        mime_type: file.type || null,
        boyut_byte: file.size ?? null,
      })
    }
    setUploading(false)
    await load()
  }

  async function deleteDosya(d: ArsivDosya) {
    const url = new URL(d.dosya_url)
    const storagePath = url.pathname.split('/object/public/arsiv/')[1]
    if (storagePath) {
      await supabase.storage.from('arsiv').remove([storagePath])
    }
    await supabase.from('arsiv_dosyalar').delete().eq('id', d.id)
    setDosyalar(prev => prev.filter(x => x.id !== d.id))
    setDeleting(null)
  }

  const filtered = dosyalar.filter(d => {
    const matchSearch = !search || d.dosya_adi.toLowerCase().includes(search.toLowerCase()) || d.klasor_yolu.toLowerCase().includes(search.toLowerCase())
    const matchFolder = !folder || d.klasor_yolu === folder
    return matchSearch && matchFolder
  })

  const tree = buildTree(dosyalar)
  const folders = Object.keys(tree).sort()

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="flex gap-5 min-h-0">
      {/* Klasör ağacı */}
      <div className="w-52 shrink-0">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Klasörler</h2>
        <button onClick={() => setFolder(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all mb-1 ${!folder ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          <FolderOpen size={15} />
          <span className="font-medium">Tümü</span>
          <span className={`ml-auto text-[10px] font-bold ${!folder ? 'text-blue-200' : 'text-slate-400'}`}>{dosyalar.length}</span>
        </button>
        {folders.map(f => (
          <button key={f} onClick={() => setFolder(f)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${folder === f ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Folder size={14} className="shrink-0" />
            <span className="truncate text-xs">{f}</span>
            <span className={`ml-auto text-[10px] font-bold shrink-0 ${folder === f ? 'text-blue-200' : 'text-slate-400'}`}>{tree[f].length}</span>
          </button>
        ))}
        {folders.length === 0 && (
          <p className="text-xs text-slate-400 px-3">Henüz klasör yok</p>
        )}
      </div>

      {/* Ana alan */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Araç çubuğu */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${cls.input} pl-9`} placeholder="Dosya veya klasör ara..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <input className={`${cls.input} w-44 text-xs`} placeholder="Klasör yolu (örn: /2025/03/kbs)" value={customPath} onChange={e => setCustomPath(e.target.value)} />
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e => e.target.files && upload(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className={`${cls.btnPrimary} shrink-0`}>
              <Upload size={14} />
              {uploading ? 'Yükleniyor...' : 'Yükle'}
            </button>
          </div>
        </div>

        {/* Dosya listesi */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <File size={32} className="mb-3 opacity-40" />
              <p className="text-sm">{search ? 'Aramanızla eşleşen dosya bulunamadı' : 'Henüz dosya yok'}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={cls.th}>Dosya Adı</th>
                  <th className={`${cls.th} hidden md:table-cell`}>Klasör</th>
                  <th className={`${cls.th} hidden sm:table-cell`}>Boyut</th>
                  <th className={`${cls.th} hidden lg:table-cell`}>Tarih</th>
                  <th className={cls.th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className={cls.td}>
                      <div className="flex items-center gap-2">
                        <FileIcon mime={d.mime_type ?? null} />
                        <span className="font-medium text-slate-800 truncate max-w-[200px]">{d.dosya_adi}</span>
                      </div>
                    </td>
                    <td className={`${cls.td} hidden md:table-cell text-slate-400 text-xs`}>{d.klasor_yolu}</td>
                    <td className={`${cls.td} hidden sm:table-cell text-slate-400 text-xs`}>{formatBytes(d.boyut_byte ?? null)}</td>
                    <td className={`${cls.td} hidden lg:table-cell text-slate-400 text-xs`}>{new Date(d.created_at).toLocaleDateString('tr-TR')}</td>
                    <td className={cls.td}>
                      <div className="flex items-center gap-1 justify-end">
                        <a href={d.dosya_url} target="_blank" rel="noreferrer"
                          className="w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors">
                          <Download size={13} />
                        </a>
                        <button onClick={() => setDeleting(d)}
                          className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors">
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

      {deleting && (
        <ConfirmModal
          title="Dosyayı Sil"
          message={`"${deleting.dosya_adi}" silinecek. Bu işlem geri alınamaz.`}
          danger
          onConfirm={() => deleteDosya(deleting)}
          onCancel={() => setDeleting(null)}
        />
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
