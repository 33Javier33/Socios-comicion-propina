// ============================================================
// USUARIOS DIARIO.PROPI — gestión de PIN de acceso (tabla diario_pins)
// Permite crear, cambiar y quitar el PIN de cada socio que usa diario.propi.
// SEGURIDAD: los PIN ya NO se leen desde el navegador. La tabla diario_pins
// está cerrada al rol anon; todo pasa por la Edge Function pin-auth
// (service_role). Aquí solo se puede saber si un socio TIENE PIN o no, y
// crear/cambiar/quitar — nunca ver el valor. Protegido por la clave de
// recuperación en la interfaz.
// ============================================================

const _PIN_AUTH_URL = _SB_URL_SOC + '/functions/v1/pin-auth';
const _DP_ADMIN_SECRET = 'pinadm_7b3e9c1a4f8d2056';

async function _dpAdmin(body) {
    try {
        const res = await fetch(_PIN_AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + _SB_KEY_SOC,
                'apikey': _SB_KEY_SOC
            },
            body: JSON.stringify(Object.assign({ adminSecret: _DP_ADMIN_SECRET }, body || {}))
        });
        return await res.json();
    } catch(e) { return { ok: false, reason: String(e && e.message || e) }; }
}

let _dpUnlocked = false;
let _dpArea = 'Mesas';
let _dpPins = {};       // socio_id → { hasPin }
const DP_AREAS = ['Mesas', 'Maquinas', 'Tecnicos', 'Cambistas'];

function _dpNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

