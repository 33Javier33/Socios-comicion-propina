// ============================================================
// CONFIGURACIÓN: PIN, CLAVE DE RECUPERACIÓN Y RESPONSABLES
// ============================================================

function cfg_getClaveRecup() {
    return localStorage.getItem(CLAVE_RECUP_KEY) || CLAVE_RECUP;
}

// Carga PIN, clave recuperación y responsables desde Supabase al inicio
async function cfg_cargarDesdeSupabase() {
    try {
        const res = await callApiSocios('getConfig');
        if (res.status !== 'success') return;
        const cfg = res.data || {};
        // PIN global
        if (cfg.pin) {
            localStorage.setItem(PIN_KEY, cfg.pin);
        }
        // Clave de recuperación
        if (cfg.clave_recup) {
            localStorage.setItem(CLAVE_RECUP_KEY, cfg.clave_recup);
        }
        // Responsables (solo sobreescribe si Supabase tiene datos).
        if (cfg.responsables) {
            try {
                const lista = JSON.parse(cfg.responsables);
                if (Array.isArray(lista) && lista.length > 0) responsables_aplicarDesdeNube(lista);
            } catch(e) {}
        }
        console.log('[CFG-SB] Configuración cargada desde Supabase');
    } catch(e) {
        // Silencioso — usa localStorage como fallback
    }
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
    cfg_ojosEnTodos(document.getElementById('tab-config'));
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
    // Sincronizar con Supabase en segundo plano
    callApiSocios('setConfig', { clave: 'pin', valor: nuevo })
        .catch(e => console.warn('[CFG-SB] Error guardando PIN:', e));
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
    // Sincronizar con Supabase en segundo plano
    callApiSocios('setConfig', { clave: 'clave_recup', valor: nueva })
        .catch(e => console.warn('[CFG-SB] Error guardando clave_recup:', e));
}

// ══════════════════════════════════════════════════════════
// RESPONSABLES DE ANTICIPOS
// ══════════════════════════════════════════════════════════

function responsables_cargar() {
    try { return JSON.parse(localStorage.getItem(RESP_KEY)) || RESP_DEFAULT; }
    catch(e) { return RESP_DEFAULT; }
}

// Guarda SOLO en este dispositivo. Es lo que corresponde cuando cambia un PIN
// personal: el PIN de verdad vive en `responsable_creds`, y la lista de
// `config_sistema` ni se entera.
//
// Antes existía un único responsables_guardar() que, además de localStorage,
// subía la lista local entera a `config_sistema`. Eso BORRABA de la nube a los
// responsables que hubiera agregado otro dispositivo: al arrancar,
// cargarCredenciales() → _sincronizarPinsLocales() sube la lista local, que en
// un equipo recién abierto todavía está desactualizada. El responsable nuevo
// desaparecía para todos, incluido quien lo creó. Por eso ahora el guardado
// local y el cambio de la lista compartida son dos cosas distintas.
function responsables_guardarLocal(lista) {
    try { localStorage.setItem(RESP_KEY, JSON.stringify(lista)); } catch(e) {}
}

// La lista de `config_sistema` se guarda A PROPÓSITO sin PINs (los PINs están
// en `responsable_creds`). Volcarla tal cual sobre localStorage borraría el
// `pin` local que cargarCredenciales() acaba de poner —las dos cargas corren
// en paralelo al iniciar, así que gana la que responde última—, y el
// responsable aparecería como "sin PIN propio", sin campo "PIN actual" y con
// el cambio de PIN trabado. Así que se fusiona, conservando el PIN.
function responsables_fusionar(listaNube, previos) {
    const prev = Array.isArray(previos) ? previos : responsables_cargar();
    return listaNube.map(r => {
        const p   = prev.find(x => x.ini === r.ini && x.area === r.area);
        const pin = (typeof credencialesCache === 'object' && credencialesCache[r.ini + '|' + r.area])
                 || (p && p.pin) || '';
        return pin ? { ini: r.ini, area: r.area, pin } : { ini: r.ini, area: r.area };
    });
}

