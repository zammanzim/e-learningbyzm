// js/ui-components.js
const UIComponents = {
    inject() {
        // Cek agar tidak inject dua kali
        if (document.getElementById('addModal')) return;

        const body = document.body;
        if (!body) return;

        const cachedCount = localStorage.getItem('cached_visitor_count') || '0';

        // Baca user data synchronously buat populate header tanpa blink
        let _uData = null;
        try { _uData = JSON.parse(localStorage.getItem('user')); } catch(e) {}
        const _isSubDir = /\/(a|admiii)\//.test(window.location.pathname);
        const _defaultPP = _isSubDir ? '../icons/profpicture.png' : 'icons/profpicture.png';
        const _avatarSrc = (_uData && _uData.avatar_url) ? _uData.avatar_url : _defaultPP;
        const _displayName = _uData ? (_uData.short_name || _uData.nickname || 'User') : '...';

        // 1. HEADER & VISITOR
        const headerHTML = `
        <header>
            <div class="header-left">
                <div class="hamburger" id="hamburger" onclick="toggleMenu()">
                    <span></span><span></span><span></span>
                </div>
                <div id="visitorTrigger" class="visitor-trigger">
                    <i class="fa-solid fa-eye"></i>
                    <span id="headerVisitorCount">${cachedCount}</span>
                </div>
            </div>
            <div id="classSwitcherWrapper" style="display:none; position:relative; margin-right:8px;">
                <div id="classSwitcherTrigger" onclick="toggleClassSwitcher()" style="
                    display:flex; align-items:center; gap:6px;
                    background:rgba(0, 234, 255, 0.08); border:1px solid rgba(0, 234, 255, 0.25);
                    border-radius:20px; padding:5px 12px; cursor:pointer;
                    font-size:12px; color:var(--accent, #00eaff); transition:all 0.2s;
                ">
                    <i class="fa-solid fa-layer-group" style="font-size:11px;"></i>
                    <span id="classSwitcherLabel">Kelas –</span>
                    <i class="fa-solid fa-caret-down" style="font-size:10px;"></i>
                </div>
                <div id="classSwitcher" style="
                    display:none; position:absolute; top:calc(100% + 8px); left:0;
                    background:#111; border:1px solid rgba(0, 234, 255, 0.2);
                    border-radius:10px; min-width:140px; overflow:hidden; z-index:9999;
                "></div>
            </div>
            <div class="profile-box" id="profileTrigger">
                <span id="headerName">Haii, ${_displayName}</span>
                <img id="headerPP" class="header-pp" src="${_avatarSrc}">
                <i class="fa-solid fa-caret-down"></i>
            </div>
            <div class="profile-dropdown" id="profileDropdown">
                <ul>
                    <li onclick="goAnnouncements()"><i class="fa-solid fa-table-columns"></i> Announcements</li>
                    <li onclick="goProfile()"><i class="fa-solid fa-user"></i> Edit Profile</li>
                    <li onclick="window.location.href=(window.location.pathname.includes('/admiii/')?'../':'')+'theme'"><i class="fa-solid fa-palette"></i> Personalisasi</li>
                    <li onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</li>
                </ul>
            </div>
        </header>
 
        <div id="visitorOverlay" class="visitor-overlay">
            <div class="visitor-popup">
                <div class="popup-header">
                    <h3>Visitor <i class="fa-solid fa-eye" style="font-size:15px; margin-left: 10px;"></i> <span id="popupVisitorCount" style="font-size:16px; font-weight:bold; color:var(--accent, #00eaff);">${cachedCount}</span></h3>
                    <span id="closeVisitorPopup" class="close-popup">&times;</span>
                </div>

                <!-- NEW: Wrapped List Section -->
                <div class="list-section">
                    <div class="list-title">PENGUNJUNG TERBARU</div>
                    <div id="visitorList" class="visitor-list-container"></div>
                </div>

                <div class="admin-actions">
                    <button id="resetVisitorBtn" class="btn-reset-text">
                        <i class="fa-solid fa-rotate-right"></i> Reset Today (Admin)
                     </button>
                </div>
            </div>
        </div>`;

        // 2. MODALS (Add & Detail)
        const modalsHTML = `
        <div id="addModal" class="modal-overlay hidden">
            <div class="glass-modal-box">
                <h3><i class="fa-solid fa-layer-group"></i> Materi Baru</h3>
                
                <!-- NEW: Step 1 - Configuration -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; margin-bottom: 15px;">
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label style="font-size: 11px; color: #888; margin-bottom: 5px; display: block;">Halaman Tujuan:</label>
                        <select id="addDestPage" class="glass-input" style="padding: 8px 12px; font-size: 13px;">
                            <option value="announcements">Announcements</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <label style="font-size: 13px; color: #fff; cursor: pointer;" for="addIsLesson">Jadikan Tugas?</label>
                        <label class="switch">
                            <input type="checkbox" id="addIsLesson">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>

                <input type="text" id="addJudul" class="glass-input" placeholder="Judul Utama" spellcheck="false">
                <input type="text" id="addSubjudul" class="glass-input" placeholder="Sub-judul" spellcheck="false">
                <div class="editor-toolbar" style="display:flex; gap:10px; margin-bottom: 8px;">
                    <button type="button" onclick="formatText('5')" class="btn-tool">Besar</button>
                    <button type="button" onclick="formatText('3')" class="btn-tool">Sedang</button>
                    <button type="button" onclick="formatText('2')" class="btn-tool">Kecil</button>
                </div>
                <div id="addIsi" contenteditable="true" class="glass-input" style="min-height: 150px; overflow-y: auto;"></div>
                <input type="text" id="addSmall" class="glass-input" placeholder="Footer text" style="font-size: 12px; opacity:0.8;">
<div class="color-picker-container" style="margin-top: 15px;">
    <label style="font-size: 12px; color: #aaa; margin-bottom: 8px; display: block;">Warna Kartu:</label>
    <div id="addColors" class="color-options" style="display: flex; gap: 8px; flex-wrap: wrap;">
    <div class="color-opt active" data-color="default" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; cursor: pointer; background: rgba(0,0,0,0.3);"></div>
    <div class="color-opt" data-color="red" style="width: 22px; height: 22px; border-radius: 50%; background: #ff4757; cursor: pointer;"></div>
    <div class="color-opt" data-color="orange" style="width: 22px; height: 22px; border-radius: 50%; background: #ff9f43; cursor: pointer;"></div>
    <div class="color-opt" data-color="yellow" style="width: 22px; height: 22px; border-radius: 50%; background: #ffd32a; cursor: pointer;"></div>
    <div class="color-opt" data-color="green" style="width: 22px; height: 22px; border-radius: 50%; background: #2ed573; cursor: pointer;"></div>
    <div class="color-opt" data-color="blue" style="width: 22px; height: 22px; border-radius: 50%; background: #00c8ff; cursor: pointer;"></div>
    <div class="color-opt" data-color="purple" style="width: 22px; height: 22px; border-radius: 50%; background: #a55eea; cursor: pointer;"></div>
    <div class="color-opt" data-color="pink" style="width: 22px; height: 22px; border-radius: 50%; background: #ff9ff3; cursor: pointer;"></div>
    <div class="color-opt" data-color="brown" style="width: 22px; height: 22px; border-radius: 50%; background: #8b4513; cursor: pointer;"></div>
</div>
</div>
                <div id="dropZone" class="drop-area">
                    <i class="fa-solid fa-cloud-arrow-up drop-icon"></i>
                    <div class="drop-text"><b>Click to upload</b> or drag photos here</div>
                    <input type="file" id="addFiles" multiple accept="image/*" style="display: none;">
                </div>
                <div id="previewContainer" class="preview-container"></div>
                <div class="action-buttons">
                    <button id="btnCancelAdd" class="btn-glass-cancel">Batal</button>
                    <button id="btnSaveAdd" class="btn-glass-save"><i class="fa-solid fa-paper-plane"></i> Posting</button>
                </div>
            </div>
        </div>

        <div id="detailOverlay" class="detail-overlay">
            <div class="glass-detail-box">
                <span class="close-detail-btn" onclick="closeDetail()">&times;</span>
                <div class="detail-media-section">
                    <div class="slider-wrapper">
                        <img id="detailImg" src="">
                        <div id="sliderNavBtns" class="slider-nav-container">
                            <button class="glass-nav-btn prev-btn" onclick="prevSlide(event)"><i class="fa-solid fa-chevron-left"></i></button>
                            <button class="glass-nav-btn next-btn" onclick="nextSlide(event)"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                        <div id="toggleInfoBtn" class="mobile-toggle-btn" onclick="showMobileInfo(event)"><i class="fa-solid fa-circle-info"></i> Lihat Deskripsi</div>
                        <div id="photoCounterTag" class="photo-counter-tag">1 / 1</div>
                    </div>
                </div>
                <div id="detailInfoSection" class="detail-info-section hidden-mobile">
                    <div class="sheet-header-mobile">
                        <button id="sheetToggleBtn" class="sheet-btn-left" onclick="toggleSheetHeight(event)"><i class="fa-solid fa-expand"></i></button>
                        <div class="sheet-drag-indicator" style="width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 10px;"></div>
                        <button class="sheet-btn-right" onclick="toggleMobileInfo(event)"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="info-content-scroll">
                        <h2 id="detailBigTxt"></h2>
                        <h4 id="detailTitleTxt"></h4>
                        <div id="detailContentTxt" class="detail-body-text"></div>
                        <small id="detailSmallTxt" class="detail-footer-text" style="margin-bottom: 50px;"></small>
                    </div>
                </div>
            </div>
        </div>`;

        body.insertAdjacentHTML('afterbegin', headerHTML);
        body.insertAdjacentHTML('beforeend', modalsHTML);

        // 3. CONTEXT MENU
        this.contextMenu.init();
    },

    contextMenu: {
        init() {
            if (typeof ContextMenu === 'undefined') return;
            ContextMenu.init();
            ContextMenu.registerProvider(
                'ui-components',
                (e) => this.provideContextMenu(e),
                0,
                (touch, target) => this.provideLongPress(touch, target)
            );
        },

        provideLongPress(touch, target) {
            const isSubjectPage = !!document.getElementById('announcements');
            const isTugasPage = !!document.getElementById('taskList');
            if (!isSubjectPage && !isTugasPage) return null;

            const card = target.closest('.course-card');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');

            this.renderMenu(card, isAdmin);
            return { html: document.getElementById('customContextMenu').innerHTML };
        },

        provideContextMenu(e) {
            if (e.target.closest('.admin-fab-container') ||
                e.target.closest('.daily-fab-container') ||
                e.target.closest('.updates-fab') ||
                e.target.closest('.drag-grip') ||
                e.target.closest('.dc-edit-btn-wrap')) {
                return { html: '', preventDefault: true };
            }

            const isSubjectPage = !!document.getElementById('announcements');
            const isTugasPage = !!document.getElementById('taskList');
            const isDailyCard = e.target.closest('#dailyInfoCard');
            if (!isSubjectPage && !isTugasPage && !isDailyCard) return null;

            const card = e.target.closest('.course-card');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');

            this.renderMenu(card || isDailyCard, isAdmin, !!isDailyCard);
            return { html: document.getElementById('customContextMenu').innerHTML };
        },

        initTouchEvents() {
            let touchTimer;
            const longPressDuration = 500; // ms

            document.addEventListener('touchstart', (e) => {
                // Jangan trigger kalau klik kanan asli (untuk device hybrid)
                if (e.touches.length > 1) return;

                // FIX: Abaikan element draggable (FAB & Grip) biar gak bentrok sama drag timer
                if (e.target.closest('.admin-fab-container') || 
                    e.target.closest('.daily-fab-container') || 
                    e.target.closest('.updates-fab') ||
                    e.target.closest('.drag-grip') ||
                    [...e.target.classList].some(c => c.includes('fab'))) return;

                const touch = e.touches[0];
                const card = e.target.closest('.course-card');
                
                touchTimer = setTimeout(() => {
                    this.handleLongPress(touch, card);
                }, longPressDuration);
            }, { passive: true });

            document.addEventListener('touchend', () => {
                clearTimeout(touchTimer);
            });

            document.addEventListener('touchmove', () => {
                clearTimeout(touchTimer);
            }, { passive: true });
        },

        handleLongPress(touch, card) {
            // Hanya aktif di Subject & Tugas page
            const isSubjectPage = !!document.getElementById('announcements');
            const isTugasPage = !!document.getElementById('taskList');
            if (!isSubjectPage && !isTugasPage) return;

            // Vibrate feedback if supported
            if (navigator.vibrate) navigator.vibrate(50);

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');

            this.renderMenu(card, isAdmin);
            this.show(touch.clientX, touch.clientY);
        },

        handleContextMenu(e) {
            // FIX: Kunci total buat FAB & Grip — jangan munculin menu (custom maupun browser)
            // biar gak ganggu logic drag-and-drop
            if (e.target.closest('.admin-fab-container') || 
                e.target.closest('.daily-fab-container') || 
                e.target.closest('.updates-fab') ||
                e.target.closest('.drag-grip') ||
                e.target.closest('.dc-edit-btn-wrap')) {
                e.preventDefault();
                return;
            }

            // Hanya aktif di Subject, Tugas, atau Announcements page
            const isSubjectPage = !!document.getElementById('announcements');
            const isTugasPage = !!document.getElementById('taskList');
            const isDailyCard = e.target.closest('#dailyInfoCard');
            
            // Jika bukan di halaman yang didukung, biarkan menu default browser
            if (!isSubjectPage && !isTugasPage && !isDailyCard) return;

            e.preventDefault();

            const card = e.target.closest('.course-card');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');

            this.renderMenu(card || isDailyCard, isAdmin, !!isDailyCard);
            this.show(e.clientX, e.clientY);
        },

        renderMenu(card, isAdmin, isDaily = false) {
            const menu = document.getElementById('customContextMenu');
            let html = '<ul>';

            if (isDaily) {
                // Daily Card Context
                html += `
                    <li class="has-submenu" onclick="UIComponents.contextMenu.toggleSubmenu(event, this)">
                        <i class="fa-solid fa-calendar-days"></i> Lihat Jadwal
                        <div class="context-submenu daily-days-grid">
                            ${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(day => 
                                `<div class="ctx-day-item" onclick="window.switchDailyDay('${day}')">${day.substring(0,3)}</div>`
                            ).join('')}
                        </div>
                    </li>
                `;
                if (isAdmin) {
                    if (window.isDailyEditing) {
                        html += `<li onclick="window.saveAllDrafts()"><i class="fa-solid fa-check"></i> Simpan Jadwal</li>`;
                    } else {
                        html += `<li onclick="window.toggleDailyEditMode()"><i class="fa-solid fa-pen-to-square"></i> Edit Jadwal</li>`;
                    }
                }
                html += `<div class="divider"></div>`;
            } else if (card) {
                // Card Context
                html += `<li onclick="UIComponents.contextMenu.copyCardText()"><i class="fa-solid fa-copy"></i> Salin Teks</li>`;
                
                if (isAdmin) {
                    html += `
                        <li onclick="UIComponents.contextMenu.triggerCardAction('edit')"><i class="fa-solid fa-pen-to-square"></i> Edit Materi</li>
                        <li class="has-submenu" onclick="UIComponents.contextMenu.toggleSubmenu(event, this)">
                            <i class="fa-solid fa-palette"></i> Ganti Warna
                            <div class="context-submenu">
                                ${['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'].map(c => 
                                    `<div class="ctx-color-dot ctx-color-${c}" onclick="UIComponents.contextMenu.changeColor('${c}')" title="${c}"></div>`
                                ).join('')}
                            </div>
                        </li>
                        <div class="divider"></div>
                        <li class="danger" onclick="UIComponents.contextMenu.triggerCardAction('delete')"><i class="fa-solid fa-trash"></i> Hapus</li>
                    `;
                }
            }

            // Global Actions (selalu ada di bawah)
            if (!card && !isDaily && isAdmin) {
                html += `<li onclick="UIComponents.contextMenu.triggerGlobalAction('add')"><i class="fa-solid fa-plus"></i> Tambah Baru</li>`;
            }
            
            html += `
                <li onclick="location.reload()"><i class="fa-solid fa-rotate"></i> Refresh Halaman</li>
                <li onclick="window.scrollTo({top: 0, behavior: 'smooth'})"><i class="fa-solid fa-arrow-up"></i> Ke Atas</li>
            `;

            html += '</ul>';
            menu.innerHTML = html;
            this.activeCard = isDaily ? null : card;
        },

        toggleSubmenu(e, li) {
            if (typeof ContextMenu !== 'undefined') return ContextMenu.toggleSubmenu(e, li);
        },

        show(x, y) {
            if (typeof ContextMenu !== 'undefined') ContextMenu.show(x, y);
        },

        hide() {
            if (typeof ContextMenu !== 'undefined') ContextMenu.hide();
        },

        copyCardText() {
            if (!this.activeCard) return;
            // Hanya ambil isi/deskripsi saja sesuai permintaan user
            const content = this.activeCard.querySelector('[data-field="content"]')?.innerText || 
                            this.activeCard.querySelector('p')?.innerText || '';
            
            if (!content.trim()) {
                if (typeof showToast === 'function') showToast('Tidak ada teks untuk disalin', 'error');
                return;
            }

            navigator.clipboard.writeText(content.trim()).then(() => {
                if (typeof showToast === 'function') showToast('Isi materi berhasil disalin!', 'success');
            });
        },

        changeColor(color) {
            if (!this.activeCard) return;
            // Panggil fungsi global yang ada di SubjectApp
            if (typeof SubjectApp !== 'undefined' && SubjectApp.changeCardColor) {
                SubjectApp.changeCardColor(this.activeCard.dataset.id, color);
            }
        },

        triggerCardAction(action) {
            if (!this.activeCard) return;
            if (action === 'delete') {
                const deleteBtn = this.activeCard.querySelector('.delete-btn') || this.activeCard.querySelector('.task-btn-delete');
                if (deleteBtn) deleteBtn.click();
            } else if (action === 'edit') {
                const editBtn = document.getElementById('toggleEditMode');
                if (editBtn) {
                    // Jika belum mode edit, nyalakan dulu
                    if (!document.body.classList.contains('editable-mode') && !editBtn.classList.contains('state-done')) {
                        editBtn.click();
                    }
                    // Scroll ke card tersebut biar enak
                    this.activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    this.activeCard.style.outline = '2px solid #ff6200';
                    setTimeout(() => this.activeCard.style.outline = '', 2000);
                }
            }
        },

        triggerGlobalAction(action) {
            if (action === 'add') {
                const addBtn = document.getElementById('addAnnouncementBtn');
                if (addBtn) addBtn.click();
            }
        }
    }
};

