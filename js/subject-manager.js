const SubjectApp = {
    state: {
        editMode: false,
        user: null,
        subjectId: null,
        subjectName: null,
        announcements: [],
        tempFiles: [],
        bookmarks: []
    },

    init(subjectId, subjectName) {
        if (typeof supabase === 'undefined') {
            console.error("❌ Supabase belum ready!");
            setTimeout(() => this.init(subjectId, subjectName), 500);
            return;
        }

        this.state.subjectId = subjectId;
        this.state.subjectName = subjectName;
        this.state.user = this.getUserData();

        if (!this.state.user) {
            window.location.href = "index.html";
            return;
        }

        console.log("✅ Subject loaded:", subjectName);

        if (typeof logVisitor === 'function') logVisitor();

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

            // 1. [BARU] HANDLE KLIK KARTU (OPEN DETAIL)
            // Cek apakah yang diklik adalah bagian dari kartu yang punya foto
            const card = e.target.closest(".course-card");

            if (card && card.classList.contains("clickable-card")) {
                // PENTING: Jangan buka detail kalo user sebenernya mau klik tombol/edit
                const isInteractive =
                    self.state.editMode ||               // Lagi mode edit
                    e.target.closest("button") ||        // Klik tombol bookmark/hapus
                    e.target.closest("input") ||         // Klik input
                    e.target.closest(".delete-photo-btn"); // Klik hapus foto

                if (!isInteractive) {
                    const id = card.dataset.id;
                    // Ambil data asli dari state berdasarkan ID
                    const data = self.state.announcements.find(a => a.id == id);
                    if (data) {
                        openDetail(data);
                        return; // Stop eksekusi biar gak tabrakan sama logic lain
                    }
                }
            }

            // 2. TOGGLE EDIT MODE
            if (e.target && e.target.id === "toggleEditMode") {
                e.preventDefault();
                self.toggleEditMode();
                return;
            }

            // 3. DELETE BUTTON
            const deleteBtn = e.target.closest(".delete-btn");
            if (deleteBtn) {
                e.preventDefault();
                const card = deleteBtn.closest(".course-card");
                self.deleteAnnouncement(card);
                return;
            }

            // 4. BOOKMARK BUTTON
            const bookmarkBtn = e.target.closest(".bookmark-btn");
            if (bookmarkBtn) {
                e.preventDefault();
                const card = bookmarkBtn.closest(".course-card");
                self.toggleBookmark(card);
                return;
            }

            // 5. UPLOAD BUTTON
            const uploadBtn = e.target.closest(".upload-photo-btn");
            if (uploadBtn) {
                e.preventDefault();
                const card = uploadBtn.closest(".course-card");
                self.triggerPhotoUpload(card);
                return;
            }

            // 6. DELETE PHOTO BUTTON
            const deletePhotoBtn = e.target.closest(".delete-photo-btn");
            if (deletePhotoBtn) {
                e.preventDefault();
                const card = deletePhotoBtn.closest(".course-card");
                self.deletePhoto(card);
                return;
            }
        });
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
            const { data, error } = await supabase
                .from("subject_announcements")
                .select("*")
                .eq("subject_id", this.state.subjectId)
                .eq("class_id", this.state.user.class_id)
                .order("display_order", { ascending: true })
                .order("created_at", { ascending: true });

            if (error) throw error;

            this.state.announcements = data || [];
            await this.loadBookmarks();
            this.renderAnnouncements();

        } catch (err) {
            console.error("❌ Load error:", err);
            container.innerHTML = "<h3>Materi & Pengumuman</h3><p style='color:red;'>Gagal memuat. Cek console.</p>";
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

        // --- PHOTO LOGIC (UPDATED: WHATSAPP STYLE +X) ---
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

            // SKENARIO 1: Foto Lebih dari 4 (Contoh: 5, 10, 20)
            if (photos.length > 4) {
                gridClass = 'grid-4'; // Tetap pakai layout 4 kotak
                const remaining = photos.length - 4; // Hitung sisanya

                // Render 3 Foto Pertama (Normal)
                imgsHTML += photos.slice(0, 3).map(url =>
                    `<img src="${url}" class="photo-item">`
                ).join('');

                // Render Foto Ke-4 (Pake Wrapper & Overlay +X)
                // Note: Class 'photo-item' dipasang di wrapper biar Grid CSS bacanya bener
                imgsHTML += `
                    <div class="photo-item photo-wrapper">
                        <img src="${photos[3]}" alt="More">
                        <div class="more-overlay">+${remaining}</div>
                    </div>
                `;
            }
            // SKENARIO 2: Foto 4 atau Kurang (Normal)
            else {
                gridClass = `grid-${Math.min(photos.length, 4)}`;
                imgsHTML = photos.slice(0, 4).map(url =>
                    `<img src="${url}" class="photo-item">`
                ).join('');
            }

            // ... (Logic Photo Grid di atas TETAP SAMA) ...
            photoHTML = `<div class="photo-grid ${gridClass}">${imgsHTML}</div>`;
        }

        // --- [UPDATED] LOGIC CLICK HANDLER (VERSI STABIL) ---
        // Kita tidak pasang onclick disini biar gak berat/konflik.
        // Kita cuma kasih tanda class 'clickable-card' kalau ada foto.
        if (photos.length > 0) {
            card.classList.add('clickable-card'); // Penanda: Kartu ini bisa diklik
        } else {
            card.classList.remove('clickable-card');
            card.style.cursor = "default";
        }

        // --- BOOKMARK LOGIC (TETAP SAMA) ---
        const isSaved = this.state.bookmarks.includes(String(data.id));
        const btnClass = isSaved ? "bookmark-btn active" : "bookmark-btn";
        const iconClass = isSaved ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark";

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
            
            <div class="card-actions" style="margin-top:15px; display:flex; gap:10px; align-items:center;">
                <button class="delete-btn" style="display:none; background:#f44336; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">
                    <i class="fa-solid fa-trash"></i> Hapus Materi
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

        // --- ANIMASI TOMBOL ---
        if (toggleBtn && container) {
            if (this.state.editMode) {
                // MASUK MODE EDIT
                container.classList.add("active"); // Memicu tombol (+) muncul

                // Ubah Tombol Utama jadi Ceklis (Hijau)
                toggleBtn.classList.remove("state-edit");
                toggleBtn.classList.add("state-done");
                toggleBtn.innerHTML = '<i class="fa-solid fa-check"></i>';

            } else {
                // KELUAR MODE EDIT
                container.classList.remove("active"); // Sembunyikan tombol (+)

                // Ubah Tombol Utama jadi Pensil (Orange)
                toggleBtn.classList.remove("state-done");
                toggleBtn.classList.add("state-edit");
                toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
            }
        }

        // --- LOGIC KARTU (TETAP SAMA) ---
        cards.forEach(card => {
            const fields = card.querySelectorAll(".editable");
            const deleteBtn = card.querySelector(".delete-btn");
            const uploadBtn = card.querySelector(".upload-photo-btn");
            const dragHandle = card.querySelector(".drag-handle");
            const placeholder = card.querySelector(".card-photo-placeholder");
            const deletePhotoBtn = card.querySelector(".delete-photo-btn");

            if (this.state.editMode) {
                card.classList.add("editable-mode");
                card.draggable = true;
                fields.forEach(f => f.contentEditable = "true");
                if (deleteBtn) deleteBtn.style.display = "inline-block";
                if (uploadBtn) uploadBtn.style.display = "inline-block";
                if (dragHandle) dragHandle.style.display = "block";
                if (placeholder) placeholder.style.display = "block";
                if (deletePhotoBtn) deletePhotoBtn.style.display = "block";
            } else {
                card.classList.remove("editable-mode");
                card.draggable = false;
                fields.forEach(f => f.contentEditable = "false");
                if (deleteBtn) deleteBtn.style.display = "none";
                if (uploadBtn) uploadBtn.style.display = "none";
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
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showPopup("File harus berupa gambar!", "error");
                return;
            }

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
        if (!confirm("Hapus foto ini?")) return;
        const id = card.dataset.id;
        try {
            const { error } = await supabase
                .from("subject_announcements")
                .update({ photo_url: null })
                .eq("id", id);

            if (error) throw error;
            this.removeCardPhoto(card);

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

    async deleteAnnouncement(card) {
        if (!confirm("Hapus materi ini?")) return;
        const id = card.dataset.id;
        try {
            const { data: announcement } = await supabase.from("subject_announcements").select("photo_url").eq("id", id).single();
            if (announcement?.photo_url) {
                // Logic hapus storage (simplified)
            }

            const { error } = await supabase.from("subject_announcements").delete().eq("id", id);
            if (error) throw error;

            card.remove();
            this.state.announcements = this.state.announcements.filter(a => a.id !== id);
            showPopup("Materi berhasil dihapus!", "success");
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

        // --- LOGIC DRAG & DROP ---
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

    handleNewFiles: function (files) {
        const previewContainer = document.getElementById('previewContainer');

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
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
        });
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

            // 1. NAVIGASI DETAIL OVERLAY (LIHAT MATERI)
            const detailOverlay = document.getElementById('detailOverlay');
            const isDetailOpen = detailOverlay && detailOverlay.classList.contains('active');

            if (isDetailOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeDetail();
                    return;
                }
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    nextSlide();
                    return;
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    prevSlide();
                    return;
                }
            }

            // 2. [BARU] NAVIGASI ADD MODAL (MATERI BARU)
            const addModal = document.getElementById('addModal');
            // Modal terbuka jika TIDAK memiliki class 'hidden'
            const isAddModalOpen = addModal && !addModal.classList.contains('hidden');

            if (isAddModalOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    // Kita trigger klik tombol "Batal" biar form-nya ke-reset juga
                    const btnCancel = document.getElementById('btnCancelAdd');
                    if (btnCancel) btnCancel.click();
                    return;
                }
            }

            // --- SHORTCUT LAINNYA (CTRL + ...) ---

            // CTRL + Q: Tutup Modal / Popup Universal
            if (e.ctrlKey && e.code === 'KeyQ') {
                e.preventDefault();
                const closeBtn = document.querySelector('.modal.show .close, .modal.show .btn-close, .swal2-close, .close-visitor, .closeVisitorPopup, #btnCancelAdd');
                if (closeBtn) closeBtn.click();
            }

            // CTRL + \ : Toggle Edit Mode
            if (e.ctrlKey && e.code === 'Backslash') {
                e.preventDefault();
                if (!this.state.editMode) {
                    const editBtn = document.getElementById("toggleEditMode");
                    if (editBtn) editBtn.click();
                }
            }

            // CTRL + ENTER : Save / Submit
            if (e.ctrlKey && e.code === 'Enter') {
                if (this.state.editMode) {
                    e.preventDefault();
                    document.getElementById("toggleEditMode").click();
                }
                // Kalau Modal Tambah Materi kebuka -> Save
                if (isAddModalOpen) {
                    document.getElementById('btnSaveAdd').click();
                }
            }

            // CTRL + ] : Buka Modal Tambah Materi
            if (e.ctrlKey && e.code === 'BracketRight') {
                e.preventDefault();
                const addBtn = document.getElementById("addAnnouncementBtn");
                if (addBtn && addBtn.offsetParent !== null) {
                    addBtn.click();
                    setTimeout(() => document.getElementById('addJudul').focus(), 100);
                }
            }
        });
    }
}

