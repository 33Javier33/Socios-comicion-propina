// ==============================================================================
// SCRIPT DE MIGRACIÓN: Google Sheets → Supabase
// Sistema: socios-comicion-propina (backend.gs V25.1)
// Proyecto Supabase: teemahksasdougehrcly
//
// FUNCIONES DISPONIBLES:
//   sincronizarActivos()    → ⭐ CORRER AHORA: sincroniza anticipos y extras actuales de Sheets a Supabase
//   migrarTodo()            → migra las 12 tablas principales
//   migrarFaltantes()       → SOLO las que quedaron vacías (correr ahora)
//   migrarAnticiposDinamicos() → hojas Anticipos_MAYO_2026, Anticipos_ABRIL_2026, etc.
//   backfillAnticiposFaltantes() → importa meses archivados faltantes a anticipos_historial
//   probarConexion()        → verifica que Supabase responde y qué hay en cada tabla
//   diagnosticarHojas()     → lista todas las hojas y sus filas
// ==============================================================================

// ==============================================================================
// sincronizarActivos() — ⭐ CORRER ESTA FUNCIÓN
// Sincroniza la hoja "Anticipos" y "MovimientosExtras" actuales a Supabase.
// Seguro de correr múltiples veces (ignora duplicados por UUID).
// Después de esto, socios-comicion lee TODO desde Supabase (instantáneo).
// ==============================================================================
function sincronizarActivos() {
  Logger.log('================================================================');
  Logger.log('SINCRONIZAR ACTIVOS: Anticipos + Extras → Supabase');
  Logger.log('Seguro de correr múltiples veces (ignora duplicados)');
  Logger.log('================================================================');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();

  // 1. Anticipos activos (hoja "Anticipos")
  Logger.log('\n--- Anticipos activos ---');
  var sAnt = ss.getSheetByName(HOJA_ANTICIPOS);
  var filasAnt = [];
  if (sAnt && sAnt.getLastRow() > 1) {
    var dAnt = sAnt.getDataRange().getValues();
    for (var i = 1; i < dAnt.length; i++) {
      var socioId = toStr(dAnt[i][0]);
      if (!socioId) continue;
      var uid = toStr(dAnt[i][5]) || Utilities.getUuid();
      var fecha = dAnt[i][2] instanceof Date
        ? Utilities.formatDate(dAnt[i][2], tz, 'yyyy-MM-dd') : toStr(dAnt[i][2]);
      var resp = toStr(dAnt[i][6]) || '';
      var area = toStr(dAnt[i][7]) || '';
      filasAnt.push({
        id: uid,
        socio_id: socioId,
        fecha: fecha,
        monto: toNum(dAnt[i][3]),
        responsable: (resp + (area ? ' ' + area : '')).trim() || null,
        periodo: 'activo'
      });
    }
  }
  if (filasAnt.length === 0) {
    Logger.log('[INFO] Hoja Anticipos vacía — nada que sincronizar');
  } else {
    Logger.log('Anticipos a sincronizar: ' + filasAnt.length);
    var r1 = _supaPost('anticipos', filasAnt);
    Logger.log(r1.ok ? '[OK] ' + filasAnt.length + ' anticipos procesados' : '[ERROR] HTTP ' + r1.code + ' — ' + r1.body.substring(0,200));
  }

  Utilities.sleep(400);

  // 2. Extras/Ausencias activos (hoja "MovimientosExtras")
  Logger.log('\n--- Extras/Ausencias activos ---');
  var sExt = ss.getSheetByName(HOJA_EXTRAS);
  var filasExt = [];
  if (sExt && sExt.getLastRow() > 1) {
    var dExt = sExt.getDataRange().getValues();
    Logger.log('[DEBUG] Cabecera extras: ' + JSON.stringify(dExt[0]));
    for (var j = 1; j < dExt.length; j++) {
      var socioIdE = toStr(dExt[j][0]);
      if (!socioIdE) continue;
      var uidE = toStr(dExt[j][7]) || Utilities.getUuid();
      var fechaE = dExt[j][2] instanceof Date
        ? Utilities.formatDate(dExt[j][2], tz, 'yyyy-MM-dd') : toStr(dExt[j][2]);
      filasExt.push({
        id: uidE,
        socio_id: socioIdE,
        fecha: fechaE,
        tipo: toStr(dExt[j][3]) || 'AUSENCIA',
        monto: toNum(dExt[j][4]),
        detalle: toStr(dExt[j][5]) || null,
        periodo: 'activo'
      });
    }
  }
  if (filasExt.length === 0) {
    Logger.log('[INFO] Hoja MovimientosExtras vacía — nada que sincronizar');
  } else {
    Logger.log('Extras a sincronizar: ' + filasExt.length);
    var r2 = _supaPost('extras', filasExt);
    Logger.log(r2.ok ? '[OK] ' + filasExt.length + ' extras procesados' : '[ERROR] HTTP ' + r2.code + ' — ' + r2.body.substring(0,200));
  }

  Logger.log('\n================================================================');
  Logger.log('LISTO. Ahora socios-comicion lee desde Supabase (instantáneo).');
  Logger.log('================================================================');
}