// Deja en este dispositivo la lista que viene de la nube y repinta lo que la
// muestra. Solo redibuja si la lista cambió de verdad: redibujar porque sí
// borraría el formulario de PIN que alguien pudiera estar llenando.
function responsables_aplicarDesdeNube(listaNube) {
    if (!Array.isArray(listaNube) || listaNube.length === 0) return false;
    const antes = localStorage.getItem(RESP_KEY) || '';
    const fusionada = responsables_fusionar(listaNube);
    const ahora = JSON.stringify(fusionada);
    responsables_guardarLocal(fusionada);
    if (ahora === antes) return false;
    responsables_poblarLoginSelector();
    if (typeof responsables_poblarSelector === 'function') responsables_poblarSelector();
    if (document.getElementById('cfg-responsables-lista')) cfg_renderResponsables();
    if (document.getElementById('responsables-lista')) responsables_renderLista();
    return true;
}

// Alta o baja en la lista COMPARTIDA. Se lee la lista de la nube, se le aplica
// el cambio y se vuelve a escribir, en vez de subir la copia local: así dos
// dispositivos pueden agregar gente sin pisarse.
//
// Si la nube no se puede leer o no se puede escribir, NO se toca nada y se
// avisa. Antes se guardaba igual en local y el aviso era "✅ Responsable
// agregado" aunque no hubiera salido de este teléfono.
//
// cambio: { agregar: {ini, area} } ó { quitar: {ini, area} }
async function responsables_cambiarEnNube(cambio) {
    let remota = null;
    try {
        const res = await callApiSocios('getConfig');
        if (res && res.status === 'success' && res.data) {
            // Si la fila todavía no existe (primer uso), la base es la lista
            // local; si existiera y se ignorara, se perderían los que ya hay.
            remota = res.data.responsables ? JSON.parse(res.data.responsables) : responsables_cargar();
        }
    } catch(e) { remota = null; }

    if (!Array.isArray(remota)) {
        showToast('Sin conexión con la nube — el cambio no se guardó. Intenta de nuevo.', 'error');
        return null;
    }

    const id = r => r.ini + '|' + r.area;
    let lista = remota.map(r => ({ ini: r.ini, area: r.area }));

    if (cambio.agregar) {
        if (lista.some(r => id(r) === id(cambio.agregar))) {
            // Puede existir en la nube aunque este equipo aún no lo viera.
            responsables_aplicarDesdeNube(lista);
            showToast('Ese responsable ya existe', 'error');
            return null;
        }
        lista.push({ ini: cambio.agregar.ini, area: cambio.agregar.area });
    }
    if (cambio.quitar) {
        lista = lista.filter(r => id(r) !== id(cambio.quitar));
    }

    const res2 = await callApiSocios('setConfig', { clave: 'responsables', valor: JSON.stringify(lista) });
    if (!res2 || res2.status !== 'success') {
        showToast('No se pudo guardar en la nube. Intenta de nuevo.', 'error');
        return null;
    }

    responsables_guardarLocal(responsables_fusionar(lista));
    responsables_avisarCambio();
    return lista;
}

