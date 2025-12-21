const SubjectApp = {
    state: {
        editMode: false,
        user: null,
        subjectId: null,
        subjectName: null,
        isLessonMode: false, // Default false
        completedTasks: [],  // Penampung tugas selesai
        announcements: [],
        tempFiles: [],
        bookmarks: []
    },

    init(subjectId, subjectName, isLesson = false) {
        if (typeof supabase === 'undefined') {
            return;
        }

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
        if (typeof getUser === 'function') {
            return getUser();
        }
        const userData = localStorage.getItem("user");
        return userData ? JSON.parse(userData) : null;
    },

    updatePageTitle() {
        document.title = this.state.subjectName;
        const pageTitle = document.getElementById("pageTitle");
        if (pageTitle) {
            pageTitle.innerText = this.state.subjectName;
        }
    },

    updateWelcomeText() {
        const welcomeEl = document.getElementById("welcomeText");
        if (welcomeEl) {
            welcomeEl.innerText = `${this.state.subjectName}`;
        }
    },

    setupAdminControls() {
        const isAdmin = (this.state.user.role === "class_admin" ||
            this.state.user.role === "super_admin");

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

    setupEventListeners() {
        const self = this;

        document.addEventListener("click", function (e) {

            // 1. HANDLE KLIK KARTU (OPEN DETAIL)
            const card = e.target.closest(".course-card");
            if (card && card.classList.contains("clickable-card")) {
                const isInteractive =
                    self.state.editMode ||
                    e.target.closest("button") ||
                    e.target.closest("input") ||
                    e.target.closest(".delete-photo-btn");

                if (!isInteractive) {
                    const id = card.dataset.id;
                    const data = self.state.announcements.find(a => a.id == id);
                    if (data) {
                        openDetail(data);
                        return;
                    }
                }
            }

            // 2. TOGGLE EDIT MODE (FAB BUTTON)
            const toggleBtn = e.target.closest("#toggleEditMode");
            if (toggleBtn) {
                e.preventDefault();
                self.toggleEditMode();
                return;
            }

            // 3. TOMBOL TAMBAH MATERI (FAB ADD)
            const addBtn = e.target.closest("#addAnnouncementBtn");
            if (addBtn) {
                // Handled by initAdd
            }

            // 4. DELETE BUTTON
            const deleteBtn = e.target.closest(".delete-btn");
            if (deleteBtn) {
                e.preventDefault();
                const card = deleteBtn.closest(".course-card");
                self.deleteAnnouncement(card);
                return;
            }

            // 5. BOOKMARK BUTTON
            const bookmarkBtn = e.target.closest(".bookmark-btn");
            if (bookmarkBtn) {
                e.preventDefault();
                const card = bookmarkBtn.closest(".course-card");
                self.toggleBookmark(card);
                return;
            }

            // 6. UPLOAD BUTTON
            const uploadBtn = e.target.closest(".upload-photo-btn");
            if (uploadBtn) {
                e.preventDefault();
                const card = uploadBtn.closest(".course-card");
                self.triggerPhotoUpload(card);
                return;
            }

            // 7. DELETE PHOTO BUTTON
            const deletePhotoBtn = e.target.closest(".delete-photo-btn");
            if (deletePhotoBtn) {
                e.preventDefault();
                const card = deletePhotoBtn.closest(".course-card");
                self.deletePhoto(card);
                return;
            }

            // 8. TASK CHECKLIST BUTTON (FIXED POSISI)
            const taskBtn = e.target.closest(".task-btn");
            if (taskBtn) {
                e.preventDefault();
                e.stopPropagation();
                const card = taskBtn.closest(".course-card");
                self.toggleTaskStatus(card, taskBtn);
                return;
            }
        });
    },

    // FUNGSI TOGGLE STATUS (DIPISAH DENGAN BENAR)
    async toggleTaskStatus(card, btn) {
        const id = card.dataset.id;
        const isDone = btn.classList.contains("done");

        // UI Feedback Instan
        if (isDone) {
            btn.classList.remove("done");
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        } else {
            btn.classList.add("done");
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            if (isDone) {
                // UNMARK (Hapus dari DB)
                await supabase.from("user_progress").delete()
                    .eq("user_id", this.state.user.id)
                    .eq("announcement_id", id);

                this.state.completedTasks = this.state.completedTasks.filter(tid => tid !== id);
                btn.innerHTML = '<i class="fa-regular fa-circle"></i> Tandai Selesai';
            } else {
                // MARK (Simpan ke DB)
                await supabase.from("user_progress").insert({
                    user_id: this.state.user.id,
                    announcement_id: id
                });

                this.state.completedTasks.push(id);
                btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Selesai';
            }
        } catch (err) {
            console.error("Task toggle error:", err);
            // Revert UI kalau error
            if (isDone) btn.classList.add("done");
            else btn.classList.remove("done");
            showPopup("Gagal update status tugas", "error");
        }
    },

    async loadBookmarks() {
        try {
            const { data, error } = await supabase
                .from("bookmarks")
                .select("announcement_id")
                .eq("user_id", this.state.user.id);

            if (error) throw error;
            this.state.bookmarks = data.map(b => String(b.announcement_id));
        } catch (err) {
            console.error("❌ Bookmark load error:", err);
        }
    },

    async toggleBookmark(card) {
        const id = card.dataset.id;
        const btn = card.querySelector(".bookmark-btn");
        const icon = btn.querySelector("i");
        const isBookmarked = this.state.bookmarks.includes(id);

        try {
            if (isBookmarked) {
                await supabase.from("bookmarks").delete()
                    .eq("user_id", this.state.user.id)
                    .eq("announcement_id", id);
                this.state.bookmarks = this.state.bookmarks.filter(b => b !== id);
                btn.classList.remove("active");
                icon.className = "fa-regular fa-bookmark";
            } else {
                await supabase.from("bookmarks").insert({
                    user_id: this.state.user.id,
                    announcement_id: id
                });
                this.state.bookmarks.push(id);
                btn.classList.add("active");
                icon.className = "fa-solid fa-bookmark";
            }
        } catch (err) {
            console.error("❌ Bookmark toggle error:", err);
            showPopup("Gagal koneksi, coba lagi.", "error");
        }
    },

    async loadAnnouncements() {
        const container = document.getElementById("announcements");
        if (!container) return;

        container.innerHTML = "<h3>Materi & Pengumuman</h3><p style='color:#666; padding:20px;'>Memuat...</p>";

        try {
            // 1. Fetch Materi
            // Kita bikin variabel query dulu biar bisa disisipin logika IF
            let query = supabase
                .from("subject_announcements")
                .select("*")
                .eq("subject_id", this.state.subjectId);

            // [PERBAIKAN] Cek apakah user punya class_id? Kalau ada, filter!
            if (this.state.user && this.state.user.class_id) {
                query = query.eq("class_id", this.state.user.class_id);
            }

            // Baru jalankan query dengan urutan
            const { data, error } = await query
                .order("display_order", { ascending: true })
                .order("created_at", { ascending: true });

            if (error) throw error;
            this.state.announcements = data || [];

            // 2. Fetch Progress (Cuma jalan kalo ini halaman Lesson/Pelajaran)
            if (this.state.isLessonMode) {
                const { data: prog, error: progErr } = await supabase
                    .from("user_progress")
                    .select("announcement_id")
                    .eq("user_id", this.state.user.id);

                if (!progErr && prog) {
                    this.state.completedTasks = prog.map(p => String(p.announcement_id));
                }
            }

            await this.loadBookmarks();
            this.renderAnnouncements();

        } catch (err) {
            console.error("❌ Load error:", err);
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
            const card = this.createCardElement(item);
            container.appendChild(card);
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

        // --- PHOTO LOGIC ---
        let photoHTML = "";
        let photos = [];
        if (data.photo_url) {
            if (Array.isArray(data.photo_url)) photos = data.photo_url;
            else if (typeof data.photo_url === 'string') {
                try {
                    if (data.photo_url.startsWith('[')) photos = JSON.parse(data.photo_url);
                    else if (data.photo_url.startsWith('{')) photos = data.photo_url.slice(1, -1).split(',');
                    else photos = [data.photo_url];
                } catch (e) { photos = [data.photo_url]; }
            }
        }

        if (photos.length > 0) {
            let gridClass = '';
            let imgsHTML = '';

            if (photos.length > 4) {
                gridClass = 'grid-4';
                const remaining = photos.length - 4;
                imgsHTML += photos.slice(0, 3).map(url =>
                    `<img src="${url}" class="photo-item">`
                ).join('');
                imgsHTML += `
                    <div class="photo-item photo-wrapper">
                        <img src="${photos[3]}" alt="More">
                        <div class="more-overlay">+${remaining}</div>
                    </div>
                `;
            } else {
                gridClass = `grid-${Math.min(photos.length, 4)}`;
                imgsHTML = photos.slice(0, 4).map(url =>
                    `<img src="${url}" class="photo-item">`
                ).join('');
            }
            photoHTML = `<div class="photo-grid ${gridClass}">${imgsHTML}</div>`;
        }

        if (photos.length > 0) {
            card.classList.add('clickable-card');
        } else {
            card.classList.remove('clickable-card');
            card.style.cursor = "default";
        }

        // --- BOOKMARK LOGIC ---
        const isSaved = this.state.bookmarks.includes(String(data.id));
        const btnClass = isSaved ? "bookmark-btn active" : "bookmark-btn";
        const iconClass = isSaved ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark";

        let taskBtnHTML = "";

        // Cuma render tombol kalau lagi mode Lesson
        if (this.state.isLessonMode) {
            const isDone = this.state.completedTasks.includes(String(data.id));
            const btnClass = isDone ? "task-btn done" : "task-btn";
            const btnText = isDone ? '<i class="fa-solid fa-circle-check"></i> Selesai' : '<i class="fa-regular fa-circle"></i> Tandai Selesai';

            taskBtnHTML = `
                <button class="${btnClass}">
                    ${btnText}
                </button>
            `;
        }

        card.innerHTML = `
            <input type="file" class="photo-input" accept="image/*" style="display:none;">
            
            <div class="drag-handle" style="display:none; cursor:move; color:#888; padding:5px; position:absolute; left:10px; top:10px; z-index:20;">
                <i class="fa-solid fa-grip-vertical"></i>
            </div>

            <button class="${btnClass}">
                <i class="${iconClass}"></i>
            </button>

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

    toggleEditMode() {
        this.state.editMode = !this.state.editMode;

        const container = document.getElementById("adminFabContainer");
        const toggleBtn = document.getElementById("toggleEditMode");
        const cards = document.querySelectorAll(".course-card");

        if (toggleBtn && container) {
            if (this.state.editMode) {
                container.classList.add("active");
                toggleBtn.classList.remove("state-edit");
                toggleBtn.classList.add("state-done");
                toggleBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                container.classList.remove("active");
                toggleBtn.classList.remove("state-done");
                toggleBtn.classList.add("state-edit");
                toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
            }
        }

        cards.forEach(card => {
            const fields = card.querySelectorAll(".editable");
            const deleteBtn = card.querySelector(".delete-btn");
            const uploadBtn = card.querySelector(".upload-photo-btn"); // Hapus kalo ga dipake
            const dragHandle = card.querySelector(".drag-handle");
            const placeholder = card.querySelector(".card-photo-placeholder");
            const deletePhotoBtn = card.querySelector(".delete-photo-btn");

            if (this.state.editMode) {
                card.classList.add("editable-mode");
                card.draggable = true;
                fields.forEach(f => f.contentEditable = "true");
                if (deleteBtn) deleteBtn.style.display = "inline-block";
                if (dragHandle) dragHandle.style.display = "block";
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

        if (this.state.editMode) {
            this.enableDragDrop();
        } else {
            this.disableDragDrop();
        }
    },

    triggerPhotoUpload(card) {
        const fileInput = card.querySelector(".photo-input");
        fileInput.click();

        fileInput.onchange = async (e) => {
            let file = e.target.files[0]; // Ubah const jadi let
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showPopup("File harus berupa gambar!", "error");
                return;
            }

            // --- MULAI KOMPRESI ---
            try {
                const originalSize = (file.size / 1024).toFixed(2);
                console.log(`⏳ Mengompres: ${originalSize} KB`);

                // Proses kompresi (tunggu sampe kelar)
                file = await this.compressImage(file);

                const newSize = (file.size / 1024).toFixed(2);
                console.log(`✅ Hasil Kompres: ${newSize} KB`);
            } catch (err) {
                console.error("Gagal kompres, upload file asli:", err);
            }
            // ---------------------

            if (file.size > 5 * 1024 * 1024) {
                showPopup("Ukuran file maksimal 5MB!", "error");
                return;
            }

            await this.uploadPhoto(card, file);
        };
    },

    async uploadPhoto(card, file) {
        const id = card.dataset.id;
        try {
            console.log("📤 Uploading photo...");
            const fileName = `${this.state.subjectId}/${id}/${Date.now()}_${file.name}`;

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('subject-photos')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase
                .storage
                .from('subject-photos')
                .getPublicUrl(fileName);

            const photoUrl = urlData.publicUrl;

            const { error: updateError } = await supabase
                .from("subject_announcements")
                .update({ photo_url: photoUrl })
                .eq("id", id);

            if (updateError) throw updateError;

            this.updateCardPhoto(card, photoUrl);

        } catch (err) {
            console.error("❌ Upload error:", err);
            showPopup("Gagal upload foto: " + err.message, "error");
        }
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
            <img src="${photoUrl}" class="card-photo" alt="Foto materi">
            <button class="delete-photo-btn" style="${this.state.editMode ? 'display:block;' : 'display:none;'} position:absolute; top:5px; right:5px; background:rgba(255,0,0,0.8); color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
            const firstH3 = card.querySelector("h3");
            card.insertBefore(photoContainer, firstH3);

        } else if (photoContainer) {
            const img = photoContainer.querySelector(".card-photo");
            if (img) img.src = photoUrl;
        }

        const announcement = this.state.announcements.find(a => a.id == card.dataset.id);
        if (announcement) announcement.photo_url = photoUrl;
    },

    async deletePhoto(card) {
        const yakin = await showPopup("Hapus foto ini?", "confirm");
        if (!yakin) return;

        const id = card.dataset.id;
        const data = this.state.announcements.find(a => a.id == id);

        // 1. Hapus File di Storage
        if (data && data.photo_url) {
            let urls = [];
            // Logic parsing sama kayak di atas (bisa dibikin function helper sebenernya)
            if (Array.isArray(data.photo_url)) urls = data.photo_url;
            else if (typeof data.photo_url === 'string') {
                try {
                    if (data.photo_url.startsWith('[')) urls = JSON.parse(data.photo_url);
                    else urls = [data.photo_url];
                } catch (e) { urls = [data.photo_url]; }
            }

            const paths = urls.map(url => {
                if (url.includes('/subject-photos/')) return decodeURIComponent(url.split('/subject-photos/')[1]);
            }).filter(p => p);

            if (paths.length > 0) {
                await supabase.storage.from('subject-photos').remove(paths);
                console.log("File terhapus dari storage");
            }
        }

        // 2. Update DB jadi NULL
        try {
            const { error } = await supabase
                .from("subject_announcements")
                .update({ photo_url: null })
                .eq("id", id);

            if (error) throw error;
            this.removeCardPhoto(card);
            showPopup("Foto dihapus!", "success");
        } catch (err) {
            console.error("❌ Delete photo error:", err);
            showPopup("Gagal hapus foto: " + err.message, "error");
        }
    },

    removeCardPhoto(card) {
        const photoContainer = card.querySelector(".card-photo-container");
        if (photoContainer) {
            photoContainer.remove();
            const placeholder = document.createElement("div");
            placeholder.className = "card-photo-placeholder";
            placeholder.style.display = this.state.editMode ? "block" : "none";
            placeholder.innerHTML = `<i class="fa-solid fa-image"></i><p>Klik Upload Foto</p>`;
            const firstH3 = card.querySelector("h3");
            card.insertBefore(placeholder, firstH3);
        }
        const announcement = this.state.announcements.find(a => a.id == card.dataset.id);
        if (announcement) announcement.photo_url = null;
    },

    async saveAnnouncement(card) {
        const id = card.dataset.id;
        if (!id) return;

        const getData = (field) => {
            const el = card.querySelector(`[data-field="${field}"]`);
            return el ? el.innerText.trim() : "";
        };

        try {
            const { error } = await supabase
                .from("subject_announcements")
                .update({
                    big_title: getData("big_title"),
                    title: getData("title"),
                    content: getData("content"),
                    small: getData("small")
                })
                .eq("id", id);

            if (error) throw error;
            console.log("✅ Saved:", id);
        } catch (err) {
            console.error("❌ Save error:", err);
        }
    },

    // --- FUNGSI HAPUS YANG LEBIH PINTAR (BERSIH-BERSIH STORAGE) ---
    async deleteAnnouncement(card) {
        const yakin = await showPopup("Yakin hapus? Foto & File juga akan hilang permanen.", "confirm");
        if (!yakin) return;

        const id = card.dataset.id;
        const data = this.state.announcements.find(a => a.id == id);

        if (data && data.photo_url) {
            let photosToDelete = [];

            let urls = [];
            if (Array.isArray(data.photo_url)) urls = data.photo_url;
            else if (typeof data.photo_url === 'string') {
                try {
                    if (data.photo_url.startsWith('[')) urls = JSON.parse(data.photo_url);
                    else if (data.photo_url.startsWith('{')) urls = data.photo_url.slice(1, -1).split(',');
                    else urls = [data.photo_url];
                } catch (e) { urls = [data.photo_url]; }
            }

            urls.forEach(url => {
                if (url.includes('/subject-photos/')) {
                    const path = url.split('/subject-photos/')[1];
                    if (path) photosToDelete.push(decodeURIComponent(path));
                }
            });

            if (photosToDelete.length > 0) {
                console.log("🗑️ Menghapus file sampah di storage:", photosToDelete);
                const { error: storageError } = await supabase
                    .storage
                    .from('subject-photos')
                    .remove(photosToDelete);

                if (storageError) console.error("Gagal hapus file:", storageError);
            }
        }

        // 2. PROSES HAPUS DATA DI DATABASE
        try {
            const { error } = await supabase.from("subject_announcements").delete().eq("id", id);
            if (error) throw error;

            card.remove();
            this.state.announcements = this.state.announcements.filter(a => a.id !== id);
            showPopup("Materi & File berhasil dihapus bersih!", "success");
        } catch (err) {
            showPopup("Gagal menghapus: " + err.message, "error");
        }
    },

    initAdd: function () {
        const modal = document.getElementById('addModal');
        const btnAdd = document.getElementById('addAnnouncementBtn');
        const btnSave = document.getElementById('btnSaveAdd');
        const btnCancel = document.getElementById('btnCancelAdd');

        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('addFiles');
        const previewContainer = document.getElementById('previewContainer');

        if (!btnAdd) return;

        btnAdd.onclick = (e) => {
            e.preventDefault();
            if (modal) modal.classList.remove('hidden');
            this.tempFiles = [];
            previewContainer.innerHTML = '';
        };

        if (btnCancel) {
            btnCancel.onclick = () => {
                modal.classList.add('hidden');
                this.clearForm();
            };
        }

        dropZone.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            this.handleNewFiles(e.target.files);
        };

        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        };

        dropZone.ondragleave = () => {
            dropZone.classList.remove('dragover');
        };

        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleNewFiles(e.dataTransfer.files);
            }
        };

        if (btnSave) {
            btnSave.onclick = async () => {
                const data = {
                    big: document.getElementById('addJudul').value,
                    tit: document.getElementById('addSubjudul').value,
                    con: document.getElementById('addIsi').value,
                    sml: document.getElementById('addSmall').value,
                    files: this.tempFiles
                };

                if (!data.big) {
                    showPopup("Judul Besar wajib diisi!", "error");
                    return;
                }

                const originalText = btnSave.innerHTML;
                btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
                btnSave.disabled = true;

                await this.uploadAndSave(data);

                btnSave.innerHTML = originalText;
                btnSave.disabled = false;
                modal.classList.add('hidden');
                this.clearForm();
            };
        }
    },

    handleNewFiles: async function (files) { // Tambah async di sini
        const previewContainer = document.getElementById('previewContainer');

        // Ganti loop jadi for...of biar bisa await kompresi satu-satu
        for (let file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;

            // --- KOMPRESI SEBELUM PREVIEW ---
            try {
                file = await this.compressImage(file);
            } catch (err) {
                console.error("Skip kompresi:", err);
            }
            // --------------------------------

            this.tempFiles.push(file);

            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `
                    <img src="${e.target.result}">
                    <div class="preview-remove"><i class="fa-solid fa-trash"></i></div>
                `;

                div.onclick = (ev) => {
                    ev.stopPropagation();
                    const index = this.tempFiles.indexOf(file);
                    if (index > -1) this.tempFiles.splice(index, 1);
                    div.remove();
                };

                previewContainer.appendChild(div);
            };
            reader.readAsDataURL(file);
        }
    },

    clearForm: function () {
        document.getElementById('addJudul').value = '';
        document.getElementById('addSubjudul').value = '';
        document.getElementById('addIsi').value = '';
        document.getElementById('addSmall').value = '';
        document.getElementById('addFiles').value = '';
        document.getElementById('previewContainer').innerHTML = '';
        this.tempFiles = [];
    },

    uploadAndSave: async function (d) {
        let urls = [];
        if (d.files.length > 0) {
            for (let f of d.files) {
                const name = `${this.state.subjectId}/new/${Date.now()}_${f.name.replace(/\s/g, '_')}`;
                const { data, error } = await supabase.storage.from('subject-photos').upload(name, f);
                if (data) {
                    const { data: pub } = supabase.storage.from('subject-photos').getPublicUrl(name);
                    urls.push(pub.publicUrl);
                }
            }
        }

        let photoDataToSave = null;
        if (urls.length > 1) {
            photoDataToSave = urls;
        } else if (urls.length === 1) {
            photoDataToSave = urls[0];
        }

        const maxOrder = this.state.announcements.length > 0
            ? Math.max(...this.state.announcements.map(a => a.display_order || 0))
            : 0;

        const { error } = await supabase.from('subject_announcements').insert({
            subject_id: this.state.subjectId,
            class_id: this.state.user.class_id,
            big_title: d.big,
            title: d.tit,
            content: d.con,
            small: d.sml,
            photo_url: photoDataToSave,
            display_order: maxOrder + 1
        });

        if (error) {
            console.error(error);
            showPopup("Gagal simpan data", "error");
        } else {
            location.reload();
        }
    },

    enableDragDrop() {
        const cards = document.querySelectorAll(".course-card");
        const self = this;
        cards.forEach(card => {
            card.ondragstart = function (e) { self.handleDragStart.call(self, e); };
            card.ondragover = function (e) { self.handleDragOver.call(self, e); };
            card.ondrop = function (e) { self.handleDrop.call(self, e); };
            card.ondragend = function (e) { self.handleDragEnd.call(self, e); };
        });
    },

    disableDragDrop() {
        const cards = document.querySelectorAll(".course-card");
        cards.forEach(card => {
            card.ondragstart = null; card.ondragover = null;
            card.ondrop = null; card.ondragend = null;
        });
    },

    handleDragStart(e) {
        e.currentTarget.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
    },

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const dragging = document.querySelector(".dragging");
        const container = document.getElementById("announcements");
        const afterElement = this.getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
            container.appendChild(dragging);
        } else {
            container.insertBefore(dragging, afterElement);
        }
    },

    handleDrop(e) {
        e.stopPropagation();
        this.updateDisplayOrder();
    },

    handleDragEnd(e) {
        e.currentTarget.classList.remove("dragging");
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
        } catch (err) {
            console.error(err);
        }
    },

    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            const detailOverlay = document.getElementById('detailOverlay');
            const isDetailOpen = detailOverlay && detailOverlay.classList.contains('active');

            if (isDetailOpen) {
                if (e.key === 'Escape') { e.preventDefault(); closeDetail(); return; }
                if (e.key === 'ArrowRight') { e.preventDefault(); nextSlide(); return; }
                if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); return; }
            }

            const addModal = document.getElementById('addModal');
            const isAddModalOpen = addModal && !addModal.classList.contains('hidden');

            if (isAddModalOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    const btnCancel = document.getElementById('btnCancelAdd');
                    if (btnCancel) btnCancel.click();
                    return;
                }
            }

            if (e.ctrlKey && e.code === 'KeyQ') {
                e.preventDefault();
                const closeBtn = document.querySelector('.modal.show .close, .modal.show .btn-close, .swal2-close, .close-visitor, .closeVisitorPopup, #btnCancelAdd');
                if (closeBtn) closeBtn.click();
            }

            if (e.ctrlKey && e.code === 'Backslash') {
                e.preventDefault();
                if (!this.state.editMode) {
                    const editBtn = document.getElementById("toggleEditMode");
                    if (editBtn) editBtn.click();
                }
            }

            if (e.ctrlKey && e.code === 'Enter') {
                if (this.state.editMode) {
                    e.preventDefault();
                    document.getElementById("toggleEditMode").click();
                }
                if (isAddModalOpen) {
                    document.getElementById('btnSaveAdd').click();
                }
            }

            if (e.ctrlKey && e.code === 'BracketRight') {
                e.preventDefault();
                const addBtn = document.getElementById("addAnnouncementBtn");
                if (addBtn && addBtn.offsetParent !== null) {
                    addBtn.click();
                    setTimeout(() => document.getElementById('addJudul').focus(), 100);
                }
            }
        });
    },

    compressImage: async function (file, quality = 0.6, maxWidth = 1024) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    // Resize proporsional kalau lebar > 1024px
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert canvas balik ke File (JPEG 60%)
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const newFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(newFile);
                        } else {
                            reject(new Error('Gagal kompres gambar'));
                        }
                    }, 'image/jpeg', quality);
                };
            };
            reader.onerror = (error) => reject(error);
        });
    }
}

let currentViewerPhotos = [];
let currentViewerIndex = 0;
let mobileInfoTimer = null;

function openDetail(data) {
    const overlay = document.getElementById('detailOverlay');
    const box = document.querySelector('.glass-detail-box');
    const infoSection = document.getElementById('detailInfoSection');

    document.getElementById('detailBigTxt').innerText = data.big_title || '';
    document.getElementById('detailTitleTxt').innerText = data.title || '';
    document.getElementById('detailContentTxt').innerText = data.content || '';
    document.getElementById('detailSmallTxt').innerText = data.small || '';

    document.getElementById('mobBig').innerText = data.big_title || '';
    document.getElementById('mobSub').innerText = data.title || '';

    currentViewerPhotos = [];

    if (data.photo_url) {
        if (Array.isArray(data.photo_url) && data.photo_url.length > 0) {
            currentViewerPhotos = data.photo_url;
        } else if (typeof data.photo_url === 'string' && data.photo_url.trim() !== "") {
            try {
                let clean = data.photo_url.replace(/^\{|\}$/g, '').replace(/\\"/g, '"');
                if (data.photo_url.startsWith('[')) {
                    let parsed = JSON.parse(data.photo_url);
                    if (parsed.length > 0) currentViewerPhotos = parsed;
                } else {
                    let arr = clean.split(',');
                    if (arr.length > 0 && arr[0] !== "") currentViewerPhotos = arr;
                }
            } catch (e) {
                currentViewerPhotos = [data.photo_url];
            }
        }
    }

    box.classList.remove('text-only-mode');
    currentViewerIndex = 0;
    updateSliderUI();

    if (infoSection && window.innerWidth <= 768) {
        infoSection.classList.remove('hidden-mobile');
        const scrollBox = infoSection.querySelector('.info-content-scroll');
        if (scrollBox) scrollBox.scrollTop = 0;
        startAutoHideTimer();
    }

    overlay.classList.add('active');
}

function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('active');
    clearTimeout(mobileInfoTimer);
}

function updateSliderUI() {
    const imgEl = document.getElementById('detailImg');
    const navBtns = document.getElementById('sliderNavBtns');
    const counter = document.getElementById('photoCounterTag');
    const btnPrev = document.querySelector('#sliderNavBtns .prev-btn');
    const btnNext = document.querySelector('#sliderNavBtns .next-btn');

    if (!imgEl) return;

    if (currentViewerPhotos.length === 0) {
        imgEl.style.display = 'none';
        if (navBtns) navBtns.style.display = 'none';
        if (counter) counter.style.display = 'none';
    } else {
        imgEl.style.display = 'block';
        imgEl.src = currentViewerPhotos[currentViewerIndex];

        if (counter) {
            counter.innerText = `${currentViewerIndex + 1} / ${currentViewerPhotos.length}`;
            counter.style.display = 'block';
        }

        if (navBtns) {
            if (currentViewerPhotos.length > 1) {
                navBtns.style.display = 'block';
                if (currentViewerIndex === 0) {
                    if (btnPrev) btnPrev.style.display = 'none';
                } else {
                    if (btnPrev) btnPrev.style.display = 'flex';
                }
                if (currentViewerIndex === currentViewerPhotos.length - 1) {
                    if (btnNext) btnNext.style.display = 'none';
                } else {
                    if (btnNext) btnNext.style.display = 'flex';
                }
            } else {
                navBtns.style.display = 'none';
            }
        }
    }
}

function nextSlide(e) {
    if (e) e.stopPropagation();
    if (currentViewerIndex >= currentViewerPhotos.length - 1) return;
    currentViewerIndex++;
    updateSliderUI();
}

function prevSlide(e) {
    if (e) e.stopPropagation();
    if (currentViewerIndex <= 0) return;
    currentViewerIndex--;
    updateSliderUI();
}

function startAutoHideTimer() {
    if (window.innerWidth > 768) return;
    clearTimeout(mobileInfoTimer);
    mobileInfoTimer = setTimeout(() => { hideInfo(); }, 3000);
}

function hideInfo() {
    const infoSection = document.getElementById('detailInfoSection');
    if (infoSection) infoSection.classList.add('hidden-mobile');
}

function showMobileInfo(e) {
    if (e) e.stopPropagation();
    const infoSection = document.getElementById('detailInfoSection');
    if (infoSection) {
        infoSection.classList.remove('hidden-mobile');
        startAutoHideTimer();
    }
}