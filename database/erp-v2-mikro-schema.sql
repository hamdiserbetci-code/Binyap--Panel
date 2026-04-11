-- ETM Panel ERP v2 (Mikro ERP moduler mimari) - Supabase/PostgreSQL
-- Not: Bu dosya mevcut tablolari SILMEZ. v2 tablolarini paralel kurar.

create extension if not exists "pgcrypto";

-- =========================================================
-- A) CARI
-- =========================================================
create table if not exists cariler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  kod text not null,
  tip text not null check (tip in ('musteri','tedarikci','personel','diger')),
  unvan text not null,
  vkn_tckn text,
  vergi_dairesi text,
  telefon text,
  email text,
  il text,
  ilce text,
  adres text,
  risk_limiti numeric(14,2) not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firma_id, kod)
);

create table if not exists cari_hareketler_v2 (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  cari_id uuid not null references cariler(id) on delete cascade,
  tarih date not null,
  belge_turu text not null default 'diger',
  belge_no text,
  aciklama text,
  borc numeric(14,2) not null default 0,
  alacak numeric(14,2) not null default 0,
  kaynak_tablo text,
  kaynak_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists cari_bakiyeler (
  cari_id uuid primary key references cariler(id) on delete cascade,
  toplam_borc numeric(14,2) not null default 0,
  toplam_alacak numeric(14,2) not null default 0,
  net_bakiye numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists cari_tahsilat_odeme (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  cari_id uuid not null references cariler(id) on delete cascade,
  tarih date not null,
  tur text not null check (tur in ('tahsilat','odeme')),
  tutar numeric(14,2) not null,
  kanal text not null check (kanal in ('nakit','banka','kredi_karti','diger')),
  belge_no text,
  aciklama text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- B) FINANS - BANKA - KASA
-- =========================================================
create table if not exists banka_hesaplari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  kod text not null,
  ad text not null,
  banka_adi text not null,
  sube_adi text,
  iban text,
  hesap_no text,
  para_birimi text not null default 'TRY',
  bakiye numeric(14,2) not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (firma_id, kod)
);

create table if not exists banka_hareketleri (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  banka_hesap_id uuid not null references banka_hesaplari(id) on delete cascade,
  tarih date not null,
  islem_turu text not null,
  belge_no text,
  aciklama text,
  borc numeric(14,2) not null default 0,
  alacak numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists kasa_hareketleri_v2 (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  tarih date not null,
  islem_turu text not null,
  belge_no text,
  aciklama text,
  borc numeric(14,2) not null default 0,
  alacak numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists finans_fisleri (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  fis_no text not null,
  fis_tarihi date not null,
  aciklama text,
  toplam_borc numeric(14,2) not null default 0,
  toplam_alacak numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (firma_id, fis_no)
);

create table if not exists finans_fis_satirlari (
  id uuid primary key default gen_random_uuid(),
  fis_id uuid not null references finans_fisleri(id) on delete cascade,
  hesap_tipi text not null, -- cari/banka/kasa/diger
  hesap_id uuid,
  aciklama text,
  borc numeric(14,2) not null default 0,
  alacak numeric(14,2) not null default 0
);

-- =========================================================
-- C) FATURA
-- =========================================================
create table if not exists faturalar (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  tur text not null check (tur in ('alis','satis','alis_iade','satis_iade')),
  fatura_no text not null,
  belge_no text,
  tarih date not null,
  cari_id uuid not null references cariler(id),
  toplam_matrah numeric(14,2) not null default 0,
  toplam_kdv numeric(14,2) not null default 0,
  iskonto_tutari numeric(14,2) not null default 0,
  tevkifat_tutari numeric(14,2) not null default 0,
  genel_toplam numeric(14,2) not null default 0,
  kaynak text not null default 'manuel', -- manuel/isnet/efatura/api
  created_at timestamptz not null default now(),
  unique (firma_id, fatura_no)
);

create table if not exists fatura_satirlari (
  id uuid primary key default gen_random_uuid(),
  fatura_id uuid not null references faturalar(id) on delete cascade,
  satir_no int not null default 1,
  urun_hizmet text not null,
  miktar numeric(14,3) not null default 1,
  birim text not null default 'Adet',
  birim_fiyat numeric(14,2) not null default 0,
  matrah numeric(14,2) not null default 0,
  kdv_orani numeric(5,2) not null default 20,
  kdv_tutari numeric(14,2) not null default 0,
  toplam_tutar numeric(14,2) not null default 0
);

create table if not exists irsaliyeler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  irsaliye_no text not null,
  tarih date not null,
  cari_id uuid references cariler(id),
  aciklama text,
  created_at timestamptz not null default now()
);

create table if not exists stok_kartlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  kod text not null,
  ad text not null,
  birim text not null default 'Adet',
  kdv_orani numeric(5,2) not null default 20,
  aktif boolean not null default true,
  unique (firma_id, kod)
);

