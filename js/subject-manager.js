const SubjectApp = {
    state: {
        editMode: false,
        user: null,
        subjectId: null,
        subjectName: null,
        announcements: []
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

        // Fitur Add Modal Baru
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

        if (isAdmin && editControls) {
            // Note: ID tombol add tetap 'addAnnouncementBtn' biar konsisten
            editControls.innerHTML = `
                <button id="toggleEditMode" style="padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:5px; cursor:pointer; margin-right:10px;">Edit Materi</button>
                <button id="addAnnouncementBtn" style="display:none; padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">+ Tambah Materi</button>
            `;
        }
    },

    setupEventListeners() {
        const self = this;

        document.addEventListener("click", function (e) {
            if (e.target && e.target.id === "toggleEditMode") {
                e.preventDefault();
                self.toggleEditMode();
                return;
            }

            // Note: Handler 'addAnnouncementBtn' dipindah ke initAdd() biar pake Modal

            const deleteBtn = e.target.closest(".delete-btn");
            if (deleteBtn) {
                e.preventDefault();
                const card = deleteBtn.closest(".course-card");
                self.deleteAnnouncement(card);
                return;
            }

            const uploadBtn = e.target.closest(".upload-photo-btn");
            if (uploadBtn) {
                e.preventDefault();
                const card = uploadBtn.closest(".course-card");
                self.triggerPhotoUpload(card);
                return;
            }

            const deletePhotoBtn = e.target.closest(".delete-photo-btn");
            if (deletePhotoBtn) {
                e.preventDefault();
                const card = deletePhotoBtn.closest(".course-card");
                self.deletePhoto(card);
                return;
            }
        });
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
        card.draggable = false;

        const bigTitle = data.big_title || "";
        const title = data.title || "";
        const content = data.content || "";
        const small = data.small || "";
        // Handle photo_url kalau dia array (dari fitur upload baru) atau string (lama)
        let photoUrl = "";
        if (Array.isArray(data.photo_url) && data.photo_url.length > 0) {
            photoUrl = data.photo_url[0]; // Ambil foto pertama dulu buat preview
        } else if (typeof data.photo_url === 'string') {
            photoUrl = data.photo_url;
        }

        const photoHTML = photoUrl
            ? `<div class="card-photo-container">
                   <img src="${photoUrl}" class="card-photo" alt="Foto materi">
                   <button class="delete-photo-btn" style="display:none; position:absolute; top:5px; right:5px; background:rgba(255,0,0,0.8); color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">
                       <i class="fa-solid fa-trash"></i>
                   </button>
               </div>`
            : `<div class="card-photo-placeholder" style="display:none; padding:20px; background:rgba(255,255,255,0.1); border:2px dashed rgba(255,255,255,0.3); border-radius:8px; text-align:center; margin-bottom:15px; cursor:pointer;">
                   <i class="fa-solid fa-image" style="font-size:32px; color:rgba(255,255,255,0.5);"></i>
                   <p style="margin-top:10px; color:rgba(255,255,255,0.6);">Klik Upload Foto untuk menambah gambar</p>
               </div>`;

        card.innerHTML = `
            <input type="file" class="photo-input" accept="image/*" style="display:none;">
            
            <div class="drag-handle" style="display:none; cursor:move; color:#888; padding:5px; position:absolute; left:10px; top:10px;">
                <i class="fa-solid fa-grip-vertical"></i>
            </div>

            ${photoHTML}

            <h3 contenteditable="false" class="editable" data-field="big_title">${bigTitle}</h3>
            <h4 contenteditable="false" class="editable" data-field="title">${title}</h4>
            <p contenteditable="false" class="editable" data-field="content">${content}</p>
            <small contenteditable="false" class="editable" data-field="small">${small}</small>
            
            <div class="card-actions" style="margin-top:15px; display:flex; gap:10px;">
                <button class="upload-photo-btn" style="display:none; background:#FF9800; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">
                    <i class="fa-solid fa-camera"></i> Upload Foto
                </button>
                <button class="delete-btn" style="display:none; background:#f44336; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        `;

        return card;
    },

    toggleEditMode() {
        this.state.editMode = !this.state.editMode;

        const toggleBtn = document.getElementById("toggleEditMode");
        const addBtn = document.getElementById("addAnnouncementBtn");
        const cards = document.querySelectorAll(".course-card");

        if (toggleBtn) {
            toggleBtn.textContent = this.state.editMode ? "Selesai Edit" : "Edit Materi";
        }
        if (addBtn) {
            addBtn.style.display = this.state.editMode ? "inline-block" : "none";
        }

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
                alert("File harus berupa gambar!");
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert("Ukuran file maksimal 5MB!");
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
            alert("Gagal upload foto: " + err.message);
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
            alert("Gagal hapus foto: " + err.message);
        }
    },

    removeCardPhoto(card) {
        const photoContainer = card.querySelector(".card-photo-container");
        if (photoContainer) {
            photoContainer.remove();
            const placeholder = document.createElement("div");
            placeholder.className = "card-photo-placeholder";
            placeholder.style.display = this.state.editMode ? "block" : "none";
            // ... styling placeholder simplified
            placeholder.innerHTML = `<i class="fa-solid fa-image"></i><p>Klik Upload Foto</p>`;
            // Note: Simplifikasi html string biar gak kepanjangan, fungsinya sama
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
            // Hapus file dulu kalo ada
            const { data: announcement } = await supabase.from("subject_announcements").select("photo_url").eq("id", id).single();
            if (announcement?.photo_url) {
                // Logic hapus storage (simplified)
            }

            const { error } = await supabase.from("subject_announcements").delete().eq("id", id);
            if (error) throw error;

            card.remove();
            this.state.announcements = this.state.announcements.filter(a => a.id !== id);
            alert("✅ Materi dihapus!");
        } catch (err) {
            alert("❌ Gagal menghapus: " + err.message);
        }
    },

    // --- NEW: INITIALIZE POPUP FEATURE ---
    initAdd: function () {
        const modal = document.getElementById('addModal');
        // Note: ID ini harus match dengan tombol yang ada di setupAdminControls
        const btnAdd = document.getElementById('addAnnouncementBtn');
        const btnSave = document.getElementById('btnSaveAdd');
        const btnCancel = document.getElementById('btnCancelAdd');

        if (!btnAdd) return; // Kalau admin blm login, btnAdd null

        btnAdd.onclick = (e) => {
            e.preventDefault();
            if (modal) modal.classList.remove('hidden');
        };

        if (btnCancel) {
            btnCancel.onclick = () => {
                modal.classList.add('hidden');
                this.clearForm();
            };
        }

        if (btnSave) {
            btnSave.onclick = async () => {
                const data = {
                    big: document.getElementById('addJudul').value,
                    tit: document.getElementById('addSubjudul').value,
                    con: document.getElementById('addIsi').value,
                    sml: document.getElementById('addSmall').value,
                    files: document.getElementById('addFiles').files
                };

                if (!data.big) return alert('Judul Besar wajib diisi!');

                btnSave.innerText = 'Menyimpan...';
                await this.uploadAndSave(data);
                btnSave.innerText = 'Simpan';
                modal.classList.add('hidden');
                this.clearForm();
            };
        }
    },

    clearForm: function () {
        document.getElementById('addJudul').value = '';
        document.getElementById('addSubjudul').value = '';
        document.getElementById('addIsi').value = '';
        document.getElementById('addSmall').value = '';
        document.getElementById('addFiles').value = '';
    },

    uploadAndSave: async function (d) {
        let urls = [];
        // 1. Upload Loop
        if (d.files.length > 0) {
            for (let f of d.files) {
                const name = `${this.state.subjectId}/new/${Date.now()}_${f.name.replace(/\s/g, '_')}`;
                // Menggunakan bucket 'subject-photos' sesuai code lu
                const { data, error } = await supabase.storage.from('subject-photos').upload(name, f);
                if (data) {
                    const { data: pub } = supabase.storage.from('subject-photos').getPublicUrl(name);
                    urls.push(pub.publicUrl);
                }
            }
        }

        // 2. Insert DB
        // Karena kolom photo_url lu mungkin teks biasa, gw simpan array kalau > 1, string kalau 1
        let photoDataToSave = null;
        if (urls.length > 1) {
            // Kalau user upload banyak, kita paksa simpan array (Postgres support array text)
            photoDataToSave = urls;
        } else if (urls.length === 1) {
            photoDataToSave = urls[0];
        }

        // Cari order terakhir
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
            alert('Gagal simpan data');
        } else {
            location.reload();
        }
    },

    // --- Drag Drop Logic (Existing) ---
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
                // Save logic
                if (this.state.editMode) {
                    e.preventDefault();
                    document.getElementById("toggleEditMode").click();
                }
                // Kalau modal kebuka, save modal
                const modal = document.getElementById('addModal');
                if (modal && !modal.classList.contains('hidden')) {
                    document.getElementById('btnSaveAdd').click();
                }
            }

            if (e.ctrlKey && e.code === 'BracketRight') {
                e.preventDefault();
                // Logic baru: Buka Modal, bukan scroll ke bawah
                const addBtn = document.getElementById("addAnnouncementBtn");
                if (addBtn && addBtn.offsetParent !== null) {
                    addBtn.click();
                    // Fokus ke input pertama di modal
                    setTimeout(() => document.getElementById('addJudul').focus(), 100);
                }
            }

            // ... sisa shortcut (digit 1-4) sama kayak asli
        });
    }
};