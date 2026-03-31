// =====================================================
// USER.JS — IG-Style Profile Page
// /user           → profil sendiri
// /user?id=X      → view profil orang lain (read-only)
// =====================================================

const UserProfile = {
    state: {
        me: null,
        target: null,
        isOwnProfile: false,
        posts: [],
        currentPostIndex: 0,
        selectedFile: null,
    },

    async init() {
        await this.waitForSupabase();

        this.state.me = this.getLocalUser();
        if (!this.state.me) { window.location.href = 'login'; return; }

        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('id');
        this.state.isOwnProfile = !targetId || String(targetId) === String(this.state.me.id);

        if (this.state.isOwnProfile) {
            this.state.target = this.state.me;
            await this.refreshTargetFromDB(this.state.me.id);
        } else {
            await this.loadTargetUser(targetId);
        }

        this.syncHeader();
        this.renderProfile();
        await this.loadPosts();
        this.setupUploadListeners();

        if (typeof logVisitor === 'function') logVisitor();
    },

    waitForSupabase() {
        return new Promise(resolve => {
            const check = () => typeof supabase !== 'undefined' ? resolve() : setTimeout(check, 60);
            check();
        });
    },

    getLocalUser() {
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
    },

    async refreshTargetFromDB(userId) {
        try {
            const { data } = await supabase
                .from('users')
                .select('id, full_name, short_name, username, avatar_url, bio, class_id, classes(name)')
                .eq('id', userId).single();
            if (data) this.state.target = data;
        } catch { /* pakai data lokal */ }
    },

    async loadTargetUser(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, short_name, username, avatar_url, bio, class_id, classes(name)')
                .eq('id', userId).single();
            if (error || !data) {
                document.getElementById('profilePageWrap').innerHTML =
                    `<div style="text-align:center;padding:4rem 1rem;color:#555;">
                        <i class="fa-solid fa-user-slash" style="font-size:2rem;display:block;margin-bottom:1rem;color:#333;"></i>
                        Pengguna tidak ditemukan.
                    </div>`;
                return;
            }
            this.state.target = data;
        } catch (e) { console.error('Load user error:', e); }
    },

    syncHeader() {
        const me = this.state.me;
        const el = document.getElementById('headerName');
        const pp = document.getElementById('headerPP');
        if (el) el.innerText = `Haii, ${me.short_name || me.full_name?.split(' ')[0] || 'User'}`;
        if (pp) pp.src = me.avatar_url || 'icons/profpicture.png';
    },

    renderProfile() {
        const t = this.state.target;
        if (!t) return;

        const username = t.username || t.short_name || t.full_name?.split(' ')[0];
        const avatar = t.avatar_url || 'icons/profpicture.png';
        const bio = t.bio || '';
        const className = t.classes?.name || (t.class_id ? `Kelas ${t.class_id}` : '');

        document.title = `@${username}`;

        // Tombol edit avatar (hanya own)
        const editAvatarBtn = this.state.isOwnProfile
            ? `<button class="avatar-edit-btn" onclick="window.location.href='settingacc'" title="Ganti foto profil">
                <i class="fa-solid fa-pen" style="margin:0"></i>
               </button>`
            : '';

        // Tombol + upload — sejajar foto, HANYA own profile
        const addPostBtn = this.state.isOwnProfile
            ? `<button class="btn-add-post" onclick="openUploadModal()">
                <i class="fa-solid fa-plus"></i> Posting
               </button>`
            : '';

        // Tombol back — hanya view mode
        const backBtn = !this.state.isOwnProfile
            ? `<button onclick="history.back()" style="
                position:absolute;top:10px;left:10px;
                background:rgba(0,0,0,0.5);border:none;color:white;
                border-radius:50%;width:32px;height:32px;cursor:pointer;
                display:flex;align-items:center;justify-content:center;z-index:5;">
                <i class="fa-solid fa-arrow-left" style="margin:0;font-size:13px;"></i>
               </button>`
            : '';

        const html = `
        <div class="profile-header-card animate-pop-up">
            <div class="profile-cover">${backBtn}</div>

            <!-- Avatar + tombol + sejajar -->
            <div class="profile-avatar-row">
                <div class="profile-avatar-wrap">
                    <img class="profile-avatar" src="${avatar}" alt="${t.full_name}"
                         onerror="this.src='icons/profpicture.png'">
                    ${editAvatarBtn}
                </div>
                ${addPostBtn}
            </div>

            <!-- Info -->
            <div class="profile-info">
                <div class="profile-fullname">${t.full_name || username}</div>
                <div class="profile-username">@${username}</div>
                ${bio ? this.buildBioHTML(bio) : ''}
                ${className ? `<div class="profile-class-badge"><i class="fa-solid fa-school" style="margin:0;font-size:10px;"></i> ${className}</div>` : ''}
                <div class="profile-stats">
                    <div class="stat-item">
                        <span class="stat-num" id="postCountStat">–</span>
                        <span class="stat-label">Postingan</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="posts-section-label">
            <i class="fa-solid fa-grid-2" style="font-size:10px;margin:0;"></i>
            Postingan
        </div>

        <div class="posts-grid" id="postsGrid">
            ${[1, 2, 3, 4, 5, 6].map(() => `<div class="posts-skeleton"></div>`).join('')}
        </div>`;

        document.getElementById('profileSkeleton')?.remove();
        document.getElementById('profilePageWrap').innerHTML = html;
    },

    async loadPosts() {
        const t = this.state.target;
        if (!t) return;
        try {
            const { data, error } = await supabase
                .from('user_posts')
                .select('*')
                .eq('user_id', t.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.state.posts = data || [];
            this.renderPostsGrid();

            const el = document.getElementById('postCountStat');
            if (el) el.textContent = this.state.posts.length;
        } catch (err) {
            console.error('Load posts error:', err);
            const grid = document.getElementById('postsGrid');
            if (grid) grid.innerHTML = `<div class="posts-empty"><i class="fa-solid fa-triangle-exclamation"></i><p style="font-size:.85rem;">Gagal memuat postingan.</p></div>`;
        }
    },

    renderPostsGrid() {
        const grid = document.getElementById('postsGrid');
        if (!grid) return;

        if (this.state.posts.length === 0) {
            const msg = this.state.isOwnProfile
                ? `<i class="fa-regular fa-image"></i>
                   <p style="font-size:.85rem;">Belum ada postingan.</p>
                   <p style="color:#444;font-size:.78rem;">Tekan <b style="color:var(--accent,#00eaff)">+ Posting</b> untuk mulai!</p>`
                : `<i class="fa-regular fa-image"></i><p style="font-size:.85rem;">Belum ada postingan.</p>`;
            grid.innerHTML = `<div class="posts-empty">${msg}</div>`;
            return;
        }

        grid.innerHTML = this.state.posts.map((post, i) => {
            if (post.image_url) {
                return `<div class="post-thumb animate-fade-in" onclick="UserProfile.openPostDetail(${i})">
                    <img src="${post.image_url}" alt="" loading="lazy"
                         onerror="this.parentElement.style.background='rgba(255,255,255,0.04)'">
                    <div class="post-thumb-overlay">
                        <i class="fa-solid fa-expand" style="margin:0;"></i>
                    </div>
                </div>`;
            }
            // Text-only post
            const preview = (post.caption || '').slice(0, 60);
            return `<div class="post-thumb animate-fade-in post-thumb-text" onclick="UserProfile.openPostDetail(${i})"
                style="display:flex;align-items:center;justify-content:center;padding:8px;background:rgba(0,0,0,0.45);">
                <span style="font-size:0.7rem;color:#ccc;text-align:center;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${this.escapeHtml(preview)}${post.caption?.length > 60 ? '…' : ''}</span>
            </div>`;
        }).join('');
    },

    openPostDetail(index) {
        const post = this.state.posts[index];
        if (!post) return;
        this.state.currentPostIndex = index;

        const t = this.state.target;
        const username = t.username || t.short_name || t.full_name?.split(' ')[0];

        document.getElementById('detailUserAvatar').src = t.avatar_url || 'icons/profpicture.png';
        document.getElementById('detailUserName').textContent = `@${username}`;
        document.getElementById('detailPostTime').textContent = this.formatDate(post.created_at);
        document.getElementById('detailCapText').textContent = post.caption || '';

        // Gambar — sembunyikan kalau text-only
        const imgEl = document.getElementById('detailPostImg');
        if (post.image_url) {
            imgEl.src = post.image_url;
            imgEl.style.display = 'block';
        } else {
            imgEl.src = '';
            imgEl.style.display = 'none';
        }

        // Tombol hapus — HANYA own profile
        const actionsWrap = document.getElementById('detailActionsWrap');
        if (actionsWrap) {
            if (this.state.isOwnProfile) {
                actionsWrap.classList.remove('hidden');
            } else {
                actionsWrap.classList.add('hidden');
            }
        }

        document.getElementById('postDetailOverlay').classList.add('show');

        // Reset tombol hapus ke state normal (jaga-jaga dari delete sebelumnya)
        const btn = document.getElementById('btnDeletePost');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Hapus Post'; }

        lockScroll();
    },

    async deleteCurrentPost() {
        const post = this.state.posts[this.state.currentPostIndex];
        if (!post) return;

        const confirmed = await showPopup('Hapus postingan ini? Aksi ini tidak bisa dibatalkan.', 'confirm');
        if (!confirmed) return;

        const btn = document.getElementById('btnDeletePost');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menghapus...'; }

        try {
            if (post.image_url) {
                const fileName = post.image_url.split('/post-photos/')[1]?.split('?')[0];
                if (fileName) await supabase.storage.from('post-photos').remove([fileName]);
            }

            const { error } = await supabase.from('user_posts').delete().eq('id', post.id);
            if (error) throw error;

            closePostDetail();
            showPopup('Postingan dihapus!', 'success');
            await this.loadPosts();

            const el = document.getElementById('postCountStat');
            if (el) el.textContent = this.state.posts.length;

        } catch (err) {
            console.error('Delete error:', err);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Hapus Post'; }
            showPopup('Gagal menghapus: ' + (err?.message || 'Unknown error'), 'error');
        }
    },

    // ── Upload ──────────────────────────────────────
    setupUploadListeners() {
        const fileInput = document.getElementById('uploadFileInput');
        const dropZone = document.getElementById('uploadDropZone');
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.previewFile(file);
        });

        dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('image/')) this.previewFile(file);
        });
    },

    previewFile(file) {
        this.state.selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('uploadPreviewImg').src = e.target.result;
            document.getElementById('uploadDropZone').classList.add('hidden');
            document.getElementById('uploadPreviewWrap').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    },

    async submitPost() {
        const caption = document.getElementById('uploadCaption').value.trim();

        if (!this.state.selectedFile && !caption) {
            showPopup('Tulis caption atau pilih foto dulu!', 'error');
            return;
        }

        const btn = document.getElementById('btnPostSave');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Mengunggah...';

        try {
            let imageUrl = null;

            // Upload foto kalau ada
            if (this.state.selectedFile) {
                const file = this.state.selectedFile;
                const compressed = await this.compressImage(file, 1080, 0.82);
                const ext = file.name.split('.').pop() || 'jpg';
                const fileName = `${this.state.me.id}/${Date.now()}.${ext}`;

                const { error: uploadErr } = await supabase.storage
                    .from('post-photos')
                    .upload(fileName, compressed, { upsert: false, contentType: 'image/jpeg' });

                if (uploadErr) throw uploadErr;

                const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(fileName);
                imageUrl = urlData.publicUrl;
            }

            const { error: dbErr } = await supabase.from('user_posts').insert({
                user_id: this.state.me.id,
                image_url: imageUrl,
                caption: caption || null,
            });

            if (dbErr) throw dbErr;

            showPopup('Post berhasil!', 'success');
            closeUploadModal();
            await this.loadPosts();

            const el = document.getElementById('postCountStat');
            if (el) el.textContent = this.state.posts.length;

        } catch (err) {
            console.error('Upload error:', err);
            const msg = err?.message || err?.error_description || JSON.stringify(err);
            showPopup('Error: ' + msg, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post';
        }
    },

    compressImage(file, maxSize = 1080, quality = 0.82) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let { width, height } = img;
                if (width > maxSize || height > maxSize) {
                    const r = Math.min(maxSize / width, maxSize / height);
                    width = Math.round(width * r);
                    height = Math.round(height * r);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            img.src = url;
        });
    },

    formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const diff = (Date.now() - d) / 1000;
        if (diff < 60) return 'Baru saja';
        if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    buildBioHTML(bio) {
        const MAX = 100;
        // Konversi newline ke <br>, bukan pakai pre-wrap (biar gak kena indent template literal)
        const toHTML = (s) => this.escapeHtml(s).replace(/\n/g, '<br>');

        if (bio.length <= MAX) {
            return `<div class="profile-bio">${toHTML(bio)}</div>`;
        }
        // Potong di batas kata terdekat sebelum MAX
        let cutAt = MAX;
        while (cutAt > 0 && bio[cutAt] !== ' ' && bio[cutAt] !== '\n') cutAt--;
        const short = toHTML(bio.slice(0, cutAt || MAX));
        const full = toHTML(bio);
        // Semua inline — tidak ada whitespace aneh dari template literal
        return '<div class="profile-bio" id="profileBio">'
            + '<span id="bioShort">' + short + '…</span>'
            + '<span id="bioFull" style="display:none;">' + full + '</span>'
            + '<button onclick="toggleBio()" id="bioToggleBtn" style="background:none;border:none;color:var(--accent,#00eaff);font-size:0.78rem;cursor:pointer;padding:0;margin-left:4px;font-weight:600;">selengkapnya</button>'
            + '</div>';
    },

    escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
};

