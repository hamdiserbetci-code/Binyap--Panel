'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, Search, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

// ── Tipler ─────────────────────────────────────────────────────────────────

interface CariHesap {
  id: string; firma_id: string; sirket: string; ad: string
  vkn_tckn: string | null; telefon: string | null; adres: string | null; notlar: string | null
}

interface CariHareket {
  id: string; cari_hesap_id: string; hareket_turu: string
  tutar: number; kdv_tutari?: number | null; stopaj_tutari?: number | null; tarih: string; vade_tarihi: string | null
  belge_no: string | null; aciklama: string | null
  cek_no: string | null; cek_banka: string | null; durum: string
}

interface Props { firma: FirmaRecord; role?: string | null }

// ── Sabitler ────────────────────────────────────────────────────────────────

export const HAREKET_TURLERI: { id: string; label: string; renk: string; isCek?: boolean }[] = [
  { id: 'satis_fatura',    label: 'Satış Faturası',    renk: 'emerald' },
  { id: 'alis_fatura',     label: 'Alış Faturası',     renk: 'rose' },
  { id: 'tahsilat_nakit',  label: 'Tahsilat (Nakit)',  renk: 'sky' },
  { id: 'tahsilat_cek',    label: 'Tahsilat (Çek)',    renk: 'sky',   isCek: true },
  { id: 'odeme_nakit',     label: 'Ödeme (Nakit)',     renk: 'amber' },
  { id: 'odeme_cek',       label: 'Ödeme (Çek)',       renk: 'amber', isCek: true },
  { id: 'diger_alacak',    label: 'Diğer Alacak',      renk: 'violet' },
  { id: 'diger_borc',      label: 'Diğer Borç',        renk: 'orange' },
]

const DURUM_OPTS = ['beklemede', 'tamamlandi', 'gecikti', 'karsilıksız']

// Bakiye hesaplama: pozitif = alacaklıyız, negatif = borçluyuz
export function calcBakiye(hareketler: CariHareket[]) {
  let alacak = 0, borc = 0, tahsilat = 0, odeme = 0
  for (const h of hareketler) {
    const t = Number(h.tutar || 0) + Number(h.kdv_tutari || 0) - Number(h.stopaj_tutari || 0)
    if (h.hareket_turu === 'satis_fatura' || h.hareket_turu === 'diger_alacak') alacak += t
    else if (h.hareket_turu === 'alis_fatura' || h.hareket_turu === 'diger_borc') borc += t
    else if (h.hareket_turu === 'tahsilat_nakit' || h.hareket_turu === 'tahsilat_cek') tahsilat += t
    else if (h.hareket_turu === 'odeme_nakit' || h.hareket_turu === 'odeme_cek') odeme += t
  }
  return { alacak, borc, tahsilat, odeme, net: alacak - borc - tahsilat + odeme }
}

// Hata mesajindan eksik sutun adini (Orn: 'tutar') otomatik ayiklayan fonksiyon
function parseMissingColumn(message?: string) {
  const match = (message || '').match(/'([^']+)' column of/i)
  return match?.[1] || null
}

// ── Ana Bileşen ─────────────────────────────────────────────────────────────

