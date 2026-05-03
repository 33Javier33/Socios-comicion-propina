// ============================================================
// INFORMES E IMPRESIÓN
// ============================================================

async function informeAnticipos() {
    if (!cacheSocios.length) return showToast('No hay socios cargados', 'error');
    toggleLoader(true, 'Generando informe...');
    try {
        const { inicio, fin } = aq_calcularPeriodoActual();
        const fmtF = iso => { const p = iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; };
        const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
        const MESES_ABR = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
        const hoyDate = new Date();
        const periodoStr = fmtF(inicio) + ' AL ' + fmtF(fin);

        // NOMBRE DE ARCHIVO DINÁMICO: Detalle Anticipos Mes DD-MM-AAAA.pdf
        const fechaHoyNom = hoyDate.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-');
        const mesNombreNom = MESES[hoyDate.getMonth()];
        const fileName = `Detalle Anticipos ${mesNombreNom} ${fechaHoyNom}`;

        const fechaHoyVis = hoyDate.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});
        const fmt = v => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v);

        // Usar caché global — una sola llamada si ya está en memoria
        const allData = await fetchAllDataCached();
        const todosAnticipos = allData.anticipos || {};

        const ordenAreas = ['mesas','mesasparttime','cambistas','maquinas','tecnicos','boveda','gastoscomision'];
        const resultOk = cacheSocios
            .map(s => ({ socio: s, data: { anticipos: todosAnticipos[s.id] || [] } }))
            .sort((a,b) => {
                const ia = ordenAreas.indexOf((a.socio.area||'').toLowerCase());
                const ib = ordenAreas.indexOf((b.socio.area||'').toLowerCase());
                return ((ia===-1?99:ia)-(ib===-1?99:ib)) || a.socio.nombre.localeCompare(b.socio.nombre);
            });

        const filas = [];
        let totalGeneral = 0, numero = 1;

        resultOk.forEach(({ socio, data }) => {
            const anticipos = (data.anticipos || []).filter(a => {
                let f = a.fecha || ''; if (f.includes('T')) f = f.split('T')[0];
                return f >= inicio && f <= fin;
            });
            if (!anticipos.length) return;
            const totalSocio = anticipos.reduce((s,a) => s + (Number(a.cantidad||a.monto)||0), 0);
            totalGeneral += totalSocio;
            anticipos.forEach((ant, idx) => {
                let f = ant.fecha || ''; if (f.includes('T')) f = f.split('T')[0];
                const fp = f.split('-');
                const fechaVis = fp.length===3 ? fp[2]+'/'+( MESES_ABR[parseInt(fp[1])-1]||fp[1])+'/'+fp[0] : f;
                const areaNom = (socio.area||'').slice(0,2).toUpperCase();
                const resp    = socio.contrato === 'Part-Time' ? 'P.T' : 'P.M';
                const responsable  = ant.responsable || '';
                const respArea    = ant.areaResponsable || '';
                filas.push({
                    n: idx===0 ? numero++ : '',
                    nombre: idx===0 ? (socio.nombre+' '+socio.apellido).toUpperCase() : '',
                    area: idx===0 ? areaNom : '',
                    resp,
                    fecha: fechaVis,
                    valor: Number(ant.cantidad||ant.monto)||0,
                    responsable, respArea,
                    totalSocio: idx===anticipos.length-1 ? totalSocio : null
                });
            });
        });

        if (!filas.length) { toggleLoader(false); return showToast('No hay anticipos en el período actual', 'error'); }

        // ── DOS COLUMNAS LADO A LADO (como el Excel) ─────────
        const mitad = Math.ceil(filas.length / 2);
        const col1  = filas.slice(0, mitad);
        const col2  = filas.slice(mitad);

        const ths = 'background:#2c3e50;color:white;padding:3px 4px;font-size:8px;border:1px solid #1a252f;text-align:center;';
        const thead2 = '<thead><tr>'
            + '<th style="'+ths+'width:18px;">N°</th>'
            + '<th style="'+ths+'text-align:left;min-width:80px;">NOMBRE</th>'
            + '<th style="'+ths+'width:24px;">ÁREA</th>'
            + '<th style="'+ths+'width:55px;">FECHA</th>'
            + '<th style="'+ths+'width:60px;text-align:right;">VALOR</th>'
            + '<th style="'+ths+'width:38px;">RESP.</th>'
            + '</tr></thead>';

        function buildCol2(rows) {
            var paleta = [
                { bg:'#ffffff', borde:'#ccc', txt:'#1a1a1a', totalBg:'#f0f0f0', totalTxt:'#c0392b' },
                { bg:'#e8f4fd', borde:'#aed6f1', txt:'#0d3a6e', totalBg:'#aed6f1', totalTxt:'#0d3a6e' },
            ];
            // Agrupar filas por socio para evitar cortes de página
            var grupos = [];
            var grupoActual = null;
            var colorIdx = 0;
            rows.forEach(function(f) {
                if (f.nombre && (!grupoActual || f.nombre !== grupoActual.nombre)) {
                    colorIdx = (colorIdx + 1) % paleta.length;
                    grupoActual = { nombre: f.nombre, col: paleta[colorIdx], filas: [] };
                    grupos.push(grupoActual);
                }
                if (grupoActual) grupoActual.filas.push(f);
            });
            // Cada grupo va en su propio <tbody> con page-break-inside:avoid
            return grupos.map(function(g) {
                var col = g.col;
                var filasHtml = g.filas.map(function(f) {
                    var isNombreRow = !!f.nombre;
                    var filaHtml = '<tr style="background:'+col.bg+'">'
                        + '<td style="padding:2px 4px;border:1px solid '+col.borde+';text-align:center;font-weight:bold;font-size:8px;color:'+col.txt+';">'+(f.n||'')+'</td>'
                        + '<td style="padding:2px 4px;border:1px solid '+col.borde+';font-size:8px;font-weight:'+(isNombreRow?'800':'400')+';color:'+col.txt+';">'+(f.nombre||'')+'</td>'
                        + '<td style="padding:2px 4px;border:1px solid '+col.borde+';text-align:center;font-size:8px;color:'+col.txt+';">'+f.area+'</td>'
                        + '<td style="padding:2px 4px;border:1px solid '+col.borde+';text-align:center;font-size:8px;color:'+col.txt+';">'+f.fecha+'</td>'
                        + '<td style="padding:2px 4px;border:1px solid '+col.borde+';text-align:right;font-weight:700;font-size:8px;color:'+col.txt+';">'+fmt(f.valor)+'</td>'
                        + '<td style="padding:2px 4px;border:1px solid '+col.borde+';text-align:center;font-size:7px;color:'+col.txt+';">'+(f.responsable ? f.responsable+(f.respArea ? ' '+f.respArea : '') : '')+'</td>'
                        + '</tr>';
                    // Fila de TOTAL al final del grupo
                    if (f.totalSocio !== null) {
                        filaHtml += '<tr style="background:'+col.totalBg+';">'
                            + '<td style="padding:2px 4px;border:1px solid '+col.borde+';font-size:8px;border-top:2px solid '+col.totalTxt+';" colspan="3"></td>'
                            + '<td style="padding:2px 4px;border:1px solid '+col.borde+';text-align:right;font-size:8px;font-weight:700;color:'+col.totalTxt+';border-top:2px solid '+col.totalTxt+';">TOTAL:</td>'
                            + '<td style="padding:2px 4px;border:1px solid '+col.borde+';text-align:right;font-weight:900;font-size:9px;color:'+col.totalTxt+';border-top:2px solid '+col.totalTxt+';">'+fmt(f.totalSocio)+'</td>'
                            + '<td style="padding:2px 4px;border:1px solid '+col.borde+';border-top:2px solid '+col.totalTxt+';"></td>'
                            + '</tr>';
                    }
                    return filaHtml;
                }).join('');
                // tbody con page-break-inside:avoid — no corta al imprimir
                return '<tbody style="page-break-inside:avoid;break-inside:avoid;">' + filasHtml + '</tbody>';
            }).join('');
        }

        var htmlInforme =
            '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
            + '<title>'+fileName+'</title>'
            + '<style>'
            + '* { margin:0; padding:0; box-sizing:border-box; }'
            + 'body { font-family:Arial,sans-serif; font-size:9px; color:#000; padding:10px; }'
            + 'h1 { font-size:13px; text-align:center; font-weight:900; letter-spacing:1px; margin-bottom:2px; }'
            + '.sub { text-align:center; font-size:9px; margin-bottom:5px; font-weight:600; }'
            + '.tothead { background:#c0392b; color:white; padding:5px 10px; font-size:11px; font-weight:900; display:flex; justify-content:space-between; margin-bottom:7px; border-radius:3px; }'
            + '.dos-cols { display:grid; grid-template-columns:1fr 1fr; gap:6px; }'
            + 'table { width:100%; border-collapse:collapse; }'
            + '.totfinal { background:#2c3e50; color:white; padding:4px 8px; font-weight:900; font-size:10px; text-align:right; margin-top:7px; border-radius:2px; }'
            + '.footer { text-align:center; font-size:8px; color:#aaa; margin-top:8px; border-top:1px dashed #ccc; padding-top:4px; }'
            + '@media print { @page { margin:8mm; size:A4 landscape; } body { padding:0; } tbody { page-break-inside:avoid; break-inside:avoid; } tr { page-break-inside:avoid; break-inside:avoid; } }'
            + '@media screen { body { background:#ddd; } .page { background:white; max-width:1050px; margin:0 auto; padding:14px; box-shadow:0 2px 12px rgba(0,0,0,0.2); } }'
            + '<\/style>'
            + '<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print();},400);}<\/scr'+'ipt>'
            + '</head><body><div class="page">'
            + '<h1>DETALLE DE ANTICIPOS</h1>'
            + '<div class="sub">FONDO DE SOLIDARIDAD &mdash; CASINO DE PUERTO VARAS &nbsp;|&nbsp; LEY 17312 DEL 29/07/70</div>'
            + '<div class="tothead"><span>TOTAL EGRESOS &mdash; PERÍODO '+periodoStr+'</span><span>'+fmt(totalGeneral)+'</span></div>'
            + '<div class="dos-cols">'
            + '<table>'+thead2+buildCol2(col1)+'</table>'
            + '<table>'+thead2+buildCol2(col2)+'</table>'
            + '</div>'
            + '<div class="totfinal">TOTAL GENERAL: '+fmt(totalGeneral)+'</div>'
            + '<div class="footer">Emitido: '+fechaHoyVis+' &nbsp;|&nbsp; Sistema Fondo Solidario &mdash; Casino de Puerto Varas</div>'
            + '</div></body></html>';


        printHTML(htmlInforme, fileName);

    } catch(e) { console.error(e); showToast('Error generando informe', 'error'); }
    finally { toggleLoader(false); }
}

