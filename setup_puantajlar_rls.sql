-- =============================================================================
-- PUANTAJLAR TABLOSU İÇİN RLS (GİZLİLİK) İZİNLERİNİ DÜZELTME
-- Supabase SQL Editor'de çalıştırın
-- =============================================================================

-- Tabloya API üzerinden temel erişim yetkisi ver
GRANT ALL ON TABLE puantajlar TO authenticated, service_role;

ALTER TABLE puantajlar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "puantajlar_tam_erisim" ON puantajlar;
CREATE POLICY "puantajlar_tam_erisim" ON puantajlar FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';