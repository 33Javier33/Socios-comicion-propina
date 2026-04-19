// ============================================================
// CONFIGURACIÓN: PIN, CLAVE DE RECUPERACIÓN Y RESPONSABLES
// ============================================================

function cfg_getClaveRecup() {
    return localStorage.getItem(CLAVE_RECUP_KEY) || CLAVE_RECUP;
}

function cfg_limpiarCampos() {
    ['cfg-pin-actual','cfg-pin-nuevo','cfg-pin-confirmar',
     'cfg-clave-actual','cfg-clave-nueva','cfg-clave-confirmar'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    ['cfg-pin-msg','cfg-clave-msg'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.textContent = '';
    });
}

function cfg_cambiarPin() {
    const actual     = document.getElementById('cfg-pin-actual').value.trim();
    const nuevo      = document.getElementById('cfg-pin-nuevo').value.trim();
    const confirmar  = document.getElementById('cfg-pin-confirmar').value.trim();
    const msg        = document.getElementById('cfg-pin-msg');
    const pinGuardado = localStorage.getItem(PIN_KEY) || PIN_DEFAULT;

    if (actual !== pinGuardado) {
        msg.style.color = 'var(--danger)';
        msg.textContent = '❌ El PIN actual no es correcto.';
        return;
    }
    if (!/^[0-9]{4}$/.test(nuevo)) {
        msg.style.color = 'var(--danger)';
        msg.textContent = '❌ El PIN nuevo debe ser exactamente 4 dígitos numéricos.';
        return;
    }
    if (nuevo !== confirmar) {
        msg.style.color = 'var(--danger)';
        msg.textContent = '❌ Los PINs nuevos no coinciden.';
        return;
    }
    localStorage.setItem(PIN_KEY, nuevo);
    msg.style.color = 'var(--success)';
    msg.textContent = '✅ PIN actualizado correctamente.';
    document.getElementById('cfg-pin-actual').value = '';
    document.getElementById('cfg-pin-nuevo').value = '';
    document.getElementById('cfg-pin-confirmar').value = '';
    showToast('PIN cambiado exitosamente', 'success');
}

function cfg_cambiarClave() {
    const actual    = document.getElementById('cfg-clave-actual').value.trim();
    const nueva     = document.getElementById('cfg-clave-nueva').value.trim();
    const confirmar = document.getElementById('cfg-clave-confirmar').value.trim();
    const msg       = document.getElementById('cfg-clave-msg');
    const claveActual = cfg_getClaveRecup();

    if (actual !== claveActual) {
        msg.style.color = 'var(--danger)';
        msg.textContent = '❌ La clave actual no es correcta.';
        return;
    }
    if (nueva.length < 4) {
        msg.style.color = 'var(--danger)';
        msg.textContent = '❌ La nueva clave debe tener al menos 4 caracteres.';
        return;
    }
    if (nueva !== confirmar) {
        msg.style.color = 'var(--danger)';
        msg.textContent = '❌ Las claves nuevas no coinciden.';
        return;
    }
    localStorage.setItem(CLAVE_RECUP_KEY, nueva);
    msg.style.color = 'var(--success)';
    msg.textContent = '✅ Clave de recuperación actualizada.';
    document.getElementById('cfg-clave-actual').value = '';
    document.getElementById('cfg-clave-nueva').value = '';
    document.getElementById('cfg-clave-confirmar').value = '';
    showToast('Clave de recuperación cambiada', 'success');
}

// ══════════════════════════════════════════════════════════
// RESPONSABLES DE ANTICIPOS
// ══════════════════════════════════════════════════════════

function responsables_cargar() {
    try { return JSON.parse(localStorage.getItem(RESP_KEY)) || RESP_DEFAULT; }
    catch(e) { return RESP_DEFAULT; }
}
function responsables_guardar(lista) {
    try { localStorage.setItem(RESP_KEY, JSON.stringify(lista)); } catch(e) {}
}

