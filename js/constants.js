// ============================================================
// CONSTANTES GLOBALES Y VARIABLES MUTABLES DEL SISTEMA
// ============================================================

// ===== URLs de conexión =====
const URL_SOCIOS = "https://script.google.com/macros/s/AKfycbyr447pMQtsKoBfp8qTcB1uyE3rORhgPPmZM6Fgia3BgmIvtlZ_h04uGZrmx_HwubHQ/exec";
const URL_RECAUDACIONES = "https://script.google.com/macros/s/AKfycbz_kCb4aEe437zHGbRqnjCibw1NtAqfCbTNmsVPn9jaZOPBFaZ6-FwmiTLqVxq39X1P/exec";

// ===== ARQUEO DE CAJA - URLs y constantes =====
const AQ_URL_GET = 'https://script.google.com/macros/s/AKfycbz_kCb4aEe437zHGbRqnjCibw1NtAqfCbTNmsVPn9jaZOPBFaZ6-FwmiTLqVxq39X1P/exec';
const AQ_URL_POST = 'https://script.google.com/macros/s/AKfycbzr0_GPBfp1MuP0YzBUNbwwQAtwr7Nf3oPzX2855_6Fm36T3303_G6TB_7lmE6TnTHLrw/exec';
const AQ_DENOMINACIONES = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10];
const AQ_SK_CONTEO = 'arqueoConteoCLP', AQ_SK_MOVI = 'arqueoMoviDisplayCLP', AQ_SK_RETIROS = 'arqueoRetirosCLP', AQ_SK_BACKUP = 'arqueoBackupHistorial_List';
const AQ_SK_RETIROS_ANTICIPOS = 'arqueoRetirosAnticipos';
const AQ_SK_DIRTY = 'arqueoCambiosPendientes'; // '1' = hay cambios locales sin guardar en nube
const AQ_SK_AUTOMOV = 'arqueoMovimientosAutomaticos'; // de dónde salió lo que nadie tipeó
const AQ_SK_ULT_ARCHIVO = 'arqueoUltimoArchivado';    // huella y hora del último archivado

// ===== RESPONSABLES DE ANTICIPOS =====
const RESP_KEY = 'fondo_responsables';
const RESP_DEFAULT = [
    { ini: 'N.M', area: 'S.J' },
    { ini: 'P.M', area: 'S.J' },
    { ini: 'C.P', area: 'S.J' }
];
const LAST_RESP_KEY = 'fondo_ultimo_responsable';

// ===== CONSTANTES LOGIN =====
const PIN_KEY      = 'fs_pin';
const SESSION_KEY  = 'fs_sesion';
const PIN_DEFAULT  = '1234'; // PIN inicial, se cambia tras recuperación
const CLAVE_RECUP  = 'socios2026';

// ===== INACTIVIDAD =====
const INACTIVIDAD_MS = 15 * 60 * 1000; // 15 minutos

// ===== CACHÉ =====
const CACHE_KEY_SOCIOS = 'fondo_cache_socios_v2';
const CACHE_KEY_DIAS   = 'fondo_cache_dias_v2';
const CACHE_KEY_REC    = 'fondo_cache_recaudacion';
const CACHE_KEY_NOTAS   = 'fondo_cache_notas';
const CACHE_SOCIO_TTL   = 5 * 60 * 1000;
const CACHE_TTL = 30 * 60 * 1000;

// ===== CREDENCIALES (PINs personales — sincronizados con Google Sheets) =====
// Clave: "N.M|S.J"  →  valor: PIN de 4 dígitos
let credencialesCache = {};

// ===== CANJE =====
const CANJE_DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1];

// ===== CONFIGURACIÓN =====
const CLAVE_RECUP_KEY = 'fs_clave_recup';

// ===== SESIÓN RESPONSABLE =====
const SESION_RESP_KEY = 'fs_sesion_responsable';

// ===== LOG =====
const LOG_KEY = 'fondo_log_acciones';

// ===== CACHÉ ALL DATA =====
const CACHE_KEY_ALL_DATA = 'fondo_cache_all_data';

