'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { Wallet, Landmark, Plus, Trash2, ArrowDownRight, ArrowUpRight, RefreshCw, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, StatCard, Card, Modal, Btn, Field, inputCls, ConfirmDialog, EmptyState, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { KasaHareketi, BankaHesabi } from '@/types'

type Tab = 'kasa' | 'banka'

export default function KasaModule({ firma }: AppCtx) {
  const [tab, setTab]           = useState<Tab>('kasa')
  const [hareketler, setHareketler] = useState<KasaHareketi[]>([])
  const [bankalar, setBankalar] = useState<BankaHesabi[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<Tab | null>(null)
  const [delId, setDelId]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)

  const [kForm, setKForm] = useState({ islem_tipi: 'giris', tutar: '', aciklama: '', tarih: today() })
  const [bForm, setBForm] = useState({ banka_adi: '', sube_adi: '', iban: '', bakiye: '' })

  function today() { return new Date().toISOString().split('T')[0] }

  async function load() {
    setLoading(true)
    const [k, b] = await Promise.all([
      supabase.from('kasa_hareketleri').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }),
      supabase.from('banka_hesaplari').select('*').eq('firma_id', firma.id).order('banka_adi'),
    ])
    setHareketler(k.data || [])
    setBankalar(b.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [firma.id])

  const kasaBakiye = useMemo(() =>
    hareketler.reduce((s, r) => r.islem_tipi === 'giris' ? s + Number(r.tutar) : s - Number(r.tutar), 0)
  , [hareketler])

  const bankaToplam = useMemo(() =>
    bankalar.reduce((s, b) => s + Number(b.bakiye), 0)
  , [bankalar])

  async function saveKasa() {
    if (!kForm.tutar || !kForm.aciklama) return alert('Tutar ve açıklama zorunludur')
    setSaving(true)
    await supabase.from('kasa_hareketleri').insert({
      firma_id: firma.id,
      islem_tipi: kForm.islem_tipi,
      tutar: Number(kForm.tutar),
      aciklama: kForm.aciklama,
      tarih: kForm.tarih,
    })
    setSaving(false)
    setModal(null)
    setKForm({ islem_tipi: 'giris', tutar: '', aciklama: '', tarih: today() })
    load()
  }

  async function saveBanka() {
    if (!bForm.banka_adi) return alert('Banka adı zorunludur')
    setSaving(true)
    await supabase.from('banka_hesaplari').insert({
      firma_id: firma.id,
      banka_adi: bForm.banka_adi,
      sube_adi: bForm.sube_adi || null,
      iban: bForm.iban || null,
      bakiye: Number(bForm.bakiye) || 0,
    })
    setSaving(false)
    setModal(null)
    setBForm({ banka_adi: '', sube_adi: '', iban: '', bakiye: '' })
    load()
  }

  async function deleteHareket(id: string) {
    await supabase.from('kasa_hareketleri').delete().eq('id', id)
    setDelId(null)
    load()
  }

  // ─── Kasa Excel Export ────────────────────────────────────
  async function exportKasaExcel() {
    const XLSXStyle = await import('xlsx-js-style')
    const { utils, writeFile } = XLSXStyle

    const KOYU  = '0F172A'
    const BEYAZ = 'FFFFFF'
    const ACIK  = 'F8FAFC'
    const SINIR = 'E2E8F0'
    const YESIL = '166534'
    const KIRMIZI = '991B1B'
    const MAVI  = '1E40AF'

    const S = {
      baslik: { font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'left', vertical: 'center' } },
      tarih:  { font: { name: 'Calibri', sz: 9,  color: { rgb: 'BFDBFE' } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'right', vertical: 'center' } },
      ozet:   { font: { name: 'Calibri', sz: 9,  color: { rgb: '64748B' } }, fill: { fgColor: { rgb: ACIK } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      ozetVal:{ font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: KOYU } }, fill: { fgColor: { rgb: ACIK } }, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '#,##0.00 ₺', border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      th:     { font: { name: 'Calibri', sz: 9,  bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: MAVI } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'medium', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      tdNorm: { font: { name: 'Calibri', sz: 9,  color: { rgb: KOYU } }, fill: { fgColor: { rgb: BEYAZ } }, alignment: { vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      tdZebra:{ font: { name: 'Calibri', sz: 9,  color: { rgb: KOYU } }, fill: { fgColor: { rgb: ACIK } }, alignment: { vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      giris:  { font: { name: 'Calibri', sz: 9,  bold: true, color: { rgb: YESIL } }, fill: { fgColor: { rgb: 'F0FDF4' } }, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0.00 ₺', border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      cikis:  { font: { name: 'Calibri', sz: 9,  bold: true, color: { rgb: KIRMIZI } }, fill: { fgColor: { rgb: 'FEF2F2' } }, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0.00 ₺', border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      toplam: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0.00 ₺', border: { top: { style: 'medium', color: { rgb: KOYU } }, bottom: { style: 'medium', color: { rgb: KOYU } }, left: { style: 'thin', color: { rgb: KOYU } }, right: { style: 'thin', color: { rgb: KOYU } } } },
      toplamL:{ font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: { top: { style: 'medium', color: { rgb: KOYU } }, bottom: { style: 'medium', color: { rgb: KOYU } }, left: { style: 'thin', color: { rgb: KOYU } }, right: { style: 'thin', color: { rgb: KOYU } } } },
    }

    const c = (v: any, s: any) => ({ v, s, t: typeof v === 'number' ? 'n' : 's' })
    const COLS = 4
    const ws: any = {}
    const merges: any[] = []
    let row = 0

    // Başlık bandı
    ws[utils.encode_cell({ r: row, c: 0 })] = c(firma.ad.toUpperCase() + ' — KASA HAREKETLERİ', S.baslik)
    for (let i = 1; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', S.baslik)
    ws[utils.encode_cell({ r: row, c: COLS - 1 })] = c(new Date().toLocaleDateString('tr-TR'), S.tarih)
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
    row++

    // Özet satırı
    const toplamGiris = hareketler.filter(h => h.islem_tipi === 'giris').reduce((s, h) => s + Number(h.tutar), 0)
    const toplamCikis = hareketler.filter(h => h.islem_tipi === 'cikis').reduce((s, h) => s + Number(h.tutar), 0)
    const ozet = [
      { l: 'TOPLAM GİRİŞ', v: toplamGiris },
      { l: 'TOPLAM ÇIKIŞ', v: toplamCikis },
      { l: 'NET BAKİYE',   v: kasaBakiye  },
    ]
    ozet.forEach((o, i) => {
      ws[utils.encode_cell({ r: row, c: i })] = c(o.l, S.ozet)
      merges.push({ s: { r: row, c: i }, e: { r: row, c: i } })
    })
    ws[utils.encode_cell({ r: row, c: 3 })] = c('', S.ozet)
    row++
    ozet.forEach((o, i) => {
      ws[utils.encode_cell({ r: row, c: i })] = { v: o.v, s: S.ozetVal, t: 'n' }
    })
    ws[utils.encode_cell({ r: row, c: 3 })] = c('', S.ozetVal)
    row++

    // Boş satır
    for (let i = 0; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', {})
    row++

    // Tablo başlığı
    const headers = ['Tarih', 'Açıklama', 'İşlem Tipi', 'Tutar (₺)']
    headers.forEach((h, i) => { ws[utils.encode_cell({ r: row, c: i })] = c(h, S.th) })
    row++

    // Veri satırları
    hareketler.forEach((h, idx) => {
      const isZebra = idx % 2 === 1
      const td = isZebra ? S.tdZebra : S.tdNorm
      const tutarS = h.islem_tipi === 'giris' ? S.giris : S.cikis
      const cells = [
        c(fmtDate(h.tarih), td),
        c(h.aciklama || '-', td),
        c(h.islem_tipi === 'giris' ? 'Giriş ↑' : 'Çıkış ↓', h.islem_tipi === 'giris' ? { ...td, font: { ...td.font, color: { rgb: YESIL } } } : { ...td, font: { ...td.font, color: { rgb: KIRMIZI } } }),
        { v: Number(h.tutar), s: tutarS, t: 'n' },
      ]
      cells.forEach((cell, i) => { ws[utils.encode_cell({ r: row, c: i })] = cell })
      row++
    })

    // Toplam satırı
    ws[utils.encode_cell({ r: row, c: 0 })] = c('', S.toplamL)
    ws[utils.encode_cell({ r: row, c: 1 })] = c('', S.toplamL)
    ws[utils.encode_cell({ r: row, c: 2 })] = c('NET BAKİYE', S.toplamL)
    ws[utils.encode_cell({ r: row, c: 3 })] = { v: kasaBakiye, s: S.toplam, t: 'n' }
    row++

    // Alt not
    row++
    ws[utils.encode_cell({ r: row, c: 0 })] = c(`${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  ${hareketler.length} işlem`, { font: { name: 'Calibri', sz: 8, italic: true, color: { rgb: '94A3B8' } } })
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })

    ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 18 }]
    ws['!rows'] = [{ hpt: 26 }, { hpt: 18 }, { hpt: 22 }]
    ws['!merges'] = merges
    ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })

    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Kasa Hareketleri')
    writeFile(wb, `kasa-${firma.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ─── Banka Excel Export ───────────────────────────────────
  async function exportBankaExcel() {
    const XLSXStyle = await import('xlsx-js-style')
    const { utils, writeFile } = XLSXStyle

    const KOYU  = '0F172A'
    const BEYAZ = 'FFFFFF'
    const ACIK  = 'F8FAFC'
    const SINIR = 'E2E8F0'
    const MAVI  = '1E40AF'
    const MAVI2 = '1D4ED8'

    const S = {
      baslik: { font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'left', vertical: 'center' } },
      tarih:  { font: { name: 'Calibri', sz: 9,  color: { rgb: 'BFDBFE' } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'right', vertical: 'center' } },
      th:     { font: { name: 'Calibri', sz: 9,  bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: MAVI } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'medium', color: { rgb: MAVI2 } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      tdNorm: { font: { name: 'Calibri', sz: 9,  color: { rgb: KOYU } }, fill: { fgColor: { rgb: BEYAZ } }, alignment: { vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      tdZebra:{ font: { name: 'Calibri', sz: 9,  color: { rgb: KOYU } }, fill: { fgColor: { rgb: ACIK } }, alignment: { vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      bakiye: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: MAVI } }, fill: { fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0.00 ₺', border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      toplam: { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0.00 ₺', border: { top: { style: 'medium', color: { rgb: KOYU } }, bottom: { style: 'medium', color: { rgb: KOYU } }, left: { style: 'thin', color: { rgb: KOYU } }, right: { style: 'thin', color: { rgb: KOYU } } } },
      toplamL:{ font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: { top: { style: 'medium', color: { rgb: KOYU } }, bottom: { style: 'medium', color: { rgb: KOYU } }, left: { style: 'thin', color: { rgb: KOYU } }, right: { style: 'thin', color: { rgb: KOYU } } } },
    }

    const c = (v: any, s: any) => ({ v, s, t: typeof v === 'number' ? 'n' : 's' })
    const COLS = 5
    const ws: any = {}
    const merges: any[] = []
    let row = 0

    // Başlık
    ws[utils.encode_cell({ r: row, c: 0 })] = c(firma.ad.toUpperCase() + ' — BANKA HESAPLARI', S.baslik)
    for (let i = 1; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', S.baslik)
    ws[utils.encode_cell({ r: row, c: COLS - 1 })] = c(new Date().toLocaleDateString('tr-TR'), S.tarih)
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
    row++

    // Boş
    for (let i = 0; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', {})
    row++

    // Tablo başlığı
    const headers = ['Banka Adı', 'Şube', 'IBAN', 'Hesap No', 'Bakiye (₺)']
    headers.forEach((h, i) => { ws[utils.encode_cell({ r: row, c: i })] = c(h, S.th) })
    row++

    // Veri
    bankalar.forEach((b, idx) => {
      const td = idx % 2 === 1 ? S.tdZebra : S.tdNorm
      const cells = [
        c(b.banka_adi, td),
        c(b.sube_adi || '-', td),
        c(b.iban || '-', { ...td, font: { ...td.font, name: 'Courier New' } }),
        c(b.hesap_no || '-', td),
        { v: Number(b.bakiye), s: S.bakiye, t: 'n' },
      ]
      cells.forEach((cell, i) => { ws[utils.encode_cell({ r: row, c: i })] = cell })
      row++
    })

    // Toplam
    for (let i = 0; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = c(i === COLS - 2 ? 'TOPLAM BAKİYE' : '', S.toplamL)
    ws[utils.encode_cell({ r: row, c: COLS - 1 })] = { v: bankaToplam, s: S.toplam, t: 'n' }
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
    row++

    // Alt not
    row++
    ws[utils.encode_cell({ r: row, c: 0 })] = c(`${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  ${bankalar.length} hesap`, { font: { name: 'Calibri', sz: 8, italic: true, color: { rgb: '94A3B8' } } })
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })

    ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 18 }]
    ws['!rows'] = [{ hpt: 26 }]
    ws['!merges'] = merges
    ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })

    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Banka Hesapları')
    writeFile(wb, `banka-${firma.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wallet className="w-5 h-5 text-emerald-600" />}
        title="Kasa & Banka"
        subtitle="Nakit ve banka hareketleri"
        iconBg="bg-emerald-50"
        action={
          <div className="flex gap-2">
            {tab === 'kasa' && (
              <Btn variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportKasaExcel}>
                Excel
              </Btn>
            )}
            {tab === 'banka' && (
              <Btn variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportBankaExcel}>
                Excel
              </Btn>
            )}
            <Btn variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>Yenile</Btn>
            <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setModal(tab)}>
              {tab === 'kasa' ? 'Kasa İşlemi' : 'Banka Ekle'}
            </Btn>
          </div>
        }
      />

      {/* Özet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Nakit Kasa" value={fmt(kasaBakiye)}
          icon={<Wallet className="w-6 h-6" />}
          color={kasaBakiye < 0 ? 'text-red-600' : 'text-emerald-600'} />
        <StatCard label="Toplam Banka" value={fmt(bankaToplam)}
          icon={<Landmark className="w-6 h-6" />} color="text-blue-600" />
      </div>

      {/* Sekmeler */}
      <Card>
        <div className="flex border-b border-gray-200 px-4">
          {(['kasa', 'banka'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'kasa' ? 'Kasa Hareketleri' : 'Banka Hesapları'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : tab === 'kasa' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Tarih', 'Açıklama', 'Tutar', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hareketler.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.tarih)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.islem_tipi === 'giris'
                          ? <ArrowDownRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          : <ArrowUpRight className="w-4 h-4 text-rose-500 flex-shrink-0" />}
                        <span className="text-sm text-gray-800">{r.aciklama || '-'}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold whitespace-nowrap ${r.islem_tipi === 'giris' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {r.islem_tipi === 'giris' ? '+' : '-'} {fmt(Number(r.tutar))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDelId(r.id)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hareketler.length === 0 && <EmptyState icon={<Wallet className="w-10 h-10" />} message="Kasa hareketi yok" />}
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bankalar.map(b => (
              <div key={b.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Landmark className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">{b.banka_adi}</span>
                </div>
                {b.sube_adi && <p className="text-xs text-gray-500 mb-1">{b.sube_adi}</p>}
                {b.iban && <p className="text-xs font-mono text-gray-600 mb-3">{b.iban}</p>}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Bakiye</p>
                  <p className="text-xl font-bold text-blue-700">{fmt(Number(b.bakiye))}</p>
                </div>
              </div>
            ))}
            {bankalar.length === 0 && <div className="col-span-full"><EmptyState icon={<Landmark className="w-10 h-10" />} message="Banka hesabı yok" /></div>}
          </div>
        )}
      </Card>

      {/* Kasa Modal */}
      {modal === 'kasa' && (
        <Modal title="Yeni Kasa İşlemi" onClose={() => setModal(null)}
          footer={<><Btn variant="secondary" onClick={() => setModal(null)}>İptal</Btn><Btn onClick={saveKasa} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <Field label="İşlem Tipi" required>
              <select value={kForm.islem_tipi} onChange={e => setKForm({ ...kForm, islem_tipi: e.target.value })} className={inputCls}>
                <option value="giris">Tahsilat / Giriş</option>
                <option value="cikis">Ödeme / Çıkış</option>
              </select>
            </Field>
            <Field label="Tutar (₺)" required>
              <input type="number" step="0.01" value={kForm.tutar} onChange={e => setKForm({ ...kForm, tutar: e.target.value })} className={inputCls} placeholder="0.00" />
            </Field>
            <Field label="Tarih" required>
              <input type="date" value={kForm.tarih} onChange={e => setKForm({ ...kForm, tarih: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Açıklama" required>
              <textarea rows={2} value={kForm.aciklama} onChange={e => setKForm({ ...kForm, aciklama: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {/* Banka Modal */}
      {modal === 'banka' && (
        <Modal title="Yeni Banka Hesabı" onClose={() => setModal(null)}
          footer={<><Btn variant="secondary" onClick={() => setModal(null)}>İptal</Btn><Btn onClick={saveBanka} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <Field label="Banka Adı" required>
              <input type="text" value={bForm.banka_adi} onChange={e => setBForm({ ...bForm, banka_adi: e.target.value })} className={inputCls} placeholder="Garanti BBVA" />
            </Field>
            <Field label="Şube Adı">
              <input type="text" value={bForm.sube_adi} onChange={e => setBForm({ ...bForm, sube_adi: e.target.value })} className={inputCls} />
            </Field>
            <Field label="IBAN">
              <input type="text" value={bForm.iban} onChange={e => setBForm({ ...bForm, iban: e.target.value })} className={`${inputCls} font-mono`} placeholder="TR..." />
            </Field>
            <Field label="Açılış Bakiyesi (₺)">
              <input type="number" step="0.01" value={bForm.bakiye} onChange={e => setBForm({ ...bForm, bakiye: e.target.value })} className={inputCls} placeholder="0.00" />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu kasa işlemini silmek istediğinize emin misiniz?"
          onConfirm={() => deleteHareket(delId)} onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}
