# ETM Panel Yeni Kurulum Yol Haritasi

Bu dokuman, sifirdan kurulacak yeni ETM panelinin modullerini ve veri akisini netlestirmek icin hazirlandi.

## Ana Hedef

Tek bir panel icinden su surecleri yonetmek:

- Proje bazli gelir ve gider takibi
- Ekip bazli puantaj takibi
- Odeme plani ve tahsilat kontrolu
- Kasa ve banka hareketleri
- Vergi ve SGK surecleri
- Tum islemlere bagli dokuman arsivi
- PDF ve Excel cikti altyapisi
- Gorev, hatirlatma ve bildirim merkezi

## Modul Yapisi

### 1. Projeler

- Her kayit bir projeye baglanir.
- Proje kartinda butce, lokasyon, sure, aktif durum ve aciklama tutulur.
- Ekipler, gelir, gider ve dokumanlar proje uzerinden filtrelenir.

### 2. Gelir / Gider

- Gelirlerde hakedis, fatura, tahsilat ve kesinti mantigi bulunur.
- Giderlerde kategori, tedarikci, vade ve odeme durumu tutulur.
- Her iki tabloda da proje zorunludur.

### 3. Puantaj

- Ekip bazli calisir.
- Istenirse calisan detayi ile derinlestirilir.
- Gunluk kayitlardan aylik ozet ve maliyet ciktilari uretilir.

### 4. Odeme Plani

- Gelir veya gider kaydina baglanabilir.
- Manuel planlanan odemeleri de destekler.
- Vade, gerceklesen tutar ve durum mantigi bulunur.

### 5. Kasa

- Nakit, banka ve avans hareketleri ayni tabloda tutulur.
- Gelir ve gider kayitlariyla bag kurulabilir.
- Gun sonu bakiye mantigi raporla hesaplanir.

### 6. Vergi ve SGK

- Surec tipleri:
- `kdv`
- `muhtasar_sgk`
- `gecici_vergi`
- `kurumlar_vergisi`
- `edefter`
- Her surec icin donem, son tarih, durum, tutar ve sorumlu alanlari bulunur.

### 7. Dokumanlar

- Her dosya bir modul ve kategori ile etiketlenir.
- Istenirse bir kayda dogrudan baglanir.
- PDF, Excel, gorsel ve zip yuklenebilir.

### 8. Raporlar

- Gelir / gider ozetleri
- Proje maliyet analizi
- Ekip puantaj toplamlari
- Vergi surec listeleri
- Kasa hareket dokumu

### 9. Gorevler ve Bildirimler

- Gorevlerde tarih, saat ve erteleme alanlari bulunur.
- Merkezi bildirim paneli gorev, odeme ve vergi kayitlarini tek yerde toplar.
- `bildirim_kayitlari` tablosu ile okundu ve ertelendi durumu saklanir.

## Durum Standartlari

Tum sureclerde ayni durum dili kullanilmasi onerilir:

- `taslak`
- `islemde`
- `onay_bekliyor`
- `tamamlandi`
- `iptal`

Finans tarafinda ek durumlar:

- `bekleniyor`
- `kismi`
- `odendi`
- `gecikti`

## Ilk Teknik Faz

1. `database/new-panel-schema.sql` dosyasindaki yeni tablo setini Supabase'e uygulamak.
2. `src/app/page.tsx` taslagindaki modulleri gercek alt sayfalara tasimak.
3. Her modul icin liste + form + detay iskeletini kurmak.
4. Dokuman yukleme ve cikti servislerini ortak util katmanina almak.
5. Bildirim tablosunu ve okundu ertele akisini aktif etmek.

## Sonraki Adim Onerisi

En dogru sira su olur:

1. Veritabanini yeni SQL ile sifirla.
2. Bildirim tablosunu da ayni kurulumda aktif et.
3. Sol menuyu yeni modullerle veri bazli kullan.
4. Sonraki fazda kullanici bazli yetki ve rol yapisini ekle.
## Guvenlik Notu

- `database/new-panel-schema.sql` icinde firma ve rol bazli RLS politikalari tanimlandi.
- Ilk profil olustugunda rol atamasi veritabanindaki trigger ile yapilir.
- Storage tarafinda tam firma izolasyonu icin dosya yollarini `firma_id/...` formuna tasimak sonraki adimda tamamlanmalidir.
## Aktivite Logu Notu

- `aktivite_loglari` tablosu oturum ve yonetsel hareketleri tutar.
- Ilk fazda oturum acma, oturum kapama ve kullanici profili degisiklikleri kayit altindadir.
- Modul rapor yetkisi olan roller loglari okuyabilir; silme ve duzenleme yonetici ile sinirlidir.
