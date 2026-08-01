// =========================================================================
// ADMIN WEB OSIS TARPAN ONE — PIN gate + CRUD (pimpinan, anggota, sekbid,
// foto web, pengaturan). Semua akses data lewat db.js.
// =========================================================================

let pengaturanAdmin = {};
let stateFotoPimpinan = { ketua: null, wakil: null, angkatan: null };
let loadedPimpinan = null;

const SESSION_KEY = "osis_admin_login";
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 jam

// =========================================================================
// PIN GATE
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    try { pengaturanAdmin = await getSemuaPengaturan(); }
    catch (err) { console.error(err); }

    const sesi = parseInt(localStorage.getItem(SESSION_KEY) || "0", 10);
    if (sesi && Date.now() - sesi < SESSION_DURATION) {
        bukaDashboard();
    }

    if (pengaturanAdmin.status_aspirasi) {
        document.getElementById("statusAspirasiSelect").value = pengaturanAdmin.status_aspirasi;
    }
});

async function masukAdmin() {
    const input = document.getElementById("pinInput").value.trim();
    const errorEl = document.getElementById("pinError");
    if (!input) { errorEl.textContent = "PIN diisi dulu yaa"; return; }

    const pinBenar = pengaturanAdmin.admin_pin || "osis2026";
    if (input !== pinBenar) {
        errorEl.textContent = "PIN salah, coba lagi!";
        return;
    }

    localStorage.setItem(SESSION_KEY, String(Date.now()));
    bukaDashboard();
}

function bukaDashboard() {
    document.getElementById("lockScreen").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    isiTahunSelect();
    muatPimpinan();
    muatAnggota();
    muatSekbid();
    muatFotoWeb();
}

function keluarAdmin() {
    localStorage.removeItem(SESSION_KEY);
    location.reload();
}

function pindahTab(id, btn) {
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    btn.classList.add("active");
}

// =========================================================================
// PILIH TAHUN
// =========================================================================
function isiTahunSelect() {
    const s1 = document.getElementById("pilihTahunPimpinan");
    const s2 = document.getElementById("pilihTahunAnggota");
    let opsi = "";
    for (let thn = 2027; thn >= 2010; thn--) {
        opsi += `<option value="${thn}">${thn}</option>`;
    }
    s1.innerHTML = opsi;
    s2.innerHTML = opsi;
    s1.value = "2026";
    s2.value = "2026";
}

// =========================================================================
// PIMPINAN (per tahun)
// =========================================================================
async function muatPimpinan() {
    const tahun = document.getElementById("pilihTahunPimpinan").value;
    stateFotoPimpinan = { ketua: null, wakil: null, angkatan: null };
    loadedPimpinan = null;

    try {
        const { data, error } = await supa
            .from("pimpinan")
            .select("*")
            .eq("tahun", parseInt(tahun, 10))
            .maybeSingle();
        if (error) throw error;

        loadedPimpinan = data;
        const kosong = { ketua_nama: "", wakil_nama: "", ketua_foto: "", wakil_foto: "", foto_angkatan: "" };
        const row = data || kosong;

        document.getElementById("pimpinanKetuaNama").value = row.ketua_nama || "";
        document.getElementById("pimpinanWakilNama").value = row.wakil_nama || "";

        setPreview("previewKetua", getFoto(row.ketua_foto), "Foto ketua belum ada");
        setPreview("previewWakil", getFoto(row.wakil_foto), "Foto wakil belum ada");
        setPreview("previewAngkatan", getFoto(row.foto_angkatan), "Foto angkatan belum ada");
    } catch (err) {
        console.error(err);
        alert("Gagal memuat data pimpinan: " + err.message);
    }
}

function setPreview(idImg, src, fallbackTeks) {
    const el = document.getElementById(idImg);
    if (src) {
        el.onerror = () => { el.removeAttribute("src"); el.alt = fallbackTeks; };
        el.src = src;
        el.alt = "Preview";
    } else {
        el.removeAttribute("src");
        el.alt = fallbackTeks;
    }
}

async function uploadFotoPimpinan(slot) {
    const tahun = document.getElementById("pilihTahunPimpinan").value;
    const idInput = slot === "ketua" ? "pimpinanKetuaFile" : slot === "wakil" ? "pimpinanWakilFile" : "pimpinanAngkatanFile";
    const idPreview = slot === "ketua" ? "previewKetua" : slot === "wakil" ? "previewWakil" : "previewAngkatan";
    const file = document.getElementById(idInput).files[0];

    if (!file) { alert("Pilih file dulu yaa"); return; }
    if (!file.type.startsWith("image/")) { alert("File harus gambar!"); return; }

    const ekstensi = file.name.split(".").pop() || "jpg";
    const prefiks = slot === "ketua" ? "ketos" : slot === "wakil" ? "waketos" : "fotoangkatan";
    const pathBaru = `${slot === "angkatan" ? "angkatan" : "pimpinan"}/${prefiks}${tahun}-${Date.now()}.${ekstensi}`;

    try {
        await uploadFotoStorage(file, pathBaru);
        stateFotoPimpinan[slot] = pathBaru;
        document.getElementById(idPreview).src = getFoto(pathBaru);
        document.getElementById(idInput).value = "";
        alert("Foto terupload! Klik 'Simpan Data' biar kepake.");
    } catch (err) {
        console.error(err);
        alert("Gagal upload foto: " + err.message);
    }
}

