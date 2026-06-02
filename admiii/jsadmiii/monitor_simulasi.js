// ============================================================
// monitor_simulasi.js — Admin Monitoring Logic
// Displays real-time progress of students in simulations.
// ============================================================

const MonitorSim = {
    state: {
        progressData: [],
        subjects: []
    },

    async init() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || (user.role !== 'class_admin' && user.role !== 'super_admin')) {
            window.location.href = '../login.html';
            return;
        }

        await this.loadSubjects();
        await this.loadData();
        this.setupEventListeners();
    },

    async loadSubjects() {
        try {
            const { data, error } = await supabase
                .from('subjects_config')
                .select('subject_id, subject_name')
                .order('subject_name', { ascending: true });

            if (error) throw error;
            this.state.subjects = data || [];

            const filterSel = document.getElementById('filterSubject');
            let html = '<option value="all">Semua Mapel</option>';
            data.forEach(s => {
                html += `<option value="${s.subject_id}">${s.subject_name}</option>`;
            });
            filterSel.innerHTML = html;
        } catch (err) {
            console.error('Load subjects failed:', err);
        }
    },

    async loadData() {
        try {
            const classFilter = document.getElementById('filterClass').value;
            const subjectFilter = document.getElementById('filterSubject').value;

            // Fetch progress joined with user details (pake full_name karena itu kolom aslinya)
            let query = supabase
                .from('simulation_progress')
                .select(`
                    *,
                    users (full_name, class_id)
                `)
                .order('updated_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            // Manual filtering
            let filtered = data || [];
            if (classFilter !== 'all') {
                filtered = filtered.filter(p => p.users && p.users.class_id == classFilter);
            }
            if (subjectFilter !== 'all') {
                filtered = filtered.filter(p => p.subject_id === subjectFilter);
            }

            this.state.progressData = filtered;
            this.updateStats();
            this.renderTable();
        } catch (err) {
            console.error('Load monitor data failed:', err);
            showPopup('Gagal memuat data monitor.', 'error');
        }
    },

    updateStats() {
        const total = this.state.progressData.length;
        const completed = this.state.progressData.filter(p => p.is_completed).length;
        const ongoing = total - completed;

        document.getElementById('statTotalUsers').innerText = total;
        document.getElementById('statCompleted').innerText = completed;
        document.getElementById('statOngoing').innerText = ongoing;
    },

    renderTable() {
        const tbody = document.getElementById('monitorBody');
        tbody.innerHTML = '';

        if (this.state.progressData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:50px; opacity:0.5;">Belum ada aktivitas simulasi.</td></tr>';
            return;
        }

        this.state.progressData.forEach(p => {
            const subject = this.state.subjects.find(s => s.subject_id === p.subject_id);
            const subjectName = subject ? subject.subject_name : p.subject_id;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700;">${p.users?.full_name || 'Unknown'}</td>
                <td><span class="badge-subject" style="background:rgba(255,255,255,0.05); color:white; border-color:rgba(255,255,255,0.1);">Kelas ${p.users?.class_id == 2 ? 'Master' : '10'}</span></td>
                <td>${subjectName}</td>
                <td>
                    <span class="progress-pill">${p.last_index + 1} / ${p.total_questions}</span>
                </td>
                <td>
                    <span class="status-badge ${p.is_completed ? 'status-completed' : 'status-ongoing'}">
                        ${p.is_completed ? 'SELESAI' : 'ONGOING'}
                    </span>
                </td>
                <td style="font-size:0.8rem; opacity:0.6;">${this.formatRelativeTime(p.updated_at)}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    formatRelativeTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Baru saja';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m lalu`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}j lalu`;
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    },

    setupEventListeners() {
        document.getElementById('filterClass').onchange = () => this.loadData();
        document.getElementById('filterSubject').onchange = () => this.loadData();
    }
};

document.addEventListener('DOMContentLoaded', () => MonitorSim.init());