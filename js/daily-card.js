// --- GLOBAL VARIABLES ---
window.dailyDrafts = {};
window.isDailyEditing = false;
window.editingDay = null;
window.currentViewDay = null;

// ==========================================
// SKELETON LOADER
// ==========================================
(function injectSkeletonStyles() {
    if (document.getElementById('dc-skeleton-style')) return;
    const style = document.createElement('style');
    style.id = 'dc-skeleton-style';
    style.textContent = `
        .dc-skel {
            background: linear-gradient(90deg,
                rgba(255,255,255,0.05) 25%,
                rgba(255,255,255,0.12) 50%,
                rgba(255,255,255,0.05) 75%);
            background-size: 200% 100%;
            animation: dc-shimmer 1.4s infinite;
            border-radius: 8px;
        }
        @keyframes dc-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        .dc-skel-cards {
            display: flex;
            flex-direction: column;
            gap: 0;
            border-radius: 0.6rem;
            overflow: hidden;
            margin-bottom: 1.4rem;
        }
        .dc-skel-card {
            height: 54px;
            border-radius: 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .dc-skel-card:last-child {
            border-bottom: none;
        }
        .dc-skel-section-title {
            height: 14px;
            width: 140px;
            margin-bottom: 12px;
        }
        .dc-skel-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        .dc-skel-time  { height: 12px; width: 52px; flex-shrink: 0; }
        .dc-skel-dot   { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .dc-skel-subj  { height: 12px; flex: 1; }
        .dc-skel-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .dc-skel-pill  { height: 30px; width: 80px; border-radius: 20px; }
        .dc-skel-header-badge { height: 18px; width: 70px; border-radius: 6px; margin-bottom: 8px; }
        .dc-skel-header-day   { height: 26px; width: 120px; border-radius: 8px; margin-bottom: 6px; }
        .dc-skel-header-date  { height: 13px; width: 160px; border-radius: 6px; }
    `;
    document.head.appendChild(style);
})();

function _buildDailyCardSkeleton() {
    const rows = [1, 2, 3, 4, 5].map(() => `
        <div class="dc-skel-row">
            <div class="dc-skel dc-skel-time"></div>
            <div class="dc-skel dc-skel-dot"></div>
            <div class="dc-skel dc-skel-subj" style="width:${50 + Math.floor(Math.random() * 35)}%"></div>
        </div>`).join('');

    return `
        <div class="dc-skel-cards">
            <div class="dc-skel dc-skel-card"></div>
            <div class="dc-skel dc-skel-card"></div>
            <div class="dc-skel dc-skel-card"></div>
        </div>
        <div class="final-spacer"></div>
        <div class="final-section">
            <div class="dc-skel dc-skel-section-title"></div>
            ${rows}
        </div>
        <div class="final-spacer"></div>
        <div class="final-section">
            <div class="dc-skel dc-skel-section-title" style="width:110px; margin-bottom:12px;"></div>
            <div class="dc-skel-pills">
                <div class="dc-skel dc-skel-pill"></div>
                <div class="dc-skel dc-skel-pill" style="width:65px;"></div>
                <div class="dc-skel dc-skel-pill" style="width:90px;"></div>
            </div>
        </div>
    `;
}

function _buildHeaderSkeleton() {
    return `
        <div>
            <div class="dc-skel dc-skel-header-badge"></div>
            <div class="dc-skel dc-skel-header-day"></div>
            <div class="dc-skel dc-skel-header-date"></div>
        </div>
        <div class="header-right-group">
            <div class="task-shortcut-box" style="opacity:0.4; pointer-events:none;">
                <div class="task-badge" style="display:none;">0</div>
                <i class="fa-solid fa-clipboard-list"></i>
                <span>TUGAS</span>
            </div>
        </div>`;
}


// Helper aman baca user dari localStorage
function _getDailyUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch (e) {
        return null;
    }
}

// ==========================================
// CACHE HELPERS
// ==========================================
const DAILY_CACHE_TTL = 30 * 60 * 1000; // 30 menit

function _dcCacheGet(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > DAILY_CACHE_TTL) return null; // expired
        return data;
    } catch (e) { return null; }
}

