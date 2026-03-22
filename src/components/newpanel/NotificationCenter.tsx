﻿'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlarmClock, Bell, CalendarClock, Check, CheckCircle2, Clock3, ReceiptText, ShieldAlert, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

interface TaskNotificationRecord {
  id: string
  baslik: string
  durum: string
  son_tarih: string | null
  hatirlatma_tarihi: string | null
  hatirlama_saati: string | null
  ertelenmis_tarih: string | null
  erteleme_dakika: number | null
}

interface PaymentNotificationRecord {
  id: string
  unvan: string
  vade_tarihi: string
  durum: string
  planlanan_tutar: number
}

interface TaxNotificationRecord {
  id: string
  surec_turu: string
  son_tarih: string
  durum: string
  tutar: number
}

interface NotificationStoreRecord {
  id: string
  kaynak_turu: 'task' | 'payment' | 'tax'
  kaynak_id: string
  seviye: 'urgent' | 'today' | 'upcoming'
  okunma_tarihi: string | null
  erteleme_sonrasi: string | null
  kapali: boolean
}

interface NotificationItem {
  id: string
  sourceId: string
  sourceType: 'task' | 'payment' | 'tax'
  title: string
  message: string
  level: 'urgent' | 'today' | 'upcoming'
  whenValue: string | null
  postponeable: boolean
  readAt: string | null
  snoozeUntil: string | null
  closed: boolean
}

interface Props {
  firma: FirmaRecord
}

const POSTPONE_MINUTES = [15, 30, 60]
const taxLabels: Record<string, string> = {
  kdv: 'KDV',
  muhtasar_sgk: 'Muhtasar / SGK',
  gecici_vergi: 'Gecici Vergi',
  kurumlar_vergisi: 'Kurumlar Vergisi',
  edefter: 'e-Defter',
}

