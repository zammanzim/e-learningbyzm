-- Create nilai_config table for granular score settings
CREATE TABLE IF NOT EXISTS nilai_config (
    test_id TEXT NOT NULL,          -- psts, psasi, psat, etc
    class_id BIGINT NOT NULL,       -- link ke classes.id
    hidden_subjects JSONB DEFAULT '[]', -- array key mapel yang mau di-hide
    PRIMARY KEY (test_id, class_id),
    CONSTRAINT fk_nilai_config_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Add is_private column to score tables
ALTER TABLE nilai_psts ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE nilai_psasi ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE nilai_psat ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Create nilai_files table for storing original exam files (PDF, etc.)
CREATE TABLE IF NOT EXISTS nilai_files (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    test_id TEXT NOT NULL,
    class_id BIGINT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    label TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_nilai_files_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Create subject_teachers table for storing teacher info per subject
CREATE TABLE IF NOT EXISTS subject_teachers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_id TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    teacher_contact TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subject_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subject_teachers_select_all" ON subject_teachers FOR SELECT USING (true);
CREATE POLICY "subject_teachers_insert_all" ON subject_teachers FOR INSERT WITH CHECK (true);
CREATE POLICY "subject_teachers_update_all" ON subject_teachers FOR UPDATE USING (true);
CREATE POLICY "subject_teachers_delete_all" ON subject_teachers FOR DELETE USING (true);

-- RLS policies for nilai_files
ALTER TABLE nilai_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nilai_files_select_all" ON nilai_files FOR SELECT USING (true);
CREATE POLICY "nilai_files_insert_all" ON nilai_files FOR INSERT WITH CHECK (true);
CREATE POLICY "nilai_files_delete_all" ON nilai_files FOR DELETE USING (true);

-- FIX: Add missing foreign key relationship for Joins
-- Make avatars bucket public so getPublicUrl works without auth
UPDATE storage.buckets SET public = true WHERE name = 'avatars';

/*
ALTER TABLE simulation_progress
ADD CONSTRAINT fk_sim_progress_user
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

-- 5. Enable Realtime for Monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE simulation_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_progress;
*/