// ============================================================
// INFORME MONTOS DIARIOS (ESTILO EXCEL - SIMILAR A FOTO)
// ============================================================
async function informeMontosDiarios() {
    if(!recDatosRaw || recDatosRaw.length === 0) return showToast("No hay datos de recaudación", "error");
    toggleLoader(true, "Generando informe montos...");

    try {
        const { inicio, fin } = aq_calcularPeriodoActual();
        const hoy = new Date();
        const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

        // NOMBRE DE ARCHIVO: Montos diarios mes DD-MM-YYYY.pdf
        const fechaHoyNom = hoy.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-');
        const mesNombreNom = MESES[hoy.getMonth()];
        const fileName = `Montos diarios ${mesNombreNom} ${fechaHoyNom}`;

        const fmt = v => new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(v || 0);

        // Generar array de días del período
        let diasArr = [];
        let dCurr = new Date(inicio + "T12:00:00");
        let dEnd = new Date(fin + "T12:00:00");
        while(dCurr <= dEnd) {
            diasArr.push(dCurr.toISOString().split('T')[0]);
            dCurr.setDate(dCurr.getDate() + 1);
        }

        let filasHtml = "";
        let sumSJ = 0, sumMDAE = 0, sumMDAT = 0, sumBov = 0, sumTotal = 0;
        let acumulado = 0;

        diasArr.forEach((fecha, idx) => {
            const registros = recDatosRaw.filter(r => {
                let f = r.fecha; if(f && f.includes('T')) f = f.split('T')[0];
                return f === fecha;
            });

            // MAPEADO: Mesas -> Sala de Juegos
            const sj   = registros.filter(r => (r.tipo === 'Mesas' || r.tipo === 'SalaDeJuegos')).reduce((a,b) => a + (parseFloat(b.monto)||0), 0);
            const mdae = registros.filter(r => (r.tipo === 'EfectivoMDA' || r.tipo === 'MDA (EFECTIVO)')).reduce((a,b) => a + (parseFloat(b.monto)||0), 0);
            const mdat = registros.filter(r => (r.tipo === 'TarjetaMDA' || r.tipo === 'MDA (TARJETA)')).reduce((a,b) => a + (parseFloat(b.monto)||0), 0);
            const bov  = registros.filter(r => r.tipo === 'Boveda').reduce((a,b) => a + (parseFloat(b.monto)||0), 0);

            const totalDia = sj + mdae + mdat + bov;
            acumulado += totalDia;

            sumSJ += sj; sumMDAE += mdae; sumMDAT += mdat; sumBov += bov; sumTotal += totalDia;

            const divisor = parseFloat(registros[0]?.divisor) || 1;
            const puntoNoche = totalDia / divisor;

            const dObj = new Date(fecha + "T12:00:00");
            const nomDia = dObj.toLocaleDateString('es-ES', {weekday:'short'}).toUpperCase();
            const numDia = dObj.getDate();

            filasHtml += `
                <tr>
                    <td style="border:1px solid #000; text-align:center; background:#f2f2f2; font-weight:bold; color:red;">${numDia}</td>
                    <td style="border:1px solid #000; text-align:center; background:#ffffcc;">${nomDia}</td>
                    <td style="border:1px solid #000; text-align:center;">${divisor > 1 ? fmt(divisor) : (registros[0]?.divisor || '-')}</td>
                    <td style="border:1px solid #000; text-align:right;">${fmt(sj)}</td>
                    <td style="border:1px solid #000; text-align:right;">${fmt(mdae)}</td>
                    <td style="border:1px solid #000; text-align:right;">${fmt(mdat)}</td>
                    <td style="border:1px solid #000; text-align:right;">${fmt(bov)}</td>
                    <td style="border:1px solid #000; text-align:right; font-weight:bold;">${totalDia > 0 ? fmt(totalDia) : '0'}</td>
                    <td style="border:1px solid #000; text-align:right;">${acumulado > 0 ? fmt(acumulado) : '0'}</td>
                    <td style="border:1px solid #000; text-align:right; background:#e2f0d9;">${puntoNoche > 0 ? fmt(puntoNoche) : '0'}</td>
                    <td style="border:1px solid #000; text-align:center; background:#f2f2f2;">${numDia}</td>
                </tr>`;
        });

        const promedio = sumTotal / diasArr.length;
        const periodoVis = inicio.split('-').reverse().join('/') + " AL " + fin.split('-').reverse().join('/');

        const html = `
        <html><head><title>${fileName}</title><style>
            body { font-family: Arial, sans-serif; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            th { border: 1px solid #000; background: #000; color: #fff; padding: 4px; font-size: 8px; }
            td { border: 1px solid #000; padding: 3px; }
            .header-box { background: #ffff00; border: 2px solid #000; display: inline-block; padding: 5px 30px; font-weight: bold; font-size: 11px; margin-bottom: 10px; }
            .promedio-box { border: 2px solid #000; text-align: center; float: right; width: 150px; }
            .promedio-title { background: #d9d9d9; padding: 2px 5px; border-bottom: 1px solid #000; font-weight: bold; font-size: 9px; }
            .promedio-val { padding: 5px; font-size: 16px; font-weight: bold; }
        </style></head><body>
            <!-- TÍTULO AÑADIDO AQUÍ -->
            <h2 style="text-align:center; font-size:18px; font-weight:bold; letter-spacing:2px; margin-bottom:15px; margin-top:0;">MONTOS DIARIOS</h2>

            <div style="overflow: hidden;">
                <div class="header-box">PERIODO ${periodoVis}</div>
                <div class="promedio-box">
                    <div class="promedio-title">PROMEDIO DIARIO</div>
                    <div class="promedio-val">${fmt(promedio)}</div>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>N°</th><th>Dia</th><th>Puntaje</th><th>Sala de Juegos</th><th>MDA (EFECTIVO)</th>
                        <th>MDA (TARJETA)</th><th>BOVEDA</th><th>Total</th><th>Acumulado</th><th>Punto Diario</th><th>Dia</th>
                    </tr>
                </thead>
                <tbody>${filasHtml}</tbody>
                <tfoot style="background: #ffffcc; font-weight: bold;">
                    <tr>
                        <td colspan="3" style="text-align:center;">Totales</td>
                        <td style="text-align:right;">${fmt(sumSJ)}</td>
                        <td style="text-align:right;">${fmt(sumMDAE)}</td>
                        <td style="text-align:right;">${fmt(sumMDAT)}</td>
                        <td style="text-align:right;">${fmt(sumBov)}</td>
                        <td style="text-align:right;">${fmt(sumTotal)}</td>
                        <td colspan="3"></td>
                    </tr>
                    <tr style="background: #000; color: #fff;">
                        <td colspan="3" style="text-align:center;">MDA TOTAL</td>
                        <td colspan="3" style="text-align:center; font-size:14px;">${fmt(sumMDAE + sumMDAT)}</td>
                        <td colspan="5"></td>
                    </tr>
                </tfoot>
            </table>
        </body></html>`;

        printHTML(html, fileName);

    } catch(e) { console.error(e); showToast("Error al generar reporte Excel", "error"); }
    finally { toggleLoader(false); }
}

