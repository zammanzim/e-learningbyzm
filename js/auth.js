// =============================
// CEK AUTH (kalau tidak login → tendang ke index.html)
// =============================
// auth.js - REVISED
document.addEventListener("DOMContentLoaded", async () => {
    // Skip check di halaman login/register
    const isPublicPage = window.location.pathname.includes("index.html");
    if (isPublicPage) return;
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
        await autoFetchUser();
    }
});

// =============================
// GET USER (ambil dari localStorage)
// =============================
function getUser() {
    return JSON.parse(localStorage.getItem("user"));
}

function getShortName(user) {
    if (!user) return "";
    // Prioritaskan kolom nickname dari DB, fallback ke split manual
    return user.nickname || user.full_name?.split(" ")[0] || "User";
}

// =============================
// AUTO-FETCH (ambil data terbaru user dari Supabase)
// jalan setiap halaman di-load
// =============================
async function autoFetchUser() {
    const oldUser = getUser();
    if (!oldUser) return;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", oldUser.id)
        .single();

    if (error || !data) return;

    // update user terbaru
    localStorage.setItem("user", JSON.stringify(data));
    return data;
}


// =============================
// INIT (dipanggil otomatis ketika halaman dimuat)
// =============================
document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (user) {
        await autoFetchUser(); // update data user terbaru
    }
});

function getShortName(user) {
    if (!user) return "";
    return user.short_name || user.full_name?.split(" ")[0] || "";
}

function getProfilePicture(user) {
    if (!user || !user.avatar_url) return "defaultpp.png";
    return user.avatar_url;
}

document.addEventListener("DOMContentLoaded", () => {
    const user = getUser();
    if (!user) return;

    const shortName = getShortName(user);
    const ppUrl = getProfilePicture(user);

    const nameEl = document.getElementById("headerName");
    const ppEl = document.getElementById("headerPP");

    if (nameEl) nameEl.innerText = `Hai, ${shortName}`;
    if (ppEl) ppEl.src = ppUrl;
});

const user = JSON.parse(localStorage.getItem("user"));
console.log("✅ User loaded:", user.full_name);

function logout() {
    localStorage.clear();       // Hapus data login
    window.location.href = "index.html"; // Balik ke login
}
// =============================
// VISITOR LOGGER (TRACK LAST LOCATION)
// =============================
async function logVisitor() {
    const user = getUser();
    if (!user) return;

    try {
        // 1. Ambil Nama Halaman (Pastikan <title> di HTML sudah benar)
        const currentPage = document.title || "Unknown Page";

        // 2. Setup Waktu Reset (Jam 3 Sore)
        const now = new Date();
        const resetHour = 15;
        let lastReset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetHour, 0, 0);

        if (now.getHours() < resetHour) {
            lastReset.setDate(lastReset.getDate() - 1);
        }
        const timeThreshold = lastReset.toISOString();

        // 3. Cek Data Existing
        const { data: existing } = await supabase
            .from("visitors")
            .select("id, visited_at, last_page")
            .eq("user_id", user.id)
            .eq("class_id", user.class_id)
            .gte("visited_at", timeThreshold)
            .maybeSingle();

        if (existing) {
            // SKENARIO A: User sudah ada
            const lastVisit = new Date(existing.visited_at);
            const diffMinutes = (now - lastVisit) / 60000;

            // Logic: Update kalo pindah halaman ATAU udah lewat 1 menit
            const isPageChanged = existing.last_page !== currentPage;

            if (diffMinutes >= 1 || isPageChanged) {
                const { error: updateError } = await supabase
                    .from("visitors")
                    .update({
                        visited_at: now.toISOString(),
                        is_visible: true,
                        last_page: currentPage // <--- Simpan Lokasi Baru
                    })
                    .eq("id", existing.id);

                if (!updateError) {
                    console.log(`📍 Location updated: ${currentPage}`);
                    if (typeof renderVisitorStats === 'function') renderVisitorStats();
                }
            } else {
                console.log("⏳ Under < 1 menit, skip update.");
            }

        } else {
            // SKENARIO B: User Baru Masuk
            const { error: insertError } = await supabase
                .from("visitors")
                .insert({
                    user_id: user.id,
                    class_id: user.class_id,
                    is_visible: true,
                    last_page: currentPage // <--- Simpan Lokasi Awal
                });

            if (!insertError) {
                console.log(`✅ New visit logged at: ${currentPage}`);
                if (typeof renderVisitorStats === 'function') renderVisitorStats();
            }
        }

    } catch (err) {
        console.error("❌ Log error:", err);
    }
}