// =========================================================================
// DATA LAYER — SEMUA AKSES SUPABASE LEWAT FILE INI
// Urutan include: 1) CDN supabase-js  2) config.js  3) db.js
// =========================================================================

const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Bangun URL publik foto di bucket
function getFoto(pathFoto) {
    if (!pathFoto) return "";
    if (pathFoto.startsWith("http")) return pathFoto;
    return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${pathFoto}`;
}

// =========================================================================
// DEVICE ID — id unik per perangkat (buat limit harian)
// =========================================================================

function getDeviceId() {
    let id = localStorage.getItem("osis_device_id");
    if (!id) {
        id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("osis_device_id", id);
    }
    return id;
}

// =========================================================================
// AUTH — akun OSIS dari tabel osis_users
// =========================================================================

// Ambil akun OSIS by username (password dicompare di client, pola e-learniz)
async function getOsisUser(username) {
    const { data, error } = await supa
        .from("osis_users")
        .select("id, username, password, nama, jabatan")
        .eq("username", username)
        .maybeSingle();
    if (error) throw error;
    return data || null;
}

// =========================================================================
// PUBLIC
// =========================================================================

// Ketua & wakil semua tahun
async function getPimpinan() {
    const { data, error } = await supa
        .from("pimpinan")
        .select("*")
        .order("tahun", { ascending: true });
    if (error) throw error;
    return data;
}

// Anggota semua tahun, urut jabatan
async function getAnggota() {
    const { data, error } = await supa
        .from("anggota")
        .select("*")
        .order("tahun", { ascending: true })
        .order("urutan", { ascending: true });
    if (error) throw error;
    return data;
}

// Seksi bidang & BPH
async function getSekbid() {
    const { data, error } = await supa
        .from("sekbid")
        .select("*")
        .order("urutan", { ascending: true });
    if (error) throw error;
    return data;
}

// Foto halaman web (tabel web_foto)
async function getWebFoto() {
    const { data, error } = await supa
        .from("web_foto")
        .select("*")
        .order("kunci", { ascending: true });
    if (error) throw error;
    return data;
}

// Kirim aspirasi siswa — lewat RPC biar bisa dilimit per device per hari
async function kirimAspirasi(nama, kelas, isi) {
    const { data, error } = await supa.rpc("kirim_aspirasi_terbatas", {
        p_device_id: getDeviceId(),
        p_nama: nama,
        p_kelas: kelas,
        p_isi: isi
    });
    if (error) throw error;
    if (data !== "OK") throw new Error(data);
}

// Ambil aspirasi terbaru buat ditampilkan (terbaru di atas, maks 50)
async function getAspirasi() {
    const { data, error } = await supa
        .from("aspirasi")
        .select("id, device_id, nama, kelas, isi, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
    if (error) throw error;
    return data || [];
}

// Hapus aspirasi milik sendiri (device_id dicek di server)
async function hapusAspirasiSendiri(id) {
    const { data, error } = await supa.rpc("hapus_aspirasi_own", {
        p_device_id: getDeviceId(),
        p_id: id
    });
    if (error) throw error;
    if (data !== "OK") throw new Error(data);
}

// Cek sakelar buka/tutup aspirasi
async function cekStatusAspirasi() {
    try {
        const { data, error } = await supa
            .from("pengaturan")
            .select("nilai")
            .eq("kunci", "status_aspirasi")
            .maybeSingle();
        if (error) throw error;
        return data ? String(data.nilai).trim().toUpperCase() : "BUKA";
    } catch (err) {
        console.error("Gagal baca sakelar aspirasi, default BUKA", err);
        return "BUKA";
    }
}

// Kirim request lagu (radio jam istirahat) — lewat RPC biar bisa dilimit
async function kirimRequestLagu(judul, penyanyi, nama) {
    const { data, error } = await supa.rpc("kirim_lagu_terbatas", {
        p_device_id: getDeviceId(),
        p_judul: judul,
        p_penyanyi: penyanyi,
        p_nama: nama
    });
    if (error) throw error;
    if (data !== "OK") throw new Error(data);
}

// Catat pengunjung unik per device (1x per hari), return total kunjungan
async function catatVisitor() {
    const { data, error } = await supa.rpc("tambah_visitor_unik", {
        p_device_id: getDeviceId()
    });
    if (error) throw error;
    return data || 0;
}

// Ambil request lagu terbaru (terbaru di atas, maks 30)
async function getRequestLagu() {
    const { data, error } = await supa
        .from("lagu_requests")
        .select("id, device_id, judul, penyanyi, nama, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
    if (error) throw error;
    return data || [];
}

// Hapus request lagu milik sendiri (device_id dicek di server)
async function hapusLaguSendiri(id) {
    const { data, error } = await supa.rpc("hapus_lagu_own", {
        p_device_id: getDeviceId(),
        p_id: id
    });
    if (error) throw error;
    if (data !== "OK") throw new Error(data);
}

// =========================================================================
// ADMIN — CRUD & STORAGE
// =========================================================================

async function getSemuaPengaturan() {
    const { data, error } = await supa
        .from("pengaturan")
        .select("kunci, nilai");
    if (error) throw error;
    const hasil = {};
    (data || []).forEach(p => { hasil[p.kunci] = p.nilai; });
    return hasil;
}

async function simpanPengaturan(kunci, nilai) {
    const { error } = await supa
        .from("pengaturan")
        .upsert({ kunci: kunci, nilai: nilai, updated_at: new Date().toISOString() }, { onConflict: "kunci" });
    if (error) throw error;
}

async function simpanPimpinan(row) {
    const { error } = await supa
        .from("pimpinan")
        .upsert(row, { onConflict: "tahun" });
    if (error) throw error;
}

async function hapusPimpinan(tahun) {
    const { error } = await supa.from("pimpinan").delete().eq("tahun", tahun);
    if (error) throw error;
}

async function tambahAnggota(row) {
    const { error } = await supa.from("anggota").insert(row);
    if (error) throw error;
}

async function updateAnggota(id, row) {
    const { error } = await supa.from("anggota").update(row).eq("id", id);
    if (error) throw error;
}

async function hapusAnggota(id) {
    const { error } = await supa.from("anggota").delete().eq("id", id);
    if (error) throw error;
}

async function tambahSekbid(row) {
    const { error } = await supa.from("sekbid").insert(row);
    if (error) throw error;
}

async function updateSekbid(id, row) {
    const { error } = await supa.from("sekbid").update(row).eq("id", id);
    if (error) throw error;
}

async function hapusSekbid(id) {
    const { error } = await supa.from("sekbid").delete().eq("id", id);
    if (error) throw error;
}

async function simpanWebFoto(kunci, path) {
    const { error } = await supa
        .from("web_foto")
        .upsert({ kunci: kunci, path: path, updated_at: new Date().toISOString() });
    if (error) throw error;
}

async function uploadFotoStorage(file, path) {
    const { error } = await supa.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw error;
    return path;
}

async function hapusFotoStorage(path) {
    if (!path) return;
    const { error } = await supa.storage
        .from(STORAGE_BUCKET)
        .remove([path]);
    if (error) throw error;
}
