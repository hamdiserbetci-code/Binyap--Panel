-- Kar/Zarar tablosuna yeni kolonlar ekle
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS yil INTEGER;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS ay INTEGER;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS diger_satislar NUMERIC(14,2) DEFAULT 0;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS malzeme_alis NUMERIC(14,2) DEFAULT 0;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS iscilik NUMERIC(14,2) DEFAULT 0;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS finans_gideri NUMERIC(14,2) DEFAULT 0;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS sigorta_gideri NUMERIC(14,2) DEFAULT 0;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS amortisman NUMERIC(14,2) DEFAULT 0;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS onceki_donem_devir NUMERIC(14,2) DEFAULT 0;
ALTER TABLE kar_zarar ADD COLUMN IF NOT EXISTS net_kar_zarar NUMERIC(14,2) DEFAULT 0;

-- Mevcut kayitlardaki donem'den yil/ay doldur
UPDATE kar_zarar SET
  yil = EXTRACT(YEAR FROM donem::date)::integer,
  ay  = EXTRACT(MONTH FROM donem::date)::integer
WHERE donem IS NOT NULL AND yil IS NULL;
