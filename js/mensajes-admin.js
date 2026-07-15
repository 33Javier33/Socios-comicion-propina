// ============================================================
// MENSAJES A SOCIOS (privado admin ⇄ socio)
// El responsable escribe mensajes privados a un socio; el socio
// los ve en propi.solicitada (Mensajes → "Admin") y puede responder.
// Tabla: mensajes_admin (proyecto socios, dbSoc).
//   remitente: 'ADMIN' (responsable) | 'SOCIO'
// ============================================================

let msgAdminSocioActual = null;   // { id, nombre }
let msgAdminHilo        = [];      // mensajes del socio abierto
let msgAdminPorSocio    = {};      // socio_id -> { total, ultimaSocioTs }
let _msgAdminRtListo    = false;

function _msgEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function _msgAdminSeenKey(id) { return '_msgadmin_seen_' + id; }
function _msgAdminSeen(id) { return parseInt(localStorage.getItem(_msgAdminSeenKey(id))) || 0; }
function _msgAdminMarcarVisto(id) { localStorage.setItem(_msgAdminSeenKey(id), Date.now()); }

function msgAdmin_init() {
    msgAdmin_initRealtime();
    msgAdmin_cargarResumen();
    msgAdmin_renderLista();
    if (msgAdminSocioActual) msgAdmin_cargarHilo();
}

// Resumen: qué socios tienen conversación y cuáles tienen respuestas sin leer
async function msgAdmin_cargarResumen() {
    try {
        const { data, error } = await dbSoc.from('mensajes_admin')
            .select('socio_id, remitente, created_at, estado, mensaje, autor, foto_url');
        if (error) { console.warn('[msgAdmin] resumen:', error.message); return; }
        msgAdminPorSocio = {};
        (data || []).forEach(m => {
            if (m.estado === 'DELETED') return;
            const k = String(m.socio_id);
            if (!msgAdminPorSocio[k]) msgAdminPorSocio[k] = { total: 0, ultimaSocioTs: 0, ultimoTexto: '', ultimoAutor: '' };
            msgAdminPorSocio[k].total++;
            if (m.remitente === 'SOCIO') {
                const ts = new Date(m.created_at).getTime();
                if (ts > msgAdminPorSocio[k].ultimaSocioTs) {
                    msgAdminPorSocio[k].ultimaSocioTs = ts;
                    msgAdminPorSocio[k].ultimoTexto = m.mensaje || (m.foto_url ? '📷 Foto' : '');
                    msgAdminPorSocio[k].ultimoAutor = m.autor || '';
                }
            }
        });
        msgAdmin_actualizarNavDot();
        msgAdmin_renderLista();
        msgAdminBell_render();
    } catch (e) { console.warn('[msgAdmin]', e); }
}

function msgAdmin_hayNoLeidos(socioId) {
    const r = msgAdminPorSocio[String(socioId)];
    return !!(r && r.ultimaSocioTs > _msgAdminSeen(socioId));
}

function msgAdmin_actualizarNavDot() {
    const hay = Object.keys(msgAdminPorSocio).some(id => msgAdmin_hayNoLeidos(id));
    const dot = document.getElementById('msgAdminNavDot');
    if (dot) dot.style.display = hay ? 'block' : 'none';
    msgAdminBell_render();
}

// ── CAMPANA DE NOTIFICACIONES (mensajes de socios sin leer) ───────────────
function msgAdminBell_items() {
    const socios = (typeof cacheSocios !== 'undefined' ? cacheSocios : []);
    return Object.keys(msgAdminPorSocio)
        .filter(id => msgAdmin_hayNoLeidos(id))
        .map(id => {
            const s = socios.find(x => String(x.id) === String(id));
            const r = msgAdminPorSocio[String(id)];
            return {
                id,
                nombre: s ? `${s.nombre} ${s.apellido}` : ('Socio ' + id),
                fotoUrl: s ? s.fotoUrl : '',
                texto: (r && r.ultimoTexto) || '',
                ts: (r && r.ultimaSocioTs) || 0
            };
        })
        .sort((a, b) => b.ts - a.ts);
}

function msgAdminBell_render() {
    const badge = document.getElementById('msgAdminBellBadge');
    const menu  = document.getElementById('msgAdminBellMenu');
    const items = msgAdminBell_items();
    if (badge) {
        if (items.length) { badge.textContent = items.length > 99 ? '99+' : String(items.length); badge.style.display = 'block'; }
        else badge.style.display = 'none';
    }
    if (menu && menu.style.display !== 'none') msgAdminBell_pintarMenu(items);
}

