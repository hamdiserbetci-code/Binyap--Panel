'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  FolderOpen, Plus, Edit, Trash2, Search,
  ChevronDown, ChevronRight, Upload, Download, Eye, X,
  FileText, Receipt, RefreshCw, CheckCircle, Clock, AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, StatCard, Card, Modal, Btn, Field,
  inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate
} from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Proje } from '@/types'

// ─── Sabitler ────────────────────────────────────────────────
const PROJE_DURUM: Record<string, { l: string; v: 'blue'|'green'|'gray'|'red' }> = {
  planlama:   { l: 'Planlama',     v: 'gray'  },
  devam:      { l: 'Devam Ediyor', v: 'blue'  },
  tamamlandi: { l: 'Tamamlandi',   v: 'green' },
  iptal:      { l: 'Iptal',        v: 'red'   },
}

const emptyProje = {
  proje_adi: '', aciklama: '', baslangic_tarihi: '', bitis_tarihi: '',
  butce: '', durum: 'planlama', sorumlu_kisi: '', notlar: ''
}

const emptyHakedis = {
  hakedis_no: '',
  belge_tarihi: new Date().toISOString().split('T')[0],
  tutar: '',
  kdv_tutari: '',
  toplam_tutar: '',
  kesinti_faturali: '',
  kesinti_faturasiz: '',
  kesinti_teminat: '',
  yillara_yaygin: false,
  stopaj_orani: '5',
  stopaj_tutari: '',
  bizim_fatura_no: '',
  bizim_fatura_tarihi: '',
  bizim_fatura_tutar: '',
  bizim_kdv_orani: '20',
  bizim_kdv_tutari: '',
  bizim_fatura_toplam: '',
  net_odenecek: '',
  tevkifat_uygulaniyor: false,
  tevkifat_orani: '40',
  fatura_no: '',
  fatura_tarihi: '',
  odeme_durumu: 'bekliyor',
  odeme_tarihi: '',
  aciklama: '',
}

