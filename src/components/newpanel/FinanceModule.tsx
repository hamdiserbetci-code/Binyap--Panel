'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Plus, Receipt, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

type FinanceTab = 'gelir' | 'gider'

interface IncomeRecord {
  id: string
  proje_id: string
  kayit_turu: string
  evrak_no: string | null
  cari_unvan: string | null
  tarih: string
  vade_tarihi: string | null
  tutar: number
  kdv_tutari?: number | null
  stopaj_tutari?: number | null
  sirket?: string | null
  tahsilat_durumu: string
  aciklama: string | null
}

interface ExpenseRecord {
  id: string
  proje_id: string
  kategori: string
  tedarikci: string | null
  belge_no: string | null
  tarih: string
  vade_tarihi: string | null
  tutar: number
  kdv_tutari?: number | null
  stopaj_tutari?: number | null
  sirket?: string | null
  odeme_durumu: string
  aciklama: string | null
}

interface CariHesap {
  id: string
  ad: string
  sirket: string
}

interface Props {
  firma: FirmaRecord
  role?: string | null
}

const incomeFormInitial = { proje_id: '', sirket: 'ETM', kayit_turu: 'hakedis', evrak_no: '', cari_unvan: '', tarih: '', vade_tarihi: '', tutar: '', kdv_tutari: '', stopaj_tutari: '', tahsilat_durumu: 'bekleniyor', aciklama: '' }
const expenseFormInitial = { proje_id: '', sirket: 'ETM', kategori: 'malzeme', tedarikci: '', belge_no: '', tarih: '', vade_tarihi: '', tutar: '', kdv_tutari: '', stopaj_tutari: '', odeme_durumu: 'bekleniyor', aciklama: '' }

