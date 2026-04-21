// ============================================================
// SOCIOS: RENDERIZADO, EDICIÓN, ESCALAMIENTOS Y PENDIENTES
// ============================================================

function renderizarCards() {
    const container = document.getElementById('mainSociosContainer');
    container.innerHTML = '';
    // ── Regla 2: solo contar socios visibles (fecha_inicio_puntos <= hoy) ──
    const sociosVisibles   = cacheSocios.filter(s => s.visible !== false);
    const sociosPendientes = cacheSocios.filter(s => s.visible === false);
    // Los paneles del dashboard solo reflejan socios visibles
    let totalSocios  = sociosVisibles.length;
    const sociosActivos = sociosVisibles.filter(s => s.puntosActivos !== false);
    let totalPuntos  = sociosActivos.reduce((a,b) => a + b.puntos, 0);
    let totalPlanta  = sociosActivos.filter(s => s.contrato === 'Planta').length;
    let totalPart    = sociosActivos.filter(s => s.contrato === 'Part-Time').length;
    let puntosPlanta = sociosActivos.filter(s => s.contrato === 'Planta').reduce((a,b) => a + b.puntos, 0);
    document.getElementById('totalSociosDash').innerText = totalSocios;
    document.getElementById('totalPuntosDash').innerText = totalPuntos;
    document.getElementById('totalPlantaDash').innerText = totalPlanta;
    document.getElementById('totalPartTimeDash').innerText = totalPart;
    document.getElementById('totalPuntosPlantaDash').innerText = puntosPlanta;

    if(cacheSocios.length === 0) { container.innerHTML = Array(4).fill(`
        <div class='sk-card'>
            <div class='sk-row'><div class='sk sk-circle' style='width:40px;height:40px'></div><div style='flex:1'><div class='sk sk-line' style='width:60%;margin-bottom:8px'></div><div class='sk sk-line' style='width:35%'></div></div></div>
            <div class='sk sk-line' style='width:80%;margin-bottom:6px'></div><div class='sk sk-line' style='width:50%'></div>
        </div>`).join(''); return; }

    const grupos = { 'mesas': [], 'mesasPartTime': [], 'cambistas': [], 'maquinas': [], 'tecnicos': [], 'boveda': [], 'GastosComision': [] };
    const nombresArea = { 'mesas': 'Mesas (Planta)', 'mesasPartTime': 'Mesas (Part-Time)', 'cambistas': 'Mesas (Cambistas)', 'maquinas': 'Máquinas', 'tecnicos': 'Técnicos', 'boveda': 'Bóveda', 'GastosComision': 'Gastos Comisión' };

    // Solo renderizar socios visibles en las tarjetas de área
    sociosVisibles.forEach(socio => {
        let key = socio.area.toLowerCase().replace(/\s/g, '');
        if (key.includes('cambista')) key = 'cambistas'; else if (key.includes('gastos')) key = 'GastosComision';
        if (key === 'mesas') { if (socio.contrato === 'Part-Time') key = 'mesasPartTime'; else key = 'mesas'; }
        if (grupos[key]) grupos[key].push(socio); else { if(!grupos['otros']) grupos['otros'] = []; grupos['otros'].push(socio); nombresArea['otros'] = 'Otros / Sin Clasificar'; }
    });
    // Actualizar panel y stat de socios pendientes
    pendientes_actualizar(sociosPendientes);

    for (const [key, listaSocios] of Object.entries(grupos)) {
        if (!listaSocios || listaSocios.length === 0) continue;
        listaSocios.sort((a,b) => a.nombre.localeCompare(b.nombre));
        const totalPuntosArea = listaSocios.reduce((acc, s) => acc + s.puntos, 0);
        const section = document.createElement('div');
        section.className = 'area-section';
        section.setAttribute('data-area-id', key);
        const header = document.createElement('div');
        header.className = `area-header border-left-${key}`;
        header.onclick = function() { toggleArea(key); };
        header.innerHTML = `<div class="area-info"><span class="arrow-icon" id="icon-${key}">▼</span><div class="area-title">${nombresArea[key] || key.toUpperCase()}</div></div><div class="area-details"><span class="area-badge">${listaSocios.length} Soc.</span><span class="area-points">Pts: ${totalPuntosArea}</span></div>`;
        section.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'cards-container';
        grid.id = `container-${key}`;
        listaSocios.forEach(socio => {
            const card = document.createElement('div');
            card.className = `socio-card border-${key}`;
            card.setAttribute('data-search-name', `${socio.nombre} ${socio.apellido} ${socio.area}`.toLowerCase());
            const f = socio.fechaIngreso.split('-');
            const fechaVis = `${f[2]}/${f[1]}/${f[0]}`;
            let fipVis = '';
            if (socio.fechaInicioPuntos && socio.fechaInicioPuntos !== socio.fechaIngreso) {
                const fipLabel = socio.fechaInicioPuntos.split('-').reverse().join('/');
                if (socio.puntosActivos === false) {
                    fipVis = `<small style="display:block;margin-top:3px;background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:4px;padding:2px 6px;font-size:0.72em;font-weight:700;">⏳ Puntos inician: ${fipLabel}</small>`;
                } else {
                    fipVis = `<small style="color:#e67e22;font-size:0.75em;">⏱ Puntos desde: ${fipLabel}</small>`;
                }
            }
            card.innerHTML = `
                <div class="area-tag bg-${key}">${nombresArea[key] || socio.area}</div>
                <div class="card-header"><h3>${socio.nombre} ${socio.apellido}</h3><span class="card-contract">${socio.contrato}</span></div>
                <div class="card-body"><div><p style="margin:0; font-size:0.9em;">Antigüedad: ${socio.anios} años</p><small style="color:#7f8c8d;">${fechaVis}</small>${fipVis}</div><div class="points-badge"><span class="points-number">${socio.puntos}</span></div></div>
                <div class="card-actions">
                    <button class="btn-card btn-edit" onclick="prepararEdicion('${socio.id}')">Editar</button>
                    <button class="btn-card btn-info" onclick="verEstadoFinanciero('${socio.id}')">📊 Estado</button>
                    <button class="btn-card btn-delete" onclick="eliminarSocio('${socio.id}')">Eliminar</button>
                </div>
            `;
            grid.appendChild(card);
        });
        section.appendChild(grid);
        container.appendChild(section);
    }
}

