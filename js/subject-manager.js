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

        // Handle Klik Background (Area Kosong)
        const detailOverlay = document.getElementById('detailOverlay');
        if (detailOverlay) {
            detailOverlay.onclick = (e) => {
                // Pastikan yang diklik bener-bener overlay hitamnya
                if (e.target === detailOverlay) {
                    const info = document.getElementById('detailInfoSection');
                    const isMobile = window.innerWidth <= 768;

                    if (isMobile && info && !info.classList.contains('hidden-mobile')) {
                        // Jika sheet lagi muncul (setengah/full), turunin dulu ke bawah
                        toggleMobileInfo();
                    } else {
                        // Jika sudah di bawah atau di desktop, baru tutup total
                        closeDetail();
                    }
                }
            };
        }

        // 2. Handle Klik Area Gambar/Media
        const mediaSection = document.querySelector('.detail-media-section');
        if (mediaSection) {
            mediaSection.onclick = () => {
                const info = document.getElementById('detailInfoSection');
                const isMobile = window.innerWidth <= 768;

                // Jika di mobile dan deskripsi lagi naik (setengah/full), klik gambar bakal nurunin deskripsi
                if (isMobile && info && !info.classList.contains('hidden-mobile')) {
                    toggleMobileInfo();
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
            // Ganti class ke .card-photo-placeholder karena class .upload-photo-btn nggak ada di template
            if (e.target.closest(".card-photo-placeholder")) { e.preventDefault(); self.triggerPhotoUpload(e.target.closest(".course-card")); }
            if (e.target.closest(".delete-photo-btn")) { e.preventDefault(); self.deletePhoto(e.target.closest(".course-card")); }

            // Handle Task Checklist
            const taskBtn = e.target.closest(".task-btn");
            if (taskBtn) {
                e.preventDefault(); e.stopPropagation();
                self.toggleTaskStatus(taskBtn.closest(".course-card"), taskBtn);
            }

            const scrollContent = document.querySelector('.info-content-scroll');
            if (scrollContent) {
                scrollContent.addEventListener('scroll', () => {
                    const info = document.getElementById('detailInfoSection');
                    const isMobile = window.innerWidth <= 768;

                    // Hanya jalan di mobile, pas posisi setengah (bukan full), dan gak lagi hidden
                    if (isMobile && info && !info.classList.contains('full-screen') && !info.classList.contains('hidden-mobile')) {
                        // Cek jika scroll sudah sampai ujung bawah (toleransi 5px)
                        const isAtBottom = scrollContent.scrollTop + scrollContent.clientHeight >= scrollContent.scrollHeight - 5;

                        if (isAtBottom) {
                            toggleSheetHeight(); // Panggil fungsi yang udah kita buat tadi buat naikin sheet
                        }
                    }
                });
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
            if (this.state.user && this.state.user.class_id) query = query.eq("class_id", this.state.user.class_id);

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
        container.innerHTML = "<h3 style='margin-top: 30px;'>Materi & Pengumuman</h3>";

        if (this.state.announcements.length === 0) {
            container.innerHTML += "<h3 style='color: #ff6200; padding:20px;'>Belum ada materi</h3>";
            return;
        }
        this.state.announcements.forEach((item) => {
            container.appendChild(this.createCardElement(item));
        });
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
            photoHTML = `<div class="card-photo-placeholder" style="display:none;"><i class="fa-solid fa-image"></i><p>Klik Upload Foto</p></div>`;
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
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'blue')" style="width:14px; height:14px; border-radius:50%; background:#00eaff; cursor:pointer;" title="Biru"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'purple')" style="width:14px; height:14px; border-radius:50%; background:#a55eea; cursor:pointer;" title="Ungu"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'pink')" style="width:14px; height:14px; border-radius:50%; background:#ff9ff3; cursor:pointer;" title="Pink"></div>
    <div class="color-dot" onclick="SubjectApp.changeCardColor('${data.id}', 'brown')" style="width:14px; height:14px; border-radius:50%; background:#8b4513; cursor:pointer;" title="Coklat"></div>
</div>`;

        card.innerHTML = `
        <input type="file" class="photo-input" accept="image/*" style="display:none;">
        <div class="drag-handle" style="display:none; position:absolute; top:10px; right:10px; z-index:50; cursor:grab; padding: 10px; color: #00eaff; background: rgba(0,0,0,0.5); border-radius: 8px; touch-action: none; user-select: none;">
            <i class="fa-solid fa-grip-vertical" style="font-size: 18px; pointer-events: none;"></i>
        </div>
        <button class="${btnClass}"><i class="${iconClass}"></i></button>
        ${photoHTML}
        <h3 contenteditable="false" spellcheck="false" class="editable" data-field="big_title">${bigTitle}</h3>
        <h4 contenteditable="false" spellcheck="false" class="editable" data-field="title">${title}</h4>
        <div contenteditable="false" spellcheck="false" class="editable" data-field="content" style="margin-bottom: 15px;">${content}</div>
        <small contenteditable="false" spellcheck="false" class="editable" data-field="small">${small}</small>
        
        <div class="card-actions" style="margin-top:15px; display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
            <div style="flex-shrink: 0;">
                ${taskBtnHTML} 
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
                toggleBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                container.classList.remove("active");
                toggleBtn.className = "fab-main state-edit";
                toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
            }
        }

        // 2. UPDATE SEMUA KARTU (UI Mode)
        cards.forEach(card => {
            const fields = card.querySelectorAll(".editable");
            const deleteBtn = card.querySelector(".delete-btn");
            const colorTools = card.querySelector(".card-color-tools");
            const dragHandle = card.querySelector(".drag-handle");
            const placeholder = card.querySelector(".card-photo-placeholder");
            const deletePhotoBtn = card.querySelector(".delete-photo-btn");

            if (this.state.editMode) {
                card.classList.add("editable-mode");
                fields.forEach(f => {
                    f.contentEditable = "true";
                    f.style.pointerEvents = "auto";
                });
                if (deleteBtn) deleteBtn.style.display = "inline-block";
                if (colorTools) colorTools.style.display = "flex";

                // --- BAGIAN KRUSIAL: AKTIFKAN DRAG ---
                if (dragHandle) {
                    dragHandle.style.display = "block";
                    this.setupDragEvents(card, dragHandle); // Panggil fungsi drag di sini!
                }

                if (placeholder) placeholder.style.display = "block";
                if (deletePhotoBtn) deletePhotoBtn.style.display = "block";
            } else {
                // ... (logika else tetap sama untuk sembunyikan kontrol)
                card.classList.remove("editable-mode");
                fields.forEach(f => f.contentEditable = "false");
                if (deleteBtn) deleteBtn.style.display = "none";
                if (colorTools) colorTools.style.display = "none";
                if (dragHandle) dragHandle.style.display = "none";
                if (placeholder) placeholder.style.display = "none";
                if (deletePhotoBtn) deletePhotoBtn.style.display = "none";

                // Matikan attribute draggable saat keluar mode edit
                card.draggable = false;
            }
        });

        // 3. SIMPAN DATA (Hanya saat keluar dari mode edit)
        if (!this.state.editMode) {
            await this.saveAllChanges();
        }

        this.state.isToggling = false;
    },

    async saveAllChanges() {
        const toggleBtn = document.getElementById("toggleEditMode");
        const originalHTML = toggleBtn.innerHTML; // Simpan icon centang

        // 1. Kasih animasi loading pas proses simpan
        toggleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        toggleBtn.disabled = true;

        // ... (logic ambil data updates kamu tetap sama) ...
        const cards = document.querySelectorAll(".course-card");
        const updates = Array.from(cards).map((card, index) => {
            const id = card.dataset.id;
            const getVal = (f) => card.querySelector(`[data-field="${f}"]`)?.innerText.trim() || "";
            const getContent = () => card.querySelector(`[data-field="content"]`)?.innerHTML || "";

            return {
                id: id,
                display_order: index + 1,
                big_title: getVal("big_title"),
                title: getVal("title"),
                content: getContent(),
                small: getVal("small"),
                subject_id: this.state.subjectId,
                class_id: this.state.user.class_id
            };
        });

        try {
            const { error } = await supabase
                .from("subject_announcements")
                .upsert(updates, { onConflict: 'id' });

            if (error) throw error;

            // 2. Berhasil! Balikin tombol ke icon edit
            console.log("✅ All changes saved!");
            if (typeof showPopup === 'function') showPopup("Semua perubahan tersimpan!", "success");
        } catch (err) {
            console.error("Save failed:", err);
            showPopup("Gagal simpan data!", "error");
        } finally {
            // Balikin tombol ke keadaan normal
            toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
            toggleBtn.disabled = false;
        }
    },

    // File: js/subject-manager.js

    setupDragEvents(card, handle) {
        // 1. Draggable hanya aktif pas handle ditekan (biar gak ganggu seleksi teks)
        handle.onmousedown = () => { card.draggable = true; };
        handle.onmouseup = () => { card.draggable = false; };

        card.ondragstart = (e) => {
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => card.classList.add("dragging"), 0);
            // Matikan pointer events biar teks gak ganggu proses drag
            card.querySelectorAll('.editable').forEach(el => el.style.pointerEvents = 'none');
        };

        card.ondragover = (e) => {
            e.preventDefault();
            const container = document.getElementById("announcements");
            const dragging = document.querySelector(".dragging");
            if (!dragging) return;

            this.handleAutoScroll(e.clientY);

            // Cari posisi kartu di bawah kursor
            const afterElement = this.getDragAfterElement(container, e.clientY);

            if (afterElement == null) {
                container.appendChild(dragging);
            } else {
                container.insertBefore(dragging, afterElement);
            }
        };

        card.ondragend = () => {
            card.classList.remove("dragging");
            card.draggable = false;
            card.querySelectorAll('.editable').forEach(el => el.style.pointerEvents = 'auto');

            // Simpan urutan baru otomatis ke Supabase (Bulk Upsert)
            this.updateDisplayOrder();
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

    // File: js/subject-manager.js

    handleAutoScroll(y) {
        clearTimeout(this.scrollTimer); // Ganti jadi clearTimeout
        const threshold = 100; // Jarak dari ujung layar buat mulai scroll (pixel)
        const speed = 15;

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

        // 1. Map data ke array of objects dengan kolom minimal tapi lengkap
        const updates = Array.from(cards).map((card, index) => ({
            id: card.dataset.id,            // Primary Key wajib ada
            display_order: index + 1,       // Urutan baru
            subject_id: this.state.subjectId, // Sertakan ini buat jaga-jaga RLS
            class_id: this.state.user.class_id // Sertakan ini agar RLS mengizinkan akses
        }));

        if (updates.length === 0) return;

        try {
            // 2. Kirim sekaligus (Bulk Upsert)
            const { error } = await supabase
                .from("subject_announcements")
                .upsert(updates, {
                    onConflict: 'id', // Kasih tau Supabase kalau ID sama, timpa aja (UPDATE)
                    ignoreDuplicates: false
                });

            if (error) {
                console.error("❌ Upsert Error:", error.message);
                if (typeof showPopup === 'function') showPopup("Gagal simpan urutan: " + error.message, "error");
                throw error;
            }

            console.log("✅ Urutan berhasil disinkronisasi ke cloud.");

            // 3. Update cache lokal biar gak balik lagi urutannya pas reload
            const cacheKey = `announcements_${this.state.subjectId}`;
            localStorage.setItem(cacheKey, JSON.stringify(this.state.announcements));

        } catch (err) {
            console.error("Fatal Error saat reorder:", err);
        }
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
            console.log("✅ Saved with Formatting:", id);
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
        if (!modal || !btnAdd) return;

        const btnSave = document.getElementById('btnSaveAdd');
        const btnCancel = document.getElementById('btnCancelAdd');
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('addFiles');

        // List warna yang tersedia (sesuai data-color di HTML)
        const availableColors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'];

        if (!btnAdd) return;
        btnAdd.onclick = (e) => { e.preventDefault(); modal.classList.remove('hidden'); this.tempFiles = []; document.getElementById('previewContainer').innerHTML = ''; };
        if (btnCancel) btnCancel.onclick = () => { modal.classList.add('hidden'); this.clearForm(); };
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

        // File: js/subject-manager.js

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
                modal.classList.add('hidden'); this.clearForm();
            };
        }

        btnAdd.onclick = (e) => {
            e.preventDefault();
            modal.classList.remove('hidden');
            this.tempFiles = [];
            document.getElementById('previewContainer').innerHTML = '';

            // --- LOGIKA RANDOM COLOR ---
            // Pilih warna acak dari list
            const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
            this.state.selectedColor = randomColor;

            // Update UI Pilihan Warna di Modal agar sinkron
            const colorOpts = document.querySelectorAll('#addColors .color-opt');
            colorOpts.forEach(opt => {
                opt.classList.remove('active');
                if (opt.dataset.color === randomColor) {
                    opt.classList.add('active');
                }
            });

            // Catat history untuk tombol back mobile
            history.pushState({ type: 'overlay', target: 'addModal' }, '');

            // Set otomatis tanggal hari ini di footer modal
            const el = document.getElementById('addSmall');
            if (el) el.value = getTodayIndo();
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
            card_color: d.cardColor,
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

function showAddModal() {
    document.getElementById('modalBig').value = '';
    document.getElementById('modalTitle').value = '';
    document.getElementById('modalContent').value = '';

    const footerInput = document.getElementById('modalSmall');
    if (footerInput) {
        footerInput.value = getTodayIndo();
    }

    document.getElementById('modalOverlay').classList.remove('hidden');
}

let currentViewerPhotos = [], currentViewerIndex = 0, mobileInfoTimer = null;
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
    history.pushState({ type: 'overlay', target: 'detail' }, '');
}

function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('active');
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

document.getElementById('detailOverlay').addEventListener('click', function (e) {
    if (e.target === this) {
        const info = document.getElementById('detailInfoSection');
        if (window.innerWidth <= 768 && !info.classList.contains('hidden-mobile')) {
            toggleMobileInfo();
        } else {
            closeDetail();
        }
    }
});