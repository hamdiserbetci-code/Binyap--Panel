-- Beyanname & SGK Takibi
-- Supabase SQL Editor'de bir kez çalıştırın.

CREATE TABLE IF NOT EXISTS beyanname_takibi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  tip TEXT NOT NULL CHECK (tip IN ('kdv','kdv2','muhsgk','gecici_vergi','kurumlar_vergisi','sgk')),
  donem TEXT NOT NULL,
  son_tarih DATE NOT NULL,
  durum TEXT NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','hazirlaniyor','verildi','onaylandi','kismi_odendi','odendi','gecikti')),
  tahakkuk_tutari NUMERIC(15,2) NOT NULL DEFAULT 0,
  odenen_tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
  verilis_tarihi DATE,
  beyanname_no TEXT,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beyanname_odemeleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  beyanname_id UUID NOT NULL REFERENCES beyanname_takibi(id) ON DELETE CASCADE,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  odeme_tarihi DATE NOT NULL,
  tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
  odeme_kanali TEXT NOT NULL DEFAULT 'banka' CHECK (odeme_kanali IN ('banka','nakit')),
  dekont_no TEXT,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beyanname_belgeleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  beyanname_id UUID NOT NULL REFERENCES beyanname_takibi(id) ON DELETE CASCADE,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  belge_turu TEXT NOT NULL DEFAULT 'belge',
  dosya_adi TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  aciklama TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS beyanname_takibi_firma_tarih_idx ON beyanname_takibi(firma_id, son_tarih);
CREATE INDEX IF NOT EXISTS beyanname_odemeleri_beyanname_idx ON beyanname_odemeleri(beyanname_id);
CREATE INDEX IF NOT EXISTS beyanname_belgeleri_beyanname_idx ON beyanname_belgeleri(beyanname_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  beyanname_takibi,
  beyanname_odemeleri,
  beyanname_belgeleri
TO authenticated;

ALTER TABLE beyanname_takibi ENABLE ROW LEVEL SECURITY;
ALTER TABLE beyanname_odemeleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE beyanname_belgeleri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beyanname_takibi_firma_policy ON beyanname_takibi;
CREATE POLICY beyanname_takibi_firma_policy ON beyanname_takibi FOR ALL USING (
  firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS beyanname_odemeleri_firma_policy ON beyanname_odemeleri;
CREATE POLICY beyanname_odemeleri_firma_policy ON beyanname_odemeleri FOR ALL USING (
  firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS beyanname_belgeleri_firma_policy ON beyanname_belgeleri;
CREATE POLICY beyanname_belgeleri_firma_policy ON beyanname_belgeleri FOR ALL USING (
  firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('beyanname-belgeler', 'beyanname-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS beyanname_storage_select ON storage.objects;
CREATE POLICY beyanname_storage_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'beyanname-belgeler');
DROP POLICY IF EXISTS beyanname_storage_insert ON storage.objects;
CREATE POLICY beyanname_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'beyanname-belgeler');
DROP POLICY IF EXISTS beyanname_storage_delete ON storage.objects;
CREATE POLICY beyanname_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'beyanname-belgeler');
