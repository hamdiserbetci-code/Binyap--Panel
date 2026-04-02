-- =============================================================================
-- İCRA TAKİBİ MODÜLÜ — TABLO KURULUMU
-- =============================================================================

-- Ana icra takip tablosu
create table if not exists icra_takibi (
  id                  uuid primary key default gen_random_uuid(),
  firma_id            uuid not null references firmalar(id) on delete cascade,
  musteri_id          uuid references musteriler(id) on delete set null,

  -- Tebligat bilgileri
  borclu_adi          text not null,
  tc_no               text,
  icra_dairesi_adi    text not null,
  dosya_no            text not null,
  tebligat_tarihi     date not null,
  alacakli_adi        text not null,
  borc_tutari         numeric(15,2) not null default 0,
  icra_dairesi_iban   text,
  cevap_tarihi        date,

  durum               text not null default 'aktif'
                        check (durum in ('aktif', 'odendi', 'kapali')),
  notlar              text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Ödeme takip tablosu (her icraya yapılan ödemeleri tutar)
create table if not exists icra_odemeler (
  id              uuid primary key default gen_random_uuid(),
  icra_id         uuid not null references icra_takibi(id) on delete cascade,
  firma_id        uuid not null references firmalar(id) on delete cascade,
  odeme_tarihi    date not null,
  tutar           numeric(15,2) not null default 0,
  aciklama        text,
  created_at      timestamptz not null default now()
);

-- İndeksler
create index if not exists idx_icra_takibi_firma     on icra_takibi(firma_id);
create index if not exists idx_icra_takibi_musteri   on icra_takibi(musteri_id);
create index if not exists idx_icra_takibi_durum     on icra_takibi(durum);
create index if not exists idx_icra_odemeler_icra    on icra_odemeler(icra_id);
create index if not exists idx_icra_odemeler_firma   on icra_odemeler(firma_id);

-- Erişim izinleri
grant select, insert, update, delete on icra_takibi  to authenticated, anon;
grant select, insert, update, delete on icra_odemeler to authenticated, anon;

-- RLS (Row Level Security) — firmalar kendi verilerini görür
alter table icra_takibi  enable row level security;
alter table icra_odemeler enable row level security;

-- Politikalar (authenticated kullanıcı kendi firma verisine erişir)
drop policy if exists "icra_takibi_firma_policy"  on icra_takibi;
drop policy if exists "icra_odemeler_firma_policy" on icra_odemeler;

create policy "icra_takibi_firma_policy" on icra_takibi
  for all using (
    firma_id in (
      select firma_id from kullanici_profilleri
      where auth_user_id = auth.uid() and aktif = true
    )
  );

create policy "icra_odemeler_firma_policy" on icra_odemeler
  for all using (
    firma_id in (
      select firma_id from kullanici_profilleri
      where auth_user_id = auth.uid() and aktif = true
    )
  );
