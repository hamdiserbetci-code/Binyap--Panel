// ─── Firma ───────────────────────────────────────────────────────────────────
export interface Firma {
  id: string
  ad: string
  kisa_ad: string | null
  vergi_no: string | null
  aktif: boolean
  created_at: string
}

// ─── Kullanıcı ────────────────────────────────────────────────────────────────
export interface KullaniciProfil {
  id: string
  auth_user_id: string
  firma_id: string
  ad_soyad: string | null
  email: string | null
  rol: 'admin' | 'muhasebe' | 'ik' | 'izleyici'
  aktif: boolean
}

// ─── Proje ────────────────────────────────────────────────────────────────────
export interface Proje {
  id: string
  firma_id: string
  proje_adi: string
  aciklama: string | null
  baslangic_tarihi: string | null
  bitis_tarihi: string | null
  butce: number | null
  durum: 'planlama' | 'devam' | 'tamamlandi' | 'iptal'
  sorumlu_kisi: string | null
  notlar: string | null
  created_at: string
}

// ─── Personel ─────────────────────────────────────────────────────────────────
export interface Personel {
  id: string
  firma_id: string
  ad_soyad: string
  tc_kimlik: string | null
  telefon: string | null
  pozisyon: string | null
  maas_tipi: 'aylik' | 'gundelik' | 'saatlik'
  net_maas: number | null
  brut_maas: number | null
  ise_giris_tarihi: string | null
  isten_cikis_tarihi: string | null
  varsayilan_proje_id: string | null
  sgk_no: string | null
  banka_iban: string | null
  aktif: boolean
  created_at: string
}

// ─── Bordro ───────────────────────────────────────────────────────────────────
export interface BordroDonemi {
  id: string
  firma_id: string
  donem_adi: string
  baslangic_tarihi: string
  bitis_tarihi: string
  bordro_tarihi: string
  durum: 'hazirlaniyor' | 'onaylandi' | 'odendi'
  toplam_net: number | null
  toplam_brut: number | null
  aciklama: string | null
  created_at: string
}

export interface BordroKalem {
  id: string
  donem_id: string
  firma_id: string
  personel_id: string
  personel?: Personel
  calisma_gunu: number | null
  brut_maas: number
  sgk_isci: number
  gelir_vergisi: number
  damga_vergisi: number
  diger_kesintiler: number
  net_maas: number
  odeme_tarihi: string | null
  odendi: boolean
}

// ─── Kasa ─────────────────────────────────────────────────────────────────────
export interface KasaHareketi {
  id: string
  firma_id: string
  islem_tipi: 'giris' | 'cikis'
  tutar: number
  aciklama: string | null
  tarih: string
  proje_id: string | null
  created_at: string
}

export interface BankaHesabi {
  id: string
  firma_id: string
  banka_adi: string
  sube_adi: string | null
  hesap_no: string | null
  iban: string | null
  bakiye: number
  created_at: string
}

// ─── Ödeme Planı ──────────────────────────────────────────────────────────────
export interface OdemePlani {
  id: string
  firma_id: string
  odeme_tipi: 'cek' | 'cari' | 'vergi' | 'sgk' | 'maas' | 'diger'
  aciklama: string | null
  tutar: number
  odenen_tutar: number
  kalan_tutar: number
  vade_tarihi: string
  odeme_tarihi: string | null
  durum: 'bekliyor' | 'odendi' | 'kismi' | 'iptal'
  cek_no: string | null
  banka_hesabi: string | null
  notlar: string | null
  created_at: string
}

// ─── Kar-Zarar ────────────────────────────────────────────────────────────────
export interface KarZararHesap {
  id: string
  firma_id: string
  donem: string
  baslangic_tarihi: string | null
  bitis_tarihi: string | null
  hakedisler: number
  diger_gelirler: number
  malzeme_giderleri: number
  iscilik_giderleri: number
  genel_giderler: number
  finans_giderleri: number
  diger_giderler: number
  toplam_gelir: number
  toplam_gider: number
  net_kar_zarar: number
  notlar: string | null
  created_at: string
}

