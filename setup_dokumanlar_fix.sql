-- Fix dokumanlar table: ensure required columns exist and RLS is correct

-- Create table if not exists (safe to run multiple times)
CREATE TABLE IF NOT EXISTS dokumanlar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firma_id uuid NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  modul text,
  bagli_tablo text,
  bagli_kayit_id uuid,
  dosya_adi text,
  dosya_url text,
  mime_type text,
  dosya_boyutu bigint,
  kategori text,
  aciklama text,
  yukleyen_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add missing columns if they don't exist (safe ALTER TABLE)
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS bagli_tablo text;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS bagli_kayit_id uuid;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS modul text;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS dosya_boyutu bigint;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS kategori text;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS aciklama text;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS yukleyen_id uuid;

-- Enable RLS
ALTER TABLE dokumanlar ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies
DROP POLICY IF EXISTS "firma_izolasyonu" ON dokumanlar;
DROP POLICY IF EXISTS "dokumanlar_firma_izolasyonu" ON dokumanlar;

CREATE POLICY "dokumanlar_firma_izolasyonu" ON dokumanlar
  USING (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  );

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_dokumanlar_firma_id ON dokumanlar(firma_id);
CREATE INDEX IF NOT EXISTS idx_dokumanlar_bagli ON dokumanlar(bagli_tablo, bagli_kayit_id);

-- Schema cache yenile (Supabase'in yeni kolonu hemen tanıması için)
NOTIFY pgrst, 'reload schema';
