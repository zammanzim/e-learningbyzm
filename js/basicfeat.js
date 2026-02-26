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
            headerPP.src = user.avatar_url || "../icons/profpicture.png";
        }
    } catch (e) { console.error("Sync Profile Error:", e); }
}
// ==========================================
// 3. UNIFIED SIDEBAR RENDERER (SWR + FIX ICON)
// ==========================================
async function renderSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    const CLASS_ID = String(user.class_id);
    const CACHE_KEY = `sidebar_cache_${CLASS_ID}`;

    // 1. Ambil data dari Cache (Stale)
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        try {
            processAndRenderSidebar(JSON.parse(cachedData), user);
        } catch (e) { console.error("Cache Parse Error"); }
    }

    // 2. Revalidate (Ambil data segar dari Supabase)
    try {
        const { data: freshData, error } = await supabase
            .from('subjects_config')
            .select('*')
            .eq('class_id', CLASS_ID)
            .order('display_order', { ascending: true });

        if (error) throw error;

        // 3. Bandingkan data. Jika beda / cache kosong, update & simpan
        const freshDataString = JSON.stringify(freshData);
        if (freshDataString !== cachedData) {
            localStorage.setItem(CACHE_KEY, freshDataString);
            processAndRenderSidebar(freshData, user);
            console.log("Sidebar: Data refreshed from server.");
        }
    } catch (err) {
        console.error("Fetch Sidebar Error:", err);
    }
}

