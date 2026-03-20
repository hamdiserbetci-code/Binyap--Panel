'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, CheckCircle, TrendingUp, ChevronDown, ChevronRight, FileDown, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import * as XLSXStyle from 'xlsx-js-style'
import * as XLSX from 'xlsx'

interface Kayit {
  id: string
  ana_grup: string
  alt_kategori: string
  tarih: string
  tutar: number
  aciklama?: string
  belge_no?: string
  odeme_durumu: string
  odeme_tarihi?: string
}

interface Props { userId: string }

const GRUPLAR: { id: string; label: string; renkBg: string; renkText: string; renkBorder: string; alt: string[] }[] = [
  {
    id: 'mal_hizmet',
    label: 'MAL HİZMET ALIŞLARI',
    renkBg: 'bg-blue-50',
    renkText: 'text-blue-700',
    renkBorder: 'border-blue-200',
    alt: ['NAKLİYE', 'MALZEME', 'BAKIM ONARIM'],
  },
  {
    id: 'personel',
    label: 'PERSONEL GİDERLERİ',
    renkBg: 'bg-emerald-50',
    renkText: 'text-emerald-700',
    renkBorder: 'border-emerald-200',
    alt: ['ÜCRET', 'AVANS', 'SGK', 'MUHTASAR', 'ARABULUCU', 'FERDİ KAZA'],
  },
  {
    id: 'cesitli',
    label: 'ÇEŞİTLİ GİDERLER',
    renkBg: 'bg-violet-50',
    renkText: 'text-violet-700',
    renkBorder: 'border-violet-200',
    alt: ['POLİÇE', 'VERGİ', 'MUHASEBE'],
  },
]

const GRUP_LABEL_TO_ID: Record<string, string> = {
  'MAL HİZMET ALIŞLARI': 'mal_hizmet',
  'PERSONEL GİDERLERİ': 'personel',
  'ÇEŞİTLİ GİDERLER': 'cesitli',
}

