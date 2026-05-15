// ==========================================
// SCROLL LOCK — global, scroll position safe
// ==========================================
let _scrollLockCount = 0;
let _scrollLockY = 0;

window.lockScroll = function () {
    _scrollLockCount++;
    if (_scrollLockCount > 1) return;
    _scrollLockY = window.scrollY;
    
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    if (sbWidth > 0) document.body.style.paddingRight = sbWidth + 'px';
    
    // Trik ampuh buat mobile: position fixed + top negative
    document.body.style.top = `-${_scrollLockY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
};

window.unlockScroll = function () {
    if (_scrollLockCount <= 0) return;
    _scrollLockCount = Math.max(0, _scrollLockCount - 1);
    if (_scrollLockCount > 0) return;

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    window.scrollTo(0, _scrollLockY);
};







// ==========================================
// 1. AUTO RUN SAAT HALAMAN DIMUAT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
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
            headerName.innerText = `Haii, ${user.short_name || user.nickname || 'User'}`;
        }
        if (headerPP) {
            headerPP.src = user.avatar_url || "../icons/profpicture.png";
        }
    } catch (e) { console.error("Sync Profile Error:", e); }
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
            lockScroll();
            history.pushState({ type: 'overlay', target: 'sidebar' }, ''); // Catat di history
        } else {
            sidebar.classList.remove("open");
            hamburger.classList.remove("active");
            overlay.classList.remove("show");
            document.body.style.overflow = "";
            unlockScroll();
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
        lockScroll();

        // Animasi Masuk
        setTimeout(() => overlay.classList.add('active'), 10);

        // --- LOGIC PENUTUPAN ---
        const close = (result) => {
            overlay.classList.remove('active');
            unlockScroll();
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
        unlockScroll();
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
        unlockScroll();
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
    lockScroll();
    history.pushState({ type: 'overlay', target: 'visitor' }, '');
});
document.getElementById('closeVisitorPopup')?.addEventListener('click', () => {
    const v = document.getElementById('visitorOverlay');
    if (v?.classList.contains('active')) {
        v.classList.remove('active');
        unlockScroll();
        history.back();
    }
});