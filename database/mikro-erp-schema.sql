-- ==========================================
-- MIKRO ERP MODULAR SCHEMA FOR ETM PANEL
-- ==========================================

-- Enable RLS
ALTER TABLE IF EXISTS cariler ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cari_hareketler ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cari_bakiyeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cari_tahsilat_odeme ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS banka_hesaplari ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS banka_hareketleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kasa_hareketleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS finans_fisleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS finans_fis_satirlari ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS faturalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fatura_satirlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS irsaliyeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stok_kartlari ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS cekler ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS senetler ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cek_senet_hareketleri ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS personel ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bordro_donemleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bordro_kesintileri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bordro_ekleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS icra_kesintileri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sgk_bildirge_kayitlari ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS projeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proje_gorevleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proje_maliyetleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS proje_faturalari ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 1. CARİ YAPISI
-- ==========================================

-- Cari kartlar
CREATE TABLE IF NOT EXISTS cariler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    kod VARCHAR(50) NOT NULL,
    unvan VARCHAR(200) NOT NULL,
    vergi_dairesi VARCHAR(100),
    vergi_no VARCHAR(50),
    telefon VARCHAR(20),
    email VARCHAR(100),
    adres TEXT,
    bakiye DECIMAL(15,2) DEFAULT 0,
    risk_limiti DECIMAL(15,2),
    risk_durumu VARCHAR(20) DEFAULT 'dusuk' CHECK (risk_durumu IN ('dusuk', 'orta', 'yuksek')),
    notlar TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cari hareketleri
CREATE TABLE IF NOT EXISTS cari_hareketler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    cari_id UUID NOT NULL REFERENCES cariler(id),
    hareket_tipi VARCHAR(20) NOT NULL CHECK (hareket_tipi IN ('fatura', 'tahsilat', 'odeme', 'duzenleme')),
    bagli_tablo VARCHAR(50), -- faturalar, cari_tahsilat_odeme
    bagli_kayit_id UUID,
    tutar DECIMAL(15,2) NOT NULL,
    aciklama TEXT,
    tarih DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cari bakiyeler (günlük güncellenir)
CREATE TABLE IF NOT EXISTS cari_bakiyeler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    cari_id UUID NOT NULL REFERENCES cariler(id),
    tarih DATE NOT NULL,
    borc DECIMAL(15,2) DEFAULT 0,
    alacak DECIMAL(15,2) DEFAULT 0,
    bakiye DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(firma_id, cari_id, tarih)
);

-- Cari tahsilat/ödeme
CREATE TABLE IF NOT EXISTS cari_tahsilat_odeme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    cari_id UUID NOT NULL REFERENCES cariler(id),
    islem_tipi VARCHAR(20) NOT NULL CHECK (islem_tipi IN ('tahsilat', 'odeme')),
    odeme_tipi VARCHAR(20) NOT NULL CHECK (odeme_tipi IN ('nakit', 'banka', 'cek', 'senet')),
    banka_hesap_id UUID REFERENCES banka_hesaplari(id),
    tutar DECIMAL(15,2) NOT NULL,
    aciklama TEXT,
    tarih DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. FİNANS - BANKA - KASA
-- ==========================================

-- Banka hesapları
CREATE TABLE IF NOT EXISTS banka_hesaplari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    banka_adi VARCHAR(100) NOT NULL,
    sube_adi VARCHAR(100),
    hesap_no VARCHAR(50),
    iban VARCHAR(50),
    bakiye DECIMAL(15,2) DEFAULT 0,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Banka hareketleri
CREATE TABLE IF NOT EXISTS banka_hareketleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    banka_hesap_id UUID NOT NULL REFERENCES banka_hesaplari(id),
    islem_tipi VARCHAR(20) NOT NULL CHECK (islem_tipi IN ('giris', 'cikis')),
    bagli_tablo VARCHAR(50),
    bagli_kayit_id UUID,
    tutar DECIMAL(15,2) NOT NULL,
    aciklama TEXT,
    tarih DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kasa hareketleri
CREATE TABLE IF NOT EXISTS kasa_hareketleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    islem_tipi VARCHAR(20) NOT NULL CHECK (islem_tipi IN ('giris', 'cikis')),
    bagli_tablo VARCHAR(50),
    bagli_kayit_id UUID,
    tutar DECIMAL(15,2) NOT NULL,
    aciklama TEXT,
    tarih DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Finans fişleri
CREATE TABLE IF NOT EXISTS finans_fisleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    fis_no VARCHAR(50) NOT NULL,
    fis_tipi VARCHAR(20) NOT NULL CHECK (fis_tipi IN ('kasa_giris', 'kasa_cikis', 'banka_giris', 'banka_cikis', 'muhtasar')),
    tarih DATE NOT NULL,
    aciklama TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Finans fiş satırları
