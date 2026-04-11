-- ============================================================
-- DROP ALL TABLES (Fresh start)
-- ============================================================

DROP TABLE IF EXISTS workflow_rules CASCADE;
DROP TABLE IF EXISTS module_settings CASCADE;
DROP TABLE IF EXISTS sgk_entegrasyon CASCADE;
DROP TABLE IF EXISTS vergi_surecleri CASCADE;
DROP TABLE IF EXISTS bordro_donemleri CASCADE;
DROP TABLE IF EXISTS projeler_conf CASCADE;
DROP TABLE IF EXISTS odeme_plani CASCADE;

-- ============================================================
-- Confirm all dropped
-- ============================================================
SELECT 'All tables dropped successfully' AS status;
