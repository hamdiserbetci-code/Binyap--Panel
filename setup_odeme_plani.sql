CREATE TABLE IF NOT EXISTS odeme_plani (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
    ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL,
    baslik TEXT NOT NULL,
    tur TEXT NOT NULL CHECK (tur IN ('cek', 'vergi', 'sgk', 'cari_hesap', 'maas', 'kredi')),
    ilgili_kurum TEXT,
    tutar NUMERIC(12,2) NOT NULL DEFAULT 0,
    vade_tarihi DATE NOT NULL,
    durum TEXT NOT NULL DEFAULT 'odenecek' CHECK (durum IN ('odenecek', 'odendi')),
    aciklama TEXT,
    hatirlatici_tarihi DATE,
    hatirlatici_saati TEXT,
    hatirlat_gun_once INTEGER DEFAULT 3,
    tamamlandi_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS ilgili_kurum TEXT;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS hatirlatici_tarihi DATE;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS hatirlatici_saati TEXT;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS hatirlat_gun_once INTEGER DEFAULT 3;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS tamamlandi_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_odeme_plani_firma ON odeme_plani(firma_id);
CREATE INDEX IF NOT EXISTS idx_odeme_plani_vade ON odeme_plani(vade_tarihi);
CREATE INDEX IF NOT EXISTS idx_odeme_plani_durum ON odeme_plani(durum);
CREATE INDEX IF NOT EXISTS idx_odeme_plani_hatirlatma ON odeme_plani(hatirlatici_tarihi, hatirlatici_saati);

GRANT ALL ON TABLE odeme_plani TO authenticated;
GRANT ALL ON TABLE odeme_plani TO service_role;

ALTER TABLE odeme_plani ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_odeme_plani_secer" ON odeme_plani;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_odeme_plani_ekler" ON odeme_plani;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_odeme_plani_gunceller" ON odeme_plani;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_odeme_plani_siler" ON odeme_plani;

CREATE POLICY "kullanici_kendi_firmasi_odeme_plani_secer" ON odeme_plani FOR SELECT
USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "kullanici_kendi_firmasi_odeme_plani_ekler" ON odeme_plani FOR INSERT
WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "kullanici_kendi_firmasi_odeme_plani_gunceller" ON odeme_plani FOR UPDATE
USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "kullanici_kendi_firmasi_odeme_plani_siler" ON odeme_plani FOR DELETE
USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
