'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  FolderKanban, Users, FileText, Calendar,
  Upload, FileSpreadsheet, FileImage, File, ExternalLink, Loader2
} from 'lucide-react'

interface Props { firma: Firma; userId: string }

interface Proje  { id: string; firma_id: string; ad: string }
interface Ekip   { id: string; firma_id: string; proje_id: string; ad: string }
interface Bordro {
  id: string; firma_id: string; proje_id: string; ekip_id: string; donem: string
  brut: number; net: number; sgk_isci: number; sgk_isveren: number; vergi: number; avans: number; kesinti: number
}
interface Puantaj {
  id: string; firma_id: string; proje_id: string; ekip_id: string
  donem: string; dosya_adi: string; dosya_url: string; dosya_tipi: string; yuklenme_tarihi: string
}

const fmt = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'
const AY = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

type Tab = 'projeler' | 'ekip' | 'puantajlar' | 'bordro'

function dosyaIkonu(tip: string) {
  if (tip === 'excel') return <FileSpreadsheet size={14} className="text-emerald-500"/>
  if (tip === 'jpeg' || tip === 'image') return <FileImage size={14} className="text-blue-400"/>
  if (tip === 'pdf') return <File size={14} className="text-red-400"/>
  return <File size={14} className="text-slate-400"/>
}

function dosyaTipiBelirle(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (['xlsx','xls','csv'].includes(ext)) return 'excel'
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'jpeg'
  if (ext === 'pdf') return 'pdf'
  return 'diger'
}

