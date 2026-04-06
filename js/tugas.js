// File: js/tugas.js
document.addEventListener('DOMContentLoaded', initTugas);

let allTasks = [];
let doneIds = [];
let deadlineSubjects = [];
let currentFilter = 'pending';
let _isAdminUser = false;

// ==========================================
// CACHE HELPERS
// ==========================================
const TUGAS_CACHE_TTL_TASKS = 5 * 60 * 1000; // 5 menit — list tugas
const TUGAS_CACHE_TTL_DONE = 2 * 60 * 1000; // 2 menit — progress user
const TUGAS_CACHE_TTL_SCHED = 30 * 60 * 1000; // 30 menit — jadwal deadline
const TUGAS_CACHE_TTL_RANK = 2 * 60 * 1000; // 2 menit — rank

function _tugasCacheGet(key, ttl) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > ttl) return null; // expired
        return data;
    } catch (e) { return null; }
}

function _tugasCacheSet(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) { /* storage penuh, skip */ }
}

function _tugasCacheInvalidate(userId, classId) {
    try {
        if (userId) localStorage.removeItem(`tugas_done_${userId}`);
        if (userId) localStorage.removeItem(`tugas_rank_${userId}`);
        if (classId) localStorage.removeItem(`tugas_tasks_${classId}`);
    } catch (e) { }
}

// Fungsi Normalisasi: Hapus spasi & tanda baca (biar "B. Inggris" == "binggris")
function normalize(str) {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

async function initTugas() {
    let user;
    try {
        user = JSON.parse(localStorage.getItem("user"));
    } catch (e) { user = null; }
    if (!user) { window.location.href = 'index'; return; }

    // Set flag admin untuk renderTasks
    _isAdminUser = (user.role === 'class_admin' || user.role === 'super_admin');

    // Set Profil di Card
    document.getElementById('userTaskName').innerText = user.nickname;
    document.getElementById('userTaskPP').src = user.avatar_url || '../icons/profpicture.png';

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

        const classId = getEffectiveClassId();
        const schedCacheKey = `tugas_sched_${classId}_${targetDayName}`;
        const tasksCacheKey = `tugas_tasks_${classId}`;
        const doneCacheKey = `tugas_done_${user.id}`;
        const rankCacheKey = `tugas_rank_${user.id}`;

        // ── 2. JADWAL DEADLINE (cache 30 menit) ──────────────────────
        const cachedSched = _tugasCacheGet(schedCacheKey, TUGAS_CACHE_TTL_SCHED);
        if (cachedSched !== null) {
            deadlineSubjects = cachedSched;
            // Refresh di background
            supabase.from('daily_schedules').select('lessons')
                .eq('class_id', classId).eq('day_name', targetDayName).single()
                .then(({ data }) => {
                    if (data?.lessons) {
                        const fresh = _parseDeadlineSubjects(data.lessons);
                        _tugasCacheSet(schedCacheKey, fresh);
                    }
                }).catch(() => { });
        } else {
            const { data: sched } = await supabase
                .from('daily_schedules').select('lessons')
                .eq('class_id', classId).eq('day_name', targetDayName).single();
            if (sched?.lessons) {
                deadlineSubjects = _parseDeadlineSubjects(sched.lessons);
                _tugasCacheSet(schedCacheKey, deadlineSubjects);
            }
        }

        // ── 3. TASKS + DONE — coba dari cache dulu, render langsung ──
        const cachedTasks = _tugasCacheGet(tasksCacheKey, TUGAS_CACHE_TTL_TASKS);
        const cachedDone = _tugasCacheGet(doneCacheKey, TUGAS_CACHE_TTL_DONE);

        if (cachedTasks !== null && cachedDone !== null) {
            // Tampilkan cache LANGSUNG biar kelihatan cepat
            allTasks = cachedTasks;
            const validIds = allTasks.map(t => String(t.id));
            doneIds = cachedDone.filter(id => validIds.includes(id));

            // Coba pakai rank dari cache juga
            const cachedRank = _tugasCacheGet(rankCacheKey, TUGAS_CACHE_TTL_RANK);
            window._taskRankPercent = cachedRank ?? 0;

            updateProgressUI();
            applyCurrentFilter();

            // Fetch fresh di background (stale-while-revalidate)
            _fetchTugasFresh({ user, classId, tasksCacheKey, doneCacheKey, rankCacheKey });
        } else {
            // Tidak ada cache — fetch langsung (first load / expired)
            await _fetchTugasFresh({ user, classId, tasksCacheKey, doneCacheKey, rankCacheKey, render: true });
        }
    } catch (e) {
        console.error("Load tugas gagal:", e);
    }
}

