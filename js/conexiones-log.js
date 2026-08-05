// ============================================================
// REGISTRO DE ACTIVIDAD DE SOCIOS (estilo Telegram)
// Muestra, con fecha y hora, cuándo un socio se conecta a propi.solicitada
// y cuándo entra a "Recaudación del Día" dentro de su app.
// Fuente: tabla `conexiones_log` (proyecto socios, dbSoc).
// Se integra al centro de notificaciones (campana) como tipo 'conexion'.
// ============================================================

let conexionesLog = [];          // eventos recientes (más nuevo primero)
let _conexRtListo = false;

// Marca de "visto": los eventos anteriores a esta fecha no cuentan como nuevos.
function _conexSeen() { return parseInt(localStorage.getItem('_conex_seen')) || 0; }
function conexionesLog_marcarVisto() {
    let max = _conexSeen();
    conexionesLog.forEach(c => {
        const t = c.created_at ? new Date(c.created_at).getTime() : 0;
        if (t > max) max = t;
    });
    localStorage.setItem('_conex_seen', String(max || Date.now()));
}

// Texto legible del evento
function _conexTexto(c) {
    const donde = c.app ? (' · ' + c.app) : '';
    if (c.evento === 'recaudacion') return 'Entró a Recaudación del Día' + donde;
    if (c.evento === 'desconectado') return 'Cerró sesión' + donde;
    return 'Se conectó a la app' + donde + (c.detalle ? ' · ' + c.detalle : '');
}

// Carga los eventos de las últimas 24 h (tope 40 para no atochar)
async function conexionesLog_cargar() {
    try {
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await dbSoc.from('conexiones_log')
            .select('id, socio_id, nombre, evento, app, detalle, created_at')
            .gt('created_at', desde)
            .order('created_at', { ascending: false })
            .limit(40);
        if (error) { console.warn('[conexiones]', error.message); return; }
        conexionesLog = data || [];
        conexionesLog_render();
        if (typeof msgAdminBell_render === 'function') msgAdminBell_render();
    } catch (e) { console.warn('[conexiones]', e); }
}

// Realtime: cuando llega un evento nuevo, refrescar y avisar al administrador
function conexionesLog_initRealtime() {
    if (_conexRtListo) return;
    _conexRtListo = true;
    try {
        dbSoc.channel('conexiones-log-rt')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conexiones_log' }, (payload) => {
                const c = payload && payload.new;
                if (!c) return;
                conexionesLog.unshift(c);
                if (conexionesLog.length > 40) conexionesLog.pop();
                conexionesLog_render();
                if (typeof msgAdminBell_render === 'function') msgAdminBell_render();
                if (typeof notificarAdmin === 'function') {
                    const titulo = c.evento === 'recaudacion' ? 'Socio en Recaudación del Día' : 'Socio conectado';
                    notificarAdmin(titulo, (c.nombre || 'Un socio'), 'info');
                }
            })
            .subscribe();
    } catch (e) { console.warn('[conexiones] realtime no disponible:', e); }
}

// Limpieza oportunista: borrar eventos de más de 7 días (mantiene la tabla liviana)
function conexionesLog_limpiarViejos() {
    try {
        if (Math.random() > 0.15) return;
        const limite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        dbSoc.from('conexiones_log').delete().lt('created_at', limite).then(() => {}, () => {});
    } catch (e) {}
}

// ── Tarjeta fija de actividad reciente (visible en todas las secciones) ──
function _conexHora(ts) {
    if (!ts) return '';
    let d = new Date(ts);
    if (isNaN(d.getTime())) d = new Date(String(ts).replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    const opt = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    try { return d.toLocaleString('es-CL', Object.assign({ timeZone: 'America/Santiago' }, opt)); }
    catch (e) {
        try { return d.toLocaleString('es-CL', opt); }
        catch (e2) { const p2 = n => String(n).padStart(2, '0'); return p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
    }
}
function _conexEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}
function conexionesLog_render() {
    const el = document.getElementById('actividadCard');
    if (!el) return;
    const items = (conexionesLog || []).slice(0, 6);
    if (!items.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
    const filas = items.map(c => {
        const ico = c.evento === 'recaudacion' ? '📊' : (c.evento === 'desconectado' ? '⚪' : '🟢');
        const col = c.evento === 'recaudacion' ? '#0284c7' : (c.evento === 'desconectado' ? '#94a3b8' : '#10b981');
        return '<div style="display:flex;align-items:center;gap:8px;min-width:0;">'
            + '<span style="flex-shrink:0;font-size:0.9em;">' + ico + '</span>'
            + '<span style="min-width:0;flex:1;font-size:0.8em;color:var(--text-color,#1e293b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
            +   '<b>' + _conexEsc(c.nombre || 'Socio') + '</b>'
            +   '<span style="color:#64748b;"> · ' + _conexEsc(_conexTexto(c)) + '</span>'
            + '</span>'
            + '<span style="flex-shrink:0;font-size:0.68em;color:' + col + ';font-weight:700;">' + _conexHora(c.created_at) + '</span>'
            + '</div>';
    }).join('');
    el.style.cssText = 'background:var(--card-bg,#fff);border:1px solid var(--border,#e2e8f0);'
        + 'border-left:4px solid #0284c7;border-radius:12px;padding:10px 14px;margin-bottom:16px;'
        + 'box-shadow:0 2px 8px rgba(0,0,0,0.05);display:block;';
    el.innerHTML = '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#0284c7;margin-bottom:6px;">'
        + '🕘 Actividad reciente</div>'
        + '<div style="display:flex;flex-direction:column;gap:5px;">' + filas + '</div>';
}
