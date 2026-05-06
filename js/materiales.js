// ============================================================
// MÓDULO: RECAUDACIÓN DE MATERIALES Y GASTOS
// ============================================================

let matDatos = [];
let matPeriodoVista = null;

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

// Renderiza la vista del período actual
function mat_render() {
    if (!matPeriodoVista) matPeriodoVista = mat_periodoActual();

    // Filtrar por período
    const filtrados = matDatos.filter(r => {
        if (!r.fecha) return false;
        return mat_periodoDesFecha(r.fecha) === matPeriodoVista;
    });

    // Calcular totales
    const totalIngresos = filtrados.filter(r => r.tipo === 'Ingreso').reduce((s, r) => s + (r.monto || 0), 0);
    const totalGastos   = filtrados.filter(r => r.tipo === 'Gasto').reduce((s, r) => s + (r.monto || 0), 0);
    const balance = totalIngresos - totalGastos;

    // Actualizar tarjetas de resumen
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
            <div style="font-weight:800;color:${montoColor};font-size:0.92em;white-space:nowrap;">${montoSigno}${formatearMoneda(r.monto)}</div>
            <button onclick="mat_borrar('${r.uuid}')" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:2px 4px;color:#94a3b8;line-height:1;" title="Eliminar">🗑️</button>
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
    const monto = parseFloat((document.getElementById('mat-modal-monto') || {}).value || '0');
    const nota  = (document.getElementById('mat-modal-nota')  || {}).value || '';

    if (!fecha) { showToast('Selecciona una fecha', 'error'); return; }
    if (!monto || monto <= 0) { showToast('Ingresa un monto válido', 'error'); return; }
    if (!tipo) { showToast('Selecciona el tipo', 'error'); return; }

    const sesionRaw = localStorage.getItem('fs_sesion_responsable');
    let responsable = '';
    try {
        const obj = JSON.parse(sesionRaw);
        responsable = (obj.ini || '') + '|' + (obj.area || '');
    } catch(e) { responsable = sesionRaw || ''; }

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

    const sesionRaw = localStorage.getItem('fs_sesion_responsable');
    let responsable = '';
    try {
        const obj = JSON.parse(sesionRaw);
        responsable = (obj.ini || '') + '|' + (obj.area || '');
    } catch(e) { responsable = sesionRaw || ''; }

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
