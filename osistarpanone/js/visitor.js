// =========================================================================
// VISITOR — hitung pengunjung unik per device (1x per hari) + popup statistik
// =========================================================================

const Visitor = {
    inisialisasi: false,

    async init() {
        if (Visitor.inisialisasi) return;
        Visitor.inisialisasi = true;
        try {
            await catatVisitor();
        } catch (err) {
            console.error("Visitor gagal dicatat:", err);
        }
        Visitor.muatStats();
    },

    // ============ STATISTIK ============
    async muatStats() {
        try {
            const { data, error } = await supa
                .from("visitor")
                .select("device_id, jumlah, masuk, last_seen")
                .order("masuk", { ascending: false });
            if (error) throw error;
            const rows = data || [];

            const total = rows.reduce((a, r) => a + (r.jumlah || 0), 0);
            const hariIniUtc = new Date().toISOString().slice(0, 10);
            const hariIni = rows.filter(r => (r.last_seen || "").slice(0, 10) === hariIniUtc);

            const el = document.getElementById("headerVisitorCount");
            if (el) el.textContent = total.toLocaleString("id-ID");
            const t = document.getElementById("vstatTotal");
            if (t) t.textContent = total.toLocaleString("id-ID");
            const h = document.getElementById("vstatHari");
            if (h) h.textContent = hariIni.length.toLocaleString("id-ID");
            const u = document.getElementById("vstatUnik");
            if (u) u.textContent = rows.length.toLocaleString("id-ID");

            Visitor.renderList(hariIni);
        } catch (err) {
            console.error("Gagal muat statistik visitor:", err);
        }
    },

    // ============ LIST PENGUNJUNG HARI INI ============
    renderList(rows) {
        const list = document.getElementById("visitorList");
        if (!list) return;

        if (!rows || rows.length === 0) {
            list.innerHTML = `<div class="pesan-empty"><i class="fa-solid fa-mobile-screen"></i> Belum ada pengunjung hari ini.</div>`;
            return;
        }

        list.innerHTML = rows.map(v => `
            <div class="vitem">
                <div class="vitem-head">
                    <span class="vitem-name"><i class="fa-solid fa-mobile-screen"></i> Unknown</span>
                    <span class="vitem-durasi"><i class="fa-solid fa-clock"></i> ${Visitor.durasiOnline(v.masuk)}</span>
                </div>
                <div class="vitem-masuk"><i class="fa-solid fa-right-to-bracket"></i> Masuk: ${Visitor.jamMasuk(v.masuk)}</div>
            </div>`).join("");
    },

    jamMasuk(t) {
        try {
            return new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        } catch { return "-"; }
    },

    durasiOnline(t) {
        try {
            const ms = Date.now() - new Date(t).getTime();
            if (ms < 0 || ms < 60000) return "<1 mnt";
            const mnt = Math.floor(ms / 60000);
            if (mnt < 60) return mnt + " mnt";
            const jam = Math.floor(mnt / 60);
            const sisa = mnt % 60;
            return sisa ? `${jam} jam ${sisa} mnt` : `${jam} jam`;
        } catch { return "-"; }
    },

    // ============ POPUP ============
    bukaPopup() {
        const ov = document.getElementById("visitorOverlay");
        if (!ov) return;
        Visitor.muatStats();
        ov.classList.add("open");
    },

    tutupPopup() {
        const ov = document.getElementById("visitorOverlay");
        if (ov) ov.classList.remove("open");
    }
};

if (typeof onReady === "function") {
    onReady(() => {
        Visitor.init();
        const ov = document.getElementById("visitorOverlay");
        if (ov) ov.addEventListener("click", e => {
            if (e.target === ov) Visitor.tutupPopup();
        });
    });
} else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Visitor.init());
} else {
    Visitor.init();
}
