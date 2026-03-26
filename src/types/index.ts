// =============================================================================
// İŞ TAKİP SİSTEMİ — ORTAK TİPLER
// =============================================================================

export interface Musteri {
  id: string
  firma_id: string
  ad: string
  kisa_ad?: string | null
  vergi_no?: string | null
  yetkili?: string | null
  telefon?: string | null
  email?: string | null
  sektor?: string | null
  aktif: boolean
  notlar?: string | null
  created_at?: string
}

export interface Proje {
  id: string
  firma_id: string
  musteri_id?: string | null
  musteri?: Musteri | null
  ad: string
  kod?: string | null
  baslangic_tarihi?: string | null
  bitis_tarihi?: string | null
  durum: 'aktif' | 'tamamlandi' | 'beklemede' | 'iptal'
  notlar?: string | null
  created_at?: string
}

export interface Ekip {
  id: string
  firma_id: string
  proje_id: string
  proje?: Proje | null
  ad: string
  sorumlu?: string | null
  aktif: boolean
  created_at?: string
}

export interface Firma {
  id: string
  ad: string
  kisa_ad?: string | null
  vergi_no?: string | null
  yetkili?: string | null
  telefon?: string | null
  email?: string | null
  aktif: boolean
}

export interface KullaniciProfil {
  id: string
  auth_user_id: string
  firma_id: string
  ad_soyad: string | null
  email: string
  rol: 'yonetici' | 'muhasebe' | 'izleme'
  aktif: boolean
  son_giris_at: string | null
}

// ── İş Şablonu ────────────────────────────────────────────────────────────────
export type IsTip = 'beyanname' | 'odeme' | 'bordro' | 'mutabakat' | 'edefter' | 'diger'
export type Periyot = 'haftalik' | 'aylik' | 'uc_aylik' | 'alti_aylik' | 'yillik' | 'tek_seferlik'
export type Oncelik = 'dusuk' | 'orta' | 'yuksek' | 'kritik'
export type GorevDurum = 'bekliyor' | 'hazirlaniyor' | 'kontrolde' | 'tamamlandi' | 'iptal'

export interface IsSablonu {
  id: string
  firma_id: string
  ad: string
  tip: IsTip
  periyot: Periyot
  aciklama?: string | null
  oncelik: Oncelik
  sorumlu_id?: string | null
  sorumlu?: { ad_soyad: string | null; email: string } | null
  hatirlat_gun: number
  aktif: boolean
  created_at?: string
}

// ── Görev ─────────────────────────────────────────────────────────────────────
export interface Gorev {
  id: string
  firma_id: string
  musteri_id?: string | null
  musteri?: Musteri | null
  sablon_id?: string | null
  ad: string
  tip: IsTip
  periyot: Periyot
  donem?: string | null
  son_tarih: string
  oncelik: Oncelik
  sorumlu_id?: string | null
  sorumlu?: { ad_soyad: string | null; email: string } | null
  durum: GorevDurum
  notlar?: string | null
  tamamlandi_at?: string | null
  tamamlayan_id?: string | null
  arsiv_klasor?: string | null
  created_at?: string
}

// ── Görev Geçmiş ──────────────────────────────────────────────────────────────
export interface GorevGecmis {
  id: string
  gorev_id: string
  eski_durum?: string | null
  yeni_durum: string
  degistiren_id?: string | null
  degistiren?: { ad_soyad: string | null; email: string } | null
  aciklama?: string | null
  created_at: string
}

// ── Arşiv Dosya ───────────────────────────────────────────────────────────────
export interface ArsivDosya {
  id: string
  firma_id: string
  gorev_id?: string | null
  klasor_yolu: string
  dosya_adi: string
  dosya_url: string
  mime_type?: string | null
  boyut_byte?: number | null
  etiketler?: string[] | null
  yukleyen_id?: string | null
  created_at: string
}

// ── Bordro Süreç ──────────────────────────────────────────────────────────────
export type BordroAdimDurum = 'bekliyor' | 'tamamlandi'

export interface BordroSurec {
  id: string
  firma_id: string
  proje_id: string
  proje?: Proje | null
  ekip_id?: string | null
  ekip?: Ekip | null
  donem: string
  puantaj_durum: BordroAdimDurum
  bordro_durum: BordroAdimDurum
  teyit_durum: BordroAdimDurum
  odeme_durum: BordroAdimDurum
  santiye_durum: BordroAdimDurum
  puantaj_tarihi?: string | null
  bordro_tarihi?: string | null
  teyit_tarihi?: string | null
  odeme_tarihi?: string | null
  santiye_tarihi?: string | null
  puantaj_aciklama?: string | null
  bordro_aciklama?: string | null
  teyit_aciklama?: string | null
  odeme_aciklama?: string | null
  santiye_aciklama?: string | null
  notlar?: string | null
  created_at?: string
}

// ── Hatırlatıcı ───────────────────────────────────────────────────────────────
export interface Hatirlatici {
  id: string
  gorev_id: string
  gonderim_tarihi: string
  kanal: 'uygulama' | 'email'
  gonderildi: boolean
  gonderildi_at?: string | null
}

// ── Yardımcı ──────────────────────────────────────────────────────────────────
export const TIP_LABEL: Record<IsTip, string> = {
  beyanname: 'Beyanname',
  odeme: 'Ödeme',
  bordro: 'Bordro',
  mutabakat: 'Mutabakat',
  edefter: 'E-Defter',
  diger: 'Diğer',
}

export const PERIYOT_LABEL: Record<Periyot, string> = {
  haftalik: 'Haftalık',
  aylik: 'Aylık',
  uc_aylik: '3 Aylık',
  alti_aylik: '6 Aylık',
  yillik: 'Yıllık',
  tek_seferlik: 'Tek Seferlik',
}

export const DURUM_LABEL: Record<GorevDurum, string> = {
  bekliyor: 'Bekliyor',
  hazirlaniyor: 'Hazırlanıyor',
  kontrolde: 'Kontrolde',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal',
}

export const ONCELIK_LABEL: Record<Oncelik, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
}

export const ONCELIK_COLOR: Record<Oncelik, string> = {
  dusuk: 'bg-slate-100 text-slate-600',
  orta: 'bg-blue-100 text-blue-700',
  yuksek: 'bg-amber-100 text-amber-700',
  kritik: 'bg-red-100 text-red-700',
}

export const DURUM_COLOR: Record<GorevDurum, string> = {
  bekliyor: 'bg-slate-100 text-slate-600',
  hazirlaniyor: 'bg-blue-100 text-blue-700',
  kontrolde: 'bg-amber-100 text-amber-700',
  tamamlandi: 'bg-emerald-100 text-emerald-700',
  iptal: 'bg-red-100 text-red-600',
}

export const TARIH = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR') : '—'

export function kalanGun(sonTarih: string): number {
  const bugun = new Date(); bugun.setHours(0,0,0,0)
  const son = new Date(sonTarih); son.setHours(0,0,0,0)
  return Math.ceil((son.getTime() - bugun.getTime()) / 86400000)
}
