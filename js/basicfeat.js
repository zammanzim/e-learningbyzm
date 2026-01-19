// ==========================================
// 1. AUTO RUN SAAT HALAMAN DIMUAT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    renderSidebar();
    syncHeaderProfile();

    // [GLOBAL FIX] HAPUS GARIS MERAH (SPELLCHECK)
    document.body.setAttribute('spellcheck', 'false');
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(el => {
        el.setAttribute('spellcheck', 'false');
    });
});

// ==========================================
// 2. SINKRONISASI HEADER
// ==========================================
function syncHeaderProfile() {
    try {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) return;

        const headerName = document.getElementById("headerName");
        const headerPP = document.getElementById("headerPP");

        if (headerName) {
            headerName.innerText = `Hai, ${user.short_name || user.nickname || 'User'}`;
        }
        if (headerPP) {
            headerPP.src = user.avatar_url || "profpicture.png";
        }
    } catch (e) { console.error("Sync Profile Error:", e); }
}
// ==========================================
// 3. UNIFIED SIDEBAR RENDERER
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
                { text: "Announcement", url: "announcements.html", icon: "fa-bullhorn", badge: "FIX", badgeType: "badge-fix" },
                { text: "Daftar Tugas", url: "tugas.html", icon: "fa-solid fa-list-check", badge: "NEW", badgeType: "badge-beta" },
                { text: "Account Setting", url: "settingacc.html", icon: "fa-solid fa-user-gear", badge: "UPDATE", badgeType: "badge-upd" },
                { text: "Nilai PSASI 25-26", url: "nilaiv2.html", icon: "fa-clipboard-check", badge: "HOT", badgeType: "badge-hot" },
                { text: "Cari Akun", url: "search.html", icon: "fa-solid fa-search", badge: "NEW", badgeType: "badge-new"}
            ]
        },
        {
            header: "Lessons",
            items: [
                { text: "B. Indonesia", url: "bahasaindonesia.html", icon: "fa-book"},
                { text: "B. Inggris", url: "bahasainggris.html", icon: "fa-book-atlas"},
                { text: "B. Sunda", url: "bahasasunda.html", icon: "fa-book"},
                { text: "B. Jepang", url: "bahasajepang.html", icon: "fa-book", badge: "Task", badgeType: "badge-task" },

                // CONTOH PEMAKAIAN BADGE:
                { text: "Matematika", url: "matematika.html", icon: "fa-square-root-variable"},
                { text: "Proipas", url: "proipas.html", icon: "fa-atom"},

                { text: "Sejarah", url: "sejarah.html", icon: "fa-landmark"},
                { text: "PABP", url: "pabp.html", icon: "fa-mosque" , badge: "Task", badgeType: "badge-task" },
                { text: "PP", url: "pp.html", icon: "fa-scale-balanced"},
                { text: "Seni Budaya", url: "senibudaya.html", icon: "fa-masks-theater"},
                { text: "PJOK", url: "pjok.html", icon: "fa-person-running", badge: "Task", badgeType: "badge-task" },
                { text: "Informatika", url: "informatika.html", icon: "fa-laptop"},
                { text: "BK", url: "bk.html", icon: "fa-heart-circle-check"},

                // CONTOH 'SOON' (Materi belum siap)
                { text: "DASPROG 1", url: "dpr1.html", icon: "fa-laptop-code"},
                { text: "DASPROG 2", url: "dpr2.html", icon: "fa-microchip", badge: "task", badgeType: "badge-task" },
                { text: "DASPROG 3", url: "dpr3.html", icon: "fa-palette"},
            ]
        }
    ];

    if (role === 'class_admin' || role === 'super_admin') {
        menuGroups.unshift({
            header: "Admin Panel",
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
            const isActive = currentPath.endsWith(itemUrl) ? "active" : "";

            // Icon Custom
            let iconHtml = (item.text === "B. Sunda") ? `<b style="margin-right: 15px; margin-left: 2px;">ᮔᮃ</b>` :
                (item.text === "B. Jepang") ? `<b style="margin-right: 20px; margin-left: 7px;">漢</b>` :
                    `<i class="fa-solid ${item.icon}"></i>`;

            // Badge Logic
            let badgeHtml = "";
            if (item.badge) {
                badgeHtml = `<span class="sidebar-badge ${item.badgeType || 'badge-new'}">${item.badge}</span>`;
            }

            htmlContent += `
                <li class="${isActive}">
  <a href="${item.url}">
                        ${iconHtml} ${item.text}
                    </a>
                    ${badgeHtml}
                </li>`;
        });
        htmlContent += `</ul>`;
    });

    sidebar.innerHTML = htmlContent;
    const activeItem = sidebar.querySelector(".active");
    if (activeItem) setTimeout(() => activeItem.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
}

// ==========================================
// 4. NAVIGATION & UI LOGIC
// ==========================================
function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    const hamburger = document.getElementById("hamburger");
    const overlay = document.getElementById("sidebarOverlay");

    if (window.innerWidth >= 1024) {
        sidebar.classList.toggle("closed");
        document.querySelector(".main-content")?.classList.toggle("shifted");
    } else {
        sidebar.classList.toggle("open");
        hamburger.classList.toggle("active");
        if (sidebar.classList.contains("open")) {
            overlay.classList.add("show");
            overlay.onclick = toggleMenu;
            document.body.style.overflow = "hidden";
        } else {
            overlay.classList.remove("show");
            document.body.style.overflow = "";
        }
    }
}

