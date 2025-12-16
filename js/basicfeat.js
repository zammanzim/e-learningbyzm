/** * ==========================================
 * BASIC FEATURES (Sidebar, Menu, Profile)
 * ==========================================
 */

function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    const hamburger = document.getElementById("hamburger");
    const overlay = document.getElementById("sidebarOverlay");
    const mainContent = document.querySelector(".main-content") || document.querySelector(".main");

    if (window.innerWidth >= 1024) {
        // Mode Desktop
        sidebar.classList.toggle("closed");
        if (mainContent) mainContent.classList.toggle("shifted");
    } else {
        // Mode Mobile
        sidebar.classList.toggle("open");
        hamburger.classList.toggle("active");

        if (sidebar.classList.contains("open")) {
            overlay.classList.add("show");
            enableCloseOnOutside();
        } else {
            overlay.classList.remove("show");
        }
    }
}

function enableCloseOnOutside() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const hamburger = document.getElementById("hamburger");

    overlay.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
        if (hamburger) hamburger.classList.remove("active");
        overlay.onclick = null;
    };
}

// === ROUTING ===
function goDashboard() {
    window.location.href = "dashboard.html";
}

function goProfile() {
    window.location.href = "profile.html";
}

// === PROFILE DROPDOWN ===
document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.getElementById("profileTrigger");
    const dropdown = document.getElementById("profileDropdown");

    if (!trigger || !dropdown) return;

    trigger.onclick = () => {
        dropdown.classList.toggle("show");
        trigger.classList.toggle("rotate"); // Animasi panah
    };

    // Klik luar -> tutup dropdown
    document.addEventListener("click", (e) => {
        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove("show");
            trigger.classList.remove("rotate");
        }
    });
});


/** * ==========================================
 * VISITOR FEATURES (Logic Total vs Today)
 * ==========================================
 */

function getResetTime() {
    // Reset setiap jam 3 sore (15:00)
    const now = new Date();
    const resetHour = 15;
    let resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetHour, 0, 0);

    // Kalau sekarang sudah lewat jam 3 sore, resetnya besok
    if (now.getTime() >= resetTime.getTime()) {
        resetTime.setDate(resetTime.getDate() + 1);
    }
    return resetTime;
}

async function renderVisitorStats() {
    if (typeof supabase === 'undefined') return;

    // Ambil data user dari localStorage
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    const resetTime = getResetTime();
    const yesterday = new Date(resetTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const timeThreshold = yesterday.toISOString();

    try {
        // A. QUERY TOTAL VISITOR
        const { data: totalData, error: totalErr } = await supabase
            .from('visitors')
            .select('user_id')
            .eq('class_id', user.class_id);

        if (totalErr) throw totalErr;

        // B. QUERY TODAY VISITOR
        const { data: todayData, error: todayErr } = await supabase
            .from('visitors')
            .select(`
                user_id, 
                visited_at,
                last_page,
                user:user_id (full_name, avatar_url)
            `)
            .eq('class_id', user.class_id)
            .eq('is_visible', true)
            .gte('visited_at', timeThreshold)
            .order('visited_at', { ascending: false });

        if (todayErr) throw todayErr;

        // --- HITUNG ANGKA ---
        const uniqueTotal = new Set(totalData.map(v => v.user_id)).size;

        const uniqueTodayMap = new Map();
        todayData.forEach(v => {
            if (!uniqueTodayMap.has(v.user_id)) {
                uniqueTodayMap.set(v.user_id, v);
            }
        });
        const uniqueTodayCount = uniqueTodayMap.size;

        // Cek Admin buat tombol Reset
        const adminActions = document.querySelector(".admin-actions");
        if (adminActions) {
            if (user.role === 'class_admin' || user.role === 'super_admin') {
                adminActions.style.display = 'block';
            } else {
                adminActions.style.display = 'none';
            }
        }

        // --- UPDATE TAMPILAN (UI) ---
        const headerCount = document.getElementById("headerVisitorCount");
        if (headerCount) headerCount.innerText = uniqueTodayCount;

        const popupToday = document.getElementById("popupToday");
        const popupTotal = document.getElementById("popupTotal");
        const listEl = document.getElementById("visitorList");

        if (popupToday) popupToday.innerText = uniqueTodayCount;
        if (popupTotal) popupTotal.innerText = uniqueTotal;
        if (listEl) renderVisitorList(Array.from(uniqueTodayMap.values()), listEl);

    } catch (err) {
        console.error("❌ Stats Error:", err);
    }
}

function renderVisitorList(visitors, listEl) {
    listEl.innerHTML = '';

    if (visitors.length === 0) {
        listEl.innerHTML = '<p style="color:#94a3b8; font-size:0.9em; padding:10px;">Belum ada pengunjung aktif hari ini.</p>';
        return;
    }

    visitors.forEach(v => {
        const u = v.user || {};
        const fullName = u.full_name || 'Unknown User';
        const avatarUrl = u.avatar_url || 'defaultpp.png';

        // Logic Lokasi (Fallback "Reading..." -> "Home")
        let location = v.last_page;
        if (!location) location = "Reading...";

        const timeStr = new Date(v.visited_at).toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', hour12: false
        });

        const item = document.createElement('div');
        item.className = 'visitor-item';
        item.innerHTML = `
            <img src="${avatarUrl}" class="visitor-pp" onerror="this.src='defaultpp.png'">
            <div style="text-align:left; flex:1; overflow:hidden;">
                <div class="visitor-name">${fullName}</div>
                <div style="font-size:11px; color:#94a3b8; display:flex; justify-content:space-between; align-items:center; width:100%; margin-top:2px;">
                    <span style="color:#4ade80; max-width:65%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        <i class="fa-solid fa-location-dot" style="margin-right:3px;"></i> ${location}
                    </span>
                    <span style="font-size:10px; opacity:0.8;">${timeStr}</span>
                </div>
            </div>
        `;
        listEl.appendChild(item);
    });
}

