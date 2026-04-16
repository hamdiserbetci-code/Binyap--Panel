-- ============================================================
-- İŞ TAKİBİ — VERGİ & BEYANNAME SÜREÇ YÖNETİMİ
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

-- Ana iş takibi tablosu
CREATE TABLE IF NOT EXISTS is_takibi_v2 (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id        UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  is_tipi         TEXT NOT NULL CHECK (is_tipi IN (
                    'kdv1','kdv2','muhtasar_sgk','gecici_vergi','edefter','kurumlar_vergisi'
                  )),
  donem           TEXT NOT NULL,  -- örn: 2025-01, 2025-Q1
  yil             INTEGER NOT NULL,
  ay              INTEGER,        -- kdv/muhtasar için 1-12
  ceyrek          INTEGER,        -- geçici vergi için 1-4
  son_beyan_tarihi  DATE,
  son_odeme_tarihi  DATE,
  durum           TEXT DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','devam','tamamlandi','uyari')),
  notlar          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Süreç adımları (beyanname → tahakkuk → ödeme → dekont)
CREATE TABLE IF NOT EXISTS is_takibi_adimlar (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_id           UUID NOT NULL REFERENCES is_takibi_v2(id) ON DELETE CASCADE,
  firma_id        UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  adim_kodu       TEXT NOT NULL CHECK (adim_kodu IN (
                    'beyanname','tahakkuk','odeme','dekont','edefter_gonderim'
                  )),
  adim_adi        TEXT NOT NULL,
  sira            INTEGER NOT NULL,
  durum           TEXT DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','devam','tamamlandi','uyari')),
  tamamlanma_tarihi TIMESTAMPTZ,
  tutar           NUMERIC(12,2),
  notlar          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Belgeler (PDF yükleme)
CREATE TABLE IF NOT EXISTS is_takibi_belgeler (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_id           UUID NOT NULL REFERENCES is_takibi_v2(id) ON DELETE CASCADE,
  adim_id         UUID REFERENCES is_takibi_adimlar(id) ON DELETE CASCADE,
  firma_id        UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  adim_kodu       TEXT NOT NULL,
  belge_tipi      TEXT NOT NULL,
  dosya_adi       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE is_takibi_v2       ENABLE ROW LEVEL SECURITY;
ALTER TABLE is_takibi_adimlar  ENABLE ROW LEVEL SECURITY;
ALTER TABLE is_takibi_belgeler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "is_takibi_v2_all"       ON is_takibi_v2;
DROP POLICY IF EXISTS "is_takibi_adimlar_all"  ON is_takibi_adimlar;
DROP POLICY IF EXISTS "is_takibi_belgeler_all" ON is_takibi_belgeler;

CREATE POLICY "is_takibi_v2_all" ON is_takibi_v2
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "is_takibi_adimlar_all" ON is_takibi_adimlar
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "is_takibi_belgeler_all" ON is_takibi_belgeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

GRANT ALL ON is_takibi_v2       TO authenticated;
GRANT ALL ON is_takibi_adimlar  TO authenticated;
GRANT ALL ON is_takibi_belgeler TO authenticated;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('is-takibi-belgeler', 'is-takibi-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "is_takibi_upload" ON storage.objects;
DROP POLICY IF EXISTS "is_takibi_read"   ON storage.objects;
DROP POLICY IF EXISTS "is_takibi_delete" ON storage.objects;

CREATE POLICY "is_takibi_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'is-takibi-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "is_takibi_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'is-takibi-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "is_takibi_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'is-takibi-belgeler' AND auth.role() = 'authenticated');

-- ─── KDV1 ÖN KONTROL CHECKLİST ───────────────────────────────
CREATE TABLE IF NOT EXISTS is_takibi_checklist (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_id       UUID NOT NULL REFERENCES is_takibi_v2(id) ON DELETE CASCADE,
  firma_id    UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  kontrol_kodu TEXT NOT NULL,
  tamamlandi  BOOLEAN DEFAULT FALSE,
  tamamlanma_tarihi TIMESTAMPTZ,
  notlar      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE is_takibi_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "is_takibi_checklist_all" ON is_takibi_checklist;
CREATE POLICY "is_takibi_checklist_all" ON is_takibi_checklist
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
GRANT ALL ON is_takibi_checklist TO authenticated;
