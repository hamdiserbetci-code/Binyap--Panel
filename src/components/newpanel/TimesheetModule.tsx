﻿'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Plus, Trash2, Users, ChevronLeft, Search, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

interface TeamRecord { id: string; proje_id: string | null; ad: string; sorumlu_kisi: string | null }
interface EmployeeRecord { id: string; ekip_id: string; ad_soyad: string }
interface TimesheetRecord { id: string; proje_id: string; ekip_id: string; calisan_id: string | null; tarih: string; durum: string; mesai_saati: number; yevmiye: number; aciklama: string | null }
interface Props { firma: FirmaRecord; role?: string | null }

const teamFormInitial = { proje_id: '', ad: '', sorumlu_kisi: '', calisan_ad_soyad: '' }
const timesheetFormInitial = { proje_id: '', ekip_id: '', calisan_id: '', tarih: '', durum: 'tam_gun', mesai_saati: '', yevmiye: '', aciklama: '' }

function parseMissingColumn(message?: string) {
  const match = (message || '').match(/'([^']+)' column of/i)
  return match?.[1] || null
}

export default function TimesheetModule({ firma, role }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [timesheets, setTimesheets] = useState<TimesheetRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teamModal, setTeamModal] = useState(false)
  const [timesheetModal, setTimesheetModal] = useState(false)
  const [teamForm, setTeamForm] = useState(teamFormInitial)
  const [timesheetForm, setTimesheetForm] = useState(timesheetFormInitial)
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const [arama, setArama] = useState('')
  const [showListMobile, setShowListMobile] = useState(true)

  const fetchProjects = useCallback(async () => {
    if (!sirket) return;
    const { data, error } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad');
    if (error) { setError(error.message); return };
    const all = (data as any[]) || [];
    setProjects(all.filter(p => sirket === 'ETM' ? (!p.sirket || p.sirket === 'ETM') : p.sirket === sirket) as ProjectRecord[])
  }, [firma.id, sirket])
  
  const fetchTeams = useCallback(async () => {
    if (!sirket) return;
    let query = supabase.from('ekipler').select('*').eq('firma_id', firma.id).order('created_at', { ascending: false });
    if (selectedProjectId) query = query.eq('proje_id', selectedProjectId);
    const { data, error } = await query;
    if (error) { setError(error.message); return };
    const all = (data as any[]) || [];
    setTeams(all.filter(t => sirket === 'ETM' ? (!t.sirket || t.sirket === 'ETM') : t.sirket === sirket) as TeamRecord[])
  }, [firma.id, selectedProjectId, sirket])
  
  const fetchEmployees = useCallback(async () => {
    const teamIds = teams.map((team) => team.id);
    if (teamIds.length === 0) { setEmployees([]); return };
    const { data, error } = await supabase.from('ekip_calisanlari').select('*').in('ekip_id', teamIds);
    if (error) { setError(error.message); return };
    setEmployees((data as EmployeeRecord[]) || [])
  }, [teams])
  
  const fetchTimesheets = useCallback(async () => {
    if (!sirket) return;
    setLoading(true);
    let query = supabase.from('puantaj_kayitlari').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false });
    if (selectedProjectId) query = query.eq('proje_id', selectedProjectId);
    const { data, error } = await query;
    if (error) { setError(error.message); setTimesheets([]); setLoading(false); return };
    const all = (data as any[]) || [];
    setTimesheets(all.filter(t => sirket === 'ETM' ? (!t.sirket || t.sirket === 'ETM') : t.sirket === sirket) as TimesheetRecord[]);
    setLoading(false)
  }, [firma.id, selectedProjectId, sirket])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchTeams(); fetchTimesheets() }, [fetchTeams, fetchTimesheets])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  async function saveTeam() {
    if (!can(role, 'edit')) return
    if (!teamForm.proje_id || !teamForm.ad.trim()) { setError('Ekip icin proje ve ekip adi zorunludur.'); return }
    const payload: any = { firma_id: firma.id, sirket: sirket, proje_id: teamForm.proje_id, ad: teamForm.ad, sorumlu_kisi: teamForm.sorumlu_kisi || null, aktif: true }
    let working = { ...payload }; let teamRes;
    while(true) {
      teamRes = await supabase.from('ekipler').insert(working).select().single()
      if (!teamRes.error) break
      const col = parseMissingColumn(teamRes.error.message)
      if (!col || !(col in working) || Object.keys(working).length <= 2) break
      delete working[col]
    }
    if (teamRes.error) { setError(teamRes.error.message); return }
    if (teamForm.calisan_ad_soyad.trim()) {
      const employeeRes = await supabase.from('ekip_calisanlari').insert({ ekip_id: teamRes.data.id, ad_soyad: teamForm.calisan_ad_soyad, aktif: true })
      if (employeeRes.error) { setError(employeeRes.error.message); return }
    }
    await logActivity({ firmaId: firma.id, modul: 'puantaj', islemTuru: 'ekip_olusturuldu', kayitTuru: 'ekip', kayitId: teamRes.data.id, aciklama: teamForm.ad + ' ekip kaydi olusturuldu.', meta: { projeId: teamForm.proje_id, sorumlu: teamForm.sorumlu_kisi || null } });
    setTeamModal(false); setTeamForm({ ...teamFormInitial, proje_id: selectedProjectId }); fetchTeams()
  }

  async function saveTimesheet() {
    if (!can(role, 'edit')) return
    if (!timesheetForm.proje_id || !timesheetForm.ekip_id || !timesheetForm.tarih) { setError('Puantaj icin proje, ekip ve tarih zorunludur.'); return }
    const payload: any = { firma_id: firma.id, sirket: sirket, proje_id: timesheetForm.proje_id, ekip_id: timesheetForm.ekip_id, calisan_id: timesheetForm.calisan_id || null, tarih: timesheetForm.tarih, durum: timesheetForm.durum, mesai_saati: timesheetForm.mesai_saati ? Number(timesheetForm.mesai_saati) : 0, yevmiye: timesheetForm.yevmiye ? Number(timesheetForm.yevmiye) : 0, aciklama: timesheetForm.aciklama || null }
    let working = { ...payload }; let res;
    while(true) {
      res = await supabase.from('puantaj_kayitlari').insert(working)
      if (!res.error) break
      const col = parseMissingColumn(res.error.message)
      if (!col || !(col in working) || Object.keys(working).length <= 2) break
      delete working[col]
    }
    const { error } = res;
    if (error) { setError(error.message); return }
    await logActivity({ firmaId: firma.id, modul: 'puantaj', islemTuru: 'puantaj_olusturuldu', kayitTuru: 'puantaj', aciklama: timesheetForm.tarih + ' tarihli puantaj kaydi olusturuldu.', meta: { projeId: timesheetForm.proje_id, ekipId: timesheetForm.ekip_id, yevmiye: timesheetForm.yevmiye || 0 } });
    setTimesheetModal(false); setTimesheetForm({ ...timesheetFormInitial, proje_id: selectedProjectId }); fetchTimesheets()
  }

  async function deleteTimesheet(id: string) {
    if (!can(role, 'delete')) return
    if (!confirm('Bu puantaj kaydini silmek istediginize emin misiniz?')) return
    const { error } = await supabase.from('puantaj_kayitlari').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await logActivity({ firmaId: firma.id, modul: 'puantaj', islemTuru: 'puantaj_silindi', kayitTuru: 'puantaj', kayitId: id, aciklama: id + ' puantaj kaydi silindi.' }); fetchTimesheets()
  }

  const displayedTimesheets = useMemo(() => {
    if (!selectedProjectId) return timesheets
    return timesheets.filter(t => t.proje_id === selectedProjectId)
  }, [timesheets, selectedProjectId])

  const filteredProjects = useMemo(() => projects.filter(p => p.ad.toLowerCase().includes(arama.toLowerCase())), [projects, arama])

  const totalDaily = useMemo(() => displayedTimesheets.reduce((sum, item) => sum + Number(item.yevmiye || 0), 0), [displayedTimesheets])
  const totalOvertime = useMemo(() => displayedTimesheets.reduce((sum, item) => sum + Number(item.mesai_saati || 0), 0), [displayedTimesheets])
  const teamName = (id: string) => teams.find((team) => team.id === id)?.ad || 'Ekip'
  const employeeName = (id?: string | null) => employees.find((employee) => employee.id === id)?.ad_soyad || 'Genel ekip kaydi'
  const projectName = (id: string) => projects.find((project) => project.id === id)?.ad || 'Proje'
  const employeeOptions = employees.filter((employee) => employee.ekip_id === timesheetForm.ekip_id)

  const selectedProje = projects.find(p => p.id === selectedProjectId)

  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Puantaj ve İK Yönetimi</h2>
          <p className="text-slate-400 text-sm">İşlem yapmak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl px-4">
          <button onClick={() => setSirket('ETM')} className="flex-1 group flex flex-col items-center justify-center py-12 rounded-[32px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">E</div>
             <h3 className="text-xl font-bold text-slate-100">ETM A.Ş.</h3>
             <p className="mt-2 text-xs text-slate-400">Merkez Firma Kadroları</p>
          </button>
          <button onClick={() => setSirket('BİNYAPI')} className="flex-1 group flex flex-col items-center justify-center py-12 rounded-[32px] border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">B</div>
             <h3 className="text-xl font-bold text-slate-100">BİNYAPI</h3>
             <p className="mt-2 text-xs text-slate-400">Binyapı Firma Kadroları</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] md:min-h-[600px]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
      <div className="flex flex-col md:flex-row flex-1 min-h-0 rounded-2xl overflow-hidden" style={{ background: '#0F1419', border: '1px solid rgba(255,255,255,0.07)' }}>
        
        {/* ══ SOL: Proje Listesi ══════════════════════════════════════ */}
        <div className={`${showListMobile ? 'flex' : 'hidden'} md:flex w-full md:w-64 shrink-0 flex-col`} style={{ background: '#111827', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          
          {/* Geri Butonu ve Başlık */}
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => { setSirket(null); setSelectedProjectId('') }} className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors mb-4">
              <ChevronLeft size={14} /> Firmalara Dön
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold">{sirket === 'ETM' ? 'E' : 'B'}</div>
              <div>
                <p className="text-[10px] text-slate-500 leading-tight">Seçili Firma</p>
                <p className="text-sm font-bold text-white leading-tight">{sirket === 'ETM' ? 'ETM A.Ş.' : 'BİNYAPI'}</p>
              </div>
            </div>
          </div>

          {/* Arama */}
          <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#5F6368' }} />
              <input
                className="w-full rounded-lg text-[12px] outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8EAED', paddingLeft: '28px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px' }}
                placeholder="Proje ara..."
                value={arama}
                onChange={e => setArama(e.target.value)}
              />
            </div>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto py-2">
            {/* Tüm Projeler Item */}
            <div onClick={() => { setSelectedProjectId(''); setShowListMobile(false); }}
                 className="group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 mb-0.5"
                 style={selectedProjectId === ''
                   ? { background: 'rgba(91,159,255,0.1)', borderLeft: '2px solid #5B9FFF', paddingLeft: '10px' }
                   : { borderLeft: '2px solid transparent' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium leading-snug transition-colors" style={{ color: selectedProjectId === '' ? '#E8EAED' : '#9AA0A6' }}>Tüm Projeler</p>
              </div>
            </div>

            {filteredProjects.map(p => (
              <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setShowListMobile(false); }}
                   className="group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 mb-0.5"
                   style={p.id === selectedProjectId
                     ? { background: 'rgba(91,159,255,0.1)', borderLeft: '2px solid #5B9FFF', paddingLeft: '10px' }
                     : { borderLeft: '2px solid transparent' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-snug transition-colors truncate" style={{ color: p.id === selectedProjectId ? '#E8EAED' : '#9AA0A6' }}>{p.ad}</p>
                </div>
              </div>
            ))}
          </div>

          {can(role, 'edit') && (
            <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: '#5F6368' }}>Ekip Yönetimi</p>
              <button onClick={() => { setTeamForm({ ...teamFormInitial, proje_id: selectedProjectId }); setTeamModal(true) }}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium transition-all text-left bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
                <Users size={11} /> Yeni Ekip Ekle
              </button>
            </div>
          )}
        </div>

        {/* ══ SAĞ: Detay Paneli ═══════════════════════════════════════ */}
        <div className={`${!showListMobile ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`} style={{ background: '#0F1419' }}>
          
          <div className="px-6 py-4 flex items-start justify-between gap-4 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-start gap-3">
              <button onClick={() => setShowListMobile(true)} className="md:hidden mt-0.5 p-1 text-slate-400 hover:text-white bg-white/5 rounded-lg shrink-0">
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-slate-200">{selectedProje ? selectedProje.ad : 'Tüm Projeler'}</h2>
                <p className="text-[11px] text-slate-500 mt-1">{displayedTimesheets.length} puantaj kaydı bulundu</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-stretch rounded-xl overflow-hidden border border-white/[0.07] bg-[#131B27]">
                <div className="px-4 py-2.5 text-right"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Mesai</p><p className="text-[13px] font-semibold mt-0.5 tabular-nums text-amber-400">{totalOvertime} Saat</p></div>
                <div className="px-4 py-2.5 text-right border-l border-white/[0.06] bg-emerald-500/10"><p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400/80">Toplam Yevmiye</p><p className="text-[13px] font-bold mt-0.5 tabular-nums text-emerald-400">{(totalDaily).toLocaleString('tr-TR')} ₺</p></div>
              </div>
              {can(role, 'edit') && (
                <button onClick={() => { setTimesheetForm({ ...timesheetFormInitial, proje_id: selectedProjectId }); setTimesheetModal(true) }} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-500"><Plus size={13} />Puantaj Ekle</button>
              )}
            </div>
          </div>

          {error && <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12px] bg-rose-500/10 border border-rose-500/20 text-rose-400"><X size={13} className="cursor-pointer opacity-70 hover:opacity-100" onClick={()=>setError('')} />{error}</div>}

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center"><Loader2 size={24} className="animate-spin text-slate-600 mb-3" /></div>
            ) : displayedTimesheets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center"><Clock3 size={28} className="text-slate-600 mb-3" /><p className="text-sm font-medium text-slate-500">Kayıt bulunamadı</p></div>
            ) : (
              <table className="w-full min-w-[700px]">
                <thead className="sticky top-0 z-10 bg-[#0F1419] border-b border-white/[0.07]">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-left w-[100px]">Tarih</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-left">Ekip / Çalışan</th>
                    {!selectedProjectId && <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-left">Proje</th>}
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center w-[100px]">Durum</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right w-[90px]">Mesai</th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right w-[120px]">Yevmiye</th>
                    {can(role, 'edit') && <th className="w-[60px]" />}
                  </tr>
                </thead>
                <tbody>
                  {displayedTimesheets.map((record, i) => (
                    <tr key={record.id} className="group transition-colors border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-[11px] tabular-nums text-slate-400">{record.tarih}</td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-medium text-slate-200">{teamName(record.ekip_id)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{employeeName(record.calisan_id)}</p>
                      </td>
                      {!selectedProjectId && (
                        <td className="px-4 py-3 text-[11px] text-slate-400">{projectName(record.proje_id)}</td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-800 text-slate-300">{record.durum.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] font-semibold text-amber-400">{record.mesai_saati ? `${record.mesai_saati} Saat` : '—'}</td>
                      <td className="px-4 py-3 text-right text-[12px] font-bold text-emerald-400">{(record.yevmiye).toLocaleString('tr-TR')} ₺</td>
                      {can(role, 'edit') && (
                        <td className="px-2 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => deleteTimesheet(record.id)} className="p-1.5 text-slate-500 hover:text-rose-400"><Trash2 size={12} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {teamModal && can(role, 'edit') && (
        <Modal title="Yeni Ekip Oluştur" onClose={() => setTeamModal(false)} footer={<><button className={btnSecondary} onClick={() => setTeamModal(false)}>İptal</button><button className={btnPrimary} onClick={saveTeam}>Kaydet</button></>}>
          <div className="space-y-4">
            <FormField label="Proje" required>
              <select className={inputCls} value={teamForm.proje_id} onChange={(e) => setTeamForm({ ...teamForm, proje_id: e.target.value })}>
                <option value="">Proje seçin</option>
                {projects.map((project) => <option key={project.id} value={project.id} className="text-slate-900">{project.ad}</option>)}
              </select>
            </FormField>
            <FormField label="Ekip Adı" required><input className={inputCls} value={teamForm.ad} onChange={(e) => setTeamForm({ ...teamForm, ad: e.target.value })} /></FormField>
            <FormField label="Sorumlu Kişi"><input className={inputCls} value={teamForm.sorumlu_kisi} onChange={(e) => setTeamForm({ ...teamForm, sorumlu_kisi: e.target.value })} /></FormField>
            <FormField label="İlk Çalışan (Opsiyonel)"><input className={inputCls} value={teamForm.calisan_ad_soyad} onChange={(e) => setTeamForm({ ...teamForm, calisan_ad_soyad: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}

      {timesheetModal && can(role, 'edit') && (
        <Modal title="Yeni Puantaj Kaydı" onClose={() => setTimesheetModal(false)} footer={<><button className={btnSecondary} onClick={() => setTimesheetModal(false)}>İptal</button><button className={btnPrimary} onClick={saveTimesheet}>Kaydet</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Proje" required>
                <select className={inputCls} value={timesheetForm.proje_id} onChange={(e) => setTimesheetForm({ ...timesheetForm, proje_id: e.target.value, ekip_id: '', calisan_id: '' })}>
                  <option value="">Proje seçin</option>
                  {projects.map((project) => <option key={project.id} value={project.id} className="text-slate-900">{project.ad}</option>)}
                </select>
              </FormField>
              <FormField label="Ekip" required>
                <select className={inputCls} value={timesheetForm.ekip_id} onChange={(e) => setTimesheetForm({ ...timesheetForm, ekip_id: e.target.value, calisan_id: '' })}>
                  <option value="">Ekip seçin</option>
                  {teams.filter((team) => !timesheetForm.proje_id || team.proje_id === timesheetForm.proje_id).map((team) => <option key={team.id} value={team.id} className="text-slate-900">{team.ad}</option>)}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Çalışan">
                <select className={inputCls} value={timesheetForm.calisan_id} onChange={(e) => setTimesheetForm({ ...timesheetForm, calisan_id: e.target.value })}>
                  <option value="">Genel ekip kaydı</option>
                  {employeeOptions.map((employee) => <option key={employee.id} value={employee.id} className="text-slate-900">{employee.ad_soyad}</option>)}
                </select>
              </FormField>
              <FormField label="Tarih" required><input type="date" className={inputCls} value={timesheetForm.tarih} onChange={(e) => setTimesheetForm({ ...timesheetForm, tarih: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Durum">
                <select className={inputCls} value={timesheetForm.durum} onChange={(e) => setTimesheetForm({ ...timesheetForm, durum: e.target.value })}>
                  <option value="tam_gun" className="text-slate-900">Tam gün</option>
                  <option value="yarim_gun" className="text-slate-900">Yarım gün</option>
                  <option value="izinli" className="text-slate-900">İzinli</option>
                  <option value="eksik" className="text-slate-900">Eksik</option>
                </select>
              </FormField>
              <FormField label="Mesai Saati"><input type="number" className={inputCls} value={timesheetForm.mesai_saati} onChange={(e) => setTimesheetForm({ ...timesheetForm, mesai_saati: e.target.value })} /></FormField>
              <FormField label="Yevmiye"><input type="number" className={inputCls} value={timesheetForm.yevmiye} onChange={(e) => setTimesheetForm({ ...timesheetForm, yevmiye: e.target.value })} /></FormField>
            </div>
            <FormField label="Açıklama"><textarea className={inputCls} rows={3} value={timesheetForm.aciklama} onChange={(e) => setTimesheetForm({ ...timesheetForm, aciklama: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
