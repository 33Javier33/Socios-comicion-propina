// ============================================================
// SUPABASE CONFIG — socios-comicion-propina
// Intercepta las llamadas a URL_RECAUDACIONES para notas (getNotes/addNote/deleteNote)
// y las redirige a la tabla notas_recaudacion en Supabase.
// El resto de las llamadas (action=get, importAll, etc.) pasan a GAS.
// ============================================================

const _SB_URL_REC = 'https://lpulmjzboogixbdxxayo.supabase.co';
const _SB_KEY_REC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdWxtanpib29naXhiZHh4YXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjY0NzMsImV4cCI6MjA5MTI0MjQ3M30.vjebyQb4Bb62ZQlNaJZveuxdBYDOmtC4bM7uwAilDzY';

const dbRec = supabase.createClient(_SB_URL_REC, _SB_KEY_REC);

// Interceptor: solo se activa cuando URL_RECAUDACIONES exista (cargada desde constants.js)
(function() {
    const _origFetch = window.fetch.bind(window);

    window.fetch = async function(url, options = {}) {
        const s = String(url);

        // Solo interceptar URL_RECAUDACIONES
        if (typeof URL_RECAUDACIONES === 'undefined' || !s.startsWith(URL_RECAUDACIONES)) {
            return _origFetch(url, options);
        }

        // Extraer action de query string o body
        let action = '';
        try {
            const qs = new URLSearchParams(s.split('?')[1] || '');
            action = qs.get('action') || '';
        } catch(e) {}

        if (!action && options && options.body) {
            try {
                const b = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
                action = b.action || '';
            } catch(e) {}
        }

        // Solo interceptar operaciones de notas
        if (action !== 'getNotes' && action !== 'addNote' && action !== 'deleteNote') {
            return _origFetch(url, options);
        }

        // ── Helpers ──────────────────────────────────────────────────
        const mockRes = (data) => ({
            ok: true, status: 200,
            json: async () => data,
            text: async () => JSON.stringify(data)
        });

        let body = {};
        if (options && options.body) {
            try { body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; } catch(e) {}
        }

        // ── getNotes ─────────────────────────────────────────────────
        if (action === 'getNotes') {
            const { data, error } = await dbRec
                .from('notas_recaudacion')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[supabase-config] getNotes error:', error);
                return mockRes({ data: [] });
            }

            const mapped = (data || []).map(m => ({
                uuid: m.id,
                originalIndex: m.id,   // UUID para deleteNote — NO usar parseInt
                fecha: m.created_at,
                autor: m.autor || 'Admin',
                mensaje: m.mensaje || ''
            }));

            return mockRes({ data: mapped });
        }

        // ── addNote ──────────────────────────────────────────────────
        if (action === 'addNote') {
            const { error } = await dbRec.from('notas_recaudacion').insert({
                id: crypto.randomUUID(),
                autor: body.autor || 'Admin',
                mensaje: body.mensaje || ''
            });
            if (error) console.error('[supabase-config] addNote error:', error);
            return mockRes({ success: true });
        }

        // ── deleteNote ───────────────────────────────────────────────
        if (action === 'deleteNote') {
            const noteId = body.index; // UUID (string) — notas.js ya no usa parseInt
            if (noteId) {
                const { error } = await dbRec.from('notas_recaudacion').delete().eq('id', noteId);
                if (error) console.error('[supabase-config] deleteNote error:', error);
            }
            return mockRes({ success: true });
        }

        return _origFetch(url, options);
    };
})();
