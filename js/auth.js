document.addEventListener("DOMContentLoaded", async () => {
    const isInAdmin = window.location.pathname.includes("/admiii/");
    const pathPrefix = isInAdmin ? "../" : "";

    const isPublicPage = window.location.pathname.includes("login");
    if (isPublicPage) return;

    const user = getUser();
    if (user) {
        await autoFetchUser();
    } else {
        // Biar kalau gak login pas di folder admin, gak mental ke admin/index
        window.location.href = pathPrefix + "login";
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

    // --- LOGIC JEDA WAKTU (1 JAM) ---
    const lastSync = localStorage.getItem("last_user_sync");
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 jam dalam milidetik

    // Kalau baru aja sinkron kurang dari 1 jam yang lalu, gausah narik data lagi
    if (lastSync && (now - parseInt(lastSync) < oneHour)) {
        console.log("⚡ Skip sync: Data user masih fresh (kurang dari 1 jam).");
        return oldUser;
    }

    try {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", oldUser.id)
            .single();

        if (error || !data) return;

        // Update data user dan catat waktu sinkronisasi terbaru
        localStorage.setItem("user", JSON.stringify(data));
        localStorage.setItem("last_user_sync", now.toString());

        console.log("🔄 Data user berhasil diperbarui dari database.");
        return data;
    } catch (err) {
        console.error("Gagal auto-fetch:", err);
    }
}

async function logout() {
    // 1. Ambil data user untuk cek role & class_id
    const user = getUser();
    const isSuperAdmin = user && user.role === 'super_admin';
    const classId = user ? user.class_id : null;

    // 2. Inisialisasi Tanggal & Tracker
    const today = new Date().toISOString().split('T')[0];
    let tracker = JSON.parse(localStorage.getItem("logout_tracker")) || { date: today, count: 0 };

    // Reset hitungan kalau ganti hari
    if (tracker.date !== today) {
        tracker = { date: today, count: 0 };
    }

    // 3. Hitung Sisa Kuota (Flow: 0 logout -> 2 kali sisa)
    const remaining = Math.max(0, 2 - tracker.count);

    // 4. Tentukan Pesan Popup berdasarkan Role
    let pesan = "";
    if (isSuperAdmin) {
        pesan = "Yakin mau logout, Super Admin? <br><small style='opacity:0.7'>Kamu punya akses tak terbatas.</small>";
    } else {
        pesan = `
            Yakin mau logout? <br>
            Kamu hanya bisa logout <b>${remaining} kali lagi</b>.
        `;
    }

    const yakin = await showPopup(pesan, "confirm");

    if (yakin) {
        // 5. CEK APAKAH BOLEH LOGOUT? (Super Admin selalu boleh)
        if (isSuperAdmin || remaining > 0) {
            try {
                // Deteksi folder untuk redirect yang bener (Path Guard)
                const isInAdmin = window.location.pathname.includes('/admiii/');
                const prefix = isInAdmin ? '../' : '';

                // Update hitungan tracker HANYA jika bukan Super Admin
                if (!isSuperAdmin) {
                    tracker.count += 1;
                    localStorage.setItem("logout_tracker", JSON.stringify(tracker));
                }

                // Hapus data login
                localStorage.removeItem("user");

                // Redirect balik ke login dengan ID kelas (Pastikan bukan "nan")
                const targetId = (classId && classId !== "undefined" && !isNaN(classId)) ? classId : "";
                const finalUrl = targetId ? `login?id=${targetId}` : "login";

                window.location.href = prefix + finalUrl;
            } catch (e) {
                console.error("Logout Error:", e);
                // Fallback jika terjadi error
                const isInAdmin = window.location.pathname.includes('/admiii/');
                window.location.href = (isInAdmin ? "../" : "") + "login";
            }
        } else {
            // Jika kuota habis (hanya user biasa)
            const batas = `Kamu udah gabisa logout lagi hari ini.
                <br><br>
                <a href="https://wa.me/6283851088843" target="_blank" style="color: #00eaff; text-decoration: none; font-size: 12px;">
                    <i class="fa-solid fa-circle-question"></i> Butuh bantuan?
                </a>`;
            setTimeout(() => {
                showPopup(batas, "error");
            }, 300);
        }
    }
}