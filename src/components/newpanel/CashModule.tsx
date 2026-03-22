'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

interface CashRecord { id: string; proje_id: string | null; hareket_turu: string; kanal: string; bagli_tablo: string | null; bagli_kayit_id: string | null; tarih: string; tutar: number; aciklama: string | null; fis_no: string | null }
interface Props { firma: FirmaRecord; role?: string | null }

const formInitial = { proje_id: '', hareket_turu: 'giris', kanal: 'kasa', bagli_tablo: '', bagli_kayit_id: '', tarih: '', tutar: '', fis_no: '', aciklama: '' }

export default function CashModule({ firma, role }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [cashRecords, setCashRecords] = useState<CashRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(formInitial)

  const fetchProjects = useCallback(async () => { const { data, error } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad'); if (error) { setError(error.message); return }; setProjects((data as ProjectRecord[]) || []) }, [firma.id])
  const fetchCashRecords = useCallback(async () => { setLoading(true); let query = supabase.from('kasa_hareketleri').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }); if (selectedProjectId) query = query.eq('proje_id', selectedProjectId); const { data, error } = await query; if (error) { setError(error.message); setCashRecords([]); setLoading(false); return }; setCashRecords((data as CashRecord[]) || []); setLoading(false) }, [firma.id, selectedProjectId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchCashRecords() }, [fetchCashRecords])

  const totals = useMemo(() => { const entries = cashRecords.filter((item) => item.hareket_turu === 'giris').reduce((sum, item) => sum + Number(item.tutar || 0), 0); const exits = cashRecords.filter((item) => item.hareket_turu === 'cikis').reduce((sum, item) => sum + Number(item.tutar || 0), 0); return { entries, exits, balance: entries - exits } }, [cashRecords])
  function openModal() { if (!can(role, 'edit')) return; setForm({ ...formInitial, proje_id: selectedProjectId }); setModalOpen(true) }

  async function saveCashRecord() {
    if (!can(role, 'edit')) return
    if (!form.tarih || !form.tutar) { setError('Tarih ve tutar zorunludur.'); return }
    const { error } = await supabase.from('kasa_hareketleri').insert({ firma_id: firma.id, proje_id: form.proje_id || null, hareket_turu: form.hareket_turu, kanal: form.kanal, bagli_tablo: form.bagli_kayit_id ? form.bagli_tablo : null, bagli_kayit_id: form.bagli_kayit_id || null, tarih: form.tarih, tutar: Number(form.tutar), aciklama: form.aciklama || null, fis_no: form.fis_no || null })
    if (error) { setError(error.message); return }
    await logActivity({ firmaId: firma.id, modul: 'kasa', islemTuru: 'hareket_olusturuldu', kayitTuru: 'kasa_hareketi', aciklama: form.kanal + ' icin ' + form.hareket_turu + ' hareketi olusturuldu.', meta: { projeId: form.proje_id || null, tutar: form.tutar, bagliKayitId: form.bagli_kayit_id || null } }); setModalOpen(false); fetchCashRecords()
  }

  async function deleteCashRecord(id: string) {
    if (!can(role, 'delete')) return
    if (!confirm('Bu kasa hareketini silmek istediginize emin misiniz?')) return
    const { error } = await supabase.from('kasa_hareketleri').delete().eq('id', id)
    if (error) { setError(error.message); return }
    await logActivity({ firmaId: firma.id, modul: 'kasa', islemTuru: 'hareket_silindi', kayitTuru: 'kasa_hareketi', kayitId: id, aciklama: id + ' kasa hareketi silindi.' }); fetchCashRecords()
  }

  const projectName = (id?: string | null) => projects.find((project) => project.id === id)?.ad || 'Genel'
  const money = (value: number) => value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Kasa Giris" value={money(totals.entries)} tone="emerald" icon={<ArrowUpCircle size={18} />} />
        <StatCard label="Kasa Cikis" value={money(totals.exits)} tone="rose" icon={<ArrowDownCircle size={18} />} />
        <StatCard label="Net Bakiye" value={money(totals.balance)} tone={totals.balance >= 0 ? 'sky' : 'amber'} icon={<Wallet size={18} />} />
        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Filtre</p>
          <select className="mt-3 w-full rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-slate-200 outline-none" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
            <option value="">Tum projeler</option>
            {projects.map((project) => <option key={project.id} value={project.id} className="text-slate-900">{project.ad}</option>)}
          </select>
        </div>
      </div>
      
      <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.04] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400/80">Likidite Yonetimi</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Nakit ve Banka Operasyonlari</h3>
            <p className="mt-2 text-sm text-slate-400">Kasa, banka ve avans kanallarindaki anlik finansal hareketlerin takibi.</p>
          </div>
          <button type="button" onClick={openModal} disabled={!can(role, 'edit')} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={16} />Yeni hareket
          </button>
        </div>
        
        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        
        <div className="mt-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] shadow-inner p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-white">Finansal Hareket Dokumu</h4>
              <Wallet size={16} className="text-slate-500" />
            </div>
            <div className="mt-4 space-y-3">
              {loading ? <p className="text-sm text-slate-500">Hareketler yukleniyor...</p> : 
                cashRecords.length === 0 ? 
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/10 p-8 text-center">
                    <Wallet size={28} className="mx-auto text-slate-400" />
                    <p className="mt-3 text-sm text-slate-400">Henuz kasa hareketi yok.</p>
                  </div> : 
                  cashRecords.map((record) => (
                    <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] transition-colors p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-100 uppercase tracking-wide">{record.kanal} • {record.hareket_turu}</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">{projectName(record.proje_id)} • {record.tarih}</p>
                        <p className="mt-1 text-xs text-slate-500">{record.aciklama || 'Aciklama yok'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-200">{money(record.tutar)}</p>
                          <p className="mt-1 text-[11px] font-medium text-slate-500">Fis: {record.fis_no || '-'}</p>
                        </div>
                        {can(role, 'delete') && (
                          <button type="button" onClick={() => deleteCashRecord(record.id)} className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20">
                            <Trash2 size={14} />Sil
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </div>
      
      {modalOpen && can(role, 'edit') && (
        <Modal title="Yeni kasa hareketi" onClose={() => setModalOpen(false)} footer={<><button className={btnSecondary} onClick={() => setModalOpen(false)}>Iptal</button><button className={btnPrimary} onClick={saveCashRecord}>Kaydet</button></>}>
          <div className="space-y-4">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Proje">
                <select className={inputCls} value={form.proje_id} onChange={(e) => setForm({ ...form, proje_id: e.target.value })}>
                  <option value="" className="bg-slate-900 text-white">Genel hareket</option>
                  {projects.map((project) => <option key={project.id} value={project.id} className="bg-slate-900 text-white">{project.ad}</option>)}
                </select>
              </FormField>
              <FormField label="Kanal">
                <select className={inputCls} value={form.kanal} onChange={(e) => setForm({ ...form, kanal: e.target.value })}>
                  <option value="kasa" className="bg-slate-900 text-white">Kasa</option>
                  <option value="banka" className="bg-slate-900 text-white">Banka</option>
                  <option value="avans" className="bg-slate-900 text-white">Avans</option>
                </select>
              </FormField>
              <FormField label="Hareket Turu">
                <select className={inputCls} value={form.hareket_turu} onChange={(e) => setForm({ ...form, hareket_turu: e.target.value })}>
                  <option value="giris" className="bg-slate-900 text-white">Giris</option>
                  <option value="cikis" className="bg-slate-900 text-white">Cikis</option>
                </select>
              </FormField>
            </div>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Tarih" required><input type="date" className={inputCls} value={form.tarih} onChange={(e) => setForm({ ...form, tarih: e.target.value })} /></FormField>
              <FormField label="Tutar" required><input type="number" className={inputCls} value={form.tutar} onChange={(e) => setForm({ ...form, tutar: e.target.value })} /></FormField>
              <FormField label="Fis No"><input className={inputCls} value={form.fis_no} onChange={(e) => setForm({ ...form, fis_no: e.target.value })} /></FormField>
            </div>
            <FormField label="Aciklama"><textarea className={inputCls} rows={3} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

function StatCard({ label, value, tone, icon }: { label: string; value: string; tone: 'emerald' | 'rose' | 'sky' | 'amber'; icon: ReactNode }) {
  const toneClass = { emerald: 'text-emerald-300', rose: 'text-rose-300', sky: 'text-sky-300', amber: 'text-amber-300' }[tone];
  return (
    <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <div className="text-slate-400">{icon}</div>
      </div>
      <p className={`mt-3 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}
