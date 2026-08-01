// =========================================================================
// ASPIRASI — form kirim aspirasi + sakelar buka/tutup
// =========================================================================

const Aspirasi = {
    status: "BUKA",

    async init() {
        Aspirasi.status = await cekStatusAspirasi();
        if (Aspirasi.status === "TUTUP") Aspirasi.kunciFormulir();
    },

    kunciFormulir() {
        const nama = document.getElementById("namaSiswa");
        const kelas = document.getElementById("kelasSiswa");
        const isi = document.getElementById("isiAspirasi");
        const btn = document.getElementById("btnKirimAspirasi");

        [nama, kelas, isi].forEach(el => {
            if (el) { el.disabled = true; el.placeholder = "🔒 Ditutup sementara"; }
        });
        if (isi) isi.placeholder = "🔒 Maaf, kotak aspirasi sedang ditutup sementara oleh pengurus OSIS.";
        if (btn) {
            btn.innerHTML = "🔒 Kotak Aspirasi Ditutup";
            btn.style.opacity = "0.6";
            btn.style.cursor = "not-allowed";
            btn.style.pointerEvents = "none";
        }
    },

    async kirim() {
        if (Aspirasi.status === "TUTUP") return;

        const nama = document.getElementById("namaSiswa").value.trim();
        const kelas = document.getElementById("kelasSiswa").value.trim();
        const isi = document.getElementById("isiAspirasi").value.trim();
        const feedback = document.getElementById("feedbackAspirasi");
        const btn = document.getElementById("btnKirimAspirasi");

        if (!isi) {
            Aspirasi.tampilkan(feedback, "Unek-uneknya diisi dulu yaa, jangan dikosongkan!", "err");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = "⏳ Mengirim...";
        Aspirasi.tampilkan(feedback, "", "");

        try {
            await kirimAspirasi(nama || "Anonim", kelas || "-", isi);
            Aspirasi.tampilkan(feedback, "Terima kasih! Aspirasimu sudah terkirim langsung ke database OSIS Tarpan One. 🙌", "ok");
            document.getElementById("namaSiswa").value = "";
            document.getElementById("kelasSiswa").value = "";
            document.getElementById("isiAspirasi").value = "";
        } catch (err) {
            console.error(err);
            Aspirasi.tampilkan(feedback, "Waduh, gagal terkirim. Cek koneksi internet lalu coba lagi ya!", "err");
        } finally {
            btn.disabled = false;
            btn.innerHTML = "✈️ Kirim Suara Tarpan";
        }
    },

    tampilkan(el, pesan, tipe) {
        el.textContent = pesan;
        el.className = "form-feedback " + tipe;
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Aspirasi.init());
} else {
    Aspirasi.init();
}
