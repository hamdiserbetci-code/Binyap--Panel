'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Archive, Plus, Trash2, Search, Download, Eye, X, Upload, Star, StarOff, FolderPlus, Folder, FileText, Filter, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'

const DOSYA_RENK: Record<string, string> = {
  pdf: 'text-red-500', jpg: 'text-green-500', jpeg: 'text-green-500',
  png: 'text-blue-500', xlsx: 'text-emerald-600', xls: 'text-emerald-600',
  doc: 'text-blue-600', docx: 'text-blue-600', txt: 'text-gray-500',
}
const DOSYA_EMOJI: Record<string, string> = {
  pdf: '', jpg: '', jpeg: '', png: '',
  xlsx: '', xls: '', doc: '', docx: '', txt: '',
}

function dosyaEmoji(tip: string) { return DOSYA_EMOJI[tip.toLowerCase()] || '' }
function dosyaBoyut(b: number) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024*1024) return `${(b/1024).toFixed(1)} KB`
  return `${(b/1024/1024).toFixed(1)} MB`
}

const emptyKat = { ad: '', renk: '#6366f1' }

export default function ArsivModule({ firma }: AppCtx) {
  const [belgeler, setBelgeler]     = useState<any[]>([])
  const [kategoriler, setKategoriler] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [katF, setKatF]             = useState('')
  const [tipF, setTipF]             = useState('')
  const [onemliF, setOnemliF]       = useState(false)
  const [preview, setPreview]       = useState<{url:string;adi:string;tip:string}|null>(null)
  const [delId, setDelId]           = useState<string|null>(null)
  const [katModal, setKatModal]     = useState(false)
  const [katForm, setKatForm]       = useState(emptyKat)
  const [savingKat, setSavingKat]   = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({ baslik:'', aciklama:'', kategori_id:'', belge_tarihi:'', gonderen:'', alici:'', onemli: false })
  const [uploadFile, setUploadFile] = useState<File|null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  async function load() {
    setLoading(true)
    const [b, k] = await Promise.all([
      supabase.from('arsiv_belgeler').select('*').eq('firma_id', firma.id).order('created_at', { ascending: false }),
      supabase.from('arsiv_kategoriler').select('*').eq('firma_id', firma.id).order('ad'),
    ])
    setBelgeler(b.data || [])
    setKategoriler(k.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const filtered = useMemo(() => belgeler.filter(b => {
    if (katF && b.kategori_id !== katF) return false
    if (tipF && b.dosya_tipi !== tipF) return false
    if (onemliF && !b.onemli) return false
    if (search) {
      const q = search.toLowerCase()
      return b.baslik?.toLowerCase().includes(q) || b.aciklama?.toLowerCase().includes(q) ||
             b.gonderen?.toLowerCase().includes(q) || b.alici?.toLowerCase().includes(q) ||
             b.dosya_adi?.toLowerCase().includes(q)
    }
    return true
  }), [belgeler, katF, tipF, onemliF, search])

  const tipler = useMemo(() => [...new Set(belgeler.map(b => b.dosya_tipi).filter(Boolean))], [belgeler])

  async function saveKategori() {
    if (!katForm.ad) return alert('Kategori adi zorunludur')
    setSavingKat(true)
    await supabase.from('arsiv_kategoriler').insert({ firma_id: firma.id, ad: katForm.ad, renk: katForm.renk })
    setSavingKat(false); setKatModal(false); setKatForm(emptyKat); load()
  }

  async function katSil(id: string) {
    if (!confirm('Bu kategori silinsin mi?')) return
    await supabase.from('arsiv_kategoriler').delete().eq('id', id)
    load()
  }

  async function onemliToggle(b: any) {
    await supabase.from('arsiv_belgeler').update({ onemli: !b.onemli }).eq('id', b.id)
    setBelgeler(prev => prev.map(x => x.id === b.id ? { ...x, onemli: !x.onemli } : x))
  }

  async function belgeYukle() {
    if (!uploadFile || !uploadForm.baslik) return alert('Dosya ve baslik zorunludur')
    setUploading(true)
    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const ext = uploadFile.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${firma.id}/arsiv/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('arsiv-belgeler').upload(path, uploadFile)
    if (error) { alert('Yukleme hatasi: ' + error.message); setUploading(false); return }
    await supabase.from('arsiv_belgeler').insert({
      firma_id: firma.id, baslik: uploadForm.baslik, aciklama: uploadForm.aciklama || null,
      kategori_id: uploadForm.kategori_id || null, belge_tarihi: uploadForm.belge_tarihi || null,
      gonderen: uploadForm.gonderen || null, alici: uploadForm.alici || null,
      onemli: uploadForm.onemli, dosya_adi: uploadFile.name,
      storage_path: path, dosya_tipi: ext, dosya_boyutu: uploadFile.size,
    })
    setUploading(false); setUploadModal(false); setUploadFile(null)
    setUploadForm({ baslik:'', aciklama:'', kategori_id:'', belge_tarihi:'', gonderen:'', alici:'', onemli: false })
    load()
  }

  async function belgeOnizle(b: any) {
    const { data } = await supabase.storage.from('arsiv-belgeler').createSignedUrl(b.storage_path, 120)
    if (data?.signedUrl) setPreview({ url: data.signedUrl, adi: b.dosya_adi, tip: b.dosya_tipi })
  }

  async function belgeIndir(b: any) {
    const { data } = await supabase.storage.from('arsiv-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = b.dosya_adi; a.click() }
  }

  async function belgeSil(id: string) {
    const b = belgeler.find(x => x.id === id)
    if (b?.storage_path) await supabase.storage.from('arsiv-belgeler').remove([b.storage_path])
    await supabase.from('arsiv_belgeler').delete().eq('id', id)
    setDelId(null); load()
  }

  // Drag & Drop yukle
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) { setUploadFile(file); setUploadForm(p => ({ ...p, baslik: file.name.replace(/\.[^.]+$/, '') })); setUploadModal(true) }
  }

  return (
    <div className="space-y-5">
      {/* Baslik */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><Archive className="w-4 h-4 text-slate-600" /></span>
            Arsiv
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 ml-10">{belgeler.length} belge &middot; {kategoriler.length} kategori</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 w-40" />
          </div>
          <Btn variant="secondary" size="sm" icon={<FolderPlus className="w-4 h-4" />} onClick={() => setKatModal(true)}>Kategori</Btn>
          <Btn size="sm" icon={<Upload className="w-4 h-4" />} onClick={() => { setUploadFile(null); setUploadForm({ baslik:'', aciklama:'', kategori_id:'', belge_tarihi:'', gonderen:'', alici:'', onemli: false }); setUploadModal(true) }}>Belge Yukle</Btn>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Sol: Kategoriler */}
        <div className="w-48 flex-shrink-0 space-y-1">
          <button onClick={() => { setKatF(''); setOnemliF(false) }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${!katF && !onemliF ? 'bg-slate-100 text-slate-800 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Archive className="w-4 h-4" /> Tum Belgeler <span className="ml-auto text-xs text-gray-400">{belgeler.length}</span>
          </button>
          <button onClick={() => { setKatF(''); setOnemliF(true) }} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${onemliF ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Star className="w-4 h-4 text-amber-400" /> Onemli <span className="ml-auto text-xs text-gray-400">{belgeler.filter(b=>b.onemli).length}</span>
          </button>
          <div className="pt-2 pb-1">
            <p className="text-xs font-semibold text-gray-400 px-3 mb-1">KATEGORİLER</p>
            {kategoriler.map(k => (
              <div key={k.id} className="group flex items-center">
                <button onClick={() => { setKatF(k.id); setOnemliF(false) }} className={`flex-1 text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${katF === k.id ? 'bg-slate-100 font-semibold text-slate-800' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: k.renk }} />
                  <span className="truncate">{k.ad}</span>
                  <span className="ml-auto text-xs text-gray-400">{belgeler.filter(b=>b.kategori_id===k.id).length}</span>
                </button>
                <button onClick={() => katSil(k.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-opacity"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          {/* Tip filtresi */}
          {tipler.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-gray-400 px-3 mb-1">DOSYA TİPİ</p>
              {tipler.map(t => (
                <button key={t} onClick={() => setTipF(tipF === t ? '' : t)} className={`w-full text-left px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${tipF === t ? 'bg-slate-100 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <span>{dosyaEmoji(t)}</span>
                  <span className="uppercase text-xs">{t}</span>
                  <span className="ml-auto text-xs text-gray-400">{belgeler.filter(b=>b.dosya_tipi===t).length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sag: Belgeler */}
        <div className="flex-1 min-w-0">
          {/* Drag & Drop alani */}
          <div ref={dropRef} onDragOver={e => e.preventDefault()} onDrop={onDrop}
            className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-sm text-gray-400 mb-4 hover:border-slate-400 hover:text-slate-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-5 h-5 mx-auto mb-1 opacity-50" />
            Dosyayi buraya surukle veya tikla
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.txt"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); setUploadForm(p => ({ ...p, baslik: f.name.replace(/\.[^.]+$/, '') })); setUploadModal(true) } }} />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Archive className="w-10 h-10" />} message="Belge bulunamadi" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(b => {
                const kat = kategoriler.find(k => k.id === b.kategori_id)
                return (
                  <div key={b.id} className={`bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all group ${b.onemli ? 'border-l-4 border-l-amber-400' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{dosyaEmoji(b.dosya_tipi)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate" title={b.baslik}>{b.baslik}</p>
                        <p className="text-xs text-gray-400 truncate">{b.dosya_adi}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {kat && <span className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: kat.renk }}>{kat.ad}</span>}
                          {b.belge_tarihi && <span className="text-xs text-gray-400">{fmtDate(b.belge_tarihi)}</span>}
                          {b.dosya_boyutu && <span className="text-xs text-gray-400">{dosyaBoyut(b.dosya_boyutu)}</span>}
                        </div>
                        {(b.gonderen || b.alici) && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {b.gonderen && `Gon: ${b.gonderen}`}{b.gonderen && b.alici && '  '}{b.alici && `Al: ${b.alici}`}
                          </p>
                        )}
                        {b.aciklama && <p className="text-xs text-gray-400 mt-0.5 truncate">{b.aciklama}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                      <button onClick={() => onemliToggle(b)} className={`p-1 rounded transition-colors ${b.onemli ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400'}`} title={b.onemli ? 'Onemliyi kaldir' : 'Onemli isaretle'}>
                        {b.onemli ? <Star className="w-4 h-4 fill-current" /> : <Star className="w-4 h-4" />}
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => belgeOnizle(b)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="Goruntule"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => belgeIndir(b)} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50" title="Indir"><Download className="w-4 h-4" /></button>
                        <button onClick={() => setDelId(b.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50" title="Sil"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Belge Yukle Modal */}
      {uploadModal && (
        <Modal title="Belge Yukle" onClose={() => setUploadModal(false)} size="lg"
          footer={<><Btn variant="secondary" onClick={() => setUploadModal(false)}>Iptal</Btn><Btn onClick={belgeYukle} disabled={uploading || !uploadFile}>{uploading ? 'Yukleniyor...' : 'Yukle'}</Btn></>}>
          <div className="space-y-4">
            {/* Dosya sec */}
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-slate-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}>
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">{dosyaEmoji(uploadFile.name.split('.').pop()||'')}</span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-800">{uploadFile.name}</p>
                    <p className="text-xs text-gray-400">{dosyaBoyut(uploadFile.size)}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setUploadFile(null) }} className="ml-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="text-gray-400">
                  <Upload className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-sm">Dosya sec (PDF, Excel, JPG, PNG, Word)</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Baslik" required className="md:col-span-2">
                <input type="text" value={uploadForm.baslik} onChange={e => setUploadForm(p=>({...p,baslik:e.target.value}))} className={inputCls} />
              </Field>
              <Field label="Kategori">
                <select value={uploadForm.kategori_id} onChange={e => setUploadForm(p=>({...p,kategori_id:e.target.value}))} className={inputCls}>
                  <option value="">-- Kategori sec --</option>
                  {kategoriler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </select>
              </Field>
              <Field label="Belge Tarihi">
                <input type="date" value={uploadForm.belge_tarihi} onChange={e => setUploadForm(p=>({...p,belge_tarihi:e.target.value}))} className={inputCls} />
              </Field>
              <Field label="Gonderen">
                <input type="text" value={uploadForm.gonderen} onChange={e => setUploadForm(p=>({...p,gonderen:e.target.value}))} className={inputCls} placeholder="Kurum / Kisi" />
              </Field>
              <Field label="Alici">
                <input type="text" value={uploadForm.alici} onChange={e => setUploadForm(p=>({...p,alici:e.target.value}))} className={inputCls} placeholder="Kurum / Kisi" />
              </Field>
              <Field label="Aciklama" className="md:col-span-2">
                <textarea rows={2} value={uploadForm.aciklama} onChange={e => setUploadForm(p=>({...p,aciklama:e.target.value}))} className={inputCls} />
              </Field>
              <div className="md:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="onemli" checked={uploadForm.onemli} onChange={e => setUploadForm(p=>({...p,onemli:e.target.checked}))} className="w-4 h-4 text-amber-500 rounded" />
                <label htmlFor="onemli" className="text-sm text-gray-700 flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400" />Onemli olarak isaretle</label>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Kategori Modal */}
      {katModal && (
        <Modal title="Yeni Kategori" onClose={() => setKatModal(false)} size="sm"
          footer={<><Btn variant="secondary" onClick={() => setKatModal(false)}>Iptal</Btn><Btn onClick={saveKategori} disabled={savingKat}>{savingKat ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <Field label="Kategori Adi" required>
              <input type="text" value={katForm.ad} onChange={e => setKatForm(p=>({...p,ad:e.target.value}))} className={inputCls} placeholder="Resmi Yazmalar, Sozlesmeler..." />
            </Field>
            <Field label="Renk">
              <div className="flex items-center gap-3">
                <input type="color" value={katForm.renk} onChange={e => setKatForm(p=>({...p,renk:e.target.value}))} className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                <span className="text-sm text-gray-600">{katForm.renk}</span>
              </div>
            </Field>
          </div>
        </Modal>
      )}

      {/* Onizleme */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm truncate">{preview.adi}</span>
              <div className="flex gap-2">
                <a href={preview.url} download={preview.adi} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" />Indir</a>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {['jpg','jpeg','png'].includes(preview.tip)
                ? <img src={preview.url} alt={preview.adi} className="max-w-full mx-auto rounded" />
                : <iframe src={preview.url} className="w-full h-full min-h-[60vh] rounded" />
              }
            </div>
          </div>
        </div>
      )}

      {delId && (
        <ConfirmDialog message="Bu belge kalici olarak silinsin mi?"
          onConfirm={() => belgeSil(delId)}
          onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}