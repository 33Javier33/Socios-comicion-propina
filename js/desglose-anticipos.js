// ============================================================
// DESGLOSE DE ANTICIPOS — historial con detalle de billetes
// ============================================================

let _dsgRegistros = [];             // registros cargados desde Supabase
let _dsgFiltrados = [];             // registros tras aplicar filtros
let _dsgCargando = false;
let _dsgPeriodoSeleccionado = null; // null = activo, 'YYYY-MM-DD' = archivado
let _dsgPeriodos = [];              // períodos archivados disponibles

// Retorna la fecha ISO del inicio del período actual (el 15 correspondiente)
function _dsgCalcPeriodoInicio() {
    const hoy = new Date();
    const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
    const dt = (d >= 15) ? new Date(y, m, 15) : new Date(y, m - 1, 15);
    // Construir la fecha con componentes locales (sin toISOString/UTC) → siempre el día 15
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-15';
}

// "2026-06-15" → "15 Jun – 14 Jul 2026"
function _dsgFormatPeriodo(key) {
    if (!key) return 'Período Actual';
    const [y, m, d] = key.split('-').map(Number);
    const inicio = new Date(y, m - 1, d);
    const fin = new Date(y, m - 1, d);
    fin.setMonth(fin.getMonth() + 1);
    fin.setDate(fin.getDate() - 1);
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const fmt = dt => `${dt.getDate()} ${meses[dt.getMonth()]} ${dt.getFullYear()}`;
    return `${fmt(inicio)} – ${fmt(fin)}`;
}

// ── Fecha/hora en zona horaria de Chile ─────────────────────
// Fecha ISO (YYYY-MM-DD): si el registro tiene `fecha` (date puro elegido por el
// usuario) se usa tal cual; si no, se deriva de created_at PERO en hora de Chile
// (no en UTC) para no correrse un día en registros de la noche.
function _dsgFechaISO(r) {
    if (r && r.fecha) {
        const f = String(r.fecha);
        if (/^\d{4}-\d{2}-\d{2}/.test(f)) return f.slice(0, 10);
    }
    if (r && r.created_at) {
        try { return new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }); } catch(e) {}
    }
    return '';
}