const SkeletonUI = {

    // CSS yang dibutuhin semua skeleton — inject sekali ke <head>
    _cssInjected: false,
    injectCSS() {
        if (this._cssInjected) return;
        this._cssInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            /* ── Base skeleton shimmer ── */
            .sk {
                background: linear-gradient(90deg,
                    rgba(255,255,255,.05) 25%,
                    rgba(255,255,255,.10) 50%,
                    rgba(255,255,255,.05) 75%);
                background-size: 200% 100%;
                animation: skShimmer 1.4s infinite;
                border-radius: 6px;
            }
            @keyframes skShimmer {
                0%   { background-position: 200% 0 }
                100% { background-position: -200% 0 }
            }

            /* ── Shared sk-card ── */
            .sk-card {
                background: rgba(8,10,18,.6);
                border: 1px solid rgba(255,255,255,.07);
                border-radius: 14px;
                overflow: hidden;
                margin-bottom: 14px;
            }

            /* ── Feed skeleton parts ── */
            .sk-header   { display:flex; gap:10px; align-items:center; padding:10px 12px; }
            .sk-circle   { width:38px; height:38px; border-radius:50%; flex-shrink:0; }
            .sk-line     { height:11px; }
            .sk-img      { width:100%; aspect-ratio:1; border-radius:0; }
            .sk-sm       { width:42%; }
            .sk-md       { width:68%; margin-top:5px; }
            .sk-pad      { padding:10px 12px; }

            /* ── Tugas skeleton parts ── */
            .sk-media    { height:120px; width:100%; border-radius:0; }
            .sk-title    { height:16px; width:60%; margin:14px 14px 8px; border-radius:6px; }
            .sk-text     { height:11px; width:80%; margin:0 14px 8px; border-radius:6px; }
            .sk-text.short { width:45%; }

            /* ── User profile skeleton ── */
            .sk-cover    { height:90px; border-radius:0; }
            .sk-avatar   { width:84px; height:84px; border-radius:50%; margin:-42px 0 0 20px; }
            .sk-info-line{ height:13px; border-radius:7px; margin:11px 20px; }
        `;
        document.head.appendChild(style);
    },

    // Feed: 2 kartu post (avatar + gambar + caption)
    feed() {
        this.injectCSS();
        const card = () => `
            <div class="sk-card">
                <div class="sk-header">
                    <div class="sk sk-circle"></div>
                    <div style="flex:1">
                        <div class="sk sk-line sk-sm"></div>
                        <div class="sk sk-line sk-md"></div>
                    </div>
                </div>
                <div class="sk sk-img"></div>
                <div class="sk-pad"><div class="sk sk-line sk-sm"></div></div>
            </div>`;
        return card() + card();
    },

    // Tugas: N kartu tugas (gambar + title + text)
    tugas(count = 2) {
        this.injectCSS();
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
            <div class="sk-card">
                <div class="sk sk-media"></div>
                <div class="sk sk-title"></div>
                <div class="sk sk-text"></div>
                <div class="sk sk-text short"></div>
            </div>`;
        }
        return html;
    },

    // Subject/announcements: N kartu materi (title + lines)
    subject(count = 3) {
        this.injectCSS();
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
            <div class="sk-card" style="padding:18px">
                <div class="sk sk-line" style="width:45%;height:16px;margin-bottom:12px;"></div>
                <div class="sk sk-line" style="width:80%;margin-bottom:8px;"></div>
                <div class="sk sk-line" style="width:65%;"></div>
            </div>`;
        }
        return html;
    },

    // User profile header
    userProfile() {
        this.injectCSS();
        return `
            <div class="sk-card">
                <div class="sk sk-cover"></div>
                <div class="sk sk-avatar"></div>
                <div class="sk sk-info-line" style="width:38%;"></div>
                <div class="sk sk-info-line" style="width:22%;"></div>
                <div class="sk sk-info-line" style="width:55%;"></div>
            </div>`;
    },

    // Generic: render ke container by id
    render(containerId, type = 'subject', count = 3) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const map = {
            feed: () => this.feed(),
            tugas: () => this.tugas(count),
            subject: () => this.subject(count),
            userProfile: () => this.userProfile(),
        };
        el.innerHTML = (map[type] || map.subject)();
    },
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIComponents.inject());
} else {
    UIComponents.inject();
}
