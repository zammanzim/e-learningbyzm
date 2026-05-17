-- LAST UPDATE: Minggu, 17 May 2026, 17.00
-- VERSION: v3.5

-- 1. Table for Global System Notice (Full Schema)
CREATE TABLE IF NOT EXISTS system_notifications (
    id SERIAL PRIMARY KEY,
    type TEXT DEFAULT 'blue', -- yellow, blue, red, green
    icon TEXT DEFAULT 'fa-circle-info',
    message TEXT NOT NULL,
    text_color TEXT DEFAULT '#ffffff',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Log Update (v3.5 - Massive Productivity Update)
INSERT INTO app_updates (title, version, items, created_at)
VALUES (
    'Minggu, 17 May 2026, 17.00',
    'v3.5',
    '[
        "Navigasi Mapel: Klik pelajaran di Daily Card langsung ke halaman subject (smart matching).",
        "User Dashboard: Rombak total profil jadi Command Center (Bento Grid, Progress Tugas, Jadwal Harian).",
        "Dashboard Feature: Toggle Akun Privat langsung dari Aksi Cepat.",
        "System Notice: Banner info global di bawah header dengan support HTML/Link & Custom Color.",
        "Admin Management: Halaman khusus kirim & edit notice global (send_notice.html)."
    ]'::jsonb,
    NOW()
);
