'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Download, FileSpreadsheet, Layers, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

interface Props { firma: FirmaRecord; role?: string | null }

// ── Modül tanımları ──────────────────────────────────────────────────────────

const MODULLER = [
  { id: 'projeler',    label: 'Projeler',         icon: '📁', renk: 'blue',    aciklama: 'Tüm proje kayıtları, bütçe ve durum bilgileri' },
  { id: 'gelir',       label: 'Gelir Kayıtları',  icon: '📈', renk: 'emerald', aciklama: 'Fatura, hakediş ve diğer gelir kalemleri' },
  { id: 'gider',       label: 'Gider Kayıtları',  icon: '📉', renk: 'rose',    aciklama: 'Malzeme, işçilik ve tüm gider kalemleri' },
  { id: 'cari',        label: 'Cari Hesaplar',    icon: '🤝', renk: 'cyan',    aciklama: 'Satış/alış faturaları, tahsilat ve ödemeler' },
  { id: 'kasa',        label: 'Kasa Hareketleri', icon: '💰', renk: 'amber',   aciklama: 'Nakit giriş/çıkış ve fon hareketleri' },
  { id: 'puantaj',     label: 'Puantaj',           icon: '🕐', renk: 'violet',  aciklama: 'Çalışan devam, mesai ve yevmiye kayıtları' },
  { id: 'sgk',         label: 'SGK Bildirimleri', icon: '🛡️', renk: 'sky',     aciklama: 'Prim bildirge ve giriş/çıkış bildirimleri' },
  { id: 'vergi',       label: 'Vergi Süreçleri',  icon: '📋', renk: 'orange',  aciklama: 'KDV, muhtasar, gecici vergi beyanları' },
] as const

type ModulId = typeof MODULLER[number]['id']

const RENK_MAP: Record<string, { border: string; bg: string; text: string; btn: string }> = {
  blue:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    text: 'text-blue-400',    btn: 'bg-blue-600 hover:bg-blue-700' },
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  rose:    { border: 'border-rose-500/20',    bg: 'bg-rose-500/5',    text: 'text-rose-400',    btn: 'bg-rose-600 hover:bg-rose-700' },
  cyan:    { border: 'border-cyan-500/20',    bg: 'bg-cyan-500/5',    text: 'text-cyan-400',    btn: 'bg-cyan-600 hover:bg-cyan-700' },
  amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   btn: 'bg-amber-600 hover:bg-amber-700' },
  violet:  { border: 'border-violet-500/20',  bg: 'bg-violet-500/5',  text: 'text-violet-400',  btn: 'bg-violet-600 hover:bg-violet-700' },
  sky:     { border: 'border-sky-500/20',     bg: 'bg-sky-500/5',     text: 'text-sky-400',     btn: 'bg-sky-600 hover:bg-sky-700' },
  orange:  { border: 'border-orange-500/20',  bg: 'bg-orange-500/5',  text: 'text-orange-400',  btn: 'bg-orange-600 hover:bg-orange-700' },
}

// ── Excel yardımcıları ───────────────────────────────────────────────────────

function styledSheet(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return XLSX.utils.json_to_sheet([{ Bilgi: 'Bu dönemde kayıt bulunamadı.' }])
  const ws = XLSX.utils.json_to_sheet(rows)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cell]) ws[cell].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center' } }
  }
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }))
  return ws
}

function saveWorkbook(wb: ReturnType<typeof XLSX.utils.book_new>, name: string) {
  XLSX.writeFile(wb, name)
}

// ── Data fetchers ────────────────────────────────────────────────────────────

