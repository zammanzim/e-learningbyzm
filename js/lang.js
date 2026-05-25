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
            "confirm_delete_item": "Hapus <b>{name}</b> secara permanen?"
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
            "confirm_delete_item": "Permanently delete <b>{name}</b>?"
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