CREATE TABLE IF NOT EXISTS finans_fis_satirlari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    finans_fis_id UUID NOT NULL REFERENCES finans_fisleri(id),
    hesap_kodu VARCHAR(50) NOT NULL,
    hesap_adi VARCHAR(200) NOT NULL,
    borc DECIMAL(15,2) DEFAULT 0,
    alacak DECIMAL(15,2) DEFAULT 0,
    aciklama TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. FATURA - E-FATURA
-- ==========================================

-- Faturalar
CREATE TABLE IF NOT EXISTS faturalar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    cari_id UUID NOT NULL REFERENCES cariler(id),
    fatura_tipi VARCHAR(20) NOT NULL CHECK (fatura_tipi IN ('satis', 'alis')),
    fatura_no VARCHAR(50) NOT NULL,
    tarih DATE NOT NULL,
    vade_tarihi DATE,
    toplam_tutar DECIMAL(15,2) DEFAULT 0,
    kdv_tutari DECIMAL(15,2) DEFAULT 0,
    genel_toplam DECIMAL(15,2) DEFAULT 0,
    e_fatura_mi BOOLEAN DEFAULT false,
    e_fatura_no VARCHAR(50),
    durum VARCHAR(20) DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor', 'onaylandi', 'iptal')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fatura satırları
CREATE TABLE IF NOT EXISTS fatura_satirlari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    fatura_id UUID NOT NULL REFERENCES faturalar(id),
    stok_kodu VARCHAR(50),
    stok_adi VARCHAR(200),
    miktar DECIMAL(10,2) NOT NULL,
    birim_fiyat DECIMAL(15,2) NOT NULL,
    kdv_orani DECIMAL(5,2) DEFAULT 20,
    kdv_tutari DECIMAL(15,2) DEFAULT 0,
    satir_tutari DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İrsaliyeler
CREATE TABLE IF NOT EXISTS irsaliyeler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    fatura_id UUID REFERENCES faturalar(id),
    irsaliye_no VARCHAR(50) NOT NULL,
    tarih DATE NOT NULL,
    teslim_alan VARCHAR(200),
    teslim_eden VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stok kartları (opsiyonel)
CREATE TABLE IF NOT EXISTS stok_kartlari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    stok_kodu VARCHAR(50) NOT NULL,
    stok_adi VARCHAR(200) NOT NULL,
    birim VARCHAR(20) DEFAULT 'ADET',
    birim_fiyat DECIMAL(15,2) DEFAULT 0,
    stok_miktari DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 4. ÇEK - SENET
-- ==========================================

-- Çekler
CREATE TABLE IF NOT EXISTS cekler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    cari_id UUID REFERENCES cariler(id),
    cek_no VARCHAR(50) NOT NULL,
    tutar DECIMAL(15,2) NOT NULL,
    cek_tarihi DATE NOT NULL,
    vade_tarihi DATE NOT NULL,
    banka_adi VARCHAR(100),
    sube_adi VARCHAR(100),
    durum VARCHAR(20) DEFAULT 'portfoy' CHECK (durum IN ('portfoy', 'ciro', 'tahsil', 'geri', 'kismi_tahsil', 'kismi_geri')),
    ciro_edilen_cari_id UUID REFERENCES cariler(id),
    aciklama TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Senetler
CREATE TABLE IF NOT EXISTS senetler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    cari_id UUID REFERENCES cariler(id),
    senet_no VARCHAR(50) NOT NULL,
    tutar DECIMAL(15,2) NOT NULL,
    senet_tarihi DATE NOT NULL,
    vade_tarihi DATE NOT NULL,
    kefil VARCHAR(200),
    durum VARCHAR(20) DEFAULT 'portfoy' CHECK (durum IN ('portfoy', 'ciro', 'tahsil', 'geri', 'kismi_tahsil', 'kismi_geri')),
    ciro_edilen_cari_id UUID REFERENCES cariler(id),
    aciklama TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Çek-senet hareketleri
CREATE TABLE IF NOT EXISTS cek_senet_hareketleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    cek_senet_tipi VARCHAR(10) NOT NULL CHECK (cek_senet_tipi IN ('cek', 'senet')),
    cek_senet_id UUID NOT NULL,
    hareket_tipi VARCHAR(20) NOT NULL CHECK (hareket_tipi IN ('cikis', 'giris', 'ciro', 'tahsil', 'geri')),
    cari_id UUID REFERENCES cariler(id),
    tutar DECIMAL(15,2) NOT NULL,
    aciklama TEXT,
    tarih DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. BORDRO - İK
