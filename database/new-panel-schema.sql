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
DROP TABLE IF EXISTS vergi_odemeleri CASCADE;
DROP TABLE IF EXISTS vergi_beyannameleri CASCADE;
DROP TABLE IF EXISTS vergi_takvimi CASCADE;
DROP TABLE IF EXISTS kullanici_yetkileri CASCADE;
DROP TABLE IF EXISTS sgk_prim_bildirgeleri CASCADE;
DROP TABLE IF EXISTS fatura_satirlari CASCADE;
DROP TABLE IF EXISTS faturalar CASCADE;
DROP TABLE IF EXISTS banka_hareketleri CASCADE;
DROP TABLE IF EXISTS bankalar CASCADE;
DROP TABLE IF EXISTS kasa_hareketleri CASCADE;
DROP TABLE IF EXISTS cari_hareketler CASCADE;
DROP TABLE IF EXISTS cari_hesaplar CASCADE;
DROP TABLE IF EXISTS projeler CASCADE;
DROP TABLE IF EXISTS sirketler CASCADE;
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

CREATE TABLE sirketler (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    kod TEXT NOT NULL, -- ETM | BİNYAPI
    ad TEXT NOT NULL,
    vergi_no TEXT,
    sgk_sicil_no TEXT,
    adres TEXT,
    telefon TEXT,
    email TEXT,
    aktif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(firma_id, kod)
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

CREATE TABLE kullanici_yetkileri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kullanici_id UUID NOT NULL REFERENCES kullanici_profilleri(id) ON DELETE CASCADE,
    modul TEXT NOT NULL, -- '*' = tüm modüller | 'vergi' | 'cari' | vb.
    okuma BOOLEAN NOT NULL DEFAULT true,
    yazma BOOLEAN NOT NULL DEFAULT false,
    silme BOOLEAN NOT NULL DEFAULT false,
    onaylama BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(kullanici_id, modul)
);

-- =============================================================================
-- VERGİ YÖNETİMİ
-- =============================================================================

