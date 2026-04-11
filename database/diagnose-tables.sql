-- ============================================================
-- DIAGNOSTIC: Check existing tables and columns
-- ============================================================

SELECT 
    t.table_name,
    c.column_name,
    c.data_type
FROM 
    information_schema.tables t
    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE 
    t.table_schema = 'public'
    AND t.table_name IN ('odeme_plani', 'projeler_conf', 'bordro_donemleri', 'vergi_surecleri', 'sgk_entegrasyon', 'module_settings', 'workflow_rules')
ORDER BY 
    t.table_name, c.ordinal_position;
