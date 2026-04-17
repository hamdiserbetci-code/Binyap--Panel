'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Plus, Edit, Trash2, ChevronDown, ChevronRight, BarChart2, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, Modal, Btn, Field, inputCls, ConfirmDialog, fmt } from '@/components/ui'
import type { AppCtx } from '@/app/page'

//  Ay listesi 
const AYLAR = ['Ocak','Subat','Mart','Nisan','Mayis','Haziran','Temmuz','Agustos','Eylul','Ekim','Kasim','Aralik']

const emptyForm = {
  yil: new Date().getFullYear().toString(),
  ay: (new Date().getMonth() + 1).toString(),
  // GELİRLER
  hakedisler:        '0',
  diger_satislar:    '0',
  // DONEM BASI STOK
  donem_basi_stok:   '0',
  // GİDERLER
  malzeme_alis:      '0',
  iscilik:           '0',
  // GENEL YÖNETİM GİDERLERİ
  finans_gideri:     '0',
  sigorta_gideri:    '0',
  amortisman:        '0',
  diger_giderler:    '0',
  // Devir (otomatik dolar)
  onceki_donem_devir: '0',
  notlar: '',
}

type Form = typeof emptyForm

function hesapla(f: Form) {
  const hakedisler     = Number(f.hakedisler     || 0)
  const digerSatislar  = Number(f.diger_satislar || 0)
  const toplamGelir    = hakedisler + digerSatislar

  const donemBasiStok  = Number(f.donem_basi_stok || 0)
  const malzemeAlis    = Number(f.malzeme_alis    || 0)
  const iscilik        = Number(f.iscilik         || 0)
  const toplamUretimGider = donemBasiStok + malzemeAlis + iscilik

  const finansGideri   = Number(f.finans_gideri  || 0)
  const sigortaGideri  = Number(f.sigorta_gideri || 0)
  const amortisman     = Number(f.amortisman     || 0)
  const digerGiderler  = Number(f.diger_giderler || 0)
  const toplamGenelGider = finansGideri + sigortaGideri + amortisman + digerGiderler

  const toplamGider    = toplamUretimGider + toplamGenelGider
  const oncekiDevir    = Number(f.onceki_donem_devir || 0)
  const brutKarZarar   = toplamGelir - toplamGider
  const netKarZarar    = brutKarZarar + oncekiDevir

  return {
    hakedisler, digerSatislar, toplamGelir,
    donemBasiStok, malzemeAlis, iscilik, toplamUretimGider,
    finansGideri, sigortaGideri, amortisman, digerGiderler, toplamGenelGider,
    toplamGider, oncekiDevir, brutKarZarar, netKarZarar,
  }
}

