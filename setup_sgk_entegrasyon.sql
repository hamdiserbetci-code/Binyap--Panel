-- Firmalar tablosuna SGK giriş bilgileri için kolonlar eklenmesi
-- Not: Gerçek bir senaryoda bu verileri Supabase Vault ile şifrelemek daha güvenlidir.
ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS sgk_kullanici_adi text;
ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS sgk_isyeri_sifresi text;
ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS sgk_sistem_sifresi text;