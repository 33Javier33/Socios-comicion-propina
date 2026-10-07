// ============================================================
// API: LLAMADAS AL BACKEND DE GOOGLE APPS SCRIPT
// ============================================================

async function callApiSocios(action, payload = null) {
    if (!payload) {
        const response = await fetch(`${URL_SOCIOS}?action=${action}`);
        return await response.json();
    }
    // Inyectar responsable de sesión para trazabilidad en auditoría
    const rObj = getSesionResponsableObj();
    const responsableAudit = rObj.ini ? (rObj.ini + (rObj.area ? ' ' + rObj.area : '')) : undefined;
    const opts = {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...(responsableAudit && !payload.responsable ? { responsable: responsableAudit } : {}), ...payload })
    };
    const response = await fetch(URL_SOCIOS, opts);
    return await response.json();
}

// ── Credenciales (PINs personales desde Google Sheets) ───
async function cargarCredenciales() {
    try {
        const res = await callApiSocios('getCredenciales');
        if (res.status === 'success') {
            credencialesCache = {};
            (res.data || []).forEach(c => {
                if (c.ini && c.area && c.pin) {
                    credencialesCache[c.ini + '|' + c.area] = c.pin;
                }
            });
            // Sincronizar badges locales (🔐/🔓) con lo que hay en la nube
            _sincronizarPinsLocales();
        }
    } catch(e) {
        // Silencioso — si falla la red, se usa lo que haya en localStorage
    }
}

function _sincronizarPinsLocales() {
    const lista = responsables_cargar();
    let cambios = false;
    lista.forEach(r => {
        const key     = r.ini + '|' + r.area;
        const pinNube = credencialesCache[key];
        // Solo actualiza local si la nube tiene un PIN para este usuario
        // NUNCA borra pines locales desde aquí — eso solo lo hace cfg_quitarRespPin
        if (pinNube && r.pin !== pinNube) { r.pin = pinNube; cambios = true; }
    });
    if (cambios) responsables_guardar(lista);
}

async function fetchSociosDeGoogle() {
    const cachedSocios = leerCache(CACHE_KEY_SOCIOS);
    const cachedDias = leerCache(CACHE_KEY_DIAS);
    if (cachedSocios && cachedDias) {
        globalDiasPT = cachedDias;
        cacheSocios = cachedSocios.map(procesarSocioDesdeGoogle);
        renderizarCards();
        renderizarListaBusqueda();
        toggleLoader(false);
        actualizarSociosSilencioso();
        return;
    }
    toggleLoader(true, "Obteniendo datos...");
    await actualizarSociosSilencioso();
}

async function actualizarSociosSilencioso() {
    try {
        const [resDias, res] = await Promise.all([
            callApiSocios('getDiasPartTime'),
            callApiSocios('getSocios')
        ]);
        if (resDias.status === 'success') {
            globalDiasPT = resDias.data || {};
            guardarCache(CACHE_KEY_DIAS, resDias.data || {});
        }
        if (res.status === 'success') {
            guardarCache(CACHE_KEY_SOCIOS, res.data);
            cacheSocios = res.data.map(procesarSocioDesdeGoogle);
            renderizarCards();
            renderizarListaBusqueda();
            verificarEscalamientos();
            setTimeout(notificarEscalamientosMes, 1500);
        } else { showToast('Error: ' + res.message, 'error'); }
        // Actualizar tarjeta Total Puntos PT con los días y socios ya cargados
        if (typeof recalcularTotalPT === 'function') recalcularTotalPT();
    } catch (e) { console.error(e); showToast('Error de conexión', 'error'); } finally { toggleLoader(false); }
}

