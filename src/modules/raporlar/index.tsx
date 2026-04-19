'use client'
import React, { useEffect, useState } from 'react'
import { FileSpreadsheet, Download, Building2, CheckSquare, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, Btn, Spinner } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Firma } from '@/types'
import { KDV1_KONTROLLER } from '@/modules/is-takibi/Kdv1Checklist'

// ─── Rapor Modülleri ──────────────────────────────────────────
const MODULLER = [
  { id: 'kasa',        label: 'Kasa & Banka',    renk: '0F766E', icon: '💰' },
  { id: 'kar-zarar',   label: 'Kar / Zarar',     renk: '166534', icon: '📊' },
  { id: 'odeme-plani', label: 'Ödeme Planı',     renk: '1E40AF', icon: '📅' },
  { id: 'cari',        label: 'Cari Hesaplar',   renk: '4338CA', icon: '📒' },
  { id: 'teminat',     label: 'Teminat Takibi',  renk: '0E7490', icon: '🛡️' },
  { id: 'projeler',    label: 'Projeler',         renk: '92400E', icon: '🏗️' },
  { id: 'personel',    label: 'Personel',         renk: '1E3A5F', icon: '👥' },
  { id: 'gorevler',    label: 'Görev Takibi',     renk: '5B21B6', icon: '✅' },
  { id: 'is-takibi',   label: 'İş Takibi',        renk: '7C3AED', icon: '📋' },
]

// ─── Excel Stil Sabitleri ─────────────────────────────────────
const KOYU    = '0F172A'
const BEYAZ   = 'FFFFFF'
const ACIK    = 'F8FAFC'
const SINIR   = 'E2E8F0'
const MAVI    = '1E40AF'
const YESIL   = '166534'
const KIRMIZI = '991B1B'

const border = {
  top:    { style: 'thin', color: { rgb: SINIR } },
  bottom: { style: 'thin', color: { rgb: SINIR } },
  left:   { style: 'thin', color: { rgb: SINIR } },
  right:  { style: 'thin', color: { rgb: SINIR } },
}
const borderMedium = {
  top:    { style: 'medium', color: { rgb: KOYU } },
  bottom: { style: 'medium', color: { rgb: KOYU } },
  left:   { style: 'thin',   color: { rgb: KOYU } },
  right:  { style: 'thin',   color: { rgb: KOYU } },
}

function cell(v: any, s: any) {
  return { v: v ?? '', s, t: typeof v === 'number' ? 'n' : 's' }
}

function numCell(v: number, s: any) {
  return { v, s, t: 'n' }
}

const sBaslik = (renk = KOYU) => ({
  font:      { name: 'Calibri', sz: 13, bold: true, color: { rgb: BEYAZ } },
  fill:      { fgColor: { rgb: renk } },
  alignment: { horizontal: 'left', vertical: 'center' },
})
const sTarih = {
  font:      { name: 'Calibri', sz: 9, color: { rgb: 'BFDBFE' } },
  fill:      { fgColor: { rgb: KOYU } },
  alignment: { horizontal: 'right', vertical: 'center' },
}
const sTh = {
  font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: BEYAZ } },
  fill:      { fgColor: { rgb: MAVI } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border,
}
const sTd = (zebra = false) => ({
  font:      { name: 'Calibri', sz: 9, color: { rgb: KOYU } },
  fill:      { fgColor: { rgb: zebra ? ACIK : BEYAZ } },
  alignment: { vertical: 'center' },
  border,
})
const sTdR = (zebra = false) => ({
  ...sTd(zebra),
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt: '#,##0.00 \u20BA',
})
const sGrupBaslik = (renk: string) => ({
  font:      { name: 'Calibri', sz: 9, bold: true, color: { rgb: BEYAZ } },
  fill:      { fgColor: { rgb: renk } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border,
})
const sToplamlabel = {
  font:      { name: 'Calibri', sz: 10, bold: true, color: { rgb: BEYAZ } },
  fill:      { fgColor: { rgb: '1E293B' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border:    borderMedium,
}
const sToplamPara = (renk: string) => ({
  font:      { name: 'Calibri', sz: 10, bold: true, color: { rgb: renk } },
  fill:      { fgColor: { rgb: '1E293B' } },
  alignment: { horizontal: 'right', vertical: 'center' },
  numFmt:    '#,##0.00 \u20BA',
  border:    borderMedium,
})
const sAltNot = {
  font: { name: 'Calibri', sz: 8, italic: true, color: { rgb: '94A3B8' } },
}

// ─── Sheet Oluşturucular ──────────────────────────────────────

async function buildKasaSheet(utils: any, firma: Firma) {
  const { data: hareketler } = await supabase
    .from('kasa_hareketleri').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false })
  const { data: hesaplar } = await supabase
    .from('banka_hesaplari').select('*').eq('firma_id', firma.id)

  const ws: any = {}
  const merges: any[] = []
  const COLS = 4
  let row = 0

  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad.toUpperCase()} — KASA & BANKA`, sBaslik('0F766E'))
  for (let i = 1; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', sBaslik('0F766E'))
  ws[utils.encode_cell({ r: row, c: COLS - 1 })] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
  row += 2

  const rows = hareketler || []
  const toplamGiris = rows.filter(h => h.islem_tipi === 'giris').reduce((s, h) => s + Number(h.tutar), 0)
  const toplamCikis = rows.filter(h => h.islem_tipi === 'cikis').reduce((s, h) => s + Number(h.tutar), 0)
  const bakiye = toplamGiris - toplamCikis

  ;['TOPLAM GİRİŞ', 'TOPLAM ÇIKIŞ', 'NET BAKİYE', ''].forEach((l, i) => {
    ws[utils.encode_cell({ r: row, c: i })] = cell(l, { font: { name: 'Calibri', sz: 8, color: { rgb: '64748B' } }, fill: { fgColor: { rgb: ACIK } }, alignment: { horizontal: 'center', vertical: 'center' }, border })
  })
  row++
  ;[toplamGiris, toplamCikis, bakiye, 0].forEach((v, i) => {
    ws[utils.encode_cell({ r: row, c: i })] = numCell(v, { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: KOYU } }, fill: { fgColor: { rgb: ACIK } }, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '#,##0.00 \u20BA', border })
  })
  row += 2

  ;['Tarih', 'Açıklama', 'İşlem Tipi', 'Tutar (₺)'].forEach((h, i) => {
    ws[utils.encode_cell({ r: row, c: i })] = cell(h, sTh)
  })
  row++

  rows.forEach((h, idx) => {
    const z = idx % 2 === 1
    const isGiris = h.islem_tipi === 'giris'
    ws[utils.encode_cell({ r: row, c: 0 })] = cell(h.tarih ? new Date(h.tarih).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 1 })] = cell(h.aciklama || '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 2 })] = cell(isGiris ? 'Giriş' : 'Çıkış', sTd(z))
    ws[utils.encode_cell({ r: row, c: 3 })] = numCell(Number(h.tutar), { ...sTdR(z), font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: isGiris ? YESIL : KIRMIZI } } })
    row++
  })

  row++
  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  ${rows.length} hareket`, sAltNot)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })

  ws['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 14 }, { wch: 18 }]
  ws['!merges'] = merges
  ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })
  return ws
}

