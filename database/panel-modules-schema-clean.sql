-- ============================================================
-- ETM PANEL MODÜLLERI — SUPABASE SCHEMA (ASCII-SAFE)
-- ============================================================

-- 1. Ödeme Planı
CREATE TABLE IF NOT EXISTS odeme_plani (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    odeme_tipi TEXT NOT NULL,
    odeme_no TEXT,
    aciklama TEXT,
    tutar NUMERIC(12,2) DEFAULT 0,
    gozlemleme_tarihi DATE,
    vade_tarihi DATE,
    odeme_tarihi DATE,
    durum TEXT DEFAULT 'bekliyor',
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_odeme_plani_firma_id ON odeme_plani(firma_id);
CREATE INDEX idx_odeme_plani_vade ON odeme_plani(vade_tarihi);

-- 2. Projeler
CREATE TABLE IF NOT EXISTS projeler_conf (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_adi TEXT NOT NULL,
    aciklama TEXT,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    butce NUMERIC(12,2) DEFAULT 0,
    sorumlu_kisi TEXT,
    durum TEXT DEFAULT 'planlama',
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_projeler_firma_id ON projeler_conf(firma_id);

-- 3. Bordro Dönemleri
CREATE TABLE IF NOT EXISTS bordro_donemleri (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    donem_adi TEXT NOT NULL,
    aciklama TEXT,
    baslangic_tarihi DATE NOT NULL,
    bitis_tarihi DATE NOT NULL,
    bordro_tarihi DATE NOT NULL,
    durum TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bordro_firma_id ON bordro_donemleri(firma_id);

-- 4. Vergi Süreçleri
CREATE TABLE IF NOT EXISTS vergi_surecleri (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    vergi_tipi TEXT NOT NULL,
    donem TEXT,
    tutar NUMERIC(12,2) DEFAULT 0,
    vade_tarihi DATE NOT NULL,
    odeme_tarihi DATE,
    durum TEXT DEFAULT 'bekliyor',
    belge_no TEXT,
    aciklama TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vergi_firma_id ON vergi_surecleri(firma_id);
CREATE INDEX idx_vergi_vade ON vergi_surecleri(vade_tarihi);

-- 5. SGK Entegrasyonu
CREATE TABLE IF NOT EXISTS sgk_entegrasyon (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sgk_tipi TEXT NOT NULL,
    donem TEXT,
    calisan_sayisi INTEGER DEFAULT 0,
    prim_tutari NUMERIC(12,2) DEFAULT 0,
    vade_tarihi DATE NOT NULL,
    odeme_tarihi DATE,
    durum TEXT DEFAULT 'bekliyor',
    belge_no TEXT,
    aciklama TEXT,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sgk_firma_id ON sgk_entegrasyon(firma_id);
CREATE INDEX idx_sgk_vade ON sgk_entegrasyon(vade_tarihi);

-- 6. Modül Ayarları
CREATE TABLE IF NOT EXISTS module_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(firma_id, module_id)
);

-- 7. Workflow Kuralları
CREATE TABLE IF NOT EXISTS workflow_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    kural_adi TEXT NOT NULL,
    kural_tipi TEXT NOT NULL,
    aciklama TEXT,
    condition JSONB DEFAULT '{}',
    action JSONB DEFAULT '{}',
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_workflow_rules_firma_id ON workflow_rules(firma_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE odeme_plani ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeler_conf ENABLE ROW LEVEL SECURITY;
ALTER TABLE bordro_donemleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE vergi_surecleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgk_entegrasyon ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "odeme_plani_firma_access" ON odeme_plani FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "projeler_firma_access" ON projeler_conf FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "bordro_firma_access" ON bordro_donemleri FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "vergi_firma_access" ON vergi_surecleri FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "sgk_firma_access" ON sgk_entegrasyon FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "module_settings_firma_access" ON module_settings FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "workflow_rules_firma_access" ON workflow_rules FOR SELECT
    USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON TABLE odeme_plani TO authenticated;
GRANT ALL ON TABLE projeler_conf TO authenticated;
GRANT ALL ON TABLE bordro_donemleri TO authenticated;
GRANT ALL ON TABLE vergi_surecleri TO authenticated;
GRANT ALL ON TABLE sgk_entegrasyon TO authenticated;
GRANT ALL ON TABLE module_settings TO authenticated;
GRANT ALL ON TABLE workflow_rules TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
