'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Plus, Check, Pencil, Trash2, Bell, BellRing, BellOff,
  X, Timer, Zap, CornerDownLeft, Flame, Clock,
  AlertTriangle, CalendarCheck2, Archive, MoreHorizontal,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ConfirmModal } from '@/components/ui'
import type { AppCtx } from '@/app/page'

/* ══════════════════════════════════════════════════════════════════════
   QUADRANT CONFIG  (Eisenhower Matrix)
══════════════════════════════════════════════════════════════════════ */
const Q = {
  q1: {
    id: 'q1',
    label: 'Önemli & Acil',
    sub: 'Hemen Yap',
    color: '#EF4444',
    glow: 'rgba(239,68,68,0.18)',
    bg: 'rgba(239,68,68,0.07)',
    border: 'rgba(239,68,68,0.22)',
    badgeBg: 'rgba(239,68,68,0.15)',
    icon: Flame,
  },
  q2: {
    id: 'q2',
    label: 'Önemli & Acil Değil',
    sub: 'Planla',
    color: '#3B82F6',
    glow: 'rgba(59,130,246,0.18)',
    bg: 'rgba(59,130,246,0.07)',
    border: 'rgba(59,130,246,0.22)',
    badgeBg: 'rgba(59,130,246,0.15)',
    icon: CalendarCheck2,
  },
  q3: {
    id: 'q3',
    label: 'Önemsiz & Acil',
    sub: 'Devret',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.18)',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.22)',
    badgeBg: 'rgba(245,158,11,0.15)',
    icon: AlertTriangle,
  },
  q4: {
    id: 'q4',
    label: 'Önemsiz & Acil Değil',
    sub: 'Ele Al',
    color: '#64748B',
    glow: 'rgba(100,116,139,0.14)',
    bg: 'rgba(100,116,139,0.05)',
    border: 'rgba(100,116,139,0.18)',
    badgeBg: 'rgba(100,116,139,0.15)',
    icon: Archive,
  },
} as const
type QKey = keyof typeof Q

const SNOOZE_PRESETS = [
  { label: '30 dk',  mins: 30  },
  { label: '1 saat', mins: 60  },
  { label: '3 saat', mins: 180 },
  { label: 'Yarın',  mins: -1  },
  { label: 'Hafta',  mins: -7  },
] as const

/* ══════════════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════════════ */
interface GunlukIs {
  id: string
  firma_id: string
  kullanici_id: string | null
  baslik: string
  aciklama: string | null
  matris: QKey
  durum: 'bekliyor' | 'tamamlandi'
  tarih: string
  hatirlatici: string | null
  hatirlatici_tarihi: string | null
  hatirlatici_saati: string | null
  tamamlandi_at: string | null
  created_at: string
}

