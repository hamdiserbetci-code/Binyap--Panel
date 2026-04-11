# ETM Panel ERP v2 Gecis Plani

## Hedef
Mevcut yapıyı tek hamlede silmeden, Mikro ERP benzeri moduler `ERP v2`yi paralel kurup kontrollu gecis yapmak.

## Asama 1 - Altyapi
1. `database/erp-v2-mikro-schema.sql` Supabase SQL Editor'de calistirilir.
2. `src/modules/erp-v2/*/service.ts` dosyalarinda CRUD servisleri yazilir.
3. Yeni route grubu acilir: `src/app/erp-v2/*`.

## Asama 2 - Moduller (Oncelik)
1. Cari Yonetimi
2. Fatura / E-Fatura
3. Banka & Kasa / Finans Fisleri
4. Cek-Senet
5. Bordro / IK
6. Proje / Gorev
7. Vergi / SGK
8. Dashboard / Raporlar

## Asama 3 - Veri Gecisi
1. Eski tablolardan v2 tablolara migration scriptleri yazilir.
2. Cift yazim (old + v2) gecici sure acik tutulur.
3. Dogrulama raporlari ile bakiye/fatura mutabakati yapilir.

## Asama 4 - Cutover
1. UI'da v2 moduller default olur.
2. Eski moduller read-only moda alinir.
3. Sonraki sprintte eski tablolar kaldirilir.

## Risk Notu
Tam silme islemi, migration tamamlanmadan yapilmamali. En az 1 yedek + rollback plani olmadan cutover yapilmaz.
