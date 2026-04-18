// ============================================================
// ARQUEO DE CAJA
// ============================================================

let aq_iniciado = false;

async function aq_sincronizarSilencioso() {
    const dot = document.getElementById('aq-sync-dot');
    const txt = document.getElementById('aq-sync-txt');
    if(dot) dot.classList.add('aq-syncing');
    if(txt) txt.textContent = 'Actualizando...';
    try {
        const [resEsp, resAnt] = await Promise.all([
            fetch(AQ_URL_GET).then(r => r.json()).catch(() => null),
            fetch(URL_SOCIOS, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action:'getAllDataDesdeSheets'}) }).then(r => r.json()).catch(() => null)
        ]);
        if(resEsp && resEsp.totalAcumulado !== undefined) {
            const espVal = Math.round(resEsp.totalAcumulado / 100);
            const totDay = Math.round(resEsp.totalLastDivisorDay / 100);
            const divisor = parseFloat(resEsp.lastDivisor) || 1.0;
            document.getElementById('aq-esperadoDisplay').textContent = aq_fmt(espVal);
            document.getElementById('aq-divisor-day-total').textContent = aq_fmt(totDay);
            document.getElementById('aq-divisor-value').textContent = divisor.toFixed(2);
            document.getElementById('aq-punto-del-dia').textContent = aq_fmt(totDay / divisor);
            document.getElementById('aq-divisor-date').textContent = 'Fecha: ' + resEsp.lastDivisorDate;
            aq_desgloseEsperado = resEsp.desgloseEsperado || [];
            let h = '<table class="aq-table"><thead><tr><th>Tipo</th><th>Monto</th></tr></thead><tbody>';
            aq_desgloseEsperado.forEach(i => { h += '<tr><td>' + i.tipo + '</td><td>' + aq_fmt(i.monto/100) + '</td></tr>'; });
            document.getElementById('aq-desglose-esperado').innerHTML = h + '</tbody></table>';
        }
        if(resAnt) {
            const objetoAnticipos = (resAnt.data && resAnt.data.anticipos) || resAnt.anticipos || (resAnt.result && resAnt.result.anticipos);
            if(objetoAnticipos) {
                aq_totalAnticipos = aq_filtrarAnticiposPeriodo(objetoAnticipos);
                const { inicio, fin } = aq_calcularPeriodoActual();
                const inicioVis = inicio.split('-').reverse().join('/');
                const finVis   = fin.split('-').reverse().join('/');
                document.getElementById('aq-total-anticipos').textContent =
                    aq_fmt(aq_totalAnticipos) + ' (' + inicioVis + ' → ' + finVis + ')';
            }
        }
        aq_realizarArqueo();
        if(dot) { dot.classList.remove('aq-syncing'); dot.style.background = '#27ae60'; }
        if(txt) { const now = new Date(); txt.textContent = 'Sync ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0'); }
    } catch(e) {
        if(dot) { dot.classList.remove('aq-syncing'); dot.style.background = '#ef4444'; }
        if(txt) txt.textContent = 'Error de conexion';
    }
}

function aq_arrancarSync() {
    if(aq_syncInterval) return;
    aq_sincronizarSilencioso();
    aq_syncInterval = setInterval(aq_sincronizarSilencioso, 5000);
}

function aq_detenerSync() {
    if(aq_syncInterval) { clearInterval(aq_syncInterval); aq_syncInterval = null; }
}

function aq_initSiNoIniciado() {
    if(aq_iniciado) return;
    aq_iniciado = true;
    const sc = localStorage.getItem(AQ_SK_CONTEO);
    const sm = localStorage.getItem(AQ_SK_MOVI);
    const sr = localStorage.getItem(AQ_SK_RETIROS);
    if(sc) aq_conteo = JSON.parse(sc);
    if(sm) aq_movi = JSON.parse(sm);
    if(sr) aq_totalRetirado = parseInt(sr);
    aq_histStates = [{ c: JSON.parse(JSON.stringify(aq_conteo)), r: aq_totalRetirado, m: JSON.parse(JSON.stringify(aq_movi)) }];
    aq_histIdx = 0;
    const aqCached = localStorage.getItem('fondo_cache_aq_esperado');
    if (aqCached) {
        try {
            const obj = JSON.parse(aqCached);
            if (Date.now() - obj.ts < 10 * 60 * 1000) {
                const data = obj.data;
                document.getElementById('aq-esperadoDisplay').textContent = aq_fmt(Math.round(data.totalAcumulado / 100));
                document.getElementById('aq-divisor-day-total').textContent = aq_fmt(Math.round(data.totalLastDivisorDay / 100));
                const div = parseFloat(data.lastDivisor) || 1;
                document.getElementById('aq-divisor-value').textContent = div.toFixed(2);
                document.getElementById('aq-punto-del-dia').textContent = aq_fmt(Math.round(data.totalLastDivisorDay / 100) / div);
                document.getElementById('aq-divisor-date').textContent = 'Fecha: ' + data.lastDivisorDate;
                aq_desgloseEsperado = data.desgloseEsperado || [];
                let h = '<table class="aq-table"><thead><tr><th>Tipo</th><th>Monto</th></tr></thead><tbody>';
                aq_desgloseEsperado.forEach(i => { h += '<tr><td>'+i.tipo+'</td><td>'+aq_fmt(i.monto/100)+'</td></tr>'; });
                document.getElementById('aq-desglose-esperado').innerHTML = h + '</tbody></table>';
                aq_realizarArqueo();
            }
        } catch(e) {}
    }
    aq_fetchEsperadoData();
    aq_fetchAnticipos();
}

