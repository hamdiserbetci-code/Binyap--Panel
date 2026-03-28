'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Plus, CheckCircle2, Clock, Pencil, Trash2, Users, Building2,
  Upload, FileText, Download, X, FileSpreadsheet, Image, BellRing, Bell,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg, Modal, Field, ConfirmModal, cls } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { BordroSurec, Proje, Ekip, Musteri } from '@/types'

interface BordroDosya {
  id: string; surec_id: string; adim: string
  dosya_adi: string; dosya_url: string
  mime_type: string | null; boyut_byte: number | null; created_at: string
}

type Adim = { key: keyof BordroSurec; label: string; tarihKey: keyof BordroSurec; adimKey: string; aciklamaKey: keyof BordroSurec }
const ADIMLAR: Adim[] = [
  { key: 'puantaj_durum', label: 'Puantaj',           tarihKey: 'puantaj_tarihi', adimKey: 'puantaj', aciklamaKey: 'puantaj_aciklama' },
  { key: 'bordro_durum',  label: 'Bordro Hesaplama',  tarihKey: 'bordro_tarihi',  adimKey: 'bordro',  aciklamaKey: 'bordro_aciklama'  },
  { key: 'teyit_durum',   label: 'Teyit',             tarihKey: 'teyit_tarihi',   adimKey: 'teyit',   aciklamaKey: 'teyit_aciklama'   },
  { key: 'odeme_durum',   label: 'Ödeme',             tarihKey: 'odeme_tarihi',   adimKey: 'odeme',   aciklamaKey: 'odeme_aciklama'   },
  { key: 'santiye_durum', label: 'Şantiye Gönderimi', tarihKey: 'santiye_tarihi', adimKey: 'santiye', aciklamaKey: 'santiye_aciklama' },
]

const AYLAR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function donemLabel(d: string) {
  const [y, m] = d.split('-')
  const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  return `${months[parseInt(m)-1]} ${y}`
}

function tamamCount(s: BordroSurec) {
  return ADIMLAR.filter(a => (s[a.key] as string) === 'tamamlandi').length
}

