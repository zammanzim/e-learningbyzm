// HAPUS BARIS IMPORT INI. 
// Supabase udah diload secara global di HTML lewat script tag supabase-clients.js
// import { supabase } from './supabase-clients.js'; 

export async function initDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // --- 2. RENDER DASHBOARD ---

    // Foto Profil Besar
    const dashPP = document.getElementById('dashPP');
    if (dashPP) dashPP.src = user.avatar_url || defaultPP;

    // Nama Lengkap
    const dashFullName = document.getElementById('dashFullName');
    if (dashFullName) dashFullName.innerText = user.full_name;

    // Username / Nickname
    const nickname = user.username || users.full_name.split(' ')[0].toLowerCase().replace(/\s/g, '');
    const dashUsername = document.getElementById('dashUsername');
    if (dashUsername) dashUsername.innerText = `@${nickname}`;

    // Kelas
    const statClass = document.getElementById('statClass');
    if (statClass) statClass.innerText = user.class_id || "Umum";

    // --- 3. LOAD DATA ---
    loadStats(user);
    loadGridFeed(user);
}

async function loadStats(user) {
    try {
        // PANGGIL 'supabase' LANGSUNG (Global Variable)
        const { count: doneCount } = await supabase
            .from('user_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        const statDone = document.getElementById('statDone');
        if (statDone) statDone.innerText = doneCount || 0;

        let query = supabase.from('subject_announcements').select('*', { count: 'exact', head: true });
        if (user.class_id) query = query.eq('class_id', user.class_id);

        const { count: materiCount } = await query;
        const statMateri = document.getElementById('statMateri');
        if (statMateri) statMateri.innerText = materiCount || 0;

    } catch (err) {
        console.error("Stats Error:", err);
    }
}

async function loadGridFeed(user) {
    const container = document.getElementById('igFeed');
    if (!container) return;

    try {
        let query = supabase
            .from('subject_announcements')
            .select('id, title, photo_url, subject_id, big_title')
            .order('created_at', { ascending: false })
            .limit(12);

        if (user.class_id) {
            query = query.eq('class_id', user.class_id);
        }

        const { data, error } = await query;

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#aaa;">Belum ada materi.</div>';
            return;
        }

        container.innerHTML = '';

        data.forEach(item => {
            let thumbUrl = '';

            if (item.photo_url) {
                if (Array.isArray(item.photo_url)) thumbUrl = item.photo_url[0];
                else if (item.photo_url.startsWith('[')) {
                    try { thumbUrl = JSON.parse(item.photo_url)[0]; } catch (e) { }
                } else if (item.photo_url.includes(',')) {
                    thumbUrl = item.photo_url.split(',')[0];
                } else {
                    thumbUrl = item.photo_url;
                }
            }

            let innerHTML = '';
            if (thumbUrl && thumbUrl.length > 5) {
                innerHTML = `<img src="${thumbUrl}" loading="lazy">`;
            } else {
                const colors = ['#2980b9', '#27ae60', '#8e44ad', '#d35400', '#c0392b', '#16a085'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                innerHTML = `
                    <div class="ig-text-post" style="background:${randomColor}">
                        <span>${item.big_title || item.title}</span>
                    </div>
                `;
            }

            const postHTML = `
                <div class="ig-post" onclick="window.location.href='${item.subject_id}.html'">
                    ${innerHTML}
                </div>
            `;
            container.insertAdjacentHTML('beforeend', postHTML);
        });

    } catch (err) {
        console.error("Feed Error:", err);
    }
}