function toggleArea(key) {
    const container = document.getElementById(`container-${key}`);
    const icon = document.getElementById(`icon-${key}`);
    const header = icon.closest('.area-header');
    if (container.style.display === 'grid') { container.style.display = 'none'; header.classList.remove('active'); icon.style.transform = 'rotate(0deg)'; }
    else { container.style.display = 'grid'; header.classList.add('active'); icon.style.transform = 'rotate(180deg)'; }
}

function filtrarSociosRegistro() {
    const termino = document.getElementById('filtroRegistro').value.toLowerCase();
    const areas = document.querySelectorAll('.area-section');
    areas.forEach(area => {
        const containerId = area.querySelector('.cards-container').id;
        const container = document.getElementById(containerId);
        const cards = container.querySelectorAll('.socio-card');
        let foundInArea = false;
        cards.forEach(card => {
            const text = card.getAttribute('data-search-name');
            if(text.includes(termino)) { card.style.display = 'flex'; foundInArea = true; } else { card.style.display = 'none'; }
        });
        if (termino.length > 0) {
            if (foundInArea) { area.style.display = 'block'; container.style.display = 'grid'; area.querySelector('.arrow-icon').style.transform = 'rotate(180deg)'; } else { area.style.display = 'none'; }
        } else { area.style.display = 'block'; container.style.display = 'none'; cards.forEach(c => c.style.display = 'flex'); area.querySelector('.arrow-icon').style.transform = 'rotate(0deg)'; }
    });
}

function prepararEdicion(id) {
    const socio = cacheSocios.find(s => s.id === id);
    if(socio) {
        isEditing = true;
        document.getElementById('editId').value = socio.id;
        document.getElementById('nombre').value = socio.nombre;
        document.getElementById('apellido').value = socio.apellido;
        document.getElementById('fechaIngreso').value = socio.fechaIngreso;
        const fip = socio.fechaInicioPuntos || '';
        document.getElementById('fechaInicioPuntos').value = (fip !== socio.fechaIngreso) ? fip : '';
        let areaVal = socio.area;
        if(areaVal === 'GastosComision' || areaVal.includes('gastos')) areaVal = 'GastosComision';
        document.getElementById('area').value = areaVal;
        document.getElementById('contrato').value = socio.contrato;
        document.getElementById('modalTitle').innerText = 'Editar Socio';
        document.getElementById('btnSubmit').innerText = 'Actualizar Datos';
        abrirModalRegistro();
    }
}

async function eliminarSocio(id) {
    if(!confirm('¿Eliminar socio?')) return;
    toggleLoader(true, "Eliminando...");
    try { await callApiSocios('deleteSocio', { socioId: id }); showToast('Eliminado', 'error'); fetchSociosDeGoogle(); }
    catch(e) { showToast('Error', 'error'); toggleLoader(false); }
}

