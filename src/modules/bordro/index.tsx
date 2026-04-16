'use client'
import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  FileText, Plus, ChevronRight, ChevronDown,
  Upload, CheckCircle, Clock, AlertTriangle, Loader2,
  FolderOpen, Users, Trash2, Eye, Download, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, StatCard, Card, Modal, Btn,
  Field, inputCls, ConfirmDialog, Badge, EmptyState, fmt, fmtDate
} from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type {
  BordroDonemiDetay, BordroSurecAdim, BordroBelge,
  SurecAdimKodu, SurecDurum, Proje, Ekip
} from '@/types'

// ─── Sabitler ────────────────────────────────────────────────
const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

const SUREC_ADIMLARI: { kodu: SurecAdimKodu; adi: string; aciklama: string; kabul: string }[] = [
  {
    kodu: 'puantaj_toplama',
    adi: 'Puantaj Toplama',
    aciklama: 'Şantiyelerden puantaj listelerini topla ve yükle',
    kabul: '.pdf,.xlsx,.xls,.jpg,.jpeg,.png',
  },
  {
    kodu: 'bordro_hazirlama',
    adi: 'Bordro Hazırlama',
    aciklama: 'Hazırlanan bordro listesini yükle',
    kabul: '.pdf,.xlsx,.xls',
  },
  {
    kodu: 'maas_odeme',
    adi: 'Maaş Ödeme Listesi',
    aciklama: 'Ekip bazlı maaş ödeme listesini yükle',
    kabul: '.pdf,.xlsx,.xls',
  },
  {
    kodu: 'dekont_yukleme',
    adi: 'Dekont Yükleme',
    aciklama: 'Ödeme dekontlarını yükle',
    kabul: '.pdf,.xlsx,.xls,.jpg,.jpeg,.png',
  },
]

const DURUM_CFG: Record<SurecDurum, { l: string; v: 'gray'|'yellow'|'green'|'orange'; icon: React.ElementType }> = {
  bekliyor:    { l: 'Bekliyor',     v: 'gray',   icon: Clock         },
  devam:       { l: 'Devam Ediyor', v: 'yellow', icon: Loader2       },
  tamamlandi:  { l: 'Tamamlandı',   v: 'green',  icon: CheckCircle   },
  uyari:       { l: 'Uyarı',        v: 'orange', icon: AlertTriangle },
}

// Önceki ayı hesapla
function oncekiAy() {
  const now = new Date()
  const ay  = now.getMonth() === 0 ? 12 : now.getMonth()
  const yil = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  return { ay, yil, adi: `${AYLAR[ay - 1]} ${yil}` }
}

