'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Shield, Plus, Edit, Trash2, Search, Download, Eye, X, Upload, AlertTriangle, Clock, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'

const TURLER = [
  { v: 'nakit',                l: 'Nakit Teminat',           emoji: '💵', renk: 'bg-green-50 text-green-700 border-green-200'   },
  { v: 'banka_teminat_mektubu',l: 'Banka Teminat Mektubu',   emoji: '🏦', renk: 'bg-blue-50 text-blue-700 border-blue-200'     },
  { v: 'cek',                  l: 'Cek',                     emoji: '📄', renk: 'bg-purple-50 text-purple-700 border-purple-200'},
  { v: 'senet',                l: 'Senet',                   emoji: '📃', renk: 'bg-amber-50 text-amber-700 border-amber-200'   },
  { v: 'gayrimenkul',          l: 'Gayrimenkul Ipotegi',     emoji: '🏠', renk: 'bg-orange-50 text-orange-700 border-orange-200'},
  { v: 'diger',                l: 'Diger',                   emoji: '📎', renk: 'bg-gray-50 text-gray-700 border-gray-200'      },
]

const DURUMLAR: Record<string, { l: string; v: 'green'|'yellow'|'red'|'blue'|'gray' }> = {
  aktif:           { l: 'Aktif',           v: 'green'  },
  iade_edildi:     { l: 'Iade Edildi',     v: 'blue'   },
  nakde_cevirildi: { l: 'Nakde Cevrildi', v: 'red'    },
  suresi_doldu:    { l: 'Suresi Doldu',    v: 'yellow' },
  iptal:           { l: 'Iptal',           v: 'gray'   },
}

const HAREKET_TURLERI = [
  { v: 'kesinti',     l: 'Hakedisten Kesinti',  renk: 'text-red-600'   },
  { v: 'cozum',       l: 'Kismi Cozum / Iade',  renk: 'text-green-600' },
  { v: 'tam_iade',    l: 'Tam Iade',            renk: 'text-blue-600'  },
  { v: 'nakde_cevir', l: 'Nakde Cevrildi',      renk: 'text-orange-600'},
  { v: 'diger',       l: 'Diger',               renk: 'text-gray-600'  },
]

const emptyForm = {
  teminat_turu: 'nakit', baslik: '', aciklama: '',
  veren_firma: '', alan_firma: '', proje_id: '',
  tutar: '', para_birimi: 'TRY',
  verilis_tarihi: new Date().toISOString().split('T')[0],
  gecerlilik_tarihi: '', iade_tarihi: '',
  banka_adi: '', belge_no: '', sube: '',
  durum: 'aktif', notlar: '',
}

const emptyHareket = {
  hareket_turu: 'kesinti', tutar: '', tarih: new Date().toISOString().split('T')[0],
  aciklama: '', belge_no: '', proje_id: '',
}

