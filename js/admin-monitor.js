document.addEventListener('DOMContentLoaded', initAdminMonitor);

async function initAdminMonitor() {
    const admin = JSON.parse(localStorage.getItem("user"));
    if (!admin || (admin.role !== 'class_admin' && admin.role !== 'super_admin')) {
        window.location.href = 'homev2'; return;
    }

    try {
        const CLASS_ID = admin.class_id;

        // 1. Fetch Data Master secara paralel biar cepet
        const [usersRes, tasksRes, progressRes, bookmarkRes, visitorRes] = await Promise.all([
            supabase.from('users').select('*').eq('class_id', CLASS_ID),
            supabase.from('subject_announcements').select('id').eq('class_id', CLASS_ID).neq('subject_id', 'announcements'),
            supabase.from('user_progress').select('*'),
            supabase.from('bookmarks').select('*'),
            supabase.from('visitors').select('*').eq('class_id', CLASS_ID).order('visited_at', { ascending: false })
        ]);

        const students = usersRes.data || [];
        const allTaskIds = tasksRes.data.map(t => t.id);
        const totalTasks = allTaskIds.length;

        document.getElementById('totalStudents').innerText = students.length;

        const container = document.getElementById('adminUserList');
        container.innerHTML = "";

        let totalProgressSum = 0;

        students.forEach(u => {
            // Filter data khusus untuk user ini
            // ... di dalam students.forEach(u => { ...

            // GUNAKAN String() untuk memastikan perbandingan ID selalu valid
            const myProgress = progressRes.data.filter(p => String(p.user_id) === String(u.id));
            const myBookmarks = bookmarkRes.data.filter(b => String(b.user_id) === String(u.id));

            // Pastikan pencarian aktivitas terakhir juga menggunakan String
            const myLastVisit = visitorRes.data.find(v => String(v.user_id) === String(u.id));

            // ... sisa kode lainnya

            const doneCount = myProgress.length;
            const progressPercent = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
            totalProgressSum += progressPercent;

            const card = document.createElement('div');
            card.className = "course-card animate-slide-right";
            card.dataset.name = u.full_name.toLowerCase();

            card.innerHTML = `
                <div style="display: flex; gap: 15px; align-items: flex-start;">
                    <img src="${u.avatar_url || 'profpicture.png'}" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid #00eaff; object-fit: cover;">
                    <div style="flex: 1;">
                        <h3 style="margin: 0; font-size: 16px;">${u.full_name} <span class="mini-badge badge-beta">${u.role}</span></h3>
                        <p style="font-size: 11px; color: #00eaff; margin: 2px 0;">@${u.username || 'n/a'}</p>
                        <p style="font-size: 11px; color: #888; font-style: italic;">"${u.bio || '-'}"</p>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-item"><b>Shortname</b>${u.short_name || '-'}</div>
                    <div class="info-item"><b>Password</b><code style="background: rgba(0,0,0,0.3); padding: 2px 4px;">${u.password || '******'}</code></div>
                </div>

                <div style="margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
                        <span style="color: #aaa;">TASK PROGRESS (${doneCount}/${totalTasks})</span>
                        <span style="color: #0be881; font-weight: bold;">${progressPercent}%</span>
                    </div>
                    <div class="progress-mini-wrapper">
                        <div class="progress-mini-bar" style="width: ${progressPercent}%"></div>
                    </div>
                </div>

                <div class="admin-stat-row">
                    <span class="mini-badge badge-new"><i class="fa-solid fa-bookmark"></i> ${myBookmarks.length} Bookmarks</span>
                    <span class="mini-badge badge-info"><i class="fa-solid fa-check-double"></i> ${doneCount} Done</span>
                </div>

                <div class="last-act">
                    <i class="fa-solid fa-clock"></i> Terakhir terlihat: 
                    ${myLastVisit ? `<span style="color: #fff;">${new Date(myLastVisit.visited_at).toLocaleString('id-ID')}</span> di <b style="color:#00eaff">${myLastVisit.last_page}</b>` : 'Belum pernah login'}
                </div>
            `;
            container.appendChild(card);
        });

        document.getElementById('avgProgress').innerText = students.length > 0 ? Math.round(totalProgressSum / students.length) + "%" : "0%";

        // Fitur Filter Search Sederhana
        document.getElementById('adminSearchUser').addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            document.querySelectorAll('#adminUserList .course-card').forEach(card => {
                card.style.display = card.dataset.name.includes(val) ? 'block' : 'none';
            });
        });

    } catch (err) {
        console.error("Monitor Error:", err);
        document.getElementById('adminUserList').innerHTML = "<p>Gagal memuat data.</p>";
    }
}