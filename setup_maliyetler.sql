CREATE TABLE IF NOT EXISTS maliyet_surecler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem TEXT NOT NULL, 
  sorumlu_id UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
  teslim_gunu SMALLINT CHECK (teslim_gunu BETWEEN 1 AND 31),
  
  efatura_kontrol BOOLEAN DEFAULT false,
  efatura_luca BOOLEAN DEFAULT false,
  
  earsiv_kontrol BOOLEAN DEFAULT false,
  earsiv_luca BOOLEAN DEFAULT false,
  
  utts_kontrol BOOLEAN DEFAULT false,
  utts_luca BOOLEAN DEFAULT false,
  
  bordro_kontrol BOOLEAN DEFAULT false,
  bordro_luca BOOLEAN DEFAULT false,

  satis_kontrol BOOLEAN DEFAULT false,
  satis_luca BOOLEAN DEFAULT false,

  durum TEXT DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor', 'tamamlandi')),
  notlar TEXT,
  hatirlatici_tarihi DATE,
  hatirlatici_saati TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE maliyet_surecler
  ADD COLUMN IF NOT EXISTS sorumlu_id UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL;

ALTER TABLE maliyet_surecler
  ADD COLUMN IF NOT EXISTS teslim_gunu SMALLINT;

ALTER TABLE maliyet_surecler
  DROP CONSTRAINT IF EXISTS maliyet_surecler_teslim_gunu_check;

ALTER TABLE maliyet_surecler
  ADD CONSTRAINT maliyet_surecler_teslim_gunu_check CHECK (teslim_gunu IS NULL OR teslim_gunu BETWEEN 1 AND 31);

-- İndeks ve Güvenlik (RLS)
CREATE UNIQUE INDEX IF NOT EXISTS idx_maliyet_firma_donem ON maliyet_surecler(firma_id, donem);

ALTER TABLE maliyet_surecler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_maliyet_secer" ON maliyet_surecler;
CREATE POLICY "kullanici_kendi_firmasi_maliyet_secer" ON maliyet_surecler FOR SELECT
USING (auth.role() = 'authenticated' AND firma_id = current_firma_id());

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_maliyet_ekler" ON maliyet_surecler;
CREATE POLICY "kullanici_kendi_firmasi_maliyet_ekler" ON maliyet_surecler FOR INSERT
WITH CHECK (auth.role() = 'authenticated' AND firma_id = current_firma_id());

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_maliyet_gunceller" ON maliyet_surecler;
CREATE POLICY "kullanici_kendi_firmasi_maliyet_gunceller" ON maliyet_surecler FOR UPDATE
USING (auth.role() = 'authenticated' AND firma_id = current_firma_id());

DROP POLICY IF EXISTS "kullanici_kendi_firmasi_maliyet_siler" ON maliyet_surecler;
CREATE POLICY "kullanici_kendi_firmasi_maliyet_siler" ON maliyet_surecler FOR DELETE
USING (auth.role() = 'authenticated' AND firma_id = current_firma_id());

-- Yetkiler
GRANT ALL ON TABLE maliyet_surecler TO authenticated;
GRANT ALL ON TABLE maliyet_surecler TO service_role;
