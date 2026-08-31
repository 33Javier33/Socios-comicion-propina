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
