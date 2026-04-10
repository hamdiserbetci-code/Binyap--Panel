export interface Firma {
  id: string
  ad: string
  kisa_ad?: string
  vergi_no?: string
  adres?: string
  telefon?: string
  email?: string
  yetkili?: string
  aktif_donem?: number
  aktif?: boolean
  created_by?: string
  created_at?: string
  sgk_kullanici_adi?: string | null
  sgk_isyeri_sifresi?: string | null
  sgk_sistem_sifresi?: string | null
}

export interface FirmaKullanici {
  id: string
  firma_id: string
  user_id: string
  rol: 'admin' | 'editor' | 'viewer'
}

export interface Proje {
  id: string
  firma_id: string
  musteri_id?: string | null
  ad: string
  durum: 'aktif' | 'tamamlandi' | 'beklemede'
  baslangic?: string
  bitis?: string
  sgk_sicil_no?: string | null
}

export interface Ekip {
  id: string
  firma_id: string
  proje_id?: string | null
  ad: string
  ad_soyad?: string
  pozisyon?: string
  ise_giris?: string
  renk: string
  aktif?: boolean
  kategori?: string | null  // 'demirci' | 'ahsapci' | 'tunel_kalip' | 'personel' | 'diger'
}

// Yönetim
export interface IsTakibi {
  id: string
  firma_id: string
  proje_id?: string
  baslik: string
  durum: 'beklemede' | 'devam' | 'tamamlandi'
  oncelik: 'dusuk' | 'orta' | 'yuksek'
  baslangic?: string
  bitis?: string
  sorumlu?: string
}

export interface KarZarar {
  id: string
  firma_id: string
  donem: string
  gelir: number
  gider: number
  aciklama?: string
}

export interface Evrak {
  id: string
  firma_id: string
  proje_id?: string
  ad: string
  kategori: string
  tarih: string
  dosya_url?: string
  notlar?: string
}

export interface GunlukIs {
  id: string
  firma_id: string
  user_id: string
  baslik: string
  tamamlandi: boolean
  tarih: string
  oncelik: 'dusuk' | 'orta' | 'yuksek'
}

// Finans
export interface KasaHareket {
  id: string
  firma_id: string
  tarih: string
  aciklama: string
  tur: 'giris' | 'cikis'
  tutar: number
  bakiye: number
  kategori?: string
}

export interface CariHesap {
  id: string
  firma_id: string
  ad: string
  tur: 'musteri' | 'tedarikci'
  bakiye: number
  telefon?: string
  email?: string
}

export interface CariHareket {
  id: string
  firma_id: string
  cari_id: string
  tarih: string
  aciklama: string
  borc: number
  alacak: number
}

export interface OdemePlani {
  id: string
  firma_id: string
  baslik: string
  tur: string
  vade: string
  tutar: number
  durum: 'beklemede' | 'odendi' | 'gecikti'
  cek_no?: string
  aciklama?: string
}

// İK
export interface Bordro {
  id: string
  firma_id: string
  proje_id?: string
  ekip_id: string
  donem: string
  brut: number
  net: number
  sgk_isci: number
  sgk_isveren: number
  vergi: number
  avans: number
  kesinti: number
}

export interface SgkBildirgesi {
  id: string
  firma_id: string
  donem: string
  bildirge_no?: string
  gonderim_tarihi?: string
  durum: 'beklemede' | 'gonderildi' | 'onaylandi'
  tutar: number
}

export interface IcraTakip {
  id: string
  firma_id: string
  ekip_id?: string
  dosya_no: string
  mahkeme?: string
  tutar: number
  teblig_tarihi?: string
  durum: 'devam' | 'kapandi' | 'odendi'
  aciklama?: string
}

// ── Utility / shared types ──────────────────────────────────────────────────

export type IsTip = 'beyanname' | 'odeme' | 'bordro' | 'mutabakat' | 'edefter' | 'diger'
export type Periyot = 'haftalik' | 'aylik' | 'uc_aylik' | 'alti_aylik' | 'yillik' | 'tek_seferlik'
export type GorevDurum = 'bekliyor' | 'hazirlaniyor' | 'kontrolde' | 'tamamlandi' | 'iptal'
export type Oncelik = 'dusuk' | 'orta' | 'yuksek' | 'kritik'
export type DokumanTipi = 'fatura' | 'sozlesme' | 'rapor' | 'irsaliye' | 'makbuz' | 'genel_evrak' | 'diger'

