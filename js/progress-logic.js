document.addEventListener('DOMContentLoaded', initProgressPage);

async function initProgressPage() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) { window.location.href = 'index'; return; }

    document.getElementById('dateNow').innerText = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    try {
        // 1. Ambil semua ID tugas yang sudah selesai dari user_progress
        const { data: progressData, error: errProg } = await supabase
            .from('user_progress')
            .select('announcement_id, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // 2. Ambil total semua materi untuk statistik
        const { count: totalMateriCount } = await supabase
            .from('subject_announcements')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', user.class_id)
            .neq('subject_id', 'announcements');

        if (errProg) throw errProg;

        const totalDone = progressData.length;
        document.getElementById('totalDone').innerText = totalDone;
        document.getElementById('totalMateri').innerText = totalMateriCount || 0;

        const container = document.getElementById('completedTaskList');
        if (totalDone === 0) {
            container.innerHTML = `<p style="text-align:center; padding:50px; color: #aaa;">Belum ada tugas yang diselesaikan. Semangat!</p>`;
            return;
        }

        // 3. Ambil detail materi berdasarkan ID yang ada di progressData
        const doneIds = progressData.map(p => p.announcement_id);
        const { data: taskDetails, error: errTask } = await supabase
            .from('subject_announcements')
            .select('*')
            .in('id', doneIds);

        if (errTask) throw errTask;

        container.innerHTML = "";
        
        // Render tiap tugas yang beres
        taskDetails.forEach(task => {
            const finishDate = progressData.find(p => p.announcement_id == task.id).created_at;
            const dateStr = new Date(finishDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            
            const card = document.createElement('div');
            card.className = "course-card animate-slide-right";
            card.style.borderLeft = "4px solid #00eaff";
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">${task.big_title}</h3>
                        <p style="font-size: 12px; color: #00eaff; margin: 4px 0;">Mapel: ${task.subject_id.toUpperCase()}</p>
                    </div>
                    <span class="badge-upd" style="font-size: 10px; padding: 4px 8px;">Selesai: ${dateStr}</span>
                </div>
                <div style="margin-top: 10px;">
                    <button class="task-btn done" style="width: 100%; justify-content: center; cursor: default;">
                        <i class="fa-solid fa-circle-check"></i> Terverifikasi Selesai
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (e) {
        console.error("Gagal memuat progres:", e);
    }
}