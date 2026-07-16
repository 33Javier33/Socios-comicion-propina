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
let _mesesAntCargando = false;

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
        const f = document.getElementById('mesesant-filtro');
        if (f) f.value = '';
        _mesesAnt_renderResumen();
        _mesesAnt_renderLista(_mesesAntDetalle);
    } catch (e) {
        lista.innerHTML = '<div style="color:#dc2626;font-size:0.85em;padding:20px;text-align:center;">Error al cargar el detalle.</div>';
    }
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
    el.innerHTML = `
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

function _mesesAnt_renderLista(rows) {
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
    lista.innerHTML = rows.map((r, i) => _mesesAnt_card(r, i)).join('');
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

function mesesAnt_filtrar(texto) {
    const t = (texto || '').toLowerCase().trim();
    const filtrados = !t ? _mesesAntDetalle
        : _mesesAntDetalle.filter(r => String(r.nombre || '').toLowerCase().includes(t));
    _mesesAnt_renderLista(filtrados);
}
