'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardCheck, Download, Edit, FileText, Plus, Receipt, Search, Trash2,
  Upload, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, StatCard, Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'

type BeyannameTipi = 'kdv' | 'kdv2' | 'muhsgk' | 'gecici_vergi' | 'kurumlar_vergisi' | 'sgk'
type Kayit = {
  id: string
  firma_id: string
  tip: BeyannameTipi
  donem: string
  son_tarih: string
  durum: string
  tahakkuk_tutari: number
  odenen_tutar: number
  verilis_tarihi: string | null
  beyanname_no: string | null
  notlar: string | null
}
type Belge = { id: string; belge_turu: string; dosya_adi: string; storage_path: string; aciklama: string | null }
type Odeme = { id: string; odeme_tarihi: string; tutar: number; odeme_kanali: string; dekont_no: string | null; notlar: string | null }

const TIPLER: { value: BeyannameTipi; label: string; group: 'Vergi' | 'SGK' }[] = [
  { value: 'kdv', label: 'KDV', group: 'Vergi' },
  { value: 'kdv2', label: 'KDV 2', group: 'Vergi' },
  { value: 'muhsgk', label: 'MUHSGK', group: 'Vergi' },
  { value: 'gecici_vergi', label: 'Geçici Vergi', group: 'Vergi' },
  { value: 'kurumlar_vergisi', label: 'Kurumlar Vergisi', group: 'Vergi' },
  { value: 'sgk', label: 'Aylık SGK', group: 'SGK' },
]
const DURUMLAR: Record<string, { label: string; variant: 'yellow' | 'blue' | 'green' | 'red' | 'gray' }> = {
  bekliyor: { label: 'Bekliyor', variant: 'yellow' },
  hazirlaniyor: { label: 'Hazırlanıyor', variant: 'blue' },
  verildi: { label: 'Verildi', variant: 'blue' },
  onaylandi: { label: 'Onaylandı', variant: 'green' },
  kismi_odendi: { label: 'Kısmi Ödendi', variant: 'orange' as 'yellow' },
  odendi: { label: 'Ödendi', variant: 'green' },
  gecikti: { label: 'Gecikti', variant: 'red' },
}
const emptyForm = { tip: 'kdv' as BeyannameTipi, donem: '', son_tarih: '', tahakkuk_tutari: '0', durum: 'bekliyor', verilis_tarihi: '', beyanname_no: '', notlar: '' }
const emptyPayment = { odeme_tarihi: new Date().toISOString().slice(0, 10), tutar: '', odeme_kanali: 'banka', dekont_no: '', notlar: '' }

function tipLabel(tip: BeyannameTipi) { return TIPLER.find(t => t.value === tip)?.label || tip }
function isOverdue(row: Kayit) { return row.durum !== 'odendi' && new Date(row.son_tarih) < new Date(new Date().toDateString()) }

