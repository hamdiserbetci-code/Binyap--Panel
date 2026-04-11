-- =============================================================================
-- E-FATURA KAYITLARI TABLOSU VE İZİNLERİ
-- Supabase SQL Editor'de çalıştırın
-- =============================================================================

CREATE TABLE IF NOT EXISTS efatura_kayitlari (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  sirket_id UUID REFERENCES sirketler(id) ON DELETE SET NULL,
  tip TEXT NOT NULL,
  donem TEXT NOT NULL,
  belge_no TEXT,
  taraf_adi TEXT,
  taraf_vkn TEXT,
  tutar NUMERIC(15,2) DEFAULT 0,
  kdv_tutari NUMERIC(15,2) DEFAULT 0,
  toplam_tutar NUMERIC(15,2) DEFAULT 0,
  durum TEXT DEFAULT 'bekliyor',
  yukleme_tarihi DATE,
  onay_tarihi DATE,
  gib_referans_no TEXT,
  edefter_tip TEXT,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API üzerinden temel erişim yetkisini ver
GRANT ALL ON TABLE efatura_kayitlari TO authenticated, service_role;

-- RLS (Row Level Security) aktif et ve tam yetki politikasını ekle
ALTER TABLE efatura_kayitlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open" ON efatura_kayitlari;
CREATE POLICY "open" ON efatura_kayitlari FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Şema önbelleğini (schema cache) yenile
NOTIFY pgrst, 'reload schema';