// NOTA: Las constantes HOJA_* (HOJA_SOCIOS, HOJA_ANTICIPOS, etc.) se toman del
// script principal (Código.gs) — no se redeclaran aquí para evitar SyntaxError.
var SUPABASE_URL = 'https://teemahksasdougehrcly.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZW1haGtzYXNkb3VnZWhyY2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTkwNjIsImV4cCI6MjA5Njg3NTA2Mn0.EIQ7gRcwf3zYgvGESKw3s5lnZMABN_EuNWsrJK3L1zk';

// ==============================================================================
// HELPERS
// ==============================================================================
function _supaPost(tabla, filas) {
  // Retorna {ok, code, body, insertadas}
  var url = SUPABASE_URL + '/rest/v1/' + tabla;
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'return=minimal,resolution=ignore-duplicates'
    },
    payload: JSON.stringify(filas),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  return { ok: code >= 200 && code < 300, code: code, body: body };
}

function supabaseInsert(tabla, filas) {
  if (!filas || filas.length === 0) {
    Logger.log('[SKIP] ' + tabla + ': sin datos (hoja vacía)');
    return 0;
  }
  var BATCH = 200;
  var total = 0;
  for (var i = 0; i < filas.length; i += BATCH) {
    var lote = filas.slice(i, i + BATCH);
    var r = _supaPost(tabla, lote);
    if (r.ok) {
      total += lote.length;
    } else {
      Logger.log('[ERROR] ' + tabla + ' lote ' + Math.floor(i/BATCH+1) +
        ' | HTTP ' + r.code + ' | ' + r.body.substring(0, 300));
    }
    if (i + BATCH < filas.length) Utilities.sleep(300);
  }
  Logger.log('[OK] ' + tabla + ': ' + total + ' de ' + filas.length + ' filas procesadas');
  return total;
}

function formatFecha(val) {
  if (!val) return null;
  try {
    var d = (val instanceof Date) ? val : new Date(val);
    if (isNaN(d.getTime())) return null;
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  } catch(e) { return null; }
}

function formatTs(val) {
  if (!val) return null;
  try {
    var d = (val instanceof Date) ? val : new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch(e) { return null; }
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  var n = parseFloat(String(val).replace(/\./g, '').replace(/,/g, '.'));
  return isNaN(n) ? 0 : n;
}

function toStr(val) {
  if (val === null || val === undefined) return null;
  var s = String(val).trim();
  return s === '' ? null : s;
}

function getSheet(nombre) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!s) Logger.log('[WARN] Hoja no encontrada: "' + nombre + '"');
  return s;
}

// ==============================================================================
// PROBAR CONEXIÓN Y VER ESTADO DE TABLAS
// ==============================================================================
function probarConexion() {
  Logger.log('=== ESTADO EN SUPABASE ===');
  var tablas = ['socios','anticipos','anticipos_historial','extras','saldos_socio',
                'dias_pt','chat_mensajes','historial_conexiones','auditoria',
                'credenciales','retiros_anticipos','materiales'];
  tablas.forEach(function(t) {
    var res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + t + '?select=id&limit=1', {
      method: 'get',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
                 'Prefer': 'count=exact', 'Range': '0-0' },
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var cr = res.getHeaders()['content-range'] || res.getHeaders()['Content-Range'] || '?';
    if (code === 200 || code === 206) {
      Logger.log('[OK] ' + t + ' — Content-Range: ' + cr);
    } else {
      Logger.log('[ERROR] ' + t + ' — HTTP ' + code + ' — ' + res.getContentText().substring(0,150));
    }
  });
}

