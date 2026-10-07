// ══════════════════════════════════════════════════════════════════════
// SOCIOS ELIMINADOS — el respaldo de lo que se borró
//
// Antes, al eliminar un socio pasaba una de dos cosas y ninguna dejaba
// dónde mirar:
//   · sin movimientos → se borraba de verdad y solo quedaba una línea en
//     la auditoría;
//   · con movimientos → se desactivaba y su historial seguía en las
//     tablas, pero no había pantalla que lo mostrara.
//
// Ahora, ANTES de borrar o desactivar, se guarda una foto completa: la
// ficha de gestión y todos sus movimientos de anticipos y ausencias. La
// foto es independiente de lo que pase después con las tablas vivas.
//
// `elim_recuperar()` arma esa foto para los que ya estaban dados de baja
// antes de que esto existiera, y para los registros huérfanos —
// movimientos cuyo socio ya no está en la tabla.
// ══════════════════════════════════════════════════════════════════════

// socio_id en todas; `saldos_socio` guarda el socio en `id`.
const ELIM_TABLAS = [
    { t: 'anticipos',            col: 'socio_id', etq: 'Anticipos' },
    { t: 'extras',               col: 'socio_id', etq: 'Ausencias y extras' },
    { t: 'retiros_anticipos',    col: 'socio_id', etq: 'Retiros' },
    { t: 'anticipos_historial',  col: 'socio_id', etq: 'Historial de anticipos' },
    { t: 'cierres_mes',          col: 'socio_id', etq: 'Cierres de mes' },
    { t: 'cierres_mes_historial',col: 'socio_id', etq: 'Historial de cierres' },
    { t: 'saldos_socio',         col: 'id',       etq: 'Saldos' },
    { t: 'dias_pt',              col: 'socio_id', etq: 'Días Part-Time' },
    { t: 'documentos',           col: 'socio_id', etq: 'Documentos' },
    { t: 'horarios_excepciones', col: 'socio_id', etq: 'Turnos del calendario' },
    { t: 'horarios_vacaciones',  col: 'socio_id', etq: 'Vacaciones' }
];

let _elimLista = null;        // null = no consultado todavía
let _elimHayTabla = true;

function _elimQuien() {
    try {
        const s = (typeof getSesionResponsableObj === 'function') ? getSesionResponsableObj() : {};
        return s.ini ? (s.ini + (s.area ? ' (' + s.area + ')' : '')) : 'Administración';
    } catch (e) { return 'Administración'; }
}

// La foto completa de un socio. Se consulta tabla por tabla y lo que no
// exista se anota como tal: es preferible un respaldo con huecos
// declarados a uno que calla lo que no pudo leer.
async function elim_snapshot(socioId) {
    const sid = String(socioId || '');
    const datos = { socio_id: sid, tomado_en: new Date().toISOString(), tablas: {}, errores: {} };
    try {
        const { data } = await dbSoc.from('socios').select('*').eq('id', sid).limit(1);
        datos.ficha = (data || [])[0] || null;
    } catch (e) { datos.ficha = null; datos.errores.socios = e.message || String(e); }

    for (const d of ELIM_TABLAS) {
        try {
            const { data, error } = await dbSoc.from(d.t).select('*').eq(d.col, sid);
            if (error) throw error;
            datos.tablas[d.t] = data || [];
        } catch (e) { datos.errores[d.t] = e.message || String(e); }
    }
    // Lo calculado también se guarda: dentro de un año nadie va a poder
    // recalcular el alcance de un período que ya no existe.
    try {
        const s = (cacheSocios || []).find(x => String(x.id) === sid);
        if (s) datos.calculado = {
            puntos: s.puntos, anios: s.anios, area: s.area, contrato: s.contrato,
            fechaIngreso: s.fechaIngreso, fechaInicioPuntos: s.fechaInicioPuntos
        };
    } catch (e) {}
    return datos;
}

