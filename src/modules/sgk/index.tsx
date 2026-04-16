'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { Shield, Plus, Edit, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, StatCard, Card, Modal, Btn, Field, inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { SgkBeyan } from '@/types'

const DURUMLAR: Record<string, { l: string; v: 'yellow' | 'green' | 'red' }> = {
  bekliyor: { l: 'Bekliyor', v: 'yellow' },
  odendi:   { l: 'Ödendi',   v: 'green'  },
  gecikti:  { l: 'Gecikti',  v: 'red'    },
}

const empty = { donem: '', calisma_gun_sayisi: '', sigortali_sayisi: '', prim_tutari: '0', isverenin_payi: '0', isci_payi: '0', son_odeme_tarihi: '', odeme_tarihi: '', durum: 'bekliyor', notlar: '' }

export default function SgkModule({ firma }: AppCtx) {
  const [data, setData]       = useState<SgkBeyan[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState<SgkBeyan | null>(null)
  const [delId, setDelId]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState(empty)

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase.from('sgk_beyan').select('*').eq('firma_id', firma.id).order('donem', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const summary = useMemo(() => ({
    toplam: data.length,
    bekliyor: data.filter(r => r.durum === 'bekliyor').length,
    toplamPrim: data.reduce((s, r) => s + Number(r.toplam_prim || 0), 0),
  }), [data])

  function openNew() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(r: SgkBeyan) {
    setForm({ donem: r.donem, calisma_gun_sayisi: String(r.calisma_gun_sayisi || ''), sigortali_sayisi: String(r.sigortali_sayisi || ''), prim_tutari: String(r.prim_tutari), isverenin_payi: String(r.isverenin_payi), isci_payi: String(r.isci_payi), son_odeme_tarihi: r.son_odeme_tarihi || '', odeme_tarihi: r.odeme_tarihi || '', durum: r.durum, notlar: r.notlar || '' })
    setEditing(r); setModal(true)
  }

  async function save() {
    if (!form.donem) return alert('Dönem zorunludur')
    setSaving(true)
    const prim = Number(form.prim_tutari)
    const isveren = Number(form.isverenin_payi)
    const isci = Number(form.isci_payi)
    const payload = { donem: form.donem, calisma_gun_sayisi: form.calisma_gun_sayisi ? Number(form.calisma_gun_sayisi) : null, sigortali_sayisi: form.sigortali_sayisi ? Number(form.sigortali_sayisi) : null, prim_tutari: prim, isverenin_payi: isveren, isci_payi: isci, toplam_prim: prim + isveren + isci, son_odeme_tarihi: form.son_odeme_tarihi || null, odeme_tarihi: form.odeme_tarihi || null, durum: form.durum as SgkBeyan['durum'], notlar: form.notlar || null }
    if (editing) await supabase.from('sgk_beyan').update(payload).eq('id', editing.id)
    else await supabase.from('sgk_beyan').insert({ ...payload, firma_id: firma.id })
    setSaving(false); setModal(false); load()
  }

  const sf = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-6">
      <PageHeader icon={<Shield className="w-5 h-5 text-green-600" />} title="SGK"
        subtitle="SGK prim beyanları ve ödemeleri" iconBg="bg-green-50"
        action={<Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Beyan</Btn>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Toplam Beyan" value={summary.toplam} color="text-gray-700" />
        <StatCard label="Bekleyen" value={summary.bekliyor} color="text-yellow-600" />
        <StatCard label="Toplam Prim" value={fmt(summary.toplamPrim)} color="text-green-600" />
      </div>

      <Card>
        {loading ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Dönem', 'Sigortalı', 'Prim Tutarı', 'İşveren Payı', 'İşçi Payı', 'Toplam', 'Son Ödeme', 'Durum', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map(r => {
                  const d = DURUMLAR[r.durum]
                  const overdue = r.durum === 'bekliyor' && r.son_odeme_tarihi && new Date(r.son_odeme_tarihi) < new Date()
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{r.donem}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.sigortali_sayisi || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{fmt(r.prim_tutari)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{fmt(r.isverenin_payi)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{fmt(r.isci_payi)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmt(r.toplam_prim)}</td>
                      <td className={`px-4 py-3 text-sm whitespace-nowrap ${overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {fmtDate(r.son_odeme_tarihi)}{overdue && ' ⚠'}
                      </td>
                      <td className="px-4 py-3"><Badge label={d?.l || r.durum} variant={d?.v || 'gray'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDelId(r.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {data.length === 0 && <EmptyState icon={<Shield className="w-10 h-10" />} message="SGK beyanı yok" />}
          </div>
        )}
      </Card>

      {modal && (
        <Modal title={editing ? 'Beyan Düzenle' : 'Yeni SGK Beyanı'} onClose={() => setModal(false)} size="lg"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Dönem" required className="md:col-span-2">
              <input type="text" value={form.donem} onChange={sf('donem')} className={inputCls} placeholder="2025-01" />
            </Field>
            <Field label="Sigortalı Sayısı">
              <input type="number" value={form.sigortali_sayisi} onChange={sf('sigortali_sayisi')} className={inputCls} />
            </Field>
            <Field label="Çalışma Gün Sayısı">
              <input type="number" value={form.calisma_gun_sayisi} onChange={sf('calisma_gun_sayisi')} className={inputCls} />
            </Field>
            <Field label="Prim Tutarı (₺)">
              <input type="number" step="0.01" value={form.prim_tutari} onChange={sf('prim_tutari')} className={inputCls} />
            </Field>
            <Field label="İşveren Payı (₺)">
              <input type="number" step="0.01" value={form.isverenin_payi} onChange={sf('isverenin_payi')} className={inputCls} />
            </Field>
            <Field label="İşçi Payı (₺)">
              <input type="number" step="0.01" value={form.isci_payi} onChange={sf('isci_payi')} className={inputCls} />
            </Field>
            <Field label="Durum">
              <select value={form.durum} onChange={sf('durum')} className={inputCls}>
                {Object.entries(DURUMLAR).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
            </Field>
            <Field label="Son Ödeme Tarihi">
              <input type="date" value={form.son_odeme_tarihi} onChange={sf('son_odeme_tarihi')} className={inputCls} />
            </Field>
            <Field label="Ödeme Tarihi">
              <input type="date" value={form.odeme_tarihi} onChange={sf('odeme_tarihi')} className={inputCls} />
            </Field>
            <Field label="Notlar" className="md:col-span-2">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
            </Field>
            <div className="md:col-span-2 bg-green-50 rounded-lg p-3 flex justify-between">
              <span className="text-sm text-gray-600">Toplam Prim:</span>
              <span className="font-bold text-green-700">{fmt(Number(form.prim_tutari || 0) + Number(form.isverenin_payi || 0) + Number(form.isci_payi || 0))}</span>
            </div>
          </div>
        </Modal>
      )}

      {delId && <ConfirmDialog message="Bu SGK beyanını silmek istediğinize emin misiniz?" onConfirm={async () => { await supabase.from('sgk_beyan').delete().eq('id', delId); setDelId(null); load() }} onCancel={() => setDelId(null)} />}
    </div>
  )
}
