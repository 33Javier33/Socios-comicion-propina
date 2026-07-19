// ============================================================
// DÍAS PART-TIME POR CONFIRMAR
// Los socios Part-Time marcan sus días trabajados desde la app
// propi.solicitada. Llegan aquí como solicitudes PENDIENTE en la
// tabla `dias_pt_solicitados`. El encargado las valida: al
// confirmar, el día se agrega a la planilla real (tabla `dias_pt`)
// y el valor deja de estar "por confirmar" en la app del socio.
// Se muestran como aviso en la sección "Anticipos y Ausencias".
// Fuente: tabla `dias_pt_solicitados` (proyecto socios, dbSoc).
// ============================================================

let ptDiasPendientes = [];       // solicitudes con estado PENDIENTE
let _ptDiasRtListo   = false;

function _escPtd(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function _fmtPtdMoney(v) {
    if (typeof _fmtMoneyAdmin === 'function') return _fmtMoneyAdmin(v);
    return '$' + (Number(v) || 0).toLocaleString('es-CL');
}

function _fmtPtdFecha(f) {
    try {
        const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
        return d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' });
    } catch (e) { return String(f || ''); }
}

// Período (15→14) para guardar en dias_pt: usa el de la solicitud si viene,
// si no lo deriva del período actual.
function _ptdPeriodo(sol) {
    if (sol && sol.periodo) return sol.periodo;
    try {
        if (typeof aq_calcularPeriodoActual === 'function') {
            const { inicio, fin } = aq_calcularPeriodoActual();
            if (inicio && fin) return `${inicio}_${fin}`;
        }
    } catch (e) {}
    return '';
}

async function ptdias_cargarPendientes() {
    try {
        const { data, error } = await dbSoc.from('dias_pt_solicitados')
            .select('*').eq('estado', 'PENDIENTE')
            .order('socio_nombre', { ascending: true })
            .order('fecha', { ascending: true });
        if (error) { console.warn('[pt-dias] error:', error.message); return; }
        ptDiasPendientes = data || [];
        ptdias_render();
    } catch (e) { console.warn('[pt-dias]', e); }
}

function ptdias_render() {
    const box = document.getElementById('ptDiasPendientesBox');
    if (!box) return;
    if (!ptDiasPendientes.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

    // Agrupar por socio
    const porSocio = {};
    ptDiasPendientes.forEach(d => {
        const k = String(d.socio_id);
        if (!porSocio[k]) porSocio[k] = { nombre: d.socio_nombre || 'Socio', area: d.area || '', dias: [] };
        porSocio[k].dias.push(d);
    });

    const bloques = Object.keys(porSocio).map(socioId => {
        const g = porSocio[socioId];
        const totalEst = g.dias.reduce((a, b) => a + (Number(b.valor_estimado) || 0), 0);
        const chips = g.dias.map(d => `
            <div style="display:flex;align-items:center;gap:6px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:6px 8px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.78em;color:#92400e;text-transform:capitalize;">${_fmtPtdFecha(d.fecha)}</div>
                    <div style="font-size:0.68em;color:#b45309;">~ ${_fmtPtdMoney(d.valor_estimado)}</div>
                </div>
                <button onclick="ptdias_confirmar('${d.id}')" title="Confirmar día" style="border:none;border-radius:6px;background:#16a34a;color:white;font-size:0.72em;font-weight:800;padding:5px 8px;cursor:pointer;">✓</button>
                <button onclick="ptdias_rechazar('${d.id}')" title="Rechazar día" style="border:1px solid #fca5a5;border-radius:6px;background:white;color:#dc2626;font-size:0.72em;font-weight:800;padding:5px 7px;cursor:pointer;">✖</button>
            </div>`).join('');

        return `
            <div style="background:white;border:1px solid #fde68a;border-radius:10px;padding:10px 11px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <div style="width:30px;height:30px;border-radius:8px;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">🕒</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:800;font-size:0.85em;color:#78350f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escPtd(g.nombre)}</div>
                        <div style="font-size:0.7em;color:#b45309;">${g.dias.length} día(s) · ~ ${_fmtPtdMoney(totalEst)}${g.area ? ' · ' + _escPtd(g.area) : ''}</div>
                    </div>
                    <button onclick="ptdias_confirmarSocio('${socioId}')" style="border:none;border-radius:7px;background:#15803d;color:white;font-size:0.72em;font-weight:800;padding:6px 9px;cursor:pointer;white-space:nowrap;">✓ Todos</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;">${chips}</div>
            </div>`;
    }).join('');

    box.innerHTML = `
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;padding:12px 14px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
                <div style="color:white;font-weight:800;font-size:0.95em;">🕒 Días Part-Time por confirmar
                    <span style="background:rgba(255,255,255,0.28);border-radius:10px;padding:1px 8px;font-size:0.82em;">${ptDiasPendientes.length}</span>
                </div>
                <div style="color:#fff7ed;font-size:0.72em;">Valida los días que marcaron los socios</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">${bloques}</div>
        </div>`;
    box.style.display = 'block';
}

// Agrega una lista de fechas a la planilla real (dias_pt) del socio, sin duplicar.
async function _ptdAgregarADiasPt(socioId, fechas, periodo) {
    const { data: ex } = await dbSoc.from('dias_pt').select('dias').eq('socio_id', String(socioId)).maybeSingle();
    const existentes = (ex && Array.isArray(ex.dias)) ? ex.dias : [];
    const merged = [...new Set([...existentes, ...fechas.map(f => String(f).slice(0, 10))])].sort();
    const payload = { socio_id: String(socioId), dias: merged };
    if (periodo) payload.periodo = periodo;
    await dbSoc.from('dias_pt').upsert(payload, { onConflict: 'socio_id' });
    // Reflejar en memoria para el resto de la app (totales PT, historial)
    try {
        if (typeof globalDiasPT === 'object' && globalDiasPT) globalDiasPT[String(socioId)] = merged;
        if (typeof recalcularTotalPT === 'function') recalcularTotalPT();
    } catch (e) {}
    return merged;
}

async function _ptdNotificarSocio(socioId, mensaje) {
    try {
        const mid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('MA-' + Date.now());
        await dbSoc.from('mensajes_admin').insert({
            id: mid, socio_id: String(socioId), remitente: 'ADMIN',
            autor: 'Administración', mensaje
        });
    } catch (e) { console.warn('[pt-dias] notificar socio:', e); }
}

function _ptdRespTxt() {
    const resp = (typeof getSesionResponsableObj === 'function') ? getSesionResponsableObj() : {};
    return (resp && resp.ini) ? (resp.ini + (resp.area ? ' ' + resp.area : '')) : 'ADM';
}

// Confirmar un día: lo agrega a la planilla y marca la solicitud CONFIRMADO.
async function ptdias_confirmar(solicitudId) {
    const s = ptDiasPendientes.find(x => x.id === solicitudId);
    if (!s) return;
    if (typeof toggleLoader === 'function') toggleLoader(true, 'Confirmando día...');
    try {
        await _ptdAgregarADiasPt(s.socio_id, [s.fecha], _ptdPeriodo(s));
        await dbSoc.from('dias_pt_solicitados').update({
            estado: 'CONFIRMADO', confirmado_por: _ptdRespTxt(), confirmado_at: new Date().toISOString()
        }).eq('id', solicitudId);
        await _ptdNotificarSocio(s.socio_id,
            `✅ Día confirmado\nTu turno del ${_fmtPtdFecha(s.fecha)} fue validado (${_fmtPtdMoney(s.valor_estimado)}).`);
        if (typeof logAccion === 'function') logAccion('CONFIRMAR_DIA_PT', `${s.socio_nombre || ''} · ${s.fecha}`);
        if (typeof showToast === 'function') showToast('Día confirmado ✓', 'success');
    } catch (e) {
        console.warn('[pt-dias] confirmar:', e);
        if (typeof showToast === 'function') showToast('Error al confirmar el día', 'error');
    } finally {
        if (typeof toggleLoader === 'function') toggleLoader(false);
    }
    ptdias_cargarPendientes();
}

// Confirmar todos los días pendientes de un socio de una vez.
async function ptdias_confirmarSocio(socioId) {
    const dias = ptDiasPendientes.filter(x => String(x.socio_id) === String(socioId));
    if (!dias.length) return;
    const nombre = dias[0].socio_nombre || 'socio';
    if (!confirm(`¿Confirmar ${dias.length} día(s) de ${nombre}?\nSe agregarán a la planilla del período.`)) return;
    if (typeof toggleLoader === 'function') toggleLoader(true, 'Confirmando días...');
    try {
        const fechas = dias.map(d => d.fecha);
        await _ptdAgregarADiasPt(socioId, fechas, _ptdPeriodo(dias[0]));
        await dbSoc.from('dias_pt_solicitados').update({
            estado: 'CONFIRMADO', confirmado_por: _ptdRespTxt(), confirmado_at: new Date().toISOString()
        }).in('id', dias.map(d => d.id));
        const totalEst = dias.reduce((a, b) => a + (Number(b.valor_estimado) || 0), 0);
        await _ptdNotificarSocio(socioId,
            `✅ Días confirmados\nSe validaron ${dias.length} día(s) de tu período (${_fmtPtdMoney(totalEst)}).`);
        if (typeof logAccion === 'function') logAccion('CONFIRMAR_DIA_PT', `${nombre} · ${dias.length} días`);
        if (typeof showToast === 'function') showToast(`${dias.length} día(s) confirmado(s) ✓`, 'success');
    } catch (e) {
        console.warn('[pt-dias] confirmarSocio:', e);
        if (typeof showToast === 'function') showToast('Error al confirmar los días', 'error');
    } finally {
        if (typeof toggleLoader === 'function') toggleLoader(false);
    }
    ptdias_cargarPendientes();
}

// Rechazar un día: pide motivo, marca RECHAZADO y notifica al socio.
async function ptdias_rechazar(solicitudId) {
    const s = ptDiasPendientes.find(x => x.id === solicitudId);
    if (!s) return;
    const raw = prompt(`Rechazar el día ${_fmtPtdFecha(s.fecha)} de ${s.socio_nombre || 'socio'}.\n\nMotivo (el socio lo verá):`, '');
    if (raw === null) return;
    const motivo = raw.trim();
    if (!motivo) { if (typeof showToast === 'function') showToast('Debes indicar un motivo', 'warning'); return; }
    try {
        await dbSoc.from('dias_pt_solicitados').update({
            estado: 'RECHAZADO', motivo_rechazo: motivo,
            confirmado_por: _ptdRespTxt(), confirmado_at: new Date().toISOString()
        }).eq('id', solicitudId);
        await _ptdNotificarSocio(s.socio_id,
            `❌ Día rechazado\nTu turno del ${_fmtPtdFecha(s.fecha)} no fue validado.\nMotivo: ${motivo}`);
        if (typeof showToast === 'function') showToast('Día rechazado — se notificó al socio', 'success');
    } catch (e) {
        console.warn('[pt-dias] rechazar:', e);
        if (typeof showToast === 'function') showToast('Error al rechazar el día', 'error');
    }
    ptdias_cargarPendientes();
}

// Realtime: refrescar el aviso cuando llega/cambia una solicitud de día PT
function ptdias_initRealtime() {
    if (_ptDiasRtListo) return;
    _ptDiasRtListo = true;
    try {
        dbSoc.channel('sv-dias-pt-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dias_pt_solicitados' },
                (payload) => {
                    ptdias_cargarPendientes();
                    if (payload && payload.eventType === 'INSERT' && payload.new && payload.new.estado === 'PENDIENTE' && typeof notificarAdmin === 'function') {
                        const n = payload.new;
                        notificarAdmin('Día Part-Time por confirmar',
                            (n.socio_nombre || 'Un socio') + ' marcó el ' + _fmtPtdFecha(n.fecha), 'warning');
                    }
                })
            .subscribe();
    } catch (e) { console.warn('[pt-dias] realtime no disponible:', e); }
}
