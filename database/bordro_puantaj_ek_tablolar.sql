-- =============================================================================
-- BORDRO, PUANTAJ VE MAAŞ ÖDEMELERİ EK TABLOLARI
-- =============================================================================

CREATE TABLE IF NOT EXISTS bordro (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE CASCADE,
    ekip_id UUID REFERENCES ekipler(id) ON DELETE CASCADE,
    donem TEXT NOT NULL, -- Örn: '2024-03'
    brut NUMERIC(15,2) DEFAULT 0,
    sgk_isci NUMERIC(15,2) DEFAULT 0,
    sgk_isveren NUMERIC(15,2) DEFAULT 0,
    vergi NUMERIC(15,2) DEFAULT 0,
    avans NUMERIC(15,2) DEFAULT 0,
    kesinti NUMERIC(15,2) DEFAULT 0,
    net NUMERIC(15,2) DEFAULT 0,
    durum TEXT DEFAULT 'hazirlaniyor', -- hazirlaniyor, onaylandi, odendi
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proje_id, ekip_id, donem)
);

CREATE TABLE IF NOT EXISTS maas_odemeleri (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    bordro_id UUID NOT NULL REFERENCES bordro(id) ON DELETE CASCADE,
    tutar NUMERIC(15,2) NOT NULL,
    odeme_tarihi DATE NOT NULL,
    odeme_kanali TEXT DEFAULT 'banka',
    aciklama TEXT,
    belge_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Güvenlik Politikaları (RLS)
ALTER TABLE bordro ENABLE ROW LEVEL SECURITY;
ALTER TABLE maas_odemeleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bordro_tam_erisim" ON bordro FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "maas_odemeleri_tam_erisim" ON maas_odemeleri FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- İzinler
GRANT ALL ON TABLE bordro TO authenticated, service_role;
GRANT ALL ON TABLE maas_odemeleri TO authenticated, service_role;

-- Cache Yenile
NOTIFY pgrst, 'reload schema';