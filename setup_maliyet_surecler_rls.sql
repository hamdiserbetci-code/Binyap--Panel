-- =============================================================================
-- maliyet_surecler tablosu için RLS politikası
-- "new row violates row-level security policy" hatasını çözer
-- Supabase SQL Editor üzerinde çalıştırın.
-- =============================================================================

ALTER TABLE maliyet_surecler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "firma_tam_izolasyon" ON maliyet_surecler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_maliyet_secer" ON maliyet_surecler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_maliyet_ekler" ON maliyet_surecler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_maliyet_gunceller" ON maliyet_surecler;
DROP POLICY IF EXISTS "kullanici_kendi_firmasi_maliyet_siler" ON maliyet_surecler;

CREATE POLICY "firma_tam_izolasyon" ON maliyet_surecler
FOR ALL
USING (
  auth.role() = 'authenticated' AND firma_id = current_firma_id()
)
WITH CHECK (
  auth.role() = 'authenticated' AND firma_id = current_firma_id()
);
