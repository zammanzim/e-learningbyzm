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
        bookmarks: []
    },

    init(subjectId, subjectName, isLesson = false) {
        if (typeof supabase === 'undefined') return;

        this.state.subjectId = subjectId;
        this.state.subjectName = subjectName;
        this.state.isLessonMode = isLesson;
        this.state.user = this.getUserData();

        if (!this.state.user) {
            window.location.href = "index.html";
            return;
        }

        console.log("✅ Subject loaded:", subjectName);

        this.updatePageTitle();
        this.updateWelcomeText();
        this.setupAdminControls();
        this.setupEventListeners();
        this.loadAnnouncements();
        this.setupShortcuts();
        this.initAdd();
    },

    getUserData() {
        if (typeof getUser === 'function') return getUser();
        const userData = localStorage.getItem("user");
        return userData ? JSON.parse(userData) : null;
    },

    updatePageTitle() {
        document.title = this.state.subjectName;
        const pageTitle = document.getElementById("pageTitle");
        if (pageTitle) pageTitle.innerText = this.state.subjectName;
    },

    updateWelcomeText() {
        const welcomeEl = document.getElementById("welcomeText");
        if (welcomeEl) welcomeEl.innerText = `${this.state.subjectName}`;
    },

    setupAdminControls() {
        const isAdmin = (this.state.user.role === "class_admin" || this.state.user.role === "super_admin");
        const editControls = document.getElementById("editControls");
        if (editControls) editControls.style.display = 'contents';

        if (isAdmin && editControls) {
            editControls.innerHTML = `
                <div id="adminFabContainer" class="admin-fab-container">
                    <button id="toggleEditMode" class="fab-main state-edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button id="addAnnouncementBtn" class="fab-add">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            `;
        }
    },

    // ==========================================
    // [UPDATE] EVENT LISTENERS (Background Click)
    // ==========================================
    setupEventListeners() {
        const self = this;

        // 1. [BARU] Tutup Detail Overlay saat klik background gelap
        const detailOverlay = document.getElementById('detailOverlay');
        if (detailOverlay) {
            detailOverlay.onclick = (e) => {
                // Cek apakah yang diklik benar-benar background (bukan isi konten)
                if (e.target === detailOverlay) {
                    detailOverlay.classList.remove('active');
                }
            };
        }

        // 2. [BARU] Tutup Modal Tambah Materi saat klik background gelap
        const addModal = document.getElementById('addModal');
        if (addModal) {
            addModal.onclick = (e) => {
                if (e.target === addModal) {
                    addModal.classList.add('hidden');
                    self.clearForm(); // Opsional: Reset form
                }
            };
        }

        // 3. Global Click Handler
        document.addEventListener("click", function (e) {
            // Handle Klik Kartu
            const card = e.target.closest(".course-card");
            if (card && card.classList.contains("clickable-card")) {
                const isInteractive =
                    self.state.editMode ||
                    e.target.closest("button") ||
                    e.target.closest("input") ||
                    e.target.closest(".delete-photo-btn") ||
                    e.target.closest(".drag-handle");

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
            if (e.target.closest(".upload-photo-btn")) { e.preventDefault(); self.triggerPhotoUpload(e.target.closest(".course-card")); }
            if (e.target.closest(".delete-photo-btn")) { e.preventDefault(); self.deletePhoto(e.target.closest(".course-card")); }

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
        container.innerHTML = "<h3>Materi & Pengumuman</h3><p style='color:#666; padding:20px;'>Memuat...</p>";

        try {
            let query = supabase.from("subject_announcements").select("*").eq("subject_id", this.state.subjectId);
            if (this.state.user && this.state.user.class_id) query = query.eq("class_id", this.state.user.class_id);

            const { data, error } = await query.order("display_order", { ascending: true }).order("created_at", { ascending: true });
            if (error) throw error;
            this.state.announcements = data || [];

            if (this.state.isLessonMode) {
                const { data: prog } = await supabase.from("user_progress").select("announcement_id").eq("user_id", this.state.user.id);
                if (prog) this.state.completedTasks = prog.map(p => String(p.announcement_id));
            }

            await this.loadBookmarks();
            this.renderAnnouncements();

        } catch (err) {
            console.error("Load error:", err);
            container.innerHTML = "<p>Gagal memuat.</p>";
        }
    },

    renderAnnouncements() {
        const container = document.getElementById("announcements");
        container.innerHTML = "<h3>Materi & Pengumuman</h3>";

        if (this.state.announcements.length === 0) {
            container.innerHTML += "<p style='color:#666; padding:20px;'>Belum ada materi</p>";
            return;
        }
        this.state.announcements.forEach((item) => {
            container.appendChild(this.createCardElement(item));
        });
    },

    createCardElement(data) {
        const card = document.createElement("div");
        card.className = "course-card";
        card.dataset.id = data.id;
        card.style.position = "relative";
        card.draggable = false;

        const bigTitle = data.big_title || "";
        const title = data.title || "";
        const content = data.content || "";
        const small = data.small || "";

        let photoHTML = "";
        let photos = [];
        if (data.photo_url) {
            if (Array.isArray(data.photo_url)) photos = data.photo_url;
            else if (typeof data.photo_url === 'string') {
                try {
                    if (data.photo_url.startsWith('[')) photos = JSON.parse(data.photo_url);
                    else photos = [data.photo_url];
                } catch (e) { photos = [data.photo_url]; }
            }
        }

        if (photos.length > 0) {
            let gridClass = `grid-${Math.min(photos.length, 4)}`;
            let imgsHTML = photos.slice(0, 4).map(url => `<img src="${url}" class="photo-item">`).join('');
            if (photos.length > 4) {
                gridClass = 'grid-4';
                imgsHTML = photos.slice(0, 3).map(url => `<img src="${url}" class="photo-item">`).join('') +
                    `<div class="photo-item photo-wrapper"><img src="${photos[3]}"><div class="more-overlay">+${photos.length - 4}</div></div>`;
            }
            photoHTML = `<div class="photo-grid ${gridClass}">${imgsHTML}</div>`;
            card.classList.add('clickable-card');
        } else {
            card.classList.remove('clickable-card');
            card.style.cursor = "default";
        }

        const isSaved = this.state.bookmarks.includes(String(data.id));
        const btnClass = isSaved ? "bookmark-btn active" : "bookmark-btn";
        const iconClass = isSaved ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark";

        let taskBtnHTML = "";
        if (this.state.isLessonMode) {
            const isDone = this.state.completedTasks.includes(String(data.id));
            taskBtnHTML = `<button class="${isDone ? 'task-btn done' : 'task-btn'}">${isDone ? '<i class="fa-solid fa-circle-check"></i> Selesai' : '<i class="fa-regular fa-circle"></i> Tandai Selesai'}</button>`;
        }

        card.innerHTML = `
            <input type="file" class="photo-input" accept="image/*" style="display:none;">
            <div class="drag-handle" style="display:none; position:absolute; top:10px; right:10px; z-index:50; cursor:grab; padding: 10px; color: #00eaff; background: rgba(0,0,0,0.5); border-radius: 8px; touch-action: none; user-select: none;">
                <i class="fa-solid fa-grip-vertical" style="font-size: 18px; pointer-events: none;"></i>
            </div>
            <button class="${btnClass}"><i class="${iconClass}"></i></button>
            ${photoHTML}
            <h3 contenteditable="false" spellcheck="false" class="editable" data-field="big_title">${bigTitle}</h3>
            <h4 contenteditable="false" spellcheck="false" class="editable" data-field="title">${title}</h4>
            <p contenteditable="false" spellcheck="false" class="editable" data-field="content">${content}</p>
            <small contenteditable="false" spellcheck="false" class="editable" data-field="small">${small}</small>
            <div class="card-actions" style="margin-top:15px; display:flex; gap:10px; align-items:center; justify-content:space-between;">
                ${taskBtnHTML} 
                <button class="delete-btn" style="display:none; background:#f44336; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        return card;
    },

    async toggleEditMode() {
        if (this.state.isToggling) return;
        this.state.isToggling = true;

        const container = document.getElementById("adminFabContainer");
        const toggleBtn = document.getElementById("toggleEditMode");
        const cards = document.querySelectorAll(".course-card");

        if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        await new Promise(resolve => setTimeout(resolve, 1000));

        this.state.editMode = !this.state.editMode;

        if (toggleBtn && container) {
            if (this.state.editMode) {
                container.classList.add("active");
                toggleBtn.classList.remove("state-edit"); toggleBtn.classList.add("state-done");
                toggleBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                container.classList.remove("active");
                toggleBtn.classList.remove("state-done"); toggleBtn.classList.add("state-edit");
                toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
            }
        }

        cards.forEach(card => {
            const fields = card.querySelectorAll(".editable");
            const deleteBtn = card.querySelector(".delete-btn");
            const dragHandle = card.querySelector(".drag-handle");
            const placeholder = card.querySelector(".card-photo-placeholder");
            const deletePhotoBtn = card.querySelector(".delete-photo-btn");

            if (this.state.editMode) {
                card.classList.add("editable-mode");
                card.draggable = false;
                fields.forEach(f => {
                    f.contentEditable = "true";
                    f.style.pointerEvents = "auto";
                });

                if (deleteBtn) deleteBtn.style.display = "inline-block";
                if (dragHandle) {
                    dragHandle.style.display = "block";
                    this.setupDragEvents(card, dragHandle);
                }
                if (placeholder) placeholder.style.display = "block";
                if (deletePhotoBtn) deletePhotoBtn.style.display = "block";
            } else {
                card.classList.remove("editable-mode");
                card.draggable = false;
                fields.forEach(f => f.contentEditable = "false");

                if (deleteBtn) deleteBtn.style.display = "none";
                if (dragHandle) dragHandle.style.display = "none";
                if (placeholder) placeholder.style.display = "none";
                if (deletePhotoBtn) deletePhotoBtn.style.display = "none";
                this.saveAnnouncement(card);
            }
        });

        this.state.isToggling = false;
        if (this.state.editMode) this.enableDragDrop();
        else this.disableDragDrop();
    },

    setupDragEvents(card, handle) {
        handle.onmousedown = (e) => { card.draggable = true; };
        handle.onmouseup = () => { card.draggable = false; };
        handle.oncontextmenu = (e) => { e.preventDefault(); return false; };

        card.ondragstart = (e) => {
            e.dataTransfer.effectAllowed = "move";
            card.classList.add("dragging");
            card.querySelectorAll('.editable').forEach(el => el.style.pointerEvents = 'none');
        };

        card.ondragend = (e) => {
            card.classList.remove("dragging");
            card.draggable = false;
            card.querySelectorAll('.editable').forEach(el => el.style.pointerEvents = 'auto');
            this.updateDisplayOrder();
        };

        card.ondragover = (e) => {
            e.preventDefault();
            this.handleDragOverLogic(e.clientY);
        };

        let longPressTimer;
        let isDraggingMobile = false;
        let startY = 0;

        handle.ontouchstart = (e) => {
            if (e.cancelable) e.preventDefault();
            startY = e.touches[0].clientY;
            longPressTimer = setTimeout(() => {
                isDraggingMobile = true;
                if (navigator.vibrate) navigator.vibrate(50);
                card.classList.add("dragging");
                card.classList.add("mobile-drag-active");
                card.querySelectorAll('.editable').forEach(el => el.style.pointerEvents = 'none');
            }, 300);
        };

        handle.ontouchmove = (e) => {
            if (!isDraggingMobile) { clearTimeout(longPressTimer); return; }
            if (e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            this.handleAutoScroll(touch.clientY);
            this.handleDragOverLogic(touch.clientY);
        };

        handle.ontouchend = () => {
            clearTimeout(longPressTimer);
            clearInterval(this.scrollTimer);
            if (isDraggingMobile) {
                isDraggingMobile = false;
                card.classList.remove("dragging");
                card.classList.remove("mobile-drag-active");
                card.querySelectorAll('.editable').forEach(el => el.style.pointerEvents = 'auto');
                this.updateDisplayOrder();
            }
        };
    },

    handleAutoScroll(y) {
        clearInterval(this.scrollTimer);
        const threshold = 100;
        const speed = 10;

        if (y < threshold) {
            window.scrollBy(0, -speed);
            this.scrollTimer = setTimeout(() => this.handleAutoScroll(y), 16);
        } else if (y > window.innerHeight - threshold) {
            window.scrollBy(0, speed);
            this.scrollTimer = setTimeout(() => this.handleAutoScroll(y), 16);
        }
    },

    handleDragOverLogic(y) {
        const container = document.getElementById("announcements");
        const dragging = document.querySelector(".dragging");
        if (!dragging) return;
        const afterElement = this.getDragAfterElement(container, y);
        if (afterElement == null) {
            if (dragging.nextSibling) container.appendChild(dragging);
        } else {
            if (afterElement !== dragging.nextSibling) container.insertBefore(dragging, afterElement);
        }
    },

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll(".course-card:not(.dragging)")];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    async updateDisplayOrder() {
        const cards = document.querySelectorAll(".course-card");
        const updates = [];
        cards.forEach((card, index) => {
            const id = card.dataset.id;
            if (id) updates.push({ id: id, display_order: index + 1 });
        });
        try {
            for (const update of updates) {
                await supabase.from("subject_announcements").update({ display_order: update.display_order }).eq("id", update.id);
            }
        } catch (err) { console.error(err); }
    },

    triggerPhotoUpload(card) {
        const fileInput = card.querySelector(".photo-input");
        fileInput.click();
        fileInput.onchange = async (e) => {
            let file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            try { file = await this.compressImage(file); } catch (err) { }
            if (file.size > 5 * 1024 * 1024) { showPopup("Max 5MB", "error"); return; }
            await this.uploadPhoto(card, file);
        };
    },

    async uploadPhoto(card, file) {
        const id = card.dataset.id;
        try {
            const fileName = `${this.state.subjectId}/${id}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from('subject-photos').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('subject-photos').getPublicUrl(fileName);
            const { error: updateError } = await supabase.from("subject_announcements").update({ photo_url: urlData.publicUrl }).eq("id", id);
            if (updateError) throw updateError;

            this.updateCardPhoto(card, urlData.publicUrl);
        } catch (err) { console.error(err); showPopup("Gagal upload", "error"); }
    },

    updateCardPhoto(card, photoUrl) {
        let photoContainer = card.querySelector(".card-photo-container");
        const placeholder = card.querySelector(".card-photo-placeholder");
        if (placeholder) {
            placeholder.remove();
            photoContainer = document.createElement("div");
            photoContainer.className = "card-photo-container";
            photoContainer.style.position = "relative";
            photoContainer.style.marginBottom = "15px";
            photoContainer.innerHTML = `
                <img src="${photoUrl}" class="card-photo">
                <button class="delete-photo-btn" style="${this.state.editMode ? 'display:block;' : 'display:none;'} position:absolute; top:5px; right:5px; background:rgba(255,0,0,0.8); color:white; border:none; padding:5px; border-radius:5px;"><i class="fa-solid fa-trash"></i></button>
            `;
            card.insertBefore(photoContainer, card.querySelector("h3"));
        } else if (photoContainer) {
            photoContainer.querySelector(".card-photo").src = photoUrl;
        }
        const ann = this.state.announcements.find(a => a.id == card.dataset.id);
        if (ann) ann.photo_url = photoUrl;
    },

    async deletePhoto(card) {
        if (!await showPopup("Hapus foto?", "confirm")) return;
        const id = card.dataset.id;
        const data = this.state.announcements.find(a => a.id == id);

        if (data && data.photo_url) {
            let urls = Array.isArray(data.photo_url) ? data.photo_url : [data.photo_url];
            const paths = urls.map(u => u.includes('/subject-photos/') ? decodeURIComponent(u.split('/subject-photos/')[1]) : null).filter(p => p);
            if (paths.length > 0) await supabase.storage.from('subject-photos').remove(paths);
        }

        await supabase.from("subject_announcements").update({ photo_url: null }).eq("id", id);
        this.removeCardPhoto(card);
        showPopup("Foto dihapus", "success");
    },

    removeCardPhoto(card) {
        const pc = card.querySelector(".card-photo-container");
        if (pc) pc.remove();
        const ph = document.createElement("div");
        ph.className = "card-photo-placeholder";
        ph.style.display = this.state.editMode ? "block" : "none";
        ph.innerHTML = `<i class="fa-solid fa-image"></i><p>Klik Upload Foto</p>`;
        card.insertBefore(ph, card.querySelector("h3"));
        const ann = this.state.announcements.find(a => a.id == card.dataset.id);
        if (ann) ann.photo_url = null;
    },

    async saveAnnouncement(card) {
        const id = card.dataset.id;
        const getData = (field) => { const el = card.querySelector(`[data-field="${field}"]`); return el ? el.innerText.trim() : ""; };
        try {
            await supabase.from("subject_announcements").update({
                big_title: getData("big_title"), title: getData("title"), content: getData("content"), small: getData("small")
            }).eq("id", id);
            console.log("✅ Saved:", id);
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

    initAdd() {
        const modal = document.getElementById('addModal');
        const btnAdd = document.getElementById('addAnnouncementBtn');
        const btnSave = document.getElementById('btnSaveAdd');
        const btnCancel = document.getElementById('btnCancelAdd');
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('addFiles');

        if (!btnAdd) return;
        btnAdd.onclick = (e) => { e.preventDefault(); modal.classList.remove('hidden'); this.tempFiles = []; document.getElementById('previewContainer').innerHTML = ''; };
        if (btnCancel) btnCancel.onclick = () => { modal.classList.add('hidden'); this.clearForm(); };

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleNewFiles(e.target.files);
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
        dropZone.ondragleave = () => dropZone.classList.remove('dragover');
        dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); this.handleNewFiles(e.dataTransfer.files); };

        if (btnSave) {
            btnSave.onclick = async () => {
                const data = {
                    big: document.getElementById('addJudul').value, tit: document.getElementById('addSubjudul').value,
                    con: document.getElementById('addIsi').value, sml: document.getElementById('addSmall').value, files: this.tempFiles
                };
                if (!data.big) { showPopup("Judul wajib!", "error"); return; }

                btnSave.innerHTML = 'Sending...'; btnSave.disabled = true;
                await this.uploadAndSave(data);
                btnSave.innerHTML = 'Posting'; btnSave.disabled = false;
                modal.classList.add('hidden'); this.clearForm();
            };
        }
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
        document.getElementById('addIsi').value = '';
        document.getElementById('addSmall').value = '';
        document.getElementById('addFiles').value = '';
        document.getElementById('previewContainer').innerHTML = '';
        this.tempFiles = [];
    },

    async uploadAndSave(d) {
        let urls = [];
        for (let f of d.files) {
            const name = `${this.state.subjectId}/new/${Date.now()}_${f.name.replace(/\s/g, '_')}`;
            const { data } = await supabase.storage.from('subject-photos').upload(name, f);
            if (data) urls.push(supabase.storage.from('subject-photos').getPublicUrl(name).data.publicUrl);
        }
        const { error } = await supabase.from('subject_announcements').insert({
            subject_id: this.state.subjectId, class_id: this.state.user.class_id,
            big_title: d.big, title: d.tit, content: d.con, small: d.sml,
            photo_url: urls.length > 1 ? urls : (urls[0] || null),
            display_order: this.state.announcements.length + 1
        });
        if (!error) location.reload();
    },

    enableDragDrop() {
        const cards = document.querySelectorAll(".course-card");
        const self = this;
        cards.forEach(card => {
            card.ondragstart = (e) => self.handleDragStart(e);
            card.ondragover = (e) => self.handleDragOver(e);
            card.ondrop = (e) => self.handleDrop(e);
            card.ondragend = (e) => self.handleDragEnd(e);
        });
    },

    disableDragDrop() {
        const cards = document.querySelectorAll(".course-card");
        cards.forEach(card => {
            card.ondragstart = null; card.ondragover = null;
            card.ondrop = null; card.ondragend = null;
        });
    },

    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            const addModal = document.getElementById('addModal');
            const isAddModalOpen = addModal && !addModal.classList.contains('hidden');

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
                document.getElementById('detailOverlay')?.classList.remove('active');
                if (isAddModalOpen) {
                    document.getElementById('btnCancelAdd')?.click();
                }
            }

            if (e.key === 'Escape') {
                document.getElementById('detailOverlay')?.classList.remove('active');
                if (isAddModalOpen) {
                    document.getElementById('btnCancelAdd')?.click();
                }
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

// --- GLOBAL VIEWER FUNCTIONS ---
let currentViewerPhotos = [], currentViewerIndex = 0, mobileInfoTimer = null;
function openDetail(data) {
    const overlay = document.getElementById('detailOverlay');
    const box = document.querySelector('.glass-detail-box');
    document.getElementById('detailBigTxt').innerText = data.big_title || '';
    document.getElementById('detailTitleTxt').innerText = data.title || '';
    document.getElementById('detailContentTxt').innerText = data.content || '';
    document.getElementById('detailSmallTxt').innerText = data.small || '';
    document.getElementById('mobBig').innerText = data.big_title || '';
    document.getElementById('mobSub').innerText = data.title || '';

    currentViewerPhotos = [];
    if (data.photo_url) {
        if (Array.isArray(data.photo_url)) currentViewerPhotos = data.photo_url;
        else { try { currentViewerPhotos = JSON.parse(data.photo_url); } catch { currentViewerPhotos = [data.photo_url]; } }
    }

    box.classList.remove('text-only-mode');
    currentViewerIndex = 0;
    updateSliderUI();
    overlay.classList.add('active');
}

function closeDetail() { document.getElementById('detailOverlay').classList.remove('active'); }
function updateSliderUI() {
    const imgEl = document.getElementById('detailImg');
    const nav = document.getElementById('sliderNavBtns');
    if (currentViewerPhotos.length === 0) { imgEl.style.display = 'none'; nav.style.display = 'none'; return; }

    imgEl.style.display = 'block';
    imgEl.src = currentViewerPhotos[currentViewerIndex];
    document.getElementById('photoCounterTag').innerText = `${currentViewerIndex + 1}/${currentViewerPhotos.length}`;
    nav.style.display = currentViewerPhotos.length > 1 ? 'block' : 'none';
}
function nextSlide(e) { if (e) e.stopPropagation(); if (currentViewerIndex < currentViewerPhotos.length - 1) { currentViewerIndex++; updateSliderUI(); } }
function prevSlide(e) { if (e) e.stopPropagation(); if (currentViewerIndex > 0) { currentViewerIndex--; updateSliderUI(); } }
function showMobileInfo(e) { if (e) e.stopPropagation(); document.getElementById('detailInfoSection').classList.remove('hidden-mobile'); }