'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { Users, Plus, Edit, Trash2, Search, ChevronDown, ChevronRight, UserPlus, UserMinus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState } from '@/components/ui'
import type { AppCtx } from '@/app/page'

// Ekipler tablosu gerçek kolonlar: id, firma_id, proje_id, ad, sorumlu, aktif, created_at
// Personeller tablosu gerçek kolonlar: id, firma_id, ad_soyad, maas_tipi, net_maas, varsayilan_proje_id, aktif

const emptyForm = { proje_id: '', ad: '', sorumlu: '', aciklama: '' }

export default function EkiplerModule({ firma }: AppCtx) {
  const [ekipler, setEkipler]     = useState<any[]>([])
  const [projeler, setProjeler]   = useState<any[]>([])
  const [personeller, setPersoneller] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [projeF, setProjeF]       = useState('hepsi')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [ekipPersonel, setEkipPersonel] = useState<Record<string, any[]>>({})
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState<any | null>(null)
  const [delId, setDelId]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(emptyForm)
  const [personelModal, setPersonelModal] = useState<string | null>(null)
  const [seciliPersonel, setSeciliPersonel] = useState('')

  async function load() {
    setLoading(true)
    const [e, p, per] = await Promise.all([
      supabase.from('ekipler').select('*, projeler(proje_adi)').eq('firma_id', firma.id).order('ad'),
      supabase.from('projeler').select('id, proje_adi').eq('firma_id', firma.id),
      supabase.from('personeller').select('id, ad_soyad').eq('firma_id', firma.id).eq('aktif', true).order('ad_soyad'),
    ])
    if (e.error) console.error('Ekipler:', e.error.message)
    if (p.error) console.error('Projeler:', p.error.message)
    if (per.error) console.error('Personeller:', per.error.message)
    setEkipler(e.data || [])
    setProjeler(p.data || [])
    setPersoneller(per.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [firma.id])

  async function loadEkipPersonel(ekipId: string) {
    if (ekipPersonel[ekipId]) return
    const { data } = await supabase
      .from('ekip_personel')
      .select('*, personeller(ad_soyad)')
      .eq('ekip_id', ekipId)
      .eq('aktif', true)
    setEkipPersonel(prev => ({ ...prev, [ekipId]: data || [] }))
  }

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    await loadEkipPersonel(id)
  }

  const filtered = useMemo(() => ekipler.filter(e => {
    if (projeF !== 'hepsi' && e.proje_id !== projeF) return false
    if (search) {
      const q = search.toLowerCase()
      return e.ad?.toLowerCase().includes(q) || e.sorumlu?.toLowerCase().includes(q)
    }
    return true
  }), [ekipler, projeF, search])

  function openNew() { setForm(emptyForm); setEditing(null); setModal(true) }
  function openEdit(e: any) {
    setForm({ proje_id: e.proje_id || '', ad: e.ad || '', sorumlu: e.sorumlu || '', aciklama: e.aciklama || '' })
    setEditing(e); setModal(true)
  }

  async function save() {
    if (!form.proje_id || !form.ad) return alert('Proje ve ekip adı zorunludur')
    setSaving(true)
    const payload = {
      proje_id: form.proje_id,
      ad:       form.ad,
      sorumlu:  form.sorumlu || null,
    }
    const { error } = editing
      ? await supabase.from('ekipler').update(payload).eq('id', editing.id)
      : await supabase.from('ekipler').insert({ ...payload, firma_id: firma.id })
    if (error) alert('Hata: ' + error.message)
    setSaving(false); setModal(false); load()
  }

  async function deleteEkip(id: string) {
    await supabase.from('ekipler').delete().eq('id', id)
    setDelId(null); load()
  }

  async function personelEkle(ekipId: string) {
    if (!seciliPersonel) return
    const { error } = await supabase.from('ekip_personel').upsert(
      { ekip_id: ekipId, personel_id: seciliPersonel, aktif: true },
      { onConflict: 'ekip_id,personel_id' }
    )
    if (error) alert('Hata: ' + error.message)
    setSeciliPersonel('')
    setEkipPersonel(prev => { const n = { ...prev }; delete n[ekipId]; return n })
    await loadEkipPersonel(ekipId)
  }

  async function personelCikar(ekipId: string, kayitId: string) {
    await supabase.from('ekip_personel').update({ aktif: false }).eq('id', kayitId)
    setEkipPersonel(prev => { const n = { ...prev }; delete n[ekipId]; return n })
    await loadEkipPersonel(ekipId)
  }

  const sf = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users className="w-5 h-5 text-fuchsia-600" />}
        title="Ekipler"
        subtitle="Proje bazlı şantiye ekiplerini yönetin"
        iconBg="bg-fuchsia-50"
        action={<Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Ekip</Btn>}
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Ekip adı veya sorumlu..." value={search}
              onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`} />
          </div>
          <select value={projeF} onChange={e => setProjeF(e.target.value)} className={inputCls + ' w-auto'}>
            <option value="hepsi">Tüm Projeler</option>
            {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-fuchsia-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="w-10 h-10" />} message="Ekip bulunamadı" />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(ekip => {
              const isExp = expanded === ekip.id
              const uyeler = ekipPersonel[ekip.id] || []
              return (
                <div key={ekip.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleExpand(ekip.id)}>
                    <span className="text-gray-400">
                      {isExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{ekip.ad}</span>
                        <Badge label={ekip.projeler?.proje_adi || '-'} variant="blue" />
                        {ekip.sorumlu && <span className="text-xs text-gray-500">Sorumlu: {ekip.sorumlu}</span>}
                        {isExp && uyeler.length > 0 && <span className="text-xs text-gray-400">{uyeler.length} personel</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setPersonelModal(ekip.id); loadEkipPersonel(ekip.id) }}
                        className="p-1 text-gray-400 hover:text-fuchsia-600" title="Personel Ekle">
                        <UserPlus className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(ekip)} className="p-1 text-gray-400 hover:text-blue-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDelId(ekip.id)} className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExp && (
                    <div className="bg-gray-50 border-t border-gray-100 px-8 py-3">
                      {uyeler.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">Bu ekipte henüz personel yok.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {uyeler.map(ep => (
                            <div key={ep.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
                              <span className="text-sm font-medium text-gray-900">{ep.personeller?.ad_soyad || '-'}</span>
                              <button onClick={() => personelCikar(ekip.id, ep.id)} className="p-1 text-gray-400 hover:text-red-500">
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {modal && (
        <Modal title={editing ? 'Ekip Düzenle' : 'Yeni Ekip'} onClose={() => setModal(false)} size="md"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <Field label="Proje" required>
              <select value={form.proje_id} onChange={sf('proje_id')} className={inputCls}>
                <option value="">Proje Seçiniz</option>
                {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
              </select>
            </Field>
            <Field label="Ekip Adı" required>
              <input type="text" value={form.ad} onChange={sf('ad')} className={inputCls} placeholder="A Ekibi, Tünel Ekibi..." />
            </Field>
            <Field label="Sorumlu">
              <input type="text" value={form.sorumlu} onChange={sf('sorumlu')} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {personelModal && (
        <Modal title="Ekibe Personel Ekle" onClose={() => { setPersonelModal(null); setSeciliPersonel('') }} size="sm"
          footer={<><Btn variant="secondary" onClick={() => { setPersonelModal(null); setSeciliPersonel('') }}>Kapat</Btn><Btn onClick={() => personelEkle(personelModal)} disabled={!seciliPersonel}>Ekle</Btn></>}>
          <div className="space-y-4">
            <Field label="Personel Seçin">
              <select value={seciliPersonel} onChange={e => setSeciliPersonel(e.target.value)} className={inputCls}>
                <option value="">Personel Seçiniz</option>
                {personeller
                  .filter(p => !(ekipPersonel[personelModal] || []).some((ep: any) => ep.personel_id === p.id))
                  .map(p => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)
                }
              </select>
            </Field>
            {(ekipPersonel[personelModal] || []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Mevcut Üyeler</p>
                <div className="space-y-1">
                  {(ekipPersonel[personelModal] || []).map((ep: any) => (
                    <div key={ep.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                      <span>{ep.personeller?.ad_soyad}</span>
                      <button onClick={() => personelCikar(personelModal, ep.id)} className="text-red-400 hover:text-red-600">
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu ekibi silmek istediğinize emin misiniz?"
          onConfirm={() => deleteEkip(delId)} onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}
