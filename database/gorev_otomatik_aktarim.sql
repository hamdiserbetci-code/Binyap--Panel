-- Modül kayıtlarını otomatik olarak Görev Takibi'ne aktarır.
-- Supabase SQL Editor'de gorev_schema.sql ve ilgili modül tablolarından sonra çalıştırın.

ALTER TABLE gorevler ADD COLUMN IF NOT EXISTS kaynak_tablo TEXT;
ALTER TABLE gorevler ADD COLUMN IF NOT EXISTS kaynak_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS gorevler_kaynak_unique_idx
  ON gorevler(kaynak_tablo, kaynak_id)
  WHERE kaynak_tablo IS NOT NULL AND kaynak_id IS NOT NULL;

CREATE OR REPLACE FUNCTION gorev_modul_kayit_aktar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_title TEXT;
  task_description TEXT;
  task_due DATE;
  task_category TEXT := 'genel';
  task_priority TEXT := 'normal';
  account_name TEXT;
BEGIN
  IF TG_TABLE_NAME = 'odeme_plani' THEN
    task_title := 'Ödeme planı: ' || COALESCE(NEW.aciklama, 'Yeni ödeme');
    task_description := 'Tutar: ' || COALESCE(NEW.tutar::TEXT, '0') || ' TL';
    task_due := NEW.vade_tarihi;
    task_category := 'finans';
    task_priority := CASE WHEN NEW.durum = 'bekliyor' THEN 'yuksek' ELSE 'normal' END;
  ELSIF TG_TABLE_NAME = 'beyanname_takibi' THEN
    task_title := 'Beyanname takibi: ' || COALESCE(NEW.tip, 'Beyanname') || ' - ' || NEW.donem;
    task_description := 'Tahakkuk: ' || COALESCE(NEW.tahakkuk_tutari::TEXT, '0') || ' TL';
    task_due := NEW.son_tarih;
    task_category := 'vergi';
    task_priority := 'yuksek';
  ELSIF TG_TABLE_NAME = 'banka_mutabakatlari' THEN
    SELECT banka_adi INTO account_name FROM banka_hesaplari WHERE id = NEW.banka_hesap_id;
    task_title := 'Banka mutabakatı: ' || COALESCE(account_name, 'Banka hesabı') || ' - ' || NEW.donem;
    task_description := 'Ay sonu bakiye: ' || COALESCE(NEW.ay_sonu_bakiye::TEXT, '0') || ' TL. Ekstre ve muavin kontrolü yapılacak.';
    task_due := (date_trunc('month', (NEW.donem || '-01')::DATE) + INTERVAL '1 month - 1 day')::DATE;
    task_category := 'finans';
    task_priority := 'yuksek';
  ELSIF TG_TABLE_NAME = 'proje_giderler' THEN
    task_title := 'Proje gideri: ' || COALESCE(NEW.gider_kalemi, 'Yeni gider');
    task_description := COALESCE(NEW.cari_unvan, '') || ' - ' || COALESCE(NEW.net_tutar::TEXT, '0') || ' TL';
    task_due := NEW.vade_tarihi;
    task_category := 'proje';
    task_priority := 'normal';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO gorevler (
    firma_id, baslik, aciklama, oncelik, kategori, durum,
    son_tarih, kaynak_tablo, kaynak_id
  ) VALUES (
    NEW.firma_id, task_title, task_description, task_priority, task_category, 'bekliyor',
    task_due, TG_TABLE_NAME, NEW.id
  )
  ON CONFLICT (kaynak_tablo, kaynak_id)
  WHERE kaynak_tablo IS NOT NULL AND kaynak_id IS NOT NULL
  DO UPDATE SET
    baslik = EXCLUDED.baslik,
    aciklama = EXCLUDED.aciklama,
    son_tarih = EXCLUDED.son_tarih,
    updated_at = NOW()
  WHERE gorevler.durum <> 'tamamlandi';

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.odeme_plani') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS gorev_odeme_plani_aktar ON odeme_plani;
    CREATE TRIGGER gorev_odeme_plani_aktar AFTER INSERT OR UPDATE ON odeme_plani
      FOR EACH ROW EXECUTE FUNCTION gorev_modul_kayit_aktar();
  END IF;
  IF to_regclass('public.beyanname_takibi') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS gorev_beyanname_aktar ON beyanname_takibi;
    CREATE TRIGGER gorev_beyanname_aktar AFTER INSERT OR UPDATE ON beyanname_takibi
      FOR EACH ROW EXECUTE FUNCTION gorev_modul_kayit_aktar();
  END IF;
  IF to_regclass('public.banka_mutabakatlari') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS gorev_banka_mutabakat_aktar ON banka_mutabakatlari;
    CREATE TRIGGER gorev_banka_mutabakat_aktar AFTER INSERT OR UPDATE ON banka_mutabakatlari
      FOR EACH ROW EXECUTE FUNCTION gorev_modul_kayit_aktar();
  END IF;
  IF to_regclass('public.proje_giderler') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS gorev_proje_gideri_aktar ON proje_giderler;
    CREATE TRIGGER gorev_proje_gideri_aktar AFTER INSERT OR UPDATE ON proje_giderler
      FOR EACH ROW EXECUTE FUNCTION gorev_modul_kayit_aktar();
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION gorev_modul_kayit_aktar() TO authenticated;
