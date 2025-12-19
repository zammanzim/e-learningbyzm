// ==========================================
// 1. AUTO RUN SAAT HALAMAN DIMUAT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    renderSidebar();

    if (document.getElementById("visitorTrigger")) {
        renderVisitorStats();
    }

    syncHeaderProfile();
});

// ==========================================
// [FIXED] SINKRONISASI HEADER (CACHE FRIENDLY)
// ==========================================
function syncHeaderProfile() {
    // Ambil data dari LocalStorage (Operasi Sync = INSTANT, Gak pake internet)
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) return;

    const headerName = document.getElementById("headerName");
    const headerPP = document.getElementById("headerPP");

    // Update Nama
    if (headerName) {
        headerName.innerText = `Hai, ${user.short_name}`;
    }

    // Update Foto Profil
    if (headerPP) {
        // HAPUS BAGIAN TIMESTAMP (?t=...)
        // Kita percaya sama URL yang disimpan di Database.
        // Kalau URL-nya sama, browser bakal ambil dari CACHE (Ngebut).
        const url = user.avatar_url || "profpicture.png";
        headerPP.src = url;
    }
}

// ==========================================
// 2. UNIFIED SIDEBAR RENDERER
// ==========================================
function renderSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const user = JSON.parse(localStorage.getItem("user"));
    const role = user ? user.role : "student";

    let menuGroups = [
        {
            header: "Main Menu",
            items: [
                { text: "Home", url: "homev2.html", icon: "fa-house" },
                { text: "Announcement", url: "announcements.html", icon: "fa-bullhorn" },
                { text: "Account Setting", url: "settingacc.html", icon: "fa-solid fa-user-gear" },
                { text: "Nilai PSASI 25-26", url: "nilaiv2.html", icon: "fa-clipboard-check" },
            ]
        },
        {
            header: "Lessons",
            items: [
                { text: "B. Indonesia", url: "bahasaindonesia.html", icon: "fa-book" },
                { text: "B. Inggris", url: "bahasainggris.html", icon: "fa-language" },
                { text: "B. Sunda", url: "bahasasunda.html", icon: "fa-book" },
                { text: "B. Jepang", url: "bahasajepang.html", icon: "fa-torii-gate" },
                { text: "Matematika", url: "matematika.html", icon: "fa-calculator" },
                { text: "Proipas", url: "proipas.html", icon: "fa-atom" },
                { text: "Sejarah", url: "sejarah.html", icon: "fa-landmark" },
                { text: "PABP", url: "pabp.html", icon: "fa-mosque" },
                { text: "PP", url: "pp.html", icon: "fa-scale-balanced" },
                { text: "Seni Budaya", url: "senibudaya.html", icon: "fa-masks-theater" },
                { text: "PJOK", url: "pjok.html", icon: "fa-person-running" },
                { text: "Informatika", url: "informatika.html", icon: "fa-laptop" },
                { text: "BK", url: "bk.html", icon: "fa-heart-circle-check" },
                { text: "DASPROG 1", url: "dpr1.html", icon: "fa-laptop-code" },
                { text: "DASPROG 2", url: "dpr2.html", icon: "fa-microchip" },
                { text: "DASPROG 3", url: "dpr3.html", icon: "fa-palette" },
            ]
        }
    ];

    if (role === 'class_admin') {
        menuGroups.unshift({
            header: "Admin Panel",
            color: "#ffd700",
            items: [
                { text: "Input Nilai PSAS", url: "admin-nilai.html", icon: "fa-pen-to-square" },
                { text: "Monitor Nilai PSAS", url: "admin-monitor.html", icon: "fa-users-viewfinder" }
            ]
        });
    }
    else if (role === 'super_admin') {
        menuGroups.unshift({
            header: "Super Admin Panel",
            color: "#ffd700",
            items: [
                { text: "Input Nilai PSAS", url: "admin-nilai.html", icon: "fa-pen-to-square" },
                { text: "Monitor Nilai PSAS", url: "admin-monitor.html", icon: "fa-users-viewfinder" }
            ]
        });
    }

    const currentPath = window.location.pathname.toLowerCase();
    let htmlContent = "";

    menuGroups.forEach(group => {
        const headerStyle = group.color ? `style="color:${group.color}; margin-top:0px;"` : "";
        htmlContent += `<h3 ${headerStyle}>${group.header}</h3><ul>`;

        group.items.forEach(item => {
            const itemUrl = item.url.toLowerCase();
            let isActive = "";
            if (currentPath.endsWith(itemUrl) || (currentPath === "/" && itemUrl === "index.html")) {
                isActive = "active";
            }

            let iconHtml = "";
            if (item.text === "B. Sunda") iconHtml = `<b style="margin-right: 10px;">ᮘ</b>`;
            else if (item.text === "B. Jepang") iconHtml = `<b style="margin-right: 10px;">ア</b>`;
            else iconHtml = `<i class="fa-solid ${item.icon}"></i>`;

            htmlContent += `<li><a href="${item.url}" class="${isActive}">${iconHtml} ${item.text}</a></li>`;
        });
        htmlContent += `</ul>`;
    });

    sidebar.innerHTML = htmlContent;

    const activeItem = sidebar.querySelector(".active");
    if (activeItem) {
        setTimeout(() => {
            activeItem.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
    }
}

function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    const hamburger = document.getElementById("hamburger");
    const overlay = document.getElementById("sidebarOverlay");

    // Logic Desktop
    if (window.innerWidth >= 1024) {
        sidebar.classList.toggle("closed");
        const main = document.querySelector(".main-content");
        if (main) main.classList.toggle("shifted");
    }
    // Logic Mobile
    else {
        sidebar.classList.toggle("open");
        hamburger.classList.toggle("active");

        if (sidebar.classList.contains("open")) {
            // BUKA MENU -> KUNCI RAPET
            overlay.classList.add("show");
            overlay.onclick = toggleMenu;

            // Kunci HTML & BODY biar ga gerak
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";

            // Opsional: Kalo lo pake wrapper main-content yg scroll
            const main = document.querySelector(".main-content");
            if (main) main.style.overflow = "hidden";

        } else {
            // TUTUP MENU -> LEPAS KUNCI
            overlay.classList.remove("show");

            document.documentElement.style.overflow = "";
            document.body.style.overflow = "";

            const main = document.querySelector(".main-content");
            if (main) main.style.overflow = "";
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.getElementById("profileTrigger");
    const dropdown = document.getElementById("profileDropdown");

    if (trigger && dropdown) {
        trigger.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
            trigger.classList.toggle("rotate");
        };
        document.addEventListener("click", (e) => {
            if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove("show");
                trigger.classList.remove("rotate");
            }
        });
    }
});