document.addEventListener("click", (e) => {
    const trigger = document.getElementById("profileTrigger");
    const dropdown = document.getElementById("profileDropdown");
    if (trigger?.contains(e.target)) {
        dropdown.classList.toggle("show");
        trigger.classList.toggle("rotate");
    } else if (!dropdown?.contains(e.target)) {
        dropdown?.classList.remove("show");
        trigger?.classList.remove("rotate");
    }
});

function goDashboard() { window.location.href = "dashboard.html"; }
function goProfile() { window.location.href = "settingacc.html"; }
function logout() { if (confirm("Yakin mau logout?")) { localStorage.clear(); window.location.href = "index.html"; } }

// ==========================================
// 5. UNIVERSAL POPUP SYSTEM
// ==========================================
function showPopup(msg, type = 'info') {
    let overlay = document.getElementById('uniOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'uniOverlay';
        overlay.className = 'uni-overlay';
        overlay.innerHTML = `
            <div class="uni-box">
                <div id="uniIcon" class="uni-icon"></div>
                <p id="uniMsg" class="uni-msg"></p>
                <button class="uni-btn" onclick="closePopup()">OK</button>
            </div>`;
        document.body.appendChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) closePopup(); }
    }
    const iconEl = document.getElementById('uniIcon');
    const msgEl = document.getElementById('uniMsg');
    msgEl.innerText = msg;
    iconEl.className = 'uni-icon ' + type;
    iconEl.innerHTML = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' :
        type === 'error' ? '<i class="fa-solid fa-circle-xmark"></i>' :
            '<i class="fa-solid fa-circle-info"></i>';
    setTimeout(() => overlay.classList.add('active'), 10);
}

window.showPopup = function (msg, type = 'info') {
    return new Promise((resolve) => {
        // 1. Bersihkan popup lama jika ada
        const existing = document.getElementById('uniOverlay');
        if (existing) existing.remove();

        // 2. Buat elemen baru
        const overlay = document.createElement('div');
        overlay.id = 'uniOverlay';
        overlay.className = 'uni-overlay';

        // 3. Tentukan Icon & Tombol berdasarkan Tipe
        let iconHtml = '';
        let btnsHtml = '';
        let iconClass = 'uni-icon';

        if (type === 'success') {
            // TIPE: BERHASIL (Hijau/Cyan - Ceklis)
            iconClass += ' success';
            iconHtml = '<i class="fa-solid fa-check"></i>';
            btnsHtml = `<button class="uni-btn" id="uniBtnOk">OK</button>`;

        } else if (type === 'error') {
            // TIPE: GAGAL (Merah - Silang)
            iconClass += ' error';
            iconHtml = '<i class="fa-solid fa-xmark"></i>';
            btnsHtml = `<button class="uni-btn" style="background:#ff4757; color:white;" id="uniBtnOk">OK</button>`;

        } else if (type === 'confirm') {
            // TIPE: CONFIRM (Kuning - Tanda Seru)
            iconClass += ' warning';
            iconHtml = '<i class="fa-solid fa-exclamation"></i>';
            btnsHtml = `
                <div class="uni-actions">
                    <button class="uni-btn-cancel" id="uniBtnNo">Tidak</button>
                    <button class="uni-btn-confirm" id="uniBtnYes">Iya</button>
                </div>
            `;
        } else {
            // Default Info
            iconClass += ' info';
            iconHtml = '<i class="fa-solid fa-info"></i>';
            btnsHtml = `<button class="uni-btn" id="uniBtnOk">OK</button>`;
        }

        // 4. Masukkan HTML
        overlay.innerHTML = `
            <div class="uni-box">
                <div class="${iconClass}">${iconHtml}</div>
                <p class="uni-msg">${msg}</p>
                ${btnsHtml}
            </div>`;

        document.body.appendChild(overlay);

        // Animasi Masuk
        setTimeout(() => overlay.classList.add('active'), 10);

        // --- LOGIC PENUTUPAN ---
        const close = (result) => {
            overlay.classList.remove('active');
            // Hapus listener keyboard biar gak numpuk
            document.removeEventListener('keydown', handleKey);

            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 300);

            resolve(result); // Kembalikan hasil (true/false) ke pemanggil
        };

        // --- EVENT HANDLERS ---

        // 1. Keyboard Shortcuts (Enter / Esc)
        const handleKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                close(true); // Enter = IYA / OK
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // Kalau confirm: Esc = Batal (false). Kalau info: Esc = Tutup (true/ok)
                if (type === 'confirm') close(false);
                else close(true);
            }
        };
        document.addEventListener('keydown', handleKey);

        // 2. Click Handlers
        if (type === 'confirm') {
            document.getElementById('uniBtnYes').onclick = () => close(true);
            document.getElementById('uniBtnNo').onclick = () => close(false);
            // Klik background = Batal
            overlay.onclick = (e) => { if (e.target === overlay) close(false); };
        } else {
            document.getElementById('uniBtnOk').onclick = () => close(true);
            // Klik background = OK
            overlay.onclick = (e) => { if (e.target === overlay) close(true); };
        }
    });
};

// Fungsi helper buat nutup paksa (jarang dipake krn skrg pake promise)
window.closePopup = function () {
    const overlay = document.getElementById('uniOverlay');
    if (overlay) overlay.click();
};