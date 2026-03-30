const SubjectApp = {
    state: {
        editMode: false,
        isToggling: false,
        user: null,
        subjectId: null,
        subjectName: null,
        isLessonMode: false,
        completedTasks: [],
        announcements: [],
        tempFiles: [],
        bookmarks: [],
        selectedColor: 'default',
    },

    init(subjectId, subjectName, title, isLesson = false) {
        if (typeof supabase === 'undefined') return;

        this.state.subjectId = subjectId;
        this.state.subjectName = subjectName;
        this.state.title = title;
        this.state.isLessonMode = isLesson;
        this.state.user = this.getUserData();

        if (!this.state.user) {
            window.location.href = "login";
            return;
        }


        this.updatePageTitle();
        this.updateWelcomeText();
        this.setupAdminControls();
        this.setupEventListeners();
        this.loadAnnouncements();
        this.setupShortcuts();
        this.initAdd();
    },

    getUserData() {
        try {
            if (typeof getUser === 'function') return getUser();
            const userData = localStorage.getItem("user");
            return userData ? JSON.parse(userData) : null;
        } catch (e) {
            console.error("Failed to parse user data:", e);
            return null;
        }
    },

    // Update baris 44
    updatePageTitle() {
        document.title = this.state.subjectName.replace(/<[^>]*>/g, ''); // Strip HTML tags
        const pageTitle = document.getElementById("pageTitle");
        if (pageTitle) pageTitle.innerHTML = this.state.subjectName;
    },

    updateWelcomeText() {
        const welcomeEl = document.getElementById("welcomeText");
        if (welcomeEl) welcomeEl.innerHTML = `${this.state.subjectName}`;
    },

    setupAdminControls() {
        const isAdmin = (this.state.user.role === "class_admin" || this.state.user.role === "super_admin");
        const editControls = document.getElementById("editControls");
        if (editControls) editControls.style.display = 'contents';

        if (isAdmin && editControls) {
            editControls.innerHTML = `
                <div id="adminFabContainer" class="admin-fab-container">
                    <button id="addAnnouncementBtn" class="fab-add">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button id="toggleEditMode" class="fab-main state-edit">
                        <i class="fa-solid fa-pen-to-square fab-icon"></i>
                        <span class="fab-label">Edit</span>
                    </button>
                </div>
            `;
        }
    },

    setupEventListeners() {
        const self = this;

        // Handle Klik Background (Area Kosong)
        const detailOverlay = document.getElementById('detailOverlay');
        if (detailOverlay) {
            detailOverlay.onclick = (e) => {
                if (e.target === detailOverlay) {
                    const info = document.getElementById('detailInfoSection');
                    const isMobile = window.innerWidth <= 768;
                    if (isMobile && info && !info.classList.contains('hidden-mobile')) {
                        toggleMobileInfo();
                    } else {
                        closeDetail();
                    }
                }
            };
        }

        // Handle Klik Area Gambar/Media
        const mediaSection = document.querySelector('.detail-media-section');
        if (mediaSection) {
            mediaSection.onclick = () => {
                const info = document.getElementById('detailInfoSection');
                const isMobile = window.innerWidth <= 768;
                if (isMobile && info && !info.classList.contains('hidden-mobile')) {
                    toggleMobileInfo();
                }
            };
        }

        // Tutup Modal Tambah Materi saat klik background gelap
        const addModal = document.getElementById('addModal');
        if (addModal) {
            addModal.onclick = (e) => {
                if (e.target === addModal) {
                    addModal.classList.add('hidden');
                    unlockScroll();
                    self.clearForm();
                }
            };
        }

        // FIX: Scroll listener dipasang SEKALI di sini, bukan di dalam click handler
        const scrollContent = document.querySelector('.info-content-scroll');
        if (scrollContent) {
            scrollContent.addEventListener('scroll', () => {
                const info = document.getElementById('detailInfoSection');
                const isMobile = window.innerWidth <= 768;
                if (isMobile && info && !info.classList.contains('full-screen') && !info.classList.contains('hidden-mobile')) {
                    const isAtBottom = scrollContent.scrollTop + scrollContent.clientHeight >= scrollContent.scrollHeight - 5;
                    if (isAtBottom) toggleSheetHeight();
                }
            });
        }

        // Global Click Handler
        document.addEventListener("click", function (e) {
            // Handle Klik Kartu
            const card = e.target.closest(".course-card");
            if (card && card.classList.contains("clickable-card")) {
                const isInteractive =
                    self.state.editMode ||
                    e.target.closest("button") ||
                    e.target.closest("input") ||
                    e.target.closest(".delete-photo-btn") ||
                    e.target.closest(".reorder-handle");

                if (!isInteractive) {
                    const id = card.dataset.id;
                    const data = self.state.announcements.find(a => a.id == id);
                    if (data) openDetail(data);
                }
            }

            // Handle FAB Buttons
            if (e.target.closest("#toggleEditMode")) { e.preventDefault(); self.toggleEditMode(); }

            // Handle Card Actions
            if (e.target.closest(".delete-btn")) { e.preventDefault(); self.deleteAnnouncement(e.target.closest(".course-card")); }
            if (e.target.closest(".bookmark-btn")) { e.preventDefault(); self.toggleBookmark(e.target.closest(".course-card")); }
            if (e.target.closest(".camera-btn")) { e.preventDefault(); self.triggerPhotoUpload(e.target.closest(".course-card")); }
            if (e.target.closest(".delete-photo-btn")) { e.preventDefault(); self.deletePhoto(e.target.closest(".course-card"), e.target.closest(".delete-photo-btn").dataset.url); }

            // Handle Task Checklist
            const taskBtn = e.target.closest(".task-btn");
            if (taskBtn) {
                e.preventDefault(); e.stopPropagation();
                self.toggleTaskStatus(taskBtn.closest(".course-card"), taskBtn);
            }
        });
    },

    async toggleTaskStatus(card, btn) {
        const id = card.dataset.id;
        const isDone = btn.classList.contains("done");

        if (isDone) {
            btn.classList.remove("done"); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        } else {
            btn.classList.add("done"); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            if (isDone) {
                await supabase.from("user_progress").delete().eq("user_id", this.state.user.id).eq("announcement_id", id);
                this.state.completedTasks = this.state.completedTasks.filter(tid => tid !== id);
                btn.innerHTML = '<i class="fa-regular fa-circle"></i> Tandai Selesai';
            } else {
                await supabase.from("user_progress").insert({ user_id: this.state.user.id, announcement_id: id });
                this.state.completedTasks.push(id);
                btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Selesai';
            }
        } catch (err) {
            console.error("Task toggle error:", err);
            if (isDone) btn.classList.add("done"); else btn.classList.remove("done");
            showPopup("Gagal update status tugas", "error");
        }
    },

    async loadBookmarks() {
        try {
            const { data, error } = await supabase.from("bookmarks").select("announcement_id").eq("user_id", this.state.user.id);
            if (!error) this.state.bookmarks = data.map(b => String(b.announcement_id));
        } catch (err) { console.error("Bookmark load error:", err); }
    },

    async toggleBookmark(card) {
        const id = card.dataset.id;
        const btn = card.querySelector(".bookmark-btn");
        const icon = btn.querySelector("i");
        const isBookmarked = this.state.bookmarks.includes(id);

        try {
            if (isBookmarked) {
                await supabase.from("bookmarks").delete().eq("user_id", this.state.user.id).eq("announcement_id", id);
                this.state.bookmarks = this.state.bookmarks.filter(b => b !== id);
                btn.classList.remove("active"); icon.className = "fa-regular fa-bookmark";
            } else {
                await supabase.from("bookmarks").insert({ user_id: this.state.user.id, announcement_id: id });
                this.state.bookmarks.push(id);
                btn.classList.add("active"); icon.className = "fa-solid fa-bookmark";
            }
        } catch (err) { console.error("Bookmark toggle error:", err); showPopup("Gagal koneksi", "error"); }
    },

    async loadAnnouncements() {
        const container = document.getElementById("announcements");
        if (!container) return;
        container.innerHTML = "<h3 style='margin-top: 30px; margin-bottom: 20px;'>Materi & Pengumuman</h3><div class='sk-card'><div style='display: flex; gap: 12px; align-items: center; margin-bottom: 15px;'><div class='skeleton' style='width: 40px; height: 40px; border-radius: 50%;'></div><div class='skeleton' style='width: 100px; height: 12px;'></div></div><div class='skeleton sk-title'></div><div class='skeleton sk-text'></div></div><div class='sk-card'><div style='display: flex; gap: 12px; align-items: center; margin-bottom: 15px;'><div class='skeleton' style='width: 40px; height: 40px; border-radius: 50%;'></div><div class='skeleton' style='width: 100px; height: 12px;'></div></div><div class='skeleton sk-title'></div><div class='skeleton sk-text'></div></div><div class='sk-card'><div style='display: flex; gap: 12px; align-items: center; margin-bottom: 15px;'><div class='skeleton' style='width: 40px; height: 40px; border-radius: 50%;'></div><div class='skeleton' style='width: 100px; height: 12px;'></div></div><div class='skeleton sk-title'></div><div class='skeleton sk-text'></div></div><div class='sk-card'><div style='display: flex; gap: 12px; align-items: center; margin-bottom: 15px;'><div class='skeleton' style='width: 40px; height: 40px; border-radius: 50%;'></div><div class='skeleton' style='width: 100px; height: 12px;'></div></div><div class='skeleton sk-title'></div><div class='skeleton sk-text'></div></div><div class='sk-card'><div style='display: flex; gap: 12px; align-items: center; margin-bottom: 15px;'><div class='skeleton' style='width: 40px; height: 40px; border-radius: 50%;'></div><div class='skeleton' style='width: 100px; height: 12px;'></div></div><div class='skeleton sk-title'></div><div class='skeleton sk-text'></div></div>";

        try {
            let query = supabase.from("subject_announcements").select("*").eq("subject_id", this.state.subjectId);
            query = query.eq("class_id", getEffectiveClassId() || this.state.user.class_id);

            const cacheKey = `announcements_${this.state.subjectId}`;
            let data, error;
            try {
                const res = await query.order("display_order", { ascending: true }).order("created_at", { ascending: true });
                data = res.data; error = res.error;
                if (error) throw error;
                this.state.announcements = data || [];
                try { localStorage.setItem(cacheKey, JSON.stringify(this.state.announcements)); } catch (e) { /* ignore storage errors */ }
            } catch (err) {
                console.error("Load announcements failed, using cache if available:", err);
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    try { this.state.announcements = JSON.parse(cached); } catch (e) { this.state.announcements = []; }
                } else {
                    throw err; // biarkan catch luar tangani UI error
                }
            }

            if (this.state.isLessonMode) {
                // FIX: Jalankan progress + bookmarks bersamaan, bukan sekuensial
                const [progressRes] = await Promise.all([
                    supabase.from("user_progress").select("announcement_id").eq("user_id", this.state.user.id),
                    this.loadBookmarks()
                ]);
                if (progressRes.data) this.state.completedTasks = progressRes.data.map(p => String(p.announcement_id));
            } else {
                await this.loadBookmarks();
            }
            this.renderAnnouncements();

        } catch (err) {
            console.error("Load error:", err);
            container.innerHTML = "<p>Gagal memuat.</p>";
        }
    },

    renderAnnouncements() {
        const container = document.getElementById("announcements");

        const header = document.createElement("h3");
        header.style.marginTop = "30px";
        header.textContent = "Materi & Pengumuman";

        if (this.state.announcements.length === 0) {
            const empty = document.createElement("h3");
            empty.style.cssText = "color: #ff6200; padding:20px;";
            empty.textContent = "Belum ada materi";
            container.replaceChildren(header, empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        fragment.appendChild(header);
        this.state.announcements.forEach((item) => {
            fragment.appendChild(this.createCardElement(item));
        });
        container.replaceChildren(fragment);
    },

    createCardElement(data) {
        const card = document.createElement("div");
        card.dataset.id = data.id;
        card.style.position = "relative";
        card.draggable = false;

        const bigTitle = data.big_title || "";
        const title = data.title || "";
        const content = data.content || "";
        const small = data.small || "";

        // Tentukan class warna dari DB
        const colorClass = data.card_color && data.card_color !== 'default' ? `color-${data.card_color}` : "";
        card.className = `course-card ${colorClass}`;

        // DEFINISI isAdmin BIAR GAK ERROR "NOT DEFINED"
        const isAdmin = this.state.user && (this.state.user.role === 'class_admin' || this.state.user.role === 'super_admin');

        const photos = this._parsePhotoUrls(data.photo_url);

        let photoHTML = '';
        if (photos.length > 0) {
            photoHTML = this._buildPhotoGridHTML(photos);
            card.classList.add('clickable-card');
        } else {
            card.classList.remove('clickable-card');
            card.style.cursor = 'default';
        }

        const isSaved = this.state.bookmarks.includes(String(data.id));
        const btnClass = isSaved ? "bookmark-btn active" : "bookmark-btn";
        const iconClass = isSaved ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark";

        let taskBtnHTML = "";
        if (this.state.isLessonMode) {
            const isDone = this.state.completedTasks.includes(String(data.id));
            taskBtnHTML = `<button class="${isDone ? 'task-btn done' : 'task-btn'}">${isDone ? '<i class="fa-solid fa-circle-check"></i> Selesai' : '<i class="fa-regular fa-circle"></i> Selesai?'}</button>`;
        }

        const colorTools = `
<div class="card-color-tools" style="display:none; gap:5px; align-items:center; background:rgba(0,0,0,0.3); padding:5px 8px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'default')" style="width:14px; height:14px; border-radius:50%; background:#333; border:1px solid white; cursor:pointer;" title="Default"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'red')" style="width:14px; height:14px; border-radius:50%; background:#ff4757; cursor:pointer;" title="Merah"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'orange')" style="width:14px; height:14px; border-radius:50%; background:#ff9f43; cursor:pointer;" title="Jingga"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'yellow')" style="width:14px; height:14px; border-radius:50%; background:#ffd32a; cursor:pointer;" title="Kuning"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'green')" style="width:14px; height:14px; border-radius:50%; background:#2ed573; cursor:pointer;" title="Hijau"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'blue')" style="width:14px; height:14px; border-radius:50%; background:var(--accent, #00eaff); cursor:pointer;" title="Biru"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'purple')" style="width:14px; height:14px; border-radius:50%; background:#a55eea; cursor:pointer;" title="Ungu"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'pink')" style="width:14px; height:14px; border-radius:50%; background:#ff9ff3; cursor:pointer;" title="Pink"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'brown')" style="width:14px; height:14px; border-radius:50%; background:#8b4513; cursor:pointer;" title="Coklat"></div>
</div>`;

        card.innerHTML = `
        <input type="file" class="photo-input" accept="image/*" multiple style="display:none;">
        <div class="reorder-handle" style="display:none; position:absolute; top:10px; right:10px; z-index:50;">
            <div class="drag-grip" title="Tahan & geser untuk pindah urutan" style="
                background:rgba(0,234,255,0.15);
                border:1px solid rgba(0,234,255,0.3);
                color:var(--accent,#00eaff);
                width:32px; height:32px;
                border-radius:8px;
                cursor:grab;
                display:flex; align-items:center; justify-content:center;
                user-select:none; -webkit-user-select:none;
                touch-action:none;
            ">
                <i class="fa-solid fa-grip-vertical" style="pointer-events:none; font-size:14px;"></i>
            </div>
        </div>
        <button class="${btnClass}"><i class="${iconClass}"></i></button>
        ${photoHTML}
        <div class="pending-photo-preview" style="display:none; margin-bottom:12px;"></div>
        <h3 contenteditable="false" spellcheck="false" class="editable" data-field="big_title">${bigTitle}</h3>
        <h4 contenteditable="false" spellcheck="false" class="editable" data-field="title">${title}</h4>
        <div contenteditable="false" spellcheck="false" class="editable" data-field="content" style="margin-bottom: 15px;">${content}</div>
        <small contenteditable="false" spellcheck="false" class="editable" data-field="small">${small}</small>
        
        <div class="card-actions" style="margin-top:15px; display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
            <div style="flex-shrink: 0; display:flex; gap:8px; align-items:center;">
                ${taskBtnHTML}
                ${isAdmin ? `
                <button class="camera-btn" style="display:none; background:rgba(0,234,255,0.12); border:1px solid rgba(0,234,255,0.3); color:var(--accent,#00eaff); padding:7px 12px; border-radius:8px; cursor:pointer; font-size:13px; align-items:center; gap:6px;">
                    <i class="fa-solid fa-camera" style="pointer-events:none;"></i>
                </button>` : ''}
            </div>
            
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; flex:1;">
                ${isAdmin ? colorTools : ''}

                <button class="delete-btn" style="display:none; background:#f44336; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; margin-top:0 !important;" onclick="SubjectApp.deleteAnnouncement(this.closest('.course-card'))">
                    <i class="fa-solid fa-trash" style="margin-right:0;"></i>
                </button>
            </div>
        </div>
    `;
        return card;
    },


    async changeCardColor(id, color) {
        const card = document.querySelector(`.course-card[data-id="${id}"]`);
        if (!card) return;

        // Hapus SEMUA class warna yang mungkin ada
        card.classList.remove('color-red', 'color-orange', 'color-yellow', 'color-green', 'color-blue', 'color-purple', 'color-pink', 'color-brown');

        // Tambah warna baru jika bukan default
        if (color !== 'default') card.classList.add(`color-${color}`);

        try {
            const { error } = await supabase.from("subject_announcements").update({ card_color: color }).eq("id", id);
            if (error) throw error;
        } catch (err) {
            console.error("Gagal update warna:", err);
            showPopup("Gagal menyimpan warna ke database", "error");
        }
    },

    async toggleEditMode() {
        if (this.state.isToggling) return;
        this.state.isToggling = true;

        const container = document.getElementById("adminFabContainer");
        const toggleBtn = document.getElementById("toggleEditMode");
        const cards = document.querySelectorAll(".course-card");

        if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        // Tunggu animasi sebentar biar smooth
        await new Promise(resolve => setTimeout(resolve, 800));

        this.state.editMode = !this.state.editMode;

        // 1. UPDATE UI TOMBOL (FAB)
        if (toggleBtn && container) {
            if (this.state.editMode) {
                container.classList.add("active");
                toggleBtn.className = "fab-main state-done";
                toggleBtn.innerHTML = '<i class="fa-solid fa-check fab-icon"></i><span class="fab-label">Simpan</span>';
            } else {
                container.classList.remove("active");
                toggleBtn.className = "fab-main state-edit";
                toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square fab-icon"></i><span class="fab-label">Edit</span>';
            }
        }

        // 2. UPDATE SEMUA KARTU (UI Mode)
        cards.forEach(card => {
            const fields       = card.querySelectorAll(".editable");
            const deleteBtn    = card.querySelector(".delete-btn");
            const colorTools   = card.querySelector(".card-color-tools");
            const reorderHandle = card.querySelector(".reorder-handle");
            const cameraBtn    = card.querySelector(".camera-btn");
            const deletePhotoBtns = card.querySelectorAll(".delete-photo-btn");

            if (this.state.editMode) {
                card.classList.add("editable-mode");
                // draggable diatur dinamis oleh grip mousedown/touchstart — jangan set true di sini
                fields.forEach(f => {
                    f.contentEditable = "true";
                    f.style.pointerEvents = "auto";
                    f.style.cursor = "text";
                });
                if (deleteBtn) deleteBtn.style.display = "inline-block";
                if (colorTools) colorTools.style.display = "flex";
                if (reorderHandle) reorderHandle.style.display = "flex";
                if (cameraBtn) cameraBtn.style.display = "flex";
                deletePhotoBtns.forEach(b => b.style.display = "flex");
            } else {
                card.classList.remove("editable-mode");
                fields.forEach(f => { f.contentEditable = "false"; f.style.cursor = ""; });
                if (deleteBtn) deleteBtn.style.display = "none";
                if (colorTools) colorTools.style.display = "none";
                if (reorderHandle) reorderHandle.style.display = "none";
                if (cameraBtn) cameraBtn.style.display = "none";
                deletePhotoBtns.forEach(b => b.style.display = "none");
                card.draggable = false;
            }
        });

        // 3. SIMPAN DATA (Hanya saat keluar dari mode edit)
        if (!this.state.editMode) {
            await this.saveAllChanges();
        } else {
            this._initDragDrop();
        }

        this.state.isToggling = false;
    },

    async saveAllChanges() {
        const toggleBtn = document.getElementById("toggleEditMode");
        toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin fab-icon"></i><span class="fab-label">Menyimpan...</span>';
        toggleBtn.disabled = true;

        const cards = document.querySelectorAll(".course-card");

        try {
            // 1. Upload semua foto pending per card sebelum upsert
            for (const card of cards) {
                const pending = card._pendingFiles;
                if (!pending || pending.length === 0) continue;

                const id = card.dataset.id;
                const ann = this.state.announcements.find(a => String(a.id) === String(id));

                // Existing URLs — parse dulu biar selalu array bersih
                const existingUrls = this._parsePhotoUrls(ann?.photo_url);

                const newUrls = [];
                for (const { file, objUrl } of pending) {
                    try {
                        const fileName = `${this.state.subjectId}/${id}/${Date.now()}_${file.name}`;
                        const { error: uploadErr } = await supabase.storage.from('subject-photos').upload(fileName, file);
                        if (uploadErr) throw uploadErr;
                        const { data: urlData } = supabase.storage.from('subject-photos').getPublicUrl(fileName);
                        newUrls.push(urlData.publicUrl);
                    } catch (err) {
                        console.error('Upload gagal untuk satu foto:', err);
                    }
                    URL.revokeObjectURL(objUrl);
                }

                // Merge dan simpan ke state
                const mergedUrls = [...existingUrls, ...newUrls];
                if (ann) ann.photo_url = mergedUrls;

                // Bersihkan pending
                card._pendingFiles = [];
                const preview = card.querySelector('.pending-photo-preview');
                if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }

                // Re-render grid langsung di DOM tanpa refresh
                const oldGrid = card.querySelector('.photo-grid');
                if (oldGrid) oldGrid.remove();
                if (mergedUrls.length > 0) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this._buildPhotoGridHTML(mergedUrls, this.state.editMode);
                    const newGrid = tempDiv.firstElementChild;
                    const anchor = card.querySelector('.pending-photo-preview') || card.querySelector('h3');
                    card.insertBefore(newGrid, anchor);
                    card.classList.add('clickable-card');
                    card.style.cursor = '';
                }
            }

            // 2. Bangun array updates (sekarang photo_url sudah up-to-date di state)
            const updates = Array.from(cards).map((card, index) => {
                const id = card.dataset.id;
                const ann = this.state.announcements.find(a => String(a.id) === String(id));
                const getVal = (f) => card.querySelector(`[data-field="${f}"]`)?.innerText.trim() || "";
                const getContent = () => card.querySelector(`[data-field="content"]`)?.innerHTML || "";

                return {
                    id,
                    display_order: index + 1,
                    big_title: getVal("big_title"),
                    title: getVal("title"),
                    content: getContent(),
                    small: getVal("small"),
                    photo_url: this._serializePhotoUrls(this._parsePhotoUrls(ann?.photo_url)),
                    subject_id: this.state.subjectId,
                    class_id: getEffectiveClassId() || this.state.user.class_id
                };
            });

            const { error } = await supabase
                .from("subject_announcements")
                .upsert(updates, { onConflict: 'id' });
            if (error) throw error;

            // 3. Sync state lokal
            updates.forEach(u => {
                const ann = this.state.announcements.find(a => String(a.id) === String(u.id));
                if (ann) Object.assign(ann, u);
            });
            try {
                localStorage.setItem(`announcements_${this.state.subjectId}`, JSON.stringify(this.state.announcements));
            } catch (e) {}

            if (typeof showPopup === 'function') showPopup("Semua perubahan tersimpan!", "success");
        } catch (err) {
            console.error("Save failed:", err);
            showPopup("Gagal simpan data!", "error");
        } finally {
            toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square fab-icon"></i><span class="fab-label">Edit</span>';
            toggleBtn.disabled = false;
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // DRAG & DROP — Desktop (HTML5) + Mobile (Touch)
    // ═══════════════════════════════════════════════════════════════

    _initDragDrop() {
        const container = document.getElementById('announcements');
        if (!container || container._dragInitialized) return;
        container._dragInitialized = true;

        // ── AUTO-SCROLL (shared desktop + mobile) ────────────────────
        const SCROLL_ZONE  = 100;
        const SCROLL_MAX   = 20;
        let scrollRafId    = null;
        let cursorY        = 0;

        const startAutoScroll = () => {
            if (scrollRafId) return;
            const loop = () => {
                const vh = window.innerHeight;
                let speed = 0;
                if (cursorY < SCROLL_ZONE) {
                    // Quadratic: makin deket ujung makin kenceng
                    const t = 1 - cursorY / SCROLL_ZONE;
                    speed = -(SCROLL_MAX * t * t);
                } else if (cursorY > vh - SCROLL_ZONE) {
                    const t = 1 - (vh - cursorY) / SCROLL_ZONE;
                    speed = SCROLL_MAX * t * t;
                }
                if (speed !== 0) window.scrollBy(0, speed);
                scrollRafId = requestAnimationFrame(loop);
            };
            scrollRafId = requestAnimationFrame(loop);
        };
        const stopAutoScroll = () => {
            if (scrollRafId) { cancelAnimationFrame(scrollRafId); scrollRafId = null; }
        };

        // ── DESKTOP: HTML5 Drag & Drop ──────────────────────────────
        let dragSrcCard = null;
        let gripClicked = false;

        container.addEventListener('mousedown', (e) => {
            gripClicked = !!e.target.closest('.drag-grip');
            // Set draggable hanya pada card yang grip-nya diklik
            const card = e.target.closest('.course-card');
            if (card) card.draggable = gripClicked;
        });

        container.addEventListener('dragstart', (e) => {
            if (!gripClicked) { e.preventDefault(); return; }
            const card = e.target.closest('.course-card');
            if (!card) return;
            dragSrcCard = card;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.id);
            requestAnimationFrame(() => {
                card.style.opacity = '0.35';
                card.style.outline = '2px dashed rgba(0,234,255,0.4)';
            });
            startAutoScroll();
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!dragSrcCard) return;
            e.dataTransfer.dropEffect = 'move';
            cursorY = e.clientY;
            const target = e.target.closest('.course-card');
            if (target && target !== dragSrcCard) {
                this._showDropIndicator(container, target, e.clientY);
            }
        });

        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) this._removeDropIndicator();
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            stopAutoScroll();
            if (!dragSrcCard) return;
            const indicator = document.getElementById('_dnd_indicator');
            if (indicator) container.insertBefore(dragSrcCard, indicator);
            dragSrcCard.draggable = false;
            this._cleanupDrag(dragSrcCard);
            dragSrcCard = null; gripClicked = false;
        });

        container.addEventListener('dragend', () => {
            stopAutoScroll();
            if (dragSrcCard) {
                this._cleanupDrag(dragSrcCard);
                dragSrcCard.draggable = false;
            }
            dragSrcCard = null; gripClicked = false;
        });

        // ── MOBILE: Touch Drag — lightweight ghost ──────────────────
        let touchCard  = null;
        let ghost      = null;
        let lastTarget = null;
        let ghostInitX = 0, ghostInitY = 0;

        container.addEventListener('touchstart', (e) => {
            const grip = e.target.closest('.drag-grip');
            if (!grip) return;
            const card = grip.closest('.course-card');
            if (!card) return;

            touchCard  = card;
            lastTarget = null;
            const touch = e.touches[0];
            const rect  = card.getBoundingClientRect();

            // Ghost ringan: hanya ukuran + judul, bukan clone full DOM
            const title = card.querySelector('[data-field="big_title"]')?.innerText || '';
            ghost = document.createElement('div');
            ghost.style.cssText = `
                position: fixed;
                left: ${rect.left}px;
                top: ${rect.top}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                background: rgba(0,20,30,0.85);
                border: 2px solid rgba(0,234,255,0.7);
                border-radius: 14px;
                box-shadow: 0 16px 40px rgba(0,0,0,0.5), 0 0 20px rgba(0,234,255,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: none;
                z-index: 9999;
                will-change: transform;
                color: rgba(255,255,255,0.85);
                font-size: 15px;
                font-weight: 600;
                padding: 0 20px;
                text-align: center;
                overflow: hidden;
            `;
            ghost.innerHTML = `<i class="fa-solid fa-grip-vertical" style="margin-right:10px; color:rgba(0,234,255,0.8);"></i>${title}`;
            document.body.appendChild(ghost);

            ghostInitX = rect.left - (touch.clientX - rect.left);
            ghostInitY = rect.top  - (touch.clientY - rect.top);

            card.style.opacity    = '0.3';
            card.style.transition = 'opacity 0.15s';
            e.preventDefault();
            startAutoScroll();
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            if (!touchCard || !ghost) return;
            const touch = e.touches[0];
            cursorY = touch.clientY;

            // Gerak ghost via transform — zero reflow
            const dx = touch.clientX + ghostInitX;
            const dy = touch.clientY + ghostInitY;
            ghost.style.transform = `translate(${dx}px, ${dy}px)`;

            // Drop indicator — throttle via lastTarget
            ghost.style.visibility = 'hidden';
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            ghost.style.visibility = '';
            const target = el?.closest('.course-card');
            if (target && target !== touchCard && target !== lastTarget) {
                lastTarget = target;
                this._showDropIndicator(container, target, touch.clientY);
            }
            e.preventDefault();
        }, { passive: false });

        const onTouchEnd = () => {
            stopAutoScroll();
            if (!touchCard) return;
            const indicator = document.getElementById('_dnd_indicator');
            if (indicator) container.insertBefore(touchCard, indicator);
            if (ghost) { ghost.remove(); ghost = null; }
            touchCard.style.opacity    = '';
            touchCard.style.transition = '';
            this._cleanupDrag(touchCard);
            touchCard = null; lastTarget = null;
        };

        container.addEventListener('touchend',    onTouchEnd);
        container.addEventListener('touchcancel', onTouchEnd);
    },

    _showDropIndicator(container, target, clientY) {
        this._removeDropIndicator();
        const line = document.createElement('div');
        line.id = '_dnd_indicator';
        line.style.cssText = `
            height: 3px;
            background: var(--accent, #00eaff);
            border-radius: 3px;
            margin: 2px 0;
            box-shadow: 0 0 10px var(--accent, #00eaff), 0 0 20px rgba(0,234,255,0.4);
            pointer-events: none;
            animation: dndPulse 0.8s ease-in-out infinite alternate;
        `;
        // Inject keyframe sekali
        if (!document.getElementById('_dnd_style')) {
            const s = document.createElement('style');
            s.id = '_dnd_style';
            s.textContent = `@keyframes dndPulse { from { opacity:0.6; } to { opacity:1; } }`;
            document.head.appendChild(s);
        }
        const rect = target.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
            container.insertBefore(line, target);
        } else {
            target.after(line);
        }
    },

    _removeDropIndicator() {
        document.getElementById('_dnd_indicator')?.remove();
    },

    _cleanupDrag(card) {
        if (card) {
            card.style.opacity = '';
            card.style.outline = '';
        }
        this._removeDropIndicator();
        this.updateDisplayOrder();
    },

    moveCard(card, direction) {
        const container = document.getElementById("announcements");
        const cards = [...container.querySelectorAll(".course-card")];
        const index = cards.indexOf(card);

        if (direction === 'up' && index > 0) {
            container.insertBefore(card, cards[index - 1]);
        } else if (direction === 'down' && index < cards.length - 1) {
            container.insertBefore(cards[index + 1], card);
        } else {
            return; // Sudah di ujung, gak perlu ngapa-ngapain
        }

        // Update tombol panah (disable kalau udah di ujung)
        this.updateArrowButtons();
        this.updateDisplayOrder();
    },

    updateArrowButtons() {
        const container = document.getElementById("announcements");
        const cards = [...container.querySelectorAll(".course-card")];
        cards.forEach((card, i) => {
            const upBtn = card.querySelector(".move-up-btn");
            const downBtn = card.querySelector(".move-down-btn");
            if (upBtn) upBtn.style.opacity = i === 0 ? '0.3' : '1';
            if (downBtn) downBtn.style.opacity = i === cards.length - 1 ? '0.3' : '1';
        });
    },

    updateDisplayOrder() {
        // Cukup sync urutan ke state lokal — DB diurus saveAllChanges() saat keluar edit mode
        const cards = document.querySelectorAll(".course-card");
        Array.from(cards).forEach((card, index) => {
            const ann = this.state.announcements.find(a => String(a.id) === String(card.dataset.id));
            if (ann) ann.display_order = index + 1;
        });
    },

    // Bangun innerHTML photo-grid dari array URL — dipakai di createCardElement & re-render setelah delete
    _buildPhotoGridHTML(photos, editMode = false) {
        if (!photos || photos.length === 0) return '';
        const deleteBtnStyle = editMode
            ? 'display:flex; position:absolute; top:4px; left:4px; background:rgba(200,0,0,0.85); color:white; border:none; width:24px; height:24px; border-radius:6px; cursor:pointer; align-items:center; justify-content:center; font-size:11px; z-index:5;'
            : 'display:none; position:absolute; top:4px; left:4px; background:rgba(200,0,0,0.85); color:white; border:none; width:24px; height:24px; border-radius:6px; cursor:pointer; align-items:center; justify-content:center; font-size:11px; z-index:5;';

        const makeSlot = (url) => `
            <div class="photo-item photo-wrapper" style="position:relative;">
                <img src="${url}" loading="lazy">
                <button class="delete-photo-btn" data-url="${url}" style="${deleteBtnStyle}">
                    <i class="fa-solid fa-trash" style="pointer-events:none;"></i>
                </button>
            </div>`;

        let gridClass, imgsHTML;

        if (photos.length <= 4) {
            // Semua foto tampil penuh, semua bisa dihapus
            gridClass = `grid-${photos.length}`;
            imgsHTML  = photos.map(makeSlot).join('');
        } else {
            // Slot 1-3: foto biasa + tombol hapus
            // Slot 4: foto ke-4 tampil, sisanya jadi overlay "+N"
            gridClass = 'grid-4';
            imgsHTML  = photos.slice(0, 3).map(makeSlot).join('');
            // Slot 4 tetap bisa dihapus, overlay cuma teks
            imgsHTML += `
            <div class="photo-item photo-wrapper" style="position:relative;">
                <img src="${photos[3]}" loading="lazy">
                <div class="more-overlay" style="pointer-events:none;">+${photos.length - 4}</div>
                <button class="delete-photo-btn" data-url="${photos[3]}" style="${deleteBtnStyle}">
                    <i class="fa-solid fa-trash" style="pointer-events:none;"></i>
                </button>
            </div>`;
        }

        return `<div class="photo-grid ${gridClass}">${imgsHTML}</div>`;
    },


    // apapun formatnya (string JSON, plain string, array, null)
    _parsePhotoUrls(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed.startsWith('[')) {
                try { return JSON.parse(trimmed); } catch (e) {}
            }
            return [trimmed];
        }
        return [];
    },

    // Supabase menyimpan photo_url sebagai teks JSON — selalu kirim sebagai string
    _serializePhotoUrls(arr) {
        if (!arr || arr.length === 0) return null;
        return JSON.stringify(arr);
    },

    triggerPhotoUpload(card) {
        const fileInput = card.querySelector(".photo-input");
        if (!fileInput) return;
        fileInput.value = ''; // reset biar bisa pilih file yang sama
        fileInput.click();
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;

            if (!card._pendingFiles) card._pendingFiles = [];

            for (let file of files) {
                if (!file.type.startsWith('image/')) continue;
                try { file = await this.compressImage(file); } catch (err) {}
                if (file.size > 5 * 1024 * 1024) { showPopup("Max 5MB per foto", "error"); continue; }
                const objUrl = URL.createObjectURL(file);
                card._pendingFiles.push({ file, objUrl });
            }

            this._renderPendingPreviews(card);
        };
    },

    _renderPendingPreviews(card) {
        const container = card.querySelector('.pending-photo-preview');
        if (!container) return;
        const pending = card._pendingFiles || [];
        if (pending.length === 0) { container.style.display = 'none'; container.innerHTML = ''; return; }

        container.style.display = 'flex';
        container.style.cssText += 'flex-wrap:wrap; gap:6px; margin-bottom:12px;';
        container.innerHTML = pending.map((p, i) => `
            <div style="position:relative; width:72px; height:72px; border-radius:8px; overflow:hidden; border:2px solid rgba(0,234,255,0.5);">
                <img src="${p.objUrl}" style="width:100%; height:100%; object-fit:cover;">
                <div style="position:absolute; inset:0; background:rgba(0,0,0,0.35); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;">
                    <i class="fa-solid fa-clock" style="color:#00eaff; font-size:10px;"></i>
                    <span style="font-size:8px; color:#00eaff; font-weight:700;">PENDING</span>
                </div>
                <button data-pending-index="${i}" style="position:absolute; top:2px; right:2px; background:rgba(200,0,0,0.85); border:none; color:white; width:18px; height:18px; border-radius:4px; cursor:pointer; font-size:9px; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-xmark" style="pointer-events:none;"></i>
                </button>
            </div>
        `).join('');

        // Handle hapus pending per item
        container.querySelectorAll('button[data-pending-index]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.pendingIndex);
                const removed = card._pendingFiles.splice(idx, 1)[0];
                if (removed?.objUrl) URL.revokeObjectURL(removed.objUrl);
                this._renderPendingPreviews(card);
            };
        });
    },

    async deletePhoto(card, urlToDelete) {
        if (!await showPopup("Hapus foto ini?", "confirm")) return;
        const id = card.dataset.id;
        const ann = this.state.announcements.find(a => a.id == id);

        try {
            // Hapus dari storage
            if (urlToDelete?.includes('/subject-photos/')) {
                const path = decodeURIComponent(urlToDelete.split('/subject-photos/')[1]);
                await supabase.storage.from('subject-photos').remove([path]);
            }

            // Parse dulu, filter, lalu serialize kembali ke string
            const currentUrls = this._parsePhotoUrls(ann?.photo_url);
            const newUrls     = currentUrls.filter(u => u !== urlToDelete);
            const newVal      = this._serializePhotoUrls(newUrls);

            await supabase.from("subject_announcements").update({ photo_url: newVal }).eq("id", id);

            // Update state
            if (ann) ann.photo_url = newUrls.length === 0 ? null : newUrls;

            // Re-render grid dari awal biar urutan & overlay selalu bener
            const oldGrid = card.querySelector('.photo-grid');
            if (oldGrid) oldGrid.remove();

            if (newUrls.length > 0) {
                const newGridHTML = this._buildPhotoGridHTML(newUrls, this.state.editMode);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newGridHTML;
                const newGrid = tempDiv.firstElementChild;
                // Sisipkan sebelum pending-photo-preview atau h3
                const anchor = card.querySelector('.pending-photo-preview') || card.querySelector('h3');
                card.insertBefore(newGrid, anchor);
                card.classList.add('clickable-card');
                card.style.cursor = '';
            } else {
                card.classList.remove('clickable-card');
                card.style.cursor = 'default';
            }

            showPopup("Foto dihapus", "success");
        } catch (err) {
            console.error(err);
            showPopup("Gagal hapus foto", "error");
        }
    },

    async saveAnnouncement(card) {
        const id = card.dataset.id;
        const getData = (field) => {
            const el = card.querySelector(`[data-field="${field}"]`);
            if (!el) return "";
            // Jika field deskripsi (content), ambil innerHTML-nya
            return field === 'content' ? el.innerHTML : el.innerText.trim();
        };
        try {
            await supabase.from("subject_announcements").update({
                big_title: getData("big_title"),
                title: getData("title"),
                content: getData("content"),
                small: getData("small")
            }).eq("id", id);
        } catch (err) { console.error(err); }
    },

    async deleteAnnouncement(card) {
        if (!await showPopup("Hapus materi ini?", "confirm")) return;
        const id = card.dataset.id;
        await supabase.from("subject_announcements").delete().eq("id", id);
        card.remove();
        this.state.announcements = this.state.announcements.filter(a => a.id !== id);
        showPopup("Terhapus!", "success");
    },

    // ── DRAFT KEY (unik per subject) ─────────────────────────────
    _draftKey() {
        return `add_draft_${this.state.subjectId}`;
    },

    _saveDraft() {
        try {
            sessionStorage.setItem(this._draftKey(), JSON.stringify({
                big: document.getElementById('addJudul')?.value || '',
                tit: document.getElementById('addSubjudul')?.value || '',
                con: document.getElementById('addIsi')?.innerHTML || '',
                sml: document.getElementById('addSmall')?.value || '',
                color: this.state.selectedColor
            }));
        } catch (e) { }
    },

    _restoreDraft() {
        try {
            const raw = sessionStorage.getItem(this._draftKey());
            if (!raw) return false;
            const d = JSON.parse(raw);
            if (!d.big && !d.tit && !d.con) return false;
            if (d.big) document.getElementById('addJudul').value = d.big;
            if (d.tit) document.getElementById('addSubjudul').value = d.tit;
            if (d.con) document.getElementById('addIsi').innerHTML = d.con;
            if (d.sml) document.getElementById('addSmall').value = d.sml;
            if (d.color) {
                this.state.selectedColor = d.color;
                document.querySelectorAll('#addColors .color-opt').forEach(opt => {
                    opt.classList.toggle('active', opt.dataset.color === d.color);
                });
            }
            return true;
        } catch (e) { return false; }
    },

    _clearDraft() {
        try { sessionStorage.removeItem(this._draftKey()); } catch (e) { }
    },

    initAdd() {
        const modal = document.getElementById('addModal');
        const btnAdd = document.getElementById('addAnnouncementBtn');
        if (!modal || !btnAdd) return;

        const btnSave = document.getElementById('btnSaveAdd');
        const btnCancel = document.getElementById('btnCancelAdd');
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('addFiles');

        // List warna yang tersedia (sesuai data-color di HTML)
        const availableColors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'];

        if (!btnAdd) return;
        btnAdd.onclick = (e) => { e.preventDefault(); modal.classList.remove('hidden'); lockScroll(); this.tempFiles = []; document.getElementById('previewContainer').innerHTML = ''; };
        if (btnCancel) btnCancel.onclick = () => { modal.classList.add('hidden'); unlockScroll(); /* Draft sengaja TIDAK dihapus */ };
        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleNewFiles(e.target.files);
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
        dropZone.ondragleave = () => dropZone.classList.remove('dragover');
        dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); this.handleNewFiles(e.dataTransfer.files); };

        const colorOpts = document.querySelectorAll('#addColors .color-opt');
        colorOpts.forEach(opt => {
            opt.onclick = () => {
                colorOpts.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.state.selectedColor = opt.dataset.color;
            };
        });


        // ── Autosave draft saat user ngetik ──────────────────────
        ['addJudul', 'addSubjudul', 'addIsi', 'addSmall'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this._saveDraft());
        });

        if (btnSave) {
            btnSave.onclick = async () => {
                const data = {
                    big: document.getElementById('addJudul').value,
                    tit: document.getElementById('addSubjudul').value,
                    con: document.getElementById('addIsi').innerHTML,
                    sml: document.getElementById('addSmall').value,
                    files: this.tempFiles,
                    cardColor: this.state.selectedColor
                };

                if (!data.big) { showPopup("Judul wajib!", "error"); return; }

                btnSave.innerHTML = 'Sending...'; btnSave.disabled = true;
                await this.uploadAndSave(data);
                btnSave.innerHTML = 'Posting'; btnSave.disabled = false;
                modal.classList.add('hidden');
                unlockScroll();
                this._clearDraft();
                this.clearForm();
            };
        }

        btnAdd.onclick = (e) => {
            e.preventDefault();
            modal.classList.remove('hidden');
            lockScroll();
            this.tempFiles = [];
            document.getElementById('previewContainer').innerHTML = '';

            // Coba restore draft dulu
            const hasDraft = this._restoreDraft();

            if (!hasDraft) {
                // Tidak ada draft → random warna + tanggal hari ini
                const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
                this.state.selectedColor = randomColor;
                const colorOpts = document.querySelectorAll('#addColors .color-opt');
                colorOpts.forEach(opt => {
                    opt.classList.toggle('active', opt.dataset.color === randomColor);
                });
                const el = document.getElementById('addSmall');
                if (el) el.value = getTodayIndo();
            }

            // Catat history untuk tombol back mobile
            history.pushState({ type: 'overlay', target: 'addModal' }, '');
        };
    },

    async handleNewFiles(files) {
        const pc = document.getElementById('previewContainer');
        for (let file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;
            try { file = await this.compressImage(file); } catch (e) { }
            this.tempFiles.push(file);
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `<img src="${URL.createObjectURL(file)}"><div class="preview-remove"><i class="fa-solid fa-trash"></i></div>`;
            div.onclick = (e) => { e.stopPropagation(); this.tempFiles = this.tempFiles.filter(f => f !== file); div.remove(); };
            pc.appendChild(div);
        }
    },

    clearForm() {
        document.getElementById('addJudul').value = '';
        document.getElementById('addSubjudul').value = '';
        document.getElementById('addIsi').innerHTML = ''; // Reset innerHTML
        document.getElementById('addSmall').value = '';
        document.getElementById('addFiles').value = '';
        document.getElementById('previewContainer').innerHTML = '';
        this.tempFiles = [];
    },

    async uploadAndSave(d) {
        // Upload semua foto secara parallel (bukan satu-satu)
        const urls = (await Promise.all(
            d.files.map(async (f) => {
                const name = `${this.state.subjectId}/new/${Date.now()}_${f.name.replace(/\s/g, '_')}`;
                const { data } = await supabase.storage.from('subject-photos').upload(name, f);
                if (!data) return null;
                return supabase.storage.from('subject-photos').getPublicUrl(name).data.publicUrl;
            })
        )).filter(Boolean); // Buang yang null (gagal upload)

        const { error } = await supabase.from('subject_announcements').insert({
            subject_id: this.state.subjectId, class_id: getEffectiveClassId() || this.state.user.class_id,
            big_title: d.big, title: d.tit, content: d.con, small: d.sml,
            photo_url: urls.length > 1 ? urls : (urls[0] || null),
            card_color: d.cardColor,
            display_order: this.state.announcements.length + 1
        });
        if (!error) location.reload();
    },



    setupShortcuts() {
        // Guard: pastikan listener hanya dipasang sekali
        if (this._shortcutsInitialized) return;
        this._shortcutsInitialized = true;

        document.addEventListener('keydown', (e) => {
            const addModal = document.getElementById('addModal');
            const isAddModalOpen = addModal && !addModal.classList.contains('hidden');

            // [BARU] Shortcut Navigasi Detail & Foto (Desktop)
            const detailOverlay = document.getElementById('detailOverlay');
            const isDetailActive = detailOverlay && detailOverlay.classList.contains('active');

            if (isDetailActive) {
                if (e.key === 'ArrowRight') { e.preventDefault(); nextSlide(); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDetail();
                    return; // Biar gak bentrok sama Escape modal
                }
                // Kalau detail lagi kebuka, kita batasi shortcut lain biar gak ganggu
                if (e.key.startsWith('Arrow')) return;
            }

            // Shortcut Ukuran Teks (Rich Text) yang sebelumnya
            if (e.ctrlKey && (e.key === 'j' || e.key === 'k' || e.key === 'l')) {
                e.preventDefault();
                if (e.key === 'j') formatText('5'); // Besar
                if (e.key === 'k') formatText('3'); // Sedang
                if (e.key === 'l') formatText('2'); // Kecil
                return;
            }

            if (e.ctrlKey && e.code === 'Enter') {
                e.preventDefault();
                if (isAddModalOpen) {
                    document.getElementById('btnSaveAdd')?.click();
                } else {
                    document.getElementById("toggleEditMode")?.click();
                }
            }

            if (e.ctrlKey && e.key === '\\') {
                e.preventDefault();
                if (!isAddModalOpen) {
                    document.getElementById("addAnnouncementBtn")?.click();
                    setTimeout(() => document.getElementById('addJudul')?.focus(), 100);
                }
                if (isDetailActive) closeDetail();
                if (isAddModalOpen) {
                    document.getElementById('btnCancelAdd')?.click();
                }
            }

            // Escape Global (untuk modal)
            if (e.key === 'Escape' && isAddModalOpen) {
                document.getElementById('btnCancelAdd')?.click();
            }
        });
    },

    compressImage: async function (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const max = 1024;
                    let w = img.width, h = img.height;
                    if (w > max) { h *= max / w; w = max; }
                    canvas.width = w; canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(b => resolve(new File([b], file.name, { type: 'image/jpeg', lastModified: Date.now() })), 'image/jpeg', 0.6);
                };
            };
            reader.onerror = reject;
        });
    }
};

