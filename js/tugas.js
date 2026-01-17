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

        // Match deadline dengan normalisasi string
        const isDeadline = !isDone && deadlineSubjects.some(s =>
            normalize(item.subject_id).includes(s) ||
            normalize(item.big_title).includes(s)
        );

        const autoNumber = total - allTasks.indexOf(item);
        let statusClass = isDone ? 'task-green-done' : (isDeadline ? 'task-red-deadline' : 'task-yellow-pending');

        // Foto Grid (Lessons Style)
        let photoHTML = '';
        if (item.photos && item.photos.length > 0) {
            const count = item.photos.length;
            const gridClass = count >= 4 ? 'grid-4' : (count === 3 ? 'grid-3' : (count === 2 ? 'grid-2' : 'grid-1'));
            let photoItems = '';
            item.photos.slice(0, 4).forEach((url, i) => {
                const isLast = i === 3 && count > 4;
                photoItems += `
                    <div class="photo-wrapper" onclick="event.stopPropagation(); window.openLightbox && window.openLightbox('${url}', ${JSON.stringify(item.photos)})">
                        <img src="${url}" class="photo-item">
                        ${isLast ? `<div class="more-overlay">+${count - 4}</div>` : ''}
                    </div>`;
            });
            photoHTML = `<div class="photo-grid ${gridClass}">${photoItems}</div>`;
        }

        const el = document.createElement('div');
        el.className = `course-card clickable-card ${statusClass}`;

        el.innerHTML = `
            ${photoHTML}
                <h3 style="margin:5px 0; font-size: 20px;">${item.big_title}</h3>
                <h4 style="color:rgba(255,255,255,0.7); font-size:13px; font-weight: normal; margin-bottom:12px;">#${autoNumber} - ${item.title}</h4>
                <p style="font-size:14px; color:#ddd; margin-bottom:15px; line-height:1.5;">${truncateText(item.content || '', 120)}</p>
                ${item.small ? `<small style="display:block; color:#aaa; font-size:11px; margin-bottom:15px;">${item.small}</small>` : ''}
                <div style="display:flex; justify-content:flex-end;">
                    <button class="task-btn ${isDone ? 'done' : ''}" onclick="toggleStatus(event, '${item.id}', this)">
                        ${isDone ? '<i class="fa-solid fa-circle-check"></i> Selesai' : '<i class="fa-regular fa-circle"></i> Selesai?'}
                    </button>
                </div>
        `;
        el.onclick = () => openDetail(item);
        container.appendChild(el);
    });
}

function truncateText(text, limit) {
    if (text.length <= limit) return text;
    return text.substring(0, limit) + "...";
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

function openDetail(data) {
    const overlay = document.getElementById('detailOverlay');
    document.getElementById('detailBigTxt').innerText = data.big_title;
    document.getElementById('detailTitleTxt').innerText = data.title;
    document.getElementById('detailContentTxt').innerText = data.content;
    document.getElementById('detailSmallTxt').innerText = data.small || '';
    overlay.classList.add('active');
}

function closeDetail() { document.getElementById('detailOverlay').classList.remove('active'); }