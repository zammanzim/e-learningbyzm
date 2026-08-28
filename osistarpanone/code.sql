-- ============================================================
-- WEB OSIS TARPAN ONE â€” SCHEMA LENGKAP (RUN SEMUA SEKALI)
-- Jalankan SEMUA di Supabase SQL Editor (project OSIS).
-- Project pake localStorage custom auth (BUKAN Supabase Auth),
-- jadi RLS cuma anon key, bukan auth.role() = 'authenticated'.
--
-- Aman dijalanin ulang (idempotent): CREATE IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
--
-- Isi:
-- 1. Tabel lagu_requests  (request lagu radio)
-- 2. Tabel aspirasi       (kotak suara siswa)
-- 3. Tabel visitor        (kunjungan unik per perangkat + info device)
-- 4. Function limit + insert (SECURITY DEFINER, anti-bypass)
-- 5. Grant function ke anon
-- 6. Tabel gallery        (dokumentasi kegiatan: judul + deskripsi + foto)
-- 7. Storage policy       (folder gallery/ di bucket osis-foto)
-- 8. Site content         (teks editable hero/visi/misi/pembina/dll)
-- 9. Web foto + storage   (web/ & angkatan/ buat foto editable)
--
-- NOTE VISITOR:
-- - device_id = id perangkat MURNI (ga pernah berubah jadi key akun).
-- - name = nama pemilik kunjungan: kosong kalo anonim, nickname kalo
--   login guest, nama anggota kalo login OSIS. Sekali terisi, kunjungan
--   anonim berikutnya ga bakal ngehapus nama itu.
-- - Batas "hari" pake Asia/Jakarta (WIB), BUKAN UTC. Kalo pake UTC,
--   hari ganti jam 07:00 WIB -> kunjungan pagi kehitung dobel walau
--   perangkatnya sama.
-- ============================================================

-- ============ 1. TABEL REQUEST LAGU ============
CREATE TABLE IF NOT EXISTS public.lagu_requests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id text NOT NULL DEFAULT '',
    judul text NOT NULL,
    penyanyi text NOT NULL,
    pesan text NOT NULL DEFAULT '',
    nama text NOT NULL DEFAULT 'Anonim',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lagu_requests ADD COLUMN IF NOT EXISTS pesan text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_lagu_requests_created ON public.lagu_requests (created_at DESC);

ALTER TABLE public.lagu_requests ENABLE ROW LEVEL SECURITY;

-- Anon boleh lihat playlist
DROP POLICY IF EXISTS "lagu_public_select" ON public.lagu_requests;
CREATE POLICY "lagu_public_select" ON public.lagu_requests
    FOR SELECT USING (true);

-- Insert langsung di-revoke: cuma lewat function kirim_lagu_terbatas
DROP POLICY IF EXISTS "lagu_public_insert" ON public.lagu_requests;

