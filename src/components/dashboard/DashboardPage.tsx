'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma, AY_LABELS } from '@/lib/supabase'
import { Wallet, CreditCard, CheckSquare, TrendingUp, Clock, Receipt, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react'

interface Props { userId: string; firma: Firma; onNavigate: (page: string) => void }

const MALATYA_GRUPLER: { id: string; label: string; renkBg: string; renkText: string }[] = [
  { id: 'mal_hizmet', label: 'Mal Hizmet Alışları', renkBg: 'bg-blue-50', renkText: 'text-blue-700' },
  { id: 'personel', label: 'Personel Giderleri', renkBg: 'bg-emerald-50', renkText: 'text-emerald-700' },
  { id: 'cesitli', label: 'Çeşitli Giderler', renkBg: 'bg-violet-50', renkText: 'text-violet-700' },
]

type MalatyaRow = { ana_grup: string; alt_kategori: string; tutar: number }
type MalatyaAnaToplam = { id: string; label: string; toplam: number; adet: number }
type MalatyaAltToplam = { ana_grup: string; alt_kategori: string; toplam: number; adet: number }

export default function DashboardPage({ userId, firma, onNavigate }: Props) {
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
  const [aktifProjeler, setAktifProjeler] = useState(0)
  const [aktifEkip, setAktifEkip] = useState(0)
  const [bankaBakiye, setBankaBakiye] = useState(0)
  const [maliyetGelir, setMaliyetGelir] = useState(0)
  const [maliyetGider, setMaliyetGider] = useState(0)
  const [maliyetFirmalar, setMaliyetFirmalar] = useState<{ad:string, gelir:number, gider:number}[]>([])
  const [puantajOnay, setPuantajOnay] = useState(0)
  const [puantajToplam, setPuantajToplam] = useState(0)
  const [puantajMaas, setPuantajMaas] = useState(0)
  const [vergiYaklasan, setVergiYaklasan] = useState<any[]>([])
  const [odemeListesi, setOdemeListesi] = useState<any[]>([])
  const [malatyaAnaToplamlar, setMalatyaAnaToplamlar] = useState<MalatyaAnaToplam[]>([])
  const [malatyaAltToplamlar, setMalatyaAltToplamlar] = useState<MalatyaAltToplam[]>([])
  const [sifirlendi, setSifirlendi] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const ay = new Date().getMonth() + 1
  const yil = new Date().getFullYear()
  const [aktifAy, setAktifAy] = useState(ay)
  const [aktifYil, setAktifYil] = useState(yil)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      kasaRes, odemeRes, gorevRes, maliyetRes, puantajRes, vergiRes, projelerRes, ekipRes, bankaRes, malatyaRes
    ] = await Promise.all([
      supabase.from('kasa').select('*').eq('firma_id', firma.id).order('tarih'),
      supabase.from('odeme_plani').select('*').eq('firma_id', firma.id).eq('durum', 'beklemede').order('vade_tarihi'),
      supabase.from('gorevler').select('*').eq('firma_id', firma.id),
      supabase.from('maliyet').select('*, firmalar(ad)').eq('yil', aktifYil).lte('ay', aktifAy),
      supabase.from('puantaj').select('*').eq('user_id', userId).eq('yil', aktifYil).eq('ay', aktifAy),
      supabase.from('vergi_surecleri').select('*').eq('firma_id', firma.id).eq('yil', aktifYil).neq('durum', 'tamamlandi').order('son_tarih'),
      supabase.from('projeler').select('*').eq('firma_id', firma.id),
      supabase.from('ekipler').select('*').eq('firma_id', firma.id),
      supabase.from('bankalar').select('*').eq('firma_id', firma.id),
      // Tüm aylar + tüm yıllar toplamı (dashboard özetinde tarih filtresi yok)
      supabase.from('malatya_maliyet').select('ana_grup, alt_kategori, tutar').eq('user_id', userId),
    ])

    // Kasa
    const kasaData = kasaRes.data || []
    const buAyKasa = kasaData.filter((k: any) => k.tarih?.startsWith(`${yil}-${String(ay).padStart(2,'0')}`))
    const sonKayit = kasaData[kasaData.length - 1]
    setKasaBakiye(sonKayit?.bakiye || 0)
    setKasaGiris(buAyKasa.filter((k: any) => k.tur === 'giris').reduce((s: number, k: any) => s + k.tutar, 0))
    setKasaCikis(buAyKasa.filter((k: any) => k.tur === 'cikis').reduce((s: number, k: any) => s + k.tutar, 0))

    // Ödeme
    const odemeData = odemeRes.data || []
    setBekleyenOdeme(odemeData.reduce((s: number, o: any) => s + o.tutar, 0))
    setBekleyenOdemeSayi(odemeData.length)
    const gecikmisList = odemeData.filter((o: any) => o.vade_tarihi < today)
    setGecikmisSayi(gecikmisList.length)
    setGecikmisToplam(gecikmisList.reduce((s: number, o: any) => s + o.tutar, 0))
    setOdemeListesi(odemeData.slice(0, 5))

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

    setAktifProjeler(projelerRes.data?.length || 0)
    setAktifEkip((ekipRes.data || []).filter((e:any)=>e.durum !== 'pasif').length || 0)
    setBankaBakiye((bankaRes.data || []).reduce((s:number,b:any)=>s + (b.bakiye || 0), 0))

    setLoading(false)
  }, [firma.id, today, aktifAy, aktifYil, userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const clearAllData = async () => {
    if (!confirm('Tüm kasa, banka, ödeme planı (çek/senet/gelir/gider/maliyet) verilerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return
    setLoading(true)
    const tables = ['kasa', 'bankalar', 'odeme_plani', 'maliyet', 'projeler', 'ekipler', 'gorevler', 'puantaj', 'vergi_surecleri', 'malatya_maliyet', 'cekler', 'senetler', 'cari_hesap', 'cari_hareket']
    for (const table of tables) {
      await supabase.from(table).delete().eq('firma_id', firma.id)
    }
    setSifirlendi(true)
    await fetchAll()
    alert('Veriler temizlendi. Panel artık temiz bir başlangıç için hazır.')
    setLoading(false)
  }

  const sifirlaGosterimi = () => {
    setSifirlendi(true)
    setKasaBakiye(0); setKasaGiris(0); setKasaCikis(0)
    setBekleyenOdeme(0); setBekleyenOdemeSayi(0); setGecikmisSayi(0); setGecikmisToplam(0)
    setGorevToplam(0); setGorevTamamlanan(0); setGorevGecikis(0)
    setAktifProjeler(0); setAktifEkip(0); setBankaBakiye(0)
    setMaliyetGelir(0); setMaliyetGider(0); setMaliyetFirmalar([])
    setMalatyaAnaToplamlar([]); setMalatyaAltToplamlar([])
  }

  function fmt(val: number) {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
  }

  const karZarar = maliyetGelir - maliyetGider
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
          <button onClick={clearAllData} className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all">
            Tüm Verileri Temizle
          </button>
          <button onClick={sifirlaGosterimi} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all">
            Panelde Sıfırla
          </button>
        </div>
      </div>

      {/* Üst kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <div onClick={() => onNavigate('projeler')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all">
          <p className="text-xs text-slate-500 font-medium">Aktif Proje</p>
          <p className="text-2xl font-bold text-blue-600">{sifirlendi ? 0 : aktifProjeler}</p>
          <p className="text-[10px] text-slate-400 mt-2">Seçili firmaya ait tüm projeler</p>
        </div>
        <div onClick={() => onNavigate('proje-ekipler')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-emerald-200 hover:shadow-sm transition-all">
          <p className="text-xs text-slate-500 font-medium">Aktif Ekip</p>
          <p className="text-2xl font-bold text-emerald-600">{aktifEkip}</p>
          <p className="text-[10px] text-slate-400 mt-2">Projeler üzerindeki ekip üye sayısı</p>
        </div>
        <div onClick={() => onNavigate('maliyet')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-violet-200 hover:shadow-sm transition-all">
          <p className="text-xs text-slate-500 font-medium">Toplam Gelir</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(maliyetGelir)}</p>
          <p className="text-[10px] text-slate-400 mt-2">Seçili yıl/aay toplam</p>
        </div>
        <div onClick={() => onNavigate('maliyet')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-rose-200 hover:shadow-sm transition-all">
          <p className="text-xs text-slate-500 font-medium">Toplam Gider</p>
          <p className="text-2xl font-bold text-rose-600">{fmt(maliyetGider)}</p>
          <p className="text-[10px] text-slate-400 mt-2">Seçili yıl/aay toplam</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 font-medium">Net Kar/Zarar</p>
          <p className={`text-2xl font-bold ${karZarar>=0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(karZarar)}</p>
          <p className="text-[10px] text-slate-400 mt-2">Gelir - Gider</p>
        </div>
        <div onClick={() => onNavigate('puantaj')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-cyan-200 hover:shadow-sm transition-all">
          <p className="text-xs text-slate-500 font-medium">Ödenmemiş Puantaj</p>
          <p className="text-2xl font-bold text-cyan-600">{(puantajToplam - puantajMaas).toLocaleString('tr-TR')}</p>
          <p className="text-[10px] text-slate-400 mt-2">Maaş ödemesi bekleyen</p>
        </div>
        <div onClick={() => onNavigate('banka')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all">
          <p className="text-xs text-slate-500 font-medium">Banka Bakiyesi</p>
          <p className="text-2xl font-bold text-indigo-600">{fmt(bankaBakiye)}</p>
          <p className="text-[10px] text-slate-400 mt-2">Tüm banka hesapları</p>
        </div>
        <div onClick={() => onNavigate('gorevler')} className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:border-amber-200 hover:shadow-sm transition-all">
          <p className="text-xs text-slate-500 font-medium">Tamamlanan</p>
          <p className="text-2xl font-bold text-amber-600">{gorevTamamlanan}</p>
          <p className="text-[10px] text-slate-400 mt-2">Tamamlanan görev sayısı</p>
        </div>
      </div>

      {/* Orta satır */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      {/* Malatya Proje Maliyet (Ana/Alt toplamlar) */}
      {!sifirlendi && (
        <div
          onClick={() => onNavigate('malatya-maliyet')}
          className="bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all overflow-hidden"
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

      {/* Yaklaşan ödemeler */}
      {odemeListesi.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
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
