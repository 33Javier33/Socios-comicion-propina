// ============================================================
// API: LLAMADAS AL BACKEND DE GOOGLE APPS SCRIPT
// ============================================================

async function callApiSocios(action, payload = null) {
    if (!payload) {
        const response = await fetch(`${URL_SOCIOS}?action=${action}`);
        return await response.json();
    }
    const opts = {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...payload })
    };
    const response = await fetch(URL_SOCIOS, opts);
    return await response.json();
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
    } catch (e) { console.error(e); showToast('Error de conexión', 'error'); } finally { toggleLoader(false); }
}

function procesarSocioDesdeGoogle(s) {
    const fechaStr = s.FechaIngreso;
    if(!fechaStr) return { ...s, anios: 0, puntos: 0, puntosActivos: false, visible: false };

    // ── Obtener fecha_inicio_puntos y normalizarla al día 15 ──
    const fechaPuntosRaw = (s.FechaInicioPuntos && s.FechaInicioPuntos.trim()) ? s.FechaInicioPuntos.trim() : fechaStr;
    const partesPuntosRaw = fechaPuntosRaw.split('-');
    // Forzar día 15 (regla del día 15)
    const año15  = parseInt(partesPuntosRaw[0]);
    const mes15  = parseInt(partesPuntosRaw[1]) - 1; // 0-indexed
    const fechaPuntosStr = año15 + '-' + String(parseInt(partesPuntosRaw[1])).padStart(2,'0') + '-15';

    // Construir fecha de inicio de puntos siempre en día 15
    const fechaParaPuntos = new Date(año15, mes15, 15);
    const fechaActual = new Date();

    // ── Regla 2: visible solo si hoy >= día 15 del mes de inicio ──
    const visible = fechaActual >= fechaParaPuntos;

    // ── Regla 3: años = ciclos completos de 12 meses desde el día 15 ──
    // El aumento ocurre exactamente el día 15 de cada año aniversario
    let anios = fechaActual.getFullYear() - año15;
    // Retroceder 1 año si aún no llegó el día 15 de este año
    if (
        fechaActual.getMonth() < mes15 ||
        (fechaActual.getMonth() === mes15 && fechaActual.getDate() < 15)
    ) { anios--; }
    if (anios < 0) anios = 0;

    const puntosActivos = visible; // puntos activos solo si ya pasó el día 15
    const areaNorm = (s.Area || '').toLowerCase().trim();

    if (areaNorm === 'gastoscomision' || areaNorm.includes('gastos')) {
        return { id: s.ID, nombre: s.Nombre, apellido: s.Apellido, area: 'GastosComision', contrato: s.TipoContrato, fechaIngreso: fechaStr, fechaInicioPuntos: fechaPuntosStr, anios: 0, puntos: puntosActivos ? 1 : 0, puntosActivos, visible };
    }
    let puntosMaximos = 10;
    if (areaNorm === 'mesas') puntosMaximos = 20;
    else if (areaNorm === 'maquinas') puntosMaximos = 12;
    else if (areaNorm === 'tecnicos') puntosMaximos = 12;
    else if (areaNorm === 'boveda') puntosMaximos = 10;
    else if (areaNorm.includes('cambista')) puntosMaximos = 8;
    const puntosBase = 4;
    // Puntos = base + (años completos de ciclo × 2), nunca supera el máximo
    let puntosCalculados = puntosBase + (anios * 2);
    let puntosFinales = puntosActivos ? Math.min(puntosCalculados, puntosMaximos) : 0;
    return { id: s.ID, nombre: s.Nombre, apellido: s.Apellido, area: areaNorm, contrato: s.TipoContrato, fechaIngreso: fechaStr, fechaInicioPuntos: fechaPuntosStr, anios, puntos: puntosFinales, puntosActivos, visible };
}
