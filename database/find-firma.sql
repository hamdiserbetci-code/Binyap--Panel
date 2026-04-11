-- Find ETM firma_id
SELECT id, ad FROM firmalar WHERE ad ILIKE '%etm%' LIMIT 1;

-- If you want to see all firmalar:
-- SELECT id, ad FROM firmalar LIMIT 10;
