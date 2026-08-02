// =========================================================================
// LOGIN — 2 mode: Tamu (nickname) / OSIS (username + password)
// =========================================================================

const Login = {
    back: "index.html#/",

    init() {
        const params = new URLSearchParams(location.search);
        const back = params.get("back");
        if (back && /^(index\.html|\.\/|#)/.test(back)) Login.back = back;

        if (OsisAuth.getUser()) {
            location.replace("index.html");
            return;
        }

        document.getElementById("tamuNama").addEventListener("keydown", (e) => {
            if (e.key === "Enter") Login.masukTamu();
        });
        document.getElementById("osisUsername").addEventListener("keydown", (e) => {
            if (e.key === "Enter") document.getElementById("osisPassword").focus();
        });
        document.getElementById("osisPassword").addEventListener("keydown", (e) => {
            if (e.key === "Enter") Login.masukOsis();
        });
    },

    pilih(mode) {
        Login.bersihError();
        const slider = document.getElementById("mainSlider");
        slider.classList.toggle("step-1", mode === "osis");

        setTimeout(() => {
            if (mode === "osis") document.getElementById("osisUsername").focus();
            if (mode === "") document.getElementById("tamuNama").focus();
        }, 260);
    },

    masukTamu() {
        const nama = document.getElementById("tamuNama").value.trim();
        Login.bersihError();
        if (!nama) return Login.tampilError("Nama panggilan diisi dulu yaa.");

        OsisAuth.loginTamu(nama);
        location.replace(Login.back);
    },

    async masukOsis() {
        const username = document.getElementById("osisUsername").value.trim();
        const pw = document.getElementById("osisPassword").value;
        Login.bersihError();

        if (!username) return Login.tampilError("Username diisi dulu yaa.");
        if (!pw) return Login.tampilError("Password diisi dulu yaa.");

        let user;
        try {
            user = await getOsisUser(username);
        } catch (err) {
            console.error(err);
            return Login.tampilError("Gagal cek akun. Cek koneksi.");
        }

        if (!user) return Login.tampilError("Akun tidak ditemukan.");
        if (pw !== user.password) return Login.tampilError("Password salah, coba lagi!");

        OsisAuth.loginOsis(user);
        location.replace(Login.back);
    },

    tampilError(pesan) {
        const el = document.getElementById("loginError");
        el.textContent = pesan;
        el.style.display = "block";
    },

    bersihError() {
        const el = document.getElementById("loginError");
        el.textContent = "";
        el.style.display = "none";
    }
};

document.addEventListener("DOMContentLoaded", () => Login.init());
