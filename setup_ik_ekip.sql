-- IK Ekip tablosu
CREATE TABLE IF NOT EXISTS ik_ekip (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firma_id   uuid NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_id   uuid REFERENCES projeler(id) ON DELETE SET NULL,
  ad         text NOT NULL,
  renk       text NOT NULL DEFAULT 'blue',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ik_ekip ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ik_ekip' AND policyname='firma_ik_ekip') THEN
    CREATE POLICY firma_ik_ekip ON ik_ekip
      USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
      WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
  END IF;
END $$;

-- ik_personel tablosuna ekip_id kolonunu ekle (yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='ik_personel' AND column_name='ekip_id'
  ) THEN
    ALTER TABLE ik_personel ADD COLUMN ekip_id uuid REFERENCES ik_ekip(id) ON DELETE SET NULL;
  END IF;
END $$;