async function simpanPimpinan() {
    const tahun = parseInt(document.getElementById("pilihTahunPimpinan").value, 10);
    const row = {
        tahun: tahun,
        ketua_nama: document.getElementById("pimpinanKetuaNama").value.trim(),
        wakil_nama: document.getElementById("pimpinanWakilNama").value.trim()
    };

    const fotoLama = loadedPimpinan || {};
    if (stateFotoPimpinan.ketua) row.ketua_foto = stateFotoPimpinan.ketua;
    else row.ketua_foto = fotoLama.ketua_foto || "";
    if (stateFotoPimpinan.wakil) row.wakil_foto = stateFotoPimpinan.wakil;
    else row.wakil_foto = fotoLama.wakil_foto || "";
    if (stateFotoPimpinan.angkatan) row.foto_angkatan = stateFotoPimpinan.angkatan;
    else row.foto_angkatan = fotoLama.foto_angkatan || "";

    if (!row.ketua_nama && !row.wakil_nama && !row.ketua_foto && !row.wakil_foto && !row.foto_angkatan) {
        if (!confirm("Data tahun ini kosong semua. Hapus data pimpinan tahun ini?")) return;
        try {
            await supa.from("pimpinan").delete().eq("tahun", tahun);
            hapusBerkasLama([fotoLama.ketua_foto, fotoLama.wakil_foto, fotoLama.foto_angkatan]);
            alert("Data tahun " + tahun + " dihapus.");
            muatPimpinan();
            return;
        } catch (err) {
            alert("Gagal hapus: " + err.message);
            return;
        }
    }

    try {
        await simpanPimpinan(row);
        hapusBerkasLama([
            stateFotoPimpinan.ketua ? fotoLama.ketua_foto : null,
            stateFotoPimpinan.wakil ? fotoLama.wakil_foto : null,
            stateFotoPimpinan.angkatan ? fotoLama.foto_angkatan : null
        ]);
        alert("Data pimpinan tahun " + tahun + " tersimpan!");
        stateFotoPimpinan = { ketua: null, wakil: null, angkatan: null };
        muatPimpinan();
    } catch (err) {
        alert("Gagal simpan: " + err.message);
    }
}

async function hapusBerkasLama(daftarPath) {
    const unik = [...new Set(daftarPath.filter(Boolean))];
    for (const p of unik) {
        try { await hapusFotoStorage(p); } catch (e) { console.warn("Gagal hapus file:", p, e); }
    }
}

// =========================================================================
// ANGGOTA (per tahun)
// =========================================================================
async function muatAnggota() {
    const tahun = document.getElementById("pilihTahunAnggota").value;
    const container = document.getElementById("listAnggotaAdmin");

    try {
        const { data, error } = await supa
            .from("anggota")
            .select("*")
            .eq("tahun", parseInt(tahun, 10))
            .order("urutan", { ascending: true });
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="card-row">Belum ada anggota untuk tahun ${tahun}.</div>`;
            return;
        }

        container.innerHTML = data.map(a => `
            <div class="card-row">
                <div class="card-row-grid">
                    <input type="text" class="admin-input" id="anggotaNama-${a.id}" value="${escHtml(a.nama)}" placeholder="Nama">
                    <input type="text" class="admin-input" id="anggotaJabatan-${a.id}" value="${escHtml(a.jabatan)}" placeholder="Jabatan">
                    <input type="number" class="admin-input" id="anggotaUrutan-${a.id}" value="${a.urutan}" min="1" max="99">
                    <div style="display:flex; gap:6px;">
                        <button class="btn-admin btn-small btn-soft" onclick="simpanAnggotaRow(${a.id})">💾</button>
                        <button class="btn-admin btn-small btn-danger" onclick="hapusAnggotaRow(${a.id})">🗑️</button>
                    </div>
                </div>
            </div>
        `).join("");
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="card-row">Gagal memuat anggota: ${escHtml(err.message)}</div>`;
    }
}

