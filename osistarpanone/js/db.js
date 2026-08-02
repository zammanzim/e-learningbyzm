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

// Kirim aspirasi siswa
async function kirimAspirasi(nama, kelas, isi) {
    const { error } = await supa
        .from("aspirasi")
        .insert({ nama: nama, kelas: kelas, isi: isi });
    if (error) throw error;
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
