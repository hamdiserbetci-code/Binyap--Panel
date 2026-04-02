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
export type DokumanTipi = 'fatura' | 'sozlesme' | 'rapor' | 'irsaliye' | 'makbuz' | 'diger' | 'genel_evrak'
export interface Dokuman {
  id: string
  firma_id: string
  proje_id?: string | null
  musteri_id?: string | null
  yukleyen_id?: string | null
  sirket?: string | null
  modul: DokumanTipi // Ana doküman tipi (fatura, sözleşme vb.)
  kategori?: string | null // Ek kategori veya alt tip
  bagli_tablo?: string | null
  bagli_kayit_id?: string | null
  dosya_adi: string
  dosya_url: string
  mime_type?: string | null
  dosya_boyutu?: number | null // new-panel-schema.sql'deki isim
  aciklama?: string | null
  etiketler?: string[] | null
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
  hatirlatici_tarihi?: string | null
  hatirlatici_saati?: string | null
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

// ── Çekler ────────────────────────────────────────────────────────────────────
export interface Cek {
  id: string
  firma_id: string
  musteri_id: string | null
  tip: 'alinan' | 'verilen'
  cek_no: string
  banka: string | null
  tutar: number
  keside_tarihi: string | null
  vade_tarihi: string
  durum: 'bekliyor' | 'tahsil_edildi' | 'odendi' | 'karsiliksiz' | 'iade_edildi' | 'ciro_edildi'
  aciklama: string | null
  hatirlatici_tarihi?: string | null
  hatirlatici_saati?: string | null
  hatirlat_gun_once?: number | null
  tamamlandi_at?: string | null
  created_at: string
}

export type OdemePlanTuru = 'cek' | 'vergi' | 'sgk' | 'cari_hesap' | 'maas' | 'kredi'
export type OdemePlanDurumu = 'bekliyor' | 'odendi' | 'ertelendi' | 'iptal'

export interface OdemePlaniKaydi {
  id: string
  firma_id: string
  musteri_id?: string | null
  ekip_id?: string | null
  baslik: string
  tur: OdemePlanTuru
  tutar: number
  vade_tarihi: string
  durum: OdemePlanDurumu
  ilgili_kurum?: string | null
  aciklama?: string | null
  hatirlatici_tarihi?: string | null
  hatirlatici_saati?: string | null
  hatirlat_gun_once?: number | null
  tamamlandi_at?: string | null
  created_at?: string
}

// ── İcra Takibi ───────────────────────────────────────────────────────────────
export type IcraDurum = 'aktif' | 'odendi' | 'kapali'
export type IcraIsciDurumu = 'calisiyor' | 'ayrildi'

export interface IcraTakibi {
  id: string
  firma_id: string
  musteri_id?: string | null
  musteri?: Musteri | null
  borclu_adi: string
  tc_no?: string | null
  icra_dairesi_adi: string
  dosya_no: string
  tebligat_tarihi: string
  alacakli_adi: string
  borc_tutari: number
  icra_dairesi_iban?: string | null
  cevap_tarihi?: string | null
  durum: IcraDurum
  isci_durumu: IcraIsciDurumu
  cikis_tarihi?: string | null
  kep_no?: string | null
  barkod_no?: string | null
  tebligat_dosya_url?: string | null
  tebligat_dosya_adi?: string | null
  cevap_dosya_url?: string | null
  cevap_dosya_adi?: string | null
  notlar?: string | null
  created_at?: string
  updated_at?: string
}

export interface IcraOdeme {
  id: string
  icra_id: string
  firma_id: string
  odeme_tarihi: string
  tutar: number
  aciklama?: string | null
  created_at?: string
}

// ── Aylık Maliyet Süreci (Periyodik İşler) ──────────────────────────────────
export interface MaliyetSureci {
  id: string
  firma_id: string
  donem: string
  sorumlu_id?: string | null
  teslim_gunu?: number | null
  
  efatura_kontrol: boolean
  efatura_luca: boolean
  
  earsiv_kontrol: boolean
  earsiv_luca: boolean
  
  utts_kontrol: boolean
  utts_luca: boolean
  
  bordro_kontrol: boolean
  bordro_luca: boolean

  satis_kontrol: boolean
  satis_luca: boolean

  durum: 'bekliyor' | 'tamamlandi'
  notlar?: string | null
  hatirlatici_tarihi?: string | null
  hatirlatici_saati?: string | null
  created_at: string
}