export default function NotificationCenter({ firma }: Props) {
  const [open, setOpen] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [error, setError] = useState('')
  const [shown, setShown] = useState<Record<string, number>>({})

  const fetchNotifications = useCallback(async () => {
    const [taskRes, paymentRes, taxRes, storeRes] = await Promise.all([
      supabase
        .from('gorevler')
        .select('id, baslik, durum, son_tarih, hatirlatma_tarihi, hatirlama_saati, ertelenmis_tarih, erteleme_dakika')
        .eq('firma_id', firma.id)
        .neq('durum', 'tamamlandi')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('odeme_planlari')
        .select('id, unvan, vade_tarihi, durum, planlanan_tutar')
        .eq('firma_id', firma.id)
        .neq('durum', 'tamamlandi')
        .order('vade_tarihi', { ascending: true })
        .limit(12),
      supabase
        .from('vergi_surecleri')
        .select('id, surec_turu, son_tarih, durum, tutar')
        .eq('firma_id', firma.id)
        .neq('durum', 'tamamlandi')
        .order('son_tarih', { ascending: true })
        .limit(12),
      supabase
        .from('bildirim_kayitlari')
        .select('id, kaynak_turu, kaynak_id, seviye, okunma_tarihi, erteleme_sonrasi, kapali')
        .eq('firma_id', firma.id),
    ])

    const firstError = taskRes.error || paymentRes.error || taxRes.error || storeRes.error
    if (firstError) {
      setError(firstError.message)
      setNotifications([])
      return
    }

    setError('')
    const store = (storeRes.data as NotificationStoreRecord[]) || []
    const nextNotifications = buildNotifications(
      (taskRes.data as TaskNotificationRecord[]) || [],
      (paymentRes.data as PaymentNotificationRecord[]) || [],
      (taxRes.data as TaxNotificationRecord[]) || [],
      store,
    )
    setNotifications(nextNotifications)

    if ('Notification' in window && Notification.permission === 'granted') {
      const now = Date.now()
      nextNotifications.filter((item) => !item.readAt).slice(0, 5).forEach((item) => {
        if (!shown[item.id] || now - shown[item.id] > 60 * 60 * 1000) {
          new Notification(item.title, { body: item.message, tag: item.id, icon: '/favicon.ico' })
          setShown((prev) => ({ ...prev, [item.id]: now }))
        }
      })
    }
  }, [firma.id, shown])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setPermissionGranted(true)
    }
    fetchNotifications()
    const timer = window.setInterval(fetchNotifications, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [fetchNotifications])

  async function askPermission() {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setPermissionGranted(permission === 'granted')
  }

  async function upsertStore(item: NotificationItem, updates: Record<string, string | boolean | null>) {
    const payload = {
      firma_id: firma.id,
      kaynak_turu: item.sourceType,
      kaynak_id: item.sourceId,
      seviye: item.level,
      baslik: item.title,
      mesaj: item.message,
      ...updates,
    }

    const { error } = await supabase.from('bildirim_kayitlari').upsert(payload, {
      onConflict: 'firma_id,kaynak_turu,kaynak_id,seviye',
    })

    if (error) {
      setError(error.message)
      return false
    }

    return true
  }

  async function postponeTask(item: NotificationItem, minutes: number) {
    if (item.sourceType !== 'task') return
    const postponedDate = new Date(Date.now() + minutes * 60 * 1000).toISOString()

    const taskRes = await supabase
      .from('gorevler')
      .update({ ertelenmis_tarih: postponedDate, erteleme_dakika: minutes })
      .eq('id', item.sourceId)

    if (taskRes.error) {
      setError(taskRes.error.message)
      return
    }

    const saved = await upsertStore(item, { erteleme_sonrasi: postponedDate, okunma_tarihi: null, kapali: false })
    if (saved) fetchNotifications()
  }

  async function markAsRead(item: NotificationItem) {
    const saved = await upsertStore(item, { okunma_tarihi: new Date().toISOString(), kapali: true })
    if (saved) fetchNotifications()
  }

  const visibleNotifications = useMemo(() => notifications.filter((item) => !item.closed), [notifications])

  const counts = useMemo(() => ({
    urgent: visibleNotifications.filter((item) => item.level === 'urgent').length,
    today: visibleNotifications.filter((item) => item.level === 'today').length,
    upcoming: visibleNotifications.filter((item) => item.level === 'upcoming').length,
  }), [visibleNotifications])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${open ? 'border-sky-300/50 bg-white text-slate-900' : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'}`}
      >
        <Bell size={17} />
        {visibleNotifications.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {visibleNotifications.length > 9 ? '9+' : visibleNotifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute -right-2 sm:right-0 top-14 z-50 w-[calc(100vw-2rem)] sm:w-[360px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 shadow-[0_24px_80px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Bildirim Merkezi</p>
              <p className="mt-1 text-xs text-slate-400">Gorev, odeme ve vergi hatirlatmalari</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {!permissionGranted && (
            <div className="flex items-center justify-between gap-3 border-b border-sky-400/20 bg-sky-400/10 px-4 py-3">
              <p className="text-xs text-sky-100">Tarayici bildirimi icin izin verebilirsin.</p>
              <button type="button" onClick={askPermission} className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950">
                Izin ver
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 border-b border-white/10 text-center">
            <CountBox label="Acil" value={counts.urgent} tone="text-rose-300" />
            <CountBox label="Bugun" value={counts.today} tone="text-amber-300" />
            <CountBox label="Yaklasan" value={counts.upcoming} tone="text-sky-300" />
          </div>

          {error && <p className="border-b border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p>}

          <div className="max-h-[420px] overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <CheckCircle2 size={30} className="text-emerald-300" />
                <p className="mt-3 text-sm font-medium text-white">Bekleyen bildirim yok</p>
                <p className="mt-1 text-xs text-slate-400">Okunan ya da ertelenen bildirimler yeniden geldiginde burada gorunecek.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {visibleNotifications.map((item) => (
                  <div key={item.id} className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <NotificationIcon item={item} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${badgeTone(item.level)}`}>
                            {item.level}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-300">{item.message}</p>
                        {item.whenValue && <p className="mt-2 text-[11px] text-slate-400">Zaman: {formatDateTime(item.whenValue)}</p>}
                        {item.snoozeUntil && <p className="mt-1 text-[11px] text-amber-200">Erteleme bitisi: {formatDateTime(item.snoozeUntil)}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.postponeable && POSTPONE_MINUTES.map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => postponeTask(item, minute)}
                              className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-100"
                            >
                              {minute} dk ertele
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => markAsRead(item)}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100"
                          >
                            <Check size={12} />
                            Okundu
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function buildNotifications(
  tasks: TaskNotificationRecord[],
  payments: PaymentNotificationRecord[],
  taxes: TaxNotificationRecord[],
  store: NotificationStoreRecord[],
) {
  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const inThreeDays = new Date(today)
  inThreeDays.setDate(inThreeDays.getDate() + 3)

  const storeMap = new Map(store.map((item) => [storeKey(item.kaynak_turu, item.kaynak_id, item.seviye), item]))

  const taskItems: NotificationItem[] = tasks.flatMap((task) => {
    const target = getTaskTargetDate(task)
    if (!target) return []
    const level = resolveLevel(target, today, tomorrow, inThreeDays)
    if (!level) return []
    const saved = storeMap.get(storeKey('task', task.id, level))
    if (saved?.kapali) return []
    if (saved?.erteleme_sonrasi && new Date(saved.erteleme_sonrasi) > now) return []
    return [{
      id: `task_${task.id}_${level}`,
      sourceId: task.id,
      sourceType: 'task',
      title: level === 'urgent' ? 'Geciken gorev' : level === 'today' ? 'Bugun hatirlatma' : 'Yaklasan gorev',
      message: `${task.baslik}`,
      level,
      whenValue: target.toISOString(),
      postponeable: true,
      readAt: saved?.okunma_tarihi || null,
      snoozeUntil: saved?.erteleme_sonrasi || null,
      closed: saved?.kapali || false,
    }]
  })

  const paymentItems: NotificationItem[] = payments.flatMap((payment) => {
    const target = parseDate(payment.vade_tarihi)
    if (!target) return []
    const level = resolveLevel(target, today, tomorrow, inThreeDays)
    if (!level) return []
    const saved = storeMap.get(storeKey('payment', payment.id, level))
    if (saved?.kapali) return []
    if (saved?.erteleme_sonrasi && new Date(saved.erteleme_sonrasi) > now) return []
    return [{
      id: `payment_${payment.id}_${level}`,
      sourceId: payment.id,
      sourceType: 'payment',
      title: level === 'urgent' ? 'Geciken odeme plani' : level === 'today' ? 'Bugun odeme plani' : 'Yaklasan odeme plani',
      message: `${payment.unvan} • ${money(payment.planlanan_tutar)}`,
      level,
      whenValue: target.toISOString(),
      postponeable: false,
      readAt: saved?.okunma_tarihi || null,
      snoozeUntil: saved?.erteleme_sonrasi || null,
      closed: saved?.kapali || false,
    }]
  })

  const taxItems: NotificationItem[] = taxes.flatMap((tax) => {
    const target = parseDate(tax.son_tarih)
    if (!target) return []
    const level = resolveLevel(target, today, tomorrow, inThreeDays)
    if (!level) return []
    const saved = storeMap.get(storeKey('tax', tax.id, level))
    if (saved?.kapali) return []
    if (saved?.erteleme_sonrasi && new Date(saved.erteleme_sonrasi) > now) return []
    return [{
      id: `tax_${tax.id}_${level}`,
      sourceId: tax.id,
      sourceType: 'tax',
      title: level === 'urgent' ? 'Geciken vergi sureci' : level === 'today' ? 'Bugun vergi sureci' : 'Yaklasan vergi sureci',
      message: `${taxLabels[tax.surec_turu] || tax.surec_turu} • ${money(tax.tutar)}`,
      level,
      whenValue: target.toISOString(),
      postponeable: false,
      readAt: saved?.okunma_tarihi || null,
      snoozeUntil: saved?.erteleme_sonrasi || null,
      closed: saved?.kapali || false,
    }]
  })

  return [...taskItems, ...paymentItems, ...taxItems]
    .sort((left, right) => urgencyRank(left.level) - urgencyRank(right.level) || dateRank(left.whenValue) - dateRank(right.whenValue))
    .slice(0, 20)
}

function storeKey(sourceType: 'task' | 'payment' | 'tax', sourceId: string, level: 'urgent' | 'today' | 'upcoming') {
  return `${sourceType}:${sourceId}:${level}`
}

function getTaskTargetDate(task: TaskNotificationRecord) {
  if (task.ertelenmis_tarih) {
    const postponed = new Date(task.ertelenmis_tarih)
    if (!Number.isNaN(postponed.getTime())) return postponed
  }

  if (task.hatirlatma_tarihi) {
    const reminder = new Date(`${task.hatirlatma_tarihi}T${task.hatirlama_saati || '09:00'}:00`)
    if (!Number.isNaN(reminder.getTime())) return reminder
  }

  return parseDate(task.son_tarih)
}

function resolveLevel(target: Date, today: Date, tomorrow: Date, inThreeDays: Date) {
  if (target < today) return 'urgent'
  if (target >= today && target < tomorrow) return 'today'
  if (target >= tomorrow && target <= inThreeDays) return 'upcoming'
  return null
}

function startOfDay(value: Date) {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

function parseDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(`${value}T09:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function urgencyRank(level: NotificationItem['level']) {
  return level === 'urgent' ? 0 : level === 'today' ? 1 : 2
}

function dateRank(value: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

function badgeTone(level: NotificationItem['level']) {
  if (level === 'urgent') return 'bg-rose-500/15 text-rose-200'
  if (level === 'today') return 'bg-amber-500/15 text-amber-200'
  return 'bg-sky-500/15 text-sky-200'
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('tr-TR')
}

function money(value: number) {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
}

function CountBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="px-3 py-3">
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
    </div>
  )
}

function NotificationIcon({ item }: { item: NotificationItem }) {
  if (item.sourceType === 'payment') return <ReceiptText size={16} className="mt-0.5 text-sky-300" />
  if (item.sourceType === 'tax') return <ShieldAlert size={16} className="mt-0.5 text-amber-300" />
  return item.level === 'urgent'
    ? <AlarmClock size={16} className="mt-0.5 text-rose-300" />
    : item.level === 'today'
      ? <Clock3 size={16} className="mt-0.5 text-amber-300" />
      : <CalendarClock size={16} className="mt-0.5 text-sky-300" />
}
