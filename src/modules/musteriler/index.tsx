'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Building2, Phone, Mail, ChevronRight, User2, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg, Modal, Field, ConfirmModal, cls, Empty } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Musteri } from '@/types'

const EMPTY: Partial<Musteri> = { ad: '', kisa_ad: '', vergi_no: '', yetkili: '', telefon: '', email: '', sektor: '', notlar: '', aktif: true }

function getCardStyle(index: number) {
  const styles = [
    'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/20',
    'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/20',
    'from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/20',
    'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/20',
    'from-purple-500/20 to-fuchsia-500/20 text-purple-400 border-purple-500/20',
    'from-indigo-500/20 to-violet-500/20 text-indigo-400 border-indigo-500/20',
  ];
  return styles[index % styles.length];
}

export default function MusterilerModule({ firma, firmalar, firmaIds, navigate }: AppCtx) {
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [editing, setEditing]       = useState<Partial<Musteri> | null>(null)
  const [deleting, setDeleting]     = useState<Musteri | null>(null)
  const [saving, setSaving]         = useState(false)
  const [formErr, setFormErr]       = useState('')
  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  useEffect(() => { load() }, [firmaIds.join(',')])

  async function load() {
    setLoading(true); setError('')
    const { data, error: e } = await supabase
      .from('musteriler').select('*')
      .in('firma_id', firmaIds).order('ad')
    if (e) { setError(e.message); setLoading(false); return }
    setMusteriler((data || []) as Musteri[])
    setLoading(false)
  }

  async function save() {
    if (!editing?.ad?.trim()) { setFormErr('Müşteri adı zorunludur'); return }
    setSaving(true); setFormErr('')
    const payload = { ...editing, firma_id: editing.id ? (editing.firma_id || firma.id) : selFirmaId }
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
    <div className="space-y-5">
      {/* Header & Arama */}
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white">
              <Users size={18} className="text-slate-800" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-800">Müşteriler</h1>
              <p className="text-[13px] text-slate-500 mt-0.5">{musteriler.filter(m => m.aktif).length} aktif müşteri</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-auto min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full bg-white border border-blue-100 rounded-xl px-3 py-2 pl-9 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 transition-all"
                placeholder="Ad, vergi no veya yetkili ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={() => { setEditing({ ...EMPTY }); setFormErr('') }}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-slate-800 rounded-xl px-4 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 shadow-lg shadow-blue-500/20">
              <Plus size={14} /> Yeni Müşteri
            </button>
          </div>
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-[24px] bg-slate-100 border border-blue-100 flex flex-col items-center justify-center py-16 gap-4 shadow-xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-[16px] bg-slate-100 flex items-center justify-center shadow-inner border border-blue-100">
            <Building2 size={28} className="text-slate-500" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-bold text-slate-800">Müşteri bulunamadı</p>
            <p className="text-[13px] text-slate-400 mt-1">Aramanıza uygun kayıt yok veya yeni müşteri eklemelisiniz.</p>
          </div>
          <button onClick={() => setEditing({ ...EMPTY })}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-slate-800 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 shadow-lg shadow-blue-500/30">
            <Plus size={16} /> Yeni Müşteri
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filtered.map((m, i) => {
            const cardStyle = getCardStyle(i)
            const [bgFrom, bgTo, textCol, borderCol] = cardStyle.split(' ')

            return (
              <div key={m.id} className="flex flex-col bg-slate-100 border border-blue-100 rounded-[24px] p-5 hover:bg-slate-100 hover:shadow-2xl transition-all group relative overflow-hidden">
                <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity bg-gradient-to-br ${bgFrom} ${bgTo}`} />
                
                {/* Top: Avatar & Status */}
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shadow-inner border bg-gradient-to-br ${bgFrom} ${bgTo} ${borderCol}`}>
                    <span className={`text-lg font-bold drop-shadow-md ${textCol}`}>{(m.kisa_ad || m.ad)[0]?.toUpperCase()}</span>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${m.aktif ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-100 text-slate-400 border border-blue-100'}`}>
                    {m.aktif ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                
                {/* Content */}
                <div className="flex-1 relative z-10">
                  <h3 className="text-[17px] font-bold text-slate-800 mb-1 line-clamp-1 drop-shadow-md" title={m.ad}>{m.ad}</h3>
                  <p className="text-[12px] font-semibold text-slate-400 mb-4 truncate">{m.sektor || (m.kisa_ad ? `Kısa Ad: ${m.kisa_ad}` : 'Sektör Belirtilmedi')}</p>
                  
                  <div className="grid grid-cols-1 gap-2.5 bg-slate-50 p-3 rounded-[16px] border border-slate-100">
                    {m.yetkili ? (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><User2 size={12} className="text-slate-400"/></div>
                        <span className="truncate">{m.yetkili}</span>
                      </div>
                    ) : null}
                    {m.telefon ? (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Phone size={12} className="text-slate-400"/></div>
                        <span>{m.telefon}</span>
                      </div>
                    ) : null}
                    {m.email ? (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Mail size={12} className="text-slate-400"/></div>
                        <span className="truncate">{m.email}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Building2 size={12} className="text-slate-400"/></div>
                      <span>{m.vergi_no ? `VN: ${m.vergi_no}` : 'Vergi No Yok'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Actions Bottom */}
                <div className="mt-4 pt-4 border-t border-blue-100 flex items-center gap-2 relative z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => navigate?.('gorevler')}
                    className="flex-1 h-9 flex items-center justify-center gap-1.5 text-[11px] font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-[10px] transition-colors border border-blue-500/20 shadow-sm">
                    İş Takip <ChevronRight size={11} />
                  </button>
                  <button onClick={() => { setEditing(m); setFormErr('') }}
                    className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-slate-100 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors border border-blue-100 shadow-sm" title="Düzenle">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => setDeleting(m)}
                    className="w-9 h-9 flex items-center justify-center rounded-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors border border-rose-500/20 shadow-sm" title="Sil">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawer (Sağdan Açılan Form) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-md h-full bg-white border-l border-blue-100 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-blue-100 shrink-0 bg-slate-100">
              <h3 className="text-[18px] font-bold text-slate-800 tracking-wide drop-shadow-md">
                {editing.id ? 'Müşteri Düzenle' : 'Yeni Müşteri'}
              </h3>
              <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            {/* Drawer Body (Scrollable Form) */}
            <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-5">
              {!editing.id && firmalar.length > 1 && (
                <Field label="Firma">
                  <select className={cls.input} value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                    {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Müşteri Adı" required error={formErr}>
                  <input className={cls.input} value={editing.ad || ''} onChange={e => setEditing(p => ({ ...p, ad: e.target.value }))} autoFocus />
                </Field>
                <Field label="Kısa Ad">
                  <input className={cls.input} placeholder="Örn: ABC Ltd" value={editing.kisa_ad || ''} onChange={e => setEditing(p => ({ ...p, kisa_ad: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Vergi No">
                  <input className={cls.input} value={editing.vergi_no || ''} onChange={e => setEditing(p => ({ ...p, vergi_no: e.target.value }))} />
                </Field>
                <Field label="Sektör">
                  <input className={cls.input} placeholder="İnşaat, Ticaret..." value={editing.sektor || ''} onChange={e => setEditing(p => ({ ...p, sektor: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <textarea className={`${cls.input} resize-none`} rows={3} value={editing.notlar || ''} onChange={e => setEditing(p => ({ ...p, notlar: e.target.value }))} />
              </Field>
              <Field label="Durum">
                <select className={cls.input} value={editing.aktif ? '1' : '0'} onChange={e => setEditing(p => ({ ...p, aktif: e.target.value === '1' }))}>
                  <option value="1">Aktif</option>
                  <option value="0">Pasif</option>
                </select>
              </Field>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-blue-100 bg-slate-50 shrink-0 flex items-center justify-end gap-3">
              <button onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105">
                İptal
              </button>
              <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-[12px] text-[13px] font-bold bg-blue-600 hover:bg-blue-500 text-slate-800 shadow-lg shadow-blue-500/20 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>

          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal title="Müşteriyi Sil" message={`"${deleting.ad}" müşterisi ve ilgili tüm veriler silinecek.`} danger onConfirm={deleteMus} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}
