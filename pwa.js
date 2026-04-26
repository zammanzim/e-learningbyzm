// ==========================================
// PWA INSTALL BANNER
// ==========================================

(function () {
  'use strict';

  let _deferredPrompt = null;
  const STORAGE_KEY = 'pwa_installed';

  // Daftarin service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sw gagal, gapapa */ });
  }

  // Tangkap event beforeinstallprompt sebelum browser nembak sendiri
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    _tryShowBanner();
  });

  // Kalau user udah install lewat jalur lain (browser native)
  window.addEventListener('appinstalled', () => {
    _markInstalled();
    _hideBanner();
  });

  function _isInstalled() {
    // Cek localStorage flag
    if (localStorage.getItem(STORAGE_KEY) === '1') return true;
    // Cek kalau lagi jalan sebagai standalone (udah diinstall)
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true; // iOS Safari
    return false;
  }

  function _tryShowBanner() {
    if (_isInstalled()) return;
    if (!_deferredPrompt) return;

    // Tunggu sampe DOM left-section siap
    const tryInject = () => {
      const leftSection = document.querySelector('.left-section');
      if (!leftSection) {
        setTimeout(tryInject, 300);
        return;
      }
      _injectBanner(leftSection);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryInject);
    } else {
      tryInject();
    }
  }

  function _injectBanner(container) {
    if (document.getElementById('pwaInstallCard')) return; // udah ada

    const card = document.createElement('div');
    card.id = 'pwaInstallCard';
    card.innerHTML = `
      <style>
        #pwaInstallCard {
          background: linear-gradient(135deg, rgba(0, 234, 255, 0.07), rgba(0, 234, 255, 0.02));
          border: 1px solid rgba(0, 234, 255, 0.25);
          border-radius: 16px;
          padding: 16px 18px;
          margin-top: 16px;
          position: relative;
          overflow: hidden;
          animation: pwa-fade-in 0.4s ease;
        }
        @keyframes pwa-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        #pwaInstallCard::before {
          content: '';
          position: absolute;
          top: -40px; right: -40px;
          width: 120px; height: 120px;
          background: radial-gradient(circle, rgba(0,234,255,0.12), transparent 70%);
          pointer-events: none;
        }
        .pwa-card-inner {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pwa-icon-wrap {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: rgba(0, 234, 255, 0.12);
          border: 1px solid rgba(0, 234, 255, 0.2);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 20px;
          color: #00eaff;
        }
        .pwa-texts {
          flex: 1; min-width: 0;
        }
        .pwa-title {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 3px;
          line-height: 1.3;
        }
        .pwa-sub {
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          margin: 0;
          line-height: 1.4;
        }
        .pwa-sub i {
          color: rgba(0,234,255,0.6);
          margin-right: 3px;
        }
        .pwa-btn-install {
          flex-shrink: 0;
          background: linear-gradient(135deg, #00eaff, #0099cc);
          border: none;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          color: #0a0a0c;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          transition: opacity 0.2s, transform 0.15s;
          white-space: nowrap;
        }
        .pwa-btn-install:hover { opacity: 0.88; transform: scale(1.03); }
        .pwa-btn-install:active { transform: scale(0.97); }
        .pwa-btn-install.loading {
          opacity: 0.6; pointer-events: none;
        }
        .pwa-close {
          position: absolute;
          top: 8px; right: 10px;
          background: none; border: none;
          color: rgba(255,255,255,0.25);
          font-size: 14px; cursor: pointer;
          line-height: 1; padding: 2px 4px;
          transition: color 0.2s;
        }
        .pwa-close:hover { color: rgba(255,255,255,0.6); }
      </style>

      <button class="pwa-close" id="pwaCloseBtn" title="Tutup">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <div class="pwa-card-inner">
        <div class="pwa-icon-wrap">
          <i class="fa-solid fa-mobile-screen-button"></i>
        </div>
        <div class="pwa-texts">
          <p class="pwa-title">E-learniz sekarang bisa berbentuk aplikasi, pasang yok!</p>
          <p class="pwa-sub"><i class="fa-solid fa-database"></i> Cuman makan penyimpanan sebesar satu foto kecil aja, 0.1mb</p>
        </div>
        <button class="pwa-btn-install" id="pwaInstallBtn">
          <i class="fa-solid fa-download"></i> Pasang
        </button>
      </div>
    `;

    // Taruh setelah dailyInfoCard kalau ada, kalau gak ya append aja
    const dailyCard = document.getElementById('dailyInfoCard');
    if (dailyCard && dailyCard.parentElement === container) {
      dailyCard.insertAdjacentElement('afterend', card);
    } else {
      container.appendChild(card);
    }

    // Tombol install
    document.getElementById('pwaInstallBtn').addEventListener('click', _handleInstall);

    // Tombol close (dismiss sementara, session aja)
    document.getElementById('pwaCloseBtn').addEventListener('click', () => {
      _hideBanner();
      sessionStorage.setItem('pwa_banner_dismissed', '1');
    });
  }

  async function _handleInstall() {
    if (!_deferredPrompt) return;

    const btn = document.getElementById('pwaInstallBtn');
    if (btn) {
      btn.classList.add('loading');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memasang...';
    }

    try {
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      _deferredPrompt = null;

      if (outcome === 'accepted') {
        await _trackInstall();
        _markInstalled();
        _hideBanner();
        if (typeof showToast === 'function') {
          showToast('Aplikasi berhasil dipasang! 🎉', 'success');
        }
      } else {
        // User batal, kembalikan tombol
        if (btn) {
          btn.classList.remove('loading');
          btn.innerHTML = '<i class="fa-solid fa-download"></i> Pasang';
        }
      }
    } catch (err) {
      console.error('[PWA] Install error:', err);
      if (btn) {
        btn.classList.remove('loading');
        btn.innerHTML = '<i class="fa-solid fa-download"></i> Pasang';
      }
    }
  }

  async function _trackInstall() {
    try {
      if (typeof supabase === 'undefined') return;
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);

      await supabase.from('pwa_installs').upsert({
        user_id:      user.id,
        user_name:    user.full_name || user.nickname || user.short_name || 'Unknown',
        class_id:     user.class_id || null,
        installed_at: new Date().toISOString(),
        platform:     _getPlatform()
      }, { onConflict: 'user_id' });
    } catch (err) {
      // Tracking gagal gapapa, install tetap jalan
      console.warn('[PWA] Tracking error:', err);
    }
  }

  function _getPlatform() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
    if (/windows/i.test(ua)) return 'Windows';
    if (/mac/i.test(ua)) return 'Mac';
    return 'Unknown';
  }

  function _markInstalled() {
    localStorage.setItem(STORAGE_KEY, '1');
  }

  function _hideBanner() {
    const card = document.getElementById('pwaInstallCard');
    if (!card) return;
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-6px)';
    setTimeout(() => card.remove(), 320);
  }

  // Kalau banner udah pernah dismiss di session ini, skip
  if (sessionStorage.getItem('pwa_banner_dismissed') === '1') return;

  // Cek kalau browser udah trigger beforeinstallprompt sebelum script jalan
  // (Edge case: script load lambat)
  window.addEventListener('load', () => {
    if (!_isInstalled() && !document.getElementById('pwaInstallCard') && _deferredPrompt) {
      _tryShowBanner();
    }
  });

})();