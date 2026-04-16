'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  Scale, Plus, Edit, Trash2, Search, AlertTriangle,
  CheckCircle, Clock, ChevronDown, ChevronRight,
  Upload, Eye, Download, X, FileText, Printer
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, StatCard, Card, Modal, Btn, Field,
  inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate
} from '@/components/ui'
import type { AppCtx } from '@/app/page'

// ─── Sabitler ────────────────────────────────────────────────
const DURUMLAR: Record<string, { l: string; v: 'red'|'yellow'|'green'|'blue'|'gray' }> = {
  aktif:       { l: 'Aktif',          v: 'red'    },
  odeme_plani: { l: 'Ödeme Planında', v: 'yellow' },
  kapandi:     { l: 'Kapandı',        v: 'green'  },
  itiraz:      { l: 'İtiraz',         v: 'blue'   },
}
const TIPLER = [
  { v: 'ilamsiz', l: 'İlamsız' }, { v: 'ilamli', l: 'İlamlı' },
  { v: 'haciz',   l: 'Haciz'   }, { v: 'nafaka', l: 'Nafaka' },
  { v: 'diger',   l: 'Diğer'   },
]
const BELGE_TURLERI = [
  { v: 'tebligat',    l: 'Tebligat',    icon: '📬' },
  { v: 'ust_yazi',    l: 'Üst Yazı',    icon: '📄' },
  { v: 'cevap_yazisi',l: 'Cevap Yazısı',icon: '✉️'  },
  { v: 'diger',       l: 'Diğer',       icon: '📎' },
]

const emptyForm = {
  personel_id: '', icra_tipi: 'ilamsiz', dosya_no: '', icra_dairesi: '',
  alacakli: '', toplam_borc: '', aylik_kesinti: '0',
  baslangic_tarihi: '', bitis_tarihi: '', durum: 'aktif',
  avukat_adi: '', avukat_telefon: '', notlar: '',
  personel_cikis_tarihi: '',
  // Manuel giriş
  manuel_personel_adi: '',
  manuel_tc_kimlik: '',
  personel_giris_tipi: 'liste' as 'liste' | 'manuel',
}

// ─── Word Belgesi Oluştur ─────────────────────────────────────
function wordIcraYazisi(icra: any, personel: any, firma: any): string {
  const bugun = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
  const devamMi = personel?.aktif !== false && !icra.personel_cikis_tarihi
  const cikis = personel?.isten_cikis_tarihi
    ? new Date(personel.isten_cikis_tarihi).toLocaleDateString('tr-TR')
    : icra.personel_cikis_tarihi
    ? new Date(icra.personel_cikis_tarihi).toLocaleDateString('tr-TR')
    : null

  const durum = devamMi
    ? `Adı geçen şahıs firmamızda çalışmaya DEVAM ETMEKTEDİR. BİR SONRAKİ MAAŞINDAN 1/4 ORANINDA KESİNTİ YAPILARAK ${icra.dosya_no} SAYILI DOSYA NUMARASINA AKTARILACAKTIR.`
    : `Adı geçen şahıs ${cikis ? cikis + ' tarihinde' : ''} firmamızdan AYRILMIŞTIR. Hizmet akdi sona ermiştir.`

  return `
${firma.ad.toUpperCase()}
${bugun}

${icra.icra_dairesi || 'İCRA DAİRESİ'} MÜDÜRLÜĞÜNE

Dosya No: ${icra.dosya_no}
Alacaklı: ${icra.alacakli || '-'}

İlgi: ${icra.dosya_no} sayılı icra dosyası.

Müdürlüğünüzün yukarıda belirtilen dosyası kapsamında borçlu ${personel?.ad_soyad || '-'} hakkında tarafımıza tebligat yapılmış olup aşağıdaki bilgileri arz ederiz.

BORÇLU BİLGİLERİ:
Ad Soyad    : ${personel?.ad_soyad || '-'}
TC Kimlik   : ${personel?.tc_kimlik || '-'}
Pozisyon    : ${personel?.pozisyon || '-'}

ÇALIŞMA DURUMU:
${durum}

BORÇ BİLGİLERİ:
Toplam Borç    : ${fmt(Number(icra.toplam_borc))}
Ödenen Tutar   : ${fmt(Number(icra.odenen_tutar || 0))}
Kalan Borç     : ${fmt(Number(icra.kalan_borc || icra.toplam_borc))}
Aylık Kesinti  : ${fmt(Number(icra.aylik_kesinti))}

Bilgilerinize saygıyla arz ederiz.

${firma.ad}
Tarih: ${bugun}
  `.trim()
}