async function subirPuntosSocio(id, nombre, puntosNuevos) {
    const periodoKey = calcularPeriodoClave();
    if (!localStorage.getItem('fondo_cierre_todos_' + periodoKey)) {
        alert('⚠️ Debes ejecutar "Cerrar Mes TODOS" en Anticipos y Ausencias antes de aplicar escalamientos.\n\nEso garantiza que los anticipos y ausencias del período ya están cerrados.');
        return;
    }
    if (!confirm(`Subir puntos de ${nombre} a ${puntosNuevos}?`)) return;
    toggleLoader(true, 'Actualizando puntos...');
    try {
        await callApiSocios('updateSocio', { socioId: id, updates: { Puntos: puntosNuevos } });
        showToast(`✅ ${nombre}: ${puntosNuevos} pts aplicados`, 'success');
        try { localStorage.removeItem(CACHE_KEY_SOCIOS); } catch(e) {}
        await actualizarSociosSilencioso();
    } catch(e) {
        showToast('Error al actualizar puntos', 'error');
    } finally {
        toggleLoader(false);
    }
}

function calcularPuntosMaximos(area) {
    const a = (area || '').toLowerCase();
    if (a.includes('gastos')) return 1;
    if (a === 'mesas' || a === 'mesasparttime') return 20;
    if (a === 'maquinas') return 12;
    if (a === 'tecnicos') return 12;
    if (a === 'boveda') return 10;
    if (a.includes('cambista')) return 8;
    return 10;
}

function calcularPuntosPorAnios(anios, area) {
    const max = calcularPuntosMaximos(area);
    if ((area || '').toLowerCase().includes('gastos')) return 1;
    const calculado = 4 + (anios * 2);
    return Math.min(calculado, max);
}

