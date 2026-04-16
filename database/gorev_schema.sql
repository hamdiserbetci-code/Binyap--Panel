-- ============================================================
-- GÖREV TAKİBİ (TO-DO LIST)
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

CREATE TABLE IF NOT EXISTS gorevler (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id          UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  baslik            TEXT NOT NULL,
  aciklama          TEXT,
  oncelik           TEXT DEFAULT 'normal' CHECK (oncelik IN ('dusuk','normal','yuksek','kritik')),
  kategori          TEXT DEFAULT 'genel' CHECK (kategori IN ('genel','finans','ik','hukuk','vergi','proje','diger')),
  durum             TEXT DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','devam','tamamlandi','ertelendi','iptal')),
  atanan_kisi       TEXT,
  son_tarih         DATE,
  hatirlatma_tarihi TIMESTAMPTZ,
  erteleme_tarihi   DATE,
  erteleme_notu     TEXT,
  tamamlanma_tarihi TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gorev_belgeler (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gorev_id     UUID NOT NULL REFERENCES gorevler(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  dosya_adi    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  belge_tipi   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gorevler       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorev_belgeler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gorevler_all"       ON gorevler;
DROP POLICY IF EXISTS "gorev_belgeler_all" ON gorev_belgeler;

CREATE POLICY "gorevler_all" ON gorevler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "gorev_belgeler_all" ON gorev_belgeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

GRANT ALL ON gorevler       TO authenticated;
GRANT ALL ON gorev_belgeler TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('gorev-belgeler', 'gorev-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "gorev_belgeler_upload" ON storage.objects;
DROP POLICY IF EXISTS "gorev_belgeler_read"   ON storage.objects;
DROP POLICY IF EXISTS "gorev_belgeler_delete" ON storage.objects;

CREATE POLICY "gorev_belgeler_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gorev-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "gorev_belgeler_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'gorev-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "gorev_belgeler_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'gorev-belgeler' AND auth.role() = 'authenticated');
