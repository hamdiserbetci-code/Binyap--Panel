# Supabase Uygulama Sirasi

## 1. Yedek al
Supabase SQL Editor acmadan once mevcut veritabaninin yedegini al.

## 2. SQL dosyasini ac
Dosya:
`c:\etm-panel\database\new-panel-schema.sql`

Supabase dashboard icinde:
`SQL Editor -> New query`

## 3. Tek parca yerine kontrollu ilerle
Dosya `drop table if exists ...` ile basladigi icin bu script mevcut tablolari siler.
Canli verin onemliyse once yeni proje icin bos veritabaninda calistir.

## 4. Tavsiye edilen guvenli yol
Yeni Supabase project ac.
Sonra `new-panel-schema.sql` dosyasinin tamamini tek seferde bu yeni projede calistir.

## 5. Eski projede calisacaksan dikkat
Bu script su islemleri yapar:
- mevcut tablolari dusurur
- yeni tablo yapisini kurar
- indexleri ekler
- trigger ve helper function ekler
- RLS policy tanimlar
- ornek `firmalar` kaydi ekler

Yani eski veriyi korumaz.

## 6. SQL'i calistir
Tum dosyayi kopyalayip SQL Editor'de calistir.
Beklenen ana tablolar:
- `firmalar`
- `kullanici_profilleri`
- `projeler`
- `ekipler`
- `ekip_calisanlari`
- `puantaj_kayitlari`
- `gelir_kayitlari`
- `gider_kayitlari`
- `odeme_planlari`
- `kasa_hareketleri`
- `vergi_surecleri`
- `dokumanlar`
- `gorevler`
- `bildirim_kayitlari`
- `rapor_sablonlari`
- `aktivite_loglari`

## 7. Sonra storage policy uygula
Dosya:
`c:\etm-panel\database\storage-policies.sql`

Bunu da ayri query olarak calistir.

## 8. Gerekirse storage migration
Eski dosya yollarini tasiyacaksan:
- dokuman yolu notlari: `c:\etm-panel\docs\storage-migration.md`
- script: `c:\etm-panel\scripts\migrate-storage-paths.mjs`

## 9. Uygulama kontrolu
SQL tamamlaninca panelde su alanlari tekrar tam aktif olmali:
- `Kullanicilar`
- `Aktivite Logu`
- `Yapilacak Isler`
- `Genel Bakis` icindeki gorev ve kritik log kartlari

## 10. Son kontrol listesi
Panelde su sirayla test et:
1. Giris yap
2. `Kullanicilar` ekranini ac
3. Firma bilgisi kaydet
4. Proje ekle
5. Gorev ekle
6. Gelir veya gider ekle
7. Odeme plani olustur
8. Aktivite logunu kontrol et

## Ozet
En temiz yol yeni bir Supabase project acip bu iki SQL dosyasini uygulamak:
1. `new-panel-schema.sql`
2. `storage-policies.sql`
