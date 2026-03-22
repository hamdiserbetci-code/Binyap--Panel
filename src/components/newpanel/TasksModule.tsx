'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlarmClock, CheckCircle2, CheckSquare, Clock3, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

interface TaskRecord { id: string; proje_id: string | null; baslik: string; aciklama: string | null; oncelik: string; durum: string; sorumlu: string | null; son_tarih: string | null; hatirlatma_tarihi: string | null; hatirlama_saati: string | null; erteleme_dakika: number | null; ertelenmis_tarih: string | null }
interface Props { firma: FirmaRecord; role?: string | null }

const formInitial = { proje_id: '', baslik: '', aciklama: '', oncelik: 'orta', durum: 'beklemede', sorumlu: '', son_tarih: '', hatirlatma_tarihi: '', hatirlama_saati: '', erteleme_dakika: '0' }
const priorityLabels: Record<string, string> = { dusuk: 'Dusuk', orta: 'Orta', yuksek: 'Yuksek', kritik: 'Kritik' }

function isMissingColumn(message: string | undefined, table: string, column: string) {
  const value = (message || '').toLowerCase()
  return value.includes(`column ${table}.${column}`) && value.includes('does not exist')
}

function isMissingTable(message: string | undefined, table: string) {
  const value = (message || '').toLowerCase()
  return value.includes(table.toLowerCase()) && (value.includes('schema cache') || value.includes('does not exist') || value.includes('could not find the table'))
}

