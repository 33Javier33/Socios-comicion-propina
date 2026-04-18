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
    const fecha = new Date(n.fecha).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const autor = (n.autor||'Admin').toUpperCase();
    const rowIndex = n.originalIndex !== undefined ? n.originalIndex : idx;
    const div = document.createElement('div');
    div.className = 'nota-card';
    div.dataset.rowIndex = rowIndex;
    div.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'
        + '<div style="flex:1;"><div style="font-size:0.75em;color:#7f8c8d;margin-bottom:5px;font-weight:600;">'+autor+' &middot; '+fecha+'</div>'
        + '<div style="font-size:0.95em;color:#333;line-height:1.5;white-space:pre-wrap;">'+notasFormatearMensaje(n.mensaje||'')+'</div></div>'
        + '<button onclick="notasBorrar(this)" style="background:none;border:1px solid #fee2e2;color:#ef4444;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8em;flex-shrink:0;" title="Eliminar">&#x1F5D1;</button>'
        + '</div>';
    return div;
}

function notasRenderizar(notas) {
    const cont = document.getElementById('notasListaContainer');
    if (!cont) return;
    cont.innerHTML = '';
    if (!notas.length) { cont.innerHTML = '<div style="text-align:center;padding:30px;color:#7f8c8d;">Sin notas guardadas.</div>'; return; }
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
            body: JSON.stringify({ action: 'deleteNote', index: parseInt(rowIndex) })
        });
        showToast('Nota eliminada', 'success');
        try { localStorage.removeItem(CACHE_KEY_NOTAS); } catch(e) {}
    } catch(e) {
        showToast('Error al eliminar nota', 'error');
        notasCargar();
    }
}
