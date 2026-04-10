-- kasa_hareketleri: eksik kolonları ekle + eski veri değerlerini dönüştür

-- 1. Eksik kolonları ekle
ALTER TABLE kasa_hareketleri ADD COLUMN IF NOT EXISTS odeme_sekli TEXT DEFAULT 'nakit';

-- 2. Eski 'giris'/'cikis' değerlerini yeni standarda dönüştür
--    (Zaten 'gelir'/'gider' olan satırlar etkilenmez)
UPDATE kasa_hareketleri SET tur = 'gelir' WHERE tur = 'giris';
UPDATE kasa_hareketleri SET tur = 'gider' WHERE tur = 'cikis';

-- NULL kalan varsa düzelt
UPDATE kasa_hareketleri SET tur         = 'gider' WHERE tur         IS NULL;
UPDATE kasa_hareketleri SET odeme_sekli = 'nakit'  WHERE odeme_sekli IS NULL;

-- 3. RLS politikasını güncelle (firma izolasyonu)
ALTER TABLE kasa_hareketleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "firma_tam_izolasyon"   ON kasa_hareketleri;
DROP POLICY IF EXISTS "kasa_firma_izolasyonu" ON kasa_hareketleri;

CREATE POLICY "kasa_firma_izolasyonu" ON kasa_hareketleri
  FOR ALL
  USING (
    firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
  );

-- 4. PostgREST schema cache yenile
NOTIFY pgrst, 'reload schema';
