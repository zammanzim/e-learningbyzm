export async function initDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Render profile data
    renderProfile(user);

    // Load dashboard data
    await loadDashboardData(user);

    // Setup tab switching
    setupTabs();

    // Load initial tab content
    loadUnfinishedTasks(user);
}

function renderProfile(user) {
    // Profile Picture
    const dashPP = document.getElementById('dashPP');
    if (dashPP) dashPP.src = user.avatar_url || 'images/default-avatar.png';

    // Full Name
    const dashFullName = document.getElementById('dashFullName');
    if (dashFullName) dashFullName.innerText = user.full_name;

    // Username
    const nickname = user.username || user.full_name.split(' ')[0].toLowerCase();
    const dashUsername = document.getElementById('dashUsername');
    if (dashUsername) dashUsername.innerText = `@${nickname}`;

    // Class
    const statClass = document.getElementById('statClass');
    if (statClass) statClass.innerText = user.class_id || "Umum";

    // Bio (optional - bisa dari user.bio)
    const dashBio = document.getElementById('dashBio');
    if (dashBio && user.bio) dashBio.innerText = user.bio;
}

async function loadDashboardData(user) {
    try {
        // Load tugas yang belum selesai (contoh - sesuaikan dengan tabel Anda)
        const { count: pendingCount } = await supabase
            .from('user_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('completed', false);

        document.getElementById('statPending').innerText = pendingCount || 0;
        document.getElementById('pendingBadge').innerText = pendingCount || 0;

        // Load bookmarks count (contoh - sesuaikan dengan tabel Anda)
        const { count: bookmarkCount } = await supabase
            .from('bookmarks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        document.getElementById('statBookmarks').innerText = bookmarkCount || 0;
        document.getElementById('bookmarkBadge').innerText = bookmarkCount || 0;

        // Load tugas selesai
        const { count: doneCount } = await supabase
            .from('user_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('completed', true);

        document.getElementById('statDone').innerText = doneCount || 0;

        // Load materi count
        let query = supabase.from('subject_announcements')
            .select('*', { count: 'exact', head: true });

        if (user.class_id) query = query.eq('class_id', user.class_id);

        const { count: materiCount } = await query;
        document.getElementById('statMateri').innerText = materiCount || 0;

    } catch (err) {
        console.error("Dashboard Error:", err);
    }
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });

            // Add active class to clicked tab
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            // Load content for this tab
            const user = JSON.parse(localStorage.getItem('user'));
            if (tabId === 'unfinished-tasks') {
                loadUnfinishedTasks(user);
            } else if (tabId === 'bookmarks') {
                loadBookmarks(user);
            }
        });
    });
}

async function loadUnfinishedTasks(user) {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    try {
        // Ganti dengan query tugas yang belum selesai sesuai tabel Anda
        const { data: tasks, error } = await supabase
            .from('tasks') // Ganti dengan nama tabel yang sesuai
            .select('*')
            .eq('user_id', user.id)
            .eq('completed', false)
            .order('due_date', { ascending: true })
            .limit(10);

        if (tasks && tasks.length > 0) {
            let html = '';
            tasks.forEach(task => {
                html += `
                <div class="task-item ${task.priority === 'high' ? 'priority-high' :
                        task.priority === 'medium' ? 'priority-medium' : ''}">
                    <div class="task-header">
                        <h3 class="task-title">${task.title}</h3>
                        <span class="task-due">${formatDate(task.due_date)}</span>
                    </div>
                    <div class="task-meta">
                        <span><i class="fa-solid fa-book"></i> ${task.subject}</span>
                        <span><i class="fa-solid fa-clock"></i> Deadline: ${task.due_date}</span>
                    </div>
                    <div class="task-actions">
                        <button class="btn-small" onclick="openTask('${task.id}')">
                            <i class="fa-solid fa-eye"></i> Lihat Detail
                        </button>
                        <button class="btn-small btn-complete" onclick="markAsComplete('${task.id}')">
                            <i class="fa-solid fa-check"></i> Tandai Selesai
                        </button>
                    </div>
                </div>
                `;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-clipboard-check"></i>
                    <h3>Tidak ada tugas yang belum selesai</h3>
                    <p>Semua tugas telah diselesaikan. Kerja bagus!</p>
                    <button class="btn-primary" onclick="window.location.href='subjects.html'">
                        <i class="fa-solid fa-book-open"></i> Pelajari Materi Baru
                    </button>
                </div>
            `;
        }
    } catch (err) {
        console.error("Tasks Error:", err);
    }
}

async function loadBookmarks(user) {
    const container = document.getElementById('bookmarksContainer');
    if (!container) return;

    try {
        // Ganti dengan query bookmarks sesuai tabel Anda
        const { data: bookmarks, error } = await supabase
            .from('bookmarks')
            .select(`
                *,
                subject_announcements (*)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (bookmarks && bookmarks.length > 0) {
            let html = '';
            bookmarks.forEach(bookmark => {
                const item = bookmark.subject_announcements;
                if (item) {
                    html += `
                    <div class="bookmark-item">
                        <div class="bookmark-header">
                            <h3 class="bookmark-title">${item.title}</h3>
                            <span class="bookmark-date">${formatDate(bookmark.created_at)}</span>
                        </div>
                        <div class="bookmark-meta">
                            <span><i class="fa-solid fa-book-open"></i> ${item.subject_id}</span>
                            <span><i class="fa-solid fa-tag"></i> Materi</span>
                        </div>
                        <div class="bookmark-actions">
                            <button class="btn-small" onclick="window.location.href='${item.subject_id}.html'">
                                <i class="fa-solid fa-external-link"></i> Buka Materi
                            </button>
                            <button class="btn-small btn-remove" onclick="removeBookmark('${bookmark.id}')">
                                <i class="fa-solid fa-trash"></i> Hapus
                            </button>
                        </div>
                    </div>
                    `;
                }
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-bookmark"></i>
                    <h3>Belum ada bookmark</h3>
                    <p>Tambahkan bookmark pada materi yang ingin disimpan untuk nanti</p>
                    <button class="btn-primary" onclick="window.location.href='library.html'">
                        <i class="fa-solid fa-magnifying-glass"></i> Jelajahi Materi
                    </button>
                </div>
            `;
        }
    } catch (err) {
        console.error("Bookmarks Error:", err);
    }
}

// Helper function
function formatDate(dateString) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}