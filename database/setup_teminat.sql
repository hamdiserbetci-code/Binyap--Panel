-- ─── TEMİNAT TAKİBİ ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teminatlar (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firma_id        UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,

  -- Teminat bilgileri
  teminat_turu    TEXT NOT NULL DEFAULT 'nakit',
  -- nakit, banka_teminat_mektubu, cek, senet, gayrimenkul, diger
  baslik          TEXT NOT NULL,
  aciklama        TEXT,

  -- Taraflar
  veren_firma     TEXT NOT NULL,
  alan_firma      TEXT,
  proje_id        UUID REFERENCES projeler(id) ON DELETE SET NULL,

  -- Tutar & Para birimi
  tutar           NUMERIC(15,2) NOT NULL DEFAULT 0,
  para_birimi     TEXT DEFAULT 'TRY',

  -- Tarihler
  verilis_tarihi  DATE NOT NULL,
  gecerlilik_tarihi DATE,
  iade_tarihi     DATE,

  -- Banka / Belge bilgileri
  banka_adi       TEXT,
  belge_no        TEXT,
  sube            TEXT,

  -- Durum
  durum           TEXT DEFAULT 'aktif' CHECK (durum IN ('aktif','iade_edildi','nakde_cevirildi','suresi_doldu','iptal')),

  -- Dosya
  dosya_adi       TEXT,
  storage_path    TEXT,

  notlar          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON teminatlar TO anon, authenticated;
ALTER TABLE teminatlar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON teminatlar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
