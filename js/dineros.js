// ============================================================
// MÓDULO: DINEROS SOBRANTES (INGRESOS Y RETIROS)
// Espejo de materiales.js — tipos: Ingreso / Retiro
// ============================================================

let dsDatos = [];
let dsPeriodoVista = null;
let dsAñoVista = new Date().getFullYear();

// Convierte monto a número entero
function ds_monto(r) { return Math.round(Number(r.monto) || 0); }

// Dado un string YYYY-MM-DD, retorna el inicio del período (siempre el 15).
function ds_periodoDesFecha(fechaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number);
    if (d >= 15) {
        return `${y}-${String(m).padStart(2,'0')}-15`;
    } else {
        const dt = new Date(y, m - 2, 15);
        const py = dt.getFullYear();
        const pm = dt.getMonth() + 1;
        return `${py}-${String(pm).padStart(2,'0')}-15`;
    }
}

function ds_periodoActual() {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth() + 1;
    const d = hoy.getDate();
    return ds_periodoDesFecha(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
}

function ds_periodoDisplay(periodoStart) {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [y, m] = periodoStart.split('-').map(Number);
    const startMes = meses[m - 1];
    const fechaFin = new Date(y, m, 14);
    const endMes = meses[fechaFin.getMonth()];
    const endYear = fechaFin.getFullYear();
    return `15 ${startMes} → 14 ${endMes} ${endYear}`;
}

// Carga todos los dineros sobrantes desde el backend
async function ds_cargar() {
    if (!dsPeriodoVista) dsPeriodoVista = ds_periodoActual();
    try {
        toggleLoader(true, 'Cargando dineros sobrantes...');
        const res = await callApiSocios('getAllDineros');
        dsDatos = (res && res.data) ? res.data : [];
        ds_render();
    } catch(e) {
        showToast('Error al cargar dineros sobrantes', 'error');
    } finally {
        toggleLoader(false);
    }
}

// Renderiza la vista completa (anual + período)
function ds_render() {
    if (!dsPeriodoVista) dsPeriodoVista = ds_periodoActual();

    ds_render_anual();

    // "Fondo total" = todos los ingresos del año (acumulado global)
    const anuales = dsDatos.filter(r => r.fecha && r.fecha.startsWith(String(dsAñoVista)));
    const fondoTotal    = anuales.filter(r => r.tipo === 'Ingreso').reduce((s, r) => s + ds_monto(r), 0);
    const retirosTotAño = anuales.filter(r => r.tipo === 'Retiro').reduce((s, r) => s + ds_monto(r), 0);
    const balanceGlobal = fondoTotal - retirosTotAño;

    // Retiros = solo los del período actual (15→14)
    const delPeriodo = dsDatos.filter(r => {
        if (!r.fecha) return false;
        return ds_periodoDesFecha(r.fecha) === dsPeriodoVista;
    });
    const retirosPeriodo = delPeriodo.filter(r => r.tipo === 'Retiro').reduce((s, r) => s + ds_monto(r), 0);

    const elFondo   = document.getElementById('ds-total-ingresos');
    const elRet     = document.getElementById('ds-total-retiros');
    const elBalance = document.getElementById('ds-balance');
    const elBalCard = document.getElementById('ds-balance-card');
    if (elFondo)   elFondo.textContent   = formatearMoneda(fondoTotal);
    if (elRet)     elRet.textContent     = formatearMoneda(retirosPeriodo);
    if (elBalance) elBalance.textContent = formatearMoneda(balanceGlobal);
    if (elBalCard) {
        elBalCard.style.background     = balanceGlobal >= 0 ? '#dcfce7' : '#fee2e2';
        elBalCard.style.borderTopColor = balanceGlobal >= 0 ? '#059669' : '#ef4444';
        if (elBalance) elBalance.style.color = balanceGlobal >= 0 ? '#059669' : '#ef4444';
    }

    const elPeriodo = document.getElementById('ds-periodo-label');
    if (elPeriodo) elPeriodo.textContent = ds_periodoDisplay(dsPeriodoVista);

    const elLista = document.getElementById('ds-lista');
    if (!elLista) return;

    if (delPeriodo.length === 0) {
        elLista.innerHTML = '<div style="text-align:center;padding:40px;color:#7f8c8d;font-size:0.9em;">Sin registros en este período</div>';
        return;
    }

    const ordenados = [...delPeriodo].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    elLista.innerHTML = ordenados.map(r => {
        const esIngreso = r.tipo === 'Ingreso';
        const badgeColor = esIngreso ? '#10b981' : '#ef4444';
        const badgeBg    = esIngreso ? '#dcfce7' : '#fee2e2';
        const montoColor = esIngreso ? '#10b981' : '#ef4444';
        const montoSigno = esIngreso ? '+' : '-';
        const fechaDisplay = r.fecha ? r.fecha.split('-').reverse().join('/') : '';
        const notaDisplay = r.nota ? `<div style="font-size:0.78em;color:#374151;margin-top:2px;">${r.nota}</div>` : '';
        return `<div style="background:white;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            <span style="background:${badgeBg};color:${badgeColor};font-size:0.65em;font-weight:800;padding:3px 7px;border-radius:5px;letter-spacing:0.04em;white-space:nowrap;">${r.tipo.toUpperCase()}</span>
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.82em;font-weight:700;color:#2c3e50;">${fechaDisplay}</div>
                ${notaDisplay}
            </div>
            <div style="font-weight:800;color:${montoColor};font-size:0.92em;white-space:nowrap;">${montoSigno}${formatearMoneda(ds_monto(r))}</div>
            <button onclick="ds_borrar('${r.uuid}')" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:2px 4px;color:#94a3b8;line-height:1;" title="Eliminar">🗑️</button>
        </div>`;
    }).join('');
}

function ds_cambiarAño(dir) {
    dsAñoVista += dir;
    ds_render();
}

function ds_toggleDesglose() {
    const el = document.getElementById('ds-desglose-mensual');
    const arrow = document.getElementById('ds-desglose-arrow');
    if (!el) return;
    const visible = el.style.display !== 'none';
    el.style.display = visible ? 'none' : 'flex';
    if (arrow) arrow.textContent = visible ? '▶' : '▼';
}

function ds_render_anual() {
    const año = dsAñoVista;
    const elAño = document.getElementById('ds-año-label');
    if (elAño) elAño.textContent = año;

    const anuales = dsDatos.filter(r => r.fecha && r.fecha.startsWith(String(año)));
    const totalIng = anuales.filter(r => r.tipo === 'Ingreso').reduce((s, r) => s + ds_monto(r), 0);
    const totalRet = anuales.filter(r => r.tipo === 'Retiro').reduce((s, r) => s + ds_monto(r), 0);
    const balance  = totalIng - totalRet;

    const elIng  = document.getElementById('ds-anual-ingresos');
    const elRet  = document.getElementById('ds-anual-retiros');
    const elBal  = document.getElementById('ds-anual-balance');
    const elCard = document.getElementById('ds-anual-bal-card');
    if (elIng)  elIng.textContent  = formatearMoneda(totalIng);
    if (elRet)  elRet.textContent  = formatearMoneda(totalRet);
    if (elBal)  elBal.textContent  = formatearMoneda(balance);
    if (elCard) {
        elCard.style.background     = balance >= 0 ? '#dcfce7' : '#fee2e2';
        elCard.style.borderTopColor = balance >= 0 ? '#059669' : '#ef4444';
        if (elBal) elBal.style.color = balance >= 0 ? '#059669' : '#ef4444';
    }

    ds_render_desglose_mensual(año, anuales);
    const des = document.getElementById('ds-desglose-mensual');
    const arrow = document.getElementById('ds-desglose-arrow');
    if (des && window.innerWidth >= 900 && des.dataset.initialized !== '1') {
        des.style.display = 'none';
        if (arrow) arrow.textContent = '▶';
        des.dataset.initialized = '1';
    }
}

function ds_render_desglose_mensual(año, datos) {
    const el = document.getElementById('ds-desglose-mensual');
    if (!el) return;

    const porPeriodo = {};
    datos.forEach(r => {
        if (!r.fecha) return;
        const ps = ds_periodoDesFecha(r.fecha);
        if (!porPeriodo[ps]) porPeriodo[ps] = { ing: 0, ret: 0, registros: [] };
        const mto = ds_monto(r);
        if (r.tipo === 'Ingreso') porPeriodo[ps].ing += mto;
        else porPeriodo[ps].ret += mto;
        porPeriodo[ps].registros.push(r);
    });

    const periodos = Object.keys(porPeriodo).sort((a, b) => b.localeCompare(a));

    if (periodos.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:14px;color:#94a3b8;font-size:0.8em;">Sin movimientos en ${año}</div>`;
        return;
    }

    el.innerHTML = periodos.map(ps => {
        const { ing, ret, registros } = porPeriodo[ps];
        const bal = ing - ret;
        const balColor = bal >= 0 ? '#059669' : '#ef4444';
        const label = ds_periodoDisplay(ps);

        const regsOrdenados = [...registros].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

        const filaRegistros = regsOrdenados.map(r => {
            const esIng = r.tipo === 'Ingreso';
            const color  = esIng ? '#059669' : '#dc2626';
            const icon   = esIng ? '↑' : '↓';
            const signo  = esIng ? '+' : '-';
            const partes = (r.fecha || '').split('-');
            const diaStr = partes[2] ? partes[2] + '/' + partes[1] : '';
            const desc   = r.nota || r.tipo;
            return `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-top:1px solid #d1d5db;">
                <span style="color:${color};font-weight:900;font-size:0.75em;width:12px;flex-shrink:0;">${icon}</span>
                <span style="color:#374151;font-size:0.72em;font-weight:700;min-width:34px;flex-shrink:0;">${diaStr}</span>
                <span style="flex:1;color:#111827;font-size:0.72em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${desc}">${desc}</span>
                <span style="color:${color};font-weight:700;font-size:0.72em;white-space:nowrap;">${signo}${formatearMoneda(ds_monto(r))}</span>
            </div>`;
        }).join('');

        return `<div style="background:#f8fafc;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:4px;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f1f5f9;gap:6px;flex-wrap:wrap;">
                <div style="font-size:0.68em;font-weight:900;color:#334155;white-space:nowrap;">${label}</div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <span style="font-size:0.68em;font-weight:700;color:#059669;">+${formatearMoneda(ing)}</span>
                    <span style="font-size:0.68em;font-weight:700;color:#ef4444;">-${formatearMoneda(ret)}</span>
                    <span style="font-size:0.68em;font-weight:800;color:${balColor};">${bal >= 0 ? '+' : ''}${formatearMoneda(bal)}</span>
                </div>
            </div>
            ${filaRegistros}
        </div>`;
    }).join('');
}

function ds_cambiarPeriodo(dir) {
    if (!dsPeriodoVista) dsPeriodoVista = ds_periodoActual();
    const [y, m] = dsPeriodoVista.split('-').map(Number);
    const dt = new Date(y, m - 1 + dir, 15);
    const ny = dt.getFullYear();
    const nm = dt.getMonth() + 1;
    dsPeriodoVista = `${ny}-${String(nm).padStart(2,'0')}-15`;
    ds_render();
}

// Abre el modal de nuevo registro
function ds_abrirModal(tipo = 'Ingreso') {
    const modal = document.getElementById('ds-modal');
    if (!modal) return;
    const elFecha = document.getElementById('ds-modal-fecha');
    const elMonto = document.getElementById('ds-modal-monto');
    const elNota  = document.getElementById('ds-modal-nota');
    if (elFecha) elFecha.value = new Date().toISOString().split('T')[0];
    if (elMonto) elMonto.value = '';
    if (elNota)  elNota.value  = '';
    ds_toggleTipo(tipo);
    document.getElementById('ds-modal-titulo').textContent = tipo === 'Ingreso' ? 'Nuevo Ingreso' : 'Nuevo Retiro';
    modal.style.display = 'flex';
}

function ds_toggleTipo(tipo) {
    const btnIngreso = document.getElementById('ds-btn-ingreso');
    const btnRetiro  = document.getElementById('ds-btn-retiro');
    const hiddenTipo = document.getElementById('ds-modal-tipo');
    const notaLabel  = document.getElementById('ds-nota-label');
    if (hiddenTipo) hiddenTipo.value = tipo;

    if (btnIngreso) {
        btnIngreso.style.background = tipo === 'Ingreso' ? '#10b981' : 'white';
        btnIngreso.style.color      = tipo === 'Ingreso' ? 'white'   : '#10b981';
        btnIngreso.style.border     = '2px solid #10b981';
    }
    if (btnRetiro) {
        btnRetiro.style.background = tipo === 'Retiro' ? '#ef4444' : 'white';
        btnRetiro.style.color      = tipo === 'Retiro' ? 'white'   : '#ef4444';
        btnRetiro.style.border     = '2px solid #ef4444';
    }
    if (notaLabel) {
        notaLabel.textContent = tipo === 'Ingreso'
            ? 'Descripción (ej: Sobrante de caja)'
            : 'Descripción (ej: Retiro a bóveda)';
    }
}

// Guarda un nuevo registro
async function ds_guardar() {
    const tipo  = (document.getElementById('ds-modal-tipo')  || {}).value || '';
    const fecha = (document.getElementById('ds-modal-fecha') || {}).value || '';
    const rawMonto = ((document.getElementById('ds-modal-monto') || {}).value || '').replace(/\./g,'').replace(',','.');
    const monto = Math.round(parseFloat(rawMonto) || 0);
    const nota  = (document.getElementById('ds-modal-nota')  || {}).value || '';

    if (!fecha) { showToast('Selecciona una fecha', 'error'); return; }
    if (!monto || monto <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
    if (!tipo) { showToast('Selecciona el tipo', 'error'); return; }

    const responsable = getSesionResponsable();
    const periodo = ds_periodoDesFecha(fecha);

    try {
        toggleLoader(true, 'Guardando...');
        await callApiSocios('registrarDinero', { fecha, tipo, monto, nota, responsable, periodo });
        document.getElementById('ds-modal').style.display = 'none';
        showToast('Registro guardado', 'success');
        await ds_cargar();
    } catch(e) {
        showToast('Error al guardar', 'error');
    } finally {
        toggleLoader(false);
    }
}

// Borra un registro
async function ds_borrar(uuid) {
    if (!confirm('¿Eliminar este registro?')) return;
    const responsable = getSesionResponsable();
    try {
        toggleLoader(true, 'Eliminando...');
        await callApiSocios('borrarDinero', { uuid, responsable });
        showToast('Registro eliminado', 'success');
        await ds_cargar();
    } catch(e) {
        showToast('Error al eliminar', 'error');
    } finally {
        toggleLoader(false);
    }
}
