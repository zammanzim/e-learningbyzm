async function initDailyCard() {
    const container = document.querySelector('.left-section');
    if (!container) return;

    // --- 0. CEK USER & KELAS ---
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || !user.class_id) {
        console.warn("User/Class ID not found for Daily Card");
        return;
    }
    const CLASS_ID = user.class_id; // ID Kelas User (Misal: 'X-RPL')

    // --- 1. CONFIG & WAKTU ---
    let config = { is_auto: true, forced_day: 'Senin' };
    let dayName = 'Senin';
    let labelWaktu = 'HARI INI';
    let fullDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    try {
        if (typeof supabase !== 'undefined') {
            // Fetch Config PER KELAS
            const { data: conf } = await supabase.from('daily_config')
                .select('*')
                .eq('id', 1)
                .eq('class_id', CLASS_ID) // Filter Kelas
                .single();

            if (conf) config = conf;
            else {
                // Kalo config kelas ini belum ada, buat default
                await supabase.from('daily_config').insert({ id: 1, class_id: CLASS_ID, is_auto: true, forced_day: 'Senin' });
            }

            const now = new Date();
            if (config.is_auto) {
                if (now.getHours() >= 15) { now.setDate(now.getDate() + 1); labelWaktu = "BESOK"; }
                const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                dayName = days[now.getDay()];
                fullDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            } else {
                dayName = config.forced_day; labelWaktu = "MANUAL"; fullDate = "-";
            }
        }
    } catch (e) { console.error("Config Error", e); }

    const dailyColors = {
        'Senin': 'linear-gradient(135deg, #ff4757, #ff6b81)', 'Selasa': 'linear-gradient(135deg, #5f27cd, #341f97)',
        'Rabu': 'linear-gradient(135deg, #0be881, #00d2d3)', 'Kamis': 'linear-gradient(135deg, #ffa502, #ff7f50)',
        'Jumat': 'linear-gradient(135deg, #ffffff, #dcdde1)', 'Sabtu': 'linear-gradient(135deg, #ff9ff3, #feca57)',
        'Minggu': 'linear-gradient(135deg, #54a0ff, #00d2d3)'
    };
    const themeColor = dailyColors[dayName] || dailyColors['Senin'];
    const textColor = dayName === 'Jumat' ? '#333' : '#fff';

    // --- 2. RENDER KERANGKA ---
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
                        <span class="final-badge">${labelWaktu}</span>
                        <h2 class="final-day">${dayName}</h2>
                        <small class="final-date">${fullDate}</small>
                    </div>
                    <div class="task-shortcut-box" onclick="window.location.href='tugas.html'">
                        <i class="fa-solid fa-clipboard-list"></i>
                        <span>TUGAS</span>
                    </div>
                </div>
                <div id="dcContentFinal" class="final-content">
                    <p style="text-align:center; padding:20px;">Loading Data...</p>
                </div>
                <div id="dailyConfigPanel" class="config-panel">
                    <h4 style="margin-bottom:10px; font-size:12px; color:#aaa; text-transform:uppercase;">Pengaturan Admin (${CLASS_ID})</h4>
                    <div style="margin-bottom:15px;">
                        <label style="font-size:12px; display:block; margin-bottom:5px;">Pilih Hari (Untuk diedit)</label>
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
                <div class="final-watermark">v14 Multi-Class</div>
            </div>
        `;
        const welcome = document.getElementById('welcomeText');
        if (welcome) welcome.insertAdjacentHTML('afterend', cardHTML);
        else container.innerHTML += cardHTML;
    }

    // --- 3. FETCH CONTENT PER KELAS ---
    try {
        const targetDay = window.editingDay || dayName;

        // Fetch Data dengan Filter CLASS_ID
        const { data, error } = await supabase.from('daily_schedules')
            .select('*')
            .eq('day_name', targetDay)
            .eq('class_id', CLASS_ID) // Filter Penting!
            .single();

        const contentEl = document.getElementById('dcContentFinal');

        // Kalau data belum ada buat kelas ini, kasih opsi buat copy/init
        if (error || !data) {
            contentEl.innerHTML = `
                <div class="dc-empty-state" style="text-align:center; padding:20px;">
                    <i class="fa-solid fa-folder-open" style="font-size:30px; margin-bottom:10px; color:#aaa;"></i>
                    <p>Data kelas <b>${CLASS_ID}</b> untuk hari <b>${targetDay}</b> belum ada.</p>
                    ${user.role === 'class_admin' ? '<p style="font-size:12px; color:#00eaff;">Klik tombol Edit untuk membuat data baru.</p>' : ''}
                </div>`;
            return;
        }

        // Setup Controls
        const daySel = document.getElementById('editDaySelector');
        const autoTog = document.getElementById('editAutoToggle');
        if (daySel && !window.editingDay) {
            daySel.value = config.is_auto ? dayName : config.forced_day;
            autoTog.checked = config.is_auto;
            daySel.onchange = (e) => { window.editingDay = e.target.value; initDailyCard(); };
        }

        // --- PARSING DATA (Sama) ---
        let timelineHTML = '';
        if (data.lessons) {
            data.lessons.split(/,|\n/).map(i => i.trim()).filter(i => i.length > 1).forEach((item, idx) => {
                let [time, subject] = item.includes('-') ? item.split('-') : ["", item];
                timelineHTML += `
                    <div class="tl-item-final animate-slide-right" style="animation-delay:${idx * 0.05}s">
                        <div class="btn-del-inline" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></div>
                        <div class="tl-time-final editable-text" data-type="time">${time.trim()}</div>
                        <div class="tl-marker-final"></div>
                        <div class="tl-subject-final editable-text" data-type="subject">${subject.trim()}</div>
                    </div>`;
            });
        }

        let picketHTML = '';
        if (data.picket) {
            data.picket.split(/,|\n/).forEach((n, i) => {
                const name = n.trim();
                if (name) picketHTML += `
                    <div class="picket-pill animate-pop-up" style="animation-delay:${0.2 + (i * 0.05)}s">
                        <div class="btn-del-inline" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></div>
                        <span class="editable-text" data-type="picket">${name}</span>
                    </div>`;
            });
        }

        contentEl.innerHTML = `
            <div class="top-cards-grid">
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}">
                    <div class="card-icon"><i class="fa-solid fa-shirt"></i></div>
                    <div class="card-meta"><span class="card-label" style="color:${textColor}">Seragam</span>
                    <span class="card-val editable-text" data-type="uniform">${data.uniform}</span></div>
                </div>
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}; animation-delay:0.1s">
                    <div class="card-icon"><i class="fa-solid fa-person-running"></i></div>
                    <div class="card-meta"><span class="card-label" style="color:${textColor}">Kegiatan</span>
                    <span class="card-val editable-text" data-type="activity">${data.activity || 'KBM Normal'}</span></div>
                </div>
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}; animation-delay:0.2s">
                    <div class="card-icon"><i class="fa-solid fa-note-sticky"></i></div>
                    <div class="card-meta"><span class="card-label" style="color:${textColor}">Catatan</span>
                    <span class="card-val small editable-text" data-type="notes">${data.notes}</span></div>
                </div>
            </div>
            <div class="final-spacer"></div>
            <div class="final-section">
                <h4 class="final-title"><i class="fa-regular fa-clock"></i> Jadwal Pelajaran</h4>
                <div class="final-timeline" id="timelineList">${timelineHTML}</div>
                <button class="btn-add-inline" id="btnAddLesson" style="display:none;" onclick="addLessonRow()">+ Tambah Pelajaran</button>
            </div>
            <div class="final-spacer"></div>
            <div class="final-section">
                <h4 class="final-title"><i class="fa-solid fa-broom"></i> Petugas Piket</h4>
                <div class="picket-grid-big" id="picketList">${picketHTML}</div>
                <button class="btn-add-inline" id="btnAddPicket" style="display:none;" onclick="addPicketRow()">+ Tambah Petugas</button>
            </div>
        `;

        if (window.isDailyEditing) applyEditMode(true);

    } catch (e) { console.error(e); }
}

// --- 4. TOGGLE EDIT ---
window.toggleDailyEditMode = function () {
    window.isDailyEditing = !window.isDailyEditing;
    const fab = document.getElementById('dailyFab');
    const card = document.getElementById('dailyInfoCard');

    if (window.isDailyEditing) {
        fab.innerHTML = `<div style="display:flex; flex-direction:column; gap:10px;">
             <button class="fab-daily btn-save" onclick="saveDailyInline()"><i class="fa-solid fa-check"></i></button>
             <button class="fab-daily btn-cancel" onclick="toggleDailyEditMode()"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
        card.classList.add('edit-mode-on');
        applyEditMode(true);
    } else {
        fab.innerHTML = `<button class="fab-daily btn-edit" onclick="toggleDailyEditMode()"><i class="fa-solid fa-pen"></i></button>`;
        card.classList.remove('edit-mode-on');
        applyEditMode(false);
        window.editingDay = null;
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

window.addLessonRow = function () {
    const div = document.createElement('div');
    div.className = 'tl-item-final';
    div.innerHTML = `<div class="btn-del-inline" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></div><div class="tl-time-final editable-text editable-active" contenteditable="true">00.00</div><div class="tl-marker-final"></div><div class="tl-subject-final editable-text editable-active" contenteditable="true">Mapel Baru</div>`;
    document.getElementById('timelineList').appendChild(div);
}

window.addPicketRow = function () {
    const div = document.createElement('div');
    div.className = 'picket-pill';
    div.innerHTML = `<div class="btn-del-inline" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></div><span class="editable-text editable-active" contenteditable="true">Nama</span>`;
    document.getElementById('picketList').appendChild(div);
}

// --- 5. SAVE WITH CLASS_ID ---
window.saveDailyInline = async function () {
    const btn = document.querySelector('.btn-save');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const user = JSON.parse(localStorage.getItem("user"));
    const CLASS_ID = user.class_id;

    // Data Gathering
    let lessonArr = [];
    document.querySelectorAll('.tl-item-final').forEach(row => {
        const time = row.querySelector('[data-type="time"]').innerText.trim();
        const subj = row.querySelector('[data-type="subject"]').innerText.trim();
        if (subj) lessonArr.push(`${time} - ${subj}`);
    });

    let picketArr = [];
    document.querySelectorAll('.picket-pill span').forEach(el => { if (el.innerText.trim()) picketArr.push(el.innerText.trim()); });

    const uniform = document.querySelector('[data-type="uniform"]').innerText.trim();
    const notes = document.querySelector('[data-type="notes"]').innerText.trim();
    const activity = document.querySelector('[data-type="activity"]').innerText.trim();
    const targetDay = document.getElementById('editDaySelector').value;
    const isAuto = document.getElementById('editAutoToggle').checked;

    // UPSERT (Insert kalau belum ada, Update kalau ada)
    // Supabase butuh Unique Key (day_name, class_id) kalau mau upsert tanpa ID
    // Solusi gampang: Cek dulu ada ga, baru update/insert

    const { data: existing } = await supabase.from('daily_schedules')
        .select('id').eq('day_name', targetDay).eq('class_id', CLASS_ID).single();

    if (existing) {
        await supabase.from('daily_schedules').update({
            uniform, lessons: lessonArr.join(', '), picket: picketArr.join(', '), notes, activity
        }).eq('id', existing.id);
    } else {
        await supabase.from('daily_schedules').insert({
            day_name: targetDay, class_id: CLASS_ID, uniform, lessons: lessonArr.join(', '), picket: picketArr.join(', '), notes, activity
        });
    }

    // Config juga per kelas
    await supabase.from('daily_config').upsert({ id: 1, class_id: CLASS_ID, is_auto: isAuto, forced_day: targetDay });

    window.isDailyEditing = false; window.editingDay = null;
    document.getElementById('dailyFab').innerHTML = `<button class="fab-daily btn-edit" onclick="toggleDailyEditMode()"><i class="fa-solid fa-pen"></i></button>`;
    document.getElementById('dailyInfoCard').classList.remove('edit-mode-on');
    applyEditMode(false);

    if (typeof showPopup === 'function') showPopup("Jadwal Kelas Tersimpan!", "success");
    else alert("Tersimpan!");
    initDailyCard();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(initDailyCard, 500));
else setTimeout(initDailyCard, 500);