// ── Helper: parse lessons string → deadlineSubjects array ────────
function _parseDeadlineSubjects(lessons) {
    return lessons.split(',')
        .map(item => {
            const trimmed = item.trim();
            const name = trimmed.replace(/^\d+[-_]\s*/, '');
            return normalize(name.trim());
        })
        .filter(s => s.length > 0);
}

// ── Helper: fetch fresh dari DB, update cache & UI ───────────────
async function _fetchTugasFresh({ user, classId, tasksCacheKey, doneCacheKey, rankCacheKey, render = false }) {
    try {
        const [{ data: tasks, error: err1 }, { data: progress, error: err2 }] = await Promise.all([
            supabase.from('subject_announcements')
                .select('*')
                .eq('class_id', classId)
                .neq('subject_id', 'announcements')
                .neq('subject_id', 'kisi-kisi')
                .neq('subject_id', 'akuhutajakus')
                .order('created_at', { ascending: false }),
            supabase.from('user_progress')
                .select('announcement_id')
                .eq('user_id', user.id)
        ]);

        if (err1 || err2) throw (err1 || err2);

        const freshTasks = tasks || [];
        const validIds = freshTasks.map(t => String(t.id));
        const freshDone = (progress || [])
            .map(p => String(p.announcement_id))
            .filter(id => validIds.includes(id));

        // Simpan ke cache
        _tugasCacheSet(tasksCacheKey, freshTasks);
        _tugasCacheSet(doneCacheKey, freshDone);

        // Update global state
        allTasks = freshTasks;
        doneIds = freshDone;

        // Rank
        if (validIds.length > 0) {
            const { data: rankData } = await supabase.rpc('get_task_rank', {
                p_user_id: String(user.id),
                p_task_ids: validIds
            });
            const rank = rankData ?? 0;
            window._taskRankPercent = rank;
            _tugasCacheSet(rankCacheKey, rank);
        } else {
            window._taskRankPercent = 0;
            _tugasCacheSet(rankCacheKey, 0);
        }

        // Kalau render = false (background refresh), cukup update UI kalau ada perubahan
        updateProgressUI();
        applyCurrentFilter();
    } catch (e) {
        if (render) console.error("Fetch tugas gagal:", e);
        // Kalau background fetch gagal, diam saja (sudah ada cache di layar)
    }
}