function aq_fmt(n) { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(n || 0)); }

function aq_evalFormula(str, valDenom) {
    let clean = str.toString().replace(/[^0-9+\-*/().]/g, '');
    if(!clean) return { neto: 0, retirosUnits: 0, retirosMonetarios: 0 };
    try {
        let neto = Function('"use strict"; return (' + clean + ')')();
        let retiroUnits = 0;
        clean.split(/(?=[+-])/).forEach(t => { let n = parseFloat(t); if(n < 0) retiroUnits += Math.abs(n); });
        return { neto, retirosUnits: retiroUnits, retirosMonetarios: retiroUnits * valDenom };
    } catch(e) { return { neto: 0, retirosUnits: 0, retirosMonetarios: 0 }; }
}

function aq_saveState() {
    if(aq_histIdx < aq_histStates.length - 1) aq_histStates = aq_histStates.slice(0, aq_histIdx + 1);
    aq_histStates.push({ c: JSON.parse(JSON.stringify(aq_conteo)), r: aq_totalRetirado, m: JSON.parse(JSON.stringify(aq_movi)) });
    aq_histIdx = aq_histStates.length - 1;
    document.getElementById('aq-undo-btn').disabled = aq_histIdx <= 0;
    document.getElementById('aq-redo-btn').disabled = true;
    localStorage.setItem(AQ_SK_CONTEO, JSON.stringify(aq_conteo));
    localStorage.setItem(AQ_SK_MOVI, JSON.stringify(aq_movi));
    localStorage.setItem(AQ_SK_RETIROS, aq_totalRetirado.toString());
}

function aq_undoAction() {
    if(aq_histIdx > 0) {
        aq_histIdx--;
        const s = aq_histStates[aq_histIdx];
        aq_conteo = s.c; aq_totalRetirado = s.r; aq_movi = s.m;
        document.getElementById('aq-undo-btn').disabled = aq_histIdx === 0;
        document.getElementById('aq-redo-btn').disabled = false;
        aq_generarCampos();
    }
}

function aq_redoAction() {
    if(aq_histIdx < aq_histStates.length - 1) {
        aq_histIdx++;
        const s = aq_histStates[aq_histIdx];
        aq_conteo = s.c; aq_totalRetirado = s.r; aq_movi = s.m;
        document.getElementById('aq-undo-btn').disabled = false;
        document.getElementById('aq-redo-btn').disabled = aq_histIdx === aq_histStates.length - 1;
        aq_generarCampos();
    }
}

function aq_generarCampos() {
    const form = document.getElementById('aq-arqueo-form');
    if(!form) return;
    form.innerHTML = '';
    AQ_DENOMINACIONES.forEach(val => {
        if(!aq_conteo[val]) aq_conteo[val] = 0;
        const row = document.createElement('div');
        row.className = 'aq-denominacion-row';
        row.innerHTML = `<div class="aq-denom-main">
            <label>${aq_fmt(val)}</label>
            <div class="aq-btn-group">
                <button style="background:#ef4444;" onclick="aq_actCant(${val}, -1)">−</button>
                <input type="text" id="aq-inp-${val}" placeholder="Fórmula..." style="width:110px; text-align:center; font-size:0.8em; padding:4px; border:1px solid #e2e8f0; border-radius:6px;">
                <button style="background:#10b981;" onclick="aq_actCant(${val}, 1)">+</button>
            </div>
            <div class="aq-total-display">
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="number" class="aq-cantidad-input" id="aq-cur-${val}" value="${aq_conteo[val]}" onchange="aq_manualEdit(${val})">
                    <button onclick="aq_abrirModalEdicion(${val})" style="background:#64748b; border:none; color:white; width:28px; height:28px; border-radius:4px; cursor:pointer;"><i class="fas fa-pen" style="font-size:0.85em;"></i></button>
                </div>
                <div style="font-weight:bold; font-size:0.85em;">${aq_fmt(val * aq_conteo[val])}</div>
            </div>
        </div>
        <div class="aq-denom-trace"><span>${aq_movi[val] || 'Sin detalle'}</span></div>`;
        form.appendChild(row);
    });
    aq_realizarArqueo();
}

function aq_actCant(val, sign) {
    const inp = document.getElementById(`aq-inp-${val}`);
    const formula = inp.value.trim() || "1";
    const res = aq_evalFormula(formula, val);
    if(sign === -1 && res.neto > 0) {
        if(!confirm(`⚠️ CONFIRMAR RETIRO\n\n${res.neto} unidades de ${aq_fmt(val)}\nTotal: ${aq_fmt(res.neto * val)}\n\n¿Proceder?`)) return;
    }
    aq_saveState();
    if(sign === -1) { aq_totalRetirado += Math.abs(res.neto) * val; aq_conteo[val] -= res.neto; }
    else { aq_conteo[val] += res.neto; aq_totalRetirado += res.retirosMonetarios; }
    let prev = aq_movi[val] || "";
    let conector = prev === "" ? (sign === -1 ? "-" : "") : (sign === 1 ? "+" : "-");
    aq_movi[val] = prev + conector + "(" + formula + ")";
    inp.value = '';
    aq_generarCampos();
}

