-- ============================================================
-- ETM BİNYAPI ERP — TAM VERİTABANI ŞEMASI
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- ─── FİRMALAR ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firmalar (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad         TEXT NOT NULL,
  kisa_ad    TEXT,
  vergi_no   TEXT,
  aktif      BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── KULLANICI PROFİLLERİ ────────────────────────────────────
CREATE TABLE IF NOT EXISTS kullanici_profilleri (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad_soyad     TEXT,
  email        TEXT,
  rol          TEXT DEFAULT 'admin' CHECK (rol IN ('admin','muhasebe','ik','izleyici')),
  aktif        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROJELER ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeler (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id          UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_adi         TEXT NOT NULL,
  aciklama          TEXT,
  baslangic_tarihi  DATE,
  bitis_tarihi      DATE,
  butce             NUMERIC(14,2),
  durum             TEXT DEFAULT 'planlama' CHECK (durum IN ('planlama','devam','tamamlandi','iptal')),
  sorumlu_kisi      TEXT,
  notlar            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PERSONELLER ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personeller (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id              UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad_soyad              TEXT NOT NULL,
  tc_kimlik             TEXT,
  telefon               TEXT,
  pozisyon              TEXT,
  maas_tipi             TEXT DEFAULT 'aylik' CHECK (maas_tipi IN ('aylik','gundelik','saatlik')),
  net_maas              NUMERIC(12,2),
  brut_maas             NUMERIC(12,2),
  ise_giris_tarihi      DATE,
  isten_cikis_tarihi    DATE,
  varsayilan_proje_id   UUID REFERENCES projeler(id) ON DELETE SET NULL,
  sgk_no                TEXT,
  banka_iban            TEXT,
  aktif                 BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── KASA HAREKETLERİ ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kasa_hareketleri (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id    UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  islem_tipi  TEXT NOT NULL CHECK (islem_tipi IN ('giris','cikis')),
  tutar       NUMERIC(12,2) NOT NULL,
  aciklama    TEXT,
  tarih       DATE NOT NULL DEFAULT CURRENT_DATE,
  proje_id    UUID REFERENCES projeler(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BANKA HESAPLARI ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banka_hesaplari (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id    UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  banka_adi   TEXT NOT NULL,
  sube_adi    TEXT,
  hesap_no    TEXT,
  iban        TEXT,
  bakiye      NUMERIC(12,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ÖDEME PLANI ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS odeme_plani (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id       UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  odeme_tipi     TEXT DEFAULT 'diger' CHECK (odeme_tipi IN ('cek','cari','vergi','sgk','maas','diger')),
  aciklama       TEXT,
  tutar          NUMERIC(12,2) NOT NULL DEFAULT 0,
  odenen_tutar   NUMERIC(12,2) NOT NULL DEFAULT 0,
  kalan_tutar    NUMERIC(12,2) NOT NULL DEFAULT 0,
  vade_tarihi    DATE NOT NULL,
  odeme_tarihi   DATE,
  durum          TEXT DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','odendi','kismi','iptal')),
  cek_no         TEXT,
  banka_hesabi   TEXT,
  notlar         TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── KAR ZARAR ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kar_zarar (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem               TEXT NOT NULL,
  baslangic_tarihi    DATE,
  bitis_tarihi        DATE,
  hakedisler          NUMERIC(14,2) DEFAULT 0,
  diger_gelirler      NUMERIC(14,2) DEFAULT 0,
  malzeme_giderleri   NUMERIC(14,2) DEFAULT 0,
  iscilik_giderleri   NUMERIC(14,2) DEFAULT 0,
  genel_giderler      NUMERIC(14,2) DEFAULT 0,
  finans_giderleri    NUMERIC(14,2) DEFAULT 0,
  diger_giderler      NUMERIC(14,2) DEFAULT 0,
  toplam_gelir        NUMERIC(14,2) DEFAULT 0,
  toplam_gider        NUMERIC(14,2) DEFAULT 0,
  net_kar_zarar       NUMERIC(14,2) DEFAULT 0,
  notlar              TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BORDRO DÖNEMLERİ ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bordro_donemleri (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id          UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem_adi         TEXT NOT NULL,
  baslangic_tarihi  DATE NOT NULL,
  bitis_tarihi      DATE NOT NULL,
  bordro_tarihi     DATE NOT NULL,
  durum             TEXT DEFAULT 'hazirlaniyor' CHECK (durum IN ('hazirlaniyor','onaylandi','odendi')),
  toplam_net        NUMERIC(14,2),
  toplam_brut       NUMERIC(14,2),
  aciklama          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BORDRO KALEMLERİ ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bordro_kalemleri (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  donem_id          UUID NOT NULL REFERENCES bordro_donemleri(id) ON DELETE CASCADE,
  firma_id          UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  personel_id       UUID NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
  calisma_gunu      INTEGER,
  brut_maas         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgk_isci          NUMERIC(12,2) NOT NULL DEFAULT 0,
  gelir_vergisi     NUMERIC(12,2) NOT NULL DEFAULT 0,
  damga_vergisi     NUMERIC(12,2) NOT NULL DEFAULT 0,
  diger_kesintiler  NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_maas          NUMERIC(12,2) NOT NULL DEFAULT 0,
  odeme_tarihi      DATE,
  odendi            BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── İCRA TAKİBİ ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS icra_takibi (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id         UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  personel_id      UUID NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
  icra_tipi        TEXT DEFAULT 'ilamsiz' CHECK (icra_tipi IN ('ilamsiz','ilamli','haciz','nafaka','diger')),
  dosya_no         TEXT NOT NULL,
  icra_dairesi     TEXT,
  alacakli         TEXT,
  toplam_borc      NUMERIC(12,2) DEFAULT 0,
  odenen_tutar     NUMERIC(12,2) DEFAULT 0,
  kalan_borc       NUMERIC(12,2) DEFAULT 0,
  aylik_kesinti    NUMERIC(12,2) DEFAULT 0,
  baslangic_tarihi DATE,
  bitis_tarihi     DATE,
  durum            TEXT DEFAULT 'aktif' CHECK (durum IN ('aktif','odeme_plani','kapandi','itiraz')),
  avukat_adi       TEXT,
  avukat_telefon   TEXT,
  notlar           TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SGK BEYAN ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sgk_beyan (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem               TEXT NOT NULL,
  calisma_gun_sayisi  INTEGER,
  sigortali_sayisi    INTEGER,
  prim_tutari         NUMERIC(12,2) DEFAULT 0,
  isverenin_payi      NUMERIC(12,2) DEFAULT 0,
  isci_payi           NUMERIC(12,2) DEFAULT 0,
  toplam_prim         NUMERIC(12,2) DEFAULT 0,
  son_odeme_tarihi    DATE,
  odeme_tarihi        DATE,
  durum               TEXT DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','odendi','gecikti')),
  notlar              TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS POLİTİKALARI
-- ============================================================
DO $$ 
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['firmalar','kullanici_profilleri','projeler','personeller',
    'kasa_hareketleri','banka_hesaplari','odeme_plani','kar_zarar',
    'bordro_donemleri','bordro_kalemleri','icra_takibi','sgk_beyan']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Kullanıcı kendi firmasına ait verileri görebilir
CREATE POLICY IF NOT EXISTS "firma_izolasyon" ON firmalar
  FOR ALL USING (
    id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "kullanici_profil" ON kullanici_profilleri
  FOR ALL USING (auth_user_id = auth.uid());

-- Diğer tablolar için firma_id bazlı policy
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projeler','personeller','kasa_hareketleri','banka_hesaplari',
    'odeme_plani','kar_zarar','bordro_donemleri','bordro_kalemleri','icra_takibi','sgk_beyan']
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "firma_policy_%s" ON %I FOR ALL USING (
        firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
      )', t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- GRANT
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- ÖRNEK VERİ (İsteğe bağlı — test için)
-- ============================================================
-- INSERT INTO firmalar (ad, kisa_ad) VALUES
--   ('ETM Tünel Kalıp A.Ş.', 'ETM-TK'),
--   ('ETM Ahşap Kalıp A.Ş.', 'ETM-AK');
