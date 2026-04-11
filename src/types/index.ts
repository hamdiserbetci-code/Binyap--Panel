export interface Firma {
  id: string;
  ad: string;
  kisa_ad: string | null;
  vergi_no?: string | null;
  is_center?: boolean;
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
  | 'finance' 
  | 'cari' 
  | 'hr' 
  | 'payrolls' 
  | 'projects' 
  | 'tasks'
  | 'ayarlar';

export interface NavItem {
  id: ModuleId;
  label: string;
  icon: React.ElementType;
  group: string;
  color: string;
}

export interface Proje {
  id: string;
  firma_id: string;
  proje_adi: string;
  durum: string;
}

export interface CariKart {
  id: string;
  firma_id: string;
  kod: string;
  unvan: string;
  tip: 'alici' | 'satici' | 'personel' | 'banka' | 'kasa' | 'diger';
  bakiye: number;
}

export interface FinansalHareket {
  id: string;
  firma_id: string;
  proje_id: string | null;
  cari_id: string | null;
  tarih: string;
  islem_tipi: 'fatura' | 'tahsilat' | 'odeme' | 'bordro';
  tutar: number;
  yon: 'giris' | 'cikis';
  aciklama: string | null;
  created_at: string;
}

export interface Personel {
  id: string;
  firma_id: string;
  ad_soyad: string;
  maas_tipi: string;
  net_maas: number | null;
  varsayilan_proje_id: string | null;
  aktif: boolean;
}

export interface Bordro {
  id: string;
  firma_id: string;
  personel_id: string;
  donem: string;
  brut_toplam: number | null;
  net_toplam: number | null;
  kesintiler: any;
  created_at: string;
}