function getTodayIndo() {
    const d = new Date();
    return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

let currentViewerPhotos = [], currentViewerIndex = 0;
function openDetail(data) {
    const overlay = document.getElementById('detailOverlay');
    const info = document.getElementById('detailInfoSection');
    const btn = document.getElementById('toggleInfoBtn');
    const detailBox = overlay.querySelector('.glass-detail-box');

    document.getElementById('detailBigTxt').innerText = data.big_title || '';
    document.getElementById('detailTitleTxt').innerText = data.title || '';
    document.getElementById('detailContentTxt').innerHTML = data.content || '';
    document.getElementById('detailSmallTxt').innerText = data.small || '';

    let photos = [];
    if (data.photo_url) {
        try { photos = Array.isArray(data.photo_url) ? data.photo_url : JSON.parse(data.photo_url); }
        catch { photos = [data.photo_url]; }
    }
    if (photos.length === 0) detailBox.classList.add('text-only-mode');
    else detailBox.classList.remove('text-only-mode');
    if (window.innerWidth <= 768) {
        info.classList.add('hidden-mobile');
        info.classList.remove('full-screen');
        if (btn) btn.style.display = 'flex';
    } else {
        info.classList.remove('hidden-mobile', 'full-screen');
        if (btn) btn.style.display = 'none';
    }

    currentViewerPhotos = photos;
    currentViewerIndex = 0;
    updateSliderUI();
    overlay.classList.add('active');
    lockScroll();
    history.pushState({ type: 'overlay', target: 'detail' }, '');
}

function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('active');
    unlockScroll();
}

