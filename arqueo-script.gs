/*
  💰 SCRIPT MAESTRO V14 - ARQUEO PRO
  Maneja: Fórmulas, Retiros, Diferencias e Informes de Cierre con Rastro.
  + Retiros de Anticipos (sincronización entre dispositivos)
*/
const SHEET_RESUMEN = "Resumen_Arqueos";
const SHEET_CONTEO = "Detalle_Conteo";
const SHEET_CIERRES = "Informes_Cierres";
const SHEET_RETIROS_ANTICIPOS = "RetirosAnticipos";

function doGet(e) {
  setupSheets();

  if (e.parameter.action === 'getRetirosAnticipos') {
    return out({ status: 'success', data: getRetirosAnticipos() });
  }

  if (e.parameter.action === 'getLast') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetRes = ss.getSheetByName(SHEET_RESUMEN);
    var lastRow = sheetRes.getLastRow();
    if (lastRow < 2) return out({status:'error', message: 'Sin datos'});

    var dataRes = sheetRes.getRange(lastRow, 1, 1, 8).getValues()[0];
    var idObj = dataRes[0];

    var conteo = {};
    var rastros = {};
    var dataC = ss.getSheetByName(SHEET_CONTEO).getDataRange().getValues();
    for(var i=1; i<dataC.length; i++) {
      if(dataC[i][0] == idObj) {
        conteo[dataC[i][2]] = Number(dataC[i][3]);
        rastros[dataC[i][2]] = dataC[i][5] || "";
      }
    }
    return out({
      status: 'success',
      data: {
        conteoActual: conteo,
        movimientoDisplay: rastros,
        totalRetirado: Number(dataRes[5]),
        divisorPlanta: dataRes[6],
        divisorPartTime: dataRes[7]
      }
    });
  }

  // Para historial detallado
  if (e.parameter.action === 'get') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = ss.getSheetByName(SHEET_CIERRES).getDataRange().getValues();
    data.shift();
    var res = data.map(r => ({ fecha: r[1], monto: r[2], divisor: r[6], tipo: "Arqueo Guardado" }));
    return out({status: 'success', data: res});
  }
}

function doPost(e) {
  setupSheets();
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (data.action === 'registrarRetiroAnticipo') {
    registrarRetiroAnticipo(data.firma, data.nombre, data.monto, data.billetes, data.responsable);
    return out({ status: 'success', message: 'Retiro registrado' });
  }

  var id = "ARQ-" + new Date().getTime();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  if (e.parameter.action === 'archive' || data.action === 'archive') {
    var cantStr = Object.entries(data.conteoActual).filter(([k,v]) => v > 0).map(([k,v]) => "$"+k+":"+v).join(" | ");
    var formStr = Object.entries(data.movimientoDisplay || {}).filter(([k,v]) => v !== "").map(([k,v]) => "$"+k+"=("+v+")").join(" | ");
    ss.getSheetByName(SHEET_CIERRES).appendRow([id, now, data.totalContado, data.diferencia, data.totalRetirado, 0, data.divisorPlanta || 1, data.divisorPartTime || 1, cantStr, formStr]);
    return out({status:'success', message: 'Archivado'});
  }

  ss.getSheetByName(SHEET_RESUMEN).appendRow([id, now, data.totalContado, data.totalEsperado, data.diferencia, data.totalRetirado, data.divisorPlanta, data.divisorPartTime]);
  var cSheet = ss.getSheetByName(SHEET_CONTEO);
  for(var k in data.conteoActual) {
    if(data.conteoActual[k] !== 0) {
      cSheet.appendRow([id, now, k, data.conteoActual[k], k * data.conteoActual[k], data.movimientoDisplay[k] || ""]);
    }
  }
  return out({status:'success', message: 'Guardado'});
}

function registrarRetiroAnticipo(firma, nombre, monto, billetes, responsable) {
  if (!firma) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(SHEET_RETIROS_ANTICIPOS);
  if (!s) {
    s = ss.insertSheet(SHEET_RETIROS_ANTICIPOS);
    s.appendRow(['Firma', 'Nombre', 'Monto', 'Billetes', 'FechaRegistro', 'Responsable']);
  }
  // Evitar duplicados por firma
  if (s.getLastRow() > 1) {
    var datos = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < datos.length; i++) {
      if (String(datos[i][0]) === String(firma)) return;
    }
  }
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  s.appendRow([firma, nombre || '', monto || 0, JSON.stringify(billetes || {}), now, responsable || '']);
}

function getRetirosAnticipos() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RETIROS_ANTICIPOS);
  if (!s || s.getLastRow() <= 1) return {};
  var datos = s.getDataRange().getValues().slice(1);
  var resultado = {};
  datos.forEach(function(r) {
    var firma = String(r[0]);
    if (!firma) return;
    var billetes = {};
    try { billetes = JSON.parse(r[3] || '{}'); } catch(e) {}
    resultado[firma] = { nombre: r[1] || '', monto: parseFloat(r[2]) || 0, billetes: billetes, fecha: r[4] || '', responsable: r[5] || '' };
  });
  return resultado;
}

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var defs = [
    [SHEET_RESUMEN, ["ID", "Fecha", "Contado", "Esperado", "Dif", "Retiros", "Div.Planta", "Div.PT"]],
    [SHEET_CONTEO, ["ID", "Fecha", "Denom", "Cant", "Subtotal", "Rastro"]],
    [SHEET_CIERRES, ["ID", "Fecha", "Total", "Diferencia", "Retiros", "Puntos", "Div_P", "Div_PT", "Cantidades", "Detalle_Formulas"]],
    [SHEET_RETIROS_ANTICIPOS, ["Firma", "Nombre", "Monto", "Billetes", "FechaRegistro", "Responsable"]]
  ];
  defs.forEach(function(d) { if(!ss.getSheetByName(d[0])) { var s = ss.insertSheet(d[0]); s.appendRow(d[1]); } });
}

function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
