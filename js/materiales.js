// ============================================================
// MÓDULO: RECAUDACIÓN DE MATERIALES Y GASTOS
// ============================================================

let matDatos = [];
let matPeriodoVista = null;
let matAñoVista = new Date().getFullYear();

// Convierte monto a número entero (Sheets puede devolver strings)
function mat_monto(r) { return Math.round(Number(r.monto) || 0); }

// Dado un string YYYY-MM-DD, retorna el inicio del período (siempre el 15).
function mat_periodoDesFecha(fechaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number);
    if (d > 15) {
        return `${y}-${String(m).padStart(2,'0')}-15`;
    } else {
        const dt = new Date(y, m - 2, 15);
        const py = dt.getFullYear();
        const pm = dt.getMonth() + 1;
        return `${py}-${String(pm).padStart(2,'0')}-15`;
    }
}

function mat_periodoActual() {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth() + 1;
    const d = hoy.getDate();
    return mat_periodoDesFecha(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
}

function mat_periodoDisplay(periodoStart) {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [y, m] = periodoStart.split('-').map(Number);
    const startMes = meses[m - 1];
    const fechaFin = new Date(y, m, 14);
    const endMes = meses[fechaFin.getMonth()];
    const endYear = fechaFin.getFullYear();
    return `15 ${startMes} → 14 ${endMes} ${endYear}`;
}

// Carga todos los materiales desde el backend
async function mat_cargar() {
    if (!matPeriodoVista) matPeriodoVista = mat_periodoActual();
    try {
        toggleLoader(true, 'Cargando materiales...');
        const res = await callApiSocios('getAllMaterialesDesdeSheets');
        matDatos = (res && res.data) ? res.data : [];
        mat_render();
    } catch(e) {
        showToast('Error al cargar materiales', 'error');
    } finally {
        toggleLoader(false);
    }
}

// Renderiza la vista completa (anual + período)
function mat_render() {
    if (!matPeriodoVista) matPeriodoVista = mat_periodoActual();

    // ── Panel 1: resumen anual ──────────────────────────────
    mat_render_anual();

    // ── Panel 2: período actual ─────────────────────────────
    // "Fondo total" = todos los ingresos del año (el acumulado global)
    const anuales = matDatos.filter(r => r.fecha && r.fecha.startsWith(String(matAñoVista)));
    const fondoTotal   = anuales.filter(r => r.tipo === 'Ingreso').reduce((s, r) => s + mat_monto(r), 0);
    const gastosTotAño = anuales.filter(r => r.tipo === 'Gasto').reduce((s, r) => s + mat_monto(r), 0);
    const balanceGlobal = fondoTotal - gastosTotAño;

    // Gastos = solo los del período actual (15→14)
    const delPeriodo = matDatos.filter(r => {
        if (!r.fecha) return false;
        return mat_periodoDesFecha(r.fecha) === matPeriodoVista;
    });
    const gastosPeriodo = delPeriodo.filter(r => r.tipo === 'Gasto').reduce((s, r) => s + mat_monto(r), 0);

    const elFondo   = document.getElementById('mat-total-ingresos');
    const elGastos  = document.getElementById('mat-total-gastos');
    const elBalance = document.getElementById('mat-balance');
    const elBalCard = document.getElementById('mat-balance-card');
    if (elFondo)   elFondo.textContent   = formatearMoneda(fondoTotal);
    if (elGastos)  elGastos.textContent  = formatearMoneda(gastosPeriodo);
    if (elBalance) elBalance.textContent = formatearMoneda(balanceGlobal);
    if (elBalCard) {
        elBalCard.style.background     = balanceGlobal >= 0 ? '#dcfce7' : '#fee2e2';
        elBalCard.style.borderTopColor = balanceGlobal >= 0 ? '#059669' : '#ef4444';
        if (elBalance) elBalance.style.color = balanceGlobal >= 0 ? '#059669' : '#ef4444';
    }

    const elPeriodo = document.getElementById('mat-periodo-label');
    if (elPeriodo) elPeriodo.textContent = mat_periodoDisplay(matPeriodoVista);

    // Lista de movimientos del período (ordenada por fecha desc)
    const elLista = document.getElementById('mat-lista');
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
        const notaDisplay = r.nota ? `<div style="font-size:0.78em;color:#7f8c8d;margin-top:2px;">${r.nota}</div>` : '';
        return `<div style="background:white;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            <span style="background:${badgeBg};color:${badgeColor};font-size:0.65em;font-weight:800;padding:3px 7px;border-radius:5px;letter-spacing:0.04em;white-space:nowrap;">${r.tipo.toUpperCase()}</span>
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.82em;font-weight:700;color:#2c3e50;">${fechaDisplay}</div>
                ${notaDisplay}
            </div>
            <div style="font-weight:800;color:${montoColor};font-size:0.92em;white-space:nowrap;">${montoSigno}${formatearMoneda(mat_monto(r))}</div>
            <button onclick="mat_borrar('${r.uuid}')" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:2px 4px;color:#94a3b8;line-height:1;" title="Eliminar">🗑️</button>
        </div>`;
    }).join('');
}

