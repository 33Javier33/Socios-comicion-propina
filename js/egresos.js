// ============================================================
// ANTICIPOS REGISTRADOS POR LOS SOCIOS (antes "egresos")
// El socio registra desde propi.solicitada el anticipo que le
// entregó el encargado ("Registro de Anticipo"). En SU app el
// monto se descuenta del balance de inmediato. Acá aparece como
// aviso en "Anticipos y Ausencias" para confirmarlo: al pinchar
// se abre el socio con el monto pre-cargado, y al registrar el
// anticipo la solicitud pasa a PROCESADO. Si se rechaza, el
// monto vuelve al balance del socio.
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
        if (typeof msgAdminBell_render === 'function') msgAdminBell_render();
    } catch (e) { console.warn('[egresos]', e); }
}

// Desglose de billetes que el socio declaró haber recibido ({20000:3, ...}).
// Muestra el detalle y avisa si la suma no cuadra con el monto solicitado.
function _egrDesglose(billetes, monto) {
    if (!billetes || typeof billetes !== 'object') return '';
    const claves = Object.keys(billetes).filter(d => Number(billetes[d]) > 0);
    if (!claves.length) return '';
    claves.sort((a, b) => Number(b) - Number(a));
    const fmtD = v => '$' + Number(v).toLocaleString('es-CL');
    let suma = 0;
    const partes = claves.map(d => { suma += Number(d) * Number(billetes[d]); return Number(billetes[d]) + '×' + fmtD(d); });
    const cuadra = !monto || suma === Number(monto);
    return '<div style="font-size:0.68em;color:#0f766e;margin-top:1px;">💵 ' + _escEgr(partes.join(' · '))
        + ' <b>= ' + fmtD(suma) + '</b>'
        + (cuadra ? '' : ' <span style="color:#b45309;font-weight:700;">(no cuadra con lo solicitado)</span>')
        + '</div>';
}

