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
const CACHE_KEY_SOCIOS = 'fondo_cache_socios';
const CACHE_KEY_DIAS   = 'fondo_cache_dias';
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

// Arqueo: lista plana de anticipos del período y anticipo en espera de retiro
let aqAnticiposListaPeriodo = [];
let aq_retiroAnticipoPendiente = null;
let selectedDaysPT = [];
let globalDiasPT = {};

// Arqueo de caja
let aq_conteo = {}, aq_movi = {}, aq_totalRetirado = 0, aq_totalAnticipos = 0, aq_desgloseEsperado = [], aq_denomEditando = null;
let aq_histStates = [], aq_histIdx = -1;
let aq_syncInterval = null; // intervalo de sincronizacion automatica
let aq_snapAlAbrir = null;  // snapshot del conteo al abrir el modal

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
let recFiltroTipo   = '';
let recFiltroSinDiv = false;
let recFiltroConDiv = false;

// Ayuda
let ayudaFiltroActivo = '';

// Canje
let canjeConteo = {};
