'use client'
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  BookUser, Plus, Edit, Trash2, Search, Download, Eye, X,
  Upload, FileText, ChevronDown, ChevronRight, RefreshCw,
  TrendingUp, TrendingDown, Wallet, Filter, FileSpreadsheet
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ─── Sabitler ─────────────────────────────────────────────────
const CARI_TIPLER = [
  { v: 'tedarikci', l: 'Tedarikci' },
  { v: 'musteri',   l: 'Musteri'   },
  { v: 'alt_yukl',  l: 'Alt Yuklenic' },
  { v: 'diger',     l: 'Diger'     },
]

const HAREKET_TURLERI = [
  { v: 'borc',       l: 'Borc (Gider)',    renk: 'text-red-600'   },
  { v: 'alacak',     l: 'Alacak (Gelir)',  renk: 'text-green-600' },
  { v: 'cek_alindi', l: 'Cek Alindi',      renk: 'text-blue-600'  },
  { v: 'cek_verildi',l: 'Cek Verildi',     renk: 'text-orange-600'},
  { v: 'fatura',     l: 'Fatura',          renk: 'text-purple-600'},
  { v: 'odeme',      l: 'Odeme',           renk: 'text-green-700' },
  { v: 'tahsilat',   l: 'Tahsilat',        renk: 'text-teal-600'  },
  { v: 'diger',      l: 'Diger',           renk: 'text-gray-600'  },
]

const BELGE_TURLERI = [
  { v: 'fatura',  l: 'Fatura'  },
  { v: 'cek',     l: 'Cek'     },
  { v: 'ekstre',  l: 'Ekstre'  },
  { v: 'sozlesme',l: 'Sozlesme'},
  { v: 'diger',   l: 'Diger'   },
]

const emptyCari = {
  ad: '', tip: 'tedarikci', vkn_tckn: '', telefon: '',
  email: '', adres: '', iban: '', notlar: '',
}

const emptyHareket = {
  tarih: new Date().toISOString().split('T')[0],
  tur: 'borc', tutar: '', aciklama: '', belge_no: '',
  odeme_durumu: 'bekliyor', odeme_tarihi: '',
}

