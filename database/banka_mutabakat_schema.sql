-- Aylık banka mutabakatı
-- Supabase SQL Editor'da bir kez çalıştırın.

CREATE TABLE IF NOT EXISTS banka_mutabakatlari (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  banka_hesap_id UUID NOT NULL REFERENCES banka_hesaplari(id) ON DELETE CASCADE,
  donem TEXT NOT NULL,
  ay_sonu_bakiye NUMERIC(15,2) NOT NULL DEFAULT 0,
  durum TEXT NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','mutabakat_yapildi')),
  tamamlanma_tarihi TIMESTAMPTZ,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(banka_hesap_id, donem)
);

CREATE TABLE IF NOT EXISTS banka_mutabakat_belgeleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mutabakat_id UUID NOT NULL REFERENCES banka_mutabakatlari(id) ON DELETE CASCADE,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  belge_turu TEXT NOT NULL CHECK (belge_turu IN ('hesap_ekstresi','hesap_muavini')),
  dosya_adi TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE banka_mutabakatlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka_mutabakat_belgeleri ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE banka_mutabakatlari, banka_mutabakat_belgeleri TO authenticated;

DROP POLICY IF EXISTS banka_mutabakatlari_firma_policy ON banka_mutabakatlari;
CREATE POLICY banka_mutabakatlari_firma_policy ON banka_mutabakatlari FOR ALL TO authenticated
USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS banka_mutabakat_belgeleri_firma_policy ON banka_mutabakat_belgeleri;
CREATE POLICY banka_mutabakat_belgeleri_firma_policy ON banka_mutabakat_belgeleri FOR ALL TO authenticated
USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('banka-mutabakat-belgeler', 'banka-mutabakat-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS banka_mutabakat_storage_select ON storage.objects;
CREATE POLICY banka_mutabakat_storage_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'banka-mutabakat-belgeler');
DROP POLICY IF EXISTS banka_mutabakat_storage_insert ON storage.objects;
CREATE POLICY banka_mutabakat_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banka-mutabakat-belgeler');
DROP POLICY IF EXISTS banka_mutabakat_storage_delete ON storage.objects;
CREATE POLICY banka_mutabakat_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'banka-mutabakat-belgeler');
