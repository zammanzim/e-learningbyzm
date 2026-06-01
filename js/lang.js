/**
 * E-LEARNIZ i18n SYSTEM
 * Handling multi-language without blinking.
 */

const i18n = {
    current: localStorage.getItem('app_lang') || 'id',

    // Kamus Utama
    data: {
        id: {
            "app_name": "E-Learning Nizam",
            "save": "Simpan",
            "cancel": "Batal",
            "delete": "Hapus",
            "close": "Tutup",
            "loading": "Memuat...",
            "welcome": "Haii, {name}!",
            "theme_title": "Personalisasi Tema",
            "lang_select": "Pilih Bahasa",
            "lang_id": "Bahasa Indonesia",
            "lang_en": "English",
            "bg_title": "Background",
            "accent_title": "Warna Aksen",
            "text_size": "Ukuran Teks",
            "save_apply": "SIMPAN & TERAPKAN",
            "reset_default": "Reset ke tampilan default",
            "upload_photo": "Upload Foto",
            "own_photo": "Foto sendiri",
            "success_save": "Tema berhasil disimpan!",
            "error_upload": "Gagal upload foto",
            "login_first": "Login dulu miz!",
            "confirm_delete_item": "Hapus <b>{name}</b> secara permanen?",
            "materi_title": "Materi & Pengumuman",
            "tasks_list": "Daftar Tugas",
            "kisi_format": "Kisi - Kisi {subject}",
            "other": "Lainnya",
            "refresh": "Segarkan",
            "all": "Semua",

            // Sidebar Groups
            "sidebar_system": "Menu Sistem",
            "sidebar_admin": "Panel Admin",
            "sidebar_main": "Menu Utama",
            "sidebar_lessons": "Mata Pelajaran",
            "sidebar_custom": "Menu Lainnya",
            "sidebar_Web Siswa": "Web Siswa",

            // Sidebar Items (by subject_id)
            "announcements": "Pengumuman",
            "tugas": "Daftar Tugas",
            "kisi-kisi": "Kisi-Kisi",
            "search": "Cari Akun",
            "theme": "Tema",
            "settingacc": "Pengaturan Akun",
            "user": "Profil",
            "send": "Kirim File",
            "forum": "Forum Diskusi",
            "test-scores?id=psasi": "Nilai PSASI",
            "test-scores?id=psts": "Nilai PSTS",
            "updates": "Update Patch",
            "bahasaindonesia": "B. Indonesia",
            "bahasainggris": "B. Inggris",
            "bahasasunda": "B. Sunda",
            "bahasajepang": "B. Jepang",
            "matematika": "Matematika",
            "proipas": "Proipas",
            "pabp": "PABP",
            "pp": "PP",
            "senibudaya": "Seni Budaya",
            "sejarah": "Sejarah",
            "pjok": "PJOK",
            "bk": "BK",
            "informatika": "Informatika",
            "dpr1": "DASPROGRPL 1",
            "dpr2": "DASPROGRPL 2",
            "dpr3": "DASPROGRPL 3",
            "dasprogrpl1": "DASPROGRPL 1",
            "dasprogrpl2": "DASPROGRPL 2",
            "dasprogrpl3": "DASPROGRPL 3",

            // Days (Indonesia Keys for logic)
            "minggu": "Minggu",
            "senin": "Senin",
            "selasa": "Selasa",
            "rabu": "Rabu",
            "kamis": "Kamis",
            "jumat": "Jumat",
            "sabtu": "Sabtu",

            // Months
            "january": "Januari",
            "february": "Februari",
            "march": "Maret",
            "april": "April",
            "may": "Mei",
            "june": "Juni",
            "july": "Juli",
            "august": "Agustus",
            "september": "September",
            "october": "Oktober",
            "november": "November",
            "december": "Desember",

            // Announcements
            "announcements3": "Pengumuman dan Jadwal",
            "home": "Beranda",

            // Kisi-kisi
            "exam_topics": "Kisi-Kisi",
            "choose_lesson": "Pilih Pelajaran",
            "all_lessons": "Semua Pelajaran",
            "no_kisi": "Belum ada kisi-kisi untuk hari ini",

            // daily-card.js
            "edit_schedule": "Edit jadwal",
            "activate_mode": "Mode jadwal",
            "main_sch": "Jadwal Utama",
            "exam_sch": "Mode Ulangan",
            "custom_sch": "Custom Event",
            "auto_upd": "Auto Update di Jam 15:00",
            "sch_kisi": "Hari di Kisi-kisi",
            "edit_day": "Edit Hari",
            "special_event": "Event Spesial",
            "tomorrow": "Besok",
            "today": "Hari Ini",
            "exam": "Ujian",
            "task": "Tugas",
            "tasks_pending": "Yang Belum Selesai",
            "tasks_all": "Semua Tugas",
            "view_day": "Melihat jadwal hari {day}",
            "data_saved": "Data Tersimpan",
            "failed_save": "Gagal Menyimpan",
            "uniform": "Seragam",
            "activity": "Kegiatan",
            "notes": "Catatan",
            "lesson_sch": "Jadwal Pelajaran",
            "cleaning_duty": "Petugas Piket",
            "add_row": "Tambah Baris",
            "add_people": "Tambah Orang",

            // headerpp
            "hi": "Haii",
            "class": "Kelas",
            "announcements2": "Pengumuman",
            "edit_prof": "Edit Profil",
            "theme2": "Personalisasi",
            "visitor": "Pengunjung",
            "resetvist": "Reset Pengunjung",

            // modal
            "new_material": "Materi Baru",
            "send2page": "Kirim ke Halaman",
            "markasassign": "Tandai sebagai Tugas",
            "title": "Judul",
            "subtitle": "Sub-judul",
            "large": "Besar",
            "medium": "Sedang",
            "small": "Kecil",
            "footer": "Kaki (Footer)",
            "card_color": "Warna Kartu",
            "uploadphotos": "<b>Klik untuk upload</b> atau tarik foto ke sini",
            "attachments": "Lampiran",

            // detailOverlay
            "see_desc": "Lihat Deskripsi",

            // forum
            "post_discussion": "Mulai Diskusi",
            "what_discussion": "Apa yang mau kamu bahas?",

            //tugas
            "task_list": "Daftar Tugas",
            "complete_status": "Status Penyelesaian",
            "small_text": "Pencet tombol 'Selesai?' agar tugas tertanda selesai dan tersortir rapi",
            youvedone: "Kamu sudah ngerjain {done} dari {total} tugas",
        },
        en: {
            "app_name": "E-Learning Nizam",
            "save": "Save",
            "cancel": "Cancel",
            "delete": "Delete",
            "close": "Close",
            "loading": "Loading...",
            "welcome": "Hello, {name}!",
            "theme_title": "Theme Personalization",
            "lang_select": "Select Language",
            "lang_id": "Indonesian",
            "lang_en": "English",
            "bg_title": "Background",
            "accent_title": "Accent Color",
            "text_size": "Text Size",
            "save_apply": "SAVE & APPLY",
            "reset_default": "Reset to default appearance",
            "upload_photo": "Upload Photo",
            "own_photo": "Own photo",
            "success_save": "Theme saved successfully!",
            "error_upload": "Failed to upload photo",
            "login_first": "Login first miz!",
            "confirm_delete_item": "Permanently delete <b>{name}</b>?",
            "materi_title": "Material & Announcements",
            "tasks_list": "Tasks List",
            "kisi_format": "Exam Topics - {subject}",
            "other": "Other",
            "refresh": "Refresh",
            "all": "All",

            // Sidebar Groups
            "sidebar_system": "System Menu",
            "sidebar_admin": "Admin Panel",
            "sidebar_main": "Main Menu",
            "sidebar_lessons": "Lessons",
            "sidebar_custom": "Other Menu",
            "sidebar_Web Siswa": "Students web",

            // Sidebar Items (by subject_id)
            "announcements": "Announcements",
            "tugas": "Task List",
            "kisi-kisi": "Exam Topics",
            "search": "Search Account",
            "theme": "Theme",
            "settingacc": "Account Settings",
            "user": "Profile",
            "send": "Send Files",
            "forum": "Discussion Forum",
            "test-scores?id=psasi": "Test Score PSASI",
            "test-scores?id=psts": "Test Score PSTS",
            "updates": "Patch Updates",
            "bahasaindonesia": "Indonesian",
            "bahasainggris": "English",
            "bahasasunda": "Sundanese",
            "bahasajepang": "Japanese",
            "matematika": "Math",
            "proipas": "Science & Social",
            "pabp": "Islamic Education",
            "pp": "Pancasila Education",
            "senibudaya": "Culture",
            "sejarah": "History",
            "pjok": "Physical Education",
            "bk": "Counseling",
            "informatika": "Computer Science",
            "dpr1": "Software Engineering 1",
            "dpr2": "Software Engineering 2",
            "dpr3": "Software Engineering 3",
            "dasprogrpl1": "Software Engineering 1",
            "dasprogrpl2": "Software Engineering 2",
            "dasprogrpl3": "Software Engineering 3",

            // Days
            "minggu": "Sunday",
            "senin": "Monday",
            "selasa": "Tuesday",
            "rabu": "Wednesday",
            "kamis": "Thursday",
            "jumat": "Friday",
            "sabtu": "Saturday",

            // Months
            "january": "January",
            "february": "February",
            "march": "March",
            "april": "April",
            "may": "May",
            "june": "June",
            "july": "July",
            "august": "August",
            "september": "September",
            "october": "October",
            "november": "November",
            "december": "December",

            // Announcements
            "announcements3": "Announcements and Schedule",
            "home": "Home",

            // Kisi-kisi
            "exam_topics": "Exam Topics",
            "choose_lesson": "Choose a Lesson",
            "all_lessons": "All Lessons",
            "no_kisi": "There are no exam topics for this day",

            //daily-card.js
            "edit_schedule": "Edit schedule",
            "activate_mode": "Schedule mode",
            "main_sch": "Main schedule",
            "exam_sch": "Exam schedule",
            "custom_sch": "Custom schedule",
            "auto_upd": "Automatically update at 3pm",
            "sch_kisi": "Schedule in kisi-kisi",
            "edit_day": "Edit day",
            "special_event": "Special Event",
            "tomorrow": "Tomorrow",
            "today": "Today",
            "exam_topics": "Exam Topics",
            "exam": "Exam",
            "task": "task",
            "view_day": "Viewing {day} schedule",
            "data_saved": "Data saved",
            "failed_save": "Failed to save",
            "uniform": "Uniform",
            "activity": "Activity",
            "notes": "Notes",
            "lesson_sch": "Lessons Schedule",
            "cleaning_duty": "Cleaning Duty",
            "add_row": "Add row",
            "add_people": "Add people",

            // headerpp
            "hi": "Hii",
            "class": "Class",
            "announcements2": "Announcements",
            "edit_prof": "Edit Profile",
            "theme2": "Personalize",
            "visitor": "Visitor",
            "resetvist": "Reset Visitor",

            //modal
            "new_material": "New Material",
            "send2page": "Send To page",
            "markasassign": "Mark as assignment",
            "title": "Title",
            "subtitle": "Sub-title",
            "large": "Large",
            "medium": "Medium",
            "small": "Small",
            "footer": "Footer",
            "card_color": "Card color",
            "uploadphotos": "<b>Click to upload</b> or drag photos here",

            //detailOverlay
            "see_desc": "See Description",

            //forum
            "post_discussion": "Post a Discussion",
            "what_discussion": "What do you want to discuss?",

            //tugas
            "task_list": "Task List",
            "complete_status": "Completion Status",
            "small_text": "Press the 'Mark As Done' button to mark the task as complete and sort it neatly.",
            "not_finish": "Not Finished Yet",
            "all_tasks": "All Tasks",
            "markasdone": "Mark As Done",
            "done": "Done",
            youvedone: "You have completed {done} out of {total} tasks",
            "archived":"Archived",
        }
    },

    t(key, params = {}) {
        let text = this.data[this.current]?.[key] || this.data['id']?.[key] || key;
        Object.keys(params).forEach(p => {
            text = text.replace(`{${p}}`, params[p]);
        });
        return text;
    },

    setLanguage(lang) {
        if (this.current === lang) return;
        this.current = lang;
        localStorage.setItem('app_lang', lang);
        document.body.style.opacity = '0'; // Soft fade out
        setTimeout(() => window.location.reload(), 150);
    },

    init() {
        // 1. Scanner awal untuk elemen yang sudah ada
        const translateEl = (el) => {
            if (el.dataset.i18n) {
                const key = el.dataset.i18n;
                el.innerHTML = this.t(key);
            }
            if (el.placeholder && el.dataset.i18nPlaceholder) {
                el.placeholder = this.t(el.dataset.i18nPlaceholder);
            }
        };

        // 2. MutationObserver untuk handle elemen baru (Anti-Blink)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.dataset.i18n || node.dataset.i18nPlaceholder) translateEl(node);
                        node.querySelectorAll('[data-i18n], [data-i18n-placeholder]').forEach(translateEl);
                    }
                });
            });
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });

        // 3. Fallback & Lang Ready Class
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('[data-i18n], [data-i18n-placeholder]').forEach(translateEl);
            document.body.classList.add('lang-ready');
        });
    }
};

// Global Helpers
window.t = (key, params) => i18n.t(key, params);
window.setLanguage = (lang) => i18n.setLanguage(lang);

// Start ASAP
i18n.init();
;

function t(key, vars = {}) {

    let text =
        translations[currentLang]?.[key]
        || key;

    Object.keys(vars).forEach(k => {
        text = text.replace(`{${k}}`, vars[k]);
    });

    return text;
}