// ─── Ana Bileşen ─────────────────────────────────────────────
export default function BordroModule({ firma }: AppCtx) {
  const [donemler, setDonemler]   = useState<BordroDonemiDetay[]>([])
  const [projeler, setProjeler]   = useState<Pick<Proje, 'id'|'proje_adi'>[]>([])
  const [ekipler, setEkipler]     = useState<Ekip[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [modal, setModal]         = useState(false)
  const [delId, setDelId]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  const prev = oncekiAy()
  const [form, setForm] = useState({
    donem_adi: prev.adi,
    proje_id: '',
    secili_ekipler: [] as string[], // birden fazla ekip
    ay: String(prev.ay),
    yil: String(prev.yil),
    baslangic_tarihi: `${prev.yil}-${String(prev.ay).padStart(2,'0')}-01`,
    bitis_tarihi: '',
    bordro_tarihi: '',
    aciklama: '',
  })

  async function load() {
    setLoading(true)
    const [d, p, e] = await Promise.all([
      supabase
        .from('bordro_donemleri')
        .select('*, projeler(proje_adi), ekipler(ad)')
        .eq('firma_id', firma.id)
        .order('yil', { ascending: false })
        .order('ay',  { ascending: false }),
      supabase.from('projeler').select('id, proje_adi').eq('firma_id', firma.id).eq('durum', 'devam'),
      supabase.from('ekipler').select('*').eq('firma_id', firma.id).eq('aktif', true).order('ad'),
    ])
    setDonemler(d.data || [])
    setProjeler(p.data || [])
    setEkipler(e.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [firma.id])

  // Proje değişince ekipleri filtrele
  const filtreliEkipler = useMemo(() =>
    form.proje_id ? ekipler.filter(e => e.proje_id === form.proje_id) : ekipler
  , [ekipler, form.proje_id])
  async function saveDonem() {
    if (!form.donem_adi || !form.proje_id || !form.baslangic_tarihi || !form.bordro_tarihi)
      return alert('Dönem adı, proje, başlangıç ve bordro tarihi zorunludur')
    if (form.secili_ekipler.length === 0)
      return alert('En az bir ekip seçiniz')

    setSaving(true)

    // Her seçili ekip için ayrı dönem oluştur
    for (const ekipId of form.secili_ekipler) {
      const ekip = ekipler.find(e => e.id === ekipId)
      const donemAdi = form.secili_ekipler.length > 1
        ? `${form.donem_adi} — ${(ekip as any)?.ad || ekipId}`
        : form.donem_adi

      const { data: newDonem, error } = await supabase
        .from('bordro_donemleri')
        .insert({
          firma_id:         firma.id,
          donem_adi:        donemAdi,
          proje_id:         form.proje_id,
          ekip_id:          ekipId,
          ay:               Number(form.ay),
          yil:              Number(form.yil),
          onceki_ay:        true,
          baslangic_tarihi: form.baslangic_tarihi,
          bitis_tarihi:     form.bitis_tarihi || form.baslangic_tarihi,
          bordro_tarihi:    form.bordro_tarihi,
          durum:            'hazirlaniyor',
          aciklama:         form.aciklama || null,
        })
        .select()
        .single()

      if (error || !newDonem) { setSaving(false); alert('Hata: ' + error?.message); return }

      // Her dönem için 4 süreç adımı oluştur
      await supabase.from('bordro_surec_adimlari').insert(
        SUREC_ADIMLARI.map((a, i) => ({
          donem_id:  newDonem.id,
          firma_id:  firma.id,
          adim_kodu: a.kodu,
          adim_adi:  a.adi,
          sira:      i + 1,
          durum:     'bekliyor' as SurecDurum,
        }))
      )
    }

    setSaving(false)
    setModal(false)
    load()
  }

  async function deleteDonem(id: string) {
    await supabase.from('bordro_donemleri').delete().eq('id', id)
    setDelId(null)
    if (expanded === id) setExpanded(null)
    load()
  }

  const summary = useMemo(() => ({
    toplam:      donemler.length,
    devam:       donemler.filter(d => d.durum === 'hazirlaniyor').length,
    tamamlandi:  donemler.filter(d => d.durum === 'odendi').length,
  }), [donemler])

  const sf = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileText className="w-5 h-5 text-cyan-600" />}
        title="Bordro Yönetimi"
        subtitle="Proje & ekip bazlı aylık bordro süreç takibi"
        iconBg="bg-cyan-50"
        action={
          <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setModal(true)}>
            Yeni Dönem
          </Btn>
        }
      />

      {/* Özet */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Toplam Dönem"  value={summary.toplam}     color="text-gray-700" />
        <StatCard label="Devam Eden"    value={summary.devam}      color="text-yellow-600" />
        <StatCard label="Tamamlanan"    value={summary.tamamlandi} color="text-green-600" />
      </div>

      {/* Master Grid */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : donemler.length === 0 ? (
          <EmptyState icon={<FileText className="w-12 h-12" />} message="Henüz bordro dönemi yok" />
        ) : (
          <div className="divide-y divide-gray-100">
            {donemler.map(d => (
              <DonemSatir
                key={d.id}
                donem={d}
                firma={firma}
                expanded={expanded === d.id}
                onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
                onDelete={() => setDelId(d.id)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Yeni Dönem Modal */}
      {modal && (
        <Modal
          title="Yeni Bordro Dönemi"
          onClose={() => setModal(false)}
          size="lg"
          footer={
            <>
              <Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn>
              <Btn onClick={saveDonem} disabled={saving}>
                {saving ? 'Oluşturuluyor...' : 'Dönemi Oluştur'}
              </Btn>
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              Dönem oluşturulduğunda <strong>4 süreç adımı</strong> otomatik oluşturulur:
              Puantaj Toplama → Bordro Hazırlama → Maaş Ödeme → Dekont Yükleme
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Ay" required>
                <select value={form.ay} onChange={e => {
                  const ay = e.target.value
                  setForm(p => ({ ...p, ay, donem_adi: `${AYLAR[Number(ay)-1]} ${p.yil}` }))
                }} className={inputCls}>
                  {AYLAR.map((a, i) => <option key={i+1} value={i+1}>{a}</option>)}
                </select>
              </Field>
              <Field label="Yıl" required>
                <select value={form.yil} onChange={e => {
                  const yil = e.target.value
                  setForm(p => ({ ...p, yil, donem_adi: `${AYLAR[Number(p.ay)-1]} ${yil}` }))
                }} className={inputCls}>
                  {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Dönem Adı" required>
              <input type="text" value={form.donem_adi} onChange={sf('donem_adi')} className={inputCls} />
            </Field>

            <Field label="Proje" required>
              <select value={form.proje_id} onChange={e => setForm(p => ({ ...p, proje_id: e.target.value, secili_ekipler: [] }))} className={inputCls}>
                <option value="">Proje Seçiniz</option>
                {projeler.map(p => <option key={p.id} value={p.id}>{p.proje_adi}</option>)}
              </select>
            </Field>

            <Field label="Ekipler" required>
              {!form.proje_id ? (
                <p className="text-sm text-gray-400 py-2">Önce proje seçiniz</p>
              ) : filtreliEkipler.length === 0 ? (
                <p className="text-sm text-amber-600 py-2">Bu projede ekip bulunamadı</p>
              ) : (
                <div className="space-y-2 border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {/* Tümünü seç */}
                  <label className="flex items-center gap-2 pb-2 border-b border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.secili_ekipler.length === filtreliEkipler.length && filtreliEkipler.length > 0}
                      onChange={e => setForm(p => ({
                        ...p,
                        secili_ekipler: e.target.checked ? filtreliEkipler.map(ek => ek.id) : []
                      }))}
                      className="w-4 h-4 text-cyan-600 rounded"
                    />
                    <span className="text-sm font-semibold text-gray-700">Tümünü Seç</span>
                    <span className="text-xs text-gray-400 ml-auto">{filtreliEkipler.length} ekip</span>
                  </label>
                  {filtreliEkipler.map(ekip => (
                    <label key={ekip.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={form.secili_ekipler.includes(ekip.id)}
                        onChange={e => setForm(p => ({
                          ...p,
                          secili_ekipler: e.target.checked
                            ? [...p.secili_ekipler, ekip.id]
                            : p.secili_ekipler.filter(id => id !== ekip.id)
                        }))}
                        className="w-4 h-4 text-cyan-600 rounded"
                      />
                      <span className="text-sm text-gray-800">{(ekip as any).ad || ekip.ekip_adi}</span>
                      {(ekip as any).sorumlu && (
                        <span className="text-xs text-gray-400 ml-auto">{(ekip as any).sorumlu}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {form.secili_ekipler.length > 0 && (
                <p className="text-xs text-cyan-700 mt-1">
                  {form.secili_ekipler.length} ekip seçildi →
                  {form.secili_ekipler.length} ayrı bordro dönemi oluşturulacak
                </p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Dönem Başlangıcı" required>
                <input type="date" value={form.baslangic_tarihi} onChange={sf('baslangic_tarihi')} className={inputCls} />
              </Field>
              <Field label="Dönem Bitişi">
                <input type="date" value={form.bitis_tarihi} onChange={sf('bitis_tarihi')} className={inputCls} />
              </Field>
            </div>

            <Field label="Bordro Tarihi" required>
              <input type="date" value={form.bordro_tarihi} onChange={sf('bordro_tarihi')} className={inputCls} />
            </Field>

            <Field label="Açıklama">
              <textarea rows={2} value={form.aciklama} onChange={sf('aciklama')} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog
          message="Bu bordro dönemini ve tüm belgelerini silmek istediğinize emin misiniz?"
          onConfirm={() => deleteDonem(delId)}
          onCancel={() => setDelId(null)}
        />
      )}
    </div>
  )
}

// ─── Dönem Satırı (Master Row + Detail) ──────────────────────
interface DonemSatirProps {
  donem: BordroDonemiDetay
  firma: { id: string }
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onRefresh: () => void
}

function DonemSatir({ donem, firma, expanded, onToggle, onDelete, onRefresh }: DonemSatirProps) {
  const [adimlari, setAdimlari]   = useState<BordroSurecAdim[]>([])
  const [belgeler, setBelgeler]   = useState<BordroBelge[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [activeAdim, setActiveAdim] = useState<SurecAdimKodu | null>(null)

  useEffect(() => {
    if (expanded && adimlari.length === 0) loadDetail()
  }, [expanded])

  async function loadDetail() {
    setLoadingDetail(true)
    const [a, b] = await Promise.all([
      supabase.from('bordro_surec_adimlari').select('*').eq('donem_id', donem.id).order('sira'),
      supabase.from('bordro_belgeler').select('*').eq('donem_id', donem.id).order('created_at'),
    ])
    setAdimlari(a.data || [])
    setBelgeler(b.data || [])
    setLoadingDetail(false)
  }

  async function updateAdimDurum(adimId: string, durum: SurecDurum) {
    await supabase.from('bordro_surec_adimlari').update({
      durum,
      tamamlanma_tarihi: durum === 'tamamlandi' ? new Date().toISOString() : null,
    }).eq('id', adimId)
    loadDetail()
    onRefresh()
  }

  // ─── Yüklü Excel'den Personel Oluştur (Ekip Bazlı) ──────
  const [personelImporting, setPersonelImporting] = useState(false)

  async function handlePersonelImport() {
    const maasOdemeBelgeleri = belgeler.filter(b =>
      b.adim_kodu === 'maas_odeme' &&
      (b.belge_tipi === 'xlsx' || b.belge_tipi === 'xls' || b.dosya_adi.match(/\.xlsx?$/i))
    )

    if (maasOdemeBelgeleri.length === 0) {
      alert('Maaş Ödeme adımında yüklenmiş Excel belgesi bulunamadı.')
      return
    }

    setPersonelImporting(true)
    try {
      const XLSX = await import('xlsx')

      const { data: mevcutPersonel } = await supabase
        .from('personeller').select('tc_kimlik').eq('firma_id', firma.id)
      const mevcutTCler = new Set((mevcutPersonel || []).map(p => p.tc_kimlik).filter(Boolean))

      const projeId = (donem as any).proje_id || null
      const ekipId  = (donem as any).ekip_id  || null

      // ekip_id yoksa DB'den çek
      let gercekEkipId = ekipId
      if (!gercekEkipId) {
        const { data: donemData } = await supabase.from('bordro_donemleri').select('ekip_id').eq('id', donem.id).single()
        gercekEkipId = donemData?.ekip_id || null
      }
      const normalize = (s: string) => String(s).toLowerCase()
        .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
        .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
        .replace(/[^a-z0-9 ]/g,'').trim()

      let eklendi = 0, atlandi = 0

      for (const belge of maasOdemeBelgeleri) {
        const { data: fileData, error: dlErr } = await supabase.storage
          .from('bordro-belgeler').download(belge.storage_path)
        if (dlErr || !fileData) continue

        const buf = await fileData.arrayBuffer()
        const wb  = XLSX.read(buf, { type: 'array' })

        for (const sayfaAdi of wb.SheetNames) {
          const ws = wb.Sheets[sayfaAdi]
          const tumSatirlar: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

          // Başlık satırını bul (TC + ADI SOYADI)
          let baslikIdx = -1
          let tcIdx = -1, adIdx = -1, gorevIdx = -1, girisIdx = -1, cikisIdx = -1, tutarIdx = -1, ibanIdx = -1

          for (let i = 0; i < tumSatirlar.length; i++) {
            const satir = tumSatirlar[i].map((c: any) => normalize(String(c)))
            const tc = satir.findIndex((c: string) => c.includes('tc') || c.includes('kimlik'))
            const ad = satir.findIndex((c: string) => c.includes('adi') || c.includes('soyadi') || c === 'ad')
            if (tc >= 0 && ad >= 0) {
              baslikIdx = i; tcIdx = tc; adIdx = ad
              gorevIdx = satir.findIndex((c: string) => c.includes('gorev') || c.includes('pozisyon'))
              girisIdx = satir.findIndex((c: string) => c.includes('giris') || c.includes('baslangic'))
              cikisIdx = satir.findIndex((c: string) => c.includes('cikis') || c.includes('bitis'))
              tutarIdx = satir.findIndex((c: string) => c.includes('net') || c.includes('istihkak'))
              ibanIdx  = satir.findIndex((c: string) => c.includes('iban'))
              break
            }
          }

          if (baslikIdx < 0) continue

          // Dönemin ekip adını normalize et
          let donemEkipAdi = ''
          if (gercekEkipId) {
            const { data: ekipData } = await supabase.from('ekipler').select('ad').eq('id', gercekEkipId).single()
            donemEkipAdi = normalize(ekipData?.ad || '')
          }

          // Ekip bloğu filtrelemesi — dönemin ekibiyle eşleşen bloğu bul
          let aktifBlok = !donemEkipAdi // ekip adı yoksa tüm satırları al
          const seciliSatirlar: any[][] = []

          for (let i = baslikIdx + 1; i < tumSatirlar.length; i++) {
            const satir = tumSatirlar[i]
            const satirStr = satir.map((c: any) => String(c)).join(' ')
            const satirNorm = normalize(satirStr)

            // Ekip başlık satırı mı? ("EKİP:" veya "EKİP :" içeriyor)
            if (satirNorm.includes('ekip') && (satirStr.includes(':') || satirStr.includes('|'))) {
              if (donemEkipAdi) {
                // Dönem ekip adının ilk 8 karakteri eşleşiyor mu?
                aktifBlok = satirNorm.includes(donemEkipAdi.substring(0, 8))
              } else {
                aktifBlok = true
              }
              continue
            }

            // Toplam satırı — blok bitti
            if (satirNorm.includes('toplam') && !satirNorm.includes('genel')) {
              if (aktifBlok && donemEkipAdi) aktifBlok = false
              continue
            }

            if (aktifBlok) {
              const tc = String(satir[tcIdx] || '').trim().replace(/\s/g, '')
              const ad = String(satir[adIdx] || '').trim()
              if (tc.length >= 10 && ad.length > 2 && /^\d+$/.test(tc)) {
                seciliSatirlar.push(satir)
              }
            }
          }

          // Eşleşen satır yoksa tüm geçerli satırları al (fallback)
          const islenecekSatirlar = seciliSatirlar.length > 0
            ? seciliSatirlar
            : tumSatirlar.slice(baslikIdx + 1).filter(satir => {
                const tc = String(satir[tcIdx] || '').trim().replace(/\s/g, '')
                const ad = String(satir[adIdx] || '').trim()
                return tc.length >= 10 && ad.length > 2 && /^\d+$/.test(tc)
              })

          for (const satir of islenecekSatirlar) {
            const tc    = String(satir[tcIdx] || '').trim().replace(/\s/g,'')
            const ad    = String(satir[adIdx] || '').trim()
            const gorev = gorevIdx >= 0 ? String(satir[gorevIdx] || '').trim() : ''
            const iban  = ibanIdx  >= 0 ? String(satir[ibanIdx]  || '').trim().toUpperCase() : ''
            const tutar = tutarIdx >= 0 ? parseFloat(String(satir[tutarIdx] || '0').replace(/[^0-9.,]/g,'').replace(',','.')) || null : null

            const parseDate = (idx: number) => {
              if (idx < 0) return null
              const s = String(satir[idx] || '').trim()
              if (!s || s === '—' || s === '-') return null
              const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/)
              return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : null
            }

            if (!tc || !ad) continue
            if (mevcutTCler.has(tc)) {
              // Zaten mevcut — ekibe bağlı mı kontrol et, değilse bağla
              if (gercekEkipId) {
                const { data: mevP } = await supabase
                  .from('personeller').select('id').eq('tc_kimlik', tc).eq('firma_id', firma.id).single()
                if (mevP?.id) {
                  const { data: mevcutBag } = await supabase
                    .from('ekip_personel').select('id').eq('ekip_id', gercekEkipId).eq('personel_id', mevP.id).single()
                  if (!mevcutBag) {
                    await supabase.from('ekip_personel').insert({
                      ekip_id: gercekEkipId, personel_id: mevP.id,
                      baslangic: parseDate(girisIdx), bitis: parseDate(cikisIdx), aktif: true,
                    })
                  }
                }
              }
              atlandi++; continue
            }

            const giris = parseDate(girisIdx)
            const cikis = parseDate(cikisIdx)

            const { error } = await supabase.from('personeller').insert({
              firma_id:            firma.id,
              ad_soyad:            ad,
              tc_kimlik:           tc,
              pozisyon:            gorev || null,
              net_maas:            tutar,
              banka_iban:          iban || null,
              ise_giris_tarihi:    giris,
              isten_cikis_tarihi:  cikis,
              varsayilan_proje_id: projeId,
              maas_tipi:           'aylik',
              aktif:               !cikis,
            })

            if (!error) {
              mevcutTCler.add(tc)
              eklendi++
              // Ekip_personel tablosuna da bağla
              if (gercekEkipId) {
                const { data: yeniP } = await supabase
                  .from('personeller').select('id').eq('tc_kimlik', tc).eq('firma_id', firma.id).single()
                if (yeniP?.id) {
                  const { error: epErr } = await supabase.from('ekip_personel').insert({
                    ekip_id:     gercekEkipId,
                    personel_id: yeniP.id,
                    baslangic:   giris,
                    bitis:       cikis,
                    aktif:       !cikis,
                  })
                  if (epErr) console.error('ekip_personel insert hatası:', epErr.message, { ekip_id: gercekEkipId, personel_id: yeniP.id })
                }
              }
            } else atlandi++
          }
        }
      }

      const ekipBilgi = gercekEkipId ? ` — Ekip bağlandı` : ' — ⚠ Ekip ID bulunamadı, ekip bağlantısı yapılamadı'
      alert(`✓ ${eklendi} yeni personel eklendi${ekipBilgi}\n⟳ ${atlandi} personel zaten mevcut veya hatalı (atlandı)`)
    } catch (err: any) {
      alert('Hata: ' + err.message)
    } finally {
      setPersonelImporting(false)
    }
  }

  // Genel dönem durumunu hesapla
  const donemDurum = useMemo(() => {
    if (adimlari.length === 0) return 'hazirlaniyor'
    if (adimlari.every(a => a.durum === 'tamamlandi')) return 'odendi'
    if (adimlari.some(a => a.durum === 'uyari')) return 'uyari'
    if (adimlari.some(a => a.durum === 'devam' || a.durum === 'tamamlandi')) return 'devam'
    return 'bekliyor'
  }, [adimlari])

  const tamamlananAdim = adimlari.filter(a => a.durum === 'tamamlandi').length
  const ilerleme = adimlari.length > 0 ? Math.round((tamamlananAdim / adimlari.length) * 100) : 0

  return (
    <div>
      {/* Master Satır */}
      <div
        className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <span className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        {/* Dönem Bilgisi */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-900">{donem.donem_adi}</span>

            {/* Proje & Ekip */}
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <FolderOpen className="w-3 h-3" />
              {(donem as any).projeler?.proje_adi || '-'}
            </span>
            {(donem as any).ekipler?.ad && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Users className="w-3 h-3" />
                {(donem as any).ekipler.ad}
              </span>
            )}

            {/* İlerleme */}
            {adimlari.length > 0 && (
              <span className="text-xs text-gray-500">{tamamlananAdim}/{adimlari.length} adım</span>
            )}
          </div>

          {/* Progress Bar */}
          {adimlari.length > 0 && (
            <div className="mt-1.5 w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${ilerleme === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${ilerleme}%` }}
              />
            </div>
          )}
        </div>

        {/* Sağ taraf */}
        <div className="flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-xs text-gray-400">{fmtDate(donem.bordro_tarihi)}</span>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail Panel */}
      {expanded && (
        <div className="bg-slate-50 border-t border-gray-200 px-4 py-5">
          {loadingDetail ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Süreç Adımları Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {SUREC_ADIMLARI.map(adimDef => {
                  const adim = adimlari.find(a => a.adim_kodu === adimDef.kodu)
                  const durum = adim?.durum || 'bekliyor'
                  const cfg = DURUM_CFG[durum]
                  const DurumIcon = cfg.icon
                  const adimBelgeler = belgeler.filter(b => b.adim_kodu === adimDef.kodu)
                  const isActive = activeAdim === adimDef.kodu

                  return (
                    <div
                      key={adimDef.kodu}
                      className={`bg-white rounded-xl border-2 transition-all ${
                        isActive ? 'border-blue-400 shadow-md' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Adım Başlık */}
                      <div className="p-4 border-b border-gray-100">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-900">{adimDef.adi}</span>
                          <DurumIcon className={`w-4 h-4 flex-shrink-0 ${
                            durum === 'tamamlandi' ? 'text-green-500' :
                            durum === 'devam'      ? 'text-yellow-500 animate-spin' :
                            durum === 'uyari'      ? 'text-orange-500' : 'text-gray-400'
                          }`} />
                        </div>
                        <Badge label={cfg.l} variant={cfg.v as any} />
                        <p className="text-xs text-gray-500 mt-2">{adimDef.aciklama}</p>
                      </div>

                      {/* Belgeler */}
                      <div className="p-3 space-y-1.5">
                        {adimBelgeler.map(b => (
                          <BelgeItem key={b.id} belge={b} onDelete={() => { loadDetail() }} />
                        ))}
                        {adimBelgeler.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">Belge yüklenmedi</p>
                        )}
                      </div>

                      {/* Aksiyonlar */}
                      <div className="px-3 pb-3 space-y-2">
                        <BelgeYukle
                          donemId={donem.id}
                          firmaId={firma.id}
                          adimKodu={adimDef.kodu}
                          kabul={adimDef.kabul}
                          onUploaded={loadDetail}
                        />

                        {/* Puantaj Toplama adımına özel: Personel listesi + gün girişi */}
                        {adimDef.kodu === 'puantaj_toplama' && (
                          <PuantajGiris donem={donem} firma={firma} />
                        )}

                        {/* Maaş Ödeme adımına özel: Yüklü Excel'den Personel Oluştur */}
                        {adimDef.kodu === 'maas_odeme' && (
                          <button
                            onClick={handlePersonelImport}
                            disabled={personelImporting}
                            className="w-full text-xs py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            {personelImporting
                              ? <><Loader2 className="w-3 h-3 animate-spin" /> Oluşturuluyor...</>
                              : <><Users className="w-3 h-3" /> Personel Modülüne Aktar</>
                            }
                          </button>
                        )}

                        {adim && (
                          <div className="flex gap-1">
                            {durum !== 'devam' && (
                              <button
                                onClick={() => updateAdimDurum(adim.id, 'devam')}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium transition-colors"
                              >
                                Devam Ediyor
                              </button>
                            )}
                            {durum !== 'tamamlandi' && (
                              <button
                                onClick={() => updateAdimDurum(adim.id, 'tamamlandi')}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors"
                              >
                                Tamamlandı
                              </button>
                            )}
                            {durum === 'tamamlandi' && (
                              <button
                                onClick={() => updateAdimDurum(adim.id, 'bekliyor')}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition-colors"
                              >
                                Geri Al
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Puantaj Giriş Bileşeni ──────────────────────────────────
interface PuantajGirisProps {
  donem: BordroDonemiDetay
  firma: { id: string }
}

function PuantajGiris({ donem, firma }: PuantajGirisProps) {
  const [personeller, setPersoneller] = useState<any[]>([])
  const [gunler, setGunler]           = useState<Record<string, string>>({})
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)

  useEffect(() => { loadPersoneller() }, [donem.id])

  async function loadPersoneller() {
    setLoading(true)
    const ekipId = (donem as any).ekip_id || null
    if (!ekipId) { setLoading(false); return }

    // Ekibe bağlı personelleri çek (aktif + pasif)
    const { data: baglar } = await supabase
      .from('ekip_personel')
      .select('personel_id, personeller(id, ad_soyad, pozisyon, aktif)')
      .eq('ekip_id', ekipId)

    const pList = (baglar || []).map((b: any) => b.personeller).filter(Boolean)
    setPersoneller(pList)

    // Mevcut puantaj kayıtlarını çek
    const donemStr = donem.yil && donem.ay
      ? `${donem.yil}-${String(donem.ay).padStart(2,'0')}`
      : donem.donem_adi

    if (pList.length > 0) {
      const { data: mevcutPuantaj } = await supabase
        .from('puantaj_toplamlari')
        .select('personel_id, calisma_gunu')
        .eq('firma_id', firma.id)
        .eq('donem', donemStr)
        .in('personel_id', pList.map((p: any) => p.id))

      const gunMap: Record<string, string> = {}
      ;(mevcutPuantaj || []).forEach((p: any) => {
        gunMap[p.personel_id] = String(p.calisma_gunu || '')
      })
      setGunler(gunMap)
    }
    setLoading(false)
  }

  async function kaydet() {
    setSaving(true)
    const donemStr = donem.yil && donem.ay
      ? `${donem.yil}-${String(donem.ay).padStart(2,'0')}`
      : donem.donem_adi

    for (const [personelId, gun] of Object.entries(gunler)) {
      if (!gun) continue
      const { data: mevcut } = await supabase
        .from('puantaj_toplamlari')
        .select('id')
        .eq('firma_id', firma.id)
        .eq('donem', donemStr)
        .eq('personel_id', personelId)
        .single()

      if (mevcut?.id) {
        await supabase.from('puantaj_toplamlari')
          .update({ calisma_gunu: Number(gun) })
          .eq('id', mevcut.id)
      } else {
        await supabase.from('puantaj_toplamlari').insert({
          firma_id:    firma.id,
          proje_id:    (donem as any).proje_id || null,
          personel_id: personelId,
          donem:       donemStr,
          calisma_gunu: Number(gun),
        })
      }
    }
    setSaving(false)
    alert('✓ Puantaj kaydedildi')
  }

  async function excelIndir() {
    const XLSXStyle = await import('xlsx-js-style')
    const { utils, writeFile } = XLSXStyle
    const KOYU='0F172A';const BEYAZ='FFFFFF';const ACIK='F8FAFC';const SINIR='E2E8F0';const MAVI='1E40AF'
    const border={top:{style:'thin',color:{rgb:SINIR}},bottom:{style:'thin',color:{rgb:SINIR}},left:{style:'thin',color:{rgb:SINIR}},right:{style:'thin',color:{rgb:SINIR}}}
    const c=(v:any,s:any)=>({v:v??'',s,t:typeof v==='number'?'n':'s'})
    const sTh={font:{name:'Calibri',sz:9,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:MAVI}},alignment:{horizontal:'center',vertical:'center'},border}
    const sTd=(z:boolean)=>({font:{name:'Calibri',sz:9,color:{rgb:KOYU}},fill:{fgColor:{rgb:z?ACIK:BEYAZ}},alignment:{vertical:'center'},border})
    const ws:any={};const merges:any[]=[];const COLS=5;let row=0

    const ekipAdi=(donem as any).ekipler?.ad || donem.donem_adi
    const donemStr = donem.yil && donem.ay ? `${donem.yil}-${String(donem.ay).padStart(2,'0')}` : donem.donem_adi

    ws[utils.encode_cell({r:row,c:0})]=c(`PUANTAJ — ${ekipAdi.toUpperCase()} — ${donemStr}`,{font:{name:'Calibri',sz:12,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:KOYU}},alignment:{horizontal:'left',vertical:'center'}})
    for(let i=1;i<COLS;i++) ws[utils.encode_cell({r:row,c:i})]=c('',{fill:{fgColor:{rgb:KOYU}}})
    merges.push({s:{r:row,c:0},e:{r:row,c:COLS-1}});row+=2

    ;['#','Ad Soyad','Pozisyon','Çalışılan Gün','Durum'].forEach((h,i)=>{ws[utils.encode_cell({r:row,c:i})]=c(h,sTh)});row++

    personeller.forEach((p:any,idx:number)=>{
      const z=idx%2===1
      const gun=Number(gunler[p.id]||0)
      ws[utils.encode_cell({r:row,c:0})]=c(idx+1,{...sTd(z),alignment:{horizontal:'center',vertical:'center'}})
      ws[utils.encode_cell({r:row,c:1})]=c(p.ad_soyad,sTd(z))
      ws[utils.encode_cell({r:row,c:2})]=c(p.pozisyon||'-',sTd(z))
      ws[utils.encode_cell({r:row,c:3})]={v:gun,s:{...sTd(z),alignment:{horizontal:'center',vertical:'center'}},t:'n'}
      ws[utils.encode_cell({r:row,c:4})]=c(p.aktif?'Aktif':'Pasif',{...sTd(z),font:{name:'Calibri',sz:9,bold:true,color:{rgb:p.aktif?'166534':'991B1B'}}})
      row++
    })

    // Toplam
    const topS={font:{name:'Calibri',sz:10,bold:true,color:{rgb:BEYAZ}},fill:{fgColor:{rgb:'1E293B'}},alignment:{horizontal:'left',vertical:'center'},border:{top:{style:'medium',color:{rgb:KOYU}},bottom:{style:'medium',color:{rgb:KOYU}},left:{style:'thin',color:{rgb:KOYU}},right:{style:'thin',color:{rgb:KOYU}}}}
    const toplamGun=personeller.reduce((s:number,p:any)=>s+Number(gunler[p.id]||0),0)
    ws[utils.encode_cell({r:row,c:0})]=c(`TOPLAM: ${personeller.length} personel`,topS)
    ws[utils.encode_cell({r:row,c:1})]=c('',topS)
    ws[utils.encode_cell({r:row,c:2})]=c('',topS)
    ws[utils.encode_cell({r:row,c:3})]={v:toplamGun,s:{...topS,alignment:{horizontal:'center',vertical:'center'}},t:'n'}
    ws[utils.encode_cell({r:row,c:4})]=c('',topS)
    merges.push({s:{r:row,c:0},e:{r:row,c:2}})

    ws['!cols']=[{wch:5},{wch:26},{wch:18},{wch:14},{wch:8}]
    ws['!merges']=merges
    ws['!ref']=utils.encode_range({s:{r:0,c:0},e:{r:row,c:COLS-1}})
    const wb=utils.book_new();utils.book_append_sheet(wb,ws,'Puantaj')
    writeFile(wb,`puantaj-${ekipAdi}-${donemStr}.xlsx`)
  }

  if (loading) return <div className="text-xs text-gray-400 text-center py-2">Yükleniyor...</div>
  if (personeller.length === 0) return (
    <div className="text-xs text-amber-600 text-center py-2 bg-amber-50 rounded-lg">
      Bu ekibe bağlı personel bulunamadı. Önce personel aktarımı yapın.
    </div>
  )

  return (
    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-slate-700 text-white text-xs font-semibold px-3 py-2 flex justify-between items-center">
        <span>Puantaj — {personeller.length} Personel</span>
        <div className="flex gap-1">
          <button
            onClick={excelIndir}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 py-1 rounded"
          >
            Excel
          </button>
          <button
            onClick={kaydet}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {personeller.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{p.ad_soyad}</p>
              <p className="text-xs text-gray-400">{p.pozisyon || ''}{!p.aktif && <span className="ml-1 text-red-400">(Pasif)</span>}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                type="number"
                min="0"
                max="31"
                value={gunler[p.id] || ''}
                onChange={e => setGunler(prev => ({ ...prev, [p.id]: e.target.value }))}
                placeholder="0"
                className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">gün</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Belge Yükleme Bileşeni ───────────────────────────────────
interface BelgeYukleProps {
  donemId: string
  firmaId: string
  adimKodu: string
  kabul: string
  onUploaded: () => void
}

function BelgeYukle({ donemId, firmaId, adimKodu, kabul, onUploaded }: BelgeYukleProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'

    // Dosya adını güvenli hale getir: Türkçe karakter, boşluk, özel karakter temizle
    const safeName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // aksan işaretlerini kaldır
      .replace(/[ğ]/g, 'g').replace(/[Ğ]/g, 'G')
      .replace(/[ü]/g, 'u').replace(/[Ü]/g, 'U')
      .replace(/[ş]/g, 's').replace(/[Ş]/g, 'S')
      .replace(/[ı]/g, 'i').replace(/[İ]/g, 'I')
      .replace(/[ö]/g, 'o').replace(/[Ö]/g, 'O')
      .replace(/[ç]/g, 'c').replace(/[Ç]/g, 'C')
      .replace(/[^a-zA-Z0-9._-]/g, '_') // kalan özel karakter ve boşlukları _ yap
      .replace(/_+/g, '_')               // ardışık _ tek _ yap

    const path = `${firmaId}/${donemId}/${adimKodu}/${Date.now()}_${safeName}`

    const { error: upErr } = await supabase.storage
      .from('bordro-belgeler')
      .upload(path, file, { upsert: false })

    if (upErr) {
      alert('Yükleme hatası: ' + upErr.message)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    await supabase.from('bordro_belgeler').insert({
      donem_id:     donemId,
      firma_id:     firmaId,
      adim_kodu:    adimKodu,
      belge_tipi:   ext,
      dosya_adi:    file.name,
      storage_path: path,
    })

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    onUploaded()
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={kabul}
        onChange={handleFile}
        className="hidden"
        id={`upload-${donemId}-${adimKodu}`}
      />
      <label
        htmlFor={`upload-${donemId}-${adimKodu}`}
        className={`flex items-center justify-center gap-1.5 w-full text-xs py-1.5 rounded-lg border border-dashed cursor-pointer transition-colors ${
          uploading
            ? 'border-gray-300 text-gray-400 cursor-not-allowed'
            : 'border-blue-300 text-blue-600 hover:bg-blue-50'
        }`}
      >
        {uploading ? (
          <><div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" /> Yükleniyor...</>
        ) : (
          <><Upload className="w-3 h-3" /> Dosya Yükle</>
        )}
      </label>
    </div>
  )
}

// ─── Belge Satırı ─────────────────────────────────────────────
interface BelgeItemProps {
  belge: BordroBelge
  onDelete: () => void
}

const BELGE_ICON: Record<string, string> = {
  pdf:  '📄', xlsx: '📊', xls: '📊',
  jpg:  '🖼', jpeg: '🖼', png: '🖼',
}

function BelgeItem({ belge, onDelete }: BelgeItemProps) {
  const [deleting, setDeleting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  async function handlePreview() {
    const { data } = await supabase.storage
      .from('bordro-belgeler')
      .createSignedUrl(belge.storage_path, 60)
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl)
      setPreviewing(true)
    }
  }

  async function handleDownload() {
    const { data } = await supabase.storage
      .from('bordro-belgeler')
      .createSignedUrl(belge.storage_path, 60)
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = belge.dosya_adi
      a.click()
    }
  }

  async function handleDelete() {
    if (!confirm(`"${belge.dosya_adi}" silinsin mi?`)) return
    setDeleting(true)
    await supabase.storage.from('bordro-belgeler').remove([belge.storage_path])
    await supabase.from('bordro_belgeler').delete().eq('id', belge.id)
    setDeleting(false)
    onDelete()
  }

  const icon = BELGE_ICON[belge.belge_tipi] || '📎'
  const isImage = ['jpg','jpeg','png'].includes(belge.belge_tipi)

  return (
    <>
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5 group">
        <span className="text-sm flex-shrink-0">{icon}</span>
        <span className="text-xs text-gray-700 truncate flex-1 min-w-0" title={belge.dosya_adi}>
          {belge.dosya_adi}
        </span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={handlePreview} className="p-0.5 text-gray-400 hover:text-blue-600" title="Görüntüle">
            <Eye className="w-3 h-3" />
          </button>
          <button onClick={handleDownload} className="p-0.5 text-gray-400 hover:text-green-600" title="İndir">
            <Download className="w-3 h-3" />
          </button>
          <button onClick={handleDelete} disabled={deleting} className="p-0.5 text-gray-400 hover:text-red-500" title="Sil">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Önizleme Modal */}
      {previewing && previewUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-medium text-gray-900 text-sm truncate">{belge.dosya_adi}</span>
              <div className="flex gap-2">
                <button onClick={handleDownload} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Download className="w-3 h-3" /> İndir
                </button>
                <button onClick={() => { setPreviewing(false); setPreviewUrl(null) }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isImage ? (
                <img src={previewUrl} alt={belge.dosya_adi} className="max-w-full mx-auto rounded" />
              ) : belge.belge_tipi === 'pdf' ? (
                <iframe src={previewUrl} className="w-full h-[70vh] rounded border" title={belge.dosya_adi} />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-4">Bu dosya türü önizlenemiyor.</p>
                  <button onClick={handleDownload} className="text-blue-600 hover:underline text-sm">
                    İndirmek için tıklayın
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
