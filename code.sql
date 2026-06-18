-- ============================================================
-- code.sql — jalanin sekali di Supabase SQL Editor
-- Idempotent: aman di-run berkali-kali (DROP + CREATE)
-- ============================================================

-- ── GUARD: biar aman di-run ulang ──
DROP POLICY IF EXISTS "public_read" ON task_submissions;
DROP POLICY IF EXISTS "public_insert" ON task_submissions;
DROP POLICY IF EXISTS "public_update" ON task_submissions;
DROP POLICY IF EXISTS "public_delete" ON task_submissions;
DROP POLICY IF EXISTS "public_read" ON page_errors;
DROP POLICY IF EXISTS "public_insert" ON page_errors;
DROP POLICY IF EXISTS "public_select" ON page_errors;
DROP POLICY IF EXISTS "public_delete" ON page_errors;
DROP POLICY IF EXISTS "public_read" ON nilai_scores;
DROP POLICY IF EXISTS "public_insert" ON nilai_scores;
DROP POLICY IF EXISTS "public_update" ON nilai_scores;
DROP POLICY IF EXISTS "public_delete" ON nilai_scores;
DROP POLICY IF EXISTS "public_read" ON nilai_config;
DROP POLICY IF EXISTS "public_insert" ON nilai_config;
DROP POLICY IF EXISTS "public_update" ON nilai_config;
DROP POLICY IF EXISTS "public_delete" ON nilai_config;
DROP POLICY IF EXISTS "public_read" ON nilai_files;
DROP POLICY IF EXISTS "public_insert" ON nilai_files;
DROP POLICY IF EXISTS "public_update" ON nilai_files;
DROP POLICY IF EXISTS "public_delete" ON nilai_files;
DROP POLICY IF EXISTS "public_read" ON nilai_psat;
DROP POLICY IF EXISTS "public_insert" ON nilai_psat;
DROP POLICY IF EXISTS "public_update" ON nilai_psat;
DROP POLICY IF EXISTS "public_delete" ON nilai_psat;
DROP POLICY IF EXISTS "public_read" ON simulation_questions;
DROP POLICY IF EXISTS "public_insert" ON simulation_questions;
DROP POLICY IF EXISTS "public_update" ON simulation_questions;
DROP POLICY IF EXISTS "public_delete" ON simulation_questions;

-- Buang policy lama pake auth.role() kalo masih ada
DROP POLICY IF EXISTS "auth_insert" ON task_submissions;
DROP POLICY IF EXISTS "auth_update" ON task_submissions;
DROP POLICY IF EXISTS "auth_delete" ON task_submissions;
DROP POLICY IF EXISTS "auth_insert" ON nilai_scores;
DROP POLICY IF EXISTS "auth_update" ON nilai_scores;
DROP POLICY IF EXISTS "auth_delete" ON nilai_scores;
DROP POLICY IF EXISTS "auth_select" ON page_errors;
DROP POLICY IF EXISTS "auth_delete" ON page_errors;

-- ============================================================
-- task_submissions — kirim-tugas
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
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS tugas_id BIGINT;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON task_submissions FOR SELECT   USING (true);
CREATE POLICY "public_insert" ON task_submissions FOR INSERT   WITH CHECK (true);
CREATE POLICY "public_update" ON task_submissions FOR UPDATE   USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON task_submissions FOR DELETE   USING (true);

-- ============================================================
-- Storage: transfer-files
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('transfer-files', 'transfer-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;
DROP POLICY IF EXISTS "auth_insert_transfer" ON storage.objects;
DROP POLICY IF EXISTS "auth_select_transfer" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_transfer" ON storage.objects;
CREATE POLICY "public_insert_transfer" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'transfer-files');
CREATE POLICY "public_select_transfer" ON storage.objects FOR SELECT   USING (bucket_id = 'transfer-files');
CREATE POLICY "public_delete_transfer" ON storage.objects FOR DELETE   USING (bucket_id = 'transfer-files');

-- ============================================================
-- nilai_scores — unified nilai (psts, psasi, psat)
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_scores (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    scores_type TEXT NOT NULL,
    nama_siswa TEXT,
    pabp NUMERIC DEFAULT 0, pp NUMERIC DEFAULT 0,
    bindo NUMERIC DEFAULT 0, bing NUMERIC DEFAULT 0,
    mtk NUMERIC DEFAULT 0, sejarah NUMERIC DEFAULT 0,
    bjepang NUMERIC DEFAULT 0, bsunda NUMERIC DEFAULT 0,
    senibudaya NUMERIC DEFAULT 0, informatika NUMERIC DEFAULT 0,
    pjok NUMERIC DEFAULT 0, proipas NUMERIC DEFAULT 0,
    dasprog1 NUMERIC DEFAULT 0, dasprog2 NUMERIC DEFAULT 0, dasprog3 NUMERIC DEFAULT 0,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, scores_type)
);
ALTER TABLE nilai_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON nilai_scores FOR SELECT USING (true);
CREATE POLICY "public_insert" ON nilai_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON nilai_scores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON nilai_scores FOR DELETE USING (true);

