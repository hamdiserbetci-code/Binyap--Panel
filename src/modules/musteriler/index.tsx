'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Building2, Phone, Mail, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg, Modal, Field, ConfirmModal, cls, Empty } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Musteri } from '@/types'

const EMPTY: Partial<Musteri> = { ad: '', kisa_ad: '', vergi_no: '', yetkili: '', telefon: '', email: '', sektor: '', notlar: '', aktif: true }

export default function MusterilerModule({ firma, navigate }: AppCtx) {
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [editing, setEditing]       = useState<Partial<Musteri> | null>(null)
  const [deleting, setDeleting]     = useState<Musteri | null>(null)
  const [saving, setSaving]         = useState(false)
  const [formErr, setFormErr]       = useState('')

  useEffect(() => { load() }, [firma.id])

  async function load() {
    setLoading(true); setError('')
    const { data, error: e } = await supabase
      .from('musteriler').select('*')
      .eq('firma_id', firma.id).order('ad')
    if (e) { setError(e.message); setLoading(false); return }
    setMusteriler((data || []) as Musteri[])
    setLoading(false)
  }

  async function save() {
    if (!editing?.ad?.trim()) { setFormErr('Müşteri adı zorunludur'); return }
    setSaving(true); setFormErr('')
    const payload = { ...editing, firma_id: firma.id }
    const { error: e } = editing.id
      ? await supabase.from('musteriler').update(payload).eq('id', editing.id)
      : await supabase.from('musteriler').insert(payload)
    setSaving(false)
    if (e) { setFormErr(e.message); return }
    setEditing(null)
    load()
  }

  async function deleteMus() {
    if (!deleting) return
    await supabase.from('musteriler').delete().eq('id', deleting.id)
    setDeleting(null)
    load()
  }

  const filtered = musteriler.filter(m =>
    !search || m.ad.toLowerCase().includes(search.toLowerCase()) ||
    (m.vergi_no || '').includes(search) ||
    (m.yetkili || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Loading />
  if (error)   return <ErrorMsg message={error} onRetry={load} />

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Müşteriler</h1>
          <p className="text-sm text-slate-500 mt-0.5">{musteriler.filter(m => m.aktif).length} aktif müşteri</p>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY }); setFormErr('') }} className={cls.btnPrimary}>
          <Plus size={15} />Yeni Müşteri
        </button>
      </div>

      {/* Arama */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${cls.input} pl-9`} placeholder="Ad, vergi no veya yetkili ara..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Empty icon={() => <Building2 size={24} className="text-slate-400" />} title="Müşteri bulunamadı" description="Yeni müşteri ekleyerek başlayın" action={<button onClick={() => setEditing({ ...EMPTY })} className={cls.btnPrimary}><Plus size={14} />Müşteri Ekle</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(m => (
            <div key={m.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/80 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <span className="text-blue-400 text-sm font-bold">{(m.kisa_ad || m.ad)[0]?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">{m.ad}</p>
                    {m.kisa_ad && <p className="text-xs text-slate-500">{m.kisa_ad}</p>}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${m.aktif ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-500'}`}>
                  {m.aktif ? 'Aktif' : 'Pasif'}
                </span>
              </div>

              <div className="space-y-1.5 mb-4">
                {m.vergi_no && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="font-medium text-slate-500 w-14">Vergi No</span>
                    {m.vergi_no}
                  </p>
                )}
                {m.yetkili && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="font-medium text-slate-500 w-14">Yetkili</span>
                    {m.yetkili}
                  </p>
                )}
                {m.telefon && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Phone size={11} className="text-slate-500" />{m.telefon}
                  </p>
                )}
                {m.email && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Mail size={11} className="text-slate-500" />{m.email}
                  </p>
                )}
                {m.sektor && (
                  <p className="text-xs text-slate-500 italic">{m.sektor}</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-700/40">
                <button onClick={() => navigate('gorevler')}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-blue-400 hover:bg-blue-900/30 py-1.5 rounded-lg transition-colors">
                  İş Takip <ChevronRight size={11} />
                </button>
                <button onClick={() => { setEditing(m); setFormErr('') }}
                  className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => setDeleting(m)}
                  className="w-8 h-8 rounded-lg hover:bg-red-900/30 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {editing && (
        <Modal title={editing.id ? 'Müşteri Düzenle' : 'Yeni Müşteri'} onClose={() => setEditing(null)} size="md"
          footer={<><button onClick={() => setEditing(null)} className={cls.btnSecondary}>İptal</button><button onClick={save} disabled={saving} className={cls.btnPrimary}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Müşteri Adı" required error={formErr}>
                <input className={cls.input} value={editing.ad || ''} onChange={e => setEditing(p => ({ ...p, ad: e.target.value }))} autoFocus />
              </Field>
              <Field label="Kısa Ad">
                <input className={cls.input} placeholder="Örn: ABC Ltd" value={editing.kisa_ad || ''} onChange={e => setEditing(p => ({ ...p, kisa_ad: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vergi No">
                <input className={cls.input} value={editing.vergi_no || ''} onChange={e => setEditing(p => ({ ...p, vergi_no: e.target.value }))} />
              </Field>
              <Field label="Sektör">
                <input className={cls.input} placeholder="İnşaat, Ticaret..." value={editing.sektor || ''} onChange={e => setEditing(p => ({ ...p, sektor: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Yetkili">
                <input className={cls.input} value={editing.yetkili || ''} onChange={e => setEditing(p => ({ ...p, yetkili: e.target.value }))} />
              </Field>
              <Field label="Telefon">
                <input className={cls.input} value={editing.telefon || ''} onChange={e => setEditing(p => ({ ...p, telefon: e.target.value }))} />
              </Field>
            </div>
            <Field label="E-posta">
              <input className={cls.input} type="email" value={editing.email || ''} onChange={e => setEditing(p => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field label="Notlar">
              <textarea className={`${cls.input} resize-none`} rows={2} value={editing.notlar || ''} onChange={e => setEditing(p => ({ ...p, notlar: e.target.value }))} />
            </Field>
            <Field label="Durum">
              <select className={cls.input} value={editing.aktif ? '1' : '0'} onChange={e => setEditing(p => ({ ...p, aktif: e.target.value === '1' }))}>
                <option value="1">Aktif</option>
                <option value="0">Pasif</option>
              </select>
            </Field>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal title="Müşteriyi Sil" message={`"${deleting.ad}" müşterisi ve ilgili tüm veriler silinecek.`} danger onConfirm={deleteMus} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}