-- ============ 2. TABEL ASPIRASI ============
CREATE TABLE IF NOT EXISTS public.aspirasi (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id text NOT NULL DEFAULT '',
    nama text NOT NULL DEFAULT 'Anonim',
    kelas text NOT NULL DEFAULT '-',
    isi text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aspirasi_created ON public.aspirasi (created_at DESC);

ALTER TABLE public.aspirasi ADD COLUMN IF NOT EXISTS device_id text NOT NULL DEFAULT '';

ALTER TABLE public.aspirasi ENABLE ROW LEVEL SECURITY;

-- Anon boleh lihat suara yang masuk (list di web)
DROP POLICY IF EXISTS "aspirasi_public_select" ON public.aspirasi;
CREATE POLICY "aspirasi_public_select" ON public.aspirasi
    FOR SELECT USING (true);

-- Insert/update/delete langsung di-revoke: cuma lewat function
-- kirim_aspirasi_terbatas & hapus_aspirasi_own (SECURITY DEFINER)
DROP POLICY IF EXISTS "aspirasi_public_insert" ON public.aspirasi;

-- ============ 3. TABEL VISITOR (kunjungan unik per perangkat) ============
CREATE TABLE IF NOT EXISTS public.visitor (
    device_id text PRIMARY KEY,
    jumlah integer NOT NULL DEFAULT 1,
    name text NOT NULL DEFAULT '',
    label text NOT NULL DEFAULT '',
    masuk timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now()
);

-- Nama pemilik kunjungan (anonim = kosong, guest = nickname, OSIS = nama anggota)
ALTER TABLE public.visitor ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
-- Kolom nama perangkat (dari user-agent) buat list di popup
ALTER TABLE public.visitor ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '';
-- Info perangkat lengkap: tipe, user-agent mentah, resolusi layar
ALTER TABLE public.visitor ADD COLUMN IF NOT EXISTS tipe text NOT NULL DEFAULT '';
ALTER TABLE public.visitor ADD COLUMN IF NOT EXISTS user_agent text NOT NULL DEFAULT '';
ALTER TABLE public.visitor ADD COLUMN IF NOT EXISTS resolusi text NOT NULL DEFAULT '';

ALTER TABLE public.visitor ENABLE ROW LEVEL SECURITY;

-- Anon boleh lihat data (buat counter + list di popup)
DROP POLICY IF EXISTS "visitor_public_select" ON public.visitor;
CREATE POLICY "visitor_public_select" ON public.visitor
    FOR SELECT USING (true);

-- ============ 4. FUNCTION LIMIT + INSERT (SECURITY DEFINER) ============
-- SECURITY DEFINER: jalan sebagai pemilik tabel, bypass RLS, jadi
-- limit HARUS lewat function ini â€” ga bisa bypass dari client.

-- Kirim aspirasi: maks 3 per device per hari
CREATE OR REPLACE FUNCTION public.kirim_aspirasi_terbatas(
    p_device_id text,
    p_nama text,
    p_kelas text,
    p_isi text,
    p_batas_harian integer DEFAULT 3
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    n integer;
BEGIN
    IF p_device_id IS NULL OR p_device_id = '' THEN
        RETURN 'ERR_NO_DEVICE';
    END IF;
    SELECT count(*) INTO n FROM public.aspirasi
    WHERE device_id = p_device_id AND created_at::date = CURRENT_DATE;
    IF n >= p_batas_harian THEN
        RETURN 'ERR_LIMIT';
    END IF;
    INSERT INTO public.aspirasi (device_id, nama, kelas, isi)
    VALUES (p_device_id, p_nama, p_kelas, p_isi);
    RETURN 'OK';
END $$;

-- Kirim request lagu: maks 5 per device per hari
CREATE OR REPLACE FUNCTION public.kirim_lagu_terbatas(
    p_device_id text,
    p_judul text,
    p_penyanyi text,
    p_pesan text,
    p_nama text,
    p_batas_harian integer DEFAULT 5
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    n integer;
BEGIN
    IF p_device_id IS NULL OR p_device_id = '' THEN
        RETURN 'ERR_NO_DEVICE';
    END IF;
    SELECT count(*) INTO n FROM public.lagu_requests
    WHERE device_id = p_device_id AND created_at::date = CURRENT_DATE;
    IF n >= p_batas_harian THEN
        RETURN 'ERR_LIMIT';
    END IF;
    INSERT INTO public.lagu_requests (device_id, judul, penyanyi, pesan, nama)
    VALUES (p_device_id, p_judul, p_penyanyi, COALESCE(NULLIF(btrim(p_pesan), ''), ''), p_nama);
    RETURN 'OK';
END $$;

DROP FUNCTION IF EXISTS public.kirim_lagu_terbatas(text, text, text, text, integer);

-- Hapus function visitor signature lama biar ga nyangkut overload
DROP FUNCTION IF EXISTS public.tambah_visitor_unik(text);
DROP FUNCTION IF EXISTS public.tambah_visitor_unik(text, text);
DROP FUNCTION IF EXISTS public.tambah_visitor_unik(text, text, text, text, text);

-- Catat kunjungan unik per perangkat: jumlah nambah 1x per hari WIB.
-- `masuk` = jam pertama online hari ini (reset tiap ganti hari WIB),
-- `last_seen` = terakhir aktif (di-update tiap load halaman).
-- p_key      : device id perangkat (selalu device id, bukan key akun)
-- p_label    : nama perangkat dari user-agent (iPhone, model Android, dll)
-- p_tipe     : Mobile / Tablet / Desktop
-- p_ua       : user-agent mentah
-- p_resolusi : resolusi layar (cth: 360x800)
-- p_name     : nama pemilik (nickname guest / nama anggota OSIS, kosong = anonim)
CREATE OR REPLACE FUNCTION public.tambah_visitor_unik(
    p_key text,
    p_label text DEFAULT '',
    p_tipe text DEFAULT '',
    p_ua text DEFAULT '',
    p_resolusi text DEFAULT '',
    p_name text DEFAULT ''
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    total bigint;
    hari_wib date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
    IF p_key IS NULL OR p_key = '' THEN
        RETURN 0;
    END IF;

    INSERT INTO public.visitor (device_id, jumlah, name, label, tipe, user_agent, resolusi, masuk, last_seen)
    VALUES (
        p_key, 1,
        COALESCE(NULLIF(p_name, ''), ''),
        COALESCE(NULLIF(p_label, ''), 'Unknown'),
        COALESCE(NULLIF(p_tipe, ''), ''),
        COALESCE(NULLIF(p_ua, ''), ''),
        COALESCE(NULLIF(p_resolusi, ''), ''),
        now(), now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
        jumlah = CASE
            WHEN (visitor.last_seen AT TIME ZONE 'Asia/Jakarta')::date = hari_wib
                THEN visitor.jumlah
            ELSE visitor.jumlah + 1
        END,
        -- Name sekali terisi ga bakal ketimpa kunjungan anonim
        name = CASE
            WHEN COALESCE(NULLIF(p_name, ''), '') <> '' THEN p_name
            ELSE visitor.name
        END,
        label = CASE
            WHEN COALESCE(NULLIF(p_label, ''), '') <> '' THEN p_label
            ELSE visitor.label
        END,
        tipe = CASE
            WHEN COALESCE(NULLIF(p_tipe, ''), '') <> '' THEN p_tipe
            ELSE visitor.tipe
        END,
        user_agent = CASE
            WHEN COALESCE(NULLIF(p_ua, ''), '') <> '' THEN p_ua
            ELSE visitor.user_agent
        END,
        resolusi = CASE
            WHEN COALESCE(NULLIF(p_resolusi, ''), '') <> '' THEN p_resolusi
            ELSE visitor.resolusi
        END,
        masuk = CASE
            WHEN (visitor.last_seen AT TIME ZONE 'Asia/Jakarta')::date = hari_wib
                THEN visitor.masuk
            ELSE now()
        END,
        last_seen = now();

    SELECT COALESCE(SUM(jumlah), 0) INTO total FROM public.visitor;
    RETURN total;
END $$;

-- Hapus aspirasi milik sendiri, cuma bisa dalam 1 jam pertama
CREATE OR REPLACE FUNCTION public.hapus_aspirasi_own(
    p_device_id text,
    p_id bigint
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF p_device_id IS NULL OR p_device_id = '' THEN
        RETURN 'ERR_NO_DEVICE';
    END IF;
    DELETE FROM public.aspirasi
    WHERE id = p_id
      AND device_id = p_device_id
      AND created_at > now() - interval '1 hour';
    IF FOUND THEN
        RETURN 'OK';
    END IF;
    PERFORM 1 FROM public.aspirasi WHERE id = p_id;
    IF FOUND THEN
        RETURN 'ERR_EXPIRED';
    END IF;
    RETURN 'ERR_FORBIDDEN';
END $$;

-- Hapus request lagu milik sendiri, cuma bisa dalam 1 jam pertama
CREATE OR REPLACE FUNCTION public.hapus_lagu_own(
    p_device_id text,
    p_id bigint
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF p_device_id IS NULL OR p_device_id = '' THEN
        RETURN 'ERR_NO_DEVICE';
    END IF;
    DELETE FROM public.lagu_requests
    WHERE id = p_id
      AND device_id = p_device_id
      AND created_at > now() - interval '1 hour';
    IF FOUND THEN
        RETURN 'OK';
    END IF;
    PERFORM 1 FROM public.lagu_requests WHERE id = p_id;
    IF FOUND THEN
        RETURN 'ERR_EXPIRED';
    END IF;
    RETURN 'ERR_FORBIDDEN';
END $$;

-- Hapus aspirasi oleh OSIS (boleh hapus punya siapa aja, validasi id OSIS)
CREATE OR REPLACE FUNCTION public.hapus_aspirasi_osis(
    p_user_id bigint,
    p_id bigint
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.osis_users WHERE id = p_user_id) THEN
        RETURN 'ERR_NO_AUTH';
    END IF;
    DELETE FROM public.aspirasi WHERE id = p_id;
    IF FOUND THEN RETURN 'OK'; END IF;
    RETURN 'ERR_NOT_FOUND';
END $$;

-- Hapus request lagu oleh OSIS (boleh hapus punya siapa aja)
CREATE OR REPLACE FUNCTION public.hapus_lagu_osis(
    p_user_id bigint,
    p_id bigint
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.osis_users WHERE id = p_user_id) THEN
        RETURN 'ERR_NO_AUTH';
    END IF;
    DELETE FROM public.lagu_requests WHERE id = p_id;
    IF FOUND THEN RETURN 'OK'; END IF;
    RETURN 'ERR_NOT_FOUND';
END $$;

-- ============ 5. GRANT FUNCTION (anon) ============
REVOKE EXECUTE ON FUNCTION public.kirim_aspirasi_terbatas(text, text, text, text, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.kirim_lagu_terbatas(text, text, text, text, text, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.tambah_visitor_unik(text, text, text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.hapus_aspirasi_own(text, bigint) FROM public;
REVOKE EXECUTE ON FUNCTION public.hapus_lagu_own(text, bigint) FROM public;
REVOKE EXECUTE ON FUNCTION public.hapus_aspirasi_osis(bigint, bigint) FROM public;
REVOKE EXECUTE ON FUNCTION public.hapus_lagu_osis(bigint, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.kirim_aspirasi_terbatas(text, text, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.kirim_lagu_terbatas(text, text, text, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.tambah_visitor_unik(text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.hapus_aspirasi_own(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.hapus_lagu_own(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.hapus_aspirasi_osis(bigint, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.hapus_lagu_osis(bigint, bigint) TO anon;

-- ============ 6. TABEL GALLERY (dokumentasi kegiatan) ============
-- Satu baris = satu kegiatan. `fotos` = jsonb array path foto di bucket.
-- Cuma akun OSIS (id ada di osis_users) boleh nambah/hapus —
-- divalidasi di function, bukan di client.
CREATE TABLE IF NOT EXISTS public.gallery (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    judul text NOT NULL,
    fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_by bigint,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Subjudul / deskripsi singkat kegiatan
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS deskripsi text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_gallery_created ON public.gallery (created_at DESC);

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;

-- Publik boleh lihat galeri
DROP POLICY IF EXISTS "gallery_public_select" ON public.gallery;
CREATE POLICY "gallery_public_select" ON public.gallery
    FOR SELECT USING (true);

-- Insert/delete langsung di-revoke: cuma lewat function (validasi akun)
DROP POLICY IF EXISTS "gallery_public_insert" ON public.gallery;

-- Buat kegiatan baru, BALIKIN ID barunya (>0). Kode error negatif:
-- -1 bukan akun OSIS, -2 judul kosong, -3 foto kosong.
CREATE OR REPLACE FUNCTION public.buat_gallery(
    p_user_id bigint,
    p_judul text,
    p_deskripsi text,
    p_fotos jsonb
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    new_id bigint;
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM public.osis_users WHERE id = p_user_id) THEN
        RETURN -1;
    END IF;
    p_judul := COALESCE(NULLIF(btrim(p_judul), ''), '');
    IF p_judul = '' THEN
        RETURN -2;
    END IF;
    IF p_fotos IS NULL OR jsonb_typeof(p_fotos) <> 'array'
       OR jsonb_array_length(p_fotos) = 0 THEN
        RETURN -3;
    END IF;

    INSERT INTO public.gallery (judul, deskripsi, fotos, created_by)
    VALUES (left(p_judul, 80), left(COALESCE(NULLIF(btrim(p_deskripsi), ''), ''), 140), p_fotos, p_user_id)
    RETURNING id INTO new_id;
    RETURN new_id;
END $$;

-- Hapus signature lama biar ga nyangkut overload
DROP FUNCTION IF EXISTS public.buat_gallery(bigint, text, text, jsonb);
DROP FUNCTION IF EXISTS public.buat_gallery(bigint, text, jsonb);
DROP FUNCTION IF EXISTS public.buat_gallery(bigint, text);

-- Tambah 1 foto ke kegiatan yang udah ada (append ke array fotos)
CREATE OR REPLACE FUNCTION public.galeri_add_foto(
    p_user_id bigint,
    p_id bigint,
    p_path text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM public.osis_users WHERE id = p_user_id) THEN
        RETURN 'ERR_NO_AUTH';
    END IF;
    IF p_path IS NULL OR btrim(p_path) = '' THEN
        RETURN 'ERR_NO_FOTO';
    END IF;

    UPDATE public.gallery
    SET fotos = COALESCE(fotos, '[]'::jsonb) || to_jsonb(left(p_path, 300))
    WHERE id = p_id;
    IF FOUND THEN
        RETURN 'OK';
    END IF;
    RETURN 'ERR_NOT_FOUND';
END $$;

-- Update judul & subjudul kegiatan (dipanggil pas selesai ngetik)
CREATE OR REPLACE FUNCTION public.galeri_update_meta(
    p_user_id bigint,
    p_id bigint,
    p_judul text,
    p_deskripsi text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    judul_akhir text;
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM public.osis_users WHERE id = p_user_id) THEN
        RETURN 'ERR_NO_AUTH';
    END IF;
    judul_akhir := COALESCE(NULLIF(btrim(p_judul), ''), 'Tanpa Judul');

    UPDATE public.gallery
    SET judul = left(judul_akhir, 80),
        deskripsi = left(COALESCE(NULLIF(btrim(p_deskripsi), ''), ''), 140)
    WHERE id = p_id;
    IF FOUND THEN
        RETURN 'OK';
    END IF;
    RETURN 'ERR_NOT_FOUND';
END $$;

-- Hapus kegiatan galeri (khusus akun OSIS)
CREATE OR REPLACE FUNCTION public.hapus_gallery(
    p_user_id bigint,
    p_id bigint
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM public.osis_users WHERE id = p_user_id) THEN
        RETURN 'ERR_NO_AUTH';
    END IF;
    DELETE FROM public.gallery WHERE id = p_id;
    IF FOUND THEN
        RETURN 'OK';
    END IF;
    RETURN 'ERR_NOT_FOUND';
END $$;

REVOKE EXECUTE ON FUNCTION public.buat_gallery(bigint, text, text, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.galeri_add_foto(bigint, bigint, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.galeri_update_meta(bigint, bigint, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.hapus_gallery(bigint, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.buat_gallery(bigint, text, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.galeri_add_foto(bigint, bigint, text) TO anon;
GRANT EXECUTE ON FUNCTION public.galeri_update_meta(bigint, bigint, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.hapus_gallery(bigint, bigint) TO anon;

-- ============ 7. STORAGE — FOLDER GALLERY DI BUCKET osis-foto ============
-- Bucket osis-foto pake policy per folder. Folder gallery/ harus
-- diizinin khusus biar upload & hapus foto galeri bisa dari client.
DROP POLICY IF EXISTS "osis_foto_gallery_select" ON storage.objects;
CREATE POLICY "osis_foto_gallery_select" ON storage.objects
    FOR SELECT TO anon
    USING (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'gallery');

DROP POLICY IF EXISTS "osis_foto_gallery_insert" ON storage.objects;
CREATE POLICY "osis_foto_gallery_insert" ON storage.objects
    FOR INSERT TO anon
    WITH CHECK (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'gallery');

DROP POLICY IF EXISTS "osis_foto_gallery_delete" ON storage.objects;
CREATE POLICY "osis_foto_gallery_delete" ON storage.objects
    FOR DELETE TO anon
    USING (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'gallery');

-- ============ 8. SITE CONTENT — TEKS EDITABLE (HERO/VISI/MISI/PEMBINA/DLL) ============
-- Satu baris per kunci (cth: hero_badge, visi_text, misi_1_title ...).
-- Cuma akun OSIS boleh nulis, baca bebas.
CREATE TABLE IF NOT EXISTS public.site_content (
    kunci text PRIMARY KEY,
    nilai text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_public_select" ON public.site_content;
CREATE POLICY "site_content_public_select" ON public.site_content
    FOR SELECT USING (true);

-- Insert/update langsung di-revoke: cuma lewat function save_site_text
DROP POLICY IF EXISTS "site_content_public_insert" ON public.site_content;

CREATE OR REPLACE FUNCTION public.save_site_text(
    p_user_id bigint,
    p_key text,
    p_value text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS
        (SELECT 1 FROM public.osis_users WHERE id = p_user_id) THEN
        RETURN 'ERR_NO_AUTH';
    END IF;
    p_key := COALESCE(NULLIF(btrim(p_key), ''), '');
    IF p_key = '' THEN
        RETURN 'ERR_NO_KEY';
    END IF;
    -- batasi panjang biar ga di-abuse, tapi longgar (up to 800 char)
    p_value := COALESCE(p_value, '');
    IF char_length(p_value) > 2000 THEN
        p_value := left(p_value, 2000);
    END IF;

    INSERT INTO public.site_content (kunci, nilai, updated_at, updated_by)
    VALUES (p_key, p_value, now(), p_user_id)
    ON CONFLICT (kunci) DO UPDATE SET
        nilai = EXCLUDED.nilai,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
    RETURN 'OK';
END $$;

REVOKE EXECUTE ON FUNCTION public.save_site_text(bigint, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.save_site_text(bigint, text, text) TO anon;

-- ============ 9. WEB_FOTO + STORAGE WEB/ANGKATAN (buat foto editable) ============
-- Foto prestasi/kegiatan/hero/pembina pake tabel web_foto + bucket osis-foto/web/
-- dan foto angkatan pake bucket angkatan/. Kasih policy biar anon (OSIS
-- client) bisa upsert — validasi OSIS Tetep di client (SiteEdit cek mode).
CREATE TABLE IF NOT EXISTS public.web_foto (
    kunci text PRIMARY KEY,
    path text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.web_foto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_foto_public_select" ON public.web_foto;
CREATE POLICY "web_foto_public_select" ON public.web_foto
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "web_foto_public_insert" ON public.web_foto;
CREATE POLICY "web_foto_public_insert" ON public.web_foto
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "web_foto_public_update" ON public.web_foto;
CREATE POLICY "web_foto_public_update" ON public.web_foto
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "web_foto_public_delete" ON public.web_foto;
CREATE POLICY "web_foto_public_delete" ON public.web_foto
    FOR DELETE USING (true);

-- Storage: folder web/
DROP POLICY IF EXISTS "osis_foto_web_select" ON storage.objects;
CREATE POLICY "osis_foto_web_select" ON storage.objects
    FOR SELECT TO anon USING (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'web');
DROP POLICY IF EXISTS "osis_foto_web_insert" ON storage.objects;
CREATE POLICY "osis_foto_web_insert" ON storage.objects
    FOR INSERT TO anon WITH CHECK (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'web');
DROP POLICY IF EXISTS "osis_foto_web_delete" ON storage.objects;
CREATE POLICY "osis_foto_web_delete" ON storage.objects
    FOR DELETE TO anon USING (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'web');

-- Storage: folder angkatan/ (foto jejak organisasi)
DROP POLICY IF EXISTS "osis_foto_angkatan_select" ON storage.objects;
CREATE POLICY "osis_foto_angkatan_select" ON storage.objects
    FOR SELECT TO anon USING (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'angkatan');
DROP POLICY IF EXISTS "osis_foto_angkatan_insert" ON storage.objects;
CREATE POLICY "osis_foto_angkatan_insert" ON storage.objects
    FOR INSERT TO anon WITH CHECK (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'angkatan');
DROP POLICY IF EXISTS "osis_foto_angkatan_delete" ON storage.objects;
CREATE POLICY "osis_foto_angkatan_delete" ON storage.objects
    FOR DELETE TO anon USING (bucket_id = 'osis-foto' AND (storage.foldername(name))[1] = 'angkatan');

-- Bersihin sisa objek eksperimen sebelumnya (ganti desain)
DROP TABLE IF EXISTS public.guests CASCADE;
DROP FUNCTION IF EXISTS public.register_guest(text, text);
DROP TABLE IF EXISTS public.tamu CASCADE;
DROP FUNCTION IF EXISTS public.daftar_tamu(text, text);
