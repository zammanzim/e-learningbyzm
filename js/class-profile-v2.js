// File: js/class-profile-v2.js

let students = [];
let CLASS_ID = 2; // Default fallback

const ClassProfileV2 = {
    state: {
        filter: "all",
        searchQuery: "",
        user: null,
        editingId: null // ID dari student yang sedang di-edit inline
    },

    async init() {
        try {
            this.state.user = getUser();
        } catch (e) {
            this.state.user = null;
        }

        if (!this.state.user) {
            window.location.href = '../login';
            return;
        }

        // Tentukan CLASS_ID secara dinamis dari kelas user
        const classOverride = getEffectiveClassId();
        CLASS_ID = classOverride ? parseInt(classOverride) : parseInt(this.state.user.class_id);

        // Fetch data asli dari backend Supabase
        await this.fetchData();

        // Setup filter & search event listeners
        this.setupFilters();
        this.setupSearch();
        this.setupModal();

        // Render Bento Grid
        this.renderGrid();
    },

    async fetchData() {
        // Tampilkan loading skeleton
        const grid = document.getElementById('v2BentoGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="skeleton" style="height: 250px; border-radius: 20px;"></div>
                <div class="skeleton" style="height: 250px; border-radius: 20px;"></div>
                <div class="skeleton" style="height: 250px; border-radius: 20px;"></div>
            `;
        }

        try {
            // Ambil data siswa untuk kelas ini
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('class_id', CLASS_ID)
                .order('absen_number');

            if (error) throw error;
            students = data || [];

            // Gabungkan data dari users (untuk avatar terbaru, bio, dll)
            const userIds = students.filter(s => s.user_id).map(s => s.user_id);
            if (userIds.length) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, avatar_url, short_name, full_name, bio')
                    .in('id', userIds);

                if (usersData) {
                    const userMap = {};
                    usersData.forEach(u => userMap[u.id] = u);
                    students.forEach(s => {
                        if (s.user_id && userMap[s.user_id]) {
                            s.users = userMap[s.user_id];
                        }
                    });
                }
            }

            // Update stats di hero
            const statCount = document.getElementById('v2StatCount');
            if (statCount) statCount.innerText = students.length;

        } catch (err) {
            console.error('Fetch data kelas gagal:', err);
            showToast('Gagal memuat profil kelas', 'error');
        }
    },

    getPhoto(s) {
        if (s.users && s.users.avatar_url) return `${s.users.avatar_url}?t=${Date.now()}`;
        if (s.photo_url) return s.photo_url;
        return '../icons/profpicture.png';
    },

    getDisplayName(s) {
        if (s.users && s.users.short_name) return s.users.short_name;
        return s.nickname || `Siswa #${s.absen_number}`;
    },

    renderGrid() {
        const grid = document.getElementById('v2BentoGrid');
        if (!grid) return;

        if (students.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px; opacity: 0.7;">
                    <i class="fa-solid fa-users" style="font-size: 3rem; color: var(--accent, #00eaff); margin-bottom: 15px;"></i>
                    <h3>Belum ada data siswa</h3>
                    <p>Silakan seed database atau ganti kelas.</p>
                </div>
            `;
            return;
        }

        // 1. Filter logic
        let filtered = students;
        if (this.state.filter !== "all") {
            filtered = students.filter(s => {
                const grp = s.position_group || 'student';
                if (this.state.filter === "bph") return grp === "leader" || grp === "bph";
                if (this.state.filter === "wali") return grp === "wali";
                if (this.state.filter === "keuangan") return grp === "treasury" || grp === "keuangan";
                if (this.state.filter === "sekretaris") return grp === "secretary" || grp === "sekretaris";
                if (this.state.filter === "seksi") return !['wali', 'leader', 'bph', 'treasury', 'keuangan', 'secretary', 'sekretaris', 'siswa', 'student'].includes(grp);
                if (this.state.filter === "siswa") return grp === "siswa" || grp === "student";
                return true;
            });
        }

        // 2. Search logic
        if (this.state.searchQuery) {
            const q = this.state.searchQuery.toLowerCase();
            filtered = filtered.filter(s => {
                const name = this.getDisplayName(s).toLowerCase();
                const fullName = (s.users && s.users.full_name ? s.users.full_name.toLowerCase() : "");
                const nick = (s.nickname ? s.nickname.toLowerCase() : "");
                const role = (s.position_title ? s.position_title.toLowerCase() : "");
                const quote = (s.quote ? s.quote.toLowerCase() : "");
                return name.includes(q) || fullName.includes(q) || nick.includes(q) || role.includes(q) || quote.includes(q);
            });
        }

        const html = filtered.map(s => {
            const isOwner = this.state.user && s.user_id && String(this.state.user.id) === String(s.user_id);
            const isEditing = this.state.editingId === s.id;
            const photo = this.getPhoto(s);
            const displayName = this.getDisplayName(s);
            
            // Bento size class mapping
            let sizeClass = 'bento-normal';
            if (s.position_group === 'wali') sizeClass = 'bento-large';
            else if (s.position_group === 'leader') sizeClass = 'bento-wide';

            // RGB color fallback
            const colorRgb = s.card_color_rgb || '0, 234, 255';

            return `
                <div class="v2-card ${sizeClass}" data-id="${s.id}" style="--student-color-rgb: ${colorRgb}">
                    ${isOwner && !isEditing ? `
                        <button class="v2-card-edit-btn" title="Edit Profilku" onclick="event.stopPropagation(); ClassProfileV2.startEdit(${s.id})">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    ` : ''}
                    
                    <span class="v2-badge" style="--student-color-rgb: ${colorRgb}">${s.position_title || 'Siswa'}</span>
                    
                    <div class="v2-card-img-wrap" style="aspect-ratio: 1/1 !important;">
                        <img src="${photo}" alt="${displayName}" onerror="this.src='../icons/profpicture.png'">
                    </div>
                    
                    <div class="v2-card-meta">
                        <div class="v2-card-name">${displayName}</div>
                        <div class="v2-card-absen">Absen ${String(s.absen_number).padStart(2, '0')}</div>
                        
                        <!-- Editable Quote -->
                        <div class="v2-card-quote ${isEditing ? 'editing' : ''}" 
                             id="quote-${s.id}" 
                             contenteditable="${isEditing}" 
                             style="--student-color-rgb: ${colorRgb}"
                             onclick="${isEditing ? 'event.stopPropagation();' : ''}"
                             placeholder="Tulis quote kamu...">
                            ${s.quote ? s.quote : ''}
                        </div>
                        
                        <!-- Editable Description -->
                        <div class="v2-card-desc ${isEditing ? 'editing' : ''}" 
                             id="desc-${s.id}" 
                             contenteditable="${isEditing}" 
                             onclick="${isEditing ? 'event.stopPropagation();' : ''}"
                             placeholder="Ceritain diri kamu...">
                            ${s.description ? s.description : ''}
                        </div>

                        <!-- Editable Sosmed Inputs -->
                        <div class="v2-card-edit-inputs" id="edit-inputs-${s.id}" onclick="event.stopPropagation();" style="display: ${isEditing ? 'flex' : 'none'};">
                            <div class="v2-input-group">
                                <label>WhatsApp (angka saja)</label>
                                <input type="text" id="input-wa-${s.id}" value="${s.wa || ''}" placeholder="628xxx">
                            </div>
                            <div class="v2-input-group">
                                <label>Instagram (tanpa @)</label>
                                <input type="text" id="input-ig-${s.id}" value="${s.ig || ''}" placeholder="username">
                            </div>
                        </div>

                        <!-- Standard Sosmed Links -->
                        <div class="kp-links" id="links-${s.id}" style="display: ${isEditing ? 'none' : 'flex'}; margin-top: 5px;">
                            ${s.wa ? `<a href="https://wa.me/${s.wa}" target="_blank" onclick="event.stopPropagation();" class="kp-lk-wa"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
                            ${s.ig ? `<a href="https://instagram.com/${s.ig}" target="_blank" onclick="event.stopPropagation();" class="kp-lk-ig"><i class="fa-brands fa-instagram"></i></a>` : ''}
                        </div>

                        <!-- Inline Save Actions -->
                        <div class="v2-card-save-actions" id="save-actions-${s.id}" onclick="event.stopPropagation();" style="display: ${isEditing ? 'flex' : 'none'};">
                            <button class="v2-card-btn-save" onclick="ClassProfileV2.saveEdit(${s.id})">Simpan</button>
                            <button class="v2-card-btn-cancel" onclick="ClassProfileV2.cancelEdit()">Batal</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        grid.innerHTML = html;

        // Card click handler (only opens detail modal if not currently editing)
        grid.querySelectorAll('.v2-card').forEach(card => {
            card.onclick = () => {
                const id = parseInt(card.dataset.id);
                if (this.state.editingId === id) return; // ignore click when editing
                const s = students.find(item => item.id === id);
                if (s) this.openStudentDetail(s);
            };
        });
    },

    startEdit(id) {
        this.state.editingId = id;
        this.renderGrid();
    },

    cancelEdit() {
        this.state.editingId = null;
        this.renderGrid();
    },

    async saveEdit(id) {
        const student = students.find(s => s.id === id);
        if (!student) return;

        const newQuote = document.getElementById(`quote-${id}`).innerText.trim();
        const newDesc = document.getElementById(`desc-${id}`).innerText.trim();
        const newWa = document.getElementById(`input-wa-${id}`).value.trim();
        const newIg = document.getElementById(`input-ig-${id}`).value.trim();

        try {
            // Kirim update ke backend Supabase
            const { error } = await supabase
                .from('students')
                .update({
                    quote: newQuote || null,
                    description: newDesc || null,
                    wa: newWa || null,
                    ig: newIg || null
                })
                .eq('id', id);

            if (error) throw error;

            // Update in-memory data
            student.quote = newQuote || null;
            student.description = newDesc || null;
            student.wa = newWa || null;
            student.ig = newIg || null;

            showToast('Profil berhasil diperbarui!', 'success');
            
            // Reset edit mode
            this.state.editingId = null;
            this.renderGrid();

        } catch (err) {
            console.error('Update profil gagal:', err);
            showPopup('Gagal memperbarui profil: ' + err.message, 'error');
        }
    },

    setupFilters() {
        const filterRow = document.getElementById('v2FilterRow');
        if (!filterRow) return;

        filterRow.querySelectorAll('.v2-chip').forEach(chip => {
            chip.onclick = () => {
                filterRow.querySelectorAll('.v2-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.filter = chip.dataset.filter;
                this.renderGrid();
            };
        });
    },

    setupSearch() {
        const input = document.getElementById('v2SearchInput');
        if (!input) return;

        let timer;
        input.oninput = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.state.searchQuery = input.value.trim();
                this.renderGrid();
            }, 300);
        };
    },

    openStudentDetail(s) {
        const isOwner = this.state.user && s.user_id && String(this.state.user.id) === String(s.user_id);
        const photo = this.getPhoto(s);
        const name = this.getDisplayName(s);
        const colorRgb = s.card_color_rgb || '0, 234, 255';
        
        const popup = document.getElementById('v2Popup');
        const content = document.getElementById('v2ModalContent');
        const card = document.getElementById('v2ModalCard');

        card.style.setProperty('--modal-color-rgb', colorRgb);

        let linkWA = s.wa ? `<a href="https://wa.me/${s.wa}" target="_blank" class="v2-modal-link-btn" style="--btn-hover-bg: #25d366; --btn-hover-border: #25d366; --btn-hover-shadow: rgba(37, 211, 102, 0.4);"><i class="fa-brands fa-whatsapp"></i></a>` : '';
        let linkIG = s.ig ? `<a href="https://instagram.com/${s.ig}" target="_blank" class="v2-modal-link-btn" style="--btn-hover-bg: #e1306c; --btn-hover-border: #e1306c; --btn-hover-shadow: rgba(225, 48, 108, 0.4);"><i class="fa-brands fa-instagram"></i></a>` : '';

        let quoteHTML = s.quote ? `
            <div>
                <div class="v2-modal-label">Kata-kata Mutiara</div>
                <div class="v2-modal-quote-val">"${s.quote}"</div>
            </div>
        ` : '';

        let descHTML = s.description ? `
            <div>
                <div class="v2-modal-label">Deskripsi Diri</div>
                <div class="v2-modal-desc-val">${s.description}</div>
            </div>
        ` : '';

        content.innerHTML = `
            <div class="v2-modal-layout">
                <div class="v2-modal-left">
                    ${quoteHTML}
                    ${quoteHTML && descHTML ? `<div style="height: 1px; background: rgba(255,255,255,0.08); margin: 5px 0;"></div>` : ''}
                    ${descHTML}
                    
                    <div style="margin-top: 10px;">
                        <div class="v2-modal-label">Hubungi & Sosial</div>
                        <div class="v2-modal-links">
                            ${linkWA}
                            ${linkIG}
                        </div>
                    </div>

                    ${isOwner ? `
                        <button class="v2-modal-edit-trigger" onclick="ClassProfileV2.closeModal(); ClassProfileV2.startEdit(${s.id})">
                            <i class="fa-solid fa-pen"></i> Edit Profil Langsung di Card
                        </button>
                    ` : ''}
                </div>
                <div class="v2-modal-right">
                    <img src="${photo}" class="v2-modal-avatar" alt="${name}" onerror="this.src='../icons/profpicture.png'">
                    <h3 class="v2-modal-name">${name}</h3>
                    <div class="v2-modal-role" style="--modal-color-rgb: ${colorRgb}">${s.position_title || 'Siswa'}</div>
                    <div style="font-size: 12px; opacity: 0.5; font-family: monospace;">Absen ${String(s.absen_number).padStart(2, '0')}</div>
                </div>
            </div>
        `;

        popup.classList.add('active');
        document.body.classList.add('no-scroll');
    },

    setupModal() {
        const overlay = document.getElementById('v2Popup');
        const closeBtn = document.getElementById('v2ModalCloseBtn');

        closeBtn.onclick = () => this.closeModal();
        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeModal();
        };

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    },

    closeModal() {
        const overlay = document.getElementById('v2Popup');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ClassProfileV2.init();
});