export default function BordroPage({ firma, userId }: Props) {
  const [tab, setTab] = useState<Tab>('projeler')
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [ekipler, setEkipler]   = useState<Ekip[]>([])
  const [bordrolar, setBordrolar] = useState<Bordro[]>([])
  const [puantajlar, setPuantajlar] = useState<Puantaj[]>([])
  const [selectedDonem, setSelectedDonem] = useState(new Date().toISOString().slice(0, 7))
  const [expandedProje, setExpandedProje] = useState<string | null>(null)

  // ── Proje modal
  const [projeModal, setProjeModal] = useState(false)
  const [editingProje, setEditingProje] = useState<Proje | null>(null)
  const [projeAd, setProjeAd] = useState('')
  const [projeError, setProjeError] = useState('')
  const [projeSaving, setProjeSaving] = useState(false)

  // ── Ekip modal
  const [ekipModal, setEkipModal] = useState(false)
  const [editingEkip, setEditingEkip] = useState<Ekip | null>(null)
  const [ekipForm, setEkipForm] = useState({ proje_id: '', ad: '' })
  const [ekipError, setEkipError] = useState('')
  const [ekipSaving, setEkipSaving] = useState(false)

  // ── Puantaj yükleme
  const [puantajModal, setPuantajModal] = useState(false)
  const [puantajForm, setPuantajForm] = useState({ proje_id: '', ekip_id: '', donem: selectedDonem })
  const [puantajFile, setPuantajFile] = useState<File | null>(null)
  const [puantajUploading, setPuantajUploading] = useState(false)
  const [puantajError, setPuantajError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Bordro modal
  const [bordroModal, setBordroModal] = useState(false)
  const [editingBordro, setEditingBordro] = useState<Bordro | null>(null)
  const emptyBordro = { proje_id: '', ekip_id: '', donem: selectedDonem, brut: '', sgk_isci: '', sgk_isveren: '', vergi: '', avans: '', kesinti: '' }
  const [bordroForm, setBordroForm] = useState<any>(emptyBordro)
  const [bordroError, setBordroError] = useState('')
  const [bordroSaving, setBordroSaving] = useState(false)

  // ── Fetch
  const fetchAll = useCallback(async () => {
    const [{ data: p }, { data: e }, { data: b }, { data: pnt }] = await Promise.all([
      supabase.from('projeler').select('id,firma_id,ad').eq('firma_id', firma.id).order('ad'),
      supabase.from('ekipler').select('id,firma_id,proje_id,ad').eq('firma_id', firma.id).order('ad'),
      supabase.from('bordro').select('*').eq('firma_id', firma.id).eq('donem', selectedDonem),
      supabase.from('puantajlar').select('*').eq('firma_id', firma.id).eq('donem', selectedDonem).order('yuklenme_tarihi', { ascending: false }),
    ])
    setProjeler(p || [])
    setEkipler(e || [])
    setBordrolar(b || [])
    setPuantajlar(pnt || [])
  }, [firma.id, selectedDonem])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ════ PROJE ════
  function openProjeModal(item?: Proje) {
    setEditingProje(item || null); setProjeAd(item?.ad || ''); setProjeError(''); setProjeModal(true)
  }
  async function saveProje() {
    if (!projeAd.trim()) return
    setProjeSaving(true); setProjeError('')
    const { error } = editingProje
      ? await supabase.from('projeler').update({ ad: projeAd }).eq('id', editingProje.id)
      : await supabase.from('projeler').insert({ firma_id: firma.id, ad: projeAd })
    if (error) { setProjeError(error.message); setProjeSaving(false); return }
    setProjeModal(false); fetchAll(); setProjeSaving(false)
  }
  async function delProje(id: string) {
    if (!confirm('Proje ve bağlı tüm kayıtlar silinecek. Emin misiniz?')) return
    await supabase.from('bordro').delete().eq('proje_id', id)
    await supabase.from('puantajlar').delete().eq('proje_id', id)
    await supabase.from('ekipler').delete().eq('proje_id', id)
    await supabase.from('projeler').delete().eq('id', id)
    fetchAll()
  }

  // ════ EKİP ════
  function openEkipModal(item?: Ekip, projeId?: string) {
    setEditingEkip(item || null)
    setEkipForm({ proje_id: item?.proje_id || projeId || '', ad: item?.ad || '' })
    setEkipError(''); setEkipModal(true)
  }
  async function saveEkip() {
    if (!ekipForm.ad.trim() || !ekipForm.proje_id) { setEkipError('Proje ve ekip adı zorunludur.'); return }
    setEkipSaving(true); setEkipError('')
    const { error } = editingEkip
      ? await supabase.from('ekipler').update({ ad: ekipForm.ad, proje_id: ekipForm.proje_id }).eq('id', editingEkip.id)
      : await supabase.from('ekipler').insert({ firma_id: firma.id, proje_id: ekipForm.proje_id, ad: ekipForm.ad })
    if (error) { setEkipError(error.message); setEkipSaving(false); return }
    setEkipModal(false); fetchAll(); setEkipSaving(false)
  }
  async function delEkip(id: string) {
    if (!confirm('Ekip ve ilgili kayıtlar silinecek. Emin misiniz?')) return
    await supabase.from('bordro').delete().eq('ekip_id', id)
    await supabase.from('puantajlar').delete().eq('ekip_id', id)
    await supabase.from('ekipler').delete().eq('id', id)
    fetchAll()
  }

  // ════ PUANTAJ ════
  function openPuantajModal(projeId?: string, ekipId?: string) {
    setPuantajForm({ proje_id: projeId || '', ekip_id: ekipId || '', donem: selectedDonem })
    setPuantajFile(null); setPuantajError(''); setPuantajModal(true)
  }
  
  // Dosyayı base64'e çevir
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
    })
  }
  
  async function uploadPuantaj() {
    if (!puantajFile || !puantajForm.proje_id || !puantajForm.ekip_id) {
      setPuantajError('Proje, ekip ve dosya zorunludur.'); return
    }
    // Dosya boyutu kontrolü (max 2MB)
    if (puantajFile.size > 2 * 1024 * 1024) {
      setPuantajError('Dosya boyutu 2MB üzerinde olamaz. Lütfen daha küçük bir dosya seçin.'); return
    }
    setPuantajUploading(true); setPuantajError('')
    
    try {
      const tip = dosyaTipiBelirle(puantajFile)
      console.log('Dosya tipi:', tip, 'Boyut:', puantajFile.size)
      
      // Dosyayı base64'e çevir
      const base64Data = await fileToBase64(puantajFile)
      console.log('Base64 uzunluk:', base64Data.length)
      
      // Base64 veriyi veritabanına kaydet
      const { data, error: dbError } = await supabase.from('puantajlar').insert({
        firma_id: firma.id,
        proje_id: puantajForm.proje_id,
        ekip_id: puantajForm.ekip_id,
        donem: puantajForm.donem,
        dosya_adi: puantajFile.name,
        dosya_url: base64Data, // base64 data URL
        dosya_tipi: tip,
      }).select()
      
      console.log('Insert sonucu:', { data, error: dbError })
      
      if (dbError) { 
        console.error('DB Hatası:', dbError)
        setPuantajError('Veritabanı hatası: ' + dbError.message); 
        setPuantajUploading(false); 
        return 
      }
      setPuantajModal(false); fetchAll(); setPuantajUploading(false)
    } catch (err: any) {
      console.error('Yükleme hatası:', err)
      setPuantajError(err.message || 'Dosya yüklenirken hata oluştu')
      setPuantajUploading(false)
    }
  }
  
  async function delPuantaj(id: string) {
    if (!confirm('Dosya silinsin mi?')) return
    await supabase.from('puantajlar').delete().eq('id', id)
    fetchAll()
  }

  // ════ BORDRO ════
  const calcNet = (f: any) => {
    const b = parseFloat(f.brut)||0, s = parseFloat(f.sgk_isci)||0
    const v = parseFloat(f.vergi)||0, a = parseFloat(f.avans)||0, k = parseFloat(f.kesinti)||0
    return Math.round((b - s - v - a - k) * 100) / 100
  }
  function openBordroModal(item?: Bordro) {
    setEditingBordro(item || null)
    setBordroForm(item ? {
      proje_id: item.proje_id, ekip_id: item.ekip_id, donem: item.donem,
      brut: String(item.brut), sgk_isci: String(item.sgk_isci),
      sgk_isveren: String(item.sgk_isveren), vergi: String(item.vergi),
      avans: String(item.avans), kesinti: String(item.kesinti),
    } : { ...emptyBordro, donem: selectedDonem })
    setBordroError(''); setBordroModal(true)
  }
  async function saveBordro() {
    if (!bordroForm.proje_id || !bordroForm.ekip_id || !bordroForm.brut) {
      setBordroError('Proje, ekip ve brüt tutar zorunludur.'); return
    }
    setBordroSaving(true); setBordroError('')
    const brut = parseFloat(bordroForm.brut)||0
    const sgk_isci = parseFloat(bordroForm.sgk_isci)||0
    const sgk_isveren = parseFloat(bordroForm.sgk_isveren)||0
    const vergi = parseFloat(bordroForm.vergi)||0
    const avans = parseFloat(bordroForm.avans)||0
    const kesinti = parseFloat(bordroForm.kesinti)||0
    const net = Math.round((brut - sgk_isci - vergi - avans - kesinti) * 100) / 100
    const payload = { firma_id: firma.id, proje_id: bordroForm.proje_id, ekip_id: bordroForm.ekip_id, donem: bordroForm.donem, brut, sgk_isci, sgk_isveren, vergi, avans, kesinti, net }
    const { error } = editingBordro
      ? await supabase.from('bordro').update(payload).eq('id', editingBordro.id)
      : await supabase.from('bordro').insert(payload)
    if (error) { setBordroError(error.message); setBordroSaving(false); return }
    setBordroModal(false); fetchAll(); setBordroSaving(false)
  }
  async function delBordro(id: string) {
    if (!confirm('Silinsin mi?')) return
    await supabase.from('bordro').delete().eq('id', id); fetchAll()
  }

  const [ay, yil] = selectedDonem ? [parseInt(selectedDonem.split('-')[1]), selectedDonem.split('-')[0]] : [0, '']

  const TABS = [
    { id: 'projeler'   as Tab, label: 'Projeler',   icon: FolderKanban, count: projeler.length },
    { id: 'ekip'       as Tab, label: 'Ekipler',    icon: Users,        count: ekipler.length },
    { id: 'puantajlar' as Tab, label: 'Puantajlar', icon: Calendar,     count: puantajlar.length },
    { id: 'bordro'     as Tab, label: 'Bordro',     icon: FileText,     count: bordrolar.length },
  ]

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Bordro Süreci</h2>
          {(tab === 'bordro' || tab === 'puantajlar') && (
            <p className="text-xs text-slate-400 mt-0.5">{AY[ay]} {yil}</p>
          )}
        </div>
        {(tab === 'bordro' || tab === 'puantajlar') && (
          <input type="month" className={inputCls + ' w-auto'} value={selectedDonem}
            onChange={e => setSelectedDonem(e.target.value)}/>
        )}
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon size={14}/>
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* ══ PROJEler ══ */}
      {tab === 'projeler' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => openProjeModal()} className={btnPrimary + ' flex items-center gap-1.5'}><Plus size={14}/> Proje Ekle</button>
          </div>
          {projeler.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <FolderKanban size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-400 text-sm">Henüz proje yok</p>
              <p className="text-slate-300 text-xs mt-1">Önce proje oluşturun, ardından ekip ekleyin</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projeler.map(p => {
                const ekipSayisi = ekipler.filter(e => e.proje_id === p.id).length
                const toplamNet = bordrolar.filter(b => b.proje_id === p.id).reduce((s, b) => s + b.net, 0)
                return (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                        <FolderKanban size={15} className="text-blue-600"/>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openProjeModal(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={12}/></button>
                        <button onClick={() => delProje(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                      </div>
                    </div>
                    <p className="font-semibold text-slate-800 text-sm mb-2">{p.ad}</p>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{ekipSayisi} ekip</span>
                      {toplamNet > 0 && <span className="text-emerald-600 font-semibold">{fmt(toplamNet)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ EKİPLER ══ */}
      {tab === 'ekip' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Proje altında ekip adları tanımlayın (A Ekibi, B Ekibi vb.)</p>
            <button onClick={() => openEkipModal()} disabled={projeler.length === 0}
              className={btnPrimary + ' flex items-center gap-1.5 disabled:opacity-50'}><Plus size={14}/> Ekip Ekle</button>
          </div>
          {projeler.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400 text-sm">Önce Projeler sekmesinden proje ekleyin</p>
            </div>
          ) : projeler.map(proje => {
            const projeEkipler = ekipler.filter(e => e.proje_id === proje.id)
            return (
              <div key={proje.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FolderKanban size={13} className="text-blue-500"/>
                    <span className="font-semibold text-slate-700 text-sm">{proje.ad}</span>
                    <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{projeEkipler.length} ekip</span>
                  </div>
                  <button onClick={() => openEkipModal(undefined, proje.id)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50">
                    <Plus size={11}/> Ekip Ekle
                  </button>
                </div>
                {projeEkipler.length === 0 ? (
                  <p className="text-center text-slate-300 text-xs py-6">Henüz ekip eklenmedi</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {projeEkipler.map(e => (
                      <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Users size={12} className="text-blue-600"/>
                          </div>
                          <span className="font-medium text-slate-700 text-sm">{e.ad}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEkipModal(e)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={12}/></button>
                          <button onClick={() => delEkip(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ PUANTAJLAR ══ */}
      {tab === 'puantajlar' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">PDF, Excel veya JPEG olarak puantaj dosyası yükleyin</p>
            <button onClick={() => openPuantajModal()} disabled={ekipler.length === 0}
              className={btnPrimary + ' flex items-center gap-1.5 disabled:opacity-50'}>
              <Upload size={14}/> Dosya Yükle
            </button>
          </div>

          {ekipler.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <Calendar size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-400 text-sm">Önce Projeler ve Ekipler sekmelerini doldurun</p>
            </div>
          ) : projeler.map(proje => {
            const projePuantajlar = puantajlar.filter(p => p.proje_id === proje.id)
            const projeEkipler = ekipler.filter(e => e.proje_id === proje.id)
            if (projeEkipler.length === 0) return null
            const isExpanded = expandedProje === proje.id

            return (
              <div key={proje.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedProje(isExpanded ? null : proje.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={15} className="text-slate-400"/> : <ChevronRight size={15} className="text-slate-400"/>}
                    <span className="font-semibold text-slate-700 text-sm">{proje.ad}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{projePuantajlar.length} dosya</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); openPuantajModal(proje.id) }}
                    className="flex items-center gap-1 text-xs text-blue-600 font-medium px-2 py-1 rounded-lg hover:bg-blue-50">
                    <Upload size={11}/> Yükle
                  </button>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {projeEkipler.map(ekip => {
                      const ekipDosyalar = projePuantajlar.filter(p => p.ekip_id === ekip.id)
                      return (
                        <div key={ekip.id} className="border-b border-slate-50 last:border-0">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                              <Users size={11} className="text-slate-400"/>
                              <span className="text-xs font-semibold text-slate-600">{ekip.ad}</span>
                              <span className="text-[10px] text-slate-400">{ekipDosyalar.length} dosya</span>
                            </div>
                            <button onClick={() => openPuantajModal(proje.id, ekip.id)}
                              className="text-[10px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5">
                              <Plus size={10}/> Dosya Ekle
                            </button>
                          </div>
                          {ekipDosyalar.length === 0 ? (
                            <p className="text-center text-slate-300 text-xs py-4">Bu ekip için dosya yok</p>
                          ) : (
                            <div className="divide-y divide-slate-50">
                              {ekipDosyalar.map(d => (
                                <div key={d.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {dosyaIkonu(d.dosya_tipi)}
                                    <span className="text-sm text-slate-700 truncate max-w-[300px]">{d.dosya_adi}</span>
                                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                                      {new Date(d.yuklenme_tarihi).toLocaleDateString('tr-TR')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <a href={d.dosya_url} target="_blank" rel="noopener noreferrer"
                                      className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500">
                                      <ExternalLink size={12}/>
                                    </a>
                                    <button onClick={() => delPuantaj(d.id)}
                                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500">
                                      <Trash2 size={12}/>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ BORDRO ══ */}
      {tab === 'bordro' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => openBordroModal()} disabled={ekipler.length === 0}
              className={btnPrimary + ' flex items-center gap-1.5 disabled:opacity-50'}><Plus size={14}/> Bordro Ekle</button>
          </div>

          {ekipler.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400 text-sm">Önce Projeler ve Ekipler sekmelerini doldurun</p>
            </div>
          ) : projeler.map(proje => {
            const projeBordrolar = bordrolar.filter(b => b.proje_id === proje.id)
            const projeEkipler = ekipler.filter(e => e.proje_id === proje.id)
            if (projeEkipler.length === 0) return null
            const toplamNet = projeBordrolar.reduce((s, b) => s + b.net, 0)
            const isExpanded = expandedProje === proje.id

            return (
              <div key={proje.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedProje(isExpanded ? null : proje.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={15} className="text-slate-400"/> : <ChevronRight size={15} className="text-slate-400"/>}
                    <span className="font-semibold text-slate-700 text-sm">{proje.ad}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{projeBordrolar.length} ekip</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Toplam Net Ücret</p>
                    <p className="text-sm font-bold text-emerald-600">{fmt(toplamNet)}</p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Ekip</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Net Ücret</th>
                          <th className="px-4 py-2"/>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {projeBordrolar.map(b => {
                          const ekip = ekipler.find(e => e.id === b.ekip_id)
                          return (
                            <tr key={b.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-blue-50 rounded-md flex items-center justify-center">
                                    <Users size={11} className="text-blue-500"/>
                                  </div>
                                  <span className="font-semibold text-slate-700">{ekip?.ad || '?'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-600 text-base">{fmt(b.net)}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 justify-end">
                                  <button onClick={() => openBordroModal(b)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500"><Pencil size={12}/></button>
                                  <button onClick={() => delBordro(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {projeBordrolar.length === 0 && (
                          <tr><td colSpan={3} className="text-center py-6 text-slate-300 text-xs">Bu dönem için bordro girilmemiş</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── PROJE MODAL ── */}
      {projeModal && (
        <Modal title={editingProje ? 'Proje Düzenle' : 'Yeni Proje'} onClose={() => setProjeModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setProjeModal(false)}>İptal</button>
          <button className={btnPrimary} onClick={saveProje} disabled={projeSaving}>{projeSaving ? 'Kaydediliyor...' : 'Kaydet'}</button></>
        }>
          <FormField label="Proje Adı" required>
            <input className={inputCls} value={projeAd} onChange={e => setProjeAd(e.target.value)} autoFocus placeholder="ör. Malatya Konut Projesi"/>
          </FormField>
          {projeError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{projeError}</p>}
        </Modal>
      )}

      {/* ── EKİP MODAL ── */}
      {ekipModal && (
        <Modal title={editingEkip ? 'Ekip Düzenle' : 'Yeni Ekip'} onClose={() => setEkipModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setEkipModal(false)}>İptal</button>
          <button className={btnPrimary} onClick={saveEkip} disabled={ekipSaving}>{ekipSaving ? 'Kaydediliyor...' : 'Kaydet'}</button></>
        }>
          <FormField label="Proje" required>
            <select className={inputCls} value={ekipForm.proje_id} onChange={e => setEkipForm(f => ({...f, proje_id: e.target.value}))}>
              <option value="">Seçin</option>
              {projeler.map(p => <option key={p.id} value={p.id}>{p.ad}</option>)}
            </select>
          </FormField>
          <FormField label="Ekip Adı" required>
            <input className={inputCls} value={ekipForm.ad} onChange={e => setEkipForm(f => ({...f, ad: e.target.value}))} autoFocus placeholder="ör. A Ekibi, B Ekibi, Formen Ekibi"/>
          </FormField>
          {ekipError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{ekipError}</p>}
        </Modal>
      )}

      {/* ── PUANTAJ MODAL ── */}
      {puantajModal && (
        <Modal title="Puantaj Dosyası Yükle" onClose={() => setPuantajModal(false)} footer={
          <><button className={btnSecondary} onClick={() => setPuantajModal(false)}>İptal</button>
          <button className={btnPrimary} onClick={uploadPuantaj} disabled={puantajUploading}>
            {puantajUploading ? <span className="flex items-center gap-2"><Loader2 size={13} className="animate-spin"/>Yükleniyor...</span> : 'Yükle'}
          </button></>
        }>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Proje" required>
              <select className={inputCls} value={puantajForm.proje_id}
                onChange={e => setPuantajForm(f => ({...f, proje_id: e.target.value, ekip_id: ''}))}>
                <option value="">Seçin</option>
                {projeler.map(p => <option key={p.id} value={p.id}>{p.ad}</option>)}
              </select>
            </FormField>
            <FormField label="Ekip" required>
              <select className={inputCls} value={puantajForm.ekip_id}
                onChange={e => setPuantajForm(f => ({...f, ekip_id: e.target.value}))}>
                <option value="">Seçin</option>
                {ekipler.filter(e => e.proje_id === puantajForm.proje_id).map(e =>
                  <option key={e.id} value={e.id}>{e.ad}</option>
                )}
              </select>
            </FormField>
          </div>
          <FormField label="Dönem">
            <input type="month" className={inputCls} value={puantajForm.donem}
              onChange={e => setPuantajForm(f => ({...f, donem: e.target.value}))}/>
          </FormField>
          <FormField label="Dosya (PDF, Excel, JPEG)" required>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 rounded-xl py-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all">
              {puantajFile ? (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  {dosyaIkonu(dosyaTipiBelirle(puantajFile))}
                  <span className="font-medium">{puantajFile.name}</span>
                  <span className="text-slate-400 text-xs">({(puantajFile.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload size={20} className="text-slate-300 mb-1"/>
                  <p className="text-xs text-slate-400">PDF, Excel (.xlsx), JPEG seçin</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">veya buraya sürükleyin</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                className="hidden" onChange={e => setPuantajFile(e.target.files?.[0] || null)}/>
            </label>
          </FormField>
          {puantajError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{puantajError}</p>}
        </Modal>
      )}

      {/* ── BORDRO MODAL ── */}
      {bordroModal && (
        <Modal title={editingBordro ? 'Bordro Düzenle' : 'Ekip Bordrosu Ekle'} onClose={() => setBordroModal(false)} size="lg" footer={
          <><button className={btnSecondary} onClick={() => setBordroModal(false)}>İptal</button>
          <button className={btnPrimary} onClick={saveBordro} disabled={bordroSaving}>{bordroSaving ? 'Kaydediliyor...' : 'Kaydet'}</button></>
        }>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Proje" required>
              <select className={inputCls} value={bordroForm.proje_id}
                onChange={e => setBordroForm((f: any) => ({...f, proje_id: e.target.value, ekip_id: ''}))}>
                <option value="">Seçin</option>
                {projeler.map(p => <option key={p.id} value={p.id}>{p.ad}</option>)}
              </select>
            </FormField>
            <FormField label="Ekip" required>
              <select className={inputCls} value={bordroForm.ekip_id}
                onChange={e => setBordroForm((f: any) => ({...f, ekip_id: e.target.value}))}>
                <option value="">Seçin</option>
                {ekipler.filter(e => e.proje_id === bordroForm.proje_id).map(e =>
                  <option key={e.id} value={e.id}>{e.ad}</option>
                )}
              </select>
            </FormField>
          </div>
          <FormField label="Dönem">
            <input type="month" className={inputCls} value={bordroForm.donem}
              onChange={e => setBordroForm((f: any) => ({...f, donem: e.target.value}))}/>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Toplam Brüt Ücret (₺)" required>
              <input type="number" className={inputCls} value={bordroForm.brut}
                onChange={e => setBordroForm((f: any) => ({...f, brut: e.target.value}))} placeholder="0"/>
            </FormField>
            <FormField label="SGK İşçi Payı (₺)">
              <input type="number" className={inputCls} value={bordroForm.sgk_isci}
                onChange={e => setBordroForm((f: any) => ({...f, sgk_isci: e.target.value}))} placeholder="0"/>
            </FormField>
            <FormField label="SGK İşveren Payı (₺)">
              <input type="number" className={inputCls} value={bordroForm.sgk_isveren}
                onChange={e => setBordroForm((f: any) => ({...f, sgk_isveren: e.target.value}))} placeholder="0"/>
            </FormField>
            <FormField label="Gelir Vergisi (₺)">
              <input type="number" className={inputCls} value={bordroForm.vergi}
                onChange={e => setBordroForm((f: any) => ({...f, vergi: e.target.value}))} placeholder="0"/>
            </FormField>
            <FormField label="Avans (₺)">
              <input type="number" className={inputCls} value={bordroForm.avans}
                onChange={e => setBordroForm((f: any) => ({...f, avans: e.target.value}))} placeholder="0"/>
            </FormField>
            <FormField label="Diğer Kesinti (₺)">
              <input type="number" className={inputCls} value={bordroForm.kesinti}
                onChange={e => setBordroForm((f: any) => ({...f, kesinti: e.target.value}))} placeholder="0"/>
            </FormField>
          </div>
          {bordroForm.brut && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs space-y-1.5">
              <p className="font-semibold text-blue-700 mb-1">Hesaplanan Net Tutar</p>
              <div className="flex justify-between text-slate-600"><span>Brüt</span><span className="font-medium">{fmt(parseFloat(bordroForm.brut)||0)}</span></div>
              <div className="flex justify-between text-red-500"><span>- SGK İşçi</span><span>{fmt(parseFloat(bordroForm.sgk_isci)||0)}</span></div>
              <div className="flex justify-between text-purple-500"><span>- Vergi</span><span>{fmt(parseFloat(bordroForm.vergi)||0)}</span></div>
              <div className="flex justify-between text-slate-500"><span>- Avans</span><span>{fmt(parseFloat(bordroForm.avans)||0)}</span></div>
              <div className="flex justify-between text-slate-500"><span>- Kesinti</span><span>{fmt(parseFloat(bordroForm.kesinti)||0)}</span></div>
              <div className="flex justify-between font-bold text-emerald-700 border-t border-blue-200 pt-1.5 mt-1">
                <span>= Net Ödeme</span><span className="text-base">{fmt(calcNet(bordroForm))}</span>
              </div>
            </div>
          )}
          {bordroError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{bordroError}</p>}
        </Modal>
      )}
    </div>
  )
}
