-- =============================================================================
-- TENANT TABLOLARI RLS DÜZELTME
-- "permission denied" hatalarını gidermek için
-- Supabase SQL Editor'de çalıştırın.
-- =============================================================================

-- ── firmalar ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "firmalar_select" ON firmalar;
DROP POLICY IF EXISTS "firmalar_insert" ON firmalar;
DROP POLICY IF EXISTS "firmalar_update" ON firmalar;
DROP POLICY IF EXISTS "firmalar_delete" ON firmalar;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON firmalar;

ALTER TABLE firmalar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firmalar_select" ON firmalar FOR SELECT TO authenticated USING (true);
CREATE POLICY "firmalar_insert" ON firmalar FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "firmalar_update" ON firmalar FOR UPDATE TO authenticated USING (true);
CREATE POLICY "firmalar_delete" ON firmalar FOR DELETE TO authenticated USING (true);

GRANT ALL ON firmalar TO authenticated;
GRANT SELECT ON firmalar TO anon;

-- ── kullanici_profilleri ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kullanici_profilleri_select" ON kullanici_profilleri;
DROP POLICY IF EXISTS "kullanici_profilleri_insert" ON kullanici_profilleri;
DROP POLICY IF EXISTS "kullanici_profilleri_update" ON kullanici_profilleri;
DROP POLICY IF EXISTS "kullanici_profilleri_delete" ON kullanici_profilleri;

ALTER TABLE kullanici_profilleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kullanici_profilleri_select" ON kullanici_profilleri FOR SELECT TO authenticated USING (true);
CREATE POLICY "kullanici_profilleri_insert" ON kullanici_profilleri FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "kullanici_profilleri_update" ON kullanici_profilleri FOR UPDATE TO authenticated USING (true);
CREATE POLICY "kullanici_profilleri_delete" ON kullanici_profilleri FOR DELETE TO authenticated USING (true);

GRANT ALL ON kullanici_profilleri TO authenticated;

-- ── sirketler ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sirketler_select" ON sirketler;
DROP POLICY IF EXISTS "sirketler_insert" ON sirketler;
DROP POLICY IF EXISTS "sirketler_update" ON sirketler;
DROP POLICY IF EXISTS "sirketler_delete" ON sirketler;

ALTER TABLE sirketler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sirketler_select" ON sirketler FOR SELECT TO authenticated USING (true);
CREATE POLICY "sirketler_insert" ON sirketler FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sirketler_update" ON sirketler FOR UPDATE TO authenticated USING (true);
CREATE POLICY "sirketler_delete" ON sirketler FOR DELETE TO authenticated USING (true);

GRANT ALL ON sirketler TO authenticated;

-- ── kullanici_yetkileri ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kullanici_yetkileri_select" ON kullanici_yetkileri;
DROP POLICY IF EXISTS "kullanici_yetkileri_insert" ON kullanici_yetkileri;
DROP POLICY IF EXISTS "kullanici_yetkileri_update" ON kullanici_yetkileri;
DROP POLICY IF EXISTS "kullanici_yetkileri_delete" ON kullanici_yetkileri;

ALTER TABLE kullanici_yetkileri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kullanici_yetkileri_select" ON kullanici_yetkileri FOR SELECT TO authenticated USING (true);
CREATE POLICY "kullanici_yetkileri_insert" ON kullanici_yetkileri FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "kullanici_yetkileri_update" ON kullanici_yetkileri FOR UPDATE TO authenticated USING (true);
CREATE POLICY "kullanici_yetkileri_delete" ON kullanici_yetkileri FOR DELETE TO authenticated USING (true);

GRANT ALL ON kullanici_yetkileri TO authenticated;