// Mueve el año de vista ±1
function mat_cambiarAño(dir) {
    matAñoVista += dir;
    mat_render();
}

function mat_toggleDesglose() {
    const el = document.getElementById('mat-desglose-mensual');
    const arrow = document.getElementById('mat-desglose-arrow');
    if (!el) return;
    const visible = el.style.display !== 'none';
    el.style.display = visible ? 'none' : 'flex';
    if (arrow) arrow.textContent = visible ? '▶' : '▼';
}

// Renderiza el panel de resumen anual
function mat_render_anual() {
    const año = matAñoVista;
    const elAño = document.getElementById('mat-año-label');
    if (elAño) elAño.textContent = año;

    const anuales = matDatos.filter(r => r.fecha && r.fecha.startsWith(String(año)));
    const totalIng = anuales.filter(r => r.tipo === 'Ingreso').reduce((s, r) => s + mat_monto(r), 0);
    const totalGas = anuales.filter(r => r.tipo === 'Gasto').reduce((s, r) => s + mat_monto(r), 0);
    const balance  = totalIng - totalGas;

    const elIng  = document.getElementById('mat-anual-ingresos');
    const elGas  = document.getElementById('mat-anual-gastos');
    const elBal  = document.getElementById('mat-anual-balance');
    const elCard = document.getElementById('mat-anual-bal-card');
    if (elIng)  elIng.textContent  = formatearMoneda(totalIng);
    if (elGas)  elGas.textContent  = formatearMoneda(totalGas);
    if (elBal)  elBal.textContent  = formatearMoneda(balance);
    if (elCard) {
        elCard.style.background     = balance >= 0 ? '#dcfce7' : '#fee2e2';
        elCard.style.borderTopColor = balance >= 0 ? '#059669' : '#ef4444';
        if (elBal) elBal.style.color = balance >= 0 ? '#059669' : '#ef4444';
    }

    mat_render_desglose_mensual(año, anuales);
    // On desktop, keep desglose in its current open/closed state; default closed
    const des = document.getElementById('mat-desglose-mensual');
    const arrow = document.getElementById('mat-desglose-arrow');
    if (des && window.innerWidth >= 900 && des.dataset.initialized !== '1') {
        des.style.display = 'none';
        if (arrow) arrow.textContent = '▶';
        des.dataset.initialized = '1';
    }
}

// Renderiza el desglose de períodos (15→14) con cada movimiento y su descripción
function mat_render_desglose_mensual(año, datos) {
    const el = document.getElementById('mat-desglose-mensual');
    if (!el) return;

    // Agrupar por período 15→14 (clave: "YYYY-MM-15")
    const porPeriodo = {};
    datos.forEach(r => {
        if (!r.fecha) return;
        const ps = mat_periodoDesFecha(r.fecha);
        if (!porPeriodo[ps]) porPeriodo[ps] = { ing: 0, gas: 0, registros: [] };
        const mto = mat_monto(r);
        if (r.tipo === 'Ingreso') porPeriodo[ps].ing += mto;
        else porPeriodo[ps].gas += mto;
        porPeriodo[ps].registros.push(r);
    });

    const periodos = Object.keys(porPeriodo).sort((a, b) => b.localeCompare(a)); // más reciente primero

    if (periodos.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:14px;color:#94a3b8;font-size:0.8em;">Sin movimientos en ${año}</div>`;
        return;
    }

    el.innerHTML = periodos.map(ps => {
        const { ing, gas, registros } = porPeriodo[ps];
        const bal = ing - gas;
        const balColor = bal >= 0 ? '#059669' : '#ef4444';
        const label = mat_periodoDisplay(ps); // "15 Ene → 14 Feb 2026"

        // Registros del período ordenados por fecha asc
        const regsOrdenados = [...registros].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

        const filaRegistros = regsOrdenados.map(r => {
            const esIng = r.tipo === 'Ingreso';
            const color  = esIng ? '#059669' : '#dc2626';
            const icon   = esIng ? '↑' : '↓';
            const signo  = esIng ? '+' : '-';
            const partes = (r.fecha || '').split('-');
            const diaStr = partes[2] ? partes[2] + '/' + partes[1] : '';
            const desc   = r.nota || r.tipo;
            return `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-top:1px solid #f1f5f9;">
                <span style="color:${color};font-weight:900;font-size:0.75em;width:12px;flex-shrink:0;">${icon}</span>
                <span style="color:#64748b;font-size:0.7em;min-width:34px;flex-shrink:0;">${diaStr}</span>
                <span style="flex:1;color:#334155;font-size:0.72em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${desc}">${desc}</span>
                <span style="color:${color};font-weight:700;font-size:0.72em;white-space:nowrap;">${signo}${formatearMoneda(mat_monto(r))}</span>
            </div>`;
        }).join('');

        return `<div style="background:#f8fafc;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:4px;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f1f5f9;gap:6px;flex-wrap:wrap;">
                <div style="font-size:0.68em;font-weight:900;color:#334155;white-space:nowrap;">${label}</div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <span style="font-size:0.68em;font-weight:700;color:#059669;">+${formatearMoneda(ing)}</span>
                    <span style="font-size:0.68em;font-weight:700;color:#ef4444;">-${formatearMoneda(gas)}</span>
                    <span style="font-size:0.68em;font-weight:800;color:${balColor};">${bal >= 0 ? '+' : ''}${formatearMoneda(bal)}</span>
                </div>
            </div>
            ${filaRegistros}
        </div>`;
    }).join('');
}

