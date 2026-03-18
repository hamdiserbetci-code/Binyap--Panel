'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma, AY_LABELS, VERGI_TUR_LABELS, DURUM_LABELS } from '@/lib/supabase'
import { FileDown, Loader2, FileSpreadsheet } from 'lucide-react'
import * as XLSXStyle from 'xlsx-js-style'

interface Props { userId: string; firmalar?: any[] }

const TUR_LABELS: Record<string, string> = {
  cek: 'Çek', vergi: 'Vergi', sgk: 'SGK',
  maas: 'Maaş', cari: 'Cari Hesap', diger: 'Diğer'
}



export default function RaporlamaPage({ userId }: Props) {
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [selectedFirmaId, setSelectedFirmaId] = useState<string>('')
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1)
  const [loading, setLoading] = useState(false)

  const fetchFirmalar = useCallback(async () => {
    const { data } = await supabase.from('firmalar').select('*').eq('user_id', userId)
    if (data && data.length > 0) {
      setFirmalar(data)
      setSelectedFirmaId(data[0].id)
    }
  }, [userId])

  useEffect(() => { fetchFirmalar() }, [fetchFirmalar])

  const donem = `${AY_LABELS[selectedAy]} ${selectedYil}`

  const headerStyle = {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E40AF' } },
    alignment: { vertical: 'center' as const, horizontal: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'FFFFFF' } },
      bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
      left: { style: 'thin', color: { rgb: 'FFFFFF' } },
      right: { style: 'thin', color: { rgb: 'FFFFFF' } }
    }
  }

  const baseStyle = {
    font: { name: 'Arial', sz: 9 },
    alignment: { vertical: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } }
    }
  }

  const zebraStyle = { ...baseStyle, fill: { fgColor: { rgb: 'F8FAFC' } } }
  const currencyStyle = { ...baseStyle, numFmt: '#,##0.00', alignment: { vertical: 'center' as const, horizontal: 'right' as const } }
  const currencyZebraStyle = { ...zebraStyle, numFmt: '#,##0.00', alignment: { vertical: 'center' as const, horizontal: 'right' as const } }
  const totalStyle = { ...baseStyle, font: { name: 'Arial', sz: 9, bold: true }, fill: { fgColor: { rgb: 'DBEAFE' } }, numFmt: '#,##0.00', alignment: { vertical: 'center' as const, horizontal: 'right' as const } }
  const titleStyle = { font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '1E293B' } } }
  const subtitleStyle = { font: { name: 'Arial', sz: 10, color: { rgb: '64748B' } } }

  type ColDef = { key: string; label: string; width: number; type?: 'currency' | 'boolean' | 'text' }

  const buildSheet = (rows: any[], cols: ColDef[], title: string, firma: string, donemStr: string) => {
    const ws: any = {}
    const R0 = 0; const R1 = 1; const R2 = 2; const HEADER_ROW = 4

    // Başlık satırları
    const a1 = XLSXStyle.utils.encode_cell({ r: R0, c: 0 })
    ws[a1] = { v: firma, t: 's', s: titleStyle }
    const a2 = XLSXStyle.utils.encode_cell({ r: R1, c: 0 })
    ws[a2] = { v: title, t: 's', s: subtitleStyle }
    const a3 = XLSXStyle.utils.encode_cell({ r: R2, c: 0 })
    ws[a3] = { v: donemStr, t: 's', s: subtitleStyle }

    // Boş satır (R3 = index 3)
    // Header satırı (R4 = index 4)
    cols.forEach((col, C) => {
      const ref = XLSXStyle.utils.encode_cell({ r: HEADER_ROW, c: C })
      ws[ref] = { v: col.label, t: 's', s: headerStyle }
    })

    // Data satırları
    let totalRow: Record<string, number> = {}
    rows.forEach((row, ri) => {
      const isZebra = ri % 2 === 1
      cols.forEach((col, C) => {
        const ref = XLSXStyle.utils.encode_cell({ r: HEADER_ROW + 1 + ri, c: C })
        let val = row[col.key]
        if (col.type === 'boolean') {
          ws[ref] = { v: val ? 'Evet' : 'Hayır', t: 's', s: isZebra ? zebraStyle : baseStyle }
        } else if (col.type === 'currency') {
          const num = parseFloat(val) || 0
          ws[ref] = { v: num, t: 'n', s: isZebra ? currencyZebraStyle : currencyStyle }
          totalRow[col.key] = (totalRow[col.key] || 0) + num
        } else {
          ws[ref] = { v: val ?? '', t: 's', s: isZebra ? zebraStyle : baseStyle }
        }
      })
    })

    // Toplam satırı
    if (rows.length > 0) {
      const totalRowIdx = HEADER_ROW + 1 + rows.length
      cols.forEach((col, C) => {
        const ref = XLSXStyle.utils.encode_cell({ r: totalRowIdx, c: C })
        if (col.type === 'currency' && totalRow[col.key] !== undefined) {
          ws[ref] = { v: totalRow[col.key], t: 'n', s: totalStyle }
        } else if (C === 0) {
          ws[ref] = { v: 'TOPLAM', t: 's', s: { ...baseStyle, font: { name: 'Arial', sz: 9, bold: true }, fill: { fgColor: { rgb: 'DBEAFE' } } } }
        } else {
          ws[ref] = { v: '', t: 's', s: { ...baseStyle, fill: { fgColor: { rgb: 'DBEAFE' } } } }
        }
      })
    }

    const lastRow = HEADER_ROW + 1 + rows.length
    const lastCol = cols.length - 1
    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } })
    ws['!cols'] = cols.map(c => ({ wch: c.width }))
    ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 16 }, { hpt: 8 }, { hpt: 20 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    ]
    ws['!autofilter'] = { ref: XLSXStyle.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: HEADER_ROW, c: lastCol } }) }
    return ws
  }

  // ── Veri çekme fonksiyonları ──────────────────────────────────────────────

  const fetchOdemeData = async (firmaId: string) => {
    const { data } = await supabase
      .from('odeme_plani')
      .select('*, firmalar(ad)')
      .eq('firma_id', firmaId)
      .eq('user_id', userId)
      .order('vade_tarihi', { ascending: true })

    return (data || []).map((o: any) => ({
      firma_ad: o.firmalar?.ad || '',
      baslik: o.baslik || '',
      tur: TUR_LABELS[o.tur] || o.tur,
      cek_no: o.cek_no || '',
      vade_tarihi: o.vade_tarihi || '',
      tutar: o.tutar || 0,
      odendi: o.durum === 'odendi' ? o.tutar : 0,
      kalan: o.durum === 'beklemede' || o.durum === 'gecikti' ? o.tutar : 0,
      odeme_tarihi: o.odeme_tarihi || '',
      durum: o.durum === 'beklemede' ? 'Beklemede'
        : o.durum === 'odendi' ? 'Ödendi'
        : o.durum === 'gecikti' ? 'Gecikti' : 'İptal',
      aciklama: o.aciklama || '',
    }))
  }

  const fetchPuantajData = async (firmaId: string) => {
    const { data } = await supabase
      .from('puantaj')
      .select('*, ekipler(ad_soyad, pozisyon), projeler(ad)')
      .eq('firma_id', firmaId)
      .eq('yil', selectedYil)
      .eq('ay', selectedAy)
      .eq('user_id', userId)
    return (data || []).map((p: any) => ({
      proje: p.projeler?.ad || '',
      ekip: p.ekipler?.ad_soyad || '',
      pozisyon: p.ekipler?.pozisyon || '',
      yil: p.yil,
      ay: AY_LABELS[p.ay] || p.ay,
      gun: p.gun_sayisi || 0,
      onaylandi: p.onaylandi,
      teyit: p.teyit_edildi,
      maas_odendi: p.maas_odendi,
    }))
  }

  const fetchVergiData = async (firmaId: string) => {
    const { data } = await supabase
      .from('vergi_surecleri')
      .select('*, firmalar(ad)')
      .eq('firma_id', firmaId)
      .eq('yil', selectedYil)
      .eq('ay', selectedAy)
      .eq('user_id', userId)
    return (data || []).map((v: any) => ({
      firma_ad: v.firmalar?.ad || '',
      tur: VERGI_TUR_LABELS[v.tur] || v.tur,
      yil: v.yil,
      ay: AY_LABELS[v.ay] || v.ay,
      son_tarih: v.son_tarih || '',
      beyan_tarihi: v.beyan_tarihi || '',
      tutar: v.tutar || 0,
      durum: DURUM_LABELS[v.durum] || v.durum,
      aciklama: v.aciklama || '',
    }))
  }

  const fetchMaliyetData = async (firmaId: string) => {
    const { data } = await supabase
      .from('maliyet')
      .select('*, firmalar(ad)')
      .eq('firma_id', firmaId)
      .eq('yil', selectedYil)
      .eq('user_id', userId)
      .order('ay', { ascending: true })
    return (data || []).map((m: any) => {
      const gelir = (m.satis_faturalari || 0) + (m.yillara_yaygin_satislar || 0) + (m.yyllara_yaygin_insaat_geliri || 0) + (m.diger_gelirler || 0)
      const gider = (m.alis_faturalari || 0) + (m.iscilik || 0) + (m.onceki_donem_stok || 0) + (m.finansman_giderleri || 0) + (m.sigorta_giderleri || 0) + (m.amortisman_giderleri || 0) + (m.genel_yonetim_giderleri || 0) + (m.demirbaslar || 0) + (m.devreden_stok || 0) + (m.yillara_yaygin_maliyetler || 0) + (m.yillara_yaygin_insaat_maliyeti || 0) + (m.diger_giderler || 0)
      return {
        firma_ad: m.firmalar?.ad || '',
        ay: AY_LABELS[m.ay] || m.ay,
        yil: m.yil,
        alis: m.alis_faturalari || 0,
        satis: m.satis_faturalari || 0,
        iscilik: m.iscilik || 0,
        finansman: m.finansman_giderleri || 0,
        sigorta: m.sigorta_giderleri || 0,
        amortisman: m.amortisman_giderleri || 0,
        genel: m.genel_yonetim_giderleri || 0,
        demirbaslar: m.demirbaslar || 0,
        diger_gelir: m.diger_gelirler || 0,
        diger_gider: m.diger_giderler || 0,
        toplam_gelir: gelir,
        toplam_gider: gider,
        net: gelir - gider,
      }
    })
  }

  const fetchKasaData = async (firmaId: string) => {
    const { data } = await supabase
      .from('kasa')
      .select('*, firmalar(ad)')
      .eq('firma_id', firmaId)
      .eq('user_id', userId)
      .order('tarih', { ascending: true })
    return (data || []).map((k: any) => ({
      firma_ad: k.firmalar?.ad || '',
      tarih: k.tarih || '',
      aciklama: k.aciklama || '',
      kategori: k.kategori || '',
      tur: k.tur === 'giris' ? 'Giriş' : 'Çıkış',
      tutar: k.tutar || 0,
      bakiye: k.bakiye || 0,
      belge_no: k.belge_no || '',
    }))
  }

  // ── Excel İndirme ─────────────────────────────────────────────────────────

  const downloadReport = async (type: string) => {
    if (!selectedFirmaId) return
    setLoading(true)
    const firma = firmalar.find(f => f.id === selectedFirmaId)!
    const wb = XLSXStyle.utils.book_new()

    const configs: Record<string, { cols: ColDef[]; title: string }> = {
      odeme: {
        title: 'Ödeme Planı',
        cols: [
          { key: 'firma_ad', label: 'Firma', width: 18 },
          { key: 'baslik', label: 'Başlık', width: 28 },
          { key: 'tur', label: 'Tür', width: 14 },
          { key: 'cek_no', label: 'Çek No', width: 14 },
          { key: 'vade_tarihi', label: 'Vade Tarihi', width: 14 },
          { key: 'tutar', label: 'Tutar (₺)', width: 16, type: 'currency' },
          { key: 'odendi', label: 'Ödenen (₺)', width: 16, type: 'currency' },
          { key: 'kalan', label: 'Kalan Ödeme (₺)', width: 18, type: 'currency' },
          { key: 'odeme_tarihi', label: 'Ödeme Tarihi', width: 14 },
          { key: 'durum', label: 'Durum', width: 14 },
          { key: 'aciklama', label: 'Açıklama', width: 28 },
        ]
      },
      puantaj: {
        title: 'Puantaj Raporu',
        cols: [
          { key: 'proje', label: 'Proje', width: 22 },
          { key: 'ekip', label: 'Ekip Üyesi', width: 22 },
          { key: 'pozisyon', label: 'Pozisyon', width: 18 },
          { key: 'yil', label: 'Yıl', width: 8 },
          { key: 'ay', label: 'Ay', width: 10 },
          { key: 'gun', label: 'Çalışma Günü', width: 14, type: 'currency' },
          { key: 'onaylandi', label: 'Onaylandı', width: 12, type: 'boolean' },
          { key: 'teyit', label: 'Teyit Edildi', width: 12, type: 'boolean' },
          { key: 'maas_odendi', label: 'Maaş Ödendi', width: 14, type: 'boolean' },
        ]
      },
      vergi: {
        title: 'Vergi Süreçleri',
        cols: [
          { key: 'firma_ad', label: 'Firma', width: 18 },
          { key: 'tur', label: 'Vergi Türü', width: 20 },
          { key: 'yil', label: 'Yıl', width: 8 },
          { key: 'ay', label: 'Ay', width: 10 },
          { key: 'son_tarih', label: 'Son Tarih', width: 14 },
          { key: 'beyan_tarihi', label: 'Beyan Tarihi', width: 14 },
          { key: 'tutar', label: 'Tutar (₺)', width: 16, type: 'currency' },
          { key: 'durum', label: 'Durum', width: 14 },
          { key: 'aciklama', label: 'Açıklama', width: 28 },
        ]
      },
      maliyet: {
        title: 'Maliyet Raporu',
        cols: [
          { key: 'firma_ad', label: 'Firma', width: 18 },
          { key: 'ay', label: 'Ay', width: 10 },
          { key: 'yil', label: 'Yıl', width: 8 },
          { key: 'alis', label: 'Alış Faturaları (₺)', width: 20, type: 'currency' },
          { key: 'satis', label: 'Satış Faturaları (₺)', width: 20, type: 'currency' },
          { key: 'iscilik', label: 'İşçilik (₺)', width: 16, type: 'currency' },
          { key: 'finansman', label: 'Finansman (₺)', width: 16, type: 'currency' },
          { key: 'sigorta', label: 'Sigorta (₺)', width: 14, type: 'currency' },
          { key: 'amortisman', label: 'Amortisman (₺)', width: 16, type: 'currency' },
          { key: 'genel', label: 'Genel Yönetim (₺)', width: 18, type: 'currency' },
          { key: 'demirbaslar', label: 'Demirbaşlar (₺)', width: 16, type: 'currency' },
          { key: 'diger_gelir', label: 'Diğer Gelirler (₺)', width: 18, type: 'currency' },
          { key: 'diger_gider', label: 'Diğer Giderler (₺)', width: 18, type: 'currency' },
          { key: 'toplam_gelir', label: 'Toplam Gelir (₺)', width: 18, type: 'currency' },
          { key: 'toplam_gider', label: 'Toplam Gider (₺)', width: 18, type: 'currency' },
          { key: 'net', label: 'Net Kar/Zarar (₺)', width: 18, type: 'currency' },
        ]
      },
      kasa: {
        title: 'Kasa Raporu',
        cols: [
          { key: 'firma_ad', label: 'Firma', width: 18 },
          { key: 'tarih', label: 'Tarih', width: 12 },
          { key: 'aciklama', label: 'Açıklama', width: 28 },
          { key: 'kategori', label: 'Kategori', width: 14 },
          { key: 'tur', label: 'Tür', width: 10 },
          { key: 'tutar', label: 'Tutar (₺)', width: 16, type: 'currency' },
          { key: 'bakiye', label: 'Bakiye (₺)', width: 16, type: 'currency' },
          { key: 'belge_no', label: 'Belge No', width: 14 },
        ]
      },
    }

    const fetchers: Record<string, (id: string) => Promise<any[]>> = {
      odeme: fetchOdemeData,
      puantaj: fetchPuantajData,
      vergi: fetchVergiData,
      maliyet: fetchMaliyetData,
      kasa: fetchKasaData,
    }

    const cfg = configs[type]
    const rows = await fetchers[type](selectedFirmaId)
    const ws = buildSheet(rows, cfg.cols, cfg.title, firma.ad, donem)
    XLSXStyle.utils.book_append_sheet(wb, ws, cfg.title.slice(0, 31))
    XLSXStyle.writeFile(wb, `${firma.ad.slice(0, 12)}_${cfg.title}_${selectedYil}-${String(selectedAy).padStart(2,'0')}.xlsx`)
    setLoading(false)
  }

  const downloadAll = async () => {
    setLoading(true)
    const wb = XLSXStyle.utils.book_new()
    const types = ['odeme', 'puantaj', 'vergi', 'maliyet', 'kasa']
    const titles: Record<string, string> = {
      odeme: 'Ödeme Planı', puantaj: 'Puantaj', vergi: 'Vergi',
      maliyet: 'Maliyet', kasa: 'Kasa'
    }
    const fetchers: Record<string, (id: string) => Promise<any[]>> = {
      odeme: fetchOdemeData, puantaj: fetchPuantajData,
      vergi: fetchVergiData, maliyet: fetchMaliyetData, kasa: fetchKasaData,
    }
    const colsMap: Record<string, ColDef[]> = {
      odeme: [
        { key: 'firma_ad', label: 'Firma', width: 18 },
        { key: 'baslik', label: 'Başlık', width: 28 },
        { key: 'tur', label: 'Tür', width: 14 },
        { key: 'cek_no', label: 'Çek No', width: 14 },
        { key: 'vade_tarihi', label: 'Vade Tarihi', width: 14 },
        { key: 'tutar', label: 'Tutar (₺)', width: 16, type: 'currency' },
        { key: 'odendi', label: 'Ödenen (₺)', width: 16, type: 'currency' },
        { key: 'kalan', label: 'Kalan Ödeme (₺)', width: 18, type: 'currency' },
        { key: 'odeme_tarihi', label: 'Ödeme Tarihi', width: 14 },
        { key: 'durum', label: 'Durum', width: 14 },
        { key: 'aciklama', label: 'Açıklama', width: 28 },
      ],
      puantaj: [
        { key: 'proje', label: 'Proje', width: 22 }, { key: 'ekip', label: 'Ekip Üyesi', width: 22 },
        { key: 'pozisyon', label: 'Pozisyon', width: 18 }, { key: 'yil', label: 'Yıl', width: 8 },
        { key: 'ay', label: 'Ay', width: 10 }, { key: 'gun', label: 'Çalışma Günü', width: 14, type: 'currency' },
        { key: 'onaylandi', label: 'Onaylandı', width: 12, type: 'boolean' },
        { key: 'teyit', label: 'Teyit Edildi', width: 12, type: 'boolean' },
        { key: 'maas_odendi', label: 'Maaş Ödendi', width: 14, type: 'boolean' },
      ],
      vergi: [
        { key: 'firma_ad', label: 'Firma', width: 18 }, { key: 'tur', label: 'Vergi Türü', width: 20 },
        { key: 'yil', label: 'Yıl', width: 8 }, { key: 'ay', label: 'Ay', width: 10 },
        { key: 'son_tarih', label: 'Son Tarih', width: 14 }, { key: 'beyan_tarihi', label: 'Beyan Tarihi', width: 14 },
        { key: 'tutar', label: 'Tutar (₺)', width: 16, type: 'currency' },
        { key: 'durum', label: 'Durum', width: 14 }, { key: 'aciklama', label: 'Açıklama', width: 28 },
      ],
      maliyet: [
        { key: 'firma_ad', label: 'Firma', width: 18 }, { key: 'ay', label: 'Ay', width: 10 },
        { key: 'alis', label: 'Alış (₺)', width: 16, type: 'currency' },
        { key: 'satis', label: 'Satış (₺)', width: 16, type: 'currency' },
        { key: 'iscilik', label: 'İşçilik (₺)', width: 16, type: 'currency' },
        { key: 'toplam_gelir', label: 'Toplam Gelir (₺)', width: 18, type: 'currency' },
        { key: 'toplam_gider', label: 'Toplam Gider (₺)', width: 18, type: 'currency' },
        { key: 'net', label: 'Net Kar/Zarar (₺)', width: 18, type: 'currency' },
      ],
      kasa: [
        { key: 'tarih', label: 'Tarih', width: 12 }, { key: 'aciklama', label: 'Açıklama', width: 28 },
        { key: 'tur', label: 'Tür', width: 10 }, { key: 'tutar', label: 'Tutar (₺)', width: 16, type: 'currency' },
        { key: 'bakiye', label: 'Bakiye (₺)', width: 16, type: 'currency' },
      ],
    }

    for (const firma of firmalar) {
      for (const type of types) {
        const rows = await fetchers[type](firma.id)
        if (rows.length > 0) {
          const sheetName = `${firma.ad.slice(0, 8)}-${titles[type]}`.slice(0, 31)
          const ws = buildSheet(rows, colsMap[type], titles[type], firma.ad, donem)
          XLSXStyle.utils.book_append_sheet(wb, ws, sheetName)
        }
      }
    }

    if (wb.SheetNames.length > 0) {
      XLSXStyle.writeFile(wb, `ETM-BİNYAPI_TÜM_RAPORLAR_${selectedYil}.xlsx`)
    } else {
      alert('İndirilecek veri bulunamadı.')
    }
    setLoading(false)
  }

  const btnCls = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Excel Raporlama</h2>
      <p className="text-sm text-slate-500 mb-6">Tüm modüller için profesyonel Excel raporu alın</p>

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-5 grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Firma</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedFirmaId} onChange={e => setSelectedFirmaId(e.target.value)}>
            {firmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Yıl</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Ay</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedAy} onChange={e => setSelectedAy(Number(e.target.value))}>
            {Object.entries(AY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Rapor Butonları */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tekil Raporlar</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button onClick={() => downloadReport('odeme')} disabled={loading || !selectedFirmaId}
            className={`${btnCls} bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Ödeme Planı
          </button>
          <button onClick={() => downloadReport('puantaj')} disabled={loading || !selectedFirmaId}
            className={`${btnCls} bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Puantaj
          </button>
          <button onClick={() => downloadReport('vergi')} disabled={loading || !selectedFirmaId}
            className={`${btnCls} bg-red-50 text-red-700 hover:bg-red-100 border border-red-200`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Vergi Süreçleri
          </button>
          <button onClick={() => downloadReport('maliyet')} disabled={loading || !selectedFirmaId}
            className={`${btnCls} bg-green-50 text-green-700 hover:bg-green-100 border border-green-200`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Maliyet
          </button>
          <button onClick={() => downloadReport('kasa')} disabled={loading || !selectedFirmaId}
            className={`${btnCls} bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Kasa
          </button>
        </div>
      </div>

      {/* Tüm Raporlar */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tüm Firmalar — Tek Dosya</p>
        <button onClick={downloadAll} disabled={loading || firmalar.length === 0}
          className={`${btnCls} w-full bg-slate-800 text-white hover:bg-slate-900 py-3 text-base`}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
          Tüm Raporları İndir (Her Firma Ayrı Sekme)
        </button>
        <p className="text-xs text-slate-400 text-center mt-2">
          Tüm firmalar için tüm raporlar tek Excel dosyasında — {donem}
        </p>
      </div>
    </div>
  )
}