function responsables_poblarSelector() {
    const sel = document.getElementById('responsableAnticipo');
    if (!sel) return;
    const lista = responsables_cargar();
    const ultimo = localStorage.getItem(LAST_RESP_KEY) || '';
    const sesionResp = getSesionResponsable();
    const seleccionar = sesionResp || ultimo;
    sel.innerHTML = '<option value="">Sin responsable</option>' + lista.map(e =>
        '<option value="' + e.ini + '|' + e.area + '"' + (((e.ini + '|' + e.area) === seleccionar) ? ' selected' : '') + '>' + e.ini + ' (' + e.area + ')</option>'
    ).join('');
}
function responsables_abrirConfig() {
    responsables_renderLista();
    document.getElementById('modalResponsables').style.display = 'block';
}
function responsables_cerrarConfig() {
    document.getElementById('modalResponsables').style.display = 'none';
    responsables_poblarSelector();
}
function responsables_renderLista() {
    const lista = responsables_cargar();
    const cont  = document.getElementById('responsables-lista');
    if (!lista.length) { cont.innerHTML = '<p style="color:#aaa;font-size:0.85em;">Sin responsables. Agrega uno abajo.</p>'; return; }
    cont.innerHTML = lista.map((e, i) =>
        '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f8f9fa;border-radius:8px;margin-bottom:6px;border:1px solid #eee;">'
        + '<span style="font-weight:700;flex:1;">' + e.ini + '</span>'
        + '<span style="color:#7f8c8d;font-size:0.85em;">' + e.area + '</span>'
        + '<button onclick="responsables_eliminar(' + i + ')" style="background:none;border:1px solid #fca5a5;color:#ef4444;border-radius:5px;padding:2px 7px;cursor:pointer;font-size:0.8em;">✕</button>'
        + '</div>'
    ).join('');
}
function responsables_agregar() {
    const ini  = document.getElementById('resp-new-ini').value.trim().toUpperCase();
    const area = document.getElementById('resp-new-area').value.trim().toUpperCase();
    if (!ini || !area) return showToast('Completa iniciales y área', 'error');
    const lista = responsables_cargar();
    lista.push({ ini, area });
    responsables_guardar(lista);
    document.getElementById('resp-new-ini').value = '';
    document.getElementById('resp-new-area').value = '';
    responsables_renderLista();
    showToast('Responsable agregado', 'success');
}
function responsables_eliminar(idx) {
    const lista = responsables_cargar();
    lista.splice(idx, 1);
    responsables_guardar(lista);
    responsables_renderLista();
}

// ── Responsables en Config (inline) ───────────────────────
// Índices en modo recuperación de PIN (clave maestra verificada)
const _pinRecoveryModes = {};

