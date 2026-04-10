-- =============================================================================
-- E-FATURA / E-ARŞİV / E-DEFTER SÜREÇ TAKİP TABLOSU
-- Supabase SQL Editor'de çalıştırın
-- =============================================================================

CREATE TABLE IF NOT EXISTS efatura_surecler (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id    UUID        NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  sirket_id   UUID        REFERENCES sirketler(id) ON DELETE SET NULL,
  tip         TEXT        NOT NULL CHECK (tip IN ('efatura', 'earsiv', 'edefter')),
  donem       TEXT        NOT NULL,   -- YYYY-MM
  durum       TEXT        NOT NULL DEFAULT 'bekliyor',
  fatura_sayisi INTEGER   DEFAULT 0,
  tutar       NUMERIC(14,2) DEFAULT 0,
  notlar      TEXT,
  tamamlandi_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE efatura_surecler ADD COLUMN IF NOT EXISTS fatura_sayisi INTEGER DEFAULT 0;
ALTER TABLE efatura_surecler ADD COLUMN IF NOT EXISTS tutar NUMERIC(14,2) DEFAULT 0;
ALTER TABLE efatura_surecler ADD COLUMN IF NOT EXISTS tamamlandi_at TIMESTAMPTZ;

GRANT ALL ON TABLE efatura_surecler TO authenticated, service_role;
ALTER TABLE efatura_surecler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open" ON efatura_surecler;
CREATE POLICY "open" ON efatura_surecler FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

NOTIFY pgrst, 'reload schema';