function aq_manualEdit(val) {
    const inp = document.getElementById(`aq-cur-${val}`);
    const nc = parseInt(inp.value) || 0;
    aq_saveState();
    if(nc < aq_conteo[val]) aq_totalRetirado += (aq_conteo[val] - nc) * val;
    aq_conteo[val] = nc; aq_movi[val] = "Manual"; aq_generarCampos();
}

function aq_abrirModalEdicion(val) {
    aq_denomEditando = val;
    document.getElementById('aq-formula-input').value = aq_movi[val] || "";
    document.getElementById('aq-modalEdicion').style.display = 'block';
}

function aq_guardarEdicionDetalle() {
    const val = aq_denomEditando;
    const fNueva = document.getElementById('aq-formula-input').value;
    const fVieja = aq_movi[val] || "";
    const resNueva = aq_evalFormula(fNueva, val);
    const resVieja = aq_evalFormula(fVieja, val);
    aq_saveState();
    aq_totalRetirado -= resVieja.retirosMonetarios;
    aq_totalRetirado += resNueva.retirosMonetarios;
    if(aq_totalRetirado < 0) aq_totalRetirado = 0;
    aq_conteo[val] = resNueva.neto; aq_movi[val] = fNueva;
    aq_generarCampos(); document.getElementById('aq-modalEdicion').style.display = 'none';
}

function aq_calcTotal() { let t = 0; AQ_DENOMINACIONES.forEach(v => t += v * (aq_conteo[v] || 0)); return t; }

function aq_realizarArqueo() {
    const total = Math.round(aq_calcTotal());
    const espEl = document.getElementById('aq-esperadoDisplay');
    const espVal = Math.round(parseInt((espEl.textContent || '0').replace(/[^0-9-]/g, ''))) || 0;
    const dif = Math.round((total + aq_totalAnticipos) - espVal);

    document.getElementById('aq-total-contado').textContent = aq_fmt(total);
    document.getElementById('aq-total-retiros').textContent = aq_fmt(aq_totalRetirado);

    const difEl = document.getElementById('aq-diferencia');
    difEl.textContent = aq_fmt(dif);
    difEl.style.color = dif === 0 ? '#10b981' : (dif > 0 ? '#f59e0b' : '#ef4444');

    const msgEl = document.getElementById('aq-mensaje-arqueo');
    msgEl.className = 'aq-mensaje ' + (dif === 0 ? 'cuadrado' : (dif > 0 ? 'sobrante' : 'faltante'));
    msgEl.textContent = dif === 0 ? "CUADRADO 🎉" : (dif > 0 ? "SOBRA ⚠️" : "FALTA 🚨");

    let h = '<table class="aq-table"><thead><tr><th>Denom.</th><th>Cant.</th><th>Subtotal</th></tr></thead><tbody>';
    let any = false;
    AQ_DENOMINACIONES.forEach(v => { if(aq_conteo[v] > 0) { any = true; h += `<tr><td>${aq_fmt(v)}</td><td>${aq_conteo[v]}</td><td>${aq_fmt(v*aq_conteo[v])}</td></tr>`; } });
    document.getElementById('aq-desglose-contado').innerHTML = any ? h + '</tbody></table>' : '<p style="color:#7f8c8d; text-align:center;">Sin ingresos.</p>';
}

async function aq_fetchEsperadoData() {
    try {
        const res = await fetch(AQ_URL_GET);
        const data = await res.json();
        const espVal = Math.round(data.totalAcumulado / 100);
        const totDay = Math.round(data.totalLastDivisorDay / 100);
        const ultimoDivisor = parseFloat(data.lastDivisor) || 1.0;
        document.getElementById('aq-esperadoDisplay').textContent = aq_fmt(espVal);
        document.getElementById('aq-divisor-day-total').textContent = aq_fmt(totDay);
        document.getElementById('aq-divisor-value').textContent = ultimoDivisor.toFixed(2);
        document.getElementById('aq-punto-del-dia').textContent = aq_fmt(totDay / ultimoDivisor);
        document.getElementById('aq-divisor-date').textContent = "Fecha: " + data.lastDivisorDate;
        aq_desgloseEsperado = data.desgloseEsperado || [];
        let h = '<table class="aq-table"><thead><tr><th>Tipo</th><th>Monto</th></tr></thead><tbody>';
        aq_desgloseEsperado.forEach(i => { h += `<tr><td>${i.tipo}</td><td>${aq_fmt(i.monto/100)}</td></tr>`; });
        document.getElementById('aq-desglose-esperado').innerHTML = h + '</tbody></table>';
        aq_fetchPuntosHistorial();
        aq_realizarArqueo();
    } catch(e) { console.error('Arqueo esperado error:', e); }
}

async function aq_fetchPuntosHistorial() {
    try {
        const res = await fetch(AQ_URL_GET + '?action=get');
        const json = await res.json();
        let totalPts = 0, grouped = {};
        json.data.forEach(r => {
            const d = r.fecha.split(' ')[0];
            if(!grouped[d]) grouped[d] = { total: 0, div: r.divisor || 1 };
            grouped[d].total += r.monto;
        });
        Object.keys(grouped).forEach(d => { totalPts += grouped[d].total / grouped[d].div; });
        document.getElementById('aq-suma-total-puntos').textContent = Math.round(totalPts).toLocaleString();
        document.getElementById('aq-division-result').textContent = Math.round(totalPts).toLocaleString();
    } catch(e) {}
}

