create extension if not exists "pgcrypto";

drop table if exists rapor_sablonlari cascade;
drop table if exists kullanici_profilleri cascade;
drop table if exists bildirim_kayitlari cascade;
drop table if exists gorevler cascade;
drop table if exists dokumanlar cascade;
drop table if exists vergi_surecleri cascade;
drop table if exists kasa_hareketleri cascade;
drop table if exists odeme_planlari cascade;
drop table if exists gider_kayitlari cascade;
drop table if exists gelir_kayitlari cascade;
drop table if exists puantaj_kayitlari cascade;
drop table if exists ekip_calisanlari cascade;
drop table if exists ekipler cascade;
drop table if exists projeler cascade;
drop table if exists firmalar cascade;

create table firmalar (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  kisa_ad text,
  vergi_no text,
  mersis_no text,
  yetkili text,
  telefon text,
  email text,
  adres text,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table kullanici_profilleri (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  firma_id uuid references firmalar(id) on delete set null,
  ad_soyad text,
  email text not null,
  rol text not null default 'izleme',
  aktif boolean not null default true,
  son_giris_at timestamptz,
  created_at timestamptz not null default now()
);

create table projeler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  kod text,
  ad text not null,
  durum text not null default 'planlama',
  baslangic_tarihi date,
  bitis_tarihi date,
  butce numeric(14,2) not null default 0,
  para_birimi text not null default 'TRY',
  lokasyon text,
  aciklama text,
  created_at timestamptz not null default now()
);

create table ekipler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid references projeler(id) on delete set null,
  ad text not null,
  ekip_turu text,
  sorumlu_kisi text,
  telefon text,
  aktif boolean not null default true,
  aciklama text,
  created_at timestamptz not null default now()
);

create table ekip_calisanlari (
  id uuid primary key default gen_random_uuid(),
  ekip_id uuid not null references ekipler(id) on delete cascade,
  ad_soyad text not null,
  tc_kimlik_no text,
  gorev text,
  gunluk_ucret numeric(12,2) not null default 0,
  ise_giris_tarihi date,
  cikis_tarihi date,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table puantaj_kayitlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid not null references projeler(id) on delete cascade,
  ekip_id uuid not null references ekipler(id) on delete cascade,
  calisan_id uuid references ekip_calisanlari(id) on delete set null,
  tarih date not null,
  durum text not null default 'tam_gun',
  mesai_saati numeric(6,2) not null default 0,
  yevmiye numeric(12,2) not null default 0,
  aciklama text,
  created_at timestamptz not null default now()
);

create table gelir_kayitlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid not null references projeler(id) on delete cascade,
  kayit_turu text not null default 'hakedis',
  evrak_no text,
  cari_unvan text,
  tarih date not null,
  vade_tarihi date,
  tutar numeric(14,2) not null default 0,
  kdv_orani numeric(5,2) not null default 0,
  tahsilat_durumu text not null default 'bekleniyor',
  aciklama text,
  created_at timestamptz not null default now()
);

create table gider_kayitlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid not null references projeler(id) on delete cascade,
  ekip_id uuid references ekipler(id) on delete set null,
  kategori text not null,
  tedarikci text,
  belge_no text,
  tarih date not null,
  vade_tarihi date,
  tutar numeric(14,2) not null default 0,
  kdv_orani numeric(5,2) not null default 0,
  odeme_durumu text not null default 'bekleniyor',
  aciklama text,
  created_at timestamptz not null default now()
);

create table odeme_planlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid references projeler(id) on delete set null,
  bagli_tablo text,
  bagli_kayit_id uuid,
  plan_turu text not null,
  unvan text not null,
  aciklama text,
  vade_tarihi date not null,
  planlanan_tutar numeric(14,2) not null default 0,
  gerceklesen_tutar numeric(14,2) not null default 0,
  durum text not null default 'planlandi',
  created_at timestamptz not null default now()
);

create table kasa_hareketleri (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid references projeler(id) on delete set null,
  hareket_turu text not null,
  kanal text not null default 'kasa',
  bagli_tablo text,
  bagli_kayit_id uuid,
  tarih date not null,
  tutar numeric(14,2) not null default 0,
  aciklama text,
  fis_no text,
  created_at timestamptz not null default now()
);