async function buildKarZararSheet(utils: any, firma: Firma) {
  const { data } = await supabase
    .from('kar_zarar').select('*').eq('firma_id', firma.id).order('yil', { ascending: true }).order('ay', { ascending: true })

  const ws: any = {}
  const merges: any[] = []
  const rows = data || []
  const TOPLAM_COLS = 1 + rows.length + (rows.length > 1 ? 1 : 0)
  let row = 0

  // Her satır için hesapla
  const calc = (d: any) => {
    const hakedisler    = Number(d.hakedisler    || 0)
    const digerSatislar = Number(d.diger_satislar || d.diger_gelirler || 0)
    const toplamGelir   = hakedisler + digerSatislar
    const donemBasi     = Number(d.donem_basi_stok || 0)
    const malzeme       = Number(d.malzeme_alis   || d.malzeme_giderleri || 0)
    const iscilik       = Number(d.iscilik        || d.iscilik_giderleri || 0)
    const toplamUretim  = donemBasi + malzeme + iscilik
    const finans        = Number(d.finans_gideri  || d.finans_giderleri  || 0)
    const sigorta       = Number(d.sigorta_gideri || 0)
    const amortisman    = Number(d.amortisman     || 0)
    const diger         = Number(d.diger_giderler || 0)
    const toplamGenel   = finans + sigorta + amortisman + diger
    const toplamGider   = toplamUretim + toplamGenel
    const oncekiDevir   = Number(d.onceki_donem_devir || 0)
    const brutKar       = toplamGelir - toplamGider
    const netKar        = brutKar + oncekiDevir
    const yaygınGelir   = Number(d.yaygin_gelir   || d.yillara_yaygin_gelir || 0)
    const yaygınGider   = Number(d.yaygin_gider   || d.yillara_yaygin_gider || 0)
    return { hakedisler, digerSatislar, toplamGelir, donemBasi, malzeme, iscilik, toplamUretim, finans, sigorta, amortisman, diger, toplamGenel, toplamGider, oncekiDevir, brutKar, netKar, yaygınGelir, yaygınGider }
  }
  const hesaplar = rows.map(calc)

  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad.toUpperCase()} — KAR / ZARAR`, sBaslik(YESIL))
  for (let i = 1; i < TOPLAM_COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', sBaslik(YESIL))
  ws[utils.encode_cell({ r: row, c: TOPLAM_COLS - 1 })] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOPLAM_COLS - 2 } })
  row += 2

  const donemTh = (idx: number) => ({
    font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: BEYAZ } },
    fill: { fgColor: { rgb: idx % 2 === 0 ? '1E3A5F' : MAVI } },
    alignment: { horizontal: 'center', vertical: 'center' }, border,
  })
  ws[utils.encode_cell({ r: row, c: 0 })] = cell('Kalem', donemTh(0))
  rows.forEach((d, i) => {
    const ay = d.ay || (new Date(d.donem||'').getMonth()+1)
    const yil = d.yil || new Date(d.donem||'').getFullYear()
    const ayAdi = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][Number(ay)-1] || d.donem
    ws[utils.encode_cell({ r: row, c: i + 1 })] = cell(`${ayAdi} ${yil}`, donemTh(i))
  })
  if (rows.length > 1) ws[utils.encode_cell({ r: row, c: rows.length + 1 })] = cell('YILLIK TOPLAM', donemTh(rows.length))
  row++

  // Satır yardımcısı
  const satirEkle = (label: string, getter: (h: ReturnType<typeof calc>) => number, z: boolean, tip: 'gelir'|'gider'|'toplam'|'net'|'devir'|'yaygin') => {
    const sL = tip === 'net' ? sToplamlabel
      : tip === 'toplam' && label.includes('GELİR') ? { ...sTd(), font:{name:'Calibri',sz:9,bold:true,color:{rgb:YESIL}}, fill:{fgColor:{rgb:'DCFCE7'}} }
      : tip === 'toplam' ? { ...sTd(), font:{name:'Calibri',sz:9,bold:true,color:{rgb:KIRMIZI}}, fill:{fgColor:{rgb:'FEE2E2'}} }
      : tip === 'yaygin' ? { ...sTd(z), font:{name:'Calibri',sz:9,color:{rgb:'3730A3'}}, fill:{fgColor:{rgb:z?'EEF2FF':'F5F3FF'}} }
      : sTd(z)
    const sP = (v: number) => tip === 'net' ? sToplamPara(v >= 0 ? YESIL : KIRMIZI)
      : tip === 'toplam' && label.includes('GELİR') ? { font:{name:'Calibri',sz:9,bold:true,color:{rgb:YESIL}}, fill:{fgColor:{rgb:'DCFCE7'}}, alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0.00 ₺', border }
      : tip === 'toplam' ? { font:{name:'Calibri',sz:9,bold:true,color:{rgb:KIRMIZI}}, fill:{fgColor:{rgb:'FEE2E2'}}, alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0.00 ₺', border }
      : tip === 'yaygin' ? { ...sTdR(z), font:{name:'Calibri',sz:9,color:{rgb:'3730A3'}}, fill:{fgColor:{rgb:z?'EEF2FF':'F5F3FF'}} }
      : tip === 'devir' ? { ...sTdR(z), fill:{fgColor:{rgb:'DBEAFE'}} }
      : { ...sTdR(z), font:{name:'Calibri',sz:9,color:{rgb:tip==='gelir'?(v>0?YESIL:'94A3B8'):(v>0?KIRMIZI:'94A3B8')}} }
    ws[utils.encode_cell({ r: row, c: 0 })] = cell(['net','toplam'].includes(tip) ? label : `  ${label}`, sL)
    hesaplar.forEach((h, i) => { const v = getter(h); ws[utils.encode_cell({ r: row, c: i+1 })] = numCell(v, sP(v)) })
    if (rows.length > 1) {
      const tot = hesaplar.reduce((s, h) => s + getter(h), 0)
      ws[utils.encode_cell({ r: row, c: rows.length+1 })] = numCell(tot, sP(tot))
    }
    row++
  }

  const bolum = (label: string, renk: string) => {
    ws[utils.encode_cell({ r: row, c: 0 })] = cell(label, sGrupBaslik(renk))
    for (let i = 1; i < TOPLAM_COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', sGrupBaslik(renk))
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOPLAM_COLS - 1 } }); row++
  }

  bolum('A. GELİRLER', YESIL)
  satirEkle('Hakedişler',       h => h.hakedisler,    false, 'gelir')
  satirEkle('Diğer Satışlar',   h => h.digerSatislar, true,  'gelir')
  satirEkle('TOPLAM GELİR',     h => h.toplamGelir,   false, 'toplam'); row++

  bolum('B. ÜRETİM GİDERLERİ', KIRMIZI)
  satirEkle('Dönem Başı Stok',  h => h.donemBasi,     false, 'gider')
  satirEkle('Malzeme Alışları', h => h.malzeme,       true,  'gider')
  satirEkle('İşçilik Giderleri',h => h.iscilik,       false, 'gider')
  satirEkle('TOPLAM ÜRETİM',    h => h.toplamUretim,  false, 'toplam'); row++

  bolum('C. GENEL YÖNETİM GİDERLERİ', '92400E')
  satirEkle('Finans Giderleri', h => h.finans,        false, 'gider')
  satirEkle('Sigorta Giderleri',h => h.sigorta,       true,  'gider')
  satirEkle('Amortisman',       h => h.amortisman,    false, 'gider')
  satirEkle('Diğer Giderler',   h => h.diger,         true,  'gider')
  satirEkle('TOPLAM GENEL GİDER',h => h.toplamGenel,  false, 'toplam'); row++

  satirEkle('TOPLAM GİDER (B+C)',h => h.toplamGider,  false, 'toplam'); row++
  satirEkle('DÖNEM KAR / ZARAR', h => h.brutKar,      false, 'net')
  satirEkle('Önceki Dönem Devir',h => h.oncekiDevir,  false, 'devir')
  satirEkle('NET SONUÇ',         h => h.netKar,       false, 'net'); row++

  bolum('D. YILLARA YAYGIN İNŞAAT (Bağımsız)', '3730A3')
  satirEkle('Yıllara Yaygın Gelir', h => h.yaygınGelir, false, 'yaygin')
  satirEkle('Yıllara Yaygın Gider', h => h.yaygınGider, true,  'yaygin')
  satirEkle('Net Yıllara Yaygın',   h => h.yaygınGelir - h.yaygınGider, false, 'yaygin')

  row++
  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  * Yıllara yaygın ana hesaba dahil değildir`, sAltNot)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: TOPLAM_COLS - 1 } })
  ws['!cols'] = [{ wch: 36 }, ...rows.map(() => ({ wch: 18 })), ...(rows.length > 1 ? [{ wch: 18 }] : [])]
  ws['!merges'] = merges
  ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: TOPLAM_COLS - 1 } })
  return ws
}

