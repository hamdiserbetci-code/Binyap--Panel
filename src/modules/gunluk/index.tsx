'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Plus, Check, Pencil, Trash2, Bell, BellOff, BellRing,
  ChevronLeft, ChevronRight, AlertTriangle, Clock, Inbox, Star,
  CalendarDays, X, CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal, Field, ConfirmModal, cls, Loading, Empty } from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ── Eisenhower Matrisi ─────────────────────────────────────────────────────
const MATRIS = {
  q1: {
    label: 'Acil & Önemli',
    alt:   'Hemen Yap',
    icon:  AlertTriangle,
    bg:    'bg-red-900/30',
    border:'border-red-700/50',
    badge: 'bg-red-900/60 text-red-300',
    dot:   'bg-red-400',
    ring:  'ring-red-500',
    check: 'bg-red-500 hover:bg-red-600',
  },
  q2: {
    label: 'Önemli & Acil Değil',
    alt:   'Planla',
    icon:  Star,
    bg:    'bg-blue-900/30',
    border:'border-blue-700/50',
    badge: 'bg-blue-900/60 text-blue-300',
    dot:   'bg-blue-400',
    ring:  'ring-blue-500',
    check: 'bg-blue-500 hover:bg-blue-600',
  },
  q3: {
    label: 'Acil & Önemsiz',
    alt:   'Devret',
    icon:  Clock,
    bg:    'bg-amber-900/30',
    border:'border-amber-700/50',
    badge: 'bg-amber-900/60 text-amber-300',
    dot:   'bg-amber-400',
    ring:  'ring-amber-500',
    check: 'bg-amber-500 hover:bg-amber-600',
  },
  q4: {
    label: 'Acil Değil & Önemsiz',
    alt:   'Ele Al / Sil',
    icon:  Inbox,
    bg:    'bg-slate-800/40',
    border:'border-slate-700/40',
    badge: 'bg-slate-700 text-slate-400',
    dot:   'bg-slate-500',
    ring:  'ring-slate-500',
    check: 'bg-slate-600 hover:bg-slate-500',
  },
} as const

type Matris = keyof typeof MATRIS

interface GunlukIs {
  id: string
  firma_id: string
  kullanici_id: string | null
  baslik: string
  aciklama: string | null
  matris: Matris
  durum: 'bekliyor' | 'tamamlandi'
  tarih: string          // YYYY-MM-DD
  hatirlatici: string | null  // HH:MM
  tamamlandi_at: string | null
  created_at: string
}

const EMPTY_FORM = { baslik: '', aciklama: '', matris: 'q1' as Matris, hatirlatici: '' }

