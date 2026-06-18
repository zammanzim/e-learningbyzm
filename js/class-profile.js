const CLASS_ID = 2;
const $ = id => document.getElementById(id);
let students = [];
let galleryImages = [];
let messagesCount = 0;
let currentTab = 0;
const PAGE_SIZE = 8;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await fetchData();
        renderStats();
        renderGallery();
        renderStudents();
        renderStructure();
        initSearch();
        initConfess('kpConfessBtn', 'kpDevBtn');
        initPopup();
        initMiniPlayer();
        initObserver();
    } catch (e) {
        console.error('Class profile init error:', e);
        const page = document.querySelector('.kp-page');
        if (typeof UIComponents !== 'undefined' && UIComponents.showError) {
            UIComponents.showError(page, e);
        } else if (page) {
            page.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#ff6b6b;"><h2>Gagal memuat data</h2><p>${e.message}</p></div>`;
        }
    }
});

async function fetchData() {
    const [stuRes, galRes, msgRes] = await Promise.all([
        supabase.from('students').select('*').eq('class_id', CLASS_ID).order('absen_number'),
        supabase.from('gallery_images').select('*').eq('class_id', CLASS_ID).order('display_order'),
        supabase.from('confess_messages').select('id', { count: 'exact', head: true }).eq('class_id', CLASS_ID)
    ]);

    if (stuRes.error) console.error('Students fetch error:', stuRes.error);
    if (galRes.error) console.error('Gallery fetch error:', galRes.error);
    if (msgRes.error) console.error('Messages count error:', msgRes.error);

    students = stuRes.data || [];
    galleryImages = galRes.data || [];
    messagesCount = msgRes.count || 0;

    const userIds = students.filter(s => s.user_id).map(s => s.user_id);
    if (userIds.length) {
        const { data: users } = await supabase.from('users').select('id, avatar_url, short_name, full_name, bio').in('id', userIds);
        if (users) {
            const map = {};
            users.forEach(u => map[u.id] = u);
            students.forEach(s => {
                if (s.user_id && map[s.user_id]) s.users = map[s.user_id];
            });
        }
    }
}

function getPhoto(s) {
    if (s.users && s.users.avatar_url) return `${s.users.avatar_url}?t=${Date.now()}`;
    if (s.photo_url) return s.photo_url;
    return '../icons/profpicture.png';
}

function getDisplayName(s) {
    if (s.users && s.users.short_name) return s.users.short_name;
    return s.nickname || `Siswa #${s.absen_number}`;
}

function renderStats() {
    const user = getUser();
    $('statStudents').textContent = students.length;
    $('statMessages').textContent = messagesCount;
    if (user) {
        const cls = JSON.parse(localStorage.getItem('selectedClass') || '{}');
        $('kpHeroTitle').textContent = cls.name || 'X - RPL 2';
        $('kpHeroSub').textContent = 'Hi, Welcome To';
    }
}

function renderGallery() {
    const container = $('kpGalleryScroll');
    if (!galleryImages.length) {
        container.innerHTML = '<p style="padding:20px;opacity:0.5;text-align:center">Belum ada foto gallery. Jalankan SQL seed terlebih dahulu.</p>';
        return;
    }
    container.innerHTML = galleryImages.map(g =>
        `<div class="kp-gal-item"><img src="${g.image_url}" alt="${g.caption || ''}" loading="lazy"></div>`
    ).join('');

    const items = container.querySelectorAll('.kp-gal-item');
    let currentIdx = 0, autoSlide, isProgrammatic = false, isScrolling = false, scrollTimer;

    function scrollToIndex(idx, smooth = true) {
        const item = items[idx];
        if (!item) return;
        const cw = container.offsetWidth;
        const target = item.offsetLeft - (cw / 2 - item.offsetWidth / 2);
        isProgrammatic = true;
        container.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'instant' });
        setTimeout(() => isProgrammatic = false, 600);
    }

    function updateScale() {
        const center = container.scrollLeft + container.offsetWidth / 2;
        items.forEach(item => {
            const ic = item.offsetLeft + item.offsetWidth / 2;
            const dist = Math.abs(center - ic);
            const scale = Math.max(0.85, 1.06 - dist / 400);
            item.style.transform = `scale(${scale})`;
            item.style.zIndex = dist < 150 ? 3 : 1;
        });
    }

    function startAuto() {
        clearInterval(autoSlide);
        autoSlide = setInterval(() => {
            currentIdx = (currentIdx + 1) % items.length;
            scrollToIndex(currentIdx);
            setTimeout(updateScale, 400);
        }, 2500);
    }

    container.addEventListener('scroll', () => {
        if (isProgrammatic) {
            const max = container.scrollWidth - container.offsetWidth;
            if (container.scrollLeft <= 0) container.scrollLeft = max;
            else if (container.scrollLeft >= max) container.scrollLeft = 0;
            updateScale();
            return;
        }
        if (!isScrolling) { clearInterval(autoSlide); isScrolling = true; }
        updateScale();
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            isScrolling = false;
            const center = container.scrollLeft;
            let closest = 0, minDist = Infinity;
            items.forEach((item, i) => {
                const d = Math.abs(center - (item.offsetLeft + item.offsetWidth / 2));
                if (d < minDist) { minDist = d; closest = i; }
            });
            currentIdx = closest;
            startAuto();
        }, 1000);
    });

    window.addEventListener('resize', updateScale);
    scrollToIndex(Math.min(5, items.length - 1), false);
    updateScale();
    setTimeout(updateScale, 300);
    startAuto();
}

