'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, Search, FileSpreadsheet, Upload, X, Loader2, CheckCircle2, AlertCircle, Landmark, ChevronLeft } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

interface Banka {
  id: string; firma_id: string; sirket: string; banka_adi: string;
  sube: string | null; hesap_no: string | null; iban: string | null; para_birimi: string | null; notlar: string | null;
}

interface BankaHareket {
  id: string; banka_id: string; hareket_turu: string; tutar: number;
  tarih: string; belge_no: string | null; aciklama: string | null;
}

interface Props { firma: FirmaRecord; role?: string | null }

const HAREKET_TURLERI = [
  { id: 'giris', label: 'Giriş (Yatan)', renk: 'emerald' },
  { id: 'cikis', label: 'Çıkış (Çekilen)', renk: 'rose' },
]

function parseMissingColumn(message?: string) {
  const match = (message || '').match(/'([^']+)' column of/i)
  return match?.[1] || null
}

function money(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
}

export default function BankalarModule({ firma, role }: Props) {
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)
  const [hesaplar, setHesaplar] = useState<Banka[]>([])
  const [hareketler, setHareketler] = useState<BankaHareket[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showListMobile, setShowListMobile] = useState(true)

  // Modal State
  const [bankaModal, setBankaModal] = useState(false)
  const [editingBanka, setEditingBanka] = useState<Banka | null>(null)
  const [bForm, setBForm] = useState({ banka_adi: '', sube: '', hesap_no: '', iban: '', para_birimi: 'TRY', notlar: '' })

  const [hareketModal, setHareketModal] = useState(false)
  const [editingHareket, setEditingHareket] = useState<BankaHareket | null>(null)
  const [hForm, setHForm] = useState({ hareket_turu: 'giris', tutar: '', tarih: new Date().toISOString().split('T')[0], belge_no: '', aciklama: '' })

  const fetchHesaplar = useCallback(async () => {
    if (!sirket) return;
    setLoading(true)
    let query = supabase.from('bankalar').select('*').eq('firma_id', firma.id).order('banka_adi')
    if (sirket === 'ETM') query = query.or('sirket.eq.ETM,sirket.is.null')
    else query = query.eq('sirket', sirket)
    
    const { data, error } = await query
    if (error) { setError(error.message); setLoading(false); return }
    setHesaplar((data as Banka[]) || [])
    setLoading(false)
  }, [firma.id, sirket])

  const fetchHareketler = useCallback(async (bankaId: string) => {
    const { data, error } = await supabase.from('banka_hareketleri').select('*').eq('banka_id', bankaId).order('tarih', { ascending: false })
    if (error) { 
      if (error.message.includes('banka_hareketleri')) setError('Veritabanında "banka_hareketleri" tablosu bulunamadı. Lütfen SQL ile oluşturun.');
      return; 
    }
    setHareketler((data as BankaHareket[]) || [])
  }, [])

  useEffect(() => { fetchHesaplar() }, [fetchHesaplar])
  useEffect(() => { if (selectedId) fetchHareketler(selectedId); else setHareketler([]) }, [selectedId, fetchHareketler])

  async function saveBanka() {
    if (!bForm.banka_adi.trim()) { setError('Banka adı zorunludur.'); return }
    const payload: any = { firma_id: firma.id, sirket, banka_adi: bForm.banka_adi.trim(), sube: bForm.sube || null, hesap_no: bForm.hesap_no || null, iban: bForm.iban || null, para_birimi: bForm.para_birimi || 'TRY', notlar: bForm.notlar || null }
    
    let working = { ...payload }
    let res;
    while (true) {
      res = editingBanka ? await supabase.from('bankalar').update(working).eq('id', editingBanka.id) : await supabase.from('bankalar').insert(working)
      if (!res.error) break
      const col = parseMissingColumn(res.error.message)
      if (!col || !(col in working) || Object.keys(working).length <= 2) break
      delete working[col]
    }
    if (res.error) { setError(res.error.message); return }
    setBankaModal(false); fetchHesaplar()
  }

  async function deleteBanka(id: string) {
    if (!confirm('Bu banka hesabını silmek istediğinize emin misiniz?')) return
    await supabase.from('bankalar').delete().eq('id', id)
    if (selectedId === id) setSelectedId(null)
    fetchHesaplar()
  }

  async function saveHareket() {
    if (!selectedId) return
    if (!hForm.tutar || !hForm.tarih) { setError('Tarih ve tutar zorunludur.'); return }
    
    const payload: any = { firma_id: firma.id, banka_id: selectedId, hareket_turu: hForm.hareket_turu, tutar: Number(hForm.tutar), tarih: hForm.tarih, belge_no: hForm.belge_no || null, aciklama: hForm.aciklama || null }
    
    let working = { ...payload }
    let res;
    while (true) {
      res = editingHareket ? await supabase.from('banka_hareketleri').update(working).eq('id', editingHareket.id) : await supabase.from('banka_hareketleri').insert(working)
      if (!res.error) break
      const col = parseMissingColumn(res.error.message)
      if (!col || !(col in working) || Object.keys(working).length <= 3) break
      delete working[col]
    }
    if (res.error) { setError(res.error.message); return }
    setHareketModal(false); fetchHareketler(selectedId)
  }

  async function deleteHareket(id: string) {
    if (!confirm('Hareketi silmek istiyor musunuz?')) return
    await supabase.from('banka_hareketleri').delete().eq('id', id)
    if (selectedId) fetchHareketler(selectedId)
  }

  // ── Excel İçe Aktar (Ekstre) ────────────────────────────────────────────────
  const [excelModal, setExcelModal] = useState(false)
  const [excelStep, setExcelStep] = useState<'upload'|'preview'|'done'>('upload')
  const [excelRows, setExcelRows] = useState<any[]>([])
  const [excelLoading, setExcelLoading] = useState(false)
  const [excelHata, setExcelHata] = useState('')
  const [excelSonuc, setExcelSonuc] = useState({ eklenen: 0, atlanan: 0 })
  const [excelCariId, setExcelCariId] = useState('')
  const [cariHesaplar, setCariHesaplar] = useState<{ id: string; ad: string }[]>([])

  const fetchCariHesaplar = useCallback(async () => {
    const q = sirket === 'ETM'
      ? supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id).or('sirket.eq.ETM,sirket.is.null')
      : supabase.from('cari_hesaplar').select('*').eq('firma_id', firma.id).eq('sirket', sirket)
    const { data } = await q
    const list = ((data || []) as any[]).map(c => ({
      id: c.id,
      ad: (Object.entries(c).find(([k]) => k.toLowerCase() === 'reklam')?.[1] as string) || c.ad || c.id,
    }))
    setCariHesaplar(list)
  }, [firma.id, sirket])

  function sablonIndir() {
    const baslikStil = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'medium', color: { rgb: 'FFFFFF' } } } }
    const aciklamaStil = { font: { italic: true, sz: 9, color: { rgb: '64748B' } }, fill: { fgColor: { rgb: 'EFF6FF' } }, alignment: { horizontal: 'center' } }
    const ornek1Stil = { font: { sz: 10, color: { rgb: '1E293B' } }, fill: { fgColor: { rgb: 'F8FAFC' } } }
    const ornek2Stil = { font: { sz: 10, color: { rgb: '1E293B' } }, fill: { fgColor: { rgb: 'EFF6FF' } } }

    const ws: XLSX.WorkSheet = {}

    // Başlık satırı
    const kolonlar = ['Tarih', 'Açıklama', 'Belge No', 'Giriş', 'Çıkış']
    kolonlar.forEach((k, i) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: i })
      ws[addr] = { v: k, t: 's', s: baslikStil }
    })

    // Açıklama satırı
    const aciklamalar = ['GG.AA.YYYY', 'İşlem açıklaması', 'Dekont/Belge no (opsiyonel)', 'Gelen tutar (₺)', 'Giden tutar (₺)']
    aciklamalar.forEach((a, i) => {
      const addr = XLSX.utils.encode_cell({ r: 1, c: i })
      ws[addr] = { v: a, t: 's', s: aciklamaStil }
    })

    // Örnek satırlar
    const ornekler = [
      ['15.03.2025', 'Müşteri ödemesi - ABC Ltd.', 'DK2025001', 50000, ''],
      ['16.03.2025', 'Kira ödemesi - Mart 2025', 'DK2025002', '', 12500],
      ['17.03.2025', 'Fatura tahsilatı - DEF A.Ş.', 'DK2025003', 28750, ''],
      ['18.03.2025', 'SGK prim ödemesi', 'DK2025004', '', 8300],
    ]
    ornekler.forEach((row, ri) => {
      row.forEach((val, ci) => {
        const addr = XLSX.utils.encode_cell({ r: ri + 2, c: ci })
        const isNum = typeof val === 'number'
        ws[addr] = { v: val, t: isNum ? 'n' : 's', s: ri % 2 === 0 ? ornek1Stil : ornek2Stil }
        if (isNum) ws[addr].z = '#,##0.00'
      })
    })

    ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 16 }]
    ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }]
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ornekler.length + 1, c: kolonlar.length - 1 } })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Banka Ekstresi')
    XLSX.writeFile(wb, 'Banka_Ekstre_Sablonu.xlsx')
  }

  function excelDosyaOku(file: File) {
    setExcelHata('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        let headerIdx = 0
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const r = json[i].map(c => String(c).toLowerCase())
          if (r.some(c => c.includes('tarih') || c.includes('açıklama') || c.includes('tutar') || c.includes('giriş') || c.includes('çıkış') || c.includes('borç'))) {
            headerIdx = i; break
          }
        }

        const headers = json[headerIdx].map(h => String(h).toLowerCase().replace(/[^a-zçğıöşü]/g,''))
        const colTarih = headers.findIndex(h => h.includes('tarih'))
        const colAciklama = headers.findIndex(h => h.includes('açıklama') || h.includes('aciklama'))
        const colBelge = headers.findIndex(h => h.includes('belge') || h.includes('dekont'))
        const colGiris = headers.findIndex(h => h.includes('giriş') || h.includes('giris') || h.includes('alacak'))
        const colCikis = headers.findIndex(h => h.includes('çıkış') || h.includes('cikis') || h.includes('borç') || h.includes('borc'))
        const colTutar = headers.findIndex(h => h === 'tutar')

        const satirlar: any[] = []
        for (let i = headerIdx + 1; i < json.length; i++) {
          const row = json[i]
          if (row.every((c:any) => String(c).trim() === '')) continue

          let tarih = ''
          if (colTarih >= 0 && row[colTarih]) {
            const tVal = row[colTarih]
            if (tVal instanceof Date) {
              tarih = `${tVal.getFullYear()}-${String(tVal.getMonth()+1).padStart(2,'0')}-${String(tVal.getDate()).padStart(2,'0')}`
            } else {
              const s = String(tVal).trim()
              if (/^\d{2}[./]\d{2}[./]\d{4}/.test(s)) {
                const parts = s.split(/[./]/)
                tarih = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
              } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                tarih = s.substring(0, 10)
              }
            }
          }

          const parseNum = (v: any) => {
            const s = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
            return parseFloat(s) || 0
          }

          let giris = 0, cikis = 0
          if (colGiris >= 0 && colCikis >= 0) {
            giris = parseNum(row[colGiris])
            cikis = parseNum(row[colCikis])
          } else if (colTutar >= 0) {
            const t = parseNum(row[colTutar])
            if (t > 0) giris = t; else cikis = Math.abs(t);
          }

          if (giris === 0 && cikis === 0) continue
          if (!tarih) continue

          satirlar.push({
            tarih,
            hareket_turu: giris > 0 ? 'giris' : 'cikis',
            tutar: giris > 0 ? giris : cikis,
            aciklama: colAciklama >= 0 ? String(row[colAciklama]).trim() : '',
            belge_no: colBelge >= 0 ? String(row[colBelge]).trim() : ''
          })
        }

        if (satirlar.length === 0) { setExcelHata('Geçerli ekstre satırı bulunamadı.'); return }
        setExcelRows(satirlar)
        setExcelStep('preview')
      } catch (e: any) { setExcelHata('Dosya okunamadı: ' + e.message) }
    }
    reader.readAsArrayBuffer(file)
  }

  async function excelImporta() {
    if (!selectedId || excelRows.length === 0) return
    setExcelLoading(true)
    setExcelHata('')
    let eklenen = 0, atlanan = 0

    // Mükerrer kontrolü
    const { data: extDocs } = await supabase.from('banka_hareketleri')
      .select('belge_no, tarih, tutar').eq('firma_id', firma.id).eq('banka_id', selectedId)
    const existingSet = new Set((extDocs || []).map((d: any) =>
      `${d.tarih}_${d.tutar}_${(d.belge_no||'').trim().toLowerCase()}`))

    const uniqueRows = excelRows.filter(r => {
      const key = `${r.tarih}_${r.tutar}_${(r.belge_no||'').trim().toLowerCase()}`
      if (existingSet.has(key)) { atlanan++; return false }
      return true
    })

    if (uniqueRows.length === 0) {
      setExcelSonuc({ eklenen: 0, atlanan })
      setExcelStep('done')
      setExcelLoading(false)
      return
    }

    const payload = uniqueRows.map(r => ({
      firma_id: firma.id,
      banka_id: selectedId,
      hareket_turu: r.hareket_turu,
      tutar: r.tutar,
      tarih: r.tarih,
      aciklama: r.aciklama || null,
      belge_no: r.belge_no || null,
      ...(excelCariId ? { cari_hesap_id: excelCariId } : {}),
    }))

    // 50'şer batch ile banka_hareketleri'ne ekle
    for (let i = 0; i < payload.length; i += 50) {
      const batch = payload.slice(i, i + 50)
      const { error } = await supabase.from('banka_hareketleri').insert(batch)
      if (error) {
        // cari_hesap_id kolonu yoksa onsuz tekrar dene
        if (error.message.includes('cari_hesap_id')) {
          const batchSiz = batch.map(({ cari_hesap_id: _, ...r }: any) => r)
          const { error: e2 } = await supabase.from('banka_hareketleri').insert(batchSiz)
          if (e2) { atlanan += batch.length } else { eklenen += batch.length }
        } else {
          setExcelHata('Kayıt hatası: ' + error.message)
          setExcelLoading(false)
          return
        }
      } else {
        eklenen += batch.length
      }
    }

    // Cari hesap seçildiyse cari_hareketler'e de işle
    if (excelCariId) {
      const cariPayload = uniqueRows.map(r => ({
        firma_id: firma.id,
        cari_hesap_id: excelCariId,
        hareket_turu: r.hareket_turu === 'giris' ? 'tahsilat_nakit' : 'odeme_nakit',
        tutar: r.tutar,
        tarih: r.tarih,
        belge_no: r.belge_no || null,
        aciklama: r.aciklama || null,
        kdv_tutari: 0,
        stopaj_tutari: 0,
        durum: 'tamamlandi',
      }))
      for (let i = 0; i < cariPayload.length; i += 50) {
        const batch = cariPayload.slice(i, i + 50)
        let res = await supabase.from('cari_hareketler').insert(batch)
        if (res.error) {
          // eksik kolon varsa silerek tekrar dene
          const working = batch.map(r => ({ ...r })) as any[]
          const eksik = res.error.message.match(/'([^']+)' column of/i)?.[1]
          if (eksik) {
            const temiz = working.map(r => { const c = { ...r }; delete c[eksik]; return c })
            await supabase.from('cari_hareketler').insert(temiz)
          }
        }
      }
    }

    setExcelSonuc({ eklenen, atlanan })
    setExcelStep('done')
    setExcelLoading(false)
    fetchHareketler(selectedId)
  }

  // ── Hesaplamalar ──────────────────────────────────────────────────────────
  const filteredHesaplar = useMemo(() => hesaplar.filter(h => h.banka_adi.toLowerCase().includes(arama.toLowerCase())), [hesaplar, arama])
  const selectedBanka = hesaplar.find(h => h.id === selectedId)
  const bakiye = useMemo(() => {
    let giris = 0, cikis = 0
    for (const h of hareketler) {
      if (h.hareket_turu === 'giris') giris += Number(h.tutar)
      else cikis += Number(h.tutar)
    }
    return { giris, cikis, net: giris - cikis }
  }, [hareketler])

  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Banka Hesapları</h2>
          <p className="text-slate-400 text-sm">İşlem yapmak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl px-4">
          <button onClick={() => setSirket('ETM')} className="flex-1 group flex flex-col items-center justify-center py-12 rounded-[32px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">E</div>
             <h3 className="text-xl font-bold text-slate-100">ETM A.Ş.</h3>
             <p className="mt-2 text-xs text-slate-400">Merkez Firma Bankaları</p>
          </button>
          <button onClick={() => setSirket('BİNYAPI')} className="flex-1 group flex flex-col items-center justify-center py-12 rounded-[32px] border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">B</div>
             <h3 className="text-xl font-bold text-slate-100">BİNYAPI</h3>
             <p className="mt-2 text-xs text-slate-400">Binyapı Firma Bankaları</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] md:min-h-[600px]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
      <div className="flex flex-col md:flex-row flex-1 min-h-0 rounded-2xl overflow-hidden" style={{ background: '#0F1419', border: '1px solid rgba(255,255,255,0.07)' }}>
        
        {/* ══ SOL: Banka Listesi ══════════════════════════════════════ */}
        <div className={`${showListMobile ? 'flex' : 'hidden'} md:flex w-full md:w-64 shrink-0 flex-col`} style={{ background: '#111827', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => { setSirket(null); setSelectedId(null) }} className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors mb-4">
              <ChevronLeft size={14} /> Firmalara Dön
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold">{sirket === 'ETM' ? 'E' : 'B'}</div>
              <div>
                <p className="text-[10px] text-slate-500 leading-tight">Seçili Firma</p>
                <p className="text-sm font-bold text-white leading-tight">{sirket === 'ETM' ? 'ETM A.Ş.' : 'BİNYAPI'}</p>
              </div>
            </div>
          </div>

          <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#5F6368' }} />
                <input className="w-full rounded-lg text-[12px] outline-none transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8EAED', paddingLeft: '28px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px' }} placeholder="Banka ara..." value={arama} onChange={e => setArama(e.target.value)} />
              </div>
              {can(role, 'edit') && (
                <button onClick={() => { setEditingBanka(null); setBForm({ banka_adi: '', sube: '', hesap_no: '', iban: '', para_birimi: 'TRY', notlar: '' }); setBankaModal(true) }} className="shrink-0 rounded-lg transition-colors" style={{ background: '#6366F1', color: '#fff', padding: '6px 10px' }}><Plus size={13} /></button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loading ? <div className="flex justify-center py-10"><Loader2 size={15} className="animate-spin" style={{ color: '#5F6368' }} /></div> : filteredHesaplar.length === 0 ? <p className="py-10 text-center text-[11px]" style={{ color: '#5F6368' }}>Hesap bulunamadı</p> : filteredHesaplar.map(b => (
              <div key={b.id} onClick={() => { setSelectedId(b.id); setShowListMobile(false); }} className="group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 mb-0.5" style={b.id === selectedId ? { background: 'rgba(99,102,241,0.1)', borderLeft: '2px solid #818CF8', paddingLeft: '10px' } : { borderLeft: '2px solid transparent' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-snug transition-colors" style={{ color: b.id === selectedId ? '#E8EAED' : '#9AA0A6' }}>{b.banka_adi}</p>
                  {b.iban && <p className="text-[10px] mt-0.5" style={{ color: '#5F6368' }}>{b.iban.substring(0,12)}...</p>}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {can(role, 'edit') && <button onClick={e => { e.stopPropagation(); setEditingBanka(b); setBForm({ banka_adi: b.banka_adi, sube: b.sube||'', hesap_no: b.hesap_no||'', iban: b.iban||'', para_birimi: b.para_birimi||'TRY', notlar: b.notlar||'' }); setBankaModal(true) }} className="rounded p-1 text-slate-500 hover:text-slate-300"><Pencil size={11} /></button>}
                  {can(role, 'delete') && <button onClick={e => { e.stopPropagation(); deleteBanka(b.id) }} className="rounded p-1 text-slate-500 hover:text-red-400"><Trash2 size={11} /></button>}
                </div>
              </div>
            ))}
          </div>

          {can(role, 'edit') && (
            <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: '#5F6368' }}>Veri Aktarımı</p>
              <button onClick={() => { if(!selectedId){ setError('Önce bir banka hesabı seçin.'); return; } setExcelStep('upload'); setExcelCariId(''); fetchCariHesaplar(); setExcelModal(true) }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium transition-all text-left bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
                <FileSpreadsheet size={11} /> Banka Ekstresi Yükle
              </button>
            </div>
          )}
        </div>

        {/* ══ SAĞ: Detay Paneli ═══════════════════════════════════════ */}
        <div className={`${!showListMobile ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`} style={{ background: '#0F1419' }}>
          {!selectedBanka ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/[0.06]"><Landmark size={24} style={{ color: '#2A3544' }} /></div>
              <div className="text-center"><p className="text-sm font-medium text-slate-500">Bir banka hesabı seçin</p><p className="text-xs mt-1 text-slate-600">Hareketleri görüntülemek için soldan hesap seçin</p></div>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 flex items-start justify-between gap-4 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start gap-3">
                  <button onClick={() => setShowListMobile(true)} className="md:hidden mt-0.5 p-1 text-slate-400 hover:text-white bg-white/5 rounded-lg shrink-0">
                    <ChevronLeft size={18} />
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-slate-200">{selectedBanka.banka_adi} {selectedBanka.sube ? `- ${selectedBanka.sube}` : ''}</h2>
                    <p className="text-[11px] text-slate-500 mt-1">{selectedBanka.iban || selectedBanka.hesap_no || 'IBAN belirtilmemiş'} • {selectedBanka.para_birimi}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-stretch rounded-xl overflow-hidden border border-white/[0.07] bg-[#131B27]">
                    <div className="px-4 py-2.5 text-right"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Giriş</p><p className="text-[13px] font-semibold mt-0.5 tabular-nums text-emerald-400">{money(bakiye.giris)}</p></div>
                    <div className="px-4 py-2.5 text-right border-l border-white/[0.06]"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Çıkış</p><p className="text-[13px] font-semibold mt-0.5 tabular-nums text-rose-400">{money(bakiye.cikis)}</p></div>
                    <div className="px-4 py-2.5 text-right border-l border-white/[0.06] bg-indigo-500/10"><p className="text-[9px] font-semibold uppercase tracking-wider text-indigo-400/80">Net Bakiye</p><p className="text-[13px] font-bold mt-0.5 tabular-nums text-indigo-400">{money(bakiye.net)}</p></div>
                  </div>
                  {can(role, 'edit') && (
                    <button onClick={() => { setEditingHareket(null); setHForm({ hareket_turu: 'giris', tutar: '', tarih: new Date().toISOString().split('T')[0], belge_no: '', aciklama: '' }); setHareketModal(true) }} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold transition-colors bg-indigo-600 text-white hover:bg-indigo-500"><Plus size={13} />İşlem Ekle</button>
                  )}
                </div>
              </div>

              {error && <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12px] bg-rose-500/10 border border-rose-500/20 text-rose-400"><AlertCircle size={13} />{error}<button onClick={() => setError('')} className="ml-auto opacity-70 hover:opacity-100"><X size={13} /></button></div>}

              <div className="flex-1 overflow-auto">
                {hareketler.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center"><Landmark size={28} className="text-slate-600 mb-3" /><p className="text-sm font-medium text-slate-500">Henüz hesap hareketi yok</p></div>
                ) : (
                  <table className="w-full min-w-[600px]">
                    <thead className="sticky top-0 z-10 bg-[#0F1419] border-b border-white/[0.07]">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-left w-[100px]">Tarih</th>
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-left w-[120px]">Tür / Belge</th>
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-left auto">Açıklama</th>
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right w-[140px]">Tutar</th>
                        {can(role, 'edit') && <th className="w-[60px]" />}
                      </tr>
                    </thead>
                    <tbody>
                      {hareketler.map((h, i) => {
                        const isGiris = h.hareket_turu === 'giris'
                        return (
                          <tr key={h.id} className="group transition-colors border-b border-white/[0.04] hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-[11px] tabular-nums text-slate-400">{h.tarih}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-${isGiris ? 'emerald' : 'rose'}-500/10 text-${isGiris ? 'emerald' : 'rose'}-400`}>{isGiris ? 'Giriş' : 'Çıkış'}</span>
                              {h.belge_no && <p className="text-[9px] mt-1 text-slate-500">No: {h.belge_no}</p>}
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-300">{h.aciklama || '—'}</td>
                            <td className={`px-4 py-3 text-right text-[12px] font-bold tabular-nums ${isGiris ? 'text-emerald-400' : 'text-rose-400'}`}>{isGiris ? '+' : '-'}{money(h.tutar)}</td>
                            {can(role, 'edit') && (
                              <td className="px-2 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex gap-1 justify-center">
                                  <button onClick={() => { setEditingHareket(h); setHForm({ hareket_turu: h.hareket_turu, tutar: String(h.tutar), tarih: h.tarih, belge_no: h.belge_no||'', aciklama: h.aciklama||'' }); setHareketModal(true) }} className="p-1.5 text-slate-500 hover:text-slate-300"><Pencil size={11} /></button>
                                  <button onClick={() => deleteHareket(h.id)} className="p-1.5 text-slate-500 hover:text-rose-400"><Trash2 size={11} /></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {bankaModal && (
        <Modal title={editingBanka ? 'Banka Düzenle' : 'Yeni Banka Hesabı'} onClose={() => setBankaModal(false)} footer={<><button className={btnSecondary} onClick={() => setBankaModal(false)}>İptal</button><button className={btnPrimary} onClick={saveBanka}>Kaydet</button></>}>
          <div className="space-y-4">
            {error && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Banka Adı" required><input className={inputCls} value={bForm.banka_adi} onChange={e => setBForm({ ...bForm, banka_adi: e.target.value })} placeholder="Örn: Garanti BBVA" /></FormField>
              <FormField label="Şube Adı"><input className={inputCls} value={bForm.sube} onChange={e => setBForm({ ...bForm, sube: e.target.value })} placeholder="Örn: Kadıköy" /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Hesap No"><input className={inputCls} value={bForm.hesap_no} onChange={e => setBForm({ ...bForm, hesap_no: e.target.value })} /></FormField>
              <FormField label="Para Birimi"><select className={inputCls} value={bForm.para_birimi} onChange={e => setBForm({ ...bForm, para_birimi: e.target.value })}><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></FormField>
            </div>
            <FormField label="IBAN Numarası"><input className={inputCls} value={bForm.iban} onChange={e => setBForm({ ...bForm, iban: e.target.value })} placeholder="TR..." /></FormField>
            <FormField label="Notlar"><textarea className={inputCls} rows={2} value={bForm.notlar} onChange={e => setBForm({ ...bForm, notlar: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}

      {hareketModal && (
        <Modal title={editingHareket ? 'Hareket Düzenle' : 'Yeni İşlem'} onClose={() => setHareketModal(false)} footer={<><button className={btnSecondary} onClick={() => setHareketModal(false)}>İptal</button><button className={btnPrimary} onClick={saveHareket}>Kaydet</button></>}>
          <div className="space-y-4">
            {error && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="İşlem Türü" required><select className={inputCls} value={hForm.hareket_turu} onChange={e => setHForm({ ...hForm, hareket_turu: e.target.value })}>{HAREKET_TURLERI.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></FormField>
              <FormField label="Tarih" required><input type="date" className={inputCls} value={hForm.tarih} onChange={e => setHForm({ ...hForm, tarih: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tutar" required><input type="number" step="0.01" className={inputCls} value={hForm.tutar} onChange={e => setHForm({ ...hForm, tutar: e.target.value })} placeholder="0.00" /></FormField>
              <FormField label="Dekont / Belge No"><input className={inputCls} value={hForm.belge_no} onChange={e => setHForm({ ...hForm, belge_no: e.target.value })} /></FormField>
            </div>
            <FormField label="Açıklama"><input className={inputCls} value={hForm.aciklama} onChange={e => setHForm({ ...hForm, aciklama: e.target.value })} placeholder="Kime gönderildi / Kimden geldi?" /></FormField>
          </div>
        </Modal>
      )}

      {excelModal && (
        <Modal title="Banka Ekstresi Yükle (Excel)" onClose={() => setExcelModal(false)} footer={<><button className={btnSecondary} onClick={() => setExcelModal(false)}>İptal</button>{excelStep === 'preview' && <button className={btnPrimary} onClick={excelImporta} disabled={excelLoading}>{excelLoading ? 'Aktarılıyor...' : 'Aktarımı Başlat'}</button>}</>}>
          <div className="space-y-4">
            {excelStep === 'upload' && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-slate-400">Şablonu indirip doldurun, ardından yükleyin. Sistem Tarih, Açıklama ve Giriş/Çıkış tutarlarını otomatik okuyacaktır.</p>
                  <button onClick={sablonIndir} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap">
                    <FileSpreadsheet size={12} /> Şablon İndir
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Cari Hesap (opsiyonel)</label>
                  <select className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none" value={excelCariId} onChange={e => setExcelCariId(e.target.value)}>
                    <option value="">— Cari hesap seçin (opsiyonel) —</option>
                    {cariHesaplar.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.ad}</option>)}
                  </select>
                </div>
                <label className="flex flex-col items-center gap-3 border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 p-8 rounded-2xl cursor-pointer hover:bg-emerald-500/10 transition-colors">
                  <Upload size={32} className="text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">Excel Dosyası Seçin</span>
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) excelDosyaOku(f) }} />
                </label>
                {excelHata && <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl">{excelHata}</p>}
              </div>
            )}
            {excelStep === 'preview' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300"><span className="font-bold text-white">{excelRows.length}</span> satır bulundu. Önceden yüklenmiş aynı tutar ve tarihe sahip satırlar atlanacaktır.</p>
                <div className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-black/20 text-xs">
                  <table className="w-full">
                    <thead><tr className="bg-white/5 text-slate-400"><th className="p-2 text-left">Tarih</th><th className="p-2 text-left">Açıklama</th><th className="p-2 text-right">Tutar</th></tr></thead>
                    <tbody>{excelRows.slice(0,50).map((r,i) => <tr key={i} className="border-t border-white/5"><td className="p-2">{r.tarih}</td><td className="p-2 truncate max-w-[200px]">{r.aciklama}</td><td className={`p-2 text-right font-semibold ${r.hareket_turu==='giris'?'text-emerald-400':'text-rose-400'}`}>{r.hareket_turu==='giris'?'+':'-'}{r.tutar}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
            {excelStep === 'done' && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
                <p className="text-lg font-bold text-white">Aktarım Başarılı</p>
                <p className="text-sm text-slate-400"><span className="text-emerald-400">{excelSonuc.eklenen} eklendi</span> • <span className="text-slate-500">{excelSonuc.atlanan} atlandı (mükerrer)</span></p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}