export default function KarZararModule({ firma }: AppCtx) {
  const [data, setData]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState<any|null>(null)
  const [delId, setDelId]     = useState<string|null>(null)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState<Form>(emptyForm)
  const [acikAy, setAcikAy]   = useState<string|null>(null)
  const [yilF, setYilF]       = useState(new Date().getFullYear().toString())

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase.from('kar_zarar').select('*')
      .eq('firma_id', firma.id).order('yil', { ascending: false }).order('ay', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const yillar = useMemo(() => [...new Set(data.map(r => r.yil || new Date(r.donem||'').getFullYear()).filter(Boolean))].sort((a,b)=>b-a), [data])
  const filtreliData = useMemo(() => data.filter(r => String(r.yil || new Date(r.donem||'').getFullYear()) === yilF), [data, yilF])

  // Yillik ozet
  const yillikOzet = useMemo(() => {
    return filtreliData.reduce((acc, r) => {
      const h = hesapla({
        hakedisler: String(r.hakedisler||0), diger_satislar: String(r.diger_satislar||r.diger_gelirler||0),
        donem_basi_stok: String(r.donem_basi_stok||0), malzeme_alis: String(r.malzeme_alis||r.malzeme_giderleri||0),
        iscilik: String(r.iscilik||r.iscilik_giderleri||0), finans_gideri: String(r.finans_gideri||r.finans_giderleri||0),
        sigorta_gideri: String(r.sigorta_gideri||0), amortisman: String(r.amortisman||0),
        diger_giderler: String(r.diger_giderler||0), onceki_donem_devir: String(r.onceki_donem_devir||0),
        yil:'', ay:'', notlar:'',
      })
      acc.gelir  += h.toplamGelir
      acc.gider  += h.toplamGider
      acc.net    += h.brutKarZarar
      return acc
    }, { gelir: 0, gider: 0, net: 0 })
  }, [filtreliData])

  function openNew() {
    // Son ayin net karini devir olarak al
    const sonAy = data[0]
    let devir = '0'
    if (sonAy) {
      const h = hesapla({
        hakedisler: String(sonAy.hakedisler||0), diger_satislar: String(sonAy.diger_satislar||sonAy.diger_gelirler||0),
        donem_basi_stok: String(sonAy.donem_basi_stok||0), malzeme_alis: String(sonAy.malzeme_alis||sonAy.malzeme_giderleri||0),
        iscilik: String(sonAy.iscilik||sonAy.iscilik_giderleri||0), finans_gideri: String(sonAy.finans_gideri||sonAy.finans_giderleri||0),
        sigorta_gideri: String(sonAy.sigorta_gideri||0), amortisman: String(sonAy.amortisman||0),
        diger_giderler: String(sonAy.diger_giderler||0), onceki_donem_devir: String(sonAy.onceki_donem_devir||0),
        yil:'', ay:'', notlar:'',
      })
      devir = String(h.netKarZarar)
    }
    setForm({ ...emptyForm, onceki_donem_devir: devir })
    setEditing(null); setModal(true)
  }

  function openEdit(r: any) {
    setForm({
      yil: String(r.yil || new Date(r.donem||'').getFullYear() || new Date().getFullYear()),
      ay:  String(r.ay  || new Date(r.donem||'').getMonth()+1  || 1),
      hakedisler:         String(r.hakedisler        || 0),
      diger_satislar:     String(r.diger_satislar    || r.diger_gelirler || 0),
      donem_basi_stok:    String(r.donem_basi_stok   || 0),
      malzeme_alis:       String(r.malzeme_alis       || r.malzeme_giderleri || 0),
      iscilik:            String(r.iscilik            || r.iscilik_giderleri || 0),
      finans_gideri:      String(r.finans_gideri      || r.finans_giderleri  || 0),
      sigorta_gideri:     String(r.sigorta_gideri     || 0),
      amortisman:         String(r.amortisman         || 0),
      diger_giderler:     String(r.diger_giderler     || 0),
      onceki_donem_devir: String(r.onceki_donem_devir || 0),
      notlar:             r.notlar || '',
    })
    setEditing(r); setModal(true)
  }

  async function save() {
    setSaving(true)
    const h = hesapla(form)
    const payload = {
      firma_id: firma.id,
      yil: Number(form.yil), ay: Number(form.ay),
      donem: `${form.yil}-${String(form.ay).padStart(2,'0')}`,
      hakedisler:         Number(form.hakedisler        || 0),
      diger_satislar:     Number(form.diger_satislar    || 0),
      donem_basi_stok:    Number(form.donem_basi_stok   || 0),
      malzeme_alis:       Number(form.malzeme_alis       || 0),
      iscilik:            Number(form.iscilik            || 0),
      finans_gideri:      Number(form.finans_gideri      || 0),
      sigorta_gideri:     Number(form.sigorta_gideri     || 0),
      amortisman:         Number(form.amortisman         || 0),
      diger_giderler:     Number(form.diger_giderler     || 0),
      onceki_donem_devir: Number(form.onceki_donem_devir || 0),
      net_kar_zarar:      h.netKarZarar,
      notlar: form.notlar || null,
    }
    if (editing) { await supabase.from('kar_zarar').update(payload).eq('id', editing.id) }
    else { await supabase.from('kar_zarar').insert(payload) }
    setSaving(false); setModal(false); load()
  }

  const sf = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const formH = hesapla(form)
  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-emerald-600" /></span>
            Kar / Zarar
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 ml-10">Aylik gelir-gider takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={yilF} onChange={e => setYilF(e.target.value)} className={inputCls + ' w-auto'}>
            {yillar.map(y => <option key={y} value={String(y)}>{y}</option>)}
            {!yillar.includes(Number(yilF)) && <option value={yilF}>{yilF}</option>}
          </select>
          <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Ay</Btn>
        </div>
      </div>

      {/* Yillik Ozet Kartlar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-2xl border border-green-200 p-5">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Toplam Gelir</p>
          <p className="text-2xl font-bold text-green-700">{fmt(yillikOzet.gelir)}</p>
          <p className="text-xs text-green-500 mt-1">{yilF} yili toplami</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Toplam Gider</p>
          <p className="text-2xl font-bold text-red-700">{fmt(yillikOzet.gider)}</p>
          <p className="text-xs text-red-500 mt-1">{yilF} yili toplami</p>
        </div>
        <div className={`rounded-2xl border p-5 ${yillikOzet.net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${yillikOzet.net >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
            {yillikOzet.net >= 0 ? 'Net Kar' : 'Net Zarar'}
          </p>
          <p className={`text-2xl font-bold ${yillikOzet.net >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{fmt(Math.abs(yillikOzet.net))}</p>
          <p className={`text-xs mt-1 ${yillikOzet.net >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>{yilF} yili net sonucu</p>
        </div>
      </div>

      {/* Grafik - basit bar chart */}
      {filtreliData.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Aylik Gelir / Gider Grafigi</p>
          <div className="flex items-end gap-2 h-32 overflow-x-auto">
            {[...filtreliData].reverse().map(r => {
              const h = hesapla({
                hakedisler: String(r.hakedisler||0), diger_satislar: String(r.diger_satislar||r.diger_gelirler||0),
                donem_basi_stok: String(r.donem_basi_stok||0), malzeme_alis: String(r.malzeme_alis||r.malzeme_giderleri||0),
                iscilik: String(r.iscilik||r.iscilik_giderleri||0), finans_gideri: String(r.finans_gideri||r.finans_giderleri||0),
                sigorta_gideri: String(r.sigorta_gideri||0), amortisman: String(r.amortisman||0),
                diger_giderler: String(r.diger_giderler||0), onceki_donem_devir: String(r.onceki_donem_devir||0),
                yil:'', ay:'', notlar:'',
              })
              const maxVal = Math.max(...filtreliData.map(x => Math.max(
                Number(x.hakedisler||0)+Number(x.diger_satislar||x.diger_gelirler||0),
                Number(x.malzeme_alis||x.malzeme_giderleri||0)+Number(x.iscilik||x.iscilik_giderleri||0)+Number(x.finans_gideri||x.finans_giderleri||0)+Number(x.sigorta_gideri||0)+Number(x.amortisman||0)+Number(x.diger_giderler||0)
              )), 1)
              const gelirH = Math.max(4, Math.round((h.toplamGelir / maxVal) * 112))
              const giderH = Math.max(4, Math.round((h.toplamGider / maxVal) * 112))
              const ay = r.ay || (new Date(r.donem||'').getMonth()+1)
              return (
                <div key={r.id} className="flex flex-col items-center gap-1 flex-shrink-0 w-12">
                  <div className="flex items-end gap-0.5 h-28">
                    <div className="w-4 bg-green-400 rounded-t" style={{ height: gelirH }} title={`Gelir: ${fmt(h.toplamGelir)}`} />
                    <div className="w-4 bg-red-400 rounded-t" style={{ height: giderH }} title={`Gider: ${fmt(h.toplamGider)}`} />
                  </div>
                  <span className="text-xs text-gray-400">{AYLAR[Number(ay)-1]?.slice(0,3)}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-400 rounded" /><span className="text-xs text-gray-500">Gelir</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded" /><span className="text-xs text-gray-500">Gider</span></div>
          </div>
        </Card>
      )}

      {/* Aylik Tablo */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtreliData.length === 0 ? (
        <Card className="p-12 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Henuz kayit yok. "Yeni Ay" ile baslayabilirsiniz.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtreliData.map(r => {
            const h = hesapla({
              hakedisler: String(r.hakedisler||0), diger_satislar: String(r.diger_satislar||r.diger_gelirler||0),
              donem_basi_stok: String(r.donem_basi_stok||0), malzeme_alis: String(r.malzeme_alis||r.malzeme_giderleri||0),
              iscilik: String(r.iscilik||r.iscilik_giderleri||0), finans_gideri: String(r.finans_gideri||r.finans_giderleri||0),
              sigorta_gideri: String(r.sigorta_gideri||0), amortisman: String(r.amortisman||0),
              diger_giderler: String(r.diger_giderler||0), onceki_donem_devir: String(r.onceki_donem_devir||0),
              yil:'', ay:'', notlar:'',
            })
            const ay = r.ay || (new Date(r.donem||'').getMonth()+1)
            const ayAdi = AYLAR[Number(ay)-1] || r.donem
            const acik = acikAy === r.id
            return (
              <Card key={r.id} className="overflow-hidden">
                {/* Ay Baslik Satiri */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setAcikAy(acik ? null : r.id)}>
                  <button className="text-gray-400">{acik ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="flex-1">
                    <span className="font-bold text-gray-900">{ayAdi} {r.yil || new Date(r.donem||'').getFullYear()}</span>
                    {r.onceki_donem_devir !== 0 && r.onceki_donem_devir && (
                      <span className="ml-2 text-xs text-gray-400">Devir: {fmt(Number(r.onceki_donem_devir))}</span>
                    )}
                  </div>
                  {/* Mini ozet */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Gelir</p>
                      <p className="font-semibold text-green-600">{fmt(h.toplamGelir)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Gider</p>
                      <p className="font-semibold text-red-500">{fmt(h.toplamGider)}</p>
                    </div>
                    <div className={`text-right px-3 py-1 rounded-lg ${h.netKarZarar >= 0 ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                      <p className="text-xs text-gray-400">{h.netKarZarar >= 0 ? 'Net Kar' : 'Net Zarar'}</p>
                      <p className={`font-bold ${h.netKarZarar >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>{fmt(Math.abs(h.netKarZarar))}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={e => { e.stopPropagation(); openEdit(r) }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit className="w-4 h-4" /></button>
                    <button onClick={e => { e.stopPropagation(); setDelId(r.id) }} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Detay */}
                {acik && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Gelirler */}
                      <div>
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />Gelirler</p>
                        <div className="space-y-2">
                          <SatirItem label="Hakedisler" deger={h.hakedisler} renk="green" />
                          <SatirItem label="Diger Satislar" deger={h.digerSatislar} renk="green" />
                          <div className="border-t border-green-200 pt-2 mt-2">
                            <SatirItem label="TOPLAM GELİR" deger={h.toplamGelir} renk="green" bold />
                          </div>
                        </div>
                      </div>

                      {/* Giderler */}
                      <div>
                        <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" />Giderler</p>
                        <div className="space-y-2">
                          <SatirItem label="Donem Basi Stok" deger={h.donemBasiStok} renk="red" />
                          <SatirItem label="Malzeme Alislari" deger={h.malzemeAlis} renk="red" />
                          <SatirItem label="Iscilik" deger={h.iscilik} renk="red" />
                          <div className="border-t border-red-200 pt-2 mt-2">
                            <SatirItem label="Uretim Giderleri" deger={h.toplamUretimGider} renk="red" />
                          </div>
                          <div className="mt-3 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500 mb-2">Genel Yonetim Giderleri</p>
                            <SatirItem label="Finans Giderleri" deger={h.finansGideri} renk="red" />
                            <SatirItem label="Sigorta Giderleri" deger={h.sigortaGideri} renk="red" />
                            <SatirItem label="Amortisman" deger={h.amortisman} renk="red" />
                            <SatirItem label="Diger Giderler" deger={h.digerGiderler} renk="red" />
                          </div>
                          <div className="border-t border-red-200 pt-2 mt-2">
                            <SatirItem label="TOPLAM GİDER" deger={h.toplamGider} renk="red" bold />
                          </div>
                        </div>
                      </div>

                      {/* Sonuc */}
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5" />Sonuc</p>
                        <div className="space-y-3">
                          <div className={`rounded-xl p-4 ${h.brutKarZarar >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <p className="text-xs text-gray-500 mb-1">Donem Kar / Zarar</p>
                            <p className={`text-xl font-bold ${h.brutKarZarar >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(Math.abs(h.brutKarZarar))}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{h.brutKarZarar >= 0 ? 'Kar' : 'Zarar'}</p>
                          </div>
                          {h.oncekiDevir !== 0 && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <ArrowRight className="w-4 h-4" />
                              <span>Onceki Donem Devir: <span className={h.oncekiDevir >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>{fmt(h.oncekiDevir)}</span></span>
                            </div>
                          )}
                          <div className={`rounded-xl p-4 ${h.netKarZarar >= 0 ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-orange-50 border-2 border-orange-300'}`}>
                            <p className="text-xs text-gray-500 mb-1">NET SONUC</p>
                            <p className={`text-2xl font-bold ${h.netKarZarar >= 0 ? 'text-emerald-700' : 'text-orange-600'}`}>{fmt(Math.abs(h.netKarZarar))}</p>
                            <p className={`text-xs font-semibold mt-0.5 ${h.netKarZarar >= 0 ? 'text-emerald-600' : 'text-orange-500'}`}>{h.netKarZarar >= 0 ? 'NET KAR' : 'NET ZARAR'}</p>
                          </div>
                          {r.notlar && <p className="text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">{r.notlar}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Veri Giris Modal */}
      {modal && (
        <Modal title={editing ? 'Ay Duzenle' : 'Yeni Ay Kaydı'} onClose={() => setModal(false)} size="xl"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>Iptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-6">
            {/* Donem */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Yil" required>
                <input type="number" value={form.yil} onChange={sf('yil')} className={inputCls} min="2020" max="2030" />
              </Field>
              <Field label="Ay" required>
                <select value={form.ay} onChange={sf('ay')} className={inputCls}>
                  {AYLAR.map((a,i) => <option key={i+1} value={i+1}>{a}</option>)}
                </select>
              </Field>
            </div>

            {/* Onceki Donem Devir */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-xs font-semibold text-blue-700 mb-2">Onceki Donem Devri (Otomatik)</p>
              <input type="number" step="0.01" value={form.onceki_donem_devir} onChange={sf('onceki_donem_devir')} className={inputCls} />
              <p className="text-xs text-blue-500 mt-1">Bir onceki ayin net kar/zarari otomatik aktarilir. Degistirebilirsiniz.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gelirler */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <p className="text-sm font-bold text-green-700 mb-3 flex items-center gap-1"><TrendingUp className="w-4 h-4" />Gelirler</p>
                <div className="space-y-3">
                  <Field label="Hakedisler (TL)">
                    <input type="number" step="0.01" value={form.hakedisler} onChange={sf('hakedisler')} className={inputCls} />
                  </Field>
                  <Field label="Diger Satislar (TL)">
                    <input type="number" step="0.01" value={form.diger_satislar} onChange={sf('diger_satislar')} className={inputCls} />
                  </Field>
                  <div className="bg-green-100 rounded-lg px-3 py-2 flex justify-between">
                    <span className="text-sm font-semibold text-green-700">Toplam Gelir</span>
                    <span className="text-sm font-bold text-green-700">{fmt(formH.toplamGelir)}</span>
                  </div>
                </div>
              </div>

              {/* Giderler */}
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <p className="text-sm font-bold text-red-600 mb-3 flex items-center gap-1"><TrendingDown className="w-4 h-4" />Giderler</p>
                <div className="space-y-3">
                  <Field label="Donem Basi Stok (TL)">
                    <input type="number" step="0.01" value={form.donem_basi_stok} onChange={sf('donem_basi_stok')} className={inputCls} />
                  </Field>
                  <Field label="Malzeme Alislari (TL)">
                    <input type="number" step="0.01" value={form.malzeme_alis} onChange={sf('malzeme_alis')} className={inputCls} />
                  </Field>
                  <Field label="Iscilik Giderleri (TL)">
                    <input type="number" step="0.01" value={form.iscilik} onChange={sf('iscilik')} className={inputCls} />
                  </Field>
                  <p className="text-xs font-semibold text-gray-500 pt-1">Genel Yonetim Giderleri</p>
                  <Field label="Finans Giderleri (TL)">
                    <input type="number" step="0.01" value={form.finans_gideri} onChange={sf('finans_gideri')} className={inputCls} />
                  </Field>
                  <Field label="Sigorta Giderleri (TL)">
                    <input type="number" step="0.01" value={form.sigorta_gideri} onChange={sf('sigorta_gideri')} className={inputCls} />
                  </Field>
                  <Field label="Amortisman (TL)">
                    <input type="number" step="0.01" value={form.amortisman} onChange={sf('amortisman')} className={inputCls} />
                  </Field>
                  <Field label="Diger Giderler (TL)">
                    <input type="number" step="0.01" value={form.diger_giderler} onChange={sf('diger_giderler')} className={inputCls} />
                  </Field>
                  <div className="bg-red-100 rounded-lg px-3 py-2 flex justify-between">
                    <span className="text-sm font-semibold text-red-600">Toplam Gider</span>
                    <span className="text-sm font-bold text-red-600">{fmt(formH.toplamGider)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Canli Sonuc */}
            <div className={`rounded-xl p-4 border-2 ${formH.netKarZarar >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-orange-50 border-orange-300'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Net Sonuc (Canli)</p>
                  <p className={`text-3xl font-bold mt-1 ${formH.netKarZarar >= 0 ? 'text-emerald-700' : 'text-orange-600'}`}>{fmt(Math.abs(formH.netKarZarar))}</p>
                </div>
                <div className={`text-4xl ${formH.netKarZarar >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {formH.netKarZarar >= 0 ? '' : ''}
                </div>
              </div>
              <p className={`text-sm font-semibold mt-2 ${formH.netKarZarar >= 0 ? 'text-emerald-600' : 'text-orange-500'}`}>
                {formH.netKarZarar >= 0 ? 'Bu ay kar elde ediyorsunuz' : 'Bu ay zararda bulunuyorsunuz'}
              </p>
            </div>

            <Field label="Notlar">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} placeholder="Bu aya ait notlar..." />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu ay kaydini silmek istediginize emin misiniz?"
          onConfirm={async () => { await supabase.from('kar_zarar').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}

//  Yardimci Bileseni 
function SatirItem({ label, deger, renk, bold }: { label: string; deger: number; renk: 'green'|'red'; bold?: boolean }) {
  if (deger === 0 && !bold) return null
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className={`text-xs ${bold ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-xs font-${bold ? 'bold' : 'medium'} ${renk === 'green' ? 'text-green-600' : 'text-red-500'}`}>{fmt(deger)}</span>
    </div>
  )
}