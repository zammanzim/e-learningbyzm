// --- GLOBAL VARIABLES ---
window.dailyDrafts = {}; 
window.isDailyEditing = false;
window.editingDay = null; 
window.currentViewDay = null;

async function initDailyCard() {
    const container = document.querySelector('.left-section');
    if (!container) return;

    // --- 0. CEK USER ---
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || !user.class_id) return;
    const CLASS_ID = user.class_id;

    // --- 1. RENDER KERANGKA ---
    const cardId = 'dailyInfoCard';
    if (!document.getElementById(cardId)) {
        const isAdmin = user && (user.role === 'class_admin' || user.role === 'super_admin');
        
        if (isAdmin && !document.getElementById('dailyFab')) {
            const fabHTML = `
                <div id="dailyFab" class="daily-fab-container">
                    <button class="fab-daily btn-edit" onclick="toggleDailyEditMode()" title="Edit Daily Card">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', fabHTML);
        }

        const cardHTML = `
            <div id="${cardId}" class="daily-card-final glass-card-effect">
                <div class="final-header animate-pop-in">
                    <div>
                        <span class="final-badge" id="lblBadge">LOADING</span>
                        <h2 class="final-day" id="lblHari">...</h2>
                        <small class="final-date" id="lblTanggal">...</small>
                    </div>
                    <div class="task-shortcut-box" onclick="window.location.href='tugas.html'">
                        <i class="fa-solid fa-clipboard-list"></i>
                        <span>TUGAS</span>
                    </div>
                </div>

                <div id="dcContentFinal" class="final-content">
                    <p style="text-align:center; padding:20px;">Mengambil Data...</p>
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
                            <select id="editDaySelector" class="glass-input" style="width:100%; padding:8px; border-radius:8px; background:rgba(255,255,255,0.1); color:white; border:none;">
                                <option value="Senin">Senin</option><option value="Selasa">Selasa</option>
                                <option value="Rabu">Rabu</option><option value="Kamis">Kamis</option>
                                <option value="Jumat">Jumat</option><option value="Sabtu">Sabtu</option><option value="Minggu">Minggu</option>
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
                <div class="final-watermark">v20 Custom Mode</div>
            </div>
        `;
        const welcome = document.getElementById('welcomeText');
        if (welcome) welcome.insertAdjacentHTML('afterend', cardHTML);
        else container.innerHTML += cardHTML;
    }

    // --- 2. LOGIC DATA ---
    try {
        // A. FETCH CONFIG
        if (!window.currentConfig) {
            let { data: config } = await supabase.from('daily_config').select('*').eq('class_id', CLASS_ID).single();
            if (!config) {
                config = { class_id: CLASS_ID, is_auto: true, is_custom: false, forced_day: 'Senin' };
                await supabase.from('daily_config').insert(config);
            }
            window.currentConfig = config;
        }

        const config = window.currentConfig;
        
        // B. TENTUKAN HARI (Priority: CUSTOM > AUTO > MANUAL)
        const now = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        let autoDay = days[now.getDay()];
        if (now.getHours() >= 15) {
            const besok = new Date(now); besok.setDate(now.getDate() + 1);
            autoDay = days[besok.getDay()];
        }

        // Logic Display Day
        let displayDay = 'Senin';
        let labelWaktu = 'HARI INI';
        let fullDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        // Cek Priority
        if (window.editingDay) {
            // Mode Edit (Selalu menang)
            displayDay = window.editingDay;
            labelWaktu = (displayDay === 'CUSTOM') ? "EDIT CUSTOM" : "DRAFT MODE";
        } 
        else if (config.is_custom) {
            // Mode Custom Aktif
            displayDay = 'CUSTOM';
            labelWaktu = "SPECIAL EVENT";
            fullDate = "Jadwal Khusus";
        } 
        else if (config.is_auto) {
            // Mode Auto
            displayDay = autoDay;
            if (now.getHours() >= 15) labelWaktu = "BESOK";
        } 
        else {
            // Mode Manual
            displayDay = config.forced_day;
            labelWaktu = "MANUAL";
            fullDate = "-";
        }

        window.currentViewDay = displayDay;

        // UI Update Header
        const badgeEl = document.getElementById('lblBadge');
        badgeEl.innerText = labelWaktu;
        
        // Warna Badge
        if (displayDay === 'CUSTOM') badgeEl.className = 'final-badge bg-custom'; // Style khusus ntar
        else badgeEl.className = `final-badge ${labelWaktu === 'BESOK' ? 'bg-orange' : 'bg-cyan'}`;

        document.getElementById('lblHari').innerText = (displayDay === 'CUSTOM') ? (config.custom_title || 'EVENT KHUSUS') : displayDay;
        document.getElementById('lblTanggal').innerText = fullDate;

        // --- C. CONTROLS SETUP ---
        const daySel = document.getElementById('editDaySelector');
        const autoTog = document.getElementById('editAutoToggle');
        const customTog = document.getElementById('editCustomToggle');
        const normalArea = document.getElementById('normalConfigArea');

        if (daySel) {
            // Sync Toggle UI
            autoTog.checked = config.is_auto;
            customTog.checked = config.is_custom;

            // Hide/Show Normal Controls based on Custom Toggle
            if (config.is_custom || window.editingDay === 'CUSTOM') {
                normalArea.style.display = 'none'; // Sembunyiin dropdown hari kalo lagi Custom
            } else {
                normalArea.style.display = 'block';
                daySel.value = displayDay;
            }

            // LISTENER: CUSTOM TOGGLE
            customTog.onchange = async (e) => {
                const isCustom = e.target.checked;
                // Update Config Global
                window.currentConfig.is_custom = isCustom;
                
                // Set Editing Day
                if (window.isDailyEditing) saveToDraft(window.editingDay);
                window.editingDay = isCustom ? 'CUSTOM' : (config.is_auto ? autoDay : config.forced_day);
                
                initDailyCard();
            };

            // LISTENER: AUTO TOGGLE
            autoTog.onchange = (e) => {
                window.currentConfig.is_auto = e.target.checked;
                // Auto toggle gak ngerubah editingDay langsung kalo lagi ngedit normal
            };

            // LISTENER: DAY SELECTOR
            daySel.onchange = (e) => {
                if (window.isDailyEditing) saveToDraft(window.editingDay);
                window.editingDay = e.target.value;
                initDailyCard();
            };
        }

        // --- D. FETCH CONTENT ---
        let scheduleData = null;
        if (window.dailyDrafts[displayDay]) {
            scheduleData = window.dailyDrafts[displayDay];
        } else {
            const { data } = await supabase.from('daily_schedules')
                .select('*').eq('class_id', CLASS_ID).eq('day_name', displayDay).single();
            scheduleData = data;
        }

        const contentEl = document.getElementById('dcContentFinal');
        if (!scheduleData) {
            // Auto Create CUSTOM row if missing logic handled in SQL, but double check
            if (displayDay === 'CUSTOM') {
                 contentEl.innerHTML = `<div class="dc-empty-state">Mode Custom Aktif.<br>Klik Edit untuk mengisi detail event.</div>`;
            } else {
                 contentEl.innerHTML = `<div class="dc-empty-state">Data Kosong.</div>`;
            }
            if (window.isDailyEditing) applyEditMode(true);
            return;
        }

        // --- RENDER CONTENT ---
        const dailyColors = {
            'Senin': 'linear-gradient(135deg, #ff4757, #ff6b81)', 'Selasa': 'linear-gradient(135deg, #5f27cd, #341f97)',
            'Rabu': 'linear-gradient(135deg, #0be881, #00d2d3)', 'Kamis': 'linear-gradient(135deg, #ffa502, #ff7f50)',
            'Jumat': 'linear-gradient(135deg, #ffffff, #dcdde1)', 'Sabtu': 'linear-gradient(135deg, #ff9ff3, #feca57)',
            'Minggu': 'linear-gradient(135deg, #54a0ff, #00d2d3)',
            'CUSTOM': 'linear-gradient(135deg, #FFD700, #FFA500)' // Warna Emas buat Custom
        };
        const themeColor = dailyColors[displayDay] || dailyColors['Senin'];
        const textColor = (displayDay === 'Jumat' || displayDay === 'CUSTOM') ? '#333' : '#fff';

        // Timeline
        let timelineHTML = '';
        if (scheduleData.lessons) {
            scheduleData.lessons.split(/,|\n/).map(i => i.trim()).filter(i => i.length > 1).forEach((item, idx) => {
                let [time, subject] = item.includes('-') ? item.split('-') : ["", item];
                timelineHTML += `
                    <div class="tl-item-final animate-slide-right" style="animation-delay:${idx*0.05}s">
                        <div class="btn-del-inline" onclick="deleteItem(this)"><i class="fa-solid fa-xmark"></i></div>
                        <div class="tl-time-final editable-text" data-type="time" oninput="autoSaveDraft()">${time.trim()}</div>
                        <div class="tl-marker-final"></div>
                        <div class="tl-subject-final editable-text" data-type="subject" oninput="autoSaveDraft()">${subject.trim()}</div>
                    </div>`;
            });
        }

        // Piket
        let picketHTML = '';
        if (scheduleData.picket) {
            scheduleData.picket.split(/,|\n/).map(n => n.trim()).filter(n => n.length > 0).forEach((n, i) => {
                picketHTML += `
                    <div class="picket-pill animate-pop-up" style="animation-delay:${0.2+(i*0.05)}s">
                        <div class="btn-del-inline" onclick="deleteItem(this)"><i class="fa-solid fa-xmark"></i></div>
                        <span class="editable-text" data-type="picket" oninput="autoSaveDraft()">${n}</span>
                    </div>`;
            });
        }

        contentEl.innerHTML = `
            <div class="top-cards-grid">
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}">
                    <div class="card-icon"><i class="fa-solid fa-shirt"></i></div>
                    <div class="card-meta"><span class="card-label" style="color:${textColor}">Seragam</span>
                    <span class="card-val editable-text" data-type="uniform" oninput="autoSaveDraft()">${scheduleData.uniform || '-'}</span></div>
                </div>
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}; animation-delay:0.1s">
                    <div class="card-icon"><i class="fa-solid fa-person-running"></i></div>
                    <div class="card-meta"><span class="card-label" style="color:${textColor}">Kegiatan</span>
                    <span class="card-val editable-text" data-type="activity" oninput="autoSaveDraft()">${scheduleData.activity || 'KBM Normal'}</span></div>
                </div>
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}; animation-delay:0.2s">
                    <div class="card-icon"><i class="fa-solid fa-note-sticky"></i></div>
                    <div class="card-meta"><span class="card-label" style="color:${textColor}">Catatan</span>
                    <span class="card-val small editable-text" data-type="notes" oninput="autoSaveDraft()">${scheduleData.notes || '-'}</span></div>
                </div>
            </div>
            <div class="final-spacer"></div>
            <div class="final-section">
                <h4 class="final-title"><i class="fa-regular fa-clock"></i> Jadwal Event/Pelajaran</h4>
                <div class="final-timeline" id="timelineList">${timelineHTML}</div>
                <button class="btn-add-inline" id="btnAddLesson" style="display:none;" onclick="addLessonRow()">+ Tambah Baris</button>
            </div>
            <div class="final-spacer"></div>
            <div class="final-section">
                <h4 class="final-title"><i class="fa-solid fa-broom"></i> Petugas / Panitia</h4>
                <div class="picket-grid-big" id="picketList">${picketHTML}</div>
                <button class="btn-add-inline" id="btnAddPicket" style="display:none;" onclick="addPicketRow()">+ Tambah Orang</button>
            </div>
        `;

        if (window.isDailyEditing) applyEditMode(true);

    } catch (e) { console.error("Error Init:", e); }
}

// --- 3. DRAFT & AUTO SAVE ---
window.autoSaveDraft = function() {
    if (window.isDailyEditing && window.editingDay) saveToDraft(window.editingDay);
}

window.saveToDraft = function(day) {
    if (!day) return;
    const user = JSON.parse(localStorage.getItem("user"));
    
    let lessonArr = [];
    document.querySelectorAll('.tl-item-final').forEach(row => {
        const time = row.querySelector('[data-type="time"]')?.innerText.trim() || "";
        const subj = row.querySelector('[data-type="subject"]')?.innerText.trim() || "";
        if(time || subj) lessonArr.push(`${time} - ${subj}`);
    });

    let picketArr = [];
    document.querySelectorAll('.picket-pill span').forEach(el => { 
        if(el.innerText.trim()) picketArr.push(el.innerText.trim()); 
    });

    window.dailyDrafts[day] = {
        day_name: day, class_id: user.class_id,
        uniform: document.querySelector('[data-type="uniform"]')?.innerText.trim() || "-",
        activity: document.querySelector('[data-type="activity"]')?.innerText.trim() || "-",
        notes: document.querySelector('[data-type="notes"]')?.innerText.trim() || "-",
        lessons: lessonArr.join(', '), picket: picketArr.join(', ')
    };
}

// --- 4. TOGGLE EDIT ---
window.toggleDailyEditMode = function() {
    window.isDailyEditing = !window.isDailyEditing;
    const fab = document.getElementById('dailyFab');
    const card = document.getElementById('dailyInfoCard');
    
    if (window.isDailyEditing) {
        // Auto Lock hari yang lagi tampil
        window.editingDay = window.currentViewDay;
        
        fab.innerHTML = `<div style="display:flex; flex-direction:column; gap:10px;">
             <button class="fab-daily btn-save" onclick="saveAllDrafts()"><i class="fa-solid fa-check"></i></button>
             <button class="fab-daily btn-cancel" onclick="toggleDailyEditMode()"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
        card.classList.add('edit-mode-on');
        initDailyCard();
    } else {
        if (Object.keys(window.dailyDrafts).length > 0 && !confirm("Batalkan perubahan?")) {
            window.isDailyEditing = true; return;
        }
        window.dailyDrafts = {}; window.editingDay = null;
        fab.innerHTML = `<button class="fab-daily btn-edit" onclick="toggleDailyEditMode()"><i class="fa-solid fa-pen"></i></button>`;
        card.classList.remove('edit-mode-on');
        applyEditMode(false);
        initDailyCard();
    }
}

