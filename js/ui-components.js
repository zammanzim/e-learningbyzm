// js/ui-components.js
const UIComponents = {
    inject() {
        // Cek agar tidak inject dua kali
        if (document.getElementById('addModal')) return;

        const body = document.body;
        if (!body) return;

        // 1. HEADER & VISITOR
        const headerHTML = `
        <header>
            <div class="header-left">
                <div class="hamburger" id="hamburger" onclick="toggleMenu()">
                    <span></span><span></span><span></span>
                </div>
                <div id="visitorTrigger" class="visitor-trigger">
                    <i class="fa-solid fa-eye"></i>
                    <span id="headerVisitorCount">0</span>
                </div>
            </div>
            <div class="profile-box" id="profileTrigger">
                <span id="headerName">Hai, ...</span>
                <img id="headerPP" class="header-pp">
                <i class="fa-solid fa-caret-down"></i>
            </div>
            <div class="profile-dropdown" id="profileDropdown">
                <ul>
                    <li onclick="goDashboard()"><i class="fa-solid fa-table-columns"></i> Dashboard</li>
                    <li onclick="goProfile()"><i class="fa-solid fa-user"></i> Edit Profile</li>
                    <li onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</li>
                </ul>
            </div>
        </header>

        <div id="visitorOverlay" class="visitor-overlay">
            <div class="visitor-popup">
                <div class="popup-header">
                    <h3>Visitors</h3>
                    <span id="closeVisitorPopup" class="close-popup">&times;</span>
                </div>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h4><i class="fa-solid fa-eye"></i> Today Visitor</h4>
                        <p id="popupToday">0</p>
                    </div>
                    <div class="stat-card">
                        <h4><i class="fa-solid fa-users"></i> Total Visitor</h4>
                        <p id="popupTotal">0</p>
                    </div>
                </div>
                <div class="list-section">
                    <h4 class="list-title">List of accounts that visited today</h4>
                    <div id="visitorList" class="visitor-list-container"></div>
                </div>
                <div class="admin-actions" style="margin-top: 20px;">
                    <button id="resetVisitorBtn" class="btn-reset-text">
                        <i class="fa-solid fa-rotate-right"></i> Reset Today (Admin)
                    </button>
                </div>
            </div>
        </div>`;

        // 2. MODALS (Add & Detail)
        const modalsHTML = `
        <div id="addModal" class="modal-overlay hidden">
            <div class="glass-modal-box">
                <h3><i class="fa-solid fa-layer-group"></i> Materi Baru</h3>
                <input type="text" id="addJudul" class="glass-input" placeholder="Judul Utama" spellcheck="false">
                <input type="text" id="addSubjudul" class="glass-input" placeholder="Sub-judul" spellcheck="false">
                <div class="editor-toolbar" style="display:flex; gap:10px; margin-bottom: 8px;">
                    <button type="button" onclick="formatText('5')" class="btn-tool">Besar</button>
                    <button type="button" onclick="formatText('3')" class="btn-tool">Sedang</button>
                    <button type="button" onclick="formatText('2')" class="btn-tool">Kecil</button>
                </div>
                <div id="addIsi" contenteditable="true" class="glass-input" style="min-height: 150px; overflow-y: auto;"></div>
                <input type="text" id="addSmall" class="glass-input" placeholder="Footer text" style="font-size: 12px; opacity:0.8;">
<div class="color-picker-container" style="margin-top: 15px;">
    <label style="font-size: 12px; color: #aaa; margin-bottom: 8px; display: block;">Warna Kartu:</label>
    <div id="addColors" class="color-options" style="display: flex; gap: 8px; flex-wrap: wrap;">
    <div class="color-opt active" data-color="default" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; cursor: pointer; background: rgba(0,0,0,0.3);"></div>
    <div class="color-opt" data-color="red" style="width: 22px; height: 22px; border-radius: 50%; background: #ff4757; cursor: pointer;"></div>
    <div class="color-opt" data-color="orange" style="width: 22px; height: 22px; border-radius: 50%; background: #ff9f43; cursor: pointer;"></div>
    <div class="color-opt" data-color="yellow" style="width: 22px; height: 22px; border-radius: 50%; background: #ffd32a; cursor: pointer;"></div>
    <div class="color-opt" data-color="green" style="width: 22px; height: 22px; border-radius: 50%; background: #2ed573; cursor: pointer;"></div>
    <div class="color-opt" data-color="blue" style="width: 22px; height: 22px; border-radius: 50%; background: #00eaff; cursor: pointer;"></div>
    <div class="color-opt" data-color="purple" style="width: 22px; height: 22px; border-radius: 50%; background: #a55eea; cursor: pointer;"></div>
    <div class="color-opt" data-color="pink" style="width: 22px; height: 22px; border-radius: 50%; background: #ff9ff3; cursor: pointer;"></div>
    <div class="color-opt" data-color="brown" style="width: 22px; height: 22px; border-radius: 50%; background: #8b4513; cursor: pointer;"></div>
</div>
</div>
                <div id="dropZone" class="drop-area">
                    <i class="fa-solid fa-cloud-arrow-up drop-icon"></i>
                    <div class="drop-text"><b>Click to upload</b> or drag photos here</div>
                    <input type="file" id="addFiles" multiple accept="image/*" style="display: none;">
                </div>
                <div id="previewContainer" class="preview-container"></div>
                <div class="action-buttons">
                    <button id="btnCancelAdd" class="btn-glass-cancel">Batal</button>
                    <button id="btnSaveAdd" class="btn-glass-save"><i class="fa-solid fa-paper-plane"></i> Posting</button>
                </div>
            </div>
        </div>

        <div id="detailOverlay" class="detail-overlay">
            <div class="glass-detail-box">
                <span class="close-detail-btn" onclick="closeDetail()">&times;</span>
                <div class="detail-media-section">
                    <div class="slider-wrapper">
                        <img id="detailImg" src="">
                        <div id="sliderNavBtns" class="slider-nav-container">
                            <button class="glass-nav-btn prev-btn" onclick="prevSlide(event)"><i class="fa-solid fa-chevron-left"></i></button>
                            <button class="glass-nav-btn next-btn" onclick="nextSlide(event)"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                        <div id="toggleInfoBtn" class="mobile-toggle-btn" onclick="showMobileInfo(event)"><i class="fa-solid fa-circle-info"></i> Lihat Deskripsi</div>
                        <div id="photoCounterTag" class="photo-counter-tag">1 / 1</div>
                    </div>
                </div>
                <div id="detailInfoSection" class="detail-info-section hidden-mobile">
                    <div class="sheet-header-mobile">
                        <button id="sheetToggleBtn" class="sheet-btn-left" onclick="toggleSheetHeight(event)"><i class="fa-solid fa-expand"></i></button>
                        <div class="sheet-drag-indicator" style="width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 10px;"></div>
                        <button class="sheet-btn-right" onclick="toggleMobileInfo(event)"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="info-content-scroll">
                        <h2 id="detailBigTxt"></h2>
                        <h4 id="detailTitleTxt"></h4>
                        <div id="detailContentTxt" class="detail-body-text"></div>
                        <small id="detailSmallTxt" class="detail-footer-text" style="margin-bottom: 50px;"></small>
                    </div>
                </div>
            </div>
        </div>`;

        body.insertAdjacentHTML('afterbegin', headerHTML);
        body.insertAdjacentHTML('beforeend', modalsHTML);
    }
};

const SkeletonUI = {
    render(containerId, count = 3) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
            <div class="sk-card">
                <div class="skeleton sk-title"></div>
                <div class="skeleton sk-text"></div>
                <div class="skeleton sk-text" style="width: 80%;"></div>
            </div>`;
        }
        container.innerHTML = html;
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIComponents.inject());
} else {
    UIComponents.inject();
}