export default function TasksModule({ firma, role }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(formInitial)
  const [supportsProjectId, setSupportsProjectId] = useState(true)

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
    if (error) { setError(error.message); return }
    setProjects((data as ProjectRecord[]) || [])
  }, [firma.id])

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('gorevler').select('*').eq('firma_id', firma.id)
    if (selectedProjectId && supportsProjectId) query = query.eq('proje_id', selectedProjectId)
    const { data, error } = await query
    if (error && isMissingColumn(error.message, 'gorevler', 'proje_id')) {
      setSupportsProjectId(false)
      const fallbackRes = await supabase.from('gorevler').select('*').eq('firma_id', firma.id)
      if (fallbackRes.error) {
        setError(fallbackRes.error.message)
        setTasks([])
        setLoading(false)
        return
      }
      setError('gorevler tablosunda proje baglantisi yok. Gorevler genel liste olarak gosteriliyor.')
      setTasks(((fallbackRes.data as any[]) || []).map((item) => ({ ...item, proje_id: null })) as TaskRecord[])
      setLoading(false)
      return
    }
    if (error) {
      if (isMissingTable(error.message, 'gorevler')) {
        setError('gorevler tablosu bulunamadi. Bu modul yeni SQL semasi uygulandiginda tam calisacak.')
        setTasks([])
        setLoading(false)
        return
      }
      setError(error.message)
      setTasks([])
      setLoading(false)
      return
    }
    setTasks((data as TaskRecord[]) || [])
    setLoading(false)
  }, [firma.id, selectedProjectId, supportsProjectId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchTasks() }, [fetchTasks])

  const summary = useMemo(() => ({ active: tasks.filter((task) => task.durum !== 'tamamlandi').length, completed: tasks.filter((task) => task.durum === 'tamamlandi').length, postponed: tasks.filter((task) => Number(task.erteleme_dakika || 0) > 0).length }), [tasks])
  function openModal() { if (!can(role, 'edit')) return; setForm({ ...formInitial, proje_id: selectedProjectId }); setModalOpen(true) }

  async function saveTask() {
    if (!can(role, 'edit')) return
    if (!form.baslik.trim()) { setError('Gorev basligi zorunludur.'); return }
    const postponedDate = form.hatirlatma_tarihi && form.erteleme_dakika && Number(form.erteleme_dakika) > 0 ? calculatePostponedDate(form.hatirlatma_tarihi, form.hatirlama_saati, Number(form.erteleme_dakika)) : null
    const payload: any = { firma_id: firma.id, baslik: form.baslik, aciklama: form.aciklama || null, oncelik: form.oncelik, durum: form.durum, sorumlu: form.sorumlu || null, son_tarih: form.son_tarih || null, hatirlatma_tarihi: form.hatirlatma_tarihi || null, hatirlama_saati: form.hatirlama_saati || null, erteleme_dakika: Number(form.erteleme_dakika || 0), ertelenmis_tarih: postponedDate }
    if (supportsProjectId) payload.proje_id = form.proje_id || null
    let response = await supabase.from('gorevler').insert(payload)
    if (response.error && isMissingColumn(response.error.message, 'gorevler', 'proje_id')) {
      setSupportsProjectId(false)
      delete payload.proje_id
      response = await supabase.from('gorevler').insert(payload)
    }
    if (response.error) { setError(response.error.message); return }
    await logActivity({ firmaId: firma.id, modul: 'gorevler', islemTuru: 'olusturuldu', kayitTuru: 'gorev', aciklama: form.baslik + ' gorevi olusturuldu.', meta: { projeId: supportsProjectId ? form.proje_id || null : null, durum: form.durum, oncelik: form.oncelik } })
    setModalOpen(false)
    fetchTasks()
  }

  async function cycleStatus(task: TaskRecord) { if (!can(role, 'edit')) return; const next = task.durum === 'beklemede' ? 'devam' : task.durum === 'devam' ? 'tamamlandi' : 'beklemede'; const { error } = await supabase.from('gorevler').update({ durum: next }).eq('id', task.id); if (error) { setError(error.message); return }; await logActivity({ firmaId: firma.id, modul: 'gorevler', islemTuru: 'durum_degisti', kayitTuru: 'gorev', kayitId: task.id, aciklama: task.baslik + ' gorevinin durumu ' + next + ' olarak guncellendi.' }); fetchTasks() }
  async function postponeTask(task: TaskRecord) { if (!can(role, 'edit')) return; const baseDate = task.hatirlatma_tarihi || task.son_tarih; if (!baseDate) { setError('Erteleme icin gorevde hatirlatma veya son tarih olmalidir.'); return }; const postponedDate = calculatePostponedDate(baseDate, task.hatirlama_saati || '', Number(task.erteleme_dakika || 0)); const { error } = await supabase.from('gorevler').update({ ertelenmis_tarih: postponedDate }).eq('id', task.id); if (error) { setError(error.message); return }; await logActivity({ firmaId: firma.id, modul: 'gorevler', islemTuru: 'ertelendi', kayitTuru: 'gorev', kayitId: task.id, aciklama: task.baslik + ' gorevi ertelendi.', meta: { ertelenmisTarih: postponedDate } }); fetchTasks() }
  async function deleteTask(id: string) { if (!can(role, 'delete')) return; if (!confirm('Bu gorevi silmek istediginize emin misiniz?')) return; const { error } = await supabase.from('gorevler').delete().eq('id', id); if (error) { setError(error.message); return }; await logActivity({ firmaId: firma.id, modul: 'gorevler', islemTuru: 'silindi', kayitTuru: 'gorev', kayitId: id, aciklama: id + ' gorevi silindi.' }); fetchTasks() }

  const projectName = (id?: string | null) => projects.find((project) => project.id === id)?.ad || 'Genel'

  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-4"><MetricCard label="Toplam Gorev" value={String(tasks.length)} /><MetricCard label="Aktif" value={String(summary.active)} /><MetricCard label="Tamamlandi" value={String(summary.completed)} /><MetricCard label="Ertelenen" value={String(summary.postponed)} /></div><div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/80">Operasyonel Takip</p><h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Gorev ve Hatirlatma Koordinasyonu</h3><p className="mt-2 text-sm text-slate-400">Kurum ici is sureclerinin son tarih ve uyari mekanizmalariyla takibi.</p></div><div className="flex flex-wrap items-center gap-2">{supportsProjectId && <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}><option value="">Tum projeler</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.ad}</option>)}</select>}<button type="button" onClick={openModal} disabled={!can(role, 'edit')} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} />Yeni gorev</button></div></div>{error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<div className="mt-6 rounded-3xl border border-white/[0.05] bg-white/[0.01] shadow-inner p-5"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-white">Aktif Is Akislari</h4><CheckSquare size={16} className="text-slate-500" /></div><div className="mt-4 space-y-3">{loading ? <p className="text-sm text-slate-500">Gorevler yukleniyor...</p> : tasks.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center"><CheckSquare size={28} className="mx-auto text-slate-400" /><p className="mt-3 text-sm text-slate-400">Henuz gorev kaydi yok.</p></div> : tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4"><div><p className="text-sm font-semibold text-slate-100">{task.baslik}</p><p className="mt-1 text-xs text-slate-400">{projectName(task.proje_id)} • <span className="text-amber-400">{priorityLabels[task.oncelik] || task.oncelik}</span> • <span className="text-sky-300">{task.durum}</span></p><div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium text-slate-500"><span className="bg-white/5 px-2 py-0.5 rounded-md">Sorumlu: {task.sorumlu || '-'}</span><span className="bg-white/5 px-2 py-0.5 rounded-md">Son tarih: {task.son_tarih || '-'}</span><span className="bg-white/5 px-2 py-0.5 rounded-md">Hatirlatma: {task.hatirlatma_tarihi || '-'} {task.hatirlama_saati || ''}</span><span className="bg-white/5 px-2 py-0.5 rounded-md">Erteleme: {task.erteleme_dakika || 0} dk</span>{task.ertelenmis_tarih && <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md">Yeni zaman: {formatDateTime(task.ertelenmis_tarih)}</span>}</div>{task.aciklama && <p className="mt-3 text-xs text-slate-400 border-l-2 border-slate-700 pl-2">{task.aciklama}</p>}</div><div className="flex flex-wrap items-center gap-2">{can(role, 'edit') && <button type="button" onClick={() => cycleStatus(task)} className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 hover:bg-sky-500/20"><CheckCircle2 size={14} />Durum</button>}{can(role, 'edit') && <button type="button" onClick={() => postponeTask(task)} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"><Clock3 size={14} />Ertele</button>}{can(role, 'delete') && <button type="button" onClick={() => deleteTask(task.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20"><Trash2 size={14} />Sil</button>}</div></div>)}</div></div></div>{modalOpen && can(role, 'edit') && <Modal title="Yeni gorev" onClose={() => setModalOpen(false)} footer={<><button className={btnSecondary} onClick={() => setModalOpen(false)}>Iptal</button><button className={btnPrimary} onClick={saveTask}>Kaydet</button></>}><div className="space-y-4">{supportsProjectId && <FormField label="Proje"><select className={inputCls} value={form.proje_id} onChange={(e) => setForm({ ...form, proje_id: e.target.value })}><option value="">Genel gorev</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.ad}</option>)}</select></FormField>}<FormField label="Gorev Basligi" required><input className={inputCls} value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} /></FormField><FormField label="Aciklama"><textarea className={inputCls} rows={3} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></FormField><div className="grid grid-cols-2 gap-4"><FormField label="Oncelik"><select className={inputCls} value={form.oncelik} onChange={(e) => setForm({ ...form, oncelik: e.target.value })}><option value="dusuk">Dusuk</option><option value="orta">Orta</option><option value="yuksek">Yuksek</option><option value="kritik">Kritik</option></select></FormField><FormField label="Durum"><select className={inputCls} value={form.durum} onChange={(e) => setForm({ ...form, durum: e.target.value })}><option value="beklemede">Beklemede</option><option value="devam">Devam</option><option value="tamamlandi">Tamamlandi</option></select></FormField></div><div className="grid grid-cols-2 gap-4"><FormField label="Sorumlu"><input className={inputCls} value={form.sorumlu} onChange={(e) => setForm({ ...form, sorumlu: e.target.value })} /></FormField><FormField label="Son Tarih"><input type="date" className={inputCls} value={form.son_tarih} onChange={(e) => setForm({ ...form, son_tarih: e.target.value })} /></FormField></div><div className="grid grid-cols-3 gap-4"><FormField label="Hatirlatma Tarihi"><input type="date" className={inputCls} value={form.hatirlatma_tarihi} onChange={(e) => setForm({ ...form, hatirlatma_tarihi: e.target.value })} /></FormField><FormField label="Hatirlatma Saati"><input type="time" className={inputCls} value={form.hatirlama_saati} onChange={(e) => setForm({ ...form, hatirlama_saati: e.target.value })} /></FormField><FormField label="Erteleme (dk)"><input type="number" className={inputCls} value={form.erteleme_dakika} onChange={(e) => setForm({ ...form, erteleme_dakika: e.target.value })} /></FormField></div></div></Modal>}</div>
}

function calculatePostponedDate(dateValue: string, timeValue: string, minutes: number) { const base = new Date(`${dateValue}T${timeValue || '09:00'}:00`); base.setMinutes(base.getMinutes() + (minutes || 0)); return base.toISOString() }
function formatDateTime(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleString('tr-TR') }
function MetricCard({ label, value }: { label: string; value: string }) { return <div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"><div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><AlarmClock size={16} className="text-slate-400" /></div><p className="mt-3 text-2xl font-semibold text-sky-300">{value}</p></div> }
