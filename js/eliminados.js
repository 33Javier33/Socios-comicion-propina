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
         + '<button onclick="elim_verRegistros(\'' + r.id + '\')" class="btn-action" style="flex:1;background:#1d4ed8;">🧾 Ver el detalle</button>'
         + '<button onclick="elim_exportar(\'' + r.id + '\')" class="btn-action" style="flex:1;background:#16a34a;">⬇ Descargar todo</button>'
         + '</div>';

    document.getElementById('elimDetalleBody').innerHTML = html;
    document.getElementById('modalElimDetalle').style.display = 'block';
}

// ══════════════════════════════════════════════════════════════════════
// EL DETALLE, LEGIBLE
//
// Antes este botón mostraba el JSON crudo del respaldo. Servía para
// comprobar que el dato estaba, pero no para leerlo: nadie necesita ver
// `{"socio_id":"12","monto":45000}`, necesita ver «Monto $45.000».
//
// Ahora el respaldo se arma en tablas, con los nombres de columna en
// castellano y los montos y fechas con el mismo formato que en el resto
// de la app. Nada se esconde: las columnas que no están en el diccionario
// igual salen, con su nombre tal cual. El JSON sigue disponible al final
// para quien lo necesite de verdad.
// ══════════════════════════════════════════════════════════════════════

// Nombres legibles de columna. Lo que no esté acá sale con su nombre de
// base de datos, con los guiones bajos cambiados por espacios.
const ELIM_COL_ETQ = {
    id: 'ID', fecha: 'Fecha', monto: 'Monto', tipo: 'Tipo', detalle: 'Detalle',
    autor: 'Registró', responsable: 'Responsable', estado: 'Estado',
    periodo: 'Período', cantidad: 'Cantidad', firma: 'Firma',
    fecha_archivo: 'Archivado el', fecha_cierre: 'Fecha de cierre',
    actualizado_en: 'Actualizado', updated_at: 'Actualizado', created_at: 'Creado',
    nombre: 'Nombre', apellido: 'Apellido', socio_nombre: 'Socio',
    a_pagar: 'A pagar', remanente: 'Remanente', alcance: 'Alcance',
    saldo_anterior: 'Saldo anterior', anticipos_total: 'Total de anticipos',
    anticipos: 'Anticipos', estado_cobro: 'Estado de cobro', billetes: 'Billetes',
    dias: 'Días', dias_pt: 'Días Part-Time', puntos: 'Puntos',
    nombre_archivo: 'Archivo', storage_path: 'Ruta en el almacén',
    mime: 'Tipo de archivo', tamano: 'Tamaño', subido_por: 'Subió',
    categoria: 'Categoría', turno_id: 'Turno',
    fecha_inicio: 'Desde', fecha_regreso: 'Regresa', fecha_fin: 'Hasta',
    fecha_ingreso: 'Fecha de ingreso', fecha_inicio_puntos: 'Inicio de puntos',
    anio: 'Año', mes: 'Mes', area: 'Área', contrato: 'Contrato',
    tipo_contrato: 'Contrato', rut: 'RUT', correo: 'Correo',
    telefono: 'Teléfono', activo: 'Activo', valor: 'Valor', clave: 'Dato',
    anios: 'Años cumplidos', motivo: 'Motivo', observacion: 'Observación',
    // Lo calculado viene en camelCase, no en columnas de base de datos.
    fechaIngreso: 'Fecha de ingreso', fechaInicioPuntos: 'Inicio de puntos',
    fechaRegreso: 'Regresa', fechaInicio: 'Desde', tomado_en: 'Respaldo tomado el'
};

// El id del socio ya está en la ficha; repetirlo en cada fila de cada
// tabla solo gasta ancho de pantalla.
const ELIM_COL_OCULTAS = ['id', 'socio_id', 'uuid', 'uuid_ref'];

// Orden de lectura: primero cuándo, después qué y cuánto, al final quién.
const ELIM_COL_ORDEN = ['fecha', 'fecha_inicio', 'fecha_regreso', 'fecha_fin', 'tipo',
    'turno_id', 'dias', 'monto', 'cantidad', 'alcance', 'saldo_anterior',
    'anticipos_total', 'remanente', 'a_pagar', 'detalle', 'motivo', 'observacion',
    'nombre_archivo', 'estado', 'estado_cobro', 'periodo', 'responsable', 'autor',
    'subido_por', 'fecha_cierre', 'fecha_archivo', 'actualizado_en', 'updated_at'];

