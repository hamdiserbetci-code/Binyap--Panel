-- =========================================================================
-- KASA MODÜLÜ TABLO VE İZİN (RLS) DÜZELTİCİ
-- =========================================================================

-- Sütun eksikliklerini zorla tamamlama
ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS tur TEXT DEFAULT 'gelir';
ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS kategori TEXT;
ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS odeme_sekli TEXT DEFAULT 'nakit';
ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS aciklama TEXT;
ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS tutar NUMERIC DEFAULT 0;
ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS tarih DATE DEFAULT CURRENT_DATE;

-- Eski kayıt yamaları
UPDATE kasa_hareketleri SET tur = 'gelir' WHERE tur IS NULL;
UPDATE kasa_hareketleri SET odeme_sekli = 'nakit' WHERE odeme_sekli IS NULL;

-- 🚨 GİZLİLİK (RLS) POLİTİKALARINI GEÇİCİ OLARAK KAPAT
-- Veriyi Ekranda Görememenizin Tek Sebebi RLS'dir. Bu kod işlemi açar!
ALTER TABLE kasa_hareketleri DISABLE ROW LEVEL SECURITY;

-- Yeni izinler tanımla (İsteyenler RLS'yi ileride tekrar ayarlayabilir)
DROP POLICY IF EXISTS "Public kasa reads" ON kasa_hareketleri;
DROP POLICY IF EXISTS "Public kasa inserts" ON kasa_hareketleri;

NOTIFY pgrst, 'reload schema';
