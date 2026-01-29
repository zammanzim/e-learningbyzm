// js/admin-menu-logic.js
let allMenuData = [];
document.addEventListener('DOMContentLoaded', () => {
    setupClassDropdown();
    loadClassMenus();
});

async function setupClassDropdown() {
    const select = document.getElementById('targetClassId');
    const { data } = await supabase.from('subjects_config').select('class_id');
    if (data) {
        const uniqueClasses = [...new Set(data.map(item => item.class_id))].sort((a, b) => a - b);
        uniqueClasses.forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.innerText = `Kelas ID: ${id}`;
            select.appendChild(opt);
        });
    }
}

// js/admin-menu-logic.js

async function loadClassMenus() {
    const classId = document.getElementById('targetClassId').value;
    const container = document.getElementById('menuListContainer');
    container.innerHTML = "<p style='text-align:center; padding: 20px;'>Menyusun data...</p>";

    let query = supabase.from('subjects_config').select('*').order('class_id').order('display_order');
    if (classId !== 'all') query = query.eq('class_id', classId);

    const { data, error } = await query;
    if (error) return alert("Gagal ambil data!");

    container.innerHTML = "";
    if (data.length === 0) {
        container.innerHTML = "<p style='text-align:center; color: #888; padding: 40px;'>Data kosong.</p>";
        return;
    }

    if (classId === 'all') {
        const grouped = data.reduce((acc, item) => {
            if (!acc[item.class_id]) acc[item.class_id] = [];
            acc[item.class_id].push(item);
            return acc;
        }, {});

        for (const [id, menus] of Object.entries(grouped)) {
            const groupHeader = document.createElement('div');
            groupHeader.innerHTML = `<h2 style="color: #ffd700; font-size: 15px; margin: 25px 0 10px 0; border-bottom: 1px solid rgba(255,215,0,0.2); padding-bottom: 5px;">
                <i class="fa-solid fa-users"></i> KELAS ID: ${id}</h2>`;
            container.appendChild(groupHeader);
            menus.forEach(item => container.appendChild(createMenuItemElement(item)));
        }
    } else {
        const main = data.filter(i => i.menu_group === 'main');
        const lesson = data.filter(i => i.menu_group === 'lessons');
        const adminItems = data.filter(i => i.menu_group === 'admin');

        // Fungsi pembantu agar tidak pakai innerHTML +=
        const renderHeader = (text, color) => {
            const h3 = document.createElement('h3');
            h3.style.cssText = `color: ${color}; margin: 20px 0 10px 0; font-size: 13px; opacity:0.8;`;
            h3.innerText = text;
            container.appendChild(h3);
        };

        if (adminItems.length > 0) {
            renderHeader("ADMIN PANEL", "#ff4757");
            adminItems.forEach(i => container.appendChild(createMenuItemElement(i)));
        }
        if (main.length > 0) {
            renderHeader("MAIN MENU", "#ffd700");
            main.forEach(i => container.appendChild(createMenuItemElement(i)));
        }
        if (lesson.length > 0) {
            renderHeader("LESSONS", "#00eaff");
            lesson.forEach(i => container.appendChild(createMenuItemElement(i)));
        }
    }
}

function createMenuItemElement(item) {
    const div = document.createElement('div');
    div.className = "subject-item animate-slide-right";
    div.innerHTML = `
        <div class="subject-info">
            <i class="fa-solid ${item.icon || 'fa-question'}" style="color: #00eaff; width: 25px; text-align: center;"></i>
            <div>
                <h4 style="margin: 0; font-size: 14px;">${item.subject_name}</h4>
                <small style="color: #888;">/${item.subject_id} • Order: ${item.display_order}</small>
            </div>
        </div>
        <div style="display: flex; gap: 5px;">
            <button class="btn-action" id="btnEdit-${item.id}"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="btn-action btn-delete" onclick="deleteMenu(${item.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    div.querySelector(`#btnEdit-${item.id}`).onclick = () => editMenu(item);
    return div;
}