async function fetchModulRows(
  id: ModulId,
  firmaId: string,
  sirket: 'ETM' | 'BİNYAPI',
  projects: ProjectRecord[],
  projectId: string
): Promise<Record<string, unknown>[]> {
  const isEtm = (s: string | null | undefined) => !s || s === 'ETM'
  const matchSirket = (s: string | null | undefined) => sirket === 'ETM' ? isEtm(s) : s === sirket
  const projLabel = (pid: string | null | undefined) => projects.find(p => p.id === pid)?.ad || 'Genel'

  if (id === 'projeler') {
    let q = supabase.from('projeler').select('*').eq('firma_id', firmaId).order('ad')
    if (projectId) q = q.eq('id', projectId)
    const { data } = await q
    return ((data || []) as any[])
      .filter(r => matchSirket(r.sirket))
      .map(r => ({ Kod: r.kod || '', Proje: r.ad, Durum: r.durum, Şirket: r.sirket || 'ETM', Başlangıç: r.baslangic_tarihi || '', Bitiş: r.bitis_tarihi || '', 'Bütçe (₺)': Number(r.butce || 0), Lokasyon: r.lokasyon || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'gelir') {
    let q = supabase.from('gelir_kayitlari').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    const { data } = await q
    return ((data || []) as any[])
      .filter(r => matchSirket(r.sirket))
      .map(r => ({ Proje: projLabel(r.proje_id), 'Cari Ünvan': r.cari_unvan || '', Tarih: r.tarih || '', 'Kayıt Türü': r.kayit_turu || '', 'Evrak No': r.evrak_no || '', 'Tutar (₺)': Number(r.tutar || 0), 'Tahsilat Durumu': r.tahsilat_durumu || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'gider') {
    let q = supabase.from('gider_kayitlari').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    const { data } = await q
    return ((data || []) as any[])
      .filter(r => matchSirket(r.sirket))
      .map(r => ({ Proje: projLabel(r.proje_id), Tedarikçi: r.tedarikci || '', Tarih: r.tarih || '', Kategori: r.kategori || '', 'Belge No': r.belge_no || '', 'Tutar (₺)': Number(r.tutar || 0), 'Ödeme Durumu': r.odeme_durumu || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'cari') {
    const hesaplarRes = await supabase.from('cari_hesaplar').select('id, Reklam, sirket').eq('firma_id', firmaId)
    const hareketlerRes = await supabase.from('cari_hareketler').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    const hesapMap = new Map(((hesaplarRes.data || []) as any[]).map(c => [c.id, c]))
    return ((hareketlerRes.data || []) as any[])
      .filter(r => { const h = hesapMap.get(r.cari_hesap_id) as any; return matchSirket(h?.sirket) })
      .map(r => {
        const h = hesapMap.get(r.cari_hesap_id) as any
        return { 'Cari Adı': h?.Reklam || '—', Şirket: h?.sirket || 'ETM', Tarih: r.tarih || '', 'Hareket Türü': r.hareket_turu || '', 'Belge No': r.belge_no || '', 'Tutar (₺)': Number(r.tutar || 0), 'Vade Tarihi': r.vade_tarihi || '', 'Çek No': r.cek_no || '', 'Çek Banka': r.cek_banka || '', Durum: r.durum || '', Açıklama: r.aciklama || '' }
      })
  }

  if (id === 'kasa') {
    let q = supabase.from('kasa_hareketleri').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    const { data } = await q
    return ((data || []) as any[])
      .filter(r => matchSirket(r.sirket))
      .map(r => ({ Proje: projLabel(r.proje_id), Kanal: r.kanal || '', 'Hareket Türü': r.hareket_turu || '', Tarih: r.tarih || '', 'Tutar (₺)': Number(r.tutar || 0), 'Fiş No': r.fis_no || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'puantaj') {
    let q = supabase.from('puantaj_kayitlari').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    const { data } = await q
    return ((data || []) as any[])
      .filter(r => matchSirket(r.sirket))
      .map(r => ({ Proje: projLabel(r.proje_id), 'Çalışan': r.calisan_id || '', Tarih: r.tarih || '', Durum: r.durum || '', 'Mesai (saat)': Number(r.mesai_saati || 0), 'Yevmiye (₺)': Number(r.yevmiye || 0), Açıklama: r.aciklama || '' }))
  }

  if (id === 'sgk') {
    const { data } = await supabase.from('sgk_prim_bildirgeleri').select('*').eq('firma_id', firmaId).order('yil', { ascending: false }).order('ay', { ascending: false })
    return ((data || []) as any[])
      .filter(r => matchSirket(r.sirket))
      .map(r => ({ Şirket: r.sirket || 'ETM', Yıl: r.yil, Ay: r.ay, 'Tahakkuk (₺)': Number(r.tahakkuk_tutari || 0), 'Son Ödeme': r.son_odeme_tarihi || '', 'Ödeme Tarihi': r.odeme_tarihi || '', Durum: r.durum || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'vergi') {
    let q = supabase.from('vergi_surecleri').select('*').eq('firma_id', firmaId).order('yil', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    const { data } = await q
    return ((data || []) as any[])
      .filter(r => matchSirket(r.sirket))
      .map(r => ({ Proje: projLabel(r.proje_id), 'Süreç': r.surec_turu || '', Yıl: r.yil, Ay: r.ay || '', Dönem: r.donem || '', 'Son Tarih': r.son_tarih || '', 'Beyan Tarihi': r.beyan_tarihi || '', 'Tutar (₺)': Number(r.tutar || 0), Durum: r.durum || '', Sorumlu: r.sorumlu || '' }))
  }

  return []
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function ReportsModule({ firma, role }: Props) {
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [projectId, setProjectId] = useState('')
  const [loadingId, setLoadingId] = useState<ModulId | 'tamami' | null>(null)
  const [error, setError] = useState('')

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('projeler').select('id, ad, sirket').eq('firma_id', firma.id).order('ad')
    setProjects((data as ProjectRecord[]) || [])
  }, [firma.id])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const sirketProjeleri = projects.filter(p =>
    sirket === 'ETM' ? (!p.sirket || p.sirket === 'ETM') : p.sirket === sirket
  )

  // Tekil modül indirme
  async function downloadModul(modul: typeof MODULLER[number]) {
    if (!can(role, 'report') || !sirket) return
    setLoadingId(modul.id)
    setError('')
    try {
      const rows = await fetchModulRows(modul.id, firma.id, sirket, projects, projectId)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, styledSheet(rows), modul.label.slice(0, 31))
      saveWorkbook(wb, `${sirket}_${modul.label}_${today()}.xlsx`)
    } catch (e: any) { setError(e.message || 'Rapor oluşturulamadı.') }
    setLoadingId(null)
  }

  // Tüm modüller tek Excel (her modül ayrı sheet)
  async function downloadTamami() {
    if (!can(role, 'report') || !sirket) return
    setLoadingId('tamami')
    setError('')
    try {
      const wb = XLSX.utils.book_new()
      for (const modul of MODULLER) {
        const rows = await fetchModulRows(modul.id, firma.id, sirket, projects, projectId)
        XLSX.utils.book_append_sheet(wb, styledSheet(rows), modul.label.slice(0, 31))
      }
      saveWorkbook(wb, `${sirket}_TamRapor_${today()}.xlsx`)
    } catch (e: any) { setError(e.message || 'Rapor oluşturulamadı.') }
    setLoadingId(null)
  }

  // ── Firma Seçim Ekranı ────────────────────────────────────────────────────
  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Raporlar & Analiz</h2>
          <p className="text-slate-400 text-sm">Rapor almak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex gap-6">
          {[
            { id: 'ETM' as const, label: 'ETM A.Ş.', harf: 'E', renk: 'blue', alt: 'Merkez Firma Raporları' },
            { id: 'BİNYAPI' as const, label: 'BİNYAPI', harf: 'B', renk: 'indigo', alt: 'Binyapı Firma Raporları' },
          ].map(f => (
            <button key={f.id} onClick={() => setSirket(f.id)}
              className={`group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border transition-all duration-300 hover:-translate-y-2
                ${f.renk === 'blue' ? 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]'
                  : 'border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]'}`}>
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300
                ${f.renk === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-indigo-500/20 text-indigo-400'}`}>{f.harf}</div>
              <h3 className="text-xl font-bold text-slate-100">{f.label}</h3>
              <p className="mt-2 text-xs text-slate-400">{f.alt}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const isEtm = sirket === 'ETM'

  return (
    <div className="space-y-5">

      {/* Üst Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setSirket(null)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={16} /> Firmalara Dön
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${isEtm ? 'bg-blue-500/20 text-blue-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
              {isEtm ? 'E' : 'B'}
            </div>
            <span className="text-sm font-bold text-white">{isEtm ? 'ETM A.Ş.' : 'BİNYAPI'}</span>
          </div>
        </div>

        {/* Proje Filtresi */}
        <select
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
        >
          <option value="">Tüm Projeler</option>
          {sirketProjeleri.map(p => <option key={p.id} value={p.id}>{p.ad}</option>)}
        </select>
      </div>

      {error && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}

      {/* Tam Firma Raporu Kartı */}
      <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
        ${isEtm ? 'border-blue-500/20 bg-blue-500/[0.03]' : 'border-indigo-500/20 bg-indigo-500/[0.03]'}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${isEtm ? 'bg-blue-500/15' : 'bg-indigo-500/15'}`}>
            <Layers size={22} className={isEtm ? 'text-blue-400' : 'text-indigo-400'} />
          </div>
          <div>
            <p className="text-base font-bold text-white">Tam Firma Raporu</p>
            <p className="text-xs text-slate-400 mt-0.5">Tüm modüller tek Excel dosyasında — her modül ayrı sheet olarak</p>
          </div>
        </div>
        <button
          onClick={downloadTamami}
          disabled={loadingId !== null || !can(role, 'report')}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed
            ${isEtm ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {loadingId === 'tamami'
            ? <><Loader2 size={15} className="animate-spin" /> Hazırlanıyor...</>
            : <><FileSpreadsheet size={15} /> Tüm Modülleri İndir</>}
        </button>
      </div>

      {/* Modül Kartları Grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Modül Bazlı Raporlar</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODULLER.map(modul => {
            const c = RENK_MAP[modul.renk]
            const isLoading = loadingId === modul.id
            return (
              <div key={modul.id} className={`rounded-2xl border ${c.border} ${c.bg} p-4 flex flex-col gap-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xl">{modul.icon}</span>
                    <p className={`text-sm font-bold mt-1 ${c.text}`}>{modul.label}</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed flex-1">{modul.aciklama}</p>
                <button
                  onClick={() => downloadModul(modul)}
                  disabled={loadingId !== null || !can(role, 'report')}
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${c.btn}`}
                >
                  {isLoading
                    ? <><Loader2 size={12} className="animate-spin" /> İndiriliyor...</>
                    : <><Download size={12} /> Excel İndir</>}
                </button>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0]
}