function aq_calcularPeriodoActual() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes  = hoy.getMonth();

    let inicio, fin;
    if (hoy.getDate() >= 15) {
        inicio = new Date(anio, mes, 15);
        fin    = new Date(anio, mes + 1, 14);
    } else {
        inicio = new Date(anio, mes - 1, 15);
        fin    = new Date(anio, mes, 14);
    }
    const fmt = d => d.toISOString().split('T')[0];
    return { inicio: fmt(inicio), fin: fmt(fin) };
}

function aq_filtrarAnticiposPeriodo(objetoAnticipos) {
    const { inicio, fin } = aq_calcularPeriodoActual();
    const procesados = new Set();
    let suma = 0;

    Object.entries(objetoAnticipos).forEach(([idSocio, lista]) => {
        if (!Array.isArray(lista)) return;
        lista.forEach(item => {
            const monto = parseFloat(item.cantidad) || 0;
            if (monto === 0) return;

            let fechaSimple = item.fecha || '';
            if (fechaSimple.includes('T')) fechaSimple = fechaSimple.split('T')[0];

            if (fechaSimple < inicio || fechaSimple > fin) return;

            const firma = idSocio + '|' + fechaSimple + '|' + monto;
            if (procesados.has(firma)) return;
            procesados.add(firma);
            suma += monto;
        });
    });

    return Math.round(suma);
}

async function aq_fetchAnticipos(silent = false) {
    try {
        const response = await fetch(URL_SOCIOS, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: 'getAllDataDesdeSheets' }) });
        const json = await response.json();
        const objetoAnticipos = json.data?.anticipos || json.anticipos || json.result?.anticipos;
        if (objetoAnticipos) {
            aq_totalAnticipos = aq_filtrarAnticiposPeriodo(objetoAnticipos);
            const { inicio, fin } = aq_calcularPeriodoActual();
            const inicioVis = inicio.split('-').reverse().join('/');
            const finVis   = fin.split('-').reverse().join('/');
            document.getElementById('aq-total-anticipos').textContent =
                aq_fmt(aq_totalAnticipos) + ' (' + inicioVis + ' → ' + finVis + ')';
        }
    } catch(e) {}
    finally { if(!silent) aq_realizarArqueo(); }
}

function aq_crearBackupLocal() {
    const totalCaja = Math.round(aq_calcTotal());
    const espVal = Math.round(parseInt((document.getElementById('aq-esperadoDisplay').textContent || '0').replace(/[^0-9-]/g, ''))) || 0;
    const dif = Math.round((totalCaja + aq_totalAnticipos) - espVal);
    const backup = { fecha: new Date().toLocaleString(), totalContado: totalCaja, esperado: espVal, anticipos: Math.round(aq_totalAnticipos), retiros: Math.round(aq_totalRetirado), diferencia: dif, conteo: JSON.parse(JSON.stringify(aq_conteo)), rastros: JSON.parse(JSON.stringify(aq_movi)) };
    let historial = JSON.parse(localStorage.getItem(AQ_SK_BACKUP)) || [];
    historial.unshift(backup);
    if(historial.length > 20) historial.pop();
    localStorage.setItem(AQ_SK_BACKUP, JSON.stringify(historial));
}

function aq_resetear() {
    aq_conteo = {}; aq_movi = {}; aq_totalRetirado = 0;
    aq_histStates = []; aq_histIdx = -1;
    localStorage.removeItem(AQ_SK_CONTEO); localStorage.removeItem(AQ_SK_MOVI); localStorage.removeItem(AQ_SK_RETIROS);
    aq_generarCampos(); aq_realizarArqueo();
}

function aq_abrirModalConteo() {
    aq_generarCampos();
    aq_snapAlAbrir = {
        conteo: JSON.parse(JSON.stringify(aq_conteo)),
        totalRetirado: aq_totalRetirado
    };
    document.getElementById('aq-resumen-sesion').style.display = 'none';
    document.getElementById('aq-modalConteo').style.display = 'block';
}

