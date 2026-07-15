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
    // Badge "destacado para": resolver IDs → nombres
    const destIds = (n.destacados || '').split(',').map(s => s.trim()).filter(Boolean);
    let destHTML = '';
    if (destIds.length) {
        const nombres = destIds.map(id => { const s = (typeof cacheSocios !== 'undefined' ? cacheSocios : []).find(x => x.id === id); return s ? (s.nombre || id) : id; });
        const label = nombres.length <= 3 ? nombres.join(', ') : nombres.slice(0, 3).join(', ') + ' y ' + (nombres.length - 3) + ' más';
        destHTML = `<div style="display:inline-flex;align-items:center;gap:5px;background:#fef3c7;border:1px solid #fde68a;border-radius:20px;padding:3px 11px;font-size:0.74em;color:#92400e;font-weight:700;margin-bottom:10px;">⭐ Destacado para: ${_htmlEscSoc(label)}</div>`;
    }
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
        ${destHTML}
        ${n.foto_url ? `<img src="${(n.foto_url+'').replace(/"/g,'%22')}" onclick="verFotoGrande('${(n.foto_url+'').replace(/'/g,'%27')}')" style="max-width:180px;max-height:180px;border-radius:10px;border:1px solid #e2e8f0;object-fit:cover;cursor:zoom-in;margin-bottom:10px;display:block;">` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap">${rxBtns}</div>
        ${rxSummary ? `<div style="font-size:0.72em;color:#7f8c8d;margin-top:5px;line-height:1.4">${rxSummary}</div>` : ''}`;
    return div;
}

let _notasFirmaActual = null;
function _notasFirma(notas) {
    return JSON.stringify((notas || []).map(n => [
        n.originalIndex, n.pinned ? 1 : 0, n.mensaje || '', n.foto_url || '', n.destacados || '', n.reactions || {}
    ]));
}
function notasRenderizar(notas) {
    const cont = document.getElementById('notasListaContainer');
    if (!cont) return;
    const ordenadas = [...(notas || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    // Solo re-renderizar si algo cambió → evita el parpadeo del auto-refresco cada 5 s
    const firma = _notasFirma(ordenadas);
    if (firma === _notasFirmaActual && cont.children.length) return;
    const primeraVez = _notasFirmaActual === null;
    _notasFirmaActual = firma;
    cont.innerHTML = '';
    if (!ordenadas.length) { cont.innerHTML = '<div style="text-align:center;padding:30px;color:#7f8c8d;">Sin notas guardadas.</div>'; return; }
    ordenadas.forEach((n, i) => {
        const idx = n.originalIndex !== undefined ? n.originalIndex : i;
        const el  = notasCrearElemento(n, idx);
        // Fade-in solo la primera vez que se pinta la lista (no en cada cambio menor)
        if (primeraVez) {
            el.style.animationDelay = (i * 55) + 'ms';
            el.style.opacity = '0';
            cont.appendChild(el);
            requestAnimationFrame(() => { el.style.opacity = ''; });
        } else {
            cont.appendChild(el);
        }
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
    if (!msg && !_notaFotoFile) return showToast('Escribe algo o adjunta una foto','error');
    const btnPub = document.querySelector('#tab-notas .btn-submit');
    if (btnPub) { btnPub.disabled=true; btnPub.textContent='Publicando...'; }
    try {
        // Subir foto (opcional) al bucket público avatares (carpeta notas)
        let foto_url = '';
        if (_notaFotoFile && typeof dbSoc !== 'undefined') {
            try {
                const ext = (_notaFotoFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
                const path = 'notas/' + Date.now() + '_' + Math.random().toString(36).slice(2,7) + '.' + ext;
                const up = await dbSoc.storage.from('avatares').upload(path, _notaFotoFile, { contentType:_notaFotoFile.type, upsert:true });
                if (!up.error) foto_url = dbSoc.storage.from('avatares').getPublicUrl(path).data.publicUrl;
            } catch(eF) { console.warn('[notas] foto:', eF); }
        }
        const destacados = [..._notaDestacados].join(',');
        await fetch(URL_RECAUDACIONES,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'addNote',autor:'Admin',mensaje:msg,foto_url,destacados})});
        document.getElementById('notaInputMsg').value='';
        showToast('Nota publicada','success');
        const cont = document.getElementById('notasListaContainer');
        if (cont.querySelector('div[style*="padding:30px"]')) cont.innerHTML='';
        const el = notasCrearElemento({fecha:new Date().toISOString(),autor:'Admin',mensaje:msg,foto_url,destacados},-1);
        cont.insertBefore(el,cont.firstChild);
        notasFotoQuitar();
        notaDestacarLimpiar();
        try { localStorage.removeItem(CACHE_KEY_NOTAS); } catch(e) {}
    } catch(e) { showToast('Error al publicar nota','error'); }
    finally { if(btnPub){btnPub.disabled=false;btnPub.textContent='Publicar';} }
}

// Foto opcional de la nota
let _notaFotoFile = null;
function notasFotoElegida(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { showToast('Debe ser una imagen','error'); return; }
    _notaFotoFile = f;
    const prev = document.getElementById('nota-foto-preview');
    if (prev) {
        const url = URL.createObjectURL(f);
        prev.style.display = 'flex';
        prev.innerHTML = `<img src="${url}" style="width:38px;height:38px;border-radius:7px;object-fit:cover;border:1px solid #cbd5e1;">
            <span style="font-size:0.78em;color:#059669;font-weight:700;">✓ foto lista</span>
            <button type="button" onclick="notasFotoQuitar()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.9em;">✕</button>`;
    }
}
function notasFotoQuitar() {
    _notaFotoFile = null;
    const prev = document.getElementById('nota-foto-preview');
    if (prev) { prev.style.display='none'; prev.innerHTML=''; }
    const cam = document.getElementById('nota-foto-cam'); if (cam) cam.value='';
    const gal = document.getElementById('nota-foto-gal'); if (gal) gal.value='';
}

// ── Destacar la nota para socios específicos ──
let _notaDestacados = new Set();
function notaDestacarToggle() {
    const p = document.getElementById('notaDestacarPanel');
    if (!p) return;
    const abrir = p.style.display === 'none';
    p.style.display = abrir ? 'block' : 'none';
    if (abrir) notaDestacarRender();
}
function notaDestacarRender() {
    const cont = document.getElementById('notaDestacarLista');
    if (!cont) return;
    const q = (document.getElementById('notaDestacarBuscar')?.value || '').toLowerCase().trim();
    const socios = (typeof cacheSocios !== 'undefined' ? cacheSocios : [])
        .filter(s => !q || ((s.nombre || '') + ' ' + (s.apellido || '')).toLowerCase().includes(q))
        .sort((a, b) => ((a.nombre || '') + a.apellido).localeCompare((b.nombre || '') + b.apellido));
    if (!socios.length) { cont.innerHTML = '<p style="font-size:0.8em;color:#94a3b8;text-align:center;padding:10px;">Sin socios.</p>'; return; }
    cont.innerHTML = socios.map(s => {
        const sel = _notaDestacados.has(s.id);
        const nom = _htmlEscSoc ? _htmlEscSoc((s.nombre || '') + ' ' + (s.apellido || '')) : ((s.nombre || '') + ' ' + (s.apellido || ''));
        return `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;cursor:pointer;${sel ? 'background:#fef3c7;' : ''}">
            <input type="checkbox" ${sel ? 'checked' : ''} onchange="notaDestacarSocio('${s.id}')" style="width:16px;height:16px;">
            <span style="font-size:0.86em;color:#334155;">${nom}</span>
        </label>`;
    }).join('');
}
function notaDestacarSocio(id) {
    if (_notaDestacados.has(id)) _notaDestacados.delete(id); else _notaDestacados.add(id);
    _notaDestacarResumen();
}
function _notaDestacarResumen() {
    const r = document.getElementById('notaDestacarResumen');
    const btn = document.getElementById('notaDestacarBtn');
    const n = _notaDestacados.size;
    if (r) r.textContent = n ? `⭐ ${n} socio${n === 1 ? '' : 's'} destacado${n === 1 ? '' : 's'}` : '';
    if (btn) btn.style.background = n ? '#fde68a' : '#fffbeb';
}
function notaDestacarLimpiar() {
    _notaDestacados = new Set();
    _notaDestacarResumen();
    const p = document.getElementById('notaDestacarPanel'); if (p) p.style.display = 'none';
    const b = document.getElementById('notaDestacarBuscar'); if (b) b.value = '';
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