-- ============================================================
-- page_errors — 404 log
-- ============================================================
CREATE TABLE IF NOT EXISTS page_errors (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    url         TEXT NOT NULL,
    referrer    TEXT DEFAULT '',
    user_agent  TEXT DEFAULT '',
    user_id     TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE page_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert" ON page_errors FOR INSERT WITH CHECK (true);
CREATE POLICY "public_select" ON page_errors FOR SELECT   USING (true);
CREATE POLICY "public_delete" ON page_errors FOR DELETE   USING (true);

-- ============================================================
-- nilai_config — hidden subject per test/kelas
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_config (
    test_id         TEXT NOT NULL,
    class_id        BIGINT NOT NULL,
    hidden_subjects JSONB DEFAULT '[]'::jsonb,
    PRIMARY KEY (test_id, class_id)
);
ALTER TABLE nilai_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON nilai_config FOR SELECT USING (true);
CREATE POLICY "public_insert" ON nilai_config FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON nilai_config FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON nilai_config FOR DELETE USING (true);

-- ============================================================
-- nilai_files — file nilai asli (PDF/gambar)
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_files (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    test_id         TEXT NOT NULL,
    class_id        BIGINT NOT NULL,
    file_name       TEXT,
    file_url        TEXT,
    label           TEXT,
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nilai_files ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE nilai_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON nilai_files FOR SELECT USING (true);
CREATE POLICY "public_insert" ON nilai_files FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON nilai_files FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON nilai_files FOR DELETE USING (true);

-- ============================================================
-- nilai_psat — nilai lama (masih dipake buat migrasi)
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_psat (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    nama_siswa      TEXT,
    class_id        TEXT,
    is_private      BOOLEAN DEFAULT false,
    pabp NUMERIC DEFAULT 0, pp NUMERIC DEFAULT 0,
    bindo NUMERIC DEFAULT 0, bing NUMERIC DEFAULT 0,
    mtk NUMERIC DEFAULT 0, sejarah NUMERIC DEFAULT 0,
    bjepang NUMERIC DEFAULT 0, bsunda NUMERIC DEFAULT 0,
    senibudaya NUMERIC DEFAULT 0, informatika NUMERIC DEFAULT 0,
    pjok NUMERIC DEFAULT 0, proipas NUMERIC DEFAULT 0,
    dasprog1 NUMERIC DEFAULT 0, dasprog2 NUMERIC DEFAULT 0, dasprog3 NUMERIC DEFAULT 0
);
ALTER TABLE nilai_psat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON nilai_psat FOR SELECT USING (true);
CREATE POLICY "public_insert" ON nilai_psat FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON nilai_psat FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON nilai_psat FOR DELETE USING (true);

-- ============================================================
-- simulation_questions — soal quiz
-- ============================================================
CREATE TABLE IF NOT EXISTS simulation_questions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_id      TEXT NOT NULL,
    class_id        BIGINT DEFAULT 0,
    question        TEXT NOT NULL,
    options         JSONB DEFAULT '[]'::jsonb,
    answer          INTEGER DEFAULT 0,
    explanation     TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE simulation_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON simulation_questions FOR SELECT USING (true);
CREATE POLICY "public_insert" ON simulation_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON simulation_questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON simulation_questions FOR DELETE USING (true);

-- ============================================================
-- MIGRASI: nilai lama → nilai_scores
-- ── Jalanin kalo perlu, aman di-run ulang (ON CONFLICT DO NOTHING)
-- ============================================================

-- ============================================================
-- CEK SISWA YANG GA KEMATCH (debug)
-- ============================================================
SELECT 'psts' AS tbl, n.nama_siswa FROM nilai_psts n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
    WHERE u.id IS NULL
UNION ALL
SELECT 'psasi', n.nama_siswa FROM nilai_psasi n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
    WHERE u.id IS NULL
UNION ALL
SELECT 'psat', n.nama_siswa FROM nilai_psat n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.full_name))
    WHERE u.id IS NULL;