// ============================================================
// VARIABLES GLOBALES MUTABLES
// ============================================================

let cacheSocios = [];
let isEditing = false;
let recDatosRaw = [];
let globalValorPuntoTotal = 0;
let globalMapaPuntosDia = {};
let globalFechasAusenciaSocioActual = new Set();
let globalTieneTerminoContrato = false;

// Arqueo: lista plana de anticipos del período
let aqAnticiposListaPeriodo = [];
let selectedDaysPT = [];
let globalDiasPT = {};

// Arqueo de caja
let aq_conteo = {}, aq_movi = {}, aq_totalRetirado = 0, aq_totalAnticipos = 0, aq_desgloseEsperado = [], aq_denomEditando = null;
let aq_histStates = [], aq_histIdx = -1;
let aq_syncInterval = null; // intervalo de sincronizacion automatica
let aq_snapAlAbrir = null;  // snapshot del conteo al abrir el modal
let _aqAutoSaveTimer = null; // timer para auto-guardado en nube
let _aqDirtyFlag = false;    // true = cambios locales pendientes de guardar en nube

// Calendario Part-Time
let ptCalFecha = new Date();

// Gestión de socios
let gestionFiltroActivo = 'todos';
let gestionSociosConMovimientos = {};
let globalCacheAllData = null; // {anticipos:{id:[...]}, extras:{id:[...]}}
let gestionCargandoFiltro = false;

// Cache individual de socios
const cacheSocioIndividual = {};
let gestionSocioAnticiposActuales = []; // fechas ISO de anticipos del socio activo en pantalla

// Filtros recaudación
let recFiltroTipo    = '';
let recFiltroSinDiv  = false;
let recFiltroConDiv  = false;
let recFiltroFechas  = [];
let _recFiltroCalFecha = new Date();

// Datos agrupados por fecha (populado en procesarDatosRecaudacion)
let globalRecGrupos = {};

// Ayuda
let ayudaFiltroActivo = '';

// Canje
let canjeConteo = {};

// ══════════════════════════════════════════════════════════════════
// PUNTOS POR ÁREA — base, tope y la única excepción
//
// Todos arrancan en 4 puntos y suman +2 por cada año cumplido, hasta el
// tope de su área. BÓVEDA es la única excepción: arranca en 2, con tope 10.
//
// El área se compara SIN TILDES. Venía escrita de varias formas en la base
// ("Bóveda", "Máquinas", "Técnicos") y las comparaciones eran exactas:
// 'bóveda' nunca calzaba con 'boveda', así que a esos socios se les aplicaba
// el base 4 en vez del 2, y Máquinas y Técnicos caían al tope por defecto
// (10) en vez de su 12.
// ══════════════════════════════════════════════════════════════════
const PUNTOS_BASE_NORMAL = 4;
const PUNTOS_BASE_BOVEDA = 2;   // la única excepción
const PUNTOS_TOPE_DEFECTO = 10;

function areaNormalizada(area) {
    return String(area || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, '').trim();
}
function esAreaBoveda(area) { return areaNormalizada(area).includes('boveda'); }

// { base, tope } del área. Un solo lugar: si mañana cambia un tope, cambia acá.
function reglaPuntosArea(area) {
    const a = areaNormalizada(area);
    if (a.includes('gastos')) return { base: 1, tope: 1, gastos: true };
    if (a.includes('boveda')) return { base: PUNTOS_BASE_BOVEDA, tope: 10 };
    let tope = PUNTOS_TOPE_DEFECTO;
    if (a.includes('mesa')) tope = 20;
    else if (a.includes('maquina')) tope = 12;
    else if (a.includes('tecnico')) tope = 12;
    else if (a.includes('cambista')) tope = 8;
    return { base: PUNTOS_BASE_NORMAL, tope };
}