/* ══════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════ */
const todayStr = () => new Date().toISOString().split('T')[0]
const nowHHMM  = () => new Date().toTimeString().slice(0, 5)
const fmtDate  = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
const fmtRel   = (d: string) => {
  const diff = Math.round((new Date(d + 'T00:00:00').getTime() - new Date(todayStr() + 'T00:00:00').getTime()) / 86400000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Yarın'
  if (diff === -1) return 'Dün'
  if (diff > 0) return `${diff}g sonra`
  return `${Math.abs(diff)}g gecikmiş`
}
const isLate = (is: GunlukIs) => is.durum === 'bekliyor' && is.tarih < todayStr()

function snoozeTo(mins: number): { tarih: string; saat: string } {
  const now = new Date()
  if (mins === -1) { const t = new Date(now); t.setDate(t.getDate() + 1); return { tarih: t.toISOString().split('T')[0], saat: '09:00' } }
  if (mins === -7) { const t = new Date(now); t.setDate(t.getDate() + 7); return { tarih: t.toISOString().split('T')[0], saat: '09:00' } }
  now.setMinutes(now.getMinutes() + mins)
  return { tarih: now.toISOString().split('T')[0], saat: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}` }
}

interface Toast { id: number; msg: string; ok?: boolean }
let toastId = 0

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function GunlukModule({ firma, firmaIds, profil }: AppCtx) {
  const [isler,      setIsler]      = useState<GunlukIs[]>([])
  const [loading,    setLoading]    = useState(true)
  const [toasts,     setToasts]     = useState<Toast[]>([])
  const [notifPerm,  setNotifPerm]  = useState<NotificationPermission>('default')
  const [swReg,      setSwReg]      = useState<ServiceWorkerRegistration | null>(null)
  const [viewFilter, setViewFilter] = useState<'all' | 'today' | 'done'>('all')

  /* quick-add per column */
  const [adding, setAdding] = useState<QKey | null>(null)
  const [quickText, setQuickText] = useState('')
  const [quickDate, setQuickDate] = useState(todayStr())
  const quickRef = useRef<HTMLInputElement>(null)

  /* drawer */
  const EMPTY = { baslik: '', aciklama: '', matris: 'q1' as QKey, hatirlatici: '', tarih: todayStr() }
  const [drawer,  setDrawer]  = useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [form,    setForm]    = useState({ ...EMPTY })
  const [saving,  setSaving]  = useState(false)
  const [formErr, setFormErr] = useState('')

  /* snooze / delete */
  const [snoozeIs,     setSnoozeIs]     = useState<GunlukIs | null>(null)
  const [snoozeCustom, setSnoozeCustom] = useState({ tarih: '', saat: '' })
  const [deleteId,     setDeleteId]     = useState<string | null>(null)

  const firedRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Init ─────────────────────────────────────────────────────────── */
  useEffect(() => { load() }, [firma.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('Notification' in window) setNotifPerm(Notification.permission)
    navigator.serviceWorker?.register('/sw.js').then(r => { r.update(); setSwReg(r) }).catch(() => {})
  }, [])

  useEffect(() => {
    const ch = supabase.channel(`gunluk:${firmaIds.join('-')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gunluk_isler', filter: `firma_id=eq.${firma.id}` }, () => load(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [firmaIds.join(',')])

  useEffect(() => {
    timerRef.current = setInterval(checkReminders, 30_000)
    checkReminders()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isler])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const h = (e: MessageEvent) => {
      const is = isler.find(x => x.id === e.data?.isId)
      if (!is) return
      if (e.data?.type === 'TASK_DONE')   toggleDone(is)
      if (e.data?.type === 'TASK_SNOOZE') applySnooze(is, snoozeTo(e.data.mins ?? 60))
    }
    navigator.serviceWorker.addEventListener('message', h)
    return () => navigator.serviceWorker.removeEventListener('message', h)
  }, [isler])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const { data } = await supabase.from('gunluk_isler').select('*')
      .in('firma_id', firmaIds).order('tarih').order('created_at')
    setIsler((data || []) as GunlukIs[])
    if (!silent) setLoading(false)
  }

  /* ── Toast ─────────────────────────────────────────────────────────── */
  function toast(msg: string, ok = true) {
    const id = ++toastId
    setToasts(p => [...p, { id, msg, ok }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
  }

  /* ── Push ──────────────────────────────────────────────────────────── */
  const checkReminders = useCallback(() => {
    if (typeof window === 'undefined') return
    const today = todayStr(); const hhmm = nowHHMM()
    isler.forEach(is => {
      if (is.durum !== 'bekliyor') return
      const rT = is.hatirlatici_tarihi || is.tarih
      const rS = is.hatirlatici_saati  || is.hatirlatici
      if (!rS || rT !== today || rS > hhmm) return
      const key = `${is.id}:${rS}`
      if (firedRef.current.has(key)) return
      firedRef.current.add(key)
      const title = `⏰ ${is.baslik}`
      toast(title, false)
      if (Notification.permission === 'granted') {
        const opts = { body: is.aciklama || Q[is.matris].label, icon: '/favicon.ico', tag: is.id, data: { url: '/', isId: is.id }, actions: [{ action: 'done', title: '✓ Tamamlandı' }, { action: 'snooze', title: '⏰ 1 saat' }], requireInteraction: true } as NotificationOptions
        swReg ? swReg.showNotification(title, opts) : new Notification(title, opts)
      }
    })
  }, [isler, swReg])

  async function requestNotif() {
    const p = await Notification.requestPermission()
    setNotifPerm(p)
    if (p === 'granted') { toast('Bildirimler aktif 🎉'); swReg?.showNotification('ETM Panel', { body: 'Görev bildirimleri çalışıyor.', icon: '/favicon.ico' }) }
    else toast('Bildirim izni reddedildi.', false)
  }

  /* ── CRUD ──────────────────────────────────────────────────────────── */
  async function quickAdd(col: QKey) {
    if (!quickText.trim()) return
    await supabase.from('gunluk_isler').insert({ firma_id: firma.id, kullanici_id: profil.id, baslik: quickText.trim(), matris: col, tarih: quickDate, aciklama: null, hatirlatici: null })
    setQuickText(''); setAdding(null); toast('Eklendi.')
    await load(true)
  }

  async function save() {
    if (!form.baslik.trim()) { setFormErr('Başlık zorunlu'); return }
    setSaving(true); setFormErr('')
    const payload = { firma_id: firma.id, kullanici_id: profil.id, baslik: form.baslik.trim(), aciklama: form.aciklama.trim() || null, matris: form.matris, hatirlatici: form.hatirlatici || null, tarih: form.tarih }
    const { error } = editId ? await supabase.from('gunluk_isler').update(payload).eq('id', editId) : await supabase.from('gunluk_isler').insert(payload)
    setSaving(false)
    if (error) { setFormErr(error.message); return }
    setDrawer(false); setEditId(null); setForm({ ...EMPTY })
    toast(editId ? 'Güncellendi.' : 'Eklendi.')
    await load(true)
  }

  async function toggleDone(is: GunlukIs) {
    const done = is.durum !== 'tamamlandi'
    await supabase.from('gunluk_isler').update({ durum: done ? 'tamamlandi' : 'bekliyor', tamamlandi_at: done ? new Date().toISOString() : null }).eq('id', is.id)
    setIsler(p => p.map(x => x.id === is.id ? { ...x, durum: done ? 'tamamlandi' : 'bekliyor', tamamlandi_at: done ? new Date().toISOString() : null } : x))
    if (done) toast(`✓ ${is.baslik}`)
  }

  async function doDelete() {
    await supabase.from('gunluk_isler').delete().eq('id', deleteId!)
    setDeleteId(null); toast('Silindi.')
    await load(true)
  }

  async function applySnooze(is: GunlukIs, t: { tarih: string; saat: string }) {
    await supabase.from('gunluk_isler').update({ hatirlatici_tarihi: t.tarih, hatirlatici_saati: t.saat }).eq('id', is.id)
    firedRef.current.delete(`${is.id}:${is.hatirlatici_saati || is.hatirlatici || ''}`)
    setSnoozeIs(null); toast(`⏰ ${fmtDate(t.tarih)} ${t.saat}`)
    await load(true)
  }

  function openEdit(is: GunlukIs) {
    setForm({ baslik: is.baslik, aciklama: is.aciklama || '', matris: is.matris, hatirlatici: is.hatirlatici || '', tarih: is.tarih })
    setEditId(is.id); setFormErr(''); setDrawer(true)
  }

  /* ── Derived ───────────────────────────────────────────────────────── */
  const today   = todayStr()
  const visible = isler.filter(is => {
    if (viewFilter === 'today') return is.tarih === today && is.durum === 'bekliyor'
    if (viewFilter === 'done')  return is.durum === 'tamamlandi'
    return is.durum === 'bekliyor'
  })

  const byQ = (q: QKey) => visible.filter(x => x.matris === q)
    .sort((a, b) => {
      if (isLate(a) && !isLate(b)) return -1
      if (!isLate(a) && isLate(b)) return 1
      return a.tarih.localeCompare(b.tarih)
    })

  const totalPending   = isler.filter(x => x.durum === 'bekliyor').length
  const totalLate      = isler.filter(x => isLate(x)).length
  const totalDone      = isler.filter(x => x.durum === 'tamamlandi').length
  const reminderCount  = isler.filter(x => x.durum === 'bekliyor' && (x.hatirlatici || x.hatirlatici_saati)).length

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════ */
  return (
    /* Full-bleed: negative margins escape the p-4 lg:p-8 container */
    <div className="-m-4 lg:-m-8 flex flex-col bg-[#DCEEFA]" style={{ minHeight: 'calc(100dvh - 4rem)', height: 'calc(100dvh - 4rem)' }}>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      <div className="fixed top-20 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border pointer-events-auto toast-in ${t.ok ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {t.ok ? <Check size={13} className="text-blue-400 shrink-0" /> : <Bell size={13} className="text-red-400 shrink-0" />}
            <span className="text-[13px] font-semibold">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* ── Top Bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-100 bg-white/95 backdrop-blur-2xl px-6 py-3 flex items-center gap-4 flex-wrap">

        {/* Title + stats */}
        <div className="flex items-center gap-3 mr-auto">
          <div className="flex flex-col">
            <span className="text-[17px] font-bold text-slate-800 tracking-tight leading-none">Günlük İşler</span>
            <span className="text-[11px] text-slate-500 mt-0.5 font-medium">
              {totalLate > 0
                ? <span className="text-red-400">{totalLate} gecikmiş · </span>
                : null
              }{totalPending} bekliyor · {totalDone} tamamlandı
            </span>
          </div>
        </div>

        {/* View filter */}
        <div className="flex items-center gap-1 bg-white border border-blue-100 rounded-xl p-1">
          {([['all','Tümü'],['today','Bugün'],['done','Tamamlanan']] as const).map(([v,l]) => (
            <button key={v} onClick={() => setViewFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${viewFilter === v ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Notification */}
        {notifPerm !== 'granted' ? (
          <button onClick={requestNotif}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-[12px] font-bold text-amber-300 transition-all">
            <BellRing size={13} /> Bildirimlere İzin Ver
          </button>
        ) : (
          <button className="relative w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Bell size={15} className="text-blue-400" />
            {reminderCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">
                {reminderCount > 9 ? '9+' : reminderCount}
              </span>
            )}
          </button>
        )}

        {/* Add */}
        <button onClick={() => { setForm({ ...EMPTY }); setEditId(null); setFormErr(''); setDrawer(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-bold transition-all shadow-lg shadow-blue-600/25">
          <Plus size={15} /> Görev Ekle
        </button>
      </div>

      {/* ── Board ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.05] overflow-auto lg:overflow-hidden custom-scroll">
          {(Object.values(Q) as typeof Q[QKey][]).map(col => {
            const qKey = col.id as QKey
            const tasks = byQ(qKey)
            const Icon = col.icon
            const isAdding = adding === qKey

            return (
              <div key={qKey} className="flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.45)', minHeight: '420px' }}>

                {/* Column header */}
                <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white/80" style={{ borderTopWidth: 3, borderTopStyle: 'solid', borderTopColor: col.color }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon size={14} style={{ color: col.color }} />
                    <span className="text-[12px] font-bold text-slate-800 leading-none">{col.label}</span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: col.color, background: col.badgeBg }}>
                      {tasks.length}
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: col.color, opacity: 0.7 }}>{col.sub}</p>
                </div>

                {/* Task list */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scroll">
                  {tasks.length === 0 && !isAdding && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-30">
                      <Icon size={28} style={{ color: col.color }} strokeWidth={1} />
                      <p className="text-[11px] text-slate-500 font-medium">Görev yok</p>
                    </div>
                  )}

                  {tasks.map(is => (
                    <TaskCard key={is.id} is={is} col={col}
                      onDone={() => toggleDone(is)}
                      onEdit={() => openEdit(is)}
                      onDelete={() => setDeleteId(is.id)}
                      onSnooze={() => { setSnoozeIs(is); setSnoozeCustom({ tarih: '', saat: '' }) }}
                    />
                  ))}

                  {/* Quick-add input */}
                  {isAdding ? (
                    <form onSubmit={e => { e.preventDefault(); quickAdd(qKey) }}
                      className="rounded-xl border bg-white p-3 space-y-2" style={{ borderColor: col.border }}>
                      <input ref={quickRef} autoFocus placeholder="Görev başlığı…"
                        className="w-full bg-transparent text-[13px] font-semibold text-slate-800 placeholder:text-slate-400 outline-none"
                        value={quickText} onChange={e => setQuickText(e.target.value)} />
                      <div className="flex items-center gap-2">
                        <input type="date" value={quickDate} onChange={e => setQuickDate(e.target.value)}
                          className="flex-1 bg-white border border-blue-100 rounded-lg px-2 py-1 text-[11px] text-slate-500 outline-none" />
                        <button type="submit" disabled={!quickText.trim()}
                          className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all" style={{ background: col.color }}>
                          <CornerDownLeft size={12} className="text-slate-800" />
                        </button>
                        <button type="button" onClick={() => { setAdding(null); setQuickText('') }}
                          className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    </form>
                  ) : viewFilter !== 'done' && (
                    <button onClick={() => { setAdding(qKey); setQuickText(''); setQuickDate(todayStr()); setTimeout(() => quickRef.current?.focus(), 50) }}
                      className="w-full flex items-center gap-2 py-2 px-3 rounded-xl border border-dashed text-[12px] font-semibold transition-all hover:border-opacity-60 hover:bg-white"
                      style={{ borderColor: col.border, color: col.color, opacity: 0.6 }}>
                      <Plus size={13} /> Ekle
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Detay Drawer ──────────────────────────────────────────── */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="relative w-full max-w-[400px] h-full bg-white border-l border-blue-100 flex flex-col slide-in-right">

            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-[16px] font-bold text-slate-800">{editId ? 'Görevi Düzenle' : 'Yeni Görev'}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Detayları girin</p>
              </div>
              <button onClick={() => setDrawer(false)} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 custom-scroll">

              {/* Başlık */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Görev Başlığı *</label>
                <input autoFocus placeholder="Ne yapılacak?"
                  className="w-full bg-white border border-blue-100 rounded-xl px-4 py-3 text-[14px] font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:bg-white transition-all"
                  value={form.baslik} onChange={e => setForm(p => ({ ...p, baslik: e.target.value }))} />
                {formErr && <p className="text-red-400 text-[11px] mt-1 font-medium">{formErr}</p>}
              </div>

              {/* Quadrant */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Kategori</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.values(Q) as typeof Q[QKey][]).map(col => (
                    <button key={col.id} type="button" onClick={() => setForm(p => ({ ...p, matris: col.id as QKey }))}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all"
                      style={{
                        borderColor: form.matris === col.id ? col.color : 'rgba(255,255,255,0.08)',
                        background: form.matris === col.id ? col.bg : 'transparent',
                      }}>
                      <col.icon size={13} style={{ color: col.color, flexShrink: 0 }} />
                      <div>
                        <p className="text-[11px] font-bold" style={{ color: form.matris === col.id ? col.color : '#64748b' }}>{col.sub}</p>
                        <p className="text-[9px] text-slate-600 leading-none mt-0.5 hidden sm:block">{col.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tarih + Hatırlatıcı */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tarih *</label>
                  <input type="date"
                    className="w-full bg-white border border-blue-100 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-800 outline-none focus:border-blue-400 transition-all [color-scheme:dark]"
                    value={form.tarih} onChange={e => setForm(p => ({ ...p, tarih: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    <span className="flex items-center gap-1"><Bell size={9} /> Hatırlatıcı</span>
                  </label>
                  <div className="relative">
                    <input type="time"
                      className="w-full bg-white border border-blue-100 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-800 outline-none focus:border-blue-400 transition-all [color-scheme:dark] pr-8"
                      value={form.hatirlatici} onChange={e => setForm(p => ({ ...p, hatirlatici: e.target.value }))} />
                    {form.hatirlatici && (
                      <button onClick={() => setForm(p => ({ ...p, hatirlatici: '' }))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Not */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Not / Açıklama</label>
                <textarea rows={3} placeholder="Ek detaylar…"
                  className="w-full bg-white border border-blue-100 rounded-xl px-4 py-3 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 transition-all resize-none"
                  value={form.aciklama} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))} />
              </div>

              {notifPerm !== 'granted' && form.hatirlatici && (
                <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <BellOff size={13} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-bold text-amber-300">Bildirim izni yok</p>
                    <button onClick={requestNotif} className="text-[11px] text-amber-300 underline mt-0.5">İzin ver</button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setDrawer(false)}
                className="flex-1 py-2.5 rounded-xl border border-blue-100 text-slate-400 hover:text-slate-800 text-[13px] font-semibold transition-colors">
                İptal
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[13px] font-bold transition-all shadow-lg shadow-blue-600/25">
                {saving ? 'Kaydediliyor…' : editId ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Snooze Modal ──────────────────────────────────────────── */}
      {snoozeIs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSnoozeIs(null)} />
          <div className="relative w-full max-w-xs bg-white border border-blue-100 rounded-2xl shadow-2xl slide-in-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div>
                <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2"><Timer size={13} className="text-blue-400" /> Hatırlatıcı</h3>
                <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{snoozeIs.baslik}</p>
              </div>
              <button onClick={() => setSnoozeIs(null)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"><X size={12} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {SNOOZE_PRESETS.map(p => (
                  <button key={p.label} onClick={() => applySnooze(snoozeIs, snoozeTo(p.mins))}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-blue-50 border border-slate-100 hover:border-blue-200 text-[12px] font-bold text-slate-600 hover:text-blue-700 transition-all">
                    <Zap size={11} className="text-blue-400 shrink-0" /> {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={snoozeCustom.tarih} onChange={e => setSnoozeCustom(p => ({ ...p, tarih: e.target.value }))}
                  className="bg-white border border-blue-100 rounded-xl px-2.5 py-2 text-[11px] text-slate-800 outline-none [color-scheme:dark]" />
                <input type="time" value={snoozeCustom.saat} onChange={e => setSnoozeCustom(p => ({ ...p, saat: e.target.value }))}
                  className="bg-white border border-blue-100 rounded-xl px-2.5 py-2 text-[11px] text-slate-800 outline-none [color-scheme:dark]" />
              </div>
              {snoozeCustom.tarih && snoozeCustom.saat && (
                <button onClick={() => applySnooze(snoozeIs, snoozeCustom)}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold transition-all">
                  Ayarla → {fmtDate(snoozeCustom.tarih)} {snoozeCustom.saat}
                </button>
              )}
              {(snoozeIs.hatirlatici_tarihi || snoozeIs.hatirlatici_saati) && (
                <button onClick={async () => { await supabase.from('gunluk_isler').update({ hatirlatici_tarihi: null, hatirlatici_saati: null }).eq('id', snoozeIs.id); setSnoozeIs(null); load(true) }}
                  className="w-full py-1.5 rounded-xl border border-dashed border-red-500/25 text-red-400 text-[11px] font-semibold hover:bg-red-500/10 transition-colors">
                  Hatırlatıcıyı Kaldır
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────── */}
      {deleteId && (
        <ConfirmModal title="Görevi Sil" message="Bu görev kalıcı olarak silinecek." danger onConfirm={doDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   TASK CARD
══════════════════════════════════════════════════════════════════════ */
function TaskCard({ is, col, onDone, onEdit, onDelete, onSnooze }: {
  is: GunlukIs
  col: typeof Q[QKey]
  onDone: () => void; onEdit: () => void; onDelete: () => void; onSnooze: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const done = is.durum === 'tamamlandi'
  const late = !done && is.tarih < todayStr()
  const rSaat = is.hatirlatici_saati || is.hatirlatici
  const rTarih = is.hatirlatici_tarihi

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-150 overflow-hidden ${done ? 'opacity-40' : late ? '' : ''}`}
      style={{
        background: done ? 'rgba(255,255,255,0.5)' : late ? 'rgba(254,242,242,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: done ? 'rgba(0,0,0,0.06)' : late ? 'rgba(239,68,68,0.3)' : 'rgba(0,0,0,0.08)',
        borderLeftWidth: 3,
        borderLeftColor: done ? 'rgba(0,0,0,0.08)' : col.color,
      }}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">

        {/* Checkbox */}
        <button onClick={onDone}
          className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all ${done ? 'border-transparent' : 'border-slate-300 hover:border-slate-500'}`}
          style={done ? { background: col.color } : {}}>
          {done && <Check size={9} className="text-slate-800" strokeWidth={3.5} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-snug ${done ? 'line-through text-slate-400' : late ? 'text-red-600' : 'text-slate-800'}`}>
            {is.baslik}
          </p>
          {is.aciklama && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate leading-snug">{is.aciklama}</p>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Date chip */}
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
              late ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Clock size={9} />
              {fmtRel(is.tarih)}
            </span>
            {/* Reminder chip */}
            {rSaat && !done && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-600">
                <Bell size={9} />
                {rTarih && rTarih !== is.tarih ? `${fmtDate(rTarih)} ` : ''}{rSaat}
              </span>
            )}
            {done && is.tamamlandi_at && (
              <span className="text-[10px] text-emerald-600 font-medium">
                ✓ {new Date(is.tamamlandi_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Menu button */}
        {!done && (
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen(p => !p)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100">
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-7 z-20 w-32 bg-white border border-blue-100 rounded-xl shadow-2xl overflow-hidden">
                  <button onClick={() => { onSnooze(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                    <Timer size={11} /> Hatırlatıcı
                  </button>
                  <button onClick={() => { onEdit(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
                    <Pencil size={11} /> Düzenle
                  </button>
                  <button onClick={() => { onDelete(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={11} /> Sil
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {done && (
          <button onClick={onDelete} className="shrink-0 w-6 h-6 flex items-center justify-center text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
