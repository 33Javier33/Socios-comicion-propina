// ============================================================
// NOTAS
// ============================================================

function notasFormatearMensaje(texto) {
    if (!texto) return '';
    // Escapar HTML primero para seguridad
    const escaped = texto.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // Detectar URLs (http, https, ftp) y convertirlas en enlaces
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    return escaped.replace(urlRegex, function(url) {
        // Limpiar puntuación al final que no forma parte de la URL
        const clean = url.replace(/[.,;:!?)]+$/, '');
        const trail = url.slice(clean.length);
        let label = clean;
        try {
            const u = new URL(clean);
            label = u.hostname + (u.pathname !== '/' ? u.pathname : '');
            if (label.length > 40) label = label.slice(0, 40) + '…';
        } catch(e) { label = clean.length > 45 ? clean.slice(0,45)+'…' : clean; }
        return '<a href="' + clean + '" target="_blank" rel="noopener noreferrer" '
            + 'style="color:var(--secondary);text-decoration:underline;word-break:break-all;display:inline-flex;align-items:center;gap:3px;" '
            + 'title="' + clean + '">'
            + '🔗 ' + label
            + '</a>' + trail;
    });
}

function notasCrearElemento(n, idx) {
    const lastSeen = parseInt(localStorage.getItem('_rec_last_seen')) || 0;
    const isNew = lastSeen > 0 && new Date(n.fecha).getTime() > lastSeen;
    const EMOJIS = ['👍','❤️','😂'];
    const rowIndex = n.originalIndex !== undefined ? n.originalIndex : idx;

    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : { ini: '', area: '' };
    const meId = sesion.ini ? sesion.ini + ' (' + sesion.area + ')' : '';

    const rxBtns = EMOJIS.map(e => {
        const arr = Array.isArray((n.reactions||{})[e]) ? (n.reactions||{})[e] : [];
        const cnt = arr.length;
        const mine = meId && arr.includes(meId);
        const names = arr.map(u => u.split(' ')[0]).join(', ');
        return `<button onclick="_notaReaccion('${rowIndex}','${e}')" title="${names}" style="background:${mine?'rgba(59,130,246,0.12)':'#f8fafc'};border:1px solid ${mine?'#93c5fd':'#e2e8f0'};border-radius:20px;padding:2px 10px;cursor:pointer;font-size:0.82em;transition:0.15s">${e}${cnt?' '+cnt:''}</button>`;
    }).join('');

    const rxSummary = EMOJIS.map(e => {
        const arr = Array.isArray((n.reactions||{})[e]) ? (n.reactions||{})[e] : [];
        if (!arr.length) return '';
        const names = arr.map(u => u.split(' ')[0]);
        const label = names.length <= 3 ? names.join(', ') : names.slice(0,3).join(', ') + ' y ' + (names.length-3) + ' más';
        return `<span style="white-space:nowrap">${e} ${label}</span>`;
    }).filter(Boolean).join(' &nbsp;');
    const border = n.pinned ? '3px solid #f59e0b' : isNew ? '3px solid #3b82f6' : '';
    const bg = n.pinned ? '#fffde7' : isNew ? '#eff6ff' : '';
    const div = document.createElement('div');
    div.className = 'nota-card';
    div.dataset.rowIndex = rowIndex;
    if (border) div.style.borderLeft = border;
    if (bg) div.style.background = bg;
    div.innerHTML =
        `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px">
                ${n.pinned?'<span style="background:#f59e0b;color:#fff;font-size:0.68em;font-weight:700;padding:1px 7px;border-radius:20px">📌 FIJADA</span>':''}
                ${isNew?'<span style="background:#3b82f6;color:#fff;font-size:0.68em;font-weight:700;padding:1px 7px;border-radius:20px">NUEVO</span>':''}
                <div style="font-size:0.75em;color:#7f8c8d;font-weight:600">${(n.autor||'Admin').toUpperCase()} &middot; ${new Date(n.fecha).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
                <button onclick="_notaPin('${rowIndex}',${!n.pinned})" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:0.85em" title="${n.pinned?'Desfijar':'Fijar'}">${n.pinned?'📌':'📍'}</button>
                <button onclick="notasBorrar(this)" style="background:none;border:1px solid #fee2e2;color:#ef4444;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8em">🗑️</button>
            </div>
        </div>
        <div style="font-size:0.95em;color:#333;line-height:1.5;white-space:pre-wrap;margin-bottom:10px">${notasFormatearMensaje(n.mensaje||'')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${rxBtns}</div>
        ${rxSummary ? `<div style="font-size:0.72em;color:#7f8c8d;margin-top:5px;line-height:1.4">${rxSummary}</div>` : ''}`;
    return div;
}

function notasRenderizar(notas) {
    const cont = document.getElementById('notasListaContainer');
    if (!cont) return;
    cont.innerHTML = '';
    if (!notas.length) { cont.innerHTML = '<div style="text-align:center;padding:30px;color:#7f8c8d;">Sin notas guardadas.</div>'; return; }
    notas = [...notas].sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0));
    notas.forEach((n, i) => {
        const idx = n.originalIndex !== undefined ? n.originalIndex : i;
        const el  = notasCrearElemento(n, idx);
        el.style.animationDelay = (i * 55) + 'ms';
        el.style.opacity = '0';
        cont.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = ''; });
    });
}

