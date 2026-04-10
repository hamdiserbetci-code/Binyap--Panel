-- =============================================================
-- IK TABLOLARI RLS FIX — WITH CHECK eklendi
-- =============================================================

-- ik_personel
DROP POLICY IF EXISTS firma_ik_personel ON ik_personel;
CREATE POLICY firma_ik_personel ON ik_personel
  FOR ALL
  USING      (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- ik_belge
DROP POLICY IF EXISTS firma_ik_belge ON ik_belge;
CREATE POLICY firma_ik_belge ON ik_belge
  FOR ALL
  USING      (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- ik_ekip (varsa)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='ik_ekip') THEN
    DROP POLICY IF EXISTS firma_ik_ekip ON ik_ekip;
    CREATE POLICY firma_ik_ekip ON ik_ekip
      FOR ALL
      USING      (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
      WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
  END IF;
END $$;

-- firma_tam_izolasyon politikası varsa da kaldır (çakışma önleme)
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON ik_personel;
DROP POLICY IF EXISTS "firma_tam_izolasyon" ON ik_belge;
