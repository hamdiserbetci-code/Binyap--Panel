-- =============================================
-- PERSONEL TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS personeller (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad_soyad TEXT NOT NULL,
  tc_kimlik TEXT,
  telefon TEXT,
  pozisyon TEXT,
  maas_tipi TEXT DEFAULT 'aylik' CHECK (maas_tipi IN ('aylik', 'gundelik', 'saatlik')),
  net_maas NUMERIC(12,2) DEFAULT 0,
  brut_maas NUMERIC(12,2) DEFAULT 0,
  ise_giris_tarihi DATE,
  isten_cikis_tarihi DATE,
  varsayilan_proje_id UUID REFERENCES projeler_conf(id) ON DELETE SET NULL,
  sgk_no TEXT,
  banka_iban TEXT,
  adres TEXT,
  notlar TEXT,
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE personeller ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personeller_firma_policy" ON personeller
  USING (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  );

-- =============================================
-- İCRA TAKİBİ TABLOSU
-- =============================================
CREATE TABLE IF NOT EXISTS icra_takibi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  personel_id UUID NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
  icra_tipi TEXT DEFAULT 'ilamsiz' CHECK (icra_tipi IN ('ilamsiz', 'ilamli', 'haciz', 'nafaka', 'diger')),
  dosya_no TEXT NOT NULL,
  icra_dairesi TEXT,
  alacakli TEXT,
  toplam_borc NUMERIC(12,2) DEFAULT 0,
  odenen_tutar NUMERIC(12,2) DEFAULT 0,
  kalan_borc NUMERIC(12,2) GENERATED ALWAYS AS (toplam_borc - odenen_tutar) STORED,
  aylik_kesinti NUMERIC(12,2) DEFAULT 0,
  baslangic_tarihi DATE,
  bitis_tarihi DATE,
  durum TEXT DEFAULT 'aktif' CHECK (durum IN ('aktif', 'odeme_plani', 'kapandi', 'itiraz')),
  avukat_adi TEXT,
  avukat_telefon TEXT,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE icra_takibi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icra_takibi_firma_policy" ON icra_takibi
  USING (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  );

-- =============================================
-- KASA HAREKETLERİ TABLOSU (yoksa oluştur)
-- =============================================
CREATE TABLE IF NOT EXISTS kasa_hareketleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  islem_tipi TEXT NOT NULL CHECK (islem_tipi IN ('giris', 'cikis')),
  tutar NUMERIC(12,2) NOT NULL,
  aciklama TEXT,
  tarih DATE NOT NULL DEFAULT CURRENT_DATE,
  proje_id UUID REFERENCES projeler_conf(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kasa_hareketleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kasa_hareketleri_firma_policy" ON kasa_hareketleri
  USING (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  );

-- =============================================
-- BANKA HESAPLARI TABLOSU (yoksa oluştur)
-- =============================================
CREATE TABLE IF NOT EXISTS banka_hesaplari (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  banka_adi TEXT NOT NULL,
  sube_adi TEXT,
  hesap_no TEXT,
  iban TEXT,
  bakiye NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE banka_hesaplari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banka_hesaplari_firma_policy" ON banka_hesaplari
  USING (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  );

-- =============================================
-- GRANT
-- =============================================
GRANT ALL ON personeller TO authenticated;
GRANT ALL ON icra_takibi TO authenticated;
GRANT ALL ON kasa_hareketleri TO authenticated;
GRANT ALL ON banka_hesaplari TO authenticated;
