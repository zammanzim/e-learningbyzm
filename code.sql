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

-- ============================================================
-- nilai_scores — unified table buat semua tipe nilai (psts, psasi, psat)
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_scores (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    scores_type TEXT NOT NULL,
    nama_siswa TEXT,
    pabp NUMERIC DEFAULT 0,
    pp NUMERIC DEFAULT 0,
    bindo NUMERIC DEFAULT 0,
    bing NUMERIC DEFAULT 0,
    mtk NUMERIC DEFAULT 0,
    sejarah NUMERIC DEFAULT 0,
    bjepang NUMERIC DEFAULT 0,
    bsunda NUMERIC DEFAULT 0,
    senibudaya NUMERIC DEFAULT 0,
    informatika NUMERIC DEFAULT 0,
    pjok NUMERIC DEFAULT 0,
    proipas NUMERIC DEFAULT 0,
    dasprog1 NUMERIC DEFAULT 0,
    dasprog2 NUMERIC DEFAULT 0,
    dasprog3 NUMERIC DEFAULT 0,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, scores_type)
);

ALTER TABLE nilai_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON nilai_scores FOR SELECT USING (true);
CREATE POLICY "auth_insert" ON nilai_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_update" ON nilai_scores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON nilai_scores FOR DELETE USING (true);

-- ============================================================
-- Migrasi data lama → nilai_scores
-- ── display_order buat urutin file nilai ──
ALTER TABLE nilai_files ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Jalanin bagian ini SETELAH CREATE TABLE diatas
-- ============================================================

-- ── 1. PSTS ─────────────────────────────────────────────────
INSERT INTO nilai_scores (user_id, scores_type, class_id, nama_siswa, is_private, pabp, pp, bindo, bing, mtk, sejarah, bjepang, bsunda, senibudaya, informatika, pjok, proipas, dasprog1, dasprog2, dasprog3)
SELECT
    u.id::text,
    'psts',
    n.class_id,
    COALESCE(u.nickname, u.full_name),
    bool_or(n.is_private),
    MAX(n.pabp), MAX(n.pp), MAX(n.bindo), MAX(n.bing), MAX(n.mtk), MAX(n.sejarah),
    MAX(n.bjepang), MAX(n.bsunda), MAX(n.senibudaya), MAX(n.informatika),
    MAX(n.pjok), MAX(n.proipas), MAX(n.dasprog1), MAX(n.dasprog2), MAX(n.dasprog3)
FROM nilai_psts n
JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
GROUP BY u.id, n.class_id, COALESCE(u.nickname, u.full_name)
ON CONFLICT (user_id, scores_type) DO NOTHING;

-- ── 2. PSASI ────────────────────────────────────────────────
INSERT INTO nilai_scores (user_id, scores_type, class_id, nama_siswa, is_private, pabp, pp, bindo, bing, mtk, sejarah, bjepang, bsunda, senibudaya, informatika, pjok, proipas, dasprog1, dasprog2, dasprog3)
SELECT
    u.id::text,
    'psasi',
    n.class_id,
    COALESCE(u.nickname, u.full_name),
    bool_or(n.is_private),
    MAX(n.pabp), MAX(n.pp), MAX(n.bindo), MAX(n.bing), MAX(n.mtk), MAX(n.sejarah),
    MAX(n.bjepang), MAX(n.bsunda), MAX(n.senibudaya), MAX(n.informatika),
    MAX(n.pjok), MAX(n.proipas), MAX(n.dasprog1), MAX(n.dasprog2), MAX(n.dasprog3)
FROM nilai_psasi n
JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
GROUP BY u.id, n.class_id, COALESCE(u.nickname, u.full_name)
ON CONFLICT (user_id, scores_type) DO NOTHING;

-- ── 3. PSAT — is_private ────────────────────────────────────
UPDATE nilai_scores ns
SET is_private = old.is_private
FROM (
    SELECT DISTINCT ON (u.id) u.id, n.is_private
    FROM nilai_psat n
    JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
) old
WHERE ns.user_id = old.id::text AND ns.scores_type = 'psat';

-- ── CEK YANG GAK KEMATCH ────────────────────────────────────
SELECT 'psts' AS tbl, n.nama_siswa FROM nilai_psts n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
    WHERE u.id IS NULL
UNION ALL
SELECT 'psasi', n.nama_siswa FROM nilai_psasi n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
    WHERE u.id IS NULL
UNION ALL
SELECT 'psat', n.nama_siswa FROM nilai_psat n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
    WHERE u.id IS NULL;
