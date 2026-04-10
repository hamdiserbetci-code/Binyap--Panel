CREATE TABLE IF NOT EXISTS cekler (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
    tip TEXT NOT NULL CHECK (tip IN ('alinan', 'verilen')),
    cek_no TEXT NOT NULL,
    banka TEXT,
    cari_hesap TEXT,
    tutar NUMERIC(12,2) NOT NULL DEFAULT 0,
    keside_tarihi DATE,
    vade_tarihi DATE NOT NULL,
    durum TEXT NOT NULL DEFAULT 'odenecek' CHECK (durum IN ('odenecek', 'odendi')),
    aciklama TEXT,
    hatirlatici_tarihi DATE,
    hatirlatici_saati TEXT,
    hatirlat_gun_once INTEGER DEFAULT 1,
    tamamlandi_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cekler ADD COLUMN IF NOT EXISTS hatirlatici_tarihi DATE;
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS hatirlatici_saati TEXT;
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS hatirlat_gun_once INTEGER DEFAULT 1;
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS tamamlandi_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS cari_hesap TEXT;

CREATE INDEX IF NOT EXISTS idx_cekler_firma ON cekler(firma_id);
CREATE INDEX IF NOT EXISTS idx_cekler_vade ON cekler(vade_tarihi);
CREATE INDEX IF NOT EXISTS idx_cekler_musteri ON cekler(musteri_id);
CREATE INDEX IF NOT EXISTS idx_cekler_hatirlatma ON cekler(hatirlatici_tarihi, hatirlatici_saati);

GRANT ALL ON TABLE cekler TO authenticated;
GRANT ALL ON TABLE cekler TO service_role;

ALTER TABLE cekler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_cekler_secer" ON cekler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_cekler_ekler" ON cekler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_cekler_gunceller" ON cekler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_cekler_siler" ON cekler;

CREATE POLICY "kullanici_kendi_firmasi_cekler_secer" ON cekler FOR SELECT
USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "kullanici_kendi_firmasi_cekler_ekler" ON cekler FOR INSERT
WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "kullanici_kendi_firmasi_cekler_gunceller" ON cekler FOR UPDATE
USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "kullanici_kendi_firmasi_cekler_siler" ON cekler FOR DELETE
USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
