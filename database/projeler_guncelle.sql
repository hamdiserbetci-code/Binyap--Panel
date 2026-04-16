-- projeler tablosuna eksik kolonları ekle
ALTER TABLE projeler
  ADD COLUMN IF NOT EXISTS aciklama         TEXT,
  ADD COLUMN IF NOT EXISTS baslangic_tarihi DATE,
  ADD COLUMN IF NOT EXISTS bitis_tarihi     DATE,
  ADD COLUMN IF NOT EXISTS butce            NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS sorumlu_kisi     TEXT,
  ADD COLUMN IF NOT EXISTS notlar           TEXT,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW();
