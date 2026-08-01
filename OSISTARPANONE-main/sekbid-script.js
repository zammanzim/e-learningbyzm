document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("listSekbidContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="ios-settings-group">
            <div class="ios-row" style="cursor: default;">
                <div class="ios-row-left">
                    <div class="ios-row-text">
                        <h4 class="nama-bidang-utama">Memuat data seksi bidang...</h4>
                    </div>
                </div>
            </div>
        </div>`;

    let dataSekbid;
    try {
        dataSekbid = await getSekbid();
    } catch (err) {
        console.error("Gagal memuat sekbid dari Supabase:", err);
        container.innerHTML = `
            <div class="ios-settings-group">
                <div class="ios-row" style="cursor: default;">
                    <div class="ios-row-left">
                        <div class="ios-row-text">
                            <h4 class="nama-bidang-utama">Gagal memuat data</h4>
                        </div>
                    </div>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = "";

    const dataBPH = dataSekbid.filter(item => item.kategori === "BPH");
    const dataHanyaSekbid = dataSekbid.filter(item => item.kategori === "SEKBID");

    function renderGrup(listData, judulGrup) {
        const headingElement = document.createElement("h3");
        headingElement.className = "grup-title-ios";
        headingElement.innerText = judulGrup;
        container.appendChild(headingElement);

        const settingsGroup = document.createElement("div");
        settingsGroup.className = "ios-settings-group";

        listData.forEach(item => {
            const block = document.createElement("div");
            block.style.display = "block";
            block.style.width = "100%";

            block.innerHTML = `
                <button class="ios-row" onclick="toggleSekbid(this)">
                    <div class="ios-row-left">
                        <div class="ios-icon-box">
                            ${item.icon}
                        </div>
                        <div class="ios-row-text">
                            <h4 class="nama-bidang-utama">${item.nama}</h4>
                        </div>
                    </div>
                    <div class="ios-arrow-chevron">
                        <span class="panah-icon">▶</span>
                    </div>
                </button>
                <div class="ios-detail-panel">
                    <div class="ios-detail-inner">
                        <strong style="color: #d90429">📋 TUGAS POKOK & FUNGSI:</strong>
                        <p style="color: #48484a; font-size: 0.82rem; line-height: 1.5; margin-top: 5px;">
                            ${item.deskripsi}
                        </p>
                    </div>
                </div>
            `;
            settingsGroup.appendChild(block);
        });

        container.appendChild(settingsGroup);
    }

    renderGrup(dataBPH, "Badan Pengurus Harian");
    renderGrup(dataHanyaSekbid, "Seksi Bidang");
});

function toggleSekbid(buttonElement) {
    const parentBlock = buttonElement.parentElement;
    const panel = buttonElement.nextElementSibling;
    const isExpanded = parentBlock.classList.contains("expanded");

    const allRows = document.querySelectorAll(".ios-settings-group > div");
    allRows.forEach(item => {
        if (item !== parentBlock) {
            item.classList.remove("expanded");
            const otherPanel = item.querySelector(".ios-detail-panel");
            if (otherPanel) otherPanel.style.maxHeight = null;
        }
    });

    if (isExpanded) {
        parentBlock.classList.remove("expanded");
        panel.style.maxHeight = null;
    } else {
        parentBlock.classList.add("expanded");
        panel.style.maxHeight = panel.scrollHeight + "px";
    }
}
