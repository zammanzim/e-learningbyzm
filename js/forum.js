document.addEventListener('DOMContentLoaded', initForum);

async function initForum() {
    const user = getUser(); // Dari auth.js
    if (!user) { window.location.href = 'index'; return; }

    loadTopics();

    // Realtime update (opsional tapi keren)
    supabase.channel('forum_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_topics' }, payload => {
            loadTopics();
        })
        .subscribe();
}

async function loadTopics() {
    const user = getUser();
    const container = document.getElementById('forumList');

    try {
        const { data, error } = await supabase
            .from('forum_topics')
            .select('*, users(nickname, avatar_url)')
            .eq('class_id', user.class_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        container.innerHTML = data.length === 0 ?
            `<p style="text-align:center; padding:40px; color:#aaa;">Belum ada diskusi. Jadilah yang pertama!</p>` : "";

        data.forEach(topic => {
            const card = document.createElement('div');
            card.className = "course-card animate-slide-right";
            card.innerHTML = `
                <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <img src="${topic.users?.avatar_url || 'icons/profpicture.png'}" 
                         style="width: 35px; height: 35px; border-radius: 50%; border: 1px solid #00eaff; object-fit: cover;">
                    <div>
                        <h4 style="margin: 0; font-size: 14px; color: #fff;">${topic.users?.nickname || 'User'}</h4>
                        <small style="color: #888;">${new Date(topic.created_at).toLocaleDateString('id-ID')}</small>
                    </div>
                </div>
                <h3 style="margin: 0 0 8px 0; color: #00eaff;">${topic.title}</h3>
                <p style="font-size: 14px; color: #ddd; line-height: 1.5;">${topic.content}</p>
                <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                    <button class="btn-tool" onclick="showPopup('Fitur balasan segera hadir!', 'info')">
                        <i class="fa-solid fa-comment-dots"></i> Lihat Balasan
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Gagal muat forum:", err);
    }
}

async function postNewTopic() {
    const user = getUser();
    const title = document.getElementById('topicTitle').value.trim();
    const content = document.getElementById('topicContent').value.trim();

    if (!title || !content) {
        showPopup("Judul dan konten wajib diisi!", "error");
        return;
    }

    try {
        const { error } = await supabase.from('forum_topics').insert({
            user_id: user.id,
            class_id: user.class_id,
            title: title,
            content: content
        });

        if (error) throw error;

        showPopup("Diskusi berhasil diposting!", "success");
        document.getElementById('topicTitle').value = "";
        document.getElementById('topicContent').value = "";
        loadTopics();
    } catch (err) {
        showPopup("Gagal posting: " + err.message, "error");
    }
}