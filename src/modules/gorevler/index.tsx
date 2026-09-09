'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Circle, Edit3, ListTodo, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Btn, Card, ConfirmDialog, EmptyState, Field, Modal, PageHeader, StatCard, fmtDate, inputCls } from '@/components/ui'
import type { AppCtx } from '@/app/page'

type Durum = 'bekliyor' | 'devam' | 'ertelendi' | 'tamamlandi' | 'iptal'
type Oncelik = 'dusuk' | 'normal' | 'yuksek' | 'kritik'
type Gorev = { id: string; baslik: string; aciklama: string | null; durum: Durum; oncelik: Oncelik; kategori: string; atanan_kisi: string | null; son_tarih: string | null; hatirlatma_tarihi: string | null; yineleme_tipi: string | null; yineleme_bitis_tarihi: string | null; created_at: string }

const DURUMLAR: { id: Durum; label: string; color: 'gray' | 'blue' | 'yellow' | 'green' | 'red' }[] = [
  { id: 'bekliyor', label: 'Bekliyor', color: 'gray' }, { id: 'devam', label: 'Devam Ediyor', color: 'blue' }, { id: 'ertelendi', label: 'Ertelendi', color: 'yellow' }, { id: 'tamamlandi', label: 'Tamamlandı', color: 'green' }, { id: 'iptal', label: 'İptal', color: 'red' },
]
const ONCELIKLER: { id: Oncelik; label: string; color: 'gray' | 'blue' | 'orange' | 'red' }[] = [
  { id: 'dusuk', label: 'Düşük', color: 'gray' }, { id: 'normal', label: 'Normal', color: 'blue' }, { id: 'yuksek', label: 'Yüksek', color: 'orange' }, { id: 'kritik', label: 'Kritik', color: 'red' },
]
const KATEGORILER = ['genel', 'finans', 'ik', 'hukuk', 'vergi', 'proje', 'diger']
const YINELEMELER = [{ id: 'yok', label: 'Yineleme yok' }, { id: 'gunluk', label: 'Her gün' }, { id: 'haftalik', label: 'Her hafta' }, { id: 'aylik', label: 'Her ay' }, { id: 'yillik', label: 'Her yıl' }]
const emptyForm = { baslik: '', aciklama: '', durum: 'bekliyor' as Durum, oncelik: 'normal' as Oncelik, kategori: 'genel', atanan_kisi: '', son_tarih: '', hatirlatma_tarihi: '', yineleme_tipi: 'yok', yineleme_bitis_tarihi: '' }
function statusInfo(status: Durum) { return DURUMLAR.find(item => item.id === status) || DURUMLAR[0] }
function priorityInfo(priority: Oncelik) { return ONCELIKLER.find(item => item.id === priority) || ONCELIKLER[1] }
function isLate(task: Gorev) { return Boolean(task.son_tarih && !['tamamlandi', 'iptal'].includes(task.durum) && new Date(task.son_tarih) < new Date(new Date().toDateString())) }
function recurrenceLabel(type: string | null) { return YINELEMELER.find(item => item.id === type)?.label || '' }
function nextRecurrenceDate(date: string, type: string) {
  const next = new Date(`${date}T00:00:00`)
  if (type === 'gunluk') next.setDate(next.getDate() + 1)
  if (type === 'haftalik') next.setDate(next.getDate() + 7)
  if (type === 'aylik') next.setMonth(next.getMonth() + 1)
  if (type === 'yillik') next.setFullYear(next.getFullYear() + 1)
  return next.toISOString().slice(0, 10)
}
function monthEndReminder(date: string) {
  const value = new Date(`${date}T09:00:00`)
  value.setMonth(value.getMonth() + 1, 0)
  return value.toISOString()
}

