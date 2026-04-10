-- ekipler tablosu RLS fix
ALTER TABLE ekipler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "firma_tam_izolasyon" ON ekipler;
CREATE POLICY "firma_tam_izolasyon" ON ekipler
  FOR ALL
  USING      (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