let _dbgSocio = true; // log solo el primer socio
function procesarSocioDesdeGoogle(s) {
    const fechaStr = s.FechaIngreso;
    if(!fechaStr) return { ...s, anios: 0, puntos: 0, puntosActivos: false, visible: false };

    // ── Cuándo empiezan los puntos y cuándo suben ──
    // Sale de reglaPuntosFechas (js/constants.js), que aplica la política:
    // primera entrega = el primer día 15 al cumplir un mes de contrato;
    // aumento = cada 15 del mes de INGRESO.
    //
    // Antes esto solo le cambiaba el día a 15 dejando el mismo mes, y no
    // cumplía ninguno de los tres casos de la política: a quien entraba el
    // 4 de septiembre le daba puntos el 15 de septiembre (un mes antes), y
    // a quien entraba el 23 de octubre se los daba el 15 de octubre — o
    // sea, ANTES de haber entrado.
    //
    // `FechaInicioPuntos`, si viene cargada, sigue mandando: es la salida
    // manual para los casos que no siguen la regla. Se usa tal cual, solo
    // normalizada al 15 de su mes.
    const _hayOverride = !!(s.FechaInicioPuntos && String(s.FechaInicioPuntos).trim()
                            && String(s.FechaInicioPuntos).trim() !== String(fechaStr).trim());
    const _reglaFechas = reglaPuntosFechas(_hayOverride ? String(s.FechaInicioPuntos).trim() : fechaStr);
    if (!_reglaFechas) return { ...s, anios: 0, puntos: 0, puntosActivos: false, visible: false };

    let fechaParaPuntos, mes15, año15, anios;
    const fechaActual = new Date();
    if (_hayOverride) {
        // Override: ese mes, día 15, y de ahí los aniversarios cada año.
        const q = String(s.FechaInicioPuntos).trim().substring(0,10).split('-').map(Number);
        año15 = q[0]; mes15 = q[1] - 1;
        fechaParaPuntos = new Date(año15, mes15, 15);
        anios = fechaActual.getFullYear() - año15;
        if (fechaActual.getMonth() < mes15 ||
            (fechaActual.getMonth() === mes15 && fechaActual.getDate() < 15)) anios--;
        if (anios < 0) anios = 0;
    } else {
        fechaParaPuntos = _reglaFechas.primeraEntrega;
        mes15 = _reglaFechas.mesAniversario;
        año15 = _reglaFechas.anioIngreso;
        anios = aniosPuntosA(fechaStr, fechaActual);
    }
    const fechaPuntosStr = fechaParaPuntos.getFullYear() + '-'
        + String(fechaParaPuntos.getMonth() + 1).padStart(2, '0') + '-15';

    // Los puntos recién existen desde la primera entrega.
    const visible = fechaActual >= fechaParaPuntos;

    const puntosActivos = visible; // puntos activos solo si ya pasó el día 15
    const areaNorm = (s.Area || '').toLowerCase().trim();
    if (_dbgSocio) { _dbgSocio = false; console.log('[DBG-SOCIO] FechaIngreso:', fechaStr, '| FechaInicioPuntos:', s.FechaInicioPuntos, '| año15:', año15, '| mes15:', mes15, '| fechaParaPuntos:', fechaParaPuntos, '| visible:', visible, '| Puntos SB:', s.Puntos); }

    if (areaNorm === 'gastoscomision' || areaNorm.includes('gastos')) {
        return { id: s.ID, nombre: s.Nombre, apellido: s.Apellido, area: 'GastosComision', contrato: s.TipoContrato, fechaIngreso: fechaStr, fechaInicioPuntos: fechaPuntosStr, anios: 0, puntos: puntosActivos ? 1 : 0, puntosActivos, visible, rut: s.Rut || "", fotoUrl: s.FotoUrl || "", correo: s.Correo || "" };
    }
    // Base y tope salen de reglaPuntosArea (js/constants.js): un solo lugar
    // para los dos, y la comparación va sin tildes — antes 'bóveda' no calzaba
    // con 'boveda' y a esos socios se les aplicaba el base 4 en vez del 2.
    const _regla = reglaPuntosArea(s.Area);
    const puntosMaximos = _regla.tope;
    const puntosBase = _regla.base;
    // puntosMaxPosible: lo que corresponde por fórmula (para detectar escalamientos en verificarEscalamientos)
    const puntosMaxPosible = puntosActivos ? Math.min(puntosBase + (anios * 2), puntosMaximos) : 0;
    // puntosFinales: usa el valor guardado en Supabase si es positivo; 0 y null se tratan como "sin dato" → usa fórmula
    const ptsSB = Number(s.Puntos);
    const puntosFinales = (Number.isFinite(ptsSB) && ptsSB > 0) ? ptsSB : puntosMaxPosible;
    return { id: s.ID, nombre: s.Nombre, apellido: s.Apellido, area: areaNorm, contrato: s.TipoContrato, fechaIngreso: fechaStr, fechaInicioPuntos: fechaPuntosStr, anios, puntos: puntosFinales, puntosMaxPosible, puntosActivos, visible, mesAniversario: mes15, rut: s.Rut || "", fotoUrl: s.FotoUrl || "", correo: s.Correo || "" };
}