-- =========================================================
-- D) CEK - SENET
-- =========================================================
create table if not exists cekler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  portfoy_no text not null,
  cek_no text not null,
  cari_id uuid references cariler(id),
  tutar numeric(14,2) not null,
  vade_tarihi date not null,
  durum text not null default 'portfoyde',
  created_at timestamptz not null default now()
);

create table if not exists senetler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  portfoy_no text not null,
  senet_no text not null,
  cari_id uuid references cariler(id),
  tutar numeric(14,2) not null,
  vade_tarihi date not null,
  durum text not null default 'portfoyde',
  created_at timestamptz not null default now()
);

create table if not exists cek_senet_hareketleri (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  evrak_tipi text not null check (evrak_tipi in ('cek','senet')),
  evrak_id uuid not null,
  tarih date not null,
  hareket_tipi text not null,
  aciklama text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- E) BORDRO - IK
-- =========================================================
create table if not exists personel (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  sicil_no text,
  ad_soyad text not null,
  tc_no text,
  ise_giris_tarihi date not null,
  durum text not null default 'aktif',
  brut_ucret numeric(14,2) default 0,
  created_at timestamptz not null default now()
);

create table if not exists bordro_donemleri (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  donem text not null, -- YYYY-MM
  durum text not null default 'hazirlaniyor',
  created_at timestamptz not null default now(),
  unique (firma_id, donem)
);

create table if not exists bordro_kesintileri (
  id uuid primary key default gen_random_uuid(),
  bordro_donem_id uuid not null references bordro_donemleri(id) on delete cascade,
  personel_id uuid not null references personel(id) on delete cascade,
  kesinti_tipi text not null,
  tutar numeric(14,2) not null default 0
);

create table if not exists bordro_ekleri (
  id uuid primary key default gen_random_uuid(),
  bordro_donem_id uuid not null references bordro_donemleri(id) on delete cascade,
  personel_id uuid not null references personel(id) on delete cascade,
  ek_tipi text not null,
  tutar numeric(14,2) not null default 0
);

create table if not exists icra_kesintileri (
  id uuid primary key default gen_random_uuid(),
  personel_id uuid not null references personel(id) on delete cascade,
  dosya_no text not null,
  tutar numeric(14,2) not null,
  baslangic_tarihi date not null,
  bitis_tarihi date
);

create table if not exists sgk_bildirge_kayitlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  donem text not null,
  belge_no text,
  durum text not null default 'bekliyor',
  tutar numeric(14,2) default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- F) PROJE - IS TAKIBI
-- =========================================================
create table if not exists projeler_v2 (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  kod text,
  ad text not null,
  durum text not null default 'aktif',
  baslangic_tarihi date,
  bitis_tarihi date,
  created_at timestamptz not null default now()
);

create table if not exists proje_gorevleri (
  id uuid primary key default gen_random_uuid(),
  proje_id uuid not null references projeler_v2(id) on delete cascade,
  baslik text not null,
  durum text not null default 'bekliyor',
  oncelik text not null default 'orta',
  sorumlu text,
  baslangic_tarihi date,
  bitis_tarihi date
);

create table if not exists proje_maliyetleri (
  id uuid primary key default gen_random_uuid(),
  proje_id uuid not null references projeler_v2(id) on delete cascade,
  tarih date not null,
  maliyet_tipi text not null,
  tutar numeric(14,2) not null default 0,
  aciklama text
);

create table if not exists proje_faturalari (
  id uuid primary key default gen_random_uuid(),
  proje_id uuid not null references projeler_v2(id) on delete cascade,
  fatura_id uuid not null references faturalar(id) on delete cascade
);

-- =========================================================
-- Trigger: cari_bakiyeler otomatik guncelle
-- =========================================================
create or replace function trg_refresh_cari_bakiye()
returns trigger
language plpgsql
as $$
declare
  v_cari_id uuid;
begin
  v_cari_id := coalesce(new.cari_id, old.cari_id);

  insert into cari_bakiyeler (cari_id, toplam_borc, toplam_alacak, net_bakiye, updated_at)
  select
    v_cari_id,
    coalesce(sum(borc),0),
    coalesce(sum(alacak),0),
    coalesce(sum(borc),0) - coalesce(sum(alacak),0),
    now()
  from cari_hareketler_v2
  where cari_id = v_cari_id
  on conflict (cari_id) do update set
    toplam_borc = excluded.toplam_borc,
    toplam_alacak = excluded.toplam_alacak,
    net_bakiye = excluded.net_bakiye,
    updated_at = now();

  return null;
end;
$$;

drop trigger if exists trg_cari_hareket_after on cari_hareketler_v2;
create trigger trg_cari_hareket_after
after insert or update or delete on cari_hareketler_v2
for each row execute function trg_refresh_cari_bakiye();

create index if not exists idx_cariler_firma on cariler(firma_id);
create index if not exists idx_cari_hareketler_v2_cari on cari_hareketler_v2(cari_id, tarih);
create index if not exists idx_faturalar_firma_tarih on faturalar(firma_id, tarih);
create index if not exists idx_fatura_satirlari_fatura on fatura_satirlari(fatura_id);
