// =========================================================================
// KOTAK ASPIRASI - KONEKSI SUPABASE (tabel aspirasi & pengaturan)
// =========================================================================
let statusWebSekarang = "BUKA";

// Cek sakelar buka/tutup dari tabel pengaturan saat siswa buka web
document.addEventListener("DOMContentLoaded", async function () {
    statusWebSekarang = await cekStatusAspirasi();

    // Jika di database tertulis TUTUP, langsung kunci webnya!
    if (statusWebSekarang === "TUTUP") {
        kunciFormulirAspirasi();
    }
});

// Fungsi untuk mengunci tampilan web secara otomatis
function kunciFormulirAspirasi() {
    const namaInput = document.getElementById('namaSiswa');
    const kelasInput = document.getElementById('kelasSiswa');
    const pesanInput = document.getElementById('isiAspirasi');
    const tombolKirim = document.querySelector('.btn-glow-kirim');

    if (namaInput) { namaInput.disabled = true; namaInput.placeholder = "🔒 Ditutup"; }
    if (kelasInput) { kelasInput.disabled = true; kelasInput.placeholder = "🔒 Ditutup"; }
    if (pesanInput) { 
        pesanInput.disabled = true; 
        pesanInput.placeholder = "🔒 Maaf, Kotak Aspirasi Suara Tarpan saat ini sedang ditutup sementara oleh pengurus OSIS."; 
    }
    if (tombolKirim) {
        tombolKirim.style.background = "#d1d1d6";
        tombolKirim.style.boxShadow = "none";
        tombolKirim.style.cursor = "not-allowed";
        tombolKirim.innerHTML = "<span>Kotak Aspirasi Sedang Ditutup</span> 🔒";
    }
}

// Fungsi utama kirim aspirasi ke database Supabase
async function kirimAspirasiLangsung() {
    // Cek status terakhir, kalau TUTUP batalkan proses kirim
    if (statusWebSekarang === "TUTUP") {
        alert("Gagal mengirim! Kotak aspirasi saat ini sedang ditutup sementara oleh OSIS.");
        return;
    }

    let nama = document.getElementById('namaSiswa').value;
    let kelas = document.getElementById('kelasSiswa').value;
    const teksAspirasi = document.getElementById('isiAspirasi').value;

    if (teksAspirasi.trim() === "") {
        alert("Unek-uneknya diisi dulu yaa, jangan dikosongkan!");
        return;
    }

    if (nama.trim() === "") nama = "Anonim";
    if (kelas.trim() === "") kelas = "-";

    const tombolKirim = document.querySelector('.btn-glow-kirim');
    if (tombolKirim) tombolKirim.disabled = true;

    try {
        await kirimAspirasi(nama.trim(), kelas.trim(), teksAspirasi.trim());
        alert("Terima kasih! Aspirasimu sudah terkirim langsung dan tercatat di database OSIS Tarpan One.");
        document.getElementById('namaSiswa').value = "";
        document.getElementById('kelasSiswa').value = "";
        document.getElementById('isiAspirasi').value = "";
    } catch (error) {
        console.error(error);
        alert("Waduh, gagal terkirim. Cek koneksi internet atau konfigurasi Supabase, lalu coba lagi ya!");
    } finally {
        if (tombolKirim) tombolKirim.disabled = false;
    }
}
