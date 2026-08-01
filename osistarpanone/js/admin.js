// =========================================================================
// ADMIN — PIN gate + CRUD semua data. Pola: AdminApp object + data-action
// =========================================================================

const AdminApp = {
    pengaturan: {},
    fotoPimpinanBaru: { ketua: null, wakil: null, angkatan: null },
    pimpinanLama: null,

    SESSION_KEY: "osis_admin_login",
    SESSION_DURASI: 8 * 60 * 60 * 1000, // 8 jam

    // ============ INIT ============
    async init() {
        try { AdminApp.pengaturan = await getSemuaPengaturan(); } catch (err) { console.error(err); }

        if (AdminApp.statusAspirasiEl) AdminApp.statusAspirasiEl.value = AdminApp.pengaturan.status_aspirasi || "BUKA";

        const sesi = parseInt(localStorage.getItem(AdminApp.SESSION_KEY) || "0", 10);
        if (sesi && Date.now() - sesi < AdminApp.SESSION_DURASI) {
            AdminApp.buka();
        }

        // Delegasi semua tombol data-action
        document.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-action]");
            if (!btn) return;
            const [mod, method] = btn.dataset.action.split(".");
            if (AdminApp[mod] && typeof AdminApp[mod][method] === "function") {
                AdminApp[mod][method](btn);
            }
        });

        // Enter di layar PIN
        document.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && document.getElementById("pinInput")) {
                AdminApp.auth.masuk();
            }
        });
    },

    get statusAspirasiEl() {
        return document.getElementById("statusAspirasiSelect");
    },

    // ============ AUTH ============
    auth: {
        masuk() {
            const input = document.getElementById("pinInput").value.trim();
            const errorEl = document.getElementById("pinError");
            if (!input) { errorEl.textContent = "PIN diisi dulu yaa"; return; }

            const pinBenar = AdminApp.pengaturan.admin_pin || "osis2026";
            if (input !== pinBenar) { errorEl.textContent = "PIN salah, coba lagi!"; return; }

            localStorage.setItem(AdminApp.SESSION_KEY, String(Date.now()));
            AdminApp.buka();
        },

        keluar() {
            localStorage.removeItem(AdminApp.SESSION_KEY);
            location.reload();
        }
    },

    // ============ UI ============
    buka() {
        document.getElementById("lockScreen").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        AdminApp.pimpinan.isiTahun();
        AdminApp.anggota.isiTahun();
        AdminApp.pimpinan.muat();
        AdminApp.anggota.muat();
        AdminApp.sekbid.muat();
        AdminApp.fotoWeb.muat();
    },

    pindahTab(id) {
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === id));
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
    },

    // ============ PIMPINAN ============
    pimpinan: {
        isiTahun() {
            const s = document.getElementById("pilihTahunPimpinan");
            let opsi = "";
            for (let thn = 2027; thn >= 2010; thn--) opsi += `<option value="${thn}">${thn}</option>`;
            s.innerHTML = opsi;
            s.value = "2026";
        },

        async muat() {
            const tahun = parseInt(document.getElementById("pilihTahunPimpinan").value, 10);
            AdminApp.fotoPimpinanBaru = { ketua: null, wakil: null, angkatan: null };
            AdminApp.pimpinanLama = null;

            try {
                const { data, error } = await supa.from("pimpinan").select("*").eq("tahun", tahun).maybeSingle();
                if (error) throw error;
                AdminApp.pimpinanLama = data;
                const row = data || {};

                document.getElementById("pimpinanKetuaNama").value = row.ketua_nama || "";
                document.getElementById("pimpinanWakilNama").value = row.wakil_nama || "";

                AdminApp.pimpinan.preview("previewKetua", row.ketua_foto);
                AdminApp.pimpinan.preview("previewWakil", row.wakil_foto);
                AdminApp.pimpinan.preview("previewAngkatan", row.foto_angkatan);
            } catch (err) {
                console.error(err);
                alert("Gagal memuat pimpinan: " + err.message);
            }
        },

        preview(idImg, path) {
            const el = document.getElementById(idImg);
            const url = getFoto(path);
            if (url) { el.src = url; el.style.display = ""; }
            else { el.removeAttribute("src"); el.style.display = "none"; }
        },

        async upload(btn) {
            const slot = btn.dataset.slot;
            const tahun = document.getElementById("pilihTahunPimpinan").value;
            const idInput = slot === "ketua" ? "pimpinanKetuaFile" : slot === "wakil" ? "pimpinanWakilFile" : "pimpinanAngkatanFile";
            const idPreview = slot === "ketua" ? "previewKetua" : slot === "wakil" ? "previewWakil" : "previewAngkatan";
            const file = document.getElementById(idInput).files[0];

            if (!file) return alert("Pilih file dulu yaa");
            if (!file.type.startsWith("image/")) return alert("File harus gambar!");

            const ekstensi = file.name.split(".").pop() || "jpg";
            const prefiks = slot === "ketua" ? "ketos" : slot === "wakil" ? "waketos" : "fotoangkatan";
            const folder = slot === "angkatan" ? "angkatan" : "pimpinan";
            const pathBaru = `${folder}/${prefiks}${tahun}-${Date.now()}.${ekstensi}`;

            try {
                await uploadFotoStorage(file, pathBaru);
                AdminApp.fotoPimpinanBaru[slot] = pathBaru;
                document.getElementById(idPreview).src = getFoto(pathBaru);
                document.getElementById(idPreview).style.display = "";
                document.getElementById(idInput).value = "";
                alert("Foto terupload! Klik 'Simpan Data' biar kepake.");
            } catch (err) {
                console.error(err);
                alert("Gagal upload: " + err.message);
            }
        },

        async simpan() {
            const tahun = parseInt(document.getElementById("pilihTahunPimpinan").value, 10);
            const lama = AdminApp.pimpinanLama || {};

            const row = {
                tahun,
                ketua_nama: document.getElementById("pimpinanKetuaNama").value.trim(),
                wakil_nama: document.getElementById("pimpinanWakilNama").value.trim(),
                ketua_foto: AdminApp.fotoPimpinanBaru.ketua || lama.ketua_foto || "",
                wakil_foto: AdminApp.fotoPimpinanBaru.wakil || lama.wakil_foto || "",
                foto_angkatan: AdminApp.fotoPimpinanBaru.angkatan || lama.foto_angkatan || ""
            };

            if (!row.ketua_nama && !row.wakil_nama && !row.ketua_foto && !row.wakil_foto && !row.foto_angkatan) {
                if (confirm(`Hapus data pimpinan tahun ${tahun}?`)) {
                    try {
                        await hapusPimpinan(tahun);
                        AdminApp.hapusFileLama([lama.ketua_foto, lama.wakil_foto, lama.foto_angkatan]);
                        AdminApp.pimpinan.muat();
                    } catch (err) { alert("Gagal hapus: " + err.message); }
                }
                return;
            }

            try {
                await simpanPimpinan(row);
                AdminApp.hapusFileLama([
                    AdminApp.fotoPimpinanBaru.ketua ? lama.ketua_foto : null,
                    AdminApp.fotoPimpinanBaru.wakil ? lama.wakil_foto : null,
                    AdminApp.fotoPimpinanBaru.angkatan ? lama.foto_angkatan : null
                ]);
                alert(`Data pimpinan tahun ${tahun} tersimpan!`);
                AdminApp.pimpinan.muat();
            } catch (err) {
                alert("Gagal simpan: " + err.message);
            }
        }
    },

    // ============ ANGGOTA ============
    anggota: {
        isiTahun() {
            const s = document.getElementById("pilihTahunAnggota");
            let opsi = "";
            for (let thn = 2027; thn >= 2010; thn--) opsi += `<option value="${thn}">${thn}</option>`;
            s.innerHTML = opsi;
            s.value = "2026";
        },

        async muat() {
            const tahun = parseInt(document.getElementById("pilihTahunAnggota").value, 10);
            const container = document.getElementById("listAnggota");

            try {
                const { data, error } = await supa
                    .from("anggota").select("*").eq("tahun", tahun)
                    .order("urutan", { ascending: true });
                if (error) throw error;

                if (!data || data.length === 0) {
                    container.innerHTML = `<div class="loading-block">Belum ada anggota untuk tahun ${tahun}.</div>`;
                    return;
                }

                container.innerHTML = data.map(a => `
                    <div class="admin-row">
                        <input type="text" class="admin-input" id="anggotaNama-${a.id}" value="${escapeHtml(a.nama)}" placeholder="Nama">
                        <input type="text" class="admin-input" id="anggotaJabatan-${a.id}" value="${escapeHtml(a.jabatan)}" placeholder="Jabatan">
                        <input type="number" class="admin-input" id="anggotaUrutan-${a.id}" value="${a.urutan}" min="1" max="99" style="max-width: 80px;">
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-dark btn-sm" data-action="anggota.simpan" data-id="${a.id}">💾</button>
                            <button class="btn btn-sm" style="background:#ffe9e9;color:var(--red-dark);" data-action="anggota.hapus" data-id="${a.id}">🗑️</button>
                        </div>
                    </div>`).join("");
            } catch (err) {
                console.error(err);
                container.innerHTML = `<div class="loading-block">Gagal memuat: ${escapeHtml(err.message)}</div>`;
            }
        },

        async tambah() {
            const tahun = parseInt(document.getElementById("pilihTahunAnggota").value, 10);
            const nama = document.getElementById("anggotaBaruNama").value.trim();
            const jabatan = document.getElementById("anggotaBaruJabatan").value.trim();
            const urutan = parseInt(document.getElementById("anggotaBaruUrutan").value, 10) || 15;

            if (!nama || !jabatan) return alert("Nama & jabatan wajib diisi!");

            try {
                await tambahAnggota({ tahun, nama, jabatan, urutan });
                document.getElementById("anggotaBaruNama").value = "";
                document.getElementById("anggotaBaruJabatan").value = "";
                document.getElementById("anggotaBaruUrutan").value = "15";
                AdminApp.anggota.muat();
            } catch (err) { alert("Gagal tambah: " + err.message); }
        },

        async simpan(btn) {
            const id = parseInt(btn.dataset.id, 10);
            try {
                await updateAnggota(id, {
                    nama: document.getElementById("anggotaNama-" + id).value.trim(),
                    jabatan: document.getElementById("anggotaJabatan-" + id).value.trim(),
                    urutan: parseInt(document.getElementById("anggotaUrutan-" + id).value, 10) || 15
                });
                AdminApp.anggota.muat();
            } catch (err) { alert("Gagal simpan: " + err.message); }
        },

        async hapus(btn) {
            if (!confirm("Yakin hapus anggota ini?")) return;
            try {
                await hapusAnggota(parseInt(btn.dataset.id, 10));
                AdminApp.anggota.muat();
            } catch (err) { alert("Gagal hapus: " + err.message); }
        }
    },

    // ============ SEKBID ============
    sekbid: {
        async muat() {
            const container = document.getElementById("listSekbid");
            try {
                const data = await getSekbid();
                if (!data || data.length === 0) {
                    container.innerHTML = `<div class="loading-block">Belum ada data sekbid.</div>`;
                    return;
                }

                container.innerHTML = data.map(s => `
                    <div class="admin-row" style="grid-template-columns: 1fr;">
                        <div style="display: grid; grid-template-columns: 0.7fr 2fr 0.5fr auto; gap: 8px;">
                            <select class="admin-input" id="sekbidKategori-${s.id}">
                                <option value="BPH" ${s.kategori === "BPH" ? "selected" : ""}>BPH</option>
                                <option value="SEKBID" ${s.kategori !== "BPH" ? "selected" : ""}>SEKBID</option>
                            </select>
                            <input type="text" class="admin-input" id="sekbidNama-${s.id}" value="${escapeHtml(s.nama)}" placeholder="Nama">
                            <input type="text" class="admin-input" id="sekbidIcon-${s.id}" value="${escapeHtml(s.icon)}" placeholder="Emoji" maxlength="8">
                            <div style="display: flex; gap: 6px;">
                                <button class="btn btn-dark btn-sm" data-action="sekbid.simpan" data-id="${s.id}">💾</button>
                                <button class="btn btn-sm" style="background:#ffe9e9;color:var(--red-dark);" data-action="sekbid.hapus" data-id="${s.id}">🗑️</button>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <input type="number" class="admin-input" id="sekbidUrutan-${s.id}" value="${s.urutan}" min="1" placeholder="Urutan" style="max-width: 120px;">
                            <div class="foto-row">
                                <img class="foto-prev" id="sekbidPreview-${s.id}" src="${s.foto ? getFoto(s.foto) : ""}" alt="">
                                <input type="file" class="admin-input" id="sekbidFoto-${s.id}" accept="image/*">
                            </div>
                        </div>
                        <textarea class="admin-input admin-textarea" id="sekbidDeskripsi-${s.id}" placeholder="Deskripsi / tugas pokok">${escapeHtml(s.deskripsi)}</textarea>
                    </div>`).join("");
            } catch (err) {
                console.error(err);
                container.innerHTML = `<div class="loading-block">Gagal memuat: ${escapeHtml(err.message)}</div>`;
            }
        },

        async tambah() {
            const nama = document.getElementById("sekbidBaruNama").value.trim();
            if (!nama) return alert("Nama wajib diisi!");

            try {
                await tambahSekbid({
                    kategori: document.getElementById("sekbidBaruKategori").value,
                    nama,
                    icon: document.getElementById("sekbidBaruIcon").value.trim(),
                    deskripsi: document.getElementById("sekbidBaruDeskripsi").value.trim(),
                    urutan: 99
                });
                ["sekbidBaruNama", "sekbidBaruIcon", "sekbidBaruDeskripsi"].forEach(id => document.getElementById(id).value = "");
                AdminApp.sekbid.muat();
            } catch (err) { alert("Gagal tambah: " + err.message); }
        },

        async simpan(btn) {
            const id = parseInt(btn.dataset.id, 10);
            try {
                const row = {
                    kategori: document.getElementById("sekbidKategori-" + id).value,
                    nama: document.getElementById("sekbidNama-" + id).value.trim(),
                    icon: document.getElementById("sekbidIcon-" + id).value.trim(),
                    deskripsi: document.getElementById("sekbidDeskripsi-" + id).value.trim(),
                    urutan: parseInt(document.getElementById("sekbidUrutan-" + id).value, 10) || 99
                };

                const fileInput = document.getElementById("sekbidFoto-" + id);
                if (fileInput && fileInput.files && fileInput.files[0]) {
                    const file = fileInput.files[0];
                    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
                    row.foto = await uploadFotoStorage(file, `sekbid/sekbid-${id}-${Date.now()}.${ext}`);
                }

                await updateSekbid(id, row);
                AdminApp.sekbid.muat();
            } catch (err) { alert("Gagal simpan: " + err.message); }
        },

        async hapus(btn) {
            if (!confirm("Yakin hapus sekbid ini?")) return;
            try {
                await hapusSekbid(parseInt(btn.dataset.id, 10));
                AdminApp.sekbid.muat();
            } catch (err) { alert("Gagal hapus: " + err.message); }
        }
    },

    // ============ FOTO WEB ============
    fotoWeb: {
        async muat() {
            const container = document.getElementById("gridFotoWeb");
            try {
                const data = await getWebFoto();
                if (!data || data.length === 0) {
                    container.innerHTML = `<div class="loading-block">Belum ada data foto web.</div>`;
                    return;
                }

                container.innerHTML = data.map(f => {
                    const url = getFoto(f.path) || getFoto(AdminApp.fotoDefault(f.kunci));
                    return `
                    <div class="fw-card">
                        <img class="fw-preview" src="${url}" alt="${escapeHtml(f.kunci)}" loading="lazy">
                        <h5>${escapeHtml(f.kunci)}</h5>
                        <input type="file" class="admin-input" id="fwFile-${escapeHtml(f.kunci)}" accept="image/*">
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-red btn-sm" data-action="fotoWeb.ganti" data-key="${escapeHtml(f.kunci)}">Ganti</button>
                            ${f.path ? `<button class="btn btn-sm" style="background:#ffe9e9;color:var(--red-dark);" data-action="fotoWeb.reset" data-key="${escapeHtml(f.kunci)}">Reset</button>` : ""}
                        </div>
                    </div>`;
                }).join("");
            } catch (err) {
                console.error(err);
                container.innerHTML = `<div class="loading-block">Gagal memuat: ${escapeHtml(err.message)}</div>`;
            }
        },

        fotoDefault(kunci) {
            const F = window.FotoWeb;
            return (F && F.map && F.map[kunci]) ? F.map[kunci] : `web/${kunci}.jpg`;
        },

        async ganti(btn) {
            const kunci = btn.dataset.key;
            const file = document.getElementById("fwFile-" + kunci).files[0];
            if (!file) return alert("Pilih file dulu yaa");
            if (!file.type.startsWith("image/")) return alert("File harus gambar!");

            const ekstensi = file.name.split(".").pop() || "jpg";
            const pathBaru = `web/${kunci}-${Date.now()}.${ekstensi}`;

            try {
                const data = await getWebFoto();
                const lama = (data || []).find(r => r.kunci === kunci);

                await uploadFotoStorage(file, pathBaru);
                await simpanWebFoto(kunci, pathBaru);
                if (lama && lama.path) {
                    try { await hapusFotoStorage(lama.path); } catch (e) { console.warn("Gagal hapus file lama", lama.path); }
                }
                AdminApp.fotoWeb.muat();
            } catch (err) { alert("Gagal ganti foto: " + err.message); }
        },

        async reset(btn) {
            const kunci = btn.dataset.key;
            if (!confirm(`Kembalikan foto "${kunci}" ke default?`)) return;
            try {
                await simpanWebFoto(kunci, "");
                const data = await getWebFoto();
                const lama = (data || []).find(r => r.kunci === kunci);
                if (lama && lama.path) {
                    try { await hapusFotoStorage(lama.path); } catch (e) { console.warn("Gagal hapus file", lama.path); }
                }
                AdminApp.fotoWeb.muat();
            } catch (err) { alert("Gagal reset: " + err.message); }
        }
    },

    // ============ SETTING ============
    setting: {
        async gantiPin() {
            const pin = document.getElementById("pinAdminBaru").value.trim();
            if (!pin) return alert("PIN baru wajib diisi!");
            if (pin.length < 4) return alert("PIN minimal 4 karakter!");

            try {
                await simpanPengaturan("admin_pin", pin);
                AdminApp.pengaturan.admin_pin = pin;
                document.getElementById("pinAdminBaru").value = "";
                alert("PIN admin diganti jadi: " + pin);
            } catch (err) { alert("Gagal ganti PIN: " + err.message); }
        },

        async gantiStatus() {
            const status = AdminApp.statusAspirasiEl.value;
            try {
                await simpanPengaturan("status_aspirasi", status);
                AdminApp.pengaturan.status_aspirasi = status;
                alert("Kotak aspirasi: " + (status === "BUKA" ? "Terbuka" : "Tertutup"));
            } catch (err) { alert("Gagal simpan: " + err.message); }
        }
    },

    // ============ HELPERS ============
    async hapusFileLama(daftarPath) {
        const unik = [...new Set(daftarPath.filter(Boolean))];
        for (const p of unik) {
            try { await hapusFotoStorage(p); } catch (e) { console.warn("Gagal hapus file:", p); }
        }
    }
};

// Tab switching (delegasi klik .tab-btn)
document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", (e) => {
        const tab = e.target.closest(".tab-btn");
        if (tab) AdminApp.pindahTab(tab.dataset.tab);
    });
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => AdminApp.init());
} else {
    AdminApp.init();
}
