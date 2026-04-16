-- ============================================================
-- ARABULUCU SÜREÇ YÖNETİMİ
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

CREATE TABLE IF NOT EXISTS arabulucu_dosyalar (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id            UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_id            UUID REFERENCES projeler(id) ON DELETE SET NULL,
  -- Personel Bilgileri
  tc_kimlik           TEXT NOT NULL,
  ad_soyad            TEXT NOT NULL,
  telefon             TEXT,
  adres               TEXT,
  giris_tarihi        DATE,
  cikis_tarihi        DATE,
  cikis_nedeni        TEXT DEFAULT 'isveren_fesih',
  -- Finansal
  odenecek_tutar      NUMERIC(12,2),
  odeme_tarihi        DATE,
  -- Firma Bilgileri
  calistigi_firma     TEXT,
  firma_vergi_no      TEXT,
  firma_adresi        TEXT,
  firma_vekili        TEXT,
  ana_firma_adi       TEXT,
  ana_firma_adresi    TEXT,
  ana_firma_vkn       TEXT,
  -- Avukat
  avukat_adi          TEXT,
  avukat_telefon      TEXT,
  avukat_email        TEXT,
  -- Süreç Durumu
  durum               TEXT DEFAULT 'sablon_hazirlandi' CHECK (durum IN (
                        'sablon_hazirlandi',
                        'avukata_gonderildi',
                        'santiyeye_gonderildi',
                        'personel_imzasi',
                        'avukat_imzasi',
                        'ana_firma_imzasi',
                        'bizim_firma_imzasi',
                        'tamamlandi'
                      )),
  -- Nüsha Takibi
  nüsha_avukat        BOOLEAN DEFAULT FALSE,
  nüsha_ana_firma     BOOLEAN DEFAULT FALSE,
  nüsha_bizde         BOOLEAN DEFAULT FALSE,
  -- Notlar
  notlar              TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Belgeler (PDF arşivi)
CREATE TABLE IF NOT EXISTS arabulucu_belgeler (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dosya_id     UUID NOT NULL REFERENCES arabulucu_dosyalar(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  belge_turu   TEXT NOT NULL CHECK (belge_turu IN (
                 'sablon_excel','imzali_belge','avukat_belgesi',
                 'ana_firma_belgesi','diger'
               )),
  adim_kodu    TEXT,
  dosya_adi    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  aciklama     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE arabulucu_dosyalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE arabulucu_belgeler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arabulucu_dosyalar_all" ON arabulucu_dosyalar;
DROP POLICY IF EXISTS "arabulucu_belgeler_all" ON arabulucu_belgeler;

CREATE POLICY "arabulucu_dosyalar_all" ON arabulucu_dosyalar
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "arabulucu_belgeler_all" ON arabulucu_belgeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

GRANT ALL ON arabulucu_dosyalar TO authenticated;
GRANT ALL ON arabulucu_belgeler TO authenticated;

-- Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('arabulucu-belgeler', 'arabulucu-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "arabulucu_upload" ON storage.objects;
DROP POLICY IF EXISTS "arabulucu_read"   ON storage.objects;
DROP POLICY IF EXISTS "arabulucu_delete" ON storage.objects;

CREATE POLICY "arabulucu_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'arabulucu-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "arabulucu_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'arabulucu-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "arabulucu_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'arabulucu-belgeler' AND auth.role() = 'authenticated');
