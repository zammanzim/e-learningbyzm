// js/lkpd-manager.js
const LKPDManager = {
    state: {
        chapterId: new URLSearchParams(window.location.search).get('id'),
        user: getUser(),
        canEdit: false,
        groupData: null
    },

    async init() {
        if (!this.state.chapterId || !this.state.user) return;
        
        // 1. Ambil data Kelompok yang ditugaskan buat Bab ini
        await this.checkAccess();
        
        // 2. Load Soal pake SubjectApp (Materi dikasih prefix misal: lkpd1, lkpd2)
        const subjectKey = `lkpd${this.state.chapterId}`;
        SubjectApp.init(subjectKey, `BAB ${this.state.chapterId}`, `LKPD Bab ${this.state.chapterId}`, false);
        
        // 3. Inject Form Jawaban ke tiap kartu soal
        this.setupAnswerObserver();
    },

    async checkAccess() {
        const { data, error } = await supabase
            .from('lkpd_groups')
            .select('*')
            .eq('chapter_id', this.state.chapterId)
            .eq('class_id', this.state.user.class_id)
            .single();

        if (data) {
            this.state.groupData = data;
            document.getElementById('assignedGroupName').innerText = data.group_name;
            
            // Render Member Piller
            const members = data.members.split(';').map(m => m.trim());
            const listEl = document.getElementById('memberList');
            listEl.innerHTML = members.map(m => `<div class="picket-pill"><span>${m}</span></div>`).join('');

            // Cek apakah user login ada di daftar anggota
            const myName = this.state.user.nickname || this.state.user.full_name;
            this.state.canEdit = members.some(m => myName.toLowerCase().includes(m.toLowerCase()));

            const statusEl = document.getElementById('accessStatus');
            if (this.state.canEdit) {
                statusEl.innerHTML = `<b style="color:#00eaff"><i class="fa-solid fa-pen-nib"></i> Kamu anggota kelompok ini. Silahkan isi jawaban!</b>`;
            } else {
                statusEl.innerHTML = `<i class="fa-solid fa-lock"></i> Kamu bukan anggota kelompok ini. Mode baca aktif.`;
            }
        }
    },

    setupAnswerObserver() {
        // Tunggu SubjectApp beres ngerender kartu (pake Interval simpel)
        const checkExist = setInterval(() => {
            const cards = document.querySelectorAll('.course-card');
            if (cards.length > 0) {
                clearInterval(checkExist);
                this.renderAnswerFields(cards);
                this.loadExistingAnswers();
            }
        }, 500);
    },

    renderAnswerFields(cards) {
        cards.forEach(card => {
            const id = card.dataset.id;
            const inputHTML = `
                <div class="lkpd-answer-container" style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1);">
                    <label style="font-size: 12px; color: #00eaff; font-weight: bold; display: block; margin-bottom: 8px;">
                        <i class="fa-solid fa-reply"></i> JAWABAN KELOMPOK:
                    </label>
                    <div id="ans-${id}" 
                         class="glass-input lkpd-input-area" 
                         contenteditable="${this.state.canEdit}" 
                         data-placeholder="Ketik jawaban kelompok di sini..."
                         style="min-height: 80px; ${!this.state.canEdit ? 'opacity: 0.7; cursor: not-allowed;' : ''}"></div>
                    ${this.state.canEdit ? `<button onclick="LKPDManager.saveAnswer('${id}')" class="btn-glass-save" style="margin-top: 10px; padding: 8px 15px; font-size: 12px;">Simpan Jawaban</button>` : ''}
                </div>
            `;
            // Masukin form jawaban sebelum footer/small di kartu
            const small = card.querySelector('small');
            if (small) small.insertAdjacentHTML('beforebegin', inputHTML);
            else card.innerHTML += inputHTML;
        });
    },

    async saveAnswer(announcementId) {
        const text = document.getElementById(`ans-${announcementId}`).innerText;
        const btn = event.target;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

        const { error } = await supabase.from('lkpd_answers').upsert({
            announcement_id: announcementId,
            chapter_id: this.state.chapterId,
            class_id: this.state.user.class_id,
            answer_text: text,
            last_edited_by: this.state.user.nickname
        }, { onConflict: 'announcement_id' });

        if (!error) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Tersimpan!';
            btn.style.background = '#2ed573';
            setTimeout(() => { 
                btn.innerHTML = 'Simpan Jawaban';
                btn.style.background = '#00eaff';
            }, 2000);
        }
    },

    async loadExistingAnswers() {
        const { data } = await supabase
            .from('lkpd_answers')
            .select('*')
            .eq('chapter_id', this.state.chapterId)
            .eq('class_id', this.state.user.class_id);

        if (data) {
            data.forEach(ans => {
                const el = document.getElementById(`ans-${ans.announcement_id}`);
                if (el) el.innerText = ans.answer_text;
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => LKPDManager.init());