create table vergi_surecleri (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid references projeler(id) on delete set null,
  surec_turu text not null,
  yil integer not null,
  ay integer,
  donem text,
  son_tarih date not null,
  beyan_tarihi date,
  tutar numeric(14,2) not null default 0,
  durum text not null default 'taslak',
  sorumlu text,
  aciklama text,
  created_at timestamptz not null default now(),
  constraint vergi_ay_kontrol check (ay is null or ay between 1 and 12)
);

create table dokumanlar (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid references projeler(id) on delete set null,
  modul text not null,
  kategori text not null,
  bagli_tablo text,
  bagli_kayit_id uuid,
  dosya_adi text not null,
  dosya_url text not null,
  mime_type text,
  dosya_boyutu bigint,
  donem text,
  aciklama text,
  created_at timestamptz not null default now()
);

create table gorevler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  proje_id uuid references projeler(id) on delete set null,
  baslik text not null,
  aciklama text,
  oncelik text not null default 'orta',
  durum text not null default 'beklemede',
  sorumlu text,
  son_tarih date,
  hatirlatma_tarihi date,
  hatirlama_saati time,
  erteleme_dakika integer not null default 0,
  ertelenmis_tarih timestamptz,
  created_at timestamptz not null default now()
);

create table bildirim_kayitlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  kaynak_turu text not null,
  kaynak_id uuid not null,
  seviye text not null,
  baslik text not null,
  mesaj text,
  okunma_tarihi timestamptz,
  erteleme_sonrasi timestamptz,
  kapali boolean not null default false,
  created_at timestamptz not null default now(),
  unique (firma_id, kaynak_turu, kaynak_id, seviye)
);

create table rapor_sablonlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid references firmalar(id) on delete cascade,
  ad text not null,
  rapor_turu text not null,
  kolonlar jsonb not null default '[]'::jsonb,
  filtreler jsonb not null default '{}'::jsonb,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_kullanicilar_firma on kullanici_profilleri(firma_id, rol, aktif);
create index idx_projeler_firma on projeler(firma_id);
create index idx_ekipler_firma on ekipler(firma_id);
create index idx_ekipler_proje on ekipler(proje_id);
create index idx_puantaj_proje_tarih on puantaj_kayitlari(proje_id, tarih);
create index idx_gelir_proje_tarih on gelir_kayitlari(proje_id, tarih);
create index idx_gider_proje_tarih on gider_kayitlari(proje_id, tarih);
create index idx_odeme_vade on odeme_planlari(vade_tarihi);
create index idx_kasa_tarih on kasa_hareketleri(tarih);
create index idx_vergi_firma_yil on vergi_surecleri(firma_id, yil, surec_turu);
create index idx_dokuman_modul on dokumanlar(modul, kategori);
create index idx_gorevler_firma on gorevler(firma_id, durum, son_tarih);
create index idx_bildirimler_firma on bildirim_kayitlari(firma_id, kaynak_turu, kapali, erteleme_sonrasi);

insert into firmalar (ad, kisa_ad)
values ('ETM', 'ETM');





create or replace function current_firma_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select firma_id
  from kullanici_profilleri
  where auth_user_id = auth.uid()
    and aktif = true
  limit 1
$$;

create or replace function current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol
  from kullanici_profilleri
  where auth_user_id = auth.uid()
    and aktif = true
  limit 1
$$;

