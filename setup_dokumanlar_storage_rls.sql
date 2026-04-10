-- Storage bucket 'dokumanlar' için RLS politikaları
-- Supabase SQL Editor'da çalıştırın

-- Eski politikaları temizle
DROP POLICY IF EXISTS "dokumanlar_okuma"   ON storage.objects;
DROP POLICY IF EXISTS "dokumanlar_yukleme" ON storage.objects;
DROP POLICY IF EXISTS "dokumanlar_silme"   ON storage.objects;
DROP POLICY IF EXISTS "dokumanlar_guncelle" ON storage.objects;

-- SELECT (okuma)
CREATE POLICY "dokumanlar_okuma" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dokumanlar'
    AND (storage.foldername(name))[1] IN (
      SELECT firma_id::text
      FROM kullanici_profilleri
      WHERE auth_user_id = auth.uid()
    )
  );

-- INSERT (yükleme)
CREATE POLICY "dokumanlar_yukleme" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dokumanlar'
    AND (storage.foldername(name))[1] IN (
      SELECT firma_id::text
      FROM kullanici_profilleri
      WHERE auth_user_id = auth.uid()
    )
  );

-- UPDATE (güncelleme)
CREATE POLICY "dokumanlar_guncelle" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dokumanlar'
    AND (storage.foldername(name))[1] IN (
      SELECT firma_id::text
      FROM kullanici_profilleri
      WHERE auth_user_id = auth.uid()
    )
  );

-- DELETE (silme)
CREATE POLICY "dokumanlar_silme" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dokumanlar'
    AND (storage.foldername(name))[1] IN (
      SELECT firma_id::text
      FROM kullanici_profilleri
      WHERE auth_user_id = auth.uid()
    )
  );