// ══════════════════════════════════════════════════════════════════
// CUÁNDO EMPIEZAN Y CUÁNDO SUBEN LOS PUNTOS
//
// La política, tal cual:
//   · PRIMERA ENTREGA — el día 15 que cae al cumplir el primer mes
//     completo de contrato. Dicho exacto: el PRIMER día 15 que ocurre
//     EN O DESPUÉS de la fecha en que cumple un mes.
//   · RENOVACIÓN ANUAL — el día 15 del mes en que ingresó, todos los
//     años. El aniversario se ancla al mes de INGRESO, no al mes en que
//     le llegaron los primeros puntos.
//
// Los tres ejemplos de la política:
//   A) Ingresa 4 sep  → cumple 1 mes el 4 oct  → primeros puntos 15 oct
//                       → sube cada 15 de septiembre.
//   B) Ingresa 1 oct  → cumple 1 mes el 1 nov  → primeros puntos 15 nov
//                       → sube cada 15 de octubre.
//   C) Ingresa 23 oct → cumple 1 mes el 23 nov → primeros puntos 15 dic
//                       → sube cada 15 de octubre.
//
// En A el día del cumplimiento (4) es anterior al 15, así que el 15 de
// ese mismo mes todavía sirve. En C el día (23) ya pasó el 15, así que
// hay que esperar al 15 siguiente. Esa es toda la diferencia.
//
// El primer aniversario que CUENTA es el primero posterior a la primera
// entrega: en C, el 15 de octubre de 2025 queda antes de recibir nada,
// así que el primer aumento es el 15 de octubre del año siguiente.
// ══════════════════════════════════════════════════════════════════

// Cumplir un mes. Si el día no existe en el mes siguiente (31 de enero),
// se toma el último de ese mes, no el 3 de marzo que daría JavaScript.
function fechaCumpleUnMes(anio, mes0, dia) {
    const ultimo = new Date(anio, mes0 + 2, 0).getDate();
    return new Date(anio, mes0 + 1, Math.min(dia, ultimo));
}

// El primer día 15 en o después de `d`.
function primerDia15Desde(d) {
    return d.getDate() <= 15
        ? new Date(d.getFullYear(), d.getMonth(), 15)
        : new Date(d.getFullYear(), d.getMonth() + 1, 15);
}

// Todo lo que hay que saber de una fecha de ingreso.
// Devuelve { primeraEntrega: Date, mesAniversario: 0-11, anioIngreso,
//            primerAniversario: Date }
function reglaPuntosFechas(fechaIngresoISO) {
    const p = String(fechaIngresoISO || '').substring(0, 10).split('-').map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
    const [anio, mes, dia] = p;
    const mes0 = mes - 1;
    const primeraEntrega = primerDia15Desde(fechaCumpleUnMes(anio, mes0, dia));
    // El aniversario vive en el mes de INGRESO. El primero que cuenta es
    // el primero que cae después de haber recibido los primeros puntos.
    let primerAniversario = new Date(anio, mes0, 15);
    while (primerAniversario <= primeraEntrega) {
        primerAniversario = new Date(primerAniversario.getFullYear() + 1, mes0, 15);
    }
    return { primeraEntrega, mesAniversario: mes0, anioIngreso: anio, primerAniversario };
}

// ══════════════════════════════════════════════════════════════════
// «SUBE PUNTOS»: cuándo le toca el aumento anual
//
// La regla es la de `reglaPuntosFechas`: el aniversario vive en el mes
// de INGRESO y cae el día 15. Con fecha de inicio de puntos puesta a
// mano, manda el mes de ésa.
//
// Vive acá porque el recibo del cierre y el comprobante de salida lo
// imprimen, y cada uno lo deducía por su cuenta. El recibo lo sacaba de
// la PRIMERA ENTREGA en vez del aniversario: a quien entró el 20 de
// diciembre le decía «15 DE FEB», dos meses corrido.
// ══════════════════════════════════════════════════════════════════
const MESES_SUBE = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function mesAniversarioDe(fechaIngresoISO, fechaInicioPuntosISO) {
    const ing = String(fechaIngresoISO || '').substring(0, 10);
    const ov  = String(fechaInicioPuntosISO || '').substring(0, 10);
    // El override solo manda cuando DIFIERE del ingreso: si viene igual
    // no es una excepción, es un eco del mismo dato.
    const base = (ov && ov !== ing) ? ov : ing;
    const p = base.split('-').map(Number);
    if (p.length !== 3 || !(p[1] >= 1 && p[1] <= 12)) return null;
    return p[1] - 1;
}