function stepColor(count: number) {
  if (count === 5) return '#30D158'
  if (count >= 3)  return '#FF9F0A'
  if (count > 0)   return '#0A84FF'
  return 'rgba(60,60,67,0.5)'
}

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function Bordro({ firma }: AppCtx) {
  const [projeler, setProjeler]     = useState<Proje[]>([])
  const [ekipler, setEkipler]       = useState<Ekip[]>([])
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [surecler, setSurecler]     = useState<BordroSurec[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [selProje, setSelProje]   = useState<Proje | null>(null)
  const [selEkip, setSelEkip]     = useState<Ekip | null>(null)
  const [selSurec, setSelSurec]   = useState<BordroSurec | null>(null)
  const [selCell, setSelCell]     = useState<string | null>(null)

  const [projeModal, setProjeModal]   = useState<Partial<Proje> | null>(null)
  const [ekipModal, setEkipModal]     = useState<Partial<Ekip> | null>(null)
  const [surecModal, setSurecModal]   = useState(false)
  const [newDonem, setNewDonem]       = useState(() => new Date().toISOString().slice(0, 7))
  const [deletingProje, setDeletingProje] = useState<Proje | null>(null)
  const [deletingEkip, setDeletingEkip]   = useState<Ekip | null>(null)
  const [saving, setSaving]           = useState(false)
  const [notVal, setNotVal]           = useState('')
  const [notDirty, setNotDirty]       = useState(false)
  const [dosyalar, setDosyalar]       = useState<BordroDosya[]>([])
  const [uploading, setUploading]     = useState<string | null>(null)
  const [dragOver, setDragOver]       = useState<string | null>(null)
  const [aciklamaModal, setAciklamaModal] = useState<{ adim: Adim; value: string } | null>(null)
  const [detayModal, setDetayModal]   = useState(false)
  
  const [erteleModal, setErteleModal] = useState<BordroSurec | null>(null)
  const [erteleForm, setErteleForm]   = useState({ tarih: new Date().toISOString().split('T')[0], saat: '' })
  
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { load() }, [firma.id])

  useEffect(() => {
    timerRef.current = setInterval(checkReminders, 60_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [surecler])

  function checkReminders() {
    if (!('Notification' in window)) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().split('T')[0]
    surecler.forEach(s => {
      if (s.hatirlatici_saati === hhmm && s.hatirlatici_tarihi === today) {
        // Complete olup olmadığına da bakabiliriz.
        const c = tamamCount(s)
        if (c < 5) {
          if (Notification.permission === 'granted') {
            new Notification(`📌 Bordro Hatırlatıcısı`, {
              body: `${s.proje?.ad || 'Proje'} - Dönem: ${donemLabel(s.donem)}`,
              icon: '/favicon.ico',
            })
          }
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
    try {
      const [{ data: p }, { data: e }, { data: m }, { data: s }] = await Promise.all([
        supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad'),
        supabase.from('ekipler').select('*').eq('firma_id', firma.id).order('ad'),
        supabase.from('musteriler').select('id,ad,kisa_ad').eq('firma_id', firma.id).eq('aktif', true).order('ad'),
        supabase.from('bordro_surecler').select('*').eq('firma_id', firma.id).order('donem', { ascending: false }),
      ])
      setProjeler((p || []) as Proje[])
      setEkipler((e || []) as Ekip[])
      setMusteriler((m || []) as Musteri[])
      setSurecler((s || []) as BordroSurec[])
    } catch (e: any) { setError(e?.message || 'Yüklenemedi') }
    finally { setLoading(false) }
  }

  async function saveProje() {
    if (!projeModal?.ad?.trim()) return
    setSaving(true)
    const payload = { ...projeModal, firma_id: firma.id }
    const { error: e } = projeModal.id
      ? await supabase.from('projeler').update(payload).eq('id', projeModal.id)
      : await supabase.from('projeler').insert(payload)
    setSaving(false)
    if (e) { alert(e.message); return }
    setProjeModal(null); await load()
  }

  async function deleteProje() {
    if (!deletingProje) return
    await supabase.from('projeler').delete().eq('id', deletingProje.id)
    if (selProje?.id === deletingProje.id) { setSelProje(null); setSelEkip(null); setSelSurec(null); setSelCell(null) }
    setDeletingProje(null); load()
  }

  async function saveEkip() {
    if (!ekipModal?.ad?.trim() || !selProje) return
    setSaving(true)
    const payload = { ...ekipModal, firma_id: firma.id, proje_id: selProje.id }
    const { error: e } = ekipModal.id
      ? await supabase.from('ekipler').update(payload).eq('id', ekipModal.id)
      : await supabase.from('ekipler').insert(payload)
    setSaving(false)
    if (e) { alert(e.message); return }
    setEkipModal(null); load()
  }

  async function deleteEkip() {
    if (!deletingEkip) return
    await supabase.from('ekipler').delete().eq('id', deletingEkip.id)
    if (selEkip?.id === deletingEkip.id) { setSelEkip(null); setSelSurec(null); setSelCell(null) }
    setDeletingEkip(null); load()
  }

  async function createSurec() {
    if (!selProje || !newDonem) return
    setSaving(true)
    const { data, error: e } = await supabase.from('bordro_surecler')
      .insert({ firma_id: firma.id, proje_id: selProje.id, ekip_id: selEkip?.id || null, donem: newDonem })
      .select('*').single()
    setSaving(false)
    if (e) { alert(e.message); return }
    setSurecModal(false); await load()
    const created = data as BordroSurec
    setSelSurec(created); setSelCell(created.id)
    setNotVal(''); setNotDirty(false); setDosyalar([])
  }

  async function toggleAdim(adim: Adim) {
    if (!selSurec) return
    const cur = selSurec[adim.key] as string
    const newVal = cur === 'tamamlandi' ? 'bekliyor' : 'tamamlandi'
    const tarih = newVal === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null
    const update = { [adim.key]: newVal, [adim.tarihKey]: tarih }
    const { error: e } = await supabase.from('bordro_surecler').update(update).eq('id', selSurec.id)
    if (e) { alert(e.message); return }
    const updated = { ...selSurec, ...update }
    setSurecler(prev => prev.map(s => s.id === selSurec.id ? updated : s))
    setSelSurec(updated)
  }

  async function saveNot() {
    if (!selSurec) return
    await supabase.from('bordro_surecler').update({ notlar: notVal }).eq('id', selSurec.id)
    const updated = { ...selSurec, notlar: notVal }
    setSurecler(prev => prev.map(s => s.id === selSurec.id ? updated : s))
    setSelSurec(updated); setNotDirty(false)
  }

  async function saveAciklama(adim: Adim, value: string | null) {
    if (!selSurec) return
    const { error: e } = await supabase.from('bordro_surecler')
      .update({ [adim.aciklamaKey]: value || null }).eq('id', selSurec.id)
    if (e) { alert(e.message); return }
    const updated = { ...selSurec, [adim.aciklamaKey]: value || null }
    setSurecler(prev => prev.map(s => s.id === selSurec.id ? updated : s))
    setSelSurec(updated); setAciklamaModal(null)
  }

  async function loadDosyalar(surecId: string) {
    const { data } = await supabase.from('bordro_dosyalar').select('*')
      .eq('surec_id', surecId).order('created_at')
    setDosyalar((data || []) as BordroDosya[])
  }

  async function uploadDosya(adimKey: string, files: FileList) {
    if (!selSurec || !files.length) return
    const surecId = selSurec.id
    setUploading(adimKey)
    for (const file of Array.from(files)) {
      const safe = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `bordro/${firma.id}/${surecId}/${adimKey}/${safe}`
      const { error: upErr } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
      if (upErr) { alert('Depolama hatası: ' + upErr.message); continue }
      const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
      await supabase.from('bordro_dosyalar').insert({
        firma_id: firma.id, surec_id: surecId, adim: adimKey,
        dosya_adi: file.name, dosya_url: urlData.publicUrl,
        mime_type: file.type || null, boyut_byte: file.size || null,
      })
    }
    setUploading(null); loadDosyalar(surecId)
  }

  async function deleteDosya(d: BordroDosya) {
    const url = new URL(d.dosya_url)
    const storagePath = url.pathname.split('/object/public/arsiv/')[1]
    if (storagePath) await supabase.storage.from('arsiv').remove([storagePath])
    await supabase.from('bordro_dosyalar').delete().eq('id', d.id)
    setDosyalar(prev => prev.filter(x => x.id !== d.id))
  }

  function handleCellClick(donem: string, surec: BordroSurec | undefined) {
    if (!selProje) return
    if (!surec) {
      setNewDonem(donem); setSurecModal(true)
    } else if (selCell === surec.id) {
      setSelCell(null); setSelSurec(null)
    } else {
      setSelCell(surec.id); setSelSurec(surec)
      setNotVal(surec.notlar || ''); setNotDirty(false)
      loadDosyalar(surec.id)
    }
  }

  async function saveErtele() {
    if (!erteleModal) return
    if (!erteleForm.tarih) return
    if (!erteleForm.saat) return
    setSaving(true)
    const { error } = await supabase.from('bordro_surecler').update({
      hatirlatici_tarihi: erteleForm.tarih,
      hatirlatici_saati: erteleForm.saat
    }).eq('id', erteleModal.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    setErteleModal(null); load()
  }

  async function clearErtele(id: string) {
    await supabase.from('bordro_surecler').update({ hatirlatici_tarihi: null, hatirlatici_saati: null }).eq('id', id)
    load()
  }

  // ── Yıllar ──────────────────────────────────────────────────────────────────
  const sureclerForGrid = selProje
    ? surecler.filter(s => s.proje_id === selProje.id && (selEkip ? s.ekip_id === selEkip.id : !s.ekip_id))
    : []

  const thisYear = new Date().getFullYear()
  const yillarSet = new Set([thisYear - 1, thisYear, thisYear + 1])
  sureclerForGrid.forEach(s => yillarSet.add(parseInt(s.donem.slice(0, 4))))
  const yillar = Array.from(yillarSet).sort((a, b) => a - b)

  if (loading) return <Loading />
  if (error)   return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="flex flex-col -mx-3 md:-mx-5 -mt-3 md:-mt-5" style={{ height: 'calc(100dvh - 64px)' }}>

      {/* ── Üst Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-[rgba(60,60,67,0.36)] shrink-0"
        style={{ background: 'rgba(28,28,30,0.95)' }}>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white flex-1 uppercase">Bordro Süreci</h1>
        {!('Notification' in window && Notification.permission === 'granted') && (
          <button onClick={requestNotifPermission} className="flex items-center gap-2 text-[11px] font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-2 rounded-xl transition-all">
            <BellRing size={14} /> İzin Ver
          </button>
        )}
        <button onClick={() => setProjeModal({ durum: 'aktif' })}
          className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-semibold text-white transition-all"
          style={{ background: '#0A84FF' }}>
          <Plus size={13} /> Yeni Proje
        </button>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Sol Panel: Projeler / Ekipler ───────────────────────────────── */}
        <div className="hidden sm:flex flex-col w-72 shrink-0 overflow-y-auto border-r border-[rgba(60,60,67,0.36)]"
          style={{ background: '#1C1C1E' }}>

          {projeler.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
              <Building2 size={32} className="text-[rgba(235,235,245,0.15)]" />
              <p className="text-xs text-[rgba(235,235,245,0.4)]">Henüz proje yok</p>
              <button onClick={() => setProjeModal({ durum: 'aktif' })}
                className="text-xs text-[#0A84FF] hover:underline">+ Proje Ekle</button>
            </div>
          )}

          {projeler.map(proje => {
            const isSelProje  = selProje?.id === proje.id
            const kids        = ekipler.filter(e => e.proje_id === proje.id)
            const musteri     = musteriler.find(m => m.id === proje.musteri_id)
            const projeSurecler = surecler.filter(s => s.proje_id === proje.id)
            const doneTotal   = projeSurecler.reduce((sum, s) => sum + tamamCount(s), 0)
            const maxTotal    = projeSurecler.length * 5

            return (
              <div key={proje.id}>
                {/* Proje butonu */}
                <button
                  onClick={() => {
                    if (isSelProje) { setSelProje(null); setSelEkip(null); setSelSurec(null); setSelCell(null) }
                    else { setSelProje(proje); setSelEkip(null); setSelSurec(null); setSelCell(null) }
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all border-b border-[rgba(60,60,67,0.2)]"
                  style={{ background: isSelProje ? 'rgba(10,132,255,0.12)' : undefined }}>

                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isSelProje ? 'rgba(10,132,255,0.2)' : 'rgba(60,60,67,0.4)',
                      borderLeft: `3px solid ${isSelProje ? '#0A84FF' : 'rgba(60,60,67,0.6)'}`,
                    }}>
                    <Building2 size={18} style={{ color: isSelProje ? '#0A84FF' : 'rgba(235,235,245,0.4)' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {musteri && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5 truncate"
                        style={{ color: 'rgba(235,235,245,0.35)' }}>
                        {musteri.kisa_ad || musteri.ad}
                      </p>
                    )}
                    <p className={`text-sm font-semibold truncate ${isSelProje ? 'text-white' : 'text-[rgba(235,235,245,0.8)]'}`}>
                      {proje.ad}
                    </p>
                    {proje.kod && <p className="text-[10px] text-[rgba(235,235,245,0.3)]">{proje.kod}</p>}
                    {maxTotal > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-[rgba(60,60,67,0.5)] overflow-hidden">
                          <div className="h-1 rounded-full transition-all"
                            style={{ width: `${(doneTotal / maxTotal) * 100}%`, background: doneTotal === maxTotal ? '#30D158' : '#0A84FF' }} />
                        </div>
                        <span className="text-[10px] text-[rgba(235,235,245,0.3)] shrink-0">{projeSurecler.length} dönem</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setProjeModal(proje)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-white hover:bg-[rgba(60,60,67,0.5)] transition-all">
                      <Pencil size={10} />
                    </button>
                    <button onClick={() => setDeletingProje(proje)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#FF453A] hover:bg-[rgba(255,69,58,0.1)] transition-all">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </button>

                {/* Ekipler */}
                {isSelProje && (
                  <div className="pl-4 pr-3 py-2 space-y-0.5 border-b border-[rgba(60,60,67,0.2)]"
                    style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <button
                      onClick={() => { setSelEkip(null); setSelSurec(null); setSelCell(null) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-semibold transition-all ${!selEkip ? 'text-[#0A84FF] bg-[rgba(10,132,255,0.1)]' : 'text-[rgba(235,235,245,0.5)] hover:bg-[rgba(60,60,67,0.3)]'}`}>
                      <Users size={12} /> Proje Geneli
                    </button>
                    {kids.map(ekip => (
                      <div key={ekip.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-[10px] cursor-pointer transition-all ${selEkip?.id === ekip.id ? 'text-[#0A84FF] bg-[rgba(10,132,255,0.1)]' : 'text-[rgba(235,235,245,0.5)] hover:bg-[rgba(60,60,67,0.3)]'}`}
                        onClick={() => { setSelEkip(ekip); setSelSurec(null); setSelCell(null) }}>
                        <Users size={12} className="shrink-0" />
                        <span className="text-xs flex-1 truncate font-medium">{ekip.ad}</span>
                        <button onClick={e => { e.stopPropagation(); setEkipModal(ekip) }}
                          className="w-5 h-5 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-white hover:bg-[rgba(60,60,67,0.5)]">
                          <Pencil size={9} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setDeletingEkip(ekip) }}
                          className="w-5 h-5 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#FF453A]">
                          <Trash2 size={9} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setEkipModal({ aktif: true })}
                      className="w-full flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs text-[#0A84FF] hover:bg-[rgba(10,132,255,0.1)] transition-all">
                      <Plus size={11} /> Ekip Ekle
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Sağ Panel: Yıl × Ay Izgarası ────────────────────────────────── */}
        <div className="flex-1 overflow-auto" style={{ background: '#000000' }}>
          {!selProje ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <Building2 size={44} className="text-[rgba(235,235,245,0.1)]" />
              <p className="text-sm text-[rgba(235,235,245,0.4)]">Soldan bir proje seçin</p>
            </div>
          ) : (
            <div className="p-4">

              {/* Başlık */}
              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1">
                  <h2 className="text-base font-bold text-white">
                    {selProje.ad}{selEkip ? ` · ${selEkip.ad}` : ' · Proje Geneli'}
                  </h2>
                  <p className="text-xs text-[rgba(235,235,245,0.4)]">
                    {sureclerForGrid.length} dönem kayıtlı
                  </p>
                </div>
                <button
                  onClick={() => { setNewDonem(new Date().toISOString().slice(0, 7)); setSurecModal(true) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-semibold text-white border border-[rgba(60,60,67,0.5)] hover:border-[#0A84FF] hover:text-[#0A84FF] transition-all">
                  <Plus size={12} /> Yeni Dönem
                </button>
              </div>

              {/* Yıl Kartları */}
              <div className="flex gap-4 w-full min-w-max">
                {yillar.map(yil => {
                  const yilSurecler = sureclerForGrid.filter(s => s.donem.startsWith(String(yil)))
                  return (
                    <div key={yil} className="rounded-2xl overflow-hidden border border-[rgba(60,60,67,0.36)] flex-1"
                      style={{ minWidth: '260px', background: '#1C1C1E' }}>

                      {/* Yıl başlığı */}
                      <div className="px-4 py-3 border-b border-[rgba(60,60,67,0.3)]"
                        style={{ background: 'rgba(10,132,255,0.12)', borderLeft: '3px solid #0A84FF' }}>
                        <p className="text-sm font-bold text-white">{yil}</p>
                        <p className="text-[10px] text-[rgba(235,235,245,0.4)]">
                          {yilSurecler.length}/12 dönem
                        </p>
                      </div>

                      {/* Ay satırları */}
                      {AYLAR.map((ayAd, ayIdx) => {
                        const donem = `${yil}-${String(ayIdx + 1).padStart(2, '0')}`
                        const surec = sureclerForGrid.find(s => s.donem === donem)
                        const count = surec ? tamamCount(surec) : 0
                        const color = surec ? stepColor(count) : undefined
                        const isExpanded = selCell === surec?.id

                        return (
                          <div key={donem}>
                            {/* Hücre */}
                            <button
                              onClick={() => handleCellClick(donem, surec)}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all border-b border-[rgba(60,60,67,0.12)] ${isExpanded ? 'bg-[rgba(10,132,255,0.1)]' : 'hover:bg-[rgba(60,60,67,0.2)]'}`}>
                              <span className={`text-xs font-medium w-9 shrink-0 ${surec ? 'text-white' : 'text-[rgba(235,235,245,0.2)]'}`}>
                                {ayAd}
                              </span>
                              {surec ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(60,60,67,0.5)' }}>
                                    <div className="h-1.5 rounded-full transition-all"
                                      style={{ width: `${(count / 5) * 100}%`, background: color }} />
                                  </div>
                                  <span className="text-[10px] font-bold shrink-0" style={{ color }}>
                                    {count === 5 ? '✓' : `${count}/5`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[rgba(235,235,245,0.18)] text-xs">+</span>
                              )}
                            </button>

                            {/* Inline Genişleme */}
                            {isExpanded && surec && (
                              <div className="border-b border-[rgba(60,60,67,0.3)] p-2.5 space-y-1.5"
                                style={{ background: 'rgba(0,0,0,0.35)' }}>
                                {ADIMLAR.map((adim, i) => {
                                  const done = (surec[adim.key] as string) === 'tamamlandi'
                                  return (
                                    <button key={adim.key}
                                      onClick={() => toggleAdim(adim)}
                                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-xs font-medium transition-all ${done ? 'bg-[rgba(48,209,88,0.12)] text-[#30D158]' : 'bg-[rgba(60,60,67,0.3)] text-[rgba(235,235,245,0.45)] hover:bg-[rgba(60,60,67,0.5)]'}`}>
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-[rgba(48,209,88,0.25)]' : 'bg-[rgba(60,60,67,0.5)]'}`}>
                                        {done
                                          ? <CheckCircle2 size={12} className="text-[#30D158]" />
                                          : <span className="text-[10px] font-bold text-[rgba(235,235,245,0.4)]">{i + 1}</span>}
                                      </div>
                                      <span className="flex-1 text-left truncate">{adim.label}</span>
                                    </button>
                                  )
                                })}

                                {/* Dosyalar & Notlar butonu */}
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => setDetayModal(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[10px] font-semibold transition-all border border-[rgba(60,60,67,0.4)] text-[rgba(235,235,245,0.35)] hover:text-white hover:border-[rgba(60,60,67,0.8)] hover:bg-[rgba(60,60,67,0.3)]">
                                    <FileText size={10} /> Dosyalar
                                  </button>
                                  <button
                                    onClick={() => setErteleModal(surec)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[10px] font-semibold transition-all border border-[rgba(60,60,67,0.4)] hover:border-indigo-500/50 hover:bg-indigo-500/20 ${(surec.hatirlatici_tarihi || surec.hatirlatici_saati) ? 'text-indigo-400 bg-indigo-500/10' : 'text-[rgba(235,235,245,0.35)] hover:text-white hover:bg-[rgba(60,60,67,0.3)]'}`}>
                                    <BellRing size={10} /> {(surec.hatirlatici_tarihi || surec.hatirlatici_saati) ? (surec.hatirlatici_saati || 'Hatırlatıcı') : 'Hatırlat'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detay Modal (Dosyalar + Notlar) ─────────────────────────────────── */}
      {detayModal && selSurec && selProje && (
        <Modal
          title={`${selProje.ad}${selEkip ? ` · ${selEkip.ad}` : ''} — ${donemLabel(selSurec.donem)}`}
          onClose={() => setDetayModal(false)} size="lg">
          <div className="space-y-3">
            {ADIMLAR.map(adim => {
              const adimDosyalar = dosyalar.filter(d => d.adim === adim.adimKey)
              const isUploading  = uploading === adim.adimKey
              const aciklama     = selSurec[adim.aciklamaKey] as string | null | undefined
              const done         = (selSurec[adim.key] as string) === 'tamamlandi'

              return (
                <div key={adim.key} className="rounded-xl border border-[rgba(60,60,67,0.36)] overflow-hidden"
                  style={{ background: '#1C1C1E' }}>
                  {/* Adım başlığı */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(60,60,67,0.2)]"
                    style={{ background: done ? 'rgba(48,209,88,0.08)' : undefined }}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-[rgba(48,209,88,0.25)]' : 'bg-[rgba(60,60,67,0.4)]'}`}>
                      {done ? <CheckCircle2 size={11} className="text-[#30D158]" /> : <span className="text-[10px] font-bold text-[rgba(235,235,245,0.4)]">{ADIMLAR.indexOf(adim) + 1}</span>}
                    </div>
                    <p className={`text-xs font-semibold flex-1 ${done ? 'text-[#30D158]' : 'text-white'}`}>{adim.label}</p>
                    <button onClick={() => setAciklamaModal({ adim, value: aciklama || '' })}
                      title={aciklama ? 'Açıklamayı düzenle' : 'Açıklama ekle'}
                      className="w-6 h-6 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-white hover:bg-[rgba(60,60,67,0.5)] transition-all">
                      <Pencil size={10} />
                    </button>
                    {aciklama && (
                      <button onClick={() => saveAciklama(adim, null)}
                        className="w-6 h-6 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#FF453A] transition-all">
                        <X size={10} />
                      </button>
                    )}
                    <button onClick={() => fileRefs.current[adim.adimKey]?.click()} disabled={isUploading}
                      className="w-6 h-6 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#0A84FF] hover:bg-[rgba(10,132,255,0.1)] disabled:opacity-50 transition-all">
                      {isUploading ? <Clock size={12} className="animate-spin" /> : <Upload size={12} />}
                    </button>
                    <input type="file" multiple accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png" className="hidden"
                      ref={el => { fileRefs.current[adim.adimKey] = el }}
                      onChange={e => { if (e.target.files) { uploadDosya(adim.adimKey, e.target.files); e.target.value = '' } }} />
                  </div>

                  {aciklama && (
                    <p className="px-4 py-2 text-xs text-[rgba(235,235,245,0.55)] border-b border-[rgba(60,60,67,0.15)] italic">
                      {aciklama}
                    </p>
                  )}

                  {/* Dosyalar */}
                  {adimDosyalar.length === 0 && !isUploading ? (
                    <button onClick={() => fileRefs.current[adim.adimKey]?.click()}
                      className="w-full px-4 py-3 text-[10px] text-[rgba(235,235,245,0.2)] hover:text-[rgba(235,235,245,0.4)] text-center transition-all">
                      PDF sürükleyin veya tıklayın
                    </button>
                  ) : isUploading ? (
                    <div className="flex items-center justify-center gap-2 py-3">
                      <Clock size={13} className="animate-spin text-[#0A84FF]" />
                      <span className="text-xs text-[#0A84FF]">Yükleniyor...</span>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1"
                      onDragEnter={e => { e.preventDefault(); setDragOver(adim.adimKey) }}
                      onDragOver={e => { e.preventDefault(); setDragOver(adim.adimKey) }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                      onDrop={e => { e.preventDefault(); setDragOver(null); if (e.dataTransfer.files.length) uploadDosya(adim.adimKey, e.dataTransfer.files) }}>
                      {adimDosyalar.map(d => {
                        const isImg = d.mime_type?.startsWith('image/')
                        const isXls = d.mime_type?.includes('sheet') || /\.xlsx?$/i.test(d.dosya_adi)
                        const DIcon = isImg ? Image : isXls ? FileSpreadsheet : FileText
                        const kb = d.boyut_byte ? (d.boyut_byte / 1024).toFixed(0) + ' KB' : ''
                        return (
                          <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[rgba(60,60,67,0.3)] hover:bg-[rgba(60,60,67,0.45)] group transition-all">
                            <DIcon size={11} className="text-[rgba(235,235,245,0.4)] shrink-0" />
                            <span className="text-xs text-[rgba(235,235,245,0.7)] flex-1 truncate font-medium">{d.dosya_adi}</span>
                            {kb && <span className="text-[10px] text-[rgba(235,235,245,0.3)]">{kb}</span>}
                            <a href={d.dosya_url} target="_blank" rel="noreferrer"
                              className="w-6 h-6 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#0A84FF] opacity-0 group-hover:opacity-100 transition-all">
                              <Download size={11} />
                            </a>
                            <button onClick={() => deleteDosya(d)}
                              className="w-6 h-6 rounded flex items-center justify-center text-[rgba(235,235,245,0.3)] hover:text-[#FF453A] opacity-0 group-hover:opacity-100 transition-all">
                              <X size={11} />
                            </button>
                          </div>
                        )
                      })}
                      <button onClick={() => fileRefs.current[adim.adimKey]?.click()}
                        className={`w-full text-center py-1 text-[10px] rounded-lg transition-all ${dragOver === adim.adimKey ? 'text-[#0A84FF] bg-[rgba(10,132,255,0.1)]' : 'text-[rgba(235,235,245,0.25)] hover:text-[rgba(235,235,245,0.4)]'}`}>
                        {dragOver === adim.adimKey ? 'Bırakın ekleyin' : '+ Dosya ekle'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Notlar */}
            <div>
              <p className="text-xs font-semibold text-[rgba(235,235,245,0.5)] mb-2">Notlar</p>
              <textarea className={`${cls.input} resize-none w-full`} rows={3}
                placeholder="Bu dönem için notlar..."
                value={notVal} onChange={e => { setNotVal(e.target.value); setNotDirty(true) }} />
              {notDirty && (
                <button onClick={saveNot} className={`${cls.btnPrimary} mt-2 text-xs`}>Kaydet</button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Proje Modal ──────────────────────────────────────────────────────── */}
      {projeModal && (
        <Modal title={projeModal.id ? 'Proje Düzenle' : 'Yeni Proje'} onClose={() => setProjeModal(null)} size="md"
          footer={<><button onClick={() => setProjeModal(null)} className={cls.btnSecondary}>İptal</button><button onClick={saveProje} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Proje Adı" required>
                <input className={cls.input} value={projeModal.ad || ''} onChange={e => setProjeModal(p => ({ ...p, ad: e.target.value }))} autoFocus />
              </Field>
              <Field label="Proje Kodu">
                <input className={cls.input} placeholder="PRJ-001" value={projeModal.kod || ''} onChange={e => setProjeModal(p => ({ ...p, kod: e.target.value }))} />
              </Field>
            </div>
            <Field label="Müşteri">
              <select className={cls.input} value={projeModal.musteri_id || ''} onChange={e => setProjeModal(p => ({ ...p, musteri_id: e.target.value || null }))}>
                <option value="">— Müşteri seçin —</option>
                {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Başlangıç Tarihi">
                <input type="date" className={cls.input} value={projeModal.baslangic_tarihi || ''} onChange={e => setProjeModal(p => ({ ...p, baslangic_tarihi: e.target.value || null }))} />
              </Field>
              <Field label="Bitiş Tarihi">
                <input type="date" className={cls.input} value={projeModal.bitis_tarihi || ''} onChange={e => setProjeModal(p => ({ ...p, bitis_tarihi: e.target.value || null }))} />
              </Field>
            </div>
            <Field label="Durum">
              <select className={cls.input} value={projeModal.durum || 'aktif'} onChange={e => setProjeModal(p => ({ ...p, durum: e.target.value as Proje['durum'] }))}>
                <option value="aktif">Aktif</option>
                <option value="beklemede">Beklemede</option>
                <option value="tamamlandi">Tamamlandı</option>
                <option value="iptal">İptal</option>
              </select>
            </Field>
            <Field label="Notlar">
              <textarea className={`${cls.input} resize-none`} rows={2} value={projeModal.notlar || ''} onChange={e => setProjeModal(p => ({ ...p, notlar: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {/* ── Ekip Modal ───────────────────────────────────────────────────────── */}
      {ekipModal && selProje && (
        <Modal title={ekipModal.id ? 'Ekip Düzenle' : `${selProje.ad} — Yeni Ekip`} onClose={() => setEkipModal(null)} size="sm"
          footer={<><button onClick={() => setEkipModal(null)} className={cls.btnSecondary}>İptal</button><button onClick={saveEkip} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-4">
            <Field label="Ekip Adı" required>
              <input className={cls.input} placeholder="Örn: A Ekibi, Şantiye 1" value={ekipModal.ad || ''} onChange={e => setEkipModal(p => ({ ...p, ad: e.target.value }))} autoFocus />
            </Field>
            <Field label="Sorumlu">
              <input className={cls.input} placeholder="Ekip sorumlusu adı" value={ekipModal.sorumlu || ''} onChange={e => setEkipModal(p => ({ ...p, sorumlu: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {/* ── Dönem Modal ──────────────────────────────────────────────────────── */}
      {surecModal && selProje && (
        <Modal title={`${selProje.ad}${selEkip ? ` · ${selEkip.ad}` : ''} — Yeni Dönem`} onClose={() => setSurecModal(false)} size="sm"
          footer={<><button onClick={() => setSurecModal(false)} className={cls.btnSecondary}>İptal</button><button onClick={createSurec} disabled={saving} className={cls.btnPrimary}>{saving ? 'Oluşturuluyor...' : 'Oluştur'}</button></>}>
          <Field label="Dönem">
            <input type="month" className={cls.input} value={newDonem} onChange={e => setNewDonem(e.target.value)} />
          </Field>
        </Modal>
      )}

      {/* ── Silme Onayları ───────────────────────────────────────────────────── */}
      {deletingProje && (
        <ConfirmModal title="Projeyi Sil" message={`"${deletingProje.ad}" projesi ve tüm bordro süreçleri silinecek.`} danger onConfirm={deleteProje} onCancel={() => setDeletingProje(null)} />
      )}
      {deletingEkip && (
        <ConfirmModal title="Ekibi Sil" message={`"${deletingEkip.ad}" ekibi silinecek.`} danger onConfirm={deleteEkip} onCancel={() => setDeletingEkip(null)} />
      )}

      {/* ── Açıklama Modal ───────────────────────────────────────────────────── */}
      {aciklamaModal && (
        <Modal title={`${aciklamaModal.adim.label} — Açıklama`} onClose={() => setAciklamaModal(null)} size="sm"
          footer={<><button onClick={() => setAciklamaModal(null)} className={cls.btnSecondary}>İptal</button><button onClick={() => saveAciklama(aciklamaModal.adim, aciklamaModal.value)} className={cls.btnPrimary}>Kaydet</button></>}>
          <textarea className={`${cls.input} resize-none`} rows={4} placeholder="Bu adım için açıklama girin..." autoFocus
            value={aciklamaModal.value}
            onChange={e => setAciklamaModal(p => p ? { ...p, value: e.target.value } : p)} />
        </Modal>
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
