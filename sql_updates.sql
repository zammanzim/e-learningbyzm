-- LAST UPDATE: Senin, 18 May 2026, 15.00
-- VERSION: v3.7
a
-- 1. Cleanup redundant system/admin menus (Only keep Class 2 as master)
DELETE FROM subjects_config 
WHERE class_id != 2 
AND menu_group IN (
    SELECT group_key FROM menu_groups 
    WHERE group_type IN ('system', 'admin')
);

DELETE FROM menu_groups 
WHERE class_id != 2 
AND group_type IN ('system', 'admin');

-- 2. Log Update (v3.7 - Admin Experience Update)
INSERT INTO app_updates (title, version, items, created_at)
VALUES (
    'Senin, 18 May 2026, 15.00',
    'v3.7',
    '[
        "Admin Sidebar: Menu System & Admin sekarang terpusat di Kelas 2 (Consistent Admin Menu).",
        "Database Cleanup: Menghapus data menu admin duplikat di kelas lain biar lebih rapi.",
        "System: Optimalisasi fetch sidebar data (Master Class Logic)."
    ]'::jsonb,
    NOW()
);
