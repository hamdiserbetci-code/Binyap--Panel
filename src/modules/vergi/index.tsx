'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  FileCheck, Plus, Pencil, Trash2, Search, RefreshCw,
  CheckCircle2, Clock, AlertCircle, Receipt, BookOpen,
  ChevronRight, FileText, Upload, CheckCheck, Send, BadgeCheck,
  ArrowRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, Modal, Field, Loading, ConfirmModal } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { VergiBeyanname, VergiTip, BeyannameDurum, Sirket, KullaniciProfil } from '@/types'

// ── Beyanname sabit değerleri ─────────────────────────────────────────────────
const TIP_LABEL: Record<VergiTip, string> = {
  kdv: 'KDV 1', kdv2: 'KDV 2', muhsgk: 'MuhSGK',
  gecici_vergi: 'Geçici Vergi', kurumlar_vergisi: 'Kurumlar Vergisi'
}
const DURUM_LABEL: Record<BeyannameDurum, string> = {
  bekliyor: 'Bekliyor', hazirlaniyor: 'Hazırlanıyor', kontrolde: 'Kontrolde',
  verildi: 'Verildi', onaylandi: 'Onaylandı', reddedildi: 'Reddedildi', odendi: 'Ödendi'
}
const DURUM_COLORS: Record<BeyannameDurum, string> = {
  bekliyor: 'bg-slate-100 text-slate-600 border-slate-200',
  hazirlaniyor: 'bg-amber-50 text-amber-600 border-amber-200',
  kontrolde: 'bg-blue-50 text-blue-600 border-blue-200',
  verildi: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  onaylandi: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  reddedildi: 'bg-rose-50 text-rose-600 border-rose-200',
  odendi: 'bg-teal-50 text-teal-700 border-teal-200'
}

// ── E-Fatura / E-Arşiv süreç adımları ────────────────────────────────────────
type EFaturaDurum = 'bekliyor' | 'indirildi' | 'kontrol_edildi' | 'luca_aktarildi' | 'tamamlandi'
type EDeferDurum  = 'bekliyor' | 'olusturuldu' | 'imzalandi' | 'gonderildi' | 'onaylandi'

const EFATURA_ADIMLAR: { durum: EFaturaDurum; label: string; icon: React.ElementType }[] = [
  { durum: 'bekliyor',        label: 'Bekliyor',          icon: Clock },
  { durum: 'indirildi',       label: 'İndirildi',         icon: Upload },
  { durum: 'kontrol_edildi',  label: 'Kontrol Edildi',    icon: CheckCircle2 },
  { durum: 'luca_aktarildi',  label: 'Luca\'ya Aktarıldı', icon: FileText },
  { durum: 'tamamlandi',      label: 'Tamamlandı',        icon: CheckCheck },
]
const EDEFTER_ADIMLAR: { durum: EDeferDurum; label: string; icon: React.ElementType }[] = [
  { durum: 'bekliyor',     label: 'Bekliyor',   icon: Clock },
  { durum: 'olusturuldu',  label: 'Oluşturuldu', icon: FileText },
  { durum: 'imzalandi',    label: 'İmzalandı',  icon: CheckCircle2 },
  { durum: 'gonderildi',   label: 'GİB\'e Gönderildi', icon: Send },
  { durum: 'onaylandi',    label: 'GİB Onayladı', icon: BadgeCheck },
]

