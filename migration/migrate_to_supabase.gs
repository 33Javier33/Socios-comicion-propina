// ==============================================================================
// SCRIPT DE MIGRACIÓN: Google Sheets → Supabase
// Sistema: socios-comicion-propina (backend.gs V25.1)
// Proyecto Supabase: teemahksasdougehrcly
//
// INSTRUCCIONES:
//   1. Abrir desde la hoja de cálculo: Extensiones → Apps Script
//   2. Crear un archivo nuevo, pegar este código, guardar (Ctrl+S)
//   3. Seleccionar función "migrarTodo" y hacer clic en Ejecutar
//   4. Aceptar permisos la primera vez
//   5. Ver resultados en Ver → Registros de ejecución
//
// SEGURIDAD: Este script SOLO LEE de Sheets e INSERTA en Supabase.
//            No modifica ni borra ningún dato de Sheets.
// ==============================================================================

var SUPABASE_URL = 'https://teemahksasdougehrcly.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZW1haGtzYXNkb3VnZWhyY2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTkwNjIsImV4cCI6MjA5Njg3NTA2Mn0.EIQ7gRcwf3zYgvGESKw3s5lnZMABN_EuNWsrJK3L1zk';

// Nombres de hojas (igual que backend.gs)
var HOJA_SOCIOS              = 'Socios';
var HOJA_ANTICIPOS           = 'Anticipos';
var HOJA_EXTRAS              = 'MovimientosExtras';
var HOJA_SALDOS              = 'SaldosAnteriores';
var HOJA_DIAS_PT             = 'DiasPartTime';
var HOJA_CHAT_SOCIAL         = 'MensajesApp';
var HOJA_ANTICIPOS_HISTORIAL = 'AnticiposGuardados';
var HOJA_HISTORIAL_CONEX     = 'HistorialConexiones';
var HOJA_AUDITORIA           = 'AuditoriaLogs';
var HOJA_CREDENCIALES        = 'Credenciales';
var HOJA_RETIROS_ANTICIPOS   = 'RetirosAnticipos';
var HOJA_MATERIALES          = 'RecaudacionMateriales';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function supabaseInsert(tabla, filas) {
  if (!filas || filas.length === 0) { Logger.log('[SKIP] ' + tabla + ': sin datos'); return 0; }
  var BATCH = 200;
  var total = 0;
  for (var i = 0; i < filas.length; i += BATCH) {
    var lote = filas.slice(i, i + BATCH);
    var url  = SUPABASE_URL + '/rest/v1/' + tabla;
    var res  = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=minimal,resolution=ignore-duplicates'
      },
      payload: JSON.stringify(lote),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      total += lote.length;
    } else {
      Logger.log('[ERROR] ' + tabla + ' lote ' + (i/BATCH+1) + ' (HTTP ' + code + '): ' + res.getContentText().substring(0, 200));
    }
    if (i + BATCH < filas.length) Utilities.sleep(300);
  }
  Logger.log('[OK] ' + tabla + ': ' + total + ' filas insertadas');
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
  if (!s) Logger.log('[WARN] Hoja no encontrada: ' + nombre);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SOCIOS
