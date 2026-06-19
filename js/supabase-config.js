// ============================================================
// SUPABASE CONFIG — socios-comicion-propina
// Intercepta URL_RECAUDACIONES → recaudaciones Supabase
// Intercepta URL_SOCIOS       → socios/anticipos/extras Supabase
// ============================================================

const _SB_URL_REC = 'https://lpulmjzboogixbdxxayo.supabase.co';
const _SB_KEY_REC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdWxtanpib29naXhiZHh4YXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjY0NzMsImV4cCI6MjA5MTI0MjQ3M30.vjebyQb4Bb62ZQlNaJZveuxdBYDOmtC4bM7uwAilDzY';

const _SB_URL_SOC = 'https://teemahksasdougehrcly.supabase.co';
const _SB_KEY_SOC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZW1haGtzYXNkb3VnZWhyY2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTkwNjIsImV4cCI6MjA5Njg3NTA2Mn0.EIQ7gRcwf3zYgvGESKw3s5lnZMABN_EuNWsrJK3L1zk';

const dbRec = supabase.createClient(_SB_URL_REC, _SB_KEY_REC);
const dbSoc = supabase.createClient(_SB_URL_SOC, _SB_KEY_SOC);

// Canal compartido para notificar/recibir cambios en tiempo real
const _recBroadcast = dbRec.channel('rec-data-sync');
const _notificarCambio = () => _recBroadcast.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => {});