function msgAdminBell_pintarMenu(items) {
    const menu = document.getElementById('msgAdminBellMenu');
    if (!menu) return;
    if (!items.length) {
        menu.innerHTML = '<div style="padding:18px 12px;text-align:center;color:#94a3b8;font-size:0.85em;">Sin mensajes nuevos 🎉</div>';
        return;
    }
    const _hora = ts => { try { return new Date(ts).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { return ''; } };
    menu.innerHTML = '<div style="padding:8px 10px 6px;font-weight:800;font-size:0.82em;color:var(--text-color,#1e293b);border-bottom:1px solid var(--border,#eef2f6);margin-bottom:4px;">🔔 Mensajes sin leer (' + items.length + ')</div>'
        + items.map(it => `<div onclick="msgAdminBell_ir('${_msgEsc(it.id)}')" style="display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:10px;cursor:pointer;margin-bottom:2px;" onmouseover="this.style.background='rgba(2,132,199,0.08)'" onmouseout="this.style.background='transparent'">
            ${avatarHTML(it.fotoUrl, it.nombre, 34)}
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.84em;color:var(--text-color,#1e293b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_msgEsc(it.nombre)}</div>
                <div style="font-size:0.75em;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_msgEsc(it.texto) || '<span style=\'color:#94a3b8\'>Nuevo mensaje</span>'}</div>
                <div style="font-size:0.66em;color:#94a3b8;">${_hora(it.ts)}</div>
            </div>
            <span style="background:#dc2626;color:#fff;font-size:0.6em;font-weight:800;padding:2px 6px;border-radius:8px;flex-shrink:0;">NUEVO</span>
        </div>`).join('');
}

function msgAdminBell_toggle() {
    const menu = document.getElementById('msgAdminBellMenu');
    if (!menu) return;
    if (menu.style.display === 'none' || !menu.style.display) {
        msgAdminBell_pintarMenu(msgAdminBell_items());
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

function msgAdminBell_cerrar() {
    const menu = document.getElementById('msgAdminBellMenu');
    if (menu) menu.style.display = 'none';
}

function msgAdminBell_ir(socioId) {
    msgAdminBell_cerrar();
    if (typeof switchTab === 'function') switchTab('mensajes');
    setTimeout(() => msgAdmin_abrir(socioId), 60);
}

// Cerrar el menú al tocar fuera de la campana
document.addEventListener('click', function (e) {
    const menu = document.getElementById('msgAdminBellMenu');
    const bell = document.getElementById('msgAdminBell');
    if (!menu || menu.style.display === 'none') return;
    if (bell && bell.contains(e.target)) return;
    if (menu.contains(e.target)) return;
    menu.style.display = 'none';
});

function msgAdmin_renderLista() {
    const cont = document.getElementById('msgAdmin-lista');
    if (!cont) return;
    const term = (document.getElementById('msgAdminBuscar')?.value || '').toLowerCase().trim();
    const socios = (typeof cacheSocios !== 'undefined' ? cacheSocios : [])
        .filter(s => {
            const full = `${s.nombre} ${s.apellido}`.toLowerCase();
            return !term || full.includes(term);
        })
        .sort((a, b) => {
            // Primero los que tienen respuestas sin leer, luego con conversación
            const ua = msgAdmin_hayNoLeidos(a.id) ? 1 : 0, ub = msgAdmin_hayNoLeidos(b.id) ? 1 : 0;
            if (ua !== ub) return ub - ua;
            const ca = msgAdminPorSocio[String(a.id)] ? 1 : 0, cb = msgAdminPorSocio[String(b.id)] ? 1 : 0;
            if (ca !== cb) return cb - ca;
            return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`);
        });

    if (!socios.length) { cont.innerHTML = '<div style="color:#94a3b8;font-size:0.85em;padding:12px;text-align:center;">Sin resultados</div>'; return; }

    cont.innerHTML = socios.map(s => {
        const activo = msgAdminSocioActual && String(msgAdminSocioActual.id) === String(s.id);
        const tieneConv = !!msgAdminPorSocio[String(s.id)];
        const noLeido = msgAdmin_hayNoLeidos(s.id);
        const badge = noLeido
            ? '<span style="background:#dc2626;color:white;font-size:0.62em;font-weight:800;padding:1px 6px;border-radius:8px;margin-left:5px;">NUEVO</span>'
            : (tieneConv ? '<span style="margin-left:5px;">💬</span>' : '');
        return `<div onclick="msgAdmin_abrir('${_msgEsc(s.id)}')" style="display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid ${activo ? '#0284c7' : '#eef2f6'};background:${activo ? '#e0f2fe' : 'white'};border-radius:10px;margin-bottom:6px;cursor:pointer;">
            ${avatarHTML(s.fotoUrl, s.nombre, 34)}
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.86em;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_msgEsc(s.nombre)} ${_msgEsc(s.apellido)}${badge}</div>
                <div style="font-size:0.72em;color:#94a3b8;">${_msgEsc((s.area || '').toUpperCase())}</div>
            </div>
        </div>`;
    }).join('');
}

function msgAdmin_abrir(socioId) {
    const s = (typeof cacheSocios !== 'undefined' ? cacheSocios : []).find(x => String(x.id) === String(socioId));
    if (!s) return;
    msgAdminSocioActual = { id: s.id, nombre: `${s.nombre} ${s.apellido}` };
    document.getElementById('msgAdmin-placeholder').style.display = 'none';
    document.getElementById('msgAdmin-conv').style.display = 'block';
    document.getElementById('msgAdmin-header').innerHTML = `<div style="display:flex;align-items:center;gap:9px;">${avatarHTML(s.fotoUrl, s.nombre, 30)}<span>${_msgEsc(msgAdminSocioActual.nombre)}</span></div>`;
    document.getElementById('msgAdmin-hilo').innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:0.85em;padding:20px;">Cargando…</div>';
    _msgAdminMarcarVisto(s.id);
    msgAdmin_actualizarNavDot();
    msgAdmin_renderLista();
    msgAdmin_cargarHilo();
    // Llevar a la conversación / campo de escribir (útil en móvil)
    setTimeout(() => {
        const conv = document.getElementById('msgAdmin-conv');
        if (conv && conv.scrollIntoView) conv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inp = document.getElementById('msgAdmin-input');
        if (inp) inp.focus();
    }, 150);
}

async function msgAdmin_cargarHilo() {
    if (!msgAdminSocioActual) return;
    const id = msgAdminSocioActual.id;
    try {
        const { data, error } = await dbSoc.from('mensajes_admin')
            .select('*').eq('socio_id', String(id))
            .neq('estado', 'DELETED').order('created_at', { ascending: true });
        if (error) { console.warn('[msgAdmin] hilo:', error.message); return; }
        if (!msgAdminSocioActual || String(msgAdminSocioActual.id) !== String(id)) return; // cambió de socio
        msgAdminHilo = data || [];
        _msgAdminMarcarVisto(id);
        msgAdmin_actualizarNavDot();
        msgAdmin_renderHilo();
    } catch (e) { console.warn('[msgAdmin]', e); }
}

function msgAdmin_renderHilo() {
    const cont = document.getElementById('msgAdmin-hilo');
    if (!cont) return;
    if (!msgAdminHilo.length) {
        cont.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:0.85em;padding:24px;">Aún no hay mensajes. Escribe el primero 👇</div>';
        return;
    }
    const _hora = ts => { try { return new Date(ts).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { return ''; } };
    cont.innerHTML = msgAdminHilo.map(m => {
        const esAdmin = m.remitente === 'ADMIN';
        const align = esAdmin ? 'flex-end' : 'flex-start';
        const bg = esAdmin ? '#0284c7' : 'white';
        const col = esAdmin ? 'white' : '#1e293b';
        const border = esAdmin ? 'none' : '1px solid #e2e8f0';
        const autor = esAdmin ? '' : `<div style="font-size:0.68em;font-weight:800;color:#0369a1;margin-bottom:2px;">${_msgEsc(m.autor || 'Socio')}</div>`;
        const fotoHtml = m.foto_url
            ? `<img src="${(m.foto_url + '').replace(/"/g, '%22')}" onclick="verFotoGrande('${(m.foto_url + '').replace(/'/g, '%27')}')" style="max-width:170px;max-height:190px;border-radius:9px;margin-top:${m.mensaje ? '5px' : '0'};object-fit:cover;cursor:zoom-in;display:block;">`
            : '';
        return `<div style="align-self:${align};max-width:80%;">
            <div style="background:${bg};color:${col};border:${border};border-radius:12px;padding:8px 11px;box-shadow:0 1px 2px rgba(0,0,0,0.08);">
                ${autor}
                ${m.mensaje ? `<div style="font-size:0.9em;line-height:1.4;word-break:break-word;white-space:pre-wrap;">${_msgEsc(m.mensaje)}</div>` : ''}
                ${fotoHtml}
                <div style="font-size:0.62em;color:${esAdmin ? 'rgba(255,255,255,0.75)' : '#94a3b8'};text-align:right;margin-top:3px;">${_hora(m.created_at)}</div>
            </div>
        </div>`;
    }).join('');
    cont.scrollTop = cont.scrollHeight;
}