function processAndRenderSidebar(allConfigs, user) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !allConfigs) return;

    const role = user.role;
    const isInAdminFolder = window.location.pathname.includes('/admiii/');
    const rootPrefix = isInAdminFolder ? '../' : '';
    const adminPrefix = isInAdminFolder ? '' : 'admiii/';

    // 1. Filter Grup Berdasarkan menu_group dari Database
    const systemItems = allConfigs.filter(m => m.menu_group === 'system');
    const adminItems = allConfigs.filter(m => m.menu_group === 'admin');
    const mainItems = allConfigs.filter(m => m.menu_group === 'main');
    const lessonItems = allConfigs.filter(m => m.menu_group === 'lessons');

    let menuGroups = [];

    // --- GRUP 1: SYSTEM MENU (Hanya untuk Super Admin) ---
    if (role === 'super_admin' && systemItems.length > 0) {
        menuGroups.push({
            header: "System Menu",
            color: "#00eaff", // Warna khusus biru neon
            items: systemItems.map(m => ({ ...m, url: adminPrefix + m.subject_id }))
        });
    }

    // --- GRUP 2: ADMIN PANEL (Untuk Super Admin & Class Admin) ---
    if ((role === 'class_admin' || role === 'super_admin') && adminItems.length > 0) {
        menuGroups.push({
            header: "Admin Panel",
            color: "#ffd700", // Warna emas
            items: adminItems.map(m => ({ ...m, url: adminPrefix + m.subject_id }))
        });
    }

    // --- GRUP 3: MAIN MENU (Untuk Semua User) ---
    if (mainItems.length > 0) {
        menuGroups.push({
            header: "Main Menu",
            items: mainItems.map(m => ({ ...m, url: rootPrefix + m.subject_id }))
        });
    }

    // --- GRUP 4: LESSONS (Untuk Semua User) ---
    if (lessonItems.length > 0) {
        menuGroups.push({
            header: "Lessons",
            items: lessonItems.map(L => ({ ...L, url: `${rootPrefix}subject?id=${L.subject_id}` }))
        });
    }

    // 2. Generate HTML (Logika Render Tetap Sama)
    const currentPath = window.location.pathname.toLowerCase();
    const currentId = new URLSearchParams(window.location.search).get('id')?.toLowerCase();

    let htmlContent = "";
    menuGroups.forEach(group => {
        const headerStyle = group.color ? `style="color:${group.color};"` : "";
        htmlContent += `<h3 ${headerStyle}>${group.header}</h3><ul>`;

        group.items.forEach(item => {
            const itemUrl = item.url.toLowerCase();
            let isActive = "";

            // Logic Active Menu: Cek ID di URL atau akhiran Path
            if (itemUrl.includes('id=')) {
                if (currentId === itemUrl.split('id=')[1]) isActive = "active";
            } else {
                if (currentPath.endsWith(itemUrl.split('/').pop())) isActive = "active";
            }

            let iconClass = item.icon || "fa-solid fa-book";
            if (iconClass && !iconClass.includes(" ")) {
                iconClass = `fa-solid ${iconClass}`; // Fix icon otomatis
            }

            const badgeHtml = item.badge ? `<span class="sidebar-badge ${item.badge_type || 'badge-new'}">${item.badge}</span>` : "";

            htmlContent += `
            <li class="${isActive}">
                <a href="${item.url}">
                    <i class="${iconClass}"></i> <span>${item.subject_name}</span>
                </a>
                ${badgeHtml}
            </li>`;
        });
        htmlContent += `</ul>`;
    });

    sidebar.innerHTML = htmlContent;

    // Scroll otomatis ke menu yang aktif
    const activeItem = sidebar.querySelector(".active");
    if (activeItem) {
        setTimeout(() => activeItem.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
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
        const isOpen = sidebar.classList.contains("open");
        if (!isOpen) {
            sidebar.classList.add("open");
            hamburger.classList.add("active");
            overlay.classList.add("show");
            overlay.onclick = toggleMenu;
            document.body.style.overflow = "hidden";
            history.pushState({ type: 'overlay', target: 'sidebar' }, ''); // Catat di history
        } else {
            sidebar.classList.remove("open");
            hamburger.classList.remove("active");
            overlay.classList.remove("show");
            document.body.style.overflow = "";
            // Jangan pushState di sini, popstate yang akan menangani jika user mencet back
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

function goDashboard() { window.location.href = "dashboard"; }
function goProfile() { window.location.href = "settingacc"; }

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

// --- NAVIGATION CONTROLLER (Back & Esc) ---
window.addEventListener('popstate', () => {
    closeActiveOverlays(false); // Tutup tanpa pindah history lagi
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const active = getActiveOverlay();
        if (active) history.back(); // Trigger popstate
    }
});

function getActiveOverlay() {
    return document.querySelector('.detail-overlay.active, .modal-overlay:not(.hidden), .uni-overlay.active, .visitor-overlay.active, #sidebar.open');
}

function closeActiveOverlays(shouldGoBack = true) {
    // 1. Detail Overlay
    const detail = document.getElementById('detailOverlay');
    if (detail?.classList.contains('active')) {
        if (typeof closeDetail === 'function') closeDetail();
        else detail.classList.remove('active');
        return;
    }
    // 2. Add Modal
    const addModal = document.getElementById('addModal');
    if (addModal && !addModal.classList.contains('hidden')) {
        addModal.classList.add('hidden');
        if (typeof SubjectApp !== 'undefined') SubjectApp.clearForm();
        return;
    }
    // 3. Universal Popup (showPopup)
    const uni = document.getElementById('uniOverlay');
    if (uni?.classList.contains('active')) {
        if (typeof closePopup === 'function') closePopup();
        return;
    }
    // 4. Visitor Overlay
    const visitor = document.getElementById('visitorOverlay');
    if (visitor?.classList.contains('active')) {
        visitor.classList.remove('active');
        return;
    }
    // 5. Sidebar (Mobile)
    const sidebar = document.getElementById("sidebar");
    if (sidebar?.classList.contains('open')) {
        toggleMenu();
        return;
    }
}

// Tambahkan pemicu history untuk Visitor Overlay (jika ada script bukanya)
document.getElementById('visitorTrigger')?.addEventListener('click', () => {
    const v = document.getElementById('visitorOverlay');
    v.classList.add('active');
    history.pushState({ type: 'overlay', target: 'visitor' }, '');
});
document.getElementById('closeVisitorPopup')?.addEventListener('click', () => {
    if (document.getElementById('visitorOverlay').classList.contains('active')) history.back();
});

// ===== PWA SW REGISTER =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(() => { });
    });
}

// ===== PWA INSTALL HANDLER =====
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const box = document.getElementById('installBox');
    if (box) box.style.display = 'block';
});

document.addEventListener('click', async (e) => {
    if (e.target.id === 'installBtn') {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;

        const box = document.getElementById('installBox');
        if (box) box.style.display = 'none';
    }
});

// ===== PWA INSTALL UI =====

// tampilkan tombol saat ready
window.addEventListener('pwa-ready', () => {
    const box = document.getElementById('installBox');
    if (box) box.style.display = 'block';
});

// klik tombol → install
document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'installBtn') {
        if (!window.__pwaPrompt) return;

        window.__pwaPrompt.prompt();
        await window.__pwaPrompt.userChoice;
        window.__pwaPrompt = null;

        const box = document.getElementById('installBox');
        if (box) box.style.display = 'none';
    }
});