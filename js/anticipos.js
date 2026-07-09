// ============================================================
// ANTICIPOS, AUSENCIAS, GESTIÓN DE SOCIOS Y CIERRE DE MES
// ============================================================

// ============================================================
// CAPTURA DE DATOS DE DISPOSITIVO PARA AUDITORÍA
// ============================================================
let globalDeviceID = '';
let globalGeoLocation = { lat: null, lng: null };

// Generar ID único del dispositivo (fingerprint)
function generarDeviceID() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText(navigator.userAgent + new Date().getTime(), 2, 2);
    return canvas.toDataURL().split(',')[1].substring(0, 32);
}

// Capturar geolocalización (solo si el usuario lo permite)
function capturarGeolocation() {
    if (navigator.geolocation && navigator.geolocation.getCurrentPosition) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                globalGeoLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log('Geolocalización capturada:', globalGeoLocation);
            },
            function(error) {
                console.log('Geolocalización no disponible:', error.message);
            }
        );
    }
}

// Inicializar captura de dispositivo
function inicializarCapturaDispositivo() {
    globalDeviceID = generarDeviceID();
    capturarGeolocation();
    console.log('Device ID:', globalDeviceID);
}

// Llamar al cargar la app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCapturaDispositivo);
} else {
    inicializarCapturaDispositivo();
}

// ============================================================
// FUNCIÓN AUXILIAR: Obtener información del dispositivo
// ============================================================
function obtenerInfoDispositivo() {
    return {
        deviceID: globalDeviceID,
        geoLat: globalGeoLocation.lat || '',
        geoLng: globalGeoLocation.lng || '',
        userAgent: navigator.userAgent || '',
        ip: '' // Se captura en servidor si es posible
    };
}

async function verEstadoFinanciero(id) {
    const socio = cacheSocios.find(s => s.id === id);
    if(!socio) return;

    document.getElementById('modalResumenFinanciero').style.display = 'block';
    document.getElementById('tituloModalResumen').innerText = `Estado: ${socio.nombre} ${socio.apellido}`;

    const loadTxt = '<small>Cargando...</small>';
    document.getElementById('resumenSaldoAnt').innerHTML = loadTxt;
    document.getElementById('resumenAlcance').innerHTML = loadTxt;
    document.getElementById('resumenPedido').innerHTML = loadTxt;
    document.getElementById('resumenFinal').innerHTML = loadTxt;
    document.getElementById('tablaResumenMovimientos').innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';

    if(socio.contrato === 'Part-Time') {
        document.getElementById('resumenDiasPT').style.display = 'block';
        document.getElementById('resumenDiasCount').innerText = '...';
    } else {
        document.getElementById('resumenDiasPT').style.display = 'none';
    }

    try {
        let res;
        const cached = cacheSocioIndividual[id];
        if (cached && (Date.now() - cached.ts < CACHE_SOCIO_TTL)) {
            res = { status: 'success', data: cached.data };
        } else {
            const response = await fetch(`${URL_SOCIOS}?action=getDatosSocio&socioId=${id}`);
            res = await response.json();
            if (res.status === 'success') {
                cacheSocioIndividual[id] = { ts: Date.now(), data: res.data };
            }
        }

        if (res.status === 'success') {
            const data = res.data || {};
            const saldoAnt = Number(data.saldoAnterior || 0);

            const fechasAusencia = new Set();
            if(data.extras) {
                data.extras.forEach(e => {
                    if(e.tipo && e.tipo.toLowerCase().includes('ausencia')) {
                        let f = e.fecha;
                        if(f.includes('T')) f = f.split('T')[0];
                        fechasAusencia.add(f);
                    }
                });
            }

            const agrupados = {};
            let sumaPedidos = 0;

            const procesarEntrada = (fechaRaw, tipo, detalle, monto) => {
                let fechaKey = fechaRaw || "";
                if(fechaKey.includes('T')) fechaKey = fechaKey.split('T')[0];
                if(!fechaKey) return;

                if(!agrupados[fechaKey]) {
                    agrupados[fechaKey] = {
                        fecha: fechaKey,
                        tipos: new Set([tipo]),
                        detalles: detalle ? [detalle] : [],
                        montoTotal: monto,
                        rawDate: new Date(fechaRaw)
                    };
                } else {
                    agrupados[fechaKey].tipos.add(tipo);
                    if(detalle && !agrupados[fechaKey].detalles.includes(detalle)) {
                        agrupados[fechaKey].detalles.push(detalle);
                    }
                    agrupados[fechaKey].montoTotal = Math.max(agrupados[fechaKey].montoTotal, monto);
                }
            };

            if(data.anticipos) data.anticipos.forEach(a => procesarEntrada(a.fecha, 'Anticipo', 'Adelanto', Number(a.cantidad || a.monto || 0)));
            if(data.extras) data.extras.forEach(e => procesarEntrada(e.fecha, (e.tipo || 'Extra'), e.detalle, 0));

            const movimientos = Object.values(agrupados);
            movimientos.forEach(m => sumaPedidos += m.montoTotal);

            let alcance = 0;
            if(socio.contrato === 'Part-Time') {
                let dias = globalDiasPT[id] || [];
                document.getElementById('resumenDiasCount').innerText = dias.length;
                let sumaValor = 0;
                dias.forEach(d => {
                    if(!fechasAusencia.has(d) && globalMapaPuntosDia[d]) {
                        sumaValor += globalMapaPuntosDia[d];
                    }
                });
                alcance = sumaValor * socio.puntos;
            } else {
                let sumaValorTotal = 0;
                for (const [dia, valor] of Object.entries(globalMapaPuntosDia)) {
                    if (!fechasAusencia.has(dia) && valor !== null) {
                        sumaValorTotal += valor;
                    }
                }
                alcance = sumaValorTotal * socio.puntos;
            }

            const saldoReal = (alcance + saldoAnt) - sumaPedidos;
            const aPagarModal = saldoReal > 0 ? Math.floor(saldoReal / 1000) * 1000 : 0;
            const remanenteModal = saldoReal > 0 ? Math.round(saldoReal - aPagarModal) : Math.round(saldoReal);

            document.getElementById('resumenSaldoAnt').innerText = formatearMoneda(saldoAnt);
            document.getElementById('resumenAlcance').innerText = formatearMoneda(alcance);
            document.getElementById('resumenPedido').innerText = formatearMoneda(sumaPedidos);
            document.getElementById('resumenFinal').innerText = formatearMoneda(aPagarModal);
            document.getElementById('resumenRemanente').innerText = formatearMoneda(remanenteModal);
            const remCard  = document.getElementById('resumenRemanenteCard');
            const remLabel = document.getElementById('resumenRemanenteLabel');
            const remValor = document.getElementById('resumenRemanenteValor');
            if (remanenteModal < 0) {
                remCard.style.cssText  = 'border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;background:#fef2f2;border:1px solid #fca5a5;';
                remLabel.style.color   = '#dc2626';
                remLabel.innerHTML     = '⚠️ Deuda para el próximo mes';
                remValor.style.color   = '#dc2626';
                remValor.innerText     = formatearMoneda(remanenteModal);
            } else if (remanenteModal === 0) {
                remCard.style.cssText  = 'border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border:1px solid #86efac;';
                remLabel.style.color   = '#16a34a';
                remLabel.innerHTML     = '✅ Sin remanente';
                remValor.style.color   = '#16a34a';
                remValor.innerText     = '$0';
            } else {
                remCard.style.cssText  = 'border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;background:#faf5ff;border:1px solid #d8b4fe;';
                remLabel.style.color   = '#7c3aed';
                remLabel.innerHTML     = '💜 Remanente al próximo mes';
                remValor.style.color   = '#7c3aed';
                remValor.innerText     = formatearMoneda(remanenteModal);
            }

            const tbody = document.getElementById('tablaResumenMovimientos');
            tbody.innerHTML = '';
            movimientos.sort((a,b) => b.rawDate - a.rawDate);

            if(movimientos.length === 0) tbody.innerHTML = '<tr><td colspan="3" style="color:#7f8c8d;">Sin movimientos</td></tr>';

            movimientos.forEach(m => {
                let f = m.fecha;
                if(f.includes('-')) { const p = f.split('-'); if(p.length===3) f = `${p[2]}/${p[1]}`; }
                const uniqueDetalles = [...new Set(m.detalles)].join(', ') || '-';
                const row = `<tr><td>${f}</td><td>${uniqueDetalles}</td><td>${m.montoTotal > 0 ? '-'+formatearMoneda(m.montoTotal) : '-'}</td></tr>`;
                tbody.innerHTML += row;
            });
        }
    } catch(e) { console.error(e); }
}

function abrirModalSaldo() { document.getElementById('modalSaldo').style.display = 'block'; const valActual = document.getElementById('gestionSocioSaldoAnt').value; document.getElementById('inputSaldoAnterior').value = valActual; }
function cerrarModalSaldo() { document.getElementById('modalSaldo').style.display = 'none'; }

function abrirModalCalendario() {
    const nombre = document.getElementById('gestionSocioNombre').value || '';
    document.getElementById('calTitulo').textContent = nombre ? '📅 Días — ' + nombre : '📅 Días Trabajados';
    document.getElementById('modalCalendario').style.display = 'block';
    renderCalendarGrid();
}
function cerrarModalCalendario() { document.getElementById('modalCalendario').style.display = 'none'; }

async function guardarSaldoAnterior() {
    const rawSaldo = document.getElementById('inputSaldoAnterior').value.replace(/\./g, '');
    const nuevoSaldo = parseFloat(rawSaldo) || 0;
    const idSocio = document.getElementById('gestionSocioId').value;
    const nombreSocio = document.getElementById('gestionSocioNombre').value;
    toggleLoader(true, "Guardando Saldo...");
    try {
        await callApiSocios('registrarSaldoAnterior', { id: idSocio, nombre: nombreSocio, monto: nuevoSaldo });
        showToast('Saldo actualizado', 'success');
        document.getElementById('gestionSocioSaldoAnt').value = nuevoSaldo;
        cerrarModalSaldo();
        cargarHistorialSocio(idSocio);
    } catch(e) { showToast('Error al guardar saldo', 'error'); } finally { toggleLoader(false); }
}

// ── Historial de anticipos de meses anteriores ───────────────
let _antAntAbierto = false;
let _antAntCargado = false;
let _antAntData = [];

const _MESES_ES = {'ENERO':'Enero','FEBRERO':'Febrero','MARZO':'Marzo','ABRIL':'Abril','MAYO':'Mayo','JUNIO':'Junio','JULIO':'Julio','AGOSTO':'Agosto','SEPTIEMBRE':'Septiembre','OCTUBRE':'Octubre','NOVIEMBRE':'Noviembre','DICIEMBRE':'Diciembre'};
const _MESES_ORD = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function _antAntReset() {
    _antAntAbierto = false;
    _antAntCargado = false;
    _antAntData = [];
    const panel = document.getElementById('panelAnticiposAnt');
    const icon = document.getElementById('antAntToggleIcon');
    const contenido = document.getElementById('antAntContenido');
    const filtros = document.getElementById('antAntFiltros');
    if (panel) panel.style.display = 'none';
    if (icon) icon.style.transform = '';
    if (contenido) contenido.innerHTML = '';
    if (filtros) filtros.style.display = 'none';
}

function toggleAnticiposAnt() {
    _antAntAbierto = !_antAntAbierto;
    const panel = document.getElementById('panelAnticiposAnt');
    const icon = document.getElementById('antAntToggleIcon');
    if (panel) panel.style.display = _antAntAbierto ? 'block' : 'none';
    if (icon) icon.style.transform = _antAntAbierto ? 'rotate(180deg)' : '';
    if (_antAntAbierto && !_antAntCargado) {
        const idSocio = document.getElementById('gestionSocioId').value;
        const nombreSocio = document.getElementById('gestionSocioNombre').value;
        cargarAnticiposAnteriores(idSocio, nombreSocio);
    }
}

