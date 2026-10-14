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
// ── Fechas de los mensajes ────────────────────────────────────────────
// El hilo mostraba solo la hora, así que un mensaje de hace tres semanas
// decía «14:32» y no había forma de saber de cuándo era. Todo lo de acá
// trabaja en hora de Chile, igual que el resto de la app.
const _MSG_TZ = 'America/Santiago';

function _msgFechaObj(ts) {
    if (!ts) return null;
    let d = new Date(ts);
    // Algunos registros vienen como 'YYYY-MM-DD HH:MM:SS' (sin la T).
    if (isNaN(d.getTime())) d = new Date(String(ts).replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
}

// El día del mensaje como 'AAAA-MM-DD', para comparar días sin que el
// huso horario del equipo corra la fecha.
function _msgDiaKey(ts) {
    const d = _msgFechaObj(ts);
    if (!d) return '';
    try {
        const p = new Intl.DateTimeFormat('es-CL',
            { timeZone: _MSG_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
            .formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
        return p.year + '-' + p.month + '-' + p.day;
    } catch (e) {
        const n = x => String(x).padStart(2, '0');
        return d.getFullYear() + '-' + n(d.getMonth() + 1) + '-' + n(d.getDate());
    }
}

function _msgHora(ts) {
    const d = _msgFechaObj(ts);
    if (!d) return '';
    try { return d.toLocaleTimeString('es-CL', { timeZone: _MSG_TZ, hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch (e) { const n = x => String(x).padStart(2, '0'); return n(d.getHours()) + ':' + n(d.getMinutes()); }
}

// El separador entre días del hilo: «Hoy», «Ayer» o la fecha con su día
// de la semana. El año solo aparece cuando no es el actual — ponerlo
// siempre es ruido, y no ponerlo nunca confunde en enero.
function _msgDiaEtiqueta(ts) {
    const k = _msgDiaKey(ts);
    if (!k) return '';
    const hoy = _msgDiaKey(Date.now());
    if (k === hoy) return 'Hoy';
    if (k === _msgDiaKey(Date.now() - 86400000)) return 'Ayer';
    const d = _msgFechaObj(ts);
    const opt = { timeZone: _MSG_TZ, weekday: 'long', day: 'numeric', month: 'long' };
    if (k.slice(0, 4) !== hoy.slice(0, 4)) opt.year = 'numeric';
    try {
        const txt = d.toLocaleDateString('es-CL', opt);
        return txt.charAt(0).toUpperCase() + txt.slice(1);
    } catch (e) { return k.split('-').reverse().join('/'); }
}

// Para la lista de conversaciones, donde solo cabe una pincelada:
// la hora si es de hoy, «Ayer», o la fecha corta.
function _msgFechaCorta(ts) {
    const k = _msgDiaKey(ts);
    if (!k) return '';
    const hoy = _msgDiaKey(Date.now());
    if (k === hoy) return _msgHora(ts);
    if (k === _msgDiaKey(Date.now() - 86400000)) return 'Ayer';
    const [a, m, dd] = k.split('-');
    return (a === hoy.slice(0, 4)) ? (dd + '/' + m) : (dd + '/' + m + '/' + a.slice(2));
}

// La fecha completa, para el `title`: siempre se puede confirmar el dato
// exacto dejando el cursor encima.
function _msgFechaLarga(ts) {
    const d = _msgFechaObj(ts);
    if (!d) return '';
    try {
        return d.toLocaleString('es-CL', { timeZone: _MSG_TZ, weekday: 'long',
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { return String(ts); }
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
            if (!msgAdminPorSocio[k]) msgAdminPorSocio[k] = { total: 0, ultimaSocioTs: 0, ultimoTexto: '', ultimoAutor: '', ultimoTs: 0 };
            msgAdminPorSocio[k].total++;
            // Cuándo se movió la conversación por última vez, la haya movido
            // el socio o la administración: es lo que va en la lista.
            const tsAny = new Date(String(m.created_at || '').replace(' ', 'T')).getTime();
            if (tsAny && tsAny > msgAdminPorSocio[k].ultimoTs) msgAdminPorSocio[k].ultimoTs = tsAny;
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

// ── CENTRO DE NOTIFICACIONES (campana) ────────────────────────────────────
// Agrega: mensajes de socios sin leer + egresos pendientes + días Part-Time
// por confirmar. Cada ítem lleva al lugar donde se resuelve.
function _bellMoney(v) {
    if (typeof _fmtMoneyAdmin === 'function') return _fmtMoneyAdmin(v);
    return '$' + (Number(v) || 0).toLocaleString('es-CL');
}
function _bellFecha(f) {
    try { return new Date(String(f).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }); }
    catch (e) { return String(f || ''); }
}
// Recaudaciones "vistas": marca de tiempo del último visto (las nuevas aparecen en la campana)
function _recBellSeen() { return parseInt(localStorage.getItem('_rec_bell_seen')) || 0; }
function _recBellMarcarVisto() {
    const raw = (typeof recDatosRaw !== 'undefined' ? recDatosRaw : []);
    let maxTs = _recBellSeen();
    raw.forEach(r => { const ts = r.created_at ? new Date(r.created_at).getTime() : 0; if (ts > maxTs) maxTs = ts; });
    localStorage.setItem('_rec_bell_seen', String(maxTs || Date.now()));
}
function msgAdminBell_items() {
    const socios = (typeof cacheSocios !== 'undefined' ? cacheSocios : []);
    const out = [];

    // 1) Mensajes de socios sin leer
    Object.keys(msgAdminPorSocio)
        .filter(id => msgAdmin_hayNoLeidos(id))
        .forEach(id => {
            const s = socios.find(x => String(x.id) === String(id));
            const r = msgAdminPorSocio[String(id)];
            out.push({
                tipo: 'msg', id, socioId: id,
                icono: '💬',
                nombre: s ? `${s.nombre} ${s.apellido}` : ('Socio ' + id),
                fotoUrl: s ? s.fotoUrl : '',
                texto: (r && r.ultimoTexto) || 'Nuevo mensaje',
                ts: (r && r.ultimaSocioTs) || 0
            });
        });

    // 2) Egresos pendientes (solicitudes desde propi.solicitada)
    (typeof egresosPendientes !== 'undefined' ? egresosPendientes : []).forEach(e => {
        out.push({
            tipo: 'egreso', id: String(e.id), socioId: String(e.socio_id),
            icono: '💸',
            nombre: e.socio_nombre || 'Socio',
            fotoUrl: '',
            texto: 'Solicita ' + _bellMoney(e.monto) + (e.nota ? ' · ' + e.nota : ''),
            ts: (e.created_at ? new Date(e.created_at).getTime() : 0) || 0
        });
    });

    // 3) Días Part-Time por confirmar
    (typeof ptDiasPendientes !== 'undefined' ? ptDiasPendientes : []).forEach(d => {
        out.push({
            tipo: 'pt', id: String(d.id), socioId: String(d.socio_id),
            icono: '🕒',
            nombre: d.socio_nombre || 'Socio Part-Time',
            fotoUrl: '',
            texto: 'Día ' + _bellFecha(d.fecha) + ' por confirmar · ~ ' + _bellMoney(d.valor_estimado),
            ts: (d.created_at ? new Date(d.created_at).getTime() : 0) || 0
        });
    });

    // 4) Recaudaciones nuevas (cada entrada con su divisor). Se marcan vistas al
    //    abrir la campana, para que no se acumulen. Tope de 30 para no atochar.
    const seen = _recBellSeen();
    (typeof recDatosRaw !== 'undefined' ? recDatosRaw : [])
        .filter(r => r && r.created_at && new Date(r.created_at).getTime() > seen)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30)
        .forEach(r => {
            const div = (r.divisor !== null && r.divisor !== undefined) ? r.divisor : '—';
            const quien = r.registrado_por_nombre ? ' · ' + r.registrado_por_nombre : '';
            out.push({
                tipo: 'rec', id: String(r.originalIndex || ''), socioId: '',
                icono: '📊',
                nombre: 'Recaudación ' + _bellFecha(r.fecha),
                fotoUrl: '',
                texto: (r.tipo || 'Sin tipo') + ': ' + _bellMoney(r.monto) + ' · Divisor: ' + div + quien,
                ts: new Date(r.created_at).getTime()
            });
        });

    // 5) Actividad de socios (conexión a la app / entrada a Recaudación del Día)
    const _cvisto = (typeof _conexSeen === 'function') ? _conexSeen() : 0;
    (typeof conexionesLog !== 'undefined' ? conexionesLog : [])
        .filter(c => c && c.created_at && new Date(c.created_at).getTime() > _cvisto)
        .slice(0, 20)
        .forEach(c => {
            const s2 = socios.find(x => String(x.id) === String(c.socio_id));
            out.push({
                tipo: 'conexion', id: String(c.id || ''), socioId: String(c.socio_id || ''),
                icono: c.evento === 'recaudacion' ? '📊' : '🟢',
                nombre: c.nombre || (s2 ? (s2.nombre + ' ' + s2.apellido) : 'Socio'),
                fotoUrl: s2 ? s2.fotoUrl : '',
                texto: (typeof _conexTexto === 'function') ? _conexTexto(c) : 'Actividad',
                ts: new Date(c.created_at).getTime()
            });
        });

    return out.sort((a, b) => b.ts - a.ts);
}

function msgAdminBell_render() {
    const badge = document.getElementById('msgAdminBellBadge');
    const items = msgAdminBell_items();
    if (badge) {
        if (items.length) { badge.textContent = items.length > 99 ? '99+' : String(items.length); badge.style.display = 'block'; }
        else badge.style.display = 'none';
    }
    // Importante: si la campana está ABIERTA, NO se re-pinta el menú. El encargado
    // lo está mirando y las notificaciones no deben desaparecer solas. La lista se
    // congela hasta que cierre la campana (o toque afuera) y se refresca al reabrir.
}

function msgAdminBell_pintarMenu(items) {
    const menu = document.getElementById('msgAdminBellMenu');
    if (!menu) return;
    if (!items.length) {
        menu.innerHTML = '<div style="padding:18px 12px;text-align:center;color:#94a3b8;font-size:0.85em;">Sin novedades 🎉</div>';
        return;
    }
    const _hora = ts => {
        if (!ts) return '';
        let d = new Date(ts);
        if (isNaN(d.getTime())) d = new Date(String(ts).replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        const opt = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        try { return d.toLocaleString('es-CL', Object.assign({ timeZone: 'America/Santiago' }, opt)); }
        catch (e) {
            try { return d.toLocaleString('es-CL', opt); }
            catch (e2) { const p = n => String(n).padStart(2, '0'); return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
        }
    };
    const _etiqueta = { msg: 'MENSAJE', egreso: 'EGRESO', pt: 'DÍA PT', rec: 'RECAUDACIÓN', conexion: 'ACTIVIDAD' };
    const _colorEt = { msg: '#0284c7', egreso: '#0ea5e9', pt: '#d97706', rec: '#059669', conexion: '#10b981' };
    menu.innerHTML = '<div style="padding:8px 10px 6px;font-weight:800;font-size:0.82em;color:var(--text-color,#1e293b);border-bottom:1px solid var(--border,#eef2f6);margin-bottom:4px;">🔔 Notificaciones (' + items.length + ')</div>'
        + items.map(it => {
            const avatar = it.tipo === 'msg'
                ? avatarHTML(it.fotoUrl, it.nombre, 34)
                : `<div style="width:34px;height:34px;border-radius:9px;background:rgba(2,132,199,0.10);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">${it.icono}</div>`;
            return `<div onclick="msgAdminBell_ir('${it.tipo}','${_msgEsc(it.id)}','${_msgEsc(it.socioId)}')" style="display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:10px;cursor:pointer;margin-bottom:2px;" onmouseover="this.style.background='rgba(2,132,199,0.08)'" onmouseout="this.style.background='transparent'">
            ${avatar}
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.84em;color:var(--text-color,#1e293b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_msgEsc(it.nombre)}</div>
                <div style="font-size:0.75em;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_msgEsc(it.texto)}</div>
                <div style="font-size:0.66em;color:#94a3b8;">${_hora(it.ts)}</div>
            </div>
            <span style="background:${_colorEt[it.tipo] || '#dc2626'};color:#fff;font-size:0.58em;font-weight:800;padding:2px 6px;border-radius:8px;flex-shrink:0;">${_etiqueta[it.tipo] || 'NUEVO'}</span>
        </div>`;
        }).join('');
}

function msgAdminBell_toggle() {
    const menu = document.getElementById('msgAdminBellMenu');
    if (!menu) return;
    if (menu.style.display === 'none' || !menu.style.display) {
        // Abrir: pintar la lista y dejarla FIJA (no se marca nada ni se re-pinta).
        msgAdminBell_pintarMenu(msgAdminBell_items());
        menu.style.display = 'block';
    } else {
        msgAdminBell_cerrar();
    }
}

// Cerrar la campana (por botón, al tocar afuera o al ir a una notificación):
// recién aquí las recaudaciones informativas quedan "vistas" y se refresca el badge.
function msgAdminBell_cerrar() {
    const menu = document.getElementById('msgAdminBellMenu');
    const estabaAbierta = menu && menu.style.display && menu.style.display !== 'none';
    if (menu) menu.style.display = 'none';
    if (estabaAbierta) {
        try { _recBellMarcarVisto(); } catch (e) {}
        try { if (typeof conexionesLog_marcarVisto === 'function') conexionesLog_marcarVisto(); } catch (e) {}
        msgAdminBell_render();
    }
}

function msgAdminBell_ir(tipo, id, socioId) {
    // Compatibilidad: si llega un solo argumento, es un mensaje (firma antigua)
    if (arguments.length === 1) { socioId = tipo; tipo = 'msg'; id = socioId; }
    msgAdminBell_cerrar();
    if (tipo === 'msg') {
        if (typeof switchTab === 'function') switchTab('mensajes');
        setTimeout(() => msgAdmin_abrir(id), 80);
        return;
    }
    if (tipo === 'rec') {
        if (typeof switchTab === 'function') switchTab('recaudacion');
        return;
    }
    // Actividad de socios: abrir la ficha del socio (si se puede identificar)
    if (tipo === 'conexion') {
        if (typeof switchTab === 'function') switchTab('registro');
        if (socioId && typeof seleccionarSocio === 'function') setTimeout(() => seleccionarSocio(socioId), 120);
        return;
    }
    // Egresos y días PT se resuelven en la pestaña "Anticipos y Ausencias"
    if (typeof switchTab === 'function') switchTab('gestion');
    setTimeout(() => {
        if (tipo === 'pt' && typeof ptdias_irASocio === 'function' && socioId) { ptdias_irASocio(socioId); return; }
        if (tipo === 'egreso' && typeof egresos_irASocio === 'function' && id) { egresos_irASocio(id); return; }
        const boxId = tipo === 'pt' ? 'ptDiasPendientesBox' : 'egresosPendientesBox';
        const b = document.getElementById(boxId);
        if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 140);
}

// Cerrar el menú al tocar fuera de la campana
document.addEventListener('click', function (e) {
    const menu = document.getElementById('msgAdminBellMenu');
    const bell = document.getElementById('msgAdminBell');
    if (!menu || menu.style.display === 'none') return;
    if (bell && bell.contains(e.target)) return;
    if (menu.contains(e.target)) return;
    msgAdminBell_cerrar();
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
            const ra = msgAdminPorSocio[String(a.id)], rb = msgAdminPorSocio[String(b.id)];
            const ca = ra ? 1 : 0, cb = rb ? 1 : 0;
            if (ca !== cb) return cb - ca;
            // Entre los que conversan, el más reciente arriba: buscar a alguien
            // en una lista alfabética de 60 socios es justamente lo que costaba.
            if (ra && rb && ra.ultimoTs !== rb.ultimoTs) return rb.ultimoTs - ra.ultimoTs;
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
        // Cuándo fue lo último de esta conversación. Sin esto había que
        // abrir socio por socio para saber cuál se movió.
        const res = msgAdminPorSocio[String(s.id)];
        const cuando = (res && res.ultimoTs)
            ? `<div class="msg-lista-fecha${noLeido ? ' nuevo' : ''}" title="Último mensaje: ${_msgEsc(_msgFechaLarga(res.ultimoTs))}">${_msgEsc(_msgFechaCorta(res.ultimoTs))}</div>`
            : '';
        return `<div onclick="msgAdmin_abrir('${_msgEsc(s.id)}')" style="display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid ${activo ? '#0284c7' : '#eef2f6'};background:${activo ? '#e0f2fe' : 'white'};border-radius:10px;margin-bottom:6px;cursor:pointer;">
            ${avatarHTML(s.fotoUrl, s.nombre, 34)}
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.86em;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_msgEsc(s.nombre)} ${_msgEsc(s.apellido)}${badge}</div>
                <div style="font-size:0.72em;color:#94a3b8;">${_msgEsc((s.area || '').toUpperCase())}</div>
            </div>
            ${cuando}
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
    // Un separador cada vez que cambia el día. Sin esto, la hora sola no
    // dice nada: «14:32» puede ser de hoy o del mes pasado.
    let diaPrevio = '';
    cont.innerHTML = msgAdminHilo.map(m => {
        const dia = _msgDiaKey(m.created_at);
        let sep = '';
        if (dia && dia !== diaPrevio) {
            diaPrevio = dia;
            sep = `<div class="msg-dia-sep" title="${_msgEsc(_msgFechaLarga(m.created_at))}">`
                + `<span>${_msgEsc(_msgDiaEtiqueta(m.created_at))}</span></div>`;
        }
        const esAdmin = m.remitente === 'ADMIN';
        const align = esAdmin ? 'flex-end' : 'flex-start';
        const bg = esAdmin ? '#0284c7' : 'white';
        const col = esAdmin ? 'white' : '#1e293b';
        const border = esAdmin ? 'none' : '1px solid #e2e8f0';
        const autor = esAdmin ? '' : `<div style="font-size:0.68em;font-weight:800;color:#0369a1;margin-bottom:2px;">${_msgEsc(m.autor || 'Socio')}</div>`;
        const fotoHtml = m.foto_url
            ? `<img src="${(m.foto_url + '').replace(/"/g, '%22')}" onclick="verFotoGrande('${(m.foto_url + '').replace(/'/g, '%27')}')" style="max-width:170px;max-height:190px;border-radius:9px;margin-top:${m.mensaje ? '5px' : '0'};object-fit:cover;cursor:zoom-in;display:block;">`
            : '';
        return `${sep}<div style="align-self:${align};max-width:80%;">
            <div style="background:${bg};color:${col};border:${border};border-radius:12px;padding:8px 11px;box-shadow:0 1px 2px rgba(0,0,0,0.08);">
                ${autor}
                ${m.mensaje ? `<div style="font-size:0.9em;line-height:1.4;word-break:break-word;white-space:pre-wrap;">${_msgEsc(m.mensaje)}</div>` : ''}
                ${fotoHtml}
                <div title="${_msgEsc(_msgFechaLarga(m.created_at))}" style="font-size:0.62em;color:${esAdmin ? 'rgba(255,255,255,0.75)' : '#94a3b8'};text-align:right;margin-top:3px;cursor:default;">${_msgEsc(_msgHora(m.created_at))}</div>
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
