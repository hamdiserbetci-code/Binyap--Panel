-- ============================================================
-- INSERT SAMPLE DATA FOR TESTING - ETM FIRMA
-- ============================================================

-- VERGI SURECLERI
INSERT INTO vergi_surecleri (firma_id, vergi_tipi, donem, tutar, vade_tarihi, durum, belge_no, aciklama, notlar)
VALUES
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'kdv', '2024-04', 15000.00, '2024-04-25', 'bekliyor', 'KDV-001', 'Nisan KDV', ''),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'kurumlar_vergisi', '2024-Q1', 50000.00, '2024-04-15', 'odendi', 'KUR-001', '1. Çeyrek Kurumlar Vergisi', 'Ödendi'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'muhsgk', '2024-03', 8000.00, '2024-03-20', 'gecikti', 'MUHS-001', 'Muhasebe SGK', 'Gecikti'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'gecici_vergi', '2024-05', 20000.00, '2024-05-10', 'bekliyor', 'GEC-001', 'Geçici Vergi', ''),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'kdv2', '2024-04', 5000.00, '2024-04-25', 'bekliyor', 'KDV2-001', 'KDV 2. Kesinti', '');

-- ODEME PLANI
INSERT INTO odeme_plani (firma_id, odeme_tipi, odeme_no, tutar, vade_tarihi, durum, aciklama, notlar)
VALUES
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'pesin', 'ODE-001', 25000.00, '2024-05-15', 'bekliyor', 'Müşteri Avans', ''),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'taksit', 'ODE-002', 10000.00, '2024-04-30', 'odendi', '1. Taksit', 'Ödendi'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'kredili', 'ODE-003', 35000.00, '2024-06-01', 'bekliyor', 'Tedarikçi Kredisi', '');

-- PROJELER
INSERT INTO projeler_conf (firma_id, proje_adi, baslangic_tarihi, bitis_tarihi, butce, durum, sorumlu_kisi, aciklama)
VALUES
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'Web Platform Geliştirme', '2024-03-01', '2024-08-31', 250000.00, 'devam', 'Ahmet Yılmaz', 'Yeni e-ticaret platformu'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'Finansal Modül', '2024-04-15', '2024-06-15', 80000.00, 'planlama', 'Fatih Demir', 'Hazırlık aşamasında'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'Veritabanı Migrasyonu', '2024-01-01', '2024-03-31', 120000.00, 'tamamlandi', 'Zeynep Kaya', 'Başarıyla tamamlandı');

-- BORDRO DONEMLERI
INSERT INTO bordro_donemleri (firma_id, donem_adi, baslangic_tarihi, bitis_tarihi, bordro_tarihi, durum, aciklama)
VALUES
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'Nisan 2024', '2024-04-01', '2024-04-30', '2024-05-05', 'tamamlandi', 'Nisan bordrosu ödendi'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'Mayıs 2024', '2024-05-01', '2024-05-31', '2024-06-05', 'bekliyor', 'Mayıs döneminde'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'Haziran 2024', '2024-06-01', '2024-06-30', '2024-07-05', 'planlanmis', 'Planlanmış tarih');

-- SGK ENTEGRASYONU
INSERT INTO sgk_entegrasyon (firma_id, sgk_tipi, donem, calisan_sayisi, prim_tutari, vade_tarihi, durum, aciklama)
VALUES
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'genel_saglik', '2024-04', 15, 45000.00, '2024-05-20', 'bekliyor', 'Genel Sağlık Sigortası'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'is_kazasi', '2024-04', 15, 12000.00, '2024-05-20', 'odendi', 'İş Kazası Sigortası'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'malulluk', '2024-04', 15, 8000.00, '2024-05-20', 'bekliyor', 'Malüllük Sigortası'),
  ('ff777cc3-d712-4568-8873-e036e0f2d0cd', 'issizlik', '2024-04', 15, 5000.00, '2024-05-20', 'gecikti', 'İşsizlik Sigortası');

