-- ============================================================
-- KAR-ZARAR HESAPLAMA TABLOLARI (P&L / Income Statement)
-- ============================================================

-- Ana tablo: Kar-Zarar hesaplamaları
CREATE TABLE IF NOT EXISTS kar_zarar_hesaplamasi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL,
    donem TEXT NOT NULL,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    
    -- Dönem Başı ve Sonu Stokları
    donem_basi_stok NUMERIC(12,2) DEFAULT 0,
    donem_sonu_stok NUMERIC(12,2) DEFAULT 0,
    
    -- Gelirler
    hakedisler NUMERIC(12,2) DEFAULT 0,
    diger_satislar NUMERIC(12,2) DEFAULT 0,
    
    -- Giderler
    malzeme_alislari NUMERIC(12,2) DEFAULT 0,
    isciliik_giderleri NUMERIC(12,2) DEFAULT 0,
    genel_yonetim_giderleri NUMERIC(12,2) DEFAULT 0,
    finans_giderleri NUMERIC(12,2) DEFAULT 0,
    sigorta_giderleri NUMERIC(12,2) DEFAULT 0,
    amortisman_giderleri NUMERIC(12,2) DEFAULT 0,
    diger_giderler NUMERIC(12,2) DEFAULT 0,
    
    -- Hesaplamalı Alanlar
    toplam_gelirler NUMERIC(12,2) DEFAULT 0,
    toplam_giderler NUMERIC(12,2) DEFAULT 0,
    net_kar_zarar NUMERIC(12,2) DEFAULT 0,
    
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_kz_firma FOREIGN KEY (firma_id) REFERENCES firmalar(id) ON DELETE CASCADE
);

-- Detaylı kalem tablosu (isteğe bağlı - drill-down için)
CREATE TABLE IF NOT EXISTS kar_zarar_kalemleri (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kz_id UUID NOT NULL,
    kategori TEXT NOT NULL, -- 'gelir' veya 'gider'
    alt_kategori TEXT, -- hakedisler, malzeme_alislari, vs.
    aciklama TEXT,
    tutar NUMERIC(12,2) DEFAULT 0,
    belgeno TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_kz_kalem FOREIGN KEY (kz_id) REFERENCES kar_zarar_hesaplamasi(id) ON DELETE CASCADE
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_kz_firma ON kar_zarar_hesaplamasi(firma_id);
CREATE INDEX IF NOT EXISTS idx_kz_donem ON kar_zarar_hesaplamasi(donem);
CREATE INDEX IF NOT EXISTS idx_kz_kalem_kz ON kar_zarar_kalemleri(kz_id);

-- RLS Policies
ALTER TABLE kar_zarar_hesaplamasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE kar_zarar_kalemleri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kz_select" ON kar_zarar_hesaplamasi;
DROP POLICY IF EXISTS "kz_insert" ON kar_zarar_hesaplamasi;
DROP POLICY IF EXISTS "kz_update" ON kar_zarar_hesaplamasi;
DROP POLICY IF EXISTS "kz_delete" ON kar_zarar_hesaplamasi;

CREATE POLICY "kz_select" ON kar_zarar_hesaplamasi FOR SELECT USING (true);
CREATE POLICY "kz_insert" ON kar_zarar_hesaplamasi FOR INSERT WITH CHECK (true);
CREATE POLICY "kz_update" ON kar_zarar_hesaplamasi FOR UPDATE USING (true);
CREATE POLICY "kz_delete" ON kar_zarar_hesaplamasi FOR DELETE USING (true);

DROP POLICY IF EXISTS "kz_kalem_select" ON kar_zarar_kalemleri;
DROP POLICY IF EXISTS "kz_kalem_insert" ON kar_zarar_kalemleri;
DROP POLICY IF EXISTS "kz_kalem_update" ON kar_zarar_kalemleri;
DROP POLICY IF EXISTS "kz_kalem_delete" ON kar_zarar_kalemleri;

CREATE POLICY "kz_kalem_select" ON kar_zarar_kalemleri FOR SELECT USING (true);
CREATE POLICY "kz_kalem_insert" ON kar_zarar_kalemleri FOR INSERT WITH CHECK (true);
CREATE POLICY "kz_kalem_update" ON kar_zarar_kalemleri FOR UPDATE USING (true);
CREATE POLICY "kz_kalem_delete" ON kar_zarar_kalemleri FOR DELETE USING (true);

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kar_zarar_hesaplamasi TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kar_zarar_kalemleri TO authenticated;
