const LKPDAdmin = {
    state: {
        user: getUser(),
        groups: []
    },

    async init() {
        // Cek apakah user admin
        if (!this.state.user || (this.state.user.role !== 'class_admin' && this.state.user.role !== 'super_admin')) {
            window.location.href = "announcements";
            return;
        }

        this.loadGroups();
    },

    async loadGroups() {
        const container = document.getElementById('groupListContainer');
        container.innerHTML = '<p style="text-align:center;">Memuat data...</p>';

        const { data, error } = await supabase
            .from('lkpd_groups')
            .select('*')
            .eq('class_id', this.state.user.class_id)
            .order('chapter_id', { ascending: true });

        if (error) {
            console.error("Gagal load kelompok:", error);
            return;
        }

        this.state.groups = data;
        this.renderGroups();
    },

    renderGroups() {
        const container = document.getElementById('groupListContainer');
        if (this.state.groups.length === 0) {
            container.innerHTML = '<p style="opacity:0.5; text-align:center;">Belum ada kelompok yang diset.</p>';
            return;
        }

        container.innerHTML = this.state.groups.map(g => `
            <div class="course-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span class="final-badge bg-cyan">BAB ${g.chapter_id}</span>
                        <h3 style="margin: 10px 0 5px 0;">${g.group_name}</h3>
                        <p style="font-size: 14px; color: #ddd;">${g.members}</p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button onclick="LKPDAdmin.editGroup('${g.id}')" class="action-btn edit" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="LKPDAdmin.deleteGroup('${g.id}')" class="action-btn cancel" title="Hapus">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    async editGroup(id) {
        const group = this.state.groups.find(g => g.id === id);
        if (group) {
            document.getElementById('inputChapter').value = group.chapter_id;
            document.getElementById('inputGroupName').value = group.group_name;
            document.getElementById('inputMembers').value = group.members;
            // Scroll ke atas biar kelihatan formnya
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    async deleteGroup(id) {
        const yakin = await showPopup("Hapus pembagian kelompok ini?", "confirm");
        if (yakin) {
            const { error } = await supabase.from('lkpd_groups').delete().eq('id', id);
            if (!error) {
                showPopup("Terhapus!", "success");
                this.loadGroups();
            }
        }
    }
};

async function saveGroup() {
    const chapter = document.getElementById('inputChapter').value;
    const name = document.getElementById('inputGroupName').value.trim();
    const members = document.getElementById('inputMembers').value.trim();
    const user = getUser();

    if (!chapter || !name || !members) {
        showPopup("Semua kolom harus diisi!", "error");
        return;
    }

    const { error } = await supabase.from('lkpd_groups').upsert({
        chapter_id: chapter,
        group_name: name,
        members: members,
        class_id: user.class_id
    }, { onConflict: 'chapter_id, class_id' }); // Update kalau Bab & Kelas sudah ada

    if (error) {
        console.error("Save error:", error);
        showPopup("Gagal menyimpan data!", "error");
    } else {
        showPopup("Data kelompok berhasil diset!", "success");
        // Reset Form
        document.getElementById('inputChapter').value = "";
        document.getElementById('inputGroupName').value = "";
        document.getElementById('inputMembers').value = "";
        LKPDAdmin.loadGroups();
    }
}

document.addEventListener('DOMContentLoaded', () => LKPDAdmin.init());