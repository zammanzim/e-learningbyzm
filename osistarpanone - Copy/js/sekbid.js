// =========================================================================
// SEKBID — list BPH & seksi bidang dari database
// =========================================================================

const Sekbid = {
    async init() {
        const container = document.getElementById("sekbidList");
        if (!container) return;

        let data;
        try {
            data = await getSekbid();
        } catch (err) {
            console.error(err);
            container.innerHTML = `<div class="loading-block">Gagal memuat data. Cek koneksi.</div>`;
            return;
        }

        const jum = document.getElementById("jumSekbid");
        if (jum && data) jum.textContent = data.length;

        const listBPH = (data || []).filter(s => s.kategori === "BPH");
        const listSekbid = (data || []).filter(s => s.kategori !== "BPH");

        let html = "";
        html += Sekbid.renderGrup("Badan Pengurus Harian", listBPH, true);
        html += Sekbid.renderGrup("Seksi Bidang", listSekbid, false);
        container.innerHTML = html;
    },

    renderGrup(judul, list, kategoriBph) {
        if (!list || list.length === 0) return "";
        let html = `
            <div class="grup-label">
                ${judul} <span class="chip-num">${list.length}</span>
            </div>
            <div class="ios-list">`;
        list.forEach(item => {
            html += `
                <div class="sekbid-row ${kategoriBph ? "kategori-bph" : ""}">
                    <button class="sekbid-btn" onclick="Sekbid.toggle(this)">
                        <span class="sekbid-icon">${item.icon || "📌"}</span>
                        <span class="sekbid-name">${escapeHtml(item.nama)}</span>
                        <span class="sekbid-arrow">▶</span>
                    </button>
                    <div class="sekbid-detail">
                        <div class="inner">
                            <strong>📋 TUGAS POKOK & FUNGSI</strong>
                            <p>${escapeHtml(item.deskripsi)}</p>
                        </div>
                    </div>
                </div>`;
        });
        html += `</div>`;
        return html;
    },

    toggle(btn) {
        const row = btn.closest(".sekbid-row");
        const panel = row.querySelector(".sekbid-detail");
        const isOpen = row.classList.contains("expanded");

        document.querySelectorAll(".sekbid-row.expanded").forEach(r => {
            r.classList.remove("expanded");
            r.querySelector(".sekbid-detail").style.maxHeight = null;
        });

        if (!isOpen) {
            row.classList.add("expanded");
            panel.style.maxHeight = panel.scrollHeight + "px";
        }
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Sekbid.init());
} else {
    Sekbid.init();
}
