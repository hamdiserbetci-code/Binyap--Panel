'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import {
  CheckCircle2, Upload, FileText, FileSpreadsheet, Image, Download, X, Clock,
  Pencil, Trash2, ToggleLeft, ToggleRight,
  Receipt, Users, TrendingUp, Landmark, BookOpen,
  Briefcase, CreditCard, BellRing, Plus,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal, Field, ConfirmModal, cls, Loading, ErrorMsg } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Musteri } from '@/types'
import AylikMaliyetModule from './AylikMaliyet'

// ── İş Tipi Tanımları ─────────────────────────────────────────────────────────
const IS_TIPLERI: Record<string, {
  label: string; periyot: string; adimlar: string[]
  icon: LucideIcon; color: string
}> = {
  kdv:              { label: 'KDV Beyannamesi',       periyot: 'Aylık',    adimlar: ['Tahakkuk','Ödeme'],  icon: Receipt,    color: '#0A84FF' },
  muhtsar_sgk:      { label: 'Muhtasar & SGK',         periyot: 'Aylık',    adimlar: ['Tahakkuk','Ödeme'],  icon: Users,      color: '#BF5AF2' },
  gecici_vergi:     { label: 'Geçici Vergi',           periyot: '3 Aylık',  adimlar: ['Tahakkuk','Ödeme'],  icon: TrendingUp, color: '#FF9F0A' },
  kurumlar_vergisi: { label: 'Kurumlar Vergisi',       periyot: 'Yıllık',   adimlar: ['Tahakkuk','Ödeme'],  icon: Landmark,   color: '#FF453A' },
  edefter:          { label: 'E-Defter Gönderimi',     periyot: '3 Aylık',  adimlar: ['Gönderim'],          icon: BookOpen,   color: '#32ADE6' },
  sgk_proje:        { label: 'SGK Tahakkuku (Proje)',  periyot: 'Aylık',    adimlar: ['Tahakkuk','Ödeme'],  icon: Briefcase,  color: '#5AC8F5' },
  banka_mutabakat:  { label: 'Banka Mutabakatı',       periyot: 'Haftalık', adimlar: ['Mutabakat'],         icon: CreditCard, color: '#5E5CE6' },
}

type IsTip = keyof typeof IS_TIPLERI

interface IsTakip {
  id: string; firma_id: string; musteri_id: string | null
  tip: IsTip; donem: string
  adim1_durum: 'bekliyor' | 'tamamlandi'; adim1_tarihi: string | null; adim1_aciklama: string | null
  adim2_durum: 'bekliyor' | 'tamamlandi'; adim2_tarihi: string | null; adim2_aciklama: string | null
  durum: 'aktif' | 'tamamlandi'; notlar: string | null; created_at: string
  hatirlatici_tarihi: string | null; hatirlatici_saati: string | null;
}

interface IsDosya {
  id: string; is_id: string; dosya_adi: string; dosya_url: string
  mime_type: string | null; boyut_byte: number | null; created_at: string
}

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const EMPTY_FORM = { musteri_id: '', tip: 'kdv' as IsTip, donem: '', notlar: '' }

function getDonemler(yil: number, periyot: string): { donem: string; label: string }[] {
  if (periyot === '3 Aylık') return [1,2,3,4].map(q => ({ donem: `${yil}-Q${q}`, label: `Q${q}` }))
  if (periyot === 'Yıllık')  return [{ donem: String(yil), label: 'Yıllık' }]
  return MONTHS.map((lbl, i) => ({ donem: `${yil}-${String(i+1).padStart(2,'0')}`, label: lbl }))
}

// ── Bileşen ───────────────────────────────────────────────────────────────────
function getDonemLabel(donem: string, _periyot: string) {
  const periyot = _periyot
  if (donem.includes('-Q')) return donem.split('-')[1] || donem
  if (!donem.includes('-')) return donem
  if (periyot === '3 AylÄ±k') return donem.split('-')[1] || donem
  if (periyot === 'YÄ±llÄ±k') return 'YÄ±llÄ±k'
  const monthIndex = Number(donem.split('-')[1]) - 1
  return MONTHS[monthIndex] || donem
}

