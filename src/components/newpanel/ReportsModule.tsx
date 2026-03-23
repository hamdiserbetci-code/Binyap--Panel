﻿﻿﻿﻿﻿﻿﻿'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, ChevronLeft } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

interface Props {
  firma: FirmaRecord
  role?: string | null
}

type ReportType = 'projeler' | 'puantaj' | 'kasa' | 'vergi'

const reportOptions: { value: ReportType; label: string }[] = [
  { value: 'projeler', label: 'Projeler' },
  { value: 'puantaj', label: 'Puantaj' },
  { value: 'kasa', label: 'Kasa' },
  { value: 'vergi', label: 'Vergi / SGK' },
]

export default function ReportsModule({ firma, role }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const [selectedReport, setSelectedReport] = useState<ReportType>('projeler')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
    if (error) {
      setError(error.message)
      return
    }
    setProjects((data as ProjectRecord[]) || [])
  }, [firma.id])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const reportSummary = useMemo(() => {
    const projectName = projects.find((project) => project.id === selectedProjectId)?.ad || 'Tum projeler'
    return { projectName }
  }, [projects, selectedProjectId])

  async function fetchRows(type: ReportType) {
    if (type === 'projeler') {
      let query = supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
      if (selectedProjectId) query = query.eq('id', selectedProjectId)
      const { data, error } = await query
      if (error) throw error
      const all = (data || []) as any[]
      const filtered = all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket)
      return filtered.map((item: any) => ({ Kod: item.kod || '', Proje: item.ad, Durum: item.durum, Baslangic: item.baslangic_tarihi || '', Bitis: item.bitis_tarihi || '', Butce: Number(item.butce || 0), Lokasyon: item.lokasyon || '', Aciklama: item.aciklama || '' }))
    }

    if (type === 'puantaj') {
      let query = supabase.from('puantaj_kayitlari').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false })
      if (selectedProjectId) query = query.eq('proje_id', selectedProjectId)
      const { data, error } = await query
      if (error) throw error
      const all = (data || []) as any[]
      const filtered = all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket)
      return filtered.map((item: any) => ({ Proje: projectLabel(item.proje_id, projects), Ekip: item.ekip_id || '', Calisan: item.calisan_id || '', Tarih: item.tarih || '', Durum: item.durum || '', Mesai: Number(item.mesai_saati || 0), Yevmiye: Number(item.yevmiye || 0), Aciklama: item.aciklama || '' }))
    }

    if (type === 'kasa') {
      let query = supabase.from('kasa_hareketleri').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false })
      if (selectedProjectId) query = query.eq('proje_id', selectedProjectId)
      const { data, error } = await query
      if (error) throw error
      const all = (data || []) as any[]
      const filtered = all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket)
      return filtered.map((item: any) => ({ Proje: projectLabel(item.proje_id, projects), Kanal: item.kanal, Hareket: item.hareket_turu, Tarih: item.tarih || '', Tutar: Number(item.tutar || 0), FisNo: item.fis_no || '', Aciklama: item.aciklama || '' }))
    }

    let query = supabase.from('vergi_surecleri').select('*').eq('firma_id', firma.id).order('yil', { ascending: false })
    if (selectedProjectId) query = query.eq('proje_id', selectedProjectId)
    const { data, error } = await query
    if (error) throw error
    const all = (data || []) as any[]
    const filtered = all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket)
    return filtered.map((item: any) => ({ Proje: projectLabel(item.proje_id, projects), Surec: item.surec_turu, Yil: item.yil, Ay: item.ay || '', Donem: item.donem || '', SonTarih: item.son_tarih || '', BeyanTarihi: item.beyan_tarihi || '', Tutar: Number(item.tutar || 0), Durum: item.durum || '', Sorumlu: item.sorumlu || '' }))
  }

  async function downloadExcel() {
    if (!can(role, 'report')) {
      setError('Bu rol icin rapor alma yetkisi yok.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await fetchRows(selectedReport)
      if (rows.length === 0) {
        setError('Bu filtrede raporlanacak veri bulunmuyor.')
        setLoading(false)
        return
      }
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const headerCell = XLSX.utils.encode_cell({ r: 0, c: col })
        if (worksheet[headerCell]) {
          worksheet[headerCell].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1D4ED8' } }, alignment: { horizontal: 'center' } }
        }
      }
      worksheet['!cols'] = Object.keys(rows[0]).map((key) => ({ wch: Math.max(key.length + 2, 16) }))
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, reportSheetName(selectedReport))
      XLSX.writeFile(workbook, `ETM_${selectedReport}_${safeName(reportSummary.projectName)}.xlsx`)
    } catch (err: any) {
      setError(err.message || 'Rapor olusturulamadi.')
    }
    setLoading(false)
  }

  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Raporlar & Analiz</h2>
          <p className="text-slate-400 text-sm">İşlem yapmak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex gap-6">
          <button onClick={() => setSirket('ETM')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">E</div>
             <h3 className="text-xl font-bold text-slate-100">ETM A.Ş.</h3>
             <p className="mt-2 text-xs text-slate-400">Merkez Firma Raporları</p>
          </button>
          <button onClick={() => setSirket('BİNYAPI')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">B</div>
             <h3 className="text-xl font-bold text-slate-100">BİNYAPI</h3>
             <p className="mt-2 text-xs text-slate-400">Binyapı Firma Raporları</p>
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
        <MetricCard label="Hazir Rapor" value="6" />
        <MetricCard label="Format" value="XLSX" />
        <MetricCard label="Secili Proje" value={reportSummary.projectName} />
        <MetricCard label="Cikti" value={reportLabel(selectedReport)} />
      </div>
      <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400/80">Veri Analizi</p><h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Merkezi Disa Aktarim ve Raporlama</h3></div>
          <button type="button" onClick={downloadExcel} disabled={loading || !can(role, 'report')} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><Download size={16} />{loading ? 'Hazirlaniyor...' : 'Excel indir'}</button>
        </div>
        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/[0.05] bg-white/[0.01] shadow-inner p-5"><p className="text-sm font-semibold text-white">Analiz Kapsami Secimi</p><div className="mt-4 grid gap-3"><select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedReport} onChange={(e) => setSelectedReport(e.target.value as ReportType)}>{reportOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}><option value="">Tum projeler</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.ad}</option>)}</select></div></div>
          <div className="rounded-3xl border border-white/[0.05] bg-white/[0.01] shadow-inner p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">Rapor Konfigurasyonu</p><FileSpreadsheet size={16} className="text-slate-500" /></div><div className="mt-4 space-y-3 text-sm text-slate-400"><p>Hedef veri kumesi: <span className="font-bold text-slate-200">{reportLabel(selectedReport)}</span></p><p>Aktif filtreleme: <span className="font-bold text-slate-200">{reportSummary.projectName}</span></p><p className="text-xs leading-relaxed">Uretilen dokuman, sistemin guncel tablolari uzerinden yapiya ozel sutun siralamasi ve veri tipi formatlariyla entegre bir Excel kitabi (XLSX) olarak hazirlanir.</p></div></div>
        </div>
      </div>
    </div>
  )
}

function projectLabel(projectId: string | null | undefined, projects: ProjectRecord[]) { return projects.find((project) => project.id === projectId)?.ad || 'Genel' }
function reportLabel(type: ReportType) { return reportOptions.find((item) => item.value === type)?.label || type }
function reportSheetName(type: ReportType) { return reportLabel(type).slice(0, 31) }
function safeName(value: string) { return value.replace(/[^a-zA-Z0-9_-]/g, '_') }
function MetricCard({ label, value }: { label: string; value: string }) { return <div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><p className="mt-3 text-2xl font-semibold text-sky-300">{value}</p></div> }
