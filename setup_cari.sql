-- =============================================================================
-- CARİ HESAPLAR VE HAREKETLER TABLOLARI KURULUMU
-- Supabase SQL Editor'de çalıştırın
-- =============================================================================

-- Cari Hesaplar Tablosu
CREATE TABLE IF NOT EXISTS cari_hesaplar (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    sirket TEXT NOT NULL DEFAULT 'ETM',
    ad TEXT NOT NULL,
    tip TEXT NOT NULL DEFAULT 'musteri',
    vkn_tckn TEXT,
    telefon TEXT,
    email TEXT,
    adres TEXT,
    notlar TEXT,
    bakiye NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tablo zaten var ama bakiye kolonu yoksa diye ekleme
ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS bakiye NUMERIC(15,2) DEFAULT 0;

-- Cari Hareketler Tablosu
CREATE TABLE IF NOT EXISTS cari_hareketler (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    cari_hesap_id UUID NOT NULL REFERENCES cari_hesaplar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
    tarih DATE NOT NULL DEFAULT CURRENT_DATE,
    tur TEXT NOT NULL,
    tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
    aciklama TEXT,
    belge_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API üzerinden temel erişim yetkisini ver
GRANT ALL ON TABLE cari_hesaplar TO authenticated, service_role;
GRANT ALL ON TABLE cari_hareketler TO authenticated, service_role;

-- RLS (Row Level Security) aktif et ve tam yetki politikasını ekle
ALTER TABLE cari_hesaplar ENABLE ROW LEVEL SECURITY;
ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open" ON cari_hesaplar;
DROP POLICY IF EXISTS "open" ON cari_hareketler;
CREATE POLICY "open" ON cari_hesaplar FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open" ON cari_hareketler FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bakiye Güncelleme Fonksiyonu
CREATE OR REPLACE FUNCTION update_cari_bakiye(p_cari_id UUID, p_degisim NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE cari_hesaplar
    SET bakiye = COALESCE(bakiye, 0) + p_degisim
    WHERE id = p_cari_id;
END;
$$;

-- Şema önbelleğini (schema cache) yenile
NOTIFY pgrst, 'reload schema';