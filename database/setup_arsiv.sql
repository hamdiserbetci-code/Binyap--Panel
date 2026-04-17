-- ─── ARŞİV MODÜLÜ ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arsiv_kategoriler (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id   UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad         TEXT NOT NULL,
  renk       TEXT DEFAULT '#6366f1',
  ust_id     UUID REFERENCES arsiv_kategoriler(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arsiv_belgeler (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id      UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  kategori_id   UUID REFERENCES arsiv_kategoriler(id) ON DELETE SET NULL,
  baslik        TEXT NOT NULL,
  aciklama      TEXT,
  etiketler     TEXT[],
  dosya_adi     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  dosya_tipi    TEXT NOT NULL,
  dosya_boyutu  BIGINT,
  belge_tarihi  DATE,
  gonderen      TEXT,
  alici         TEXT,
  onemli        BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON arsiv_kategoriler TO anon, authenticated;
GRANT ALL ON arsiv_belgeler    TO anon, authenticated;

ALTER TABLE arsiv_kategoriler ENABLE ROW LEVEL SECURITY;
ALTER TABLE arsiv_belgeler    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open" ON arsiv_kategoriler FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open" ON arsiv_belgeler    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
