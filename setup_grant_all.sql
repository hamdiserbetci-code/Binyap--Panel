-- =============================================================================
-- GRANT ALL + RLS OPEN ACCESS — Tüm tablolar için tek tek
-- Supabase SQL Editor'de çalıştırın
-- =============================================================================

-- Her tabloyu açıkça GRANT et ve RLS politikasını ayarla

DO $$ BEGIN

  -- ── Ana tablolar ─────────────────────────────────────────────────────────
  PERFORM 1; -- no-op

END $$;

-- firmalar
GRANT ALL ON TABLE firmalar TO authenticated, service_role;
ALTER TABLE firmalar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON firmalar;
DROP POLICY IF EXISTS "firmalar_select" ON firmalar;
DROP POLICY IF EXISTS "firmalar_insert" ON firmalar;
DROP POLICY IF EXISTS "firmalar_update" ON firmalar;
DROP POLICY IF EXISTS "firmalar_delete" ON firmalar;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON firmalar;
CREATE POLICY "open" ON firmalar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sirketler
GRANT ALL ON TABLE sirketler TO authenticated, service_role;
ALTER TABLE sirketler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON sirketler;
DROP POLICY IF EXISTS "sirketler_select" ON sirketler;
DROP POLICY IF EXISTS "sirketler_insert" ON sirketler;
DROP POLICY IF EXISTS "sirketler_update" ON sirketler;
DROP POLICY IF EXISTS "sirketler_delete" ON sirketler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON sirketler;
CREATE POLICY "open" ON sirketler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kullanici_profilleri
GRANT ALL ON TABLE kullanici_profilleri TO authenticated, service_role;
ALTER TABLE kullanici_profilleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON kullanici_profilleri;
DROP POLICY IF EXISTS "kullanici_profilleri_select" ON kullanici_profilleri;
DROP POLICY IF EXISTS "kullanici_profilleri_insert" ON kullanici_profilleri;
DROP POLICY IF EXISTS "kullanici_profilleri_update" ON kullanici_profilleri;
DROP POLICY IF EXISTS "kullanici_profilleri_delete" ON kullanici_profilleri;
CREATE POLICY "open" ON kullanici_profilleri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kullanici_yetkileri
GRANT ALL ON TABLE kullanici_yetkileri TO authenticated, service_role;
ALTER TABLE kullanici_yetkileri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON kullanici_yetkileri;
DROP POLICY IF EXISTS "kullanici_yetkileri_select" ON kullanici_yetkileri;
DROP POLICY IF EXISTS "kullanici_yetkileri_insert" ON kullanici_yetkileri;
DROP POLICY IF EXISTS "kullanici_yetkileri_update" ON kullanici_yetkileri;
DROP POLICY IF EXISTS "kullanici_yetkileri_delete" ON kullanici_yetkileri;
CREATE POLICY "open" ON kullanici_yetkileri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- projeler
GRANT ALL ON TABLE projeler TO authenticated, service_role;
ALTER TABLE projeler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON projeler;
DROP POLICY IF EXISTS "projeler_select" ON projeler;
DROP POLICY IF EXISTS "projeler_insert" ON projeler;
DROP POLICY IF EXISTS "projeler_update" ON projeler;
DROP POLICY IF EXISTS "projeler_delete" ON projeler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON projeler;
CREATE POLICY "open" ON projeler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ekipler
CREATE TABLE IF NOT EXISTS ekipler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad TEXT NOT NULL,
  kategori TEXT,
  renk TEXT NOT NULL DEFAULT 'blue',
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE ekipler TO authenticated, service_role;
ALTER TABLE ekipler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON ekipler;
DROP POLICY IF EXISTS "ekipler_select" ON ekipler;
DROP POLICY IF EXISTS "ekipler_insert" ON ekipler;
DROP POLICY IF EXISTS "ekipler_update" ON ekipler;
DROP POLICY IF EXISTS "ekipler_delete" ON ekipler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON ekipler;
CREATE POLICY "open" ON ekipler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ekip_calisanlari
CREATE TABLE IF NOT EXISTS ekip_calisanlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ekip_id UUID NOT NULL REFERENCES ekipler(id) ON DELETE CASCADE,
  kullanici_id UUID NOT NULL REFERENCES kullanici_profilleri(id) ON DELETE CASCADE,
  rol TEXT DEFAULT 'uye',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE ekip_calisanlari TO authenticated, service_role;