// ─── Ana Modül ────────────────────────────────────────────────
export default function IcraModule({ firma }: AppCtx) {
  const [data, setData]           = useState<any[]>([])
  const [personeller, setPersoneller] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [durumF, setDurumF]       = useState('hepsi')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState<any | null>(null)
  const [delId, setDelId]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(emptyForm)
  // Yeni kayıt sırasında belge yükleme için geçici state
  const [yeniKayitId, setYeniKayitId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [i, p] = await Promise.all([
      supabase.from('icra_v2')
        .select('*, personeller(id, ad_soyad, tc_kimlik, pozisyon, aktif, isten_cikis_tarihi)')
        .eq('firma_id', firma.id)
        .order('created_at', { ascending: false }),
      supabase.from('personeller').select('id, ad_soyad, tc_kimlik').eq('firma_id', firma.id).eq('aktif', true).order('ad_soyad'),
    ])
    setData(i.data || [])
    setPersoneller(p.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  const filtered = useMemo(() => data.filter(r => {
    if (durumF !== 'hepsi' && r.durum !== durumF) return false
    if (search) {
      const q = search.toLowerCase()
      return r.dosya_no?.toLowerCase().includes(q) ||
        r.alacakli?.toLowerCase().includes(q) ||
        r.personeller?.ad_soyad?.toLowerCase().includes(q)
    }
    return true
  }), [data, durumF, search])

  const summary = useMemo(() => ({
    toplam:       data.length,
    aktif:        data.filter(r => r.durum === 'aktif').length,
    toplamBorc:   data.filter(r => r.durum === 'aktif').reduce((s, r) => s + Number(r.kalan_borc || r.toplam_borc || 0), 0),
    aylikKesinti: data.filter(r => r.durum === 'aktif').reduce((s, r) => s + Number(r.aylik_kesinti || 0), 0),
  }), [data])

  function openNew() { setForm(emptyForm); setEditing(null); setModal(true) }
  function openEdit(r: any) {
    setForm({
      personel_id: r.personel_id || '', icra_tipi: r.icra_tipi || 'ilamsiz',
      dosya_no: r.dosya_no || '', icra_dairesi: r.icra_dairesi || '',
      alacakli: r.alacakli || '', toplam_borc: String(r.toplam_borc || ''),
      aylik_kesinti: String(r.aylik_kesinti || '0'),
      baslangic_tarihi: r.baslangic_tarihi || '', bitis_tarihi: r.bitis_tarihi || '',
      durum: r.durum || 'aktif', avukat_adi: r.avukat_adi || '',
      avukat_telefon: r.avukat_telefon || '', notlar: r.notlar || '',
      personel_cikis_tarihi: r.personel_cikis_tarihi || '',
      manuel_personel_adi: r.personel_adi || '',
      manuel_tc_kimlik: r.tc_kimlik || '',
      personel_giris_tipi: r.personel_id ? 'liste' : 'manuel',
    })
    setEditing(r); setModal(true)
  }

  async function save() {
    const isManuel = form.personel_giris_tipi === 'manuel'
    if (!isManuel && !form.personel_id) return alert('Personel seçiniz')
    if (isManuel && !form.manuel_personel_adi) return alert('Personel adı zorunludur')
    if (!form.dosya_no) return alert('Dosya no zorunludur')
    setSaving(true)
    const toplam = Number(form.toplam_borc)
    const seciliPersonel = personeller.find(p => p.id === form.personel_id)
    const payload = {
      personel_id:  isManuel ? null : form.personel_id,
      personel_adi: isManuel ? form.manuel_personel_adi : (seciliPersonel?.ad_soyad || ''),
      tc_kimlik:    isManuel ? form.manuel_tc_kimlik || null : (seciliPersonel?.tc_kimlik || null),
      icra_tipi:    form.icra_tipi,
      dosya_no:     form.dosya_no,
      icra_dairesi: form.icra_dairesi || null,
      alacakli:     form.alacakli || null,
      toplam_borc:  toplam,
      odenen_tutar: editing?.odenen_tutar || 0,
      kalan_borc:   toplam - (editing?.odenen_tutar || 0),
      aylik_kesinti: Number(form.aylik_kesinti) || 0,
      baslangic_tarihi: form.baslangic_tarihi || null,
      bitis_tarihi:     form.bitis_tarihi || null,
      durum:            form.durum,
      avukat_adi:       form.avukat_adi || null,
      avukat_telefon:   form.avukat_telefon || null,
      notlar:           form.notlar || null,
      personel_cikis_tarihi: form.personel_cikis_tarihi || null,
    }
    if (editing) {
      const { error } = await supabase.from('icra_v2').update(payload).eq('id', editing.id)
      if (error) alert('Hata: ' + error.message)
      setSaving(false); setModal(false); load()
    } else {
      const { data: newRec, error } = await supabase.from('icra_v2').insert({ ...payload, firma_id: firma.id }).select().single()
      if (error) { alert('Hata: ' + error.message); setSaving(false); return }
      setSaving(false)
      setYeniKayitId(newRec.id) // belge yükleme için ID'yi sakla
      // Modal açık kalsın — belge yükleme adımı gösterilecek
      load()
    }
  }

  const sf = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Scale className="w-5 h-5 text-rose-600" />}
        title="İcra Takibi"
        subtitle="Personel icra dosyaları, belgeler ve ödeme takibi"
        iconBg="bg-rose-50"
        action={<Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni İcra Kaydı</Btn>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Toplam Dosya"  value={summary.toplam}                    color="text-gray-700" />
        <StatCard label="Aktif Dosya"   value={summary.aktif}                     color="text-red-600" />
        <StatCard label="Kalan Borç"    value={fmt(summary.toplamBorc)}           color="text-red-600" />
        <StatCard label="Aylık Kesinti" value={fmt(summary.aylikKesinti)}         color="text-orange-600" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Dosya no, personel veya alacaklı..."
              value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`} />
          </div>
          <select value={durumF} onChange={e => setDurumF(e.target.value)} className={inputCls + ' w-auto'}>
            <option value="hepsi">Tüm Durumlar</option>
            {Object.entries(DURUMLAR).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
        </div>
      </Card>

      {/* Master Grid */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Scale className="w-10 h-10" />} message="İcra kaydı bulunamadı" />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(r => (
              <IcraSatiri
                key={r.id}
                icra={r}
                firma={firma}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                onEdit={() => openEdit(r)}
                onDelete={() => setDelId(r.id)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      {modal && (
        <Modal
          title={
            yeniKayitId
              ? '✓ Kayıt Oluşturuldu — Belge Yükle'
              : editing ? 'İcra Kaydı Düzenle' : 'Yeni İcra Kaydı'
          }
          onClose={() => { setModal(false); setYeniKayitId(null) }}
          size="lg"
          footer={
            yeniKayitId ? (
              <Btn onClick={() => { setModal(false); setYeniKayitId(null) }}>Tamamla</Btn>
            ) : (
              <><Btn variant="secondary" onClick={() => { setModal(false); setYeniKayitId(null) }}>İptal</Btn>
              <Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet ve Belge Yükle'}</Btn></>
            )
          }>

          {/* Belge yükleme adımı — kayıt oluşturulduktan sonra */}
          {yeniKayitId ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-semibold text-green-800">İcra kaydı oluşturuldu!</p>
                  <p className="text-sm text-green-600">Tebligat ve üst yazıyı hemen yükleyebilirsiniz.</p>
                </div>
              </div>

              {[
                { v: 'tebligat',  l: 'Tebligat',  icon: '📬', aciklama: 'İcra dairesinden gelen tebligat belgesi (PDF)' },
                { v: 'ust_yazi',  l: 'Üst Yazı',  icon: '📄', aciklama: 'İcra dairesine gönderilecek üst yazı (PDF/DOC)' },
              ].map(bt => (
                <div key={bt.v} className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-rose-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="text-xl">{bt.icon}</span>{bt.l}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{bt.aciklama}</p>
                    </div>
                  </div>
                  <BelgeYukleInline icraId={yeniKayitId} firmaId={firma.id} belgeTuru={bt.v} />
                </div>
              ))}

              <p className="text-xs text-gray-400 text-center pt-2">
                💡 Belgeleri daha sonra da yükleyebilirsiniz. Satıra tıklayarak detay panelinden erişebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Personel</label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, personel_giris_tipi: 'liste', manuel_personel_adi: '', manuel_tc_kimlik: '' }))}
                    className={`px-3 py-1.5 font-medium transition-colors ${form.personel_giris_tipi === 'liste' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Listeden Seç
                  </button>
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, personel_giris_tipi: 'manuel', personel_id: '' }))}
                    className={`px-3 py-1.5 font-medium transition-colors ${form.personel_giris_tipi === 'manuel' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Manuel Gir
                  </button>
                </div>
              </div>

              {form.personel_giris_tipi === 'liste' ? (
                <select value={form.personel_id} onChange={sf('personel_id')} className={inputCls}>
                  <option value="">Personel Seçiniz</option>
                  {personeller.map(p => <option key={p.id} value={p.id}>{p.ad_soyad}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ad Soyad <span className="text-red-500">*</span></label>
                    <input type="text" value={form.manuel_personel_adi}
                      onChange={e => setForm(p => ({ ...p, manuel_personel_adi: e.target.value }))}
                      className={inputCls} placeholder="Personel adı soyadı" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">TC Kimlik No</label>
                    <input type="text" value={form.manuel_tc_kimlik}
                      onChange={e => setForm(p => ({ ...p, manuel_tc_kimlik: e.target.value }))}
                      className={inputCls} placeholder="12345678901" maxLength={11} />
                  </div>
                </div>
              )}
            </div>            <Field label="İcra Tipi">
              <select value={form.icra_tipi} onChange={sf('icra_tipi')} className={inputCls}>
                {TIPLER.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <Field label="Dosya No" required>
              <input type="text" value={form.dosya_no} onChange={sf('dosya_no')} className={inputCls} />
            </Field>
            <Field label="İcra Dairesi">
              <input type="text" value={form.icra_dairesi} onChange={sf('icra_dairesi')} className={inputCls} />
            </Field>
            <Field label="Alacaklı">
              <input type="text" value={form.alacakli} onChange={sf('alacakli')} className={inputCls} />
            </Field>
            <Field label="Toplam Borç (₺)" required>
              <input type="number" step="0.01" value={form.toplam_borc} onChange={sf('toplam_borc')} className={inputCls} />
            </Field>
            <Field label="Aylık Kesinti (₺)">
              <input type="number" step="0.01" value={form.aylik_kesinti} onChange={sf('aylik_kesinti')} className={inputCls} />
            </Field>
            <Field label="Başlangıç Tarihi">
              <input type="date" value={form.baslangic_tarihi} onChange={sf('baslangic_tarihi')} className={inputCls} />
            </Field>
            <Field label="Bitiş Tarihi">
              <input type="date" value={form.bitis_tarihi} onChange={sf('bitis_tarihi')} className={inputCls} />
            </Field>

            {/* Personel işten ayrıldıysa çıkış tarihi */}
            <Field label="Personel İşten Çıkış Tarihi" className="md:col-span-2">
              <div className="flex items-center gap-3">
                <input type="date" value={form.personel_cikis_tarihi}
                  onChange={sf('personel_cikis_tarihi')} className={inputCls} />
                {form.personel_cikis_tarihi && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg whitespace-nowrap">
                    ✗ Ayrıldı — yazıda otomatik kullanılacak
                  </span>
                )}
                {!form.personel_cikis_tarihi && (
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg whitespace-nowrap">
                    ✓ Devam Ediyor — boş bırakın
                  </span>
                )}
              </div>
            </Field>

            <Field label="Durum">
              <select value={form.durum} onChange={sf('durum')} className={inputCls}>
                {Object.entries(DURUMLAR).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
            </Field>
            <Field label="Avukat Adı">
              <input type="text" value={form.avukat_adi} onChange={sf('avukat_adi')} className={inputCls} />
            </Field>
            <Field label="Avukat Telefon">
              <input type="text" value={form.avukat_telefon} onChange={sf('avukat_telefon')} className={inputCls} />
            </Field>
            <Field label="Notlar" className="md:col-span-2">
              <textarea rows={2} value={form.notlar} onChange={sf('notlar')} className={inputCls} />
            </Field>
            </div>
          )}
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu icra kaydını silmek istediğinize emin misiniz?"
          onConfirm={async () => { await supabase.from('icra_v2').delete().eq('id', delId); setDelId(null); load() }}
          onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}

// ─── İcra Satırı (Master + Detail) ───────────────────────────
interface IcraSatiriProps {
  icra: any
  firma: { id: string; ad: string }
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

function IcraSatiri({ icra, firma, expanded, onToggle, onEdit, onDelete, onRefresh }: IcraSatiriProps) {
  const [odemeler, setOdemeler]   = useState<any[]>([])
  const [belgeler, setBelgeler]   = useState<any[]>([])
  const [loadingD, setLoadingD]   = useState(false)
  const [odemeModal, setOdemeModal] = useState(false)
  const [odemeForm, setOdemeForm] = useState({ odeme_tarihi: new Date().toISOString().split('T')[0], tutar: '', aciklama: '' })
  const [savingOdeme, setSavingOdeme] = useState(false)
  const [wordModal, setWordModal] = useState(false)
  const [wordText, setWordText]   = useState('')

  const personel = icra.personeller
  // personel_adi: join'den gelen ad veya tabloda saklanan ad
  const personelAdi = personel?.ad_soyad || icra.personel_adi || '-'
  const durum    = DURUMLAR[icra.durum] || DURUMLAR.aktif
  const devamMi  = personel?.aktif !== false && !icra.personel_cikis_tarihi

  useEffect(() => {
    if (expanded && odemeler.length === 0) loadDetail()
  }, [expanded])

  async function loadDetail() {
    setLoadingD(true)
    const [o, b] = await Promise.all([
      supabase.from('icra_v2_odemeler').select('*').eq('icra_id', icra.id).order('odeme_tarihi', { ascending: false }),
      supabase.from('icra_v2_belgeler').select('*').eq('icra_id', icra.id).order('created_at', { ascending: false }),
    ])
    setOdemeler(o.data || [])
    setBelgeler(b.data || [])
    setLoadingD(false)
  }

  const toplamOdenen = useMemo(() =>
    odemeler.reduce((s, o) => s + Number(o.tutar), 0)
  , [odemeler])

  const kalanBorc = Number(icra.toplam_borc || 0) - toplamOdenen

  async function odemeEkle() {
    if (!odemeForm.tutar) return alert('Tutar zorunludur')
    setSavingOdeme(true)
    const tutar = Number(odemeForm.tutar)
    await supabase.from('icra_v2_odemeler').insert({
      icra_id: icra.id, firma_id: firma.id,
      odeme_tarihi: odemeForm.odeme_tarihi,
      tutar, aciklama: odemeForm.aciklama || null,
    })
    // Ana kayıttaki odenen_tutar ve kalan_borc güncelle
    const yeniOdenen = toplamOdenen + tutar
    const yeniKalan  = Number(icra.toplam_borc) - yeniOdenen
    await supabase.from('icra_v2').update({
      odenen_tutar: yeniOdenen,
      kalan_borc:   yeniKalan,
      durum: yeniKalan <= 0 ? 'kapandi' : icra.durum,
    }).eq('id', icra.id)
    setSavingOdeme(false)
    setOdemeModal(false)
    setOdemeForm({ odeme_tarihi: new Date().toISOString().split('T')[0], tutar: '', aciklama: '' })
    loadDetail()
    onRefresh()
  }

  async function odemeDelete(id: string) {
    if (!confirm('Bu ödemeyi silmek istediğinize emin misiniz?')) return
    const silinecek = odemeler.find(o => o.id === id)
    await supabase.from('icra_v2_odemeler').delete().eq('id', id)
    if (silinecek) {
      const yeniOdenen = toplamOdenen - Number(silinecek.tutar)
      await supabase.from('icra_v2').update({
        odenen_tutar: yeniOdenen,
        kalan_borc:   Number(icra.toplam_borc) - yeniOdenen,
      }).eq('id', icra.id)
    }
    loadDetail(); onRefresh()
  }

  function wordHazirla() {
    const text = wordIcraYazisi(icra, { ...personel, ad_soyad: personelAdi }, firma)
    setWordText(text)
    setWordModal(true)
  }

  async function wordIndir() {
    try {
      const { icraWordIndir } = await import('@/lib/icraWord')
      await icraWordIndir({
        firma,
        icra: {
          dosya_no:             icra.dosya_no,
          icra_dairesi:         icra.icra_dairesi,
          alacakli:             icra.alacakli,
          toplam_borc:          Number(icra.toplam_borc || 0),
          odenen_tutar:         Number(icra.odenen_tutar || 0),
          kalan_borc:           Number(icra.kalan_borc || icra.toplam_borc || 0),
          aylik_kesinti:        Number(icra.aylik_kesinti || 0),
          baslangic_tarihi:     icra.baslangic_tarihi,
          personel_cikis_tarihi: icra.personel_cikis_tarihi,
        },
        personel: {
          ad_soyad:             personelAdi,
          tc_kimlik:            personel?.tc_kimlik || icra.tc_kimlik || icra.manuel_tc_kimlik,
          pozisyon:             personel?.pozisyon,
          aktif:                personel?.aktif,
          isten_cikis_tarihi:   personel?.isten_cikis_tarihi,
        },
      })
    } catch (err: any) {
      alert('Word oluşturma hatası: ' + (err?.message || err))
    }
  }

  return (
    <div>
      {/* Master Satır */}
      <div className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <span className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{personelAdi}</span>
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{icra.dosya_no}</span>
            <Badge label={durum.l} variant={durum.v} />

            {/* Çalışma durumu rozeti */}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${devamMi ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {devamMi ? '✓ Devam Ediyor' : `✗ Ayrıldı${icra.personel_cikis_tarihi ? ' · ' + fmtDate(icra.personel_cikis_tarihi) : personel?.isten_cikis_tarihi ? ' · ' + fmtDate(personel.isten_cikis_tarihi) : ''}`}
            </span>

            <span className="text-xs text-gray-500">Kalan: <strong className="text-red-600">{fmt(kalanBorc > 0 ? kalanBorc : Number(icra.kalan_borc || 0))}</strong></span>
          </div>
          {icra.alacakli && <p className="text-xs text-gray-400 mt-0.5">Alacaklı: {icra.alacakli}</p>}
        </div>

        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={wordHazirla} className="p-1.5 text-gray-400 hover:text-blue-600" title="Yazı Hazırla">
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail Panel */}
      {expanded && (
        <div className="bg-slate-50 border-t border-gray-200 px-4 py-5 space-y-5">
          {loadingD ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Borç Özeti */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { l: 'Toplam Borç',    v: fmt(Number(icra.toplam_borc)),  c: 'text-gray-900' },
                  { l: 'Ödenen',         v: fmt(toplamOdenen),              c: 'text-green-600' },
                  { l: 'Kalan Borç',     v: fmt(Math.max(0, kalanBorc)),    c: 'text-red-600'   },
                  { l: 'Aylık Kesinti',  v: fmt(Number(icra.aylik_kesinti)),c: 'text-orange-600'},
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">{s.l}</p>
                    <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
                  </div>
                ))}
              </div>

              {/* İki Kolon: Ödemeler + Belgeler */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Aylık Ödemeler */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <span className="font-semibold text-sm text-gray-900">Aylık Ödemeler</span>
                    <Btn size="sm" icon={<Plus className="w-3 h-3" />} onClick={() => setOdemeModal(true)}>Ödeme Ekle</Btn>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {odemeler.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Ödeme kaydı yok</p>
                    ) : odemeler.map(o => (
                      <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-green-700">{fmt(Number(o.tutar))}</p>
                          <p className="text-xs text-gray-500">{fmtDate(o.odeme_tarihi)}{o.aciklama ? ' · ' + o.aciklama : ''}</p>
                        </div>
                        <button onClick={() => odemeDelete(o.id)} className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Belgeler */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <span className="font-semibold text-sm text-gray-900">Belgeler</span>
                    <span className="text-xs text-gray-400">Tebligat · Üst Yazı · Cevap</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {BELGE_TURLERI.map(bt => {
                      const turBelgeler = belgeler.filter(b => b.belge_turu === bt.v)
                      return (
                        <div key={bt.v} className="border border-gray-100 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                            <span className="text-xs font-semibold text-gray-700">{bt.icon} {bt.l}</span>
                            <BelgeYukle icraId={icra.id} firmaId={firma.id} belgeTuru={bt.v} onUploaded={loadDetail} />
                          </div>
                          {turBelgeler.map(b => (
                            <BelgeItem key={b.id} belge={b} onDelete={loadDetail} />
                          ))}
                          {turBelgeler.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-2">Belge yüklenmedi</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Ödeme Ekle Modal */}
      {odemeModal && (
        <Modal title="Ödeme Ekle" onClose={() => setOdemeModal(false)} size="sm"
          footer={<><Btn variant="secondary" onClick={() => setOdemeModal(false)}>İptal</Btn><Btn onClick={odemeEkle} disabled={savingOdeme}>{savingOdeme ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <Field label="Ödeme Tarihi" required>
              <input type="date" value={odemeForm.odeme_tarihi}
                onChange={e => setOdemeForm(p => ({ ...p, odeme_tarihi: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Tutar (₺)" required>
              <input type="number" step="0.01" value={odemeForm.tutar}
                onChange={e => setOdemeForm(p => ({ ...p, tutar: e.target.value }))} className={inputCls} placeholder="0.00" />
            </Field>
            <Field label="Açıklama">
              <input type="text" value={odemeForm.aciklama}
                onChange={e => setOdemeForm(p => ({ ...p, aciklama: e.target.value }))} className={inputCls} />
            </Field>
            <div className="bg-orange-50 rounded-lg p-3 flex justify-between">
              <span className="text-sm text-gray-600">Bu ödemeden sonra kalan:</span>
              <span className="font-bold text-orange-700">
                {fmt(Math.max(0, kalanBorc - Number(odemeForm.tutar || 0)))}
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* Word Yazı Modal */}
      {wordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">İcra Dairesi Yazısı</h2>
              <div className="flex gap-2">
                <Btn size="sm" icon={<Download className="w-4 h-4" />} onClick={wordIndir}>Word İndir (.docx)</Btn>
                <button onClick={() => setWordModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <textarea
                value={wordText}
                onChange={e => setWordText(e.target.value)}
                className="w-full h-96 font-mono text-sm border border-gray-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-2">Metni düzenleyebilir, ardından Word olarak indirebilirsiniz.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Belge Yükleme (Modal içi — anlık liste) ─────────────────
function BelgeYukleInline({ icraId, firmaId, belgeTuru }: { icraId: string; firmaId: string; belgeTuru: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [yuklenenler, setYuklenenler] = useState<string[]>([])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const safeName = file.name
      .replace(/[ğ]/g,'g').replace(/[Ğ]/g,'G').replace(/[ü]/g,'u').replace(/[Ü]/g,'U')
      .replace(/[ş]/g,'s').replace(/[Ş]/g,'S').replace(/[ı]/g,'i').replace(/[İ]/g,'I')
      .replace(/[ö]/g,'o').replace(/[Ö]/g,'O').replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
      .replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const path = `${firmaId}/${icraId}/${belgeTuru}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('icra-belgeler').upload(path, file)
    if (error) { alert('Yükleme hatası: ' + error.message); setUploading(false); return }
    await supabase.from('icra_v2_belgeler').insert({
      icra_id: icraId, firma_id: firmaId, belge_turu: belgeTuru,
      belge_tarihi: new Date().toISOString().split('T')[0],
      dosya_adi: file.name, storage_path: path,
    })
    setYuklenenler(p => [...p, file.name])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFile} className="hidden" id={`inline-up-${icraId}-${belgeTuru}`} />
      <label htmlFor={`inline-up-${icraId}-${belgeTuru}`}
        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-sm font-medium ${uploading ? 'border-gray-300 text-gray-400' : 'border-rose-300 text-rose-600 hover:bg-rose-50'}`}>
        {uploading
          ? <><div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />Yükleniyor...</>
          : <><Upload className="w-4 h-4" />PDF / Belge Yükle</>}
      </label>
      {yuklenenler.map((ad, i) => (
        <div key={i} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-xs text-green-700 truncate">{ad}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Belge Yükleme ────────────────────────────────────────────
function BelgeYukle({ icraId, firmaId, belgeTuru, onUploaded }: { icraId: string; firmaId: string; belgeTuru: string; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const safeName = file.name
      .replace(/[ğ]/g,'g').replace(/[Ğ]/g,'G').replace(/[ü]/g,'u').replace(/[Ü]/g,'U')
      .replace(/[ş]/g,'s').replace(/[Ş]/g,'S').replace(/[ı]/g,'i').replace(/[İ]/g,'I')
      .replace(/[ö]/g,'o').replace(/[Ö]/g,'O').replace(/[ç]/g,'c').replace(/[Ç]/g,'C')
      .replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_')
    const ext  = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${firmaId}/${icraId}/${belgeTuru}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('icra-belgeler').upload(path, file)
    if (error) { alert('Yükleme hatası: ' + error.message); setUploading(false); return }
    await supabase.from('icra_v2_belgeler').insert({
      icra_id: icraId, firma_id: firmaId, belge_turu: belgeTuru,
      belge_tarihi: new Date().toISOString().split('T')[0],
      dosya_adi: file.name, storage_path: path,
    })
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    onUploaded()
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFile} className="hidden" id={`icra-up-${icraId}-${belgeTuru}`} />
      <label htmlFor={`icra-up-${icraId}-${belgeTuru}`}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded cursor-pointer transition-colors ${uploading ? 'text-gray-400' : 'text-rose-600 hover:bg-rose-50'}`}>
        {uploading ? <div className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-3 h-3" />}
        {uploading ? 'Yükleniyor' : 'Yükle'}
      </label>
    </>
  )
}

