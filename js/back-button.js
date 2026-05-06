(() => {
    const HOME = 'https://e-learniz.my.id/announcements';

    // Config dari <script> tag atribut
    // data-position  : bottom-right (default) | bottom-left | top-right | top-left
    // data-offset-x  : jarak horizontal dalam px (default: 24)
    // data-offset-y  : jarak vertikal dalam px (default: 24)
    const scriptEl = document.currentScript || document.querySelector('script[src*="back-button"]');
    const pos     = scriptEl?.dataset.position  || 'bottom-right';
    const offX    = scriptEl?.dataset.offsetX   || '24';
    const offY    = scriptEl?.dataset.offsetY   || '24';

    const isLeft   = pos.includes('left');
    const isTop    = pos.includes('top');

    const style = document.createElement('style');
    style.textContent = `
        #elz-back-btn {
            position: fixed;
            ${isTop    ? `top:${offY}px`    : `bottom:${offY}px`};
            ${isLeft   ? `left:${offX}px`   : `right:${offX}px`};
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: #0a0a0c;
            color: #00eaff;
            border: 1.5px solid #00eaff;
            border-radius: 50px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 0 12px rgba(0,234,255,0.25), 0 4px 20px rgba(0,0,0,0.4);
            transition: all 0.2s ease;
            white-space: nowrap;
        }
        #elz-back-btn:hover {
            background: #00eaff;
            color: #0a0a0c;
            box-shadow: 0 0 20px rgba(0,234,255,0.5), 0 4px 24px rgba(0,0,0,0.5);
            transform: translateY(-2px);
        }
        #elz-back-btn svg {
            flex-shrink: 0;
            width: 14px;
            height: 14px;
        }
        @media (max-width: 480px) {
            #elz-back-btn {
                ${isTop  ? `top:16px`    : `bottom:16px`};
                ${isLeft ? `left:16px`   : `right:16px`};
                padding: 8px 12px;
                font-size: 12px;
            }
        }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('a');
    btn.id = 'elz-back-btn';
    btn.href = HOME;
    btn.title = 'Kembali ke E-Learning Nizam';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
        </svg>
        kembali ke e-learniz
    `;

    const mount = () => { if (!document.getElementById('elz-back-btn')) document.body.appendChild(btn); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();