// ─── Ana Modul ────────────────────────────────────────────────
export default function ProjelerModule({ firma }: AppCtx) {
  const [data, setData]         = useState<Proje[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [durumF, setDurumF]     = useState('hepsi')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<Proje | null>(null)
  const [delId, setDelId]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState(emptyProje)

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('projeler').select('*').eq('firma_id', firma.id)
      .order('baslangic_tarihi', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const filtered = useMemo(() => data.filter(r => {
    if (durumF !== 'hepsi' && r.durum !== durumF) return false
    if (search && !r.proje_adi.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [data, durumF, search])

  const summary = useMemo(() => ({
    toplam:     data.length,
    devam:      data.filter(r => r.durum === 'devam').length,
    tamamlandi: data.filter(r => r.durum === 'tamamlandi').length,
    butce:      data.reduce((s, r) => s + Number(r.butce || 0), 0),
  }), [data])

  function openNew()  { setForm(emptyProje); setEditing(null); setModal(true) }
  function openEdit(r: Proje) {
    setForm({ proje_adi: r.proje_adi, aciklama: r.aciklama||'', baslangic_tarihi: r.baslangic_tarihi||'', bitis_tarihi: r.bitis_tarihi||'', butce: String(r.butce||''), durum: r.durum, sorumlu_kisi: r.sorumlu_kisi||'', notlar: r.notlar||'' })
    setEditing(r); setModal(true)
  }
  const sf = (k: keyof typeof emptyProje) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.proje_adi) return alert('Proje adi zorunludur')
    setSaving(true)
    const payload = { proje_adi: form.proje_adi, aciklama: form.aciklama||null, baslangic_tarihi: form.baslangic_tarihi||null, bitis_tarihi: form.bitis_tarihi||null, butce: form.butce ? Number(form.butce) : null, durum: form.durum as Proje['durum'], sorumlu_kisi: form.sorumlu_kisi||null, notlar: form.notlar||null }
    if (editing) { await supabase.from('projeler').update(payload).eq('id', editing.id) }
    else { await supabase.from('projeler').insert({ ...payload, firma_id: firma.id }) }
    setSaving(false); setModal(false); load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center"><FolderOpen className="w-4 h-4 text-purple-600" /></span>
            Projeler
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 ml-10">{summary.toplam} proje &middot; {summary.devam} devam ediyor &middot; {fmt(summary.butce)} toplam butce</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 w-40" />
          </div>
          <select value={durumF} onChange={e => setDurumF(e.target.value)} className={inputCls + ' w-auto text-sm'}>
            <option value="hepsi">Tum Durumlar</option>
            {Object.entries(PROJE_DURUM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Proje</Btn>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FolderOpen className="w-10 h-10" />} message="Proje bulunamadi" />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(r => (
              <ProjeSatiri
                key={r.id}
                proje={r}
                firma={firma}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                onEdit={() => openEdit(r)}
                onDelete={() => setDelId(r.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {modal && (
        <Modal title={editing ? 'Proje Duzenle' : 'Yeni Proje'} onClose={() => setModal(false)} size="lg"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>Iptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Proje Adi" required className="md:col-span-2">
              <input type="text" value={form.proje_adi} onChange={sf('proje_adi')} className={inputCls} />
            </Field>
            <Field label="Aciklama" className="md:col-span-2">
              <textarea rows={2} value={form.aciklama} onChange={sf('aciklama')} className={inputCls} />
            </Field>
            <Field label="Baslangic Tarihi" required>
              <input type="date" value={form.baslangic_tarihi} onChange={sf('baslangic_tarihi')} className={inputCls} />
            </Field>
            <Field label="Bitis Tarihi">
              <input type="date" value={form.bitis_tarihi} onChange={sf('bitis_tarihi')} className={inputCls} />
            </Field>
            <Field label="Butce (TL)">
              <input type="number" step="0.01" value={form.butce} onChange={sf('butce')} className={inputCls} />
            </Field>
            <Field label="Durum">
              <select value={form.durum} onChange={sf('durum')} className={inputCls}>
                {Object.entries(PROJE_DURUM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
            </Field>
            <Field label="Sorumlu Kisi" className="md:col-span-2">
              <input type="text" value={form.sorumlu_kisi} onChange={sf('sorumlu_kisi')} className={inputCls} />
            </Field>
            <Field label="Notlar" className="md:col-span-2">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu projeyi silmek istediginize emin misiniz?"
          onConfirm={async () => { await supabase.from('projeler').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}

//  Proje Satiri 
interface ProjeSatiriProps {
  proje: Proje; firma: { id: string }
  expanded: boolean; onToggle: () => void
  onEdit: () => void; onDelete: () => void
}

function ProjeSatiri({ proje: r, firma, expanded, onToggle, onEdit, onDelete }: ProjeSatiriProps) {
  const [belgeler, setBelgeler] = useState<any[]>([])
  const [odemeler, setOdemeler] = useState<any[]>([])
  const [giderler, setGiderler] = useState<any[]>([])
  const [loadingB, setLoadingB] = useState(false)
  const [aktifTab, setAktifTab] = useState<'hakedis'|'gider'|'sozlesme'|'diger'>('hakedis')
  const [hakedisModal, setHakedisModal] = useState(false)
  const [editingBelge, setEditingBelge] = useState<any|null>(null)
  const [hakedisForm, setHakedisForm] = useState(emptyHakedis)
  const [savingH, setSavingH] = useState(false)
  const [giderModal, setGiderModal] = useState(false)
  const [editingGider, setEditingGider] = useState<any|null>(null)
  const [savingG, setSavingG] = useState(false)
  const [preview, setPreview] = useState<{url:string;adi:string}|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const giderFaturaRef = useRef<Record<string,HTMLInputElement|null>>({})

  const emptyGider = {
    fatura_no:'', fatura_tarihi: new Date().toISOString().split('T')[0],
    cari_unvan:'', cari_plaka:'', cari_iban:'',
    gider_kalemi:'', tutar:'', kdv_orani:'20', kdv_tutari:'',
    tevkifat_orani:'0', tevkifat_tutari:'', net_tutar:'',
    vade_tarihi:'', odeme_durumu:'bekliyor', aciklama:'',
  }
  const [giderForm, setGiderForm] = useState(emptyGider)

  const d = PROJE_DURUM[r.durum] || PROJE_DURUM.planlama

  useEffect(() => { if (expanded) loadBelgeler() }, [expanded])

  async function loadBelgeler() {
    setLoadingB(true)
    const [b, o, g] = await Promise.all([
      supabase.from('proje_belgeler').select('*').eq('proje_id', r.id).order('belge_tarihi', { ascending: false }),
      supabase.from('proje_odemeler').select('*').eq('proje_id', r.id).order('odeme_tarihi', { ascending: false }),
      supabase.from('proje_giderler').select('*').eq('proje_id', r.id).order('fatura_tarihi', { ascending: false }),
    ])
    setBelgeler(b.data || [])
    setOdemeler(o.data || [])
    setGiderler(g.data || [])
    setLoadingB(false)
  }

  const sozlesmeler = belgeler.filter(b => b.belge_turu === 'sozlesme')
  const hakedisler  = belgeler.filter(b => b.belge_turu === 'hakedis')
  const digerler    = belgeler.filter(b => b.belge_turu === 'diger')

  // Gider hesapla
  function hesaplaGider(f: typeof emptyGider) {
    const tutar = Number(f.tutar || 0)
    const kdvOrani = Number(f.kdv_orani || 0)
    const kdv = Number(f.kdv_tutari) || Math.round(tutar * kdvOrani / 100 * 100) / 100
    const tevOrani = Number(f.tevkifat_orani || 0)
    const tev = Number(f.tevkifat_tutari) || Math.round(kdv * tevOrani / 100 * 100) / 100
    return { kdv, tev, net: tutar + kdv - tev }
  }

  async function saveGider() {
    if (!giderForm.cari_unvan || !giderForm.gider_kalemi || !giderForm.tutar) return alert('Cari unvan, gider kalemi ve tutar zorunludur')
    setSavingG(true)
    const { kdv, tev, net } = hesaplaGider(giderForm)
    const payload: any = {
      firma_id: firma.id, proje_id: r.id,
      fatura_no: giderForm.fatura_no || null, fatura_tarihi: giderForm.fatura_tarihi || null,
      cari_unvan: giderForm.cari_unvan, cari_plaka: giderForm.cari_plaka || null, cari_iban: giderForm.cari_iban || null,
      gider_kalemi: giderForm.gider_kalemi, tutar: Number(giderForm.tutar),
      kdv_orani: Number(giderForm.kdv_orani || 0), kdv_tutari: kdv,
      tevkifat_orani: Number(giderForm.tevkifat_orani || 0), tevkifat_tutari: tev, net_tutar: net,
      vade_tarihi: giderForm.vade_tarihi || null, odeme_durumu: giderForm.odeme_durumu, aciklama: giderForm.aciklama || null,
    }
    if (editingGider) {
      const { error: ue } = await supabase.from('proje_giderler').update(payload).eq('id', editingGider.id)
      if (ue) { alert('Guncelleme hatasi: ' + ue.message); setSavingG(false); return }
      if (editingGider.odeme_plani_id && giderForm.vade_tarihi) {
        await supabase.from('odeme_plani').update({ aciklama: `${giderForm.cari_unvan} - ${giderForm.gider_kalemi}`, tutar: net, kalan_tutar: net, vade_tarihi: giderForm.vade_tarihi }).eq('id', editingGider.odeme_plani_id)
      }
    } else {
      const { data: yeni, error: ie } = await supabase.from('proje_giderler').insert(payload).select().single()
      if (ie) { alert('Kayit hatasi: ' + ie.message); setSavingG(false); return }
      if (yeni?.id && giderForm.vade_tarihi) {
        const { data: op } = await supabase.from('odeme_plani').insert({ firma_id: firma.id, odeme_tipi: 'cari', aciklama: `${giderForm.cari_unvan} - ${giderForm.gider_kalemi}`, tutar: net, odenen_tutar: 0, kalan_tutar: net, vade_tarihi: giderForm.vade_tarihi, durum: 'bekliyor', notlar: `Proje gideri - ${r.proje_adi}` }).select().single()
        if (op?.id) await supabase.from('proje_giderler').update({ odeme_plani_id: op.id }).eq('id', yeni.id)
      }
    }
    setSavingG(false); setGiderModal(false); setEditingGider(null); loadBelgeler()
  }

  async function giderSil(g: any) {
    if (!confirm('Bu gider kaydi silinsin mi?')) return
    if (g.storage_path) await supabase.storage.from('proje-belgeler').remove([g.storage_path])
    if (g.odeme_plani_id) await supabase.from('odeme_plani').delete().eq('id', g.odeme_plani_id)
    await supabase.from('proje_giderler').delete().eq('id', g.id)
    loadBelgeler()
  }

  async function giderFaturaYukle(giderId: string, file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const path = `${firma.id}/${r.id}/gider/${giderId}_${Date.now()}_${safeName}`
    const mevcut = giderler.find(g => g.id === giderId)
    if (mevcut?.storage_path) await supabase.storage.from('proje-belgeler').remove([mevcut.storage_path])
    const { error } = await supabase.storage.from('proje-belgeler').upload(path, file)
    if (error) { alert('Yukleme hatasi: ' + error.message); return }
    await supabase.from('proje_giderler').update({ dosya_adi: file.name, storage_path: path }).eq('id', giderId)
    loadBelgeler()
  }

  async function giderFaturaOnizle(g: any) {
    const { data } = await supabase.storage.from('proje-belgeler').createSignedUrl(g.storage_path, 60)
    if (data?.signedUrl) setPreview({ url: data.signedUrl, adi: g.dosya_adi })
  }

  async function giderFaturaSil(g: any) {
    if (!confirm(`"${g.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('proje-belgeler').remove([g.storage_path])
    await supabase.from('proje_giderler').update({ dosya_adi: null, storage_path: null }).eq('id', g.id)
    loadBelgeler()
  }

  async function belgeIndir(b: any) {
    const { data } = await supabase.storage.from('proje-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = b.dosya_adi; a.click() }
  }

  async function belgeOnizle(b: any) {
    const { data } = await supabase.storage.from('proje-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) setPreview({ url: data.signedUrl, adi: b.dosya_adi })
  }

  async function belgeSil(b: any) {
    if (!confirm(`"${b.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('proje-belgeler').remove([b.storage_path])
    await supabase.from('proje_belgeler').delete().eq('id', b.id)
    loadBelgeler()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, belge_turu: string) {
    const file = e.target.files?.[0]; if (!file) return
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const path = `${firma.id}/${r.id}/${belge_turu}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('proje-belgeler').upload(path, file)
    if (error) { alert('Yukleme hatasi: ' + error.message); return }
    await supabase.from('proje_belgeler').insert({ proje_id: r.id, firma_id: firma.id, belge_turu, belge_tarihi: new Date().toISOString().split('T')[0], dosya_adi: file.name, storage_path: path })
    if (inputRef.current) inputRef.current.value = ''
    loadBelgeler()
  }
  return (
    <>
      <div className="border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
          <span className="text-gray-400">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{r.proje_adi}</span>
              <Badge label={d.l} variant={d.v} />
            </div>
            <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-500 flex-wrap">
              {r.sorumlu_kisi && <span>{r.sorumlu_kisi}</span>}
              {r.baslangic_tarihi && <span>{fmtDate(r.baslangic_tarihi)}</span>}
              {r.butce && <span>{fmt(Number(r.butce))}</span>}
            </div>
          </div>
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="bg-slate-50 border-t border-gray-200">
          {loadingB ? (
            <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              <div className="flex border-b border-gray-200 bg-white px-4 overflow-x-auto">
                {([
                  { v: 'hakedis',  l: 'Hakedis',   sayi: hakedisler.length  },
                  { v: 'gider',    l: 'Giderler',   sayi: giderler.length    },
                  { v: 'sozlesme', l: 'Sozlesme',   sayi: sozlesmeler.length },
                  { v: 'diger',    l: 'Diger',      sayi: digerler.length    },
                ] as const).map(bt => (
                  <button key={bt.v} onClick={() => setAktifTab(bt.v as any)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${aktifTab === bt.v ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {bt.l}
                    {bt.sayi > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${aktifTab === bt.v ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{bt.sayi}</span>}
                  </button>
                ))}
              </div>

              {aktifTab === 'hakedis' && (
                <div className="p-4">
                  <div className="space-y-2 mb-3">
                    {hakedisler.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Henuz hakedis kaydi yok</p>}
                    {hakedisler.map(b => (
                      <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{b.hakedis_no}</span>
                            <Badge label={b.odeme_durumu === 'odendi' ? 'Odendi' : 'Bekliyor'} variant={b.odeme_durumu === 'odendi' ? 'green' : 'yellow'} />
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex gap-3 flex-wrap">
                            {b.belge_tarihi && <span>{fmtDate(b.belge_tarihi)}</span>}
                            {b.fatura_no && <span>Fatura: {b.fatura_no}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{fmt(Number(b.net_odenecek || b.tutar || 0))}</p>
                        </div>
                        <div className="flex gap-1">
                          {b.storage_path && <button onClick={() => belgeOnizle(b)} className="p-1.5 text-gray-400 hover:text-blue-600"><Eye className="w-3.5 h-3.5" /></button>}
                          <button onClick={() => belgeSil(b)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleUpload(e, 'hakedis')} />
                  <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => inputRef.current?.click()}>Hakedis Belgesi Yukle</Btn>
                </div>
              )}

              {aktifTab === 'gider' && (
                <div className="p-4 space-y-4">
                  {giderler.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl border border-gray-200 p-3">
                        <p className="text-xs text-gray-500 mb-1">Toplam Gider</p>
                        <p className="text-base font-bold">{fmt(giderler.reduce((s,g)=>s+Number(g.tutar||0),0))}</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl border border-blue-200 p-3">
                        <p className="text-xs text-gray-500 mb-1">KDV</p>
                        <p className="text-base font-bold text-blue-700">{fmt(giderler.reduce((s,g)=>s+Number(g.kdv_tutari||0),0))}</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl border border-orange-200 p-3">
                        <p className="text-xs text-gray-500 mb-1">Tevkifat</p>
                        <p className="text-base font-bold text-orange-700">{fmt(giderler.reduce((s,g)=>s+Number(g.tevkifat_tutari||0),0))}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl border border-red-200 p-3">
                        <p className="text-xs text-gray-500 mb-1">Net Toplam</p>
                        <p className="text-base font-bold text-red-700">{fmt(giderler.reduce((s,g)=>s+Number(g.net_tutar||0),0))}</p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {giderler.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Henuz gider kaydi yok</p>}
                    {giderler.map(g => (
                      <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900">{g.cari_unvan}</span>
                              {g.cari_plaka && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{g.cari_plaka}</span>}
                              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{g.gider_kalemi}</span>
                              <Badge label={g.odeme_durumu === 'odendi' ? 'Odendi' : g.odeme_durumu === 'kismi' ? 'Kismi' : 'Bekliyor'} variant={g.odeme_durumu === 'odendi' ? 'green' : g.odeme_durumu === 'kismi' ? 'blue' : 'yellow'} />
                              {g.odeme_plani_id && <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Odeme planinda</span>}
                              {g.storage_path && <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-1"><FileText className="w-3 h-3 inline" />{g.dosya_adi}</span>}
                            </div>
                            <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                              {g.fatura_no && <span>Fatura: {g.fatura_no}</span>}
                              {g.fatura_tarihi && <span>{fmtDate(g.fatura_tarihi)}</span>}
                              {g.vade_tarihi && <span>Vade: {fmtDate(g.vade_tarihi)}</span>}
                              {g.cari_iban && <span className="font-mono">{g.cari_iban}</span>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900">{fmt(g.net_tutar)}</p>
                            <p className="text-xs text-gray-400">{fmt(g.tutar)} + KDV%{g.kdv_orani}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0 items-start">
                            <input ref={el => { giderFaturaRef.current[g.id] = el }} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) giderFaturaYukle(g.id, f); e.target.value = '' }} />
                            {g.storage_path ? (
                              <>
                                <button onClick={() => giderFaturaOnizle(g)} title="Goruntule" className="p-1.5 text-gray-400 hover:text-green-600 rounded"><Eye className="w-3.5 h-3.5" /></button>
                                <button onClick={() => giderFaturaSil(g)} title="Fatura Sil" className="p-1.5 text-gray-400 hover:text-orange-500 rounded"><X className="w-3.5 h-3.5" /></button>
                              </>
                            ) : (
                              <button onClick={() => giderFaturaRef.current[g.id]?.click()} title="Fatura Yukle" className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Upload className="w-3.5 h-3.5" /></button>
                            )}
                            <button onClick={() => { setGiderForm({ fatura_no: g.fatura_no||'', fatura_tarihi: g.fatura_tarihi||'', cari_unvan: g.cari_unvan, cari_plaka: g.cari_plaka||'', cari_iban: g.cari_iban||'', gider_kalemi: g.gider_kalemi, tutar: String(g.tutar), kdv_orani: String(g.kdv_orani), kdv_tutari: String(g.kdv_tutari), tevkifat_orani: String(g.tevkifat_orani), tevkifat_tutari: String(g.tevkifat_tutari), net_tutar: String(g.net_tutar), vade_tarihi: g.vade_tarihi||'', odeme_durumu: g.odeme_durumu, aciklama: g.aciklama||'' }); setEditingGider(g); setGiderModal(true) }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => giderSil(g)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Btn size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setGiderForm(emptyGider); setEditingGider(null); setGiderModal(true) }}>Yeni Gider Faturasi</Btn>
                </div>
              )}

              {aktifTab === 'sozlesme' && (
                <div className="p-4 space-y-3">
                  {sozlesmeler.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Henuz sozlesme yuklenmedi</p>}
                  {sozlesmeler.map(b => (
                    <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{b.dosya_adi}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => belgeOnizle(b)} className="p-1.5 text-gray-400 hover:text-blue-600"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => belgeIndir(b)} className="p-1.5 text-gray-400 hover:text-green-600"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => belgeSil(b)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleUpload(e, 'sozlesme')} />
                  <Btn size="sm" variant="secondary" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => inputRef.current?.click()}>Sozlesme Yukle</Btn>
                </div>
              )}

              {aktifTab === 'diger' && (
                <div className="p-4 space-y-3">
                  {digerler.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Henuz belge yuklenmedi</p>}
                  {digerler.map(b => (
                    <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{b.dosya_adi}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => belgeOnizle(b)} className="p-1.5 text-gray-400 hover:text-blue-600"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => belgeIndir(b)} className="p-1.5 text-gray-400 hover:text-green-600"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => belgeSil(b)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleUpload(e, 'diger')} />
                  <Btn size="sm" variant="secondary" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => inputRef.current?.click()}>Belge Yukle</Btn>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {giderModal && (
        <Modal title={editingGider ? 'Gider Duzenle' : 'Yeni Gider Faturasi'} onClose={() => { setGiderModal(false); setEditingGider(null) }} size="lg"
          footer={<><Btn variant="secondary" onClick={() => { setGiderModal(false); setEditingGider(null) }}>Iptal</Btn><Btn onClick={saveGider} disabled={savingG}>{savingG ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Fatura No"><input type="text" value={giderForm.fatura_no} onChange={e => setGiderForm(p=>({...p,fatura_no:e.target.value}))} className={inputCls} /></Field>
            <Field label="Fatura Tarihi"><input type="date" value={giderForm.fatura_tarihi} onChange={e => setGiderForm(p=>({...p,fatura_tarihi:e.target.value}))} className={inputCls} /></Field>
            <Field label="Cari / Tedarikci Unvani" required className="md:col-span-2"><input type="text" value={giderForm.cari_unvan} onChange={e => setGiderForm(p=>({...p,cari_unvan:e.target.value}))} className={inputCls} /></Field>
            <Field label="Plaka"><input type="text" value={giderForm.cari_plaka} onChange={e => setGiderForm(p=>({...p,cari_plaka:e.target.value.toUpperCase()}))} className={inputCls} /></Field>
            <Field label="IBAN"><input type="text" value={giderForm.cari_iban} onChange={e => setGiderForm(p=>({...p,cari_iban:e.target.value}))} className={`${inputCls} font-mono`} placeholder="TR..." /></Field>
            <Field label="Gider Kalemi" required className="md:col-span-2"><input type="text" value={giderForm.gider_kalemi} onChange={e => setGiderForm(p=>({...p,gider_kalemi:e.target.value}))} className={inputCls} placeholder="Malzeme, Iscilik, Nakliye..." /></Field>
            <Field label="Tutar (KDV Haric)" required>
              <input type="number" step="0.01" value={giderForm.tutar} onChange={e => {
                const t = Number(e.target.value||0); const ko = Number(giderForm.kdv_orani||0)
                const kdv = Math.round(t*ko/100*100)/100; const to = Number(giderForm.tevkifat_orani||0)
                const tev = Math.round(kdv*to/100*100)/100
                setGiderForm(p=>({...p,tutar:e.target.value,kdv_tutari:String(kdv),tevkifat_tutari:String(tev),net_tutar:String(t+kdv-tev)}))
              }} className={inputCls} />
            </Field>
            <Field label="KDV Orani (%)">
              <select value={giderForm.kdv_orani} onChange={e => {
                const ko = Number(e.target.value); const t = Number(giderForm.tutar||0)
                const kdv = Math.round(t*ko/100*100)/100; const to = Number(giderForm.tevkifat_orani||0)
                const tev = Math.round(kdv*to/100*100)/100
                setGiderForm(p=>({...p,kdv_orani:e.target.value,kdv_tutari:String(kdv),tevkifat_tutari:String(tev),net_tutar:String(t+kdv-tev)}))
              }} className={inputCls}>
                <option value="0">%0</option><option value="1">%1</option><option value="10">%10</option><option value="20">%20</option>
              </select>
            </Field>
            <Field label="KDV Tutari"><input type="number" step="0.01" value={giderForm.kdv_tutari} readOnly className={`${inputCls} bg-gray-50`} /></Field>
            <Field label="Tevkifat Orani (%)">
              <select value={giderForm.tevkifat_orani} onChange={e => {
                const to = Number(e.target.value); const kdv = Number(giderForm.kdv_tutari||0)
                const tev = Math.round(kdv*to/100*100)/100
                setGiderForm(p=>({...p,tevkifat_orani:e.target.value,tevkifat_tutari:String(tev),net_tutar:String(Number(giderForm.tutar||0)+kdv-tev)}))
              }} className={inputCls}>
                <option value="0">Yok</option><option value="20">%20</option><option value="30">%30</option><option value="40">%40</option><option value="50">%50</option><option value="60">%60</option><option value="70">%70</option><option value="80">%80</option><option value="90">%90</option>
              </select>
            </Field>
            <Field label="Net Tutar"><input type="number" step="0.01" value={giderForm.net_tutar} readOnly className={`${inputCls} bg-gray-50 font-bold`} /></Field>
            <Field label="Vade Tarihi"><input type="date" value={giderForm.vade_tarihi} onChange={e => setGiderForm(p=>({...p,vade_tarihi:e.target.value}))} className={inputCls} /></Field>
            <Field label="Odeme Durumu">
              <select value={giderForm.odeme_durumu} onChange={e => setGiderForm(p=>({...p,odeme_durumu:e.target.value}))} className={inputCls}>
                <option value="bekliyor">Bekliyor</option><option value="odendi">Odendi</option><option value="kismi">Kismi</option><option value="iptal">Iptal</option>
              </select>
            </Field>
            <Field label="Aciklama" className="md:col-span-2"><textarea rows={2} value={giderForm.aciklama} onChange={e => setGiderForm(p=>({...p,aciklama:e.target.value}))} className={inputCls} /></Field>
            {!editingGider && giderForm.vade_tarihi && (
              <div className="md:col-span-2 bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
                Vade tarihi girildiginde bu gider otomatik olarak odeme planina eklenecek.
              </div>
            )}
          </div>
        </Modal>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm truncate">{preview.adi}</span>
              <div className="flex gap-2">
                <button onClick={async () => { const a = document.createElement('a'); a.href = preview.url; a.download = preview.adi; a.click() }} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Download className="w-3 h-3" />Indir</button>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {preview.adi.toLowerCase().endsWith('.pdf')
                ? <iframe src={preview.url} className="w-full h-full min-h-[60vh]" />
                : <img src={preview.url} alt={preview.adi} className="max-w-full mx-auto" />
              }
            </div>
          </div>
        </div>
      )}
    </>
  )
}