// ==============================================================================
// 1. SOCIOS
// Columnas: [0]=ID [1]=Nombre [2]=Apellido [3]=FechaIngreso [4]=Area [5]=TipoContrato
// ==============================================================================
function migrarSocios() {
  var s = getSheet(HOJA_SOCIOS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var id = toStr(d[i][0]);
    if (!id) continue;
    filas.push({ id: id, nombre: toStr(d[i][1]), apellido: toStr(d[i][2]),
                 fecha_ingreso: formatFecha(d[i][3]), area: toStr(d[i][4]),
                 contrato: toStr(d[i][5]), puntos: 0, puntos_activos: true, activo: true });
  }
  supabaseInsert('socios', filas);
}

// ==============================================================================
// 2. ANTICIPOS (período activo)
// Columnas: [0]=IDSocio [1]=Nombre [2]=Fecha [3]=Monto [4]=Estado [5]=UUID [6]=Responsable
// ==============================================================================
function migrarAnticipos() {
  var s = getSheet(HOJA_ANTICIPOS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var socioId = toStr(d[i][0]);
    if (!socioId) continue;
    filas.push({ id: toStr(d[i][5]) || Utilities.getUuid(),
                 socio_id: socioId, fecha: formatFecha(d[i][2]),
                 monto: toNum(d[i][3]),
                 responsable: toStr(d[i][6]),
                 autor: toStr(d[i][6]), periodo: 'activo' });
  }
  supabaseInsert('anticipos', filas);
}

// ==============================================================================
// remigrarAnticipos() — vacía tabla y reimporta TODOS los anticipos desde Sheets
// EJECUTAR SOLO UNA VEZ para sincronizar GAS → Supabase
// ==============================================================================
function remigrarAnticipos() {
  Logger.log('=== REMIGRANDO ANTICIPOS ===');

  // 1. Vaciar tabla anticipos
  var del = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/anticipos?id=neq.__never__', {
    method: 'delete',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    muteHttpExceptions: true
  });
  Logger.log('1. Vaciando tabla anticipos → HTTP ' + del.getResponseCode());
  Utilities.sleep(600);

  // 2. Importar anticipos activos (hoja "Anticipos")
  Logger.log('2. Importando anticipos activos (hoja "' + HOJA_ANTICIPOS + '")...');
  migrarAnticipos();
  Utilities.sleep(500);

  // 3. Importar hojas históricas (Anticipos_MAYO_2026, Anticipos_ABRIL_2026, etc.)
  Logger.log('3. Importando anticipos históricos (hojas Anticipos_*)...');
  migrarAnticiposDinamicos();

  Logger.log('=== REMIGRACIÓN ANTICIPOS COMPLETA ===');
  Logger.log('Ahora corre probarConexion() para verificar cuántas filas quedaron.');
}

// ==============================================================================
// 3. ANTICIPOS HISTORIAL (AnticiposGuardados)
// Columnas: [0]=IDSocio [1]=Nombre [2]=Fecha [3]=Monto [4]=Estado [5]=UUID [6]=Responsable
// ==============================================================================
function migrarAnticiposHistorial() {
  var s = getSheet(HOJA_ANTICIPOS_HISTORIAL);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var ncols = d[0] ? d[0].length : 8;
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var socioId = toStr(d[i][0]);
    if (!socioId) continue;
    var uid = toStr(d[i][5]) || Utilities.getUuid();
    filas.push({ id: uid, socio_id: socioId, monto: toNum(d[i][3]),
                 fecha: formatFecha(d[i][2]), estado: toStr(d[i][4]),
                 uuid_ref: uid, responsable: toStr(d[i][6]),
                 periodo: (ncols > 7 ? toStr(d[i][7]) : null) || 'historial',
                 fecha_archivo: null });
  }
  supabaseInsert('anticipos_historial', filas);
}

