'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Upload, FileText, Trash2, Download, Building2, FolderOpen } from 'lucide-react'

interface Evrak { id:string; firma_id:string; kategori:string; dosya_adi:string; dosya_url:string; dosya_boyut?:number; aciklama?:string; olusturulma:string }
interface Props { userId:string; firma:Firma }

const KATEGORILER = [
  'Vergi Levhası',
  'İmza Sirküleri',
  'Ticaret Sicil Gazetesi',
  'Faaliyet Belgesi',
  'SGK İşyeri Tescil',
  'İş Yeri Açma Ruhsatı',
  'Sözleşmeler',
  'Vekaletname',
  'Sigorta Poliçeleri',
  'Banka Belgeleri',
  'Diğer',
]

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SirketEvraklariPage({ userId, firma }: Props) {
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [activeFirma, setActiveFirma] = useState<Firma | null>(null)
  const [evraklar, setEvraklar] = useState<Evrak[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [modal, setModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [secilenKat, setSecilenKat] = useState('hepsi')
  const [form, setForm] = useState({ kategori: 'Diğer', aciklama: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchFirmalar = useCallback(async () => {
    const { data } = await supabase.from('firmalar').select('*').order('ad')
    const list = data || []
    setFirmalar(list)
    const ana = list.find((f: Firma) => f.id === firma.id) || list[0]
    if (ana) setActiveFirma(ana)
  }, [firma.id])

  const fetchEvraklar = useCallback(async () => {
    if (!activeFirma) return
    setLoading(true)
    const { data } = await supabase.from('sirket_evraklari').select('*')
      .eq('firma_id', activeFirma.id).order('kategori').order('olusturulma', { ascending: false })
    setEvraklar(data || [])
    setLoading(false)
  }, [activeFirma])

  useEffect(() => { fetchFirmalar() }, [fetchFirmalar])
  useEffect(() => { fetchEvraklar() }, [fetchEvraklar])

  function handleFileSelect(file: File) {
    if (false) {
      alert(''); return
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('Dosya boyutu 20MB\'dan büyük olamaz!'); return
    }
    setSelectedFile(file)
    setForm({ kategori: 'Diğer', aciklama: '' })
    setModal(true)
  }

  async function handleUpload() {
    if (!selectedFile || !activeFirma) return
    setUploading(true)
    try {
      const safeName = selectedFile.name
        .replace(/[ğĞüÜşŞıİöÖçÇ]/g, (c: string) => ({'ğ':'g','Ğ':'G','ü':'u','Ü':'U','ş':'s','Ş':'S','ı':'i','İ':'I','ö':'o','Ö':'O','ç':'c','Ç':'C'} as Record<string,string>)[c]||c)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
      const fileName = `sirket/${userId}/${activeFirma.id}/${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from('dokumanlar').upload(fileName, selectedFile, { contentType: selectedFile.type })
      if (error) throw error
      await supabase.from('sirket_evraklari').insert({
        firma_id: activeFirma.id, kategori: form.kategori,
        dosya_adi: selectedFile.name, dosya_url: fileName,
        dosya_boyut: selectedFile.size, aciklama: form.aciklama,
        user_id: userId
      })
      setModal(false); setSelectedFile(null)
      fetchEvraklar()
    } catch (e: any) {
      alert('Yükleme hatası: ' + e.message)
    } finally { setUploading(false) }
  }

  async function handleDownload(e: Evrak) {
    const { data } = await supabase.storage.from('dokumanlar').createSignedUrl(e.dosya_url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(e: Evrak) {
    if (!confirm(`"${e.dosya_adi}" dosyasını silmek istediğinize emin misiniz?`)) return
    await supabase.storage.from('dokumanlar').remove([e.dosya_url])
    await supabase.from('sirket_evraklari').delete().eq('id', e.id)
    fetchEvraklar()
  }

  const filtered = secilenKat === 'hepsi' ? evraklar : evraklar.filter(e => e.kategori === secilenKat)
  const mevcutKatlar = evraklar.map(e => e.kategori).filter((k, i, a) => a.indexOf(k) === i)

  return (
    <div>
      {/* Firma sekmeleri */}
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
          <h2 className="text-base font-semibold text-slate-800">Şirket Evrakları</h2>
          <p className="text-xs text-slate-400 mt-0.5">{activeFirma?.ad} • {evraklar.length} dosya</p>
        </div>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Upload size={14}/> PDF Yükle
        </button>
        <input ref={fileRef} type="file" accept="*" className="hidden"
          onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}/>
      </div>

      {/* Drag & Drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if(f) handleFileSelect(f) }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 mb-4 text-center cursor-pointer transition-all ${dragOver?'border-blue-400 bg-blue-50':'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
        <Upload size={22} className={`mx-auto mb-1.5 ${dragOver?'text-blue-500':'text-slate-300'}`}/>
        <p className="text-sm text-slate-500">PDF dosyasını sürükleyin veya tıklayın</p>
        <p className="text-xs text-slate-400 mt-0.5">Maks. 20MB</p>
      </div>

      {/* Kategori filtre */}
      {mevcutKatlar.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <button onClick={() => setSecilenKat('hepsi')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${secilenKat==='hepsi'?'bg-blue-600 text-white':'bg-white border border-slate-200 text-slate-600'}`}>
            Tümü ({evraklar.length})
          </button>
          {mevcutKatlar.map(k => (
            <button key={k} onClick={() => setSecilenKat(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${secilenKat===k?'bg-blue-600 text-white':'bg-white border border-slate-200 text-slate-600'}`}>
              {k} ({evraklar.filter(e => e.kategori === k).length})
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
            <FolderOpen size={36} className="text-slate-200 mx-auto mb-2"/>
            <p className="text-slate-400 text-sm">Henüz evrak yüklenmedi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(e => (
              <div key={e.id} className="bg-white rounded-xl border border-slate-100 p-3.5 flex items-center gap-3 hover:border-slate-200 transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-red-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{e.dosya_adi}</p>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{e.kategori}</span>
                    {e.dosya_boyut && <span className="text-[10px] text-slate-400">{formatBytes(e.dosya_boyut)}</span>}
                    <span className="text-[10px] text-slate-400">{e.olusturulma?.split('T')[0]}</span>
                    {e.aciklama && <span className="text-[10px] text-slate-400 truncate">• {e.aciklama}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleDownload(e)}
                    className="w-8 h-8 rounded-lg border border-slate-100 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center text-slate-400 hover:text-blue-500">
                    <Download size={13}/>
                  </button>
                  <button onClick={() => handleDelete(e)}
                    className="w-8 h-8 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && selectedFile && (
        <Modal title="Evrak Yükle" onClose={() => { setModal(false); setSelectedFile(null) }}
          footer={<><button className={btnSecondary} onClick={() => { setModal(false); setSelectedFile(null) }}>İptal</button>
            <button className={btnPrimary} onClick={handleUpload} disabled={uploading}>{uploading ? 'Yükleniyor...' : 'Yükle'}</button></>}>
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-red-400"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>
            <FormField label="Kategori">
              <select className={inputCls} value={form.kategori} onChange={e => setForm({...form, kategori: e.target.value})}>
                {KATEGORILER.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </FormField>
            <FormField label="Açıklama">
              <input className={inputCls} value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} placeholder="Opsiyonel açıklama"/>
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
