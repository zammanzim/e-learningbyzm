// ============================================================
// SIDEBAR.JS — Standalone Sidebar Manager
// Fetch menu_groups + subjects_config, render berdasarkan
// tipe grup dan role user. Cache-first + realtime update.
// ============================================================

let _sidebarChannel = null;

// ── HELPERS ──────────────────────────────────────────────────
function getEffectiveClassId() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return null;
        if (user.role === 'super_admin') {
            const override = sessionStorage.getItem('class_override');
            if (override) return override;
        }
        return String(user.class_id);
    } catch(e) { return null; }
}

function getEffectiveClassName() {
    try {
        const override = sessionStorage.getItem('class_override_name');
        if (override) return override;
        const user = JSON.parse(localStorage.getItem('user'));
        return user?.class_name || `Kelas ${user?.class_id}` || '';
    } catch(e) { return ''; }
}

async function switchClass(classId, className) {
    if (classId === getEffectiveClassId()) return;
    sessionStorage.setItem('class_override', classId);
    sessionStorage.setItem('class_override_name', className);
    localStorage.removeItem(`sidebar_cache_${getEffectiveClassId()}`);
    window.location.reload();
}

function toggleClassSwitcher() {
    const menu = document.getElementById('classSwitcher');
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!document.getElementById('classSwitcherWrapper')?.contains(e.target)) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', handler);
                }
            });
        }, 10);
    }
}

async function renderClassSwitcher() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role !== 'super_admin') return;

    const switcher = document.getElementById('classSwitcher');
    const wrapper  = document.getElementById('classSwitcherWrapper');
    const label    = document.getElementById('classSwitcherLabel');
    if (!switcher || !wrapper) return;

    const { data: classes } = await supabase.from('classes').select('id, name').order('id');
    if (!classes?.length) return;

    const current = getEffectiveClassId();
    const cur = classes.find(c => String(c.id) === current);
    if (label) label.innerText = cur?.name || `Kelas ${current}`;

    switcher.innerHTML = classes.map(c => `
        <div onclick="switchClass('${c.id}','${c.name}')" style="
            padding:10px 14px; font-size:13px; cursor:pointer;
            color:${String(c.id)===current?'var(--accent,#00eaff)':'#ddd'};
            background:${String(c.id)===current?'rgba(0,234,255,0.08)':'transparent'};
            display:flex; align-items:center; gap:8px; transition:background 0.15s;"
            onmouseover="this.style.background='rgba(255,255,255,0.05)'"
            onmouseout="this.style.background='${String(c.id)===current?'rgba(0,234,255,0.08)':'transparent'}'">
            ${String(c.id)===current
                ? '<i class="fa-solid fa-check" style="font-size:10px;color:var(--accent,#00eaff);"></i>'
                : '<span style="width:12px;"></span>'}
            ${c.name}
        </div>`).join('');

    wrapper.style.display = 'flex';
}

// ── CACHE ─────────────────────────────────────────────────────
function getCacheKey(classId) { return `sidebar_cache_${classId}`; }

