'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  CreditCard,
  Download,
  FileSpreadsheet,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  Wallet2,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

import { ConfirmModal, ErrorMsg, Field, Loading, Modal, cls } from '@/components/ui'
import { format } from 'date-fns'

type KasaHareketi = {
  id: string
  created_at: string
  firma_id: string
  tarih: string
  aciklama: string
  tur: 'gelir' | 'gider'
  tutar: number
  kategori: string | null
  odeme_sekli: 'nakit' | 'banka' | 'kart' | 'avans' | 'diger'
}

type OdemeSekli = 'nakit' | 'banka' | 'kart' | 'avans' | 'diger'

const ODEME_SEKLI_LABEL: Record<OdemeSekli, string> = {
  nakit: 'Nakit',
  banka: 'Banka',
  kart: 'Kredi Kartı',
  avans: 'Avans',
  diger: 'Diğer',
}

function getMonthStyle(monthStr: string) {
  const m = parseInt(monthStr.split('-')[1], 10) || 1;
  const styles = [
    'from-slate-100 to-slate-200 text-slate-900 border-slate-300',
    'from-blue-50 to-cyan-100 text-blue-950 border-blue-200',      // 1 Oca
    'from-emerald-50 to-teal-100 text-emerald-950 border-emerald-200', // 2 Şub
    'from-amber-50 to-yellow-100 text-amber-950 border-amber-200',   // 3 Mar
    'from-rose-50 to-pink-100 text-rose-950 border-rose-200',      // 4 Nis
    'from-purple-50 to-fuchsia-100 text-purple-950 border-purple-200', // 5 May
    'from-cyan-50 to-sky-100 text-cyan-950 border-cyan-200',       // 6 Haz
    'from-lime-50 to-green-100 text-lime-950 border-lime-200',       // 7 Tem
    'from-orange-50 to-amber-100 text-orange-950 border-orange-200',   // 8 Ağu
    'from-fuchsia-50 to-pink-100 text-fuchsia-950 border-fuchsia-200', // 9 Eyl
    'from-teal-50 to-emerald-100 text-teal-950 border-teal-200',       // 10 Eki
    'from-sky-50 to-blue-100 text-sky-950 border-sky-200',         // 11 Kas
    'from-indigo-50 to-purple-100 text-indigo-950 border-indigo-200',  // 12 Ara
  ];
  return styles[m];
}