async function cargarAnticiposAnteriores(idSocio, nombreSocio) {
    const contenido = document.getElementById('antAntContenido');
    const loader = document.getElementById('antAntLoader');
    if (!contenido || !loader) return;
    loader.style.display = 'block';
    contenido.innerHTML = '';
    _antAntCargado = false;
    _antAntData = [];
    try {
        const res = await callApiSocios('getHistorialAnticiposSocio', { idSocio, nombreSocio });
        loader.style.display = 'none';
        _antAntCargado = true;
        _antAntData = res.data || [];
        antAnt_renderFiltros();
        antAnt_render();
    } catch(e) {
        loader.style.display = 'none';
        contenido.innerHTML = '<div style="text-align:center;color:#e74c3c;font-size:0.85em;padding:16px;">Error al cargar. Actualiza el backend con la acción <code>getHistorialAnticiposSocio</code>.</div>';
    }
}

function antAnt_parseTab(tab) {
    const parts = tab.replace('Anticipos_', '').split('_');
    return { mes: parts[0] || '', año: parts[1] || '????' };
}

function antAnt_renderFiltros() {
    const filtrosEl = document.getElementById('antAntFiltros');
    if (!filtrosEl) return;
    if (!_antAntData.length) { filtrosEl.style.display = 'none'; return; }

    const años = [...new Set(_antAntData.map(d => antAnt_parseTab(d.tab).año))].sort((a,b) => b.localeCompare(a));
    const meses = [...new Set(_antAntData.map(d => antAnt_parseTab(d.tab).mes))].sort((a,b) => _MESES_ORD.indexOf(a) - _MESES_ORD.indexOf(b));

    filtrosEl.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;background:#f1f5f9;border-radius:8px;padding:8px 10px;';
    filtrosEl.innerHTML = `<span style="font-size:0.78em;font-weight:700;color:#475569;">Filtrar:</span>
        <select id="antAntFiltroAno" onchange="antAnt_render()" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8em;color:#374151;cursor:pointer;">
            <option value="">Todos los años</option>
            ${años.map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>
        <select id="antAntFiltroMes" onchange="antAnt_render()" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8em;color:#374151;cursor:pointer;">
            <option value="">Todos los meses</option>
            ${meses.map(m => `<option value="${m}">${_MESES_ES[m] || m}</option>`).join('')}
        </select>`;
}

function antAnt_render() {
    const contenido = document.getElementById('antAntContenido');
    if (!contenido) return;
    const filtroAno = (document.getElementById('antAntFiltroAno') || {}).value || '';
    const filtroMes = (document.getElementById('antAntFiltroMes') || {}).value || '';

    if (!_antAntData.length) {
        contenido.innerHTML = '<div style="text-align:center;color:#64748b;font-size:0.85em;padding:20px;">Sin anticipos en meses anteriores.</div>';
        return;
    }

    // Agrupar por año
    const porAno = {};
    _antAntData.forEach(({ tab, registros }) => {
        const { mes, año } = antAnt_parseTab(tab);
        if (filtroAno && año !== filtroAno) return;
        if (filtroMes && mes !== filtroMes) return;
        if (!porAno[año]) porAno[año] = [];
        porAno[año].push({ mes, tab, registros });
    });

    const años = Object.keys(porAno).sort((a,b) => b.localeCompare(a));
    if (!años.length) {
        contenido.innerHTML = '<div style="text-align:center;color:#64748b;font-size:0.85em;padding:20px;">Sin resultados para los filtros seleccionados.</div>';
        return;
    }

    let totalGeneral = 0;
    let html = '';

    años.forEach((año, anoIdx) => {
        const meses = porAno[año].sort((a,b) => _MESES_ORD.indexOf(b.mes) - _MESES_ORD.indexOf(a.mes));
        const totalAno = meses.reduce((s,m) => s + m.registros.reduce((ss,r) => ss + (parseFloat(r.monto)||0), 0), 0);
        totalGeneral += totalAno;
        const anoOpen = anoIdx === 0;

        html += `<div style="margin-bottom:12px;border-radius:10px;overflow:hidden;border:1.5px solid #bfdbfe;">
            <div onclick="antAntToggleYear('${año}')" style="background:#1e40af;color:white;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">
                <span style="font-weight:800;font-size:0.9em;">📆 ${año}</span>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:0.82em;opacity:0.85;">${meses.length} mes${meses.length!==1?'es':''}</span>
                    <span style="font-weight:800;font-size:0.88em;">${formatearMoneda(totalAno)}</span>
                    <span id="antAntYearIcon-${año}" style="font-size:0.8em;">${anoOpen?'▲':'▼'}</span>
                </div>
            </div>
            <div id="antAntYear-${año}" style="display:${anoOpen?'block':'none'};">`;

        meses.forEach((mesData, mesIdx) => {
            const mesOpen = anoIdx === 0 && mesIdx === 0;
            const totalMes = mesData.registros.reduce((s,r) => s + (parseFloat(r.monto)||0), 0);
            const mesId = `${mesData.mes}_${año}`;

            html += `<div style="border-bottom:1px solid #dbeafe;">
                <div onclick="antAntToggleMes('${mesId}')" style="background:#eff6ff;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">
                    <span style="font-weight:700;color:#1e40af;font-size:0.83em;">📅 ${_MESES_ES[mesData.mes]||mesData.mes}</span>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:0.75em;color:#64748b;">${mesData.registros.length} registro${mesData.registros.length!==1?'s':''}</span>
                        <span style="font-weight:800;color:#1e40af;font-size:0.83em;">${formatearMoneda(totalMes)}</span>
                        <span id="antAntMesIcon-${mesId}" style="color:#1e40af;font-size:0.72em;">${mesOpen?'▲':'▼'}</span>
                    </div>
                </div>
                <div id="antAntMes-${mesId}" style="display:${mesOpen?'block':'none'};">
                    <table style="width:100%;border-collapse:collapse;font-size:0.79em;">
                        <thead><tr style="background:#dbeafe;">
                            <th style="padding:5px 10px;text-align:left;color:#1e40af;font-weight:700;">Fecha</th>
                            <th style="padding:5px 10px;text-align:right;color:#1e40af;font-weight:700;">Monto</th>
                            <th style="padding:5px 10px;text-align:left;color:#1e40af;font-weight:700;">Estado</th>
                            <th style="padding:5px 10px;text-align:left;color:#1e40af;font-weight:700;">Responsable</th>
                        </tr></thead>
                        <tbody>`;
            mesData.registros.forEach(r => {
                html += `<tr style="border-bottom:1px solid #f0f9ff;">
                    <td style="padding:5px 10px;color:#374151;">${r.fecha||'-'}</td>
                    <td style="padding:5px 10px;text-align:right;font-weight:700;color:#1d4ed8;">${formatearMoneda(parseFloat(r.monto)||0)}</td>
                    <td style="padding:5px 10px;color:#374151;">${r.estado||'-'}</td>
                    <td style="padding:5px 10px;color:#374151;">${r.responsable||'-'}</td>
                </tr>`;
            });
            html += `</tbody></table></div></div>`;
        });
        html += `</div></div>`;
    });

    const totalHtml = `<div style="background:#1e40af;color:white;border-radius:8px;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:0.85em;">
        <span style="font-weight:700;">💰 Total histórico</span>
        <span style="font-weight:900;font-size:1.05em;">${formatearMoneda(totalGeneral)}</span>
    </div>`;
    contenido.innerHTML = totalHtml + html;
}

function antAntToggleYear(año) {
    const body = document.getElementById(`antAntYear-${año}`);
    const icon = document.getElementById(`antAntYearIcon-${año}`);
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (icon) icon.textContent = open ? '▼' : '▲';
}

function antAntToggleMes(mesId) {
    const body = document.getElementById(`antAntMes-${mesId}`);
    const icon = document.getElementById(`antAntMesIcon-${mesId}`);
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (icon) icon.textContent = open ? '▼' : '▲';
}

