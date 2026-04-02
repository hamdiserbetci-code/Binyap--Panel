import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Cek, Musteri } from '@/types'
import type { AppCtx } from '@/app/page'

const cls = {
  btnPrimary: "flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-500 disabled:opacity-40",
  btnSecondary: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-40",
  input: "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 transition-all font-medium",
};

const Modal = ({ title, onClose, children, footer, size = 'lg' }: { title: string, onClose: () => void, children: React.ReactNode, footer: React.ReactNode, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' }[size]
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full ${sizeClass}`} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white text-lg p-5 border-b border-white/10">{title}</h3>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-3 p-4 border-t border-white/10 bg-slate-950/50 rounded-b-2xl">
          {footer}
        </div>
      </div>
    </div>
  )
}

const ConfirmModal = ({ title, message, onConfirm, onCancel, danger }: { title: string, message: string, onConfirm: () => void, onCancel: () => void, danger?: boolean }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
      <h3 className="font-bold text-white text-lg p-5">{title}</h3>
      <p className="px-5 pb-5 text-slate-300">{message}</p>
      <div className="flex justify-end gap-3 p-4 border-t border-white/10 bg-slate-950/50 rounded-b-2xl">
        <button onClick={onCancel} className={cls.btnSecondary}>İptal</button>
        <button onClick={onConfirm} className={danger ? "flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:bg-red-500" : cls.btnPrimary}>
          Onayla
        </button>
      </div>
    </div>
  </div>
)

const Field = ({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{label}{required && <span className="text-red-400">*</span>}</label>
    {children}
  </div>
)

const Loading = () => <div className="p-8 text-center text-white">Yükleniyor...</div>

const DURUM_OPTS = [
  { val: 'bekliyor', label: 'Bekliyor', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  { val: 'tahsil_edildi', label: 'Tahsil Edildi', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  { val: 'odendi', label: 'Odendi', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: CheckCircle2 },
  { val: 'karsiliksiz', label: 'Karsiliksiz', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: AlertCircle },
  { val: 'iade_edildi', label: 'Iade Edildi', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: XCircle },
  { val: 'ciro_edildi', label: 'Ciro Edildi', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: RefreshCw },
] as const

const DEFAULT_REMINDER_TIME = '09:00'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function addDays(value: string, amount: number) {
  const dt = new Date(`${value}T00:00:00`)
  dt.setDate(dt.getDate() + amount)
  return dt.toISOString().split('T')[0]
}

function buildReminder(vadeTarihi: string, gunOnce: number, existingTime?: string | null) {
  const safeDays = Number.isFinite(gunOnce) ? Math.max(1, gunOnce) : 1
  return {
    hatirlatici_tarihi: addDays(vadeTarihi, -safeDays),
    hatirlatici_saati: existingTime || DEFAULT_REMINDER_TIME,
    hatirlat_gun_once: safeDays,
  }
}

function isCompleted(cek: Cek) {
  return cek.durum === 'odendi' || cek.durum === 'tahsil_edildi'
}

function cleanTr(text: string) {
  const trMap: Record<string, string> = { s: 's' }
  return text
    ? text
        .replace(/ş/g, 's')
        .replace(/Ş/g, 'S')
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'I')
        .replace(/ğ/g, 'g')
        .replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u')
        .replace(/Ü/g, 'U')
        .replace(/ö/g, 'o')
        .replace(/Ö/g, 'O')
        .replace(/ç/g, 'c')
        .replace(/Ç/g, 'C')
    : ''
}

export default function Cekler({ firma }: AppCtx) {
  const [tab, setTab] = useState<'alinan' | 'verilen'>('alinan')
  const [q, setQ] = useState('')
  const [cekler, setCekler] = useState<Cek[]>([])
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [modal, setModal] = useState<Partial<Cek> | null>(null)
  const [delId, setDelId] = useState<string | null>(null)
  const [reminderModal, setReminderModal] = useState<Cek | null>(null)
  const [reminderForm, setReminderForm] = useState({ tarih: todayStr(), saat: DEFAULT_REMINDER_TIME })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    load()
  }, [firma.id])

  useEffect(() => {
    timerRef.current = setInterval(checkReminders, 60_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [cekler])

  async function load() {
    setLoading(true)
    const [{ data: cData }, { data: mData }] = await Promise.all([
      supabase.from('cekler').select('*').eq('firma_id', firma.id).order('vade_tarihi', { ascending: true }),
      supabase.from('musteriler').select('id,ad,kisa_ad').eq('firma_id', firma.id).eq('aktif', true).order('ad'),
    ])
    setCekler((cData || []) as Cek[])
    setMusteriler((mData || []) as Musteri[])
    setLoading(false)
  }

  function checkReminders() {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return
    const hhmm = new Date().toTimeString().slice(0, 5)
    const today = todayStr()
    cekler.forEach((cek) => {
      if (cek.durum !== 'bekliyor') return
      if (cek.hatirlatici_tarihi === today && cek.hatirlatici_saati === hhmm) {
        new Notification(tab === 'alinan' ? 'Alinan cek hatirlaticisi' : 'Verilen cek hatirlaticisi', {
          body: `${cek.cek_no} numarali cek icin odeme gunu yaklasti.`,
          icon: '/favicon.ico',
        })
      }
    })
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) return
    await Notification.requestPermission()
  }

  const bugun = todayStr()
  const notifGranted = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'

  const filtered = useMemo(() => {
    return cekler.filter((cek) => {
      if (cek.tip !== tab) return false
      if (!q) return true
      const needle = q.toLocaleLowerCase('tr-TR')
      const musteri = musteriler.find((m) => m.id === cek.musteri_id)
      return [cek.cek_no, cek.banka || '', cek.aciklama || '', musteri?.ad || '', musteri?.kisa_ad || '']
        .some((value) => value.toLocaleLowerCase('tr-TR').includes(needle))
    })
  }, [cekler, musteriler, q, tab])

  const toplamBekleyen = filtered.filter((item) => item.durum === 'bekliyor').reduce((sum, item) => sum + Number(item.tutar || 0), 0)
  const toplamTamamlanan = filtered.filter((item) => isCompleted(item)).reduce((sum, item) => sum + Number(item.tutar || 0), 0)
  const dueSoon = filtered.filter((item) => item.durum === 'bekliyor' && item.hatirlatici_tarihi && item.hatirlatici_tarihi <= bugun)

  async function save() {
    if (!modal?.cek_no?.trim() || !modal.vade_tarihi || !modal.tutar) {
      alert('Cek numarasi, vade ve tutar zorunludur.')
      return
    }

    setSaving(true)
    const reminder = buildReminder(modal.vade_tarihi, Number(modal.hatirlat_gun_once || 1), modal.hatirlatici_saati)
    const completed = modal.durum === 'odendi' || modal.durum === 'tahsil_edildi'
    const payload = {
      firma_id: firma.id,
      musteri_id: modal.musteri_id || null,
      tip: modal.tip || tab,
      cek_no: modal.cek_no.trim(),
      banka: modal.banka || null,
      tutar: modal.tutar,
      keside_tarihi: modal.keside_tarihi || null,
      vade_tarihi: modal.vade_tarihi,
      durum: modal.durum || 'bekliyor',
      aciklama: modal.aciklama || null,
      hatirlatici_tarihi: completed ? null : reminder.hatirlatici_tarihi,
      hatirlatici_saati: completed ? null : reminder.hatirlatici_saati,
      hatirlat_gun_once: completed ? null : reminder.hatirlat_gun_once,
      tamamlandi_at: completed ? new Date().toISOString() : null,
    }

    const { error } = modal.id
      ? await supabase.from('cekler').update(payload).eq('id', modal.id)
      : await supabase.from('cekler').insert(payload)

    setSaving(false)
    if (error) {
      alert(error.message)
      return
    }
    setModal(null)
    await load()
  }

  async function deleteCek() {
    if (!delId) return
    await supabase.from('cekler').delete().eq('id', delId)
    setDelId(null)
    await load()
  }

  async function saveReminder() {
    if (!reminderModal) return
    setSaving(true)
    const { error } = await supabase
      .from('cekler')
      .update({ hatirlatici_tarihi: reminderForm.tarih, hatirlatici_saati: reminderForm.saat })
      .eq('id', reminderModal.id)
    setSaving(false)
    if (error) {
      alert(error.message)
      return
    }
    setReminderModal(null)
    await load()
  }

  async function clearReminder(id: string) {
    await supabase.from('cekler').update({ hatirlatici_tarihi: null, hatirlatici_saati: null, hatirlat_gun_once: null }).eq('id', id)
    await load()
  }

  async function markCompleted(cek: Cek) {
    const nextDurum = cek.tip === 'alinan' ? 'tahsil_edildi' : 'odendi'
    await supabase
      .from('cekler')
      .update({
        durum: nextDurum,
        tamamlandi_at: new Date().toISOString(),
        hatirlatici_tarihi: null,
        hatirlatici_saati: null,
      })
      .eq('id', cek.id)
    await load()
  }

  async function exportPDF() {
    const jsPDFModule = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const jsPDF = jsPDFModule.default
    const autoTable = autoTableModule.default
    const doc = new jsPDF('landscape')
    const title = cleanTr(tab === 'alinan' ? 'ALINAN CEKLER RAPORU' : 'VERILEN CEKLER RAPORU')

    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(cleanTr(firma.ad || 'Firma Raporu'), 14, 18)
    doc.setFontSize(11)
    doc.text(title, 14, 25)
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Toplam Bekleyen: ${new Intl.NumberFormat('tr-TR').format(toplamBekleyen)} TL`, doc.internal.pageSize.width - 14, 18, { align: 'right' })

    autoTable(doc, {
      startY: 32,
      head: [['Cek No', 'Musteri', 'Vade', 'Durum', 'Hatirlatma', 'Tutar', 'Aciklama']],
      body: filtered.map((cek) => {
        const musteri = musteriler.find((m) => m.id === cek.musteri_id)
        const durum = DURUM_OPTS.find((item) => item.val === cek.durum)?.label || cek.durum
        return [
          cleanTr(cek.cek_no),
          cleanTr(musteri?.ad || '-'),
          cleanTr(new Date(cek.vade_tarihi).toLocaleDateString('tr-TR')),
          cleanTr(isCompleted(cek) ? `${durum} / Tamamlandi` : durum),
          cleanTr(cek.hatirlatici_tarihi ? `${new Date(cek.hatirlatici_tarihi).toLocaleDateString('tr-TR')} ${cek.hatirlatici_saati || ''}` : '-'),
          cleanTr(`${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(Number(cek.tutar || 0))} TL`),
          cleanTr(cek.aciklama || '-'),
        ]
      }),
      theme: 'grid',
      styles: { font: 'Helvetica', fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: tab === 'alinan' ? [16, 185, 129] : [249, 115, 22], textColor: 255 },
    })

    doc.save(`CekTakibi_${tab}_${bugun}.pdf`)
  }

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    const rows = [
      ['Cek No', 'Musteri', 'Vade', 'Durum', 'Hatirlatma', 'Tutar', 'Aciklama'],
      ...filtered.map((cek) => {
        const musteri = musteriler.find((m) => m.id === cek.musteri_id)
        const durum = DURUM_OPTS.find((item) => item.val === cek.durum)?.label || cek.durum
        return [
          cek.cek_no,
          musteri?.ad || '-',
          new Date(cek.vade_tarihi).toLocaleDateString('tr-TR'),
          isCompleted(cek) ? `${durum} / Tamamlandi` : durum,
          cek.hatirlatici_tarihi ? `${new Date(cek.hatirlatici_tarihi).toLocaleDateString('tr-TR')} ${cek.hatirlatici_saati || ''}` : '-',
          Number(cek.tutar || 0),
          cek.aciklama || '-',
        ]
      }),
    ]

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'CekTakibi')
    XLSX.writeFile(wb, `CekTakibi_${tab}_${bugun}.xlsx`)
  }

  if (loading) return <Loading />

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/15 text-blue-300">
              <Landmark size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Cek Takibi</h1>
              <p className="text-sm text-slate-400">Vade oncesi uyarilar, erteleme ve odeme tamamlama akisi</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!notifGranted && (
              <button onClick={requestNotifPermission} className={cls.btnSecondary}>
                <BellRing size={15} /> Bildirim Izni Ver
              </button>
            )}
            <button onClick={exportPDF} className={cls.btnSecondary}>
              <Download size={15} /> PDF
            </button>
            <button onClick={exportExcel} className={cls.btnSecondary}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button onClick={() => setModal({ tip: tab, vade_tarihi: bugun, durum: 'bekliyor', tutar: 0, hatirlat_gun_once: 1, hatirlatici_saati: DEFAULT_REMINDER_TIME })} className={cls.btnPrimary}>
              <Plus size={15} /> Yeni Cek
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="border-b border-white/5 p-5">
            <div className="flex gap-1 rounded-xl border border-white/5 bg-slate-950/40 p-1">
              <button onClick={() => setTab('alinan')} className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${tab === 'alinan' ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <span className="inline-flex items-center gap-2"><ArrowDownLeft size={14} /> Alinan Cekler</span>
              </button>
              <button onClick={() => setTab('verilen')} className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${tab === 'verilen' ? 'border border-orange-500/30 bg-orange-500/15 text-orange-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <span className="inline-flex items-center gap-2"><ArrowUpRight size={14} /> Verilen Cekler</span>
              </button>
            </div>

            <div className="relative mt-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cek no, banka veya musteri ara..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-3 p-5">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">Kayit bulunamadi.</div>
            ) : filtered.map((cek) => {
              const musteri = musteriler.find((m) => m.id === cek.musteri_id)
              const durum = DURUM_OPTS.find((item) => item.val === cek.durum) || DURUM_OPTS[0]
              const DurumIcon = durum.icon
              const completed = isCompleted(cek)
              const isLate = cek.durum === 'bekliyor' && cek.vade_tarihi < bugun

              return (
                <div key={cek.id} className="group relative rounded-2xl border border-white/5 bg-slate-800/40 p-4 transition hover:border-white/10 hover:bg-slate-800/70">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{cek.cek_no}</span>
                        {cek.banka && <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-300">{cek.banka}</span>}
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${durum.color}`}>
                          <DurumIcon size={10} /> {durum.label}
                        </span>
                        {completed && <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">Tamamlandi</span>}
                        {isLate && <span className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">Vadesi Gecti</span>}
                        {cek.hatirlatici_tarihi && cek.durum === 'bekliyor' && (
                          <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                            Hatirlatma: {new Date(cek.hatirlatici_tarihi).toLocaleDateString('tr-TR')} {cek.hatirlatici_saati || ''}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {musteri && <span className="inline-flex items-center gap-1"><Building2 size={12} /> {musteri.ad}</span>}
                        <span>Vade: {new Date(cek.vade_tarihi).toLocaleDateString('tr-TR')}</span>
                        {cek.tamamlandi_at && <span>Tamamlandi: {new Date(cek.tamamlandi_at).toLocaleDateString('tr-TR')}</span>}
                        {cek.aciklama && <span className="truncate italic">{cek.aciklama}</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-lg font-bold ${tab === 'alinan' ? 'text-emerald-400' : 'text-orange-400'}`}>
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(cek.tutar || 0))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {cek.durum === 'bekliyor' && (
                      <>
                        <button onClick={() => markCompleted(cek)} className={cls.btnSecondary}>
                          <CheckCircle2 size={14} /> {cek.tip === 'alinan' ? 'Tahsil Edildi' : 'Odeme Tamamlandi'}
                        </button>
                        <button
                          onClick={() => {
                            setReminderModal(cek)
                            setReminderForm({ tarih: cek.hatirlatici_tarihi || cek.vade_tarihi, saat: cek.hatirlatici_saati || DEFAULT_REMINDER_TIME })
                          }}
                          className={cls.btnSecondary}
                        >
                          <BellRing size={14} /> Ertele
                        </button>
                      </>
                    )}
                    <button onClick={() => setModal(cek)} className={cls.btnSecondary}>
                      <Pencil size={14} /> Duzenle
                    </button>
                    <button onClick={() => setDelId(cek.id)} className={cls.btnSecondary}>
                      <Trash2 size={14} /> Sil
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-xl">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Ozet</div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-[11px] font-bold text-slate-500">Bekleyen Tutar</div>
                <div className="mt-1 text-xl font-bold text-amber-300">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(toplamBekleyen)}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500">Tamamlanan Tutar</div>
                <div className="mt-1 text-xl font-bold text-emerald-300">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(toplamTamamlanan)}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500">Bugun Uyaranlar</div>
                <div className="mt-1 text-xl font-bold text-blue-300">{dueSoon.length}</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-xl">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Hatirlatma Plani</div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Her cek kaydinda vade tarihinden once otomatik hatirlatma olusturulur. Tarayici bildirimi masaustunde ve destekleyen mobil tarayicilarda calisir.
            </p>
          </div>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.id ? 'Ceki Duzenle' : tab === 'alinan' ? 'Alinan Cek Ekle' : 'Verilen Cek Ekle'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button onClick={() => setModal(null)} className={cls.btnSecondary}>Iptal</button>
              <button onClick={save} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cek Sinifi" required>
                <select className={cls.input} value={modal.tip || tab} onChange={(e) => setModal((prev) => ({ ...prev!, tip: e.target.value as Cek['tip'] }))}>
                  <option value="alinan">Alinan Cek</option>
                  <option value="verilen">Verilen Cek</option>
                </select>
              </Field>
              <Field label="Cek No" required>
                <input className={cls.input} value={modal.cek_no || ''} onChange={(e) => setModal((prev) => ({ ...prev!, cek_no: e.target.value }))} />
              </Field>
            </div>

            <Field label="Musteri / Cari">
              <select className={cls.input} value={modal.musteri_id || ''} onChange={(e) => setModal((prev) => ({ ...prev!, musteri_id: e.target.value || null }))}>
                <option value="">-- Bagimsiz --</option>
                {musteriler.map((item) => <option key={item.id} value={item.id}>{item.ad}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Banka">
                <input className={cls.input} value={modal.banka || ''} onChange={(e) => setModal((prev) => ({ ...prev!, banka: e.target.value }))} />
              </Field>
              <Field label="Tutar" required>
                <input type="number" step="0.01" className={cls.input} value={modal.tutar || ''} onChange={(e) => setModal((prev) => ({ ...prev!, tutar: parseFloat(e.target.value) }))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Keside Tarihi">
                <input type="date" className={cls.input} value={modal.keside_tarihi || ''} onChange={(e) => setModal((prev) => ({ ...prev!, keside_tarihi: e.target.value || null }))} />
              </Field>
              <Field label="Vade Tarihi" required>
                <input type="date" className={cls.input} value={modal.vade_tarihi || ''} onChange={(e) => setModal((prev) => ({ ...prev!, vade_tarihi: e.target.value }))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Kac Gun Once Uyarilsin">
                <input type="number" min="1" className={cls.input} value={modal.hatirlat_gun_once || 1} onChange={(e) => setModal((prev) => ({ ...prev!, hatirlat_gun_once: Number(e.target.value || 1) }))} />
              </Field>
              <Field label="Bildirim Saati">
                <input type="time" className={cls.input} value={modal.hatirlatici_saati || DEFAULT_REMINDER_TIME} onChange={(e) => setModal((prev) => ({ ...prev!, hatirlatici_saati: e.target.value }))} />
              </Field>
            </div>

            <Field label="Durum" required>
              <div className="grid grid-cols-2 gap-2">
                {DURUM_OPTS.map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setModal((prev) => ({ ...prev!, durum: opt.val as Cek['durum'] }))}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${modal.durum === opt.val ? opt.color : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                  >
                    <opt.icon size={12} /> {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Aciklama">
              <textarea className={`${cls.input} resize-none`} rows={2} value={modal.aciklama || ''} onChange={(e) => setModal((prev) => ({ ...prev!, aciklama: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {reminderModal && (
        <Modal
          title="Hatirlatmayi Ertele"
          onClose={() => setReminderModal(null)}
          size="sm"
          footer={
            <>
              <button onClick={() => setReminderModal(null)} className={cls.btnSecondary}>Iptal</button>
              <button onClick={saveReminder} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Ertelemeyi Kaydet'}</button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Yeni Tarih">
              <input type="date" className={cls.input} value={reminderForm.tarih} onChange={(e) => setReminderForm((prev) => ({ ...prev, tarih: e.target.value }))} />
            </Field>
            <Field label="Yeni Saat">
              <input type="time" className={cls.input} value={reminderForm.saat} onChange={(e) => setReminderForm((prev) => ({ ...prev, saat: e.target.value }))} />
            </Field>
            {(reminderModal.hatirlatici_tarihi || reminderModal.hatirlatici_saati) && (
              <button onClick={() => { clearReminder(reminderModal.id); setReminderModal(null) }} className="w-full rounded-xl border border-dashed border-red-500/30 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10">
                Mevcut Hatirlatmayi Temizle
              </button>
            )}
          </div>
        </Modal>
      )}

      {delId && <ConfirmModal title="Ceki Sil" message="Bu cek kaydi kalici olarak silinecektir." danger onConfirm={deleteCek} onCancel={() => setDelId(null)} />}
    </div>
  )
}
