// =============================
// CEK AUTH (kalau tidak login → tendang ke index.html)
// =============================
// auth.js - REVISED
document.addEventListener("DOMContentLoaded", async () => {
    // Skip check di halaman login/register
    const isPublicPage = window.location.pathname.includes("index.html");
    if (isPublicPage) return;
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
        await autoFetchUser();
    }
});

// =============================
// GET USER (ambil dari localStorage)
// =============================
function getUser() {
    return JSON.parse(localStorage.getItem("user"));
}


// =============================
// AUTO-FETCH (ambil data terbaru user dari Supabase)
// jalan setiap halaman di-load
// =============================
async function autoFetchUser() {
    const oldUser = getUser();
    if (!oldUser) return;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", oldUser.id)
        .single();

    if (error || !data) return;

    // update user terbaru
    localStorage.setItem("user", JSON.stringify(data));
    return data;
}


// =============================
// INIT (dipanggil otomatis ketika halaman dimuat)
// =============================
document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (user) {
        await autoFetchUser(); // update data user terbaru
    }
});

function getShortName(user) {
    if (!user) return "";
    return user.short_name || user.full_name?.split(" ")[0] || "";
}

function getProfilePicture(user) {
    if (!user || !user.avatar_url) return "defaultpp.png";
    return user.avatar_url;
}

document.addEventListener("DOMContentLoaded", () => {
    const user = getUser();
    if (!user) return;

    const shortName = getShortName(user);
    const ppUrl = getProfilePicture(user);

    const nameEl = document.getElementById("headerName");
    const ppEl = document.getElementById("headerPP");

    if (nameEl) nameEl.innerText = `Hai, ${shortName}`;
    if (ppEl) ppEl.src = ppUrl;
});

const user = JSON.parse(localStorage.getItem("user"));
console.log("✅ User loaded:", user.full_name);

function logout() {
    localStorage.clear();       // Hapus data login
    window.location.href = "index.html"; // Balik ke login
}