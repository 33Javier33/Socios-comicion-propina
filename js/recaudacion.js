// ============================================================
// RECAUDACIÓN: CARGA, PROCESADO Y FILTROS
// ============================================================

async function cargarRecaudaciones(silent = false) {
    if(!URL_RECAUDACIONES || URL_RECAUDACIONES.includes("PEGA_AQUI")) return;

    const cached = leerCache(CACHE_KEY_REC);
    if (cached) {
        procesarDatosRecaudacion(cached, silent);
        if (silent) return;
        fetch(`${URL_RECAUDACIONES}?action=get&t=${new Date().getTime()}`)
            .then(r => r.json())
            .then(result => {
                if(result.status === 'success') {
                    guardarCache(CACHE_KEY_REC, result.data || []);
                    procesarDatosRecaudacion(result.data || [], false);
                }
            }).catch(() => {});
        return;
    }

    try {
        const response = await fetch(`${URL_RECAUDACIONES}?action=get&t=${new Date().getTime()}`);
        const result = await response.json();
        if(result.status !== 'success') throw new Error(result.message || "Error al cargar");
        guardarCache(CACHE_KEY_REC, result.data || []);
        procesarDatosRecaudacion(result.data || [], silent);
    } catch (error) { console.error(error); if(!silent) showToast("Error al obtener datos", "error"); }
}

