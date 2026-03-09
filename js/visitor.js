// ==========================================
// VISITOR SYSTEM (MANUAL RESET ONLY)
// ==========================================

const _getVisitorUser = () => {
    try {
        const data = localStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
};

// [HAPUS] Fungsi getResetTime tidak lagi digunakan

// 1. LOGIC MENCATAT KUNJUNGAN
async function logVisitor() {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    try {
        const currentPage = document.title || "Unknown Page";
        if (currentPage.toLowerCase().includes("loading")) return;
        const now = new Date();

        // Cari data user ini (kapanpun terakhir dia masuk)
        const { data: list, error: fetchError } = await supabase.from("visitors")
            .select("id, visited_at, last_page")
            .eq("user_id", user.id)
            .eq("class_id", user.class_id)
            .order('visited_at', { ascending: false })
            .limit(1);

        if (fetchError) console.error("Visitor Fetch Error:", fetchError);

        const existing = (list && list.length > 0) ? list[0] : null;

        if (existing) {
            // User lama login lagi -> UPDATE waktu & Munculkan kembali (is_visible: true)
            const diffMin = (now - new Date(existing.visited_at)) / 60000;

            // Update jika sudah beda 1 menit atau beda halaman
            if (diffMin >= 1 || existing.last_page !== currentPage) {
                const { error: updateError } = await supabase.from("visitors").update({
                    visited_at: now.toISOString(),
                    is_visible: true, // Pastikan user MUNCUL lagi setelah di-reset admin
                    last_page: currentPage
                }).eq("id", existing.id);

                if (updateError) console.error("Visitor Update Error:", updateError);
                else renderVisitorStats();
            }
        } else {
            // User benar-benar baru -> INSERT
            const { error: insertError } = await supabase.from("visitors").insert({
                user_id: user.id,
                class_id: user.class_id,
                is_visible: true,
                last_page: currentPage,
                visited_at: now.toISOString()
            });

            if (insertError) console.error("Visitor Insert Error:", insertError);
            else renderVisitorStats();
        }
    } catch (err) { console.error("Log Error:", err); }
}

// 2. RENDER STATISTIK & ADMIN PANEL
async function renderVisitorStats() {
    if (typeof supabase === 'undefined') return;
    const user = _getVisitorUser();
    if (!user) return;

    try {
        // OPTIMASI: Minta database hitung total unik, jangan tarik semua baris!
        const { count: totalCount, error: errTotal } = await supabase
            .from('visitors')
            .select('user_id', { count: 'exact', head: true })
            .eq('class_id', user.class_id);

        // Ambil data pengunjung yang aktif (is_visible)
        const { data: todayData, error: errToday } = await supabase
            .from('visitors')
            .select('user_id, visited_at, last_page, user:users (full_name, avatar_url, nickname)')
            .eq('class_id', user.class_id)
            .eq('is_visible', true)
            .order('visited_at', { ascending: false });

        if (errToday || errTotal) {
            console.error("Stats Render Error:", errToday || errTotal);
            return;
        }

        // Deduplikasi user di sisi client
        const uniqueTodayMap = new Map();
        todayData.forEach(v => {
            if (!uniqueTodayMap.has(v.user_id)) uniqueTodayMap.set(v.user_id, v);
        });

        // Fetch nickname untuk guest (user_id yang join-nya null)
        const guestIds = [...uniqueTodayMap.values()]
            .filter(v => !v.user && String(v.user_id).startsWith('guest_'))
            .map(v => v.user_id);

        const guestMap = new Map();
        if (guestIds.length > 0) {
            try {
                const { data: guestRows } = await supabase
                    .from('guests')
                    .select('id, nickname')
                    .in('id', guestIds);
                (guestRows || []).forEach(g => guestMap.set(g.id, g.nickname));
            } catch (e) { /* silent fail */ }
        }

        // Update UI Berdasarkan ID yang ada di HTML kamu
        if (document.getElementById("headerVisitorCount"))
            document.getElementById("headerVisitorCount").innerText = uniqueTodayMap.size;
        if (document.getElementById("popupToday"))
            document.getElementById("popupToday").innerText = uniqueTodayMap.size;
        if (document.getElementById("popupTotal"))
            document.getElementById("popupTotal").innerText = totalCount || 0;

        // Render List Pengunjung ke Modal
        const listEl = document.getElementById("visitorList");
        if (listEl) {
            listEl.innerHTML = uniqueTodayMap.size === 0 ? '<p style="color:#aaa; font-size:12px;">Belum ada yang mampir.</p>' : '';
            uniqueTodayMap.forEach(v => {
                const u = v.user || {};
                const isGuest = !v.user && String(v.user_id).startsWith('guest_');
                const nickname = isGuest
                    ? (guestMap.get(v.user_id) || 'Tamu')
                    : (u.nickname || u.full_name || 'User');
                const avatar = u.avatar_url || '../icons/profpicture.png';

                const item = document.createElement('div');
                item.className = 'visitor-item';
                item.innerHTML = `
                    <div style="position:relative; flex-shrink:0;">
                        <img src="${avatar}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        ${isGuest ? '<span style="position:absolute;bottom:-2px;right:-2px;font-size:9px;background:#7c3aed;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;">👤</span>' : ''}
                    </div>
                    <div style="flex:1; margin-left:10px;">
                        <div style="font-size:13px; font-weight:bold;">
                            ${nickname}${isGuest ? ' <span style="font-size:10px;color:#a78bfa;font-weight:400;">(tamu)</span>' : ''}
                        </div>
                        <div style="font-size:11px; color:#aaa;">
                            <span style="color:#00eaff">${v.last_page || "Muter-muter"}</span> • ${new Date(v.visited_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>`;
                listEl.appendChild(item);
            });
        }

        // Tampilkan tombol reset hanya untuk admin
        const adminActions = document.querySelector(".admin-actions");
        if (adminActions) adminActions.style.display = (user.role === 'class_admin' || user.role === 'super_admin') ? 'block' : 'none';

    } catch (err) { console.error("Stats Error:", err); }
}

// ==========================================
// 3. EVENT LISTENERS & AUTO RUNNER
// ==========================================
let visitorChannel = null;

document.addEventListener("DOMContentLoaded", () => {
    const user = _getVisitorUser();
    if (!user) return;

    const trigger = document.getElementById("visitorTrigger");
    const overlay = document.getElementById("visitorOverlay");
    const closeBtn = document.getElementById("closeVisitorPopup");
    const resetBtn = document.getElementById("resetVisitorBtn"); // Ambil di sini

    // 1. Logic Buka Popup
    if (trigger) {
        trigger.onclick = () => {
            overlay?.classList.add("show");
            renderVisitorStats();

            const canSeeRealtime = user.role === 'super_admin' || user.role === 'class_admin';
            if (canSeeRealtime && !visitorChannel) {
                visitorChannel = initVisitorRealtime();
            }
        };
    }

    // 2. Logic Tutup Popup
    const closeAction = () => {
        overlay?.classList.remove("show");
        if (visitorChannel) {
            visitorChannel.unsubscribe();
            visitorChannel = null;
        }
    };

    if (closeBtn) closeBtn.onclick = closeAction;
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) closeAction(); };

    // 3. LOGIC RESET VISITOR (ADMIN ONLY) - Sekarang di dalam scope
    if (resetBtn) {
        resetBtn.onclick = async () => {
            // Cek role user yang sudah di-define di awal DOMContentLoaded
            if (user.role !== 'class_admin' && user.role !== 'super_admin') return;

            const yakin = await showPopup("Bersihkan list pengunjung hari ini?", "confirm");

            if (yakin) {
                resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';
                try {
                    const { error } = await supabase
                        .from('visitors')
                        .update({ is_visible: false })
                        .eq('class_id', user.class_id);

                    if (error) throw error;

                    showPopup("List pengunjung telah di-reset!", "success");
                    renderVisitorStats();
                } catch (err) {
                    console.error("Reset Error:", err);
                    showPopup("Gagal reset data", "error");
                } finally {
                    resetBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Reset Today (Admin)';
                }
            }
        };
    }

    // Jalankan awal
    logVisitor();
    renderVisitorStats();
});

// Fungsi ini tetep di luar gak papa karena dipanggil di dalam scope di atas
function initVisitorRealtime() {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return null;

    const channel = supabase
        .channel('visitor_changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'visitors',
            filter: `class_id=eq.${user.class_id}`
        }, () => {
            renderVisitorStats();
        })
        .subscribe();

    return channel;
}