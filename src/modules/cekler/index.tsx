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
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Cek, Dokuman } from '@/types'
import type { AppCtx } from '@/app/page'

const cls = {
  btnPrimary: "bg-blue-600 hover:bg-blue-500 text-slate-800 rounded-xl px-4 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40",
  btnSecondary: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40",
  input: "w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 transition-all",
};

const Modal = ({ title, onClose, children, footer, size = 'lg' }: { title: string, onClose: () => void, children: React.ReactNode, footer: React.ReactNode, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' }[size]
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white border border-blue-100 rounded-2xl shadow-2xl w-full ${sizeClass}`} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 text-lg p-5 border-b border-blue-100">{title}</h3>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-3 p-4 border-t border-blue-100 bg-slate-50 rounded-b-2xl">
          {footer}
        </div>
      </div>
    </div>
  )
}

const ConfirmModal = ({ title, message, onConfirm, onCancel, danger }: { title: string, message: string, onConfirm: () => void, onCancel: () => void, danger?: boolean }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-white border border-blue-100 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
      <h3 className="font-bold text-slate-800 text-lg p-5">{title}</h3>
      <p className="px-5 pb-5 text-slate-300">{message}</p>
      <div className="flex justify-end gap-3 p-4 border-t border-blue-100 bg-slate-50 rounded-b-2xl">
        <button onClick={onCancel} className={cls.btnSecondary}>İptal</button>
        <button onClick={onConfirm} className={danger ? "flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-slate-800 shadow-lg transition-all hover:bg-red-500" : cls.btnPrimary}>
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

const Loading = () => <div className="p-8 text-center text-slate-800">Yükleniyor...</div>

const DURUM_OPTS = [
  { val: 'odenecek', label: 'Ödenecek', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  { val: 'odendi', label: 'Ödendi', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
] as const

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function addDays(value: string, amount: number) {
  const dt = new Date(`${value}T00:00:00`)
  dt.setDate(dt.getDate() + amount)
  return dt.toISOString().split('T')[0]
}

function buildReminder(vadeTarihi: string, gunOnce: number, defaultTime: string, existingTime?: string | null) {
  const safeDays = Number.isFinite(gunOnce) ? Math.max(1, gunOnce) : 1
  return {
    hatirlatici_tarihi: addDays(vadeTarihi, -safeDays),
    hatirlatici_saati: existingTime || defaultTime,
    hatirlat_gun_once: safeDays,
  }
}

function isCompleted(cek: Cek) {
  return cek.durum === 'odendi'
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

export default function Cekler({ firma, firmalar, firmaIds, profil }: AppCtx) {
  const DEFAULT_REMINDER_TIME = (profil as any).varsayilan_bildirim_saati || '09:00'

  const [tab, setTab] = useState<'alinan' | 'verilen'>('alinan')
  const [q, setQ] = useState('')
  const [cekler, setCekler] = useState<Cek[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  const [modal, setModal] = useState<Partial<Cek> | null>(null)
  const [delId, setDelId] = useState<string | null>(null)
  const [reminderModal, setReminderModal] = useState<Cek | null>(null)
  const [reminderForm, setReminderForm] = useState({ tarih: todayStr(), saat: DEFAULT_REMINDER_TIME })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Döküman state
  const [dosyaMap, setDosyaMap]       = useState<Record<string, Dokuman[]>>({})
  const [pendingFiles, setPendingFiles] = useState<File[]>([])   // yeni çek — kayıt öncesi seçilen dosyalar
  const [uploading, setUploading]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
  }, [firmaIds.join(',')])

  useEffect(() => {
    timerRef.current = setInterval(checkReminders, 60_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [cekler])

  async function load() {
    setLoading(true)
    const [{ data: cData }, { data: docs }] = await Promise.all([
      supabase.from('cekler').select('*').in('firma_id', firmaIds).order('vade_tarihi', { ascending: true }),
      supabase.from('dokumanlar').select('*').in('firma_id', firmaIds).eq('bagli_tablo', 'cekler'),
    ])
    setCekler((cData || []) as Cek[])
    const map: Record<string, Dokuman[]> = {}
    ;(docs || []).forEach(doc => {
      const key = doc.bagli_kayit_id!
      if (!map[key]) map[key] = []
      map[key].push(doc as Dokuman)
    })
    setDosyaMap(map)
    setLoading(false)
  }

  function checkReminders() {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return
    const hhmm = new Date().toTimeString().slice(0, 5)
    const today = todayStr()
    cekler.forEach((cek) => {
      if (cek.durum !== 'odenecek') return
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
      return [cek.cek_no, cek.banka || '', cek.cari_hesap || '', cek.aciklama || '']
        .some((value) => value.toLocaleLowerCase('tr-TR').includes(needle))
    })
  }, [cekler, q, tab])

  const toplamBekleyen = filtered.filter((item) => item.durum === 'odenecek').reduce((sum, item) => sum + Number(item.tutar || 0), 0)
  const toplamTamamlanan = filtered.filter((item) => isCompleted(item)).reduce((sum, item) => sum + Number(item.tutar || 0), 0)
  const dueSoon = filtered.filter((item) => item.durum === 'odenecek' && item.hatirlatici_tarihi && item.hatirlatici_tarihi <= bugun)

  async function save() {
    if (!modal?.cek_no?.trim() || !modal.vade_tarihi || !modal.tutar) {
      alert('Cek numarasi, vade ve tutar zorunludur.')
      return
    }

    setSaving(true)
    const reminder = buildReminder(modal.vade_tarihi, Number(modal.hatirlat_gun_once || 1), DEFAULT_REMINDER_TIME, modal.hatirlatici_saati)
    const completed = modal.durum === 'odendi'
    const payload = {
      firma_id: modal.id ? (modal.firma_id || firma.id) : selFirmaId,
      musteri_id: modal.musteri_id || null,
      tip: modal.tip || tab,
      cek_no: modal.cek_no.trim(),
      banka: modal.banka || null,
      cari_hesap: modal.cari_hesap?.trim() || null,
      tutar: modal.tutar,
      keside_tarihi: modal.keside_tarihi || null,
      vade_tarihi: modal.vade_tarihi,
      durum: modal.durum || 'odenecek',
      aciklama: modal.aciklama || null,
      hatirlatici_tarihi: completed ? null : reminder.hatirlatici_tarihi,
      hatirlatici_saati: completed ? null : reminder.hatirlatici_saati,
      hatirlat_gun_once: completed ? null : reminder.hatirlat_gun_once,
      tamamlandi_at: completed ? new Date().toISOString() : null,
    }

    let cekId = modal.id
    if (cekId) {
      const { error } = await supabase.from('cekler').update(payload).eq('id', cekId)
      setSaving(false)
      if (error) { alert(error.message); return }
    } else {
      const { data, error } = await supabase.from('cekler').insert(payload).select('id').single()
      if (error) { setSaving(false); alert(error.message); return }
      cekId = data.id
      // Yeni çek için bekleyen dosyaları yükle
      if (pendingFiles.length > 0) {
        setUploading(true)
        for (const file of pendingFiles) {
          const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const path = `cekler/${firma.id}/${cekId}/${safeName}`
          const { error: sErr } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
          if (sErr) { alert(sErr.message); continue }
          const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
          await supabase.from('dokumanlar').insert({
            firma_id: firma.id,
            yukleyen_id: profil.auth_user_id,
            modul: 'diger' as const,
            kategori: 'cek',
            bagli_tablo: 'cekler',
            bagli_kayit_id: cekId,
            dosya_adi: file.name,
            dosya_url: urlData.publicUrl,
            mime_type: file.type || null,
            dosya_boyutu: file.size || null,
          })
        }
        setUploading(false)
        setPendingFiles([])
      }
      setSaving(false)
    }
    setModal(null)
    await load()
  }

  async function uploadDocForCek(cekId: string, file: File) {
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const path = `cekler/${firma.id}/${cekId}/${safeName}`
    const { error: sErr } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
    if (sErr) { alert(sErr.message); return }
    const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
    const { data: doc, error: dErr } = await supabase.from('dokumanlar').insert({
      firma_id: firma.id,
      yukleyen_id: profil.auth_user_id,
      modul: 'diger' as const,
      kategori: 'cek',
      bagli_tablo: 'cekler',
      bagli_kayit_id: cekId,
      dosya_adi: file.name,
      dosya_url: urlData.publicUrl,
      mime_type: file.type || null,
      dosya_boyutu: file.size || null,
    }).select().single()
    if (dErr) { alert(dErr.message); return }
    if (doc) {
      setDosyaMap(prev => ({ ...prev, [cekId]: [...(prev[cekId] || []), doc as Dokuman] }))
    }
  }

  async function handleExistingUpload(cekId: string, files: FileList) {
    setUploading(true)
    for (const file of Array.from(files)) { await uploadDocForCek(cekId, file) }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDoc(doc: Dokuman) {
    const { error: e } = await supabase.from('dokumanlar').delete().eq('id', doc.id)
    if (e) { alert(e.message); return }
    const key = doc.bagli_kayit_id!
    setDosyaMap(prev => ({ ...prev, [key]: (prev[key] || []).filter(d => d.id !== doc.id) }))
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
    const nextDurum = 'odendi'
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
    const pageWidth = doc.internal.pageSize.width
    const generatedAt = new Date().toLocaleString('tr-TR')
    const completedCount = filtered.filter((item) => isCompleted(item)).length
    const pendingCount = filtered.length - completedCount
    const totalAmount = filtered.reduce((sum, item) => sum + Number(item.tutar || 0), 0)

    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, pageWidth, 30, 'F')
    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.text(cleanTr(firma.ad || 'Firma Raporu'), 14, 16)
    doc.setFontSize(10)
    doc.text(title, 14, 24)
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(cleanTr(`Olusturma: ${generatedAt}`), pageWidth - 14, 16, { align: 'right' })
    doc.text(cleanTr(`Donem Kayit: ${filtered.length}`), pageWidth - 14, 24, { align: 'right' })

    const summaryY = 36
    const summaryItems = [
      { label: 'Toplam Kayit', value: String(filtered.length) },
      { label: 'Bekleyen', value: String(pendingCount) },
      { label: 'Toplam Tutar', value: `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(totalAmount)} TL` },
      { label: 'Bekleyen Tutar', value: `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(toplamBekleyen)} TL` },
    ]
    const boxW = (pageWidth - 28 - 18) / 4
    summaryItems.forEach((item, index) => {
      const x = 14 + index * (boxW + 6)
      doc.setFillColor(245, 247, 250)
      doc.roundedRect(x, summaryY, boxW, 16, 2, 2, 'F')
      doc.setTextColor(71, 85, 105)
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(cleanTr(item.label.toUpperCase()), x + 3, summaryY + 6)
      doc.setTextColor(15, 23, 42)
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(cleanTr(item.value), x + 3, summaryY + 12)
    })

    autoTable(doc, {
      startY: 58,
      head: [['Cek No', 'Vade', 'Durum', 'Hatirlatma', 'Tutar', 'Cari Hesap', 'Aciklama']],
      body: filtered.map((cek) => {
        const durum = DURUM_OPTS.find((item) => item.val === cek.durum)?.label || cek.durum
        const cariHesapText = getCekCariHesapText(cek)
        const aciklamaText = getCekAciklamaText(cek)
        return [
          cleanTr(cek.cek_no),
          cleanTr(new Date(cek.vade_tarihi).toLocaleDateString('tr-TR')),
          cleanTr(isCompleted(cek) ? `${durum} / Tamamlandi` : durum),
          cleanTr(cek.hatirlatici_tarihi ? `${new Date(cek.hatirlatici_tarihi).toLocaleDateString('tr-TR')} ${cek.hatirlatici_saati || ''}` : '-'),
          cleanTr(`${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(Number(cek.tutar || 0))} TL`),
          cleanTr(cariHesapText),
          cleanTr(aciklamaText),
        ]
      }),
      theme: 'grid',
      styles: { font: 'Helvetica', fontSize: 8, cellPadding: 2.8, textColor: [36, 50, 70], lineColor: [219, 228, 238], lineWidth: 0.2 },
      headStyles: { fillColor: tab === 'alinan' ? [20, 140, 100] : [225, 90, 25], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 251, 253] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 42 },
        2: { cellWidth: 23 },
        3: { cellWidth: 30 },
        4: { cellWidth: 35 },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 38 },
        7: { cellWidth: 52 },
      },
      margin: { left: 10, right: 10, top: 18, bottom: 16 },
      didDrawPage: () => {
        doc.setFont('Helvetica', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.setFontSize(8)
        doc.text(cleanTr(`Sayfa ${doc.getNumberOfPages()}`), pageWidth - 14, doc.internal.pageSize.height - 6, { align: 'right' })
      },
    })

    doc.save(`CekTakibi_${tab}_${bugun}.pdf`)
  }

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    const generatedAt = new Date().toLocaleString('tr-TR')
    const completedCount = filtered.filter((item) => isCompleted(item)).length
    const pendingCount = filtered.length - completedCount
    const totalAmount = filtered.reduce((sum, item) => sum + Number(item.tutar || 0), 0)
    const dataRows = filtered.map((cek) => {
      const durum = DURUM_OPTS.find((item) => item.val === cek.durum)?.label || cek.durum
      const cariHesapText = getCekCariHesapText(cek)
      const aciklamaText = getCekAciklamaText(cek)
      return [
        cek.cek_no,
        new Date(cek.vade_tarihi).toLocaleDateString('tr-TR'),
        isCompleted(cek) ? `${durum} / Tamamlandi` : durum,
        cek.hatirlatici_tarihi ? `${new Date(cek.hatirlatici_tarihi).toLocaleDateString('tr-TR')} ${cek.hatirlatici_saati || ''}` : '-',
        Number(cek.tutar || 0),
        cariHesapText,
        aciklamaText,
      ]
    })
    const headerRow = 10
    const rows = [
      [`${firma.ad || 'Firma'} - Cek Takibi`],
      [tab === 'alinan' ? 'Alinan Cekler Raporu' : 'Verilen Cekler Raporu'],
      [`Olusturma Tarihi: ${generatedAt}`],
      [],
      ['Rapor Ozeti', 'Deger'],
      ['Toplam Kayit', filtered.length],
      ['Bekleyen Kayit', pendingCount],
      ['Toplam Tutar', totalAmount],
      ['Bekleyen Tutar', toplamBekleyen],
      [],
      ['Cek No', 'Musteri', 'Vade', 'Durum', 'Hatirlatma', 'Tutar', 'Cari Hesap', 'Aciklama'],
      ...dataRows,
    ]

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 36 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    ]
    ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 }

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let r = 0; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const cell = XLSX.utils.encode_cell({ r, c })
        if (!ws[cell]) continue
        const isTitle = r === 0
        const isSubtitle = r === 1
        const isMeta = r === 2
        const isSummaryHead = r === 4
        const isSummaryBody = r >= 5 && r <= 8
        const isTableHead = r === headerRow
        const isData = r > headerRow

        ws[cell].s = {
          font: {
            name: 'Aptos',
            sz: isTitle ? 16 : isSubtitle ? 11 : isTableHead ? 11 : 10,
            bold: isTitle || isSubtitle || isSummaryHead || isTableHead || (isSummaryBody && c === 0),
            color: { rgb: isTitle ? 'FFFFFF' : isSubtitle ? 'E2E8F0' : isTableHead ? 'FFFFFF' : '1E293B' },
          },
          alignment: { vertical: 'center', horizontal: c === 5 ? 'right' : 'left', wrapText: true },
          fill: {
            fgColor: {
              rgb: isTitle ? '0F172A' : isSubtitle ? '1E293B' : isMeta ? 'F1F5F9' : isSummaryHead ? 'DBEAFE' : isSummaryBody ? 'F8FAFC' : isTableHead ? (tab === 'alinan' ? '0F766E' : 'C2410C') : r % 2 === 0 ? 'F8FAFC' : 'FFFFFF',
            },
          },
          border: {
            top: { style: 'thin', color: { rgb: 'D6DEE8' } },
            bottom: { style: 'thin', color: { rgb: 'D6DEE8' } },
            left: { style: 'thin', color: { rgb: 'D6DEE8' } },
            right: { style: 'thin', color: { rgb: 'D6DEE8' } },
          },
        }
        if ((r === 7 || r === 8 || (isData && c === 5)) && typeof ws[cell].v === 'number') {
          ws[cell].s.numFmt = '#,##0.00'
        }
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cek Takibi')
    XLSX.writeFile(wb, `CekTakibi_${tab}_${bugun}.xlsx`)
  }

  function getCekAciklamaText(cek: Cek) {
    const raw = String(
      cek.aciklama ??
      (cek as any).aciklama_notu ??
      (cek as any).notlar ??
      ''
    ).trim()
    if (!raw) return '-'
    if (raw === '_' || raw === '__' || raw === '___') return '-'
    return raw
  }

  function getCekCariHesapText(cek: Cek) {
    const raw = String((cek as any).cari_hesap ?? '').trim()
    return raw || '-'
  }

  if (loading) return <Loading />

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-slate-50">
              <Landmark size={18} className="text-slate-800" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-800">Çek Takibi</h1>
              <p className="text-[13px] text-slate-500">Vade öncesi uyarılar, erteleme ve ödeme tamamlama akışı</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!notifGranted && (
              <button onClick={requestNotifPermission} className={cls.btnSecondary}>
                <BellRing size={14} /> Bildirim İzni Ver
              </button>
            )}
            <button onClick={exportPDF} className={cls.btnSecondary}>
              <Download size={14} /> PDF
            </button>
            <button onClick={exportExcel} className={cls.btnSecondary}>
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={() => setModal({ tip: tab, vade_tarihi: bugun, durum: 'odenecek', tutar: 0, hatirlat_gun_once: 1, hatirlatici_saati: DEFAULT_REMINDER_TIME })} className={cls.btnPrimary}>
              <Plus size={14} /> Yeni Çek
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Bekleyen Tutar</p>
          <p className="mt-2 text-[22px] font-semibold tabular-nums text-amber-400">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(toplamBekleyen)}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Tamamlanan Tutar</p>
          <p className="mt-2 text-[22px] font-semibold tabular-nums text-emerald-400">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(toplamTamamlanan)}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Bugün Uyaranlar</p>
          <p className="mt-2 text-[22px] font-semibold tabular-nums text-[#0071e3]">{dueSoon.length}</p>
        </div>
      </div>

      {/* Main list */}
      <div className="rounded-2xl border border-blue-100 bg-white backdrop-blur-xl overflow-hidden">
        {/* Tab bar + search */}
        <div className="border-b border-blue-100 px-4 pt-4 pb-3 space-y-3">
          <div className="flex gap-1 rounded-xl border border-blue-100 bg-white p-1">
            <button onClick={() => setTab('alinan')} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all flex items-center justify-center gap-1.5 ${tab === 'alinan' ? 'bg-blue-50 text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>
              <ArrowDownLeft size={13} /> Alınan Çekler
            </button>
            <button onClick={() => setTab('verilen')} className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all flex items-center justify-center gap-1.5 ${tab === 'verilen' ? 'bg-blue-50 text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>
              <ArrowUpRight size={13} /> Verilen Çekler
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Çek no, banka veya müşteri ara..."
              className="w-full bg-slate-50 border border-blue-100 rounded-xl pl-9 pr-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-white/[0.06]">
          {filtered.length === 0 ? (
            <div className="py-14 text-center text-[13px] text-slate-400">Kayıt bulunamadı.</div>
          ) : filtered.map((cek) => {
            const durum = DURUM_OPTS.find((item) => item.val === cek.durum) || DURUM_OPTS[0]
            const DurumIcon = durum.icon
            const completed = isCompleted(cek)
            const isLate = cek.durum === 'odenecek' && cek.vade_tarihi < bugun

            return (
              <div key={cek.id} className="px-5 py-4 transition-colors hover:bg-slate-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className="text-[14px] font-medium text-slate-800">{cek.cek_no}</span>
                      {cek.banka && <span className="rounded-full border border-blue-100 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{cek.banka}</span>}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${durum.color}`}>
                        <DurumIcon size={10} /> {durum.label}
                      </span>
                      {completed && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Tamamlandı</span>}
                      {isLate && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">Vadesi Geçti</span>}
                      {cek.hatirlatici_tarihi && cek.durum === 'odenecek' && (
                        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                          Hatırlatma: {new Date(cek.hatirlatici_tarihi).toLocaleDateString('tr-TR')} {cek.hatirlatici_saati || ''}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      {cek.cari_hesap && <span className="inline-flex items-center gap-1"><Landmark size={11} /> Cari: {cek.cari_hesap}</span>}
                      <span>Vade: {new Date(cek.vade_tarihi).toLocaleDateString('tr-TR')}</span>
                      {cek.tamamlandi_at && <span>Tamamlandı: {new Date(cek.tamamlandi_at).toLocaleDateString('tr-TR')}</span>}
                      {cek.aciklama && <span className="truncate italic">{cek.aciklama}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[15px] font-semibold tabular-nums ${tab === 'alinan' ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(cek.tutar || 0))}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cek.durum === 'odenecek' && (
                    <>
                      <button onClick={() => markCompleted(cek)} className={cls.btnSecondary}>
                        <CheckCircle2 size={13} /> Ödendi
                      </button>
                      <button
                        onClick={() => {
                          setReminderModal(cek)
                          setReminderForm({ tarih: cek.hatirlatici_tarihi || cek.vade_tarihi, saat: cek.hatirlatici_saati || DEFAULT_REMINDER_TIME })
                        }}
                        className={cls.btnSecondary}
                      >
                        <BellRing size={13} /> Ertele
                      </button>
                    </>
                  )}
                  <button onClick={() => setModal(cek)} className={cls.btnSecondary}>
                    <Pencil size={13} /> Düzenle
                  </button>
                  <button onClick={() => setDelId(cek.id)} className="border-slate-200 bg-slate-50 hover:bg-red-600/80 hover:border-red-500/30 text-slate-700 hover:text-slate-800 rounded-xl px-3 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-colors">
                    <Trash2 size={13} /> Sil
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
        className="hidden"
        onChange={e => {
          if (!e.target.files?.length) return
          if (modal?.id) {
            void handleExistingUpload(modal.id, e.target.files)
          } else {
            setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)])
          }
          e.target.value = ''
        }}
      />

      {modal && (
        <Modal
          title={modal.id ? 'Ceki Duzenle' : tab === 'alinan' ? 'Alinan Cek Ekle' : 'Verilen Cek Ekle'}
          onClose={() => { setModal(null); setPendingFiles([]) }}
          footer={
            <>
              <button onClick={() => { setModal(null); setPendingFiles([]) }} className={cls.btnSecondary}>Iptal</button>
              <button onClick={save} disabled={saving || uploading} className={cls.btnPrimary}>
                {saving || uploading ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {!modal.id && firmalar.length > 1 && (
              <Field label="Firma">
                <select className={cls.input} value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                  {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
                </select>
              </Field>
            )}
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

            <Field label="Cari Hesap">
              <input
                className={cls.input}
                placeholder="Orn: ABC Insaat Cari Hesabi"
                value={modal.cari_hesap || ''}
                onChange={(e) => setModal((prev) => ({ ...prev!, cari_hesap: e.target.value }))}
              />
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
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${modal.durum === opt.val ? opt.color : 'border-blue-100 text-slate-400 hover:bg-white/5'}`}
                  >
                    <opt.icon size={12} /> {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Aciklama">
              <textarea className={`${cls.input} resize-none`} rows={2} value={modal.aciklama || ''} onChange={(e) => setModal((prev) => ({ ...prev!, aciklama: e.target.value }))} />
            </Field>

            {/* ── Dökümanlar ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest ml-1">Dökümanlar</label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0071e3] hover:text-slate-800 transition disabled:opacity-40"
                >
                  {uploading
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-[#0071e3] border-t-transparent animate-spin" />
                    : <Paperclip size={13} />
                  }
                  Dosya Ekle
                </button>
              </div>

              {/* Yeni çek — kayıt öncesi seçilen dosyalar */}
              {!modal.id && pendingFiles.length > 0 && (
                <div className="rounded-xl border border-blue-100 bg-white p-3 space-y-1.5 mb-2">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 group/f">
                      <FileText size={12} className="text-slate-400 shrink-0" />
                      <span className="flex-1 min-w-0 text-[12px] text-slate-300 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="opacity-0 group-hover/f:opacity-100 text-rose-400/60 hover:text-rose-400 transition"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Mevcut çek — kayıtlı dosyalar */}
              {modal.id && (() => {
                const docs = dosyaMap[modal.id] || []
                if (docs.length === 0) return (
                  <p className="text-[12px] text-slate-500 italic ml-1">Henüz döküman yüklenmedi</p>
                )
                return (
                  <div className="rounded-xl border border-blue-100 bg-white p-3 space-y-1.5">
                    {docs.map(doc => {
                      const isImg = doc.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(doc.dosya_adi)
                      return (
                        <div key={doc.id} className="flex items-center gap-2 group/doc">
                          <FileText size={12} className={isImg ? 'text-sky-400 shrink-0' : 'text-rose-400 shrink-0'} />
                          <a href={doc.dosya_url} target="_blank" rel="noreferrer"
                            className="flex-1 min-w-0 text-[12px] text-[#0071e3] hover:text-slate-800 truncate transition">
                            {doc.dosya_adi}
                          </a>
                          <span className="text-[10px] text-slate-500 shrink-0">{isImg ? 'Görsel' : 'PDF'}</span>
                          <button
                            type="button"
                            onClick={() => deleteDoc(doc)}
                            className="opacity-0 group-hover/doc:opacity-100 text-rose-400/60 hover:text-rose-400 transition"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {!modal.id && pendingFiles.length === 0 && (
                <p className="text-[12px] text-slate-500 italic ml-1">PDF veya görsel (JPG, PNG) yükleyebilirsiniz</p>
              )}
            </div>
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

