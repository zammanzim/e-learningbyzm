// ==========================================
// js/kisi-kisi.js
// Inject status badge (BESOK / KISI) dan filter
// ke cards yang sudah di-render SubjectApp
// ==========================================

(function () {
    let deadlineSubjects = []; // list mapel yang ulangannya besok/hari ini (normalized)

    // Normalisasi: hapus semua kecuali huruf dan angka
    function normalize(str) {
        return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    }

    // Ekstrak nama mapel dari judul kartu
    // Format diharapkan: "Kisi - Kisi Bahasa Indonesia" → "Bahasa Indonesia"
    // Juga handle: "Kisi Kisi MTK", "Kisi-Kisi IPA", dll.
    function extractMapel(bigTitle) {
        if (!bigTitle) return bigTitle;
        // Hapus semua variasi "kisi" di awal (case insensitive)
        return bigTitle.replace(/^kisi[\s\-]+kisi[\s\-]*/i, '').trim();
    }

    // ==========================================
    // 1. AMBIL JADWAL DEADLINE
    // ==========================================
    async function loadDeadlineSubjects() {
        let user;
        try { user = JSON.parse(localStorage.getItem('user')); } catch (e) { return; }
        if (!user) return;

        const now  = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        let targetDay = days[now.getDay()];

        // Sama persis logika tugas.js: setelah jam 15, lihat jadwal besok
        if (now.getHours() >= 15) {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            targetDay = days[tomorrow.getDay()];
        }

        try {
            const { data: sched } = await supabase
                .from('daily_schedules')
                .select('lessons')
                .eq('class_id', user.class_id)
                .eq('day_name', targetDay)
                .single();

            if (sched && sched.lessons) {
                deadlineSubjects = sched.lessons
                    .split(';')
                    .map(item => {
                        const parts = item.split('-');
                        const name  = parts.length > 1 ? parts[1] : parts[0];
                        return normalize(name.trim());
                    })
                    .filter(s => s.length > 0);
            }
        } catch (e) {
            console.warn('kisi-kisi: gagal ambil jadwal deadline', e);
        }
    }

    // ==========================================
    // 2. CEK APAKAH SEBUAH KARTU = DEADLINE
    // ==========================================
    function isDeadlineCard(bigTitle) {
        const mapel = normalize(extractMapel(bigTitle));
        return deadlineSubjects.some(s => mapel.includes(s) || s.includes(mapel));
    }

    // ==========================================
    // 3. INJECT BADGE + CLASS KE SETIAP KARTU
    // ==========================================
    function injectBadges() {
        const cards = document.querySelectorAll('#announcements .course-card');
        cards.forEach(card => {
            // Jangan inject dua kali
            if (card.querySelector('.kisi-status-badge')) return;

            const bigTitleEl = card.querySelector('[data-field="big_title"]');
            if (!bigTitleEl) return;

            const bigTitle = bigTitleEl.innerText.trim();
            const isHot    = isDeadlineCard(bigTitle);

            // Tentukan badge
            const badgeClass = isHot ? 'kisi-badge-besok' : 'kisi-badge-kisi';
            const badgeIcon  = isHot ? 'fa-fire'          : 'fa-book';
            const badgeText  = isHot ? 'BESOK'            : 'KISI';

            // Tambah class warna ke card
            card.classList.remove('kisi-is-besok', 'kisi-is-kisi');
            card.classList.add(isHot ? 'kisi-is-besok' : 'kisi-is-kisi');

            // Insert badge tepat sebelum h3 (big_title)
            const badge = document.createElement('div');
            badge.className = `kisi-status-badge ${badgeClass}`;
            badge.innerHTML = `<i class="fa-solid ${badgeIcon}"></i> ${badgeText}`;
            bigTitleEl.parentNode.insertBefore(badge, bigTitleEl);
        });
    }

    // ==========================================
    // 4. BUILD FILTER DROPDOWN
    // ==========================================
    function buildFilterOptions() {
        const select = document.getElementById('kisiFilter');
        if (!select) return;

        // Kumpulkan mapel unik dari semua kartu yang tampil
        const seen   = new Set();
        const cards  = document.querySelectorAll('#announcements .course-card');

        cards.forEach(card => {
            const el = card.querySelector('[data-field="big_title"]');
            if (!el) return;
            const mapel = extractMapel(el.innerText.trim());
            if (mapel && !seen.has(mapel)) {
                seen.add(mapel);
                const opt = new Option(mapel, mapel);
                select.appendChild(opt);
            }
        });
    }

    // ==========================================
    // 5. FILTER LOGIC
    // ==========================================
    window.applyKisiFilter = function () {
        const val   = document.getElementById('kisiFilter')?.value || 'all';
        const cards = document.querySelectorAll('#announcements .course-card');

        cards.forEach(card => {
            if (val === 'all') {
                card.style.display = '';
                return;
            }
            const el     = card.querySelector('[data-field="big_title"]');
            const mapel  = extractMapel(el?.innerText.trim() || '');
            card.style.display = (mapel === val) ? '' : 'none';
        });
    };

    // ==========================================
    // 6. OBSERVE: TUNGGU SubjectApp SELESAI RENDER
    // ==========================================
    function watchAnnouncements() {
        const container = document.getElementById('announcements');
        if (!container) { setTimeout(watchAnnouncements, 100); return; }

        const observer = new MutationObserver(() => {
            // Cek ada .course-card beneran (bukan skeleton)
            const hasCards = container.querySelector('.course-card');
            if (hasCards) {
                injectBadges();
                buildFilterOptions();
            }
        });

        observer.observe(container, { childList: true, subtree: true });
    }

    // ==========================================
    // START
    // ==========================================
    document.addEventListener('DOMContentLoaded', async () => {
        await loadDeadlineSubjects();
        watchAnnouncements();
    });

})();