export default function FinanceModule({ firma, role }: Props) {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [cariHesaplar, setCariHesaplar] = useState<CariHesap[]>([])
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([])
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('ETM')
  const [selectedCari, setSelectedCari] = useState('')
  const [activeTab, setActiveTab] = useState<FinanceTab>('gelir')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [incomeModal, setIncomeModal] = useState(false)
  const [expenseModal, setExpenseModal] = useState(false)
  const [editingIncome, setEditingIncome] = useState<IncomeRecord | null>(null)
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null)
  const [incomeForm, setIncomeForm] = useState(incomeFormInitial)
  const [expenseForm, setExpenseForm] = useState(expenseFormInitial)

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
    if (error) {
      setError(error.message)
      return
    }
    setProjects((data as ProjectRecord[]) || [])
  }, [firma.id])

  const fetchCariHesaplar = useCallback(async () => {
    const { data } = await supabase.from('cari_hesaplar').select('id, ad, sirket').eq('firma_id', firma.id).order('ad')
    setCariHesaplar((data as CariHesap[]) || [])
  }, [firma.id])

  const fetchFinanceData = useCallback(async () => {
    setLoading(true)
    setError('')
    let incomeQuery = supabase.from('gelir_kayitlari').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false })
    let expenseQuery = supabase.from('gider_kayitlari').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false })
    if (selectedProjectId) {
      incomeQuery = incomeQuery.eq('proje_id', selectedProjectId)
      expenseQuery = expenseQuery.eq('proje_id', selectedProjectId)
    }
    if (selectedCompany) {
      if (selectedCompany === 'ETM') {
        incomeQuery = incomeQuery.or('sirket.eq.ETM,sirket.is.null')
        expenseQuery = expenseQuery.or('sirket.eq.ETM,sirket.is.null')
      } else {
        incomeQuery = incomeQuery.eq('sirket', selectedCompany)
        expenseQuery = expenseQuery.eq('sirket', selectedCompany)
      }
    }
    const [incomeRes, expenseRes] = await Promise.all([incomeQuery, expenseQuery])
    if (incomeRes.error || expenseRes.error) {
      setError(incomeRes.error?.message || expenseRes.error?.message || 'Finans verileri yuklenemedi.')
      setIncomeRecords([])
      setExpenseRecords([])
      setLoading(false)
      return
    }
    setIncomeRecords((incomeRes.data as IncomeRecord[]) || [])
    setExpenseRecords((expenseRes.data as ExpenseRecord[]) || [])
    setLoading(false)
  }, [firma.id, selectedProjectId, selectedCompany])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchCariHesaplar() }, [fetchCariHesaplar])
  useEffect(() => { fetchFinanceData() }, [fetchFinanceData])

  function openIncomeModal(record?: IncomeRecord) {
    if (!can(role, 'edit')) return
    setEditingIncome(record || null)
    setIncomeForm(record ? { proje_id: record.proje_id, sirket: record.sirket || 'ETM', kayit_turu: record.kayit_turu, evrak_no: record.evrak_no || '', cari_unvan: record.cari_unvan || '', tarih: record.tarih || '', vade_tarihi: record.vade_tarihi || '', tutar: String(record.tutar || ''), kdv_tutari: record.kdv_tutari != null ? String(record.kdv_tutari) : '', stopaj_tutari: record.stopaj_tutari != null ? String(record.stopaj_tutari) : '', tahsilat_durumu: record.tahsilat_durumu || 'bekleniyor', aciklama: record.aciklama || '' } : { ...incomeFormInitial, proje_id: selectedProjectId })
    setIncomeModal(true)
  }

  function openExpenseModal(record?: ExpenseRecord) {
    if (!can(role, 'edit')) return
    setEditingExpense(record || null)
    setExpenseForm(record ? { proje_id: record.proje_id, sirket: record.sirket || 'ETM', kategori: record.kategori, tedarikci: record.tedarikci || '', belge_no: record.belge_no || '', tarih: record.tarih || '', vade_tarihi: record.vade_tarihi || '', tutar: String(record.tutar || ''), kdv_tutari: record.kdv_tutari != null ? String(record.kdv_tutari) : '', stopaj_tutari: record.stopaj_tutari != null ? String(record.stopaj_tutari) : '', odeme_durumu: record.odeme_durumu || 'bekleniyor', aciklama: record.aciklama || '' } : { ...expenseFormInitial, proje_id: selectedProjectId })
    setExpenseModal(true)
  }

  async function saveIncome() {
    if (!can(role, 'edit')) return
    if (!incomeForm.proje_id || !incomeForm.tarih || !incomeForm.tutar) {
      setError('Gelir kaydi icin proje, tarih ve tutar zorunludur.')
      return
    }
    const payload: any = { firma_id: firma.id, proje_id: incomeForm.proje_id, sirket: incomeForm.sirket, kayit_turu: incomeForm.kayit_turu, evrak_no: incomeForm.evrak_no || null, cari_unvan: incomeForm.cari_unvan || null, tarih: incomeForm.tarih, vade_tarihi: incomeForm.vade_tarihi || null, tutar: Number(incomeForm.tutar), kdv_tutari: incomeForm.kdv_tutari ? Number(incomeForm.kdv_tutari) : 0, stopaj_tutari: incomeForm.stopaj_tutari ? Number(incomeForm.stopaj_tutari) : 0, tahsilat_durumu: incomeForm.tahsilat_durumu, aciklama: incomeForm.aciklama || null }
    
    let response = editingIncome ? await supabase.from('gelir_kayitlari').update(payload).eq('id', editingIncome.id) : await supabase.from('gelir_kayitlari').insert(payload)
    
    if (response.error && (response.error.message.includes('kdv_tutari') || response.error.message.includes('sirket') || response.error.message.includes('stopaj_tutari'))) {
      delete payload.kdv_tutari
      delete payload.sirket
      delete payload.stopaj_tutari
      response = editingIncome ? await supabase.from('gelir_kayitlari').update(payload).eq('id', editingIncome.id) : await supabase.from('gelir_kayitlari').insert(payload)
      
      if (response.error) {
        setError(response.error.message); return
      }
      alert('Veritabaninda "kdv_tutari", "stopaj_tutari" veya "sirket" sutunlari eksik. Lutfen SQL komutunu calistirin. Kayit bu alanlar haric eklendi.')
    } else if (response.error) {
      setError(response.error.message); return
    }

    setIncomeModal(false)
    fetchFinanceData()
  }

  async function saveExpense() {
    if (!can(role, 'edit')) return
    if (!expenseForm.proje_id || !expenseForm.tarih || !expenseForm.tutar) {
      setError('Gider kaydi icin proje, tarih ve tutar zorunludur.')
      return
    }
    
    const payload: any = { firma_id: firma.id, proje_id: expenseForm.proje_id, sirket: expenseForm.sirket, kategori: expenseForm.kategori, tedarikci: expenseForm.tedarikci || null, belge_no: expenseForm.belge_no || null, tarih: expenseForm.tarih, vade_tarihi: expenseForm.vade_tarihi || null, tutar: Number(expenseForm.tutar), kdv_tutari: expenseForm.kdv_tutari ? Number(expenseForm.kdv_tutari) : 0, stopaj_tutari: expenseForm.stopaj_tutari ? Number(expenseForm.stopaj_tutari) : 0, odeme_durumu: expenseForm.odeme_durumu, aciklama: expenseForm.aciklama || null }
    
    let response = editingExpense ? await supabase.from('gider_kayitlari').update(payload).eq('id', editingExpense.id) : await supabase.from('gider_kayitlari').insert(payload)
    
    if (response.error && (response.error.message.includes('kdv_tutari') || response.error.message.includes('sirket') || response.error.message.includes('stopaj_tutari'))) {
      delete payload.kdv_tutari
      delete payload.sirket
      delete payload.stopaj_tutari
      response = editingExpense ? await supabase.from('gider_kayitlari').update(payload).eq('id', editingExpense.id) : await supabase.from('gider_kayitlari').insert(payload)
      
      if (response.error) {
        setError(response.error.message); return
      }
      alert('Veritabaninda "kdv_tutari", "stopaj_tutari" veya "sirket" sutunlari eksik. Lutfen SQL komutunu calistirin. Kayit bu alanlar haric eklendi.')
    } else if (response.error) {
      setError(response.error.message); return
    }
    
    setExpenseModal(false)
    fetchFinanceData()
  }

  async function deleteIncome(id: string) {
    if (!can(role, 'delete')) return
    if (!confirm('Bu gelir kaydini silmek istediginize emin misiniz?')) return
    const { error } = await supabase.from('gelir_kayitlari').delete().eq('id', id)
    if (error) { setError(error.message); return }
    fetchFinanceData()
  }

  async function deleteExpense(id: string) {
    if (!can(role, 'delete')) return
    if (!confirm('Bu gider kaydini silmek istediginize emin misiniz?')) return
    const { error } = await supabase.from('gider_kayitlari').delete().eq('id', id)
    if (error) { setError(error.message); return }
    fetchFinanceData()
  }

  const projectName = (id: string) => projects.find((project) => project.id === id)?.ad || 'Bagli proje'
  const formatMoney = (value: number) => value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
  const filteredCari = useMemo(() => cariHesaplar.filter(c => !incomeForm.sirket || c.sirket === incomeForm.sirket), [cariHesaplar, incomeForm.sirket])
  const filteredCariExp = useMemo(() => cariHesaplar.filter(c => !expenseForm.sirket || c.sirket === expenseForm.sirket), [cariHesaplar, expenseForm.sirket])
  const cariForFilter = useMemo(() => cariHesaplar.filter(c => !selectedCompany || c.sirket === selectedCompany), [cariHesaplar, selectedCompany])
  const displayedIncome = useMemo(() =>
    selectedCari ? incomeRecords.filter(r => (r.cari_unvan || '') === selectedCari) : incomeRecords,
    [incomeRecords, selectedCari])
  const displayedExpense = useMemo(() =>
    selectedCari ? expenseRecords.filter(r => (r.tedarikci || '') === selectedCari) : expenseRecords,
    [expenseRecords, selectedCari])
  const visibleRecords = activeTab === 'gelir' ? displayedIncome : displayedExpense

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[0.28em] text-slate-500">Finansal Operasyonlar</p><h3 className="mt-2 text-2xl font-semibold">Gelir ve Gider Kayitlari</h3></div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none" value={selectedCompany} onChange={(e) => { setSelectedCompany(e.target.value); setSelectedCari('') }}><option value="ETM">ETM</option><option value="BİNYAPI">BİNYAPI</option></select>
            <select className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}><option value="">Tum projeler</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.ad}</option>)}</select>
            <select className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none" value={selectedCari} onChange={(e) => setSelectedCari(e.target.value)}>
              <option value="">Tüm cari hesaplar</option>
              {cariForFilter.map(c => <option key={c.id} value={c.ad}>{c.ad}</option>)}
            </select>
            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>
            <button type="button" onClick={() => setActiveTab('gelir')} className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeTab === 'gelir' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Gelir</button>
            <button type="button" onClick={() => setActiveTab('gider')} className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeTab === 'gider' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Gider</button>
            <button type="button" onClick={() => (activeTab === 'gelir' ? openIncomeModal() : openExpenseModal())} disabled={!can(role, 'edit')} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} />{activeTab === 'gelir' ? 'Gelir ekle' : 'Gider ekle'}</button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">Finans kayitlari yukleniyor...</div>
        ) : visibleRecords.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center"><Receipt size={28} className="mx-auto text-slate-400" /><p className="mt-3 text-sm text-slate-600">Bu filtrede kayit bulunmuyor.</p></div>
        ) : (
          <div className="mt-6 space-y-3">
            {activeTab === 'gelir'
              ? displayedIncome.map((record) => (
                  <FinanceRow key={record.id}
                    cari={record.cari_unvan || ''}
                    subtitle={`${projectName(record.proje_id)} • ${record.tarih}${record.evrak_no ? ` • No: ${record.evrak_no}` : ''} • ${record.kayit_turu === 'hakedis' ? 'Hakediş' : 'Diğer'}`}
                    amount={formatMoney(Number(record.tutar || 0))}
                    status={record.tahsilat_durumu}
                    icon={<ArrowUpRight size={16} className="text-emerald-600" />}
                    onEdit={() => openIncomeModal(record)} onDelete={() => deleteIncome(record.id)}
                    canEdit={can(role, 'edit')} canDelete={can(role, 'delete')} companyBadge={record.sirket} />
                ))
              : displayedExpense.map((record) => (
                  <FinanceRow key={record.id}
                    cari={record.tedarikci || ''}
                    subtitle={`${projectName(record.proje_id)} • ${record.tarih}${record.belge_no ? ` • No: ${record.belge_no}` : ''} • ${record.kategori}`}
                    amount={formatMoney(Number(record.tutar || 0))}
                    status={record.odeme_durumu}
                    icon={<ArrowDownRight size={16} className="text-rose-600" />}
                    onEdit={() => openExpenseModal(record)} onDelete={() => deleteExpense(record.id)}
                    canEdit={can(role, 'edit')} canDelete={can(role, 'delete')} companyBadge={record.sirket} />
                ))
            }
          </div>
        )}
      </div>

      {incomeModal && can(role, 'edit') && (
        <Modal title={editingIncome ? 'Gelir kaydini duzenle' : 'Yeni gelir kaydi'} onClose={() => setIncomeModal(false)} footer={<><button className={btnSecondary} onClick={() => setIncomeModal(false)}>Iptal</button><button className={btnPrimary} onClick={saveIncome}>Kaydet</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Sirket / Marka" required><select className={inputCls} value={incomeForm.sirket} onChange={(e) => setIncomeForm({ ...incomeForm, sirket: e.target.value })}><option value="ETM" className="bg-slate-900 text-white">ETM</option><option value="BİNYAPI" className="bg-slate-900 text-white">BİNYAPI</option></select></FormField>
              <FormField label="Proje" required><select className={inputCls} value={incomeForm.proje_id} onChange={(e) => setIncomeForm({ ...incomeForm, proje_id: e.target.value })}><option value="">Proje secin</option>{projects.map((project) => <option key={project.id} value={project.id} className="bg-slate-900 text-white">{project.ad}</option>)}</select></FormField>
              <FormField label="Kayit Turu"><select className={inputCls} value={incomeForm.kayit_turu} onChange={(e) => setIncomeForm({ ...incomeForm, kayit_turu: e.target.value })}><option value="hakedis" className="bg-slate-900 text-white">Hakedisler</option><option value="diger" className="bg-slate-900 text-white">Diğer</option></select></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Tutar (Net)" required>
                <input type="number" step="0.01" className={inputCls} value={incomeForm.tutar} onChange={(e) => setIncomeForm({ ...incomeForm, tutar: e.target.value })} />
              </FormField>
              <FormField label="KDV Tutari">
                <div className="flex flex-col gap-2">
                  <input type="number" step="0.01" className={inputCls} value={incomeForm.kdv_tutari} onChange={(e) => setIncomeForm({ ...incomeForm, kdv_tutari: e.target.value })} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIncomeForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20 * 0.6).toFixed(2) }))} className="flex-1 text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors">4/10 Tevk.</button>
                    <button type="button" onClick={() => setIncomeForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20).toFixed(2) }))} className="flex-1 text-[11px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors">%20 KDV</button>
                  </div>
                </div>
              </FormField>
              <FormField label="Stopaj Tutari">
                <div className="flex flex-col gap-2">
                  <input type="number" step="0.01" className={inputCls} value={incomeForm.stopaj_tutari} onChange={(e) => setIncomeForm({ ...incomeForm, stopaj_tutari: e.target.value })} />
                  <button type="button" onClick={() => setIncomeForm(f => ({ ...f, stopaj_tutari: (Number(f.tutar || 0) * 0.05).toFixed(2) }))} className="w-full text-[11px] font-medium bg-rose-500/10 border border-rose-500/20 text-rose-300 py-1.5 rounded-lg hover:bg-rose-500/20 transition-colors">%5 Stopaj</button>
                </div>
              </FormField>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-200/70">Genel Toplam (Tahsil Edilecek)</span>
              <span className="text-lg font-bold text-emerald-400">{formatMoney(Number(incomeForm.tutar || 0) + Number(incomeForm.kdv_tutari || 0) - Number(incomeForm.stopaj_tutari || 0))}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Tarih" required><input type="date" className={inputCls} value={incomeForm.tarih} onChange={(e) => setIncomeForm({ ...incomeForm, tarih: e.target.value })} /></FormField>
              <FormField label="Vade"><input type="date" className={inputCls} value={incomeForm.vade_tarihi} onChange={(e) => setIncomeForm({ ...incomeForm, vade_tarihi: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Cari Hesap">
                <select className={inputCls} value={incomeForm.cari_unvan} onChange={(e) => setIncomeForm({ ...incomeForm, cari_unvan: e.target.value })}>
                  <option value="" className="bg-slate-900 text-white">-- Seçin --</option>
                  {filteredCari.map(c => <option key={c.id} value={c.ad} className="bg-slate-900 text-white">{c.ad}</option>)}
                  <option value={incomeForm.cari_unvan && !filteredCari.some(c => c.ad === incomeForm.cari_unvan) ? incomeForm.cari_unvan : '__other__'} className="bg-slate-900 text-slate-400">Diğer (manuel)...</option>
                </select>
                {incomeForm.cari_unvan === '__other__' || (incomeForm.cari_unvan && !filteredCari.some(c => c.ad === incomeForm.cari_unvan)) ? (
                  <input className={inputCls + ' mt-2'} placeholder="Cari unvan yazın..." value={incomeForm.cari_unvan === '__other__' ? '' : incomeForm.cari_unvan} onChange={(e) => setIncomeForm({ ...incomeForm, cari_unvan: e.target.value })} />
                ) : null}
              </FormField>
              <FormField label="Evrak No"><input className={inputCls} value={incomeForm.evrak_no} onChange={(e) => setIncomeForm({ ...incomeForm, evrak_no: e.target.value })} /></FormField>
            </div>
            <FormField label="Tahsilat Durumu"><select className={inputCls} value={incomeForm.tahsilat_durumu} onChange={(e) => setIncomeForm({ ...incomeForm, tahsilat_durumu: e.target.value })}><option value="bekleniyor" className="bg-slate-900 text-white">Bekleniyor</option><option value="kismi" className="bg-slate-900 text-white">Kismi</option><option value="tahsil_edildi" className="bg-slate-900 text-white">Tahsil edildi</option></select></FormField>
            <FormField label="Aciklama"><textarea className={inputCls} rows={3} value={incomeForm.aciklama} onChange={(e) => setIncomeForm({ ...incomeForm, aciklama: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}

      {expenseModal && can(role, 'edit') && (
        <Modal title={editingExpense ? 'Gider kaydini duzenle' : 'Yeni gider kaydi'} onClose={() => setExpenseModal(false)} footer={<><button className={btnSecondary} onClick={() => setExpenseModal(false)}>Iptal</button><button className={btnPrimary} onClick={saveExpense}>Kaydet</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Sirket / Marka" required><select className={inputCls} value={expenseForm.sirket} onChange={(e) => setExpenseForm({ ...expenseForm, sirket: e.target.value })}><option value="ETM" className="bg-slate-900 text-white">ETM</option><option value="BİNYAPI" className="bg-slate-900 text-white">BİNYAPI</option></select></FormField>
              <FormField label="Proje" required><select className={inputCls} value={expenseForm.proje_id} onChange={(e) => setExpenseForm({ ...expenseForm, proje_id: e.target.value })}><option value="">Proje secin</option>{projects.map((project) => <option key={project.id} value={project.id} className="bg-slate-900 text-white">{project.ad}</option>)}</select></FormField>
              <FormField label="Kategori"><select className={inputCls} value={expenseForm.kategori} onChange={(e) => setExpenseForm({ ...expenseForm, kategori: e.target.value })}><option value="malzeme" className="bg-slate-900 text-white">Malzeme</option><option value="iscilik" className="bg-slate-900 text-white">Iscilik</option><option value="nakliye" className="bg-slate-900 text-white">Nakliye</option><option value="genel_gider" className="bg-slate-900 text-white">Genel gider</option></select></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Tutar (Net)" required>
                <input type="number" step="0.01" className={inputCls} value={expenseForm.tutar} onChange={(e) => setExpenseForm({ ...expenseForm, tutar: e.target.value })} />
              </FormField>
              <FormField label="KDV Tutari">
                <div className="flex flex-col gap-2">
                  <input type="number" step="0.01" className={inputCls} value={expenseForm.kdv_tutari} onChange={(e) => setExpenseForm({ ...expenseForm, kdv_tutari: e.target.value })} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setExpenseForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20 * 0.6).toFixed(2) }))} className="flex-1 text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors">4/10 Tevk.</button>
                    <button type="button" onClick={() => setExpenseForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20).toFixed(2) }))} className="flex-1 text-[11px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors">%20 KDV</button>
                  </div>
                </div>
              </FormField>
              <FormField label="Stopaj Tutari">
                <div className="flex flex-col gap-2">
                  <input type="number" step="0.01" className={inputCls} value={expenseForm.stopaj_tutari} onChange={(e) => setExpenseForm({ ...expenseForm, stopaj_tutari: e.target.value })} />
                  <button type="button" onClick={() => setExpenseForm(f => ({ ...f, stopaj_tutari: (Number(f.tutar || 0) * 0.05).toFixed(2) }))} className="w-full text-[11px] font-medium bg-rose-500/10 border border-rose-500/20 text-rose-300 py-1.5 rounded-lg hover:bg-rose-500/20 transition-colors">%5 Stopaj</button>
                </div>
              </FormField>
            </div>
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-rose-200/70">Genel Toplam (Odenecek)</span>
              <span className="text-lg font-bold text-rose-400">{formatMoney(Number(expenseForm.tutar || 0) + Number(expenseForm.kdv_tutari || 0) - Number(expenseForm.stopaj_tutari || 0))}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Tarih" required><input type="date" className={inputCls} value={expenseForm.tarih} onChange={(e) => setExpenseForm({ ...expenseForm, tarih: e.target.value })} /></FormField>
              <FormField label="Vade"><input type="date" className={inputCls} value={expenseForm.vade_tarihi} onChange={(e) => setExpenseForm({ ...expenseForm, vade_tarihi: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Cari Hesap / Tedarikci">
                <select className={inputCls} value={expenseForm.tedarikci} onChange={(e) => setExpenseForm({ ...expenseForm, tedarikci: e.target.value })}>
                  <option value="" className="bg-slate-900 text-white">-- Seçin --</option>
                  {filteredCariExp.map(c => <option key={c.id} value={c.ad} className="bg-slate-900 text-white">{c.ad}</option>)}
                  <option value={expenseForm.tedarikci && !filteredCariExp.some(c => c.ad === expenseForm.tedarikci) ? expenseForm.tedarikci : '__other__'} className="bg-slate-900 text-slate-400">Diğer (manuel)...</option>
                </select>
                {expenseForm.tedarikci === '__other__' || (expenseForm.tedarikci && !filteredCariExp.some(c => c.ad === expenseForm.tedarikci)) ? (
                  <input className={inputCls + ' mt-2'} placeholder="Tedarikci adı yazın..." value={expenseForm.tedarikci === '__other__' ? '' : expenseForm.tedarikci} onChange={(e) => setExpenseForm({ ...expenseForm, tedarikci: e.target.value })} />
                ) : null}
              </FormField>
              <FormField label="Belge No"><input className={inputCls} value={expenseForm.belge_no} onChange={(e) => setExpenseForm({ ...expenseForm, belge_no: e.target.value })} /></FormField>
            </div>
            <FormField label="Odeme Durumu"><select className={inputCls} value={expenseForm.odeme_durumu} onChange={(e) => setExpenseForm({ ...expenseForm, odeme_durumu: e.target.value })}><option value="bekleniyor" className="bg-slate-900 text-white">Bekleniyor</option><option value="kismi" className="bg-slate-900 text-white">Kismi</option><option value="odendi" className="bg-slate-900 text-white">Odendi</option></select></FormField>
            <FormField label="Aciklama"><textarea className={inputCls} rows={3} value={expenseForm.aciklama} onChange={(e) => setExpenseForm({ ...expenseForm, aciklama: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

function FinanceRow({ cari, subtitle, amount, status, icon, onEdit, onDelete, canEdit, canDelete, companyBadge }: { cari: string; subtitle: string; amount: string; status: string; icon: ReactNode; onEdit: () => void; onDelete: () => void; canEdit: boolean; canDelete: boolean; companyBadge?: string | null }) {
  const cariLabel = cari && cari !== '—' ? cari : null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {cariLabel
              ? <p className="text-sm font-semibold text-slate-900">{cariLabel}</p>
              : <p className="text-sm font-medium text-slate-400 italic">Cari belirtilmemiş</p>
            }
            {companyBadge && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${companyBadge === 'ETM' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>{companyBadge}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">{amount}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{status}</p>
        </div>
        {canEdit && <button type="button" onClick={onEdit} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">Duzenle</button>}
        {canDelete && <button type="button" onClick={onDelete} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-rose-700"><Trash2 size={14} />Sil</button>}
      </div>
    </div>
  )
}
