-- =============================================================================
-- İŞNET ENTEGRASYONU İÇİN FİRMA TABLOSUNA ALANLARIN EKLENMESİ
-- =============================================================================

ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS isnet_kullanici_adi text;
ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS isnet_sifre text;
ALTER TABLE firmalar ADD COLUMN IF NOT EXISTS isnet_fatura_alias text; -- e-Fatura Gönderici/Posta Kutusu Etiketi