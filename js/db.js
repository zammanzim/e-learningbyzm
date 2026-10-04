// ============================================================
// DB — satu-satunya akses Supabase (urutan: supabase-js -> config -> db)
// Pola contek osistarpanone: client tunggal `supa`, semua query
// lewat helper di file ini.
// ============================================================

const supa = (() => {
    try {
        return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.warn("Supabase CDN belum termuat.", e);
        const t = new Error("Offline — data tidak tersedia.");
        return new Proxy({}, { get() { throw t; } });
    }
})();

const ExamDB = {

    async classes() {
        const { data, error } = await supa.from("exam_classes")
            .select("*").eq("is_active", true).order("display_order");
        if (error) throw error;
        return data || [];
    },

    // Resolve ?id= (slug "xrpl1", angka "2", nama) jadi baris kelas.
    async resolveClass(param) {
        const list = await ExamDB.classes();
        if (!list.length) throw new Error("Belum ada data kelas.");
        const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const np = norm(param);
        let found = null;
        if (/^\d+$/.test(String(param || ""))) {
            found = list.find(c => String(c.id) === String(param));
        }
        if (!found && np) {
            found = list.find(c => norm(c.slug) === np || norm(c.name) === np);
            if (!found) {
                const d = (np.match(/(\d+)$/) || [])[1];
                if (d) found = list.find(c => ((norm(c.name).match(/(\d+)$/) || [])[1]) === d);
            }
        }
        return found || list.find(c => c.slug === "xrpl2") || list[0];
    },

    async examDays(classId) {
        try {
            const { data, error } = await supa.from("exam_config")
                .select("exam_days").eq("class_id", classId).maybeSingle();
            if (error) throw error;
            if (data && Array.isArray(data.exam_days) && data.exam_days.length) return data.exam_days;
        } catch (e) { console.warn("examDays:", e); }
        return ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
    },

    // Jadwal exam 1 kelas: { day: [{jam, mapel}] }.
    // Kosong -> fallback jadwal XRPL2 biar ga kopong (flag ikut).
    async schedule(classId) {
        const pull = async (cid) => {
            const { data, error } = await supa.from("exam_schedules")
                .select("day_name, items").eq("class_id", cid);
            if (error) throw error;
            return data || [];
        };
        let rows = await pull(classId);
        let shared = false;
        if (!rows.length) {
            const xrpl2 = (await ExamDB.classes()).find(c => c.slug === "xrpl2");
            if (xrpl2 && Number(xrpl2.id) !== Number(classId)) {
                rows = await pull(xrpl2.id);
                shared = rows.length > 0;
            }
        }
        const map = {};
        rows.forEach(r => {
            const items = Array.isArray(r.items) ? r.items : [];
            if (items.length) map[r.day_name] = items;
        });
        return { map, shared };
    },

    async kisi(classId) {
        const { data, error } = await supa.from("exam_kisi").select("*")
            .eq("class_id", classId).order("display_order").order("id");
        if (error) throw error;
        return data || [];
    },

    async media(kisiIds) {
        if (!kisiIds.length) return {};
        const { data, error } = await supa.from("exam_media").select("*")
            .in("kisi_id", kisiIds).order("display_order").order("id");
        if (error) throw error;
        const map = {};
        (data || []).forEach(m => { (map[m.kisi_id] = map[m.kisi_id] || []).push(m); });
        return map;
    },

    async subjects() {
        const { data, error } = await supa.from("exam_subjects").select("*").order("name");
        if (error) throw error;
        return data || [];
    },

    async teachers(classId) {
        try {
            let q = supa.from("exam_teachers").select("*");
            if (classId) q = q.eq("class_id", classId);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn("teachers:", e); return []; }
    },

    // Soal global (class_id NULL) selalu ikut di kelas mana pun.
    async questionCount(classId) {
        let q = supa.from("exam_questions").select("subject").eq("is_active", true);
        if (classId) q = q.or(`class_id.is.null,class_id.eq.${classId}`);
        const { data, error } = await q;
        if (error) throw error;
        const counts = {};
        (data || []).forEach(r => { counts[r.subject] = (counts[r.subject] || 0) + 1; });
        return counts;
    },

    async questions(subject, classId) {
        let q = supa.from("exam_questions").select("*")
            .eq("subject", subject).eq("is_active", true);
        if (classId) q = q.or(`class_id.is.null,class_id.eq.${classId}`);
        const { data, error } = await q.order("display_order").order("id");
        if (error) throw error;
        return data || [];
    },

    // Urutan hari: hari-ini-dulu (lewat 15:00 = besok).
    dayOrder(days) {
        const names = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const now = new Date();
        let today = names[now.getDay()];
        if (now.getHours() >= 15) {
            const tom = new Date(now);
            tom.setDate(now.getDate() + 1);
            today = names[tom.getDay()];
        }
        const i = days.indexOf(today);
        if (i === -1) return [...days];
        return [...days.slice(i), ...days.slice(0, i)];
    },

    // Urutin kisi ngikut jadwal: hari dulu, terus posisi mapel hari itu.
    // Kisi yang mapelnya ga ada di jadwal (Lainnya) taro paling belakang.
    orderKisi(items, schedMap, days) {
        const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const posIn = (nSubj, day) => {
            const list = (schedMap && schedMap[day]) || [];
            let i = list.findIndex(e => norm(e.mapel) === nSubj);
            if (i !== -1) return i;
            i = list.findIndex(e => {
                const nm = norm(e.mapel);
                return nm && (nm.includes(nSubj) || nSubj.includes(nm));
            });
            return i;
        };
        return [...items].sort((a, b) => {
            const da = (days || []).indexOf(a.day_name);
            const db = (days || []).indexOf(b.day_name);
            const ia = da === -1 ? 999 : da, ib = db === -1 ? 999 : db;
            if (ia !== ib) return ia - ib;
            const pa = posIn(norm(a.subject), a.day_name);
            const pb = posIn(norm(b.subject), b.day_name);
            const xa = pa === -1 ? 999 : pa, xb = pb === -1 ? 999 : pb;
            if (xa !== xb) return xa - xb;
            return String(a.subject || "").localeCompare(String(b.subject || ""));
        });
    },

    // Profil lokal (dari index): { slug, name }. Tanpa login.
    profile() {
        try { return JSON.parse(localStorage.getItem("exam_profile") || "null"); }
        catch (e) { return null; }
    },

    // Sapaan di hero ("Halo, Budi • ganti"). ID elemen: whoLine.
    whoLine(elId) {
        const el = document.getElementById(elId);
        if (!el) return;
        const p = ExamDB.profile();
        if (p && p.name) {
            el.style.display = "block";
            el.innerHTML = `Haii, <b>${ExamDB.esc(p.name)}</b>`;
        } else {
            el.style.display = "block";
            el.innerHTML = `Haii, Someone`;
        }
    },

    esc(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;")
            .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },

    cleanHTML(html) {
        try {
            const tpl = document.createElement("template");
            tpl.innerHTML = String(html || "");
            tpl.content.querySelectorAll("script, iframe, object, embed").forEach(n => n.remove());
            tpl.content.querySelectorAll("*").forEach(n => {
                [...n.attributes].forEach(a => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
            });
            return tpl.innerHTML;
        } catch (e) { return String(html || ""); }
    }
};

if (typeof window !== "undefined") window.ExamDB = ExamDB;
