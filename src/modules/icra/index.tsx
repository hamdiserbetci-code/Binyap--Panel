'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Pencil, FileDown, Search, CreditCard,
  ChevronDown, ChevronUp, AlertCircle, FileText,
  Upload, X, Download, FileIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'
import type { IcraTakibi, IcraOdeme, Musteri, IcraDurum, IcraIsciDurumu } from '@/types'
import { format } from 'date-fns'
// ─── Yardımcı ────────────────────────────────────────────────────────────────
const cls = {
  btnPrimary: "flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-500 disabled:opacity-40",
  btnSecondary: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-40",
  btnGhost: "flex items-center justify-center text-slate-400 hover:bg-white/10 p-1.5 rounded-xl transition-all",
  card: "rounded-3xl border border-white/10 bg-slate-900/50 shadow-2xl backdrop-blur-xl",
  input: "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 transition-all font-medium",
  th: "px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider",
  td: "px-4 py-4",
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

const Field = ({ label, children, hint, required }: { label: string, children: React.ReactNode, hint?: string, required?: boolean }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{label}{required && <span className="text-red-400">*</span>}</label>
    {children}
    {hint && <p className="text-xs text-slate-500 mt-1.5 ml-1">{hint}</p>}
  </div>
)

const Loading = () => <div className="p-8 text-center text-white">Yükleniyor...</div>
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

const ACCEPT = '.doc,.docx,.xls,.xlsx,.pdf'

type IcraForm = Omit<IcraTakibi, 'id' | 'firma_id' | 'created_at' | 'updated_at' | 'musteri'>
type OdemeForm = Omit<IcraOdeme, 'id' | 'icra_id' | 'firma_id' | 'created_at'>
type CevapForm = {
  cevap_veren_id: string   // musteri seçilirse ID, yoksa boş
  cevap_veren: string      // manuel giriş
  isveren_id: string
  isveren: string
  isci_durumu: 'devam' | 'cikti'
  cikis_tarihi: string
  maas_tutari: string
  aciklamalar: string
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
export default function IcraModule({ firma }: AppCtx) {
  const [kayitlar, setKayitlar]   = useState<IcraTakibi[]>([])
  const [odemeler, setOdemeler]   = useState<Record<string, IcraOdeme[]>>({})
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState('')
  const [saving, setSaving]       = useState(false)

  // Modal — kayıt
  const [modal, setModal]         = useState<{ id?: string; form: IcraForm } | null>(null)
  const [modalErr, setModalErr]   = useState('')
  const [deleteId, setDeleteId]   = useState<string | null>(null)

  // Dosya yükleme bekleyenleri (yeni kayıt için)
  const [pendingTebligat, setPendingTebligat] = useState<File | null>(null)
  const [pendingCevap, setPendingCevap]       = useState<File | null>(null)
  const [uploading, setUploading]             = useState(false)
  const tebligatRef = useRef<HTMLInputElement>(null)
  const cevapRef    = useRef<HTMLInputElement>(null)

  // Modal — ödeme
  const [odemeModal, setOdemeModal] = useState<{ icraId: string; form: OdemeForm } | null>(null)
  const [odemeDeleteId, setOdemeDeleteId] = useState<{ icraId: string; odemeId: string } | null>(null)

  // Modal — cevap yazısı
  const [cevapModal, setCevapModal] = useState<{ kayit: IcraTakibi; form: CevapForm } | null>(null)
  const [isGeneratingCevap, setIsGeneratingCevap] = useState(false)

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
      const [icraRes, musteriRes] = await Promise.all([
        supabase.from('icra_takibi')
          .select('*, musteri:musteriler(id, ad, kisa_ad)')
          .eq('firma_id', firma.id)
          .order('tebligat_tarihi', { ascending: false }),
        supabase.from('musteriler')
          .select('id, ad, kisa_ad').eq('firma_id', firma.id).eq('aktif', true).order('ad'),
      ])
      if (icraRes.error) throw icraRes.error
      setKayitlar((icraRes.data || []) as IcraTakibi[])
      setMusteriler((musteriRes.data || []) as Musteri[])

      const ids = (icraRes.data || []).map((x: any) => x.id)
      if (ids.length) {
        const { data: od } = await supabase.from('icra_odemeler')
          .select('*').in('icra_id', ids).order('odeme_tarihi', { ascending: false })
        if (od) {
          const map: Record<string, IcraOdeme[]> = {}
          od.forEach((o: IcraOdeme) => {
            if (!map[o.icra_id]) map[o.icra_id] = []
            map[o.icra_id].push(o)
          })
          setOdemeler(map)
        }
      }
    } catch (e: any) { setErr(e?.message || 'Veri yüklenemedi') }
    finally { setLoading(false) }
  }, [firma.id])

  useEffect(() => { load() }, [load])

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

    const basePayload = {
      firma_id: firma.id,
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
  function openOdemeModal(icraId: string) {
    setOdemeModal({ icraId, form: { odeme_tarihi: today(), tutar: 0, aciklama: '' } })
  }
  async function saveOdeme() {
    if (!odemeModal) return
    const { icraId, form } = odemeModal
    if (!form.odeme_tarihi || form.tutar <= 0) return
    setSaving(true)
    const { error } = await supabase.from('icra_odemeler').insert({
      icra_id: icraId, firma_id: firma.id,
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

  // ─── Cevap Yazısı (Word) ──────────────────────────────────────────────────
  function openCevapModal(k: IcraTakibi) {
    setCevapModal({
      kayit: k,
      form: {
        cevap_veren_id: '',
        cevap_veren: '',
        isveren_id: k.musteri_id || '',
        isveren: musteriler.find(m => m.id === k.musteri_id)?.ad || firma.ad,
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

    const isverenMusteri = musteriler.find(m => m.id === form.isveren_id)
    const isverenAd = form.isveren
    const isverenKisaAd = isverenMusteri?.kisa_ad || isverenAd

    // Logo: ETM mi yoksa genel mi?
    const isEtm = /etm/i.test(isverenKisaAd || '')
    const logoHtml = isEtm
      ? `<table style="border-collapse:collapse;width:310pt;line-height:1">
           <tr>
             <td style="width:6pt;background:#C8922A;padding:0;font-size:1pt">&nbsp;</td>
             <td style="background:#0B1C38;padding:10pt 20pt 10pt 16pt;vertical-align:middle">
               <p style="margin:0;font-family:'Arial Black',Arial,sans-serif;font-size:28pt;font-weight:900;color:#FFFFFF;letter-spacing:7pt;line-height:1">ETM</p>
               <p style="margin:3pt 0 0 0;font-family:Arial,sans-serif;font-size:6.5pt;font-weight:bold;color:#C8922A;letter-spacing:2.5pt;line-height:1">MALİ MÜŞAVİRLİK &amp; DANIŞMANLIK HİZMETLERİ</p>
             </td>
             <td style="background:#0B1C38;width:12pt;padding:0;vertical-align:middle;text-align:center">
               <table style="border-collapse:collapse;width:100%;height:100%"><tr>
                 <td style="background:#C8922A;width:4pt;padding:0;font-size:1pt">&nbsp;</td>
                 <td style="background:#152C50;padding:0;font-size:1pt">&nbsp;</td>
               </tr></table>
             </td>
           </tr>
           <tr>
             <td colspan="3" style="background:linear-gradient(90deg,#C8922A,#E8B84B);padding:0;height:3pt;font-size:1pt;line-height:0;background:#C8922A">&nbsp;</td>
           </tr>
         </table>
         <p style="margin:4pt 0 0 7pt;font-size:8pt;color:#444444;font-family:Arial,sans-serif;font-style:italic;letter-spacing:0.3pt">${isverenAd}</p>`
      : `<table style="border-collapse:collapse;width:310pt;line-height:1">
           <tr>
             <td style="width:6pt;background:#2E86C1;padding:0;font-size:1pt">&nbsp;</td>
             <td style="background:#1A2E4A;padding:10pt 20pt 10pt 16pt;vertical-align:middle">
               <p style="margin:0;font-family:'Arial Black',Arial,sans-serif;font-size:22pt;font-weight:900;color:#FFFFFF;letter-spacing:3pt;line-height:1">${isverenKisaAd.substring(0, 9).toUpperCase()}</p>
             </td>
             <td style="background:#1A2E4A;width:12pt;padding:0;vertical-align:middle;text-align:center">
               <table style="border-collapse:collapse;width:100%;height:100%"><tr>
                 <td style="background:#2E86C1;width:4pt;padding:0;font-size:1pt">&nbsp;</td>
                 <td style="background:#243B55;padding:0;font-size:1pt">&nbsp;</td>
               </tr></table>
             </td>
           </tr>
           <tr>
             <td colspan="3" style="background:#2E86C1;padding:0;height:3pt;font-size:1pt;line-height:0">&nbsp;</td>
           </tr>
         </table>`

    // İmza: cevap_veren doluysa ve isveren'den farklıysa onu göster, yoksa isveren
    const imzaAdi = (form.cevap_veren && form.cevap_veren !== form.isveren) ? form.cevap_veren : form.isveren
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
         (<strong>${kesinti}</strong>) tutarında kesinti yapılarak <strong>${kayit.dosya_no}</strong> sayılı dosyaya yatırılacaktır.</p>
         ${kayit.icra_dairesi_iban ? `<p style="margin:0 0 8pt 0"><strong>IBAN:</strong> ${kayit.icra_dairesi_iban}</p>` : ''}
         ${form.aciklamalar ? `<p style="margin:0 0 8pt 0"><strong>Açıklama:</strong> ${form.aciklamalar}</p>` : ''}`

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 1.5cm; }
  body { font-family: "Times New Roman", serif; font-size: 10.5pt; color: #000; line-height: 1.4; margin: 0; }
  table.info { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  table.info td { padding: 3pt 6pt; font-size: 10pt; vertical-align: top; }
  table.info td.e { font-weight: bold; width: 28%; background: #f0f0f0; }
  table.info tr:nth-child(even) td { background: #f8f8f8; }
  table.info tr:nth-child(even) td.e { background: #e8e8e8; }
</style></head><body>

<!-- BAŞLIK -->
<table style="width:100%;border-collapse:collapse;margin-bottom:24pt;">
  <tr>
    <td style="width:60%; vertical-align:top;">${logoHtml}</td>
    <td style="width:40%; vertical-align:top; text-align:right; font-size:10.5pt; font-family:'Times New Roman',serif;">
      ${bugun}
    </td>
  </tr>
</table>

<!-- ADRES -->
<p style="margin:0 0 2pt 0"><strong>${kayit.icra_dairesi_adi}</strong></p>
<p style="margin:0 0 10pt 0">SAYIN MÜDÜRLÜĞÜNE</p>
<p style="font-weight:bold;margin:0 0 8pt 0;border-bottom:1px solid #ccc;padding-bottom:3pt">
  KONU: ${kayit.dosya_no} Esas Sayılı Dosyaya Cevabımızdır.
</p>

<!-- BİLGİ TABLOSU — 4 sütun -->
<table class="info">
  <tr>
    <td class="e">İcra Dairesi</td><td>${kayit.icra_dairesi_adi}</td>
    <td class="e">Dosya No</td><td>${kayit.dosya_no}</td>
  </tr>
  <tr>
    <td class="e">Tebligat Tarihi</td><td>${tarihFmt(kayit.tebligat_tarihi)}</td>
    <td class="e">Cevap Tarihi</td><td>${kayit.cevap_tarihi ? tarihFmt(kayit.cevap_tarihi) : bugun}</td>
  </tr>
  <tr>
    <td class="e">Alacaklı</td><td>${kayit.alacakli_adi}</td>
    <td class="e">Borç Miktarı</td><td>${kayit.borc_tutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
  </tr>
  <tr>
    <td class="e">Borçlu</td>
    <td colspan="3">${kayit.borclu_adi}${kayit.tc_no ? ' &mdash; TC: ' + kayit.tc_no : ''}
      &nbsp;&nbsp;<strong>[${form.isci_durumu === 'cikti' ? 'AYRILMIŞ / İŞTEN ÇIKMIŞ' : 'ÇALIŞMAYA DEVAM ETMEKTEDİR'}]</strong>
    </td>
  </tr>
</table>

<!-- YAZI GÖVDESİ -->
${icerik}

<!-- İMZA -->
<table style="width:100%;border-collapse:collapse;margin-top:24pt">
  <tr>
    <td style="width:52%">
      <p style="margin:0;font-size:10pt">Saygılarımızla,</p>
    </td>
    <td style="border-top:1px solid #000;padding-top:4pt;text-align:center;font-size:10pt">
      <strong>${imzaAdi}</strong><br>
      <span style="font-size:9pt">İşveren / Yetkili</span>
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

    const cols = ['Borçlu', 'TC No', 'Müşteri', 'İcra Dairesi', 'Dosya No', 'Tebligat', 'Cevap', 'KEP No', 'Barkod No', 'Alacaklı', 'Borç', 'Ödenen', 'Kalan', 'IBAN', 'İşçi Durumu', 'Durum']
    const tf = (t?: string | null) => t ? format(new Date(t + 'T00:00:00'), 'dd.MM.yyyy') : ''

    const rows = filtered.map(k => {
      const m = musteriler.find(x => x.id === k.musteri_id)
      return [
        cell(k.borclu_adi), cell(k.tc_no || '', 'center'), cell(m?.ad || ''),
        cell(k.icra_dairesi_adi), cell(k.dosya_no, 'center'),
        cell(tf(k.tebligat_tarihi), 'center'), cell(tf(k.cevap_tarihi), 'center'),
        cell(k.kep_no || ''), cell(k.barkod_no || ''), cell(k.alacakli_adi),
        mon(k.borc_tutari), mon(odemeToplamı(k.id)), mon(kalanBorc(k), kalanBorc(k) > 0),
        cell(k.icra_dairesi_iban || ''),
        cell(k.isci_durumu === 'calisiyor' ? 'Çalışıyor' : 'Ayrıldı', 'center'),
        sta(k.durum),
      ]
    })

    const to = filtered.reduce((s, k) => s + odemeToplamı(k.id), 0)
    const tk = filtered.reduce((s, k) => s + kalanBorc(k), 0)

    const ws = XLSX.utils.aoa_to_sheet([
      [hdr(`${firma.ad} — İcra Takibi`), ...Array(cols.length - 1).fill(emp())],
      Array(cols.length).fill(emp()),
      cols.map(col),
      ...rows,
      Array(cols.length).fill(emp()),
      [...Array(10).fill(emp()), tl('TOPLAM:'), tm(to), tm(tk, tk > 0), ...Array(3).fill(emp())],
    ])
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }]
    ws['!cols'] = [{ wch: 20 }, { wch: 13 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 24 }, { wch: 12 }, { wch: 10 }]
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
      const m = musteriler.find(x => x.id === k.musteri_id)
      if (!k.borclu_adi.toLowerCase().includes(q) && !k.dosya_no.toLowerCase().includes(q) &&
          !k.icra_dairesi_adi.toLowerCase().includes(q) && !(k.tc_no || '').includes(q) &&
          !(m?.ad || '').toLowerCase().includes(q)) return false
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

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">İcra Takibi</h1>
          <p className="text-sm text-slate-400 mt-0.5">Personel icra takip ve tebligat yönetimi</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportExcel} className={cls.btnSecondary} disabled={filtered.length === 0}>
            <FileDown size={15} /> Excel
          </button>
          <button onClick={openNew} className={cls.btnPrimary}>
            <Plus size={15} /> Yeni İcra Kaydı
          </button>
        </div>
      </div>

      {/* Özet — sadece çalışan personel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Toplam Borç (Çalışanlar)', value: TL(ozet.borc), color: 'text-white' },
          { label: 'Toplam Ödenen', value: TL(ozet.odenen), color: 'text-emerald-400' },
          { label: 'Kalan Borç', value: TL(ozet.kalan), color: ozet.kalan > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map(c => (
          <div key={c.label} className={cls.card + ' p-5'}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{c.label}</p>
            <p className={`text-2xl font-bold tracking-tight ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div className={cls.card + ' p-4 flex flex-wrap gap-3 items-center'}>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={cls.input + ' pl-8'} placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value as any)} className={cls.input + ' max-w-[150px]'}>
          <option value="hepsi">Tüm Durumlar</option>
          {(Object.keys(DURUM_LABEL) as IcraDurum[]).map(d => <option key={d} value={d}>{DURUM_LABEL[d]}</option>)}
        </select>
        <select value={isciFilter} onChange={e => setIsciFilter(e.target.value as any)} className={cls.input + ' max-w-[150px]'}>
          <option value="hepsi">Tüm Personel</option>
          <option value="calisiyor">Çalışıyor</option>
          <option value="ayrildi">Ayrıldı</option>
        </select>
      </div>

      {/* Tablo */}
      {filtered.length === 0 ? (
        <div className={cls.card}>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[rgba(18,32,54,0.85)] border border-[rgba(162,180,206,0.14)]">
              <AlertCircle size={28} className="text-[rgba(230,236,245,0.36)]" />
            </div>
            <p className="text-sm font-semibold text-[rgba(245,247,251,0.86)]">Kayıt bulunamadı</p>
            <div className="mt-5"><button onClick={openNew} className={cls.btnPrimary}><Plus size={14} /> Yeni Kayıt</button></div>
          </div>
        </div>
      ) : (
        <div className={cls.card + ' overflow-hidden'}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className={cls.th}>Borçlu</th>
                  <th className={cls.th}>İcra Dairesi / Dosya</th>
                  <th className={cls.th + ' text-right'}>Borç / Ödenen / Kalan</th>
                  <th className={cls.th + ' text-center'}>Durum</th>
                  <th className={cls.th + ' text-center'}>Evrak</th>
                  <th className={cls.th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(k => {
                  const musteri = musteriler.find(m => m.id === k.musteri_id)
                  const toplam  = odemeToplamı(k.id)
                  const kalan   = kalanBorc(k)
                  const isExp   = expanded === k.id
                  const tf = (t?: string | null) => t ? format(new Date(t + 'T00:00:00'), 'dd.MM.yyyy') : '—'
                  return (
                    <>
                      <tr key={k.id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">

                        {/* Borçlu + TC + müşteri + personel durumu */}
                        <td className={cls.td}>
                          <p className="font-semibold text-white text-sm">{k.borclu_adi}</p>
                          {k.tc_no && <p className="text-xs text-slate-400">{k.tc_no}</p>}
                          {musteri && <p className="text-xs text-slate-400 mt-0.5">{musteri.ad}</p>}
                          <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ISCI_STYLE[k.isci_durumu ?? 'calisiyor']}`}>
                            {k.isci_durumu === 'ayrildi' ? 'Ayrıldı' : 'Çalışıyor'}
                          </span>
                        </td>

                        {/* İcra dairesi + dosya no + tarihler */}
                        <td className={cls.td}>
                          <p className="text-slate-200 text-sm">{k.icra_dairesi_adi}</p>
                          <p className="text-xs text-slate-400 font-mono">{k.dosya_no}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Teb: {tf(k.tebligat_tarihi)}
                            {k.cevap_tarihi ? <> · Cevap: {tf(k.cevap_tarihi)}</> : null}
                          </p>
                        </td>

                        {/* Borç / Ödenen / Kalan — sağa hizalı */}
                        <td className={cls.td + ' text-right'}>
                          <p className="text-sm text-white font-semibold whitespace-nowrap">{TL(k.borc_tutari)}</p>
                          <p className="text-xs text-emerald-400 whitespace-nowrap">↓ {TL(toplam)}</p>
                          <p className={`text-xs font-bold whitespace-nowrap ${kalan > 0 ? 'text-red-400' : 'text-emerald-400'}`}>= {TL(kalan)}</p>
                        </td>

                        {/* Durum badge'leri */}
                        <td className={cls.td + ' text-center'}>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${DURUM_STYLE[k.durum]}`}>
                            {DURUM_LABEL[k.durum]}
                          </span>
                        </td>

                        {/* Evrak ikonları */}
                        <td className={cls.td + ' text-center'}>
                          <div className="flex items-center justify-center gap-2">
                            {k.tebligat_dosya_url
                              ? <a href={k.tebligat_dosya_url} target="_blank" rel="noreferrer" title={`Tebligat: ${k.tebligat_dosya_adi || ''}`} className="flex flex-col items-center gap-0.5 text-blue-400 hover:text-blue-300">
                                  <FileIcon size={14} /><span className="text-[9px] font-bold">TEB</span>
                                </a>
                              : <span className="text-slate-600 text-[10px]">—</span>
                            }
                            {k.cevap_dosya_url
                              ? <a href={k.cevap_dosya_url} target="_blank" rel="noreferrer" title={`Cevap: ${k.cevap_dosya_adi || ''}`} className="flex flex-col items-center gap-0.5 text-emerald-400 hover:text-emerald-300">
                                  <FileIcon size={14} /><span className="text-[9px] font-bold">CEV</span>
                                </a>
                              : null
                            }
                          </div>
                        </td>

                        {/* Aksiyonlar */}
                        <td className={cls.td}>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setExpanded(isExp ? null : k.id)} className={cls.btnGhost} title="Ödemeler">
                              <CreditCard size={13} />{isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                            <button onClick={() => openCevapModal(k)} className={cls.btnGhost} title="Cevap Yazısı"><FileText size={13} /></button>
                            <button onClick={() => openEdit(k)} className={cls.btnGhost} title="Düzenle"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteId(k.id)} className="flex items-center justify-center text-red-400 hover:bg-red-500/10 p-1.5 rounded-xl transition-all" title="Sil"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>

                      {isExp && (
                        <tr key={k.id + '-exp'} className="border-t border-white/5">
                          <td colSpan={6} className="px-4 py-0">
                            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 my-3">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><CreditCard size={13} /> Ödeme Geçmişi</p>
                                <button onClick={() => openOdemeModal(k.id)} className={cls.btnPrimary + ' text-xs py-1.5 px-3'}><Plus size={12} /> Ödeme Ekle</button>
                              </div>
                              {!(odemeler[k.id]?.length) ? (
                                <p className="text-xs text-slate-500 py-3 text-center">Henüz ödeme yok</p>
                              ) : (
                                <table className="w-full">
                                  <thead><tr>
                                    {['Tarih', 'Tutar', 'Açıklama', ''].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
                                  </tr></thead>
                                  <tbody>
                                    {odemeler[k.id].map(o => (
                                      <tr key={o.id} className="border-t border-white/5">
                                        <td className="px-3 py-2 text-sm text-slate-300 whitespace-nowrap">{format(new Date(o.odeme_tarihi + 'T00:00:00'), 'dd.MM.yyyy')}</td>
                                        <td className="px-3 py-2 text-sm font-bold text-emerald-400 text-right whitespace-nowrap">{TL(o.tutar)}</td>
                                        <td className="px-3 py-2 text-sm text-slate-400">{o.aciklama || '—'}</td>
                                        <td className="px-3 py-2 text-right">
                                          <button onClick={() => setOdemeDeleteId({ icraId: k.id, odemeId: o.id })} className="text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg"><Trash2 size={12} /></button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t border-white/10">
                                      <td className="px-3 py-2 text-xs font-semibold text-slate-400">Toplam Ödenen</td>
                                      <td className="px-3 py-2 text-sm font-bold text-emerald-400 text-right">{TL(toplam)}</td>
                                      <td colSpan={2} />
                                    </tr>
                                    <tr>
                                      <td className="px-3 py-1 text-xs font-semibold text-slate-400">Kalan Borç</td>
                                      <td className={`px-3 py-1 text-sm font-bold text-right ${kalan > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{TL(kalan)}</td>
                                      <td colSpan={2} />
                                    </tr>
                                  </tfoot>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Kayıt Ekle / Düzenle ──────────────────────────────────────── */}
      {modal && (
        <Modal title={modal.id ? 'İcra Kaydını Düzenle' : 'Yeni İcra Kaydı'} onClose={() => setModal(null)} size="xl"
          footer={
            <>
              <button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={save} disabled={saving} className={cls.btnPrimary}>
                {uploading ? 'Dosya yükleniyor...' : saving ? 'Kaydediliyor...' : modal.id ? 'Güncelle' : 'Kaydet'}
              </button>
            </>
          }
        >
          <div className="space-y-5">
            {modalErr && <ErrorMsg message={modalErr} />}

            {/* Personel durumu — en üstte */}
            <Field label="Personel Durumu" required>
              <div className="flex gap-3">
                {([['calisiyor', 'Çalışmaya Devam Ediyor'], ['ayrildi', 'İşten Ayrıldı']] as [IcraIsciDurumu, string][]).map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setF({ isci_durumu: val, cikis_tarihi: val === 'calisiyor' ? null : modal.form.cikis_tarihi })}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all ${
                      modal.form.isci_durumu === val
                        ? val === 'calisiyor' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </Field>

            {modal.form.isci_durumu === 'ayrildi' && (
              <Field label="İşten Çıkış Tarihi">
                <input type="date" className={cls.input}
                  value={modal.form.cikis_tarihi || ''}
                  onChange={e => setF({ cikis_tarihi: e.target.value || null })} />
              </Field>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Borçlu Adı" required>
                <input className={cls.input} value={modal.form.borclu_adi} onChange={e => setF({ borclu_adi: e.target.value })} placeholder="Ad Soyad" />
              </Field>
              <Field label="TC Kimlik No">
                <input className={cls.input} value={modal.form.tc_no || ''} onChange={e => setF({ tc_no: e.target.value })} placeholder="00000000000" maxLength={11} />
              </Field>
            </div>

            <Field label="Müşteri (İsteğe Bağlı)">
              <select className={cls.input} value={modal.form.musteri_id || ''} onChange={e => setF({ musteri_id: e.target.value || null })}>
                <option value="">— Seçiniz —</option>
                {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="İcra Dairesi Adı" required>
                <input className={cls.input} value={modal.form.icra_dairesi_adi} onChange={e => setF({ icra_dairesi_adi: e.target.value })} placeholder="X. İcra Müdürlüğü" />
              </Field>
              <Field label="Dosya Numarası" required>
                <input className={cls.input} value={modal.form.dosya_no} onChange={e => setF({ dosya_no: e.target.value })} placeholder="2024/1234 E." />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tebligat Tarihi" required>
                <input type="date" className={cls.input} value={modal.form.tebligat_tarihi} onChange={e => setF({ tebligat_tarihi: e.target.value })} />
              </Field>
              <Field label="Cevap Tarihi">
                <input type="date" className={cls.input} value={modal.form.cevap_tarihi || ''} onChange={e => setF({ cevap_tarihi: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Alacaklı Adı" required>
                <input className={cls.input} value={modal.form.alacakli_adi} onChange={e => setF({ alacakli_adi: e.target.value })} placeholder="Alacaklı kişi veya kurum" />
              </Field>
              <Field label="Borç Tutarı (₺)" required>
                <input type="number" className={cls.input} value={modal.form.borc_tutari || ''} onChange={e => setF({ borc_tutari: Number(e.target.value) })} placeholder="0.00" min={0} step="0.01" />
              </Field>
            </div>

            <Field label="İcra Dairesi IBAN">
              <input className={cls.input} value={modal.form.icra_dairesi_iban || ''} onChange={e => setF({ icra_dairesi_iban: e.target.value })} placeholder="TR00 0000 0000 0000 0000 0000 00" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="KEP Numarası" hint="Kayıtlı Elektronik Posta numarası">
                <input className={cls.input} value={modal.form.kep_no || ''} onChange={e => setF({ kep_no: e.target.value })} placeholder="ornek@hs01.kep.tr" />
              </Field>
              <Field label="Barkod / Giriş Numarası">
                <input className={cls.input} value={modal.form.barkod_no || ''} onChange={e => setF({ barkod_no: e.target.value })} placeholder="Üst yazı barkod veya giriş no" />
              </Field>
            </div>

            <Field label="Durum">
              <select className={cls.input} value={modal.form.durum} onChange={e => setF({ durum: e.target.value as IcraDurum })}>
                {(Object.keys(DURUM_LABEL) as IcraDurum[]).map(d => <option key={d} value={d}>{DURUM_LABEL[d]}</option>)}
              </select>
            </Field>

            <Field label="Notlar">
              <textarea className={cls.input + ' resize-none'} rows={2} value={modal.form.notlar || ''} onChange={e => setF({ notlar: e.target.value })} placeholder="Ek açıklamalar..." />
            </Field>

            {/* Evrak Ekleme */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Evrak Ekleme</p>
              <p className="text-xs text-slate-500">Desteklenen formatlar: .doc, .docx, .xls, .xlsx, .pdf</p>

              {/* Tebligat */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300">Tebligat Evrakı</p>
                {(pendingTebligat || modal.form.tebligat_dosya_adi) ? (
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                    <FileIcon size={14} className={fileExt(pendingTebligat?.name || modal.form.tebligat_dosya_adi || '').color} />
                    <span className="text-sm text-slate-200 flex-1 truncate">{pendingTebligat?.name || modal.form.tebligat_dosya_adi}</span>
                    {modal.form.tebligat_dosya_url && !pendingTebligat && (
                      <a href={modal.form.tebligat_dosya_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300"><Download size={14} /></a>
                    )}
                    <button type="button" onClick={() => {
                      if (pendingTebligat) { setPendingTebligat(null); if (tebligatRef.current) tebligatRef.current.value = '' }
                      else if (modal.id) removeDocFromRecord(modal.id, 'tebligat').then(() => setF({ tebligat_dosya_url: null, tebligat_dosya_adi: null }))
                      else setF({ tebligat_dosya_url: null, tebligat_dosya_adi: null })
                    }} className="text-slate-400 hover:text-red-400"><X size={14} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => tebligatRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-lg py-2.5 text-sm text-slate-400 hover:border-blue-500/50 hover:text-blue-400 transition-all">
                    <Upload size={14} /> Tebligat Yükle
                  </button>
                )}
                <input ref={tebligatRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setPendingTebligat(f) }} />
              </div>

              {/* Cevap */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300">Cevap Evrakı</p>
                {(pendingCevap || modal.form.cevap_dosya_adi) ? (
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                    <FileIcon size={14} className={fileExt(pendingCevap?.name || modal.form.cevap_dosya_adi || '').color} />
                    <span className="text-sm text-slate-200 flex-1 truncate">{pendingCevap?.name || modal.form.cevap_dosya_adi}</span>
                    {modal.form.cevap_dosya_url && !pendingCevap && (
                      <a href={modal.form.cevap_dosya_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300"><Download size={14} /></a>
                    )}
                    <button type="button" onClick={() => {
                      if (pendingCevap) { setPendingCevap(null); if (cevapRef.current) cevapRef.current.value = '' }
                      else if (modal.id) removeDocFromRecord(modal.id, 'cevap').then(() => setF({ cevap_dosya_url: null, cevap_dosya_adi: null }))
                      else setF({ cevap_dosya_url: null, cevap_dosya_adi: null })
                    }} className="text-slate-400 hover:text-red-400"><X size={14} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => cevapRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-lg py-2.5 text-sm text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-all">
                    <Upload size={14} /> Cevap Yükle
                  </button>
                )}
                <input ref={cevapRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setPendingCevap(f) }} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Ödeme Ekle ────────────────────────────────────────────────── */}
      {odemeModal && (
        <Modal title="Ödeme Ekle" onClose={() => setOdemeModal(null)} size="sm"
          footer={<><button onClick={() => setOdemeModal(null)} className={cls.btnSecondary}>İptal</button><button onClick={saveOdeme} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
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

      {/* ── Modal: Cevap Yazısı ──────────────────────────────────────────────── */}
      {cevapModal && (
        <Modal title="Cevap Yazısı Oluştur" onClose={() => setCevapModal(null)} size="lg"
          footer={<>
            <button onClick={() => setCevapModal(null)} className={cls.btnSecondary}>İptal</button>
            <button onClick={generateCevapYazisi} disabled={isGeneratingCevap} className={cls.btnPrimary}>
              {isGeneratingCevap ? 'Oluşturuluyor...' : <><FileText size={14} /> Word İndir & Kaydet</>}
            </button>
          </>}>
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 space-y-1 text-sm">
              <p><span className="text-slate-400">Dosya No:</span> <span className="text-white font-medium">{cevapModal.kayit.dosya_no}</span></p>
              <p><span className="text-slate-400">Borçlu:</span> <span className="text-white font-medium">{cevapModal.kayit.borclu_adi}</span></p>
              <p><span className="text-slate-400">Borç:</span> <span className="text-white font-medium">{TL(cevapModal.kayit.borc_tutari)}</span></p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cevap Veren (Müşteri)">
                <select className={cls.input} value={cevapModal.form.cevap_veren_id}
                  onChange={e => {
                    const m = musteriler.find(x => x.id === e.target.value)
                    setCevapModal(c => c ? { ...c, form: { ...c.form, cevap_veren_id: e.target.value, cevap_veren: m?.ad || '' } } : c)
                  }}>
                  <option value="">— Seçiniz —</option>
                  {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </Field>
              <Field label="İşveren (Müşteri)">
                <select className={cls.input} value={cevapModal.form.isveren_id}
                  onChange={e => {
                    const m = musteriler.find(x => x.id === e.target.value)
                    setCevapModal(c => c ? { ...c, form: { ...c.form, isveren_id: e.target.value, isveren: m?.ad || firma.ad } } : c)
                  }}>
                  <option value="">— Seçiniz —</option>
                  {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </Field>
            </div>
            <Field label="İşçinin Durumu">
              <div className="flex gap-3">
                {([['devam', 'Çalışmaya Devam Ediyor'], ['cikti', 'İşten Ayrıldı']] as const).map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setCevapModal(m => m ? { ...m, form: { ...m.form, isci_durumu: val } } : m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      cevapModal.form.isci_durumu === val
                        ? val === 'devam' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
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
                  <p className="text-xs text-emerald-400 mt-1 font-medium">
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

      {/* ── Confirm: İcra Sil ────────────────────────────────────────────────── */}
      {deleteId && (
        <ConfirmModal title="İcra Kaydını Sil" message="Bu icra kaydını, tüm ödeme geçmişini ve yüklü evrakları silmek istediğinize emin misiniz?"
          onConfirm={deleteKayit} onCancel={() => setDeleteId(null)} danger />
      )}

      {/* ── Confirm: Ödeme Sil ───────────────────────────────────────────────── */}
      {odemeDeleteId && (
        <ConfirmModal title="Ödemeyi Sil" message="Bu ödeme kaydını silmek istediğinize emin misiniz?"
          onConfirm={deleteOdeme} onCancel={() => setOdemeDeleteId(null)} danger />
      )}
    </div>
  )
}