// "DD/MM/YYYY" en zona Chile
function _dsgFechaVis(r) {
    const iso = _dsgFechaISO(r);
    if (!iso) return '';
    const p = iso.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

// Hora "HH:MM" en zona Chile a partir de created_at
function _dsgHoraChile(r) {
    if (!r || !r.created_at) return '';
    try {
        return new Date(r.created_at).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch(e) { return ''; }
}

// Cambia el período y recarga
function dsg_seleccionarPeriodo(periodo) {
    _dsgPeriodoSeleccionado = periodo || null;
    dsg_cargarHistorial(true);
}

// Archiva registros de períodos anteriores
async function dsg_archivarPeriodoAnterior() {
    if (!confirm('¿Archivar los desgloses de períodos anteriores? Esta acción los moverá al historial.')) return;
    toggleLoader(true, 'Archivando desgloses...');
    try {
        const res = await fetch(AQ_URL_POST, {
            method: 'POST',
            body: JSON.stringify({ action: 'archivarDesglosesPeriodo' })
        });
        const json = await res.json();
        if (json.status === 'success') {
            const count = json.count || 0;
            showToast(count > 0 ? `✅ ${count} registros archivados` : 'Sin registros para archivar', count > 0 ? 'success' : 'info');
            await dsg_cargarHistorial(true);
        } else {
            showToast('Error al archivar', 'error');
        }
    } catch(e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        toggleLoader(false);
    }
}

// Renderiza los chips de selección de período
function _dsgRenderPeriodSelector() {
    const el = document.getElementById('dsg-periodo-selector');
    if (!el) return;

    const chips = [
        { periodo: null, label: '📋 Período Actual' },
        ..._dsgPeriodos.map(p => ({ periodo: p, label: _dsgFormatPeriodo(p) }))
    ];

    el.innerHTML = chips.map(c => {
        const active = c.periodo === _dsgPeriodoSeleccionado;
        return `<button onclick="dsg_seleccionarPeriodo(${c.periodo ? "'" + c.periodo + "'" : 'null'})" style="padding:6px 14px;border-radius:20px;border:2px solid ${active ? '#2563eb' : '#d1d5db'};background:${active ? '#eff6ff' : 'white'};color:${active ? '#1e40af' : '#6b7280'};font-size:0.8em;font-weight:${active ? '800' : '600'};cursor:pointer;white-space:nowrap;transition:all 0.15s;">${_htmlEsc(c.label)}</button>`;
    }).join('');
}

// Llamado cuando se registra un anticipo nuevo (inyección desde anticipos.js)
function dsg_onNuevoAnticipo(registro) {
    if (_dsgPeriodoSeleccionado === null) {
        _dsgRegistros.unshift(registro);
        dsg_filtrar();
    }
}

// Carga el historial desde Supabase
async function dsg_cargarHistorial(forzar = false) {
    if (_dsgCargando) return;
    _dsgCargando = true;

    const lista = document.getElementById('dsg-lista');
    if (lista) lista.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:0.9em;">⏳ Cargando...</div>';

    try {
        // Cargar períodos archivados disponibles
        const resPer = await fetch(AQ_URL_POST, {
            method: 'POST',
            body: JSON.stringify({ action: 'getDesglosesPeriodos' })
        });
        const jsonPer = await resPer.json();
        _dsgPeriodos = (jsonPer.status === 'success' && Array.isArray(jsonPer.data)) ? jsonPer.data : [];
        _dsgRenderPeriodSelector();

        // Cargar registros del período seleccionado
        const body = { action: 'getRetirosAnticipos', limit: 300 };
        if (_dsgPeriodoSeleccionado) body.periodo = _dsgPeriodoSeleccionado;

        const res = await fetch(AQ_URL_POST, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        const json = await res.json();
        _dsgRegistros = (json.status === 'success' && Array.isArray(json.data)) ? json.data : [];

        // Mostrar aviso si hay registros de períodos anteriores sin archivar
        const notice = document.getElementById('dsg-archivo-notice');
        if (notice) {
            if (_dsgPeriodoSeleccionado === null) {
                const periodoInicio = _dsgCalcPeriodoInicio();
                const hayViejos = _dsgRegistros.some(r => r.fecha && r.fecha < periodoInicio);
                notice.style.display = hayViejos ? 'flex' : 'none';
            } else {
                notice.style.display = 'none';
            }
        }
    } catch(e) {
        console.warn('[DSG] Error cargando historial:', e.message);
        _dsgRegistros = [];
    } finally {
        _dsgCargando = false;
    }

    dsg_filtrar();
}

// Aplica los filtros y re-renderiza
function dsg_filtrar() {
    const nombre = (document.getElementById('dsg-filtro-nombre')?.value || '').toLowerCase().trim();
    const desde  = document.getElementById('dsg-filtro-desde')?.value || '';
    const hasta  = document.getElementById('dsg-filtro-hasta')?.value || '';

    _dsgFiltrados = _dsgRegistros.filter(r => {
        if (nombre && !(r.socio_nombre || '').toLowerCase().includes(nombre)) return false;
        const fechaReg = _dsgFechaISO(r);
        if (desde && fechaReg && fechaReg < desde) return false;
        if (hasta && fechaReg && fechaReg > hasta) return false;
        return true;
    });

    dsg_renderHistorial();
}

// Limpia filtros y re-renderiza
function dsg_limpiarFiltros() {
    const n = document.getElementById('dsg-filtro-nombre');
    const d = document.getElementById('dsg-filtro-desde');
    const h = document.getElementById('dsg-filtro-hasta');
    if (n) n.value = '';
    if (d) d.value = '';
    if (h) h.value = '';
    dsg_filtrar();
}

// Renderiza la lista de desgloses
function dsg_renderHistorial() {
    const lista   = document.getElementById('dsg-lista');
    const vacio   = document.getElementById('dsg-vacio');
    const resumen = document.getElementById('dsg-resumen');
    if (!lista) return;

    if (_dsgFiltrados.length === 0) {
        lista.innerHTML = '';
        if (vacio)   { vacio.style.display = 'block'; }
        if (resumen) { resumen.style.display = 'none'; }
        return;
    }

    if (vacio) { vacio.style.display = 'none'; }

    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const totalMonto = _dsgFiltrados.reduce((s, r) => s + Number(r.monto || 0), 0);

    if (resumen) {
        const labelPeriodo = _dsgPeriodoSeleccionado ? ` · ${_dsgFormatPeriodo(_dsgPeriodoSeleccionado)}` : '';
        resumen.style.display = 'block';
        resumen.textContent = `${_dsgFiltrados.length} registro${_dsgFiltrados.length !== 1 ? 's' : ''} · Total: ${fmt(totalMonto)}${labelPeriodo}`;
    }

    lista.innerHTML = _dsgFiltrados.map(r => _dsgRenderCard(r)).join('');
}

function _dsgRenderCard(r) {
    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);

    const fechaVis = _dsgFechaVis(r);
    const horaVis = _dsgHoraChile(r);

    const billetes = r.billetes || {};
    const totalBilletes = Object.entries(billetes).reduce((s, [den, cant]) => s + Number(den) * Number(cant), 0);

    let billetesHtml = '';
    const densSorted = Object.entries(billetes).sort((a, b) => Number(b[0]) - Number(a[0]));
    if (densSorted.length > 0) {
        billetesHtml = densSorted.map(([den, cant]) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:#f1f5f9;border-radius:6px;font-size:0.82em;border:1px solid #d1d5db;">
                <span style="font-weight:700;color:#1e3a5f;">${fmt(Number(den))}</span>
                <span style="font-weight:600;color:#374151;">× ${cant}</span>
                <span style="font-weight:800;color:#0f172a;">${fmt(Number(den) * Number(cant))}</span>
            </div>`
        ).join('');
    } else {
        billetesHtml = '<div style="color:#94a3b8;font-size:0.8em;padding:6px 0;">Sin desglose registrado</div>';
    }

    const matchMonto = Math.abs(totalBilletes - Number(r.monto || 0)) <= 1;

    return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
        <div style="padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;border-bottom:1px solid #f1f5f9;">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:0.95em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_htmlEsc(r.socio_nombre || '—')}</div>
                <div style="font-size:0.75em;color:#374151;font-weight:600;margin-top:2px;">${fechaVis}${horaVis ? ' · ' + horaVis : ''}${r.responsable ? ' · ' + _htmlEsc(r.responsable) : ''}</div>
                <div style="font-size:0.72em;color:#4b5563;font-family:monospace;margin-top:2px;">${_htmlEsc(r.firma || '')}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:1.1em;font-weight:900;color:#1e3a5f;">${fmt(Number(r.monto || 0))}</div>
                ${!matchMonto && densSorted.length > 0 ? '<div style="font-size:0.7em;color:#dc2626;font-weight:700;">⚠ Diferencia</div>' : ''}
            </div>
        </div>
        <div style="padding:10px 14px;display:flex;flex-direction:column;gap:4px;">
            ${billetesHtml}
            ${densSorted.length > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-top:2px;background:#eff6ff;border-radius:6px;font-size:0.84em;font-weight:800;color:#1e40af;border:1px solid #bfdbfe;">
                <span>Total billetes</span><span>${fmt(totalBilletes)}</span>
            </div>` : ''}
            <div style="display:flex;gap:6px;margin-top:6px;">
                <button onclick="dsg_reimprimir('${_htmlEsc(r.firma || '')}')" style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:7px;padding:6px 10px;font-size:0.76em;font-weight:700;cursor:pointer;">🖨 Reimprimir</button>
                <button onclick="dsg_abrirEditar('${_htmlEsc(r.firma || '')}')" style="flex:1;background:#fef9c3;border:1px solid #fde047;color:#854d0e;border-radius:7px;padding:6px 10px;font-size:0.76em;font-weight:700;cursor:pointer;">✏️ Editar</button>
            </div>
        </div>
    </div>`;
}

// ── Reimprimir el boucher de un desglose ────────────────────
function dsg_reimprimir(firma) {
    const r = _dsgRegistros.find(x => x.firma === firma);
    if (!r) { showToast('Registro no encontrado', 'error'); return; }
    if (typeof generarBoucherAnticipo !== 'function') { showToast('Impresión no disponible', 'error'); return; }
    const fecha = _dsgFechaISO(r);
    generarBoucherAnticipo({
        id: r.socio_id || '',
        nombre: r.socio_nombre || '',
        fecha,
        monto: Number(r.monto || 0),
        respIni: r.responsable || '',
        respArea: '',
        billetes: r.billetes || {},
        folio: r.firma || ''
    });
}

// ── Editar un desglose (requiere PIN personal del responsable) ──
let _dsgEditFirma = null;

function dsg_abrirEditar(firma) {
    const r = _dsgRegistros.find(x => x.firma === firma);
    if (!r) { showToast('Registro no encontrado', 'error'); return; }
    _dsgEditFirma = firma;

    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const fecha = _dsgFechaISO(r);
    document.getElementById('dsg-edit-socio').textContent = r.socio_nombre || '—';
    document.getElementById('dsg-edit-firma').textContent = r.firma || '';
    document.getElementById('dsg-edit-fecha').value = fecha;

    // Grid de billetes por denominación
    const billetes = r.billetes || {};
    const grid = document.getElementById('dsg-edit-billetes');
    grid.innerHTML = AQ_DENOMINACIONES.map(d => {
        const cant = Number(billetes[d] || 0);
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dotted #e5e7eb;">
            <span style="flex:1;font-weight:700;font-size:0.88em;color:#374151;">${fmt(d)}</span>
            <input type="number" id="dsg-edit-bil-${d}" min="0" value="${cant || ''}" placeholder="0"
                   oninput="dsg_recalcularEdit()"
                   style="width:64px;text-align:center;padding:6px 4px;border:1px solid #d1d5db;border-radius:6px;font-size:1em;font-weight:700;">
            <span id="dsg-edit-sub-${d}" style="width:96px;text-align:right;font-size:0.82em;color:#6b7280;">${cant > 0 ? fmt(d * cant) : '$0'}</span>
        </div>`;
    }).join('');

    // Responsable en sesión (para mostrar quién debe autenticar)
    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : {};
    const quien = sesion.ini ? `${sesion.ini}${sesion.area ? ' (' + sesion.area + ')' : ''}` : '—';
    document.getElementById('dsg-edit-responsable').textContent = quien;

    document.getElementById('dsg-edit-pin').value = '';
    const err = document.getElementById('dsg-edit-error');
    if (err) err.style.display = 'none';

    dsg_recalcularEdit();
    document.getElementById('dsg-modal-editar').style.display = 'flex';
}

function dsg_cerrarEditar() {
    document.getElementById('dsg-modal-editar').style.display = 'none';
    _dsgEditFirma = null;
}

function dsg_recalcularEdit() {
    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    let total = 0;
    AQ_DENOMINACIONES.forEach(d => {
        const cant = Math.max(0, parseInt(document.getElementById('dsg-edit-bil-' + d)?.value || 0) || 0);
        const sub = cant * d;
        total += sub;
        const subEl = document.getElementById('dsg-edit-sub-' + d);
        if (subEl) subEl.textContent = cant > 0 ? fmt(sub) : '$0';
    });
    const totEl = document.getElementById('dsg-edit-total');
    if (totEl) totEl.textContent = fmt(total);
    return total;
}

async function dsg_guardarEdicion() {
    if (!_dsgEditFirma) return;
    const errEl = document.getElementById('dsg-edit-error');
    const mostrarError = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };

    const pin = (document.getElementById('dsg-edit-pin')?.value || '').trim();
    if (!pin) { mostrarError('Ingresa tu PIN personal para confirmar.'); return; }

    // Validación de credencial: SOLO el PIN personal del responsable en sesión.
    // NO se aceptan la clave de recuperación, la clave/PIN global ni el PIN de ingreso.
    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : {};
    const key = sesion.ini && sesion.area ? `${sesion.ini}|${sesion.area}` : '';
    const pinPersonal = key ? (credencialesCache[key] || '') : '';

    if (!pinPersonal) {
        mostrarError('No tienes un PIN personal configurado. Solo quien tenga su clave personal puede editar estos registros.');
        return;
    }
    if (pin !== pinPersonal) {
        mostrarError('PIN incorrecto. Debes usar tu clave personal.');
        const pinEl = document.getElementById('dsg-edit-pin');
        if (pinEl) { pinEl.value = ''; pinEl.focus(); }
        return;
    }

    // Recolectar billetes y total
    const billetes = {};
    let total = 0;
    AQ_DENOMINACIONES.forEach(d => {
        const cant = Math.max(0, parseInt(document.getElementById('dsg-edit-bil-' + d)?.value || 0) || 0);
        if (cant > 0) { billetes[d] = cant; total += cant * d; }
    });
    const fecha = document.getElementById('dsg-edit-fecha')?.value || null;

    if (total <= 0) { mostrarError('El desglose no puede quedar en cero. Ingresa al menos un billete.'); return; }

    const editadoPor = sesion.ini ? `${sesion.ini}${sesion.area ? ' ' + sesion.area : ''}` : '';

    toggleLoader(true, 'Guardando cambios...');
    try {
        const res = await fetch(AQ_URL_POST, {
            method: 'POST',
            body: JSON.stringify({
                action: 'actualizarRetiroAnticipo',
                firma: _dsgEditFirma,
                monto: total,
                billetes,
                fecha,
                editadoPor
            })
        });
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message || 'Error al guardar');

        // Actualizar el registro en memoria y re-renderizar
        const reg = _dsgRegistros.find(x => x.firma === _dsgEditFirma);
        if (reg) { reg.monto = total; reg.billetes = billetes; reg.fecha = fecha; }
        showToast('Desglose actualizado ✅', 'success');
        dsg_cerrarEditar();
        dsg_filtrar();
    } catch(e) {
        mostrarError('Error al guardar: ' + e.message);
    } finally {
        toggleLoader(false);
    }
}

