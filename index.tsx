'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Receipt, BookOpen, Plus, Pencil, Trash2, CheckCircle2, Clock, CheckCheck, Send, BadgeCheck,
  ArrowRight, FileDown, Table2, FileUp, FileSpreadsheet, RefreshCw, Loader2, ExternalLink,
  Upload, FileText, ChevronLeft, ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, Modal, Field, Loading, ConfirmModal } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Sirket, KullaniciProfil, Dokuman } from '@/types'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── E-Fatura / E-Arşiv süreç adımları ────────────────────────────────────────
type EFaturaDurum = 'bekliyor' | 'indirildi' | 'kontrol_edildi' | 'luca_aktarildi' | 'tamamlandi'
type EDeferDurum  = 'bekliyor' | 'olusturuldu' | 'imzalandi' | 'gonderildi' | 'onaylandi'

const EFATURA_ADIMLAR: { durum: EFaturaDurum; label: string; icon: React.ElementType }[] = [
  { durum: 'bekliyor',        label: 'Bekliyor',          icon: Clock },
  { durum: 'indirildi',       label: 'İndirildi',         icon: Upload },
  { durum: 'kontrol_edildi',  label: 'Kontrol Edildi',    icon: CheckCircle2 },
  { durum: 'luca_aktarildi',  label: 'Luca\'ya Aktarıldı', icon: FileText },
  { durum: 'tamamlandi',      label: 'Tamamlandı',        icon: CheckCheck },
]
const EDEFTER_ADIMLAR: { durum: EDeferDurum; label: string; icon: React.ElementType }[] = [
  { durum: 'bekliyor',     label: 'Bekliyor',   icon: Clock },
  { durum: 'olusturuldu',  label: 'Oluşturuldu', icon: FileText },
  { durum: 'imzalandi',    label: 'İmzalandı',  icon: CheckCircle2 },
  { durum: 'gonderildi',   label: 'GİB\'e Gönderildi', icon: Send },
  { durum: 'onaylandi',    label: 'GİB Onayladı', icon: BadgeCheck },
]

function stepIndex(adimlar: { durum: string }[], durum: string) {
  return adimlar.findIndex(a => a.durum === durum)
}