function cfg_renderResponsables() {
    const cont = document.getElementById('cfg-responsables-lista');
    if (!cont) return;
    const lista = responsables_cargar();
    if (!lista.length) {
        cont.innerHTML = '<div style="color:#7f8c8d;font-size:0.85em;text-align:center;padding:10px;">No hay responsables configurados</div>';
        return;
    }

    // Solo el responsable de la sesión activa puede gestionar su propio PIN
    const sesion = getSesionResponsableObj();

    cont.innerHTML = lista.map((r, i) => {
        const tienePinPropio = !!r.pin;
        const esMio = (r.ini === sesion.ini && r.area === sesion.area);

        const pinBadge = tienePinPropio
            ? '<span style="background:#eafaf1;color:#1e8449;border-radius:5px;padding:2px 8px;font-size:0.72em;font-weight:700;white-space:nowrap;">🔐 PIN propio</span>'
            : '<span style="background:#fff3cd;color:#856404;border-radius:5px;padding:2px 8px;font-size:0.72em;font-weight:700;white-space:nowrap;">🔓 PIN global</span>';

        // Formulario de PIN — solo visible para el responsable actual
        const pinForm = esMio ? `
            <div id="cfg-pin-form-${i}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
                <div style="font-size:0.78em;font-weight:700;color:#7f8c8d;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.04em;">
                    ${tienePinPropio ? 'Cambiar mi PIN personal' : 'Crear mi PIN personal'}
                </div>

                ${tienePinPropio ? `
                <!-- Campo PIN actual (solo cuando ya tiene PIN) -->
                <div id="cfg-pin-actual-wrap-${i}">
                    <label style="font-size:0.75em;color:#7f8c8d;display:block;margin-bottom:4px;">PIN actual</label>
                    <input type="password" id="cfg-rpin-actual-${i}" maxlength="4" inputmode="numeric" placeholder="●●●●"
                        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.9em;letter-spacing:6px;text-align:center;box-sizing:border-box;margin-bottom:8px;">
                </div>` : ''}

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <div>
                        <label style="font-size:0.75em;color:#7f8c8d;display:block;margin-bottom:4px;">Nuevo PIN</label>
                        <input type="password" id="cfg-rpin-${i}" maxlength="4" inputmode="numeric" placeholder="●●●●"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.9em;letter-spacing:6px;text-align:center;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:0.75em;color:#7f8c8d;display:block;margin-bottom:4px;">Confirmar</label>
                        <input type="password" id="cfg-rpin-confirm-${i}" maxlength="4" inputmode="numeric" placeholder="●●●●"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.9em;letter-spacing:6px;text-align:center;box-sizing:border-box;">
                    </div>
                </div>

                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button onclick="cfg_guardarRespPin(${i})" class="btn-submit" style="flex:1;padding:9px;font-size:0.85em;">
                        ✅ ${tienePinPropio ? 'Cambiar PIN' : 'Crear PIN personal'}
                    </button>
                    ${tienePinPropio ? `<button onclick="cfg_quitarRespPin(${i})" style="background:#fff3cd;border:1px solid #ffc107;color:#856404;border-radius:8px;padding:9px 12px;cursor:pointer;font-size:0.78em;font-weight:700;white-space:nowrap;">🗑 Quitar</button>` : ''}
                </div>

                <div id="cfg-rpin-msg-${i}" style="font-size:0.78em;min-height:16px;margin-bottom:6px;"></div>

                ${tienePinPropio ? `
                <!-- Recuperación con clave maestra -->
                <details style="margin-top:4px;">
                    <summary style="font-size:0.75em;color:#7f8c8d;cursor:pointer;user-select:none;">🔓 ¿Olvidaste tu PIN personal?</summary>
                    <div style="margin-top:8px;padding:10px;background:#f8f9fa;border-radius:8px;border:1px solid var(--border);">
                        <div style="font-size:0.75em;color:#7f8c8d;margin-bottom:6px;">Ingresa la clave maestra del sistema para desbloquear el cambio:</div>
                        <div style="display:flex;gap:6px;">
                            <input type="password" id="cfg-rpin-clave-${i}" placeholder="Clave maestra"
                                style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.85em;box-sizing:border-box;">
                            <button onclick="cfg_recuperarPinConClave(${i})" style="background:var(--secondary);color:white;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:0.82em;font-weight:700;white-space:nowrap;">🔓 Verificar</button>
                        </div>
                        <div id="cfg-rpin-recup-msg-${i}" style="font-size:0.75em;min-height:14px;margin-top:5px;"></div>
                    </div>
                </details>` : ''}
            </div>` : '';

        return `<div style="background:var(--card-bg);border:1px solid ${esMio ? 'var(--secondary)' : 'var(--border)'};border-radius:10px;padding:10px 14px;margin-bottom:8px;${esMio ? 'box-shadow:0 0 0 2px rgba(52,152,219,0.12);' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;flex-shrink:0;">${r.ini.charAt(0)}</div>
                    <div>
                        <div style="font-weight:700;font-size:0.9em;">${r.ini}${esMio ? ' <span style="font-size:0.75em;color:var(--secondary);">(tú)</span>' : ''}</div>
                        <div style="font-size:0.75em;color:#7f8c8d;">${r.area}</div>
                    </div>
                    ${pinBadge}
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    ${esMio ? `<button onclick="cfg_toggleFormPin(${i})" style="background:#eaf4fb;border:1px solid #aed6f1;color:#1a6fa0;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:0.78em;font-weight:700;">🔑 Mi PIN</button>` : ''}
                    <button onclick="cfg_eliminarResponsable(${i})" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:0.8em;font-weight:700;">✕</button>
                </div>
            </div>
            ${pinForm}
        </div>`;
    }).join('');
}

function cfg_toggleFormPin(idx) {
    document.querySelectorAll('[id^="cfg-pin-form-"]').forEach(el => {
        if (el.id !== 'cfg-pin-form-' + idx) el.style.display = 'none';
    });
    const form = document.getElementById('cfg-pin-form-' + idx);
    if (form) form.style.display = (form.style.display === 'none' ? 'block' : 'none');
}

async function cfg_guardarRespPin(idx) {
    const lista   = responsables_cargar();
    const r       = lista[idx];
    const key     = r.ini + '|' + r.area;
    const msgEl   = document.getElementById('cfg-rpin-msg-' + idx);
    const setMsg  = (color, txt) => { if (msgEl) { msgEl.style.color = color; msgEl.textContent = txt; } };

    // Si ya tiene PIN (nube o local) y NO está en modo recuperación → pedir PIN actual
    const pinExistente = credencialesCache[key] || r.pin;
    if (pinExistente && !_pinRecoveryModes[idx]) {
        const pinActual = (document.getElementById('cfg-rpin-actual-' + idx)?.value || '').trim();
        if (pinActual !== pinExistente) return setMsg('var(--danger)', '❌ El PIN actual no es correcto.');
    }

    const pin1 = (document.getElementById('cfg-rpin-' + idx)?.value || '').trim();
    const pin2 = (document.getElementById('cfg-rpin-confirm-' + idx)?.value || '').trim();
    if (!/^[0-9]{4}$/.test(pin1)) return setMsg('var(--danger)', '❌ El PIN debe ser exactamente 4 dígitos numéricos.');
    if (pin1 !== pin2)            return setMsg('var(--danger)', '❌ Los PINs no coinciden.');

    setMsg('var(--secondary)', '⏳ Guardando en la nube...');
    try {
        await callApiSocios('setCredencial', { ini: r.ini, area: r.area, pin: pin1 });
        // Actualizar cache local y responsables
        credencialesCache[key] = pin1;
        lista[idx].pin = pin1;
        responsables_guardar(lista);
        delete _pinRecoveryModes[idx];
        cfg_renderResponsables();
        responsables_poblarLoginSelector();
        showToast('✅ PIN guardado en la nube — disponible en todos los dispositivos', 'success');
    } catch(e) {
        setMsg('var(--danger)', '❌ Error guardando en la nube. Intenta de nuevo.');
    }
}