const AY_LABELS = ['Tüm Aylar', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default function MalatyaMaliyetPage({ userId }: Props) {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [editing, setEditing] = useState<Kayit | null>(null)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const [selectedAy, setSelectedAy] = useState(0)
  const [acikGruplar, setAcikGruplar] = useState<Record<string, boolean>>({ mal_hizmet: true, personel: true, cesitli: true })
  const [importRows, setImportRows] = useState<any[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importStep, setImportStep] = useState<'mapping' | 'preview'>('mapping')
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<any[]>([])
  const [colMap, setColMap] = useState<Record<string, string>>({
    ana_grup: '', alt_kategori: '', tarih: '', tutar: '',
    belge_no: '', aciklama: '', odeme_durumu: '', odeme_tarihi: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().split('T')[0]
  const yillar = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  const emptyForm = {
    ana_grup: GRUPLAR[0].id,
    alt_kategori: GRUPLAR[0].alt[0],
    tarih: today,
    tutar: '',
    aciklama: '',
    belge_no: '',
    odeme_durumu: 'beklemede',
    odeme_tarihi: '',
  }
  const [form, setForm] = useState<any>(emptyForm)

  const fetchKayitlar = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('malatya_maliyet').select('*').eq('user_id', userId)
    q = q.gte('tarih', `${selectedYil}-01-01`).lte('tarih', `${selectedYil}-12-31`)
    if (selectedAy > 0) {
      const pad = String(selectedAy).padStart(2, '0')
      const lastDay = new Date(selectedYil, selectedAy, 0).getDate()
      q = q.gte('tarih', `${selectedYil}-${pad}-01`).lte('tarih', `${selectedYil}-${pad}-${lastDay}`)
    }
    const { data } = await q.order('tarih', { ascending: false })
    setKayitlar(data || [])
    setLoading(false)
  }, [userId, selectedYil, selectedAy])

  useEffect(() => { fetchKayitlar() }, [fetchKayitlar])

  function toggleGrup(id: string) {
    setAcikGruplar(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function openModal(k?: Kayit, anaGrupId?: string, altKat?: string) {
    setEditing(k || null)
    if (k) {
      setForm({
        ana_grup: k.ana_grup, alt_kategori: k.alt_kategori, tarih: k.tarih,
        tutar: String(k.tutar), aciklama: k.aciklama || '', belge_no: k.belge_no || '',
        odeme_durumu: k.odeme_durumu, odeme_tarihi: k.odeme_tarihi || '',
      })
    } else {
      const grupId = anaGrupId || GRUPLAR[0].id
      const grup = GRUPLAR.find(g => g.id === grupId) || GRUPLAR[0]
      setForm({ ...emptyForm, ana_grup: grupId, alt_kategori: altKat || grup.alt[0] })
    }
    setModal(true)
  }

  function handleAnaGrupChange(grupId: string) {
    const grup = GRUPLAR.find(g => g.id === grupId) || GRUPLAR[0]
    setForm((f: any) => ({ ...f, ana_grup: grupId, alt_kategori: grup.alt[0] }))
  }

  async function handleSave() {
    if (!form.tutar || !form.tarih) return
    const payload = {
      ana_grup: form.ana_grup, alt_kategori: form.alt_kategori,
      tarih: form.tarih, tutar: parseFloat(form.tutar) || 0,
      aciklama: form.aciklama, belge_no: form.belge_no,
      odeme_durumu: form.odeme_durumu, odeme_tarihi: form.odeme_tarihi || null,
      user_id: userId,
    }
    if (editing) await supabase.from('malatya_maliyet').update(payload).eq('id', editing.id)
    else await supabase.from('malatya_maliyet').insert(payload)
    setModal(false)
    fetchKayitlar()
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('malatya_maliyet').delete().eq('id', id)
    fetchKayitlar()
  }

  async function markOdendi(k: Kayit) {
    await supabase.from('malatya_maliyet').update({ odeme_durumu: 'odendi', odeme_tarihi: today }).eq('id', k.id)
    fetchKayitlar()
  }

  // ── Şablon İndir ────────────────────────────────────────────────────────────
  function downloadTemplate() {
    const wb = XLSXStyle.utils.book_new()

    const headerStyle = {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1E40AF' } },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const },
      border: {
        top: { style: 'thin', color: { rgb: 'FFFFFF' } },
        bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
        left: { style: 'thin', color: { rgb: 'FFFFFF' } },
        right: { style: 'thin', color: { rgb: 'FFFFFF' } },
      },
    }
    const baseStyle = {
      font: { name: 'Arial', sz: 9 },
      border: {
        top: { style: 'thin', color: { rgb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
        left: { style: 'thin', color: { rgb: 'E2E8F0' } },
        right: { style: 'thin', color: { rgb: 'E2E8F0' } },
      },
    }
    const noteStyle = { font: { name: 'Arial', sz: 8, color: { rgb: '94A3B8' }, italic: true } }

    const COLS = [
      'Ana Grup', 'Alt Kategori', 'Tarih (YYYY-AA-GG)',
      'Tutar', 'Belge No', 'Açıklama', 'Ödeme Durumu', 'Ödeme Tarihi (YYYY-AA-GG)',
    ]
    const WIDTHS = [28, 18, 20, 14, 14, 30, 16, 22]

    // Örnek satırlar
    const ORNEKLER = [
      ['MAL HİZMET ALIŞLARI', 'NAKLİYE', '2025-03-15', 15000, 'FAT-001', 'Malzeme nakliyesi', 'Ödendi', '2025-03-20'],
      ['MAL HİZMET ALIŞLARI', 'MALZEME', '2025-03-18', 45000, 'FAT-002', 'Demir malzeme alımı', 'Beklemede', ''],
      ['MAL HİZMET ALIŞLARI', 'BAKIM ONARIM', '2025-03-22', 8500, '', 'İş makinesi bakımı', 'Beklemede', ''],
      ['PERSONEL GİDERLERİ', 'ÜCRET', '2025-03-31', 120000, '', 'Mart ayı maaşları', 'Ödendi', '2025-03-31'],
      ['PERSONEL GİDERLERİ', 'SGK', '2025-03-31', 35000, '', 'Mart SGK primi', 'Beklemede', ''],
      ['PERSONEL GİDERLERİ', 'MUHTASAR', '2025-03-26', 18000, '', 'Şubat muhtasar', 'Ödendi', '2025-03-26'],
      ['PERSONEL GİDERLERİ', 'AVANS', '2025-03-10', 5000, '', 'Personel avansı', 'Ödendi', '2025-03-10'],
      ['PERSONEL GİDERLERİ', 'ARABULUCU', '2025-03-05', 3000, '', '', 'Beklemede', ''],
      ['PERSONEL GİDERLERİ', 'FERDİ KAZA', '2025-03-01', 2500, 'POL-001', 'Ferdi kaza sigortası', 'Ödendi', '2025-03-01'],
      ['ÇEŞİTLİ GİDERLER', 'POLİÇE', '2025-03-01', 12000, 'POL-002', 'İnşaat all risk sigortası', 'Ödendi', '2025-03-01'],
      ['ÇEŞİTLİ GİDERLER', 'VERGİ', '2025-03-25', 9500, '', 'Geçici vergi', 'Beklemede', ''],
      ['ÇEŞİTLİ GİDERLER', 'MUHASEBE', '2025-03-01', 4000, '', 'Muhasebe hizmet bedeli', 'Ödendi', '2025-03-05'],
    ]

    const ws: any = {}

    // Açıklama satırı
    ws[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = {
      v: 'Malatya Proje Maliyet — İçe Aktarım Şablonu  |  Sarı satırlar örnektir, silebilirsiniz.',
      t: 's', s: noteStyle,
    }

    // Header
    COLS.forEach((col, c) => {
      ws[XLSXStyle.utils.encode_cell({ r: 1, c })] = { v: col, t: 's', s: headerStyle }
    })

    // Örnek satırlar
    ORNEKLER.forEach((row, r) => {
      row.forEach((val, c) => {
        const isNum = c === 3
        ws[XLSXStyle.utils.encode_cell({ r: r + 2, c })] = {
          v: val, t: isNum ? 'n' : 's',
          s: { ...baseStyle, fill: { fgColor: { rgb: 'FEFCE8' } }, ...(isNum ? { numFmt: '#,##0.00' } : {}) },
        }
      })
    })

    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ORNEKLER.length + 2, c: COLS.length - 1 } })
    ws['!cols'] = WIDTHS.map(w => ({ wch: w }))
    ws['!rows'] = [{ hpt: 14 }, { hpt: 20 }]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS.length - 1 } }]

    // Geçerli değerler sayfası
    const wsRef: any = {}
    const refData = [
      ['ANA GRUP', 'ALT KATEGORİ', '', 'ÖDEME DURUMU'],
      ['MAL HİZMET ALIŞLARI', 'NAKLİYE', '', 'Ödendi'],
      ['PERSONEL GİDERLERİ', 'MALZEME', '', 'Beklemede'],
      ['ÇEŞİTLİ GİDERLER', 'BAKIM ONARIM', '', ''],
      ['', 'ÜCRET', '', ''],
      ['', 'AVANS', '', ''],
      ['', 'SGK', '', ''],
      ['', 'MUHTASAR', '', ''],
      ['', 'ARABULUCU', '', ''],
      ['', 'FERDİ KAZA', '', ''],
      ['', 'POLİÇE', '', ''],
      ['', 'VERGİ', '', ''],
      ['', 'MUHASEBE', '', ''],
    ]
    refData.forEach((row, r) => {
      row.forEach((val, c) => {
        wsRef[XLSXStyle.utils.encode_cell({ r, c })] = {
          v: val, t: 's',
          s: r === 0 ? headerStyle : baseStyle,
        }
      })
    })
    wsRef['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: refData.length - 1, c: 3 } })
    wsRef['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 4 }, { wch: 16 }]

    XLSXStyle.utils.book_append_sheet(wb, ws, 'Veri Girişi')
    XLSXStyle.utils.book_append_sheet(wb, wsRef, 'Geçerli Değerler')
    XLSXStyle.writeFile(wb, 'Malatya_Proje_Maliyet_Sablon.xlsx')
  }

  // ── Excel Okuma ─────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const errors: string[] = []
      const parsed = rows.map((row: any, i: number) => {
        const anaGrupLabel = String(row['Ana Grup'] || '').trim().toUpperCase()
        const altKat = String(row['Alt Kategori'] || '').trim().toUpperCase()
        const tarihRaw = row['Tarih (YYYY-AA-GG)'] || row['Tarih'] || ''
        const tutarRaw = row['Tutar'] || 0
        const odemeDurum = String(row['Ödeme Durumu'] || '').trim()
        const odemeTarihRaw = row['Ödeme Tarihi (YYYY-AA-GG)'] || row['Ödeme Tarihi'] || ''

        const anaGrupId = GRUP_LABEL_TO_ID[anaGrupLabel]
        if (!anaGrupId) errors.push(`Satır ${i + 2}: Geçersiz Ana Grup — "${anaGrupLabel}"`)

        const grup = GRUPLAR.find(g => g.id === anaGrupId)
        if (grup && !grup.alt.includes(altKat)) errors.push(`Satır ${i + 2}: Geçersiz Alt Kategori — "${altKat}"`)

        // Tarih parse
        let tarih = ''
        if (tarihRaw instanceof Date) {
          tarih = tarihRaw.toISOString().split('T')[0]
        } else {
          const str = String(tarihRaw).trim()
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) tarih = str
          else if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
            const [d, m, y] = str.split('.')
            tarih = `${y}-${m}-${d}`
          } else if (str) errors.push(`Satır ${i + 2}: Geçersiz tarih formatı — "${str}" (YYYY-AA-GG olmalı)`)
        }

        let odemeTarihi = ''
        if (odemeTarihRaw instanceof Date) {
          odemeTarihi = odemeTarihRaw.toISOString().split('T')[0]
        } else {
          const str = String(odemeTarihRaw).trim()
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) odemeTarihi = str
          else if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
            const [d, m, y] = str.split('.')
            odemeTarihi = `${y}-${m}-${d}`
          }
        }

        const tutar = parseFloat(String(tutarRaw).replace(',', '.')) || 0
        if (!tutar) errors.push(`Satır ${i + 2}: Tutar boş veya geçersiz`)

        const odeme_durumu = odemeDurum === 'Ödendi' ? 'odendi' : 'beklemede'

        return {
          ana_grup: anaGrupId || '',
          alt_kategori: altKat,
          tarih,
          tutar,
          aciklama: String(row['Açıklama'] || '').trim(),
          belge_no: String(row['Belge No'] || '').trim(),
          odeme_durumu,
          odeme_tarihi: odemeTarihi || null,
          user_id: userId,
          _row: i + 2,
        }
      }).filter((r: any) => r.ana_grup && r.tarih && r.tutar)

      setImportErrors(errors)
      setImportRows(parsed)
      setImportModal(true)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function handleImport() {
    if (importRows.length === 0) return
    setImporting(true)
    const payload = importRows.map(({ _row, ...r }) => r)
    const { error } = await supabase.from('malatya_maliyet').insert(payload)
    setImporting(false)
    if (!error) {
      setImportModal(false)
      setImportRows([])
      setImportErrors([])
      fetchKayitlar()
    } else {
      alert('Aktarım sırasında hata oluştu: ' + error.message)
    }
  }

  const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'

  const genelToplam = kayitlar.reduce((s, k) => s + k.tutar, 0)
  const genelOdenen = kayitlar.filter(k => k.odeme_durumu === 'odendi').reduce((s, k) => s + k.tutar, 0)
  const genelBekleyen = kayitlar.filter(k => k.odeme_durumu === 'beklemede').reduce((s, k) => s + k.tutar, 0)

  const altKategoriler = GRUPLAR.find(g => g.id === form.ana_grup)?.alt || []

  return (
    <div>
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Malatya Proje Maliyet</h2>
          <p className="text-xs text-slate-400 mt-0.5">{AY_LABELS[selectedAy]} {selectedYil}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-sm font-medium">
            <FileDown size={14}/> Şablon İndir
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
            <Upload size={14}/> Excel Aktar
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange}/>
          <button onClick={() => openModal()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
            <Plus size={14}/> Kayıt Ekle
          </button>
        </div>
      </div>

      {/* Dönem seçici */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none w-full sm:w-auto">
          {yillar.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {AY_LABELS.map((ay, i) => (
            <button key={i} onClick={() => setSelectedAy(i)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedAy === i ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {ay}
            </button>
          ))}
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Maliyet</p>
          <p className="text-xl font-bold text-slate-800">{fmt(genelToplam)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kayitlar.length} kayıt</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Bekleyen</p>
          <p className="text-xl font-bold text-red-500">{fmt(genelBekleyen)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kayitlar.filter(k => k.odeme_durumu === 'beklemede').length} ödeme</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Ödenen</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(genelOdenen)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{kayitlar.filter(k => k.odeme_durumu === 'odendi').length} ödeme</p>
        </div>
      </div>

      {/* Gruplar */}
      {loading ? (
        <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p>
      ) : (
        <div className="space-y-4">
          {GRUPLAR.map(grup => {
            const grupKayitlar = kayitlar.filter(k => k.ana_grup === grup.id)
            const grupToplam = grupKayitlar.reduce((s, k) => s + k.tutar, 0)
            const acik = acikGruplar[grup.id]

            return (
              <div key={grup.id} className={`rounded-2xl border ${grup.renkBorder} overflow-hidden`}>
                <button
                  onClick={() => toggleGrup(grup.id)}
                  className={`w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 ${grup.renkBg}`}>
                  <div className="flex items-center gap-2">
                    {acik ? <ChevronDown size={15} className={grup.renkText}/> : <ChevronRight size={15} className={grup.renkText}/>}
                    <span className={`text-sm font-bold ${grup.renkText}`}>{grup.label}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium bg-white/60 ${grup.renkText}`}>
                      {grupKayitlar.length} kayıt
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${grup.renkText}`}>{fmt(grupToplam)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); openModal(undefined, grup.id) }}
                      className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-white/70 hover:bg-white font-medium ${grup.renkText} transition-all`}>
                      <Plus size={11}/> Ekle
                    </button>
                  </div>
                </button>

                {acik && (
                  <div className="bg-white divide-y divide-slate-50">
                    {grup.alt.map(alt => {
                      const altKayitlar = grupKayitlar.filter(k => k.alt_kategori === alt)
                      const altToplam = altKayitlar.reduce((s, k) => s + k.tutar, 0)

                      return (
                        <div key={alt}>
                          <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-50/60">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0"/>
                              <span className="text-xs font-semibold text-slate-600">{alt}</span>
                              <span className="text-[10px] text-slate-400">{altKayitlar.length} kayıt</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-slate-700">{fmt(altToplam)}</span>
                              <button
                                onClick={() => openModal(undefined, grup.id, alt)}
                                className="text-[10px] text-slate-400 hover:text-blue-600 px-2 py-0.5 rounded-lg hover:bg-blue-50 transition-all flex items-center gap-0.5">
                                <Plus size={10}/> Ekle
                              </button>
                            </div>
                          </div>

                          {altKayitlar.length === 0 ? (
                            <div className="px-6 py-2 text-[11px] text-slate-300 italic">Kayıt yok</div>
                          ) : (
                            <div className="divide-y divide-slate-50">
                              {altKayitlar.map(k => (
                                <div key={k.id} className="flex flex-col sm:flex-row sm:items-center gap-2.5 px-3 sm:px-4 py-2.5 hover:bg-slate-50/50 transition-all">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs text-slate-500">{k.tarih}</span>
                                      {k.belge_no && <span className="text-[10px] text-slate-400">#{k.belge_no}</span>}
                                      {k.aciklama && <span className="text-[11px] text-slate-600 truncate">{k.aciklama}</span>}
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${k.odeme_durumu === 'odendi' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {k.odeme_durumu === 'odendi' ? '✓ Ödendi' : 'Beklemede'}
                                      </span>
                                      {k.odeme_tarihi && <span className="text-[10px] text-emerald-500">Ödeme: {k.odeme_tarihi}</span>}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-semibold flex-shrink-0 self-end sm:self-auto ${k.odeme_durumu === 'odendi' ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(k.tutar)}</span>
                                  <div className="flex gap-1 flex-shrink-0 self-end sm:self-auto">
                                    {k.odeme_durumu === 'beklemede' && (
                                      <button onClick={() => markOdendi(k)} title="Ödendi işaretle"
                                        className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center text-slate-400 hover:text-emerald-500">
                                        <CheckCircle size={12}/>
                                      </button>
                                    )}
                                    <button onClick={() => openModal(k)}
                                      className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-400">
                                      <Pencil size={12}/>
                                    </button>
                                    <button onClick={() => handleDelete(k.id)}
                                      className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500">
                                      <Trash2 size={12}/>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Kayıt Modal */}
      {modal && (
        <Modal
          title={editing ? 'Kaydı Düzenle' : 'Yeni Kayıt Ekle'}
          onClose={() => setModal(false)}
          footer={
            <>
              <button className={btnSecondary} onClick={() => setModal(false)}>İptal</button>
              <button className={btnPrimary} onClick={handleSave}>Kaydet</button>
            </>
          }>
          <div className="space-y-3">
            <FormField label="Ana Grup" required>
              <select className={inputCls} value={form.ana_grup} onChange={e => handleAnaGrupChange(e.target.value)}>
                {GRUPLAR.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </FormField>
            <FormField label="Alt Kategori" required>
              <select className={inputCls} value={form.alt_kategori} onChange={e => setForm({ ...form, alt_kategori: e.target.value })}>
                {altKategoriler.map(alt => <option key={alt} value={alt}>{alt}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tarih" required>
                <input type="date" className={inputCls} value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })}/>
              </FormField>
              <FormField label="Tutar (₺)" required>
                <input type="number" className={inputCls} value={form.tutar} onChange={e => setForm({ ...form, tutar: e.target.value })} placeholder="0.00"/>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Belge No">
                <input className={inputCls} value={form.belge_no} onChange={e => setForm({ ...form, belge_no: e.target.value })} placeholder="Fatura / makbuz no"/>
              </FormField>
              <FormField label="Ödeme Durumu">
                <select className={inputCls} value={form.odeme_durumu} onChange={e => setForm({ ...form, odeme_durumu: e.target.value })}>
                  <option value="beklemede">Beklemede</option>
                  <option value="odendi">Ödendi</option>
                </select>
              </FormField>
            </div>
            {form.odeme_durumu === 'odendi' && (
              <FormField label="Ödeme Tarihi">
                <input type="date" className={inputCls} value={form.odeme_tarihi} onChange={e => setForm({ ...form, odeme_tarihi: e.target.value })}/>
              </FormField>
            )}
            <FormField label="Açıklama">
              <input className={inputCls} value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} placeholder="Opsiyonel not"/>
            </FormField>
          </div>
        </Modal>
      )}

      {/* Import Önizleme Modal */}
      {importModal && (
        <Modal
          title={`Excel Aktarım — ${importRows.length} kayıt okundu`}
          onClose={() => { setImportModal(false); setImportRows([]); setImportErrors([]) }}
          footer={
            <>
              <button className={btnSecondary} onClick={() => { setImportModal(false); setImportRows([]); setImportErrors([]) }}>İptal</button>
              <button className={btnPrimary} onClick={handleImport} disabled={importing || importRows.length === 0}>
                {importing ? 'Aktarılıyor...' : `${importRows.length} Kaydı Aktar`}
              </button>
            </>
          }>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {importErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2 text-red-700 text-xs font-semibold mb-1">
                  <AlertCircle size={14}/> {importErrors.length} uyarı (bu satırlar atlanacak)
                </div>
                {importErrors.map((e, i) => (
                  <p key={i} className="text-[11px] text-red-600">{e}</p>
                ))}
              </div>
            )}
            {importRows.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-2 flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 size={14}/> {importRows.length} geçerli kayıt aktarılmaya hazır
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="px-2 py-1.5 text-left font-semibold">Ana Grup</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Alt Kategori</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Tarih</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Tutar</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Durum</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((r, i) => {
                    const grup = GRUPLAR.find(g => g.id === r.ana_grup)
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className={`px-2 py-1.5 font-medium ${grup?.renkText || ''}`}>{grup?.label || r.ana_grup}</td>
                        <td className="px-2 py-1.5 text-slate-600">{r.alt_kategori}</td>
                        <td className="px-2 py-1.5 text-slate-500">{r.tarih}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-red-500">{fmt(r.tutar)}</td>
                        <td className="px-2 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${r.odeme_durumu === 'odendi' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {r.odeme_durumu === 'odendi' ? 'Ödendi' : 'Beklemede'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-slate-400 truncate max-w-[120px]">{r.aciklama}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