let _msgAdminFotoFile = null;
function msgAdmin_fotoElegida(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { showToast('Debe ser una imagen', 'error'); return; }
    _msgAdminFotoFile = f;
    const prev = document.getElementById('msgAdmin-foto-preview');
    if (prev) {
        const u = URL.createObjectURL(f);
        prev.style.display = 'flex';
        prev.innerHTML = `<img src="${u}" style="width:34px;height:34px;border-radius:6px;object-fit:cover;">
            <span style="font-size:0.75em;color:#059669;font-weight:700;">foto lista</span>
            <button type="button" onclick="msgAdmin_fotoQuitar()" style="background:none;border:none;color:#ef4444;cursor:pointer;">✕</button>`;
    }
}
function msgAdmin_fotoQuitar() {
    _msgAdminFotoFile = null;
    const prev = document.getElementById('msgAdmin-foto-preview');
    if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
    ['msgAdmin-foto-cam', 'msgAdmin-foto-gal'].forEach(id => { const g = document.getElementById(id); if (g) g.value = ''; });
}

async function msgAdmin_enviar() {
    if (!msgAdminSocioActual) return;
    const input = document.getElementById('msgAdmin-input');
    const texto = (input.value || '').trim();
    if (!texto && !_msgAdminFotoFile) return;
    input.value = '';
    // Subir foto (opcional) al bucket público avatares (carpeta chat)
    let foto_url = '';
    if (_msgAdminFotoFile) {
        try {
            const ext = (_msgAdminFotoFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
            const path = 'chat/adm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext;
            const up = await dbSoc.storage.from('avatares').upload(path, _msgAdminFotoFile, { contentType: _msgAdminFotoFile.type, upsert: true });
            if (!up.error) foto_url = dbSoc.storage.from('avatares').getPublicUrl(path).data.publicUrl;
        } catch (eF) { console.warn('[msgAdmin] foto:', eF); }
        msgAdmin_fotoQuitar();
    }
    const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('MA-' + Date.now());
    const optim = { id, socio_id: String(msgAdminSocioActual.id), remitente: 'ADMIN', autor: 'Administración', mensaje: texto, foto_url, estado: 'ACTIVE', created_at: new Date().toISOString() };
    msgAdminHilo.push(optim);
    msgAdmin_renderHilo();
    try {
        const { error } = await dbSoc.from('mensajes_admin').insert({
            id, socio_id: String(msgAdminSocioActual.id), remitente: 'ADMIN', autor: 'Administración', mensaje: texto, foto_url: foto_url || null
        });
        if (error) { console.warn('[msgAdmin] enviar:', error.message); if (typeof showToast === 'function') showToast('No se pudo enviar', 'error'); }
        _msgAdminMarcarVisto(msgAdminSocioActual.id);
        msgAdmin_cargarResumen();
    } catch (e) { console.warn('[msgAdmin]', e); }
}

function msgAdmin_initRealtime() {
    if (_msgAdminRtListo) return;
    _msgAdminRtListo = true;
    try {
        dbSoc.channel('msg-admin-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_admin' }, (payload) => {
                msgAdmin_cargarResumen();
                if (msgAdminSocioActual) msgAdmin_cargarHilo();
                if (payload && payload.eventType === 'INSERT' && payload.new && String(payload.new.remitente || '').toUpperCase() !== 'ADMIN' && typeof notificarAdmin === 'function') {
                    const m = payload.new;
                    notificarAdmin('Mensaje de socio', (m.autor || 'Un socio') + ': ' + (m.mensaje || (m.foto_url ? '📷 Foto' : '')), 'info');
                }
            })
            .subscribe();
    } catch (e) { console.warn('[msgAdmin] realtime no disponible:', e); }
}