async function cargarHistorialSocio(id) {
    _antAntReset();
    const _secAnt = document.getElementById('seccionAnticiposAnt');
    if (_secAnt) _secAnt.style.display = 'block';
    const tbody = document.getElementById('tablaHistorial');
    tbody.innerHTML = Array(3).fill(`<tr>
        <td><div style="height:14px;background:#eee;border-radius:4px;width:70px;animation:shimmer 1.2s infinite alternate;"></div></td>
        <td><div style="height:14px;background:#eee;border-radius:4px;width:80px;animation:shimmer 1.2s infinite alternate;"></div></td>
        <td><div style="height:14px;background:#eee;border-radius:4px;width:100px;animation:shimmer 1.2s infinite alternate;"></div></td>
        <td><div style="height:14px;background:#eee;border-radius:4px;width:60px;animation:shimmer 1.2s infinite alternate;"></div></td>
    </tr>`).join('');
    try {
        const response = await fetch(`${URL_SOCIOS}?action=getDatosSocio&socioId=${id}`);
        const res = await response.json();
        tbody.innerHTML = '';
        if (res.status === 'success') {
            const data = res.data || {};
            const agrupados = {};
            let sumaTotalPedido = 0;

            const saldoAnterior = Number(data.saldoAnterior || 0);
            document.getElementById('socioSaldoAnterior').innerText = formatearMoneda(saldoAnterior);
            document.getElementById('gestionSocioSaldoAnt').value = saldoAnterior;

            const socio = cacheSocios.find(s => s.id === id);
            if(socio.contrato === 'Part-Time') {
                selectedDaysPT = globalDiasPT[id] || [];
                document.getElementById('socioDiasCount').innerText = selectedDaysPT.length;
            }

            globalFechasAusenciaSocioActual = new Set();
            globalTieneTerminoContrato = false;
            const fechasAusencia = new Set();
            if(data.extras) {
                data.extras.forEach(e => {
                    if(e.tipo && e.tipo.toLowerCase().includes('ausencia')) {
                        let f = e.fecha;
                        if(f.includes('T')) f = f.split('T')[0];
                        fechasAusencia.add(f);
                        if(e.detalle === 'Término de Contrato') globalTieneTerminoContrato = true;
                    }
                });
            }
            globalFechasAusenciaSocioActual = new Set(fechasAusencia);

            // Poblar tarjeta resumen de ausencias
            const _cardAus = document.getElementById('cardResumenAusencias');
            if (_cardAus) {
                const _ausItems = (data.extras || []).filter(e => e.tipo && e.tipo.toLowerCase().includes('ausencia'));
                if (_ausItems.length > 0) {
                    const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                    const _tcItems2 = _ausItems.filter(e => e.detalle === 'Término de Contrato');
                    const _otrosAus = _ausItems.filter(e => e.detalle !== 'Término de Contrato');
                    const _montoTotalAus = Math.round(_ausItems.reduce((s, e) => s + (parseFloat(e.monto) || 0), 0));
                    let _diasHtml = '';
                    _otrosAus.forEach(e => {
                        let f = e.fecha; if (f.includes('T')) f = f.split('T')[0];
                        const dia = parseInt(f.split('-')[2]);
                        _diasHtml += `<span style="background:#fee2e2;border-radius:5px;padding:2px 7px;font-size:0.78em;font-weight:700;color:#991b1b;">día ${dia}</span>`;
                    });
                    if (_tcItems2.length > 0) {
                        const _ftc = _tcItems2.map(e => { let f = e.fecha; if(f.includes('T')) f=f.split('T')[0]; return f; }).sort();
                        const _mes = MESES[parseInt(_ftc[0].split('-')[1]) - 1];
                        const _d1 = parseInt(_ftc[0].split('-')[2]);
                        const _d2 = parseInt(_ftc[_ftc.length-1].split('-')[2]);
                        _diasHtml += `<span style="background:#991b1b;border-radius:5px;padding:2px 8px;font-size:0.78em;font-weight:700;color:white;">🔴 ${_d1} al ${_d2} ${_mes} (${_tcItems2.length} días)</span>`;
                    }
                    document.getElementById('ausenciaDiasLista').innerHTML = _diasHtml;
                    document.getElementById('ausenciaMontoTotal').innerText = formatearMoneda(_montoTotalAus);
                    _cardAus.style.display = 'block';
                } else {
                    _cardAus.style.display = 'none';
                }
            }

            const procesarEntrada = (fechaRaw, tipo, detalle, monto, uuid) => {
                let fecha = fechaRaw || "";
                if(fecha.includes('T')) fecha = fecha.split('T')[0];
                if(!fecha) return;
                const key = fecha + '|' + tipo + '|' + (uuid || Math.random());
                agrupados[key] = {
                    fecha: fecha,
                    tipos: new Set([tipo]),
                    detalles: detalle ? [detalle] : [],
                    montoTotal: monto,
                    rawDate: new Date(fechaRaw),
                    uuid: uuid
                };
            };

            if(data.anticipos && Array.isArray(data.anticipos)) {
                data.anticipos.forEach(a => {
                    const respInfo = a.responsable ? ` (Resp: ${a.responsable} ${a.areaResponsable||''})` : '';
                    procesarEntrada(a.fecha, 'Anticipo', 'Adelanto' + respInfo, Number(a.cantidad || a.monto || 0), a.uuid);
                });
            }
            // Tarjeta indicador de anticipos
            let _cardAnts = document.getElementById('cardResumenAnticipos');
            if (!_cardAnts) {
                _cardAnts = document.createElement('div');
                _cardAnts.id = 'cardResumenAnticipos';
                _cardAnts.style.cssText = 'display:none;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:12px;padding:13px 14px;margin-bottom:10px;';
                _cardAnts.innerHTML = '<div style="font-weight:800;color:#1d4ed8;font-size:0.85em;margin-bottom:10px;display:flex;align-items:center;gap:5px;">💰 Anticipos en el historial</div><div style="display:flex;gap:10px;flex-wrap:wrap;"><div style="background:white;border-radius:8px;padding:10px 12px;border:1px solid #bfdbfe;text-align:center;min-width:90px;"><span style="display:block;font-size:0.68em;text-transform:uppercase;font-weight:700;color:#1e40af;margin-bottom:4px;letter-spacing:0.04em;">Cantidad</span><span id="anticiposCount" style="font-size:1.3em;font-weight:900;color:#1d4ed8;">0</span></div><div style="background:white;border-radius:8px;padding:10px 12px;border:1px solid #bfdbfe;text-align:center;min-width:110px;"><span style="display:block;font-size:0.68em;text-transform:uppercase;font-weight:700;color:#1e40af;margin-bottom:4px;letter-spacing:0.04em;">Total solicitado</span><span id="anticiposTotal" style="font-size:1.15em;font-weight:900;color:#1d4ed8;">$0</span></div></div>';
                const _cardAusRef = document.getElementById('cardResumenAusencias');
                if (_cardAusRef) _cardAusRef.parentNode.insertBefore(_cardAnts, _cardAusRef);
            }
            const _ants = data.anticipos || [];
            if (_ants.length > 0) {
                const _totalAnts = _ants.reduce((s, a) => s + Number(a.cantidad || a.monto || 0), 0);
                document.getElementById('anticiposCount').textContent = _ants.length;
                document.getElementById('anticiposTotal').textContent = formatearMoneda(_totalAnts);
                _cardAnts.style.display = 'block';
            } else {
                _cardAnts.style.display = 'none';
            }

            // Actualizar anticipos del socio activo para detección de duplicados
            gestionSocioAnticiposActuales = (data.anticipos || []).map(a => {
                let f = a.fecha; if (f && f.includes('T')) f = f.split('T')[0];
                const respInfo = a.responsable ? ` (Resp: ${a.responsable} ${a.areaResponsable||''})` : '';
                return { fecha: f, monto: Number(a.cantidad || a.monto || 0), uuid: a.uuid, detalles: ['Adelanto' + respInfo] };
            });
            if(data.extras && Array.isArray(data.extras)) {
                data.extras.forEach(e => {
                    // Ausencias muestran su monto real (punto_noche × puntos) como referencia informativa
                    const esAus = e.tipo && e.tipo.toLowerCase().includes('ausencia');
                    procesarEntrada(e.fecha, (e.tipo || 'Extra').toUpperCase(), e.detalle, esAus ? (parseFloat(e.monto)||0) : 0, e.uuid);
                });
            }

            const listaFinal = Object.values(agrupados);
            // Ausencias NO suman a pedidos: su impacto ya está en la reducción del alcance
            listaFinal.forEach(item => {
                if (!Array.from(item.tipos).includes('AUSENCIA')) sumaTotalPedido += item.montoTotal;
            });

            const ptsSocio = parseFloat(document.getElementById('gestionSocioPuntos').value) || 0;
            let alcance = 0;

            if (socio.contrato === 'Part-Time') {
                let sumaValorPuntosPT = 0;
                selectedDaysPT.forEach(dia => {
                    if(!fechasAusencia.has(dia) && globalMapaPuntosDia[dia] !== null && globalMapaPuntosDia[dia]) {
                        sumaValorPuntosPT += globalMapaPuntosDia[dia];
                    }
                });
                alcance = sumaValorPuntosPT * ptsSocio;
            } else {
                let sumaValorTotal = 0;
                for (const [dia, valor] of Object.entries(globalMapaPuntosDia)) {
                    if (!fechasAusencia.has(dia) && valor !== null) {
                        sumaValorTotal += valor;
                    }
                }
                alcance = sumaValorTotal * ptsSocio;
            }

            const saldoReal = (alcance + saldoAnterior) - sumaTotalPedido;

            let aPagar = 0;
            let remanente = 0;
            if (saldoReal > 0) {
                aPagar = Math.floor(saldoReal / 1000) * 1000;
                remanente = Math.round(saldoReal - aPagar);
            } else {
                aPagar = 0;
                remanente = Math.round(saldoReal);
            }

            document.getElementById('gestionSocioRemanente').value = remanente;
            document.getElementById('socioTotalPedido').innerText = formatearMoneda(sumaTotalPedido);
            document.getElementById('socioAlcance').innerText = formatearMoneda(alcance);
            _actualizarValorPunto(socio);

            const elSaldoReal = document.getElementById('socioSaldoReal');
            elSaldoReal.innerText = formatearMoneda(saldoReal);
            elSaldoReal.style.color = saldoReal < 0 ? 'var(--danger)' : 'var(--primary)';

            document.getElementById('socioAPagar').innerText = formatearMoneda(aPagar);

            const elRem = document.getElementById('socioRemanente');
            elRem.innerText = formatearMoneda(remanente);
            elRem.style.color = remanente < 0 ? 'var(--danger)' : '#8e44ad';

            if(listaFinal.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#7f8c8d; padding:20px;">No hay movimientos registrados.</td></tr>'; return; }
            listaFinal.sort((a,b) => b.rawDate - a.rawDate);

            // Agrupar entradas de Término de Contrato en una sola fila de visualización
            const _esTC = item => Array.from(item.tipos).includes('AUSENCIA') && item.detalles.includes('Término de Contrato');
            const _tcItems = listaFinal.filter(_esTC);
            const _otrosItems = listaFinal.filter(item => !_esTC(item));
            let listaDisplay;
            if (_tcItems.length > 1) {
                const _fechasTC = _tcItems.map(e => e.fecha).sort();
                const _fD = f => { const p = f.split('-'); return `${parseInt(p[2])}/${p[1]}`; };
                listaDisplay = [..._otrosItems, {
                    fecha: _fechasTC[0],
                    fechaDisplay: `${_fD(_fechasTC[0])} al ${_fD(_fechasTC[_fechasTC.length - 1])}`,
                    tipos: new Set(['AUSENCIA']),
                    detalles: [`Término de Contrato (${_tcItems.length} días)`],
                    montoTotal: 0,
                    rawDate: new Date(_fechasTC[0] + 'T12:00:00'),
                    uuid: null,
                    uuidsGrupo: _tcItems.map(e => e.uuid).filter(Boolean),
                    fechasGrupo: _tcItems.map(e => e.fecha)
                }].sort((a, b) => b.rawDate - a.rawDate);
            } else {
                listaDisplay = listaFinal;
            }

            listaDisplay.forEach(item => {
                const row = document.createElement('tr');
                row.classList.add('row-deletable');

                let pressTimer;
                row.addEventListener('mousedown', () => { pressTimer = setTimeout(() => mostrarModalBorrar(item), 800); });
                row.addEventListener('touchstart', () => { pressTimer = setTimeout(() => mostrarModalBorrar(item), 800); }, {passive:true});
                row.addEventListener('mouseup', () => clearTimeout(pressTimer));
                row.addEventListener('touchend', () => clearTimeout(pressTimer));
                row.addEventListener('mouseleave', () => clearTimeout(pressTimer));

                let fechaVis = item.fechaDisplay || item.fecha;
                if(fechaVis.includes('-')) { const f = fechaVis.split('-'); if(f.length === 3) fechaVis = `${f[2]}/${f[1]}/${f[0]}`; }
                const tiposArr = Array.from(item.tipos);
                const esAnticipo = tiposArr.includes('Anticipo');
                let tipoHtml;
                if (tiposArr.includes('AUSENCIA')) {
                    tipoHtml = item.uuidsGrupo
                        ? '<span class="tag-absent" style="background:#991b1b;font-size:0.7em;letter-spacing:0.3px;">🔴 T.CONTRATO</span>'
                        : '<span class="tag-absent">AUSENCIA</span>';
                } else {
                    tipoHtml = `<span style="font-weight:bold; color:#7f8c8d;">${tiposArr.join(' + ')}</span>`;
                }
                const detalleHtml = [...new Set(item.detalles)].join(', ') || '-';
                const esAusencia = Array.from(item.tipos).includes('AUSENCIA');
                const claseColor = esAusencia ? 'amount-minus' : 'amount-anticipo';
                const montoHtml = item.montoTotal > 0 ? `<span class="${claseColor}">-${formatearMoneda(item.montoTotal)}</span>` : '-';

                const itemDataStr = JSON.stringify({
                    uuid: item.uuid,
                    fecha: item.fecha,
                    montoTotal: item.montoTotal,
                    detalles: item.detalles,
                    tipos: tiposArr
                }).replace(/"/g, '&quot;');

                const editBtn = esAnticipo
                    ? `<button onclick="event.stopPropagation(); mostrarModalEditar(${itemDataStr})" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);color:#b45309;border-radius:6px;padding:3px 8px;font-size:0.75em;cursor:pointer;font-weight:700;white-space:nowrap;">✏️</button>`
                    : '';

                row.innerHTML = `<td>${fechaVis}</td><td>${tipoHtml}</td><td style="font-size:0.82em;">${detalleHtml}</td><td style="white-space:nowrap;">${montoHtml} ${editBtn}</td>`;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger); text-align:center;">Error: ${res.message}</td></tr>`;
        }
    } catch (e) { console.error("Error JS:", e); tbody.innerHTML = '<tr><td colspan="4" style="color:var(--danger); text-align:center;">Error procesando datos</td></tr>'; }
}

async function enviarAnticipo() {
    const id = document.getElementById('gestionSocioId').value;
    const nombre = document.getElementById('gestionSocioNombre').value;
    const campoMonto = document.getElementById('montoAnticipo');
    const rawMonto = campoMonto.value.replace(/\./g, '');
    const monto = parseInt(rawMonto);
    const fecha = document.getElementById('fechaAnticipo').value;
    const respSel = document.getElementById('responsableAnticipo');
    const respVal = respSel ? respSel.value : '';
    const respIni  = respVal.split('|')[0] || '';
    const respArea = respVal.split('|')[1] || '';
    if(!monto || !fecha) {
        campoMonto.classList.add('input-error');
        setTimeout(() => campoMonto.classList.remove('input-error'), 1500);
        return showToast('Falta datos', 'error');
    }

    // Guardar último responsable seleccionado
    if(respVal) localStorage.setItem(LAST_RESP_KEY, respVal);

    // Formatear fecha para mostrar
    const fp = fecha.split('-');
    const fechaVis = fp.length === 3 ? fp[2] + '/' + fp[1] + '/' + fp[0] : fecha;
    const montoVis = new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP', maximumFractionDigits:0}).format(monto);
    const respVis = respIni ? respIni + (respArea ? ' (' + respArea + ')' : '') : 'Sin responsable';

    // Verificar anticipo duplicado en la misma fecha
    const anticipoDuplicado = gestionSocioAnticiposActuales.find(a => a.fecha === fecha);
    if (anticipoDuplicado) {
        const montoExisVis = new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP', maximumFractionDigits:0}).format(anticipoDuplicado.monto);
        const querreEditar = window.confirm(
            '⚠️ ANTICIPO DUPLICADO — ' + fechaVis + '\n\n' +
            'Este socio ya tiene un anticipo de ' + montoExisVis + ' ese día.\n\n' +
            '✏️  ACEPTAR  →  Editar el anticipo existente (' + montoExisVis + ')\n' +
            '➕  CANCELAR →  Agregar un nuevo anticipo de ' + montoVis + ' (inusual)'
        );
        if (querreEditar) {
            // Abrir modal de edición con el anticipo existente pre-cargado
            mostrarModalEditar({
                uuid: anticipoDuplicado.uuid,
                fecha: anticipoDuplicado.fecha,
                montoTotal: anticipoDuplicado.monto,
                detalles: anticipoDuplicado.detalles,
                tipos: ['Anticipo']
            });
            return;
        }
        // Si cancela: continúa el flujo normal para agregar uno nuevo
    }

    // Confirmación antes de guardar
    const confirmar = window.confirm(
        'ANTICIPO DE PROPINA\n\n' +
        '👤 Socio: ' + nombre + '\n' +
        '💰 Monto: ' + montoVis + '\n' +
        '📅 Fecha: ' + fechaVis + '\n' +
        '🔖 Encargado: ' + respVis + '\n\n' +
        '¿Confirmar registro?'
    );
    if(!confirmar) return;

    // Abrir modal de desglose de billetes antes de registrar
    abrirDesgloseAnticipo({ id, nombre, fecha, monto, respIni, respArea, montoVis, fechaVis, campoMonto });
}

// Devuelve el último día disponible en globalMapaPuntosDia (fin del período activo)
function obtenerFinPeriodo() {
    const dias = Object.keys(globalMapaPuntosDia || {});
    if (dias.length > 0) return dias.sort().pop();
    const hoy = new Date();
    const fin = hoy.getDate() < 15
        ? new Date(hoy.getFullYear(), hoy.getMonth(), 14)
        : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 14);
    return fin.toISOString().split('T')[0];
}

// Genera un array con todas las fechas YYYY-MM-DD entre fechaDesde y fechaHasta (inclusive)
function obtenerDiasRango(fechaDesde, fechaHasta) {
    const dias = [];
    const inicio = new Date(fechaDesde + 'T12:00:00');
    const fin = new Date(fechaHasta + 'T12:00:00');
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
        dias.push(d.toISOString().split('T')[0]);
    }
    return dias;
}

// Actualiza el resumen de días congelados cuando cambian las fechas de rango
function actualizarInfoTerminoContrato() {
    const fechaDesde = document.getElementById('fechaAusencia')?.value;
    const fechaHasta = document.getElementById('fechaHastaAusencia')?.value;
    const diasInfo = document.getElementById('infoRangoAusencia');
    if (!diasInfo) return;
    if (!fechaDesde || !fechaHasta) { diasInfo.innerText = ''; return; }
    if (fechaHasta < fechaDesde) { diasInfo.innerText = '⚠️ La fecha fin debe ser igual o posterior a la fecha inicio.'; return; }
    const diasRango = obtenerDiasRango(fechaDesde, fechaHasta);
    const diasEnPeriodo = diasRango.filter(d => globalMapaPuntosDia && d in globalMapaPuntosDia);
    const fmt = f => { const p = f.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
    diasInfo.innerText = `⚠️ ${diasEnPeriodo.length} día${diasEnPeriodo.length !== 1 ? 's' : ''} congelado${diasEnPeriodo.length !== 1 ? 's' : ''} (${fmt(fechaDesde)} al ${fmt(fechaHasta)})`;
}

async function enviarAusencia() {
    const id = document.getElementById('gestionSocioId').value;
    const nombre = document.getElementById('gestionSocioNombre').value;
    const fecha = document.getElementById('fechaAusencia').value;
    const campoMotivo = document.getElementById('motivoAusencia');
    const motivo = campoMotivo.value.trim();
    if(!fecha || !motivo) {
        campoMotivo.classList.add('input-error');
        setTimeout(() => campoMotivo.classList.remove('input-error'), 1500);
        return showToast('Falta datos', 'error');
    }

    const esTermino = motivo === 'Término de Contrato';
    const fechaHastaInput = document.getElementById('fechaHastaAusencia');
    const fechaHasta = fechaHastaInput ? fechaHastaInput.value : '';

    const socioActivo = cacheSocios.find(s => s.id === id);
    const puntosSocio = socioActivo ? (parseFloat(socioActivo.puntos) || 0) : (parseFloat(document.getElementById('gestionSocioPuntos')?.value) || 0);

    let detalleExtras = [];

    if (esTermino && fechaHasta) {
        if (fechaHasta < fecha) return showToast('La fecha fin debe ser posterior al inicio', 'error');
        const diasRango = obtenerDiasRango(fecha, fechaHasta);
        detalleExtras = diasRango.map(dia => {
            const puntosDia = globalMapaPuntosDia[dia];
            const montoAusencia = (puntosDia !== null && puntosDia !== undefined) ? Math.round(puntosDia * puntosSocio) : 0;
            return { id, nombre, fecha: dia, tipo: 'ausencia', monto: montoAusencia, detalle: 'Término de Contrato' };
        });
    } else {
        const puntosDia = globalMapaPuntosDia[fecha];
        const montoAusencia = (puntosDia !== null && puntosDia !== undefined) ? Math.round(puntosDia * puntosSocio) : 0;
        detalleExtras = [{ id, nombre, fecha, tipo: 'ausencia', monto: montoAusencia, detalle: `Ausencia: ${motivo}` }];
    }

    toggleLoader(true);
    try {
        await callApiSocios('registrarBatchExtras', { detalleExtras });
        const msg = esTermino
            ? `✅ Término de contrato: ${detalleExtras.length} día${detalleExtras.length !== 1 ? 's' : ''} congelado${detalleExtras.length !== 1 ? 's' : ''}`
            : '✅ Ausencia registrada correctamente';
        showToast(msg, 'success');
        campoMotivo.value = '';
        document.getElementById('fechaAusencia').value = new Date().toISOString().split('T')[0];
        document.querySelectorAll('.btn-motivo').forEach(b => b.classList.remove('activo'));
        if (fechaHastaInput) fechaHastaInput.value = '';
        const rangoContainer = document.getElementById('rangoAusenciaContainer');
        if (rangoContainer) rangoContainer.style.display = 'none';
        cargarHistorialSocio(id);
    } catch(e) { showToast('Error al registrar ausencia', 'error'); } finally { toggleLoader(false); }
}

function seleccionarMotivo(motivo) {
    document.getElementById('motivoAusencia').value = motivo;
    document.querySelectorAll('.btn-motivo').forEach(b => {
        b.classList.toggle('activo', b.textContent.includes(motivo.split(' ')[0]));
    });
    if (motivo === 'Otro') {
        document.getElementById('motivoAusencia').value = '';
        document.getElementById('motivoAusencia').focus();
    }
    const esTermino = motivo === 'Término de Contrato';
    const rangoContainer = document.getElementById('rangoAusenciaContainer');
    if (rangoContainer) {
        rangoContainer.style.display = esTermino ? 'block' : 'none';
        if (esTermino) {
            const fechaHastaInput = document.getElementById('fechaHastaAusencia');
            if (fechaHastaInput) {
                fechaHastaInput.value = obtenerFinPeriodo();
                actualizarInfoTerminoContrato();
            }
        }
    }
}

function mostrarModalBorrar(item) {
    document.getElementById('modalConfirmarBorrar').style.display = 'block';
    document.getElementById('borrarSocioId').value = document.getElementById('gestionSocioId').value || '';
    if (item.uuidsGrupo && item.uuidsGrupo.length > 0) {
        const detalle = item.detalles.join(', ');
        document.getElementById('txtDetalleBorrar').innerText = `¿Eliminar ${detalle}? Se borrarán ${item.uuidsGrupo.length} registros.`;
        document.getElementById('borrarUUID').value = JSON.stringify(item.uuidsGrupo);
        document.getElementById('borrarFecha').value = JSON.stringify(item.fechasGrupo || [item.fecha]);
    } else {
        document.getElementById('txtDetalleBorrar').innerText = `¿Borrar registro del ${item.fecha} (${Array.from(item.tipos).join(',')})?`;
        document.getElementById('borrarUUID').value = item.uuid;
        document.getElementById('borrarFecha').value = item.fecha || '';
    }
    document.getElementById('borrarTipo').value = item.montoTotal > 0 ? 'Anticipo' : 'Extra';
}

async function borrarItemConfirmado() {
    const uuidVal = document.getElementById('borrarUUID').value;
    const tipo = document.getElementById('borrarTipo').value;
    const socioId = document.getElementById('borrarSocioId').value || '';
    const fechaVal = document.getElementById('borrarFecha').value || '';
    if(!uuidVal) return alert("No se puede borrar (Falta ID)");

    toggleLoader(true, "Eliminando...");
    document.getElementById('modalConfirmarBorrar').style.display='none';

    try {
        let uuids;
        try { const p = JSON.parse(uuidVal); uuids = Array.isArray(p) ? p : [uuidVal]; }
        catch(e) { uuids = [uuidVal]; }

        let fechas;
        try { const f = JSON.parse(fechaVal); fechas = Array.isArray(f) ? f : [fechaVal]; }
        catch(e) { fechas = [fechaVal]; }

        for (let i = 0; i < uuids.length; i++) {
            await callApiSocios('borrarMovimiento', { uuid: uuids[i], tipo, socioId, fecha: fechas[i] || fechas[0] || '' });
        }
        showToast(uuids.length > 1 ? `${uuids.length} registros eliminados` : 'Eliminado correctamente', 'success');
        globalCacheAllData = null;
        try { localStorage.removeItem(CACHE_KEY_ALL_DATA); } catch(e) {}
        const idSocio = document.getElementById('gestionSocioId').value;
        cargarHistorialSocio(idSocio);
        if (typeof aq_fetchAnticipos === 'function') aq_fetchAnticipos(true);
    } catch(e) {
        showToast('Error al eliminar', 'error');
    } finally {
        toggleLoader(false);
    }
}

function mostrarModalEditar(item) {
    if(!Array.from(item.tipos).includes('Anticipo')) return;
    document.getElementById('editAnticipoUUID').value = item.uuid || '';
    document.getElementById('editAnticipoFecha').value = item.fecha || '';
    // Monto: quitar formato y poner número
    const montoNum = item.montoTotal || 0;
    document.getElementById('editAnticipoMonto').value = montoNum > 0 ? new Intl.NumberFormat('es-CL').format(montoNum) : '';
    // Poblar selector de responsables
    const sel = document.getElementById('editAnticipoResponsable');
    if(sel) {
        sel.innerHTML = '<option value="">Sin responsable</option>';
        const lista = responsables_cargar();
        lista.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.ini + '|' + r.area;
            opt.textContent = r.ini + ' (' + r.area + ')';
            // Pre-seleccionar si el detalle menciona al responsable
            const detalle = item.detalles.join(' ');
            if(detalle.includes(r.ini)) opt.selected = true;
            sel.appendChild(opt);
        });
    }
    document.getElementById('modalEditarAnticipo').style.display = 'block';
}

