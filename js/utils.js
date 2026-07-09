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

// Retorna clave del periodo actual (ej: "2026-04"). Día 15 en adelante = mes actual (clave nueva para cierre).
function calcularPeriodoClave() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes  = hoy.getMonth(); // 0-based
    if (hoy.getDate() >= 15) {
        return anio + '-' + String(mes + 1).padStart(2, '0');
    } else {
        const mesPrev  = mes === 0 ? 11 : mes - 1;
        const anioPrev = mes === 0 ? anio - 1 : anio;
        return anioPrev + '-' + String(mesPrev + 1).padStart(2, '0');
    }
}

function formatearInputMonto(input) {
    let num = input.value.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '');
    if (!num) { input.value = ''; return; }
    input.value = new Intl.NumberFormat('es-CL').format(num);
}

function showToast(message, type = 'info') {
    const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = `toast ${type}`; t.innerText = message; c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

// ── AVATAR de socio (foto o inicial) + lightbox para ampliar ──────────────
function _avEsc(s){ return String(s == null ? '' : s).replace(/'/g, '%27').replace(/"/g, '%22'); }
function avatarHTML(fotoUrl, nombre, size) {
    size = size || 40;
    const r = Math.round(size * 0.28);
    if (fotoUrl) {
        return `<div onclick="event.stopPropagation();verFotoGrande('${_avEsc(fotoUrl)}')" title="Ver foto" style="width:${size}px;height:${size}px;border-radius:${r}px;background-image:url('${_avEsc(fotoUrl)}');background-size:cover;background-position:center;flex-shrink:0;border:1px solid #e2e8f0;cursor:zoom-in;"></div>`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:${r}px;background:linear-gradient(135deg,#1e3a5f,#2980b9);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${Math.round(size*0.42)}px;flex-shrink:0;">${(nombre || '?').charAt(0).toUpperCase()}</div>`;
}
function verFotoGrande(url) {
    if (!url) return;
    const o = document.getElementById('fotoGrandeOverlay'); const im = document.getElementById('fotoGrandeImg');
    if (!o || !im) return; im.src = url; o.style.display = 'flex';
}
function cerrarFotoGrande() { const o = document.getElementById('fotoGrandeOverlay'); if (o) o.style.display = 'none'; }

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

// ── FAB global "Volver al inicio" ─────────────────────────────
function irAlInicio() {
    const m = document.querySelector('.app-main');
    if (m) m.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initScrollTopFab() {
    const fab = document.getElementById('fabScrollTop');
    if (!fab) return;

    function checkScroll() {
        // En la sección Mensajes el botón "⬆ Inicio" tapa el botón Enviar → ocultarlo ahí
        const enMensajes = document.getElementById('tab-mensajes') && document.getElementById('tab-mensajes').classList.contains('active');
        if (enMensajes) { fab.style.display = 'none'; return; }
        const appMain = document.querySelector('.app-main');
        const mainY = appMain ? appMain.scrollTop : 0;
        const winY  = window.scrollY || document.documentElement.scrollTop || 0;
        fab.style.display = (mainY > 150 || winY > 150) ? 'flex' : 'none';
    }

    // Escuchar scroll en window siempre
    window.addEventListener('scroll', checkScroll, { passive: true });

    // Escuchar scroll en .app-main cuando exista (desktop)
    // Se re-adjunta si initLayout lo crea después
    function attachMain() {
        const m = document.querySelector('.app-main');
        if (m) m.addEventListener('scroll', checkScroll, { passive: true });
    }
    attachMain();
    // Por si initLayout() aún no corrió, volver a intentar
    setTimeout(attachMain, 600);
}
