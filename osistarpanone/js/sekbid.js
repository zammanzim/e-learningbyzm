// =========================================================================
// SEKBID — BPH & seksi bidang dari database (kartu orang, gaya pembina)
// =========================================================================

const Sekbid = {
    terinisialisasi: false,

    async init() {
        if (Sekbid.terinisialisasi) return;
        Sekbid.terinisialisasi = true;
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
        html += Sekbid.renderGrup("Badan Pengurus Harian", listBPH, "BPH");
        html += Sekbid.renderGrup("Seksi Bidang", listSekbid, "SEKBID");
        container.innerHTML = html;
    },

    renderGrup(judul, list, peran) {
        if (!list || list.length === 0) return "";
        let html = `
            <div class="grup-label">
                ${judul} <span class="chip-num">${list.length}</span>
            </div>`;
        list.forEach(item => {
            html += Sekbid.seksi(item, peran);
        });
        return html;
    },

    seksi(item, peran) {
        const nama = escapeHtml(item.nama);
        const icon = item.icon || "📌";
        const foto = item.foto
            ? `<img src="${getFoto(item.foto)}" alt="${nama}" loading="lazy"
                   onerror="this.parentNode.classList.add('tanpa-foto'); this.remove();">`
            : "";
        return `
            <div class="orang-block">
                <div class="orang-photo${item.foto ? "" : " tanpa-foto"}">
                    ${foto}
                    <span class="orang-fallback">${escapeHtml(icon)}</span>
                </div>
                <div class="orang-info">
                    <span class="orang-role">${peran}</span>
                    <h4>${nama}</h4>
                    <p>${escapeHtml(item.deskripsi)}</p>
                </div>
            </div>`;
    }
};

if (typeof Router !== "undefined") {
    Router.register("sekbid", () => Sekbid.init());
} else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Sekbid.init());
} else {
    Sekbid.init();
}
