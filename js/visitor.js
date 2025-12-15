const VisitorApp = {
    pageKey: null,
    user: null,

    init(pageKey) {
        this.pageKey = pageKey;
        this.user = getUser();
        if (!this.user) return;

        this.handleAutoReset();
        this.recordVisit();
        this.loadStats();
        this.setupUI();
        this.setupResetButton();
    },

    // =========================
    // RESET OTOMATIS JAM 15:00 WIB
    // =========================
    handleAutoReset() {
        const now = new Date();
        const hour = now.getHours();

        const resetKey = "visitor_reset_at";
        const lastReset = localStorage.getItem(resetKey);

        const todayReset = new Date();
        todayReset.setHours(15, 0, 0, 0);

        if (hour >= 15) {
            if (!lastReset || new Date(lastReset) < todayReset) {
                localStorage.setItem(resetKey, todayReset.toISOString());
            }
        }
    },

    // =========================
    // CATAT VISITOR
    // =========================
    async recordVisit() {
    const resetAt = localStorage.getItem("visitor_reset_at");

    // cek apakah user sudah tercatat sejak reset
    const { data } = await supabase
        .from("page_visitors")
        .select("id")
        .eq("page_key", this.pageKey)
        .eq("user_id", this.user.id)
        .gte("visited_at", resetAt)
        .limit(1);

    // kalau sudah ada → JANGAN INSERT LAGI
    if (data && data.length > 0) return;

    // belum ada → insert
    await supabase.from("page_visitors").insert({
        page_key: this.pageKey,
        user_id: this.user.id
    });
},
    // =========================
    // LOAD STATISTIK
    // =========================
    async loadStats() {
        const resetAt = localStorage.getItem("visitor_reset_at");

        const { data, error } = await supabase
            .from("page_visitors")
            .select("user_id, visited_at, users(full_name, avatar_url)")
            .eq("page_key", this.pageKey)
            .gte("visited_at", resetAt)
            .order("visited_at", { ascending: false });

        if (error || !data) return;

        const uniqueUser = new Set(data.map(d => d.user_id));

        const todayEl = document.getElementById("todayCount");
        const counterEl = document.getElementById("visitorCount");

        if (todayEl) todayEl.innerText = uniqueUser.size;
        if (counterEl) counterEl.innerText = uniqueUser.size;

        this.renderList(data);
    },

    // =========================
    // RENDER LIST VISITOR
    // =========================
    renderList(data) {
        const box = document.getElementById("visitorList");
        if (!box) return;

        box.innerHTML = "";

        data.forEach(d => {
            const jam = new Date(d.visited_at)
                .toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit"
                });

            box.innerHTML += `
                <div class="visitor-item">
                    <img src="${d.users?.avatar_url || 'defaultpp.png'}">
                    <span>${d.users?.full_name || 'Unknown'}</span>
                    <small>${jam}</small>
                </div>
            `;
        });
    },

    // =========================
    // UI POPUP
    // =========================
    setupUI() {
        const box = document.getElementById("visitorBox");
        const popup = document.getElementById("visitorPopup");

        if (!box || !popup) return;

        box.onclick = () => {
            popup.style.display =
                popup.style.display === "block" ? "none" : "block";
        };
    },

    // =========================
    // RESET MANUAL (SUPER ADMIN)
    // =========================
    setupResetButton() {
        if (this.user.role !== "super_admin") return;

        const btn = document.getElementById("resetVisitorBtn");
        if (!btn) return;

        btn.style.display = "block";
        btn.onclick = () => {
            localStorage.setItem(
                "visitor_reset_at",
                new Date().toISOString()
            );
            this.loadStats();
        };
    }
};
