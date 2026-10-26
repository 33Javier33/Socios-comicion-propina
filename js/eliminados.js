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
        if (s) {
            datos.calculado = {
                puntos: s.puntos, anios: s.anios, area: s.area, contrato: s.contrato,
                fechaIngreso: s.fechaIngreso, fechaInicioPuntos: s.fechaInicioPuntos
            };
            // EL ALCANCE, calculado acá y ahora.
            //
            // Es lo que prometía el comentario de arriba y no se estaba
            // guardando: se anotaban los puntos y las fechas, pero no el
            // número que de verdad no se puede reconstruir después. El
            // comprobante terminaba cayendo al `alcance` del cierre, que es
            // la foto del mes COMPLETO tomada antes de marcar el término.
            //
            // Con las ausencias del propio respaldo, así que el término de
            // contrato ya viene descontado: es el mismo motor del recibo.
            try {
                const ext = Array.isArray(datos.tablas.extras) ? datos.tablas.extras : [];
                const aus = new Set(ext
                    .filter(e => String(e.tipo || '').toLowerCase().includes('ausencia'))
                    .map(e => String(e.fecha || '').substring(0, 10))
                    .filter(Boolean));
                const filaPT = (Array.isArray(datos.tablas.dias_pt) ? datos.tablas.dias_pt : [])[0];
                const diasPT = String(s.contrato || '') === 'Part-Time'
                    ? ((filaPT && Array.isArray(filaPT.dias)) ? filaPT.dias : []) : null;
                const vp = sumaValorPuntoSocio(s, aus, diasPT);
                datos.calculado.periodo      = periodoActivoISO();
                datos.calculado.valorPunto   = Math.round(vp);
                datos.calculado.alcance      = Math.round(vp * (Number(s.puntos) || 0));
                datos.calculado.diasAusencia = aus.size;
            } catch (e) { datos.errores.alcance = e.message || String(e); }
        }
    } catch (e) {}
    // El recibo que se le entregó, desde la auditoría. Es la fuente que
    // manda en el comprobante de salida: guardarla acá significa que la
    // hoja no depende de que la auditoría siga disponible ni de volver a
    // buscarla cada vez.
    try {
        const rec = await _elimReciboAuditado(sid);
        if (rec) datos.recibo = rec;
    } catch (e) { datos.errores.recibo = e.message || String(e); }
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
        + '<button onclick="elim_imprimir(\'' + r.id + '\')" class="btn-action" style="flex:1;background:#475569;">🖨 Comprobante</button>'
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
        + '<button onclick="elim_imprimir(\'' + r.id + '\')" class="btn-action" style="flex:1;background:#475569;">🖨 Comprobante</button>'
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

// ══════════════════════════════════════════════════════════════════════
// COMPROBANTE DE SALIDA — para imprimir
//
// Una hoja con lo del socio y, si se fue por TÉRMINO DE CONTRATO, que lo
// diga con todas sus letras, con la fecha y lo que le corresponde recibir
// hasta ese día.
//
// De dónde sale cada cosa:
//   · El término de contrato NO es un campo aparte: el sistema lo registra
//     como una ausencia en `extras` con el detalle «Término de Contrato».
//     Así que se detecta ahí, y la fecha es la PRIMERA de esas ausencias:
//     es el día desde el que deja de percibir.
//   · Lo que debe recibir sale del cierre de mes guardado, que es la
//     cuenta que hizo la propia app. Si en el respaldo no hay cierre, NO
//     se inventa un total: se muestra lo que sí se sabe y se dice que el
//     alcance del período no quedó guardado. Un comprobante de pago con
//     un número adivinado es peor que uno incompleto.
// ══════════════════════════════════════════════════════════════════════

function _elimPlata(n) {
    const v = Number(n);
    if (!isFinite(v)) return '—';
    // El signo va ANTES del peso: formatearMoneda devuelve «$-80.000», que
    // en una hoja que alguien firma se lee mal y se puede confundir con un
    // monto positivo. Acá queda «−$80.000».
    const abs = Math.abs(Math.round(v));
    const txt = (typeof formatearMoneda === 'function')
        ? formatearMoneda(abs)
        : '$' + abs.toLocaleString('es-CL');
    return (v < 0 ? '\u2212' : '') + txt;
}
function _elimFechaLarga(iso) {
    const M = ['enero','febrero','marzo','abril','mayo','junio','julio',
               'agosto','septiembre','octubre','noviembre','diciembre'];
    const p = String(iso || '').substring(0, 10).split('-').map(Number);
    if (p.length !== 3 || !p[0]) return '—';
    return p[2] + ' de ' + M[p[1] - 1] + ' de ' + p[0];
}

// El período del fondo va del 15 de un mes al 14 del siguiente. Se deduce
// de la fecha, sin depender del estado actual de la app: el respaldo puede
// ser de hace meses.
function _elimPeriodoDe(iso) {
    const p = String(iso || '').substring(0, 10).split('-').map(Number);
    if (p.length !== 3 || !p[0]) return null;
    const a = p[0], m = p[1] - 1, d = p[2];
    const f = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')
                 + '-' + String(x.getDate()).padStart(2, '0');
    return d >= 15
        ? { inicio: f(new Date(a, m, 15)),     fin: f(new Date(a, m + 1, 14)) }
        : { inicio: f(new Date(a, m - 1, 15)), fin: f(new Date(a, m, 14)) };
}