// ─── Ana Modul ─────────────────────────────────────────────────
export default function CariModule({ firma }: AppCtx) {
  const [cariler, setCariler]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [tipF, setTipF]         = useState('hepsi')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<any | null>(null)
  const [delId, setDelId]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState(emptyCari)

  async function load() {
    setLoading(true)
    const { data: cariData } = await supabase
      .from('cari_hesaplar').select('*')
      .eq('firma_id', firma.id)
      .order('ad')
    const rows = cariData || []

    // Tum hareketleri cek, bakiyeleri hesapla
    if (rows.length > 0) {
      const ids = rows.map((c: any) => c.id)
      const { data: hareketData } = await supabase
        .from('cari_hareketler').select('cari_hesap_id,tur,tutar')
        .in('cari_hesap_id', ids)
      const bakiyeMap: Record<string, number> = {}
      ;(hareketData || []).forEach((h: any) => {
        if (!bakiyeMap[h.cari_hesap_id]) bakiyeMap[h.cari_hesap_id] = 0
        const t = Number(h.tutar || 0)
        const isAlacak = ['alacak', 'tahsilat', 'cek_alindi'].includes(h.tur)
        bakiyeMap[h.cari_hesap_id] += isAlacak ? t : -t
      })
      // bakiye alanini gercek degerle guncelle
      rows.forEach((c: any) => { c.bakiye = bakiyeMap[c.id] ?? 0 })
    }

    setCariler(rows)
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const filtered = useMemo(() => cariler.filter(c => {
    if (tipF !== 'hepsi' && c.tip !== tipF) return false
    if (search && !c.ad?.toLowerCase().includes(search.toLowerCase()) &&
        !c.vkn_tckn?.includes(search) && !c.telefon?.includes(search)) return false
    return true
  }), [cariler, tipF, search])

  const ozet = useMemo(() => {
    const alacak = filtered.reduce((s, c) => s + (Number(c.bakiye) > 0 ? Number(c.bakiye) : 0), 0)
    const borc   = filtered.reduce((s, c) => s + (Number(c.bakiye) < 0 ? Math.abs(Number(c.bakiye)) : 0), 0)
    return { toplam: filtered.length, alacak, borc, net: alacak - borc }
  }, [filtered])

  const sf = (k: keyof typeof emptyCari) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  function openNew()  { setForm(emptyCari); setEditing(null); setModal(true) }
  function openEdit(c: any) {
    setForm({ ad: c.ad, tip: c.tip || 'tedarikci', vkn_tckn: c.vkn_tckn || '', telefon: c.telefon || '', email: c.email || '', adres: c.adres || '', iban: c.iban || '', notlar: c.notlar || '' })
    setEditing(c); setModal(true)
  }

  async function save() {
    if (!form.ad) return alert('Cari ad zorunludur')
    setSaving(true)
    const payload = { ad: form.ad, tip: form.tip, vkn_tckn: form.vkn_tckn || null, telefon: form.telefon || null, email: form.email || null, adres: form.adres || null, iban: form.iban || null, notlar: form.notlar || null }
    if (editing) { await supabase.from('cari_hesaplar').update(payload).eq('id', editing.id) }
    else { await supabase.from('cari_hesaplar').insert({ ...payload, firma_id: firma.id, bakiye: 0 }) }
    setSaving(false); setModal(false); load()
  }


  const [contextMenu, setContextMenu] = React.useState<{x:number;y:number;cari:any}|null>(null)

  function handleContextMenu(e: React.MouseEvent, cari: any) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, cari })
  }

  async function exportExcel(hedefCariler?: any[]) {
    const liste = hedefCariler || filtered
    // Her cari icin hareketleri cek, gercek bakiyeyi hesapla
    const cariHareketMap: Record<string, number> = {}
    if (liste.length > 0) {
      const ids = liste.map((c: any) => c.id)
      const { data: tumH } = await supabase.from('cari_hareketler').select('cari_hesap_id,tur,tutar').in('cari_hesap_id', ids)
      ;(tumH || []).forEach((h: any) => {
        if (!cariHareketMap[h.cari_hesap_id]) cariHareketMap[h.cari_hesap_id] = 0
        const t = Number(h.tutar || 0)
        const isAlacak = ['alacak', 'tahsilat', 'cek_alindi'].includes(h.tur)
        cariHareketMap[h.cari_hesap_id] += isAlacak ? t : -t
      })
    }
    const XLSX = await import('xlsx-js-style')
    const { utils, writeFile } = XLSX
    const KOYU='0F172A'; const BEYAZ='FFFFFF'; const SINIR='E2E8F0'; const MAVI='1E40AF'
    const border = { top:{style:'thin',color:{rgb:SINIR}}, bottom:{style:'thin',color:{rgb:SINIR}}, left:{style:'thin',color:{rgb:SINIR}}, right:{style:'thin',color:{rgb:SINIR}} }
    const sTh = { font:{name:'Calibri',sz:9,bold:true,color:{rgb:BEYAZ}}, fill:{fgColor:{rgb:MAVI}}, alignment:{horizontal:'center',vertical:'center'}, border }
    const sTd = (z:boolean) => ({ font:{name:'Calibri',sz:9,color:{rgb:KOYU}}, fill:{fgColor:{rgb:z?'F8FAFC':BEYAZ}}, alignment:{vertical:'center'}, border })
    const sPara = (z:boolean) => ({ ...sTd(z), alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0.00 \u20BA' })
    const cv = (v:any,s:any) => ({ v:v??'', s, t:typeof v==='number'?'n':'s' })
    const ws:any = {}; const merges:any[] = []; const COLS = 8; let row = 0
    ws[utils.encode_cell({r:row,c:0})] = cv(`${firma.ad.toUpperCase()} - CARI HESAP RAPORU`, {font:{name:'Calibri',sz:13,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:KOYU}},alignment:{horizontal:'left',vertical:'center'}})
    for(let i=1;i<COLS-1;i++) ws[utils.encode_cell({r:row,c:i})] = cv('',{fill:{fgColor:{rgb:KOYU}}})
    ws[utils.encode_cell({r:row,c:COLS-1})] = cv(new Date().toLocaleDateString('tr-TR'),{font:{name:'Calibri',sz:9,color:{rgb:'BFDBFE'}},fill:{fgColor:{rgb:KOYU}},alignment:{horizontal:'right',vertical:'center'}})
    merges.push({s:{r:row,c:0},e:{r:row,c:COLS-2}}); row+=2
    ;['Cari Ad','Tip','VKN/TCKN','Telefon','IBAN','Alacak','Borc','Net Bakiye'].forEach((h,i)=>{ ws[utils.encode_cell({r:row,c:i})] = cv(h,sTh) }); row++
    liste.forEach((cari,idx) => {
      const z = idx%2===1; const bak = cariHareketMap[cari.id] ?? Number(cari.bakiye||0)
      const alacak = bak > 0 ? bak : 0; const borc = bak < 0 ? Math.abs(bak) : 0
      ws[utils.encode_cell({r:row,c:0})] = cv(cari.ad, sTd(z))
      ws[utils.encode_cell({r:row,c:1})] = cv(CARI_TIPLER.find((t:any)=>t.v===cari.tip)?.l||cari.tip||'-', sTd(z))
      ws[utils.encode_cell({r:row,c:2})] = cv(cari.vkn_tckn||'-', sTd(z))
      ws[utils.encode_cell({r:row,c:3})] = cv(cari.telefon||'-', sTd(z))
      ws[utils.encode_cell({r:row,c:4})] = cv(cari.iban||'-', sTd(z))
      ws[utils.encode_cell({r:row,c:5})] = {v:alacak, s:{...sPara(z),font:{name:'Calibri',sz:9,bold:alacak>0,color:{rgb:alacak>0?'166534':KOYU}}}, t:'n'}
      ws[utils.encode_cell({r:row,c:6})] = {v:borc, s:{...sPara(z),font:{name:'Calibri',sz:9,bold:borc>0,color:{rgb:borc>0?'991B1B':KOYU}}}, t:'n'}
      ws[utils.encode_cell({r:row,c:7})] = {v:bak, s:{...sPara(z),font:{name:'Calibri',sz:9,bold:true,color:{rgb:bak>=0?'166534':'991B1B'}}}, t:'n'}
      row++
    })
    const topS = {font:{name:'Calibri',sz:10,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:'1E293B'}},alignment:{horizontal:'right',vertical:'center'},numFmt:'#,##0.00 \u20BA',border:{top:{style:'medium',color:{rgb:KOYU}},bottom:{style:'medium',color:{rgb:KOYU}},left:{style:'thin',color:{rgb:KOYU}},right:{style:'thin',color:{rgb:KOYU}}}}
    const topL = {...topS, alignment:{horizontal:'left',vertical:'center'}}
    ws[utils.encode_cell({r:row,c:0})] = cv(`TOPLAM: ${liste.length} cari`, topL)
    for(let i=1;i<5;i++) ws[utils.encode_cell({r:row,c:i})] = cv('',topL)
    ws[utils.encode_cell({r:row,c:5})] = {v:liste.reduce((s:number,c:any)=>s+(Number(c.bakiye)>0?Number(c.bakiye):0),0), s:topS, t:'n'}
    ws[utils.encode_cell({r:row,c:6})] = {v:liste.reduce((s:number,c:any)=>s+(Number(c.bakiye)<0?Math.abs(Number(c.bakiye)):0),0), s:topS, t:'n'}
    ws[utils.encode_cell({r:row,c:7})] = {v:liste.reduce((s:number,c:any)=>s+Number(c.bakiye||0),0), s:topS, t:'n'}
    merges.push({s:{r:row,c:0},e:{r:row,c:4}}); row++
    ws['!cols'] = [{wch:28},{wch:14},{wch:14},{wch:14},{wch:26},{wch:16},{wch:16},{wch:16}]
    ws['!merges'] = merges; ws['!ref'] = utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}})
    const wb = utils.book_new(); utils.book_append_sheet(wb, ws, 'Cari Hesaplar')
    writeFile(wb, `cari-hesaplar-${firma.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  async function exportCariDetay(cari: any) {
    const { data: hareketler } = await supabase.from('cari_hareketler').select('*').eq('cari_hesap_id', cari.id).order('tarih', { ascending: true })
    const XLSX = await import('xlsx-js-style')
    const { utils, writeFile } = XLSX
    const KOYU='0F172A'; const BEYAZ='FFFFFF'; const SINIR='E2E8F0'; const MAVI='1E40AF'
    const border = { top:{style:'thin',color:{rgb:SINIR}}, bottom:{style:'thin',color:{rgb:SINIR}}, left:{style:'thin',color:{rgb:SINIR}}, right:{style:'thin',color:{rgb:SINIR}} }
    const sTh = { font:{name:'Calibri',sz:9,bold:true,color:{rgb:BEYAZ}}, fill:{fgColor:{rgb:MAVI}}, alignment:{horizontal:'center',vertical:'center'}, border }
    const sTd = (z:boolean) => ({ font:{name:'Calibri',sz:9,color:{rgb:KOYU}}, fill:{fgColor:{rgb:z?'F8FAFC':BEYAZ}}, alignment:{vertical:'center'}, border })
    const sPara = (z:boolean,renk?:string) => ({ ...sTd(z), alignment:{horizontal:'right',vertical:'center'}, numFmt:'#,##0.00 \u20BA', font:{name:'Calibri',sz:9,color:{rgb:renk||KOYU}} })
    const cv = (v:any,s:any) => ({ v:v??'', s, t:typeof v==='number'?'n':'s' })
    const ws:any = {}; const merges:any[] = []; const COLS = 7; let row = 0
    ws[utils.encode_cell({r:row,c:0})] = cv(`${cari.ad.toUpperCase()} - CARI EKSTRE`, {font:{name:'Calibri',sz:13,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:KOYU}},alignment:{horizontal:'left',vertical:'center'}})
    for(let i=1;i<COLS;i++) ws[utils.encode_cell({r:row,c:i})] = cv('',{fill:{fgColor:{rgb:KOYU}}})
    merges.push({s:{r:row,c:0},e:{r:row,c:COLS-1}}); row++
    const bilgiS = {font:{name:'Calibri',sz:9,color:{rgb:KOYU}},fill:{fgColor:{rgb:'F1F5F9'}},alignment:{vertical:'center'},border}
    ;[['VKN/TCKN',cari.vkn_tckn||'-'],['Telefon',cari.telefon||'-'],['IBAN',cari.iban||'-'],['Adres',cari.adres||'-']].forEach(([k,v]) => {
      ws[utils.encode_cell({r:row,c:0})] = cv(k, {...bilgiS,font:{name:'Calibri',sz:9,bold:true,color:{rgb:KOYU}},fill:{fgColor:{rgb:'E2E8F0'}}})
      ws[utils.encode_cell({r:row,c:1})] = cv(v, bilgiS)
      for(let i=2;i<COLS;i++) ws[utils.encode_cell({r:row,c:i})] = cv('',bilgiS)
      merges.push({s:{r:row,c:1},e:{r:row,c:COLS-1}}); row++
    })
    row++
    ;['Tarih','Tur','Belge No','Aciklama','Borc','Alacak','Bakiye'].forEach((h,i)=>{ ws[utils.encode_cell({r:row,c:i})] = cv(h,sTh) }); row++
    let bakiye = 0
    ;(hareketler||[]).forEach((h:any,idx:number) => {
      const z = idx%2===1; const t = Number(h.tutar||0)
      const isAlacak = ['alacak','tahsilat','cek_alindi'].includes(h.tur)
      const borc = isAlacak ? 0 : t; const alacak = isAlacak ? t : 0
      bakiye += isAlacak ? t : -t
      ws[utils.encode_cell({r:row,c:0})] = cv(h.tarih ? new Date(h.tarih).toLocaleDateString('tr-TR') : '-', sTd(z))
      ws[utils.encode_cell({r:row,c:1})] = cv(HAREKET_TURLERI.find((t:any)=>t.v===h.tur)?.l||h.tur, sTd(z))
      ws[utils.encode_cell({r:row,c:2})] = cv(h.belge_no||'-', sTd(z))
      ws[utils.encode_cell({r:row,c:3})] = cv(h.aciklama||'-', sTd(z))
      ws[utils.encode_cell({r:row,c:4})] = borc>0 ? {v:borc, s:sPara(z,'991B1B'), t:'n'} : cv('-',sTd(z))
      ws[utils.encode_cell({r:row,c:5})] = alacak>0 ? {v:alacak, s:sPara(z,'166534'), t:'n'} : cv('-',sTd(z))
      ws[utils.encode_cell({r:row,c:6})] = {v:bakiye, s:sPara(z,bakiye>=0?'166534':'991B1B'), t:'n'}
      row++
    })
    ws['!cols'] = [{wch:12},{wch:14},{wch:14},{wch:30},{wch:16},{wch:16},{wch:16}]
    ws['!merges'] = merges; ws['!ref'] = utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}})
    const wb = utils.book_new(); utils.book_append_sheet(wb, ws, 'Ekstre')
    writeFile(wb, `ekstre-${cari.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }
  return (
    <div className="space-y-6">
      {/* Baslik */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <BookUser className="w-4 h-4 text-indigo-600" />
            </span>
            Cari Hesaplar
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 ml-10">
            {ozet.toplam} cari &middot; Alacak: {fmt(ozet.alacak)} &middot; Borc: {fmt(ozet.borc)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40" />
          </div>
          <select value={tipF} onChange={e => setTipF(e.target.value)} className={inputCls + ' w-auto text-sm'}>
            <option value="hepsi">Tum Tipler</option>
            {CARI_TIPLER.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <Btn variant="secondary" size="sm" icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => exportExcel()}>Excel</Btn>
          <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Cari</Btn>
        </div>
      </div>

      {/* Ozet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Toplam Cari</p>
          <p className="text-2xl font-bold text-gray-900">{ozet.toplam}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-600" />Toplam Alacak</p>
          <p className="text-2xl font-bold text-green-700">{fmt(ozet.alacak)}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-600" />Toplam Borc</p>
          <p className="text-2xl font-bold text-red-700">{fmt(ozet.borc)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${ozet.net >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" />Net Bakiye</p>
          <p className={`text-2xl font-bold ${ozet.net >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>{fmt(Math.abs(ozet.net))}</p>
          <p className="text-xs text-gray-400 mt-1">{ozet.net >= 0 ? 'Net Alacak' : 'Net Borc'}</p>
        </div>
      </div>

      {/* Liste */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<BookUser className="w-10 h-10" />} message="Cari hesap bulunamadi" />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(c => (
              <div key={c.id} onContextMenu={e => handleContextMenu(e, c)}>
                <CariSatiri
                  cari={c}
                  firmaId={firma.id}
                  expanded={expanded === c.id}
                  onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                  onEdit={() => openEdit(c)}
                  onDelete={() => setDelId(c.id)}
                  onRefresh={load}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Cari Modal */}
      {modal && (
        <Modal title={editing ? 'Cari Duzenle' : 'Yeni Cari Hesap'} onClose={() => setModal(false)} size="lg"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>Iptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cari Ad / Unvan" required className="md:col-span-2">
              <input type="text" value={form.ad} onChange={sf('ad')} className={inputCls} />
            </Field>
            <Field label="Tip">
              <select value={form.tip} onChange={sf('tip')} className={inputCls}>
                {CARI_TIPLER.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <Field label="VKN / TCKN">
              <input type="text" value={form.vkn_tckn} onChange={sf('vkn_tckn')} className={inputCls} />
            </Field>
            <Field label="Telefon">
              <input type="text" value={form.telefon} onChange={sf('telefon')} className={inputCls} />
            </Field>
            <Field label="E-posta">
              <input type="email" value={form.email} onChange={sf('email')} className={inputCls} />
            </Field>
            <Field label="IBAN" className="md:col-span-2">
              <input type="text" value={form.iban} onChange={sf('iban')} className={`${inputCls} font-mono`} placeholder="TR..." />
            </Field>
            <Field label="Adres" className="md:col-span-2">
              <textarea rows={2} value={form.adres} onChange={sf('adres')} className={inputCls} />
            </Field>
            <Field label="Notlar" className="md:col-span-2">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu cari hesabi silmek istediginize emin misiniz?"
          onConfirm={async () => { await supabase.from('cari_hesaplar').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)} />
      )}

      {/* Sag Tik Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 min-w-52"
            style={{ left: contextMenu.x, top: contextMenu.y }}>
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-900 truncate">{contextMenu.cari.ad}</p>
              <p className="text-xs text-gray-400">{CARI_TIPLER.find(t => t.v === contextMenu.cari.tip)?.l}</p>
            </div>
            <button onClick={() => { exportCariDetay(contextMenu.cari); setContextMenu(null) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Ekstre Excel Indir
            </button>
            <button onClick={() => { openEdit(contextMenu.cari); setContextMenu(null) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Edit className="w-4 h-4" /> Duzenle
            </button>
            <button onClick={() => { setDelId(contextMenu.cari.id); setContextMenu(null) }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Sil
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Cari Satiri Bileseni ──────────────────────────────────────
function CariSatiri({ cari, firmaId, expanded, onToggle, onEdit, onDelete, onRefresh }: {
  cari: any; firmaId: string; expanded: boolean
  onToggle: () => void; onEdit: () => void; onDelete: () => void; onRefresh: () => void
}) {
  const [hareketler, setHareketler] = useState<any[]>([])
  const [belgeler, setBelgeler]     = useState<any[]>([])
  const [loading, setLoading]       = useState(false)
  const [aktifTab, setAktifTab]     = useState<'hareketler'|'belgeler'>('hareketler')
  const [hareketModal, setHareketModal] = useState(false)
  const [editingH, setEditingH]     = useState<any | null>(null)
  const [savingH, setSavingH]       = useState(false)
  const [hForm, setHForm]           = useState(emptyHareket)
  const [delHId, setDelHId]         = useState<string | null>(null)
  const [preview, setPreview]       = useState<{ url: string; adi: string } | null>(null)
  const belgeRef = useRef<HTMLInputElement>(null)
  const [belgeTuru, setBelgeTuru]   = useState('fatura')

  useEffect(() => { if (expanded) loadData() }, [expanded])

  async function loadData() {
    setLoading(true)
    const [h, b] = await Promise.all([
      supabase.from('cari_hareketler').select('*').eq('cari_hesap_id', cari.id).order('tarih', { ascending: false }),
      supabase.from('cari_belgeler').select('*').eq('cari_hesap_id', cari.id).order('created_at', { ascending: false }),
    ])
    setHareketler(h.data || [])
    setBelgeler(b.data || [])
    setLoading(false)
  }

  const bakiye = useMemo(() => {
    return hareketler.reduce((s, h) => {
      const t = Number(h.tutar || 0)
      if (['alacak', 'tahsilat', 'cek_alindi'].includes(h.tur)) return s + t
      if (['borc', 'odeme', 'cek_verildi', 'fatura'].includes(h.tur)) return s - t
      return s
    }, 0)
  }, [hareketler])

  async function saveHareket() {
    if (!hForm.tutar || !hForm.tur) return alert('Tur ve tutar zorunludur')
    setSavingH(true)
    const payload = {
      firma_id: firmaId, cari_hesap_id: cari.id,
      tarih: hForm.tarih, tur: hForm.tur,
      tutar: Number(hForm.tutar), aciklama: hForm.aciklama || null,
      belge_no: hForm.belge_no || null, odeme_durumu: hForm.odeme_durumu,
      odeme_tarihi: hForm.odeme_tarihi || null, kaynak: 'manuel',
    }
    if (editingH) {
      await supabase.from('cari_hareketler').update(payload).eq('id', editingH.id)
    } else {
      await supabase.from('cari_hareketler').insert(payload)
    }
    // Bakiyeyi guncelle
    await supabase.from('cari_hesaplar').update({ bakiye: bakiye }).eq('id', cari.id)
    setSavingH(false); setHareketModal(false); setEditingH(null); loadData(); onRefresh()
  }

  async function hareketSil(id: string) {
    if (!confirm('Bu hareket silinsin mi?')) return
    await supabase.from('cari_hareketler').delete().eq('id', id)
    loadData(); onRefresh()
  }

  async function belgeYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const path = `${firmaId}/cari/${cari.id}/${belgeTuru}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('cari-belgeler').upload(path, file)
    if (error) { alert('Yukleme hatasi: ' + error.message); return }
    await supabase.from('cari_belgeler').insert({
      firma_id: firmaId, cari_hesap_id: cari.id,
      belge_turu: belgeTuru, dosya_adi: file.name, storage_path: path,
    })
    if (belgeRef.current) belgeRef.current.value = ''
    loadData()
  }

  async function belgeOnizle(b: any) {
    const { data } = await supabase.storage.from('cari-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) setPreview({ url: data.signedUrl, adi: b.dosya_adi })
  }

  async function belgeIndir(b: any) {
    const { data } = await supabase.storage.from('cari-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = b.dosya_adi; a.click() }
  }

  async function belgeSil(b: any) {
    if (!confirm(`"${b.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('cari-belgeler').remove([b.storage_path])
    await supabase.from('cari_belgeler').delete().eq('id', b.id)
    loadData()
  }

  const tipRenk = CARI_TIPLER.find(t => t.v === cari.tip)
  const bakiyeRenk = bakiye > 0 ? 'text-green-600' : bakiye < 0 ? 'text-red-600' : 'text-gray-500'

  return (
    <>
      <div className="border-b border-gray-100 last:border-0">
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
          <span className="text-gray-400">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{cari.ad}</span>
              {tipRenk && <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{tipRenk.l}</span>}
              {cari.vkn_tckn && <span className="text-xs text-gray-400 font-mono">{cari.vkn_tckn}</span>}
            </div>
            <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-500 flex-wrap">
              {cari.telefon && <span>{cari.telefon}</span>}
              {cari.iban && <span className="font-mono">{cari.iban}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-sm font-bold ${bakiyeRenk}`}>{fmt(Math.abs(bakiye))}</p>
            <p className="text-xs text-gray-400">{bakiye >= 0 ? 'Alacak' : 'Borc'}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {expanded && (
          <div className="bg-slate-50 border-t border-gray-200">
            {loading ? (
              <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                {/* Cari bilgi satiri */}
                <div className="px-4 py-3 bg-white border-b border-gray-100 flex flex-wrap gap-4 text-xs text-gray-600">
                  {cari.email && <span>✉ {cari.email}</span>}
                  {cari.iban && <span className="font-mono">🏦 {cari.iban}</span>}
                  {cari.adres && <span>📍 {cari.adres}</span>}
                  <span className={`font-bold ml-auto ${bakiyeRenk}`}>Bakiye: {fmt(Math.abs(bakiye))} ({bakiye >= 0 ? 'Alacak' : 'Borc'})</span>
                </div>

                {/* Sekmeler */}
                <div className="flex border-b border-gray-200 bg-white px-4">
                  {([
                    { v: 'hareketler', l: 'Hareketler', sayi: hareketler.length },
                    { v: 'belgeler',   l: 'Belgeler',   sayi: belgeler.length   },
                  ] as const).map(bt => (
                    <button key={bt.v} onClick={() => setAktifTab(bt.v)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${aktifTab === bt.v ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                      {bt.l}
                      {bt.sayi > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${aktifTab === bt.v ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>{bt.sayi}</span>}
                    </button>
                  ))}
                </div>

                {/* Hareketler */}
                {aktifTab === 'hareketler' && (
                  <div className="p-4 space-y-3">
                    {hareketler.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Henuz hareket kaydi yok</p>}
                    <div className="space-y-2">
                      {hareketler.map(h => {
                        const turBilgi = HAREKET_TURLERI.find(t => t.v === h.tur)
                        const isAlacak = ['alacak', 'tahsilat', 'cek_alindi'].includes(h.tur)
                        return (
                          <div key={h.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isAlacak ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{turBilgi?.l || h.tur}</span>
                                {h.belge_no && <span className="text-xs text-gray-500">#{h.belge_no}</span>}
                                {h.kaynak && h.kaynak !== 'manuel' && <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{h.kaynak === 'proje_gider' ? 'Proje Gideri' : h.kaynak === 'odeme_plani' ? 'Odeme Plani' : h.kaynak}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                <span>{fmtDate(h.tarih)}</span>
                                {h.aciklama && <span className="truncate">{h.aciklama}</span>}
                                {h.odeme_durumu && h.odeme_durumu !== 'bekliyor' && <Badge label={h.odeme_durumu === 'odendi' ? 'Odendi' : 'Bekliyor'} variant={h.odeme_durumu === 'odendi' ? 'green' : 'yellow'} />}
                              </div>
                            </div>
                            <div className={`text-sm font-bold flex-shrink-0 ${isAlacak ? 'text-green-600' : 'text-red-600'}`}>
                              {isAlacak ? '+' : '-'}{fmt(Number(h.tutar))}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => { setHForm({ tarih: h.tarih, tur: h.tur, tutar: String(h.tutar), aciklama: h.aciklama || '', belge_no: h.belge_no || '', odeme_durumu: h.odeme_durumu || 'bekliyor', odeme_tarihi: h.odeme_tarihi || '' }); setEditingH(h); setHareketModal(true) }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => hareketSil(h.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setHForm(emptyHareket); setEditingH(null); setHareketModal(true) }}>Yeni Hareket</Btn>
                  </div>
                )}

                {/* Belgeler */}
                {aktifTab === 'belgeler' && (
                  <div className="p-4 space-y-3">
                    {belgeler.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Henuz belge yuklenmedi</p>}
                    <div className="space-y-2">
                      {belgeler.map(b => (
                        <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{b.dosya_adi}</p>
                            <p className="text-xs text-gray-400">{BELGE_TURLERI.find(t => t.v === b.belge_turu)?.l || b.belge_turu} &middot; {fmtDate(b.created_at)}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => belgeOnizle(b)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => belgeIndir(b)} className="p-1.5 text-gray-400 hover:text-green-600 rounded"><Download className="w-3.5 h-3.5" /></button>
                            <button onClick={() => belgeSil(b)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={belgeTuru} onChange={e => setBelgeTuru(e.target.value)} className={inputCls + ' w-auto text-sm'}>
                        {BELGE_TURLERI.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                      <input ref={belgeRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx" className="hidden" onChange={belgeYukle} />
                      <Btn size="sm" variant="secondary" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => belgeRef.current?.click()}>Belge Yukle</Btn>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Hareket Modal */}
      {hareketModal && (
        <Modal title={editingH ? 'Hareket Duzenle' : 'Yeni Hareket'} onClose={() => { setHareketModal(false); setEditingH(null) }} size="md"
          footer={<><Btn variant="secondary" onClick={() => { setHareketModal(false); setEditingH(null) }}>Iptal</Btn><Btn onClick={saveHareket} disabled={savingH}>{savingH ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tarih" required>
              <input type="date" value={hForm.tarih} onChange={e => setHForm(p => ({ ...p, tarih: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Hareket Turu" required>
              <select value={hForm.tur} onChange={e => setHForm(p => ({ ...p, tur: e.target.value }))} className={inputCls}>
                {HAREKET_TURLERI.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <Field label="Tutar (TL)" required>
              <input type="number" step="0.01" value={hForm.tutar} onChange={e => setHForm(p => ({ ...p, tutar: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Belge No">
              <input type="text" value={hForm.belge_no} onChange={e => setHForm(p => ({ ...p, belge_no: e.target.value }))} className={inputCls} placeholder="Fatura/Cek no..." />
            </Field>
            <Field label="Odeme Durumu">
              <select value={hForm.odeme_durumu} onChange={e => setHForm(p => ({ ...p, odeme_durumu: e.target.value }))} className={inputCls}>
                <option value="bekliyor">Bekliyor</option>
                <option value="odendi">Odendi</option>
                <option value="kismi">Kismi</option>
              </select>
            </Field>
            <Field label="Odeme Tarihi">
              <input type="date" value={hForm.odeme_tarihi} onChange={e => setHForm(p => ({ ...p, odeme_tarihi: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Aciklama" className="md:col-span-2">
              <textarea rows={2} value={hForm.aciklama} onChange={e => setHForm(p => ({ ...p, aciklama: e.target.value }))} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {/* Onizleme */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm truncate">{preview.adi}</span>
              <div className="flex gap-2">
                <button onClick={async () => { const a = document.createElement('a'); a.href = preview.url; a.download = preview.adi; a.click() }} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" />Indir</button>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {preview.adi.toLowerCase().endsWith('.pdf')
                ? <iframe src={preview.url} className="w-full h-full min-h-[60vh]" />
                : <img src={preview.url} alt={preview.adi} className="max-w-full mx-auto" />
              }
            </div>
          </div>
        </div>
      )}
    </>
  )
}