function aq_listoConteo() {
    if (!aq_snapAlAbrir) {
        document.getElementById('aq-modalConteo').style.display = 'none';
        aq_realizarArqueo();
        return;
    }
    let totalIngresado = 0;
    let totalRetirado  = 0;
    let hayMovimientos = false;
    const lineas = [];

    AQ_DENOMINACIONES.forEach(val => {
        const antes  = aq_snapAlAbrir.conteo[val] || 0;
        const despues = aq_conteo[val] || 0;
        const diff   = despues - antes;
        if (diff === 0) return;
        hayMovimientos = true;
        const monto = diff * val;
        if (diff > 0) {
            totalIngresado += monto;
            lineas.push('<div style="display:flex;justify-content:space-between;font-size:0.82em;padding:3px 0;color:#10b981;">'
                + '<span>+ ' + diff + ' x ' + aq_fmt(val) + '</span>'
                + '<span style="font-weight:700;">+' + aq_fmt(monto) + '</span></div>');
        } else {
            totalRetirado += Math.abs(monto);
            lineas.push('<div style="display:flex;justify-content:space-between;font-size:0.82em;padding:3px 0;color:#ef4444;">'
                + '<span>− ' + Math.abs(diff) + ' x ' + aq_fmt(val) + '</span>'
                + '<span style="font-weight:700;">−' + aq_fmt(Math.abs(monto)) + '</span></div>');
        }
    });

    if (!hayMovimientos) {
        document.getElementById('aq-modalConteo').style.display = 'none';
        aq_realizarArqueo();
        return;
    }

    const neto = totalIngresado - totalRetirado;
    const colorNeto = neto >= 0 ? '#10b981' : '#ef4444';
    const signoNeto = neto >= 0 ? '+' : '';

    let html = '<div style="font-weight:800;font-size:0.85em;color:var(--text-color);margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">📋 Resumen de esta sesión</div>';
    html += lineas.join('');
    html += '<div style="border-top:1px solid #e2e8f0;margin-top:8px;padding-top:8px;display:flex;flex-direction:column;gap:4px;">';
    if (totalIngresado > 0) html += '<div style="display:flex;justify-content:space-between;font-size:0.82em;"><span style="color:#10b981;font-weight:700;">Total ingresado</span><span style="color:#10b981;font-weight:800;">+' + aq_fmt(totalIngresado) + '</span></div>';
    if (totalRetirado  > 0) html += '<div style="display:flex;justify-content:space-between;font-size:0.82em;"><span style="color:#ef4444;font-weight:700;">Total retirado</span><span style="color:#ef4444;font-weight:800;">−' + aq_fmt(totalRetirado) + '</span></div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.9em;margin-top:4px;"><span style="font-weight:800;">Neto sesión</span><span style="font-weight:900;color:' + colorNeto + ';">' + signoNeto + aq_fmt(neto) + '</span></div>';
    html += '</div>';
    html += '<button onclick="document.getElementById(\'aq-modalConteo\').style.display=\'none\'; aq_realizarArqueo();" class="aq-btn aq-btn-primary" style="width:100%;margin-top:10px;">Cerrar</button>';

    const resumen = document.getElementById('aq-resumen-sesion');
    resumen.innerHTML = html;
    resumen.style.display = 'block';
    resumen.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    aq_snapAlAbrir = null;
}

function aq_abrirModalBackup() {
    const historial = JSON.parse(localStorage.getItem(AQ_SK_BACKUP)) || [];
    const container = document.getElementById('aq-backup-list');
    if(historial.length === 0) { container.innerHTML = '<p style="color:#7f8c8d;">Sin registros archivados.</p>'; }
    else {
        let html = '';
        historial.forEach((b, index) => {
            const colorDif = b.diferencia >= 0 ? '#10b981' : '#ef4444';
            const signo = b.diferencia > 0 ? '+' : '';
            const rendido = Math.round((b.totalContado || 0) + (b.anticipos || 0));
            html += `<div class="arqueo-card" style="border-left:4px solid #8b5cf6; margin-bottom:15px; padding:15px;">
                <div style="border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:#64748b;">${b.fecha}</span>
                    <button onclick="aq_borrarBackup(${index})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.1em;" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.9em; margin-bottom:10px;">
                    <div>💰 En Caja:<br><b>${aq_fmt(b.totalContado)}</b></div>
                    <div>📉 Retiros:<br><b style="color:#ef4444">${aq_fmt(b.retiros||0)}</b></div>
                    <div>🧾 Anticipos:<br><b style="color:#8b5cf6">${aq_fmt(b.anticipos||0)}</b></div>
                    <div>📝 Rendido:<br><b style="color:#2563eb">${aq_fmt(rendido)}</b></div>
                </div>
                <div style="background:${b.diferencia>=0?'#dcfce7':'#fee2e2'}; padding:10px; border-radius:6px; text-align:center; font-weight:bold; color:${colorDif}; border:1px solid ${colorDif}">
                    Diferencia: ${signo}${aq_fmt(b.diferencia)} (Esperado: ${aq_fmt(b.esperado)})
                </div>
                <details style="font-size:0.85em; margin-top:10px; border-top:1px dashed #e2e8f0; padding-top:5px;">
                    <summary style="cursor:pointer; color:#2563eb; font-weight:600;">Ver Desglose Billetes</summary>
                    <table style="width:100%; margin-top:5px;">
                        ${AQ_DENOMINACIONES.map(v => (b.conteo[v]>0||(b.rastros&&b.rastros[v]))?`<tr><td>${aq_fmt(v)}</td><td>${b.conteo[v]}</td><td style="font-family:monospace; color:#2563eb">${(b.rastros?b.rastros[v]:'')||'-'}</td></tr>`:'').join('')}
                    </table>
                </details>
            </div>`;
        });
        container.innerHTML = html;
    }
    document.getElementById('aq-modalBackup').style.display = 'block';
}

function aq_borrarBackup(index) {
    if(!confirm('¿Eliminar este registro archivado?')) return;
    let historial = JSON.parse(localStorage.getItem(AQ_SK_BACKUP)) || [];
    historial.splice(index, 1);
    localStorage.setItem(AQ_SK_BACKUP, JSON.stringify(historial));
    aq_abrirModalBackup();
}

async function aq_recuperarDeNube() {
    toggleLoader(true, 'Cargando arqueo...');
    try {
        const res = await fetch(AQ_URL_POST + '?action=getLast');
        const json = await res.json();
        if(json.status === 'success') {
            aq_conteo = json.data.conteoActual || {};
            aq_movi = json.data.movimientoDisplay || {};
            aq_totalRetirado = json.data.totalRetirado || 0;
            aq_generarCampos(); showToast('✅ Datos cargados desde nube', 'success');
        }
    } catch(e) { showToast('Error al cargar', 'error'); } finally { toggleLoader(false); }
}