function getMonthName(monthStr: string) {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function getDateStyle(dateStr: string) {
  const n = new Date(dateStr + 'T00:00:00').getDay() || 0;
  const styles = [
    'from-rose-500 to-orange-500 text-slate-800 shadow-rose-500/30',    // Pazar
    'from-blue-500 to-indigo-500 text-slate-800 shadow-blue-500/30',    // Pazartesi
    'from-emerald-400 to-teal-500 text-slate-800 shadow-emerald-500/30',   // Salı
    'from-fuchsia-500 to-purple-600 text-slate-800 shadow-purple-500/30', // Çarşamba
    'from-amber-400 to-orange-500 text-slate-800 shadow-amber-500/30',   // Perşembe
    'from-cyan-400 to-blue-500 text-slate-800 shadow-cyan-500/30',      // Cuma
    'from-slate-600 to-gray-800 text-slate-800 shadow-slate-500/30',     // Cumartesi
  ];
  return styles[n % 7];
}

function cleanTr(text: string) {
  return String(text ?? '')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c')
    .replace(/·/g, '-')
    .replace(/[“”]/g, '"')
}

const OdemeIcon = ({ sekil, ...props }: { sekil: OdemeSekli, [key: string]: any }) => {
  const ICONS: Record<OdemeSekli, typeof Wallet> = {
    nakit: Banknote,
    banka: Landmark,
    kart: CreditCard,
    avans: Wallet2,
    diger: Wallet,
  }
  const Icon = ICONS[sekil] || Wallet
  return <Icon {...props} />
}

const EMPTY_FORM: Partial<KasaHareketi> = {
  tarih: new Date().toISOString().split('T')[0],
  aciklama: '',
  tur: 'gider',
  tutar: 0,
  kategori: '',
  odeme_sekli: 'nakit',
}

export default function KasaModule({ firma, firmalar, firmaIds }: AppCtx) {
  const [hareketler, setHareketler] = useState<KasaHareketi[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<Partial<KasaHareketi> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  useEffect(() => {
    load()
  }, [firmaIds.join(',')])

  async function load() {
    setLoading(true)
    setError('')
    const hareketRes = await supabase.from('kasa_hareketleri').select('*').in('firma_id', firmaIds).order('tarih', { ascending: false }).order('created_at', { ascending: false })

    if (hareketRes.error) {
      setError(hareketRes.error.message)
      setLoading(false)
      return
    }

    setHareketler((hareketRes.data || []) as KasaHareketi[])
    setLoading(false)
  }

  async function save() {
    if (!modal?.aciklama?.trim() || !modal.tarih || !modal.tutar) {
      alert('Açıklama, tutar ve tarih zorunludur.')
      return
    }

    setSaving(true)
    const payload = {
      firma_id: modal.id ? (modal.firma_id || firma.id) : selFirmaId,
      tarih: modal.tarih,
      aciklama: modal.aciklama.trim(),
      tur: modal.tur || 'gider',
      tutar: Number(modal.tutar || 0),
      kategori: modal.kategori || null,
      odeme_sekli: modal.odeme_sekli || 'nakit',
    }

    const { error: saveError } = modal.id
      ? await supabase.from('kasa_hareketleri').update(payload).eq('id', modal.id)
      : await supabase.from('kasa_hareketleri').insert(payload)

    setSaving(false)
    if (saveError) {
      alert(saveError.message)
      return
    }

    setModal(null)
    await load()
  }

  async function deleteHareket() {
    if (!deleteId) return
    await supabase.from('kasa_hareketleri').delete().eq('id', deleteId)
    setDeleteId(null)
    await load()
  }

  const filtered = hareketler

  const stats = useMemo(() => {
    const gelir = filtered.filter((h) => h.tur === 'gelir').reduce((sum, h) => sum + Number(h.tutar || 0), 0)
    const gider = filtered.filter((h) => h.tur === 'gider').reduce((sum, h) => sum + Number(h.tutar || 0), 0)
    return { gelir, gider, bakiye: gelir - gider }
  }, [filtered])

  const groupedByMonth = useMemo(() => {
    const result: Record<string, Record<string, KasaHareketi[]>> = {}
    filtered.forEach(item => {
      const date = item.tarih || ''
      if (!date) return
      const month = date.substring(0, 7)
      if (!result[month]) result[month] = {}
      if (!result[month][date]) result[month][date] = []
      result[month][date].push(item)
    })
    const sortedMonths = Object.keys(result).sort((a, b) => b.localeCompare(a))
    const sortedResult: Record<string, Record<string, KasaHareketi[]>> = {}
    sortedMonths.forEach(m => {
      const sortedDays = Object.keys(result[m]).sort((a, b) => b.localeCompare(a))
      sortedResult[m] = {}
      sortedDays.forEach(d => {
        sortedResult[m][d] = result[m][d]
      })
    })
    return sortedResult
  }, [filtered])

async function exportPDF() {
  try {
    const jsPDFModule = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const jsPDF = jsPDFModule.default
    const autoTable = autoTableModule.default
    const doc = new jsPDF('p') // Portrait

    // Header
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F')
    doc.setFont('Helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.text(cleanTr(firma.ad || 'Kasa Raporu'), 14, 18)
    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(cleanTr('KASA RAPORU'), 14, 25)

    // Summary Cards
    doc.setTextColor(36, 50, 70)
    const summaryCards = [
      { label: 'Toplam Gelir', value: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats.gelir) },
      { label: 'Toplam Gider', value: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats.gider) },
      { label: 'Net Bakiye', value: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats.bakiye) },
    ]
    let summaryX = 14
    summaryCards.forEach(card => {
      doc.setFillColor(244, 247, 251)
      doc.roundedRect(summaryX, 36, 60, 18, 3, 3, 'F')
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(cleanTr(card.label.toUpperCase()), summaryX + 4, 43)
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(cleanTr(card.value), summaryX + 4, 50)
      summaryX += 64
    })

    autoTable(doc, {
      startY: 62,
      head: [['Tarih', 'Tür', 'Kategori', 'Açıklama', 'Ö.Şekli', 'Cari', 'Tutar']],
      body: filtered.map((item) => {
        return [
          format(new Date(item.tarih + 'T00:00:00'), 'dd.MM.yyyy'),
          item.tur === 'gelir' ? 'Gelir' : 'Gider',
          cleanTr(item.kategori || '-'),
          cleanTr(item.aciklama),
          cleanTr(ODEME_SEKLI_LABEL[item.odeme_sekli as OdemeSekli] || '-'),
          '-',
          `${item.tur === 'gelir' ? '+' : '-'} ${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(Number(item.tutar || 0))} TL`,
        ]
      }),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: [36, 50, 70], lineColor: [220, 230, 245], lineWidth: 0.2, fontSize: 8, font: 'helvetica' },
      alternateRowStyles: { fillColor: [248, 251, 253] },
      margin: { left: 14, right: 14, bottom: 14 },
      styles: { overflow: 'linebreak', cellPadding: 2.6, font: 'helvetica' },
      didParseCell: function (data) {
        if (data.column.index === 6 && data.cell.section === 'body') {
          data.cell.styles.halign = 'right'
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(`Sayfa ${String(data.pageNumber)}`, data.settings.margin.left, doc.internal.pageSize.height - 8)
        doc.text(`Rapor oluşturulma: ${new Date().toLocaleString('tr-TR')}`, doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 8, { align: 'right' })
      },
    })

    doc.save(`Kasa-Raporu.pdf`)
  } catch (err) {
    console.error('PDF oluşturma hatası:', err)
    alert('PDF oluşturulamadı: ' + (err instanceof Error ? err.message : String(err)))
  }
}

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')

    type S = Record<string, any>
    const sc = (v: any, t: string, s: S = {}) => ({ v, t, s })
    const border = (color = 'e2e8f0') => ({
      top: { style: 'thin', color: { rgb: color } },
      bottom: { style: 'thin', color: { rgb: color } },
      left: { style: 'thin', color: { rgb: color } },
      right: { style: 'thin', color: { rgb: color } },
    })

    const mainHeader = (v: string): S => sc(v, 's', { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '166534' } }, alignment: { horizontal: 'center', vertical: 'center' } })
    const subHeader = (v: string): S => sc(v, 's', { font: { sz: 10, color: { rgb: 'dcfce7' } }, fill: { fgColor: { rgb: '14532d' } }, alignment: { horizontal: 'center', vertical: 'center' } })
    const colHead = (v: string, align: string = 'left'): S => sc(v, 's', { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '374151' } }, alignment: { horizontal: align, vertical: 'center' }, border: border('475569') })
    const textCell = (v: string, align: 'left' | 'center' | 'right' = 'left'): S => sc(v, 's', { font: { sz: 10 }, alignment: { horizontal: align, vertical: 'center', wrapText: true }, border: border() })
    const moneyCell = (v: number, type: 'gelir' | 'gider'): S => sc(v, 'n', { font: { sz: 10, color: { rgb: type === 'gelir' ? '15803d' : 'be123c' } }, numFmt: '#,##0.00" TL"', alignment: { horizontal: 'right', vertical: 'center' }, border: border() })
    const totalMoneyCell = (v: number): S => sc(v, 'n', { font: { sz: 11, bold: true, color: { rgb: v >= 0 ? '15803d' : 'be123c' } }, fill: { fgColor: { rgb: 'f0fdf4' } }, numFmt: '#,##0.00" TL"', alignment: { horizontal: 'right', vertical: 'center' }, border: border('bbf7d0') })
    const totalLabel = (v: string): S => sc(v, 's', { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: 'f0fdf4' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: border('bbf7d0') })
    const empty = (bg?: string): S => sc('', 's', bg ? { fill: { fgColor: { rgb: bg } } } : {})

    const header = ['Tarih', 'Tür', 'Kategori', 'Açıklama', 'Ödeme Şekli', 'Cari', 'Tutar']
    const dataRows = filtered.map((item) => {
      return [
        textCell(format(new Date(item.tarih + 'T00:00:00'), 'dd.MM.yyyy'), 'center'),
        textCell(item.tur === 'gelir' ? 'Gelir' : 'Gider', 'center'),
        textCell(item.kategori || '-'),
        textCell(item.aciklama),
        textCell(ODEME_SEKLI_LABEL[item.odeme_sekli as OdemeSekli] || item.odeme_sekli || '-', 'center'),
        textCell('-'),
        moneyCell(Number(item.tutar || 0), item.tur as 'gelir' | 'gider'),
      ]
    })

    const aoa = [
      [mainHeader('KASA HAREKETLERİ RAPORU'), ...Array(header.length - 1).fill(empty('166534'))],
      [subHeader(`${firma.ad} | Tüm Kayıtlar`), ...Array(header.length - 1).fill(empty('14532d'))],
      [],
      [colHead('Toplam Gelir'), totalMoneyCell(stats.gelir), colHead('Toplam Gider'), totalMoneyCell(stats.gider), colHead('Net Bakiye'), totalMoneyCell(stats.bakiye), empty()],
      [],
      header.map((h, i) => colHead(h, [0, 1, 4].includes(i) ? 'center' : i === 6 ? 'right' : 'left')),
      ...dataRows,
      [
        ...Array(header.length - 2).fill(empty('f0fdf4')),
        totalLabel('Genel Bakiye'),
        totalMoneyCell(stats.bakiye),
      ],
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 25 }, { wch: 18 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
    ]
    ws['!autofilter'] = { ref: `A6:${String.fromCharCode(65 + header.length - 1)}${6 + dataRows.length}` }
    ws['!freeze'] = { xSplit: 0, ySplit: 6 }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'KasaHareketleri')
    XLSX.writeFile(wb, `Kasa-Raporu.xlsx`)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={`${error}. Gerekirse kasa_fix.sql dosyasını Supabase üzerinde çalıştırın.`} onRetry={load} />

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-slate-50">
              <Wallet size={18} className="text-blue-500" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-800">Kasa</h1>
              <p className="text-[13px] text-slate-500">Nakit, banka ve avans hareketlerini yönetin.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportPDF} className="border border-blue-100 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl px-3 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105">
              <Download size={14} /> PDF
            </button>
            <button onClick={exportExcel} className="border border-blue-100 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl px-3 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={() => setModal({ ...EMPTY_FORM })} className="bg-blue-600 hover:bg-blue-500 text-slate-800 rounded-xl px-4 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20">
              <Plus size={14} /> Hareket Ekle
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Toplam Gelir" value={stats.gelir} tone="emerald" />
        <SummaryCard label="Toplam Gider" value={stats.gider} tone="rose" />
        <SummaryCard label="Net Bakiye" value={stats.bakiye} tone={stats.bakiye >= 0 ? 'emerald' : 'rose'} />
      </div>

      {/* List */}
      {Object.keys(groupedByMonth).length === 0 ? (
        <div className="rounded-2xl border border-blue-100 bg-white/80 p-14 text-center text-sm font-medium text-slate-500">Henüz kayıt bulunmuyor.</div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(groupedByMonth).map(([monthStr, days]) => {
            const monthStyle = getMonthStyle(monthStr);
            const monthName = getMonthName(monthStr);
            const monthTotal = Object.values(days).flat().reduce((sum, h) => h.tur === 'gelir' ? sum + Number(h.tutar || 0) : sum - Number(h.tutar || 0), 0);

            return (
              <div key={monthStr} className={`rounded-[32px] p-4 sm:p-6 shadow-2xl bg-gradient-to-br ${monthStyle} border`}>
                <div className="flex items-center justify-between mb-6 border-b border-black/10 pb-4">
                  <h2 className="text-2xl sm:text-3xl font-extrabold drop-shadow-sm capitalize">{monthName}</h2>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm font-semibold opacity-70">Aylık Net Bilanço</p>
                    <p className={`text-xl sm:text-2xl font-bold drop-shadow-sm ${monthTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {monthTotal >= 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(monthTotal)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {Object.entries(days).map(([dateStr, hareketler]) => {
                    const dailyNet = hareketler.reduce((sum, h) => h.tur === 'gelir' ? sum + Number(h.tutar || 0) : sum - Number(h.tutar || 0), 0)
                    const bgGradient = getDateStyle(dateStr)
                    const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

                    return (
                      <div key={dateStr} className={`h-[400px] rounded-[24px] bg-gradient-to-br ${bgGradient} border border-slate-200 p-4 sm:p-5 shadow-xl flex flex-col overflow-hidden relative group`}>
                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4 border-b border-slate-200 pb-3 shrink-0">
                            <div>
                              <h3 className="text-[16px] font-bold drop-shadow-md capitalize">{formattedDate}</h3>
                              <p className="text-[11px] font-medium opacity-80 mt-0.5">{hareketler.length} işlem</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-[15px] font-bold drop-shadow-md ${dailyNet >= 0 ? 'text-emerald-100' : 'text-rose-200'}`}>
                                {dailyNet >= 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(dailyNet)}
                              </p>
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto custom-scroll pr-1 pb-2">
                            {hareketler.map((h) => {
                              const isGelir = h.tur === 'gelir'
                              return (
                                <div
                                  key={h.id}
                                  className="group/item bg-white border border-blue-100 rounded-xl p-3 flex flex-col transition-all hover:bg-slate-50 shrink-0 relative cursor-pointer"
                                  onClick={() => setModal(h)}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${isGelir ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {isGelir ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                                      </div>
                                      <div className="flex flex-col items-start gap-0.5">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isGelir ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                          {isGelir ? 'GELİR' : 'GİDER'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-[14px] font-bold ${isGelir ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {isGelir ? '+' : '-'}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(h.tutar || 0))}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="mb-2">
                                    <h3 className="text-[13px] font-semibold text-slate-800 line-clamp-1 mb-0.5" title={h.aciklama}>{h.aciklama}</h3>
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-100 px-2 py-1.5 rounded-[8px]">
                                    <span className="font-medium flex items-center gap-1">
                                      <OdemeIcon sekil={h.odeme_sekli as OdemeSekli} size={10} className="text-slate-400" />
                                      {ODEME_SEKLI_LABEL[h.odeme_sekli as OdemeSekli]}
                                    </span>
                                    <span className="font-medium truncate max-w-[100px] text-right text-slate-500">
                                      {h.kategori || 'Kategori Yok'}
                                    </span>
                                  </div>

                                  <div className="hidden group-hover/item:flex items-center gap-1.5 mt-2 pt-2 border-t border-blue-100 transition-all">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setModal(h); }}
                                      className="flex-1 h-7 rounded-[8px] bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1"
                                    >
                                      <Pencil size={12} /> Düzenle
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDeleteId(h.id); }}
                                      className="w-7 h-7 rounded-[8px] bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-600 hover:text-slate-800 transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-md h-full bg-white border-l border-blue-100 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-blue-100 shrink-0 bg-slate-100">
              <h3 className="text-[18px] font-bold text-slate-800 tracking-wide drop-shadow-md">
                {modal.id ? 'Hareketi Düzenle' : 'Yeni Hareket Ekle'}
              </h3>
              <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            {/* Drawer Body (Scrollable Form) */}
            <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-5">
              {!modal.id && firmalar.length > 1 && (
                <Field label="Firma">
                  <select className={cls.input} value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                    {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Açıklama" required>
                <input className={cls.input} value={modal.aciklama || ''} onChange={(e) => setModal((prev) => ({ ...prev!, aciklama: e.target.value }))} autoFocus />
              </Field>
              
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tarih" required>
                  <input type="date" className={cls.input} value={modal.tarih || ''} onChange={(e) => setModal((prev) => ({ ...prev!, tarih: e.target.value }))} />
                </Field>
                <Field label="Tutar" required>
                  <input type="number" step="0.01" className={cls.input} value={modal.tutar || ''} onChange={(e) => setModal((prev) => ({ ...prev!, tutar: Number(e.target.value || 0) }))} />
                </Field>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Field label="İşlem Türü">
                  <select className={cls.input} value={modal.tur || 'gider'} onChange={(e) => setModal((prev) => ({ ...prev!, tur: e.target.value as 'gelir' | 'gider' }))}>
                    <option value="gider">Gider</option>
                    <option value="gelir">Gelir</option>
                  </select>
                </Field>
                <Field label="Ödeme Şekli">
                  <select className={cls.input} value={modal.odeme_sekli || 'nakit'} onChange={(e) => setModal((prev) => ({ ...prev!, odeme_sekli: e.target.value as OdemeSekli }))}>
                    {Object.entries(ODEME_SEKLI_LABEL).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                  </select>
                </Field>
              </div>
              
              <Field label="Kategori">
                <input className={cls.input} value={modal.kategori || ''} onChange={(e) => setModal((prev) => ({ ...prev!, kategori: e.target.value }))} placeholder="Örn: Maaş, Vergi, Tedarikçi..." />
              </Field>
              
            </div>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-blue-100 bg-white shrink-0 flex items-center justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105">
                İptal
              </button>
              <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <ConfirmModal title="Hareketi Sil" message="Bu kasa hareketini silmek istediğinizden emin misiniz?" danger onConfirm={deleteHareket} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'rose' }) {
  const tones = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-600',
  }
  return (
    <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 text-[22px] font-semibold tabular-nums ${tones[tone]}`}>
        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value)}
      </p>
    </div>
  )
}
