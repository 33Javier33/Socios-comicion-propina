// ============================================================
// AUDITORÍA — Historial de acciones del sistema
// ============================================================

let auditoriaCache = [];
let audFiltroUsuario = '';
let audFiltroAccion  = '';
let audFiltroDesde   = '';
let audFiltroHasta   = '';
let audFiltroTexto   = '';
let auditoriaSnapshots = {};

async function auditoria_cargar() {
    toggleLoader(true, 'Cargando auditoría...');
    try {
        const res = await callApiSocios('getAuditoria');
        if (res.status === 'success') {
            auditoriaCache = res.data || [];
            auditoria_actualizarStats();
            auditoria_renderizar(auditoria_filtrarDatos());
        } else {
            showToast('Error cargando auditoría', 'error');
        }
    } catch(e) {
        showToast('Error de conexión', 'error');
    } finally {
        toggleLoader(false);
    }
}

function auditoria_filtrarDatos() {
    return auditoriaCache.filter(r => {
        if (audFiltroUsuario && !(r.usuario||'').toLowerCase().includes(audFiltroUsuario.toLowerCase())) return false;
        if (audFiltroAccion  && !(r.accion||'').toLowerCase().includes(audFiltroAccion.toLowerCase()))  return false;
        if (audFiltroTexto   && !JSON.stringify(r).toLowerCase().includes(audFiltroTexto.toLowerCase())) return false;
        if (audFiltroDesde   && r.fecha.substring(0,10) < audFiltroDesde) return false;
        if (audFiltroHasta   && r.fecha.substring(0,10) > audFiltroHasta) return false;
        return true;
    });
}

const AUD_COLORES = {
    'Eliminar':  { bg:'#fdecea', txt:'#c0392b' },
    'Registrar': { bg:'#eafaf1', txt:'#1e8449' },
    'Agregar':   { bg:'#eaf4fb', txt:'#1a6fa0' },
    'Editar':    { bg:'#fef9e7', txt:'#b7770d' },
    'Actualizar':{ bg:'#e8f8f5', txt:'#148f77' },
    'Cierre':    { bg:'#f5eef8', txt:'#7d3c98' },
    'Reiniciar': { bg:'#fef0e7', txt:'#a04000' },
    'Imprimir':  { bg:'#eaf0fb', txt:'#1a3a8a' },
};

function auditoria_colorAccion(accion) {
    const entry = Object.entries(AUD_COLORES).find(([k]) => (accion||'').includes(k));
    return entry ? entry[1] : { bg:'#f2f3f4', txt:'#717d7e' };
}

function auditoria_renderizar(datos) {
    const tbody = document.getElementById('auditoria-tabla-body');
    const countEl = document.getElementById('auditoria-count');
    if (!tbody) return;

    if (!datos.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#7f8c8d;font-size:0.9em;">Sin registros para los filtros seleccionados</td></tr>';
        if (countEl) countEl.textContent = '0 registros';
        return;
    }
    if (countEl) countEl.textContent = datos.length + ' registro' + (datos.length !== 1 ? 's' : '');

    tbody.innerHTML = datos.map(r => {
        const c = auditoria_colorAccion(r.accion);
        const fechaVis = r.fecha ? r.fecha.replace('T',' ').substring(0,16) : '';
        const isRecibo = r.accion === 'Imprimir Recibo';
        const idFull   = r.idAfectado || '';
        const idCorto  = isRecibo ? idFull : idFull.substring(0,22);

        let detalleHtml = r.detalle || '';
        let reimpBtn    = '';
        if (isRecibo) {
            try {
                const snap = JSON.parse(r.detalle);
                auditoriaSnapshots[snap.folio] = snap;
                detalleHtml = `<strong style="font-size:0.9em;">${snap.nombre||''}</strong><br>
                    <span style="font-size:0.78em;color:#555;">Período: ${snap.periodo||''}</span><br>
                    <span style="font-size:0.78em;">A Pagar: <b>${snap.aPagar||''}</b> &nbsp;|&nbsp; Puntos: ${snap.puntos||''}</span>`;
                reimpBtn = `<button onclick="auditoria_reimprimirRecibo('${snap.folio}')"
                    style="margin-top:4px;background:#1a3a8a;color:white;border:none;border-radius:5px;padding:3px 10px;font-size:0.76em;cursor:pointer;">🖨 Reimprimir</button>`;
            } catch(e) { /* deja detalle crudo */ }
        }

        return `<tr class="aud-row">
            <td style="padding:9px 10px;font-size:0.8em;color:#7f8c8d;white-space:nowrap;">${fechaVis}</td>
            <td style="padding:9px 10px;font-weight:700;font-size:0.87em;">${r.usuario||''}</td>
            <td style="padding:9px 10px;">
                <span style="background:${c.bg};color:${c.txt};border-radius:6px;padding:3px 9px;font-size:0.78em;font-weight:700;white-space:nowrap;">${r.accion||''}</span>
            </td>
            <td style="padding:9px 10px;font-size:0.82em;color:#444;line-height:1.5;">${detalleHtml}${reimpBtn}</td>
            <td style="padding:9px 10px;font-size:0.72em;color:#aaa;font-family:monospace;word-break:break-all;" title="${idFull}">${idCorto}</td>
        </tr>`;
    }).join('');
}