function verificarEscalamientos() {
    if (!cacheSocios.length) return;

    const hoy       = new Date();
    const mesActual = hoy.getMonth();
    const anioActual = hoy.getFullYear();
    const diaActual  = hoy.getDate();

    const mesPasado  = mesActual === 0 ? 11 : mesActual - 1;
    const anioPasado = mesActual === 0 ? anioActual - 1 : anioActual;

    const subieronMesPasado     = [];
    const subieronReciente      = [];
    const subenEsteMes          = [];
    const subenProximoPeriodo   = [];
    const ingresaronEstePeriodo = [];

    let periodoInicio, periodoFin;
    if (diaActual >= 15) {
        periodoInicio = new Date(anioActual, mesActual, 15);
        periodoFin    = new Date(anioActual, mesActual + 1, 14);
    } else {
        periodoInicio = new Date(anioActual, mesActual - 1, 15);
        periodoFin    = new Date(anioActual, mesActual, 14);
    }
    const periodoInicioISO = periodoInicio.toISOString().split('T')[0];
    const periodoFinISO    = periodoFin.toISOString().split('T')[0];

    const proxPeriodoInicio = new Date(periodoFin.getFullYear(), periodoFin.getMonth(), 15);
    const proxPeriodoFin    = new Date(periodoFin.getFullYear(), periodoFin.getMonth() + 1, 14);
    const proxMes  = proxPeriodoInicio.getMonth();
    const proxAnio = proxPeriodoInicio.getFullYear();

    cacheSocios.forEach(socio => {
        if (!socio.fechaIngreso) return;
        const areaNorm = (socio.area || '').toLowerCase();
        if (areaNorm.includes('gastos')) return;

        const fechaBase = (socio.fechaInicioPuntos && socio.fechaInicioPuntos !== socio.fechaIngreso)
            ? socio.fechaInicioPuntos : socio.fechaIngreso;
        const partes     = fechaBase.split('-');
        const anioIngreso = parseInt(partes[0]);
        const mesIngreso  = parseInt(partes[1]) - 1;
        const diaIngreso  = parseInt(partes[2]);

        const max = calcularPuntosMaximos(socio.area);
        if (socio.puntos >= max) return;

        if (mesIngreso === mesPasado) {
            const aniosCumplidos  = anioPasado - anioIngreso;
            if (aniosCumplidos >= 1) {
                const puntosAntes   = calcularPuntosPorAnios(aniosCumplidos - 1, socio.area);
                const puntosDespues = calcularPuntosPorAnios(aniosCumplidos, socio.area);
                if (puntosDespues > puntosAntes) {
                    if (socio.puntos >= puntosDespues) {
                        // Ya tiene el escalamiento aplicado — no mostrar en ninguna lista
                    } else {
                        subieronMesPasado.push({ ...socio, puntosNuevos: puntosDespues, puntosAntes, aniosCumplidos });
                    }
                }
            }
        }

        if (mesIngreso === mesActual) {
            const aniosCumpleEsteMes = anioActual - anioIngreso;
            if (aniosCumpleEsteMes >= 1) {
                const puntosAntes   = calcularPuntosPorAnios(aniosCumpleEsteMes - 1, socio.area);
                const puntosDespues = calcularPuntosPorAnios(aniosCumpleEsteMes, socio.area);
                if (puntosDespues > puntosAntes) {
                    const yaOcurrio = diaActual >= diaIngreso;
                    if (yaOcurrio && socio.puntos >= puntosDespues) {
                        // Ya tiene el escalamiento aplicado — no mostrar en ninguna lista
                    } else {
                        subenEsteMes.push({ ...socio, puntosNuevos: puntosDespues, puntosAntes, diaIngreso, aniosCumpleEsteMes, yaOcurrio });
                    }
                }
            }
        }
        const fechaIngNorm = socio.fechaIngreso || '';
        if (fechaIngNorm >= periodoInicioISO && fechaIngNorm <= periodoFinISO) {
            ingresaronEstePeriodo.push({ ...socio });
        }

        if (mesIngreso === proxMes) {
            const aniosCumpleProx = proxAnio - anioIngreso;
            if (aniosCumpleProx >= 1) {
                const puntosAntes   = calcularPuntosPorAnios(aniosCumpleProx - 1, socio.area);
                const puntosDespues = calcularPuntosPorAnios(aniosCumpleProx, socio.area);
                if (puntosDespues > puntosAntes) {
                    subenProximoPeriodo.push({ ...socio, puntosNuevos: puntosDespues, puntosAntes, diaIngreso, aniosCumpleProx });
                }
            }
        }
    });

    const panel = document.getElementById('panelEscalamientos');
    const lista  = document.getElementById('listaEscalamientos');

    if (!subieronMesPasado.length && !subieronReciente.length && !subenEsteMes.length && !subenProximoPeriodo.length && !ingresaronEstePeriodo.length) {
        panel.style.display = 'none';
        const contEl = document.getElementById('contadorEscalamientos');
        if(contEl) contEl.innerText = '🏆';
        return;
    }

    panel.style.display = 'block';
    const totalAvisos = subieronMesPasado.length + subieronReciente.length + subenEsteMes.length + subenProximoPeriodo.length + ingresaronEstePeriodo.length;
    const contEl = document.getElementById('contadorEscalamientos');
    if(contEl) contEl.innerText = totalAvisos;
    let html = '';

    const renderGrupo = (titulo, color, icono, socios) => {
        if (!socios.length) return '';
        let bloque = `<div style="margin-bottom:12px;">
            <div style="font-size:0.78em;font-weight:800;text-transform:uppercase;color:${color};letter-spacing:0.5px;margin-bottom:8px;">${icono} ${titulo}</div>`;
        socios.forEach(s => {
            const areaNombre  = s.area.charAt(0).toUpperCase() + s.area.slice(1);
            const subLabel    = s.diaIngreso ? ` — día ${s.diaIngreso}${s.yaOcurrio ? ' ✓' : ' (próximo)'}` : '';
            const diff = s.puntosNuevos - s.puntosAntes;
            const colorBtn = s.yaOcurrio === false ? '#aaa' : color;
            bloque += `
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;
                background:white;border-radius:8px;padding:10px 13px;margin-bottom:6px;
                border-left:4px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,0.07);">
                <div>
                    <span style="font-weight:700;font-size:0.95em;">${s.nombre} ${s.apellido}</span>
                    <span style="font-size:0.75em;color:#7f8c8d;margin-left:6px;">${areaNombre}${subLabel}</span>
                    <div style="font-size:0.8em;color:#7f8c8d;margin-top:3px;">
                        <span style="color:#7f8c8d;">${s.puntosAntes} pts</span>
                        → <strong style="color:${color};">${s.puntosNuevos} pts</strong>
                        <span style="background:#e8f8ee;color:#27ae60;font-weight:800;padding:1px 6px;border-radius:4px;margin-left:4px;">+${diff}</span>
                    </div>
                </div>
                <button onclick="subirPuntosSocio('${s.id}','${s.nombre} ${s.apellido}',${s.puntosNuevos})"
                    style="background:${colorBtn};color:white;border:none;border-radius:7px;
                    padding:7px 13px;font-size:0.8em;font-weight:800;cursor:pointer;white-space:nowrap;">
                    ⬆️ Aplicar +${diff} pts
                </button>
            </div>`;
        });
        bloque += '</div>';
        return bloque;
    };

    html += renderGrupo('Subieron el mes pasado — aplicar si aún no se hizo', '#e67e22', '⚠️', subieronMesPasado);
    html += renderGrupo('Suben este mes', '#27ae60', '📅', subenEsteMes);

    if (subieronReciente.length) {
        html += '<div style="margin-bottom:12px;">';
        html += '<div style="font-size:0.78em;font-weight:800;text-transform:uppercase;color:#0891b2;letter-spacing:0.5px;margin-bottom:8px;">✅ Subieron recientemente — escalamiento ya aplicado</div>';
        subieronReciente.forEach(s => {
            const areaNom = s.area.charAt(0).toUpperCase() + s.area.slice(1);
            const diff    = s.puntosNuevos - s.puntosAntes;
            html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;'
                  + 'background:white;border-radius:8px;padding:10px 13px;margin-bottom:6px;'
                  + 'border-left:4px solid #0891b2;box-shadow:0 1px 4px rgba(0,0,0,0.07);opacity:0.85;">';
            html += '<div>'
                  + '<span style="font-weight:700;font-size:0.95em;">' + s.nombre + ' ' + s.apellido + '</span>'
                  + '<span style="font-size:0.75em;color:#7f8c8d;margin-left:6px;">' + areaNom + '</span>'
                  + '<div style="font-size:0.8em;color:#7f8c8d;margin-top:3px;">'
                  + '<span style="color:#7f8c8d;">' + s.puntosAntes + ' pts</span>'
                  + ' &rarr; <strong style="color:#0891b2;">' + s.puntosNuevos + ' pts</strong>'
                  + '<span style="background:#e0f2fe;color:#0891b2;font-weight:800;padding:1px 6px;border-radius:4px;margin-left:4px;">+' + diff + '</span>'
                  + '</div></div>'
                  + '<span style="background:#e0f2fe;color:#0891b2;font-size:0.75em;font-weight:800;padding:5px 11px;border-radius:7px;">Aplicado ✓</span>'
                  + '</div>';
        });
        html += '</div>';
    }

    if (subenProximoPeriodo.length) {
        const pxIniVis = proxPeriodoInicio.toLocaleDateString('es-CL', {day:'2-digit',month:'2-digit'});
        const pxFinVis = proxPeriodoFin.toLocaleDateString('es-CL', {day:'2-digit',month:'2-digit'});
        html += '<div style="margin-bottom:12px;">';
        html += '<div style="font-size:0.78em;font-weight:800;text-transform:uppercase;color:#7c3aed;letter-spacing:0.5px;margin-bottom:8px;">'
              + '🔮 Suben el próximo período (' + pxIniVis + ' → ' + pxFinVis + ')</div>';
        subenProximoPeriodo.forEach(s => {
            const areaNom = s.area.charAt(0).toUpperCase() + s.area.slice(1);
            const diff    = s.puntosNuevos - s.puntosAntes;
            html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;'
                  + 'background:white;border-radius:8px;padding:10px 13px;margin-bottom:6px;'
                  + 'border-left:4px solid #7c3aed;box-shadow:0 1px 4px rgba(0,0,0,0.07);opacity:0.9;">';
            html += '<div>'
                  + '<span style="font-weight:700;font-size:0.95em;">' + s.nombre + ' ' + s.apellido + '</span>'
                  + '<span style="font-size:0.75em;color:#7f8c8d;margin-left:6px;">' + areaNom + ' — día ' + s.diaIngreso + '</span>'
                  + '<div style="font-size:0.8em;color:#7f8c8d;margin-top:3px;">'
                  + '<span style="color:#7f8c8d;">' + s.puntosAntes + ' pts</span>'
                  + ' &rarr; <strong style="color:#7c3aed;">' + s.puntosNuevos + ' pts</strong>'
                  + '<span style="background:#ede9fe;color:#7c3aed;font-weight:800;padding:1px 6px;border-radius:4px;margin-left:4px;">+' + diff + '</span>'
                  + '</div></div>'
                  + '<span style="background:#ede9fe;color:#7c3aed;font-size:0.75em;font-weight:800;padding:5px 11px;border-radius:7px;">Próximo período</span>'
                  + '</div>';
        });
        html += '</div>';
    }

    if (ingresaronEstePeriodo.length) {
        const pIniVis = periodoInicioISO.split('-').reverse().join('/');
        const pFinVis = periodoFinISO.split('-').reverse().join('/');
        html += '<div style="margin-bottom:12px;">';
        html += '<div style="font-size:0.78em;font-weight:800;text-transform:uppercase;color:#2563eb;letter-spacing:0.5px;margin-bottom:8px;">🆕 Ingresaron este período (' + pIniVis + ' → ' + pFinVis + ')</div>';
        ingresaronEstePeriodo.forEach(s => {
            const areaNom = s.area.charAt(0).toUpperCase() + s.area.slice(1);
            const fIngVis = s.fechaIngreso.split('-').reverse().join('/');
            const fIniPts = (s.fechaInicioPuntos && s.fechaInicioPuntos !== s.fechaIngreso)
                ? ' <span style="color:#e67e22;">(pts desde: ' + s.fechaInicioPuntos.split('-').reverse().join('/') + ')</span>' : '';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;background:white;border-radius:8px;padding:10px 13px;margin-bottom:6px;border-left:4px solid #2563eb;box-shadow:0 1px 4px rgba(0,0,0,0.07);">';
            html += '<div>';
            html += '<span style="font-weight:700;font-size:0.95em;">' + s.nombre + ' ' + s.apellido + '</span>';
            html += '<span style="font-size:0.75em;color:#7f8c8d;margin-left:6px;">' + areaNom + ' • ' + s.contrato + '</span>';
            html += '<div style="font-size:0.8em;color:#7f8c8d;margin-top:3px;">Ingreso: ' + fIngVis + fIniPts + ' — <strong>' + s.puntos + ' pts</strong></div>';
            html += '</div>';
            html += '<span style="background:rgba(59,130,246,0.15);color:#60a5fa;font-size:0.75em;font-weight:800;padding:4px 10px;border-radius:6px;">NUEVO</span>';
            html += '</div>';
        });
        html += '</div>';
    }

    lista.innerHTML = html;
}

