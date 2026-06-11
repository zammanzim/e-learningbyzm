-- Exclude all_classes (id=0) from everywhere
UPDATE classes SET is_active = false WHERE id = 0;

-- Kolom is_task di subject_announcements
ALTER TABLE subject_announcements ADD COLUMN IF NOT EXISTS is_task BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_subject_announcements_is_task ON subject_announcements(is_task);

-- ============================================================
-- task_submissions — buat halaman kirim-tugas
-- ============================================================
CREATE TABLE IF NOT EXISTS task_submissions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     TEXT NOT NULL,
    user_name   TEXT,
    user_class  TEXT,
    teacher_name TEXT NOT NULL,
    file_url    TEXT,
    file_name   TEXT,
    link_url    TEXT,
    message     TEXT DEFAULT '',
    avatar_url  TEXT,
    tugas_id    BIGINT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_submissions_tugas_id ON task_submissions(tugas_id);

-- Fix: existing table mungkin belum punya kolom tugas_id
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS tugas_id BIGINT;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON task_submissions
    FOR SELECT USING (true);
CREATE POLICY "auth_insert" ON task_submissions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON task_submissions
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete" ON task_submissions
    FOR DELETE USING (auth.role() = 'authenticated');

-- Storage bucket untuk file tugas (public — ga pake Supabase Auth session)
INSERT INTO storage.buckets (id, name, public)
VALUES ('transfer-files', 'transfer-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- RLS policy tanpa auth.role() — project pake localStorage custom auth
DROP POLICY IF EXISTS "auth_insert_transfer" ON storage.objects;
DROP POLICY IF EXISTS "auth_select_transfer" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_transfer" ON storage.objects;

CREATE POLICY "public_insert_transfer" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'transfer-files');
CREATE POLICY "public_select_transfer" ON storage.objects
    FOR SELECT USING (bucket_id = 'transfer-files');
CREATE POLICY "public_delete_transfer" ON storage.objects
    FOR DELETE USING (bucket_id = 'transfer-files');