async function guardarEdicionAnticipo() {
    const uuid = document.getElementById('editAnticipoUUID').value;
    const fecha = document.getElementById('editAnticipoFecha').value;
    const montoRaw = document.getElementById('editAnticipoMonto').value.replace(/\./g,'').replace(/[^0-9]/g,'');
    const monto = parseInt(montoRaw) || 0;
    const respSel = document.getElementById('editAnticipoResponsable');
    const respVal = respSel ? respSel.value : '';
    const responsable = respVal ? respVal.split('|')[0] : '';
    const areaResponsable = respVal ? respVal.split('|')[1] : '';

    if(!uuid || !fecha || monto <= 0) return showToast('Completa fecha y monto', 'error');
    toggleLoader(true, 'Actualizando...');
    document.getElementById('modalEditarAnticipo').style.display = 'none';
    try {
        await callApiSocios('actualizarAnticipo', { uuid, fecha, monto, responsable, areaResponsable });
        showToast('Anticipo actualizado', 'success');

        // Invalidar caché de datos para forzar refresco real
        globalCacheAllData = null;
        try { localStorage.removeItem(CACHE_KEY_ALL_DATA); } catch(e) {}

        const idSocio = document.getElementById('gestionSocioId').value;
        if (idSocio) cargarHistorialSocio(idSocio);
    } catch(e) {
        showToast('Error al actualizar', 'error');
    } finally {
        toggleLoader(false);
    }
}