// Guarda el respaldo. Devuelve true si quedó escrito.
async function elim_guardar(socioId, modo) {
    try {
        const datos = await elim_snapshot(socioId);
        const f = datos.ficha || {};
        const s = (cacheSocios || []).find(x => String(x.id) === String(socioId)) || {};
        const { error } = await dbSoc.from('socios_eliminados').insert({
            id: (crypto.randomUUID ? crypto.randomUUID() : 'el' + Date.now() + Math.random().toString(36).slice(2)),
            socio_id: String(socioId),
            nombre: f.nombre || s.nombre || null,
            apellido: f.apellido || s.apellido || null,
            rut: f.rut || s.rut || null,
            correo: f.correo || s.correo || null,
            area: f.area || s.area || null,
            contrato: f.tipo_contrato || f.contrato || s.contrato || null,
            puntos: (f.puntos !== undefined && f.puntos !== null) ? f.puntos : (s.puntos ?? null),
            fecha_ingreso: f.fecha_ingreso || s.fechaIngreso || null,
            modo: modo || 'eliminado',
            // La fecha se escribe desde acá y no se deja al `default now()`
            // de la tabla: así el respaldo ya la trae sin tener que volver a
            // leerlo de la base, y el nombre del archivo descargado y la
            // ficha no salen con un guion donde va la fecha.
            eliminado_en: new Date().toISOString(),
            eliminado_por: _elimQuien(),
            datos
        });
        if (error) throw error;
        _elimLista = null;       // la lista se vuelve a pedir
        return true;
    } catch (e) {
        console.warn('[eliminados] no se pudo respaldar:', e && e.message);
        return false;
    }
}

async function elim_cargar(forzar) {
    if (_elimLista && !forzar) return _elimLista;
    try {
        const { data, error } = await dbSoc.from('socios_eliminados')
            .select('*').order('eliminado_en', { ascending: false });
        if (error) throw error;
        _elimHayTabla = true;
        _elimLista = data || [];
    } catch (e) {
        _elimHayTabla = false;
        _elimLista = [];
    }
    return _elimLista;
}

// ── La sección ──────────────────────────────────────────────
function elim_abrir() {
    const m = document.getElementById('modalEliminados');
    if (!m) return;
    m.style.display = 'block';
    elim_render(true);
}
function elim_cerrar() {
    const m = document.getElementById('modalEliminados');
    if (m) m.style.display = 'none';
}

function _elimEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function _elimFecha(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch (e) { return String(iso).substring(0, 16); }
}
function _elimCuenta(d) {
    const t = (d && d.tablas) || {};
    return Object.values(t).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
}

