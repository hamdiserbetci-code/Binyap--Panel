'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, Download, FileText, Plus, Trash2, Upload, UserCheck, UserMinus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import { buildCompanyStoragePath } from '@/lib/storagePaths'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GirisCikisRecord {
  id: string; firma_id: string; sirket: string | null
  calisan_adi: string; tc_kimlik: string | null
  islem_turu: 'giris' | 'cikis'; islem_tarihi: string
  bildirim_tarihi: string | null; durum: string; aciklama: string | null
}

interface PrimBildirgeRecord {
  id: string; firma_id: string; sirket: string | null
  yil: number; ay: number; tahakkuk_tutari: number
  son_odeme_tarihi: string | null; odeme_tarihi: string | null
  durum: string; aciklama: string | null
}

interface DocRecord {
  id: string; firma_id: string; dosya_adi: string
  dosya_url: string; dosya_boyutu: number | null
  created_at: string; aciklama: string | null; sirket: string | null
}

interface Props { firma: FirmaRecord; role?: string | null }

type SgkTab = 'giris-cikis' | 'prim-bildirge' | 'hizmet-bildirimi'

// ─── Initial forms ────────────────────────────────────────────────────────────

const gcFormInit = {
  calisan_adi: '', tc_kimlik: '', islem_turu: 'giris',
  islem_tarihi: '', bildirim_tarihi: '', durum: 'taslak', aciklama: ''
}
const primFormInit = {
  yil: new Date().getFullYear(), ay: new Date().getMonth() + 1,
  tahakkuk_tutari: '', son_odeme_tarihi: '', odeme_tarihi: '', durum: 'taslak', aciklama: ''
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AYLAR = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const money = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'
const fileSize = (v?: number | null) => !v ? '-' : v < 1024 * 1024 ? `${(v / 1024).toFixed(1)} KB` : `${(v / (1024 * 1024)).toFixed(1)} MB`
function parseMissingColumn(msg?: string) {
  return (msg || '').match(/'([^']+)' column of/i)?.[1] || null
}
async function safeInsert(table: string, payload: Record<string, unknown>) {
  let working = { ...payload }
  while (true) {
    const res = await supabase.from(table).insert(working)
    if (!res.error) return res
    const col = parseMissingColumn(res.error.message)
    if (!col || !(col in working) || Object.keys(working).length <= 2) return res
    delete working[col]
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'sky' | 'emerald' | 'amber' | 'rose' }) {
  const colors = { sky: '#38BDF8', emerald: '#34D399', amber: '#FCD34D', rose: '#FB7185' }
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
      <p className="text-xs uppercase tracking-[0.24em]" style={{ color: colors[tone] }}>{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SgkModule({ firma, role }: Props) {
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const [tab, setTab] = useState<SgkTab>('giris-cikis')
  const [filterYil, setFilterYil] = useState(new Date().getFullYear())
  const [filterAy, setFilterAy] = useState(0) // 0 = tümü

  // Giriş/Çıkış state
  const [gcRecords, setGcRecords] = useState<GirisCikisRecord[]>([])
  const [gcModal, setGcModal] = useState(false)
  const [gcForm, setGcForm] = useState(gcFormInit)

  // Prim Bildirge state
  const [primRecords, setPrimRecords] = useState<PrimBildirgeRecord[]>([])
  const [primModal, setPrimModal] = useState(false)
  const [primForm, setPrimForm] = useState(primFormInit)

  // Hizmet Bildirimi + dekont state
  const [hizmetDocs, setHizmetDocs] = useState<DocRecord[]>([])
  const [dekontDocs, setDekontDocs] = useState<DocRecord[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)

  const hizmetFileRef = useRef<HTMLInputElement>(null)
  const dekontFileRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchGc = useCallback(async () => {
    if (!sirket) return
    setLoading(true)
    const { data, error } = await supabase.from('sgk_giris_cikis')
      .select('*').eq('firma_id', firma.id)
      .order('islem_tarihi', { ascending: false })
    if (error) { setError(error.message); setLoading(false); return }
    const all = (data || []) as GirisCikisRecord[]
    setGcRecords(all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket))
    setLoading(false)
  }, [firma.id, sirket])

  const fetchPrim = useCallback(async () => {
    if (!sirket) return
    setLoading(true)
    const { data, error } = await supabase.from('sgk_prim_bildirgeleri')
      .select('*').eq('firma_id', firma.id)
      .eq('yil', filterYil)
      .order('ay', { ascending: true })
    if (error) { setError(error.message); setLoading(false); return }
    const all = (data || []) as PrimBildirgeRecord[]
    setPrimRecords(all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket))
    setLoading(false)
  }, [firma.id, sirket, filterYil])

  const fetchHizmet = useCallback(async () => {
    if (!sirket) return
    let q = supabase.from('dokumanlar').select('*').eq('firma_id', firma.id)
      .eq('modul', 'sgk').eq('kategori', 'hizmet_bildirimi')
      .order('created_at', { ascending: false })
    const { data, error } = await q
    if (error) { setError(error.message); return }
    const all = (data || []) as DocRecord[]
    setHizmetDocs(all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket))
  }, [firma.id, sirket])

  const fetchDekont = useCallback(async () => {
    if (!sirket) return
    const { data, error } = await supabase.from('dokumanlar').select('*').eq('firma_id', firma.id)
      .eq('modul', 'sgk').eq('kategori', 'prim_dekont')
      .order('created_at', { ascending: false })
    if (error) { setError(error.message); return }
    const all = (data || []) as DocRecord[]
    setDekontDocs(all.filter(r => sirket === 'ETM' ? (!r.sirket || r.sirket === 'ETM') : r.sirket === sirket))
  }, [firma.id, sirket])

  useEffect(() => { if (tab === 'giris-cikis') fetchGc() }, [fetchGc, tab])
  useEffect(() => { if (tab === 'prim-bildirge') { fetchPrim(); fetchDekont() } }, [fetchPrim, fetchDekont, tab])
  useEffect(() => { if (tab === 'hizmet-bildirimi') fetchHizmet() }, [fetchHizmet, tab])

  // ── Giriş/Çıkış CRUD ──────────────────────────────────────────────────────

  async function saveGc() {
    if (!can(role, 'edit')) return
    if (!gcForm.calisan_adi || !gcForm.islem_tarihi) { setError('Çalışan adı ve işlem tarihi zorunludur.'); return }
    const res = await safeInsert('sgk_giris_cikis', {
      firma_id: firma.id, sirket,
      calisan_adi: gcForm.calisan_adi,
      tc_kimlik: gcForm.tc_kimlik || null,
      islem_turu: gcForm.islem_turu,
      islem_tarihi: gcForm.islem_tarihi,
      bildirim_tarihi: gcForm.bildirim_tarihi || null,
      durum: gcForm.durum,
      aciklama: gcForm.aciklama || null,
    })
    if (res.error) { setError(res.error.message); return }
    await logActivity({ firmaId: firma.id, modul: 'sgk', islemTuru: 'giris_cikis_eklendi', kayitTuru: 'sgk_giris_cikis', aciklama: `${gcForm.islem_turu === 'giris' ? 'İşe giriş' : 'İşten çıkış'} bildirimi eklendi: ${gcForm.calisan_adi}` })
    setGcModal(false)
    setGcForm(gcFormInit)
    fetchGc()
  }

  async function deleteGc(id: string) {
    if (!can(role, 'delete')) return
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('sgk_giris_cikis').delete().eq('id', id)
    if (error) { setError(error.message); return }
    fetchGc()
  }

  async function updateGcDurum(id: string, durum: string) {
    if (!can(role, 'edit')) return
    const { error } = await supabase.from('sgk_giris_cikis').update({ durum }).eq('id', id)
    if (error) { setError(error.message); return }
    fetchGc()
  }

  // ── Prim Bildirge CRUD ────────────────────────────────────────────────────

  async function savePrim() {
    if (!can(role, 'edit')) return
    if (!primForm.tahakkuk_tutari) { setError('Tahakkuk tutarı zorunludur.'); return }
    const res = await safeInsert('sgk_prim_bildirgeleri', {
      firma_id: firma.id, sirket,
      yil: Number(primForm.yil), ay: Number(primForm.ay),
      tahakkuk_tutari: Number(primForm.tahakkuk_tutari),
      son_odeme_tarihi: primForm.son_odeme_tarihi || null,
      odeme_tarihi: primForm.odeme_tarihi || null,
      durum: primForm.durum,
      aciklama: primForm.aciklama || null,
    })
    if (res.error) { setError(res.error.message); return }
    await logActivity({ firmaId: firma.id, modul: 'sgk', islemTuru: 'prim_bildirge_eklendi', kayitTuru: 'sgk_prim_bildirgeleri', aciklama: `${primForm.yil}/${primForm.ay} prim bildirge tahakkuku eklendi.` })
    setPrimModal(false)
    setPrimForm(primFormInit)
    fetchPrim()
  }

  async function deletePrim(id: string) {
    if (!can(role, 'delete')) return
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('sgk_prim_bildirgeleri').delete().eq('id', id)
    if (error) { setError(error.message); return }
    fetchPrim()
  }

  async function updatePrimDurum(id: string, durum: string) {
    if (!can(role, 'edit')) return
    const { error } = await supabase.from('sgk_prim_bildirgeleri').update({ durum }).eq('id', id)
    if (error) { setError(error.message); return }
    fetchPrim()
  }

  // ── File upload ───────────────────────────────────────────────────────────

  async function uploadFile(file: File, kategori: 'hizmet_bildirimi' | 'prim_dekont', aciklama?: string) {
    if (!can(role, 'edit')) return
    if (file.size > 15 * 1024 * 1024) { setError('Dosya boyutu 15MB üzerinde olamaz.'); return }
    setUploading(kategori)
    const filePath = buildCompanyStoragePath({ firmaId: firma.id, modul: 'sgk', category: kategori, fileName: file.name })
    const { error: upErr } = await supabase.storage.from('dokumanlar').upload(filePath, file, { contentType: file.type })
    if (upErr) { setError(upErr.message); setUploading(null); return }
    const payload: Record<string, unknown> = {
      firma_id: firma.id, sirket, modul: 'sgk', kategori,
      dosya_adi: file.name, dosya_url: filePath,
      mime_type: file.type, dosya_boyutu: file.size,
      aciklama: aciklama || null,
    }
    const res = await safeInsert('dokumanlar', payload)
    if (res.error) { setError(res.error.message); setUploading(null); return }
    await logActivity({ firmaId: firma.id, modul: 'sgk', islemTuru: 'dokuman_yuklendi', kayitTuru: 'dokuman', aciklama: `${file.name} (${kategori}) yüklendi.` })
    setUploading(null)
    if (kategori === 'hizmet_bildirimi') fetchHizmet()
    else fetchDekont()
  }

  async function downloadDoc(doc: DocRecord) {
    const { data, error } = await supabase.storage.from('dokumanlar').createSignedUrl(doc.dosya_url, 60)
    if (error) { setError(error.message); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteDoc(doc: DocRecord, kategori: 'hizmet_bildirimi' | 'prim_dekont') {
    if (!can(role, 'delete')) return
    if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return
    await supabase.storage.from('dokumanlar').remove([doc.dosya_url])
    const { error } = await supabase.from('dokumanlar').delete().eq('id', doc.id)
    if (error) { setError(error.message); return }
    if (kategori === 'hizmet_bildirimi') fetchHizmet()
    else fetchDekont()
  }

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filteredGc = gcRecords.filter(r => {
    if (!r.islem_tarihi) return true
    const d = new Date(r.islem_tarihi)
    if (d.getFullYear() !== filterYil) return false
    if (filterAy > 0 && (d.getMonth() + 1) !== filterAy) return false
    return true
  })

  const primTotals = {
    tahakkuk: primRecords.reduce((s, r) => s + Number(r.tahakkuk_tutari || 0), 0),
    odendi: primRecords.filter(r => r.durum === 'odendi').length,
    bekleyen: primRecords.filter(r => r.durum !== 'odendi').length,
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  // ── Company Selection Screen ──────────────────────────────────────────────

  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">SGK Bildirimleri</h2>
          <p className="text-slate-400 text-sm">İşlem yapmak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex gap-6 flex-wrap justify-center">
          <button onClick={() => setSirket('ETM')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">E</div>
            <h3 className="text-xl font-bold text-slate-100">ETM A.Ş.</h3>
            <p className="mt-2 text-xs text-slate-400">Merkez Firma SGK</p>
          </button>
          <button onClick={() => setSirket('BİNYAPI')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">B</div>
            <h3 className="text-xl font-bold text-slate-100">BİNYAPI</h3>
            <p className="mt-2 text-xs text-slate-400">Binyapı Firma SGK</p>
          </button>
        </div>
      </div>
    )
  }

  // ── Main View ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button onClick={() => setSirket(null)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={16} /> Firmalara Dön
        </button>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white text-xs font-bold">{sirket === 'ETM' ? 'E' : 'B'}</div>
          <p className="text-sm font-bold text-white">{sirket === 'ETM' ? 'ETM A.Ş.' : 'BİNYAPI'} — SGK Bildirimleri</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={filterYil} onChange={e => setFilterYil(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y} className="text-slate-900">{y}</option>)}
        </select>
        <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none" value={filterAy} onChange={e => setFilterAy(Number(e.target.value))}>
          <option value={0} className="text-slate-900">Tüm Aylar</option>
          {AYLAR.slice(1).map((a, i) => <option key={i + 1} value={i + 1} className="text-slate-900">{a}</option>)}
        </select>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 p-1 rounded-2xl border border-white/10 bg-white/[0.02] w-fit">
        {([
          { id: 'giris-cikis', label: 'Giriş / Çıkış Bildirimleri', icon: UserCheck },
          { id: 'prim-bildirge', label: 'Prim Bildirgeleri', icon: FileText },
          { id: 'hizmet-bildirimi', label: 'Hizmet Bildirimleri', icon: FileText },
        ] as { id: SgkTab; label: string; icon: typeof UserCheck }[]).map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={active ? { background: 'rgba(91,159,255,0.15)', color: '#5B9FFF' } : { color: '#9AA0A6' }}>
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {/* ══ TAB: GİRİŞ / ÇIKIŞ ══════════════════════════════════════════════ */}
      {tab === 'giris-cikis' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Toplam Bildirim" value={String(filteredGc.length)} tone="sky" />
            <MetricCard label="İşe Giriş" value={String(filteredGc.filter(r => r.islem_turu === 'giris').length)} tone="emerald" />
            <MetricCard label="İşten Çıkış" value={String(filteredGc.filter(r => r.islem_turu === 'cikis').length)} tone="rose" />
          </div>

          <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/80">SGK Personel Bildirimleri</p>
                <h3 className="mt-2 text-xl font-bold text-white">İşçi Giriş / Çıkış Bildirimleri</h3>
                <p className="mt-1 text-sm text-slate-400">SGK'ya yapılan işe giriş ve işten çıkış bildirimleri.</p>
              </div>
              {can(role, 'edit') && (
                <button onClick={() => { setGcForm(gcFormInit); setError(''); setGcModal(true) }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                  <Plus size={16} /> Yeni Bildirim
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Yükleniyor...</p>
            ) : filteredGc.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
                <UserCheck size={30} className="mx-auto text-slate-500 mb-3" />
                <p className="text-sm text-slate-400">Bu filtre için kayıt bulunamadı.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGc.map(r => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${r.islem_turu === 'giris' ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                        {r.islem_turu === 'giris'
                          ? <UserCheck size={16} className="text-emerald-400" />
                          : <UserMinus size={16} className="text-rose-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{r.calisan_adi}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          TC: {r.tc_kimlik || '-'} · {r.islem_turu === 'giris' ? 'İşe Giriş' : 'İşten Çıkış'}: {r.islem_tarihi}
                        </p>
                        {r.bildirim_tarihi && <p className="text-[11px] text-slate-500 mt-0.5">SGK Bildirim: {r.bildirim_tarihi}</p>}
                        {r.aciklama && <p className="text-[11px] text-slate-500 mt-0.5">{r.aciklama}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {can(role, 'edit') && (
                        <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none"
                          value={r.durum} onChange={e => updateGcDurum(r.id, e.target.value)}>
                          <option value="taslak">Taslak</option>
                          <option value="bildirildi">Bildirildi</option>
                        </select>
                      )}
                      {can(role, 'delete') && (
                        <button onClick={() => deleteGc(r.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20">
                          <Trash2 size={14} /> Sil
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: PRİM BİLDİRGELERİ ══════════════════════════════════════════ */}
      {tab === 'prim-bildirge' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Toplam Tahakkuk" value={money(primTotals.tahakkuk)} tone="sky" />
            <MetricCard label="Ödenen" value={String(primTotals.odendi)} tone="emerald" />
            <MetricCard label="Bekleyen" value={String(primTotals.bekleyen)} tone="amber" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            {/* Sol: Tahakkuklar */}
            <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/80">Aylık Prim Bildirgeleri</p>
                  <h3 className="mt-2 text-xl font-bold text-white">Tahakkuk ve Ödemeler</h3>
                </div>
                {can(role, 'edit') && (
                  <button onClick={() => { setPrimForm({ ...primFormInit, yil: filterYil }); setError(''); setPrimModal(true) }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                    <Plus size={16} /> Yeni Tahakkuk
                  </button>
                )}
              </div>

              {loading ? (
                <p className="text-sm text-slate-500">Yükleniyor...</p>
              ) : primRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
                  <FileText size={30} className="mx-auto text-slate-500 mb-3" />
                  <p className="text-sm text-slate-400">{filterYil} yılı için prim bildirge kaydı yok.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {primRecords.filter(r => filterAy === 0 || r.ay === filterAy).map(r => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{AYLAR[r.ay]} {r.yil}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Tahakkuk: <span className="text-white font-medium">{money(r.tahakkuk_tutari)}</span></p>
                        {r.son_odeme_tarihi && <p className="text-[11px] text-slate-500 mt-0.5">Son Ödeme: {r.son_odeme_tarihi}</p>}
                        {r.odeme_tarihi && <p className="text-[11px] text-emerald-400 mt-0.5">Ödendi: {r.odeme_tarihi}</p>}
                        {r.aciklama && <p className="text-[11px] text-slate-500 mt-0.5">{r.aciklama}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {can(role, 'edit') && (
                          <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none"
                            value={r.durum} onChange={e => updatePrimDurum(r.id, e.target.value)}>
                            <option value="taslak">Taslak</option>
                            <option value="tahakkuk_edildi">Tahakkuk Edildi</option>
                            <option value="odendi">Ödendi</option>
                          </select>
                        )}
                        {can(role, 'delete') && (
                          <button onClick={() => deletePrim(r.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20">
                            <Trash2 size={14} /> Sil
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sağ: Ödeme Dekontları */}
            <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/80">Ödeme Dekontları</p>
                  <h3 className="mt-2 text-xl font-bold text-white">Dekont Arşivi</h3>
                </div>
                {can(role, 'edit') && (
                  <>
                    <button onClick={() => dekontFileRef.current?.click()} disabled={uploading === 'prim_dekont'}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50">
                      <Upload size={16} /> {uploading === 'prim_dekont' ? 'Yükleniyor...' : 'Dekont Yükle'}
                    </button>
                    <input ref={dekontFileRef} type="file" className="hidden" accept=".pdf,image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'prim_dekont', `${filterYil}-${String(filterAy || new Date().getMonth() + 1).padStart(2, '0')} dekont`); e.target.value = '' }} />
                  </>
                )}
              </div>

              {dekontDocs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
                  <Upload size={24} className="mx-auto text-slate-500 mb-2" />
                  <p className="text-sm text-slate-400">Henüz dekont yüklenmedi.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dekontDocs.map(doc => (
                    <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4">
                      <div>
                        <p className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{doc.dosya_adi}</p>
                        {doc.aciklama && <p className="text-xs text-slate-400 mt-0.5">{doc.aciklama}</p>}
                        <p className="text-[11px] text-slate-500 mt-0.5">{doc.created_at?.split('T')[0]} · {fileSize(doc.dosya_boyutu)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => downloadDoc(doc)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10">
                          <Download size={14} /> İndir
                        </button>
                        {can(role, 'delete') && (
                          <button onClick={() => deleteDoc(doc, 'prim_dekont')} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20">
                            <X size={14} /> Sil
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: HİZMET BİLDİRİMLERİ ════════════════════════════════════════ */}
      {tab === 'hizmet-bildirimi' && (
        <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400/80">SGK Aylık Hizmet Belgeleri</p>
              <h3 className="mt-2 text-xl font-bold text-white">Aylık Hizmet Bildirimleri</h3>
              <p className="mt-1 text-sm text-slate-400">SGK'ya iletilen aylık hizmet belgelerinin PDF arşivi.</p>
            </div>
            {can(role, 'edit') && (
              <>
                <button onClick={() => hizmetFileRef.current?.click()} disabled={uploading === 'hizmet_bildirimi'}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  <Upload size={16} /> {uploading === 'hizmet_bildirimi' ? 'Yükleniyor...' : 'PDF Yükle'}
                </button>
                <input ref={hizmetFileRef} type="file" className="hidden" accept=".pdf"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) {
                      const ay = filterAy > 0 ? AYLAR[filterAy] : AYLAR[new Date().getMonth() + 1]
                      uploadFile(f, 'hizmet_bildirimi', `${filterYil} ${ay} Hizmet Bildirimi`)
                    }
                    e.target.value = ''
                  }} />
              </>
            )}
          </div>

          {hizmetDocs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
              <FileText size={36} className="mx-auto text-slate-500 mb-3" />
              <p className="text-sm text-slate-400">Henüz hizmet bildirimi yüklenmedi.</p>
              <p className="text-xs text-slate-500 mt-1">PDF formatında dosya yükleyebilirsiniz.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {hizmetDocs.map(doc => (
                <div key={doc.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{doc.dosya_adi}</p>
                      {doc.aciklama && <p className="text-xs text-slate-400 mt-0.5">{doc.aciklama}</p>}
                      <p className="text-[11px] text-slate-500 mt-0.5">{doc.created_at?.split('T')[0]} · {fileSize(doc.dosya_boyutu)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                    <button onClick={() => downloadDoc(doc)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10">
                      <Download size={14} /> İndir
                    </button>
                    {can(role, 'delete') && (
                      <button onClick={() => deleteDoc(doc, 'hizmet_bildirimi')} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20">
                        <X size={14} /> Sil
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL: Giriş/Çıkış Ekle ══════════════════════════════════════════ */}
      {gcModal && can(role, 'edit') && (
        <Modal title="Yeni Giriş / Çıkış Bildirimi" onClose={() => setGcModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setGcModal(false)}>İptal</button><button className={btnPrimary} onClick={saveGc}>Kaydet</button></>}>
          <div className="space-y-4">
            <FormField label="Çalışan Adı Soyadı" required>
              <input className={inputCls} placeholder="Ad Soyad" value={gcForm.calisan_adi}
                onChange={e => setGcForm(p => ({ ...p, calisan_adi: e.target.value }))} />
            </FormField>
            <FormField label="TC Kimlik No">
              <input className={inputCls} placeholder="11 haneli TC No" maxLength={11} value={gcForm.tc_kimlik}
                onChange={e => setGcForm(p => ({ ...p, tc_kimlik: e.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="İşlem Türü" required>
                <select className={inputCls} value={gcForm.islem_turu}
                  onChange={e => setGcForm(p => ({ ...p, islem_turu: e.target.value }))}>
                  <option value="giris">İşe Giriş</option>
                  <option value="cikis">İşten Çıkış</option>
                </select>
              </FormField>
              <FormField label="Durum">
                <select className={inputCls} value={gcForm.durum}
                  onChange={e => setGcForm(p => ({ ...p, durum: e.target.value }))}>
                  <option value="taslak">Taslak</option>
                  <option value="bildirildi">Bildirildi</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="İşlem Tarihi" required>
                <input type="date" className={inputCls} value={gcForm.islem_tarihi}
                  onChange={e => setGcForm(p => ({ ...p, islem_tarihi: e.target.value }))} />
              </FormField>
              <FormField label="SGK Bildirim Tarihi">
                <input type="date" className={inputCls} value={gcForm.bildirim_tarihi}
                  onChange={e => setGcForm(p => ({ ...p, bildirim_tarihi: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Açıklama">
              <textarea className={`${inputCls} resize-none`} rows={2} value={gcForm.aciklama}
                onChange={e => setGcForm(p => ({ ...p, aciklama: e.target.value }))} />
            </FormField>
          </div>
        </Modal>
      )}

      {/* ══ MODAL: Prim Bildirge Ekle ════════════════════════════════════════ */}
      {primModal && can(role, 'edit') && (
        <Modal title="Yeni Prim Bildirge Tahakkuku" onClose={() => setPrimModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setPrimModal(false)}>İptal</button><button className={btnPrimary} onClick={savePrim}>Kaydet</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Yıl" required>
                <select className={inputCls} value={primForm.yil}
                  onChange={e => setPrimForm(p => ({ ...p, yil: Number(e.target.value) }))}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </FormField>
              <FormField label="Ay" required>
                <select className={inputCls} value={primForm.ay}
                  onChange={e => setPrimForm(p => ({ ...p, ay: Number(e.target.value) }))}>
                  {AYLAR.slice(1).map((a, i) => <option key={i + 1} value={i + 1}>{a}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Tahakkuk Tutarı (₺)" required>
              <input type="number" className={inputCls} placeholder="0.00" value={primForm.tahakkuk_tutari}
                onChange={e => setPrimForm(p => ({ ...p, tahakkuk_tutari: e.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Son Ödeme Tarihi">
                <input type="date" className={inputCls} value={primForm.son_odeme_tarihi}
                  onChange={e => setPrimForm(p => ({ ...p, son_odeme_tarihi: e.target.value }))} />
              </FormField>
              <FormField label="Ödeme Tarihi">
                <input type="date" className={inputCls} value={primForm.odeme_tarihi}
                  onChange={e => setPrimForm(p => ({ ...p, odeme_tarihi: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Durum">
              <select className={inputCls} value={primForm.durum}
                onChange={e => setPrimForm(p => ({ ...p, durum: e.target.value }))}>
                <option value="taslak">Taslak</option>
                <option value="tahakkuk_edildi">Tahakkuk Edildi</option>
                <option value="odendi">Ödendi</option>
              </select>
            </FormField>
            <FormField label="Açıklama">
              <textarea className={`${inputCls} resize-none`} rows={2} value={primForm.aciklama}
                onChange={e => setPrimForm(p => ({ ...p, aciklama: e.target.value }))} />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