// ── Global helpers dipanggil dari HTML ───────────────

function openUploadModal() {
    const modal = document.getElementById('uploadModal');
    modal.classList.remove('hidden');
    lockScroll();

    // Reset form tiap kali buka — biar draft lama gak keliatan
    document.getElementById('uploadCaption').value = '';
    document.getElementById('captionCounter').textContent = '0/500';
    document.getElementById('uploadFileInput').value = '';
    document.getElementById('uploadPreviewWrap').classList.add('hidden');
    document.getElementById('uploadDropZone').classList.remove('hidden');
    UserProfile.state.selectedFile = null;

    // Klik area gelap = tutup
    modal.onclick = (e) => { if (e.target === modal) closeUploadModal(); };

    // Ctrl+Enter = submit
    document.addEventListener('keydown', _uploadKeyHandler);

    // Fokus ke textarea
    setTimeout(() => document.getElementById('uploadCaption')?.focus(), 100);
}

function _uploadKeyHandler(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitPost();
    }
    if (e.key === 'Escape') closeUploadModal();
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.add('hidden');
    document.getElementById('uploadCaption').value = '';
    document.getElementById('captionCounter').textContent = '0/500';
    document.getElementById('uploadFileInput').value = '';
    document.getElementById('uploadPreviewWrap').classList.add('hidden');
    document.getElementById('uploadDropZone').classList.remove('hidden');
    UserProfile.state.selectedFile = null;
    document.removeEventListener('keydown', _uploadKeyHandler);
    unlockScroll();
}

function removeUploadPreview() {
    document.getElementById('uploadPreviewWrap').classList.add('hidden');
    document.getElementById('uploadDropZone').classList.remove('hidden');
    document.getElementById('uploadFileInput').value = '';
    UserProfile.state.selectedFile = null;
}

function closePostDetail() {
    document.getElementById('postDetailOverlay').classList.remove('show');
    unlockScroll();
}

function handleDetailOverlayClick(e) {
    if (e.target === document.getElementById('postDetailOverlay')) closePostDetail();
}

function deleteCurrentPost() {
    UserProfile.deleteCurrentPost();
}

function submitPost() {
    UserProfile.submitPost();
}

function toggleBio() {
    const short = document.getElementById('bioShort');
    const full = document.getElementById('bioFull');
    const btn = document.getElementById('bioToggleBtn');
    const isOpen = full.style.display !== 'none';
    short.style.display = isOpen ? 'inline' : 'none';
    full.style.display = isOpen ? 'none' : 'inline';
    btn.textContent = isOpen ? 'selengkapnya' : 'sembunyikan';
}

// ── Boot ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => UserProfile.init());