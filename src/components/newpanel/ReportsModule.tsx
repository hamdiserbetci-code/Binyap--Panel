'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, ChevronLeft, Download, FileSpreadsheet, Layers, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import type { FirmaRecord, ProjectRecord } from '@/components/newpanel/ProjectsModule'

interface Props { firma: FirmaRecord; role?: string | null }

// ── Modül tanımları ──────────────────────────────────────────────────────────

const MODULLER = [
  { id: 'projeler',      label: 'Projeler',              icon: '📁', renk: 'blue',    aciklama: 'Proje kayıtları, bütçe ve durum bilgileri' },
  { id: 'gelir',         label: 'Gelir Kayıtları',       icon: '📈', renk: 'emerald', aciklama: 'Fatura, hakediş ve diğer gelir kalemleri' },
  { id: 'gider',         label: 'Gider Kayıtları',       icon: '📉', renk: 'rose',    aciklama: 'Malzeme, işçilik ve tüm gider kalemleri' },
  { id: 'cari_hareket',  label: 'Cari Hesap Hareketleri',icon: '🤝', renk: 'cyan',    aciklama: 'Seçili cari hesabın tüm hareketleri (veya tümü)' },
  { id: 'cari_bakiye',   label: 'Cari Hesap Bakiyeleri', icon: '⚖️', renk: 'teal',    aciklama: 'Tüm cari hesapların borç/alacak/net bakiye özeti' },
  { id: 'banka',         label: 'Banka Hareketleri',     icon: '🏦', renk: 'indigo',  aciklama: 'Banka hesap hareketleri ve bakiyeleri' },
  { id: 'kasa',          label: 'Kasa Hareketleri',      icon: '💰', renk: 'amber',   aciklama: 'Nakit giriş/çıkış ve fon hareketleri' },
  { id: 'puantaj',       label: 'Puantaj',               icon: '🕐', renk: 'violet',  aciklama: 'Çalışan devam, mesai ve yevmiye kayıtları' },
  { id: 'sgk',           label: 'SGK Bildirimleri',      icon: '🛡️', renk: 'sky',     aciklama: 'Prim bildirge ve giriş/çıkış bildirimleri' },
  { id: 'vergi',         label: 'Vergi Süreçleri',       icon: '📋', renk: 'orange',  aciklama: 'KDV, muhtasar, gecici vergi beyanları' },
] as const

type ModulId = typeof MODULLER[number]['id']
type TarihTipi = 'tumu' | 'aylik' | 'aralik'

interface TarihFilter { tip: TarihTipi; yil: number; ay: number; bas: string; bit: string }
interface CariHesapItem { id: string; ad: string }

const RENK_MAP: Record<string, { border: string; bg: string; text: string; btn: string; excel: string }> = {
  blue:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    text: 'text-blue-400',    btn: 'bg-blue-600 hover:bg-blue-700',       excel: '1E3A8A' },
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-700', excel: '065F46' },
  rose:    { border: 'border-rose-500/20',    bg: 'bg-rose-500/5',    text: 'text-rose-400',    btn: 'bg-rose-600 hover:bg-rose-700',       excel: '9F1239' },
  cyan:    { border: 'border-cyan-500/20',    bg: 'bg-cyan-500/5',    text: 'text-cyan-400',    btn: 'bg-cyan-600 hover:bg-cyan-700',       excel: '164E63' },
  teal:    { border: 'border-teal-500/20',    bg: 'bg-teal-500/5',    text: 'text-teal-400',    btn: 'bg-teal-600 hover:bg-teal-700',       excel: '134E4A' },
  indigo:  { border: 'border-indigo-500/20',  bg: 'bg-indigo-500/5',  text: 'text-indigo-400',  btn: 'bg-indigo-600 hover:bg-indigo-700',   excel: '312E81' },
  amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   text: 'text-amber-400',   btn: 'bg-amber-600 hover:bg-amber-700',     excel: '78350F' },
  violet:  { border: 'border-violet-500/20',  bg: 'bg-violet-500/5',  text: 'text-violet-400',  btn: 'bg-violet-600 hover:bg-violet-700',   excel: '4C1D95' },
  sky:     { border: 'border-sky-500/20',     bg: 'bg-sky-500/5',     text: 'text-sky-400',     btn: 'bg-sky-600 hover:bg-sky-700',         excel: '0C4A6E' },
  orange:  { border: 'border-orange-500/20',  bg: 'bg-orange-500/5',  text: 'text-orange-400',  btn: 'bg-orange-600 hover:bg-orange-700',   excel: '7C2D12' },
}

