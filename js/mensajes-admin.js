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
            .select('socio_id, remitente, created_at, estado');
        if (error) { console.warn('[msgAdmin] resumen:', error.message); return; }
        msgAdminPorSocio = {};
        (data || []).forEach(m => {
            if (m.estado === 'DELETED') return;
            const k = String(m.socio_id);
            if (!msgAdminPorSocio[k]) msgAdminPorSocio[k] = { total: 0, ultimaSocioTs: 0 };
            msgAdminPorSocio[k].total++;
            if (m.remitente === 'SOCIO') {
                const ts = new Date(m.created_at).getTime();
                if (ts > msgAdminPorSocio[k].ultimaSocioTs) msgAdminPorSocio[k].ultimaSocioTs = ts;
            }
        });
        msgAdmin_actualizarNavDot();
        msgAdmin_renderLista();
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
}

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
            <div style="width:32px;height:32px;border-radius:50%;background:#0284c7;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;flex-shrink:0;">${_msgEsc((s.nombre || '?').charAt(0))}</div>
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
    document.getElementById('msgAdmin-header').textContent = msgAdminSocioActual.nombre;
    document.getElementById('msgAdmin-hilo').innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:0.85em;padding:20px;">Cargando…</div>';
    _msgAdminMarcarVisto(s.id);
    msgAdmin_actualizarNavDot();
    msgAdmin_renderLista();
    msgAdmin_cargarHilo();
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
        return `<div style="align-self:${align};max-width:80%;">
            <div style="background:${bg};color:${col};border:${border};border-radius:12px;padding:8px 11px;box-shadow:0 1px 2px rgba(0,0,0,0.08);">
                ${autor}
                <div style="font-size:0.9em;line-height:1.4;word-break:break-word;white-space:pre-wrap;">${_msgEsc(m.mensaje)}</div>
                <div style="font-size:0.62em;color:${esAdmin ? 'rgba(255,255,255,0.75)' : '#94a3b8'};text-align:right;margin-top:3px;">${_hora(m.created_at)}</div>
            </div>
        </div>`;
    }).join('');
    cont.scrollTop = cont.scrollHeight;
}

async function msgAdmin_enviar() {
    if (!msgAdminSocioActual) return;
    const input = document.getElementById('msgAdmin-input');
    const texto = (input.value || '').trim();
    if (!texto) return;
    input.value = '';
    const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('MA-' + Date.now());
    const optim = { id, socio_id: String(msgAdminSocioActual.id), remitente: 'ADMIN', autor: 'Administración', mensaje: texto, estado: 'ACTIVE', created_at: new Date().toISOString() };
    msgAdminHilo.push(optim);
    msgAdmin_renderHilo();
    try {
        const { error } = await dbSoc.from('mensajes_admin').insert({
            id, socio_id: String(msgAdminSocioActual.id), remitente: 'ADMIN', autor: 'Administración', mensaje: texto
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_admin' }, () => {
                msgAdmin_cargarResumen();
                if (msgAdminSocioActual) msgAdmin_cargarHilo();
            })
            .subscribe();
    } catch (e) { console.warn('[msgAdmin] realtime no disponible:', e); }
}
