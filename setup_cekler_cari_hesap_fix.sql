-- Fix: cekler tablosuna cari_hesap alani ekler
-- Supabase SQL Editor'de calistirin.

ALTER TABLE cekler
ADD COLUMN IF NOT EXISTS cari_hesap TEXT;
