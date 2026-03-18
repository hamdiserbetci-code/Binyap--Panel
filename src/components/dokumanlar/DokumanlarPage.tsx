'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, Firma, Proje } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Upload, FileText, Trash2, Download, FolderOpen } from 'lucide-react'

interface Dokuman {
  id: string; firma_id: string; proje_id?: string; dosya_adi: string
  dosya_url: string; dosya_boyut?: number; kategori: string
  aciklama?: string; yukleme_tarihi: string; user_id: string
}

interface Props { userId: string; firma: Firma; proje?: Proje; kategori?: string }

const KAT_LABELS: Record<string, string> = {
  sozlesmeler: 'Sözleşmeler',
  hakedisler: 'Hakedişler',
  satis_faturalari: 'Satış Faturaları',
  maas_dekontlari: 'Maaş Ödeme Dekontları',
  arabulucu_evraklari: 'Arabulucu Evrakları',
  alis_faturalari: 'Alış Faturaları',
  diger: 'Diğer',
}

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DokumanlarPage({ userId, firma, proje, kategori }: Props) {
  const [dokumanlar, setDokumanlar] = useState<Dokuman[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [modal, setModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm] = useState({ kategori: kategori || 'diger', aciklama: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchDokumanlar = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('dokumanlar').select('*').eq('firma_id', firma.id)
    if (proje) q = q.eq('proje_id', proje.id)
    if (kategori) q = q.eq('kategori', kategori)
    q = q.order('olusturulma', { ascending: false })
    const { data } = await q
    setDokumanlar(data || [])
    setLoading(false)
  }, [firma.id, proje?.id, kategori])

  useEffect(() => { fetchDokumanlar() }, [fetchDokumanlar])

  function handleFileSelect(file: File) {
    if (false) {
      alert('')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Dosya boyutu 10MB\'dan büyük olamaz!')
      return
    }
    setSelectedFile(file)
    setForm({ kategori: kategori || 'diger', aciklama: '' })
    setModal(true)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    try {
      const safeName = selectedFile.name
        .replace(/[ğĞüÜşŞıİöÖçÇ]/g, (c: string) => ({'ğ':'g','Ğ':'G','ü':'u','Ü':'U','ş':'s','Ş':'S','ı':'i','İ':'I','ö':'o','Ö':'O','ç':'c','Ç':'C'} as Record<string,string>)[c]||c)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
      const projeId = proje?.id || 'genel'
      const fileName = `${userId}/${projeId}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage.from('dokumanlar').upload(fileName, selectedFile, { contentType: selectedFile.type })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('dokumanlar').insert({
        firma_id: firma.id,
        proje_id: proje?.id || null,
        dosya_adi: selectedFile.name,
        dosya_url: fileName,
        dosya_boyut: selectedFile.size,
        kategori: form.kategori,
        aciklama: form.aciklama,
        user_id: userId,
      })
      if (insertError) {
        console.error('Insert error:', JSON.stringify(insertError))
        alert('Kayıt hatası: ' + insertError.message + ' | ' + insertError.code)
        return
      }

      setModal(false); setSelectedFile(null)
      fetchDokumanlar()
    } catch (e: any) {
      alert('Yükleme hatası: ' + e.message)
    } finally { setUploading(false) }
  }

  async function handleDownload(dok: Dokuman) {
    const { data } = await supabase.storage.from('dokumanlar').createSignedUrl(dok.dosya_url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(dok: Dokuman) {
    if (!confirm(`"${dok.dosya_adi}" dosyasını silmek istediğinize emin misiniz?`)) return
    await supabase.storage.from('dokumanlar').remove([dok.dosya_url])
    await supabase.from('dokumanlar').delete().eq('id', dok.id)
    fetchDokumanlar()
  }

  const baslik = kategori ? KAT_LABELS[kategori] : 'Dökümanlar'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{baslik}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{proje?.ad || firma.ad} • {dokumanlar.length} dosya</p>
        </div>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors">
          <Upload size={14}/> PDF Yükle
        </button>
        <input ref={fileRef} type="file" accept="*" className="hidden"
          onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}/>
      </div>

      {/* Drag & Drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 mb-4 text-center cursor-pointer transition-all ${dragOver?'border-blue-400 bg-blue-50':'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
        <Upload size={24} className={`mx-auto mb-1.5 ${dragOver?'text-blue-500':'text-slate-300'}`}/>
        <p className="text-sm text-slate-500">PDF dosyasını sürükleyin veya tıklayın</p>
        <p className="text-xs text-slate-400 mt-0.5">Maks. 10MB</p>
      </div>

      {/* Liste */}
      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        dokumanlar.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
            <FolderOpen size={32} className="text-slate-200 mx-auto mb-2"/>
            <p className="text-slate-400 text-sm">Henüz döküman yüklenmedi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dokumanlar.map(d => (
              <div key={d.id} className="bg-white rounded-xl border border-slate-100 p-3.5 flex items-center gap-3 hover:border-slate-200 transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-red-400"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.dosya_adi}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">{KAT_LABELS[d.kategori]||d.kategori}</span>
                    {d.dosya_boyut && <span className="text-[10px] text-slate-400">{formatBytes(d.dosya_boyut)}</span>}
                    <span className="text-[10px] text-slate-400">{d.yukleme_tarihi}</span>
                    {d.aciklama && <span className="text-[10px] text-slate-400 truncate">• {d.aciklama}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleDownload(d)} title="İndir/Görüntüle"
                    className="w-8 h-8 rounded-lg border border-slate-100 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all">
                    <Download size={13}/>
                  </button>
                  <button onClick={() => handleDelete(d)}
                    className="w-8 h-8 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && selectedFile && (
        <Modal title="PDF Yükle" onClose={() => { setModal(false); setSelectedFile(null) }}
          footer={<>
            <button className={btnSecondary} onClick={() => { setModal(false); setSelectedFile(null) }}>İptal</button>
            <button className={btnPrimary} onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Yükleniyor...' : 'Yükle'}
            </button>
          </>}>
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
                {Object.entries(KAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
