'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, Firma, AY_LABELS } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { AlertTriangle, Download, FileText, Upload, X } from 'lucide-react'

interface Props {
  userId: string
  firma: Firma
  vergiTur?: string
}

interface VDok {
  id: string
  dosya_adi: string
  dosya_url: string
  dosya_boyutu?: number
  aciklama?: string
  created_at: string
}

const VERGI_ISIMLERI: Record<string, string> = {
  kdv: 'KDV Beyannamesi',
  muhtasar_sgk: 'Muhtasar ve SGK Beyannamesi',
  gecici_vergi: 'Gecici Vergi',
  kurumlar_vergisi: 'Kurumlar Vergisi',
  edefter_berat: 'E-Defter Berat Gonderme',
}

export default function VergiPage({ userId, firma, vergiTur }: Props) {
  const [veriler, setVeriler] = useState<any[]>([])
  const [dokumanlar, setDokumanlar] = useState<VDok[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear())
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    ay: new Date().getMonth() + 1,
    son_tarih: '',
    beyan_tarihi: '',
    tutar: '',
    durum: 'bekleniyor',
    aciklama: '',
  })

  const fetchVeriler = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('vergi_surecleri')
      .select('*')
      .eq('firma_id', firma.id)
      .eq('yil', selectedYil)
      .order('ay', { ascending: true })

    if (vergiTur) {
      query = query.eq('tur', vergiTur)
    }

    const { data } = await query
    setVeriler(data || [])
    setLoading(false)
  }, [firma.id, selectedYil, vergiTur])

  const fetchDokumanlar = useCallback(async () => {
    const { data } = await supabase
      .from('dokumanlar')
      .select('*')
      .eq('firma_id', firma.id)
      .eq('kategori', vergiTur || 'genel_vergi')
      .order('created_at', { ascending: false })

    setDokumanlar(data || [])
  }, [firma.id, vergiTur])

  useEffect(() => {
    fetchVeriler()
    fetchDokumanlar()
  }, [fetchDokumanlar, fetchVeriler])

  function openModal(item?: any) {
    setEditing(item || null)
    setForm(
      item
        ? {
            ay: item.ay,
            son_tarih: item.son_tarih || '',
            beyan_tarihi: item.beyan_tarihi || '',
            tutar: String(item.tutar || ''),
            durum: item.durum || 'bekleniyor',
            aciklama: item.aciklama || '',
          }
        : {
            ay: new Date().getMonth() + 1,
            son_tarih: '',
            beyan_tarihi: '',
            tutar: '',
            durum: 'bekleniyor',
            aciklama: '',
          }
    )
    setModal(true)
  }

  async function handleSave() {
    if (!form.son_tarih) return

    const payload = {
      firma_id: firma.id,
      user_id: userId,
      tur: vergiTur || 'kdv',
      yil: selectedYil,
      ay: Number(form.ay),
      son_tarih: form.son_tarih,
      beyan_tarihi: form.beyan_tarihi || null,
      tutar: parseFloat(form.tutar) || 0,
      durum: form.durum,
      aciklama: form.aciklama,
    }

    if (editing) {
      await supabase.from('vergi_surecleri').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('vergi_surecleri').insert(payload)
    }

    setModal(false)
    fetchVeriler()
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu kaydi silmek istediginize emin misiniz?')) return
    await supabase.from('vergi_surecleri').delete().eq('id', id)
    fetchVeriler()
  }

  async function updateDurum(veri: any, durum: string) {
    await supabase
      .from('vergi_surecleri')
      .update({
        durum,
        ...(durum === 'odendi' ? { beyan_tarihi: today } : {}),
      })
      .eq('id', veri.id)
    fetchVeriler()
  }

  async function handleFileUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert("Dosya boyutu 10MB'dan buyuk olamaz!")
      return
    }

    setUploading(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const fileName = `vergi/${userId}/${firma.id}/${vergiTur || 'genel'}/${Date.now()}_${safeName}`
      const { error } = await supabase.storage
        .from('proje_dokumanlari')
        .upload(fileName, file, { contentType: file.type })

      if (error) throw error

      await supabase.from('dokumanlar').insert({
        firma_id: firma.id,
        kategori: vergiTur || 'genel_vergi',
        dosya_adi: file.name,
        dosya_url: fileName,
        dosya_boyutu: file.size,
        user_id: userId,
      })

      fetchDokumanlar()
    } catch (error: any) {
      alert(`Yukleme hatasi: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDokDelete(dok: VDok) {
    if (!confirm(`"${dok.dosya_adi}" dosyasini silmek istediginize emin misiniz?`)) return
    await supabase.storage.from('proje_dokumanlari').remove([dok.dosya_url])
    await supabase.from('dokumanlar').delete().eq('id', dok.id)
    fetchDokumanlar()
  }

  async function handleDownload(dok: VDok) {
    const { data } = await supabase.storage.from('proje_dokumanlari').createSignedUrl(dok.dosya_url, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  function formatBytes(bytes?: number) {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const fmt = (value: number) =>
    `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
  const yillar = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const baslik = vergiTur ? VERGI_ISIMLERI[vergiTur] || vergiTur : 'Vergi Surecleri'

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">{baslik}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {firma.ad} - {selectedYil} kayitlari
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYil}
            onChange={(e) => setSelectedYil(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none"
          >
            {yillar.map((yil) => (
              <option key={yil} value={yil}>
                {yil}
              </option>
            ))}
          </select>
          <button
            onClick={() => openModal()}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Yeni Kayit Ekle
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mb-6 text-sm text-slate-400">Yukleniyor...</p>
      ) : veriler.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-slate-700 bg-white/5 py-12 text-center">
          <p className="mb-2 text-slate-400">Bu yil icin {baslik} kaydi bulunamadi.</p>
          <button onClick={() => openModal()} className="text-sm text-blue-400 hover:underline">
            Ilk kaydi ekle
          </button>
        </div>
      ) : (
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-700 bg-white/5">
          <div className="grid grid-cols-7 gap-2 bg-slate-900/70 px-4 py-3 text-xs font-medium text-slate-300">
            <div>Donem</div>
            <div>Son Tarih</div>
            <div>Beyan Tarihi</div>
            <div className="text-right">Tutar</div>
            <div>Durum</div>
            <div>Aciklama</div>
            <div className="text-right">Islemler</div>
          </div>
          {veriler.map((item: any) => {
            const gecikti = item.son_tarih && item.son_tarih < today && item.durum !== 'odendi'
            return (
              <div
                key={item.id}
                className={`grid grid-cols-7 items-center gap-2 border-b border-slate-800/50 px-4 py-3 text-sm text-slate-100 transition-colors ${
                  gecikti ? 'bg-red-500/5' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-blue-400">
                  {AY_LABELS[item.ay]}
                  {gecikti && <AlertTriangle size={12} className="text-red-400" />}
                </div>
                <div>{item.son_tarih || '-'}</div>
                <div>{item.beyan_tarihi || '-'}</div>
                <div className="text-right font-semibold">{fmt(item.tutar || 0)}</div>
                <div>
                  <select
                    value={item.durum}
                    onChange={(e) => updateDurum(item, e.target.value)}
                    className={`cursor-pointer rounded-md px-2 py-1 text-[10px] font-medium outline-none ${
                      item.durum === 'odendi'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : item.durum === 'gecikti'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    <option value="bekleniyor">Bekleniyor</option>
                    <option value="odendi">Odendi / Verildi</option>
                    <option value="gecikti">Gecikti</option>
                  </select>
                </div>
                <div className="truncate text-xs text-slate-400" title={item.aciklama}>
                  {item.aciklama || '-'}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => openModal(item)}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-white transition-colors hover:bg-slate-700"
                  >
                    Duzenle
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-lg bg-red-900/30 px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-900/50"
                  >
                    Sil
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/[0.02] px-4 py-3">
          <p className="text-sm font-medium text-slate-200">Tahakkuk ve dekont dokumanlari</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08]"
          >
            <Upload size={12} />
            PDF Yukle
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }}
          />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFileUpload(file)
          }}
          onClick={() => fileRef.current?.click()}
          className={`mx-4 my-4 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            dragOver
              ? 'border-blue-400 bg-blue-500/10'
              : 'border-white/[0.08] hover:border-blue-300 hover:bg-white/[0.04]'
          }`}
        >
          {uploading ? (
            <p className="flex items-center justify-center gap-2 text-sm text-blue-500">
              <Upload size={16} className="animate-bounce" />
              Yukleniyor...
            </p>
          ) : (
            <>
              <Upload size={24} className={`mx-auto mb-2 ${dragOver ? 'text-blue-400' : 'text-slate-400'}`} />
              <p className="text-sm text-slate-300">
                Tahakkuk fisi veya dekont PDF&apos;ini surukleyin ya da tiklayin
              </p>
            </>
          )}
        </div>

        {dokumanlar.length === 0 ? (
          <p className="pb-6 text-center text-xs text-slate-500">Henuz dokuman yuklenmedi</p>
        ) : (
          <div className="divide-y divide-slate-800/50 pb-2">
            {dokumanlar.map((dok) => (
              <div key={dok.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10">
                  <FileText size={14} className="text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{dok.dosya_adi}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatBytes(dok.dosya_boyutu)} - Yukleme: {dok.created_at?.split('T')[0]}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    onClick={() => handleDownload(dok)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] text-slate-400 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-400"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => handleDokDelete(dok)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] text-slate-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title={editing ? 'Kaydi Duzenle' : 'Yeni Kayit Ekle'}
          onClose={() => setModal(false)}
          footer={
            <>
              <button className={btnSecondary} onClick={() => setModal(false)}>
                Iptal
              </button>
              <button className={btnPrimary} onClick={handleSave}>
                Kaydet
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Ilgili Ay" required>
                <select
                  className={inputCls}
                  value={form.ay}
                  onChange={(e) => setForm({ ...form, ay: Number(e.target.value) })}
                >
                  {AY_LABELS.map((ay, index) => index > 0 && <option key={index} value={index}>{ay}</option>)}
                </select>
              </FormField>
              <FormField label="Durum" required>
                <select
                  className={inputCls}
                  value={form.durum}
                  onChange={(e) => setForm({ ...form, durum: e.target.value })}
                >
                  <option value="bekleniyor">Bekleniyor</option>
                  <option value="odendi">Odendi / Verildi</option>
                  <option value="gecikti">Gecikti</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Son Tarih" required>
                <input
                  type="date"
                  className={inputCls}
                  value={form.son_tarih}
                  onChange={(e) => setForm({ ...form, son_tarih: e.target.value })}
                />
              </FormField>
              <FormField label="Beyan / Odeme Tarihi">
                <input
                  type="date"
                  className={inputCls}
                  value={form.beyan_tarihi}
                  onChange={(e) => setForm({ ...form, beyan_tarihi: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Tutar (TL)">
              <input
                type="number"
                className={inputCls}
                value={form.tutar}
                onChange={(e) => setForm({ ...form, tutar: e.target.value })}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Aciklama / Notlar">
              <textarea
                className={inputCls}
                rows={2}
                value={form.aciklama}
                onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
                placeholder="Eklemek istediginiz notlar..."
              />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
