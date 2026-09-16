// ─────────────────────────────────────────────────────────────
// MESES ANTERIORES — foto completa del mes cerrado por socio.
// Lee de la tabla Supabase 'cierres_mes_historial' (acciones
// getMesesAnteriores / getMesAnteriorDetalle). Muestra, por período,
// cada socio con: anticipos (detalle + total), alcance, saldo anterior,
// remanente y lo pagado.
// ─────────────────────────────────────────────────────────────

let _mesesAntPeriodos = [];      // [{periodo, socios, totalAnticipos, totalAPagar, ...}]
let _mesesAntPeriodoSel = null;  // período seleccionado (label crudo)
let _mesesAntDetalle = [];       // detalle de socios del período seleccionado
let _mesesAntTotalRec = null;    // total recaudado del período (de Carpetas)
let _mesesAntTotalPtos = null;   // valor punto total del período
let _mesesAntAreaFiltro = 'Todas'; // filtro de área activo
let _mesesAntCargando = false;

// Clave/etiqueta de área (normaliza mayúsculas/acentos: "mesas"/"Mesas" → una sola)
function _maAreaKey(area) { return String(area || '').trim().toLowerCase() || 'sin área'; }
function _maAreaLabel(area) {
    const s = String(area || '').trim();
    if (!s) return 'Sin área';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

const _MA_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _MA_MESES_L = _MA_MESES.map(m => m.toLowerCase());

function _maFmt(v) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(v) || 0);
}
function _maEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Clave año-mes para ordenar los períodos cronológicamente.
function _maCanon(periodo) {
    const s = String(periodo || '').toLowerCase();
    const y = (s.match(/\b(20\d{2})\b/) || [])[1];
    let mo = null;
    const num = s.match(/20\d{2}[-\/](\d{1,2})/);
    if (num) mo = parseInt(num[1], 10);
    else for (let i = 0; i < 12; i++) if (s.includes(_MA_MESES_L[i])) { mo = i + 1; break; }
    if (y && mo >= 1 && mo <= 12) return y + '-' + String(mo).padStart(2, '0');
    return '0000-00';
}
// Etiqueta legible: "CIERRE_JULIO_DE 2026" → "Julio 2026", "2026-06-15" → "Junio 2026".
function _maLabel(periodo) {
    const c = _maCanon(periodo);
    const m = /^(\d{4})-(\d{2})$/.exec(c);
    if (m && m[2] !== '00') return _MA_MESES[parseInt(m[2], 10) - 1] + ' ' + m[1];
    return String(periodo || 'Período');
}

async function mesesAnt_init() {
    const cont = document.getElementById('mesesant-periodos');
    if (!cont || _mesesAntCargando) return;
    _mesesAntCargando = true;
    cont.innerHTML = '<div style="color:#94a3b8;font-size:0.85em;padding:6px;">Cargando períodos…</div>';
    // Los sobres sin retirar se cargan aparte: es lo primero que hay que ver al
    // entrar, y no debe quedarse esperando a que carguen los períodos.
    if (typeof sobres_cargar === 'function') sobres_cargar();
    try {
        const res = await callApiSocios('getMesesAnteriores', {});
        _mesesAntPeriodos = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
        _mesesAntPeriodos.sort((a, b) => _maCanon(b.periodo).localeCompare(_maCanon(a.periodo)));
        _mesesAnt_renderChips();
        // Autoseleccionar el más reciente
        if (_mesesAntPeriodos.length > 0) {
            const sigueValido = _mesesAntPeriodoSel && _mesesAntPeriodos.some(p => p.periodo === _mesesAntPeriodoSel);
            mesesAnt_seleccionar(sigueValido ? _mesesAntPeriodoSel : _mesesAntPeriodos[0].periodo);
        } else {
            document.getElementById('mesesant-lista').innerHTML = '';
            document.getElementById('mesesant-vacio').style.display = 'block';
            document.getElementById('mesesant-vacio').textContent = 'Aún no hay meses cerrados para mostrar.';
            document.getElementById('mesesant-resumen').style.display = 'none';
            document.getElementById('mesesant-buscador').style.display = 'none';
        }
    } catch (e) {
        cont.innerHTML = '<div style="color:#dc2626;font-size:0.85em;padding:6px;">Error al cargar. Reintenta.</div>';
    } finally { _mesesAntCargando = false; }
}