async function buildOdemePlaniSheet(utils: any, firma: Firma) {
  const { data } = await supabase
    .from('odeme_plani').select('*').eq('firma_id', firma.id).order('odeme_tarihi', { ascending: true })

  const ws: any = {}
  const merges: any[] = []
  const COLS = 6
  let row = 0

  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad.toUpperCase()} — ÖDEME PLANI`, sBaslik(MAVI))
  for (let i = 1; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', sBaslik(MAVI))
  ws[utils.encode_cell({ r: row, c: COLS - 1 })] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
  row += 2

  ;['Açıklama', 'Ödeme Tarihi', 'Tutar (₺)', 'Tür', 'Durum', 'Not'].forEach((h, i) => {
    ws[utils.encode_cell({ r: row, c: i })] = cell(h, sTh)
  })
  row++

  const rows = data || []
  rows.forEach((p, idx) => {
    const z = idx % 2 === 1
    const odendi = p.durum === 'odendi'
    ws[utils.encode_cell({ r: row, c: 0 })] = cell(p.aciklama || '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 1 })] = cell(p.odeme_tarihi ? new Date(p.odeme_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 2 })] = numCell(Number(p.tutar || 0), { ...sTdR(z), font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: odendi ? YESIL : KIRMIZI } } })
    ws[utils.encode_cell({ r: row, c: 3 })] = cell(p.odeme_turu || '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 4 })] = cell(odendi ? 'Ödendi' : 'Bekliyor', { ...sTd(z), font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: odendi ? YESIL : '92400E' } } })
    ws[utils.encode_cell({ r: row, c: 5 })] = cell(p.notlar || '', sTd(z))
    row++
  })

  const toplamBekleyen = rows.filter(p => p.durum !== 'odendi').reduce((s, p) => s + Number(p.tutar || 0), 0)
  const toplamOdenen   = rows.filter(p => p.durum === 'odendi').reduce((s, p) => s + Number(p.tutar || 0), 0)
  row++
  ;[['TOPLAM BEKLİYEN', toplamBekleyen, KIRMIZI], ['TOPLAM ÖDENEN', toplamOdenen, YESIL]].forEach(([l, v, r]) => {
    ws[utils.encode_cell({ r: row, c: 0 })] = cell(l, sToplamlabel)
    ws[utils.encode_cell({ r: row, c: 1 })] = numCell(v as number, sToplamPara(r as string))
    for (let i = 2; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', sToplamlabel)
    merges.push({ s: { r: row, c: 2 }, e: { r: row, c: COLS - 1 } })
    row++
  })

  row++
  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  ${rows.length} kayıt`, sAltNot)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 24 }]
  ws['!merges'] = merges
  ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })
  return ws
}

