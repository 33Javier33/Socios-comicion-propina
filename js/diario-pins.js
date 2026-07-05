// ============================================================
// USUARIOS DIARIO.PROPI — gestión de PIN de acceso (tabla diario_pins)
// Permite ver (recuperar), crear y modificar el PIN de cada socio
// que usa la app diario.propi. Protegido por la clave de recuperación.
// ============================================================

let _dpUnlocked = false;
let _dpArea = 'Mesas';
let _dpPins = {};       // socio_id → { pin, nombre, area }
const DP_AREAS = ['Mesas', 'Maquinas', 'Tecnicos', 'Cambistas'];

function _dpNorm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

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
        const { data } = await dbSoc.from('diario_pins').select('socio_id, pin, nombre, area');
        _dpPins = {};
        (data || []).forEach(r => { _dpPins[r.socio_id] = r; });
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
        const tienePin = rec && rec.pin;
        const badge = tienePin
            ? '<span style="background:#dcfce7;color:#166534;font-size:0.66em;font-weight:800;padding:2px 7px;border-radius:5px;">CON PIN</span>'
            : '<span style="background:#fee2e2;color:#991b1b;font-size:0.66em;font-weight:800;padding:2px 7px;border-radius:5px;">SIN PIN</span>';
        const pinView = `<span id="dp-pinval-${s.id}" style="font-family:monospace;font-weight:800;letter-spacing:2px;color:#0f172a;">${tienePin ? '••••' : '—'}</span>`;
        const btnVer = tienePin
            ? `<button onclick="dp_verPin('${s.id}')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:6px;padding:5px 9px;font-size:0.74em;font-weight:700;cursor:pointer;">👁 Ver</button>` : '';
        const btnQuitar = tienePin
            ? `<button onclick="dp_quitarPin('${s.id}')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:5px 9px;font-size:0.74em;font-weight:700;cursor:pointer;">🗑</button>` : '';
        return `<div style="background:white;border-radius:10px;border:1px solid #e2e8f0;padding:11px 13px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.92em;color:#0f172a;">${_htmlEscDp(s.nombre)} ${_htmlEscDp(s.apellido)}</div>
                    <div style="font-size:0.72em;color:#64748b;margin-top:2px;">PIN actual: ${pinView} ${badge}</div>
                </div>
                <div style="display:flex;gap:5px;flex-shrink:0;">${btnVer}${btnQuitar}</div>
            </div>
            <div style="display:flex;gap:6px;margin-top:9px;">
                <input type="password" id="dp-inp-${s.id}" inputmode="numeric" maxlength="4" placeholder="${tienePin ? 'Nuevo PIN (4 díg.)' : 'Crear PIN (4 díg.)'}"
                    style="flex:1;padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:0.9em;text-align:center;letter-spacing:3px;box-sizing:border-box;">
                <button onclick="dp_guardarPin('${s.id}')" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;border:none;border-radius:7px;padding:7px 14px;font-size:0.82em;font-weight:800;cursor:pointer;white-space:nowrap;">${tienePin ? 'Cambiar' : 'Crear'}</button>
            </div>
        </div>`;
    }).join('');
}

function dp_verPin(socioId) {
    const rec = _dpPins[socioId];
    const el = document.getElementById('dp-pinval-' + socioId);
    if (rec && rec.pin && el) {
        const mostrando = el.dataset.shown === '1';
        el.textContent = mostrando ? '••••' : rec.pin;
        el.dataset.shown = mostrando ? '0' : '1';
    }
}

async function dp_guardarPin(socioId) {
    const inp = document.getElementById('dp-inp-' + socioId);
    const pin = (inp?.value || '').trim();
    if (!/^\d{4}$/.test(pin)) { showToast('El PIN debe ser de 4 dígitos', 'error'); return; }
    const socio = (cacheSocios || []).find(s => s.id === socioId);
    const nombre = socio ? ((socio.nombre || '') + ' ' + (socio.apellido || '')).trim() : '';
    toggleLoader(true, 'Guardando PIN...');
    try {
        const { error } = await dbSoc.from('diario_pins').upsert(
            { socio_id: socioId, nombre, area: _dpArea, pin, updated_at: new Date().toISOString() },
            { onConflict: 'socio_id' }
        );
        if (error) throw error;
        if (typeof sbAuditLog === 'function') {
            sbAuditLog('PIN Diario Actualizado', { detalle: `PIN de diario.propi actualizado para ${nombre}`, idAfectado: socioId, datos: { socio_id: socioId, area: _dpArea } });
        }
        _dpPins[socioId] = { socio_id: socioId, pin, nombre, area: _dpArea };
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
        const { error } = await dbSoc.from('diario_pins').delete().eq('socio_id', socioId);
        if (error) throw error;
        const nombre = _dpPins[socioId]?.nombre || '';
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
