// ============================================================
// LLAMADAS RPC SEGURAS (endurecimiento de seguridad — Fase 1)
// Las operaciones sensibles se validan EN EL SERVIDOR mediante funciones
// SECURITY DEFINER de Supabase, no en el navegador.
//
// El secreto de servicio NO vive en el código: se pide una vez por sesión
// y queda solo en sessionStorage de ese dispositivo.
// ============================================================

const RPC_SECRET_KEY = 'fs_secreto_servicio';

function rpcGetSecreto() {
    try { return sessionStorage.getItem(RPC_SECRET_KEY) || ''; } catch (e) { return ''; }
}
function rpcSetSecreto(s) {
    try { sessionStorage.setItem(RPC_SECRET_KEY, s || ''); } catch (e) {}
}
function rpcOlvidarSecreto() {
    try { sessionStorage.removeItem(RPC_SECRET_KEY); } catch (e) {}
}

// Pide el secreto al administrador si aún no está en esta sesión.
function rpcPedirSecreto(motivo) {
    let s = rpcGetSecreto();
    if (s) return s;
    s = prompt((motivo ? motivo + '\n\n' : '') +
        'Clave de servicio (la entrega el administrador).\nSe guarda solo en este dispositivo mientras dure la sesión.');
    if (s) rpcSetSecreto(s.trim());
    return rpcGetSecreto();
}

// Ejecuta una RPC que exige el secreto de servicio.
// Devuelve { ok, data, error }.
async function rpcSegura(nombre, params, motivo) {
    const secreto = rpcPedirSecreto(motivo);
    if (!secreto) return { ok: false, error: 'Sin clave de servicio' };
    try {
        const { data, error } = await dbSoc.rpc(nombre, Object.assign({}, params || {}, { p_secreto: secreto }));
        if (error) {
            const msg = String(error.message || '');
            if (msg.indexOf('Credenciales') >= 0) {
                rpcOlvidarSecreto();
                return { ok: false, error: 'Clave de servicio incorrecta' };
            }
            if (msg.indexOf('Bloqueado') >= 0) return { ok: false, error: 'Demasiados intentos. Espera 15 minutos.' };
            return { ok: false, error: msg };
        }
        return { ok: true, data };
    } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
    }
}

// ── RPC de autenticación (no requieren el secreto de servicio) ──
async function rpcVerificarPinResponsable(ini, area, pin) {
    try {
        const { data, error } = await dbSoc.rpc('rpc_verificar_pin_responsable',
            { p_ini: ini, p_area: area, p_pin: String(pin) });
        if (error) return { ok: false, motivo: error.message };
        return data || { ok: false };
    } catch (e) { return { ok: false, motivo: String(e && e.message || e) }; }
}
async function rpcVerificarPinGlobal(pin) {
    try {
        const { data, error } = await dbSoc.rpc('rpc_verificar_pin_global', { p_pin: String(pin) });
        if (error) return { ok: false, motivo: error.message };
        return data || { ok: false };
    } catch (e) { return { ok: false, motivo: String(e && e.message || e) }; }
}
async function rpcVerificarClaveRecup(clave) {
    try {
        const { data, error } = await dbSoc.rpc('rpc_verificar_clave_recup', { p_clave: String(clave) });
        if (error) return { ok: false, motivo: error.message };
        return data || { ok: false };
    } catch (e) { return { ok: false, motivo: String(e && e.message || e) }; }
}
async function rpcResponsablesLista() {
    try {
        const { data, error } = await dbSoc.rpc('rpc_responsables_lista');
        if (error) return [];
        return data || [];
    } catch (e) { return []; }
}
