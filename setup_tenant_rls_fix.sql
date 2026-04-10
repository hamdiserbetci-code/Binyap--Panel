-- =============================================================================
-- TÜM ANA TABLOLAR İÇİN KESİN FİRMA İZOLASYONU (RLS) - AKILLI KONTROL
-- Yeni eklenecek firmaların verilerinin %100 birbirinden yalıtılmasını sağlar.
-- Supabase SQL Editor üzerinde çalıştırın.
-- =============================================================================

DO $$
DECLARE
    t_name text;
    tables text[] := ARRAY[
        'projeler', 'cari_hesaplar', 'cari_hareketler', 'faturalar', 
        'kasa_hareketleri', 'bankalar', 'banka_hareketleri', 'tedarikciler', 
        'satinalma_talepleri', 'satinalma_siparisleri', 'ekipler', 
        'puantaj_kayitlari', 'gorevler', 'dokumanlar', 'aktivite_loglari',
        'gelir_kayitlari', 'gider_kayitlari', 'odeme_planlari', 'vergi_surecleri',
        'is_sablonlari', 'bordro_surecler', 'cekler', 'kar_zarar_donem',
        'kar_zarar_belgeler', 'ik_personel', 'ik_belge', 'ik_ekip', 
        'icra_takibi', 'icra_odemeler'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables LOOP
        -- Tablo veritabanında varsa ve firma_id kolonuna sahipse işlem yap
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t_name) THEN
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = t_name AND column_name = 'firma_id') THEN
                EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t_name);
                EXECUTE format('DROP POLICY IF EXISTS "firma_tam_izolasyon" ON %I', t_name);
                EXECUTE format('
                    CREATE POLICY "firma_tam_izolasyon" ON %I 
                    FOR ALL 
                    USING (auth.role() = ''authenticated'' AND firma_id = current_firma_id())
                    WITH CHECK (auth.role() = ''authenticated'' AND firma_id = current_firma_id())
                ', t_name);
            END IF;
        END IF;
    END LOOP;
END $$;

-- Ekip çalışanları (ekipler üzerinden)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ekip_calisanlari') THEN
        ALTER TABLE ekip_calisanlari ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "ekip_calisanlari_izolasyon" ON ekip_calisanlari;
        
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ekip_calisanlari' AND column_name = 'firma_id') THEN
            CREATE POLICY "ekip_calisanlari_izolasyon" ON ekip_calisanlari FOR ALL 
            USING (auth.role() = 'authenticated' AND firma_id = current_firma_id())
            WITH CHECK (auth.role() = 'authenticated' AND firma_id = current_firma_id());
        ELSE
            CREATE POLICY "ekip_calisanlari_izolasyon" ON ekip_calisanlari FOR ALL 
            USING (auth.role() = 'authenticated' AND ekip_id IN (SELECT id FROM ekipler WHERE firma_id = current_firma_id()))
            WITH CHECK (auth.role() = 'authenticated' AND ekip_id IN (SELECT id FROM ekipler WHERE firma_id = current_firma_id()));
        END IF;
    END IF;
END $$;