export default function BeyannameModule({ firma }: AppCtx) {
  const [rows, setRows] = useState<Kayit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'hepsi' | 'Vergi' | 'SGK'>('hepsi')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Kayit | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Kayit | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('beyanname_takibi').select('*').eq('firma_id', firma.id).order('son_tarih', { ascending: true })
    if (error) alert('Kayıtlar yüklenemedi: ' + error.message)
    setRows((data || []) as Kayit[])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const filtered = useMemo(() => rows.filter(row => {
    const group = TIPLER.find(t => t.value === row.tip)?.group
    const matchesGroup = filter === 'hepsi' || group === filter
    const q = search.toLocaleLowerCase('tr-TR')
    return matchesGroup && (!q || tipLabel(row.tip).toLocaleLowerCase('tr-TR').includes(q) || row.donem.toLocaleLowerCase().includes(q))
  }), [rows, filter, search])

  const summary = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => r.durum !== 'odendi').length,
    due: rows.filter(isOverdue).length,
    balance: rows.reduce((sum, r) => sum + Math.max(Number(r.tahakkuk_tutari || 0) - Number(r.odenen_tutar || 0), 0), 0),
  }), [rows])

  function openNew() { setEditing(null); setForm({ ...emptyForm, son_tarih: new Date().toISOString().slice(0, 10) }); setModal(true) }
  function openEdit(row: Kayit) {
    setEditing(row)
    setForm({ tip: row.tip, donem: row.donem, son_tarih: row.son_tarih || '', tahakkuk_tutari: String(row.tahakkuk_tutari || 0), durum: row.durum, verilis_tarihi: row.verilis_tarihi || '', beyanname_no: row.beyanname_no || '', notlar: row.notlar || '' })
    setModal(true)
  }
  const setField = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [key]: e.target.value }))

  async function save() {
    if (!form.donem || !form.son_tarih) return alert('Dönem ve son tarih zorunludur.')
    setSaving(true)
    const payload = { tip: form.tip, donem: form.donem, son_tarih: form.son_tarih, tahakkuk_tutari: Number(form.tahakkuk_tutari || 0), durum: form.durum, verilis_tarihi: form.verilis_tarihi || null, beyanname_no: form.beyanname_no || null, notlar: form.notlar || null }
    const result = editing
      ? await supabase.from('beyanname_takibi').update(payload).eq('id', editing.id)
      : await supabase.from('beyanname_takibi').insert({ ...payload, firma_id: firma.id, odenen_tutar: 0 })
    setSaving(false)
    if (result.error) return alert('Kaydetme hatası: ' + result.error.message)
    setModal(false); load()
  }

  async function remove() {
    if (!deleteId) return
    await supabase.from('beyanname_takibi').delete().eq('id', deleteId)
    setDeleteId(null); setDetail(null); load()
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={<ClipboardCheck className="w-5 h-5 text-teal-600" />} title="Beyanname & SGK Takibi" subtitle="Beyanname, tahakkuk, ödeme ve dekontları tek yerden yönetin" iconBg="bg-teal-50" action={<Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Kayıt</Btn>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Toplam Kayıt" value={summary.total} color="text-teal-600" />
        <StatCard label="Açık İşlem" value={summary.pending} color="text-blue-600" />
        <StatCard label="Geciken" value={summary.due} color="text-red-600" />
        <StatCard label="Ödenecek Bakiye" value={fmt(summary.balance)} color="text-orange-600" />
      </div>

      <Card>
        <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['hepsi', 'Vergi', 'SGK'] as const).map(item => <button key={item} onClick={() => setFilter(item)} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${filter === item ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>{item === 'hepsi' ? 'Tümü' : item}</button>)}
          </div>
          <div className="relative max-w-sm w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tür veya dönem ara..." className={`${inputCls} pl-9`} /></div>
        </div>
        {loading ? <div className="flex justify-center py-14"><div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div> : filtered.length === 0 ? <EmptyState icon={<ClipboardCheck className="w-10 h-10" />} message="Henüz beyanname veya SGK kaydı yok" /> : (
          <div className="divide-y divide-gray-100">
            {filtered.map(row => <BeyannameRow key={row.id} row={row} onOpen={() => setDetail(row)} onEdit={() => openEdit(row)} onDelete={() => setDeleteId(row.id)} />)}
          </div>
        )}
      </Card>

      {modal && <Modal title={editing ? 'Kaydı Düzenle' : 'Yeni Beyanname / SGK Kaydı'} onClose={() => setModal(false)} size="lg" footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Bildirim Türü" required><select value={form.tip} onChange={setField('tip')} className={inputCls}>{TIPLER.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
          <Field label="Dönem" required><input value={form.donem} onChange={setField('donem')} className={inputCls} placeholder={form.tip === 'sgk' ? '2026-08' : '2026-08'} /></Field>
          <Field label="Son Beyan / Ödeme Tarihi" required><input type="date" value={form.son_tarih} onChange={setField('son_tarih')} className={inputCls} /></Field>
          <Field label="Tahakkuk Tutarı (₺)"><input type="number" step="0.01" value={form.tahakkuk_tutari} onChange={setField('tahakkuk_tutari')} className={inputCls} /></Field>
          <Field label="Durum"><select value={form.durum} onChange={setField('durum')} className={inputCls}>{Object.entries(DURUMLAR).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></Field>
          <Field label="Beyanname / Bildirim Tarihi"><input type="date" value={form.verilis_tarihi} onChange={setField('verilis_tarihi')} className={inputCls} /></Field>
          <Field label="Beyanname No / Referans"><input value={form.beyanname_no} onChange={setField('beyanname_no')} className={inputCls} placeholder="Referans numarası" /></Field>
          <Field label="Notlar" className="md:col-span-2"><textarea rows={3} value={form.notlar} onChange={setField('notlar')} className={inputCls} placeholder="Açıklama, muhasebe notu..." /></Field>
        </div>
      </Modal>}
      {detail && <DetailModal row={detail} firmaId={firma.id} onClose={() => setDetail(null)} onRefresh={load} onDelete={() => setDeleteId(detail.id)} />}
      {deleteId && <ConfirmDialog message="Bu kaydı ve bağlı ödeme/dekont kayıtlarını silmek istediğinize emin misiniz?" onConfirm={remove} onCancel={() => setDeleteId(null)} />}
    </div>
  )
}

