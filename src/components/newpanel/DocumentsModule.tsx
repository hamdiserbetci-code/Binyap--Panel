﻿'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileArchive, FileText, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import { buildCompanyStoragePath } from '@/lib/storagePaths'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

interface DocumentRecord { id: string; proje_id: string | null; modul: string; kategori: string; dosya_adi: string; dosya_url: string; mime_type: string | null; dosya_boyutu: number | null; donem: string | null; aciklama: string | null; created_at: string }
interface Props { firma: FirmaRecord; role?: string | null }

const formInitial = { proje_id: '', modul: 'genel', kategori: '', donem: '', aciklama: '' }
const modules = [{ value: 'genel', label: 'Genel' }, { value: 'gelir_gider', label: 'Gelir / Gider' }, { value: 'puantaj', label: 'Puantaj' }, { value: 'odeme_plani', label: 'Odeme Plani' }, { value: 'kasa', label: 'Kasa' }, { value: 'vergi_sgk', label: 'Vergi / SGK' }]

export default function DocumentsModule({ firma, role }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedModule, setSelectedModule] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState(formInitial)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchProjects = useCallback(async () => { const { data, error } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad'); if (error) { setError(error.message); return }; setProjects((data as ProjectRecord[]) || []) }, [firma.id])
  const fetchDocuments = useCallback(async () => { setLoading(true); let query = supabase.from('dokumanlar').select('*').eq('firma_id', firma.id).order('created_at', { ascending: false }); if (selectedProjectId) query = query.eq('proje_id', selectedProjectId); if (selectedModule) query = query.eq('modul', selectedModule); const { data, error } = await query; if (error) { setError(error.message); setDocuments([]); setLoading(false); return }; setDocuments((data as DocumentRecord[]) || []); setLoading(false) }, [firma.id, selectedModule, selectedProjectId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchDocuments() }, [fetchDocuments])

  const summary = useMemo(() => ({ total: documents.length, totalSize: documents.reduce((sum, item) => sum + Number(item.dosya_boyutu || 0), 0) }), [documents])
  function openModal() { if (!can(role, 'edit')) return; setForm({ ...formInitial, proje_id: selectedProjectId, modul: selectedModule || 'genel' }); setModalOpen(true) }

  async function uploadDocument(file: File) {
    if (!can(role, 'edit')) return
    if (!form.kategori.trim()) { setError('Yukleme icin kategori girilmelidir.'); return }
    if (file.size > 15 * 1024 * 1024) { setError('Dosya boyutu 15MB ustunde olamaz.'); return }
    setUploading(true)
    const path = buildCompanyStoragePath({ firmaId: firma.id, modul: form.modul, category: form.kategori, fileName: file.name })
    const uploadRes = await supabase.storage.from('dokumanlar').upload(path, file, { contentType: file.type })
    if (uploadRes.error) { setError(uploadRes.error.message); setUploading(false); return }
    const insertRes = await supabase.from('dokumanlar').insert({ firma_id: firma.id, proje_id: form.proje_id || null, modul: form.modul, kategori: form.kategori, dosya_adi: file.name, dosya_url: path, mime_type: file.type, dosya_boyutu: file.size, donem: form.donem || null, aciklama: form.aciklama || null })
    if (insertRes.error) { setError(insertRes.error.message); setUploading(false); return }
    await logActivity({ firmaId: firma.id, modul: 'dokumanlar', islemTuru: 'yuklendi', kayitTuru: 'dokuman', aciklama: file.name + ' dokumani yüklendi.'.replace('ü','u'), meta: { projeId: form.proje_id || null, kategori: form.kategori, modul: form.modul } })
    setUploading(false); setModalOpen(false); fetchDocuments()
  }

  async function downloadDocument(document: DocumentRecord) { const { data, error } = await supabase.storage.from('dokumanlar').createSignedUrl(document.dosya_url, 60); if (error) { setError(error.message); return }; if (data?.signedUrl) window.open(data.signedUrl, '_blank') }
  async function deleteDocument(document: DocumentRecord) { if (!can(role, 'delete')) return; if (!confirm('Bu dokumani silmek istediginize emin misiniz?')) return; await supabase.storage.from('dokumanlar').remove([document.dosya_url]); const { error } = await supabase.from('dokumanlar').delete().eq('id', document.id); if (error) { setError(error.message); return }; await logActivity({ firmaId: firma.id, modul: 'dokumanlar', islemTuru: 'silindi', kayitTuru: 'dokuman', kayitId: document.id, aciklama: document.dosya_adi + ' dokumani silindi.' }); fetchDocuments() }

  const projectName = (id?: string | null) => projects.find((project) => project.id === id)?.ad || 'Genel'
  const fileSize = (value?: number | null) => (!value ? '-' : value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`)

  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-4"><MetricCard label="Toplam Dosya" value={String(summary.total)} /><MetricCard label="Toplam Boyut" value={fileSize(summary.totalSize)} /><MetricCard label="Modul Filtresi" value={selectedModule || 'Tum moduller'} /><div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">Filtre</p><div className="mt-3 grid gap-2"><select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}><option value="">Tum projeler</option>{projects.map((project) => <option key={project.id} value={project.id} className="text-slate-900">{project.ad}</option>)}</select><select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}><option value="">Tum moduller</option>{modules.map((item) => <option key={item.value} value={item.value} className="text-slate-900">{item.label}</option>)}</select></div></div></div><div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400/80">Kurumsal Bellek</p><h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Merkezi Dokuman Yonetimi</h3><p className="mt-2 text-sm text-slate-400">Sistemdeki tum modullere ait sozlesme ve faturalarin dijital arsiv envanteri.</p></div><button type="button" onClick={openModal} disabled={!can(role, 'edit')} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} />Yeni dokuman</button></div>{error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<div className="mt-6 rounded-3xl border border-white/[0.05] bg-white/[0.01] shadow-inner p-5"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-white">Dijital Arsiv Envanteri</h4><FileArchive size={16} className="text-slate-500" /></div><div className="mt-4 space-y-3">{loading ? <p className="text-sm text-slate-500">Dokumanlar yukleniyor...</p> : documents.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center"><FileText size={28} className="mx-auto text-slate-400" /><p className="mt-3 text-sm text-slate-400">Bu filtrede dokuman yok.</p></div> : documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4"><div><p className="text-sm font-medium text-slate-200">{document.dosya_adi}</p><p className="mt-1 text-xs text-slate-400">{projectName(document.proje_id)} • {document.modul} / {document.kategori}</p><p className="mt-1 text-[11px] font-medium text-slate-500">{document.donem || '-'} • {fileSize(document.dosya_boyutu)} • {document.created_at?.split('T')[0]}</p>{document.aciklama && <p className="mt-2 text-xs text-slate-400 border-l-2 border-slate-700 pl-2">{document.aciklama}</p>}</div><div className="flex items-center gap-2"><button type="button" onClick={() => downloadDocument(document)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10"><Download size={14} />Indir</button>{can(role, 'delete') && <button type="button" onClick={() => deleteDocument(document)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20"><Trash2 size={14} />Sil</button>}</div></div>)}</div></div></div>{modalOpen && can(role, 'edit') && <Modal title="Yeni dokuman yukle" onClose={() => setModalOpen(false)} footer={<><button className={btnSecondary} onClick={() => setModalOpen(false)}>Iptal</button><button className={btnPrimary} onClick={() => fileRef.current?.click()}>{uploading ? 'Yukleniyor...' : 'Dosya Sec'}</button></>}><div className="space-y-4"><div className="grid grid-cols-2 gap-4"><FormField label="Proje"><select className={inputCls} value={form.proje_id} onChange={(e) => setForm({ ...form, proje_id: e.target.value })}><option value="">Genel</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.ad}</option>)}</select></FormField><FormField label="Modul" required><select className={inputCls} value={form.modul} onChange={(e) => setForm({ ...form, modul: e.target.value })}>{modules.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormField></div><div className="grid grid-cols-2 gap-4"><FormField label="Kategori" required><input className={inputCls} value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} /></FormField><FormField label="Donem"><input className={inputCls} value={form.donem} onChange={(e) => setForm({ ...form, donem: e.target.value })} /></FormField></div><FormField label="Aciklama"><textarea className={inputCls} rows={3} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></FormField><input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0])} /></div></Modal>}</div>
}

function MetricCard({ label, value }: { label: string; value: string }) { return <div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><p className="mt-3 text-2xl font-semibold text-sky-300">{value}</p></div> }
