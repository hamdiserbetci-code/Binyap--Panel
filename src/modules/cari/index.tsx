'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CreditCard,
  FileText,
  Filter,
  History,
  Landmark,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CariHesapExtended, CariHareketExtended, Sirket, Proje } from '@/types'
import type { AppCtx } from '@/app/page'

const CARI_TIPLERI: { value: CariHesapExtended['tip']; label: string; color: string; icon: typeof User }[] = [
  { value: 'musteri', label: 'Müşteri', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: Building2 },
  { value: 'tedarikci', label: 'Tedarikçi', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Landmark },
  { value: 'personel', label: 'Personel', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: User },
  { value: 'diger', label: 'Diğer', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', icon: Users },
]

const cls = {
  btnPrimary: "bg-blue-600 hover:bg-blue-500 text-slate-800 rounded-xl px-4 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40",
  btnSecondary: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-3 py-2 text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40",
  input: "w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 transition-all",
}

const Modal = ({ title, onClose, children, footer, size = 'lg' }: { 
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) => {
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-4xl' }[size]
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white border border-blue-100 rounded-2xl shadow-2xl w-full ${sizeClass}`} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 text-lg p-5 border-b border-blue-100">{title}</h3>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-3 p-4 border-t border-blue-100 bg-slate-50 rounded-b-2xl">{footer}</div>
      </div>
    </div>
  )
}

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
      {label}{required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
)

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function CariModulu({ firma, firmalar, firmaIds, profil }: AppCtx) {
  const [cariHesaplar, setCariHesaplar] = useState<CariHesapExtended[]>([])
  const [hareketler, setHareketler] = useState<CariHareketExtended[]>([])
  const [sirketler, setSirketler] = useState<Sirket[]>([])
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [filterTip, setFilterTip] = useState<CariHesapExtended['tip'] | 'all'>('all')
  const [filterSirket, setFilterSirket] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [modal, setModal] = useState<Partial<CariHesapExtended> | null>(null)
  const [hareketModal, setHareketModal] = useState<{ cari: CariHesapExtended } | null>(null)
  const [yeniHareket, setYeniHareket] = useState<Partial<CariHareketExtended>>({ tur: 'borc', tarih: todayStr() })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedCari, setSelectedCari] = useState<CariHesapExtended | null>(null)

  const [selFirmaId, setSelFirmaId] = useState(firma.id)

  useEffect(() => {
    loadData()
  }, [firmaIds.join(',')])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: cData }, { data: sData }, { data: pData }] = await Promise.all([
        supabase
          .from('cari_hesaplar')
          .select('*, sirket:sirketler(*)')
          .in('firma_id', firmaIds)
          .order('ad', { ascending: true }),
        supabase.from('sirketler').select('*').in('firma_id', firmaIds).eq('aktif', true),
        supabase.from('projeler').select('*').in('firma_id', firmaIds).eq('durum', 'aktif'),
      ])
      
      setCariHesaplar((cData || []) as CariHesapExtended[])
      setSirketler((sData || []) as Sirket[])
      setProjeler((pData || []) as Proje[])
    } catch (err) {
      console.error('Veri yüklenirken hata:', err)
    }
    setLoading(false)
  }

  async function loadHareketler(cariId: string) {
    const { data } = await supabase
      .from('cari_hareketler')
      .select('*, proje:projeler(*)')
      .eq('cari_hesap_id', cariId)
      .order('tarih', { ascending: false })
    
    setHareketler((data || []) as CariHareketExtended[])
  }

  const filtered = useMemo(() => {
    return cariHesaplar.filter(c => {
      if (filterTip !== 'all' && c.tip !== filterTip) return false
      if (filterSirket !== 'all' && c.sirket_id !== filterSirket) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          c.ad.toLowerCase().includes(q) ||
          c.vkn_tckn?.toLowerCase().includes(q) ||
          c.telefon?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [cariHesaplar, filterTip, filterSirket, searchQuery])

  const stats = useMemo(() => {
    const toplamBorc = cariHesaplar.filter(c => c.bakiye > 0).reduce((sum, c) => sum + c.bakiye, 0)
    const toplamAlacak = cariHesaplar.filter(c => c.bakiye < 0).reduce((sum, c) => sum + Math.abs(c.bakiye), 0)
    return {
      toplam: cariHesaplar.length,
      musteri: cariHesaplar.filter(c => c.tip === 'musteri').length,
      tedarikci: cariHesaplar.filter(c => c.tip === 'tedarikci').length,
      personel: cariHesaplar.filter(c => c.tip === 'personel').length,
      toplamBorc,
      toplamAlacak,
      netBakiye: toplamBorc - toplamAlacak,
    }
  }, [cariHesaplar])

  async function save() {
    if (!modal?.ad || !modal?.tip) {
      alert('Ad ve tip zorunludur.')
      return
    }

    setSaving(true)
    const payload = {
      firma_id: modal.id ? (modal.firma_id || firma.id) : selFirmaId,
      sirket_id: modal.sirket_id || null,
      ad: modal.ad.trim(),
      tip: modal.tip,
      vkn_tckn: modal.vkn_tckn?.trim() || null,
      telefon: modal.telefon?.trim() || null,
      email: modal.email?.trim() || null,
      adres: modal.adres?.trim() || null,
      notlar: modal.notlar?.trim() || null,
    }

    if (modal.id) {
      const { error } = await supabase.from('cari_hesaplar').update(payload).eq('id', modal.id)
      if (error) alert(error.message)
    } else {
      const { error } = await supabase.from('cari_hesaplar').insert(payload)
      if (error) alert(error.message)
    }
    
    setSaving(false)
    setModal(null)
    await loadData()
  }

  async function saveHareket() {
    if (!hareketModal || !yeniHareket.tur || !yeniHareket.tutar) {
      alert('Tür ve tutar zorunludur.')
      return
    }

    const payload = {
      firma_id: hareketModal.cari.firma_id || firma.id,
      cari_hesap_id: hareketModal.cari.id,
      proje_id: yeniHareket.proje_id || null,
      tarih: yeniHareket.tarih || todayStr(),
      tur: yeniHareket.tur,
      tutar: yeniHareket.tutar,
      aciklama: yeniHareket.aciklama?.trim() || '',
      belge_no: yeniHareket.belge_no?.trim() || null,
      evrak_tipi: yeniHareket.evrak_tipi || 'diger',
    }

    await supabase.from('cari_hareketler').insert(payload)
    
    // Bakiyeyi güncelle
    const bakiyeDegisimi = yeniHareket.tur === 'borc' ? yeniHareket.tutar : -yeniHareket.tutar
    await supabase.rpc('update_cari_bakiye', {
      p_cari_id: hareketModal.cari.id,
      p_degisim: bakiyeDegisimi,
    })
    
    setYeniHareket({ tur: 'borc', tarih: todayStr() })
    await loadHareketler(hareketModal.cari.id)
    await loadData()
  }

  async function deleteCari() {
    if (!deleteId) return
    await supabase.from('cari_hesaplar').delete().eq('id', deleteId)
    setDeleteId(null)
    await loadData()
  }

  const getTipBadge = (tip: CariHesapExtended['tip']) => {
    const opt = CARI_TIPLERI.find(t => t.value === tip) || CARI_TIPLERI[3]
    const Icon = opt.icon
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${opt.color}`}>
        <Icon size={10} /> {opt.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-slate-50">
              <Users size={18} className="text-slate-800" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-800">Cari Hesaplar</h1>
              <p className="text-[13px] text-slate-500">Müşteri, tedarikçi ve personel cari hesap takibi</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={loadData} className={cls.btnSecondary}>
              <RefreshCw size={14} /> Yenile
            </button>
            <button 
              onClick={() => setModal({ tip: 'musteri' })} 
              className={cls.btnPrimary}
            >
              <Plus size={14} /> Yeni Cari Hesap
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Toplam Hesap</p>
          <p className="mt-2 text-[22px] font-semibold tabular-nums text-slate-800">{stats.toplam}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Müşteri</p>
          <p className="mt-2 text-[22px] font-semibold tabular-nums text-blue-400">{stats.musteri}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Tedarikçi</p>
          <p className="mt-2 text-[22px] font-semibold tabular-nums text-amber-400">{stats.tedarikci}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Personel</p>
          <p className="mt-2 text-[22px] font-semibold tabular-nums text-emerald-400">{stats.personel}</p>
        </div>
      </div>

      {/* Finansal Özet */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-red-50 to-white px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Toplam Borç (Alacaklı)</p>
          <p className="mt-2 text-[20px] font-bold tabular-nums text-red-600">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats.toplamBorc)}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Toplam Alacak (Borçlu)</p>
          <p className="mt-2 text-[20px] font-bold tabular-nums text-emerald-600">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats.toplamAlacak)}
          </p>
        </div>
        <div className={`rounded-2xl border border-blue-100 px-5 py-4 ${stats.netBakiye >= 0 ? 'bg-gradient-to-r from-blue-50 to-white' : 'bg-gradient-to-r from-orange-50 to-white'}`}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Net Bakiye</p>
          <p className={`mt-2 text-[20px] font-bold tabular-nums ${stats.netBakiye >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats.netBakiye)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari hesap adı, VKN/TCKN, telefon ara..."
              className="w-full bg-slate-50 border border-blue-100 rounded-xl pl-9 pr-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterTip}
              onChange={(e) => setFilterTip(e.target.value as CariHesapExtended['tip'] | 'all')}
              className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="all">Tüm Tipler</option>
              {CARI_TIPLERI.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select
              value={filterSirket}
              onChange={(e) => setFilterSirket(e.target.value)}
              className="bg-slate-50 border border-blue-100 rounded-xl px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="all">Tüm Şirketler</option>
              {sirketler.map(s => <option key={s.id} value={s.id}>{s.kod}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-blue-100 bg-white backdrop-blur-xl overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-14 text-center text-[13px] text-slate-400">
              <Users size={48} className="mx-auto mb-3 text-slate-200" />
              Cari hesap bulunamadı.
            </div>
          ) : filtered.map((c) => (
            <div key={c.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {getTipBadge(c.tip)}
                    <span className="text-[11px] text-slate-400">
                      {c.sirket?.kod || 'Genel'}
                    </span>
                  </div>
                  <h3 className="font-medium text-slate-800">{c.ad}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                    {c.vkn_tckn && <span>VKN/TCKN: {c.vkn_tckn}</span>}
                    {c.telefon && <span>Tel: {c.telefon}</span>}
                    {c.email && <span>E-posta: {c.email}</span>}
                  </div>
                  {c.adres && (
                    <p className="text-[11px] text-slate-400 mt-1">{c.adres}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-[15px] font-semibold tabular-nums ${c.bakiye > 0 ? 'text-red-400' : c.bakiye < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(c.bakiye || 0))}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {c.bakiye > 0 ? 'Borçlu' : c.bakiye < 0 ? 'Alacaklı' : 'Nötr'}
                  </p>
                  <div className="flex gap-1 mt-2 justify-end">
                    <button 
                      onClick={() => { setHareketModal({ cari: c }); loadHareketler(c.id); }}
                      className="px-2 py-1 text-[10px] font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                    >
                      Hareketler
                    </button>
                    <button 
                      onClick={() => setModal(c)}
                      className="px-2 py-1 text-[10px] font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Düzenle
                    </button>
                    <button 
                      onClick={() => setDeleteId(c.id)}
                      className="px-2 py-1 text-[10px] font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cari Modal */}
      {modal && (
        <Modal
          title={modal.id ? 'Cari Hesap Düzenle' : 'Yeni Cari Hesap'}
          onClose={() => setModal(null)}
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
            {!modal.id && firmalar.length > 1 && (
              <Field label="Firma">
                <select className={cls.input} value={selFirmaId} onChange={e => setSelFirmaId(e.target.value)}>
                  {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Şirket">
                <select 
                  className={cls.input}
                  value={modal.sirket_id || ''}
                  onChange={(e) => setModal(prev => ({ ...prev!, sirket_id: e.target.value || null }))}
                >
                  <option value="">Genel</option>
                  {sirketler.map(s => <option key={s.id} value={s.id}>{s.kod} - {s.ad}</option>)}
                </select>
              </Field>
              <Field label="Tip" required>
                <select 
                  className={cls.input}
                  value={modal.tip || 'musteri'}
                  onChange={(e) => setModal(prev => ({ ...prev!, tip: e.target.value as CariHesapExtended['tip'] }))}
                >
                  {CARI_TIPLERI.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Ad / Unvan" required>
              <input 
                className={cls.input}
                value={modal.ad || ''}
                onChange={(e) => setModal(prev => ({ ...prev!, ad: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="VKN / TCKN">
                <input 
                  className={cls.input}
                  value={modal.vkn_tckn || ''}
                  onChange={(e) => setModal(prev => ({ ...prev!, vkn_tckn: e.target.value }))}
                />
              </Field>
              <Field label="Telefon">
                <input 
                  className={cls.input}
                  value={modal.telefon || ''}
                  onChange={(e) => setModal(prev => ({ ...prev!, telefon: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="E-posta">
              <input 
                type="email"
                className={cls.input}
                value={modal.email || ''}
                onChange={(e) => setModal(prev => ({ ...prev!, email: e.target.value }))}
              />
            </Field>

            <Field label="Adres">
              <textarea 
                className={`${cls.input} resize-none`}
                rows={2}
                value={modal.adres || ''}
                onChange={(e) => setModal(prev => ({ ...prev!, adres: e.target.value }))}
              />
            </Field>

            <Field label="Notlar">
              <textarea 
                className={`${cls.input} resize-none`}
                rows={2}
                value={modal.notlar || ''}
                onChange={(e) => setModal(prev => ({ ...prev!, notlar: e.target.value }))}
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Hareketler Modal */}
      {hareketModal && (
        <Modal
          title={`${hareketModal.cari.ad} - Cari Hareketler`}
          onClose={() => setHareketModal(null)}
          size="xl"
          footer={
            <button onClick={() => setHareketModal(null)} className={cls.btnSecondary}>Kapat</button>
          }
        >
          <div className="space-y-4">
            {/* Yeni Hareket */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Yeni Hareket Ekle</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Tür" required>
                  <select 
                    className={cls.input}
                    value={yeniHareket.tur || 'borc'}
                    onChange={(e) => setYeniHareket(prev => ({ ...prev, tur: e.target.value as 'borc' | 'alacak' }))}
                  >
                    <option value="borc">Borç (Alacaklı)</option>
                    <option value="alacak">Alacak (Borçlu)</option>
                  </select>
                </Field>
                <Field label="Tutar" required>
                  <input 
                    type="number"
                    step="0.01"
                    className={cls.input}
                    value={yeniHareket.tutar || ''}
                    onChange={(e) => setYeniHareket(prev => ({ ...prev, tutar: parseFloat(e.target.value) || 0 }))}
                  />
                </Field>
                <Field label="Tarih" required>
                  <input 
                    type="date"
                    className={cls.input}
                    value={yeniHareket.tarih || todayStr()}
                    onChange={(e) => setYeniHareket(prev => ({ ...prev, tarih: e.target.value }))}
                  />
                </Field>
                <Field label="Proje">
                  <select 
                    className={cls.input}
                    value={yeniHareket.proje_id || ''}
                    onChange={(e) => setYeniHareket(prev => ({ ...prev, proje_id: e.target.value || null }))}
                  >
                    <option value="">Seçiniz</option>
                    {projeler.map(p => <option key={p.id} value={p.id}>{p.ad}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Belge No">
                  <input 
                    className={cls.input}
                    value={yeniHareket.belge_no || ''}
                    onChange={(e) => setYeniHareket(prev => ({ ...prev, belge_no: e.target.value }))}
                  />
                </Field>
                <Field label="Evrak Tipi">
                  <select 
                    className={cls.input}
                    value={yeniHareket.evrak_tipi || 'diger'}
                    onChange={(e) => setYeniHareket(prev => ({ ...prev, evrak_tipi: e.target.value as any }))}
                  >
                    <option value="fatura">Fatura</option>
                    <option value="dekont">Dekont</option>
                    <option value="cek">Çek</option>
                    <option value="diger">Diğer</option>
                  </select>
                </Field>
              </div>
              <Field label="Açıklama">
                <input 
                  className={cls.input}
                  value={yeniHareket.aciklama || ''}
                  onChange={(e) => setYeniHareket(prev => ({ ...prev, aciklama: e.target.value }))}
                />
              </Field>
              <button 
                onClick={saveHareket}
                className={`${cls.btnPrimary} mt-3 w-full justify-center`}
              >
                <Plus size={14} /> Hareket Ekle
              </button>
            </div>

            {/* Hareket Listesi */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-slate-500 font-medium">Tarih</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-medium">Tür</th>
                    <th className="px-4 py-2 text-left text-slate-500 font-medium">Açıklama</th>
                    <th className="px-4 py-2 text-right text-slate-500 font-medium">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hareketler.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Henüz hareket bulunmuyor.
                      </td>
                    </tr>
                  ) : hareketler.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600">{new Date(h.tarih).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${h.tur === 'borc' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {h.tur === 'borc' ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                          {h.tur === 'borc' ? 'Borç' : 'Alacak'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {h.aciklama}
                        {h.proje && <span className="text-slate-400 ml-2">({h.proje.ad})</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(h.tutar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white border border-blue-100 rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 text-lg mb-2">Cari Hesap Sil</h3>
            <p className="text-slate-500 text-sm mb-4">Bu cari hesap ve tüm hareketleri kalıcı olarak silinecektir. Emin misiniz?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={deleteCari} className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-2 text-[13px] font-medium">
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}