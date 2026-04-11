'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, Search, RefreshCw, AlertCircle,
  CheckCircle2, TrendingUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, Modal, Field, ConfirmModal } from '@/components/ui'
import type { AppCtx } from '@/app/page'

const EMPTY_FORM = {
  donem: new Date().toISOString().split('T')[0].substring(0, 7),
  musteri_ad: '',
  musteri_vkn: '',
  iskonto: 0,
  kdv_0_matrah: 0,
  kdv_1_matrah: 0,
  kdv_10_matrah: 0,
  kdv_20_matrah: 0,
  toplam_matrah: 0,
  toplam_kdv: 0,
  tevkifat_turu: 'yok',
  tevkifat_tutari: 0,
  genel_toplam: 0,
  uyumsuzluk_var: false,
  uyumsuzluk_nedeni: '',
  notlar: ''
}

export default function SatislarModule({ firma, firmalar, firmaIds }: AppCtx) {
  const [kayitlar, setKayitlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterDonem, setFilterDonem] = useState('')
  
  const [modal, setModal] = useState<any | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [firmaIds.join(',')])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase
      .from('donemsel_satislar')
      .select('*')
      .in('firma_id', firmaIds)
      .order('donem', { ascending: false })
      .order('musteri_ad', { ascending: true })
    setKayitlar(data || [])
    setLoading(false)
  }

  function handleHesapla(guncelForm: any) {
    const k0 = Number(guncelForm.kdv_0_matrah || 0)
    const k1 = Number(guncelForm.kdv_1_matrah || 0)
    const k10 = Number(guncelForm.kdv_10_matrah || 0)
    const k20 = Number(guncelForm.kdv_20_matrah || 0)
    const iskonto = Number(guncelForm.iskonto || 0)
    const genelToplam = Number(guncelForm.genel_toplam || 0)

    let toplamMatrah = k0 + k1 + k10 + k20
    
    // Genel Toplam girilmiş ama matrah girilmemişse tahmini %20'den tersine hesaplama yap
    let k20_varsayilan = k20
    if (toplamMatrah === 0 && genelToplam > 0) {
      k20_varsayilan = genelToplam / 1.20
      toplamMatrah = k20_varsayilan
    }

    const kdvTutar1 = k1 * 0.01
    const kdvTutar10 = k10 * 0.10
    const kdvTutar20 = k20_varsayilan * 0.20
    const toplamKdv = kdvTutar1 + kdvTutar10 + kdvTutar20

    let tevkifatTuru = guncelForm.tevkifat_turu || 'yok'
    let tevkifatTutari = 0

    if (tevkifatTuru === '2/10') tevkifatTutari = toplamKdv * 0.2
    if (tevkifatTuru === '5/10') tevkifatTutari = toplamKdv * 0.5

    let beklenen = (toplamMatrah - iskonto) + toplamKdv - tevkifatTutari
    let uyumsuz = false
    let neden = ''

    if (genelToplam > 0 && Math.abs(genelToplam - beklenen) > 0.5) {
      uyumsuz = true
      neden = `Hesaplanan (${beklenen.toLocaleString('tr-TR', {minimumFractionDigits: 2})} ₺) ile girilen toplam uyuşmuyor.`

      // Hata varsa, sistem 2/10 veya 5/10 tevkifat olup olmadığını anlamaya çalışır
      const fark = ((toplamMatrah - iskonto) + toplamKdv) - genelToplam
      if (Math.abs(fark - (toplamKdv * 0.2)) < 0.5) {
        neden = 'Sistem otomatik 2/10 Tevkifat tespit etti ve uyguladı.'
        tevkifatTuru = '2/10'
        tevkifatTutari = toplamKdv * 0.2
        beklenen = (toplamMatrah - iskonto) + toplamKdv - tevkifatTutari
        uyumsuz = false
      } else if (Math.abs(fark - (toplamKdv * 0.5)) < 0.5) {
        neden = 'Sistem otomatik 5/10 Tevkifat tespit etti ve uyguladı.'
        tevkifatTuru = '5/10'
        tevkifatTutari = toplamKdv * 0.5
        beklenen = (toplamMatrah - iskonto) + toplamKdv - tevkifatTutari
        uyumsuz = false
      }
    }

    return {
      ...guncelForm,
      kdv_20_matrah: k20_varsayilan,
      toplam_matrah: toplamMatrah,
      toplam_kdv: toplamKdv,
      tevkifat_turu: tevkifatTuru,
      tevkifat_tutari: tevkifatTutari,
      beklenen_toplam: beklenen,
      uyumsuzluk_var: uyumsuz,
      uyumsuzluk_nedeni: neden
    }
  }

  function set(key: string, value: any) {
    setModal((prev: any) => {
      const next = { ...prev, [key]: value }
      return handleHesapla(next)
    })
  }

  async function save() {
    if (!modal?.musteri_ad || !modal?.donem) {
      alert('Dönem ve Müşteri Adı zorunludur.')
      return
    }
    setSaving(true)
    
    const { beklenen_toplam, ...payload } = modal
    payload.firma_id = firma.id

    if (payload.id) {
      const { error } = await supabase.from('donemsel_satislar').update(payload).eq('id', payload.id)
      if (error) alert(error.message)
    } else {
      const { error } = await supabase.from('donemsel_satislar').insert(payload)
      if (error) alert(error.message)
    }

    setSaving(false)
    setModal(null)
    await loadAll()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('donemsel_satislar').delete().eq('id', deleteId)
    setDeleteId(null)
    await loadAll()
  }

  const filtered = useMemo(() => kayitlar.filter(k => {
    if (filterDonem && !k.donem.startsWith(filterDonem)) return false
    if (search) {
      const q = search.toLowerCase()
      return (k.musteri_ad.toLowerCase().includes(q) || (k.musteri_vkn || '').includes(q))
    }
    return true
  }), [kayitlar, filterDonem, search])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50">
              <TrendingUp size={18} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-slate-800">Dönemsel Satışlar</h1>
              <p className="text-[12px] text-slate-500">Müşteri bazlı aylık toplam satışlar, KDV ve Tevkifat kontrolleri</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className={cls.btnSecondary}>
              <RefreshCw size={14} /> Yenile
            </button>
            <button onClick={() => setModal({ ...EMPTY_FORM })} className={cls.btnPrimary}>
              <Plus size={14} /> Yeni Kayıt
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 flex gap-3 items-center shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Müşteri adı veya VKN ara..."
            className="w-full bg-slate-50 border border-blue-100 rounded-xl pl-9 pr-3 py-2 text-[13px] text-slate-800 outline-none focus:border-blue-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <input
          type="month"
          value={filterDonem}
          onChange={e => setFilterDonem(e.target.value)}
          className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
          title="Döneme göre filtrele"
        />
      </div>

      <div className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">Kayıt bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-blue-100">
                <tr>
                  <th className="px-4 py-3">Dönem</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3 text-right">Matrah</th>
                  <th className="px-4 py-3 text-right">KDV</th>
                  <th className="px-4 py-3 text-right">Tevkifat</th>
                  <th className="px-4 py-3 text-right">Genel Toplam</th>
                  <th className="px-4 py-3 text-center">Durum</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(k => (
                  <tr key={k.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-700">{k.donem}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{k.musteri_ad}</div>
                      {k.musteri_vkn && <div className="text-[11px] text-slate-500">VKN: {k.musteri_vkn}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600">
                      {Number(k.toplam_matrah || 0).toLocaleString('tr-TR')} ₺
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {Number(k.toplam_kdv || 0).toLocaleString('tr-TR')} ₺
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {k.tevkifat_turu !== 'yok' ? (
                        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] mr-1">
                          {k.tevkifat_turu}
                        </span>
                      ) : ''}
                      {Number(k.tevkifat_tutari || 0).toLocaleString('tr-TR')} ₺
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {Number(k.genel_toplam || 0).toLocaleString('tr-TR')} ₺
                    </td>
                    <td className="px-4 py-3 text-center">
                      {k.uyumsuzluk_var ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-[11px] font-bold" title={k.uyumsuzluk_nedeni}>
                          <AlertCircle size={12} /> Hatalı/Uyumsuz
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[11px] font-bold">
                          <CheckCircle2 size={12} /> Uyumlu
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal(handleHesapla(k))} className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => setDeleteId(k.id)} className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title={modal.id ? 'Kayıt Düzenle' : 'Yeni Müşteri Satışı'}
          onClose={() => setModal(null)}
          size="lg"
          footer={
            <>
              <button onClick={() => setModal(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={save} disabled={saving} className={cls.btnPrimary}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Dönem" required>
                <input type="month" className={cls.input} value={modal.donem || ''} onChange={e => set('donem', e.target.value)} />
              </Field>
              <Field label="Müşteri Adı" required>
                <input type="text" className={cls.input} value={modal.musteri_ad || ''} onChange={e => set('musteri_ad', e.target.value)} />
              </Field>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Field label="Müşteri VKN/TCKN">
                <input type="text" className={cls.input} value={modal.musteri_vkn || ''} onChange={e => set('musteri_vkn', e.target.value)} />
              </Field>
              <Field label="Girilen / Tahsil Edilen Genel Toplam (₺)">
                <input type="number" step="0.01" className={`${cls.input} bg-indigo-50 font-bold border-indigo-200`} value={modal.genel_toplam || ''} onChange={e => set('genel_toplam', Number(e.target.value))} placeholder="Fatura alt toplamı" />
              </Field>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Matrah ve KDV Dağılımı</h4>
              
              <div className="grid grid-cols-4 gap-3">
                <Field label="%0 Matrah">
                  <input type="number" step="0.01" className={cls.input} value={modal.kdv_0_matrah || ''} onChange={e => set('kdv_0_matrah', Number(e.target.value))} />
                </Field>
                <Field label="%1 Matrah">
                  <input type="number" step="0.01" className={cls.input} value={modal.kdv_1_matrah || ''} onChange={e => set('kdv_1_matrah', Number(e.target.value))} />
                </Field>
                <Field label="%10 Matrah">
                  <input type="number" step="0.01" className={cls.input} value={modal.kdv_10_matrah || ''} onChange={e => set('kdv_10_matrah', Number(e.target.value))} />
                </Field>
                <Field label="%20 Matrah">
                  <input type="number" step="0.01" className={cls.input} value={modal.kdv_20_matrah || ''} onChange={e => set('kdv_20_matrah', Number(e.target.value))} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="İskonto Tutarı">
                  <input type="number" step="0.01" className={cls.input} value={modal.iskonto || ''} onChange={e => set('iskonto', Number(e.target.value))} />
                </Field>
                <Field label="Hesaplanan Top. KDV">
                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] text-slate-500 tabular-nums">
                    {Number(modal.toplam_kdv || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} ₺
                  </div>
                </Field>
                <Field label="Hesaplanan Top. Matrah">
                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 tabular-nums">
                    {Number(modal.toplam_matrah || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} ₺
                  </div>
                </Field>
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
              <h4 className="text-xs font-bold text-purple-600 uppercase tracking-widest">Tevkifat</h4>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tevkifat Türü">
                  <select className={cls.input} value={modal.tevkifat_turu} onChange={e => set('tevkifat_turu', e.target.value)}>
                    <option value="yok">Yok</option>
                    <option value="2/10">2/10 Tevkifat</option>
                    <option value="5/10">5/10 Tevkifat</option>
                  </select>
                </Field>
                <Field label="Hesaplanan Tevkifat">
                  <div className="px-3 py-2 bg-white border border-purple-200 rounded-xl text-[13px] text-purple-700 tabular-nums font-bold">
                    - {Number(modal.tevkifat_tutari || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2})} ₺
                  </div>
                </Field>
              </div>
            </div>

            {/* Sonuç Özeti */}
            <div className={`p-4 rounded-xl border ${modal.uyumsuzluk_var ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${modal.uyumsuzluk_var ? 'text-red-700' : 'text-emerald-700'}`}>
                  {modal.uyumsuzluk_var ? '⚠️ Tutarsızlık Var' : '✓ Tutarlar Uyumlu'}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Beklenen: {Number(modal.beklenen_toplam || 0).toLocaleString('tr-TR')} ₺
                </span>
              </div>
              {modal.uyumsuzluk_nedeni && (
                <p className={`text-[11px] mt-1 ${modal.uyumsuzluk_var ? 'text-red-600' : 'text-emerald-600 font-medium'}`}>
                  {modal.uyumsuzluk_nedeni}
                </p>
              )}
            </div>

            <Field label="Notlar">
              <textarea className={`${cls.input} resize-none`} rows={2} value={modal.notlar || ''} onChange={e => set('notlar', e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmModal
          title="Kaydı Sil"
          message="Bu satış kaydı kalıcı olarak silinecektir. Emin misiniz?"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}