// ─── İcra ─────────────────────────────────────────────────────────────────────
export interface IcraDosyasi {
  id: string
  firma_id: string
  personel_id: string
  personel?: Personel
  icra_tipi: 'ilamsiz' | 'ilamli' | 'haciz' | 'nafaka' | 'diger'
  dosya_no: string
  icra_dairesi: string | null
  alacakli: string | null
  toplam_borc: number
  odenen_tutar: number
  kalan_borc: number
  aylik_kesinti: number
  baslangic_tarihi: string | null
  bitis_tarihi: string | null
  durum: 'aktif' | 'odeme_plani' | 'kapandi' | 'itiraz'
  avukat_adi: string | null
  avukat_telefon: string | null
  notlar: string | null
  created_at: string
}

// ─── SGK ──────────────────────────────────────────────────────────────────────
export interface SgkBeyan {
  id: string
  firma_id: string
  donem: string
  calisma_gun_sayisi: number | null
  sigortali_sayisi: number | null
  prim_tutari: number
  isverenin_payi: number
  isci_payi: number
  toplam_prim: number
  son_odeme_tarihi: string | null
  odeme_tarihi: string | null
  durum: 'bekliyor' | 'odendi' | 'gecikti'
  notlar: string | null
  created_at: string
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
export type ModuleId =
  | 'dashboard'
  | 'gorevler'
  | 'cari'
  | 'kasa'
  | 'odeme-plani'
  | 'kar-zarar'
  | 'projeler'
  | 'ekipler'
  | 'personel'
  | 'bordro'
  | 'arabulucu'
  | 'icra'
  | 'sgk'
  | 'is-takibi'
  | 'police'
  | 'teminat'
  | 'arsiv'
  | 'raporlar'
  | 'ayarlar'

export interface NavItem {
  id: ModuleId
  label: string
  icon: React.ElementType
  group: string
}

// ─── Ekip ─────────────────────────────────────────────────────────────────────
export interface Ekip {
  id: string
  firma_id: string
  proje_id: string
  ekip_adi: string
  sef_adi: string | null
  aciklama: string | null
  aktif: boolean
  created_at: string
  // join
  projeler?: { proje_adi: string }
}

export interface EkipPersonel {
  id: string
  ekip_id: string
  personel_id: string
  baslangic: string | null
  bitis: string | null
  aktif: boolean
  personeller?: { ad_soyad: string; pozisyon: string | null }
}

// ─── Bordro Süreç ─────────────────────────────────────────────────────────────
export type SurecAdimKodu = 'puantaj_toplama' | 'bordro_hazirlama' | 'maas_odeme' | 'dekont_yukleme'
export type SurecDurum    = 'bekliyor' | 'devam' | 'tamamlandi' | 'uyari'

export interface BordroSurecAdim {
  id: string
  donem_id: string
  firma_id: string
  adim_kodu: SurecAdimKodu
  adim_adi: string
  sira: number
  durum: SurecDurum
  tamamlanma_tarihi: string | null
  notlar: string | null
  created_at: string
}

export interface BordroBelge {
  id: string
  donem_id: string
  firma_id: string
  adim_kodu: string
  belge_tipi: string
  dosya_adi: string
  storage_path: string
  yukleyen: string | null
  aciklama: string | null
  created_at: string
}

// BordroDonemi genişletilmiş
export interface BordroDonemiDetay extends BordroDonemi {
  proje_id: string | null
  ekip_id: string | null
  ay: number | null
  yil: number | null
  onceki_ay: boolean
  projeler?: { proje_adi: string }
  ekipler?: { ekip_adi: string }
  surec_adimlari?: BordroSurecAdim[]
  belgeler?: BordroBelge[]
}
