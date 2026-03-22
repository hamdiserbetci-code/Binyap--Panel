# Storage Gecis Notu

Yeni dosya yolu standardi:

- `firma_id/modul/kategori/timestamp_dosyaadi`

Hazirlanan dosyalar:

- `database/storage-policies.sql`
- `scripts/migrate-storage-paths.mjs`

Uygulama sirasi:

1. Once `database/new-panel-schema.sql` dosyasini Supabase SQL Editor'de calistir.
2. Ardindan `database/storage-policies.sql` dosyasini ayni ortamda uygula.
3. Sonra terminalde `SUPABASE_SERVICE_ROLE_KEY` tanimli sekilde `node scripts/migrate-storage-paths.mjs` komutunu calistir.
4. Migration bittikten sonra panelde dokuman indirme ve silme akisini test et.

Notlar:

- Migration script'i sadece eski `arsiv/...` ve `vergi/...` path'lerini tasir.
- Script once dosyayi indirir, yeni path'e yukler, tabloyu gunceller, sonra eski dosyayi siler.
- Service role anahtari gerekir; anon key ile calistirilmamali.
