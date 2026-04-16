-- ─── CARİ HESAPLAR V2 ────────────────────────────────────────
-- Mevcut tablolara eksik kolonları ekle

ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS tip TEXT DEFAULT 'tedarikci';
ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS vkn_tckn TEXT;
ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS telefon TEXT;
ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS adres TEXT;
ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS notlar TEXT;
ALTER TABLE cari_hesaplar ADD COLUMN IF NOT EXISTS bakiye NUMERIC(15,2) DEFAULT 0;

ALTER TABLE cari_hareketler ADD COLUMN IF NOT EXISTS odeme_durumu TEXT DEFAULT 'bekliyor';
ALTER TABLE cari_hareketler ADD COLUMN IF NOT EXISTS odeme_tarihi DATE;
ALTER TABLE cari_hareketler ADD COLUMN IF NOT EXISTS kaynak TEXT; -- 'proje_gider','odeme_plani','manuel'
ALTER TABLE cari_hareketler ADD COLUMN IF NOT EXISTS kaynak_id UUID;

-- Cari belgeleri tablosu
CREATE TABLE IF NOT EXISTS cari_belgeler (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id      UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  cari_hesap_id UUID NOT NULL REFERENCES cari_hesaplar(id) ON DELETE CASCADE,
  hareket_id    UUID REFERENCES cari_hareketler(id) ON DELETE SET NULL,
  belge_turu    TEXT NOT NULL DEFAULT 'diger',
  dosya_adi     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  aciklama      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON cari_belgeler TO anon, authenticated;
ALTER TABLE cari_belgeler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON cari_belgeler FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_open" ON cari_belgeler FOR ALL TO anon USING (true) WITH CHECK (true);

-- Mevcut tablolara anon erişimi
GRANT ALL ON cari_hesaplar TO anon, authenticated;
GRANT ALL ON cari_hareketler TO anon, authenticated;
