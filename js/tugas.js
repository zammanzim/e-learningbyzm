// File: js/tugas.js
document.addEventListener('DOMContentLoaded', initTugas);

let allTasks = [];
let doneIds = [];
let deadlineSubjects = [];
let currentFilter = 'all';

// Fungsi Normalisasi: Hapus spasi & tanda baca (biar "B. Inggris" == "binggris")
function normalize(str) {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

async function initTugas() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) { window.location.href = 'index.html'; return; }

    // Set Profil di Card
    document.getElementById('userTaskName').innerText = user.full_name;
    document.getElementById('userTaskPP').src = user.avatar_url || 'images/default-avatar.png';

    try {
        // 1. Tentukan Hari Target Deadline (Logika jam 15:00)
        const now = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        let targetDayName = days[now.getDay()];

        if (now.getHours() >= 15) {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            targetDayName = days[tomorrow.getDay()];
        }

        // 2. Ambil Jadwal dari Daily Card untuk filter Deadline
        const { data: sched } = await supabase
            .from('daily_schedules')
            .select('lessons')
            .eq('class_id', user.class_id)
            .eq('day_name', targetDayName)
            .single();

        if (sched && sched.lessons) {
            deadlineSubjects = sched.lessons.split(',')
                .map(item => {
                    const parts = item.split('-');
                    const name = parts.length > 1 ? parts[1] : parts[0];
                    return normalize(name.trim()); // Simpan dalam bentuk bersih
                });
        }

        // 3. Ambil Tugas: Urutkan Terbaru di Atas (created_at DESC)
        const { data: tasks, error: err1 } = await supabase
            .from('subject_announcements')
            .select('*')
            .eq('class_id', user.class_id)
            .neq('subject_id', 'announcements')
            .order('created_at', { ascending: false });

        const { data: progress, error: err2 } = await supabase
            .from('user_progress')
            .select('announcement_id')
            .eq('user_id', user.id);

        if (err1 || err2) throw (err1 || err2);

        allTasks = tasks || [];

        // 4. Sinkronisasi Progress (Hapus ID hantu agar hitungan normal)
        const validTaskIds = allTasks.map(t => String(t.id));
        doneIds = (progress || [])
            .map(p => String(p.announcement_id))
            .filter(id => validTaskIds.includes(id));

        updateProgressUI();
        applyCurrentFilter(); // Render pertama kali sesuai filter
    } catch (e) {
        console.error("Load tugas gagal:", e);
    }
}

function updateProgressUI() {
    const total = allTasks.length;
    const done = doneIds.length;
    const countEl = document.getElementById('userTaskCount');
    const barEl = document.getElementById('userTaskBar');
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    let grad = '', themeColor = '';
    if (percent === 100) { grad = 'linear-gradient(90deg, #00eaff, #007bff)'; themeColor = '#00eaff'; }
    else if (percent >= 70) { grad = 'linear-gradient(90deg, #0be881, #05c46b)'; themeColor = '#0be881'; }
    else if (percent >= 30) { grad = 'linear-gradient(90deg, #ff8c00, #ffd700)'; themeColor = '#ff8c00'; }
    else { grad = 'linear-gradient(90deg, #ff4757, #ff6b81)'; themeColor = '#ff4757'; }

    if (countEl) {
        countEl.innerText = `${done}/${total} (${percent}%)`;
        countEl.style.color = themeColor;
    }
    if (barEl) {
        barEl.style.width = percent + "%";
        barEl.style.background = grad;
    }
}

