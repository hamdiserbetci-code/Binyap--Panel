'use client'
import React, { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Plus, Edit, Trash2, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, Modal, Btn, Field, inputCls, ConfirmDialog, EmptyState, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'

const empty = {
  donem: '', baslangic_tarihi: '', bitis_tarihi: '',
  // Gelirler
  hakedisler:           '0',
  yillara_yaygin_gelir: '0',
  diger_gelirler:       '0',
  // Giderler
  donem_basi_stok:      '0',
  malzeme_giderleri:    '0',
  iscilik_giderleri:    '0',
  genel_giderler:       '0',
  finans_giderleri:     '0',
  yillara_yaygin_gider: '0',
  diger_giderler:       '0',
  notlar: '',
}

type FormType = typeof empty

function calc(f: FormType) {
  const gelir =
    Number(f.hakedisler) +
    Number(f.diger_gelirler)

  const yayginGelir = Number(f.yillara_yaygin_gelir)

  const gider =
    Number(f.donem_basi_stok) +
    Number(f.malzeme_giderleri) +
    Number(f.iscilik_giderleri) +
    Number(f.genel_giderler) +
    Number(f.finans_giderleri) +
    Number(f.diger_giderler)

  const yayginGider = Number(f.yillara_yaygin_gider)

  // Net = sadece normal gelir - normal gider (yıllara yaygın bilgi amaçlı, net'e dahil değil)
  return { gelir, yayginGelir, gider, yayginGider, toplamGelir: gelir, toplamGider: gider, net: gelir - gider }
}

export default function KarZararModule({ firma }: AppCtx) {
  const [data, setData]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [delId, setDelId]   = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState(empty)

  async function load() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('kar_zarar').select('*')
      .eq('firma_id', firma.id)
      .order('donem', { ascending: false })
    if (error) console.error('Kar-Zarar:', error.message)
    setData(rows || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  async function exportExcel() {
    const XLSXStyle = await import('xlsx-js-style')
    const { utils, writeFile } = XLSXStyle

    const KOYU    = '0F172A'; const BEYAZ = 'FFFFFF'; const ACIK = 'F8FAFC'
    const SINIR   = 'E2E8F0'; const MAVI  = '1E40AF'
    const YESIL   = '166534'; const KIRMIZI = '991B1B'

    const border = { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } }
    const borderMedium = { top: { style: 'medium', color: { rgb: KOYU } }, bottom: { style: 'medium', color: { rgb: KOYU } }, left: { style: 'thin', color: { rgb: KOYU } }, right: { style: 'thin', color: { rgb: KOYU } } }

    // Stil tanımları
    const S = {
      baslik:       { font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'left', vertical: 'center' } },
      tarih:        { font: { name: 'Calibri', sz: 9, color: { rgb: 'BFDBFE' } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'right', vertical: 'center' } },
      kalemBaslik:  (renk: string) => ({ font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: renk } }, alignment: { horizontal: 'left', vertical: 'center' }, border }),
      kalemEtiket:  { font: { name: 'Calibri', sz: 9, color: { rgb: '475569' } }, fill: { fgColor: { rgb: ACIK } }, alignment: { horizontal: 'left', vertical: 'center' }, border },
      donemTh:      (idx: number) => ({ font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: idx % 2 === 0 ? '1E3A5F' : MAVI } }, alignment: { horizontal: 'center', vertical: 'center' }, border }),
      para:         (renk: string, bg: string) => ({ font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: renk } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0.00 \u20BA', border }),
      toplamEtiket: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderMedium },
      toplamPara:   (renk: string) => ({ font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: renk } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0.00 \u20BA', border: borderMedium }),
    }

    const c = (v: any, s: any) => ({ v: v ?? '', s, t: typeof v === 'number' ? 'n' : 's' })
    const ws: any = {}
    const merges: any[] = []

    // Kalem listesi (sabit satırlar)
    const kalemler = [
      { grup: 'GELİRLER', baslik: true, renk: '166534' },
      { label: 'Hakedişler',     key: 'hakedisler',    tip: 'gelir' },
      { label: 'Diğer Gelirler', key: 'diger_gelirler', tip: 'gelir' },
      { label: 'Toplam Gelir',   key: 'toplam_gelir',   tip: 'toplamGelir' },
      { grup: 'GİDERLER', baslik: true, renk: KIRMIZI },
      { label: 'Dönem Başı Stok',   key: 'donem_basi_stok',   tip: 'gider' },
      { label: 'Malzeme Giderleri', key: 'malzeme_giderleri', tip: 'gider' },
      { label: 'İşçilik Giderleri', key: 'iscilik_giderleri', tip: 'gider' },
      { label: 'Genel Giderler',    key: 'genel_giderler',    tip: 'gider' },
      { label: 'Finans Giderleri',  key: 'finans_giderleri',  tip: 'gider' },
      { label: 'Diğer Giderler',    key: 'diger_giderler',    tip: 'gider' },
      { label: 'Toplam Gider',      key: 'toplam_gider',      tip: 'toplamGider' },
      { label: 'NET KAR / ZARAR',   key: 'net_kar_zarar',     tip: 'net' },
      { grup: 'YILLARA YAYGIN İNŞAAT PROJESİ GELİRLERİ (Bilgi Amaçlı)', baslik: true, renk: '0F766E' },
      { label: 'Yıllara Yaygın İnşaat Proje Gelirleri', key: 'yillara_yaygin_gelir', tip: 'yaygin' },
      { grup: 'YILLARA YAYGIN İNŞAAT PROJESİ GİDERLERİ (Bilgi Amaçlı)', baslik: true, renk: '9A3412' },
      { label: 'Yıllara Yaygın İnşaat Proje Giderleri', key: 'yillara_yaygin_gider', tip: 'yaygin' },
    ] as any[]

    const sortedData = [...data].sort((a, b) => {
      // baslangic_tarihi varsa gerçek tarihe göre sırala
      if (a.baslangic_tarihi && b.baslangic_tarihi) {
        return new Date(a.baslangic_tarihi).getTime() - new Date(b.baslangic_tarihi).getTime()
      }
      // yoksa donem string'ini sayısal olarak karşılaştır (2025-01, 2025-Q1 vb.)
      return a.donem.localeCompare(b.donem, 'tr', { numeric: true })
    })
    const TOPLAM_COLS = 1 + sortedData.length + (sortedData.length > 1 ? 1 : 0) // kalem + dönemler + (genel toplam)
    let row = 0

    // Başlık bandı
    ws[utils.encode_cell({ r: row, c: 0 })] = c(`${firma.ad.toUpperCase()} — KAR / ZARAR RAPORU`, S.baslik)
    for (let i = 1; i < TOPLAM_COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', S.baslik)
    ws[utils.encode_cell({ r: row, c: TOPLAM_COLS - 1 })] = c(new Date().toLocaleDateString('tr-TR'), S.tarih)
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOPLAM_COLS - 2 } })
    row += 2

    // Dönem başlıkları (sütun başlıkları)
    const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
    const fmtAy = (tarih: string | null) => {
      if (!tarih) return ''
      const d = new Date(tarih)
      return `${AYLAR[d.getMonth()]} ${d.getFullYear()}`
    }

    ws[utils.encode_cell({ r: row, c: 0 })] = c('Kalem', S.donemTh(0))
    sortedData.forEach((d, i) => {
      const label = d.baslangic_tarihi
        ? fmtAy(d.baslangic_tarihi)
        : d.donem
      ws[utils.encode_cell({ r: row, c: i + 1 })] = c(label, S.donemTh(i))
    })
    if (sortedData.length > 1) {
      ws[utils.encode_cell({ r: row, c: sortedData.length + 1 })] = c('GENEL TOPLAM', S.donemTh(sortedData.length))
    }
    row++

    // Kalem satırları
    kalemler.forEach((kalem, ki) => {
      if (kalem.baslik) {
        ws[utils.encode_cell({ r: row, c: 0 })] = c(kalem.grup, S.kalemBaslik(kalem.renk))
        for (let i = 1; i < TOPLAM_COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = c('', S.kalemBaslik(kalem.renk))
        merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOPLAM_COLS - 1 } })
        row++; return
      }

      const tip = kalem.tip
      const isNet         = tip === 'net'
      const isToplamGelir = tip === 'toplamGelir'
      const isToplamGider = tip === 'toplamGider'
      const isYaygin      = tip === 'yaygin'
      const isToplamlар   = isNet || isToplamGelir || isToplamGider

      const etiketS = isNet
        ? S.toplamEtiket
        : isToplamGelir
          ? { ...S.kalemEtiket, font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: YESIL } }, fill: { fgColor: { rgb: 'DCFCE7' } } }
          : isToplamGider
            ? { ...S.kalemEtiket, font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: KIRMIZI } }, fill: { fgColor: { rgb: 'FEE2E2' } } }
            : S.kalemEtiket
      ws[utils.encode_cell({ r: row, c: 0 })] = c(isToplamlар ? kalem.label : `  ${kalem.label}`, etiketS)

      const getVal = (d: any) => {
        if (kalem.key === 'toplam_gelir') return Number(d.hakedisler || 0) + Number(d.diger_gelirler || 0)
        if (kalem.key === 'toplam_gider') return Number(d.donem_basi_stok || 0) + Number(d.malzeme_giderleri || 0) + Number(d.iscilik_giderleri || 0) + Number(d.genel_giderler || 0) + Number(d.finans_giderleri || 0) + Number(d.diger_giderler || 0)
        if (kalem.key === 'net_kar_zarar') {
          const g = Number(d.hakedisler || 0) + Number(d.diger_gelirler || 0)
          const gi = Number(d.donem_basi_stok || 0) + Number(d.malzeme_giderleri || 0) + Number(d.iscilik_giderleri || 0) + Number(d.genel_giderler || 0) + Number(d.finans_giderleri || 0) + Number(d.diger_giderler || 0)
          return g - gi
        }
        return Number(d[kalem.key] || 0)
      }

      sortedData.forEach((d, i) => {
        const val = getVal(d)
        let paraS: any
        if (isNet)         paraS = S.toplamPara(val >= 0 ? YESIL : KIRMIZI)
        else if (isToplamGelir) paraS = S.para(YESIL, 'DCFCE7')
        else if (isToplamGider) paraS = S.para(KIRMIZI, 'FEE2E2')
        else if (tip === 'gelir') paraS = S.para(val > 0 ? YESIL : '94A3B8', ki % 2 === 0 ? ACIK : BEYAZ)
        else if (tip === 'gider') paraS = S.para(val > 0 ? KIRMIZI : '94A3B8', ki % 2 === 0 ? ACIK : BEYAZ)
        else if (isYaygin && kalem.key === 'yillara_yaygin_gelir') paraS = S.para(val > 0 ? '0F766E' : '94A3B8', ki % 2 === 0 ? 'CCFBF1' : BEYAZ)
        else paraS = S.para(val > 0 ? '9A3412' : '94A3B8', ki % 2 === 0 ? 'FEF3C7' : BEYAZ)
        ws[utils.encode_cell({ r: row, c: i + 1 })] = { v: val, s: paraS, t: 'n' }
      })

      if (sortedData.length > 1) {
        const genelVal = sortedData.reduce((s, d) => s + getVal(d), 0)
        let genelS: any
        if (isNet)         genelS = S.toplamPara(genelVal >= 0 ? YESIL : KIRMIZI)
        else if (isToplamGelir) genelS = S.para(YESIL, 'DCFCE7')
        else if (isToplamGider) genelS = S.para(KIRMIZI, 'FEE2E2')
        else if (tip === 'gelir') genelS = S.para(genelVal > 0 ? YESIL : '94A3B8', ki % 2 === 0 ? ACIK : BEYAZ)
        else if (tip === 'gider') genelS = S.para(genelVal > 0 ? KIRMIZI : '94A3B8', ki % 2 === 0 ? ACIK : BEYAZ)
        else if (isYaygin && kalem.key === 'yillara_yaygin_gelir') genelS = S.para(genelVal > 0 ? '0F766E' : '94A3B8', 'CCFBF1')
        else genelS = S.para(genelVal > 0 ? '9A3412' : '94A3B8', 'FEF3C7')
        ws[utils.encode_cell({ r: row, c: sortedData.length + 1 })] = { v: genelVal, s: genelS, t: 'n' }
      }

      row++
    })

    // Alt not
    row++
    ws[utils.encode_cell({ r: row, c: 0 })] = c(`${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  Gizli ve Kurumsal Belge`, { font: { name: 'Calibri', sz: 8, italic: true, color: { rgb: '94A3B8' } } })
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOPLAM_COLS - 1 } })

    // Sütun genişlikleri: kalem sütunu geniş, dönem sütunları eşit
    ws['!cols'] = [{ wch: 40 }, ...sortedData.map(() => ({ wch: 22 })), ...(sortedData.length > 1 ? [{ wch: 22 }] : [])]
    ws['!rows'] = [{ hpt: 26 }, {}, { hpt: 36 }]
    ws['!merges'] = merges
    ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: TOPLAM_COLS - 1 } })

    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Kar-Zarar Raporu')
    writeFile(wb, `kar-zarar-${firma.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function openNew() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(r: any) {
    setForm({
      donem:                r.donem || '',
      baslangic_tarihi:     r.baslangic_tarihi || '',
      bitis_tarihi:         r.bitis_tarihi || '',
      hakedisler:           String(r.hakedisler || '0'),
      yillara_yaygin_gelir: String(r.yillara_yaygin_gelir || '0'),
      diger_gelirler:       String(r.diger_gelirler || '0'),
      donem_basi_stok:      String(r.donem_basi_stok || '0'),
      malzeme_giderleri:    String(r.malzeme_giderleri || '0'),
      iscilik_giderleri:    String(r.iscilik_giderleri || '0'),
      genel_giderler:       String(r.genel_giderler || '0'),
      finans_giderleri:     String(r.finans_giderleri || '0'),
      yillara_yaygin_gider: String(r.yillara_yaygin_gider || '0'),
      diger_giderler:       String(r.diger_giderler || '0'),
      notlar:               r.notlar || '',
    })
    setEditing(r); setModal(true)
  }

  async function save() {
    if (!form.donem) return alert('Dönem adı zorunludur')
    setSaving(true)
    const { toplamGelir, toplamGider, net } = calc(form)
    const payload = {
      donem:                form.donem,
      baslangic_tarihi:     form.baslangic_tarihi || null,
      bitis_tarihi:         form.bitis_tarihi || null,
      hakedisler:           Number(form.hakedisler),
      yillara_yaygin_gelir: Number(form.yillara_yaygin_gelir),
      diger_gelirler:       Number(form.diger_gelirler),
      donem_basi_stok:      Number(form.donem_basi_stok),
      malzeme_giderleri:    Number(form.malzeme_giderleri),
      iscilik_giderleri:    Number(form.iscilik_giderleri),
      genel_giderler:       Number(form.genel_giderler),
      finans_giderleri:     Number(form.finans_giderleri),
      yillara_yaygin_gider: Number(form.yillara_yaygin_gider),
      diger_giderler:       Number(form.diger_giderler),
      toplam_gelir:         toplamGelir,
      toplam_gider:         toplamGider,
      net_kar_zarar:        net,
      notlar:               form.notlar || null,
    }
    if (editing) {
      const { error } = await supabase.from('kar_zarar').update(payload).eq('id', editing.id)
      if (error) { alert('Güncelleme hatası: ' + error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('kar_zarar').insert({ ...payload, firma_id: firma.id })
      if (error) { alert('Kaydetme hatası: ' + error.message); setSaving(false); return }
    }
    setSaving(false); setModal(false); load()
  }

  const sf = (k: keyof FormType) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const preview = calc(form)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<TrendingUp className="w-5 h-5 text-teal-600" />}
        title="Kar / Zarar"
        subtitle="Dönemlik gelir-gider analizi"
        iconBg="bg-teal-50"
        action={<div className="flex gap-2"><Btn variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportExcel}>Excel Rapor</Btn><Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Hesaplama</Btn></div>}
      />

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Dönem', 'Başlangıç', 'Bitiş', 'Gelirler', 'Yıllara Yaygın Gelir', 'Giderler', 'Yıllara Yaygın Gider', 'Net Kar/Zarar', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map(r => {
                  const normalGelir = Number(r.hakedisler || 0) + Number(r.diger_gelirler || 0)
                  const yayginGelir = Number(r.yillara_yaygin_gelir || 0)
                  const normalGider = Number(r.donem_basi_stok || 0) + Number(r.malzeme_giderleri || 0) + Number(r.iscilik_giderleri || 0) + Number(r.genel_giderler || 0) + Number(r.finans_giderleri || 0) + Number(r.diger_giderler || 0)
                  const yayginGider = Number(r.yillara_yaygin_gider || 0)
                  const net = normalGelir - normalGider
                  return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.donem}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(r.baslangic_tarihi)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(r.bitis_tarihi)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-700">{fmt(normalGelir)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-teal-700">{fmt(yayginGelir)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600">{fmt(normalGider)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-orange-600">{fmt(yayginGider)}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 font-bold text-sm ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {net >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {fmt(net)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setDelId(r.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
              {data.length > 0 && (() => {
                const toplamNormalGelir = data.reduce((s, r) => s + Number(r.hakedisler || 0) + Number(r.diger_gelirler || 0), 0)
                const toplamYayginGelir = data.reduce((s, r) => s + Number(r.yillara_yaygin_gelir || 0), 0)
                const toplamNormalGider = data.reduce((s, r) => s + Number(r.donem_basi_stok || 0) + Number(r.malzeme_giderleri || 0) + Number(r.iscilik_giderleri || 0) + Number(r.genel_giderler || 0) + Number(r.finans_giderleri || 0) + Number(r.diger_giderler || 0), 0)
                const toplamYayginGider = data.reduce((s, r) => s + Number(r.yillara_yaygin_gider || 0), 0)
                const toplamNet         = toplamNormalGelir - toplamNormalGider
                return (
                  <tfoot>
                    <tr className="bg-slate-800 text-white">
                      <td className="px-4 py-3 font-bold text-sm" colSpan={3}>DÖNEM TOPLAMI ({data.length} kayıt)</td>
                      <td className="px-4 py-3 font-bold text-green-300 whitespace-nowrap">{fmt(toplamNormalGelir)}</td>
                      <td className="px-4 py-3 font-bold text-teal-300 whitespace-nowrap">{fmt(toplamYayginGelir)}</td>
                      <td className="px-4 py-3 font-bold text-red-300 whitespace-nowrap">{fmt(toplamNormalGider)}</td>
                      <td className="px-4 py-3 font-bold text-orange-300 whitespace-nowrap">{fmt(toplamYayginGider)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`flex items-center gap-1 font-bold text-base ${toplamNet >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                          {toplamNet >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {fmt(toplamNet)}
                        </span>
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                )
              })()}

            </table>
            {data.length === 0 && <EmptyState icon={<TrendingUp className="w-10 h-10" />} message="Kar-zarar kaydı yok" />}
          </div>
        )}
      </Card>

      {modal && (
        <Modal
          title={editing ? 'Düzenle' : 'Yeni Kar-Zarar Hesaplaması'}
          onClose={() => setModal(false)}
          size="xl"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}
        >
          <div className="space-y-5">
            {/* Dönem */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Dönem Adı" required>
                <input type="text" value={form.donem} onChange={sf('donem')} className={inputCls} placeholder="2025-Q1" />
              </Field>
              <Field label="Başlangıç">
                <input type="date" value={form.baslangic_tarihi} onChange={sf('baslangic_tarihi')} className={inputCls} />
              </Field>
              <Field label="Bitiş">
                <input type="date" value={form.bitis_tarihi} onChange={sf('bitis_tarihi')} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GELİRLER */}
              <div className="bg-green-50 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-green-800 text-sm uppercase tracking-wide">Gelirler</h3>
                <Field label="Hakedişler (₺)">
                  <input type="number" step="0.01" value={form.hakedisler} onChange={sf('hakedisler')} className={inputCls} />
                </Field>
                <Field label="Diğer Gelirler (₺)">
                  <input type="number" step="0.01" value={form.diger_gelirler} onChange={sf('diger_gelirler')} className={inputCls} />
                </Field>
                <div className="pt-2 border-t border-green-200 flex justify-between">
                  <span className="text-xs font-semibold text-green-700">Toplam Gelir</span>
                  <span className="font-bold text-green-800">{fmt(preview.gelir)}</span>
                </div>
              </div>

              {/* GİDERLER */}
              <div className="bg-red-50 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-red-800 text-sm uppercase tracking-wide">Giderler</h3>
                <Field label="Dönem Başı Stok (₺)">
                  <input type="number" step="0.01" value={form.donem_basi_stok} onChange={sf('donem_basi_stok')} className={inputCls} placeholder="Manuel giriş" />
                </Field>
                <Field label="Malzeme Giderleri (₺)">
                  <input type="number" step="0.01" value={form.malzeme_giderleri} onChange={sf('malzeme_giderleri')} className={inputCls} />
                </Field>
                <Field label="İşçilik Giderleri (₺)">
                  <input type="number" step="0.01" value={form.iscilik_giderleri} onChange={sf('iscilik_giderleri')} className={inputCls} />
                </Field>
                <Field label="Genel Giderler (₺)">
                  <input type="number" step="0.01" value={form.genel_giderler} onChange={sf('genel_giderler')} className={inputCls} />
                </Field>
                <Field label="Finans Giderleri (₺)">
                  <input type="number" step="0.01" value={form.finans_giderleri} onChange={sf('finans_giderleri')} className={inputCls} />
                </Field>
                <Field label="Diğer Giderler (₺)">
                  <input type="number" step="0.01" value={form.diger_giderler} onChange={sf('diger_giderler')} className={inputCls} />
                </Field>
                <div className="pt-2 border-t border-red-200 flex justify-between">
                  <span className="text-xs font-semibold text-red-700">Toplam Gider</span>
                  <span className="font-bold text-red-800">{fmt(preview.gider)}</span>
                </div>
              </div>
            </div>

            {/* YILLARA YAYGIN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-teal-50 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-teal-800 text-sm uppercase tracking-wide">Yıllara Yaygın İnşaat Proje Gelirleri</h3>
                <Field label="Tutar (₺)">
                  <input type="number" step="0.01" value={form.yillara_yaygin_gelir} onChange={sf('yillara_yaygin_gelir')} className={inputCls} />
                </Field>
                <div className="pt-2 border-t border-teal-200 flex justify-between">
                  <span className="text-xs font-semibold text-teal-700">Toplam Yıllara Yaygın Gelir</span>
                  <span className="font-bold text-teal-800">{fmt(preview.yayginGelir)}</span>
                </div>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-orange-800 text-sm uppercase tracking-wide">Yıllara Yaygın İnşaat Proje Giderleri</h3>
                <Field label="Tutar (₺)">
                  <input type="number" step="0.01" value={form.yillara_yaygin_gider} onChange={sf('yillara_yaygin_gider')} className={inputCls} />
                </Field>
                <div className="pt-2 border-t border-orange-200 flex justify-between">
                  <span className="text-xs font-semibold text-orange-700">Toplam Yıllara Yaygın Gider</span>
                  <span className="font-bold text-orange-800">{fmt(preview.yayginGider)}</span>
                </div>
              </div>
            </div>

            {/* Net Sonuç */}
            <div className={`rounded-xl p-5 text-center ${preview.net >= 0 ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'}`}>
              <p className="text-sm font-medium text-gray-600 mb-1">Net Kar / Zarar</p>
              <p className={`text-3xl font-bold ${preview.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(preview.net)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Toplam Gelir ({fmt(preview.gelir)}) - Toplam Gider ({fmt(preview.gider)})</p>
            </div>

            {/* Yıllara Yaygın Bilgi */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-teal-700 mb-1">Yıllara Yaygın İnşaat Proje Gelirleri</p>
                <p className="text-xl font-bold text-teal-800">{fmt(preview.yayginGelir)}</p>
                <p className="text-xs text-teal-500 mt-1">Bilgi amaçlı — net'e dahil değil</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-orange-700 mb-1">Yıllara Yaygın İnşaat Proje Giderleri</p>
                <p className="text-xl font-bold text-orange-800">{fmt(preview.yayginGider)}</p>
                <p className="text-xs text-orange-500 mt-1">Bilgi amaçlı — net'e dahil değil</p>
              </div>
            </div>

            <Field label="Notlar">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog
          message="Bu kaydı silmek istediğinize emin misiniz?"
          onConfirm={async () => { await supabase.from('kar_zarar').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)}
        />
      )}
    </div>
  )
}