function reiniciarAnticipos() {
    const id = document.getElementById('gestionSocioId').value;
    if(!id) return showToast('Selecciona un socio primero', 'error');
    document.getElementById('modalReinicioMes').style.display = 'block';
}

async function ejecutarReinicioMes() {
    document.getElementById('modalReinicioMes').style.display = 'none';
    toggleLoader(true, 'Archivando anticipos...');
    try {
        const hoy = new Date();
        const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
        const mesNombre = MESES[hoy.getMonth()];
        const anio = hoy.getFullYear();
        const tabNombre = `Anticipos_${mesNombre}_${anio}`;
        await callApiSocios('reiniciarAnticipos', { tabNombre });
        showToast('✅ Anticipos archivados en ' + tabNombre, 'success');
        const idSocio = document.getElementById('gestionSocioId').value;
        if(idSocio) cargarHistorialSocio(idSocio);
    } catch(e) {
        showToast('Error al reiniciar', 'error');
    } finally {
        toggleLoader(false);
    }
}

function abrirModalReiniciarAusencias() {
    document.getElementById('modalReiniciarAusencias').style.display = 'block';
}

async function ejecutarReiniciarAusencias() {
    document.getElementById('modalReiniciarAusencias').style.display = 'none';
    toggleLoader(true, 'Archivando ausencias...');
    try {
        const hoy = new Date();
        const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
        const tabNombre = `Ausencias_${MESES[hoy.getMonth()]}_${hoy.getFullYear()}`;
        await callApiSocios('reiniciarExtras', { tabNombre });
        showToast('✅ Ausencias archivadas en ' + tabNombre, 'success');
        logAccion('Reiniciar Ausencias', `Archivado en ${tabNombre}`);
        const idSocio = document.getElementById('gestionSocioId').value;
        if(idSocio) cargarHistorialSocio(idSocio);
    } catch(e) {
        showToast('Error al reiniciar ausencias. Verifica que el backend tenga la acción reiniciarExtras.', 'error');
    } finally {
        toggleLoader(false);
    }
}

async function cerrarMesSocio() {
    const id = document.getElementById('gestionSocioId').value;
    const nombre = document.getElementById('gestionSocioNombre').value;
    const remanente = parseInt(document.getElementById('gestionSocioRemanente').value) || 0;
    if (!id) return showToast('Selecciona un socio primero', 'error');

    const aPagarEl = document.getElementById('socioAPagar');
    const aPagar = aPagarEl ? parseInt((aPagarEl.innerText || '').replace(/[^0-9]/g, '')) || 0 : 0;
    const fmtM = v => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v);
    const signo = remanente >= 0 ? '+' : '';

    if (!confirm(`¿Cerrar mes para ${nombre}?\n\n💵 A Pagar: ${fmtM(aPagar)}\n🔄 Remanente: ${signo}${fmtM(remanente)}\n\nSe generará el recibo automáticamente.`)) return;

    toggleLoader(true, 'Cerrando mes...');
    try {
        await callApiSocios('registrarSaldoAnterior', { id, nombre, monto: remanente });
        // Preguntar si cobró en este momento (antes de imprimir)
        const cobraAhora = confirm(`¿${nombre} está cobrando ahora?\n\n✅ Aceptar → 💵 Cobrado\n❌ Cancelar → 📩 Queda en sobre`);
        cierresMes_registrar(id, nombre, aPagar, remanente, cobraAhora ? 'cobrado' : 'en_sobre');
        cierresMes_render();
        document.getElementById('gestionSocioSaldoAnt').value = remanente;
        cargarHistorialSocio(id);
        showToast(`✅ Mes cerrado · ${cobraAhora ? '💵 Cobrado' : '📩 En sobre'} · A Pagar: ${fmtM(aPagar)} · Rem: ${signo}${fmtM(remanente)}`, 'success');
        if (typeof recalcularRemanentes === 'function') recalcularRemanentes();
        await imprimirReciboSocio();
    } catch(e) {
        showToast('Error al cerrar mes', 'error');
    } finally {
        toggleLoader(false);
    }
}

// ── Estado de Cobros del Período ─────────────────────────────
let _cierreMesFiltro = '';
function cierresMes_getClave() {
    try { const { inicio, fin } = aq_calcularPeriodoActual(); return `cierresMes_${inicio}_${fin}`; }
    catch { return 'cierresMes_fallback'; }
}

function cierresMes_obtener() {
    try { return JSON.parse(localStorage.getItem(cierresMes_getClave()) || '[]'); } catch { return []; }
}

function cierresMes_registrar(id, nombre, aPagar, remanente, estadoCobro = 'en_sobre') {
    const lista = cierresMes_obtener();
    const idx = lista.findIndex(c => c.id === id);
    const entry = { id, nombre, aPagar, remanente, fechaCierre: new Date().toISOString(), estadoCobro };
    if (idx >= 0) lista[idx] = entry; else lista.push(entry);
    localStorage.setItem(cierresMes_getClave(), JSON.stringify(lista));
}

function cierresMes_actualizarEstado(id, estadoCobro) {
    const lista = cierresMes_obtener();
    const idx = lista.findIndex(c => c.id === id);
    if (idx < 0) return;
    lista[idx].estadoCobro = estadoCobro;
    localStorage.setItem(cierresMes_getClave(), JSON.stringify(lista));
    cierresMes_render();
}

function toggleCierreMes() {
    const body = document.getElementById('cierreMesBody');
    const icon = document.getElementById('cierreMesIcon');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (icon) icon.textContent = open ? '▼' : '▲';
    if (open) _cierreMesFiltro = ''; // limpiar filtro al cerrar
    if (!open) cierresMes_render();
}

