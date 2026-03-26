// ==========================================
// PWA — SERVICE WORKER REGISTER (GLOBAL)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] SW terdaftar:', reg.scope))
            .catch(err => console.warn('[PWA] SW gagal:', err));
    });
}

// ==========================================
// CLASS SWITCHER — Super Admin only
// ==========================================
function getEffectiveClassId() {
    try {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) return null;
        // Super admin bisa override class_id via sessionStorage
        if (user.role === 'super_admin') {
            const override = sessionStorage.getItem('class_override');
            if (override) return override;
        }
        return String(user.class_id);
    } catch(e) { return null; }
}

function getEffectiveClassName() {
    try {
        const override = sessionStorage.getItem('class_override_name');
        if (override) return override;
        const user = JSON.parse(localStorage.getItem("user"));
        return user?.class_name || `Kelas ${user?.class_id}` || '';
    } catch(e) { return ''; }
}

async function switchClass(classId, className) {
    if (classId === getEffectiveClassId()) return;
    sessionStorage.setItem('class_override', classId);
    sessionStorage.setItem('class_override_name', className);
    // Hapus cache sidebar biar langsung fetch ulang untuk kelas baru
    const cacheKey = `sidebar_cache_${classId}`;
    if (!localStorage.getItem(cacheKey)) {
        localStorage.removeItem(`sidebar_cache_${getEffectiveClassId()}`);
    }
    // Reload halaman yang sekarang biar data ke-refresh sesuai kelas baru
    window.location.reload();
}

function toggleClassSwitcher() {
    const menu = document.getElementById('classSwitcher');
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        // Tutup kalau klik di luar
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!document.getElementById('classSwitcherWrapper')?.contains(e.target)) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', handler);
                }
            });
        }, 10);
    }
}

async function renderClassSwitcher() {
    const user = JSON.parse(localStorage.getItem("user") || 'null');
    if (!user || user.role !== 'super_admin') return;

    const switcher = document.getElementById('classSwitcher');
    const wrapper = document.getElementById('classSwitcherWrapper');
    const label = document.getElementById('classSwitcherLabel');
    if (!switcher || !wrapper) return;

    const { data: classes } = await supabase.from('classes').select('id, name').order('id');
    if (!classes || classes.length === 0) return;

    const current = getEffectiveClassId();
    const currentClass = classes.find(c => String(c.id) === current);
    if (label) label.innerText = currentClass?.name || `Kelas ${current}`;

    switcher.innerHTML = classes.map(c => `
        <div onclick="switchClass('${c.id}', '${c.name}')" style="
            padding:10px 14px; font-size:13px; cursor:pointer;
            color:${String(c.id) === current ? 'var(--accent, #00eaff)' : '#ddd'};
            background:${String(c.id) === current ? 'rgba(0, 234, 255, 0.08)' : 'transparent'};
            display:flex; align-items:center; gap:8px;
            transition:background 0.15s;
        " onmouseover="this.style.background='rgba(255,255,255,0.05)'"
           onmouseout="this.style.background='${String(c.id) === current ? 'rgba(0, 234, 255, 0.08)' : 'transparent'}'">
            ${String(c.id) === current ? '<i class="fa-solid fa-check" style="font-size:10px; color:var(--accent, #00eaff);"></i>' : '<span style="width:12px;"></span>'}
            ${c.name}
        </div>`).join('');

    wrapper.style.display = 'flex';
}

// ==========================================
// 1. AUTO RUN SAAT HALAMAN DIMUAT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    renderSidebar();
    syncHeaderProfile();
    renderClassSwitcher();

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
            headerName.innerText = `Haii, ${user.short_name || user.nickname || 'User'}`;
        }
        if (headerPP) {
            headerPP.src = user.avatar_url || "../icons/profpicture.png";
        }
    } catch (e) { console.error("Sync Profile Error:", e); }
}
// ==========================================
// 3. UNIFIED SIDEBAR RENDERER (CACHE-FIRST + REALTIME)
// ==========================================
let _sidebarChannel = null;

