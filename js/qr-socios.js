// ============================================================
// QR DE VINCULACIÓN POR SOCIO
//
// El QR NO lleva los datos del socio: lleva un código opaco de 32 caracteres
// que se canjea en Supabase. Por eso:
//   · caduca solo (3 días por defecto) y se puede anular emitiendo otro;
//   · si la foto del QR se filtra después de usado, no sirve para nada;
//   · ni el nombre ni el RUT viajan en la URL, así que no quedan en el
//     historial del navegador, ni en los registros del servidor, ni a la
//     vista de quien escanee el código sin tener la app.
//
// Emitirlo exige el PIN en el momento. Tener la pestaña abierta no alcanza,
// porque un QR es una credencial de acceso a la cuenta de ese socio.
// ============================================================

const QR_URL_SOLICITADA = 'https://propi-solicitada.vercel.app/';
const QR_URL_DIARIO     = 'https://diario-propi.vercel.app/';
const QR_DIAS_VALIDEZ   = 3;

let _qrDatos = null;   // { socio, nombre, token, url, expira }

function _qrEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Pedir el PIN ────────────────────────────────────────────────────────────
// Campo de texto con .campo-secreto en vez de type="password": el gestor de
// contraseñas del navegador solo se ofrece a "actualizar la contraseña" en
// campos de ese tipo, y lo hacía en cada acción (ver styles.css).
function _qrPedirPin(nombreSocio) {
    return new Promise(resolve => {
        const prev = document.getElementById('qr-modal-pin');
        if (prev) prev.remove();
        const d = document.createElement('div');
        d.id = 'qr-modal-pin';
        d.className = 'modal';
        d.style.display = 'block';
        d.innerHTML = '<div class="modal-content" style="max-width:360px;">'
            + '<div class="modal-header" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);">'
            + '<h2 style="color:white;margin:0;font-size:1.05em;">⬛ Generar QR</h2>'
            + '<span class="close-modal" id="qr-pin-x" style="color:white;cursor:pointer;">&times;</span></div>'
            + '<div class="modal-body" style="padding:16px;">'
            + '<p style="font-size:0.85em;color:#475569;margin:0 0 4px;">Vas a emitir el QR de <b>' + _qrEsc(nombreSocio) + '</b>.</p>'
            + '<p style="font-size:0.78em;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;margin:0 0 12px;">'
            + 'Quien tenga este QR podrá entrar como este socio. Entrégalo solo a él y no lo dejes a la vista.</p>'
            + '<label style="font-size:0.8em;font-weight:700;color:#334155;display:block;margin-bottom:5px;">Tu PIN</label>'
            + '<input type="text" id="qr-pin-input" inputmode="numeric" maxlength="8" autocomplete="off" class="campo-secreto" '
            + 'style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:10px;font-size:1.1em;text-align:center;box-sizing:border-box;">'
            + '<div id="qr-pin-err" style="color:#dc2626;font-size:0.78em;font-weight:600;margin-top:6px;min-height:16px;"></div>'
            + '<button id="qr-pin-ok" class="aq-btn aq-btn-primary" style="width:100%;margin-top:8px;">Generar</button>'
            + '</div></div>';
        document.body.appendChild(d);

        const inp = d.querySelector('#qr-pin-input');
        const cerrar = valor => { d.remove(); resolve(valor); };
        d.querySelector('#qr-pin-x').onclick = () => cerrar(null);
        d.querySelector('#qr-pin-ok').onclick = () => {
            const v = (inp.value || '').trim();
            if (!v) { d.querySelector('#qr-pin-err').textContent = 'Escribe tu PIN.'; return; }
            cerrar(v);
        };
        inp.onkeydown = e => { if (e.key === 'Enter') d.querySelector('#qr-pin-ok').click(); };
        setTimeout(() => inp.focus(), 60);
    });
}

// ── Dibujar el QR en un canvas ──────────────────────────────────────────────
// La librería es qrcode-generator de Kazuhiko Arase (MIT), alojada en
// js/vendor/qrcode.js. No se carga por CDN a propósito: así el Service Worker
// la cachea con el resto y el QR se puede generar sin conexión.
function _qrDibujar(canvas, texto, lado) {
    if (typeof qrcode !== 'function') throw new Error('Falta js/vendor/qrcode.js');
    const q = qrcode(0, 'M');     // versión automática, corrección media
    q.addData(texto);
    q.make();
    const n = q.getModuleCount();
    const margen = 4;             // el "quiet zone" que exige la norma
    const escala = Math.max(2, Math.floor(lado / (n + margen * 2)));
    const px = (n + margen * 2) * escala;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!q.isDark(r, c)) continue;
            ctx.fillRect((c + margen) * escala, (r + margen) * escala, escala, escala);
        }
    }
    return { modulos: n, pixeles: px };
}