function updateSliderUI() {
    const imgEl = document.getElementById('detailImg');
    const nav = document.getElementById('sliderNavBtns');
    const wrapper = imgEl?.closest('.slider-wrapper');

    if (!nav || !imgEl || !wrapper) return;

    if (currentViewerPhotos.length === 0) {
        imgEl.style.display = 'none';
        nav.style.display = 'none';
        return;
    }

    wrapper.classList.add('loading');

    imgEl.style.display = 'block';
    imgEl.src = currentViewerPhotos[currentViewerIndex];

    imgEl.onload = () => {
        wrapper.classList.remove('loading');
    };

    imgEl.onerror = () => {
        wrapper.classList.remove('loading');
        imgEl.src = 'icons/error-img.png';
    };

    const tag = document.getElementById('photoCounterTag');
    if (tag) tag.innerText = `${currentViewerIndex + 1} / ${currentViewerPhotos.length}`;

    const isMulti = currentViewerPhotos.length > 1;
    nav.style.display = isMulti ? 'flex' : 'none';

    if (isMulti) {
        const btnPrev = nav.querySelector('.prev-btn');
        const btnNext = nav.querySelector('.next-btn');
        if (btnPrev) btnPrev.style.visibility = (currentViewerIndex === 0) ? 'hidden' : 'visible';
        if (btnNext) btnNext.style.visibility = (currentViewerIndex === currentViewerPhotos.length - 1) ? 'hidden' : 'visible';
    }
}
function nextSlide(e) { if (e) e.stopPropagation(); if (currentViewerIndex < currentViewerPhotos.length - 1) { currentViewerIndex++; updateSliderUI(); } }
function prevSlide(e) { if (e) e.stopPropagation(); if (currentViewerIndex > 0) { currentViewerIndex--; updateSliderUI(); } }

