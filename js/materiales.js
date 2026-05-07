// ============================================================
// MÓDULO: RECAUDACIÓN DE MATERIALES Y GASTOS
// ============================================================

let matDatos = [];
let matPeriodoVista = null;
let matAñoVista = new Date().getFullYear();

// Convierte monto a número entero (Sheets puede devolver strings)
function mat_monto(r) { return Math.round(Number(r.monto) || 0); }

// Dado un string YYYY-MM-DD, retorna el inicio del período (siempre el 15).
// Si day >= 15: YYYY-MM-15 del mismo mes. Si day < 15: el 15 del mes anterior.
function mat_periodoDesFecha(fechaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number);
    if (d >= 15) {
        return `${y}-${String(m).padStart(2,'0')}-15`;
    } else {
        const dt = new Date(y, m - 2, 15); // mes anterior
        const py = dt.getFullYear();
        const pm = dt.getMonth() + 1;
        return `${py}-${String(pm).padStart(2,'0')}-15`;
    }
}

// Calcula el período actual en base a hoy
function mat_periodoActual() {
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth() + 1;
    const d = hoy.getDate();
    return mat_periodoDesFecha(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
}

// Retorna string legible, ej: "15 May → 14 Jun 2026"
function mat_periodoDisplay(periodoStart) {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [y, m] = periodoStart.split('-').map(Number);
    const startDay = 15;
    const startMes = meses[m - 1];
    // Fin: día 14 del mes siguiente
    const fechaFin = new Date(y, m, 14); // mes (m) es ya el siguiente porque JS es 0-based
    const endDay = 14;
    const endMes = meses[fechaFin.getMonth()];
    const endYear = fechaFin.getFullYear();
    return `${startDay} ${startMes} → ${endDay} ${endMes} ${endYear}`;
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

    // Panel superior: resumen anual
    mat_render_anual();

    // Filtrar por período
    const filtrados = matDatos.filter(r => {
        if (!r.fecha) return false;
        return mat_periodoDesFecha(r.fecha) === matPeriodoVista;
    });

    // Calcular totales del período
    const totalIngresos = filtrados.filter(r => r.tipo === 'Ingreso').reduce((s, r) => s + mat_monto(r), 0);
    const totalGastos   = filtrados.filter(r => r.tipo === 'Gasto').reduce((s, r) => s + mat_monto(r), 0);
    const balance = totalIngresos - totalGastos;

    // Actualizar tarjetas del período
    const elIngresos = document.getElementById('mat-total-ingresos');
    const elGastos   = document.getElementById('mat-total-gastos');
    const elBalance  = document.getElementById('mat-balance');
    const elBalCard  = document.getElementById('mat-balance-card');
    if (elIngresos) elIngresos.textContent = formatearMoneda(totalIngresos);
    if (elGastos)   elGastos.textContent   = formatearMoneda(totalGastos);
    if (elBalance)  elBalance.textContent  = formatearMoneda(balance);
    if (elBalCard) {
        elBalCard.style.background = balance >= 0 ? '#dcfce7' : '#fee2e2';
        elBalCard.style.borderTopColor = balance >= 0 ? '#059669' : '#ef4444';
        if (elBalance) elBalance.style.color = balance >= 0 ? '#059669' : '#ef4444';
    }

    // Actualizar label del período
    const elPeriodo = document.getElementById('mat-periodo-label');
    if (elPeriodo) elPeriodo.textContent = mat_periodoDisplay(matPeriodoVista);

    // Renderizar lista (ordenada por fecha desc)
    const elLista = document.getElementById('mat-lista');
    if (!elLista) return;

    if (filtrados.length === 0) {
        elLista.innerHTML = '<div style="text-align:center;padding:40px;color:#7f8c8d;font-size:0.9em;">Sin registros en este período</div>';
        return;
    }

    const ordenados = [...filtrados].sort((a, b) => {
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return b.fecha.localeCompare(a.fecha);
    });

    elLista.innerHTML = ordenados.map(r => {
        const esIngreso = r.tipo === 'Ingreso';
        const badgeColor = esIngreso ? '#10b981' : '#ef4444';
        const badgeBg = esIngreso ? '#dcfce7' : '#fee2e2';
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

// Mueve el año de vista ±1 y re-renderiza
function mat_cambiarAño(dir) {
    matAñoVista += dir;
    mat_render();
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
}

// Renderiza el desglose mes a mes en #mat-desglose-mensual
function mat_render_desglose_mensual(año, datos) {
    const el = document.getElementById('mat-desglose-mensual');
    if (!el) return;

    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    // Agrupar por mes calendario (1-12)
    const porMes = {};
    datos.forEach(r => {
        const mes = parseInt((r.fecha || '').split('-')[1], 10);
        if (!mes) return;
        if (!porMes[mes]) porMes[mes] = { ing: 0, gas: 0 };
        if (r.tipo === 'Ingreso') porMes[mes].ing += mat_monto(r);
        else porMes[mes].gas += mat_monto(r);
    });

    const mesesConDatos = Object.keys(porMes).map(Number).sort((a, b) => b - a);

    if (mesesConDatos.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:14px;color:#94a3b8;font-size:0.8em;">Sin movimientos en ' + año + '</div>';
        return;
    }

    el.innerHTML = mesesConDatos.map(m => {
        const { ing, gas } = porMes[m];
        const bal = ing - gas;
        const balColor = bal >= 0 ? '#059669' : '#ef4444';
        return `<div style="display:grid;grid-template-columns:40px 1fr 1fr 1fr;align-items:center;gap:6px;background:#f8fafc;border-radius:8px;padding:8px 10px;">
            <div style="font-size:0.72em;font-weight:800;color:#64748b;">${meses[m-1]}</div>
            <div style="font-size:0.72em;font-weight:700;color:#059669;text-align:right;">+${formatearMoneda(ing)}</div>
            <div style="font-size:0.72em;font-weight:700;color:#ef4444;text-align:right;">-${formatearMoneda(gas)}</div>
            <div style="font-size:0.72em;font-weight:800;color:${balColor};text-align:right;">${bal >= 0 ? '+' : ''}${formatearMoneda(bal)}</div>
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

// Abre el modal de nuevo registro. tipo: 'Ingreso' o 'Gasto'
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

// Alterna el tipo de registro (Ingreso / Gasto)
function mat_toggleTipo(tipo) {
    const btnIngreso = document.getElementById('mat-btn-ingreso');
    const btnGasto   = document.getElementById('mat-btn-gasto');
    const hiddenTipo = document.getElementById('mat-modal-tipo');
    const notaLabel  = document.getElementById('mat-nota-label');
    if (hiddenTipo) hiddenTipo.value = tipo;

    if (btnIngreso) {
        if (tipo === 'Ingreso') {
            btnIngreso.style.background = '#10b981';
            btnIngreso.style.color = 'white';
            btnIngreso.style.border = '2px solid #10b981';
        } else {
            btnIngreso.style.background = 'white';
            btnIngreso.style.color = '#10b981';
            btnIngreso.style.border = '2px solid #10b981';
        }
    }
    if (btnGasto) {
        if (tipo === 'Gasto') {
            btnGasto.style.background = '#ef4444';
            btnGasto.style.color = 'white';
            btnGasto.style.border = '2px solid #ef4444';
        } else {
            btnGasto.style.background = 'white';
            btnGasto.style.color = '#ef4444';
            btnGasto.style.border = '2px solid #ef4444';
        }
    }
    if (notaLabel) {
        if (tipo === 'Ingreso') {
            notaLabel.textContent = 'Descripción (ej: Cierre de mes)';
        } else {
            notaLabel.textContent = 'Descripción (ej: Compra de materiales)';
        }
    }
}

// Guarda un nuevo registro de material
async function mat_guardar() {
    const tipo  = (document.getElementById('mat-modal-tipo')  || {}).value || '';
    const fecha = (document.getElementById('mat-modal-fecha') || {}).value || '';
    const monto = Math.round(parseFloat((document.getElementById('mat-modal-monto') || {}).value.replace(/\./g,'').replace(',','.') || '0'));
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

// Borra un registro de material
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