function egresos_render() {
    const box = document.getElementById('egresosPendientesBox');
    if (!box) return;
    if (!egresosPendientes.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

    const fmt = v => '$' + (Number(v) || 0).toLocaleString('es-CL');
    // Formateo ROBUSTO de la fecha/hora de la solicitud. Antes usaba
    // toLocaleString con timeZone, que en algunos dispositivos lanza error y
    // dejaba la fecha en blanco. Ahora: parsea con tolerancia (formato con
    // espacio de Safari) y tiene respaldo manual si Intl falla.
    const _hora = ts => {
        if (!ts) return '';
        let d = new Date(ts);
        if (isNaN(d.getTime())) d = new Date(String(ts).replace(' ', 'T'));
        if (isNaN(d.getTime())) return '';
        const opt = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        try { return d.toLocaleString('es-CL', Object.assign({ timeZone: 'America/Santiago' }, opt)); }
        catch (e) {
            try { return d.toLocaleString('es-CL', opt); }
            catch (e2) {
                const p = n => String(n).padStart(2, '0');
                return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
            }
        }
    };

    const filas = egresosPendientes.map(e => `
        <div style="background:white;border:1px solid #bae6fd;border-radius:9px;padding:9px 11px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:30px;height:30px;border-radius:8px;background:#e0f2fe;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">💸</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.85em;color:#075985;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escEgr(e.socio_nombre || 'Socio')}</div>
                    <div style="font-size:0.72em;color:#0369a1;">Registró ${fmt(e.monto)}${e.nota ? ' · ' + _escEgr(e.nota) : ''}</div>
                    ${e.encargado ? `<div style="font-size:0.7em;color:#7c3aed;font-weight:700;margin-top:1px;">👤 Entregado por: ${_escEgr(e.encargado)}</div>` : ''}
                    ${_egrDesglose(e.billetes, e.monto)}
                    <div style="font-size:0.7em;color:#0284c7;margin-top:2px;">📅 ${_hora(e.created_at) || 'Sin fecha'}</div>
                </div>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <button onclick="egresos_irASocio('${e.id}')" style="flex:1;padding:7px;border:none;border-radius:7px;background:#0284c7;color:white;font-size:0.76em;font-weight:800;cursor:pointer;">✅ Confirmar</button>
                <button onclick="egresos_rechazar('${e.id}')" style="flex:1;padding:7px;border:1px solid #fca5a5;border-radius:7px;background:white;color:#dc2626;font-size:0.76em;font-weight:800;cursor:pointer;">✖️ Rechazar</button>
            </div>
        </div>`).join('');

    box.innerHTML = `
        <div style="background:linear-gradient(135deg,#0ea5e9,#0284c7);border-radius:12px;padding:12px 14px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
                <div style="color:white;font-weight:800;font-size:0.95em;">💸 Anticipos registrados por socios
                    <span style="background:rgba(255,255,255,0.25);border-radius:10px;padding:1px 8px;font-size:0.82em;">${egresosPendientes.length}</span>
                </div>
                <div style="color:#e0f2fe;font-size:0.72em;">Ya descontados en la app del socio · confírmalos registrando el anticipo</div>
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
        // La tarjeta del anticipo viene minimizada: acá se abre sola, porque
        // el monto queda pre-cargado y si no el aviso parecería no hacer nada.
        if (typeof panelPlegable_toggle === 'function') panelPlegable_toggle('cardAnticipo', true);
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
    const raw = prompt(`Rechazar el anticipo que registró ${e.socio_nombre || 'el socio'} (${fmt(e.monto)}).\n\nAl rechazarlo, el monto vuelve al balance del socio en su app.\n\nEscribe el motivo del rechazo (el socio lo verá como nota):`, '');
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
            mensaje: `❌ Anticipo rechazado\nRegistraste ${fmt(e.monto)}; el monto volvió a tu balance.\nMotivo: ${motivo}`
        });

        if (typeof showToast === 'function') showToast('Anticipo rechazado — se notificó al socio', 'success');
    } catch (err) {
        console.warn('[egresos] rechazar:', err);
        if (typeof showToast === 'function') showToast('Error al rechazar el anticipo', 'error');
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
                <div style="font-weight:800;font-size:0.82em;color:#075985;">Confirmando anticipo registrado por el socio</div>
                <div style="font-size:0.75em;color:#0369a1;">El socio registró ${fmt(e.monto)}${e.nota ? ' · ' + _escEgr(e.nota) : ''} (ya descontado en su app). Registra el anticipo para confirmarlo.</div>
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
//
// El socio ya ve descontado en su app el anticipo que registró. Cuando acá se
// registra el anticipo real, la solicitud TIENE que pasar a PROCESADO: si
// quedara PENDIENTE, la app del socio descontaría el monto dos veces (la
// solicitud y el anticipo).
//
// Antes solo se cerraba si el encargado había entrado desde el aviso. Ahora,
// sin una vinculada, se miran los registros pendientes del socio: el de igual
// monto se cierra solo; si ningún monto coincide, se pregunta.
async function egresos_alRegistrarAnticipo(socioId, responsable, montoReg) {
    const sid = String(socioId);
    const fmt = v => '$' + (Number(v) || 0).toLocaleString('es-CL');
    const m = Number(montoReg) || 0;
    let sol = null;

    if (_egresoVinculado && String(_egresoVinculado.socioId) === sid) {
        sol = { id: _egresoVinculado.id, monto: Number(_egresoVinculado.monto) || 0 };
    } else {
        let pend = [];
        try {
            const { data } = await dbSoc.from('solicitudes_egreso')
                .select('id, monto, created_at')
                .eq('socio_id', sid).eq('estado', 'PENDIENTE')
                .order('created_at', { ascending: true });
            pend = data || [];
        } catch (e) { pend = []; }
        if (pend.length) {
            const igual = pend.find(x => (Number(x.monto) || 0) === m);
            if (igual) {
                sol = { id: igual.id, monto: Number(igual.monto) || 0 };
            } else {
                const p0 = pend[0];
                const ok = confirm(
                    'Este socio tiene ' + (pend.length === 1 ? 'un anticipo registrado' : pend.length + ' anticipos registrados')
                    + ' desde su app, por confirmar: ' + pend.map(x => fmt(x.monto)).join(', ') + '.\n\n'
                    + '¿El anticipo de ' + fmt(m) + ' que acabas de registrar corresponde al de ' + fmt(p0.monto) + '?\n\n'
                    + 'ACEPTAR  →  se confirma ese registro y en la app del socio\n'
                    + '            deja de descontarse aparte.\n'
                    + 'CANCELAR →  queda pendiente (es otro anticipo distinto).'
                );
                if (ok) sol = { id: p0.id, monto: Number(p0.monto) || 0 };
            }
        }
    }

    egresos_cancelarVinculo();
    if (!sol) { egresos_cargarPendientes(); return; }
    try {
        await dbSoc.from('solicitudes_egreso')
            .update({ estado: 'PROCESADO', procesado_por: responsable || '', procesado_at: new Date().toISOString() })
            .eq('id', sol.id);
        // Avisar al socio. Si el monto confirmado no es el que registró, se lo
        // dice: su balance ahora usa el monto confirmado.
        const montoFinal = m || sol.monto;
        const mid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('MA-' + Date.now());
        await dbSoc.from('mensajes_admin').insert({
            id: mid, socio_id: sid, remitente: 'ADMIN', autor: 'Administración',
            mensaje: `✅ Anticipo confirmado\nLa administración registró tu anticipo por ${fmt(montoFinal)}.`
                + (m && m !== sol.monto ? `\n(Lo habías registrado por ${fmt(sol.monto)}; tu balance ahora usa el monto confirmado.)` : '')
        });
    } catch (e) { console.warn('[egresos] no se pudo marcar procesado:', e); }
    egresos_cargarPendientes();
}

// Recarga agrupada (debounce): si llegan muchos eventos juntos (uso masivo),
// se hace UNA sola recarga en vez de una por evento → la UI no se atocha.
let _egresosReloadT = null;
function _egresosReloadDebounced() {
    clearTimeout(_egresosReloadT);
    _egresosReloadT = setTimeout(egresos_cargarPendientes, 450);
}

// Realtime: refrescar el aviso cuando llega/cambia una solicitud
function egresos_initRealtime() {
    if (_egresosRtListo) return;
    _egresosRtListo = true;
    try {
        dbSoc.channel('sv-egresos-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_egreso' },
                (payload) => {
                    _egresosReloadDebounced();
                    // La notificación sí es por evento (una por cada solicitud nueva),
                    // así ninguna se pierde aunque lleguen varias juntas.
                    if (payload && payload.eventType === 'INSERT' && payload.new && payload.new.estado === 'PENDIENTE' && typeof notificarAdmin === 'function') {
                        const s = payload.new;
                        notificarAdmin('Nueva solicitud de egreso', (s.socio_nombre || 'Un socio') + ' pidió ' + _fmtMoneyAdmin(s.monto), 'warning');
                    }
                })
            .subscribe();
    } catch (e) { console.warn('[egresos] realtime no disponible:', e); }
}
