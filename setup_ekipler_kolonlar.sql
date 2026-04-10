-- ekipler tablosuna eksik kolonları ekle
ALTER TABLE ekipler
  ADD COLUMN IF NOT EXISTS renk TEXT NOT NULL DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS kategori TEXT;