create or replace function has_panel_permission(action_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when current_app_role() = 'yonetici' then true
    when current_app_role() = 'muhasebe' then action_name in ('view', 'edit', 'report')
    when current_app_role() = 'santiye' then action_name in ('view', 'edit')
    when current_app_role() = 'izleme' then action_name in ('view', 'report')
    else false
  end
$$;

create or replace function handle_profile_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_firma uuid;
  firma_profile_count integer;
begin
  if new.auth_user_id is null then
    new.auth_user_id := auth.uid();
  end if;

  if new.email is null then
    new.email := coalesce(auth.jwt() ->> 'email', 'kullanici@etm.local');
  end if;

  if new.firma_id is null then
    select id into target_firma
    from firmalar
    order by created_at
    limit 1;

    new.firma_id := target_firma;
  end if;

  select count(*) into firma_profile_count from kullanici_profilleri where firma_id = new.firma_id;

  if firma_profile_count = 0 then
    new.rol := 'yonetici';
  elsif current_app_role() <> 'yonetici' then
    new.rol := 'izleme';
  elsif new.rol is null or new.rol not in ('yonetici', 'muhasebe', 'santiye', 'izleme') then
    new.rol := 'izleme';
  end if;

  if new.aktif is null then
    new.aktif := true;
  end if;

  return new;
end;
$$;

create or replace function guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_app_role() <> 'yonetici' then
    new.auth_user_id := old.auth_user_id;
    new.firma_id := old.firma_id;
    new.rol := old.rol;
    new.aktif := old.aktif;
  end if;

  return new;
end;
$$;

create trigger trg_kullanici_profilleri_defaults
before insert on kullanici_profilleri
for each row execute function handle_profile_defaults();

create trigger trg_kullanici_profilleri_guard
before update on kullanici_profilleri
for each row execute function guard_profile_update();

alter table firmalar enable row level security;
alter table kullanici_profilleri enable row level security;
alter table projeler enable row level security;
alter table ekipler enable row level security;
alter table ekip_calisanlari enable row level security;
alter table puantaj_kayitlari enable row level security;
alter table gelir_kayitlari enable row level security;
alter table gider_kayitlari enable row level security;
alter table odeme_planlari enable row level security;
alter table kasa_hareketleri enable row level security;
alter table vergi_surecleri enable row level security;
alter table dokumanlar enable row level security;
alter table gorevler enable row level security;
alter table bildirim_kayitlari enable row level security;
alter table rapor_sablonlari enable row level security;

create policy "firmalar_select_same_or_bootstrap" on firmalar for select using (auth.role() = 'authenticated' and (id = current_firma_id() or (current_firma_id() is null and aktif = true)));
create policy "firmalar_insert_first_bootstrap" on firmalar for insert with check (auth.role() = 'authenticated' and current_firma_id() is null and not exists (select 1 from firmalar));
create policy "firmalar_update_yonetici" on firmalar for update using (auth.role() = 'authenticated' and id = current_firma_id() and current_app_role() = 'yonetici') with check (id = current_firma_id() and current_app_role() = 'yonetici');
create policy "firmalar_delete_yonetici" on firmalar for delete using (auth.role() = 'authenticated' and id = current_firma_id() and current_app_role() = 'yonetici');

create policy "kullanici_profilleri_select_self_or_yonetici" on kullanici_profilleri for select using (auth.role() = 'authenticated' and (auth_user_id = auth.uid() or (firma_id = current_firma_id() and current_app_role() = 'yonetici')));
create policy "kullanici_profilleri_insert_self_or_yonetici" on kullanici_profilleri for insert with check (auth.role() = 'authenticated' and (auth_user_id = auth.uid() or current_app_role() = 'yonetici' or auth_user_id is null) and (firma_id = current_firma_id() or current_firma_id() is null or firma_id is null));
create policy "kullanici_profilleri_update_self_or_yonetici" on kullanici_profilleri for update using (auth.role() = 'authenticated' and (auth_user_id = auth.uid() or (firma_id = current_firma_id() and current_app_role() = 'yonetici'))) with check (auth.role() = 'authenticated' and (auth_user_id = auth.uid() or (firma_id = current_firma_id() and current_app_role() = 'yonetici')));
create policy "kullanici_profilleri_delete_yonetici" on kullanici_profilleri for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and current_app_role() = 'yonetici');

create policy "projeler_select_same_firma" on projeler for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "projeler_insert_edit" on projeler for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "projeler_update_edit" on projeler for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "projeler_delete_delete" on projeler for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "ekipler_select_same_firma" on ekipler for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "ekipler_insert_edit" on ekipler for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "ekipler_update_edit" on ekipler for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "ekipler_delete_delete" on ekipler for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "ekip_calisanlari_select_same_firma" on ekip_calisanlari for select using (auth.role() = 'authenticated' and exists (select 1 from ekipler where ekipler.id = ekip_calisanlari.ekip_id and ekipler.firma_id = current_firma_id()));
create policy "ekip_calisanlari_insert_edit" on ekip_calisanlari for insert with check (auth.role() = 'authenticated' and has_panel_permission('edit') and exists (select 1 from ekipler where ekipler.id = ekip_calisanlari.ekip_id and ekipler.firma_id = current_firma_id()));
create policy "ekip_calisanlari_update_edit" on ekip_calisanlari for update using (auth.role() = 'authenticated' and has_panel_permission('edit') and exists (select 1 from ekipler where ekipler.id = ekip_calisanlari.ekip_id and ekipler.firma_id = current_firma_id())) with check (has_panel_permission('edit') and exists (select 1 from ekipler where ekipler.id = ekip_calisanlari.ekip_id and ekipler.firma_id = current_firma_id()));
create policy "ekip_calisanlari_delete_delete" on ekip_calisanlari for delete using (auth.role() = 'authenticated' and has_panel_permission('delete') and exists (select 1 from ekipler where ekipler.id = ekip_calisanlari.ekip_id and ekipler.firma_id = current_firma_id()));