// ============================================================
// IMPRIMIR RECIBO INDIVIDUAL (CON NOMBRE DINÁMICO)
// ============================================================
async function imprimirReciboSocio() {
    const id     = document.getElementById('gestionSocioId').value;
    const socio  = cacheSocios.find(s => s.id === id);
    if (!socio) return showToast('Selecciona un socio primero', 'error');

    const nombreSocio = `${socio.nombre} ${socio.apellido}`;
    const hoy = new Date();
    const fechaNom = hoy.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-');

    // NOMBRE DE ARCHIVO: Recibo Carlos Perez mes 26-03-2026.pdf
    const fileName = `Recibo ${nombreSocio} mes ${fechaNom}`;

    const puntos      = parseFloat(document.getElementById('gestionSocioPuntos').value || socio.puntos) || 0;
    const area        = (socio.area || '').toUpperCase();
    const contrato    = (socio.contrato || '').toUpperCase();
    const anioIngreso = socio.fechaIngreso ? socio.fechaIngreso.split('-')[0] : '-';
    const fipLabel    = (socio.fechaInicioPuntos && socio.fechaInicioPuntos !== socio.fechaIngreso)
                          ? socio.fechaInicioPuntos.split('-').reverse().join('/') : null;

    const saldoAnt    = document.getElementById('socioSaldoAnterior').innerText || '$0';
    const alcance     = document.getElementById('socioAlcance').innerText || '$0';
    const totalPedido = document.getElementById('socioTotalPedido').innerText || '$0';
    const saldoReal   = document.getElementById('socioSaldoReal').innerText || '$0';
    const aPagar      = document.getElementById('socioAPagar').innerText || '$0';
    const remanente   = document.getElementById('socioRemanente').innerText || '$0';

    // Si el socio tiene Término de Contrato, calcular valor punto solo para los días trabajados
    let valorPuntoNoche = globalValorPuntoTotal || 0;
    let fechaInicioTermino = null;
    if (globalTieneTerminoContrato && globalFechasAusenciaSocioActual.size > 0 && globalMapaPuntosDia) {
        let sumaAjustada = 0;
        for (const [dia, valor] of Object.entries(globalMapaPuntosDia)) {
            if (!globalFechasAusenciaSocioActual.has(dia) && valor !== null) sumaAjustada += valor;
        }
        valorPuntoNoche = sumaAjustada;
        // Obtener la fecha de inicio del congelamiento (primer día ausente por Término)
        fechaInicioTermino = Array.from(globalFechasAusenciaSocioActual).sort()[0] || null;
    }
    const valorPuntoFmt = formatearMoneda(Math.round(valorPuntoNoche));

    const { inicio, fin } = aq_calcularPeriodoActual();
    const fmtF = iso => { const p = iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; };
    const periodoStr = fmtF(inicio) + ' AL ' + fmtF(fin);
    const fechaHoyVis   = hoy.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});

    // Folio único: REC-AAAAMMDD-HHMMSS-INI
    const _resp = getSesionResponsableObj();
    const _pad  = n => String(n).padStart(2, '0');
    const folio = `REC-${hoy.getFullYear()}${_pad(hoy.getMonth()+1)}${_pad(hoy.getDate())}-${_pad(hoy.getHours())}${_pad(hoy.getMinutes())}${_pad(hoy.getSeconds())}-${(_resp.ini||'SYS').replace(/[^A-Za-z0-9]/g,'')}`;


    const filas = document.getElementById('tablaHistorial');
    let movHtml = '';
    let numAnt = 1;
    if (filas) {
        Array.from(filas.querySelectorAll('tr')).forEach(tr => {
            const td = tr.querySelectorAll('td');
            if (td.length < 4) return;
            const fechaRow = td[0].textContent.trim();
            const tipoRow  = td[1].textContent.trim();
            const detRaw   = td[2].textContent.trim();
            const detRow   = detRaw.replace(/\s*\(Resp:[^)]*\)/gi, '').replace(/\s*\(Enc:[^)]*\)/gi, '').trim();
            const spanMonto = td[3].querySelector('span.amount-minus');
            const montoRow  = spanMonto ? spanMonto.textContent.trim() : td[3].textContent.replace(/✏️/g, '').trim();
            const esAnticipo = tipoRow.toLowerCase().includes('anticipo');
            const esAusencia = tipoRow.toLowerCase().includes('ausencia');
            const color = esAusencia ? '#c0392b' : (esAnticipo ? '#2980b9' : '#555');

            movHtml +=
                '<tr>' +
                '<td style="padding:3px 5px;border-bottom:1px solid #eee;text-align:center;color:#aaa;font-size:9px;">' + (esAnticipo ? numAnt++ : '—') + '</td>' +
                '<td style="padding:3px 5px;border-bottom:1px solid #eee;color:' + color + ';font-weight:700;font-size:9px;">' + tipoRow + '</td>' +
                '<td style="padding:3px 5px;border-bottom:1px solid #eee;font-size:9px;">' + fechaRow + (detRow && detRow!=='-' ? '<br><span style=\'color:#999;font-size:8px;\'>' + detRow + '</span>' : '') + '</td>' +
                '<td style="padding:3px 5px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;font-size:9px;">' + montoRow + '</td>' +
                '</tr>';
        });
    }

    const maxPuntos = calcularPuntosMaximos(socio.area);
    let subePuntosLabel = "-";
    const fechaBase = (socio.fechaInicioPuntos && socio.fechaInicioPuntos !== socio.fechaIngreso) ? socio.fechaInicioPuntos : socio.fechaIngreso;
    const bp = fechaBase ? fechaBase.split('-') : null;
    if (bp && bp.length === 3) {
        const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
        subePuntosLabel = bp[2] + ' DE ' + MESES_CORTO[parseInt(bp[1]) - 1];
    }

    function bloqueRecibo(etiqueta) {
        return `
            <div class='copy-label'>${etiqueta}</div>
            <div class='folio-badge'>N° FOLIO: ${folio}</div>
            <div class='header'>
              <h1>FONDO DE SOLIDARIDAD</h1>
              <p>CASINO DE PTO. VARAS</p>
              <p>LEY 17312 DEL 29/07/70</p>
              <p><strong>PUERTO VARAS</strong></p>
            </div>
            <div class='section-title'>DATOS</div>
            <div class='row'><label>NOMBRE</label><strong>${nombreSocio.toUpperCase()}</strong></div>
            <div class='row'><label>ÁREA</label><span>${area}</span></div>
            <div class='row'><label>CONTRATO</label><span>${contrato}</span></div>
            <div class='row'><label>AÑO INGRESO</label><span>${anioIngreso}</span></div>
            ${fipLabel ? `<div class='row'><label>INICIO PUNTOS</label><span>${fipLabel}</span></div>` : ''}
            <div class='row'><label>PUNTOS</label><span>${puntos}</span></div>
            <div class='row'><label>SUBE PUNTOS</label><span>${subePuntosLabel}</span></div>
            <div class='divider'></div>
            <div class='section-title'>CIERRE PUNTO</div>
            <div class='row'><label>${fechaInicioTermino ? 'VALOR PUNTO (HASTA ' + fmtF(fechaInicioTermino.substring(0,10)) + ')' : 'VALOR PUNTO NOCHE'}</label><span>${valorPuntoFmt}</span></div>
            ${fechaInicioTermino ? `<div class='row' style='color:#dc2626;font-size:8px;'><label style='color:#dc2626;'>🔴 TÉRMINO CONTRATO DESDE</label><span style='font-weight:bold;color:#dc2626;'>${fmtF(fechaInicioTermino.substring(0,10))}</span></div>` : ''}
            <div class='divider'></div>
            <div class='section-title'>DETALLE</div>
            <div class='row'><label>BRUTO (Alcance)</label><span>${alcance}</span></div>
            <div class='row'><label>ANTICIPOS</label><span>${totalPedido}</span></div>
            <div class='row'><label>SALDO ANTERIOR</label><span>${saldoAnt}</span></div>
            <div class='row bold'><label>SALDO REAL</label><strong>${saldoReal}</strong></div>
            <div class='divider'></div>
            <div style='text-align:center;font-size:9px;font-weight:bold;margin-top:6px;letter-spacing:1px;'>TOTAL A COBRAR</div>
            <div class='row big'><span>$ ${aPagar}</span></div>
            <div class='row'><label>REMANENTE</label><span>${remanente}</span></div>
            <div class='divider'></div>
            <div class='section-title'>MOVIMIENTOS / RESPONSABLES</div>
            <table><thead><tr><th>#</th><th>Tipo</th><th>Detalle</th><th>Monto</th></tr></thead>
            <tbody>${movHtml}</tbody></table>
            <div class='divider'></div>
            <div style='text-align:center;font-weight:bold;font-size:10px;margin:4px 0;'>PERÍODO ${periodoStr}</div>
            <div class='firmas'>
              <div class='firma-box'><div class='firma-linea'></div><div class='firma-nombre'>${nombreSocio.toUpperCase()}</div><div class='firma-label'>FIRMA SOCIO</div></div>

            </div>
            <div style='text-align:center;font-family:monospace;font-size:7px;color:#aaa;margin-top:3px;'>FOLIO: ${folio}</div>
            <div class='footer'>Emitido: ${fechaHoyVis} | Sistema Fondo Solidario</div>`;
    }

    const htmlBase = `
        <html><head><title>${fileName}</title><style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 10px; color:#000; background:white; }
        .page { width:80mm; margin:0 auto; padding:8px; }
        .header { text-align:center; border:2px solid #000; padding:8px; margin-bottom:10px; }
        .header h1 { font-size:12px; font-weight:bold; letter-spacing:1px; }
        .section-title { text-align:center; font-weight:bold; font-size:10px; border-bottom:1px solid #000; padding-bottom:2px; margin:8px 0 5px; letter-spacing:1px; }
        .row { display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid #eee; }
        .row.big { font-size:18px; font-weight:900; border-top:2px solid #000; border-bottom:2px solid #000; margin:5px 0; padding:5px 0; justify-content:center; }
        table { width:100%; border-collapse:collapse; font-size:8px; }
        th { background:#f0f0f0; padding:2px; border-bottom:1px solid #ccc; }
        .divider { border-top:1px solid #000; margin:5px 0; }
        .copy-label { text-align:center; font-size:8px; font-weight:bold; background:#000; color:white; padding:2px; margin-bottom:5px; }
        .cut { border-top:2px dashed #000; margin:15px 0; text-align:center; font-size:8px; color:#aaa; padding-top:4px; }
        .firmas { display:flex; gap:10px; margin-top:20px; }
        .firma-box { flex:1; text-align:center; }
        .firma-linea { border-top:1px solid #000; margin-bottom:4px; margin-top:15px; }
        .firma-label { font-size:7px; color:#555; }
        .footer { text-align:center; font-size:7px; color:#888; margin-top:5px; }
        .folio-badge { text-align:center; font-size:8px; font-family:monospace; background:#f4f6f7; border:1px dashed #aaa; padding:3px 6px; margin-bottom:6px; letter-spacing:0.5px; border-radius:3px; }
        @media print { @page { margin:2mm; size:80mm auto; } .cut { page-break-after:always; } }
        </style></head><body><div class='page'>`;

    const opcion = window.confirm('¿Cómo imprimir?\n\nOK → Copia a copia (seleccionar después)\nCANCELAR → Dos copias en una hoja');

    let contenido;
    if (opcion) {
        const cual = window.confirm('¿Qué copia imprimir?\n\nOK → Administrador\nCANCELAR → Socio');
        const label = cual ? '★ COPIA ADMINISTRADOR ★' : '★ COMPROBANTE SOCIO ★';
        contenido = htmlBase + bloqueRecibo(label) + '</div></body></html>';
    } else {
        contenido = htmlBase + bloqueRecibo('★ COPIA ADMINISTRADOR ★') +
                      '<div class="cut">✂ CORTAR AQUÍ ✂</div>' +
                      bloqueRecibo('★ COMPROBANTE SOCIO ★') + '</div></body></html>';
    }

    // Snapshot completo para auditoría y reimpresión
    const reciboSnapshot = {
        folio, socioId: id, nombre: nombreSocio, area, contrato,
        anioIngreso, puntos, subePuntosLabel, fipLabel: fipLabel || null,
        periodo: periodoStr, valorPuntoFmt,
        saldoAnt, alcance, totalPedido, saldoReal, aPagar, remanente,
        fechaEmision: fechaHoyVis, movHtml
    };

    printHTML(contenido, fileName);

    // Registrar en auditoría (no bloquea la impresión)
    const _audUsuario = (_resp.ini || '') + (_resp.area ? ' (' + _resp.area + ')' : '');
    callApiSocios('logAccionAuditoria', {
        usuario: _audUsuario,
        accion: 'Imprimir Recibo',
        detalle: JSON.stringify(reciboSnapshot),
        idAfectado: folio
    }).catch(() => {});
}
