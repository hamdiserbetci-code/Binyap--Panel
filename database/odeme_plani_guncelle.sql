-- Ödeme planı tablosuna eksik kolonları ekle
-- Supabase SQL Editor'da çalıştırın

ALTER TABLE odeme_plani
  ADD COLUMN IF NOT EXISTS cek_no          TEXT,
  ADD COLUMN IF NOT EXISTS cek_banka       TEXT,
  ADD COLUMN IF NOT EXISTS cek_kesideci    TEXT,
  ADD COLUMN IF NOT EXISTS cek_tarihi      DATE,
  ADD COLUMN IF NOT EXISTS cari_unvan      TEXT,
  ADD COLUMN IF NOT EXISTS vergi_turu      TEXT,
  ADD COLUMN IF NOT EXISTS vergi_donemi    TEXT,
  ADD COLUMN IF NOT EXISTS sgk_donemi      TEXT,
  ADD COLUMN IF NOT EXISTS maas_donemi     TEXT,
  ADD COLUMN IF NOT EXISTS personel_sayisi INTEGER,
  ADD COLUMN IF NOT EXISTS banka_hesabi    TEXT;