let currentViewerPhotos = [];
let currentViewerIndex = 0;
let mobileInfoTimer = null;

function openDetail(data) {
    const overlay = document.getElementById('detailOverlay');
    const box = document.querySelector('.glass-detail-box'); // Ambil Box Utama
    const infoSection = document.getElementById('detailInfoSection');

    // 1. Isi Data Teks
    document.getElementById('detailBigTxt').innerText = data.big_title || '';
    document.getElementById('detailTitleTxt').innerText = data.title || '';
    document.getElementById('detailContentTxt').innerText = data.content || '';
    document.getElementById('detailSmallTxt').innerText = data.small || '';

    // Mobile Header
    document.getElementById('mobBig').innerText = data.big_title || '';
    document.getElementById('mobSub').innerText = data.title || '';

    // 2. Parse Foto
    currentViewerPhotos = [];

    if (data.photo_url) {
        if (Array.isArray(data.photo_url) && data.photo_url.length > 0) {
            currentViewerPhotos = data.photo_url;
        } else if (typeof data.photo_url === 'string' && data.photo_url.trim() !== "") {
            try {
                let clean = data.photo_url.replace(/^\{|\}$/g, '').replace(/\\"/g, '"');
                if (data.photo_url.startsWith('[')) {
                    let parsed = JSON.parse(data.photo_url);
                    if (parsed.length > 0) {
                        currentViewerPhotos = parsed;
                    }
                } else {
                    let arr = clean.split(',');
                    if (arr.length > 0 && arr[0] !== "") {
                        currentViewerPhotos = arr;
                    }
                }
            } catch (e) {
                // String biasa (1 URL)
                currentViewerPhotos = [data.photo_url];
            }
        }
    }

    // 3. Reset UI ke Mode Normal (Foto)
    // Kita hapus class text-only-mode untuk memastikan layout normal
    box.classList.remove('text-only-mode');

    currentViewerIndex = 0;
    updateSliderUI();

    // Logic Mobile Auto-Hide
    if (infoSection && window.innerWidth <= 768) {
        infoSection.classList.remove('hidden-mobile');
        const scrollBox = infoSection.querySelector('.info-content-scroll');
        if (scrollBox) scrollBox.scrollTop = 0;
        startAutoHideTimer(); // Jalankan timer ngumpet
    }

    // 4. Buka Overlay
    overlay.classList.add('active');
}

function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('active');
    clearTimeout(mobileInfoTimer);
}

