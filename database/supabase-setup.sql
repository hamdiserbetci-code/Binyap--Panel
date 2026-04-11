-- ============================================================
-- ETM PANEL MODÜLLERI — SUPABASE SETUP (BULLETPROOF)
-- Run in Supabase SQL Editor - Copy & Paste
-- ============================================================

-- DROP EXISTING IF YOU NEED A FRESH START (OPTIONAL):
-- DROP TABLE IF EXISTS workflow_rules CASCADE;
-- DROP TABLE IF EXISTS module_settings CASCADE;
-- DROP TABLE IF EXISTS sgk_entegrasyon CASCADE;
-- DROP TABLE IF EXISTS vergi_surecleri CASCADE;
-- DROP TABLE IF EXISTS bordro_donemleri CASCADE;
-- DROP TABLE IF EXISTS projeler_conf CASCADE;
-- DROP TABLE IF EXISTS odeme_plani CASCADE;

-- ============================================================
-- TABLE 1: ÖDEME PLANI
-- ============================================================
CREATE TABLE IF NOT EXISTS odeme_plani (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    odeme_tipi TEXT,
    odeme_no TEXT,
    aciklama TEXT,
    tutar NUMERIC(12,2) DEFAULT 0,
    gozlemleme_tarihi DATE,
    vade_tarihi DATE,
    odeme_tarihi DATE,
    durum TEXT DEFAULT 'bekliyor',
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_odeme_firma FOREIGN KEY (firma_id) REFERENCES firmalar(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_odeme_plani_firma ON odeme_plani(firma_id);
CREATE INDEX IF NOT EXISTS idx_odeme_plani_vade ON odeme_plani(vade_tarihi);

-- ============================================================
-- TABLE 2: PROJELER
-- ============================================================
CREATE TABLE IF NOT EXISTS projeler_conf (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    proje_adi TEXT,
    aciklama TEXT,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    butce NUMERIC(12,2) DEFAULT 0,
    sorumlu_kisi TEXT,
    durum TEXT DEFAULT 'planlama',
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_projeler_firma FOREIGN KEY (firma_id) REFERENCES firmalar(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_projeler_firma ON projeler_conf(firma_id);

-- ============================================================
-- TABLE 3: BORDRO DÖNEMLERI
-- ============================================================
CREATE TABLE IF NOT EXISTS bordro_donemleri (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    donem_adi TEXT,
    aciklama TEXT,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    bordro_tarihi DATE,
    durum TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_bordro_firma FOREIGN KEY (firma_id) REFERENCES firmalar(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bordro_firma ON bordro_donemleri(firma_id);
CREATE INDEX IF NOT EXISTS idx_bordro_tarihi ON bordro_donemleri(bordro_tarihi);

-- ============================================================
-- TABLE 4: VERGİ SURECLERI
-- ============================================================
CREATE TABLE IF NOT EXISTS vergi_surecleri (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    vergi_tipi TEXT,
    donem TEXT,
    tutar NUMERIC(12,2) DEFAULT 0,
    vade_tarihi DATE,
    odeme_tarihi DATE,
    durum TEXT DEFAULT 'bekliyor',
    belge_no TEXT,
    aciklama TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_vergi_firma FOREIGN KEY (firma_id) REFERENCES firmalar(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vergi_firma ON vergi_surecleri(firma_id);
CREATE INDEX IF NOT EXISTS idx_vergi_tipi ON vergi_surecleri(vergi_tipi);
CREATE INDEX IF NOT EXISTS idx_vergi_vade ON vergi_surecleri(vade_tarihi);

-- ============================================================
-- TABLE 5: SGK ENTEGRASYONU
-- ============================================================
CREATE TABLE IF NOT EXISTS sgk_entegrasyon (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    sgk_tipi TEXT,
    donem TEXT,
    calisan_sayisi INTEGER DEFAULT 0,
    prim_tutari NUMERIC(12,2) DEFAULT 0,
    vade_tarihi DATE,
    odeme_tarihi DATE,
    durum TEXT DEFAULT 'bekliyor',
    belge_no TEXT,
    aciklama TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_sgk_firma FOREIGN KEY (firma_id) REFERENCES firmalar(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sgk_firma ON sgk_entegrasyon(firma_id);
CREATE INDEX IF NOT EXISTS idx_sgk_tipi ON sgk_entegrasyon(sgk_tipi);
CREATE INDEX IF NOT EXISTS idx_sgk_vade ON sgk_entegrasyon(vade_tarihi);

-- ============================================================
-- TABLE 6: MODÜL AYARLARI
-- ============================================================
CREATE TABLE IF NOT EXISTS module_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    module_id TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_settings_firma FOREIGN KEY (firma_id) REFERENCES firmalar(id) ON DELETE CASCADE,
    CONSTRAINT unique_module_settings UNIQUE(firma_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_module_settings_firma ON module_settings(firma_id);

-- ============================================================
-- TABLE 7: WORKFLOW RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    module_id TEXT NOT NULL,
    kural_adi TEXT,
    kural_tipi TEXT,
    aciklama TEXT,
    condition JSONB DEFAULT '{}',
    action JSONB DEFAULT '{}',
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_workflow_firma FOREIGN KEY (firma_id) REFERENCES firmalar(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workflow_firma ON workflow_rules(firma_id);
CREATE INDEX IF NOT EXISTS idx_workflow_module ON workflow_rules(module_id);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE odeme_plani ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeler_conf ENABLE ROW LEVEL SECURITY;
ALTER TABLE bordro_donemleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE vergi_surecleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgk_entegrasyon ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Ödeme Planı
CREATE POLICY IF NOT EXISTS "odeme_plani_select" ON odeme_plani FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "odeme_plani_insert" ON odeme_plani FOR INSERT
    WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "odeme_plani_update" ON odeme_plani FOR UPDATE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "odeme_plani_delete" ON odeme_plani FOR DELETE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- Projeler
CREATE POLICY IF NOT EXISTS "projeler_select" ON projeler_conf FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "projeler_insert" ON projeler_conf FOR INSERT
    WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "projeler_update" ON projeler_conf FOR UPDATE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "projeler_delete" ON projeler_conf FOR DELETE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- Bordro
CREATE POLICY IF NOT EXISTS "bordro_select" ON bordro_donemleri FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "bordro_insert" ON bordro_donemleri FOR INSERT
    WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "bordro_update" ON bordro_donemleri FOR UPDATE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "bordro_delete" ON bordro_donemleri FOR DELETE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- Vergi
CREATE POLICY IF NOT EXISTS "vergi_select" ON vergi_surecleri FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "vergi_insert" ON vergi_surecleri FOR INSERT
    WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "vergi_update" ON vergi_surecleri FOR UPDATE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "vergi_delete" ON vergi_surecleri FOR DELETE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- SGK
CREATE POLICY IF NOT EXISTS "sgk_select" ON sgk_entegrasyon FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "sgk_insert" ON sgk_entegrasyon FOR INSERT
    WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "sgk_update" ON sgk_entegrasyon FOR UPDATE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "sgk_delete" ON sgk_entegrasyon FOR DELETE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- Module Settings
CREATE POLICY IF NOT EXISTS "settings_select" ON module_settings FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "settings_insert" ON module_settings FOR INSERT
    WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "settings_update" ON module_settings FOR UPDATE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "settings_delete" ON module_settings FOR DELETE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- Workflow Rules
CREATE POLICY IF NOT EXISTS "workflow_select" ON workflow_rules FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "workflow_insert" ON workflow_rules FOR INSERT
    WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "workflow_update" ON workflow_rules FOR UPDATE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "workflow_delete" ON workflow_rules FOR DELETE
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.odeme_plani TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeler_conf TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bordro_donemleri TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vergi_surecleri TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sgk_entegrasyon TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_rules TO authenticated;

-- ============================================================
-- SETUP COMPLETE
-- ============================================================
-- All 7 tables created with RLS and permissions configured
-- Ready to use in frontend!