function subePuntosLabel(fechaIngresoISO, fechaInicioPuntosISO) {
    const m = mesAniversarioDe(fechaIngresoISO, fechaInicioPuntosISO);
    return (m === null) ? '—' : ('15 DE ' + MESES_SUBE[m]);
}

function subePuntosDeMes(mes0) {
    return (mes0 === null || mes0 === undefined || !MESES_SUBE[mes0]) ? '—' : ('15 DE ' + MESES_SUBE[mes0]);
}

// ══════════════════════════════════════════════════════════════════
// CUÁNTOS AUMENTOS TIENE EL SOCIO JUSTO DESPUÉS DEL ANIVERSARIO DE UN AÑO
//
// Para las listas de "subieron / suben / van a subir" hace falta el
// número de aumentos en una fecha que no es hoy: el 15 del mes
// aniversario del mes pasado, de este mes o del próximo.
//
// Se saca de `socio.anios` —el que calcula api.js con la regla buena,
// incluido el caso de fecha de inicio de puntos puesta a mano— en vez de
// volver a deducirlo de la fecha de ingreso. Deducirlo otra vez es lo que
// tenía al informe listando a cada socio uno o dos meses tarde.
//
// Como hay exactamente un aniversario por año, basta con saber si el de
// ESTE año ya pasó y contar años desde ahí.
// ══════════════════════════════════════════════════════════════════
function aniosPuntosTrasAniversario(socio, anioObjetivo, hoy) {
    const m = socio && Number.isInteger(socio.mesAniversario)
        ? socio.mesAniversario
        : mesAniversarioDe(socio && socio.fechaIngreso, null);
    if (m === null || m === undefined) return null;
    const h = hoy || new Date();
    const yaPaso = (h.getMonth() > m) || (h.getMonth() === m && h.getDate() >= 15);
    const anioUltimo = yaPaso ? h.getFullYear() : h.getFullYear() - 1;
    return (Number(socio.anios) || 0) + (anioObjetivo - anioUltimo);
}

// Cuántos aumentos anuales lleva a la fecha `hoy`.
function aniosPuntosA(fechaIngresoISO, hoy) {
    const r = reglaPuntosFechas(fechaIngresoISO);
    if (!r) return 0;
    const h = hoy || new Date();
    if (h < r.primerAniversario) return 0;
    let n = h.getFullYear() - r.primerAniversario.getFullYear() + 1;
    // Todavía no llega el 15 del mes aniversario de ESTE año.
    if (h.getMonth() < r.mesAniversario ||
        (h.getMonth() === r.mesAniversario && h.getDate() < 15)) n--;
    return Math.max(0, n);
}

// ══════════════════════════════════════════════════════════════════
// QUÉ DÍAS PERCIBE UN SOCIO
//
// Un socio no percibe la recaudación de días anteriores a la fecha en que
// le empiezan a correr los puntos. Si entró el 23 de octubre, sus puntos
// parten el 15 de diciembre: los días del 15 de octubre al 14 de diciembre
// NO son suyos, aunque estén cargados en el período.
//
// Hasta ahora el alcance sumaba TODOS los días del mapa, sin mirar ni el
// período ni desde cuándo ese socio percibe. Son dos recortes distintos y
// los dos hacen falta:
//   · el PERÍODO (15 → 14), porque el mapa guarda todo lo cargado;
//   · la FECHA DE INICIO del socio, que es lo que pidió la comisión.
//
// Todo el que calcule un alcance pasa por acá. Si cada pantalla hiciera su
// propia suma, tarde o temprano dirían números distintos — que es
// exactamente lo que pasaba.
// ══════════════════════════════════════════════════════════════════

