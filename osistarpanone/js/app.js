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

// =========================================================================
// ROUTER — SPA hash routing (index.html)
// Rute: #/ #/sekbid #/aspirasi #/kontak
// =========================================================================

const Router = {
    daftarView: ["home", "sekbid", "galeri", "aspirasi", "kontak"],
    initFns: {},       // init lazy per view
    selesai: {},       // flag view sudah pernah di-init
    current: "home",
    token: 0,

    register(nama, fn) {
        Router.initFns[nama] = fn;
    },

    init() {
        window.addEventListener("hashchange", () => Router.go());
        window.addEventListener("resize", () => Router.geserPill(false));
        Router.go();
    },

    parse() {
        const h = location.hash.replace(/^#\/?/, "").toLowerCase();
        return Router.daftarView.includes(h) ? h : "home";
    },

    go() {
        const nama = Router.parse();
        const token = ++Router.token;
        const old = document.querySelector(".view.active");
        const next = document.querySelector(`.view[data-view="${nama}"]`);
        if (!next) return;

        if (old && old !== next) {
            old.classList.remove("active");
            old.classList.add("leaving");
            setTimeout(() => {
                if (token !== Router.token) return;
                Router.tampilkan(nama, next);
            }, 170);
        } else {
            Router.tampilkan(nama, next);
        }

        Router.current = nama;
        document.querySelectorAll(".tab-item").forEach(t =>
            t.classList.toggle("active", t.dataset.route === nama)
        );
        Router.geserPill(true);

        if (typeof Home !== "undefined" && Home.tutupModal) Home.tutupModal(true);
    },

    tampilkan(nama, el) {
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active", "leaving"));
        el.classList.add("active");
        window.scrollTo(0, 0);
        if (!Router.selesai[nama] && Router.initFns[nama]) {
            Router.selesai[nama] = true;
            Router.initFns[nama]();
        }
    },

    // Indikator slide di bottom nav
    geserPill(animasi) {
        const nav = document.getElementById("bottomNav");
        const pill = document.getElementById("navPill");
        if (!nav || !pill) return;
        const tab = nav.querySelector(`.tab-item[data-route="${Router.current}"]`);
        if (!tab) return;

        if (!animasi) pill.classList.add("no-anim");
        const navRect = nav.getBoundingClientRect();
        const tabRect = tab.getBoundingClientRect();
        pill.style.width = tabRect.width + "px";
        pill.style.transform = `translateX(${tabRect.left - navRect.left}px)`;
        requestAnimationFrame(() => pill.classList.remove("no-anim"));
    }
};

// Helper: jalanin fn pas DOM siap (aman buat script defer)
function onReady(fn) {
    if (document.readyState === "complete") {
        fn();
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

onReady(() => FotoWeb.init());
onReady(() => Router.init());
