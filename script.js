// === KONFIGURASI SUPABASE ===
const SUPABASE_URL = "https://vttmwtlqzbbiaromohrp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dG13dGxxemJiaWFyb21vaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg4NTMsImV4cCI6MjA4MDg0NDg1M30.16SwOEqD5ZNAgk1oWhLrL41Eqw4kkeAKTyHxkSqmpiY";

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// === HASH PASSWORD (SHA-256) ===
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0")).join("");
}


// === REGISTER ===
async function loadClasses() {
    const { data } = await _supabase.from("classes").select("*");
    const select = document.getElementById("classSelect");
    select.innerHTML = `<option disabled selected value="">-- Pilih Kelas --</option>`;
    data.forEach(cls => {
        select.innerHTML += `<option value="${cls.id}">${cls.name}</option>`;
    });
}

async function loadNames() {
    const class_id = document.getElementById("classSelect").value;
    const { data, error } = await _supabase
        .from("users")
        .select("id, full_name")
        .eq("class_id", class_id)
        .order("full_name", { ascending: true }); // <--- Tambahkan ini!

    const select = document.getElementById("nameSelect");
    select.innerHTML = `<option disabled selected>Pilih nama</option>`;

    data.forEach(user => {
        const opt = document.createElement("option");
        opt.value = user.id;
        opt.textContent = user.full_name;
        select.appendChild(opt);
    });
}


async function register() {
    const selectedUser = JSON.parse(localStorage.getItem("selectedUser"));

    const username = document.getElementById("newUsername").value;
    const password = document.getElementById("newPassword").value;
    const hashed = await hashPassword(password);

    const { data, error } = await _supabase
        .from("users")
        .update({
            username: username,
            password: hashed,
            status: "active"
        })
        .eq("id", selectedUser.id)
        .select()
        .single(); // sudah pasti 1 row

    if (error) return alert("Gagal daftar: " + error.message);

    // SIMPAN HASIL UPDATE, BUKAN selectedUser
    localStorage.setItem("user", JSON.stringify(data));
    localStorage.removeItem("selectedUser");

    window.location.href = "announcements.html";
}

async function login() {
    const user = JSON.parse(localStorage.getItem("selectedUser"));
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;
    const hashed = await hashPassword(password);

    if (user.username !== username || user.password !== hashed) {
        return alert("Username / Password salah!");
    }

    localStorage.setItem("user", JSON.stringify(user));
    window.location.href = "announcements.html";
}

// === REDIRECT ###
function redirectDashboard() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return (window.location.href = "index.html");

    if (user.role === "super_admin") window.location.href = "admin-global.html";
    else if (user.role === "class_admin") window.location.href = "class-admin.html";
    else window.location.href = "home.html";
}

async function submitPassword() {
    const user = JSON.parse(localStorage.getItem("selectedUser"));
    const password = document.getElementById("passwordInput").value;

    if (!password) return alert("Password wajib diisi!");

    const hashed = await hashPassword(password);

    if (user.status === "pending") {
        // SET PASSWORD BARU → AKTIFKAN AKUN
        await _supabase.from("users")
            .update({
                password: hashed,
                status: "active"
            })
            .eq("id", user.id);

        const { data } = await _supabase
            .from("users")
            .select("*")
            .eq("id", user.id)
            .single();

        localStorage.setItem("user", JSON.stringify(data));
        window.location.href = "announcements.html";

    } else {
        // LOGIN CEK PASSWORD
        if (user.password !== hashed)
            return alert("Password salah!");

        localStorage.setItem("user", JSON.stringify(user));
        window.location.href = "annoucements.html";
    }
}

document.addEventListener("DOMContentLoaded", loadClasses);

async function checkUserStatus() {
    const id = document.getElementById("nameSelect").value;
    if (!id) return;

    const { data } = await _supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

    localStorage.setItem("selectedUser", JSON.stringify(data));

    // Sembunyikan dulu semuanya
    document.getElementById("registerSection").style.display = "none";
    document.getElementById("loginSection").style.display = "none";

    if (!data.username) {
        // BELUM PUNYA AKUN
        document.getElementById("info").innerText = "Buat akun baru kamu";
        document.getElementById("registerSection").style.display = "block";
    } else {
        // SUDAH PUNYA AKUN
        document.getElementById("info").innerText = "Masukkan username & password";
        document.getElementById("loginSection").style.display = "block";
        document.getElementById("loginUsername").value = data.username;
    }
}

function logout() {
    localStorage.clear();       // Hapus data login
    window.location.href = "index.html"; // Balik ke login
}
