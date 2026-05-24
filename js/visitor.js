// ==========================================
// VISITOR SYSTEM — LIGHTWEIGHT
// ==========================================

const _getVisitorUser = () => {
    try {
        const data = localStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
};

// ==========================================
// 1. LOG KUNJUNGAN — 1 query, debounce 2 menit
// ==========================================
async function logVisitor() {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    const currentPage = (document.title || "Unknown Page")
        .replace(/\s*[•|·|-]\s*(E-Learning Nizam|Web Nizam).*/i, '')
        .trim() || "Unknown Page";

    // FILTER: Jangan catat judul sampah atau placeholder saat loading
    const ignoredTitles = [
        "loading", 
        "e-learning nizam", 
        "web nizam", 
        "e-learning nizam | web nizam",
        "unknown page"
    ];
    if (ignoredTitles.includes(currentPage.toLowerCase()) || !currentPage) return;

    // Ambil halaman sebelumnya dari sessionStorage
    const previousPage = sessionStorage.getItem('current_page_name') || 'Luar Web';
    sessionStorage.setItem('current_page_name', currentPage);

    // Debounce: skip kalau halaman & user sama dalam 2 menit terakhir
    const debounceKey = `visitor_log_${user.id}`;
    const last = JSON.parse(localStorage.getItem(debounceKey) || '{}');
    const now = Date.now();
    if (last.page === currentPage && (now - (last.ts || 0)) < 2 * 60 * 1000) return;

    try {
        // Upsert ke visitors tetap untuk status Online
        const { error } = await supabase.from("visitors").upsert({
            user_id: user.id,
            class_id: getEffectiveClassId() || user.class_id,
            is_visible: true,
            last_page: currentPage,
            visited_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        if (!error) {
            localStorage.setItem(debounceKey, JSON.stringify({ page: currentPage, ts: now }));
            // Log navigasi mendetail: "Dari [Halaman A] ke [Halaman B]"
            logActivity(`Navigasi: ${previousPage} -> ${currentPage}`, "Navigation", 5, `nav_${currentPage.toLowerCase().replace(/\s+/g, '_')}`);
        }
    } catch (err) { console.error("Log Error:", err); }
}

// ==========================================
// 1.5 LOG AKTIVITAS (BUAT LEADERBOARD)
// ==========================================
// Irit database: Pake sessionStorage biar 1 aksi cuma dicatat 1x per sesi
async function logActivity(action, page, points = 1, uniqueId = "") {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    const userId = user.id;
    const actionId = action.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    const activityKey = `act_${userId}_${actionId}_${uniqueId}`;
    
    // 1. ANTI-SPAM: Jika aksi ini sama persis dengan aksi TERAKHIR (misal: refresh halaman)
    const lastKey = sessionStorage.getItem('last_activity_key');
    if (activityKey === lastKey) return;

    // 2. LOGIC TOGGLE: 
    // - Jika Navigation: Boleh berulang (a > b > a) tapi tidak boleh refresh (a > a).
    // - Jika Materi/Tugas: Tetap 1x per sesi (agar tidak bisa farming poin klik card).
    if (page !== "Navigation") {
        if (sessionStorage.getItem(activityKey)) {
            console.log(`logActivity: Content "${action}" already logged in this session.`);
            return;
        }
    }

    const classId = (typeof getEffectiveClassId === 'function') 
        ? getEffectiveClassId() 
        : (user.class_id || "unknown");

    try {
        const { error } = await supabase.from("activity_logs").insert({
            user_id: userId,
            action_text: action,
            page_name: page,
            points: points,
            class_id: classId,
            reference_id: uniqueId // Simpan ID unik materi/tugas/halaman
        });

        if (!error) {
            sessionStorage.setItem(activityKey, "true");
            sessionStorage.setItem('last_activity_key', activityKey); // Catat sebagai aksi terakhir
            console.log(`%cActivity Logged: ${action} (+${points} pts)`, "color: #0be881; font-weight: bold;");
        }
    } catch (err) { console.error("Activity Log Execution Error:", err); }
}

// ==========================================
// 2. BADGE COUNT — via Realtime, tanpa polling
// ==========================================
let _visitorCountChannel = null;

async function initVisitorBadge() {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    // Fetch count sekali saat load
    await refreshVisitorCount(user);

    // Dengerin perubahan → update badge otomatis
    if (_visitorCountChannel) return;
    _visitorCountChannel = supabase
        .channel('visitor_badge')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'visitors',
            filter: `class_id=eq.${getEffectiveClassId() || user.class_id}`
        }, () => refreshVisitorCount(user))
        .subscribe();

    window.addEventListener('pagehide', () => {
        if (_visitorCountChannel) {
            _visitorCountChannel.unsubscribe();
            _visitorCountChannel = null;
        }
    }, { once: true });
}

async function refreshVisitorCount(user) {
    try {
        const { count, error } = await supabase
            .from('visitors')
            .select('user_id', { count: 'exact', head: true })
            .eq('class_id', getEffectiveClassId() || user.class_id)
            .eq('is_visible', true);

        if (!error) {
            const finalCount = count || 0;
            localStorage.setItem('cached_visitor_count', finalCount);
            const badge = document.getElementById("headerVisitorCount");
            if (badge) badge.innerText = finalCount;
        }
    } catch (err) { console.error("Badge Count Error:", err); }
}

// ==========================================
// 3. POPUP — fetch HANYA saat dibuka
// ==========================================
let _visitorPopupChannel = null;

async function renderVisitorStats() {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    // Tampilkan skeleton dulu saat popup dibuka
    const listEl = document.getElementById("visitorList");
    if (listEl) {
        listEl.innerHTML = Array.from({ length: 3 }, () => `
            <div class="visitor-item">
                <div class="dc-skel" style="width:30px; height:30px; border-radius:50%; flex-shrink:0;"></div>
                <div style="flex:1; margin-left:10px;">
                    <div class="dc-skel" style="height:12px; width:${60 + Math.floor(Math.random() * 60)}px; margin-bottom:6px; border-radius:6px;"></div>
                    <div class="dc-skel" style="height:10px; width:${80 + Math.floor(Math.random() * 50)}px; border-radius:6px;"></div>
                </div>
            </div>`).join('');
    }

    try {
        const { data, error } = await supabase
            .from('visitors')
            .select('user_id, visited_at, last_page, user:users(full_name, avatar_url, nickname)')
            .eq('class_id', getEffectiveClassId() || user.class_id)
            .eq('is_visible', true)
            .order('visited_at', { ascending: false });

        if (error) throw error;

        // Dedup di DB harusnya sudah unique per user_id, tapi jaga-jaga
        const uniqueMap = new Map();
        data.forEach(v => { if (!uniqueMap.has(v.user_id)) uniqueMap.set(v.user_id, v); });

        const badge = document.getElementById("headerVisitorCount");
        if (badge) {
            badge.innerText = uniqueMap.size;
            localStorage.setItem('cached_visitor_count', uniqueMap.size);
        }

        const popupCount = document.getElementById("popupVisitorCount");
        if (popupCount) popupCount.innerText = uniqueMap.size;

        const listEl2 = document.getElementById("visitorList");
        if (!listEl2) return;

        listEl2.innerHTML = uniqueMap.size === 0
            ? '<p style="color:#aaa; font-size:12px;">Belum ada yang mampir.</p>'
            : '';

        uniqueMap.forEach(v => {
            const u = v.user || {};
            const nickname = u.nickname || u.full_name || 'User';
            const avatar = u.avatar_url || '../icons/profpicture.png';

            const ts = new Date(v.visited_at);
            const tanggal = ts.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
            const jam = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            const item = document.createElement('div');
            item.className = 'visitor-item';
            item.innerHTML = `
                <img src="${avatar}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; flex-shrink:0;">
                <div style="flex:1; margin-left:10px;">
                    <div style="font-size:13px; font-weight:bold;">${nickname}</div>
                    <div style="font-size:11px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <span style="color:var(--accent, #00eaff);">${v.last_page || 'Muter-muter'}</span>
                        <span style="color:#aaa; white-space:nowrap;">${tanggal} • ${jam}</span>
                    </div>
                </div>`;
            listEl2.appendChild(item);
        });

        const adminActions = document.querySelector(".admin-actions");
        if (adminActions) {
            const isAdmin = user.role === 'class_admin' || user.role === 'super_admin';
            adminActions.style.display = isAdmin ? 'block' : 'none';
        }
    } catch (err) { console.error("Stats Error:", err); }
}

// ==========================================
// 4. EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const user = _getVisitorUser();
    if (!user) return;

    const trigger = document.getElementById("visitorTrigger");
    const overlay = document.getElementById("visitorOverlay");
    const closeBtn = document.getElementById("closeVisitorPopup");
    const resetBtn = document.getElementById("resetVisitorBtn");

    // Jalankan log + badge saat halaman load
    logVisitor();
    initVisitorBadge();

    // Buka popup → baru fetch list
    if (trigger) {
        trigger.onclick = () => {
            overlay?.classList.add("show");
            renderVisitorStats();

            // Realtime di dalam popup (hanya admin)
            const isAdmin = user.role === 'super_admin' || user.role === 'class_admin';
            if (isAdmin && !_visitorPopupChannel) {
                _visitorPopupChannel = supabase
                    .channel('visitor_popup')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'visitors',
                        filter: `class_id=eq.${getEffectiveClassId() || user.class_id}`
                    }, () => renderVisitorStats())
                    .subscribe();
            }
        };
    }

    // Tutup popup → matiin realtime popup
    const closeAction = () => {
        overlay?.classList.remove("show");
        if (_visitorPopupChannel) {
            _visitorPopupChannel.unsubscribe();
            _visitorPopupChannel = null;
        }
    };

    if (closeBtn) closeBtn.onclick = closeAction;
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) closeAction(); };

    // Shortcut Ctrl+Q → buka/tutup visitor popup
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'q') {
            e.preventDefault();
            if (overlay?.classList.contains('show')) {
                closeAction();
            } else {
                trigger?.click();
            }
        }
    });

    // Reset (admin only)
    if (resetBtn) {
        resetBtn.onclick = async () => {
            if (user.role !== 'class_admin' && user.role !== 'super_admin') return;

            const yakin = await showPopup("Bersihkan list pengunjung hari ini?", "confirm");
            if (!yakin) return;

            resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';
            try {
                const { error } = await supabase
                    .from('visitors')
                    .update({ is_visible: false })
                    .eq('class_id', getEffectiveClassId() || user.class_id);

                if (error) throw error;
                showToast("List pengunjung telah di-reset!", "success");
            } catch (err) {
                console.error("Reset Error:", err);
                showPopup("Gagal reset data", "error");
            } finally {
                resetBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reset Today (Admin)';
            }
        };
    }

    // --- GLOBAL CLICK CAPTURE FOR ACTIVITY LOGS ---
    document.addEventListener('click', (e) => {
        // 1. Klik Kartu Materi (Buka Detail)
        const card = e.target.closest('.course-card');
        if (card && card.classList.contains('clickable-card')) {
            // Jangan catat kalau yang diklik tombol action (delete/bookmark)
            if (!e.target.closest('button') && !e.target.closest('input')) {
                const title = card.querySelector('h3')?.innerText || 'Materi';
                const id = card.dataset.id || "";
                logActivity(`Membaca Materi: ${title}`, "Subject", 5, id);
            }
        }

        // 2. Klik Tombol Selesai Tugas
        const taskBtn = e.target.closest('.task-btn');
        if (taskBtn && !taskBtn.hasAttribute('disabled')) {
            const isDone = taskBtn.classList.contains('done');
            if (!isDone) { // Hanya catat saat mencentang SELESAI
                const cardTugas = taskBtn.closest('.course-card');
                const titleTugas = cardTugas?.querySelector('h3')?.innerText || 'Tugas';
                const idTugas = cardTugas?.dataset.id || "";
                logActivity(`Menyelesaikan Tugas: ${titleTugas}`, "Tugas", 10, idTugas);
            }
        }
    });
});