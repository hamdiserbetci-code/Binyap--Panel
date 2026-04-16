-- ============================================================
-- İCRA TAKİBİ V2 — YENİ TEMİZ TABLO YAPISI
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- Ana icra tablosu
CREATE TABLE IF NOT EXISTS icra_v2 (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  personel_id         UUID REFERENCES personeller(id) ON DELETE SET NULL,
  -- Personel bilgileri (personel silinse bile kalsın diye kopyalanır)
  personel_adi        TEXT NOT NULL,
  tc_kimlik           TEXT,
  -- İcra bilgileri
  icra_tipi           TEXT DEFAULT 'ilamsiz' CHECK (icra_tipi IN ('ilamsiz','ilamli','haciz','nafaka','diger')),
  dosya_no            TEXT NOT NULL,
  icra_dairesi        TEXT,
  alacakli            TEXT,
  -- Borç takibi
  toplam_borc         NUMERIC(12,2) NOT NULL DEFAULT 0,
  odenen_tutar        NUMERIC(12,2) NOT NULL DEFAULT 0,
  kalan_borc          NUMERIC(12,2) NOT NULL DEFAULT 0,
  aylik_kesinti       NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Tarihler
  baslangic_tarihi    DATE,
  bitis_tarihi        DATE,
  tebligat_tarihi     DATE,
  cevap_tarihi        DATE,
  -- Durum
  durum               TEXT DEFAULT 'aktif' CHECK (durum IN ('aktif','odeme_plani','kapandi','itiraz')),
  cevap_tipi          TEXT CHECK (cevap_tipi IN ('devam_ediyor','ayrildi','diger')),
  -- Avukat
  avukat_adi          TEXT,
  avukat_telefon      TEXT,
  -- Diğer
  kep_no              TEXT,
  notlar              TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Aylık ödemeler
CREATE TABLE IF NOT EXISTS icra_v2_odemeler (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  icra_id      UUID NOT NULL REFERENCES icra_v2(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  odeme_tarihi DATE NOT NULL,
  tutar        NUMERIC(12,2) NOT NULL,
  aciklama     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Belgeler (tebligat, üst yazı, cevap yazısı, diğer)
CREATE TABLE IF NOT EXISTS icra_v2_belgeler (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  icra_id      UUID NOT NULL REFERENCES icra_v2(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  belge_turu   TEXT NOT NULL CHECK (belge_turu IN ('tebligat','ust_yazi','cevap_yazisi','diger')),
  dosya_adi    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  belge_tarihi DATE,
  aciklama     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE icra_v2          ENABLE ROW LEVEL SECURITY;
ALTER TABLE icra_v2_odemeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE icra_v2_belgeler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "icra_v2_all"          ON icra_v2;
DROP POLICY IF EXISTS "icra_v2_odemeler_all" ON icra_v2_odemeler;
DROP POLICY IF EXISTS "icra_v2_belgeler_all" ON icra_v2_belgeler;

CREATE POLICY "icra_v2_all" ON icra_v2
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "icra_v2_odemeler_all" ON icra_v2_odemeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "icra_v2_belgeler_all" ON icra_v2_belgeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

GRANT ALL ON icra_v2          TO authenticated;
GRANT ALL ON icra_v2_odemeler TO authenticated;
GRANT ALL ON icra_v2_belgeler TO authenticated;

-- ─── STORAGE ─────────────────────────────────────────────────
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

-- Personel çıkış tarihi kolonu (icra kaydında ayrıca tutulur)
ALTER TABLE icra_v2
  ADD COLUMN IF NOT EXISTS personel_cikis_tarihi DATE;
