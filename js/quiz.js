// ============================================================
// quiz.js — Simulasi Ujian Logic
// Handles fetching questions, checking answers, and navigation.
// ============================================================

const QuizApp = {
    state: {
        subjectId: null,
        questions: [],
        currentIndex: 0,
        answeredCorrectly: false,
        user: null,
        history: {} // Map: questionIndex -> Array of selected option indices
    },

    resetState() {
        this.state.subjectId = null;
        this.state.questions = [];
        this.state.currentIndex = 0;
        this.state.answeredCorrectly = false;
        this.state.history = {};

        // Reset UI Elements
        const elements = ['backBtn', 'selectionView', 'infoView', 'quizView', 'resultView'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    },


    async init() {
        this.resetState();
        
        const urlParams = new URLSearchParams(window.location.search);
        this.state.subjectId = urlParams.get('id');
        this.state.user = JSON.parse(localStorage.getItem('user'));

        if (!this.state.user) {
            window.location.href = '../login.html';
            return;
        }

        if (!this.state.subjectId) {
            await this.loadQuizMenu();
        } else {
            document.getElementById('selectionView').style.display = 'none';
            this.updateSubjectSubtitle();
            await this.loadQuestions();
        }
        
        this.setupEventListeners();
    },

    async handleBack() {
        window.location.href = 'quiz.html';
    },

    async loadQuizMenu() {
        try {
            const hTitle = document.getElementById('headerTitle');
            const hSubtitle = document.getElementById('subjectSubtitle');
            if (hTitle) hTitle.innerHTML = '<i class="fa-solid fa-graduation-cap"></i> Simulasi Ujian';
            
            const classId = getEffectiveClassId() || this.state.user.class_id;
            const { data, error } = await supabase.from('simulation_questions').select('subject_id').or(`class_id.eq.${classId},class_id.eq.0`);
            if (error) throw error;

            // Hitung jumlah soal per mapel
            const counts = data.reduce((acc, item) => {
                acc[item.subject_id] = (acc[item.subject_id] || 0) + 1;
                return acc;
            }, {});

            const uniqueSubjects = Object.keys(counts);
            
            if (uniqueSubjects.length === 0) {
                this.showEmptyState();
                return;
            }

            const { data: configData } = await supabase.from('subjects_config').select('subject_id, subject_name, icon').in('subject_id', uniqueSubjects);
            const container = document.getElementById('quizMenuGrid');
            if (container) {
                container.innerHTML = '';
                document.getElementById('selectionView').style.display = 'block';
                uniqueSubjects.forEach(id => {
                    const config = (configData || []).find(c => c.subject_id === id);
                    const name = config ? config.subject_name : (typeof t === 'function' ? t(id) : id);
                    const icon = config ? config.icon : 'fa-book';
                    const qCount = counts[id] || 0;
                    
                    const card = document.createElement('div');
                    card.className = 'quiz-menu-card';
                    card.innerHTML = `<i class="fa-solid ${icon}"></i><h4>${name}</h4><span style="font-size: 16px">${qCount} Soal</span>`;
                    card.onclick = () => window.location.href = `quiz.html?id=${id}`;
                    container.appendChild(card);
                });
            }
        } catch (err) {
            console.error('Gagal muat menu simulasi:', err);
        }
    },

    updateSubjectSubtitle() {
        const subtitle = document.getElementById('subjectSubtitle');
        if (!subtitle) return;
        const name = (typeof t === 'function') ? t(this.state.subjectId) : this.state.subjectId;
        subtitle.innerText = `Mata Pelajaran: ${name}`;
    },

    async loadQuestions() {
        try {
            const classId = getEffectiveClassId() || this.state.user.class_id;
            
            // 1. Ambil Soal
            const { data: questions, error: qErr } = await supabase
                .from('simulation_questions')
                .select('*')
                .eq('subject_id', this.state.subjectId)
                .or(`class_id.eq.${classId},class_id.eq.0`)
                .order('id', { ascending: true });

            if (qErr) throw qErr;
            if (!questions || questions.length === 0) {
                this.showEmptyState();
                return;
            }
            this.state.questions = questions;

            // 2. Cek Progress Terakhir buat Resume
            const { data: progress } = await supabase
                .from('simulation_progress')
                .select('last_index, is_completed')
                .eq('user_id', this.state.user.id)
                .eq('subject_id', this.state.subjectId)
                .maybeSingle();

            if (progress && !progress.is_completed) {
                // Set index ke progres terakhir
                this.state.currentIndex = Math.min(progress.last_index, questions.length - 1);
                
                // Isi history otomatis buat soal-soal sebelumnya biar bisa di-review
                for(let i=0; i < this.state.currentIndex; i++) {
                    this.state.history[i] = [questions[i].answer];
                }
            }

            this.showInfoView();
        } catch (err) {
            console.error('Gagal ambil soal:', err);
        }
    },

    showInfoView() {
        const infoV = document.getElementById('infoView');
        const backB = document.getElementById('backBtn');
        if (infoV) infoV.style.display = 'block';
        if (backB) backB.style.display = 'flex';
        
        const name = (typeof t === 'function') ? t(this.state.subjectId) : this.state.subjectId;
        const infoSub = document.getElementById('infoSubject');
        const infoCount = document.getElementById('infoCount');
        if (infoSub) infoSub.innerText = name;
        if (infoCount) infoCount.innerText = this.state.questions.length;
    },

    startQuiz() {
        document.getElementById('infoView').style.display = 'none';
        document.getElementById('quizView').style.display = 'block';
        this.renderQuestion();
    },

    showEmptyState() {
        const container = this.state.subjectId ? document.getElementById('quizView') : document.getElementById('selectionView');
        if (container) {
            container.style.display = 'block';
            container.innerHTML = `
                <div class="question-card" style="text-align:center; padding:50px;">
                    <i class="fa-solid fa-face-surprise" style="font-size:3rem; color:var(--accent); margin-bottom:15px;"></i>
                    <h3>Belum ada soal simulasi.</h3>
                    <p style="opacity:0.7;">Admin belum masukin soal buat ${this.state.subjectId ? 'mapel ini' : 'kelas lo'}. Tungguin aja ya! wkwk</p>
                    <button onclick="window.location.href='kisi-kisi.html'" class="btn-back" style="margin:20px auto;">Balik ke Kisi-Kisi</button>
                </div>
            `;
        }
    },

    renderQuestion() {
        const q = this.state.questions[this.state.currentIndex];
        if (!q) return;

        // Ambil riwayat pilihan buat soal ini
        const chosenIndices = this.state.history[this.state.currentIndex] || [];
        this.state.answeredCorrectly = chosenIndices.includes(q.answer);

        const progressC = document.getElementById('cardProgress');
        const qText = document.getElementById('questionText');
        const pBar = document.getElementById('progressBar');
        
        if (progressC) progressC.innerText = `SOAL ${this.state.currentIndex + 1}/${this.state.questions.length}`;
        if (qText) qText.innerText = q.question;
        if (pBar) pBar.style.width = `${((this.state.currentIndex) / this.state.questions.length) * 100}%`;
        
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) {
            prevBtn.style.opacity = this.state.currentIndex > 0 ? '1' : '0.3';
            prevBtn.style.pointerEvents = this.state.currentIndex > 0 ? 'auto' : 'none';
        }
        
        const optionsGrid = document.getElementById('optionsGrid');
        if (optionsGrid) {
            optionsGrid.innerHTML = '';
            const prefixes = ['A', 'B', 'C', 'D', 'E'];
            q.options.forEach((opt, index) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                
                // Cek apakah option ini udah pernah dipilih
                if (chosenIndices.includes(index)) {
                    if (index === q.answer) btn.classList.add('correct');
                    else btn.classList.add('wrong');
                }

                // Jika sudah terjawab benar, disable tombol lainnya
                if (this.state.answeredCorrectly && index !== q.answer) {
                    btn.classList.add('disabled');
                }

                btn.innerHTML = `<span class="option-prefix">${prefixes[index]}</span><span class="option-content">${opt}</span>`;
                btn.onclick = () => this.checkAnswer(index, btn);
                optionsGrid.appendChild(btn);
            });
        }

        const expBox = document.getElementById('explanationBox');
        if (expBox) {
            if (this.state.answeredCorrectly && q.explanation) {
                expBox.innerHTML = `<strong>Penjelasan:</strong><br>${q.explanation}`;
                expBox.style.display = 'block';
            } else {
                expBox.style.display = 'none';
            }
        }
        
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            if (this.state.answeredCorrectly) nextBtn.classList.add('active');
            else nextBtn.classList.remove('active');
        }

        this.renderNavigator();
    },

    renderNavigator() {
        const container = document.getElementById('questionNavigator');
        if (!container) return;

        container.innerHTML = '';
        
        // Cari index tertinggi yang sudah "unlocked" (sudah dijawab benar)
        let maxUnlocked = 0;
        this.state.questions.forEach((q, idx) => {
            const h = this.state.history[idx] || [];
            if (h.includes(q.answer)) maxUnlocked = idx + 1;
        });

        // Current question is always unlocked
        const currentUnlockedLimit = Math.max(maxUnlocked, this.state.currentIndex);

        this.state.questions.forEach((_, index) => {
            const div = document.createElement('div');
            div.className = 'nav-item';
            div.innerText = index + 1;

            const isAnswered = (this.state.history[index] || []).includes(this.state.questions[index].answer);
            
            if (index === this.state.currentIndex) {
                div.classList.add('active');
            } else if (isAnswered) {
                div.classList.add('completed');
            } else if (index > currentUnlockedLimit) {
                div.classList.add('locked');
            }

            if (!div.classList.contains('locked')) {
                div.onclick = () => {
                    this.state.currentIndex = index;
                    this.renderQuestion();
                };
            }

            container.appendChild(div);
        });
    },

    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this.renderQuestion();
        }
    },

    checkAnswer(choiceIndex, btn) {
        if (this.state.answeredCorrectly) return;
        const q = this.state.questions[this.state.currentIndex];
        
        // Simpan ke history
        if (!this.state.history[this.state.currentIndex]) {
            this.state.history[this.state.currentIndex] = [];
        }
        if (!this.state.history[this.state.currentIndex].includes(choiceIndex)) {
            this.state.history[this.state.currentIndex].push(choiceIndex);
        }

        const isCorrect = choiceIndex === q.answer;
        if (isCorrect) {
            this.state.answeredCorrectly = true;
            btn.classList.add('correct');
            document.querySelectorAll('.option-btn').forEach(b => { if (b !== btn) b.classList.add('disabled'); });
            const expBox = document.getElementById('explanationBox');
            if (q.explanation && expBox) {
                expBox.innerHTML = `<strong>Penjelasan:</strong><br>${q.explanation}`;
                expBox.style.display = 'block';
            }
            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn) nextBtn.classList.add('active');
        } else {
            btn.classList.add('wrong');
            btn.style.pointerEvents = 'none';
        }
    },

    async syncProgress(completed = false) {
        if (!this.state.user || !this.state.subjectId) return;

        try {
            await supabase
                .from('simulation_progress')
                .upsert({
                    user_id: this.state.user.id,
                    subject_id: this.state.subjectId,
                    last_index: this.state.currentIndex,
                    total_questions: this.state.questions.length,
                    is_completed: completed,
                    updated_at: new Date().toISOString()
                });
        } catch (err) {
            console.warn('Tracking progress failed:', err);
        }
    },

    nextQuestion() {
        if (!this.state.answeredCorrectly) return;
        
        // Track progress sebelum pindah
        this.syncProgress();

        this.state.currentIndex++;
        if (this.state.currentIndex < this.state.questions.length) {
            this.renderQuestion();
        } else {
            this.showResult();
        }
    },

    showResult() {
        const pBar = document.getElementById('progressBar');
        const qView = document.getElementById('quizView');
        const rView = document.getElementById('resultView');
        
        if (pBar) pBar.style.width = '100%';
        if (qView) qView.style.display = 'none';
        if (rView) rView.style.display = 'block';
        
        // Track as completed
        this.syncProgress(true);

        if (typeof logActivity === 'function') {
            logActivity(`Menyelesaikan Simulasi: ${this.state.subjectId}`, "Simulasi", 15, this.state.subjectId);
        }
    },

    setupEventListeners() {
        const nextBtn = document.getElementById('nextBtn');
        const backBtn = document.getElementById('backBtn');
        const startBtn = document.getElementById('startBtn');
        const prevBtn = document.getElementById('prevBtn');
        
        if (nextBtn) nextBtn.onclick = () => this.nextQuestion();
        if (backBtn) backBtn.onclick = () => this.handleBack();
        if (startBtn) startBtn.onclick = () => this.startQuiz();
        if (prevBtn) prevBtn.onclick = () => this.prevQuestion();
    }
};

document.addEventListener('DOMContentLoaded', () => QuizApp.init());