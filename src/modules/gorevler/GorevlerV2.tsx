'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, CheckCircle2, BellRing,
  FileSpreadsheet, FileText, Plus, X, Trash2, CalendarDays,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, ErrorMsg, Loading, Modal, Field } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Dokuman } from '@/types'
import AylikMaliyetModule from './AylikMaliyet'

// ── Types ──────────────────────────────────────────────────────────────────
type IsTip = 'kdv' | 'kdv2' | 'muhtsar_sgk' | 'sgk_proje' | 'gecici_vergi' | 'edefter' | 'kurumlar_vergisi'
type Frekans = 'aylik' | 'secili_aylar' | 'yillik'

interface IsTakip {
  id: string
  firma_id: string
  musteri_id: string | null
  tip: IsTip
  donem: string
  adim1_durum: 'bekliyor' | 'tamamlandi'
  adim1_tarihi: string | null
  adim2_durum: 'bekliyor' | 'tamamlandi'
  adim2_tarihi: string | null
  durum: 'aktif' | 'tamamlandi'
  notlar: string | null
  created_at: string
  hatirlatici_tarihi?: string | null
  hatirlatici_saati?: string | null
}

// ── Config ─────────────────────────────────────────────────────────────────
const TIPLER: {
  key: IsTip; label: string; frekans: Frekans
  aylar?: number[]  // 1-based, only for 'secili_aylar'
  adimlar: [string, string]; accent: string
}[] = [
  { key: 'kdv',              label: 'KDV Beyannamesi',    frekans: 'aylik',        adimlar: ['Tahakkuk', 'Ödeme'],   accent: 'blue'    },
  { key: 'kdv2',             label: 'KDV2 Beyannamesi',   frekans: 'aylik',        adimlar: ['Tahakkuk', 'Ödeme'],   accent: 'sky'     },
  { key: 'muhtsar_sgk',      label: 'Muhtasar & SGK',     frekans: 'aylik',        adimlar: ['Tahakkuk', 'Ödeme'],   accent: 'violet'  },
  { key: 'sgk_proje',        label: 'SGK Tahakkuku',      frekans: 'aylik',        adimlar: ['Tahakkuk', 'Ödeme'],   accent: 'cyan'    },
  { key: 'gecici_vergi',     label: 'Geçici Vergi',       frekans: 'secili_aylar', aylar: [5, 8, 11],               adimlar: ['Tahakkuk', 'Ödeme'],   accent: 'amber'   },
  { key: 'edefter',          label: 'E-Defter Gönderimi', frekans: 'secili_aylar', aylar: [4, 7, 10],               adimlar: ['Gönderim', 'Kontrol'], accent: 'emerald' },
  { key: 'kurumlar_vergisi', label: 'Kurumlar Vergisi',   frekans: 'yillik',       adimlar: ['Tahakkuk', 'Ödeme'],   accent: 'rose'    },
]

// Per-tip document categories (PDF only)
const DOC_CATS: Record<IsTip, { key: string; label: string }[]> = {
  kdv:              [{ key: 'beyan', label: 'Beyanname' }, { key: 'tahakkuk', label: 'Tahakkuk' }, { key: 'odeme', label: 'Ödeme' }],
  kdv2:             [{ key: 'beyan', label: 'Beyanname' }, { key: 'tahakkuk', label: 'Tahakkuk' }, { key: 'odeme', label: 'Ödeme' }],
  muhtsar_sgk:      [{ key: 'beyan', label: 'Beyanname' }, { key: 'tahakkuk', label: 'Tahakkuk' }, { key: 'odeme', label: 'Ödeme' }],
  sgk_proje:        [{ key: 'tahakkuk', label: 'Tahakkuk' }, { key: 'odeme', label: 'Ödeme' }],
  gecici_vergi:     [{ key: 'beyan', label: 'Beyanname' }, { key: 'tahakkuk', label: 'Tahakkuk' }, { key: 'odeme', label: 'Ödeme' }],
  edefter:          [{ key: 'gonderim', label: 'Gönderim' }, { key: 'kontrol', label: 'Kontrol' }],
  kurumlar_vergisi: [{ key: 'beyan', label: 'Beyanname' }, { key: 'tahakkuk', label: 'Tahakkuk' }, { key: 'odeme', label: 'Ödeme' }],
}

