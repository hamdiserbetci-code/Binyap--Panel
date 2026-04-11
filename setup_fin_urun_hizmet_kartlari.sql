-- Finans modulunde Excel'den alis faturasi aktarimi sirasinda
-- satir aciklamalarini kart olarak saklamak icin kullanilir.
create table if not exists fin_urun_hizmet_kartlari (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  tur text not null default 'hizmet' check (tur in ('malzeme', 'hizmet', 'masraf')),
  kod text,
  ad text not null,
  birim text not null default 'Adet',
  varsayilan_birim_fiyat numeric(15,2) default 0,
  varsayilan_kdv_orani numeric(5,2) default 20,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_fin_urun_hizmet_kartlari_firma_ad
  on fin_urun_hizmet_kartlari (firma_id, ad);

create index if not exists idx_fin_urun_hizmet_kartlari_firma
  on fin_urun_hizmet_kartlari (firma_id);

alter table fin_urun_hizmet_kartlari enable row level security;

drop policy if exists "fin_urun_hizmet_kartlari_select" on fin_urun_hizmet_kartlari;
drop policy if exists "fin_urun_hizmet_kartlari_insert" on fin_urun_hizmet_kartlari;
drop policy if exists "fin_urun_hizmet_kartlari_update" on fin_urun_hizmet_kartlari;
drop policy if exists "fin_urun_hizmet_kartlari_delete" on fin_urun_hizmet_kartlari;

create policy "fin_urun_hizmet_kartlari_select"
  on fin_urun_hizmet_kartlari for select using (true);
create policy "fin_urun_hizmet_kartlari_insert"
  on fin_urun_hizmet_kartlari for insert with check (true);
create policy "fin_urun_hizmet_kartlari_update"
  on fin_urun_hizmet_kartlari for update using (true);
create policy "fin_urun_hizmet_kartlari_delete"
  on fin_urun_hizmet_kartlari for delete using (true);

notify pgrst, 'reload schema';
