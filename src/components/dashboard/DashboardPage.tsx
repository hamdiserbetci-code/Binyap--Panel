'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, AY_LABELS } from '@/lib/supabase'
import type { Firma } from '@/types'
import { Wallet, CreditCard, CheckSquare, TrendingUp, Clock, Receipt, AlertTriangle, ChevronRight, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

interface Props { userId: string; firma: Firma; firmaIds: string[]; onNavigate: (page: string) => void }

const MALATYA_GRUPLER: { id: string; label: string; renkBg: string; renkText: string }[] = [
  { id: 'mal_hizmet', label: 'Mal Hizmet Alışları', renkBg: 'bg-blue-50', renkText: 'text-blue-700' },
  { id: 'personel', label: 'Personel Giderleri', renkBg: 'bg-emerald-50', renkText: 'text-emerald-700' },
  { id: 'cesitli', label: 'Çeşitli Giderler', renkBg: 'bg-violet-50', renkText: 'text-violet-700' },
]

type MalatyaRow = { ana_grup: string; alt_kategori: string; tutar: number }
type MalatyaAnaToplam = { id: string; label: string; toplam: number; adet: number }
type MalatyaAltToplam = { ana_grup: string; alt_kategori: string; toplam: number; adet: number }

function normalizeOdemeTur(raw: string) {
  const key = String(raw || '').toLocaleLowerCase('tr-TR')
  if (key.includes('vergi')) return 'Vergi'
  if (key.includes('sgk')) return 'SGK'
  if (key.includes('maas') || key.includes('maaş')) return 'Maas'
  if (key.includes('cari')) return 'Cari'
  if (key.includes('cek') || key.includes('çek')) return 'Cek'
  if (key.includes('diger') || key.includes('diğer')) return 'Diger'
  return raw || 'Diger'
}

function odemeTurBadgeClass(raw: string) {
  const key = normalizeOdemeTur(raw).toLocaleLowerCase('tr-TR')
  if (key.includes('vergi')) return 'bg-rose-100 text-rose-700'
  if (key.includes('sgk')) return 'bg-blue-100 text-blue-700'
  if (key.includes('maas')) return 'bg-emerald-100 text-emerald-700'
  if (key.includes('cari')) return 'bg-purple-100 text-purple-700'
  if (key.includes('cek')) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function normalizeOdemeDurum(raw: string) {
  const key = String(raw || '').toLocaleLowerCase('tr-TR')
  if (['odendi', 'tamamlandi', 'tahsil_edildi', 'ödendi'].includes(key)) return 'odendi'
  if (['iptal', 'silindi'].includes(key)) return 'iptal'
  return 'odenecek'
}

const ODEME_TUR_SECENEKLERI = ['Vergi', 'SGK', 'Maas', 'Cari', 'Cek', 'Diger'] as const

export default function DashboardPage({ userId, firma, firmaIds, onNavigate }: Props) {
  const [loading, setLoading] = useState(true)
  const [kasaBakiye, setKasaBakiye] = useState(0)
  const [kasaGiris, setKasaGiris] = useState(0)
  const [kasaCikis, setKasaCikis] = useState(0)
  const [bekleyenOdeme, setBekleyenOdeme] = useState(0)
  const [bekleyenOdemeSayi, setBekleyenOdemeSayi] = useState(0)
  const [gecikmisSayi, setGecikmisSayi] = useState(0)
  const [gecikmisToplam, setGecikmisToplam] = useState(0)
  const [gorevToplam, setGorevToplam] = useState(0)
  const [gorevTamamlanan, setGorevTamamlanan] = useState(0)
  const [gorevGecikis, setGorevGecikis] = useState(0)
  const [maliyetGelir, setMaliyetGelir] = useState(0)
  const [maliyetGider, setMaliyetGider] = useState(0)
  const [maliyetFirmalar, setMaliyetFirmalar] = useState<{ad:string, gelir:number, gider:number}[]>([])
  const [puantajOnay, setPuantajOnay] = useState(0)
  const [puantajToplam, setPuantajToplam] = useState(0)
  const [puantajMaas, setPuantajMaas] = useState(0)
  const [vergiYaklasan, setVergiYaklasan] = useState<any[]>([])
  const [odemeListesi, setOdemeListesi] = useState<any[]>([])
  const [odemeMusteriOzet, setOdemeMusteriOzet] = useState<{ id: string; ad: string; toplam: number; items: any[] }[]>([])
  const [kzMusteriOzet, setKzMusteriOzet] = useState<{ id: string; ad: string; gelir: number; gider: number; net: number; detay: any }[]>([])
  const [acikOdemeKart, setAcikOdemeKart] = useState<string | null>(null)
  const [acikKzKart, setAcikKzKart] = useState<string | null>(null)
  const [odemeDonemFiltre, setOdemeDonemFiltre] = useState<'tum' | 'bu_ay' | 'gelecek_30' | 'gecikmis'>('tum')
  const [odemeTurFiltreleri, setOdemeTurFiltreleri] = useState<string[]>([])
  const [projeAdMap, setProjeAdMap] = useState<Record<string, string>>({})
  const [malatyaAnaToplamlar, setMalatyaAnaToplamlar] = useState<MalatyaAnaToplam[]>([])
  const [malatyaAltToplamlar, setMalatyaAltToplamlar] = useState<MalatyaAltToplam[]>([])

  const today = new Date().toISOString().split('T')[0]
  const ay = new Date().getMonth() + 1
  const yil = new Date().getFullYear()
  const [aktifAy, setAktifAy] = useState(ay)
  const [aktifYil, setAktifYil] = useState(yil)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      kasaRes, odemeRes, cekRes, projeRes, gorevRes, maliyetRes, puantajRes, vergiRes, malatyaRes, karZararRes
    ] = await Promise.all([
      supabase.from('kasa').select('*').in('firma_id', firmaIds).order('tarih'),
      supabase.from('odeme_plani').select('*').in('firma_id', firmaIds).order('vade'),
      supabase.from('cekler').select('*').in('firma_id', firmaIds),
      supabase.from('projeler').select('id,ad').in('firma_id', firmaIds),
      supabase.from('gorevler').select('*').in('firma_id', firmaIds),
      supabase.from('maliyet').select('*, firmalar(ad)').eq('yil', aktifYil).lte('ay', aktifAy),
      supabase.from('puantaj').select('*').eq('user_id', userId).eq('yil', aktifYil).eq('ay', aktifAy),
      supabase.from('vergi_surecleri').select('*').in('firma_id', firmaIds).eq('yil', aktifYil).neq('durum', 'tamamlandi').order('son_tarih'),
      supabase.from('malatya_maliyet').select('ana_grup, alt_kategori, tutar').eq('user_id', userId),
      supabase.from('kar_zarar_donem').select('*').in('firma_id', firmaIds).gte('donem', `${aktifYil}-01`).lte('donem', `${aktifYil}-${String(aktifAy).padStart(2, '0')}`),
    ])

    // Kasa
    const kasaData = kasaRes.data || []
    const buAyKasa = kasaData.filter((k: any) => k.tarih?.startsWith(`${yil}-${String(ay).padStart(2,'0')}`))
    const sonKayit = kasaData[kasaData.length - 1]
    setKasaBakiye(sonKayit?.bakiye || 0)
    setKasaGiris(buAyKasa.filter((k: any) => k.tur === 'giris').reduce((s: number, k: any) => s + k.tutar, 0))
    setKasaCikis(buAyKasa.filter((k: any) => k.tur === 'cikis').reduce((s: number, k: any) => s + k.tutar, 0))

    // Ödeme
    const manualOdemeData = ((odemeRes.data || []) as any[]).map((o: any) => ({
      ...o,
      id: String(o.id),
      baslik: o.baslik || o.aciklama || 'Odeme',
      tutar: Number(o.tutar || 0),
      vade_tarihi: o.vade_tarihi || o.vade || o.son_tarih || null,
      tur: o.tur || 'Diger Odemeler',
      durum: normalizeOdemeDurum(o.durum),
      kaynak: o.kaynak || 'Odeme Plani',
    }))
    const cekOdemeData = (cekRes.data || []).map((c: any) => ({
      id: `cek-${c.id}`,
      baslik: c.baslik || c.cek_no ? `Cek ${c.cek_no || ''}`.trim() : 'Cek',
      tutar: Number(c.tutar || 0),
      vade_tarihi: c.vade_tarihi || c.vade || null,
      durum: normalizeOdemeDurum(c.durum),
      tur: 'Cek Odemeleri',
      musteri_id: c.musteri_id || null,
      cari_ekip: c.cari_hesap || c.cari_ekip || null,
      kaynak: 'Cek Takibi',
    }))
    const allOdemeData = [...manualOdemeData, ...cekOdemeData].filter((o: any) => String(o.durum || '') !== 'iptal')
    const odemeData = allOdemeData.filter((o: any) => String(o.durum || '') === 'odenecek')
    const projeMapData: Record<string, string> = {}
    ;(projeRes.data || []).forEach((p: any) => { projeMapData[p.id] = p.ad })
    setProjeAdMap(projeMapData)
    setBekleyenOdeme(odemeData.reduce((s: number, o: any) => s + Number(o.tutar || 0), 0))
    setBekleyenOdemeSayi(odemeData.length)
    const gecikmisList = odemeData.filter((o: any) => o.vade_tarihi && o.vade_tarihi < today)
    setGecikmisSayi(gecikmisList.length)
    setGecikmisToplam(gecikmisList.reduce((s: number, o: any) => s + Number(o.tutar || 0), 0))
    setOdemeListesi(odemeData.slice(0, 5))
    const odemeTurGroupMap: Record<string, { id: string; ad: string; toplam: number; items: any[] }> = {}
    odemeData.forEach((o: any) => {
      const tur = normalizeOdemeTur(String(o.tur || 'Diger Odemeler'))
      if (!odemeTurGroupMap[tur]) odemeTurGroupMap[tur] = { id: tur, ad: tur, toplam: 0, items: [] }
      odemeTurGroupMap[tur].toplam += Number(o.tutar || 0)
      odemeTurGroupMap[tur].items.push({ ...o, _turLabel: tur })
    })
    setOdemeMusteriOzet(Object.values(odemeTurGroupMap).sort((a, b) => b.toplam - a.toplam))

    // Görevler
    const gorevData = gorevRes.data || []
    setGorevToplam(gorevData.length)
    setGorevTamamlanan(gorevData.filter((g: any) => g.durum === 'tamamlandi').length)
    setGorevGecikis(gorevData.filter((g: any) => g.durum !== 'tamamlandi' && g.son_tarih && g.son_tarih < today).length)

    // Maliyet - firma bazlı
    const maliyetData = maliyetRes.data || []
    const firmaMap: Record<string, {ad:string, gelir:number, gider:number}> = {}
    maliyetData.forEach((m: any) => {
      const fAd = m.firmalar?.ad || 'Bilinmiyor'
      if (!firmaMap[m.firma_id]) firmaMap[m.firma_id] = { ad: fAd, gelir: 0, gider: 0 }
      firmaMap[m.firma_id].gelir += m.satis_faturalari + m.diger_gelirler
      firmaMap[m.firma_id].gider += m.alis_faturalari + m.iscilik + m.diger_giderler + m.onceki_donem_stok
    })
    const firmaList = Object.values(firmaMap)
    setMaliyetFirmalar(firmaList)
    setMaliyetGelir(firmaList.reduce((s, f) => s + f.gelir, 0))
    setMaliyetGider(firmaList.reduce((s, f) => s + f.gider, 0))

    // Kar/Zarar firma özeti
    const kzRows = (karZararRes.data || []) as any[]
    if (kzRows.length > 0) {
      const sorted = [...kzRows].sort((a, b) => String(a.donem).localeCompare(String(b.donem)))
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const gelir = kzRows.reduce((s: number, r: any) => s + Number(r.satis_yurt_ici || 0) + Number(r.satis_yurt_disi || 0) - Number(r.satis_iade || 0), 0)
      const toplamAlis = kzRows.reduce((s: number, r: any) => s + Number(r.alis_malzeme || 0) + Number(r.alis_efatura || 0) + Number(r.alis_arsiv || 0) + Number(r.alis_utts || 0) + Number(r.alis_iscilik || 0), 0)
      const smm = Number(first?.donem_basi_stok || 0) + toplamAlis - Number(last?.donem_sonu_stok || 0)
      const toplamGyg = kzRows.reduce((s: number, r: any) => s + Number(r.gider_personel || 0) + Number(r.gider_kira || 0) + Number(r.gider_fatura || 0) + Number(r.gider_amortisman || 0) + Number(r.gider_diger || 0) + Number(r.gider_finansal || 0), 0)
      const gider = smm + toplamGyg
      setKzMusteriOzet([{ id: 'firma', ad: firma.ad, gelir, gider, net: gelir - gider, detay: { smm, toplamGyg, donemAdet: kzRows.length } }])
    } else {
      setKzMusteriOzet([])
    }

    // Puantaj
    const puantajData = puantajRes.data || []
    setPuantajToplam(puantajData.length)
    setPuantajOnay(puantajData.filter((p: any) => p.onaylandi).length)
    setPuantajMaas(puantajData.filter((p: any) => p.maas_odendi).length)

    // Vergi
    const son7gun = new Date(); son7gun.setDate(son7gun.getDate() + 7)
    const son7gunStr = son7gun.toISOString().split('T')[0]
    setVergiYaklasan((vergiRes.data || []).filter((v: any) => v.son_tarih <= son7gunStr).slice(0, 4))

    // Malatya Proje Maliyet — ana/alt toplamlar (tüm aylar + tüm yıllar)
    const malatyaRows = (malatyaRes.data || []) as MalatyaRow[]
    const anaMap: Record<string, { toplam: number; adet: number }> = {}
    const altMap: Record<string, Record<string, { toplam: number; adet: number }>> = {}

    malatyaRows.forEach((r) => {
      const ana = r.ana_grup
      const alt = r.alt_kategori
      const tutar = Number(r.tutar) || 0

      if (!anaMap[ana]) anaMap[ana] = { toplam: 0, adet: 0 }
      anaMap[ana].toplam += tutar
      anaMap[ana].adet += 1

      if (!altMap[ana]) altMap[ana] = {}
      if (!altMap[ana][alt]) altMap[ana][alt] = { toplam: 0, adet: 0 }
      altMap[ana][alt].toplam += tutar
      altMap[ana][alt].adet += 1
    })

    setMalatyaAnaToplamlar(
      MALATYA_GRUPLER.map(g => ({
        id: g.id,
        label: g.label,
        toplam: anaMap[g.id]?.toplam || 0,
        adet: anaMap[g.id]?.adet || 0,
      }))
    )

    const altTotals: MalatyaAltToplam[] = []
    MALATYA_GRUPLER.forEach(g => {
      const alts = altMap[g.id] || {}
      Object.entries(alts).forEach(([alt, v]) => {
        altTotals.push({ ana_grup: g.id, alt_kategori: alt, toplam: v.toplam, adet: v.adet })
      })
    })
    // Büyükten küçüğe sıralama (dashboard daha okunur olsun)
    altTotals.sort((a, b) => b.toplam - a.toplam)
    setMalatyaAltToplamlar(altTotals)

    setLoading(false)
  }, [firma.id, today, aktifAy, aktifYil, userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  function fmt(val: number) {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
  }

  const filteredOdemeMusteriOzet = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime()
    const next30 = new Date(now)
    next30.setDate(next30.getDate() + 30)
    const next30Time = next30.getTime()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    const matches = (item: any) => {
      const t = item?.vade_tarihi ? new Date(`${item.vade_tarihi}T00:00:00`).getTime() : NaN
      if (Number.isNaN(t)) return odemeDonemFiltre === 'tum'
      if (odemeDonemFiltre === 'bu_ay') return t >= startOfMonth && t <= endOfMonth
      if (odemeDonemFiltre === 'gelecek_30') return t >= todayStart && t <= next30Time
      if (odemeDonemFiltre === 'gecikmis') return t < todayStart
      return true
    }

    const turSecili = new Set(odemeTurFiltreleri)
    const turUygun = (item: any) => {
      if (turSecili.size === 0) return true
      const tur = normalizeOdemeTur(String(item?._turLabel || item?.tur || 'Diger'))
      return turSecili.has(tur)
    }

    return odemeMusteriOzet
      .map((g) => {
        const items = g.items.filter((it: any) => matches(it) && turUygun(it))
        const toplam = items.reduce((s: number, it: any) => s + Number(it.tutar || 0), 0)
        return { ...g, items, toplam }
      })
      .filter((g) => g.items.length > 0)
      .sort((a, b) => b.toplam - a.toplam)
  }, [odemeMusteriOzet, odemeDonemFiltre, odemeTurFiltreleri])

  const maxOdemeToplam = useMemo(
    () => Math.max(...filteredOdemeMusteriOzet.map((m) => Number(m.toplam || 0)), 1),
    [filteredOdemeMusteriOzet]
  )

  const maxKzNetAbs = useMemo(
    () => Math.max(...kzMusteriOzet.map((m) => Math.abs(Number(m.net || 0))), 1),
    [kzMusteriOzet]
  )


  function toggleOdemeTurFilter(tur: string) {
    setOdemeTurFiltreleri((prev) => (prev.includes(tur) ? prev.filter((x) => x !== tur) : [...prev, tur]))
  }

  const gorevYuzde = gorevToplam > 0 ? Math.round((gorevTamamlanan / gorevToplam) * 100) : 0

  // Pasta grafik için SVG
  function PastaGrafik({ gelir, gider }: { gelir: number; gider: number }) {
    const toplam = gelir + gider
    if (toplam === 0) return <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">Veri yok</div>
    const gelirOran = gelir / toplam
    const angle = gelirOran * 360
    const r = 40, cx = 50, cy = 50
    const rad = (angle - 90) * Math.PI / 180
    const x = cx + r * Math.cos(rad)
    const y = cy + r * Math.sin(rad)
    const large = angle > 180 ? 1 : 0
    return (
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="#fee2e2"/>
        <path d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill="#16a34a"/>
        <circle cx={cx} cy={cy} r={r * 0.55} fill="white"/>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1e293b">{Math.round(gelirOran * 100)}%</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#64748b">Gelir</text>
      </svg>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-2 text-slate-400">
        <RefreshCw size={16} className="animate-spin"/>
        <span className="text-sm">Yükleniyor...</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">{firma.ad} — {AY_LABELS[aktifAy]} {aktifYil}</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={aktifAy} onChange={e => setAktifAy(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs outline-none text-slate-700">
            {AY_LABELS.slice(1).map((a: string, i: number) => <option key={i+1} value={i+1}>{a}</option>)}
          </select>
          <select value={aktifYil} onChange={e => setAktifYil(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs outline-none text-slate-700">
            {Array.from({length:5},(_,i)=>yil-i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchAll} className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {/* Üst kartlar (kapali) */}
      <div className="hidden">
        {/* Kasa */}
        <div onClick={() => onNavigate('kasa')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Wallet size={15} className="text-blue-600"/></div>
            <p className="text-xs text-slate-500 font-medium">Kasa Bakiyesi</p>
          </div>
          <p className={`text-2xl font-bold ${kasaBakiye >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmt(kasaBakiye)}</p>
          <div className="flex gap-3 mt-2">
            <span className="text-[10px] text-emerald-500">↑ {fmt(kasaGiris)}</span>
            <span className="text-[10px] text-red-400">↓ {fmt(kasaCikis)}</span>
          </div>
        </div>

        {/* Bekleyen Ödemeler */}
        <div onClick={() => onNavigate('odeme')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-amber-200 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><CreditCard size={15} className="text-amber-600"/></div>
            <p className="text-xs text-slate-500 font-medium">Bekleyen</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{fmt(bekleyenOdeme)}</p>
          <p className="text-[10px] text-slate-400 mt-2">{bekleyenOdemeSayi} ödeme</p>
        </div>

        {/* Gecikmiş */}
        <div onClick={() => onNavigate('odeme')} className={`rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-all ${gecikmisSayi > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${gecikmisSayi > 0 ? 'bg-red-100' : 'bg-slate-50'}`}>
              <AlertTriangle size={15} className={gecikmisSayi > 0 ? 'text-red-600' : 'text-slate-400'}/>
            </div>
            <p className="text-xs text-slate-500 font-medium">Gecikmiş</p>
          </div>
          <p className={`text-2xl font-bold ${gecikmisSayi > 0 ? 'text-red-600' : 'text-slate-400'}`}>{gecikmisSayi}</p>
          <p className="text-[10px] text-slate-400 mt-2">{gecikmisSayi > 0 ? fmt(gecikmisToplam) : 'Gecikme yok'}</p>
        </div>

        {/* Görevler */}
        <div onClick={() => onNavigate('gorevler')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-emerald-200 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckSquare size={15} className="text-emerald-600"/></div>
            <p className="text-xs text-slate-500 font-medium">Görevler</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{gorevYuzde}%</p>
          <p className="text-[10px] text-slate-400 mt-2">{gorevTamamlanan}/{gorevToplam} tamamlandı{gorevGecikis > 0 ? ` • ${gorevGecikis} gecikmiş` : ''}</p>
        </div>
      </div>

      {/* İş Takibi (Görevler) Kartı */}
      <div onClick={() => onNavigate('gorevler')} className="bg-white border border-emerald-100 rounded-2xl p-5 cursor-pointer hover:border-emerald-200 hover:shadow-sm transition-all relative overflow-hidden group mb-4 mt-2 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-200">
              <CheckSquare size={18} className="text-emerald-600"/>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-wide">İş Takibi (Görevler)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Seçili dönemdeki tamamlanma oranı</p>
            </div>
          </div>
          <div className="flex-1 max-w-md w-full ml-auto">
             <div className="flex justify-between items-center text-[11px] font-medium text-slate-600 mb-2">
                <span>{gorevTamamlanan} / {gorevToplam} Görev Tamamlandı</span>
                {gorevGecikis > 0 ? <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">{gorevGecikis} Gecikmiş Görev</span> : <span className="text-emerald-600 font-bold">{gorevYuzde}%</span>}
             </div>
             <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
               <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all" style={{ width: `${gorevYuzde}%` }}></div>
             </div>
          </div>
        </div>
      </div>

      {/* Ana görünüm: Odemeler + Kar-Zarar */}
      <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
        <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-base font-bold tracking-tight text-slate-800">Ödemeler</p>
                <p className="text-xs text-slate-500">Müşteri bazlı bekleyen ödeme özeti</p>
              </div>
              <div className="space-y-2">
                <select
                  value={odemeDonemFiltre}
                  onChange={(e) => setOdemeDonemFiltre(e.target.value as 'tum' | 'bu_ay' | 'gelecek_30' | 'gecikmis')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 lg:w-auto"
                >
                  <option value="tum">Tüm Dönem</option>
                  <option value="bu_ay">Bu Ay</option>
                  <option value="gelecek_30">Gelecek 30 Gün</option>
                  <option value="gecikmis">Gecikmiş</option>
                </select>
                <div className="flex flex-wrap gap-1.5">
                  {ODEME_TUR_SECENEKLERI.map((tur) => {
                    const active = odemeTurFiltreleri.includes(tur)
                    return (
                      <button
                        key={tur}
                        type="button"
                        onClick={() => toggleOdemeTurFilter(tur)}
                        className={`rounded-full border px-2 py-1 text-[10px] font-bold transition ${active ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                      >
                        {tur}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {filteredOdemeMusteriOzet.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Filtreye uygun ödeme kaydı bulunamadı.</p>}
            {filteredOdemeMusteriOzet.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-100 overflow-hidden">
                <button onClick={() => setAcikOdemeKart(acikOdemeKart === m.id ? null : m.id)} className="w-full px-3 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="min-w-0 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{m.ad}</p>
                      <p className="text-sm font-black text-blue-700 whitespace-nowrap">{fmt(m.toplam)}</p>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${Math.max(6, Math.round((Number(m.toplam || 0) / maxOdemeToplam) * 100))}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{m.items.length} kayıt</p>
                  </div>
                  {acikOdemeKart === m.id ? <ChevronUp size={16} className="text-slate-400 ml-2 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 ml-2 shrink-0" />}
                </button>
                {acikOdemeKart === m.id && (
                  <div className="p-2 space-y-1.5 bg-white border-t border-slate-100">
                    {m.items.slice(0, 8).map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-2 border border-slate-100 rounded-md p-2 bg-slate-50">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-slate-700 truncate">{o.baslik}</p>
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${odemeTurBadgeClass(o._turLabel)}`}>{o._turLabel}</span>
                          </div>
                          <p className="text-[10px] text-slate-500">{o.vade_tarihi || '-'} {o.kaynak ? `• ${o.kaynak}` : ''}</p>
                          <p className="text-[10px] text-slate-400">Proje: {o.proje_id ? (projeAdMap[o.proje_id] || 'Bilinmeyen Proje') : 'Genel Firma'}</p>
                        </div>
                        <p className="text-xs font-bold text-blue-700 shrink-0">{fmt(Number(o.tutar || 0))}</p>
                      </div>
                    ))}
                    <div className="mt-2 flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5">
                      <span className="text-[11px] font-semibold text-blue-700">Müşteri Toplamı</span>
                      <span className="text-[12px] font-black text-blue-700">{fmt(Number(m.toplam || 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-base font-bold tracking-tight text-slate-800">Kar / Zarar</p>
            <p className="text-xs text-slate-500">Firma net durum özeti</p>
          </div>
          <div className="p-3 space-y-2">
            {kzMusteriOzet.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Bu dönem kâr/zarar kaydı bulunamadı.</p>}
            {kzMusteriOzet.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-100 overflow-hidden">
                <button onClick={() => setAcikKzKart(acikKzKart === m.id ? null : m.id)} className="w-full px-3 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{m.ad}</p>
                    <p className={`text-sm font-black ${m.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Net: {fmt(m.net)}</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                      <div className={`h-1.5 rounded-full ${m.net >= 0 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-rose-400 to-orange-500'}`} style={{ width: `${Math.max(6, Math.round((Math.abs(Number(m.net || 0)) / maxKzNetAbs) * 100))}%` }} />
                    </div>
                  </div>
                  {acikKzKart === m.id ? <ChevronUp size={16} className="text-slate-400 ml-2 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 ml-2 shrink-0" />}
                </button>
                {acikKzKart === m.id && (
                  <div className="p-2 space-y-1.5 text-xs bg-white border-t border-slate-100">
                    <div className="flex justify-between"><span className="text-slate-500">Gelir</span><span className="font-bold text-emerald-600">{fmt(m.gelir)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Gider</span><span className="font-bold text-rose-600">{fmt(m.gider)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Kar/Zarar Durumu</span><span className={`font-bold ${m.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{m.net >= 0 ? '📈 Kâr' : '📉 Zarar'}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orta satır (kapali) */}
      <div className="hidden">
        {/* Maliyet pasta grafik */}
        {maliyetFirmalar.length === 0 ? (
          <div onClick={() => onNavigate('maliyet')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><TrendingUp size={15} className="text-purple-600"/></div>
              <p className="text-xs text-slate-500 font-medium">Maliyet — {AY_LABELS[aktifAy]}</p>
            </div>
            <p className="text-xs text-slate-400 text-center py-4">Bu dönem maliyet kaydı yok</p>
          </div>
        ) : (
          <>
            {maliyetFirmalar.map(f => {
              const net = f.gelir - f.gider
              return (
                <div key={f.ad} onClick={() => onNavigate('maliyet')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><TrendingUp size={15} className="text-purple-600"/></div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{f.ad}</p>
                      <p className="text-[10px] text-slate-400">Ocak → {AY_LABELS[aktifAy]} {aktifYil} kümülatif</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <PastaGrafik gelir={f.gelir} gider={f.gider}/>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div>
                        <p className="text-[10px] text-slate-500">Gelir</p>
                        <p className="text-sm font-semibold text-emerald-600 truncate">{fmt(f.gelir)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Gider</p>
                        <p className="text-sm font-semibold text-red-500 truncate">{fmt(f.gider)}</p>
                      </div>
                      <div className={`rounded-lg px-2 py-1 ${net >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className="text-[10px] text-slate-500">Net</p>
                        <p className={`text-sm font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'} truncate`}>{fmt(net)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Puantaj durumu */}
        <div onClick={() => onNavigate('puantaj')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Clock size={15} className="text-blue-600"/></div>
            <p className="text-xs text-slate-500 font-medium">Puantaj — {AY_LABELS[aktifAy]}</p>
          </div>
          {puantajToplam === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Bu ay puantaj kaydı yok</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Puantaj Geldi', val: puantajOnay, color: 'bg-emerald-500' },
                { label: 'Maaş Ödendi', val: puantajMaas, color: 'bg-blue-500' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="font-medium text-slate-700">{item.val}/{puantajToplam}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${puantajToplam > 0 ? (item.val / puantajToplam) * 100 : 0}%` }}/>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400 pt-1">{puantajToplam} personel kaydı</p>
            </div>
          )}
        </div>

        {/* Vergi takvimi */}
        <div onClick={() => onNavigate('vergi')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><Receipt size={15} className="text-red-500"/></div>
            <p className="text-xs text-slate-500 font-medium">Vergi Takvimi</p>
          </div>
          {vergiYaklasan.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">7 gün içinde beyanname yok</p>
          ) : (
            <div className="space-y-2">
              {vergiYaklasan.map(v => {
                const gecikti = v.son_tarih < today
                const bugun = v.son_tarih === today
                return (
                  <div key={v.id} className={`flex items-center gap-2 p-2 rounded-lg ${gecikti ? 'bg-red-50' : bugun ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${gecikti ? 'bg-red-500' : bugun ? 'bg-amber-500' : 'bg-blue-400'}`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-slate-700 truncate">{v.tur}</p>
                      <p className="text-[9px] text-slate-400">{v.son_tarih}</p>
                    </div>
                    {gecikti && <span className="text-[9px] text-red-500 font-medium">GECİKTİ</span>}
                    {bugun && <span className="text-[9px] text-amber-500 font-medium">BUGÜN</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Malatya Proje Maliyet (kapali) */}
      <div
        onClick={() => onNavigate('malatya-maliyet')}
        className="hidden bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={15} className="text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Malatya Maliyet</p>
              <p className="text-[10px] text-slate-400">Tüm aylar & tüm yıllar — ana & alt toplamlar</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </div>

        {malatyaAnaToplamlar.length === 0 || malatyaAnaToplamlar.every(g => g.adet === 0) ? (
          <div className="px-4 py-6">
            <p className="text-xs text-slate-400">Kayıt yok</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {malatyaAnaToplamlar.map((g) => (
                <div key={g.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className={`text-[11px] font-semibold ${MALATYA_GRUPLER.find(x => x.id === g.id)?.renkText || 'text-slate-700'} truncate`}>
                    {g.label}
                  </p>
                  <p className="text-base font-bold text-slate-800 mt-1">{fmt(g.toplam)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{g.adet} kayıt</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {MALATYA_GRUPLER.map((g) => {
                const alts = malatyaAltToplamlar.filter(a => a.ana_grup === g.id)
                return (
                  <div key={g.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[11px] font-semibold ${g.renkText}`}>{g.label}</p>
                      <p className="text-[10px] text-slate-400">{alts.length} alt</p>
                    </div>
                    {alts.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Kayıt yok</p>
                    ) : (
                      <div className="space-y-1.5">
                        {alts.slice(0, 6).map((a) => (
                          <div key={a.alt_kategori} className="flex items-center justify-between gap-3">
                            <p className="text-[11px] text-slate-600 truncate">{a.alt_kategori}</p>
                            <p className="text-[11px] font-semibold text-slate-800 shrink-0">{fmt(a.toplam)}</p>
                          </div>
                        ))}
                        {alts.length > 6 && (
                          <p className="text-[10px] text-slate-400 pt-1">+{alts.length - 6} diğer</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Yaklaşan ödemeler (kapali) */}
      {odemeListesi.length > 0 && (
        <div className="hidden bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <p className="text-sm font-medium text-slate-700">Yaklaşan Ödemeler</p>
            <button onClick={() => onNavigate('odeme')} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
              Tümü <ChevronRight size={11}/>
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {odemeListesi.map(o => {
              const gecikti = o.vade_tarihi < today
              const TM: Record<string,string> = { cek:'Çek', vergi:'Vergi', sgk:'SGK', maas:'Maaş', cari:'Cari', diger:'Diğer' }
              return (
                <div key={o.id} className={`flex items-center gap-3 px-4 py-3 ${gecikti ? 'bg-red-50/50' : ''}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${gecikti ? 'bg-red-500' : 'bg-amber-400'}`}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{o.baslik}</p>
                    <p className="text-[10px] text-slate-400">{TM[o.tur] || o.tur} • {o.vade_tarihi}</p>
                  </div>
                  <p className={`text-sm font-semibold flex-shrink-0 ${gecikti ? 'text-red-500' : 'text-slate-700'}`}>{fmt(o.tutar)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
