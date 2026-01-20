document.addEventListener('DOMContentLoaded', initSearchPage);

let searchTimer; // Untuk handle jeda (debounce)

async function initSearchPage() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) { window.location.href = 'index'; return; }

    // Sync Header Profil
    const headerName = document.getElementById('headerName');
    const headerPP = document.getElementById('headerPP');
    if (headerName) headerName.innerText = `Hai, ${user.full_name.split(' ')[0]}`;
    if (headerPP) headerPP.src = user.avatar_url || 'images/default-avatar.png';

    // Munculkan semua akun pas pertama buka
    searchUser();

    // LIVE SEARCH DENGAN JEDA 1.5 DETIK
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer); // Hapus timer sebelumnya tiap kali jari masih ngetik

            // Set timer baru: nunggu 1500ms (1.5 detik) diem baru eksekusi cari
            searchTimer = setTimeout(() => {
                searchUser();
            }, 200);
        });

        // Kalau pencet Enter, langsung cari tanpa nunggu jeda
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                searchUser();
            }
        });
    }
}

async function searchUser() {
    // Ambil data user login dari localStorage
    const user = JSON.parse(localStorage.getItem("user")); 
    const query = document.getElementById('searchInput').value.trim();
    const container = document.getElementById('userResultList');
    
    try {
        // [UPDATE SELECT]: Join ke tabel 'classes' untuk ambil kolom 'name'
        // Format 'classes(name)' artinya ambil kolom 'name' dari tabel 'classes'
        let q = supabase.from('users')
            .select('id, full_name, short_name, username, avatar_url, class_id, classes(name)');

        if (query !== "") {
            q = q.or(`full_name.ilike.%${query}%,username.ilike.%${query}%`);
        }

        const { data, error } = await q.limit(100); 
        if (error) throw error;

        // --- LOGIKA SORTIR DINAMIS ---
        const myClassId = user.class_id; // Gunakan ID kelas user login
        
        data.sort((a, b) => {
            // 1. Cek apakah ini kelas yang sama dengan user login
            const aIsMine = a.class_id === myClassId;
            const bIsMine = b.class_id === myClassId;

            if (aIsMine && !bIsMine) return -1; // Kelas lu naik ke paling atas
            if (!aIsMine && bIsMine) return 1;

            // 2. Jika bukan kelas lu, urutkan berdasarkan Nama Kelas (X-RPL 1, dll)
            // Hasil join classes(name) biasanya berupa object: { name: "X-RPL 1" }
            const aClassName = a.classes?.name || 'Umum';
            const bClassName = b.classes?.name || 'Umum';

            if (aClassName !== bClassName) {
                return aClassName.localeCompare(bClassName);
            }

            // 3. Terakhir urutkan berdasarkan Nama Siswa A-Z
            return a.full_name.localeCompare(b.full_name);
        });

        // --- RENDER DENGAN PEMBATAS ---
        container.innerHTML = "";
        if (data.length === 0) {
            container.innerHTML = `<p style="text-align: center; padding: 20px; color: #aaa;">Akun tidak ditemukan.</p>`;
            return;
        }

        let lastClass = null;
        data.forEach(u => {
            // Ambil nama kelas dari hasil join
            const currentClassName = String(u.classes?.name || 'UMUM');

            // Tambah Pembatas jika ganti kelas
            if (currentClassName !== lastClass) {
                const divider = document.createElement('div');
                divider.className = "class-divider animate-fade-in";
                divider.innerHTML = `<span>${currentClassName.toUpperCase()}</span>`;
                container.appendChild(divider);
                lastClass = currentClassName;
            }

            const card = document.createElement('div');
            card.className = "course-card animate-pop-in";
            card.style.display = "flex"; card.style.alignItems = "center";
            card.style.gap = "15px"; card.style.marginBottom = "12px"; card.style.padding = "15px";
            
            card.innerHTML = `
                <img src="${u.avatar_url || 'images/default-avatar.png'}" 
                     style="width: 55px; height: 55px; border-radius: 50%; border: 2px solid #00eaff; object-fit: cover;">
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 16px; color: #fff;">
                        ${u.full_name} ${String(u.id) === String(user.id) ? '(Anda)' : ''}
                    </h3>
                    <p style="margin: 2px 0; font-size: 12px; color: #00eaff;">@${u.username || u.short_name}</p>
                </div>
                <button class="btn-tool" onclick="viewPublicProfile('${u.id}')" style="border-radius: 50%; width: 40px; height: 40px; border: 1px solid rgba(0,234,255,0.3);">
                    <i class="fa-solid fa-chevron-right" style="margin:0;"></i>
                </button>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Gagal cari akun:", err);
    }
}

function viewPublicProfile(id) {
    showPopup("Profil teman segera hadir!", "info");
}