function readCache(classId) {
    try {
        const raw = localStorage.getItem(getCacheKey(classId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Cache format: { groups: [...], items: [...] }
        if (parsed?.groups && parsed?.items) return parsed;
        return null;
    } catch(e) {
        localStorage.removeItem(getCacheKey(classId));
        return null;
    }
}

function writeCache(classId, groups, items) {
    try {
        localStorage.setItem(getCacheKey(classId), JSON.stringify({ groups, items }));
    } catch(e) { /* storage penuh, skip */ }
}

function isCacheSame(classId, groups, items) {
    const old = readCache(classId);
    if (!old) return false;
    const sig = d => d.map(x => JSON.stringify(x)).sort().join('|');
    return sig(old.groups) === sig(groups) && sig(old.items) === sig(items);
}

// ── FETCH ─────────────────────────────────────────────────────
async function fetchSidebarData(classId, retries = 0) {
    if (typeof supabase === 'undefined') {
        if (retries >= 5) { console.error('[Sidebar] Supabase tidak ready'); return null; }
        await new Promise(r => setTimeout(r, 300));
        return fetchSidebarData(classId, retries + 1);
    }
    try {
        const [{ data: groups, error: gErr }, { data: items, error: iErr }] = await Promise.all([
            supabase.from('menu_groups')
                .select('*')
                .eq('class_id', classId)
                .order('display_order', { ascending: true }),
            supabase.from('subjects_config')
                .select('*')
                .eq('class_id', classId)
                .order('display_order', { ascending: true })
        ]);
        if (iErr) throw iErr;

        // Fallback: kalau menu_groups belum diisi, generate otomatis dari subjects_config
        let resolvedGroups = (!gErr && groups?.length) ? groups : generateGroupsFromItems(items || [], classId);

        return { groups: resolvedGroups, items: items || [] };
    } catch(err) {
        console.error('[Sidebar] Fetch error:', err);
        if (retries === 0) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchSidebarData(classId, 1);
        }
        return null;
    }
}

// Fallback: generate menu_groups dari distinct menu_group di subjects_config
function generateGroupsFromItems(items, classId) {
    const TYPE_ORDER = { system: 0, admin: 1, main: 2, lessons: 3 };
    const TYPE_LABEL = { system: 'System Menu', admin: 'Admin Panel', main: 'Main Menu', lessons: 'Lessons' };
    const seen = new Set();
    const groups = [];
    items.forEach(item => {
        if (!item.menu_group || item.menu_group === 'bottomnav' || seen.has(item.menu_group)) return;
        seen.add(item.menu_group);
        const type = TYPE_ORDER.hasOwnProperty(item.menu_group) ? item.menu_group : 'custom';
        groups.push({
            id: null,
            class_id: classId,
            group_key: item.menu_group,
            group_label: TYPE_LABEL[item.menu_group] || item.menu_group.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
            group_type: type,
            display_order: TYPE_ORDER[item.menu_group] ?? 99
        });
    });
    return groups.sort((a,b) => a.display_order - b.display_order);
}

// ── REALTIME ──────────────────────────────────────────────────
function setupSidebarRealtime(classId, user) {
    if (_sidebarChannel) return;

    const cacheKey = getCacheKey(classId);

    _sidebarChannel = supabase
        .channel(`sidebar_${classId}`)
        .on('postgres_changes', {
            event: '*', schema: 'public',
            table: 'subjects_config',
            filter: `class_id=eq.${classId}`
        }, () => refreshSidebar(classId, user))
        .on('postgres_changes', {
            event: '*', schema: 'public',
            table: 'menu_groups',
            filter: `class_id=eq.${classId}`
        }, () => refreshSidebar(classId, user))
        .subscribe();

    window.addEventListener('pagehide', () => {
        _sidebarChannel?.unsubscribe();
        _sidebarChannel = null;
    }, { once: true });
}

async function refreshSidebar(classId, user) {
    console.log('[Sidebar] Perubahan terdeteksi, memperbarui...');
    const data = await fetchSidebarData(classId);
    if (!data) return;
    writeCache(classId, data.groups, data.items);
    processAndRenderSidebar(data.groups, data.items, user);
}

// ── ENTRY POINT ───────────────────────────────────────────────
async function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    let user;
    try { user = JSON.parse(localStorage.getItem('user')); } catch(e) { return; }
    if (!user) return;

    const classId = getEffectiveClassId() || String(user.class_id);
    const cached  = readCache(classId);

    if (cached) {
        // Render langsung dari cache (no blink)
        processAndRenderSidebar(cached.groups, cached.items, user);
        // Background refresh
        fetchSidebarData(classId).then(data => {
            if (!data) return;
            if (!isCacheSame(classId, data.groups, data.items)) {
                writeCache(classId, data.groups, data.items);
                processAndRenderSidebar(data.groups, data.items, user);
            }
        });
    } else {
        // Tidak ada cache → blocking fetch
        const data = await fetchSidebarData(classId);
        if (data) {
            writeCache(classId, data.groups, data.items);
            processAndRenderSidebar(data.groups, data.items, user);
        }
    }

    setupSidebarRealtime(classId, user);
}

