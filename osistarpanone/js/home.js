// =========================================================================
// HOME — jejak organisasi, bento slider, ticker
// =========================================================================

const Home = {
    cachePimpinan: {},
    cacheAnggota: {},
    tahunAktif: null,
    terinisialisasi: false,

    async init() {
        if (Home.terinisialisasi) return;
        Home.terinisialisasi = true;
        Home.renderTicker();
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") Home.tutupModal();
        });
        window.addEventListener("popstate", () => {
            if (Home.selfBack) {
                Home.selfBack = false;
                return;
            }
            if (document.querySelector(".struktur-modal")) Home.tutupModal(true);
        });
        const gridPrestasi = document.querySelector(".prestasi-grid");
        if (gridPrestasi) {
            gridPrestasi.addEventListener("click", (e) => {
                const card = e.target.closest(".prestasi-card");
                if (!card) return;
                const img = card.querySelector("img");
                const tag = card.querySelector(".prestasi-tag");
                Home.bukaFotoPopup(img, tag ? tag.textContent : "Prestasi OSIS");
            });
        }
        const stackBento = document.getElementById("bentoScroll");
        if (stackBento) {
            stackBento.addEventListener("click", (e) => {
                const item = e.target.closest(".item");
                if (!item) return;
                const block = item.closest(".bento-block");
                const judul = block ? block.querySelector(".bento-meta h4") : null;
                Home.bukaFotoPopup(item.querySelector("img"), judul ? judul.textContent : "Kegiatan");
            });
        }
        await Home.muatArsip();
    },

    // ============ POPUP FOTO ============
    bukaFotoPopup(img, judul) {
        Home.tutupModal();
        Home.statePushed = false;
        try {
            history.pushState({ foto: true }, "");
            Home.statePushed = true;
        } catch (e) {}

        const src = (img && img.src) ? img.src : getFoto(FOTO_DEFAULT[(img && img.dataset.foto) || ""] || "");
        const modal = document.createElement("div");
        modal.className = "struktur-modal";
        modal.innerHTML = `
            <div class="struktur-modal-bg"></div>
            <div class="struktur-modal-box foto-only">
                <div class="struktur-head">
                    <h4>${escapeHtml(judul)}</h4>
                    <button class="struktur-close" type="button">&times;</button>
                </div>
                <div class="foto-pop">
                    <img src="${src}" alt="${escapeHtml(judul)}">
                </div>
            </div>`;
        modal.querySelector(".struktur-modal-bg").addEventListener("click", () => Home.tutupModal());
        modal.querySelector(".struktur-close").addEventListener("click", () => Home.tutupModal());
        document.body.appendChild(modal);
        document.body.style.overflow = "hidden";
    },

    // ============ TICKER ============
    renderTicker() {
        const track = document.getElementById("tickerTrack");
        if (!track) return;
        // Duplikasi isi biar loop mulus
        track.innerHTML += track.innerHTML;
    },

    // ============ ARSIP ANGKATAN ============
    async muatArsip() {
        const grid = document.getElementById("yearGrid");
        if (!grid) return;

        grid.innerHTML = `<div class="year-card" style="grid-column: 1 / -1; aspect-ratio: auto; cursor: default;">
            <div class="year-loading"><div class="spinner"></div>Memuat jejak organisasi...</div>
        </div>`;

        try {
            const [listPimpinan, listAnggota] = await Promise.all([getPimpinan(), getAnggota()]);

            listPimpinan.forEach(p => { Home.cachePimpinan[String(p.tahun)] = p; });
            listAnggota.forEach(a => {
                const k = String(a.tahun);
                if (!Home.cacheAnggota[k]) Home.cacheAnggota[k] = [];
                Home.cacheAnggota[k].push(a);
            });

            const totalTahun = Object.keys(Home.cachePimpinan).length;
            const chipTahun = document.getElementById("chipTahun");
            if (chipTahun && totalTahun) chipTahun.textContent = `${Math.min(...Object.keys(Home.cachePimpinan))}–${Math.max(...Object.keys(Home.cachePimpinan))}`;

            let html = "";
            for (let thn = 2010; thn <= 2027; thn++) {
                const p = Home.cachePimpinan[String(thn)];
                const foto = (p && p.foto_angkatan) ? p.foto_angkatan : `angkatan/foto-${thn}.jpg`;
                html += `
                    <div class="year-card" onclick="Home.toggleStruktur(${thn})" role="button">
                        <img src="${getFoto(foto)}" alt="Angkatan ${thn}" loading="lazy"
                             onerror="this.remove();">
                        <div class="year-overlay">
                            <span class="year-num">${thn}</span>
                            <span class="year-label">${labelTahun(thn)}</span>
                        </div>
                    </div>`;
            }
            grid.innerHTML = html;
        } catch (err) {
            console.error("Gagal muat arsip:", err);
            grid.innerHTML = `<div class="year-card" style="grid-column: 1 / -1; aspect-ratio: auto; cursor: default;">
                <div class="year-loading">Gagal memuat data. Cek koneksi & konfigurasi.</div>
            </div>`;
        }
    },

    // ============ STRUKTUR DETAIL (POPUP) ============
    toggleStruktur(tahun) {
        if (Home.tahunAktif === tahun && document.querySelector(".struktur-modal")) {
            Home.tutupModal();
            return;
        }
        Home.tahunAktif = tahun;
        Home.bukaModal(tahun);
    },

    tutupModal(dariBack = false) {
        const modal = document.querySelector(".struktur-modal");
        if (modal) {
            modal.classList.add("tutup");
            setTimeout(() => {
                if (modal.parentNode) modal.remove();
            }, 200);
        }
        Home.tahunAktif = null;
        document.body.style.overflow = "";
        const perluBack = !dariBack && Home.statePushed;
        Home.statePushed = false;
        if (perluBack) {
            Home.selfBack = true;
            setTimeout(() => { Home.selfBack = false; }, 300);
            history.back();
        }
    },

    bukaModal(tahun) {
        Home.statePushed = false;
        try {
            history.pushState({ struktur: tahun }, "");
            Home.statePushed = true;
        } catch (e) {}
        const pimpinan = Home.cachePimpinan[String(tahun)] || null;
        const anggota = Home.cacheAnggota[String(tahun)] || [];
        const foto = (pimpinan && pimpinan.foto_angkatan) ? pimpinan.foto_angkatan : `angkatan/foto-${tahun}.jpg`;

        let chips = "";
        if (anggota.length > 0) {
            chips = anggota.map(a => `
                <div class="anggota-chip">
                    <b>${escapeHtml(a.nama)}</b>
                    <span>${escapeHtml(a.jabatan)}</span>
                </div>`).join("");
        } else {
            chips = `<div style="grid-column: 1 / -1; font-size: 0.75rem; color: var(--gray); font-weight: 700;">Belum ada data anggota tahun ini.</div>`;
        }

        const modal = document.createElement("div");
        modal.className = "struktur-modal";
        modal.innerHTML = `
            <div class="struktur-modal-bg"></div>
            <div class="struktur-modal-box">
                <div class="struktur-head">
                    <h4>${labelTahun(tahun)} (${tahun})</h4>
                    <button class="struktur-close" type="button">&times;</button>
                </div>
                <div class="struktur-foto">
                    <img src="${getFoto(foto)}" alt="Angkatan ${tahun}" loading="lazy"
                         onerror="this.remove();">
                </div>
                <div class="struktur-modal-body">

                    <div class="struktur-pimpinan">
                        <div class="pimp-card">
                            <div class="pimp-photo">
                                <img src="${getFoto(pimpinan ? pimpinan.ketua_foto : "")}" alt="Ketua OSIS"
                                     onerror="this.remove();">
                            </div>
                            <div class="pimp-info">
                                <b>${pimpinan && pimpinan.ketua_nama ? escapeHtml(pimpinan.ketua_nama) : "Belum Ada"}</b>
                                <span>Ketua OSIS</span>
                            </div>
                        </div>
                        <div class="pimp-card">
                            <div class="pimp-photo">
                                <img src="${getFoto(pimpinan ? pimpinan.wakil_foto : "")}" alt="Wakil Ketua"
                                     onerror="this.remove();">
                            </div>
                            <div class="pimp-info">
                                <b>${pimpinan && pimpinan.wakil_nama ? escapeHtml(pimpinan.wakil_nama) : "Belum Ada"}</b>
                                <span>Wakil Ketua</span>
                            </div>
                        </div>
                    </div>

                    <div class="struktur-anggota">
                        <div class="pembatas">Anggota</div>
                        <div class="anggota-grid">${chips}</div>
                    </div>

                </div>
            </div>
        `;

        modal.querySelector(".struktur-modal-bg").addEventListener("click", () => Home.tutupModal());
        modal.querySelector(".struktur-close").addEventListener("click", () => Home.tutupModal());
        document.body.appendChild(modal);
        document.body.style.overflow = "hidden";
    }
};

if (typeof Router !== "undefined") {
    Router.register("home", () => Home.init());
} else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Home.init());
} else {
    Home.init();
}
