-- Mevcut tabloya kalan_tutar ekle
ALTER TABLE teminatlar ADD COLUMN IF NOT EXISTS kalan_tutar NUMERIC(15,2) DEFAULT 0;

-- Kalan tutarı başlangıçta tutar ile eşitle
UPDATE teminatlar SET kalan_tutar = tutar WHERE kalan_tutar = 0 OR kalan_tutar IS NULL;

-- Teminat hareketleri tablosu
CREATE TABLE IF NOT EXISTS teminat_hareketler (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id      UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  teminat_id    UUID NOT NULL REFERENCES teminatlar(id) ON DELETE CASCADE,
  proje_id      UUID REFERENCES projeler(id) ON DELETE SET NULL,
  hareket_turu  TEXT NOT NULL DEFAULT 'kesinti',
  tutar         NUMERIC(15,2) NOT NULL DEFAULT 0,
  tarih         DATE NOT NULL DEFAULT CURRENT_DATE,
  aciklama      TEXT,
  belge_no      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON teminat_hareketler TO anon, authenticated;
ALTER TABLE teminat_hareketler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON teminat_hareketler FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
