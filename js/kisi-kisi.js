// ============================================================
// kisi-kisi.js — Kisi-Kisi PSTS
// Hooks into SubjectApp (subject-manager.js) for admin/modal,
// but overrides renderAnnouncements with day-grouped logic.
// ============================================================

const PSTS_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis'];
let kisiScheduleMap = {};  // { Senin: ['bindonesia', 'mtk', ...], ... }
let kisiFilter = 'all';    // currently selected subject filter

// ── Helpers ──────────────────────────────────────────────────

function _kisiNorm(str) {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

/**
 * "Kisi - Kisi Bahasa Indonesia"  →  "Bahasa Indonesia"
 * Falls back to the full title if no pattern matches.
 */
function _extractSubject(bigTitle) {
    if (!bigTitle) return '';
    const m = bigTitle.match(/kisi\s*[-–—]\s*kisi\s+(.+)/i);
    return m ? m[1].trim() : bigTitle.trim();
}

/**
 * Returns PSTS_DAYS reordered so today (or tomorrow if >=15:00) is first.
 * Past days are pushed to the end, weekend defaults to Senin first.
 */
function _getDayOrder() {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    let todayName = dayNames[now.getDay()];
    if (now.getHours() >= 15) {
        const tom = new Date(now);
        tom.setDate(now.getDate() + 1);
        todayName = dayNames[tom.getDay()];
    }
    const idx = PSTS_DAYS.indexOf(todayName);
    if (idx === -1) return [...PSTS_DAYS]; // weekend -> default order
    return [...PSTS_DAYS.slice(idx), ...PSTS_DAYS.slice(0, idx)];
}

/**
 * Returns which PSTS day this kisi item belongs to,
 * by matching the extracted subject against scheduleMap.
 */
function _getDayForItem(item) {
    const subject = _kisiNorm(_extractSubject(item.big_title || ''));
    if (subject.length < 2) return null;
    for (const day of PSTS_DAYS) {
        const daySubjects = kisiScheduleMap[day] || [];
        if (daySubjects.some(s => s.length > 1 && (subject.includes(s) || s.includes(subject)))) {
            return day;
        }
    }
    return null;
}

// ── Main Render ───────────────────────────────────────────────

window.renderKisiList = function () {
    const items = SubjectApp.state.announcements;
    const container = document.getElementById('announcements');
    if (!container) return;
    container.innerHTML = '';

    // ── Subject filter dropdown ──────────────────────────────
    const subjects = [...new Set(
        items.map(k => _extractSubject(k.big_title || '')).filter(Boolean)
    )];

    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:22px;';
    filterBar.innerHTML = `
        <i class="fa-solid fa-filter" style="color:#00eaff; font-size:14px;"></i> Pilih Pelajaran
        <select id="kisiSubjectFilter"
            onchange="kisiFilter = this.value; renderKisiList();"
            style="flex:1; background:rgba(255,255,255,0.08); color:white;
                   border:1px solid rgba(0,234,255,0.3); padding:9px 15px;
                   border-radius:20px; font-size:13px; outline:none; cursor:pointer;
                   appearance:none; -webkit-appearance:none;">
            <option value="all">Semua Pelajaran</option>
            ${subjects.map(s => `<option value="${_kisiNorm(s)}">${s}</option>`).join('')}
        </select>
    `;
    container.appendChild(filterBar);

    // ── Filter items ─────────────────────────────────────────
    const filtered = kisiFilter === 'all'
        ? items
        : items.filter(k => _kisiNorm(_extractSubject(k.big_title || '')) === kisiFilter);

    // ── Group by day ─────────────────────────────────────────
    const grouped = {};
    const unassigned = [];
    filtered.forEach(item => {
        const day = _getDayForItem(item);
        if (day) {
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(item);
        } else {
            unassigned.push(item);
        }
    });

    const dayOrder = _getDayOrder();
    const todayInOrder = dayOrder[0]; // hari pertama di urutan = "hari ini"

    // ── Render each day section ──────────────────────────────
    let renderedCount = 0;
    dayOrder.forEach(function (day) {
        const dayItems = grouped[day] || [];

        // Kalau filter aktif dan hari ini kosong -> skip seluruh section
        if (kisiFilter !== 'all' && dayItems.length === 0) return;

        const isToday = day === todayInOrder;
        const isFirst = renderedCount === 0;

        const divEl = document.createElement('div');
        divEl.style.cssText = 'margin:' + (isFirst ? '4px' : '36px') + ' 0 16px;';

        const todayBadge = isToday
            ? '<span style="font-size:11px; background:rgba(0,234,255,0.15); border:1px solid rgba(0,234,255,0.5); border-radius:12px; padding:2px 10px; margin-left:10px; vertical-align:middle; font-weight:700; letter-spacing:1px;">HARI INI</span>'
            : '';

        const lineColor = isToday
            ? 'linear-gradient(to right, rgba(0,234,255,0.6), transparent)'
            : 'linear-gradient(to right, rgba(255,255,255,0.2), transparent)';

        const textColor = isToday ? '#00eaff' : 'rgba(255,255,255,0.7)';
        const textShadow = isToday ? 'text-shadow: 0 0 16px rgba(0,234,255,0.6);' : '';
        const fontSize = isToday ? '22px' : '18px';

        divEl.innerHTML =
            '<div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">' +
            '<span style="font-size:' + fontSize + '; font-weight:900; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; color:' + textColor + '; ' + textShadow + '">'
            + day + todayBadge +
            '</span>' +
            '<div style="flex:1; height:2px; border-radius:2px; background:' + lineColor + ';"></div>' +
            '</div>';

        container.appendChild(divEl);

        if (dayItems.length === 0) {
            // Hanya muncul kalau filter = 'all'
            const emptyEl = document.createElement('p');
            emptyEl.style.cssText = 'color:rgba(255,255,255,0.3); font-size:12px; margin:4px 0 0; padding-left:2px; font-style:italic;';
            emptyEl.textContent = 'Belum ada kisi-kisi untuk hari ini';
            container.appendChild(emptyEl);
        } else {
            dayItems.forEach(function (item) {
                const card = SubjectApp.createCardElement(item);
                card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
                container.appendChild(card);
            });
        }

        renderedCount++;
    });

    // ── Unassigned items (subject not matched to any day) ────
    if (unassigned.length > 0) {
        const uDivEl = document.createElement('div');
        uDivEl.style.cssText = 'display:flex; align-items:center; gap:12px; margin:' + (renderedCount > 0 ? '28px' : '0') + ' 0 14px;';
        uDivEl.innerHTML =
            '<span style="font-size:13px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; color:#ffd700;">Lainnya</span>' +
            '<div style="flex:1; height:1px; background:linear-gradient(to right, rgba(255,215,0,0.4), transparent);"></div>';
        container.appendChild(uDivEl);
        unassigned.forEach(function (item) {
            const card = SubjectApp.createCardElement(item);
            card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
            container.appendChild(card);
        });
    }

    // Restore selected filter value (since we rebuild the whole DOM)
    const sel = document.getElementById('kisiSubjectFilter');
    if (sel) sel.value = kisiFilter;
};

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Patch SubjectApp.renderAnnouncements BEFORE init() is called.
    SubjectApp.renderAnnouncements = window.renderKisiList;

    // 2. After delete, re-render so empty day sections clean up properly.
    const _origDelete = SubjectApp.deleteAnnouncement.bind(SubjectApp);
    SubjectApp.deleteAnnouncement = async function (card) {
        await _origDelete(card);
        window.renderKisiList();
    };

    // 3. Fetch PSTS schedule (Senin-Kamis) for day mapping.
    let user = null;
    try { user = JSON.parse(localStorage.getItem("user")); } catch (e) { }

    if (user && user.class_id) {
        try {
            const { data: schedules } = await supabase
                .from('daily_schedules')
                .select('day_name, lessons')
                .eq('class_id', user.class_id)
                .in('day_name', PSTS_DAYS);

            kisiScheduleMap = {};
            (schedules || []).forEach(function (s) {
                // Format: "07.30 - 08.30 - PABP; 10.00 - 11.00 - Bahasa Indonesia"
                // Pakai ';' sebagai pemisah, subject = bagian setelah '-' terakhir
                kisiScheduleMap[s.day_name] = (s.lessons || '')
                    .split(';')
                    .map(function (raw) {
                        raw = raw.trim();
                        const dashIdx = raw.lastIndexOf('-');
                        const name = dashIdx !== -1 ? raw.substring(dashIdx + 1).trim() : raw;
                        return _kisiNorm(name);
                    })
                    .filter(function (n) { return n.length > 1; });
            });
        } catch (e) {
            console.error('Gagal ambil jadwal kisi-kisi:', e);
        }
    }

    // 4. Init SubjectApp
    SubjectApp.init(
        'kisi-kisi',
        '<h3><i class="fa-solid fa-clipboard-list"></i> Kisi-Kisi PSTS</h3>',
        'Kisi-Kisi PSTS',
        false  // isLessonMode = false -> no task/selesai button
    );
});