// ── Abrir el QR de un socio ─────────────────────────────────────────────────
async function qr_abrirPara(socioId) {
    const socio = (cacheSocios || []).find(s => s.id === socioId);
    if (!socio) { showToast('No se encontró ese socio.', 'error'); return; }
    const nombre = ((socio.nombre || '') + ' ' + (socio.apellido || '')).trim();

    const pin = await _qrPedirPin(nombre);
    if (!pin) return;

    toggleLoader(true, 'Generando QR...');
    let res = null;
    try {
        const { data, error } = await dbSoc.rpc('rpc_crear_vinculo_qr', {
            p_socio_id: socioId, p_pin: pin, p_dias: QR_DIAS_VALIDEZ
        });
        if (error) throw new Error(error.message);
        res = data;
    } catch (e) {
        toggleLoader(false);
        showToast('No se pudo generar el QR: ' + e.message, 'error');
        return;
    }
    toggleLoader(false);

    if (!res || res.ok !== true) {
        const motivos = {
            pin: 'PIN incorrecto.',
            bloqueado: 'Demasiados intentos fallidos. Espera 15 minutos.',
            socio_no_existe: 'Ese socio ya no está en la base.'
        };
        showToast(motivos[res && res.motivo] || 'No se pudo generar el QR.', 'error');
        return;
    }

    const url = QR_URL_SOLICITADA + '?qr=' + encodeURIComponent(res.token);
    _qrDatos = { socio: socioId, nombre, token: res.token, url, expira: res.expira_en };
    _qrMostrar();

    if (typeof window.sbAuditLog === 'function') {
        // Queda registrado quién emitió el QR de quién. El código no se guarda
        // en la auditoría: sería dejar la credencial escrita en otro lado.
        window.sbAuditLog('QR', { detalle: 'QR de vinculación emitido para ' + nombre,
                                  datos: { socioId, expira: res.expira_en } });
    }
}

function _qrMostrar() {
    const d = _qrDatos;
    if (!d) return;
    const prev = document.getElementById('qr-modal-ver');
    if (prev) prev.remove();

    const vence = new Date(d.expira);
    const p = n => String(n).padStart(2, '0');
    const venceTxt = p(vence.getDate()) + '-' + p(vence.getMonth() + 1) + '-' + vence.getFullYear()
                   + ' a las ' + p(vence.getHours()) + ':' + p(vence.getMinutes());

    const m = document.createElement('div');
    m.id = 'qr-modal-ver';
    m.className = 'modal';
    m.style.display = 'block';
    m.innerHTML = '<div class="modal-content" style="max-width:380px;">'
        + '<div class="modal-header" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);">'
        + '<h2 style="color:white;margin:0;font-size:1.05em;">⬛ QR de ' + _qrEsc(d.nombre) + '</h2>'
        + '<span class="close-modal" onclick="document.getElementById(\'qr-modal-ver\').remove()" style="color:white;cursor:pointer;">&times;</span></div>'
        + '<div class="modal-body" style="padding:16px;text-align:center;">'
        + '<div id="qr-caja" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;display:inline-block;">'
        + '<canvas id="qr-canvas" style="display:block;width:240px;height:240px;image-rendering:pixelated;"></canvas></div>'
        + '<p style="font-size:0.8em;color:#475569;margin:12px 0 2px;">Al escanearlo, el socio elige a qué app entrar.</p>'
        + '<p style="font-size:0.78em;color:#b45309;margin:0 0 12px;">Vence el <b>' + venceTxt + '</b> · sirve una vez en cada app</p>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">'
        + '<button class="aq-btn aq-btn-primary" onclick="qr_descargar()" style="flex:1;min-width:110px;">⬇️ Descargar</button>'
        + '<button class="aq-btn aq-btn-primary" onclick="qr_compartir()" style="flex:1;min-width:110px;">📤 Compartir</button>'
        + '<button class="aq-btn" onclick="qr_copiarEnlace()" style="flex:1;min-width:110px;background:#64748b;color:#fff;">🔗 Copiar enlace</button>'
        + '</div></div></div>';
    document.body.appendChild(m);

    try {
        const info = _qrDibujar(document.getElementById('qr-canvas'), d.url, 240);
        const c = document.getElementById('qr-canvas');
        c.style.width = c.style.height = Math.min(260, info.pixeles) + 'px';
    } catch (e) {
        document.getElementById('qr-caja').innerHTML =
            '<p style="color:#dc2626;font-size:0.8em;margin:0;">No se pudo dibujar el QR: ' + _qrEsc(e.message) + '</p>';
    }
}

function _qrNombreArchivo() {
    return 'QR-' + String(_qrDatos.nombre).replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/g, '-') + '.png';
}

function qr_descargar() {
    const c = document.getElementById('qr-canvas');
    if (!c || !_qrDatos) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = _qrNombreArchivo();
    a.click();
}

async function qr_compartir() {
    const c = document.getElementById('qr-canvas');
    if (!c || !_qrDatos) return;
    try {
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const file = new File([blob], _qrNombreArchivo(), { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'QR de ' + _qrDatos.nombre });
            return;
        }
    } catch (e) { /* si el socio cancela el diálogo no hay nada que avisar */ }
    // Sin compartir de archivos (computador, navegadores viejos): queda el enlace
    qr_copiarEnlace();
}

async function qr_copiarEnlace() {
    if (!_qrDatos) return;
    try {
        await navigator.clipboard.writeText(_qrDatos.url);
        showToast('Enlace copiado. Mándalo solo a ' + _qrDatos.nombre + '.', 'success');
    } catch (e) {
        showToast('No se pudo copiar. El enlace es: ' + _qrDatos.url, 'warning');
    }
}