// --- UPDATE LOGIC SLIDER (LINEAR / TIDAK LOOPING) ---

function updateSliderUI() {
    const imgEl = document.getElementById('detailImg');
    const navBtns = document.getElementById('sliderNavBtns');
    const counter = document.getElementById('photoCounterTag');

    // Ambil tombol spesifik
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

        // Update Counter
        if (counter) {
            counter.innerText = `${currentViewerIndex + 1} / ${currentViewerPhotos.length}`;
            counter.style.display = 'block';
        }

        // Update Visibility Tombol (Mentok Kanan/Kiri hilang)
        if (navBtns) {
            if (currentViewerPhotos.length > 1) {
                navBtns.style.display = 'block';

                // Cek Ujung Awal (Hide Prev)
                if (currentViewerIndex === 0) {
                    if (btnPrev) btnPrev.style.display = 'none';
                } else {
                    if (btnPrev) btnPrev.style.display = 'flex'; // Pakai flex biar icon di tengah
                }

                // Cek Ujung Akhir (Hide Next)
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
    // Stop jika sudah di foto terakhir
    if (currentViewerIndex >= currentViewerPhotos.length - 1) return;

    currentViewerIndex++;
    updateSliderUI();
}

function prevSlide(e) {
    if (e) e.stopPropagation();
    // Stop jika sudah di foto pertama
    if (currentViewerIndex <= 0) return;

    currentViewerIndex--;
    updateSliderUI();
}

function startAutoHideTimer() {
    if (window.innerWidth > 768) return;
    clearTimeout(mobileInfoTimer);
    mobileInfoTimer = setTimeout(() => {
        hideInfo();
    }, 3000);
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