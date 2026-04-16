'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { Bell, X, AlertTriangle, Clock, CheckCircle, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmt, fmtDate } from '@/components/ui'

interface Bildirim {
  id: string
  tip: 'gecikti' | 'bugun' | 'yaklasıyor'
  baslik: string
  mesaj: string
  tutar: number
  vade_tarihi: string
  odeme_tipi: string
  firma_id: string
}

const TIP_CFG = {
  gecikti:    { renk: 'bg-red-50 border-red-200',    ikon: AlertTriangle, ikonRenk: 'text-red-500',    etiket: 'Gecikmiş'     },
  bugun:      { renk: 'bg-orange-50 border-orange-200', ikon: Clock,      ikonRenk: 'text-orange-500', etiket: 'Bugün'        },
  yaklasıyor: { renk: 'bg-yellow-50 border-yellow-200', ikon: Bell,       ikonRenk: 'text-yellow-500', etiket: 'Yaklaşıyor'   },
}

interface Props {
  firmaId: string
  onNavigate?: (modul: string) => void
}

export default function Hatirlatici({ firmaId, onNavigate }: Props) {
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([])
  const [acik, setAcik]               = useState(false)
  const [okundu, setOkundu]           = useState<Set<string>>(new Set())

  const yukle = useCallback(async () => {
    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)
    const bugunStr = bugun.toISOString().split('T')[0]

    // 7 gün sonrasına kadar olan ödemeleri çek
    const yedi = new Date(bugun)
    yedi.setDate(yedi.getDate() + 7)
    const yediStr = yedi.toISOString().split('T')[0]

    const { data } = await supabase
      .from('odeme_plani')
      .select('id, odeme_tipi, aciklama, tutar, vade_tarihi, durum, firma_id, cek_no, cari_unvan')
      .eq('firma_id', firmaId)
      .in('durum', ['bekliyor', 'kismi'])
      .lte('vade_tarihi', yediStr)
      .order('vade_tarihi')

    if (!data) return

    const liste: Bildirim[] = data.map(r => {
      const vade = new Date(r.vade_tarihi)
      vade.setHours(0, 0, 0, 0)
      const fark = Math.floor((vade.getTime() - bugun.getTime()) / 86400000)

      let tip: Bildirim['tip']
      if (fark < 0)      tip = 'gecikti'
      else if (fark === 0) tip = 'bugun'
      else               tip = 'yaklasıyor'

      const tipLabel: Record<string, string> = {
        cek: 'Çek', cari: 'Cari', vergi: 'Vergi',
        sgk: 'SGK', maas: 'Maaş', diger: 'Diğer'
      }

      const detay = r.cek_no ? `Çek No: ${r.cek_no}` : r.cari_unvan ? r.cari_unvan : r.aciklama || ''

      return {
        id:          r.id,
        tip,
        baslik:      `${tipLabel[r.odeme_tipi] || r.odeme_tipi} — ${fmt(Number(r.tutar))}`,
        mesaj:       fark < 0
          ? `${Math.abs(fark)} gün gecikti${detay ? ' · ' + detay : ''}`
          : fark === 0
          ? `Bugün vadesi doluyor${detay ? ' · ' + detay : ''}`
          : `${fark} gün sonra vadesi doluyor${detay ? ' · ' + detay : ''}`,
        tutar:       Number(r.tutar),
        vade_tarihi: r.vade_tarihi,
        odeme_tipi:  r.odeme_tipi,
        firma_id:    r.firma_id,
      }
    })

    setBildirimler(liste)
  }, [firmaId])

  useEffect(() => {
    yukle()
    // Her 5 dakikada bir yenile
    const interval = setInterval(yukle, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [yukle])

  // Gecikmiş/bugün vadeli ödemeler için push bildirim
  useEffect(() => {
    if (bildirimler.length === 0) return
    import('@/lib/notifications').then(({ bildirimIzniVar, localBildirim }) => {
      if (!bildirimIzniVar()) return
      const geciktiList = bildirimler.filter(b => b.tip === 'gecikti')
      const bugunList   = bildirimler.filter(b => b.tip === 'bugun')
      if (geciktiList.length > 0) {
        localBildirim('⚠️ Gecikmiş Ödeme', `${geciktiList.length} ödemenin vadesi geçmiş!`)
      } else if (bugunList.length > 0) {
        localBildirim('🔔 Bugün Vadesi Dolan Ödeme', `${bugunList.length} ödeme bugün son gün!`)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bildirimler.length])
  const okunmamis = bildirimler.filter(b => !okundu.has(b.id))
  const gecikti   = bildirimler.filter(b => b.tip === 'gecikti').length
  const bugun     = bildirimler.filter(b => b.tip === 'bugun').length

  function hepsiniOku() {
    setOkundu(new Set(bildirimler.map(b => b.id)))
  }

  if (bildirimler.length === 0) return null

  return (
    <div className="relative">
      {/* Zil Butonu */}
      <button
        onClick={() => setAcik(v => !v)}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
        title="Hatırlatıcılar"
      >
        <Bell className={`w-5 h-5 ${okunmamis.length > 0 ? 'text-yellow-400' : 'text-slate-400'}`} />
        {okunmamis.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {okunmamis.length > 9 ? '9+' : okunmamis.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {acik && (
        <>
          {/* Arka plan kapama */}
          <div className="fixed inset-0 z-40" onClick={() => setAcik(false)} />

          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            {/* Başlık */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600" />
                <span className="font-semibold text-gray-900 text-sm">Hatırlatıcılar</span>
                {gecikti > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    {gecikti} gecikmiş
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {okunmamis.length > 0 && (
                  <button onClick={hepsiniOku} className="text-xs text-blue-600 hover:underline">
                    Tümünü oku
                  </button>
                )}
                <button onClick={() => setAcik(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bildirim Listesi */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {bildirimler.map(b => {
                const cfg  = TIP_CFG[b.tip]
                const Icon = cfg.ikon
                const isOkundu = okundu.has(b.id)
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      setOkundu(prev => new Set(Array.from(prev).concat(b.id)))
                      setAcik(false)
                      onNavigate?.('odeme-plani')
                    }}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${isOkundu ? 'opacity-60' : ''}`}
                  >
                    <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${cfg.renk}`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.ikonRenk}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{b.baslik}</p>
                        {!isOkundu && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{b.mesaj}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(b.vade_tarihi)}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                )
              })}
            </div>

            {/* Alt */}
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => { setAcik(false); onNavigate?.('odeme-plani') }}
                className="text-xs text-blue-600 hover:underline w-full text-center"
              >
                Tüm ödemeleri görüntüle →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
