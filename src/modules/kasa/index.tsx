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
  Search,
  Trash2,
  Wallet,
  Wallet2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'
import type { Musteri } from '@/types'
import { ConfirmModal, ErrorMsg, Field, Loading, Modal, cls } from '@/components/ui'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

type KasaHareketi = {
  id: string
  created_at: string
  firma_id: string
  user_id: string
  musteri_id: string | null
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
  musteri_id: null,
}

export default function KasaModule({ firma, profil, navigate }: AppCtx) {
  const [hareketler, setHareketler] = useState<KasaHareketi[]>([])
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<Partial<KasaHareketi> | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date()
    return {
      start: format(startOfMonth(today), 'yyyy-MM-dd'),
      end: format(endOfMonth(today), 'yyyy-MM-dd'),
    }
  })

  useEffect(() => {
    load()
  }, [firma.id])

  async function load() {
    setLoading(true)
    setError('')
    const [hareketRes, musteriRes] = await Promise.all([
      supabase.from('kasa_hareketleri').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('musteriler').select('id, ad, kisa_ad').eq('firma_id', firma.id).eq('aktif', true).order('ad'),
    ])

    if (hareketRes.error) {
      setError(hareketRes.error.message)
      setLoading(false)
      return
    }

    setHareketler((hareketRes.data || []) as KasaHareketi[])
    setMusteriler((musteriRes.data || []) as Musteri[])
    setLoading(false)
  }

  async function save() {
    if (!modal?.aciklama?.trim() || !modal.tarih || !modal.tutar) {
      alert('Açıklama, tutar ve tarih zorunludur.')
      return
    }

    setSaving(true)
    const payload = {
      firma_id: firma.id,
      user_id: profil.id,
      musteri_id: modal.musteri_id || null,
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR')
    return hareketler.filter((item) => {
      if (item.tarih < dateRange.start || item.tarih > dateRange.end) return false
      if (!needle) return true
      const musteri = musteriler.find((x) => x.id === item.musteri_id)
      return [item.aciklama, item.kategori || '', String(item.tutar), musteri?.ad || '', musteri?.kisa_ad || ''].some((value) =>
        value.toLocaleLowerCase('tr-TR').includes(needle)
      )
    })
  }, [hareketler, query, dateRange, musteriler])

  const stats = useMemo(() => {
    const gelir = filtered.filter((h) => h.tur === 'gelir').reduce((sum, h) => sum + Number(h.tutar || 0), 0)
    const gider = filtered.filter((h) => h.tur === 'gider').reduce((sum, h) => sum + Number(h.tutar || 0), 0)
    return { gelir, gider, bakiye: gelir - gider }
  }, [filtered])

  const grouped = useMemo(() => {
    return filtered.reduce((acc, item) => {
      const date = item.tarih
      if (!acc[date]) acc[date] = []
      acc[date].push(item)
      return acc
    }, {} as Record<string, KasaHareketi[]>)
  }, [filtered])

  const setDatePreset = (preset: 'this_month' | 'last_month') => {
    const today = new Date()
    const targetDate = preset === 'last_month' ? subMonths(today, 1) : today
    setDateRange({
      start: format(startOfMonth(targetDate), 'yyyy-MM-dd'),
      end: format(endOfMonth(targetDate), 'yyyy-MM-dd'),
    })
  }

  async function exportPDF() {
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
    doc.text(cleanTr(`KASA RAPORU: ${dateRange.start} - ${dateRange.end}`), 14, 25)

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
        const musteri = musteriler.find((x) => x.id === item.musteri_id)
        return [
          format(new Date(item.tarih + 'T00:00:00'), 'dd.MM.yyyy'),
          item.tur === 'gelir' ? 'Gelir' : 'Gider',
          cleanTr(item.kategori || '-'),
          cleanTr(item.aciklama),
          cleanTr(ODEME_SEKLI_LABEL[item.odeme_sekli as OdemeSekli] || '-'),
          cleanTr(musteri?.kisa_ad || musteri?.ad || '-'),
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

    doc.save(`Kasa-Raporu_${dateRange.start}_${dateRange.end}.pdf`)
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
      const musteri = musteriler.find((x) => x.id === item.musteri_id)
      return [
        textCell(format(new Date(item.tarih + 'T00:00:00'), 'dd.MM.yyyy'), 'center'),
        textCell(item.tur === 'gelir' ? 'Gelir' : 'Gider', 'center'),
        textCell(item.kategori || '-'),
        textCell(item.aciklama),
        textCell(ODEME_SEKLI_LABEL[item.odeme_sekli as OdemeSekli] || item.odeme_sekli || '-', 'center'),
        textCell(musteri?.ad || '-'),
        moneyCell(Number(item.tutar || 0), item.tur as 'gelir' | 'gider'),
      ]
    })

    const aoa = [
      [mainHeader('KASA HAREKETLERİ RAPORU'), ...Array(header.length - 1).fill(empty('166534'))],
      [subHeader(`${firma.ad} | ${dateRange.start} - ${dateRange.end}`), ...Array(header.length - 1).fill(empty('14532d'))],
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
    XLSX.writeFile(wb, `Kasa-Raporu_${dateRange.start}_${dateRange.end}.xlsx`)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMsg message={`${error}. Gerekirse kasa_fix.sql dosyasını Supabase üzerinde çalıştırın.`} onRetry={load} />

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/15 text-green-300">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Kasa</h1>
              <p className="text-sm text-slate-400">Nakit, banka ve avans hareketlerini yönetin.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportPDF} className={cls.btnSecondary}>
              <Download size={15} /> PDF
            </button>
            <button onClick={exportExcel} className={cls.btnSecondary}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button onClick={() => setModal({ ...EMPTY_FORM })} className={cls.btnPrimary}>
              <Plus size={15} /> Hareket Ekle
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Gelir" value={stats.gelir} tone="emerald" />
        <SummaryCard label="Toplam Gider" value={stats.gider} tone="rose" />
        <SummaryCard label="Net Bakiye" value={stats.bakiye} tone={stats.bakiye >= 0 ? 'emerald' : 'rose'} />
      </div>

      {/* Filters and List */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/5 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] xl:grid-cols-[2fr_1fr_1fr_auto]">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Açıklama, kategori, tutar veya cari ara..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-blue-500"
              />
            </div>
            <Field label="Başlangıç Tarihi">
              <input type="date" className={cls.input} value={dateRange.start} onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))} />
            </Field>
            <Field label="Bitiş Tarihi">
              <input type="date" className={cls.input} value={dateRange.end} onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))} />
            </Field>
            <div className="flex items-end gap-2">
              <button onClick={() => setDatePreset('this_month')} className={cls.btnSecondary}>Bu Ay</button>
              <button onClick={() => setDatePreset('last_month')} className={cls.btnSecondary}>Geçen Ay</button>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-4">
          {Object.keys(grouped).length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">Bu tarih aralığında hareket bulunamadı.</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([date, hareketler]) => (
                <div key={date}>
                  <div className="mb-3 px-2">
                    <h3 className="text-sm font-bold text-white">{new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                  </div>
                  <div className="space-y-2">
                    {hareketler.map((h) => {
                      const isGelir = h.tur === 'gelir'
                      const musteri = musteriler.find(m => m.id === h.musteri_id)
                      return (
                        <div key={h.id} className="flex items-center gap-4 rounded-2xl bg-slate-950/40 p-4 transition-colors hover:bg-slate-900">
                          {/* Icon */}
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isGelir ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {isGelir ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
                          </div>

                          {/* Açıklama */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{h.aciklama}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {h.kategori && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                  style={{
                                    background: isGelir ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
                                    color: isGelir ? '#30D158' : '#FF453A',
                                  }}>
                                  {h.kategori}
                                </span>
                              )}
                              <div className="flex items-center gap-1">
                                <OdemeIcon sekil={h.odeme_sekli as OdemeSekli} size={10} className="text-[rgba(235,235,245,0.3)]" />
                                <span className="text-[10px] text-[rgba(235,235,245,0.3)]">
                                  {ODEME_SEKLI_LABEL[h.odeme_sekli as OdemeSekli]}
                                </span>
                              </div>
                              {musteri && (
                                <span className="text-[10px] text-[rgba(235,235,245,0.3)]">
                                  Cari: {musteri.kisa_ad || musteri.ad}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Tutar */}
                          <div className="text-right shrink-0">
                            <p className={`text-base font-bold ${isGelir ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isGelir ? '+' : '-'}
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(h.tutar || 0))}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <button
  onClick={() => setModal(h)}
  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
>
  <Pencil size={14} />
</button>

<button
  onClick={() => setDeleteId(h.id)}
  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-400"
>
  <Trash2 size={14} />
</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={modal.id ? 'Hareketi Düzenle' : 'Yeni Hareket Ekle'}
          onClose={() => setModal(null)}
          size="lg"
          footer={
            <>
              <button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={save} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Açıklama" required>
              <input className={cls.input} value={modal.aciklama || ''} onChange={(e) => setModal((prev) => ({ ...prev!, aciklama: e.target.value }))} />
            </Field>
            <Field label="Tarih" required>
              <input type="date" className={cls.input} value={modal.tarih || ''} onChange={(e) => setModal((prev) => ({ ...prev!, tarih: e.target.value }))} />
            </Field>
            <Field label="Tutar" required>
              <input type="number" step="0.01" className={cls.input} value={modal.tutar || ''} onChange={(e) => setModal((prev) => ({ ...prev!, tutar: Number(e.target.value || 0) }))} />
            </Field>
            <Field label="İşlem Türü">
              <select className={cls.input} value={modal.tur || 'gider'} onChange={(e) => setModal((prev) => ({ ...prev!, tur: e.target.value as 'gelir' | 'gider' }))}>
                <option value="gider">Gider</option>
                <option value="gelir">Gelir</option>
              </select>
            </Field>
            <Field label="Kategori">
              <input className={cls.input} value={modal.kategori || ''} onChange={(e) => setModal((prev) => ({ ...prev!, kategori: e.target.value }))} placeholder="Örn: Maaş, Vergi, Tedarikçi..." />
            </Field>
            <Field label="Ödeme Şekli">
              <select className={cls.input} value={modal.odeme_sekli || 'nakit'} onChange={(e) => setModal((prev) => ({ ...prev!, odeme_sekli: e.target.value as OdemeSekli }))}>
                {Object.entries(ODEME_SEKLI_LABEL).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="İlişkili Müşteri (Opsiyonel)">
                <select className={cls.input} value={modal.musteri_id || ''} onChange={(e) => setModal((prev) => ({ ...prev!, musteri_id: e.target.value || null }))}>
                  <option value="">Müşteri Seç</option>
                  {musteriler.map((item) => <option key={item.id} value={item.id}>{item.ad}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmModal title="Hareketi Sil" message="Bu kasa hareketini silmek istediğinizden emin misiniz?" danger onConfirm={deleteHareket} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'rose' }) {
  const tones = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
  }
  return (
    <div className={`rounded-2xl border px-5 py-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value)}</p>
    </div>
  )
}