// ==============================================================================
// 3b. ANTICIPOS DE HOJAS DINÁMICAS (Anticipos_MAYO_2026, Anticipos_ABRIL_2026, etc.)
// Columnas iguales a Anticipos: [0]=IDSocio [1]=Nombre [2]=Fecha [3]=Monto
//                                [4]=Estado [5]=UUID [6]=Responsable
// ==============================================================================
function migrarAnticiposDinamicos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = ss.getSheets();
  var filas = [];
  hojas.forEach(function(hoja) {
    var nombre = hoja.getName();
    if (!nombre.startsWith('Anticipos_') || nombre === HOJA_ANTICIPOS) return;
    if (hoja.getLastRow() <= 1) return;
    var d = hoja.getDataRange().getValues();
    var periodo = nombre.replace('Anticipos_', '').replace(/_/g, ' ');
    Logger.log('[LEYENDO] ' + nombre + ' — ' + (d.length - 1) + ' filas — período: ' + periodo);
    for (var i = 1; i < d.length; i++) {
      var socioId = toStr(d[i][0]);
      if (!socioId) continue;
      var uid = toStr(d[i][5]) || Utilities.getUuid();
      filas.push({ id: uid, socio_id: socioId, monto: toNum(d[i][3]),
                   fecha: formatFecha(d[i][2]), estado: toStr(d[i][4]),
                   uuid_ref: uid, responsable: toStr(d[i][6]),
                   periodo: periodo, fecha_archivo: null });
    }
  });
  if (filas.length === 0) { Logger.log('[SKIP] anticipos_historial dinámicos: sin datos'); return; }
  supabaseInsert('anticipos_historial', filas);
}

// ==============================================================================
// 4. EXTRAS (MovimientosExtras) — actualmente vacía en Sheets
// Columnas: [0]=IDSocio [2]=Fecha [3]=Tipo [4]=Monto [7]=UUID
// ==============================================================================
function migrarExtras() {
  var s = getSheet(HOJA_EXTRAS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var socioId = toStr(d[i][0]);
    if (!socioId) continue;
    filas.push({ id: toStr(d[i][7]) || Utilities.getUuid(),
                 socio_id: socioId, fecha: formatFecha(d[i][2]),
                 tipo: toStr(d[i][3]), monto: toNum(d[i][4]), periodo: 'importado' });
  }
  supabaseInsert('extras', filas);
}

// ==============================================================================
// 5. SALDOS ANTERIORES
// Columnas: [0]=IDSocio [1]=Nombre [2]=MontoSaldo
// ==============================================================================
function migrarSaldos() {
  var s = getSheet(HOJA_SALDOS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  Logger.log('[DEBUG] SaldosAnteriores cabecera: ' + JSON.stringify(d[0]));
  Logger.log('[DEBUG] Primera fila de datos: ' + JSON.stringify(d[1]));
  var filas = [];
  var seen = {};
  for (var i = 1; i < d.length; i++) {
    var id = toStr(d[i][0]);
    if (!id) continue;
    if (seen[id]) { Logger.log('[WARN] ID duplicado en SaldosAnteriores: ' + id); continue; }
    seen[id] = true;
    filas.push({ id: id, nombre: toStr(d[i][1]), monto: toNum(d[i][2]) });
  }
  supabaseInsert('saldos_socio', filas);
}

// ==============================================================================
// 6. DÍAS PART-TIME
// Columnas: [0]=IDSocio [1]=Nombre [2]=DiasJSON
// ==============================================================================
function migrarDiasPT() {
  var s = getSheet(HOJA_DIAS_PT);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var id = toStr(d[i][0]);
    if (!id) continue;
    var dias = [];
    try { dias = JSON.parse(d[i][2] || '[]'); } catch(e) { dias = []; }
    filas.push({ id: id + '_importado', socio_id: id, periodo: 'importado', dias: dias });
  }
  supabaseInsert('dias_pt', filas);
}

// ==============================================================================
// 7. CHAT / MENSAJES (MensajesApp)
// Columnas: [0]=UUID [1]=Fecha [2]=Autor [3]=SocioID [4]=Mensaje [5]=Destinatario
// ==============================================================================
function migrarChat() {
  var s = getSheet(HOJA_CHAT_SOCIAL);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var msg = toStr(d[i][4]);
    if (!msg) continue;
    filas.push({ id: toStr(d[i][0]) || Utilities.getUuid(),
                 created_at: formatTs(d[i][1]), autor: toStr(d[i][2]),
                 socio_id: toStr(d[i][3]), mensaje: msg,
                 destinatario: toStr(d[i][5]), estado: 'ACTIVE' });
  }
  supabaseInsert('chat_mensajes', filas);
}

