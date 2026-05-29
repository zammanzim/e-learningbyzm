-- COPY & RUN THIS IN SUPABASE SQL EDITOR --

-- 1. Tambah kolom mode di daily_config
ALTER TABLE daily_config ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'regular';
UPDATE daily_config SET mode = 'custom' WHERE is_custom = true;

-- 2. Tambah kolom type di daily_schedules
ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'regular';
UPDATE daily_schedules SET type = 'custom' WHERE day_name = 'CUSTOM';

-- 3. Update Unique Constraint
-- Hapus constraint lama (nama default biasanya daily_schedules_class_id_day_name_key)
ALTER TABLE daily_schedules DROP CONSTRAINT IF EXISTS daily_schedules_class_id_day_name_key;

-- Tambah constraint baru yang support multi-mode
ALTER TABLE daily_schedules ADD CONSTRAINT daily_schedules_class_id_day_name_type_key UNIQUE (class_id, day_name, type);

-- 3. Support Custom Kisi-kisi Range
ALTER TABLE daily_config ADD COLUMN IF NOT EXISTS kisi_days JSONB DEFAULT '["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]'::jsonb;

-- 4. Log Update (v3.9 - Custom Kisi-kisi Range)
INSERT INTO app_updates (title, version, items, created_at)
VALUES (
    'Jumat, 29 May 2026, 12.00',
    'v3.9',
    '["Daily Card: Admin sekarang bisa memilih rentang hari khusus untuk halaman Kisi-kisi (misal: Senin-Kamis doang)."]'::jsonb,
    NOW()
);