create policy "puantaj_select_same_firma" on puantaj_kayitlari for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "puantaj_insert_edit" on puantaj_kayitlari for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "puantaj_update_edit" on puantaj_kayitlari for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "puantaj_delete_delete" on puantaj_kayitlari for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "gelir_select_same_firma" on gelir_kayitlari for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "gelir_insert_edit" on gelir_kayitlari for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "gelir_update_edit" on gelir_kayitlari for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "gelir_delete_delete" on gelir_kayitlari for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "gider_select_same_firma" on gider_kayitlari for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "gider_insert_edit" on gider_kayitlari for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "gider_update_edit" on gider_kayitlari for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "gider_delete_delete" on gider_kayitlari for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "odeme_planlari_select_same_firma" on odeme_planlari for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "odeme_planlari_insert_edit" on odeme_planlari for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "odeme_planlari_update_edit" on odeme_planlari for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "odeme_planlari_delete_delete" on odeme_planlari for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "kasa_hareketleri_select_same_firma" on kasa_hareketleri for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "kasa_hareketleri_insert_edit" on kasa_hareketleri for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "kasa_hareketleri_update_edit" on kasa_hareketleri for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "kasa_hareketleri_delete_delete" on kasa_hareketleri for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "vergi_surecleri_select_same_firma" on vergi_surecleri for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "vergi_surecleri_insert_edit" on vergi_surecleri for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "vergi_surecleri_update_edit" on vergi_surecleri for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "vergi_surecleri_delete_delete" on vergi_surecleri for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "dokumanlar_select_same_firma" on dokumanlar for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "dokumanlar_insert_edit" on dokumanlar for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "dokumanlar_update_edit" on dokumanlar for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "dokumanlar_delete_delete" on dokumanlar for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "gorevler_select_same_firma" on gorevler for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "gorevler_insert_edit" on gorevler for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "gorevler_update_edit" on gorevler for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "gorevler_delete_delete" on gorevler for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "bildirim_kayitlari_select_same_firma" on bildirim_kayitlari for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "bildirim_kayitlari_insert_edit" on bildirim_kayitlari for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "bildirim_kayitlari_update_edit" on bildirim_kayitlari for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit')) with check (firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "bildirim_kayitlari_delete_delete" on bildirim_kayitlari for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

create policy "rapor_sablonlari_select_same_firma" on rapor_sablonlari for select using (auth.role() = 'authenticated' and firma_id = current_firma_id());
create policy "rapor_sablonlari_insert_report" on rapor_sablonlari for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('report'));
create policy "rapor_sablonlari_update_report" on rapor_sablonlari for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('report')) with check (firma_id = current_firma_id() and has_panel_permission('report'));
create policy "rapor_sablonlari_delete_delete" on rapor_sablonlari for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('delete'));

drop table if exists aktivite_loglari cascade;

create table aktivite_loglari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  auth_user_id uuid,
  kullanici_profil_id uuid references kullanici_profilleri(id) on delete set null,
  modul text not null,
  islem_turu text not null,
  kayit_turu text,
  kayit_id uuid,
  aciklama text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_aktivite_loglari_firma on aktivite_loglari(firma_id, modul, created_at desc);

alter table aktivite_loglari enable row level security;

create policy "aktivite_loglari_select_same_firma" on aktivite_loglari for select using (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('report'));
create policy "aktivite_loglari_insert_edit" on aktivite_loglari for insert with check (auth.role() = 'authenticated' and firma_id = current_firma_id() and has_panel_permission('edit'));
create policy "aktivite_loglari_update_yonetici" on aktivite_loglari for update using (auth.role() = 'authenticated' and firma_id = current_firma_id() and current_app_role() = 'yonetici') with check (firma_id = current_firma_id() and current_app_role() = 'yonetici');
create policy "aktivite_loglari_delete_yonetici" on aktivite_loglari for delete using (auth.role() = 'authenticated' and firma_id = current_firma_id() and current_app_role() = 'yonetici');