function cierresMes_render(refocusBuscador = false) {
    const badge = document.getElementById('cierreMesBadge');
    const body = document.getElementById('cierreMesBody');
    if (!badge) return;

    const cerrados = cierresMes_obtener();
    const cerradosIds = new Set(cerrados.map(c => c.id));
    const total = cacheSocios.length;
    const nCerrados = cacheSocios.filter(s => cerradosIds.has(s.id)).length;
    const nPendientes = total - nCerrados;
    const nCobrados = cerrados.filter(c => c.estadoCobro === 'cobrado').length;
    const nEnSobre = cerrados.filter(c => c.estadoCobro !== 'cobrado').length;
    const allClosed = nCerrados === total && total > 0;

    badge.textContent = `${nCerrados}/${total} · 💵${nCobrados} 📩${nEnSobre}`;
    badge.style.background = allClosed ? '#16a34a' : (nCerrados > 0 ? '#f59e0b' : '#dc2626');

    if (!body || body.style.display === 'none') return;

    const fmtM = v => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v||0);
    let pendientesHtml = '', sobreHtml = '', cobradosHtml = '';
    const filtro = (_cierreMesFiltro || '').toLowerCase().trim();

    const sociosFiltrados = filtro
        ? cacheSocios.filter(s => `${s.nombre} ${s.apellido}`.toLowerCase().includes(filtro))
        : cacheSocios;

    sociosFiltrados.forEach(s => {
        const c = cerrados.find(x => x.id === s.id);
        if (!c) {
            pendientesHtml += `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #fef2f2;background:white;">
                <span style="font-size:1.05em;">⏳</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:0.83em;color:#991b1b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.nombre} ${s.apellido}</div>
                    <div style="font-size:0.7em;color:#374151;font-weight:600;">${s.area} · Pendiente</div>
                </div>
                <button onclick="cierresMes_ejecutarCierreSocio('${s.id}')" style="background:#dc2626;color:white;border:none;border-radius:6px;padding:5px 10px;font-size:0.75em;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">🔒 Cerrar</button>
            </div>`;
        } else {
            const fecha = new Date(c.fechaCierre).toLocaleDateString('es-CL', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
            const esCobrado = c.estadoCobro === 'cobrado';
            const row = `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid ${esCobrado?'#f0fdf4':'#fef9c3'};background:white;">
                <span style="font-size:1.05em;">${esCobrado?'💵':'📩'}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:0.83em;color:${esCobrado?'#15803d':'#92400e'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.nombre} ${s.apellido}</div>
                    <div style="font-size:0.7em;color:#374151;font-weight:600;">${s.area} · ${fecha}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;margin-right:6px;">
                    <div style="font-weight:800;color:${esCobrado?'#15803d':'#92400e'};font-size:0.82em;">${fmtM(c.aPagar)}</div>
                    <div style="color:#374151;font-size:0.7em;">rem: ${fmtM(c.remanente)}</div>
                </div>
                <button onclick="cierresMes_actualizarEstado('${s.id}','${esCobrado?'en_sobre':'cobrado'}')"
                    title="${esCobrado?'Pasar a en sobre':'Marcar como cobrado'}"
                    style="background:${esCobrado?'#fef3c7':'#dcfce7'};color:${esCobrado?'#92400e':'#15803d'};border:1px solid ${esCobrado?'#fde68a':'#bbf7d0'};border-radius:6px;padding:4px 8px;font-size:0.72em;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">
                    ${esCobrado?'📩':'💵'}
                </button>
            </div>`;
            if (esCobrado) cobradosHtml += row; else sobreHtml += row;
        }
    });

    const nPendientesFiltro = sociosFiltrados.filter(s => !cerradosIds.has(s.id)).length;
    const nSobreFiltro   = sociosFiltrados.filter(s => { const c = cerrados.find(x=>x.id===s.id); return c && c.estadoCobro !== 'cobrado'; }).length;
    const nCobradosFiltro = sociosFiltrados.filter(s => { const c = cerrados.find(x=>x.id===s.id); return c && c.estadoCobro === 'cobrado'; }).length;

    body.innerHTML = `
        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
            <div style="flex:1;min-width:60px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;text-align:center;">
                <div style="font-size:1.5em;font-weight:900;color:#dc2626;">${nPendientes}</div>
                <div style="font-size:0.68em;text-transform:uppercase;font-weight:700;color:#991b1b;letter-spacing:0.04em;">⏳ Pendiente</div>
            </div>
            <div style="flex:1;min-width:60px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;text-align:center;">
                <div style="font-size:1.5em;font-weight:900;color:#b45309;">${nEnSobre}</div>
                <div style="font-size:0.68em;text-transform:uppercase;font-weight:700;color:#92400e;letter-spacing:0.04em;">📩 En Sobre</div>
            </div>
            <div style="flex:1;min-width:60px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;text-align:center;">
                <div style="font-size:1.5em;font-weight:900;color:#16a34a;">${nCobrados}</div>
                <div style="font-size:0.68em;text-transform:uppercase;font-weight:700;color:#15803d;letter-spacing:0.04em;">💵 Cobrado</div>
            </div>
            <div style="flex:1;min-width:60px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px;text-align:center;">
                <div style="font-size:1.5em;font-weight:900;color:#1d4ed8;">${total}</div>
                <div style="font-size:0.68em;text-transform:uppercase;font-weight:700;color:#1e40af;letter-spacing:0.04em;">Total</div>
            </div>
        </div>
        <div style="position:relative;margin-bottom:12px;">
            <input id="cierreMesBuscador" type="text" placeholder="🔍 Buscar por nombre..." value="${_cierreMesFiltro.replace(/"/g,'&quot;')}"
                oninput="_cierreMesFiltro=this.value;cierresMes_render(true);"
                style="width:100%;box-sizing:border-box;padding:8px 32px 8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:0.87em;outline:none;">
            ${_cierreMesFiltro ? `<button onclick="_cierreMesFiltro='';cierresMes_render(true);" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:1em;line-height:1;">✕</button>` : ''}
        </div>
        ${!filtro ? `<button onclick="cierresMes_finalizarPeriodo()" style="width:100%;background:${allClosed?'linear-gradient(135deg,#8e44ad,#6c3483)':'linear-gradient(135deg,#d97706,#b45309)'};color:white;border:none;border-radius:8px;padding:10px;font-weight:800;font-size:0.87em;cursor:pointer;margin-bottom:12px;">${allClosed?'🏁 Todos cerrados — Archivar y Empezar Nuevo Mes':'📦 Archivar anticipos y empezar nuevo mes'}${nPendientes > 0 ? ' ⚠️ ('+nPendientes+' pendientes)' : ''}</button>` : ''}
        ${!pendientesHtml && !sobreHtml && !cobradosHtml && filtro ? `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">Sin resultados para "${_cierreMesFiltro}"</div>` : ''}
        ${pendientesHtml ? `<div style="font-weight:700;font-size:0.77em;color:#991b1b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">⏳ Pendientes (${nPendientesFiltro})</div><div style="border-radius:8px;overflow:hidden;border:1px solid #fecaca;margin-bottom:12px;">${pendientesHtml}</div>` : ''}
        ${sobreHtml ? `<div style="font-weight:700;font-size:0.77em;color:#92400e;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">📩 En Sobre (${nSobreFiltro})</div><div style="border-radius:8px;overflow:hidden;border:1px solid #fde68a;margin-bottom:12px;">${sobreHtml}</div>` : ''}
        ${cobradosHtml ? `<div style="font-weight:700;font-size:0.77em;color:#15803d;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">💵 Cobrados (${nCobradosFiltro})</div><div style="border-radius:8px;overflow:hidden;border:1px solid #bbf7d0;margin-bottom:12px;">${cobradosHtml}</div>` : ''}
        <div style="margin-top:10px;text-align:right;">
            <button onclick="if(confirm('¿Reiniciar el seguimiento local? Los datos en Google Sheets no se borran.')){localStorage.removeItem(cierresMes_getClave());cierresMes_render();}" style="background:none;border:1px solid #cbd5e1;border-radius:6px;padding:3px 10px;font-size:0.73em;color:#64748b;cursor:pointer;">↺ Reiniciar seguimiento</button>
        </div>`;

    if (refocusBuscador) {
        requestAnimationFrame(() => {
            const inp = document.getElementById('cierreMesBuscador');
            if (inp) { inp.focus(); const len = inp.value.length; inp.setSelectionRange(len, len); }
        });
    }
}

async function cierresMes_ejecutarCierreSocio(socioId) {
    const socio = cacheSocios.find(s => s.id === socioId);
    if (!socio) return showToast('Socio no encontrado', 'error');
    const fmtM = v => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v||0);

    if (!confirm(`¿Cerrar mes para ${socio.nombre} ${socio.apellido}?\n\nSe calculará el monto, se guardará en Sheets y se generará el recibo.`)) return;

    toggleLoader(true, `Cerrando mes de ${socio.nombre}...`);
    try {
        const response = await fetch(`${URL_SOCIOS}?action=getDatosSocio&socioId=${socio.id}`);
        const res = await response.json();
        let remanente = 0, aPagar = 0;

        if (res.status === 'success') {
            const data = res.data || {};
            const saldoAnterior = Number(data.saldoAnterior || 0);
            let sumaPedido = 0;
            if (data.anticipos) data.anticipos.forEach(a => { sumaPedido += Number(a.cantidad || a.monto || 0); });

            const fechasAusencia = new Set();
            if (data.extras) data.extras.forEach(e => {
                if (e.tipo && e.tipo.toLowerCase().includes('ausencia')) {
                    let f = e.fecha; if (f.includes('T')) f = f.split('T')[0]; fechasAusencia.add(f);
                }
            });

            let alcance = 0;
            if (socio.contrato === 'Part-Time') {
                (globalDiasPT[socio.id] || []).forEach(d => { if (!fechasAusencia.has(d) && globalMapaPuntosDia[d]) alcance += globalMapaPuntosDia[d]; });
                alcance *= socio.puntos;
            } else {
                for (const [dia, valor] of Object.entries(globalMapaPuntosDia)) { if (!fechasAusencia.has(dia)) alcance += valor; }
                alcance *= socio.puntos;
            }
            const saldoReal = alcance + saldoAnterior - sumaPedido;
            aPagar = saldoReal > 0 ? Math.floor(saldoReal / 1000) * 1000 : 0;
            remanente = Math.round(saldoReal - aPagar);
        }

        await callApiSocios('registrarSaldoAnterior', { id: socio.id, nombre: `${socio.nombre} ${socio.apellido}`, monto: remanente });
        const cobraAhora = confirm(`¿${socio.nombre} está cobrando ahora?\n\n✅ Aceptar → 💵 Cobrado\n❌ Cancelar → 📩 Queda en sobre`);
        cierresMes_registrar(socio.id, `${socio.nombre} ${socio.apellido}`, aPagar, remanente, cobraAhora ? 'cobrado' : 'en_sobre');
        cierresMes_render();
        showToast(`✅ ${socio.nombre} — ${cobraAhora ? '💵 Cobrado' : '📩 En sobre'} · A Pagar: ${fmtM(aPagar)} · Rem: ${fmtM(remanente)}`, 'success');
        const idActivo = document.getElementById('gestionSocioId').value;
        if (idActivo === socio.id) { document.getElementById('gestionSocioSaldoAnt').value = remanente; cargarHistorialSocio(socio.id); }
    } catch(e) {
        showToast(`Error al cerrar mes de ${socio.nombre}`, 'error');
    } finally {
        toggleLoader(false);
    }
}

async function cierresMes_finalizarPeriodo() {
    const hoy = new Date();
    const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const tabNombre = `Anticipos_${MESES[hoy.getMonth()]}_${hoy.getFullYear()}`;
    if (!confirm(`¿Archivar TODOS los anticipos del período?\n\nSe moverán a la pestaña "${tabNombre}" y se borrarán de la hoja activa y de Supabase.\n\n⚠️ Esta acción no se puede deshacer.\n\n✅ Hazlo cuando ya hayas cobrado a todos o quieras limpiar y empezar el mes nuevo.`)) return;
    toggleLoader(true, 'Archivando anticipos...');
    try {
        await callApiSocios('reiniciarAnticipos', { tabNombre });
        showToast('✅ Anticipos archivados en ' + tabNombre, 'success');
        logAccion('Finalizar Período', `Archivado en ${tabNombre}`);
        localStorage.removeItem(cierresMes_getClave());
        cierresMes_render();
        const idActivo = document.getElementById('gestionSocioId').value;
        if (idActivo) cargarHistorialSocio(idActivo);
    } catch(e) {
        showToast('Error al archivar anticipos', 'error');
    } finally {
        toggleLoader(false);
    }
}

async function cerrarMesTodos() {
    if (cacheSocios.length === 0) return showToast('No hay socios cargados', 'error');

    const modal = document.getElementById('modalCierreTodos');
    const resultado = document.getElementById('cierreTodosResultado');
    const progreso = document.getElementById('cierreTodosProgreso');
    const btn = document.getElementById('btnConfirmarCierreTodos');

    progreso.style.display = 'none';
    btn.disabled = false;
    btn.textContent = '✅ Confirmar y Ejecutar';

    let previHtml = '<table style="width:100%; font-size:0.85em; border-collapse:collapse;">';
    previHtml += '<thead><tr style="background:#f0f2f5;"><th style="padding:6px 8px; text-align:left;">Socio</th><th style="padding:6px 8px; text-align:right;">Remanente</th></tr></thead><tbody>';

    cacheSocios.forEach(socio => {
        previHtml += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:5px 8px;">${socio.nombre} ${socio.apellido} <span style="font-size:0.75em; color:#7f8c8d;">(${socio.contrato})</span></td>
            <td style="padding:5px 8px; text-align:right; color:#8e44ad; font-weight:bold;">Se calculará al ejecutar</td>
        </tr>`;
    });
    previHtml += '</tbody></table>';
    previHtml += '<p style="color:#e67e22; font-size:0.78em; margin-top:10px; text-align:center;">⚠️ Los remanentes exactos se calculan al confirmar, ya que requieren datos del servidor (anticipos reales).</p>';
    resultado.innerHTML = previHtml;
    modal.style.display = 'block';
}

async function ejecutarCierreTodos() {
    const btn = document.getElementById('btnConfirmarCierreTodos');
    const progreso = document.getElementById('cierreTodosProgreso');
    const bar = document.getElementById('cierreTodosBar');
    const status = document.getElementById('cierreTodosStatus');
    const resultado = document.getElementById('cierreTodosResultado');

    btn.disabled = true;
    btn.textContent = '⏳ Procesando...';
    progreso.style.display = 'block';

    const total = cacheSocios.length;
    let procesados = 0, exitosos = 0, errores = 0;
    let resumenHtml = '<table style="width:100%; font-size:0.82em; border-collapse:collapse;">';
    resumenHtml += '<thead><tr style="background:#f0f2f5;"><th style="padding:6px 8px; text-align:left;">Socio</th><th style="padding:6px 8px; text-align:right;">A Pagar</th><th style="padding:6px 8px; text-align:right;">Remanente</th><th style="padding:6px 8px; text-align:center;">Estado</th></tr></thead><tbody>';

    for (const socio of cacheSocios) {
        status.textContent = `Procesando: ${socio.nombre} ${socio.apellido} (${procesados + 1}/${total})`;
        bar.style.width = `${Math.round(((procesados) / total) * 100)}%`;

        try {
            const response = await fetch(`${URL_SOCIOS}?action=getDatosSocio&socioId=${socio.id}`);
            const res = await response.json();

            let remanente = 0, aPagar = 0, saldoReal = 0;

            if (res.status === 'success') {
                const data = res.data || {};
                const saldoAnterior = Number(data.saldoAnterior || 0);
                let sumaPedido = 0;

                if (data.anticipos && Array.isArray(data.anticipos)) {
                    data.anticipos.forEach(a => { sumaPedido += Number(a.cantidad || a.monto || 0); });
                }

                const fechasAusencia = new Set();
                if (data.extras) {
                    data.extras.forEach(e => {
                        if (e.tipo && e.tipo.toLowerCase().includes('ausencia')) {
                            let f = e.fecha; if (f.includes('T')) f = f.split('T')[0]; fechasAusencia.add(f);
                        }
                    });
                }

                let alcance = 0;
                if (socio.contrato === 'Part-Time') {
                    const dias = globalDiasPT[socio.id] || [];
                    dias.forEach(d => { if (!fechasAusencia.has(d) && globalMapaPuntosDia[d]) alcance += globalMapaPuntosDia[d]; });
                    alcance *= socio.puntos;
                } else {
                    for (const [dia, valor] of Object.entries(globalMapaPuntosDia)) {
                        if (!fechasAusencia.has(dia)) alcance += valor;
                    }
                    alcance *= socio.puntos;
                }

                saldoReal = alcance + saldoAnterior - sumaPedido;
                aPagar = saldoReal > 0 ? Math.floor(saldoReal / 1000) * 1000 : 0;
                remanente = saldoReal > 0 ? Math.round(saldoReal - aPagar) : Math.round(saldoReal);
            }

            await callApiSocios('registrarSaldoAnterior', {
                id: socio.id,
                nombre: `${socio.nombre} ${socio.apellido}`,
                monto: remanente
            });

            exitosos++;
            const colorRem = remanente < 0 ? '#e74c3c' : '#8e44ad';
            resumenHtml += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:5px 8px;">${socio.nombre} ${socio.apellido}</td>
                <td style="padding:5px 8px; text-align:right; color:#27ae60; font-weight:bold;">${formatearMoneda(aPagar)}</td>
                <td style="padding:5px 8px; text-align:right; color:${colorRem}; font-weight:bold;">${formatearMoneda(remanente)}</td>
                <td style="padding:5px 8px; text-align:center;">✅</td>
            </tr>`;

        } catch (e) {
            errores++;
            resumenHtml += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:5px 8px;">${socio.nombre} ${socio.apellido}</td>
                <td colspan="2" style="padding:5px 8px; color:#e74c3c; text-align:center;">Error al procesar</td>
                <td style="padding:5px 8px; text-align:center;">❌</td>
            </tr>`;
        }

        procesados++;
    }

    bar.style.width = '100%';
    resumenHtml += '</tbody></table>';
    resultado.innerHTML = resumenHtml;
    status.textContent = `✅ Completado: ${exitosos} exitosos, ${errores} con error.`;

    btn.textContent = '✅ Completado';
    showToast(`Cierre completado: ${exitosos}/${total} socios procesados`, exitosos === total ? 'success' : 'error');

    // Guardar flag para que los escalamientos sepan que el cierre ya fue ejecutado
    if (exitosos > 0) {
        localStorage.setItem('fondo_cierre_todos_' + calcularPeriodoClave(), '1');

        // Archivar y limpiar anticipos del período cerrado
        try {
            const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
            const ahora = new Date();
            const tabNombre = `Anticipos_${MESES[ahora.getMonth()]}_${ahora.getFullYear()}`;
            status.textContent = 'Archivando anticipos del período...';
            await callApiSocios('reiniciarAnticipos', { tabNombre });
            showToast(`Anticipos archivados en ${tabNombre}`, 'success');
        } catch(e) {
            showToast('Remanentes guardados pero error al archivar anticipos. Usa "Reinicio Mes" manualmente.', 'error');
        }
    }

    const idActivo = document.getElementById('gestionSocioId').value;
    if (idActivo) cargarHistorialSocio(idActivo);
    if (typeof recalcularRemanentes === 'function') recalcularRemanentes();
}