// ── Musteri ─────────────────────────────────────────────────────────────────

export interface Musteri {
  id: string
  firma_id: string
  ad: string
  kisa_ad?: string | null
  vergi_no?: string | null
  telefon?: string | null
  email?: string | null
  sektor?: string | null
  yetkili?: string | null
  notlar?: string | null
  aktif: boolean
  created_at: string
}

// ── Dokuman ─────────────────────────────────────────────────────────────────

export interface Dokuman {
  id: string
  firma_id: string
  yukleyen_id?: string | null
  musteri_id?: string | null
  proje_id?: string | null
  bagli_tablo?: string | null
  bagli_kayit_id?: string | null
  modul?: DokumanTipi | null
  kategori?: string | null
  dosya_adi: string
  dosya_url: string
  mime_type?: string | null
  dosya_boyutu?: number | null
  etiketler?: string[] | null
  aciklama?: string | null
  created_at: string
}

// ── KullaniciProfil ──────────────────────────────────────────────────────────

export interface KullaniciProfil {
  id: string
  firma_id: string
  auth_user_id: string
  ad_soyad: string
  email?: string | null
  rol: KullaniciRol
  aktif: boolean
  varsayilan_bildirim_saati?: string | null
  yetkiler?: KullaniciYetki[]
}

// ── IsSablonu ────────────────────────────────────────────────────────────────

export interface IsSablonu {
  id: string
  firma_id: string
  ad: string
  tip: IsTip
  periyot: Periyot
  oncelik: Oncelik
  hatirlat_gun: number
  aktif: boolean
  aciklama?: string | null
  sorumlu_id?: string | null
  created_at?: string
}

// ── Cek ─────────────────────────────────────────────────────────────────────

export interface Cek {
  id: string
  firma_id: string
  musteri_id?: string | null
  tip: 'alinan' | 'verilen'
  cek_no: string
  banka?: string | null
  cari_hesap?: string | null
  tutar: number
  keside_tarihi?: string | null
  vade_tarihi: string
  durum: 'odenecek' | 'odendi' | 'iade' | 'karsiliksiz'
  aciklama?: string | null
  hatirlatici_tarihi?: string | null
  hatirlatici_saati?: string | null
  hatirlat_gun_once?: number | null
  tamamlandi_at?: string | null
  created_at: string
}

// ── IkPersonel ───────────────────────────────────────────────────────────────

export interface IkPersonel {
  id: string
  firma_id: string
  proje_id?: string | null
  ekip_id?: string | null
  ad_soyad: string
  tc_no?: string | null
  dogum_tarihi?: string | null
  ise_giris_tarihi: string
  isten_cikis_tarihi?: string | null
  gorev?: string | null
  maas?: number | null
  durum: 'aktif' | 'ayrildi'
  notlar?: string | null
  created_at?: string
}

export type IkBelgeTipi = 'giris_bildirgesi' | 'cikis_bildirgesi' | 'kimlik' | 'diploma' | 'saglik' | 'sozlesme' | 'diger'

export interface IkBelge {
  id: string
  firma_id: string
  personel_id?: string | null
  proje_id?: string | null
  belge_tipi: IkBelgeTipi
  dosya_adi: string
  dosya_url: string
  mime_type?: string | null
  dosya_boyutu?: number | null
  created_at: string
}

// ── BordroSurec ──────────────────────────────────────────────────────────────

export interface BordroSurec {
  id: string
  firma_id: string
  proje_id: string
  ekip_id?: string | null
  donem: string
  puantaj_durum?: string | null
  puantaj_tarihi?: string | null
  bordro_durum?: string | null
  bordro_tarihi?: string | null
  teyit_durum?: string | null
  teyit_tarihi?: string | null
  odeme_durum?: string | null
  odeme_tarihi?: string | null
  santiye_durum?: string | null
  santiye_tarihi?: string | null
  notlar?: string | null
  created_at?: string
}

