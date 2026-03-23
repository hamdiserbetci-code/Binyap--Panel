'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Plus, ShieldCheck, Trash2, Upload, X, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import { buildCompanyStoragePath } from '@/lib/storagePaths'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

interface TaxRecord { id: string; proje_id: string | null; surec_turu: string; yil: number; ay: number | null; donem: string | null; son_tarih: string; beyan_tarihi: string | null; tutar: number; durum: string; sorumlu: string | null; aciklama: string | null; sirket?: string | null }
interface DocumentRecord { id: string; proje_id: string | null; dosya_adi: string; dosya_url: string; dosya_boyutu: number | null; created_at: string; sirket?: string | null }
interface Props { firma: FirmaRecord; role?: string | null }

const taxTypes = [{ value: 'kdv', label: 'KDV' }, { value: 'muhtasar_sgk', label: 'Muhtasar / SGK' }, { value: 'gecici_vergi', label: 'Gecici Vergi' }, { value: 'kurumlar_vergisi', label: 'Kurumlar Vergisi' }, { value: 'edefter', label: 'e-Defter' }]
const formInitial = { proje_id: '', surec_turu: 'kdv', yil: new Date().getFullYear(), ay: new Date().getMonth() + 1, donem: '', son_tarih: '', beyan_tarihi: '', tutar: '', durum: 'taslak', sorumlu: '', aciklama: '' }

function parseMissingColumn(message?: string) {
  const match = (message || '').match(/'([^']+)' column of/i)
  return match?.[1] || null
}