// FORM LOGIC
function autoSlug(val) {
    if (!document.getElementById('editId').value) {
        document.getElementById('mSubjectId').value = val.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    }
}

function previewIcon(val) {
    document.getElementById('iconPreview').innerHTML = `<i class="fa-solid ${val}"></i>`;
}

function editMenu(item) {
    document.getElementById('formTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Materi`;
    document.getElementById('editId').value = item.id;
    document.getElementById('mClassId').value = item.class_id;
    document.getElementById('mSubjectName').value = item.subject_name;
    document.getElementById('mSubjectId').value = item.subject_id;
    document.getElementById('mIcon').value = item.icon;
    document.getElementById('mOrder').value = item.display_order;
    document.getElementById('mGroup').value = item.menu_group;
    document.getElementById('btnReset').style.display = "block";

    previewIcon(item.icon);
    // Auto scroll ke atas (untuk mobile)
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 1. Fungsi Simpan yang Pintar
async function saveMenu() {
    const id = document.getElementById('editId').value;
    const currentFilter = document.getElementById('targetClassId').value; // Catat filter saat ini

    const payload = {
        class_id: document.getElementById('mClassId').value,
        subject_name: document.getElementById('mSubjectName').value,
        subject_id: document.getElementById('mSubjectId').value,
        icon: document.getElementById('mIcon').value,
        display_order: parseInt(document.getElementById('mOrder').value),
        menu_group: document.getElementById('mGroup').value
    };

    if (!payload.class_id || !payload.subject_name) {
        if (window.showPopup) showPopup("Data belum lengkap!", "error");
        return;
    }

    const { error } = id
        ? await supabase.from('subjects_config').update(payload).eq('id', id)
        : await supabase.from('subjects_config').insert([payload]);

    if (error) {
        if (window.showPopup) showPopup("Gagal: " + error.message, "error");
    } else {
        if (window.showPopup) showPopup(id ? "Berhasil diupdate!" : "Berhasil ditambah!", "success");

        // RESET FORM TANPA RESET FILTER
        resetForm();

        // REFRESH LIST (Otomatis pakai filter yang masih nempel di dropdown)
        loadClassMenus();
    }
}

// 2. Fungsi Reset yang Tidak "Lupa Ingatan"
function resetForm() {
    // Kembalikan judul form
    document.getElementById('formTitle').innerHTML = `<i class="fa-solid fa-plus"></i> Tambah Materi`;

    // Reset field input kecuali Class ID (biar gak ngetik ulang)
    document.getElementById('editId').value = "";
    document.getElementById('mSubjectName').value = "";
    document.getElementById('mSubjectId').value = "";
    document.getElementById('mIcon').value = "fa-book";
    document.getElementById('mOrder').value = "1";
    document.getElementById('btnReset').style.display = "none";

    // PENTING: Ambil nilai dari dropdown filter untuk mengisi field Class ID di form
    const filterValue = document.getElementById('targetClassId').value;
    if (filterValue !== 'all') {
        document.getElementById('mClassId').value = filterValue;
    } else {
        document.getElementById('mClassId').value = "";
    }

    previewIcon("fa-book");
}

async function deleteMenu(id) {
    // 1. Cari data materi buat ditampilin namanya di popup
    const item = allMenuData.find(m => String(m.id) === String(id));
    const itemName = item ? item.subject_name : "materi ini";

    // 2. Panggil popup universal dengan mode 'confirm'
    const yakin = await showPopup(`Yakin mau hapus <b>${itemName}</b>?<br>Data ini bakal ilang permanen dari database!`, "confirm");

    // 3. Jika user klik 'Ya' (yakin === true)
    if (yakin) {
        const { error } = await supabase
            .from('subjects_config')
            .delete()
            .eq('id', id);

        if (error) {
            if (window.showPopup) showPopup("Gagal hapus: " + error.message, "error");
        } else {
            if (window.showPopup) showPopup("Materi berhasil dihapus!", "success");

            // 4. Refresh daftar menu setelah berhasil hapus
            loadClassMenus();
        }
    }
}