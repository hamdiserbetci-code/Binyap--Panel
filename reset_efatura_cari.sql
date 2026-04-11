-- =============================================================================
-- E-FATURA VE TÜM CARİ HESAPLARI SIFIRLAMA BETİĞİ
-- =============================================================================

-- 1. E-Fatura modülünden kaydedilen faturaları sil (E-Defter süreçleri hariç)
DELETE FROM efatura_kayitlari WHERE tip != 'edefter';

-- 2. Tüm Cari Hesapları sil (ON DELETE CASCADE ile tüm cari hareketler de otomatik silinir)
DELETE FROM cari_hesaplar;