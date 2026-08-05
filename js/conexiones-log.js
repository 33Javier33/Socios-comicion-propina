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
