'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Pencil, FileDown, Search, CreditCard,
  ChevronDown, ChevronUp, AlertCircle, FileText,
  Upload, X, Download, FileIcon, BellRing,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'
import type { IcraTakibi, IcraOdeme, IcraDurum, IcraIsciDurumu } from '@/types'
import { format } from 'date-fns'
// ─── Yardımcı ────────────────────────────────────────────────────────────────
const cls = {
  btnPrimary: "flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 hover:bg-blue-500 disabled:opacity-40 disabled:hover:scale-100",
  btnSecondary: "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-40",
  btnGhost: "flex items-center justify-center text-slate-500 hover:bg-slate-100 p-1.5 rounded-xl transition-all",
  card: "rounded-2xl border border-blue-100 bg-white shadow-sm",
  input: "w-full bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all font-medium",
  th: "px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider",
  td: "px-4 py-4",
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
      <p className="px-5 pb-5 text-slate-500">{message}</p>
      <div className="flex justify-end gap-3 p-4 border-t border-blue-100 bg-slate-50 rounded-b-2xl">
        <button onClick={onCancel} className={cls.btnSecondary}>İptal</button>
        <button onClick={onConfirm} className={danger ? "flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 hover:bg-red-500" : cls.btnPrimary}>
          Onayla
        </button>
      </div>
    </div>
  </div>
)

const Field = ({ label, children, hint, required }: { label: string, children: React.ReactNode, hint?: string, required?: boolean }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{label}{required && <span className="text-red-400">*</span>}</label>
    {children}
    {hint && <p className="text-xs text-slate-500 mt-1.5 ml-1">{hint}</p>}
  </div>
)

const Loading = () => <div className="p-8 text-center text-slate-500">Yükleniyor...</div>
const ErrorMsg = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
  <div className="p-8 text-center text-red-400">
    <p>Hata: {message}</p>
    <button onClick={onRetry} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Yeniden Dene</button>
  </div>
)

const TL = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'

const today = () => new Date().toISOString().split('T')[0]

const DURUM_LABEL: Record<IcraDurum, string> = {
  aktif:   'Aktif',
  odendi:  'Ödendi',
  kapali:  'Kapalı',
}
const DURUM_STYLE: Record<IcraDurum, string> = {
  aktif:   'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  odendi:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  kapali:  'bg-slate-500/15 text-slate-400 border border-slate-500/25',
}
const ISCI_STYLE: Record<IcraIsciDurumu, string> = {
  calisiyor: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  ayrildi:   'bg-red-500/15 text-red-400 border border-red-500/25',
}

const ACCEPT = '.doc,.docx,.xls,.xlsx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf'

type IcraForm = Omit<IcraTakibi, 'id' | 'firma_id' | 'created_at' | 'updated_at' | 'musteri'>
type OdemeForm = Omit<IcraOdeme, 'id' | 'icra_id' | 'firma_id' | 'created_at'>
type CevapForm = {
  cevap_veren: string
  isveren: string
  isci_durumu: 'devam' | 'cikti'
  cikis_tarihi: string
  maas_tutari: string
  aciklamalar: string
}

interface IcraTakibiExt extends IcraTakibi {
  hatirlatici_tarihi?: string | null;
  hatirlatici_saati?: string | null;
}

const EMPTY_FORM: IcraForm = {
  musteri_id: null, borclu_adi: '', tc_no: '', icra_dairesi_adi: '',
  dosya_no: '', tebligat_tarihi: today(), alacakli_adi: '',
  borc_tutari: 0, icra_dairesi_iban: '', cevap_tarihi: '',
  durum: 'aktif', isci_durumu: 'calisiyor',
  cikis_tarihi: null,
  kep_no: '', barkod_no: '',
  tebligat_dosya_url: null, tebligat_dosya_adi: null,
  cevap_dosya_url: null, cevap_dosya_adi: null,
  notlar: '',
}

