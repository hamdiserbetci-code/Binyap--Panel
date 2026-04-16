'use client'
import React, { useEffect, useState } from 'react'
import { CheckCircle, Circle, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── KDV1 Kontrol Grupları ────────────────────────────────────
export const KDV1_KONTROLLER = [
  {
    grup: 'e-Fatura',
    renk: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: '🧾',
    kontroller: [
      { kodu: 'efatura_alis_kontrol',   adi: 'e-Fatura Alış — Kontrol Edildi mi?'   },
      { kodu: 'efatura_alis_luca',      adi: 'e-Fatura Alış — Luca\'ya İşlendi mi?' },
      { kodu: 'efatura_satis_kontrol',  adi: 'e-Fatura Satış — Kontrol Edildi mi?'  },
      { kodu: 'efatura_satis_luca',     adi: 'e-Fatura Satış — Luca\'ya İşlendi mi?'},
    ],
  },
  {
    grup: 'e-Arşiv',
    renk: 'indigo',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    icon: '📁',
    kontroller: [
      { kodu: 'earsiv_alis_kontrol',    adi: 'e-Arşiv Alış — Kontrol Edildi mi?'    },
      { kodu: 'earsiv_alis_luca',       adi: 'e-Arşiv Alış — Luca\'ya İşlendi mi?'  },
      { kodu: 'earsiv_satis_kontrol',   adi: 'e-Arşiv Satış — Kontrol Edildi mi?'   },
      { kodu: 'earsiv_satis_luca',      adi: 'e-Arşiv Satış — Luca\'ya İşlendi mi?' },
    ],
  },
  {
    grup: 'UTTS',
    renk: 'violet',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    icon: '🔗',
    kontroller: [
      { kodu: 'utts_alis_kontrol',      adi: 'UTTS Alış — Kontrol Edildi mi?'        },
      { kodu: 'utts_alis_luca',         adi: 'UTTS Alış — Luca\'ya İşlendi mi?'      },
    ],
  },
  {
    grup: 'Muhasebe Kontrolleri',
    renk: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    icon: '📊',
    kontroller: [
      { kodu: 'hesap_191_kontrol',      adi: '191 Hesabı Kontrolü Yapıldı mı?'       },
      { kodu: 'hesap_391_kontrol',      adi: '391 Hesabı Kontrolü Yapıldı mı?'       },
    ],
  },
]

interface Props {
  isId: string
  firmaId: string
}

export default function Kdv1Checklist({ isId, firmaId }: Props) {
  const [kayitlar, setKayitlar] = useState<Record<string, any>>({})
  const [loading, setLoading]   = useState(true)
  const [acikGrup, setAcikGrup] = useState<string | null>(null)

  const tumKontroller = KDV1_KONTROLLER.flatMap(g => g.kontroller)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('is_takibi_checklist')
      .select('*')
      .eq('is_id', isId)
    const map: Record<string, any> = {}
    ;(data || []).forEach(r => { map[r.kontrol_kodu] = r })
    setKayitlar(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [isId])

  async function toggle(kodu: string) {
    const mevcut = kayitlar[kodu]
    if (mevcut) {
      // Güncelle
      const yeniDurum = !mevcut.tamamlandi
      await supabase.from('is_takibi_checklist').update({
        tamamlandi: yeniDurum,
        tamamlanma_tarihi: yeniDurum ? new Date().toISOString() : null,
      }).eq('id', mevcut.id)
    } else {
      // Yeni kayıt
      await supabase.from('is_takibi_checklist').insert({
        is_id:    isId,
        firma_id: firmaId,
        kontrol_kodu: kodu,
        tamamlandi: true,
        tamamlanma_tarihi: new Date().toISOString(),
      })
    }
    load()
  }

  async function grupuTamamla(grup: typeof KDV1_KONTROLLER[0]) {
    const hepsiTamamlandi = grup.kontroller.every(k => kayitlar[k.kodu]?.tamamlandi)
    for (const k of grup.kontroller) {
      const mevcut = kayitlar[k.kodu]
      if (mevcut) {
        await supabase.from('is_takibi_checklist').update({
          tamamlandi: !hepsiTamamlandi,
          tamamlanma_tarihi: !hepsiTamamlandi ? new Date().toISOString() : null,
        }).eq('id', mevcut.id)
      } else if (!hepsiTamamlandi) {
        await supabase.from('is_takibi_checklist').insert({
          is_id: isId, firma_id: firmaId,
          kontrol_kodu: k.kodu, tamamlandi: true,
          tamamlanma_tarihi: new Date().toISOString(),
        })
      }
    }
    load()
  }

  const tamamlananSayi = tumKontroller.filter(k => kayitlar[k.kodu]?.tamamlandi).length
  const toplamSayi     = tumKontroller.length
  const yuzde          = Math.round((tamamlananSayi / toplamSayi) * 100)
  const hepsiTamam     = tamamlananSayi === toplamSayi

  if (loading) return (
    <div className="flex justify-center py-4">
      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Genel İlerleme */}
      <div className={`rounded-xl border-2 p-4 ${hepsiTamam ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {hepsiTamam
              ? <CheckCircle className="w-5 h-5 text-green-500" />
              : <AlertTriangle className="w-4 h-4 text-amber-500" />}
            <span className="font-semibold text-gray-900 text-sm">KDV1 Ön Kontrol Listesi</span>
          </div>
          <span className={`text-sm font-bold ${hepsiTamam ? 'text-green-600' : 'text-gray-600'}`}>
            {tamamlananSayi} / {toplamSayi}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${hepsiTamam ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${yuzde}%` }}
          />
        </div>
        {hepsiTamam && (
          <p className="text-xs text-green-600 font-medium mt-2 text-center">
            ✓ Tüm kontroller tamamlandı — Beyanname gönderilebilir
          </p>
        )}
      </div>

      {/* Kontrol Grupları */}
      {KDV1_KONTROLLER.map(grup => {
        const grupTamamlanan = grup.kontroller.filter(k => kayitlar[k.kodu]?.tamamlandi).length
        const grupToplam     = grup.kontroller.length
        const grupTamam      = grupTamamlanan === grupToplam
        const isAcik         = acikGrup === grup.grup

        return (
          <div key={grup.grup} className={`rounded-xl border-2 overflow-hidden transition-all ${grupTamam ? `${grup.bg} ${grup.border}` : 'bg-white border-gray-200'}`}>
            {/* Grup Başlık */}
            <button
              onClick={() => setAcikGrup(isAcik ? null : grup.grup)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{grup.icon}</span>
                <div className="text-left">
                  <span className={`font-semibold text-sm ${grupTamam ? grup.text : 'text-gray-900'}`}>
                    {grup.grup}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${grupTamam ? 'bg-green-500' : 'bg-blue-400'}`}
                        style={{ width: `${(grupTamamlanan / grupToplam) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{grupTamamlanan}/{grupToplam}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {grupTamam && <CheckCircle className="w-4 h-4 text-green-500" />}
                {/* Tümünü işaretle butonu */}
                <button
                  onClick={e => { e.stopPropagation(); grupuTamamla(grup) }}
                  className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                    grupTamam
                      ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      : `${grup.bg} ${grup.text} hover:opacity-80`
                  }`}
                >
                  {grupTamam ? 'Geri Al' : 'Tümünü İşaretle'}
                </button>
                {isAcik ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Kontrol Maddeleri */}
            {isAcik && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {grup.kontroller.map(k => {
                  const kayit    = kayitlar[k.kodu]
                  const tamam    = kayit?.tamamlandi === true
                  return (
                    <button
                      key={k.kodu}
                      onClick={() => toggle(k.kodu)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-all hover:bg-black/5 ${tamam ? 'bg-green-50/50' : 'bg-white'}`}
                    >
                      {tamam
                        ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        : <Circle      className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                      <span className={`text-sm flex-1 ${tamam ? 'text-green-700 line-through decoration-green-400' : 'text-gray-700'}`}>
                        {k.adi}
                      </span>
                      {tamam && kayit?.tamamlanma_tarihi && (
                        <span className="text-xs text-green-500 flex-shrink-0">
                          {new Date(kayit.tamamlanma_tarihi).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                      {!tamam && (
                        <span className="text-xs text-gray-400 flex-shrink-0">Tıkla →</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
