// ============================================
// SUBJECT MANAGER - REUSABLE UNTUK SEMUA MATA PELAJARAN
// Fitur: Announcement + Upload Foto
// ============================================

const SubjectApp = {
    state: {
        editMode: false,
        user: null,
        subjectId: null,
        subjectName: null,
        announcements: []
    },

    // Initialize dengan subject ID
    init(subjectId, subjectName) {
        // Tunggu supabase ready
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

        this.updatePageTitle();
        this.updateWelcomeText();
        this.setupAdminControls();
        this.setupEventListeners();
        this.loadAnnouncements();
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

            if (e.target && e.target.id === "addAnnouncementBtn") {
                e.preventDefault();
                self.createNewAnnouncement();
                return;
            }

            const deleteBtn = e.target.closest(".delete-btn");
            if (deleteBtn) {
                e.preventDefault();
                const card = deleteBtn.closest(".course-card");
                self.deleteAnnouncement(card);
                return;
            }

            // Upload foto button
            const uploadBtn = e.target.closest(".upload-photo-btn");
            if (uploadBtn) {
                e.preventDefault();
                const card = uploadBtn.closest(".course-card");
                self.triggerPhotoUpload(card);
                return;
            }

            // Delete foto button
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
        if (!container) {
            console.error("❌ Element #announcements tidak ditemukan!");
            return;
        }

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

            console.log("✅ Loaded announcements:", data);

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

        console.log("✅ Rendered", this.state.announcements.length, "items");
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
        const photoUrl = data.photo_url || "";

        // Photo section
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

    async createNewAnnouncement() {
        try {
            const maxOrder = this.state.announcements.length > 0
                ? Math.max(...this.state.announcements.map(a => a.display_order || 0))
                : 0;

            const { data, error } = await supabase
                .from("subject_announcements")
                .insert({
                    subject_id: this.state.subjectId,
                    class_id: this.state.user.class_id,
                    big_title: "Judul Materi",
                    title: "Subjudul",
                    content: "Isi materi...",
                    small: "Catatan kecil",
                    display_order: maxOrder + 1
                })
                .select()
                .single();

            if (error) throw error;

            console.log("✅ New material created:", data);

            this.state.announcements.push(data);

            const container = document.getElementById("announcements");
            const card = this.createCardElement(data);
            container.appendChild(card);

            if (this.state.editMode) {
                const fields = card.querySelectorAll(".editable");
                fields.forEach(f => f.contentEditable = "true");
                card.classList.add("editable-mode");
                card.draggable = true;
                card.querySelector(".delete-btn").style.display = "inline-block";
                card.querySelector(".upload-photo-btn").style.display = "inline-block";
                card.querySelector(".drag-handle").style.display = "block";
                const placeholder = card.querySelector(".card-photo-placeholder");
                if (placeholder) placeholder.style.display = "block";
            }

        } catch (err) {
            console.error("❌ Create error:", err);
            alert("Gagal menambah materi: " + err.message);
        }
    },

    // === PHOTO UPLOAD ===
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

            // 1. Save text changes DULU sebelum upload
            await this.saveAnnouncement(card);

            // 2. Upload ke Supabase Storage
            const fileName = `${this.state.subjectId}/${id}/${Date.now()}_${file.name}`;

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('subject-photos')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 3. Get public URL
            const { data: urlData } = supabase
                .storage
                .from('subject-photos')
                .getPublicUrl(fileName);

            const photoUrl = urlData.publicUrl;

            // 4. Update database
            const { error: updateError } = await supabase
                .from("subject_announcements")
                .update({ photo_url: photoUrl })
                .eq("id", id);

            if (updateError) throw updateError;

            console.log("✅ Photo uploaded:", photoUrl);

            // 5. Update UI TANPA reload semua (cuma update foto)
            this.updateCardPhoto(card, photoUrl);

        } catch (err) {
            console.error("❌ Upload error:", err);
            alert("Gagal upload foto: " + err.message);
        }
    },

    updateCardPhoto(card, photoUrl) {
        // Cari container foto atau placeholder
        let photoContainer = card.querySelector(".card-photo-container");
        const placeholder = card.querySelector(".card-photo-placeholder");

        if (placeholder) {
            // Ganti placeholder jadi foto real
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

            // Insert sebelum h3 pertama
            const firstH3 = card.querySelector("h3");
            card.insertBefore(photoContainer, firstH3);

        } else if (photoContainer) {
            // Update foto yang udah ada
            const img = photoContainer.querySelector(".card-photo");
            if (img) img.src = photoUrl;
        }

        // Update state announcements
        const announcement = this.state.announcements.find(a => a.id == card.dataset.id);
        if (announcement) {
            announcement.photo_url = photoUrl;
        }

        console.log("✅ Card photo updated (edit mode preserved)");
    },

    async deletePhoto(card) {
        if (!confirm("Hapus foto ini?")) return;

        const id = card.dataset.id;

        try {
            // Update database (set photo_url jadi null)
            const { error } = await supabase
                .from("subject_announcements")
                .update({ photo_url: null })
                .eq("id", id);

            if (error) throw error;

            console.log("✅ Photo deleted");

            // Update UI TANPA reload
            this.removeCardPhoto(card);

        } catch (err) {
            console.error("❌ Delete photo error:", err);
            alert("Gagal hapus foto: " + err.message);
        }
    },

    removeCardPhoto(card) {
        const photoContainer = card.querySelector(".card-photo-container");

        if (photoContainer) {
            // Ganti jadi placeholder
            photoContainer.remove();

            const placeholder = document.createElement("div");
            placeholder.className = "card-photo-placeholder";
            placeholder.style.display = this.state.editMode ? "block" : "none";
            placeholder.style.padding = "20px";
            placeholder.style.background = "rgba(255,255,255,0.1)";
            placeholder.style.border = "2px dashed rgba(255,255,255,0.3)";
            placeholder.style.borderRadius = "8px";
            placeholder.style.textAlign = "center";
            placeholder.style.marginBottom = "15px";
            placeholder.style.cursor = "pointer";

            placeholder.innerHTML = `
            <i class="fa-solid fa-image" style="font-size:32px; color:rgba(255,255,255,0.5);"></i>
            <p style="margin-top:10px; color:rgba(255,255,255,0.6);">Klik Upload Foto untuk menambah gambar</p>
        `;

            // Insert sebelum h3
            const firstH3 = card.querySelector("h3");
            card.insertBefore(placeholder, firstH3);
        }

        // Update state
        const announcement = this.state.announcements.find(a => a.id == card.dataset.id);
        if (announcement) {
            announcement.photo_url = null;
        }

        console.log("✅ Photo removed (edit mode preserved)");
    },

    async saveAnnouncement(card) {
        const id = card.dataset.id;
        if (!id) return;

        const getData = (field) => {
            const el = card.querySelector(`[data-field="${field}"]`);
            return el ? el.innerText.trim() : "";
        };

        try {
            const updateData = {
                big_title: getData("big_title"),
                title: getData("title"),
                content: getData("content"),
                small: getData("small")
            };

            const { error } = await supabase
                .from("subject_announcements")
                .update(updateData)
                .eq("id", id);

            if (error) throw error;

            console.log("✅ Saved:", id);

        } catch (err) {
            console.error("❌ Save error:", err);
            alert("Gagal menyimpan: " + err.message);
        }
    },

    async deleteAnnouncement(card) {
        if (!confirm("Hapus materi ini?")) return;

        const id = card.dataset.id;

        try {
            // 1. Ambil data dulu buat dapet photo_url
            const { data: announcement } = await supabase
                .from("subject_announcements")
                .select("photo_url")
                .eq("id", id)
                .single();

            // 2. Hapus foto dari storage (kalo ada)
            if (announcement?.photo_url) {
                const fileName = announcement.photo_url.split('/').pop();
                const path = `${this.state.subjectId}/${id}/${fileName}`;

                await supabase.storage
                    .from('subject-photos')
                    .remove([path]);

                console.log("🖼️ Photo deleted from storage");
            }

            // 3. Hapus record dari table
            const { error } = await supabase
                .from("subject_announcements")
                .delete()
                .eq("id", id);

            if (error) throw error;

            // 4. Hapus dari UI
            card.remove();
            this.state.announcements = this.state.announcements.filter(a => a.id !== id);

            console.log("✅ Deleted:", id);
            alert("✅ Materi & foto berhasil dihapus!");

        } catch (err) {
            console.error("❌ Delete error:", err);
            alert("❌ Gagal menghapus: " + err.message);
        }
    },

    // === DRAG & DROP (sama kayak announcement) ===
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
            card.ondragstart = null;
            card.ondragover = null;
            card.ondrop = null;
            card.ondragend = null;
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
            if (id) {
                updates.push({ id: id, display_order: index + 1 });
            }
        });

        try {
            for (const update of updates) {
                await supabase
                    .from("subject_announcements")
                    .update({ display_order: update.display_order })
                    .eq("id", update.id);
            }

            this.state.announcements.forEach(a => {
                const found = updates.find(u => u.id === a.id);
                if (found) a.display_order = found.display_order;
            });

            console.log("✅ Display order updated!");

        } catch (err) {
            console.error("❌ Update order error:", err);
        }
    }
};

// JANGAN PANGGIL INIT DI SINI!
// Init dipanggil dari masing-masing HTML file