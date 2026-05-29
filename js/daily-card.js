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

        .tl-subject-final.dc-nav-valid { cursor: pointer; transition: opacity 0.2s; }
        .tl-subject-final.dc-nav-valid:hover { opacity: 0.7; text-decoration: underline; }
        .edit-mode-on .tl-subject-final { cursor: text !important; text-decoration: none !important; opacity: 1 !important; }
    `;
    document.head.appendChild(style);
})();

// Helper navigasi ke halaman subject
async function _navigateToSubject(name, classId) {
    if (!name || name === '-' || window.isDailyEditing) return;

    // Fungsi normalize biar "Bahasa Indonesia" cocok sama "bahasaindonesia"
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    try {
        if (!window._dcSubjMap) {
            const { data } = await supabase.from('subjects_config')
                .select('subject_id, subject_name')
                .eq('class_id', classId);
            window._dcSubjMap = data || [];
        }

        const search = normalize(name);
        // Cari yang paling mendekati (exact atau partial setelah di-normalize)
        const match = window._dcSubjMap.find(s => {
            const sNameNorm = normalize(s.subject_name);
            const sIdNorm = normalize(s.subject_id);
            
            // Cek Exact Match dulu
            if (sNameNorm === search || sIdNorm === search) return true;

            // Kalau Partial Match (includes), minimal length 3 biar gak typo (misal: PPK match ke PP)
            if (search.length > 3 && (sNameNorm.includes(search) || search.includes(sNameNorm))) return true;

            return false;
        });

        if (match) {
            window.location.href = `subject?id=${match.subject_id}`;
        } else {
            if (typeof showToast === 'function') showToast(`Mapel "${name}" belum terdaftar`, 'info');
        }
    } catch (e) { console.error('DC Nav Error:', e); }
}

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
        const types = ['regular', 'exam', 'custom'];
        days.forEach(d => {
            types.forEach(t => {
                localStorage.removeItem(`dc_sched_${classId}_${d}_${t}`);
            });
        });
        localStorage.removeItem(`dc_config_${classId}`);
    } catch (e) { }
}

async function initDailyCard() {
    const container = document.querySelector('.left-section');
    if (!container) return;

    const user = _getDailyUser();
    if (!user || !user.class_id) return;
    
    const MASTER_CLASS_ID = 2; // Class ID pusat untuk Global Exam
    const USER_CLASS_ID = getEffectiveClassId() || user.class_id;

    // --- 1. LOGIC CONFIG & GLOBAL EXAM ---
    let config = window.currentConfig;
    let isGlobalExam = false;

    // Hanya fetch data kalau belum ada di memori ATAU lagi nggak ngedit
    if (!config || !window.isDailyEditing) {
        try {
            // A. Cek Master Config dulu buat tau apakah Global Exam lagi aktif
            const masterCacheKey = `dc_config_${MASTER_CLASS_ID}`;
            let masterConfig = _dcCacheGet(masterCacheKey);

            if (!masterConfig) {
                const { data } = await supabase.from('daily_config').select('*').eq('class_id', MASTER_CLASS_ID).single();
                masterConfig = data;
                if (data) _dcCacheSet(masterCacheKey, data);
            }

            if (masterConfig && masterConfig.mode === 'exam' && USER_CLASS_ID != MASTER_CLASS_ID) {
                // Hanya anggap 'Global' bagi orang yang BUKAN admin Class 2
                // Biar admin Class 2 tetep bisa ngontrol master config-nya sendiri
                isGlobalExam = true;
                config = masterConfig;
            } else {
                // B. Pake config kelas masing-masing
                const configCacheKey = `dc_config_${USER_CLASS_ID}`;
                const cachedConfig = _dcCacheGet(configCacheKey);
                if (cachedConfig) {
                    config = cachedConfig;
                } else {
                    const { data } = await supabase.from('daily_config').select('*').eq('class_id', USER_CLASS_ID).single();
                    config = data;
                    if (data) _dcCacheSet(configCacheKey, data);
                }
            }
        } catch (e) { console.warn("DC Config Load Error:", e); }
    }

    if (!config) {
        config = { class_id: USER_CLASS_ID, is_auto: true, mode: 'regular', forced_day: 'Senin' };
    }
    // Migration: Pastikan mode exist
    if (!config.mode) config.mode = config.is_custom ? 'custom' : 'regular';
    
    window.currentConfig = config;
    const CLASS_ID = config.class_id; 

    // --- 2. RENDER KERANGKA ---
    const cardId = 'dailyInfoCard';
    let cardEl = document.getElementById(cardId);
    
    // canEdit: Hanya admin Class 2 yang bisa edit kalo lagi Global Exam aktif (bagi siswa lain)
    const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');
    const canEditThisConfig = isGlobalExam ? false : isAdmin;

    let editActionHTML = '';
    if (canEditThisConfig) {
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
                <div id="dailyConfigPanel" class="config-panel"></div>
                <div class="final-watermark">v14 dynamic-range-system</div>
            </div>
        `;
        const welcome = document.getElementById('welcomeText');
        if (welcome) welcome.insertAdjacentHTML('afterend', cardHTML);
        else container.innerHTML += cardHTML;
        cardEl = document.getElementById(cardId);
    }

    // --- 2. UPDATE CONFIG PANEL (Always ensure latest UI structure) ---
    const configPanel = document.getElementById('dailyConfigPanel');
    if (configPanel && (!configPanel.innerHTML || !document.getElementById('kisiRangeArea'))) {
        configPanel.innerHTML = `
            <h4 style="margin-bottom:10px; font-size:12px; color:#aaa; text-transform:uppercase;">Admin: <span id="lblAdminId">...</span></h4>

            <!-- PENGINGAT EDIT MODE -->
            <div id="editWarningLabel" style="background: rgba(255, 71, 87, 0.2); border: 1px solid #ff4757; padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                <small style="color: #ff6b81; font-weight: bold; display: block; font-size: 10px; text-transform: uppercase;">Sedang Mengedit:</small>
                <span id="currentEditingTypeLabel" style="color: white; font-weight: 900; font-size: 14px;">...</span>
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-size:12px; display:block; margin-bottom:5px; color:#ff6b81; font-weight:bold;">Aktifkan Mode Apa?</label>
                <select id="editModeSelector" class="glass-input" style="border-color:#ff4757; color:#ff6b81; font-weight:bold;">
                    <option value="regular">Jadwal Utama</option>
                    <option value="exam">Mode Ulangan (7 Hari)</option>
                    <option value="custom">Custom Event (1 Hari)</option>
                </select>
            </div>

            <!-- KISI-KISI RANGE SELECTOR -->
            <div id="kisiRangeArea" style="margin-bottom:15px; display:none; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                <label style="font-size:12px; display:block; margin-bottom:8px; color:#00eaff; font-weight:bold;">Tampilkan Hari Apa di Kisi-Kisi?</label>
                <div id="kisiDayCheckboxes" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px;">
                    ${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(d => `
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                            <input type="checkbox" value="${d}" class="kisi-day-opt" style="accent-color:#00eaff;"> ${d}
                        </label>
                    `).join('')}
                </div>
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
        `;
    }

    const headerEl = document.getElementById('dcHeader');
    headerEl.innerHTML = _buildHeaderSkeleton();

    // Kalau card sudah ada (re-render), tampilkan skeleton sementara data diambil
    const contentEl2 = document.getElementById('dcContentFinal');
    if (contentEl2 && !window.isDailyEditing) {
        contentEl2.innerHTML = _buildDailyCardSkeleton();
    }

    // --- 3. LOGIC DISPLAY ---
    try {
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
        let currentType = config.mode || 'regular';
        let fullDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        if (window.editingDay) {
            displayDay = window.editingDay;
            labelWaktu = (displayDay === 'CUSTOM') ? 'EDIT CUSTOM' : 'DRAFT MODE';
        } else if (config.mode === 'custom') {
            displayDay = 'CUSTOM';
            labelWaktu = 'SPECIAL EVENT';
            fullDate = 'Jadwal Khusus';
        } else if (config.mode === 'exam') {
            if (config.is_auto) {
                displayDay = autoDay;
                if (now.getHours() >= 15) labelWaktu = 'BESOK (EXAM)';
                else labelWaktu = 'HARI INI (EXAM)';
            } else {
                displayDay = config.forced_day;
                labelWaktu = 'EXAM MODE';
            }
            if (isGlobalExam) labelWaktu = `GLOBAL ${labelWaktu}`;
        } else if (config.is_auto) {
            displayDay = autoDay;
            if (now.getHours() >= 15) labelWaktu = 'BESOK';
        } else {
            displayDay = config.forced_day;
            labelWaktu = 'MANUAL';
            fullDate = '-';
        }

        window.currentViewDay = displayDay;
        const activeType = (window.isDailyEditing) ? currentType : (config.mode || 'regular');

        // Set data-day buat warna per hari via CSS var
        if (cardEl) cardEl.dataset.day = displayDay;

        // Render header real (ganti skeleton)
        const isExamMode = config.mode === 'exam';
        const shortcutLink = isExamMode ? 'kisi-kisi' : 'tugas';
        const shortcutIcon = isExamMode ? 'fa-solid fa-file-signature' : 'fa-solid fa-clipboard-list';
        const shortcutLabel = isExamMode ? 'KISI-KISI' : 'TUGAS';
        const badgeDisplay = isExamMode ? 'none' : 'block';

        headerEl.innerHTML = `
        <div>
            <span class="final-badge" id="lblBadge">LOADING</span>
            <h2 class="final-day editable-text" id="lblHari" oninput="autoSaveDraft()">...</h2>
            <small class="final-date" id="lblTanggal">...</small>
        </div>
        <div class="header-right-group">
            <div class="task-shortcut-box" onclick="window.location.href='${shortcutLink}'">
                <div id="taskBadge" class="task-badge" style="display: ${badgeDisplay}">0</div>
                <i class="${shortcutIcon}"></i>
                <span>${shortcutLabel}</span>
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
        
        let badgeClass = 'bg-cyan';
        if (displayDay === 'CUSTOM') badgeClass = 'bg-custom';
        else if (config.mode === 'exam') badgeClass = 'bg-orange';
        else if (labelWaktu === 'BESOK') badgeClass = 'bg-orange';
        
        badgeEl.className = `final-badge ${badgeClass}`;

        document.getElementById('lblHari').innerText = (displayDay === 'CUSTOM') ? (config.custom_title || 'EVENT KHUSUS') : displayDay;
        document.getElementById('lblTanggal').innerText = fullDate;

        const daySel = document.getElementById('editDaySelector');
        const modeSel = document.getElementById('editModeSelector');
        const autoTog = document.getElementById('editAutoToggle');
        const normalArea = document.getElementById('normalConfigArea');
        const kisiArea = document.getElementById('kisiRangeArea');

        if (modeSel) {
            const activeMode = config.mode || 'regular';
            modeSel.value = activeMode;
            autoTog.checked = config.is_auto;
            
            // --- LOGIC VISIBILITAS ---
            if (normalArea) normalArea.style.display = (activeMode === 'custom' || window.editingDay === 'CUSTOM') ? 'none' : 'block';
            if (kisiArea) kisiArea.style.display = (activeMode === 'exam') ? 'block' : 'none';
            
            if (displayDay !== 'CUSTOM' && daySel) daySel.value = displayDay;

            // Set Checkboxes Kisi-kisi
            const savedKisiDays = config.kisi_days || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
            document.querySelectorAll('.kisi-day-opt').forEach(opt => {
                opt.checked = savedKisiDays.includes(opt.value);
            });

            // Update label pengingat
            const labelMap = { 'regular': 'JADWAL UTAMA', 'exam': 'JADWAL ULANGAN', 'custom': 'CUSTOM EVENT' };
            const warnLabel = document.getElementById('currentEditingTypeLabel');
            if (warnLabel) warnLabel.innerText = labelMap[activeMode] || 'JADWAL';

            modeSel.onchange = async (e) => {
                const newMode = e.target.value;
                if (window.isDailyEditing) saveToDraft(window.editingDay, window.currentConfig.mode);
                window.currentConfig.mode = newMode;
                window.currentConfig.is_custom = (newMode === 'custom');
                window.editingDay = (newMode === 'custom') ? 'CUSTOM' : (config.is_auto ? autoDay : config.forced_day);
                
                // Update visibilitas instan
                if (kisiArea) kisiArea.style.display = (newMode === 'exam') ? 'block' : 'none';
                if (normalArea) normalArea.style.display = (newMode === 'custom') ? 'none' : 'block';
                if (warnLabel) warnLabel.innerText = labelMap[newMode] || 'JADWAL';

                initDailyCard();
            };
            autoTog.onchange = (e) => { window.currentConfig.is_auto = e.target.checked; };
            daySel.onchange = (e) => {
                if (window.isDailyEditing) saveToDraft(window.editingDay, window.currentConfig.mode);
                window.editingDay = e.target.value;
                initDailyCard();
            };
        }

        let scheduleData = null;
        const draftKey = `${displayDay}_${activeType}`;
        if (window.dailyDrafts[draftKey]) {
            scheduleData = window.dailyDrafts[draftKey];
        } else {
            const schedCacheKey = `dc_sched_${CLASS_ID}_${displayDay}_${activeType}`;
            const cachedSched = _dcCacheGet(schedCacheKey);

            if (cachedSched) {
                // Tampilkan cache langsung, fetch fresh di background
                scheduleData = cachedSched;
                supabase.from('daily_schedules').select('*').eq('class_id', CLASS_ID).eq('day_name', displayDay).eq('type', activeType).single()
                    .then(({ data }) => {
                        if (data) _dcCacheSet(schedCacheKey, data);
                    }).catch(() => { });
            } else {
                try {
                    const { data } = await supabase.from('daily_schedules').select('*').eq('class_id', CLASS_ID).eq('day_name', displayDay).eq('type', activeType).single();
                    scheduleData = data;
                    if (data) _dcCacheSet(schedCacheKey, data);
                } catch (err) {
                    // Fallback ke cache expired kalau network error
                    try {
                        const raw = localStorage.getItem(schedCacheKey);
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
            const lessonList = scheduleData.lessons.split(';').map(i => i.trim()).filter(i => i.length > 1);

            lessonList.forEach((item, idx) => {
                const dashIdx = item.lastIndexOf('-'); 
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

        // --- Selective Navigation Logic ---
        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        
        // Pastikan map mapel sudah ada
        if (!window._dcSubjMap) {
            const { data } = await supabase.from('subjects_config')
                .select('subject_id, subject_name')
                .eq('class_id', CLASS_ID);
            window._dcSubjMap = data || [];
        }

        // Attach Click Listener & Style HANYA ke Subject yang valid
        contentEl.querySelectorAll('.tl-subject-final').forEach(el => {
            const name = el.innerText.trim();
            const search = normalize(name);
            
            const isValidSubject = window._dcSubjMap.find(s => {
                const sNameNorm = normalize(s.subject_name);
                const sIdNorm = normalize(s.subject_id);
                if (sNameNorm === search || sIdNorm === search) return true;
                if (search.length > 3 && (sNameNorm.includes(search) || search.includes(sNameNorm))) return true;
                return false;
            });

            if (isValidSubject && !window.isDailyEditing) {
                el.classList.add('dc-nav-valid');
                el.onclick = () => _navigateToSubject(name, CLASS_ID);
            } else {
                el.classList.remove('dc-nav-valid');
                el.onclick = null;
            }
        });

    } catch (e) {
        console.error('Daily card error:', e);
    }
}

// Fitur ganti hari via Context Menu (Temporary View)
window.switchDailyDay = function(day) {
    if (window.isDailyEditing) {
        if (typeof showToast === 'function') showToast('Selesaikan edit dulu!', 'info');
        return;
    }
    window.editingDay = day; // Kita 'pinjam' editingDay untuk view sementara
    initDailyCard();
    if (typeof showToast === 'function') showToast(`Melihat jadwal hari ${day}`, 'info');
};

// ==========================================
// TASK BADGE
// ==========================================
async function updateTaskBadge(user) {
    const cacheKey = `task_badge_${user.id}`;
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(cacheKey)); } catch (e) { }

    // Kalau ada flag dirty (admin baru arsipkan task), paksa re-fetch
    const isDirty = sessionStorage.getItem('task_badge_dirty') === '1';
    if (!isDirty && cached && (Date.now() - cached.time < 5 * 60 * 1000)) {
        renderBadgeUI(cached.count);
        return;
    }
    sessionStorage.removeItem('task_badge_dirty');

    try {
        const [{ count: total }, { count: done }] = await Promise.all([
            supabase.from('subject_announcements')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', getEffectiveClassId())
                .neq('subject_id', 'announcements')
                .neq('subject_id', 'kisi-kisi')
                .neq('subject_id', 'akuhutajakus')
                .neq('is_done', true),          // ← skip task yang sudah diarsipkan
            supabase.from('user_progress')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
        ]);
        const pending = Math.max(0, (total || 0) - (done || 0));
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
    if (window.isDailyEditing && window.editingDay) {
        saveToDraft(window.editingDay, window.currentConfig.mode);
    }
};

window.saveToDraft = function (day, type = 'regular') {
    if (!day) return;
    const user = _getDailyUser();
    if (!user) return;

    // FIX BUG ENTER: strip newline yang muncul dari Enter di contenteditable
    const cleanText = (el) => (el?.innerText || '').replace(/\n+/g, ' ').trim();

    let lessonArr = [];
    document.querySelectorAll('.tl-item-final').forEach(row => {
        const timeEl = row.querySelector('[data-type="time"]');
        const subjEl = row.querySelector('[data-type="subject"]');
        
        const time = (timeEl?.innerText || '').replace(/\n+/g, ' ').trim();
        const subj = (subjEl?.innerText || '').replace(/\n+/g, ' ').trim();
        
        if (time || subj) {
            // Gabungin pake format yang konsisten: "Waktu - Mapel"
            lessonArr.push(`${time || '??.??'} - ${subj || '-'}`);
        }
    });

    let picketArr = [];
    document.querySelectorAll('.picket-pill span').forEach(el => {
        const name = cleanText(el);
        if (name) picketArr.push(name);
    });

    const draftKey = `${day}_${type}`;
    window.dailyDrafts[draftKey] = {
        day_name: day,
        type: type,
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
async function saveAllDrafts() {
    const btn = document.querySelector('.action-btn.save');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const user = _getDailyUser();
    if (!user) return;
    
    // Pastikan CLASS_ID jadi angka biar gak ribet di DB
    const CLASS_ID = parseInt(getEffectiveClassId() || user.class_id);

    const modeSel = document.getElementById('editModeSelector');
    const activeMode = modeSel ? modeSel.value : (window.currentConfig.mode || 'regular');
    const newTitle = document.getElementById('lblHari').innerText.trim();

    // Simpan draft terakhir sebelum push ke DB
    saveToDraft(window.editingDay, activeMode);
    
    const draftsArray = Object.values(window.dailyDrafts).map(d => ({
        ...d,
        class_id: CLASS_ID,
        type: activeMode // Paksa type sesuai mode yang lagi dipilih di UI
    }));

    const isAuto = document.getElementById('editAutoToggle').checked;
    const currentForced = window.currentConfig.forced_day;
    const newForced = (activeMode === 'custom') ? currentForced : (window.editingDay || currentForced);

    // Ambil pilihan hari kisi-kisi
    const selectedKisiDays = Array.from(document.querySelectorAll('.kisi-day-opt:checked')).map(el => el.value);

    try {
        // 1. Update Config (is_custom tetep diupdate buat fallback/compat)
        const { error: cfgError } = await supabase.from('daily_config').upsert({
            class_id: CLASS_ID,
            is_auto: isAuto,
            is_custom: (activeMode === 'custom'),
            mode: activeMode,
            forced_day: newForced,
            custom_title: (activeMode === 'custom') ? newTitle : (window.currentConfig.custom_title || ''),
            kisi_days: (selectedKisiDays.length > 0) ? selectedKisiDays : ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
        });
        if (cfgError) throw cfgError;

        // 2. Upsert Schedules dengan onConflict yang baru (wajib ada type)
        if (draftsArray.length > 0) {
            const { error: upsertError } = await supabase
                .from('daily_schedules')
                .upsert(draftsArray, { onConflict: 'class_id, day_name, type' });
            
            if (upsertError) {
                // Kalo error di sini, kemungkinan besar constraint DB belum diupdate
                if (upsertError.code === '42P10') {
                    throw new Error("SQL_CONSTRAINT_MISSING");
                }
                throw upsertError;
            }
        }

        // 3. Clear Cache & State
        _dcCacheInvalidate(CLASS_ID);
        if (CLASS_ID === 2) _dcCacheInvalidate(2);
        
        window.dailyDrafts = {};
        window.isDailyEditing = false;
        window.editingDay = null;
        window.currentConfig = null; 

        if (typeof showToast === 'function') showToast('Mantap! Data Tersimpan.', 'success');
        
        setTimeout(() => { initDailyCard(); }, 300);

    } catch (err) {
        console.error('Save error:', err);
        let msg = 'Gagal menyimpan!';
        if (err.message === "SQL_CONSTRAINT_MISSING") {
            msg = 'ERROR DATABASE! Lu harus jalanin SQL di sql_updates.sql dulu biar gak bentrok.';
        }
        if (typeof showPopup === 'function') showPopup(msg, 'error');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
}

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