// Columnas: [0]=ID [1]=Nombre [2]=Apellido [3]=FechaIngreso [4]=Area
//           [5]=TipoContrato [6]=UltimaConexion
// ─────────────────────────────────────────────────────────────────────────────
function migrarSocios() {
  var s = getSheet(HOJA_SOCIOS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var id = toStr(d[i][0]);
    if (!id) continue;
    filas.push({
      id:                  id,
      nombre:              toStr(d[i][1]),
      apellido:            toStr(d[i][2]),
      fecha_ingreso:       formatFecha(d[i][3]),
      area:                toStr(d[i][4]),
      contrato:            toStr(d[i][5]),
      puntos:              0,
      puntos_activos:      true,
      activo:              true
    });
  }
  supabaseInsert('socios', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ANTICIPOS (período activo)
// Columnas: [0]=IDSocio [1]=NombreCompleto [2]=Fecha [3]=Monto [4]=Estado
//           [5]=UUID [6]=Responsable [7]=AreaResponsable
// ─────────────────────────────────────────────────────────────────────────────
function migrarAnticipos() {
  var s = getSheet(HOJA_ANTICIPOS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var socioId = toStr(d[i][0]);
    if (!socioId) continue;
    filas.push({
      id:       toStr(d[i][5]) || Utilities.getUuid(),
      socio_id: socioId,
      fecha:    formatFecha(d[i][2]),
      monto:    toNum(d[i][3]),
      autor:    toStr(d[i][6]),
      periodo:  'importado'
    });
  }
  supabaseInsert('anticipos', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ANTICIPOS HISTORIAL (períodos cerrados: AnticiposGuardados)
// Columnas similares a Anticipos: [0]=IDSocio [1]=Nombre [2]=Fecha [3]=Monto
//           [4]=Estado [5]=UUID [6]=Responsable [7]=Periodo o AreaResp
// ─────────────────────────────────────────────────────────────────────────────
function migrarAnticiposHistorial() {
  var s = getSheet(HOJA_ANTICIPOS_HISTORIAL);
  if (!s || s.getLastRow() <= 1) return;
  var d   = s.getDataRange().getValues();
  var ncols = d[0] ? d[0].length : 8;
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var socioId = toStr(d[i][0]);
    if (!socioId) continue;
    filas.push({
      id:           toStr(d[i][5]) || Utilities.getUuid(),
      socio_id:     socioId,
      monto:        toNum(d[i][3]),
      fecha:        formatFecha(d[i][2]),
      estado:       toStr(d[i][4]),
      uuid_ref:     toStr(d[i][5]),
      responsable:  toStr(d[i][6]),
      periodo:      ncols > 7 ? toStr(d[i][7]) : null,
      fecha_archivo: null
    });
  }
  supabaseInsert('anticipos_historial', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EXTRAS (MovimientosExtras)
// Columnas: [0]=IDSocio [1]=Nombre [2]=Fecha [3]=Tipo [4]=Monto
//           [5]=Detalle [6]=? [7]=UUID
// ─────────────────────────────────────────────────────────────────────────────
function migrarExtras() {
  var s = getSheet(HOJA_EXTRAS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var socioId = toStr(d[i][0]);
    if (!socioId) continue;
    filas.push({
      id:       toStr(d[i][7]) || Utilities.getUuid(),
      socio_id: socioId,
      fecha:    formatFecha(d[i][2]),
      tipo:     toStr(d[i][3]),
      monto:    toNum(d[i][4]),
      periodo:  'importado'
    });
  }
  supabaseInsert('extras', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SALDOS ANTERIORES
// Columnas: [0]=IDSocio [1]=Nombre [2]=MontoSaldo
// ─────────────────────────────────────────────────────────────────────────────
function migrarSaldos() {
  var s = getSheet(HOJA_SALDOS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var id = toStr(d[i][0]);
    if (!id) continue;
    filas.push({
      id:     id,
      nombre: toStr(d[i][1]),
      monto:  toNum(d[i][2])
    });
  }
  supabaseInsert('saldos_socio', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DÍAS PART-TIME
// Columnas: [0]=IDSocio [1]=Nombre [2]=DiasJSON
// ─────────────────────────────────────────────────────────────────────────────
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
    filas.push({
      id:       id + '_importado',
      socio_id: id,
      periodo:  'importado',
      dias:     dias
    });
  }
  supabaseInsert('dias_pt', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CHAT / MENSAJES (MensajesApp)
// Columnas: [0]=UUID [1]=Fecha [2]=Autor [3]=SocioID [4]=Mensaje [5]=Destinatario
// ─────────────────────────────────────────────────────────────────────────────
function migrarChat() {
  var s = getSheet(HOJA_CHAT_SOCIAL);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var msg = toStr(d[i][4]);
    if (!msg) continue;
    filas.push({
      id:           toStr(d[i][0]) || Utilities.getUuid(),
      created_at:   formatTs(d[i][1]),
      autor:        toStr(d[i][2]),
      socio_id:     toStr(d[i][3]),
      mensaje:      msg,
      destinatario: toStr(d[i][5]),
      estado:       'ACTIVE'
    });
  }
  supabaseInsert('chat_mensajes', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. HISTORIAL DE CONEXIONES
// Columnas: [0]=SocioID [1]=Nombre [2]=Area [3]=Entrada [4]=Tipo [5]=Salida
// ─────────────────────────────────────────────────────────────────────────────
function migrarConexiones() {
  var s = getSheet(HOJA_HISTORIAL_CONEX);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    if (!d[i][0]) continue;
    filas.push({
      id:         Utilities.getUuid(),
      created_at: formatTs(d[i][3]),
      usuario:    toStr(d[i][1]),
      area:       toStr(d[i][2]),
      ip:         null,
      device_id:  null,
      lat:        null,
      lng:        null
    });
  }
  supabaseInsert('historial_conexiones', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. AUDITORÍA (AuditoriaLogs)
// Columnas: [0]=Fecha [1]=Usuario [2]=Accion [3]=Detalle [4]=IDAfectado
//           [5]=GeoLat [6]=GeoLng [7]=DeviceID [8]=IP
// ─────────────────────────────────────────────────────────────────────────────
function migrarAuditoria() {
  var s = getSheet(HOJA_AUDITORIA);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    if (!d[i][0]) continue;
    filas.push({
      id:         Utilities.getUuid(),
      created_at: formatTs(d[i][0]),
      usuario:    toStr(d[i][1]),
      area:       null,
      accion:     toStr(d[i][2]),
      detalle:    toStr(d[i][3])
    });
  }
  supabaseInsert('auditoria', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. CREDENCIALES
// Columnas: [0]=ini(socio_id) [1]=area [2]=pin [3]=fecha
// ─────────────────────────────────────────────────────────────────────────────
function migrarCredenciales() {
  var s = getSheet(HOJA_CREDENCIALES);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  var seen = {};
  for (var i = 1; i < d.length; i++) {
    var socioId = toStr(d[i][0]);
    var pin     = toStr(d[i][2]);
    if (!socioId || !pin) continue;
    if (seen[socioId]) continue; // evitar duplicados, tomar el primero
    seen[socioId] = true;
    filas.push({
      id:       socioId + '_cred',
      socio_id: socioId,
      pin:      pin,
      device_id: null,
      rut:      null
    });
  }
  supabaseInsert('credenciales', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. RETIROS DE ANTICIPOS
// Columnas: [0]=Firma [1]=Nombre [2]=Monto [3]=Billetes(JSON) [4]=FechaRegistro [5]=Responsable
// ─────────────────────────────────────────────────────────────────────────────
function migrarRetiros() {
  var s = getSheet(HOJA_RETIROS_ANTICIPOS);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    var firma = toStr(d[i][0]);
    if (!firma) continue;
    filas.push({
      id:         Utilities.getUuid(),
      created_at: formatTs(d[i][4]),
      socio_id:   firma,
      monto:      toNum(d[i][2]),
      autor:      toStr(d[i][5]),
      periodo:    'importado'
    });
  }
  supabaseInsert('retiros_anticipos', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. MATERIALES (RecaudacionMateriales)
// Columnas: [0]=UUID [1]=Fecha [2]=Tipo [3]=Monto [4]=Nota [5]=Responsable
//           [6]=Periodo [7]=Estado
// ─────────────────────────────────────────────────────────────────────────────
function migrarMateriales() {
  var s = getSheet(HOJA_MATERIALES);
  if (!s || s.getLastRow() <= 1) return;
  var d = s.getDataRange().getValues();
  var filas = [];
  for (var i = 1; i < d.length; i++) {
    if (!d[i][0] || toStr(d[i][7]) === 'borrado') continue;
    filas.push({
      id:         toStr(d[i][0]),
      created_at: formatTs(d[i][1]),
      nombre:     toStr(d[i][2]),  // tipo como nombre
      cantidad:   toStr(d[i][3]),  // monto como cantidad
      autor:      toStr(d[i][5])
    });
  }
  supabaseInsert('materiales', filas);
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
function migrarTodo() {
  Logger.log('================================================================');
  Logger.log('MIGRACIÓN: socios-comicion-propina → Supabase');
  Logger.log('Proyecto: teemahksasdougehrcly');
  Logger.log('Fecha: ' + new Date().toISOString());
  Logger.log('================================================================');
  Logger.log('');

  Logger.log('--- 1/12 Socios ---');
  migrarSocios();             Utilities.sleep(800);

  Logger.log('--- 2/12 Anticipos (período activo) ---');
  migrarAnticipos();          Utilities.sleep(800);

  Logger.log('--- 3/12 Anticipos Historial (AnticiposGuardados) ---');
  migrarAnticiposHistorial(); Utilities.sleep(800);

  Logger.log('--- 4/12 Extras (MovimientosExtras) ---');
  migrarExtras();             Utilities.sleep(800);

  Logger.log('--- 5/12 Saldos Anteriores ---');
  migrarSaldos();             Utilities.sleep(500);

  Logger.log('--- 6/12 Días Part-Time ---');
  migrarDiasPT();             Utilities.sleep(500);

  Logger.log('--- 7/12 Chat / MensajesApp ---');
  migrarChat();               Utilities.sleep(800);

  Logger.log('--- 8/12 Historial Conexiones ---');
  migrarConexiones();         Utilities.sleep(800);

  Logger.log('--- 9/12 Auditoría ---');
  migrarAuditoria();          Utilities.sleep(800);

  Logger.log('--- 10/12 Credenciales ---');
  migrarCredenciales();       Utilities.sleep(500);

  Logger.log('--- 11/12 Retiros de Anticipos ---');
  migrarRetiros();            Utilities.sleep(500);

  Logger.log('--- 12/12 Materiales ---');
  migrarMateriales();

  Logger.log('');
  Logger.log('================================================================');
  Logger.log('MIGRACIÓN COMPLETADA');
  Logger.log('Verifica en: https://supabase.com/dashboard/project/teemahksasdougehrcly/editor');
  Logger.log('================================================================');
}