function _dcCacheSet(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) { /* storage penuh, skip */ }
}

function _dcCacheInvalidate(classId) {
    try {
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'CUSTOM'];
        days.forEach(d => localStorage.removeItem(`dc_sched_${classId}_${d}`));
        localStorage.removeItem(`dc_config_${classId}`);
    } catch (e) { }
}

async function initDailyCard() {
    const container = document.querySelector('.left-section');
    if (!container) return;

    const user = _getDailyUser();
    if (!user || !user.class_id) return;
    const CLASS_ID = getEffectiveClassId() || user.class_id;

    // --- 1. RENDER KERANGKA ---
    const cardId = 'dailyInfoCard';
    let cardEl = document.getElementById(cardId);
    const isAdmin = user.role === 'class_admin' || user.role === 'super_admin';

    let editActionHTML = '';
    if (isAdmin) {
        if (window.isDailyEditing) {
            editActionHTML = `
                <div class="card-edit-actions">
                    <button class="action-btn save" onclick="saveAllDrafts()" title="Simpan"><i class="fa-solid fa-check"></i></button>
                    <button class="action-btn cancel" onclick="toggleDailyEditMode()" title="Batal"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
        } else {
            editActionHTML = `
                <button class="action-btn edit" onclick="toggleDailyEditMode()" title="Edit Jadwal">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>`;
        }
    }

    if (!cardEl) {
        const cardHTML = `
            <div id="${cardId}" class="daily-card-final glass-card-effect">
                <div class="final-header animate-pop-in" id="dcHeader"></div>

                <div id="dcContentFinal" class="final-content">
                    ${_buildDailyCardSkeleton()}
                </div>

                <div id="dailyConfigPanel" class="config-panel">
                    <h4 style="margin-bottom:10px; font-size:12px; color:#aaa; text-transform:uppercase;">Admin: ${CLASS_ID}</h4>

                    <div class="dc-toggle-area" style="margin-bottom:10px; border-color:#ff4757;">
                        <span style="font-size:13px; color:#ff6b81; font-weight:bold;"><i class="fa-solid fa-star"></i> Custom Event Mode</span>
                        <label class="switch">
                            <input type="checkbox" id="editCustomToggle">
                            <span class="slider round" style="background-color:#555;"></span>
                        </label>
                    </div>

                    <div id="normalConfigArea">
                        <div style="margin-bottom:15px;">
                            <label style="font-size:12px; display:block; margin-bottom:5px;">Edit Hari Apa?</label>
                            <select id="editDaySelector" class="glass-input">
                                <option value="Senin">Senin</option>
                                <option value="Selasa">Selasa</option>
                                <option value="Rabu">Rabu</option>
                                <option value="Kamis">Kamis</option>
                                <option value="Jumat">Jumat</option>
                                <option value="Sabtu">Sabtu</option>
                                <option value="Minggu">Minggu</option>
                            </select>
                        </div>

                        <div class="dc-toggle-area" style="margin-top:0;">
                            <span style="font-size:13px;">Auto Update (Jam 15:00)</span>
                            <label class="switch">
                                <input type="checkbox" id="editAutoToggle">
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="final-watermark">v10 self update schedule</div>
            </div>
        `;
        const welcome = document.getElementById('welcomeText');
        if (welcome) welcome.insertAdjacentHTML('afterend', cardHTML);
        else container.innerHTML += cardHTML;
        cardEl = document.getElementById(cardId);
    }

    const headerEl = document.getElementById('dcHeader');
    headerEl.innerHTML = _buildHeaderSkeleton();

    // Kalau card sudah ada (re-render), tampilkan skeleton sementara data diambil
    const contentEl2 = document.getElementById('dcContentFinal');
    if (contentEl2 && !window.isDailyEditing) {
        contentEl2.innerHTML = _buildDailyCardSkeleton();
    }

    // --- 2. LOGIC DATA ---
    try {
        if (!window.currentConfig) {
            const configCacheKey = `dc_config_${CLASS_ID}`;
            const cachedConfig = _dcCacheGet(configCacheKey);

            if (cachedConfig) {
                // Pakai cache dulu, fetch di background buat update
                window.currentConfig = cachedConfig;
                supabase.from('daily_config').select('*').eq('class_id', CLASS_ID).single()
                    .then(({ data }) => {
                        if (data) {
                            _dcCacheSet(configCacheKey, data);
                            window.currentConfig = data;
                        }
                    }).catch(() => { });
            } else {
                let { data: config } = await supabase.from('daily_config').select('*').eq('class_id', CLASS_ID).single();
                if (!config) {
                    config = { class_id: CLASS_ID, is_auto: true, is_custom: false, forced_day: 'Senin' };
                    await supabase.from('daily_config').insert(config);
                }
                _dcCacheSet(configCacheKey, config);
                window.currentConfig = config;
            }
        }

        const config = window.currentConfig;
        const now = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        let autoDay = days[now.getDay()];
        if (now.getHours() >= 15) {
            const besok = new Date(now);
            besok.setDate(now.getDate() + 1);
            autoDay = days[besok.getDay()];
        }

        let displayDay = 'Senin';
        let labelWaktu = 'HARI INI';
        let fullDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        if (window.editingDay) {
            displayDay = window.editingDay;
            labelWaktu = (displayDay === 'CUSTOM') ? 'EDIT CUSTOM' : 'DRAFT MODE';
        } else if (config.is_custom) {
            displayDay = 'CUSTOM';
            labelWaktu = 'SPECIAL EVENT';
            fullDate = 'Jadwal Khusus';
        } else if (config.is_auto) {
            displayDay = autoDay;
            if (now.getHours() >= 15) labelWaktu = 'BESOK';
        } else {
            displayDay = config.forced_day;
            labelWaktu = 'MANUAL';
            fullDate = '-';
        }

        window.currentViewDay = displayDay;

        // Set data-day buat warna per hari via CSS var
        if (cardEl) cardEl.dataset.day = displayDay;

        // Render header real (ganti skeleton)
        headerEl.innerHTML = `
        <div>
            <span class="final-badge" id="lblBadge">LOADING</span>
            <h2 class="final-day editable-text" id="lblHari" oninput="autoSaveDraft()">...</h2>
            <small class="final-date" id="lblTanggal">...</small>
        </div>
        <div class="header-right-group">
            <div class="task-shortcut-box" onclick="window.location.href='tugas'">
                <div id="taskBadge" class="task-badge">0</div>
                <i class="fa-solid fa-clipboard-list"></i>
                <span>TUGAS</span>
            </div>
        </div>`;

        // Inject tombol edit di pojok kanan bawah card (bukan di header)
        let editBtnEl = document.getElementById('dcEditBtn');
        if (!editBtnEl) {
            editBtnEl = document.createElement('div');
            editBtnEl.id = 'dcEditBtn';
            editBtnEl.className = 'dc-edit-btn-wrap';
            cardEl.appendChild(editBtnEl);
        }
        editBtnEl.innerHTML = editActionHTML;

        const badgeEl = document.getElementById('lblBadge');
        badgeEl.innerText = labelWaktu;
        badgeEl.className = `final-badge ${displayDay === 'CUSTOM' ? 'bg-custom' : (labelWaktu === 'BESOK' ? 'bg-orange' : 'bg-cyan')}`;

        document.getElementById('lblHari').innerText = (displayDay === 'CUSTOM') ? (config.custom_title || 'EVENT KHUSUS') : displayDay;
        document.getElementById('lblTanggal').innerText = fullDate;

        const daySel = document.getElementById('editDaySelector');
        const autoTog = document.getElementById('editAutoToggle');
        const customTog = document.getElementById('editCustomToggle');
        const normalArea = document.getElementById('normalConfigArea');

        if (daySel) {
            autoTog.checked = config.is_auto;
            customTog.checked = config.is_custom;
            normalArea.style.display = (config.is_custom || window.editingDay === 'CUSTOM') ? 'none' : 'block';
            if (displayDay !== 'CUSTOM') daySel.value = displayDay;

            customTog.onchange = async (e) => {
                window.currentConfig.is_custom = e.target.checked;
                if (window.isDailyEditing) saveToDraft(window.editingDay);
                window.editingDay = e.target.checked ? 'CUSTOM' : (config.is_auto ? autoDay : config.forced_day);
                initDailyCard();
            };
            autoTog.onchange = (e) => { window.currentConfig.is_auto = e.target.checked; };
            daySel.onchange = (e) => {
                if (window.isDailyEditing) saveToDraft(window.editingDay);
                window.editingDay = e.target.value;
                initDailyCard();
            };
        }

        let scheduleData = null;
        if (window.dailyDrafts[displayDay]) {
            scheduleData = window.dailyDrafts[displayDay];
        } else {
            const schedCacheKey = `dc_sched_${CLASS_ID}_${displayDay}`;
            const cachedSched = _dcCacheGet(schedCacheKey);

            if (cachedSched) {
                // Tampilkan cache langsung, fetch fresh di background
                scheduleData = cachedSched;
                supabase.from('daily_schedules').select('*').eq('class_id', CLASS_ID).eq('day_name', displayDay).single()
                    .then(({ data }) => {
                        if (data) _dcCacheSet(schedCacheKey, data);
                    }).catch(() => { });
            } else {
                try {
                    const { data } = await supabase.from('daily_schedules').select('*').eq('class_id', CLASS_ID).eq('day_name', displayDay).single();
                    scheduleData = data;
                    if (data) _dcCacheSet(schedCacheKey, data);
                } catch (err) {
                    // Fallback ke cache expired kalau network error
                    try {
                        const raw = localStorage.getItem(`dc_sched_${CLASS_ID}_${displayDay}`);
                        if (raw) scheduleData = JSON.parse(raw).data;
                    } catch (e) { }
                }
            }
        }

        const contentEl = document.getElementById('dcContentFinal');
        if (!scheduleData) {
            contentEl.innerHTML = `<div class="dc-empty-state">${displayDay === 'CUSTOM' ? 'Mode Custom Aktif.<br>Klik Edit untuk mengisi detail event.' : 'Data Kosong.'}</div>`;
            if (window.isDailyEditing) applyEditMode(true);
            return;
        }

        const dailyColors = {
            'Senin': 'linear-gradient(135deg, #ff4757, #ff6b81)',
            'Selasa': 'linear-gradient(135deg, #5f27cd, #341f97)',
            'Rabu': 'linear-gradient(135deg, #0be881, #00d2d3)',
            'Kamis': 'linear-gradient(135deg, #ffa502, #ff7f50)',
            'Jumat': 'linear-gradient(135deg, #ffffff, #dcdde1)',
            'Sabtu': 'linear-gradient(135deg, #ff9ff3, #feca57)',
            'Minggu': 'linear-gradient(135deg, #54a0ff, #00d2d3)',
            'CUSTOM': 'linear-gradient(135deg, #FFD700, #FFA500)'
        };
        const themeColor = dailyColors[displayDay] || dailyColors['Senin'];
        const textColor = (displayDay === 'Jumat' || displayDay === 'CUSTOM') ? '#333' : '#fff';

        let timelineHTML = '';
        if (scheduleData.lessons) {
            // Split HANYA pakai ; — newline dari data lama juga ditangani
            scheduleData.lessons.split(';').map(i => i.trim()).filter(i => i.length > 1).forEach((item, idx) => {
                const dashIdx = item.lastIndexOf('-'); // Gunakan lastIndexOf agar memotong di '-' yang paling akhir
                const time = dashIdx !== -1 ? item.substring(0, dashIdx).trim() : '';
                const subject = dashIdx !== -1 ? item.substring(dashIdx + 1).trim() : item.trim();
                timelineHTML += `
                <div class="tl-item-final animate-slide-right" style="animation-delay:${idx * 0.05}s">
                    <div class="btn-del-inline" onclick="deleteItem(this)"><i class="fa-solid fa-xmark"></i></div>
                    <div class="tl-time-final editable-text" data-type="time" oninput="autoSaveDraft()">${time}</div>
                    <div class="tl-marker-final"></div>
                    <div class="tl-subject-final editable-text" data-type="subject" oninput="autoSaveDraft()">${subject}</div>
                </div>`;
            });
        }

        let picketHTML = '';
        if (scheduleData.picket) {
            scheduleData.picket.split(';').map(n => n.trim()).filter(n => n.length > 0).forEach((n, i) => {
                picketHTML += `
                <div class="picket-pill animate-pop-up" style="animation-delay:${0.2 + (i * 0.05)}s">
                    <div class="btn-del-inline" onclick="deleteItem(this)"><i class="fa-solid fa-xmark"></i></div>
                    <span class="editable-text" data-type="picket" oninput="autoSaveDraft()">${n}</span>
                </div>`;
            });
        }

        contentEl.innerHTML = `
            <div class="top-cards-grid">
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}">
                    <div class="card-icon"><i class="fa-solid fa-shirt"></i></div>
                    <div class="card-meta">
                        <span class="card-label" style="color:${textColor}">Seragam</span>
                        <span class="card-val editable-text" data-type="uniform" oninput="autoSaveDraft()">${scheduleData.uniform || '-'}</span>
                    </div>
                </div>
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}; animation-delay:0.1s">
                    <div class="card-icon"><i class="fa-solid fa-person-running"></i></div>
                    <div class="card-meta">
                        <span class="card-label" style="color:${textColor}">Kegiatan</span>
                        <span class="card-val editable-text" data-type="activity" oninput="autoSaveDraft()">${scheduleData.activity || 'KBM Normal'}</span>
                    </div>
                </div>
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}; animation-delay:0.2s">
                    <div class="card-icon"><i class="fa-solid fa-note-sticky"></i></div>
                    <div class="card-meta">
                        <span class="card-label" style="color:${textColor}">Catatan</span>
                        <span class="card-val small editable-text" data-type="notes" oninput="autoSaveDraft()">${scheduleData.notes || '-'}</span>
                    </div>
                </div>
            </div>
            <div class="final-spacer"></div>
            <div class="final-section">
                <h4 class="final-title"><i class="fa-regular fa-clock"></i> Jadwal Pelajaran</h4>
                <div class="final-timeline" id="timelineList">${timelineHTML}</div>
                <button class="btn-add-inline" id="btnAddLesson" style="display:none;" onclick="addLessonRow()">+ Tambah Baris</button>
            </div>
            <div class="final-spacer"></div>
            <div class="final-section">
                <h4 class="final-title"><i class="fa-solid fa-broom"></i> Petugas Piket</h4>
                <div class="picket-grid-big" id="picketList">${picketHTML}</div>
                <button class="btn-add-inline" id="btnAddPicket" style="display:none;" onclick="addPicketRow()">+ Tambah Orang</button>
            </div>
        `;

        if (cardEl) cardEl.classList.toggle('edit-mode-on', window.isDailyEditing);
        applyEditMode(window.isDailyEditing);
        updateTaskBadge(user);

    } catch (e) {
        console.error('Daily card error:', e);
    }
}

// ==========================================
// TASK BADGE
// ==========================================
async function updateTaskBadge(user) {
    const cacheKey = `task_badge_${user.id}`;
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(cacheKey)); } catch (e) { }

    if (cached && (Date.now() - cached.time < 5 * 60 * 1000)) {
        renderBadgeUI(cached.count);
        return;
    }

    try {
        const [{ count: total }, { count: done }] = await Promise.all([
            supabase.from('subject_announcements')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', getEffectiveClassId())
                .neq('subject_id', 'announcements')
                .neq('subject_id', 'kisi-kisi')
                .neq('subject_id', 'akuhutajakus'),
            supabase.from('user_progress')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
        ]);
        const pending = (total || 0) - (done || 0);
        sessionStorage.setItem(cacheKey, JSON.stringify({ count: pending, time: Date.now() }));
        renderBadgeUI(pending);
    } catch (e) {
        // Badge gagal tidak perlu crash halaman
    }
}

function renderBadgeUI(pending) {
    const el = document.getElementById('taskBadge');
    if (el) {
        el.innerText = pending > 99 ? '99+' : pending;
        el.style.display = pending > 0 ? 'flex' : 'none';
    }
}

// ==========================================
// DRAFT SYSTEM
// ==========================================
window.autoSaveDraft = function () {
    if (window.isDailyEditing && window.editingDay) saveToDraft(window.editingDay);
};

window.saveToDraft = function (day) {
    if (!day) return;
    const user = _getDailyUser();
    if (!user) return;

    // FIX BUG ENTER: strip newline yang muncul dari Enter di contenteditable
    const cleanText = (el) => (el?.innerText || '').replace(/\n+/g, ' ').trim();

    let lessonArr = [];
    document.querySelectorAll('.tl-item-final').forEach(row => {
        const time = cleanText(row.querySelector('[data-type="time"]'));
        const subj = cleanText(row.querySelector('[data-type="subject"]'));
        if (time || subj) lessonArr.push(`${time} - ${subj}`);
    });

    let picketArr = [];
    document.querySelectorAll('.picket-pill span').forEach(el => {
        const name = cleanText(el);
        if (name) picketArr.push(name);
    });

    window.dailyDrafts[day] = {
        day_name: day,
        class_id: getEffectiveClassId(),
        uniform: cleanText(document.querySelector('[data-type="uniform"]')) || '-',
        activity: cleanText(document.querySelector('[data-type="activity"]')) || '-',
        notes: cleanText(document.querySelector('[data-type="notes"]')) || '-',
        lessons: lessonArr.join('; '),
        picket: picketArr.join('; ')
    };
};

// ==========================================
// EDIT MODE
// ==========================================
window.toggleDailyEditMode = function () {
    window.isDailyEditing = !window.isDailyEditing;
    const card = document.getElementById('dailyInfoCard');
    if (window.isDailyEditing) {
        window.editingDay = window.currentViewDay;
        card.classList.add('edit-mode-on');
    } else {
        window.dailyDrafts = {};
        window.editingDay = null;
        card.classList.remove('edit-mode-on');
    }
    initDailyCard();
};

function applyEditMode(isActive) {
    // Cek apakah sekarang sedang melihat mode CUSTOM
    const isCustomMode = (window.currentViewDay === 'CUSTOM');

    document.querySelectorAll('.editable-text').forEach(el => {
        let canEditElement = isActive;

        // Logika tambahan: Jika elemen adalah ID lblHari, 
        // dia cuma boleh edit kalau isActive DAN sedang mode CUSTOM
        if (el.id === 'lblHari' && !isCustomMode) {
            canEditElement = false;
        }

        el.contentEditable = canEditElement;
        el.classList.toggle('editable-active', canEditElement);

        // Pasang listener Enter hanya jika elemen memang boleh di-edit
        if (canEditElement) {
            el.addEventListener('keydown', _blockEnterKey);
        } else {
            el.removeEventListener('keydown', _blockEnterKey);
        }
    });

    // Elemen kontrol lainnya (tombol tambah baris & config panel) 
    // tetap muncul selama mode edit aktif
    const btnLesson = document.getElementById('btnAddLesson');
    const btnPicket = document.getElementById('btnAddPicket');
    const configPanel = document.getElementById('dailyConfigPanel');

    if (btnLesson) btnLesson.style.display = isActive ? 'block' : 'none';
    if (btnPicket) btnPicket.style.display = isActive ? 'block' : 'none';
    if (configPanel) configPanel.style.display = isActive ? 'block' : 'none';
}

// Fungsi terpisah agar removeEventListener bisa tracking referensi yang sama
function _blockEnterKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Pindah fokus ke field berikutnya supaya UX tetap enak
    const allEditable = [...document.querySelectorAll('.editable-text[contenteditable="true"]')];
    const idx = allEditable.indexOf(e.target);
    if (idx !== -1 && idx < allEditable.length - 1) {
        allEditable[idx + 1].focus();
    }
}

// ==========================================
// SAVE TO DATABASE
// ==========================================
window.saveAllDrafts = async function () {
    const btn = document.querySelector('.action-btn.save');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const user = _getDailyUser();
    if (!user) return;
    const CLASS_ID = getEffectiveClassId() || user.class_id;

    const newTitle = document.getElementById('lblHari').innerText.trim();

    saveToDraft(window.editingDay);
    const draftsArray = Object.values(window.dailyDrafts);

    const isCustom = document.getElementById('editCustomToggle').checked;
    const isAuto = document.getElementById('editAutoToggle').checked;
    const currentForced = window.currentConfig.forced_day;
    const newForced = isCustom ? currentForced : (window.editingDay || currentForced);

    try {
        await supabase.from('daily_config').upsert({
            class_id: CLASS_ID,
            is_auto: isAuto,
            is_custom: isCustom,
            forced_day: newForced,
            custom_title: isCustom ? newTitle : window.currentConfig.custom_title
        });

        window.currentConfig.custom_title = isCustom ? newTitle : window.currentConfig.custom_title;
        window.currentConfig.is_custom = isCustom;
        window.currentConfig.is_auto = isAuto;

        if (draftsArray.length > 0) {
            const { error: upsertError } = await supabase
                .from('daily_schedules')
                .upsert(draftsArray, { onConflict: 'class_id, day_name' });
            if (upsertError) throw upsertError;
        }

        window.dailyDrafts = {};
        window.isDailyEditing = false;
        window.editingDay = null;

        // Invalidate cache biar data baru langsung ke-fetch pas reload
        _dcCacheInvalidate(CLASS_ID);
        window.currentConfig = null; // force re-fetch config juga

        if (typeof showPopup === 'function') showPopup('Data Tersimpan!', 'success');
        initDailyCard();
    } catch (err) {
        console.error('Save error:', err);
        if (typeof showPopup === 'function') showPopup('Gagal menyimpan!', 'error');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
};

// ==========================================
// ADD / DELETE ROW
// ==========================================
window.deleteItem = function (el) {
    el.parentElement.remove();
    autoSaveDraft();
};

window.addLessonRow = function () {
    const div = document.createElement('div');
    div.className = 'tl-item-final';
    div.innerHTML = `
        <div class="btn-del-inline" style="display:flex;">
            <i class="fa-solid fa-xmark"></i>
        </div>
        <div class="tl-time-final editable-text editable-active"
             contenteditable="true" data-type="time"
             data-placeholder="00.00" oninput="autoSaveDraft()"></div>
        <div class="tl-marker-final"></div>
        <div class="tl-subject-final editable-text editable-active"
             contenteditable="true" data-type="subject"
             data-placeholder="Mata Pelajaran" oninput="autoSaveDraft()"></div>`;

    div.querySelector('.btn-del-inline').onclick = function () { div.remove(); autoSaveDraft(); };
    div.querySelectorAll('.editable-text').forEach(el => el.addEventListener('keydown', _blockEnterKey));

    document.getElementById('timelineList').appendChild(div);
    autoSaveDraft();
};

window.addPicketRow = function () {
    const div = document.createElement('div');
    div.className = 'picket-pill';
    div.innerHTML = `
        <div class="btn-del-inline" style="display:flex;">
            <i class="fa-solid fa-xmark"></i>
        </div>
        <span class="editable-text editable-active"
              contenteditable="true" data-type="picket"
              data-placeholder="Nama" oninput="autoSaveDraft()"></span>`;

    div.querySelector('.btn-del-inline').onclick = function () { div.remove(); autoSaveDraft(); };
    div.querySelector('span').addEventListener('keydown', _blockEnterKey);

    document.getElementById('picketList').appendChild(div);
    autoSaveDraft();
};

// ==========================================
// INIT
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initDailyCard, 500));
} else {
    setTimeout(initDailyCard, 500);
}

// ==========================================
// KEYBOARD SHORTCUTS (ADMIN)
// ==========================================
document.addEventListener('keydown', function (e) {
    // CTRL + / : Buka/Tutup Edit Mode
    if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        toggleDailyEditMode();
    }

    if (!window.isDailyEditing) return;

    // CTRL + ENTER : Simpan
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        saveAllDrafts();
    }

    // ESC : Batal
    if (e.key === 'Escape') {
        e.preventDefault();
        toggleDailyEditMode();
    }

    // CTRL + . : Tambah Baris Pelajaran
    if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        addLessonRow();
    }

    // CTRL + , : Tambah Nama Piket
    if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        addPicketRow();
    }
});