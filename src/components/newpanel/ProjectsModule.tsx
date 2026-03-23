'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderKanban, Pencil, Plus, Trash2, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'

export interface FirmaRecord {
  id: string
  ad: string
  kisa_ad?: string | null
  vergi_no?: string | null
  mersis_no?: string | null
  yetkili?: string | null
  telefon?: string | null
  email?: string | null
  adres?: string | null
  aktif?: boolean
}

export interface ProjectRecord {
  id: string
  firma_id: string
  sirket?: string | null
  kod: string | null
  ad: string
  durum: string
  baslangic_tarihi: string | null
  bitis_tarihi: string | null
  butce: number | null
  lokasyon: string | null
  aciklama: string | null
}

interface Props {
  firma: FirmaRecord
  role?: string | null
}

const statusLabels: Record<string, string> = {
  planlama: 'Planlama',
  aktif: 'Aktif',
  beklemede: 'Beklemede',
  kapandi: 'Kapandi',
}

const statusClasses: Record<string, string> = {
  planlama: 'bg-amber-500/15 text-amber-200',
  aktif: 'bg-emerald-500/15 text-emerald-200',
  beklemede: 'bg-slate-500/15 text-slate-200',
  kapandi: 'bg-rose-500/15 text-rose-200',
}

const emptyForm = {
  sirket: 'ETM',
  kod: '',
  ad: '',
  durum: 'planlama',
  baslangic_tarihi: '',
  bitis_tarihi: '',
  butce: '',
  lokasyon: '',
  aciklama: '',
}

function parseMissingColumn(message?: string) {
  const match = (message || '').match(/'([^']+)' column of/i)
  return match?.[1] || null
}