function renderTasks(data) {
    const container = document.getElementById('taskList');
    if (!container) return;
    container.innerHTML = "";
    const total = allTasks.length;

    data.forEach((item) => {
        const isDone = doneIds.includes(String(item.id));
        const isDeadline = !isDone && deadlineSubjects.some(s =>
            normalize(item.subject_id).includes(s) ||
            normalize(item.big_title).includes(s)
        );

        const autoNumber = total - allTasks.indexOf(item);
        let statusClass = isDone ? 'task-green-done' : (isDeadline ? 'task-red-deadline' : 'task-yellow-pending');

        // Logic Parsing Foto Identik Subject Manager
        let photos = [];
        if (item.photo_url) {
            if (Array.isArray(item.photo_url)) photos = item.photo_url;
            else if (typeof item.photo_url === 'string') {
                try {
                    if (item.photo_url.startsWith('[')) photos = JSON.parse(item.photo_url);
                    else photos = [item.photo_url];
                } catch (e) { photos = [item.photo_url]; }
            }
        }

        let photoHTML = '';
        if (photos.length > 0) {
            let gridClass = `grid-${Math.min(photos.length, 4)}`;
            let imgsHTML = photos.slice(0, 4).map((url, i) => {
                const isLast = i === 3 && photos.length > 4;
                return `
                    <div class="photo-item photo-wrapper">
                        <img src="${url}">
                        ${isLast ? `<div class="more-overlay">+${photos.length - 4}</div>` : ''}
                    </div>`;
            }).join('');
            photoHTML = `<div class="photo-grid ${gridClass}">${imgsHTML}</div>`;
        }

        const el = document.createElement('div');
        el.className = `course-card ${statusClass}`;
        el.dataset.id = item.id;

        // BLOKIR KLIK: openDetail hanya dipasang jika ada foto
        if (photos.length > 0) {
            el.classList.add('clickable-card');
            el.onclick = () => openDetail(item);
        } else {
            el.style.cursor = 'default';
        }

        el.innerHTML = `
    ${photoHTML}
    <h3 style="margin:5px 0; font-size: 20px;">${item.big_title}</h3>
    <h4 style="color:rgba(255,255,255,0.7); font-size:13px; font-weight: normal; margin-bottom:12px;">#${autoNumber} - ${item.title}</h4>
    <p style="font-size:14px; color:#ddd; margin-bottom:15px; line-height:1.5; white-space: pre-wrap;">${item.content}</p>
    ${item.small ? `<small style="display:block; color:#aaa; font-size:11px; margin-bottom:15px;">${item.small}</small>` : ''}
    <div style="display:flex; justify-content:flex-end;">
        <button class="task-btn ${isDone ? 'done' : ''}" onclick="toggleStatus(event, '${item.id}', this)">
            ${isDone ? '<i class="fa-solid fa-circle-check"></i> Selesai' : '<i class="fa-regular fa-circle"></i> Selesai?'}
        </button>
    </div>
`;
        container.appendChild(el);
    });
}

async function toggleStatus(e, id, btn) {
    e.stopPropagation();
    const user = JSON.parse(localStorage.getItem("user"));
    const isDone = btn.classList.contains('done');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        if (isDone) {
            await supabase.from('user_progress').delete().eq('user_id', user.id).eq('announcement_id', id);
            doneIds = doneIds.filter(d => d !== id);
        } else {
            await supabase.from('user_progress').insert({ user_id: user.id, announcement_id: id });
            doneIds.push(id);
        }
        updateProgressUI();
        applyCurrentFilter(); // Mencegah reset ke "Semua" saat toggle
    } catch (err) {
        console.error(err);
        applyCurrentFilter();
    }
}

function applyCurrentFilter() {
    if (currentFilter === 'pending') {
        const filtered = allTasks.filter(t => !doneIds.includes(String(t.id)));

        // Urutkan: Deadline (merah) dulu, baru Pending (kuning)
        filtered.sort((a, b) => {
            const aIsDeadline = deadlineSubjects.some(s =>
                normalize(a.subject_id).includes(s) || normalize(a.big_title).includes(s)
            );
            const bIsDeadline = deadlineSubjects.some(s =>
                normalize(b.subject_id).includes(s) || normalize(b.big_title).includes(s)
            );

            if (aIsDeadline && !bIsDeadline) return -1; // a naik
            if (!aIsDeadline && bIsDeadline) return 1;  // b naik
            return 0; // Tetap urut terbaru (created_at DESC)
        });

        renderTasks(filtered);
    } else {
        renderTasks(allTasks);
    }
}

function filterTasks(type, btn) {
    currentFilter = type;
    const wrapper = document.getElementById('taskFilters');
    const buttons = document.querySelectorAll('.filter-btn-new');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (type === 'pending') wrapper.classList.add('pending-active');
    else wrapper.classList.remove('pending-active');

    applyCurrentFilter();
}