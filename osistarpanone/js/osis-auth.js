// =========================================================================
// AUTH OSIS — login 2 mode: Tamu (nickname) / OSIS (username+password)
// localStorage.osis_user (key beda dari e-learniz biar ga tabrakan)
// =========================================================================

const OsisAuth = {
    KEY: "osis_user",

    getUser() {
        try { return JSON.parse(localStorage.getItem(OsisAuth.KEY) || "null"); }
        catch { return null; }
    },

    // Masuk sebagai tamu (tanpa akun, cuma nickname)
    loginTamu(nama) {
        localStorage.setItem(OsisAuth.KEY, JSON.stringify({
            mode: "tamu",
            nickname: nama
        }));
    },

    // Masuk sebagai anggota OSIS (akun dari tabel osis_users)
    loginOsis(userObj) {
        const aman = { ...userObj };
        delete aman.password;
        aman.mode = "osis";
        localStorage.setItem(OsisAuth.KEY, JSON.stringify(aman));
    },

    logout() {
        localStorage.removeItem(OsisAuth.KEY);
    },

    // Render area auth di header publik
    renderHeader() {
        const area = document.getElementById("areaAuth");
        if (!area) return;
        const user = OsisAuth.getUser();

        if (user && user.nickname) {
            const tamu = user.mode === "tamu";
            const ikon = tamu
                ? '<i class="fa-solid fa-user"></i>'
                : '<i class="fa-solid fa-id-card"></i>';
            area.innerHTML = `
                <span class="user-chip ${tamu ? "chip-tamu" : ""}" title="${tamu ? "Tamu" : (user.jabatan || "Anggota OSIS")}">
                    ${ikon}
                    ${escapeHtml(user.nickname)}
                </span>
                <button class="icon-btn" title="Keluar" onclick="OsisAuth.logout(); OsisAuth.renderHeader();">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                </button>`;
        } else {
            const back = encodeURIComponent("index.html" + location.hash);
            area.innerHTML = `
                <a href="login.html?back=${back}" class="btn btn-red btn-sm"><i class="fa-solid fa-right-to-bracket"></i> Masuk</a>`;
        }
    }
};

if (typeof onReady === "function") {
    onReady(() => OsisAuth.renderHeader());
} else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => OsisAuth.renderHeader());
} else {
    OsisAuth.renderHeader();
}
