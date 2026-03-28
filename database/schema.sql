-- =============================================================================
-- İŞ TAKİP SİSTEMİ — VERİTABANI ŞEMASI
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Temizlik
DROP TABLE IF EXISTS hatirlaticilar CASCADE;
DROP TABLE IF EXISTS arsiv_dosyalar CASCADE;
DROP TABLE IF EXISTS bordro_surecler CASCADE;
DROP TABLE IF EXISTS gorevler CASCADE;
DROP TABLE IF EXISTS ekipler CASCADE;
DROP TABLE IF EXISTS projeler CASCADE;
DROP TABLE IF EXISTS is_sablonlari CASCADE;
DROP TABLE IF EXISTS musteriler CASCADE;
DROP TABLE IF EXISTS kullanici_profilleri CASCADE;
DROP TABLE IF EXISTS firmalar CASCADE;

-- =============================================================================
-- ANA FİRMA (muhasebe ofisi)
-- =============================================================================

CREATE TABLE firmalar (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ad          TEXT NOT NULL,
    kisa_ad     TEXT,
    vergi_no    TEXT,
    yetkili     TEXT,
    telefon     TEXT,
    email       TEXT,
    aktif       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kullanici_profilleri (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auth_user_id    UUID UNIQUE,
    firma_id        UUID REFERENCES firmalar(id) ON DELETE CASCADE,
    ad_soyad        TEXT,
    email           TEXT NOT NULL,
    rol             TEXT NOT NULL DEFAULT 'muhasebe',
    -- yonetici | muhasebe | izleme
    aktif           BOOLEAN NOT NULL DEFAULT true,
    son_giris_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- MÜŞTERİLER (muhasebe ofisinin takip ettiği müşteri firmalar)
-- =============================================================================

CREATE TABLE musteriler (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id    UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    ad          TEXT NOT NULL,
    kisa_ad     TEXT,
    vergi_no    TEXT,
    yetkili     TEXT,
    telefon     TEXT,
    email       TEXT,
    sektor      TEXT,
    aktif       BOOLEAN NOT NULL DEFAULT true,
    notlar      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PROJELER (bordro takibi için inşaat/saha projeleri)
-- =============================================================================

CREATE TABLE projeler (
    id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id         UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    musteri_id       UUID REFERENCES musteriler(id) ON DELETE SET NULL,
    ad               TEXT NOT NULL,
    kod              TEXT,
    baslangic_tarihi DATE,
    bitis_tarihi     DATE,
    durum            TEXT NOT NULL DEFAULT 'aktif',
    -- aktif | tamamlandi | beklemede | iptal
    notlar           TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- EKİPLER (proje altındaki çalışan grupları)
-- =============================================================================

CREATE TABLE ekipler (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id    UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id    UUID NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
    ad          TEXT NOT NULL,
    sorumlu     TEXT,
    aktif       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- İŞ ŞABLONLARI
-- =============================================================================

CREATE TABLE is_sablonlari (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id        UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    ad              TEXT NOT NULL,
    tip             TEXT NOT NULL,
    -- beyanname | odeme | bordro | mutabakat | edefter | diger
    periyot         TEXT NOT NULL,
    -- haftalik | aylik | uc_aylik | alti_aylik | yillik | tek_seferlik
    aciklama        TEXT,
    oncelik         TEXT NOT NULL DEFAULT 'orta',
    -- dusuk | orta | yuksek | kritik
    sorumlu_id      UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
    hatirlat_gun    INTEGER NOT NULL DEFAULT 3,
    aktif           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- GÖREVLER (müşteri firma bazında iş takip)
-- =============================================================================

CREATE TABLE gorevler (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id        UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    musteri_id      UUID REFERENCES musteriler(id) ON DELETE SET NULL,
    sablon_id       UUID REFERENCES is_sablonlari(id) ON DELETE SET NULL,
    ad              TEXT NOT NULL,
    tip             TEXT NOT NULL,
    -- beyanname | odeme | bordro | mutabakat | edefter | diger
    periyot         TEXT NOT NULL,
    donem           TEXT,
    son_tarih       DATE NOT NULL,
    oncelik         TEXT NOT NULL DEFAULT 'orta',
    sorumlu_id      UUID CONSTRAINT gorevler_sorumlu_id_fkey
                        REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
    durum           TEXT NOT NULL DEFAULT 'bekliyor',
    -- bekliyor | hazirlaniyor | kontrolde | tamamlandi | iptal
    notlar          TEXT,
    tamamlandi_at   TIMESTAMPTZ,
    tamamlayan_id   UUID CONSTRAINT gorevler_tamamlayan_id_fkey
                        REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
    arsiv_klasor    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- GÖREV GEÇMİŞ
-- =============================================================================

CREATE TABLE gorev_gecmis (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    gorev_id        UUID NOT NULL REFERENCES gorevler(id) ON DELETE CASCADE,
    eski_durum      TEXT,
    yeni_durum      TEXT NOT NULL,
    degistiren_id   UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
    aciklama        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- BORDRO SÜREÇ (proje + ekip + dönem bazında)
-- =============================================================================

CREATE TABLE bordro_surecler (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id        UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id        UUID NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
    ekip_id         UUID REFERENCES ekipler(id) ON DELETE SET NULL,
    donem           TEXT NOT NULL,  -- '2025-03'
    puantaj_durum   TEXT NOT NULL DEFAULT 'bekliyor',
    bordro_durum    TEXT NOT NULL DEFAULT 'bekliyor',
    teyit_durum     TEXT NOT NULL DEFAULT 'bekliyor',
    odeme_durum     TEXT NOT NULL DEFAULT 'bekliyor',
    santiye_durum   TEXT NOT NULL DEFAULT 'bekliyor',
    puantaj_tarihi  DATE,
    bordro_tarihi   DATE,
    teyit_tarihi    DATE,
    odeme_tarihi    DATE,
    santiye_tarihi  DATE,
    notlar          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proje_id, ekip_id, donem)
);

-- =============================================================================
-- HATIRLATICALAR
-- =============================================================================

CREATE TABLE hatirlaticilar (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    gorev_id        UUID NOT NULL REFERENCES gorevler(id) ON DELETE CASCADE,
    gonderim_tarihi DATE NOT NULL,
    kanal           TEXT NOT NULL DEFAULT 'uygulama',
    gonderildi      BOOLEAN NOT NULL DEFAULT false,
    gonderildi_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- İNDEXLER
-- =============================================================================

CREATE INDEX idx_gorev_firma      ON gorevler(firma_id);
CREATE INDEX idx_gorev_musteri    ON gorevler(musteri_id);
CREATE INDEX idx_gorev_durum      ON gorevler(durum);
CREATE INDEX idx_gorev_son_tarih  ON gorevler(son_tarih);
CREATE INDEX idx_gorev_tip        ON gorevler(tip);
CREATE INDEX idx_musteri_firma    ON musteriler(firma_id);
CREATE INDEX idx_proje_firma      ON projeler(firma_id);
CREATE INDEX idx_proje_musteri    ON projeler(musteri_id);
CREATE INDEX idx_ekip_proje       ON ekipler(proje_id);
CREATE INDEX idx_bordro_proje     ON bordro_surecler(proje_id);
CREATE INDEX idx_bordro_ekip      ON bordro_surecler(ekip_id);
CREATE INDEX idx_gecmis_gorev     ON gorev_gecmis(gorev_id);

-- =============================================================================
-- İZİNLER
-- =============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