export default function ProjectsModule({ firma, role }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectRecord | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState<'all' | 'aktif' | null>(null)
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    if (!sirket) return
    setError('')
    const { data, error } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
    if (error) {
      setError(error.message)
      setProjects([])
      setLoading(false)
      return
    }
    const allData = (data as any[]) || []
    const filtered = allData.filter(p => sirket === 'ETM' ? (!p.sirket || p.sirket === 'ETM') : p.sirket === sirket)
    setProjects(filtered as ProjectRecord[])
    setLoading(false)
  }, [firma.id, sirket])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const summary = useMemo(() => {
    const activeCount = projects.filter((item) => item.durum === 'aktif').length
    const totalBudget = projects.reduce((sum, item) => sum + Number(item.butce || 0), 0)
    return { activeCount, totalBudget }
  }, [projects])

  const displayedProjects = useMemo(() => {
    if (filter === null) return []
    if (filter === 'all') return projects
    return projects.filter((p) => p.durum === filter)
  }, [projects, filter])

  function openCreateModal() {
    if (!can(role, 'edit')) return
    setEditing(null)
    setForm({ ...emptyForm, sirket: sirket || 'ETM' })
    setModalOpen(true)
  }

  function openEditModal(project: ProjectRecord) {
    if (!can(role, 'edit')) return
    setEditing(project)
    setForm({
      sirket: project.sirket || sirket || 'ETM',
      kod: project.kod || '',
      ad: project.ad,
      durum: project.durum || 'planlama',
      baslangic_tarihi: project.baslangic_tarihi || '',
      bitis_tarihi: project.bitis_tarihi || '',
      butce: project.butce ? String(project.butce) : '',
      lokasyon: project.lokasyon || '',
      aciklama: project.aciklama || '',
    })
    setModalOpen(true)
  }

  async function saveProject() {
    if (!can(role, 'edit')) return
    if (!form.ad.trim()) {
      setError('Proje adi zorunludur.')
      return
    }

    setSaving(true)
    setError('')

    const payload: any = {
      firma_id: firma.id,
      kod: form.kod || null,
      sirket: form.sirket,
      ad: form.ad.trim(),
      durum: form.durum,
      baslangic_tarihi: form.baslangic_tarihi || null,
      bitis_tarihi: form.bitis_tarihi || null,
      butce: form.butce ? Number(form.butce) : 0,
      lokasyon: form.lokasyon || null,
      aciklama: form.aciklama || null,
    }

    let working = { ...payload }
    let response;
    while (true) {
      response = editing ? await supabase.from('projeler').update(working).eq('id', editing.id) : await supabase.from('projeler').insert(working)
      if (!response.error) break
      const col = parseMissingColumn(response.error.message)
      if (!col || !(col in working) || Object.keys(working).length <= 2) break
      delete working[col]
    }

    if (response.error) {
      setError(response.error.message)
      setSaving(false)
      return
    }

    if (Object.keys(working).length < Object.keys(payload).length) {
      alert('Veritabanında "sirket" kolonu bulunamadığı için proje ana firma (ETM) altında kaydedildi. Lütfen Supabase üzerinden "projeler" tablosuna "sirket" adında bir "text" kolonu ekleyin.')
    }

    setModalOpen(false)
    setSaving(false)
    fetchProjects()
  }

  async function deleteProject(project: ProjectRecord) {
    if (!can(role, 'delete')) return
    if (!confirm(`"${project.ad}" projesini silmek istediginize emin misiniz?`)) return
    const { error } = await supabase.from('projeler').delete().eq('id', project.id)
    if (error) {
      setError(error.message)
      return
    }
    fetchProjects()
  }

  const currency = (value: number) => value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL'

  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Proje Yönetimi</h2>
          <p className="text-slate-400 text-sm">İşlem yapmak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex gap-6">
          <button onClick={() => setSirket('ETM')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">E</div>
             <h3 className="text-xl font-bold text-slate-100">ETM A.Ş.</h3>
             <p className="mt-2 text-xs text-slate-400">Merkez Firma Projeleri</p>
          </button>
          <button onClick={() => setSirket('BİNYAPI')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">B</div>
             <h3 className="text-xl font-bold text-slate-100">BİNYAPI</h3>
             <p className="mt-2 text-xs text-slate-400">Binyapı Firma Projeleri</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 mb-5">
        <button onClick={() => setSirket(null)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={16} /> Firmalara Dön
        </button>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white text-xs font-bold">{sirket === 'ETM' ? 'E' : 'B'}</div>
          <p className="text-sm font-bold text-white">{sirket === 'ETM' ? 'ETM A.Ş.' : 'BİNYAPI'}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Proje" value={String(projects.length)} note="Tum projeleri listele" onClick={() => setFilter(filter === 'all' ? null : 'all')} isActive={filter === 'all'} />
        <SummaryCard label="Aktif Proje" value={String(summary.activeCount)} note="Sadece aktifleri listele" onClick={() => setFilter(filter === 'aktif' ? null : 'aktif')} isActive={filter === 'aktif'} />
        <SummaryCard label="Toplam Butce" value={currency(summary.totalBudget)} note="Kayitli proje butceleri" />
      </div>

      <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.04] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-400/80">Proje Kontrol Merkezi</p>
            <h3 className="mt-1.5 text-xl font-bold tracking-tight text-white">Operasyonel Proje Listesi</h3>
          </div>
          <button type="button" onClick={openCreateModal} disabled={!can(role, 'edit')} className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={16} />
            Yeni proje
          </button>
        </div>

      {error && <p className="mt-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-200">{error}</p>}

        {loading ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/10 p-8 text-center text-[13px] text-slate-300">Projeler yukleniyor...</div>
        ) : filter === null ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center transition-all">
            <FolderKanban size={28} className="mx-auto text-slate-500" />
          <p className="mt-3 text-[13px] text-slate-400">Projeleri goruntulemek icin yukaridan bir sekme secin.</p>
          </div>
        ) : displayedProjects.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/10 p-8 text-center">
            <FolderKanban size={28} className="mx-auto text-slate-400" />
          <p className="mt-3 text-[13px] text-slate-400">{filter === 'aktif' ? 'Aktif proje bulunmuyor.' : 'Henuz proje kaydi yok.'}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {displayedProjects.map((project) => (
            <div key={project.id} className="rounded-3xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] transition-colors p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold text-slate-100">{project.ad}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${statusClasses[project.durum] || statusClasses.planlama}`}>{statusLabels[project.durum] || project.durum}</span>
                    {project.kod && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-slate-300 tracking-wider">{project.kod}</span>}
                    </div>
                  <p className="mt-1.5 text-[13px] font-medium text-slate-400">{project.lokasyon || 'Lokasyon girilmedi'} • <span className="text-blue-400">{currency(Number(project.butce || 0))}</span></p>
                  <p className="mt-1 text-[10px] text-slate-500 font-medium">{project.baslangic_tarihi || '-'} / {project.bitis_tarihi || '-'}</p>
                  {project.aciklama && <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400 border-l-2 border-slate-700 pl-2">{project.aciklama}</p>}
                  </div>

                  {(can(role, 'edit') || can(role, 'delete')) && (
                    <div className="flex items-center gap-2">
                      {can(role, 'edit') && (
                      <button type="button" onClick={() => openEditModal(project)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/20">
                          <Pencil size={14} />
                          Duzenle
                        </button>
                      )}
                      {can(role, 'delete') && (
                      <button type="button" onClick={() => deleteProject(project)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20">
                          <Trash2 size={14} />
                          Sil
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && can(role, 'edit') && (
        <Modal title={editing ? 'Projeyi duzenle' : 'Yeni proje olustur'} onClose={() => setModalOpen(false)} footer={<><button className={btnSecondary} onClick={() => setModalOpen(false)}>Iptal</button><button className={btnPrimary} onClick={saveProject} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Şirket / Marka" required>
                <select className={inputCls} value={form.sirket} onChange={(e) => setForm({ ...form, sirket: e.target.value })}>
                  <option value="ETM" className="bg-slate-900 text-white">ETM</option>
                  <option value="BİNYAPI" className="bg-slate-900 text-white">BİNYAPI</option>
                </select>
              </FormField>
              <FormField label="Proje Kodu"><input className={inputCls} value={form.kod} onChange={(e) => setForm({ ...form, kod: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Durum" required><select className={inputCls} value={form.durum} onChange={(e) => setForm({ ...form, durum: e.target.value })}><option value="planlama">Planlama</option><option value="aktif">Aktif</option><option value="beklemede">Beklemede</option><option value="kapandi">Kapandi</option></select></FormField>
              <FormField label="Proje Adi" required><input className={inputCls} value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Baslangic Tarihi"><input type="date" className={inputCls} value={form.baslangic_tarihi} onChange={(e) => setForm({ ...form, baslangic_tarihi: e.target.value })} /></FormField>
              <FormField label="Bitis Tarihi"><input type="date" className={inputCls} value={form.bitis_tarihi} onChange={(e) => setForm({ ...form, bitis_tarihi: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Butce"><input type="number" className={inputCls} value={form.butce} onChange={(e) => setForm({ ...form, butce: e.target.value })} /></FormField>
              <FormField label="Lokasyon"><input className={inputCls} value={form.lokasyon} onChange={(e) => setForm({ ...form, lokasyon: e.target.value })} /></FormField>
            </div>
            <FormField label="Aciklama"><textarea className={inputCls} rows={3} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SummaryCard({ label, value, note, onClick, isActive }: { label: string; value: string; note: string; onClick?: () => void; isActive?: boolean }) {
  return (
    <div onClick={onClick} className={`rounded-[28px] border backdrop-blur-2xl p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.2)] transition-all ${onClick ? 'cursor-pointer hover:bg-white/[0.06]' : ''} ${isActive ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/[0.05] bg-white/[0.03]'}`}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{note}</p>
    </div>
  )
}
