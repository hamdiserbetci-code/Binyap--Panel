'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, Firma, AY_LABELS } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, CheckCircle, Clock, FolderOpen, ChevronRight, Upload, Download, FileText, X, ChevronLeft } from 'lucide-react'

interface Proje { id: string; ad: string; durum: string }
interface Ekip { id: string; ad_soyad: string; pozisyon?: string; gunluk_ucret?: number; durum: string }
interface PuantajKayit {
  id: string; ekip_id: string; proje_id: string; firma_id: string
  yil: number; ay: number; gun_sayisi: number; notlar?: string
  onaylandi: boolean; teyit_edildi: boolean; maas_odendi: boolean; user_id: string
}
interface PuantajDok { id:string; dosya_adi:string; dosya_url:string; dosya_boyut?:number; dosya_tipi?:string; aciklama?:string; olusturulma:string }

interface Props { userId: string; firma: Firma }

const DC: Record<string,string> = { aktif:'bg-emerald-500/10 text-emerald-300', tamamlandi:'bg-blue-500/10 text-blue-300', durduruldu:'bg-red-500/10 text-red-400' }
const DL: Record<string,string> = { aktif:'Aktif', tamamlandi:'Tamamlandı', durduruldu:'Durduruldu' }

export default function PuantajPage({ userId, firma }: Props) {
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [selectedProje, setSelectedProje] = useState<Proje | null>(null)
  const [puantajlar, setPuantajlar] = useState<PuantajKayit[]>([])
  const [ekipler, setEkipler] = useState<Ekip[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<PuantajKayit | null>(null)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1)
  const [dokumanlar, setDokumanlar] = useState<PuantajDok[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Son veri olan ayı bul
  useEffect(() => {
    async function findLastDataMonth() {
      const { data } = await supabase.from('puantaj')
        .select('yil, ay').eq('firma_id', firma.id)
        .order('yil', { ascending: false }).order('ay', { ascending: false }).limit(1).single()
      if (data) {
        setSelectedYil(data.yil)
        setSelectedAy(data.ay)
      }
    }
    findLastDataMonth()
  }, [firma.id])
  const [form, setForm] = useState({ ekip_id:'', yil:new Date().getFullYear(), ay:new Date().getMonth()+1, gun_sayisi:'0', notlar:'', onaylandi:false, teyit_edildi:false, maas_odendi:false })
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI' | null>(null)

  const fetchProjeler = useCallback(async () => {
    if (!sirket) return
    const { data } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
    const all = data || []
    setProjeler(all.filter((p: any) => sirket === 'ETM' ? (!p.sirket || p.sirket === 'ETM') : p.sirket === sirket))
  }, [firma.id, sirket])

  const fetchEkipler = useCallback(async (projeId?: string) => {
    if (!sirket) return
    let q = supabase.from('ekipler').select('*').eq('firma_id', firma.id).eq('durum', 'aktif')
    if (projeId) q = q.eq('proje_id', projeId)
    const { data } = await q
    const all = data || []
    setEkipler(all.filter((e: any) => sirket === 'ETM' ? (!e.sirket || e.sirket === 'ETM') : e.sirket === sirket))
  }, [firma.id, sirket])

  const fetchDokumanlar = useCallback(async () => {
    if (!selectedProje || !sirket) return
    const { data } = await supabase.from('puantaj_dokumanlar').select('*')
      .eq('proje_id', selectedProje.id).eq('yil', selectedYil).eq('ay', selectedAy)
      .order('olusturulma', { ascending: false })
    const all = data || []
    setDokumanlar(all.filter((d: any) => sirket === 'ETM' ? (!d.sirket || d.sirket === 'ETM') : d.sirket === sirket))
  }, [selectedProje, selectedYil, selectedAy, sirket])

  const fetchPuantaj = useCallback(async () => {
    if (!sirket) return
    setLoading(true)
    let q = supabase.from('puantaj').select('*').eq('firma_id', firma.id).eq('yil', selectedYil).eq('ay', selectedAy)
    if (selectedProje) q = q.eq('proje_id', selectedProje.id)
    const { data } = await q.order('ekip_id')
    const all = data || []
    setPuantajlar(all.filter((p: any) => sirket === 'ETM' ? (!p.sirket || p.sirket === 'ETM') : p.sirket === sirket))
    setLoading(false)
  }, [userId, selectedYil, selectedAy, selectedProje, sirket])

  useEffect(() => { fetchProjeler() }, [fetchProjeler])
  useEffect(() => { fetchPuantaj() }, [fetchPuantaj])
  useEffect(() => { fetchDokumanlar() }, [fetchDokumanlar])
  useEffect(() => {
    if (selectedProje) fetchEkipler(selectedProje.id)
    else fetchEkipler()
  }, [selectedProje, fetchEkipler])

  function openModal(p?: PuantajKayit) {
    setEditing(p || null)
    setForm(p ? { ekip_id:p.ekip_id, yil:p.yil, ay:p.ay, gun_sayisi:String(p.gun_sayisi), notlar:p.notlar||'', onaylandi:p.onaylandi, teyit_edildi:p.teyit_edildi, maas_odendi:p.maas_odendi||false } : { ekip_id:'', yil:selectedYil, ay:selectedAy, gun_sayisi:'0', notlar:'', onaylandi:false, teyit_edildi:false, maas_odendi:false })
    setModal(true)
  }

  async function handleSave() {
    if (!form.ekip_id) return
    const ekip = ekipler.find(e => e.id === form.ekip_id)
    const projeId = selectedProje?.id || (ekip ? (await supabase.from('ekipler').select('proje_id').eq('id', form.ekip_id).single()).data?.proje_id : null)
    if (!projeId) return
    const payload: any = { ekip_id:form.ekip_id, yil:Number(form.yil), ay:Number(form.ay), gun_sayisi:Number(form.gun_sayisi), notlar:form.notlar, onaylandi:form.onaylandi, teyit_edildi:form.teyit_edildi, maas_odendi:form.maas_odendi, proje_id:projeId, firma_id:firma.id, user_id:userId, sirket }
    let working = { ...payload }
    let res
    while(true) {
      res = editing ? await supabase.from('puantaj').update(working).eq('id', editing.id) : await supabase.from('puantaj').insert(working)
      if (!res.error) break
      const match = res.error.message.match(/'([^']+)' column of/i)
      const col = match ? match[1] : null
      if (!col || !(col in working) || Object.keys(working).length <= 2) break
      delete working[col]
    }
    setModal(false); fetchPuantaj()
  }

  async function handleFileUpload(file: File) {
    if (!selectedProje) return
    if (file.size > 20 * 1024 * 1024) { alert('Dosya boyutu 20MB\'dan büyük olamaz!'); return }
    setUploading(true)
    try {
      const safeName = file.name
        .replace(/[ğĞüÜşŞıİöÖçÇ]/g, (c: string) => ({'ğ':'g','Ğ':'G','ü':'u','Ü':'U','ş':'s','Ş':'S','ı':'i','İ':'I','ö':'o','Ö':'O','ç':'c','Ç':'C'} as Record<string,string>)[c]||c)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
      const fileName = `puantaj/${userId}/${selectedProje.id}/${selectedYil}-${selectedAy}/${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from('dokumanlar').upload(fileName, file, { contentType: file.type })
      if (error) throw error
      const payload: any = {
        proje_id: selectedProje.id, firma_id: firma.id, sirket,
        yil: selectedYil, ay: selectedAy, dosya_adi: file.name, dosya_url: fileName,
        dosya_boyut: file.size, dosya_tipi: file.type, user_id: userId
      }
      let working = { ...payload }; let res;
      while(true) {
        res = await supabase.from('puantaj_dokumanlar').insert(working)
        if (!res.error) break
        const match = res.error.message.match(/'([^']+)' column of/i)
        const col = match ? match[1] : null
        if (!col || !(col in working) || Object.keys(working).length <= 2) break
        delete working[col]
      }
      fetchDokumanlar()
    } catch (e: any) { alert('Yükleme hatası: ' + e.message) }
    finally { setUploading(false) }
  }

  async function handleDokDownload(dok: PuantajDok) {
    const { data } = await supabase.storage.from('dokumanlar').createSignedUrl(dok.dosya_url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDokDelete(dok: PuantajDok) {
    if (!confirm(`"${dok.dosya_adi}" dosyasını silmek istediğinize emin misiniz?`)) return
    await supabase.storage.from('dokumanlar').remove([dok.dosya_url])
    await supabase.from('puantaj_dokumanlar').delete().eq('id', dok.id)
    fetchDokumanlar()
  }

  function formatBytes(bytes?: number) {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function toggleOnayla(p: PuantajKayit) {
    await supabase.from('puantaj').update({ onaylandi: !p.onaylandi }).eq('id', p.id)
    fetchPuantaj()
  }

  async function toggleTeyit(p: PuantajKayit) {
    await supabase.from('puantaj').update({ teyit_edildi: !p.teyit_edildi }).eq('id', p.id)
    fetchPuantaj()
  }

  async function toggleMaasOdendi(p: PuantajKayit) {
    await supabase.from('puantaj').update({ maas_odendi: !p.maas_odendi }).eq('id', p.id)
    fetchPuantaj()
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('puantaj').delete().eq('id', id)
    fetchPuantaj()
  }

  const getEkip = (id: string) => ekipler.find(e => e.id === id)
  const onaylananlar = puantajlar.filter(p => p.onaylandi).length
  const teyitEdilenler = puantajlar.filter(p => p.teyit_edildi).length
  const maasOdenenler = puantajlar.filter(p => p.maas_odendi).length
  const yillar = Array.from({ length:5 }, (_,i) => new Date().getFullYear()-i)

  if (!sirket) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-112px)] min-h-[600px] gap-8" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Puantaj ve İK Yönetimi</h2>
          <p className="text-slate-400 text-sm">İşlem yapmak istediğiniz firmayı seçin</p>
        </div>
        <div className="flex gap-6">
          <button onClick={() => setSirket('ETM')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(59,130,246,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">E</div>
             <h3 className="text-xl font-bold text-slate-100">ETM A.Ş.</h3>
             <p className="mt-2 text-xs text-slate-400">Merkez Firma Kadroları</p>
          </button>
          <button onClick={() => setSirket('BİNYAPI')} className="group flex flex-col items-center justify-center w-64 h-64 rounded-[32px] border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(99,102,241,0.15)]">
             <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl font-bold mb-5 group-hover:scale-110 transition-transform duration-300">B</div>
             <h3 className="text-xl font-bold text-slate-100">BİNYAPI</h3>
             <p className="mt-2 text-xs text-slate-400">Binyapı Firma Kadroları</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-0 h-full overflow-hidden">
      {/* SOL: Proje Seçim Paneli */}
      <div className="w-64 flex-shrink-0 border-r border-white/[0.08] p-4 overflow-y-auto bg-white/[0.02]">
        <div className="mb-4 pb-4 border-b border-white/[0.08]">
          <button onClick={() => setSirket(null)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors mb-4">
            <ChevronLeft size={16} /> Firmalara Dön
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-white text-xs font-bold">{sirket === 'ETM' ? 'E' : 'B'}</div>
            <p className="text-sm font-bold text-white">{sirket === 'ETM' ? 'ETM A.Ş.' : 'BİNYAPI'}</p>
          </div>
        </div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Proje Filtrele</h3>
        <div className="space-y-1.5">
          {/* Tüm projeler seçeneği */}
          <div onClick={() => setSelectedProje(null)}
            className={`rounded-xl border p-3 cursor-pointer hover:border-blue-300 transition-all flex items-center gap-2.5 ${!selectedProje?'border-blue-400 bg-blue-500/10':'border-white/[0.05]'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${!selectedProje?'bg-blue-600':'bg-white/[0.06]'}`}>
              <FolderOpen size={14} className={!selectedProje?'text-white':'text-slate-400'}/>
            </div>
            <p className={`text-sm font-medium ${!selectedProje?'text-blue-300':'text-white'}`}>Tüm Projeler</p>
            {!selectedProje && <ChevronRight size={13} className="text-blue-400 ml-auto flex-shrink-0"/>}
          </div>

          {projeler.map(p => (
            <div key={p.id} onClick={() => setSelectedProje(p)}
              className={`rounded-xl border p-3 cursor-pointer hover:border-blue-300 transition-all flex items-center gap-2.5 ${selectedProje?.id===p.id?'border-blue-400 bg-blue-500/10':'border-white/[0.05]'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedProje?.id===p.id?'bg-blue-600':'bg-white/[0.06]'}`}>
                <FolderOpen size={14} className={selectedProje?.id===p.id?'text-white':'text-slate-400'}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${selectedProje?.id===p.id?'text-blue-300':'text-white'}`}>{p.ad}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DC[p.durum]}`}>{DL[p.durum]}</span>
              </div>
              {selectedProje?.id===p.id && <ChevronRight size={13} className="text-blue-400 flex-shrink-0"/>}
            </div>
          ))}
        </div>
      </div>

      {/* SAĞ: Puantaj İçeriği */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              {selectedProje ? selectedProje.ad : 'Tüm Projeler'} — Puantaj
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{AY_LABELS[selectedAy]} {selectedYil}</p>
          </div>
          <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
            <Plus size={14}/> Puantaj Ekle
          </button>
        </div>

        {/* Ay/Yıl seçimi */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <select value={selectedYil} onChange={e=>setSelectedYil(Number(e.target.value))} className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 py-2 text-sm outline-none">
            {yillar.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex gap-1 flex-wrap">
            {AY_LABELS.slice(1).map((ay,i) => (
              <button key={i+1} onClick={()=>setSelectedAy(i+1)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedAy===i+1?'bg-blue-600 text-white':'bg-white/[0.02] border border-white/[0.08] text-slate-300'}`}>{ay}</button>
            ))}
          </div>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3">
            <p className="text-xs text-slate-400 mb-1">Onaylanan</p>
            <p className="text-xl font-semibold text-emerald-400">{onaylananlar}/{puantajlar.length}</p>
          </div>
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3">
            <p className="text-xs text-slate-400 mb-1">Teyit Edilen</p>
            <p className="text-xl font-semibold text-purple-400">{teyitEdilenler}/{puantajlar.length}</p>
          </div>
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3">
            <p className="text-xs text-slate-400 mb-1">Maaş Ödendi</p>
            <p className="text-xl font-semibold text-blue-400">{maasOdenenler}/{puantajlar.length}</p>
          </div>
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] p-3">
            <p className="text-xs text-slate-400 mb-1">Toplam Kayıt</p>
            <p className="text-xl font-semibold text-white">{puantajlar.length}</p>
          </div>
        </div>

        {/* Liste */}
        {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
          puantajlar.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
              <Clock size={36} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-slate-400 text-sm">Bu dönem için puantaj kaydı yok</p>
            </div>
          ) : (
            <div className="space-y-2">
              {puantajlar.map(p => {
                const ekip = getEkip(p.ekip_id)
                return (
                  <div key={p.id} className={`bg-white/[0.02] rounded-xl border p-3.5 flex items-center gap-3 ${p.maas_odendi?'border-blue-200':p.teyit_edildi?'border-purple-200':p.onaylandi?'border-emerald-200':'border-white/[0.05]'}`}>
                    <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-semibold text-slate-300 flex-shrink-0">
                      {(ekip?.ad_soyad||'?').split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{ekip?.ad_soyad||'Bilinmiyor'}</p>
                      <div className="flex gap-3 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="font-semibold text-slate-200">{p.gun_sayisi} gün</span>
                        {p.onaylandi && <span className="text-emerald-500">✓ Onaylandı</span>}
                        {p.teyit_edildi && <span className="text-purple-500">✓ Teyit</span>}
                        {p.maas_odendi && <span className="text-blue-500">✓ Maaş Ödendi</span>}
                      </div>
                      {p.notlar && <p className="text-[11px] text-slate-400 mt-0.5">📌 {p.notlar}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={()=>toggleOnayla(p)} title="Puantajlar Geldi"
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all text-xs font-bold ${p.onaylandi?'bg-emerald-500/10 border-emerald-200 text-emerald-400':'border-white/[0.08] text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-200 hover:text-emerald-500'}`}>✓</button>
                      <button onClick={()=>toggleTeyit(p)} title="Teyit Edildi"
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${p.teyit_edildi?'bg-purple-500/10 border-purple-200 text-purple-400':'border-white/[0.08] text-slate-400 hover:bg-purple-500/10 hover:border-purple-200 hover:text-purple-500'}`}>
                        <CheckCircle size={12}/>
                      </button>
                      <button onClick={()=>toggleMaasOdendi(p)} title="Maaş Ödendi"
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all text-xs font-bold ${p.maas_odendi?'bg-blue-500/10 border-blue-200 text-blue-400':'border-white/[0.08] text-slate-400 hover:bg-blue-500/10 hover:border-blue-200 hover:text-blue-500'}`}>₺</button>
                      <button onClick={()=>openModal(p)} className="w-7 h-7 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                      <button onClick={()=>handleDelete(p.id)} className="w-7 h-7 rounded-lg border border-white/[0.08] hover:bg-red-500/10 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

      {/* Döküman Yükleme Bölümü */}
      {selectedProje && (
        <div className="mt-4 bg-white/[0.02] rounded-xl border border-white/[0.05] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.02]">
            <p className="text-sm font-medium text-slate-200">📎 Puantaj Dökümanları</p>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.08] text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium">
              <Upload size={12}/> Dosya Yükle
            </button>
            <input ref={fileRef} type="file" className="hidden"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}/>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if(f) handleFileUpload(f) }}
            onClick={() => fileRef.current?.click()}
            className={`mx-4 my-3 border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${dragOver?'border-blue-400 bg-blue-500/10':'border-white/[0.08] hover:border-blue-300 hover:bg-white/[0.04]'}`}>
            {uploading ? <p className="text-xs text-blue-500">Yükleniyor...</p> : (
              <><Upload size={16} className={`mx-auto mb-1 ${dragOver?'text-blue-400':'text-slate-300'}`}/>
              <p className="text-xs text-slate-400">Dosya sürükleyin veya tıklayın (PDF, JPEG, PNG vb.)</p></>
            )}
          </div>
          {dokumanlar.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3 pb-4">Henüz döküman yüklenmedi</p>
          ) : (
            <div className="divide-y divide-slate-50 pb-2">
              {dokumanlar.map(d => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04]/50">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-blue-400"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{d.dosya_adi}</p>
                    <p className="text-[10px] text-slate-400">{formatBytes(d.dosya_boyut)} • {d.olusturulma?.split('T')[0]}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleDokDownload(d)}
                      className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-blue-500/10 hover:border-blue-200 flex items-center justify-center text-slate-400 hover:text-blue-500">
                      <Download size={12}/>
                    </button>
                    <button onClick={() => handleDokDelete(d)}
                      className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-red-500/10 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-400">
                      <X size={12}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <Modal title={editing?'Puantaj Düzenle':'Puantaj Ekle'} onClose={()=>setModal(false)}
          footer={<><button className={btnSecondary} onClick={()=>setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <FormField label="Ekip Seçin" required>
              <select className={inputCls} value={form.ekip_id} onChange={e=>setForm({...form,ekip_id:e.target.value})}>
                <option value="">Ekip seçin</option>
                {ekipler.map(e=><option key={e.id} value={e.id}>{e.ad_soyad}{e.pozisyon?` — ${e.pozisyon}`:''}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Yıl">
                <select className={inputCls} value={form.yil} onChange={e=>setForm({...form,yil:Number(e.target.value)})}>
                  {yillar.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </FormField>
              <FormField label="Ay">
                <select className={inputCls} value={form.ay} onChange={e=>setForm({...form,ay:Number(e.target.value)})}>
                  {AY_LABELS.slice(1).map((a,i)=><option key={i+1} value={i+1}>{a}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Çalışma Günü">
              <input type="number" className={inputCls} value={form.gun_sayisi} onChange={e=>setForm({...form,gun_sayisi:e.target.value})} min="0" max="31"/>
            </FormField>
            <FormField label="Notlar">
              <input className={inputCls} value={form.notlar} onChange={e=>setForm({...form,notlar:e.target.value})} placeholder="Opsiyonel not"/>
            </FormField>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.onaylandi} onChange={e=>setForm({...form,onaylandi:e.target.checked})} className="w-4 h-4 accent-emerald-600"/>
                <span className="text-sm text-slate-200">Puantajlar Geldi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.teyit_edildi} onChange={e=>setForm({...form,teyit_edildi:e.target.checked})} className="w-4 h-4 accent-purple-600"/>
                <span className="text-sm text-slate-200">Teyit Edildi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.maas_odendi} onChange={e=>setForm({...form,maas_odendi:e.target.checked})} className="w-4 h-4 accent-blue-600"/>
                <span className="text-sm text-slate-200">Maaş Ödendi</span>
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
