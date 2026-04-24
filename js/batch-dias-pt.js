// ============================================================
// MÓDULO: AGREGAR DÍAS A MÚLTIPLES SOCIOS PART-TIME (BATCH)
// ============================================================

let batchPTSociosSeleccionados = [];
let batchPTDiasSeleccionados = [];

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
    renderCalendarGridBatch();

    modal2.style.display = 'block';
}

function cerrarModalBatchDiasPartTime_Dias() {
    document.getElementById('modalBatchDiasPartTime-Dias').style.display = 'none';
}

// ============================================================
// RENDERIZAR CALENDARIO PARA SELECCIÓN BATCH
// ============================================================
function renderCalendarGridBatch() {
    const container = document.getElementById('batchPT-calendario');
    if (!container) return;

    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = hoy.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `<div style="margin-bottom:12px;"><strong>${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][month]} ${year}</strong></div>`;
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:12px;">';

    const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayLabels.forEach(label => {
        html += `<div style="text-align:center;font-size:0.7em;font-weight:700;color:#7f8c8d;padding:4px;">${label}</div>`;
    });

    // Días vacíos antes del 1
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }

    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
        const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const esSelec = batchPTDiasSeleccionados.includes(fecha);
        const tieneRecaudacion = globalMapaPuntosDia[fecha] ? true : false;

        let bg = '#f3f4f6';
        let color = '#9ca3af';
        let cursor = 'default';

        if (tieneRecaudacion) {
            bg = esSelec ? '#2563eb' : '#e0e7ff';
            color = esSelec ? 'white' : '#2563eb';
            cursor = 'pointer';
        }

        const onClick = tieneRecaudacion ? `onclick="batchPT_toggleDia('${fecha}')"` : '';

        html += `
            <button ${onClick} style="
                padding:8px;
                border:none;
                border-radius:6px;
                background:${bg};
                color:${color};
                font-weight:${esSelec ? '700' : '600'};
                font-size:0.85em;
                cursor:${cursor};
                transition:0.2s;
                border:${esSelec ? '2px solid #1e40af' : '1px solid transparent'};
            ">
                ${d}
            </button>
        `;
    }

    html += '</div>';

    // Resumen
    html += `
        <div style="padding:10px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;font-size:0.78em;color:#166534;margin-bottom:12px;">
            <strong>Días seleccionados:</strong> <span id="batchPT-contador-dias">0</span>
        </div>
    `;

    container.innerHTML = html;
    const counter = document.getElementById('batchPT-contador-dias');
    if (counter) counter.textContent = batchPTDiasSeleccionados.length;
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
