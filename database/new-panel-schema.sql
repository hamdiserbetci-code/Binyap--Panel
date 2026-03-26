-- =============================================================================
-- ETM BİNYAPI ERP - TEMİZ ŞEMA (STOK HARİÇ)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Temizlik
DROP TABLE IF EXISTS aktivite_loglari CASCADE;
DROP TABLE IF EXISTS bildirim_kayitlari CASCADE;
DROP TABLE IF EXISTS gorevler CASCADE;
DROP TABLE IF EXISTS dokumanlar CASCADE;
DROP TABLE IF EXISTS puantaj_kayitlari CASCADE;
DROP TABLE IF EXISTS ekip_calisanlari CASCADE;
DROP TABLE IF EXISTS ekipler CASCADE;
DROP TABLE IF EXISTS satinalma_siparisleri CASCADE;
DROP TABLE IF EXISTS satinalma_talepleri CASCADE;
DROP TABLE IF EXISTS tedarikciler CASCADE;
DROP TABLE IF EXISTS vergi_beyannameleri CASCADE;
DROP TABLE IF EXISTS sgk_prim_bildirgeleri CASCADE;
DROP TABLE IF EXISTS fatura_satirlari CASCADE;
DROP TABLE IF EXISTS faturalar CASCADE;
DROP TABLE IF EXISTS banka_hareketleri CASCADE;
DROP TABLE IF EXISTS bankalar CASCADE;
DROP TABLE IF EXISTS kasa_hareketleri CASCADE;
DROP TABLE IF EXISTS cari_hareketler CASCADE;
DROP TABLE IF EXISTS cari_hesaplar CASCADE;
DROP TABLE IF EXISTS projeler CASCADE;
DROP TABLE IF EXISTS kullanici_profilleri CASCADE;
DROP TABLE IF EXISTS firmalar CASCADE;

-- =============================================================================
-- TENANT & YETKİLENDİRME
-- =============================================================================

CREATE TABLE firmalar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ad TEXT NOT NULL,
    kisa_ad TEXT,
    vergi_no TEXT,
    mersis_no TEXT,
    yetkili TEXT,
    telefon TEXT,
    email TEXT,
    adres TEXT,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kullanici_profilleri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auth_user_id UUID UNIQUE,
    firma_id UUID REFERENCES firmalar(id) ON DELETE CASCADE,
    ad_soyad TEXT,
    email TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'izleme', -- yonetici | muhasebe | santiye | izleme
    aktif BOOLEAN NOT NULL DEFAULT true,
    son_giris_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PROJELER
-- =============================================================================

