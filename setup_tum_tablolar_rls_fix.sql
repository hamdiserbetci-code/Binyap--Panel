-- =============================================================================
-- TÜM TABLOLAR - KAPSAMLI RLS VE İZİN DÜZELTMESİ
-- "permission denied", "schema cache" hatalarını gidermek için
-- Supabase SQL Editor'de çalıştırın.
-- =============================================================================

-- ── 1. firma_tam_izolasyon politikalarını temizle (current_firma_id() gerektiriyor) ──
DO $$
DECLARE
  t text;
  tables_to_fix text[] := ARRAY[
    'firmalar','sirketler','kullanici_profilleri','kullanici_yetkileri',
    'projeler','cari_hesaplar','cari_hareketler','faturalar','fatura_satirlari',
    'kasa_hareketleri','bankalar','banka_hareketleri','tedarikciler',
    'satinalma_talepleri','satinalma_siparisleri','ekipler','ekip_calisanlari',
    'puantaj_kayitlari','gorevler','dokumanlar','aktivite_loglari',
    'vergi_beyannameleri','vergi_odemeleri','vergi_takvimi',
    'musteriler','gunluk_isler','is_takip','is_sablonlari',
    'bordro_surecler','bordro_dosyalar',
    'cekler','odeme_plani','kar_zarar_donem','kar_zarar_belgeler',
    'maliyet_surecler','maliyet_detay',
    'icra_takibi','icra_odemeler',
    'ik_personel','ik_belge','ik_ekip',
    'gelir_kayitlari','gider_kayitlari',
    'vergi_surecleri','odeme_planlari'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_fix LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      -- Tüm eski politikaları temizle
      EXECUTE format('DROP POLICY IF EXISTS "firma_tam_izolasyon" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "kullanici_kendi_firmasi_%s_secer" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "kullanici_kendi_firmasi_%s_ekler" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "kullanici_kendi_firmasi_%s_gunceller" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "kullanici_kendi_firmasi_%s_siler" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "firma_izolasyonu" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "firma_ik_personel" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "firma_ik_belge" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "dokumanlar_firma_izolasyonu" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "ekip_calisanlari_izolasyon" ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS "maliyet_surecler_select" ON %I', t);
      -- _select, _insert, _update, _delete suffix'li eski politikalar
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', t, t);
      -- RLS aktif et
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      -- Tüm authenticated kullanıcılara tam erişim
      EXECUTE format('CREATE POLICY "authenticated_full_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
      -- Grant
      EXECUTE format('GRANT ALL ON %I TO authenticated', t);
      EXECUTE format('GRANT ALL ON %I TO service_role', t);
    END IF;
  END LOOP;
END $$;

-- ── 2. Eksik tablolar için CREATE IF NOT EXISTS ────────────────────────────────

-- musteriler
CREATE TABLE IF NOT EXISTS musteriler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad TEXT NOT NULL,
  kisa_ad TEXT,
  vergi_no TEXT,
  yetkili TEXT,
  telefon TEXT,
  email TEXT,
  sektor TEXT,
  notlar TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- gunluk_isler
CREATE TABLE IF NOT EXISTS gunluk_isler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  kullanici_id UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
  baslik TEXT NOT NULL,
  aciklama TEXT,
  matris TEXT,
  durum TEXT DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','tamamlandi')),
  tarih DATE DEFAULT CURRENT_DATE,
  hatirlatici TEXT,
  hatirlatici_tarihi DATE,
  hatirlatici_saati TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- is_takip
CREATE TABLE IF NOT EXISTS is_takip (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  tip TEXT NOT NULL,
  donem TEXT NOT NULL,
  adim1_durum TEXT DEFAULT 'bekliyor',
  adim1_tarihi DATE,
  adim2_durum TEXT DEFAULT 'bekliyor',
  adim2_tarihi DATE,
  durum TEXT DEFAULT 'aktif',
  notlar TEXT,
  hatirlatici_tarihi DATE,
  hatirlatici_saati TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- is_sablonlari
CREATE TABLE IF NOT EXISTS is_sablonlari (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad TEXT NOT NULL,
  aciklama TEXT,
  tip TEXT,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- bordro_surecler
CREATE TABLE IF NOT EXISTS bordro_surecler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
  ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL,
  donem TEXT NOT NULL,
  durum TEXT DEFAULT 'bekliyor',
  notlar TEXT,
  hatirlatici_tarihi DATE,
  hatirlatici_saati TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- maliyet_surecler
CREATE TABLE IF NOT EXISTS maliyet_surecler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem TEXT NOT NULL,
  sorumlu_id UUID REFERENCES kullanici_profilleri(id) ON DELETE SET NULL,
  teslim_gunu SMALLINT,
  efatura_kontrol BOOLEAN DEFAULT false,
  efatura_luca BOOLEAN DEFAULT false,
  earsiv_kontrol BOOLEAN DEFAULT false,
  earsiv_luca BOOLEAN DEFAULT false,
  utts_kontrol BOOLEAN DEFAULT false,
  utts_luca BOOLEAN DEFAULT false,
  bordro_kontrol BOOLEAN DEFAULT false,
  bordro_luca BOOLEAN DEFAULT false,
  satis_kontrol BOOLEAN DEFAULT false,
  satis_luca BOOLEAN DEFAULT false,
  durum TEXT DEFAULT 'bekliyor',
  notlar TEXT,
  hatirlatici_tarihi DATE,
  hatirlatici_saati TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- cekler
CREATE TABLE IF NOT EXISTS cekler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  tip TEXT NOT NULL CHECK (tip IN ('alinan','verilen')),
  cek_no TEXT NOT NULL,
  banka TEXT,
  cari_hesap TEXT,
  tutar NUMERIC(12,2) NOT NULL DEFAULT 0,
  keside_tarihi DATE,
  vade_tarihi DATE NOT NULL,
  durum TEXT NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','odendi','protestolu','ciro_edildi')),
  aciklama TEXT,
  hatirlatici_tarihi DATE,
  hatirlatici_saati TEXT,
  hatirlat_gun_once INTEGER DEFAULT 1,
  tamamlandi_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS cari_hesap TEXT;
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS hatirlat_gun_once INTEGER DEFAULT 1;
ALTER TABLE cekler ADD COLUMN IF NOT EXISTS tamamlandi_at TIMESTAMPTZ;

-- odeme_plani
CREATE TABLE IF NOT EXISTS odeme_plani (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL,
  baslik TEXT NOT NULL,
  tur TEXT NOT NULL,
  ilgili_kurum TEXT,
  tutar NUMERIC(12,2) NOT NULL DEFAULT 0,
  vade DATE,
  durum TEXT NOT NULL DEFAULT 'bekliyor',
  aciklama TEXT,
  hatirlatma TIMESTAMPTZ,
  erteleme_nedeni TEXT,
  user_id UUID,
  proje_id UUID,
  kaynak TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS hatirlatma TIMESTAMPTZ;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS erteleme_nedeni TEXT;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS proje_id UUID;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS kaynak TEXT;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS musteri_id UUID;
ALTER TABLE odeme_plani ADD COLUMN IF NOT EXISTS ekip_id UUID;

-- kar_zarar_donem
CREATE TABLE IF NOT EXISTS kar_zarar_donem (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  donem TEXT NOT NULL,
  musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  satis_yurt_ici NUMERIC(14,2) DEFAULT 0,
  satis_yurt_disi NUMERIC(14,2) DEFAULT 0,
  satis_iade NUMERIC(14,2) DEFAULT 0,
  donem_basi_stok NUMERIC(14,2) DEFAULT 0,
  donem_sonu_stok NUMERIC(14,2) DEFAULT 0,
  alis_malzeme NUMERIC(14,2) DEFAULT 0,
  alis_efatura NUMERIC(14,2) DEFAULT 0,
  alis_arsiv NUMERIC(14,2) DEFAULT 0,
  alis_utts NUMERIC(14,2) DEFAULT 0,
  alis_iscilik NUMERIC(14,2) DEFAULT 0,
  gider_personel NUMERIC(14,2) DEFAULT 0,
  gider_kira NUMERIC(14,2) DEFAULT 0,
  gider_fatura NUMERIC(14,2) DEFAULT 0,
  gider_amortisman NUMERIC(14,2) DEFAULT 0,
  gider_diger NUMERIC(14,2) DEFAULT 0,
  gider_finansal NUMERIC(14,2) DEFAULT 0,
  vergi_orani NUMERIC(5,2) DEFAULT 22,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- icra_takibi
CREATE TABLE IF NOT EXISTS icra_takibi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  musteri_id UUID REFERENCES musteriler(id) ON DELETE SET NULL,
  borclu_adi TEXT NOT NULL,
  tc_no TEXT,
  isci_durumu TEXT DEFAULT 'calisiyor',
  cikis_tarihi DATE,
  icra_dairesi_adi TEXT NOT NULL,
  dosya_no TEXT NOT NULL,
  tebligat_tarihi DATE NOT NULL,
  alacakli_adi TEXT NOT NULL,
  borc_tutari NUMERIC(12,2) NOT NULL DEFAULT 0,
  faiz_orani NUMERIC(6,2) DEFAULT 0,
  tahsil_edilen NUMERIC(12,2) DEFAULT 0,
  durum TEXT DEFAULT 'devam_ediyor',
  notlar TEXT,
  tebligat_url TEXT,
  cevap_url TEXT,
  hatirlatici_tarihi DATE,
  hatirlatici_saati TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- icra_odemeler
CREATE TABLE IF NOT EXISTS icra_odemeler (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  icra_id UUID NOT NULL REFERENCES icra_takibi(id) ON DELETE CASCADE,
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  odeme_tarihi DATE NOT NULL,
  tutar NUMERIC(12,2) NOT NULL DEFAULT 0,
  aciklama TEXT,
  makbuz_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ik_personel
CREATE TABLE IF NOT EXISTS ik_personel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
  ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL,
  ad_soyad TEXT NOT NULL,
  tc_no TEXT,
  dogum_tarihi DATE,
  ise_giris_tarihi DATE NOT NULL,
  isten_cikis_tarihi DATE,
  gorev TEXT,
  maas NUMERIC(12,2),
  durum TEXT DEFAULT 'aktif',
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ik_personel ADD COLUMN IF NOT EXISTS ekip_id UUID REFERENCES ekipler(id) ON DELETE SET NULL;

-- ik_belge
CREATE TABLE IF NOT EXISTS ik_belge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  personel_id UUID REFERENCES ik_personel(id) ON DELETE CASCADE,
  proje_id UUID REFERENCES projeler(id) ON DELETE SET NULL,
  belge_tipi TEXT NOT NULL DEFAULT 'diger',
  dosya_adi TEXT NOT NULL,
  dosya_url TEXT NOT NULL,
  mime_type TEXT,
  dosya_boyutu BIGINT,
  aciklama TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- dokumanlar (ekstra kolonlar)
CREATE TABLE IF NOT EXISTS dokumanlar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  modul TEXT,
  bagli_tablo TEXT,
  bagli_kayit_id UUID,
  dosya_adi TEXT,
  dosya_url TEXT,
  mime_type TEXT,
  dosya_boyutu BIGINT,
  kategori TEXT,
  aciklama TEXT,
  yukleyen_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS bagli_tablo TEXT;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS bagli_kayit_id UUID;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS modul TEXT;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS kategori TEXT;
ALTER TABLE dokumanlar ADD COLUMN IF NOT EXISTS yukleyen_id UUID;

-- ── 3. Yeni oluşturulan tablolara da izin ve RLS ekle ─────────────────────────
DO $$
DECLARE
  t text;
  new_tables text[] := ARRAY[
    'musteriler','gunluk_isler','is_takip','is_sablonlari',
    'bordro_surecler','maliyet_surecler','cekler','odeme_plani',
    'kar_zarar_donem','icra_takibi','icra_odemeler',
    'ik_personel','ik_belge','dokumanlar'
  ];
BEGIN
  FOREACH t IN ARRAY new_tables LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "authenticated_full_access" ON %I', t);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY "authenticated_full_access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
      EXECUTE format('GRANT ALL ON %I TO authenticated', t);
      EXECUTE format('GRANT ALL ON %I TO service_role', t);
    END IF;
  END LOOP;
END $$;

-- ── 4. Tüm sequence'lara grant ────────────────────────────────────────────────
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ── 5. Schema cache yenile ────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