// ==============================================================================
// 8. HISTORIAL CONEXIONES
// Columnas: [0]=SocioID [1]=Nombre [2]=Area [3]=Entrada [4]=Tipo [5]=Salida
// ==============================================================================
function migrarConexiones() {
  var s = getSheet(HOJA_HISTORIAL_CONEX);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    if (!d[i][0]) continue;
    filas.push({ id: Utilities.getUuid(), created_at: formatTs(d[i][3]),
                 usuario: toStr(d[i][1]), area: toStr(d[i][2]),
                 ip: null, device_id: null, lat: null, lng: null });
  }
  supabaseInsert('historial_conexiones', filas);
}

// ==============================================================================
// 9. AUDITORÍA (AuditoriaLogs)
// Columnas: [0]=Fecha [1]=Usuario [2]=Accion [3]=Detalle
// ==============================================================================
function migrarAuditoria() {
  var s = getSheet(HOJA_AUDITORIA);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  Logger.log('[DEBUG] AuditoriaLogs cabecera: ' + JSON.stringify(d[0]));
  Logger.log('[DEBUG] Primera fila: ' + JSON.stringify(d[1]));
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    if (!d[i][0] && !d[i][1]) continue;
    filas.push({ id: Utilities.getUuid(),
                 created_at: formatTs(d[i][0]) || new Date().toISOString(),
                 usuario: toStr(d[i][1]), area: null,
                 accion: toStr(d[i][2]), detalle: toStr(d[i][3]) });
  }
  supabaseInsert('auditoria', filas);
}

// ==============================================================================
// 10. CREDENCIALES
// Columnas: [0]=ini(socio_id) [1]=area [2]=pin [3]=fecha
// ==============================================================================
function migrarCredenciales() {
  var s = getSheet(HOJA_CREDENCIALES);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  Logger.log('[DEBUG] Credenciales cabecera: ' + JSON.stringify(d[0]));
  Logger.log('[DEBUG] Todas las filas: ' + JSON.stringify(d.slice(1)));
  var filas = [];
  var seen = {};
  for (var i = 1; i < d.length; i++) {
    var socioId = toStr(d[i][0]);
    var pin     = toStr(d[i][2]);
    if (!socioId) continue;
    if (seen[socioId]) continue;
    seen[socioId] = true;
    filas.push({ id: 'cred_' + socioId, socio_id: socioId,
                 pin: pin || '', device_id: null, rut: null });
  }
  supabaseInsert('credenciales', filas);
}

// ==============================================================================
// 11. RETIROS ANTICIPOS — actualmente vacía en Sheets
// Columnas: [0]=Firma [1]=Nombre [2]=Monto [3]=Billetes [4]=Fecha [5]=Responsable
// ==============================================================================
function migrarRetiros() {
  var s = getSheet(HOJA_RETIROS_ANTICIPOS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var firma = toStr(d[i][0]);
    if (!firma) continue;
    filas.push({ id: Utilities.getUuid(), created_at: formatTs(d[i][4]),
                 socio_id: firma, monto: toNum(d[i][2]),
                 autor: toStr(d[i][5]), periodo: 'importado' });
  }
  supabaseInsert('retiros_anticipos', filas);
}

// ==============================================================================
// 12. MATERIALES (RecaudacionMateriales)
// Columnas: [0]=UUID [1]=Fecha [2]=Tipo [3]=Monto [4]=Nota [5]=Responsable [6]=Periodo [7]=Estado
// ==============================================================================
function migrarMateriales() {
  var s = getSheet(HOJA_MATERIALES);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  Logger.log('[DEBUG] RecaudacionMateriales cabecera: ' + JSON.stringify(d[0]));
  Logger.log('[DEBUG] Primera fila: ' + JSON.stringify(d[1]));
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var uid = toStr(d[i][0]);
    if (!uid) continue;
    if (toStr(d[i][7]) === 'borrado') continue;
    filas.push({ id: uid, created_at: formatTs(d[i][1]),
                 nombre: toStr(d[i][2]), cantidad: String(toNum(d[i][3])),
                 autor: toStr(d[i][5]) });
  }
  supabaseInsert('materiales', filas);
}