function stepIndex(adimlar: { durum: string }[], durum: string) {
  return adimlar.findIndex(a => a.durum === durum)
}

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0] }
function getDonemStr(date: Date = new Date()): string {
  const d = new Date(date)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function getSonTarih(tip: VergiTip, donem: string): string {
  const parts = donem.split('-').map(Number)
  const yil = parts[0] || new Date().getFullYear()
  const ay  = parts[1] || 12
  const takipAy  = ay === 12 ? 1 : ay + 1
  const takipYil = ay === 12 ? yil + 1 : yil
  const sonGunMap: Record<VergiTip, number> = {
    kdv: 28, kdv2: 25, muhsgk: 26, gecici_vergi: 17, kurumlar_vergisi: 30
  }
  if (tip === 'kurumlar_vergisi') return `${yil + 1}-04-${sonGunMap[tip]}`
  if (tip === 'gecici_vergi') {
    const ceyrek = Math.ceil(ay / 3)
    const geciciAy = ceyrek * 3
    const sonrakiAy  = geciciAy === 12 ? 1 : geciciAy + 1
    const sonrakiYil = geciciAy === 12 ? yil + 1 : yil
    return `${sonrakiYil}-${String(sonrakiAy).padStart(2, '0')}-${sonGunMap[tip]}`
  }
  return `${takipYil}-${String(takipAy).padStart(2, '0')}-${sonGunMap[tip]}`
}

// ── Bileşen ───────────────────────────────────────────────────────────────────
export default function VergiModule({ firma, firmalar, firmaIds, profil }: AppCtx) {
  const [tab, setTab] = useState<'beyanname' | 'efatura' | 'edefter'>('beyanname')

  // --- Beyanname state ---
  const [beyannameler, setBeyannameler]   = useState<any[]>([])
  const [sirketler, setSirketler]         = useState<Sirket[]>([])
  const [kullanicilar, setKullanicilar]   = useState<KullaniciProfil[]>([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [search, setSearch]               = useState('')
  const [filterTip, setFilterTip]         = useState<VergiTip | 'all'>('all')
  const [filterSirket, setFilterSirket]   = useState<string>('all')
  const [filterDurum, setFilterDurum]     = useState<BeyannameDurum | 'all'>('all')
  const [modal, setModal]                 = useState<Partial<any> | null>(null)
  const [deleteId, setDeleteId]           = useState<string | null>(null)
  const [selFirmaId, setSelFirmaId]       = useState(firma.id)

  // --- Süreç (E-Fatura/E-Arşiv/E-Defter) state ---
  const [surecler, setSurecler]           = useState<any[]>([])
  const [, setSurecLoading]               = useState(false)
  const [surecModal, setSurecModal]       = useState<Partial<any> | null>(null)
  const [surecSaving, setSurecSaving]     = useState(false)
  const [surecDeleteId, setSurecDeleteId] = useState<string | null>(null)
  const [surecDonem, setSurecDonem]       = useState(getDonemStr())
  const [surecSelFirmaId, setSurecSelFirmaId] = useState(firma.id)

  useEffect(() => { loadAll() }, [firmaIds.join(',')])

  async function loadAll() {
    setLoading(true)
    setSurecLoading(true)
    const [bRes, sRes, kRes, srRes] = await Promise.all([
      supabase.from('vergi_beyannameleri').select('*, sirket:sirketler(*)').in('firma_id', firmaIds).order('son_tarih', { ascending: false }),
      supabase.from('sirketler').select('*').in('firma_id', firmaIds).eq('aktif', true),
      supabase.from('kullanici_profilleri').select('*').in('firma_id', firmaIds).eq('aktif', true),
      supabase.from('efatura_surecler').select('*, sirket:sirketler(kod,ad)').in('firma_id', firmaIds).order('donem', { ascending: false }),
    ])
    setBeyannameler(bRes.data || [])
    setSirketler(sRes.data || [])
    setKullanicilar(kRes.data || [])
    setSurecler(srRes.data || [])
    setLoading(false)
    setSurecLoading(false)
  }

  // ── Beyanname fonksiyonları ─────────────────────────────────────────────────
  async function syncIsTakip(fId: string, tip: string, donem: string, durum: string) {
    const isTip = tip === 'muhsgk' ? 'muhtsar_sgk' : tip
    const { data: existing } = await supabase.from('is_takip')
      .select('*').eq('firma_id', fId).eq('tip', isTip).eq('donem', donem).maybeSingle()
    const today = todayStr()
    const updates: any = {}
    if (durum === 'onaylandi') {
      updates.adim1_durum = 'tamamlandi'
      if (!existing?.adim1_tarihi) updates.adim1_tarihi = today
      updates.durum = existing?.adim2_durum === 'tamamlandi' ? 'tamamlandi' : 'aktif'
    } else if (durum === 'odendi') {
      updates.adim1_durum = 'tamamlandi'; if (!existing?.adim1_tarihi) updates.adim1_tarihi = today
      updates.adim2_durum = 'tamamlandi'; if (!existing?.adim2_tarihi) updates.adim2_tarihi = today
      updates.durum = 'tamamlandi'
    } else if (['bekliyor', 'hazirlaniyor', 'kontrolde'].includes(durum)) {
      updates.adim1_durum = 'bekliyor'; updates.adim1_tarihi = null
      updates.adim2_durum = 'bekliyor'; updates.adim2_tarihi = null; updates.durum = 'aktif'
    }
    if (Object.keys(updates).length > 0) {
      if (existing) await supabase.from('is_takip').update(updates).eq('id', existing.id)
      else await supabase.from('is_takip').insert({ firma_id: fId, tip: isTip, donem, ...updates })
    }
  }

  async function saveBeyanname() {
    if (!modal?.tip || !modal?.donem) { alert('Tip ve dönem zorunludur.'); return }
    setSaving(true)
    const sonTarih = modal.son_tarih || getSonTarih(modal.tip as VergiTip, modal.donem)
    const payload = {
      firma_id: modal.id ? (modal.firma_id || firma.id) : selFirmaId,
      sirket_id: modal.sirket_id || null, tip: modal.tip, donem: modal.donem,
      son_tarih: sonTarih, durum: modal.durum || 'bekliyor',
      tahakkuk_tutari: Number(modal.tahakkuk_tutari || 0),
      odenen_tutar: Number(modal.odenen_tutar || 0),
      verilis_tarihi: modal.verilis_tarihi || null,
      beyanname_no: modal.beyanname_no || null, notlar: modal.notlar || null,
      sorumlu_id: modal.sorumlu_id || null,
    }
    if (modal.id) {
      const { error } = await supabase.from('vergi_beyannameleri').update(payload).eq('id', modal.id)
      if (error) { alert(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('vergi_beyannameleri').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
    }
    await syncIsTakip(payload.firma_id, payload.tip, payload.donem, payload.durum)
    setSaving(false); setModal(null); await loadAll()
  }

  async function updateDurum(b: any, yeniDurum: BeyannameDurum) {
    const updates: any = { durum: yeniDurum }
    if (yeniDurum === 'verildi') updates.verilis_tarihi = todayStr()
    await supabase.from('vergi_beyannameleri').update(updates).eq('id', b.id)
    await syncIsTakip(b.firma_id, b.tip, b.donem, yeniDurum)
    await loadAll()
  }

  async function handleDeleteBeyanname() {
    if (!deleteId) return
    await supabase.from('vergi_beyannameleri').delete().eq('id', deleteId)
    setDeleteId(null); await loadAll()
  }

  const filtered = useMemo(() => beyannameler.filter(b => {
    if (filterTip !== 'all' && b.tip !== filterTip) return false
    if (filterSirket !== 'all' && b.sirket_id !== filterSirket) return false
    if (filterDurum !== 'all' && b.durum !== filterDurum) return false
    if (search) {
      const q = search.toLowerCase()
      return (b.donem.includes(q) || (b.notlar || '').toLowerCase().includes(q) || (b.beyanname_no || '').toLowerCase().includes(q))
    }
    return true
  }), [beyannameler, filterTip, filterSirket, filterDurum, search])

  // ── Süreç fonksiyonları ─────────────────────────────────────────────────────
  async function saveSurec() {
    if (!surecModal?.tip || !surecModal?.donem) { alert('Tip ve dönem zorunludur.'); return }
    setSurecSaving(true)
    const payload = {
      firma_id: surecModal.id ? (surecModal.firma_id || firma.id) : surecSelFirmaId,
      sirket_id: surecModal.sirket_id || null,
      tip: surecModal.tip,
      donem: surecModal.donem,
      durum: surecModal.durum || 'bekliyor',
      fatura_sayisi: Number(surecModal.fatura_sayisi || 0),
      tutar: Number(surecModal.tutar || 0),
      notlar: surecModal.notlar || null,
      tamamlandi_at: surecModal.durum === 'tamamlandi' || surecModal.durum === 'onaylandi' ? new Date().toISOString() : null,
    }
    if (surecModal.id) {
      const { error } = await supabase.from('efatura_surecler').update(payload).eq('id', surecModal.id)
      if (error) { alert(error.message); setSurecSaving(false); return }
    } else {
      const { error } = await supabase.from('efatura_surecler').insert(payload)
      if (error) { alert(error.message); setSurecSaving(false); return }
    }
    setSurecSaving(false); setSurecModal(null); await loadAll()
  }

  async function updateSurecDurum(s: any, yeniDurum: string) {
    const updates: any = { durum: yeniDurum }
    if (yeniDurum === 'tamamlandi' || yeniDurum === 'onaylandi') updates.tamamlandi_at = new Date().toISOString()
    await supabase.from('efatura_surecler').update(updates).eq('id', s.id)
    await loadAll()
  }

  async function handleDeleteSurec() {
    if (!surecDeleteId) return
    await supabase.from('efatura_surecler').delete().eq('id', surecDeleteId)
    setSurecDeleteId(null); await loadAll()
  }

  const efaturaFiltered = useMemo(() =>
    surecler.filter(s => (s.tip === 'efatura' || s.tip === 'earsiv') && s.donem === surecDonem),
    [surecler, surecDonem])

  const edeferFiltered = useMemo(() =>
    surecler.filter(s => s.tip === 'edefter' && s.donem === surecDonem),
    [surecler, surecDonem])

  if (loading) return <Loading />

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-slate-50">
              <FileCheck size={18} className="text-slate-700" />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-slate-800">Vergi & Dijital Dönüşüm</h1>
              <p className="text-[12px] text-slate-500">Beyanname, E-Fatura, E-Arşiv, E-Defter süreç takibi</p>
            </div>
          </div>
          <button onClick={loadAll} className={cls.btnSecondary}>
            <RefreshCw size={14} /> Yenile
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-3 shadow-sm">
        {([
          { id: 'beyanname', label: 'Beyannameler',       icon: FileCheck },
          { id: 'efatura',   label: 'E-Fatura / E-Arşiv', icon: Receipt },
          { id: 'edefter',   label: 'E-Defter',            icon: BookOpen },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: BEYANNAMELER
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'beyanname' && (
        <>
          {/* Toolbar */}
          <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 flex flex-wrap gap-3 items-center shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Dönem veya not ara..."
                className="w-full bg-slate-50 border border-blue-100 rounded-xl pl-9 pr-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 transition-all"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={filterSirket} onChange={(e) => setFilterSirket(e.target.value)}
              className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400">
              <option value="all">Tüm Şirketler</option>
              {sirketler.map(s => <option key={s.id} value={s.id}>{s.kod}{firmalar.length > 1 ? ` (${firmalar.find(f => f.id === s.firma_id)?.kisa_ad || ''})` : ''}</option>)}
            </select>
            <select value={filterDurum} onChange={(e) => setFilterDurum(e.target.value as any)}
              className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400">
              <option value="all">Tüm Durumlar</option>
              {Object.entries(DURUM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterTip} onChange={(e) => setFilterTip(e.target.value as any)}
              className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400">
              <option value="all">Tüm Tipler</option>
              {Object.entries(TIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => setModal({ tip: 'kdv', donem: getDonemStr(), durum: 'bekliyor', tahakkuk_tutari: 0, odenen_tutar: 0 })} className={cls.btnPrimary}>
              <Plus size={14} /> Yeni Beyanname
            </button>
          </div>

          {/* Tablo */}
          <div className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-sm">Gösterilecek beyanname bulunamadı.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-blue-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Dönem / Tip</th>
                    <th className="px-4 py-3 font-semibold">Durum</th>
                    <th className="px-4 py-3 font-semibold text-right">Tahakkuk</th>
                    <th className="px-4 py-3 font-semibold text-right">Ödenen</th>
                    <th className="px-4 py-3 font-semibold text-right">Kalan</th>
                    <th className="px-4 py-3 font-semibold">Son Tarih</th>
                    <th className="px-4 py-3 font-semibold text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(b => {
                    const isGecikmis = b.durum !== 'odendi' && b.durum !== 'onaylandi' && new Date(b.son_tarih) < new Date()
                    const kalan = Number(b.tahakkuk_tutari || 0) - Number(b.odenen_tutar || 0)
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{b.donem} — {TIP_LABEL[b.tip as VergiTip]}</div>
                          <div className="text-[11px] text-slate-400">{b.sirket?.kod || 'Şirket Yok'}{firmalar.length > 1 && b.firma_id ? ` (${firmalar.find(f => f.id === b.firma_id)?.kisa_ad || ''})` : ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${DURUM_COLORS[b.durum as BeyannameDurum]}`}>
                            {DURUM_LABEL[b.durum as BeyannameDurum]}
                          </span>
                          {isGecikmis && <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 mt-0.5"><AlertCircle size={10}/>Gecikmiş</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {b.tahakkuk_tutari ? `${Number(b.tahakkuk_tutari).toLocaleString('tr-TR', {minimumFractionDigits:2})} ₺` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {b.odenen_tutar ? `${Number(b.odenen_tutar).toLocaleString('tr-TR', {minimumFractionDigits:2})} ₺` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-rose-600">
                          {kalan > 0 ? `${kalan.toLocaleString('tr-TR', {minimumFractionDigits:2})} ₺` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className={isGecikmis ? 'text-red-400' : 'text-slate-300'} />
                            <span className={isGecikmis ? 'text-red-600 font-semibold text-[13px]' : 'text-[13px] text-slate-600'}>
                              {new Date(b.son_tarih).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {b.durum !== 'hazirlaniyor' && <button onClick={() => updateDurum(b, 'hazirlaniyor')} className="px-2 py-1 text-[10px] font-bold bg-amber-100 text-amber-700 rounded hover:bg-amber-200">Hazırlanıyor</button>}
                            {b.durum !== 'onaylandi'    && <button onClick={() => updateDurum(b, 'onaylandi')}    className="px-2 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">Onaylandı</button>}
                            {b.durum !== 'odendi'       && <button onClick={() => updateDurum(b, 'odendi')}       className="px-2 py-1 text-[10px] font-bold bg-teal-100 text-teal-700 rounded hover:bg-teal-200">Ödendi</button>}
                            <button onClick={() => setModal(b)} className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 ml-1"><Pencil size={12}/></button>
                            <button onClick={() => setDeleteId(b.id)} className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600"><Trash2 size={12}/></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Beyanname Modal */}
          {modal && (
            <Modal title={modal.id ? 'Beyanname Düzenle' : 'Yeni Beyanname'} onClose={() => setModal(null)} size="md"
              footer={
                <>
                  <button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button>
                  <button onClick={saveBeyanname} disabled={saving} className={cls.btnPrimary}>
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
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
                  {sirketler.length > 0 ? (
                    <Field label="Şirket">
                      <select className={cls.input} value={modal.sirket_id || ''} onChange={e => setModal(p => ({ ...p!, sirket_id: e.target.value || undefined }))}>
                        <option value="">Seçiniz</option>
                        {sirketler.filter(s => s.firma_id === (modal.id ? modal.firma_id : selFirmaId)).map(s => <option key={s.id} value={s.id}>{s.kod} - {s.ad}</option>)}
                      </select>
                    </Field>
                  ) : <div />}
                  <Field label="Tip" required>
                    <select className={cls.input} value={modal.tip || ''} onChange={e => setModal(p => ({ ...p!, tip: e.target.value, son_tarih: getSonTarih(e.target.value as VergiTip, p!.donem || getDonemStr()) }))}>
                      <option value="">Seçiniz</option>
                      {Object.entries(TIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Dönem" required>
                    <input type="month" className={cls.input} value={modal.donem || ''} onChange={e => setModal(p => ({ ...p!, donem: e.target.value, son_tarih: getSonTarih(p!.tip as VergiTip || 'kdv', e.target.value) }))} />
                  </Field>
                  <Field label="Son Tarih" required>
                    <input type="date" className={cls.input} value={modal.son_tarih || ''} onChange={e => setModal(p => ({ ...p!, son_tarih: e.target.value }))} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tahakkuk (₺)">
                    <input type="number" step="0.01" className={cls.input} value={modal.tahakkuk_tutari || ''} onChange={e => setModal(p => ({ ...p!, tahakkuk_tutari: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Ödenen (₺)">
                    <input type="number" step="0.01" className={cls.input} value={modal.odenen_tutar || ''} onChange={e => setModal(p => ({ ...p!, odenen_tutar: Number(e.target.value) }))} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Durum" required>
                    <select className={cls.input} value={modal.durum || 'bekliyor'} onChange={e => setModal(p => ({ ...p!, durum: e.target.value }))}>
                      {Object.entries(DURUM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Sorumlu">
                    <select className={cls.input} value={modal.sorumlu_id || ''} onChange={e => setModal(p => ({ ...p!, sorumlu_id: e.target.value || undefined }))}>
                      <option value="">Seçiniz</option>
                      {kullanicilar.filter(k => k.firma_id === (modal.id ? modal.firma_id : selFirmaId)).map(k => <option key={k.id} value={k.id}>{k.ad_soyad || k.email}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Notlar">
                  <textarea className={`${cls.input} resize-none`} rows={2} value={modal.notlar || ''} onChange={e => setModal(p => ({ ...p!, notlar: e.target.value }))} />
                </Field>
              </div>
            </Modal>
          )}
          {deleteId && <ConfirmModal title="Beyannameyi Sil" message="Bu vergi beyannamesi kalıcı olarak silinecektir." danger onConfirm={handleDeleteBeyanname} onCancel={() => setDeleteId(null)} />}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: E-FATURA / E-ARŞİV
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'efatura' && (
        <>
          <SurecTabBar
            donem={surecDonem}
            onDonemChange={setSurecDonem}
            onEkle={() => setSurecModal({ tip: 'efatura', donem: surecDonem, durum: 'bekliyor', fatura_sayisi: 0, tutar: 0 })}
            ekleLabel="Yeni E-Fatura/E-Arşiv Süreci"
          />

          {/* İki sütun: E-Fatura + E-Arşiv */}
          <div className="grid gap-4 lg:grid-cols-2">
            {(['efatura', 'earsiv'] as const).map(tip => {
              const items = efaturaFiltered.filter(s => s.tip === tip)
              const tipLabel = tip === 'efatura' ? 'E-Fatura (Gelen)' : 'E-Arşiv (Giden)'
              const tipColor = tip === 'efatura' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-purple-700 bg-purple-50 border-purple-200'
              return (
                <div key={tip} className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-bold border ${tipColor}`}>
                      <Receipt size={12} /> {tipLabel}
                    </span>
                    <button
                      onClick={() => setSurecModal({ tip, donem: surecDonem, durum: 'bekliyor', fatura_sayisi: 0, tutar: 0 })}
                      className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {items.length === 0 ? (
                    <div className="p-8 text-center text-[13px] text-slate-400">Bu dönem için kayıt yok.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {items.map(s => (
                        <SurecKart
                          key={s.id}
                          surec={s}
                          adimlar={EFATURA_ADIMLAR}
                          firmalar={firmalar}
                          onEdit={() => setSurecModal(s)}
                          onDelete={() => setSurecDeleteId(s.id)}
                          onDurumChange={(d) => updateSurecDurum(s, d)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Süreç özeti */}
          <SurecOzet surecler={efaturaFiltered} adimlar={EFATURA_ADIMLAR} />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: E-DEFTER
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'edefter' && (
        <>
          <SurecTabBar
            donem={surecDonem}
            onDonemChange={setSurecDonem}
            onEkle={() => setSurecModal({ tip: 'edefter', donem: surecDonem, durum: 'bekliyor', fatura_sayisi: 0, tutar: 0 })}
            ekleLabel="Yeni E-Defter Süreci"
          />

          <div className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="flex items-center gap-2 text-[13px] font-bold text-emerald-700">
                <BookOpen size={14} /> E-Defter Süreçleri — {surecDonem}
              </span>
              <span className="text-[12px] text-slate-400">{edeferFiltered.length} kayıt</span>
            </div>
            {edeferFiltered.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-slate-400">
                <BookOpen size={40} className="mx-auto mb-3 text-slate-200" />
                Bu dönem için e-defter kaydı yok.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {edeferFiltered.map(s => (
                  <SurecKart
                    key={s.id}
                    surec={s}
                    adimlar={EDEFTER_ADIMLAR}
                    firmalar={firmalar}
                    onEdit={() => setSurecModal(s)}
                    onDelete={() => setSurecDeleteId(s.id)}
                    onDurumChange={(d) => updateSurecDurum(s, d)}
                  />
                ))}
              </div>
            )}
          </div>

          <SurecOzet surecler={edeferFiltered} adimlar={EDEFTER_ADIMLAR} />
        </>
      )}

      {/* ── Süreç Modal (E-Fatura / E-Arşiv / E-Defter) ─────────────────────── */}
      {surecModal && (
        <Modal
          title={surecModal.id
            ? (surecModal.tip === 'edefter' ? 'E-Defter Düzenle' : surecModal.tip === 'earsiv' ? 'E-Arşiv Düzenle' : 'E-Fatura Düzenle')
            : (surecModal.tip === 'edefter' ? 'Yeni E-Defter Süreci' : surecModal.tip === 'earsiv' ? 'Yeni E-Arşiv Süreci' : 'Yeni E-Fatura Süreci')}
          onClose={() => setSurecModal(null)}
          size="md"
          footer={
            <>
              <button onClick={() => setSurecModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={saveSurec} disabled={surecSaving} className={cls.btnPrimary}>
                {surecSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {!surecModal.id && firmalar.length > 1 && (
              <Field label="Firma">
                <select className={cls.input} value={surecSelFirmaId} onChange={e => setSurecSelFirmaId(e.target.value)}>
                  {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tip" required>
                <select className={cls.input} value={surecModal.tip || ''} onChange={e => setSurecModal(p => ({ ...p!, tip: e.target.value }))}>
                  <option value="efatura">E-Fatura (Gelen)</option>
                  <option value="earsiv">E-Arşiv (Giden)</option>
                  <option value="edefter">E-Defter</option>
                </select>
              </Field>
              <Field label="Dönem" required>
                <input type="month" className={cls.input} value={surecModal.donem || ''} onChange={e => setSurecModal(p => ({ ...p!, donem: e.target.value }))} />
              </Field>
            </div>
            {sirketler.length > 0 && (
              <Field label="Şirket">
                <select className={cls.input} value={surecModal.sirket_id || ''} onChange={e => setSurecModal(p => ({ ...p!, sirket_id: e.target.value || undefined }))}>
                  <option value="">Seçiniz</option>
                  {sirketler.filter(s => s.firma_id === (surecModal.id ? surecModal.firma_id : surecSelFirmaId)).map(s => <option key={s.id} value={s.id}>{s.kod} - {s.ad}</option>)}
                </select>
              </Field>
            )}
            <Field label="Durum" required>
              <select className={cls.input} value={surecModal.durum || 'bekliyor'} onChange={e => setSurecModal(p => ({ ...p!, durum: e.target.value }))}>
                {surecModal.tip === 'edefter'
                  ? EDEFTER_ADIMLAR.map(a => <option key={a.durum} value={a.durum}>{a.label}</option>)
                  : EFATURA_ADIMLAR.map(a => <option key={a.durum} value={a.durum}>{a.label}</option>)
                }
              </select>
            </Field>
            {surecModal.tip !== 'edefter' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fatura Sayısı">
                  <input type="number" className={cls.input} value={surecModal.fatura_sayisi || ''} onChange={e => setSurecModal(p => ({ ...p!, fatura_sayisi: Number(e.target.value) }))} />
                </Field>
                <Field label="Toplam Tutar (₺)">
                  <input type="number" step="0.01" className={cls.input} value={surecModal.tutar || ''} onChange={e => setSurecModal(p => ({ ...p!, tutar: Number(e.target.value) }))} />
                </Field>
              </div>
            )}
            <Field label="Notlar">
              <textarea className={`${cls.input} resize-none`} rows={2} value={surecModal.notlar || ''} onChange={e => setSurecModal(p => ({ ...p!, notlar: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}
      {surecDeleteId && (
        <ConfirmModal title="Süreci Sil" message="Bu süreç kaydı kalıcı olarak silinecektir." danger onConfirm={handleDeleteSurec} onCancel={() => setSurecDeleteId(null)} />
      )}
    </div>
  )
}

// ── Alt bileşenler ─────────────────────────────────────────────────────────────

function SurecTabBar({ donem, onDonemChange, onEkle, ekleLabel }: {
  donem: string; onDonemChange: (d: string) => void; onEkle: () => void; ekleLabel: string
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 flex flex-wrap gap-3 items-center shadow-sm">
      <div className="flex items-center gap-2">
        <label className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">Dönem</label>
        <input type="month" value={donem} onChange={e => onDonemChange(e.target.value)}
          className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400" />
      </div>
      <div className="ml-auto">
        <button onClick={onEkle} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-colors">
          <Plus size={14} /> {ekleLabel}
        </button>
      </div>
    </div>
  )
}

function SurecKart({ surec, adimlar, firmalar, onEdit, onDelete, onDurumChange }: {
  surec: any
  adimlar: { durum: string; label: string; icon: React.ElementType }[]
  firmalar: any[]
  onEdit: () => void
  onDelete: () => void
  onDurumChange: (d: string) => void
}) {
  const currentIdx = stepIndex(adimlar, surec.durum)
  const isCompleted = currentIdx === adimlar.length - 1
  const nextStep = adimlar[currentIdx + 1]

  return (
    <div className="px-5 py-4 group hover:bg-slate-50/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Şirket + firma */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[13px] font-bold text-slate-800">{surec.sirket?.kod || 'Genel'}</span>
            {firmalar.length > 1 && surec.firma_id && (
              <span className="text-[11px] text-slate-400">({firmalar.find(f => f.id === surec.firma_id)?.kisa_ad || ''})</span>
            )}
            {surec.fatura_sayisi > 0 && (
              <span className="text-[11px] text-slate-500 ml-1">{surec.fatura_sayisi} fatura</span>
            )}
            {surec.tutar > 0 && (
              <span className="text-[11px] font-medium text-slate-600">
                {Number(surec.tutar).toLocaleString('tr-TR', {minimumFractionDigits: 2})} ₺
              </span>
            )}
          </div>

          {/* Adım progressi */}
          <div className="flex items-center gap-0.5 flex-wrap">
            {adimlar.map((adim, idx) => {
              const done    = idx <= currentIdx
              const current = idx === currentIdx
              const Icon    = adim.icon
              return (
                <div key={adim.durum} className="flex items-center gap-0.5">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                    done
                      ? current
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Icon size={9} /> {adim.label}
                  </div>
                  {idx < adimlar.length - 1 && (
                    <ArrowRight size={9} className={done && idx < currentIdx ? 'text-emerald-400' : 'text-slate-200'} />
                  )}
                </div>
              )
            })}
          </div>

          {surec.notlar && (
            <p className="text-[11px] text-slate-500 mt-1.5 bg-slate-100 rounded-lg px-2 py-1">{surec.notlar}</p>
          )}
        </div>

        {/* İşlemler */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!isCompleted && nextStep && (
            <button
              onClick={() => onDurumChange(nextStep.durum)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-500 transition-colors whitespace-nowrap"
            >
              <ChevronRight size={11} /> {nextStep.label}
            </button>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-bold">
              <CheckCheck size={11} /> Tamamlandı
            </span>
          )}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600"><Pencil size={11}/></button>
            <button onClick={onDelete} className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600"><Trash2 size={11}/></button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SurecOzet({ surecler, adimlar }: { surecler: any[]; adimlar: { durum: string; label: string }[] }) {
  if (surecler.length === 0) return null
  const lastDurum = adimlar[adimlar.length - 1].durum
  const tamamlandi = surecler.filter(s => s.durum === lastDurum).length
  const devam      = surecler.length - tamamlandi
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Toplam</p>
        <p className="text-[22px] font-bold text-slate-800">{surecler.length}</p>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Devam Ediyor</p>
        <p className="text-[22px] font-bold text-amber-500">{devam}</p>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Tamamlandı</p>
        <p className="text-[22px] font-bold text-emerald-500">{tamamlandi}</p>
      </div>
    </div>
  )
}
