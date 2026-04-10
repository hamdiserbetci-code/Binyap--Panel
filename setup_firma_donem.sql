-- Firmalar tablosuna aktif_donem alanı ekle (takvim yılı)
ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS aktif_donem integer;
-- Mevcut firmaların dönemi bu yıla ayarla
UPDATE firmalar SET aktif_donem = EXTRACT(YEAR FROM NOW())::integer WHERE aktif_donem IS NULL;