async function elim_render(forzar) {
    const cont = document.getElementById('elimLista');
    if (!cont) return;
    cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">⏳ Cargando…</div>';
    const lista = await elim_cargar(forzar);

    if (!_elimHayTabla) {
        cont.innerHTML = '<div style="background:#fef3c7;border:1.5px solid #f59e0b;border-radius:10px;padding:12px 14px;">'
            + '<div style="font-weight:800;color:#92400e;font-size:0.9em;margin-bottom:4px;">Falta crear la tabla del respaldo</div>'
            + '<div style="font-size:0.82em;color:#92400e;line-height:1.5;">Está <b>migracion-socios-eliminados.sql</b> en la raíz del repositorio: '
            + 'pégalo en Supabase → SQL Editor y vuelve a abrir esta sección.<br>'
            + 'Mientras tanto, <b>los borrados no se están respaldando</b>.</div></div>';
        return;
    }

    const term = (document.getElementById('elimBuscar')?.value || '').toLowerCase().trim();
    const vis = lista.filter(r => !term
        || ((r.nombre || '') + ' ' + (r.apellido || '') + ' ' + (r.rut || '') + ' ' + (r.socio_id || ''))
            .toLowerCase().includes(term));

    if (!lista.length) {
        cont.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.86em;">'
            + 'No hay socios eliminados respaldados.<br>'
            + '<span style="font-size:0.9em;">Si ya eliminaste a alguien antes de que esto existiera, usa «Buscar los que faltan».</span></div>';
        return;
    }
    if (!vis.length) { cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">Sin coincidencias.</div>'; return; }

    cont.innerHTML = vis.map(r => {
        const n = _elimCuenta(r.datos);
        const col = r.modo === 'desactivado' ? '#b45309' : (r.modo === 'recuperado' ? '#1d4ed8' : '#b91c1c');
        const txt = r.modo === 'desactivado' ? 'Dado de baja' : (r.modo === 'recuperado' ? 'Recuperado' : 'Eliminado');
        return '<div class="card" style="padding:11px 13px;margin-bottom:8px;">'
            + '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;">'
            + '<div style="flex:1;min-width:0;">'
            +   '<div style="font-weight:800;font-size:0.92em;">' + _elimEsc((r.nombre || '') + ' ' + (r.apellido || '')).trim() + '</div>'
            +   '<div style="font-size:0.75em;color:#64748b;margin-top:2px;">'
            +     _elimEsc(r.area || '—') + ' · ' + _elimEsc(r.contrato || '—')
            +     (r.rut ? ' · ' + _elimEsc(r.rut) : '')
            +     ' · ' + (r.puntos != null ? r.puntos + ' pts' : '— pts') + '</div>'
            +   '<div style="font-size:0.73em;color:#64748b;margin-top:2px;">'
            +     '🗓 ' + _elimFecha(r.eliminado_en) + ' · por ' + _elimEsc(r.eliminado_por || '—') + '</div>'
            + '</div>'
            + '<span style="background:' + col + '22;border:1px solid ' + col + ';color:' + col
            +   ';border-radius:20px;padding:1px 9px;font-size:0.7em;font-weight:800;white-space:nowrap;">' + txt + '</span>'
            + '</div>'
            + '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">'
            + '<span style="font-size:0.74em;color:#475569;align-self:center;flex:1;min-width:0;">'
            +   (n ? '📦 ' + n + ' registro' + (n === 1 ? '' : 's') + ' guardados' : 'Sin movimientos') + '</span>'
            + '<button onclick="elim_ver(\'' + r.id + '\')" class="btn-card" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:0.76em;padding:4px 10px;">👁 Ver todo</button>'
            + '<button onclick="elim_exportar(\'' + r.id + '\')" class="btn-card" style="background:#f0fdf4;border:1px solid #86efac;color:#15803d;font-size:0.76em;padding:4px 10px;">⬇ Descargar</button>'
            + '</div></div>';
    }).join('');
}

function elim_ver(id) {
    const r = (_elimLista || []).find(x => x.id === id);
    if (!r) return;
    const d = r.datos || {};
    const f = d.ficha || {};
    const fila = (k, v) => '<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dashed rgba(148,163,184,0.3);">'
        + '<span style="color:#64748b;font-size:0.8em;">' + _elimEsc(k) + '</span>'
        + '<span style="font-weight:700;font-size:0.8em;text-align:right;">' + _elimEsc(v == null || v === '' ? '—' : v) + '</span></div>';

    let html = '<h3 style="margin:0 0 3px;font-weight:800;">' + _elimEsc((r.nombre || '') + ' ' + (r.apellido || '')).trim() + '</h3>'
        + '<div style="font-size:0.76em;color:#64748b;margin-bottom:12px;">'
        + 'Respaldo del ' + _elimFecha(r.eliminado_en) + ' · por ' + _elimEsc(r.eliminado_por || '—') + '</div>';

    html += '<div style="font-size:0.78em;font-weight:800;color:#475569;text-transform:uppercase;margin-bottom:4px;">Su ficha</div>';
    html += fila('ID', r.socio_id) + fila('RUT', r.rut) + fila('Correo', r.correo)
         + fila('Área', r.area) + fila('Contrato', r.contrato)
         + fila('Puntos', r.puntos) + fila('Fecha de ingreso', r.fecha_ingreso)
         + fila('Inicio de puntos', (d.calculado || {}).fechaInicioPuntos)
         + fila('Años cumplidos', (d.calculado || {}).anios)
         + fila('Estado al borrar', r.modo);

    html += '<div style="font-size:0.78em;font-weight:800;color:#475569;text-transform:uppercase;margin:14px 0 4px;">Lo que tenía guardado</div>';
    const tablas = d.tablas || {};
    const hay = ELIM_TABLAS.filter(x => Array.isArray(tablas[x.t]) && tablas[x.t].length);
    html += hay.length
        ? hay.map(x => fila(x.etq, tablas[x.t].length + ' registro' + (tablas[x.t].length === 1 ? '' : 's'))).join('')
        : '<div style="font-size:0.8em;color:#64748b;padding:4px 0;">No tenía movimientos registrados.</div>';

    const errs = Object.keys(d.errores || {});
    if (errs.length) {
        html += '<div style="margin-top:12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px 10px;font-size:0.76em;color:#92400e;">'
             + '⚠️ No se pudo leer: <b>' + errs.map(_elimEsc).join(', ') + '</b>. El respaldo guarda el resto.</div>';
    }

    html += '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">'
         + '<button onclick="elim_exportar(\'' + r.id + '\')" class="btn-action" style="flex:1;background:#16a34a;">⬇ Descargar todo (JSON)</button>'
         + '<button onclick="elim_verCrudo(\'' + r.id + '\')" class="btn-action" style="flex:1;background:#475569;">🧾 Ver el detalle</button>'
         + '</div>';

    document.getElementById('elimDetalleBody').innerHTML = html;
    document.getElementById('modalElimDetalle').style.display = 'block';
}

function elim_verCrudo(id) {
    const r = (_elimLista || []).find(x => x.id === id);
    if (!r) return;
    document.getElementById('elimDetalleBody').innerHTML =
        '<h3 style="margin:0 0 8px;font-weight:800;">🧾 Detalle completo</h3>'
        + '<button onclick="elim_ver(\'' + r.id + '\')" class="btn-card" style="margin-bottom:10px;font-size:0.78em;padding:4px 10px;">‹ Volver</button>'
        + '<pre style="background:#0f172a;color:#e2e8f0;border-radius:8px;padding:11px;font-size:10.5px;'
        + 'line-height:1.45;overflow:auto;max-height:55vh;white-space:pre-wrap;word-break:break-word;">'
        + _elimEsc(JSON.stringify(r.datos, null, 2)) + '</pre>';
}

function elim_exportar(id) {
    const r = (_elimLista || []).find(x => x.id === id);
    if (!r) return;
    const nombre = ((r.nombre || '') + '_' + (r.apellido || '')).trim().replace(/[^a-zA-Z0-9_]/g, '_') || r.socio_id;
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'socio_eliminado_' + nombre + '_' + String(r.eliminado_en || '').substring(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    if (typeof showToast === 'function') showToast('Respaldo descargado', 'success');
}

// ── Recuperar lo que ya estaba borrado ──────────────────────
// Dos fuentes: los socios dados de baja (activo = false) que no tienen
// respaldo, y los movimientos huérfanos — registros cuyo socio_id ya no
// está en la tabla `socios`.
async function elim_recuperar() {
    if (!confirm('Buscar socios dados de baja y movimientos sin dueño, y armarles un respaldo.\n\n'
        + 'No borra ni cambia nada: solo lee y guarda la foto de lo que haya.\n\n¿Seguir?')) return;
    if (typeof toggleLoader === 'function') toggleLoader(true, 'Buscando…');
    let nuevos = 0, yaEstaban = 0, huerfanos = 0;
    try {
        const yaRespaldados = new Set((await elim_cargar(true)).map(r => String(r.socio_id)));

        // 1. Los dados de baja.
        const { data: bajas } = await dbSoc.from('socios').select('id').eq('activo', false);
        for (const s of (bajas || [])) {
            if (yaRespaldados.has(String(s.id))) { yaEstaban++; continue; }
            if (await elim_guardar(s.id, 'recuperado')) { nuevos++; yaRespaldados.add(String(s.id)); }
        }

        // 2. Los huérfanos: ids que aparecen en movimientos y ya no están
        //    en `socios`. De estos no queda ficha, pero sí sus movimientos.
        const { data: vivos } = await dbSoc.from('socios').select('id');
        const idsVivos = new Set((vivos || []).map(x => String(x.id)));
        const idsMov = new Set();
        for (const d of ELIM_TABLAS) {
            try {
                const { data } = await dbSoc.from(d.t).select(d.col);
                (data || []).forEach(r => { const v = r[d.col]; if (v) idsMov.add(String(v)); });
            } catch (e) {}
        }
        for (const id of idsMov) {
            if (idsVivos.has(id) || yaRespaldados.has(id)) continue;
            if (await elim_guardar(id, 'recuperado')) { huerfanos++; yaRespaldados.add(id); }
        }

        await elim_render(true);
        const msg = nuevos || huerfanos
            ? `✅ ${nuevos} dado(s) de baja y ${huerfanos} sin ficha respaldados`
            : 'No había nada nuevo que respaldar';
        if (typeof showToast === 'function') showToast(msg, 'success');
        if (typeof sbAuditLog === 'function') sbAuditLog('Respaldo Socios Eliminados', {
            detalle: `Recuperación: ${nuevos} dados de baja, ${huerfanos} sin ficha, ${yaEstaban} ya estaban`,
            datos: { nuevos, huerfanos, yaEstaban }
        });
    } catch (e) {
        if (typeof showToast === 'function') showToast('No se pudo completar: ' + (e.message || e), 'error');
    } finally {
        if (typeof toggleLoader === 'function') toggleLoader(false);
    }
}
