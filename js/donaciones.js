// ============================================================
// DONACIONES — colectas entre socios
//
// Cuando un socio necesita ayuda se abre una COLECTA (un motivo) y los
// socios que quieran aportan un monto. El aporte se DESCUENTA del balance
// del donante y le aparece en propi.solicitada.
//
// Modelo de datos: cada aporte es una fila de la tabla `extras` con
// tipo 'DONACION' y detalle 'Donación: <motivo>'. Se usa `extras` a
// propósito, no una tabla nueva: es la misma vía por la que ya viajan las
// ausencias hasta la app del socio (getDatosSocio → data.extras), así que
// no hace falta ninguna migración en Supabase para que esto funcione.
//
// El monto recaudado NO se abona al balance del beneficiado: la
// administración le entrega el dinero aparte. La app solo lleva la cuenta.
// ============================================================

const DON_TIPO = 'DONACION';
const DON_PREFIJO = 'Donación: ';

let _donAportes = [];        // aportes ya registrados (de la BD)
let _donMontos = {};         // socioId -> monto que se está por registrar
let _donAreaSel = 'todas';
let _donBusqueda = '';

// Un extra es donación si su tipo dice "donacion" (sin tildes ni mayúsculas).
function don_esDonacion(tipo) {
    return String(tipo || '').toLowerCase().replace(/ó/g, 'o').indexOf('donacion') >= 0;
}
// El motivo va dentro de `detalle`, después de "Donación: ".
function don_motivoDe(detalle) {
    const d = String(detalle || '').trim();
    const i = d.indexOf(':');
    const m = i >= 0 ? d.slice(i + 1).trim() : d;
    return m || 'Sin motivo';
}

function _donEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _donMoneda(n) { return formatearMoneda(Math.round(Number(n) || 0)); }
function _donFechaVis(f) {
    const s = String(f || '').substring(0, 10).split('-');
    return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(f || '');
}
function _donAreaNombre(a) {
    const k = String(a || '').toLowerCase();
    const N = { mesas: 'Mesas', maquinas: 'Máquinas', tecnicos: 'Técnicos', boveda: 'Bóveda', gastoscomision: 'Gastos Comisión' };
    return N[k] || (a ? a.charAt(0).toUpperCase() + a.slice(1) : '—');
}

function don_init() {
    _donMontos = {};
    const hoy = new Date().toISOString().split('T')[0];
    const fIn = document.getElementById('don-fecha');
    if (fIn && !fIn.value) fIn.value = hoy;
    don_pintarAreas();
    don_pintarSocios();
    don_cargarAportes();
}

// ── Formulario: área → socios de esa área → monto de cada uno ──────────
function don_pintarAreas() {
    const sel = document.getElementById('don-area');
    if (!sel) return;
    const areas = [...new Set((cacheSocios || []).map(s => String(s.area || '').toLowerCase()).filter(Boolean))].sort();
    const actual = sel.value || 'todas';
    sel.innerHTML = '<option value="todas">Todas las áreas</option>'
        + areas.map(a => `<option value="${_donEsc(a)}">${_donEsc(_donAreaNombre(a))}</option>`).join('');
    sel.value = actual;
}

function don_filtrarSocios() {
    _donAreaSel = (document.getElementById('don-area')?.value) || 'todas';
    _donBusqueda = ((document.getElementById('don-buscar')?.value) || '').toLowerCase().trim();
    don_pintarSocios();
}

function _donSociosVisibles() {
    let lista = (cacheSocios || []).slice();
    if (_donAreaSel !== 'todas') lista = lista.filter(s => String(s.area || '').toLowerCase() === _donAreaSel);
    if (_donBusqueda) lista = lista.filter(s => ((s.nombre || '') + ' ' + (s.apellido || '')).toLowerCase().includes(_donBusqueda));
    return lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
}

