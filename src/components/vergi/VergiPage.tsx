'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, VergiSureci, Firma, AY_LABELS, VERGI_TUR_LABELS, DURUM_LABELS, DURUM_COLORS } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, FileText, AlertTriangle, Upload, Download, X } from 'lucide-react'

interface Props { userId: string; firma: Firma; vergiTur?: string }
interface VDok { id:string; dosya_adi:string; dosya_url:string; dosya_boyut?:number; aciklama?:string; olusturulma:string }

export default function VergiPage({ userId, firma, vergiTur }: Props) {
  const [surecleri, setSurecleri] = useState<VergiSureci[]>([])
  const [dokumanlar, setDokumanlar] = useState<VDok[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<VergiSureci | null>(null)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    tur: vergiTur || 'kdv', yil: new Date().getFullYear(),
    ay: new Date().getMonth() + 1, durum: 'beklemede',
    son_tarih: '', beyan_tarihi: '', tutar: '', aciklama: ''
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('vergi_surecleri').select('*')
      .eq('firma_id', firma.id).eq('yil', selectedYil).eq('ay', selectedAy)
    if (vergiTur) q = q.eq('tur', vergiTur)
    const { data } = await q.order('tur')
    setSurecleri(data || [])
    setLoading(false)
  }, [firma.id, selectedYil, selectedAy, vergiTur])

  const fetchDokumanlar = useCallback(async () => {
    let q = supabase.from('vergi_dokumanlar').select('*')
      .eq('firma_id', firma.id).eq('yil', selectedYil).eq('ay', selectedAy)
    if (vergiTur) q = q.or(`vergi_tur.eq.${vergiTur},vergi_tur.eq.genel`)
    const { data } = await q.order('olusturulma', { ascending: false })
    setDokumanlar(data || [])
  }, [firma.id, selectedYil, selectedAy, vergiTur])

  useEffect(() => { fetchData(); fetchDokumanlar() }, [fetchData, fetchDokumanlar])

  function openModal(v?: VergiSureci) {
    setEditing(v || null)
    setForm(v ? {
      tur: v.tur, yil: v.yil, ay: v.ay, durum: v.durum,
      son_tarih: v.son_tarih || '', beyan_tarihi: v.beyan_tarihi || '',
      tutar: String(v.tutar || ''), aciklama: v.aciklama || ''
    } : {
      tur: vergiTur || 'kdv', yil: selectedYil, ay: selectedAy,
      durum: 'beklemede', son_tarih: '', beyan_tarihi: '', tutar: '', aciklama: ''
    })
    setModal(true)
  }

  async function handleSave() {
    const data = { ...form, yil: Number(form.yil), ay: Number(form.ay), tutar: form.tutar ? parseFloat(form.tutar) : null, firma_id: firma.id, user_id: userId }
    if (editing) await supabase.from('vergi_surecleri').update(data).eq('id', editing.id)
    else await supabase.from('vergi_surecleri').insert(data)
    setModal(false); fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('vergi_surecleri').delete().eq('id', id)
    fetchData()
  }

  async function updateDurum(v: VergiSureci, durum: string) {
    await supabase.from('vergi_surecleri').update({
      durum, ...(durum === 'beyan_edildi' || durum === 'tamamlandi' ? { beyan_tarihi: today } : {})
    }).eq('id', v.id)
    fetchData()
  }

  async function handleFileUpload(file: File) {
    if (false) {
      alert(''); return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Dosya boyutu 10MB\'dan büyük olamaz!'); return
    }
    setUploading(true)
    try {
      const safeName = file.name
        .replace(/[ğĞüÜşŞıİöÖçÇ]/g, (c: string) => ({'ğ':'g','Ğ':'G','ü':'u','Ü':'U','ş':'s','Ş':'S','ı':'i','İ':'I','ö':'o','Ö':'O','ç':'c','Ç':'C'} as Record<string,string>)[c]||c)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
      const fileName = `vergi/${userId}/${firma.id}/${vergiTur||'genel'}/${selectedYil}-${selectedAy}/${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from('dokumanlar').upload(fileName, file, { contentType: file.type })
      if (error) throw error
      await supabase.from('vergi_dokumanlar').insert({
        firma_id: firma.id, vergi_tur: vergiTur || 'genel',
        yil: selectedYil, ay: selectedAy,
        dosya_adi: file.name, dosya_url: fileName,
        dosya_boyut: file.size, user_id: userId
      })
      fetchDokumanlar()
    } catch (e: any) {
      alert('Yükleme hatası: ' + e.message)
    } finally { setUploading(false) }
  }

  async function handleDokDelete(dok: VDok) {
    if (!confirm(`"${dok.dosya_adi}" dosyasını silmek istediğinize emin misiniz?`)) return
    await supabase.storage.from('dokumanlar').remove([dok.dosya_url])
    await supabase.from('vergi_dokumanlar').delete().eq('id', dok.id)
    fetchDokumanlar()
  }

  async function handleDownload(dok: VDok) {
    const { data } = await supabase.storage.from('dokumanlar').createSignedUrl(dok.dosya_url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function formatBytes(bytes?: number) {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const yillar = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const baslik = vergiTur ? VERGI_TUR_LABELS[vergiTur] || vergiTur : 'Vergi Süreçleri'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">{baslik}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{firma.ad} — {AY_LABELS[selectedAy]} {selectedYil}</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14}/> Ekle
        </button>
      </div>

      {/* Dönem seçici */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={selectedYil} onChange={e => setSelectedYil(Number(e.target.value))} className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 py-2 text-sm outline-none">
          {yillar.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {AY_LABELS.slice(1).map((ay, i) => (
            <button key={i+1} onClick={() => setSelectedAy(i+1)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedAy===i+1?'bg-blue-600 text-white':'bg-white/[0.02] border border-white/[0.08] text-slate-300'}`}>{ay}</button>
          ))}
        </div>
      </div>

      {/* Süreç listesi */}
      {loading ? <p className="text-center text-slate-400 py-6 text-sm">Yükleniyor...</p> :
        surecleri.length === 0 ? (
          <div className="text-center py-8 bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08] mb-4">
            <FileText size={28} className="text-slate-200 mx-auto mb-2"/>
            <p className="text-slate-400 text-sm mb-2">Bu dönem için kayıt yok</p>
            <button onClick={() => openModal()} className="text-blue-400 text-sm hover:underline">Kayıt ekle</button>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {surecleri.map(s => {
              const gecikti = s.son_tarih && s.son_tarih < today && s.durum !== 'tamamlandi' && s.durum !== 'beyan_edildi'
              return (
                <div key={s.id} className={`bg-white/[0.02] rounded-xl border p-3.5 ${gecikti?'border-l-4 border-l-red-400 border-y-slate-100 border-r-slate-100':'border-white/[0.05]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {!vergiTur && <p className="text-sm font-medium text-white">{VERGI_TUR_LABELS[s.tur] || s.tur}</p>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DURUM_COLORS[s.durum]}`}>{DURUM_LABELS[s.durum]}</span>
                        {gecikti && <span className="text-[10px] text-red-400 flex items-center gap-1"><AlertTriangle size={10}/>Gecikti</span>}
                      </div>
                      <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
                        {s.son_tarih && <span>Son tarih: {s.son_tarih}</span>}
                        {s.beyan_tarihi && <span>Beyan: {s.beyan_tarihi}</span>}
                        {s.tutar && <span className="text-blue-500 font-medium">{s.tutar.toLocaleString('tr-TR')} ₺</span>}
                        {s.aciklama && <span>{s.aciklama}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {s.durum !== 'tamamlandi' && (
                        <select value={s.durum} onChange={e => updateDurum(s, e.target.value)}
                          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] outline-none">
                          {Object.entries(DURUM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      )}
                      <button onClick={() => openModal(s)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-white/[0.04] flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                      <button onClick={() => handleDelete(s.id)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-red-500/10 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {/* PDF Yükleme */}
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.02]">
          <p className="text-sm font-medium text-slate-200">📎 Dökümanlar</p>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.08] text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <Upload size={12}/> PDF Yükle
          </button>
          <input ref={fileRef} type="file" accept="*" className="hidden"
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}/>
        </div>

        {/* Drag & Drop */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if(f) handleFileUpload(f) }}
          onClick={() => fileRef.current?.click()}
          className={`mx-4 my-3 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${dragOver?'border-blue-400 bg-blue-500/10':'border-white/[0.08] hover:border-blue-300 hover:bg-white/[0.04]'}`}>
          {uploading ? (
            <p className="text-sm text-blue-500">Yükleniyor...</p>
          ) : (
            <>
              <Upload size={20} className={`mx-auto mb-1 ${dragOver?'text-blue-400':'text-slate-300'}`}/>
              <p className="text-xs text-slate-400">PDF sürükleyin veya tıklayın</p>
            </>
          )}
        </div>

        {/* Döküman listesi */}
        {dokumanlar.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3 pb-4">Henüz döküman yüklenmedi</p>
        ) : (
          <div className="divide-y divide-slate-50 pb-2">
            {dokumanlar.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04]/50">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-red-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{d.dosya_adi}</p>
                  <p className="text-[10px] text-slate-400">{formatBytes(d.dosya_boyut)} • {d.olusturulma?.split('T')[0]}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleDownload(d)}
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

      {modal && (
        <Modal title={editing ? 'Süreci Düzenle' : `${baslik} Ekle`} onClose={() => setModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            {!vergiTur && (
              <FormField label="Vergi Türü" required>
                <select className={inputCls} value={form.tur} onChange={e => setForm({...form, tur: e.target.value})}>
                  {Object.entries(VERGI_TUR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Yıl"><select className={inputCls} value={form.yil} onChange={e => setForm({...form, yil: Number(e.target.value)})}>{yillar.map(y => <option key={y} value={y}>{y}</option>)}</select></FormField>
              <FormField label="Ay"><select className={inputCls} value={form.ay} onChange={e => setForm({...form, ay: Number(e.target.value)})}>{AY_LABELS.slice(1).map((a, i) => <option key={i+1} value={i+1}>{a}</option>)}</select></FormField>
            </div>
            <FormField label="Durum">
              <select className={inputCls} value={form.durum} onChange={e => setForm({...form, durum: e.target.value})}>
                {Object.entries(DURUM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Son Beyan Tarihi"><input type="date" className={inputCls} value={form.son_tarih} onChange={e => setForm({...form, son_tarih: e.target.value})}/></FormField>
              <FormField label="Beyan Edildiği Tarih"><input type="date" className={inputCls} value={form.beyan_tarihi} onChange={e => setForm({...form, beyan_tarihi: e.target.value})}/></FormField>
            </div>
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={form.tutar} onChange={e => setForm({...form, tutar: e.target.value})} placeholder="0.00"/></FormField>
            <FormField label="Açıklama"><textarea className={inputCls} rows={2} value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} placeholder="Notlar..."/></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
