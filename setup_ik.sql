-- ============================================================
-- IK MODÜLÜ — Migration
-- ============================================================

-- 1. Projeler tablosuna SGK sicil no alanı ekle
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS sgk_sicil_no text;

-- 2. Personel tablosu
CREATE TABLE IF NOT EXISTS ik_personel (
  id                   uuid primary key default gen_random_uuid(),
  firma_id             uuid not null references firmalar(id) on delete cascade,
  proje_id             uuid references projeler(id) on delete set null,
  ad_soyad             text not null,
  tc_no                text,
  dogum_tarihi         date,
  ise_giris_tarihi     date not null,
  isten_cikis_tarihi   date,
  gorev                text,
  maas                 numeric(12,2),
  durum                text not null default 'aktif',  -- 'aktif' | 'ayrildi'
  notlar               text,
  created_at           timestamptz default now()
);

-- 3. IK belgeler tablosu
CREATE TABLE IF NOT EXISTS ik_belge (
  id           uuid primary key default gen_random_uuid(),
  firma_id     uuid not null references firmalar(id) on delete cascade,
  personel_id  uuid references ik_personel(id) on delete cascade,
  proje_id     uuid references projeler(id) on delete set null,
  belge_tipi   text not null default 'diger',
    -- 'giris_bildirgesi' | 'cikis_bildirgesi' | 'kimlik' | 'diploma' | 'saglik' | 'sozlesme' | 'diger'
  dosya_adi    text not null,
  dosya_url    text not null,
  mime_type    text,
  dosya_boyutu bigint,
  aciklama     text,
  created_at   timestamptz default now()
);

-- 4. RLS
ALTER TABLE ik_personel ENABLE ROW LEVEL SECURITY;
ALTER TABLE ik_belge    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ik_personel' AND policyname='firma_ik_personel') THEN
    CREATE POLICY firma_ik_personel ON ik_personel
      FOR ALL
      USING      (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
      WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ik_belge' AND policyname='firma_ik_belge') THEN
    CREATE POLICY firma_ik_belge ON ik_belge
      FOR ALL
      USING      (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()))
      WITH CHECK (firma_id IN (SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid()));
  END IF;
END $$;

-- 5. Storage bucket (arsiv bucket'ı zaten varsa ik/ klasörü otomatik oluşur)
-- Supabase'de "arsiv" bucket'ının altında ik/ klasörü kullanılacak.