async function aq_guardarEnNube() {
    if(!confirm('☁️ ¿Subir arqueo y reiniciar?')) return;
    toggleLoader(true, 'Guardando arqueo...');
    const espVal = Math.round(parseInt((document.getElementById('aq-esperadoDisplay').textContent||'0').replace(/[^0-9-]/g,''))) || 0;
    const totalCaja = Math.round(aq_calcTotal());
    const payload = { conteoActual: aq_conteo, totalRetirado: Math.round(aq_totalRetirado), movimientoDisplay: aq_movi, totalContado: totalCaja, totalEsperado: espVal, totalAnticiposNomina: Math.round(aq_totalAnticipos), diferencia: Math.round((totalCaja+aq_totalAnticipos)-espVal), divisorPlanta: document.getElementById('aq-divisor-planta').value, divisorPartTime: document.getElementById('aq-divisor-part-time').value };
    try {
        const resp = await fetch(AQ_URL_POST, { method: 'POST', body: JSON.stringify(payload) });
        const json = await resp.json();
        if(json.status === 'success') { aq_crearBackupLocal(); showToast('✅ Guardado exitosamente', 'success'); aq_resetear(); }
    } catch(e) { showToast('Error al guardar', 'error'); } finally { toggleLoader(false); }
}

async function aq_archivarEnNube() {
    if(!confirm('🚨 ¿ARCHIVAR INFORME FINAL?')) return;
    toggleLoader(true, 'Archivando...');
    const espVal = Math.round(parseInt((document.getElementById('aq-esperadoDisplay').textContent||'0').replace(/[^0-9-]/g,''))) || 0;
    const totalCaja = Math.round(aq_calcTotal());
    const payload = { action: 'archive', conteoActual: aq_conteo, totalRetirado: Math.round(aq_totalRetirado), movimientoDisplay: aq_movi, totalContado: totalCaja, totalEsperado: espVal, totalAnticiposNomina: Math.round(aq_totalAnticipos), diferencia: Math.round((totalCaja+aq_totalAnticipos)-espVal), divisorPlanta: document.getElementById('aq-divisor-planta').value, divisorPartTime: document.getElementById('aq-divisor-part-time').value };
    try {
        const resp = await fetch(AQ_URL_POST + '?action=archive', { method: 'POST', body: JSON.stringify(payload) });
        if(resp.ok) { aq_crearBackupLocal(); aq_resetear(); showToast('✅ Informe archivado correctamente', 'success'); }
    } catch(e) { showToast('Error al archivar', 'error'); } finally { toggleLoader(false); }
}