function getDonemStr(date: Date = new Date()): string {
  const d = new Date(date)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function EFaturaModulu({ firma, firmalar, firmaIds, profil }: AppCtx) {
  const [tab, setTab] = useState<'efatura' | 'edefter'>('efatura')

  const [sirketler, setSirketler]         = useState<Sirket[]>([])
  const [loading, setLoading]             = useState(true)

  // --- Import state ---
  const [importModal, setImportModal]     = useState<'efatura' | 'edefter' | null>(null)
  const [importRows, setImportRows]       = useState<any[]>([])
  const [importErrors, setImportErrors]   = useState<string[]>([])
  const [importing, setImporting]         = useState(false)

  // --- Süreç (E-Fatura/E-Arşiv/E-Defter) state ---
  const [surecler, setSurecler]           = useState<any[]>([])
  const [surecModal, setSurecModal]       = useState<Partial<any> | null>(null)
  const [surecSaving, setSurecSaving]     = useState(false)
  const [surecDeleteId, setSurecDeleteId] = useState<string | null>(null)
  const [surecDonem, setSurecDonem]       = useState(getDonemStr())
  const [surecSelFirmaId, setSurecSelFirmaId] = useState(firma.id)
  const [syncing, setSyncing]             = useState(false)

  useEffect(() => { loadAll() }, [firmaIds.join(',')])

  async function loadAll() {
    setLoading(true)
    const [sRes, srRes] = await Promise.all([
      supabase.from('sirketler').select('*').in('firma_id', firmaIds).eq('aktif', true),
      supabase.from('efatura_surecler').select('*, sirket:sirketler(kod,ad)').in('firma_id', firmaIds).order('donem', { ascending: false }),
    ])
    setSirketler(sRes.data || [])
    setSurecler(srRes.data || [])
    setLoading(false)
  }

  async function saveSurec() {
    if (!surecModal?.tip || !surecModal?.donem) { alert('Tip ve dönem zorunludur.'); return }
    setSurecSaving(true)
    const payload = {
      firma_id: surecModal.id ? (surecModal.firma_id || firma.id) : surecSelFirmaId,
      sirket_id: surecModal.sirket_id || null,
      tip: surecModal.tip,
      donem: surecModal.donem,
      durum: surecModal.durum || 'bekliyor',
      fatura_sayisi: Number(surecModal.fatura_sayisi || 0),
      tutar: Number(surecModal.tutar || 0),
      notlar: surecModal.notlar || null,
      tamamlandi_at: surecModal.durum === 'tamamlandi' || surecModal.durum === 'onaylandi' ? new Date().toISOString() : null,
    }
    if (surecModal.id) {
      const { error } = await supabase.from('efatura_surecler').update(payload).eq('id', surecModal.id)
      if (error) { alert(error.message); setSurecSaving(false); return }
    } else {
      const { error } = await supabase.from('efatura_surecler').insert(payload)
      if (error) { alert(error.message); setSurecSaving(false); return }
    }
    setSurecSaving(false); setSurecModal(null); await loadAll()
  }

  async function updateSurecDurum(s: any, yeniDurum: string) {
    const updates: any = { durum: yeniDurum }
    if (yeniDurum === 'tamamlandi' || yeniDurum === 'onaylandi') updates.tamamlandi_at = new Date().toISOString()
    await supabase.from('efatura_surecler').update(updates).eq('id', s.id)
    await loadAll()
  }

  async function handleDeleteSurec() {
    if (!surecDeleteId) return
    await supabase.from('efatura_surecler').delete().eq('id', surecDeleteId)
    setSurecDeleteId(null); await loadAll()
  }

  const efaturaFiltered = useMemo(() => surecler.filter(s => ['efatura', 'efatura_giden', 'earsiv_gelen', 'earsiv'].includes(s.tip) && s.donem === surecDonem), [surecler, surecDonem])
  const edeferFiltered = useMemo(() => surecler.filter(s => s.tip === 'edefter' && s.donem === surecDonem), [surecler, surecDonem])

  const TIP_FULL: Record<string, string> = { efatura: 'E-Fatura Gelen', efatura_giden: 'E-Fatura Giden', earsiv_gelen: 'E-Arşiv Gelen', earsiv: 'E-Arşiv Giden', edefter: 'E-Defter' }

  function exportEfaturaPDF() {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text(`E-Fatura / E-Arsiv Surecleri - ${surecDonem}`, 14, 16)
    autoTable(doc, {
      startY: 28,
      head: [['Tip', 'Sirket', 'Durum', 'Fatura Sayisi', 'Tutar', 'Notlar']],
      body: efaturaFiltered.map(s => [TIP_FULL[s.tip] || s.tip, s.sirket?.kod || '-', s.durum, s.fatura_sayisi || 0, Number(s.tutar || 0).toLocaleString('tr-TR'), s.notlar || '']),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
    })
    doc.save(`efatura-arsiv-${surecDonem}.pdf`)
  }

  function exportEfaturaExcel() {
    const rows = efaturaFiltered.map(s => ({ 'Tip': TIP_FULL[s.tip] || s.tip, 'Dönem': s.donem, 'Şirket': s.sirket?.kod || '-', 'Durum': s.durum, 'Fatura Sayısı': s.fatura_sayisi || 0, 'Tutar': Number(s.tutar || 0), 'Notlar': s.notlar || '' }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'E-Fatura & E-Arşiv')
    XLSX.writeFile(wb, `efatura-arsiv-${surecDonem}.xlsx`)
  }

  function downloadTemplate(which: 'efatura' | 'edefter') {
    const templates: Record<string, any[]> = {
      efatura:   [{ 'Tip': 'efatura', 'Dönem': '2025-01', 'Şirket Kodu': 'ABC', 'Durum': 'bekliyor', 'Fatura Sayısı': 12, 'Tutar (₺)': 45000, 'Notlar': '' }],
      edefter:   [{ 'Dönem': '2025-01', 'Şirket Kodu': 'ABC', 'Durum': 'bekliyor', 'Notlar': '' }],
    }
    const ws = XLSX.utils.json_to_sheet(templates[which])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon')
    XLSX.writeFile(wb, `sablon-${which}.xlsx`)
  }

  function parseExcelForImport(file: File, which: 'efatura' | 'edefter') {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        const errors: string[] = []

        const mapped = rows.map((row, i) => {
          const n = i + 2
          const donem = String(row['Dönem'] || surecDonem).trim()
          const tip = which === 'efatura' ? String(row['Tip'] || 'efatura').trim().toLowerCase() : 'edefter'
          const sirket = sirketler.find(s => s.kod === String(row['Şirket Kodu'] || '').trim())
          return {
            _preview: `${TIP_FULL[tip] || tip} / ${donem} / ${row['Durum'] || 'bekliyor'}`,
            firma_id: surecSelFirmaId,
            sirket_id: sirket?.id || null,
            tip, donem,
            durum: String(row['Durum'] || 'bekliyor').trim(),
            fatura_sayisi: Number(row['Fatura Sayısı'] || 0),
            tutar: Number(row['Tutar (₺)'] || 0),
            notlar: String(row['Notlar'] || '') || null,
          }
        })

        setImportErrors(errors)
        setImportRows(mapped)
        setImportModal(which)
      } catch {
        alert('Dosya okunamadı. Lütfen geçerli bir Excel dosyası seçin.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmImport() {
    if (importRows.length === 0 || importErrors.length > 0) return
    setImporting(true)
    const payload = importRows.map(({ _preview, ...rest }) => rest)
    const { error } = await supabase.from('efatura_surecler').insert(payload)
    setImporting(false)
    if (error) { alert('İçe aktarma hatası: ' + error.message); return }
    setImportModal(null); setImportRows([]); setImportErrors([])
    await loadAll()
  }

  async function handleSyncIsnet(tip: 'efatura' | 'edefter') {
    setSyncing(true)
    try {
      const res = await fetch('/api/isnet/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmaId: surecSelFirmaId, yil: surecDonem.split('-')[0], donem: surecDonem.split('-')[1], tip })
      })
      const json = await res.json()
      if (!res.ok) alert('İşnet Hatası: ' + (json.error || 'Bilinmeyen bir hata oluştu.'))
      else { alert('✓ ' + json.message); await loadAll() }
    } catch (e: any) { alert('Senkronizasyon başlatılamadı: ' + e.message) }
    setSyncing(false)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-slate-50"><Receipt size={18} className="text-blue-500" /></div>
          <div>
            <h1 className="text-[22px] font-semibold text-slate-800">E-Fatura & E-Defter</h1>
            <p className="text-[13px] text-slate-500">İşnet entegrasyonu, e-arşiv ve berat takibi</p>
          </div>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-px">
        <button onClick={() => setTab('efatura')} className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${tab === 'efatura' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Receipt size={15} /> E-Fatura & E-Arşiv</button>
        <button onClick={() => setTab('edefter')} className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${tab === 'edefter' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><BookOpen size={15} /> E-Defter</button>
      </div>

      {/* İçerik */}
      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">Dönem</label>
          <input type="month" value={surecDonem} onChange={e => setSurecDonem(e.target.value)} className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400" />
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={() => handleSyncIsnet(tab)} disabled={syncing} className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-2 rounded-xl text-[12px] font-semibold transition-colors shadow-sm disabled:opacity-50">
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} İşnet'ten Çek
          </button>
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">İndir</span>
            <button onClick={tab === 'efatura' ? exportEfaturaPDF : exportEfaturaPDF} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors"><FileDown size={13} /> PDF</button>
            <div className="w-px h-5 bg-slate-200" />
            <button onClick={tab === 'efatura' ? exportEfaturaExcel : exportEfaturaExcel} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"><Table2 size={13} /> Excel</button>
          </div>
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Aktar</span>
            <label className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer" title="Excel şablon ile içe aktar">
              <FileSpreadsheet size={13} /> Excel
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseExcelForImport(f, tab); e.target.value = '' }} />
            </label>
            <div className="w-px h-5 bg-slate-200" />
            <button onClick={() => downloadTemplate(tab)} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors" title="Excel şablon indir"><FileDown size={13} /> Şablon</button>
          </div>
          <button onClick={() => setSurecModal({ tip: tab, donem: surecDonem, durum: 'bekliyor', fatura_sayisi: 0, tutar: 0 })} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-colors">
            <Plus size={14} /> Yeni Süreç Ekle
          </button>
        </div>
      </div>

      {tab === 'efatura' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {([
            { tip: 'efatura',       label: 'E-Fatura Gelen',  color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { tip: 'efatura_giden', label: 'E-Fatura Giden',  color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
            { tip: 'earsiv_gelen',  label: 'E-Arşiv Gelen',   color: 'text-purple-700 bg-purple-50 border-purple-200' },
            { tip: 'earsiv',        label: 'E-Arşiv Giden',   color: 'text-violet-700 bg-violet-50 border-violet-200' },
          ] as const).map(({ tip, label, color }) => {
            const items = efaturaFiltered.filter(s => s.tip === tip)
            return (
              <div key={tip} className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-bold border ${color}`}><Receipt size={12} /> {label}</span>
                  <button onClick={() => setSurecModal({ tip, donem: surecDonem, durum: 'bekliyor', fatura_sayisi: 0, tutar: 0 })} className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500"><Plus size={13} /></button>
                </div>
                {items.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-slate-400">Bu dönem için kayıt yok.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {items.map(s => <SurecKart key={s.id} surec={s} adimlar={EFATURA_ADIMLAR} firmalar={firmalar} onEdit={() => setSurecModal(s)} onDelete={() => setSurecDeleteId(s.id)} onDurumChange={(d) => updateSurecDurum(s, d)} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'edefter' && (
        <div className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="flex items-center gap-2 text-[13px] font-bold text-emerald-700"><BookOpen size={14} /> E-Defter Süreçleri — {surecDonem}</span>
            <span className="text-[12px] text-slate-400">{edeferFiltered.length} kayıt</span>
          </div>
          {edeferFiltered.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-slate-400"><BookOpen size={40} className="mx-auto mb-3 text-slate-200" />Bu dönem için e-defter kaydı yok.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {edeferFiltered.map(s => <SurecKart key={s.id} surec={s} adimlar={EDEFTER_ADIMLAR} firmalar={firmalar} onEdit={() => setSurecModal(s)} onDelete={() => setSurecDeleteId(s.id)} onDurumChange={(d) => updateSurecDurum(s, d)} />)}
            </div>
          )}
        </div>
      )}

      {/* Modal vb */}
      {surecModal && (
        <Modal title={surecModal.id ? `Düzenle` : `Yeni Süreç`} onClose={() => setSurecModal(null)} size="md"
          footer={<><button onClick={() => setSurecModal(null)} className={cls.btnSecondary}>İptal</button><button onClick={saveSurec} disabled={surecSaving} className={cls.btnPrimary}>{surecSaving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-4">
            {!surecModal.id && firmalar.length > 1 && (
              <Field label="Firma"><select className={cls.input} value={surecSelFirmaId} onChange={e => setSurecSelFirmaId(e.target.value)}>{firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}</select></Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tip" required>
                <select className={cls.input} value={surecModal.tip || ''} onChange={e => setSurecModal(p => ({ ...p!, tip: e.target.value }))}>
                  <option value="efatura">E-Fatura Gelen</option>
                  <option value="efatura_giden">E-Fatura Giden</option>
                  <option value="earsiv_gelen">E-Arşiv Gelen</option>
                  <option value="earsiv">E-Arşiv Giden</option>
                  <option value="edefter">E-Defter</option>
                </select>
              </Field>
              <Field label="Dönem" required><input type="month" className={cls.input} value={surecModal.donem || ''} onChange={e => setSurecModal(p => ({ ...p!, donem: e.target.value }))} /></Field>
            </div>
            {sirketler.length > 0 && (
              <Field label="Şirket">
                <select className={cls.input} value={surecModal.sirket_id || ''} onChange={e => setSurecModal(p => ({ ...p!, sirket_id: e.target.value || undefined }))}>
                  <option value="">Seçiniz</option>
                  {sirketler.filter(s => s.firma_id === (surecModal.id ? surecModal.firma_id : surecSelFirmaId)).map(s => <option key={s.id} value={s.id}>{s.kod} - {s.ad}</option>)}
                </select>
              </Field>
            )}
            <Field label="Durum" required>
              <select className={cls.input} value={surecModal.durum || 'bekliyor'} onChange={e => setSurecModal(p => ({ ...p!, durum: e.target.value }))}>
                {surecModal.tip === 'edefter' ? EDEFTER_ADIMLAR.map(a => <option key={a.durum} value={a.durum}>{a.label}</option>) : EFATURA_ADIMLAR.map(a => <option key={a.durum} value={a.durum}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Notlar"><textarea className={`${cls.input} resize-none`} rows={2} value={surecModal.notlar || ''} onChange={e => setSurecModal(p => ({ ...p!, notlar: e.target.value }))} /></Field>
          </div>
        </Modal>
      )}
      {surecDeleteId && <ConfirmModal title="Süreci Sil" message="Bu süreç kalıcı olarak silinecek." danger onConfirm={handleDeleteSurec} onCancel={() => setSurecDeleteId(null)} />}
      {importModal && importRows.length > 0 && (
        <Modal title={`Excel İçe Aktar`} onClose={() => { setImportModal(null); setImportRows([]); setImportErrors([]) }} size="xl"
          footer={<><button onClick={() => { setImportModal(null); setImportRows([]); setImportErrors([]) }} className={cls.btnSecondary}>İptal</button><button onClick={confirmImport} disabled={importing || importErrors.length > 0} className={cls.btnPrimary}>{importing ? 'Aktarılıyor...' : `${importRows.length} Kaydı Aktar`}</button></>}>
          <div className="space-y-3">
            {importErrors.length > 0 && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1"><p className="text-[12px] font-bold text-rose-700">Hata — Lütfen dosyayı düzeltin:</p>{importErrors.map((e, i) => <p key={i} className="text-[12px] text-rose-600">{e}</p>)}</div>}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-[12px] text-left">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Önizleme</th><th className="px-3 py-2">Firma</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{importRows.slice(0, 5).map((row, i) => (<tr key={i} className="hover:bg-slate-50"><td className="px-3 py-2 font-medium">{row._preview}</td><td className="px-3 py-2 text-slate-400">{firmalar.find(f => f.id === row.firma_id)?.kisa_ad || ''}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SurecKart({ surec, adimlar, firmalar, onEdit, onDelete, onDurumChange }: { surec: any; adimlar: any[]; firmalar: any[]; onEdit: () => void; onDelete: () => void; onDurumChange: (d: string) => void }) {
  const currentIdx = stepIndex(adimlar, surec.durum); const isCompleted = currentIdx === adimlar.length - 1; const nextStep = adimlar[currentIdx + 1];
  return (
    <div className="px-5 py-4 group hover:bg-slate-50/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2"><span className="text-[13px] font-bold text-slate-800">{surec.sirket?.kod || 'Genel'}</span></div>
          <div className="flex items-center gap-0.5 flex-wrap">{adimlar.map((adim, idx) => { const done = idx <= currentIdx; const current = idx === currentIdx; const Icon = adim.icon; return (<div key={adim.durum} className="flex items-center gap-0.5"><div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${done ? current ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Icon size={9} /> {adim.label}</div>{idx < adimlar.length - 1 && (<ArrowRight size={9} className={done && idx < currentIdx ? 'text-emerald-400' : 'text-slate-200'} />)}</div>) })}</div>
          {surec.notlar && <p className="text-[11px] text-slate-500 mt-1.5 bg-slate-100 rounded-lg px-2 py-1">{surec.notlar}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!isCompleted && nextStep && <button onClick={() => onDurumChange(nextStep.durum)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-500 transition-colors whitespace-nowrap"><ChevronRight size={11} /> {nextStep.label}</button>}
          {isCompleted && <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-bold"><CheckCheck size={11} /> Tamamlandı</span>}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={onEdit} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600"><Pencil size={11}/></button><button onClick={onDelete} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600"><Trash2 size={11}/></button></div>
        </div>
      </div>
    </div>
  )
}