export default function GorevlerModule({ firma }: AppCtx) {
  const [tasks, setTasks] = useState<Gorev[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'hepsi' | Durum>('hepsi')
  const [priorityFilter, setPriorityFilter] = useState<'hepsi' | Oncelik>('hepsi')
  const [categoryFilter, setCategoryFilter] = useState('hepsi')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<Gorev | null>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Gorev | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('gorevler').select('*').eq('firma_id', firma.id).order('created_at', { ascending: false })
    if (error) alert('Görevler yüklenemedi: ' + error.message)
    setTasks((data || []) as Gorev[]); setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])
  const filtered = useMemo(() => tasks.filter(task => {
    const query = search.toLocaleLowerCase('tr-TR')
    return (statusFilter === 'hepsi' || task.durum === statusFilter) && (priorityFilter === 'hepsi' || task.oncelik === priorityFilter) && (categoryFilter === 'hepsi' || task.kategori === categoryFilter) && (!query || task.baslik.toLocaleLowerCase('tr-TR').includes(query) || task.atanan_kisi?.toLocaleLowerCase('tr-TR').includes(query))
  }), [tasks, search, statusFilter, priorityFilter, categoryFilter])
  const summary = useMemo(() => ({ total: tasks.length, open: tasks.filter(task => ['bekliyor', 'devam', 'ertelendi'].includes(task.durum)).length, late: tasks.filter(isLate).length, done: tasks.filter(task => task.durum === 'tamamlandi').length }), [tasks])
  function openNew() { setEditing(null); setForm(emptyForm); setModal(true) }
  function openEdit(task: Gorev) { setEditing(task); setForm({ baslik: task.baslik, aciklama: task.aciklama || '', durum: task.durum, oncelik: task.oncelik, kategori: task.kategori || 'genel', atanan_kisi: task.atanan_kisi || '', son_tarih: task.son_tarih || '', hatirlatma_tarihi: task.hatirlatma_tarihi ? task.hatirlatma_tarihi.slice(0, 16) : '', yineleme_tipi: task.yineleme_tipi || 'yok', yineleme_bitis_tarihi: task.yineleme_bitis_tarihi || '' }); setModal(true) }
  const setField = (key: keyof typeof emptyForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(previous => ({ ...previous, [key]: event.target.value }))
  async function save() {
    if (!form.baslik.trim()) return alert('Görev başlığı zorunludur.')
    setSaving(true)
    if (form.yineleme_tipi !== 'yok' && !form.son_tarih) return alert('Yinelenen görevler için son tarih zorunludur.')
    const payload = { baslik: form.baslik.trim(), aciklama: form.aciklama || null, durum: form.durum, oncelik: form.oncelik, kategori: form.kategori, atanan_kisi: form.atanan_kisi || null, son_tarih: form.son_tarih || null, hatirlatma_tarihi: form.yineleme_tipi !== 'yok' && form.son_tarih ? monthEndReminder(form.son_tarih) : form.hatirlatma_tarihi ? new Date(form.hatirlatma_tarihi).toISOString() : null, yineleme_tipi: form.yineleme_tipi === 'yok' ? null : form.yineleme_tipi, yineleme_bitis_tarihi: form.yineleme_tipi === 'yok' ? null : form.yineleme_bitis_tarihi || null, tamamlanma_tarihi: form.durum === 'tamamlandi' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }
    const result = editing ? await supabase.from('gorevler').update(payload).eq('id', editing.id) : await supabase.from('gorevler').insert({ ...payload, firma_id: firma.id })
    setSaving(false); if (result.error) return alert(result.error.message.includes('yineleme_') ? 'Görev kaydedilemedi: Supabase veritabanı güncellemesi gerekli. database/gorev_schema.sql dosyasını Supabase SQL Editor’da çalıştırın.' : 'Görev kaydedilemedi: ' + result.error.message)
    setModal(false); setSelected(null); load()
  }
  async function updateStatus(task: Gorev, status: Durum) {
    const { error } = await supabase.from('gorevler').update({ durum: status, tamamlanma_tarihi: status === 'tamamlandi' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (error) return alert('Durum güncellenemedi: ' + error.message)
    if (status === 'tamamlandi' && task.durum !== 'tamamlandi' && task.yineleme_tipi && task.son_tarih) {
      const nextDate = nextRecurrenceDate(task.son_tarih, task.yineleme_tipi)
      if (!task.yineleme_bitis_tarihi || nextDate <= task.yineleme_bitis_tarihi) {
        await supabase.from('gorevler').insert({
          firma_id: firma.id, baslik: task.baslik, aciklama: task.aciklama, durum: 'bekliyor', oncelik: task.oncelik,
          kategori: task.kategori, atanan_kisi: task.atanan_kisi, son_tarih: nextDate, hatirlatma_tarihi: monthEndReminder(nextDate),
          yineleme_tipi: task.yineleme_tipi, yineleme_bitis_tarihi: task.yineleme_bitis_tarihi,
        })
      }
    }
    setSelected(previous => previous?.id === task.id ? { ...previous, durum: status } : previous); load()
  }
  async function remove() { if (!deleteId) return; await supabase.from('gorevler').delete().eq('id', deleteId); setDeleteId(null); setSelected(null); load() }

  return <div className="space-y-6">
    <PageHeader icon={<ListTodo className="w-5 h-5 text-indigo-600" />} title="Görev Takibi" subtitle="Ekibinizin işlerini öncelik, durum ve son tarihe göre yönetin" iconBg="bg-indigo-50" action={<Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Görev</Btn>} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"><StatCard label="Toplam Görev" value={summary.total} color="text-indigo-600" /><StatCard label="Açık Görev" value={summary.open} color="text-blue-600" /><StatCard label="Geciken" value={summary.late} color="text-red-600" /><StatCard label="Tamamlanan" value={summary.done} color="text-green-600" /></div>
    <Card>
      <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between"><div className="flex items-center gap-2 flex-wrap"><button onClick={() => setStatusFilter('hepsi')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === 'hepsi' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Tümü</button>{DURUMLAR.slice(0, 3).map(status => <button key={status.id} onClick={() => setStatusFilter(status.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === status.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>{status.label}</button>)}</div><div className="flex gap-2"><div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Görev veya sorumlu ara..." className={`${inputCls} pl-9`} /></div><button onClick={() => setShowFilters(value => !value)} className={`p-2 rounded-lg border ${showFilters ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`} title="Filtreleri aç"><SlidersHorizontal className="w-5 h-5" /></button></div></div>
      {showFilters && <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-3"><select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as typeof priorityFilter)} className={`${inputCls} w-auto`}><option value="hepsi">Tüm öncelikler</option>{ONCELIKLER.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className={`${inputCls} w-auto`}><option value="hepsi">Tüm kategoriler</option>{KATEGORILER.map(item => <option key={item} value={item}>{item[0].toLocaleUpperCase('tr-TR') + item.slice(1)}</option>)}</select><button onClick={() => { setPriorityFilter('hepsi'); setCategoryFilter('hepsi'); setSearch(''); setStatusFilter('hepsi') }} className="text-sm text-red-600 hover:underline">Filtreleri temizle</button></div>}
      {loading ? <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div> : filtered.length === 0 ? <EmptyState icon={<ListTodo className="w-10 h-10" />} message="Filtrelere uyan görev bulunamadı" /> : <div className="divide-y divide-gray-100">{filtered.map(task => <TaskRow key={task.id} task={task} onOpen={() => setSelected(task)} onEdit={() => openEdit(task)} onDelete={() => setDeleteId(task.id)} onStatus={status => updateStatus(task, status)} />)}</div>}
    </Card>
    {selected && <TaskDetail task={selected} onClose={() => setSelected(null)} onEdit={() => { openEdit(selected); setSelected(null) }} onDelete={() => setDeleteId(selected.id)} onStatus={status => updateStatus(selected, status)} />}
    {modal && <Modal title={editing ? 'Görevi Düzenle' : 'Yeni Görev'} onClose={() => setModal(false)} size="lg" footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Görevi Kaydet'}</Btn></>}><div className="space-y-4"><Field label="Görev başlığı" required><input autoFocus value={form.baslik} onChange={setField('baslik')} className={inputCls} placeholder="Örn: Ağustos puantajlarını kontrol et" /></Field><Field label="Açıklama"><textarea rows={4} value={form.aciklama} onChange={setField('aciklama')} className={inputCls} placeholder="Görevin kapsamı, teslim kriterleri..." /></Field><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Field label="Durum"><select value={form.durum} onChange={setField('durum')} className={inputCls}>{DURUMLAR.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><Field label="Öncelik"><select value={form.oncelik} onChange={setField('oncelik')} className={inputCls}>{ONCELIKLER.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><Field label="Kategori"><select value={form.kategori} onChange={setField('kategori')} className={inputCls}>{KATEGORILER.map(item => <option key={item} value={item}>{item[0].toLocaleUpperCase('tr-TR') + item.slice(1)}</option>)}</select></Field></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Field label="Sorumlu"><input value={form.atanan_kisi} onChange={setField('atanan_kisi')} className={inputCls} placeholder="Ad soyad veya ekip" /></Field><Field label="Son tarih"><input type="date" value={form.son_tarih} onChange={setField('son_tarih')} className={inputCls} /></Field><Field label="Hatırlatma"><input type="datetime-local" value={form.hatirlatma_tarihi} onChange={setField('hatirlatma_tarihi')} className={inputCls} /></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-200 pt-4"><Field label="Yineleme"><select value={form.yineleme_tipi} onChange={setField('yineleme_tipi')} className={inputCls}>{YINELEMELER.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>{form.yineleme_tipi !== 'yok' && <Field label="Yineleme bitiş tarihi"><input type="date" value={form.yineleme_bitis_tarihi} onChange={setField('yineleme_bitis_tarihi')} className={inputCls} /></Field>}</div></div></Modal>}
    {deleteId && <ConfirmDialog message="Bu görevi kalıcı olarak silmek istediğinize emin misiniz?" onConfirm={remove} onCancel={() => setDeleteId(null)} />}
  </div>
}

function TaskRow({ task, onOpen, onEdit, onDelete, onStatus }: { task: Gorev; onOpen: () => void; onEdit: () => void; onDelete: () => void; onStatus: (status: Durum) => void }) {
  const status = statusInfo(task.durum); const priority = priorityInfo(task.oncelik)
  return <div className={`flex items-center gap-3 px-4 py-4 hover:bg-gray-50 ${isLate(task) ? 'bg-red-50/30' : ''}`}><button onClick={() => onStatus(task.durum === 'tamamlandi' ? 'bekliyor' : 'tamamlandi')} title="Tamamlandı olarak işaretle" className={`flex-shrink-0 ${task.durum === 'tamamlandi' ? 'text-green-500' : 'text-gray-300 hover:text-indigo-500'}`}>{task.durum === 'tamamlandi' ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button><button onClick={onOpen} className="flex-1 min-w-0 text-left"><div className="flex items-center gap-2 flex-wrap"><span className={`font-semibold ${task.durum === 'tamamlandi' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.baslik}</span><Badge label={status.label} variant={status.color} /><Badge label={priority.label} variant={priority.color} />{task.yineleme_tipi && <Badge label={`↻ ${recurrenceLabel(task.yineleme_tipi)}`} variant="blue" />}</div><div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500"><span>{task.kategori}</span>{task.atanan_kisi && <span>Sorumlu: {task.atanan_kisi}</span>}{task.son_tarih && <span className={isLate(task) ? 'text-red-600 font-semibold' : ''}><CalendarDays className="inline w-3.5 h-3.5 mr-1" />{fmtDate(task.son_tarih)}</span>}</div></button><div className="hidden md:flex items-center gap-1"><button onClick={onEdit} title="Düzenle" className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"><Edit3 className="w-4 h-4" /></button><button onClick={onDelete} title="Sil" className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button></div></div>
}

function TaskDetail({ task, onClose, onEdit, onDelete, onStatus }: { task: Gorev; onClose: () => void; onEdit: () => void; onDelete: () => void; onStatus: (status: Durum) => void }) {
  const status = statusInfo(task.durum); const priority = priorityInfo(task.oncelik)
  return <Modal title="Görev detayı" onClose={onClose} size="lg" footer={<><Btn variant="danger" onClick={onDelete}>Sil</Btn><Btn variant="secondary" onClick={onEdit}>Düzenle</Btn><Btn onClick={onClose}>Kapat</Btn></>}><div className="space-y-5"><div><div className="flex flex-wrap gap-2 mb-2"><Badge label={status.label} variant={status.color} /><Badge label={priority.label} variant={priority.color} /></div><h2 className="text-xl font-bold text-gray-900">{task.baslik}</h2><p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap">{task.aciklama || 'Açıklama eklenmemiş.'}</p></div><div className="grid grid-cols-2 gap-3"><Info label="Sorumlu" value={task.atanan_kisi || 'Atanmadı'} /><Info label="Kategori" value={task.kategori} /><Info label="Son tarih" value={fmtDate(task.son_tarih)} /><Info label="Oluşturulma" value={fmtDate(task.created_at)} /></div><div className="border-t pt-4"><p className="text-sm font-semibold text-gray-700 mb-2">Durumu değiştir</p><div className="flex flex-wrap gap-2">{DURUMLAR.map(item => <button key={item.id} onClick={() => onStatus(item.id)} className={`px-3 py-2 rounded-lg text-sm ${task.durum === item.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{item.label}</button>)}</div></div></div></Modal>
}
function Info({ label, value }: { label: string; value: string }) { return <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-sm font-medium text-gray-800">{value}</p></div> }