function escHtml(teks) {
    return String(teks || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function simpanAnggotaRow(id) {
    try {
        await updateAnggota(id, {
            nama: document.getElementById("anggotaNama-" + id).value.trim(),
            jabatan: document.getElementById("anggotaJabatan-" + id).value.trim(),
            urutan: parseInt(document.getElementById("anggotaUrutan-" + id).value, 10) || 15
        });
        alert("Anggota tersimpan!");
        muatAnggota();
    } catch (err) {
        alert("Gagal simpan: " + err.message);
    }
}

async function hapusAnggotaRow(id) {
    if (!confirm("Yakin hapus anggota ini?")) return;
    try {
        await hapusAnggota(id);
        muatAnggota();
    } catch (err) {
        alert("Gagal hapus: " + err.message);
    }
}

async function tambahAnggotaBaru() {
    const tahun = parseInt(document.getElementById("pilihTahunAnggota").value, 10);
    const nama = document.getElementById("anggotaBaruNama").value.trim();
    const jabatan = document.getElementById("anggotaBaruJabatan").value.trim();
    const urutan = parseInt(document.getElementById("anggotaBaruUrutan").value, 10) || 15;

    if (!nama) { alert("Nama wajib diisi!"); return; }
    if (!jabatan) { alert("Jabatan wajib diisi!"); return; }

    try {
        await tambahAnggota({ tahun: tahun, nama: nama, jabatan: jabatan, urutan: urutan });
        alert("Anggota ditambahkan!");
        document.getElementById("anggotaBaruNama").value = "";
        document.getElementById("anggotaBaruJabatan").value = "";
        document.getElementById("anggotaBaruUrutan").value = "15";
        muatAnggota();
    } catch (err) {
        alert("Gagal tambah: " + err.message);
    }
}

// =========================================================================
// SEKBID
// =========================================================================
async function muatSekbid() {
    const container = document.getElementById("listSekbidAdmin");
    try {
        const data = await getSekbid();
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="card-row">Belum ada data sekbid.</div>`;
            return;
        }

        container.innerHTML = data.map(s => `
            <div class="card-row">
                <div class="card-row-grid">
                    <select class="admin-select" id="sekbidKategori-${s.id}">
                        <option value="BPH" ${s.kategori === "BPH" ? "selected" : ""}>BPH</option>
                        <option value="SEKBID" ${s.kategori === "SEKBID" ? "selected" : ""}>SEKBID</option>
                    </select>
                    <input type="text" class="admin-input" id="sekbidNama-${s.id}" value="${escHtml(s.nama)}" placeholder="Nama">
                    <input type="text" class="admin-input" id="sekbidUrutan-${s.id}" value="${s.urutan}" min="1" max="99" placeholder="Urutan">
                    <div style="display:flex; gap:6px;">
                        <button class="btn-admin btn-small btn-soft" onclick="simpanSekbidRow(${s.id})">💾</button>
                        <button class="btn-admin btn-small btn-danger" onclick="hapusSekbidRow(${s.id})">🗑️</button>
                    </div>
                </div>
                <input type="text" class="admin-input" style="margin-top:8px;" id="sekbidIcon-${s.id}" value="${escHtml(s.icon)}" placeholder="Icon emoji">
                <textarea class="admin-textarea" style="margin-top:8px;" id="sekbidDeskripsi-${s.id}" placeholder="Deskripsi / tugas pokok">${escHtml(s.deskripsi)}</textarea>
            </div>
        `).join("");
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="card-row">Gagal memuat sekbid: ${escHtml(err.message)}</div>`;
    }
}

async function simpanSekbidRow(id) {
    try {
        await updateSekbid(id, {
            kategori: document.getElementById("sekbidKategori-" + id).value,
            nama: document.getElementById("sekbidNama-" + id).value.trim(),
            icon: document.getElementById("sekbidIcon-" + id).value.trim(),
            deskripsi: document.getElementById("sekbidDeskripsi-" + id).value.trim(),
            urutan: parseInt(document.getElementById("sekbidUrutan-" + id).value, 10) || 1
        });
        alert("Sekbid tersimpan!");
        muatSekbid();
    } catch (err) {
        alert("Gagal simpan: " + err.message);
    }
}

async function hapusSekbidRow(id) {
    if (!confirm("Yakin hapus sekbid ini?")) return;
    try {
        await hapusSekbid(id);
        muatSekbid();
    } catch (err) {
        alert("Gagal hapus: " + err.message);
    }
}

async function tambahSekbidBaru() {
    const nama = document.getElementById("sekbidBaruNama").value.trim();
    if (!nama) { alert("Nama wajib diisi!"); return; }

    try {
        await tambahSekbid({
            kategori: document.getElementById("sekbidBaruKategori").value,
            nama: nama,
            icon: document.getElementById("sekbidBaruIcon").value.trim(),
            deskripsi: document.getElementById("sekbidBaruDeskripsi").value.trim(),
            urutan: 99
        });
        alert("Sekbid ditambahkan!");
        document.getElementById("sekbidBaruNama").value = "";
        document.getElementById("sekbidBaruIcon").value = "";
        document.getElementById("sekbidBaruDeskripsi").value = "";
        muatSekbid();
    } catch (err) {
        alert("Gagal tambah: " + err.message);
    }
}

// =========================================================================
// FOTO WEB
// =========================================================================
async function muatFotoWeb() {
    const container = document.getElementById("gridFotoWeb");
    try {
        const data = await getWebFoto();
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="card-row">Belum ada data foto web. Jalankan setup SQL dulu.</div>`;
            return;
        }

        container.innerHTML = data.map(f => {
            const urlAktif = f.path ? getFoto(f.path) : getFoto("web/" + f.kunci + ".jpg");
            const label = f.kunci.replace(/\d+/g, m => " " + m);
            return `
            <div class="foto-web-card">
                <img class="fw-preview" src="${urlAktif}"
                     onerror="this.onerror=null;this.src='${f.path ? "" : getFoto("web/" + f.kunci + ".png")}'"
                     alt="${escHtml(f.kunci)}">
                <h5>${escHtml(label)}</h5>
                <input type="file" id="fwFile-${escHtml(f.kunci)}" accept="image/*">
                <div class="fw-actions">
                    <button class="btn-admin btn-red" onclick="gantiFotoWeb('${escHtml(f.kunci)}')">Ganti Foto</button>
                    ${f.path ? `<button class="btn-admin btn-danger" onclick="resetFotoWeb('${escHtml(f.kunci)}', '${escHtml(f.path)}')">Reset</button>` : ""}
                </div>
            </div>`;
        }).join("");
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="card-row">Gagal memuat foto web: ${escHtml(err.message)}</div>`;
    }
}

async function gantiFotoWeb(kunci) {
    const file = document.getElementById("fwFile-" + kunci).files[0];
    if (!file) { alert("Pilih file dulu yaa"); return; }
    if (!file.type.startsWith("image/")) { alert("File harus gambar!"); return; }

    const ekstensi = file.name.split(".").pop() || "jpg";
    const pathBaru = `web/${kunci}-${Date.now()}.${ekstensi}`;

    try {
        // Cari path lama dulu buat dibersihin abis ganti
        const data = await getWebFoto();
        const rowLama = data.find(r => r.kunci === kunci);

        await uploadFotoStorage(file, pathBaru);
        await simpanWebFoto(kunci, pathBaru);

        if (rowLama && rowLama.path) {
            try { await hapusFotoStorage(rowLama.path); } catch (e) { console.warn("Gagal hapus file lama:", rowLama.path, e); }
        }

        alert("Foto '" + kunci + "' diganti!");
        muatFotoWeb();
    } catch (err) {
        alert("Gagal ganti foto: " + err.message);
    }
}

async function resetFotoWeb(kunci, pathLama) {
    if (!confirm("Kembalikan foto '" + kunci + "' ke default?")) return;
    try {
        await simpanWebFoto(kunci, "");
        try { await hapusFotoStorage(pathLama); } catch (e) { console.warn("Gagal hapus file:", pathLama, e); }
        alert("Foto '" + kunci + "' kembali ke default.");
        muatFotoWeb();
    } catch (err) {
        alert("Gagal reset: " + err.message);
    }
}

// =========================================================================
// PENGATURAN
// =========================================================================
async function gantiPin() {
    const pinBaru = document.getElementById("pinAdminBaru").value.trim();
    if (!pinBaru) { alert("PIN baru wajib diisi!"); return; }
    if (pinBaru.length < 4) { alert("PIN minimal 4 karakter!"); return; }

    try {
        await simpanPengaturan("admin_pin", pinBaru);
        pengaturanAdmin.admin_pin = pinBaru;
        alert("PIN admin diganti jadi: " + pinBaru);
        document.getElementById("pinAdminBaru").value = "";
    } catch (err) {
        alert("Gagal ganti PIN: " + err.message);
    }
}

async function gantiStatusAspirasi() {
    const status = document.getElementById("statusAspirasiSelect").value;
    try {
        await simpanPengaturan("status_aspirasi", status);
        pengaturanAdmin.status_aspirasi = status;
        alert("Kotak aspirasi sekarang: " + (status === "BUKA" ? "Terbuka" : "Tertutup"));
    } catch (err) {
        alert("Gagal simpan status: " + err.message);
    }
}

// Enter di layar PIN langsung submit
document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("pinInput");
    if (input) {
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") masukAdmin();
        });
    }
});