function updateProgressUI() {
    const total = allTasks.length;
    const done = doneIds.length;
    const countEl = document.getElementById('userTaskCount');
    const barEl = document.getElementById('userTaskBar');
    const centerEl = document.getElementById('taskProgressCenter');
    const motivEl = document.getElementById('taskMotivation');
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    let grad = '', themeColor = '';
    if (percent === 100) { grad = 'linear-gradient(90deg, var(--accent, #00eaff), #007bff)'; themeColor = 'var(--accent, #00eaff)'; }
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

    // 1. Teks di tengah progress bar
    if (centerEl) {
        centerEl.innerText = `kamu sudah ngejain ${done} dari ${total} tugas`;
    }

    // 2. Logika Motivasi
    if (motivEl) {
        let msg = "";
        if (percent === 100) {
            msg = "dak rajin";
        } else if (percent > 50) {
            msg = "kejaken kabeh kagok";
        } else {
            msg = "kejaken tugas na, mun ngarasa entos pencet selesai";
        }
        motivEl.innerText = msg;
        motivEl.style.color = themeColor;
    }

    // 3. Player rank box
    const rankTextEl = document.getElementById('playerRankText');
    const rankEmojiEl = document.getElementById('playerRankEmoji');
    if (rankTextEl) {
        const rankPct = (typeof window._taskRankPercent !== 'undefined') ? window._taskRankPercent : null;
        let emoji = '', rankMsg = '';

        if (total === 0) {
            emoji = '📭';
            rankMsg = 'belum ada tugas nih';
        } else if (rankPct === null) {
            emoji = '⏳';
            rankMsg = 'menghitung ranking...';
        } else if (rankPct === 100 || percent === 100) {
            emoji = '🏆';
            rankMsg = 'tugas kamu selesai <span style="color:#00eaff; font-size:16px;">99%</span> lebih tinggi daripada orang lain';
        } else if (rankPct >= 70) {
            emoji = '🔥';
            rankMsg = `tugas kamu selesai <span style="color:#0be881; font-size:16px;">${rankPct}%</span> lebih tinggi daripada orang lain`;
        } else if (rankPct >= 30) {
            emoji = '⚡';
            rankMsg = `tugas kamu selesai <span style="color:#ff8c00; font-size:16px;">${rankPct}%</span> lebih tinggi daripada orang lain`;
        } else if (rankPct > 0) {
            emoji = '😴';
            rankMsg = `tugas kamu selesai <span style="color:#ff4757; font-size:16px;">${rankPct}%</span> lebih tinggi daripada orang lain`;
        } else {
            emoji = '💀';
            rankMsg = 'tugas kamu selesai <span style="color:#ff4757; font-size:16px;">0%</span> lebih tinggi daripada orang lain';
        }
        if (rankEmojiEl) rankEmojiEl.innerText = emoji;
        rankTextEl.innerHTML = rankMsg;
    }
}

