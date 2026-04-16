-- ============================================================
-- POLİÇE TAKİP SİSTEMİ
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

CREATE TABLE IF NOT EXISTS policeler (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id          UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  police_no         TEXT NOT NULL,
  sigorta_turu      TEXT NOT NULL CHECK (sigorta_turu IN (
                      'arac_kasko','arac_trafik','ferdi_kaza',
                      'isyeri','sorumluluk','diger'
                    )),
  sigorta_sirketi   TEXT NOT NULL,
  acente_adi        TEXT,
  acente_telefon    TEXT,
  -- Sigortalı varlık
  sigortali_varlik  TEXT,   -- araç plakası, kişi adı vb.
  plaka             TEXT,
  -- Finansal
  prim_tutari       NUMERIC(12,2),
  odeme_sekli       TEXT DEFAULT 'yillik' CHECK (odeme_sekli IN ('yillik','aylik','taksitli')),
  -- Tarihler
  baslangic_tarihi  DATE NOT NULL,
  bitis_tarihi      DATE NOT NULL,
  yenileme_tarihi   DATE,
  -- Durum
  durum             TEXT DEFAULT 'aktif' CHECK (durum IN ('aktif','suresi_doldu','iptal','yenilendi')),
  -- Teminatlar (JSON)
  teminatlar        JSONB,
  notlar            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Poliçe belgeleri
CREATE TABLE IF NOT EXISTS police_belgeler (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  police_id    UUID NOT NULL REFERENCES policeler(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  belge_turu   TEXT NOT NULL CHECK (belge_turu IN ('police','zeyilname','hasar','diger')),
  dosya_adi    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  belge_tarihi DATE,
  aciklama     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE policeler       ENABLE ROW LEVEL SECURITY;
ALTER TABLE police_belgeler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policeler_all"       ON policeler;
DROP POLICY IF EXISTS "police_belgeler_all" ON police_belgeler;

CREATE POLICY "policeler_all" ON policeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

CREATE POLICY "police_belgeler_all" ON police_belgeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));

GRANT ALL ON policeler       TO authenticated;
GRANT ALL ON police_belgeler TO authenticated;

-- Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('police-belgeler', 'police-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "police_upload" ON storage.objects;
DROP POLICY IF EXISTS "police_read"   ON storage.objects;
DROP POLICY IF EXISTS "police_delete" ON storage.objects;

CREATE POLICY "police_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'police-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "police_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'police-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "police_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'police-belgeler' AND auth.role() = 'authenticated');
