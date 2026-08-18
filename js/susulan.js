// ============================================================
// susulan.js — Materi Susulan
// Hooks into SubjectApp (subject-manager.js) for admin/modal,
// but overrides renderAnnouncements with day-grouped logic
// (Senin - Jumat). Urutan card ngikut jadwal utama daily card.
// ============================================================

const SUSULAN_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

// Kata-kata yang bukan nama pelajaran, di-skip dari jadwal
const SUSULAN_BLACKLIST = [
    'istirahat', 'upacara', 'senampagi', 'senam', 'pulang', 'sholat',
    'shalat', 'jumatan', 'makan', 'ishoma', 'ekskul', 'pembiasaan',
    'literasi', 'bersih', 'piket', 'dhuha', 'dzuhur', 'duhur', 'ashar',
    'masuk', 'apel', 'persiapkan', 'cektugas',
];

let susulanScheduleMap = {}; // { Senin: { lessons: [{norm, display}, ...] }, ... }
let SUSULAN_SUBJECTS = [];   // [{norm, display}] — urut sesuai urutan jadwal mingguan
let susulanFilter = 'all';   // filter pelajaran aktif

function _susulanNorm(str) {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

// ── Card Controls (edit mode): pindah hari + pindah pelajaran ─

function _addCardControls(card, item) {
    if (card.querySelector('.susulan-day-select')) return;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;';

    const daySel = document.createElement('select');
    daySel.className = 'susulan-day-select';
    daySel.dataset.field = 'susulan_day';
    daySel.innerHTML = SUSULAN_DAYS
        .map(d => `<option value="${d}">${t(d.toLowerCase())}</option>`)
        .join('');
    daySel.value = item.susulan_day || 'Senin';
    daySel.onchange = () => SubjectApp.changeSusulanDay(item.id, daySel.value);

    const subjSel = document.createElement('select');
    subjSel.className = 'susulan-subject-select';
    subjSel.dataset.field = 'susulan_subject';
    const opts = ['<option value="">-</option>'];
    SUSULAN_SUBJECTS.forEach(s => {
        const label = t(s.norm) !== s.norm ? t(s.norm) : s.display;
        opts.push(`<option value="${s.display.replace(/"/g, '&quot;')}">${label}</option>`);
    });
    // Item yang pelajarannya di luar jadwal tetep tampil biar ga hilang
    const itemNorm = _susulanNorm(item.susulan_subject || '');
    if (itemNorm && !SUSULAN_SUBJECTS.some(s => s.norm === itemNorm)) {
        opts.push(`<option value="${item.susulan_subject.replace(/"/g, '&quot;')}">${item.susulan_subject}</option>`);
    }
    subjSel.innerHTML = opts.join('');
    subjSel.value = item.susulan_subject || '';
    subjSel.onchange = () => SubjectApp.changeSusulanSubject(item.id, subjSel.value);

    [daySel, subjSel].forEach(sel => {
        sel.style.cssText = `
            background: rgba(0,234,255,0.08); color:#fff;
            border:1px solid rgba(0,234,255,0.35); border-radius:20px;
            padding:6px 12px; font-size:12px; outline:none; cursor:pointer;
            appearance:none; -webkit-appearance:none;
        `;
        row.appendChild(sel);
    });

    card.querySelector('.card-actions')?.insertAdjacentElement('beforebegin', row);
}

// Re-apply edit mode ke card-card baru setelah render ulang
function _reapplyEditMode() {
    document.querySelectorAll(".course-card").forEach(function (card) {
        card.classList.add("editable-mode");
        card.querySelectorAll(".editable").forEach(function (f) {
            f.contentEditable = "true";
            f.style.pointerEvents = "auto";
            f.style.cursor = "text";
        });
        const deleteBtn = card.querySelector(".delete-btn");
        const colorTools = card.querySelector(".card-color-tools");
        const formatTools = card.querySelector(".card-format-tools");
        const reorderHandle = card.querySelector(".reorder-handle");
        const cameraBtn = card.querySelector(".camera-btn");
        if (deleteBtn) deleteBtn.style.display = "inline-block";
        if (colorTools) colorTools.style.display = "flex";
        if (formatTools) formatTools.style.display = "flex";
        if (reorderHandle) reorderHandle.style.display = "none";
        if (cameraBtn) cameraBtn.style.display = "flex";
    });
}

// Setelah createCardElement di edit mode, bongkar code block + link biar
// bisa diedit penuh (createCardElement nge-apply wrapper code block)
function _unwrapForEdit(card) {
    const contentEl = card.querySelector('[data-field="content"]');
    if (contentEl) contentEl.innerHTML = revertCodeBlocks(revertCardLinks(contentEl.innerHTML));
}

// ── Urutan card ngikut jadwal harian ─────────────────────────

function _sortBySchedule(dayItems, day) {
    const dayLessons = (susulanScheduleMap[day] && susulanScheduleMap[day].lessons) || [];
    const idxOf = item => {
        const norm = _susulanNorm(item.susulan_subject || '');
        const idx = dayLessons.findIndex(e => e.norm === norm);
        return idx === -1 ? 1000 : idx;
    };
    return [...dayItems].sort((a, b) => idxOf(a) - idxOf(b));
}

// ── Main Render ─────────────────────────────────────────────

window.renderSusulanList = function () {
    const items = SubjectApp.state.announcements;
    const container = document.getElementById('announcements');
    if (!container) return;

    const header = document.createElement('h3');
    header.style.marginTop = "30px";
    header.textContent = t('susulan');

    if (items.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.innerHTML = `
            <i class="fa-solid fa-book-open-reader"></i>
            <p>${t('no_susulan')}</p>
        `;
        container.replaceChildren(header, emptyState);
        return;
    }

    // ── Filter bar: pilih pelajaran ──────────────────────────
    const availableSubjects = new Set(
        items.map(i => _susulanNorm(i.susulan_subject || '')).filter(Boolean)
    );
    let optionsHTML = SUSULAN_SUBJECTS.map(s => {
        const label = t(s.norm) !== s.norm ? t(s.norm) : s.display;
        if (availableSubjects.has(s.norm)) {
            return `<option value="${s.norm}">${label}</option>`;
        }
        return `<option value="${s.norm}" disabled style="color:rgba(255,255,255,0.3);">${label} ${t('not_yet_available')}</option>`;
    }).join('');
    // Item yang pelajarannya ga ada di jadwal, tetep jadi opsi filter
    items.forEach(i => {
        const norm = _susulanNorm(i.susulan_subject || '');
        if (norm && !SUSULAN_SUBJECTS.some(s => s.norm === norm)) {
            optionsHTML += `<option value="${norm}">${i.susulan_subject}</option>`;
        }
    });

    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:22px; flex-wrap:wrap;';
    filterBar.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:200px;">
            <i class="fa-solid fa-filter" style="color:var(--accent, #00eaff); font-size:14px;"></i> ${t('choose_lesson')}
            <select id="susulanSubjectFilter"
                onchange="susulanFilter = this.value; renderSusulanList();"
                style="flex:1; background:rgba(255,255,255,0.08); color:white;
                    border:1px solid rgba(0, 234, 255, 0.3); padding:9px 15px;
                    border-radius:20px; font-size:13px; outline:none; cursor:pointer;
                    appearance:none; -webkit-appearance:none;">
                <option value="all">${t('all_lessons')}</option>
                ${optionsHTML}
            </select>
        </div>
    `;

    // ── Filter items ─────────────────────────────────────────
    const filtered = susulanFilter === 'all'
        ? items
        : items.filter(i => _susulanNorm(i.susulan_subject || '') === susulanFilter);

    // ── Group by day ─────────────────────────────────────────
    const grouped = {};
    const unassigned = [];
    filtered.forEach(item => {
        const day = item.susulan_day || '';
        if (SUSULAN_DAYS.includes(day)) {
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(item);
        } else {
            unassigned.push(item);
        }
    });

    const dayOrder = SUSULAN_DAYS;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(header);
    fragment.appendChild(filterBar);

    // ── Render setiap hari (Senin - Jumat, urut tetap) ───────
    dayOrder.forEach(function (day) {
        const dayItems = _sortBySchedule(grouped[day] || [], day);
        if (susulanFilter !== 'all' && dayItems.length === 0) return;

        const divEl = document.createElement('div');
        divEl.style.cssText = 'margin:24px 0 16px;';

        divEl.innerHTML =
            '<div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">' +
            '<span style="font-size:18px; font-weight:900; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; color:rgba(255,255,255,0.7);">'
            + t(day.toLowerCase()) +
            '</span>' +
            '<div style="flex:1; height:2px; border-radius:2px; background:linear-gradient(to right, rgba(255,255,255,0.2), transparent);"></div>' +
            '</div>';

        fragment.appendChild(divEl);

        if (dayItems.length === 0) {
            const emptyEl = document.createElement('p');
            emptyEl.style.cssText = 'color:rgba(255, 255, 255, 0.4); font-size:13px; margin:0 0 4px 2px; font-style:italic;';
            emptyEl.textContent = t('no_susulan');
            fragment.appendChild(emptyEl);
        } else {
            dayItems.forEach(function (item) {
                // Clone + matiin is_task biar tombol/badge tugas ga muncul di sini
                const displayItem = { ...item, is_task: false };
                const card = SubjectApp.createCardElement(displayItem);
                card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
                if (SubjectApp.state.editMode) { _unwrapForEdit(card); _addCardControls(card, item); }
                fragment.appendChild(card);
            });
        }
    });

    // ── Belum ada hari (unassigned) ──────────────────────────
    if (unassigned.length > 0) {
        const uDivEl = document.createElement('div');
        uDivEl.style.cssText = 'display:flex; align-items:center; gap:12px; margin:28px 0 14px;';
        uDivEl.innerHTML =
            `<span style="font-size:13px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; color:#ffd700;">${t('other')}</span>` +
            '<div style="flex:1; height:1px; background:linear-gradient(to right, rgba(255,215,0,0.4), transparent);"></div>';
        fragment.appendChild(uDivEl);

        unassigned.forEach(function (item) {
            const displayItem = { ...item, is_task: false };
            const card = SubjectApp.createCardElement(displayItem);
            card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
            if (SubjectApp.state.editMode) { _unwrapForEdit(card); _addCardControls(card, item); }
            fragment.appendChild(card);
        });
    }

    container.replaceChildren(fragment);

    const sel = document.getElementById('susulanSubjectFilter');
    if (sel) sel.value = susulanFilter;

    _renderLegend();
};

// ── Legend ringkasan jumlah materi per hari (left-section) ──

function _renderLegend() {
    const el = document.getElementById('susulanLegend');
    if (!el) return;
    const items = SubjectApp.state.announcements || [];
    const count = d => items.filter(i => i.susulan_day === d).length;
    el.innerHTML = SUSULAN_DAYS.map(day => `
        <div style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:rgba(255,255,255,0.06); border-radius:12px; margin-bottom:6px; border:1px solid rgba(255,255,255,0.08);">
            <i class="fa-solid fa-calendar-day" style="color:var(--accent, #00eaff); font-size:12px;"></i>
            <span style="font-size:13px; color:#fff; font-weight:600; flex:1;">${t(day.toLowerCase())}</span>
            <span style="font-size:11px; font-weight:800; color:${count(day) ? 'var(--accent, #00eaff)' : 'rgba(255,255,255,0.3)'};">${count(day)}</span>
        </div>`).join('');
}

// ── Pindah hari (edit mode) — langsung simpen ke DB ─────────

SubjectApp.changeSusulanDay = async function (id, day) {
    try {
        const { error } = await supabase.from('subject_announcements').update({ susulan_day: day }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Gagal simpan hari susulan:', err);
        showPopup(t('failed_save_data'), 'error');
        return;
    }

    const ann = this.state.announcements.find(a => String(a.id) === String(id));
    if (ann) ann.susulan_day = day;

    showToast(t('data_saved'), 'success');
    window.renderSusulanList();
    if (SubjectApp.state.editMode) _reapplyEditMode();
};

// ── Pindah pelajaran (edit mode) — langsung simpen ke DB ─────

SubjectApp.changeSusulanSubject = async function (id, subject) {
    try {
        const { error } = await supabase.from('subject_announcements').update({ susulan_subject: subject || null }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Gagal simpan mapel susulan:', err);
        showPopup(t('failed_save_data'), 'error');
        return;
    }

    const ann = this.state.announcements.find(a => String(a.id) === String(id));
    if (ann) ann.susulan_subject = subject || null;

    showToast(t('data_saved'), 'success');
    window.renderSusulanList();
    if (SubjectApp.state.editMode) _reapplyEditMode();
};

// ── Toggle visibilitas pilihan susulan di modal ─────────────

function _populateSubjectSelect() {
    const sel = document.getElementById('susulanSubjectSelect');
    if (!sel || sel.options.length > 1) return;
    const html = ['<option value="">-</option>'].concat(
        SUSULAN_SUBJECTS.map(s => {
            const label = t(s.norm) !== s.norm ? t(s.norm) : s.display;
            return `<option value="${s.display.replace(/"/g, '&quot;')}">${label}</option>`;
        })
    ).join('');
    sel.innerHTML = html;
}