function notificarEscalamientosMes() {
    const hoy = new Date();
    const mes = hoy.getMonth(), anio = hoy.getFullYear();
    const escMes = cacheSocios.filter(s => {
        if (!s.fechaIngreso) return false;
        const p = s.fechaIngreso.split('-');
        if (p.length < 3) return false;
        const mSoc = parseInt(p[1]) - 1, aSoc = parseInt(p[0]);
        const nuevoPts = 4 + (anio - aSoc) * 2;
        return mSoc === mes && nuevoPts <= calcularPuntosMaximos(s.area) && nuevoPts > (s.puntos || 0);
    });
    if (escMes.length > 0) {
        const yaNotif = localStorage.getItem('fondo_escal_notif_' + anio + '_' + mes);
        if (!yaNotif) {
            showToast('🏆 ' + escMes.length + ' socio(s) suben puntos este mes', 'success');
            localStorage.setItem('fondo_escal_notif_' + anio + '_' + mes, '1');
        }
    }
}

function pendientes_actualizar(listaPend) {
    const stat = document.getElementById('statPendientes');
    const contador = document.getElementById('contadorPendientes');
    if (!listaPend || listaPend.length === 0) {
        if (stat) stat.style.display = 'none';
        document.getElementById('panelPendientes').style.display = 'none';
        return;
    }
    if (stat) { stat.style.display = ''; contador.textContent = listaPend.length; }
    // Renderizar tarjetas en el panel
    const lista = document.getElementById('listaPendientes');
    lista.innerHTML = listaPend.map(s => {
        const hoy = new Date();
        const partes = (s.fechaInicioPuntos || '').split('-');
        const fechaActivacion = partes.length === 3
            ? new Date(parseInt(partes[0]), parseInt(partes[1])-1, 15) : null;
        const diasRestantes = fechaActivacion
            ? Math.ceil((fechaActivacion - hoy) / (1000*60*60*24)) : '?';
        const fechaVis = partes.length === 3
            ? '15/' + partes[1].padStart(2,'0') + '/' + partes[0] : '?';
        return '<div style="background:white;border-radius:10px;padding:10px 14px;margin-bottom:8px;border:1px solid #fed7aa;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">'
            + '<div>'
            + '<div style="font-weight:800;font-size:0.9em;color:#1e293b;">' + s.nombre + ' ' + s.apellido + '</div>'
            + '<div style="font-size:0.75em;color:#7f8c8d;margin-top:2px;">'
            + (s.contrato||'') + ' · ' + (s.area||'')
            + '</div>'
            + '<div style="font-size:0.75em;color:#ea580c;font-weight:700;margin-top:3px;">'
            + '📅 Activa el: ' + fechaVis
            + (typeof diasRestantes === 'number' ? ' <span style="background:#ffedd5;padding:1px 6px;border-radius:8px;">en ' + diasRestantes + ' días</span>' : '')
            + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:6px;">'
            + '<button onclick="pendientes_editar(\'' + s.id + '\')" style="background:#e0f2fe;border:1px solid #7dd3fc;color:#0369a1;border-radius:7px;padding:6px 10px;font-size:0.8em;font-weight:700;cursor:pointer;">✏️ Editar</button>'
            + '<button onclick="pendientes_eliminar(\'' + s.id + '\',\'' + s.nombre + ' ' + s.apellido + '\')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:7px;padding:6px 10px;font-size:0.8em;font-weight:700;cursor:pointer;">🗑️ Eliminar</button>'
            + '</div>'
            + '</div>';
    }).join('');
}