// ── Swipe gesture untuk detail photo viewer ──────────────────
(function initSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;

    document.addEventListener('touchstart', function (e) {
        const overlay = document.getElementById('detailOverlay');
        if (!overlay || !overlay.classList.contains('active')) return;
        if (currentViewerPhotos.length <= 1) return;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isSwiping = true;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!isSwiping) return;
        isSwiping = false;

        const overlay = document.getElementById('detailOverlay');
        if (!overlay || !overlay.classList.contains('active')) return;
        if (currentViewerPhotos.length <= 1) return;

        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;

        // Minimal 50px horizontal, dan lebih horizontal dari vertikal
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

        if (dx < 0) nextSlide();  // geser kiri → foto berikutnya
        else prevSlide();          // geser kanan → foto sebelumnya
    }, { passive: true });
})();
function showMobileInfo(e) {
    if (e) e.stopPropagation();
    const info = document.getElementById('detailInfoSection');
    const btn = document.getElementById('toggleInfoBtn');

    info.classList.remove('hidden-mobile');
    if (btn) btn.style.display = 'none';
}

function toggleSheetHeight(e) {
    if (e) e.stopPropagation();
    const info = document.getElementById('detailInfoSection');
    const btn = document.getElementById('sheetToggleBtn');
    if (!info || !btn) return;

    const icon = btn.querySelector('i');
    const isFull = info.classList.contains('full-screen');

    if (isFull) {
        info.classList.remove('full-screen');
        if (icon) icon.className = 'fa-solid fa-expand';
    } else {
        info.classList.remove('hidden-mobile');
        info.classList.add('full-screen');
        if (icon) icon.className = 'fa-solid fa-compress';
    }
}

function toggleMobileInfo(e) {
    if (e) e.stopPropagation();
    const info = document.getElementById('detailInfoSection');
    const btn = document.getElementById('toggleInfoBtn');
    const toggleIcon = document.querySelector('#sheetToggleBtn i');

    if (info) {
        info.classList.add('hidden-mobile');
        info.classList.remove('full-screen');
    }
    if (btn) btn.style.display = 'flex';
    if (toggleIcon) toggleIcon.className = 'fa-solid fa-expand';
}

function formatText(size) {
    document.execCommand('fontSize', false, size);
}