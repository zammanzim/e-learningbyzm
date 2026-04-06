// ============================================================
// THEME LOADER — js/theme.js
// Dipanggil di semua halaman, load SEBELUM CSS render (di <head>)
// ============================================================

(function () {
    const theme = JSON.parse(localStorage.getItem('user_theme') || '{}');

    const DEFAULT_BG = `linear-gradient(90deg,rgba(255,255,255,0.15)1px,transparent 1px),linear-gradient(0deg,rgba(255,255,255,0.15)1px,transparent 1px),linear-gradient(180deg,#353a50 0%,#505a6a 40%,#404560 70%,#2a2a45 100%)`;

    const bg = theme.bg || DEFAULT_BG;
    const accent = theme.accent || '#00eaff';
    const fontSize = theme.fontSize || 'sedang';

    const style = document.createElement('style');
    style.id = 'user-theme-override';
    let css = '';

    // --- 1. FONT SIZE ---
    const fontMap = { kecil: '13px', sedang: '15px', besar: '18px' };
    css += `html { font-size: ${fontMap[fontSize] || '15px'} !important; }\n`;

    // --- 2. BACKGROUND ---
    css += `body {
    background-image: ${bg} !important;
    background-repeat: repeat, repeat, no-repeat !important;
    background-size: 2.125rem 2.125rem, 2.125rem 2.125rem, cover !important;
    background-attachment: fixed !important;
}\n`;

    // --- 3. ACCENT COLOR ---
    const a = accent;
    // Set CSS variable supaya semua halaman bisa pakai var(--accent)
    document.documentElement.style.setProperty('--accent', a);
    const ar = parseInt(a.slice(1, 3), 16);
    const ag = parseInt(a.slice(3, 5), 16);
    const ab = parseInt(a.slice(5, 7), 16);
    const rgba = (op) => `rgba(${ar},${ag},${ab},${op})`;

    css += `
/* === ACCENT COLOR OVERRIDE === */
.sidebar li:hover i, .sidebar li:hover b,
.sidebar li.active a, .sidebar li.active i,
.glass-modal-box h3 i, .drop-icon,
.info-content-scroll h4,
.final-badge, .color-blue,
.hide-desk { color: ${a} !important; }

.sidebar li.active {
    background: linear-gradient(90deg, ${rgba('0.15')} 10%, ${rgba('0')} 100%) !important;
    border-left-color: ${a} !important;
}
.glass-input:focus {
    border-color: ${a} !important;
    box-shadow: 0 0 0 3px ${rgba('0.15')} !important;
}
.uni-btn, .glass-nav-btn.active,
input:checked + .slider,
input:focus + .slider { background: ${a} !important; }

.drop-area:hover, .drop-area.dragover,
.task-shortcut-box:hover { border-color: ${a} !important; }

.editable-active:focus,
.btn-add-inline:hover { background: ${rgba('0.1')} !important; }

.btn-tool:hover { color: ${a} !important; }

.color-opt.active { border-color: ${a} !important; }

/* welcomeText & glow ikut aksen */
#welcomeText {
    color: #e9f4ff !important;
    text-shadow: 0 0 4px ${a}, 0 0 8px ${a}, 0 0 12px ${a} !important;
}
.glow {
    text-shadow: 0 0 5px ${a}, 0 0 10px ${a}, 0 0 20px ${rgba('0.8')}, 0 0 40px ${rgba('0.5')} !important;
}

/* rgba overrides (background, shadow, border dengan opacity) */
.sidebar li.active {
    background: linear-gradient(90deg, ${rgba('0.15')} 10%, ${rgba('0')} 100%) !important;
}
.glass-input:focus {
    box-shadow: 0 0 0 3px ${rgba('0.15')} !important;
}
.btn-glass-save, btn-save {
    background: ${a} !important;
    box-shadow: 0 0 20px ${rgba('0.3')} !important;
}
.filter-slider-bg {
    background: ${a} !important;
    box-shadow: 0 0 25px ${rgba('0.5')} !important;
}
.btn-glass-save:hover, btn-save:hover {
    box-shadow: 0 0 30px ${rgba('0.5')} !important;
}
.current-pp {
    border-color: ${a} !important;
    box-shadow: 0 0 15px ${rgba('0.3')} !important;
}
.editable-active:focus { background: ${rgba('0.1')} !important; }
.btn-add-inline:hover  { background: ${rgba('0.1')} !important; }
.drop-area:hover, .drop-area.dragover { border-color: ${a} !important; }
.task-shortcut-box:hover { border-color: ${a} !important; }
.uni-btn { box-shadow: 0 4px 15px ${rgba('0.3')} !important; }
.final-badge { text-shadow: 0 0 10px ${rgba('0.8')}, 0 0 25px ${rgba('0.6')} !important; }

/* scrollbar */
::-webkit-scrollbar-thumb { background: ${a} !important; }

/* teks & highlight umum */
[style*="color:#00eaff"], [style*="color: #00eaff"] { color: ${a} !important; }
[style*="background:#00eaff"], [style*="background: #00eaff"],
[style*="border-color:#00eaff"] { background: ${a} !important; border-color: ${a} !important; }
`;

    style.textContent = css;

    // Inject sesegera mungkin supaya ga flicker
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
        });
    }
})();

