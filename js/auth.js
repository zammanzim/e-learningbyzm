// auth.js - CLEAN VERSION
document.addEventListener("DOMContentLoaded", async () => {
    const isPublicPage = window.location.pathname.includes("index.html");
    if (isPublicPage) return;

    const user = getUser();
    if (user) {
        await autoFetchUser();
    } else {
        window.location.href = "index.html";
    }
});

function getUser() {
    try {
        const data = localStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
}

function getShortName(user) {
    if (!user) return "";
    return user.short_name || user.nickname || user.full_name?.split(" ")[0] || "User";
}

async function autoFetchUser() {
    const oldUser = getUser();
    if (!oldUser) return;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", oldUser.id)
        .single();

    if (error || !data) return;

    localStorage.setItem("user", JSON.stringify(data));
    return data;
}

function logout() {
    {
        localStorage.clear();
        window.location.href = "index.html";
    }
}