-- ==========================================

-- Personel
CREATE TABLE IF NOT EXISTS personel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    tc_no VARCHAR(11) NOT NULL,
    ad_soyad VARCHAR(200) NOT NULL,
    dogum_tarihi DATE,
    gorev VARCHAR(100),
    departman VARCHAR(100),
    maas DECIMAL(15,2) DEFAULT 0,
    sigorta_no VARCHAR(50),
    sigorta_tarihi DATE,
    ise_giris_tarihi DATE NOT NULL,
    isten_cikis_tarihi DATE,
    durum VARCHAR(20) DEFAULT 'aktif' CHECK (durum IN ('aktif', 'pasif')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bordro dönemleri
CREATE TABLE IF NOT EXISTS bordro_donemleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    donem VARCHAR(10) NOT NULL, -- Örn: 2024-01
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE NOT NULL,
    puantaj_tarihi DATE,
    bordro_tarihi DATE,
    durum VARCHAR(20) DEFAULT 'hazirlaniyor' CHECK (durum IN ('hazirlaniyor', 'hesaplandi', 'odendi')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bordro kesintileri
CREATE TABLE IF NOT EXISTS bordro_kesintileri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    personel_id UUID NOT NULL REFERENCES personel(id),
    bordro_donemi_id UUID NOT NULL REFERENCES bordro_donemleri(id),
    kesinti_tipi VARCHAR(50) NOT NULL, -- Örn: Gelir Vergisi, Damga Vergisi
    tutar DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bordro ekleri
CREATE TABLE IF NOT EXISTS bordro_ekleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    personel_id UUID NOT NULL REFERENCES personel(id),
    bordro_donemi_id UUID NOT NULL REFERENCES bordro_donemleri(id),
    ek_tipi VARCHAR(50) NOT NULL, -- Örn: Ek ödeme, Prim
    tutar DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İcra kesintileri
CREATE TABLE IF NOT EXISTS icra_kesintileri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    personel_id UUID NOT NULL REFERENCES personel(id),
    icra_dosya_no VARCHAR(50) NOT NULL,
    kesinti_tutari DECIMAL(15,2) NOT NULL,
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE,
    aylik_taksit_sayisi INTEGER DEFAULT 0,
    kalan_taksit_sayisi INTEGER DEFAULT 0,
    durum VARCHAR(20) DEFAULT 'aktif' CHECK (durum IN ('aktif', 'tamamlandi')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SGK bildirge kayıtları
CREATE TABLE IF NOT EXISTS sgk_bildirge_kayitlari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    personel_id UUID NOT NULL REFERENCES personel(id),
    bildirge_tipi VARCHAR(20) NOT NULL, -- Örn: Hizmet, Ücret
    donem VARCHAR(10) NOT NULL,
    brut_ucret DECIMAL(15,2) DEFAULT 0,
    sgk_isveren DECIMAL(15,2) DEFAULT 0,
    sgk_isci DECIMAL(15,2) DEFAULT 0,
    iss DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 6. PROJE - İŞ TAKİBİ
-- ==========================================

-- Projeler
CREATE TABLE IF NOT EXISTS projeler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    proje_kodu VARCHAR(50) NOT NULL,
    proje_adi VARCHAR(200) NOT NULL,
    musteri_id UUID REFERENCES cariler(id),
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE,
    durum VARCHAR(20) DEFAULT 'devam' CHECK (durum IN ('devam', 'tamamlandi', 'iptal')),
    toplam_butce DECIMAL(15,2) DEFAULT 0,
    harcanan_butce DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proje görevleri
CREATE TABLE IF NOT EXISTS proje_gorevleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    proje_id UUID NOT NULL REFERENCES projeler(id),
    gorev_adi VARCHAR(200) NOT NULL,
    sorumlu_personel_id UUID REFERENCES personel(id),
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE,
    durum VARCHAR(20) DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor', 'devam', 'tamamlandi')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proje maliyetleri
CREATE TABLE IF NOT EXISTS proje_maliyetleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    proje_id UUID NOT NULL REFERENCES projeler(id),
    maliyet_tipi VARCHAR(50) NOT NULL, -- Örn: Personel, Malzeme, Hizmet
    tutar DECIMAL(15,2) NOT NULL,
    aciklama TEXT,
    tarih DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proje faturaları
CREATE TABLE IF NOT EXISTS proje_faturalari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    proje_id UUID NOT NULL REFERENCES projeler(id),
    fatura_id UUID NOT NULL REFERENCES faturalar(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 7. RAPORLAMA & DASHBOARD
-- ==========================================

-- Raporlar tablosu (opsiyonel)
CREATE TABLE IF NOT EXISTS raporlar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    rapor_adi VARCHAR(200) NOT NULL,
    rapor_tipi VARCHAR(50) NOT NULL,
    sql_sorgu TEXT,
    parametreler JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dashboard widget'ları (opsiyonel)
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id),
    widget_adi VARCHAR(100) NOT NULL,
    widget_tipi VARCHAR(50) NOT NULL,
    konum JSONB,
    ayarlar JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================

-- Cari indexes
CREATE INDEX IF NOT EXISTS idx_cariler_firma_id ON cariler(firma_id);
CREATE INDEX IF NOT EXISTS idx_cariler_kod ON cariler(kod);
CREATE INDEX IF NOT EXISTS idx_cari_hareketler_cari_id ON cari_hareketler(cari_id);
CREATE INDEX IF NOT EXISTS idx_cari_hareketler_tarih ON cari_hareketler(tarih);

-- Banka indexes
CREATE INDEX IF NOT EXISTS idx_banka_hesaplari_firma_id ON banka_hesaplari(firma_id);
CREATE INDEX IF NOT EXISTS idx_banka_hareketleri_hesap_id ON banka_hareketleri(banka_hesap_id);

-- Fatura indexes
CREATE INDEX IF NOT EXISTS idx_faturalar_firma_id ON faturalar(firma_id);
CREATE INDEX IF NOT EXISTS idx_faturalar_cari_id ON faturalar(cari_id);
CREATE INDEX IF NOT EXISTS idx_fatura_satirlari_fatura_id ON fatura_satirlari(fatura_id);

-- Bordro indexes
CREATE INDEX IF NOT EXISTS idx_personel_firma_id ON personel(firma_id);
CREATE INDEX IF NOT EXISTS idx_bordro_donemleri_firma_id ON bordro_donemleri(firma_id);

-- Proje indexes
CREATE INDEX IF NOT EXISTS idx_projeler_firma_id ON projeler(firma_id);
CREATE INDEX IF NOT EXISTS idx_proje_gorevleri_proje_id ON proje_gorevleri(proje_id);

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Cari bakiye güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_cari_bakiye()
RETURNS TRIGGER AS $$
BEGIN
    -- Güncel bakiyeyi hesapla
    UPDATE cariler SET bakiye = (
        SELECT COALESCE(SUM(CASE WHEN hareket_tipi IN ('fatura', 'odeme') THEN tutar ELSE -tutar END), 0)
        FROM cari_hareketler 
        WHERE cari_id = NEW.cari_id
    ) WHERE id = NEW.cari_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cari_bakiye_update
    AFTER INSERT OR UPDATE OR DELETE ON cari_hareketler
    FOR EACH ROW EXECUTE FUNCTION update_cari_bakiye();

-- Banka bakiye güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_banka_bakiye()
RETURNS TRIGGER AS $$
BEGIN
    -- Güncel bakiyeyi hesapla
    UPDATE banka_hesaplari SET bakiye = (
        SELECT COALESCE(SUM(CASE WHEN islem_tipi = 'giris' THEN tutar ELSE -tutar END), 0)
        FROM banka_hareketleri 
        WHERE banka_hesap_id = NEW.banka_hesap_id
    ) WHERE id = NEW.banka_hesap_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_banka_bakiye_update
    AFTER INSERT OR UPDATE OR DELETE ON banka_hareketleri
    FOR EACH ROW EXECUTE FUNCTION update_banka_bakiye();

-- Fatura toplam güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_fatura_toplam()
RETURNS TRIGGER AS $$
BEGIN
    -- Satır toplamını güncelle
    UPDATE fatura_satirlari SET 
        kdv_tutari = ROUND((birim_fiyat * miktar) * (kdv_orani / 100), 2),
        satir_tutari = ROUND((birim_fiyat * miktar) + ((birim_fiyat * miktar) * (kdv_orani / 100)), 2)
    WHERE id = NEW.id;
    
    -- Fatura toplamını güncelle
    UPDATE faturalar SET 
        toplam_tutar = (SELECT COALESCE(SUM(birim_fiyat * miktar), 0) FROM fatura_satirlari WHERE fatura_id = NEW.fatura_id),
        kdv_tutari = (SELECT COALESCE(SUM(kdv_tutari), 0) FROM fatura_satirlari WHERE fatura_id = NEW.fatura_id),
        genel_toplam = (SELECT COALESCE(SUM(satir_tutari), 0) FROM fatura_satirlari WHERE fatura_id = NEW.fatura_id)
    WHERE id = NEW.fatura_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fatura_toplam_update
    AFTER INSERT OR UPDATE ON fatura_satirlari
    FOR EACH ROW EXECUTE FUNCTION update_fatura_toplam();

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Cari tabloları için RLS
CREATE POLICY "Cari: Kullanıcı kendi firmasının carilerini görebilir" ON cariler
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

CREATE POLICY "Cari Hareket: Kullanıcı kendi firmasının hareketlerini görebilir" ON cari_hareketler
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

-- Banka tabloları için RLS
CREATE POLICY "Banka: Kullanıcı kendi firmasının bankalarını görebilir" ON banka_hesaplari
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

CREATE POLICY "Banka Hareket: Kullanıcı kendi firmasının hareketlerini görebilir" ON banka_hareketleri
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

-- Fatura tabloları için RLS
CREATE POLICY "Fatura: Kullanıcı kendi firmasının faturalarını görebilir" ON faturalar
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

CREATE POLICY "Fatura Satır: Kullanıcı kendi firmasının fatura satırlarını görebilir" ON fatura_satirlari
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

-- Bordro tabloları için RLS
CREATE POLICY "Personel: Kullanıcı kendi firmasının personellerini görebilir" ON personel
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

CREATE POLICY "Bordro Dönem: Kullanıcı kendi firmasının dönemlerini görebilir" ON bordro_donemleri
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

-- Proje tabloları için RLS
CREATE POLICY "Proje: Kullanıcı kendi firmasının projelerini görebilir" ON projeler
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

CREATE POLICY "Proje Görev: Kullanıcı kendi firmasının görevlerini görebilir" ON proje_gorevleri
    FOR ALL USING (firma_id = current_setting('app.current_firma_id')::uuid);

-- ==========================================
-- VIEWS
-- ==========================================

-- Cari ekstre view
CREATE OR REPLACE VIEW cari_ekstre AS
SELECT 
    c.id,
    c.firma_id,
    c.kod,
    c.unvan,
    ch.tarih,
    ch.hareket_tipi,
    ch.tutar,
    ch.aciklama,
    cb.bakiye
FROM cariler c
LEFT JOIN cari_hareketler ch ON c.id = ch.cari_id
LEFT JOIN cari_bakiyeler cb ON c.id = cb.cari_id AND ch.tarih = cb.tarih
ORDER BY c.id, ch.tarih;

-- Banka mutabakat view
CREATE OR REPLACE VIEW banka_mutabakat AS
SELECT 
    bh.id,
    bh.firma_id,
    bh.banka_adi,
    bh.hesap_no,
    bh.iban,
    bh.bakiye,
    bhb.tarih,
    bhb.islem_tipi,
    bhb.tutar,
    bhb.aciklama
FROM banka_hesaplari bh
LEFT JOIN banka_hareketleri bhb ON bh.id = bhb.banka_hesap_id
ORDER BY bh.id, bhb.tarih;

-- Proje karlılık view
CREATE OR REPLACE VIEW proje_karlılık AS
SELECT 
    p.id,
    p.firma_id,
    p.proje_kodu,
    p.proje_adi,
    p.toplam_butce,
    p.harcanan_butce,
    (p.toplam_butce - p.harcanan_butce) AS kar_zarar,
    CASE 
        WHEN p.toplam_butce > 0 
        THEN ROUND(((p.toplam_butce - p.harcanan_butce) / p.toplam_butce) * 100, 2)
        ELSE 0 
    END AS karlilik_yuzdesi
FROM projeler p
ORDER BY p.id;

-- ==========================================
-- SAMPLE DATA (Opsiyonel)
-- ==========================================

-- Örnek firma ekleme (gerekirse)
-- INSERT INTO firmalar (id, ad, kisa_ad, aktif) VALUES 
-- (gen_random_uuid(), 'ETM Muhasebe', 'ETM', true);

-- Örnek cari ekleme (gerekirse)
-- INSERT INTO cariler (firma_id, kod, unvan, telefon, email, aktif) VALUES 
-- ((SELECT id FROM firmalar WHERE kisa_ad = 'ETM'), 'CAR-001', 'Örnek Müşteri', '5551234567', 'musteri@ornek.com', true);

-- ==========================================
-- SON
-- ==========================================
-- Bu schema, Mikro ERP'nin temel modüllerini Supabase için tam olarak karşılar.
-- Her modül ayrı bir service.ts dosyası ile yönetilebilir.
-- RLS politikaları sayesinde veri güvenliği sağlanır.
-- Trigger'lar sayesinde otomatik hesaplamalar yapılır.