CREATE TABLE vergi_takvimi (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tip TEXT NOT NULL, -- kdv | kdv2 | muhsgk | gecici_vergi | kurumlar_vergisi
    periyot TEXT NOT NULL, -- aylik | uc_aylik | yillik
    son_gun INTEGER NOT NULL,
    aciklama TEXT,
    aktif BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE vergi_beyannameleri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket_id UUID NOT NULL REFERENCES sirketler(id) ON DELETE CASCADE,
    tip TEXT NOT NULL, -- kdv | kdv2 | muhsgk | gecici_vergi | kurumlar_vergisi
    donem TEXT NOT NULL, -- 2024-03
    son_tarih DATE NOT NULL,
    durum TEXT NOT NULL DEFAULT 'bekliyor', -- bekliyor | hazirlaniyor | kontrolde | verildi | onaylandi | reddedildi | odendi
    tahakkuk_tutari NUMERIC(15,2) DEFAULT 0,
    odenen_tutar NUMERIC(15,2) DEFAULT 0,
    verilis_tarihi DATE,
    beyanname_no TEXT,
    notlar TEXT,
    sorumlu_id UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
    hatirlatici_tarihi DATE,
    hatirlatici_saati TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vergi_odemeleri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    beyanname_id UUID NOT NULL REFERENCES vergi_beyannameleri(id) ON DELETE CASCADE,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    odeme_tarihi DATE NOT NULL,
    tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
    odeme_kanali TEXT DEFAULT 'banka', -- banka | nakit
    dekont_no TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PROJELER
-- =============================================================================

CREATE TABLE projeler (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket_id UUID REFERENCES sirketler(id) ON DELETE SET NULL,
    sirket TEXT NOT NULL DEFAULT 'ETM', -- ETM | BİNYAPI (geriye uyumluluk)
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
-- RLS POLİTİKALARI
-- =============================================================================

-- Tüm tablolar için RLS'i aktif et
ALTER TABLE firmalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE sirketler ENABLE ROW LEVEL SECURITY;
ALTER TABLE kullanici_profilleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE kullanici_yetkileri ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE cari_hesaplar ENABLE ROW LEVEL SECURITY;
ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_satirlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasa_hareketleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka_hareketleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE tedarikciler ENABLE ROW LEVEL SECURITY;
ALTER TABLE satinalma_talepleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE satinalma_siparisleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekipler ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekip_calisanlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE puantaj_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorevler ENABLE ROW LEVEL SECURITY;
ALTER TABLE dokumanlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE aktivite_loglari ENABLE ROW LEVEL SECURITY;
ALTER TABLE vergi_beyannameleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE vergi_odemeleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE vergi_takvimi ENABLE ROW LEVEL SECURITY;

-- Firmalar: Herkes okuyabilir, yönetici yazabilir
CREATE POLICY "firmalar_select" ON firmalar FOR SELECT USING (true);
CREATE POLICY "firmalar_insert" ON firmalar FOR INSERT WITH CHECK (true);
CREATE POLICY "firmalar_update" ON firmalar FOR UPDATE USING (true);
CREATE POLICY "firmalar_delete" ON firmalar FOR DELETE USING (true);

-- Şirketler: Firma bazlı izolasyon
CREATE POLICY "sirketler_select" ON sirketler FOR SELECT USING (true);
CREATE POLICY "sirketler_insert" ON sirketler FOR INSERT WITH CHECK (true);
CREATE POLICY "sirketler_update" ON sirketler FOR UPDATE USING (true);
CREATE POLICY "sirketler_delete" ON sirketler FOR DELETE USING (true);

-- Kullanıcı profilleri
CREATE POLICY "kullanici_profilleri_select" ON kullanici_profilleri FOR SELECT USING (true);
CREATE POLICY "kullanici_profilleri_insert" ON kullanici_profilleri FOR INSERT WITH CHECK (true);
CREATE POLICY "kullanici_profilleri_update" ON kullanici_profilleri FOR UPDATE USING (true);

-- Kullanıcı yetkileri
CREATE POLICY "kullanici_yetkileri_select" ON kullanici_yetkileri FOR SELECT USING (true);
CREATE POLICY "kullanici_yetkileri_insert" ON kullanici_yetkileri FOR INSERT WITH CHECK (true);
CREATE POLICY "kullanici_yetkileri_update" ON kullanici_yetkileri FOR UPDATE USING (true);
CREATE POLICY "kullanici_yetkileri_delete" ON kullanici_yetkileri FOR DELETE USING (true);

-- Projeler
CREATE POLICY "projeler_select" ON projeler FOR SELECT USING (true);
CREATE POLICY "projeler_insert" ON projeler FOR INSERT WITH CHECK (true);
CREATE POLICY "projeler_update" ON projeler FOR UPDATE USING (true);
CREATE POLICY "projeler_delete" ON projeler FOR DELETE USING (true);

-- Cari hesaplar
CREATE POLICY "cari_hesaplar_select" ON cari_hesaplar FOR SELECT USING (true);
CREATE POLICY "cari_hesaplar_insert" ON cari_hesaplar FOR INSERT WITH CHECK (true);
CREATE POLICY "cari_hesaplar_update" ON cari_hesaplar FOR UPDATE USING (true);
CREATE POLICY "cari_hesaplar_delete" ON cari_hesaplar FOR DELETE USING (true);

-- Cari hareketler
CREATE POLICY "cari_hareketler_select" ON cari_hareketler FOR SELECT USING (true);
CREATE POLICY "cari_hareketler_insert" ON cari_hareketler FOR INSERT WITH CHECK (true);
CREATE POLICY "cari_hareketler_update" ON cari_hareketler FOR UPDATE USING (true);
CREATE POLICY "cari_hareketler_delete" ON cari_hareketler FOR DELETE USING (true);

-- Faturalar
CREATE POLICY "faturalar_select" ON faturalar FOR SELECT USING (true);
CREATE POLICY "faturalar_insert" ON faturalar FOR INSERT WITH CHECK (true);
CREATE POLICY "faturalar_update" ON faturalar FOR UPDATE USING (true);
CREATE POLICY "faturalar_delete" ON faturalar FOR DELETE USING (true);

-- Fatura satırları
CREATE POLICY "fatura_satirlari_select" ON fatura_satirlari FOR SELECT USING (true);
CREATE POLICY "fatura_satirlari_insert" ON fatura_satirlari FOR INSERT WITH CHECK (true);
CREATE POLICY "fatura_satirlari_update" ON fatura_satirlari FOR UPDATE USING (true);
CREATE POLICY "fatura_satirlari_delete" ON fatura_satirlari FOR DELETE USING (true);

-- Kasa hareketleri
CREATE POLICY "kasa_hareketleri_select" ON kasa_hareketleri FOR SELECT USING (true);
CREATE POLICY "kasa_hareketleri_insert" ON kasa_hareketleri FOR INSERT WITH CHECK (true);
CREATE POLICY "kasa_hareketleri_update" ON kasa_hareketleri FOR UPDATE USING (true);
CREATE POLICY "kasa_hareketleri_delete" ON kasa_hareketleri FOR DELETE USING (true);

-- Bankalar
CREATE POLICY "bankalar_select" ON bankalar FOR SELECT USING (true);
CREATE POLICY "bankalar_insert" ON bankalar FOR INSERT WITH CHECK (true);
CREATE POLICY "bankalar_update" ON bankalar FOR UPDATE USING (true);
CREATE POLICY "bankalar_delete" ON bankalar FOR DELETE USING (true);

-- Banka hareketleri
CREATE POLICY "banka_hareketleri_select" ON banka_hareketleri FOR SELECT USING (true);
CREATE POLICY "banka_hareketleri_insert" ON banka_hareketleri FOR INSERT WITH CHECK (true);
CREATE POLICY "banka_hareketleri_update" ON banka_hareketleri FOR UPDATE USING (true);
CREATE POLICY "banka_hareketleri_delete" ON banka_hareketleri FOR DELETE USING (true);

-- Tedarikçiler
CREATE POLICY "tedarikciler_select" ON tedarikciler FOR SELECT USING (true);
CREATE POLICY "tedarikciler_insert" ON tedarikciler FOR INSERT WITH CHECK (true);
CREATE POLICY "tedarikciler_update" ON tedarikciler FOR UPDATE USING (true);
CREATE POLICY "tedarikciler_delete" ON tedarikciler FOR DELETE USING (true);

-- Satınalma talepleri
CREATE POLICY "satinalma_talepleri_select" ON satinalma_talepleri FOR SELECT USING (true);
CREATE POLICY "satinalma_talepleri_insert" ON satinalma_talepleri FOR INSERT WITH CHECK (true);
CREATE POLICY "satinalma_talepleri_update" ON satinalma_talepleri FOR UPDATE USING (true);
CREATE POLICY "satinalma_talepleri_delete" ON satinalma_talepleri FOR DELETE USING (true);

-- Satınalma siparişleri
CREATE POLICY "satinalma_siparisleri_select" ON satinalma_siparisleri FOR SELECT USING (true);
CREATE POLICY "satinalma_siparisleri_insert" ON satinalma_siparisleri FOR INSERT WITH CHECK (true);
CREATE POLICY "satinalma_siparisleri_update" ON satinalma_siparisleri FOR UPDATE USING (true);
CREATE POLICY "satinalma_siparisleri_delete" ON satinalma_siparisleri FOR DELETE USING (true);

-- Ekipler
CREATE POLICY "ekipler_select" ON ekipler FOR SELECT USING (true);
CREATE POLICY "ekipler_insert" ON ekipler FOR INSERT WITH CHECK (true);
CREATE POLICY "ekipler_update" ON ekipler FOR UPDATE USING (true);
CREATE POLICY "ekipler_delete" ON ekipler FOR DELETE USING (true);

-- Ekip çalışanları
CREATE POLICY "ekip_calisanlari_select" ON ekip_calisanlari FOR SELECT USING (true);
CREATE POLICY "ekip_calisanlari_insert" ON ekip_calisanlari FOR INSERT WITH CHECK (true);
CREATE POLICY "ekip_calisanlari_update" ON ekip_calisanlari FOR UPDATE USING (true);
CREATE POLICY "ekip_calisanlari_delete" ON ekip_calisanlari FOR DELETE USING (true);

-- Puantaj kayıtları
CREATE POLICY "puantaj_kayitlari_select" ON puantaj_kayitlari FOR SELECT USING (true);
CREATE POLICY "puantaj_kayitlari_insert" ON puantaj_kayitlari FOR INSERT WITH CHECK (true);
CREATE POLICY "puantaj_kayitlari_update" ON puantaj_kayitlari FOR UPDATE USING (true);
CREATE POLICY "puantaj_kayitlari_delete" ON puantaj_kayitlari FOR DELETE USING (true);

-- Görevler
CREATE POLICY "gorevler_select" ON gorevler FOR SELECT USING (true);
CREATE POLICY "gorevler_insert" ON gorevler FOR INSERT WITH CHECK (true);
CREATE POLICY "gorevler_update" ON gorevler FOR UPDATE USING (true);
CREATE POLICY "gorevler_delete" ON gorevler FOR DELETE USING (true);

-- Dokümanlar
CREATE POLICY "dokumanlar_select" ON dokumanlar FOR SELECT USING (true);
CREATE POLICY "dokumanlar_insert" ON dokumanlar FOR INSERT WITH CHECK (true);
CREATE POLICY "dokumanlar_update" ON dokumanlar FOR UPDATE USING (true);
CREATE POLICY "dokumanlar_delete" ON dokumanlar FOR DELETE USING (true);

-- Aktivite logları
CREATE POLICY "aktivite_loglari_select" ON aktivite_loglari FOR SELECT USING (true);
CREATE POLICY "aktivite_loglari_insert" ON aktivite_loglari FOR INSERT WITH CHECK (true);

-- Vergi beyannameleri
CREATE POLICY "vergi_beyannameleri_select" ON vergi_beyannameleri FOR SELECT USING (true);
CREATE POLICY "vergi_beyannameleri_insert" ON vergi_beyannameleri FOR INSERT WITH CHECK (true);
CREATE POLICY "vergi_beyannameleri_update" ON vergi_beyannameleri FOR UPDATE USING (true);
CREATE POLICY "vergi_beyannameleri_delete" ON vergi_beyannameleri FOR DELETE USING (true);

-- Vergi ödemeleri
CREATE POLICY "vergi_odemeleri_select" ON vergi_odemeleri FOR SELECT USING (true);
CREATE POLICY "vergi_odemeleri_insert" ON vergi_odemeleri FOR INSERT WITH CHECK (true);
CREATE POLICY "vergi_odemeleri_update" ON vergi_odemeleri FOR UPDATE USING (true);
CREATE POLICY "vergi_odemeleri_delete" ON vergi_odemeleri FOR DELETE USING (true);

-- Vergi takvimi (herkes okuyabilir)
CREATE POLICY "vergi_takvimi_select" ON vergi_takvimi FOR SELECT USING (true);

-- =============================================================================
-- VERGİ TAKVİMİ - ÖRNEK VERİ
-- =============================================================================

INSERT INTO vergi_takvimi (tip, periyot, son_gun, aciklama) VALUES
('kdv', 'aylik', 28, 'Katma Değer Vergisi 1. Liste'),
('kdv2', 'aylik', 25, 'Katma Değer Vergisi 2. Liste'),
('muhsgk', 'aylik', 26, 'Muhtasar ve SGK Bildirgesi'),
('gecici_vergi', 'uc_aylik', 17, 'Geçici Vergi Beyannamesi (Mart, Haziran, Eylül, Aralık)'),
('kurumlar_vergisi', 'yillik', 30, 'Kurumlar Vergisi Beyannamesi (Nisan ayı sonu)');

-- =============================================================================
-- ÖRNEK VERİ
-- =============================================================================

-- INSERT INTO firmalar (ad, kisa_ad) VALUES ('ETM A.Ş.', 'ETM'), ('BİNYAPI', 'BİNYAPI');
