// ==========================================
// VISITOR SYSTEM (TOTAL CENTRALIZED)
// ==========================================

const _getVisitorUser = () => {
    try {
        const data = localStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
};

function getResetTime() {
    const now = new Date();
    let resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0);
    if (now.getTime() >= resetTime.getTime()) resetTime.setDate(resetTime.getDate() + 1);
    return resetTime;
}

// 1. LOGIC MENCATAT KUNJUNGAN (ANTI-NUMPUK)
async function logVisitor() {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    try {
        const currentPage = document.title || "Unknown Page";
        const now = new Date();
        const timeThreshold = new Date(getResetTime().getTime() - 86400000).toISOString();

        const { data: list } = await supabase.from("visitors").select("id, visited_at, last_page")
            .eq("user_id", user.id).eq("class_id", user.class_id)
            .gte("visited_at", timeThreshold).order('visited_at', { ascending: false }).limit(1);

        const existing = (list && list.length > 0) ? list[0] : null;

        if (existing) {
            const diffMin = (now - new Date(existing.visited_at)) / 60000;
            if (diffMin >= 1 || existing.last_page !== currentPage) {
                await supabase.from("visitors").update({
                    visited_at: now.toISOString(),
                    is_visible: true,
                    last_page: currentPage
                }).eq("id", existing.id);
                renderVisitorStats();
            }
        } else {
            await supabase.from("visitors").insert({
                user_id: user.id, class_id: user.class_id,
                is_visible: true, last_page: currentPage, visited_at: now.toISOString()
            });
            renderVisitorStats();
        }
    } catch (err) { console.error("Log Error:", err); }
}

// 2. RENDER STATISTIK & ADMIN PANEL
async function renderVisitorStats() {
    if (typeof supabase === 'undefined') return;
    const user = _getVisitorUser();
    if (!user) return;

    const timeThreshold = new Date(getResetTime().getTime() - 86400000).toISOString();

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

        // Update UI Elements
        document.getElementById("headerVisitorCount")?.setAttribute('innerText', uniqueTodayMap.size);
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
                    <img src="${u.avatar_url || 'profpicture.png'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
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
document.addEventListener("DOMContentLoaded", () => {
    const user = _getVisitorUser();

    // --- [FITUR BERDIKARI] AUTO LOG SETELAH 1 DETIK ---
    // Delay 1 detik (1000ms) memberi waktu agar SubjectApp/Script lain
    // selesai mengubah document.title (misal: "Loading..." -> "Nilai PSAS")
    // sehingga yang tercatat di database adalah judul yang benar.
    setTimeout(() => {
        if (typeof logVisitor === 'function') logVisitor();
    }, 1000);

    // --- SETUP VISITOR UI (POPUP, BUTTON, DLL) ---
    const trigger = document.getElementById("visitorTrigger");
    const overlay = document.getElementById("visitorOverlay");
    const closeBtn = document.getElementById("closeVisitorPopup");
    const resetBtn = document.getElementById("resetVisitorBtn");

    if (trigger) trigger.onclick = () => { overlay?.classList.add("show"); renderVisitorStats(); };
    if (closeBtn) closeBtn.onclick = () => overlay?.classList.remove("show");
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove("show"); };

    // ... (kode atas tetap sama) ...

    if (resetBtn) {
        resetBtn.onclick = async () => {
            // [BARU] Pakai Universal Popup tipe 'confirm'
            // Kita tunggu (await) sampai user pilih Iya/Tidak
            const yakin = await showPopup("Yakin ingin mereset data visitor hari ini?", "confirm");

            // Kalau user pilih "Tidak" (false), stop di sini
            if (!yakin) return;

            // Lanjut proses reset...
            const timeThreshold = new Date(getResetTime().getTime() - 86400000).toISOString();
            
            const { error } = await supabase
                .from('visitors')
                .update({ is_visible: false })
                .eq('class_id', user.class_id)
                .gte('visited_at', timeThreshold);

            if (!error) {
                // [BARU] Tipe 'success' (Hijau, Ceklis)
                await showPopup("Visitor today berhasil direset!", "success");
                renderVisitorStats();
            } else {
                // [BARU] Tipe 'error' (Merah, Silang)
                await showPopup("Gagal reset data: " + error.message, "error");
            }
        };
    }

    // ... (sisa kode bawah tetap sama) ...

    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape" && overlay?.classList.contains("show")) overlay.classList.remove("show");
    });

    // Render statistik awal (tanpa log baru)
    renderVisitorStats();
});

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && overlay?.classList.contains("show")) overlay.classList.remove("show");
});

renderVisitorStats();