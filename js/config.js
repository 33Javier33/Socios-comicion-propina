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
function cfg_renderResponsables() {
    const cont = document.getElementById('cfg-responsables-lista');
    if (!cont) return;
    const lista = responsables_cargar();
    if (!lista.length) {
        cont.innerHTML = '<div style="color:#7f8c8d;font-size:0.85em;text-align:center;padding:10px;">No hay responsables configurados</div>';
        return;
    }
    cont.innerHTML = lista.map((r, i) =>
        '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:6px;">'
        + '<div style="display:flex;align-items:center;gap:10px;">'
        + '<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;">' + r.ini.charAt(0) + '</div>'
        + '<div><div style="font-weight:700;font-size:0.9em;">' + r.ini + '</div><div style="font-size:0.75em;color:#7f8c8d;">' + r.area + '</div></div>'
        + '</div>'
        + '<button onclick="cfg_eliminarResponsable(' + i + ')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:0.8em;font-weight:700;">✕ Quitar</button>'
        + '</div>'
    ).join('');
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
