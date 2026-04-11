-- Bordro/İK Modülü Tabloları

-- Personeller tablosu
CREATE TABLE IF NOT EXISTS personeller (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id UUID,
    ad TEXT NOT NULL,
    soyad TEXT NOT NULL,
    tc_no TEXT,
    sgk_no TEXT,
    gorev TEXT,
    brut_maas NUMERIC(15,2) DEFAULT 0,
    donem TEXT,
    durum TEXT DEFAULT 'aktif',
    iban TEXT,
    telefon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projeler tablosu
CREATE TABLE IF NOT EXISTS projeler (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    kod TEXT,
    ad TEXT NOT NULL,
    musteri TEXT,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    durum TEXT DEFAULT 'aktif',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Puantaj toplamları
CREATE TABLE IF NOT EXISTS puantaj_toplamlari (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id UUID,
    personel_id UUID REFERENCES personeller(id) ON DELETE SET NULL,
    donem TEXT NOT NULL,
    toplam_yevmiye NUMERIC(15,2) DEFAULT 0,
    calisma_gunu NUMERIC DEFAULT 0,
    ek_id_orani NUMERIC DEFAULT 0,
    prim NUMERIC DEFAULT 0,
    odeme_tarihi DATE,
    odeme_durumu TEXT DEFAULT 'bekliyor',
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bordro arşiv
CREATE TABLE IF NOT EXISTS bordro_arsiv (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    donem TEXT NOT NULL,
    dosya_adi TEXT,
    dosya_url TEXT,
    dosya_tipi TEXT,
    file_data TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE personeller ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE puantaj_toplamlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE bordro_arsiv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personeller_all" ON personeller FOR ALL USING (true);
CREATE POLICY "projeler_all" ON projeler FOR ALL USING (true);
CREATE POLICY "puantaj_all" ON puantaj_toplamlari FOR ALL USING (true);
CREATE POLICY "bordro_arsiv_all" ON bordro_arsiv FOR ALL USING (true);
