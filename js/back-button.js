(() => {
    const HOME = 'https://e-learniz.my.id';
    const SB_URL = 'https://vttmwtlqzbbiaromohrp.supabase.co';
    const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dG13dGxxemJiaWFyb21vaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg4NTMsImV4cCI6MjA4MDg0NDg1M30.16SwOEqD5ZNAgk1oWhLrL41Eqw4kkeAKTyHxkSqmpiY';

    // ── Config dari script tag ─────────────────────────────
    const scriptEl = document.currentScript || document.querySelector('script[src*="back-button"]');
    const pos = scriptEl?.dataset.position || 'bottom-right';
    const offX = scriptEl?.dataset.offsetX || '24';
    const offY = scriptEl?.dataset.offsetY || '24';
    const isLeft = pos.includes('left');
    const isTop = pos.includes('top');

    // ── Akun dari localStorage ─────────────────────────────
    function getUser() {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    }

    // ── JWT token dari sesi Supabase ───────────────────────
    // Supabase nyimpen session di localStorage dengan key:
    // sb-[project-ref]-auth-token
    function getToken() {
        try {
            const raw = localStorage.getItem('sb-vttmwtlqzbbiaromohrp-auth-token');
            if (raw) {
                const parsed = JSON.parse(raw);
                return parsed?.access_token || SB_ANON;
            }
            // Fallback: cari key supabase auth di semua localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.includes('auth-token') && k.includes('supabase')) {
                    const v = JSON.parse(localStorage.getItem(k) || '{}');
                    if (v?.access_token) return v.access_token;
                }
            }
        } catch { }
        return SB_ANON;
    }

    // ── REST helper ────────────────────────────────────────
    async function sb(path, opts = {}) {
        const token = getToken();
        const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
            ...opts,
            headers: {
                'apikey': SB_ANON,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': opts.prefer || 'return=minimal',
                ...(opts.headers || {})
            }
        });
        const t = await r.text();
        return t ? JSON.parse(t) : null;
    }

    // ── Catat kunjungan ────────────────────────────────────
    async function recordVisit() {
        const user = getUser();
        if (!user?.id) return; // harus login

        const pageKey = window.location.pathname;
        const throttleKey = `pv_${user.id}_${pageKey}`;
        const last = parseInt(localStorage.getItem(throttleKey) || '0');
        if (Date.now() - last < 60 * 60 * 1000) return; // throttle 1 jam

        try {
            await sb('page_visitors', {
                method: 'POST',
                body: JSON.stringify({
                    page_key: pageKey,
                    page_title: document.title || pageKey,
                    user_id: user.id,
                    visitor_name: user.nickname || user.full_name || user.name || 'User',
                    visitor_class: user.class_name || String(user.class_id || '-'),
                    avatar_url: user.avatar_url || null,
                })
            });
            localStorage.setItem(throttleKey, String(Date.now()));
            console.log('[back-button] Visit recorded:', pageKey);
        } catch (e) {
            console.warn('[back-button] Failed to record visit:', e);
        }
    }

    // ── Ambil pengunjung halaman ini ───────────────────────
    async function fetchVisitors() {
        const pageKey = encodeURIComponent(window.location.pathname);
        return await sb(
            `page_visitors?page_key=eq.${pageKey}&order=visited_at.desc&limit=200`,
            { prefer: 'return=representation', headers: { 'Accept': 'application/json' } }
        ) || [];
    }

    // ── Format waktu ───────────────────────────────────────
    function fmtTime(iso) {
        return new Date(iso).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // ── Popup ──────────────────────────────────────────────
    function showVisitorPopup(visitors) {
        document.getElementById('_pv_overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = '_pv_overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:999999;
            background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);
            display:flex;align-items:center;justify-content:center;
            padding:16px;box-sizing:border-box;
            animation:_pvFade .18s ease;`;

        const rows = visitors.length
            ? visitors.map((v, i) => {
                const av = v.avatar_url
                    ? `<img src="${v.avatar_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
                    : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(0,234,255,0.1);
                        border:1px solid rgba(0,234,255,0.2);display:flex;align-items:center;
                        justify-content:center;font-size:11px;font-weight:700;color:#00eaff;flex-shrink:0;">
                        ${(v.visitor_name || '?')[0].toUpperCase()}</div>`;
                return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                    <td style="padding:8px 10px;color:#444;font-size:11px;">${i + 1}</td>
                    <td style="padding:8px 10px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            ${av}
                            <span style="font-size:13px;font-weight:600;color:#ddd;">${v.visitor_name || '—'}</span>
                        </div>
                    </td>
                    <td style="padding:8px 10px;font-size:12px;color:#777;">${v.visitor_class || '—'}</td>
                    <td style="padding:8px 10px;font-size:11px;color:#555;white-space:nowrap;">${fmtTime(v.visited_at)}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="4" style="padding:32px;text-align:center;color:#444;font-size:13px;">
                Belum ada yang berkunjung</td></tr>`;

        overlay.innerHTML = `
            <div style="background:#0e0f16;border:1px solid rgba(0,234,255,0.15);border-radius:16px;
                width:100%;max-width:500px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;
                box-shadow:0 0 48px rgba(0,234,255,0.08),0 24px 64px rgba(0,0,0,0.7);">
                <div style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.06);
                    display:flex;align-items:center;gap:12px;flex-shrink:0;">
                    <div style="width:34px;height:34px;border-radius:9px;flex-shrink:0;
                        background:rgba(0,234,255,0.08);border:1px solid rgba(0,234,255,0.18);
                        display:flex;align-items:center;justify-content:center;color:#00eaff;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:700;color:#fff;">Pengunjung Halaman</div>
                        <div style="font-size:11px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${document.title || window.location.pathname}</div>
                    </div>
                    <div style="font-size:12px;font-weight:700;color:#00eaff;flex-shrink:0;
                        background:rgba(0,234,255,0.08);padding:3px 12px;border-radius:20px;">
                        ${visitors.length}×
                    </div>
                    <button onclick="document.getElementById('_pv_overlay').remove()"
                        style="background:none;border:none;color:#444;cursor:pointer;font-size:18px;
                        padding:2px 6px;line-height:1;flex-shrink:0;transition:color .15s;"
                        onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#444'">✕</button>
                </div>
                <div style="overflow-y:auto;flex:1;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="position:sticky;top:0;background:#0e0f16;z-index:1;
                                border-bottom:1px solid rgba(255,255,255,0.06);">
                                <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase;">#</th>
                                <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase;">Nama</th>
                                <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase;">Kelas</th>
                                <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase;">Waktu</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;

        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }

    // ── CSS ────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        @keyframes _pvFade{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        #_pv_group{
            position:fixed;
            ${isTop ? `top:${offY}px` : `bottom:${offY}px`};
            ${isLeft ? `left:${offX}px` : `right:${offX}px`};
            z-index:99999;display:flex;align-items:center;gap:8px;
        }
        #_pv_back{
            display:flex;align-items:center;gap:8px;padding:10px 16px;
            background:#0a0a0c;color:#00eaff;border:1.5px solid #00eaff;border-radius:50px;
            font-family:'Segoe UI',sans-serif;font-size:13px;font-weight:600;
            cursor:pointer;text-decoration:none;white-space:nowrap;
            box-shadow:0 0 12px rgba(0,234,255,.2),0 4px 20px rgba(0,0,0,.4);
            transition:all .2s ease;
        }
        #_pv_back:hover{background:#00eaff;color:#0a0a0c;transform:translateY(-2px);
            box-shadow:0 0 20px rgba(0,234,255,.5),0 4px 24px rgba(0,0,0,.5);}
        #_pv_back svg{flex-shrink:0;width:14px;height:14px;}
        #_pv_eye{
            width:38px;height:38px;border-radius:50%;flex-shrink:0;
            background:#0a0a0c;border:1.5px solid rgba(255,255,255,.1);color:#555;
            display:flex;align-items:center;justify-content:center;
            cursor:pointer;position:relative;
            box-shadow:0 4px 16px rgba(0,0,0,.4);transition:all .2s ease;
        }
        #_pv_eye:hover{border-color:#00eaff;color:#00eaff;transform:translateY(-2px);
            box-shadow:0 0 14px rgba(0,234,255,.25);}
        #_pv_eye svg{width:15px;height:15px;pointer-events:none;}
        #_pv_badge{
            position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;
            border-radius:8px;background:#00eaff;color:#0a0a0c;
            font-size:9px;font-weight:800;padding:0 3px;
            border:2px solid #0a0a0c;display:none;
            align-items:center;justify-content:center;
        }
        @media(max-width:480px){#_pv_back{padding:8px 12px;font-size:12px;}#_pv_eye{width:34px;height:34px;}}
    `;
    document.head.appendChild(style);

    // ── Build UI ───────────────────────────────────────────
    const group = document.createElement('div');
    group.id = '_pv_group';

    const backBtn = document.createElement('a');
    backBtn.id = '_pv_back';
    backBtn.href = HOME;
    backBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
        </svg>kembali ke e-learniz`;

    const eyeBtn = document.createElement('button');
    eyeBtn.id = '_pv_eye';
    eyeBtn.title = 'Lihat siapa yang pernah masuk halaman ini';
    eyeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
        <span id="_pv_badge"></span>`;

    eyeBtn.onclick = async () => {
        eyeBtn.style.opacity = '0.5';
        eyeBtn.style.pointerEvents = 'none';
        try { showVisitorPopup(await fetchVisitors()); }
        catch { showVisitorPopup([]); }
        finally { eyeBtn.style.opacity = ''; eyeBtn.style.pointerEvents = ''; }
    };

    group.appendChild(backBtn);
    group.appendChild(eyeBtn);

    const mount = () => {
        if (document.getElementById('_pv_group')) return;
        document.body.appendChild(group);
        recordVisit();
        fetchVisitors().then(data => {
            const el = document.getElementById('_pv_badge');
            if (el && data.length) {
                el.textContent = data.length > 99 ? '99+' : data.length;
                el.style.display = 'flex';
            }
        }).catch(() => { });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();