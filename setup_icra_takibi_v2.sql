-- =============================================================================
-- İCRA TAKİBİ v2 — Yeni alanlar (ALTER TABLE)
-- Supabase SQL Editor'de çalıştırın
-- =============================================================================

ALTER TABLE icra_takibi
  ADD COLUMN IF NOT EXISTS isci_durumu       text NOT NULL DEFAULT 'calisiyor'
    CHECK (isci_durumu IN ('calisiyor', 'ayrildi')),
  ADD COLUMN IF NOT EXISTS cikis_tarihi        date,
  ADD COLUMN IF NOT EXISTS kep_no            text,
  ADD COLUMN IF NOT EXISTS barkod_no         text,
  ADD COLUMN IF NOT EXISTS tebligat_dosya_url  text,
  ADD COLUMN IF NOT EXISTS tebligat_dosya_adi  text,
  ADD COLUMN IF NOT EXISTS cevap_dosya_url     text,
  ADD COLUMN IF NOT EXISTS cevap_dosya_adi     text;