export default function CariHesapModule({ firma, role }: Props) {
  const [sirket, setSirket] = useState<'ETM' | 'BİNYAPI'>('ETM')
  const [hesaplar, setHesaplar] = useState<CariHesap[]>([])
  const [hareketler, setHareketler] = useState<CariHareket[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cari modal
  const [cariModal, setCariModal] = useState(false)
  const [editingCari, setEditingCari] = useState<CariHesap | null>(null)
  const [cariForm, setCariForm] = useState({ ad: '', vkn_tckn: '', telefon: '', adres: '', notlar: '' })

  // Hareket modal
  const [hareketModal, setHareketModal] = useState(false)
  const [editingHareket, setEditingHareket] = useState<CariHareket | null>(null)
  const [hForm, setHForm] = useState({
    hareket_turu: 'satis_fatura', tutar: '', kdv_tutari: '', stopaj_tutari: '', tarih: new Date().toISOString().split('T')[0],
    vade_tarihi: '', belge_no: '', aciklama: '', cek_no: '', cek_banka: '', durum: 'beklemede',
  })

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchHesaplar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('cari_hesaplar')
      .select('*').eq('firma_id', firma.id).eq('sirket', sirket).order('ad')
    if (error) { setError(error.message); setLoading(false); return }
    setHesaplar((data as CariHesap[]) || [])
    setLoading(false)
  }, [firma.id, sirket])

  const fetchHareketler = useCallback(async (cariId: string) => {
    const { data, error } = await supabase.from('cari_hareketler')
      .select('*').eq('cari_hesap_id', cariId).order('tarih', { ascending: false })
    if (error) { setError(error.message); return }
    setHareketler((data as CariHareket[]) || [])
  }, [])

  useEffect(() => { fetchHesaplar() }, [fetchHesaplar])
  useEffect(() => { if (selectedId) { fetchHareketler(selectedId) } else { setHareketler([]) } }, [selectedId, fetchHareketler])

  // ── Cari CRUD ─────────────────────────────────────────────────────────────

  function openCariModal(c?: CariHesap) {
    setEditingCari(c || null)
    setCariForm(c ? { ad: c.ad, vkn_tckn: c.vkn_tckn || '', telefon: c.telefon || '', adres: c.adres || '', notlar: c.notlar || '' } : { ad: '', vkn_tckn: '', telefon: '', adres: '', notlar: '' })
    setCariModal(true)
    setError('')
  }

  async function saveCari() {
    if (!cariForm.ad.trim()) { setError('Ünvan zorunludur.'); return }
    const payload: any = { firma_id: firma.id, sirket, ad: cariForm.ad.trim(), vkn_tckn: cariForm.vkn_tckn || null, telefon: cariForm.telefon || null, adres: cariForm.adres || null, notlar: cariForm.notlar || null }
    
    let workingPayload = { ...payload }
    let res;
    while (true) {
      res = editingCari ? await supabase.from('cari_hesaplar').update(workingPayload).eq('id', editingCari.id) : await supabase.from('cari_hesaplar').insert(workingPayload)
      if (!res.error) break
      const missingColumn = parseMissingColumn(res.error.message)
      if (!missingColumn || !(missingColumn in workingPayload) || Object.keys(workingPayload).length <= 2) break
      delete workingPayload[missingColumn]
    }

    if (res.error) { setError(res.error.message); return }
    if (Object.keys(workingPayload).length < Object.keys(payload).length) {
      alert('Veritabaninda eksik sutunlar tespit edildi. Kayit mevcut alanlarla eklendi. Lutfen SQL komutlarini calistirin.')
    }
    setCariModal(false); fetchHesaplar()
  }

  async function deleteCari(id: string) {
    if (!confirm('Bu cari hesabı ve tüm hareketleri silinecek. Emin misiniz?')) return
    await supabase.from('cari_hesaplar').delete().eq('id', id)
    if (selectedId === id) setSelectedId(null)
    fetchHesaplar()
  }

  // ── Hareket CRUD ──────────────────────────────────────────────────────────

  function openHareketModal(h?: CariHareket) {
    setEditingHareket(h || null)
    setHForm(h ? {
      hareket_turu: h.hareket_turu, tutar: String(h.tutar), kdv_tutari: h.kdv_tutari != null ? String(h.kdv_tutari) : '', stopaj_tutari: h.stopaj_tutari != null ? String(h.stopaj_tutari) : '',
      tarih: h.tarih, vade_tarihi: h.vade_tarihi || '',
      belge_no: h.belge_no || '', aciklama: h.aciklama || '',
      cek_no: h.cek_no || '', cek_banka: h.cek_banka || '', durum: h.durum,
    } : { hareket_turu: 'satis_fatura', tutar: '', kdv_tutari: '', stopaj_tutari: '', tarih: new Date().toISOString().split('T')[0], vade_tarihi: '', belge_no: '', aciklama: '', cek_no: '', cek_banka: '', durum: 'beklemede' })
    setHareketModal(true)
    setError('')
  }

  async function saveHareket() {
    if (!selectedId) return
    if (!hForm.tutar || !hForm.tarih) { setError('Tutar ve tarih zorunludur.'); return }
    const isCek = HAREKET_TURLERI.find(t => t.id === hForm.hareket_turu)?.isCek
    const payload: any = {
      firma_id: firma.id, cari_hesap_id: selectedId,
      hareket_turu: hForm.hareket_turu, tutar: Number(hForm.tutar),
      kdv_tutari: hForm.kdv_tutari ? Number(hForm.kdv_tutari) : 0,
      stopaj_tutari: hForm.stopaj_tutari ? Number(hForm.stopaj_tutari) : 0,
      tarih: hForm.tarih, vade_tarihi: hForm.vade_tarihi || null,
      belge_no: hForm.belge_no || null, aciklama: hForm.aciklama || null,
      cek_no: isCek ? hForm.cek_no || null : null,
      cek_banka: isCek ? hForm.cek_banka || null : null,
      durum: hForm.durum,
    }

    let workingPayload = { ...payload }
    let res;
    while (true) {
      res = editingHareket ? await supabase.from('cari_hareketler').update(workingPayload).eq('id', editingHareket.id) : await supabase.from('cari_hareketler').insert(workingPayload)
      if (!res.error) break
      const missingColumn = parseMissingColumn(res.error.message)
      if (!missingColumn || !(missingColumn in workingPayload) || Object.keys(workingPayload).length <= 2) break
      delete workingPayload[missingColumn]
    }

    if (res.error) { setError(res.error.message); return }
    if (Object.keys(workingPayload).length < Object.keys(payload).length) {
      alert('Veritabaninda bazi sutunlar eksik oldugu icin kayit eksik alanlarla yapildi. Lutfen SQL guncellemelerini tamamlayin.')
    }
    setHareketModal(false); fetchHareketler(selectedId)
  }

  async function deleteHareket(id: string) {
    if (!confirm('Bu hareketi silmek istediğinize emin misiniz?')) return
    await supabase.from('cari_hareketler').delete().eq('id', id)
    if (selectedId) fetchHareketler(selectedId)
  }

  // ── Hesaplamalar ──────────────────────────────────────────────────────────

  const filteredHesaplar = useMemo(() =>
    hesaplar.filter(h => h.ad.toLowerCase().includes(arama.toLowerCase())),
    [hesaplar, arama])

  const selectedCari = hesaplar.find(h => h.id === selectedId)
  const bakiye = useMemo(() => calcBakiye(hareketler), [hareketler])
  const isCekHareket = HAREKET_TURLERI.find(t => t.id === hForm.hareket_turu)?.isCek

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Finansal Operasyonlar</p>
            <h3 className="mt-1.5 text-xl font-bold tracking-tight">Cari Hesap Takibi</h3>
          </div>
          <div className="flex items-center gap-2">
            <select className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none" value={sirket} onChange={e => { setSirket(e.target.value as any); setSelectedId(null) }}>
              <option value="ETM">ETM</option>
              <option value="BİNYAPI">BİNYAPI</option>
            </select>
            {can(role, 'edit') && (
              <button onClick={() => openCariModal()} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700">
                <Plus size={15} />Yeni Cari
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Sol: Cari Listesi */}
        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600" placeholder="Cari ara..." value={arama} onChange={e => setArama(e.target.value)} />
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Yükleniyor...</p>
          ) : filteredHesaplar.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Cari hesap bulunamadı.</p>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredHesaplar.map(c => {
                const isActive = c.id === selectedId
                return (
                  <div key={c.id} onClick={() => setSelectedId(c.id)}
                    className={`group flex items-center justify-between gap-2 rounded-2xl border p-3 cursor-pointer transition-all ${isActive ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]'}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{c.ad}</p>
                      {c.vkn_tckn && <p className="text-[10px] text-slate-500">VKN: {c.vkn_tckn}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {can(role, 'edit') && (
                        <button onClick={e => { e.stopPropagation(); openCariModal(c) }} className="rounded-lg p-1 text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={13} /></button>
                      )}
                      {can(role, 'delete') && (
                        <button onClick={e => { e.stopPropagation(); deleteCari(c.id) }} className="rounded-lg p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13} /></button>
                      )}
                      <ChevronRight size={14} className={`transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-600'}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sağ: Hareketler */}
        <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-5 space-y-4">
          {!selectedCari ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-slate-500">
              <ChevronRight size={32} className="rotate-180" />
              <p className="text-sm">Soldan bir cari hesap seçin</p>
            </div>
          ) : (
            <>
              {/* Seçili cari başlık + bakiye */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold text-white">{selectedCari.ad}</h4>
                  {selectedCari.vkn_tckn && <p className="text-xs text-slate-500">VKN: {selectedCari.vkn_tckn}</p>}
                </div>
                {can(role, 'edit') && (
                  <button onClick={() => openHareketModal()} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700">
                    <Plus size={15} />Hareket Ekle
                  </button>
                )}
              </div>

              {/* Bakiye özet */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <BakiyeBox label="Toplam Alacak" value={bakiye.alacak} renk="emerald" />
                <BakiyeBox label="Toplam Borç" value={bakiye.borc} renk="rose" />
                <BakiyeBox label="Tahsilat" value={bakiye.tahsilat} renk="sky" />
                <BakiyeBox label="Net Bakiye" value={bakiye.net} renk={bakiye.net >= 0 ? 'cyan' : 'amber'} bold />
              </div>

              {/* Hareket listesi */}
              {hareketler.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Henüz hareket kaydı yok.</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {hareketler.map(h => {
                    const tur = HAREKET_TURLERI.find(t => t.id === h.hareket_turu)
                    const isAlacak = ['satis_fatura', 'diger_alacak', 'odeme_nakit', 'odeme_cek'].includes(h.hareket_turu)
                    const genelToplam = Number(h.tutar || 0) + Number(h.kdv_tutari || 0) - Number(h.stopaj_tutari || 0)
                    return (
                      <div key={h.id} className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] p-4 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-${tur?.renk}-500/15 text-${tur?.renk}-400`}>{tur?.label}</span>
                            <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${h.durum === 'tamamlandi' ? 'bg-emerald-500/10 text-emerald-400' : h.durum === 'gecikti' || h.durum === 'karsilıksız' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-500/10 text-slate-400'}`}>{h.durum}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {h.tarih}{h.vade_tarihi ? ` • Vade: ${h.vade_tarihi}` : ''}{h.belge_no ? ` • ${h.belge_no}` : ''}{h.aciklama ? ` — ${h.aciklama}` : ''}
                          </p>
                          {(h.cek_no || h.cek_banka) && (
                            <p className="mt-0.5 text-[10px] text-violet-400">Çek: {h.cek_no}{h.cek_banka ? ` (${h.cek_banka})` : ''}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className={`text-sm font-bold ${isAlacak ? 'text-emerald-400' : 'text-rose-400'}`}>{isAlacak ? '+' : '-'}{money(genelToplam)}</p>
                            {(Number(h.kdv_tutari) > 0 || Number(h.stopaj_tutari) > 0) && <p className="text-[10px] font-medium text-slate-500 mt-0.5">Net: {money(h.tutar)}</p>}
                          </div>
                          {can(role, 'edit') && (
                            <button onClick={() => openHareketModal(h)} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={13} /></button>
                          )}
                          {can(role, 'delete') && (
                            <button onClick={() => deleteHareket(h.id)} className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13} /></button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cari Hesap Modal */}
      {cariModal && (
        <Modal title={editingCari ? 'Cari Düzenle' : 'Yeni Cari Hesap'} onClose={() => setCariModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setCariModal(false)}>İptal</button><button className={btnPrimary} onClick={saveCari}>Kaydet</button></>}>
          <div className="space-y-4">
            {error && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}
            <FormField label="Ünvan" required><input className={inputCls} value={cariForm.ad} onChange={e => setCariForm({ ...cariForm, ad: e.target.value })} placeholder="Firma veya şahıs adı" /></FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Vergi / TC No"><input className={inputCls} value={cariForm.vkn_tckn} onChange={e => setCariForm({ ...cariForm, vkn_tckn: e.target.value })} /></FormField>
              <FormField label="Telefon"><input className={inputCls} value={cariForm.telefon} onChange={e => setCariForm({ ...cariForm, telefon: e.target.value })} /></FormField>
            </div>
            <FormField label="Adres"><input className={inputCls} value={cariForm.adres} onChange={e => setCariForm({ ...cariForm, adres: e.target.value })} /></FormField>
            <FormField label="Notlar"><input className={inputCls} value={cariForm.notlar} onChange={e => setCariForm({ ...cariForm, notlar: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}

      {/* Hareket Modal */}
      {hareketModal && (
        <Modal title={editingHareket ? 'Hareketi Düzenle' : 'Yeni Hareket'} onClose={() => setHareketModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setHareketModal(false)}>İptal</button><button className={btnPrimary} onClick={saveHareket}>Kaydet</button></>}>
          <div className="space-y-4">
            {error && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm text-rose-300">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Hareket Türü" required>
                <select className={inputCls} value={hForm.hareket_turu} onChange={e => setHForm({ ...hForm, hareket_turu: e.target.value })}>
                  {HAREKET_TURLERI.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                </select>
              </FormField>
              <FormField label="Tarih" required><input type="date" className={inputCls} value={hForm.tarih} onChange={e => setHForm({ ...hForm, tarih: e.target.value })} /></FormField>
              <FormField label="Vade Tarihi"><input type="date" className={inputCls} value={hForm.vade_tarihi} onChange={e => setHForm({ ...hForm, vade_tarihi: e.target.value })} /></FormField>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Tutar (Net)" required>
                <input type="number" step="0.01" className={inputCls} value={hForm.tutar} onChange={e => setHForm({ ...hForm, tutar: e.target.value })} placeholder="0.00" />
              </FormField>
              <FormField label="KDV Tutarı">
                <div className="flex flex-col gap-2">
                  <input type="number" step="0.01" className={inputCls} value={hForm.kdv_tutari} onChange={e => setHForm({ ...hForm, kdv_tutari: e.target.value })} placeholder="0.00" />
                  <div className="grid grid-cols-3 gap-1">
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.01).toFixed(2) }))} className="text-[10px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded hover:bg-blue-500/20" title="%1 KDV">%1</button>
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.10).toFixed(2) }))} className="text-[10px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded hover:bg-blue-500/20" title="%10 KDV">%10</button>
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20).toFixed(2) }))} className="text-[10px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-300 py-1.5 rounded hover:bg-blue-500/20" title="%20 KDV">%20</button>
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20 * 0.8).toFixed(2) }))} className="text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 py-1.5 rounded hover:bg-amber-500/20" title="2/10 Tevkifat (KDV'nin %80'i yansitilir)">2/10</button>
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20 * 0.6).toFixed(2) }))} className="text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 py-1.5 rounded hover:bg-amber-500/20" title="4/10 Tevkifat (KDV'nin %60'i yansitilir)">4/10</button>
                    <button type="button" onClick={() => setHForm(f => ({ ...f, kdv_tutari: (Number(f.tutar || 0) * 0.20 * 0.5).toFixed(2) }))} className="text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 py-1.5 rounded hover:bg-amber-500/20" title="5/10 Tevkifat (KDV'nin %50'si yansitilir)">5/10</button>
                  </div>
                </div>
              </FormField>
              <FormField label="Stopaj Tutarı">
                <div className="flex flex-col gap-2">
                  <input type="number" step="0.01" className={inputCls} value={hForm.stopaj_tutari} onChange={e => setHForm({ ...hForm, stopaj_tutari: e.target.value })} placeholder="0.00" />
                  <button type="button" onClick={() => setHForm(f => ({ ...f, stopaj_tutari: (Number(f.tutar || 0) * 0.05).toFixed(2) }))} className="w-full text-[11px] font-medium bg-rose-500/10 border border-rose-500/20 text-rose-300 py-1.5 rounded-lg hover:bg-rose-500/20 transition-colors">%5 Stopaj</button>
                </div>
              </FormField>
            </div>
            
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-200/70">Genel Toplam</span>
              <span className="text-lg font-bold text-indigo-400">{money(Number(hForm.tutar || 0) + Number(hForm.kdv_tutari || 0) - Number(hForm.stopaj_tutari || 0))}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Belge No"><input className={inputCls} value={hForm.belge_no} onChange={e => setHForm({ ...hForm, belge_no: e.target.value })} placeholder="Fatura / makbuz no" /></FormField>
              <FormField label="Durum">
                <select className={inputCls} value={hForm.durum} onChange={e => setHForm({ ...hForm, durum: e.target.value })}>
                  {DURUM_OPTS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                </select>
              </FormField>
            </div>
            {isCekHareket && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                <FormField label="Çek Numarası"><input className={inputCls} value={hForm.cek_no} onChange={e => setHForm({ ...hForm, cek_no: e.target.value })} placeholder="Örn: 1234567" /></FormField>
                <FormField label="Çek Bankası"><input className={inputCls} value={hForm.cek_banka} onChange={e => setHForm({ ...hForm, cek_banka: e.target.value })} placeholder="Örn: Garanti BBVA" /></FormField>
              </div>
            )}
            <FormField label="Açıklama"><input className={inputCls} value={hForm.aciklama} onChange={e => setHForm({ ...hForm, aciklama: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Yardımcı bileşenler ──────────────────────────────────────────────────────

function BakiyeBox({ label, value, renk, bold }: { label: string; value: number; renk: string; bold?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 ${bold ? 'text-lg font-bold' : 'text-base font-semibold'} text-${renk}-400`}>{money(value)}</p>
    </div>
  )
}

function money(v: number) {
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL'
}