async function gestion_cargarTotalAnticipos() {
    const el = document.getElementById('gestionTotalAnticipos');
    if (!el) return;
    el.textContent = '...';
    try {
        const allData = await fetchAllDataCached();
        const total = aq_filtrarAnticiposPeriodo(allData.anticipos || {});
        el.textContent = formatearMoneda(total);
    } catch(e) {
        el.textContent = 'Error';
    }
}

async function gestion_cargarTotalRemanentes() {
    const el = document.getElementById('gestionTotalRemanentes');
    const elPer = document.getElementById('gestionPeriodoRemanentes');
    const elAnt = document.getElementById('gestionRemAnteriores');
    if (!el) return;
    try {
        const res = await fetch(`${URL_SOCIOS}?action=getTotalRemanentes`).then(r => r.json());
        const total = res.total !== undefined ? Number(res.total) : null;
        if (total === null) { el.textContent = 'N/D'; return; }
        el.textContent = formatearMoneda(total);
        el.style.color = total < 0 ? '#fca5a5' : '#e9d5ff';
        if (elAnt && res.periodoAnterior) {
            const pa = res.periodoAnterior;
            const totalAnt = Number(pa.datos?.total || 0);
            const label = (pa.periodo || '').replace(/_/g, ' ').toLowerCase();
            elAnt.innerHTML = `<span style="opacity:0.7;">Período ant. (${label}):</span> <strong style="color:${totalAnt < 0 ? '#fca5a5' : '#c4b5fd'};">${formatearMoneda(totalAnt)}</strong>`;
            elAnt.style.display = '';
        }
    } catch(e) {
        el.textContent = 'Error';
    }
}

// Formatea el período (dos ISO) a algo legible: "15 jun – 14 jul 2026"
function _remFmtPeriodo(inicioISO, finISO) {
    const p = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const fmt = dt => dt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');
    const a = p(inicioISO), b = p(finISO);
    return `${fmt(a)} – ${fmt(b)} ${b.getFullYear()}`;
}

// Remanente EN VIVO: suma de lo que le quedaría a cada socio si se cerrara hoy.
// Cambia día a día con las nuevas recaudaciones (usa el mismo cálculo del detalle).
async function gestion_cargarRemanenteVivo() {
    const el = document.getElementById('gestionRemanenteVivo');
    const elPer = document.getElementById('gestionPeriodoRemanentes');
    if (!el) return;
    el.textContent = '...';
    try {
        const [allData, saldosRes] = await Promise.all([
            fetchAllDataCached(),
            (typeof dbSoc !== 'undefined' ? dbSoc.from('saldos_socio').select('id, monto') : Promise.resolve({ data: [] }))
        ]);
        const saldos = {};
        (saldosRes.data || []).forEach(r => { saldos[r.id] = Number(r.monto || 0); });
        const { inicio, fin } = aq_calcularPeriodoActual();
        if (elPer) elPer.innerHTML = '📅 Período actual: <b>' + _remFmtPeriodo(inicio, fin) + '</b>';

        const antObj = allData.anticipos || {};
        const extObj = allData.extras || {};
        let totalRem = 0;
        const remPorArea = {}; // key(lowercase) -> { label, total }

        (cacheSocios || []).forEach(socio => {
            const pts = Number(socio.puntos) || 0;
            // Anticipos del período
            let sumaAnt = 0; const vistos = new Set();
            (antObj[socio.id] || []).forEach(a => {
                const m = parseFloat(a.cantidad) || 0; if (!m) return;
                let f = a.fecha || ''; if (f.includes('T')) f = f.split('T')[0];
                if (f < inicio || f > fin) return;
                const firma = f + '|' + m; if (vistos.has(firma)) return; vistos.add(firma);
                sumaAnt += m;
            });
            // Ausencias
            const aus = new Set();
            (extObj[socio.id] || []).forEach(e => {
                if (e.tipo && e.tipo.toLowerCase().includes('ausencia')) {
                    let f = e.fecha || ''; if (f.includes('T')) f = f.split('T')[0]; aus.add(f);
                }
            });
            // Alcance (según contrato)
            let alcance = 0;
            if (socio.contrato === 'Part-Time') {
                (globalDiasPT[socio.id] || []).forEach(d => { if (!aus.has(d) && globalMapaPuntosDia[d]) alcance += globalMapaPuntosDia[d]; });
            } else {
                for (const [dia, valor] of Object.entries(globalMapaPuntosDia)) { if (!aus.has(dia) && valor) alcance += valor; }
            }
            alcance *= pts;
            const saldoAnterior = saldos[socio.id] || 0;
            const saldoReal = alcance + saldoAnterior - sumaAnt;
            const rem = saldoReal > 0 ? Math.round(saldoReal - Math.floor(saldoReal / 1000) * 1000) : Math.round(saldoReal);
            totalRem += rem;
            // Acumular por área (fusionando por may/minúsculas)
            const areaRaw = (socio.area || 'Sin área').trim();
            const key = areaRaw.toLowerCase();
            if (!remPorArea[key]) remPorArea[key] = { label: areaRaw, total: 0 };
            remPorArea[key].total += rem;
        });

        el.textContent = formatearMoneda(totalRem);
        el.style.color = totalRem < 0 ? '#fca5a5' : '#a7f3d0';

        // Desglose por área (en vivo)
        const elAreas = document.getElementById('gestionRemVivoAreas');
        if (elAreas) {
            const arr = Object.values(remPorArea).sort((a, b) => b.total - a.total);
            elAreas.innerHTML = arr.map(a =>
                `<span style="background:rgba(255,255,255,0.12); border-radius:12px; padding:2px 9px; font-size:0.78em; color:#f3e8ff;">${_htmlEscSoc ? _htmlEscSoc(a.label) : a.label}: <strong style="color:${a.total < 0 ? '#fca5a5' : '#a7f3d0'};">${formatearMoneda(a.total)}</strong></span>`
            ).join('');
        }
    } catch (e) {
        el.textContent = 'Error';
    }
}

function seleccionarSocio(id) {
    const socio = cacheSocios.find(s => s.id === id);
    if (!socio) return;
    document.getElementById('panelDetalle').style.display = 'block';
    document.getElementById('mensajeSeleccion').style.display = 'none';
    document.getElementById('gestionSocioId').value = socio.id;
    document.getElementById('gestionSocioNombre').value = `${socio.nombre} ${socio.apellido}`;
    document.getElementById('gestionSocioPuntos').value = socio.puntos;

    document.getElementById('detNombre').textContent = `${socio.nombre} ${socio.apellido}`;
    document.getElementById('detContrato').textContent = socio.contrato;
    document.getElementById('detArea').textContent = "Área: " + (socio.area || '').toUpperCase();
    if (typeof gest_renderRut === 'function') gest_renderRut(socio);
    if (typeof gest_renderFoto === 'function') gest_renderFoto(socio);
    document.getElementById('detPuntos').textContent = socio.puntos;
    document.getElementById('cardAusencias').style.display = (socio.contrato === 'Planta') ? 'block' : 'none';

    const cardDias = document.getElementById('cardDiasTrabajados');
    if(socio.contrato === 'Part-Time') { cardDias.style.display = 'block'; document.getElementById('socioDiasCount').innerText = '...'; }
    else { cardDias.style.display = 'none'; }

    const skEl = '<div class="sk sk-line" style="width:70%;height:14px;margin:4px auto"></div>';
    document.getElementById('socioSaldoAnterior').innerHTML = skEl;
    document.getElementById('socioAlcance').innerHTML = skEl;
    document.getElementById('socioTotalPedido').innerHTML = skEl;
    document.getElementById('socioSaldoReal').innerHTML = skEl;
    document.getElementById('socioAPagar').innerHTML = skEl;
    document.getElementById('socioRemanente').innerHTML = skEl;
    _actualizarValorPunto(socio);

    document.querySelectorAll('.result-item').forEach(el => el.classList.remove('seleccionado'));
    const itemSeleccionado = document.querySelector(`.result-item[data-socio-id="${id}"]`);
    if(itemSeleccionado) itemSeleccionado.classList.add('seleccionado');

    setTimeout(() => { document.getElementById('panelDetalle').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);

    document.querySelectorAll('.btn-motivo').forEach(b => b.classList.remove('activo'));
    document.getElementById('motivoAusencia').value = '';
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaAnticipo').value = hoy;
    document.getElementById('fechaAusencia').value = hoy;
    document.getElementById('montoAnticipo').value = '';

    responsables_poblarSelector();
    cargarHistorialSocio(id);
}

function _actualizarValorPunto(socio) {
    const el = document.getElementById('socioValorPunto');
    if (!el || !socio) return;
    const hayDatos = globalMapaPuntosDia && Object.values(globalMapaPuntosDia).some(v => v !== null && v > 0);
    if (!hayDatos) { el.textContent = '—'; return; }
    let valorPunto = 0;
    if (socio.contrato === 'Part-Time') {
        (globalDiasPT[socio.id] || []).forEach(d => { if (globalMapaPuntosDia[d]) valorPunto += globalMapaPuntosDia[d]; });
    } else {
        valorPunto = globalValorPuntoTotal;
    }
    el.textContent = valorPunto > 0
        ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(valorPunto))
        : '—';
}

// ══════════════════════════════════════════════════════════════════
// DESGLOSE DE BILLETES + BOUCHER DE ANTICIPO
// ══════════════════════════════════════════════════════════════════
let _dsgData = null; // datos del anticipo pendiente de confirmar con desglose