function _mesesAnt_renderChips() {
    const cont = document.getElementById('mesesant-periodos');
    if (!cont) return;
    cont.innerHTML = _mesesAntPeriodos.map(p => {
        const activo = p.periodo === _mesesAntPeriodoSel;
        return `<button onclick="mesesAnt_seleccionar('${_maEsc(p.periodo).replace(/'/g, "\\'")}')"
            style="background:${activo ? '#1e3a5f' : '#fff'};color:${activo ? '#fff' : '#334155'};border:1px solid ${activo ? '#1e3a5f' : '#cbd5e1'};border-radius:20px;padding:7px 14px;font-size:0.82em;font-weight:700;cursor:pointer;white-space:nowrap;">
            ${_maEsc(_maLabel(p.periodo))} <span style="opacity:0.7;font-weight:600;">· ${p.socios}</span>
        </button>`;
    }).join('');
}

async function mesesAnt_seleccionar(periodo) {
    _mesesAntPeriodoSel = periodo;
    _mesesAnt_renderChips();
    const lista = document.getElementById('mesesant-lista');
    const vacio = document.getElementById('mesesant-vacio');
    lista.innerHTML = '<div style="color:#94a3b8;font-size:0.85em;padding:20px;text-align:center;">Cargando detalle…</div>';
    vacio.style.display = 'none';
    try {
        const res = await callApiSocios('getMesAnteriorDetalle', { periodo });
        _mesesAntDetalle = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
        _mesesAntTotalRec = res && res.totalRecaudado != null ? Number(res.totalRecaudado) : null;
        _mesesAntTotalPtos = res && res.totalPuntos != null ? Number(res.totalPuntos) : null;
        const f = document.getElementById('mesesant-filtro');
        if (f) f.value = '';
        _mesesAntAreaFiltro = 'Todas';
        _mesesAnt_renderResumen();
        _mesesAnt_renderAreas();
        _mesesAnt_aplicarFiltros();
    } catch (e) {
        lista.innerHTML = '<div style="color:#dc2626;font-size:0.85em;padding:20px;text-align:center;">Error al cargar el detalle.</div>';
    }
}

// Chips de áreas (Todas + cada área presente, con el conteo de socios)
function _mesesAnt_renderAreas() {
    const cont = document.getElementById('mesesant-areas');
    if (!cont) return;
    const conteo = {};
    _mesesAntDetalle.forEach(r => { const k = _maAreaKey(r.area); conteo[k] = (conteo[k] || 0) + 1; });
    const areas = Object.keys(conteo).sort((a, b) => a.localeCompare(b));
    if (_mesesAntDetalle.length === 0) { cont.innerHTML = ''; return; }
    const chip = (key, label, n, activo) => `<button onclick="mesesAnt_filtrarArea('${_maEsc(key).replace(/'/g, "\\'")}')"
        style="background:${activo ? '#1e3a5f' : '#fff'};color:${activo ? '#fff' : '#334155'};border:1px solid ${activo ? '#1e3a5f' : '#cbd5e1'};border-radius:18px;padding:6px 12px;font-size:0.78em;font-weight:700;cursor:pointer;white-space:nowrap;">
        ${_maEsc(label)}${n != null ? ` <span style="opacity:0.7;font-weight:600;">${n}</span>` : ''}</button>`;
    cont.innerHTML = chip('Todas', 'Todas', _mesesAntDetalle.length, _mesesAntAreaFiltro === 'Todas')
        + areas.map(k => chip(k, _maAreaLabel(k), conteo[k], _mesesAntAreaFiltro === k)).join('');
}

