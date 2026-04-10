-- Fix: kar_zarar_donem musteri bazli tekillik
-- Supabase SQL Editor'de calistirin.

-- 1) Mevcut hatali unique kurallari (firma_id, donem) varsa kaldir.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'kar_zarar_donem'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(firma_id, donem)%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%musteri_id%'
  LOOP
    EXECUTE format('ALTER TABLE kar_zarar_donem DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  FOR r IN
    SELECT schemaname, indexname
    FROM pg_indexes
    WHERE tablename = 'kar_zarar_donem'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%firma_id%'
      AND indexdef ILIKE '%donem%'
      AND indexdef NOT ILIKE '%musteri_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schemaname, r.indexname);
  END LOOP;
END $$;

-- 2) Tekillik kurallari: musteri bazli + genel kayit (musteri_id IS NULL) bazli.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kar_zarar_firma_donem_musteri_notnull
  ON kar_zarar_donem (firma_id, donem, musteri_id)
  WHERE musteri_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kar_zarar_firma_donem_genel
  ON kar_zarar_donem (firma_id, donem)
  WHERE musteri_id IS NULL;

-- 3) (Opsiyonel) Dogrulama sorgusu
-- SELECT firma_id, donem, musteri_id, COUNT(*)
-- FROM kar_zarar_donem
-- GROUP BY 1,2,3
-- HAVING COUNT(*) > 1;