// ============================================================
// BOTTOM NAV — inject SEBELUM render (non-defer, no blink)
// ============================================================
(function () {
    // Jangan di admin
    if (window.location.pathname.includes('/admiii/')) return;

    const NAV_ITEMS = [
        { id: 'announcements', icon: 'fa-solid fa-table-columns', label: 'Home', href: 'announcements' },
        { id: 'tugas', icon: 'fa-solid fa-list-check', label: 'Tugas', href: 'tugas' },
        { id: 'feed', icon: 'fa-solid fa-newspaper', label: 'Feed', href: 'feed' },
        { id: 'user', icon: 'fa-solid fa-circle-user', label: 'Profil', href: 'user' },
    ];

    const activeId = window.location.pathname.split('/').pop().replace('.html', '') || 'announcements';

    // ── CSS ──────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        #bottomNav {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 56px;
            background: rgba(8, 10, 18, 0.92);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            border-top: 1px solid rgba(255,255,255,0.08);
            display: flex;
            align-items: stretch;
            z-index: 8000;
            padding-bottom: env(safe-area-inset-bottom, 0px);
        }

        @media (min-width: 1024px) {
            #bottomNav { display: none !important; }
        }

        .bn-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            text-decoration: none;
            color: rgba(255,255,255,0.35);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.2px;
            transition: color .18s ease;
            position: relative;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
        }

        .bn-item i {
            font-size: 21px;
            margin: 0;
            transition: transform .22s cubic-bezier(.175,.885,.32,1.275);
        }

        .bn-item.active {
            color: var(--accent, #00eaff);
        }

        .bn-item.active i {
            transform: scale(1.18);
        }

        .bn-item::after {
            content: '';
            position: absolute;
            inset: 4px 8%;
            border-radius: 12px;
            background: var(--accent, #00eaff);
            opacity: 0;
            transition: opacity .12s ease;
            pointer-events: none;
        }
        .bn-item:active::after { opacity: 0.09; }

        /* Red dot badge */
        .bn-badge {
            position: absolute;
            top: 5px;
            right: calc(50% - 14px);
            min-width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ff3b30;
            border: 1.5px solid rgba(8,10,18,0.92);
            pointer-events: none;
            animation: bnBadgePop .3s cubic-bezier(.175,.885,.32,1.275);
        }
        /* Angka kalau > 0 */
        .bn-badge.has-count {
            min-width: 16px;
            height: 16px;
            border-radius: 8px;
            top: 3px;
            right: calc(50% - 18px);
            font-size: 9px;
            font-weight: 800;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 3px;
        }
        @keyframes bnBadgePop {
            from { transform: scale(0); }
            to   { transform: scale(1); }
        }

        /* Body padding biar konten gak ketutup nav */
        @media (max-width: 1023px) {
            body { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)) !important; }
        }

        /* FAB (subject-manager + tugas) naik di atas nav */
        @media (max-width: 1023px) {
            .admin-fab-container {
                bottom: calc(1.25rem + 56px + env(safe-area-inset-bottom, 0px)) !important;
            }
            .daily-fab-container {
                bottom: calc(1rem + 56px + env(safe-area-inset-bottom, 0px)) !important;
            }
            #fabNewPost {
                bottom: calc(24px + 56px + env(safe-area-inset-bottom, 0px)) !important;
            }
        }
    `;
    document.head.appendChild(style);

    // ── BADGE HELPERS ─────────────────────────────────────────
    const VISIT_PREFIX = 'bn_visit_';
    const ONE_DAY = 24 * 60 * 60 * 1000;

    function getUserId() {
        try { return JSON.parse(localStorage.getItem('user') || 'null')?.id || null; } catch { return null; }
    }

    // Tandai halaman ini sudah dikunjungi sekarang
    function markVisited(pageId) {
        localStorage.setItem(VISIT_PREFIX + pageId, Date.now().toString());
    }

    // Apakah badge dot harus tampil? (belum dikunjungi >24 jam)
    function shouldShowDot(pageId) {
        const last = parseInt(localStorage.getItem(VISIT_PREFIX + pageId) || '0');
        return (Date.now() - last) > ONE_DAY;
    }

    // Tugas: baca dari sessionStorage cache yang ditulis daily-card.js / tugas.js
    function getPendingTaskCount() {
        try {
            const uid = getUserId();
            if (!uid) return 0;
            const raw = sessionStorage.getItem(`task_badge_${uid}`);
            if (!raw) return 0;
            const { count, time } = JSON.parse(raw);
            // Cache max 10 menit
            if (Date.now() - time > 10 * 60 * 1000) return 0;
            return count || 0;
        } catch { return 0; }
    }

    function makeBadge(count = 0) {
        const b = document.createElement('span');
        if (count > 0) {
            b.className = 'bn-badge has-count';
            b.textContent = count > 99 ? '99+' : count;
        } else {
            b.className = 'bn-badge';
        }
        return b;
    }

    // ── NAV HTML ─────────────────────────────────────────────
    function injectNav() {
        if (document.getElementById('bottomNav')) return;

        // Tandai halaman aktif sudah dikunjungi
        markVisited(activeId);

        const nav = document.createElement('nav');
        nav.id = 'bottomNav';
        nav.setAttribute('aria-label', 'Navigasi utama');

        nav.innerHTML = NAV_ITEMS.map(({ id, icon, label, href }) => {
            const active = activeId === id || (activeId === '' && id === 'announcements');
            return `<a class="bn-item${active ? ' active' : ''}" href="${href}" aria-label="${label}" data-nav-id="${id}">
                <i class="${icon}"></i>
                <span>${label}</span>
            </a>`;
        }).join('');

        document.body.appendChild(nav);

        // Pasang badge awal
        updateBadges(nav);

        // Tap: prevent reload kalau udah active, scale feedback
        nav.querySelectorAll('.bn-item').forEach(a => {
            a.addEventListener('click', function (e) {
                if (this.classList.contains('active')) { e.preventDefault(); return; }
                const icon = this.querySelector('i');
                icon.style.transform = 'scale(0.8)';
                setTimeout(() => { icon.style.transform = ''; }, 140);
            });
        });
    }

    function updateBadges(nav) {
        const pendingTasks = getPendingTaskCount();

        nav.querySelectorAll('.bn-item').forEach(a => {
            const id = a.dataset.navId;
            // Hapus badge lama kalau ada
            a.querySelector('.bn-badge')?.remove();

            if (id === 'tugas') {
                // Tugas: badge angka dari pending tasks
                if (pendingTasks > 0) a.appendChild(makeBadge(pendingTasks));
            } else {
                // Halaman lain: dot merah kalau >24 jam belum dikunjungi
                if (id !== activeId && shouldShowDot(id)) a.appendChild(makeBadge(0));
            }
        });
    }

    // Update badge tugas setelah supabase ready (data baru)
    function waitAndUpdateTugasBadge() {
        const nav = document.getElementById('bottomNav');
        if (!nav) return;
        const tugasItem = nav.querySelector('[data-nav-id="tugas"]');
        if (!tugasItem) return;

        const uid = getUserId();
        if (!uid) return;

        // Poll sessionStorage sampai ada data (ditulis oleh daily-card.js atau tugas.js)
        let tries = 0;
        const poll = setInterval(() => {
            tries++;
            const count = getPendingTaskCount();
            if (count > 0 || tries > 20) {
                clearInterval(poll);
                tugasItem.querySelector('.bn-badge')?.remove();
                if (count > 0) tugasItem.appendChild(makeBadge(count));
            }
        }, 500);
    }

    if (document.body) {
        injectNav();
        waitAndUpdateTugasBadge();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            injectNav();
            waitAndUpdateTugasBadge();
        });
    }
})();