export default function TaxModule({ firma, role }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [records, setRecords] = useState<TaxRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedType, setSelectedType] = useState('kdv')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(formInitial)
  const [uploading, setUploading] = useState(false)
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchProjects = useCallback(async () => {
    if (!sirket) return;
    const { data, error } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad');
    if (error) { setError(error.message); return };
    const all = (data as any[]) || [];
    setProjects(all.filter(p => sirket === 'ETM' ? (!p.sirket || p.sirket === 'ETM') : p.sirket === sirket) as ProjectRecord[])
  }, [firma.id, sirket])

  const fetchRecords = useCallback(async () => {
    if (!sirket) return;
    setLoading(true);
    let query = supabase.from('vergi_surecleri').select('*').eq('firma_id', firma.id).eq('surec_turu', selectedType).eq('yil', selectedYear).order('ay', { ascending: true });
    if (selectedProjectId) query = query.eq('proje_id', selectedProjectId);
    const { data, error } = await query;
    if (error) { setError(error.message); setRecords([]); setLoading(false); return };
    const all = (data as any[]) || [];
    setRecords(all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket) as TaxRecord[]);
    setLoading(false)
  }, [firma.id, selectedProjectId, selectedType, selectedYear, sirket])

  const fetchDocuments = useCallback(async () => {
    if (!sirket) return;
    let query = supabase.from('dokumanlar').select('*').eq('firma_id', firma.id).eq('modul', 'vergi_sgk').eq('kategori', selectedType).order('created_at', { ascending: false });
    if (selectedProjectId) query = query.eq('proje_id', selectedProjectId);
    const { data, error } = await query;
    if (error) { setError(error.message); setDocuments([]); return };
    const all = (data as any[]) || [];
    setDocuments(all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket) as DocumentRecord[])
  }, [firma.id, selectedProjectId, selectedType, sirket])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchRecords(); fetchDocuments() }, [fetchDocuments, fetchRecords])

  const totals = useMemo(() => ({
    totalAmount: records.reduce((sum, item) => sum + Number(item.tutar || 0), 0),
    completed: records.filter((item) => item.durum === 'tamamlandi').length,
    pending: records.filter((item) => item.durum !== 'tamamlandi').length
  }), [records])

  function openModal() {
    if (!can(role, 'edit')) return;
    setForm({ ...formInitial, proje_id: selectedProjectId, surec_turu: selectedType, yil: selectedYear });
    setModalOpen(true)
  }

  async function saveRecord() {
    if (!can(role, 'edit')) return;
    if (!form.son_tarih || !form.tutar) { setError('Son tarih ve tutar zorunludur.'); return };
    
    const payload: any = { firma_id: firma.id, sirket, proje_id: form.proje_id || null, surec_turu: form.surec_turu, yil: Number(form.yil), ay: Number(form.ay) || null, donem: form.donem || null, son_tarih: form.son_tarih, beyan_tarihi: form.beyan_tarihi || null, tutar: Number(form.tutar), durum: form.durum, sorumlu: form.sorumlu || null, aciklama: form.aciklama || null };
    
    let working = { ...payload };
    let res;
    while(true) {
      res = await supabase.from('vergi_surecleri').insert(working);
      if (!res.error) break;
      const col = parseMissingColumn(res.error.message);
      if (!col || !(col in working) || Object.keys(working).length <= 2) break;
      delete working[col];
    }
    
    if (res.error) { setError(res.error.message); return };
    await logActivity({ firmaId: firma.id, modul: 'vergi_sgk', islemTuru: 'surec_olusturuldu', kayitTuru: 'vergi_sureci', aciklama: form.surec_turu + ' sureci olusturuldu.', meta: { projeId: form.proje_id || null, yil: form.yil, tutar: form.tutar } });
    setModalOpen(false); fetchRecords()
  }

  async function updateStatus(record: TaxRecord, durum: string) {
    if (!can(role, 'edit')) return;
    const { error } = await supabase.from('vergi_surecleri').update({ durum }).eq('id', record.id);
    if (error) { setError(error.message); return };
    await logActivity({ firmaId: firma.id, modul: 'vergi_sgk', islemTuru: 'durum_degisti', kayitTuru: 'vergi_sureci', kayitId: record.id, aciklama: record.surec_turu + ' surecinin durumu ' + durum + ' olarak guncellendi.' });
    fetchRecords()
  }

  async function deleteRecord(id: string) {
    if (!can(role, 'delete')) return;
    if (!confirm('Bu vergi kaydini silmek istediginize emin misiniz?')) return;
    const { error } = await supabase.from('vergi_surecleri').delete().eq('id', id);
    if (error) { setError(error.message); return };
    await logActivity({ firmaId: firma.id, modul: 'vergi_sgk', islemTuru: 'surec_silindi', kayitTuru: 'vergi_sureci', kayitId: id, aciklama: id + ' vergi sureci silindi.' });
    fetchRecords()
  }

  async function uploadDocument(file: File) {
    if (!can(role, 'edit')) return
    if (file.size > 10 * 1024 * 1024) { setError('Dosya boyutu 10MB ustunde olamaz.'); return }
    setUploading(true)
    const fileName = buildCompanyStoragePath({ firmaId: firma.id, modul: 'vergi_sgk', category: selectedType, fileName: file.name })
    const uploadRes = await supabase.storage.from('dokumanlar').upload(fileName, file, { contentType: file.type })
    if (uploadRes.error) { setError(uploadRes.error.message); setUploading(false); return }
    
    const payload: any = { firma_id: firma.id, sirket, proje_id: selectedProjectId || null, modul: 'vergi_sgk', kategori: selectedType, dosya_adi: file.name, dosya_url: fileName, mime_type: file.type, dosya_boyutu: file.size }
    let working = { ...payload };
    let insertRes;
    while(true) {
      insertRes = await supabase.from('dokumanlar').insert(working);
      if (!insertRes.error) break;
      const col = parseMissingColumn(insertRes.error.message);
      if (!col || !(col in working) || Object.keys(working).length <= 2) break;
      delete working[col]
    }
    
    if (insertRes.error) { setError(insertRes.error.message); setUploading(false); return }
    await logActivity({ firmaId: firma.id, modul: 'vergi_sgk', islemTuru: 'dokuman_yuklendi', kayitTuru: 'dokuman', aciklama: file.name + ' vergi dokumani yuklendi.', meta: { projeId: selectedProjectId || null, kategori: selectedType } })
    setUploading(false); fetchDocuments()
  }

  async function downloadDocument(document: DocumentRecord) {
    const { data, error } = await supabase.storage.from('dokumanlar').createSignedUrl(document.dosya_url, 60);
    if (error) { setError(error.message); return };
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteDocument(document: DocumentRecord) {
    if (!can(role, 'delete')) return;
    if (!confirm('Bu dokumani silmek istediginize emin misiniz?')) return;
    await supabase.storage.from('dokumanlar').remove([document.dosya_url]);
    const { error } = await supabase.from('dokumanlar').delete().eq('id', document.id);
    if (error) { setError(error.message); return };
    await logActivity({ firmaId: firma.id, modul: 'vergi_sgk', islemTuru: 'dokuman_silindi', kayitTuru: 'dokuman', kayitId: document.id, aciklama: document.dosya_adi + ' vergi dokumani silindi.' });
    fetchDocuments()
  }

  const years = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index)
  const projectName = (id?: string | null) => projects.find((project) => project.id === id)?.ad || 'Genel'
  const money = (value: number) => value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
  const fileSize = (value?: number | null) => (!value ? '-' : value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`)

  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Vergi ve SGK Süreçleri</h2>
          <p className="text-slate-400 text-sm">İşlem yapmak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex gap-6">
          <button onClick={() => setSirket('ETM')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">E</div>
             <h3 className="text-xl font-bold text-slate-100">ETM A.Ş.</h3>
             <p className="mt-2 text-xs text-slate-400">Merkez Firma Süreçleri</p>
          </button>
          <button onClick={() => setSirket('BİNYAPI')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">B</div>
             <h3 className="text-xl font-bold text-slate-100">BİNYAPI</h3>
             <p className="mt-2 text-xs text-slate-400">Binyapı Firma Süreçleri</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setSirket(null)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={16} /> Firmalara Dön
        </button>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white text-xs font-bold">{sirket === 'ETM' ? 'E' : 'B'}</div>
          <p className="text-sm font-bold text-white">{sirket === 'ETM' ? 'ETM A.Ş.' : 'BİNYAPI'}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Toplam Tutar" value={money(totals.totalAmount)} tone="sky" />
        <MetricCard label="Tamamlanan" value={String(totals.completed)} tone="emerald" />
        <MetricCard label="Bekleyen" value={String(totals.pending)} tone="amber" />
        <div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Filtre</p>
          <div className="mt-3 grid gap-2">
            <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              {taxTypes.map((item) => <option key={item.value} value={item.value} className="text-slate-900">{item.label}</option>)}
            </select>
            <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {years.map((year) => <option key={year} value={year} className="text-slate-900">{year}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400/80">Yasal Yukumlulukler</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Resmi Surec ve Evrak Yonetimi</h3>
            <p className="mt-2 text-sm text-slate-400">Beyanname, bildirge ve tahakkuk evraklarinin periyodik denetimi.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">Tum projeler</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.ad}</option>)}
            </select>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!can(role, 'edit')} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50">
              <Upload size={16} />{uploading ? 'Yukleniyor...' : 'Dokuman yukle'}
            </button>
            <button type="button" onClick={openModal} disabled={!can(role, 'edit')} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus size={16} />Yeni surec
            </button>
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.xlsx,.xls,image/*" onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0])} />
          <input ref={fileRef} type="file" className="hidden" accept=".pdf, .xlsx, .xls, image/*, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0])} />
        </div>

        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/[0.05] bg-white/[0.01] shadow-inner p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-white">Beyanname ve Odemeler</h4>
              <ShieldCheck size={16} className="text-slate-500" />
            </div>
            <div className="mt-4 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Vergi surecleri yukleniyor...</p>
              ) : records.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
                  <ShieldCheck size={28} className="mx-auto text-slate-400" />
                  <p className="mt-3 text-sm text-slate-400">Bu filtrede surec yok.</p>
                </div>
              ) : (
                records.map((record) => (
                  <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{taxTypes.find((item) => item.value === record.surec_turu)?.label || record.surec_turu}</p>
                      <p className="mt-1 text-xs text-slate-400">{projectName(record.proje_id)} • Son tarih: {record.son_tarih}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">Sorumlu: {record.sorumlu || '-'} • Donem: {record.donem || record.ay || '-'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-200">{money(record.tutar)}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{record.durum}</p>
                      </div>
                      {can(role, 'edit') && (
                        <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none" value={record.durum} onChange={(e) => updateStatus(record, e.target.value)}>
                          <option value="taslak">Taslak</option>
                          <option value="islemde">Islemde</option>
                          <option value="onay_bekliyor">Onay bekliyor</option>
                          <option value="tamamlandi">Tamamlandi</option>
                        </select>
                      )}
                      {can(role, 'delete') && (
                        <button type="button" onClick={() => deleteRecord(record.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20">
                          <Trash2 size={14} />Sil
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.05] bg-white/[0.01] shadow-inner p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-white">Resmi Evrak Arsivi</h4>
              <FileText size={16} className="text-slate-500" />
            </div>
            <div className="mt-4 space-y-3">
              {documents.length === 0 ? (
                <p className="text-sm text-slate-500">Bu surec icin dokuman yok.</p>
              ) : (
                documents.map((document) => (
                  <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4">
                    <div>
                      <p className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{document.dosya_adi}</p>
                      <p className="mt-1 text-xs text-slate-400">{projectName(document.proje_id)} • {document.created_at?.split('T')[0]}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500">{fileSize(document.dosya_boyutu)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => downloadDocument(document)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10">
                        <Download size={14} />Indir
                      </button>
                      {can(role, 'delete') && (
                        <button type="button" onClick={() => deleteDocument(document)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20">
                          <X size={14} />Sil
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {modalOpen && can(role, 'edit') && (
        <Modal title="Yeni vergi sureci" onClose={() => setModalOpen(false)} footer={<><button className={btnSecondary} onClick={() => setModalOpen(false)}>Iptal</button><button className={btnPrimary} onClick={saveRecord}>Kaydet</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Proje">
                <select className={inputCls} value={form.proje_id} onChange={(e) => setForm({ ...form, proje_id: e.target.value })}>
                  <option value="">Genel surec</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.ad}</option>)}
                </select>
              </FormField>
              <FormField label="Surec Turu">
                <select className={inputCls} value={form.surec_turu} onChange={(e) => setForm({ ...form, surec_turu: e.target.value })}>
                  {taxTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Yil"><input type="number" className={inputCls} value={form.yil} onChange={(e) => setForm({ ...form, yil: Number(e.target.value) })} /></FormField>
              <FormField label="Ay"><input type="number" className={inputCls} value={form.ay} onChange={(e) => setForm({ ...form, ay: Number(e.target.value) })} /></FormField>
              <FormField label="Donem"><input className={inputCls} value={form.donem} onChange={(e) => setForm({ ...form, donem: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Son Tarih" required><input type="date" className={inputCls} value={form.son_tarih} onChange={(e) => setForm({ ...form, son_tarih: e.target.value })} /></FormField>
              <FormField label="Beyan Tarihi"><input type="date" className={inputCls} value={form.beyan_tarihi} onChange={(e) => setForm({ ...form, beyan_tarihi: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Tutar" required><input type="number" className={inputCls} value={form.tutar} onChange={(e) => setForm({ ...form, tutar: e.target.value })} /></FormField>
              <FormField label="Durum">
                <select className={inputCls} value={form.durum} onChange={(e) => setForm({ ...form, durum: e.target.value })}>
                  <option value="taslak">Taslak</option><option value="islemde">Islemde</option><option value="onay_bekliyor">Onay bekliyor</option><option value="tamamlandi">Tamamlandi</option>
                </select>
              </FormField>
              <FormField label="Sorumlu"><input className={inputCls} value={form.sorumlu} onChange={(e) => setForm({ ...form, sorumlu: e.target.value })} /></FormField>
            </div>
            <FormField label="Aciklama"><textarea className={inputCls} rows={3} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'sky' | 'emerald' | 'amber' }) {
  const toneClass = { sky: 'text-sky-300', emerald: 'text-emerald-300', amber: 'text-amber-300' }[tone];
  return <div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><p className={`mt-3 text-2xl font-semibold ${toneClass}`}>{value}</p></div>
}
