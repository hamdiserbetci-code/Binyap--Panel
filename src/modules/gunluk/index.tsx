'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Plus, Check, Pencil, Trash2, Bell, BellOff, BellRing,
  ChevronLeft, ChevronRight, AlertTriangle, Clock, CalendarDays, X, CheckCircle2, Siren, ArrowRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal, Field, ConfirmModal, cls, Loading } from '@/components/ui'
import type { AppCtx } from '@/app/page'

// Matrix logic is kept to ensure DB compatibility, but relabelled for simpler priority.
const ONCELIK_TANIM = {
  q1: { label: 'Kritik (Hemen)', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  q2: { label: 'Yüksek (Planla)', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  q3: { label: 'Orta (Devret/Bekle)', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
  q4: { label: 'Düşük (Zaman Bulunca)', color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30' },
} as const

type PriorityKey = keyof typeof ONCELIK_TANIM

interface GunlukIs {
  id: string
  firma_id: string
  kullanici_id: string | null
  baslik: string
  aciklama: string | null
  matris: PriorityKey
  durum: 'bekliyor' | 'tamamlandi'
  tarih: string          // YYYY-MM-DD
  hatirlatici: string | null  // HH:MM
  hatirlatici_tarihi: string | null
  hatirlatici_saati: string | null
  tamamlandi_at: string | null
  created_at: string
}

const EMPTY_FORM = { baslik: '', aciklama: '', matris: 'q1' as PriorityKey, hatirlatici: '', tarih: '' }

function todayStr() { return new Date().toISOString().split('T')[0] }
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n)
  return dt.toISOString().split('T')[0]
}

export default function GunlukModule({ firma, profil }: AppCtx) {
  const [isler, setIsler]         = useState<GunlukIs[]>([])
  const [loading, setLoading]     = useState(true)
  const [aktifTarih, setAktifTarih] = useState(todayStr())

  const [modal, setModal]         = useState<'add' | 'edit' | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM, tarih: todayStr() })
  const [editId, setEditId]       = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [formErr, setFormErr]     = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [erteleModal, setErteleModal] = useState<GunlukIs | null>(null)
  const [erteleForm, setErteleForm]   = useState({ tarih: todayStr(), saat: '' })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { load() }, [firma.id])

  useEffect(() => {
    timerRef.current = setInterval(checkReminders, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isler])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('gunluk_isler')
      .select('*')
      .eq('firma_id', firma.id)
      .order('tarih')
      .order('created_at')
    setIsler((data || []) as GunlukIs[])
    setLoading(false)
  }

  async function save() {
    if (!form.baslik.trim()) { setFormErr('Başlık zorunludur'); return }
    if (!form.tarih) { setFormErr('Tarih zorunludur'); return }
    setSaving(true); setFormErr('')
    const payload = {
      firma_id: firma.id,
      kullanici_id: profil.id,
      baslik: form.baslik.trim(),
      aciklama: form.aciklama.trim() || null,
      matris: form.matris,
      hatirlatici: form.hatirlatici || null,
      tarih: form.tarih,
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

  async function saveErtele() {
    if (!erteleModal) return
    if (!erteleForm.tarih) return
    if (!erteleForm.saat) return
    setSaving(true)
    const { error } = await supabase.from('gunluk_isler').update({
      hatirlatici_tarihi: erteleForm.tarih,
      hatirlatici_saati: erteleForm.saat
    }).eq('id', erteleModal.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    setErteleModal(null); load()
  }

  async function clearErtele(id: string) {
    await supabase.from('gunluk_isler').update({ hatirlatici_tarihi: null, hatirlatici_saati: null }).eq('id', id)
    load()
  }

  function openEdit(is: GunlukIs) {
    setForm({ baslik: is.baslik, aciklama: is.aciklama || '', matris: is.matris, hatirlatici: is.hatirlatici || '', tarih: is.tarih })
    setEditId(is.id); setFormErr(''); setModal('edit')
  }

  function openAdd(defaultDate: string) {
    setForm({ ...EMPTY_FORM, tarih: defaultDate })
    setEditId(null); setFormErr(''); setModal('add')
  }

  function checkReminders() {
    if (!('Notification' in window)) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = todayStr()
    isler.forEach(is => {
      // Önce özel erteleme tarih ve saatine bak
      const notifyTarih = is.hatirlatici_tarihi || is.tarih
      const notifySaat  = is.hatirlatici_saati  || is.hatirlatici
      
      if (notifySaat === hhmm && notifyTarih === today && is.durum === 'bekliyor') {
        if (Notification.permission === 'granted') {
          new Notification(`📌 ${is.baslik}`, {
            body: is.aciklama || `Günlük İş Hatırlatıcısı`,
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

  const notifGranted = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  const bugun = todayStr()

  // Proaktif Gruplama
  const gecikenler = isler.filter(x => x.durum === 'bekliyor' && x.tarih < bugun)
  const bugunIsler = isler.filter(x => x.tarih === bugun)
  const yaklasik   = isler.filter(x => x.tarih > bugun && x.durum === 'bekliyor')

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      
      {/* ── Heading & Actions ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white/5 border border-white/10 p-5 rounded-2xl shadow-xl backdrop-blur-3xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Aksiyon Merkezi</h1>
          <p className="text-sm font-medium text-slate-400">
            {gecikenler.length > 0 ? (
              <span className="text-red-400 font-bold flex items-center gap-1.5"><Siren size={14} /> {gecikenler.length} gecikmiş göreviniz var!</span>
            ) : bugunIsler.filter(x => x.durum === 'bekliyor').length === 0 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5"><CheckCircle2 size={14} /> Harika! Bugün için tüm işler tamam.</span>
            ) : (
              <span>Bugün {bugunIsler.filter(x => x.durum === 'bekliyor').length} işiniz beklemede.</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!notifGranted && (
            <button onClick={requestNotifPermission} className="flex items-center gap-2 text-[11px] font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-2 rounded-xl transition-all">
              <BellRing size={14} /> Bildirim İzni Ver
            </button>
          )}
          <button onClick={() => openAdd(todayStr())} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">
            <Plus size={16} /> Yeni Görev
          </button>
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Sütun 1: Gecikenler */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle size={18} className="text-red-500" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Gecikenler</h2>
              <span className="ml-auto bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30">{gecikenler.length}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {gecikenler.length === 0 ? (
                <div className="text-xs text-slate-500 font-medium p-4 border border-dashed border-white/10 rounded-2xl text-center bg-white/5">Geciken işleminiz yok.</div>
              ) : gecikenler.map(is => (
                <TaskCard key={is.id} is={is} onDone={() => toggleDone(is)} onEdit={() => openEdit(is)} onDelete={() => setDeletingId(is.id)} onSnooze={() => setErteleModal(is)} isLate />
              ))}
            </div>
          </div>

          {/* Sütun 2: Bugün */}
          <div className="flex flex-col gap-3 lg:scale-105 origin-top relative z-10">
            <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 px-1 bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl shadow-lg backdrop-blur-sm">
              <Clock size={18} className="text-blue-400" />
              <h2 className="text-sm font-extrabold text-blue-100 uppercase tracking-widest">Bugün</h2>
              <span className="ml-auto bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-inner">{bugunIsler.filter(x => x.durum === 'bekliyor').length} Kalan</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {bugunIsler.length === 0 ? (
                <div className="text-xs text-slate-500 font-medium p-4 border border-dashed border-white/10 rounded-2xl text-center bg-white/5">Bugün için görev eklemediniz.</div>
              ) : bugunIsler.map(is => (
                <TaskCard key={is.id} is={is} onDone={() => toggleDone(is)} onEdit={() => openEdit(is)} onDelete={() => setDeletingId(is.id)} onSnooze={() => setErteleModal(is)} isToday />
              ))}
              <button onClick={() => openAdd(todayStr())} className="w-full flex items-center justify-center gap-1.5 py-3 border border-dashed border-blue-500/30 text-blue-400 text-xs font-bold rounded-2xl hover:bg-blue-500/10 transition-colors">
                <Plus size={14} /> Bugüne İş Ekle
              </button>
            </div>
          </div>

          {/* Sütun 3: Yaklaşan Planlar */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <CalendarDays size={18} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Yaklaşanlar</h2>
              <span className="ml-auto bg-white/10 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">{yaklasik.length}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {yaklasik.length === 0 ? (
                <div className="text-xs text-slate-500 font-medium p-4 border border-dashed border-white/10 rounded-2xl text-center bg-white/5">Planlanmış işiniz yok.</div>
              ) : yaklasik.map(is => (
                <TaskCard key={is.id} is={is} onDone={() => toggleDone(is)} onEdit={() => openEdit(is)} onDelete={() => setDeletingId(is.id)} onSnooze={() => setErteleModal(is)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {modal && (
        <Modal title={modal === 'add' ? 'Yeni Aksiyon' : 'Aksiyonu Düzenle'} onClose={() => setModal(null)} size="md" footer={<><button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button><button onClick={save} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-5">
            <Field label="Aksiyon Başlığı" required error={formErr}>
              <input className={`${cls.input} text-lg font-semibold py-3`} autoFocus placeholder="Ne yapılması gerekiyor?" value={form.baslik} onChange={e => setForm(p => ({ ...p, baslik: e.target.value }))} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Tarih" required>
                <div className="relative">
                  <input type="date" className={`${cls.input} font-medium bg-black/20 w-full`} value={form.tarih} onChange={e => setForm(p => ({ ...p, tarih: e.target.value }))} />
                </div>
              </Field>
              <Field label="Saat Hatırlatıcı">
                <div className="relative flex items-center">
                  <input type="time" className={`${cls.input} bg-black/20 w-full pr-8 font-medium`} value={form.hatirlatici} onChange={e => setForm(p => ({ ...p, hatirlatici: e.target.value }))} />
                  {form.hatirlatici && <button onClick={() => setForm(p => ({...p, hatirlatici: ''}))} className="absolute right-2 p-1 text-slate-400 hover:text-red-400"><X size={14}/></button>}
                </div>
              </Field>
            </div>

            <Field label="Öncelik Derecesi">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ONCELIK_TANIM) as PriorityKey[]).map(k => {
                  const def = ONCELIK_TANIM[k]
                  const sel = form.matris === k
                  return (
                    <button key={k} type="button" onClick={() => setForm(p => ({ ...p, matris: k }))}
                      className={`px-3 py-2.5 rounded-xl border text-center transition-all text-xs font-bold leading-none ${sel ? `${def.bg} border-transparent text-white shadow-inner` : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5'}`}>
                      {def.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Not / Açıklama (İsteğe bağlı)">
              <textarea className={`${cls.input} resize-none bg-black/20 text-sm`} rows={2} placeholder="Ekstra detaylar..." value={form.aciklama} onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {deletingId && (
        <ConfirmModal title="Aksiyonu Sil" message="Bu kalıcı olarak kaldırılacaktır." danger onConfirm={deleteIs} onCancel={() => setDeletingId(null)} />
      )}

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

function TaskCard({ is, isLate, isToday, onDone, onEdit, onDelete, onSnooze }: { is: GunlukIs, isLate?: boolean, isToday?: boolean, onDone: () => void, onEdit: () => void, onDelete: () => void, onSnooze: () => void }) {
  const done = is.durum === 'tamamlandi'
  const def = ONCELIK_TANIM[is.matris]
  
  const hasSnooze = !!(is.hatirlatici_tarihi || is.hatirlatici_saati)
  const displaySaati = is.hatirlatici_saati || is.hatirlatici
  
  return (
    <div className={`group flex flex-col p-3.5 rounded-2xl border transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
      done ? 'bg-white/5 border-white/5 opacity-60 grayscale-[50%]' 
           : isLate ? 'bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
           : isToday ? 'bg-blue-500/10 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
           : 'bg-black/20 border-white/10 hover:bg-white/5'
    }`}>
      <div className="flex items-start gap-3 relative z-10">
        <button onClick={onDone}
          className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            done ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110' : 'border-slate-500 hover:border-emerald-400 hover:bg-emerald-500/20 bg-black/20'
          }`}>
          {done && <Check size={14} className="text-emerald-950" strokeWidth={4} />}
        </button>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className={`text-sm font-bold leading-snug break-words transition-colors ${done ? 'line-through text-slate-500' : 'text-slate-100'}`}>
            {is.baslik}
          </p>
          {is.aciklama && <p className="text-[11px] font-medium text-slate-400 mt-1 pb-1">{is.aciklama}</p>}
          
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${def.bg} ${def.border} ${def.color}`}>
              {def.label.split(' ')[0]}
            </span>
            {displaySaati && !done && (
              <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${hasSnooze ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                <Bell size={10} /> {displaySaati} 
                {hasSnooze && <span className="opacity-70">({new Date(is.hatirlatici_tarihi!).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })})</span>}
              </span>
            )}
            {!isToday && !done && (
              <span className="text-[10px] font-semibold text-slate-500 ml-auto bg-black/20 px-2 py-0.5 rounded-md">
                {new Date(is.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {done && is.tamamlandi_at && (
              <span className="text-[9px] font-bold text-emerald-500/70 ml-auto bg-emerald-500/10 px-2 py-0.5 rounded-md">
                {new Date(is.tamamlandi_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover Actions */}
      <div className={`absolute right-2 top-2 flex flex-col gap-1 transition-all duration-200 ${done ? 'hidden' : 'opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'}`}>
        <button onClick={onSnooze} title="Ertele / Hatırlatıcı Ayarla" className="w-7 h-7 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-lg flex items-center justify-center border border-indigo-500/30 transition-all backdrop-blur-md">
          <BellRing size={12} />
        </button>
        <button onClick={onEdit} className="w-7 h-7 bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg flex items-center justify-center border border-blue-500/30 transition-all backdrop-blur-md">
          <Pencil size={12} />
        </button>
        <button onClick={onDelete} className="w-7 h-7 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-lg flex items-center justify-center border border-red-500/30 transition-all backdrop-blur-md">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
