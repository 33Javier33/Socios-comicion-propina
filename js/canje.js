// ============================================================
// CANJE
// ============================================================

function canje_abrirModal() {
    canjeConteo = {};

    // Autocompletar la fecha de hoy
    const hoy = new Date().toISOString().split('T')[0];
    const inpFecha = document.getElementById('canje-fecha');
    if (inpFecha) inpFecha.value = hoy;

    // Autocompletar el responsable según sesión actual
    const inpResp = document.getElementById('canje-responsable');
    const objResp = getSesionResponsableObj();
    if (inpResp) {
        if (objResp.ini) inpResp.value = objResp.ini + (objResp.area ? ' (' + objResp.area + ')' : '');
        else inpResp.value = '';
    }

    const form = document.getElementById('canje-form');
    form.innerHTML = '';
    const nomInp = document.getElementById('canje-nombre');
    if(nomInp) { nomInp.value = ''; }
    const prev = document.getElementById('canje-nombre-preview');
    if(prev) prev.textContent = 'Canje';

    let html = '<table style="width:100%;border-collapse:collapse;">';
    html += '<thead><tr>'
        + '<th style="padding:8px;background:#f8f9fa;border:1px solid #dee2e6;text-align:center;font-weight:800;">CANTIDAD</th>'
        + '<th style="padding:8px;background:#f8f9fa;border:1px solid #dee2e6;text-align:center;font-weight:800;">VALOR</th>'
        + '<th style="padding:8px;background:#f8f9fa;border:1px solid #dee2e6;text-align:center;font-weight:800;">TOTAL</th>'
        + '</tr></thead><tbody>';
    CANJE_DENOMS.forEach((val, i) => {
        const bg = i % 2 === 0 ? '#f0faf0' : 'white';
        html += '<tr style="background:' + bg + '">'
            + '<td style="padding:5px 8px;border:1px solid #dee2e6;text-align:center;">'
            + '<input type="number" min="0" placeholder="0" id="canje-inp-' + val + '"'
            + ' style="width:70px;padding:4px;text-align:center;border:1px solid #ccc;border-radius:5px;font-weight:700;"'
            + ' oninput="canje_actualizar()" onchange="canje_actualizar()">'
            + '</td>'
            + '<td style="padding:5px 8px;border:1px solid #dee2e6;text-align:center;font-weight:700;">'
            + new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(val)
            + '</td>'
            + '<td style="padding:5px 8px;border:1px solid #dee2e6;text-align:right;font-weight:700;color:#2c3e50;" id="canje-sub-' + val + '">$0</td>'
            + '</tr>';
    });
    html += '</tbody></table>';
    form.innerHTML = html;
    document.getElementById('canje-total').textContent = '$0';
    document.getElementById('modalCanje').style.display = 'block';
}

function canje_cerrarModal() {
    document.getElementById('modalCanje').style.display = 'none';
}

function canje_actualizar() {
    let total = 0;
    CANJE_DENOMS.forEach(val => {
        const inp = document.getElementById('canje-inp-' + val);
        const cant = parseInt(inp && inp.value !== '' ? inp.value : 0) || 0;
        const sub = cant * val;
        total += sub;
        const subEl = document.getElementById('canje-sub-' + val);
        if (subEl) subEl.textContent = sub > 0
            ? new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(sub)
            : '$0';
    });
    document.getElementById('canje-total').textContent =
        new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(total);
}

