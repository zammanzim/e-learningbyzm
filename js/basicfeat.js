function enableCloseOnOutside() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    overlay.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
        overlay.onclick = null;
    };
}

function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    const hamburger = document.getElementById("hamburger");
    const overlay = document.getElementById("sidebarOverlay");

    const mainContent =
        document.querySelector(".main-content") ||
        document.querySelector(".main");

    if (window.innerWidth >= 1024) {
        sidebar.classList.toggle("closed");
        if (mainContent) mainContent.classList.toggle("shifted");
    } else {
        sidebar.classList.toggle("open");
        hamburger.classList.toggle("active");

        if (sidebar.classList.contains("open")) {
            overlay.classList.add("show");
            enableCloseOnOutside();
        } else {
            overlay.classList.remove("show");
        }
    }
}

function enableCloseOnOutside() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const hamburger = document.getElementById("hamburger");

    overlay.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
        hamburger.classList.remove("active");
        overlay.onclick = null;
    };
}

/** === PROFILE DROPDOWN === **/
document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.getElementById("profileTrigger");
    const dropdown = document.getElementById("profileDropdown");

    if (!trigger || !dropdown) return;

    trigger.onclick = () => {
        dropdown.classList.toggle("show");
    };

    document.addEventListener("click", (e) => {
        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove("show");
        }
    });
});


/** === SET NAMA + PP DI HEADER === **/
document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    // Nama
    document.getElementById("headerName").innerText = `Hai, ${user.full_name}`;

    // PP
    if (user.profile_picture_url) {
        document.getElementById("headerPP").src = user.profile_picture_url;
    }
});


/** === ROUTING === **/
function goDashboard() {
    window.location.href = "dashboard.html";
}

function goProfile() {
    window.location.href = "profile.html";
}

/** === PROFILE DROPDOWN WITH ANIMATION === **/
document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.getElementById("profileTrigger");
    const dropdown = document.getElementById("profileDropdown");

    if (!trigger || !dropdown) return;

    trigger.onclick = () => {
        dropdown.classList.toggle("show");
        trigger.classList.toggle("rotate");  // putar panah
    };

    // klik luar → tutup dropdown
    document.addEventListener("click", (e) => {
        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove("show");
            trigger.classList.remove("rotate");
        }
    });
});
