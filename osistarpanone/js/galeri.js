// =========================================================================
// GALERI — dokumentasi kegiatan: judul + subjudul + deretan foto
// horizontal. Tambah kegiatan = draft block inline di urutan paling
// atas (editable), foto ditambah satu-satu lewat slot "+" di kanan.
// Auto-save: foto pertama bikin baris DB, teks ke-save pas blur.
// =========================================================================

const Galeri = {
    terinisialisasi: false,
    draft: null, // { id: number|null, judul: "", deskripsi: "", fotos: [] }
    cache: [],   // hasil fetch terakhir, dipake pas re-render draft

    init() {
        if (Galeri.terinisialisasi) return;
        Galeri.terinisialisasi = true;
        Galeri.cekLogin();
        Galeri.muat();

        // Slot + & tombol hapus draft
        const grid = document.getElementById("galGrid");
        if (grid) grid.addEventListener("click", (e) => {
            if (e.target.closest(".up-slot")) {
                document.getElementById("galFileInput").click();
            }
        });
        const fileInput = document.getElementById("galFileInput");
        if (fileInput) fileInput.addEventListener("change", () => Galeri.tambahFotoDraft(fileInput));

        // Simpan judul/subjudul pas selesai ngetik
        grid.addEventListener("focusout", (e) => {
            if (!Galeri.draft) return;
            if (e.target.classList.contains("draft-judul") || e.target.classList.contains("draft-desk")) {
                Galeri.syncMeta();
            }
        });
    },

    // Tombol + & elemen edit cuma aktif kalo login sbg OSIS
    cekLogin() {
        const u = OsisAuth.getUser();
        const osis = !!(u && u.mode === "osis");
        const btn = document.getElementById("btnBukaUpload");
        if (btn) btn.style.display = osis ? "" : "none";
        const grid = document.getElementById("galGrid");
        if (grid) grid.classList.toggle("mode-osis", osis);
    },

    // ============ DRAFT BLOCK ============
    buatDraft() {
        if (Galeri.draft) {
            Galeri.render();
            return;
        }
        Galeri.draft = { id: null, judul: "", deskripsi: "", fotos: [] };
        Galeri.render();
        const j = document.querySelector(".draft-judul");
        if (j) j.focus();
        const card = document.querySelector(".bento-block.draft");
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    },

    bacaTeksDraft() {
        const j = document.querySelector(".draft-judul");
        const d = document.querySelector(".draft-desk");
        if (j) Galeri.draft.judul = j.textContent.trim();
        if (d) Galeri.draft.deskripsi = d.textContent.trim();
    },

    // Pastikan draft udah punya baris di DB (dipanggil sebelum nambah foto)
    async pastikanRow() {
        Galeri.bacaTeksDraft();
        if (Galeri.draft.id) return;
        const u = OsisAuth.getUser();
        const idBaru = await buatGallery(
            u.id,
            Galeri.draft.judul || "Tanpa Judul",
            Galeri.draft.deskripsi,
            [Galeri.draft.fotos[0]]
        );
        if (!idBaru || idBaru <= 0) throw new Error("Gagal bikin kegiatan (" + idBaru + ")");
        Galeri.draft.id = idBaru;
    },

    // Upload foto yang dipilih lewat slot +
    async tambahFotoDraft(input) {
        const u = OsisAuth.getUser();
        if (!u || u.mode !== "osis" || !Galeri.draft) return;
        const file = input.files && input.files[0];
        input.value = "";
        if (!file || !file.type.startsWith("image/")) return;

        try {
            const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
            const path = `gallery/galeri-${u.id}-${Date.now()}.${ext}`;
            await uploadFotoStorage(file, path);
            Galeri.bacaTeksDraft();
            Galeri.draft.fotos.push(path);

            await Galeri.pastikanRow();
            // Foto pertama udah ke-insert pas buat row, sisanya di-append
            if (Galeri.draft.fotos.length > 1) {
                await galeriAddFoto(u.id, Galeri.draft.id, path);
            }
            Galeri.render();
            showToast("Foto ditambahin!", "success");
        } catch (err) {
            console.error(err);
            showToast("Gagal upload foto. Cek koneksi ya!", "error");
        }
    },

    // Simpan judul & subjudul pas blur (cuma kalo row udah ada)
    async syncMeta() {
        Galeri.bacaTeksDraft();
        const u = OsisAuth.getUser();
        if (!u || !Galeri.draft || !Galeri.draft.id) return;
        try {
            await galeriUpdateMeta(u.id, Galeri.draft.id, Galeri.draft.judul, Galeri.draft.deskripsi);
        } catch (err) {
            console.warn("Gagal sync judul:", err.message);
        }
    },

    // Buang draft: kalo udah kesimpen di DB, ikut hapus bareng filenya
    async buangDraft() {
        const d = Galeri.draft;
        if (!d) return;

        if (!d.id) {
            Galeri.draft = null;
            Galeri.render();
            return;
        }

        const yakin = await showPopup("Buang kegiatan ini? Fotonya ikut terhapus.", "confirm");
        if (!yakin) return;

        try {
            const u = OsisAuth.getUser();
            await hapusGallery(u.id, d.id);
            for (const path of d.fotos) {
                try { await hapusFotoStorage(path); } catch (e) { console.warn("Gagal hapus file:", path); }
            }
            Galeri.draft = null;
            Galeri.render();
            showToast("Draft dibuang", "success");
        } catch (err) {
            console.error(err);
            showPopup("Gagal buang draft. Cek koneksi.", "error");
        }
    },

    // ============ MUAT & RENDER ============
    async muat() {
        const grid = document.getElementById("galGrid");
        if (!grid) return;

        try {
            const data = await getGallery();
            Galeri.cache = data || [];
            Galeri.render();
        } catch (err) {
            console.error(err);
            grid.innerHTML = `<div class="pesan-empty"><i class="fa-solid fa-triangle-exclamation"></i> Gagal memuat galeri. Cek koneksi.</div>`;
        }
    },

    render() {
        const grid = document.getElementById("galGrid");
        if (!grid) return;

        const data = Galeri.cache;
        let html = "";

        // Draft block selalu paling atas
        if (Galeri.draft) html += Galeri.kartuDraft();

        if (data.length === 0 && !Galeri.draft) {
            html += `<div class="pesan-empty"><i class="fa-solid fa-images"></i> Belum ada dokumentasi. Segera hadir!</div>`;
        } else {
            html += data.map(item => Galeri.kartu(item)).join("");
        }

        grid.innerHTML = html;
    },

    // Struktur draft = persis kartu kegiatan: judul -> subjudul -> foto [+]
    kartuDraft() {
        const d = Galeri.draft;
        let fotoHtml = d.fotos.map(path =>
            `<div class="item"><img src="${getFoto(path)}" alt=""></div>`
        ).join("");
        fotoHtml += `<div class="up-slot" title="Tambah foto"><i class="fa-solid fa-plus"></i></div>`;

        return `
            <div class="bento-block draft">
                <div class="bento-meta">
                    <h4 class="draft-judul" contenteditable="true" spellcheck="false" data-ph="Judul Kegiatan"></h4>
                    <p class="draft-desk" contenteditable="true" spellcheck="false" data-ph="Sub judul / deskripsi singkat..."></p>
                    <button class="icon-btn gal-del" onclick="Galeri.buangDraft()" title="Buang draft">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="gal-row">${fotoHtml}</div>
            </div>`;
    },

    kartu(item) {
        const judul = escapeHtml(item.judul);
        const deskripsi = escapeHtml(item.deskripsi || "");
        const fotos = Array.isArray(item.fotos) ? item.fotos : [];

        let fotoHtml = "";
        fotos.forEach(path => {
            fotoHtml += `
                <div class="item" onclick="Home.bukaFotoPopup(this.querySelector('img'), ${JSON.stringify(item.judul).replace(/"/g, "&quot;")})">
                    <img src="${getFoto(path)}" alt="${judul}" loading="lazy">
                </div>`;
        });

        return `
            <div class="bento-block">
                <div class="bento-meta">
                    <h4>${judul}</h4>
                    ${deskripsi ? `<p>${deskripsi}</p>` : ""}
                    <button class="icon-btn gal-del" onclick="Galeri.hapus(${item.id})" title="Hapus kegiatan">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                <div class="gal-row">${fotoHtml}</div>
            </div>`;
    },

    formatTanggal(t) {
        try {
            return new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
        } catch { return ""; }
    },

    // ============ HAPUS KEGIATAN ============
    async hapus(id) {
        const u = OsisAuth.getUser();
        if (!u || u.mode !== "osis") return;

        const yakin = await showPopup("Yakin hapus kegiatan ini? Fotonya ikut terhapus.", "confirm");
        if (!yakin) return;

        try {
            const { data } = await supa.from("gallery").select("fotos").eq("id", id).maybeSingle();

            await hapusGallery(u.id, id);

            if (data && Array.isArray(data.fotos)) {
                for (const path of data.fotos) {
                    try { await hapusFotoStorage(path); } catch (e) { console.warn("Gagal hapus file:", path); }
                }
            }

            showToast("Kegiatan dihapus", "success");
            Galeri.muat();
        } catch (err) {
            console.error(err);
            if (err.message === "ERR_NO_AUTH") {
                showPopup("Cuma akun OSIS yang bisa hapus.", "error");
            } else {
                showPopup("Gagal hapus. Cek koneksi lalu coba lagi.", "error");
            }
        }
    },
};

if (typeof Router !== "undefined") {
    Router.register("galeri", () => Galeri.init());
} else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Galeri.init());
} else {
    Galeri.init();
}
