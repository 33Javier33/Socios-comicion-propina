// ============================================================
// MÓDULO: AGREGAR DÍAS A MÚLTIPLES SOCIOS PART-TIME (BATCH)
// ============================================================

let batchPTSociosSeleccionados = [];
let batchPTDiasSeleccionados = [];
let batchPTCalFecha = null;

// ============================================================
// ABRIR MODAL PARA SELECCIONAR MÚLTIPLES PART-TIME
// ============================================================
function abrirModalBatchDiasPartTime() {
    const partTimes = cacheSocios.filter(s => s.contrato === 'Part-Time');
    if (partTimes.length === 0) {
        showToast('No hay socios Part-Time registrados', 'error');
        return;
    }

    batchPTSociosSeleccionados = [];
    batchPTDiasSeleccionados = [];

    const modal = document.getElementById('modalBatchDiasPartTime');
    const listaSocios = document.getElementById('batchPT-lista-socios');

    // Generar lista de checkboxes
    let html = '<div style="margin-bottom:14px;"><strong style="font-size:0.85em;">Selecciona socios Part-Time:</strong></div>';
    html += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">';
    html += '<button onclick="batchPT_seleccionarTodos(true)" style="font-size:0.75em;padding:5px 10px;border:1px solid #2563eb;background:#2563eb;color:white;border-radius:5px;cursor:pointer;font-weight:600;">✓ Seleccionar Todos</button>';
    html += '<button onclick="batchPT_seleccionarTodos(false)" style="font-size:0.75em;padding:5px 10px;border:1px solid #e5e7eb;background:white;border-radius:5px;cursor:pointer;font-weight:600;">✕ Deseleccionar Todo</button>';
    html += '</div>';
    html += '<div style="max-height:250px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#f9fafb;">';

    partTimes.forEach((socio, idx) => {
        html += `
            <label style="display:flex;align-items:center;gap:8px;padding:8px;margin:4px 0;border-radius:6px;background:white;border:1px solid #e5e7eb;cursor:pointer;transition:0.2s;">
                <input type="checkbox" id="batchPT-chk-${socio.id}" onchange="batchPT_toggleSocio('${socio.id}')" style="width:16px;height:16px;cursor:pointer;">
                <span style="font-size:0.88em;flex:1;"><strong>${socio.nombre} ${socio.apellido}</strong></span>
                <span style="font-size:0.7em;color:#7f8c8d;background:#f0f1f3;padding:2px 6px;border-radius:4px;">Pts: ${socio.puntos}</span>
            </label>
        `;
    });

    html += '</div>';
    html += `<div style="margin-top:10px;padding:10px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;font-size:0.78em;color:#1e40af;">
        <strong>Seleccionados:</strong> <span id="batchPT-contador">0</span>/${partTimes.length}
    </div>`;

    listaSocios.innerHTML = html;
    modal.style.display = 'block';
}

function cerrarModalBatchDiasPartTime() {
    document.getElementById('modalBatchDiasPartTime').style.display = 'none';
    batchPTSociosSeleccionados = [];
    batchPTDiasSeleccionados = [];
}

function batchPT_toggleSocio(socioId) {
    const chk = document.getElementById(`batchPT-chk-${socioId}`);
    if (chk.checked) {
        if (!batchPTSociosSeleccionados.includes(socioId)) {
            batchPTSociosSeleccionados.push(socioId);
        }
    } else {
        batchPTSociosSeleccionados = batchPTSociosSeleccionados.filter(id => id !== socioId);
    }
    document.getElementById('batchPT-contador').textContent = batchPTSociosSeleccionados.length;
}

function batchPT_seleccionarTodos(seleccionar) {
    const partTimes = cacheSocios.filter(s => s.contrato === 'Part-Time');
    partTimes.forEach(socio => {
        const chk = document.getElementById(`batchPT-chk-${socio.id}`);
        chk.checked = seleccionar;
        batchPT_toggleSocio(socio.id);
    });
}