async function buildIsTakibiSheet(utils: any, firma: Firma) {
  const [{ data: isler }, { data: checklistRows }, { data: adimRows }] = await Promise.all([
    supabase.from('is_takibi_v2').select('*').eq('firma_id', firma.id).order('yil', { ascending: false }).order('ay', { ascending: false }),
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

  const IS_TIPLERI: Record<string, string> = {
    kdv1: 'KDV-1', kdv2: 'KDV-2', muhtasar_sgk: 'Muhtasar & SGK',
    gecici_vergi: 'Geçici Vergi', edefter: 'e-Defter', kurumlar_vergisi: 'Kurumlar Vergisi',
  }
  const DURUM_L: Record<string, string> = {
    bekliyor: 'Bekliyor', devam: 'Devam Ediyor', tamamlandi: 'Tamamlandı', uyari: 'Uyarı',
  }
  const DURUM_RENK: Record<string, string> = {
    bekliyor: '64748B', devam: '92400E', tamamlandi: YESIL, uyari: '9A3412',
  }

  const ws: any = {}
  const merges: any[] = []
  const COLS = 8
  let row = 0

  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad.toUpperCase()} — İŞ TAKİBİ`, sBaslik('7C3AED'))
  for (let i = 1; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', sBaslik('7C3AED'))
  ws[utils.encode_cell({ r: row, c: COLS - 1 })] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
  row += 2

  ;['İş Tipi', 'Dönem', 'Yıl', 'Son Beyan', 'Son Ödeme', 'Durum', 'Beyanname', 'Notlar'].forEach((h, i) => {
    ws[utils.encode_cell({ r: row, c: i })] = cell(h, sTh)
  })
  row++

  const rows = isler || []
  rows.forEach((is, idx) => {
    const z = idx % 2 === 1
    const renk = DURUM_RENK[is.durum] || KOYU
    const tdS = { ...sTd(z), font: { name: 'Calibri', sz: 9, color: { rgb: renk } } }
    ws[utils.encode_cell({ r: row, c: 0 })] = cell(IS_TIPLERI[is.is_tipi] || is.is_tipi, tdS)
    ws[utils.encode_cell({ r: row, c: 1 })] = cell(is.donem || '-', tdS)
    ws[utils.encode_cell({ r: row, c: 2 })] = cell(String(is.yil || '-'), tdS)
    ws[utils.encode_cell({ r: row, c: 3 })] = cell(is.son_beyan_tarihi ? new Date(is.son_beyan_tarihi).toLocaleDateString('tr-TR') : '-', tdS)
    ws[utils.encode_cell({ r: row, c: 4 })] = cell(is.son_odeme_tarihi ? new Date(is.son_odeme_tarihi).toLocaleDateString('tr-TR') : '-', tdS)
    ws[utils.encode_cell({ r: row, c: 5 })] = cell(DURUM_L[is.durum] || is.durum, { ...tdS, font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: renk } } })
    ws[utils.encode_cell({ r: row, c: 6 })] = cell(is.durum === 'tamamlandi' ? 'V' : is.durum === 'devam' ? '...' : 'O', tdS)
    ws[utils.encode_cell({ r: row, c: 7 })] = cell(is.notlar || '', tdS)
    row++

    // Süreç adımları
    const adimlar = (adimMap[is.id] || []).sort((a, b) => a.sira - b.sira)
    if (adimlar.length > 0) {
      const tamamlananAdim = adimlar.filter(a => a.durum === 'tamamlandi').length
      const adimBasS = { font: { name: 'Calibri', sz: 8, bold: true, color: { rgb: MAVI } }, fill: { fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'left', vertical: 'center' }, border }
      ws[utils.encode_cell({ r: row, c: 0 })] = cell(`  Surec Adimlari (${tamamlananAdim}/${adimlar.length})`, adimBasS)
      for (let i = 1; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', adimBasS)
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
      row++
      adimlar.forEach(adim => {
        const tamam = adim.durum === 'tamamlandi'
        const aRenk = tamam ? YESIL : adim.durum === 'devam' ? '92400E' : '64748B'
        const aBg   = tamam ? 'F0FDF4' : adim.durum === 'devam' ? 'FFFBEB' : 'FAFAFA'
        const aS = { font: { name: 'Calibri', sz: 8, color: { rgb: aRenk } }, fill: { fgColor: { rgb: aBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border }
        const aSR = { ...aS, alignment: { horizontal: 'center', vertical: 'center' } }
        ws[utils.encode_cell({ r: row, c: 0 })] = cell(`    ${tamam ? 'V' : 'O'}  ${adim.adim_adi}`, aS)
        ws[utils.encode_cell({ r: row, c: 1 })] = cell(DURUM_L[adim.durum] || adim.durum, aSR)
        ws[utils.encode_cell({ r: row, c: 2 })] = cell(adim.tamamlanma_tarihi ? new Date(adim.tamamlanma_tarihi).toLocaleDateString('tr-TR') : '', aSR)
        ws[utils.encode_cell({ r: row, c: 3 })] = adim.tutar ? numCell(Number(adim.tutar), { ...aSR, numFmt: '#,##0.00 \u20BA' }) : cell('', aSR)
        for (let i = 4; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', aS)
        merges.push({ s: { r: row, c: 4 }, e: { r: row, c: COLS - 1 } })
        row++
      })
    }

    // Ön kontrol listesi (KDV1)
    if (is.is_tipi === 'kdv1') {
      const kayitlar = checklistMap[is.id] || {}
      const tumK = KDV1_KONTROLLER.flatMap(g => g.kontroller)
      const tamamlanan = tumK.filter(k => kayitlar[k.kodu]?.tamamlandi).length
      const clBasS = { font: { name: 'Calibri', sz: 8, bold: true, color: { rgb: YESIL } }, fill: { fgColor: { rgb: 'F0FDF4' } }, alignment: { horizontal: 'left', vertical: 'center' }, border }
      ws[utils.encode_cell({ r: row, c: 0 })] = cell(`  On Kontrol Listesi (${tamamlanan}/${tumK.length})`, clBasS)
      for (let i = 1; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', clBasS)
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
      row++
      KDV1_KONTROLLER.forEach(grup => {
        grup.kontroller.forEach(k => {
          const tamam = kayitlar[k.kodu]?.tamamlandi === true
          const tarih = kayitlar[k.kodu]?.tamamlanma_tarihi ? new Date(kayitlar[k.kodu].tamamlanma_tarihi).toLocaleDateString('tr-TR') : ''
          const cS = { font: { name: 'Calibri', sz: 8, color: { rgb: tamam ? YESIL : '94A3B8' } }, fill: { fgColor: { rgb: tamam ? 'F0FDF4' : 'FAFAFA' } }, alignment: { horizontal: 'left', vertical: 'center' }, border }
          ws[utils.encode_cell({ r: row, c: 0 })] = cell(`    ${tamam ? 'V' : 'O'}  ${k.adi}`, cS)
          ws[utils.encode_cell({ r: row, c: 1 })] = cell(tamam ? 'Tamamlandi' : 'Bekliyor', { ...cS, alignment: { horizontal: 'center', vertical: 'center' } })
          ws[utils.encode_cell({ r: row, c: 2 })] = cell(tarih, { ...cS, alignment: { horizontal: 'center', vertical: 'center' } })
          for (let i = 3; i < COLS; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', cS)
          merges.push({ s: { r: row, c: 3 }, e: { r: row, c: COLS - 1 } })
          row++
        })
      })
    }
  })

  row++
  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  ${rows.length} kayıt`, sAltNot)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 28 }]
  ws['!merges'] = merges
  ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })
  return ws
}