// El período activo (15 → 14). Se ancla a la ÚLTIMA recaudación cargada y
// no a hoy, para no adelantarse solo porque el calendario pasó el día 15.
function periodoActivoISO() {
    let ref = new Date();
    try {
        const dias = Object.keys(globalMapaPuntosDia || {}).filter(Boolean).sort();
        if (dias.length) {
            const d = new Date(dias[dias.length - 1] + 'T12:00:00');
            if (!isNaN(d.getTime())) ref = d;
        }
    } catch (e) {}
    const a = ref.getFullYear(), m = ref.getMonth();
    const inicio = ref.getDate() >= 15 ? new Date(a, m, 15) : new Date(a, m - 1, 15);
    const fin    = ref.getDate() >= 15 ? new Date(a, m + 1, 14) : new Date(a, m, 14);
    const f = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                 + '-' + String(d.getDate()).padStart(2, '0');
    return { inicio: f(inicio), fin: f(fin) };
}

// Desde qué día percibe este socio dentro del período.
function desdeCuandoPercibe(socio, inicioPeriodo) {
    const d = socio && socio.fechaInicioPuntos ? String(socio.fechaInicioPuntos).substring(0, 10) : '';
    return (d && d > inicioPeriodo) ? d : inicioPeriodo;
}

// La suma de valores punto que le corresponden. `diasPT` solo para Part-Time
// (sus días asignados); para Planta se pasa null y se toman todos los días.
function sumaValorPuntoSocio(socio, fechasAusencia, diasPT) {
    const { inicio, fin } = periodoActivoISO();
    const desde = desdeCuandoPercibe(socio, inicio);
    const aus = fechasAusencia || new Set();
    const mapa = globalMapaPuntosDia || {};
    let suma = 0;
    if (diasPT) {
        (diasPT || []).forEach(d => {
            if (d < desde || d > fin) return;
            if (aus.has(d)) return;
            const v = mapa[d];
            if (v) suma += v;
        });
    } else {
        for (const [dia, valor] of Object.entries(mapa)) {
            if (dia < desde || dia > fin) continue;
            if (aus.has(dia)) continue;
            if (valor === null || valor === undefined) continue;
            suma += valor;
        }
    }
    return suma;
}

// El alcance en pesos.
function alcanceDeSocio(socio, fechasAusencia, diasPT) {
    const pts = parseFloat(socio && socio.puntos) || 0;
    return sumaValorPuntoSocio(socio, fechasAusencia, diasPT) * pts;
}

// ══════════════════════════════════════════════════════════════════
// LA FECHA SE QUEDA DONDE LA DEJARON
//
// Al guardar un registro el formulario se limpia y la fecha volvía a
// HOY. Quien está cargando varios movimientos de otro día tenía que
// moverla de nuevo en cada uno. Ahora se recuerda la última elegida en
// cada campo y el campo vuelve a ella.
//
// Va en sessionStorage a propósito: dura lo que dura la app abierta. Al
// volver a entrar mañana lo correcto es que diga hoy otra vez, no el día
// que se estuvo corrigiendo ayer.
//
// Y el "hoy" se arma con la fecha LOCAL. `toISOString()` da la fecha en
// UTC, que en Chile va 3 o 4 horas adelante: a partir de las 20:00 o
// 21:00 el campo aparecía con el día siguiente. En un casino, que
// trabaja de noche, eso es casi todos los turnos.
// ══════════════════════════════════════════════════════════════════
const FECHA_SS = 'fsFechaPegajosa:';

function hoyISOLocal() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
}

function fechaRecordada(id) {
    try { return sessionStorage.getItem(FECHA_SS + id) || ''; } catch (e) { return ''; }
}

// Deja el campo en la última fecha elegida en esta sesión, o en hoy.
function fechaPegajosaPoner(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = fechaRecordada(id) || hoyISOLocal();
}

// Engancha el campo una sola vez y lo deja puesto. Es lo que se llama al
// abrir un modal: sirve de "poner" y de "enganchar" a la vez.
function fechaPegajosaEnganchar(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.pegajosa !== '1') {
        el.dataset.pegajosa = '1';
        el.addEventListener('change', () => {
            try { sessionStorage.setItem(FECHA_SS + id, el.value || ''); } catch (e) {}
        });
    }
    fechaPegajosaPoner(id);
}
