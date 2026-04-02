-- Kar/Zarar dayanak belgeler tablosu
-- Supabase SQL Editör'de çalıştırın

-- ÖNEMLİ: Bu komut mevcut belgeleri SİLECEKTİR.
-- Şema değişikliği (dosya_icerik -> dosya_url) için bu gereklidir.
-- Belgelerinizi yeniden yüklemeniz gerekecektir.
DROP TABLE IF EXISTS kar_zarar_belgeler CASCADE;

CREATE TABLE IF NOT EXISTS kar_zarar_belgeler (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id     UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem        text NOT NULL,
  musteri_id   UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  kategori     text NOT NULL CHECK (kategori IN ('satis_fatura','efatura_alislar','earsiv_alislar','utts','iscilik')),
  dosya_adi    text NOT NULL,
  dosya_url    text NOT NULL,  -- Supabase Storage URL
  dosya_turu   text NOT NULL,
  dosya_boyut  bigint NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_kar_zarar_belgeler_firma_donem ON kar_zarar_belgeler(firma_id, donem);
CREATE INDEX IF NOT EXISTS idx_kar_zarar_belgeler_musteri ON kar_zarar_belgeler(firma_id, musteri_id, donem);


-- RLS politikaları
ALTER TABLE kar_zarar_belgeler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_belgeleri_secer" ON kar_zarar_belgeler;
CREATE POLICY "kullanici_kendi_firmasi_belgeleri_secer" ON kar_zarar_belgeler FOR SELECT
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id::uuid = auth.uid()));

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_belgeleri_ekler" ON kar_zarar_belgeler;
CREATE POLICY "kullanici_kendi_firmasi_belgeleri_ekler" ON kar_zarar_belgeler FOR INSERT
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id::uuid = auth.uid()));

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_belgeleri_gunceller" ON kar_zarar_belgeler;
CREATE POLICY "kullanici_kendi_firmasi_belgeleri_gunceller" ON kar_zarar_belgeler FOR UPDATE
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id::uuid = auth.uid()));

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_belgeleri_siler" ON kar_zarar_belgeler;
CREATE POLICY "kullanici_kendi_firmasi_belgeleri_siler" ON kar_zarar_belgeler FOR DELETE
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id::uuid = auth.uid()));

-- Yetkiler
GRANT ALL ON TABLE kar_zarar_belgeler TO authenticated;
GRANT ALL ON TABLE kar_zarar_belgeler TO service_role;