function goDashboard() { window.location.href = "dashboard.html"; }
function goProfile() { window.location.href = "settingacc.html"; }
function logout() {
    if (confirm("Yakin mau logout?")) {
        localStorage.clear();
        window.location.href = "index.html";
    }
}

// ==========================================
// 4. VISITOR SYSTEM
// ==========================================
function getResetTime() {
    const now = new Date();
    let resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0);
    if (now.getTime() >= resetTime.getTime()) resetTime.setDate(resetTime.getDate() + 1);
    return resetTime;
}

async function renderVisitorStats() {
    if (typeof supabase === 'undefined') return;
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    const resetTime = getResetTime();
    const yesterday = new Date(resetTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const timeThreshold = yesterday.toISOString();

    try {
        const { data: totalData } = await supabase.from('visitors').select('user_id').eq('class_id', user.class_id);
        const { data: todayData } = await supabase.from('visitors')
            .select('user_id, visited_at, last_page, user:user_id (full_name, avatar_url, nickname)')
            .eq('class_id', user.class_id).eq('is_visible', true).gte('visited_at', timeThreshold)
            .order('visited_at', { ascending: false });

        if (!totalData || !todayData) return;

        const uniqueTotal = new Set(totalData.map(v => v.user_id)).size;
        const uniqueTodayMap = new Map();
        todayData.forEach(v => { if (!uniqueTodayMap.has(v.user_id)) uniqueTodayMap.set(v.user_id, v); });

        const headerCount = document.getElementById("headerVisitorCount");
        const popupToday = document.getElementById("popupToday");
        const popupTotal = document.getElementById("popupTotal");
        const listEl = document.getElementById("visitorList");

        if (headerCount) headerCount.innerText = uniqueTodayMap.size;
        if (popupToday) popupToday.innerText = uniqueTodayMap.size;
        if (popupTotal) popupTotal.innerText = uniqueTotal;
        if (listEl) renderVisitorList(Array.from(uniqueTodayMap.values()), listEl);

    } catch (err) { console.error("Stats Error:", err); }
}

function renderVisitorList(visitors, listEl) {
    listEl.innerHTML = '';
    if (visitors.length === 0) {
        listEl.innerHTML = '<p style="color:#aaa; font-size:12px;">Sepi amat, belum ada yang mampir.</p>';
        return;
    }
    visitors.forEach(v => {
        const u = v.user || {};
        const name = u.nickname || u.full_name || 'User';
        const pp = u.avatar_url || 'profpicture.png';
        const page = v.last_page || "Muter-muter";
        const time = new Date(v.visited_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const item = document.createElement('div');
        item.className = 'visitor-item';
        item.innerHTML = `
            <img src="${pp}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
            <div style="flex:1; margin-left:10px;">
                <div style="font-size:13px; font-weight:bold;">${name}</div>
                <div style="font-size:11px; color:#aaa;">
                    <span style="color:#00eaff">${page}</span> • ${time}
                </div>
            </div>
        `;
        listEl.appendChild(item);
    });
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

    // 7. SHORTCUT: Tekan ESC untuk Tutup
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            if (overlay && overlay.classList.contains("show")) {
                overlay.classList.remove("show");
            }
        }
    });
});