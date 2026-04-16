-- =============================================================================
-- EKİP BAZLI GÜNLÜK PUANTAJ TAKİP TABLOSU
-- =============================================================================

-- Ön Koşul: Bağımlı olunan ana tabloların varlığından emin olalım.
CREATE TABLE IF NOT EXISTS firmalar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projeler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    ad TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ekipler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE CASCADE,
    ad TEXT NOT NULL,
    sorumlu TEXT,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ekip_gunluk_puantaj (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    proje_id UUID NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
    ekip_id UUID NOT NULL REFERENCES ekipler(id) ON DELETE CASCADE,
    donem TEXT NOT NULL, -- Örn: '2026-04'
    tarih DATE NOT NULL,
    durum TEXT NOT NULL CHECK (durum IN ('Çalışma', 'Hafta Tatili', 'Resmi Tatil', 'Ücretli İzin', 'Ücretsiz İzin', 'Raporlu')),
    aciklama TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ekip_id, tarih)
);

-- RLS ve İzinler
ALTER TABLE ekip_gunluk_puantaj ENABLE ROW LEVEL SECURITY;

-- Eğer policy daha önce eklendiyse çakışmaması için önce düşürülür
DROP POLICY IF EXISTS "puantaj_tam_erisim" ON ekip_gunluk_puantaj;
CREATE POLICY "puantaj_tam_erisim" ON ekip_gunluk_puantaj FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON TABLE ekip_gunluk_puantaj TO authenticated, service_role;

-- Tarih güncellendiğinde updated_at'i otomatik güncellemek için trigger
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eğer trigger daha önce eklendiyse çakışmaması için önce düşürülür
DROP TRIGGER IF EXISTS set_puantaj_timestamp ON ekip_gunluk_puantaj;

CREATE TRIGGER set_puantaj_timestamp
BEFORE UPDATE ON ekip_gunluk_puantaj
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Schema önbelleğini yenile (Altta bir boş satır olması önemlidir)
NOTIFY pgrst, 'reload schema';