// ── RENDER ────────────────────────────────────────────────────
function processAndRenderSidebar(groups, items, user) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const role = user.role;
    const isInAdmin = window.location.pathname.includes('/admiii/');
    const rootPrefix  = isInAdmin ? '../' : '';
    const adminPrefix = isInAdmin ? '' : 'admiii/';

    const currentPath = window.location.pathname.toLowerCase();
    const currentId   = new URLSearchParams(window.location.search).get('id')?.toLowerCase();

    // ── Filter grup berdasarkan role ──
    const visibleGroups = groups.filter(g => {
        if (g.group_type === 'bottomnav' || g.group_key === 'bottomnav') return false;
        switch(g.group_type) {
            case 'system': return role === 'super_admin';
            case 'admin':  return role === 'super_admin' || role === 'class_admin';
            default:       return true; // main, lessons, custom → semua user
        }
    });

    let html = '';

    visibleGroups.forEach(group => {
        const groupItems = items.filter(m => m.menu_group === group.group_key);
        if (!groupItems.length) return; // skip grup kosong

        // ── Warna header per tipe ──
        const COLOR = {
            system:  'var(--accent, #00eaff)',
            admin:   '#ffd700',
            main:    '',
            lessons: '',
            custom:  ''
        };
        const headerColor = COLOR[group.group_type] || '';
        const headerStyle = headerColor ? `style="color:${headerColor};"` : '';

        html += `<h3 ${headerStyle}>${group.group_label}</h3><ul>`;

        groupItems.forEach(item => {
            // ── Build URL berdasarkan tipe grup ──
            let url;
            switch(group.group_type) {
                case 'system':
                case 'admin':
                    url = adminPrefix + item.subject_id;
                    break;
                case 'lessons':
                    url = `${rootPrefix}subject?id=${item.subject_id}`;
                    break;
                case 'main':
                    url = rootPrefix + item.subject_id;
                    break;
                case 'custom':
                default:
                    // Kalau ada :// atau ? pakai as-is, kalau tidak prefix root
                    url = (item.subject_id?.includes('://') || item.subject_id?.includes('?'))
                        ? item.subject_id
                        : rootPrefix + item.subject_id;
            }

            // ── Active state ──
            const urlLow = url.toLowerCase();
            let isActive = '';
            if (urlLow.includes('id=')) {
                if (currentId === urlLow.split('id=')[1]) isActive = 'active';
            } else {
                const itemSeg = urlLow.split('/').pop();
                const pathSeg = currentPath.split('/').pop();
                if (pathSeg === itemSeg) isActive = 'active';
            }

            // ── Icon ──
            let icon = item.icon || 'fa-book';
            if (!icon.includes(' ')) icon = `fa-solid ${icon}`;

            // ── Badge ──
            const badge = item.badge
                ? `<span class="sidebar-badge ${item.badge_type || 'badge-new'}">${item.badge}</span>`
                : '';

            html += `
            <li class="${isActive}">
                <a href="${url}">
                    <i class="${icon}"></i> <span>${item.subject_name}</span>
                </a>
                ${badge}
            </li>`;
        });

        html += '</ul>';
    });

    sidebar.innerHTML = html;

    // Restore scroll position
    const savedScroll = sessionStorage.getItem('sidebar_scroll');
    if (savedScroll) sidebar.scrollTop = parseInt(savedScroll);

    sidebar.addEventListener('scroll', () => {
        sessionStorage.setItem('sidebar_scroll', sidebar.scrollTop);
    }, { passive: true });
}

// ── AUTO INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    renderClassSwitcher();
});