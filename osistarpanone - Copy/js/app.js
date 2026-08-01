// =========================================================================
// APP — DIPAKAI SEMUA HALAMAN (foto web + helper umum)
// Urutan include: ... db.js -> app.js -> (script halaman)
// =========================================================================

// Path default foto halaman (fallback kalau tabel web_foto kosong/reset)
const FOTO_DEFAULT = {
    logo1: "web/logo1.png",
    bg: "web/bg.png",
    pembina: "web/pembina.jpg",
    prestasi1: "web/prestasi1.jpg",
    prestasi2: "web/prestasi2.jpg",
    prestasi3: "web/prestasi3.jpg",
    prestasi4: "web/prestasi4.jpg",
    makrab1: "web/makrab1.jpg",
    makrab2: "web/makrab2.jpg",
    makrab3: "web/makrab3.jpg",
    makrab4: "web/makrab4.jpg",
    takjilin1: "web/takjilin1.jpg",
    takjilin2: "web/takjilin2.jpg",
    takjilin3: "web/takjilin3.jpg",
    takjilin4: "web/takjilin4.jpg",
    pesak1: "web/pesak1.jpg",
    pesak2: "web/pesak2.jpg",
    pesak3: "web/pesak3.jpg",
    pesak4: "web/pesak4.jpg"
};

const FotoWeb = {
    map: { ...FOTO_DEFAULT },

    // Muat override dari tabel web_foto lalu terapkan ke halaman
    async init() {
        try {
            const rows = await getWebFoto();
            rows.forEach(r => { if (r.path) FotoWeb.map[r.kunci] = r.path; });
        } catch (err) {
            console.error("Gagal muat web_foto, pakai default:", err);
        }
        FotoWeb.apply();
    },

    apply() {
        document.querySelectorAll("[data-foto]").forEach(el => {
            const p = FotoWeb.map[el.dataset.foto];
            if (p) el.src = getFoto(p);
        });
        document.querySelectorAll("[data-foto-bg]").forEach(el => {
            const p = FotoWeb.map[el.dataset.fotoBg];
            if (p) el.style.backgroundImage = `url('${getFoto(p)}')`;
        });
    }
};

// Helper render
function escapeHtml(teks) {
    return String(teks ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function labelTahun(thn) {
    if (thn >= 2023) return `ADIABI JILID ${thn - 2022}`;
    return `Angkatan ${thn - 2009}`;
}

// Jalankan saat DOM siap
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => FotoWeb.init());
} else {
    FotoWeb.init();
}