function applyEditMode(isActive) {
    document.querySelectorAll('.editable-text').forEach(el => {
        el.contentEditable = isActive;
        if (isActive) el.classList.add('editable-active');
        else el.classList.remove('editable-active');
    });
    document.getElementById('btnAddLesson').style.display = isActive ? 'block' : 'none';
    document.getElementById('btnAddPicket').style.display = isActive ? 'block' : 'none';
    document.getElementById('dailyConfigPanel').style.display = isActive ? 'block' : 'none';
}

// --- 5. SAVE ALL (DB) ---
window.saveAllDrafts = async function() {
    const btn = document.querySelector('.btn-save');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    const user = JSON.parse(localStorage.getItem("user"));
    const CLASS_ID = user.class_id;

    saveToDraft(window.editingDay);
    const draftsArray = Object.values(window.dailyDrafts);

    // Save Config
    const isCustom = document.getElementById('editCustomToggle').checked;
    const isAuto = document.getElementById('editAutoToggle').checked;
    // Kalo lagi custom mode, forced_day jangan diubah (biarin hari terakhir manual)
    const currentForced = window.currentConfig.forced_day;
    const newForced = isCustom ? currentForced : (window.editingDay || currentForced);

    await supabase.from('daily_config').upsert({ 
        class_id: CLASS_ID, is_auto: isAuto, is_custom: isCustom, forced_day: newForced 
    });
    
    // Refresh Config Lokal
    window.currentConfig.is_custom = isCustom;
    window.currentConfig.is_auto = isAuto;

    // Save Schedules
    if (draftsArray.length > 0) {
        for (let draft of draftsArray) {
            const { data: existing } = await supabase.from('daily_schedules')
                .select('id').eq('class_id', CLASS_ID).eq('day_name', draft.day_name).single();
            if (existing) await supabase.from('daily_schedules').update(draft).eq('id', existing.id);
            else await supabase.from('daily_schedules').insert(draft);
        }
    }

    window.dailyDrafts = {}; window.isDailyEditing = false; window.editingDay = null;
    document.getElementById('dailyFab').innerHTML = `<button class="fab-daily btn-edit" onclick="toggleDailyEditMode()"><i class="fa-solid fa-pen"></i></button>`;
    document.getElementById('dailyInfoCard').classList.remove('edit-mode-on');
    applyEditMode(false);
    if(typeof showPopup === 'function') showPopup("Data Tersimpan!", "success");
    initDailyCard();
}

window.deleteItem = function(el) { el.parentElement.remove(); autoSaveDraft(); }
window.addLessonRow = function() {
    const div = document.createElement('div'); div.className = 'tl-item-final';
    div.innerHTML = `<div class="btn-del-inline" onclick="deleteItem(this)"><i class="fa-solid fa-xmark"></i></div><div class="tl-time-final editable-text editable-active" contenteditable="true" data-type="time" oninput="autoSaveDraft()">00.00</div><div class="tl-marker-final"></div><div class="tl-subject-final editable-text editable-active" contenteditable="true" data-type="subject" oninput="autoSaveDraft()">Acara Baru</div>`;
    document.getElementById('timelineList').appendChild(div); autoSaveDraft();
}
window.addPicketRow = function() {
    const div = document.createElement('div'); div.className = 'picket-pill';
    div.innerHTML = `<div class="btn-del-inline" onclick="deleteItem(this)"><i class="fa-solid fa-xmark"></i></div><span class="editable-text editable-active" contenteditable="true" data-type="picket" oninput="autoSaveDraft()">Nama</span>`;
    document.getElementById('picketList').appendChild(div); autoSaveDraft();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(initDailyCard, 500));
else setTimeout(initDailyCard, 500);