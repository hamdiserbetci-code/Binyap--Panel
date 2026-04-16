-- ============================================================
-- EKSİK KOLONLARI EKLE
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- personeller tablosuna eksik kolonlar
ALTER TABLE personeller
  ADD COLUMN IF NOT EXISTS tc_kimlik          TEXT,
  ADD COLUMN IF NOT EXISTS telefon            TEXT,
  ADD COLUMN IF NOT EXISTS pozisyon           TEXT,
  ADD COLUMN IF NOT EXISTS brut_maas          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS ise_giris_tarihi   DATE,
  ADD COLUMN IF NOT EXISTS isten_cikis_tarihi DATE,
  ADD COLUMN IF NOT EXISTS sgk_no             TEXT,
  ADD COLUMN IF NOT EXISTS banka_iban         TEXT,
  ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ DEFAULT NOW();

-- ekipler tablosuna eksik kolonlar
ALTER TABLE ekipler
  ADD COLUMN IF NOT EXISTS ekip_adi   TEXT,
  ADD COLUMN IF NOT EXISTS sef_adi    TEXT,
  ADD COLUMN IF NOT EXISTS aciklama   TEXT,
  ADD COLUMN IF NOT EXISTS aktif      BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Eğer ekipler tablosunda ad_soyad gibi yanlış kolon varsa
-- ekip_adi'nı ad kolonundan doldur (varsa)
UPDATE ekipler SET ekip_adi = ad WHERE ekip_adi IS NULL AND ad IS NOT NULL;

-- projeler tablosuna eksik kolonlar (daha önce eklenmediyse)
ALTER TABLE projeler
  ADD COLUMN IF NOT EXISTS aciklama         TEXT,
  ADD COLUMN IF NOT EXISTS baslangic_tarihi DATE,
  ADD COLUMN IF NOT EXISTS bitis_tarihi     DATE,
  ADD COLUMN IF NOT EXISTS butce            NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS sorumlu_kisi     TEXT,
  ADD COLUMN IF NOT EXISTS notlar           TEXT,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW();

-- Kontrol
SELECT 'personeller' as tablo, column_name FROM information_schema.columns WHERE table_name = 'personeller'
UNION ALL
SELECT 'ekipler', column_name FROM information_schema.columns WHERE table_name = 'ekipler'
UNION ALL
SELECT 'projeler', column_name FROM information_schema.columns WHERE table_name = 'projeler'
ORDER BY tablo, column_name;
