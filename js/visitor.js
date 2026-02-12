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
        // Hitung Total (Semua User Unik di Kelas Ini)
        const { data: totalData } = await supabase.from('visitors')
            .select('user_id')
            .eq('class_id', user.class_id);

        // Hitung "Hari Ini" (Hanya yang is_visible: true)
        // [UBAH] Tidak ada lagi filter .gte('visited_at', ...)
        const { data: todayData, error: errToday } = await supabase.from('visitors')
            .select('user_id, visited_at, last_page, user:users (full_name, avatar_url, nickname)')
            .eq('class_id', user.class_id)
            .eq('is_visible', true) // Kuncinya disini: Hanya yang visible
            .order('visited_at', { ascending: false });

        if (errToday) console.error("Stats Render Error:", errToday);
        if (!totalData || !todayData) return;

        const uniqueTotal = new Set(totalData.map(v => v.user_id)).size;
        const uniqueTodayMap = new Map();

        // Filter duplikasi user di sisi client (jaga-jaga)
        todayData.forEach(v => {
            if (!uniqueTodayMap.has(v.user_id)) uniqueTodayMap.set(v.user_id, v);
        });

        // Update UI Elements
        if (document.getElementById("headerVisitorCount")) document.getElementById("headerVisitorCount").innerText = uniqueTodayMap.size;
        if (document.getElementById("popupToday")) document.getElementById("popupToday").innerText = uniqueTodayMap.size;
        if (document.getElementById("popupTotal")) document.getElementById("popupTotal").innerText = uniqueTotal;

        const listEl = document.getElementById("visitorList");
        if (listEl) {
            listEl.innerHTML = uniqueTodayMap.size === 0 ? '<p style="color:#aaa; font-size:12px;">Belum ada yang mampir.</p>' : '';
            uniqueTodayMap.forEach(v => {
                const u = v.user || {};
                const item = document.createElement('div');
                item.className = 'visitor-item';
                item.innerHTML = `
                    <img src="${u.avatar_url || '../icons/profpicture.png'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1; margin-left:10px;">
                        <div style="font-size:13px; font-weight:bold;">${u.nickname || u.full_name || 'User'}</div>
                        <div style="font-size:11px; color:#aaa;">
                            <span style="color:#00eaff">${v.last_page || "Muter-muter"}</span> • ${new Date(v.visited_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>`;
                listEl.appendChild(item);
            });
        }

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