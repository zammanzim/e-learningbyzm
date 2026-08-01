// =========================================================================
// KONEKSI DATABASE SUPABASE - SEMUA AKSES DATA LEWAT FILE INI
// =========================================================================
// Catatan: file ini dipakai bersama (index.html, sekbid.html, aspirasi.html)
// urutan include di HTML harus:
// 1. CDN supabase-js (https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2)
// 2. supabase-config.js
// 3. db.js
// =========================================================================

const supa = window.supabase ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Membangun URL foto dari path di database (contoh path: "angkatan/foto-2010.jpg")
function getFoto(pathFoto) {
    if (!pathFoto) return "";
    if (pathFoto.startsWith("http")) return pathFoto;
    const host = SUPABASE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}/storage/v1/object/public/osis-foto/${pathFoto}`;
}

// Ambil data ketua & wakil semua tahun (tabel pimpinan)
async function getPimpinan() {
    const { data, error } = await supa
        .from("pimpinan")
        .select("*")
        .order("tahun", { ascending: true });
    if (error) throw error;
    return data;
}

// Ambil data anggota semua tahun, sudah terurut jabatan (tabel anggota)
async function getAnggota() {
    const { data, error } = await supa
        .from("anggota")
        .select("*")
        .order("tahun", { ascending: true })
        .order("urutan", { ascending: true });
    if (error) throw error;
    return data;
}

// Ambil data seksi bidang & BPH (tabel sekbid)
async function getSekbid() {
    const { data, error } = await supa
        .from("sekbid")
        .select("*")
        .order("urutan", { ascending: true });
    if (error) throw error;
    return data;
}

// Kirim aspirasi siswa ke database (tabel aspirasi)
async function kirimAspirasi(nama, kelas, isi) {
    const { error } = await supa
        .from("aspirasi")
        .insert({ nama: nama, kelas: kelas, isi: isi });
    if (error) throw error;
}

// Cek sakelar buka/tutup kotak aspirasi (tabel pengaturan)
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
        console.error("Gagal membaca sakelar Supabase, default: BUKA", err);
        return "BUKA";
    }
}

// =========================================================================
// ADMIN WEB (admin.html) — CRUD & storage
// =========================================================================

// Ambil semua foto halaman web (tabel web_foto)
async function getWebFoto() {
    const { data, error } = await supa
        .from("web_foto")
        .select("*")
        .order("kunci", { ascending: true });
    if (error) throw error;
    return data;
}

// Ambil semua pengaturan (PIN admin, status aspirasi, dll)
async function getSemuaPengaturan() {
    const { data, error } = await supa
        .from("pengaturan")
        .select("kunci, nilai");
    if (error) throw error;
    const hasil = {};
    (data || []).forEach(p => { hasil[p.kunci] = p.nilai; });
    return hasil;
}

// Simpan/ubah satu pengaturan
async function simpanPengaturan(kunci, nilai) {
    const { error } = await supa
        .from("pengaturan")
        .upsert({ kunci: kunci, nilai: nilai, updated_at: new Date().toISOString() }, { onConflict: "kunci" });
    if (error) throw error;
}

// CRUD PIMPINAN (per tahun)
async function simpanPimpinan(row) {
    const { error } = await supa
        .from("pimpinan")
        .upsert(row, { onConflict: "tahun" });
    if (error) throw error;
}

// CRUD ANGGOTA
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

// CRUD SEKBID
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

// Simpan path foto halaman web (tabel web_foto)
async function simpanWebFoto(kunci, path) {
    const { error } = await supa
        .from("web_foto")
        .upsert({ kunci: kunci, path: path, updated_at: new Date().toISOString() });
    if (error) throw error;
}

// Upload foto ke storage bucket osis-foto
async function uploadFotoStorage(file, path) {
    const { error } = await supa.storage
        .from("osis-foto")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw error;
    return path;
}

// Hapus foto dari storage
async function hapusFotoStorage(path) {
    if (!path) return;
    const { error } = await supa.storage
        .from("osis-foto")
        .remove([path]);
    if (error) throw error;
}
