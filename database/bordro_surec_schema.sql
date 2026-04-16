-- ============================================================
-- BORDRO SÜREÇ YÖNETİMİ — EK TABLOLAR
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- ─── EKİPLER ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ekipler (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id    UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_id    UUID NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
  ekip_adi    TEXT NOT NULL,
  sef_adi     TEXT,
  aciklama    TEXT,
  aktif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EKİP PERSONEL ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ekip_personel (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ekip_id     UUID NOT NULL REFERENCES ekipler(id) ON DELETE CASCADE,
  personel_id UUID NOT NULL REFERENCES personeller(id) ON DELETE CASCADE,
  baslangic   DATE,
  bitis       DATE,
  aktif       BOOLEAN DEFAULT TRUE,
  UNIQUE(ekip_id, personel_id)
);

-- ─── BORDRO DÖNEMLERİ — EK KOLONLAR ─────────────────────────
ALTER TABLE bordro_donemleri
  ADD COLUMN IF NOT EXISTS proje_id   UUID REFERENCES projeler(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ekip_id    UUID REFERENCES ekipler(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ay         INTEGER,
  ADD COLUMN IF NOT EXISTS yil        INTEGER,
  ADD COLUMN IF NOT EXISTS onceki_ay  BOOLEAN DEFAULT TRUE;

-- ─── BORDRO SÜREÇ ADIMLARI ───────────────────────────────────
CREATE TABLE IF NOT EXISTS bordro_surec_adimlari (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  donem_id          UUID NOT NULL REFERENCES bordro_donemleri(id) ON DELETE CASCADE,
  firma_id          UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  adim_kodu         TEXT NOT NULL,
  adim_adi          TEXT NOT NULL,
  sira              INTEGER NOT NULL,
  durum             TEXT DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','devam','tamamlandi','uyari')),
  tamamlanma_tarihi TIMESTAMPTZ,
  notlar            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BORDRO BELGELER ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bordro_belgeler (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  donem_id     UUID NOT NULL REFERENCES bordro_donemleri(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  adim_kodu    TEXT NOT NULL,
  belge_tipi   TEXT NOT NULL,
  dosya_adi    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  yukleyen     TEXT,
  aciklama     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE ekipler               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekip_personel         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bordro_surec_adimlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE bordro_belgeler       ENABLE ROW LEVEL SECURITY;

-- Önce varsa eski policy'leri düşür, sonra yeniden oluştur
DROP POLICY IF EXISTS "ekipler_policy"        ON ekipler;
DROP POLICY IF EXISTS "ekip_personel_policy"  ON ekip_personel;
DROP POLICY IF EXISTS "bordro_surec_policy"   ON bordro_surec_adimlari;
DROP POLICY IF EXISTS "bordro_belgeler_policy" ON bordro_belgeler;

CREATE POLICY "ekipler_policy" ON ekipler
  FOR ALL USING (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "ekip_personel_policy" ON ekip_personel
  FOR ALL USING (
    ekip_id IN (
      SELECT e.id FROM ekipler e
      JOIN kullanici_profilleri k ON k.firma_id = e.firma_id
      WHERE k.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "bordro_surec_policy" ON bordro_surec_adimlari
  FOR ALL USING (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "bordro_belgeler_policy" ON bordro_belgeler
  FOR ALL USING (
    firma_id IN (
      SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()
    )
  );

-- ─── GRANT ───────────────────────────────────────────────────
GRANT ALL ON ekipler               TO authenticated;
GRANT ALL ON ekip_personel         TO authenticated;
GRANT ALL ON bordro_surec_adimlari TO authenticated;
GRANT ALL ON bordro_belgeler       TO authenticated;

-- ─── STORAGE BUCKET ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('bordro-belgeler', 'bordro-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "bordro_belgeler_upload" ON storage.objects;
DROP POLICY IF EXISTS "bordro_belgeler_read"   ON storage.objects;
DROP POLICY IF EXISTS "bordro_belgeler_delete" ON storage.objects;

CREATE POLICY "bordro_belgeler_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bordro-belgeler' AND auth.role() = 'authenticated'
  );

CREATE POLICY "bordro_belgeler_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bordro-belgeler' AND auth.role() = 'authenticated'
  );

CREATE POLICY "bordro_belgeler_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'bordro-belgeler' AND auth.role() = 'authenticated'
  );
