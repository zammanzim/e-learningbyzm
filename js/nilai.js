// ============================================================
// NILAI — port halaman scores lama ke tema exam.
// Sumber: nilai_scores (+users lama), nilai_config, nilai_files.
// ?id=asts|psts|psasi|psat (default asts). Identitas: profil exam.
// Admin (PIN): sembunyiin mapel + upload file (R2 folder nilai/).
// ============================================================

const NilaiPage = {
    TESTS: {
        asts: "Nilai ASTS",
        psts: "Nilai PSTS",
        psasi: "Nilai PSAS",
        psat: "Nilai PSAT"
    },
    MAPEL: {
        pabp: "PABP", pp: "PP", bindo: "B. Indonesia", bing: "B. Inggris",
        mtk: "Matematika", sejarah: "Sejarah", bjepang: "B. Jepang",
        bsunda: "B. Sunda", senibudaya: "Seni Budaya", informatika: "Informatika",
        pjok: "PJOK", proipas: "Proipas", dasprog1: "DASPRO 1",
        dasprog2: "DASPRO 2", dasprog3: "DASPRO 3"
    },
    KKM: 75,
    TTL: 5 * 60 * 1000,

    testId: "asts",
    classId: null,
    classes: [],
    rows: [],       // nilai_scores + average
    myRow: null,
    myUserId: null,
    hidden: [],
    nickMap: {},    // nama lower -> nickname tampil

    async boot() {
        const p = new URLSearchParams(location.search).get("id") || "asts";
        if (NilaiPage.TESTS[p]) NilaiPage.testId = p;
        document.title = `${NilaiPage.TESTS[NilaiPage.testId]} • Ujian`;
        ExamDB.topUser();

        // Chips jenis ujian.
        document.getElementById("testChips").innerHTML = Object.keys(NilaiPage.TESTS).map(t =>
            `<a class="chip${t === NilaiPage.testId ? " on" : ""}" href="nilai?id=${t}">${NilaiPage.TESTS[t]}</a>`
        ).join("");

        try {
            const { data } = await supa.from("classes").select("id, name")
                .eq("is_active", true).order("id");
            NilaiPage.classes = data || [];
        } catch (e) { /* abaikan */ }

        // Default kelas: dari profil exam (xrplN -> id lama N).
        let defId = null;
        try {
            const prof = ExamDB.profile();
            const m = prof && prof.slug && prof.slug.match(/(\d+)$/);
            if (m && NilaiPage.classes.some(c => String(c.id) === m[1])) defId = m[1];
        } catch (e) { /* abaikan */ }
        if (!defId && NilaiPage.classes.length) defId = String(NilaiPage.classes[0].id);
        NilaiPage.classId = defId;

        const sel = document.getElementById("kelasPick");
        sel.innerHTML = NilaiPage.classes.map(c =>
            `<option value="${c.id}">${ExamDB.esc(c.name)}</option>`).join("");
        if (defId) sel.value = defId;
        sel.addEventListener("change", () => {
            NilaiPage.classId = sel.value;
            NilaiPage.load(true);
        });

        document.getElementById("mapelSel").addEventListener("change", () => NilaiPage.renderTable());
        document.getElementById("sortSel").addEventListener("change", () => NilaiPage.renderTable());
        document.getElementById("stuClose").addEventListener("click", () => {
            const m = document.getElementById("stuModal");
            m.classList.remove("open");
        });
        document.getElementById("stuModal").addEventListener("click", e => {
            if (e.target.id === "stuModal") e.target.classList.remove("open");
        });

        if (typeof Track !== "undefined") Track.page("nilai");
        if (typeof ExamViewer !== "undefined") ExamViewer.bind();
        await NilaiPage.load(true);
        NilaiPage.setupAdmin();
    },

    color(v) {
        if (isNaN(v)) return "var(--ink)";
        if (v >= 85) return "#198754";
        if (v >= NilaiPage.KKM) return "#8a6d00";
        if (v >= 60) return "#b57e0a";
        return "#dc3545";
    },

    cacheKey() {
        return `nilai_cache_${NilaiPage.testId}_${NilaiPage.classId}`;
    },

    async load(fresh) {
        const ck = NilaiPage.cacheKey();
        try {
            const raw = localStorage.getItem(ck);
            if (raw) {
                const c = JSON.parse(raw);
                if (c.ts && Date.now() - c.ts < NilaiPage.TTL) {
                    NilaiPage.applyData(c);
                    NilaiPage.fetchFresh(ck).catch(() => {});
                    return;
                }
            }
        } catch (e) { /* abaikan */ }
        await NilaiPage.fetchFresh(ck, true);
    },

    async fetchFresh(ck, render) {
        try {
            const [nRes, uRes, cRes] = await Promise.all([
                supa.from("nilai_scores").select("*").eq("class_id", NilaiPage.classId).eq("scores_type", NilaiPage.testId),
                supa.from("users").select("id, full_name, nickname").eq("class_id", NilaiPage.classId),
                supa.from("nilai_config").select("hidden_subjects")
                    .eq("test_id", NilaiPage.testId).eq("class_id", NilaiPage.classId).maybeSingle()
            ]);
            if (nRes.error) throw nRes.error;
            const hidden = (cRes.data && cRes.data.hidden_subjects) || [];
            const nick = {};
            (uRes.data || []).forEach(u => {
                if (u.full_name) nick[u.full_name.toLowerCase()] = u.nickname || u.full_name;
                if (u.nickname) nick[u.nickname.toLowerCase()] = u.nickname;
                if (u.id != null) nick["id:" + u.id] = u.nickname || u.full_name;
            });
            const avg = s => {
                let t = 0, c = 0;
                for (const k in NilaiPage.MAPEL) {
                    if (hidden.includes(k)) continue;
                    const v = parseFloat(s[k]);
                    if (!isNaN(v)) { t += v; c++; }
                }
                return c ? parseFloat((t / c).toFixed(2)) : 0;
            };
            const rows = (nRes.data || []).map(s => ({ ...s, average: avg(s) }))
                .sort((a, b) => b.average - a.average || String(a.nama_siswa || "").localeCompare(String(b.nama_siswa || "")));

            // Identitas: profil exam → users lama → user_id; fallback nama_siswa.
            let myUserId = null, myRow = null;
            try {
                const prof = ExamDB.profile();
                const nm = ((prof && prof.name) || "").toLowerCase();
                if (nm) {
                    const u = (uRes.data || []).find(x =>
                        (x.nickname && x.nickname.toLowerCase() === nm) ||
                        (x.full_name && x.full_name.toLowerCase() === nm));
                    if (u) myUserId = u.id;
                    myRow = rows.find(r => (myUserId != null && String(r.user_id) === String(myUserId)))
                        || rows.find(r => (r.nama_siswa || "").toLowerCase() === nm)
                        || rows.find(r => myUserId != null && (nick["id:" + myUserId] || "").toLowerCase() === (r.nama_siswa || "").toLowerCase())
                        || null;
                }
            } catch (e) { /* abaikan */ }

            const data = { ts: Date.now(), rows, myRow, myUserId, hidden, nick };
            try { localStorage.setItem(ck, JSON.stringify(data)); } catch (e) { /* abaikan */ }
            NilaiPage.applyData(data);
            NilaiPage.loadFiles();
        } catch (e) {
            if (render) {
                document.getElementById("myName").textContent = "Gagal ambil data";
                document.getElementById("myMsg").textContent = e.message || e;
            }
        }
    },

    applyData(c) {
        NilaiPage.rows = c.rows || [];
        NilaiPage.myRow = c.myRow || null;
        NilaiPage.myUserId = c.myUserId || null;
        NilaiPage.hidden = c.hidden || [];
        NilaiPage.nickMap = c.nick || {};
        NilaiPage.renderMapel();
        NilaiPage.renderMine();
        NilaiPage.renderAvg();
        NilaiPage.renderPodium();
        NilaiPage.renderTable();
    },

    disp(nama) {
        if (!nama) return "-";
        return NilaiPage.nickMap[nama.toLowerCase()] || nama;
    },

    visibleKeys() {
        return Object.keys(NilaiPage.MAPEL).filter(k => !NilaiPage.hidden.includes(k));
    },

    renderMapel() {
        const sel = document.getElementById("mapelSel");
        const prev = sel.value;
        sel.innerHTML = NilaiPage.visibleKeys()
            .map(k => `<option value="${k}">${NilaiPage.MAPEL[k]}</option>`).join("");
        if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
    },

    renderMine() {
        const r = NilaiPage.myRow;
        if (!r) {
            document.getElementById("myName").textContent = "Belum ada data";
            document.getElementById("myAvg").textContent = "-";
            document.getElementById("myRank").textContent = "-";
            document.getElementById("myMsg").textContent = "Namamu ga ketemu di data kelas ini. Cek nama di index sama kayak di bawah.";
            document.getElementById("myTable").innerHTML = "";
            document.getElementById("privWrap").style.display = "none";
            return;
        }
        const prof = ExamDB.profile() || {};
        document.getElementById("myAva").textContent = NilaiPage.disp(r.nama_siswa).charAt(0).toUpperCase() || "🙂";
        document.getElementById("myName").textContent = prof.name || NilaiPage.disp(r.nama_siswa);
        document.getElementById("myAvg").textContent = r.average.toFixed(2);
        document.getElementById("myAvg").style.color = NilaiPage.color(r.average);
        const rank = NilaiPage.rows.indexOf(r) + 1;
        document.getElementById("myRank").textContent = "#" + rank;
        const msg = r.average >= 85 ? "dingin di puncak 🥶"
            : r.average >= 75 ? "pass KKM, aman"
            : r.average >= 60 ? "dikit lagi KKM" : "gapapa, gas lagi";
        document.getElementById("myMsg").textContent = msg;

        document.getElementById("myTable").innerHTML =
            `<div class="mon-table-wrap"><table class="mon-table"><thead><tr>` +
            `<th>Mapel</th><th style="text-align:center;">Nilai</th><th style="text-align:center;">KKM</th>` +
            `</tr></thead><tbody>` +
            NilaiPage.visibleKeys().map(k => {
                const v = parseFloat(r[k]);
                const ok = !isNaN(v);
                const c = ok ? NilaiPage.color(v) : "var(--muted)";
                return `<tr><td style="font-weight:700;">${NilaiPage.MAPEL[k]}</td>` +
                    `<td style="text-align:center;"><span class="progress-pill" style="color:${c};">${ok ? v.toFixed(1) : "-"}</span></td>` +
                    `<td style="text-align:center;">${ok ? (v >= NilaiPage.KKM ? "✅" : "❌") : "-"}</td></tr>`;
            }).join("") + `</tbody></table></div>`;

        const tw = document.getElementById("privWrap");
        if (NilaiPage.myUserId != null) {
            tw.style.display = "block";
            const tgl = document.getElementById("privToggle");
            tgl.checked = !!r.is_private;
            tgl.onchange = async () => {
                try {
                    const { error } = await supa.from("nilai_scores").update({ is_private: tgl.checked })
                        .eq("user_id", NilaiPage.myUserId).eq("scores_type", NilaiPage.testId);
                    if (error) throw error;
                    try { localStorage.removeItem(NilaiPage.cacheKey()); } catch (e) {}
                    NilaiPage.load(true);
                } catch (e) { tgl.checked = !tgl.checked; }
            };
        } else tw.style.display = "none";
    },

    renderAvg() {
        const card = document.getElementById("avgCard");
        if (!NilaiPage.rows.length) { card.style.display = "none"; return; }
        card.style.display = "block";
        const keys = NilaiPage.visibleKeys();
        let sum = 0, n = 0;
        const per = keys.map(k => {
            let s = 0, c = 0, top = -Infinity;
            NilaiPage.rows.forEach(r => {
                const v = parseFloat(r[k]);
                if (!isNaN(v)) { s += v; c++; if (v > top) top = v; }
            });
            sum += s; n += c;
            return { k, avg: c ? s / c : 0 };
        });
        const overall = n ? sum / n : 0;
        const lulus = NilaiPage.rows.filter(r => r.average >= NilaiPage.KKM).length;
        document.getElementById("avgOverall").textContent = overall.toFixed(1);
        document.getElementById("avgTop").textContent = Math.max(...NilaiPage.rows.map(r => r.average)).toFixed(1);
        document.getElementById("avgPass").textContent = `${lulus}/${NilaiPage.rows.length}`;
        document.getElementById("avgList").innerHTML = per.map(t =>
            `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid var(--line);">` +
            `<span style="color:var(--muted);">${NilaiPage.MAPEL[t.k]}</span>` +
            `<b style="color:${NilaiPage.color(t.avg)};">${t.avg.toFixed(1)}</b></div>`
        ).join("");
    },

    renderPodium() {
        const t3 = document.getElementById("podiumTop3");
        const rs = document.getElementById("podiumRest");
        if (!NilaiPage.rows.length) {
            t3.innerHTML = "";
            rs.innerHTML = `<div class="pub-empty">Belum ada data leaderboard.</div>`;
            return;
        }
        const medal = ["🥇", "🥈", "🥉"];
        const top = NilaiPage.rows.slice(0, 3);
        t3.innerHTML = `<div class="podium-grid">` + [1, 0, 2].map(i => {
            const s = top[i];
            if (!s) return `<div></div>`;
            return `<button type="button" class="podium-box p${i + 1}" data-uid="${ExamDB.esc(String(s.user_id ?? ""))}" data-nama="${ExamDB.esc(s.nama_siswa || "")}">` +
                `<div class="pod-medal">${medal[i]}</div>` +
                `<div class="pod-name">${ExamDB.esc(NilaiPage.disp(s.nama_siswa))}${s.is_private ? " 🔒" : ""}</div>` +
                `<div class="pod-score">${s.average.toFixed(1)}</div></button>`;
        }).join("") + `</div>`;
        rs.innerHTML = NilaiPage.rows.slice(3, 15).map((s, j) =>
            `<button type="button" class="leader-item" data-uid="${ExamDB.esc(String(s.user_id ?? ""))}" data-nama="${ExamDB.esc(s.nama_siswa || "")}">` +
            `<span class="leader-rank">${j + 4}</span>` +
            `<span class="leader-name">${ExamDB.esc(NilaiPage.disp(s.nama_siswa))}${s.is_private ? " 🔒" : ""}</span>` +
            `<b style="color:${NilaiPage.color(s.average)};">${s.average.toFixed(1)}</b></button>`
        ).join("");
        document.querySelectorAll("[data-uid]").forEach(b =>
            b.addEventListener("click", () => NilaiPage.showStudent(b.dataset.uid, b.dataset.nama)));
    },

    showStudent(uid, nama) {
        const s = NilaiPage.rows.find(x => String(x.user_id ?? "") === String(uid || "§"))
            || NilaiPage.rows.find(x => (x.nama_siswa || "") === (nama || ""));
        if (!s) return;
        document.getElementById("stuName").textContent = NilaiPage.disp(s.nama_siswa);
        document.getElementById("stuAvg").textContent = "Rata-rata " + s.average.toFixed(2);
        document.getElementById("stuTable").innerHTML =
            NilaiPage.visibleKeys().map(k => {
                const v = parseFloat(s[k]);
                return `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid var(--line); font-size:.88rem;">` +
                    `<span>${NilaiPage.MAPEL[k]}</span><b>${isNaN(v) ? "-" : v.toFixed(1)}</b></div>`;
            }).join("");
        document.getElementById("stuModal").classList.add("open");
    },

    renderTable() {
        const k = document.getElementById("mapelSel").value;
        const sort = document.getElementById("sortSel").value;
        const tb = document.getElementById("classBody");
        if (!k || !NilaiPage.rows.length) {
            tb.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px; opacity:.5;">Belum ada data.</td></tr>`;
            return;
        }
        const sorted = [...NilaiPage.rows].sort((a, b) =>
            sort === "nama"
                ? String(a.nama_siswa || "").localeCompare(String(b.nama_siswa || ""))
                : (parseFloat(b[k]) || -1) - (parseFloat(a[k]) || -1));
        tb.innerHTML = sorted.map((s, i) => {
            const v = parseFloat(s[k]);
            const mine = NilaiPage.myUserId != null && String(s.user_id) === String(NilaiPage.myUserId);
            return `<tr${mine ? ' class="me"' : ""} data-uid="${ExamDB.esc(String(s.user_id ?? ""))}" data-nama="${ExamDB.esc(s.nama_siswa || "")}" style="cursor:pointer;">` +
                `<td style="opacity:.5; font-weight:800;">${i + 1}</td>` +
                `<td style="font-weight:700;">${ExamDB.esc(NilaiPage.disp(s.nama_siswa))}${s.is_private ? " 🔒" : ""}</td>` +
                `<td style="text-align:right;"><b style="color:${NilaiPage.color(v)};">${isNaN(v) ? "-" : v.toFixed(1)}</b></td></tr>`;
        }).join("");
        tb.querySelectorAll("tr[data-uid]").forEach(tr =>
            tr.addEventListener("click", () => NilaiPage.showStudent(tr.dataset.uid, tr.dataset.nama)));
    },

    async loadFiles() {
        const box = document.getElementById("filesList");
        try {
            const { data, error } = await supa.from("nilai_files").select("*")
                .eq("test_id", NilaiPage.testId).eq("class_id", NilaiPage.classId)
                .order("display_order").order("id");
            if (error) throw error;
            box.innerHTML = (data || []).length ? (data || []).map(f => {
                const full = ExamMedia.url(f.file_url || "");
                const isPdf = /\.pdf($|\?)/i.test(full);
                const main = isPdf
                    ? `<button type="button" class="pub-file" data-pdf="${ExamDB.esc(full)}">` +
                      `<i class="fa-solid fa-file-pdf"></i><span>${ExamDB.esc(f.label || f.file_name || "File")}</span>` +
                      `<i class="fa-solid fa-expand pub-open"></i></button>`
                    : `<a class="pub-file" href="${ExamDB.esc(full)}" target="_blank" rel="noopener">` +
                      `<i class="fa-solid fa-file-arrow-down"></i><span>${ExamDB.esc(f.label || f.file_name || "File")}</span>` +
                      `<i class="fa-solid fa-arrow-up-right-from-square pub-open"></i></a>`;
                const del = NilaiPage.isAdmin()
                    ? `<button type="button" class="x" data-delfile="${f.id}" title="Hapus" style="flex-shrink:0;">🗑</button>` : "";
                return `<div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;"><div style="flex:1; min-width:0;">${main}</div>${del}</div>`;
            }).join("") : `<p style="color:var(--muted); font-size:.85rem;">Belum ada file.</p>`;
            box.querySelectorAll("[data-pdf]").forEach(b =>
                b.addEventListener("click", () => ExamViewer.open([b.dataset.pdf], 0)));
        } catch (e) {
            box.innerHTML = `<p style="color:var(--muted); font-size:.85rem;">Gagal ambil file.</p>`;
        }
    },

    // ---- Admin (PIN exam_admin) ----
    isAdmin() {
        try { return sessionStorage.getItem("exam_admin") === "1"; }
        catch (e) { return false; }
    },

    setupAdmin() {
        if (!NilaiPage.isAdmin()) return;
        document.getElementById("fileAdm").style.display = "block";
        const cfg = document.getElementById("cfgAdm");
        cfg.style.display = "block";
        document.getElementById("hideGrid").innerHTML = Object.keys(NilaiPage.MAPEL).map(k =>
            `<label class="check-pill"><input type="checkbox" value="${k}"${NilaiPage.hidden.includes(k) ? " checked" : ""}> ${NilaiPage.MAPEL[k]}</label>`
        ).join("");
        document.getElementById("hideSave").addEventListener("click", async () => {
            const hidden = [...document.querySelectorAll("#hideGrid input:checked")].map(x => x.value);
            try {
                const { error } = await supa.from("nilai_config").upsert(
                    { test_id: NilaiPage.testId, class_id: NilaiPage.classId, hidden_subjects: hidden },
                    { onConflict: "test_id,class_id" });
                if (error) throw error;
                try { localStorage.removeItem(NilaiPage.cacheKey()); } catch (e) {}
                NilaiPage.load(true);
            } catch (e) { /* abaikan */ }
        });
        document.getElementById("fileBtn").addEventListener("click", async () => {
            const input = document.getElementById("fileUp");
            if (!input.files.length) return;
            const f = input.files[0];
            const label = document.getElementById("fileLabel").value.trim() || f.name;
            try {
                const key = "nilai/" + NilaiPage.testId + "-" + Date.now() + "-" +
                    f.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
                let up = f;
                if (f.type.startsWith("image/")) {
                    try { up = await ExamMedia.compressImage(f); } catch (e) { /* asli */ }
                }
                const pres = await ExamMedia.mintaPresign(key, up.type || "application/octet-stream");
                const r = await fetch(pres.url, { method: "PUT", headers: { "Content-Type": up.type }, body: up });
                if (!r.ok) throw new Error("Upload R2 gagal (" + r.status + ")");
                const { error } = await supa.from("nilai_files").insert({
                    test_id: NilaiPage.testId, class_id: NilaiPage.classId,
                    file_name: f.name, file_url: key,
                    label
                });
                if (error) throw error;
                input.value = "";
                document.getElementById("fileLabel").value = "";
                NilaiPage.loadFiles();
            } catch (e) { /* abaikan */ }
        });
        document.getElementById("filesList").addEventListener("click", async e => {
            const x = e.target.closest("[data-delfile]");
            if (!x || !confirm("Hapus file ini?")) return;
            try {
                const { data } = await supa.from("nilai_files").select("file_url").eq("id", x.dataset.delfile).single();
                const url = (data && data.file_url) || "";
                // Hapus fisik cuma buat file R2 (domain sendiri / path relatif).
                // URL Supabase lama → skip (biarin yatim).
                let key = null;
                const r2m = url.match(/media\.e-learniz\.my\.id\/(.+?)(\?.*)?$/);
                if (r2m) key = r2m[1];
                else if (url && !/^https?:/i.test(url)) key = url.replace(/^\/+/, "");
                if (key) {
                    try { await ExamMedia.r2Delete(key); } catch (err) { /* lanjut hapus baris */ }
                }
                await supa.from("nilai_files").delete().eq("id", x.dataset.delfile);
                NilaiPage.loadFiles();
            } catch (err) { /* abaikan */ }
        });
    }
};

document.addEventListener("DOMContentLoaded", () => NilaiPage.boot());