function renderStudents() {
    const tabContainer = $('kpTabs');
    const studentContainer = $('kpGrid');
    const total = students.length;

    if (!total) {
        tabContainer.innerHTML = '';
        studentContainer.innerHTML = '<p class="kp-empty">Belum ada data siswa. Jalankan SQL seed terlebih dahulu.</p>';
        $('kpNav').style.display = 'none';
        return;
    }

    const pageCount = Math.ceil(total / PAGE_SIZE);

    tabContainer.innerHTML = Array.from({ length: pageCount }, (_, i) =>
        `<button class="kp-tab ${i === 0 ? 'active' : ''}" data-tab="${i}">${i * PAGE_SIZE + 1} - ${Math.min((i + 1) * PAGE_SIZE, total)}</button>`
    ).join('');

    function renderPage(idx) {
        const start = idx * PAGE_SIZE;
        const page = students.slice(start, start + PAGE_SIZE);
        studentContainer.innerHTML = page.map((s, i) => `
            <div class="kp-card" data-idx="${start + i}" data-student='${JSON.stringify(s).replace(/'/g, "&#39;")}'>
                <div class="kp-avatar">
                    <img src="${getPhoto(s)}" alt="${getDisplayName(s)}" loading="lazy" onerror="this.src='../icons/profpicture.png'">
                </div>
                <div class="kp-name">${getDisplayName(s)}</div>
                <div class="kp-absen">${s.nickname ? `Absen ${String(s.absen_number).padStart(2, '0')}` : ''}</div>
                ${s.position_group && s.position_group !== 'student' ? `<span class="kp-badge">${s.position_title || s.position_group}</span>` : ''}
            </div>
        `).join('');
    }

    renderPage(0);

    tabContainer.addEventListener('click', e => {
        const btn = e.target.closest('.kp-tab');
        if (!btn) return;
        tabContainer.querySelectorAll('.kp-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = +btn.dataset.tab;
        renderPage(currentTab);
        $('prevTab').disabled = currentTab === 0;
        $('nextTab').disabled = currentTab === pageCount - 1;
    });

    $('prevTab').addEventListener('click', () => {
        if (currentTab > 0) {
            currentTab--;
            tabContainer.children[currentTab].click();
        }
    });
    $('nextTab').addEventListener('click', () => {
        if (currentTab < pageCount - 1) {
            currentTab++;
            tabContainer.children[currentTab].click();
        }
    });
    $('prevTab').disabled = true;
    $('nextTab').disabled = pageCount <= 1;

    if (pageCount <= 1) $('kpNav').style.display = 'none';

    studentContainer.addEventListener('click', e => {
        const card = e.target.closest('.kp-card');
        if (!card) return;
        const idx = +card.dataset.idx;
        openStudentPopup(students[idx]);
    });
}

function renderStructure() {
    const tree = $('kpTree');
    const groups = {
        wali: { label: 'Wali Kelas', students: [] },
        leader: { label: 'Ketua & Wakil', students: [] },
        treasury: { label: 'Bendahara', students: [] },
        secretary: { label: 'Sekretaris', students: [] },
        attendance: { label: 'Absensi', students: [] },
        security: { label: 'Keamanan', students: [] },
        hygiene: { label: 'Kebersihan', students: [] },
        sports: { label: 'Olahraga', students: [] },
        spiritual: { label: 'Rohani', students: [] },
    };

    students.forEach(s => {
        const g = s.position_group || 'student';
        if (groups[g]) groups[g].students.push(s);
    });

    function renderNode(s) {
        const photo = getPhoto(s);
        return `<div class="kp-tnode" data-student='${JSON.stringify(s).replace(/'/g, "&#39;")}'>
            <div class="kp-tphoto"><img src="${photo}" alt="${getDisplayName(s)}" loading="lazy" onerror="this.src='../icons/profpicture.png'"></div>
            <div class="kp-tname">${getDisplayName(s)}</div>
            ${s.position_title ? `<div class="kp-trole">${s.position_title}</div>` : ''}
        </div>`;
    }

    let html = '';

    if (groups.wali.students.length) {
        html += renderNode(groups.wali.students[0]);
    }

    if (groups.leader.students.length) {
        html += `<h3>Dewan Ketua</h3><div class="kp-tchildren">`;
        groups.leader.students.forEach(s => { html += renderNode(s); });
        html += `</div>`;
    }

    const otherGroups = ['treasury', 'secretary', 'attendance', 'security', 'hygiene', 'sports', 'spiritual'];
    otherGroups.forEach(key => {
        const g = groups[key];
        if (!g.students.length) return;
        html += `<h3>${g.label}</h3><div class="kp-tchildren">`;
        g.students.forEach(s => { html += renderNode(s); });
        html += `</div>`;
    });

    if (!html) {
        tree.innerHTML = '<p style="text-align:center;opacity:0.5;padding:20px;">Belum ada data struktur kelas</p>';
        return;
    }

    tree.innerHTML = html;

    tree.addEventListener('click', e => {
        const node = e.target.closest('.kp-tnode');
        if (!node) return;
        try {
            const s = JSON.parse(node.dataset.student);
            openStudentPopup(s);
        } catch (err) { /* ignore */ }
    });
}

function initSearch() {
    const input = $('kpSearchInput');
    let debounceTimer;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const q = input.value.trim().toLowerCase();
            const container = $('kpGrid');
            const tabContainer = $('kpTabs');
            if (!q) {
                tabContainer.style.display = '';
                $('kpNav').style.display = '';
                renderStudents();
                return;
            }

            tabContainer.style.display = 'none';
            $('kpNav').style.display = 'none';

            const filtered = students.filter(s =>
                (s.nickname && s.nickname.toLowerCase().includes(q)) ||
                (s.users && s.users.short_name && s.users.short_name.toLowerCase().includes(q)) ||
                (s.users && s.users.full_name && s.users.full_name.toLowerCase().includes(q)) ||
                String(s.absen_number).includes(q)
            );

            container.innerHTML = filtered.length
                ? filtered.map(s => `
                    <div class="kp-card" data-student='${JSON.stringify(s).replace(/'/g, "&#39;")}'>
                        <div class="kp-avatar">
                            <img src="${getPhoto(s)}" alt="${getDisplayName(s)}" loading="lazy" onerror="this.src='../icons/profpicture.png'">
                        </div>
                        <div class="kp-name">${s.nickname || getDisplayName(s)}</div>
                        <div class="kp-absen">Absen ${String(s.absen_number).padStart(2, '0')}</div>
                    </div>
                `).join('')
                : '<p class="kp-empty">Siswa tidak ditemukan</p>';

            container.querySelectorAll('.kp-card').forEach(card => {
                card.addEventListener('click', () => {
                    try {
                        const s = JSON.parse(card.dataset.student);
                        openStudentPopup(s);
                    } catch (err) { /* ignore */ }
                });
            });
        }, 300);
    });
}

