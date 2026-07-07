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
        <div onclick="egresos_irASocio('${e.id}')" style="display:flex;align-items:center;gap:10px;background:white;border:1px solid #bae6fd;border-radius:9px;padding:9px 11px;cursor:pointer;transition:0.15s;" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='white'">
            <div style="width:30px;height:30px;border-radius:8px;background:#e0f2fe;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">💸</div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:0.85em;color:#075985;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escEgr(e.socio_nombre || 'Socio')}</div>
                <div style="font-size:0.72em;color:#0369a1;">Solicita ${fmt(e.monto)}${e.nota ? ' · ' + _escEgr(e.nota) : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:0.62em;color:#0ea5e9;">${_hora(e.created_at)}</div>
                <div style="font-size:0.72em;color:#0284c7;font-weight:800;">Procesar →</div>
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
    _egresoVinculado = null;
    const aviso = document.getElementById('egresoVinculadoAviso');
    if (aviso) { aviso.style.display = 'none'; aviso.innerHTML = ''; }
    try {
        await dbSoc.from('solicitudes_egreso')
            .update({ estado: 'PROCESADO', procesado_por: responsable || '', procesado_at: new Date().toISOString() })
            .eq('id', solId);
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
                () => egresos_cargarPendientes())
            .subscribe();
    } catch (e) { console.warn('[egresos] realtime no disponible:', e); }
}
