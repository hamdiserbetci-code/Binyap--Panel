-- ============================================================
-- İCRA TAKİBİ GÜNCELLEMESİ
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- icra_takibi tablosuna eksik kolonlar
ALTER TABLE icra_takibi
  ADD COLUMN IF NOT EXISTS tebligat_tarihi    DATE,
  ADD COLUMN IF NOT EXISTS cevap_tarihi       DATE,
  ADD COLUMN IF NOT EXISTS cevap_tipi         TEXT CHECK (cevap_tipi IN ('devam_ediyor','ayrildi','diger')),
  ADD COLUMN IF NOT EXISTS isten_cikis_tarihi DATE;

-- İcra aylık ödemeler tablosu
CREATE TABLE IF NOT EXISTS icra_odemeler_v2 (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  icra_id      UUID NOT NULL REFERENCES icra_takibi(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  odeme_tarihi DATE NOT NULL,
  tutar        NUMERIC(12,2) NOT NULL,
  aciklama     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- İcra belgeler tablosu (tebligat, üst yazı, cevap yazısı)
CREATE TABLE IF NOT EXISTS icra_belgeler (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  icra_id      UUID NOT NULL REFERENCES icra_takibi(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  belge_turu   TEXT NOT NULL CHECK (belge_turu IN ('tebligat','ust_yazi','cevap_yazisi','diger')),
  dosya_adi    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  belge_tarihi DATE,
  aciklama     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE icra_odemeler_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE icra_belgeler     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "icra_odemeler_v2_all" ON icra_odemeler_v2;
DROP POLICY IF EXISTS "icra_belgeler_all"     ON icra_belgeler;

CREATE POLICY "icra_odemeler_v2_all" ON icra_odemeler_v2
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "icra_belgeler_all" ON icra_belgeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

GRANT ALL ON icra_odemeler_v2 TO authenticated;
GRANT ALL ON icra_belgeler     TO authenticated;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('icra-belgeler', 'icra-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "icra_belgeler_upload" ON storage.objects;
DROP POLICY IF EXISTS "icra_belgeler_read"   ON storage.objects;
DROP POLICY IF EXISTS "icra_belgeler_delete" ON storage.objects;

CREATE POLICY "icra_belgeler_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'icra-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "icra_belgeler_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'icra-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "icra_belgeler_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'icra-belgeler' AND auth.role() = 'authenticated');
