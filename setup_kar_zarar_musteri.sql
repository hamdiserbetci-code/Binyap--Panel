-- kar_zarar_donem tablosunu oluşturur (yoksa) ve musteri_id kolonu ekler

CREATE TABLE IF NOT EXISTS kar_zarar_donem (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  firma_id         UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  musteri_id       UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  donem            TEXT NOT NULL,           -- YYYY-MM formatı
  satis_yurt_ici   NUMERIC DEFAULT 0,
  satis_yurt_disi  NUMERIC DEFAULT 0,
  satis_iade       NUMERIC DEFAULT 0,
  donem_basi_stok  NUMERIC DEFAULT 0,
  donem_sonu_stok  NUMERIC DEFAULT 0,
  alis_malzeme     NUMERIC DEFAULT 0,
  alis_efatura     NUMERIC DEFAULT 0,
  alis_arsiv       NUMERIC DEFAULT 0,
  alis_utts        NUMERIC DEFAULT 0,
  alis_iscilik     NUMERIC DEFAULT 0,
  gider_personel   NUMERIC DEFAULT 0,
  gider_kira       NUMERIC DEFAULT 0,
  gider_fatura     NUMERIC DEFAULT 0,
  gider_amortisman NUMERIC DEFAULT 0,
  gider_diger      NUMERIC DEFAULT 0,
  vergi_orani      NUMERIC DEFAULT 22,
  notlar           TEXT
);

-- Müşteri bazlı sorgular için index
CREATE INDEX IF NOT EXISTS idx_kar_zarar_firma_donem
  ON kar_zarar_donem(firma_id, donem);

CREATE INDEX IF NOT EXISTS idx_kar_zarar_musteri
  ON kar_zarar_donem(firma_id, musteri_id, donem);

-- RLS
ALTER TABLE kar_zarar_donem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "firma_erisim" ON kar_zarar_donem; -- Eski politikayı kaldır
-- Hatalı "firma_erisim" politikası kaldırıldı.
-- Doğru politikalar "kullanici_profilleri" tablosunu kullanır.


DROP POLICY IF EXISTS "kullanici_kendi_firmasi_kz_donem_secer" ON kar_zarar_donem;
CREATE POLICY "kullanici_kendi_firmasi_kz_donem_secer" ON kar_zarar_donem FOR SELECT
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id::uuid = auth.uid()));

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_kz_donem_ekler" ON kar_zarar_donem;
CREATE POLICY "kullanici_kendi_firmasi_kz_donem_ekler" ON kar_zarar_donem FOR INSERT
  WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id::uuid = auth.uid()));

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_kz_donem_gunceller" ON kar_zarar_donem;
CREATE POLICY "kullanici_kendi_firmasi_kz_donem_gunceller" ON kar_zarar_donem FOR UPDATE
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id::uuid = auth.uid()));

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_kz_donem_siler" ON kar_zarar_donem;
CREATE POLICY "kullanici_kendi_firmasi_kz_donem_siler" ON kar_zarar_donem FOR DELETE
  USING (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id::uuid = auth.uid()));

-- Yetkiler
GRANT ALL ON TABLE kar_zarar_donem TO authenticated;
GRANT ALL ON TABLE kar_zarar_donem TO service_role;
