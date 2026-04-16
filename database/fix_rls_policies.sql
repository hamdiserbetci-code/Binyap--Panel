-- ============================================================
-- RLS POLICY DÜZELTMESİ — MEVCUT TABLOLAR
-- Supabase Dashboard → SQL Editor → Yapıştır → Run
-- ============================================================

-- projeler
DROP POLICY IF EXISTS "firma_policy_projeler" ON projeler;
DROP POLICY IF EXISTS "projeler_all"          ON projeler;
DROP POLICY IF EXISTS "projeler_select"       ON projeler;
CREATE POLICY "projeler_all" ON projeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- personeller
DROP POLICY IF EXISTS "firma_policy_personeller" ON personeller;
DROP POLICY IF EXISTS "personeller_all"          ON personeller;
CREATE POLICY "personeller_all" ON personeller
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- kasa_hareketleri
DROP POLICY IF EXISTS "firma_policy_kasa_hareketleri" ON kasa_hareketleri;
DROP POLICY IF EXISTS "kasa_hareketleri_all"          ON kasa_hareketleri;
CREATE POLICY "kasa_hareketleri_all" ON kasa_hareketleri
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- banka_hesaplari
DROP POLICY IF EXISTS "firma_policy_banka_hesaplari" ON banka_hesaplari;
DROP POLICY IF EXISTS "banka_hesaplari_all"          ON banka_hesaplari;
CREATE POLICY "banka_hesaplari_all" ON banka_hesaplari
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- odeme_plani
DROP POLICY IF EXISTS "firma_policy_odeme_plani" ON odeme_plani;
DROP POLICY IF EXISTS "odeme_plani_all"          ON odeme_plani;
CREATE POLICY "odeme_plani_all" ON odeme_plani
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- kar_zarar
DROP POLICY IF EXISTS "firma_policy_kar_zarar" ON kar_zarar;
DROP POLICY IF EXISTS "kar_zarar_all"          ON kar_zarar;
CREATE POLICY "kar_zarar_all" ON kar_zarar
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- bordro_donemleri
DROP POLICY IF EXISTS "firma_policy_bordro_donemleri" ON bordro_donemleri;
DROP POLICY IF EXISTS "bordro_donemleri_all"          ON bordro_donemleri;
CREATE POLICY "bordro_donemleri_all" ON bordro_donemleri
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- bordro_surec_adimlari
DROP POLICY IF EXISTS "bordro_surec_policy"          ON bordro_surec_adimlari;
DROP POLICY IF EXISTS "bordro_surec_adimlari_all"    ON bordro_surec_adimlari;
CREATE POLICY "bordro_surec_adimlari_all" ON bordro_surec_adimlari
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- bordro_belgeler
DROP POLICY IF EXISTS "bordro_belgeler_policy" ON bordro_belgeler;
DROP POLICY IF EXISTS "bordro_belgeler_all"    ON bordro_belgeler;
CREATE POLICY "bordro_belgeler_all" ON bordro_belgeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- icra_takibi
DROP POLICY IF EXISTS "firma_policy_icra_takibi" ON icra_takibi;
DROP POLICY IF EXISTS "icra_takibi_all"          ON icra_takibi;
CREATE POLICY "icra_takibi_all" ON icra_takibi
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- ekipler
DROP POLICY IF EXISTS "ekipler_policy" ON ekipler;
DROP POLICY IF EXISTS "ekipler_all"    ON ekipler;
CREATE POLICY "ekipler_all" ON ekipler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- ekip_personel
DROP POLICY IF EXISTS "ekip_personel_policy" ON ekip_personel;
DROP POLICY IF EXISTS "ekip_personel_all"    ON ekip_personel;
CREATE POLICY "ekip_personel_all" ON ekip_personel
  FOR ALL TO authenticated
  USING (ekip_id IN (
    SELECT e.id FROM ekipler e
    JOIN kullanici_profilleri k ON k.firma_id = e.firma_id
    WHERE k.auth_user_id = auth.uid()
  ))
  WITH CHECK (ekip_id IN (
    SELECT e.id FROM ekipler e
    JOIN kullanici_profilleri k ON k.firma_id = e.firma_id
    WHERE k.auth_user_id = auth.uid()
  ));

-- firmalar
DROP POLICY IF EXISTS "firma_izolasyon" ON firmalar;
DROP POLICY IF EXISTS "firmalar_all"    ON firmalar;
CREATE POLICY "firmalar_all" ON firmalar
  FOR ALL TO authenticated
  USING (id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

-- kullanici_profilleri
DROP POLICY IF EXISTS "kullanici_profil" ON kullanici_profilleri;
DROP POLICY IF EXISTS "kullanici_all"    ON kullanici_profilleri;
CREATE POLICY "kullanici_all" ON kullanici_profilleri
  FOR ALL TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Kontrol
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'projeler','personeller','kasa_hareketleri','banka_hesaplari',
    'odeme_plani','kar_zarar','bordro_donemleri','bordro_surec_adimlari',
    'bordro_belgeler','icra_takibi','ekipler','ekip_personel',
    'firmalar','kullanici_profilleri'
  )
ORDER BY tablename;
