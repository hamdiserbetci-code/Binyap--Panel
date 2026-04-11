-- Cari hareketlere ödeme durumu ve tarihi ekleme
ALTER TABLE cari_hareketler ADD COLUMN IF NOT EXISTS odeme_durumu TEXT DEFAULT 'bekliyor';
ALTER TABLE cari_hareketler ADD COLUMN IF NOT EXISTS odeme_tarihi DATE;

-- Şema önbelleğini (schema cache) yenile
NOTIFY pgrst, 'reload schema';