function procesarDatosRecaudacion(datos, silent) {
    recDatosRaw = datos;
    const grupos = {};
    let granTotal = 0;

    globalValorPuntoTotal = 0;
    globalMapaPuntosDia = {};

    datos.forEach(item => {
        let fecha = item.fecha; if (!fecha) return;
        if(fecha.includes('T')) fecha = fecha.split('T')[0];

        if (!grupos[fecha]) grupos[fecha] = { fecha: fecha, divisor: null, totalDia: 0, tipos: {} };

        const monto = parseFloat(item.monto) || 0;
        grupos[fecha].totalDia += monto;
        granTotal += monto;

        let tipo = item.tipo || 'Sin Tipo';
        if (tipo === 'Mesas') tipo = 'SalaDeJuegos';

        if (!grupos[fecha].tipos[tipo]) grupos[fecha].tipos[tipo] = 0;
        grupos[fecha].tipos[tipo] += monto;

        if (item.divisor) {
            let strDivisor = String(item.divisor).replace(',', '.');
            let valDivisor = parseFloat(strDivisor);
            if (valDivisor > 1) { grupos[fecha].divisor = grupos[fecha].divisor === null ? valDivisor : Math.max(grupos[fecha].divisor, valDivisor); }
        }
    });

    const fechasOrdenadas = Object.keys(grupos).sort((a,b) => new Date(b) - new Date(a));

    let sumaPuntosGlobal = 0;
    fechasOrdenadas.forEach(fecha => {
        const dia = grupos[fecha];
        if (dia.divisor === null) { globalMapaPuntosDia[fecha] = null; return; }
        const divisor = parseFloat(dia.divisor);
        const puntoNoche = dia.totalDia / divisor;
        globalMapaPuntosDia[fecha] = puntoNoche;
        sumaPuntosGlobal += puntoNoche;
    });
    globalValorPuntoTotal = sumaPuntosGlobal;

    if(silent) return;

    (document.getElementById('recGranTotal')||{}).innerText = formatearMoneda(granTotal);

    const ultimaFechaReal = fechasOrdenadas[0];

    if (ultimaFechaReal && grupos[ultimaFechaReal]) {
        const ultDia = grupos[ultimaFechaReal];
        const partes = ultimaFechaReal.split('-');

        (document.getElementById('recTotalUltimoDia')||{}).innerText = formatearMoneda(ultDia.totalDia);
        (document.getElementById('recFechaUltimoDia')||{}).innerText = `${partes[2]}/${partes[1]}/${partes[0]}`;
        (document.getElementById('recDivisorActual')||{}).innerText = ultDia.divisor !== null ? ultDia.divisor : 'Sin divisor';
    }

    const container = document.getElementById('contenedorFechas'); container.innerHTML = '';
    if (fechasOrdenadas.length === 0) { container.innerHTML = '<div style="text-align:center; color:#7f8c8d; padding:20px;">No hay registros.</div>'; } else {
        fechasOrdenadas.forEach(fecha => {
            const dia = grupos[fecha];
            const partes = fecha.split('-');
            const fechaVisual = `${partes[2]}/${partes[1]}/${partes[0]}`;
            const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
            const fechaObj = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
            const nombreDia = DIAS_SEMANA[fechaObj.getDay()];
            const divisor = parseFloat(dia.divisor) || 1;
            const puntoNoche = dia.totalDia / divisor;
            let tiposHtml = '';

            const ordenCategorias = ['SalaDeJuegos', 'EfectivoMDA', 'TarjetaMDA', 'Boveda'];
            const categoriasPresentes = Object.keys(dia.tipos).sort((a,b) => {
                return (ordenCategorias.indexOf(a) === -1 ? 99 : ordenCategorias.indexOf(a)) - (ordenCategorias.indexOf(b) === -1 ? 99 : ordenCategorias.indexOf(b));
            });

            categoriasPresentes.forEach(nombreTipo => {
                const valorTipo = dia.tipos[nombreTipo];
                const reg = recDatosRaw.find(r => {
                    let f = r.fecha; if(f && f.includes('T')) f = f.split('T')[0];
                    let tBuscado = nombreTipo; if(tBuscado==='SalaDeJuegos') tBuscado='Mesas';
                    return f === fecha && (r.tipo === tBuscado || r.tipo === nombreTipo);
                });
                const idx = reg !== undefined ? reg.originalIndex : 'null';
                tiposHtml += `<div class="type-item" data-tipo="${nombreTipo}">`
                    + `<span class="type-name">${nombreTipo}</span>`
                    + `<span class="type-value">${formatearMoneda(valorTipo)}</span>`
                    + `<div style="display:flex;gap:3px;margin-left:auto;">`
                    + `<button onclick="rec_abrirEditar('${fecha}','${nombreTipo}',${valorTipo},${idx})" style="background:none;border:1px solid var(--secondary);color:var(--secondary);border-radius:5px;padding:2px 7px;cursor:pointer;font-size:0.78em;">✏️</button>`
                    + `<button onclick="rec_borrarFila(${idx},'${nombreTipo}','${fecha}')" style="background:none;border:1px solid var(--danger);color:var(--danger);border-radius:5px;padding:2px 7px;cursor:pointer;font-size:0.78em;">🗑️</button>`
                    + `</div></div>`;
            });

            const card = document.createElement('div');
            card.className = 'date-card';
            card.setAttribute('data-search', `${fechaVisual} ${dia.totalDia} ${Object.keys(dia.tipos).join(' ')} ${nombreDia}`);
            card.setAttribute('data-tipos', Object.keys(dia.tipos).join(','));
            card.setAttribute('data-divisor', dia.divisor !== null ? 'si' : 'no');
            card.innerHTML = `
                <div class="date-header">
                    <div>
                        <div class="date-title"><span style="font-size:0.7em;font-weight:700;color:white;background:var(--secondary);padding:2px 8px;border-radius:10px;margin-right:6px;">${nombreDia}</span>📅 ${fechaVisual}</div>
                        <div style="margin-top:4px;"><span class="date-point-badge">Punto Noche: ${formatearMoneda(puntoNoche)}</span></div>
                    </div>
                    <div class="date-total"><small style="display:block;font-size:0.6em;color:#7f8c8d;font-weight:normal;">RECAUDADO</small>${formatearMoneda(dia.totalDia)}</div>
                </div>
                <div class="type-grid">${tiposHtml}</div>
                <div style="background:#f8fafc;border-top:1px solid #eee;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:0.78em;font-weight:700;color:#7f8c8d;">Divisor:</span>
                        <input type="number" step="0.01" min="0.01" value="${dia.divisor}"
                            style="width:72px;padding:5px 6px;border:2px solid var(--secondary);border-radius:7px;font-weight:800;text-align:center;font-size:0.9em;"
                            onchange="rec_actualizarDivisor('${fecha}', this.value)">
                        <span style="font-size:0.78em;color:var(--success);font-weight:700;">${formatearMoneda(puntoNoche)} / pto</span>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button onclick="rec_abrirAgregar('${fecha}')" style="background:var(--success);color:white;border:none;border-radius:7px;padding:6px 11px;font-size:0.8em;font-weight:700;cursor:pointer;">➕ Agregar</button>
                        <button onclick="rec_copiarReporte('${fecha}')" style="background:#607d8b;color:white;border:none;border-radius:7px;padding:6px 11px;font-size:0.8em;font-weight:700;cursor:pointer;">📋 Copiar</button>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    }
    const elTP = document.getElementById('recTotalPuntos'); if(elTP) elTP.innerText = formatearMoneda(sumaPuntosGlobal);
}

function rec_postRec(data) {
    return fetch(URL_RECAUDACIONES, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data)
    }).then(r => r.json());
}

function rec_abrirEditar(fecha, tipo, monto, idx) {
    document.getElementById('recModalTitulo').textContent = 'Editar Registro';
    document.getElementById('recBtnGuardar').dataset.modo = 'editar';
    document.getElementById('recEditIdx').value = (idx !== null && idx !== undefined) ? idx : '';
    document.getElementById('recEditFechaHidden').value = fecha;
    document.getElementById('recEditFechaInput').value = fecha;
    const sel = document.getElementById('recEditTipo');
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === tipo) { sel.selectedIndex = i; found = true; break; }
    }
    if (!found) {
        const opt = document.createElement('option');
        opt.value = tipo; opt.textContent = tipo;
        sel.appendChild(opt); sel.value = tipo;
    }
    document.getElementById('recEditMonto').value = new Intl.NumberFormat('es-CL').format(monto);
    document.getElementById('modalRecEditar').style.display = 'block';
}

function rec_abrirAgregar(fechaPredefinida) {
    const hoy = new Date().toISOString().split('T')[0];
    const fecha = fechaPredefinida || hoy;
    document.getElementById('recModalTitulo').textContent = 'Nuevo Registro';
    document.getElementById('recBtnGuardar').dataset.modo = 'agregar';
    document.getElementById('recEditIdx').value = '';
    document.getElementById('recEditFechaHidden').value = fecha;
    document.getElementById('recEditFechaInput').value = fecha;
    document.getElementById('recEditTipo').selectedIndex = 0;
    document.getElementById('recEditMonto').value = '';
    document.getElementById('modalRecEditar').style.display = 'block';
    setTimeout(() => document.getElementById('recEditMonto').focus(), 150);
}

async function rec_guardarCambio() {
    const modo  = document.getElementById('recBtnGuardar').dataset.modo;
    const idx   = document.getElementById('recEditIdx').value;
    let tipo  = document.getElementById('recEditTipo').value;
    const fecha = document.getElementById('recEditFechaInput').value;
    const raw   = document.getElementById('recEditMonto').value.replace(/\./g, '').replace(/,/g, '');
    const monto = parseInt(raw);
    if (!fecha || !monto || !tipo) return showToast('Completa todos los campos', 'error');

    if (tipo === 'SalaDeJuegos') tipo = 'Mesas';

    document.getElementById('modalRecEditar').style.display = 'none';
    toggleLoader(true, modo === 'editar' ? 'Actualizando...' : 'Guardando...');
    try {
        if (modo === 'editar' && idx !== '') {
            await rec_postRec({ action: 'update', sheetIndex: parseInt(idx), tipo, fecha, monto });
            showToast('Registro actualizado', 'success');
        } else {
            await rec_postRec({ action: 'add', tipo, fecha, monto });
            showToast('Registro agregado', 'success');
        }
        try { localStorage.removeItem(CACHE_KEY_REC); } catch(e) {}
        cargarRecaudaciones();
    } catch(e) {
        showToast('Error al guardar', 'error');
    } finally { toggleLoader(false); }
}

async function rec_borrarFila(idx, tipo, fecha) {
    if (idx === null || idx === undefined || String(idx) === 'null') {
        return showToast('No se puede identificar el registro', 'error');
    }
    const fechaVis = String(fecha).split('-').reverse().join('/');
    if (!confirm('Borrar "' + tipo + '" del ' + fechaVis + '?')) return;
    toggleLoader(true, 'Borrando...');
    try {
        await rec_postRec({ action: 'delete', index: parseInt(idx) });
        showToast('Registro eliminado', 'success');
        try { localStorage.removeItem(CACHE_KEY_REC); } catch(e) {}
        cargarRecaudaciones();
    } catch(e) {
        showToast('Error al borrar', 'error');
    } finally { toggleLoader(false); }
}

async function rec_actualizarDivisor(fecha, valor) {
    const val = parseFloat(String(valor).replace(',', '.'));
    if (!val || val <= 0) return showToast('Divisor invalido', 'error');
    toggleLoader(true, 'Guardando divisor...');
    try {
        await rec_postRec({ action: 'updateDivisor', fecha, divisor: val });
        showToast('Divisor actualizado', 'success');
        try { localStorage.removeItem(CACHE_KEY_REC); } catch(e) {}
        cargarRecaudaciones(true);
    } catch(e) {
        showToast('Error al guardar divisor', 'error');
    } finally { toggleLoader(false); }
}

function rec_copiarReporte(fecha) {
    const registros = recDatosRaw.filter(r => {
        let f = r.fecha;
        if (f && f.includes('T')) f = f.split('T')[0];
        return f === fecha;
    });
    if (!registros.length) return showToast('Sin datos para copiar', 'error');
    const total = registros.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const divReg = registros.find(r => parseFloat(r.divisor) > 0);
    const divisorDia = divReg ? parseFloat(divReg.divisor) : 1;
    const puntoNoche = total / divisorDia;
    const partes = fecha.split('-');
    const fechaVis = partes[2] + '/' + partes[1] + '/' + partes[0];
    let txt = 'REPORTE: ' + fechaVis + '\n' + '-'.repeat(28) + '\n';
    registros.forEach(r => {
        let t = r.tipo || 'Sin Tipo';
        if(t === 'Mesas') t = 'SalaDeJuegos';
        txt += '- ' + t + ': ' + formatearMoneda(r.monto) + '\n';
    });
    txt += '-'.repeat(28) + '\n';
    txt += 'TOTAL: ' + formatearMoneda(total) + '\n';
    txt += 'DIVISOR: ' + divisorDia + '\n';
    txt += 'PUNTO NOCHE: ' + formatearMoneda(puntoNoche);
    navigator.clipboard.writeText(txt)
        .then(() => showToast('Reporte copiado al portapapeles', 'success'))
        .catch(() => showToast('No se pudo copiar (sin permisos)', 'error'));
}

function filtrarRecaudacion() {
    const texto = (document.getElementById('filtroRecaudacion')||{}).value||'';
    const t = texto.toLowerCase().trim();
    const cards = document.querySelectorAll('.date-card');
    let visibles = 0;
    cards.forEach(card => {
        let ok = true;
        if (t) { const s=(card.getAttribute('data-search')||'').toLowerCase(); if(!s.includes(t)) ok=false; }
        if (ok && recFiltroSinDiv && card.getAttribute('data-divisor')!=='no') ok=false;
        if (ok && recFiltroConDiv && card.getAttribute('data-divisor')!=='si') ok=false;
        if (ok && recFiltroTipo) {
            const filas = card.querySelectorAll('.type-item');
            let hay=false;
            filas.forEach(f=>{
                const tf=(f.getAttribute('data-tipo')||'').toLowerCase();
                const fl=recFiltroTipo.toLowerCase();
                const match=tf===fl||(fl==='saladeJuegos'.toLowerCase()&&tf==='mesas')||(fl==='mesas'&&tf==='saladeJuegos'.toLowerCase());
                f.style.display=match?'':'none';
                if(match) hay=true;
            });
            if(!hay) ok=false;
        } else { card.querySelectorAll('.type-item').forEach(f=>f.style.display=''); }
        card.style.display=ok?'block':'none';
        if(ok) visibles++;
    });
    const info=document.getElementById('rec-filtro-info');
    if(info){ const total=cards.length; info.textContent=(visibles<total||recFiltroTipo||t)?'Mostrando '+visibles+' de '+total+' días'+(recFiltroTipo?' · Tipo: '+recFiltroTipo:''):''; }
}

function rec_setTipo(tipo,btn) { recFiltroTipo=tipo; document.querySelectorAll('.rec-filtro-chip[data-tipo]').forEach(b=>b.classList.remove('activo')); btn.classList.add('activo'); filtrarRecaudacion(); }
function rec_toggleSinDivisor(btn) { recFiltroSinDiv=!recFiltroSinDiv; recFiltroConDiv=false; btn.classList.toggle('activo-warn',recFiltroSinDiv); const c2=document.getElementById('chipConDivisor'); if(c2){c2.classList.remove('activo-ok','activo');} filtrarRecaudacion(); }
function rec_toggleConDivisor(btn) { recFiltroConDiv=!recFiltroConDiv; recFiltroSinDiv=false; btn.classList.toggle('activo-ok',recFiltroConDiv); const c2=document.getElementById('chipSinDivisor'); if(c2){c2.classList.remove('activo-warn','activo');} filtrarRecaudacion(); }
function rec_limpiarFiltros() { recFiltroTipo=''; recFiltroSinDiv=false; recFiltroConDiv=false; const inp=document.getElementById('filtroRecaudacion'); if(inp) inp.value=''; document.querySelectorAll('.rec-filtro-chip[data-tipo]').forEach(b=>b.classList.remove('activo')); const p=document.querySelector('.rec-filtro-chip[data-tipo=""]'); if(p) p.classList.add('activo'); const s=document.getElementById('chipSinDivisor'); const cv=document.getElementById('chipConDivisor'); if(s){s.classList.remove('activo-warn','activo');} if(cv){cv.classList.remove('activo-ok','activo');} document.querySelectorAll('.date-card').forEach(card=>{card.style.display='block'; card.querySelectorAll('.type-item').forEach(f=>f.style.display='');}); const info=document.getElementById('rec-filtro-info'); if(info) info.textContent=''; }