function auditoria_actualizarStats() {
    const hoy = new Date().toISOString().split('T')[0];
    const hoyCount  = auditoriaCache.filter(r => r.fecha && r.fecha.startsWith(hoy)).length;
    const elimCount = auditoriaCache.filter(r => (r.accion||'').toLowerCase().includes('eliminar')).length;
    const usuarios  = [...new Set(auditoriaCache.map(r => r.usuario).filter(Boolean))].length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('aud-stat-total',    auditoriaCache.length);
    set('aud-stat-hoy',      hoyCount);
    set('aud-stat-eliminar', elimCount);
    set('aud-stat-usuarios', usuarios);
}

function auditoria_aplicarFiltros() {
    audFiltroUsuario = (document.getElementById('aud-filtro-usuario')?.value || '').trim();
    audFiltroAccion  = document.getElementById('aud-filtro-accion')?.value  || '';
    audFiltroDesde   = document.getElementById('aud-filtro-desde')?.value   || '';
    audFiltroHasta   = document.getElementById('aud-filtro-hasta')?.value   || '';
    audFiltroTexto   = (document.getElementById('aud-filtro-texto')?.value  || '').trim();
    auditoria_renderizar(auditoria_filtrarDatos());
}

function auditoria_limpiarFiltros() {
    ['aud-filtro-usuario','aud-filtro-accion','aud-filtro-desde','aud-filtro-hasta','aud-filtro-texto'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    audFiltroUsuario = audFiltroAccion = audFiltroDesde = audFiltroHasta = audFiltroTexto = '';
    auditoria_renderizar(auditoriaCache);
}

function auditoria_informe() {
    const datos = auditoria_filtrarDatos();
    if (!datos.length) return showToast('No hay registros para imprimir', 'error');

    const fmt  = f => f ? f.replace('T',' ').substring(0,16) : '';
    const hoy  = new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});
    const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const mesNom = MESES[new Date().getMonth()];

    const CPRINT = {
        'Eliminar':'#c0392b','Registrar':'#1a8a44','Agregar':'#1a6fa0',
        'Editar':'#b7770d','Actualizar':'#148f77','Cierre':'#7d3c98','Reiniciar':'#a04000',
    };

    const filas = datos.map(r => {
        const entry = Object.entries(CPRINT).find(([k]) => (r.accion||'').includes(k));
        const color = entry ? entry[1] : '#555';
        return `<tr>
            <td>${fmt(r.fecha)}</td>
            <td style="font-weight:700;">${r.usuario||''}</td>
            <td style="color:${color};font-weight:700;">${r.accion||''}</td>
            <td>${r.detalle||''}</td>
            <td style="font-family:monospace;font-size:7.5px;">${(r.idAfectado||'').substring(0,22)}</td>
        </tr>`;
    }).join('');

    // Resumen por usuario
    const porUsuario = {};
    datos.forEach(r => { porUsuario[r.usuario] = (porUsuario[r.usuario]||0)+1; });
    const resumenUsr = Object.entries(porUsuario)
        .sort((a,b)=>b[1]-a[1])
        .map(([u,n]) => `<span style="background:#eaf4fb;color:#1a6fa0;border-radius:5px;padding:2px 8px;margin:2px;font-size:8.5px;display:inline-block;font-weight:700;">${u}: ${n}</span>`)
        .join('');

    // Resumen por acción
    const porAccion = {};
    datos.forEach(r => { porAccion[r.accion] = (porAccion[r.accion]||0)+1; });
    const resumenAcc = Object.entries(porAccion)
        .sort((a,b)=>b[1]-a[1])
        .map(([a,n]) => {
            const entry = Object.entries(CPRINT).find(([k]) => a.includes(k));
            const c = entry ? entry[1] : '#555';
            return `<span style="background:${c}18;color:${c};border-radius:5px;padding:2px 8px;margin:2px;font-size:8.5px;display:inline-block;font-weight:700;">${a}: ${n}</span>`;
        }).join('');

    // Filtros aplicados
    const filtrosStr = [
        audFiltroUsuario && 'Usuario: ' + audFiltroUsuario,
        audFiltroAccion  && 'Acción: '  + audFiltroAccion,
        audFiltroDesde   && 'Desde: '   + audFiltroDesde,
        audFiltroHasta   && 'Hasta: '   + audFiltroHasta,
        audFiltroTexto   && 'Texto: '   + audFiltroTexto,
    ].filter(Boolean).join(' | ') || 'Sin filtros (todos los registros)';

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Auditoria ${mesNom} ${hoy}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:Arial,sans-serif; font-size:9px; color:#000; padding:12px; }
h1 { font-size:14px; text-align:center; font-weight:900; letter-spacing:0.5px; margin-bottom:2px; }
.sub { text-align:center; font-size:9px; color:#555; margin-bottom:4px; }
.filtros { font-size:8px; color:#777; text-align:center; margin-bottom:8px; font-style:italic; }
.resumen { margin-bottom:10px; padding:6px; background:#f8f9fa; border-radius:4px; border:1px solid #e0e0e0; }
.resumen-titulo { font-size:8px; font-weight:700; color:#2c3e50; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.04em; }
table { width:100%; border-collapse:collapse; font-size:8.5px; }
th { background:#2c3e50; color:white; padding:4px 5px; text-align:left; font-size:8px; }
td { padding:3px 5px; border-bottom:1px solid #eee; vertical-align:top; word-break:break-word; }
tr:nth-child(even) td { background:#f8f9fa; }
.footer { text-align:center; font-size:8px; color:#aaa; margin-top:12px; }
@media print { @page { size: A4 landscape; margin: 8mm; } }
</style></head><body>
<h1>🔍 Historial de Auditoría — Fondo Solidario</h1>
<div class="sub">Casino de Puerto Varas &nbsp;·&nbsp; Generado: ${hoy} &nbsp;·&nbsp; Total: <strong>${datos.length}</strong> registros</div>
<div class="filtros">Filtros: ${filtrosStr}</div>

<div class="resumen">
    <div class="resumen-titulo">Resumen por usuario</div>
    ${resumenUsr}
</div>
<div class="resumen" style="margin-bottom:12px;">
    <div class="resumen-titulo">Resumen por acción</div>
    ${resumenAcc}
</div>

<table>
  <thead><tr>
    <th style="width:105px;">Fecha/Hora</th>
    <th style="width:65px;">Usuario</th>
    <th style="width:95px;">Acción</th>
    <th>Detalle</th>
    <th style="width:95px;">ID Afectado</th>
  </tr></thead>
  <tbody>${filas}</tbody>
</table>
<div class="footer">Fondo Solidario — Sistema Integral de Comisión Propina · Auditoría generada el ${hoy}</div>
</body></html>`;

    const fileName = `Auditoria ${mesNom} ${hoy.replace(/\//g,'-')}`;
    printHTML(html, fileName);
}

function auditoria_reimprimirRecibo(folio) {
    const snap = auditoriaSnapshots[folio];
    if (!snap) return showToast('Recibo no disponible en esta sesión. Recarga auditoría.', 'error');

    const fileName = `Recibo ${snap.nombre||''} REIMP ${snap.folio||''}`;

    function bloqueRecibo(etiqueta) {
        return `
            <div class='copy-label'>${etiqueta}</div>
            <div class='folio-badge'>N° FOLIO: ${snap.folio} &nbsp;★&nbsp; REIMPRESIÓN</div>
            <div class='header'>
              <h1>FONDO DE SOLIDARIDAD</h1>
              <p>CASINO DE PTO. VARAS</p>
              <p>LEY 17312 DEL 29/07/70</p>
              <p><strong>PUERTO VARAS</strong></p>
            </div>
            <div class='section-title'>DATOS</div>
            <div class='row'><label>NOMBRE</label><strong>${(snap.nombre||'').toUpperCase()}</strong></div>
            <div class='row'><label>ÁREA</label><span>${snap.area||''}</span></div>
            <div class='row'><label>CONTRATO</label><span>${snap.contrato||''}</span></div>
            <div class='row'><label>AÑO INGRESO</label><span>${snap.anioIngreso||''}</span></div>
            ${snap.fipLabel ? `<div class='row'><label>INICIO PUNTOS</label><span>${snap.fipLabel}</span></div>` : ''}
            <div class='row'><label>PUNTOS</label><span>${snap.puntos||''}</span></div>
            <div class='row'><label>SUBE PUNTOS</label><span>${snap.subePuntosLabel||''}</span></div>
            <div class='divider'></div>
            <div class='section-title'>CIERRE PUNTO</div>
            <div class='row'><label>VALOR PUNTO NOCHE</label><span>${snap.valorPuntoFmt||''}</span></div>
            <div class='divider'></div>
            <div class='section-title'>DETALLE</div>
            <div class='row'><label>BRUTO (Alcance)</label><span>${snap.alcance||''}</span></div>
            <div class='row'><label>ANTICIPOS</label><span>${snap.totalPedido||''}</span></div>
            <div class='row'><label>SALDO ANTERIOR</label><span>${snap.saldoAnt||''}</span></div>
            <div class='row bold'><label>SALDO REAL</label><strong>${snap.saldoReal||''}</strong></div>
            <div class='divider'></div>
            <div style='text-align:center;font-size:9px;font-weight:bold;margin-top:6px;letter-spacing:1px;'>TOTAL A COBRAR</div>
            <div class='row big'><span>$ ${snap.aPagar||''}</span></div>
            <div class='row'><label>REMANENTE</label><span>${snap.remanente||''}</span></div>
            <div class='divider'></div>
            <div class='section-title'>MOVIMIENTOS / RESPONSABLES</div>
            <table><thead><tr><th>#</th><th>Tipo</th><th>Detalle</th><th>Monto</th></tr></thead>
            <tbody>${snap.movHtml||''}</tbody></table>
            <div class='divider'></div>
            <div style='text-align:center;font-weight:bold;font-size:10px;margin:4px 0;'>PERÍODO ${snap.periodo||''}</div>
            <div class='firmas'>
              <div class='firma-box'><div class='firma-linea'></div><div class='firma-nombre'>${(snap.nombre||'').toUpperCase()}</div><div class='firma-label'>FIRMA SOCIO</div></div>
            </div>
            <div style='text-align:center;font-family:monospace;font-size:7px;color:#aaa;margin-top:3px;'>FOLIO: ${snap.folio}</div>
            <div class='footer'>Emitido: ${snap.fechaEmision||''} &nbsp;|&nbsp; REIMPRESIÓN &nbsp;|&nbsp; Sistema Fondo Solidario</div>`;
    }

    const htmlBase = `<html><head><title>${fileName}</title><style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Arial,sans-serif; font-size:10px; color:#000; background:white; }
        .page { width:80mm; margin:0 auto; padding:8px; }
        .header { text-align:center; border:2px solid #000; padding:8px; margin-bottom:10px; }
        .header h1 { font-size:12px; font-weight:bold; letter-spacing:1px; }
        .section-title { text-align:center; font-weight:bold; font-size:10px; border-bottom:1px solid #000; padding-bottom:2px; margin:8px 0 5px; letter-spacing:1px; }
        .row { display:flex; justify-content:space-between; padding:2px 0; border-bottom:1px solid #eee; }
        .row.big { font-size:18px; font-weight:900; border-top:2px solid #000; border-bottom:2px solid #000; margin:5px 0; padding:5px 0; justify-content:center; }
        table { width:100%; border-collapse:collapse; font-size:8px; }
        th { background:#f0f0f0; padding:2px; border-bottom:1px solid #ccc; }
        .divider { border-top:1px solid #000; margin:5px 0; }
        .copy-label { text-align:center; font-size:8px; font-weight:bold; background:#1a3a8a; color:white; padding:2px; margin-bottom:5px; }
        .folio-badge { text-align:center; font-size:8px; font-family:monospace; background:#f4f6f7; border:1px dashed #aaa; padding:3px 6px; margin-bottom:6px; letter-spacing:0.5px; border-radius:3px; }
        .cut { border-top:2px dashed #000; margin:15px 0; text-align:center; font-size:8px; color:#aaa; padding-top:4px; }
        .firmas { display:flex; gap:10px; margin-top:20px; }
        .firma-box { flex:1; text-align:center; }
        .firma-linea { border-top:1px solid #000; margin-bottom:4px; margin-top:15px; }
        .firma-label { font-size:7px; color:#555; }
        .footer { text-align:center; font-size:7px; color:#888; margin-top:5px; }
        @media print { @page { margin:2mm; size:80mm auto; } .cut { page-break-after:always; } }
        </style></head><body><div class='page'>`;

    const contenido = htmlBase
        + bloqueRecibo('★ REIMPRESIÓN — ADMINISTRADOR ★')
        + '<div class="cut">✂ CORTAR AQUÍ ✂</div>'
        + bloqueRecibo('★ REIMPRESIÓN — COMPROBANTE SOCIO ★')
        + '</div></body></html>';

    printHTML(contenido, fileName);
}
