-- ============================================================
-- PROJE BELGELERİ (Sözleşme & Hakediş)
-- Supabase SQL Editor'da çalıştırın
-- ============================================================

CREATE TABLE IF NOT EXISTS proje_belgeler (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proje_id     UUID NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  belge_turu   TEXT NOT NULL CHECK (belge_turu IN ('sozlesme','hakedis','diger')),
  dosya_adi    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  belge_tarihi DATE,
  tutar        NUMERIC(14,2),
  aciklama     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE proje_belgeler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proje_belgeler_all" ON proje_belgeler;
CREATE POLICY "proje_belgeler_all" ON proje_belgeler
  FOR ALL TO authenticated
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
GRANT ALL ON proje_belgeler TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('proje-belgeler', 'proje-belgeler', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "proje_belgeler_upload" ON storage.objects;
DROP POLICY IF EXISTS "proje_belgeler_read"   ON storage.objects;
DROP POLICY IF EXISTS "proje_belgeler_delete" ON storage.objects;

CREATE POLICY "proje_belgeler_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'proje-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "proje_belgeler_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'proje-belgeler' AND auth.role() = 'authenticated');
CREATE POLICY "proje_belgeler_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'proje-belgeler' AND auth.role() = 'authenticated');

-- ─── Hakediş ve Fatura için ek kolonlar ──────────────────────
ALTER TABLE proje_belgeler
  ADD COLUMN IF NOT EXISTS hakedis_no     TEXT,
  ADD COLUMN IF NOT EXISTS fatura_no      TEXT,
  ADD COLUMN IF NOT EXISTS fatura_tarihi  DATE,
  ADD COLUMN IF NOT EXISTS kdv_tutari     NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS toplam_tutar   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS odeme_durumu   TEXT DEFAULT 'bekliyor'
    CHECK (odeme_durumu IN ('bekliyor','kismi','odendi')),
  ADD COLUMN IF NOT EXISTS odeme_tarihi   DATE,
  ADD COLUMN IF NOT EXISTS grup_id        UUID; -- aynı hakediş grubunu bağlar

-- ─── Hakediş Kesinti ve Stopaj Kolonları ─────────────────────
ALTER TABLE proje_belgeler
  -- Ana firma kesintileri
  ADD COLUMN IF NOT EXISTS kesinti_faturali      NUMERIC(14,2) DEFAULT 0,  -- Faturalı kesinti
  ADD COLUMN IF NOT EXISTS kesinti_faturasiz     NUMERIC(14,2) DEFAULT 0,  -- Faturasız kesinti
  ADD COLUMN IF NOT EXISTS kesinti_teminat       NUMERIC(14,2) DEFAULT 0,  -- Teminat kesintisi
  ADD COLUMN IF NOT EXISTS stopaj_orani          NUMERIC(5,2)  DEFAULT 0,  -- %5 stopaj (yıllara yaygın)
  ADD COLUMN IF NOT EXISTS stopaj_tutari         NUMERIC(14,2) DEFAULT 0,  -- Hesaplanan stopaj
  ADD COLUMN IF NOT EXISTS yillara_yaygin        BOOLEAN DEFAULT FALSE,    -- Yıllara yaygın iş mi?
  -- Bizim fatura
  ADD COLUMN IF NOT EXISTS bizim_fatura_no       TEXT,
  ADD COLUMN IF NOT EXISTS bizim_fatura_tarihi   DATE,
  ADD COLUMN IF NOT EXISTS bizim_fatura_tutar    NUMERIC(14,2) DEFAULT 0,  -- KDV hariç
  ADD COLUMN IF NOT EXISTS bizim_kdv_orani       NUMERIC(5,2)  DEFAULT 20, -- %20 KDV
  ADD COLUMN IF NOT EXISTS bizim_kdv_tutari      NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bizim_fatura_toplam   NUMERIC(14,2) DEFAULT 0,  -- KDV dahil
  -- Net ödenecek (tüm kesintiler düşüldükten sonra)
  ADD COLUMN IF NOT EXISTS net_odenecek          NUMERIC(14,2) DEFAULT 0;