function mesesAnt_filtrarArea(area) {
    _mesesAntAreaFiltro = area || 'Todas';
    _mesesAnt_renderAreas();
    _mesesAnt_aplicarFiltros();
}

// Aplica filtro de nombre + área y renderiza (agrupado por área si 'Todas').
function _mesesAnt_aplicarFiltros() {
    const t = ((document.getElementById('mesesant-filtro') || {}).value || '').toLowerCase().trim();
    let rows = _mesesAntDetalle;
    if (t) rows = rows.filter(r => String(r.nombre || '').toLowerCase().includes(t));
    if (_mesesAntAreaFiltro !== 'Todas') rows = rows.filter(r => _maAreaKey(r.area) === _mesesAntAreaFiltro);
    _mesesAnt_renderLista(rows, _mesesAntAreaFiltro === 'Todas');
}

function _mesesAnt_renderResumen() {
    const el = document.getElementById('mesesant-resumen');
    const busc = document.getElementById('mesesant-buscador');
    if (!el) return;
    const d = _mesesAntDetalle;
    const totalAnt = d.reduce((s, x) => s + (Number(x.anticiposTotal) || 0), 0);
    const totalPagar = d.reduce((s, x) => s + (Number(x.aPagar) || 0), 0);
    const totalRem = d.reduce((s, x) => s + (Number(x.remanente) || 0), 0);
    const conDatos = d.some(x => x.alcance != null || x.aPagar != null);
    const conAnticipos = d.filter(x => (x.anticipos || []).length > 0 || Number(x.anticiposTotal) > 0).length;
    el.style.display = 'block';
    busc.style.display = d.length > 0 ? 'block' : 'none';
    const recHtml = _mesesAntTotalRec != null ? `
        <div style="background:linear-gradient(135deg,#065f46,#059669);border-radius:12px;padding:11px 14px;margin-bottom:10px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div>
                <div style="font-size:0.68em;text-transform:uppercase;font-weight:700;letter-spacing:0.05em;opacity:0.85;">💵 Total recaudado del período</div>
                <div style="font-size:1.3em;font-weight:900;">${_maFmt(_mesesAntTotalRec)}</div>
            </div>
            ${_mesesAntTotalPtos != null ? `<div style="text-align:right;">
                <div style="font-size:0.68em;text-transform:uppercase;font-weight:700;letter-spacing:0.05em;opacity:0.85;">Valor punto</div>
                <div style="font-size:1.05em;font-weight:800;">${_maFmt(_mesesAntTotalPtos)}</div>
            </div>` : ''}
        </div>` : '';
    el.innerHTML = recHtml + `
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div style="flex:1;min-width:90px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:9px 12px;text-align:center;">
                <div style="font-size:1.15em;font-weight:900;color:#1e40af;">${d.length}</div>
                <div style="font-size:0.66em;text-transform:uppercase;font-weight:700;color:#1e40af;letter-spacing:0.04em;">Socios${conAnticipos ? ' · ' + conAnticipos + ' c/ant' : ''}</div>
            </div>
            <div style="flex:1;min-width:90px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:9px 12px;text-align:center;">
                <div style="font-size:1.15em;font-weight:900;color:#b91c1c;">${_maFmt(totalAnt)}</div>
                <div style="font-size:0.66em;text-transform:uppercase;font-weight:700;color:#991b1b;letter-spacing:0.04em;">Anticipos</div>
            </div>
            ${conDatos ? `<div style="flex:1;min-width:90px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:9px 12px;text-align:center;">
                <div style="font-size:1.15em;font-weight:900;color:#15803d;">${_maFmt(totalPagar)}</div>
                <div style="font-size:0.66em;text-transform:uppercase;font-weight:700;color:#15803d;letter-spacing:0.04em;">Pagado</div>
            </div>
            <div style="flex:1;min-width:90px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:9px 12px;text-align:center;">
                <div style="font-size:1.15em;font-weight:900;color:#7c3aed;">${_maFmt(totalRem)}</div>
                <div style="font-size:0.66em;text-transform:uppercase;font-weight:700;color:#7c3aed;letter-spacing:0.04em;">Remanente</div>
            </div>` : ''}
        </div>
        ${!conDatos ? '<div style="margin-top:8px;font-size:0.74em;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:7px 10px;">ℹ️ De este mes solo se guardaron los anticipos. El detalle de alcance, saldo anterior y remanente se registra desde los cierres nuevos.</div>' : ''}`;
}

