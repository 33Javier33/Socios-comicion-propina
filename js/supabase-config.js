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

    // ── Calcula puntos por fórmula para seed inicial ──────────────────────────
    function _calcularPuntosParaSeed(s) {
        try {
            const fechaStr = (s.FechaInicioPuntos && s.FechaInicioPuntos.trim()) ? s.FechaInicioPuntos.trim() : s.FechaIngreso;
            if (!fechaStr) return null;
            const partes = fechaStr.split('-');
            const año15 = parseInt(partes[0]);
            const mes15 = parseInt(partes[1]) - 1;
            const hoy = new Date();
            if (hoy < new Date(año15, mes15, 15)) return 0;
            let anios = hoy.getFullYear() - año15;
            if (hoy.getMonth() < mes15 || (hoy.getMonth() === mes15 && hoy.getDate() < 15)) anios--;
            if (anios < 0) anios = 0;
            const areaNorm = (s.Area || '').toLowerCase();
            if (areaNorm.includes('gastos')) return 1;
            let max = 10;
            if (areaNorm === 'mesas') max = 20;
            else if (areaNorm === 'maquinas') max = 12;
            else if (areaNorm === 'tecnicos') max = 12;
            else if (areaNorm === 'boveda') max = 10;
            else if (areaNorm.includes('cambista')) max = 8;
            return Math.min(4 + (anios * 2), max);
        } catch(e) { return null; }
    }

    // ── HANDLER: getSocios GET → mergea puntos desde tabla socios (misma que lee propi.solicitada) ──
    async function _socGetSociosHandler(url, options) {
        try {
            const [gasRaw, sbRaw] = await Promise.all([
                _origFetch(url, options).then(r => r.json()).catch(() => ({ status: 'error', data: [] })),
                _origFetch(_SB_URL_SOC + '/rest/v1/socios?select=id,puntos&activo=eq.true', {
                    headers: { 'apikey': _SB_KEY_SOC, 'Authorization': 'Bearer ' + _SB_KEY_SOC }
                }).then(r => r.ok ? r.json() : []).catch(() => [])
            ]);
            if (gasRaw.status !== 'success') return _mockOk(gasRaw);

            const sbPuntos = {};
            for (const row of (Array.isArray(sbRaw) ? sbRaw : [])) {
                // Solo registrar si es un valor positivo — 0 y null se tratan como "sin dato"
                const v = Number(row.puntos);
                if (Number.isFinite(v) && v > 0) sbPuntos[String(row.id)] = v;
            }

            // Agregar Puntos desde socios.puntos a cada socio de GAS (solo si > 0)
            const merged = (gasRaw.data || []).map(s => {
                const sp = sbPuntos[String(s.ID)];
                return sp !== undefined ? { ...s, Puntos: sp } : s;
            });

            // Seed background: actualizar socios.puntos para socios con 0 o null
            const toSeed = [];
            for (const s of (gasRaw.data || [])) {
                if (sbPuntos[String(s.ID)] !== undefined || !s.FechaIngreso) continue;
                const p = _calcularPuntosParaSeed(s);
                if (p !== null) toSeed.push({ id: String(s.ID), puntos: p });
            }
            toSeed.forEach(row => {
                _origFetch(_SB_URL_SOC + '/rest/v1/socios?id=eq.' + encodeURIComponent(row.id), {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': _SB_KEY_SOC,
                        'Authorization': 'Bearer ' + _SB_KEY_SOC,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ puntos: row.puntos })
                }).catch(() => {});
            });

            return _mockOk({ status: 'success', data: merged });
        } catch(e) {
            return _origFetch(url, options);
        }
    }

    // ── HANDLER: URL_SOCIOS POST (escrituras) ────────────────────────────────
    async function _socWriteHandler(url, options) {
        let body = {};
        if (options && options.body) {
            try { body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; } catch(e) {}
        }
        const action = body.action || '';

        // ── registrarBatchAnticipos → escribir en Supabase vía REST directo + GAS ──
        if (action === 'registrarBatchAnticipos') {
            const items = body.detalleAnticipos || [];
            items.forEach(a => {
                _origFetch(_SB_URL_SOC + '/rest/v1/anticipos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': _SB_KEY_SOC,
                        'Authorization': 'Bearer ' + _SB_KEY_SOC,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        id: crypto.randomUUID(),
                        socio_id: String(a.id),
                        monto: Number(a.monto || 0),
                        fecha: a.fecha,
                        responsable: ((a.responsable || '') + (a.areaResponsable ? ' ' + a.areaResponsable : '')).trim()
                    })
                }).then(async r => {
                    if (!r.ok) console.error('[sb] anticipo insert error:', await r.text());
                }).catch(e => console.error('[sb] anticipo insert ex:', e));
            });
            return _origFetch(url, options);
        }

        // ── registrarBatchExtras → escribir en Supabase vía REST directo + GAS ──
        if (action === 'registrarBatchExtras') {
            const items = body.detalleExtras || [];
            items.forEach(e => {
                _origFetch(_SB_URL_SOC + '/rest/v1/extras', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': _SB_KEY_SOC,
                        'Authorization': 'Bearer ' + _SB_KEY_SOC,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        id: crypto.randomUUID(),
                        socio_id: String(e.id),
                        fecha: e.fecha,
                        tipo: e.tipo || 'extra',
                        monto: Number(e.monto || 0),
                        detalle: e.detalle || ''
                    })
                }).then(async r => {
                    if (!r.ok) console.error('[sb] extras insert error:', await r.text());
                }).catch(e => console.error('[sb] extras insert ex:', e));
            });
            return _origFetch(url, options);
        }

        // ── borrarMovimiento → borrar de Supabase + GAS ───────────────
        if (action === 'borrarMovimiento') {
            const uuid = body.uuid;
            const tipo = (body.tipo || '').toLowerCase();
            const tbl = (tipo === 'anticipo' || tipo === 'anticipos') ? 'anticipos' : 'extras';
            dbSoc.from(tbl).delete().eq('id', uuid)
                .then(() => {}).catch(e => console.error('[supabase-config] borrar:', e));
            return _origFetch(url, options);
        }

        // ── actualizarAnticipo → actualizar en Supabase + GAS ─────────
        if (action === 'actualizarAnticipo') {
            dbSoc.from('anticipos').update({
                fecha: body.fecha,
                monto: Number(body.monto || 0),
                responsable: (body.responsable || '') + (body.areaResponsable ? ' ' + body.areaResponsable : '')
            }).eq('id', body.uuid)
                .then(() => {}).catch(e => console.error('[supabase-config] actualizar:', e));
            return _origFetch(url, options);
        }

        // ── updateSocio con Puntos → actualizar socios.puntos (misma tabla que lee propi.solicitada) ─
        if (action === 'updateSocio' && body.updates && body.updates.Puntos !== undefined) {
            const socioId = String(body.socioId || '');
            if (socioId) {
                dbSoc.from('socios').update({ puntos: Number(body.updates.Puntos) })
                    .eq('id', socioId)
                    .then(() => {}).catch(e => console.error('[sb] socios.puntos update:', e));
            }
            return _origFetch(url, options);
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
                // GET: interceptar getSocios para mergear puntos de Supabase
                let action = '';
                try { action = new URLSearchParams(s.split('?')[1] || '').get('action') || ''; } catch(e) {}
                if (action === 'getSocios') return _socGetSociosHandler(s, options);
                return _origFetch(url, options);
            }
            return _socWriteHandler(s, options);
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
                    registrado_por_nombre: r.registrado_por_nombre || null
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

        // Cualquier otra acción: pasar a GAS
        return _origFetch(url, options);
    };
})();

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