function don_pintarSocios() {
    const cont = document.getElementById('don-socios-lista');
    if (!cont) return;
    const lista = _donSociosVisibles();
    if (!lista.length) {
        cont.innerHTML = '<div style="text-align:center;padding:18px;color:#94a3b8;font-size:0.85em;">No hay socios en esta área.</div>';
        don_actualizarResumen();
        return;
    }
    cont.innerHTML = lista.map(s => {
        const val = _donMontos[s.id] ? new Intl.NumberFormat('es-CL').format(_donMontos[s.id]) : '';
        const activo = !!_donMontos[s.id];
        return `<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;border:1px solid ${activo ? '#86efac' : '#e2e8f0'};border-radius:9px;margin-bottom:6px;background:${activo ? '#f0fdf4' : 'white'};">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.85em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_donEsc(s.nombre)} ${_donEsc(s.apellido || '')}</div>
                <div style="font-size:0.7em;color:#94a3b8;">${_donEsc(_donAreaNombre(s.area))}</div>
            </div>
            <input type="text" inputmode="numeric" id="don-m-${_donEsc(s.id)}" value="${val}" placeholder="$0"
                oninput="don_montoCambio('${_donEsc(s.id)}', this)"
                style="width:96px;padding:7px 8px;border:1.5px solid ${activo ? '#22c55e' : '#e2e8f0'};border-radius:8px;font-size:0.85em;font-weight:700;text-align:right;color:#0f172a;background:white;box-sizing:border-box;">
        </div>`;
    }).join('');
    don_actualizarResumen();
}

function don_montoCambio(socioId, input) {
    const n = parseInt(String(input.value || '').replace(/\D/g, '')) || 0;
    if (n > 0) { _donMontos[socioId] = n; input.value = new Intl.NumberFormat('es-CL').format(n); }
    else { delete _donMontos[socioId]; input.value = ''; }
    don_actualizarResumen();
}

// Pone el mismo monto a todos los socios visibles (el área filtrada).
function don_montoParaTodos() {
    const inp = document.getElementById('don-monto-todos');
    const n = parseInt(String(inp?.value || '').replace(/\D/g, '')) || 0;
    const lista = _donSociosVisibles();
    if (!n) { lista.forEach(s => delete _donMontos[s.id]); }
    else { lista.forEach(s => { _donMontos[s.id] = n; }); }
    don_pintarSocios();
}

function don_limpiarSeleccion() {
    _donMontos = {};
    const inp = document.getElementById('don-monto-todos');
    if (inp) inp.value = '';
    don_pintarSocios();
}

function don_actualizarResumen() {
    const ids = Object.keys(_donMontos);
    const total = ids.reduce((s, k) => s + _donMontos[k], 0);
    const el = document.getElementById('don-resumen');
    if (el) {
        el.innerHTML = ids.length
            ? `<b>${ids.length}</b> socio${ids.length === 1 ? '' : 's'} · Total a recaudar <b style="color:#15803d;">${_donMoneda(total)}</b>`
            : '<span style="color:#94a3b8;">Escribe un monto a los socios que van a aportar.</span>';
    }
    const btn = document.getElementById('don-btn-registrar');
    if (btn) btn.disabled = ids.length === 0;
}