async function renderSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    let user;
    try {
        user = JSON.parse(localStorage.getItem("user"));
    } catch (e) { return; }
    if (!user) return;

    const CLASS_ID = getEffectiveClassId() || String(user.class_id);
    const CACHE_KEY = `sidebar_cache_${CLASS_ID}`;
    const cachedRaw = localStorage.getItem(CACHE_KEY);

    let cacheValid = false;

    // 1. Coba render dari cache dulu
    if (cachedRaw) {
        try {
            const cached = JSON.parse(cachedRaw);
            // Cache dianggap valid kalau isinya array dan tidak kosong
            if (Array.isArray(cached) && cached.length > 0) {
                processAndRenderSidebar(cached, user);
                cacheValid = true;
            } else {
                // Cache kosong/corrupt → hapus
                localStorage.removeItem(CACHE_KEY);
            }
        } catch (e) {
            // JSON corrupt → hapus
            localStorage.removeItem(CACHE_KEY);
        }
    }

    if (!cacheValid) {
        // Tidak ada cache → tunggu fetch selesai (blocking)
        await fetchAndCacheSidebar(CLASS_ID, user, CACHE_KEY);
    } else {
        // Ada cache → SELALU fetch background tiap page load
        // Biar perubahan menu dari admin selalu ketangkap meski user lagi offline
        fetchAndCacheSidebar(CLASS_ID, user, CACHE_KEY).catch(() => {});
    }

    // 3. Setup realtime
    setupSidebarRealtime(CLASS_ID, user, CACHE_KEY);
}

async function fetchAndCacheSidebar(CLASS_ID, user, CACHE_KEY, retryCount = 0) {
    // Tunggu supabase ready (race condition fix)
    if (typeof supabase === 'undefined') {
        if (retryCount >= 5) { console.error("Supabase tidak ready"); return; }
        await new Promise(r => setTimeout(r, 300));
        return fetchAndCacheSidebar(CLASS_ID, user, CACHE_KEY, retryCount + 1);
    }

    try {
        const { data, error } = await supabase
            .from('subjects_config')
            .select('*')
            .eq('class_id', CLASS_ID)
            .order('display_order', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return; // Jangan overwrite cache dengan data kosong

        // Bandingkan berdasarkan id + display_order, bukan raw string
        // (JSON.stringify order bisa beda meski data sama)
        const oldRaw = localStorage.getItem(CACHE_KEY);
        const oldIds = oldRaw
            ? JSON.parse(oldRaw).map(x => `${x.id}-${x.display_order}-${x.subject_name}-${x.badge}`).sort().join(',')
            : '';
        const newIds = data.map(x => `${x.id}-${x.display_order}-${x.subject_name}-${x.badge}`).sort().join(',');

        if (newIds !== oldIds) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            processAndRenderSidebar(data, user);
        }
    } catch (err) {
        console.error("Fetch Sidebar Error:", err);
        // Retry sekali kalau gagal
        if (retryCount === 0) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchAndCacheSidebar(CLASS_ID, user, CACHE_KEY, 1);
        }
    }
}

function setupSidebarRealtime(CLASS_ID, user, CACHE_KEY) {
    // Kalau channel sudah jalan, skip — tidak perlu buat lagi
    if (_sidebarChannel) return;

    _sidebarChannel = supabase
        .channel('sidebar_config_changes')
        .on('postgres_changes', {
            event: '*',         // INSERT, UPDATE, DELETE semua dipantau
            schema: 'public',
            table: 'subjects_config',
            filter: `class_id=eq.${CLASS_ID}`
        }, async () => {
            // Admin ubah sesuatu → fetch ulang, update cache, re-render langsung
            console.log('[Sidebar] Config berubah, memperbarui menu...');
            await fetchAndCacheSidebar(CLASS_ID, user, CACHE_KEY);
        })
        .subscribe();

    // Bersihkan saat user tutup/reload halaman
    window.addEventListener('pagehide', () => {
        if (_sidebarChannel) {
            _sidebarChannel.unsubscribe();
            _sidebarChannel = null;
        }
    }, { once: true });
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
            color: "var(--accent, #00eaff)", // Warna khusus biru neon
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

    // Restore posisi scroll terakhir
    const savedScroll = sessionStorage.getItem('sidebar_scroll');
    if (savedScroll) {
        sidebar.scrollTop = parseInt(savedScroll);
    }

    // Simpan posisi scroll setiap kali user scroll sidebar
    sidebar.addEventListener('scroll', () => {
        sessionStorage.setItem('sidebar_scroll', sidebar.scrollTop);
    }, { passive: true });
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

function goAnnouncements() { window.location.href = "announcements"; }
function goProfile() { window.location.href = "settingacc"; }

// ==========================================
// 5. UNIVERSAL POPUP SYSTEM
// ==========================================
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

// ===== PWA INSTALL — dihandle langsung di announcements.html =====