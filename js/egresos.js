// ============================================================
// EGRESOS PENDIENTES
// Solicitudes de egreso que los socios envían desde la app
// propi.solicitada. Se muestran como aviso en la sección
// "Anticipos y Ausencias" (tab gestion). Al pinchar un aviso se
// abre el socio con el monto pre-cargado para registrar el
// anticipo de propina. Al registrarlo, la solicitud pasa a
// PROCESADO.
// Fuente: tabla `solicitudes_egreso` (proyecto socios, dbSoc).
// ============================================================

let egresosPendientes = [];   // solicitudes con estado PENDIENTE
let egresosPorSocio   = {};   // socio_id -> monto total pendiente (para badge en la lista)
let _egresoVinculado  = null; // { id, socioId, monto } de la solicitud que se está procesando
let _egresosRtListo   = false;

function _escEgr(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function egresos_cargarPendientes() {
    try {
        const { data, error } = await dbSoc.from('solicitudes_egreso')
            .select('*').eq('estado', 'PENDIENTE')
            .order('created_at', { ascending: true });
        if (error) { console.warn('[egresos] error:', error.message); return; }
        egresosPendientes = data || [];
        egresosPorSocio = {};
        egresosPendientes.forEach(e => {
            const k = String(e.socio_id);
            egresosPorSocio[k] = (egresosPorSocio[k] || 0) + (Number(e.monto) || 0);
        });
        egresos_render();
    } catch (e) { console.warn('[egresos]', e); }
}

function egresos_render() {
    const box = document.getElementById('egresosPendientesBox');
    if (!box) return;
    if (!egresosPendientes.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

    const fmt = v => '$' + (Number(v) || 0).toLocaleString('es-CL');
    const _hora = ts => {
        try {
            return new Date(ts).toLocaleString('es-CL', {
                timeZone: 'America/Santiago', day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) { return ''; }
    };

    const filas = egresosPendientes.map(e => `
        <div style="background:white;border:1px solid #bae6fd;border-radius:9px;padding:9px 11px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:30px;height:30px;border-radius:8px;background:#e0f2fe;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">💸</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.85em;color:#075985;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escEgr(e.socio_nombre || 'Socio')}</div>
                    <div style="font-size:0.72em;color:#0369a1;">Solicita ${fmt(e.monto)}${e.nota ? ' · ' + _escEgr(e.nota) : ''}</div>
                </div>
                <div style="font-size:0.62em;color:#0ea5e9;flex-shrink:0;">${_hora(e.created_at)}</div>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <button onclick="egresos_irASocio('${e.id}')" style="flex:1;padding:7px;border:none;border-radius:7px;background:#0284c7;color:white;font-size:0.76em;font-weight:800;cursor:pointer;">✅ Procesar</button>
                <button onclick="egresos_rechazar('${e.id}')" style="flex:1;padding:7px;border:1px solid #fca5a5;border-radius:7px;background:white;color:#dc2626;font-size:0.76em;font-weight:800;cursor:pointer;">✖️ Rechazar</button>
            </div>
        </div>`).join('');

    box.innerHTML = `
        <div style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:12px;padding:12px 14px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
                <div style="color:white;font-weight:800;font-size:0.95em;">💸 Egresos pendientes
                    <span style="background:rgba(255,255,255,0.25);border-radius:10px;padding:1px 8px;font-size:0.82em;">${egresosPendientes.length}</span>
                </div>
                <div style="color:#e0f2fe;font-size:0.72em;">Toca uno para procesarlo como anticipo</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">${filas}</div>
        </div>`;
    box.style.display = 'block';
}

// Al pinchar un aviso: abrir el socio y pre-cargar el monto solicitado
function egresos_irASocio(solicitudId) {
    const e = egresosPendientes.find(x => x.id === solicitudId);
    if (!e) return;
    _egresoVinculado = { id: e.id, socioId: String(e.socio_id), monto: Number(e.monto) || 0 };

    if (typeof seleccionarSocio === 'function') seleccionarSocio(String(e.socio_id));

    setTimeout(() => {
        const campo = document.getElementById('montoAnticipo');
        if (campo) {
            campo.value = String(Number(e.monto) || 0);
            if (typeof formatearInputMonto === 'function') { try { formatearInputMonto(campo); } catch (_) {} }
        }
        egresos_pintarAvisoPanel(e);
        const panel = document.getElementById('panelDetalle');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Rechazar una solicitud: pide el motivo, marca RECHAZADO y notifica al socio
async function egresos_rechazar(solicitudId) {
    const e = egresosPendientes.find(x => x.id === solicitudId);
    if (!e) return;
    const fmt = v => '$' + (Number(v) || 0).toLocaleString('es-CL');
    const raw = prompt(`Rechazar el egreso de ${e.socio_nombre || 'socio'} (${fmt(e.monto)}).\n\nEscribe el motivo del rechazo (el socio lo verá como nota):`, '');
    if (raw === null) return;                 // canceló
    const motivo = raw.trim();
    if (!motivo) { if (typeof showToast === 'function') showToast('Debes indicar un motivo', 'warning'); return; }

    const resp = (typeof getSesionResponsableObj === 'function') ? getSesionResponsableObj() : {};
    const respTxt = (resp && resp.ini) ? (resp.ini + (resp.area ? ' ' + resp.area : '')) : 'ADM';

    try {
        await dbSoc.from('solicitudes_egreso').update({
            estado: 'RECHAZADO', motivo_rechazo: motivo,
            procesado_por: respTxt, procesado_at: new Date().toISOString()
        }).eq('id', solicitudId);

        // Notificar al socio como mensaje privado del administrador
        const mid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('MA-' + Date.now());
        await dbSoc.from('mensajes_admin').insert({
            id: mid, socio_id: String(e.socio_id), remitente: 'ADMIN', autor: 'Administración',
            mensaje: `❌ Egreso rechazado\nSolicitaste ${fmt(e.monto)}.\nMotivo: ${motivo}`
        });

        if (typeof showToast === 'function') showToast('Egreso rechazado — se notificó al socio', 'success');
    } catch (err) {
        console.warn('[egresos] rechazar:', err);
        if (typeof showToast === 'function') showToast('Error al rechazar el egreso', 'error');
    }
    // Si estaba vinculado en el panel, limpiar
    if (_egresoVinculado && _egresoVinculado.id === solicitudId) egresos_cancelarVinculo();
    egresos_cargarPendientes();
}

// Nota destacada dentro del panel del socio indicando la solicitud en curso
function egresos_pintarAvisoPanel(e) {
    const aviso = document.getElementById('egresoVinculadoAviso');
    if (!aviso) return;
    const fmt = v => '$' + (Number(v) || 0).toLocaleString('es-CL');
    aviso.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.1em;">💸</span>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:0.82em;color:#075985;">Procesando solicitud de egreso</div>
                <div style="font-size:0.75em;color:#0369a1;">El socio solicitó ${fmt(e.monto)}${e.nota ? ' · ' + _escEgr(e.nota) : ''}. Registra el anticipo para completarla.</div>
            </div>
            <button type="button" onclick="egresos_cancelarVinculo()" title="Cancelar" style="background:none;border:none;color:#0284c7;cursor:pointer;font-size:1em;">✕</button>
        </div>`;
    aviso.style.display = 'block';
}

function egresos_cancelarVinculo() {
    _egresoVinculado = null;
    const aviso = document.getElementById('egresoVinculadoAviso');
    if (aviso) { aviso.style.display = 'none'; aviso.innerHTML = ''; }
}

// Llamado desde confirmarDesgloseAnticipo() tras registrar un anticipo.
// Si había una solicitud vinculada a ese socio, se marca PROCESADO.
async function egresos_alRegistrarAnticipo(socioId, responsable) {
    if (!_egresoVinculado || String(_egresoVinculado.socioId) !== String(socioId)) return;
    const solId = _egresoVinculado.id;
    const montoSol = Number(_egresoVinculado.monto) || 0;
    _egresoVinculado = null;
    const aviso = document.getElementById('egresoVinculadoAviso');
    if (aviso) { aviso.style.display = 'none'; aviso.innerHTML = ''; }
    try {
        await dbSoc.from('solicitudes_egreso')
            .update({ estado: 'PROCESADO', procesado_por: responsable || '', procesado_at: new Date().toISOString() })
            .eq('id', solId);
        // Notificar al socio que su egreso fue procesado
        const mid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('MA-' + Date.now());
        await dbSoc.from('mensajes_admin').insert({
            id: mid, socio_id: String(socioId), remitente: 'ADMIN', autor: 'Administración',
            mensaje: `✅ Egreso procesado\nSe registró tu anticipo por $${montoSol.toLocaleString('es-CL')}.`
        });
    } catch (e) { console.warn('[egresos] no se pudo marcar procesado:', e); }
    egresos_cargarPendientes();
}

// Realtime: refrescar el aviso cuando llega/cambia una solicitud
function egresos_initRealtime() {
    if (_egresosRtListo) return;
    _egresosRtListo = true;
    try {
        dbSoc.channel('sv-egresos-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_egreso' },
                (payload) => {
                    egresos_cargarPendientes();
                    if (payload && payload.eventType === 'INSERT' && payload.new && typeof notificarAdmin === 'function') {
                        const s = payload.new;
                        notificarAdmin('Nueva solicitud de egreso', (s.socio_nombre || 'Un socio') + ' pidió ' + _fmtMoneyAdmin(s.monto), 'warning');
                    }
                })
            .subscribe();
    } catch (e) { console.warn('[egresos] realtime no disponible:', e); }
}
