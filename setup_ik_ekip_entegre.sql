-- ekipler tablosuna renk kolonu ekle (IK modülü için)
ALTER TABLE ekipler ADD COLUMN IF NOT EXISTS renk text NOT NULL DEFAULT 'blue';

-- ik_personel.ekip_id referansını ik_ekip'ten ekipler'e taşı
-- Önce eski foreign key'i kaldır (varsa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='ik_personel' AND column_name='ekip_id'
  ) THEN
    -- Mevcut constraint adını bul ve kaldır
    ALTER TABLE ik_personel DROP CONSTRAINT IF EXISTS ik_personel_ekip_id_fkey;
    -- ekipler tablosuna referans ver
    ALTER TABLE ik_personel
      ADD CONSTRAINT ik_personel_ekip_id_fkey
      FOREIGN KEY (ekip_id) REFERENCES ekipler(id) ON DELETE SET NULL;
  ELSE
    ALTER TABLE ik_personel ADD COLUMN ekip_id uuid REFERENCES ekipler(id) ON DELETE SET NULL;
  END IF;
END $$;
