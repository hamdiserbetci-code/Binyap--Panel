'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, Search, RefreshCw, Loader2, CheckCircle2, AlertCircle, Upload, FileSpreadsheet, X, SlidersHorizontal, Eye, EyeOff } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

// ── Tipler ─────────────────────────────────────────────────────────────────

interface CariHesap {
  id: string; firma_id: string; sirket: string; ad: string
  vkn_tckn: string | null; telefon: string | null; adres: string | null; notlar: string | null
}

interface CariHareket {
  id: string; cari_hesap_id: string; hareket_turu: string
  tutar: number; kdv_tutari?: number | null; stopaj_tutari?: number | null; tarih: string; vade_tarihi: string | null
  belge_no: string | null; aciklama: string | null
  cek_no: string | null; cek_banka: string | null; durum: string
  incelendi?: boolean | null
}

interface Props { firma: FirmaRecord; role?: string | null }

interface NfFatura {
  uuid: string; faturaNo: string; tarih: string
  gonderenVkn: string; gonderenUnvan: string
  matrah: number; kdv: number; toplam: number; paraBirimi: string
}

interface LucaSatir {
  tarih: string; belge_no: string | null; aciklama: string | null
  durum: string; borc: number; alacak: number
}

interface EfSatir {
  id: string
  tarih: string; faturaNo: string | null
  vkn: string; unvan: string
  matrah: number; kdv: number; tevkifat: number; toplam: number
}

// ── Sabitler ────────────────────────────────────────────────────────────────

export const HAREKET_TURLERI: { id: string; label: string; renk: string; isCek?: boolean }[] = [
  { id: 'satis_fatura',    label: 'Satış Faturası',    renk: 'emerald' },
  { id: 'alis_fatura',     label: 'Alış Faturası',     renk: 'rose' },
  { id: 'tahsilat_nakit',  label: 'Tahsilat (Nakit)',  renk: 'sky' },
  { id: 'tahsilat_cek',    label: 'Tahsilat (Çek)',    renk: 'sky',   isCek: true },
  { id: 'odeme_nakit',     label: 'Ödeme (Nakit)',     renk: 'amber' },
  { id: 'odeme_cek',       label: 'Ödeme (Çek)',       renk: 'amber', isCek: true },
  { id: 'diger_alacak',    label: 'Diğer Alacak',      renk: 'violet' },
  { id: 'diger_borc',      label: 'Diğer Borç',        renk: 'orange' },
]

const DURUM_OPTS = ['beklemede', 'tamamlandi', 'gecikti', 'karsilıksız']
const AY_LABELS_FULL = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

// Bakiye hesaplama: pozitif = alacaklıyız, negatif = borçluyuz
export function calcBakiye(hareketler: CariHareket[]) {
  let alacak = 0, borc = 0, tahsilat = 0, odeme = 0
  for (const h of hareketler) {
    const t = Number(h.tutar || 0) + Number(h.kdv_tutari || 0) - Number(h.stopaj_tutari || 0)
    if (h.hareket_turu === 'satis_fatura' || h.hareket_turu === 'diger_alacak') alacak += t
    else if (h.hareket_turu === 'alis_fatura' || h.hareket_turu === 'diger_borc') borc += t
    else if (h.hareket_turu === 'tahsilat_nakit' || h.hareket_turu === 'tahsilat_cek') tahsilat += t
    else if (h.hareket_turu === 'odeme_nakit' || h.hareket_turu === 'odeme_cek') odeme += t
  }
  return { alacak, borc, tahsilat, odeme, net: alacak - borc - tahsilat + odeme }
}

// Hata mesajindan eksik sutun adini (Orn: 'tutar') otomatik ayiklayan fonksiyon
function parseMissingColumn(message?: string) {
  const match = (message || '').match(/'([^']+)' column of/i)
  return match?.[1] || null
}

// ── Ana Bileşen ─────────────────────────────────────────────────────────────

