-- ============================================================
-- STEP 1: CREATE TABLES ONLY (No RLS policies yet)
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_odeme_plani_firma ON odeme_plani(firma_id);
CREATE INDEX IF NOT EXISTS idx_odeme_plani_vade ON odeme_plani(vade_tarihi);

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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projeler_firma ON projeler_conf(firma_id);

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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bordro_firma ON bordro_donemleri(firma_id);
CREATE INDEX IF NOT EXISTS idx_bordro_tarihi ON bordro_donemleri(bordro_tarihi);

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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vergi_firma ON vergi_surecleri(firma_id);
CREATE INDEX IF NOT EXISTS idx_vergi_tipi ON vergi_surecleri(vergi_tipi);
CREATE INDEX IF NOT EXISTS idx_vergi_vade ON vergi_surecleri(vade_tarihi);

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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sgk_firma ON sgk_entegrasyon(firma_id);
CREATE INDEX IF NOT EXISTS idx_sgk_tipi ON sgk_entegrasyon(sgk_tipi);
CREATE INDEX IF NOT EXISTS idx_sgk_vade ON sgk_entegrasyon(vade_tarihi);

CREATE TABLE IF NOT EXISTS module_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    module_id TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_module_settings UNIQUE(firma_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_module_settings_firma ON module_settings(firma_id);

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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_firma ON workflow_rules(firma_id);
CREATE INDEX IF NOT EXISTS idx_workflow_module ON workflow_rules(module_id);