const AYLAR     = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const AYLAR_TAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

// Pre-defined accent classes so Tailwind JIT includes them
const ACCENT: Record<string, { dot: string; text: string; softBg: string; softBorder: string }> = {
  blue:    { dot: 'bg-blue-400',    text: 'text-blue-600',    softBg: 'bg-blue-50',    softBorder: 'border-blue-200'    },
  sky:     { dot: 'bg-sky-400',     text: 'text-sky-600',     softBg: 'bg-sky-50',     softBorder: 'border-sky-200'     },
  violet:  { dot: 'bg-violet-400',  text: 'text-violet-600',  softBg: 'bg-violet-50',  softBorder: 'border-violet-200'  },
  cyan:    { dot: 'bg-cyan-400',    text: 'text-cyan-600',    softBg: 'bg-cyan-50',    softBorder: 'border-cyan-200'    },
  amber:   { dot: 'bg-amber-400',   text: 'text-amber-600',   softBg: 'bg-amber-50',   softBorder: 'border-amber-200'   },
  emerald: { dot: 'bg-emerald-400', text: 'text-emerald-600', softBg: 'bg-emerald-50', softBorder: 'border-emerald-200' },
  rose:    { dot: 'bg-rose-400',    text: 'text-rose-600',    softBg: 'bg-rose-50',    softBorder: 'border-rose-200'    },
}

// ── Helpers ────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')

function donemLabel(donem: string): string {
  if (donem.includes('-')) {
    const [y, m] = donem.split('-')
    return `${AYLAR_TAM[Number(m) - 1] ?? ''} ${y}`
  }
  return `${donem} Yılı`
}

function isExcel(doc: Dokuman) {
  return doc.mime_type?.includes('sheet') || doc.mime_type?.includes('excel') || /\.xlsx?$/i.test(doc.dosya_adi)
}

function isImage(doc: Dokuman) {
  return doc.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(doc.dosya_adi)
}