// ── Informe de anticipos (fechas y totales) — 2 columnas por hoja ──
function dsg_informe() {
    if (!_dsgFiltrados.length) { showToast('No hay registros para el informe', 'error'); return; }
    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);

    // Ordenar por fecha ascendente para el informe (fecha en zona Chile)
    const registros = [..._dsgFiltrados].sort((a, b) => _dsgFechaISO(a).localeCompare(_dsgFechaISO(b)));

    const totalGeneral = registros.reduce((s, r) => s + Number(r.monto || 0), 0);
    const periodoLabel = _dsgPeriodoSeleccionado ? _dsgFormatPeriodo(_dsgPeriodoSeleccionado) : 'Período Actual';
    const hoy = new Date();
    const fechaHoyVis = hoy.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Layout de 2 columnas: 43 filas por columna → 86 por hoja, numeración secuencial
    const ROWS_PER_COL = 43;
    const PER_PAGE = ROWS_PER_COL * 2;

    const filaHtml = (r, nGlobal) => {
        const fechaVis = _dsgFechaVis(r);
        const bg = nGlobal % 2 === 0 ? '#f2f2f2' : 'white';
        return `<tr style="background:${bg};">
            <td class="c-n">${nGlobal}</td>
            <td class="c-soc">${_htmlEsc(r.socio_nombre || '—')}</td>
            <td class="c-fec">${fechaVis}</td>
            <td class="c-resp">${_htmlEsc(r.responsable || '')}</td>
            <td class="c-mon">${fmt(Number(r.monto || 0))}</td>
        </tr>`;
    };

    const thead = '<thead><tr>'
        + '<th class="c-n">N°</th><th class="c-soc" style="text-align:left">SOCIO</th>'
        + '<th class="c-fec">FECHA</th><th class="c-resp" style="text-align:left">RESP.</th>'
        + '<th class="c-mon">MONTO</th></tr></thead>';

    // slice: registros de una columna; startIdx: índice base (0-based) para numerar
    const buildCol = (slice, startIdx) => {
        if (!slice.length) return '';
        const rows = slice.map((r, i) => filaHtml(r, startIdx + i + 1)).join('');
        return '<table class="inner">' + thead + '<tbody>' + rows + '</tbody></table>';
    };

    let pagesHtml = '';
    for (let p = 0; p < registros.length; p += PER_PAGE) {
        const pageRows = registros.slice(p, p + PER_PAGE);
        const left  = pageRows.slice(0, ROWS_PER_COL);
        const right = pageRows.slice(ROWS_PER_COL);
        const isLast = (p + PER_PAGE) >= registros.length;
        pagesHtml += '<table class="dos-cols"' + (isLast ? '' : ' style="page-break-after:always;"') + '><tr>'
            + '<td class="col-cell" style="padding-right:3px;">' + buildCol(left, p) + '</td>'
            + '<td style="width:1%;"></td>'
            + '<td class="col-cell" style="padding-left:3px;">' + buildCol(right, p + ROWS_PER_COL) + '</td>'
            + '</tr></table>';
    }

    const html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe Anticipos</title><style>'
        + '*{margin:0;padding:0;box-sizing:border-box;}'
        + 'body{font-family:Arial,sans-serif;font-size:8px;color:#000;padding:8mm;}'
        + 'h1{font-size:14px;text-align:center;font-weight:900;letter-spacing:1px;margin-bottom:2px;}'
        + '.sub{text-align:center;font-size:8px;margin-bottom:6px;font-weight:600;color:#333;}'
        + '.tothead{background:#1e3a5f;color:white;padding:5px 10px;font-size:10px;font-weight:900;display:flex;justify-content:space-between;margin-bottom:8px;border-radius:4px;}'
        + '.dos-cols{width:100%;border-collapse:collapse;}'
        + '.col-cell{width:49.5%;vertical-align:top;}'
        + 'table.inner{width:100%;border-collapse:collapse;table-layout:fixed;}'
        + 'table.inner th{background:#2c3e50;color:white;padding:2px 3px;font-size:6.5px;border:1px solid #1a252f;text-align:center;}'
        + 'table.inner td{padding:1.5px 3px;border:1px solid #ccc;font-size:7px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}'
        + '.c-n{width:8%;text-align:center;}'
        + '.c-soc{width:40%;text-align:left;font-weight:700;}'
        + '.c-fec{width:19%;text-align:center;}'
        + '.c-resp{width:15%;text-align:left;}'
        + '.c-mon{width:18%;text-align:right;font-weight:800;}'
        + '.totfinal{background:#c0392b;color:white;padding:6px 12px;font-weight:900;font-size:12px;text-align:right;border-radius:3px;margin-top:8px;}'
        + '.footer{text-align:center;font-size:7px;color:#888;margin-top:8px;border-top:1px dashed #ccc;padding-top:5px;}'
        + '@media print{@page{size:A4 portrait;margin:8mm;}body{padding:0;}}'
        + '</style></head><body>'
        + '<h1>INFORME DE ANTICIPOS</h1>'
        + '<div class="sub">FONDO DE SOLIDARIDAD — CASINO DE PUERTO VARAS | LEY 17312 DEL 29/07/70</div>'
        + '<div class="tothead"><span>' + _htmlEsc(periodoLabel) + '</span><span>' + registros.length + ' anticipo' + (registros.length !== 1 ? 's' : '') + '</span></div>'
        + pagesHtml
        + '<div class="totfinal">TOTAL GENERAL: ' + fmt(totalGeneral) + '</div>'
        + '<div class="footer">Emitido: ' + fechaHoyVis + ' | Sistema Fondo Solidario — Casino de Puerto Varas</div>'
        + '</body></html>';

    if (typeof printHTML === 'function') printHTML(html, 'Informe Anticipos ' + fechaHoyVis.replace(/\//g, '-'));
    else { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } }
}

function _htmlEsc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