// ============================================================
// CONTINUAR A SELECCIONAR DÍAS DESPUÉS DE ELEGIR SOCIOS
// ============================================================
function batchPT_continuarADias() {
    if (batchPTSociosSeleccionados.length === 0) {
        showToast('Selecciona al menos un socio', 'error');
        return;
    }

    // Cerrar modal 1, abrir modal 2
    document.getElementById('modalBatchDiasPartTime').style.display = 'none';

    const modal2 = document.getElementById('modalBatchDiasPartTime-Dias');
    const titulo = document.getElementById('batchPT-dia-titulo');
    const calendario = document.getElementById('batchPT-calendario');

    titulo.textContent = `📅 Selecciona días — ${batchPTSociosSeleccionados.length} socio(s)`;

    // Renderizar calendario
    batchPTDiasSeleccionados = [];
    batchPTCalFecha = new Date();
    batchPTCalFecha.setDate(1);
    renderCalendarGridBatch();

    modal2.style.display = 'block';
}

function cerrarModalBatchDiasPartTime_Dias() {
    document.getElementById('modalBatchDiasPartTime-Dias').style.display = 'none';
}

function batchPT_cambiarMes(delta) {
    if (!batchPTCalFecha) { batchPTCalFecha = new Date(); batchPTCalFecha.setDate(1); }
    batchPTCalFecha.setMonth(batchPTCalFecha.getMonth() + delta);
    renderCalendarGridBatch();
}

// ============================================================
// RENDERIZAR CALENDARIO PARA SELECCIÓN BATCH
// ============================================================
function renderCalendarGridBatch() {
    const container = document.getElementById('batchPT-calendario');
    if (!container) return;

    if (!batchPTCalFecha) { batchPTCalFecha = new Date(); batchPTCalFecha.setDate(1); }

    const year  = batchPTCalFecha.getFullYear();
    const month = batchPTCalFecha.getMonth();
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    // Recolectar todos los días ya marcados en los socios seleccionados
    const diasExistentes = new Set();
    batchPTSociosSeleccionados.forEach(id => {
        (globalDiasPT[id] || []).forEach(d => diasExistentes.add(d));
    });

    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Cabecera con navegación
    let html = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;background:#f8fafc;padding:8px 12px;border-radius:8px;border:1px solid #e5e7eb;">
            <button onclick="batchPT_cambiarMes(-1)" style="background:none;border:1px solid #d1d5db;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:1em;font-weight:700;color:#374151;">&#8592;</button>
            <strong style="font-size:0.92em;color:#111827;">${MESES[month]} ${year}</strong>
            <button onclick="batchPT_cambiarMes(1)" style="background:none;border:1px solid #d1d5db;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:1em;font-weight:700;color:#374151;">&#8594;</button>
        </div>`;

    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:10px;">';

    ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(label => {
        html += `<div style="text-align:center;font-size:0.7em;font-weight:700;color:#7f8c8d;padding:4px;">${label}</div>`;
    });

    for (let i = 0; i < firstDay; i++) html += '<div></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const esSelec     = batchPTDiasSeleccionados.includes(fecha);
        const tieneRec    = globalMapaPuntosDia[fecha] !== undefined && globalMapaPuntosDia[fecha] !== null;
        const esExistente = diasExistentes.has(fecha);

        let bg, color, border;
        if (tieneRec) {
            if (esSelec) { bg = '#2563eb'; color = 'white'; border = '2px solid #1e40af'; }
            else         { bg = '#e0e7ff'; color = '#2563eb'; border = '1px solid #93c5fd'; }
        } else {
            bg = '#f3f4f6'; color = '#9ca3af'; border = '1px solid transparent';
        }

        const marcaBadge = esExistente
            ? `<span style="position:absolute;top:1px;right:2px;font-size:0.58em;color:${esSelec ? '#bfdbfe' : '#059669'};font-weight:900;">✓</span>`
            : '';

        const onClick = tieneRec ? `onclick="batchPT_toggleDia('${fecha}')"` : '';

        html += `
            <button ${onClick} style="
                position:relative;padding:7px 2px;border:${border};border-radius:6px;
                background:${bg};color:${color};font-weight:${esSelec ? '700' : '600'};
                font-size:0.85em;cursor:${tieneRec ? 'pointer' : 'default'};transition:0.15s;
            ">${d}${marcaBadge}</button>`;
    }

    html += '</div>';

    // Leyenda
    html += `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:0.71em;color:#374151;">
            <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background:#e0e7ff;border:1px solid #93c5fd;border-radius:3px;"></span>Con recaudación</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:12px;background:#2563eb;border-radius:3px;"></span>Seleccionado</span>
            <span style="display:flex;align-items:center;gap:4px;color:#059669;font-weight:700;">✓ Ya marcado</span>
        </div>`;

    // Resumen
    const infoExistentes = diasExistentes.size > 0
        ? ` &nbsp;·&nbsp; <span style="color:#059669;"><strong>${diasExistentes.size}</strong> día(s) ya marcados en socios seleccionados</span>`
        : '';
    html += `
        <div style="padding:10px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;font-size:0.78em;color:#166534;margin-bottom:12px;">
            <strong>Días a agregar:</strong> <span id="batchPT-contador-dias">${batchPTDiasSeleccionados.length}</span>${infoExistentes}
        </div>`;

    container.innerHTML = html;
}