ALTER TABLE ekip_calisanlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON ekip_calisanlari;
DROP POLICY IF EXISTS "ekip_calisanlari_select" ON ekip_calisanlari;
DROP POLICY IF EXISTS "ekip_calisanlari_insert" ON ekip_calisanlari;
DROP POLICY IF EXISTS "ekip_calisanlari_update" ON ekip_calisanlari;
DROP POLICY IF EXISTS "ekip_calisanlari_delete" ON ekip_calisanlari;
DROP POLICY IF EXISTS "ekip_calisanlari_izolasyon" ON ekip_calisanlari;
CREATE POLICY "open" ON ekip_calisanlari FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kasa_hareketleri
CREATE TABLE IF NOT EXISTS kasa_hareketleri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  sirket TEXT NOT NULL DEFAULT 'ETM',
  proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
  tarih DATE NOT NULL DEFAULT CURRENT_DATE,
  tur TEXT NOT NULL DEFAULT 'gelir',
  tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
  kategori TEXT,
  odeme_sekli TEXT DEFAULT 'nakit',
  aciklama TEXT,
  belge_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE kasa_hareketleri TO authenticated, service_role;
ALTER TABLE kasa_hareketleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON kasa_hareketleri;
DROP POLICY IF EXISTS "kasa_hareketleri_select" ON kasa_hareketleri;
DROP POLICY IF EXISTS "kasa_hareketleri_insert" ON kasa_hareketleri;
DROP POLICY IF EXISTS "kasa_hareketleri_update" ON kasa_hareketleri;
DROP POLICY IF EXISTS "kasa_hareketleri_delete" ON kasa_hareketleri;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON kasa_hareketleri;
CREATE POLICY "open" ON kasa_hareketleri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cari_hesaplar
GRANT ALL ON TABLE cari_hesaplar TO authenticated, service_role;
ALTER TABLE cari_hesaplar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON cari_hesaplar;
DROP POLICY IF EXISTS "cari_hesaplar_select" ON cari_hesaplar;
DROP POLICY IF EXISTS "cari_hesaplar_insert" ON cari_hesaplar;
DROP POLICY IF EXISTS "cari_hesaplar_update" ON cari_hesaplar;
DROP POLICY IF EXISTS "cari_hesaplar_delete" ON cari_hesaplar;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON cari_hesaplar;
CREATE POLICY "open" ON cari_hesaplar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cari_hareketler
GRANT ALL ON TABLE cari_hareketler TO authenticated, service_role;
ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON cari_hareketler;
DROP POLICY IF EXISTS "cari_hareketler_select" ON cari_hareketler;
DROP POLICY IF EXISTS "cari_hareketler_insert" ON cari_hareketler;
DROP POLICY IF EXISTS "cari_hareketler_update" ON cari_hareketler;
DROP POLICY IF EXISTS "cari_hareketler_delete" ON cari_hareketler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON cari_hareketler;
CREATE POLICY "open" ON cari_hareketler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- dokumanlar
GRANT ALL ON TABLE dokumanlar TO authenticated, service_role;
ALTER TABLE dokumanlar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON dokumanlar;
DROP POLICY IF EXISTS "dokumanlar_select" ON dokumanlar;
DROP POLICY IF EXISTS "dokumanlar_insert" ON dokumanlar;
DROP POLICY IF EXISTS "dokumanlar_update" ON dokumanlar;
DROP POLICY IF EXISTS "dokumanlar_delete" ON dokumanlar;
DROP POLICY IF EXISTS "firma_izolasyonu" ON dokumanlar;
DROP POLICY IF EXISTS "dokumanlar_firma_izolasyonu" ON dokumanlar;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON dokumanlar;
CREATE POLICY "open" ON dokumanlar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vergi_beyannameleri
GRANT ALL ON TABLE vergi_beyannameleri TO authenticated, service_role;
ALTER TABLE vergi_beyannameleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON vergi_beyannameleri;
DROP POLICY IF EXISTS "vergi_beyannameleri_select" ON vergi_beyannameleri;
DROP POLICY IF EXISTS "vergi_beyannameleri_insert" ON vergi_beyannameleri;
DROP POLICY IF EXISTS "vergi_beyannameleri_update" ON vergi_beyannameleri;
DROP POLICY IF EXISTS "vergi_beyannameleri_delete" ON vergi_beyannameleri;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON vergi_beyannameleri;
CREATE POLICY "open" ON vergi_beyannameleri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vergi_odemeleri
GRANT ALL ON TABLE vergi_odemeleri TO authenticated, service_role;
ALTER TABLE vergi_odemeleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON vergi_odemeleri;
DROP POLICY IF EXISTS "vergi_odemeleri_select" ON vergi_odemeleri;
DROP POLICY IF EXISTS "vergi_odemeleri_insert" ON vergi_odemeleri;
DROP POLICY IF EXISTS "vergi_odemeleri_update" ON vergi_odemeleri;
DROP POLICY IF EXISTS "vergi_odemeleri_delete" ON vergi_odemeleri;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON vergi_odemeleri;
CREATE POLICY "open" ON vergi_odemeleri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vergi_takvimi
GRANT ALL ON TABLE vergi_takvimi TO authenticated, service_role;
ALTER TABLE vergi_takvimi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON vergi_takvimi;
DROP POLICY IF EXISTS "vergi_takvimi_select" ON vergi_takvimi;
CREATE POLICY "open" ON vergi_takvimi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- faturalar
GRANT ALL ON TABLE faturalar TO authenticated, service_role;
ALTER TABLE faturalar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON faturalar;
DROP POLICY IF EXISTS "faturalar_select" ON faturalar;
DROP POLICY IF EXISTS "faturalar_insert" ON faturalar;
DROP POLICY IF EXISTS "faturalar_update" ON faturalar;
DROP POLICY IF EXISTS "faturalar_delete" ON faturalar;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON faturalar;
CREATE POLICY "open" ON faturalar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- fatura_satirlari
GRANT ALL ON TABLE fatura_satirlari TO authenticated, service_role;
ALTER TABLE fatura_satirlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON fatura_satirlari;
DROP POLICY IF EXISTS "fatura_satirlari_select" ON fatura_satirlari;
DROP POLICY IF EXISTS "fatura_satirlari_insert" ON fatura_satirlari;
DROP POLICY IF EXISTS "fatura_satirlari_update" ON fatura_satirlari;
DROP POLICY IF EXISTS "fatura_satirlari_delete" ON fatura_satirlari;
CREATE POLICY "open" ON fatura_satirlari FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- bankalar
GRANT ALL ON TABLE bankalar TO authenticated, service_role;
ALTER TABLE bankalar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON bankalar;
DROP POLICY IF EXISTS "bankalar_select" ON bankalar;
DROP POLICY IF EXISTS "bankalar_insert" ON bankalar;
DROP POLICY IF EXISTS "bankalar_update" ON bankalar;
DROP POLICY IF EXISTS "bankalar_delete" ON bankalar;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON bankalar;
CREATE POLICY "open" ON bankalar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- banka_hareketleri
GRANT ALL ON TABLE banka_hareketleri TO authenticated, service_role;
ALTER TABLE banka_hareketleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON banka_hareketleri;
DROP POLICY IF EXISTS "banka_hareketleri_select" ON banka_hareketleri;
DROP POLICY IF EXISTS "banka_hareketleri_insert" ON banka_hareketleri;
DROP POLICY IF EXISTS "banka_hareketleri_update" ON banka_hareketleri;
DROP POLICY IF EXISTS "banka_hareketleri_delete" ON banka_hareketleri;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON banka_hareketleri;
CREATE POLICY "open" ON banka_hareketleri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- puantaj_kayitlari
GRANT ALL ON TABLE puantaj_kayitlari TO authenticated, service_role;
ALTER TABLE puantaj_kayitlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON puantaj_kayitlari;
DROP POLICY IF EXISTS "puantaj_kayitlari_select" ON puantaj_kayitlari;
DROP POLICY IF EXISTS "puantaj_kayitlari_insert" ON puantaj_kayitlari;
DROP POLICY IF EXISTS "puantaj_kayitlari_update" ON puantaj_kayitlari;
DROP POLICY IF EXISTS "puantaj_kayitlari_delete" ON puantaj_kayitlari;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON puantaj_kayitlari;
CREATE POLICY "open" ON puantaj_kayitlari FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- gorevler (eski tablo, is_takip için alias)
GRANT ALL ON TABLE gorevler TO authenticated, service_role;
ALTER TABLE gorevler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON gorevler;
DROP POLICY IF EXISTS "gorevler_select" ON gorevler;
DROP POLICY IF EXISTS "gorevler_insert" ON gorevler;
DROP POLICY IF EXISTS "gorevler_update" ON gorevler;
DROP POLICY IF EXISTS "gorevler_delete" ON gorevler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON gorevler;
CREATE POLICY "open" ON gorevler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- aktivite_loglari
GRANT ALL ON TABLE aktivite_loglari TO authenticated, service_role;
ALTER TABLE aktivite_loglari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON aktivite_loglari;
DROP POLICY IF EXISTS "aktivite_loglari_select" ON aktivite_loglari;
DROP POLICY IF EXISTS "aktivite_loglari_insert" ON aktivite_loglari;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON aktivite_loglari;
CREATE POLICY "open" ON aktivite_loglari FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tedarikciler
GRANT ALL ON TABLE tedarikciler TO authenticated, service_role;
ALTER TABLE tedarikciler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON tedarikciler;
DROP POLICY IF EXISTS "tedarikciler_select" ON tedarikciler;
DROP POLICY IF EXISTS "tedarikciler_insert" ON tedarikciler;
DROP POLICY IF EXISTS "tedarikciler_update" ON tedarikciler;
DROP POLICY IF EXISTS "tedarikciler_delete" ON tedarikciler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON tedarikciler;
CREATE POLICY "open" ON tedarikciler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- satinalma_talepleri
GRANT ALL ON TABLE satinalma_talepleri TO authenticated, service_role;
ALTER TABLE satinalma_talepleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON satinalma_talepleri;
DROP POLICY IF EXISTS "satinalma_talepleri_select" ON satinalma_talepleri;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON satinalma_talepleri;
CREATE POLICY "open" ON satinalma_talepleri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- satinalma_siparisleri
GRANT ALL ON TABLE satinalma_siparisleri TO authenticated, service_role;
ALTER TABLE satinalma_siparisleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON satinalma_siparisleri;
DROP POLICY IF EXISTS "satinalma_siparisleri_select" ON satinalma_siparisleri;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON satinalma_siparisleri;
CREATE POLICY "open" ON satinalma_siparisleri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Modül tabloları (setup dosyalarından) ────────────────────────────────────