function _updateSusulanWrap() {
    const dayWrap = document.getElementById('susulanDayWrap');
    const subjWrap = document.getElementById('susulanSubjectWrap');
    const dest = document.getElementById('addDestPage');
    if (!dayWrap || !dest) return;
    _populateSubjectSelect();
    const isSusulanPage = SubjectApp.state.subjectId === 'susulan';
    const show = isSusulanPage || dest.value === 'susulan';
    dayWrap.style.display = show ? 'block' : 'none';
    if (subjWrap) subjWrap.style.display = show ? 'block' : 'none';
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Patch renderer BEFORE init() dipanggil
    SubjectApp.renderAnnouncements = window.renderSusulanList;

    // 2. Ambil jadwal utama (daily card) buat urutan & daftar pelajaran
    let user = null;
    try { user = JSON.parse(localStorage.getItem("user")); } catch (e) { }

    if (user) {
        try {
            const classId = getEffectiveClassId() || user.class_id;
            const { data: schedules } = await supabase
                .from('daily_schedules')
                .select('day_name, lessons')
                .eq('class_id', classId)
                .eq('type', 'regular')
                .in('day_name', SUSULAN_DAYS);

            susulanScheduleMap = {};
            (schedules || []).forEach(function (s) {
                susulanScheduleMap[s.day_name] = {
                    lessons: (s.lessons || '')
                        .split(';')
                        .map(function (raw) {
                            raw = raw.trim();
                            const dashIdx = raw.lastIndexOf('-');
                            const name = dashIdx !== -1 ? raw.substring(dashIdx + 1).trim() : raw;
                            return { norm: _susulanNorm(name), display: name };
                        })
                        .filter(function (n) { return n.norm.length > 1 && !SUSULAN_BLACKLIST.some(b => n.norm.includes(b)); })
                };
            });

            // Daftar pelajaran unik, urut sesuai urutan jadwal mingguan
            SUSULAN_SUBJECTS = [];
            const seen = new Set();
            SUSULAN_DAYS.forEach(day => {
                (susulanScheduleMap[day]?.lessons || []).forEach(e => {
                    if (!seen.has(e.norm)) {
                        seen.add(e.norm);
                        SUSULAN_SUBJECTS.push(e);
                    }
                });
            });
        } catch (e) {
            console.error('Gagal ambil jadwal susulan:', e);
        }
    }

    // 3. Init SubjectApp
    SubjectApp.init(
        'susulan',
        `<h3><i class="fa-solid fa-book-open-reader"></i> ${t('susulan')}</h3>`,
        t('susulan'),
        false  // isLessonMode = false -> no task/selesai button
    );

    // 4. Posting dari modal — bawa hari + pelajaran yang dipilih
    const _origUpload = SubjectApp.uploadAndSave.bind(SubjectApp);
    SubjectApp.uploadAndSave = async function (d) {
        d.susulanDay = document.getElementById('susulanDaySelect')?.value || null;
        d.susulanSubject = document.getElementById('susulanSubjectSelect')?.value || null;
        return _origUpload(d);
    };

    // 5. Reset pilihan abis posting
    const _origClear = SubjectApp.clearForm.bind(SubjectApp);
    SubjectApp.clearForm = function () {
        _origClear();
        const daySel = document.getElementById('susulanDaySelect');
        if (daySel) daySel.value = 'Senin';
        const subjSel = document.getElementById('susulanSubjectSelect');
        if (subjSel) subjSel.value = '';
        _updateSusulanWrap();
    };

    // 6. Toggle edit mode — render ulang biar control muncul/hilang
    const _origToggle = SubjectApp.toggleEditMode.bind(SubjectApp);
    SubjectApp.toggleEditMode = async function () {
        await _origToggle();
        window.renderSusulanList();
        if (SubjectApp.state.editMode) _reapplyEditMode();
    };

    // 7. Wrap di modal: tampil di halaman susulan / pas dest dipilih susulan
    document.addEventListener('click', (e) => {
        if (e.target.closest('#addAnnouncementBtn')) setTimeout(_updateSusulanWrap, 80);
    });
    document.addEventListener('change', (e) => {
        if (e.target.id === 'addDestPage') _updateSusulanWrap();
    });
});