CREATE TABLE projeler (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket TEXT NOT NULL DEFAULT 'ETM', -- ETM | BİNYAPI
    ad TEXT NOT NULL,
    musteri TEXT,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    butce NUMERIC(15,2) DEFAULT 0,
    durum TEXT NOT NULL DEFAULT 'aktif', -- aktif | tamamlandi | iptal
    aciklama TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CARİ HESAPLAR
-- =============================================================================

CREATE TABLE cari_hesaplar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket TEXT NOT NULL DEFAULT 'ETM',
    ad TEXT NOT NULL,
    tip TEXT NOT NULL DEFAULT 'musteri', -- musteri | tedarikci | personel | diger
    vkn_tckn TEXT,
    telefon TEXT,
    email TEXT,
    adres TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cari_hareketler (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    cari_hesap_id UUID NOT NULL REFERENCES cari_hesaplar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    tur TEXT NOT NULL, -- borc | alacak
    tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
    aciklama TEXT,
    belge_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- FATURALAR
-- =============================================================================

CREATE TABLE faturalar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket TEXT NOT NULL DEFAULT 'ETM',
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    cari_hesap_id UUID REFERENCES cari_hesaplar(id) ON DELETE SET NULL,
    fatura_no TEXT,
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    vade_tarihi DATE,
    tur TEXT NOT NULL DEFAULT 'satis', -- satis | alis
    durum TEXT NOT NULL DEFAULT 'taslak', -- taslak | gonderildi | odendi | iptal
    ara_toplam NUMERIC(15,2) NOT NULL DEFAULT 0,
    kdv_tutari NUMERIC(15,2) NOT NULL DEFAULT 0,
    toplam NUMERIC(15,2) NOT NULL DEFAULT 0,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fatura_satirlari (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    fatura_id UUID NOT NULL REFERENCES faturalar(id) ON DELETE CASCADE,
    aciklama TEXT NOT NULL,
    miktar NUMERIC(10,3) NOT NULL DEFAULT 1,
    birim TEXT DEFAULT 'adet',
    birim_fiyat NUMERIC(15,2) NOT NULL DEFAULT 0,
    kdv_orani NUMERIC(5,2) NOT NULL DEFAULT 20,
    toplam NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- =============================================================================
-- KASA & BANKA
-- =============================================================================

CREATE TABLE kasa_hareketleri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket TEXT NOT NULL DEFAULT 'ETM',
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    tur TEXT NOT NULL, -- giris | cikis
    tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
    kategori TEXT,
    aciklama TEXT NOT NULL,
    belge_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bankalar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket TEXT NOT NULL DEFAULT 'ETM',
    ad TEXT NOT NULL,
    sube TEXT,
    iban TEXT,
    para_birimi TEXT NOT NULL DEFAULT 'TRY',
    bakiye NUMERIC(15,2) NOT NULL DEFAULT 0,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE banka_hareketleri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    banka_id UUID NOT NULL REFERENCES bankalar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    tur TEXT NOT NULL, -- giris | cikis
    tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
    kategori TEXT,
    aciklama TEXT NOT NULL,
    belge_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SATIN ALMA
-- =============================================================================

CREATE TABLE tedarikciler (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket TEXT NOT NULL DEFAULT 'ETM',
    ad TEXT NOT NULL,
    vkn_tckn TEXT,
    telefon TEXT,
    email TEXT,
    adres TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE satinalma_talepleri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket TEXT NOT NULL DEFAULT 'ETM',
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    talep_eden TEXT,
    malzeme TEXT NOT NULL,
    miktar NUMERIC(10,3) NOT NULL DEFAULT 1,
    birim TEXT DEFAULT 'adet',
    tahmini_tutar NUMERIC(15,2),
    oncelik TEXT NOT NULL DEFAULT 'normal', -- dusuk | normal | yuksek | acil
    durum TEXT NOT NULL DEFAULT 'beklemede', -- beklemede | onaylandi | reddedildi | siparis_verildi | teslim_alindi
    notlar TEXT,
    talep_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE satinalma_siparisleri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    talep_id UUID REFERENCES satinalma_talepleri(id) ON DELETE SET NULL,
    tedarikci_id UUID REFERENCES tedarikciler(id) ON DELETE SET NULL,
    siparis_no TEXT,
    siparis_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    teslim_tarihi DATE,
    tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
    durum TEXT NOT NULL DEFAULT 'beklemede', -- beklemede | onaylandi | teslim_alindi | iptal
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PUANTAJ / İK
-- =============================================================================

CREATE TABLE ekipler (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    ad TEXT NOT NULL,
    sorumlu TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ekip_calisanlari (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ekip_id UUID NOT NULL REFERENCES ekipler(id) ON DELETE CASCADE,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    ad_soyad TEXT NOT NULL,
    unvan TEXT,
    telefon TEXT,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE puantaj_kayitlari (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    calisan_id UUID NOT NULL REFERENCES ekip_calisanlari(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL,
    calisma_saati NUMERIC(4,2) NOT NULL DEFAULT 8,
    mesai_saati NUMERIC(4,2) NOT NULL DEFAULT 0,
    durum TEXT NOT NULL DEFAULT 'normal', -- normal | izinli | hasta | devamsiz
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(calisan_id, tarih)
);

-- =============================================================================
-- GÖREVLER
-- =============================================================================

CREATE TABLE gorevler (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    baslik TEXT NOT NULL,
    aciklama TEXT,
    oncelik TEXT NOT NULL DEFAULT 'orta', -- dusuk | orta | yuksek | kritik
    durum TEXT NOT NULL DEFAULT 'beklemede', -- beklemede | devam_ediyor | tamamlandi | iptal
    sorumlu TEXT,
    son_tarih DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- DOKÜMANLAR
-- =============================================================================

CREATE TABLE dokumanlar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    sirket TEXT NOT NULL DEFAULT 'ETM',
    modul TEXT NOT NULL,
    kategori TEXT NOT NULL,
    dosya_adi TEXT NOT NULL,
    dosya_url TEXT NOT NULL,
    mime_type TEXT,
    dosya_boyutu BIGINT,
    aciklama TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AKTİVİTE LOGLARI
-- =============================================================================

CREATE TABLE aktivite_loglari (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    auth_user_id UUID,
    kullanici_profil_id UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
    modul TEXT NOT NULL,
    islem_turu TEXT NOT NULL,
    kayit_turu TEXT,
    kayit_id UUID,
    aciklama TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- İZİNLER
-- =============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================================================
-- ÖRNEK VERİ
-- =============================================================================

-- INSERT INTO firmalar (ad, kisa_ad) VALUES ('ETM A.Ş.', 'ETM'), ('BİNYAPI', 'BİNYAPI');