function batchPT_toggleDia(fecha) {
    if (batchPTDiasSeleccionados.includes(fecha)) {
        batchPTDiasSeleccionados = batchPTDiasSeleccionados.filter(f => f !== fecha);
    } else {
        batchPTDiasSeleccionados.push(fecha);
    }
    renderCalendarGridBatch();
}

// ============================================================
// GUARDAR BATCH DE DÍAS A MÚLTIPLES SOCIOS
// ============================================================
async function batchPT_guardarDias() {
    if (batchPTSociosSeleccionados.length === 0) {
        showToast('Selecciona socios', 'error');
        return;
    }
    if (batchPTDiasSeleccionados.length === 0) {
        showToast('Selecciona días', 'error');
        return;
    }

    // Confirmación
    const msg = `Agregar ${batchPTDiasSeleccionados.length} día(s) a ${batchPTSociosSeleccionados.length} socio(s)?`;
    if (!confirm(msg)) return;

    const idActivo = document.getElementById('gestionSocioId')?.value;
    const sociosGuardados = [...batchPTSociosSeleccionados];
    const diasGuardados = [...batchPTDiasSeleccionados];

    toggleLoader(true, 'Guardando días...');
    document.getElementById('modalBatchDiasPartTime-Dias').style.display = 'none';

    try {
        const infoDispositivo = obtenerInfoDispositivo();
        const usuarioActual = document.getElementById('sesionRespNombre')?.textContent || 'Sistema';

        const payload = {
            socios: sociosGuardados.map(id => ({
                id: id,
                nombre: cacheSocios.find(s => s.id === id)?.nombre || ''
            })),
            dias: diasGuardados,
            usuario: usuarioActual,
            geoLat: infoDispositivo.geoLat,
            geoLng: infoDispositivo.geoLng,
            deviceID: infoDispositivo.deviceID,
            userAgent: infoDispositivo.userAgent
        };

        const res = await callApiSocios('guardarBatchDiasPartTime', payload);

        if (res.status === 'success') {
            showToast(`✅ ${res.message}`, 'success');
            sociosGuardados.forEach(id => {
                const existentes = globalDiasPT[id] || [];
                globalDiasPT[id] = [...new Set([...existentes, ...diasGuardados])].sort();
            });
            batchPTSociosSeleccionados = [];
            batchPTDiasSeleccionados = [];
            if (idActivo && sociosGuardados.includes(idActivo)) {
                cargarHistorialSocio(idActivo);
            }
        } else {
            showToast(res.message || 'Error al guardar', 'error');
        }
    } catch (e) {
        console.error('Error:', e);
        showToast('Error al guardar días', 'error');
    } finally {
        toggleLoader(false);
    }
}