export default function TeminatModule({ firma }: AppCtx) {
  const [data, setData]       = useState<any[]>([])
  const [projeler, setProjeler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [turF, setTurF]       = useState('hepsi')
  const [durumF, setDurumF]   = useState('hepsi')
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState<any|null>(null)
  const [delId, setDelId]     = useState<string|null>(null)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState(emptyForm)
  const [preview, setPreview] = useState<{url:string;adi:string}|null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Hareket state
  const [hareketModal, setHareketModal] = useState<any|null>(null) // teminat objesi
  const [hareketler, setHareketler]     = useState<Record<string,any[]>>({})
  const [hForm, setHForm]               = useState(emptyHareket)
  const [savingH, setSavingH]           = useState(false)
  const [acikTeminat, setAcikTeminat]   = useState<string|null>(null)

  async function load() {
    setLoading(true)
    const [t, p] = await Promise.all([
      supabase.from('teminatlar').select('*').eq('firma_id', firma.id).order('verilis_tarihi', { ascending: false }),
      supabase.from('projeler').select('id,proje_adi').eq('firma_id', firma.id).order('proje_adi'),
    ])
    setData(t.data || [])
    setProjeler(p.data || [])
    // Hareketleri de yükle
    if (t.data && t.data.length > 0) {
      const ids = t.data.map((x: any) => x.id)
      const { data: hData } = await supabase.from('teminat_hareketler')
        .select('*').in('teminat_id', ids).order('tarih', { ascending: false })
      const map: Record<string,any[]> = {}
      ;(hData || []).forEach((h: any) => {
        if (!map[h.teminat_id]) map[h.teminat_id] = []
        map[h.teminat_id].push(h)
      })
      setHareketler(map)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const bugun = new Date(); bugun.setHours(0,0,0,0)

  const filtered = useMemo(() => data.filter(t => {
    if (turF !== 'hepsi' && t.teminat_turu !== turF) return false
    if (durumF !== 'hepsi' && t.durum !== durumF) return false
    if (search) {
      const q = search.toLowerCase()
      return t.baslik?.toLowerCase().includes(q) || t.veren_firma?.toLowerCase().includes(q) ||
             t.belge_no?.toLowerCase().includes(q) || t.banka_adi?.toLowerCase().includes(q)
    }
    return true
  }), [data, turF, durumF, search])

  const ozet = useMemo(() => {
    const aktif = data.filter(t => t.durum === 'aktif')
    const yaklasan = aktif.filter(t => {
      if (!t.gecerlilik_tarihi) return false
      const fark = Math.floor((new Date(t.gecerlilik_tarihi).getTime() - bugun.getTime()) / 86400000)
      return fark >= 0 && fark <= 30
    })
    const gecmis = aktif.filter(t => t.gecerlilik_tarihi && new Date(t.gecerlilik_tarihi) < bugun)
    return {
      toplam: data.length,
      aktif: aktif.length,
      toplamTutar: aktif.reduce((s, t) => s + Number(t.tutar || 0), 0),
      yaklasan: yaklasan.length,
      gecmis: gecmis.length,
    }
  }, [data])

  function openNew() { setForm(emptyForm); setUploadFile(null); setEditing(null); setModal(true) }
  function openEdit(t: any) {
    setForm({
      teminat_turu: t.teminat_turu||'nakit', baslik: t.baslik||'', aciklama: t.aciklama||'',
      veren_firma: t.veren_firma||'', alan_firma: t.alan_firma||'', proje_id: t.proje_id||'',
      tutar: String(t.tutar||''), para_birimi: t.para_birimi||'TRY',
      verilis_tarihi: t.verilis_tarihi||'', gecerlilik_tarihi: t.gecerlilik_tarihi||'',
      iade_tarihi: t.iade_tarihi||'', banka_adi: t.banka_adi||'', belge_no: t.belge_no||'',
      sube: t.sube||'', durum: t.durum||'aktif', notlar: t.notlar||'',
    })
    setUploadFile(null); setEditing(t); setModal(true)
  }

  async function save() {
    if (!form.baslik || !form.veren_firma || !form.tutar) return alert('Baslik, veren firma ve tutar zorunludur')
    setSaving(true)
    const payload: any = {
      firma_id: firma.id, teminat_turu: form.teminat_turu, baslik: form.baslik,
      aciklama: form.aciklama||null, veren_firma: form.veren_firma, alan_firma: form.alan_firma||null,
      proje_id: form.proje_id||null, tutar: Number(form.tutar), para_birimi: form.para_birimi,
      verilis_tarihi: form.verilis_tarihi, gecerlilik_tarihi: form.gecerlilik_tarihi||null,
      iade_tarihi: form.iade_tarihi||null, banka_adi: form.banka_adi||null,
      belge_no: form.belge_no||null, sube: form.sube||null, durum: form.durum, notlar: form.notlar||null,
    }
    let id = editing?.id
    if (editing) { await supabase.from('teminatlar').update(payload).eq('id', editing.id) }
    else {
      const { data: yeni } = await supabase.from('teminatlar').insert(payload).select().single()
      id = yeni?.id
    }
    // Dosya yukle
    if (uploadFile && id) {
      const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
      const path = `${firma.id}/teminat/${id}_${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from('teminat-belgeler').upload(path, uploadFile)
      if (!error) await supabase.from('teminatlar').update({ dosya_adi: uploadFile.name, storage_path: path }).eq('id', id)
    }
    setSaving(false); setModal(false); load()
  }

  async function durumGuncelle(id: string, durum: string) {
    await supabase.from('teminatlar').update({ durum }).eq('id', id)
    load()
  }

  async function hareketKaydet() {
    if (!hForm.tutar || !hareketModal) return alert('Tutar zorunludur')
    setSavingH(true)
    const tutar = Number(hForm.tutar)
    await supabase.from('teminat_hareketler').insert({
      firma_id: firma.id, teminat_id: hareketModal.id,
      proje_id: hForm.proje_id || null,
      hareket_turu: hForm.hareket_turu, tutar,
      tarih: hForm.tarih, aciklama: hForm.aciklama || null,
      belge_no: hForm.belge_no || null,
    })
    // Kalan tutarı güncelle
    const mevcutKalan = Number(hareketModal.kalan_tutar || hareketModal.tutar || 0)
    const isAzaltan = ['kesinti', 'nakde_cevir'].includes(hForm.hareket_turu)
    const isArtan   = ['cozum', 'tam_iade'].includes(hForm.hareket_turu)
    let yeniKalan = mevcutKalan
    if (isAzaltan) yeniKalan = Math.max(0, mevcutKalan - tutar)
    if (isArtan)   yeniKalan = Math.min(Number(hareketModal.tutar), mevcutKalan + tutar)
    // Durum güncelle
    let yeniDurum = hareketModal.durum
    if (hForm.hareket_turu === 'tam_iade') yeniDurum = 'iade_edildi'
    if (hForm.hareket_turu === 'nakde_cevir') yeniDurum = 'nakde_cevirildi'
    if (yeniKalan === 0 && isAzaltan) yeniDurum = 'iade_edildi'
    await supabase.from('teminatlar').update({ kalan_tutar: yeniKalan, durum: yeniDurum }).eq('id', hareketModal.id)
    setSavingH(false); setHareketModal(null); setHForm(emptyHareket); load()
  }

  async function exportExcel() {
    const XLSX = await import('xlsx-js-style')
    const { utils, writeFile } = XLSX
    const KOYU='0F172A'; const BEYAZ='FFFFFF'; const SINIR='CBD5E1'; const MAVI='1E3A5F'
    const brd = { top:{style:'thin',color:{rgb:SINIR}}, bottom:{style:'thin',color:{rgb:SINIR}}, left:{style:'thin',color:{rgb:SINIR}}, right:{style:'thin',color:{rgb:SINIR}} }
    const cv = (v:any,s:any) => ({ v:v??'', s, t:typeof v==='number'?'n':'s' })
    const para = (v:number,s:any) => ({ v, s:{...s,numFmt:'#,##0.00 ₺'}, t:'n' })
    const sTh = { font:{name:'Calibri',sz:9,bold:true,color:{rgb:BEYAZ}}, fill:{fgColor:{rgb:MAVI}}, alignment:{horizontal:'center',vertical:'center'}, border:brd }
    const sTd = (z:boolean) => ({ font:{name:'Calibri',sz:9,color:{rgb:KOYU}}, fill:{fgColor:{rgb:z?'F8FAFC':BEYAZ}}, alignment:{vertical:'center'}, border:brd })
    const sPara = (z:boolean,renk?:string) => ({ ...sTd(z), alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0.00 ₺', font:{name:'Calibri',sz:9,color:{rgb:renk||KOYU}} })

    const ws:any = {}; const merges:any[] = []; const COLS=11; let row=0

    // Baslik
    ws[utils.encode_cell({r:row,c:0})] = cv(`${firma.ad.toUpperCase()} — TEMİNAT TAKİP RAPORU`, {font:{name:'Calibri',sz:13,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:KOYU}},alignment:{horizontal:'left',vertical:'center'}})
    for(let i=1;i<COLS-1;i++) ws[utils.encode_cell({r:row,c:i})] = cv('',{fill:{fgColor:{rgb:KOYU}}})
    ws[utils.encode_cell({r:row,c:COLS-1})] = cv(new Date().toLocaleDateString('tr-TR'),{font:{name:'Calibri',sz:9,color:{rgb:'BFDBFE'}},fill:{fgColor:{rgb:KOYU}},alignment:{horizontal:'right',vertical:'center'}})
    merges.push({s:{r:row,c:0},e:{r:row,c:COLS-2}}); row+=2

    ;['Baslik','Tur','Veren Firma','Proje','Belge No','Banka','Verilis','Gecerlilik','Tutar','Kalan','Durum'].forEach((h,i)=>{ ws[utils.encode_cell({r:row,c:i})] = cv(h,sTh) }); row++

    filtered.forEach((t,idx) => {
      const z = idx%2===1
      const tur = TURLER.find(x=>x.v===t.teminat_turu)?.l||t.teminat_turu
      const proje = projeler.find(p=>p.id===t.proje_id)?.proje_adi||'-'
      const dur = DURUMLAR[t.durum]?.l||t.durum
      const kalan = Number(t.kalan_tutar||t.tutar||0)
      const tutar = Number(t.tutar||0)
      ws[utils.encode_cell({r:row,c:0})] = cv(t.baslik, sTd(z))
      ws[utils.encode_cell({r:row,c:1})] = cv(tur, sTd(z))
      ws[utils.encode_cell({r:row,c:2})] = cv(t.veren_firma, sTd(z))
      ws[utils.encode_cell({r:row,c:3})] = cv(proje, sTd(z))
      ws[utils.encode_cell({r:row,c:4})] = cv(t.belge_no||'-', sTd(z))
      ws[utils.encode_cell({r:row,c:5})] = cv(t.banka_adi||'-', sTd(z))
      ws[utils.encode_cell({r:row,c:6})] = cv(t.verilis_tarihi ? new Date(t.verilis_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
      ws[utils.encode_cell({r:row,c:7})] = cv(t.gecerlilik_tarihi ? new Date(t.gecerlilik_tarihi).toLocaleDateString('tr-TR') : '-', sTd(z))
      ws[utils.encode_cell({r:row,c:8})] = para(tutar, sPara(z))
      ws[utils.encode_cell({r:row,c:9})] = para(kalan, sPara(z, kalan<tutar?'991B1B':'166534'))
      ws[utils.encode_cell({r:row,c:10})] = cv(dur, {...sTd(z), font:{name:'Calibri',sz:9,bold:true,color:{rgb:t.durum==='aktif'?'166534':t.durum==='iade_edildi'?'1D4ED8':'991B1B'}}})
      row++

      // Hareketler
      const tHareketler = hareketler[t.id] || []
      tHareketler.forEach((h:any) => {
        const hTur = HAREKET_TURLERI.find(x=>x.v===h.hareket_turu)?.l||h.hareket_turu
        const hPrj = projeler.find(p=>p.id===h.proje_id)?.proje_adi||''
        const hS = { font:{name:'Calibri',sz:8,color:{rgb:'64748B'}}, fill:{fgColor:{rgb:'F1F5F9'}}, alignment:{vertical:'center'}, border:brd }
        ws[utils.encode_cell({r:row,c:0})] = cv(`  ↳ ${hTur}`, hS)
        ws[utils.encode_cell({r:row,c:1})] = cv(h.tarih ? new Date(h.tarih).toLocaleDateString('tr-TR') : '', hS)
        ws[utils.encode_cell({r:row,c:2})] = cv(h.aciklama||'', hS)
        ws[utils.encode_cell({r:row,c:3})] = cv(hPrj, hS)
        ws[utils.encode_cell({r:row,c:4})] = cv(h.belge_no||'', hS)
        for(let i=5;i<9;i++) ws[utils.encode_cell({r:row,c:i})] = cv('', hS)
        ws[utils.encode_cell({r:row,c:9})] = para(Number(h.tutar||0), {...hS, alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0.00 ₺', font:{name:'Calibri',sz:8,color:{rgb:['kesinti','nakde_cevir'].includes(h.hareket_turu)?'991B1B':'166534'}}})
        ws[utils.encode_cell({r:row,c:10})] = cv('', hS)
        row++
      })
    })

    // Toplam
    const topS = {font:{name:'Calibri',sz:10,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:'1E293B'}},alignment:{horizontal:'right',vertical:'center'},numFmt:'#,##0.00 ₺',border:{top:{style:'medium',color:{rgb:KOYU}},bottom:{style:'medium',color:{rgb:KOYU}},left:{style:'thin',color:{rgb:KOYU}},right:{style:'thin',color:{rgb:KOYU}}}}
    const topL = {...topS, alignment:{horizontal:'left',vertical:'center'}}
    ws[utils.encode_cell({r:row,c:0})] = cv(`TOPLAM: ${filtered.length} teminat`, topL)
    for(let i=1;i<8;i++) ws[utils.encode_cell({r:row,c:i})] = cv('',topL)
    ws[utils.encode_cell({r:row,c:8})] = para(filtered.reduce((s,t)=>s+Number(t.tutar||0),0), topS)
    ws[utils.encode_cell({r:row,c:9})] = para(filtered.reduce((s,t)=>s+Number(t.kalan_tutar||t.tutar||0),0), topS)
    ws[utils.encode_cell({r:row,c:10})] = cv('',topL)
    merges.push({s:{r:row,c:0},e:{r:row,c:7}}); row++

    ws['!cols'] = [{wch:28},{wch:18},{wch:22},{wch:18},{wch:14},{wch:16},{wch:12},{wch:12},{wch:16},{wch:16},{wch:14}]
    ws['!merges'] = merges
    ws['!ref'] = utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}})
    const wb = utils.book_new(); utils.book_append_sheet(wb, ws, 'Teminatlar')
    writeFile(wb, `teminatlar-${firma.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function belgeOnizle(t: any) {
    const { data } = await supabase.storage.from('teminat-belgeler').createSignedUrl(t.storage_path, 60)
    if (data?.signedUrl) setPreview({ url: data.signedUrl, adi: t.dosya_adi })
  }

  async function belgeIndir(t: any) {
    const { data } = await supabase.storage.from('teminat-belgeler').createSignedUrl(t.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = t.dosya_adi; a.click() }
  }

  const sf = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-5">
      {/* Baslik */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center"><Shield className="w-4 h-4 text-cyan-600" /></span>
            Teminat Takibi
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 ml-10">
            {ozet.aktif} aktif teminat &middot; {fmt(ozet.toplamTutar)} toplam
            {ozet.gecmis > 0 && <span className="text-red-500 ml-2">&middot; {ozet.gecmis} suresi dolmus</span>}
            {ozet.yaklasan > 0 && <span className="text-amber-500 ml-2">&middot; {ozet.yaklasan} yaklasiyor</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 w-40" />
          </div>
          <select value={turF} onChange={e => setTurF(e.target.value)} className={inputCls + ' w-auto text-sm'}>
            <option value="hepsi">Tum Turler</option>
            {TURLER.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <select value={durumF} onChange={e => setDurumF(e.target.value)} className={inputCls + ' w-auto text-sm'}>
            <option value="hepsi">Tum Durumlar</option>
            {Object.entries(DURUMLAR).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <Btn variant="secondary" size="sm" icon={<FileSpreadsheet className="w-4 h-4" />} onClick={exportExcel}>Excel</Btn>
          <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Teminat</Btn>
        </div>
      </div>

      {/* Ozet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Toplam Teminat</p>
          <p className="text-2xl font-bold text-gray-900">{ozet.toplam}</p>
        </div>
        <div className="bg-cyan-50 rounded-xl border border-cyan-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Aktif Tutar</p>
          <p className="text-xl font-bold text-cyan-700">{fmt(ozet.toplamTutar)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${ozet.yaklasan > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />30 Gunde Dolacak</p>
          <p className={`text-2xl font-bold ${ozet.yaklasan > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{ozet.yaklasan}</p>
        </div>
        <div className={`rounded-xl border p-4 ${ozet.gecmis > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Suresi Dolmus</p>
          <p className={`text-2xl font-bold ${ozet.gecmis > 0 ? 'text-red-600' : 'text-gray-400'}`}>{ozet.gecmis}</p>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<Shield className="w-10 h-10" />} message="Teminat bulunamadi" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => {
            const tur = TURLER.find(x => x.v === t.teminat_turu) || TURLER[TURLER.length-1]
            const dur = DURUMLAR[t.durum] || DURUMLAR.aktif
            const proje = projeler.find(p => p.id === t.proje_id)
            const gecerlilikGun = t.gecerlilik_tarihi
              ? Math.floor((new Date(t.gecerlilik_tarihi).getTime() - bugun.getTime()) / 86400000)
              : null
            const yaklasan = gecerlilikGun !== null && gecerlilikGun >= 0 && gecerlilikGun <= 30
            const gecmis   = gecerlilikGun !== null && gecerlilikGun < 0 && t.durum === 'aktif'

            return (
              <div key={t.id} className={`bg-white rounded-xl border-2 p-4 hover:shadow-md transition-all ${gecmis ? 'border-red-300' : yaklasan ? 'border-amber-300' : 'border-gray-200'}`}>
                {/* Ust */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{tur.emoji}</span>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{t.baslik}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${tur.renk}`}>{tur.l}</span>
                    </div>
                  </div>
                  <Badge label={dur.l} variant={dur.v} />
                </div>

                {/* Bilgiler */}
                <div className="space-y-1.5 text-xs text-gray-600 mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Veren</span>
                    <span className="font-medium">{t.veren_firma}</span>
                  </div>
                  {t.alan_firma && <div className="flex justify-between"><span className="text-gray-400">Alan</span><span>{t.alan_firma}</span></div>}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tutar</span>
                    <span className="font-bold text-gray-900">{fmt(Number(t.tutar))} {t.para_birimi !== 'TRY' ? t.para_birimi : ''}</span>
                  </div>
                  {Number(t.kalan_tutar) !== Number(t.tutar) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Kalan</span>
                      <span className="font-bold text-red-600">{fmt(Number(t.kalan_tutar||0))}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Verilis</span>
                    <span>{fmtDate(t.verilis_tarihi)}</span>
                  </div>
                  {t.gecerlilik_tarihi && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Gecerlilik</span>
                      <span className={gecmis ? 'text-red-600 font-semibold' : yaklasan ? 'text-amber-600 font-semibold' : ''}>
                        {fmtDate(t.gecerlilik_tarihi)}
                        {gecmis && '  Doldu'}
                        {yaklasan && !gecmis && ` (${gecerlilikGun} gun)`}
                      </span>
                    </div>
                  )}
                  {t.belge_no && <div className="flex justify-between"><span className="text-gray-400">Belge No</span><span className="font-mono">{t.belge_no}</span></div>}
                  {t.banka_adi && <div className="flex justify-between"><span className="text-gray-400">Banka</span><span>{t.banka_adi}{t.sube ? ` / ${t.sube}` : ''}</span></div>}
                  {proje && <div className="flex justify-between"><span className="text-gray-400">Proje</span><span className="text-purple-600">{proje.proje_adi}</span></div>}
                </div>

                {/* Alt Aksiyonlar */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex gap-1">
                    {t.storage_path && (
                      <>
                        <button onClick={() => belgeOnizle(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Goruntule"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => belgeIndir(t)} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Indir"><Download className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {t.durum === 'aktif' && (
                      <button onClick={() => durumGuncelle(t.id, 'iade_edildi')}
                        className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-medium">
                        Iade Et
                      </button>
                    )}
                    <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDelId(t.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* Hareket listesi */}
                {(hareketler[t.id]||[]).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <button onClick={() => setAcikTeminat(acikTeminat===t.id?null:t.id)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-1">
                      {acikTeminat===t.id ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                      {(hareketler[t.id]||[]).length} hareket
                    </button>
                    {acikTeminat===t.id && (
                      <div className="space-y-1">
                        {(hareketler[t.id]||[]).map((h:any) => {
                          const hTur = HAREKET_TURLERI.find(x=>x.v===h.hareket_turu)
                          const isAzaltan = ['kesinti','nakde_cevir'].includes(h.hareket_turu)
                          return (
                            <div key={h.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                              <div>
                                <span className={`font-medium ${hTur?.renk||'text-gray-600'}`}>{hTur?.l||h.hareket_turu}</span>
                                {h.aciklama && <span className="text-gray-400 ml-1">— {h.aciklama}</span>}
                                <span className="text-gray-400 ml-1">{fmtDate(h.tarih)}</span>
                              </div>
                              <span className={`font-bold ${isAzaltan?'text-red-600':'text-green-600'}`}>
                                {isAzaltan?'-':'+'}{fmt(Number(h.tutar))}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Hareket Ekle Butonu */}
                {t.durum === 'aktif' && (
                  <button onClick={() => { setHareketModal(t); setHForm({...emptyHareket, proje_id: t.proje_id||''}) }}
                    className="mt-2 w-full text-xs py-1.5 rounded-lg border border-dashed border-cyan-300 text-cyan-600 hover:bg-cyan-50 transition-colors flex items-center justify-center gap-1">
                    <Plus className="w-3 h-3" /> Hareket Ekle
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={editing ? 'Teminat Duzenle' : 'Yeni Teminat'} onClose={() => setModal(false)} size="lg"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>Iptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Teminat Turu" required>
              <select value={form.teminat_turu} onChange={sf('teminat_turu')} className={inputCls}>
                {TURLER.map(t => <option key={t.v} value={t.v}>{t.emoji} {t.l}</option>)}
              </select>
            </Field>
            <Field label="Durum">
              <select value={form.durum} onChange={sf('durum')} className={inputCls}>
                {Object.entries(DURUMLAR).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
            </Field>
            <Field label="Baslik" required className="md:col-span-2">
              <input type="text" value={form.baslik} onChange={sf('baslik')} className={inputCls} placeholder="Teminat aciklamasi..." />
            </Field>
            <Field label="Veren Firma / Kisi" required>
              <input type="text" value={form.veren_firma} onChange={sf('veren_firma')} className={inputCls} />
            </Field>
            <Field label="Alan Firma / Kisi">
              <input type="text" value={form.alan_firma} onChange={sf('alan_firma')} className={inputCls} />
            </Field>
            <Field label="Tutar" required>
              <input type="number" step="0.01" value={form.tutar} onChange={sf('tutar')} className={inputCls} />
            </Field>
            <Field label="Para Birimi">
              <select value={form.para_birimi} onChange={sf('para_birimi')} className={inputCls}>
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </Field>
            <Field label="Verilis Tarihi" required>
              <input type="date" value={form.verilis_tarihi} onChange={sf('verilis_tarihi')} className={inputCls} />
            </Field>
            <Field label="Gecerlilik Tarihi">
              <input type="date" value={form.gecerlilik_tarihi} onChange={sf('gecerlilik_tarihi')} className={inputCls} />
            </Field>
            <Field label="Banka Adi">
              <input type="text" value={form.banka_adi} onChange={sf('banka_adi')} className={inputCls} />
            </Field>
            <Field label="Sube">
              <input type="text" value={form.sube} onChange={sf('sube')} className={inputCls} />
            </Field>
            <Field label="Belge / Mektup No">
              <input type="text" value={form.belge_no} onChange={sf('belge_no')} className={inputCls} />
            </Field>
            <Field label="Ilgili Proje">
              <select value={form.proje_id} onChange={sf('proje_id')} className={inputCls}>
                <option value="">-- Proje sec --</option>
                {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
              </select>
            </Field>
            <Field label="Notlar" className="md:col-span-2">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
            </Field>
            {/* Belge Yukle */}
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-gray-700 mb-1">Belge Yukle (PDF, JPG, PNG)</p>
              <div className="flex items-center gap-3">
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-cyan-400 hover:text-cyan-600 transition-colors">
                  <Upload className="w-4 h-4" />
                  {uploadFile ? uploadFile.name : (editing?.dosya_adi || 'Dosya sec')}
                </button>
                {uploadFile && <button onClick={() => setUploadFile(null)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Onizleme */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm">{preview.adi}</span>
              <div className="flex gap-2">
                <a href={preview.url} download={preview.adi} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" />Indir</a>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {preview.adi.toLowerCase().match(/\.(jpg|jpeg|png)$/)
                ? <img src={preview.url} alt={preview.adi} className="max-w-full mx-auto" />
                : <iframe src={preview.url} className="w-full h-full min-h-[60vh]" />
              }
            </div>
          </div>
        </div>
      )}

      {/* Hareket Modal */}
      {hareketModal && (
        <Modal title={`Hareket Ekle — ${hareketModal.baslik}`} onClose={() => setHareketModal(null)} size="md"
          footer={<><Btn variant="secondary" onClick={() => setHareketModal(null)}>Iptal</Btn><Btn onClick={hareketKaydet} disabled={savingH}>{savingH?'Kaydediliyor...':'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-xs text-cyan-700 flex justify-between">
              <span>Toplam Tutar: <strong>{fmt(Number(hareketModal.tutar))}</strong></span>
              <span>Kalan: <strong>{fmt(Number(hareketModal.kalan_tutar||hareketModal.tutar))}</strong></span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Hareket Turu" required>
                <select value={hForm.hareket_turu} onChange={e => setHForm(p=>({...p,hareket_turu:e.target.value}))} className={inputCls}>
                  {HAREKET_TURLERI.map(h => <option key={h.v} value={h.v}>{h.l}</option>)}
                </select>
              </Field>
              <Field label="Tarih" required>
                <input type="date" value={hForm.tarih} onChange={e => setHForm(p=>({...p,tarih:e.target.value}))} className={inputCls} />
              </Field>
              <Field label="Tutar (TL)" required>
                <input type="number" step="0.01" value={hForm.tutar} onChange={e => setHForm(p=>({...p,tutar:e.target.value}))} className={inputCls} />
              </Field>
              <Field label="Belge No">
                <input type="text" value={hForm.belge_no} onChange={e => setHForm(p=>({...p,belge_no:e.target.value}))} className={inputCls} />
              </Field>
              <Field label="Ilgili Proje" className="col-span-2">
                <select value={hForm.proje_id} onChange={e => setHForm(p=>({...p,proje_id:e.target.value}))} className={inputCls}>
                  <option value="">-- Proje sec --</option>
                  {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
                </select>
              </Field>
              <Field label="Aciklama" className="col-span-2">
                <textarea rows={2} value={hForm.aciklama} onChange={e => setHForm(p=>({...p,aciklama:e.target.value}))} className={inputCls} placeholder="Hakedis no, kesinti sebebi..." />
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu teminat kaydini silmek istediginize emin misiniz?"
          onConfirm={async () => { await supabase.from('teminatlar').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}