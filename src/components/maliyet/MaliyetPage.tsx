'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Maliyet, Firma, AY_LABELS } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Building2, BarChart2 } from 'lucide-react'

interface Props { userId: string; firma: Firma }

export default function MaliyetPage({ userId, firma }: Props) {
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [activeFirma, setActiveFirma] = useState<Firma | null>(null)
  const [maliyetler, setMaliyetler] = useState<Maliyet[]>([])
  const [tumYilMaliyet, setTumYilMaliyet] = useState<Maliyet[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Maliyet | null>(null)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1)
  const [gorunum, setGorunum] = useState<'aylik' | 'kumülatif'>('aylik')

  const emptyForm = {
    alis_faturalari:'', satis_faturalari:'', iscilik:'', onceki_donem_stok:'',
    diger_gelirler:'', diger_giderler:'', notlar:'',
    finansman_giderleri:'', sigorta_giderleri:'', amortisman_giderleri:'',
    genel_yonetim_giderleri:'', demirbaslar:'', devreden_stok:'',
    devreden_kdv:'', yillara_yaygin_satislar:'', yillara_yaygin_maliyetler:'',
    yyllara_yaygin_insaat_geliri:'', yillara_yaygin_insaat_maliyeti:'', yillara_yaygin_insaat_kar:''
  }
  const [form, setForm] = useState(emptyForm)

  const fetchFirmalar = useCallback(async () => {
    const { data } = await supabase.from('firmalar').select('*').order('ad')
    const list = data || []
    setFirmalar(list)
    const ana = list.find((f: Firma) => f.id === firma.id) || list[0]
    if (ana) setActiveFirma(ana)
  }, [firma.id])

  const fetchMaliyet = useCallback(async () => {
    if (!activeFirma) return
    setLoading(true)
    const { data: aylik } = await supabase.from('maliyet').select('*')
      .eq('firma_id', activeFirma.id).eq('yil', selectedYil).eq('ay', selectedAy)
    setMaliyetler(aylik || [])
    const { data: yillik } = await supabase.from('maliyet').select('*')
      .eq('firma_id', activeFirma.id).eq('yil', selectedYil).order('ay')
    setTumYilMaliyet(yillik || [])
    setLoading(false)
  }, [activeFirma, selectedYil, selectedAy])

  useEffect(() => { fetchFirmalar() }, [fetchFirmalar])
  useEffect(() => { fetchMaliyet() }, [fetchMaliyet])

  function openModal(m?: any) {
    setEditing(m || null)
    setForm(m ? {
      alis_faturalari: String(m.alis_faturalari||0),
      satis_faturalari: String(m.satis_faturalari||0),
      iscilik: String(m.iscilik||0),
      onceki_donem_stok: String(m.onceki_donem_stok||0),
      diger_gelirler: String(m.diger_gelirler||0),
      diger_giderler: String(m.diger_giderler||0),
      notlar: m.notlar || '',
      finansman_giderleri: String(m.finansman_giderleri||0),
      sigorta_giderleri: String(m.sigorta_giderleri||0),
      amortisman_giderleri: String(m.amortisman_giderleri||0),
      genel_yonetim_giderleri: String(m.genel_yonetim_giderleri||0),
      demirbaslar: String(m.demirbaslar||0),
      devreden_stok: String(m.devreden_stok||0),
      devreden_kdv: String(m.devreden_kdv||0),
      yillara_yaygin_satislar: String(m.yillara_yaygin_satislar||0),
      yillara_yaygin_maliyetler: String(m.yillara_yaygin_maliyetler||0),
      yyllara_yaygin_insaat_geliri: String((m as any).yyllara_yaygin_insaat_geliri||0),
      yillara_yaygin_insaat_maliyeti: String((m as any).yillara_yaygin_insaat_maliyeti||0),
      yillara_yaygin_insaat_kar: String((m as any).yillara_yaygin_insaat_kar||0),
    } : emptyForm)
    setModal(true)
  }

  const p = (v: string) => parseFloat(v) || 0

  async function handleSave() {
    if (!activeFirma) return
    const data = {
      yil: selectedYil, ay: selectedAy,
      alis_faturalari: p(form.alis_faturalari),
      satis_faturalari: p(form.satis_faturalari),
      iscilik: p(form.iscilik),
      onceki_donem_stok: p(form.onceki_donem_stok),
      diger_gelirler: p(form.diger_gelirler),
      diger_giderler: p(form.diger_giderler),
      finansman_giderleri: p(form.finansman_giderleri),
      sigorta_giderleri: p(form.sigorta_giderleri),
      amortisman_giderleri: p(form.amortisman_giderleri),
      genel_yonetim_giderleri: p(form.genel_yonetim_giderleri),
      demirbaslar: p(form.demirbaslar),
      devreden_stok: p(form.devreden_stok),
      devreden_kdv: p(form.devreden_kdv),
      yillara_yaygin_satislar: p(form.yillara_yaygin_satislar),
      yillara_yaygin_maliyetler: p(form.yillara_yaygin_maliyetler),
      yyllara_yaygin_insaat_geliri: p(form.yyllara_yaygin_insaat_geliri),
      yillara_yaygin_insaat_maliyeti: p(form.yillara_yaygin_insaat_maliyeti),
      yillara_yaygin_insaat_kar: p(form.yillara_yaygin_insaat_kar),
      notlar: form.notlar, firma_id: activeFirma.id, user_id: userId
    }
    if (editing) {
      await supabase.from('maliyet').update(data).eq('id', editing.id)
    } else {
      const { data: mevcut } = await supabase.from('maliyet').select('id')
        .eq('firma_id', activeFirma.id).eq('yil', selectedYil).eq('ay', selectedAy).single()
      if (mevcut) await supabase.from('maliyet').update(data).eq('id', mevcut.id)
      else await supabase.from('maliyet').insert(data)
    }
    setModal(false); fetchMaliyet()
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu maliyet kaydını silmek istediğinize emin misiniz?')) return
    await supabase.from('maliyet').delete().eq('id', id)
    fetchMaliyet()
  }

  const m = maliyetler[0]

  const toplamGelir = m ? m.satis_faturalari + m.diger_gelirler + (m as any).yillara_yaygin_satislar : 0
  const toplamGider = m ? m.alis_faturalari + m.iscilik + m.diger_giderler + m.onceki_donem_stok
    + ((m as any).finansman_giderleri||0) + ((m as any).sigorta_giderleri||0)
    + ((m as any).amortisman_giderleri||0) + ((m as any).genel_yonetim_giderleri||0)
    + ((m as any).demirbaslar||0) + ((m as any).devreden_stok||0)
    + ((m as any).yillara_yaygin_maliyetler||0) : 0
  const karZarar = toplamGelir - toplamGider
  const yillar = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  const kumAylar = tumYilMaliyet.filter(x => x.ay <= selectedAy)
  const kumGelir = kumAylar.reduce((s, x: any) => s + x.satis_faturalari + x.diger_gelirler + (x.yillara_yaygin_satislar||0), 0)
  const kumGider = kumAylar.reduce((s, x: any) => s + x.alis_faturalari + x.iscilik + x.diger_giderler + x.onceki_donem_stok
    + (x.finansman_giderleri||0) + (x.sigorta_giderleri||0) + (x.amortisman_giderleri||0)
    + (x.genel_yonetim_giderleri||0) + (x.demirbaslar||0) + (x.devreden_stok||0)
    + (x.yillara_yaygin_maliyetler||0), 0)
  const kumKarZarar = kumGelir - kumGider
  const yilGelir = tumYilMaliyet.reduce((s, x: any) => s + x.satis_faturalari + x.diger_gelirler + (x.yillara_yaygin_satislar||0), 0)
  const yilGider = tumYilMaliyet.reduce((s, x: any) => s + x.alis_faturalari + x.iscilik + x.diger_giderler + x.onceki_donem_stok
    + (x.finansman_giderleri||0) + (x.sigorta_giderleri||0) + (x.amortisman_giderleri||0)
    + (x.genel_yonetim_giderleri||0) + (x.demirbaslar||0) + (x.devreden_stok||0)
    + (x.yillara_yaygin_maliyetler||0), 0)
  const yilKarZarar = yilGelir - yilGider

  function fmt(val: number) {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
  }

  const detayRows = m ? [
    { label:'Satış Faturaları (E-Fatura)', value:(m as any).satis_faturalari, tip:'gelir' },
    { label:'Yıllara Yayılan Satışlar', value:(m as any).yillara_yaygin_satislar||0, tip:'gelir' },
    { label:'Diğer Gelirler', value:m.diger_gelirler, tip:'gelir' },
    { label:'Alış Faturaları (E-Fatura+E-Arşiv)', value:m.alis_faturalari, tip:'gider' },
    { label:'İşçilik Giderleri', value:m.iscilik, tip:'gider' },
    { label:'Önceki Dönem Stok', value:m.onceki_donem_stok, tip:'gider' },
    { label:'Finansman Giderleri', value:(m as any).finansman_giderleri||0, tip:'gider' },
    { label:'Sigorta Giderleri', value:(m as any).sigorta_giderleri||0, tip:'gider' },
    { label:'Amortisman Giderleri', value:(m as any).amortisman_giderleri||0, tip:'gider' },
    { label:'Genel Yönetim Giderleri', value:(m as any).genel_yonetim_giderleri||0, tip:'gider' },
    { label:'Demirbaşlar', value:(m as any).demirbaslar||0, tip:'gider' },
    { label:'Devreden Stok', value:(m as any).devreden_stok||0, tip:'gider' },
    { label:'Yıllara Yayılan Maliyetler', value:(m as any).yillara_yaygin_maliyetler||0, tip:'gider' },
    { label:'Diğer Giderler', value:m.diger_giderler, tip:'gider' },
    { label:'Devreden KDV', value:(m as any).devreden_kdv||0, tip:'bilgi' },
  ].filter(r => r.value !== 0) : []

  const insaatRows = m ? [
    { label:'Yıllara Yayılan İnşaat Geliri', value:(m as any).yyllara_yaygin_insaat_geliri||0, tip:'gelir' },
    { label:'Yıllara Yayılan İnşaat Maliyeti', value:(m as any).yillara_yaygin_insaat_maliyeti||0, tip:'gider' },
    { label:'Yıllara Yayılan İnşaat Kârı', value:(m as any).yillara_yaygin_insaat_kar||0, tip:'bilgi' },
  ].filter(r => r.value !== 0) : []

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 bg-white rounded-xl border border-slate-100 p-1.5">
        {firmalar.map(f => (
          <button key={f.id} onClick={() => setActiveFirma(f)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeFirma?.id === f.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
            <Building2 size={14}/> {f.ad}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Maliyet Kontrolü</h2>
          <p className="text-xs text-slate-400 mt-0.5">{activeFirma?.ad} — {AY_LABELS[selectedAy]} {selectedYil}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1">
            <button onClick={() => setGorunum('aylik')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${gorunum==='aylik'?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-700'}`}>Aylık</button>
            <button onClick={() => setGorunum('kumülatif')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${gorunum==='kumülatif'?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-700'}`}>
              <BarChart2 size={11}/> Kümülatif
            </button>
          </div>
          <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors">
            <Plus size={14}/> Maliyet Ekle
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none">
          {yillar.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {AY_LABELS.slice(1).map((ay, i) => (
            <button key={i+1} onClick={() => setSelectedAy(i+1)}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-medium transition-all ${selectedAy===i+1?'bg-blue-600 text-white':'bg-white border border-slate-200 text-slate-600'}`}>{ay}</button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> : (
        <>
          {gorunum === 'kumülatif' && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 mb-2">📊 Kümülatif — Ocak → {AY_LABELS[selectedAy]} {selectedYil} ({kumAylar.length} ay)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="bg-white rounded-xl border border-emerald-100 p-4">
                  <p className="text-xs text-slate-500 mb-1">Kümülatif Gelir</p>
                  <p className="text-base sm:text-xl font-bold text-emerald-600">{fmt(kumGelir)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{kumAylar.length} ay toplamı</p>
                </div>
                <div className="bg-white rounded-xl border border-red-100 p-4">
                  <p className="text-xs text-slate-500 mb-1">Kümülatif Gider</p>
                  <p className="text-base sm:text-xl font-bold text-red-500">{fmt(kumGider)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{kumAylar.length} ay toplamı</p>
                </div>
                <div className={`rounded-xl border p-4 ${kumKarZarar >= 0 ? 'bg-blue-600 border-blue-700' : 'bg-red-600 border-red-700'}`}>
                  <p className="text-xs text-white/80 mb-1">{kumKarZarar >= 0 ? 'Kümülatif Kâr' : 'Kümülatif Zarar'}</p>
                  <p className="text-base sm:text-xl font-bold text-white">{fmt(Math.abs(kumKarZarar))}</p>
                  <p className="text-[10px] text-white/60 mt-1">{kumAylar.length} ay toplamı</p>
                </div>
              </div>
              {tumYilMaliyet.length > 0 && (
                <div className="bg-slate-800 rounded-xl p-4 mb-3">
                  <p className="text-xs text-slate-400 mb-2">📅 {selectedYil} Yıllık Toplam ({tumYilMaliyet.length} ay)</p>
                  <div className="flex flex-wrap gap-3 items-end justify-between">
                    <div><p className="text-[10px] text-slate-500">Gelir</p><p className="text-sm font-semibold text-emerald-400">{fmt(yilGelir)}</p></div>
                    <div><p className="text-[10px] text-slate-500">Gider</p><p className="text-sm font-semibold text-red-400">{fmt(yilGider)}</p></div>
                    <div className="text-right"><p className="text-[10px] text-slate-400">Net</p><p className={`text-lg font-bold ${yilKarZarar >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(yilKarZarar)}</p></div>
                  </div>
                </div>
              )}
              {tumYilMaliyet.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                  <div className="grid grid-cols-5 gap-1 px-2 sm:px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] sm:text-xs font-medium text-slate-500">
                    <div>Ay</div><div className="text-right">Gelir</div><div className="text-right">Gider</div><div className="text-right">Kâr/Zarar</div><div className="text-right">Kümülatif</div>
                  </div>
                  {(() => {
                    let kumTotal = 0
                    return tumYilMaliyet.filter(x => x.ay <= selectedAy).map((x: any, i) => {
                      const gelir = x.satis_faturalari + x.diger_gelirler + (x.yillara_yaygin_satislar||0)
                      const gider = x.alis_faturalari + x.iscilik + x.diger_giderler + x.onceki_donem_stok
                        + (x.finansman_giderleri||0) + (x.sigorta_giderleri||0) + (x.amortisman_giderleri||0)
                        + (x.genel_yonetim_giderleri||0) + (x.demirbaslar||0) + (x.devreden_stok||0)
                        + (x.yillara_yaygin_maliyetler||0)
                      const net = gelir - gider
                      kumTotal += net
                      return (
                        <div key={x.id} className={`grid grid-cols-5 gap-1 px-2 sm:px-4 py-2 border-b border-slate-50 last:border-0 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${x.ay === selectedAy ? 'ring-1 ring-inset ring-blue-200' : ''}`}>
                          <div className="text-slate-700 font-medium">{AY_LABELS[x.ay]}</div>
                          <div className="text-right text-emerald-600 font-medium">{fmt(gelir)}</div>
                          <div className="text-right text-red-500">{fmt(gider)}</div>
                          <div className={`text-right font-medium ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(net)}</div>
                          <div className={`text-right font-bold ${kumTotal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(kumTotal)}</div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          )}

          {gorunum === 'aylik' && (
            <>
              {!m ? (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
                  <TrendingUp size={40} className="text-slate-200 mx-auto mb-3"/>
                  <p className="text-slate-400 text-sm mb-3">Bu dönem için maliyet kaydı yok</p>
                  <button onClick={() => openModal()} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">Maliyet Ekle</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="bg-white rounded-xl border border-slate-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><TrendingUp size={16} className="text-emerald-600"/></div>
                        <p className="text-xs text-slate-500">Toplam Gelir</p>
                      </div>
                      <p className="text-lg sm:text-2xl font-bold text-emerald-600">{fmt(toplamGelir)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><TrendingDown size={16} className="text-red-500"/></div>
                        <p className="text-xs text-slate-500">Toplam Gider</p>
                      </div>
                      <p className="text-lg sm:text-2xl font-bold text-red-500">{fmt(toplamGider)}</p>
                    </div>
                    <div className={`rounded-xl border p-4 ${karZarar >= 0 ? 'bg-blue-600 border-blue-700' : 'bg-red-600 border-red-700'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                          {karZarar >= 0 ? <TrendingUp size={16} className="text-white"/> : <TrendingDown size={16} className="text-white"/>}
                        </div>
                        <p className="text-xs text-white/80">{karZarar >= 0 ? 'Net Kâr' : 'Net Zarar'}</p>
                      </div>
                      <p className="text-lg sm:text-2xl font-bold text-white">{fmt(Math.abs(karZarar))}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">Detay</p>
                      <div className="flex gap-2">
                        <button onClick={() => openModal(m)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Pencil size={11}/> Düzenle</button>
                        <button onClick={() => handleDelete(m.id)} className="flex items-center gap-1 text-xs text-red-500 hover:underline"><Trash2 size={11}/> Sil</button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {detayRows.map(row => (
                        <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.tip==='gelir'?'bg-emerald-400':row.tip==='bilgi'?'bg-blue-400':'bg-red-400'}`}/>
                            <span className="text-sm text-slate-600">{row.label}</span>
                          </div>
                          <span className={`text-sm font-medium ${row.tip==='gelir'?'text-emerald-600':row.tip==='bilgi'?'text-blue-600':'text-red-500'}`}>
                            {row.tip==='bilgi'?'':row.tip==='gelir'?'+':'-'}{row.value.toLocaleString('tr-TR')} ₺
                          </span>
                        </div>
                      ))}
                      {(m as any).devreden_kdv > 0 && (
                        <div className="px-4 py-2.5 bg-blue-50 flex items-center justify-between">
                          <span className="text-sm text-blue-700">Devreden KDV</span>
                          <span className="text-sm font-medium text-blue-700">{fmt((m as any).devreden_kdv)}</span>
                        </div>
                      )}
                      {insaatRows.length > 0 && (
                        <>
                          <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                            <p className="text-xs font-semibold text-amber-700">🏗️ Yıllara Yaygın İnşaat</p>
                          </div>
                          {insaatRows.map(row => (
                            <div key={row.label} className="flex items-center justify-between px-4 py-2.5 bg-amber-50/50">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.tip==='gelir'?'bg-emerald-400':row.tip==='bilgi'?'bg-amber-400':'bg-red-400'}`}/>
                                <span className="text-sm text-slate-600">{row.label}</span>
                              </div>
                              <span className={`text-sm font-medium ${row.tip==='gelir'?'text-emerald-600':row.tip==='bilgi'?'text-amber-600':'text-red-500'}`}>
                                {row.value.toLocaleString('tr-TR')} ₺
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                      {m.notlar && <div className="px-4 py-3 bg-slate-50"><p className="text-xs text-slate-500">📌 {m.notlar}</p></div>}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {modal && (
        <Modal title={editing ? 'Maliyet Düzenle' : 'Maliyet Ekle'} onClose={() => setModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">📅 {activeFirma?.ad} — {AY_LABELS[selectedAy]} {selectedYil}</p>

            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">📈 GELİRLER</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Satış Faturaları (₺)"><input type="number" className={inputCls} value={form.satis_faturalari} onChange={e=>setForm({...form,satis_faturalari:e.target.value})} placeholder="0"/></FormField>
              <FormField label="Yıllara Yayılan Satışlar (₺)"><input type="number" className={inputCls} value={form.yillara_yaygin_satislar} onChange={e=>setForm({...form,yillara_yaygin_satislar:e.target.value})} placeholder="0"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Diğer Gelirler (₺)"><input type="number" className={inputCls} value={form.diger_gelirler} onChange={e=>setForm({...form,diger_gelirler:e.target.value})} placeholder="0"/></FormField>
            </div>

            <p className="text-xs font-semibold text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">📉 GİDERLER</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Alış Faturaları (₺)"><input type="number" className={inputCls} value={form.alis_faturalari} onChange={e=>setForm({...form,alis_faturalari:e.target.value})} placeholder="0"/></FormField>
              <FormField label="İşçilik Giderleri (₺)"><input type="number" className={inputCls} value={form.iscilik} onChange={e=>setForm({...form,iscilik:e.target.value})} placeholder="0"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Önceki Dönem Stok (₺)"><input type="number" className={inputCls} value={form.onceki_donem_stok} onChange={e=>setForm({...form,onceki_donem_stok:e.target.value})} placeholder="0"/></FormField>
              <FormField label="Finansman Giderleri (₺)"><input type="number" className={inputCls} value={form.finansman_giderleri} onChange={e=>setForm({...form,finansman_giderleri:e.target.value})} placeholder="0"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Sigorta Giderleri (₺)"><input type="number" className={inputCls} value={form.sigorta_giderleri} onChange={e=>setForm({...form,sigorta_giderleri:e.target.value})} placeholder="0"/></FormField>
              <FormField label="Amortisman Giderleri (₺)"><input type="number" className={inputCls} value={form.amortisman_giderleri} onChange={e=>setForm({...form,amortisman_giderleri:e.target.value})} placeholder="0"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Genel Yönetim Giderleri (₺)"><input type="number" className={inputCls} value={form.genel_yonetim_giderleri} onChange={e=>setForm({...form,genel_yonetim_giderleri:e.target.value})} placeholder="0"/></FormField>
              <FormField label="Demirbaşlar (₺)"><input type="number" className={inputCls} value={form.demirbaslar} onChange={e=>setForm({...form,demirbaslar:e.target.value})} placeholder="0"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Devreden Stok (₺)"><input type="number" className={inputCls} value={form.devreden_stok} onChange={e=>setForm({...form,devreden_stok:e.target.value})} placeholder="0"/></FormField>
              <FormField label="Yıllara Yayılan Maliyetler (₺)"><input type="number" className={inputCls} value={form.yillara_yaygin_maliyetler} onChange={e=>setForm({...form,yillara_yaygin_maliyetler:e.target.value})} placeholder="0"/></FormField>
            </div>
            <FormField label="Diğer Giderler (₺)"><input type="number" className={inputCls} value={form.diger_giderler} onChange={e=>setForm({...form,diger_giderler:e.target.value})} placeholder="0"/></FormField>

            <p className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">📋 DİĞER BİLGİLER</p>
            <FormField label="Devreden KDV (₺)"><input type="number" className={inputCls} value={form.devreden_kdv} onChange={e=>setForm({...form,devreden_kdv:e.target.value})} placeholder="0"/></FormField>

            <p className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">🏗️ YILLARA YAYGIN İNŞAAT</p>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="İnşaat Geliri (₺)"><input type="number" className={inputCls} value={form.yyllara_yaygin_insaat_geliri} onChange={e=>setForm({...form,yyllara_yaygin_insaat_geliri:e.target.value})} placeholder="0"/></FormField>
              <FormField label="İnşaat Maliyeti (₺)"><input type="number" className={inputCls} value={form.yillara_yaygin_insaat_maliyeti} onChange={e=>setForm({...form,yillara_yaygin_insaat_maliyeti:e.target.value})} placeholder="0"/></FormField>
              <FormField label="İnşaat Kârı (₺)"><input type="number" className={inputCls} value={form.yillara_yaygin_insaat_kar} onChange={e=>setForm({...form,yillara_yaygin_insaat_kar:e.target.value})} placeholder="0"/></FormField>
            </div>
            <FormField label="Notlar"><input className={inputCls} value={form.notlar} onChange={e=>setForm({...form,notlar:e.target.value})} placeholder="Opsiyonel not"/></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
