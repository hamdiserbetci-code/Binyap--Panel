-- =============================================================================
-- ETM PANEL — MODÜLLER VERİTABANI ŞEMASI
-- =============================================================================
-- 1. Ödeme Planı (Ödemeler)
-- 2. Proje Takibi (Projeler)
-- 3. Bordro Takibi (Bordro Dönemleri)
-- 4. Vergi Takibi (Vergi Süreçleri)
-- 5. SGK Takibi (SGK Entegrasyonu)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ÖDEME PLANI MODÜLÜ
-- =============================================================================

CREATE TABLE IF NOT EXISTS odeme_plani (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    
    -- Ödeme Bilgileri
    ödeme_türü          TEXT NOT NULL, -- 'çek', 'cari', 'vergi', 'sgk', 'maaş', 'diğer'
    ödeme_no            TEXT, -- Çek no vs.
    açıklama            TEXT,
    
    -- Tutar ve Tarihler
    tutar               NUMERIC(12,2) NOT NULL DEFAULT 0,
    gözlemleme_tarihi   DATE,
    vade_tarihi         DATE,
    ödeme_tarihi        DATE,
    
    -- Durum
    durum               TEXT NOT NULL DEFAULT 'bekliyor', -- 'bekliyor', 'ödendi', 'kısmi', 'iptal'
    notlar              TEXT,
    
    -- Sistem
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_odeme_plani_firma_id ON odeme_plani(firma_id);
CREATE INDEX idx_odeme_plani_durum ON odeme_plani(durum);
CREATE INDEX idx_odeme_plani_vade ON odeme_plani(vade_tarihi);

-- =============================================================================
-- 2. PROJE TAKIBI MODÜLÜ
-- =============================================================================

CREATE TABLE IF NOT EXISTS projeler_conf (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    
    -- Proje Bilgileri
    proje_adi           TEXT NOT NULL,
    açıklama            TEXT,
    
    -- Tarihler
    başlangıç_tarihi    DATE,
    bitiş_tarihi        DATE,
    
    -- Bütçe ve Sorumlu
    bütçe               NUMERIC(12,2) NOT NULL DEFAULT 0,
    sorumlu_kişi        TEXT,
    
    -- Durum
    durum               TEXT NOT NULL DEFAULT 'planlama', -- 'planlama', 'devam', 'tamamlandı', 'iptal'
    notlar              TEXT,
    
    -- Sistem
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projeler_firma_id ON projeler_conf(firma_id);
CREATE INDEX idx_projeler_durum ON projeler_conf(durum);

-- =============================================================================
-- 3. BORDRO TAKIBI MODÜLÜ
-- =============================================================================

CREATE TABLE IF NOT EXISTS bordro_donemleri (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    
    -- Dönem Bilgileri
    dönem_adı           TEXT NOT NULL,
    açıklama            TEXT,
    
    -- Dönem Tarihleri
    başlangıç_tarihi    DATE NOT NULL,
    bitiş_tarihi        DATE NOT NULL,
    bordro_tarihi       DATE NOT NULL,
    
    -- Durum (otomatik hesaplanan)
    durum               TEXT, -- 'aktif', 'tamamlandı'
    notlar              TEXT,
    
    -- Sistem
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bordro_firma_id ON bordro_donemleri(firma_id);
CREATE INDEX idx_bordro_tarihi ON bordro_donemleri(bordro_tarihi);

-- =============================================================================
-- 4. VERGİ TAKIBI MODÜLÜ (6 Vergi Türü)
-- =============================================================================

CREATE TABLE IF NOT EXISTS vergi_surecleri (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    
    -- Vergi Türü
    vergi_türü          TEXT NOT NULL, 
    -- 'kdv', 'kdv2', 'muhsgk', 'geçici_vergi', 'kurumlar_vergisi', 'edefter'
    
    -- Dönem
    dönem               TEXT,
    
    -- Tutar
    tutar               NUMERIC(12,2) NOT NULL DEFAULT 0,
    
    -- Tarihler
    vade_tarihi         DATE NOT NULL,
    ödeme_tarihi        DATE,
    
    -- Durum
    durum               TEXT NOT NULL DEFAULT 'bekliyor', 
    -- 'bekliyor', 'ödendi', 'gecikti'
    
    -- Belgeler
    belge_no            TEXT,
    açıklama            TEXT,
    notlar              TEXT,
    
    -- Sistem
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vergi_firma_id ON vergi_surecleri(firma_id);
CREATE INDEX idx_vergi_türü ON vergi_surecleri(vergi_türü);
CREATE INDEX idx_vergi_vade ON vergi_surecleri(vade_tarihi);
CREATE INDEX idx_vergi_durum ON vergi_surecleri(durum);

-- =============================================================================
-- 5. SGK TAKIBI MODÜLÜ
-- =============================================================================

CREATE TABLE IF NOT EXISTS sgk_entegrasyon (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    
    -- SGK Türü
    sgk_türü            TEXT NOT NULL,
    -- 'malullük', 'genel_sağlık', 'iş_kazası', 'işsizlik', 'diğer'
    
    -- Dönem
    dönem               TEXT,
    
    -- Çalışan ve Prim
    çalışan_sayısı      INTEGER DEFAULT 0,
    prim_tutarı         NUMERIC(12,2) NOT NULL DEFAULT 0,
    
    -- Tarihler
    vade_tarihi         DATE NOT NULL,
    ödeme_tarihi        DATE,
    
    -- Durum
    durum               TEXT NOT NULL DEFAULT 'bekliyor',
    -- 'bekliyor', 'ödendi', 'gecikti'
    
    -- Belgeler
    belge_no            TEXT,
    açıklama            TEXT,
    notlar              TEXT,
    
    -- Sistem
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sgk_firma_id ON sgk_entegrasyon(firma_id);
CREATE INDEX idx_sgk_türü ON sgk_entegrasyon(sgk_türü);
CREATE INDEX idx_sgk_vade ON sgk_entegrasyon(vade_tarihi);
CREATE INDEX idx_sgk_durum ON sgk_entegrasyon(durum);

-- =============================================================================
-- YAPIKLANDIRMA TABLELARI (Modül Settings)
-- =============================================================================

-- Modül Ayarları
CREATE TABLE IF NOT EXISTS module_settings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    module_id           TEXT NOT NULL, -- 'odemeplan', 'projeler', 'bordro', 'vergiler', 'sgk'
    
    -- Ayarlar (JSON)
    config              JSONB DEFAULT '{}',
    
    -- Sistem
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(firma_id, module_id)
);

-- İş Akışı Kuralları
CREATE TABLE IF NOT EXISTS workflow_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    module_id           TEXT NOT NULL,
    
    -- Kural Bilgileri
    kural_adı           TEXT NOT NULL,
    kural_türü          TEXT NOT NULL, -- 'notification', 'alert', 'action'
    açıklama            TEXT,
    
    -- Kural Koşulu (JSON)
    condition           JSONB DEFAULT '{}',
    
    -- Kural Aksiyonu (JSON)
    action              JSONB DEFAULT '{}',
    
    -- Durum
    aktif               BOOLEAN DEFAULT true,
    
    -- Sistem
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_rules_firma_id ON workflow_rules(firma_id);
CREATE INDEX idx_workflow_rules_module_id ON workflow_rules(module_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLİCİLERİ
-- =============================================================================

ALTER TABLE odeme_plani ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeler_conf ENABLE ROW LEVEL SECURITY;
ALTER TABLE bordro_donemleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE vergi_surecleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgk_entegrasyon ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;

-- Ödeme Planı RLS
CREATE POLICY "Ödeme Planı - Sadece firma sahibi görebilir"
    ON odeme_plani FOR SELECT
    USING (firma_id IN (
        SELECT firma_id FROM kullanici_profilleri 
        WHERE auth_user_id = auth.uid()
    ));

-- Projeler RLS
CREATE POLICY "Projeler - Sadece firma sahibi görebilir"
    ON projeler_conf FOR SELECT
    USING (firma_id IN (
        SELECT firma_id FROM kullanici_profilleri 
        WHERE auth_user_id = auth.uid()
    ));

-- Bordro Dönemleri RLS
CREATE POLICY "Bordro - Sadece firma sahibi görebilir"
    ON bordro_donemleri FOR SELECT
    USING (firma_id IN (
        SELECT firma_id FROM kullanici_profilleri 
        WHERE auth_user_id = auth.uid()
    ));

-- Vergi Süreçleri RLS
CREATE POLICY "Vergi - Sadece firma sahibi görebilir"
    ON vergi_surecleri FOR SELECT
    USING (firma_id IN (
        SELECT firma_id FROM kullanici_profilleri 
        WHERE auth_user_id = auth.uid()
    ));

-- SGK Entegrasyonu RLS
CREATE POLICY "SGK - Sadece firma sahibi görebilir"
    ON sgk_entegrasyon FOR SELECT
    USING (firma_id IN (
        SELECT firma_id FROM kullanici_profilleri 
        WHERE auth_user_id = auth.uid()
    ));

-- Module Settings RLS
CREATE POLICY "Module Settings - Sadece firma sahibi görebilir"
    ON module_settings FOR SELECT
    USING (firma_id IN (
        SELECT firma_id FROM kullanici_profilleri 
        WHERE auth_user_id = auth.uid()
    ));

-- Workflow Rules RLS
CREATE POLICY "Workflow Rules - Sadece firma sahibi görebilir"
    ON workflow_rules FOR SELECT
    USING (firma_id IN (
        SELECT firma_id FROM kullanici_profilleri 
        WHERE auth_user_id = auth.uid()
    ));

-- =============================================================================
-- VERİTABANI FONKSİYONLARI
-- =============================================================================

-- Geciken Ödemeleri Otomatik Güncelle
CREATE OR REPLACE FUNCTION update_overdue_payments()
RETURNS void AS $$
BEGIN
    UPDATE odeme_plani 
    SET durum = 'gecikti'
    WHERE durum = 'bekliyor' 
    AND vade_tarihi < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Geciken Vergileri Otomatik Güncelle
CREATE OR REPLACE FUNCTION update_overdue_taxes()
RETURNS void AS $$
BEGIN
    UPDATE vergi_surecleri 
    SET durum = 'gecikti'
    WHERE durum = 'bekliyor' 
    AND vade_tarihi < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Geciken SGK Primlerini Otomatik Güncelle
CREATE OR REPLACE FUNCTION update_overdue_sgk()
RETURNS void AS $$
BEGIN
    UPDATE sgk_entegrasyon 
    SET durum = 'gecikti'
    WHERE durum = 'bekliyor' 
    AND vade_tarihi < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TAMAMLANDI
-- =============================================================================

COMMIT;
