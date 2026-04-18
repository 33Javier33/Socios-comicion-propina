// ============================================================
// ANTICIPOS, AUSENCIAS, GESTIÓN DE SOCIOS Y CIERRE DE MES
// ============================================================

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

async function cargarHistorialSocio(id) {
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
            if(data.extras && Array.isArray(data.extras)) {
                data.extras.forEach(e => {
                    procesarEntrada(e.fecha, (e.tipo || 'Extra').toUpperCase(), e.detalle, 0, e.uuid);
                });
            }

            const listaFinal = Object.values(agrupados);
            listaFinal.forEach(item => { sumaTotalPedido += item.montoTotal; });

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

            const elSaldoReal = document.getElementById('socioSaldoReal');
            elSaldoReal.innerText = formatearMoneda(saldoReal);
            elSaldoReal.style.color = saldoReal < 0 ? 'var(--danger)' : 'var(--primary)';

            document.getElementById('socioAPagar').innerText = formatearMoneda(aPagar);

            const elRem = document.getElementById('socioRemanente');
            elRem.innerText = formatearMoneda(remanente);
            elRem.style.color = remanente < 0 ? 'var(--danger)' : '#8e44ad';

            if(listaFinal.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#7f8c8d; padding:20px;">No hay movimientos registrados.</td></tr>'; return; }
            listaFinal.sort((a,b) => b.rawDate - a.rawDate);

            listaFinal.forEach(item => {
                const row = document.createElement('tr');
                row.classList.add('row-deletable');

                let pressTimer;
                row.addEventListener('mousedown', () => { pressTimer = setTimeout(() => mostrarModalBorrar(item), 800); });
                row.addEventListener('touchstart', () => { pressTimer = setTimeout(() => mostrarModalBorrar(item), 800); }, {passive:true});
                row.addEventListener('mouseup', () => clearTimeout(pressTimer));
                row.addEventListener('touchend', () => clearTimeout(pressTimer));
                row.addEventListener('mouseleave', () => clearTimeout(pressTimer));

                let fechaVis = item.fecha;
                if(fechaVis.includes('-')) { const f = fechaVis.split('-'); if(f.length === 3) fechaVis = `${f[2]}/${f[1]}/${f[0]}`; }
                const tiposArr = Array.from(item.tipos);
                const esAnticipo = tiposArr.includes('Anticipo');
                let tipoHtml = tiposArr.includes('AUSENCIA') ? '<span class="tag-absent">AUSENCIA</span>' : `<span style="font-weight:bold; color:#7f8c8d;">${tiposArr.join(' + ')}</span>`;
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

    campoMonto.classList.add('input-ok');
    toggleLoader(true);
    try {
        await callApiSocios('registrarBatchAnticipos', { detalleAnticipos: [{ id, nombre, fecha, monto: parseInt(monto), responsable: respIni, areaResponsable: respArea }] });
        showToast('✅ Anticipo registrado correctamente', 'success');
        // Invalidar caché para que próxima consulta traiga datos frescos
        globalCacheAllData = null;
        try { localStorage.removeItem(CACHE_KEY_ALL_DATA); } catch(e) {}
        campoMonto.value = '';
        campoMonto.classList.remove('input-ok');
        document.getElementById('fechaAnticipo').value = new Date().toISOString().split('T')[0];
        campoMonto.focus();
        cargarHistorialSocio(id);
    } catch(e) {
        campoMonto.classList.remove('input-ok');
        showToast('Error al registrar anticipo', 'error');
    } finally { toggleLoader(false); }
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
    toggleLoader(true);
    try {
        await callApiSocios('registrarBatchExtras', { detalleExtras: [{ id, nombre, fecha, tipo: 'ausencia', monto: 0, detalle: `Ausencia: ${motivo}` }] });
        showToast('✅ Ausencia registrada correctamente', 'success');
        campoMotivo.value = '';
        document.getElementById('fechaAusencia').value = new Date().toISOString().split('T')[0];
        document.querySelectorAll('.btn-motivo').forEach(b => b.classList.remove('activo'));
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
}

function mostrarModalBorrar(item) {
    document.getElementById('modalConfirmarBorrar').style.display = 'block';
    document.getElementById('txtDetalleBorrar').innerText = `¿Borrar registro del ${item.fecha} (${Array.from(item.tipos).join(',')})?`;
    document.getElementById('borrarUUID').value = item.uuid;
    document.getElementById('borrarTipo').value = item.montoTotal > 0 ? 'Anticipo' : 'Extra';
}

async function borrarItemConfirmado() {
    const uuid = document.getElementById('borrarUUID').value;
    const tipo = document.getElementById('borrarTipo').value;
    if(!uuid) return alert("No se puede borrar (Falta ID)");

    toggleLoader(true, "Eliminando...");
    document.getElementById('modalConfirmarBorrar').style.display='none';

    try {
        await callApiSocios('borrarMovimiento', { uuid: uuid, tipo: tipo });
        showToast('Eliminado correctamente', 'success');
        const idSocio = document.getElementById('gestionSocioId').value;
        cargarHistorialSocio(idSocio);
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

async function cerrarMesSocio() {
    const id = document.getElementById('gestionSocioId').value;
    const nombre = document.getElementById('gestionSocioNombre').value;
    const remanente = parseInt(document.getElementById('gestionSocioRemanente').value) || 0;

    if (!id) return showToast('Selecciona un socio primero', 'error');

    const signo = remanente >= 0 ? '+' : '';
    const msg = `¿Cerrar mes para ${nombre}?\n\nRemanente a traspasar: ${signo}${new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(remanente)}\n\nEste monto quedará como saldo del próximo mes.`;

    if (!confirm(msg)) return;

    toggleLoader(true, 'Cerrando mes...');
    try {
        await callApiSocios('registrarSaldoAnterior', { id, nombre, monto: remanente });
        showToast(`✅ Mes cerrado. Remanente ${new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(remanente)} guardado como saldo anterior.`, 'success');
        document.getElementById('gestionSocioSaldoAnt').value = remanente;
        cargarHistorialSocio(id);
    } catch(e) {
        showToast('Error al cerrar mes', 'error');
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

    const idActivo = document.getElementById('gestionSocioId').value;
    if (idActivo) cargarHistorialSocio(idActivo);
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