// ── GridCell (standalone to avoid re-mount on each render) ─────────────────
function GridCell({
  status, isActive, isCurrent, disabled, onClick,
}: {
  status: 'none' | 'partial' | 'done'
  isActive: boolean; isCurrent: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'group w-full h-7 rounded-md border transition-all flex items-center justify-center select-none',
        isActive
          ? 'ring-2 ring-blue-400/50 border-blue-400 bg-blue-50'
          : status === 'done'
          ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
          : status === 'partial'
          ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
          : isCurrent
          ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      {status === 'done'    && <CheckCircle2 size={13} className="text-emerald-500 pointer-events-none" />}
      {status === 'partial' && <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-100 pointer-events-none" />}
      {status === 'none'    && <Plus size={11} className="text-transparent group-hover:text-slate-400 transition-colors pointer-events-none" />}
    </button>
  )
}

// ── Section Label Row ──────────────────────────────────────────────────────
function SectionRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={13}
        className="sticky left-0 px-4 py-1 bg-slate-50 border-t border-b border-slate-100"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
      </td>
    </tr>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function GorevlerV2({ firma, firmalar, firmaIds, profil, navigate }: AppCtx) {
  const todayYil = new Date().getFullYear()
  const todayAy  = new Date().getMonth()
  let targetAy = todayAy - 1; let targetYil = todayYil;
  if (targetAy < 0) { targetAy = 11; targetYil--; }

  const [tab, setTab]               = useState<'sabit' | 'maliyet'>('sabit')
  const [yil, setYil]               = useState(targetYil)
  const [selFirmaId, setSelFirmaId] = useState(firma.id)
  const [isler, setIsler]           = useState<IsTakip[]>([])
  const [dosyaMap, setDosyaMap]     = useState<Record<string, Dokuman[]>>({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [selCell, setSelCell]       = useState<{ tip: IsTip; donem: string } | null>(null)
  const [notVal, setNotVal]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [uploadingItem, setUploadingItem] = useState<{ recordId: string; cat: string } | null>(null)
  const [reminderModal, setReminderModal] = useState<{ id: string; tarih: string; saat: string; hasExisting: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void load() }, [firmaIds.join(',')])

  async function load() {
    setLoading(true); setError('')
    const [{ data: i, error: iErr }, { data: docs, error: dErr }] =
      await Promise.all([
        supabase.from('is_takip').select('*').in('firma_id', firmaIds),
        supabase.from('dokumanlar').select('*').in('firma_id', firmaIds).eq('bagli_tablo', 'is_takip'),
      ])
    if (iErr || dErr) {
      setError(iErr?.message || dErr?.message || 'Veri hatası')
      setLoading(false); return
    }
    setIsler((i || []) as IsTakip[])
    // Build dosyaMap keyed by `${record_id}_${kategori}`
    const map: Record<string, Dokuman[]> = {}
    ;(docs || []).forEach(doc => {
      const key = `${doc.bagli_kayit_id}_${doc.kategori}`
      if (!map[key]) map[key] = []
      map[key].push(doc as Dokuman)
    })
    setDosyaMap(map)
    setLoading(false)
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const d = now.toISOString().split('T')[0]
      isler.forEach(k => {
        if (k.hatirlatici_tarihi === d && k.hatirlatici_saati === hhmm && k.durum === 'aktif') {
          new Notification('İş Takibi Hatırlatıcısı', { body: `${k.tip} - ${k.donem} dönemi için hatırlatma`, icon: '/favicon.ico' })
        }
      })
    }, 60000)
    return () => clearInterval(timer)
  }, [isler])

  const getRecord = (tip: IsTip, donem: string): IsTakip | undefined =>
    isler.find(x => x.firma_id === selFirmaId && x.tip === tip && x.donem === donem)

  const getCellStatus = (tip: IsTip, donem: string): 'none' | 'partial' | 'done' => {
    const r = getRecord(tip, donem)
    if (!r) return 'none'
    return r.adim1_durum === 'tamamlandi' && r.adim2_durum === 'tamamlandi' ? 'done' : 'partial'
  }

  const progress = useMemo(() => {
    let total = 0, done = 0
    for (const tip of TIPLER) {
      if (tip.frekans === 'aylik') {
        for (let m = 1; m <= 12; m++) {
          total++; if (getCellStatus(tip.key, `${yil}-${pad(m)}`) === 'done') done++
        }
      } else if (tip.frekans === 'secili_aylar') {
        for (const m of tip.aylar || []) {
          total++; if (getCellStatus(tip.key, `${yil}-${pad(m)}`) === 'done') done++
        }
      } else if (tip.frekans === 'yillik') {
        total++; if (getCellStatus(tip.key, `${yil - 1}`) === 'done') done++
      }
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [isler, yil, selFirmaId])

  async function handleCell(tip: IsTip, donem: string) {
    let rec = getRecord(tip, donem)
    if (!rec) {
      setSaving(true)
      const { data, error: e } = await supabase
        .from('is_takip')
        .insert({ firma_id: selFirmaId, musteri_id: null, tip, donem })
        .select().single()
      setSaving(false)
      if (e) { alert(e.message); return }
      if (data) { rec = data as IsTakip; setIsler(prev => [...prev, rec!]) }
    }
    setSelCell({ tip, donem })
    setNotVal(rec?.notlar ?? '')
  }

  const selRecord = selCell ? getRecord(selCell.tip, selCell.donem) : null
  const selTipCfg = selCell ? TIPLER.find(t => t.key === selCell.tip) ?? null : null

  async function toggleAdim(no: 1 | 2) {
    if (!selRecord) return
    const dKey  = `adim${no}_durum`  as 'adim1_durum' | 'adim2_durum'
    const tKey  = `adim${no}_tarihi` as 'adim1_tarihi' | 'adim2_tarihi'
    const next  = selRecord[dKey] === 'tamamlandi' ? 'bekliyor' : 'tamamlandi'
    const tarih = next === 'tamamlandi' ? new Date().toISOString().slice(0, 10) : null
    const a1    = no === 1 ? next : selRecord.adim1_durum
    const a2    = no === 2 ? next : selRecord.adim2_durum
    const durum = a1 === 'tamamlandi' && a2 === 'tamamlandi' ? 'tamamlandi' : 'aktif'
    const { error: e } = await supabase
      .from('is_takip').update({ [dKey]: next, [tKey]: tarih, durum }).eq('id', selRecord.id)
    if (e) { alert(e.message); return }
    setIsler(prev => prev.map(x => x.id === selRecord.id ? { ...x, [dKey]: next, [tKey]: tarih, durum } : x))

    // Vergi modülü ile senkronizasyon (Eğer beyanname veritabanında varsa durumunu güncelle)
    const vergiTipleri = ['kdv', 'kdv2', 'muhtsar_sgk', 'gecici_vergi', 'kurumlar_vergisi']
    if (vergiTipleri.includes(selRecord.tip)) {
      const vTip = selRecord.tip === 'muhtsar_sgk' ? 'muhsgk' : selRecord.tip
      let vDurum = 'bekliyor'
      if (a1 === 'tamamlandi' && a2 === 'tamamlandi') vDurum = 'odendi'
      else if (a1 === 'tamamlandi') vDurum = 'onaylandi'

      await supabase.from('vergi_beyannameleri')
        .update({ durum: vDurum })
        .eq('firma_id', selRecord.firma_id)
        .eq('tip', vTip)
        .eq('donem', selRecord.donem)
    }

    // Bordro (SGK Tahakkuk/Ödeme) modülü ile senkronizasyon (Tüm projeler için)
    if (selRecord.tip === 'sgk_proje') {
      const todayStr = new Date().toISOString().split('T')[0]
      const bUpdates: any = {}
      if (a1 === 'tamamlandi') { bUpdates.bordro_durum = 'tamamlandi'; bUpdates.bordro_tarihi = todayStr }
      else { bUpdates.bordro_durum = 'bekliyor'; bUpdates.bordro_tarihi = null }

      if (a2 === 'tamamlandi') { bUpdates.odeme_durum = 'tamamlandi'; bUpdates.odeme_tarihi = todayStr }
      else { bUpdates.odeme_durum = 'bekliyor'; bUpdates.odeme_tarihi = null }

      await supabase.from('bordro_surecler').update(bUpdates).eq('firma_id', selRecord.firma_id).eq('donem', selRecord.donem)
    }
  }

  async function saveNot() {
    if (!selRecord) return
    setSaving(true)
    const { error: e } = await supabase.from('is_takip').update({ notlar: notVal || null }).eq('id', selRecord.id)
    setSaving(false)
    if (e) { alert(e.message); return }
    setIsler(prev => prev.map(x => x.id === selRecord.id ? { ...x, notlar: notVal || null } : x))
  }

  async function deleteRecord() {
    if (!selRecord) return
    setDeleting(true)
    const { error: e } = await supabase.from('is_takip').delete().eq('id', selRecord.id)
    setDeleting(false)
    if (e) { alert(e.message); return }
    setIsler(prev => prev.filter(x => x.id !== selRecord.id))
    setSelCell(null)
  }

  async function saveReminder() {
    if (!reminderModal?.tarih || !reminderModal?.saat) return
    setSaving(true)
    const { error } = await supabase.from('is_takip').update({ hatirlatici_tarihi: reminderModal.tarih, hatirlatici_saati: reminderModal.saat }).eq('id', reminderModal.id)
    setSaving(false)
    if (!error) { setReminderModal(null); load() }
  }

  async function clearReminder(id: string) {
    setSaving(true)
    const { error } = await supabase.from('is_takip').update({ hatirlatici_tarihi: null, hatirlatici_saati: null }).eq('id', id)
    setSaving(false)
    if (!error) { setReminderModal(null); load() }
  }

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !uploadingItem) return
    const { recordId, cat } = uploadingItem
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    const isExcelFile = file.type.includes('sheet') || file.type.includes('excel') || /\.xlsx?$/i.test(file.name)
    const isImg = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name)
    if (!isPdf && !isExcelFile && !isImg) { alert('Sadece PDF, Excel veya Görsel yüklenebilir.'); return }
    setUploading(true)
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const path = `beyannameler/${selFirmaId}/${recordId}/${cat}/${safeName}`
    const { error: sErr } = await supabase.storage.from('dokumanlar').upload(path, file, { upsert: false })
    if (sErr) { alert(sErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('dokumanlar').getPublicUrl(path)
    const { data: doc, error: dErr } = await supabase.from('dokumanlar').insert({
      firma_id: selFirmaId,
      yukleyen_id: profil.auth_user_id,
      modul: 'rapor' as const,
      kategori: cat,
      bagli_tablo: 'is_takip',
      bagli_kayit_id: recordId,
      dosya_adi: file.name,
      dosya_url: urlData.publicUrl,
      mime_type: file.type || null,
      dosya_boyutu: file.size || null,
    }).select().single()
    setUploading(false)
    if (dErr) { alert(dErr.message); return }
    if (doc) {
      const key = `${recordId}_${cat}`
      setDosyaMap(prev => ({ ...prev, [key]: [...(prev[key] || []), doc as Dokuman] }))
    }
    setUploadingItem(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDoc(doc: Dokuman) {
    const { error: e } = await supabase.from('dokumanlar').delete().eq('id', doc.id)
    if (e) { alert(e.message); return }
    const key = `${doc.bagli_kayit_id}_${doc.kategori}`
    setDosyaMap(prev => ({ ...prev, [key]: (prev[key] || []).filter(d => d.id !== doc.id) }))
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*" className="hidden" onChange={uploadFile} />

      {/* ── Sekmeler ── */}
      <div className="flex gap-1 border-b border-blue-100">
        {([
          { key: 'sabit',   label: 'Beyanname Takibi', icon: CalendarDays    },
          { key: 'maliyet', label: 'Aylık Maliyet',    icon: FileSpreadsheet },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-700',
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'maliyet' ? (
        <AylikMaliyetModule
          firma={firma} firmalar={firmalar} firmaIds={firmaIds} profil={profil} navigate={navigate}
        />
      ) : (
        <>
          {/* ── Yıl Navigasyonu ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
          {firmalar.length > 1 && (
            <select
              className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 shadow-sm mr-2"
              value={selFirmaId}
              onChange={e => setSelFirmaId(e.target.value)}
            >
              {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
            </select>
          )}
              <button onClick={() => setYil(y => y - 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white grid place-items-center hover:bg-slate-50 transition shadow-sm">
                <ChevronLeft size={14} className="text-slate-600" />
              </button>
              <span className="text-xl font-bold text-slate-800 w-16 text-center tabular-nums">{yil}</span>
              <button onClick={() => setYil(y => y + 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white grid place-items-center hover:bg-slate-50 transition shadow-sm">
                <ChevronRight size={14} className="text-slate-600" />
              </button>
              {yil !== targetYil && (
                <button onClick={() => setYil(targetYil)} className="text-xs text-blue-600 hover:text-blue-800 transition px-2 py-1 rounded-lg hover:bg-blue-50 border border-blue-100">
                  Bu Dönem
                </button>
              )}
            </div>
            {progress.total > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{progress.done}/{progress.total} dönem</span>
                <div className="w-28 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${progress.pct}%` }} />
                </div>
                <span className="text-xs font-bold text-emerald-600 w-8 tabular-nums">{progress.pct}%</span>
              </div>
            )}
          </div>

          {/* ── Takip Matrisi ── */}
          <div className="rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 800 }}>
                <colgroup>
                  <col style={{ width: 172 }} />
                  {Array.from({ length: 12 }, (_, i) => <col key={i} style={{ width: 52 }} />)}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Beyanname</span>
                    </th>
                    {AYLAR.map((ay, i) => (
                      <th key={i} className={['text-center py-2.5 text-[11px] font-semibold', i === targetAy && yil === targetYil ? 'text-blue-600' : 'text-slate-400'].join(' ')}>
                        {ay}
                        {i === targetAy && yil === targetYil && <div className="w-1 h-1 rounded-full bg-blue-500 mx-auto mt-0.5" title="İşlem Ayı (Önceki Ay)" />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <SectionRow label="Aylık Beyannameler" />
                  {TIPLER.filter(t => t.frekans === 'aylik').map((tip, ri, arr) => {
                    const ac = ACCENT[tip.accent]
                    return (
                      <tr key={tip.key} className={['transition-colors hover:bg-slate-50/80', ri < arr.length - 1 ? 'border-b border-slate-100' : ''].join(' ')}>
                        <td className="sticky left-0 z-10 bg-white px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.dot}`} />
                            <span className={`text-xs font-semibold ${ac.text}`}>{tip.label}</span>
                          </div>
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const donem = `${yil}-${pad(i + 1)}`
                          return (
                            <td key={i} className="px-1 py-1.5">
                              <GridCell status={getCellStatus(tip.key, donem)} isActive={selCell?.tip === tip.key && selCell.donem === donem} isCurrent={yil === targetYil && i === targetAy} disabled={saving} onClick={() => handleCell(tip.key, donem)} />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}

                  <SectionRow label="Dönemsel Beyannameler" />
                  {TIPLER.filter(t => t.frekans === 'secili_aylar').map((tip, ri, arr) => {
                    const ac = ACCENT[tip.accent]
                    return (
                      <tr key={tip.key} className={['transition-colors hover:bg-slate-50/80', ri < arr.length - 1 ? 'border-b border-slate-100' : ''].join(' ')}>
                        <td className="sticky left-0 z-10 bg-white px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.dot}`} />
                            <span className={`text-xs font-semibold ${ac.text}`}>{tip.label}</span>
                          </div>
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const month = i + 1
                          const active = tip.aylar?.includes(month) ?? false
                          if (!active) return <td key={i} className="px-1 py-1.5" />
                          const donem = `${yil}-${pad(month)}`
                          return (
                            <td key={i} className="px-1 py-1.5">
                              <GridCell status={getCellStatus(tip.key, donem)} isActive={selCell?.tip === tip.key && selCell.donem === donem} isCurrent={yil === targetYil && i === targetAy} disabled={saving} onClick={() => handleCell(tip.key, donem)} />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}

                  <SectionRow label="Yıllık Beyannameler" />
                  {TIPLER.filter(t => t.frekans === 'yillik').map(tip => {
                    const ac    = ACCENT[tip.accent]
                const donem = `${yil - 1}`
                    return (
                      <tr key={tip.key} className="transition-colors hover:bg-slate-50/80">
                        <td className="sticky left-0 z-10 bg-white px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.dot}`} />
                            <span className={`text-xs font-semibold ${ac.text}`}>{tip.label}</span>
                          </div>
                        </td>
                        <td colSpan={12} className="px-1 py-1.5">
                          <div style={{ maxWidth: 160 }}>
                            <GridCell status={getCellStatus(tip.key, donem)} isActive={selCell?.tip === tip.key && selCell.donem === donem} isCurrent={yil === targetYil} disabled={saving} onClick={() => handleCell(tip.key, donem)} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500" /><span className="text-[11px] text-slate-500">Tamamlandı</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-100" /><span className="text-[11px] text-slate-500">Devam Ediyor</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border border-slate-300" /><span className="text-[11px] text-slate-500">Kayıt Yok — tıkla başlat</span></div>
            </div>
          </div>

          {/* ── Detay Paneli ── */}
          {selCell && selTipCfg && (
            <div className="rounded-xl border border-blue-100 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full ${ACCENT[selTipCfg.accent].dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${ACCENT[selTipCfg.accent].text}`}>{selTipCfg.label}</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 leading-tight">{donemLabel(selCell.donem)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {selRecord && (
                    <button onClick={() => setReminderModal({ id: selRecord.id, tarih: selRecord.hatirlatici_tarihi || new Date().toISOString().split('T')[0], saat: selRecord.hatirlatici_saati || '', hasExisting: Boolean(selRecord.hatirlatici_tarihi || selRecord.hatirlatici_saati) })}
                      className={`p-1.5 rounded-lg transition shrink-0 ${selRecord.hatirlatici_tarihi || selRecord.hatirlatici_saati ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' : 'hover:bg-slate-100 text-slate-400'}`}
                      title="Hatırlatma Ayarla">
                      <BellRing size={14} />
                    </button>
                  )}
                  <button onClick={() => setSelCell(null)} className="p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0">
                    <X size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {selRecord ? (
                <div className="space-y-5">
                  {/* Adımlar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {([1, 2] as const).map(no => {
                      const dKey  = `adim${no}_durum`  as 'adim1_durum' | 'adim2_durum'
                      const tKey  = `adim${no}_tarihi` as 'adim1_tarihi' | 'adim2_tarihi'
                      const done  = selRecord[dKey] === 'tamamlandi'
                      const tarih = selRecord[tKey]
                      return (
                        <button key={no} onClick={() => toggleAdim(no)}
                          className={['flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all text-left', done ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'].join(' ')}
                        >
                          <div className={['w-6 h-6 rounded-full border-2 grid place-items-center shrink-0', done ? 'border-emerald-400 bg-emerald-100' : 'border-slate-300'].join(' ')}>
                            {done && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div>{selTipCfg.adimlar[no - 1]}</div>
                            {done && tarih && <div className="text-[11px] text-emerald-600/70 font-normal mt-0.5">{tarih}</div>}
                          </div>
                          {done && <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>

                  {/* ── Dosyalar ── */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Dosyalar (PDF / Excel / Görsel)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {DOC_CATS[selTipCfg.key].map(cat => {
                        const docs = dosyaMap[`${selRecord.id}_${cat.key}`] || []
                        return (
                          <div key={cat.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-slate-500">{cat.label}</span>
                              <button
                                onClick={() => { setUploadingItem({ recordId: selRecord.id, cat: cat.key }); fileRef.current?.click() }}
                                disabled={uploading}
                                className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-50 hover:bg-blue-100 border border-blue-200 transition disabled:opacity-40"
                              >
                                {uploading && uploadingItem?.cat === cat.key
                                  ? <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                                  : <Plus size={11} className="text-blue-500" />
                                }
                              </button>
                            </div>
                            {docs.length === 0
                              ? <p className="text-[10px] text-slate-400 italic">Dosya yükle</p>
                              : <div className="space-y-1.5">
                                  {docs.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-1.5 group/doc">
                                      {isExcel(doc)
                                        ? <FileSpreadsheet size={10} className="text-emerald-500 shrink-0" />
                                        : isImage(doc) ? <FileText size={10} className="text-sky-500 shrink-0" />
                                        : <FileText size={10} className="text-rose-500 shrink-0" />
                                      }
                                      <a href={doc.dosya_url} target="_blank" rel="noreferrer"
                                        className="flex-1 min-w-0 text-[10px] text-blue-600 hover:text-blue-800 truncate transition">
                                        {doc.dosya_adi}
                                      </a>
                                      <button onClick={() => deleteDoc(doc)}
                                        className="shrink-0 opacity-0 group-hover/doc:opacity-100 text-rose-400 hover:text-rose-600 transition">
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                            }
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Notlar */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Notlar</label>
                    <textarea className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all resize-none min-h-[72px]" placeholder="Bu dönem için not ekleyin..." value={notVal} onChange={e => setNotVal(e.target.value)} />
                  </div>

                  {/* Aksiyonlar */}
                  <div className="flex items-center justify-between">
                    <button onClick={deleteRecord} disabled={deleting} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40">
                      <Trash2 size={12} />
                      {deleting ? 'Siliniyor...' : 'Kaydı Sil'}
                    </button>
                    <button onClick={saveNot} disabled={saving} className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all border border-slate-200">
                      {saving ? 'Kaydediliyor...' : 'Notu Kaydet'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-2">Kayıt yükleniyor...</p>
              )}
            </div>
          )}

          {/* ── Modal: Hatırlatma ──────────────────────────────────────────────── */}
          {reminderModal && (
            <Modal title="Hatırlatma Ayarla" onClose={() => setReminderModal(null)} size="sm"
              footer={
                <>
                  <button onClick={() => setReminderModal(null)} className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all border border-slate-200">İptal</button>
                  <button onClick={saveReminder} disabled={saving} className="flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
                </>
              }>
              <div className="space-y-4">
                <Field label="Tarih" required>
                  <input type="date" className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all" value={reminderModal.tarih}
                    onChange={e => setReminderModal(m => m ? { ...m, tarih: e.target.value } : m)} />
                </Field>
                <Field label="Saat" required>
                  <input type="time" className="w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all" value={reminderModal.saat}
                    onChange={e => setReminderModal(m => m ? { ...m, saat: e.target.value } : m)} />
                </Field>
                {reminderModal.hasExisting && (
                  <button onClick={() => clearReminder(reminderModal.id)} className="w-full mt-2 py-2 text-[13px] font-bold text-red-500 border border-dashed border-red-300 hover:bg-red-50 rounded-xl transition">
                    Mevcut Hatırlatmayı Temizle
                  </button>
                )}
              </div>
            </Modal>
          )}

        </>
      )}
    </div>
  )
}