function renderTasks(data) {
    const container = document.getElementById('taskList');
    if (!container) return;
    const total = allTasks.length;

    const fragment = document.createDocumentFragment();

    data.forEach((item) => {
        const isDone = doneIds.includes(String(item.id));
        const isDeadline = !isDone && deadlineSubjects.some(s => {
            const normSubject = normalize(item.subject_id);
            const normTitle = normalize(item.big_title);
            // Cek dua arah: subject mengandung jadwal ATAU jadwal mengandung subject
            return normSubject.includes(s) || s.includes(normSubject) ||
                normTitle.includes(s) || s.includes(normTitle);
        });

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
                        <img src="${url}" loading="lazy">
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
    <div style="display:flex; justify-content:space-between; align-items:center;">
        ${_isAdminUser ? `
        <button class="task-btn-delete" onclick="deleteTugas(event, '${item.id}')" title="Hapus tugas ini">
            <i class="fa-solid fa-trash"></i>
        </button>` : '<span></span>'}
        <button class="task-btn ${isDone ? 'done' : ''}" onclick="toggleStatus(event, '${item.id}', this)">
            ${isDone ? '<i class="fa-solid fa-circle-check"></i> Selesai' : '<i class="fa-regular fa-circle"></i> Selesai?'}
        </button>
    </div>
`;
        fragment.appendChild(el);
    });

    container.replaceChildren(fragment);
}

async function toggleStatus(e, id, btn) {
    e.stopPropagation();
    let user;
    try {
        user = JSON.parse(localStorage.getItem("user"));
    } catch (err) { return; }
    if (!user) return;

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

        // Invalidate cache done & rank biar next load fresh
        const classId = getEffectiveClassId();
        _tugasCacheInvalidate(user.id, null); // tasks cache tetap valid, cukup done+rank
        sessionStorage.removeItem(`task_badge_${user.id}`);
        if (typeof updateTaskBadge === 'function') updateTaskBadge(user);

        // Update ranking via RPC
        const validTaskIds = allTasks.map(t => String(t.id));
        if (validTaskIds.length > 0) {
            const { data: rankData } = await supabase.rpc('get_task_rank', {
                p_user_id: String(user.id),
                p_task_ids: validTaskIds
            });
            window._taskRankPercent = rankData ?? 0;
        }

        updateProgressUI();
        applyCurrentFilter();
    } catch (err) {
        console.error(err);
        applyCurrentFilter();
    }
}

async function deleteTugas(e, id) {
    e.stopPropagation();

    const yakin = await showPopup('Yakin mau hapus tugas ini? <br><small style="opacity:0.6">Data akan terhapus permanen.</small>', 'confirm');
    if (!yakin) return;

    try {
        // Hapus progress user yang terkait dulu
        await supabase.from('user_progress').delete().eq('announcement_id', id);

        // Hapus tugas dari subject_announcements
        const { error } = await supabase.from('subject_announcements').delete().eq('id', id);
        if (error) throw error;

        // Update state lokal langsung (tanpa reload)
        allTasks = allTasks.filter(t => String(t.id) !== String(id));
        doneIds = doneIds.filter(d => d !== String(id));

        // Invalidate cache
        const classId = getEffectiveClassId();
        const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; } })();
        _tugasCacheInvalidate(user?.id, classId);

        updateProgressUI();
        applyCurrentFilter();

        if (typeof showToast === 'function') showToast('Tugas berhasil dihapus', 'success');
    } catch (err) {
        console.error('Hapus tugas gagal:', err);
        showPopup('Gagal menghapus: ' + err.message, 'error');
    }
}

function applyCurrentFilter() {
    if (currentFilter === 'pending') {
        const filtered = allTasks.filter(t => !doneIds.includes(String(t.id)));

        // Urutkan: Deadline (merah) dulu, baru Pending (kuning)
        filtered.sort((a, b) => {
            const aIsDeadline = deadlineSubjects.some(s => {
                const normSubject = normalize(a.subject_id);
                const normTitle = normalize(a.big_title);
                return normSubject.includes(s) || s.includes(normSubject) ||
                    normTitle.includes(s) || s.includes(normTitle);
            });
            const bIsDeadline = deadlineSubjects.some(s => {
                const normSubject = normalize(b.subject_id);
                const normTitle = normalize(b.big_title);
                return normSubject.includes(s) || s.includes(normSubject) ||
                    normTitle.includes(s) || s.includes(normTitle);
            });

            if (aIsDeadline && !bIsDeadline) return -1;
            if (!aIsDeadline && bIsDeadline) return 1;
            return 0;
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

    if (type === 'all') wrapper.classList.add('all-active');
    else wrapper.classList.remove('all-active');

    applyCurrentFilter();
}

// ── SHORTCUTS ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
        const pickerOpen = !document.getElementById('tugasPickerOverlay')?.classList.contains('hidden');
        const formOpen = !document.getElementById('tugasFormOverlay')?.classList.contains('hidden');
        const fab = document.getElementById('tugasFabWrap');

        if (!pickerOpen && !formOpen && fab && fab.style.display !== 'none') {
            e.preventDefault();
            if (typeof openTugasModal === 'function') openTugasModal();
        }
    }
});

// ── CLICK OUTSIDE TO CLOSE ────────────────────────────────────────
document.addEventListener('click', e => {
    const picker = document.getElementById('tugasPickerOverlay');
    if (picker && !picker.classList.contains('hidden')) {
        if (e.target === picker) {
            picker.classList.add('hidden');
            if (typeof unlockScroll === 'function') unlockScroll();
        }
    }

    const form = document.getElementById('tugasFormOverlay');
    if (form && !form.classList.contains('hidden')) {
        if (e.target === form) {
            form.classList.add('hidden');
            if (typeof unlockScroll === 'function') unlockScroll();
        }
    }
});