// ==============================================================================
// migrarFaltantes() — CORRER AHORA: solo migra las tablas que quedaron vacías
// Tablas: saldos_socio, auditoria, credenciales, materiales
// ==============================================================================
function migrarFaltantes() {
  Logger.log('================================================================');
  Logger.log('MIGRANDO TABLAS FALTANTES → Supabase teemahksasdougehrcly');
  Logger.log('Fecha: ' + new Date().toISOString());
  Logger.log('================================================================');

  Logger.log('\n--- Probando conexión a Supabase ---');
  var test = _supaPost('socios', []);
  Logger.log('Test HTTP (cuerpo vacío a socios): ' + test.code);
  if (!test.ok && test.code !== 400) {
    Logger.log('[ERROR FATAL] No se puede conectar a Supabase. Verifica la URL y la clave.');
    Logger.log('Respuesta: ' + test.body);
    return;
  }

  Logger.log('\n--- 1/4 SaldosAnteriores → saldos_socio (67 filas esperadas) ---');
  migrarSaldos();       Utilities.sleep(500);

  Logger.log('\n--- 2/4 AuditoriaLogs → auditoria (366 filas esperadas) ---');
  migrarAuditoria();    Utilities.sleep(800);

  Logger.log('\n--- 3/4 Credenciales → credenciales (1 fila esperada) ---');
  migrarCredenciales(); Utilities.sleep(300);

  Logger.log('\n--- 4/4 RecaudacionMateriales → materiales (13 filas esperadas) ---');
  migrarMateriales();

  Logger.log('\n================================================================');
  Logger.log('LISTO. Copia este log y envialo para verificar.');
  Logger.log('================================================================');
}

// ==============================================================================
// migrarAnticiposDinamicos() — migra Anticipos_MAYO_2026, Anticipos_ABRIL_2026, etc.
// Se guardan en anticipos_historial con el período extraido del nombre de la hoja
// ==============================================================================
function migrarAnticiposDinamicos() {
  Logger.log('=== MIGRANDO HOJAS DINÁMICAS Anticipos_* ===');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = ss.getSheets();
  var filas = [];
  hojas.forEach(function(hoja) {
    var nombre = hoja.getName();
    if (!nombre.startsWith('Anticipos_') || nombre === HOJA_ANTICIPOS) return;
    if (hoja.getLastRow() <= 1) return;
    var d = hoja.getDataRange().getValues();
    var periodo = nombre.replace('Anticipos_', '').replace(/_/g, ' ');
    Logger.log('[LEYENDO] "' + nombre + '" — ' + (d.length-1) + ' filas — período: ' + periodo);
    if (d.length > 1) Logger.log('[DEBUG] Cabecera: ' + JSON.stringify(d[0]));
    for (var i = 1; i < d.length; i++) {
      var socioId = toStr(d[i][0]);
      if (!socioId) continue;
      var uid = toStr(d[i][5]) || Utilities.getUuid();
      filas.push({ id: uid + '_' + periodo.replace(/ /g,'_'),
                   socio_id: socioId, monto: toNum(d[i][3]),
                   fecha: formatFecha(d[i][2]), estado: toStr(d[i][4]),
                   uuid_ref: uid, responsable: toStr(d[i][6]),
                   periodo: periodo, fecha_archivo: null });
    }
  });
  if (filas.length === 0) { Logger.log('[SKIP] No hay hojas Anticipos_* con datos'); return; }
  Logger.log('Total registros a migrar: ' + filas.length);
  supabaseInsert('anticipos_historial', filas);
}

