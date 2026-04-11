export interface Firma {
  id: string;
  ad: string;
  kisa_ad: string | null;
  aktif: boolean;
  created_at: string;
}

export interface KullaniciProfil {
  id: string;
  auth_user_id: string;
  firma_id: string;
  ad_soyad: string | null;
  email: string | null;
  rol: string;
  aktif: boolean;
  created_at: string;
}

export type ModuleId = 
  | 'cari' 
  | 'banka' 
  | 'fatura' 
  | 'cek-senet' 
  | 'finans' 
  | 'bordro' 
  | 'ik' 
  | 'icra' 
  | 'proje' 
  | 'vergi' 
  | 'raporlar' 
  | 'stok' 
  | 'ayarlar';

export interface NavItem {
  id: ModuleId;
  label: string;
  icon: React.ElementType;
  group: string;
  color: string;
}

// Cari Types
export interface Cari {
  id: string;
  firma_id: string;
  kod: string;
  unvan: string;
  vergi_dairesi: string | null;
  vergi_no: string | null;
  telefon: string | null;
  email: string | null;
  adres: string | null;
  bakiye: number;
  limit: number | null;
  risk_durumu: 'dusuk' | 'orta' | 'yuksek';
  notlar: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface CariHareket {
  id: string;
  firma_id: string;
  cari_id: string;
  hareket_tipi: 'fatura' | 'tahsilat' | 'odeme' | 'duzenleme';
  bagli_tablo: string | null;
  bagli_kayit_id: string | null;
  tutar: number;
  aciklama: string | null;
  tarih: string;
  created_at: string;
}

// Banka Types
export interface BankaHesap {
  id: string;
  firma_id: string;
  banka_adi: string;
  sube_adi: string | null;
  hesap_no: string | null;
  iban: string | null;
  bakiye: number;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankaHareket {
  id: string;
  firma_id: string;
  banka_hesap_id: string;
  islem_tipi: 'giris' | 'cikis';
  bagli_tablo: string | null;
  bagli_kayit_id: string | null;
  tutar: number;
  aciklama: string | null;
  tarih: string;
  created_at: string;
}

// Fatura Types
export interface Fatura {
  id: string;
  firma_id: string;
  cari_id: string;
  fatura_tipi: 'satis' | 'alis';
  fatura_no: string;
  tarih: string;
  vade_tarihi: string | null;
  toplam_tutar: number;
  kdv_tutari: number;
  genel_toplam: number;
  e_fatura_mi: boolean;
  e_fatura_no: string | null;
  durum: 'bekliyor' | 'onaylandi' | 'iptal';
  created_at: string;
  updated_at: string;
}

export interface FaturaSatir {
  id: string;
  firma_id: string;
  fatura_id: string;
  stok_kodu: string | null;
  stok_adi: string | null;
  miktar: number;
  birim_fiyat: number;
  kdv_orani: number;
  kdv_tutari: number;
  satir_tutari: number;
  created_at: string;
}

// Çek-Senet Types
export interface Cek {
  id: string;
  firma_id: string;
  cari_id: string | null;
  cek_no: string;
  tutar: number;
  cek_tarihi: string;
  vade_tarihi: string;
  banka_adi: string | null;
  sube_adi: string | null;
  durum: 'portfoy' | 'ciro' | 'tahsil' | 'geri' | 'kismi_tahsil' | 'kismi_geri';
  ciro_edilen_cari_id: string | null;
  aciklama: string | null;
  created_at: string;
  updated_at: string;
}

export interface Senet {
  id: string;
  firma_id: string;
  cari_id: string | null;
  senet_no: string;
  tutar: number;
  senet_tarihi: string;
  vade_tarihi: string;
  kefil: string | null;
  durum: 'portfoy' | 'ciro' | 'tahsil' | 'geri' | 'kismi_tahsil' | 'kismi_geri';
  ciro_edilen_cari_id: string | null;
  aciklama: string | null;
  created_at: string;
  updated_at: string;
}

// Bordro-İK Types
export interface Personel {
  id: string;
  firma_id: string;
  tc_no: string;
  ad_soyad: string;
  dogum_tarihi: string | null;
  gorev: string | null;
  departman: string | null;
  maas: number;
  sigorta_no: string | null;
  sigorta_tarihi: string | null;
  ise_giris_tarihi: string;
  isten_cikis_tarihi: string | null;
  durum: 'aktif' | 'pasif';
  created_at: string;
  updated_at: string;
}

export interface BordroDonem {
  id: string;
  firma_id: string;
  donem: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  puantaj_tarihi: string | null;
  bordro_tarihi: string | null;
  durum: 'hazirlaniyor' | 'hesaplandi' | 'odendi';
  created_at: string;
}

// Proje Types
export interface Proje {
  id: string;
  firma_id: string;
  proje_kodu: string;
  proje_adi: string;
  musteri_id: string | null;
  baslangic_tarihi: string;
  bitis_tarihi: string | null;
  durum: 'devam' | 'tamamlandi' | 'iptal';
  toplam_butce: number;
  harcanan_butce: number;
  created_at: string;
  updated_at: string;
}

export interface ProjeGorev {
  id: string;
  firma_id: string;
  proje_id: string;
  gorev_adi: string;
  sorumlu_personel_id: string | null;
  baslangic_tarihi: string;
  bitis_tarihi: string | null;
  durum: 'bekliyor' | 'devam' | 'tamamlandi';
  created_at: string;
  updated_at: string;
}

// Stok Types
export interface StokKart {
  id: string;
  firma_id: string;
  stok_kodu: string;
  stok_adi: string;
  birim: string;
  birim_fiyat: number;
  stok_miktari: number;
  created_at: string;
  updated_at: string;
}