(function () {
    const _origFetch = window.fetch.bind(window);

    // ── Helper ──────────────────────────────────────────────────
    function _mockOk(data) { return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) }; }

    // ── Cola de operaciones offline ──────────────────────────────
    const _PENDING_OPS_KEY = 'sc_ops_pendientes';

    function _opGuardar(tipo, datos) {
        try {
            const ops = JSON.parse(localStorage.getItem(_PENDING_OPS_KEY) || '[]');
            ops.push({ _oid: crypto.randomUUID(), tipo, datos, ts: Date.now() });
            localStorage.setItem(_PENDING_OPS_KEY, JSON.stringify(ops));
        } catch(e) {}
    }

    function _opEliminar(oid) {
        try {
            const ops = JSON.parse(localStorage.getItem(_PENDING_OPS_KEY) || '[]');
            localStorage.setItem(_PENDING_OPS_KEY, JSON.stringify(ops.filter(o => o._oid !== oid)));
        } catch(e) {}
    }

    async function _sincronizarOps() {
        let ops;
        try { ops = JSON.parse(localStorage.getItem(_PENDING_OPS_KEY) || '[]'); } catch(e) { return; }
        if (ops.length === 0) return;

        let ok = 0, omit = 0, fail = 0;
        for (const op of [...ops]) {
            try {
                if (op.tipo === 'anticipo' || op.tipo === 'extra') {
                    const tbl = op.tipo === 'anticipo' ? 'anticipos' : 'extras';
                    // Verificar si ya existe por ID único — si existe, saltar
                    const chk = await _origFetch(
                        `${_SB_URL_SOC}/rest/v1/${tbl}?id=eq.${encodeURIComponent(op.datos.id)}`,
                        { headers: { apikey: _SB_KEY_SOC, Authorization: 'Bearer ' + _SB_KEY_SOC } }
                    );
                    const existe = await chk.json();
                    if (Array.isArray(existe) && existe.length > 0) {
                        _opEliminar(op._oid); omit++; continue;
                    }
                    const res = await _origFetch(`${_SB_URL_SOC}/rest/v1/${tbl}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', apikey: _SB_KEY_SOC, Authorization: 'Bearer ' + _SB_KEY_SOC, Prefer: 'return=minimal' },
                        body: JSON.stringify(op.datos)
                    });
                    if (res.ok) { _opEliminar(op._oid); ok++; } else { fail++; }

                } else if (op.tipo === 'puntos') {
                    // PATCH es idempotente — siempre aplicar
                    const res = await _origFetch(
                        `${_SB_URL_SOC}/rest/v1/socios?id=eq.${encodeURIComponent(op.datos.socioId)}`,
                        { method: 'PATCH', headers: { 'Content-Type': 'application/json', apikey: _SB_KEY_SOC, Authorization: 'Bearer ' + _SB_KEY_SOC, Prefer: 'return=minimal' }, body: JSON.stringify({ puntos: op.datos.puntos }) }
                    );
                    if (res.ok) { _opEliminar(op._oid); ok++; } else { fail++; }
                }
            } catch(e) { fail++; /* sin red aún — dejar en cola */ }
        }

        if (ok > 0 || omit > 0) {
            const msg = `Sincronizado: ${ok} enviado${ok !== 1 ? 's' : ''}${omit > 0 ? `, ${omit} ya existía${omit !== 1 ? 'n' : ''}` : ''}`;
            if (typeof showToast === 'function') showToast(msg, 'success');
        }
        if (fail > 0 && ok === 0) {
            const pend = JSON.parse(localStorage.getItem(_PENDING_OPS_KEY) || '[]').length;
            if (typeof showToast === 'function') showToast(`${pend} operación${pend !== 1 ? 'es' : ''} pendiente${pend !== 1 ? 's' : ''} de sincronizar`, 'warning');
        }
    }

    // Exponer para el listener online (fuera del IIFE)
    window._scSincronizar = _sincronizarOps;

    // ── Helper: upsert datos de socios a Supabase (sin sobreescribir puntos) ──
    function _seedSociosToSupabase(socios) {
        if (!Array.isArray(socios) || socios.length === 0) return;
        const rows = socios.map(s => ({
            id: String(s.ID),
            nombre: s.Nombre || '',
            apellido: s.Apellido || '',
            area: s.Area || '',
            contrato: s.TipoContrato || '',
            fecha_ingreso: s.FechaIngreso || null,
            fecha_inicio_puntos: s.FechaInicioPuntos || null
            // SIN puntos — preservar valor existente en Supabase
        }));
        _origFetch(`${_SB_URL_SOC}/rest/v1/socios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': _SB_KEY_SOC,
                'Authorization': 'Bearer ' + _SB_KEY_SOC,
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(rows)
        }).then(r => {
            if (!r.ok) r.text().then(t => console.error('[SB-SEED]', t));
            else console.log('[SB-SEED]', rows.length, 'socios sincronizados con Supabase');
        }).catch(e => console.error('[SB-SEED]', e));
    }

    // ── HANDLER: getSocios GET → Supabase primero (rápido), GAS refresca en segundo plano ──
    async function _socGetSociosHandler(url, options) {
        try {
            // 1. Intentar Supabase primero
            const sbRes = await _origFetch(
                `${_SB_URL_SOC}/rest/v1/socios?select=id,nombre,apellido,area,contrato,fecha_ingreso,fecha_inicio_puntos,puntos&order=nombre.asc`,
                { headers: { 'apikey': _SB_KEY_SOC, 'Authorization': 'Bearer ' + _SB_KEY_SOC } }
            );
            const sbData = sbRes.ok ? await sbRes.json() : [];
            const tieneNombres = Array.isArray(sbData) && sbData.some(r => r.nombre);

            if (tieneNombres) {
                // Convertir formato Supabase → formato GAS para compatibilidad con procesarSocioDesdeGoogle
                const data = sbData
                    .filter(s => s.fecha_ingreso)
                    .map(s => ({
                        ID: s.id,
                        Nombre: s.nombre || '',
                        Apellido: s.apellido || '',
                        Area: s.area || '',
                        TipoContrato: s.contrato || '',
                        FechaIngreso: s.fecha_ingreso || '',
                        FechaInicioPuntos: s.fecha_inicio_puntos || '',
                        Puntos: Number(s.puntos) || 0
                    }));

                // Refrescar GAS en segundo plano → mantiene Supabase sincronizado con Sheets
                _origFetch(url, options)
                    .then(r => r.json())
                    .then(gasRaw => { if (gasRaw && gasRaw.status === 'success') _seedSociosToSupabase(gasRaw.data); })
                    .catch(() => {});

                console.log('[SB-SOCIOS] Sirviendo', data.length, 'socios desde Supabase (instantáneo)');
                return _mockOk({ status: 'success', data });
            }

            // 2. Supabase sin datos completos → esperar GAS y sembrar
            console.log('[SB-SOCIOS] Sin datos en Supabase, cargando desde GAS...');
            const gasRaw = await _origFetch(url, options).then(r => r.json()).catch(() => ({ status: 'error', data: [] }));
            if (gasRaw.status === 'success') _seedSociosToSupabase(gasRaw.data);
            return _mockOk(gasRaw);
        } catch(e) {
            console.error('[SB-SOCIOS] Error en handler:', e);
            return _origFetch(url, options);
        }
    }

    // ── getDatosSocio: leer anticipos + extras + saldo desde Supabase (instantáneo) ──
    function _invalidarDatosSocio(_id) { /* no-op: Supabase siempre tiene datos frescos */ }
    function _invalidarTodosLosDatos() { /* no-op: Supabase siempre tiene datos frescos */ }

    // ── Helper: registrar evento de auditoría en Supabase (fire-and-forget) ────
    async function _sbAudit(accion, extra = {}) {
        try {
            const respRaw = sessionStorage.getItem('fs_sesion_responsable') || '';
            const parts = respRaw.split('|');
            const usuario = extra.usuario || (parts[0]
                ? parts[0] + (parts[1] ? ' (' + parts[1] + ')' : '')
                : 'Sistema');
            await dbSoc.from('auditoria').insert({
                usuario,
                accion,
                area: extra.area || parts[1] || null,
                folio: extra.folio || null,
                snapshot_antes: extra.antes || null,
                snapshot_despues: extra.despues || null,
                datos_extra: {
                    detalle: extra.detalle || '',
                    id_afectado: extra.idAfectado || extra.folio || '',
                    ...(extra.datos || {})
                }
            });
        } catch(e) {
            console.warn('[SB-AUDIT]', e.message);
        }
    }
    window.sbAuditLog = _sbAudit;

    async function _socGetDatosSocioHandler(url, options) {
        let socioId = '';
        try { socioId = new URLSearchParams(url.split('?')[1] || '').get('socioId') || ''; } catch(e) {}

        try {
            const [antRes, extRes, saldoRes] = await Promise.all([
                dbSoc.from('anticipos').select('id, fecha, monto, responsable')
                    .eq('socio_id', socioId).order('fecha', { ascending: false }),
                dbSoc.from('extras').select('id, fecha, tipo, monto, detalle')
                    .eq('socio_id', socioId).order('fecha', { ascending: false }),
                dbSoc.from('saldos_socio').select('monto').eq('id', socioId).maybeSingle()
            ]);

            if (!antRes.error && !extRes.error) {
                const anticipos = (antRes.data || []).map(a => ({
                    fecha: a.fecha,
                    cantidad: Number(a.monto),
                    monto: Number(a.monto),
                    uuid: a.id,
                    responsable: a.responsable || '',
                    areaResponsable: ''
                }));
                const extras = (extRes.data || []).map(e => ({
                    fecha: e.fecha,
                    tipo: e.tipo || '',
                    monto: Number(e.monto),
                    detalle: e.detalle || '',
                    uuid: e.id
                }));
                const saldoAnterior = saldoRes.data ? Number(saldoRes.data.monto) : 0;

                console.log('[SB-DATOS] Socio', socioId, '→', anticipos.length, 'anticipos,', extras.length, 'extras, saldo:', saldoAnterior);

                // Si anticipos/extras no están en Supabase → consultar GAS (Sheets) y combinar con saldo de Supabase
                if (anticipos.length === 0 && extras.length === 0) {
                    console.log('[SB-DATOS] Sin anticipos/extras en Supabase para', socioId, '→ consultando GAS y combinando saldo');
                    try {
                        const gasResp = await _origFetch(url, options);
                        const gasJson = await gasResp.json();
                        if (gasJson.status === 'success' && gasJson.data) {
                            return _mockOk({
                                status: 'success',
                                data: {
                                    anticipos: gasJson.data.anticipos || [],
                                    extras: gasJson.data.extras || [],
                                    // Supabase saldo tiene prioridad sobre GAS si existe
                                    saldoAnterior: saldoAnterior > 0 ? saldoAnterior : Number(gasJson.data.saldoAnterior || 0),
                                    diasTrabajados: gasJson.data.diasTrabajados || []
                                }
                            });
                        }
                    } catch(e) { console.warn('[SB-DATOS] GAS fallback error:', e.message); }
                    return _mockOk({ status: 'success', data: { anticipos: [], extras: [], saldoAnterior, diasTrabajados: [] } });
                }

                return _mockOk({ status: 'success', data: { anticipos, extras, saldoAnterior, diasTrabajados: [] } });
            }

            console.warn('[SB-DATOS] Error Supabase, fallback a GAS:', antRes.error?.message || extRes.error?.message);
        } catch(e) {
            console.warn('[SB-DATOS] Excepción, fallback a GAS:', e.message);
        }

        // Fallback a GAS si Supabase falla
        return _origFetch(url, options);
    }

    // ── HANDLER: URL_SOCIOS POST (escrituras) ────────────────────────────────
    async function _socWriteHandler(url, options) {
        let body = {};
        if (options && options.body) {
            try { body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; } catch(e) {}
        }
        const action = body.action || '';

        // ── registrarBatchAnticipos → Supabase primario, GAS respaldo en segundo plano ──
        if (action === 'registrarBatchAnticipos') {
            const items = body.detalleAnticipos || [];
            const rows = items.map(a => ({
                id: crypto.randomUUID(),
                socio_id: String(a.id),
                monto: Number(a.monto || 0),
                fecha: a.fecha,
                responsable: ((a.responsable || '') + (a.areaResponsable ? ' ' + a.areaResponsable : '')).trim()
            }));

            if (!navigator.onLine) {
                rows.forEach(r => _opGuardar('anticipo', r));
                items.forEach(a => _invalidarDatosSocio(String(a.id)));
                setTimeout(() => { if (typeof showToast === 'function') showToast('Sin conexión — anticipo guardado, se enviará al reconectar 📶', 'warning'); }, 300);
                return _mockOk({ status: 'success', message: 'offline' });
            }

            const { error: sbErr } = await dbSoc.from('anticipos').insert(rows);
            items.forEach(a => _invalidarDatosSocio(String(a.id)));
            const _totalAnt = items.reduce((s, a) => s + Number(a.monto || 0), 0);
            _sbAudit('Registrar Anticipo', {
                detalle: `${items.length} anticipo(s) — Total: $${_totalAnt.toLocaleString('es-CL')}`,
                datos: {
                    cantidad: items.length,
                    total_monto: _totalAnt,
                    socios: items.map(a => ({
                        id: a.id,
                        nombre: ((a.nombre || '') + ' ' + (a.apellido || '')).trim(),
                        monto: Number(a.monto || 0),
                        fecha: a.fecha
                    }))
                }
            });
            if (sbErr) {
                console.error('[sb] registrarBatchAnticipos error:', sbErr.message);
                return _origFetch(url, options); // fallback a GAS si Supabase falla
            }
            _origFetch(url, options).catch(() => {}); // sync GAS en segundo plano
            return _mockOk({ status: 'success', message: 'Anticipos guardados en Supabase' });
        }

        // ── registrarBatchExtras → Supabase primario, GAS respaldo en segundo plano ──
        if (action === 'registrarBatchExtras') {
            const items = body.detalleExtras || [];
            const rows = items.map(e => ({
                id: crypto.randomUUID(),
                socio_id: String(e.id),
                fecha: e.fecha,
                tipo: e.tipo || 'extra',
                monto: Number(e.monto || 0),
                detalle: e.detalle || ''
            }));

            if (!navigator.onLine) {
                rows.forEach(r => _opGuardar('extra', r));
                items.forEach(e => _invalidarDatosSocio(String(e.id)));
                setTimeout(() => { if (typeof showToast === 'function') showToast('Sin conexión — extra guardado, se enviará al reconectar 📶', 'warning'); }, 300);
                return _mockOk({ status: 'success', message: 'offline' });
            }

            const { error: sbErr } = await dbSoc.from('extras').insert(rows);
            items.forEach(e => _invalidarDatosSocio(String(e.id)));
            const _tiposExt = [...new Set(items.map(e => e.tipo || 'extra'))].join(', ');
            _sbAudit('Registrar Extra', {
                detalle: `${items.length} extra(s)/ausencia(s) — Tipos: ${_tiposExt}`,
                datos: {
                    cantidad: items.length,
                    socios: items.map(e => ({
                        id: e.id,
                        nombre: ((e.nombre || '') + ' ' + (e.apellido || '')).trim(),
                        tipo: e.tipo,
                        monto: Number(e.monto || 0),
                        fecha: e.fecha,
                        detalle: e.detalle || ''
                    }))
                }
            });
            if (sbErr) {
                console.error('[sb] registrarBatchExtras error:', sbErr.message);
                return _origFetch(url, options); // fallback a GAS si Supabase falla
            }
            _origFetch(url, options).catch(() => {}); // sync GAS en segundo plano
            return _mockOk({ status: 'success', message: 'Extras guardados en Supabase' });
        }

        // ── borrarMovimiento → Supabase primario, GAS respaldo en segundo plano ──
        if (action === 'borrarMovimiento') {
            const uuid = body.uuid;
            const tipo = (body.tipo || '').toLowerCase();
            const tbl = (tipo === 'anticipo' || tipo === 'anticipos') ? 'anticipos' : 'extras';
            const socioId = String(body.socioId || body.socio_id || '');
            const fecha = body.fecha || '';
            _invalidarDatosSocio(socioId);
            _sbAudit('Eliminar ' + (tipo.includes('anticipo') ? 'Anticipo' : 'Extra'), {
                detalle: `Fecha: ${fecha} | Socio ID: ${socioId}`,
                idAfectado: uuid || (socioId + '_' + fecha),
                datos: { tipo, socio_id: socioId, fecha, uuid }
            });
            // Borrar en Supabase (por socio_id+fecha o por id)
            const query = (socioId && fecha)
                ? dbSoc.from(tbl).delete().eq('socio_id', socioId).eq('fecha', fecha)
                : dbSoc.from(tbl).delete().eq('id', uuid);
            const { error: sbErr } = await query;
            if (sbErr) console.error('[sb] borrarMovimiento error:', sbErr.message);
            _origFetch(url, options).catch(() => {}); // sync GAS en segundo plano
            return _mockOk({ status: 'success', message: 'Eliminado en Supabase' });
        }

        // ── reiniciarAnticipos → archivar a historial en Supabase, luego limpiar ───
        if (action === 'reiniciarAnticipos') {
            const periodo = (body.tabNombre || '').replace('Anticipos_', '') || 'ARCHIVADO';
            // 1. Leer anticipos activos de Supabase
            const { data: activos } = await dbSoc.from('anticipos').select('*');
            // 2. Archivar a anticipos_historial antes de borrar
            if (activos && activos.length > 0) {
                const hoy = new Date().toISOString().substring(0, 10);
                const histRows = activos.map(a => ({
                    id: crypto.randomUUID(),
                    socio_id: a.socio_id,
                    fecha: a.fecha,
                    monto: Number(a.monto),
                    estado: 'ARCHIVADO',
                    uuid_ref: a.id,
                    responsable: a.responsable || null,
                    periodo: periodo,
                    fecha_archivo: hoy
                }));
                await dbSoc.from('anticipos_historial').insert(histRows)
                    .catch(e => console.error('[sb] error archivando anticipos_historial:', e));
            }
            // 3. Guardar snapshot de saldos_socio en saldos_cierre_mes antes de limpiar
            dbSoc.from('saldos_socio').select('monto').then(({ data: snap }) => {
                const totalSnap = (snap || []).reduce((s, r) => s + Number(r.monto || 0), 0);
                dbSoc.from('saldos_cierre_mes').upsert(
                    { id: crypto.randomUUID(), periodo, datos: { total: totalSnap, count: (snap || []).length } },
                    { onConflict: 'periodo' }
                ).catch(e => console.error('[sb] error guardando saldos_cierre_mes:', e));
            });
            _sbAudit('Reiniciar Anticipos', {
                detalle: `Período archivado: ${periodo} | ${activos?.length || 0} anticipos`,
                datos: { periodo, cantidad_archivada: activos?.length || 0 }
            });
            // 4. Llamar al GAS (archiva a Sheets y limpia la hoja)
            _invalidarTodosLosDatos(); // reinicio de anticipos afecta a todos los socios
            const gasRes = await _origFetch(url, options);
            // 5. Limpiar Supabase anticipos después de confirmar con GAS
            dbSoc.from('anticipos').delete().neq('id', '__never__')
                .catch(e => console.error('[sb] error limpiando anticipos:', e));
            return gasRes;
        }

        // ── reiniciarExtras → archivar en GAS y limpiar Supabase ──────
        if (action === 'reiniciarExtras') {
            _invalidarTodosLosDatos();
            _sbAudit('Reiniciar Extras', {
                detalle: 'Extras del período limpiados'
            });
            dbSoc.from('extras').delete().neq('id', '__never__')
                .then(() => console.log('[supabase-config] extras limpiados de Supabase'))
                .catch(e => console.error('[supabase-config] error limpiando extras:', e));
            return _origFetch(url, options);
        }

        // ── actualizarAnticipo → Supabase primario, GAS respaldo en segundo plano ──
        if (action === 'actualizarAnticipo') {
            _invalidarTodosLosDatos();
            const updData = {
                fecha: body.fecha,
                monto: Number(body.monto || 0),
                responsable: ((body.responsable || '') + (body.areaResponsable ? ' ' + body.areaResponsable : '')).trim()
            };
            _sbAudit('Actualizar Anticipo', {
                detalle: `Fecha: ${body.fecha} | Monto: $${Number(body.monto || 0).toLocaleString('es-CL')}`,
                idAfectado: body.uuid,
                datos: { uuid: body.uuid, ...updData }
            });
            const { error: sbErr } = await dbSoc.from('anticipos').update(updData).eq('id', body.uuid);
            if (sbErr) {
                console.error('[sb] actualizarAnticipo error:', sbErr.message);
                return _origFetch(url, options); // fallback a GAS si Supabase falla
            }
            _origFetch(url, options).catch(() => {}); // sync GAS en segundo plano
            return _mockOk({ status: 'success', message: 'Anticipo actualizado en Supabase' });
        }

        // ── registrarSaldoAnterior → actualizar saldos_socio en Supabase (primario) ──
        if (action === 'registrarSaldoAnterior') {
            const id = String(body.id || '');
            const monto = Number(body.monto || 0);
            const nombre = body.nombre || '';
            _invalidarDatosSocio(id);
            if (id) {
                const { error: sbErr } = await dbSoc.from('saldos_socio').upsert(
                    { id, nombre, monto, updated_at: new Date().toISOString() },
                    { onConflict: 'id' }
                );
                if (!sbErr) {
                    _sbAudit('Registrar Saldo Anterior', {
                        detalle: `Socio: ${nombre} | Monto: $${monto.toLocaleString('es-CL')}`,
                        idAfectado: id,
                        datos: { socio_id: id, nombre, monto }
                    });
                    _origFetch(url, options).catch(() => {}); // sync GAS en segundo plano
                    return _mockOk({ status: 'success', message: 'Saldo actualizado en Supabase' });
                }
                console.error('[sb] error upsert saldos_socio:', sbErr.message);
            }
            return _origFetch(url, options); // fallback a GAS
        }

        // ── procesarCierreMensual → GAS hace el cierre; sincronizar saldos + anticipos a Supabase ──
        if (action === 'procesarCierreMensual') {
            // Archivar anticipos activos a historial antes del cierre
            const { data: activosCierre } = await dbSoc.from('anticipos').select('*');
            if (activosCierre && activosCierre.length > 0) {
                const hoy = new Date().toISOString().substring(0, 10);
                const mesLabel = new Date().toLocaleString('es-CL', { month: 'long', year: 'numeric' }).toUpperCase().replace(' ', '_');
                const histRows = activosCierre.map(a => ({
                    id: crypto.randomUUID(),
                    socio_id: a.socio_id,
                    fecha: a.fecha,
                    monto: Number(a.monto),
                    estado: 'ARCHIVADO',
                    uuid_ref: a.id,
                    responsable: a.responsable || null,
                    periodo: `CIERRE_${mesLabel}`,
                    fecha_archivo: hoy
                }));
                await dbSoc.from('anticipos_historial').insert(histRows)
                    .catch(e => console.error('[sb] error archivando anticipos en cierre:', e));
            }

            const saldos = body.nuevosSaldosAnteriores || [];
            _sbAudit('Cierre Mensual', {
                detalle: `${activosCierre?.length || 0} anticipos archivados | ${saldos.length} saldos actualizados`,
                datos: { anticipos_archivados: activosCierre?.length || 0, saldos_actualizados: saldos.length }
            });

            const gasRes = await _origFetch(url, options);

            // Limpiar anticipos activos de Supabase
            dbSoc.from('anticipos').delete().neq('id', '__never__')
                .catch(e => console.error('[sb] error limpiando anticipos tras cierre:', e));

            // Sincronizar nuevos saldos anteriores a Supabase
            if (saldos.length > 0) {
                const rows = saldos.map(s => ({
                    id: String(s.id),
                    nombre: s.nombre || '',
                    monto: Number(s.monto || 0),
                    updated_at: new Date().toISOString()
                }));
                dbSoc.from('saldos_socio').upsert(rows, { onConflict: 'id' })
                    .then(() => console.log('[sb] saldos sincronizados al cierre mensual'))
                    .catch(e => console.error('[sb] error sinc. saldos cierre:', e));
            }

            return gasRes;
        }

        // ── updateSocio con Puntos → actualizar socios.puntos (misma tabla que lee propi.solicitada) ─
        if (action === 'updateSocio' && body.updates && body.updates.Puntos !== undefined) {
            const socioId = String(body.socioId || '');
            if (socioId) {
                if (!navigator.onLine) {
                    _opGuardar('puntos', { socioId, puntos: Number(body.updates.Puntos) });
                    return _mockOk({ status: 'success', message: 'offline' });
                }
                _origFetch(`${_SB_URL_SOC}/rest/v1/socios?id=eq.${encodeURIComponent(socioId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'apikey': _SB_KEY_SOC, 'Authorization': 'Bearer ' + _SB_KEY_SOC, 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ puntos: Number(body.updates.Puntos) })
                }).catch(() => { _opGuardar('puntos', { socioId, puntos: Number(body.updates.Puntos) }); });
            }
            return _origFetch(url, options);
        }

        // ── getAllDataDesdeSheets → leer anticipos y extras desde Supabase ──
        if (action === 'getAllDataDesdeSheets') {
            try {
                const [antRes, extRes] = await Promise.all([
                    dbSoc.from('anticipos').select('socio_id, fecha, monto, responsable'),
                    dbSoc.from('extras').select('socio_id, fecha, tipo, monto, detalle')
                ]);
                if (antRes.error) throw antRes.error;
                const anticipos = {};
                (antRes.data || []).forEach(a => {
                    const id = String(a.socio_id);
                    if (!anticipos[id]) anticipos[id] = [];
                    anticipos[id].push({
                        fecha: a.fecha,
                        cantidad: Number(a.monto),
                        monto: Number(a.monto),
                        responsable: a.responsable || ''
                    });
                });
                const extras = {};
                (extRes.data || []).forEach(e => {
                    const id = String(e.socio_id);
                    if (!extras[id]) extras[id] = [];
                    extras[id].push({
                        fecha: e.fecha,
                        tipo: e.tipo || '',
                        monto: Number(e.monto),
                        detalle: e.detalle || ''
                    });
                });
                console.log('[SB] getAllDataDesdeSheets → anticipos:', Object.keys(anticipos).length, 'socios | extras:', Object.keys(extras).length, 'socios');
                // Si Supabase está vacío, caer a GAS (datos aún en Sheets)
                if (Object.keys(anticipos).length === 0 && Object.keys(extras).length === 0) {
                    console.log('[SB] getAllDataDesdeSheets: Supabase vacío → consultando GAS');
                    return _origFetch(url, options);
                }
                // Formato idéntico al que devuelve GAS: { status, anticipos, extras }
                return _mockOk({ status: 'success', anticipos, extras });
            } catch(e) {
                console.warn('[SB] getAllDataDesdeSheets fallback a GAS:', e.message);
            }
        }

        // ── getConfig: leer configuración del sistema desde Supabase ──
        if (action === 'getConfig') {
            try {
                const { data, error } = await dbSoc.from('config_sistema').select('clave, valor');
                if (error) throw error;
                const cfg = {};
                (data || []).forEach(r => { cfg[r.clave] = r.valor; });
                return _mockOk({ status: 'success', data: cfg });
            } catch(e) {
                return _mockOk({ status: 'error', message: e.message });
            }
        }

        // ── setConfig: guardar clave/valor en config_sistema ──────────
        if (action === 'setConfig') {
            try {
                const { error } = await dbSoc.from('config_sistema').upsert(
                    { clave: body.clave, valor: String(body.valor || ''), updated_at: new Date().toISOString() },
                    { onConflict: 'clave' }
                );
                if (error) throw error;
                // Auditar cambio de config — NUNCA registrar el valor de PIN o clave
                if (body.clave === 'pin') {
                    _sbAudit('Cambiar PIN Global', { detalle: 'PIN global del sistema actualizado', datos: { clave: 'pin' } });
                } else if (body.clave === 'clave_recup') {
                    _sbAudit('Cambiar Clave Recuperación', { detalle: 'Clave de recuperación del sistema actualizada', datos: { clave: 'clave_recup' } });
                } else {
                    _sbAudit('Actualizar Configuración', { detalle: `Parámetro "${body.clave}" actualizado`, datos: { clave: body.clave } });
                }
                return _mockOk({ status: 'success' });
            } catch(e) {
                return _mockOk({ status: 'error', message: e.message });
            }
        }

        // ── setCredencial: guardar PIN personal de responsable en Supabase ──
        if (action === 'setCredencial') {
            try {
                const { error } = await dbSoc.from('responsable_creds').upsert(
                    { ini: body.ini, area: body.area, pin: String(body.pin || ''), updated_at: new Date().toISOString() },
                    { onConflict: 'ini,area' }
                );
                if (error) throw error;
                // Auditar — NUNCA registrar el valor del PIN
                _sbAudit('Cambiar PIN Personal', {
                    detalle: `PIN personal actualizado para ${body.ini} (${body.area})`,
                    datos: { ini: body.ini, area: body.area }
                });
                return _mockOk({ status: 'success' });
            } catch(e) {
                console.warn('[SB-CREDS] setCredencial error:', e.message);
                return _origFetch(url, options); // fallback a GAS
            }
        }

        // ── deleteCredencial: eliminar PIN personal de responsable ────
        if (action === 'deleteCredencial') {
            try {
                const { error } = await dbSoc.from('responsable_creds')
                    .delete().eq('ini', body.ini).eq('area', body.area);
                if (error) throw error;
                _sbAudit('Eliminar Credencial', {
                    detalle: `Credencial eliminada para ${body.ini} (${body.area})`,
                    datos: { ini: body.ini, area: body.area }
                });
                return _mockOk({ status: 'success' });
            } catch(e) {
                console.warn('[SB-CREDS] deleteCredencial error:', e.message);
                return _origFetch(url, options); // fallback a GAS
            }
        }

        // ── getHistorialAnticiposSocio → leer anticipos archivados desde Supabase ──
        if (action === 'getHistorialAnticiposSocio') {
            const idSocio = String(body.idSocio || '');
            const nombreSocio = String(body.nombreSocio || '');
            try {
                const { data, error } = await dbSoc.from('anticipos_historial')
                    .select('socio_id, fecha, monto, estado, responsable, periodo')
                    .eq('socio_id', idSocio)
                    .order('fecha', { ascending: false });
                if (error) throw error;

                if (!data || data.length === 0) {
                    // Sin datos en Supabase → intentar GAS (historial antiguo en Sheets)
                    return _origFetch(url, options);
                }

                // Agrupar por periodo → formato tab = Anticipos_MES_AÑO
                const grupos = {};
                data.forEach(r => {
                    // periodo viene como CIERRE_JUNIO_2026 → tab = Anticipos_JUNIO_2026
                    const tab = (r.periodo || 'SIN_PERIODO').replace(/^CIERRE_/, 'Anticipos_');
                    if (!grupos[tab]) grupos[tab] = [];
                    grupos[tab].push({
                        tab,
                        idSocio: r.socio_id,
                        nombre: nombreSocio,
                        fecha: r.fecha || '',
                        monto: Number(r.monto || 0),
                        estado: r.estado || '',
                        responsable: r.responsable || '',
                        areaResponsable: ''
                    });
                });

                const resultado = Object.entries(grupos)
                    .map(([tab, registros]) => ({ tab, registros }))
                    .sort((a, b) => b.tab.localeCompare(a.tab));

                console.log('[SB] getHistorialAnticiposSocio →', resultado.length, 'períodos para', idSocio);
                return _mockOk({ status: 'success', data: resultado });
            } catch(e) {
                console.warn('[SB] getHistorialAnticiposSocio fallback GAS:', e.message);
                return _origFetch(url, options);
            }
        }

        // Cualquier otra acción POST de socios: pasar a GAS sin interceptar
        return _origFetch(url, options);
    }

    window.fetch = async function (url, options = {}) {
        const s = String(url);

        // Interceptar URL_SOCIOS
        if (typeof URL_SOCIOS !== 'undefined' && s.startsWith(URL_SOCIOS)) {
            const method = (options.method || 'GET').toUpperCase();
            if (method !== 'POST') {
                // GET: interceptar según action
                let action = '';
                try { action = new URLSearchParams(s.split('?')[1] || '').get('action') || ''; } catch(e) {}
                if (action === 'getSocios') return _socGetSociosHandler(s, options);
                if (action === 'getDatosSocio') return _socGetDatosSocioHandler(s, options);
                if (action === 'getCredenciales') {
                    try {
                        const { data, error } = await dbSoc.from('responsable_creds').select('ini, area, pin');
                        if (error) throw error;
                        return _mockOk({ status: 'success', data: data || [] });
                    } catch(e) {
                        console.warn('[SB-CREDS] getCredenciales error, fallback GAS:', e.message);
                        return _origFetch(url, options);
                    }
                }
                if (action === 'getConfig') {
                    try {
                        const { data, error } = await dbSoc.from('config_sistema').select('clave, valor');
                        if (error) throw error;
                        const cfg = {};
                        (data || []).forEach(r => { cfg[r.clave] = r.valor; });
                        return _mockOk({ status: 'success', data: cfg });
                    } catch(e) {
                        return _mockOk({ status: 'error', message: e.message });
                    }
                }
                if (action === 'getTotalRemanentes') {
                    try {
                        const [saldosRes, histRes] = await Promise.all([
                            dbSoc.from('saldos_socio').select('monto, updated_at'),
                            dbSoc.from('saldos_cierre_mes').select('periodo, datos, created_at')
                                .order('created_at', { ascending: false }).limit(1)
                        ]);
                        const data = saldosRes.data || [];
                        const total = data.reduce((sum, r) => sum + Number(r.monto || 0), 0);
                        const fechas = data.map(r => r.updated_at).filter(Boolean).sort();
                        const ultimaFecha = fechas.length ? fechas[fechas.length - 1] : null;
                        const periodoAnterior = (histRes.data || [])[0] || null;
                        return _mockOk({ status: 'success', total, ultimaFecha, periodoAnterior });
                    } catch(e) { return _mockOk({ status: 'success', total: 0, ultimaFecha: null, periodoAnterior: null }); }
                }
                if (action === 'getAuditoria') {
                    try {
                        const [sbRes, gasRaw] = await Promise.allSettled([
                            dbSoc.from('auditoria')
                                .select('id, usuario, accion, area, folio, snapshot_antes, snapshot_despues, datos_extra, created_at')
                                .order('created_at', { ascending: false })
                                .limit(1000),
                            _origFetch(url, options).then(r => r.json())
                        ]);
                        const sbRows = (sbRes.status === 'fulfilled' && !sbRes.value.error)
                            ? (sbRes.value.data || []) : [];
                        const sbNorm = sbRows.map(r => ({
                            fecha: r.created_at,
                            usuario: r.usuario || '',
                            accion: r.accion || '',
                            detalle: (r.datos_extra && r.datos_extra.detalle) || '',
                            idAfectado: (r.datos_extra && r.datos_extra.id_afectado) || r.folio || '',
                            _fuente: 'supabase',
                            _extra: r.datos_extra || {},
                            _antes: r.snapshot_antes,
                            _despues: r.snapshot_despues,
                            area: r.area || ''
                        }));
                        // Solo traer de GAS registros anteriores al inicio de auditoría en Supabase
                        const CUTOFF = '2026-06-18';
                        const gasData = (gasRaw.status === 'fulfilled' && gasRaw.value?.status === 'success')
                            ? (gasRaw.value.data || []) : [];
                        const sbFolios = new Set(sbNorm.map(r => r.idAfectado).filter(Boolean));
                        const gasNorm = gasData
                            .filter(r => (r.fecha || '').substring(0, 10) < CUTOFF)
                            .map(r => ({
                                fecha: r.fecha,
                                usuario: r.usuario || '',
                                accion: r.accion || '',
                                detalle: r.detalle || '',
                                idAfectado: r.idAfectado || '',
                                _fuente: 'sheets'
                            }))
                            .filter(r => !r.idAfectado || !sbFolios.has(r.idAfectado));
                        const merged = [...sbNorm, ...gasNorm]
                            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                        console.log('[SB-AUDIT] getAuditoria →', sbNorm.length, 'Supabase +', gasNorm.length, 'Sheets');
                        return _mockOk({ status: 'success', data: merged });
                    } catch(e) {
                        console.error('[SB-AUDIT] getAuditoria error:', e.message);
                    }
                    return _origFetch(url, options);
                }
                return _origFetch(url, options);
            }
            return _socWriteHandler(s, options);
        }

        // Interceptar AQ_URL_POST (arqueo estado / cierres / retiros-anticipos)
        if (typeof AQ_URL_POST !== 'undefined' && s.startsWith(AQ_URL_POST)) {
            let aqAction = '';
            try { aqAction = new URLSearchParams(s.split('?')[1] || '').get('action') || ''; } catch(e) {}
            let aqBody = {};
            if (options && options.body) {
                try { aqBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; } catch(e) {}
            }
            if (!aqAction) aqAction = aqBody.action || '';
            console.log('[AQ-SB] acción:', aqAction || '(guardar)');

            // GET getLast → devolver estado guardado
            // Tabla arqueo_estado: PK=periodo(TEXT), conteo(JSONB), movimiento_display(JSONB), total_retirado(NUMERIC)
            if (aqAction === 'getLast') {
                const { data: row, error } = await dbSoc.from('arqueo_estado')
                    .select('*').eq('periodo', 'actual').maybeSingle();
                console.log('[AQ-SB] getLast →', row ? 'encontrado' : 'vacío', error ? '| error: ' + error.message : '');
                if (error) return _mockOk({ status: 'error', message: error.message });
                if (row) {
                    return _mockOk({ status: 'success', data: {
                        conteoActual: row.conteo || {},
                        movimientoDisplay: row.movimiento_display || {},
                        totalRetirado: Number(row.total_retirado || 0)
                    }});
                }
                // Fallback: cargar el último cierre archivado si no hay estado activo
                const { data: cierre } = await dbSoc.from('arqueo_cierres')
                    .select('conteo_actual,movimiento_display,total_retirado')
                    .order('fecha', { ascending: false }).limit(1).maybeSingle();
                if (cierre) {
                    return _mockOk({ status: 'success', data: {
                        conteoActual: cierre.conteo_actual || {},
                        movimientoDisplay: cierre.movimiento_display || {},
                        totalRetirado: Number(cierre.total_retirado || 0),
                        esArchivado: true
                    }});
                }
                return _mockOk({ status: 'error', message: 'Sin datos guardados' });
            }

            // GET getRetirosAnticipos
            // Tabla retiros_anticipos: firma(TEXT unique), socio_nombre(TEXT), monto(NUMERIC), billetes(JSONB)
            if (aqAction === 'getRetirosAnticipos') {
                const { data, error } = await dbSoc.from('retiros_anticipos').select('firma,socio_nombre,monto,billetes');
                if (error) { console.error('[AQ-SB] getRetirosAnticipos error:', error.message); return _mockOk({ status: 'success', data: {} }); }
                const mapped = {};
                (data || []).forEach(r => {
                    mapped[r.firma] = { nombre: r.socio_nombre, monto: Number(r.monto), billetes: r.billetes || {} };
                });
                return _mockOk({ status: 'success', data: mapped });
            }

            // POST registrarRetiroAnticipo
            if (aqAction === 'registrarRetiroAnticipo') {
                const { error } = await dbSoc.from('retiros_anticipos').upsert({
                    firma: aqBody.firma,
                    socio_nombre: aqBody.nombre || '',
                    monto: Number(aqBody.monto || 0),
                    billetes: aqBody.billetes || {},
                    responsable: aqBody.responsable || ''
                }, { onConflict: 'firma' });
                if (error) { console.error('[AQ-SB] registrarRetiro error:', error.message); return _mockOk({ status: 'error', message: error.message }); }
                _sbAudit('Retiro Anticipo', {
                    idAfectado: aqBody.firma,
                    detalle: `Socio: ${aqBody.nombre || ''} | Monto: $${Number(aqBody.monto || 0).toLocaleString('es-CL')}`,
                    datos: { firma: aqBody.firma, nombre: aqBody.nombre, monto: Number(aqBody.monto || 0), billetes: aqBody.billetes }
                });
                return _mockOk({ status: 'success' });
            }

            // POST archive → guardar en arqueo_cierres y borrar estado actual
            if (aqAction === 'archive') {
                const { error: insErr } = await dbSoc.from('arqueo_cierres').insert({
                    total_contado: Number(aqBody.totalContado || 0),
                    diferencia: Number(aqBody.diferencia || 0),
                    total_retirado: Number(aqBody.totalRetirado || 0),
                    conteo_actual: aqBody.conteoActual || {},
                    movimiento_display: aqBody.movimientoDisplay || {},
                    divisor_planta: Number(aqBody.divisorPlanta || 1),
                    divisor_pt: Number(aqBody.divisorPartTime || 1)
                });
                if (insErr) return _mockOk({ status: 'error', message: insErr.message });
                _sbAudit('Cierre Arqueo', {
                    detalle: `Total contado: $${Number(aqBody.totalContado || 0).toLocaleString('es-CL')} | Diferencia: $${Number(aqBody.diferencia || 0).toLocaleString('es-CL')}`,
                    datos: {
                        total_contado: Number(aqBody.totalContado || 0),
                        diferencia: Number(aqBody.diferencia || 0),
                        total_retirado: Number(aqBody.totalRetirado || 0)
                    }
                });
                await dbSoc.from('arqueo_estado').delete().eq('periodo', 'actual');
                return _mockOk({ status: 'success' });
            }

            // POST default → guardar/actualizar estado con upsert por periodo='actual'
            const { error: upErr } = await dbSoc.from('arqueo_estado').upsert({
                periodo: 'actual',
                conteo: aqBody.conteoActual || {},
                movimiento_display: aqBody.movimientoDisplay || {},
                total_retirado: Number(aqBody.totalRetirado || 0)
            }, { onConflict: 'periodo' });
            console.log('[AQ-SB] guardar →', upErr ? 'ERROR: ' + upErr.message : 'OK');
            if (upErr) return _mockOk({ status: 'error', message: upErr.message });
            return _mockOk({ status: 'success' });
        }

        // Interceptar URL_RECAUDACIONES
        if (typeof URL_RECAUDACIONES === 'undefined' || !s.startsWith(URL_RECAUDACIONES)) {
            return _origFetch(url, options);
        }

        // Extraer action
        let action = '';
        try { action = new URLSearchParams(s.split('?')[1] || '').get('action') || ''; } catch (e) {}
        let body = {};
        if (options && options.body) {
            try { body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; } catch (e) {}
        }
        if (!action) action = body.action || '';

        const ok = (data)  => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
        const err = (msg)  => ok({ status: 'error', message: msg });
        const succ = (data) => ok({ status: 'success', data: data !== undefined ? data : [] });

        // ── GET recaudaciones ────────────────────────────────────────
        if (action === 'get') {
            try {
                const [recRes, divRes] = await Promise.all([
                    dbRec.from('recaudaciones').select('*').order('fecha', { ascending: false }),
                    dbRec.from('divisores').select('fecha, valor')
                ]);
                const divMap = {};
                for (const d of (divRes.data || [])) divMap[d.fecha] = Number(d.valor);
                const data = (recRes.data || []).map(r => ({
                    originalIndex: r.id,  // UUID — usado en editar/borrar
                    fecha: r.fecha,
                    tipo: r.tipo,
                    monto: Number(r.monto),
                    divisor: divMap[r.fecha] || null,
                    registrado_por_nombre: r.registrado_por_nombre || null,
                    arqueado: r.arqueado === true,
                    arqueado_at: r.arqueado_at || null,
                    billetes: r.billetes || {}
                }));
                return succ(data);
            } catch (e) { return err(e.message); }
        }

        // ── ADD recaudacion ──────────────────────────────────────────
        if (action === 'add') {
            try {
                const { error } = await dbRec.from('recaudaciones').insert({
                    id: crypto.randomUUID(),
                    fecha: body.fecha,
                    tipo: body.tipo || 'Sin Tipo',
                    monto: Number(body.monto) || 0
                });
                if (error) throw error;
                _sbAudit('Registrar Recaudación', {
                    detalle: `Fecha: ${body.fecha} | Tipo: ${body.tipo || 'Sin Tipo'} | Monto: $${Number(body.monto || 0).toLocaleString('es-CL')}`,
                    datos: { fecha: body.fecha, tipo: body.tipo, monto: Number(body.monto || 0) }
                });
                _notificarCambio();
                return succ();
            } catch (e) { return err(e.message); }
        }

        // ── ARQUEADO: marcar recaudación como verificada en caja ─────
        if (action === 'arqueado') {
            try {
                const { error } = await dbRec.from('recaudaciones').update({
                    arqueado: true,
                    billetes: body.billetes || {},
                    arqueado_at: new Date().toISOString()
                }).eq('id', body.id);
                if (error) throw error;
                _sbAudit('Verificar Recaudación', {
                    idAfectado: body.id,
                    detalle: `Recaudación verificada en caja | ID: ${String(body.id || '').substring(0, 8)}`,
                    datos: { id: body.id, billetes: body.billetes }
                });
                _notificarCambio();
                return succ();
            } catch (e) { return err(e.message); }
        }

        // ── UPDATE recaudacion (por UUID en sheetIndex) ──────────────
        if (action === 'update') {
            try {
                const id = body.sheetIndex;
                const { error } = await dbRec.from('recaudaciones').update({
                    fecha: body.fecha,
                    tipo: body.tipo || 'Sin Tipo',
                    monto: Number(body.monto) || 0
                }).eq('id', id);
                if (error) throw error;
                _sbAudit('Actualizar Recaudación', {
                    idAfectado: id,
                    detalle: `Fecha: ${body.fecha} | Tipo: ${body.tipo || 'Sin Tipo'} | Monto: $${Number(body.monto || 0).toLocaleString('es-CL')}`,
                    datos: { id, fecha: body.fecha, tipo: body.tipo, monto: Number(body.monto || 0) }
                });
                _notificarCambio();
                return succ();
            } catch (e) { return err(e.message); }
        }

        // ── DELETE recaudacion (por UUID en index) ───────────────────
        if (action === 'delete') {
            try {
                const id = body.index;
                const { error } = await dbRec.from('recaudaciones').delete().eq('id', id);
                if (error) throw error;
                _sbAudit('Eliminar Recaudación', {
                    idAfectado: id,
                    detalle: `Recaudación eliminada | ID: ${String(id || '').substring(0, 8)}`,
                    datos: { id }
                });
                _notificarCambio();
                return succ();
            } catch (e) { return err(e.message); }
        }

        // ── UPDATE DIVISOR ───────────────────────────────────────────
        if (action === 'updateDivisor') {
            try {
                const { error } = await dbRec.from('divisores').upsert({
                    id: body.fecha,
                    fecha: body.fecha,
                    valor: Number(body.divisor)
                }, { onConflict: 'fecha' });
                if (error) throw error;
                _sbAudit('Actualizar Divisor', {
                    detalle: `Fecha: ${body.fecha} | Divisor: ${body.divisor}`,
                    datos: { fecha: body.fecha, divisor: Number(body.divisor) }
                });
                _notificarCambio();
                return succ();
            } catch (e) { return err(e.message); }
        }

        // ── IMPORT ALL (restaurar backup / vaciar nube) ──────────────
        if (action === 'importAll') {
            try {
                const importData = body.data || body;
                const datos  = importData.datos  || importData.data  || [];
                const notas  = importData.notas  || importData.notes || [];
                const divs   = importData.divisores || {};

                // 1. Vaciar tablas
                await Promise.all([
                    dbRec.from('recaudaciones').delete().neq('id', '__never__'),
                    dbRec.from('notas_recaudacion').delete().neq('id', '__never__'),
                    dbRec.from('divisores').delete().neq('id', '__never__')
                ]);

                // 2. Insertar nuevos datos
                const ops = [];
                if (datos.length > 0) {
                    ops.push(dbRec.from('recaudaciones').insert(
                        datos.map(d => ({
                            id: crypto.randomUUID(),
                            fecha: d.fecha,
                            tipo: d.tipo || 'Sin Tipo',
                            monto: Number(d.monto) || 0
                        }))
                    ));
                }
                if (notas.length > 0) {
                    ops.push(dbRec.from('notas_recaudacion').insert(
                        notas.map(n => ({
                            id: crypto.randomUUID(),
                            created_at: n.fecha || new Date().toISOString(),
                            autor: n.autor || 'Admin',
                            mensaje: n.mensaje || ''
                        }))
                    ));
                }
                const divEntries = Object.entries(divs).filter(([, v]) => v);
                if (divEntries.length > 0) {
                    ops.push(dbRec.from('divisores').insert(
                        divEntries.map(([fecha, valor]) => ({
                            id: fecha,
                            fecha,
                            valor: Number(valor)
                        }))
                    ));
                }
                if (ops.length > 0) await Promise.all(ops);
                return succ();
            } catch (e) { return err(e.message); }
        }

        // ── NOTAS ────────────────────────────────────────────────────
        if (action === 'getNotes') {
            try {
                const { data } = await dbRec.from('notas_recaudacion')
                    .select('*').order('created_at', { ascending: false });
                const mapped = (data || []).map(m => ({
                    uuid: m.id,
                    originalIndex: m.id,
                    fecha: m.created_at,
                    autor: m.autor || 'Admin',
                    mensaje: m.mensaje || '',
                    pinned: m.pinned || false,
                    reactions: m.reactions || {}
                }));
                mapped.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
                return ok({ data: mapped });
            } catch (e) { return ok({ data: [] }); }
        }

        if (action === 'addNote') {
            try {
                await dbRec.from('notas_recaudacion').insert({
                    id: crypto.randomUUID(),
                    autor: body.autor || 'Admin',
                    mensaje: body.mensaje || ''
                });
            } catch (e) { console.error('[supabase-config] addNote:', e); }
            return ok({ success: true });
        }

        if (action === 'deleteNote') {
            try {
                const noteId = body.index;
                if (noteId) await dbRec.from('notas_recaudacion').delete().eq('id', noteId);
            } catch (e) { console.error('[supabase-config] deleteNote:', e); }
            return ok({ success: true });
        }

        if (action === 'togglePin') {
            try {
                await dbRec.from('notas_recaudacion').update({ pinned: body.pinned }).eq('id', body.id);
                _notificarCambio();
            } catch(e) {}
            return ok({ success: true });
        }

        if (action === 'toggleReaction') {
            try {
                const { data: rd } = await dbRec.from('notas_recaudacion').select('reactions').eq('id', body.id).maybeSingle();
                const r = rd?.reactions || {};
                const arr = Array.isArray(r[body.emoji]) ? [...r[body.emoji]] : [];
                const user = body.user || 'Anon';
                const pos = arr.indexOf(user);
                if (body.add && pos === -1) arr.push(user);
                else if (!body.add && pos !== -1) arr.splice(pos, 1);
                if (arr.length === 0) delete r[body.emoji]; else r[body.emoji] = arr;
                await dbRec.from('notas_recaudacion').update({ reactions: r }).eq('id', body.id);
                _notificarCambio();
            } catch(e) {}
            return ok({ success: true });
        }

        // ── AQ_URL_GET sin acción → datos esperados para arqueo de caja ─────
        if (!action) {
            try {
                const [recRes, divRes] = await Promise.all([
                    dbRec.from('recaudaciones').select('fecha, tipo, monto, arqueado'),
                    dbRec.from('divisores').select('fecha, valor').order('fecha', { ascending: false }).limit(1)
                ]);
                const recs = recRes.data || [];
                const lastDivRow = (divRes.data || [])[0];
                const lastDivisor = lastDivRow ? Number(lastDivRow.valor) : 1;
                const lastDivisorDate = lastDivRow ? lastDivRow.fecha : '';

                // totalAcumulado ×100 — arqueo.js divide /100 para mostrar en pesos
                const totalAcumulado = recs.reduce((s, r) => s + Number(r.monto || 0), 0) * 100;

                // Recaudaciones del día con el último divisor
                const recsDelDia = lastDivisorDate ? recs.filter(r => r.fecha === lastDivisorDate) : [];
                const totalLastDivisorDay = recsDelDia.reduce((s, r) => s + Number(r.monto || 0), 0) * 100;

                // Desglose por tipo (×100)
                const tiposMap = {};
                recsDelDia.forEach(r => {
                    const t = r.tipo || 'Sin Tipo';
                    tiposMap[t] = (tiposMap[t] || 0) + Number(r.monto || 0);
                });
                const desgloseEsperado = Object.entries(tiposMap)
                    .map(([tipo, monto]) => ({ tipo, monto: monto * 100 }));

                // Recaudaciones pendientes de verificar en caja
                const sinVerificar = recs.filter(r => !r.arqueado).map(r => {
                    const p = (r.fecha || '').split('-');
                    return { tipo: r.tipo || 'Sin Tipo', fecha: r.fecha, label: `${r.tipo} (${p[2]}/${p[1]})` };
                });

                return _mockOk({ totalAcumulado, totalLastDivisorDay, lastDivisor, lastDivisorDate, desgloseEsperado, sinVerificar });
            } catch(e) {
                return _mockOk({ totalAcumulado: 0, totalLastDivisorDay: 0, lastDivisor: 1, lastDivisorDate: '', desgloseEsperado: [] });
            }
        }

        // Cualquier otra acción: pasar a GAS
        return _origFetch(url, options);
    };
})();

// ── Sincronización automática al recuperar conexión ───────────────────────────
window.addEventListener('online', () => {
    setTimeout(() => {
        if (typeof window._scSincronizar === 'function') window._scSincronizar();
    }, 1500); // esperar 1.5s para que la red se estabilice
});

// ── Verificar ops pendientes al cargar ────────────────────────────────────────
window.addEventListener('load', () => {
    setTimeout(() => {
        try {
            const pend = JSON.parse(localStorage.getItem('sc_ops_pendientes') || '[]');
            if (pend.length === 0) return;
            if (navigator.onLine) {
                // Hay conexión → sincronizar automáticamente
                if (typeof window._scSincronizar === 'function') window._scSincronizar();
            } else {
                // Sin conexión → avisar cuántos hay pendientes
                if (typeof showToast === 'function') {
                    showToast(`Sin conexión — ${pend.length} operación${pend.length !== 1 ? 'es' : ''} pendiente${pend.length !== 1 ? 's' : ''} 📶`, 'warning');
                }
            }
        } catch(e) {}
    }, 3000); // esperar 3s para que la app cargue y showToast esté disponible
});

// ── Realtime broadcast: recargar UI cuando otra app cambia datos ───────────────
window.addEventListener('load', () => {
    let _rt = null;
    _recBroadcast
        .on('broadcast', { event: 'changed' }, () => {
            clearTimeout(_rt);
            _rt = setTimeout(() => {
                if (typeof cargarRecaudaciones === 'function') cargarRecaudaciones(true);
                const notasTab = document.getElementById('tab-notas');
                if (notasTab && notasTab.classList.contains('active') && typeof notasCargar === 'function') notasCargar();
            }, 500);
        })
        .subscribe();
});
