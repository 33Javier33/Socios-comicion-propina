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
    return (d >= 15 ? new Date(y, m, 15) : new Date(y, m - 1, 15)).toISOString().split('T')[0];
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
        const fechaReg = (r.fecha || (r.created_at || '').slice(0, 10));
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

    const fechaRaw = r.fecha || (r.created_at || '').slice(0, 10);
    let fechaVis = fechaRaw;
    if (fechaRaw && fechaRaw.includes('-')) {
        const p = fechaRaw.split('-');
        if (p.length === 3) fechaVis = p[2] + '/' + p[1] + '/' + p[0];
    }

    let horaVis = '';
    if (r.created_at) {
        try {
            const d = new Date(r.created_at);
            const pad = n => String(n).padStart(2, '0');
            horaVis = pad(d.getHours()) + ':' + pad(d.getMinutes());
        } catch(e) {}
    }

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
        </div>
    </div>`;
}

function _htmlEsc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