// ==============================================================================
// backfillAnticiposFaltantes() — importa a Supabase los meses que faltan
// Seguro de correr múltiples veces: ignora duplicados por id
// CÓMO USAR: abrir GAS editor → ejecutar esta función → revisar el log
// ==============================================================================
function backfillAnticiposFaltantes() {
  Logger.log('================================================================');
  Logger.log('BACKFILL: Anticipos_* → Supabase anticipos_historial');
  Logger.log('Seguro de correr múltiples veces (ignora duplicados)');
  Logger.log('================================================================');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = ss.getSheets();
  var totalHojas = 0, totalFilas = 0;

  hojas.forEach(function(hoja) {
    var nombre = hoja.getName();
    if (!nombre.startsWith('Anticipos_') || nombre === HOJA_ANTICIPOS) return;
    if (hoja.getLastRow() <= 1) return;

    var d = hoja.getDataRange().getValues();
    var periodo = nombre.replace('Anticipos_', '').replace(/_/g, ' ');
    Logger.log('\n[HOJA] "' + nombre + '" — ' + (d.length - 1) + ' filas — período: ' + periodo);

    var filas = [];
    for (var i = 1; i < d.length; i++) {
      var socioId = toStr(d[i][0]);
      if (!socioId) continue;
      var uid = toStr(d[i][5]) || Utilities.getUuid();
      var fechaArch = d[i][8] instanceof Date ? formatFecha(d[i][8]) : null;
      filas.push({
        id: uid + '_' + periodo.replace(/ /g, '_'),
        socio_id: socioId,
        socio_nombre: toStr(d[i][1]) || null,
        monto: toNum(d[i][3]),
        fecha: formatFecha(d[i][2]),
        estado: toStr(d[i][4]) || 'ARCHIVADO',
        uuid_ref: uid,
        responsable: toStr(d[i][6]) || null,
        area_responsable: toStr(d[i][7]) || null,
        periodo: periodo,
        fecha_archivo: fechaArch
      });
    }

    if (filas.length > 0) {
      var url = SUPABASE_URL + '/rest/v1/anticipos_historial';
      var res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'return=minimal,resolution=ignore-duplicates'
        },
        payload: JSON.stringify(filas),
        muteHttpExceptions: true
      });
      var code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        Logger.log('[OK] ' + filas.length + ' filas insertadas (duplicados ignorados)');
        totalFilas += filas.length;
        totalHojas++;
      } else {
        Logger.log('[ERROR] HTTP ' + code + ' — ' + res.getContentText().substring(0, 200));
      }
    }
    Utilities.sleep(300);
  });

  Logger.log('\n================================================================');
  Logger.log('BACKFILL COMPLETADO: ' + totalHojas + ' hojas, ' + totalFilas + ' filas procesadas');
  Logger.log('Ahora propi.solicitada leerá todos los meses desde Supabase.');
  Logger.log('================================================================');
}

// ==============================================================================
// migrarTodo() — migra las 12 tablas desde cero
// ==============================================================================
function migrarTodo() {
  Logger.log('================================================================');
  Logger.log('MIGRACIÓN COMPLETA: socios-comicion-propina → Supabase');
  Logger.log('================================================================');
  Logger.log('--- 1/12 Socios ---');            migrarSocios();             Utilities.sleep(800);
  Logger.log('--- 2/12 Anticipos activos ---'); migrarAnticipos();          Utilities.sleep(800);
  Logger.log('--- 3/12 Historial guardado ---');migrarAnticiposHistorial(); Utilities.sleep(800);
  Logger.log('--- 3b Anticipos dinámicos ---');migrarAnticiposDinamicos(); Utilities.sleep(800);
  Logger.log('--- 4/12 Extras ---');            migrarExtras();             Utilities.sleep(500);
  Logger.log('--- 5/12 Saldos Anteriores ---'); migrarSaldos();             Utilities.sleep(500);
  Logger.log('--- 6/12 Días Part-Time ---');    migrarDiasPT();             Utilities.sleep(500);
  Logger.log('--- 7/12 Chat ---');              migrarChat();               Utilities.sleep(500);
  Logger.log('--- 8/12 Conexiones ---');        migrarConexiones();         Utilities.sleep(800);
  Logger.log('--- 9/12 Auditoría ---');         migrarAuditoria();          Utilities.sleep(800);
  Logger.log('--- 10/12 Credenciales ---');     migrarCredenciales();       Utilities.sleep(300);
  Logger.log('--- 11/12 Retiros ---');          migrarRetiros();            Utilities.sleep(300);
  Logger.log('--- 12/12 Materiales ---');       migrarMateriales();
  Logger.log('=== MIGRACIÓN COMPLETADA ===');
}

// ==============================================================================
// diagnosticarHojas() — lista todas las hojas y sus filas
// ==============================================================================
function diagnosticarHojas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('=== HOJAS EN LA HOJA DE CÁLCULO ===');
  ss.getSheets().forEach(function(h) {
    Logger.log('"' + h.getName() + '" — ' + Math.max(0, h.getLastRow()-1) + ' filas');
  });
}
