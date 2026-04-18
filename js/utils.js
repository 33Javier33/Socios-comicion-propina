// ============================================================
// UTILIDADES GENERALES
// ============================================================

function printHTML(htmlContent, filename) {
    // Reemplazamos el <title> para que Android use ese nombre al guardar como PDF
    // e inyectamos window.print() automático dentro del documento
    const printScript = '<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>';
    let fullHtml = htmlContent.replace(/<title>[^<]*<\/title>/i, '<title>' + filename + '<\/title>');
    // Insertamos el script de impresión antes del cierre de </head>
    if (fullHtml.indexOf('</head>') !== -1) {
        fullHtml = fullHtml.replace('</head>', printScript + '</head>');
    } else {
        fullHtml = printScript + fullHtml;
    }

    const blob = new Blob([fullHtml], {type: 'text/html; charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');

    if (win) {
        setTimeout(() => URL.revokeObjectURL(url), 120000);
    } else {
        // Bloqueador de popups: descarga directa
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.html';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
}

let _loaderTimer = null;
function toggleLoader(show, text='Procesando...') {
    const bar    = document.getElementById('loaderBar');
    const loader = document.getElementById('globalLoader');
    const badge  = document.getElementById('loaderActionBadge');
    const txt    = document.getElementById('loaderText');
    if (show) {
        if (txt) txt.textContent = text;
        if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; }
        loader.style.display = 'block';
        badge.style.display  = 'flex';
        clearTimeout(_loaderTimer);
        _loaderTimer = setTimeout(() => { if(bar) { bar.style.transition = 'width 0.8s ease'; bar.style.width = '80%'; } }, 20);
    } else {
        if (bar) { bar.style.transition = 'width 0.2s ease'; bar.style.width = '100%'; }
        badge.style.display = 'none';
        clearTimeout(_loaderTimer);
        _loaderTimer = setTimeout(() => {
            loader.style.display = 'none';
            if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; }
        }, 250);
    }
}

function formatearMoneda(valor) { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor); }

function formatearInputMonto(input) {
    let num = input.value.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '');
    if (!num) { input.value = ''; return; }
    input.value = new Intl.NumberFormat('es-CL').format(num);
}

function showToast(message, type = 'info') {
    const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = `toast ${type}`; t.innerText = message; c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

// ── Log de acciones ───────────────────────────────────────
function logAccion(tipo, detalle) {
    try {
        const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
        log.unshift({ ts: new Date().toLocaleString('es-CL'), tipo, detalle });
        if (log.length > 200) log.splice(200);
        localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch(e) {}
}

// ── Banner de error de conexión ───────────────────────────
function ayudaRapida_cerrarBannerError() {
    const b = document.getElementById('error-conexion-banner');
    if (b) b.style.display = 'none';
}
function mostrarErrorConexion(msg) {
    let banner = document.getElementById('error-conexion-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'error-conexion-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#e74c3c;color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font-size:0.85em;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
        banner.innerHTML = '<span id="error-conexion-msg">⚠️ Error de conexión</span>'
            + '<div style="display:flex;gap:8px;">'
            + '<button onclick="location.reload()" style="background:white;color:#e74c3c;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:700;font-size:0.85em;">🔄 Reintentar</button>'
            + '<button onclick="ayudaRapida_cerrarBannerError()" style="background:rgba(255,255,255,0.2);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-weight:700;font-size:0.85em;">✕</button>'
            + '</div>';
        document.body.prepend(banner);
    }
    document.getElementById('error-conexion-msg').textContent = '⚠️ ' + msg;
    banner.style.display = 'flex';
}