function statsTab(nombre, btn) {
    document.querySelectorAll('.stats-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    aq_openStatsModal(nombre);
}

function aq_openStatsModal(tabActiva) {
    tabActiva = tabActiva || 'tipos';
    const container = document.getElementById('aq-stats-content');
    if (!container) return;
    const fmt = v => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v||0);
    const grupos = {};
    (recDatosRaw||[]).forEach(r => {
        let f=r.fecha||''; if(f.includes('T')) f=f.split('T')[0]; if(!f) return;
        if(!grupos[f]) grupos[f]={total:0,tipos:{},divisor:null};
        const m=parseFloat(r.monto)||0; grupos[f].total+=m; const t=r.tipo||'Otro'; grupos[f].tipos[t]=(grupos[f].tipos[t]||0)+m;
        if(r.divisor){const d=parseFloat(String(r.divisor).replace(',','.')); if(d>1) grupos[f].divisor=grupos[f].divisor?Math.max(grupos[f].divisor,d):d;}
    });
    const fechas=Object.keys(grupos).sort();
    const totalGlobal=fechas.reduce((s,f)=>s+grupos[f].total,0);
    const diasCount=fechas.length; const promDiario=diasCount?totalGlobal/diasCount:0;
    const porSemana={};
    fechas.forEach(f=>{const d=new Date(f+'T12:00:00');const wk=d.getFullYear()+'W'+String(Math.ceil((d-new Date(d.getFullYear(),0,1))/604800000)+1).padStart(2,'0');if(!porSemana[wk])porSemana[wk]={total:0,dias:0};porSemana[wk].total+=grupos[f].total;porSemana[wk].dias++;});
    const semanas=Object.keys(porSemana).sort();
    const tiposGlobal={};
    fechas.forEach(f=>Object.entries(grupos[f].tipos).forEach(([t,v])=>{tiposGlobal[t]=(tiposGlobal[t]||0)+v;}));
    const tiposOrdenados=Object.entries(tiposGlobal).sort((a,b)=>b[1]-a[1]);
    const maxTipo=tiposOrdenados[0]?.[1]||1;
    const COLORES={SalaDeJuegos:'#2563eb',Mesas:'#2563eb',EfectivoMDA:'#16a34a',TarjetaMDA:'#7c3aed',Boveda:'#d97706'};
    const getColor=t=>COLORES[t]||'#64748b';
    const ultimos14=fechas.slice(-14);
    const maxLinea=Math.max(...ultimos14.map(f=>grupos[f].total),1);
    const W=500,H=100,pad=10;
    const pts=ultimos14.map((f,i)=>{const x=pad+(i/(ultimos14.length-1||1))*(W-pad*2);const y=H-pad-(grupos[f].total/maxLinea)*(H-pad*2);return{x,y,f,v:grupos[f].total};});
    const pathD=pts.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
    const areaD=pathD+` L${pts[pts.length-1].x.toFixed(1)},${H-pad} L${pts[0].x.toFixed(1)},${H-pad} Z`;
    const DS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const svgLinea='<svg viewBox="0 0 500 100" style="width:100%;height:auto;">'
        +'<defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563eb" stop-opacity="0.3"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>'
        +'<path d="'+areaD+'" fill="url(#lg1)"/>'
        +'<path d="'+pathD+'" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linejoin="round"/>'
        +pts.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.5" fill="#2563eb" stroke="white" stroke-width="1.5"/>'
            +'<text x="'+p.x.toFixed(1)+'" y="98" text-anchor="middle" font-size="7" fill="#94a3b8">'+DS[new Date(p.f+'T12:00:00').getDay()]+'</text>').join('')
        +'</svg>';
    const hoy=new Date();
    const diasMes=new Date(hoy.getFullYear(),hoy.getMonth()+1,0).getDate();
    const diasRest=Math.max(0,diasMes-diasCount);
    const proyMes=totalGlobal+(promDiario*diasRest);
    const proySemana=promDiario*7;
    const puntosTotal=globalValorPuntoTotal||0;
    let html='';
    if(tabActiva==='tipos'){
        html='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">'
            +'<div class="mini-kpi"><div class="kpi-val">'+diasCount+'</div><div class="kpi-label">Noches</div></div>'
            +'<div class="mini-kpi"><div class="kpi-val">'+fmt(promDiario)+'</div><div class="kpi-label">Prom. Diario</div></div>'
            +'<div class="mini-kpi"><div class="kpi-val">'+fmt(totalGlobal)+'</div><div class="kpi-label">Total Global</div></div>'
            +'</div>'
            +'<div style="font-weight:700;color:#1e3a5f;margin-bottom:10px;font-size:0.9em;">Distribución por tipo</div>'
            +tiposOrdenados.map(([t,v])=>{const p=Math.round(v/totalGlobal*100)||0;const a=Math.round(v/maxTipo*100);return'<div class="bar-chart-row"><div class="bar-label">'+t+'</div><div class="bar-track"><div class="bar-fill" style="width:'+a+'%;background:'+getColor(t)+'">'+p+'%</div></div><div class="bar-val">'+fmt(v)+'</div></div>';}).join('');
    } else if(tabActiva==='diario'){
        const maxDia=Math.max(...ultimos14.map(f=>grupos[f].total),1);
        html='<div style="font-weight:700;color:#1e3a5f;margin-bottom:8px;font-size:0.9em;">Tendencia últimas 2 semanas</div>'
            +'<div style="margin-bottom:14px;">'+svgLinea+'</div>'
            +'<div style="font-weight:700;color:#1e3a5f;margin-bottom:8px;font-size:0.9em;">Detalle por día</div>'
            +ultimos14.slice().reverse().map(f=>{const dObj=new Date(f+'T12:00:00');const nd=DS[dObj.getDay()];const nf=dObj.getDate()+'/'+String(dObj.getMonth()+1).padStart(2,'0');const a=Math.round(grupos[f].total/maxDia*100);const es=dObj.getDay()===0||dObj.getDay()===6;return'<div class="bar-chart-row"><div class="bar-label" style="color:'+(es?'#d97706':'#555')+';">'+nd+' '+nf+'</div><div class="bar-track"><div class="bar-fill" style="width:'+a+'%;background:'+(es?'#d97706':'#2563eb')+'">'+fmt(grupos[f].total)+'</div></div><div class="bar-val" style="font-size:0.78em;">'+fmt(grupos[f].total)+'</div></div>';}).join('')
            +'<div style="font-weight:700;color:#1e3a5f;margin:14px 0 8px;font-size:0.9em;">Por semana</div>'
            +semanas.slice(-6).reverse().map((w,i)=>{const a=Math.round(porSemana[w].total/Math.max(...semanas.map(x=>porSemana[x].total),1)*100);return'<div class="bar-chart-row"><div class="bar-label">Sem. '+(semanas.length-i)+'</div><div class="bar-track"><div class="bar-fill" style="width:'+a+'%;background:#7c3aed">'+fmt(porSemana[w].total)+'</div></div><div class="bar-val" style="font-size:0.78em;">'+fmt(porSemana[w].total)+'</div></div>';}).join('');
    } else if(tabActiva==='proyeccion'){
        html='<div style="font-size:0.82em;color:#7f8c8d;margin-bottom:14px;">Proyecciones basadas en '+diasCount+' días. Promedio: <strong>'+fmt(promDiario)+'</strong></div>'
            +'<div class="proj-card" style="background:#eff6ff;border:1px solid #bfdbfe;"><div><div class="proj-label" style="color:#1e40af;">📅 Proyección Diaria</div><div style="font-size:0.78em;color:#7f8c8d;">Promedio por noche</div></div><div class="proj-val" style="color:#1e40af;">'+fmt(promDiario)+'</div></div>'
            +'<div class="proj-card" style="background:#f0fdf4;border:1px solid #bbf7d0;"><div><div class="proj-label" style="color:#15803d;">📆 Proyección Semanal</div><div style="font-size:0.78em;color:#7f8c8d;">7 noches al promedio</div></div><div class="proj-val" style="color:#15803d;">'+fmt(proySemana)+'</div></div>'
            +'<div class="proj-card" style="background:#fffbeb;border:1px solid #fde68a;"><div><div class="proj-label" style="color:#b45309;">🗓️ Proyección Mensual</div><div style="font-size:0.78em;color:#7f8c8d;">'+diasRest+' días restantes + acumulado</div></div><div class="proj-val" style="color:#b45309;">'+fmt(proyMes)+'</div></div>'
            +'<div style="margin-top:12px;background:#f8f9fa;border-radius:10px;padding:12px;"><div style="font-weight:700;color:#1e3a5f;margin-bottom:8px;font-size:0.88em;">📈 Curva de acumulado</div>'
            +'<svg viewBox="0 0 500 90" style="width:100%;height:auto;"><defs><linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#16a34a" stop-opacity="0.25"/><stop offset="100%" stop-color="#16a34a" stop-opacity="0"/></linearGradient></defs>'
            +(()=>{const acum=[];let suma=0;fechas.forEach((f,i)=>{suma+=grupos[f].total;acum.push({i,v:suma});});const mA=suma||1;const pA=acum.map(p=>{const x=10+(p.i/(acum.length-1||1))*480;const y=78-(p.v/mA)*68;return{x,y,v:p.v};});const dA=pA.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(1)+p.y.toFixed(1)).join(' ');const aA=dA+' L'+pA[pA.length-1].x.toFixed(1)+',78 L10,78 Z';return'<path d="'+aA+'" fill="url(#lg2)"/><path d="'+dA+'" fill="none" stroke="#16a34a" stroke-width="2" stroke-linejoin="round"/><text x="10" y="88" font-size="8" fill="#94a3b8">Inicio</text><text x="490" y="88" text-anchor="end" font-size="8" fill="#94a3b8">'+fmt(suma)+'</text>';})()
            +'</svg></div>';
    } else if(tabActiva==='puntos'){
        const dCP=Object.entries(globalMapaPuntosDia||{}).filter(([,v])=>v!==null).sort((a,b)=>a[0].localeCompare(b[0]));
        const maxP=Math.max(...dCP.map(([,v])=>v),1);
        const promP=dCP.length?dCP.reduce((s,[,v])=>s+v,0)/dCP.length:0;
        html='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">'
            +'<div class="mini-kpi"><div class="kpi-val">'+fmt(puntosTotal)+'</div><div class="kpi-label">Total Puntos Noche</div></div>'
            +'<div class="mini-kpi"><div class="kpi-val">'+fmt(promP)+'</div><div class="kpi-label">Prom. Pto/Noche</div></div>'
            +'<div class="mini-kpi"><div class="kpi-val">'+dCP.length+'</div><div class="kpi-label">Noches con divisor</div></div>'
            +'</div>'
            +'<div style="font-weight:700;color:#1e3a5f;margin-bottom:8px;font-size:0.9em;">Valor punto por noche</div>'
            +'<svg viewBox="0 0 500 100" style="width:100%;height:auto;margin-bottom:14px;"><defs><linearGradient id="lg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c3aed" stop-opacity="0.25"/><stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/></linearGradient></defs>'
            +(()=>{if(!dCP.length)return'<text x="250" y="50" text-anchor="middle" fill="#94a3b8" font-size="11">Sin datos con divisor aún</text>';const last=dCP.slice(-14);const mV=Math.max(...last.map(([,v])=>v),1);const p2=last.map(([,v],i)=>{const x=10+(i/(last.length-1||1))*480;const y=85-(v/mV)*75;return{x,y,v};});const d2=p2.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');const a2=d2+' L'+p2[p2.length-1].x.toFixed(1)+',85 L10,85 Z';return'<path d="'+a2+'" fill="url(#lg3)"/><path d="'+d2+'" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linejoin="round"/>'+p2.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3" fill="#7c3aed" stroke="white" stroke-width="1.5"/>').join('')+'<text x="10" y="97" font-size="7" fill="#94a3b8">'+dCP[Math.max(0,dCP.length-14)][0]+'</text><text x="490" y="97" text-anchor="end" font-size="7" fill="#94a3b8">'+dCP[dCP.length-1][0]+'</text>';})()
            +'</svg>'
            +'<div class="proj-card" style="background:#fdf4ff;border:1px solid #e9d5ff;"><div><div class="proj-label" style="color:#7c3aed;">⭐ Total Puntos Noche</div><div style="font-size:0.78em;color:#7f8c8d;">Suma de puntos noche con divisor</div></div><div class="proj-val" style="color:#7c3aed;">'+fmt(puntosTotal)+'</div></div>'
            +'<div class="proj-card" style="background:#f0fdf4;border:1px solid #bbf7d0;"><div><div class="proj-label" style="color:#15803d;">🔮 Proyección al cierre</div><div style="font-size:0.78em;color:#7f8c8d;">Promedio punto × '+diasMes+' días del mes</div></div><div class="proj-val" style="color:#15803d;">'+fmt(promP*diasMes)+'</div></div>';
    }
    container.innerHTML=html;
    document.getElementById('aq-modalStats').style.display='block';
}
