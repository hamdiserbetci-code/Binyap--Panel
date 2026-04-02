'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock, FileSpreadsheet, FileText, Plus, Upload, User2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'
import type { Dokuman, KullaniciProfil, MaliyetSureci as MaliyetSureciBase, Musteri } from '@/types'
import { cls, ErrorMsg, Field, Loading, Modal } from '@/components/ui'

const RAPOR_TIPLERI = [
  { key: 'efatura', label: 'E-Fatura Alis Raporu', accent: 'blue' },
  { key: 'earsiv', label: 'E-Arsiv Fatura Raporu', accent: 'emerald' },
  { key: 'utts', label: 'UTTS Alis Raporu', accent: 'amber' },
  { key: 'bordro', label: 'Aylik Bordro Icmal Raporu', accent: 'violet' },
  { key: 'satis', label: 'Aylik Satis Raporu', accent: 'rose' },
] as const

interface MaliyetSureci extends MaliyetSureciBase {
  musteri_id?: string | null;
}

type RaporKey = (typeof RAPOR_TIPLERI)[number]['key']
type ReminderState = { id: string; tarih: string; saat: string; hasExisting: boolean }
type DonemForm = { donem: string; sorumlu_id: string; teslim_gunu: string }
type MetaModalState = { id: string; sorumlu_id: string; teslim_gunu: string }

const EMPTY_FORM: DonemForm = {
  donem: new Date().toISOString().slice(0, 7),
  sorumlu_id: '',
  teslim_gunu: '',
}

const ACCEPTED_TYPES = '.xlsx,.xls,.pdf'

