let openTopicId = null;
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

// Tambahkan variabel state untuk melacak balasan yang terbuka

async function loadTopics() {
    const user = getUser(); // Dari auth.js
    const container = document.getElementById('forumList');

    try {
        const { data, error } = await supabase
            .from('forum_topics')
            .select('*, users(nickname, avatar_url)')
            .eq('class_id', user.class_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        container.innerHTML = data.length === 0 ?
            `<p style="text-align:center; padding:40px; color:#aaa;">Belum ada diskusi.</p>` : "";

        // File: js/forum.js

        data.forEach(topic => {
            const card = document.createElement('div');
            card.className = "course-card animate-slide-right";
            card.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <img src="${topic.users.avatar_url || 'icons/profpicture.png'}" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid #00eaff;">
            <div>
                <strong style="display: block; font-size: 14px;">${topic.users.nickname}</strong>
                <small style="color: #888; font-size: 11px;">${new Date(topic.created_at).toLocaleString('id-ID')}</small>
            </div>
        </div>
        <h3 style="font-size: 18px; margin-bottom: 8px; color: #00eaff;">${topic.title}</h3>
        <p style="font-size: 14px; color: #ddd; line-height: 1.5;">${topic.content}</p>
        
        <div id="replySection-${topic.id}" style="margin-top: 15px; display: none;">
            <div id="replyList-${topic.id}" style="margin-bottom: 10px; padding-left: 20px; border-left: 2px solid rgba(0,234,255,0.2);"></div>
            <div style="display: flex; gap: 8px;">
                <input type="text" id="inputReply-${topic.id}" class="glass-input" placeholder="Tulis balasan..." style="font-size: 13px; padding: 8px;">
                <button onclick="sendReply('${topic.id}')" class="btn-glass-save" style="flex: 0; padding: 0 15px;">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        </div>

        <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
            <button class="btn-tool" onclick="toggleReplies('${topic.id}')">
                <i class="fa-solid fa-comments"></i> Balasan
            </button>
        </div>
    `;
            container.appendChild(card);
        });
    } catch (err) { console.error(err); }
}

async function toggleReplies(topicId) {
    const section = document.getElementById(`replySection-${topicId}`);
    if (section.style.display === 'none') {
        section.style.display = 'block';
        loadReplies(topicId);
    } else {
        section.style.display = 'none';
    }
}

async function loadReplies(topicId) {
    const list = document.getElementById(`replyList-${topicId}`);
    list.innerHTML = `<small style="color:#888;">Memuat balasan...</small>`;

    const { data, error } = await supabase
        .from('forum_replies')
        .select('*, users(nickname)')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });

    if (error) return;

    list.innerHTML = data.length === 0 ? `<small style="color:#666;">Belum ada balasan.</small>` : "";
    data.forEach(r => {
        const div = document.createElement('div');
        div.style = "margin-bottom: 10px; font-size: 13px;";
        div.innerHTML = `<b style="color: #00eaff;">${r.users.nickname}:</b> <span style="color: #ddd;">${r.content}</span>`;
        list.appendChild(div);
    });
}

async function sendReply(topicId) {
    const input = document.getElementById(`inputReply-${topicId}`);
    const content = input.value.trim();
    if (!content) return;

    const user = getUser();
    const { error } = await supabase.from('forum_replies').insert({
        topic_id: topicId,
        user_id: user.id,
        content: content
    });

    if (!error) {
        input.value = "";
        loadReplies(topicId);
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