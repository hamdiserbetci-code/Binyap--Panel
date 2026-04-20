'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  Scale, Plus, Edit, Trash2, Search, ChevronDown, ChevronRight,
  Upload, Download, Eye, X, CheckCircle, Clock, AlertTriangle,
  FileText, RefreshCw, Printer, Users
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, StatCard, Card, Modal, Btn, Field,
  inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate
} from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ─── Süreç Adımları ───────────────────────────────────────────
const ADIMLAR = [
  { kodu: 'sablon_hazirlandi',    adi: 'Şablon Hazırlandı',      ikon: '📋', renk: 'gray'   },
  { kodu: 'avukata_gonderildi',   adi: 'Avukata Gönderildi',     ikon: '📨', renk: 'blue'   },
  { kodu: 'santiyeye_gonderildi', adi: 'Şantiyeye Gönderildi',   ikon: '🏗️',  renk: 'amber'  },
  { kodu: 'personel_imzasi',      adi: 'Personel İmzası Alındı', ikon: '✍️',  renk: 'violet' },
  { kodu: 'avukat_imzasi',        adi: 'Avukat İmzası Alındı',   ikon: '⚖️',  renk: 'indigo' },
  { kodu: 'ana_firma_imzasi',     adi: 'Ana Firma İmzası Alındı',ikon: '🏢',  renk: 'orange' },
  { kodu: 'bizim_firma_imzasi',   adi: 'Bizim Firma İmzası',     ikon: '✅',  renk: 'green'  },
  { kodu: 'tamamlandi',           adi: 'Tamamlandı',             ikon: '🎯',  renk: 'green'  },
]

const ADIM_INDEX: Record<string, number> = {}
ADIMLAR.forEach((a, i) => { ADIM_INDEX[a.kodu] = i })

const CIKIS_NEDENLERI = [
  { v: 'isveren_fesih',   l: 'İşverence Fesih (04)'    },
  { v: 'isci_istifa',     l: 'İşçi İstifası (01)'       },
  { v: 'anlasma',         l: 'Karşılıklı Anlaşma (17)'  },
  { v: 'sure_bitis',      l: 'Süre Bitimi (02)'          },
  { v: 'diger',           l: 'Diğer'                     },
]

const BADGE_RENK: Record<string, 'gray'|'blue'|'yellow'|'green'|'orange'> = {
  sablon_hazirlandi:    'gray',
  avukata_gonderildi:   'blue',
  santiyeye_gonderildi: 'yellow',
  personel_imzasi:      'blue',
  avukat_imzasi:        'blue',
  ana_firma_imzasi:     'orange',
  bizim_firma_imzasi:   'orange',
  tamamlandi:           'green',
}

const emptyForm = {
  tc_kimlik: '', ad_soyad: '', telefon: '', adres: '',
  giris_tarihi: '', cikis_tarihi: '', cikis_nedeni: 'isveren_fesih',
  odenecek_tutar: '', odeme_tarihi: '',
  calistigi_firma: '', firma_vergi_no: '', firma_adresi: '', firma_vekili: '',
  ana_firma_adi: '', ana_firma_adresi: '', ana_firma_vkn: '',
  avukat_adi: '', avukat_telefon: '', avukat_email: '',
  proje_id: '', notlar: '',
}

const emptyKisi = { tc_kimlik: '', ad_soyad: '', telefon: '', adres: '', giris_tarihi: '', cikis_tarihi: '', cikis_nedeni: 'isveren_fesih', odenecek_tutar: '', odeme_tarihi: '' }