const AY_LABELS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const HAREKET_LABEL: Record<string, string> = {
  satis_fatura: 'Satış Faturası', alis_fatura: 'Alış Faturası',
  tahsilat_nakit: 'Tahsilat (Nakit)', tahsilat_cek: 'Tahsilat (Çek)',
  odeme_nakit: 'Ödeme (Nakit)', odeme_cek: 'Ödeme (Çek)',
  diger_alacak: 'Diğer Alacak', diger_borc: 'Diğer Borç',
}

// ── Bakiye hesaplama ─────────────────────────────────────────────────────────

function calcBakiye(hareketler: any[]) {
  let borc = 0, alacak = 0
  for (const h of hareketler) {
    const t = Number(h.tutar || 0)
    if (['alis_fatura', 'diger_borc', 'odeme_nakit', 'odeme_cek'].includes(h.hareket_turu)) borc += t
    else alacak += t
  }
  return { borc, alacak, net: alacak - borc }
}

// ── Excel buildSheet ─────────────────────────────────────────────────────────

function buildSheet(rows: Record<string, unknown>[], modulLabel: string, sirket: string, tarihBilgisi: string, headerColor: string): XLSX.WorkSheet {
  const cols = rows.length > 0 ? Object.keys(rows[0]) : ['Bilgi']
  const colCount = cols.length
  const ws: XLSX.WorkSheet = {}

  ws['A1'] = { v: `${sirket} — ${modulLabel} Raporu`, t: 's', s: { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: headerColor } }, alignment: { horizontal: 'center', vertical: 'center' } } }
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }]

  ws['A2'] = { v: `Dönem: ${tarihBilgisi}`, t: 's', s: { font: { italic: true, sz: 10, color: { rgb: '94A3B8' } }, fill: { fgColor: { rgb: '0F172A' } }, alignment: { horizontal: 'center' } } }
  ;(ws['!merges'] as any[]).push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } })

  ws['A3'] = { v: `Oluşturulma: ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, t: 's', s: { font: { italic: true, sz: 9, color: { rgb: '64748B' } }, fill: { fgColor: { rgb: '0F172A' } }, alignment: { horizontal: 'right' } } }
  ;(ws['!merges'] as any[]).push({ s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } })

  ws['A4'] = { v: '', t: 's', s: { fill: { fgColor: { rgb: '0F172A' } } } }
  ;(ws['!merges'] as any[]).push({ s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } })

  const HR = 4
  cols.forEach((col, ci) => {
    const addr = XLSX.utils.encode_cell({ r: HR, c: ci })
    ws[addr] = { v: col, t: 's', s: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: headerColor } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { bottom: { style: 'medium', color: { rgb: 'FFFFFF' } } } } }
  })

  if (rows.length === 0) {
    const addr = XLSX.utils.encode_cell({ r: HR + 1, c: 0 })
    ws[addr] = { v: 'Bu dönemde kayıt bulunamadı.', t: 's', s: { font: { italic: true, color: { rgb: '94A3B8' } }, alignment: { horizontal: 'center' } } }
    ;(ws['!merges'] as any[]).push({ s: { r: HR + 1, c: 0 }, e: { r: HR + 1, c: colCount - 1 } })
  } else {
    const numericCols = new Set<number>()
    rows.forEach((row, ri) => {
      const fillColor = ri % 2 === 0 ? 'F8FAFC' : 'EFF6FF'
      cols.forEach((col, ci) => {
        const addr = XLSX.utils.encode_cell({ r: HR + 1 + ri, c: ci })
        const raw = row[col]
        const isNum = typeof raw === 'number'
        if (isNum) numericCols.add(ci)
        ws[addr] = {
          v: raw ?? '', t: isNum ? 'n' : 's',
          s: { font: { sz: 9, color: { rgb: '1E293B' } }, fill: { fgColor: { rgb: fillColor } }, alignment: { horizontal: isNum ? 'right' : 'left', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } } },
        }
        if (isNum && col.includes('₺')) ws[addr].z = '#,##0.00" ₺"'
      })
    })
    if (numericCols.size > 0) {
      const tr = HR + 1 + rows.length
      cols.forEach((col, ci) => {
        const addr = XLSX.utils.encode_cell({ r: tr, c: ci })
        if (ci === 0) {
          ws[addr] = { v: 'TOPLAM', t: 's', s: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: headerColor } }, alignment: { horizontal: 'center' } } }
        } else if (numericCols.has(ci)) {
          const sum = rows.reduce((s, r) => s + (Number(r[col]) || 0), 0)
          ws[addr] = { v: sum, t: 'n', z: '#,##0.00" ₺"', s: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: headerColor } }, alignment: { horizontal: 'right' } } }
        } else {
          ws[addr] = { v: '', t: 's', s: { fill: { fgColor: { rgb: headerColor } } } }
        }
      })
    }
  }

  ws['!cols'] = cols.map(k => ({ wch: Math.max(k.length + 4, 16) }))
  ws['!rows'] = [{ hpt: 28 }, { hpt: 16 }, { hpt: 14 }, { hpt: 8 }, { hpt: 22 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 5 }
  const lastRow = HR + Math.max(rows.length, 1) + (rows.length > 0 ? 1 : 0)
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: colCount - 1 } })
  return ws
}

// ── Data fetchers ────────────────────────────────────────────────────────────

async function fetchModulRows(
  id: ModulId,
  firmaId: string,
  sirket: 'ETM' | 'BİNYAPI',
  projects: ProjectRecord[],
  projectId: string,
  tarih: TarihFilter,
  selectedCariId: string
): Promise<Record<string, unknown>[]> {
  const projLabel = (pid: string | null | undefined) => projects.find(p => p.id === pid)?.ad || 'Genel'

  function addSirket(q: any) {
    return sirket === 'ETM' ? q.or('sirket.eq.ETM,sirket.is.null') : q.eq('sirket', sirket)
  }
  function addTarih(q: any, col: string) {
    if (tarih.tip === 'aylik') {
      const pfx = `${tarih.yil}-${String(tarih.ay).padStart(2, '0')}`
      return q.gte(col, `${pfx}-01`).lte(col, `${pfx}-31`)
    }
    if (tarih.tip === 'aralik') {
      if (tarih.bas) q = q.gte(col, tarih.bas)
      if (tarih.bit) q = q.lte(col, tarih.bit)
    }
    return q
  }
  async function run(q: any) {
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data || []) as any[]
  }

  if (id === 'projeler') {
    let q = supabase.from('projeler').select('*').eq('firma_id', firmaId).order('ad')
    if (projectId) q = q.eq('id', projectId)
    q = addSirket(q)
    const rows = await run(q)
    return rows.map(r => ({ Kod: r.kod || '', Proje: r.ad, Durum: r.durum, Şirket: r.sirket || 'ETM', Başlangıç: r.baslangic_tarihi || '', Bitiş: r.bitis_tarihi || '', 'Bütçe (₺)': Number(r.butce || 0), Lokasyon: r.lokasyon || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'gelir') {
    let q = supabase.from('gelir_kayitlari').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    q = addSirket(q); q = addTarih(q, 'tarih')
    const rows = await run(q)
    return rows.map(r => ({ Proje: projLabel(r.proje_id), 'Cari Ünvan': r.cari_unvan || '', Tarih: r.tarih || '', 'Kayıt Türü': r.kayit_turu || '', 'Evrak No': r.evrak_no || '', 'Tutar (₺)': Number(r.tutar || 0), 'Tahsilat Durumu': r.tahsilat_durumu || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'gider') {
    let q = supabase.from('gider_kayitlari').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    q = addSirket(q); q = addTarih(q, 'tarih')
    const rows = await run(q)
    return rows.map(r => ({ Proje: projLabel(r.proje_id), Tedarikçi: r.tedarikci || '', Tarih: r.tarih || '', Kategori: r.kategori || '', 'Belge No': r.belge_no || '', 'Tutar (₺)': Number(r.tutar || 0), 'Ödeme Durumu': r.odeme_durumu || '', Açıklama: r.aciklama || '' }))
  }

  // Cari hesaplar - ortak hesap haritası
  async function getCariHesapMap() {
    const q = sirket === 'ETM'
      ? supabase.from('cari_hesaplar').select('*').eq('firma_id', firmaId).or('sirket.eq.ETM,sirket.is.null')
      : supabase.from('cari_hesaplar').select('*').eq('firma_id', firmaId).eq('sirket', sirket)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return new Map(((data || []) as any[]).map(c => [c.id, c]))
  }

  function getCariAdi(h: any) {
    if (!h) return '—'
    return (Object.entries(h).find(([k]) => k.toLowerCase() === 'reklam')?.[1] as string) || h.ad || '—'
  }

  if (id === 'cari_hareket') {
    const hesapMap = await getCariHesapMap()
    const hesapIds = selectedCariId ? [selectedCariId] : Array.from(hesapMap.keys())
    if (hesapIds.length === 0) return []
    let hq: any = supabase.from('cari_hareketler').select('*').in('cari_hesap_id', hesapIds).order('tarih', { ascending: false })
    hq = addTarih(hq, 'tarih')
    const rows = await run(hq)
    return rows.map(r => {
      const h = hesapMap.get(r.cari_hesap_id) as any
      return {
        'Cari Adı': getCariAdi(h),
        Şirket: h?.sirket || 'ETM',
        Tarih: r.tarih || '',
        'Hareket Türü': HAREKET_LABEL[r.hareket_turu] || r.hareket_turu || '',
        'Belge No': r.belge_no || '',
        'Tutar (₺)': Number(r.tutar || 0),
        'Vade Tarihi': r.vade_tarihi || '',
        'Çek No': r.cek_no || '',
        'Çek Banka': r.cek_banka || '',
        Durum: r.durum || '',
        Açıklama: r.aciklama || '',
      }
    })
  }

  if (id === 'cari_bakiye') {
    const hesapMap = await getCariHesapMap()
    if (hesapMap.size === 0) return []
    const hesapIds = Array.from(hesapMap.keys())
    const { data: hareketData, error: hErr } = await supabase.from('cari_hareketler').select('*').in('cari_hesap_id', hesapIds)
    if (hErr) throw new Error(hErr.message)
    const allHareketler = (hareketData || []) as any[]
    return hesapIds.map(hid => {
      const h = hesapMap.get(hid) as any
      const hareketler = allHareketler.filter(r => r.cari_hesap_id === hid)
      const { borc, alacak, net } = calcBakiye(hareketler)
      return {
        'Cari Adı': getCariAdi(h),
        Şirket: h?.sirket || 'ETM',
        'VKN/TCKN': h?.vkn_tckn || '',
        'Toplam Borç (₺)': borc,
        'Toplam Alacak (₺)': alacak,
        'Net Bakiye (₺)': net,
        'Hareket Sayısı': hareketler.length,
      }
    }).sort((a, b) => String(a['Cari Adı']).localeCompare(String(b['Cari Adı']), 'tr'))
  }

  if (id === 'banka') {
    const { data: bankaData, error: bankaErr } = await supabase.from('bankalar').select('id, banka_adi, hesap_no, sirket').eq('firma_id', firmaId)
    if (bankaErr) throw new Error(bankaErr.message)
    const bankaMap = new Map(((bankaData || []) as any[]).map(b => [b.id, b]))
    const bankaIds = ((bankaData || []) as any[])
      .filter(b => sirket === 'ETM' ? (!b.sirket || b.sirket === 'ETM') : b.sirket === sirket)
      .map(b => b.id)
    if (bankaIds.length === 0) return []
    let hq: any = supabase.from('banka_hareketleri').select('*').in('banka_id', bankaIds).order('tarih', { ascending: false })
    hq = addTarih(hq, 'tarih')
    const rows = await run(hq)
    return rows.map(r => {
      const b = bankaMap.get(r.banka_id) as any
      return {
        Banka: b?.banka_adi || '—',
        'Hesap No': b?.hesap_no || '',
        Şirket: b?.sirket || 'ETM',
        Tarih: r.tarih || '',
        'Hareket Türü': r.hareket_turu || '',
        'Belge No': r.belge_no || '',
        'Tutar (₺)': Number(r.tutar || 0),
        Açıklama: r.aciklama || '',
      }
    })
  }

  if (id === 'kasa') {
    let q = supabase.from('kasa_hareketleri').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    q = addSirket(q); q = addTarih(q, 'tarih')
    const rows = await run(q)
    return rows.map(r => ({ Proje: projLabel(r.proje_id), Kanal: r.kanal || '', 'Hareket Türü': r.hareket_turu || '', Tarih: r.tarih || '', 'Tutar (₺)': Number(r.tutar || 0), 'Fiş No': r.fis_no || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'puantaj') {
    let q = supabase.from('puantaj_kayitlari').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    q = addSirket(q); q = addTarih(q, 'tarih')
    const rows = await run(q)
    return rows.map(r => ({ Proje: projLabel(r.proje_id), 'Çalışan': r.calisan_id || '', Tarih: r.tarih || '', Durum: r.durum || '', 'Mesai (saat)': Number(r.mesai_saati || 0), 'Yevmiye (₺)': Number(r.yevmiye || 0), Açıklama: r.aciklama || '' }))
  }

  if (id === 'sgk') {
    let q = supabase.from('sgk_prim_bildirgeleri').select('*').eq('firma_id', firmaId).order('yil', { ascending: false }).order('ay', { ascending: false })
    q = addSirket(q); q = addTarih(q, 'son_odeme_tarihi')
    const rows = await run(q)
    return rows.map(r => ({ Şirket: r.sirket || 'ETM', Yıl: r.yil, Ay: r.ay, 'Tahakkuk (₺)': Number(r.tahakkuk_tutari || 0), 'Son Ödeme': r.son_odeme_tarihi || '', 'Ödeme Tarihi': r.odeme_tarihi || '', Durum: r.durum || '', Açıklama: r.aciklama || '' }))
  }

  if (id === 'vergi') {
    let q = supabase.from('vergi_surecleri').select('*').eq('firma_id', firmaId).order('yil', { ascending: false })
    if (projectId) q = q.eq('proje_id', projectId)
    q = addSirket(q); q = addTarih(q, 'son_tarih')
    const rows = await run(q)
    return rows.map(r => ({ Proje: projLabel(r.proje_id), 'Süreç': r.surec_turu || '', Yıl: r.yil, Ay: r.ay || '', Dönem: r.donem || '', 'Son Tarih': r.son_tarih || '', 'Beyan Tarihi': r.beyan_tarihi || '', 'Tutar (₺)': Number(r.tutar || 0), Durum: r.durum || '', Sorumlu: r.sorumlu || '' }))
  }

  return []
}

function tarihMetni(t: TarihFilter) {
  if (t.tip === 'aylik') return `${AY_LABELS[t.ay - 1]} ${t.yil}`
  if (t.tip === 'aralik') return `${t.bas || '—'} / ${t.bit || '—'}`
  return 'Tüm Zamanlar'
}

function dosyaTarihi(t: TarihFilter) {
  if (t.tip === 'aylik') return `${t.yil}-${String(t.ay).padStart(2, '0')}`
  if (t.tip === 'aralik' && t.bas && t.bit) return `${t.bas}_${t.bit}`
  return new Date().toISOString().split('T')[0]
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────

export default function ReportsModule({ firma, role }: Props) {
  const now = new Date()
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [projectId, setProjectId] = useState('')
  const [cariHesaplar, setCariHesaplar] = useState<CariHesapItem[]>([])
  const [selectedCariId, setSelectedCariId] = useState('')
  const [loadingId, setLoadingId] = useState<ModulId | 'tamami' | null>(null)
  const [error, setError] = useState('')
  const [tarih, setTarih] = useState<TarihFilter>({ tip: 'aylik', yil: now.getFullYear(), ay: now.getMonth() + 1, bas: '', bit: '' })

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('projeler').select('id, ad, sirket').eq('firma_id', firma.id).order('ad')
    setProjects((data as ProjectRecord[]) || [])
  }, [firma.id])

  const fetchCariHesaplar = useCallback(async (sk: 'ETM' | 'BİNYAPI') => {
    const q = sk === 'ETM'
      ? supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id).or('sirket.eq.ETM,sirket.is.null')
      : supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id).eq('sirket', sk)
    const { data } = await q
    const list = ((data || []) as any[]).map(c => ({
      id: c.id,
      ad: (Object.entries(c).find(([k]) => k.toLowerCase() === 'reklam')?.[1] as string) || c.ad || c.id,
    }))
    setCariHesaplar(list)
  }, [firma.id])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { if (sirket) fetchCariHesaplar(sirket) }, [sirket, fetchCariHesaplar])

  const sirketProjeleri = projects.filter(p => sirket === 'ETM' ? (!p.sirket || p.sirket === 'ETM') : p.sirket === sirket)

  async function downloadModul(modul: typeof MODULLER[number]) {
    if (!can(role, 'report') || !sirket) return
    setLoadingId(modul.id)
    setError('')
    try {
      const rows = await fetchModulRows(modul.id, firma.id, sirket, projects, projectId, tarih, selectedCariId)
      const c = RENK_MAP[modul.renk]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, buildSheet(rows, modul.label, sirket, tarihMetni(tarih), c.excel), modul.label.slice(0, 31))
      XLSX.writeFile(wb, `${sirket}_${modul.label}_${dosyaTarihi(tarih)}.xlsx`)
    } catch (e: any) { setError(e.message || 'Rapor oluşturulamadı.') }
    setLoadingId(null)
  }

  async function downloadTamami() {
    if (!can(role, 'report') || !sirket) return
    setLoadingId('tamami')
    setError('')
    try {
      const wb = XLSX.utils.book_new()
      for (const modul of MODULLER) {
        const rows = await fetchModulRows(modul.id, firma.id, sirket, projects, projectId, tarih, selectedCariId)
        const c = RENK_MAP[modul.renk]
        XLSX.utils.book_append_sheet(wb, buildSheet(rows, modul.label, sirket, tarihMetni(tarih), c.excel), modul.label.slice(0, 31))
      }
      XLSX.writeFile(wb, `${sirket}_TamRapor_${dosyaTarihi(tarih)}.xlsx`)
    } catch (e: any) { setError(e.message || 'Rapor oluşturulamadı.') }
    setLoadingId(null)
  }

  // ── Firma Seçim ────────────────────────────────────────────────────────────
  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Raporlar & Analiz</h2>
          <p className="text-slate-400 text-sm">Rapor almak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex gap-6 flex-wrap justify-center">
          {([
            { id: 'ETM' as const, label: 'ETM A.Ş.', harf: 'E', cls: 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]', icnCls: 'bg-blue-500/20 text-blue-400', alt: 'Merkez Firma Raporları' },
            { id: 'BİNYAPI' as const, label: 'BİNYAPI', harf: 'B', cls: 'border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]', icnCls: 'bg-indigo-500/20 text-indigo-400', alt: 'Binyapı Firma Raporları' },
          ] as const).map(f => (
            <button key={f.id} onClick={() => setSirket(f.id)}
              className={`group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border transition-all duration-300 hover:-translate-y-2 ${f.cls}`}>
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300 ${f.icnCls}`}>{f.harf}</div>
              <h3 className="text-xl font-bold text-slate-100">{f.label}</h3>
              <p className="mt-2 text-xs text-slate-400">{f.alt}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const isEtm = sirket === 'ETM'
  const accentBorder = isEtm ? 'border-blue-500/20 bg-blue-500/[0.03]' : 'border-indigo-500/20 bg-indigo-500/[0.03]'
  const btnCls = isEtm ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'
  const accentText = isEtm ? 'text-blue-400' : 'text-indigo-400'
  const tabActive = isEtm ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
  const tabInactive = 'bg-white/5 text-slate-400 hover:text-white border border-white/10'

  return (
    <div className="space-y-5">

      {/* Üst bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSirket(null); setSelectedCariId('') }} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={16} /> Firmalara Dön
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${isEtm ? 'bg-blue-500/20 text-blue-400' : 'bg-indigo-500/20 text-indigo-400'}`}>{isEtm ? 'E' : 'B'}</div>
            <span className="text-sm font-bold text-white">{isEtm ? 'ETM A.Ş.' : 'BİNYAPI'}</span>
          </div>
        </div>
        <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">Tüm Projeler</option>
          {sirketProjeleri.map(p => <option key={p.id} value={p.id}>{p.ad}</option>)}
        </select>
      </div>

      {/* Tarih Filtresi */}
      <div className={`rounded-2xl border ${accentBorder} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={15} className={accentText} />
          <p className="text-sm font-bold text-white">Rapor Dönemi</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(['tumu', 'aylik', 'aralik'] as TarihTipi[]).map(t => (
            <button key={t} onClick={() => setTarih(p => ({ ...p, tip: t }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tarih.tip === t ? tabActive : tabInactive}`}>
              {t === 'tumu' ? 'Tüm Zamanlar' : t === 'aylik' ? 'Aylık' : 'Tarih Aralığı'}
            </button>
          ))}
        </div>
        {tarih.tip === 'aylik' && (
          <div className="flex flex-wrap gap-2 items-center">
            <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none" value={tarih.yil} onChange={e => setTarih(p => ({ ...p, yil: Number(e.target.value) }))}>
              {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
            </select>
            <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none" value={tarih.ay} onChange={e => setTarih(p => ({ ...p, ay: Number(e.target.value) }))}>
              {AY_LABELS.map((a, i) => <option key={i+1} value={i+1} className="bg-slate-900">{a}</option>)}
            </select>
            <span className={`px-3 py-2 rounded-xl border text-xs font-medium ${isEtm ? 'border-blue-500/30 text-blue-300' : 'border-indigo-500/30 text-indigo-300'}`}>{AY_LABELS[tarih.ay - 1]} {tarih.yil}</span>
          </div>
        )}
        {tarih.tip === 'aralik' && (
          <div className="flex flex-wrap gap-2 items-center">
            <input type="date" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none" value={tarih.bas} onChange={e => setTarih(p => ({ ...p, bas: e.target.value }))} />
            <span className="text-slate-500 text-xs">—</span>
            <input type="date" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none" value={tarih.bit} onChange={e => setTarih(p => ({ ...p, bit: e.target.value }))} />
          </div>
        )}
      </div>

      {error && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}

      {/* Tam Firma Raporu */}
      <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${accentBorder}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${isEtm ? 'bg-blue-500/15 text-blue-400' : 'bg-indigo-500/15 text-indigo-400'}`}><Layers size={22} /></div>
          <div>
            <p className="text-base font-bold text-white">Tam Firma Raporu</p>
            <p className="text-xs text-slate-400 mt-0.5">Tüm modüller tek Excel'de — her modül ayrı sheet &nbsp;•&nbsp; {tarihMetni(tarih)}</p>
          </div>
        </div>
        <button onClick={downloadTamami} disabled={loadingId !== null || !can(role, 'report')}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${btnCls}`}>
          {loadingId === 'tamami' ? <><Loader2 size={15} className="animate-spin" /> Hazırlanıyor...</> : <><FileSpreadsheet size={15} /> Tüm Modülleri İndir</>}
        </button>
      </div>

      {/* Modül Kartları */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Modül Bazlı Raporlar</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODULLER.map(modul => {
            const c = RENK_MAP[modul.renk]
            const isLoading = loadingId === modul.id
            const isCariHareket = modul.id === 'cari_hareket'
            return (
              <div key={modul.id} className={`rounded-2xl border ${c.border} ${c.bg} p-4 flex flex-col gap-3`}>
                <div>
                  <span className="text-xl">{modul.icon}</span>
                  <p className={`text-sm font-bold mt-1 ${c.text}`}>{modul.label}</p>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed flex-1">{modul.aciklama}</p>

                {/* Cari Hareket: cari seçim dropdown */}
                {isCariHareket && (
                  <select
                    className={`rounded-xl border ${c.border} bg-white/5 px-2 py-1.5 text-xs text-slate-300 outline-none w-full`}
                    value={selectedCariId}
                    onChange={e => setSelectedCariId(e.target.value)}
                  >
                    <option value="">Tüm Cari Hesaplar</option>
                    {cariHesaplar.map(ch => <option key={ch.id} value={ch.id} className="bg-slate-900">{ch.ad}</option>)}
                  </select>
                )}

                <div className={`text-[10px] px-2 py-1 rounded-lg border ${c.border} ${c.text} font-medium`}>{tarihMetni(tarih)}</div>
                <button onClick={() => downloadModul(modul)} disabled={loadingId !== null || !can(role, 'report')}
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${c.btn}`}>
                  {isLoading ? <><Loader2 size={12} className="animate-spin" /> İndiriliyor...</> : <><Download size={12} /> Excel İndir</>}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