// ─── Belge Satırı ─────────────────────────────────────────────
function BelgeItem({ belge, onDelete }: { belge: any; onDelete: () => void }) {
  async function download() {
    const { data } = await supabase.storage.from('icra-belgeler').createSignedUrl(belge.storage_path, 60)
    if (data?.signedUrl) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = belge.dosya_adi; a.click() }
  }
  async function del() {
    if (!confirm(`"${belge.dosya_adi}" silinsin mi?`)) return
    await supabase.storage.from('icra-belgeler').remove([belge.storage_path])
    await supabase.from('icra_v2_belgeler').delete().eq('id', belge.id)
    onDelete()
  }
  const ICONS: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', jpg: '🖼', jpeg: '🖼', png: '🖼' }
  const ext  = belge.dosya_adi.split('.').pop()?.toLowerCase() || ''
  const icon = ICONS[ext] || '📎'
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 group">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <span className="text-xs text-gray-700 truncate flex-1 min-w-0" title={belge.dosya_adi}>{belge.dosya_adi}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={download} className="p-0.5 text-gray-400 hover:text-green-600"><Download className="w-3 h-3" /></button>
        <button onClick={del}      className="p-0.5 text-gray-400 hover:text-red-500"><Trash2   className="w-3 h-3" /></button>
      </div>
    </div>
  )
}