// Socios de cacheSocios que pertenecen al área elegida (filtro tolerante)
function _dpSociosArea(areaSel) {
    const target = _dpNorm(areaSel);
    return (Array.isArray(cacheSocios) ? cacheSocios : []).filter(s => {
        const a = _dpNorm(s.area);
        if (target === 'cambistas') return a.includes('cambist');
        if (target === 'mesas')     return a.includes('mesa') && !a.includes('cambist');
        if (target === 'maquinas')  return a.includes('maquina');
        if (target === 'tecnicos')  return a.includes('tecnic');
        return a === target;
    }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
}

function dp_init() {
    const gate = document.getElementById('dp-gate');
    const cont = document.getElementById('dp-contenido');
    if (_dpUnlocked) {
        if (gate) gate.style.display = 'none';
        if (cont) cont.style.display = 'block';
        dp_cargar();
    } else {
        if (gate) gate.style.display = 'block';
        if (cont) cont.style.display = 'none';
        const inp = document.getElementById('dp-clave');
        if (inp) inp.value = '';
        const err = document.getElementById('dp-clave-error');
        if (err) err.style.display = 'none';
    }
}

function dp_desbloquear() {
    const inp = document.getElementById('dp-clave');
    const err = document.getElementById('dp-clave-error');
    const clave = (inp?.value || '').trim();
    const claveOk = (typeof cfg_getClaveRecup === 'function') ? cfg_getClaveRecup() : CLAVE_RECUP;
    if (clave !== claveOk) {
        if (err) { err.textContent = '❌ Clave de recuperación incorrecta.'; err.style.display = 'block'; }
        return;
    }
    _dpUnlocked = true;
    dp_init();
}

function dp_setArea(area) {
    _dpArea = area;
    DP_AREAS.forEach(a => {
        const btn = document.getElementById('dp-area-' + a);
        if (btn) {
            const activo = a === area;
            btn.style.background = activo ? '#2563eb' : 'white';
            btn.style.color = activo ? 'white' : '#2563eb';
        }
    });
    dp_render();
}

async function dp_cargar() {
    const lista = document.getElementById('dp-lista');
    if (lista) lista.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.9em;">⏳ Cargando...</div>';
    try {
        const r = await _dpAdmin({ action: 'diarioAdminList' });
        _dpPins = {};
        if (r && r.ok) (r.data || []).forEach(x => { _dpPins[x.socio_id] = { hasPin: !!x.hasPin }; });
    } catch(e) { _dpPins = {}; }
    dp_setArea(_dpArea);
}

function dp_render() {
    const lista = document.getElementById('dp-lista');
    if (!lista) return;
    const socios = _dpSociosArea(_dpArea);

    if (!socios.length) {
        lista.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.9em;">Sin socios en esta área.</div>';
        return;
    }

    lista.innerHTML = socios.map(s => {
        const rec = _dpPins[s.id];
        const tienePin = !!(rec && rec.hasPin);
        const badge = tienePin
            ? '<span style="background:#dcfce7;color:#166534;font-size:0.66em;font-weight:800;padding:2px 7px;border-radius:5px;">CON PIN</span>'
            : '<span style="background:#fee2e2;color:#991b1b;font-size:0.66em;font-weight:800;padding:2px 7px;border-radius:5px;">SIN PIN</span>';
        const btnQuitar = tienePin
            ? `<button onclick="dp_quitarPin('${s.id}')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:5px 9px;font-size:0.74em;font-weight:700;cursor:pointer;">🗑</button>` : '';
        return `<div style="background:white;border-radius:10px;border:1px solid #e2e8f0;padding:11px 13px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <div style="flex:1;min-width:0;display:flex;align-items:center;gap:9px;">
                    ${avatarHTML(s.fotoUrl, s.nombre, 34)}
                    <div style="min-width:0;">
                        <div style="font-weight:800;font-size:0.92em;color:#0f172a;">${_htmlEscDp(s.nombre)} ${_htmlEscDp(s.apellido)}</div>
                        <div style="font-size:0.72em;color:#64748b;margin-top:2px;">${badge}</div>
                    </div>
                </div>
                <div style="display:flex;gap:5px;flex-shrink:0;">${btnQuitar}</div>
            </div>
            <div style="display:flex;gap:6px;margin-top:9px;">
                <input type="password" id="dp-inp-${s.id}" inputmode="numeric" maxlength="4" placeholder="${tienePin ? 'Nuevo PIN (4 díg.)' : 'Crear PIN (4 díg.)'}"
                    style="flex:1;padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:0.9em;text-align:center;letter-spacing:3px;box-sizing:border-box;">
                <button onclick="dp_guardarPin('${s.id}')" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;border:none;border-radius:7px;padding:7px 14px;font-size:0.82em;font-weight:800;cursor:pointer;white-space:nowrap;">${tienePin ? 'Cambiar' : 'Crear'}</button>
            </div>
        </div>`;
    }).join('');
}

async function dp_guardarPin(socioId) {
    const inp = document.getElementById('dp-inp-' + socioId);
    const pin = (inp?.value || '').trim();
    if (!/^\d{4}$/.test(pin)) { showToast('El PIN debe ser de 4 dígitos', 'error'); return; }
    const socio = (cacheSocios || []).find(s => s.id === socioId);
    const nombre = socio ? ((socio.nombre || '') + ' ' + (socio.apellido || '')).trim() : '';
    toggleLoader(true, 'Guardando PIN...');
    try {
        const r = await _dpAdmin({ action: 'diarioAdminSet', socioId, pin, nombre, area: _dpArea });
        if (!r || !r.ok) throw new Error(r && r.reason ? r.reason : 'No se pudo guardar');
        if (typeof sbAuditLog === 'function') {
            sbAuditLog('PIN Diario Actualizado', { detalle: `PIN de diario.propi actualizado para ${nombre}`, idAfectado: socioId, datos: { socio_id: socioId, area: _dpArea } });
        }
        _dpPins[socioId] = { hasPin: true };
        showToast('PIN guardado ✅', 'success');
        dp_render();
    } catch(e) {
        showToast('Error al guardar: ' + e.message, 'error');
    } finally {
        toggleLoader(false);
    }
}

async function dp_quitarPin(socioId) {
    if (!confirm('¿Quitar el PIN de este usuario? Tendrá que crear uno nuevo la próxima vez que entre.')) return;
    toggleLoader(true, 'Quitando PIN...');
    try {
        const r = await _dpAdmin({ action: 'diarioAdminDelete', socioId });
        if (!r || !r.ok) throw new Error(r && r.reason ? r.reason : 'No se pudo eliminar');
        const socio = (cacheSocios || []).find(s => s.id === socioId);
        const nombre = socio ? ((socio.nombre || '') + ' ' + (socio.apellido || '')).trim() : '';
        if (typeof sbAuditLog === 'function') {
            sbAuditLog('PIN Diario Eliminado', { detalle: `PIN de diario.propi eliminado para ${nombre}`, idAfectado: socioId, datos: { socio_id: socioId } });
        }
        delete _dpPins[socioId];
        showToast('PIN eliminado', 'success');
        dp_render();
    } catch(e) {
        showToast('Error al eliminar: ' + e.message, 'error');
    } finally {
        toggleLoader(false);
    }
}

function _htmlEscDp(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