const ACCENT_STYLES: Record<string, { soft: string; text: string; border: string }> = {
  blue: { soft: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20' },
  emerald: { soft: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' },
  amber: { soft: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' },
  violet: { soft: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-500/20' },
  rose: { soft: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20' },
}

function donemLabel(donem: string) {
  const [yil, ay] = donem.split('-')
  const aylar = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik']
  const index = Number(ay) - 1
  if (index < 0 || index > 11) return donem
  return `${aylar[index]} ${yil}`
}

function getReportState(surec: MaliyetSureci, key: RaporKey) {
  const kontrol = Boolean(surec[`${key}_kontrol` as keyof MaliyetSureci])
  const luca = Boolean(surec[`${key}_luca` as keyof MaliyetSureci])
  return { kontrol, luca, tamamlandi: kontrol && luca }
}

function getCompletedCount(surec: MaliyetSureci) {
  return RAPOR_TIPLERI.filter(({ key }) => getReportState(surec, key).tamamlandi).length
}

function getOverallStatus(surec: MaliyetSureci) {
  return getCompletedCount(surec) === RAPOR_TIPLERI.length ? 'tamamlandi' : 'bekliyor'
}

function fileTypeLabel(doc: Dokuman) {
  const isSheet = doc.mime_type?.includes('sheet') || /\.xlsx?$/i.test(doc.dosya_adi)
  return isSheet ? 'Excel' : 'PDF'
}

function getSorumluLabel(surec: MaliyetSureci, kullanicilar: KullaniciProfil[]) {
  const sorumlu = kullanicilar.find((item) => item.id === surec.sorumlu_id)
  return sorumlu?.ad_soyad || sorumlu?.email || 'Atanmadi'
}

function getTeslimTarihi(donem: string, teslimGunu?: number | null) {
  if (!teslimGunu) return null
  const [yilRaw, ayRaw] = getNextMonth(donem).split('-')
  const yil = Number(yilRaw)
  const ay = Number(ayRaw)
  if (!yil || !ay) return null
  const sonGun = new Date(yil, ay, 0).getDate()
  const gun = Math.min(teslimGunu, sonGun)
  return new Date(yil, ay - 1, gun)
}

function getIslemAyLabel(donem: string) {
  return donemLabel(getNextMonth(donem))
}

function getTeslimLabel(donem: string, teslimGunu?: number | null) {
  const tarih = getTeslimTarihi(donem, teslimGunu)
  return tarih ? tarih.toLocaleDateString('tr-TR') : 'Belirlenmedi'
}

function getGecikmeDurumu(surec: MaliyetSureci) {
  const tarih = getTeslimTarihi(surec.donem, surec.teslim_gunu)
  if (!tarih || surec.durum === 'tamamlandi') return false
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return tarih.getTime() < now.getTime()
}

function getNextMonth(donem: string) {
  const [yilRaw, ayRaw] = donem.split('-')
  const tarih = new Date(Number(yilRaw), Number(ayRaw) - 1, 1)
  tarih.setMonth(tarih.getMonth() + 1)
  return `${tarih.getFullYear()}-${String(tarih.getMonth() + 1).padStart(2, '0')}`
}

export default function AylikMaliyet({ firma, profil, selectedMusteri }: AppCtx & { musteriler: Musteri[], selectedMusteri: string }) {
  const [surecler, setSurecler] = useState<MaliyetSureci[]>([])
  const [kullanicilar, setKullanicilar] = useState<KullaniciProfil[]>([])
  const [dosyaMap, setDosyaMap] = useState<Record<string, Dokuman[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [donemForm, setDonemForm] = useState<DonemForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingItem, setUploadingItem] = useState<{ id: string; rKey: RaporKey } | null>(null)
  const [reminderModal, setReminderModal] = useState<ReminderState | null>(null)
  const [noteModal, setNoteModal] = useState<{ id: string; value: string } | null>(null)
  const [metaModal, setMetaModal] = useState<MetaModalState | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { load() }, [firma.id])
  useEffect(() => {
    timerRef.current = setInterval(checkReminders, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [surecler])

  const filteredSurecler = useMemo(() => {
    if (!selectedMusteri) return [];
    return surecler.filter(s => s.musteri_id === selectedMusteri);
  }, [surecler, selectedMusteri]);

  const summary = useMemo(() => {
    const toplamDonem = filteredSurecler.length
    const tamamlananDonem = filteredSurecler.filter((s) => getOverallStatus(s) === 'tamamlandi').length
    const bekleyenDonem = toplamDonem - tamamlananDonem
    const aktifHatirlatma = filteredSurecler.filter((s) => s.hatirlatici_tarihi || s.hatirlatici_saati).length
    const gecikenDonem = filteredSurecler.filter((s) => getGecikmeDurumu(s)).length
    return { toplamDonem, tamamlananDonem, bekleyenDonem, aktifHatirlatma, gecikenDonem }
  }, [filteredSurecler])

  async function requestNotifPermission() {
    if (!('Notification' in window)) return
    await Notification.requestPermission()
  }

  function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().split('T')[0]
    surecler.forEach((surec) => {
      if (surec.hatirlatici_tarihi === today && surec.hatirlatici_saati === hhmm && getOverallStatus(surec) !== 'tamamlandi') {
        new Notification('Aylik maliyet hatirlaticisi', { body: `${donemLabel(surec.donem)} donemi ${getIslemAyLabel(surec.donem)} icinde tamamlanmadi.`, icon: '/favicon.ico' })
      }
    })
  }

  async function load() {
    setLoading(true)
    setError('')
    const [{ data, error: loadError }, { data: userData, error: userError }] = await Promise.all([
      supabase.from('maliyet_surecler').select('*').eq('firma_id', firma.id).order('donem', { ascending: false }),
      supabase.from('kullanici_profilleri').select('*').eq('firma_id', firma.id).eq('aktif', true).order('ad_soyad'),
    ])
    if (loadError || userError) {
      setError(loadError?.message || userError?.message || 'Veriler yuklenemedi.')
      setLoading(false)
      return
    }
    const rows = (data || []) as MaliyetSureci[]
    setSurecler(rows)
    setKullanicilar((userData || []) as KullaniciProfil[])
    if (rows.length > 0 && !expandedId) setExpandedId(rows[0].id)
    const ids = rows.map((row) => row.id)
    if (ids.length === 0) {
      setDosyaMap({})
      setLoading(false)
      return
    }
    const { data: docs, error: docsError } = await supabase.from('dokumanlar').select('*').eq('firma_id', firma.id).eq('bagli_tablo', 'maliyet_surecler').in('bagli_kayit_id', ids).order('created_at', { ascending: false })
    if (docsError) {
      setError(docsError.message)
      setLoading(false)
      return
    }
    const nextMap: Record<string, Dokuman[]> = {}
    ;(docs || []).forEach((doc) => {
      const key = `${doc.bagli_kayit_id}_${doc.kategori}`
      if (!nextMap[key]) nextMap[key] = []
      nextMap[key].push(doc as Dokuman)
    })
    setDosyaMap(nextMap)
    setLoading(false)
  }

  function resetDonemForm() {
    setDonemForm({ donem: new Date().toISOString().slice(0, 7), sorumlu_id: '', teslim_gunu: '' })
  }

  async function createDonem(payload?: Partial<DonemForm>) {
    const form = { donem: payload?.donem ?? donemForm.donem, sorumlu_id: payload?.sorumlu_id ?? donemForm.sorumlu_id, teslim_gunu: payload?.teslim_gunu ?? donemForm.teslim_gunu }
    if (!form.donem) return false
    setSaving(true)
    const { error: insertError } = await supabase.from('maliyet_surecler').insert({
      firma_id: firma.id,
      donem: form.donem,
      sorumlu_id: form.sorumlu_id || null,
      teslim_gunu: form.teslim_gunu ? Number(form.teslim_gunu) : null,
      musteri_id: selectedMusteri || null,
    })
    setSaving(false)
    if (insertError) {
      alert(insertError.message)
      return false
    }
    setShowAdd(false)
    resetDonemForm()
    await load()
    return true
  }

  async function cloneNextMonth(surec: MaliyetSureci) {
    const { error: insertError } = await supabase.from('maliyet_surecler').insert({
      firma_id: firma.id,
      donem: getNextMonth(surec.donem),
      sorumlu_id: surec.sorumlu_id || null,
      teslim_gunu: surec.teslim_gunu,
      musteri_id: surec.musteri_id || null,
    })
    if (insertError) { alert(insertError.message); return }
    await load()
  }

  async function updateSurec(id: string, payload: Partial<MaliyetSureci>) {
    const { error: updateError } = await supabase.from('maliyet_surecler').update(payload).eq('id', id)
    if (updateError) {
      alert(updateError.message)
      await load()
      return false
    }
    return true
  }

  async function toggleField(surec: MaliyetSureci, key: keyof MaliyetSureci) {
    const nextValue = !Boolean(surec[key])
    const nextSurec = { ...surec, [key]: nextValue } as MaliyetSureci
    const nextDurum = getOverallStatus(nextSurec)
    setSurecler((prev) => prev.map((item) => (item.id === surec.id ? { ...item, [key]: nextValue, durum: nextDurum } : item)))
    await updateSurec(surec.id, { [key]: nextValue, durum: nextDurum } as Partial<MaliyetSureci>)
  }

  async function toggleOverallDurum(surec: MaliyetSureci) {
    const nextDurum = surec.durum === 'tamamlandi' ? 'bekliyor' : 'tamamlandi'
    setSurecler((prev) => prev.map((item) => (item.id === surec.id ? { ...item, durum: nextDurum } : item)))
    await updateSurec(surec.id, { durum: nextDurum })
  }

  async function saveReminder() {
    if (!reminderModal?.tarih || !reminderModal?.saat) return
    setSaving(true)
    const ok = await updateSurec(reminderModal.id, { hatirlatici_tarihi: reminderModal.tarih, hatirlatici_saati: reminderModal.saat })
    setSaving(false)
    if (!ok) return
    setReminderModal(null)
    await load()
  }

  async function clearReminder(id: string) {
    setSaving(true)
    const ok = await updateSurec(id, { hatirlatici_tarihi: null, hatirlatici_saati: null })
    setSaving(false)
    if (!ok) return
    setReminderModal(null)
    await load()
  }

  async function saveNote() {
    if (!noteModal) return
    setSaving(true)
    const ok = await updateSurec(noteModal.id, { notlar: noteModal.value || null })
    setSaving(false)
    if (!ok) return
    setSurecler((prev) => prev.map((item) => (item.id === noteModal.id ? { ...item, notlar: noteModal.value || null } : item)))
    setNoteModal(null)
  }

  async function saveMeta() {
    if (!metaModal) return
    setSaving(true)
    const ok = await updateSurec(metaModal.id, { sorumlu_id: metaModal.sorumlu_id || null, teslim_gunu: metaModal.teslim_gunu ? Number(metaModal.teslim_gunu) : null })
    setSaving(false)
    if (!ok) return
    setMetaModal(null)
    await load()
  }

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files?.length || !uploadingItem) return
    setSaving(true)
    for (const file of Array.from(files)) {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      const isExcel = file.type.includes('sheet') || file.type.includes('excel') || /\.xlsx?$/i.test(file.name)
      if (!isPdf && !isExcel) {
        alert(`${file.name} sadece Excel veya PDF olarak yuklenebilir.`)
        continue
      }
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `maliyetler/${firma.id}/${uploadingItem.id}/${uploadingItem.rKey}/${safeName}`
      const { error: storageError } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
      if (storageError) {
        alert(storageError.message)
        continue
      }
      const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
      const { error: insertError } = await supabase.from('dokumanlar').insert({
        firma_id: firma.id, yukleyen_id: profil.auth_user_id, modul: 'rapor', kategori: uploadingItem.rKey, bagli_tablo: 'maliyet_surecler',
        bagli_kayit_id: uploadingItem.id, dosya_adi: file.name, dosya_url: urlData.publicUrl, mime_type: file.type || null, dosya_boyutu: file.size || null,
      })
      if (insertError) alert(insertError.message)
    }
    setSaving(false)
    setUploadingItem(null)
    if (fileRef.current) fileRef.current.value = ''
    await load()
  }

  if (loading) return <div className="p-8"><Loading /></div>
  if (error) return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_35%),rgba(15,23,42,0.75)] p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-300/80">Aylik Maliyet Takip Tablosu</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Donem Ayi, Islem Ayi ve Son Teslim tarihi birlikte izlenir</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Bu yapida maliyet dosyalari donem ayina gore kaydedilir, ancak takip ve kapanis bir sonraki islem ayinda yapilir. Ornegin Subat donemi Martta, Mart donemi Nisanda kapatilir.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:max-w-md lg:justify-end">
            <button onClick={requestNotifPermission} className={`${cls.btnSecondary} text-xs`}><BellRing size={14} /> Bildirim izni</button>
            <button onClick={() => { resetDonemForm(); setShowAdd(true) }} className={cls.btnPrimary}><Plus size={16} /> Yeni donem</button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Toplam Donem" value={String(summary.toplamDonem)} tone="slate" />
          <SummaryCard label="Bekleyen Donem" value={String(summary.bekleyenDonem)} tone="amber" />
          <SummaryCard label="Tamamlanan Donem" value={String(summary.tamamlananDonem)} tone="emerald" />
          <SummaryCard label="Geciken Teslim" value={String(summary.gecikenDonem)} tone="rose" />
          <SummaryCard label="Aktif Hatirlatma" value={String(summary.aktifHatirlatma)} tone="indigo" />
        </div>
      </div>
      <input ref={fileRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden" onChange={uploadFile} />
      {filteredSurecler.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/50 p-12 text-center">
          <p className="text-base font-semibold text-white">Bu müşteri için henüz aylık maliyet dönemi oluşturulmadı.</p>
          <p className="mt-2 text-sm text-slate-400">Yeni bir dönem kaydı açarak ilgili ayın maliyet toplama ve sonraki ay kapanış sürecini başlatabilirsiniz.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSurecler.map((surec) => {
            const isExpanded = expandedId === surec.id
            const tamamlanan = getCompletedCount(surec)
            const progress = (tamamlanan / RAPOR_TIPLERI.length) * 100
            const isDone = surec.durum === 'tamamlandi'
            const gecikti = getGecikmeDurumu(surec)

            return (
              <div key={surec.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-xl">
                <button onClick={() => setExpandedId(isExpanded ? null : surec.id)} className="flex w-full flex-col gap-4 p-5 text-left transition-colors hover:bg-white/5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">{surec.donem}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${isDone ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{isDone ? 'Tamamlandi' : 'Bekliyor'}</span>
                        {gecikti && <span className="rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-300">Teslim gecikti</span>}
                        {(surec.hatirlatici_tarihi || surec.hatirlatici_saati) && <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300">Hatirlatma aktif</span>}
                      </div>
                      <h3 className="mt-3 text-xl font-bold text-white">{donemLabel(surec.donem)} Donem Dosyasi</h3>
                      <p className="mt-1 text-sm text-slate-400">Islem Ayi: {getIslemAyLabel(surec.donem)} · Tamamlanan Kalem: {tamamlanan}/{RAPOR_TIPLERI.length}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><User2 size={12} className="text-sky-300" /> Sorumlu: {getSorumluLabel(surec, kullanicilar)}</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><CalendarDays size={12} className="text-cyan-300" /> Islem Ayi: {getIslemAyLabel(surec.donem)}</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><CalendarDays size={12} className="text-amber-300" /> Son Teslim Tarihi: {getTeslimLabel(surec.donem, surec.teslim_gunu)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-start lg:self-center">
                      <div className="min-w-[160px]">
                        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-400"><span>Ilerleme</span><span>%{Math.round(progress)}</span></div>
                        <div className="h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" style={{ width: `${progress}%` }} /></div>
                      </div>
                      {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/10 bg-black/25 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <button onClick={() => toggleOverallDurum(surec)} className={`${cls.btnSecondary} text-xs`}><CheckCircle2 size={14} /> {surec.durum === 'tamamlandi' ? 'Bekliyor olarak isaretle' : 'Donemi tamamlandi olarak isaretle'}</button>
                      <button onClick={() => setMetaModal({ id: surec.id, sorumlu_id: surec.sorumlu_id || '', teslim_gunu: surec.teslim_gunu ? String(surec.teslim_gunu) : '' })} className={`${cls.btnSecondary} text-xs`}><User2 size={14} /> Sorumlu / teslim tarihi</button>
                      <button onClick={() => setReminderModal({ id: surec.id, tarih: surec.hatirlatici_tarihi || new Date().toISOString().split('T')[0], saat: surec.hatirlatici_saati || '', hasExisting: Boolean(surec.hatirlatici_tarihi || surec.hatirlatici_saati) })} className={`${cls.btnSecondary} text-xs`}><BellRing size={14} /> {(surec.hatirlatici_tarihi || surec.hatirlatici_saati) ? 'Hatirlatmayi duzenle' : 'Hatirlatma ekle'}</button>
                      <button onClick={() => setNoteModal({ id: surec.id, value: surec.notlar || '' })} className={`${cls.btnSecondary} text-xs`}><FileText size={14} /> Notlar</button>
                      <button onClick={() => cloneNextMonth(surec)} className={`${cls.btnSecondary} text-xs`}><Plus size={14} /> Sonraki ayi olustur</button>
                    </div>
                    {surec.notlar && (
                      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Donem Notu</p>
                        <p className="mt-2 text-sm leading-6 text-slate-200">{surec.notlar}</p>
                      </div>
                    )}
                    <div className="space-y-3">
                      {RAPOR_TIPLERI.map((rapor) => {
                        const state = getReportState(surec, rapor.key)
                        const docs = dosyaMap[`${surec.id}_${rapor.key}`] || []
                        const accent = ACCENT_STYLES[rapor.accent]
                        return (
                          <div key={rapor.key} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                              <div className="min-w-0 xl:w-[28%]">
                                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${accent.soft} ${accent.border}`}>
                                  <FileText size={13} className={accent.text} />
                                  <span className={`text-xs font-bold uppercase tracking-[0.18em] ${accent.text}`}>{rapor.label}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-3 xl:w-[40%]">
                                <StatusToggle label="Kontrol Edildi" active={state.kontrol} onClick={() => toggleField(surec, `${rapor.key}_kontrol` as keyof MaliyetSureci)} />
                                <StatusToggle label="Luca'ya Yuklendi" active={state.luca} onClick={() => toggleField(surec, `${rapor.key}_luca` as keyof MaliyetSureci)} />
                                <StatusBadge label="Tamamlandi" active={state.tamamlandi} />
                              </div>
                              <div className="xl:w-[32%]">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Evraklar ({docs.length})</p>
                                  <button onClick={() => { setUploadingItem({ id: surec.id, rKey: rapor.key }); fileRef.current?.click() }} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 transition-colors hover:text-white"><Upload size={13} /> Excel / PDF ekle</button>
                                </div>
                                {docs.length === 0 ? (
                                  <div className="mt-2 rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-slate-500">Bu kalem icin henuz evrak yuklenmedi.</div>
                                ) : (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {docs.map((doc) => (
                                      <a key={doc.id} href={doc.dosya_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-white/10">
                                        {fileTypeLabel(doc) === 'Excel' ? <FileSpreadsheet size={12} className="shrink-0 text-emerald-300" /> : <FileText size={12} className="shrink-0 text-rose-300" />}
                                        <span className="truncate">{doc.dosya_adi}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {showAdd && (
        <Modal title="Yeni Aylik Maliyet Donemi" onClose={() => setShowAdd(false)} size="sm" footer={<><button onClick={() => setShowAdd(false)} className={cls.btnSecondary}>Iptal</button><button onClick={() => createDonem()} disabled={saving} className={cls.btnPrimary}>{saving ? 'Olusturuluyor...' : 'Olustur'}</button></>}>
          <div className="space-y-4">
            <Field label="Donem" required hint="Ornek: 2026-03"><input type="month" className={cls.input} value={donemForm.donem} onChange={(e) => setDonemForm((prev) => ({ ...prev, donem: e.target.value }))} autoFocus /></Field>
            <Field label="Sorumlu Kullanici">
              <select className={cls.input} value={donemForm.sorumlu_id} onChange={(e) => setDonemForm((prev) => ({ ...prev, sorumlu_id: e.target.value }))}>
                <option value="">Atanmadi</option>
                {kullanicilar.map((kullanici) => <option key={kullanici.id} value={kullanici.id}>{kullanici.ad_soyad || kullanici.email}</option>)}
              </select>
            </Field>
            <Field label="Son Teslim Gunu" hint="Takip eden islem ayinin hangi gunu tamamlanacagini yazin. Ornek: Subat donemi icin 5 yazarsaniz teslim tarihi 5 Mart olur."><input type="number" min={1} max={31} className={cls.input} value={donemForm.teslim_gunu} onChange={(e) => setDonemForm((prev) => ({ ...prev, teslim_gunu: e.target.value }))} /></Field>
          </div>
        </Modal>
      )}
      {metaModal && (
        <Modal title="Sorumlu ve Teslim Bilgisi" onClose={() => setMetaModal(null)} size="sm" footer={<><button onClick={() => setMetaModal(null)} className={cls.btnSecondary}>Iptal</button><button onClick={saveMeta} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-4">
            <Field label="Sorumlu Kullanici">
              <select className={cls.input} value={metaModal.sorumlu_id} onChange={(e) => setMetaModal((prev) => (prev ? { ...prev, sorumlu_id: e.target.value } : prev))}>
                <option value="">Atanmadi</option>
                {kullanicilar.map((kullanici) => <option key={kullanici.id} value={kullanici.id}>{kullanici.ad_soyad || kullanici.email}</option>)}
              </select>
            </Field>
            <Field label="Son Teslim Gunu" hint="Bu gun, donemin takip eden islem ayi icinde kullanilir."><input type="number" min={1} max={31} className={cls.input} value={metaModal.teslim_gunu} onChange={(e) => setMetaModal((prev) => (prev ? { ...prev, teslim_gunu: e.target.value } : prev))} /></Field>
          </div>
        </Modal>
      )}
      {reminderModal && (
        <Modal title="Hatirlatma Ayarla" onClose={() => setReminderModal(null)} size="sm" footer={<><button onClick={() => setReminderModal(null)} className={cls.btnSecondary}>Iptal</button><button onClick={saveReminder} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-4">
            <Field label="Tarih" required><input type="date" className={cls.input} value={reminderModal.tarih} onChange={(e) => setReminderModal((prev) => (prev ? { ...prev, tarih: e.target.value } : prev))} autoFocus /></Field>
            <Field label="Saat" required><input type="time" className={cls.input} value={reminderModal.saat} onChange={(e) => setReminderModal((prev) => (prev ? { ...prev, saat: e.target.value } : prev))} /></Field>
            {reminderModal.hasExisting && <button type="button" onClick={() => clearReminder(reminderModal.id)} className="w-full rounded-xl border border-dashed border-red-500/30 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10">Mevcut hatirlatmayi temizle</button>}
          </div>
        </Modal>
      )}
      {noteModal && (
        <Modal title="Donem Notlari" onClose={() => setNoteModal(null)} size="sm" footer={<><button onClick={() => setNoteModal(null)} className={cls.btnSecondary}>Iptal</button><button onClick={saveNote} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <Field label="Surec Notu" hint="Bu alana aylik maliyet sureciyle ilgili aciklama, bekleyen konu veya kontrol notu girebilirsiniz.">
            <textarea className={`${cls.input} resize-none`} rows={5} value={noteModal.value} onChange={(e) => setNoteModal((prev) => (prev ? { ...prev, value: e.target.value } : prev))} autoFocus />
          </Field>
        </Modal>
      )}
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'amber' | 'emerald' | 'indigo' | 'rose' }) {
  const tones = { slate: 'bg-white/5 border-white/10 text-white', amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300', emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300', indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300', rose: 'bg-rose-500/10 border-rose-500/20 text-rose-300' }
  return <div className={`rounded-2xl border px-4 py-4 ${tones[tone]}`}><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>
}

function StatusToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}><SwitchKnob checked={active} /><span>{label}</span></button>
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-500'}`}>{active ? <CheckCircle2 size={14} /> : <Clock size={14} />}<span>{label}</span></div>
}

function SwitchKnob({ checked }: { checked: boolean }) {
  return <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} /></span>
}