const ELIM_COL_DINERO = ['monto', 'a_pagar', 'remanente', 'alcance', 'saldo_anterior',
    'anticipos_total', 'total', 'valor_punto'];

// Una columna que no esté en el diccionario igual tiene que leerse:
// `fecha_cierre` → «Fecha cierre», `fechaInicioPuntos` → «Fecha inicio puntos».
function _elimEtqCol(k) {
    if (ELIM_COL_ETQ[k]) return ELIM_COL_ETQ[k];
    const s = String(k).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, (m, a, b) => a + ' ' + b.toLowerCase());
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function _elimDinero(n) {
    const v = Number(n);
    if (!isFinite(v)) return String(n);
    return (typeof formatearMoneda === 'function')
        ? formatearMoneda(v)
        : '$' + Math.round(v).toLocaleString('es-CL');
}

function _elimEsColFecha(k) { return /^fecha/.test(k) || /_(en|at)$/.test(k); }

// 2026-10-08 → 08-10-2026 · con hora → 08-10-2026 14:30
function _elimFechaCorta(v) {
    const s = String(v || '');
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return s || '—';
    const d = m[3] + '-' + m[2] + '-' + m[1];
    return m[4] ? d + ' ' + m[4] + ':' + m[5] : d;
}

function _elimTamano(b) {
    const n = Number(b);
    if (!isFinite(n) || n <= 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
}

const _ELIM_VACIO = '<span style="color:#94a3b8;">—</span>';

// Un valor cualquiera del respaldo, convertido a algo que se pueda leer.
// Devuelve HTML ya escapado.
function _elimValor(k, v) {
    if (v === null || v === undefined || v === '') return _ELIM_VACIO;
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';

    if (Array.isArray(v)) {
        if (!v.length) return _ELIM_VACIO;
        // Lista simple (lo habitual: fechas de días PT o de vacaciones).
        if (v.every(x => x === null || typeof x !== 'object')) {
            const txt = v.map(x => /^\d{4}-\d{2}-\d{2}/.test(String(x)) ? _elimFechaCorta(x) : String(x));
            return '<span style="font-weight:600;">' + v.length + '</span> · ' + _elimEsc(txt.join(' · '));
        }
        // Lista de registros (ej. los anticipos guardados dentro de un cierre).
        const suma = v.reduce((s, x) => s + Number((x && (x.monto != null ? x.monto : x.cantidad)) || 0), 0);
        return _elimEsc(v.length + ' registro' + (v.length === 1 ? '' : 's') + (suma ? ' · ' + _elimDinero(suma) : ''));
    }

    if (typeof v === 'object') {
        const ks = Object.keys(v);
        if (!ks.length) return _ELIM_VACIO;
        // Desglose de billetes: { "20000": 3, "10000": 1 } → 20.000 × 3
        if (ks.every(x => /^\d+$/.test(x))) {
            const t = ks.map(Number).sort((a, b) => b - a).filter(x => Number(v[x]) > 0)
                .map(x => x.toLocaleString('es-CL') + ' × ' + v[x]);
            return t.length ? _elimEsc(t.join(' · ')) : _ELIM_VACIO;
        }
        return _elimEsc(ks.map(x => _elimEtqCol(x) + ': '
            + (v[x] && typeof v[x] === 'object' ? JSON.stringify(v[x]) : String(v[x] == null ? '—' : v[x]))).join(' · '));
    }

    // Los estados están guardados como etiquetas de sistema: `en_sobre`,
    // `ARCHIVADO`. Se muestran como se dicen.
    if (/^estado/.test(k) || k === 'modo' || k === 'categoria') {
        const s = String(v).replace(/_/g, ' ').toLowerCase();
        return _elimEsc(s.charAt(0).toUpperCase() + s.slice(1));
    }
    if (ELIM_COL_DINERO.indexOf(k) >= 0) return _elimEsc(_elimDinero(v));
    if (k === 'tamano') return _elimEsc(_elimTamano(v));
    if (_elimEsColFecha(k) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return _elimEsc(_elimFechaCorta(v));

    // Texto largo (una ruta, una URL de foto): se corta para que no rompa
    // la tabla, pero el valor completo queda en el title.
    const s = String(v);
    if (s.length > 140) return '<span title="' + _elimEsc(s) + '">' + _elimEsc(s.slice(0, 137)) + '…</span>';
    return _elimEsc(s);
}

function _elimCols(rows) {
    const cols = [];
    (rows || []).forEach(r => Object.keys(r || {}).forEach(k => {
        if (cols.indexOf(k) < 0 && ELIM_COL_OCULTAS.indexOf(k) < 0) cols.push(k);
    }));
    const pos = k => { const i = ELIM_COL_ORDEN.indexOf(k); return i < 0 ? 900 : i; };
    cols.sort((a, b) => (pos(a) - pos(b)) || a.localeCompare(b));
    return cols;
}

// Los registros de una tabla, en una tabla de verdad. Con scroll propio
// para que en el teléfono se pueda correr de lado sin mover el modal.
function _elimTablaHTML(rows) {
    const cols = _elimCols(rows);
    if (!cols.length) return '<div style="font-size:0.8em;color:#64748b;padding:6px 0;">Los registros están guardados, pero sin columnas que mostrar.</div>';

    // Orden cronológico: se lee como una cartola.
    const fcol = cols.filter(c => _elimEsColFecha(c))[0];
    const orden = rows.slice();
    if (fcol) orden.sort((a, b) => String((a || {})[fcol] || '').localeCompare(String((b || {})[fcol] || '')));

    // Más de cinco columnas no entran en ninguna pantalla sin obligar a
    // correr la tabla de lado media hora. Esos registros —un cierre de
    // mes, un documento— se muestran uno abajo del otro, campo por campo.
    // Son pocos: lo que tiene muchas filas (anticipos, extras) tiene pocas
    // columnas, y al revés.
    if (cols.length > 5) {
        return orden.map((r, i) => {
            const limpio = {};
            cols.forEach(c => { if ((r || {})[c] !== undefined) limpio[c] = r[c]; });
            return '<div style="border:1px solid rgba(148,163,184,0.35);border-radius:8px;padding:8px 10px;'
                + (i ? 'margin-top:8px;' : '') + '">'
                + (orden.length > 1 ? '<div style="font-size:0.72em;font-weight:800;color:#64748b;margin-bottom:3px;">'
                    + 'Registro ' + (i + 1) + ' de ' + orden.length + '</div>' : '')
                + _elimFichaHTML(limpio) + '</div>';
        }).join('');
    }

    // Hasta tres columnas caben hasta en un teléfono; de ahí para arriba
    // se le pone un ancho mínimo y la tabla se corre de lado sola.
    const ancho = cols.length <= 3 ? '' : 'min-width:' + Math.min(cols.length * 105, 720) + 'px;';

    let h = '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid rgba(148,163,184,0.35);border-radius:8px;">'
        + '<table style="width:100%;border-collapse:collapse;font-size:0.76em;' + ancho + '">'
        + '<thead><tr style="background:rgba(148,163,184,0.18);">'
        + cols.map(c => '<th style="padding:6px 8px;font-weight:800;white-space:nowrap;'
            + 'text-align:' + (ELIM_COL_DINERO.indexOf(c) >= 0 ? 'right' : 'left') + ';'
            + 'border-bottom:1px solid rgba(148,163,184,0.35);">' + _elimEsc(_elimEtqCol(c)) + '</th>').join('')
        + '</tr></thead><tbody>';

    h += orden.map((r, i) => '<tr style="' + (i % 2 ? 'background:rgba(148,163,184,0.08);' : '') + '">'
        + cols.map(c => '<td style="padding:5px 8px;vertical-align:top;border-bottom:1px solid rgba(148,163,184,0.18);'
            + (ELIM_COL_DINERO.indexOf(c) >= 0 ? 'text-align:right;white-space:nowrap;font-weight:700;' : '')
            + (_elimEsColFecha(c) ? 'white-space:nowrap;' : '') + '">'
            + _elimValor(c, (r || {})[c]) + '</td>').join('') + '</tr>').join('');

    // Pie con el total de las columnas de dinero, si hay más de una fila.
    const dinero = cols.filter(c => ELIM_COL_DINERO.indexOf(c) >= 0);
    if (dinero.length && orden.length > 1) {
        h += '<tr style="background:rgba(148,163,184,0.22);font-weight:800;">'
            + cols.map((c, i) => {
                if (dinero.indexOf(c) >= 0) {
                    const t = orden.reduce((s, r) => s + Number(((r || {})[c]) || 0), 0);
                    return '<td style="padding:6px 8px;text-align:right;white-space:nowrap;">' + _elimEsc(_elimDinero(t)) + '</td>';
                }
                return '<td style="padding:6px 8px;">' + (i === 0 ? 'Total' : '') + '</td>';
            }).join('') + '</tr>';
    }
    h += '</tbody></table></div>';
    // En el teléfono una tabla de cuatro o más columnas no cabe entera.
    // El aviso solo sale en pantalla chica (ver `_elimEstilos`).
    if (cols.length >= 4) h += '<div class="elim-corre">↔ Corre la tabla de lado para ver el resto.</div>';
    return h;
}

// Lo único que no se puede hacer con estilos en línea es una consulta de
// medios, y el aviso de «corre la tabla» solo tiene sentido en pantalla
// chica. Se agrega una sola vez.
function _elimEstilos() {
    if (document.getElementById('elimEstilos')) return;
    const s = document.createElement('style');
    s.id = 'elimEstilos';
    s.textContent = '.elim-corre{display:none;font-size:0.7em;color:#64748b;margin-top:4px;}'
        + '@media (max-width:700px){.elim-corre{display:block;}}';
    document.head.appendChild(s);
}

// La ficha completa tal como estaba al momento del borrado, campo por
// campo. Lo que `elim_ver` muestra arriba es el resumen; acá va todo.
function _elimFichaHTML(ficha) {
    const ks = Object.keys(ficha || {});
    if (!ks.length) return '<div style="font-size:0.8em;color:#64748b;padding:4px 0;">'
        + 'De este socio no quedó ficha: ya no estaba en la tabla cuando se armó el respaldo. '
        + 'Sus movimientos sí están más abajo.</div>';
    const pos = k => { const i = ELIM_COL_ORDEN.indexOf(k); return i < 0 ? 900 : i; };
    ks.sort((a, b) => (pos(a) - pos(b)) || a.localeCompare(b));
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:0 16px;">'
        + ks.map(k => '<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;'
            + 'border-bottom:1px dashed rgba(148,163,184,0.3);min-width:0;">'
            + '<span style="color:#64748b;font-size:0.78em;flex-shrink:0;">' + _elimEsc(_elimEtqCol(k)) + '</span>'
            + '<span style="font-weight:700;font-size:0.78em;text-align:right;min-width:0;word-break:break-word;">'
            + _elimValor(k, ficha[k]) + '</span></div>').join('')
        + '</div>';
}

function elim_verRegistros(id) {
    const r = (_elimLista || []).find(x => x.id === id);
    if (!r) return;
    _elimEstilos();
    const d = r.datos || {};
    const tablas = d.tablas || {};
    const nombre = _elimEsc(((r.nombre || '') + ' ' + (r.apellido || '')).trim() || r.socio_id);

    let html = '<div style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'
        + '<button onclick="elim_ver(\'' + r.id + '\')" class="btn-card" style="font-size:0.78em;padding:4px 10px;">‹ Volver</button>'
        + '<div style="flex:1;min-width:0;">'
        +   '<div style="font-weight:800;font-size:0.95em;">' + nombre + '</div>'
        +   '<div style="font-size:0.74em;color:#64748b;">Respaldo del ' + _elimFecha(r.eliminado_en) + '</div>'
        + '</div></div>';

    html += '<div style="font-size:0.78em;font-weight:800;color:#475569;text-transform:uppercase;margin:0 0 5px;">Su ficha completa</div>'
        + _elimFichaHTML(d.ficha);

    // Lo calculado repite varios campos de la ficha (área, contrato,
    // puntos). Se muestra solo lo que agrega algo: el inicio de puntos,
    // los años cumplidos, y cualquier valor que no coincida con la ficha.
    const calc = d.calculado || {};
    const fichaDe = k => {
        const f = d.ficha || {};
        const snake = String(k).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        if (f[k] !== undefined) return f[k];
        if (f[snake] !== undefined) return f[snake];
        if (k === 'contrato' && f.tipo_contrato !== undefined) return f.tipo_contrato;
        return undefined;
    };
    const calcPropio = {};
    Object.keys(calc).forEach(k => {
        const v = fichaDe(k);
        if (v === undefined || String(v) !== String(calc[k])) calcPropio[k] = calc[k];
    });
    if (Object.keys(calcPropio).length) {
        html += '<div style="font-size:0.78em;font-weight:800;color:#475569;text-transform:uppercase;margin:14px 0 5px;">Lo que la app calculaba de él</div>'
            + _elimFichaHTML(calcPropio);
    }

    const conDatos = ELIM_TABLAS.filter(x => Array.isArray(tablas[x.t]) && tablas[x.t].length);
    const vacias = ELIM_TABLAS.filter(x => Array.isArray(tablas[x.t]) && !tablas[x.t].length);

    html += '<div style="font-size:0.78em;font-weight:800;color:#475569;text-transform:uppercase;margin:16px 0 6px;">Sus movimientos</div>';

    if (!conDatos.length) {
        html += '<div style="font-size:0.8em;color:#64748b;padding:4px 0;">No tenía ningún movimiento registrado.</div>';
    } else {
        html += conDatos.map(x => {
            const filas = tablas[x.t];
            // Las tablas cortas se abren solas; las largas quedan
            // plegadas para que el modal no arranque con mil filas.
            const abre = filas.length <= 25 ? ' open' : '';
            const suma = filas.reduce((s, f) => s + Number(((f || {}).monto) || 0), 0);
            return '<details' + abre + ' style="border:1px solid rgba(148,163,184,0.35);border-radius:9px;'
                + 'padding:8px 10px;margin-bottom:8px;">'
                + '<summary style="cursor:pointer;font-weight:800;font-size:0.84em;display:flex;'
                + 'align-items:center;gap:8px;flex-wrap:wrap;">'
                +   '<span style="flex:1;min-width:0;">' + _elimEsc(x.etq) + '</span>'
                +   '<span style="font-weight:700;font-size:0.86em;color:#64748b;white-space:nowrap;">'
                +     filas.length + ' registro' + (filas.length === 1 ? '' : 's')
                +     (suma ? ' · ' + _elimEsc(_elimDinero(suma)) : '') + '</span>'
                + '</summary>'
                + '<div style="margin-top:8px;">' + _elimTablaHTML(filas) + '</div>'
                + '</details>';
        }).join('');
    }

    if (vacias.length) {
        html += '<div style="font-size:0.74em;color:#64748b;margin-top:2px;line-height:1.5;">'
            + 'Sin registros en: ' + vacias.map(x => _elimEsc(x.etq)).join(', ') + '.</div>';
    }

    const errs = Object.keys(d.errores || {});
    if (errs.length) {
        html += '<div style="margin-top:12px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px 10px;font-size:0.76em;color:#92400e;">'
            + '⚠️ Al armar el respaldo no se pudo leer: <b>' + errs.map(_elimEsc).join(', ') + '</b>.'
            + '<div style="margin-top:3px;">' + errs.map(k => _elimEsc(k + ': ' + d.errores[k])).join('<br>') + '</div></div>';
    }

    html += '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button onclick="elim_exportar(\'' + r.id + '\')" class="btn-action" style="flex:1;background:#16a34a;">⬇ Descargar todo</button>'
        + '</div>'
        + '<div style="text-align:center;margin-top:8px;">'
        + '<button onclick="elim_verCrudo(\'' + r.id + '\')" style="background:none;border:none;'
        + 'color:#64748b;font-size:0.72em;text-decoration:underline;cursor:pointer;padding:2px 6px;">'
        + 'Ver los datos técnicos (JSON)</button></div>';

    document.getElementById('elimDetalleBody').innerHTML = html;
    document.getElementById('modalElimDetalle').style.display = 'block';
}

// El JSON crudo. Ya no es el botón principal: queda como último recurso
// para comprobar un campo que no esté saliendo en las tablas.
function elim_verCrudo(id) {
    const r = (_elimLista || []).find(x => x.id === id);
    if (!r) return;
    document.getElementById('elimDetalleBody').innerHTML =
        '<h3 style="margin:0 0 8px;font-weight:800;">🧾 Datos técnicos</h3>'
        + '<button onclick="elim_verRegistros(\'' + r.id + '\')" class="btn-card" style="margin-bottom:10px;font-size:0.78em;padding:4px 10px;">‹ Volver al detalle</button>'
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