function canje_imprimir() {
    const fmt = v => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v);

    // Extraer los datos de los nuevos campos
    const fechaInput = document.getElementById('canje-fecha').value;
    let fechaVis = new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});
    if (fechaInput) {
        const fp = fechaInput.split('-');
        if (fp.length === 3) fechaVis = `${fp[2]}/${fp[1]}/${fp[0]}`;
    }

    const horaHoy  = new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
    const nomInput = document.getElementById('canje-nombre').value.trim() || 'Canje';
    const firmaResp = document.getElementById('canje-responsable').value.trim() || '—';
    const firmaError = document.getElementById('canje-correccion').value.trim();

    let filas = '';
    let total = 0;
    CANJE_DENOMS.forEach((val, i) => {
        const inp  = document.getElementById('canje-inp-' + val);
        const cant = parseInt(inp && inp.value !== '' ? inp.value : 0) || 0;
        const sub  = cant * val;
        total += sub;
        const bg = i % 2 === 0 ? '#f0faf0' : 'white';
        filas += '<tr style="background:' + bg + '">'
            + '<td style="padding:4px 8px;border:1px solid #ccc;text-align:center;">' + cant + '</td>'
            + '<td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-weight:700;">' + fmt(val) + '</td>'
            + '<td style="padding:4px 8px;border:1px solid #ccc;text-align:right;font-weight:700;">' + (sub > 0 ? fmt(sub) : '0') + '</td>'
            + '</tr>';
    });

    const opcion = window.confirm('¿Cómo imprimir?\n\nOK → Una copia\nCancelar → Dos copias (corte manual)');

    function bloqueCanje(etiqueta) {
        return '<div class="copy-label">' + etiqueta + '</div>'
            + '<div class="header"><h1>FONDO DE SOLIDARIDAD</h1><p>CASINO DE PTO. VARAS</p><p>LEY 17312 DEL 29/07/70</p><p><strong>PUERTO VARAS</strong></p></div>'
            + '<div class="section-title">' + nomInput.toUpperCase() + '</div>'
            + '<div style="text-align:center;font-size:9px;color:#888;margin-bottom:8px;">' + fechaVis + ' ' + horaHoy + '</div>'
            + '<table><thead><tr><th>CANTIDAD</th><th>VALOR</th><th style="text-align:right">TOTAL</th></tr></thead><tbody>' + filas + '</tbody></table>'
            + '<div style="border-top:2px solid #000;margin-top:8px;padding-top:6px;display:flex;justify-content:space-between;font-size:13px;font-weight:900;">'
            + '<span>TOTAL FINAL</span><span style="color:#d35400;">' + fmt(total) + '</span></div>'
            + '<div style="margin-top:12px;font-size:9px;line-height:1.4;">'
            + '<strong>Responsable:</strong> ' + firmaResp + '<br>'
            + (firmaError ? '<small>Corrección registrada por: ' + firmaError + '</small>' : '')
            + '</div>'
            + '<div class="footer">Emitido: ' + fechaVis + ' ' + horaHoy + ' | Sistema Fondo Solidario</div>';
    }

    const htmlBase = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>' + nomInput + '</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:11px;} .page{width:80mm;margin:0 auto;padding:8px;} .header{text-align:center;border:2px solid #000;padding:8px;margin-bottom:10px;} .header h1{font-size:13px;font-weight:bold;} table{width:100%;border-collapse:collapse;margin:4px 0;} th{background:#f0f0f0;padding:4px 8px;} .copy-label{text-align:center;font-size:9px;font-weight:bold;background:#000;color:white;padding:3px;margin-bottom:8px;letter-spacing:2px;} .cut{border-top:2px dashed #000;margin:16px 0;text-align:center;font-size:9px;color:#aaa;padding-top:4px;} .footer{text-align:center;font-size:8px;color:#888;border-top:1px dashed #ccc;padding-top:5px;margin-top:6px;}</style></head><body><div class="page">';

    let contenido;
    if (opcion) {
        contenido = htmlBase + bloqueCanje('★ ' + nomInput.toUpperCase() + ' ★') + '</div></body></html>';
    } else {
        contenido = htmlBase + bloqueCanje('★ ' + nomInput.toUpperCase() + ' ★') + '<div class="cut">✂ &nbsp; CORTAR AQUÍ &nbsp; ✂</div>' + bloqueCanje('★ ' + nomInput.toUpperCase() + ' ★') + '</div></body></html>';
    }

    printHTML(contenido, nomInput + ' ' + fechaVis.replace(/\//g,'-'));
    canje_cerrarModal();
}
