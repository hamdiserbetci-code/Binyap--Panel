'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, X, AlertTriangle, Clock, CheckCircle, AlarmClock } from 'lucide-react'

interface Bildirim {
  id: string
  tip: 'gecikti' | 'bugun' | 'yaklasıyor' | 'saat'
  baslik: string
  mesaj: string
  gorev_id: string
  hatirlama_saati?: string
  erteleme_dakika?: number
}

interface Props { userId: string }

const ERTELEME_SECENEKLERI = [5, 10, 15, 30, 60]

export default function BildirimSistemi({ userId }: Props) {
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([])
  const [acik, setAcik] = useState(false)
  const [izinVerildi, setIzinVerildi] = useState(false)
  const [gosterilen, setGosterilen] = useState<Record<string, number>>({})
  const [ertelenen, setErtelenen] = useState<Record<string, number>>({})

  const fetchBildirimler = useCallback(async () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const simdi = now.toTimeString().slice(0, 5)
    const son3gun = new Date()
    son3gun.setDate(son3gun.getDate() + 3)
    const son3gunStr = son3gun.toISOString().split('T')[0]

    const [{ data: gorevData }, { data: odemeData }] = await Promise.all([
      supabase.from('gorevler').select('*').eq('user_id', userId).neq('durum', 'tamamlandi').not('son_tarih', 'is', null).lte('son_tarih', son3gunStr),
      supabase.from('odeme_plani').select('*').eq('user_id', userId).eq('durum', 'beklemede').not('hatirlama_tarihi', 'is', null).lte('hatirlama_tarihi', son3gunStr)
    ])

    const yeniBildirimler: Bildirim[] = []

    // Görev bildirimleri
    ;(gorevData || []).forEach(g => {
      const gecikti = g.son_tarih < today
      const bugun = g.son_tarih === today
      yeniBildirimler.push({
        id: g.id, gorev_id: g.id,
        tip: gecikti ? 'gecikti' : bugun ? 'bugun' : 'yaklasıyor',
        baslik: gecikti ? '🔴 Gecikmiş Görev' : bugun ? '🟡 Bugün Son Gün' : '🔔 Yaklaşan Görev',
        mesaj: `${g.baslik} — Son tarih: ${g.son_tarih}`,
        hatirlama_saati: g.hatirlama_saati, erteleme_dakika: g.erteleme_dakika || 0,
      })

      // Saat bazlı hatırlatıcı
      if (g.hatirlama_saati && g.son_tarih >= today) {
        const hatirlamaSaati = g.hatirlama_saati.slice(0, 5)
        const ertelemeDk = ertelenen[g.id] || 0
        const ertelenmisSaat = ertelemeDk > 0 ? addMinutes(hatirlamaSaati, ertelemeDk) : hatirlamaSaati
        const fark = Math.abs(timeToMinutes(simdi) - timeToMinutes(ertelenmisSaat))
        if (fark <= 2 && g.son_tarih === today) {
          const saatBildirimId = `${g.id}_saat`
          const sonGosterim = gosterilen[saatBildirimId] || 0
          if (now.getTime() - sonGosterim > 4 * 60 * 1000) {
            yeniBildirimler.push({
              id: saatBildirimId, gorev_id: g.id, tip: 'saat',
              baslik: '⏰ Hatırlatıcı', mesaj: `${g.baslik} — ${ertelenmisSaat}`,
              hatirlama_saati: ertelenmisSaat, erteleme_dakika: g.erteleme_dakika || 0,
            })
            if (izinVerildi && !gosterilen[saatBildirimId]) {
              new Notification('⏰ Hatırlatıcı', { body: g.baslik, icon: '/favicon.ico', tag: saatBildirimId })
              setGosterilen(prev => ({ ...prev, [saatBildirimId]: now.getTime() }))
            }
          }
        }
      }
    })

    // Ödeme hatırlatıcıları
    ;(odemeData || []).forEach(o => {
      const gecikti = o.hatirlama_tarihi < today
      const bugun = o.hatirlama_tarihi === today
      const odemeId = `odeme_${o.id}`

      // Saat kontrolü
      if (o.hatirlama_saati && bugun) {
        const hatirlamaSaati = o.hatirlama_saati.slice(0, 5)
        const fark = Math.abs(timeToMinutes(simdi) - timeToMinutes(hatirlamaSaati))
        if (fark <= 2) {
          yeniBildirimler.push({
            id: `${odemeId}_saat`, gorev_id: odemeId, tip: 'saat',
            baslik: '💳 Ödeme Hatırlatıcı',
            mesaj: `${o.baslik} — Vade: ${o.vade_tarihi} — ${o.tutar?.toLocaleString('tr-TR')} ₺`,
            hatirlama_saati: hatirlamaSaati,
          })
        }
      } else if (gecikti || bugun) {
        yeniBildirimler.push({
          id: odemeId, gorev_id: odemeId,
          tip: gecikti ? 'gecikti' : 'bugun',
          baslik: gecikti ? '💳 Gecikmiş Ödeme Hatırlatıcı' : '💳 Bugün Ödeme Hatırlatıcı',
          mesaj: `${o.baslik} — Vade: ${o.vade_tarihi} — ${o.tutar?.toLocaleString('tr-TR')} ₺`,
        })
      }
    })

    setBildirimler(yeniBildirimler)

    if (izinVerildi) {
      yeniBildirimler.filter(b => b.tip !== 'saat').forEach(b => {
        if (!gosterilen[b.id]) {
          new Notification(b.baslik, { body: b.mesaj, icon: '/favicon.ico', tag: b.id })
          setGosterilen(prev => ({ ...prev, [b.id]: Date.now() }))
        }
      })
    }
  }, [userId, izinVerildi, gosterilen, ertelenen])

  function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  function addMinutes(t: string, dk: number) {
    const total = timeToMinutes(t) + dk
    const h = Math.floor(total / 60) % 24
    const m = total % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }

  async function handleErteleme(b: Bildirim, dakika: number) {
    setErtelenen(prev => ({ ...prev, [b.gorev_id]: (prev[b.gorev_id] || 0) + dakika }))
    await supabase.from('gorevler').update({ erteleme_dakika: (b.erteleme_dakika || 0) + dakika }).eq('id', b.gorev_id)
    setBildirimler(prev => prev.filter(x => x.id !== b.id))
  }

  async function tarayicIzniIste() {
    if (!('Notification' in window)) return
    const izin = await Notification.requestPermission()
    if (izin === 'granted') setIzinVerildi(true)
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') setIzinVerildi(true)
    fetchBildirimler()
    const interval = setInterval(fetchBildirimler, 60 * 1000) // Her 1 dakika
    return () => clearInterval(interval)
  }, [fetchBildirimler])

  const gecikmisSayi = bildirimler.filter(b => b.tip === 'gecikti').length
  const bugunSayi = bildirimler.filter(b => b.tip === 'bugun').length
  const yaklasanSayi = bildirimler.filter(b => b.tip === 'yaklasıyor').length
  const saatSayi = bildirimler.filter(b => b.tip === 'saat').length

  const TIP_COLORS: Record<string, string> = {
    gecikti: 'bg-red-500/10 border-red-200 text-red-700',
    bugun: 'bg-amber-500/10 border-amber-200 text-amber-300',
    yaklasıyor: 'bg-blue-500/10 border-blue-200 text-blue-400',
    saat: 'bg-purple-500/10 border-purple-200 text-purple-700',
  }

  const TIP_ICONS: Record<string, React.ReactNode> = {
    gecikti: <AlertTriangle size={14} className="text-red-400 flex-shrink-0"/>,
    bugun: <Clock size={14} className="text-amber-500 flex-shrink-0"/>,
    yaklasıyor: <Bell size={14} className="text-blue-500 flex-shrink-0"/>,
    saat: <AlarmClock size={14} className="text-purple-500 flex-shrink-0"/>,
  }

  return (
    <div className="relative">
      <button onClick={() => setAcik(!acik)}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all ${acik ? 'bg-blue-600 text-white' : 'bg-white/[0.02] border border-white/[0.08] text-slate-400 hover:border-blue-300 hover:text-blue-500'}`}>
        <Bell size={16}/>
        {bildirimler.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {bildirimler.length > 9 ? '9+' : bildirimler.length}
          </span>
        )}
      </button>

      {acik && (
        <div className="absolute right-0 top-11 w-80 bg-white/[0.02] rounded-2xl border border-white/[0.08] shadow-xl shadow-black/20-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-white/[0.04]">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-300"/>
              <p className="text-sm font-semibold text-white">Bildirimler</p>
              {bildirimler.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{bildirimler.length}</span>
              )}
            </div>
            <button onClick={() => setAcik(false)} className="text-slate-400 hover:text-slate-300"><X size={14}/></button>
          </div>

          {!izinVerildi && (
            <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-100 flex items-center justify-between">
              <p className="text-xs text-blue-400">Tarayıcı bildirimleri için izin verin</p>
              <button onClick={tarayicIzniIste} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-blue-700">İzin Ver</button>
            </div>
          )}

          {bildirimler.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle size={32} className="text-emerald-300 mb-2"/>
              <p className="text-sm text-slate-400">Tüm görevler zamanında!</p>
              <p className="text-xs text-slate-300 mt-0.5">Bekleyen uyarı yok</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-0 border-b border-white/[0.05]">
                {gecikmisSayi > 0 && <div className="flex flex-col items-center py-2.5 border-r border-white/[0.05]"><p className="text-lg font-bold text-red-400">{gecikmisSayi}</p><p className="text-[10px] text-slate-400">Gecikmiş</p></div>}
                {bugunSayi > 0 && <div className="flex flex-col items-center py-2.5 border-r border-white/[0.05]"><p className="text-lg font-bold text-amber-500">{bugunSayi}</p><p className="text-[10px] text-slate-400">Bugün</p></div>}
                {yaklasanSayi > 0 && <div className="flex flex-col items-center py-2.5 border-r border-white/[0.05]"><p className="text-lg font-bold text-blue-500">{yaklasanSayi}</p><p className="text-[10px] text-slate-400">Yaklaşan</p></div>}
                {saatSayi > 0 && <div className="flex flex-col items-center py-2.5"><p className="text-lg font-bold text-purple-500">{saatSayi}</p><p className="text-[10px] text-slate-400">Saat</p></div>}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {bildirimler.map(b => (
                  <div key={b.id} className={`px-4 py-3 border-l-4 ${TIP_COLORS[b.tip]}`}>
                    <div className="flex items-start gap-2.5 mb-2">
                      {TIP_ICONS[b.tip]}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{b.baslik}</p>
                        <p className="text-[11px] opacity-80 mt-0.5 truncate">{b.mesaj}</p>
                        {b.hatirlama_saati && (
                          <p className="text-[10px] opacity-70 mt-0.5">⏰ {b.hatirlama_saati.slice(0,5)}</p>
                        )}
                      </div>
                    </div>
                    {/* Erteleme butonları - sadece saat bildirimleri için */}
                    {b.tip === 'saat' && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        <span className="text-[10px] text-purple-400 font-medium mr-1">Ertele:</span>
                        {ERTELEME_SECENEKLERI.map(dk => (
                          <button key={dk} onClick={() => handleErteleme(b, dk)}
                            className="text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-medium transition-colors">
                            {dk}dk
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
