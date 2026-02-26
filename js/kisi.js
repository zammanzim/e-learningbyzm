// js/kisikisi-manager.js
document.addEventListener('DOMContentLoaded', initKisiKisi);

async function initKisiKisi() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    // 1. Ambil Data Jadwal untuk penentuan warna
    const { data: scheds } = await supabase.from('daily_schedules')
        .select('day_name, lessons').eq('class_id', user.class_id);

    // 2. Ambil Data Kisi-kisi dari tabel baru
    const { data: kisiList } = await supabase.from('kisikisi_pts')
        .select('*').eq('class_id', user.class_id);

    if (!kisiList || !scheds) return;

    // 3. Logic Waktu (Jam 15:00 dianggap hari esok)
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const effectiveIdx = now.getHours() >= 15 ? (now.getDay() + 1) % 7 : now.getDay();

    // Map pelajaran ke index hari
    const lessonDays = {};
    scheds.forEach(s => {
        const dIdx = days.indexOf(s.day_name);
        if (s.lessons && dIdx !== -1) {
            s.lessons.split(/;|,/).forEach(l => {
                lessonDays[normalizeText(l.split('-').pop())] = dIdx;
            });
        }
    });

    // 4. Processing & Sorting
    const processed = kisiList.map(item => {
        const examIdx = lessonDays[normalizeText(item.subject_name)];
        let status = 'upcoming'; // Default: Yellow
        let priority = 2;
        let countdown = '-';

        if (examIdx !== undefined) {
            if (examIdx < effectiveIdx && examIdx !== 0) {
                status = 'passed'; // Green
                priority = 3;
                countdown = 'Selesai';
            } else if (examIdx === effectiveIdx) {
                status = 'deadline'; // Red
                priority = 1;
                countdown = 'HARI INI';
            } else {
                countdown = `H-${examIdx - effectiveIdx}`;
            }
        }
        return { ...item, status, priority, countdown };
    });

    // Sort: Deadline (Merah) selalu paling atas
    processed.sort((a, b) => a.priority - b.priority);

    renderCards(processed, user.role);
}

function renderCards(data, role) {
    const container = document.getElementById('kisiContainer');
    container.innerHTML = "";

    data.forEach(item => {
        const colorClass = item.status === 'deadline' ? 'color-red' :
            (item.status === 'passed' ? 'color-green' : 'color-yellow');

        const card = document.createElement('div');
        card.className = `course-card ${colorClass} animate-pop-in`;

        card.innerHTML = `
            <div class="countdown-tag">${item.countdown}</div>
            <h3>${item.subject_name}</h3>
            <h4 style="opacity:0.8;">${item.title}</h4>
            <div style="margin: 15px 0; font-size: 14px; white-space: pre-wrap;">${item.content}</div>
            <small style="opacity:0.6;">${item.footer || ''}</small>
            ${(role === 'class_admin' || role === 'super_admin') ?
                `<div style="margin-top:10px; text-align:right;">
                    <button onclick="deleteKisi('${item.id}')" class="btn-tool" style="background:rgba(255,0,0,0.2);"><i class="fa-solid fa-trash"></i></button>
                </div>` : ''}
        `;
        container.appendChild(card);
    });

    // Render Tombol Tambah khusus Admin
    if (role === 'class_admin' || role === 'super_admin') {
        const adminBox = document.getElementById('adminControls');
        adminBox.innerHTML = `
            <button class="btn-glass-save" onclick="showAddKisi()" style="width:100%;">
                <i class="fa-solid fa-plus"></i> Tambah Kisi-Kisi
            </button>
        `;
    }
}

function normalizeText(str) {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '').trim() : '';
}

// Fungsi CRUD dasar (Admin)
async function deleteKisi(id) {
    const yakin = await showPopup("Hapus kisi-kisi ini?", "confirm");
    if (yakin) {
        await supabase.from('kisikisi_pts').delete().eq('id', id);
        location.reload();
    }
}

// js/kisikisi-manager.js (Tambahan fitur Admin)

// 1. Fungsi buat nampilin modal tambah
window.showAddKisi = function () {
    const modal = document.getElementById('addModal');
    if (!modal) return;

    // Reset inputan modal
    document.getElementById('addJudul').value = ''; // Mapel
    document.getElementById('addSubjudul').value = ''; // Judul/Bab
    document.getElementById('addIsi').innerHTML = ''; // Konten
    document.getElementById('addSmall').value = getTodayIndo(); // Tanggal Update

    // Sembunyikan bagian yang gak perlu (karena kita ga pake upload foto & warna di tabel baru)
    document.getElementById('dropZone').style.display = 'none';
    document.querySelector('.color-picker-container').style.display = 'none';

    modal.classList.remove('hidden');

    // Ganti fungsi klik tombol simpan modal
    const btnSave = document.getElementById('btnSaveAdd');
    btnSave.onclick = saveNewKisi;
};

// 2. Fungsi buat simpen ke Supabase
async function saveNewKisi() {
    const user = JSON.parse(localStorage.getItem("user"));
    const btnSave = document.getElementById('btnSaveAdd');

    const data = {
        class_id: user.class_id,
        subject_name: document.getElementById('addJudul').value.trim(),
        title: document.getElementById('addSubjudul').value.trim(),
        content: document.getElementById('addIsi').innerHTML,
        footer: document.getElementById('addSmall').value.trim()
    };

    // Validasi dasar
    if (!data.subject_name || !data.title) {
        showPopup("Nama Mapel dan Judul wajib diisi!", "error");
        return;
    }

    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
    btnSave.disabled = true;

    try {
        const { error } = await supabase
            .from('kisikisi_pts')
            .insert([data]);

        if (error) throw error;

        showPopup("Kisi-kisi berhasil ditambah!", "success");
        document.getElementById('addModal').classList.add('hidden');
        initKisiKisi(); // Refresh list tanpa reload halaman
    } catch (err) {
        console.error(err);
        showPopup("Gagal menyimpan data", "error");
    } finally {
        btnSave.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Posting';
        btnSave.disabled = false;
    }
}

// Helper buat dapetin tanggal hari ini
function getTodayIndo() {
    return new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}