-- İK Belgeleri için Storage Bucket Oluşturma
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ik_belgeler', 'ik_belgeler', true) 
ON CONFLICT (id) DO NOTHING;

-- Public erişim politikası (Tüm yetkili kullanıcılar dosya okuyup yazabilsin)
CREATE POLICY "ik_belgeler_public_access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'ik_belgeler');

-- Süreç tablomuza yeni aşamaları ve dosya (JSONB) / tutar kolonlarını ekleme
ALTER TABLE bordro_surecler ADD COLUMN IF NOT EXISTS maas_listesi_durum TEXT DEFAULT 'bekliyor';
ALTER TABLE bordro_surecler ADD COLUMN IF NOT EXISTS arsiv_durum TEXT DEFAULT 'bekliyor';
ALTER TABLE bordro_surecler ADD COLUMN IF NOT EXISTS toplam_maliyet NUMERIC(15,2) DEFAULT 0;
ALTER TABLE bordro_surecler ADD COLUMN IF NOT EXISTS toplam_net NUMERIC(15,2) DEFAULT 0;
ALTER TABLE bordro_surecler ADD COLUMN IF NOT EXISTS belgeler JSONB DEFAULT '{}'::jsonb;

-- Cache Yenileme
NOTIFY pgrst, 'reload schema';