// Mueve el período ±1 mes (siempre al día 15)
function mat_cambiarPeriodo(dir) {
    if (!matPeriodoVista) matPeriodoVista = mat_periodoActual();
    const [y, m] = matPeriodoVista.split('-').map(Number);
    const dt = new Date(y, m - 1 + dir, 15);
    const ny = dt.getFullYear();
    const nm = dt.getMonth() + 1;
    matPeriodoVista = `${ny}-${String(nm).padStart(2,'0')}-15`;
    mat_render();
}

// Abre el modal de nuevo registro
function mat_abrirModal(tipo = 'Ingreso') {
    const modal = document.getElementById('mat-modal');
    if (!modal) return;
    const elFecha = document.getElementById('mat-modal-fecha');
    const elMonto = document.getElementById('mat-modal-monto');
    const elNota  = document.getElementById('mat-modal-nota');
    if (elFecha) elFecha.value = new Date().toISOString().split('T')[0];
    if (elMonto) elMonto.value = '';
    if (elNota)  elNota.value  = '';
    mat_toggleTipo(tipo);
    document.getElementById('mat-modal-titulo').textContent = tipo === 'Ingreso' ? 'Nuevo Ingreso' : 'Nuevo Gasto';
    modal.style.display = 'flex';
}

function mat_toggleTipo(tipo) {
    const btnIngreso = document.getElementById('mat-btn-ingreso');
    const btnGasto   = document.getElementById('mat-btn-gasto');
    const hiddenTipo = document.getElementById('mat-modal-tipo');
    const notaLabel  = document.getElementById('mat-nota-label');
    if (hiddenTipo) hiddenTipo.value = tipo;

    if (btnIngreso) {
        btnIngreso.style.background = tipo === 'Ingreso' ? '#10b981' : 'white';
        btnIngreso.style.color      = tipo === 'Ingreso' ? 'white'   : '#10b981';
        btnIngreso.style.border     = '2px solid #10b981';
    }
    if (btnGasto) {
        btnGasto.style.background = tipo === 'Gasto' ? '#ef4444' : 'white';
        btnGasto.style.color      = tipo === 'Gasto' ? 'white'   : '#ef4444';
        btnGasto.style.border     = '2px solid #ef4444';
    }
    if (notaLabel) {
        notaLabel.textContent = tipo === 'Ingreso'
            ? 'Descripción (ej: Aporte mensual)'
            : 'Descripción (ej: Compra de materiales)';
    }
}

// Guarda un nuevo registro
async function mat_guardar() {
    const tipo  = (document.getElementById('mat-modal-tipo')  || {}).value || '';
    const fecha = (document.getElementById('mat-modal-fecha') || {}).value || '';
    // Elimina puntos de miles que el usuario pueda haber escrito
    const rawMonto = ((document.getElementById('mat-modal-monto') || {}).value || '').replace(/\./g,'').replace(',','.');
    const monto = Math.round(parseFloat(rawMonto) || 0);
    const nota  = (document.getElementById('mat-modal-nota')  || {}).value || '';

    if (!fecha) { showToast('Selecciona una fecha', 'error'); return; }
    if (!monto || monto <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
    if (!tipo) { showToast('Selecciona el tipo', 'error'); return; }

    const responsable = getSesionResponsable();
    const periodo = mat_periodoDesFecha(fecha);

    try {
        toggleLoader(true, 'Guardando...');
        await callApiSocios('registrarMaterial', { fecha, tipo, monto, nota, responsable, periodo });
        document.getElementById('mat-modal').style.display = 'none';
        showToast('Registro guardado', 'success');
        await mat_cargar();
    } catch(e) {
        showToast('Error al guardar', 'error');
    } finally {
        toggleLoader(false);
    }
}

// Borra un registro
async function mat_borrar(uuid) {
    if (!confirm('¿Eliminar este registro?')) return;
    const responsable = getSesionResponsable();
    try {
        toggleLoader(true, 'Eliminando...');
        await callApiSocios('borrarMaterial', { uuid, responsable });
        showToast('Registro eliminado', 'success');
        await mat_cargar();
    } catch(e) {
        showToast('Error al eliminar', 'error');
    } finally {
        toggleLoader(false);
    }
}