function pendientes_mostrarPanel() {
    const panel = document.getElementById('panelPendientes');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') panel.scrollIntoView({ behavior: 'smooth' });
}

function pendientes_editar(id) {
    document.getElementById('panelPendientes').style.display = 'none';
    prepararEdicion(id);
}

function pendientes_eliminar(id, nombre) {
    if (!confirm('¿Eliminar a ' + nombre + '?\nEsta acción no se puede deshacer.')) return;
    toggleLoader(true, 'Eliminando...');
    callApiSocios('deleteSocio', { socioId: id })
        .then(() => { showToast('Socio eliminado', 'success'); fetchSociosDeGoogle(); })
        .catch(() => showToast('Error al eliminar', 'error'))
        .finally(() => toggleLoader(false));
}

// ── Normaliza fecha_inicio_puntos al día 15 del mes ingresado ──
function normalizarFechaInicioPuntos(fechaISO) {
    if (!fechaISO) return '';
    const partes = fechaISO.split('-'); // YYYY-MM-DD
    if (partes.length !== 3) return fechaISO;
    // Forzar día al 15, conservar año y mes
    return partes[0] + '-' + partes[1] + '-15';
}

// El evento submit se registra en app-init.js después de DOMContentLoaded

function renderizarListaBusqueda() {
    const termino = document.getElementById('buscadorGestion').value.toLowerCase();
    const lista = document.getElementById('listaResultados');
    lista.innerHTML = '';
    let filtrados = cacheSocios.filter(s => s.nombre.toLowerCase().includes(termino) || s.apellido.toLowerCase().includes(termino) || (s.area||'').toLowerCase().includes(termino));
    if (gestionFiltroActivo !== 'todos' && Object.keys(gestionSociosConMovimientos).length > 0) {
        filtrados = filtrados.filter(s => {
            const mov = gestionSociosConMovimientos[s.id];
            if (!mov) return false;
            return gestionFiltroActivo === 'anticipos' ? mov.anticipos : mov.ausencias;
        });
        const infoEl = document.getElementById('filtroGestionInfo');
        if (infoEl) infoEl.textContent = filtrados.length + ' socio' + (filtrados.length !== 1 ? 's' : '') +
            (gestionFiltroActivo === 'anticipos' ? ' con anticipos' : ' con ausencias');
    }
    if (filtrados.length === 0) {
        lista.innerHTML = '<div style="padding:14px; color:#7f8c8d; text-align:center; font-size:0.88em;">'
            + (gestionFiltroActivo !== 'todos' ? 'Ninguno tiene ' + (gestionFiltroActivo === 'anticipos' ? 'anticipos' : 'ausencias') + ' registrados.' : 'No encontrado.')
            + '</div>';
        return;
    }

    const nombresArea = { 'mesas': 'Mesas (Planta)', 'mesasparttime': 'Mesas (Part-Time)', 'cambistas': 'Mesas (Cambistas)', 'maquinas': 'Máquinas', 'tecnicos': 'Técnicos', 'boveda': 'Bóveda', 'gastoscomision': 'Gastos Comisión' };
    const coloresArea = { 'mesas': '#3498db', 'mesasparttime': '#3498db', 'cambistas': '#9b59b6', 'maquinas': '#e67e22', 'tecnicos': '#7f8c8d', 'boveda': '#27ae60', 'gastoscomision': '#607d8b' };

    const grupos = {};
    filtrados.forEach(s => {
        let key = (s.area || 'otros').toLowerCase().replace(/\s/g,'');
        if(key === 'mesas' && s.contrato === 'Part-Time') key = 'mesasparttime';
        if(!grupos[key]) grupos[key] = [];
        grupos[key].push(s);
    });

    const ordenAreas = ['mesas','mesasparttime','cambistas','maquinas','tecnicos','boveda','gastoscomision','otros'];
    const areasSorted = Object.keys(grupos).sort((a,b) => {
        const ia = ordenAreas.indexOf(a); const ib = ordenAreas.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    areasSorted.forEach(key => {
        const socios = grupos[key].sort((a,b) => a.nombre.localeCompare(b.nombre));
        const color = coloresArea[key] || '#999';
        const label = nombresArea[key] || key.toUpperCase();

        const header = document.createElement('div');
        header.style.cssText = `padding:5px 10px; font-size:0.72em; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:white; background:${color}; margin-top:6px; border-radius:4px;`;
        header.textContent = `${label} (${socios.length})`;
        lista.appendChild(header);

        socios.forEach(s => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.setAttribute('data-socio-id', s.id);
            div.style.borderLeft = `3px solid ${color}`;
            const mov = gestionSociosConMovimientos[s.id];
            const badgeAnt = mov && mov.anticipos ? '<span style="background:#fff3cd;color:#856404;font-size:0.65em;font-weight:800;padding:1px 5px;border-radius:4px;margin-left:4px;">💰 ANT</span>' : '';
            const badgeAus = mov && mov.ausencias ? '<span style="background:#fde8e8;color:#9b1c1c;font-size:0.65em;font-weight:800;padding:1px 5px;border-radius:4px;margin-left:3px;">📅 AUS</span>' : '';
            div.innerHTML = `<strong>${s.nombre} ${s.apellido}</strong> <span style="font-size:0.8em; color:#7f8c8d;">${s.puntos} pts</span>${badgeAnt}${badgeAus}`;
            div.onclick = () => seleccionarSocio(s.id);
            lista.appendChild(div);
        });
    });
}

function filtrarSociosGestion() { renderizarListaBusqueda(); }

async function setFiltroGestion(tipo) {
    gestionFiltroActivo = tipo;
    const colores = { todos: 'var(--secondary)', anticipos: 'var(--warning)', ausencias: 'var(--danger)' };
    ['todos','anticipos','ausencias'].forEach(t => {
        const btn = document.getElementById('filtroGestion' + t.charAt(0).toUpperCase() + t.slice(1));
        if (!btn) return;
        const activo = t === tipo;
        btn.style.background = activo ? colores[t] : 'white';
        btn.style.color      = activo ? 'white'    : colores[t];
    });
    if (tipo === 'todos') {
        document.getElementById('filtroGestionInfo').textContent = '';
        renderizarListaBusqueda();
        return;
    }
    if (Object.keys(gestionSociosConMovimientos).length > 0) {
        renderizarListaBusqueda();
        return;
    }
    const lista = document.getElementById('listaResultados');
    const colorActivo = colores[tipo];
    lista.innerHTML =
        '<div style="padding:12px 10px; text-align:center;">'
        + '<div style="display:inline-flex;align-items:center;gap:8px;color:'+colorActivo+';font-size:0.82em;font-weight:700;">'
        + '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div>'
        + 'Buscando socios con ' + (tipo==='anticipos'?'anticipos':'ausencias') + '...'
        + '</div></div>'
        + Array(4).fill('<div style="padding:10px 8px;border-bottom:1px solid #f0f0f0"><div class="sk sk-line" style="width:70%;height:11px;margin-bottom:6px"></div><div class="sk sk-line" style="width:40%;height:9px"></div></div>').join('');
    await cargarMovimientosGestion();
    renderizarListaBusqueda();
}

async function cargarMovimientosGestion() {
    if (gestionCargandoFiltro) return;
    gestionCargandoFiltro = true;
    const infoEl = document.getElementById('filtroGestionInfo');
    if (infoEl) infoEl.textContent = 'Consultando servidor...';
    try {
        // Una sola llamada para todos los anticipos y extras
        const allData = await fetchAllDataCached();
        const todosAnticipos = allData.anticipos || {};
        const todosExtras    = allData.extras    || {};

        gestionSociosConMovimientos = {};
        cacheSocios.forEach(s => {
            const tieneAnticipos = Array.isArray(todosAnticipos[s.id]) && todosAnticipos[s.id].length > 0;
            const tieneAusencias = Array.isArray(todosExtras[s.id]) &&
                todosExtras[s.id].some(e => e.tipo && e.tipo.toLowerCase().includes('ausencia'));
            gestionSociosConMovimientos[s.id] = { anticipos: tieneAnticipos, ausencias: tieneAusencias };
        });
        if (infoEl) infoEl.textContent = '';
    } catch(e) {
        if (infoEl) infoEl.textContent = 'Error al consultar';
    } finally {
        gestionCargandoFiltro = false;
    }
}
