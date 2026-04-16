'use client'
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  FileText, Plus, ChevronRight, ChevronDown, Upload,
  CheckCircle, Clock, AlertTriangle, Loader2, Trash2,
  Eye, Download, X, Bell, RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, StatCard, Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import Kdv1Checklist, { KDV1_KONTROLLER } from './Kdv1Checklist'

// ─── Sabitler ────────────────────────────────────────────────
const IS_TIPLERI = [
  { v: 'kdv1',             l: 'KDV 1',             renk: 'blue',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   icon: '📋' },
  { v: 'kdv2',             l: 'KDV 2',             renk: 'indigo',  bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', icon: '📋' },
  { v: 'muhtasar_sgk',     l: 'Muhtasar & SGK',    renk: 'green',   bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',  icon: '👥' },
  { v: 'gecici_vergi',     l: 'Geçici Vergi',      renk: 'amber',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  icon: '⏱' },
  { v: 'kurumlar_vergisi', l: 'Kurumlar Vergisi',  renk: 'purple',  bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200', icon: '🏢' },
  { v: 'edefter',          l: 'e-Defter',          renk: 'teal',    bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',   icon: '📚' },
]

// Her iş tipine göre süreç adımları
const ADIM_SABLONLARI: Record<string, { kodu: string; adi: string }[]> = {
  kdv1:             [{ kodu: 'beyanname', adi: 'Beyanname Gönderimi' }, { kodu: 'tahakkuk', adi: 'Tahakkuk' }, { kodu: 'odeme', adi: 'Ödeme' }, { kodu: 'dekont', adi: 'Dekont Yükleme' }],
  kdv2:             [{ kodu: 'beyanname', adi: 'Beyanname Gönderimi' }, { kodu: 'tahakkuk', adi: 'Tahakkuk' }, { kodu: 'odeme', adi: 'Ödeme' }, { kodu: 'dekont', adi: 'Dekont Yükleme' }],
  muhtasar_sgk:     [{ kodu: 'beyanname', adi: 'Beyanname Gönderimi' }, { kodu: 'tahakkuk', adi: 'Tahakkuk' }, { kodu: 'odeme', adi: 'Ödeme' }, { kodu: 'dekont', adi: 'Dekont Yükleme' }],
  gecici_vergi:     [{ kodu: 'beyanname', adi: 'Beyanname Gönderimi' }, { kodu: 'tahakkuk', adi: 'Tahakkuk' }, { kodu: 'odeme', adi: 'Ödeme' }, { kodu: 'dekont', adi: 'Dekont Yükleme' }],
  kurumlar_vergisi: [{ kodu: 'beyanname', adi: 'Beyanname Gönderimi' }, { kodu: 'tahakkuk', adi: 'Tahakkuk' }, { kodu: 'odeme', adi: 'Ödeme' }, { kodu: 'dekont', adi: 'Dekont Yükleme' }],
  edefter:          [{ kodu: 'edefter_gonderim', adi: 'e-Defter Gönderimi' }, { kodu: 'tahakkuk', adi: 'Onay / Tahakkuk' }, { kodu: 'dekont', adi: 'Belge Yükleme' }],
}

type Durum = 'bekliyor' | 'devam' | 'tamamlandi' | 'uyari'

const DURUM_CFG: Record<Durum, { l: string; badge: 'gray'|'yellow'|'green'|'orange'; icon: React.ElementType; ring: string }> = {
  bekliyor:   { l: 'Bekliyor',     badge: 'gray',   icon: Clock,          ring: 'ring-gray-200'   },
  devam:      { l: 'Devam Ediyor', badge: 'yellow', icon: Loader2,        ring: 'ring-yellow-300' },
  tamamlandi: { l: 'Tamamlandı',   badge: 'green',  icon: CheckCircle,    ring: 'ring-green-300'  },
  uyari:      { l: 'Uyarı',        badge: 'orange', icon: AlertTriangle,  ring: 'ring-orange-300' },
}

const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function buAy() {
  const d = new Date()
  return { ay: d.getMonth() + 1, yil: d.getFullYear() }
}

// ─── Bildirim Sistemi ─────────────────────────────────────────
interface Bildirim {
  id: string
  tip: 'gecikti' | 'bugun' | 'yaklasıyor'
  mesaj: string
  isId: string
}

function useBildirimler(firmaId: string, isler: any[]) {
  return useMemo(() => {
    const bugun = new Date(); bugun.setHours(0,0,0,0)
    const liste: Bildirim[] = []
    isler.forEach(is => {
      if (is.durum === 'tamamlandi') return
      const tarihler = [
        { tarih: is.son_beyan_tarihi, etiket: 'beyan' },
        { tarih: is.son_odeme_tarihi, etiket: 'ödeme' },
      ]
      tarihler.forEach(({ tarih, etiket }) => {
        if (!tarih) return
        const t = new Date(tarih); t.setHours(0,0,0,0)
        const fark = Math.floor((t.getTime() - bugun.getTime()) / 86400000)
        const tip = IS_TIPLERI.find(x => x.v === is.is_tipi)
        if (fark < 0)
          liste.push({ id: `${is.id}-${etiket}`, tip: 'gecikti', mesaj: `${tip?.l} ${is.donem} — ${etiket} ${Math.abs(fark)} gün gecikti`, isId: is.id })
        else if (fark === 0)
          liste.push({ id: `${is.id}-${etiket}`, tip: 'bugun', mesaj: `${tip?.l} ${is.donem} — ${etiket} bugün son gün!`, isId: is.id })
        else if (fark <= 7)
          liste.push({ id: `${is.id}-${etiket}`, tip: 'yaklasıyor', mesaj: `${tip?.l} ${is.donem} — ${etiket} için ${fark} gün kaldı`, isId: is.id })
      })
    })
    return liste
  }, [isler])
}

// ─── Bildirim Paneli ──────────────────────────────────────────
function BildirimPaneli({ bildirimler, onGit }: { bildirimler: Bildirim[]; onGit: (id: string) => void }) {
  const [acik, setAcik] = useState(false)
  const [okundu, setOkundu] = useState<string[]>([])

  const okunmamis = bildirimler.filter(b => !okundu.includes(b.id))
  const gecikti   = bildirimler.filter(b => b.tip === 'gecikti').length

  if (bildirimler.length === 0) return null

  return (
    <div className="relative">
      <button onClick={() => setAcik(v => !v)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
        <Bell className={`w-4 h-4 ${okunmamis.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
        <span className="text-sm font-medium text-gray-700">Hatırlatıcılar</span>
        {okunmamis.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {okunmamis.length > 9 ? '9+' : okunmamis.length}
          </span>
        )}
      </button>

      {acik && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAcik(false)} />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600" />
                <span className="font-semibold text-gray-900 text-sm">Vergi & Beyanname Hatırlatıcıları</span>
                {gecikti > 0 && <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">{gecikti} gecikmiş</span>}
              </div>
              <div className="flex items-center gap-2">
                {okunmamis.length > 0 && (
                  <button onClick={() => setOkundu(bildirimler.map(b => b.id))} className="text-xs text-blue-600 hover:underline">Tümünü oku</button>
                )}
                <button onClick={() => setAcik(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {bildirimler.map(b => {
                const isOkundu = okundu.includes(b.id)
                const renkler = b.tip === 'gecikti'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : b.tip === 'bugun'
                  ? 'bg-orange-50 border-orange-200 text-orange-700'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                const Icon = b.tip === 'gecikti' ? AlertTriangle : b.tip === 'bugun' ? Clock : Bell
                return (
                  <div key={b.id} onClick={() => { setOkundu(p => Array.from(new Set(p.concat(b.id)))); setAcik(false); onGit(b.isId) }}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${isOkundu ? 'opacity-50' : ''}`}>
                    <div className={`p-1.5 rounded-lg border flex-shrink-0 mt-0.5 ${renkler}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{b.mesaj}</p>
                    </div>
                    {!isOkundu && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Ana Modül ────────────────────────────────────────────────
export default function IsTakibiModule({ firma }: AppCtx) {
  const [isler, setIsler]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [tipFilter, setTipFilter] = useState('hepsi')
  const [yilFilter, setYilFilter] = useState(String(new Date().getFullYear()))
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [modal, setModal]         = useState(false)
  const [delId, setDelId]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [scrollToId, setScrollToId] = useState<string | null>(null)

  const { ay, yil } = buAy()
  const [form, setForm] = useState({
    is_tipi: 'kdv1',
    donem: `${yil}-${String(ay).padStart(2,'0')}`,
    yil: String(yil),
    ay: String(ay),
    ceyrek: '1',
    son_beyan_tarihi: '',
    son_odeme_tarihi: '',
    notlar: '',
  })

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('is_takibi_v2')
      .select('*')
      .eq('firma_id', firma.id)
      .order('yil', { ascending: false })
      .order('ay',  { ascending: false })
    setIsler(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [firma.id])

  // ─── Excel Export ─────────────────────────────────────────
  async function exportExcel() {
    const XLSXStyle = await import('xlsx-js-style')
    const { utils, writeFile } = XLSXStyle

    // Tüm checklist ve adım kayıtlarını çek
    const [{ data: checklistRows }, { data: adimRows }] = await Promise.all([
      supabase.from('is_takibi_checklist').select('*').eq('firma_id', firma.id),
      supabase.from('is_takibi_adimlar').select('*').eq('firma_id', firma.id),
    ])
    const checklistMap: Record<string, Record<string, any>> = {}
    ;(checklistRows || []).forEach(r => {
      if (!checklistMap[r.is_id]) checklistMap[r.is_id] = {}
      checklistMap[r.is_id][r.kontrol_kodu] = r
    })
    const adimMap: Record<string, any[]> = {}
    ;(adimRows || []).forEach(r => {
      if (!adimMap[r.is_id]) adimMap[r.is_id] = []
      adimMap[r.is_id].push(r)
    })

    const KOYU   = '0F172A'
    const BEYAZ  = 'FFFFFF'
    const ACIK   = 'F8FAFC'
    const SINIR  = 'E2E8F0'
    const MAVI   = '1E40AF'
    const YESIL  = '166534'
    const KIRMIZI = '991B1B'
    const SARI   = '92400E'

    const durumRenk: Record<string, string> = {
      bekliyor:   '64748B',
      devam:      '92400E',
      tamamlandi: '166534',
      uyari:      '9A3412',
    }
    const durumBg: Record<string, string> = {
      bekliyor:   'F8FAFC',
      devam:      'FFFBEB',
      tamamlandi: 'F0FDF4',
      uyari:      'FFF7ED',
    }

    const S = {
      baslik:  { font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'left', vertical: 'center' } },
      tarih:   { font: { name: 'Calibri', sz: 9,  color: { rgb: 'BFDBFE' } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'right', vertical: 'center' } },
      ozet:    { font: { name: 'Calibri', sz: 8,  color: { rgb: '64748B' } }, fill: { fgColor: { rgb: ACIK } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      ozetVal: { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: KOYU } }, fill: { fgColor: { rgb: ACIK } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      th:      { font: { name: 'Calibri', sz: 9,  bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: MAVI } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'medium', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      td:      (durum: string, zebra: boolean) => ({
        font:      { name: 'Calibri', sz: 9, color: { rgb: durumRenk[durum] || KOYU } },
        fill:      { fgColor: { rgb: durum === 'tamamlandi' ? 'F0FDF4' : durum === 'devam' ? 'FFFBEB' : zebra ? ACIK : BEYAZ } },
        alignment: { vertical: 'center', wrapText: false },
        border:    { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } },
      }),
      toplam:  { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'medium', color: { rgb: KOYU } }, bottom: { style: 'medium', color: { rgb: KOYU } }, left: { style: 'thin', color: { rgb: KOYU } }, right: { style: 'thin', color: { rgb: KOYU } } } },
    }

    const c = (v: any, s: any) => ({ v, s, t: typeof v === 'number' ? 'n' : 's' })
    const COLS = 8
    const ws: any = {}
    const merges: any[] = []
    let row = 0

    // Başlık bandı
    ws[utils.encode_cell({ r: row, c: 0 })] = c(`${firma.ad.toUpperCase()} — İŞ TAKİBİ RAPORU`, S.baslik)
    for (let i = 1; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', S.baslik)
    ws[utils.encode_cell({ r: row, c: COLS - 1 })] = c(new Date().toLocaleDateString('tr-TR'), S.tarih)
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
    row++

    // Özet kartlar
    const ozet = [
      { l: 'TOPLAM',      v: String(isler.length)                                          },
      { l: 'DEVAM EDEN',  v: String(isler.filter(i => i.durum === 'devam').length)         },
      { l: 'TAMAMLANDI',  v: String(isler.filter(i => i.durum === 'tamamlandi').length)    },
      { l: 'BEKLIYOR',    v: String(isler.filter(i => i.durum === 'bekliyor').length)      },
    ]
    // Başlık satırı
    ozet.forEach((o, i) => {
      const col = i * 2
      ws[utils.encode_cell({ r: row, c: col })] = c(o.l, S.ozet)
      if (col + 1 < COLS) ws[utils.encode_cell({ r: row, c: col + 1 })] = c('', S.ozet)
      merges.push({ s: { r: row, c: col }, e: { r: row, c: Math.min(col + 1, COLS - 1) } })
    })
    row++
    // Değer satırı
    ozet.forEach((o, i) => {
      const col = i * 2
      ws[utils.encode_cell({ r: row, c: col })] = c(o.v, S.ozetVal)
      if (col + 1 < COLS) ws[utils.encode_cell({ r: row, c: col + 1 })] = c('', S.ozetVal)
      merges.push({ s: { r: row, c: col }, e: { r: row, c: Math.min(col + 1, COLS - 1) } })
    })
    row++

    // Boş satır
    for (let i = 0; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', {})
    row++

    // Tablo başlığı
    const headers = ['İş Tipi', 'Dönem', 'Yıl', 'Son Beyan', 'Son Ödeme', 'Durum', 'Beyanname', 'Tahakkuk / Ödeme']
    headers.forEach((h, i) => { ws[utils.encode_cell({ r: row, c: i })] = c(h, S.th) })
    row++

    // Veri satırları — iş tipine göre grupla
    const gruplar: Record<string, any[]> = {}
    isler.forEach(is => {
      const tip = IS_TIPLERI.find(t => t.v === is.is_tipi)?.l || is.is_tipi
      if (!gruplar[tip]) gruplar[tip] = []
      gruplar[tip].push(is)
    })

    let idx = 0
    Object.entries(gruplar).forEach(([tipAdi, tipIsler]) => {
      // Grup başlık satırı
      const grupS = {
        font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: MAVI } },
        fill:      { fgColor: { rgb: 'EFF6FF' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border:    { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } },
      }
      ws[utils.encode_cell({ r: row, c: 0 })] = c(tipAdi.toUpperCase(), grupS)
      for (let i = 1; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', grupS)
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
      row++

      tipIsler.forEach(is => {
        const zebra = idx % 2 === 1
        const td = S.td(is.durum, zebra)
        const durumL = DURUM_CFG[is.durum as Durum]?.l || is.durum
        const cells = [
          c(IS_TIPLERI.find(t => t.v === is.is_tipi)?.l || is.is_tipi, td),
          c(is.donem || '-', td),
          c(String(is.yil || '-'), td),
          c(is.son_beyan_tarihi ? new Date(is.son_beyan_tarihi).toLocaleDateString('tr-TR') : '-', td),
          c(is.son_odeme_tarihi ? new Date(is.son_odeme_tarihi).toLocaleDateString('tr-TR') : '-', td),
          c(durumL, { ...td, font: { ...td.font, bold: is.durum === 'tamamlandi' } }),
          c(is.durum === 'tamamlandi' ? '✓' : is.durum === 'devam' ? '→' : '○', td),
          c(is.notlar || '', td),
        ]
        cells.forEach((cell, i) => { ws[utils.encode_cell({ r: row, c: i })] = cell })
        row++
        idx++

        // Süreç Adımları
        const adimlar = (adimMap[is.id] || []).sort((a: any, b: any) => a.sira - b.sira)
        if (adimlar.length > 0) {
          const adimBaslikS = {
            font:      { name: 'Calibri', sz: 8, bold: true, color: { rgb: '1E40AF' } },
            fill:      { fgColor: { rgb: 'EFF6FF' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border:    { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } },
          }
          const tamamlananAdim = adimlar.filter((a: any) => a.durum === 'tamamlandi').length
          ws[utils.encode_cell({ r: row, c: 0 })] = c(`  Surec Adimlari (${tamamlananAdim}/${adimlar.length})`, adimBaslikS)
          for (let i = 1; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', adimBaslikS)
          merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
          row++

          adimlar.forEach((adim: any) => {
            const tamam = adim.durum === 'tamamlandi'
            const devam = adim.durum === 'devam'
            const uyari = adim.durum === 'uyari'
            const renk = tamam ? '166534' : devam ? '92400E' : uyari ? '9A3412' : '64748B'
            const bg   = tamam ? 'F0FDF4' : devam ? 'FFFBEB' : uyari ? 'FFF7ED' : 'FAFAFA'
            const isaret = tamam ? 'V' : devam ? '...' : uyari ? '!' : 'O'
            const durumYazi = tamam ? 'Tamamlandi' : devam ? 'Devam Ediyor' : uyari ? 'Uyari' : 'Bekliyor'
            const tarih = adim.tamamlanma_tarihi
              ? new Date(adim.tamamlanma_tarihi).toLocaleDateString('tr-TR') : ''
            const adimS = {
              font:      { name: 'Calibri', sz: 8, color: { rgb: renk } },
              fill:      { fgColor: { rgb: bg } },
              alignment: { horizontal: 'left', vertical: 'center' },
              border:    { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } },
            }
            const adimSagS = { ...adimS, alignment: { horizontal: 'center', vertical: 'center' } }
            ws[utils.encode_cell({ r: row, c: 0 })] = c(`    ${isaret}  ${adim.adim_adi}`, adimS)
            ws[utils.encode_cell({ r: row, c: 1 })] = c(durumYazi, adimSagS)
            ws[utils.encode_cell({ r: row, c: 2 })] = c(tarih, adimSagS)
            ws[utils.encode_cell({ r: row, c: 3 })] = c(adim.tutar ? Number(adim.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL' : '', adimSagS)
            for (let i = 4; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', adimS)
            merges.push({ s: { r: row, c: 4 }, e: { r: row, c: COLS - 1 } })
            row++
          })
        }

        // Ön Kontrol Listesi — sadece KDV1 için
        if (is.is_tipi === 'kdv1') {
          const kayitlar = checklistMap[is.id] || {}
          const tumKontroller = KDV1_KONTROLLER.flatMap(g => g.kontroller)
          const tamamlanan = tumKontroller.filter(k => kayitlar[k.kodu]?.tamamlandi).length

          const clBaslikS = {
            font:      { name: 'Calibri', sz: 8, bold: true, color: { rgb: '166534' } },
            fill:      { fgColor: { rgb: 'F0FDF4' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border:    { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } },
          }
          ws[utils.encode_cell({ r: row, c: 0 })] = c(`  On Kontrol Listesi (${tamamlanan}/${tumKontroller.length})`, clBaslikS)
          for (let i = 1; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', clBaslikS)
          merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
          row++

          KDV1_KONTROLLER.forEach(grup => {
            grup.kontroller.forEach(k => {
              const tamam = kayitlar[k.kodu]?.tamamlandi === true
              const tarih = kayitlar[k.kodu]?.tamamlanma_tarihi
                ? new Date(kayitlar[k.kodu].tamamlanma_tarihi).toLocaleDateString('tr-TR') : ''
              const renk = tamam ? '166534' : '94A3B8'
              const bg   = tamam ? 'F0FDF4' : 'FAFAFA'
              const clS = {
                font:      { name: 'Calibri', sz: 8, color: { rgb: renk } },
                fill:      { fgColor: { rgb: bg } },
                alignment: { horizontal: 'left', vertical: 'center' },
                border:    { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } },
              }
              ws[utils.encode_cell({ r: row, c: 0 })] = c(`    ${tamam ? 'V' : 'O'}  ${k.adi}`, clS)
              ws[utils.encode_cell({ r: row, c: 1 })] = c(tamam ? 'Tamamlandi' : 'Bekliyor', { ...clS, alignment: { horizontal: 'center', vertical: 'center' } })
              ws[utils.encode_cell({ r: row, c: 2 })] = c(tarih, { ...clS, alignment: { horizontal: 'center', vertical: 'center' } })
              for (let i = 3; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', clS)
              merges.push({ s: { r: row, c: 3 }, e: { r: row, c: COLS - 1 } })
              row++
            })
          })
        }
      })
    })

    // Toplam satırı
    const toplamS = S.toplam
    ws[utils.encode_cell({ r: row, c: 0 })] = c('TOPLAM', toplamS)
    for (let i = 1; i < COLS - 2; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', toplamS)
    ws[utils.encode_cell({ r: row, c: COLS - 2 })] = c(`${isler.filter(i => i.durum === 'tamamlandi').length} Tamamlandı`, toplamS)
    ws[utils.encode_cell({ r: row, c: COLS - 1 })] = c(`${isler.length} Toplam`, toplamS)
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 3 } })
    row++

    // Alt not
    row++
    ws[utils.encode_cell({ r: row, c: 0 })] = c(
      `${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  ${isler.length} kayıt`,
      { font: { name: 'Calibri', sz: 8, italic: true, color: { rgb: '94A3B8' } } }
    )
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })

    ws['!cols'] = [
      { wch: 20 }, { wch: 12 }, { wch: 6 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 30 },
    ]
    ws['!rows'] = [{ hpt: 26 }, { hpt: 18 }, { hpt: 22 }]
    ws['!merges'] = merges
    ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })

    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'İş Takibi')
    writeFile(wb, `is-takibi-${firma.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Scroll to item after bildirim click
  useEffect(() => {
    if (!scrollToId) return
    setExpanded(scrollToId)
    setTimeout(() => {
      document.getElementById(`is-${scrollToId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setScrollToId(null)
    }, 100)
  }, [scrollToId])

  const bildirimler = useBildirimler(firma.id, isler)

  const filtered = useMemo(() => isler.filter(i => {
    if (tipFilter !== 'hepsi' && i.is_tipi !== tipFilter) return false
    if (yilFilter !== 'hepsi' && String(i.yil) !== yilFilter) return false
    return true
  }), [isler, tipFilter, yilFilter])

  const summary = useMemo(() => ({
    toplam:     isler.length,
    devam:      isler.filter(i => i.durum === 'devam').length,
    tamamlandi: isler.filter(i => i.durum === 'tamamlandi').length,
    uyari:      isler.filter(i => i.durum === 'uyari' || (i.durum !== 'tamamlandi' && i.son_odeme_tarihi && new Date(i.son_odeme_tarihi) < new Date())).length,
  }), [isler])

  const yillar = useMemo(() => {
    const set = new Set(isler.map(i => String(i.yil)))
    return Array.from(set).sort((a, b) => Number(b) - Number(a))
  }, [isler])

  async function saveIs() {
    if (!form.is_tipi || !form.donem) return alert('İş tipi ve dönem zorunludur')
    setSaving(true)

    const { data: newIs, error } = await supabase
      .from('is_takibi_v2')
      .insert({
        firma_id:         firma.id,
        is_tipi:          form.is_tipi,
        donem:            form.donem,
        yil:              Number(form.yil),
        ay:               ['kdv1','kdv2','muhtasar_sgk'].includes(form.is_tipi) ? Number(form.ay) : null,
        ceyrek:           form.is_tipi === 'gecici_vergi' ? Number(form.ceyrek) : null,
        son_beyan_tarihi: form.son_beyan_tarihi || null,
        son_odeme_tarihi: form.son_odeme_tarihi || null,
        durum:            'bekliyor',
        notlar:           form.notlar || null,
      })
      .select().single()

    if (error || !newIs) { setSaving(false); alert('Hata: ' + error?.message); return }

    // Süreç adımlarını oluştur
    const adimlar = ADIM_SABLONLARI[form.is_tipi] || []
    await supabase.from('is_takibi_adimlar').insert(
      adimlar.map((a, i) => ({
        is_id:    newIs.id,
        firma_id: firma.id,
        adim_kodu: a.kodu,
        adim_adi:  a.adi,
        sira:      i + 1,
        durum:     'bekliyor',
      }))
    )

    setSaving(false); setModal(false); load()
  }

  async function deleteIs(id: string) {
    await supabase.from('is_takibi_v2').delete().eq('id', id)
    setDelId(null); if (expanded === id) setExpanded(null); load()
  }

  const sf = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  // Dönem adını otomatik oluştur
  function updateDonem(tipi: string, ay: string, yil: string, ceyrek: string) {
    let donem = ''
    if (['kdv1','kdv2','muhtasar_sgk'].includes(tipi)) donem = `${yil}-${String(ay).padStart(2,'0')}`
    else if (tipi === 'gecici_vergi') donem = `${yil}-Q${ceyrek}`
    else if (tipi === 'kurumlar_vergisi') donem = `${yil}`
    else if (tipi === 'edefter') donem = `${yil}-${String(ay).padStart(2,'0')}`
    return donem
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileText className="w-5 h-5 text-violet-600" />}
        title="İş Takibi"
        subtitle="Vergi beyanname, tahakkuk ve ödeme süreçleri"
        iconBg="bg-violet-50"
        action={
          <div className="flex items-center gap-2">
            <BildirimPaneli bildirimler={bildirimler} onGit={id => setScrollToId(id)} />
            <Btn variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportExcel}>Excel</Btn>
            <Btn variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>Yenile</Btn>
            <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setModal(true)}>Yeni İş</Btn>
          </div>
        }
      />

      {/* Özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Toplam"      value={summary.toplam}     color="text-gray-700" />
        <StatCard label="Devam Eden"  value={summary.devam}      color="text-yellow-600" />
        <StatCard label="Tamamlanan"  value={summary.tamamlandi} color="text-green-600" />
        <StatCard label="Uyarı / Gecikmiş" value={summary.uyari} color="text-red-600" />
      </div>

      {/* Tip Filtreleri */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTipFilter('hepsi')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${tipFilter === 'hepsi' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
          Tümü
        </button>
        {IS_TIPLERI.map(t => (
          <button key={t.v} onClick={() => setTipFilter(tipFilter === t.v ? 'hepsi' : t.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${tipFilter === t.v ? `${t.bg} ${t.text} ${t.border}` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {t.icon} {t.l}
          </button>
        ))}
        <select value={yilFilter} onChange={e => setYilFilter(e.target.value)} className={`${inputCls} w-auto text-xs py-1.5`}>
          <option value="hepsi">Tüm Yıllar</option>
          {yillar.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Master Grid */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FileText className="w-12 h-12" />} message="İş kaydı bulunamadı" />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(is => (
              <IsSatiri
                key={is.id}
                is={is}
                firma={firma}
                expanded={expanded === is.id}
                onToggle={() => setExpanded(expanded === is.id ? null : is.id)}
                onDelete={() => setDelId(is.id)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Yeni İş Modal */}
      {modal && (
        <Modal title="Yeni İş Kaydı" onClose={() => setModal(false)} size="lg"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={saveIs} disabled={saving}>{saving ? 'Oluşturuluyor...' : 'Oluştur'}</Btn></>}>
          <div className="space-y-5">
            <div className="bg-violet-50 rounded-lg p-3 text-sm text-violet-700">
              Kayıt oluşturulduğunda süreç adımları otomatik eklenir: <strong>Beyanname → Tahakkuk → Ödeme → Dekont</strong>
            </div>

            {/* İş Tipi Seçimi */}
            <Field label="İş Tipi" required>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {IS_TIPLERI.map(t => (
                  <button key={t.v} type="button"
                    onClick={() => {
                      const donem = updateDonem(t.v, form.ay, form.yil, form.ceyrek)
                      setForm(p => ({ ...p, is_tipi: t.v, donem }))
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.is_tipi === t.v ? `${t.bg} ${t.text} ${t.border}` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <span>{t.icon}</span>{t.l}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Yıl" required>
                <select value={form.yil} onChange={e => {
                  const yil = e.target.value
                  setForm(p => ({ ...p, yil, donem: updateDonem(p.is_tipi, p.ay, yil, p.ceyrek) }))
                }} className={inputCls}>
                  {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>

              {['kdv1','kdv2','muhtasar_sgk','edefter'].includes(form.is_tipi) && (
                <Field label="Ay" required>
                  <select value={form.ay} onChange={e => {
                    const ay = e.target.value
                    setForm(p => ({ ...p, ay, donem: updateDonem(p.is_tipi, ay, p.yil, p.ceyrek) }))
                  }} className={inputCls}>
                    {AYLAR.map((a, i) => <option key={i+1} value={i+1}>{a}</option>)}
                  </select>
                </Field>
              )}

              {form.is_tipi === 'gecici_vergi' && (
                <Field label="Çeyrek" required>
                  <select value={form.ceyrek} onChange={e => {
                    const ceyrek = e.target.value
                    setForm(p => ({ ...p, ceyrek, donem: updateDonem(p.is_tipi, p.ay, p.yil, ceyrek) }))
                  }} className={inputCls}>
                    {[1,2,3,4].map(q => <option key={q} value={q}>{q}. Çeyrek</option>)}
                  </select>
                </Field>
              )}

              <Field label="Dönem">
                <input type="text" value={form.donem} onChange={sf('donem')} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Son Beyan Tarihi">
                <input type="date" value={form.son_beyan_tarihi} onChange={sf('son_beyan_tarihi')} className={inputCls} />
              </Field>
              <Field label="Son Ödeme Tarihi">
                <input type="date" value={form.son_odeme_tarihi} onChange={sf('son_odeme_tarihi')} className={inputCls} />
              </Field>
            </div>

            <Field label="Notlar">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu iş kaydını ve tüm belgelerini silmek istediğinize emin misiniz?"
          onConfirm={() => deleteIs(delId)} onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}

// ─── İş Satırı (Master + Detail) ─────────────────────────────
interface IsSatiriProps {
  is: any
  firma: { id: string; ad: string }
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onRefresh: () => void
}

function IsSatiri({ is, firma, expanded, onToggle, onDelete, onRefresh }: IsSatiriProps) {
  const [adimlar, setAdimlar]   = useState<any[]>([])
  const [belgeler, setBelgeler] = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const tip = IS_TIPLERI.find(t => t.v === is.is_tipi)
  const durumCfg = DURUM_CFG[is.durum as Durum] || DURUM_CFG.bekliyor
  const DurumIcon = durumCfg.icon

  // Gecikme kontrolü
  const bugun = new Date(); bugun.setHours(0,0,0,0)
  const beyanGecikti = is.son_beyan_tarihi && new Date(is.son_beyan_tarihi) < bugun && is.durum !== 'tamamlandi'
  const odemeGecikti = is.son_odeme_tarihi && new Date(is.son_odeme_tarihi) < bugun && is.durum !== 'tamamlandi'

  useEffect(() => {
    if (expanded && adimlar.length === 0) loadDetail()
  }, [expanded])

  async function loadDetail() {
    setLoadingDetail(true)
    const [a, b] = await Promise.all([
      supabase.from('is_takibi_adimlar').select('*').eq('is_id', is.id).order('sira'),
      supabase.from('is_takibi_belgeler').select('*').eq('is_id', is.id).order('created_at'),
    ])
    setAdimlar(a.data || [])
    setBelgeler(b.data || [])
    setLoadingDetail(false)
  }

  async function updateAdim(adimId: string, durum: Durum, tutar?: number) {
    await supabase.from('is_takibi_adimlar').update({
      durum,
      tamamlanma_tarihi: durum === 'tamamlandi' ? new Date().toISOString() : null,
      ...(tutar !== undefined ? { tutar } : {}),
    }).eq('id', adimId)

    // Tüm adımlar tamamlandıysa ana iş de tamamlandı
    const yeniAdimlar = adimlar.map(a => a.id === adimId ? { ...a, durum } : a)
    const hepsiTamamlandi = yeniAdimlar.every(a => a.durum === 'tamamlandi')
    const birDevam = yeniAdimlar.some(a => a.durum === 'devam' || a.durum === 'tamamlandi')

    await supabase.from('is_takibi_v2').update({
      durum: hepsiTamamlandi ? 'tamamlandi' : birDevam ? 'devam' : 'bekliyor',
      updated_at: new Date().toISOString(),
    }).eq('id', is.id)

    loadDetail()
    onRefresh()
  }

  const tamamlanan = adimlar.filter(a => a.durum === 'tamamlandi').length
  const ilerleme   = adimlar.length > 0 ? Math.round((tamamlanan / adimlar.length) * 100) : 0

  return (
    <div id={`is-${is.id}`}>
      {/* Master Satır */}
      <div className={`flex items-center gap-3 px-4 py-4 hover:bg-gray-50 cursor-pointer ${beyanGecikti || odemeGecikti ? 'bg-red-50/30' : ''}`}
        onClick={onToggle}>
        <span className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        {/* Tip Rozeti */}
        <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border ${tip?.bg} ${tip?.text} ${tip?.border}`}>
          {tip?.icon} {tip?.l}
        </div>

        {/* Dönem & Bilgi */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{is.donem}</span>
            <Badge label={durumCfg.l} variant={durumCfg.badge as any} />
            {beyanGecikti && <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Beyan gecikti</span>}
            {odemeGecikti && <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Ödeme gecikti</span>}
            {is.son_beyan_tarihi && !beyanGecikti && (
              <span className="text-xs text-gray-400">Beyan: {fmtDate(is.son_beyan_tarihi)}</span>
            )}
            {is.son_odeme_tarihi && !odemeGecikti && (
              <span className="text-xs text-gray-400">Ödeme: {fmtDate(is.son_odeme_tarihi)}</span>
            )}
          </div>
          {adimlar.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${ilerleme === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${ilerleme}%` }} />
              </div>
              <span className="text-xs text-gray-400">{tamamlanan}/{adimlar.length}</span>
            </div>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail Panel */}
      {expanded && (
        <div className="bg-slate-50 border-t border-gray-200 px-4 py-5">
          {loadingDetail ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* KDV1 ise ön kontrol checklist göster */}
              {is.is_tipi === 'kdv1' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded flex items-center justify-center text-xs font-bold">1</span>
                    Ön Kontrol Listesi
                  </h3>
                  <Kdv1Checklist isId={is.id} firmaId={firma.id} />
                </div>
              )}

              {/* Süreç Adımları */}
              <div>
                {is.is_tipi === 'kdv1' && (
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-violet-100 text-violet-700 rounded flex items-center justify-center text-xs font-bold">2</span>
                    Süreç Adımları
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {adimlar.map(adim => {
                const adimBelgeler = belgeler.filter(b => b.adim_kodu === adim.adim_kodu)
                const adimDurum = DURUM_CFG[adim.durum as Durum] || DURUM_CFG.bekliyor
                const AdimIcon = adimDurum.icon

                return (
                  <div key={adim.id}
                    className={`bg-white rounded-xl border-2 transition-all ${
                      adim.durum === 'tamamlandi' ? 'border-green-200' :
                      adim.durum === 'devam'      ? 'border-yellow-300' :
                      adim.durum === 'uyari'      ? 'border-orange-300' : 'border-gray-200'
                    }`}>
                    {/* Adım Başlık */}
                    <div className={`px-4 py-3 border-b rounded-t-xl ${
                      adim.durum === 'tamamlandi' ? 'bg-green-50 border-green-100' :
                      adim.durum === 'devam'      ? 'bg-yellow-50 border-yellow-100' :
                      adim.durum === 'uyari'      ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">{adim.adim_adi}</span>
                        <AdimIcon className={`w-4 h-4 flex-shrink-0 ${
                          adim.durum === 'tamamlandi' ? 'text-green-500' :
                          adim.durum === 'devam'      ? 'text-yellow-500' :
                          adim.durum === 'uyari'      ? 'text-orange-500' : 'text-gray-400'
                        }`} />
                      </div>
                      <Badge label={adimDurum.l} variant={adimDurum.badge as any} />
                      {adim.tamamlanma_tarihi && (
                        <p className="text-xs text-gray-400 mt-1">{fmtDate(adim.tamamlanma_tarihi)}</p>
                      )}
                    </div>

                    {/* Belgeler */}
                    <div className="px-3 py-2 space-y-1.5 min-h-[60px]">
                      {adimBelgeler.map((b: any) => (
                        <BelgeItem key={b.id} belge={b} onDelete={loadDetail} />
                      ))}
                      {adimBelgeler.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">Belge yüklenmedi</p>
                      )}
                    </div>

                    {/* Aksiyonlar */}
                    <div className="px-3 pb-3 space-y-2">
                      <BelgeYukle isId={is.id} firmaId={firma.id} adimKodu={adim.adim_kodu} onUploaded={loadDetail} />

                      <div className="flex gap-1">
                        {adim.durum !== 'devam' && adim.durum !== 'tamamlandi' && (
                          <button onClick={() => updateAdim(adim.id, 'devam')}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium border border-yellow-200 transition-colors">
                            Devam Ediyor
                          </button>
                        )}
                        {adim.durum !== 'tamamlandi' && (
                          <button onClick={() => updateAdim(adim.id, 'tamamlandi')}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium border border-green-200 transition-colors">
                            ✓ Tamamlandı
                          </button>
                        )}
                        {adim.durum === 'tamamlandi' && (
                          <button onClick={() => updateAdim(adim.id, 'bekliyor')}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition-colors">
                            Geri Al
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Belge Yükleme ────────────────────────────────────────────
function BelgeYukle({ isId, firmaId, adimKodu, onUploaded }: { isId: string; firmaId: string; adimKodu: string; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const safeName = file.name
      .replace(/[ğ]/g,'g').replace(/[Ğ]/g,'G')
      .replace(/[ü]/g,'u').replace(/[Ü]/g,'U')
      .replace(/[ş]/g,'s').replace(/[Ş]/g,'S')
      .replace(/[ı]/g,'i').replace(/[İ]/g,'I')
      .replace(/[ö]/g,'o').replace(/[Ö]/g,'O')
      .replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
      .replace(/[^a-zA-Z0-9._-]/g,'_')
      .replace(/_+/g,'_')

    const path = `${firmaId}/${isId}/${adimKodu}/${Date.now()}_${safeName}`

    const { error: upErr } = await supabase.storage.from('is-takibi-belgeler').upload(path, file)
    if (upErr) { alert('Yükleme hatası: ' + upErr.message); setUploading(false); return }

    await supabase.from('is_takibi_belgeler').insert({
      is_id: isId, firma_id: firmaId, adim_kodu: adimKodu,
      belge_tipi: ext, dosya_adi: file.name, storage_path: path,
    })

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    onUploaded()
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
        onChange={handleFile} className="hidden" id={`up-${isId}-${adimKodu}`} />
      <label htmlFor={`up-${isId}-${adimKodu}`}
        className={`flex items-center justify-center gap-1.5 w-full text-xs py-1.5 rounded-lg border border-dashed cursor-pointer transition-colors ${uploading ? 'border-gray-300 text-gray-400 cursor-not-allowed' : 'border-violet-300 text-violet-600 hover:bg-violet-50'}`}>
        {uploading ? <><div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />Yükleniyor...</> : <><Upload className="w-3 h-3" />PDF / Excel Yükle</>}
      </label>
    </div>
  )
}

// ─── Belge Satırı ─────────────────────────────────────────────
function BelgeItem({ belge, onDelete }: { belge: any; onDelete: () => void }) {
  const [previewing, setPreviewing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const ICONS: Record<string, string> = { pdf: '📄', xlsx: '📊', xls: '📊', jpg: '🖼', jpeg: '🖼', png: '🖼' }
  const icon = ICONS[belge.belge_tipi] || '📎'
  const isImage = ['jpg','jpeg','png'].includes(belge.belge_tipi)

  async function preview() {
    const { data } = await supabase.storage.from('is-takibi-belgeler').createSignedUrl(belge.storage_path, 60)
    if (data?.signedUrl) { setPreviewUrl(data.signedUrl); setPreviewing(true) }
  }

  async function download() {
    const { data } = await supabase.storage.from('is-takibi-belgeler').createSignedUrl(belge.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = belge.dosya_adi; a.click() }
  }

  async function del() {
    if (!confirm(`"${belge.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('is-takibi-belgeler').remove([belge.storage_path])
    await supabase.from('is_takibi_belgeler').delete().eq('id', belge.id)
    onDelete()
  }

  return (
    <>
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5 group">
        <span className="text-sm flex-shrink-0">{icon}</span>
        <span className="text-xs text-gray-700 truncate flex-1 min-w-0" title={belge.dosya_adi}>{belge.dosya_adi}</span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={preview}   className="p-0.5 text-gray-400 hover:text-blue-600"  title="Görüntüle"><Eye      className="w-3 h-3" /></button>
          <button onClick={download}  className="p-0.5 text-gray-400 hover:text-green-600" title="İndir">   <Download className="w-3 h-3" /></button>
          <button onClick={del}       className="p-0.5 text-gray-400 hover:text-red-500"   title="Sil">     <Trash2   className="w-3 h-3" /></button>
        </div>
      </div>

      {previewing && previewUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm truncate">{belge.dosya_adi}</span>
              <div className="flex gap-2">
                <button onClick={download} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" />İndir</button>
                <button onClick={() => { setPreviewing(false); setPreviewUrl(null) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isImage
                ? <img src={previewUrl} alt={belge.dosya_adi} className="max-w-full mx-auto rounded" />
                : belge.belge_tipi === 'pdf'
                ? <iframe src={previewUrl} className="w-full h-[70vh] rounded border" title={belge.dosya_adi} />
                : <div className="text-center py-12 text-gray-500"><p className="mb-4">Bu dosya türü önizlenemiyor.</p><button onClick={download} className="text-blue-600 hover:underline text-sm">İndirmek için tıklayın</button></div>
              }
            </div>
          </div>
        </div>
      )}
    </>
  )
}
