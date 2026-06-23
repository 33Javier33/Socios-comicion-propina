// ============================================================
// DESGLOSE DE ANTICIPOS — historial con detalle de billetes
// ============================================================

let _dsgRegistros = [];      // todos los registros cargados desde Supabase
let _dsgFiltrados = [];      // registros tras aplicar filtros
let _dsgCargando = false;

// Llamado cuando se registra un anticipo nuevo (inyección desde anticipos.js)
function dsg_onNuevoAnticipo(registro) {
    _dsgRegistros.unshift(registro);
    dsg_filtrar();
}

// Carga el historial desde Supabase (via AQ_URL_POST interceptado)
async function dsg_cargarHistorial(forzar = false) {
    if (_dsgCargando) return;
    _dsgCargando = true;

    const lista = document.getElementById('dsg-lista');
    if (lista) lista.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:0.9em;">⏳ Cargando...</div>';

    try {
        const res = await fetch(AQ_URL_POST, {
            method: 'POST',
            body: JSON.stringify({ action: 'getRetirosAnticipos', limit: 300 })
        });
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
            _dsgRegistros = json.data;
        } else {
            _dsgRegistros = [];
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

    if (vacio)   { vacio.style.display = 'none'; }

    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const totalMonto = _dsgFiltrados.reduce((s, r) => s + Number(r.monto || 0), 0);

    if (resumen) {
        resumen.style.display = 'block';
        resumen.textContent = `${_dsgFiltrados.length} registro${_dsgFiltrados.length !== 1 ? 's' : ''} · Total: ${fmt(totalMonto)}`;
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