function openStudentPopup(s) {
    const user = getUser();
    const isOwner = user && s.user_id && String(user.id) === String(s.user_id);
    const photo = getPhoto(s);
    const name = getDisplayName(s);
    const nickname = s.nickname || name;
    const color = s.card_color || '#00bfff';
    const quote = s.quote || null;
    const desc = s.description || (s.users && s.users.bio) || null;

    const inner = $('kpModalInner');
    inner.innerHTML = `
        <div class="kp-flex">
            <div class="kp-left">
                ${quote ? `<div><div class="kp-label"><i class="fa-solid fa-comment-dots"></i> Kata-Kata</div><div class="kp-quote">"${quote}"</div></div>` : ''}
                ${quote && desc ? `<div class="kp-divider"></div>` : ''}
                ${desc ? `<div style="margin-top:8px"><div class="kp-label"><i class="fa-solid fa-user"></i> Deskripsi</div><div class="kp-desc">${desc}</div></div>` : ''}
                <div class="kp-links">
                    ${s.wa ? `<a href="https://wa.me/${s.wa}" target="_blank" class="kp-lk-wa"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
                    ${s.ig ? `<a href="https://instagram.com/${s.ig}" target="_blank" class="kp-lk-ig"><i class="fa-brands fa-instagram"></i></a>` : ''}
                </div>
                ${isOwner ? `<button class="kp-edit-btn" id="kpEditStudentBtn"><i class="fa-solid fa-pen"></i> Edit Profilku</button>` : ''}
            </div>
            <div class="kp-right">
                <img src="${photo}" alt="${name}" onerror="this.src='../icons/profpicture.png'">
                <h3>${nickname}</h3>
                ${s.position_title ? `<div class="kp-role-badge" style="background:${color}">${s.position_title}</div>` : ''}
            </div>
        </div>
    `;

    $('kpPopup').style.display = 'flex';
    document.body.classList.add('no-scroll');

    if (s.music_src) {
        window.playMusic({
            src: s.music_src,
            title: s.music_title || name,
            artist: s.music_artist || '',
            cover: s.music_cover || photo
        });
    }

    const editBtn = $('kpEditStudentBtn');
    if (editBtn) editBtn.addEventListener('click', () => openEditPopup(s));
}

function openEditPopup(s) {
    const inner = $('kpModalInner');
    inner.innerHTML = `
        <div class="kp-eform">
            <h3><i class="fa-solid fa-pen"></i> Edit Profilku</h3>
            <label>Kata-Kata</label>
            <textarea id="editQuote" rows="2">${s.quote || ''}</textarea>
            <label>Deskripsi</label>
            <textarea id="editDesc" rows="3">${s.description || ''}</textarea>
            <label>WhatsApp (angka saja)</label>
            <input type="text" id="editWa" value="${s.wa || ''}">
            <label>Instagram (username tanpa @)</label>
            <input type="text" id="editIg" value="${s.ig || ''}">
            <div class="kp-emusic">
                <label>Music URL (opsional)</label>
                <input type="text" id="editMusicSrc" value="${s.music_src || ''}" placeholder="Link file audio">
                <label>Judul Lagu</label>
                <input type="text" id="editMusicTitle" value="${s.music_title || ''}">
                <label>Artist</label>
                <input type="text" id="editMusicArtist" value="${s.music_artist || ''}">
                <label>Cover URL</label>
                <input type="text" id="editMusicCover" value="${s.music_cover || ''}">
            </div>
            <div class="kp-eactions">
                <button class="kp-save" id="kpEditSave"><i class="fa-solid fa-floppy-disk"></i> Simpan</button>
                <button class="kp-cancel" id="kpEditCancel">Batal</button>
            </div>
            <p style="font-size:0.78rem;color:#475569;margin-top:6px;">* Foto profil bisa diubah di halaman Pengaturan Akun</p>
        </div>
    `;

    $('kpEditCancel').addEventListener('click', () => openStudentPopup(s));
    $('kpEditSave').addEventListener('click', async () => {
        const payload = {
            quote: $('editQuote').value.trim() || null,
            description: $('editDesc').value.trim() || null,
            wa: $('editWa').value.trim() || null,
            ig: $('editIg').value.trim() || null,
            music_src: $('editMusicSrc').value.trim() || null,
            music_title: $('editMusicTitle').value.trim() || null,
            music_artist: $('editMusicArtist').value.trim() || null,
            music_cover: $('editMusicCover').value.trim() || null,
        };

        const { error } = await supabase.from('students').update(payload).eq('id', s.id);
        if (error) {
            showPopup('Gagal menyimpan: ' + error.message, 'error');
            return;
        }

        Object.assign(s, payload);
        showToast('Profil berhasil diperbarui!', 'success');
        openStudentPopup(s);
    });
}

function initConfess(confessId, devId) {
    $(confessId).addEventListener('click', () => openConfessPopup(CLASS_ID, 'Pesan untuk X-RPL 2'));
    $(devId).addEventListener('click', () => openConfessPopup(-1, 'Pesan untuk Developer'));
}

function openConfessPopup(groupId, title) {
    const inner = $('kpModalInner');
    inner.innerHTML = `
        <div class="kp-confess">
            <h2>${title}</h2>
            <div class="kp-clist" id="confessList"><p style="color:#475569;">Loading...</p></div>
            <div class="kp-cform">
                <input type="text" id="confessName" placeholder="Nama (opsional)">
                <textarea id="confessMessage" rows="3" placeholder="Tulis pesan..."></textarea>
                <button class="kp-csend" id="confessSend"><i class="fa-regular fa-paper-plane"></i> Kirim</button>
            </div>
        </div>
    `;
    $('kpPopup').style.display = 'flex';
    document.body.classList.add('no-scroll');

    const list = $('confessList');
    const nameInput = $('confessName');
    const msgInput = $('confessMessage');
    const sendBtn = $('confessSend');

    async function loadMessages() {
        const { data } = await supabase.from('confess_messages')
            .select('name, message, created_at')
            .eq('class_id', groupId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (data && data.length) {
            const titleEl = inner.querySelector('h2');
            titleEl.textContent = `${data.length} ${title}`;
            list.innerHTML = data.map(m =>
                `<div class="kp-citem"><div class="kp-cname">${m.name || 'Anonim'}</div><div class="kp-cmsg">${m.message}</div></div>`
            ).join('');
        } else {
            list.innerHTML = '<p style="color:#475569;">Belum ada pesan</p>';
        }
    }
    loadMessages();

    sendBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim() || 'Anonim';
        const message = msgInput.value.trim();
        if (!message) { showToast('Isi pesan dulu!', 'error'); return; }
        const { error } = await supabase.from('confess_messages').insert({ class_id: groupId, name, message });
        if (error) { showPopup('Gagal kirim: ' + error.message, 'error'); return; }
        nameInput.value = '';
        msgInput.value = '';
        showToast('Pesan terkirim!', 'success');
        loadMessages();
    });

    msgInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });
}

function initPopup() {
    $('kpPopup').addEventListener('click', e => {
        if (e.target.id === 'kpPopup') closePopup();
    });
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') closePopup();
    });
}

function closePopup() {
    $('kpPopup').style.display = 'none';
    document.body.classList.remove('no-scroll');
    if (window.stopMusic) window.stopMusic();
}

function initMiniPlayer() {
    const mini = $('kpPlayer');
    const audio = $('kpAudio');
    const coverEl = $('kpCover');
    const titleEl = $('kpTitle');
    const artistEl = $('kpArtist');
    const curEl = $('kpCur');
    const durEl = $('kpDur');
    const fillEl = $('kpFill');
    const playBtn = $('kpPlay');
    const playIcon = $('kpPlayIcon');
    const closeBtn = $('kpClose');
    const bar = $('kpBar');

    let currentSrc = '';

    function fmt(s) {
        if (!s || !isFinite(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    }

    window.playMusic = ({ src = '', title = '', artist = '', cover = '' } = {}) => {
        if (!src) { hide(); return; }
        if (currentSrc === src) { show(); return; }
        currentSrc = src;
        audio.src = src;
        titleEl.textContent = title || 'Unknown Track';
        artistEl.textContent = artist || '';
        coverEl.src = cover || '../icons/profpicture.png';
        show();
        audio.load();
        audio.play().then(() => playIcon.className = 'fa-solid fa-pause').catch(() => playIcon.className = 'fa-solid fa-play');
    };

    window.stopMusic = () => {
        audio.pause();
        audio.currentTime = 0;
        currentSrc = '';
        hide();
        fillEl.style.width = '0%';
        curEl.textContent = '0:00';
        durEl.textContent = '0:00';
        playIcon.className = 'fa-solid fa-play';
    };

    function show() { mini.classList.add('visible'); }
    function hide() { mini.classList.remove('visible'); }

    audio.onloadedmetadata = () => { durEl.textContent = fmt(audio.duration); };
    audio.ontimeupdate = () => {
        curEl.textContent = fmt(audio.currentTime);
        fillEl.style.width = audio.duration ? `${(audio.currentTime / audio.duration) * 100}%` : '0%';
    };
    bar.addEventListener('click', e => {
        if (!audio.duration) return;
        audio.currentTime = ((e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth) * audio.duration;
    });
    playBtn.addEventListener('click', () => {
        if (!audio.src) return;
        if (audio.paused) { audio.play().then(() => playIcon.className = 'fa-solid fa-pause'); }
        else { audio.pause(); playIcon.className = 'fa-solid fa-play'; }
    });
    closeBtn.addEventListener('click', window.stopMusic);
    audio.onended = () => { playIcon.className = 'fa-solid fa-play'; audio.currentTime = 0; };
}

function initObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
            } else {
                entry.target.classList.remove('show');
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.kp-page .kp-fade').forEach(el => observer.observe(el));
}