// ─── Ana Modül ────────────────────────────────────────────────
export default function ArabulucuModule({ firma }: AppCtx) {
  const [dosyalar, setDosyalar]   = useState<any[]>([])
  const [projeler, setProjeler]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [durumF, setDurumF]       = useState('hepsi')
  const [projeF, setProjeF]       = useState('hepsi')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState<any | null>(null)
  const [delId, setDelId]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(emptyForm)
  const [kisiler, setKisiler]     = useState([{ ...emptyKisi }])

  async function load() {
    setLoading(true)
    const [d, p] = await Promise.all([
      supabase.from('arabulucu_dosyalar')
        .select('*, projeler(proje_adi)')
        .eq('firma_id', firma.id)
        .order('created_at', { ascending: false }),
      supabase.from('projeler').select('id, proje_adi').eq('firma_id', firma.id),
    ])
    setDosyalar(d.data || [])
    setProjeler(p.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const filtered = useMemo(() => dosyalar.filter(d => {
    if (durumF !== 'hepsi' && d.durum !== durumF) return false
    if (projeF !== 'hepsi' && d.proje_id !== projeF) return false
    if (search) {
      const q = search.toLowerCase()
      return d.ad_soyad?.toLowerCase().includes(q) ||
        d.tc_kimlik?.includes(q) ||
        d.calistigi_firma?.toLowerCase().includes(q)
    }
    return true
  }), [dosyalar, durumF, projeF, search])

  const summary = useMemo(() => ({
    toplam:     dosyalar.length,
    devam:      dosyalar.filter(d => d.durum !== 'tamamlandi').length,
    tamamlandi: dosyalar.filter(d => d.durum === 'tamamlandi').length,
    bekleyen:   dosyalar.filter(d => ['sablon_hazirlandi','avukata_gonderildi','santiyeye_gonderildi'].includes(d.durum)).length,
  }), [dosyalar])

  function openNew() {
    setForm({
      ...emptyForm,
      calistigi_firma: firma.ad,
      firma_vergi_no:  firma.vergi_no || '',
    })
    setKisiler([{ ...emptyKisi }])
    setEditing(null); setModal(true)
  }

  function openEdit(d: any) {
    setForm({
      tc_kimlik:       d.tc_kimlik || '',
      ad_soyad:        d.ad_soyad || '',
      telefon:         d.telefon || '',
      adres:           d.adres || '',
      giris_tarihi:    d.giris_tarihi || '',
      cikis_tarihi:    d.cikis_tarihi || '',
      cikis_nedeni:    d.cikis_nedeni || 'isveren_fesih',
      odenecek_tutar:  String(d.odenecek_tutar || ''),
      odeme_tarihi:    d.odeme_tarihi || '',
      calistigi_firma: d.calistigi_firma || '',
      firma_vergi_no:  d.firma_vergi_no || '',
      firma_adresi:    d.firma_adresi || '',
      firma_vekili:    d.firma_vekili || '',
      ana_firma_adi:   d.ana_firma_adi || '',
      ana_firma_adresi:d.ana_firma_adresi || '',
      ana_firma_vkn:   d.ana_firma_vkn || '',
      avukat_adi:      d.avukat_adi || '',
      avukat_telefon:  d.avukat_telefon || '',
      avukat_email:    d.avukat_email || '',
      proje_id:        d.proje_id || '',
      notlar:          d.notlar || '',
    })
    setKisiler([{ tc_kimlik: d.tc_kimlik||'', ad_soyad: d.ad_soyad||'', telefon: d.telefon||'', adres: d.adres||'', giris_tarihi: d.giris_tarihi||'', cikis_tarihi: d.cikis_tarihi||'', cikis_nedeni: d.cikis_nedeni||'isveren_fesih', odenecek_tutar: String(d.odenecek_tutar||''), odeme_tarihi: d.odeme_tarihi||'' }])
    setEditing(d); setModal(true)
  }

  async function save() {
    if (editing) {
      // Düzenleme: tek kişi
      const k = kisiler[0]
      if (!k.tc_kimlik || !k.ad_soyad) return alert('TC Kimlik ve Ad Soyad zorunludur')
      setSaving(true)
      const payload = {
        tc_kimlik: k.tc_kimlik, ad_soyad: k.ad_soyad, telefon: k.telefon||null, adres: k.adres||null,
        giris_tarihi: k.giris_tarihi||null, cikis_tarihi: k.cikis_tarihi||null, cikis_nedeni: k.cikis_nedeni,
        odenecek_tutar: k.odenecek_tutar ? Number(k.odenecek_tutar) : null, odeme_tarihi: k.odeme_tarihi||null,
        calistigi_firma: form.calistigi_firma||null, firma_vergi_no: form.firma_vergi_no||null,
        firma_adresi: form.firma_adresi||null, firma_vekili: form.firma_vekili||null,
        ana_firma_adi: form.ana_firma_adi||null, ana_firma_adresi: form.ana_firma_adresi||null, ana_firma_vkn: form.ana_firma_vkn||null,
        avukat_adi: form.avukat_adi||null, avukat_telefon: form.avukat_telefon||null, avukat_email: form.avukat_email||null,
        proje_id: form.proje_id||null, notlar: form.notlar||null, updated_at: new Date().toISOString(),
      }
      await supabase.from('arabulucu_dosyalar').update(payload).eq('id', editing.id)
    } else {
      // Yeni: her kişi için ayrı dosya
      const gecerli = kisiler.filter(k => k.tc_kimlik && k.ad_soyad)
      if (gecerli.length === 0) return alert('En az bir kişi için TC Kimlik ve Ad Soyad zorunludur')
      setSaving(true)
      const ortak = {
        firma_id: firma.id, durum: 'sablon_hazirlandi',
        calistigi_firma: form.calistigi_firma||null, firma_vergi_no: form.firma_vergi_no||null,
        firma_adresi: form.firma_adresi||null, firma_vekili: form.firma_vekili||null,
        ana_firma_adi: form.ana_firma_adi||null, ana_firma_adresi: form.ana_firma_adresi||null, ana_firma_vkn: form.ana_firma_vkn||null,
        avukat_adi: form.avukat_adi||null, avukat_telefon: form.avukat_telefon||null, avukat_email: form.avukat_email||null,
        proje_id: form.proje_id||null, notlar: form.notlar||null,
      }
      for (const k of gecerli) {
        await supabase.from('arabulucu_dosyalar').insert({
          ...ortak,
          tc_kimlik: k.tc_kimlik, ad_soyad: k.ad_soyad, telefon: k.telefon||null, adres: k.adres||null,
          giris_tarihi: k.giris_tarihi||null, cikis_tarihi: k.cikis_tarihi||null, cikis_nedeni: k.cikis_nedeni,
          odenecek_tutar: k.odenecek_tutar ? Number(k.odenecek_tutar) : null, odeme_tarihi: k.odeme_tarihi||null,
        })
      }
    }
    setSaving(false); setModal(false); load()
  }

  const sf = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Scale className="w-5 h-5 text-indigo-600" />}
        title="Arabulucu Süreçleri"
        subtitle="Personel arabuluculuk dosyaları — şablon, imza ve arşiv takibi"
        iconBg="bg-indigo-50"
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>Yenile</Btn>
            <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Dosya</Btn>
          </div>
        }
      />

      {/* Özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Toplam Dosya"  value={summary.toplam}     color="text-gray-700" />
        <StatCard label="Devam Eden"    value={summary.devam}      color="text-blue-600" />
        <StatCard label="Tamamlandı"    value={summary.tamamlandi} color="text-green-600" />
        <StatCard label="Bekleyen"      value={summary.bekleyen}   color="text-amber-600" />
      </div>

      {/* Filtreler */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Ad, TC veya firma ara..."
              value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`} />
          </div>
          <select value={durumF} onChange={e => setDurumF(e.target.value)} className={inputCls + ' w-auto'}>
            <option value="hepsi">Tüm Durumlar</option>
            {ADIMLAR.map(a => <option key={a.kodu} value={a.kodu}>{a.ikon} {a.adi}</option>)}
          </select>
          <select value={projeF} onChange={e => setProjeF(e.target.value)} className={inputCls + ' w-auto'}>
            <option value="hepsi">Tüm Projeler</option>
            {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
          </select>
        </div>
      </Card>

      {/* Master Grid */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Scale className="w-10 h-10" />} message="Arabulucu dosyası bulunamadı" />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(d => (
              <DosyaSatiri
                key={d.id}
                dosya={d}
                firma={firma}
                projeler={projeler}
                expanded={expanded === d.id}
                onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
                onEdit={() => openEdit(d)}
                onDelete={() => setDelId(d.id)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Yeni/Düzenle Modal */}
      {modal && (
        <Modal
          title={editing ? 'Dosya Düzenle' : 'Yeni Arabulucu Dosyası'}
          onClose={() => setModal(false)}
          size="xl"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}
        >
          <div className="space-y-6">
            {/* Kişi Listesi */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Personel Listesi
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{kisiler.length} kişi</span>
                </h3>
                {!editing && (
                  <Btn size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setKisiler(p => [...p, { ...emptyKisi }])}>
                    Kişi Ekle
                  </Btn>
                )}
              </div>
              <div className="space-y-3">
                {kisiler.map((k, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 relative">
                    {!editing && kisiler.length > 1 && (
                      <button onClick={() => setKisiler(p => p.filter((_,i) => i !== idx))}
                        className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <div className="text-xs font-semibold text-indigo-600 mb-2">{idx + 1}. Kişi</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="TC Kimlik No" required>
                        <input type="text" value={k.tc_kimlik}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, tc_kimlik: e.target.value} : x))}
                          className={inputCls} maxLength={11} placeholder="12345678901" />
                      </Field>
                      <Field label="Ad Soyad" required>
                        <input type="text" value={k.ad_soyad}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, ad_soyad: e.target.value} : x))}
                          className={inputCls} />
                      </Field>
                      <Field label="Telefon">
                        <input type="text" value={k.telefon}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, telefon: e.target.value} : x))}
                          className={inputCls} placeholder="5XX XXX XXXX" />
                      </Field>
                      <Field label="Adres">
                        <input type="text" value={k.adres}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, adres: e.target.value} : x))}
                          className={inputCls} />
                      </Field>
                      <Field label="İşe Giriş Tarihi">
                        <input type="date" value={k.giris_tarihi}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, giris_tarihi: e.target.value} : x))}
                          className={inputCls} />
                      </Field>
                      <Field label="İşten Çıkış Tarihi">
                        <input type="date" value={k.cikis_tarihi}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, cikis_tarihi: e.target.value} : x))}
                          className={inputCls} />
                      </Field>
                      <Field label="Çıkış Nedeni">
                        <select value={k.cikis_nedeni}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, cikis_nedeni: e.target.value} : x))}
                          className={inputCls}>
                          {CIKIS_NEDENLERI.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                        </select>
                      </Field>
                      <Field label="Ödenecek Tutar (₺)">
                        <input type="number" step="0.01" value={k.odenecek_tutar}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, odenecek_tutar: e.target.value} : x))}
                          className={inputCls} />
                      </Field>
                      <Field label="Ödeme Tarihi">
                        <input type="date" value={k.odeme_tarihi}
                          onChange={e => setKisiler(p => p.map((x,i) => i===idx ? {...x, odeme_tarihi: e.target.value} : x))}
                          className={inputCls} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              {!editing && (
                <button onClick={() => setKisiler(p => [...p, { ...emptyKisi }])}
                  className="mt-2 w-full text-xs py-2 rounded-lg border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Yeni Kişi Ekle
                </button>
              )}
            </div>

            {/* Firma Bilgileri */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />Çalıştığı Firma Bilgileri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Firma Ünvanı" className="md:col-span-2">
                  <input type="text" value={form.calistigi_firma} onChange={sf('calistigi_firma')} className={inputCls} />
                </Field>
                <Field label="Vergi Numarası">
                  <input type="text" value={form.firma_vergi_no} onChange={sf('firma_vergi_no')} className={inputCls} />
                </Field>
                <Field label="Firma Vekili">
                  <input type="text" value={form.firma_vekili} onChange={sf('firma_vekili')} className={inputCls} />
                </Field>
                <Field label="Firma Adresi" className="md:col-span-2">
                  <textarea rows={2} value={form.firma_adresi} onChange={sf('firma_adresi')} className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Ana Firma */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-500" />Ana Firma Bilgileri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Ana Firma Adı" className="md:col-span-2">
                  <input type="text" value={form.ana_firma_adi} onChange={sf('ana_firma_adi')} className={inputCls} />
                </Field>
                <Field label="Ana Firma VKN">
                  <input type="text" value={form.ana_firma_vkn} onChange={sf('ana_firma_vkn')} className={inputCls} />
                </Field>
                <Field label="Ana Firma Adresi" className="md:col-span-2">
                  <textarea rows={2} value={form.ana_firma_adresi} onChange={sf('ana_firma_adresi')} className={inputCls} />
                </Field>
              </div>
            </div>

            {/* Avukat */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Scale className="w-4 h-4 text-rose-500" />Avukat Bilgileri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Avukat Adı">
                  <input type="text" value={form.avukat_adi} onChange={sf('avukat_adi')} className={inputCls} />
                </Field>
                <Field label="Avukat Telefon">
                  <input type="text" value={form.avukat_telefon} onChange={sf('avukat_telefon')} className={inputCls} />
                </Field>
                <Field label="Avukat E-posta">
                  <input type="email" value={form.avukat_email} onChange={sf('avukat_email')} className={inputCls} />
                </Field>
              </div>
            </div>

            <Field label="Notlar">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
            </Field>
            <Field label="Proje">
              <select value={form.proje_id} onChange={sf('proje_id')} className={inputCls}>
                <option value="">Seçiniz</option>
                {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
              </select>
            </Field>
            {!editing && kisiler.length > 1 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-700">
                💡 {kisiler.filter(k => k.tc_kimlik && k.ad_soyad).length} kişi için ayrı ayrı arabulucu dosyası oluşturulacak. Firma, avukat ve proje bilgileri hepsinde aynı olacak.
              </div>
            )}
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog
          message="Bu arabulucu dosyasını silmek istediğinize emin misiniz?"
          onConfirm={async () => { await supabase.from('arabulucu_dosyalar').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)}
        />
      )}
    </div>
  )
}

// ─── Dosya Satırı (Master + Detail) ──────────────────────────
interface DosyaSatiriProps {
  dosya: any
  firma: { id: string; ad: string; vergi_no?: string | null }
  projeler: any[]
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

function DosyaSatiri({ dosya: d, firma, projeler, expanded, onToggle, onEdit, onDelete, onRefresh }: DosyaSatiriProps) {
  const [belgeler, setBelgeler]   = useState<any[]>([])
  const [loadingB, setLoadingB]   = useState(false)
  const [belgeModal, setBelgeModal] = useState(false)
  const [belgeForm, setBelgeForm] = useState({ belge_turu: 'imzali_belge', adim_kodu: '', aciklama: '' })
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]     = useState<{ url: string; adi: string } | null>(null)
  const [saving, setSaving]       = useState(false)

  const adimIdx   = ADIM_INDEX[d.durum] ?? 0
  const adimBilgi = ADIMLAR[adimIdx]
  const proje     = projeler.find(p => p.id === d.proje_id)

  useEffect(() => {
    if (expanded && belgeler.length === 0) loadBelgeler()
  }, [expanded])

  async function loadBelgeler() {
    setLoadingB(true)
    const { data } = await supabase.from('arabulucu_belgeler').select('*').eq('dosya_id', d.id).order('created_at', { ascending: false })
    setBelgeler(data || [])
    setLoadingB(false)
  }

  async function adimIlerlet() {
    const siradaki = ADIMLAR[adimIdx + 1]
    if (!siradaki) return
    setSaving(true)
    await supabase.from('arabulucu_dosyalar').update({ durum: siradaki.kodu, updated_at: new Date().toISOString() }).eq('id', d.id)
    setSaving(false)
    onRefresh()
  }

  async function adimGeriAl() {
    if (adimIdx === 0) return
    const onceki = ADIMLAR[adimIdx - 1]
    setSaving(true)
    await supabase.from('arabulucu_dosyalar').update({ durum: onceki.kodu, updated_at: new Date().toISOString() }).eq('id', d.id)
    setSaving(false)
    onRefresh()
  }

  async function nushaGuncelle(alan: string, deger: boolean) {
    await supabase.from('arabulucu_dosyalar').update({ [alan]: deger }).eq('id', d.id)
    onRefresh()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const safeName = file.name
      .replace(/[ğ]/g,'g').replace(/[Ğ]/g,'G').replace(/[ü]/g,'u').replace(/[Ü]/g,'U')
      .replace(/[ş]/g,'s').replace(/[Ş]/g,'S').replace(/[ı]/g,'i').replace(/[İ]/g,'I')
      .replace(/[ö]/g,'o').replace(/[Ö]/g,'O').replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
      .replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const path = `${firma.id}/${d.id}/${belgeForm.belge_turu}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('arabulucu-belgeler').upload(path, file)
    if (error) { alert('Yükleme hatası: ' + error.message); setUploading(false); return }
    await supabase.from('arabulucu_belgeler').insert({
      dosya_id: d.id, firma_id: firma.id,
      belge_turu: belgeForm.belge_turu,
      adim_kodu: belgeForm.adim_kodu || d.durum,
      dosya_adi: file.name, storage_path: path,
      aciklama: belgeForm.aciklama || null,
    })
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    setBelgeModal(false)
    loadBelgeler()
  }

  async function belgeIndir(b: any) {
    const { data } = await supabase.storage.from('arabulucu-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = b.dosya_adi; a.click() }
  }

  async function belgeOnizle(b: any) {
    const { data } = await supabase.storage.from('arabulucu-belgeler').createSignedUrl(b.storage_path, 60)
    if (data?.signedUrl) setPreview({ url: data.signedUrl, adi: b.dosya_adi })
  }

  async function belgeSil(b: any) {
    if (!confirm(`"${b.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('arabulucu-belgeler').remove([b.storage_path])
    await supabase.from('arabulucu_belgeler').delete().eq('id', b.id)
    loadBelgeler()
  }

  // Excel şablon çıktısı
  async function excelSablon() {
    const XLSXStyle = await import('xlsx-js-style')
    const { utils, writeFile } = XLSXStyle

    const KOYU = '0F172A'; const BEYAZ = 'FFFFFF'; const ACIK = 'EFF6FF'
    const SINIR = 'CBD5E1'; const MAVI = '1E40AF'

    const S = {
      baslik:  { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: KOYU } }, alignment: { horizontal: 'left', vertical: 'center' } },
      th:      { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: BEYAZ } }, fill: { fgColor: { rgb: MAVI } }, alignment: { horizontal: 'left', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      td:      { font: { name: 'Calibri', sz: 10, color: { rgb: KOYU } }, fill: { fgColor: { rgb: BEYAZ } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
      tdVal:   { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: KOYU } }, fill: { fgColor: { rgb: ACIK } }, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: SINIR } }, bottom: { style: 'thin', color: { rgb: SINIR } }, left: { style: 'thin', color: { rgb: SINIR } }, right: { style: 'thin', color: { rgb: SINIR } } } },
    }

    const c = (v: any, s: any) => ({ v: v ?? '', s, t: 's' })
    const ws: any = {}
    const merges: any[] = []
    let row = 0

    // Başlık
    ws[utils.encode_cell({ r: row, c: 0 })] = c('ARABULUCU BAŞVURU FORMU', S.baslik)
    ws[utils.encode_cell({ r: row, c: 1 })] = c('', S.baslik)
    ws[utils.encode_cell({ r: row, c: 2 })] = c(new Date().toLocaleDateString('tr-TR'), { ...S.baslik, alignment: { horizontal: 'right' } })
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 1 } })
    row += 2

    const satirlar = [
      ['TC KİMLİK NO',       d.tc_kimlik],
      ['ADI SOYADI',         d.ad_soyad],
      ['TELEFON',            d.telefon],
      ['ADRES',              d.adres],
      ['GİRİŞ TARİHİ',      d.giris_tarihi ? new Date(d.giris_tarihi).toLocaleDateString('tr-TR') : ''],
      ['ÇIKIŞ TARİHİ',      d.cikis_tarihi ? new Date(d.cikis_tarihi).toLocaleDateString('tr-TR') : ''],
      ['ÖDENECEK TUTAR',    d.odenecek_tutar ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(d.odenecek_tutar) : ''],
      ['ÖDEME TARİHİ',      d.odeme_tarihi ? new Date(d.odeme_tarihi).toLocaleDateString('tr-TR') : ''],
      ['ÇALIŞTIĞI FİRMA',   d.calistigi_firma],
      ['', ''],
      ['FİRMA BİLGİLERİ',   ''],
      ['FİRMA UNVANI',       d.calistigi_firma],
      ['FİRMA VERGİ NO',     d.firma_vergi_no],
      ['FİRMA ADRESİ',       d.firma_adresi],
      ['FİRMA VEKİLİ',       d.firma_vekili],
      ['İŞÇİNİN ÇIKIŞ NEDENİ', CIKIS_NEDENLERI.find(c => c.v === d.cikis_nedeni)?.l || d.cikis_nedeni],
      ['', ''],
      ['ANA FİRMA',          ''],
      ['ANA FİRMA ADI',      d.ana_firma_adi],
      ['ANA FİRMA ADRESİ',   d.ana_firma_adresi],
      ['ANA FİRMA VKN',      d.ana_firma_vkn],
    ]

    satirlar.forEach(([etiket, deger]) => {
      if (!etiket && !deger) { row++; return }
      const isBaslik = !deger && etiket
      const s = isBaslik ? S.th : S.td
      ws[utils.encode_cell({ r: row, c: 0 })] = c(etiket, s)
      ws[utils.encode_cell({ r: row, c: 1 })] = c('', s)
      ws[utils.encode_cell({ r: row, c: 2 })] = c(deger || '', isBaslik ? s : S.tdVal)
      if (isBaslik) merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 2 } })
      row++
    })

    ws['!cols'] = [{ wch: 28 }, { wch: 4 }, { wch: 50 }]
    ws['!rows'] = [{ hpt: 28 }]
    ws['!merges'] = merges
    ws['!ref'] = utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: 2 } })

    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Arabulucu Formu')
    writeFile(wb, `arabulucu-${d.ad_soyad.replace(/\s+/g,'_')}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const tamamlandi = d.durum === 'tamamlandi'

  return (
    <div>
      {/* Master Satır */}
      <div className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <span className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{d.ad_soyad}</span>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{d.tc_kimlik}</span>
            <Badge label={`${adimBilgi?.ikon} ${adimBilgi?.adi}`} variant={BADGE_RENK[d.durum] || 'gray'} />
            {proje && <span className="text-xs text-gray-500">📁 {proje.proje_adi}</span>}
            {d.odenecek_tutar && <span className="text-xs font-semibold text-green-700">{fmt(Number(d.odenecek_tutar))}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {d.calistigi_firma && <span className="text-xs text-gray-400">{d.calistigi_firma}</span>}
            {d.cikis_tarihi && <span className="text-xs text-gray-400">Çıkış: {fmtDate(d.cikis_tarihi)}</span>}
            {/* İlerleme çubuğu */}
            <div className="flex items-center gap-1">
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${((adimIdx) / (ADIMLAR.length - 1)) * 100}%` }} />
              </div>
              <span className="text-xs text-gray-400">{adimIdx}/{ADIMLAR.length - 1}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={excelSablon} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50" title="Excel Şablon İndir">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail Panel */}
      {expanded && (
        <div className="bg-slate-50 border-t border-gray-200 px-4 py-5 space-y-5">
          {loadingB ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Süreç Adımları Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Süreç Takibi</h3>
                <div className="flex flex-wrap gap-2">
                  {ADIMLAR.map((adim, i) => {
                    const gecti    = i < adimIdx
                    const aktif    = i === adimIdx
                    const bekliyor = i > adimIdx
                    return (
                      <div key={adim.kodu}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          gecti    ? 'bg-green-100 text-green-700 border-green-200' :
                          aktif    ? 'bg-indigo-100 text-indigo-700 border-indigo-300 ring-2 ring-indigo-200' :
                                     'bg-gray-100 text-gray-400 border-gray-200'
                        }`}>
                        {gecti ? '✓' : adim.ikon} {adim.adi}
                      </div>
                    )
                  })}
                </div>

                {/* İlerleme Butonları */}
                <div className="flex gap-2 mt-3">
                  {!tamamlandi && adimIdx < ADIMLAR.length - 1 && (
                    <button onClick={adimIlerlet} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {ADIMLAR[adimIdx + 1]?.adi} →
                    </button>
                  )}
                  {adimIdx > 0 && (
                    <button onClick={adimGeriAl} disabled={saving}
                      className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">
                      ← Geri Al
                    </button>
                  )}
                </div>
              </div>

              {/* Nüsha Takibi */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Nüsha Takibi</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { alan: 'nüsha_avukat',    etiket: 'Avukatta',    deger: d['nüsha_avukat']    },
                    { alan: 'nüsha_ana_firma',  etiket: 'Ana Firmada', deger: d['nüsha_ana_firma']  },
                    { alan: 'nüsha_bizde',      etiket: 'Bizde',       deger: d['nüsha_bizde']      },
                  ].map(n => (
                    <button key={n.alan}
                      onClick={() => nushaGuncelle(n.alan, !n.deger)}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${n.deger ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                      {n.deger ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      {n.etiket}
                    </button>
                  ))}
                </div>
              </div>

              {/* Belgeler */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Belgeler ({belgeler.length})
                  </h3>
                  <Btn size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => setBelgeModal(true)}>
                    Belge Yükle
                  </Btn>
                </div>

                {belgeler.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Henüz belge yüklenmedi</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {belgeler.map(b => {
                      const adim = ADIMLAR.find(a => a.kodu === b.adim_kodu)
                      return (
                        <div key={b.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3 py-2.5 group hover:border-indigo-300 transition-colors">
                          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">{b.dosya_adi}</p>
                            <p className="text-xs text-gray-400">{adim ? `${adim.ikon} ${adim.adi}` : b.belge_turu}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={() => belgeOnizle(b)} className="p-1 text-gray-400 hover:text-blue-600"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => belgeIndir(b)} className="p-1 text-gray-400 hover:text-green-600"><Download className="w-3.5 h-3.5" /></button>
                            <button onClick={() => belgeSil(b)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Belge Yükleme Modal */}
      {belgeModal && (
        <Modal title="Belge Yükle" onClose={() => setBelgeModal(false)} size="sm"
          footer={<Btn variant="secondary" onClick={() => setBelgeModal(false)}>Kapat</Btn>}>
          <div className="space-y-4">
            <Field label="Belge Türü">
              <select value={belgeForm.belge_turu}
                onChange={e => setBelgeForm(p => ({ ...p, belge_turu: e.target.value }))}
                className={inputCls}>
                <option value="imzali_belge">İmzalı Belge</option>
                <option value="avukat_belgesi">Avukat Belgesi</option>
                <option value="ana_firma_belgesi">Ana Firma Belgesi</option>
                <option value="sablon_excel">Şablon (Excel)</option>
                <option value="diger">Diğer</option>
              </select>
            </Field>
            <Field label="Süreç Adımı">
              <select value={belgeForm.adim_kodu}
                onChange={e => setBelgeForm(p => ({ ...p, adim_kodu: e.target.value }))}
                className={inputCls}>
                <option value="">Mevcut Adım ({adimBilgi?.adi})</option>
                {ADIMLAR.map(a => <option key={a.kodu} value={a.kodu}>{a.ikon} {a.adi}</option>)}
              </select>
            </Field>
            <Field label="Açıklama">
              <input type="text" value={belgeForm.aciklama}
                onChange={e => setBelgeForm(p => ({ ...p, aciklama: e.target.value }))}
                className={inputCls} placeholder="İsteğe bağlı..." />
            </Field>
            <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
              onChange={handleUpload} className="hidden" id={`arabulucu-up-${d.id}`} />
            <label htmlFor={`arabulucu-up-${d.id}`}
              className={`flex flex-col items-center justify-center gap-3 w-full py-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploading ? 'border-gray-300 bg-gray-50' : 'border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400'}`}>
              {uploading ? (
                <><div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm text-gray-500">Yükleniyor...</span></>
              ) : (
                <><div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center"><Upload className="w-6 h-6 text-indigo-600" /></div><p className="text-sm font-semibold text-indigo-700">PDF / Belge Seç</p></>
              )}
            </label>
          </div>
        </Modal>
      )}

      {/* Önizleme */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm truncate">{preview.adi}</span>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {preview.adi.toLowerCase().endsWith('.pdf')
                ? <iframe src={preview.url} className="w-full h-[70vh] rounded border" title={preview.adi} />
                : <img src={preview.url} alt={preview.adi} className="max-w-full mx-auto rounded" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