function abrirDesgloseAnticipo({ id, nombre, fecha, monto, respIni, respArea, montoVis, fechaVis, campoMonto }) {
    _dsgData = { id, nombre, fecha, monto, respIni, respArea, campoMonto };

    const modal = document.getElementById('modalDesgloseAnticipo');
    document.getElementById('dsg-socio-info').innerHTML =
        '<b>' + nombre + '</b><br>' +
        '<span style="font-size:1.2em;color:#2563eb;">' + montoVis + '</span>' +
        '<span style="font-size:0.85em;color:#6b7280;"> · ' + fechaVis + '</span>';

    // Construir inputs por denominación
    const fmt = n => new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP', maximumFractionDigits:0}).format(n);
    let html = '';
    AQ_DENOMINACIONES.forEach(d => {
        html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dotted #e5e7eb;">
            <span style="flex:1;font-weight:700;font-size:0.9em;color:#374151;">${fmt(d)}</span>
            <input type="number" id="dsg-bil-${d}" min="0" placeholder="0"
                   oninput="actualizarTotalDesglose()"
                   onkeydown="dsgNavegar(event,${d})"
                   style="width:64px;text-align:center;padding:6px 4px;border:1px solid #d1d5db;border-radius:6px;font-size:1em;font-weight:700;">
            <span id="dsg-sub-${d}" style="width:90px;text-align:right;font-size:0.85em;color:#6b7280;">$0</span>
        </div>`;
    });
    document.getElementById('dsg-billetes-grid').innerHTML = html;
    document.getElementById('dsg-total-val').textContent = '$0';
    const difEl = document.getElementById('dsg-diferencia');
    difEl.textContent = 'Ingresa billetes — debe totalizar ' + montoVis;
    difEl.style.color = '#6b7280';
    difEl.style.background = '';
    const btn = document.getElementById('btnConfirmarDesglose');
    btn.disabled = true;
    btn.style.opacity = '0.5';

    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('dsg-bil-20000')?.focus(), 120);
}

function dsgNavegar(e, denActual) {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    e.preventDefault();
    const idx = AQ_DENOMINACIONES.indexOf(denActual);
    const siguiente = AQ_DENOMINACIONES[idx + 1];
    if (siguiente) document.getElementById('dsg-bil-' + siguiente)?.focus();
    else document.getElementById('btnConfirmarDesglose')?.focus();
}

function actualizarTotalDesglose() {
    if (!_dsgData) return;
    const fmt = n => new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP', maximumFractionDigits:0}).format(n);
    let total = 0;
    AQ_DENOMINACIONES.forEach(d => {
        const cant = Math.max(0, parseInt(document.getElementById('dsg-bil-' + d)?.value || 0) || 0);
        const sub = cant * d;
        total += sub;
        const subEl = document.getElementById('dsg-sub-' + d);
        if (subEl) subEl.textContent = cant > 0 ? fmt(sub) : '$0';
    });
    const monto = _dsgData.monto;
    const dif = total - monto;
    document.getElementById('dsg-total-val').textContent = fmt(total);
    const difEl = document.getElementById('dsg-diferencia');
    const btn  = document.getElementById('btnConfirmarDesglose');
    if (dif === 0) {
        difEl.textContent = '✅ Monto exacto — listo para registrar';
        difEl.style.color = '#059669';
        difEl.style.background = '#f0fdf4';
        btn.disabled = false;
        btn.style.opacity = '1';
    } else if (dif > 0) {
        difEl.textContent = '⚠️ Excede en ' + fmt(dif);
        difEl.style.color = '#dc2626';
        difEl.style.background = '#fef2f2';
        btn.disabled = true;
        btn.style.opacity = '0.5';
    } else {
        difEl.textContent = '💰 Faltan ' + fmt(Math.abs(dif));
        difEl.style.color = '#d97706';
        difEl.style.background = '#fffbeb';
        btn.disabled = true;
        btn.style.opacity = '0.5';
    }
}

function cancelarDesgloseAnticipo() {
    _dsgData = null;
    document.getElementById('modalDesgloseAnticipo').style.display = 'none';
}

async function confirmarDesgloseAnticipo() {
    if (!_dsgData) return;
    const { id, nombre, fecha, monto, respIni, respArea, campoMonto } = _dsgData;

    // Recolectar billetes entregados
    const billetes = {};
    AQ_DENOMINACIONES.forEach(d => {
        const cant = Math.max(0, parseInt(document.getElementById('dsg-bil-' + d)?.value || 0) || 0);
        if (cant > 0) billetes[d] = cant;
    });

    cancelarDesgloseAnticipo();

    // Generar folio único aquí para usarlo en boucher y en Supabase
    const _ahoraFolio = new Date();
    const _padF = n => String(n).padStart(2, '0');
    const folio = 'ATC-' + _ahoraFolio.getFullYear() + _padF(_ahoraFolio.getMonth()+1) + _padF(_ahoraFolio.getDate())
        + '-' + _padF(_ahoraFolio.getHours()) + _padF(_ahoraFolio.getMinutes()) + _padF(_ahoraFolio.getSeconds())
        + '-' + (respIni||'SYS').replace(/[^A-Za-z0-9]/g,'');

    // Registrar billetes como retiro en el conteo de caja (arqueo)
    if (typeof aq_aplicarBilletesAnticipo === 'function') aq_aplicarBilletesAnticipo(billetes);

    if (campoMonto) campoMonto.classList.add('input-ok');
    toggleLoader(true);
    try {
        await callApiSocios('registrarBatchAnticipos', {
            detalleAnticipos: [{ id, nombre, fecha, monto, responsable: respIni, areaResponsable: respArea }]
        });
        // Guardar desglose de billetes en Supabase (tabla retiros_anticipos)
        try {
            await fetch(AQ_URL_POST, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'registrarRetiroAnticipo',
                    firma: folio,
                    nombre,
                    socio_id: id,
                    monto,
                    fecha,
                    billetes,
                    responsable: respIni + (respArea ? ' ' + respArea : '')
                })
            });
        } catch(e2) { console.warn('[DSG] Error guardando desglose:', e2.message); }

        showToast('✅ Anticipo registrado — generando boucher...', 'success');
        globalCacheAllData = null;
        try { localStorage.removeItem(CACHE_KEY_ALL_DATA); } catch(e) {}
        if (campoMonto) {
            campoMonto.value = '';
            campoMonto.classList.remove('input-ok');
        }
        const fechaInput = document.getElementById('fechaAnticipo');
        if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];
        if (campoMonto) campoMonto.focus();
        cargarHistorialSocio(id);
        if (typeof aq_fetchAnticipos === 'function') aq_fetchAnticipos(true);
        if (typeof recalcularAnticipos === 'function') recalcularAnticipos();
        generarBoucherAnticipo({ id, nombre, fecha, monto, respIni, respArea, billetes, folio });
        if (typeof dsg_onNuevoAnticipo === 'function') dsg_onNuevoAnticipo({ firma: folio, socio_nombre: nombre, socio_id: id, monto, fecha, billetes, responsable: respIni + (respArea ? ' ' + respArea : ''), created_at: new Date().toISOString() });
        // Si este anticipo procesa una solicitud de egreso pendiente, marcarla
        if (typeof egresos_alRegistrarAnticipo === 'function') egresos_alRegistrarAnticipo(id, respIni + (respArea ? ' ' + respArea : ''));
    } catch(e) {
        if (campoMonto) campoMonto.classList.remove('input-ok');
        showToast('Error al registrar anticipo', 'error');
    } finally { toggleLoader(false); }
}

function generarBoucherAnticipo({ id, nombre, fecha, monto, respIni, respArea, billetes, folio: folioParam }) {
    const fmt = v => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v);
    const ahora = new Date();
    const _pad  = n => String(n).padStart(2, '0');

    const fp = fecha.split('-');
    const fechaVis = fp[2] + '/' + fp[1] + '/' + fp[0];
    const horaHoy  = _pad(ahora.getHours()) + ':' + _pad(ahora.getMinutes());

    // Usar folio recibido (generado antes de guardar) o generar uno nuevo como fallback
    const folio = folioParam || ('ATC-' + ahora.getFullYear() + _pad(ahora.getMonth()+1) + _pad(ahora.getDate())
                + '-' + _pad(ahora.getHours()) + _pad(ahora.getMinutes()) + _pad(ahora.getSeconds())
                + '-' + (respIni||'SYS').replace(/[^A-Za-z0-9]/g,''));

    const respVis = respIni + (respArea ? ' / ' + respArea : '');

    let filas = '';
    Object.entries(billetes).sort((a,b) => Number(b[0]) - Number(a[0])).forEach(([den, cant], i) => {
        if (!cant) return;
        const sub = Number(den) * cant;
        const bg  = i % 2 === 0 ? '#f0faf0' : 'white';
        filas += '<tr style="background:' + bg + '">'
            + '<td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-weight:700;">' + fmt(Number(den)) + '</td>'
            + '<td style="padding:4px 8px;border:1px solid #ccc;text-align:center;">' + cant + '</td>'
            + '<td style="padding:4px 8px;border:1px solid #ccc;text-align:right;font-weight:700;">' + fmt(sub) + '</td>'
            + '</tr>';
    });

    const opcion = window.confirm('¿Cómo imprimir?\n\nOK → Una copia\nCancelar → Dos copias (corte manual)');

    function bloqueAnticipo(etiqueta) {
        return '<div class="copy-label">' + etiqueta + '</div>'
            + '<div class="folio-badge">N° FOLIO: ' + folio + '</div>'
            + '<div class="header"><h1>FONDO DE SOLIDARIDAD</h1><p>CASINO DE PTO. VARAS</p><p>LEY 17312 DEL 29/07/70</p><p><strong>PUERTO VARAS</strong></p></div>'
            + '<div class="section-title">' + nombre.toUpperCase() + '</div>'
            + '<div style="text-align:center;font-size:9px;color:#888;margin-bottom:2px;">ID Socio: ' + id + '</div>'
            + '<div style="text-align:center;font-size:9px;color:#888;margin-bottom:8px;">' + fechaVis + ' ' + horaHoy + '</div>'
            + '<table><thead><tr><th>BILLETE</th><th>CANTIDAD</th><th style="text-align:right">SUBTOTAL</th></tr></thead><tbody>' + filas + '</tbody></table>'
            + '<div style="border-top:2px solid #000;margin-top:8px;padding-top:6px;display:flex;justify-content:space-between;font-size:13px;font-weight:900;">'
            + '<span>TOTAL FINAL</span><span style="color:#d35400;">' + fmt(monto) + '</span></div>'
            + '<div style="margin-top:12px;font-size:9px;line-height:1.4;"><strong>Responsable:</strong> ' + respVis + '</div>'
            + '<div style="text-align:center;font-family:monospace;font-size:7px;color:#aaa;margin-top:3px;">FOLIO: ' + folio + '</div>'
            + '<div class="footer">Emitido: ' + fechaVis + ' ' + horaHoy + ' | Sistema Fondo Solidario</div>';
    }

    const htmlBase = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>' + nombre + '</title><style>'
        + '*{margin:0;padding:0;box-sizing:border-box;}'
        + 'body{font-family:Arial,sans-serif;font-size:11px;}'
        + '.page{width:80mm;margin:0 auto;padding:8px;}'
        + '.header{text-align:center;border:2px solid #000;padding:8px;margin-bottom:10px;}'
        + '.header h1{font-size:13px;font-weight:bold;}'
        + 'table{width:100%;border-collapse:collapse;margin:4px 0;}'
        + 'th{background:#f0f0f0;padding:4px 8px;}'
        + '.section-title{text-align:center;font-weight:bold;font-size:12px;margin-bottom:6px;}'
        + '.copy-label{text-align:center;font-size:9px;font-weight:bold;background:#000;color:white;padding:3px;margin-bottom:8px;letter-spacing:2px;}'
        + '.folio-badge{text-align:center;font-size:8px;font-family:monospace;background:#f4f6f7;border:1px dashed #aaa;padding:3px 6px;margin-bottom:6px;letter-spacing:0.5px;border-radius:3px;}'
        + '.cut{border-top:2px dashed #000;margin:16px 0;text-align:center;font-size:9px;color:#aaa;padding-top:4px;}'
        + '.footer{text-align:center;font-size:8px;color:#888;border-top:1px dashed #ccc;padding-top:5px;margin-top:6px;}'
        + '</style></head><body><div class="page">';

    let contenido;
    if (opcion) {
        contenido = htmlBase + bloqueAnticipo('★ ANTICIPO — ' + nombre.toUpperCase() + ' ★') + '</div></body></html>';
    } else {
        contenido = htmlBase
            + bloqueAnticipo('★ COPIA SOCIO ★')
            + '<div class="cut">✂ &nbsp; CORTAR AQUÍ &nbsp; ✂</div>'
            + bloqueAnticipo('★ COPIA ADMINISTRACIÓN ★')
            + '</div></body></html>';
    }

    printHTML(contenido, 'Anticipo ' + nombre + ' ' + fechaVis.replace(/\//g,'-'));
}