export default function CariHesapModule({ firma, role }: Props) {
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI'>('ETM')
  const [hesaplar, setHesaplar] = useState<CariHesap[]>([])
  const [hareketler, setHareketler] = useState<CariHareket[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cari modal
  const [cariModal, setCariModal] = useState(false)
  const [editingCari, setEditingCari] = useState<CariHesap | null>(null)
  const [cariForm, setCariForm] = useState({ ad: '', vkn_tckn: '', telefon: '', adres: '', notlar: '' })

  // VKN sorgulama
  const [vknLoading, setVknLoading] = useState(false)
  const [vknMesaj, setVknMesaj] = useState<{ tur: 'ok' | 'err'; metin: string } | null>(null)

  async function vknSorgula() {
    const vkn = cariForm.vkn_tckn.trim()
    if (!vkn) { setVknMesaj({ tur: 'err', metin: 'Önce VKN/TCKN girin.' }); return }
    setVknLoading(true); setVknMesaj(null)
    try {
      const res = await fetch('/api/vkn-sorgu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vkn }),
      })
      const data = await res.json()
      if (!res.ok) { setVknMesaj({ tur: 'err', metin: data.error || 'Sorgu başarısız.' }); return }
      const updates: Partial<typeof cariForm> = {}
      if (data.unvan) updates.ad = data.unvan
      if (data.adres) updates.adres = data.adres
      setCariForm(f => ({ ...f, ...updates }))
      if (data.kaynakBulunamadi) {
        setVknMesaj({ tur: 'ok', metin: 'VKN geçerli, ancak GİB kaydı bulunamadı. Bilgileri manuel girin.' })
      } else {
        setVknMesaj({ tur: 'ok', metin: `Firma bilgileri otomatik dolduruldu.` })
      }
    } catch {
      setVknMesaj({ tur: 'err', metin: 'Bağlantı hatası. Lütfen tekrar deneyin.' })
    } finally {
      setVknLoading(false)
    }
  }

  // Hareket modal
  const [hareketModal, setHareketModal] = useState(false)
  const [editingHareket, setEditingHareket] = useState<CariHareket | null>(null)
  const [hForm, setHForm] = useState({
    hareket_turu: 'satis_fatura', tutar: '', kdv_tutari: '', stopaj_tutari: '', tarih: new Date().toISOString().split('T')[0],
    vade_tarihi: '', belge_no: '', aciklama: '', cek_no: '', cek_banka: '', durum: 'beklemede',
  })

  // ── NetFatura Entegrasyon ──────────────────────────────────────────────────
  const [nfModal, setNfModal]         = useState(false)
  const [nfStep, setNfStep]           = useState<'ayarlar'|'donem'|'faturalar'|'sonuc'>('ayarlar')
  const [nfLoading, setNfLoading]     = useState(false)
  const [nfHata, setNfHata]           = useState('')
  const [nfAyarlar, setNfAyarlar]     = useState({
    apiUrl: 'https://efatura.isnet.net.tr', username: '', password: ''
  })
  const [nfDonem, setNfDonem]         = useState({
    yil: new Date().getFullYear(), ay: new Date().getMonth() + 1
  })
  const [nfFaturalar, setNfFaturalar] = useState<NfFatura[]>([])
  const [nfEslestir, setNfEslestir]   = useState<Record<string, string>>({})  // uuid → cariId | 'yeni' | 'atla'
  const [nfSonuc, setNfSonuc]         = useState({ eklenen: 0, yeniCari: 0, atlanan: 0 })
  const [nfDebug, setNfDebug]         = useState<any>(null)

  async function nfFaturalariCek() {
    setNfLoading(true); setNfHata('')
    const [y, m] = [nfDonem.yil, nfDonem.ay]
    const startDate = `${y}-${String(m).padStart(2,'0')}-01`
    const lastDay   = new Date(y, m, 0).getDate()
    const endDate   = `${y}-${String(m).padStart(2,'0')}-${lastDay}`
    try {
      const res  = await fetch('/api/netfatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nfAyarlar, startDate, endDate }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNfHata(data.error || 'Fatura çekme başarısız.')
        if (data.debug_denemeler) setNfDebug(data.debug_denemeler)
        else if (data.debug_yanit) setNfDebug([{ url: 'login', yanit: data.debug_yanit }])
        setNfLoading(false); return
      }
      setNfDebug(null)
      const faturalar: NfFatura[] = data.faturalar
      setNfFaturalar(faturalar)
      // Otomatik VKN eşleştir
      const eslestir: Record<string, string> = {}
      for (const f of faturalar) {
        const eslesen = hesaplar.find(h => h.vkn_tckn === f.gonderenVkn)
        eslestir[f.uuid] = eslesen?.id ?? 'yeni'
      }
      setNfEslestir(eslestir)
      setNfStep('faturalar')
    } catch (e: any) {
      setNfHata(e?.message || 'Bağlantı hatası.')
    } finally {
      setNfLoading(false)
    }
  }

  async function nfImporta() {
    setNfLoading(true)
    let eklenen = 0, yeniCari = 0, atlanan = 0
    // Önce yeni cari hesapları oluştur
    const yeniCariMap: Record<string, string> = {}
    for (const f of nfFaturalar) {
      if (nfEslestir[f.uuid] !== 'yeni') continue
      // Bu VKN için daha önce bu aktarımda oluşturulduysa tekrar oluşturma
      if (yeniCariMap[f.gonderenVkn]) continue
      const ins = await supabase.from('cari_hesaplar').insert({
        firma_id: firma.id, sirket,
        ad: f.gonderenUnvan || f.gonderenVkn,
        vkn_tckn: f.gonderenVkn || null,
      }).select('id').single()
      if (!ins.error && ins.data) {
        yeniCariMap[f.gonderenVkn] = ins.data.id
        yeniCari++
      }
    }
    // Hareketleri ekle
    for (const f of nfFaturalar) {
      const secim = nfEslestir[f.uuid]
      if (secim === 'atla') { atlanan++; continue }
      const cariId = secim === 'yeni' ? yeniCariMap[f.gonderenVkn] : secim
      if (!cariId) { atlanan++; continue }
      let payload: any = {
        firma_id: firma.id, cari_hesap_id: cariId,
        hareket_turu: 'alis_fatura',
        tutar: f.matrah,
        kdv_tutari: f.kdv,
        stopaj_tutari: 0,
        tarih: f.tarih,
        vade_tarihi: null,
        belge_no: f.faturaNo || null,
        aciklama: f.gonderenUnvan || null,
        cek_no: null, cek_banka: null,
        durum: 'beklemede',
      }
      let res = await supabase.from('cari_hareketler').insert([payload])
      while (res.error) {
        const eksik = parseMissingColumn(res.error.message)
        if (!eksik || !(eksik in payload) || Object.keys(payload).length <= 4) break
        delete payload[eksik]
        res = await supabase.from('cari_hareketler').insert([payload])
      }
      if (res.error) atlanan++
      else eklenen++
    }
    setNfSonuc({ eklenen, yeniCari, atlanan })
    setNfStep('sonuc')
    setNfLoading(false)
    if (selectedId) fetchHareketler(selectedId)
    fetchHesaplar()
  }

  function nfKapat() {
    setNfModal(false); setNfStep('ayarlar')
    setNfFaturalar([]); setNfHata(''); setNfDebug(null)
    if (selectedId) fetchHareketler(selectedId)
  }

  // ── e-Fatura Excel Import ──────────────────────────────────────────────────
  const [efModal, setEfModal]         = useState(false)
  const [efStep, setEfStep]           = useState<'upload' | 'preview' | 'done'>('upload')
  const [efLoading, setEfLoading]     = useState(false)
  const [efHata, setEfHata]           = useState('')
  const [efRows, setEfRows]           = useState<EfSatir[]>([])
  const [efEslestir, setEfEslestir]   = useState<Record<string, string>>({}) // id → cariId | 'yeni' | 'atla'
  const [efSonuc, setEfSonuc]         = useState({ eklenen: 0, yeniCari: 0, atlanan: 0 })

  function efDosyaOku(file: File) {
    setEfHata('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        // Başlık satırını bul
        let headerIdx = 0
        for (let i = 0; i < Math.min(json.length, 15); i++) {
          const row = json[i].map((c: any) => String(c).toLowerCase())
          if (row.some(c => c.includes('fatura') || c.includes('matrah') || c.includes('tarih') || c.includes('tutar'))) {
            headerIdx = i; break
          }
        }

        const headers: string[] = json[headerIdx].map((h: any) => String(h).trim())

        // Türkçe karakterleri ASCII'ye çevirerek normalize et
        const norm = (s: string) => s.toLowerCase()
          .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
          .replace(/ı/g,'i').replace(/i̇/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
          .replace(/\s+/g,'').replace(/[^a-z0-9%]/g,'')

        const hn = headers.map(norm)  // normalize edilmiş header listesi

        const findCol = (...keywords: string[]) => {
          const idx = hn.findIndex(h => keywords.some(k => h.includes(norm(k))))
          return idx >= 0 ? idx : null
        }

        // Birden fazla eşleşen sütunların indekslerini döndür
        const findCols = (...keywords: string[]) =>
          hn.reduce<number[]>((acc, h, i) => {
            if (keywords.some(k => h.includes(norm(k)))) acc.push(i)
            return acc
          }, [])

        const colFaturaNo  = findCol('faturano','faturanumarasi','belgeno')
        const colTarih     = findCol('tarih','faturatarihi','islemtarihi')
        const colVkn       = findCol('gondericivkn','saticicivkn','satıcıvkn','vkntckn','vkn')
        const colUnvan     = findCol('gondericiunvan','satıcıunvan','saticiadi','firmaadi','unvan','gonderen')

        // Toplam matrah: "toplam matrah" veya "mal/hizmet bedeli" veya "vergisiz tutar" — öncelikli
        const colToplamMatrah = findCol('toplammatrah','malvehizmetbedeli','malhizmetbedeli','vergisiztutar','kdvharictoplam')

        // Bireysel matrah sütunları: "%1 matrahı", "%10 matrahı" vb. — tevkifat matrahı HARİÇ
        const matrahCols = colToplamMatrah !== null ? [] :
          findCols('matrah').filter(i => !hn[i].includes('tevkifat') && !hn[i].includes('odenecek'))

        // Toplam KDV sütunu: "toplam kdv" veya "kdv tutarı"
        const colToplamKdv = findCol('toplamkdv','toplamkdvtutar')

        // Bireysel KDV sütunları: "%1 kdv", "%10 kdv" vb. — tevkifat KDV hariç
        const kdvCols = colToplamKdv !== null ? [] :
          findCols('kdv').filter(i => {
            const h = hn[i]
            return !h.includes('haric') && !h.includes('matrah') && !h.includes('tevkifat') && !h.includes('odenecek')
          })

        // Tevkifat tutarı (5/10, 9/10 vb.)
        const colTevkifat = findCol('tevkifattutar','tevkifat')

        // Ödenecek tutar (toplam - tevkifat)
        const colOdenecek = findCol('odenecektutar','odenecek','geneltoplam','bruttutar','brut')

        const parseNum = (v: any) => {
          if (v === null || v === undefined || v === '') return 0
          const s = String(v).replace(/\s/g,'').replace(/[₺TL$€]/g,'')
            .replace(/\.(?=\d{3}(,|$))/g,'')  // binlik nokta ayracını kaldır
            .replace(',','.')
          return parseFloat(s) || 0
        }

        const parseTarih = (v: any) => {
          if (v instanceof Date) {
            const y = v.getFullYear()
            const m = String(v.getMonth() + 1).padStart(2, '0')
            const d = String(v.getDate()).padStart(2, '0')
            return `${y}-${m}-${d}`
          }
          const s = String(v).trim()
          if (/^\d{2}[./]\d{2}[./]\d{4}/.test(s)) {
            const parts = s.split(/[./]/)
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
          }
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
          const d = new Date(s)
          if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          }
          return s
        }

        const satirlar: EfSatir[] = []
        for (let i = headerIdx + 1; i < json.length; i++) {
          const row = json[i]
          if (row.every((c: any) => String(c).trim() === '')) continue

          const tarih = colTarih !== null ? parseTarih(row[colTarih]) : ''
          if (!tarih) continue

          // Matrah: önce toplam matrah sütunu, yoksa bireysel sütunları topla
          let matrah = 0
          if (colToplamMatrah !== null) {
            matrah = parseNum(row[colToplamMatrah])
          } else if (matrahCols.length > 0) {
            matrah = matrahCols.reduce((sum, ci) => sum + parseNum(row[ci]), 0)
          }

          // KDV: önce toplam KDV sütunu, yoksa bireysel sütunları topla
          let kdv = 0
          if (colToplamKdv !== null) {
            kdv = parseNum(row[colToplamKdv])
          } else if (kdvCols.length > 0) {
            kdv = kdvCols.reduce((sum, ci) => sum + parseNum(row[ci]), 0)
          }

          // Tevkifat
          const tevkifat = colTevkifat !== null ? parseNum(row[colTevkifat]) : 0

          // Ödenecek (toplam KDV dahil, tevkifat düşülmüş)
          const odenecek = colOdenecek !== null ? parseNum(row[colOdenecek]) : matrah + kdv - tevkifat

          if (matrah === 0 && kdv === 0 && odenecek === 0) continue

          const vkn   = colVkn   !== null ? String(row[colVkn]).trim().replace(/\D/g,'')  : ''
          const unvan = colUnvan !== null ? String(row[colUnvan]).trim() : ''

          satirlar.push({
            id: `ef-${i}`,
            tarih,
            faturaNo: colFaturaNo !== null ? String(row[colFaturaNo]).trim() || null : null,
            vkn,
            unvan,
            matrah,
            kdv,
            tevkifat,
            toplam: odenecek,
          })
        }

        if (satirlar.length === 0) {
          const matrahBilgi = colToplamMatrah !== null
            ? `Toplam matrah: "${headers[colToplamMatrah]}"`
            : matrahCols.length > 0
              ? `Matrah sütunları (${matrahCols.length}): ${matrahCols.map(i => headers[i]).join(', ')}`
              : 'Matrah sütunu bulunamadı'
          setEfHata(
            'Geçerli fatura satırı bulunamadı.\n' +
            matrahBilgi + '\n' +
            'Tüm başlıklar: ' + headers.join(' | ')
          )
          return
        }

        // Otomatik VKN eşleştir
        const eslestir: Record<string, string> = {}
        for (const r of satirlar) {
          const eslesen = r.vkn ? hesaplar.find(h => h.vkn_tckn === r.vkn) : undefined
          eslestir[r.id] = eslesen?.id ?? (r.vkn || r.unvan ? 'yeni' : 'atla')
        }
        setEfEslestir(eslestir)
        setEfRows(satirlar)
        setEfStep('preview')
      } catch (err: any) {
        setEfHata('Dosya okunamadı: ' + (err?.message || 'Bilinmeyen hata'))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function efImporta() {
    if (efRows.length === 0) return
    setEfLoading(true)
    let eklenen = 0, yeniCari = 0, atlanan = 0

    // Önce yeni cari hesapları oluştur (aynı VKN için tek seferlik)
    const yeniCariMap: Record<string, string> = {}
    for (const r of efRows) {
      if (efEslestir[r.id] !== 'yeni') continue
      const key = r.vkn || r.unvan
      if (!key || yeniCariMap[key]) continue
      const ins = await supabase.from('cari_hesaplar').insert({
        firma_id: firma.id, sirket,
        ad: r.unvan || r.vkn,
        vkn_tckn: r.vkn || null,
      }).select('id').single()
      if (!ins.error && ins.data) { yeniCariMap[key] = ins.data.id; yeniCari++ }
    }

    // Hangi kolonların DB'de çalıştığını test et (ilk geçerli satırla)
    const ilkGecerli = efRows.find(r => efEslestir[r.id] !== 'atla')
    if (!ilkGecerli) { setEfLoading(false); return }

    const ilkCariId = efEslestir[ilkGecerli.id] === 'yeni'
      ? yeniCariMap[ilkGecerli.vkn || ilkGecerli.unvan]
      : efEslestir[ilkGecerli.id]

    if (!ilkCariId) { atlanan++; }

    const makePayload = (r: EfSatir, cariId: string) => ({
      firma_id: firma.id, cari_hesap_id: cariId,
      hareket_turu: 'alis_fatura',
      tutar: r.matrah, kdv_tutari: r.kdv, stopaj_tutari: r.tevkifat,
      tarih: r.tarih, vade_tarihi: null as null,
      belge_no: r.faturaNo || null,
      aciklama: r.unvan || null,
      cek_no: null as null, cek_banka: null as null,
      durum: 'beklemede',
    })

    // Çalışan kolon setini bul
    let workingKeys: string[] | null = null
    if (ilkCariId) {
      let testPayload: any = makePayload(ilkGecerli, ilkCariId)
      let keys = Object.keys(testPayload)
      let res = await supabase.from('cari_hareketler').insert([testPayload])
      while (res.error) {
        const eksik = parseMissingColumn(res.error.message)
        if (!eksik || !keys.includes(eksik) || keys.length <= 4) break
        keys = keys.filter(k => k !== eksik)
        const temiz: any = {}; keys.forEach(k => { temiz[k] = testPayload[k] })
        res = await supabase.from('cari_hareketler').insert([temiz])
      }
      if (res.error) { atlanan++ } else { eklenen++; workingKeys = keys }
    }

    // Kalan satırları aktar
    for (const r of efRows) {
      if (r.id === ilkGecerli.id) continue
      const secim = efEslestir[r.id]
      if (secim === 'atla') { atlanan++; continue }
      const cariId = secim === 'yeni' ? yeniCariMap[r.vkn || r.unvan] : secim
      if (!cariId) { atlanan++; continue }

      let payload: any = makePayload(r, cariId)
      if (workingKeys) {
        const temiz: any = {}; workingKeys.forEach(k => { temiz[k] = payload[k] })
        payload = temiz
      }
      let res = await supabase.from('cari_hareketler').insert([payload])
      while (res.error && !workingKeys) {
        const eksik = parseMissingColumn(res.error.message)
        if (!eksik || !(eksik in payload) || Object.keys(payload).length <= 4) break
        delete payload[eksik]
        res = await supabase.from('cari_hareketler').insert([payload])
      }
      if (res.error) atlanan++; else eklenen++
    }

    setEfSonuc({ eklenen, yeniCari, atlanan })
    setEfStep('done')
    setEfLoading(false)
    fetchHesaplar()
    if (selectedId) fetchHareketler(selectedId)
  }

  function efKapat() {
    setEfModal(false); setEfStep('upload')
    setEfRows([]); setEfEslestir({}); setEfHata('')
    if (selectedId) fetchHareketler(selectedId)
  }

  // Luca import
  const [lucaModal, setLucaModal] = useState(false)
  const [lucaRows, setLucaRows] = useState<LucaSatir[]>([])
  const [lucaStep, setLucaStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [lucaLoading, setLucaLoading] = useState(false)
  const [lucaHata, setLucaHata] = useState('')
  const [lucaSonuc, setLucaSonuc] = useState({ eklenen: 0, atlanan: 0 })
  const [borcTuru, setBorcTuru] = useState('satis_fatura')
  const [alacakTuru, setAlacakTuru] = useState('alis_fatura')

  function lucaDosyaOku(file: File) {
    setLucaHata('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        // Başlık satırını bul (boş olmayan ilk satır)
        let headerIdx = 0
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const row = json[i].map((c: any) => String(c).toLowerCase())
          if (row.some(c => c.includes('tarih') || c.includes('borç') || c.includes('borc') || c.includes('alacak'))) {
            headerIdx = i; break
          }
        }

        const headers: string[] = json[headerIdx].map((h: any) => String(h).trim())
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-zçğıöşü0-9]/g, '')

        // Sütun eşleştirme
        const findCol = (...keywords: string[]) => {
          const idx = headers.findIndex(h => keywords.some(k => normalize(h).includes(normalize(k))))
          return idx >= 0 ? idx : null
        }

        const colTarih    = findCol('tarih')
        const colBelge    = findCol('evrakno', 'fişno', 'belgeno', 'no')
        const colAciklama = findCol('açıklama', 'aciklama', 'açiklama')
        const colBorc     = findCol('borç', 'borc', 'debit')
        const colAlacak   = findCol('alacak', 'credit')
        const colDurum    = findCol('durum', 'status')

        if (colBorc === null && colAlacak === null) {
          setLucaHata('Borç veya Alacak sütunu bulunamadı. Lütfen Luca\'dan "Cari Hesap Ekstresi" olarak dışa aktarın.'); return
        }
        if (colTarih === null) {
          setLucaHata('Tarih sütunu bulunamadı.'); return
        }

        const satirlar: LucaSatir[] = []
        for (let i = headerIdx + 1; i < json.length; i++) {
          const row = json[i]
          if (row.every((c: any) => String(c).trim() === '')) continue

          const rawTarih = row[colTarih!]
          let tarih = ''
          if (rawTarih instanceof Date) {
            tarih = `${rawTarih.getFullYear()}-${String(rawTarih.getMonth()+1).padStart(2,'0')}-${String(rawTarih.getDate()).padStart(2,'0')}`
          } else {
            const s = String(rawTarih).trim()
            // DD.MM.YYYY veya YYYY-MM-DD
            if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
              const [g, a, y] = s.split('.')
              tarih = `${y}-${a}-${g}`
            } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
              tarih = s.substring(0, 10)
            } else {
              tarih = s
            }
          }

          const parseNum = (v: any) => {
            const s = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
            return parseFloat(s) || 0
          }

          const borc   = colBorc   !== null ? parseNum(row[colBorc])   : 0
          const alacak = colAlacak !== null ? parseNum(row[colAlacak]) : 0

          if (borc === 0 && alacak === 0) continue
          if (!tarih || tarih === '') continue

          satirlar.push({
            tarih,
            belge_no: colBelge   !== null ? String(row[colBelge] ?? '').trim() || null : null,
            aciklama: colAciklama !== null ? String(row[colAciklama] ?? '').trim() || null : null,
            durum:    colDurum   !== null ? String(row[colDurum] ?? '').trim() || 'beklemede' : 'beklemede',
            borc,
            alacak,
          })
        }

        if (satirlar.length === 0) {
          setLucaHata('Geçerli satır bulunamadı. Dosya formatını kontrol edin.'); return
        }

        setLucaRows(satirlar)
        setLucaStep('preview')
      } catch (err: any) {
        setLucaHata('Dosya okunamadı: ' + (err?.message || 'Bilinmeyen hata'))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function lucaImporta() {
    if (!selectedId || lucaRows.length === 0) return
    setLucaLoading(true)
    let eklenen = 0, atlanan = 0

    // Zorunlu kolonları içeren temel payload — isteğe bağlı kolonlar dinamik eklenecek
    const basePayload = lucaRows.map(r => ({
      firma_id: firma.id,
      cari_hesap_id: selectedId,
      hareket_turu: r.borc > 0 ? borcTuru : alacakTuru,
      tutar: r.borc > 0 ? r.borc : r.alacak,
      tarih: r.tarih,
      vade_tarihi: null as null,
      belge_no: r.belge_no || null,
      aciklama: r.aciklama || null,
      cek_no: null as null,
      cek_banka: null as null,
      durum: r.durum || 'beklemede',
      kdv_tutari: 0,
      stopaj_tutari: 0,
    }))

    // Önce tek satırla kolon testi yap — gereksiz kolonları tespit et
    let workingKeys = Object.keys(basePayload[0]) as (keyof typeof basePayload[0])[]
    const testRow = { ...basePayload[0] }
    let kolonTestRes = await supabase.from('cari_hareketler').insert([testRow])
    while (kolonTestRes.error) {
      const eksik = parseMissingColumn(kolonTestRes.error.message)
      if (!eksik || !workingKeys.includes(eksik as any) || workingKeys.length <= 4) break
      workingKeys = workingKeys.filter(k => k !== eksik)
      const temizRow: any = {}
      workingKeys.forEach(k => { temizRow[k] = testRow[k] })
      kolonTestRes = await supabase.from('cari_hareketler').insert([temizRow])
    }

    if (kolonTestRes.error) {
      setLucaHata('Veritabanı hatası: ' + kolonTestRes.error.message)
      setLucaLoading(false)
      return
    }
    eklenen++ // test satırı eklendi

    // Kalan satırları aktif kolonlarla 50'şer batch ekle
    const kalanlar = basePayload.slice(1)
    for (let i = 0; i < kalanlar.length; i += 50) {
      const batch = kalanlar.slice(i, i + 50).map(r => {
        const temiz: any = {}
        workingKeys.forEach(k => { temiz[k] = r[k] })
        return temiz
      })
      const { error } = await supabase.from('cari_hareketler').insert(batch)
      if (error) atlanan += batch.length
      else eklenen += batch.length
    }

    setLucaSonuc({ eklenen, atlanan })
    setLucaStep('done')
    setLucaLoading(false)
    await fetchHareketler(selectedId)
  }

  function lucaKapat() {
    setLucaModal(false)
    setLucaStep('upload')
    setLucaRows([])
    setLucaHata('')
    if (selectedId) fetchHareketler(selectedId)
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchHesaplar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('cari_hesaplar')
      .select('*').eq('firma_id', firma.id).eq('sirket', sirket).order('ad')
    if (error) { setError(error.message); setLoading(false); return }
    setHesaplar((data as CariHesap[]) || [])
    setLoading(false)
  }, [firma.id, sirket])

  const fetchHareketler = useCallback(async (cariId: string) => {
    const { data, error } = await supabase.from('cari_hareketler')
      .select('*').eq('cari_hesap_id', cariId).order('tarih', { ascending: true })
    if (error) { setError(error.message); return }
    setHareketler((data as CariHareket[]) || [])
  }, [])

  useEffect(() => { fetchHesaplar() }, [fetchHesaplar])
  useEffect(() => { if (selectedId) { fetchHareketler(selectedId) } else { setHareketler([]) } }, [selectedId, fetchHareketler])

  // ── Cari CRUD ─────────────────────────────────────────────────────────────

  function openCariModal(c?: CariHesap) {
    setEditingCari(c || null)
    setCariForm(c ? { ad: c.ad, vkn_tckn: c.vkn_tckn || '', telefon: c.telefon || '', adres: c.adres || '', notlar: c.notlar || '' } : { ad: '', vkn_tckn: '', telefon: '', adres: '', notlar: '' })
    setCariModal(true)
    setError('')
  }

  async function saveCari() {
    if (!cariForm.ad.trim()) { setError('Ünvan zorunludur.'); return }
    const payload: any = { firma_id: firma.id, sirket, ad: cariForm.ad.trim(), vkn_tckn: cariForm.vkn_tckn || null, telefon: cariForm.telefon || null, adres: cariForm.adres || null, notlar: cariForm.notlar || null }
    
    let workingPayload = { ...payload }
    let res;
    while (true) {
      res = editingCari ? await supabase.from('cari_hesaplar').update(workingPayload).eq('id', editingCari.id) : await supabase.from('cari_hesaplar').insert(workingPayload)
      if (!res.error) break
      const missingColumn = parseMissingColumn(res.error.message)
      if (!missingColumn || !(missingColumn in workingPayload) || Object.keys(workingPayload).length <= 2) break
      delete workingPayload[missingColumn]
    }

    if (res.error) { setError(res.error.message); return }
    if (Object.keys(workingPayload).length < Object.keys(payload).length) {
      alert('Veritabaninda eksik sutunlar tespit edildi. Kayit mevcut alanlarla eklendi. Lutfen SQL komutlarini calistirin.')
    }
    setCariModal(false); fetchHesaplar()
  }

  async function deleteCari(id: string) {
    if (!confirm('Bu cari hesabı ve tüm hareketleri silinecek. Emin misiniz?')) return
    await supabase.from('cari_hesaplar').delete().eq('id', id)
    if (selectedId === id) setSelectedId(null)
    fetchHesaplar()
  }

  // ── Hareket CRUD ──────────────────────────────────────────────────────────

  function openHareketModal(h?: CariHareket) {
    setEditingHareket(h || null)
    setHForm(h ? {
      hareket_turu: h.hareket_turu, tutar: String(h.tutar), kdv_tutari: h.kdv_tutari != null ? String(h.kdv_tutari) : '', stopaj_tutari: h.stopaj_tutari != null ? String(h.stopaj_tutari) : '',
      tarih: h.tarih, vade_tarihi: h.vade_tarihi || '',
      belge_no: h.belge_no || '', aciklama: h.aciklama || '',
      cek_no: h.cek_no || '', cek_banka: h.cek_banka || '', durum: h.durum,
    } : { hareket_turu: 'satis_fatura', tutar: '', kdv_tutari: '', stopaj_tutari: '', tarih: new Date().toISOString().split('T')[0], vade_tarihi: '', belge_no: '', aciklama: '', cek_no: '', cek_banka: '', durum: 'beklemede' })
    setHareketModal(true)
    setError('')
  }

  async function saveHareket() {
    if (!selectedId) return
    if (!hForm.tutar || !hForm.tarih) { setError('Tutar ve tarih zorunludur.'); return }
    const isCek = HAREKET_TURLERI.find(t => t.id === hForm.hareket_turu)?.isCek
    const payload: any = {
      firma_id: firma.id, cari_hesap_id: selectedId,
      hareket_turu: hForm.hareket_turu, tutar: Number(hForm.tutar),
      kdv_tutari: hForm.kdv_tutari ? Number(hForm.kdv_tutari) : 0,
      stopaj_tutari: hForm.stopaj_tutari ? Number(hForm.stopaj_tutari) : 0,
      tarih: hForm.tarih, vade_tarihi: hForm.vade_tarihi || null,
      belge_no: hForm.belge_no || null, aciklama: hForm.aciklama || null,
      cek_no: isCek ? hForm.cek_no || null : null,
      cek_banka: isCek ? hForm.cek_banka || null : null,
      durum: hForm.durum,
    }

    let workingPayload = { ...payload }
    let res;
    while (true) {
      res = editingHareket ? await supabase.from('cari_hareketler').update(workingPayload).eq('id', editingHareket.id) : await supabase.from('cari_hareketler').insert(workingPayload)
      if (!res.error) break
      const missingColumn = parseMissingColumn(res.error.message)
      if (!missingColumn || !(missingColumn in workingPayload) || Object.keys(workingPayload).length <= 2) break
      delete workingPayload[missingColumn]
    }

    if (res.error) { setError(res.error.message); return }
    if (Object.keys(workingPayload).length < Object.keys(payload).length) {
      alert('Veritabaninda bazi sutunlar eksik oldugu icin kayit eksik alanlarla yapildi. Lutfen SQL guncellemelerini tamamlayin.')
    }
    setHareketModal(false); fetchHareketler(selectedId)
  }

  async function toggleIncelendi(h: CariHareket) {
    const { error } = await supabase.from('cari_hareketler').update({ incelendi: !h.incelendi }).eq('id', h.id)
    if (error) { if (!error.message.includes('incelendi')) setError(error.message); return }
    setHareketler(prev => prev.map(x => x.id === h.id ? { ...x, incelendi: !h.incelendi } : x))
  }

  async function deleteHareket(id: string) {
    if (!confirm('Bu hareketi silmek istediğinize emin misiniz?')) return
    await supabase.from('cari_hareketler').delete().eq('id', id)
    if (selectedId) fetchHareketler(selectedId)
  }

  // ── Hesaplamalar ──────────────────────────────────────────────────────────

  const filteredHesaplar = useMemo(() =>
    hesaplar.filter(h => h.ad.toLowerCase().includes(arama.toLowerCase())),
    [hesaplar, arama])

  const selectedCari = hesaplar.find(h => h.id === selectedId)
  const bakiye = useMemo(() => calcBakiye(hareketler), [hareketler])
  const isCekHareket = HAREKET_TURLERI.find(t => t.id === hForm.hareket_turu)?.isCek

  // ── Filtre Drawer ─────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false)
  const [fTarihBas, setFTarihBas] = useState('')
  const [fTarihBit, setFTarihBit] = useState('')
  const [fTurler, setFTurler] = useState<string[]>([])
  const [fTutarMin, setFTutarMin] = useState('')
  const [fTutarMax, setFTutarMax] = useState('')
  const [fAciklama, setFAciklama] = useState('')
  const [fYon, setFYon] = useState<'all' | 'borc' | 'alacak'>('all')
  const [fInceleme, setFInceleme] = useState<'tumu' | 'incelenmemis' | 'incelendi'>('tumu')

  const BORC_TURLERI = ['alis_fatura', 'diger_borc', 'odeme_nakit', 'odeme_cek']

  // Tüm hareketlerin kümülatif bakiyesini hesapla (filtreden bağımsız)
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>()
    let running = 0
    for (const h of hareketler) {
      const tutar = Number(h.tutar || 0) + Number(h.kdv_tutari || 0) - Number(h.stopaj_tutari || 0)
      running += BORC_TURLERI.includes(h.hareket_turu) ? -tutar : tutar
      map.set(h.id, running)
    }
    return map
  }, [hareketler])

  const filteredHareketler = useMemo(() => {
    let result = hareketler
    if (fTarihBas) result = result.filter(h => h.tarih >= fTarihBas)
    if (fTarihBit) result = result.filter(h => h.tarih <= fTarihBit)
    if (fTurler.length > 0) result = result.filter(h => fTurler.includes(h.hareket_turu))
    if (fAciklama) result = result.filter(h =>
      (h.aciklama || '').toLowerCase().includes(fAciklama.toLowerCase()) ||
      (h.belge_no || '').toLowerCase().includes(fAciklama.toLowerCase())
    )
    if (fTutarMin) result = result.filter(h => (Number(h.tutar || 0) + Number(h.kdv_tutari || 0)) >= Number(fTutarMin))
    if (fTutarMax) result = result.filter(h => (Number(h.tutar || 0) + Number(h.kdv_tutari || 0)) <= Number(fTutarMax))
    if (fYon === 'borc') result = result.filter(h => BORC_TURLERI.includes(h.hareket_turu))
    if (fYon === 'alacak') result = result.filter(h => !BORC_TURLERI.includes(h.hareket_turu))
    if (fInceleme === 'incelendi') result = result.filter(h => h.incelendi)
    if (fInceleme === 'incelenmemis') result = result.filter(h => !h.incelendi)
    return result
  }, [hareketler, fTarihBas, fTarihBit, fTurler, fAciklama, fTutarMin, fTutarMax, fYon, fInceleme])

  const activeFilterCount = [fTarihBas, fTarihBit, fAciklama, fTutarMin, fTutarMax,
    fTurler.length > 0 ? 'x' : '', fYon !== 'all' ? 'x' : '', fInceleme !== 'tumu' ? 'x' : ''].filter(Boolean).length

  function clearFilters() {
    setFTarihBas(''); setFTarihBit(''); setFTurler([])
    setFTutarMin(''); setFTutarMax(''); setFAciklama(''); setFYon('all'); setFInceleme('tumu')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] min-h-[600px]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
      <div className="flex flex-1 min-h-0 rounded-2xl overflow-hidden" style={{ background: '#0F1419', border: '1px solid rgba(255,255,255,0.07)' }}>

        {/* ══ SOL: Hesap Listesi ══════════════════════════════════════ */}
        <div className="w-64 shrink-0 flex flex-col" style={{ background: '#111827', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Şirket toggle */}
          <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: '#5F6368' }}>Şirket</p>
            <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {(['ETM', 'BİNYAPI'] as const).map(s => (
                <button key={s} onClick={() => { setSirket(s); setSelectedId(null) }}
                  className="flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-150"
                  style={sirket === s
                    ? { background: 'rgba(91,159,255,0.15)', color: '#5B9FFF', border: '1px solid rgba(91,159,255,0.25)' }
                    : { color: '#5F6368', border: '1px solid transparent' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Arama + Yeni */}
          <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#5F6368' }} />
                <input
                  className="w-full rounded-lg text-[12px] outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8EAED', paddingLeft: '28px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px' }}
                  placeholder="Hesap ara..."
                  value={arama}
                  onChange={e => setArama(e.target.value)}
                />
              </div>
              {can(role, 'edit') && (
                <button onClick={() => openCariModal()} title="Yeni Cari"
                  className="shrink-0 rounded-lg transition-colors"
                  style={{ background: '#5B9FFF', color: '#fff', padding: '6px 10px' }}>
                  <Plus size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={15} className="animate-spin" style={{ color: '#5F6368' }} /></div>
            ) : filteredHesaplar.length === 0 ? (
              <p className="py-10 text-center text-[11px]" style={{ color: '#5F6368' }}>Hesap bulunamadı</p>
            ) : filteredHesaplar.map(c => {
              const isActive = c.id === selectedId
              return (
                <div key={c.id} onClick={() => setSelectedId(c.id)}
                  className="group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 mb-0.5"
                  style={isActive
                    ? { background: 'rgba(91,159,255,0.1)', borderLeft: '2px solid #5B9FFF', paddingLeft: '10px' }
                    : { borderLeft: '2px solid transparent' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-snug transition-colors" style={{ color: isActive ? '#E8EAED' : '#9AA0A6', wordBreak: 'break-word' }}>{c.ad}</p>
                    {c.vkn_tckn && <p className="text-[10px] mt-0.5" style={{ color: '#5F6368' }}>{c.vkn_tckn}</p>}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {can(role, 'edit') && (
                      <button onClick={e => { e.stopPropagation(); openCariModal(c) }} className="rounded p-1 transition-colors" style={{ color: '#5F6368' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#9AA0A6')} onMouseLeave={e => (e.currentTarget.style.color = '#5F6368')}>
                        <Pencil size={11} />
                      </button>
                    )}
                    {can(role, 'delete') && (
                      <button onClick={e => { e.stopPropagation(); deleteCari(c.id) }} className="rounded p-1 transition-colors" style={{ color: '#5F6368' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#EA4335')} onMouseLeave={e => (e.currentTarget.style.color = '#5F6368')}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Aktarım */}
          {can(role, 'edit') && (
            <div className="p-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: '#5F6368' }}>Veri Aktarımı</p>
              {[
                { label: 'NetFatura API', icon: <Upload size={11} />, color: '#5B9FFF', bg: 'rgba(91,159,255,0.08)', action: () => { setNfModal(true); setNfStep('ayarlar') } },
                { label: 'e-Fatura Excel', icon: <FileSpreadsheet size={11} />, color: '#F9AB00', bg: 'rgba(249,171,0,0.08)', action: () => { setEfModal(true); setEfStep('upload') } },
                { label: 'Luca Excel', icon: <FileSpreadsheet size={11} />, color: selectedId ? '#34A853' : '#5F6368', bg: selectedId ? 'rgba(52,168,83,0.08)' : 'rgba(255,255,255,0.02)', action: () => { if (!selectedId) { setError('Önce bir cari hesap seçin.'); return } setLucaModal(true); setLucaStep('upload') } },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium transition-all text-left"
                  style={{ background: btn.bg, color: btn.color, border: `1px solid ${btn.color}20` }}>
                  {btn.icon}{btn.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ══ SAĞ: Detay Paneli ═══════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: '#0F1419' }}>
          {!selectedCari ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <ChevronRight size={24} style={{ color: '#2A3544' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: '#5F6368' }}>Bir cari hesap seçin</p>
                <p className="text-xs mt-1" style={{ color: '#3C4550' }}>Hareketleri görüntülemek için soldan hesap seçin</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Başlık + Özet ── */}
              <div className="px-6 py-4 flex items-start justify-between gap-4 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <h2 className="text-[15px] font-semibold" style={{ color: '#E8EAED' }}>{selectedCari.ad}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    {selectedCari.vkn_tckn && <span className="text-[11px]" style={{ color: '#5F6368' }}>VKN {selectedCari.vkn_tckn}</span>}
                    <span className="text-[11px]" style={{ color: '#3C4550' }}>{hareketler.length} işlem</span>
                  </div>
                </div>

                {/* Bakiye özeti */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-stretch rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#131B27' }}>
                    {[
                      { label: 'Alacak', value: bakiye.alacak, color: '#34A853' },
                      { label: 'Borç', value: bakiye.borc, color: '#EA4335' },
                      { label: 'Tahsilat', value: bakiye.tahsilat, color: '#5B9FFF' },
                    ].map((item, i) => (
                      <div key={item.label} className="px-4 py-2.5 text-right" style={i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.06)' } : {}}>
                        <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#5F6368' }}>{item.label}</p>
                        <p className="text-[13px] font-semibold mt-0.5 tabular-nums" style={{ color: item.color }}>{money(item.value)}</p>
                      </div>
                    ))}
                    <div className="px-4 py-2.5 text-right" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: bakiye.net >= 0 ? 'rgba(52,168,83,0.08)' : 'rgba(234,67,53,0.08)' }}>
                      <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#5F6368' }}>Net Bakiye</p>
                      <p className="text-[13px] font-bold mt-0.5 tabular-nums" style={{ color: bakiye.net >= 0 ? '#34A853' : '#EA4335' }}>
                        {money(Math.abs(bakiye.net))}
                        <span className="text-[9px] font-normal ml-1 opacity-60">{bakiye.net >= 0 ? 'A' : 'B'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setFilterOpen(v => !v)}
                      className="relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium transition-all"
                      style={filterOpen || activeFilterCount > 0
                        ? { background: 'rgba(91,159,255,0.12)', color: '#5B9FFF', border: '1px solid rgba(91,159,255,0.25)' }
                        : { background: 'rgba(255,255,255,0.04)', color: '#9AA0A6', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <SlidersHorizontal size={13} />Filtre
                      {activeFilterCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: '#5B9FFF', color: '#fff' }}>{activeFilterCount}</span>
                      )}
                    </button>
                    {can(role, 'edit') && (
                      <button onClick={() => openHareketModal()}
                        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-semibold transition-colors"
                        style={{ background: '#5B9FFF', color: '#fff' }}>
                        <Plus size={13} />Hareket Ekle
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12px]" style={{ background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.2)', color: '#EA4335' }}>
                  <AlertCircle size={13} className="shrink-0" />{error}
                  <button onClick={() => setError('')} className="ml-auto opacity-70 hover:opacity-100"><X size={13} /></button>
                </div>
              )}

              {/* ── Tablo + Filtre Drawer ── */}
              <div className="flex flex-1 min-h-0 relative overflow-hidden">

                {/* Tablo */}
                {hareketler.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: '#5F6368' }}>Henüz hareket kaydı yok</p>
                      <p className="text-xs mt-1" style={{ color: '#3C4550' }}>Hareket ekleyin veya Excel ile aktarın</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    {filteredHareketler.length === 0 && activeFilterCount > 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <SlidersHorizontal size={18} style={{ color: '#3C4550' }} />
                        <p className="text-sm" style={{ color: '#5F6368' }}>Filtreyle eşleşen kayıt yok</p>
                        <button onClick={clearFilters} className="text-xs" style={{ color: '#5B9FFF' }}>Filtreleri temizle</button>
                      </div>
                    ) : (
                      <table className="w-full min-w-[680px]">
                        {/* Tablo başlıkları */}
                        <thead className="sticky top-0 z-10" style={{ background: '#0F1419' }}>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            {[
                              { label: 'Tarih', w: '96px', align: 'left' },
                              { label: 'Belge Türü', w: '136px', align: 'left' },
                              { label: 'Belge No', w: '110px', align: 'left' },
                              { label: 'Açıklama', w: 'auto', align: 'left' },
                              { label: 'Borç', w: '120px', align: 'right' },
                              { label: 'Alacak', w: '120px', align: 'right' },
                              { label: 'Kalan Bakiye', w: '130px', align: 'right' },
                              { label: 'İnceleme', w: '80px', align: 'center' },
                            ].map(col => (
                              <th key={col.label} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: '#5F6368', textAlign: col.align as any, width: col.w, minWidth: col.w !== 'auto' ? col.w : undefined }}>
                                {col.label}
                              </th>
                            ))}
                            {can(role, 'edit') && <th style={{ width: '48px' }} />}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHareketler.map((h, idx) => {
                            const tur = HAREKET_TURLERI.find(t => t.id === h.hareket_turu)
                            const tutar = Number(h.tutar || 0) + Number(h.kdv_tutari || 0) - Number(h.stopaj_tutari || 0)
                            const isTevkifatli = Number(h.stopaj_tutari) > 0
                            const isBorc = BORC_TURLERI.includes(h.hareket_turu)
                            const borc = isBorc ? tutar : 0
                            const alacak = isBorc ? 0 : tutar
                            const runBal = balanceMap.get(h.id) ?? 0
                            const balPos = runBal >= 0
                            const isEven = idx % 2 === 0
                            return (
                              <tr key={h.id} className="group transition-colors duration-100"
                                style={{ background: isTevkifatli ? 'rgba(249,171,0,0.03)' : isEven ? 'transparent' : 'rgba(255,255,255,0.012)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = isTevkifatli ? 'rgba(249,171,0,0.07)' : 'rgba(255,255,255,0.03)')}
                                onMouseLeave={e => (e.currentTarget.style.background = isTevkifatli ? 'rgba(249,171,0,0.03)' : isEven ? 'transparent' : 'rgba(255,255,255,0.012)')}>

                                {/* Tarih */}
                                <td className="px-4 py-3 text-[11px] tabular-nums whitespace-nowrap" style={{ color: '#9AA0A6' }}>{h.tarih}</td>

                                {/* Belge Türü */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap bg-${tur?.renk}-500/10 text-${tur?.renk}-400`}>{tur?.label}</span>
                                    {isTevkifatli && <span className="inline-flex rounded px-1 py-0.5 text-[9px] font-bold whitespace-nowrap" style={{ background: 'rgba(249,171,0,0.12)', color: '#F9AB00', border: '1px solid rgba(249,171,0,0.2)' }}>TVK</span>}
                                  </div>
                                </td>

                                {/* Belge No */}
                                <td className="px-4 py-3 text-[11px] whitespace-nowrap" style={{ color: '#9AA0A6' }}>{h.belge_no || <span style={{ color: '#2A3544' }}>—</span>}</td>

                                {/* Açıklama */}
                                <td className="px-4 py-3 text-[11px] max-w-[180px]">
                                  <p className="truncate" style={{ color: '#9AA0A6' }}>{h.aciklama || <span style={{ color: '#2A3544' }}>—</span>}</p>
                                  {isTevkifatli && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(249,171,0,0.6)' }}>Tevkifat: {money(Number(h.stopaj_tutari))}</p>}
                                </td>

                                {/* Borç */}
                                <td className="px-4 py-3 text-right text-[12px] font-semibold tabular-nums whitespace-nowrap" style={{ color: borc > 0 ? '#EA4335' : '#2A3544' }}>
                                  {borc > 0 ? money(borc) : '—'}
                                </td>

                                {/* Alacak */}
                                <td className="px-4 py-3 text-right text-[12px] font-semibold tabular-nums whitespace-nowrap" style={{ color: alacak > 0 ? '#34A853' : '#2A3544' }}>
                                  {alacak > 0 ? money(alacak) : '—'}
                                </td>

                                {/* Kalan Bakiye */}
                                <td className="px-4 py-3 text-right text-[12px] font-bold tabular-nums whitespace-nowrap" style={{ color: balPos ? '#5B9FFF' : '#EA4335' }}>
                                  {money(Math.abs(runBal))}
                                  <span className="text-[9px] font-normal ml-1 opacity-50">{balPos ? 'A' : 'B'}</span>
                                </td>

                                {/* İnceleme */}
                                <td className="px-2 py-3 text-center">
                                  <button
                                    onClick={() => toggleIncelendi(h)}
                                    title={h.incelendi ? 'İncelendi — tekrar işaretle' : 'İncelenmedi — işaretle'}
                                    className="inline-flex items-center justify-center rounded-lg w-7 h-7 transition-all"
                                    style={h.incelendi
                                      ? { background: 'rgba(52,168,83,0.12)', color: '#34A853', border: '1px solid rgba(52,168,83,0.25)' }
                                      : { background: 'transparent', color: '#3C4550', border: '1px solid rgba(255,255,255,0.06)' }}
                                    onMouseEnter={e => { if (!h.incelendi) e.currentTarget.style.color = '#9AA0A6' }}
                                    onMouseLeave={e => { if (!h.incelendi) e.currentTarget.style.color = '#3C4550' }}>
                                    {h.incelendi ? <Eye size={11} /> : <EyeOff size={11} />}
                                  </button>
                                </td>

                                {can(role, 'edit') && (
                                  <td className="px-2 py-3">
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-center">
                                      <button onClick={() => openHareketModal(h)} className="rounded p-1.5 transition-colors" style={{ color: '#5F6368' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#9AA0A6')} onMouseLeave={e => (e.currentTarget.style.color = '#5F6368')}>
                                        <Pencil size={11} />
                                      </button>
                                      {can(role, 'delete') && (
                                        <button onClick={() => deleteHareket(h.id)} className="rounded p-1.5 transition-colors" style={{ color: '#5F6368' }}
                                          onMouseEnter={e => (e.currentTarget.style.color = '#EA4335')} onMouseLeave={e => (e.currentTarget.style.color = '#5F6368')}>
                                          <Trash2 size={11} />
                                        </button>
                                      )}
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
                )}

                {/* ══ Filtre Drawer ══════════════════════════════════════ */}
                {filterOpen && (
                  <div className="absolute inset-y-0 right-0 w-[380px] flex flex-col z-10" style={{ background: '#111827', borderLeft: '1px solid rgba(255,255,255,0.07)', boxShadow: '-8px 0 24px rgba(0,0,0,0.3)' }}>
                    <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div>
                        <h3 className="text-[13px] font-semibold" style={{ color: '#E8EAED' }}>Filtreler</h3>
                        {activeFilterCount > 0 && (
                          <button onClick={clearFilters} className="text-[10px] mt-0.5 transition-colors" style={{ color: '#EA4335' }}>Tümünü temizle</button>
                        )}
                      </div>
                      <button onClick={() => setFilterOpen(false)} className="rounded-lg p-1.5 transition-colors" style={{ color: '#5F6368' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#E8EAED')} onMouseLeave={e => (e.currentTarget.style.color = '#5F6368')}>
                        <X size={15} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                      {/* Tarih */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#5F6368' }}>Tarih Aralığı</p>
                        <div className="flex items-center gap-2">
                          <input type="date" value={fTarihBas} onChange={e => setFTarihBas(e.target.value)}
                            className="flex-1 rounded-lg text-[11px] outline-none"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8EAED', padding: '6px 10px' }} />
                          <span style={{ color: '#5F6368' }}>—</span>
                          <input type="date" value={fTarihBit} onChange={e => setFTarihBit(e.target.value)}
                            className="flex-1 rounded-lg text-[11px] outline-none"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8EAED', padding: '6px 10px' }} />
                        </div>
                      </div>

                      {/* Belge Türü */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#5F6368' }}>Belge Türü</p>
                        <div className="space-y-0.5">
                          {HAREKET_TURLERI.map(t => (
                            <label key={t.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.03]">
                              <input type="checkbox" checked={fTurler.includes(t.id)}
                                onChange={e => setFTurler(prev => e.target.checked ? [...prev, t.id] : prev.filter(x => x !== t.id))}
                                className="rounded w-3.5 h-3.5 accent-blue-500" />
                              <span className={`text-[12px] text-${t.renk}-400`}>{t.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Tutar */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#5F6368' }}>Tutar Aralığı (TL)</p>
                        <div className="flex gap-2">
                          <input type="number" placeholder="Min" value={fTutarMin} onChange={e => setFTutarMin(e.target.value)}
                            className="flex-1 rounded-lg text-[11px] outline-none placeholder:text-[#3C4550]"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8EAED', padding: '6px 10px' }} />
                          <input type="number" placeholder="Max" value={fTutarMax} onChange={e => setFTutarMax(e.target.value)}
                            className="flex-1 rounded-lg text-[11px] outline-none placeholder:text-[#3C4550]"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8EAED', padding: '6px 10px' }} />
                        </div>
                      </div>

                      {/* Açıklama */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#5F6368' }}>Açıklama / Belge No</p>
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#5F6368' }} />
                          <input value={fAciklama} onChange={e => setFAciklama(e.target.value)} placeholder="Metinde ara..."
                            className="w-full rounded-lg text-[11px] outline-none placeholder:text-[#3C4550]"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E8EAED', padding: '6px 10px 6px 28px' }} />
                        </div>
                      </div>

                      {/* İnceleme Durumu */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#5F6368' }}>İnceleme Durumu</p>
                        <div className="flex flex-col gap-1.5">
                          {([
                            { id: 'tumu', label: 'Tümü', color: '#9AA0A6' },
                            { id: 'incelenmemis', label: 'İncelenmemiş', color: '#F9AB00' },
                            { id: 'incelendi', label: 'İncelendi', color: '#34A853' },
                          ] as const).map(opt => (
                            <button key={opt.id} onClick={() => setFInceleme(opt.id)}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all text-left"
                              style={fInceleme === opt.id
                                ? { background: 'rgba(91,159,255,0.1)', border: '1px solid rgba(91,159,255,0.25)', color: '#5B9FFF' }
                                : { background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#5F6368' }}>
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Hızlı */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: '#5F6368' }}>Hızlı Filtreler</p>
                        <div className="flex flex-col gap-1.5">
                          {[
                            { id: 'borc', label: 'Sadece Borç', color: '#EA4335', bg: 'rgba(234,67,53,0.1)', border: 'rgba(234,67,53,0.25)' },
                            { id: 'alacak', label: 'Sadece Alacak', color: '#34A853', bg: 'rgba(52,168,83,0.1)', border: 'rgba(52,168,83,0.25)' },
                          ].map(btn => (
                            <button key={btn.id} onClick={() => setFYon(fYon === btn.id ? 'all' : btn.id as any)}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all text-left"
                              style={fYon === btn.id
                                ? { background: btn.bg, border: `1px solid ${btn.border}`, color: btn.color }
                                : { background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#5F6368' }}>
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: btn.color }} />
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {activeFilterCount > 0 && (
                      <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
                        <p className="text-[11px]" style={{ color: '#5F6368' }}>
                          <span style={{ color: '#5B9FFF', fontWeight: 600 }}>{filteredHareketler.length}</span> / {hareketler.length} kayıt
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* NetFatura Import Modal */}
      {nfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[92vh]">

            {/* Başlık */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <Upload size={18} className="text-blue-400" />
                <div>
                  <h3 className="text-base font-bold text-white">İşnet NetFatura — Alış Faturaları</h3>
                  <div className="flex gap-3 mt-1">
                    {(['ayarlar','donem','faturalar','sonuc'] as const).map((s, i) => (
                      <span key={s} className={`text-[10px] font-semibold uppercase tracking-wider ${nfStep === s ? 'text-blue-400' : 'text-slate-600'}`}>
                        {i+1}. {s === 'ayarlar' ? 'Bağlantı' : s === 'donem' ? 'Dönem' : s === 'faturalar' ? 'Faturalar' : 'Sonuç'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={nfKapat} className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-white/10"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Adım 1: API Ayarları */}
              {nfStep === 'ayarlar' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4 text-xs text-blue-200/70 space-y-1">
                    <p className="font-semibold text-blue-400 text-sm">İşnet NetFatura API Bağlantısı</p>
                    <p>İşnet müşteri panelinizden aldığınız API URL, kullanıcı adı ve şifrenizi girin.</p>
                    <p className="text-slate-500">Kimlik bilgileriniz yalnızca tarayıcınızda tutulur, sunucuya kaydedilmez.</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">API Adresi</label>
                      <input className={inputCls} value={nfAyarlar.apiUrl}
                        onChange={e => setNfAyarlar(a => ({ ...a, apiUrl: e.target.value }))}
                        placeholder="https://efatura.isnet.net.tr" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Kullanıcı Adı</label>
                        <input className={inputCls} value={nfAyarlar.username}
                          onChange={e => setNfAyarlar(a => ({ ...a, username: e.target.value }))}
                          placeholder="kullanici@firma.com" autoComplete="off" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Şifre</label>
                        <input type="password" className={inputCls} value={nfAyarlar.password}
                          onChange={e => setNfAyarlar(a => ({ ...a, password: e.target.value }))}
                          placeholder="••••••••" autoComplete="new-password" />
                      </div>
                    </div>
                  </div>
                  {nfHata && <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-sm text-rose-300"><AlertCircle size={14} className="shrink-0 mt-0.5" />{nfHata}</div>}
                </div>
              )}

              {/* Adım 2: Dönem Seçimi */}
              {nfStep === 'donem' && (
                <div className="space-y-5">
                  <p className="text-sm text-slate-400">Hangi ayın alış faturalarını çekmek istiyorsunuz?</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Yıl</label>
                      <select className={inputCls} value={nfDonem.yil} onChange={e => setNfDonem(d => ({ ...d, yil: Number(e.target.value) }))}>
                        {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Ay</label>
                      <select className={inputCls} value={nfDonem.ay} onChange={e => setNfDonem(d => ({ ...d, ay: Number(e.target.value) }))}>
                        {AY_LABELS_FULL.map((a, i) => <option key={i+1} value={i+1} className="bg-slate-900">{a}</option>)}
                      </select>
                    </div>
                  </div>
                  {nfHata && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-sm text-rose-300">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />{nfHata}
                      </div>
                      {nfDebug && Array.isArray(nfDebug) && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Login Denemeleri ({nfDebug.length} endpoint):</p>
                          {nfDebug.map((d: any, i: number) => (
                            <div key={i} className="rounded-lg bg-slate-800/50 p-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${d.status === 200 ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                  {d.hata ? 'HATA' : `HTTP ${d.status}`}
                                </span>
                                <span className="text-[9px] text-slate-500 truncate">{d.url}</span>
                              </div>
                              <pre className="text-[9px] text-slate-400 overflow-x-auto whitespace-pre-wrap break-all max-h-20">
                                {d.hata ?? JSON.stringify(d.yanit, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Adım 3: Fatura Listesi + Eşleştirme */}
              {nfStep === 'faturalar' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300">
                      <span className="font-bold text-white">{nfFaturalar.length}</span> fatura çekildi.
                      <span className="text-slate-500 ml-2">
                        {Object.values(nfEslestir).filter(v => v !== 'atla' && v !== 'yeni').length} eşleşti •{' '}
                        {Object.values(nfEslestir).filter(v => v === 'yeni').length} yeni cari •{' '}
                        {Object.values(nfEslestir).filter(v => v === 'atla').length} atlanacak
                      </span>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/[0.04] text-slate-400 uppercase tracking-wider text-[10px]">
                          <th className="px-3 py-2.5 text-left">Tarih</th>
                          <th className="px-3 py-2.5 text-left">Fatura No</th>
                          <th className="px-3 py-2.5 text-left">Gönderen</th>
                          <th className="px-3 py-2.5 text-right text-emerald-400">Matrah</th>
                          <th className="px-3 py-2.5 text-right">KDV</th>
                          <th className="px-3 py-2.5 text-left min-w-[160px]">Cari Hesap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nfFaturalar.map(f => {
                          const secim = nfEslestir[f.uuid] || 'yeni'
                          const atla  = secim === 'atla'
                          return (
                            <tr key={f.uuid} className={`border-t border-white/[0.04] ${atla ? 'opacity-40' : 'hover:bg-white/[0.02]'}`}>
                              <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{f.tarih}</td>
                              <td className="px-3 py-2 text-slate-400">{f.faturaNo || '—'}</td>
                              <td className="px-3 py-2">
                                <p className="text-slate-200 font-medium truncate max-w-[140px]">{f.gonderenUnvan || '—'}</p>
                                {f.gonderenVkn && <p className="text-slate-600 text-[10px]">VKN: {f.gonderenVkn}</p>}
                              </td>
                              <td className="px-3 py-2 text-right text-emerald-400 font-semibold whitespace-nowrap">
                                {f.matrah.toLocaleString('tr-TR',{minimumFractionDigits:2})} {f.paraBirimi}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                                {f.kdv.toLocaleString('tr-TR',{minimumFractionDigits:2})}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                                  value={secim}
                                  onChange={e => setNfEslestir(prev => ({ ...prev, [f.uuid]: e.target.value }))}
                                >
                                  <option value="yeni" className="bg-slate-900">+ Yeni Cari Oluştur</option>
                                  <option value="atla" className="bg-slate-900">— Atla</option>
                                  {hesaplar.filter(h => h.sirket === sirket).map(h => (
                                    <option key={h.id} value={h.id} className="bg-slate-900">{h.ad}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Adım 4: Sonuç */}
              {nfStep === 'sonuc' && (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <CheckCircle2 size={48} className="text-blue-400" />
                  <div className="text-center space-y-1">
                    <p className="text-lg font-bold text-white">Aktarım tamamlandı</p>
                    <p className="text-sm text-slate-400">
                      <span className="text-emerald-400 font-semibold">{nfSonuc.eklenen}</span> hareket eklendi
                      {nfSonuc.yeniCari > 0 && <> • <span className="text-blue-400 font-semibold">{nfSonuc.yeniCari}</span> yeni cari oluşturuldu</>}
                      {nfSonuc.atlanan > 0 && <> • <span className="text-rose-400 font-semibold">{nfSonuc.atlanan}</span> atlandı</>}
                    </p>
                  </div>
                  <button onClick={nfKapat} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Kapat</button>
                </div>
              )}
            </div>

            {/* Footer */}
            {nfStep !== 'sonuc' && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
                <button onClick={nfKapat} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10">İptal</button>
                <div className="flex gap-2">
                  {nfStep !== 'ayarlar' && (
                    <button
                      onClick={() => setNfStep(s => s === 'faturalar' ? 'donem' : 'ayarlar')}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                    >Geri</button>
                  )}
                  {nfStep === 'ayarlar' && (
                    <button
                      onClick={() => { setNfHata(''); setNfStep('donem') }}
                      disabled={!nfAyarlar.username || !nfAyarlar.password}
                      className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >Devam →</button>
                  )}
                  {nfStep === 'donem' && (
                    <button
                      onClick={nfFaturalariCek}
                      disabled={nfLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {nfLoading ? <><Loader2 size={14} className="animate-spin"/>Çekiliyor...</> : <>Faturaları Getir →</>}
                    </button>
                  )}
                  {nfStep === 'faturalar' && (
                    <button
                      onClick={nfImporta}
                      disabled={nfLoading || nfFaturalar.every(f => nfEslestir[f.uuid] === 'atla')}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {nfLoading
                        ? <><Loader2 size={14} className="animate-spin"/>Aktarılıyor...</>
                        : <><Upload size={14}/>{nfFaturalar.filter(f => nfEslestir[f.uuid] !== 'atla').length} Faturayı Aktar</>}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Luca Import Modal */}
      {lucaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Başlık */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">Luca Cari Hareketleri İçe Aktar</h3>
              </div>
              <button onClick={lucaKapat} className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-white/10"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Adım: Upload */}
              {lucaStep === 'upload' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200/80 space-y-1">
                    <p className="font-semibold text-emerald-400">Luca'dan nasıl dışa aktarılır?</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs text-slate-400">
                      <li>Luca → Cari Hesaplar → ilgili cariyi seçin</li>
                      <li>Ekstreler / Hesap Hareketleri sekmesine gelin</li>
                      <li>Sağ üstten <strong>Excel'e Aktar</strong> veya <strong>Dışa Aktar</strong> butonuna tıklayın</li>
                      <li>İndirilen .xlsx dosyasını buraya yükleyin</li>
                    </ol>
                  </div>

                  <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-10 cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/[0.03] transition-all">
                    <Upload size={32} className="text-slate-500" />
                    <span className="text-sm text-slate-400">Excel dosyasını buraya sürükleyin veya tıklayın</span>
                    <span className="text-xs text-slate-600">.xlsx, .xls, .csv</span>
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv"
                      onChange={e => { const f = e.target.files?.[0]; if (f) lucaDosyaOku(f) }} />
                  </label>

                  {lucaHata && (
                    <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-300">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      {lucaHata}
                    </div>
                  )}
                </div>
              )}

              {/* Adım: Preview */}
              {lucaStep === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300">
                      <span className="font-bold text-white">{lucaRows.length}</span> satır tespit edildi.
                      <span className="text-slate-500 ml-2">
                        {lucaRows.filter(r => r.borc > 0).length} borç •{' '}
                        {lucaRows.filter(r => r.alacak > 0).length} alacak
                      </span>
                    </p>
                  </div>

                  {/* Hareket türü eşleştirme */}
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 block mb-1.5">Borç satırları → Hareket Türü</label>
                      <select className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none" value={borcTuru} onChange={e => setBorcTuru(e.target.value)}>
                        {HAREKET_TURLERI.filter(t => !t.isCek).map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 block mb-1.5">Alacak satırları → Hareket Türü</label>
                      <select className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none" value={alacakTuru} onChange={e => setAlacakTuru(e.target.value)}>
                        {HAREKET_TURLERI.filter(t => !t.isCek).map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Önizleme tablosu */}
                  <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/[0.04] text-slate-400 uppercase tracking-wider">
                          <th className="px-3 py-2 text-left">Tarih</th>
                          <th className="px-3 py-2 text-left">Belge No</th>
                          <th className="px-3 py-2 text-left max-w-[140px]">Açıklama</th>
                          <th className="px-3 py-2 text-right text-rose-400">Borç</th>
                          <th className="px-3 py-2 text-right text-emerald-400">Alacak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lucaRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                            <td className="px-3 py-1.5 text-slate-300">{r.tarih}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.belge_no || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-400 max-w-[140px] truncate">{r.aciklama || '—'}</td>
                            <td className="px-3 py-1.5 text-right text-rose-400">{r.borc > 0 ? r.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : ''}</td>
                            <td className="px-3 py-1.5 text-right text-emerald-400">{r.alacak > 0 ? r.alacak.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {lucaRows.length > 50 && (
                      <p className="px-3 py-2 text-center text-xs text-slate-600 bg-white/[0.02]">+{lucaRows.length - 50} satır daha (tümü aktarılacak)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Adım: Done */}
              {lucaStep === 'done' && (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <CheckCircle2 size={48} className="text-emerald-400" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">Aktarım tamamlandı</p>
                    <p className="text-sm text-slate-400 mt-1">
                      <span className="text-emerald-400 font-semibold">{lucaSonuc.eklenen}</span> kayıt eklendi
                      {lucaSonuc.atlanan > 0 && <>, <span className="text-rose-400 font-semibold">{lucaSonuc.atlanan}</span> atlandı</>}
                    </p>
                  </div>
                  <button onClick={lucaKapat} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">Kapat</button>
                </div>
              )}
            </div>

            {/* Footer */}
            {lucaStep !== 'done' && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
                <button onClick={lucaKapat} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10">İptal</button>
                {lucaStep === 'preview' && (
                  <button onClick={lucaImporta} disabled={lucaLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {lucaLoading ? <><Loader2 size={15} className="animate-spin" />Aktarılıyor...</> : <><Upload size={15} />{lucaRows.length} Satırı Aktar</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* e-Fatura Excel Import Modal */}
      {efModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">

            {/* Başlık */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-orange-400" />
                <div>
                  <h3 className="text-base font-bold text-white">e-Fatura Excel — Alış Faturaları Aktar</h3>
                  <p className="text-xs text-slate-500 mt-0.5">VKN bazlı otomatik cari eşleştirme</p>
                </div>
              </div>
              <button onClick={efKapat} className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-white/10"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Adım 1: Dosya Yükleme */}
              {efStep === 'upload' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-4 text-xs text-orange-200/70 space-y-1">
                    <p className="font-semibold text-orange-400 text-sm">e-Fatura / NetFatura Excel Aktarımı</p>
                    <p>İşnet veya GİB e-Arşiv portalından indirdiğiniz Excel dosyasını yükleyin.</p>
                    <p className="text-slate-500">Her fatura Gönderici VKN'ye göre mevcut carilerinizle otomatik eşleştirilir. Eşleşemeyen cariler için yeni kayıt oluşturulur.</p>
                  </div>

                  <label
                    className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/20 hover:border-orange-500/50 bg-white/[0.02] hover:bg-orange-500/[0.03] p-10 cursor-pointer transition-all"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) efDosyaOku(f) }}
                  >
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) efDosyaOku(f) }} />
                    <FileSpreadsheet size={36} className="text-orange-400 opacity-60" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-300">Excel dosyasını sürükleyin veya seçin</p>
                      <p className="text-xs text-slate-500 mt-1">.xlsx · .xls · .csv</p>
                    </div>
                  </label>

                  {efHata && (
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-sm text-rose-300 whitespace-pre-wrap">
                      {efHata}
                    </div>
                  )}
                </div>
              )}

              {/* Adım 2: Önizleme */}
              {efStep === 'preview' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    <span className="font-bold text-white">{efRows.length}</span> fatura •{' '}
                    <span className="text-emerald-400">{Object.values(efEslestir).filter(v => v !== 'atla' && v !== 'yeni').length} eşleşti</span> •{' '}
                    <span className="text-blue-400">{Object.values(efEslestir).filter(v => v === 'yeni').length} yeni cari</span> •{' '}
                    <span className="text-slate-500">{Object.values(efEslestir).filter(v => v === 'atla').length} atlanacak</span>
                    {efRows.some(r => r.tevkifat > 0) && <> • <span className="text-violet-400">{efRows.filter(r => r.tevkifat > 0).length} tevkifatlı</span></>}
                  </p>
                  <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/[0.04] text-slate-400 uppercase tracking-wider text-[10px]">
                          <th className="px-3 py-2.5 text-left">Tarih</th>
                          <th className="px-3 py-2.5 text-left">Fatura No</th>
                          <th className="px-3 py-2.5 text-left">Gönderen</th>
                          <th className="px-3 py-2.5 text-right text-emerald-400">Matrah</th>
                          <th className="px-3 py-2.5 text-right">KDV</th>
                          {efRows.some(r => r.tevkifat > 0) && <th className="px-3 py-2.5 text-right text-violet-400">Tevkifat</th>}
                          <th className="px-3 py-2.5 text-left min-w-[150px]">Cari Hesap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {efRows.slice(0, 200).map((r) => {
                          const secim = efEslestir[r.id] || 'yeni'
                          return (
                          <tr key={r.id} className={`border-t border-white/[0.04] ${secim === 'atla' ? 'opacity-40' : 'hover:bg-white/[0.02]'}`}>
                            <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">{r.tarih}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.faturaNo || '—'}</td>
                            <td className="px-3 py-1.5">
                              <p className="text-slate-200 truncate max-w-[120px]">{r.unvan || '—'}</p>
                              {r.vkn && <p className="text-[10px] text-slate-600">VKN: {r.vkn}</p>}
                            </td>
                            <td className="px-3 py-1.5 text-right text-emerald-400 font-semibold whitespace-nowrap">
                              {r.matrah > 0 ? r.matrah.toLocaleString('tr-TR',{minimumFractionDigits:2}) : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-500 whitespace-nowrap">
                              {r.kdv > 0 ? r.kdv.toLocaleString('tr-TR',{minimumFractionDigits:2}) : '—'}
                            </td>
                            {efRows.some(r2 => r2.tevkifat > 0) && (
                              <td className="px-3 py-1.5 text-right text-violet-400 whitespace-nowrap">
                                {r.tevkifat > 0 ? r.tevkifat.toLocaleString('tr-TR',{minimumFractionDigits:2}) : '—'}
                              </td>
                            )}
                            <td className="px-3 py-1.5">
                              <select
                                className="w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                                value={secim}
                                onChange={e => setEfEslestir(prev => ({ ...prev, [r.id]: e.target.value }))}
                              >
                                <option value="yeni" className="bg-slate-900">+ Yeni Cari Oluştur</option>
                                <option value="atla" className="bg-slate-900">— Atla</option>
                                {hesaplar.map(h => (
                                  <option key={h.id} value={h.id} className="bg-slate-900">{h.ad}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {efRows.length > 100 && (
                      <p className="px-3 py-2 text-center text-xs text-slate-600 bg-white/[0.02]">+{efRows.length - 100} satır daha (tümü aktarılacak)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Adım 3: Sonuç */}
              {efStep === 'done' && (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <CheckCircle2 size={48} className="text-orange-400" />
                  <div className="text-center space-y-1">
                    <p className="text-lg font-bold text-white">Aktarım tamamlandı</p>
                    <p className="text-sm text-slate-400">
                      <span className="text-emerald-400 font-semibold">{efSonuc.eklenen}</span> hareket eklendi
                      {efSonuc.yeniCari > 0 && <> • <span className="text-blue-400 font-semibold">{efSonuc.yeniCari}</span> yeni cari oluşturuldu</>}
                      {efSonuc.atlanan > 0 && <> • <span className="text-rose-400 font-semibold">{efSonuc.atlanan}</span> atlandı</>}
                    </p>
                  </div>
                  <button onClick={efKapat} className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-700">Kapat</button>
                </div>
              )}
            </div>

            {/* Footer */}
            {efStep !== 'done' && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
                <button onClick={efKapat} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10">İptal</button>
                {efStep === 'preview' && (
                  <div className="flex gap-2">
                    <button onClick={() => setEfStep('upload')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10">Geri</button>
                    <button
                      onClick={efImporta}
                      disabled={efLoading || efRows.every(r => efEslestir[r.id] === 'atla')}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                    >
                      {efLoading
                        ? <><Loader2 size={14} className="animate-spin"/>Aktarılıyor...</>
                        : <><Upload size={14}/>{efRows.length} Faturayı Aktar</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cari Hesap Modal */}
      {cariModal && (
        <Modal title={editingCari ? 'Cari Düzenle' : 'Yeni Cari Hesap'} onClose={() => { setCariModal(false); setVknMesaj(null) }}
          footer={<><button className={btnSecondary} onClick={() => { setCariModal(false); setVknMesaj(null) }}>İptal</button><button className={btnPrimary} onClick={saveCari}>Kaydet</button></>}>
          <div className="space-y-4">
            {error && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}

            {/* VKN Otomatik Sorgulama */}
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 space-y-3">
              <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Vergi No ile Otomatik Doldur</p>
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  value={cariForm.vkn_tckn}
                  onChange={e => { setCariForm({ ...cariForm, vkn_tckn: e.target.value }); setVknMesaj(null) }}
                  placeholder="10 haneli VKN girin..."
                  maxLength={11}
                />
                <button
                  type="button"
                  onClick={vknSorgula}
                  disabled={vknLoading}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60 transition-colors"
                >
                  {vknLoading
                    ? <><Loader2 size={14} className="animate-spin" />Sorgulanıyor...</>
                    : <><Search size={14} />Sorgula</>}
                </button>
              </div>
              {vknMesaj && (
                <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${vknMesaj.tur === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                  {vknMesaj.tur === 'ok'
                    ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                    : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
                  {vknMesaj.metin}
                </div>
              )}
            </div>

            <FormField label="Ünvan" required><input className={inputCls} value={cariForm.ad} onChange={e => setCariForm({ ...cariForm, ad: e.target.value })} placeholder="Firma veya şahıs adı" /></FormField>
            <FormField label="Telefon"><input className={inputCls} value={cariForm.telefon} onChange={e => setCariForm({ ...cariForm, telefon: e.target.value })} /></FormField>
            <FormField label="Adres"><input className={inputCls} value={cariForm.adres} onChange={e => setCariForm({ ...cariForm, adres: e.target.value })} /></FormField>
            <FormField label="Notlar"><input className={inputCls} value={cariForm.notlar} onChange={e => setCariForm({ ...cariForm, notlar: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}

      {/* Hareket Modal */}
      {hareketModal && (
        <Modal title={editingHareket ? 'Hareketi Düzenle' : 'Yeni Hareket'} onClose={() => setHareketModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setHareketModal(false)}>İptal</button><button className={btnPrimary} onClick={saveHareket}>Kaydet</button></>}>
          <div className="space-y-4">
            {error && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Hareket Türü" required>
                <select className={inputCls} value={hForm.hareket_turu} onChange={e => setHForm({ ...hForm, hareket_turu: e.target.value })}>
                  {HAREKET_TURLERI.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                </select>
              </FormField>
              <FormField label="Tarih" required><input type="date" className={inputCls} value={hForm.tarih} onChange={e => setHForm({ ...hForm, tarih: e.target.value })} /></FormField>
              <FormField label="Vade Tarihi"><input type="date" className={inputCls} value={hForm.vade_tarihi} onChange={e => setHForm({ ...hForm, vade_tarihi: e.target.value })} /></FormField>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Tutar (Net)" required>
                <input type="number" step="0.01" className={inputCls} value={hForm.tutar} onChange={e => setHForm({ ...hForm, tutar: e.target.value })} placeholder="0.00" />
              </FormField>
              <FormField label="KDV Tutarı">
                <div className="flex flex-col gap-2">
                  <input type="number" step="0.01" className={inputCls} value={hForm.kdv_tutari} onChange={e => setHForm({ ...hForm, kdv_tutari: e.target.value })} placeholder="0.00" />
                  <div className="grid grid-cols-3 gap-1">
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.01).toFixed(2) }))} className="text-[10px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded hover:bg-blue-500/20">%1</button>
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.10).toFixed(2) }))} className="text-[10px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded hover:bg-blue-500/20">%10</button>
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20).toFixed(2) }))} className="text-[10px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded hover:bg-blue-500/20">%20</button>
                  </div>
                </div>
              </FormField>
              <FormField label="Tevkifat Tutarı">
                <input type="number" step="0.01" className={inputCls} value={hForm.stopaj_tutari} onChange={e => setHForm({ ...hForm, stopaj_tutari: e.target.value })} placeholder="0.00" />
              </FormField>
            </div>
            
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-200/70">Genel Toplam</span>
              <span className="text-lg font-bold text-indigo-400">{money(Number(hForm.tutar || 0) + Number(hForm.kdv_tutari || 0) - Number(hForm.stopaj_tutari || 0))}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Belge No"><input className={inputCls} value={hForm.belge_no} onChange={e => setHForm({ ...hForm, belge_no: e.target.value })} placeholder="Fatura / makbuz no" /></FormField>
              <FormField label="Durum">
                <select className={inputCls} value={hForm.durum} onChange={e => setHForm({ ...hForm, durum: e.target.value })}>
                  {DURUM_OPTS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                </select>
              </FormField>
            </div>
            {isCekHareket && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                <FormField label="Çek Numarası"><input className={inputCls} value={hForm.cek_no} onChange={e => setHForm({ ...hForm, cek_no: e.target.value })} placeholder="Örn: 1234567" /></FormField>
                <FormField label="Çek Bankası"><input className={inputCls} value={hForm.cek_banka} onChange={e => setHForm({ ...hForm, cek_banka: e.target.value })} placeholder="Örn: Garanti BBVA" /></FormField>
              </div>
            )}
            <FormField label="Açıklama"><input className={inputCls} value={hForm.aciklama} onChange={e => setHForm({ ...hForm, aciklama: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Yardımcı bileşenler ──────────────────────────────────────────────────────

function BakiyeBox({ label, value, renk, bold }: { label: string; value: number; renk: string; bold?: boolean }) {
  return (
    <div className="text-center px-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
      <p className={`mt-0.5 ${bold ? 'text-base font-bold' : 'text-sm font-semibold'} text-${renk}-400 tabular-nums`}>{money(value)}</p>
    </div>
  )
}

function money(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
}