export default function IsTakipModule({ firma, profil, navigate }: AppCtx) {
  const [isler, setIsler]           = useState<IsTakip[]>([])
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [dosyalarMap, setDosyalarMap] = useState<Record<string, IsDosya[]>>({})
  const [uploading, setUploading]     = useState<string | null>(null)
  const [dragOver, setDragOver]       = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [modal, setModal]         = useState<'add' | 'edit' | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [formErr, setFormErr]     = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [aciklamaModal, setAciklamaModal] = useState<{ isId: string; adimNo: 1 | 2; value: string } | null>(null)

  const [selTip, setSelTip]         = useState<string>('kdv')
  const [selMusteri, setSelMusteri] = useState('')
  const [selCell, setSelCell]       = useState<string | null>(null)
  
  // Ana sekme (Sabit / Maliyet)
  const [mainTab, setMainTab]       = useState<'sabit' | 'maliyet'>('sabit')
  const [mobileTab, setMobileTab]   = useState<'isler' | 'donemler'>('isler')

  const [erteleModal, setErteleModal] = useState<IsTakip | null>(null)
  const [erteleForm, setErteleForm]   = useState({ tarih: new Date().toISOString().split('T')[0], saat: '' })
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { load() }, [firma.id])

  useEffect(() => {
    timerRef.current = setInterval(checkReminders, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isler])

  function checkReminders() {
    if (!('Notification' in window)) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().split('T')[0]
    isler.forEach(is => {
      if (is.hatirlatici_saati === hhmm && is.hatirlatici_tarihi === today && is.durum === 'aktif') {
        if (Notification.permission === 'granted') {
          new Notification(`📌 Periyodik İş Hatırlatıcı`, {
            body: `${IS_TIPLERI[is.tip]?.label || 'İş'} - Dönem: ${is.donem}`,
            icon: '/favicon.ico',
          })
        }
      }
    })
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) return
    await Notification.requestPermission()
  }

  async function load() {
    setLoading(true); setError('')
    const [{ data: i, error: e1 }, { data: m }] = await Promise.all([
      supabase.from('is_takip').select('*').eq('firma_id', firma.id).order('donem', { ascending: false }),
      supabase.from('musteriler').select('id,ad,kisa_ad').eq('firma_id', firma.id).eq('aktif', true).order('ad'),
    ])
    if (e1) { setError(e1.message); setLoading(false); return }
    setIsler((i || []) as IsTakip[])
    setMusteriler((m || []) as Musteri[])
    setLoading(false)
  }

  async function save() {
    if (!form.donem.trim()) { setFormErr('Dönem zorunludur'); return }
    setSaving(true); setFormErr('')
    const payload = { firma_id: firma.id, musteri_id: form.musteri_id || null, tip: form.tip, donem: form.donem.trim(), notlar: form.notlar || null }
    const { error: e } = modal === 'add'
      ? await supabase.from('is_takip').insert(payload)
      : await supabase.from('is_takip').update(payload).eq('id', editingId!)
    setSaving(false)
    if (e) { setFormErr(e.message); return }
    setModal(null); load()
  }

  async function deleteIs() {
    await supabase.from('is_takip').delete().eq('id', deletingId!)
    setDeletingId(null); setSelCell(null); load()
  }

  async function toggleDurum(is: IsTakip) {
    const yeni = is.durum === 'aktif' ? 'tamamlandi' : 'aktif'
    await supabase.from('is_takip').update({ durum: yeni }).eq('id', is.id)
    setIsler(prev => prev.map(x => x.id === is.id ? { ...x, durum: yeni } : x))
  }

  async function toggleAdim(is: IsTakip, adimNo: 1 | 2) {
    const dKey = `adim${adimNo}_durum`  as 'adim1_durum' | 'adim2_durum'
    const tKey = `adim${adimNo}_tarihi` as 'adim1_tarihi' | 'adim2_tarihi'
    const yeni = is[dKey] === 'tamamlandi' ? 'bekliyor' : 'tamamlandi'
    const tarih = yeni === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null
    await supabase.from('is_takip').update({ [dKey]: yeni, [tKey]: tarih }).eq('id', is.id)
    setIsler(prev => prev.map(x => x.id === is.id ? { ...x, [dKey]: yeni, [tKey]: tarih } : x))
  }

  async function saveAciklama() {
    if (!aciklamaModal) return
    const key = `adim${aciklamaModal.adimNo}_aciklama`
    await supabase.from('is_takip').update({ [key]: aciklamaModal.value || null }).eq('id', aciklamaModal.isId)
    setIsler(prev => prev.map(x => x.id === aciklamaModal.isId ? { ...x, [key]: aciklamaModal.value || null } : x))
    setAciklamaModal(null)
  }

  async function clearAciklama(isId: string, adimNo: 1 | 2) {
    const key = `adim${adimNo}_aciklama`
    await supabase.from('is_takip').update({ [key]: null }).eq('id', isId)
    setIsler(prev => prev.map(x => x.id === isId ? { ...x, [key]: null } : x))
  }

  async function loadDosyalar(isId: string) {
    const { data } = await supabase.from('is_takip_dosyalar').select('*').eq('is_id', isId).order('created_at')
    setDosyalarMap(prev => ({ ...prev, [isId]: (data || []) as IsDosya[] }))
  }

  async function uploadDosya(isId: string, files: FileList) {
    setUploading(isId)
    for (const file of Array.from(files)) {
      const safe = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `is-takip/${firma.id}/${isId}/${safe}`
      const { error: upErr } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
      if (upErr) { alert('Depolama hatası: ' + upErr.message); continue }
      const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
      await supabase.from('is_takip_dosyalar').insert({
        firma_id: firma.id, is_id: isId,
        dosya_adi: file.name, dosya_url: urlData.publicUrl,
        mime_type: file.type || null, boyut_byte: file.size || null,
      })
    }
    setUploading(null); loadDosyalar(isId)
  }

  async function deleteDosya(isId: string, d: IsDosya) {
    try {
      const url = new URL(d.dosya_url)
      const p = url.pathname.split('/object/public/arsiv/')[1]
      if (p) await supabase.storage.from('arsiv').remove([p])
    } catch {}
    await supabase.from('is_takip_dosyalar').delete().eq('id', d.id)
    setDosyalarMap(prev => ({ ...prev, [isId]: (prev[isId] || []).filter(x => x.id !== d.id) }))
  }

  async function saveErtele() {
    if (!erteleModal) return
    if (!erteleForm.tarih) return
    if (!erteleForm.saat) return
    setSaving(true)
    const { error } = await supabase.from('is_takip').update({
      hatirlatici_tarihi: erteleForm.tarih,
      hatirlatici_saati: erteleForm.saat
    }).eq('id', erteleModal.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    setErteleModal(null); load()
  }

  async function clearErtele(id: string) {
    await supabase.from('is_takip').update({ hatirlatici_tarihi: null, hatirlatici_saati: null }).eq('id', id)
    load()
  }

  const tipDef = IS_TIPLERI[selTip]

  const tipRecords = useMemo(() =>
    isler.filter(x => x.tip === selTip && (!selMusteri || x.musteri_id === selMusteri)),
    [isler, selTip, selMusteri]
  )

  const yillar = useMemo(() => {
    const now = new Date().getFullYear()
    const years = new Set<number>([now - 1, now, now + 1])
    tipRecords.forEach(r => { const y = parseInt(r.donem.slice(0, 4)); if (!isNaN(y)) years.add(y) })
    return Array.from(years).sort()
  }, [tipRecords])

  function handleCellClick(donem: string, record: IsTakip | undefined) {
    if (record) {
      const next = selCell === record.id ? null : record.id
      setSelCell(next)
      if (next) loadDosyalar(record.id)
    } else {
      setForm({ musteri_id: selMusteri, tip: selTip as IsTip, donem, notlar: '' })
      setEditingId(null); setFormErr(''); setModal('add')
    }
  }

  if (loading) return <Loading />
  if (error)   return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-0 -mx-3 md:-mx-5 -mt-3 md:-mt-5">

      {/* ── Üst Bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-[rgba(60,60,67,0.36)] shrink-0 flex-wrap"
        style={{ background: 'rgba(28,28,30,0.95)' }}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white flex-1 uppercase">
          Periyodik İşler
        </h1>
        {!('Notification' in window && Notification.permission === 'granted') && (
          <button onClick={requestNotifPermission} className="flex items-center gap-2 text-[11px] font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-2 rounded-xl transition-all">
            <BellRing size={14} /> İzin Ver
          </button>
        )}
        {musteriler.length > 0 && (
          <select
            value={selMusteri}
            onChange={e => { setSelMusteri(e.target.value); setSelCell(null) }}
            className="bg-[#2C2C2E] border border-[rgba(60,60,67,0.5)] text-white text-xs rounded-[10px] px-3 py-2 outline-none focus:border-[#0A84FF]">
            <option value="">Tüm Firmalar</option>
            {musteriler.map(m => <option key={m.id} value={m.id}>{m.kisa_ad || m.ad}</option>)}
          </select>
        )}
        <button
          onClick={() => {
            const now = new Date().toISOString().slice(0, 7)
            setForm({ musteri_id: selMusteri, tip: selTip as IsTip, donem: now, notlar: '' })
            setEditingId(null); setFormErr(''); setModal('add')
          }}
          className={cls.btnPrimary}>
          <Plus size={14} /> Yeni İş
        </button>
      </div>

      {/* ── Main Tab ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 mx-4 sm:mx-6 mt-4 bg-slate-800/50 rounded-xl border border-white/5 shadow-inner backdrop-blur-3xl shrink-0">
        <button onClick={() => setMainTab('sabit')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 justify-center ${mainTab === 'sabit' ? 'bg-blue-500/20 text-blue-400 shadow-lg border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
          <Briefcase size={14} /> Sabit Beyannameler
        </button>
        <button onClick={() => setMainTab('maliyet')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 justify-center ${mainTab === 'maliyet' ? 'bg-indigo-500/20 text-indigo-400 shadow-lg border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
          <Receipt size={14} /> Aylık Maliyet Takibi
        </button>
      </div>

      {mainTab === 'maliyet' ? (
        <AylikMaliyetModule firma={firma} profil={profil} navigate={navigate} />
      ) : (
        <>
          {/* ── Mobil Sekme ──────────────────────────────────────────────────────── */}
      <div className="flex sm:hidden border-b border-[rgba(60,60,67,0.36)] shrink-0 bg-[#1C1C1E]">
        <button onClick={() => setMobileTab('isler')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-all ${mobileTab === 'isler' ? 'text-[#0A84FF] border-b-2 border-[#0A84FF]' : 'text-[rgba(235,235,245,0.4)]'}`}>
          İşler
        </button>
        <button onClick={() => setMobileTab('donemler')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-all truncate px-2 ${mobileTab === 'donemler' ? 'text-[#0A84FF] border-b-2 border-[#0A84FF]' : 'text-[rgba(235,235,245,0.4)]'}`}>
          {tipDef?.label ?? 'Dönemler'}
        </button>
      </div>

      {/* ── Ana İki Panel ────────────────────────────────────────────────────── */}
      <div className="flex min-h-0">

        {/* ── Sol: İş Tipi Listesi ──────────────────────────────────────────── */}
        <div className={`${mobileTab === 'isler' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-72 border-r border-[rgba(60,60,67,0.36)] py-3 px-3 shrink-0 bg-[#1C1C1E]`}>
          <p className="text-[10px] font-bold text-[rgba(235,235,245,0.3)] uppercase tracking-widest px-2 mb-2">
            İş Türleri
          </p>
          {Object.entries(IS_TIPLERI).map(([key, def]) => {
            const Icon = def.icon
            const recs = isler.filter(x => x.tip === key && (!selMusteri || x.musteri_id === selMusteri))
            const doneCount = recs.filter(x => x.durum === 'tamamlandi').length
            const isActive = selTip === key
            return (
              <button key={key}
                onClick={() => { setSelTip(key); setSelCell(null); setMobileTab('donemler') }}
                className={`flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all mb-1 border ${
                  isActive ? 'border-[rgba(10,132,255,0.3)]' : 'border-transparent hover:bg-[rgba(60,60,67,0.3)]'
                }`}
                style={{ background: isActive ? `${def.color}18` : undefined }}>
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                  style={{ background: isActive ? `${def.color}30` : 'rgba(60,60,67,0.6)' }}>
                  <Icon size={18} style={{ color: isActive ? def.color : 'rgba(235,235,245,0.55)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: isActive ? def.color : 'rgba(235,235,245,0.9)' }}>
                    {def.label}
                  </p>
                  <p className="text-xs text-[rgba(235,235,245,0.35)] mt-0.5">{def.periyot}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {recs.length > 0 ? (
                    <>
                      <span className="text-xs font-bold"
                        style={{ color: doneCount === recs.length ? '#30D158' : '#FF9F0A' }}>
                        {doneCount}/{recs.length}
                      </span>
                      <div className="w-10 h-1 rounded-full bg-[rgba(60,60,67,0.5)] overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round((doneCount / recs.length) * 100)}%`,
                            background: doneCount === recs.length ? '#30D158' : '#FF9F0A',
                          }} />
                      </div>
                    </>
                  ) : (
                    <span className="text-[10px] text-[rgba(235,235,245,0.2)]">—</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Sağ: Yıl Kartları Yan Yana ───────────────────────────────────── */}
        <div className={`${mobileTab === 'donemler' ? 'flex' : 'hidden'} sm:flex flex-1 overflow-x-auto overflow-y-auto bg-[#000000]`}>
          <div className="flex gap-4 p-4 items-start w-full min-w-max">

            {yillar.map(yil => {
              const donemler = getDonemler(yil, tipDef?.periyot ?? 'Aylık')
              const yilRecs  = tipRecords.filter(r => r.donem.startsWith(String(yil)))
              const yilDone  = yilRecs.filter(r => r.durum === 'tamamlandi').length

              return (
                <div key={yil} className="rounded-2xl border border-[rgba(60,60,67,0.36)] overflow-hidden flex-1"
                  style={{ minWidth: '260px', background: '#1C1C1E' }}>

                  {/* Yıl başlığı */}
                  <div className="px-4 py-3 border-b border-[rgba(60,60,67,0.36)]"
                    style={{ background: tipDef ? `${tipDef.color}18` : '#2C2C2E' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-white">{yil}</p>
                      {yilRecs.length > 0 && (
                        <span className="text-[10px] font-bold"
                          style={{ color: yilDone === yilRecs.length ? '#30D158' : '#FF9F0A' }}>
                          {yilDone}/{yilRecs.length}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[rgba(235,235,245,0.4)] mt-0.5 truncate">
                      {tipDef?.label}
                    </p>
                  </div>

                  {/* Dönem satırları */}
                  <div>
                    {donemler.map(({ donem, label }) => {
                      const record    = tipRecords.find(r => r.donem === donem)
                      const isSelected = selCell === record?.id
                      const a1        = record?.adim1_durum === 'tamamlandi'
                      const a2        = record?.adim2_durum === 'tamamlandi'
                      const adim2Var  = (tipDef?.adimlar.length ?? 0) > 1
                      const tamam     = record?.durum === 'tamamlandi'

                      return (
                        <div key={donem}
                          className="border-b border-[rgba(60,60,67,0.15)] last:border-b-0"
                          style={{ background: isSelected ? 'rgba(10,132,255,0.06)' : undefined }}>

                          {/* Satır butonu */}
                          <button
                            onClick={() => handleCellClick(donem, record)}
                            className="group w-full flex items-center gap-2 px-3 py-3 hover:bg-[rgba(255,255,255,0.04)] transition-colors text-left">
                            <span className="text-xs font-medium text-[rgba(235,235,245,0.45)] w-7 shrink-0">
                              {label}
                            </span>

                            {record ? (
                              <div className="flex-1 flex items-center gap-1">
                                {(tipDef?.adimlar ?? []).map((_, idx) => {
                                  const done = idx === 0 ? a1 : a2
                                  return (
                                    <div key={idx} className="flex-1 h-1 rounded-full transition-all"
                                      style={{ background: done ? '#30D158' : 'rgba(255,159,10,0.55)' }} />
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="flex-1 h-px bg-[rgba(60,60,67,0.35)]" />
                            )}

                            <div className="w-8 flex items-center justify-center shrink-0">
                              {record ? (
                                tamam
                                  ? <CheckCircle2 size={13} style={{ color: '#30D158' }} />
                                  : <Clock size={12} style={{ color: '#FF9F0A' }} />
                              ) : (
                                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgba(255,255,255,0.03)] text-[rgba(235,235,245,0.2)] transition-colors group-hover:bg-[rgba(10,132,255,0.12)] group-hover:text-[#0A84FF]">
                                  <Plus size={13} />
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Genişletilmiş detay */}
                          {isSelected && record && (
                            <div className="border-t border-[rgba(60,60,67,0.36)] p-3 space-y-2.5"
                              style={{ background: '#000000' }}>

                              {/* Adımlar */}
                              <div className="space-y-1.5">
                                {(tipDef?.adimlar ?? []).map((adimLbl, idx) => {
                                  const adimNo = (idx + 1) as 1 | 2
                                  const dKey   = `adim${adimNo}_durum`    as 'adim1_durum' | 'adim2_durum'
                                  const tKey   = `adim${adimNo}_tarihi`   as 'adim1_tarihi' | 'adim2_tarihi'
                                  const aKey   = `adim${adimNo}_aciklama` as 'adim1_aciklama' | 'adim2_aciklama'
                                  const done   = record[dKey] === 'tamamlandi'
                                  const tarih  = record[tKey]
                                  const aclm   = record[aKey]
                                  return (
                                    <div key={idx}
                                      className="flex items-start gap-2 p-2 rounded-[10px] border"
                                      style={{
                                        background: done ? 'rgba(48,209,88,0.06)' : 'rgba(60,60,67,0.2)',
                                        borderColor: done ? 'rgba(48,209,88,0.2)' : 'rgba(60,60,67,0.4)',
                                      }}>
                                      <button onClick={() => toggleAdim(record, adimNo)}
                                        className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all"
                                        style={{
                                          borderColor: done ? '#30D158' : 'rgba(60,60,67,0.7)',
                                          background: done ? '#30D158' : 'transparent',
                                        }}>
                                        {done && <CheckCircle2 size={10} className="text-black" />}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-semibold"
                                          style={{ color: done ? '#30D158' : 'rgba(235,235,245,0.8)' }}>
                                          {adimLbl}
                                        </p>
                                        {tarih && (
                                          <p className="text-[10px] text-[rgba(235,235,245,0.3)]">
                                            {new Date(tarih).toLocaleDateString('tr-TR')}
                                          </p>
                                        )}
                                        {aclm && (
                                          <p className="text-[10px] text-[rgba(235,235,245,0.45)] italic mt-0.5">
                                            "{aclm}"
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        <button onClick={() => setAciklamaModal({ isId: record.id, adimNo, value: aclm || '' })}
                                          className="min-w-7 h-7 rounded-md flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#FF9F0A] hover:bg-[rgba(255,159,10,0.12)] transition-colors">
                                          <Pencil size={10} />
                                        </button>
                                        {aclm && (
                                          <button onClick={() => clearAciklama(record.id, adimNo)}
                                            className="min-w-7 h-7 rounded-md flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#FF453A] hover:bg-[rgba(255,69,58,0.12)] transition-colors">
                                            <X size={10} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Notlar */}
                              {record.notlar && (
                                <p className="text-[10px] text-[rgba(235,235,245,0.4)] italic bg-[rgba(60,60,67,0.3)] rounded-[8px] px-2.5 py-1.5">
                                  {record.notlar}
                                </p>
                              )}

                              {/* Dökümanlar */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-[10px] font-bold text-[rgba(235,235,245,0.3)] uppercase tracking-wider">
                                    Döküman{(dosyalarMap[record.id] || []).length > 0 && ` (${dosyalarMap[record.id].length})`}
                                  </p>
                                  <button onClick={() => fileRefs.current[record.id]?.click()}
                                    disabled={uploading === record.id}
                                    className="flex items-center gap-1 text-[10px] text-[#0A84FF] hover:bg-[rgba(10,132,255,0.1)] px-2 py-1 rounded-[6px] transition-all disabled:opacity-40">
                                    <Upload size={9} /> Seç
                                  </button>
                                  <input type="file" multiple className="hidden"
                                    accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    ref={el => { fileRefs.current[record.id] = el }}
                                    onChange={e => { if (e.target.files) { uploadDosya(record.id, e.target.files); e.target.value = '' } }} />
                                </div>

                                <div
                                  onDragEnter={e => { e.preventDefault(); setDragOver(record.id) }}
                                  onDragOver={e => { e.preventDefault(); setDragOver(record.id) }}
                                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                                  onDrop={e => { e.preventDefault(); setDragOver(null); if (e.dataTransfer.files.length) uploadDosya(record.id, e.dataTransfer.files) }}
                                  className="rounded-[10px] border border-dashed transition-all"
                                  style={{
                                    borderColor: dragOver === record.id ? '#0A84FF' : 'rgba(60,60,67,0.4)',
                                    background: dragOver === record.id ? 'rgba(10,132,255,0.08)' : undefined,
                                  }}>
                                  {(dosyalarMap[record.id] || []).length === 0 && uploading !== record.id && (
                                    <button onClick={() => fileRefs.current[record.id]?.click()}
                                      className="w-full flex items-center justify-center gap-1.5 py-3 text-[10px] text-[rgba(235,235,245,0.3)] hover:text-[#0A84FF] transition-colors">
                                      <Upload size={11} />
                                      {dragOver === record.id ? 'Bırakın...' : 'PDF sürükleyin veya seçin'}
                                    </button>
                                  )}
                                  {uploading === record.id && (
                                    <div className="flex justify-center py-3">
                                      <Clock size={14} className="animate-spin text-[#0A84FF]" />
                                    </div>
                                  )}
                                  {(dosyalarMap[record.id] || []).length > 0 && (
                                    <div className="p-1.5 space-y-1">
                                      {(dosyalarMap[record.id] || []).map(d => {
                                        const isImg = d.mime_type?.startsWith('image/')
                                        const isXls = d.mime_type?.includes('sheet') || /\.xlsx?$/i.test(d.dosya_adi)
                                        const isPdf = d.mime_type === 'application/pdf' || /\.pdf$/i.test(d.dosya_adi)
                                        const FileIcon = isImg ? Image : isXls ? FileSpreadsheet : FileText
                                        return (
                                          <div key={d.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-[8px] bg-[rgba(60,60,67,0.3)] group">
                                            <FileIcon size={11} className="shrink-0"
                                              style={{ color: isPdf ? '#FF453A' : isXls ? '#30D158' : isImg ? '#BF5AF2' : 'rgba(235,235,245,0.4)' }} />
                                            <p className="flex-1 text-[10px] text-[rgba(235,235,245,0.7)] truncate">{d.dosya_adi}</p>
                                            <a href={d.dosya_url} target="_blank" rel="noreferrer"
                                              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#0A84FF] transition-all">
                                              <Download size={10} />
                                            </a>
                                            <button onClick={() => deleteDosya(record.id, d)}
                                              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#FF453A] transition-all">
                                              <X size={10} />
                                            </button>
                                          </div>
                                        )
                                      })}
                                      {dragOver === record.id && (
                                        <div className="flex items-center justify-center gap-1 py-1.5">
                                          <Upload size={10} className="text-[#0A84FF]" />
                                          <span className="text-[10px] text-[#0A84FF]">Bırakın ekleyin</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Aksiyon butonları */}
                              <div className="flex items-center gap-1.5 pt-1 border-t border-[rgba(60,60,67,0.3)]">
                                <button onClick={() => toggleDurum(record)}
                                  className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-[8px] transition-all"
                                  style={{
                                    background: tamam ? 'rgba(255,69,58,0.1)' : 'rgba(48,209,88,0.1)',
                                    color: tamam ? '#FF453A' : '#30D158',
                                  }}>
                                  {tamam ? <ToggleLeft size={11} /> : <ToggleRight size={11} />}
                                  {tamam ? 'Aktife Al' : 'Tamamlandı'}
                                </button>
                                <button onClick={() => setErteleModal(record)}
                                   className={`min-h-9 flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-[10px] transition-all border ${record.hatirlatici_tarihi || record.hatirlatici_saati ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20' : 'text-[rgba(235,235,245,0.4)] border-transparent hover:text-white hover:bg-[rgba(60,60,67,0.3)]'}`}>
                                   <BellRing size={12} /> {(record.hatirlatici_tarihi || record.hatirlatici_saati) ? (record.hatirlatici_saati || 'Hatırlatıcı') : 'Hatırlat'}
                                </button>
                                <button onClick={() => {
                                  setForm({ musteri_id: record.musteri_id || '', tip: record.tip, donem: record.donem, notlar: record.notlar || '' })
                                  setEditingId(record.id); setFormErr(''); setModal('edit')
                                }} className="min-h-9 flex items-center gap-1.5 text-[11px] text-[rgba(235,235,245,0.4)] hover:text-white px-3 py-2 rounded-[10px] hover:bg-[rgba(60,60,67,0.3)] transition-all">
                                  <Pencil size={12} /> Düzenle
                                </button>
                                <button onClick={() => setDeletingId(record.id)}
                                  className="flex items-center gap-1 text-[10px] text-[rgba(235,235,245,0.3)] hover:text-[#FF453A] px-2 py-1.5 rounded-[8px] hover:bg-[rgba(255,69,58,0.08)] transition-all ml-auto">
                                  <Trash2 size={10} /> Sil
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Yıl altı: ekle */}
                    <div className="px-3 py-2 border-t border-[rgba(60,60,67,0.2)]">
                      <button
                        onClick={() => {
                          const firstDonem = getDonemler(yil, tipDef?.periyot ?? 'Aylık')[0]?.donem ?? String(yil)
                          setForm({ musteri_id: selMusteri, tip: selTip as IsTip, donem: firstDonem, notlar: '' })
                          setEditingId(null); setFormErr(''); setModal('add')
                        }}
                        className="w-full min-h-9 flex items-center justify-center gap-1.5 text-[11px] text-[rgba(235,235,245,0.35)] hover:text-[#0A84FF] hover:bg-[rgba(10,132,255,0.08)] py-2 rounded-[10px] transition-colors">
                        <Plus size={12} /> {yil} ekle
                      </button>
                    </div>
                </div>
              )
            })}

          </div>
        </div>
      </div>
      </>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {modal && (
        <Modal title={modal === 'add' ? 'Yeni Periyodik İş' : 'İş Düzenle'} onClose={() => setModal(null)} size="md"
          footer={<>
            <button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button>
            <button onClick={save} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </>}>
          <div className="space-y-4">
            <Field label="İş Tipi" required>
              <select className={cls.input} value={form.tip} onChange={e => setForm(p => ({ ...p, tip: e.target.value as IsTip }))}>
                {Object.entries(IS_TIPLERI).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.periyot}</option>)}
              </select>
            </Field>
            <Field label="Müşteri">
              <select className={cls.input} value={form.musteri_id} onChange={e => setForm(p => ({ ...p, musteri_id: e.target.value }))}>
                <option value="">— Müşteri seçin —</option>
                {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
              </select>
            </Field>
            <Field label="Dönem" required error={formErr}
              hint="Aylık: 2025-03 · 3 Aylık: 2025-Q1 · Yıllık: 2025 · Haftalık: 2025-W12">
              <input className={cls.input} placeholder="2025-03" autoFocus
                value={form.donem} onChange={e => setForm(p => ({ ...p, donem: e.target.value }))} />
            </Field>
            <Field label="Notlar">
              <textarea className={`${cls.input} resize-none`} rows={2}
                value={form.notlar} onChange={e => setForm(p => ({ ...p, notlar: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {aciklamaModal && (() => {
        const is = isler.find(x => x.id === aciklamaModal.isId)
        const adimLbl = is ? IS_TIPLERI[is.tip]?.adimlar[aciklamaModal.adimNo - 1] : ''
        return (
          <Modal title={`Açıklama — ${adimLbl}`} onClose={() => setAciklamaModal(null)} size="sm"
            footer={<>
              <button onClick={() => setAciklamaModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={saveAciklama} className={cls.btnPrimary}>Kaydet</button>
            </>}>
            <textarea className={`${cls.input} resize-none`} rows={4} autoFocus
              placeholder="Açıklama girin..."
              value={aciklamaModal.value}
              onChange={e => setAciklamaModal(p => p ? { ...p, value: e.target.value } : p)} />
          </Modal>
        )
      })()}

      {deletingId && (
        <ConfirmModal title="İşi Sil"
          message="Bu işi ve tüm dökümanları silmek istediğinizden emin misiniz?"
          danger onConfirm={deleteIs} onCancel={() => setDeletingId(null)} />
      )}

      {/* ── Hatırlatıcı / Erteleme Modalı ──────────────────────────────────────── */}
      {erteleModal && (
        <Modal title="Hatırlatıcı Ayarla / Ertele" onClose={() => setErteleModal(null)} size="sm" footer={<><button onClick={() => setErteleModal(null)} className={cls.btnSecondary}>İptal</button><button onClick={saveErtele} disabled={saving} className={cls.btnPrimary}>{saving ? 'Ayarlanıyor...' : 'Ayarla'}</button></>}>
          <div className="space-y-4">
            <Field label="Yeni Tarih">
              <input type="date" className={cls.input} value={erteleForm.tarih} onChange={e => setErteleForm(p => ({ ...p, tarih: e.target.value }))} autoFocus />
            </Field>
            <Field label="Yeni Saat">
              <input type="time" className={cls.input} value={erteleForm.saat} onChange={e => setErteleForm(p => ({ ...p, saat: e.target.value }))} />
            </Field>
            {(erteleModal.hatirlatici_tarihi || erteleModal.hatirlatici_saati) && (
              <button type="button" onClick={() => { clearErtele(erteleModal.id); setErteleModal(null) }} className="w-full text-xs text-red-400 hover:text-red-300 py-2 border border-dashed border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors">
                Mevcut Ertelemeyi Temizle
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