// ── Registrar los aportes ──────────────────────────────────────────────
async function don_registrar() {
    const motivo = (document.getElementById('don-motivo')?.value || '').trim();
    const fecha = (document.getElementById('don-fecha')?.value || '').trim() || new Date().toISOString().split('T')[0];
    const ids = Object.keys(_donMontos);

    if (!motivo) {
        showToast('Escribe el motivo de la colecta (para quién es la ayuda)', 'error');
        document.getElementById('don-motivo')?.focus();
        return;
    }
    if (!ids.length) { showToast('Ningún socio tiene monto asignado', 'error'); return; }

    const total = ids.reduce((s, k) => s + _donMontos[k], 0);
    if (!confirm(`¿Registrar ${ids.length} aporte(s) por un total de ${_donMoneda(total)}?\n\nColecta: ${motivo}\n\nA cada socio se le descontará su aporte del balance a recibir y lo verá en su app.`)) return;

    const detalleExtras = ids.map(id => {
        const s = (cacheSocios || []).find(x => String(x.id) === String(id)) || {};
        return {
            id: id,
            nombre: ((s.nombre || '') + ' ' + (s.apellido || '')).trim(),
            fecha: fecha,
            tipo: DON_TIPO,
            monto: _donMontos[id],
            detalle: DON_PREFIJO + motivo
        };
    });

    toggleLoader(true, 'Registrando aportes...');
    try {
        const res = await callApiSocios('registrarBatchExtras', { detalleExtras });
        if (res && res.status === 'error') throw new Error(res.message || 'error');
        showToast(`${ids.length} aporte(s) registrados ✅`, 'success');
        _donMontos = {};
        const mt = document.getElementById('don-monto-todos'); if (mt) mt.value = '';
        globalCacheAllData = null;
        try { localStorage.removeItem(CACHE_KEY_ALL_DATA); } catch(e) {}
        don_pintarSocios();
        await don_cargarAportes();
    } catch(e) {
        showToast('No se pudieron registrar: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}

// ── Colectas registradas ───────────────────────────────────────────────
async function don_cargarAportes() {
    const cont = document.getElementById('don-colectas');
    if (!cont) return;
    cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">⏳ Cargando...</div>';
    try {
        const { data, error } = await dbSoc.from('extras')
            .select('id, socio_id, fecha, tipo, monto, detalle, autor')
            .ilike('tipo', '%donacion%')
            .order('fecha', { ascending: false })
            .limit(2000);
        if (error) throw error;
        _donAportes = data || [];
        don_pintarColectas();
    } catch(e) {
        cont.innerHTML = '<div style="text-align:center;padding:20px;color:#dc2626;font-size:0.85em;">Error al cargar las colectas</div>';
    }
}

function don_pintarColectas() {
    const cont = document.getElementById('don-colectas');
    if (!cont) return;
    if (!_donAportes.length) {
        cont.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.85em;">Todavía no hay colectas registradas.</div>';
        const tot = document.getElementById('don-total-general');
        if (tot) tot.textContent = _donMoneda(0);
        return;
    }

    // Agrupar por motivo
    const grupos = {};
    _donAportes.forEach(a => {
        const m = don_motivoDe(a.detalle);
        if (!grupos[m]) grupos[m] = { motivo: m, aportes: [], total: 0, ultima: '' };
        grupos[m].aportes.push(a);
        grupos[m].total += Number(a.monto) || 0;
        const f = String(a.fecha || '').substring(0, 10);
        if (f > grupos[m].ultima) grupos[m].ultima = f;
    });
    const lista = Object.values(grupos).sort((a, b) => b.ultima.localeCompare(a.ultima));
    const totalGeneral = lista.reduce((s, g) => s + g.total, 0);
    const tot = document.getElementById('don-total-general');
    if (tot) tot.textContent = _donMoneda(totalGeneral);

    cont.innerHTML = lista.map((g, i) => {
        const filas = g.aportes.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map(a => {
            const s = (cacheSocios || []).find(x => String(x.id) === String(a.socio_id));
            const nombre = s ? ((s.nombre || '') + ' ' + (s.apellido || '')).trim() : ('Socio ' + a.socio_id);
            const area = s ? _donAreaNombre(s.area) : '';
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px dashed #e2e8f0;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.8em;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_donEsc(nombre)}</div>
                    <div style="font-size:0.68em;color:#94a3b8;">${_donEsc(area)} · ${_donFechaVis(a.fecha)}${a.autor ? ' · ' + _donEsc(a.autor) : ''}</div>
                </div>
                <b style="font-size:0.82em;color:#15803d;white-space:nowrap;">${_donMoneda(a.monto)}</b>
                <button onclick="don_borrarAporte('${_donEsc(a.id)}','${_donEsc(a.socio_id)}','${_donEsc(String(a.fecha).substring(0,10))}')"
                    title="Anular este aporte y devolverle el monto al socio"
                    style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:3px 7px;font-size:0.72em;cursor:pointer;">🗑</button>
            </div>`;
        }).join('');

        return `<div style="border:1px solid #e2e8f0;border-radius:11px;margin-bottom:10px;overflow:hidden;background:white;">
            <button onclick="don_toggleColecta(${i})" style="width:100%;display:flex;align-items:center;gap:10px;padding:11px 12px;background:#f8fafc;border:none;border-bottom:1px solid #e2e8f0;cursor:pointer;text-align:left;">
                <span style="font-size:1.15em;">💝</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.88em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_donEsc(g.motivo)}</div>
                    <div style="font-size:0.7em;color:#64748b;margin-top:1px;">${g.aportes.length} aporte${g.aportes.length === 1 ? '' : 's'} · último ${_donFechaVis(g.ultima)}</div>
                </div>
                <b style="font-size:0.95em;color:#15803d;white-space:nowrap;">${_donMoneda(g.total)}</b>
                <span id="don-cx-${i}" style="color:#94a3b8;font-size:0.8em;">▾</span>
            </button>
            <div style="display:flex;gap:6px;padding:8px 10px;background:#fdf2f8;border-bottom:1px solid #f9a8d4;flex-wrap:wrap;">
                <button onclick="don_imprimirColecta(${JSON.stringify(g.motivo).replace(/"/g, '&quot;')})"
                    style="flex:1;min-width:120px;background:#9d174d;color:white;border:none;border-radius:8px;padding:7px 10px;font-size:0.76em;font-weight:700;cursor:pointer;">🖨 Imprimir comprobante</button>
                <button onclick="don_guardarCopia(${JSON.stringify(g.motivo).replace(/"/g, '&quot;')})"
                    style="flex:1;min-width:120px;background:white;color:#9d174d;border:1.5px solid #9d174d;border-radius:8px;padding:7px 10px;font-size:0.76em;font-weight:700;cursor:pointer;">💾 Guardar copia</button>
            </div>
            <div id="don-detalle-${i}" style="display:none;">${filas}</div>
        </div>`;
    }).join('');
}

function don_toggleColecta(i) {
    const d = document.getElementById('don-detalle-' + i);
    const c = document.getElementById('don-cx-' + i);
    if (!d) return;
    const abierto = d.style.display !== 'none';
    d.style.display = abierto ? 'none' : 'block';
    if (c) c.textContent = abierto ? '▾' : '▴';
}

// Anular un aporte: borra el extra, con lo que el descuento desaparece del
// balance del socio en las dos apps al recalcularse.
async function don_borrarAporte(id, socioId, fecha) {
    if (!confirm('¿Anular este aporte?\n\nSe le devuelve el monto al balance del socio.')) return;
    toggleLoader(true, 'Anulando aporte...');
    try {
        const res = await callApiSocios('borrarMovimiento', { uuid: id, tipo: 'Extra', socioId: String(socioId), fecha: fecha });
        if (res && res.status === 'error') throw new Error(res.message || 'error');
        globalCacheAllData = null;
        try { localStorage.removeItem(CACHE_KEY_ALL_DATA); } catch(e) {}
        showToast('Aporte anulado', 'success');
        await don_cargarAportes();
    } catch(e) {
        showToast('No se pudo anular: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}

// Formatea el campo "mismo monto para todos" mientras se escribe
function don_fmtMonto(input) {
    const n = parseInt(String(input.value || '').replace(/\D/g, '')) || 0;
    input.value = n ? new Intl.NumberFormat('es-CL').format(n) : '';
}

// ══════════════════════════════════════════════════════════════════════
// COMPROBANTE DE COLECTA — para imprimir y para respaldar el descuento
//
// La copia se guarda como archivo real en el bucket 'documentos' y queda
// listada en la sección Documentación. Eso importa porque "Reiniciar
// Ausencias" limpia la tabla `extras` y con ella los aportes: la copia es
// lo que deja constancia de quién aportó y cuánto se le descontó.
// ══════════════════════════════════════════════════════════════════════

function _donDatosColecta(motivo) {
    const aportes = _donAportes.filter(a => don_motivoDe(a.detalle) === motivo);
    const porArea = {};
    let total = 0;
    aportes.forEach(a => {
        const s = (cacheSocios || []).find(x => String(x.id) === String(a.socio_id)) || {};
        const areaKey = String(s.area || 'sin-area').toLowerCase();
        if (!porArea[areaKey]) porArea[areaKey] = { nombre: _donAreaNombre(s.area), filas: [], total: 0 };
        const monto = Number(a.monto) || 0;
        total += monto;
        porArea[areaKey].total += monto;
        porArea[areaKey].filas.push({
            nombre: (((s.nombre || '') + ' ' + (s.apellido || '')).trim()) || ('Socio ' + a.socio_id),
            rut: s.rut || '—',
            fecha: String(a.fecha || '').substring(0, 10),
            autor: a.autor || '—',
            monto: monto
        });
    });
    Object.values(porArea).forEach(g => g.filas.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')));
    const areas = Object.values(porArea).sort((a, b) => b.total - a.total);
    return { motivo, aportes, areas, total };
}

function _donComprobanteHTML(motivo) {
    const d = _donDatosColecta(motivo);
    if (!d.aportes.length) return null;

    const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    const money = n => '$' + Number(Math.round(n) || 0).toLocaleString('es-CL');
    const hoy = new Date();
    const fechaVis = hoy.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaVis = hoy.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const fechas = d.aportes.map(a => String(a.fecha || '').substring(0, 10)).filter(Boolean).sort();
    const rango = fechas.length
        ? (_donFechaVis(fechas[0]) + (fechas[0] !== fechas[fechas.length - 1] ? ' al ' + _donFechaVis(fechas[fechas.length - 1]) : ''))
        : '—';

    let n = 0;
    const secciones = d.areas.map(g =>
        '<div class="area">'
        + '<div class="areahead"><span>' + esc(g.nombre) + '</span><span>'
        +   g.filas.length + ' aporte' + (g.filas.length !== 1 ? 's' : '') + ' &nbsp;|&nbsp; ' + money(g.total) + '</span></div>'
        + '<table class="tbl"><thead><tr>'
        +   '<th style="width:5%">#</th><th style="width:34%">SOCIO</th><th style="width:16%">RUT</th>'
        +   '<th style="width:13%">FECHA</th><th style="width:17%">REGISTRADO POR</th><th style="width:15%">APORTE</th>'
        + '</tr></thead><tbody>'
        + g.filas.map(f => {
            n++;
            return '<tr><td class="c">' + n + '</td><td class="nom">' + esc(f.nombre) + '</td>'
                + '<td class="c">' + esc(f.rut) + '</td><td class="c">' + _donFechaVis(f.fecha) + '</td>'
                + '<td class="c">' + esc(f.autor) + '</td><td class="c pts">' + money(f.monto) + '</td></tr>';
        }).join('')
        + '</tbody><tfoot><tr class="sub"><td colspan="5">SUBTOTAL ' + esc(g.nombre.toUpperCase()) + '</td>'
        +   '<td class="c">' + money(g.total) + '</td></tr></tfoot></table>'
        + '</div>'
    ).join('');

    const resumen = '<table class="resumen"><thead><tr><th>ÁREA</th><th>APORTES</th><th>TOTAL</th></tr></thead><tbody>'
        + d.areas.map(g => '<tr><td>' + esc(g.nombre) + '</td><td class="c">' + g.filas.length + '</td>'
            + '<td class="c" style="font-weight:800;">' + money(g.total) + '</td></tr>').join('')
        + '</tbody><tfoot><tr><td>TOTAL GENERAL</td><td class="c">' + d.aportes.length + '</td>'
        + '<td class="c">' + money(d.total) + '</td></tr></tfoot></table>';

    const fileName = 'Colecta - ' + motivo.replace(/[\\/:*?"<>|]/g, ' ').substring(0, 60).trim() + ' - ' + fechaVis.replace(/\//g, '-');

    const html =
        '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>' + esc(fileName) + '</title><style>'
        + '* { margin:0; padding:0; box-sizing:border-box; }'
        + 'body { font-family:Arial,Helvetica,sans-serif; font-size:9px; color:#000; padding:10px; }'
        + 'h1 { font-size:14px; text-align:center; font-weight:900; letter-spacing:1px; }'
        + '.sub0 { text-align:center; font-size:8.5px; margin:2px 0 4px; font-weight:600; color:#334155; }'
        + '.motivo { text-align:center; font-size:11px; font-weight:900; color:#9d174d; border:1.5px solid #f9a8d4; background:#fdf2f8; border-radius:4px; padding:6px; margin:6px 0 8px; }'
        + '.kpis { display:flex; gap:6px; margin-bottom:10px; }'
        + '.kpi { flex:1; border:1px solid #cbd5e1; border-radius:4px; padding:5px 6px; text-align:center; }'
        + '.kpi b { display:block; font-size:13px; color:#0f172a; }'
        + '.kpi span { font-size:7px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; font-weight:700; }'
        + '.area { margin-bottom:10px; page-break-inside:avoid; break-inside:avoid; }'
        + '.areahead { background:#9d174d; color:#fff; padding:4px 8px; font-size:9.5px; font-weight:900; display:flex; justify-content:space-between; border-radius:3px 3px 0 0; }'
        + '.tbl { width:100%; border-collapse:collapse; table-layout:fixed; }'
        + '.tbl th { background:#e2e8f0; border:1px solid #94a3b8; padding:3px 4px; font-size:7px; text-transform:uppercase; letter-spacing:.04em; }'
        + '.tbl td { border:1px solid #cbd5e1; padding:3px 4px; font-size:8px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }'
        + '.tbl .c { text-align:center; } .tbl .nom { font-weight:700; } .tbl .pts { font-weight:900; }'
        + '.tbl tfoot .sub td { background:#fdf2f8; font-weight:800; font-size:7.5px; }'
        + '.resumen { width:100%; border-collapse:collapse; margin-top:6px; }'
        + '.resumen th { background:#0f172a; color:#fff; border:1px solid #0f172a; padding:4px; font-size:7.5px; text-transform:uppercase; }'
        + '.resumen td { border:1px solid #94a3b8; padding:4px; font-size:8.5px; }'
        + '.resumen tfoot td { background:#9d174d; color:#fff; font-weight:900; }'
        + '.nota { margin-top:8px; border:1px dashed #cbd5e1; border-radius:4px; padding:6px 8px; font-size:8px; color:#334155; line-height:1.45; }'
        + '.firmas { display:flex; gap:30px; margin-top:24px; }'
        + '.firma { flex:1; text-align:center; font-size:8px; color:#334155; }'
        + '.firma .linea { border-top:1px solid #000; margin-bottom:3px; height:1px; }'
        + '.footer { text-align:center; font-size:7.5px; color:#94a3b8; margin-top:10px; border-top:1px dashed #cbd5e1; padding-top:4px; }'
        + '@media print { @page { margin:8mm; size:216mm 330mm portrait; } body { padding:0 !important; } .page { max-width:none !important; padding:0 !important; box-shadow:none !important; } }'
        + '@media screen { body { background:#ddd; } .page { background:#fff; max-width:860px; margin:0 auto; padding:14px; box-shadow:0 2px 12px rgba(0,0,0,.2); } }'
        + '<\/style></head><body><div class="page">'
        + '<h1>COMPROBANTE DE COLECTA SOLIDARIA</h1>'
        + '<div class="sub0">FONDO DE SOLIDARIDAD &mdash; CASINO DE PUERTO VARAS &nbsp;|&nbsp; LEY 17312 DEL 29/07/70</div>'
        + '<div class="motivo">' + esc(d.motivo) + '</div>'
        + '<div class="kpis">'
        +   '<div class="kpi"><b>' + d.aportes.length + '</b><span>Aportes</span></div>'
        +   '<div class="kpi"><b>' + d.areas.length + '</b><span>Áreas</span></div>'
        +   '<div class="kpi"><b>' + money(d.total) + '</b><span>Total juntado</span></div>'
        +   '<div class="kpi"><b>' + esc(rango) + '</b><span>Período de los aportes</span></div>'
        + '</div>'
        + secciones
        + '<div class="areahead" style="border-radius:3px 3px 0 0;">RESUMEN POR ÁREA</div>'
        + resumen
        + '<div class="nota"><b>Respaldo del descuento:</b> a cada socio de esta lista se le descontó el monto indicado '
        +   'de su <b>balance a recibir</b> del período, y el descuento le aparece en su aplicación con el motivo de la colecta. '
        +   'El total juntado <b>no se abona</b> al balance del socio beneficiado: se le entrega aparte.</div>'
        + '<div class="firmas">'
        +   '<div class="firma"><div class="linea"></div>Administración del Fondo</div>'
        +   '<div class="firma"><div class="linea"></div>Recibí conforme</div>'
        + '</div>'
        + '<div class="footer">Emitido el ' + fechaVis + ' a las ' + horaVis + ' &middot; Sistema Integral Fondo Solidario</div>'
        + '</div></body></html>';

    return { html, fileName, datos: d };
}

// Imprimir / guardar como PDF
function don_imprimirColecta(motivo) {
    const r = _donComprobanteHTML(motivo);
    if (!r) { showToast('Esta colecta no tiene aportes', 'error'); return; }
    printHTML(r.html, r.fileName);
}

// CSV plano por si se quiere abrir en Excel
function _donCSV(motivo) {
    const d = _donDatosColecta(motivo);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lineas = [['Colecta', 'Area', 'Socio', 'RUT', 'Fecha', 'Registrado por', 'Aporte'].map(q).join(';')];
    d.areas.forEach(g => g.filas.forEach(f => {
        lineas.push([d.motivo, g.nombre, f.nombre, f.rut, _donFechaVis(f.fecha), f.autor, f.monto].map(q).join(';'));
    }));
    lineas.push(['', '', '', '', '', 'TOTAL', d.total].map(q).join(';'));
    return '﻿' + lineas.join('\r\n');   // BOM para que Excel respete los acentos
}

// Guardar la copia como archivo en Documentación (bucket 'documentos').
// Sube el comprobante HTML y el CSV; ambos quedan descargables desde ahí.
async function don_guardarCopia(motivo) {
    const r = _donComprobanteHTML(motivo);
    if (!r) { showToast('Esta colecta no tiene aportes', 'error'); return; }
    if (!confirm(`¿Guardar la copia de "${motivo}"?\n\nQuedará en Documentación → Generales como comprobante (HTML) y planilla (CSV), aunque después se reinicien las ausencias.`)) return;

    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : {};
    const quien = sesion.ini ? (sesion.ini + (sesion.area ? ' (' + sesion.area + ')' : '')) : 'Administración';
    const stamp = Date.now();
    const safe = r.fileName.replace(/[^a-zA-Z0-9._ -]/g, '_');

    toggleLoader(true, 'Guardando copia...');
    try {
        const archivos = [
            { nombre: safe + '.html', cuerpo: r.html, mime: 'text/html;charset=utf-8' },
            { nombre: safe + '.csv',  cuerpo: _donCSV(motivo), mime: 'text/csv;charset=utf-8' }
        ];
        for (const f of archivos) {
            const blob = new Blob([f.cuerpo], { type: f.mime });
            const path = 'donaciones/' + stamp + '_' + f.nombre.replace(/[^a-zA-Z0-9._-]/g, '_');
            const up = await dbSoc.storage.from('documentos').upload(path, blob, { contentType: f.mime, upsert: false });
            if (up.error) throw up.error;
            await dbSoc.from('documentos').insert({
                id: crypto.randomUUID(), socio_id: null, socio_nombre: null, categoria: 'general',
                nombre_archivo: f.nombre, storage_path: path, mime: f.mime, tamano: blob.size, subido_por: quien
            });
        }
        if (typeof sbAuditLog === 'function') sbAuditLog('Respaldar Colecta', {
            detalle: 'Copia guardada: ' + motivo + ' — ' + r.datos.aportes.length + ' aportes, ' + _donMoneda(r.datos.total),
            datos: { motivo, aportes: r.datos.aportes.length, total: r.datos.total }
        });
        showToast('Copia guardada en Documentación ✅', 'success');
    } catch(e) {
        showToast('No se pudo guardar la copia: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}

// ¿Hay aportes registrados sin copia guardada? Lo usa el aviso antes de
// reiniciar ausencias, que borra la tabla `extras` y con ella los aportes.
async function don_colectasSinCopia() {
    try {
        if (!_donAportes.length) await don_cargarAportes();
        if (!_donAportes.length) return [];
        const motivos = [...new Set(_donAportes.map(a => don_motivoDe(a.detalle)))];
        const { data } = await dbSoc.from('documentos').select('nombre_archivo').like('storage_path', 'donaciones/%');
        const guardados = (data || []).map(d => String(d.nombre_archivo || ''));
        return motivos.filter(m => {
            const clave = 'Colecta - ' + m.replace(/[\\/:*?"<>|]/g, ' ').substring(0, 60).trim();
            return !guardados.some(g => g.indexOf(clave) === 0);
        });
    } catch(e) { return []; }
}
