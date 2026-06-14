// ============================================================
// SUPABASE CONFIG — socios-comicion-propina
// Intercepta las llamadas a URL_RECAUDACIONES y las redirige a
// las tablas recaudaciones, divisores y notas_recaudacion en
// Supabase (lpulmjzboogixbdxxayo).
// Todas las llamadas a URL_SOCIOS siguen yendo a GAS.
// ============================================================

const _SB_URL_REC = 'https://lpulmjzboogixbdxxayo.supabase.co';
const _SB_KEY_REC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdWxtanpib29naXhiZHh4YXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjY0NzMsImV4cCI6MjA5MTI0MjQ3M30.vjebyQb4Bb62ZQlNaJZveuxdBYDOmtC4bM7uwAilDzY';

const dbRec = supabase.createClient(_SB_URL_REC, _SB_KEY_REC);

// Canal compartido para notificar/recibir cambios en tiempo real
const _recBroadcast = dbRec.channel('rec-data-sync');
const _notificarCambio = () => _recBroadcast.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => {});

(function () {
    const _origFetch = window.fetch.bind(window);

    window.fetch = async function (url, options = {}) {
        const s = String(url);

        // Solo interceptar URL_RECAUDACIONES
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
                    divisor: divMap[r.fecha] || null
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
                    .select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
                return ok({
                    data: (data || []).map(m => ({
                        uuid: m.id,
                        originalIndex: m.id,
                        fecha: m.created_at,
                        autor: m.autor || 'Admin',
                        mensaje: m.mensaje || '',
                        pinned: m.pinned || false,
                        reactions: m.reactions || {}
                    }))
                });
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
                if (body.add) r[body.emoji] = (r[body.emoji] || 0) + 1;
                else { r[body.emoji] = Math.max(0, (r[body.emoji] || 0) - 1); if (r[body.emoji] === 0) delete r[body.emoji]; }
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
            _rt = setTimeout(() => { if (typeof cargarRecaudaciones === 'function') cargarRecaudaciones(true); }, 500);
        })
        .subscribe();
});