-- musteriler
CREATE TABLE IF NOT EXISTS musteriler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad TEXT NOT NULL, kisa_ad TEXT, vergi_no TEXT, yetkili TEXT,
  telefon TEXT, email TEXT, sektor TEXT, notlar TEXT,
  aktif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE musteriler TO authenticated, service_role;
ALTER TABLE musteriler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON musteriler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON musteriler;
DROP POLICY IF EXISTS "open" ON musteriler;
CREATE POLICY "open" ON musteriler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- gunluk_isler
CREATE TABLE IF NOT EXISTS gunluk_isler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  kullanici_id UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
  baslik TEXT NOT NULL, aciklama TEXT, matris TEXT,
  durum TEXT DEFAULT 'bekliyor', tarih DATE DEFAULT CURRENT_DATE,
  hatirlatici TEXT, hatirlatici_tarihi DATE, hatirlatici_saati TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE gunluk_isler TO authenticated, service_role;
ALTER TABLE gunluk_isler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON gunluk_isler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON gunluk_isler;
DROP POLICY IF EXISTS "open" ON gunluk_isler;
CREATE POLICY "open" ON gunluk_isler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- is_takip
CREATE TABLE IF NOT EXISTS is_takip (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  tip TEXT NOT NULL, donem TEXT NOT NULL,
  adim1_durum TEXT DEFAULT 'bekliyor', adim1_tarihi DATE,
  adim2_durum TEXT DEFAULT 'bekliyor', adim2_tarihi DATE,
  durum TEXT DEFAULT 'aktif', notlar TEXT,
  hatirlatici_tarihi DATE, hatirlatici_saati TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE is_takip TO authenticated, service_role;
ALTER TABLE is_takip ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON is_takip;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON is_takip;
DROP POLICY IF EXISTS "open" ON is_takip;
CREATE POLICY "open" ON is_takip FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- is_sablonlari
CREATE TABLE IF NOT EXISTS is_sablonlari (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad TEXT NOT NULL, aciklama TEXT, tip TEXT, aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE is_sablonlari TO authenticated, service_role;
ALTER TABLE is_sablonlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON is_sablonlari;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON is_sablonlari;
DROP POLICY IF EXISTS "open" ON is_sablonlari;
CREATE POLICY "open" ON is_sablonlari FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- bordro_surecler
CREATE TABLE IF NOT EXISTS bordro_surecler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
  ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL,
  donem TEXT NOT NULL, durum TEXT DEFAULT 'bekliyor', notlar TEXT,
  hatirlatici_tarihi DATE, hatirlatici_saati TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE bordro_surecler TO authenticated, service_role;
ALTER TABLE bordro_surecler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON bordro_surecler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON bordro_surecler;
DROP POLICY IF EXISTS "open" ON bordro_surecler;
CREATE POLICY "open" ON bordro_surecler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- maliyet_surecler
CREATE TABLE IF NOT EXISTS maliyet_surecler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem TEXT NOT NULL, sorumlu_id UUID, teslim_gunu SMALLINT,
  efatura_kontrol BOOLEAN DEFAULT false, efatura_luca BOOLEAN DEFAULT false,
  earsiv_kontrol BOOLEAN DEFAULT false, earsiv_luca BOOLEAN DEFAULT false,
  utts_kontrol BOOLEAN DEFAULT false, utts_luca BOOLEAN DEFAULT false,
  bordro_kontrol BOOLEAN DEFAULT false, bordro_luca BOOLEAN DEFAULT false,
  satis_kontrol BOOLEAN DEFAULT false, satis_luca BOOLEAN DEFAULT false,
  durum TEXT DEFAULT 'bekliyor', notlar TEXT,
  hatirlatici_tarihi DATE, hatirlatici_saati TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE maliyet_surecler TO authenticated, service_role;
ALTER TABLE maliyet_surecler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON maliyet_surecler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON maliyet_surecler;
DROP POLICY IF EXISTS "maliyet_surecler_select" ON maliyet_surecler;
DROP POLICY IF EXISTS "open" ON maliyet_surecler;
CREATE POLICY "open" ON maliyet_surecler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cekler
CREATE TABLE IF NOT EXISTS cekler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  tip TEXT NOT NULL, cek_no TEXT NOT NULL, banka TEXT, cari_hesap TEXT,
  tutar NUMERIC(12,2) NOT NULL DEFAULT 0, keside_tarihi DATE, vade_tarihi DATE NOT NULL,
  durum TEXT NOT NULL DEFAULT 'bekliyor', aciklama TEXT,
  hatirlatici_tarihi DATE, hatirlatici_saati TEXT,
  hatirlat_gun_once INTEGER DEFAULT 1, tamamlandi_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS cari_hesap TEXT;
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS hatirlat_gun_once INTEGER DEFAULT 1;
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS tamamlandi_at TIMESTAMPTZ;
GRANT ALL ON TABLE cekler TO authenticated, service_role;
ALTER TABLE cekler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON cekler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_cekler_secer" ON cekler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_cekler_ekler" ON cekler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_cekler_gunceller" ON cekler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_cekler_siler" ON cekler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON cekler;
DROP POLICY IF EXISTS "open" ON cekler;
CREATE POLICY "open" ON cekler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- odeme_plani
CREATE TABLE IF NOT EXISTS odeme_plani (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  baslik TEXT NOT NULL, tur TEXT NOT NULL,
  tutar NUMERIC(12,2) NOT NULL DEFAULT 0,
  vade DATE, durum TEXT NOT NULL DEFAULT 'bekliyor', aciklama TEXT,
  hatirlatma TIMESTAMPTZ, erteleme_nedeni TEXT,
  user_id UUID, proje_id UUID, kaynak TEXT, musteri_id UUID, ekip_id UUID,
  ilgili_kurum TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS hatirlatma TIMESTAMPTZ;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS erteleme_nedeni TEXT;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS proje_id UUID;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS kaynak TEXT;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS musteri_id UUID;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS ekip_id UUID;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS ilgili_kurum TEXT;
GRANT ALL ON TABLE odeme_plani TO authenticated, service_role;
ALTER TABLE odeme_plani ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON odeme_plani;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_odeme_plani_secer" ON odeme_plani;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_odeme_plani_ekler" ON odeme_plani;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_odeme_plani_gunceller" ON odeme_plani;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_odeme_plani_siler" ON odeme_plani;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON odeme_plani;
DROP POLICY IF EXISTS "open" ON odeme_plani;
CREATE POLICY "open" ON odeme_plani FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kar_zarar_donem
CREATE TABLE IF NOT EXISTS kar_zarar_donem (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem TEXT NOT NULL, musteri_id UUID,
  satis_yurt_ici NUMERIC(14,2) DEFAULT 0, satis_yurt_disi NUMERIC(14,2) DEFAULT 0,
  satis_iade NUMERIC(14,2) DEFAULT 0, donem_basi_stok NUMERIC(14,2) DEFAULT 0,
  donem_sonu_stok NUMERIC(14,2) DEFAULT 0, alis_malzeme NUMERIC(14,2) DEFAULT 0,
  alis_efatura NUMERIC(14,2) DEFAULT 0, alis_arsiv NUMERIC(14,2) DEFAULT 0,
  alis_utts NUMERIC(14,2) DEFAULT 0, alis_iscilik NUMERIC(14,2) DEFAULT 0,
  gider_personel NUMERIC(14,2) DEFAULT 0, gider_kira NUMERIC(14,2) DEFAULT 0,
  gider_fatura NUMERIC(14,2) DEFAULT 0, gider_amortisman NUMERIC(14,2) DEFAULT 0,
  gider_diger NUMERIC(14,2) DEFAULT 0, gider_finansal NUMERIC(14,2) DEFAULT 0,
  vergi_orani NUMERIC(5,2) DEFAULT 22, notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE kar_zarar_donem TO authenticated, service_role;
ALTER TABLE kar_zarar_donem ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON kar_zarar_donem;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON kar_zarar_donem;
DROP POLICY IF EXISTS "open" ON kar_zarar_donem;
CREATE POLICY "open" ON kar_zarar_donem FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- icra_takibi
CREATE TABLE IF NOT EXISTS icra_takibi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  sirket TEXT NOT NULL DEFAULT 'ETM' CHECK (sirket IN ('ETM', 'BİNYAPI')),
  musteri_id UUID, borclu_adi TEXT NOT NULL, tc_no TEXT,
  isci_durumu TEXT DEFAULT 'calisiyor', cikis_tarihi DATE,
  icra_dairesi_adi TEXT NOT NULL, dosya_no TEXT NOT NULL,
  tebligat_tarihi DATE NOT NULL, alacakli_adi TEXT NOT NULL,
  borc_tutari NUMERIC(12,2) NOT NULL DEFAULT 0, faiz_orani NUMERIC(6,2) DEFAULT 0,
  tahsil_edilen NUMERIC(12,2) DEFAULT 0, durum TEXT DEFAULT 'devam_ediyor',
  notlar TEXT, tebligat_url TEXT, cevap_url TEXT,
  hatirlatici_tarihi DATE, hatirlatici_saati TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE icra_takibi TO authenticated, service_role;
ALTER TABLE icra_takibi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON icra_takibi;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON icra_takibi;
DROP POLICY IF EXISTS "open" ON icra_takibi;
CREATE POLICY "open" ON icra_takibi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- icra_odemeler
CREATE TABLE IF NOT EXISTS icra_odemeler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  icra_id UUID NOT NULL REFERENCES icra_takibi(id) ON DELETE CASCADE,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  sirket TEXT NOT NULL DEFAULT 'ETM' CHECK (sirket IN ('ETM', 'BİNYAPI')),
  odeme_tarihi DATE NOT NULL, tutar NUMERIC(12,2) NOT NULL DEFAULT 0,
  aciklama TEXT, makbuz_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE icra_odemeler TO authenticated, service_role;
ALTER TABLE icra_odemeler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON icra_odemeler;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON icra_odemeler;
DROP POLICY IF EXISTS "open" ON icra_odemeler;
CREATE POLICY "open" ON icra_odemeler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ik_personel
CREATE TABLE IF NOT EXISTS ik_personel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
  ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL,
  ad_soyad TEXT NOT NULL, tc_no TEXT, dogum_tarihi DATE,
  ise_giris_tarihi DATE NOT NULL, isten_cikis_tarihi DATE,
  gorev TEXT, maas NUMERIC(12,2), durum TEXT DEFAULT 'aktif',
  notlar TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ik_personel ADD COLUMN IF NOT EXISTS ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL;
GRANT ALL ON TABLE ik_personel TO authenticated, service_role;
ALTER TABLE ik_personel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON ik_personel;
DROP POLICY IF EXISTS "firma_ik_personel" ON ik_personel;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON ik_personel;
DROP POLICY IF EXISTS "open" ON ik_personel;
CREATE POLICY "open" ON ik_personel FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ik_belge
CREATE TABLE IF NOT EXISTS ik_belge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  personel_id UUID REFERENCES ik_personel(id) ON DELETE CASCADE,
  proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
  belge_tipi TEXT NOT NULL DEFAULT 'diger',
  dosya_adi TEXT NOT NULL, dosya_url TEXT NOT NULL,
  mime_type TEXT, dosya_boyutu BIGINT, aciklama TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON TABLE ik_belge TO authenticated, service_role;
ALTER TABLE ik_belge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON ik_belge;
DROP POLICY IF EXISTS "firma_ik_belge" ON ik_belge;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON ik_belge;
DROP POLICY IF EXISTS "open" ON ik_belge;
CREATE POLICY "open" ON ik_belge FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- dokumanlar
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS bagli_tablo TEXT;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS bagli_kayit_id UUID;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS modul TEXT;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS kategori TEXT;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS yukleyen_id UUID;
GRANT ALL ON TABLE dokumanlar TO authenticated, service_role;
ALTER TABLE dokumanlar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_full_access" ON dokumanlar;
DROP POLICY IF EXISTS "firma_izolasyonu" ON dokumanlar;
DROP POLICY IF EXISTS "dokumanlar_firma_izolasyonu" ON dokumanlar;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON dokumanlar;
DROP POLICY IF EXISTS "open" ON dokumanlar;
CREATE POLICY "open" ON dokumanlar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Tüm sequences ─────────────────────────────────────────────────────────────
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ── Schema cache yenile ───────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
