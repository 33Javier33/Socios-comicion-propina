// ============================================================
// PUNTOS: CALENDARIO PART-TIME Y DÍAS TRABAJADOS
// ============================================================

function renderCalendarGrid() {
    ptCalFecha = new Date();
    ptCalFecha.setDate(1);
    ptCalRenderMes();
}

function ptCalCambiarMes(delta) {
    ptCalFecha.setMonth(ptCalFecha.getMonth() + delta);
    ptCalRenderMes();
}

function ptCalRenderMes() {
    const anio = ptCalFecha.getFullYear();
    const mes  = ptCalFecha.getMonth();
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('ptCalMesAnio').textContent = MESES[mes] + ' ' + anio;

    const grid = document.getElementById('ptCalGrid');
    grid.innerHTML = '';

    const primerDia = new Date(anio, mes, 1).getDay();
    const offsetLunes = (primerDia === 0) ? 6 : primerDia - 1;
    const diasEnMes  = new Date(anio, mes + 1, 0).getDate();

    for (let i = 0; i < offsetLunes; i++) {
        const empty = document.createElement('div');
        empty.className = 'pt-cal-day empty';
        grid.appendChild(empty);
    }

    for (let d = 1; d <= diasEnMes; d++) {
        const fechaISO = anio + '-' + String(mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const tieneRec = globalMapaPuntosDia[fechaISO] !== undefined;
        const estaSelec = selectedDaysPT.includes(fechaISO);

        const cell = document.createElement('div');
        cell.className = 'pt-cal-day ' + (tieneRec ? (estaSelec ? 'selected' : 'has-rec') : 'no-rec');

        let innerHtml = '<span class="cal-num">' + d + '</span>';
        if (tieneRec) {
            const val = Math.round(globalMapaPuntosDia[fechaISO]);
            innerHtml += '<span class="cal-val">$' + val.toLocaleString('es-CL') + '</span>';
        }
        cell.innerHTML = innerHtml;

        if (tieneRec) {
            cell.onclick = () => {
                if (selectedDaysPT.includes(fechaISO)) {
                    selectedDaysPT = selectedDaysPT.filter(x => x !== fechaISO);
                    cell.className = 'pt-cal-day has-rec';
                } else {
                    selectedDaysPT.push(fechaISO);
                    cell.className = 'pt-cal-day selected';
                }
                ptCalActualizarResumen();
            };
        }
        grid.appendChild(cell);
    }
    ptCalActualizarResumen();
}

function ptCalActualizarResumen() {
    const el = document.getElementById('ptCalResumen');
    if (!el) return;
    const total = selectedDaysPT.length;
    let sumaValor = 0;
    selectedDaysPT.forEach(d => { if (globalMapaPuntosDia[d]) sumaValor += globalMapaPuntosDia[d]; });
    el.textContent = total + ' día' + (total !== 1 ? 's' : '') + ' seleccionado' + (total !== 1 ? 's' : '') + ' — Valor acumulado: ' + new Intl.NumberFormat('es-CL', {style:'currency',currency:'CLP'}).format(sumaValor);
}

function toggleDaySelection(el, fecha) {
    if(selectedDaysPT.includes(fecha)) { selectedDaysPT = selectedDaysPT.filter(d => d !== fecha); }
    else { selectedDaysPT.push(fecha); }
}

async function guardarDiasTrabajados() {
    const id = document.getElementById('gestionSocioId').value;
    const nombre = document.getElementById('gestionSocioNombre').value;
    toggleLoader(true, "Guardando días...");
    try {
        await callApiSocios('guardarDiasPartTime', { id, nombre, dias: selectedDaysPT });
        globalDiasPT[id] = [...selectedDaysPT];
        showToast('Días actualizados', 'success');
        cerrarModalCalendario();
        cargarHistorialSocio(id);
    } catch(e) { showToast('Error guardando', 'error'); } finally { toggleLoader(false); }
}