// ── Tiempo real: que el alta se vea en los otros equipos sin recargar ──
// `postgres_changes` solo llega si `config_sistema` está en la publicación de
// realtime; el broadcast funciona siempre que los dos equipos tengan la app
// abierta. Se usan los dos, y el que no esté disponible simplemente no suena.
let _cfgRtListo = false, _cfgCanal = null;
function config_initRealtime() {
    if (_cfgRtListo || typeof dbSoc === 'undefined') return;
    _cfgRtListo = true;
    const refrescar = () => { cfg_cargarDesdeSupabase().catch(() => {}); };
    try {
        _cfgCanal = dbSoc.channel('config-sistema-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'config_sistema' }, refrescar)
            .on('broadcast', { event: 'responsables' }, refrescar)
            .subscribe();
    } catch (e) {
        console.warn('[config] realtime no disponible:', e);
        _cfgCanal = null;
    }
}
function responsables_avisarCambio() {
    if (!_cfgCanal) return;
    try { _cfgCanal.send({ type: 'broadcast', event: 'responsables', payload: { ts: Date.now() } }); }
    catch (e) { /* sin conexión: el otro equipo se entera al recargar */ }
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
async function responsables_agregar() {
    const ini  = document.getElementById('resp-new-ini').value.trim().toUpperCase();
    const area = document.getElementById('resp-new-area').value.trim().toUpperCase();
    if (!ini || !area) return showToast('Completa iniciales y área', 'error');
    const lista = await responsables_cambiarEnNube({ agregar: { ini, area } });
    if (!lista) return;
    document.getElementById('resp-new-ini').value = '';
    document.getElementById('resp-new-area').value = '';
    responsables_renderLista();
    showToast('Responsable agregado', 'success');
}
async function responsables_eliminar(idx) {
    // Por identidad y no por posición: la lista puede haberse refrescado desde
    // otro dispositivo entre que se dibujó el botón y se tocó.
    const r = responsables_cargar()[idx];
    if (!r) return;
    const lista = await responsables_cambiarEnNube({ quitar: { ini: r.ini, area: r.area } });
    if (!lista) return;
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
        // El "tiene PIN" se decide con la MISMA fuente que usa la validación al
        // guardar (cfg_guardarRespPin): nube primero, local después. Si se mira
        // solo `r.pin` puede pasar que el formulario no dibuje el campo
        // "PIN actual" y que guardar igual lo exija — dejando el cambio trabado.
        const pinEfectivo = (typeof credencialesCache === 'object' && credencialesCache[r.ini + '|' + r.area]) || r.pin || '';
        const tienePinPropio = !!pinEfectivo;
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
                <div style="font-size:0.72em;color:#7f8c8d;line-height:1.45;margin:-6px 0 10px;">
                    ${tienePinPropio
                        ? 'Escribe tu <b>PIN actual</b> para autorizar el cambio y, abajo, el <b>PIN nuevo</b> dos veces.'
                        : 'Escribe el <b>PIN nuevo</b> dos veces. Son 4 dígitos.'}
                </div>

                ${tienePinPropio ? `
                <!-- Campo PIN actual (solo cuando ya tiene PIN) -->
                <div id="cfg-pin-actual-wrap-${i}">
                    <label style="font-size:0.75em;color:#7f8c8d;display:block;margin-bottom:4px;">PIN actual — el que usas hoy para entrar</label>
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
                        <label style="font-size:0.75em;color:#7f8c8d;display:block;margin-bottom:4px;">Repetir el nuevo PIN</label>
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

    cfg_ojosEnTodos(cont);
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
        const campoActual = document.getElementById('cfg-rpin-actual-' + idx);
        // Si se va a exigir el PIN actual, el campo TIENE que existir. Si no está,
        // el formulario se dibujó desactualizado: se redibuja en vez de rechazar
        // con "PIN incorrecto", que era lo que dejaba el cambio sin salida.
        if (!campoActual) {
            cfg_renderResponsables();
            const form = document.getElementById('cfg-pin-form-' + idx);
            if (form) form.style.display = 'block';
            return setMsg('var(--danger)', '⚠️ Faltaba el campo del PIN actual. Ya está arriba: escríbelo y vuelve a intentar.');
        }
        const pinActual = (campoActual.value || '').trim();
        if (!pinActual) return setMsg('var(--danger)', '❌ Escribe tu PIN actual (el que usas hoy para entrar).');
        if (pinActual !== pinExistente) {
            return setMsg('var(--danger)', '❌ El PIN actual no es correcto. Si no lo recuerdas, usa "¿Olvidaste tu PIN personal?" más abajo.');
        }
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
        // Solo local: el PIN vive en `responsable_creds` y la lista compartida
        // de `config_sistema` no cambia.
        responsables_guardarLocal(lista);
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
        responsables_guardarLocal(lista);
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

async function cfg_agregarResponsable() {
    const ini  = (document.getElementById('cfg-resp-ini').value || '').trim().toUpperCase();
    const area = (document.getElementById('cfg-resp-area').value || '').trim().toUpperCase();
    if (!ini || !area) return showToast('Ingresa las iniciales y el área', 'error');
    const lista = await responsables_cambiarEnNube({ agregar: { ini, area } });
    if (!lista) return;   // no se pudo guardar: el aviso ya salió
    document.getElementById('cfg-resp-ini').value = '';
    document.getElementById('cfg-resp-area').value = '';
    cfg_renderResponsables();
    responsables_poblarSelector();
    responsables_poblarLoginSelector();
    showToast('✅ Responsable agregado — ya está en todos los dispositivos', 'success');
}
async function cfg_eliminarResponsable(idx) {
    // Por identidad y no por posición, que la lista puede haberse refrescado
    // desde otro dispositivo justo antes del toque.
    const r = responsables_cargar()[idx];
    if (!r) return;
    if (!confirm('¿Quitar a ' + r.ini + ' (' + r.area + ')?')) return;
    const lista = await responsables_cambiarEnNube({ quitar: { ini: r.ini, area: r.area } });
    if (!lista) return;
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
    const ultimo = localStorage.getItem(LAST_RESP_KEY) || '';
    sel.innerHTML = '<option value="">— Selecciona tu nombre —</option>';
    lista.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.ini + '|' + r.area;
        opt.textContent = r.ini + ' (' + r.area + ')';
        if (opt.value === ultimo) opt.selected = true;
        sel.appendChild(opt);
    });
    // Actualizar hint de PIN si quedó un responsable preseleccionado
    if (ultimo && typeof actualizarHintPin === 'function') actualizarHintPin();
}

// ══════════════════════════════════════════════════════════
// OJITO PARA VER LA CONTRASEÑA
// Se aplica a cualquier <input type="password">, envolviéndolo en un
// contenedor relativo y colgando el botón adentro. Es idempotente, así que
// se puede llamar de nuevo cada vez que se redibuja un formulario.
// ══════════════════════════════════════════════════════════

function cfg_ponerOjo(inp) {
    if (!inp || inp.dataset.ojo === '1' || inp.type !== 'password') return;
    // El PIN del login YA trae su propio ojo (#pinEye) puesto en el HTML.
    // Sin esta guarda quedaban dos ojos encimados, y el de abajo era una
    // zona tocable de 31x25 que interceptaba el toque del bueno.
    if (inp.id === 'pinInput' || (inp.parentNode && inp.parentNode.querySelector('.pin-eye'))) return;
    inp.dataset.ojo = '1';

    const cont = document.createElement('div');
    cont.style.cssText = 'position:relative;display:block;';
    inp.parentNode.insertBefore(cont, inp);
    cont.appendChild(inp);

    // Se acolcha por los dos lados para no descentrar los PIN, que van
    // con text-align:center.
    inp.style.paddingRight = '38px';
    inp.style.paddingLeft = '38px';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '👁';
    btn.title = 'Ver';
    btn.setAttribute('aria-label', 'Mostrar u ocultar');
    // 44x44 de zona tocable: el ícono se ve igual, pero en un teléfono se
    // acierta. Con padding 4px 7px quedaba en 31x25, muy chico para el dedo.
    btn.style.cssText = 'position:absolute;right:0;top:50%;transform:translateY(-50%);'
        + 'background:none;border:none;cursor:pointer;font-size:1.05em;line-height:1;'
        + 'min-width:44px;min-height:44px;display:inline-flex;align-items:center;'
        + 'justify-content:center;opacity:0.55;-webkit-tap-highlight-color:transparent;';
    btn.onclick = () => {
        const mostrar = inp.type === 'password';
        inp.type = mostrar ? 'text' : 'password';
        btn.textContent = mostrar ? '🙈' : '👁';
        btn.title = mostrar ? 'Ocultar' : 'Ver';
        btn.style.opacity = mostrar ? '1' : '0.55';
    };
    cont.appendChild(btn);
}

function cfg_ojosEnTodos(raiz) {
    try {
        (raiz || document).querySelectorAll('input[type="password"]').forEach(cfg_ponerOjo);
    } catch(e) {}
}
