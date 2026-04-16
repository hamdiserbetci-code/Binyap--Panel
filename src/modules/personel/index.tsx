'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Users, Plus, Edit, Trash2, Search, Download, Filter, X, FileText, ChevronDown, ChevronRight, Eye, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Personel, Proje } from '@/types'

const POZISYONLAR = ['Kalıpçı Ustası','Kalıpçı Yardımcısı','Demir Ustası','Beton İşçisi','Şantiye Şefi','Mühendis','Tekniker','Operatör','Sürücü','Güvenlik','Diğer']
const MAAS_TIPLERI = [{ v: 'aylik', l: 'Aylık' }, { v: 'gundelik', l: 'Gündelik' }, { v: 'saatlik', l: 'Saatlik' }]
const empty = { ad_soyad:'', tc_kimlik:'', telefon:'', pozisyon:'', maas_tipi:'aylik', net_maas:'', brut_maas:'', ise_giris_tarihi:'', isten_cikis_tarihi:'', varsayilan_proje_id:'', sgk_no:'', banka_iban:'', notlar:'', aktif: true }

interface EkipRow { id: string; ad: string; ekip_adi?: string; proje_id: string }
interface EkipBag { ekip_id: string; personel_id: string }

export default function PersonelModule({ firma }: AppCtx) {
  const [data, setData]         = useState<Personel[]>([])
  const [projeler, setProjeler] = useState<Pick<Proje,'id'|'proje_adi'>[]>([])
  const [ekipler, setEkipler]   = useState<EkipRow[]>([])
  const [ekipBag, setEkipBag]   = useState<EkipBag[]>([])
  const [loading, setLoading]   = useState(true)

  // Filtreler
  const [search, setSearch]       = useState('')
  const [aktifF, setAktifF]       = useState<'hepsi'|'aktif'|'pasif'>('aktif')
  const [projeF, setProjeF]       = useState('')
  const [ekipF, setEkipF]         = useState('')
  const [girisBasF, setGirisBasF] = useState('')
  const [girisBitF, setGirisBitF] = useState('')
  const [cikisBasF, setCikisBasF] = useState('')
  const [cikisBitF, setCikisBitF] = useState('')
  const [filtrePaneli, setFiltrePaneli] = useState(false)

  // Modal
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<Personel | null>(null)
  const [delId, setDelId]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState(empty)
  const [formEkipler, setFormEkipler] = useState<string[]>([])

  // Toplu seçim
  const [secili, setSecili]               = useState<Set<string>>(new Set())
  const [topluSilModal, setTopluSilModal] = useState(false)
  const [ekipAktarModal, setEkipAktarModal] = useState(false)
  const [aktarEkipId, setAktarEkipId]     = useState('')
  const [aktariyor, setAktariyor]         = useState(false)
  const [topluCikisModal, setTopluCikisModal] = useState(false)
  const [topluCikisTarihi, setTopluCikisTarihi] = useState('')
  const [topluCikisYapiliyor, setTopluCikisYapiliyor] = useState(false)

  // Belge paneli
  const [expandedPersonel, setExpandedPersonel] = useState<string | null>(null)

  // Toplu belge yükleme
  const topluBelgeRef = useRef<HTMLInputElement>(null)
  const [topluYukleniyor, setTopluYukleniyor] = useState(false)
  const [topluSonuc, setTopluSonuc] = useState<string | null>(null)

  async function handleTopluBelgeYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setTopluYukleniyor(true)
    setTopluSonuc(null)

    // Normalize yardımcı
    const norm = (s: string) => s.toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()

    // Belge türü tespiti
    const belgeTuruTespit = (dosyaAdi: string): string => {
      const n = norm(dosyaAdi)
      if (n.includes('kimlik') || n.includes('nufus') || n.includes('tc')) return 'kimlik'
      if (n.includes('giris') || n.includes('bildirge') || n.includes('sgk')) return 'ise_giris'
      if (n.includes('cikis') || n.includes('ihbar') || n.includes('kidem')) return 'isten_cikis'
      if (n.includes('ikametgah') || n.includes('ikamet') || n.includes('adres')) return 'ikametgah'
      if (n.includes('sabika') || n.includes('adli') || n.includes('sicil')) return 'sabika'
      return 'diger'
    }

    // Personel eşleştirme — dosya adındaki ismi personel listesiyle karşılaştır
    const personelBul = (dosyaAdi: string): Personel | null => {
      const dosyaNorm = norm(dosyaAdi.replace(/\.[^.]+$/, '')) // uzantıyı kaldır
      // En iyi eşleşmeyi bul
      let enIyi: Personel | null = null
      let enIyiSkor = 0
      for (const p of data) {
        const adNorm = norm(p.ad_soyad)
        const adParcalar = adNorm.split(' ')
        // Kaç kelime eşleşiyor?
        const eslesenKelime = adParcalar.filter(k => k.length > 1 && dosyaNorm.includes(k)).length
        if (eslesenKelime > enIyiSkor) {
          enIyiSkor = eslesenKelime
          enIyi = p
        }
      }
      return enIyiSkor >= 1 ? enIyi : null
    }

    let basarili = 0, eslesmedi = 0
    const sonuclar: string[] = []

    for (const file of files) {
      const personel = personelBul(file.name)
      if (!personel) {
        eslesmedi++
        sonuclar.push(`❌ ${file.name} — personel bulunamadı`)
        continue
      }
      const belgeTuru = belgeTuruTespit(file.name)
      const safeName = file.name
        .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
        .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
        .replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ş/g,'S')
        .replace(/İ/g,'I').replace(/Ö/g,'O').replace(/Ç/g,'C')
        .replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
      const path = `${firma.id}/${personel.id}/${belgeTuru}/${Date.now()}_${safeName}`
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'bin'

      const { error } = await supabase.storage.from('personel-belgeler').upload(path, file)
      if (error) { sonuclar.push(`❌ ${file.name} — yükleme hatası: ${error.message}`); eslesmedi++; continue }

      await supabase.from('personel_belgeler').insert({
        personel_id: personel.id, firma_id: firma.id,
        belge_turu: belgeTuru, dosya_adi: file.name,
        storage_path: path, belge_tipi: ext,
      })
      basarili++
      sonuclar.push(`✓ ${file.name} → ${personel.ad_soyad} (${belgeTuru})`)
    }

    setTopluSonuc(`${basarili} yüklendi, ${eslesmedi} eşleşmedi\n\n${sonuclar.join('\n')}`)
    setTopluYukleniyor(false)
    if (topluBelgeRef.current) topluBelgeRef.current.value = ''
  }

  async function load() {
    setLoading(true)
    const [p, pr, ek] = await Promise.all([
      supabase.from('personeller').select('*').eq('firma_id', firma.id).order('ad_soyad'),
      supabase.from('projeler').select('id, proje_adi').eq('firma_id', firma.id),
      supabase.from('ekipler').select('id, ad, proje_id').eq('firma_id', firma.id).eq('aktif', true),
    ])

    const ekiplerData = ek.data || []
    const ekipIds = ekiplerData.map(e => e.id)

    // ekip_personel: sadece bu firmanın ekiplerine ait bağlantılar
    let ebData: EkipBag[] = []
    if (ekipIds.length > 0) {
      const { data: eb } = await supabase
        .from('ekip_personel')
        .select('ekip_id, personel_id')
        .in('ekip_id', ekipIds)
      ebData = eb || []
    }

    setData(p.data || [])
    setProjeler(pr.data || [])
    setEkipler(ekiplerData)
    setEkipBag(ebData)
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const filtreliEkipler = useMemo(() =>
    projeF ? ekipler.filter(e => e.proje_id === projeF) : ekipler
  , [ekipler, projeF])

  const personelEkipleri = (personelId: string): EkipRow[] =>
    ekipBag.filter(b => b.personel_id === personelId)
      .map(b => ekipler.find(e => e.id === b.ekip_id))
      .filter(Boolean) as EkipRow[]

  // Ekip adını döndür (ad veya ekip_adi)
  const getEkipAdi = (e: EkipRow) => e.ad || e.ekip_adi || '-'

  const filtered = useMemo(() => data.filter(r => {
    if (aktifF === 'aktif' && !r.aktif) return false
    if (aktifF === 'pasif' && r.aktif) return false
    if (search && !r.ad_soyad.toLowerCase().includes(search.toLowerCase()) && !r.pozisyon?.toLowerCase().includes(search.toLowerCase())) return false
    if (projeF && r.varsayilan_proje_id !== projeF) return false
    if (ekipF && !ekipBag.some(b => b.personel_id === r.id && b.ekip_id === ekipF)) return false
    if (girisBasF && (!r.ise_giris_tarihi || r.ise_giris_tarihi < girisBasF)) return false
    if (girisBitF && (!r.ise_giris_tarihi || r.ise_giris_tarihi > girisBitF)) return false
    if (cikisBasF && (!r.isten_cikis_tarihi || r.isten_cikis_tarihi < cikisBasF)) return false
    if (cikisBitF && (!r.isten_cikis_tarihi || r.isten_cikis_tarihi > cikisBitF)) return false
    return true
  }), [data, aktifF, search, projeF, ekipF, girisBasF, girisBitF, cikisBasF, cikisBitF, ekipBag])

  const summary = useMemo(() => ({
    toplam: data.length,
    aktif:  data.filter(r => r.aktif).length,
    maas:   data.filter(r => r.aktif).reduce((s, r) => s + Number(r.net_maas || 0), 0),
  }), [data])

  const aktifFiltreSayisi = [projeF, ekipF, girisBasF, girisBitF, cikisBasF, cikisBitF].filter(Boolean).length + (aktifF !== 'aktif' ? 1 : 0)

  function temizle() { setProjeF(''); setEkipF(''); setGirisBasF(''); setGirisBitF(''); setCikisBasF(''); setCikisBitF(''); setAktifF('aktif') }

  function toggleSecim(id: string) {
    setSecili(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function tumunuSec() {
    setSecili(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id)))
  }
  async function topluSil() {
    await supabase.from('personeller').delete().in('id', Array.from(secili))
    setSecili(new Set()); setTopluSilModal(false); load()
  }

  async function topluCikisYap() {
    if (!topluCikisTarihi) return alert('Çıkış tarihi seçiniz')
    setTopluCikisYapiliyor(true)
    await supabase.from('personeller')
      .update({ isten_cikis_tarihi: topluCikisTarihi, aktif: false })
      .in('id', Array.from(secili))
    setTopluCikisYapiliyor(false)
    setTopluCikisModal(false)
    setTopluCikisTarihi('')
    setSecili(new Set())
    load()
  }

  function openNew() { setForm(empty); setFormEkipler([]); setEditing(null); setModal(true) }

  async function ekibeAktar() {
    if (!aktarEkipId) return alert('Ekip seçiniz')
    setAktariyor(true)
    let eklendi = 0, atlandi = 0
    const hatalar: string[] = []
    for (const personelId of Array.from(secili)) {
      // Önce mevcut bağlantıyı sil (varsa), sonra yeniden ekle
      await supabase.from('ekip_personel').delete()
        .eq('ekip_id', aktarEkipId).eq('personel_id', personelId)
      const { error } = await supabase.from('ekip_personel')
        .insert({ ekip_id: aktarEkipId, personel_id: personelId, aktif: true })
      if (!error) eklendi++
      else { atlandi++; hatalar.push(error.message) }
    }
    setAktariyor(false); setEkipAktarModal(false); setAktarEkipId(''); setSecili(new Set()); load()
    const hataStr = hatalar.length > 0 ? `\n\nHata: ${[...new Set(hatalar)].join(', ')}` : ''
    alert(`✓ ${eklendi} personel ekibe eklendi\n⟳ ${atlandi} hatalı${hataStr}`)
  }

  async function openEdit(r: Personel) {
    setForm({ ad_soyad: r.ad_soyad, tc_kimlik: r.tc_kimlik||'', telefon: r.telefon||'', pozisyon: r.pozisyon||'', maas_tipi: r.maas_tipi, net_maas: String(r.net_maas||''), brut_maas: String(r.brut_maas||''), ise_giris_tarihi: r.ise_giris_tarihi||'', isten_cikis_tarihi: r.isten_cikis_tarihi||'', varsayilan_proje_id: r.varsayilan_proje_id||'', sgk_no: r.sgk_no||'', banka_iban: r.banka_iban||'', notlar:'', aktif: r.aktif })
    const mevcutEkipler = ekipBag.filter(b => b.personel_id === r.id).map(b => b.ekip_id)
    setFormEkipler(mevcutEkipler)
    setEditing(r); setModal(true)
  }

  async function save() {
    if (!form.ad_soyad) return alert('Ad Soyad zorunludur')
    setSaving(true)
    const payload = { ad_soyad: form.ad_soyad, tc_kimlik: form.tc_kimlik||null, telefon: form.telefon||null, pozisyon: form.pozisyon||null, maas_tipi: form.maas_tipi as Personel['maas_tipi'], net_maas: form.net_maas ? Number(form.net_maas) : null, brut_maas: form.brut_maas ? Number(form.brut_maas) : null, ise_giris_tarihi: form.ise_giris_tarihi||null, isten_cikis_tarihi: form.isten_cikis_tarihi||null, varsayilan_proje_id: form.varsayilan_proje_id||null, sgk_no: form.sgk_no||null, banka_iban: form.banka_iban||null, aktif: form.aktif }

    let personelId = editing?.id
    if (editing) {
      await supabase.from('personeller').update(payload).eq('id', editing.id)
    } else {
      const { data: yeni } = await supabase.from('personeller').insert({ ...payload, firma_id: firma.id }).select().single()
      personelId = yeni?.id
    }

    // Ekip bağlantılarını güncelle
    if (personelId) {
      await supabase.from('ekip_personel').delete().eq('personel_id', personelId)
      if (formEkipler.length > 0) {
        await supabase.from('ekip_personel').insert(
          formEkipler.map(ekipId => ({ ekip_id: ekipId, personel_id: personelId, aktif: true }))
        )
      }
    }

    setSaving(false); setModal(false); load()
  }

  const sf = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function exportExcel() {
    // Belgeleri çek
    const { data: tumBelgeler } = await supabase
      .from('personel_belgeler')
      .select('personel_id, belge_turu')
      .eq('firma_id', firma.id)

    // personel_id → Set<belge_turu>
    const belgeMap: Record<string, Set<string>> = {}
    ;(tumBelgeler || []).forEach((b: any) => {
      if (!belgeMap[b.personel_id]) belgeMap[b.personel_id] = new Set()
      belgeMap[b.personel_id].add(b.belge_turu)
    })

    const XLSXStyle = await import('xlsx-js-style')
    const { utils, writeFile } = XLSXStyle
    const KOYU='0F172A';const BEYAZ='FFFFFF';const ACIK='F8FAFC';const SINIR='E2E8F0';const MAVI='1E40AF'
    const border={top:{style:'thin',color:{rgb:SINIR}},bottom:{style:'thin',color:{rgb:SINIR}},left:{style:'thin',color:{rgb:SINIR}},right:{style:'thin',color:{rgb:SINIR}}}
    const c=(v:any,s:any)=>({v:v??'',s,t:typeof v==='number'?'n':'s'})
    const sTh={font:{name:'Calibri',sz:9,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:MAVI}},alignment:{horizontal:'center',vertical:'center'},border}
    const sThBelge={font:{name:'Calibri',sz:8,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:'0369A1'}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border}
    const sTd=(z:boolean)=>({font:{name:'Calibri',sz:9,color:{rgb:KOYU}},fill:{fgColor:{rgb:z?ACIK:BEYAZ}},alignment:{vertical:'center'},border})
    const sTdR=(z:boolean)=>({...sTd(z),alignment:{horizontal:'right',vertical:'center'},numFmt:'#,##0.00 \u20BA'})
    const sVar={font:{name:'Calibri',sz:11,bold:true,color:{rgb:'166534'}},fill:{fgColor:{rgb:'DCFCE7'}},alignment:{horizontal:'center',vertical:'center'},border}
    const sYok={font:{name:'Calibri',sz:11,bold:true,color:{rgb:'991B1B'}},fill:{fgColor:{rgb:'FEE2E2'}},alignment:{horizontal:'center',vertical:'center'},border}

    const BELGE_COLS = BELGE_TURLERI.map(b => b.v)
    const COLS = 9 + BELGE_COLS.length
    const ws:any={};const merges:any[]=[];let row=0

    ws[utils.encode_cell({r:row,c:0})]=c(`${firma.ad.toUpperCase()} — PERSONEL LİSTESİ`,{font:{name:'Calibri',sz:13,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:KOYU}},alignment:{horizontal:'left',vertical:'center'}})
    for(let i=1;i<COLS-1;i++) ws[utils.encode_cell({r:row,c:i})]=c('',{fill:{fgColor:{rgb:KOYU}}})
    ws[utils.encode_cell({r:row,c:COLS-1})]=c(new Date().toLocaleDateString('tr-TR'),{font:{name:'Calibri',sz:9,color:{rgb:'BFDBFE'}},fill:{fgColor:{rgb:KOYU}},alignment:{horizontal:'right',vertical:'center'}})
    merges.push({s:{r:row,c:0},e:{r:row,c:COLS-2}});row+=2

    // Başlık satırı — personel bilgileri + belge sütunları
    const headers = ['Ad Soyad','TC Kimlik','Pozisyon','Proje','Ekip(ler)','İşe Giriş','İşten Çıkış','Net Maaş (₺)','Durum']
    headers.forEach((h,i)=>{ws[utils.encode_cell({r:row,c:i})]=c(h,sTh)})
    BELGE_TURLERI.forEach((b,i)=>{ws[utils.encode_cell({r:row,c:9+i})]=c(b.l,sThBelge)})
    row++

    // Ekip bazında grupla
    const gruplar:Record<string,Personel[]>={}
    filtered.forEach(p=>{
      const pEk=personelEkipleri(p.id)
      if(pEk.length>0){pEk.forEach(ek=>{const key=getEkipAdi(ek);if(!gruplar[key])gruplar[key]=[];gruplar[key].push(p)})}
      else{if(!gruplar['Ekipsiz'])gruplar['Ekipsiz']=[];gruplar['Ekipsiz'].push(p)}
    })

    let idx=0
    Object.entries(gruplar).forEach(([grupAdi,personeller])=>{
      const gS={font:{name:'Calibri',sz:9,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:'1E3A5F'}},alignment:{horizontal:'left',vertical:'center'},border}
      ws[utils.encode_cell({r:row,c:0})]=c(`${grupAdi.toUpperCase()}  (${personeller.length} personel)`,gS)
      for(let i=1;i<COLS;i++) ws[utils.encode_cell({r:row,c:i})]=c('',gS)
      merges.push({s:{r:row,c:0},e:{r:row,c:COLS-1}});row++
      personeller.forEach(p=>{
        const z=idx%2===1
        const proje=projeler.find(pr=>pr.id===p.varsayilan_proje_id)
        const pEk=personelEkipleri(p.id).map(e=>getEkipAdi(e)).join(', ')
        ws[utils.encode_cell({r:row,c:0})]=c(p.ad_soyad,sTd(z))
        ws[utils.encode_cell({r:row,c:1})]=c(p.tc_kimlik||'-',{...sTd(z),alignment:{horizontal:'center',vertical:'center'}})
        ws[utils.encode_cell({r:row,c:2})]=c(p.pozisyon||'-',sTd(z))
        ws[utils.encode_cell({r:row,c:3})]=c(proje?.proje_adi||'-',sTd(z))
        ws[utils.encode_cell({r:row,c:4})]=c(pEk||'-',sTd(z))
        ws[utils.encode_cell({r:row,c:5})]=c(p.ise_giris_tarihi?new Date(p.ise_giris_tarihi).toLocaleDateString('tr-TR'):'-',sTd(z))
        ws[utils.encode_cell({r:row,c:6})]=c(p.isten_cikis_tarihi?new Date(p.isten_cikis_tarihi).toLocaleDateString('tr-TR'):'-',sTd(z))
        ws[utils.encode_cell({r:row,c:7})]=p.net_maas?{v:Number(p.net_maas),s:sTdR(z),t:'n'}:c('-',sTd(z))
        ws[utils.encode_cell({r:row,c:8})]=c(p.aktif?'Aktif':'Pasif',{...sTd(z),font:{name:'Calibri',sz:9,bold:true,color:{rgb:p.aktif?'166534':'991B1B'}}})
        // Belge sütunları
        const pBelgeler = belgeMap[p.id] || new Set()
        BELGE_COLS.forEach((bv, bi) => {
          const var_ = pBelgeler.has(bv)
          ws[utils.encode_cell({r:row,c:9+bi})]=c(var_?'✓':'✗', var_?sVar:sYok)
        })
        row++;idx++
      })
    })

    const topS={font:{name:'Calibri',sz:10,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:'1E293B'}},alignment:{horizontal:'left',vertical:'center'},border:{top:{style:'medium',color:{rgb:KOYU}},bottom:{style:'medium',color:{rgb:KOYU}},left:{style:'thin',color:{rgb:KOYU}},right:{style:'thin',color:{rgb:KOYU}}}}
    ws[utils.encode_cell({r:row,c:0})]=c(`TOPLAM: ${filtered.length} personel`,topS)
    for(let i=1;i<7;i++) ws[utils.encode_cell({r:row,c:i})]=c('',topS)
    ws[utils.encode_cell({r:row,c:7})]={v:filtered.filter(p=>p.aktif).reduce((s,p)=>s+Number(p.net_maas||0),0),s:{...topS,alignment:{horizontal:'right',vertical:'center'},numFmt:'#,##0.00 \u20BA'},t:'n'}
    for(let i=8;i<COLS;i++) ws[utils.encode_cell({r:row,c:i})]=c('',topS)
    merges.push({s:{r:row,c:0},e:{r:row,c:6}});row++

    ws['!cols']=[
      {wch:24},{wch:14},{wch:18},{wch:18},{wch:22},{wch:12},{wch:12},{wch:16},{wch:8},
      ...BELGE_TURLERI.map(()=>({wch:12}))
    ]
    ws['!merges']=merges
    ws['!ref']=utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}})
    const wb=utils.book_new();utils.book_append_sheet(wb,ws,'Personel')
    writeFile(wb,`personel-${firma.ad}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* Header + Filtreler tek satırda */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-sky-600" /></span>
              Personel
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 ml-10">
              {summary.toplam} toplam · {summary.aktif} aktif · {fmt(summary.maas)} aylık maaş
              {filtered.length !== data.length && <span className="text-sky-600 ml-2">({filtered.length} gösteriliyor)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Arama */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 w-40" />
            </div>
            {/* Filtre butonu */}
            <button
              onClick={() => setFiltrePaneli(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${filtrePaneli || aktifFiltreSayisi > 0 ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtre
              {aktifFiltreSayisi > 0 && <span className="bg-sky-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{aktifFiltreSayisi}</span>}
            </button>
            {aktifFiltreSayisi > 0 && <button onClick={temizle} className="text-xs text-red-500 hover:underline flex items-center gap-1"><X className="w-3 h-3" />Temizle</button>}
            {secili.size > 0 && (
              <>
                <Btn variant="secondary" size="sm" icon={<Users className="w-4 h-4" />} onClick={() => { setAktarEkipId(''); setEkipAktarModal(true) }}>
                  Ekibe Aktar
                </Btn>
                <Btn variant="secondary" size="sm" icon={<X className="w-4 h-4" />} onClick={() => { setTopluCikisTarihi(''); setTopluCikisModal(true) }}>
                  Çıkış Yap
                </Btn>
                <Btn variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => setTopluSilModal(true)}>
                  {secili.size} Sil
                </Btn>
              </>
            )}
            <Btn variant="secondary" size="sm" icon={topluYukleniyor ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />} onClick={() => topluBelgeRef.current?.click()} disabled={topluYukleniyor}>
              Toplu Belge
            </Btn>
            <Btn variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportExcel}>Excel</Btn>
            <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni</Btn>
          </div>
        </div>

        {/* Toplu belge yükleme sonucu */}
        {topluSonuc && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs whitespace-pre-line text-gray-700 max-h-40 overflow-y-auto">
            <div className="flex justify-between items-start gap-2">
              <span>{topluSonuc}</span>
              <button onClick={() => setTopluSonuc(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
            </div>
          </div>
        )}

        {/* Gizli toplu belge input */}
        <input ref={topluBelgeRef} type="file" accept=".jpg,.jpeg,.png,.pdf" multiple className="hidden" onChange={handleTopluBelgeYukle} />

        {/* Filtre paneli — açılır kapanır */}
        {filtrePaneli && (
          <Card className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 items-end">
              <select value={aktifF} onChange={e => setAktifF(e.target.value as any)} className={inputCls + ' text-xs'}>
                <option value="hepsi">Tüm Durum</option>
                <option value="aktif">Aktif</option>
                <option value="pasif">Pasif</option>
              </select>
              <select value={projeF} onChange={e => { setProjeF(e.target.value); setEkipF('') }} className={inputCls + ' text-xs'}>
                <option value="">Tüm Projeler</option>
                {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
              </select>
              <select value={ekipF} onChange={e => setEkipF(e.target.value)} className={inputCls + ' text-xs'}>
                <option value="">Tüm Ekipler</option>
                {filtreliEkipler.map(e => <option key={e.id} value={e.id}>{getEkipAdi(e)}</option>)}
              </select>
              <div>
                <p className="text-xs text-gray-500 mb-1">Giriş Başlangıç</p>
                <input type="date" value={girisBasF} onChange={e => setGirisBasF(e.target.value)} className={inputCls + ' text-xs'} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Giriş Bitiş</p>
                <input type="date" value={girisBitF} onChange={e => setGirisBitF(e.target.value)} className={inputCls + ' text-xs'} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Çıkış Başlangıç</p>
                <input type="date" value={cikisBasF} onChange={e => setCikisBasF(e.target.value)} className={inputCls + ' text-xs'} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Çıkış Bitiş</p>
                <input type="date" value={cikisBitF} onChange={e => setCikisBitF(e.target.value)} className={inputCls + ' text-xs'} />
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card>
        {loading ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" checked={filtered.length>0&&secili.size===filtered.length} onChange={tumunuSec} className="w-4 h-4 rounded text-sky-600" />
                  </th>
                  {['Ad Soyad','Pozisyon','Ekip','Proje','Net Maaş','İşe Giriş','İşten Çıkış','Durum',''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const proje    = projeler.find(p => p.id === r.varsayilan_proje_id)
                  const pEkipler = personelEkipleri(r.id)
                  return (
                    <React.Fragment key={r.id}>
                    <tr className={`hover:bg-gray-50 ${secili.has(r.id)?'bg-sky-50':''}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={secili.has(r.id)} onChange={() => toggleSecim(r.id)} className="w-4 h-4 rounded text-sky-600" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-sm text-gray-900">{r.ad_soyad}</div>
                        {r.tc_kimlik && <div className="text-xs text-gray-400 font-mono">{r.tc_kimlik}</div>}
                      </td>                      <td className="px-3 py-3 text-sm text-gray-700">{r.pozisyon||'-'}</td>
                      <td className="px-3 py-3">
                        {pEkipler.length>0
                          ? pEkipler.map(e=><span key={e.id} className="inline-block bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded mr-1 mb-0.5">{getEkipAdi(e)}</span>)
                          : <span className="text-gray-400 text-sm">-</span>}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">{proje?.proje_adi||'-'}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-900">{r.net_maas?fmt(Number(r.net_maas)):'-'}</td>
                      <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.ise_giris_tarihi)||'-'}</td>
                      <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtDate(r.isten_cikis_tarihi)||'-'}</td>
                      <td className="px-3 py-3"><Badge label={r.aktif?'Aktif':'Pasif'} variant={r.aktif?'green':'red'} /></td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setExpandedPersonel(expandedPersonel === r.id ? null : r.id)} className={`p-1 rounded ${expandedPersonel === r.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600'}`} title="Belgeler">
                            <FileText className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDelId(r.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedPersonel === r.id && (
                      <tr key={`${r.id}-belgeler`}>
                        <td colSpan={10} className="px-3 pb-3 bg-blue-50">
                          <PersonelBelgeler personelId={r.id} firmaId={firma.id} personelAdi={r.ad_soyad} />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
            {filtered.length===0 && <EmptyState icon={<Users className="w-10 h-10" />} message="Personel bulunamadı" />}
          </div>
        )}
      </Card>

      {modal && (
        <Modal title={editing?'Personel Düzenle':'Yeni Personel'} onClose={() => setModal(false)} size="lg"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving?'Kaydediliyor...':'Kaydet'}</Btn></>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Ad Soyad" required className="md:col-span-2">
              <input type="text" value={form.ad_soyad} onChange={sf('ad_soyad')} className={inputCls} />
            </Field>
            <Field label="TC Kimlik No">
              <input type="text" value={form.tc_kimlik} onChange={sf('tc_kimlik')} className={inputCls} />
            </Field>
            <Field label="Telefon">
              <input type="text" value={form.telefon} onChange={sf('telefon')} className={inputCls} />
            </Field>
            <Field label="Pozisyon">
              <select value={form.pozisyon} onChange={sf('pozisyon')} className={inputCls}>
                <option value="">Seçiniz</option>
                {POZISYONLAR.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Maaş Tipi">
              <select value={form.maas_tipi} onChange={sf('maas_tipi')} className={inputCls}>
                {MAAS_TIPLERI.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </Field>
            <Field label="Net Maaş (₺)">
              <input type="number" step="0.01" value={form.net_maas} onChange={sf('net_maas')} className={inputCls} />
            </Field>
            <Field label="Brüt Maaş (₺)">
              <input type="number" step="0.01" value={form.brut_maas} onChange={sf('brut_maas')} className={inputCls} />
            </Field>
            <Field label="İşe Giriş Tarihi">
              <input type="date" value={form.ise_giris_tarihi} onChange={sf('ise_giris_tarihi')} className={inputCls} />
            </Field>
            <Field label="İşten Çıkış Tarihi">
              <input type="date" value={form.isten_cikis_tarihi} onChange={sf('isten_cikis_tarihi')} className={inputCls} />
            </Field>
            <Field label="Varsayılan Proje">
              <select value={form.varsayilan_proje_id} onChange={sf('varsayilan_proje_id')} className={inputCls}>
                <option value="">Seçiniz</option>
                {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
              </select>
            </Field>
            <Field label="SGK No">
              <input type="text" value={form.sgk_no} onChange={sf('sgk_no')} className={inputCls} />
            </Field>
            <Field label="Banka IBAN">
              <input type="text" value={form.banka_iban} onChange={sf('banka_iban')} className={`${inputCls} font-mono`} placeholder="TR..." />
            </Field>
            {/* Ekip Seçimi */}
            <Field label="Ekipler" className="md:col-span-2">
              <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
                {ekipler.length === 0 ? (
                  <p className="text-sm text-gray-400">Ekip bulunamadı</p>
                ) : ekipler.map(ek => (
                  <label key={ek.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={formEkipler.includes(ek.id)}
                      onChange={e => setFormEkipler(prev => e.target.checked ? [...prev, ek.id] : prev.filter(id => id !== ek.id))}
                      className="w-4 h-4 rounded text-sky-600"
                    />
                    <span className="text-sm text-gray-800">{getEkipAdi(ek)}</span>
                    <span className="text-xs text-gray-400 ml-auto">{projeler.find(p=>p.id===ek.proje_id)?.proje_adi}</span>
                  </label>
                ))}
              </div>
            </Field>
            <div className="md:col-span-2 flex items-center gap-2 pt-1">
              <input type="checkbox" id="aktif" checked={form.aktif} onChange={e => setForm(p => ({ ...p, aktif: e.target.checked }))} className="w-4 h-4 text-sky-600 rounded" />
              <label htmlFor="aktif" className="text-sm font-medium text-gray-700">Aktif Personel</label>
            </div>
          </div>
        </Modal>
      )}

      {delId && <ConfirmDialog message="Bu personeli silmek istediğinize emin misiniz?" onConfirm={async () => { await supabase.from('personeller').delete().eq('id', delId); setDelId(null); load() }} onCancel={() => setDelId(null)} />}
      {topluSilModal && <ConfirmDialog message={`${secili.size} personeli silmek istediğinize emin misiniz?`} onConfirm={topluSil} onCancel={() => setTopluSilModal(false)} />}

      {topluCikisModal && (
        <Modal title={`${secili.size} Personel — Toplu İşten Çıkış`} onClose={() => setTopluCikisModal(false)} size="sm"
          footer={<><Btn variant="secondary" onClick={() => setTopluCikisModal(false)}>İptal</Btn><Btn variant="danger" onClick={topluCikisYap} disabled={topluCikisYapiliyor || !topluCikisTarihi}>{topluCikisYapiliyor ? 'İşleniyor...' : 'Çıkış Yap'}</Btn></>}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{secili.size} seçili personel pasife alınacak ve işten çıkış tarihi girilecek.</p>
            <Field label="İşten Çıkış Tarihi" required>
              <input type="date" value={topluCikisTarihi} onChange={e => setTopluCikisTarihi(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {ekipAktarModal && (
        <Modal title={`${secili.size} Personeli Ekibe Aktar`} onClose={() => setEkipAktarModal(false)} size="sm"
          footer={<><Btn variant="secondary" onClick={() => setEkipAktarModal(false)}>İptal</Btn><Btn onClick={ekibeAktar} disabled={aktariyor || !aktarEkipId}>{aktariyor ? 'Aktarılıyor...' : 'Aktar'}</Btn></>}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{secili.size} seçili personel aşağıdaki ekibe eklenecek.</p>
            <Field label="Ekip Seçiniz" required>
              <select value={aktarEkipId} onChange={e => setAktarEkipId(e.target.value)} className={inputCls}>
                <option value="">-- Ekip Seçiniz --</option>
                {projeler.map(proje => {
                  const projeEkipleri = ekipler.filter(ek => ek.proje_id === proje.id)
                  if (projeEkipleri.length === 0) return null
                  return (
                    <optgroup key={proje.id} label={proje.proje_adi}>
                      {projeEkipleri.map(ek => (
                        <option key={ek.id} value={ek.id}>{getEkipAdi(ek)}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Personel Belgeler Bileşeni ───────────────────────────────
const BELGE_TURLERI = [
  { v: 'kimlik',       l: 'Kimlik Fotokopisi',  icon: '🪪' },
  { v: 'ise_giris',    l: 'İşe Giriş Belgesi',  icon: '📋' },
  { v: 'isten_cikis',  l: 'İşten Çıkış Belgesi',icon: '📤' },
  { v: 'ikametgah',    l: 'İkametgah',           icon: '🏠' },
  { v: 'sabika',       l: 'Sabıka Kaydı',        icon: '📄' },
  { v: 'diger',        l: 'Diğer',               icon: '📎' },
]

function PersonelBelgeler({ personelId, firmaId, personelAdi }: { personelId: string; firmaId: string; personelAdi: string }) {
  const [belgeler, setBelgeler] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => { loadBelgeler() }, [personelId])

  async function loadBelgeler() {
    setLoading(true)
    const { data } = await supabase
      .from('personel_belgeler')
      .select('*')
      .eq('personel_id', personelId)
      .order('created_at', { ascending: false })
    setBelgeler(data || [])
    setLoading(false)
  }

  async function yukle(belgeTuru: string, file: File) {
    setUploading(belgeTuru)
    const safeName = file.name
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ş/g,'S')
      .replace(/İ/g,'I').replace(/Ö/g,'O').replace(/Ç/g,'C')
      .replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const path = `${firmaId}/${personelId}/${belgeTuru}/${Date.now()}_${safeName}`
    const ext  = file.name.split('.').pop()?.toLowerCase() || 'bin'

    const { error } = await supabase.storage.from('personel-belgeler').upload(path, file)
    if (error) { alert('Yükleme hatası: ' + error.message); setUploading(null); return }

    await supabase.from('personel_belgeler').insert({
      personel_id:  personelId,
      firma_id:     firmaId,
      belge_turu:   belgeTuru,
      dosya_adi:    file.name,
      storage_path: path,
      belge_tipi:   ext,
    })
    setUploading(null)
    loadBelgeler()
  }

  async function indir(b: any) {
    const { data } = await supabase.storage.from('personel-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = b.dosya_adi; a.click() }
  }

  async function onizle(b: any) {
    const { data } = await supabase.storage.from('personel-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function sil(b: any) {
    if (!confirm(`"${b.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('personel-belgeler').remove([b.storage_path])
    await supabase.from('personel_belgeler').delete().eq('id', b.id)
    loadBelgeler()
  }

  if (loading) return <div className="py-3 text-xs text-gray-400">Yükleniyor...</div>

  return (
    <div className="pt-2 pb-1">
      <p className="text-xs font-semibold text-blue-700 mb-3">📁 {personelAdi} — Belgeler</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {BELGE_TURLERI.map(tur => {
          const turBelgeleri = belgeler.filter(b => b.belge_turu === tur.v)
          const yukluyor = uploading === tur.v
          return (
            <div key={tur.v} className="bg-white rounded-lg border border-gray-200 p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">{tur.icon}</span>
                <span className="text-xs font-medium text-gray-700 leading-tight">{tur.l}</span>
              </div>
              {/* Yüklü belgeler */}
              {turBelgeleri.map(b => (
                <div key={b.id} className="flex items-center gap-1 mb-1 bg-gray-50 rounded px-1.5 py-1">
                  <span className="text-xs text-gray-600 truncate flex-1" title={b.dosya_adi}>{b.dosya_adi}</span>
                  <button onClick={() => onizle(b)} className="text-blue-500 hover:text-blue-700 flex-shrink-0" title="Görüntüle">
                    <Eye className="w-3 h-3" />
                  </button>
                  <button onClick={() => indir(b)} className="text-green-500 hover:text-green-700 flex-shrink-0" title="İndir">
                    <Download className="w-3 h-3" />
                  </button>
                  <button onClick={() => sil(b)} className="text-red-400 hover:text-red-600 flex-shrink-0" title="Sil">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {/* Yükle butonu */}
              <input
                ref={el => { inputRefs.current[tur.v] = el }}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) yukle(tur.v, f); e.target.value = '' }}
              />
              <button
                onClick={() => inputRefs.current[tur.v]?.click()}
                disabled={yukluyor}
                className="w-full text-xs py-1 rounded border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50 mt-1"
              >
                {yukluyor ? 'Yükleniyor...' : '+ Ekle'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