// Fungsi Reset (Admin Only)
async function resetTodayVisitor() {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user || (user.role !== 'class_admin' && user.role !== 'super_admin')) {
        alert("❌ Hanya Admin Kelas yang bisa mereset!");
        return;
    }

    if (!confirm("⚠️ Reset list pengunjung hari ini?\n(Angka Total Visitor TIDAK akan berkurang)")) return;

    const resetTime = getResetTime();
    const yesterday = new Date(resetTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const timeThreshold = yesterday.toISOString();

    try {
        const { error } = await supabase
            .from('visitors')
            .update({ is_visible: false })
            .eq('class_id', user.class_id)
            .gte('visited_at', timeThreshold);

        if (error) throw error;
        alert("✅ Visitor hari ini berhasil di-reset!");
        renderVisitorStats();
    } catch (err) {
        console.error("❌ Reset Error:", err);
        alert("Gagal reset: " + err.message);
    }
}

// === EVENT LISTENERS (Popup Logic & ESC) ===
document.addEventListener("DOMContentLoaded", () => {
    // 1. Render data awal
    renderVisitorStats();

    // 2. Setup Elemen
    const trigger = document.getElementById("visitorTrigger");
    const overlay = document.getElementById("visitorOverlay");
    const closeBtn = document.getElementById("closeVisitorPopup");
    const resetBtn = document.getElementById("resetVisitorBtn");

    // 3. Buka Popup (Klik Mata)
    if (trigger && overlay) {
        trigger.onclick = () => {
            overlay.classList.add("show");
            renderVisitorStats();
        };
    }

    // 4. Tutup Popup (Klik X)
    if (closeBtn && overlay) {
        closeBtn.onclick = () => overlay.classList.remove("show");
    }

    // 5. Tutup Popup (Klik Background Luar)
    if (overlay) {
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.classList.remove("show");
        };
    }

    // 6. Tombol Reset
    if (resetBtn) {
        resetBtn.onclick = resetTodayVisitor;
    }

    // 7. SHORTCUT: Tekan ESC untuk Tutup
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            if (overlay && overlay.classList.contains("show")) {
                overlay.classList.remove("show");
            }
        }
    });
});

// ==========================================
// ADMIN SIDEBAR INJECTOR
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    injectAdminMenu();
});

function injectAdminMenu() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || !user.role || user.role === 'student') return;

    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    // 1. DETEKSI HALAMAN SAAT INI
    // Ambil nama file dari URL (misal: 'admin-nilai.html')
    const path = window.location.pathname;
    const page = path.split("/").pop();

    // Helper function biar kodingan rapi
    // Kalau link == page saat ini, return 'active', kalo beda return kosong
    const isActive = (link) => page === link ? 'active' : '';

    let menuTitle = "";
    let menuItems = "";

    // 2. BIKIN MENU DENGAN LOGIC 'ACTIVE'
    if (user.role === 'class_admin') {
        menuTitle = "Admin Panel";
        menuItems = `
            <li>
                <a href="admin-nilai.html" class="${isActive('admin-nilai.html')}">
                    <i class="fa-solid fa-pen-to-square"></i> Input Nilai
                </a>
            </li>
            <li>
                <a href="admin-pengumuman.html" class="${isActive('admin-pengumuman.html')}">
                    <i class="fa-solid fa-bullhorn"></i> Edit Pengumuman
                </a>
            </li>
        `;
    }
    else if (user.role === 'super_admin') {
        menuTitle = "Super Admin";
        menuItems = `
            <li>
                <a href="super-users.html" class="${isActive('super-users.html')}">
                    <i class="fa-solid fa-users-gear"></i> Manage Users
                </a>
            </li>
            <li>
                <a href="admin-nilai.html" class="${isActive('admin-nilai.html')}">
                    <i class="fa-solid fa-pen-to-square"></i> Input Nilai
                </a>
            </li>
            <li>
                <a href="admin-logs.html" class="${isActive('admin-logs.html')}">
                    <i class="fa-solid fa-file-waveform"></i> System Logs
                </a>
            </li>
        `;
    }

    // 3. INJECT KE SIDEBAR (PREPEND = PALING ATAS)
    const h3 = document.createElement("h3");
    h3.innerText = menuTitle;
    h3.style.color = "#ffd700";
    h3.style.marginTop = "0px";
    h3.style.marginBottom = "10px";

    const ul = document.createElement("ul");
    ul.innerHTML = menuItems;

    sidebar.prepend(ul);
    sidebar.prepend(h3);
}

document.addEventListener('click', function (e) {
    // Cek apakah yang diklik adalah menu yang dikunci
    const lockedItem = e.target.closest('.nav-locked');

    if (lockedItem) {
        e.preventDefault(); // Cegah pindah halaman (double protection)
        alert("🔒 The Page Isn't Ready Yet. \n Halaman Ini Belum Tersedia \n \n Halaman yang tersedia hanya Announcements dan Nilai PSASI. \n Menu pelajaran bisa sih, tapi tugasnya belum ditambahin.");
    }
});