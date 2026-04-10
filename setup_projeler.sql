-- projeler tablosuna eksik kolonları ekle
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS baslangic    date;
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS bitis        date;
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS sgk_sicil_no text;
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS musteri_id   uuid;

-- durum kolonu kontrolü (yoksa ekle, varsa kalsın)
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS durum text NOT NULL DEFAULT 'aktif';

-- RLS
ALTER TABLE projeler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projeler_firma_izolasyonu" ON projeler;
CREATE POLICY "projeler_firma_izolasyonu" ON projeler
  FOR ALL
  USING (
    firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid())
  );

-- Schema cache yenile
NOTIFY pgrst, 'reload schema';