async function cfg_quitarRespPin(idx) {
    const lista = responsables_cargar();
    const r     = lista[idx];
    const key   = r.ini + '|' + r.area;
    const msgEl = document.getElementById('cfg-rpin-msg-' + idx);
    const setMsg = (color, txt) => { if (msgEl) { msgEl.style.color = color; msgEl.textContent = txt; } };

    // Requiere PIN actual para quitar (a menos que esté en modo recuperación)
    const pinExistente = credencialesCache[key] || r.pin;
    const pinActual = (document.getElementById('cfg-rpin-actual-' + idx)?.value || '').trim();
    if (!_pinRecoveryModes[idx] && pinActual !== pinExistente) {
        return setMsg('var(--danger)', '❌ Ingresa tu PIN actual para quitar el PIN personal.');
    }
    if (!confirm('¿Quitar el PIN personal de ' + r.ini + '? Volverá a usar el PIN del sistema.')) return;

    setMsg('var(--secondary)', '⏳ Eliminando...');
    try {
        await callApiSocios('deleteCredencial', { ini: r.ini, area: r.area });
        delete credencialesCache[key];
        delete lista[idx].pin;
        delete _pinRecoveryModes[idx];
        responsables_guardar(lista);
        cfg_renderResponsables();
        responsables_poblarLoginSelector();
        showToast('PIN personal eliminado. Se usará el PIN del sistema.', 'info');
    } catch(e) {
        setMsg('var(--danger)', '❌ Error eliminando. Intenta de nuevo.');
    }
}

function cfg_recuperarPinConClave(idx) {
    const clave   = (document.getElementById('cfg-rpin-clave-' + idx)?.value || '').trim();
    const msgEl   = document.getElementById('cfg-rpin-recup-msg-' + idx);
    const setMsg  = (color, txt) => { if (msgEl) { msgEl.style.color = color; msgEl.textContent = txt; } };
    if (clave !== cfg_getClaveRecup()) return setMsg('var(--danger)', '❌ Clave maestra incorrecta.');
    // Marcar modo recuperación: se saltea la validación del PIN actual
    _pinRecoveryModes[idx] = true;
    // Ocultar campo "PIN actual" para que el usuario solo llene Nuevo + Confirmar
    const wrap = document.getElementById('cfg-pin-actual-wrap-' + idx);
    if (wrap) wrap.style.display = 'none';
    setMsg('var(--success)', '✅ Clave verificada. Ahora ingresa tu nuevo PIN arriba.');
    document.getElementById('cfg-rpin-clave-' + idx).value = '';
}

function cfg_agregarResponsable() {
    const ini  = (document.getElementById('cfg-resp-ini').value || '').trim().toUpperCase();
    const area = (document.getElementById('cfg-resp-area').value || '').trim().toUpperCase();
    if (!ini || !area) return showToast('Ingresa las iniciales y el área', 'error');
    const lista = responsables_cargar();
    if (lista.find(r => r.ini === ini && r.area === area)) return showToast('Ese responsable ya existe', 'error');
    lista.push({ ini, area });
    responsables_guardar(lista);
    document.getElementById('cfg-resp-ini').value = '';
    document.getElementById('cfg-resp-area').value = '';
    cfg_renderResponsables();
    responsables_poblarSelector();
    responsables_poblarLoginSelector();
    showToast('✅ Responsable agregado', 'success');
}
function cfg_eliminarResponsable(idx) {
    const lista = responsables_cargar();
    if (!confirm('¿Quitar a ' + lista[idx].ini + ' (' + lista[idx].area + ')?')) return;
    lista.splice(idx, 1);
    responsables_guardar(lista);
    cfg_renderResponsables();
    responsables_poblarSelector();
    responsables_poblarLoginSelector();
    showToast('Responsable eliminado', 'success');
}

// ── Poblar selector login con responsables ─────────────────
function responsables_poblarLoginSelector() {
    const sel = document.getElementById('loginResponsable');
    if (!sel) return;
    const lista = responsables_cargar();
    sel.innerHTML = '<option value="">— Selecciona tu nombre —</option>';
    lista.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.ini + '|' + r.area;
        opt.textContent = r.ini + ' (' + r.area + ')';
        sel.appendChild(opt);
    });
}