function todayStr() { return new Date().toISOString().split('T')[0] }
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n)
  return dt.toISOString().split('T')[0]
}
function dateLabel(d: string) {
  const today = todayStr()
  const tomorrow = addDays(today, 1)
  const yesterday = addDays(today, -1)
  if (d === today)     return 'Bugün'
  if (d === tomorrow)  return 'Yarın'
  if (d === yesterday) return 'Dün'
  return new Date(d).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function GunlukModule({ firma, profil }: AppCtx) {
  const [isler, setIsler]         = useState<GunlukIs[]>([])
  const [loading, setLoading]     = useState(true)
  const [tarih, setTarih]         = useState(todayStr())

  const [modal, setModal]         = useState<'add' | 'edit' | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [editId, setEditId]       = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [formErr, setFormErr]     = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Hatırlatıcı interval
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { load() }, [firma.id, tarih])

  useEffect(() => {
    // Her dakika hatırlatıcıları kontrol et
    timerRef.current = setInterval(checkReminders, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isler])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('gunluk_isler')
      .select('*')
      .eq('firma_id', firma.id)
      .eq('tarih', tarih)
      .order('created_at')
    setIsler((data || []) as GunlukIs[])
    setLoading(false)
  }

  async function save() {
    if (!form.baslik.trim()) { setFormErr('Başlık zorunludur'); return }
    setSaving(true); setFormErr('')
    const payload = {
      firma_id: firma.id,
      kullanici_id: profil.id,
      baslik: form.baslik.trim(),
      aciklama: form.aciklama.trim() || null,
      matris: form.matris,
      hatirlatici: form.hatirlatici || null,
      tarih,
    }
    const { error } = modal === 'add'
      ? await supabase.from('gunluk_isler').insert(payload)
      : await supabase.from('gunluk_isler').update(payload).eq('id', editId!)
    setSaving(false)
    if (error) { setFormErr(error.message); return }
    setModal(null); load()
  }

  async function toggleDone(is: GunlukIs) {
    const done = is.durum !== 'tamamlandi'
    await supabase.from('gunluk_isler').update({
      durum: done ? 'tamamlandi' : 'bekliyor',
      tamamlandi_at: done ? new Date().toISOString() : null,
    }).eq('id', is.id)
    setIsler(prev => prev.map(x => x.id === is.id
      ? { ...x, durum: done ? 'tamamlandi' : 'bekliyor', tamamlandi_at: done ? new Date().toISOString() : null }
      : x))
  }

  async function deleteIs() {
    await supabase.from('gunluk_isler').delete().eq('id', deletingId!)
    setDeletingId(null); load()
  }

  function openEdit(is: GunlukIs) {
    setForm({ baslik: is.baslik, aciklama: is.aciklama || '', matris: is.matris, hatirlatici: is.hatirlatici || '' })
    setEditId(is.id); setFormErr(''); setModal('edit')
  }

  function openAdd(matris: Matris) {
    setForm({ ...EMPTY_FORM, matris })
    setEditId(null); setFormErr(''); setModal('add')
  }

  function checkReminders() {
    if (!('Notification' in window)) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = todayStr()
    isler.forEach(is => {
      if (is.hatirlatici === hhmm && is.tarih === today && is.durum === 'bekliyor') {
        if (Notification.permission === 'granted') {
          new Notification(`📌 ${is.baslik}`, {
            body: is.aciklama || `${MATRIS[is.matris].label} — Hatırlatıcı`,
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

  const bekleyen  = isler.filter(x => x.durum === 'bekliyor').length
  const tamamlanan = isler.filter(x => x.durum === 'tamamlandi').length
  const notifGranted = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'

  return (
    <div className="space-y-4">

      {/* ── Başlık ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Günlük İşler</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {bekleyen > 0 ? `${bekleyen} bekliyor` : 'Tüm işler tamamlandı 🎉'}
            {tamamlanan > 0 && ` · ${tamamlanan} tamamlandı`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!notifGranted && (
            <button onClick={requestNotifPermission}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:bg-amber-900/30 border border-amber-700/50 px-3 py-1.5 rounded-lg transition-colors">
              <BellRing size={13} /> Bildirim İzni
            </button>
          )}
          <button onClick={() => openAdd('q1')} className={cls.btnPrimary}>
            <Plus size={14} /> Yeni Görev
          </button>
        </div>
      </div>

      {/* ── Tarih Seçici ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl px-4 py-3 flex items-center gap-3">
        <button onClick={() => setTarih(addDays(tarih, -1))}
          className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors shrink-0">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <CalendarDays size={15} className="text-white/60" />
          <label className="relative cursor-pointer">
            <span className="text-lg font-bold text-white">{dateLabel(tarih)}</span>
            <input type="date" value={tarih} onChange={e => setTarih(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full" />
          </label>
          {tarih !== todayStr() && (
            <button onClick={() => setTarih(todayStr())}
              className="text-[10px] font-semibold bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-full transition-colors">
              Bugün
            </button>
          )}
        </div>
        <button onClick={() => setTarih(addDays(tarih, 1))}
          className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors shrink-0">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Eisenhower Matrisi ─────────────────────────────────────────────── */}
      {loading ? <Loading /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(MATRIS) as Matris[]).map(matrisKey => {
            const m = MATRIS[matrisKey]
            const Icon = m.icon
            const kvadrantIsler = isler.filter(x => x.matris === matrisKey)
            const bekleyenler   = kvadrantIsler.filter(x => x.durum === 'bekliyor')
            const tamamlananlar = kvadrantIsler.filter(x => x.durum === 'tamamlandi')

            return (
              <div key={matrisKey} className={`rounded-2xl border ${m.bg} ${m.border} overflow-hidden`}>
                {/* Kuadrant Başlık */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg ${m.badge} flex items-center justify-center`}>
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">{m.label}</p>
                      <p className="text-[10px] text-slate-500">{m.alt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {bekleyenler.length > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badge}`}>
                        {bekleyenler.length}
                      </span>
                    )}
                    <button onClick={() => openAdd(matrisKey)}
                      className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                {/* Görev Listesi */}
                <div className="p-2 space-y-1.5 min-h-[60px]">
                  {bekleyenler.length === 0 && tamamlananlar.length === 0 ? (
                    <p className="text-[11px] text-slate-600 text-center py-3">Görev yok</p>
                  ) : (
                    <>
                      {/* Bekleyenler */}
                      {bekleyenler.map(is => (
                        <TaskRow key={is.id} is={is} matrisDef={m}
                          onDone={() => toggleDone(is)}
                          onEdit={() => openEdit(is)}
                          onDelete={() => setDeletingId(is.id)} />
                      ))}
                      {/* Tamamlananlar — soluk göster */}
                      {tamamlananlar.map(is => (
                        <TaskRow key={is.id} is={is} matrisDef={m} done
                          onDone={() => toggleDone(is)}
                          onEdit={() => openEdit(is)}
                          onDelete={() => setDeletingId(is.id)} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Ekle / Düzenle Modal ───────────────────────────────────────────── */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Yeni Görev' : 'Görevi Düzenle'}
          onClose={() => setModal(null)} size="md"
          footer={
            <>
              <button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={save} disabled={saving} className={cls.btnPrimary}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          }>
          <div className="space-y-4">
            <Field label="Görev Başlığı" required error={formErr}>
              <input className={cls.input} autoFocus placeholder="Ne yapılacak?"
                value={form.baslik} onChange={e => setForm(p => ({ ...p, baslik: e.target.value }))} />
            </Field>

            <Field label="Öncelik Kategorisi">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MATRIS) as Matris[]).map(k => {
                  const md = MATRIS[k]
                  const Icon = md.icon
                  const sel = form.matris === k
                  return (
                    <button key={k} type="button" onClick={() => setForm(p => ({ ...p, matris: k }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        sel ? `${md.bg} ${md.border} ring-1 ${md.ring}` : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                      }`}>
                      <Icon size={14} className={sel ? 'text-slate-200' : 'text-slate-500'} />
                      <div>
                        <p className={`text-xs font-semibold leading-tight ${sel ? 'text-slate-100' : 'text-slate-400'}`}>{md.label}</p>
                        <p className="text-[10px] text-slate-500">{md.alt}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Açıklama">
              <textarea className={`${cls.input} resize-none`} rows={2} placeholder="İsteğe bağlı not..."
                value={form.aciklama} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))} />
            </Field>

            <Field label="Hatırlatıcı Saati" hint="Belirtilen saatte bildirim gönderilir (tarayıcı izni gerekir)">
              <div className="flex items-center gap-2">
                <input type="time" className={`${cls.input} w-36`}
                  value={form.hatirlatici}
                  onChange={e => setForm(p => ({ ...p, hatirlatici: e.target.value }))} />
                {form.hatirlatici && (
                  <button onClick={() => setForm(p => ({ ...p, hatirlatici: '' }))}
                    className="text-slate-500 hover:text-red-400 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
            </Field>
          </div>
        </Modal>
      )}

      {/* ── Sil Onay ───────────────────────────────────────────────────────── */}
      {deletingId && (
        <ConfirmModal title="Görevi Sil" message="Bu görev silinecek. Emin misiniz?"
          danger onConfirm={deleteIs} onCancel={() => setDeletingId(null)} />
      )}
    </div>
  )
}

/* ── Görev Satırı Bileşeni ────────────────────────────────────────────────── */
function TaskRow({ is, matrisDef, done = false, onDone, onEdit, onDelete }: {
  is: GunlukIs
  matrisDef: typeof MATRIS[Matris]
  done?: boolean
  onDone: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all group ${
      done
        ? 'bg-slate-800/20 border-slate-700/20 opacity-50'
        : 'bg-slate-900/40 border-slate-700/30 hover:border-slate-600/50'
    }`}>
      {/* Tamamlandı Butonu */}
      <button onClick={onDone}
        className={`w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center transition-all border-2 ${
          done
            ? 'bg-emerald-500/80 border-emerald-500'
            : `border-slate-500 hover:border-emerald-400 hover:bg-emerald-900/30`
        }`}>
        {done && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      {/* İçerik */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
          {is.baslik}
        </p>
        {is.aciklama && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{is.aciklama}</p>
        )}
        {is.hatirlatici && !done && (
          <div className="flex items-center gap-1 mt-1">
            <Bell size={10} className="text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">{is.hatirlatici}</span>
          </div>
        )}
        {done && is.tamamlandi_at && (
          <p className="text-[10px] text-slate-600 mt-0.5">
            <CheckCircle2 size={9} className="inline mr-0.5" />
            {new Date(is.tamamlandi_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Aksiyonlar */}
      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit}
          className="w-6 h-6 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors">
          <Pencil size={11} />
        </button>
        <button onClick={onDelete}
          className="w-6 h-6 rounded-lg hover:bg-red-900/30 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