async function notasCargar() {
    const cont = document.getElementById('notasListaContainer');
    const cached = leerCache(CACHE_KEY_NOTAS);
    if (cached) {
        notasRenderizar(cached);
        fetch(URL_RECAUDACIONES + '?action=getNotes&t=' + Date.now())
            .then(r => r.json())
            .then(json => {
                const notas = (json.data||json.result||[]).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
                guardarCache(CACHE_KEY_NOTAS, notas);
                notasRenderizar(notas);
            }).catch(() => {});
        return;
    }
    cont.innerHTML = Array(3).fill('<div class="sk-card" style="margin-bottom:10px;"><div class="sk sk-line" style="width:30%;height:9px;margin-bottom:10px;"></div><div class="sk sk-line" style="width:88%;height:12px;margin-bottom:6px;"></div><div class="sk sk-line" style="width:65%;height:12px;"></div></div>').join('');
    try {
        const res = await fetch(URL_RECAUDACIONES + '?action=getNotes&t=' + Date.now());
        const json = await res.json();
        const notas = (json.data||json.result||[]).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
        guardarCache(CACHE_KEY_NOTAS, notas);
        notasRenderizar(notas);
    } catch(e) { cont.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger);">Error al cargar notas.</div>'; }
}

async function notasPublicar() {
    const msg = document.getElementById('notaInputMsg').value.trim();
    if (!msg) return showToast('Escribe algo antes de publicar','error');
    const btnPub = document.querySelector('#tab-notas .btn-submit');
    if (btnPub) { btnPub.disabled=true; btnPub.textContent='Publicando...'; }
    try {
        await fetch(URL_RECAUDACIONES,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'addNote',autor:'Admin',mensaje:msg})});
        document.getElementById('notaInputMsg').value='';
        showToast('Nota publicada','success');
        const cont = document.getElementById('notasListaContainer');
        if (cont.querySelector('div[style*="padding:30px"]')) cont.innerHTML='';
        const el = notasCrearElemento({fecha:new Date().toISOString(),autor:'Admin',mensaje:msg},-1);
        cont.insertBefore(el,cont.firstChild);
        try { localStorage.removeItem(CACHE_KEY_NOTAS); } catch(e) {}
    } catch(e) { showToast('Error al publicar nota','error'); }
    finally { if(btnPub){btnPub.disabled=false;btnPub.textContent='Publicar';} }
}

async function notasBorrar(btnEl) {
    if (!confirm('Eliminar esta nota permanentemente?')) return;
    const card = btnEl ? btnEl.closest('.nota-card') : null;
    const rowIndex = card ? card.dataset.rowIndex : null;
    if (!rowIndex) return showToast('No se pudo identificar la nota','error');
    if (card) {
        card.classList.add('saliendo');
        await new Promise(r => setTimeout(r, 290));
        card.remove();
        const cont = document.getElementById('notasListaContainer');
        if (cont && cont.querySelectorAll('.nota-card').length === 0)
            cont.innerHTML = '<div style="text-align:center;padding:30px;color:#7f8c8d;">Sin notas guardadas.</div>';
    }
    try {
        await fetch(URL_RECAUDACIONES, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteNote', index: rowIndex })
        });
        showToast('Nota eliminada', 'success');
        try { localStorage.removeItem(CACHE_KEY_NOTAS); } catch(e) {}
    } catch(e) {
        showToast('Error al eliminar nota', 'error');
        notasCargar();
    }
}

window._notaPin = async (id, pinned) => {
    try {
        // Un solo pin a la vez — desfijar el resto desde el cache actual
        const cached = leerCache(CACHE_KEY_NOTAS) || [];
        if (pinned) {
            const others = cached.filter(n => n.pinned && n.originalIndex !== id);
            for (const o of others) {
                await fetch(URL_RECAUDACIONES, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ action:'togglePin', id: o.originalIndex, pinned: false }) });
                o.pinned = false;
            }
        }
        // Actualizar cache local y re-renderizar al instante
        const nota = cached.find(n => n.originalIndex === id);
        if (nota) nota.pinned = pinned;
        guardarCache(CACHE_KEY_NOTAS, cached);
        notasRenderizar(cached);
        // Persistir en Supabase
        await fetch(URL_RECAUDACIONES, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ action:'togglePin', id, pinned }) });
    } catch(e) {}
};

window._notaReaccion = async (id, emoji) => {
    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : { ini: '', area: '' };
    const meId = sesion.ini ? sesion.ini + ' (' + sesion.area + ')' : 'Anon';

    const cached = leerCache(CACHE_KEY_NOTAS) || [];
    const nota = cached.find(n => n.originalIndex === id);
    if (!nota) return;
    if (!nota.reactions) nota.reactions = {};
    const arr = Array.isArray(nota.reactions[emoji]) ? [...nota.reactions[emoji]] : [];
    const idx = arr.indexOf(meId);
    const adding = idx === -1;
    if (adding) arr.push(meId); else arr.splice(idx, 1);
    if (arr.length === 0) delete nota.reactions[emoji]; else nota.reactions[emoji] = arr;
    guardarCache(CACHE_KEY_NOTAS, cached);
    notasRenderizar(cached);
    // Persistir en Supabase
    fetch(URL_RECAUDACIONES, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ action:'toggleReaction', id, emoji, user: meId, add: adding }) }).catch(()=>{});
};
