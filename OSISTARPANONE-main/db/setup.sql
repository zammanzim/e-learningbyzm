-- ============================================================
-- SETUP DATABASE OSIS TARPAN ONE (Supabase)
-- Cara pakai: buka Supabase Dashboard -> SQL Editor -> New Query
-- -> tempel SEMUA isi file setup.sql ini -> Run.
-- ============================================================

-- ============================================================
-- 1. TABEL PIMPINAN (Ketua & Wakil per tahun)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pimpinan (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tahun integer NOT NULL UNIQUE,
    ketua_nama text NOT NULL,
    ketua_foto text NOT NULL DEFAULT '',
    wakil_nama text NOT NULL DEFAULT '',
    wakil_foto text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pimpinan ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. TABEL ANGGOTA (Nama & jabatan per tahun)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anggota (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tahun integer NOT NULL,
    nama text NOT NULL,
    jabatan text NOT NULL,
    urutan integer NOT NULL DEFAULT 15,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anggota_tahun ON public.anggota (tahun, urutan);

ALTER TABLE public.anggota ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. TABEL SEKBID (Seksi Bidang & BPH)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sekbid (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kategori text NOT NULL CHECK (kategori IN ('BPH', 'SEKBID')),
    nama text NOT NULL,
    icon text NOT NULL DEFAULT '',
    deskripsi text NOT NULL DEFAULT '',
    urutan integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sekbid ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. TABEL ASPIRASI (Kotak suara siswa)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aspirasi (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nama text NOT NULL DEFAULT 'Anonim',
    kelas text NOT NULL DEFAULT '-',
    isi text NOT NULL,
    dibaca boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aspirasi_dibaca ON public.aspirasi (dibaca, created_at DESC);

ALTER TABLE public.aspirasi ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. TABEL PENGATURAN (Sakelar buka/tutup aspirasi)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pengaturan (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kunci text NOT NULL UNIQUE,
    nilai text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pengaturan ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. BUCKET STORAGE untuk foto (public)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('osis-foto', 'osis-foto', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. ROW LEVEL SECURITY (KUNCI KEAMANAN WEB)
--    - Semua tabel tampilan: anon hanya boleh SELECT (baca)
--    - aspirasi: anon hanya boleh INSERT (kirim), tidak bisa baca
-- ============================================================
DROP POLICY IF EXISTS "pimpinan_public_select" ON public.pimpinan;
CREATE POLICY "pimpinan_public_select" ON public.pimpinan
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "anggota_public_select" ON public.anggota;
CREATE POLICY "anggota_public_select" ON public.anggota
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "sekbid_public_select" ON public.sekbid;
CREATE POLICY "sekbid_public_select" ON public.sekbid
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "pengaturan_public_select" ON public.pengaturan;
CREATE POLICY "pengaturan_public_select" ON public.pengaturan
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "aspirasi_public_insert" ON public.aspirasi;
CREATE POLICY "aspirasi_public_insert" ON public.aspirasi
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- 8. SEED DATA (data asli dari file JS lama)
-- ============================================================
TRUNCATE TABLE public.anggota RESTART IDENTITY;
TRUNCATE TABLE public.pimpinan RESTART IDENTITY;
TRUNCATE TABLE public.sekbid RESTART IDENTITY;
TRUNCATE TABLE public.pengaturan RESTART IDENTITY;

-- ============================================================
-- SEED DATA OSIS TARPAN ONE (auto-generated dari file JS lama)
-- ============================================================

-- ANGGOTA (221 baris)
INSERT INTO anggota (tahun, nama, jabatan, urutan) VALUES
  (2010, 'Megia Suhaeni', 'Sekretaris', 1),
  (2010, 'Rita setiawati', 'Kerohanian', 4),
  (2010, 'Deni Permansyah', 'Olahraga', 5),
  (2010, 'Lisma yunengsih', 'Bela Negara', 6),
  (2010, 'Rika Rahmati', 'KBB', 7),
  (2010, 'Neneng Yayu', 'Kewirausahaan', 9),
  (2010, 'Hani Nurhayati', 'BPL', 10),
  (2010, 'Amani', 'Politik', 12),
  (2010, 'Cucu Ruswanti', 'Kesenian', 13),
  (2010, 'Kustaman', 'Koordinator', 14),
  (2010, 'Devi Septiani', 'Pengurus', 15),
  (2010, 'Friska Luke', 'Pengurus', 15),
  (2010, 'Yolanda', 'Pengurus', 15),
  (2011, 'Wulan', 'Bendahara', 2),
  (2011, 'Eviana Citra', 'Kewirausahaan', 9),
  (2011, 'Rika Setiana', 'Koordinator', 14),
  (2013, 'Siti Jenab', 'Sekretaris', 1),
  (2013, 'Nadia Aprilia', 'Bendahara', 2),
  (2013, 'Dini Andriani', 'Kerohanian', 4),
  (2013, 'Riyanti', 'Kewirausahaan', 9),
  (2013, 'Siska Andriani', 'Kesenian', 13),
  (2013, 'Diana Fitri', 'Kesenian', 13),
  (2013, 'Dedeh Devi', 'Koordinator', 14),
  (2013, 'Intan Ramadhan', 'Pengurus', 15),
  (2014, 'Asep Rudi', 'Sekretaris', 1),
  (2014, 'Lina Septiana', 'Bendahara', 2),
  (2014, 'Anjar', 'Kerohanian', 4),
  (2014, 'Dandi', 'Olahraga', 5),
  (2014, 'Revina Findu', 'Bela Negara', 6),
  (2014, 'Dimas Nurdewaka', 'KBB', 7),
  (2014, 'Kamelati', 'Kewirausahaan', 9),
  (2014, 'Hana Agistiani', 'Koordinator', 14),
  (2014, 'Aripin', 'Pengurus', 15),
  (2014, 'Amir Hamzah', 'Pengurus', 15),
  (2014, 'Kiki Triana', 'Pengurus', 15),
  (2014, 'Dian Purnama', 'Pengurus', 15),
  (2014, 'Diki', 'Pengurus', 15),
  (2014, 'Rian', 'Pengurus', 15),
  (2014, 'Listia Ningsih', 'Pengurus', 15),
  (2014, 'Irma', 'Pengurus', 15),
  (2014, 'Anita', 'Pengurus', 15),
  (2014, 'Winda', 'Pengurus', 15),
  (2014, 'Resti', 'Pengurus', 15),
  (2014, 'Via Shakia', 'Pengurus', 15),
  (2014, 'Sifa', 'Pengurus', 15),
  (2014, 'Tantri', 'Pengurus', 15),
  (2015, 'Siti Hamidah', 'Sekretaris', 1),
  (2015, 'Desmi Maedayanti', 'Bendahara', 2),
  (2015, 'Sri Yayu', 'Kerohanian', 4),
  (2015, 'Michlin Rasya', 'Kesenian', 13),
  (2015, 'Cevy Ramdani', 'Pengurus', 15),
  (2015, 'Dian Rusmiati', 'Pengurus', 15),
  (2015, 'Resti', 'Pengurus', 15),
  (2015, 'Gusniar', 'Pengurus', 15),
  (2015, 'Santi', 'Pengurus', 15),
  (2015, 'Hani', 'Pengurus', 15),
  (2015, 'Risa Sadiah', 'Pengurus', 15),
  (2015, 'Fahma', 'Pengurus', 15),
  (2015, 'Yayan Haryani', 'Pengurus', 15),
  (2015, 'Rena Novita', 'Pengurus', 15),
  (2015, 'Rahmat Permana', 'Pengurus', 15),
  (2015, 'Mira', 'Pengurus', 15),
  (2016, 'Euis Aan', 'Sekretaris', 1),
  (2016, 'Widia Ningrum', 'Bendahara', 2),
  (2016, 'Novi', 'Kewirausahaan', 9),
  (2016, 'Nia Ayuni', 'Kewirausahaan', 9),
  (2016, 'Riska Rismawati', 'Politik', 12),
  (2016, 'Cici Sumiati', 'Kesenian', 13),
  (2016, 'Ilham Nursofi', 'Koordinator', 14),
  (2016, 'Siska', 'Pengurus', 15),
  (2016, 'Fira', 'Pengurus', 15),
  (2016, 'Riska Nurmala Sari', 'Pengurus', 15),
  (2016, 'Egyl Yulianti', 'Pengurus', 15),
  (2017, 'Rega Anggareksa', 'Sekretaris', 1),
  (2017, 'Siti Nurhaliza', 'Bendahara', 2),
  (2017, 'Neng Safitri', 'Kerohanian', 4),
  (2017, 'Robby', 'Olahraga', 5),
  (2017, 'Roddy', 'Olahraga', 5),
  (2017, 'M Robby Firmansyah', 'Olahraga', 5),
  (2017, 'Ela', 'KBB', 7),
  (2017, 'Merry', 'Kewirausahaan', 9),
  (2017, 'Nenden Asiani', 'Kewirausahaan', 9),
  (2017, 'Steven Y Gultom', 'Politik', 12),
  (2017, 'Nanda Shifa', 'Kesenian', 13),
  (2017, 'Dandi Rinaldi', 'Koordinator', 14),
  (2017, 'Legita', 'Pengurus', 15),
  (2017, 'Enda Sukmawati', 'Pengurus', 15),
  (2018, 'David Irlan', 'Sekretaris', 1),
  (2018, 'Risma Juliana', 'Bendahara', 2),
  (2018, 'Irsyan Maulana', 'Kerohanian', 4),
  (2018, 'Asep Daud', 'Olahraga', 5),
  (2018, 'M Rifki', 'Olahraga', 5),
  (2018, 'Wulan Agna Sahna', 'KBB', 7),
  (2018, 'Sella Anggraeni', 'Kewirausahaan', 9),
  (2018, 'Sidik Romdon', 'BPL', 10),
  (2018, 'Mira', 'Politik', 12),
  (2018, 'Taufik Nurzaman', 'Koordinator', 14),
  (2018, 'Risma Amelia', 'Pengurus', 15),
  (2018, 'Ayu Saidah', 'Pengurus', 15),
  (2019, 'Elsa Saftiani', 'Bendahara', 2),
  (2019, 'Ramdhani', 'Olahraga', 5),
  (2019, 'Eca Salsabila', 'KBB', 7),
  (2019, 'Elis Safitri', 'Kewirausahaan', 9),
  (2019, 'Femy Budiansyah', 'BPL', 10),
  (2019, 'Randi Setiawan', 'Politik', 12),
  (2019, 'M Sofyan', 'Koordinator', 14),
  (2019, 'Haditya Lesmana', 'Koordinator', 14),
  (2019, 'Mina Julianti', 'Pengurus', 15),
  (2019, 'Ane Ulvaida', 'Pengurus', 15),
  (2019, 'Ihsan Rizaldi', 'Pengurus', 15),
  (2019, 'Devi Awaliyah', 'Pengurus', 15),
  (2019, 'Fadli Fadila Gimnastiar', 'Pengurus', 15),
  (2020, 'Irma', 'Bendahara', 2),
  (2020, 'Resti Khoerunisa', 'Kerohanian', 4),
  (2020, 'Lia Nurhaliza', 'Olahraga', 5),
  (2020, 'Doni Firmasyah', 'BPL', 10),
  (2020, 'Ardiansyah', 'Ilmu Teknologi (IT)', 12),
  (2020, 'Siti Salamah', 'Koordinator', 14),
  (2020, 'Soni Sapta', 'Koordinator', 14),
  (2020, 'Lusi', 'Pengurus', 15),
  (2020, 'Nadia', 'Pengurus', 15),
  (2020, 'Hirni', 'Pengurus', 15),
  (2020, 'Vina', 'Pengurus', 15),
  (2020, 'Adelia', 'Pengurus', 15),
  (2020, 'Seli', 'Pengurus', 15),
  (2021, 'Risma Aulia', 'Bendahara', 2),
  (2021, 'Indah Pratiwi', 'Pengurus', 15),
  (2021, 'Ashifa Ameliana', 'Pengurus', 15),
  (2021, 'Sinta', 'Pengurus', 15),
  (2021, 'Rifat Fitrah', 'Pengurus', 15),
  (2022, 'Anisa Amelia', 'Sekretaris', 1),
  (2022, 'Ela Lisna', 'Bendahara', 2),
  (2022, 'Dinda Mamudianti', 'Kerohanian', 4),
  (2022, 'Putri Nur Halimah', 'Kewirausahaan', 9),
  (2022, 'Aisyah', 'Pengurus', 15),
  (2022, 'Eka Putra', 'Pengurus', 15),
  (2022, 'Mita Lestari', 'Pengurus', 15),
  (2023, 'Alya Nur Oktaviani', 'Sekretaris', 1),
  (2023, 'Fahira Zahra Fitriani', 'Bendahara', 2),
  (2023, 'Rifki Aditya Permana', 'Olahraga', 5),
  (2023, 'Ririn Indriani', 'Bela Negara', 6),
  (2023, 'Bilqis Mega Wardani', 'Kewirausahaan', 9),
  (2023, 'Saeful Azis', 'Pengurus', 15),
  (2023, 'Eva Sri Rahayu', 'Pengurus', 15),
  (2023, 'Yuni Anggraeni', 'Pengurus', 15),
  (2023, 'Anisa Pebriyani Luciana Hanif', 'Pengurus', 15),
  (2023, 'Afrizal Maulana', 'Pengurus', 15),
  (2023, 'Wanda Amelia', 'Pengurus', 15),
  (2024, 'Saepul Rifki Anggara', 'Sekretaris', 1),
  (2024, 'Ryka Fitriani', 'Sekretaris', 1),
  (2024, 'Kesya Nur Aura', 'Bendahara', 2),
  (2024, 'Agung Permana', 'Humas', 3),
  (2024, 'Desri', 'Kerohanian', 4),
  (2024, 'Arrby Surya Mutaqin', 'Olahraga', 5),
  (2024, 'Saepul Hayat', 'Bela Negara', 6),
  (2024, 'Sefila', 'Bela Negara', 6),
  (2024, 'Rinzany Khanza', 'KBB', 7),
  (2024, 'Gina Afifah', 'Kewirausahaan', 9),
  (2024, 'Prima Heza Mulya Indira Djava', 'Bahasa', 11),
  (2024, 'Riska Akbar Ma ruf', 'Politik', 12),
  (2024, 'Chesilya Naezuela', 'Kesenian', 13),
  (2024, 'Saepul Akbar', 'Pengurus', 15),
  (2024, 'Ardimas Riko', 'Pengurus', 15),
  (2024, 'Dani Permana', 'Pengurus', 15),
  (2024, 'Fadli fadilah', 'Pengurus', 15),
  (2024, 'Muhamad Nabil Malayka', 'Pengurus', 15),
  (2024, 'Nur Hasanah', 'Pengurus', 15),
  (2024, 'Muhamad Rehan', 'Pengurus', 15),
  (2025, 'Dinda Salwa Latifa', 'Sekretaris', 1),
  (2025, 'Saepul Kamal', 'Sekretaris', 1),
  (2025, 'Nadya Rizka Aulia', 'Bendahara', 2),
  (2025, 'Ilyas Fauzi Firdaus', 'Humas', 3),
  (2025, 'Cevy Firmansyah', 'Olahraga', 5),
  (2025, 'Rapsanjani', 'Olahraga', 5),
  (2025, 'Saeful Yusuf', 'Olahraga', 5),
  (2025, 'Sesillia Fitri Oktaviani', 'Bela Negara', 6),
  (2025, 'Sandi Setiawan', 'KBB', 7),
  (2025, 'Ajeng Julianti', 'Kewirausahaan', 9),
  (2025, 'Raran', 'Kewirausahaan', 9),
  (2025, 'Setiana', 'Kewirausahaan', 9),
  (2025, 'Neshabila Almanaura', 'Bahasa', 11),
  (2025, 'Puja Nurul Rizqia', 'Bahasa', 11),
  (2025, 'Fitria Ain Nur Zamzam', 'Politik', 12),
  (2025, 'Reva Devi Widyanti', 'Ilmu Teknologi (IT)', 12),
  (2025, 'Angel Beauty', 'Kesenian', 13),
  (2025, 'Nadia Agustin', 'Kesenian', 13),
  (2025, 'Shifa Nuraeni', 'Kesenian', 13),
  (2025, 'Chaerunisa', 'Pengurus', 15),
  (2026, 'Rohmah Hermawati', 'Sekretaris', 1),
  (2026, 'Kisty Azkhra Ramadani', 'Sekretaris', 1),
  (2026, 'Ira Lisna Novianti', 'Bendahara', 2),
  (2026, 'M.Akbar Maulana', 'Humas', 3),
  (2026, 'Anisa Raudatun Zanah', 'Kerohanian', 4),
  (2026, 'Nabila fikri', 'Kerohanian', 4),
  (2026, 'Nazma Setia Wardani', 'Kerohanian', 4),
  (2026, 'Qeyla Putri Azahra', 'Kerohanian', 4),
  (2026, 'Ayustia Bagas Abdillah', 'Olahraga', 5),
  (2026, 'Desta Fabiano', 'Olahraga', 5),
  (2026, 'M.Rizki Nurfadilah', 'Olahraga', 5),
  (2026, 'Ade Halimah Dwi Nur Rohaeni', 'Bela Negara', 6),
  (2026, 'Lia Nur Fitriani', 'Bela Negara', 6),
  (2026, 'Sinta Febriansyah', 'Bela Negara', 6),
  (2026, 'Zaenal Darmawan', 'Bela Negara', 6),
  (2026, 'Sartika Sari Dewi', 'KBB', 7),
  (2026, 'Anissa Agustin', 'KBB', 7),
  (2026, 'Deshtania Aneukeu Felicia', 'KBB', 7),
  (2026, 'Siti Amira Febriyani', 'Kewirausahaan', 9),
  (2026, 'Krisna Aditya', 'Kewirausahaan', 9),
  (2026, 'Aura Salsya', 'Kewirausahaan', 9),
  (2026, 'Deca Sri Anjani', 'Kewirausahaan', 9),
  (2026, 'Sulthaan Maulana Malik', 'BPL', 10),
  (2026, 'Zaskia Aulianti', 'BPL', 10),
  (2026, 'Zafira Pebiyanti', 'Bahasa', 11),
  (2026, 'Salma Nurfadilah', 'Bahasa', 11),
  (2026, 'Rostriana Vatmala', 'Politik', 12),
  (2026, 'Bintang Sandi Rofianysah', 'Ilmu Teknologi (IT)', 12),
  (2026, 'Queensha Zalfaa Salsabila', 'Kesenian', 13),
  (2026, 'Aprilia Dwi Maharani', 'Kesenian', 13),
  (2026, 'Kaila Rabanni', 'Kesenian', 13),
  (2026, 'Rafha Maulana Warandy', 'Kesenian', 13),
  (2026, 'Naswa Dwi Davinia', 'Kesenian', 13);

-- PIMPINAN (18 baris)
INSERT INTO pimpinan (tahun, ketua_nama, ketua_foto, wakil_nama, wakil_foto) VALUES
  (2010, 'Acep Irawan', 'pimpinan/ketos2010.jpg', 'Deni Mulyana', 'pimpinan/waketos2010.jpg'),
  (2011, 'Acep Irawan', 'pimpinan/ketos2010.jpg', 'Deni Mulyana', 'pimpinan/waketos2010.jpg'),
  (2012, 'Rian Subarna', 'pimpinan/ketos2012.jpg', 'Dodi Darmawan', 'pimpinan/ketos2013.jpg'),
  (2013, 'Dodi Darmawan', 'pimpinan/ketos2013.jpg', 'Cecep Nurdiansyah', 'pimpinan/waketos2013.jpg'),
  (2014, 'Ende Sobarnas', 'pimpinan/ketos2015.jpg', '', 'pimpinan/waketos-2014.jpg'),
  (2015, 'Ende Sobarnas', 'pimpinan/ketos2015.jpg', 'Rizal Nurdian', 'pimpinan/ketos2016.jpg'),
  (2016, 'Rizal Nurdian', 'pimpinan/ketos2016.jpg', 'Rita Rosita', 'pimpinan/ketos2017.jpg'),
  (2017, 'Rita Rosita', 'pimpinan/ketos2017.jpg', 'Dimas Bastian Rabani', 'pimpinan/ketos2018.jpg'),
  (2018, 'Dimas Bastian Rabani', 'pimpinan/ketos2018.jpg', 'Argi Fazriana', 'pimpinan/ketos2019.jpg'),
  (2019, 'Argi Fazriana', 'pimpinan/ketos2019.jpg', 'Maenari', 'pimpinan/ketos2020.jpg'),
  (2020, 'Maenari', 'pimpinan/ketos2020.jpg', 'Siti Raudatul Zanah', 'pimpinan/waketos2020.jpg'),
  (2021, 'Siti Raudatul Zanah', 'pimpinan/ketos2021.jpg', 'Ayu Lestari', 'pimpinan/ketos2022.jpg'),
  (2022, 'Ayu Lestari', 'pimpinan/ketos2022.jpg', 'Ayesa M Restu', 'pimpinan/waketos-2022.jpg'),
  (2023, 'Ayesa M Restu', 'pimpinan/ketos-2023.jpg', 'Amanda Lingga', 'pimpinan/ketos2024.jpg'),
  (2024, 'Amanda Lingga', 'pimpinan/ketos2024.jpg', 'Andhika Dwi Putra', 'pimpinan/ketos2025.jpg'),
  (2025, 'Andhika Dwi Putra', 'pimpinan/ketos2025.jpg', 'Sella Erika', 'pimpinan/ketos2026.jpg'),
  (2026, 'Sella Erika', 'pimpinan/ketos2026.jpg', 'Coming Soon', 'pimpinan/waketos-2026.jpg'),
  (2027, 'Belum Ada', 'pimpinan/default-ketos.jpg', 'Belum Ada', 'pimpinan/default-waketos.jpg');

-- SEKBID (15 baris)
INSERT INTO sekbid (kategori, nama, icon, deskripsi, urutan) VALUES
  ('BPH', 'Ketua OSIS', '👑', 'Pemimpin tertinggi organisasi OSIS Tarpan One yang bertanggung jawab penuh atas seluruh kebijakan, arah pergerakan, dan jalannya roda kepengurusan.', 1),
  ('BPH', 'Wakil Ketua OSIS', '🤝', 'Mitra utama Ketua OSIS dalam mengawasi kinerja seluruh seksi bidang, mengoordinasikan program kerja, dan mewakili ketua jika berhalangan.', 2),
  ('BPH', 'Sekretaris', '📝', 'Pusat administrasi organisasi yang bertanggung jawab atas pengelolaan surat-menyurat, pengarsipan dokumen, proposal, dan notulensi rapat.', 3),
  ('BPH', 'Bendahara', '💵', 'Pengatur sirkulasi keuangan organisasi, bertanggung jawab atas pencatatan kas masuk dan keluar, serta penyusunan laporan keuangan berkala.', 4),
  ('BPH', 'Humas (Hubungan Masyarakat)', '📢', 'Jembatan komunikasi utama antara internal OSIS dengan pihak sekolah, siswa, ekstrakurikuler, maupun instansi luar sekolah.', 5),
  ('SEKBID', 'Budi Pekerti Luhur', '🛡️', 'Membentuk karakter siswa yang berakhlak mulia, menegakkan kedisiplinan tata tertib sekolah, dan menggalakkan aksi sosial.', 6),
  ('SEKBID', 'Kerohanian', '🕌', 'Meningkatkan kualitas keimanan, mengoordinasikan kegiatan peribadatan rutin, serta peringatan hari besar keagamaan di sekolah.', 7),
  ('SEKBID', 'Politik', '⚖️', 'Mengembangkan pemahaman demokrasi antar pengurus osis, menyelenggarakan pemilihan Ketua OSIS, dan melatih kader kepemimpinan organisasi.', 8),
  ('SEKBID', 'Olahraga', '⚽', 'Wadah penyalur dan pengembang bakat ketangkasan fisik, kesehatan jasmani, serta mengelola turnamen olahraga antar-kelas.', 9),
  ('SEKBID', 'Kehidupan Berbangsa & Bernegara (KBB)', '🦅', 'Mengatur pelaksanaan upacara bendera hari senin, pembinaan kedisiplinan, serta mengatur penaikan dan penurunan bender di SMK Taruna harapan 1 Cipatat', 10),
  ('SEKBID', 'Bela Negara', '🇮🇩', 'Mengatur pelaksanaan upacara bendera hari Senin, pembinaan kedisiplinan, serta mengatur penaikan dan penurunan bendera di SMK Taruna harapan 1 Cipatat.', 11),
  ('SEKBID', 'Kesenian', '🎨', 'Mengembangkan kreativitas seni, apresiasi musik, tari, rupa, seni modern, serta mengoordinasikan pentas seni sekolah.', 12),
  ('SEKBID', 'Bahasa', '📚', 'Meningkatkan budaya literasi membaca siswa, mengelola mading, serta melatih kemampuan komunikasi bahasa.', 13),
  ('SEKBID', 'Kewirausahaan', '💼', 'Menumbuhkan jiwa kemandirian ekonomi, mengelola unit usaha kreatif OSIS, bazar sekolah, dan edukasi finansial.', 14),
  ('SEKBID', 'Ilmu Teknologi (IT)', '💻', 'Mengelola seluruh publikasi konten media sosial resmi OSIS, dokumentasi digital setiap event, dan pengembangan teknologi informasi sekolah.', 15);

-- PENGATURAN (sakelar buka/tutup aspirasi)
INSERT INTO pengaturan (kunci, nilai) VALUES ('status_aspirasi', 'BUKA');

-- ============================================================
-- 9. ADMIN WEB (admin.html) — foto halaman + CRUD data
-- ============================================================

-- Kolom foto angkatan di tabel pimpinan (bisa diganti dari admin)
ALTER TABLE public.pimpinan ADD COLUMN IF NOT EXISTS foto_angkatan text NOT NULL DEFAULT '';

-- Tabel foto halaman web (logo, bg, pembina, prestasi, kegiatan)
-- path = path di bucket osis-foto. Kosong = pakai default di HTML.
CREATE TABLE IF NOT EXISTS public.web_foto (
    kunci text PRIMARY KEY,
    path text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.web_foto ENABLE ROW LEVEL SECURITY;

-- Seed foto halaman (key = nama file, bisa diubah dari admin.html)
INSERT INTO web_foto (kunci, path) VALUES
  ('logo1', 'web/logo1.png'),
  ('bg', 'web/bg.png'),
  ('pembina', 'web/pembina.jpg'),
  ('prestasi1', 'web/prestasi1.jpg'),
  ('prestasi2', 'web/prestasi2.jpg'),
  ('prestasi3', 'web/prestasi3.jpg'),
  ('prestasi4', 'web/prestasi4.jpg'),
  ('makrab1', 'web/makrab1.jpg'),
  ('makrab2', 'web/makrab2.jpg'),
  ('makrab3', 'web/makrab3.jpg'),
  ('makrab4', 'web/makrab4.jpg'),
  ('takjilin1', 'web/takjilin1.jpg'),
  ('takjilin2', 'web/takjilin2.jpg'),
  ('takjilin3', 'web/takjilin3.jpg'),
  ('takjilin4', 'web/takjilin4.jpg'),
  ('pesak1', 'web/pesak1.jpg'),
  ('pesak2', 'web/pesak2.jpg'),
  ('pesak3', 'web/pesak3.jpg'),
  ('pesak4', 'web/pesak4.jpg')
ON CONFLICT (kunci) DO NOTHING;

-- PIN admin (ubah dari admin.html, tab Pengaturan)
INSERT INTO pengaturan (kunci, nilai) VALUES ('admin_pin', 'osis2026')
ON CONFLICT (kunci) DO NOTHING;

-- ============================================================
-- 10. RLS UNTUK ADMIN (aman oleh PIN di UI, pola custom auth)
--     anon boleh tulis data karena admin = localStorage PIN
-- ============================================================
DROP POLICY IF EXISTS "pimpinan_admin_all" ON public.pimpinan;
CREATE POLICY "pimpinan_admin_all" ON public.pimpinan
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anggota_admin_all" ON public.anggota;
CREATE POLICY "anggota_admin_all" ON public.anggota
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sekbid_admin_all" ON public.sekbid;
CREATE POLICY "sekbid_admin_all" ON public.sekbid
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "web_foto_public_select" ON public.web_foto;
CREATE POLICY "web_foto_public_select" ON public.web_foto
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "web_foto_admin_all" ON public.web_foto;
CREATE POLICY "web_foto_admin_all" ON public.web_foto
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pengaturan_admin_all" ON public.pengaturan;
CREATE POLICY "pengaturan_admin_all" ON public.pengaturan
    FOR ALL USING (true) WITH CHECK (true);

-- Izinkan anon hapus file di storage (buat admin.html hapus foto)
DROP POLICY IF EXISTS "osis_anon_delete" ON storage.objects;
CREATE POLICY "osis_anon_delete" ON storage.objects
    FOR DELETE TO anon
    USING (bucket_id = 'osis-foto');