// Los días seguidos se juntan en un renglón —«30/09 al 14/10 (15 días)»—
// igual que en el recibo del cierre. Una fila por día llenaba la hoja y
// escondía el total, que es lo único que se firma.
function _elimTramos(fechas) {
    const orden = Array.from(new Set(fechas.filter(Boolean))).sort();
    const out = [];
    orden.forEach(d => {
        const ult = out.length ? out[out.length - 1] : null;
        if (ult) {
            const sig = new Date(ult[ult.length - 1] + 'T12:00:00');
            sig.setDate(sig.getDate() + 1);
            const k = sig.getFullYear() + '-' + String(sig.getMonth() + 1).padStart(2, '0')
                    + '-' + String(sig.getDate()).padStart(2, '0');
            if (k === d) { ult.push(d); return; }
        }
        out.push([d]);
    });
    return out;
}
function _elimDdMm(iso) {
    const p = String(iso || '').substring(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : String(iso || '');
}
function _elimRango(fechas) {
    if (!fechas.length) return '';
    return fechas.length === 1
        ? _elimDdMm(fechas[0])
        : _elimDdMm(fechas[0]) + ' al ' + _elimDdMm(fechas[fechas.length - 1]);
}
function _elimDdMmAaaa(iso) {
    const p = String(iso || '').substring(0, 10).split('-');
    return p.length === 3 && p[0] ? p[2] + '/' + p[1] + '/' + p[0] : '—';
}

// Qué dice el respaldo sobre cómo y cuándo se fue, y cuánto le queda.
//
// OJO CON EL ALCANCE: `sumaValorPuntoSocio` (js/constants.js) SALTA los días
// de ausencia, y el término de contrato se registra justamente como una
// ausencia por día. O sea, el alcance que quedó guardado en el cierre YA
// viene sin esos días. Restarlos otra vez en el comprobante sería contarlos
// dos veces — que es lo que hacía la primera versión de esta hoja.
//
// La cuenta real, tal como la hace `cierresMes_calcularSocio`:
//     saldoReal = alcance + saldoAnterior − anticipos
//     aPagar    = saldoReal redondeado hacia abajo al millar
//     remanente = lo que sobra, y pasa al período siguiente
function _elimSalida(d) {
    const t = (d && d.tablas) || {};
    const extras = Array.isArray(t.extras) ? t.extras : [];
    const esAus  = e => String(e.tipo || '').toLowerCase().includes('ausencia');
    const esTC   = e => {
        const x = String(e.detalle || '').trim().toLowerCase();
        return x === 'término de contrato' || x === 'termino de contrato';
    };
    const soloFecha = e => String(e.fecha || '').substring(0, 10);

    const tc = extras.filter(e => esAus(e) && esTC(e))
                     .sort((a, b) => soloFecha(a).localeCompare(soloFecha(b)));

    const cierres = []
        .concat(Array.isArray(t.cierres_mes) ? t.cierres_mes : [])
        .concat(Array.isArray(t.cierres_mes_historial) ? t.cierres_mes_historial : []);
    const cierre = cierres.length
        ? cierres.slice().sort((a, b) =>
            String(b.fecha_cierre || b.periodo || '').localeCompare(String(a.fecha_cierre || a.periodo || '')))[0]
        : null;

    const anticipos = Array.isArray(t.anticipos) ? t.anticipos : [];
    const totalAnt  = anticipos.reduce((s, a) => s + (Number(a.monto) || 0), 0);
    const saldo     = (Array.isArray(t.saldos_socio) && t.saldos_socio[0])
                      ? Number(t.saldos_socio[0].monto) || 0 : null;

    // ── ¿El término cubre hasta el final del período? ────────────────
    // El rango lo escribe una persona a mano. Si se queda corto, los días
    // que faltan SIGUEN sumando al alcance y el socio cobra de más. Esto
    // lo revisa y lo dice; no lo corrige solo, porque el dato correcto no
    // está acá.
    let cobertura = null;
    if (tc.length) {
        const desde = soloFecha(tc[0]);
        const per = _elimPeriodoDe(desde);
        if (per) {
            const marcados = new Set(extras.filter(esAus).map(soloFecha));
            const faltan = [];
            const cur = new Date(desde + 'T12:00:00');
            const fin = new Date(per.fin + 'T12:00:00');
            while (cur <= fin) {
                const k = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0')
                        + '-' + String(cur.getDate()).padStart(2, '0');
                if (!marcados.has(k)) faltan.push(k);
                cur.setDate(cur.getDate() + 1);
            }
            cobertura = { periodo: per, ultimoMarcado: soloFecha(tc[tc.length - 1]),
                          faltan: faltan, completo: faltan.length === 0 };
        }
    }

    return {
        porTerminoContrato: tc.length > 0,
        fechaTermino: tc.length ? soloFecha(tc[0]) : null,
        diasTermino: tc.length,
        cobertura: cobertura,
        cierre: cierre,
        anticipos: anticipos, totalAnt: totalAnt,
        saldo: saldo
    };
}

// ══════════════════════════════════════════════════════════════════════
// EL RECIBO QUE SE LE ENTREGÓ AL SOCIO
//
// Es la mejor fuente que existe, y por lejos: no es un recálculo ni la
// foto de un cierre, es la hoja que se imprimió, se firmó y quedó en la
// auditoría con su folio. Dice exactamente lo que el socio percibe.
//
// Importa sobre todo cuando el socio se va A MITAD DE PERÍODO. Ahí el
// cierre guardado —si existe— trae el mes entero, y sin el recibo el
// comprobante de salida le daría todo el mes a alguien que dejó de
// percibir el día 30. Con Ignacio Marín pasó: su recibo dice $107.015 y
// el comprobante decía $327.928.
//
// Cada impresión guarda la hoja completa en `auditoria.snapshot_despues`.
// ══════════════════════════════════════════════════════════════════════
function _elimNumero(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? null : n;
}

// Normaliza el snapshot del recibo a puros números, venga con `montos`
// (recibos nuevos) o solo con los textos formateados (los de antes).
function _elimReciboMontos(s) {
    if (!s || typeof s !== 'object') return null;
    const m = s.montos || {};
    // Tres sitios donde puede estar cada cifra, y se prueban en orden:
    //   1. `montos`      — recibos nuevos, ya en números;
    //   2. la propia key  — un recibo que YA pasó por acá (esto se llama
    //                       dos veces: al buscarlo y al leerlo del respaldo,
    //                       y sin este paso la segunda vuelta perdía los
    //                       campos que solo existen con nombre formateado);
    //   3. el texto       — recibos viejos, con «$107.015».
    const val = (k, txt) => {
        const a = _elimNumero(m[k]);      if (a != null) return a;
        const b = _elimNumero(s[k]);      if (b != null) return b;
        return _elimNumero(txt);
    };
    const alcance = val('alcance', s.alcance);
    if (alcance == null) return null;            // sin alcance no sirve de nada
    return {
        folio: s.folio || null,
        fechaEmision: s.fechaEmision || null,
        periodo: s.periodo || null,
        periodoISO: s.periodoISO || null,
        congeladoDesde: s.congeladoDesde || null,
        puntos: _elimNumero(s.puntos),
        alcance: alcance,
        valorPunto: val('valorPunto', s.valorPuntoFmt),
        saldoAnt: val('saldoAnt', s.saldoAnt) || 0,
        anticipos: val('anticipos', s.totalPedido) || 0,
        saldoReal: val('saldoReal', s.saldoReal),
        aPagar: val('aPagar', s.aPagar),
        remanente: val('remanente', s.remanente)
    };
}

// Busca el ÚLTIMO recibo impreso del socio.
//
// Pregunta por `getRecibosSocio`, que mira en los DOS lados: Supabase —los
// recibos nuevos guardan la hoja entera en `snapshot_despues`— y la
// auditoría de Google, donde el JSON completo vive en `detalle`.
//
// Mirar solo Supabase no servía para nada: hasta ahora a Supabase se le
// mandaba únicamente el resumen (nombre, período, a pagar), y la hoja
// completa iba solo a Google. O sea que de TODOS los recibos ya impresos
// —los únicos que importan acá— no encontraba ninguno.
async function _elimReciboAuditado(socioId) {
    const sid = String(socioId || '');
    if (!sid || typeof URL_SOCIOS === 'undefined') return null;
    try {
        const resp = await fetch(URL_SOCIOS + '?action=getRecibosSocio&socioId=' + encodeURIComponent(sid));
        const res = await resp.json();
        if (!res || res.status !== 'success' || !Array.isArray(res.data)) return null;
        for (const x of res.data) {
            const m = _elimReciboMontos(x.snapshot);
            if (m) { if (!m.folio && x.folio) m.folio = x.folio; return m; }
        }
    } catch (e) { console.warn('[eliminados] no se pudo leer el recibo:', e && e.message); }
    return null;
}

// Deja el recibo dentro del respaldo del socio. Si el respaldo no lo
// traía —porque la baja es anterior a que esto existiera—, se busca en la
// auditoría y se guarda ahí para que la próxima vez esté sin buscar.
async function _elimAsegurarRecibo(r) {
    if (!r || !r.datos) return null;
    if (r.datos.recibo) return r.datos.recibo;
    const m = await _elimReciboAuditado(r.socio_id || r.id);
    if (!m) return null;
    r.datos.recibo = m;
    try {
        await dbSoc.from('socios_eliminados').update({ datos: r.datos }).eq('id', r.id);
    } catch (e) { console.warn('[eliminados] no se pudo guardar el recibo en el respaldo:', e && e.message); }
    return m;
}

// ══════════════════════════════════════════════════════════════════════
// LOS ANTICIPOS DEL SOCIO, VENGAN DE DONDE VENGAN
//
// Al marcar COBRADO, los anticipos se MUEVEN de `anticipos` a
// `anticipos_historial` y se borran de la tabla viva. Un socio que
// alcanzó a cobrar antes de irse queda con `anticipos` vacía y todo en
// el historial.
//
// Esta hoja sumaba solo la tabla viva, así que en ese caso daba $0 de
// anticipos y el TOTAL A COBRAR salía sin descontarlos — el socio
// figuraba recibiendo de más justo lo que ya se había llevado en
// adelantos.
//
// Se juntan las dos tablas y se quitan los repetidos: al archivar, cada
// fila del historial guarda en `uuid_ref` el id del anticipo original,
// así que si el respaldo trae las dos copias se cuenta una sola vez.
//
// Se filtra por el período del socio porque el historial guarda TODOS
// los períodos: sin ese recorte se le descontarían adelantos de meses
// que ya cobró y cerró.
// ══════════════════════════════════════════════════════════════════════
function _elimAnticiposDe(t, per) {
    const vivos = Array.isArray(t && t.anticipos) ? t.anticipos : [];
    const hist  = Array.isArray(t && t.anticipos_historial) ? t.anticipos_historial : [];

    const dentro = a => {
        if (!per) return true;
        const f = String(a.fecha || '').substring(0, 10);
        return !!f && f >= per.inicio && f <= per.fin;
    };

    const vistos = new Set();
    const lista  = [];
    const agregar = (a, archivado) => {
        if (!dentro(a)) return;
        const clave = String(a.uuid_ref || a.id
                          || (String(a.fecha || '') + '|' + String(a.monto || '')));
        if (vistos.has(clave)) return;
        vistos.add(clave);
        lista.push({
            fecha: String(a.fecha || '').substring(0, 10),
            monto: Number(a.monto) || 0,
            responsable: a.responsable || '',
            archivado: !!archivado
        });
    };
    vivos.forEach(a => agregar(a, false));
    hist.forEach(a => agregar(a, true));

    lista.sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
    return { lista: lista, total: lista.reduce((s, a) => s + a.monto, 0) };
}

// Recalcula el alcance con el MISMO motor que el recibo del cierre, en
// vez de creerle al `alcance` que quedó guardado.
//
// `sumaValorPuntoSocio` (js/constants.js) recorre día por día la
// recaudación del período activo y SALTA los días de ausencia. El término
// de contrato se registra como una ausencia por día, así que basta con
// pasarle las ausencias del respaldo para que el congelamiento quede
// aplicado — igual que cuando se imprime el recibo desde Gestión.
//
// Devuelve { ok:false, motivo } cuando no se puede: sin recaudación
// cargada, sin puntos, o porque el socio pertenece a un período que la
// recaudación de hoy ya no cubre. En esos casos quien llama se queda con
// lo guardado y lo dice en la hoja.
function _elimAlcanceVivo(r, d, sal, puntos, per) {
    if (typeof sumaValorPuntoSocio !== 'function' || typeof periodoActivoISO !== 'function')
        return { ok: false, motivo: 'sin-motor' };
    if (!puntos) return { ok: false, motivo: 'sin-puntos' };

    const mapa = (typeof globalMapaPuntosDia === 'object' && globalMapaPuntosDia) || {};
    if (!Object.keys(mapa).length) return { ok: false, motivo: 'sin-recaudacion' };

    const act = periodoActivoISO();

    // Se calcula sobre el período DEL SOCIO, no sobre el de hoy.
    //
    // Antes, si el socio pertenecía a un período que ya pasó, esto se
    // rendía y la hoja caía al `alcance` guardado en el cierre — que es la
    // foto del MES COMPLETO, tomada antes de marcar el término. A Ignacio
    // Marín, con término desde el 30/09, le daba $327.928 en vez de los
    // $107.015 de su recibo: el congelamiento no se aplicaba por ninguna
    // parte. Y es el caso normal, porque el comprobante de salida se saca
    // justamente después, cuando el socio ya está eliminado.
    //
    // La recaudación histórica no se borra: `action=get` trae todas las
    // fechas, así que el mapa también tiene los meses pasados. Solo hacía
    // falta mirar el tramo correcto.
    const ventana = per || act;
    const hayDatos = Object.keys(mapa).some(k =>
        k >= ventana.inicio && k <= ventana.fin && mapa[k] !== null && mapa[k] !== undefined);
    // Sin recaudación en ESE tramo sí hay que rendirse: el dato no existe.
    if (!hayDatos) return { ok: false, motivo: 'otro-periodo', activo: act, ventana: ventana };

    const f = (d && d.ficha) || {};
    const t = (d && d.tablas) || {};
    const fIng = String(r.fecha_ingreso || f.fecha_ingreso || '').substring(0, 10);
    const fIni = String(f.fecha_inicio_puntos || '').substring(0, 10);
    const contrato = String(r.contrato || f.tipo_contrato || f.contrato || '');

    // Mismo molde que los socios de `cacheSocios`: `sumaValorPuntoSocio`
    // lee `fechaInicioPuntos` en camelCase.
    const socio = {
        id: r.socio_id, puntos: puntos, area: r.area || f.area || '',
        contrato: contrato, fechaIngreso: fIng, fechaInicioPuntos: fIni || fIng
    };

    const extras = Array.isArray(t.extras) ? t.extras : [];
    const aus = new Set(extras
        .filter(e => String(e.tipo || '').toLowerCase().includes('ausencia'))
        .map(e => String(e.fecha || '').substring(0, 10))
        .filter(Boolean));

    let diasPT = null;
    if (contrato === 'Part-Time') {
        const fila = (Array.isArray(t.dias_pt) ? t.dias_pt : [])[0];
        diasPT = (fila && Array.isArray(fila.dias)) ? fila.dias : [];
    }

    const suma = sumaValorPuntoSocio(socio, aus, diasPT, ventana);

    // El día a día, para que el informe pueda mostrar por qué da lo que da.
    // Se arma con el mismo criterio que `sumaValorPuntoSocio`: fuera del
    // tramo que percibe no cuenta, los días de ausencia no cuentan, y para
    // Part-Time solo cuentan sus días asignados.
    const desde  = desdeCuandoPercibe(socio, ventana.inicio);
    const motivo = {};
    extras.filter(e => String(e.tipo || '').toLowerCase().includes('ausencia'))
          .forEach(e => { motivo[String(e.fecha || '').substring(0, 10)] = String(e.detalle || 'Ausencia'); });
    const setPT = diasPT ? new Set(diasPT) : null;

    const dias = Object.keys(mapa).filter(k => k >= ventana.inicio && k <= ventana.fin).sort().map(k => {
        const valor = mapa[k];
        let estado = 'trabajado', cuenta = true;
        if (valor === null || valor === undefined) { estado = 'sin-recaudacion'; cuenta = false; }
        else if (k < desde) { estado = 'aun-no-percibe'; cuenta = false; }
        else if (aus.has(k)) { estado = 'ausente'; cuenta = false; }
        else if (setPT && !setPT.has(k)) { estado = 'no-asignado'; cuenta = false; }
        return { fecha: k, valor: Number(valor) || 0, cuenta: cuenta,
                 estado: estado, motivo: motivo[k] || null };
    });

    return {
        ok: true,
        valorPunto: Math.round(suma),
        alcance: Math.round(suma * puntos),
        diasAusencia: aus.size,
        periodo: ventana, desde: desde, dias: dias
    };
}

// Todo lo que hay que saber de un socio eliminado, en números.
//
// Lo usan el comprobante individual Y el informe general. Está en una
// sola función a propósito: cuando el cálculo vivía repartido, las dos
// hojas terminaban diciendo cosas distintas del mismo socio.
function _elimCalculo(r) {
    const d    = (r && r.datos) || {};
    const f    = d.ficha || {};
    const t    = d.tablas || {};
    const calc = d.calculado || {};
    const sal  = _elimSalida(d);

    const nombre   = ((r.nombre || f.nombre || '') + ' ' + (r.apellido || f.apellido || '')).trim().toUpperCase();
    const area     = String(r.area || f.area || '').toUpperCase();
    const contrato = String(r.contrato || f.tipo_contrato || f.contrato || '').toUpperCase();
    const fIng     = String(r.fecha_ingreso || f.fecha_ingreso || calc.fechaIngreso || '').substring(0, 10);
    const fIni     = String(f.fecha_inicio_puntos || calc.fechaInicioPuntos || '').substring(0, 10);
    const anioIng  = fIng ? fIng.split('-')[0] : '\u2014';
    // Solo se muestra cuando difiere del ingreso: si son iguales, repetir
    // la misma fecha con otro nombre confunde al que lee la hoja.
    const fipLabel = (fIni && fIni !== fIng) ? fIni.split('-').reverse().join('/') : null;
    const puntos   = Number(r.puntos != null ? r.puntos
                          : (f.puntos != null ? f.puntos : calc.puntos)) || 0;

    // El aumento anual cae el día 15 del mes de ingreso (o el de la fecha
    // de inicio de puntos, si la pusieron a mano). Acá se armaba con el
    // DÍA del ingreso —«10 DE JUN» para quien entró un día 10—, cuando
    // siempre es el 15. Ahora sale de `subePuntosLabel`, el mismo que usa
    // el recibo del cierre.
    const subePuntos = (typeof subePuntosLabel === 'function')
        ? subePuntosLabel(fIng, fIni)
        : '\u2014';

    // El período, deducido de la fecha (15 -> 14). No se usa el período
    // activo de la app: el respaldo puede ser de hace meses y la hoja
    // tiene que decir el período del socio, no el de hoy.
    const c = sal.cierre;
    // `periodo` antes que `fecha_cierre`: el cierre guarda a qué período
    // pertenece, y la fecha en que se hizo puede caer ya en el siguiente.
    // Un cierre hecho el 15/10 del período 15/09→14/10 se deducía como del
    // período 15/10→14/11, y el alcance salía del mes equivocado.
    const perRef = sal.fechaTermino
                || (c && String(c.periodo || '').substring(0, 10))
                || (c && String(c.fecha_cierre || '').substring(0, 10))
                || String(r.eliminado_en || '').substring(0, 10);
    const per = _elimPeriodoDe(perRef);
    const periodoStr = per ? (_elimDdMmAaaa(per.inicio) + ' AL ' + _elimDdMmAaaa(per.fin)) : '\u2014';

    // Los anticipos del per\u00edodo, de la tabla viva Y del historial. Se
    // resuelven ac\u00e1, con el per\u00edodo ya deducido, y se dejan en `sal` para
    // que la lista de movimientos y la aritm\u00e9tica miren lo mismo.
    const ant = _elimAnticiposDe(t, per);
    sal.anticipos = ant.lista;
    sal.totalAnt  = ant.total;

    // EL ALCANCE: se recalcula, no se cree lo guardado.
    //
    // El cierre guardado en `cierres_mes` es una foto del momento en que
    // se cerró el mes, y el término de contrato casi siempre se registra
    // DESPUÉS: primero se cierra el período para todos -el cierre masivo-
    // y recién cuando el socio se va se le marca el congelamiento. Esa
    // foto quedó tomada cuando el socio todavía figuraba trabajando, así
    // que su `alcance` es el del mes completo.
    //
    // El recibo real nunca tuvo ese problema porque NO lee la foto:
    // recalcula al imprimir con `sumaValorPuntoSocio`, que salta los días
    // de ausencia. Acá se hace exactamente lo mismo.
    const vivo = _elimAlcanceVivo(r, d, sal, puntos, per);
    // Sin recálculo se usa lo guardado, pero solo si realmente hay algo:
    // `alcance` es una columna opcional y un cierre viejo puede traerla en
    // null. Imprimir «$0» como alcance sería peor que decir que falta.
    const alcanceGuardado = (c && c.alcance != null && isFinite(Number(c.alcance)))
        ? Number(c.alcance) : null;
    // El respaldo guarda el alcance calculado el día de la baja, con el
    // término ya descontado. Vale mucho más que el del cierre, que es la
    // foto del mes completo: se usa antes que ése.
    const alcanceRespaldo = (calc && calc.alcance != null && isFinite(Number(calc.alcance)))
        ? Number(calc.alcance) : null;

    // EL RECIBO MANDA SOBRE TODO LO DEMÁS.
    //
    // Es la hoja que el socio firmó. Un recálculo puede quedarse sin la
    // recaudación del mes, y la foto del cierre trae el mes completo
    // cuando el socio se fue a mitad de período. El recibo no: dice lo
    // que efectivamente se le pagó.
    const rec = _elimReciboMontos(d.recibo) || null;

    const fuenteAlcance = rec ? 'recibo'
                        : (vivo.ok ? 'recalculado'
                        : (alcanceRespaldo != null ? 'respaldo'
                        : (alcanceGuardado != null ? 'cierre' : null)));
    const alcance = rec ? rec.alcance
                  : (vivo.ok ? vivo.alcance
                  : (alcanceRespaldo != null ? alcanceRespaldo : alcanceGuardado));
    const valorPunto = rec ? rec.valorPunto
        : (vivo.ok ? vivo.valorPunto
        : ((calc && calc.valorPunto != null && isFinite(Number(calc.valorPunto)) && fuenteAlcance === 'respaldo')
            ? Number(calc.valorPunto)
            : ((alcance != null && puntos > 0) ? Math.round(alcance / puntos) : null)));

    // La cuenta, la de `cierresMes_calcularSocio`:
    //     SALDO REAL = alcance + saldo anterior - anticipos
    //     TOTAL A COBRAR / REMANENTE = repartirSaldo(saldo real)
    let cuenta = null;
    if (rec) {
        // Con el recibo delante no se rehace la cuenta: se copia. Volver a
        // calcularla sobre los mismos números solo abre la puerta a que la
        // hoja diga un peso distinto del que el socio firmó.
        cuenta = {
            alcance: rec.alcance, saldoAnt: rec.saldoAnt, antTot: rec.anticipos,
            antCierre: (c && c.anticipos_total != null) ? Number(c.anticipos_total) : null,
            antN: ant.lista.length,
            saldoReal: rec.saldoReal != null ? rec.saldoReal
                     : (rec.alcance + rec.saldoAnt - rec.anticipos),
            aPagar: rec.aPagar, remanente: rec.remanente,
            todoALaMano: (typeof _esGastoComision === 'function') && _esGastoComision(r.area || f.area)
        };
    } else if (alcance != null) {
        const saldoAnt = c ? (Number(c.saldo_anterior) || 0) : 0;
        // Mandan los registros, no la foto del cierre.
        //
        // Antes era al revés, y por eso el total salía mal: el cierre es una
        // foto tomada ANTES de marcar el término —igual que pasa con el
        // alcance—, así que su `anticipos_total` puede ser de cero aunque el
        // socio sí tuviera adelantos, o quedarse corto si se registraron
        // después. Para el alcance esta misma hoja ya desconfía de la foto y
        // recalcula; no tenía sentido creerle para los anticipos.
        //
        // La foto solo se usa cuando el respaldo no trae NINGÚN registro que
        // mirar (respaldos viejos, de antes de que se guardara el historial).
        const antTot = ant.lista.length
            ? ant.total
            : ((c && c.anticipos_total != null) ? Number(c.anticipos_total) : 0);
        const antCierre = (c && c.anticipos_total != null) ? Number(c.anticipos_total) : null;
        const saldoReal = alcance + saldoAnt - antTot;
        const esGC = (typeof _esGastoComision === 'function') && _esGastoComision(r.area || f.area);
        const rep = (typeof repartirSaldo === 'function')
            ? repartirSaldo(saldoReal, esGC)
            : { aPagar: Math.floor(Math.max(0, saldoReal) / 1000) * 1000,
                remanente: saldoReal - Math.floor(Math.max(0, saldoReal) / 1000) * 1000 };
        cuenta = { alcance: alcance, saldoAnt: saldoAnt, antTot: antTot,
                   antCierre: antCierre, antN: ant.lista.length,
                   saldoReal: saldoReal, aPagar: rep.aPagar, remanente: rep.remanente,
                   todoALaMano: !!esGC };
    }

    return { r: r, d: d, f: f, t: t, calc: calc, sal: sal, cierre: c,
             nombre: nombre, area: area, contrato: contrato,
             fIng: fIng, fIni: fIni, anioIng: anioIng, fipLabel: fipLabel,
             puntos: puntos, subePuntos: subePuntos,
             per: per, periodoStr: periodoStr,
             vivo: vivo, alcance: alcance, valorPunto: valorPunto,
             fuenteAlcance: fuenteAlcance, recibo: rec, cuenta: cuenta };
}

// ══════════════════════════════════════════════════════════════════════
// COMPROBANTE DE SALIDA
//
// Es el MISMO recibo que emite el cierre de mes (js/reports.js →
// imprimirReciboSocio): mismo encabezado, mismas secciones, mismos
// nombres de línea. La diferencia es de dónde salen los números: acá no
// hay DOM ni estado vivo, solo el respaldo. Si el recibo y esta hoja no
// dicen lo mismo para el mismo socio, hay un error en una de las dos.
//
// La cuenta es la de `cierresMes_calcularSocio`, sin agregarle nada:
//     SALDO REAL = alcance + saldo anterior − anticipos
//     TOTAL A COBRAR = saldo real redondeado hacia abajo al millar
//     REMANENTE = lo que sobra, y pasa al período siguiente
//
// El término de contrato NO se resta acá. `sumaValorPuntoSocio`
// (js/constants.js) salta los días de ausencia, y el término se registra
// justamente como una ausencia por día: el alcance guardado YA viene sin
// esos días. Por eso el monto del término va en MOVIMIENTOS, informativo,
// fuera de la aritmética — exactamente como en el recibo real.
// ══════════════════════════════════════════════════════════════════════
async function elim_imprimir(id) {
    const r = (_elimLista || []).find(x => x.id === id);
    if (!r) return;
    // Antes de calcular nada: si el respaldo no trae el recibo que se le
    // entregó al socio, se busca en la auditoría y se guarda. Es la fuente
    // que manda, y sin esto una baja a mitad de período saldría con el mes
    // completo.
    try { await _elimAsegurarRecibo(r); } catch (e) {}
    const esc = _elimEsc;
    const K = _elimCalculo(r);
    const d = K.d, f = K.f, t = K.t, calc = K.calc, sal = K.sal, c = K.cierre;
    const nombre = K.nombre, area = K.area, contrato = K.contrato;
    const fIng = K.fIng, anioIng = K.anioIng, fipLabel = K.fipLabel;
    const puntos = K.puntos, subePuntos = K.subePuntos;
    const per = K.per, periodoStr = K.periodoStr;
    const vivo = K.vivo, alcance = K.alcance, valorPunto = K.valorPunto, cuenta = K.cuenta;

    const fila = (e, v) => '<div class="row"><label>' + esc(e) + '</label><span>' + v + '</span></div>';

    // ── MOVIMIENTOS ──────────────────────────────────────────────────
    const extras    = Array.isArray(t.extras) ? t.extras : [];
    const soloFecha = e => String(e.fecha || '').substring(0, 10);
    const esAus     = e => String(e.tipo || '').toLowerCase().includes('ausencia');
    const esTC      = e => {
        const x = String(e.detalle || '').trim().toLowerCase();
        return x === 'término de contrato' || x === 'termino de contrato';
    };

    const movs = [];
    sal.anticipos.forEach(a => movs.push({
        orden: String(a.fecha || ''), num: true, tipo: 'Anticipo',
        cuando: _elimDdMm(a.fecha),
        // «archivado» = vino de `anticipos_historial`, o sea que el socio ya
        // había cobrado ese período. Se dice, para que quien lee la hoja no
        // dude de por qué aparece un adelanto que no está en la tabla viva.
        det: a.archivado ? 'Adelanto (archivado)' : 'Adelanto',
        monto: Number(a.monto || 0), color: '#2980b9'
    }));

    const tcRows = extras.filter(e => esAus(e) && esTC(e));
    if (tcRows.length) {
        const fechas = tcRows.map(soloFecha).filter(Boolean).sort();
        movs.push({
            orden: fechas[0] || '', num: false, tipo: '🔴 T.CONTRATO',
            cuando: _elimRango(fechas),
            det: 'Término de Contrato (' + tcRows.length + ' día' + (tcRows.length === 1 ? '' : 's') + ')',
            monto: tcRows.reduce((s, e) => s + (Number(e.monto) || 0), 0), color: '#c0392b'
        });
    }

    // Las demás ausencias, agrupadas por motivo y por tramo de días
    // seguidos, igual que la tabla de Anticipos y Ausencias.
    const porMotivo = {};
    extras.filter(e => esAus(e) && !esTC(e)).forEach(e => {
        const k = String(e.detalle || 'Ausencia');
        (porMotivo[k] = porMotivo[k] || []).push(e);
    });
    Object.keys(porMotivo).forEach(k => {
        const montoDia = {};
        porMotivo[k].forEach(e => {
            const dia = soloFecha(e);
            montoDia[dia] = (montoDia[dia] || 0) + (Number(e.monto) || 0);
        });
        _elimTramos(Object.keys(montoDia)).forEach(tr => {
            movs.push({
                orden: tr[0], num: false, tipo: 'AUSENCIA',
                cuando: _elimRango(tr),
                det: k + (tr.length > 1 ? ' (' + tr.length + ' días)' : ''),
                monto: tr.reduce((s, x) => s + montoDia[x], 0), color: '#c0392b'
            });
        });
    });

    movs.sort((a, b) => String(b.orden).localeCompare(String(a.orden)));
    let nAnt = 1;
    const movHtml = movs.length
        ? movs.map(m => '<tr>'
            + '<td class="c">' + (m.num ? nAnt++ : '—') + '</td>'
            + '<td style="color:' + m.color + ';font-weight:700;">' + esc(m.tipo) + '</td>'
            + '<td>' + esc(m.cuando) + (m.det ? '<br><span class="det">' + esc(m.det) + '</span>' : '') + '</td>'
            + '<td class="n">' + _elimPlata(-Math.abs(m.monto)) + '</td></tr>').join('')
        : '<tr><td colspan="4" class="c" style="padding:5px;color:#888;">Sin movimientos registrados</td></tr>';

    // ── DETALLE ──────────────────────────────────────────────────────
    // La cuenta es la de `cierresMes_calcularSocio`, con el alcance ya
    // congelado al día del término:
    //     SALDO REAL = alcance + saldo anterior − anticipos
    //     TOTAL A COBRAR / REMANENTE = repartirSaldo(saldo real)
    let detalleHtml, avisoCierre = '';
    if (cuenta) {
        detalleHtml =
              fila('BRUTO (Alcance)', _elimPlata(cuenta.alcance))
            + fila('ANTICIPOS', _elimPlata(cuenta.antTot))
            + fila('SALDO ANTERIOR', _elimPlata(cuenta.saldoAnt))
            + '<div class="row bold"><label>SALDO REAL</label><strong>' + _elimPlata(cuenta.saldoReal) + '</strong></div>'
            + '<div class="divider"></div>'
            + '<div class="total-cobrar"><div class="total-label">TOTAL A COBRAR</div>'
            +   '<div class="total-monto">' + _elimPlata(cuenta.aPagar) + '</div></div>'
            + fila('REMANENTE', _elimPlata(cuenta.remanente));

        // Si el cierre guardado dice otra cosa, se muestra la diferencia.
        // Casi siempre es esto: se cerró el mes ANTES de marcar el término,
        // así que la foto quedó con el socio trabajando el mes entero.
        // Los anticipos del cierre no cuadran con los registrados. Se usa el
        // detalle —es el que está listado arriba, línea por línea— y se dice
        // la diferencia en vez de callarla.
        if (cuenta.antN && cuenta.antCierre != null && Math.abs(cuenta.antCierre - cuenta.antTot) > 1) {
            avisoCierre += '<div class="alerta"><b>Los anticipos del cierre no cuadran.</b> '
                + 'El cierre guardado descontó ' + _elimPlata(cuenta.antCierre) + ', y los '
                + cuenta.antN + ' adelanto' + (cuenta.antN === 1 ? '' : 's') + ' registrados del período '
                + 'suman ' + _elimPlata(cuenta.antTot) + ' ('
                + _elimPlata(Math.abs(cuenta.antCierre - cuenta.antTot)) + ' de diferencia). '
                + 'Esta hoja usa los registrados, que son los que están detallados arriba. '
                + 'Revísalo contra el recibo del socio antes de pagar.'
                + '</div>';
        }

        if (K.fuenteAlcance === 'recibo') {
            const rc = K.recibo;
            avisoCierre += '<div class="alerta"><b>Cifras del recibo entregado al socio.</b> '
                + 'Folio ' + esc(rc.folio || '—')
                + (rc.fechaEmision ? ', emitido el ' + esc(rc.fechaEmision) : '')
                + (rc.periodo ? ', período ' + esc(rc.periodo) : '')
                + '. Es la hoja que el socio firmó, así que esta salida dice exactamente lo mismo.'
                + '</div>';
            // Si el cierre guardado dice otra cosa, se deja constancia: es
            // la señal de que el socio se fue a mitad de período y la foto
            // del cierre quedó con el mes entero.
            if (c && c.alcance != null && Math.abs(Number(c.alcance) - alcance) > 1) {
                avisoCierre += '<div class="alerta">El cierre guardado dice un alcance de '
                    + _elimPlata(Number(c.alcance)) + ' ('
                    + _elimPlata(Number(c.alcance) - alcance) + ' más). Es el del mes completo, '
                    + 'tomado antes de marcar la salida. No se usa.'
                    + '</div>';
            }
        } else if (vivo.ok && c && c.alcance != null && Math.abs(Number(c.alcance) - alcance) > 1) {
            const guardado = Number(c.alcance);
            avisoCierre += '<div class="alerta"><b>El cierre guardado quedó viejo.</b> '
                + 'Dice un alcance de ' + _elimPlata(guardado) + ', que es el del mes completo. '
                + 'Con el congelamiento aplicado'
                + (sal.fechaTermino ? ' desde el ' + esc(_elimDdMmAaaa(sal.fechaTermino)) : '')
                + ' corresponden ' + _elimPlata(alcance) + ' ('
                + _elimPlata(guardado - alcance) + ' de diferencia). '
                + 'Esta hoja usa el recalculado, igual que el recibo. '
                + 'Vuelve a cerrar el período en Anticipos y Ausencias para que el cierre también quede al día.'
                + '</div>';
        } else if (!vivo.ok && K.fuenteAlcance === 'respaldo') {
            // No se pudo recalcular, pero el respaldo trae el alcance que se
            // calculó el día de la baja, con el término ya descontado. No es
            // un problema: se dice de dónde sale y se sigue.
            avisoCierre += '<div class="alerta"><b>Alcance tomado del respaldo.</b> '
                + 'No hay recaudación del período ' + esc(periodoStr) + ' para recalcular acá, '
                + 'así que se usa el alcance que quedó guardado al dar de baja al socio'
                + (sal.porTerminoContrato ? ', con el término de contrato ya aplicado' : '')
                + '.</div>';
        } else if (!vivo.ok && c) {
            // Lo último que queda es la foto del cierre, y esa sí es
            // peligrosa: se toma antes de marcar el término, así que casi
            // siempre trae el mes completo. Hay que decirlo fuerte.
            avisoCierre += '<div class="alerta"><b>⚠️ Cifras tomadas del cierre guardado — revísalas.</b> '
                + (vivo.motivo === 'otro-periodo'
                    ? 'El socio pertenece al período ' + esc(periodoStr) + ' y no hay recaudación '
                      + 'cargada de esas fechas, así que no se puede recalcular acá. '
                    : 'No hay recaudación cargada para recalcular. ')
                + 'Este respaldo tampoco guardó el alcance (es anterior a que se empezara a guardar). '
                + (sal.porTerminoContrato
                    ? 'Si el mes se cerró antes de marcar el término de contrato, ese alcance es el del '
                      + 'MES COMPLETO, sin el congelamiento: hay que revisarlo contra el recibo del socio.'
                    : 'Compáralas con el recibo del socio antes de pagar.')
                + '</div>';
        }
    } else {
        detalleHtml =
              fila('ANTICIPOS', _elimPlata(sal.totalAnt))
            + (sal.saldo != null ? fila('SALDO REGISTRADO', _elimPlata(sal.saldo)) : '')
            + '<div class="falta">El <b>alcance del período</b> no se pudo calcular ni quedó guardado en '
            + 'este respaldo, así que el total a cobrar no se puede obtener acá. Tómalo del cierre del '
            + 'período en Anticipos y Ausencias y complétalo a mano antes de firmar.</div>';
    }

    // ── Motivo de la salida ──────────────────────────────────────────
    const motivoHtml = sal.porTerminoContrato
        ? '<div class="salida tc">'
          + '<div class="salida-t">SALIDA POR TÉRMINO DE CONTRATO</div>'
          + '<div class="salida-d">Desde el <b>' + esc(_elimFechaLarga(sal.fechaTermino))
          + '</b> el socio deja de percibir la recaudación'
          + (sal.diasTermino > 1 ? ' · ' + sal.diasTermino + ' días registrados' : '') + '.</div></div>'
        : '<div class="salida">'
          + '<div class="salida-t">' + (r.modo === 'desactivado' ? 'SALIDA — DADO DE BAJA'
              : r.modo === 'recuperado' ? 'SALIDA — REGISTRO RECUPERADO' : 'SALIDA DEL FONDO') + '</div>'
          + '<div class="salida-d">En el respaldo no hay un registro de término de contrato. '
          + 'Si la salida fue por ese motivo, déjalo anotado en Anticipos y Ausencias '
          + 'antes de emitir este comprobante.</div></div>';

    // ── Aviso si el término no cubre todo el período ─────────────────
    // El rango lo escribe una persona a mano. Si se queda corto, los días
    // que faltan siguen sumando al alcance y el socio cobra de más.
    const cob = sal.cobertura;
    const avisoCobertura = (cob && !cob.completo)
        ? '<div class="alerta"><b>Revisa esto antes de pagar.</b> El término está marcado hasta el '
          + esc(_elimDdMmAaaa(cob.ultimoMarcado)) + ', pero el período llega al '
          + esc(_elimDdMmAaaa(cob.periodo.fin)) + '. Quedan <b>' + cob.faltan.length + ' día'
          + (cob.faltan.length === 1 ? '' : 's') + ' sin marcar</b> que <b>todavía suman</b> al alcance: '
          + 'el total puede estar más alto de lo que corresponde. Complétalos en Anticipos y Ausencias, '
          + 'vuelve a cerrar el período y reimprime esta hoja.</div>'
        : '';

    // ── Folio ────────────────────────────────────────────────────────
    // Prefijo SAL-, no REC-: esta hoja se emite desde el respaldo, no es
    // el cierre original. Un folio REC- inventado acá no existiría en
    // auditoría y haría imposible cruzarlo con el recibo de verdad.
    const hoy  = new Date();
    const _pad = n => String(n).padStart(2, '0');
    let _ini = 'SYS';
    try {
        const s = (typeof getSesionResponsableObj === 'function') ? getSesionResponsableObj() : {};
        if (s && s.ini) _ini = String(s.ini).replace(/[^A-Za-z0-9]/g, '');
    } catch (e) {}
    const folio = 'SAL-' + hoy.getFullYear() + _pad(hoy.getMonth() + 1) + _pad(hoy.getDate())
                + '-' + _pad(hoy.getHours()) + _pad(hoy.getMinutes()) + _pad(hoy.getSeconds())
                + '-' + _ini;
    const fechaHoyVis = _pad(hoy.getDate()) + '/' + _pad(hoy.getMonth() + 1) + '/' + hoy.getFullYear();
    const fileName = 'Comprobante salida ' + nombre + ' ' + fechaHoyVis.replace(/\//g, '-');

    function bloque(etiqueta) {
        return '<div class="copy-label">' + etiqueta + '</div>'
        + '<div class="folio-badge">N° FOLIO: ' + esc(folio) + ' &nbsp;★&nbsp; DESDE RESPALDO</div>'
        + '<div class="header"><h1>FONDO DE SOLIDARIDAD</h1><p>CASINO DE PTO. VARAS</p>'
        +   '<p>LEY 17312 DEL 29/07/70</p><p><strong>PUERTO VARAS</strong></p></div>'
        + motivoHtml
        + '<div class="section-title">DATOS</div>'
        + '<div class="row"><label>NOMBRE</label><strong>' + esc(nombre) + '</strong></div>'
        + fila('RUT', esc(r.rut || f.rut || '—'))
        + fila('ID SOCIO', esc(r.socio_id || '—'))
        + fila('ÁREA', esc(area || '—'))
        + fila('CONTRATO', esc(contrato || '—'))
        + fila('AÑO INGRESO', esc(anioIng))
        + (fipLabel ? fila('INICIO PUNTOS', esc(fipLabel)) : '')
        + fila('PUNTOS', esc(puntos || '—'))
        + fila('SUBE PUNTOS', esc(subePuntos))
        + '<div class="divider"></div>'
        + '<div class="section-title">CIERRE PUNTO</div>'
        + fila(sal.fechaTermino ? 'VALOR PUNTO (HASTA ' + _elimDdMmAaaa(sal.fechaTermino) + ')' : 'VALOR PUNTO NOCHE',
               valorPunto != null ? _elimPlata(valorPunto) : '—')
        + (sal.fechaTermino
            ? '<div class="row tcrow"><label>🔴 TÉRMINO CONTRATO DESDE</label><span>'
              + esc(_elimDdMmAaaa(sal.fechaTermino)) + '</span></div>'
            : '')
        + '<div class="divider"></div>'
        + '<div class="section-title">DETALLE</div>'
        + detalleHtml
        + avisoCierre
        + avisoCobertura
        + '<div class="divider"></div>'
        + '<div class="section-title">MOVIMIENTOS / RESPONSABLES</div>'
        + '<table><thead><tr><th>#</th><th>Tipo</th><th>Detalle</th><th>Monto</th></tr></thead>'
        +   '<tbody>' + movHtml + '</tbody></table>'
        + '<div class="divider"></div>'
        + '<div class="periodo">PERÍODO ' + esc(periodoStr) + '</div>'
        + '<div class="firmas">'
        +   '<div class="firma-box"><div class="firma-linea"></div>'
        +     '<div class="firma-nombre">' + esc(nombre) + '</div>'
        +     '<div class="firma-label">FIRMA SOCIO</div></div>'
        +   '<div class="firma-box"><div class="firma-linea"></div>'
        +     '<div class="firma-nombre">' + esc(_elimQuien()) + '</div>'
        +     '<div class="firma-label">COMISIÓN DE PROPINA</div></div>'
        + '</div>'
        + '<div class="folio-pie">FOLIO: ' + esc(folio) + '</div>'
        + '<div class="footer">Respaldo del ' + esc(_elimFecha(r.eliminado_en))
        +   ' &nbsp;|&nbsp; Emitido: ' + esc(fechaHoyVis) + ' &nbsp;|&nbsp; Sistema Fondo Solidario</div>';
    }

    // Mismo formato de papel y mismos estilos que el recibo del cierre
    // (js/reports.js): si alguien los pone uno al lado del otro, tienen
    // que verse como el mismo documento.
    const htmlBase = '<html><head><meta charset="UTF-8"><title>' + esc(fileName) + '</title><style>'
        + '*{margin:0;padding:0;box-sizing:border-box;}'
        + 'body{font-family:Arial,sans-serif;font-size:10px;color:#000;background:white;}'
        + '.page{width:72mm;margin:0 auto;padding:4px 6px;}'
        + '.header{text-align:center;border:2px solid #000;padding:8px;margin-bottom:8px;}'
        + '.header h1{font-size:12px;font-weight:bold;letter-spacing:1px;}'
        + '.section-title{text-align:center;font-weight:bold;font-size:10px;border-bottom:1px solid #000;'
        +   'padding-bottom:2px;margin:8px 0 5px;letter-spacing:1px;}'
        + '.row{display:flex;justify-content:space-between;align-items:baseline;padding:2px 0;'
        +   'border-bottom:1px solid #eee;}'
        + '.row label{font-size:8.5px;color:#555;flex-shrink:0;}'
        + '.row > strong,.row > span{font-size:8.5px;font-weight:700;text-align:right;'
        +   'word-break:break-word;margin-left:4px;}'
        + '.row.bold label{color:#000;font-weight:700;}'
        + '.row.tcrow label{color:#c0392b;font-size:8px;}'
        + '.row.tcrow span{color:#c0392b;}'
        + '.total-cobrar{text-align:center;border-top:2px solid #000;border-bottom:2px solid #000;'
        +   'margin:6px 0;padding:6px 0;}'
        + '.total-label{font-size:9px;font-weight:bold;letter-spacing:1px;margin-bottom:2px;}'
        + '.total-monto{font-size:22px;font-weight:900;}'
        + 'table{width:100%;border-collapse:collapse;font-size:8px;}'
        + 'th{background:#f0f0f0;padding:2px;border-bottom:1px solid #ccc;}'
        + 'td{padding:3px 4px;border-bottom:1px solid #eee;word-break:break-word;vertical-align:top;}'
        + 'td.c{text-align:center;color:#888;}td.n{text-align:right;font-weight:bold;white-space:nowrap;}'
        + '.det{color:#999;font-size:7.5px;}'
        + '.divider{border-top:1px solid #000;margin:5px 0;}'
        + '.copy-label{text-align:center;font-size:8px;font-weight:bold;background:#000;color:white;'
        +   'padding:2px;margin-bottom:5px;letter-spacing:1px;}'
        + '.folio-badge{text-align:center;font-size:8px;font-family:monospace;background:#f4f6f7;'
        +   'border:1px dashed #aaa;padding:3px 6px;margin-bottom:6px;letter-spacing:0.5px;border-radius:3px;}'
        + '.salida{border:2px solid #000;padding:4px 6px;margin:6px 0;text-align:center;}'
        + '.salida.tc{background:#f2f2f2;}'
        + '.salida-t{font-size:10px;font-weight:900;letter-spacing:0.5px;}'
        + '.salida-d{font-size:8px;color:#333;margin-top:2px;line-height:1.5;}'
        + '.alerta{border:1.5px solid #000;background:#eee;padding:4px 6px;margin:5px 0;'
        +   'font-size:7.5px;line-height:1.55;}'
        + '.falta{border:1.5px dashed #777;padding:4px 6px;margin-top:5px;font-size:7.5px;'
        +   'color:#333;line-height:1.55;}'
        + '.periodo{text-align:center;font-weight:bold;font-size:10px;margin:4px 0;}'
        + '.firmas{display:flex;gap:8px;margin-top:16px;}'
        + '.firma-box{flex:1;text-align:center;}'
        + '.firma-linea{border-top:1px solid #000;margin-top:15px;margin-bottom:4px;}'
        + '.firma-nombre{font-size:8px;font-weight:700;word-break:break-word;}'
        + '.firma-label{font-size:7px;color:#555;}'
        + '.folio-pie{text-align:center;font-family:monospace;font-size:7px;color:#aaa;margin-top:3px;}'
        + '.footer{text-align:center;font-size:7px;color:#888;margin-top:5px;}'
        + '@media print{@page{margin:0;size:80mm auto;}}'
        + '@media screen{body{background:#ddd;}.page{background:white;box-shadow:0 2px 12px rgba(0,0,0,0.2);}}'
        + '</style></head><body>';

    // Una sola boleta. Antes salían dos copias idénticas; la que se firma
    // es una, y la otra se iba a la basura.
    const boletaHtml = htmlBase
        + '<div class="page">' + bloque('★ COMPROBANTE DE SALIDA ★') + '</div>'
        + '</body></html>';

    // ── EL INFORME DETALLADO ─────────────────────────────────────────
    // Hoja carta aparte, para archivar. La boleta es lo que el socio
    // firma y se lleva; el informe es el respaldo de la comisión: de
    // dónde salió cada peso, día por día.
    const informeHtml = _elimInformeHTML({
        r: r, f: f, calc: calc, sal: sal, esc: esc,
        nombre: nombre, area: area, contrato: contrato, puntos: puntos,
        fIng: fIng, fipLabel: fipLabel, anioIng: anioIng, subePuntos: subePuntos,
        periodoStr: periodoStr, per: per, vivo: vivo, cierre: c,
        valorPunto: valorPunto, cuenta: cuenta, movs: movs,
        avisoCierre: avisoCierre, avisoCobertura: avisoCobertura,
        folio: folio, fechaHoyVis: fechaHoyVis
    });
    const nombreInforme = 'Informe salida ' + nombre + ' ' + fechaHoyVis.replace(/\//g, '-');

    if (typeof printHTML === 'function') {
        // Primero el informe y, al rato, la boleta: son dos papeles
        // distintos (carta y 80mm) y suelen ir a impresoras distintas,
        // así que no pueden salir en el mismo trabajo de impresión.
        if (typeof showToast === 'function') showToast('🖨 Imprimiendo el informe detallado…', 'info');
        printHTML(informeHtml, nombreInforme);
        setTimeout(() => {
            if (typeof showToast === 'function') showToast('🖨 Ahora la boleta de recibo…', 'info');
            printHTML(boletaHtml, fileName);
        }, 1500);
    } else {
        const win = window.open('', '_blank', 'width=900,height=1000');
        if (!win) {
            if (typeof showToast === 'function') showToast('El navegador bloqueó la ventana. Permite las ventanas emergentes.', 'warning');
            return;
        }
        win.document.write(informeHtml);
        win.document.close();
    }

    if (typeof sbAuditLog === 'function') sbAuditLog('Comprobante de Salida', {
        folio: folio,
        idAfectado: r.socio_id,
        detalle: 'Informe + boleta para ' + nombre + ' · Período ' + periodoStr
            + (sal.porTerminoContrato ? ' · término de contrato ' + sal.fechaTermino : '')
    });
}

// ══════════════════════════════════════════════════════════════════════
// INFORME DETALLADO DE SALIDA — hoja carta, para archivar
//
// La boleta es lo que el socio firma y se lleva: tiene que caber en 80mm
// y decir el total. El informe es el respaldo de la comisión y contesta
// la pregunta que la boleta no alcanza a contestar: POR QUÉ da ese monto.
// Por eso trae el día a día de la recaudación, con cada día marcado como
// trabajado o congelado, y la cuenta armada paso a paso.
// ══════════════════════════════════════════════════════════════════════
function _elimInformeHTML(x) {
    const esc = x.esc;
    const fila = (e, v) => '<tr><td class="e">' + esc(e) + '</td><td class="v">' + v + '</td></tr>';

    // ── El día a día, que es lo que hace «detallado» al informe ──────
    let diasHtml = '';
    if (x.vivo.ok && Array.isArray(x.vivo.dias) && x.vivo.dias.length) {
        const ETQ = {
            'trabajado': ['Trabajado', 'ok'],
            'ausente': ['Congelado', 'no'],
            'aun-no-percibe': ['Aún no percibe', 'gris'],
            'no-asignado': ['No le toca (Part-Time)', 'gris'],
            'sin-recaudacion': ['Sin recaudación', 'gris']
        };
        const filas = x.vivo.dias.map(dd => {
            const et = ETQ[dd.estado] || ['—', 'gris'];
            const aporte = dd.cuenta ? _elimPlata(Math.round(dd.valor * x.puntos)) : '—';
            return '<tr class="' + et[1] + '">'
                + '<td>' + esc(_elimDdMmAaaa(dd.fecha)) + '</td>'
                + '<td class="n">' + _elimPlata(Math.round(dd.valor)) + '</td>'
                + '<td>' + esc(et[0]) + (dd.motivo && !dd.cuenta ? ' · ' + esc(dd.motivo) : '') + '</td>'
                + '<td class="n">' + aporte + '</td></tr>';
        }).join('');
        const nTrab = x.vivo.dias.filter(dd => dd.cuenta).length;
        const nCong = x.vivo.dias.filter(dd => dd.estado === 'ausente').length;
        diasHtml =
              '<h2>Día a día del período</h2>'
            + '<p class="nota">Son los días de recaudación del período. Los congelados no suman: '
            + 'es ahí donde se aplica el término de contrato.</p>'
            + '<table class="dias"><thead><tr><th>Día</th><th class="n">Valor punto</th>'
            +   '<th>Estado</th><th class="n">Aporte (× ' + esc(x.puntos) + ' pts)</th></tr></thead>'
            + '<tbody>' + filas + '</tbody>'
            + '<tfoot><tr><td colspan="3"><b>' + nTrab + ' día' + (nTrab === 1 ? '' : 's')
            +   ' que suman</b>' + (nCong ? ' · ' + nCong + ' congelado' + (nCong === 1 ? '' : 's') : '')
            +   '</td><td class="n"><b>' + _elimPlata(x.cuenta ? x.cuenta.alcance : 0) + '</b></td></tr></tfoot>'
            + '</table>';
    }

    // ── La cuenta, paso a paso ───────────────────────────────────────
    let cuentaHtml;
    if (x.cuenta) {
        const c = x.cuenta;
        diasHtml = diasHtml || '';
        cuentaHtml =
              '<table class="cuenta">'
            + '<tr><td class="e">Valor punto del período'
            +   (x.sal.fechaTermino ? ' <small>(hasta el ' + esc(_elimDdMmAaaa(x.sal.fechaTermino)) + ')</small>' : '')
            +   '</td><td class="n">' + (x.valorPunto != null ? _elimPlata(x.valorPunto) : '—') + '</td></tr>'
            + '<tr><td class="e">Puntos del socio</td><td class="n">× ' + esc(x.puntos) + '</td></tr>'
            + '<tr class="sub"><td class="e"><b>Alcance del período</b></td>'
            +   '<td class="n"><b>' + _elimPlata(c.alcance) + '</b></td></tr>'
            + '<tr><td class="e">Saldo que venía del período anterior</td>'
            +   '<td class="n">' + _elimPlata(c.saldoAnt) + '</td></tr>'
            + '<tr><td class="e">Anticipos que ya recibió</td>'
            +   '<td class="n">' + _elimPlata(-Math.abs(c.antTot)) + '</td></tr>'
            + '<tr class="sub"><td class="e"><b>Saldo real</b></td>'
            +   '<td class="n"><b>' + _elimPlata(c.saldoReal) + '</b></td></tr>'
            + '<tr class="tot"><td class="e">TOTAL A COBRAR</td>'
            +   '<td class="n">' + _elimPlata(c.aPagar) + '</td></tr>'
            + '<tr><td class="e">Remanente' + (c.todoALaMano ? '' : ' <small>(pasa al período siguiente)</small>')
            +   '</td><td class="n">' + _elimPlata(c.remanente) + '</td></tr>'
            + '</table>'
            + '<p class="nota">El total a cobrar se redondea hacia abajo al millar'
            + (c.todoALaMano ? ', salvo en Gastos Comisión, que retira todo' : '')
            + '; lo que sobra queda como remanente.</p>';
    } else {
        cuentaHtml = '<div class="alerta">El alcance del período no se pudo calcular ni quedó guardado '
            + 'en este respaldo, así que el total a cobrar no se puede obtener acá. Tómalo del cierre '
            + 'del período en Anticipos y Ausencias.</div>';
    }

    // ── Origen de las cifras: que quede escrito ──────────────────────
    const origen = x.vivo.ok
        ? 'Recalculado al imprimir con la recaudación del período '
          + esc(_elimDdMmAaaa(x.vivo.periodo.inicio)) + ' al ' + esc(_elimDdMmAaaa(x.vivo.periodo.fin))
          + ', con los días de ausencia descontados — el mismo cálculo que el recibo del cierre.'
        : 'Tomado del cierre de mes guardado en el respaldo'
          + (x.vivo.motivo === 'otro-periodo'
              ? ': el socio pertenece a otro período y la recaudación cargada no es la suya.'
              : ': no hay recaudación cargada para recalcular.');

    // ── Movimientos, uno por uno ─────────────────────────────────────
    let nAnt = 1;
    const movHtml = (x.movs || []).length
        ? x.movs.map(m => '<tr>'
            + '<td class="c">' + (m.num ? nAnt++ : '—') + '</td>'
            + '<td>' + esc(m.tipo) + '</td>'
            + '<td>' + esc(m.cuando) + '</td>'
            + '<td>' + esc(m.det || '—') + '</td>'
            + '<td class="n">' + _elimPlata(-Math.abs(m.monto)) + '</td></tr>').join('')
        : '<tr><td colspan="5" class="c">Sin movimientos registrados en el respaldo</td></tr>';

    const M = ['enero','febrero','marzo','abril','mayo','junio','julio',
               'agosto','septiembre','octubre','noviembre','diciembre'];
    const hoy = new Date();
    const lugarFecha = 'Puerto Varas, ' + hoy.getDate() + ' de ' + M[hoy.getMonth()] + ' de ' + hoy.getFullYear();

    const salidaHtml = x.sal.porTerminoContrato
        ? '<div class="salida"><div class="salida-t">Salida por término de contrato</div>'
          + '<div class="salida-d">Con fecha <b>' + esc(_elimFechaLarga(x.sal.fechaTermino)) + '</b>. '
          + 'Desde ese día el socio deja de percibir la recaudación'
          + (x.sal.diasTermino > 1 ? ', y quedaron <b>' + x.sal.diasTermino + ' días</b> congelados hasta el '
             + 'cierre del período' : '') + '.</div></div>'
        : '<div class="salida"><div class="salida-t">'
          + (x.r.modo === 'desactivado' ? 'Dado de baja'
             : x.r.modo === 'recuperado' ? 'Registro recuperado' : 'Eliminado del sistema')
          + '</div><div class="salida-d">En el respaldo no hay un registro de término de contrato. '
          + 'Si la salida fue por ese motivo, déjalo anotado en Anticipos y Ausencias antes de pagar.'
          + '</div></div>';

    return '<html><head><meta charset="UTF-8"><title>Informe de salida — ' + esc(x.nombre) + '</title><style>'
        + '*{margin:0;padding:0;box-sizing:border-box;}'
        + 'body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#000;background:#fff;'
        +   'padding:16mm 18mm;line-height:1.45;}'
        + 'h1{font-size:17pt;font-weight:900;letter-spacing:1px;text-align:center;}'
        + '.sub{text-align:center;font-size:9.5pt;color:#333;font-weight:600;margin-bottom:2mm;}'
        + '.folio{text-align:center;font-family:monospace;font-size:8.5pt;color:#444;background:#f4f6f7;'
        +   'border:1px dashed #aaa;border-radius:3px;padding:2px 8px;display:inline-block;}'
        + '.folio-wrap{text-align:center;margin-bottom:4mm;}'
        + '.lugar{text-align:right;font-size:9.5pt;color:#555;margin-bottom:4mm;}'
        + 'h2{font-size:10.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.8px;'
        +   'border-bottom:1.5px solid #000;padding-bottom:2px;margin:6mm 0 2.5mm;}'
        + 'table{width:100%;border-collapse:collapse;}'
        + 'td,th{padding:3px 6px;font-size:9.5pt;vertical-align:top;}'
        + 'th{background:#eee;text-align:left;font-size:8.5pt;text-transform:uppercase;'
        +   'letter-spacing:0.5px;border-bottom:1.5px solid #000;}'
        + 'td.e{color:#444;width:52%;}td.v{font-weight:700;}'
        + 'td.n,th.n{text-align:right;white-space:nowrap;}'
        + 'td.c{text-align:center;color:#777;}'
        + 'tbody tr:nth-child(even){background:#f7f7f7;}'
        + 'table.dias td{font-size:8.5pt;padding:2px 6px;border-bottom:1px solid #eee;}'
        + 'table.dias tr.no td{color:#b91c1c;}'
        + 'table.dias tr.gris td{color:#888;}'
        + 'table.dias tfoot td{border-top:1.5px solid #000;font-size:9.5pt;background:#fff;}'
        + 'table.cuenta td{border-bottom:1px solid #eee;}'
        + 'table.cuenta tr.sub td{border-top:1.5px solid #000;border-bottom:1.5px solid #000;background:#fafafa;}'
        + 'table.cuenta tr.tot td{border-top:2px solid #000;border-bottom:2px solid #000;'
        +   'font-size:13pt;font-weight:900;background:#f0f0f0;}'
        + '.salida{border:2px solid #000;padding:3mm 4mm;margin:3mm 0;}'
        + '.salida-t{font-size:12pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;}'
        + '.salida-d{font-size:9.5pt;color:#333;margin-top:1.5mm;}'
        + '.alerta{border:2px solid #000;background:#eee;padding:3mm 4mm;margin:3mm 0;font-size:9pt;}'
        + '.nota{font-size:8.5pt;color:#555;margin:1.5mm 0 2.5mm;}'
        + '.origen{font-size:8.5pt;color:#333;background:#f4f6f7;border-left:3px solid #000;'
        +   'padding:2mm 3mm;margin-top:2mm;}'
        + '.firmas{display:flex;justify-content:space-around;margin-top:16mm;page-break-inside:avoid;}'
        + '.fb{text-align:center;width:42%;}'
        + '.fl{border-top:1.5px solid #000;padding-top:4px;font-size:9.5pt;font-weight:700;text-transform:uppercase;}'
        + '.fs{font-size:8.5pt;color:#555;}'
        + '.pie{font-size:8pt;color:#666;text-align:center;margin-top:8mm;border-top:1px dashed #ccc;padding-top:2mm;}'
        + '@media print{@page{size:A4;margin:0;}body{padding:14mm 16mm;}'
        +   'h2{page-break-after:avoid;}table{page-break-inside:auto;}tr{page-break-inside:avoid;}}'
        + '</style></head><body>'

        + '<h1>INFORME DE SALIDA DE SOCIO</h1>'
        + '<div class="sub">Fondo Solidario de Propina · Casino de Puerto Varas · Ley 17312 del 29/07/70</div>'
        + '<div class="folio-wrap"><span class="folio">FOLIO ' + esc(x.folio) + '</span></div>'
        + '<div class="lugar">' + esc(lugarFecha) + '</div>'

        + '<h2>Identificación del socio</h2><table><tbody>'
        + fila('Nombre', esc(x.nombre))
        + fila('RUT', esc(x.r.rut || x.f.rut || '—'))
        + fila('ID de socio', esc(x.r.socio_id || '—'))
        + fila('Área', esc(x.area || '—'))
        + fila('Contrato', esc(x.contrato || '—'))
        + fila('Fecha de ingreso', esc(_elimFechaLarga(x.fIng)))
        + (x.fipLabel ? fila('Inicio de puntos', esc(x.fipLabel)) : '')
        + fila('Puntos al salir', esc(x.puntos || '—'))
        + fila('Sube puntos', esc(x.subePuntos))
        + ((x.calc && x.calc.anios != null) ? fila('Años cumplidos', esc(x.calc.anios)) : '')
        + '</tbody></table>'

        + '<h2>Motivo y fecha de la salida</h2>'
        + salidaHtml
        + '<table><tbody>'
        + fila('Período liquidado', esc(x.periodoStr))
        + fila('Registrado en el sistema como',
               esc(x.r.modo === 'desactivado' ? 'Dado de baja (desactivado)'
                 : x.r.modo === 'recuperado' ? 'Registro recuperado' : 'Eliminado'))
        + fila('Respaldo tomado el', esc(_elimFecha(x.r.eliminado_en)))
        + (x.r.eliminado_por ? fila('Por', esc(x.r.eliminado_por)) : '')
        + '</tbody></table>'

        + x.avisoCobertura.replace(/class="alerta"/g, 'class="alerta"')

        + '<h2>Cómo se calculó lo que debe recibir</h2>'
        + cuentaHtml
        + '<div class="origen"><b>Origen de las cifras:</b> ' + origen + '</div>'
        + x.avisoCierre

        + diasHtml

        + '<h2>Movimientos del período</h2>'
        + '<table><thead><tr><th>#</th><th>Tipo</th><th>Cuándo</th><th>Detalle</th>'
        +   '<th class="n">Monto</th></tr></thead><tbody>' + movHtml + '</tbody></table>'

        + '<div class="firmas">'
        +   '<div class="fb"><div style="height:14mm"></div><div class="fl">' + esc(x.nombre) + '</div>'
        +     '<div class="fs">Socio saliente</div></div>'
        +   '<div class="fb"><div style="height:14mm"></div><div class="fl">' + esc(_elimQuien()) + '</div>'
        +     '<div class="fs">Comisión de Propina</div></div>'
        + '</div>'
        + '<div class="pie">Folio ' + esc(x.folio) + ' · Informe generado el ' + esc(x.fechaHoyVis)
        +   ' · Sistema Fondo Solidario</div>'
        + '</body></html>';
}

// ══════════════════════════════════════════════════════════════════════
// INFORME GENERAL DE SOCIOS ELIMINADOS
//
// Una hoja con todos los que salieron, no de a uno. Lo que se mira
// primero es QUIÉNES se fueron por término de contrato y desde cuándo:
// por eso esos van arriba, con su fecha, y aparte va el resto.
//
// Los montos salen de `_elimCalculo()`, el mismo cálculo del comprobante
// individual — si acá dice $107.000, el comprobante de ese socio tiene
// que decir $107.000.
// ══════════════════════════════════════════════════════════════════════
async function elim_informeGeneral() {
    // Carga la lista si todavía no está: así el botón funciona aunque se
    // apriete antes de que termine de cargar la pantalla.
    const lista = await elim_cargar(false) || [];
    if (!lista.length) {
        if (typeof showToast === 'function') showToast('No hay socios eliminados para informar', 'warning');
        return;
    }

    // Si hay algo escrito en el buscador, el informe sale de lo que se
    // está viendo: imprimir otra cosa de la que está en pantalla confunde.
    const term = (document.getElementById('elimBuscar')?.value || '').toLowerCase().trim();
    const vis = lista.filter(r => !term
        || ((r.nombre || '') + ' ' + (r.apellido || '') + ' ' + (r.rut || '') + ' ' + (r.socio_id || ''))
            .toLowerCase().includes(term));
    if (!vis.length) {
        if (typeof showToast === 'function') showToast('El filtro no deja ningún socio', 'warning');
        return;
    }

    const esc = _elimEsc;
    // Igual que el comprobante individual: primero se asegura el recibo de
    // cada uno. Sin esto, una baja a mitad de período aparecería en el
    // informe cobrando el mes entero.
    for (const r of vis) { try { await _elimAsegurarRecibo(r); } catch (e) {} }
    const K = vis.map(_elimCalculo);

    // Los de término de contrato primero, por fecha de término; después el
    // resto, por fecha de salida. Los dos grupos de lo más nuevo a lo más viejo.
    const conTC = K.filter(k => k.sal.porTerminoContrato)
                   .sort((a, b) => String(b.sal.fechaTermino).localeCompare(String(a.sal.fechaTermino)));
    const sinTC = K.filter(k => !k.sal.porTerminoContrato)
                   .sort((a, b) => String(b.r.eliminado_en || '').localeCompare(String(a.r.eliminado_en || '')));

    const modoTxt = m => m === 'desactivado' ? 'Dado de baja'
                       : m === 'recuperado' ? 'Recuperado' : 'Eliminado';

    // ── Una fila de la tabla ─────────────────────────────────────────
    let nFila = 0;
    const filaSocio = (k, conFechaTermino) => {
        const pagar = k.cuenta ? _elimPlata(k.cuenta.aPagar) : '<span class="pend">por calcular</span>';
        const rema  = k.cuenta && k.cuenta.remanente ? _elimPlata(k.cuenta.remanente) : '—';
        // Cuando el total sale de la foto del cierre y no del recálculo,
        // se marca: puede no tener el congelamiento aplicado.
        const marca = (k.cuenta && !k.vivo.ok) ? '<span class="aster" title="del cierre guardado">*</span>' : '';
        return '<tr>'
            + '<td class="c sub">' + (++nFila) + '</td>'
            + '<td><b>' + esc(k.nombre) + '</b>'
            +   (k.r.rut ? '<br><span class="sub">' + esc(k.r.rut) + '</span>' : '') + '</td>'
            + '<td>' + esc(k.area || '—') + '<br><span class="sub">' + esc(k.contrato || '—') + '</span></td>'
            + '<td class="c">' + (k.puntos || '—') + '</td>'
            + '<td>' + esc(_elimDdMmAaaa(k.fIng)) + '</td>'
            + (conFechaTermino
                ? '<td class="tc"><b>' + esc(_elimDdMmAaaa(k.sal.fechaTermino)) + '</b>'
                  + '<br><span class="sub">' + k.sal.diasTermino + ' día'
                  + (k.sal.diasTermino === 1 ? '' : 's') + ' congelados</span></td>'
                : '<td>' + esc(modoTxt(k.r.modo)) + '<br><span class="sub">'
                  + esc(_elimFechaCorta(k.r.eliminado_en)) + '</span></td>')
            + '<td class="sub">' + esc(k.periodoStr) + '</td>'
            + '<td class="n">' + pagar + marca + '</td>'
            + '<td class="n sub">' + rema + '</td>'
            + '</tr>';
    };

    const tabla = (titulo, grupo, conFechaTermino, nota) => {
        if (!grupo.length) return '';
        const suma = grupo.reduce((s, k) => s + (k.cuenta ? k.cuenta.aPagar : 0), 0);
        const faltan = grupo.filter(k => !k.cuenta).length;
        return '<h2>' + esc(titulo) + ' <span class="cuantos">' + grupo.length + '</span></h2>'
            + (nota ? '<p class="nota">' + nota + '</p>' : '')
            + '<table><thead><tr>'
            +   '<th class="c">#</th><th>Socio</th><th>Área / contrato</th><th class="c">Pts</th><th>Ingreso</th>'
            +   '<th>' + (conFechaTermino ? 'Término de contrato' : 'Salida') + '</th>'
            +   '<th>Período</th><th class="n">A cobrar</th><th class="n">Remanente</th>'
            + '</tr></thead><tbody>'
            + grupo.map(k => filaSocio(k, conFechaTermino)).join('')
            + '</tbody><tfoot><tr>'
            +   '<td colspan="7"><b>Total del grupo</b>'
            +     (faltan ? ' <span class="sub">(' + faltan + ' sin calcular, no suman)</span>' : '')
            +   '</td>'
            +   '<td class="n"><b>' + _elimPlata(suma) + '</b></td><td></td>'
            + '</tr></tfoot></table>';
    };

    // ── Resumen de arriba ────────────────────────────────────────────
    const totalPagar = K.reduce((s, k) => s + (k.cuenta ? k.cuenta.aPagar : 0), 0);
    const sinCalcular = K.filter(k => !k.cuenta).length;
    const deLaFoto = K.filter(k => k.cuenta && !k.vivo.ok).length;
    const porRevisar = K.filter(k => k.sal.cobertura && !k.sal.cobertura.completo);

    const resumen = '<div class="resumen">'
        + '<div class="rb"><div class="rn">' + K.length + '</div><div class="rl">socios en el informe</div></div>'
        + '<div class="rb tc"><div class="rn">' + conTC.length + '</div><div class="rl">por término de contrato</div></div>'
        + '<div class="rb"><div class="rn">' + sinTC.length + '</div><div class="rl">otras salidas</div></div>'
        + '<div class="rb"><div class="rn">' + _elimPlata(totalPagar) + '</div><div class="rl">total a cobrar</div></div>'
        + '</div>';

    // ── Lo que hay que mirar antes de pagar ──────────────────────────
    let avisos = '';
    if (porRevisar.length) {
        avisos += '<div class="alerta"><b>Términos de contrato que no cubren todo el período ('
            + porRevisar.length + ').</b> A estos socios el congelamiento les quedó corto, '
            + 'así que los días sin marcar <b>todavía suman</b> y el monto puede estar más alto '
            + 'de lo que corresponde:<ul>'
            + porRevisar.map(k => '<li><b>' + esc(k.nombre) + '</b> — marcado hasta el '
                + esc(_elimDdMmAaaa(k.sal.cobertura.ultimoMarcado)) + ', el período llega al '
                + esc(_elimDdMmAaaa(k.sal.cobertura.periodo.fin)) + ' ('
                + k.sal.cobertura.faltan.length + ' día'
                + (k.sal.cobertura.faltan.length === 1 ? '' : 's') + ' sin marcar)</li>').join('')
            + '</ul>Complétalos en Anticipos y Ausencias y vuelve a cerrar el período.</div>';
    }
    if (deLaFoto) {
        avisos += '<div class="alerta"><b>' + deLaFoto + ' socio'
            + (deLaFoto === 1 ? '' : 's') + ' con el monto tomado del cierre guardado <span class="aster">*</span>.</b> '
            + 'Son de períodos que la recaudación cargada ya no cubre, así que no se pudieron '
            + 'recalcular. Si a alguno de ellos se le cerró el mes antes de marcarle el término, '
            + 'ese monto es el del mes completo: compáralo con su recibo antes de pagar.</div>';
    }
    if (sinCalcular) {
        avisos += '<div class="alerta"><b>' + sinCalcular + ' socio'
            + (sinCalcular === 1 ? '' : 's') + ' sin monto.</b> No se pudo recalcular y tampoco quedó '
            + 'el alcance en el respaldo. Tómalo del cierre del período en Anticipos y Ausencias.</div>';
    }

    const M = ['enero','febrero','marzo','abril','mayo','junio','julio',
               'agosto','septiembre','octubre','noviembre','diciembre'];
    const hoy = new Date();
    const lugarFecha = 'Puerto Varas, ' + hoy.getDate() + ' de ' + M[hoy.getMonth()] + ' de ' + hoy.getFullYear();
    const fechaHoyVis = String(hoy.getDate()).padStart(2, '0') + '/'
        + String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();

    const html = '<html><head><meta charset="UTF-8"><title>Informe de socios eliminados</title><style>'
        + '*{margin:0;padding:0;box-sizing:border-box;}'
        + 'body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;background:#fff;'
        +   'padding:12mm 12mm;line-height:1.4;}'
        + 'h1{font-size:16pt;font-weight:900;letter-spacing:1px;text-align:center;}'
        + '.sub-h{text-align:center;font-size:9pt;color:#333;font-weight:600;margin-bottom:1mm;}'
        + '.lugar{text-align:right;font-size:9pt;color:#555;margin-bottom:3mm;}'
        + '.filtro{text-align:center;font-size:8.5pt;color:#b91c1c;font-weight:700;margin-bottom:2mm;}'
        + 'h2{font-size:10.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.8px;'
        +   'border-bottom:1.5px solid #000;padding-bottom:2px;margin:6mm 0 2mm;}'
        + 'h2 .cuantos{background:#000;color:#fff;border-radius:10px;padding:0 7px;font-size:8.5pt;'
        +   'margin-left:4px;letter-spacing:0;}'
        + '.resumen{display:flex;gap:3mm;margin:3mm 0 4mm;}'
        + '.rb{flex:1;border:1.5px solid #000;padding:2.5mm;text-align:center;}'
        + '.rb.tc{background:#f2f2f2;}'
        + '.rn{font-size:15pt;font-weight:900;line-height:1.1;}'
        + '.rl{font-size:7.5pt;color:#444;text-transform:uppercase;letter-spacing:0.4px;margin-top:1mm;}'
        + 'table{width:100%;border-collapse:collapse;margin-bottom:2mm;}'
        + 'th{background:#eee;text-align:left;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.4px;'
        +   'border-bottom:1.5px solid #000;padding:2.5px 5px;}'
        + 'td{padding:3px 5px;font-size:8.5pt;border-bottom:1px solid #e5e5e5;vertical-align:top;}'
        + 'td.c,th.c{text-align:center;}td.n,th.n{text-align:right;white-space:nowrap;}'
        + 'td.tc{color:#b91c1c;}'
        + '.sub{color:#777;font-size:7.5pt;}'
        + '.pend{color:#b91c1c;font-style:italic;font-size:7.5pt;}'
        + '.aster{color:#b91c1c;font-weight:900;}'
        + 'tbody tr:nth-child(even){background:#f8f8f8;}'
        + 'tfoot td{border-top:1.5px solid #000;border-bottom:none;background:#fff;font-size:9pt;padding-top:3px;}'
        + '.alerta{border:1.5px solid #000;background:#eee;padding:2.5mm 3.5mm;margin:2.5mm 0;font-size:8.5pt;}'
        + '.alerta ul{margin:1.5mm 0 1.5mm 5mm;}.alerta li{margin-bottom:0.8mm;}'
        + '.nota{font-size:8pt;color:#555;margin-bottom:1.5mm;}'
        + '.firmas{display:flex;justify-content:space-around;margin-top:14mm;page-break-inside:avoid;}'
        + '.fb{text-align:center;width:40%;}'
        + '.fl{border-top:1.5px solid #000;padding-top:3px;font-size:9pt;font-weight:700;text-transform:uppercase;}'
        + '.fs{font-size:8pt;color:#555;}'
        + '.pie{font-size:7.5pt;color:#666;text-align:center;margin-top:6mm;'
        +   'border-top:1px dashed #ccc;padding-top:2mm;}'
        + '@media print{@page{size:A4 landscape;margin:0;}body{padding:10mm;}'
        +   'h2{page-break-after:avoid;}tr{page-break-inside:avoid;}thead{display:table-header-group;}}'
        + '</style></head><body>'

        + '<h1>INFORME DE SOCIOS ELIMINADOS</h1>'
        + '<div class="sub-h">Fondo Solidario de Propina · Casino de Puerto Varas · Ley 17312 del 29/07/70</div>'
        + (term ? '<div class="filtro">Filtrado por «' + esc(term) + '» — no es la lista completa</div>' : '')
        + '<div class="lugar">' + esc(lugarFecha) + '</div>'
        + resumen
        + avisos
        + tabla('Salidas por término de contrato', conTC, true,
                'La fecha es el primer día congelado: desde ahí el socio deja de percibir la recaudación.')
        + tabla('Otras salidas', sinTC, false,
                'Sin registro de término de contrato en el respaldo. Si alguna lo fue, déjalo anotado '
                + 'en Anticipos y Ausencias para que quede en este informe.')
        + '<div class="firmas">'
        +   '<div class="fb"><div style="height:12mm"></div><div class="fl">' + esc(_elimQuien()) + '</div>'
        +     '<div class="fs">Comisión de Propina</div></div>'
        +   '<div class="fb"><div style="height:12mm"></div><div class="fl">Visto bueno</div>'
        +     '<div class="fs">Presidencia</div></div>'
        + '</div>'
        + '<div class="pie">' + K.length + ' socio' + (K.length === 1 ? '' : 's')
        +   ' · Informe generado el ' + esc(fechaHoyVis) + ' · Sistema Fondo Solidario</div>'
        + '</body></html>';

    const fileName = 'Informe socios eliminados ' + fechaHoyVis.replace(/\//g, '-');
    if (typeof printHTML === 'function') {
        printHTML(html, fileName);
    } else {
        const win = window.open('', '_blank', 'width=1100,height=900');
        if (!win) {
            if (typeof showToast === 'function') showToast('El navegador bloqueó la ventana. Permite las ventanas emergentes.', 'warning');
            return;
        }
        win.document.write(html);
        win.document.close();
    }

    if (typeof sbAuditLog === 'function') sbAuditLog('Informe Socios Eliminados', {
        detalle: K.length + ' socios · ' + conTC.length + ' por término de contrato · total '
            + _elimPlata(totalPagar) + (term ? ' · filtrado por «' + term + '»' : '')
    });
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