function BeyannameRow({ row, onOpen, onEdit, onDelete }: { row: Kayit; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const status = DURUMLAR[row.durum] || DURUMLAR.bekliyor
  const kalan = Math.max(Number(row.tahakkuk_tutari || 0) - Number(row.odenen_tutar || 0), 0)
  const overdue = isOverdue(row)
  return <div className={`flex items-center gap-3 px-4 py-4 hover:bg-gray-50 ${overdue ? 'bg-red-50/30' : ''}`}>
    <button onClick={onOpen} className="text-gray-400 hover:text-teal-600"><ChevronRight className="w-5 h-5" /></button>
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-gray-900">{tipLabel(row.tip)}</span><Badge label={status.label} variant={overdue ? 'red' : status.variant} />{overdue && <span className="text-xs text-red-600 font-medium">Gecikti</span>}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500"><span>{row.donem}</span><span>Son tarih: {fmtDate(row.son_tarih)}</span>{row.beyanname_no && <span>Ref: {row.beyanname_no}</span>}</div>
    </div>
    <div className="hidden sm:block text-right"><p className="text-xs text-gray-500">Kalan</p><p className={`font-bold ${kalan ? 'text-orange-600' : 'text-green-600'}`}>{fmt(kalan)}</p></div>
    <div className="flex gap-1"><button title="Düzenle" onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4" /></button><button title="Sil" onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>
  </div>
}

function DetailModal({ row, firmaId, onClose, onRefresh, onDelete }: { row: Kayit; firmaId: string; onClose: () => void; onRefresh: () => void; onDelete: () => void }) {
  const [payments, setPayments] = useState<Odeme[]>([])
  const [documents, setDocuments] = useState<Belge[]>([])
  const [tab, setTab] = useState<'ozet' | 'odeme' | 'belge'>('ozet')
  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadDetails() {
    const [{ data: odemeler }, { data: belgeler }] = await Promise.all([
      supabase.from('beyanname_odemeleri').select('*').eq('beyanname_id', row.id).order('odeme_tarihi', { ascending: false }),
      supabase.from('beyanname_belgeleri').select('*').eq('beyanname_id', row.id).order('created_at', { ascending: false }),
    ])
    setPayments((odemeler || []) as Odeme[]); setDocuments((belgeler || []) as Belge[])
  }
  useEffect(() => { loadDetails() }, [row.id])

  async function savePayment() {
    const amount = Number(paymentForm.tutar)
    if (!amount || !paymentForm.odeme_tarihi) return alert('Ödeme tarihi ve tutarı zorunludur.')
    const { error } = await supabase.from('beyanname_odemeleri').insert({ beyanname_id: row.id, firma_id: firmaId, ...paymentForm, tutar: amount })
    if (error) return alert('Ödeme kaydedilemedi: ' + error.message)
    const newPaid = Number(row.odenen_tutar || 0) + amount
    await supabase.from('beyanname_takibi').update({ odenen_tutar: newPaid, durum: newPaid >= Number(row.tahakkuk_tutari || 0) ? 'odendi' : 'kismi_odendi' }).eq('id', row.id)
    setPaymentModal(false); setPaymentForm(emptyPayment); await loadDetails(); onRefresh()
  }

  async function uploadDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${firmaId}/${row.id}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('beyanname-belgeler').upload(path, file)
    if (error) { alert('Dosya yüklenemedi: ' + error.message); setUploading(false); return }
    const { error: insertError } = await supabase.from('beyanname_belgeleri').insert({ beyanname_id: row.id, firma_id: firmaId, belge_turu: 'belge', dosya_adi: file.name, storage_path: path })
    if (insertError) alert('Belge kaydı oluşturulamadı: ' + insertError.message)
    setUploading(false); if (fileRef.current) fileRef.current.value = ''; loadDetails()
  }

  async function downloadDocument(document: Belge) {
    const { data } = await supabase.storage.from('beyanname-belgeler').createSignedUrl(document.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }
  async function deleteDocument(document: Belge) {
    if (!confirm(`"${document.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('beyanname-belgeler').remove([document.storage_path])
    await supabase.from('beyanname_belgeleri').delete().eq('id', document.id)
    loadDetails()
  }

  const balance = Math.max(Number(row.tahakkuk_tutari || 0) - Number(row.odenen_tutar || 0), 0)
  return <Modal title={`${tipLabel(row.tip)} - ${row.donem}`} onClose={onClose} size="xl" footer={<><Btn variant="danger" onClick={onDelete}>Kaydı Sil</Btn><Btn variant="secondary" onClick={onClose}>Kapat</Btn></>}>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Tahakkuk</p><p className="font-bold text-gray-900">{fmt(row.tahakkuk_tutari)}</p></div>
      <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-gray-500">Ödenen</p><p className="font-bold text-green-700">{fmt(row.odenen_tutar)}</p></div>
      <div className={`${balance ? 'bg-orange-50' : 'bg-green-50'} rounded-lg p-3`}><p className="text-xs text-gray-500">Kalan</p><p className={`font-bold ${balance ? 'text-orange-700' : 'text-green-700'}`}>{fmt(balance)}</p></div>
      <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-gray-500">Son tarih</p><p className="font-bold text-blue-700">{fmtDate(row.son_tarih)}</p></div>
    </div>
    <div className="flex border-b border-gray-200 mb-4"><button onClick={() => setTab('ozet')} className={`px-4 py-2 text-sm border-b-2 ${tab === 'ozet' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500'}`}>Özet</button><button onClick={() => setTab('odeme')} className={`px-4 py-2 text-sm border-b-2 ${tab === 'odeme' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500'}`}>Ödemeler ({payments.length})</button><button onClick={() => setTab('belge')} className={`px-4 py-2 text-sm border-b-2 ${tab === 'belge' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500'}`}>Belgeler ({documents.length})</button></div>
    {tab === 'ozet' && <div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-gray-500">Durum</span><Badge label={DURUMLAR[row.durum]?.label || row.durum} variant={DURUMLAR[row.durum]?.variant || 'gray'} /></div><div className="flex justify-between"><span className="text-gray-500">Beyan tarihi</span><span>{fmtDate(row.verilis_tarihi)}</span></div><div className="flex justify-between"><span className="text-gray-500">Referans</span><span>{row.beyanname_no || '-'}</span></div>{row.notlar && <div className="bg-gray-50 rounded-lg p-3 text-gray-600">{row.notlar}</div>}</div>}
    {tab === 'odeme' && <div className="space-y-4"><Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setPaymentModal(true)}>Ödeme Ekle</Btn>{payments.length === 0 ? <EmptyState icon={<Receipt className="w-8 h-8" />} message="Henüz ödeme kaydı yok" /> : <div className="divide-y divide-gray-100">{payments.map(payment => <div key={payment.id} className="py-3 flex justify-between gap-3"><div><p className="font-medium text-gray-800">{fmtDate(payment.odeme_tarihi)} · {payment.odeme_kanali === 'banka' ? 'Banka' : 'Nakit'}</p><p className="text-xs text-gray-500">Dekont: {payment.dekont_no || '-'}</p></div><strong className="text-green-700">{fmt(payment.tutar)}</strong></div>)}</div>}</div>}
    {tab === 'belge' && <div className="space-y-4"><input ref={fileRef} type="file" className="hidden" onChange={uploadDocument} /><Btn size="sm" icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Yükleniyor...' : 'Belge Yükle'}</Btn><p className="text-xs text-gray-500">Beyanname, tahakkuk fişi veya ödeme dekontu yükleyebilirsiniz.</p>{documents.length === 0 ? <EmptyState icon={<FileText className="w-8 h-8" />} message="Henüz belge yüklenmedi" /> : <div className="divide-y divide-gray-100">{documents.map(document => <div key={document.id} className="py-3 flex items-center gap-3"><FileText className="w-5 h-5 text-teal-600" /><span className="flex-1 text-sm truncate">{document.dosya_adi}</span><button title="Aç" onClick={() => downloadDocument(document)} className="p-1 text-gray-400 hover:text-blue-600"><Download className="w-4 h-4" /></button><button title="Sil" onClick={() => deleteDocument(document)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>)}</div>}</div>}
    {paymentModal && <Modal title="Ödeme Ekle" onClose={() => setPaymentModal(false)} size="md" footer={<><Btn variant="secondary" onClick={() => setPaymentModal(false)}>İptal</Btn><Btn onClick={savePayment}>Kaydet</Btn></>}><div className="space-y-4"><Field label="Ödeme Tarihi" required><input type="date" value={paymentForm.odeme_tarihi} onChange={e => setPaymentForm(p => ({ ...p, odeme_tarihi: e.target.value }))} className={inputCls} /></Field><Field label="Tutar (₺)" required><input type="number" step="0.01" value={paymentForm.tutar} onChange={e => setPaymentForm(p => ({ ...p, tutar: e.target.value }))} className={inputCls} /></Field><Field label="Ödeme Kanalı"><select value={paymentForm.odeme_kanali} onChange={e => setPaymentForm(p => ({ ...p, odeme_kanali: e.target.value }))} className={inputCls}><option value="banka">Banka</option><option value="nakit">Nakit</option></select></Field><Field label="Dekont No"><input value={paymentForm.dekont_no} onChange={e => setPaymentForm(p => ({ ...p, dekont_no: e.target.value }))} className={inputCls} /></Field></div></Modal>}
  </Modal>
}
