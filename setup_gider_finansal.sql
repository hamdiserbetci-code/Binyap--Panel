-- Finansal Giderler kolonu ekle
ALTER TABLE kar_zarar_donem
  ADD COLUMN IF NOT EXISTS gider_finansal NUMERIC(15,2) NOT NULL DEFAULT 0;
