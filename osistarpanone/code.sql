-- ============================================================
-- WEB OSIS TARPAN ONE — SCHEMA LENGKAP (RUN SEMUA SEKALI)
-- Jalankan SEMUA di Supabase SQL Editor (project OSIS).
-- Project pake localStorage custom auth (BUKAN Supabase Auth),
-- jadi RLS cuma anon key, bukan auth.role() = 'authenticated'.
--
-- Isi:
-- 1. Tabel lagu_requests  (request lagu radio)
-- 2. Tabel aspirasi       (kolom device_id)
-- 3. Tabel visitor        (pengunjung unik per device + masuk)
-- 4. Function limit + insert (SECURITY DEFINER, anti-bypass)
-- 5. Grant function ke anon
-- ============================================================

-- ============ 1. TABEL REQUEST LAGU ============
CREATE TABLE IF NOT EXISTS public.lagu_requests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id text NOT NULL DEFAULT '',
    judul text NOT NULL,
    penyanyi text NOT NULL,
    nama text NOT NULL DEFAULT 'Anonim',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lagu_requests_created ON public.lagu_requests (created_at DESC);

ALTER TABLE public.lagu_requests ENABLE ROW LEVEL SECURITY;

-- Anon boleh lihat playlist
DROP POLICY IF EXISTS "lagu_public_select" ON public.lagu_requests;
CREATE POLICY "lagu_public_select" ON public.lagu_requests
    FOR SELECT USING (true);

-- Insert langsung di-revoke: cuma lewat function kirim_lagu_terbatas
DROP POLICY IF EXISTS "lagu_public_insert" ON public.lagu_requests;

-- ============ 2. TABEL ASPIRASI (tambah kolom device_id) ============
ALTER TABLE public.aspirasi ADD COLUMN IF NOT EXISTS device_id text NOT NULL DEFAULT '';

-- Insert langsung di-revoke: cuma lewat function kirim_aspirasi_terbatas
DROP POLICY IF EXISTS "aspirasi_public_insert" ON public.aspirasi;

-- ============ 3. TABEL VISITOR (pengunjung unik per device) ============
CREATE TABLE IF NOT EXISTS public.visitor (
    device_id text PRIMARY KEY,
    jumlah integer NOT NULL DEFAULT 1,
    masuk timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.visitor ENABLE ROW LEVEL SECURITY;

-- Anon boleh lihat data (buat counter + list di popup)
DROP POLICY IF EXISTS "visitor_public_select" ON public.visitor;
CREATE POLICY "visitor_public_select" ON public.visitor
    FOR SELECT USING (true);

-- ============ 4. FUNCTION LIMIT + INSERT (SECURITY DEFINER) ============
-- SECURITY DEFINER: jalan sebagai pemilik tabel, bypass RLS, jadi
-- limit HARUS lewat function ini — ga bisa bypass dari client.

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
    INSERT INTO public.lagu_requests (device_id, judul, penyanyi, nama)
    VALUES (p_device_id, p_judul, p_penyanyi, p_nama);
    RETURN 'OK';
END $$;

-- Catat pengunjung: 1 device 1x per hari, return total kunjungan.
-- `masuk` = jam pertama buka hari ini (reset tiap ganti hari),
-- `last_seen` = terakhir aktif (di-update tiap load halaman).
CREATE OR REPLACE FUNCTION public.tambah_visitor_unik(p_device_id text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    total bigint;
BEGIN
    INSERT INTO public.visitor (device_id, jumlah, masuk, last_seen)
    VALUES (p_device_id, 1, now(), now())
    ON CONFLICT (device_id) DO UPDATE SET
        jumlah = CASE
            WHEN visitor.last_seen::date = CURRENT_DATE THEN visitor.jumlah
            ELSE visitor.jumlah + 1
        END,
        masuk = CASE
            WHEN visitor.last_seen::date = CURRENT_DATE THEN visitor.masuk
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

-- ============ 5. GRANT FUNCTION (anon) ============
REVOKE EXECUTE ON FUNCTION public.kirim_aspirasi_terbatas(text, text, text, text, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.kirim_lagu_terbatas(text, text, text, text, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.tambah_visitor_unik(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.hapus_aspirasi_own(text, bigint) FROM public;
REVOKE EXECUTE ON FUNCTION public.hapus_lagu_own(text, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.kirim_aspirasi_terbatas(text, text, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.kirim_lagu_terbatas(text, text, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.tambah_visitor_unik(text) TO anon;
GRANT EXECUTE ON FUNCTION public.hapus_aspirasi_own(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.hapus_lagu_own(text, bigint) TO anon;
