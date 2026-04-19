// ============================================================
// AUTENTICACIÓN, LOGIN, SESIÓN E INACTIVIDAD
// ============================================================

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('fondo_dark_mode', isDark ? '1' : '0');
    const btn = document.getElementById('darkModeBtn');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}
// Restaurar modo oscuro al cargar
(function() {
    if (localStorage.getItem('fondo_dark_mode') === '1') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('darkModeBtn');
        if (btn) btn.textContent = '☀️';
    }
})();

function intentarLogin() {
    const pin    = document.getElementById('pinInput').value.trim();
    const errEl  = document.getElementById('loginError');
    const respSel = document.getElementById('loginResponsable');
    const respVal = respSel ? respSel.value : '';
    if (!respVal) {
        errEl.textContent = 'Selecciona tu nombre antes de ingresar.';
        errEl.style.display = 'block';
        if (respSel) { respSel.style.borderColor = 'var(--danger)'; setTimeout(()=>respSel.style.borderColor='',1500); }
        return;
    }
    // Determinar qué PIN validar: personal del responsable o el global del sistema
    const parts      = respVal.split('|');
    const listaResp  = responsables_cargar();
    const respObj    = listaResp.find(r => r.ini === parts[0] && r.area === parts[1]);
    const pinEsperado = (respObj && respObj.pin) ? respObj.pin : (localStorage.getItem(PIN_KEY) || PIN_DEFAULT);

    if (pin === pinEsperado) {
        errEl.style.display = 'none';
        errEl.textContent = 'PIN incorrecto. Inténtalo de nuevo.';
        sessionStorage.setItem(SESSION_KEY, 'ok');
        sessionStorage.setItem(SESION_RESP_KEY, respVal);
        const overlay = document.getElementById('loginOverlay');
        overlay.style.transition = 'opacity 0.4s';
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; iniciarApp(); }, 400);
    } else {
        errEl.style.display = 'block';
        document.getElementById('pinInput').value = '';
        document.getElementById('pinInput').focus();
        const inp = document.getElementById('pinInput');
        inp.style.borderColor = 'var(--danger)';
        inp.style.animation = 'shake 0.4s';
        setTimeout(() => { inp.style.borderColor = ''; inp.style.animation = ''; }, 500);
    }
}

// Actualiza el hint del PIN según si el responsable tiene PIN personal o usa el global
function actualizarHintPin() {
    const respVal = document.getElementById('loginResponsable').value;
    const hint    = document.getElementById('pinHint');
    if (!hint) return;
    if (!respVal) { hint.innerHTML = ''; return; }
    const parts     = respVal.split('|');
    const listaResp = responsables_cargar();
    const resp      = listaResp.find(r => r.ini === parts[0] && r.area === parts[1]);
    hint.innerHTML = (resp && resp.pin)
        ? '<span style="color:var(--success);font-size:0.78em;font-weight:700;">🔐 Usa tu PIN personal</span>'
        : '<span style="color:var(--warning);font-size:0.78em;font-weight:700;">🔓 Usa el PIN del sistema</span>';
}

function togglePinVista() {
    const inp = document.getElementById('pinInput');
    const eye = document.getElementById('pinEye');
    if (inp.type === 'password') { inp.type = 'text'; eye.textContent = '🙈'; }
    else { inp.type = 'password'; eye.textContent = '👁'; }
}

function toggleRecuperar() {
    const panel = document.getElementById('recoverPanel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    if (panel.style.display === 'block') document.getElementById('claveRecuperar').focus();
}

// ===== CIERRE DE SESION Y TEMPORIZADOR DE INACTIVIDAD =====
let inactividadTimeout = null;
let inactividadInterval = null;
let tiempoRestante = INACTIVIDAD_MS;

function cerrarSesion(silencioso = false) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESION_RESP_KEY);
    const respBadge = document.getElementById('sesionRespBadge');
    if (respBadge) respBadge.style.display = 'none';
    clearTimeout(inactividadTimeout);
    clearInterval(inactividadInterval);
    document.getElementById('pinInput').value = "";
    document.getElementById('loginError').style.display = "none";
    document.getElementById('recoverPanel').style.display = "none";
    document.getElementById('claveRecuperar').value = "";
    document.getElementById('recoverMsg').textContent = "";
    document.getElementById('inactividadBadge').style.display = "none";
    const overlay = document.getElementById('loginOverlay');
    overlay.style.opacity = "0";
    overlay.style.display = "flex";
    overlay.style.transition = "opacity 0.4s";
    setTimeout(() => { overlay.style.opacity = "1"; }, 10);
    if (!silencioso) showToast("Sesion cerrada", "success");
    else showToast("Sesion cerrada por inactividad (15 min)", "error");
    setTimeout(() => document.getElementById('pinInput').focus(), 450);
}

function resetearInactividad() {
    if (!sessionStorage.getItem(SESSION_KEY)) return;
    clearTimeout(inactividadTimeout);
    clearInterval(inactividadInterval);
    tiempoRestante = INACTIVIDAD_MS;
    const badge = document.getElementById('inactividadBadge');
    if (badge) badge.style.display = "none";
    inactividadInterval = setInterval(() => {
        tiempoRestante -= 1000;
        const mins = Math.floor(tiempoRestante / 60000);
        const secs = Math.floor((tiempoRestante % 60000) / 1000);
        const timerEl = document.getElementById('inactividadTimer');
        if (timerEl) timerEl.textContent = mins + ":" + String(secs).padStart(2, "0");
        if (tiempoRestante <= 2 * 60 * 1000 && badge) badge.style.display = "flex";
        if (tiempoRestante <= 0) {
            clearInterval(inactividadInterval);
            cerrarSesion(true);
        }
    }, 1000);
    inactividadTimeout = setTimeout(() => cerrarSesion(true), INACTIVIDAD_MS);
}

function iniciarWatchdogInactividad() {
    const eventos = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    eventos.forEach(ev => document.addEventListener(ev, resetearInactividad, { passive: true }));
    resetearInactividad();
}

function recuperarPin() {
    const clave = document.getElementById('claveRecuperar').value.trim();
    const msg   = document.getElementById('recoverMsg');
    if (clave === cfg_getClaveRecup()) {
        const nuevo = prompt('Clave correcta. Ingresa tu nuevo PIN de 4 digitos:');
        if (nuevo && /^[0-9]{4}$/.test(nuevo)) {
            localStorage.setItem(PIN_KEY, nuevo);
            msg.style.color = 'var(--success)';
            msg.textContent = 'PIN actualizado correctamente. Ya puedes ingresar.';
            document.getElementById('claveRecuperar').value = '';
            document.getElementById('pinInput').value = '';
            document.getElementById('pinInput').focus();
        } else {
            msg.style.color = 'var(--danger)';
            msg.textContent = 'El PIN debe ser exactamente 4 digitos numericos.';
        }
    } else {
        msg.style.color = 'var(--danger)';
        msg.textContent = 'Clave de recuperacion incorrecta.';
    }
}

// ── Sesión de responsable ─────────────────────────────────
function getSesionResponsable() { return sessionStorage.getItem(SESION_RESP_KEY) || ''; }
function getSesionResponsableObj() {
    const val = getSesionResponsable();
    if (!val) return { ini: '', area: '' };
    const parts = val.split('|');
    return { ini: parts[0] || '', area: parts[1] || '' };
}
