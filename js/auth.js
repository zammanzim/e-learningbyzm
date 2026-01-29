document.addEventListener("DOMContentLoaded", async () => {
    const isPublicPage = window.location.pathname.includes("index");
    if (isPublicPage) return;

    const user = getUser();
    if (user) {
        await autoFetchUser();
    } else {
        window.location.href = "index";
    }
});

function getUser() {
    try {
        const data = localStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
}

function getShortName(user) {
    if (!user) return "";
    return user.short_name || user.nickname || user.full_name?.split(" ")[0] || "User";
}

async function autoFetchUser() {
    const oldUser = getUser();
    if (!oldUser) return;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", oldUser.id)
        .single();

    if (error || !data) return;

    localStorage.setItem("user", JSON.stringify(data));
    return data;
}

// ==========================================
// UPDATE FUNGSI LOGOUT (DENGAN PEMBATASAN)
// ==========================================
// ==========================================
// UPDATE FINAL LOGOUT DENGAN DYNAMIC TRACKER
// ==========================================
async function logout() {
    // 1. Inisialisasi Tanggal & Tracker
    const today = new Date().toISOString().split('T')[0];
    let tracker = JSON.parse(localStorage.getItem("logout_tracker")) || { date: today, count: 0 };

    // 2. Reset hitungan kalau ganti hari
    if (tracker.date !== today) {
        tracker = { date: today, count: 0 };
    }

    // 3. Hitung Sisa Kuota (Flow: 0 logout -> 2 kali, 1 logout -> 1 kali, 2 logout -> 0 kali)
    const remaining = Math.max(0, 2 - tracker.count);

    // 4. POPUP KONFIRMASI (Tetap muncul meski sisa 0)
    const pesan = `
        Yakin mau logout? <br>
        Kamu hanya bisa logout <b>${remaining} kali lagi</b>.
    `;
    const yakin = await showPopup(pesan, "confirm");

    const batas = `Kamu udah gabisa logout lagi hari ini. Suruh siapa logout terus.
        <br><br>
        <a href="https://wa.me/6283851088843" target="_blank" style="color: #00eaff; text-decoration: none; font-size: 12px;">
            <i class="fa-solid fa-circle-question"></i> Butuh bantuan?
        </a>`

    if (yakin) {
        // 5. CEK APAKAH BENERAN ADA SISA?
        if (remaining > 0) {
            try {
                const user = JSON.parse(localStorage.getItem("user"));
                const classId = user ? user.class_id : null;

                // Update hitungan tracker
                tracker.count += 1;
                localStorage.setItem("logout_tracker", JSON.stringify(tracker));

                // Hapus data login saja (Jangan .clear() biar tracker gak ilang)
                localStorage.removeItem("user");

                // Redirect balik ke login dengan ID kelas
                window.location.href = classId ? `index?id=${classId}` : "index";
            } catch (e) {
                console.error("Logout Error:", e);
                window.location.href = "index";
            }
        } else {
            setTimeout(() => {
                showPopup(batas, "error");
            }, 300);
        }
    }
}