function _mesesAnt_renderLista(rows, agrupar) {
    const lista = document.getElementById('mesesant-lista');
    const vacio = document.getElementById('mesesant-vacio');
    if (!lista) return;
    if (!rows || rows.length === 0) {
        lista.innerHTML = '';
        vacio.style.display = 'block';
        vacio.textContent = 'Sin socios para este filtro.';
        return;
    }
    vacio.style.display = 'none';

    if (!agrupar) {
        lista.innerHTML = rows.map((r, i) => _mesesAnt_card(r, i)).join('');
        return;
    }
    // Agrupar por área con encabezado y subtotal de anticipos
    const grupos = {};
    rows.forEach(r => { const k = _maAreaKey(r.area); (grupos[k] = grupos[k] || []).push(r); });
    const keys = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
    let idx = 0;
    lista.innerHTML = keys.map(k => {
        const g = grupos[k];
        const subAnt = g.reduce((s, x) => s + (Number(x.anticiposTotal) || 0), 0);
        const cards = g.map(r => _mesesAnt_card(r, idx++)).join('');
        return `<div style="margin-top:2px;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#eef2f7;border-radius:8px;margin-bottom:8px;">
                <span style="font-size:0.8em;font-weight:800;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.04em;">${_maEsc(_maAreaLabel(k))} <span style="color:#64748b;font-weight:600;">· ${g.length}</span></span>
                <span style="font-size:0.76em;font-weight:700;color:#b91c1c;">${_maFmt(subAnt)}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">${cards}</div>
        </div>`;
    }).join('');
}

