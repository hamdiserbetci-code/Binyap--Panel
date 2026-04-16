-- ─── PROJE GİDERLERİ ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proje_giderler (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id        UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_id        UUID NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,

  -- Fatura bilgileri
  fatura_no       TEXT,
  fatura_tarihi   DATE,

  -- Cari / tedarikçi
  cari_unvan      TEXT NOT NULL,
  cari_plaka      TEXT,
  cari_iban       TEXT,

  -- Gider kalemi
  gider_kalemi    TEXT NOT NULL,

  -- Tutarlar
  tutar           NUMERIC(14,2) NOT NULL DEFAULT 0,
  kdv_orani       NUMERIC(5,2)  NOT NULL DEFAULT 20,
  kdv_tutari      NUMERIC(14,2) NOT NULL DEFAULT 0,
  tevkifat_orani  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tevkifat_tutari NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_tutar       NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Vade / ödeme
  vade_tarihi     DATE,
  odeme_durumu    TEXT DEFAULT 'bekliyor' CHECK (odeme_durumu IN ('bekliyor','odendi','kismi','iptal')),
  odeme_tarihi    DATE,

  -- Fatura dosyası
  dosya_adi       TEXT,
  storage_path    TEXT,

  -- Ödeme planı bağlantısı (otomatik oluşturulan kayıt)
  odeme_plani_id  UUID REFERENCES odeme_plani(id) ON DELETE SET NULL,

  aciklama        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE proje_giderler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firma_erisim" ON proje_giderler
  USING (firma_id IN (SELECT id FROM firmalar WHERE id = firma_id));

-- Mevcut tabloya sütun eklemek için (tablo zaten varsa):
ALTER TABLE proje_giderler ADD COLUMN IF NOT EXISTS dosya_adi TEXT;
ALTER TABLE proje_giderler ADD COLUMN IF NOT EXISTS storage_path TEXT;