// ── MaliyetSureci ────────────────────────────────────────────────────────────

export interface MaliyetSureci {
  id: string
  firma_id: string
  musteri_id?: string | null
  sorumlu_id?: string | null
  donem: string
  teslim_gunu?: string | null
  durum?: string | null
  efatura_kontrol?: boolean | null
  efatura_luca?: boolean | null
  earsiv_kontrol?: boolean | null
  earsiv_luca?: boolean | null
  utts_kontrol?: boolean | null
  utts_luca?: boolean | null
  bordro_kontrol?: boolean | null
  bordro_luca?: boolean | null
  satis_kontrol?: boolean | null
  satis_luca?: boolean | null
  notlar?: string | null
  created_at?: string
}

// ── IcraTakibi (extended version used by icra module) ────────────────────────

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

export type IcraDurum = 'aktif' | 'odendi' | 'kapali'
export type IcraIsciDurumu = 'calisiyor' | 'ayrildi'

export interface IcraOdeme {
  id: string
  icra_id: string
  firma_id: string
  odeme_tarihi: string
  tutar: number
  aciklama?: string | null
  created_at?: string
}

// ── Sirket ───────────────────────────────────────────────────────────────────

export interface Sirket {
  id: string
  firma_id: string
  kod: 'ETM' | 'BİNYAPI'
  ad: string
  vergi_no?: string | null
  sgk_sicil_no?: string | null
  adres?: string | null
  telefon?: string | null
  email?: string | null
  aktif: boolean
  created_at?: string
}

// ── Vergi Yonetimi ───────────────────────────────────────────────────────────

export type VergiTip = 'kdv' | 'kdv2' | 'muhsgk' | 'gecici_vergi' | 'kurumlar_vergisi'
export type BeyannameDurum = 'bekliyor' | 'hazirlaniyor' | 'kontrolde' | 'verildi' | 'onaylandi' | 'reddedildi' | 'odendi'
export type VergiPeriyot = 'aylik' | 'uc_aylik' | 'yillik'

export interface VergiTakvimi {
  id: string
  tip: VergiTip
  periyot: VergiPeriyot
  son_gun: number
  aciklama?: string | null
  aktif: boolean
}

export interface VergiBeyanname {
  id: string
  firma_id: string
  sirket_id: string
  sirket?: Sirket | null
  tip: VergiTip
  donem: string
  son_tarih: string
  durum: BeyannameDurum
  tahakkuk_tutari: number
  odenen_tutar: number
  verilis_tarihi?: string | null
  beyanname_no?: string | null
  notlar?: string | null
  sorumlu_id?: string | null
  sorumlu?: KullaniciProfil | null
  hatirlatici_tarihi?: string | null
  hatirlatici_saati?: string | null
  created_at?: string
  updated_at?: string
}

export interface VergiOdemesi {
  id: string
  beyanname_id: string
  firma_id: string
  odeme_tarihi: string
  tutar: number
  odeme_kanali: 'banka' | 'nakit'
  dekont_no?: string | null
  notlar?: string | null
  created_at?: string
}

// ── Yetki Sistemi ────────────────────────────────────────────────────────────

export type KullaniciRol = 'yonetici' | 'muhasebe' | 'santiye' | 'izleme'

export interface KullaniciYetki {
  id: string
  kullanici_id: string
  modul: string
  okuma: boolean
  yazma: boolean
  silme: boolean
  onaylama: boolean
  created_at?: string
}

export interface CariHesapExtended extends CariHesap {
  sirket_id?: string | null
  sirket?: Sirket | null
  tip: 'musteri' | 'tedarikci' | 'personel' | 'diger'
  vkn_tckn?: string | null
  adres?: string | null
  notlar?: string | null
  bakiye: number
}

export interface CariHareketExtended extends CariHareket {
  proje_id?: string | null
  proje?: Proje | null
  tur: 'borc' | 'alacak'
  tutar: number
  belge_no?: string | null
  evrak_tipi?: 'fatura' | 'dekont' | 'cek' | 'diger' | null
}