async function buildProjelerSheet(utils: any, firma: Firma) {
  const { data } = await supabase
    .from('projeler').select('*').eq('firma_id', firma.id).order('baslangic_tarihi', { ascending: false })

  const ws: any = {}
  const merges: any[] = []
  const COLS = 6
  let row = 0

  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad.toUpperCase()} — PROJELER`, sBaslik('92400E'))
  for (let i = 1; i < COLS - 1; i++) ws[utils.encode_cell({ r: row, c: i })] = cell('', sBaslik('92400E'))
  ws[utils.encode_cell({ r: row, c: COLS - 1 })] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 2 } })
  row += 2

  ;['Proje Adı', 'Başlangıç', 'Bitiş', 'Bütçe (₺)', 'Durum', 'Açıklama'].forEach((h, i) => {
    ws[utils.encode_cell({ r: row, c: i })] = cell(h, sTh)
  })
  row++

  const rows = data || []
  rows.forEach((p, idx) => {
    const z = idx % 2 === 1
    ws[utils.encode_cell({ r: row, c: 0 })] = cell(p.proje_adi || '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 1 })] = cell(p.baslangic_tarihi ? new Date(p.baslangic_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 2 })] = cell(p.bitis_tarihi ? new Date(p.bitis_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 3 })] = p.butce ? numCell(Number(p.butce), sTdR(z)) : cell('-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 4 })] = cell(p.durum || '-', sTd(z))
    ws[utils.encode_cell({ r: row, c: 5 })] = cell(p.aciklama || '', sTd(z))
    row++
  })

  row++
  ws[utils.encode_cell({ r: row, c: 0 })] = cell(`${firma.ad}  |  ${new Date().toLocaleDateString('tr-TR')}  |  ${rows.length} proje`, sAltNot)
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: COLS - 1 } })
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 30 }]
  ws['!merges'] = merges
  ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: COLS - 1 } })
  return ws
}

// ─── Sheet Builder Map ────────────────────────────────────────

async function buildPersonelSheet(utils: any, firma: Firma) {
  const { data } = await supabase.from('personeller').select('*').eq('firma_id', firma.id).order('ad_soyad')
  const ws: any = {}; const merges: any[] = []; const COLS = 9; let row = 0
  ws[utils.encode_cell({r:row,c:0})] = cell(`${firma.ad.toUpperCase()} — PERSONEL LİSTESİ`, sBaslik('1E3A5F'))
  for(let i=1;i<COLS-1;i++) ws[utils.encode_cell({r:row,c:i})] = cell('', sBaslik('1E3A5F'))
  ws[utils.encode_cell({r:row,c:COLS-1})] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({s:{r:row,c:0},e:{r:row,c:COLS-2}}); row+=2
  ;['Ad Soyad','TC Kimlik','Telefon','Pozisyon','Maaş Tipi','Net Maaş','İşe Giriş','İşten Çıkış','Durum'].forEach((h,i)=>{ ws[utils.encode_cell({r:row,c:i})] = cell(h, sTh) }); row++
  const rows = data || []
  rows.forEach((p,idx) => {
    const z = idx%2===1
    ws[utils.encode_cell({r:row,c:0})] = cell(p.ad_soyad, sTd(z))
    ws[utils.encode_cell({r:row,c:1})] = cell(p.tc_kimlik||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:2})] = cell(p.telefon||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:3})] = cell(p.pozisyon||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:4})] = cell(p.maas_tipi||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:5})] = p.net_maas ? numCell(Number(p.net_maas), sTdR(z)) : cell('-', sTd(z))
    ws[utils.encode_cell({r:row,c:6})] = cell(p.ise_giris_tarihi ? new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({r:row,c:7})] = cell(p.isten_cikis_tarihi ? new Date(p.isten_cikis_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({r:row,c:8})] = cell(p.aktif ? 'Aktif' : 'Pasif', {...sTd(z), font:{name:'Calibri',sz:9,bold:true,color:{rgb:p.aktif?YESIL:KIRMIZI}}})
    row++
  })
  ws['!cols'] = [{wch:24},{wch:14},{wch:14},{wch:18},{wch:10},{wch:14},{wch:12},{wch:12},{wch:8}]
  ws['!merges'] = merges; ws['!ref'] = utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}}); return ws
}

async function buildCariSheet(utils: any, firma: Firma) {
  const [{ data: cariler }, { data: hareketler }] = await Promise.all([
    supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id).order('ad'),
    supabase.from('cari_hareketler').select('cari_hesap_id,tur,tutar').eq('firma_id', firma.id),
  ])
  const bakiyeMap: Record<string,number> = {}
  ;(hareketler||[]).forEach((h:any) => {
    if (!bakiyeMap[h.cari_hesap_id]) bakiyeMap[h.cari_hesap_id] = 0
    const t = Number(h.tutar||0)
    bakiyeMap[h.cari_hesap_id] += ['alacak','tahsilat','cek_alindi'].includes(h.tur) ? t : -t
  })
  const ws: any = {}; const merges: any[] = []; const COLS = 7; let row = 0
  ws[utils.encode_cell({r:row,c:0})] = cell(`${firma.ad.toUpperCase()} — CARİ HESAPLAR`, sBaslik('4338CA'))
  for(let i=1;i<COLS-1;i++) ws[utils.encode_cell({r:row,c:i})] = cell('', sBaslik('4338CA'))
  ws[utils.encode_cell({r:row,c:COLS-1})] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({s:{r:row,c:0},e:{r:row,c:COLS-2}}); row+=2
  ;['Cari Ad','Tip','VKN/TCKN','Telefon','IBAN','Bakiye','Durum'].forEach((h,i)=>{ ws[utils.encode_cell({r:row,c:i})] = cell(h, sTh) }); row++
  ;(cariler||[]).forEach((c:any,idx:number) => {
    const z = idx%2===1; const bak = bakiyeMap[c.id]??0
    ws[utils.encode_cell({r:row,c:0})] = cell(c.ad, sTd(z))
    ws[utils.encode_cell({r:row,c:1})] = cell(c.tip||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:2})] = cell(c.vkn_tckn||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:3})] = cell(c.telefon||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:4})] = cell(c.iban||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:5})] = numCell(Math.abs(bak), {...sTdR(z), font:{name:'Calibri',sz:9,bold:true,color:{rgb:bak>=0?YESIL:KIRMIZI}}})
    ws[utils.encode_cell({r:row,c:6})] = cell(bak>=0?'Alacak':'Borc', sTd(z))
    row++
  })
  ws['!cols'] = [{wch:28},{wch:14},{wch:14},{wch:14},{wch:26},{wch:16},{wch:10}]
  ws['!merges'] = merges; ws['!ref'] = utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}}); return ws
}

async function buildTeminatSheet(utils: any, firma: Firma) {
  const [{ data: teminatlar }, { data: projeler }] = await Promise.all([
    supabase.from('teminatlar').select('*').eq('firma_id', firma.id).order('verilis_tarihi', {ascending:false}),
    supabase.from('projeler').select('id,proje_adi').eq('firma_id', firma.id),
  ])
  const projeMap: Record<string,string> = {}
  ;(projeler||[]).forEach((p:any) => { projeMap[p.id] = p.proje_adi })
  const ws: any = {}; const merges: any[] = []; const COLS = 10; let row = 0
  ws[utils.encode_cell({r:row,c:0})] = cell(`${firma.ad.toUpperCase()} — TEMİNAT TAKİBİ`, sBaslik('0E7490'))
  for(let i=1;i<COLS-1;i++) ws[utils.encode_cell({r:row,c:i})] = cell('', sBaslik('0E7490'))
  ws[utils.encode_cell({r:row,c:COLS-1})] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({s:{r:row,c:0},e:{r:row,c:COLS-2}}); row+=2
  ;['Başlık','Tür','Veren','Proje','Belge No','Banka','Veriliş','Geçerlilik','Tutar','Kalan'].forEach((h,i)=>{ ws[utils.encode_cell({r:row,c:i})] = cell(h, sTh) }); row++
  ;(teminatlar||[]).forEach((t:any,idx:number) => {
    const z = idx%2===1; const kalan = Number(t.kalan_tutar||t.tutar||0); const tutar = Number(t.tutar||0)
    ws[utils.encode_cell({r:row,c:0})] = cell(t.baslik, sTd(z))
    ws[utils.encode_cell({r:row,c:1})] = cell(t.teminat_turu||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:2})] = cell(t.veren_firma, sTd(z))
    ws[utils.encode_cell({r:row,c:3})] = cell(projeMap[t.proje_id]||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:4})] = cell(t.belge_no||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:5})] = cell(t.banka_adi||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:6})] = cell(t.verilis_tarihi ? new Date(t.verilis_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({r:row,c:7})] = cell(t.gecerlilik_tarihi ? new Date(t.gecerlilik_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({r:row,c:8})] = numCell(tutar, sTdR(z))
    ws[utils.encode_cell({r:row,c:9})] = numCell(kalan, {...sTdR(z), font:{name:'Calibri',sz:9,bold:true,color:{rgb:kalan<tutar?KIRMIZI:YESIL}}})
    row++
  })
  ws['!cols'] = [{wch:24},{wch:18},{wch:20},{wch:18},{wch:14},{wch:16},{wch:12},{wch:12},{wch:16},{wch:16}]
  ws['!merges'] = merges; ws['!ref'] = utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}}); return ws
}

async function buildGorevlerSheet(utils: any, firma: Firma) {
  const { data } = await supabase.from('gorevler').select('*').eq('firma_id', firma.id).order('created_at', {ascending:false})
  const ws: any = {}; const merges: any[] = []; const COLS = 7; let row = 0
  ws[utils.encode_cell({r:row,c:0})] = cell(`${firma.ad.toUpperCase()} — GÖREV TAKİBİ`, sBaslik('5B21B6'))
  for(let i=1;i<COLS-1;i++) ws[utils.encode_cell({r:row,c:i})] = cell('', sBaslik('5B21B6'))
  ws[utils.encode_cell({r:row,c:COLS-1})] = cell(new Date().toLocaleDateString('tr-TR'), sTarih)
  merges.push({s:{r:row,c:0},e:{r:row,c:COLS-2}}); row+=2
  ;['Başlık','Kategori','Öncelik','Durum','Son Tarih','Atanan','Açıklama'].forEach((h,i)=>{ ws[utils.encode_cell({r:row,c:i})] = cell(h, sTh) }); row++
  const DURUM_RENK: Record<string,string> = {bekliyor:'64748B',devam:'92400E',tamamlandi:YESIL,ertelendi:MAVI,iptal:KIRMIZI}
  ;(data||[]).forEach((g:any,idx:number) => {
    const z = idx%2===1; const renk = DURUM_RENK[g.durum]||KOYU
    ws[utils.encode_cell({r:row,c:0})] = cell(g.baslik, sTd(z))
    ws[utils.encode_cell({r:row,c:1})] = cell(g.kategori||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:2})] = cell(g.oncelik||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:3})] = cell(g.durum||'-', {...sTd(z), font:{name:'Calibri',sz:9,bold:true,color:{rgb:renk}}})
    ws[utils.encode_cell({r:row,c:4})] = cell(g.son_tarih ? new Date(g.son_tarih).toLocaleDateString('tr-TR') : '-', sTd(z))
    ws[utils.encode_cell({r:row,c:5})] = cell(g.atanan_kisi||'-', sTd(z))
    ws[utils.encode_cell({r:row,c:6})] = cell(g.aciklama||'', sTd(z))
    row++
  })
  ws['!cols'] = [{wch:30},{wch:12},{wch:10},{wch:14},{wch:12},{wch:16},{wch:30}]
  ws['!merges'] = merges; ws['!ref'] = utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}}); return ws
}

const SHEET_BUILDERS: Record<string, (utils: any, firma: Firma) => Promise<any>> = {
  'kasa':        buildKasaSheet,
  'kar-zarar':   buildKarZararSheet,
  'odeme-plani': buildOdemePlaniSheet,
  'is-takibi':   buildIsTakibiSheet,
  'projeler':    buildProjelerSheet,
  'personel':    buildPersonelSheet,
  'cari':        buildCariSheet,
  'teminat':     buildTeminatSheet,
  'gorevler':    buildGorevlerSheet,
}

const SHEET_NAMES: Record<string, string> = {
  'kasa':        'Kasa & Banka',
  'kar-zarar':   'Kar-Zarar',
  'odeme-plani': 'Ödeme Planı',
  'is-takibi':   'İş Takibi',
  'projeler':    'Projeler',
  'personel':    'Personel',
  'cari':        'Cari Hesaplar',
  'teminat':     'Teminat',
  'gorevler':    'Görevler',
}

// ─── Ana Bileşen ──────────────────────────────────────────────
export default function Raporlar({ firma }: AppCtx) {
  const [firmalar, setFirmalar]           = useState<Firma[]>([])
  const [seciliFirmalar, setSeciliFirmalar] = useState<string[]>([firma.id])
  const [seciliModuller, setSeciliModuller] = useState<string[]>(MODULLER.map(m => m.id))
  const [loading, setLoading]             = useState(false)
  const [firmaLoading, setFirmaLoading]   = useState(true)

  useEffect(() => {
    supabase.from('firmalar').select('*').eq('aktif', true).order('ad').then(({ data }) => {
      setFirmalar(data || [])
      setFirmaLoading(false)
    })
  }, [])

  function toggleFirma(id: string) {
    setSeciliFirmalar(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  function toggleModul(id: string) {
    setSeciliModuller(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  // Tek firma, tek modül raporu
  async function exportTekRapor(firmaObj: Firma, modulId: string) {
    setLoading(true)
    try {
      const XLSXStyle = await import('xlsx-js-style')
      const { utils, writeFile } = XLSXStyle
      const builder = SHEET_BUILDERS[modulId]
      if (!builder) return
      const ws = await builder(utils, firmaObj)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, SHEET_NAMES[modulId] || modulId)
      writeFile(wb, `${firmaObj.ad}-${modulId}-${new Date().toISOString().split('T')[0]}.xlsx`)
    } finally {
      setLoading(false)
    }
  }

  // Seçili firmalar + modüller için birleşik rapor
  async function exportBirlesiкRapor() {
    if (seciliFirmalar.length === 0 || seciliModuller.length === 0) return
    setLoading(true)
    try {
      const XLSXStyle = await import('xlsx-js-style')
      const { utils, writeFile } = XLSXStyle
      const wb = utils.book_new()

      for (const firmaId of seciliFirmalar) {
        const firmaObj = firmalar.find(f => f.id === firmaId)
        if (!firmaObj) continue
        const firmaKisa = (firmaObj.kisa_ad || firmaObj.ad).substring(0, 10)

        for (const modulId of seciliModuller) {
          const builder = SHEET_BUILDERS[modulId]
          if (!builder) continue
          const ws = await builder(utils, firmaObj)
          const sheetName = `${firmaKisa}-${SHEET_NAMES[modulId] || modulId}`.substring(0, 31)
          utils.book_append_sheet(wb, ws, sheetName)
        }
      }

      const firmaAdi = seciliFirmalar.length === 1
        ? (firmalar.find(f => f.id === seciliFirmalar[0])?.ad || 'rapor')
        : 'tum-firmalar'
      writeFile(wb, `rapor-${firmaAdi}-${new Date().toISOString().split('T')[0]}.xlsx`)
    } finally {
      setLoading(false)
    }
  }

  // Tüm firmalar + tüm modüller
  async function exportTumRapor() {
    setLoading(true)
    try {
      const XLSXStyle = await import('xlsx-js-style')
      const { utils, writeFile } = XLSXStyle
      const wb = utils.book_new()

      for (const firmaObj of firmalar) {
        const firmaKisa = (firmaObj.kisa_ad || firmaObj.ad).substring(0, 10)
        for (const modul of MODULLER) {
          const builder = SHEET_BUILDERS[modul.id]
          if (!builder) continue
          const ws = await builder(utils, firmaObj)
          const sheetName = `${firmaKisa}-${SHEET_NAMES[modul.id]}`.substring(0, 31)
          utils.book_append_sheet(wb, ws, sheetName)
        }
      }

      writeFile(wb, `tam-rapor-${new Date().toISOString().split('T')[0]}.xlsx`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
        title="Raporlar"
        subtitle="Modül ve firma bazlı Excel raporu oluşturun"
        iconBg="bg-emerald-50"
        action={
          <Btn
            variant="primary"
            size="sm"
            icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            onClick={exportTumRapor}
            disabled={loading || firmalar.length === 0}
          >
            Tam Rapor (Tüm Firma & Modüller)
          </Btn>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Firma Seçimi */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> Firma Seçimi
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setSeciliFirmalar(firmalar.map(f => f.id))} className="text-xs text-blue-600 hover:underline">Tümü</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setSeciliFirmalar([])} className="text-xs text-gray-500 hover:underline">Temizle</button>
            </div>
          </div>
          {firmaLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <div className="space-y-2">
              {firmalar.map(f => (
                <label key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seciliFirmalar.includes(f.id)}
                    onChange={() => toggleFirma(f.id)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">{f.ad}</span>
                  {f.vergi_no && <span className="text-xs text-gray-400 ml-auto">{f.vergi_no}</span>}
                </label>
              ))}
            </div>
          )}
        </Card>

        {/* Modül Seçimi */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" /> Modül Seçimi
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setSeciliModuller(MODULLER.map(m => m.id))} className="text-xs text-blue-600 hover:underline">Tümü</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setSeciliModuller([])} className="text-xs text-gray-500 hover:underline">Temizle</button>
            </div>
          </div>
          <div className="space-y-2">
            {MODULLER.map(m => (
              <label key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seciliModuller.includes(m.id)}
                  onChange={() => toggleModul(m.id)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-lg">{m.icon}</span>
                <span className="text-sm font-medium text-gray-700">{m.label}</span>
              </label>
            ))}
          </div>
        </Card>
      </div>

      {/* Birleşik Rapor Butonu */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-800">Seçili Rapor</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {seciliFirmalar.length} firma · {seciliModuller.length} modül seçili
              {seciliFirmalar.length > 0 && seciliModuller.length > 0 && (
                <span className="text-gray-400"> → {seciliFirmalar.length * seciliModuller.length} sayfa</span>
              )}
            </p>
          </div>
          <Btn
            variant="primary"
            icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            onClick={exportBirlesiкRapor}
            disabled={loading || seciliFirmalar.length === 0 || seciliModuller.length === 0}
          >
            Seçili Raporu İndir
          </Btn>
        </div>
      </Card>

      {/* Hızlı Tekli Raporlar */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Hızlı Rapor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {MODULLER.map(modul => (
            <Card key={modul.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{modul.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{modul.label}</p>
                    <p className="text-xs text-gray-400">{firma.ad}</p>
                  </div>
                </div>
                <Btn
                  variant="secondary"
                  size="sm"
                  icon={loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  onClick={() => exportTekRapor(firma, modul.id)}
                  disabled={loading}
                >
                  İndir
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