// ─── Dosya uzantısı ──────────────────────────────────────────────────────────
function fileExt(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const colors: Record<string, string> = {
    pdf: 'text-red-400', doc: 'text-blue-400', docx: 'text-blue-400',
    xls: 'text-emerald-400', xlsx: 'text-emerald-400',
  }
  return { ext, color: colors[ext] || 'text-slate-400' }
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function IcraModule({ firma, firmalar, firmaIds }: AppCtx) {
  const [kayitlar, setKayitlar]   = useState<IcraTakibiExt[]>([])
  const [dosyaMap, setDosyaMap]   = useState<Record<string, any[]>>({})
  const [odemeler, setOdemeler]   = useState<Record<string, IcraOdeme[]>>({})

  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState('')
  const [saving, setSaving]       = useState(false)

  // Modal — kayıt
  const [modal, setModal]         = useState<{ id?: string; form: IcraForm, firma_id?: string } | null>(null)
  const [modalErr, setModalErr]   = useState('')
  const [deleteId, setDeleteId]   = useState<string | null>(null)

  // Dosya yükleme bekleyenleri (yeni kayıt için)
  const [pendingTebligat, setPendingTebligat] = useState<File | null>(null)
  const [pendingCevap, setPendingCevap]       = useState<File | null>(null)
  const [uploading, setUploading]             = useState(false)
  const tebligatRef = useRef<HTMLInputElement>(null)
  const cevapRef    = useRef<HTMLInputElement>(null)

  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  // Modal — ödeme
  const [odemeModal, setOdemeModal] = useState<{ kayit: IcraTakibiExt; form: OdemeForm } | null>(null)
  const [odemeDeleteId, setOdemeDeleteId] = useState<{ icraId: string; odemeId: string } | null>(null)

  // Modal — cevap yazısı
  const [cevapModal, setCevapModal] = useState<{ kayit: IcraTakibi; form: CevapForm } | null>(null)
  const [isGeneratingCevap, setIsGeneratingCevap] = useState(false)

  const [reminderModal, setReminderModal] = useState<{ id: string; tarih: string; saat: string; hasExisting: boolean } | null>(null)
  const [uploadingItem, setUploadingItem] = useState<string | null>(null)
  const [evrakModal, setEvrakModal] = useState<{ icraId: string; kategori: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Genişletilmiş satır
  const [expanded, setExpanded]   = useState<string | null>(null)

  // Filtreler
  const [search, setSearch]             = useState('')
  const [durumFilter, setDurumFilter]   = useState<IcraDurum | 'hepsi'>('hepsi')
  const [isciFilter, setIsciFilter]     = useState<IcraIsciDurumu | 'hepsi'>('hepsi')

  // ─── Veri yükle ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const icraRes = await supabase.from('icra_takibi')
        .select('*')
        .in('firma_id', firmaIds)
        .order('tebligat_tarihi', { ascending: false })
      if (icraRes.error) throw icraRes.error
      setKayitlar((icraRes.data || []) as IcraTakibiExt[])

      const ids = (icraRes.data || []).map((x: any) => x.id)
      if (ids.length) {
        const [od, docs] = await Promise.all([
          supabase.from('icra_odemeler').select('*').in('icra_id', ids).order('odeme_tarihi', { ascending: false }),
          supabase.from('dokumanlar').select('*').in('firma_id', firmaIds).eq('bagli_tablo', 'icra_takibi').in('bagli_kayit_id', ids)
        ])
        if (od.data) {
          const map: Record<string, IcraOdeme[]> = {}
          od.data.forEach((o: IcraOdeme) => {
            if (!map[o.icra_id]) map[o.icra_id] = []
            map[o.icra_id].push(o)
          })
          setOdemeler(map)
        }
        if (docs.data) {
          const dMap: Record<string, any[]> = {}
          docs.data.forEach((d: any) => {
            if (!dMap[d.bagli_kayit_id]) dMap[d.bagli_kayit_id] = []
            dMap[d.bagli_kayit_id].push(d)
          })
          setDosyaMap(dMap)
        }
      }
    } catch (e: any) { setErr(e?.message || 'Veri yüklenemedi') }
    finally { setLoading(false) }
  }, [firma.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const d = now.toISOString().split('T')[0]
      kayitlar.forEach(k => {
        if (k.hatirlatici_tarihi === d && k.hatirlatici_saati === hhmm && k.durum === 'aktif') {
          new Notification('İcra Takibi Hatırlatıcısı', { body: `${k.dosya_no} numaralı dosya için hatırlatma: ${k.borclu_adi}`, icon: '/favicon.ico' })
        }
      })
    }, 60000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [kayitlar])

  async function requestNotifPermission() {
    if (!('Notification' in window)) return
    await Notification.requestPermission()
  }

  // ─── Hesaplamalar ──────────────────────────────────────────────────────────
  const odemeToplamı = (id: string) => (odemeler[id] || []).reduce((s, o) => s + o.tutar, 0)
  const kalanBorc    = (k: IcraTakibi) => Math.max(0, k.borc_tutari - odemeToplamı(k.id))

  // ─── Dosya yükleme ────────────────────────────────────────────────────────
  async function uploadFile(file: File, icraId: string, tip: 'tebligat' | 'cevap') {
    const ext   = file.name.split('.').pop()
    const path  = `${firma.id}/icra/${icraId}/${tip}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('dokumanlar').upload(path, file, { upsert: true })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('dokumanlar').getPublicUrl(path)
    return { url: publicUrl, adi: file.name }
  }

  async function deleteFile(url: string) {
    const path = url.split('/dokumanlar/')[1]
    if (path) await supabase.storage.from('dokumanlar').remove([path])
  }

  async function uploadGenericFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    const icraId = evrakModal?.icraId || uploadingItem
    if (!files?.length || !icraId) return
    const kategori = evrakModal?.kategori || 'diger'
    setSaving(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
      const path = `${firma.id}/icra_ek/${icraId}/${safeName}`
      const { error: storageError } = await supabase.storage.from('dokumanlar').upload(path, file)
      if (storageError) { alert(storageError.message); continue }
      const { data: urlData } = supabase.storage.from('dokumanlar').getPublicUrl(path)
      await supabase.from('dokumanlar').insert({
        firma_id: firma.id, modul: 'icra_takibi', bagli_tablo: 'icra_takibi',
        bagli_kayit_id: icraId, dosya_adi: file.name, dosya_url: urlData.publicUrl,
        mime_type: file.type || null, dosya_boyutu: file.size || null,
        kategori,
      })
    }
    setSaving(false)
    setUploadingItem(null)
    setEvrakModal(null)
    if (fileRef.current) fileRef.current.value = ''
    await load()
  }

  async function deleteExtraDoc(d: any) {
    if (!confirm('Bu evrak silinecek, onaylıyor musunuz?')) return
    setSaving(true)
    const path = d.dosya_url.split('/dokumanlar/')[1]
    if (path) await supabase.storage.from('dokumanlar').remove([path])
    await supabase.from('dokumanlar').delete().eq('id', d.id)
    setSaving(false)
    load()
  }

  // ─── Dosyayı kaldır (kayıttan) ────────────────────────────────────────────
  async function removeDocFromRecord(icraId: string, tip: 'tebligat' | 'cevap') {
    const kayit = kayitlar.find(k => k.id === icraId)
    if (!kayit) return
    const url = tip === 'tebligat' ? kayit.tebligat_dosya_url : kayit.cevap_dosya_url
    if (url) await deleteFile(url)
    await supabase.from('icra_takibi').update(
      tip === 'tebligat'
        ? { tebligat_dosya_url: null, tebligat_dosya_adi: null }
        : { cevap_dosya_url: null, cevap_dosya_adi: null }
    ).eq('id', icraId)
    load()
  }

  // ─── CRUD — kayıt ────────────────────────────────────────────────────────
  function openNew() {
    setModalErr(''); setPendingTebligat(null); setPendingCevap(null)
    setModal({ form: { ...EMPTY_FORM } })
  }
  function openEdit(k: IcraTakibi) {
    setModalErr(''); setPendingTebligat(null); setPendingCevap(null)
    setModal({
      id: k.id,
      firma_id: k.firma_id,
      form: {
        musteri_id: k.musteri_id ?? null, borclu_adi: k.borclu_adi, tc_no: k.tc_no ?? '',
        icra_dairesi_adi: k.icra_dairesi_adi, dosya_no: k.dosya_no,
        tebligat_tarihi: k.tebligat_tarihi, alacakli_adi: k.alacakli_adi,
        borc_tutari: k.borc_tutari, icra_dairesi_iban: k.icra_dairesi_iban ?? '',
        cevap_tarihi: k.cevap_tarihi ?? '', durum: k.durum,
        isci_durumu: k.isci_durumu ?? 'calisiyor',
        cikis_tarihi: k.cikis_tarihi ?? null,
        kep_no: k.kep_no ?? '', barkod_no: k.barkod_no ?? '',
        tebligat_dosya_url: k.tebligat_dosya_url ?? null,
        tebligat_dosya_adi: k.tebligat_dosya_adi ?? null,
        cevap_dosya_url: k.cevap_dosya_url ?? null,
        cevap_dosya_adi: k.cevap_dosya_adi ?? null,
        notlar: k.notlar ?? '',
      },
    })
  }
  const setF = (p: Partial<IcraForm>) => setModal(m => m ? { ...m, form: { ...m.form, ...p } } : m)

  async function save() {
    if (!modal) return
    const f = modal.form
    if (!f.borclu_adi.trim())       { setModalErr('Borçlu adı zorunludur'); return }
    if (!f.icra_dairesi_adi.trim()) { setModalErr('İcra dairesi adı zorunludur'); return }
    if (!f.dosya_no.trim())         { setModalErr('Dosya numarası zorunludur'); return }
    if (!f.tebligat_tarihi)         { setModalErr('Tebligat tarihi zorunludur'); return }
    if (!f.alacakli_adi.trim())     { setModalErr('Alacaklı adı zorunludur'); return }
    if (f.borc_tutari <= 0)         { setModalErr('Borç tutarı sıfırdan büyük olmalıdır'); return }

    setSaving(true); setUploading(false); setModalErr('')

    const firmaIdToSave = modal.id ? modal.firma_id : selFirmaId;
    const firmaToSave = firmalar.find(frm => frm.id === firmaIdToSave);
    const sirketAdi = firmaToSave?.kisa_ad === 'BİNYAPI' ? 'BİNYAPI' : 'ETM';

    const basePayload = {
      firma_id: firmaIdToSave,
      musteri_id: f.musteri_id || null,
      borclu_adi: f.borclu_adi.trim(),
      tc_no: f.tc_no?.trim() || null,
      icra_dairesi_adi: f.icra_dairesi_adi.trim(),
      dosya_no: f.dosya_no.trim(),
      tebligat_tarihi: f.tebligat_tarihi,
      alacakli_adi: f.alacakli_adi.trim(),
      borc_tutari: Number(f.borc_tutari),
      icra_dairesi_iban: f.icra_dairesi_iban?.trim() || null,
      cevap_tarihi: f.cevap_tarihi || null,
      durum: f.durum,
      isci_durumu: f.isci_durumu,
      cikis_tarihi: f.isci_durumu === 'ayrildi' ? (f.cikis_tarihi || null) : null,
      kep_no: f.kep_no?.trim() || null,
      barkod_no: f.barkod_no?.trim() || null,
      notlar: f.notlar?.trim() || null,
      sirket: sirketAdi,
      updated_at: new Date().toISOString(),
    }

    let icraId = modal.id
    if (modal.id) {
      const { error } = await supabase.from('icra_takibi').update(basePayload).eq('id', modal.id)
      if (error) { setModalErr(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('icra_takibi').insert(basePayload).select('id').single()
      if (error) { setModalErr(error.message); setSaving(false); return }
      icraId = data.id
    }

    // Dosya yüklemeleri
    if (icraId && (pendingTebligat || pendingCevap)) {
      setUploading(true)
      const fileUpdates: Record<string, string | null> = {}
      try {
        if (pendingTebligat) {
          // Eski dosyayı sil
          if (f.tebligat_dosya_url) await deleteFile(f.tebligat_dosya_url)
          const { url, adi } = await uploadFile(pendingTebligat, icraId, 'tebligat')
          fileUpdates.tebligat_dosya_url = url
          fileUpdates.tebligat_dosya_adi = adi
        }
        if (pendingCevap) {
          if (f.cevap_dosya_url) await deleteFile(f.cevap_dosya_url)
          const { url, adi } = await uploadFile(pendingCevap, icraId, 'cevap')
          fileUpdates.cevap_dosya_url = url
          fileUpdates.cevap_dosya_adi = adi
        }
        if (Object.keys(fileUpdates).length) {
          await supabase.from('icra_takibi').update(fileUpdates).eq('id', icraId)
        }
      } catch (e: any) { setModalErr('Dosya yükleme hatası: ' + e.message); setSaving(false); return }
      setUploading(false)
    }

    setSaving(false)
    setModal(null)
    load()
  }

  async function deleteKayit() {
    if (!deleteId) return
    // Dosyaları sil
    const k = kayitlar.find(x => x.id === deleteId)
    if (k?.tebligat_dosya_url) await deleteFile(k.tebligat_dosya_url)
    if (k?.cevap_dosya_url) await deleteFile(k.cevap_dosya_url)
    await supabase.from('icra_takibi').delete().eq('id', deleteId)
    setDeleteId(null); load()
  }

  // ─── CRUD — ödemeler ──────────────────────────────────────────────────────
  function openOdemeModal(kayit: IcraTakibiExt) {
    setOdemeModal({ kayit, form: { odeme_tarihi: today(), tutar: 0, aciklama: '' } })
  }
  async function saveOdeme() {
    if (!odemeModal) return
    const { kayit, form } = odemeModal
    if (!form.odeme_tarihi || form.tutar <= 0) return
    setSaving(true)
    const { error } = await supabase.from('icra_odemeler').insert({
      icra_id: kayit.id,
      firma_id: kayit.firma_id,
      sirket: (kayit as any).sirket || 'ETM',
      odeme_tarihi: form.odeme_tarihi, tutar: Number(form.tutar),
      aciklama: form.aciklama?.trim() || null,
    })
    setSaving(false)
    if (!error) { setOdemeModal(null); load() }
  }
  async function deleteOdeme() {
    if (!odemeDeleteId) return
    await supabase.from('icra_odemeler').delete().eq('id', odemeDeleteId.odemeId)
    setOdemeDeleteId(null); load()
  }

  async function saveReminder() {
    if (!reminderModal?.tarih || !reminderModal?.saat) return
    setSaving(true)
    const { error } = await supabase.from('icra_takibi').update({ hatirlatici_tarihi: reminderModal.tarih, hatirlatici_saati: reminderModal.saat }).eq('id', reminderModal.id)
    setSaving(false)
    if (!error) { setReminderModal(null); load() }
  }

  async function clearReminder(id: string) {
    setSaving(true)
    const { error } = await supabase.from('icra_takibi').update({ hatirlatici_tarihi: null, hatirlatici_saati: null }).eq('id', id)
    setSaving(false)
    if (!error) { setReminderModal(null); load() }
  }

  // ─── Cevap Yazısı (Word) ──────────────────────────────────────────────────
  function openCevapModal(k: IcraTakibi) {
    setCevapModal({
      kayit: k,
      form: {
        cevap_veren: '',
        isveren: firma.ad,
        isci_durumu: k.isci_durumu === 'ayrildi' ? 'cikti' : 'devam',
        cikis_tarihi: k.cikis_tarihi || '',
        maas_tutari: '',
        aciklamalar: '',
      },
    })
  }

  async function generateCevapYazisi() {
    if (!cevapModal) return
    setIsGeneratingCevap(true)
    const { kayit, form } = cevapModal
    const tarihFmt = (t?: string | null) => t ? format(new Date(t + 'T00:00:00'), 'dd/MM/yyyy') : '............'
    const bugun = format(new Date(), 'dd/MM/yyyy')
    const fileName = `Icra_Cevap_${kayit.dosya_no.replace(/[/\\:*?"<>|]/g, '_')}_${bugun.replace(/\//g, '-')}.doc`
    const maas = parseFloat(form.maas_tutari) || 0
    const kesinti = maas > 0 ? (maas / 4).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '............'

    const isverenAd = form.isveren
    const isverenKisaAd = isverenAd

    // Logo: ETM mi yoksa genel mi?
    const isEtm = /etm/i.test(isverenKisaAd || '')
    const logoHtml = isEtm
      ? `<table style="border-collapse:collapse;width:220pt;line-height:1">
           <tr>
             <td style="width:5pt;background:#C8922A;padding:0;font-size:1pt">&nbsp;</td>
             <td style="background:#0B1C38;padding:9pt 18pt 9pt 14pt;vertical-align:middle">
               <p style="margin:0;font-family:'Arial Black',Arial,sans-serif;font-size:26pt;font-weight:900;color:#FFFFFF;letter-spacing:7pt;line-height:1">ETM</p>
             </td>
             <td style="background:#0B1C38;width:10pt;padding:0;vertical-align:middle">
               <table style="border-collapse:collapse;width:100%;height:100%"><tr>
                 <td style="background:#C8922A;width:3pt;padding:0;font-size:1pt">&nbsp;</td>
                 <td style="background:#152C50;padding:0;font-size:1pt">&nbsp;</td>
               </tr></table>
             </td>
           </tr>
           <tr>
             <td colspan="3" style="background:#C8922A;padding:0;height:3pt;font-size:1pt;line-height:0">&nbsp;</td>
           </tr>
         </table>`
      : `<table style="border-collapse:collapse;width:220pt;line-height:1">
           <tr>
             <td style="width:5pt;background:#2E86C1;padding:0;font-size:1pt">&nbsp;</td>
             <td style="background:#1A2E4A;padding:9pt 18pt 9pt 14pt;vertical-align:middle">
               <p style="margin:0;font-family:'Arial Black',Arial,sans-serif;font-size:20pt;font-weight:900;color:#FFFFFF;letter-spacing:3pt;line-height:1">${isverenKisaAd.substring(0, 9).toUpperCase()}</p>
             </td>
             <td style="background:#1A2E4A;width:10pt;padding:0;vertical-align:middle">
               <table style="border-collapse:collapse;width:100%;height:100%"><tr>
                 <td style="background:#2E86C1;width:3pt;padding:0;font-size:1pt">&nbsp;</td>
                 <td style="background:#243B55;padding:0;font-size:1pt">&nbsp;</td>
               </tr></table>
             </td>
           </tr>
           <tr>
             <td colspan="3" style="background:#2E86C1;padding:0;height:3pt;font-size:1pt;line-height:0">&nbsp;</td>
           </tr>
         </table>`

    const imzaAdi = form.cevap_veren || form.isveren
    const icerik = form.isci_durumu === 'cikti'
      ? `<p style="margin:0 0 8pt 0">Dairenizin yukarıda esas numarası yazılı icra takip dosyasında borçlu olarak gösterilen
         <strong>${kayit.borclu_adi}</strong>${kayit.tc_no ? ` (TC: ${kayit.tc_no})` : ''} hakkında
         tarafımıza tebliğ edilen haciz ihbarnamesi incelenmiştir.</p>
         <p style="margin:0 0 8pt 0">Adı geçen şahıs, firmamız bünyesinde <strong>${tarihFmt(form.cikis_tarihi)}</strong> tarihi
         itibarıyla iş akdi feshedilerek ayrılmış olup, hâlen firmamızda çalışmamaktadır. Herhangi bir kesinti yapılması mümkün bulunmamaktadır.</p>
         ${form.aciklamalar ? `<p style="margin:0 0 8pt 0"><strong>Açıklama:</strong> ${form.aciklamalar}</p>` : ''}`
      : `<p style="margin:0 0 8pt 0">Dairenizin yukarıda esas numarası yazılı icra takip dosyasında borçlu olarak gösterilen
         <strong>${kayit.borclu_adi}</strong>${kayit.tc_no ? ` (TC: ${kayit.tc_no})` : ''} hakkında
         tarafımıza tebliğ edilen haciz ihbarnamesi incelenmiştir.</p>
         <p style="margin:0 0 8pt 0">Adı geçen şahıs firmamız bünyesinde hâlen çalışmakta olup aylık net ücreti
         <strong>${maas > 0 ? maas.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '............'}</strong>'dir.</p>
         <p style="margin:0 0 8pt 0">İcra ve İflas Kanunu'nun 355. maddesi gereğince, aylık net ücretin dörtte biri
         tutarında kesinti yapılarak <strong>${kayit.dosya_no}</strong> sayılı dosyaya yatırılacaktır.</p>
         ${form.aciklamalar ? `<p style="margin:0 0 8pt 0"><strong>Açıklama:</strong> ${form.aciklamalar}</p>` : ''}`

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml>
  <w:WordDocument>
    <w:View>Print</w:View><w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml><![endif]-->
<style>
  @page { size:A4 portrait; margin:2cm 2.5cm 2.5cm 2.5cm; }
  body  { font-family:"Times New Roman",serif; font-size:11pt; color:#111111; line-height:1.55; margin:0; padding:0; word-wrap:break-word; }
  p     { margin:0 0 9pt 0; orphans:3; widows:3; }
  strong{ font-weight:bold; }

  /* Bilgi tablosu */
  table.bil { width:100%; border-collapse:collapse; margin:0 0 14pt 0; table-layout:fixed; }
  table.bil td { font-size:10pt; padding:4pt 6pt; vertical-align:top; word-wrap:break-word; }
  table.bil td.lbl { font-weight:bold; width:90pt; background:#EFEFEF; border:1px solid #CCCCCC; white-space:nowrap; }
  table.bil td.val { background:#FAFAFA; border:1px solid #CCCCCC; }
  table.bil td.val2{ background:#FAFAFA; border:1px solid #CCCCCC; }

  /* İmza */
  table.imza { width:100%; border-collapse:collapse; margin-top:36pt; }
  table.imza td { font-size:10.5pt; vertical-align:top; }
</style>
</head><body>

<!-- ═══ BAŞLIK ═══ -->
<table style="width:100%;border-collapse:collapse;margin-bottom:20pt;table-layout:fixed;">
  <tr>
    <td style="width:55%;vertical-align:middle;padding:0;">${logoHtml}</td>
    <td style="width:45%;vertical-align:middle;text-align:right;padding:0;font-size:10.5pt;font-family:'Times New Roman',serif;color:#222222;">
      <span style="display:block;margin-bottom:2pt;"><strong>${bugun}</strong></span>
      <span style="font-size:9pt;color:#555555;">Tarih</span>
    </td>
  </tr>
</table>

<!-- ═══ ADRES ═══ -->
<p style="margin:0 0 2pt 0;font-size:11pt;"><strong>${kayit.icra_dairesi_adi}</strong></p>
<p style="margin:0 0 16pt 0;font-size:11pt;">SAYIN MÜDÜRLÜĞÜNE</p>

<!-- ═══ KONU ═══ -->
<p style="margin:0 0 14pt 0;font-size:11pt;font-weight:bold;border-bottom:1.5pt solid #333333;padding-bottom:5pt;letter-spacing:0.2pt;">
  KONU: ${kayit.dosya_no} Esas Sayılı Dosyaya Cevabımızdır.
</p>

<!-- ═══ BİLGİ TABLOSU ═══ -->
<table class="bil">
  <tr>
    <td class="lbl">İcra Dairesi</td>
    <td class="val" colspan="3">${kayit.icra_dairesi_adi}</td>
  </tr>
  <tr>
    <td class="lbl">Dosya No</td>
    <td class="val" style="width:90pt;">${kayit.dosya_no}</td>
    <td class="lbl" style="width:90pt;">Borç Miktarı</td>
    <td class="val2">${kayit.borc_tutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
  </tr>
  <tr>
    <td class="lbl">Tebligat Tarihi</td>
    <td class="val">${tarihFmt(kayit.tebligat_tarihi)}</td>
    <td class="lbl">Cevap Tarihi</td>
    <td class="val2">${kayit.cevap_tarihi ? tarihFmt(kayit.cevap_tarihi) : bugun}</td>
  </tr>
  <tr>
    <td class="lbl">Alacaklı</td>
    <td class="val" colspan="3">${kayit.alacakli_adi}</td>
  </tr>
  <tr>
    <td class="lbl">Borçlu</td>
    <td class="val" colspan="3">
      ${kayit.borclu_adi}${kayit.tc_no ? ' &mdash; TC No: ' + kayit.tc_no : ''}
      <br><strong style="font-size:9.5pt;">[${form.isci_durumu === 'cikti' ? 'AYRILMIŞ / İŞTEN ÇIKMIŞ' : 'ÇALIŞMAYA DEVAM ETMEKTEDİR'}]</strong>
    </td>
  </tr>
  ${kayit.icra_dairesi_iban ? `<tr><td class="lbl">IBAN</td><td class="val" colspan="3">${kayit.icra_dairesi_iban}</td></tr>` : ''}
</table>

<!-- ═══ YAZI GÖVDESİ ═══ -->
${icerik}

<!-- ═══ İMZA ═══ -->
<table class="imza">
  <tr>
    <td style="width:58%;padding-top:8pt;">
      <p style="margin:0 0 0 0;font-size:10.5pt;">Saygılarımızla,</p>
      <p style="margin:18pt 0 0 0;font-size:10.5pt;"><strong>${isverenAd}</strong></p>
    </td>
    <td style="width:42%;text-align:center;padding-top:8pt;">
      <p style="margin:0 0 36pt 0;font-size:10pt;color:#777777;">(İmza)</p>
      <p style="margin:0;border-top:1pt solid #333333;padding-top:5pt;font-size:10.5pt;">
        <strong>${imzaAdi}</strong>
      </p>
      <p style="margin:3pt 0 0 0;font-size:9pt;color:#444444;">İşveren / Yetkili</p>
    </td>
  </tr>
</table>

</body></html>`

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })

    // Otomatik olarak "Cevap Evrakı" olarak kaydet
    const docFile = new File([blob], fileName, { type: 'application/msword' })
    try {
      if (kayit.cevap_dosya_url) {
        await deleteFile(kayit.cevap_dosya_url)
      }
      const { url, adi } = await uploadFile(docFile, kayit.id, 'cevap')
      await supabase.from('icra_takibi').update({
        cevap_dosya_url: url,
        cevap_dosya_adi: adi,
        updated_at: new Date().toISOString(),
      }).eq('id', kayit.id)
    } catch (e: any) {
      alert('Cevap yazısı yüklenemedi: ' + e.message)
      setIsGeneratingCevap(false)
      return
    }

    // Kullanıcıya indirt
    const downloadUrl  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(downloadUrl)
    setIsGeneratingCevap(false)
    setCevapModal(null)
    await load()
  }

  // ─── PDF Export ──────────────────────────────────────────────────────────
  async function exportPdf() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF('landscape', 'mm', 'a4')

      // PDF'in standart fontları Türkçe karakter desteklemediği için sorunları önleme temizliği
      const cleanTr = (text: string) => 
        String(text || '').replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's')
            .replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u')
            .replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c')
            .replace(/₺/g, 'TL')

      doc.setFontSize(14)
      doc.text(cleanTr(`${firma.ad} - Icra Takibi Listesi`), 14, 15)
      doc.setFontSize(10)
      doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy')}`, 14, 22)

      // Kapalı dosyaları rapordan çıkar
      const reportData = filtered.filter(k => k.durum !== 'kapali')

      const head = [['Sirket', 'Borclu', 'Icra Dairesi', 'Dosya No', 'Tebligat', 'Borc', 'Odenen', 'Kalan', 'Durum']]
      const body = reportData.map(k => [
        cleanTr((k as any).sirket || 'ETM'),
        cleanTr(k.borclu_adi),
        cleanTr(k.icra_dairesi_adi),
        cleanTr(k.dosya_no),
        k.tebligat_tarihi ? format(new Date(k.tebligat_tarihi + 'T00:00:00'), 'dd.MM.yyyy') : '',
        cleanTr(TL(k.borc_tutari)),
        cleanTr(TL(odemeToplamı(k.id))),
        cleanTr(TL(kalanBorc(k))),
        cleanTr(DURUM_LABEL[k.durum])
      ])

      autoTable(doc, {
        startY: 28,
        head,
        body,
        theme: 'grid',
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [30, 58, 95] },
      })

      doc.save(`Icra_Takibi_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e: any) {
      alert('PDF dışa aktarılırken hata oluştu: ' + e.message)
    }
  }

  // ─── Excel Export ──────────────────────────────────────────────────────────
  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    const sc = (v: any, t: string, s: any = {}) => ({ v, t, s })
    const border = { top: { style: 'thin', color: { rgb: '1e293b' } }, bottom: { style: 'thin', color: { rgb: '1e293b' } }, left: { style: 'thin', color: { rgb: '1e293b' } }, right: { style: 'thin', color: { rgb: '1e293b' } } }
    const hdr  = (v: string) => sc(v, 's', { font: { bold: true, sz: 15, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1e3a5f' } }, alignment: { horizontal: 'center' }, border })
    const col  = (v: string) => sc(v, 's', { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '334155' } }, alignment: { horizontal: 'center' }, border })
    const cell = (v: string, a: 'left'|'center'|'right' = 'left') => sc(v, 's', { font: { sz: 10, color: { rgb: '1e293b' } }, fill: { fgColor: { rgb: 'f8fafc' } }, alignment: { horizontal: a }, border })
    const mon  = (v: number, r = false) => sc(v, 'n', { font: { bold: true, sz: 10, color: { rgb: r ? 'dc2626' : '166534' } }, fill: { fgColor: { rgb: 'f8fafc' } }, numFmt: '#,##0.00 "₺"', alignment: { horizontal: 'right' }, border })
    const sta  = (d: IcraDurum) => sc(DURUM_LABEL[d], 's', { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: d === 'aktif' ? 'b45309' : d === 'odendi' ? '166534' : '475569' } }, alignment: { horizontal: 'center' }, border })
    const emp  = () => sc('', 's', { fill: { fgColor: { rgb: 'f8fafc' } }, border })
    const tl   = (v: string) => sc(v, 's', { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1e3a5f' } }, alignment: { horizontal: 'right' }, border })
    const tm   = (v: number, r = false) => sc(v, 'n', { font: { bold: true, sz: 11, color: { rgb: r ? 'dc2626' : 'FFFFFF' } }, fill: { fgColor: { rgb: '1e3a5f' } }, numFmt: '#,##0.00 "₺"', alignment: { horizontal: 'right' }, border })

    const cols = ['Şirket', 'Borçlu', 'TC No', 'İcra Dairesi', 'Dosya No', 'Tebligat', 'Cevap', 'KEP No', 'Barkod No', 'Alacaklı', 'Borç', 'Ödenen', 'Kalan', 'IBAN', 'İşçi Durumu', 'Durum']
    const tf = (t?: string | null) => t ? format(new Date(t + 'T00:00:00'), 'dd.MM.yyyy') : ''

    // Kapalı dosyaları rapordan çıkar
    const reportData = filtered.filter(k => k.durum !== 'kapali')

    const rows = reportData.map(k => {
      return [
        cell((k as any).sirket || 'ETM', 'center'),
        cell(k.borclu_adi), cell(k.tc_no || '', 'center'),
        cell(k.icra_dairesi_adi), cell(k.dosya_no, 'center'),
        cell(tf(k.tebligat_tarihi), 'center'), cell(tf(k.cevap_tarihi), 'center'),
        cell(k.kep_no || ''), cell(k.barkod_no || ''), cell(k.alacakli_adi),
        mon(k.borc_tutari), mon(odemeToplamı(k.id)), mon(kalanBorc(k), kalanBorc(k) > 0),
        cell(k.icra_dairesi_iban || ''),
        cell(k.isci_durumu === 'calisiyor' ? 'Çalışıyor' : 'Ayrıldı', 'center'),
        sta(k.durum),
      ]
    })

    const tb = reportData.reduce((s, k) => s + k.borc_tutari, 0)
    const to = reportData.reduce((s, k) => s + odemeToplamı(k.id), 0)
    const tk = reportData.reduce((s, k) => s + kalanBorc(k), 0)

    const ws = XLSX.utils.aoa_to_sheet([
      [hdr(`${firma.ad} — İcra Takibi`), ...Array(cols.length - 1).fill(emp())],
      Array(cols.length).fill(emp()),
      cols.map(col),
      ...rows,
      Array(cols.length).fill(emp()),
      [...Array(9).fill(emp()), tl('TOPLAM:'), tm(tb), tm(to), tm(tk, tk > 0), ...Array(3).fill(emp())],
    ])
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }]
    ws['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 13 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 24 }, { wch: 12 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'İcra Takibi')
    XLSX.writeFile(wb, `Icra_Takibi_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ─── Filtre ────────────────────────────────────────────────────────────────
  const filtered = kayitlar.filter(k => {
    if (durumFilter !== 'hepsi' && k.durum !== durumFilter) return false
    if (isciFilter !== 'hepsi' && k.isci_durumu !== isciFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!k.borclu_adi.toLowerCase().includes(q) && !k.dosya_no.toLowerCase().includes(q) &&
          !k.icra_dairesi_adi.toLowerCase().includes(q) && !(k.tc_no || '').includes(q)) return false
    }
    return true
  })

  // Özet sadece ÇALIŞAN personel
  const calisanlar = kayitlar.filter(k => k.isci_durumu === 'calisiyor')
  const ozet = {
    borc:   calisanlar.reduce((s, k) => s + k.borc_tutari, 0),
    odenen: calisanlar.reduce((s, k) => s + odemeToplamı(k.id), 0),
    kalan:  calisanlar.reduce((s, k) => s + kalanBorc(k), 0),
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) return <Loading />
  if (err)     return <ErrorMsg message={err} onRetry={load} />

  const iSeg = (val: string, active: boolean, danger?: boolean) =>
    `px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${active
      ? danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700 shadow-sm'
      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`

  return (
    <div className="space-y-4">

      {/* ── Başlık ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-800 tracking-tight">İcra Takibi</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Personel icra takip ve tebligat yönetimi</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={requestNotifPermission}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 transition-all hover:bg-slate-50">
            <BellRing size={14} /> Bildirim İzni
          </button>
          <button onClick={exportExcel} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-40">
            <FileDown size={14} /> Excel
          </button>
        <button onClick={exportPdf} disabled={filtered.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-red-600 transition-all hover:bg-red-50 disabled:opacity-40">
          <FileText size={14} /> PDF
        </button>
          <button onClick={openNew}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20">
            <Plus size={14} /> Yeni Kayıt
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={uploadGenericFile} />

      {/* ── Özet Kartları ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Toplam Borç', sub: 'Çalışan personel', value: TL(ozet.borc), valueClass: 'text-slate-800' },
          { label: 'Ödenen', sub: 'Toplam tahsilat', value: TL(ozet.odenen), valueClass: 'text-emerald-600' },
          { label: 'Kalan', sub: 'Tahsil edilecek', value: TL(ozet.kalan), valueClass: ozet.kalan > 0 ? 'text-red-600' : 'text-emerald-600' },
        ].map(c => (
          <div key={c.label}
            className="rounded-2xl border border-blue-100 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{c.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
            <p className={`text-xl font-semibold mt-2 tabular-nums ${c.valueClass}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filtre Çubuğu ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 flex flex-wrap gap-3 items-center shadow-sm">
        {/* Arama */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:bg-white transition-all"
            placeholder="Borçlu, dosya no, icra dairesi…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Durum segmenti */}
        <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 border border-slate-200 p-1">
          {([['hepsi', 'Tümü'], ['aktif', 'Aktif'], ['odendi', 'Ödendi'], ['kapali', 'Kapalı']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setDurumFilter(val as any)} className={iSeg(val, durumFilter === val)}>{lbl}</button>
          ))}
        </div>

        {/* Personel segmenti */}
        <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 border border-slate-200 p-1">
          {([['hepsi', 'Tümü'], ['calisiyor', 'Çalışıyor'], ['ayrildi', 'Ayrıldı']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setIsciFilter(val as any)}
              className={iSeg(val, isciFilter === val, val === 'ayrildi' && isciFilter === 'ayrildi')}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* ── Liste ──────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-blue-100 bg-white py-20 flex flex-col items-center gap-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <AlertCircle size={24} className="text-slate-400" />
          </div>
          <p className="text-[15px] font-medium text-slate-700">Kayıt bulunamadı</p>
          <p className="text-[13px] text-slate-500">Filtreleri değiştirin veya yeni kayıt ekleyin.</p>
          <button onClick={openNew}
            className="mt-1 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20">
            <Plus size={14} /> Yeni Kayıt
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-sm">
          {filtered.map((k, idx) => {
            const toplam  = odemeToplamı(k.id)
            const kalan   = kalanBorc(k)
            const isExp   = expanded === k.id
            const tf = (t?: string | null) => t ? format(new Date(t + 'T00:00:00'), 'dd.MM.yyyy') : '—'

            return (
              <div key={k.id}>
                {idx > 0 && <div className="h-px bg-slate-100 mx-4" />}

                {/* ─ Satır ─────────────────────────────────────────────── */}
                <div className={`px-4 py-3.5 flex items-center gap-4 transition-colors ${isExp ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>

                  {/* Sol: Borçlu */}
                  <div className="flex-1 min-w-0 max-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-slate-800 truncate">{k.borclu_adi}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${ISCI_STYLE[k.isci_durumu ?? 'calisiyor']}`}>
                        {k.isci_durumu === 'ayrildi' ? 'Ayrıldı' : 'Çalışıyor'}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${DURUM_STYLE[k.durum]}`}>
                        {DURUM_LABEL[k.durum]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {k.tc_no && <span className="text-[12px] text-slate-400 font-mono">{k.tc_no}</span>}
                    </div>
                  </div>

                  {/* Orta: Daire / Dosya / Tarih */}
                  <div className="hidden sm:block w-[220px] shrink-0">
                    <p className="text-[13px] text-slate-700 truncate">{k.icra_dairesi_adi}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{k.dosya_no}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Teb: {tf(k.tebligat_tarihi)}{k.cevap_tarihi ? ` · Cvp: ${tf(k.cevap_tarihi)}` : ''}
                    </p>
                  </div>

                  {/* Sağ: Tutarlar */}
                  <div className="text-right min-w-[110px] hidden md:block">
                    <p className="text-[13px] font-semibold text-slate-800 tabular-nums">{TL(k.borc_tutari)}</p>
                    <p className="text-[11px] text-emerald-600 tabular-nums">↓ {TL(toplam)}</p>
                    <p className={`text-[11px] font-bold tabular-nums ${kalan > 0 ? 'text-red-600' : 'text-emerald-600'}`}>= {TL(kalan)}</p>
                  </div>

                  {/* Evrak linkleri */}
                  <div className="flex items-center gap-1.5">
                    {k.tebligat_dosya_url
                      ? <a href={k.tebligat_dosya_url} target="_blank" rel="noreferrer"
                          title={k.tebligat_dosya_adi || 'Tebligat'}
                          className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition">
                          <FileIcon size={12} />
                        </a>
                      : <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                          <FileIcon size={12} className="text-slate-400" />
                        </div>
                    }
                    {k.cevap_dosya_url
                      ? <a href={k.cevap_dosya_url} target="_blank" rel="noreferrer"
                          title={k.cevap_dosya_adi || 'Cevap'}
                          className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition">
                          <FileText size={12} />
                        </a>
                      : <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                          <FileText size={12} className="text-slate-400" />
                        </div>
                    }
                  </div>

                  {/* Aksiyon butonları */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => setExpanded(isExp ? null : k.id)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all gap-0.5 ${isExp ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                      title="Ödemeler">
                      <CreditCard size={13} />
                      {isExp ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    <button onClick={() => setReminderModal({ id: k.id, tarih: k.hatirlatici_tarihi || today(), saat: k.hatirlatici_saati || '', hasExisting: Boolean(k.hatirlatici_tarihi || k.hatirlatici_saati) })}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${k.hatirlatici_tarihi || k.hatirlatici_saati ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                      title="Hatırlatma">
                      <BellRing size={13} />
                    </button>
                    <button onClick={() => openCevapModal(k)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      title="Cevap Yazısı">
                      <FileText size={13} />
                    </button>
                    <button onClick={() => openEdit(k)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      title="Düzenle">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteId(k.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Sil">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* ─ Ödeme Genişleme Alanı ─────────────────────────────── */}
                {isExp && (
                  <div className="mx-4 mb-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Ödemeler */}
                    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <CreditCard size={12} /> Ödeme Geçmişi
                        </p>
                        <button onClick={() => openOdemeModal(k)}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-500 transition">
                          <Plus size={12} /> Ödeme Ekle
                        </button>
                      </div>
                      <div className="flex-1">
                        {!(odemeler[k.id]?.length) ? (
                          <p className="text-[13px] text-slate-400 text-center py-4">Henüz ödeme kaydı yok.</p>
                        ) : (
                          <div>
                            {odemeler[k.id].map((o, oi) => (
                              <div key={o.id} className={`flex items-center gap-3 px-4 py-3 ${oi > 0 ? 'border-t border-slate-100' : ''}`}>
                                <span className="text-[13px] text-slate-500 tabular-nums w-[80px] shrink-0">
                                  {format(new Date(o.odeme_tarihi + 'T00:00:00'), 'dd.MM.yyyy')}
                                </span>
                                <span className="text-[13px] font-semibold text-emerald-600 tabular-nums w-[90px] shrink-0 text-right">{TL(o.tutar)}</span>
                                <span className="text-[13px] text-slate-500 flex-1 truncate">{o.aciklama || '—'}</span>
                                <button onClick={() => setOdemeDeleteId({ icraId: k.id, odemeId: o.id })}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 transition shrink-0">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                            <div className="border-t border-blue-100 flex items-center gap-3 px-4 py-2.5 bg-slate-50">
                              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider w-[80px] shrink-0">Toplam</span>
                              <span className="text-[13px] font-semibold text-emerald-600 tabular-nums w-[90px] shrink-0 text-right">{TL(toplam)}</span>
                              <span className="text-[11px] font-medium text-slate-400 flex-1 text-right">Kalan:</span>
                              <span className={`text-[13px] font-semibold tabular-nums w-[90px] text-right ${kalan > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{TL(kalan)}</span>
                              <div className="w-7 shrink-0" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ek Evraklar */}
                    <div className="rounded-xl border border-blue-100 bg-white overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <FileIcon size={12} /> Ek Evraklar
                        </p>
                        <button onClick={() => setEvrakModal({ icraId: k.id, kategori: 'ust_yazi' })}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 text-[12px] font-medium hover:bg-emerald-100 transition">
                          <Upload size={12} /> Evrak Ekle
                        </button>
                      </div>
                      <div className="p-4 flex-1">
                        {!(dosyaMap[k.id]?.length) ? (
                          <p className="text-[13px] text-slate-400 text-center py-4">Ek evrak bulunmuyor.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {dosyaMap[k.id].map(d => {
                              const katLabel: Record<string, { label: string; cls: string }> = {
                                ust_yazi:    { label: 'Üst Yazı',    cls: 'bg-blue-50 text-blue-700' },
                                tebligat_ek: { label: 'Tebligat Ek', cls: 'bg-amber-50 text-amber-700' },
                                cevap_ek:    { label: 'Cevap Ek',    cls: 'bg-emerald-50 text-emerald-700' },
                                diger:       { label: 'Diğer',       cls: 'bg-slate-100 text-slate-600' },
                              }
                              const kat = katLabel[d.kategori] || katLabel['diger']
                              return (
                                <div key={d.id} className="flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-2.5 py-2 hover:bg-slate-50 transition">
                                  <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${kat.cls}`}>{kat.label}</span>
                                  <a href={d.dosya_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <FileIcon size={12} className={fileExt(d.dosya_adi).color} />
                                    <span className="text-[12px] text-slate-600 truncate">{d.dosya_adi}</span>
                                  </a>
                                  <button onClick={() => deleteExtraDoc(d)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition shrink-0" title="Sil">
                                    <X size={11}/>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal: Kayıt Ekle / Düzenle ──────────────────────────────────────── */}
      {modal && (
        <Modal title={modal.id ? 'İcra Kaydını Düzenle' : 'Yeni İcra Kaydı'} onClose={() => setModal(null)} size="xl"
          footer={
            <>
              <button onClick={() => { setModal(null); setModalErr(''); }} className={cls.btnSecondary}>İptal</button>
              <button onClick={save} disabled={saving} className={cls.btnPrimary}>
                {uploading ? 'Dosya yükleniyor...' : saving ? 'Kaydediliyor...' : modal.id ? 'Güncelle' : 'Kaydet'}
              </button>
            </>
          }
        >
          <div className="space-y-5">
            {modalErr && <ErrorMsg message={modalErr} onRetry={() => setModalErr('')} />}

            {!modal.id && firmalar.length > 1 && (
              <Field label="Firma">
                <select className={cls.input} value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                  {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
                </select>
              </Field>
            )}

            <Field label="Personel Durumu" required>
              <div className="flex gap-2">
                {([['calisiyor', 'Çalışmaya Devam Ediyor'], ['ayrildi', 'İşten Ayrıldı']] as [IcraIsciDurumu, string][]).map(([val, lbl]) => (
                  <button key={val} type="button"
                    onClick={() => setF({ isci_durumu: val, cikis_tarihi: val === 'calisiyor' ? null : modal.form.cikis_tarihi })}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-medium border transition-all ${
                      modal.form.isci_durumu === val
                        ? val === 'calisiyor' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>{lbl}</button>
                ))}
              </div>
            </Field>

            {modal.form.isci_durumu === 'ayrildi' && (
              <Field label="İşten Çıkış Tarihi">
                <input type="date" className={cls.input} value={modal.form.cikis_tarihi || ''}
                  onChange={e => setF({ cikis_tarihi: e.target.value || null })} />
              </Field>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Borçlu Adı" required>
                <input className={cls.input} value={modal.form.borclu_adi}
                  onChange={e => setF({ borclu_adi: e.target.value })} placeholder="Ad Soyad" />
              </Field>
              <Field label="TC Kimlik No">
                <input className={cls.input} value={modal.form.tc_no || ''}
                  onChange={e => setF({ tc_no: e.target.value })} placeholder="00000000000" maxLength={11} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="İcra Dairesi Adı" required>
                <input className={cls.input} value={modal.form.icra_dairesi_adi}
                  onChange={e => setF({ icra_dairesi_adi: e.target.value })} placeholder="X. İcra Müdürlüğü" />
              </Field>
              <Field label="Dosya Numarası" required>
                <input className={cls.input} value={modal.form.dosya_no}
                  onChange={e => setF({ dosya_no: e.target.value })} placeholder="2024/1234 E." />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tebligat Tarihi" required>
                <input type="date" className={cls.input} value={modal.form.tebligat_tarihi}
                  onChange={e => setF({ tebligat_tarihi: e.target.value })} />
              </Field>
              <Field label="Cevap Tarihi">
                <input type="date" className={cls.input} value={modal.form.cevap_tarihi || ''}
                  onChange={e => setF({ cevap_tarihi: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Alacaklı Adı" required>
                <input className={cls.input} value={modal.form.alacakli_adi}
                  onChange={e => setF({ alacakli_adi: e.target.value })} placeholder="Alacaklı kişi veya kurum" />
              </Field>
              <Field label="Borç Tutarı (₺)" required>
                <input type="number" className={cls.input} value={modal.form.borc_tutari || ''}
                  onChange={e => setF({ borc_tutari: Number(e.target.value) })} placeholder="0.00" min={0} step="0.01" />
              </Field>
            </div>

            <Field label="İcra Dairesi IBAN">
              <input className={cls.input} value={modal.form.icra_dairesi_iban || ''}
                onChange={e => setF({ icra_dairesi_iban: e.target.value })} placeholder="TR00 0000 0000 0000 0000 0000 00" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="KEP Numarası" hint="Kayıtlı Elektronik Posta numarası">
                <input className={cls.input} value={modal.form.kep_no || ''}
                  onChange={e => setF({ kep_no: e.target.value })} placeholder="ornek@hs01.kep.tr" />
              </Field>
              <Field label="Barkod / Giriş Numarası">
                <input className={cls.input} value={modal.form.barkod_no || ''}
                  onChange={e => setF({ barkod_no: e.target.value })} placeholder="Üst yazı barkod veya giriş no" />
              </Field>
            </div>

            <Field label="Durum">
              <select className={cls.input} value={modal.form.durum}
                onChange={e => setF({ durum: e.target.value as IcraDurum })}>
                {(Object.keys(DURUM_LABEL) as IcraDurum[]).map(d => <option key={d} value={d}>{DURUM_LABEL[d]}</option>)}
              </select>
            </Field>

            <Field label="Notlar">
              <textarea className={cls.input + ' resize-none'} rows={2} value={modal.form.notlar || ''}
                onChange={e => setF({ notlar: e.target.value })} placeholder="Ek açıklamalar..." />
            </Field>

            {/* Evrak */}
            <div className="rounded-xl border border-blue-100 bg-slate-50 p-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Evrak Ekleme</p>
                <p className="text-[11px] text-slate-400 mt-0.5">.doc · .docx · .xls · .xlsx · .pdf</p>
              </div>

              {(['tebligat', 'cevap'] as const).map(tip => {
                const isPending = tip === 'tebligat' ? pendingTebligat : pendingCevap
                const savedAdi  = tip === 'tebligat' ? modal.form.tebligat_dosya_adi : modal.form.cevap_dosya_adi
                const savedUrl  = tip === 'tebligat' ? modal.form.tebligat_dosya_url : modal.form.cevap_dosya_url
                const ref       = tip === 'tebligat' ? tebligatRef : cevapRef
                const label     = tip === 'tebligat' ? 'Tebligat Evrakı' : 'Cevap Evrakı'
                const accentCls = tip === 'tebligat' ? 'border-blue-300 text-blue-600 hover:bg-blue-50' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'

                return (
                  <div key={tip} className="space-y-2">
                    <p className="text-[12px] font-medium text-slate-600">{label}</p>
                    {(isPending || savedAdi) ? (
                      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2.5">
                        <FileIcon size={14} className={fileExt(isPending?.name || savedAdi || '').color} />
                        <span className="text-[13px] text-slate-700 flex-1 truncate">{isPending?.name || savedAdi}</span>
                        {savedUrl && !isPending && (
                          <a href={savedUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-500 transition"><Download size={13} /></a>
                        )}
                        <button type="button" onClick={() => {
                          if (isPending) {
                            tip === 'tebligat' ? setPendingTebligat(null) : setPendingCevap(null)
                            if (ref.current) ref.current.value = ''
                          } else if (modal.id) {
                            removeDocFromRecord(modal.id, tip).then(() =>
                              tip === 'tebligat'
                                ? setF({ tebligat_dosya_url: null, tebligat_dosya_adi: null })
                                : setF({ cevap_dosya_url: null, cevap_dosya_adi: null })
                            )
                          } else {
                            tip === 'tebligat'
                              ? setF({ tebligat_dosya_url: null, tebligat_dosya_adi: null })
                              : setF({ cevap_dosya_url: null, cevap_dosya_adi: null })
                          }
                        }} className="text-slate-400 hover:text-red-600 transition"><X size={13} /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => ref.current?.click()}
                        className={`w-full flex items-center justify-center gap-2 border border-dashed rounded-xl py-3 text-[13px] transition-all bg-white ${accentCls}`}>
                        <Upload size={13} /> {label} Yükle
                      </button>
                    )}
                    <input ref={ref} type="file" accept={ACCEPT} className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) tip === 'tebligat' ? setPendingTebligat(f) : setPendingCevap(f) }} />
                  </div>
                )
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Ödeme Ekle ──────────────────────────────────────────────── */}
      {odemeModal && (
        <Modal title="Ödeme Ekle" onClose={() => setOdemeModal(null)} size="sm"
          footer={
            <>
              <button onClick={() => setOdemeModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={saveOdeme} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </>
          }>
          <div className="space-y-4">
            <Field label="Ödeme Tarihi" required>
              <input type="date" className={cls.input} value={odemeModal.form.odeme_tarihi}
                onChange={e => setOdemeModal(m => m ? { ...m, form: { ...m.form, odeme_tarihi: e.target.value } } : m)} />
            </Field>
            <Field label="Tutar (₺)" required>
              <input type="number" className={cls.input} value={odemeModal.form.tutar || ''}
                onChange={e => setOdemeModal(m => m ? { ...m, form: { ...m.form, tutar: Number(e.target.value) } } : m)} placeholder="0.00" min={0} step="0.01" />
            </Field>
            <Field label="Açıklama">
              <input className={cls.input} value={odemeModal.form.aciklama || ''}
                onChange={e => setOdemeModal(m => m ? { ...m, form: { ...m.form, aciklama: e.target.value } } : m)} placeholder="Ödeme açıklaması" />
            </Field>
          </div>
        </Modal>
      )}

      {/* ── Modal: Cevap Yazısı ────────────────────────────────────────────── */}
      {cevapModal && (
        <Modal title="Cevap Yazısı Oluştur" onClose={() => setCevapModal(null)} size="lg"
          footer={
            <>
              <button onClick={() => setCevapModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={generateCevapYazisi} disabled={isGeneratingCevap} className={cls.btnPrimary}>
                {isGeneratingCevap ? 'Oluşturuluyor...' : <><FileText size={14} /> Word İndir & Kaydet</>}
              </button>
            </>
          }>
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-100 bg-slate-50 p-4 space-y-1.5 text-[13px]">
              <p><span className="text-slate-400">Dosya No</span> <span className="text-slate-800 font-medium ml-2">{cevapModal.kayit.dosya_no}</span></p>
              <p><span className="text-slate-400">Borçlu</span> <span className="text-slate-800 font-medium ml-2">{cevapModal.kayit.borclu_adi}</span></p>
              <p><span className="text-slate-400">Borç Tutarı</span> <span className="text-slate-800 font-medium ml-2">{TL(cevapModal.kayit.borc_tutari)}</span></p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cevap Veren">
                <input className={cls.input} value={cevapModal.form.cevap_veren}
                  onChange={e => setCevapModal(c => c ? { ...c, form: { ...c.form, cevap_veren: e.target.value } } : c)}
                  placeholder="Cevap veren kişi adı" />
              </Field>
              <Field label="İşveren">
                <input className={cls.input} value={cevapModal.form.isveren}
                  onChange={e => setCevapModal(c => c ? { ...c, form: { ...c.form, isveren: e.target.value } } : c)}
                  placeholder={firma.ad} />
              </Field>
            </div>

            <Field label="İşçinin Durumu">
              <div className="flex gap-2">
                {([['devam', 'Çalışmaya Devam Ediyor'], ['cikti', 'İşten Ayrıldı']] as const).map(([val, lbl]) => (
                  <button key={val} type="button"
                    onClick={() => setCevapModal(m => m ? { ...m, form: { ...m.form, isci_durumu: val } } : m)}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium border transition-all ${
                      cevapModal.form.isci_durumu === val
                        ? val === 'devam' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>{lbl}</button>
                ))}
              </div>
            </Field>

            {cevapModal.form.isci_durumu === 'cikti' && (
              <Field label="İşten Çıkış Tarihi">
                <input type="date" className={cls.input} value={cevapModal.form.cikis_tarihi}
                  onChange={e => setCevapModal(m => m ? { ...m, form: { ...m.form, cikis_tarihi: e.target.value } } : m)} />
              </Field>
            )}
            {cevapModal.form.isci_durumu === 'devam' && (
              <Field label="Aylık Net Ücret (₺)" hint="1/4'ü otomatik hesaplanır">
                <input type="number" className={cls.input} value={cevapModal.form.maas_tutari}
                  onChange={e => setCevapModal(m => m ? { ...m, form: { ...m.form, maas_tutari: e.target.value } } : m)} placeholder="0.00" min={0} step="0.01" />
                {parseFloat(cevapModal.form.maas_tutari) > 0 && (
                  <p className="text-[12px] text-emerald-600 mt-1 font-medium">
                    Kesilecek (1/4): {(parseFloat(cevapModal.form.maas_tutari) / 4).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </p>
                )}
              </Field>
            )}
            <Field label="Ek Açıklamalar">
              <textarea className={cls.input + ' resize-none'} rows={2} value={cevapModal.form.aciklamalar}
                onChange={e => setCevapModal(m => m ? { ...m, form: { ...m.form, aciklamalar: e.target.value } } : m)} placeholder="Ek bilgi..." />
            </Field>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmModal title="İcra Kaydını Sil"
          message="Bu icra kaydını, tüm ödeme geçmişini ve yüklü evrakları silmek istediğinize emin misiniz?"
          onConfirm={deleteKayit} onCancel={() => setDeleteId(null)} danger />
      )}
      {odemeDeleteId && (
        <ConfirmModal title="Ödemeyi Sil" message="Bu ödeme kaydını silmek istediğinize emin misiniz?"
          onConfirm={deleteOdeme} onCancel={() => setOdemeDeleteId(null)} danger />
      )}

      {/* ── Modal: Hatırlatma ──────────────────────────────────────────────── */}
      {reminderModal && (
        <Modal title="Hatırlatma Ayarla" onClose={() => setReminderModal(null)} size="sm"
          footer={
            <>
              <button onClick={() => setReminderModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={saveReminder} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </>
          }>
          <div className="space-y-4">
            <Field label="Tarih" required>
              <input type="date" className={cls.input} value={reminderModal.tarih}
                onChange={e => setReminderModal(m => m ? { ...m, tarih: e.target.value } : m)} />
            </Field>
            <Field label="Saat" required>
              <input type="time" className={cls.input} value={reminderModal.saat}
                onChange={e => setReminderModal(m => m ? { ...m, saat: e.target.value } : m)} />
            </Field>
            {reminderModal.hasExisting && (
              <button onClick={() => clearReminder(reminderModal.id)} className="w-full mt-2 py-2 text-[13px] font-bold text-red-600 border border-dashed border-red-300 hover:bg-red-50 rounded-xl transition">
                Mevcut Hatırlatmayı Temizle
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal: Evrak Yükle ─────────────────────────────────────────────── */}
      {evrakModal && (
        <Modal title="Evrak Yükle" onClose={() => setEvrakModal(null)} size="sm"
          footer={
            <>
              <button onClick={() => setEvrakModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={() => fileRef.current?.click()} disabled={saving} className={cls.btnPrimary}>
                {saving ? 'Yükleniyor...' : <><Upload size={14} /> Dosya Seç</>}
              </button>
            </>
          }>
          <div className="space-y-4">
            <Field label="Evrak Türü" required>
              <select className={cls.input} value={evrakModal.kategori}
                onChange={e => setEvrakModal(m => m ? { ...m, kategori: e.target.value } : m)}>
                <option value="ust_yazi">Üst Yazı</option>
                <option value="tebligat_ek">Tebligat Eki</option>
                <option value="cevap_ek">Cevap Eki</option>
                <option value="diger">Diğer</option>
              </select>
            </Field>
            <p className="text-[12px] text-slate-400">Türü seçtikten sonra "Dosya Seç" butonuna tıklayın.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