function _mesesAnt_card(r, i) {
    const cid = 'ma-det-' + i;
    const estado = r.estadoCobro === 'cobrado' ? '💵 Cobrado' : (r.estadoCobro === 'en_sobre' ? '📩 En sobre' : '');
    const estadoColor = r.estadoCobro === 'cobrado' ? '#15803d' : (r.estadoCobro === 'en_sobre' ? '#92400e' : '#64748b');
    const antHtml = (r.anticipos || []).length > 0
        ? (r.anticipos || []).map(a => `<div style="display:flex;justify-content:space-between;padding:6px 10px;border-top:1px solid #f1f5f9;font-size:0.8em;">
                <span style="color:#334155;">${_maEsc(a.fecha || '')}${a.responsable ? ' · ' + _maEsc(a.responsable) : ''}</span>
                <span style="font-weight:700;color:#b91c1c;">${_maFmt(a.monto)}</span>
            </div>`).join('')
        : '<div style="padding:8px 10px;color:#94a3b8;font-size:0.8em;">Sin anticipos registrados.</div>';

    // Saldo real = alcance teórico + saldo anterior − anticipos (antes de redondear
    // a "a pagar"). Equivale a: a pagar + remanente.
    let saldoReal = null;
    if (r.alcance != null && r.saldoAnterior != null) saldoReal = Number(r.alcance) + Number(r.saldoAnterior) - Number(r.anticiposTotal || 0);
    else if (r.aPagar != null && r.remanente != null) saldoReal = Number(r.aPagar) + Number(r.remanente);
    const tieneFoto = r.alcance != null || saldoReal != null;
    const recon = !!r.reconstruido;

    const filaDato = (label, val, color, fuerte) => (val == null) ? '' :
        `<div style="display:flex;justify-content:space-between;padding:${fuerte ? '7px 0' : '5px 0'};font-size:${fuerte ? '0.9em' : '0.82em'};${fuerte ? 'border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:2px 0;' : ''}">
            <span style="color:#475569;font-weight:${fuerte ? '800' : '400'};">${label}</span><span style="font-weight:${fuerte ? '900' : '800'};color:${color};">${_maFmt(val)}</span>
        </div>`;

    return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <button onclick="_mesesAnt_toggle('${cid}')" style="width:100%;text-align:left;background:none;border:none;cursor:pointer;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="min-width:0;">
                <div style="font-weight:800;font-size:0.92em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_maEsc(r.nombre)}</div>
                <div style="font-size:0.72em;color:#64748b;font-weight:600;margin-top:2px;">${r.area ? _maEsc(r.area) + ' · ' : ''}${(r.anticipos || []).length} anticipo${(r.anticipos || []).length !== 1 ? 's' : ''}${estado ? ' · ' : ''}<span style="color:${estadoColor};">${estado}</span>${recon ? ' · <span style="color:#b45309;">🔧 reconstruido</span>' : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                ${saldoReal != null
                    ? `<div style="font-size:0.95em;font-weight:900;color:#1e40af;">${_maFmt(saldoReal)}</div><div style="font-size:0.66em;color:#94a3b8;">saldo real ▾</div>`
                    : `<div style="font-size:0.95em;font-weight:900;color:#b91c1c;">${_maFmt(r.anticiposTotal)}</div><div style="font-size:0.66em;color:#94a3b8;">anticipos ▾</div>`}
            </div>
        </button>
        <div id="${cid}" style="display:none;padding:0 14px 12px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin-bottom:8px;">
                ${filaDato('Alcance teórico', r.alcance, '#0f766e')}
                ${filaDato('Saldo anterior', r.saldoAnterior, '#334155')}
                ${filaDato('Total anticipos', r.anticiposTotal, '#b91c1c')}
                ${filaDato('Saldo real', saldoReal, '#1e40af', true)}
                ${filaDato('A pagar', r.aPagar, '#15803d')}
                ${filaDato('Remanente', r.remanente, '#7c3aed')}
                ${!tieneFoto ? `<div style="font-size:0.72em;color:#b45309;padding-top:4px;">${(r.anticipos || []).length > 0 ? 'Solo anticipos guardados para este mes.' : 'Sin datos guardados para este socio este mes.'}</div>` : ''}
                ${tieneFoto && r.alcance == null ? '<div style="font-size:0.7em;color:#b45309;padding-top:4px;">Alcance teórico no disponible (Part-Time: depende de los días trabajados). Se muestran a pagar, remanente y anticipos reales del cierre.</div>' : ''}
                ${recon ? '<div style="font-size:0.7em;color:#b45309;padding-top:6px;">🔧 Reconstruido desde la recaudación archivada. Alcance teórico (puntos × valor punto, sin descontar ausencias); el saldo anterior se encadena mes a mes (mayo parte de $0). El remanente del último mes cerrado usa el saldo real actual del socio.</div>' : ''}
            </div>
            <div style="border:1px solid #f1f5f9;border-radius:8px;overflow:hidden;">
                <div style="padding:6px 10px;background:#f8fafc;font-size:0.72em;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">Anticipos del mes</div>
                ${antHtml}
            </div>
        </div>
    </div>`;
}

function _mesesAnt_toggle(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function mesesAnt_filtrar() {
    // El nombre + el área se combinan en _mesesAnt_aplicarFiltros.
    _mesesAnt_aplicarFiltros();
}

// ══════════════════════════════════════════════════════════════════════
// SOBRES SIN RETIRAR
//
// Al cerrar el mes cada socio queda "cobrado" (se llevó la plata) o
// "en sobre" (quedó guardada acá). Ese estado vivía solo en `cierres_mes`,
// que se vacía al reiniciar el período: apenas se cerraba el mes se perdía
// de vista quién tenía plata sin retirar. Esto lo lee del HISTORIAL, que no
// se vacía, así que el sobre sigue a la vista hasta que alguien lo retire.
// ══════════════════════════════════════════════════════════════════════

let _sobresLista = [];

async function sobres_cargar() {
    const panel = document.getElementById('sobres-panel');
    const cont  = document.getElementById('sobres-lista');
    const badge = document.getElementById('sobres-badge');
    if (!panel || !cont) return;
    cont.innerHTML = '<div style="color:#92400e;font-size:0.82em;padding:6px;">Cargando…</div>';
    panel.style.display = '';
    try {
        const res = await callApiSocios('getSobresPendientes', {});
        _sobresLista = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
    } catch (e) { _sobresLista = []; }

    if (!_sobresLista.length) {
        panel.style.display = 'none';
        return;
    }

    const total = _sobresLista.reduce((s, r) => s + Number(r.a_pagar || 0), 0);
    if (badge) badge.textContent = _sobresLista.length + ' · ' + _maFmt(total);

    // Agrupados por período: lo normal es que sean del último cierre, pero si
    // quedó alguno de meses atrás conviene que salte a la vista.
    const porPeriodo = {};
    _sobresLista.forEach(r => {
        const p = r.periodo || 'Sin período';
        (porPeriodo[p] = porPeriodo[p] || []).push(r);
    });

    cont.innerHTML = Object.entries(porPeriodo).map(([per, filas]) => {
        const sub = filas.reduce((s, r) => s + Number(r.a_pagar || 0), 0);
        const items = filas
            .sort((a, b) => Number(b.a_pagar || 0) - Number(a.a_pagar || 0))
            .map(r => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;background:#fff;border:1px solid #fde68a;border-radius:9px;margin-bottom:5px;">
                <div style="min-width:0;">
                    <div style="font-weight:700;color:#0f172a;font-size:0.88em;">${_maEsc(r.socio_nombre || r.socio_id)}</div>
                    <div style="font-size:0.72em;color:#92400e;">${_maFmt(r.a_pagar)}</div>
                </div>
                <button onclick="sobres_retirar('${_maEsc(String(r.socio_id))}','${_maEsc(per)}')"
                    style="flex-shrink:0;background:#15803d;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:0.74em;font-weight:800;cursor:pointer;">
                    💵 Retiró
                </button>
            </div>`).join('');
        return `<div style="margin-bottom:10px;">
            <div style="font-size:0.76em;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;">
                ${_maEsc(_maLabel(per))} · ${filas.length} sobre${filas.length !== 1 ? 's' : ''} · ${_maFmt(sub)}
            </div>${items}</div>`;
    }).join('');
}

async function sobres_retirar(socioId, periodo) {
    const r = _sobresLista.find(x => String(x.socio_id) === String(socioId) && String(x.periodo) === String(periodo));
    const nombre = r ? (r.socio_nombre || socioId) : socioId;
    if (!confirm(`¿${nombre} retiró su sobre?\n\n${r ? _maFmt(r.a_pagar) : ''} · ${_maLabel(periodo)}\n\nPasa a "cobrado" y sale de esta lista.`)) return;
    toggleLoader(true, 'Registrando…');
    try {
        const res = await callApiSocios('marcarSobreRetirado', { socioId, periodo, nombre });
        if (res && res.status === 'error') throw new Error(res.message || 'error');
        showToast('Sobre retirado — ' + nombre, 'success');
        await sobres_cargar();
        // Si hay un período abierto, se repinta para que cambie el estado del socio
        if (_mesesAntPeriodoSel && typeof mesesAnt_seleccionar === "function") mesesAnt_seleccionar(_mesesAntPeriodoSel);
    } catch (e) {
        showToast('No se pudo registrar: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}
