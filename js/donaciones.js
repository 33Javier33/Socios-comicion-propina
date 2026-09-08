// ============================================================
// DONACIONES — colectas entre socios
//
// Cuando un socio necesita ayuda se abre una COLECTA (un motivo) y los
// socios que quieran aportan un monto. El aporte se DESCUENTA del balance
// del donante y le aparece en propi.solicitada.
//
// Modelo de datos: cada aporte es una fila de la tabla `extras` con
// tipo 'DONACION' y detalle 'Donación: <motivo>'. Se usa `extras` a
// propósito, no una tabla nueva: es la misma vía por la que ya viajan las
// ausencias hasta la app del socio (getDatosSocio → data.extras), así que
// no hace falta ninguna migración en Supabase para que esto funcione.
//
// El monto recaudado NO se abona al balance del beneficiado: la
// administración le entrega el dinero aparte. La app solo lleva la cuenta.
// ============================================================

const DON_TIPO = 'DONACION';            // aporte de un socio  → SÍ descuenta
const DON_TIPO_EXT = 'DONACION_EXTERNA'; // aporte de alguien de fuera → NO descuenta
const DON_SOCIO_EXT = 'EXTERNO';         // socio_id ficticio: ningún socio lo tiene
const DON_PREFIJO = 'Donación: ';
const DON_MARCA_EXT = ' [ext:';          // marca el nombre y el área del externo

let _donAportes = [];        // aportes ya registrados (de la BD)
let _donMontos = {};         // socioId -> monto que se está por registrar
let _donExternos = [];       // [{ nombre, area, monto }] aún sin registrar
let _donAreaSel = 'todas';
let _donBusqueda = '';

function _donNorm(t) { return String(t || '').toLowerCase().replace(/[óÓ]/g, 'o'); }

// ENTREGA: el retiro de la caja cuando se le pasa la plata al beneficiado.
// No es un aporte — no suma al total juntado ni descuenta a nadie. Es solo el
// registro de que el dinero salió de la caja.
function don_esEntrega(tipo) {
    const t = _donNorm(tipo);
    return t.indexOf('donacion') >= 0 && t.indexOf('entrega') >= 0;
}
// Aporte de alguien que NO pertenece al fondo. Suma al total de la colecta
// pero no toca el balance de nadie, porque no hay saldo del cual descontar.
function don_esExterna(tipo) {
    const t = _donNorm(tipo);
    return t.indexOf('donacion') >= 0 && t.indexOf('extern') >= 0 && t.indexOf('entrega') < 0;
}
// Aporte de un socio: este SÍ se descuenta de su balance a recibir.
function don_esDonacion(tipo) {
    const t = _donNorm(tipo);
    return t.indexOf('donacion') >= 0 && t.indexOf('extern') < 0 && t.indexOf('entrega') < 0;
}
// Los dos tipos de APORTE, para listar la colecta y sumar el total juntado.
// La entrega queda fuera: si entrara, duplicaría el total.
function don_esAporte(tipo) {
    const t = _donNorm(tipo);
    return t.indexOf('donacion') >= 0 && t.indexOf('entrega') < 0;
}

// El motivo va dentro de `detalle`, después de "Donación: ". Si es un aporte
// externo, el nombre y el área van al final entre corchetes y se recortan
// para que la colecta agrupe igual que la de los socios.
function don_motivoDe(detalle) {
    let d = String(detalle || '').trim();
    // Se recortan las marcas del final ( [ext:...] de un aporte externo,
    // [entrega] de un retiro de caja) para que todo caiga en la MISMA colecta.
    [DON_MARCA_EXT, ' [entrega]'].forEach(marca => {
        const k = d.indexOf(marca);
        if (k >= 0) d = d.slice(0, k).trim();
    });
    const i = d.indexOf(':');
    const m = i >= 0 ? d.slice(i + 1).trim() : d;
    return m || 'Sin motivo';
}
// Devuelve { nombre, area } si el aporte es de alguien externo, o null.
function don_externoDe(detalle) {
    const d = String(detalle || '');
    const k = d.indexOf(DON_MARCA_EXT);
    if (k < 0) return null;
    const cuerpo = d.slice(k + DON_MARCA_EXT.length).replace(/\]\s*$/, '');
    const p = cuerpo.split('|');
    return { nombre: (p[0] || '').trim() || 'Sin nombre', area: (p[1] || '').trim() || '—' };
}
// Los corchetes y la barra son separadores: se limpian del texto que se escribe.
function _donLimpioExt(txt) { return String(txt || '').replace(/[\[\]|]/g, ' ').replace(/\s+/g, ' ').trim(); }

function _donEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _donMoneda(n) { return formatearMoneda(Math.round(Number(n) || 0)); }
function _donFechaVis(f) {
    const s = String(f || '').substring(0, 10).split('-');
    return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(f || '');
}
function _donAreaNombre(a) {
    const k = String(a || '').toLowerCase();
    const N = { mesas: 'Mesas', maquinas: 'Máquinas', tecnicos: 'Técnicos', boveda: 'Bóveda', gastoscomision: 'Gastos Comisión' };
    return N[k] || (a ? a.charAt(0).toUpperCase() + a.slice(1) : '—');
}

// El motivo se escribe en un textarea de 3 líneas que crece solo, para poder
// releer lo escrito sin que quede cortado en una sola línea.
function don_autoAltoMotivo(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(200, Math.max(68, ta.scrollHeight)) + 'px';
    const c = document.getElementById('don-motivo-contador');
    if (c) {
        const n = (ta.value || '').length;
        c.textContent = n + ' / ' + (ta.maxLength > 0 ? ta.maxLength : 220);
        c.style.color = n > 190 ? '#b45309' : '#94a3b8';
    }
}

// Se guarda en una sola línea: el motivo es la clave que agrupa la colecta y
// el texto que el socio ve junto al descuento en su app. Los saltos de línea
// del textarea se convierten en espacios para que no rompan ni el agrupado ni
// la lectura en la app del socio.
function don_normalizarMotivo(txt) {
    return String(txt || '').replace(/\s+/g, ' ').trim();
}

// ── Control de repetidos dentro de una misma colecta ───────────────────
// El motivo es lo que agrupa la colecta, así que con el motivo en pantalla se
// puede saber quién ya aportó y avisar ANTES de duplicar el aporte.
function don_motivoEnPantalla() {
    return don_normalizarMotivo(document.getElementById('don-motivo')?.value);
}

// socioId -> { monto, veces } de lo ya registrado en esta colecta
function don_sociosYaAportaron(motivo) {
    const mapa = {};
    if (!motivo) return mapa;
    (_donAportes || []).forEach(a => {
        if (!don_esDonacion(a.tipo)) return;
        if (don_motivoDe(a.detalle) !== motivo) return;
        const k = String(a.socio_id);
        if (!mapa[k]) mapa[k] = { monto: 0, veces: 0 };
        mapa[k].monto += Number(a.monto) || 0;
        mapa[k].veces++;
    });
    return mapa;
}

// Aportes de personas ajenas ya registrados en esta colecta
function don_externosYaAportaron(motivo) {
    const lista = [];
    if (!motivo) return lista;
    (_donAportes || []).forEach(a => {
        if (!don_esExterna(a.tipo)) return;
        if (don_motivoDe(a.detalle) !== motivo) return;
        const ext = don_externoDe(a.detalle);
        if (ext) lista.push({ nombre: ext.nombre, area: ext.area, monto: Number(a.monto) || 0 });
    });
    return lista;
}

function _donMismoNombre(a, b) {
    const n = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    return n(a) === n(b);
}

// Repintar la lista cuando cambia el motivo, para que las marcas de
// "ya aportó" correspondan a la colecta que se está escribiendo.
let _donMotivoTimer = null;
function don_motivoCambio() {
    clearTimeout(_donMotivoTimer);
    _donMotivoTimer = setTimeout(() => { don_pintarSocios(); don_pintarExternos(); }, 250);
}

function don_init() {
    _donMontos = {};
    _donExternos = [];
    const hoy = new Date().toISOString().split('T')[0];
    const fIn = document.getElementById('don-fecha');
    if (fIn && !fIn.value) fIn.value = hoy;
    don_autoAltoMotivo(document.getElementById('don-motivo'));
    don_pintarAreas();
    don_pintarSocios();
    don_pintarExternos();
    don_cargarAportes();
}

// ── Seguir una colecta que ya está abierta ─────────────────────────────
// Una colecta no se cierra sola: puede seguir sumando gente días después.
// Elegirla de la lista rellena el motivo exacto, que es la clave que agrupa
// los aportes — retipearlo a mano crearía una colecta separada por una coma.
function don_pintarSelectorColectas() {
    const sel = document.getElementById('don-colecta-existente');
    if (!sel) return;
    const motivos = [...new Set((_donAportes || []).map(a => don_motivoDe(a.detalle)))]
        .sort((x, y) => x.localeCompare(y, 'es'));
    const actual = sel.value;
    sel.innerHTML = '<option value="">— Colecta nueva —</option>'
        + motivos.map(m => `<option value="${_donEsc(m)}">${_donEsc(m.length > 70 ? m.slice(0, 70) + '…' : m)}</option>`).join('');
    if (actual && motivos.indexOf(actual) >= 0) sel.value = actual;
    sel.parentNode.style.display = motivos.length ? 'block' : 'none';
}

function don_elegirColecta() {
    const sel = document.getElementById('don-colecta-existente');
    const ta = document.getElementById('don-motivo');
    if (!sel || !ta) return;
    if (sel.value) {
        ta.value = sel.value;
        ta.readOnly = true;
        ta.style.background = '#f1f5f9';
    } else {
        ta.readOnly = false;
        ta.style.background = 'white';
        ta.value = '';
    }
    don_autoAltoMotivo(ta);
}

// ── Aportantes que NO son socios del fondo ─────────────────────────────
// Se registran solo para efecto de la colecta: suman al total juntado pero
// NO se les descuenta nada, porque no tienen saldo en el fondo.
function don_agregarExterno() {
    const iN = document.getElementById('don-ext-nombre');
    const iA = document.getElementById('don-ext-area');
    const iM = document.getElementById('don-ext-monto');
    const nombre = _donLimpioExt(iN?.value);
    const area = _donLimpioExt(iA?.value) || 'Externo';
    const monto = parseInt(String(iM?.value || '').replace(/\D/g, '')) || 0;

    if (!nombre) { showToast('Escribe el nombre de la persona', 'error'); iN?.focus(); return; }
    if (!monto)  { showToast('Escribe cuánto aporta', 'error'); iM?.focus(); return; }

    // ¿Repetido en la lista que aún no se registra?
    const rep = _donExternos.find(x => _donMismoNombre(x.nombre, nombre));
    if (rep && !confirm('Ya agregaste a "' + rep.nombre + '" en esta lista, por ' + _donMoneda(rep.monto)
        + '.\n\n¿Agregarlo igual como un segundo aporte?')) return;

    // ¿Y ya aportó antes a esta misma colecta?
    const motivoActual = don_motivoEnPantalla();
    const yaExt = don_externosYaAportaron(motivoActual).filter(x => _donMismoNombre(x.nombre, nombre));
    if (yaExt.length) {
        const suma = yaExt.reduce((t, x) => t + x.monto, 0);
        if (!confirm('⚠️ "' + yaExt[0].nombre + '" YA aportó ' + _donMoneda(suma)
            + ' a esta colecta' + (yaExt.length > 1 ? ' (' + yaExt.length + ' aportes)' : '') + '.\n\n'
            + 'Colecta: ' + motivoActual + '\n\n¿Registrarle otro aporte igual?')) return;
    }

    _donExternos.push({ nombre, area, monto });
    if (iN) iN.value = '';
    if (iM) iM.value = '';
    if (iN) iN.focus();
    don_pintarExternos();
}

function don_quitarExterno(i) {
    _donExternos.splice(i, 1);
    don_pintarExternos();
}

function don_pintarExternos() {
    const cont = document.getElementById('don-externos-lista');
    if (!cont) return;
    if (!_donExternos.length) {
        cont.innerHTML = '<div style="font-size:0.75em;color:#94a3b8;padding:6px 2px;">Nadie agregado todavía. A estas personas <b>no</b> se les descuenta nada: solo suman al total de la colecta.</div>';
        don_actualizarResumen();
        return;
    }
    const yaExt = don_externosYaAportaron(don_motivoEnPantalla());
    cont.innerHTML = _donExternos.map((x, i) => {
        const previos = yaExt.filter(y => _donMismoNombre(y.nombre, x.nombre));
        const sumaPrev = previos.reduce((t, y) => t + y.monto, 0);
        const avisoRep = previos.length
            ? `<div style="font-size:0.66em;color:#b91c1c;font-weight:800;">⚠ Ya había aportado ${_donMoneda(sumaPrev)} a esta colecta</div>`
            : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid ${previos.length ? '#f87171' : '#fcd34d'};background:${previos.length ? '#fef2f2' : '#fffbeb'};border-radius:9px;margin-bottom:5px;">
            <span style="flex-shrink:0;font-size:0.9em;">👤</span>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.83em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_donEsc(x.nombre)}</div>
                <div style="font-size:0.68em;color:#b45309;">${_donEsc(x.area)} · no pertenece al fondo</div>
                ${avisoRep}
            </div>
            <b style="font-size:0.83em;color:#b45309;white-space:nowrap;">${_donMoneda(x.monto)}</b>
            <button onclick="don_quitarExterno(${i})" title="Quitar de la lista"
                style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:3px 7px;font-size:0.72em;cursor:pointer;">✕</button>
        </div>`;
    }).join('');
    don_actualizarResumen();
}

function don_fmtMontoExt(input) {
    const n = parseInt(String(input.value || '').replace(/\D/g, '')) || 0;
    input.value = n ? new Intl.NumberFormat('es-CL').format(n) : '';
}

// ── Formulario: área → socios de esa área → monto de cada uno ──────────
function don_pintarAreas() {
    const sel = document.getElementById('don-area');
    if (!sel) return;
    const areas = [...new Set((cacheSocios || []).map(s => String(s.area || '').toLowerCase()).filter(Boolean))].sort();
    const actual = sel.value || 'todas';
    sel.innerHTML = '<option value="todas">Todas las áreas</option>'
        + areas.map(a => `<option value="${_donEsc(a)}">${_donEsc(_donAreaNombre(a))}</option>`).join('');
    sel.value = actual;
}

function don_filtrarSocios() {
    _donAreaSel = (document.getElementById('don-area')?.value) || 'todas';
    _donBusqueda = ((document.getElementById('don-buscar')?.value) || '').toLowerCase().trim();
    don_pintarSocios();
}

function _donSociosVisibles() {
    let lista = (cacheSocios || []).slice();
    if (_donAreaSel !== 'todas') lista = lista.filter(s => String(s.area || '').toLowerCase() === _donAreaSel);
    if (_donBusqueda) lista = lista.filter(s => ((s.nombre || '') + ' ' + (s.apellido || '')).toLowerCase().includes(_donBusqueda));
    return lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
}

function don_pintarSocios() {
    const cont = document.getElementById('don-socios-lista');
    if (!cont) return;
    const lista = _donSociosVisibles();
    if (!lista.length) {
        cont.innerHTML = '<div style="text-align:center;padding:18px;color:#94a3b8;font-size:0.85em;">No hay socios en esta área.</div>';
        don_actualizarResumen();
        return;
    }
    // Quién ya aportó a la colecta que está escrita en el motivo, para avisarlo
    // en la misma fila y no registrarle un segundo aporte sin darse cuenta.
    const yaAportaron = don_sociosYaAportaron(don_motivoEnPantalla());

    cont.innerHTML = lista.map(s => {
        const val = _donMontos[s.id] ? new Intl.NumberFormat('es-CL').format(_donMontos[s.id]) : '';
        const activo = !!_donMontos[s.id];
        const ya = yaAportaron[String(s.id)];
        const borde = ya ? '#f59e0b' : (activo ? '#86efac' : '#e2e8f0');
        const fondo = ya ? '#fffbeb' : (activo ? '#f0fdf4' : 'white');
        const avisoYa = ya
            ? `<div style="font-size:0.68em;color:#b45309;font-weight:700;">⚠ Ya aportó ${_donMoneda(ya.monto)}${ya.veces > 1 ? ' en ' + ya.veces + ' aportes' : ''} a esta colecta</div>`
            : '';
        return `<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;border:1px solid ${borde};border-radius:9px;margin-bottom:6px;background:${fondo};">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:0.85em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_donEsc(s.nombre)} ${_donEsc(s.apellido || '')}</div>
                <div style="font-size:0.7em;color:#94a3b8;">${_donEsc(_donAreaNombre(s.area))}</div>
                ${avisoYa}
            </div>
            <input type="text" inputmode="numeric" id="don-m-${_donEsc(s.id)}" value="${val}" placeholder="$0"
                oninput="don_montoCambio('${_donEsc(s.id)}', this)"
                style="width:96px;padding:7px 8px;border:1.5px solid ${ya ? '#f59e0b' : (activo ? '#22c55e' : '#e2e8f0')};border-radius:8px;font-size:0.85em;font-weight:700;text-align:right;color:#0f172a;background:white;box-sizing:border-box;">
        </div>`;
    }).join('');
    don_actualizarResumen();
}

function don_montoCambio(socioId, input) {
    const n = parseInt(String(input.value || '').replace(/\D/g, '')) || 0;
    if (n > 0) { _donMontos[socioId] = n; input.value = new Intl.NumberFormat('es-CL').format(n); }
    else { delete _donMontos[socioId]; input.value = ''; }
    don_actualizarResumen();
}

// Pone el mismo monto a todos los socios visibles (el área filtrada).
function don_montoParaTodos() {
    const inp = document.getElementById('don-monto-todos');
    const n = parseInt(String(inp?.value || '').replace(/\D/g, '')) || 0;
    const lista = _donSociosVisibles();
    if (!n) { lista.forEach(s => delete _donMontos[s.id]); don_pintarSocios(); return; }

    // Los que ya aportaron a esta colecta se dejan fuera salvo que se confirme.
    const ya = don_sociosYaAportaron(don_motivoEnPantalla());
    const repiten = lista.filter(s => ya[String(s.id)]);
    let incluirRepetidos = true;
    if (repiten.length) {
        incluirRepetidos = confirm(
            '⚠️ ' + repiten.length + ' socio(s) YA aportaron a esta colecta:\n\n'
            + repiten.slice(0, 12).map(s => '  · ' + (s.nombre + ' ' + (s.apellido || '')).trim()
                + ' — ' + _donMoneda(ya[String(s.id)].monto)).join('\n')
            + (repiten.length > 12 ? '\n  … y ' + (repiten.length - 12) + ' más' : '')
            + '\n\nACEPTAR  → ponerles el monto igual (aportarían de nuevo)\n'
            + 'CANCELAR → dejarlos fuera y cargar solo a los que faltan'
        );
    }
    lista.forEach(s => {
        if (!incluirRepetidos && ya[String(s.id)]) return;
        _donMontos[s.id] = n;
    });
    don_pintarSocios();
}

function don_limpiarSeleccion() {
    _donMontos = {};
    const inp = document.getElementById('don-monto-todos');
    if (inp) inp.value = '';
    don_pintarSocios();
}

function don_actualizarResumen() {
    const ids = Object.keys(_donMontos);
    const totalSoc = ids.reduce((s, k) => s + _donMontos[k], 0);
    const totalExt = _donExternos.reduce((s, x) => s + x.monto, 0);
    const el = document.getElementById('don-resumen');
    if (el) {
        if (!ids.length && !_donExternos.length) {
            el.innerHTML = '<span style="color:#94a3b8;">Escribe un monto a los socios que van a aportar, o agrega personas de fuera del fondo.</span>';
        } else {
            const partes = [];
            if (ids.length) partes.push(`<b>${ids.length}</b> socio${ids.length === 1 ? '' : 's'} (se descuenta) <b style="color:#15803d;">${_donMoneda(totalSoc)}</b>`);
            if (_donExternos.length) partes.push(`<b>${_donExternos.length}</b> externo${_donExternos.length === 1 ? '' : 's'} (sin descuento) <b style="color:#b45309;">${_donMoneda(totalExt)}</b>`);
            el.innerHTML = partes.join(' &nbsp;·&nbsp; ')
                + `<div style="margin-top:4px;font-size:1.02em;">Total a juntar <b style="color:#15803d;">${_donMoneda(totalSoc + totalExt)}</b></div>`;
        }
    }
    const btn = document.getElementById('don-btn-registrar');
    if (btn) btn.disabled = (ids.length === 0 && _donExternos.length === 0);
}

// ── Registrar los aportes ──────────────────────────────────────────────
async function don_registrar() {
    const motivo = don_normalizarMotivo(document.getElementById('don-motivo')?.value);
    const fecha = (document.getElementById('don-fecha')?.value || '').trim() || new Date().toISOString().split('T')[0];
    const ids = Object.keys(_donMontos);

    if (!motivo) {
        showToast('Escribe el motivo de la colecta (para quién es la ayuda)', 'error');
        document.getElementById('don-motivo')?.focus();
        return;
    }
    if (!ids.length && !_donExternos.length) { showToast('No hay ningún aporte cargado', 'error'); return; }

    // ── Última barrera: avisar quién estaría aportando DOS VECES a la misma
    // colecta. Se revisa contra lo ya guardado, por si la lista se cargó antes
    // de que otro encargado registrara aportes desde otro equipo.
    const yaSoc = don_sociosYaAportaron(motivo);
    const yaExt = don_externosYaAportaron(motivo);
    const repes = [];
    ids.forEach(id => {
        const y = yaSoc[String(id)];
        if (!y) return;
        const so = (cacheSocios || []).find(x => String(x.id) === String(id)) || {};
        repes.push('  · ' + ((so.nombre || '') + ' ' + (so.apellido || '')).trim()
            + ' — ya aportó ' + _donMoneda(y.monto));
    });
    _donExternos.forEach(x => {
        const previos = yaExt.filter(y => _donMismoNombre(y.nombre, x.nombre));
        if (!previos.length) return;
        repes.push('  · ' + x.nombre + ' (externo) — ya aportó '
            + _donMoneda(previos.reduce((t, y) => t + y.monto, 0)));
    });
    if (repes.length) {
        if (!confirm('⚠️ REPETIDOS EN ESTA COLECTA\n\n' + repes.slice(0, 15).join('\n')
            + (repes.length > 15 ? '\n  … y ' + (repes.length - 15) + ' más' : '')
            + '\n\nColecta: ' + motivo
            + '\n\nSi continúas se les registrará un aporte ADICIONAL, que se suma al que ya tenían.'
            + '\n\n¿Continuar de todas formas?')) return;
    }

    const totalSoc = ids.reduce((s, k) => s + _donMontos[k], 0);
    const totalExt = _donExternos.reduce((s, x) => s + x.monto, 0);
    const lineas = [];
    if (ids.length) lineas.push(ids.length + ' socio(s) — ' + _donMoneda(totalSoc) + ' (se les descuenta del balance)');
    if (_donExternos.length) lineas.push(_donExternos.length + ' persona(s) de fuera del fondo — ' + _donMoneda(totalExt) + ' (sin descuento)');
    if (!confirm('¿Registrar estos aportes?\n\n' + lineas.join('\n')
        + '\n\nTOTAL: ' + _donMoneda(totalSoc + totalExt)
        + '\n\nColecta: ' + motivo)) return;

    const detalleExtras = ids.map(id => {
        const s = (cacheSocios || []).find(x => String(x.id) === String(id)) || {};
        return {
            id: id,
            nombre: ((s.nombre || '') + ' ' + (s.apellido || '')).trim(),
            fecha: fecha,
            tipo: DON_TIPO,
            monto: _donMontos[id],
            detalle: DON_PREFIJO + motivo
        };
    });

    // Los externos van con un socio_id ficticio y un tipo aparte, para que
    // ningún cálculo de saldo los tome como descuento de un socio.
    const externosPendientes = _donExternos.slice();
    externosPendientes.forEach(x => {
        detalleExtras.push({
            id: DON_SOCIO_EXT,
            nombre: x.nombre,
            fecha: fecha,
            tipo: DON_TIPO_EXT,
            monto: x.monto,
            detalle: DON_PREFIJO + motivo + DON_MARCA_EXT + x.nombre + '|' + x.area + ']'
        });
    });

    toggleLoader(true, 'Registrando aportes...');
    try {
        const res = await callApiSocios('registrarBatchExtras', { detalleExtras });
        if (res && res.status === 'error') throw new Error(res.message || 'error');
        showToast(detalleExtras.length + ' aporte(s) registrados ✅', 'success');
        _donMontos = {};
        _donExternos = [];
        const mt = document.getElementById('don-monto-todos'); if (mt) mt.value = '';
        globalCacheAllData = null;
        try { localStorage.removeItem(CACHE_KEY_ALL_DATA); } catch(e) {}
        don_pintarSocios();
        don_pintarExternos();
        await don_cargarAportes();

        // Verificación: los aportes externos usan un socio_id ficticio, y si la
        // base lo rechazara la capa de respaldo devolvería "success" igual. Se
        // comprueba contra lo que quedó guardado para no dar por hecho algo falso.
        if (externosPendientes.length) {
            const guardados = _donAportes.filter(a =>
                don_esExterna(a.tipo) && don_motivoDe(a.detalle) === motivo).length;
            if (guardados < externosPendientes.length) {
                showToast('⚠️ Los aportes de personas externas no quedaron guardados. Los de socios sí.', 'error');
            }
        }
    } catch(e) {
        showToast('No se pudieron registrar: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}

// ── Colectas registradas ───────────────────────────────────────────────
async function don_cargarAportes() {
    const cont = document.getElementById('don-colectas');
    if (!cont) return;
    cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">⏳ Cargando...</div>';
    try {
        const { data, error } = await dbSoc.from('extras')
            .select('id, socio_id, fecha, tipo, monto, detalle, autor')
            .ilike('tipo', '%donacion%')   // incluye DONACION y DONACION_EXTERNA
            .order('fecha', { ascending: false })
            .limit(2000);
        if (error) throw error;
        _donAportes = data || [];
        don_pintarColectas();
        don_pintarSelectorColectas();
        // Con los aportes ya cargados se pueden marcar los repetidos del formulario
        don_pintarSocios();
        don_pintarExternos();
    } catch(e) {
        cont.innerHTML = '<div style="text-align:center;padding:20px;color:#dc2626;font-size:0.85em;">Error al cargar las colectas</div>';
    }
}

function don_pintarColectas() {
    const cont = document.getElementById('don-colectas');
    if (!cont) return;
    if (!_donAportes.length) {
        cont.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.85em;">Todavía no hay colectas registradas.</div>';
        const tot = document.getElementById('don-total-general');
        if (tot) tot.textContent = _donMoneda(0);
        return;
    }

    // Agrupar por motivo
    const grupos = {};
    _donAportes.forEach(a => {
        const m = don_motivoDe(a.detalle);
        if (don_esEntrega(a.tipo)) {   // el retiro de caja no es un aporte
            if (!grupos[m]) grupos[m] = { motivo: m, aportes: [], total: 0, ultima: '', nExt: 0, entregado: 0 };
            grupos[m].entregado = (grupos[m].entregado || 0) + (Number(a.monto) || 0);
            return;
        }
        if (!grupos[m]) grupos[m] = { motivo: m, aportes: [], total: 0, ultima: '', nExt: 0, entregado: 0 };
        grupos[m].aportes.push(a);
        grupos[m].total += Number(a.monto) || 0;
        if (don_esExterna(a.tipo)) grupos[m].nExt++;
        const f = String(a.fecha || '').substring(0, 10);
        if (f > grupos[m].ultima) grupos[m].ultima = f;
    });
    const lista = Object.values(grupos).filter(g => g.aportes.length)
        .sort((a, b) => b.ultima.localeCompare(a.ultima));
    const totalGeneral = lista.reduce((s, g) => s + g.total, 0);
    const tot = document.getElementById('don-total-general');
    if (tot) tot.textContent = _donMoneda(totalGeneral);

    cont.innerHTML = lista.map((g, i) => {
        const filas = g.aportes.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map(a => {
            const ext = don_externoDe(a.detalle);
            const s = ext ? null : (cacheSocios || []).find(x => String(x.id) === String(a.socio_id));
            const nombre = ext ? ext.nombre : (s ? ((s.nombre || '') + ' ' + (s.apellido || '')).trim() : ('Socio ' + a.socio_id));
            const area = ext ? ext.area : (s ? _donAreaNombre(s.area) : '');
            const marca = ext ? ' · <span style="color:#b45309;font-weight:700;">no pertenece al fondo</span>' : '';
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px dashed #e2e8f0;${ext ? 'background:#fffbeb;' : ''}">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.8em;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ext ? '👤 ' : ''}${_donEsc(nombre)}</div>
                    <div style="font-size:0.68em;color:#94a3b8;">${_donEsc(area)} · ${_donFechaVis(a.fecha)}${a.autor ? ' · ' + _donEsc(a.autor) : ''}${marca}</div>
                </div>
                <b style="font-size:0.82em;color:${ext ? '#b45309' : '#15803d'};white-space:nowrap;">${_donMoneda(a.monto)}</b>
                <button onclick="don_borrarAporte('${_donEsc(a.id)}','${_donEsc(a.socio_id)}','${_donEsc(String(a.fecha).substring(0,10))}')"
                    title="Anular este aporte y devolverle el monto al socio"
                    style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:3px 7px;font-size:0.72em;cursor:pointer;">🗑</button>
            </div>`;
        }).join('');

        return `<div style="border:1px solid #e2e8f0;border-radius:11px;margin-bottom:10px;overflow:hidden;background:white;">
            <button onclick="don_toggleColecta(${i})" style="width:100%;display:flex;align-items:flex-start;gap:10px;padding:11px 12px;background:#f8fafc;border:none;border-bottom:1px solid #e2e8f0;cursor:pointer;text-align:left;">
                <span style="font-size:1.15em;line-height:1.2;">💝</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.88em;color:#0f172a;line-height:1.35;overflow-wrap:anywhere;">${_donEsc(g.motivo)}</div>
                    <div style="font-size:0.7em;color:#64748b;margin-top:1px;">${g.aportes.length} aporte${g.aportes.length === 1 ? '' : 's'}${g.nExt ? ' (' + g.nExt + ' de fuera del fondo)' : ''} · último ${_donFechaVis(g.ultima)}</div>
                    <div style="font-size:0.68em;margin-top:2px;font-weight:700;color:${g.entregado ? '#15803d' : '#b45309'};">${g.entregado ? '✅ Retirado de la caja: ' + _donMoneda(g.entregado) : '⏳ Pendiente de retirar de la caja'}</div>
                </div>
                <b style="font-size:0.95em;color:#15803d;white-space:nowrap;">${_donMoneda(g.total)}</b>
                <span id="don-cx-${i}" style="color:#94a3b8;font-size:0.8em;">▾</span>
            </button>
            <div style="display:flex;gap:6px;padding:8px 10px;background:#fdf2f8;border-bottom:1px solid #f9a8d4;flex-wrap:wrap;">
                <button onclick="don_imprimirColecta(${JSON.stringify(g.motivo).replace(/"/g, '&quot;')})"
                    style="flex:1;min-width:120px;background:#9d174d;color:white;border:none;border-radius:8px;padding:7px 10px;font-size:0.76em;font-weight:700;cursor:pointer;">🖨 Imprimir comprobante</button>
                <button onclick="don_guardarCopia(${JSON.stringify(g.motivo).replace(/"/g, '&quot;')})"
                    style="flex:1;min-width:120px;background:white;color:#9d174d;border:1.5px solid #9d174d;border-radius:8px;padding:7px 10px;font-size:0.76em;font-weight:700;cursor:pointer;">💾 Guardar copia</button>
                <button onclick="don_abrirEgreso(${JSON.stringify(g.motivo).replace(/"/g, '&quot;')})"
                    title="Sacar de la caja el dinero de esta colecta"
                    style="flex:1;min-width:120px;background:white;color:#0f766e;border:1.5px solid #0f766e;border-radius:8px;padding:7px 10px;font-size:0.76em;font-weight:700;cursor:pointer;">💵 Egreso de caja</button>
            </div>
            <div id="don-detalle-${i}" style="display:none;">${filas}</div>
        </div>`;
    }).join('');
}

function don_toggleColecta(i) {
    const d = document.getElementById('don-detalle-' + i);
    const c = document.getElementById('don-cx-' + i);
    if (!d) return;
    const abierto = d.style.display !== 'none';
    d.style.display = abierto ? 'none' : 'block';
    if (c) c.textContent = abierto ? '▾' : '▴';
}

// Anular un aporte: borra el extra, con lo que el descuento desaparece del
// balance del socio en las dos apps al recalcularse.
async function don_borrarAporte(id, socioId, fecha) {
    if (!confirm('¿Anular este aporte?\n\nSe le devuelve el monto al balance del socio.')) return;
    toggleLoader(true, 'Anulando aporte...');
    try {
        const res = await callApiSocios('borrarMovimiento', { uuid: id, tipo: 'Extra', socioId: String(socioId), fecha: fecha });
        if (res && res.status === 'error') throw new Error(res.message || 'error');
        globalCacheAllData = null;
        try { localStorage.removeItem(CACHE_KEY_ALL_DATA); } catch(e) {}
        showToast('Aporte anulado', 'success');
        await don_cargarAportes();
    } catch(e) {
        showToast('No se pudo anular: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}

// Formatea el campo "mismo monto para todos" mientras se escribe
function don_fmtMonto(input) {
    const n = parseInt(String(input.value || '').replace(/\D/g, '')) || 0;
    input.value = n ? new Intl.NumberFormat('es-CL').format(n) : '';
}

// ══════════════════════════════════════════════════════════════════════
// COMPROBANTE DE COLECTA — para imprimir y para respaldar el descuento
//
// La copia se guarda como archivo real en el bucket 'documentos' y queda
// listada en la sección Documentación. Eso importa porque "Reiniciar
// Ausencias" limpia la tabla `extras` y con ella los aportes: la copia es
// lo que deja constancia de quién aportó y cuánto se le descontó.
// ══════════════════════════════════════════════════════════════════════

function _donDatosColecta(motivo) {
    // Solo APORTES: la entrega (el retiro de caja) no es dinero juntado,
    // así que no entra ni en los totales ni en el listado del comprobante.
    const aportes = _donAportes.filter(a => don_esAporte(a.tipo) && don_motivoDe(a.detalle) === motivo);
    const porArea = {};
    const externos = [];
    let totalSocios = 0, totalExternos = 0;

    aportes.forEach(a => {
        const monto = Number(a.monto) || 0;
        const ext = don_externoDe(a.detalle);
        if (ext) {
            // No pertenece al fondo: suma al total pero no se le descuenta nada.
            totalExternos += monto;
            externos.push({
                nombre: ext.nombre,
                area: ext.area,
                fecha: String(a.fecha || '').substring(0, 10),
                autor: a.autor || '—',
                monto: monto
            });
            return;
        }
        const s = (cacheSocios || []).find(x => String(x.id) === String(a.socio_id)) || {};
        const areaKey = String(s.area || 'sin-area').toLowerCase();
        if (!porArea[areaKey]) porArea[areaKey] = { nombre: _donAreaNombre(s.area), filas: [], total: 0 };
        totalSocios += monto;
        porArea[areaKey].total += monto;
        porArea[areaKey].filas.push({
            nombre: (((s.nombre || '') + ' ' + (s.apellido || '')).trim()) || ('Socio ' + a.socio_id),
            rut: s.rut || '—',
            fecha: String(a.fecha || '').substring(0, 10),
            autor: a.autor || '—',
            monto: monto
        });
    });

    Object.values(porArea).forEach(g => g.filas.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')));
    externos.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
    const areas = Object.values(porArea).sort((a, b) => b.total - a.total);
    const nSocios = areas.reduce((n, g) => n + g.filas.length, 0);
    return { motivo, aportes, areas, externos, totalSocios, totalExternos, nSocios, total: totalSocios + totalExternos };
}

function _donComprobanteHTML(motivo) {
    const d = _donDatosColecta(motivo);
    if (!d.aportes.length) return null;

    const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    const money = n => '$' + Number(Math.round(n) || 0).toLocaleString('es-CL');
    const hoy = new Date();
    const fechaVis = hoy.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaVis = hoy.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const fechas = d.aportes.map(a => String(a.fecha || '').substring(0, 10)).filter(Boolean).sort();
    const rango = fechas.length
        ? (_donFechaVis(fechas[0]) + (fechas[0] !== fechas[fechas.length - 1] ? ' al ' + _donFechaVis(fechas[fechas.length - 1]) : ''))
        : '—';

    // ── Paginación propia ────────────────────────────────────────────────
    // No se deja que el navegador reparta el contenido: al partir el listado
    // entre hojas descartaba la fila justa del borde (se imprimía hasta el
    // aporte 40 y saltaba al 42). Acá se arma cada hoja contando líneas y se
    // corta a mano, así ninguna entrada puede perderse.
    const LINEAS_POR_HOJA = 39;   // tope de líneas que entran en una hoja
    const COSTO_ENCABEZADO = 11;  // título, motivo y KPIs ocupan la primera
    const COSTO_CIERRE = 14;      // resumen, nota, firmas y pie

    const COLS_SOC = ['#', 'SOCIO', 'RUT', 'FECHA', 'REGISTRADO POR', 'APORTE'];
    const COLS_EXT = ['#', 'NOMBRE', 'PROCEDENCIA', 'FECHA', 'APORTE'];
    const cabecera = (clase, cols) => '<div class="fila cab ' + clase + '">'
        + cols.map(c => '<span>' + c + '</span>').join('') + '</div>';
    const encAreaHTML = (nombre, cant, total, clase, cont) =>
        '<div class="areahead ' + (clase || '') + '"><span>' + esc(nombre) + (cont ? ' (continuación)' : '') + '</span>'
        + '<span>' + cant + ' aporte' + (cant !== 1 ? 's' : '') + ' &nbsp;|&nbsp; ' + money(total) + '</span></div>';

    // Se arma la lista completa de líneas y recién después se reparte en hojas.
    const items = [];
    let n = 0;
    d.areas.forEach(g => {
        items.push({ tipo: 'head', costo: 2,
            html: encAreaHTML(g.nombre, g.filas.length, g.total, '', false),
            cont: encAreaHTML(g.nombre, g.filas.length, g.total, '', true) });
        items.push({ tipo: 'cab', costo: 1, html: cabecera('soc', COLS_SOC) });
        g.filas.forEach(f => {
            n++;
            items.push({ tipo: 'fila', costo: 1, html:
                '<div class="fila soc">'
                + '<span class="c">' + n + '</span>'
                + '<span class="nom">' + esc(f.nombre) + '</span>'
                + '<span class="c">' + esc(f.rut) + '</span>'
                + '<span class="c">' + _donFechaVis(f.fecha) + '</span>'
                + '<span class="c">' + esc(f.autor) + '</span>'
                + '<span class="pts">' + money(f.monto) + '</span>'
                + '</div>' });
        });
        items.push({ tipo: 'sub', costo: 1, html:
            '<div class="fila sub soc"><span class="lbl">SUBTOTAL ' + esc(g.nombre.toUpperCase())
            + ' — ' + g.filas.length + ' aporte' + (g.filas.length !== 1 ? 's' : '') + '</span>'
            + '<span class="pts">' + money(g.total) + '</span></div>' });
    });

    // Quienes NO pertenecen al fondo: van aparte porque no se les descuenta nada.
    let nExt = 0;
    if (d.externos.length) {
        items.push({ tipo: 'head', costo: 2,
            html: encAreaHTML('APORTES DE PERSONAS QUE NO PERTENECEN AL FONDO', d.externos.length, d.totalExternos, 'ext', false),
            cont: encAreaHTML('APORTES DE PERSONAS QUE NO PERTENECEN AL FONDO', d.externos.length, d.totalExternos, 'ext', true) });
        items.push({ tipo: 'cab', costo: 1, html: cabecera('ext', COLS_EXT) });
        d.externos.forEach(f => {
            nExt++;
            items.push({ tipo: 'fila', costo: 1, html:
                '<div class="fila ext">'
                + '<span class="c">' + nExt + '</span>'
                + '<span class="nom">' + esc(f.nombre) + '</span>'
                + '<span class="c">' + esc(f.area) + '</span>'
                + '<span class="c">' + _donFechaVis(f.fecha) + '</span>'
                + '<span class="pts">' + money(f.monto) + '</span>'
                + '</div>' });
        });
        items.push({ tipo: 'sub', costo: 1, html:
            '<div class="fila sub ext"><span class="lbl">SUBTOTAL EXTERNOS — '
            + d.externos.length + ' aporte' + (d.externos.length !== 1 ? 's' : '') + ', sin descuento</span>'
            + '<span class="pts">' + money(d.totalExternos) + '</span></div>'
            + '<div class="aviso-ext">A estas personas <b>no se les descontó nada</b>: no pertenecen al fondo y entregaron el dinero directamente.</div>' });
    }

    // Reparto en hojas. Al abrir una hoja nueva en medio de un área, se repite
    // su encabezado y la fila de columnas para no perder el contexto.
    const hojas = [];
    let buf = [], usado = COSTO_ENCABEZADO, ctxHead = '', ctxCab = '';
    const cerrarHoja = () => {
        hojas.push(buf.join(''));
        buf = []; usado = 0;
        if (ctxHead) { buf.push(ctxHead); usado += 2; }
        if (ctxCab)  { buf.push(ctxCab);  usado += 1; }
    };
    items.forEach(it => {
        if (usado + it.costo > LINEAS_POR_HOJA) cerrarHoja();
        buf.push(it.html);
        usado += it.costo;
        if (it.tipo === 'head') { ctxHead = it.cont; ctxCab = ''; }
        else if (it.tipo === 'cab') { ctxCab = it.html; }
        else if (it.tipo === 'sub') { ctxHead = ''; ctxCab = ''; }
    });
    // El cierre (resumen, nota, firmas y pie) no se parte: si no cabe, hoja nueva.
    if (usado + COSTO_CIERRE > LINEAS_POR_HOJA) cerrarHoja();
    const _hojasPrevias = hojas.slice();
    const secciones = _hojasPrevias.map(h => h + '<div class="salto"></div>').join('') + buf.join('');
    const bloqueExternos = '';   // ya viene dentro del reparto de hojas

    const resumen = '<table class="resumen"><thead><tr><th>ORIGEN DEL APORTE</th><th>APORTES</th><th>TOTAL</th></tr></thead><tbody>'
        + d.areas.map(g => '<tr><td>' + esc(g.nombre) + '</td><td class="c">' + g.filas.length + '</td>'
            + '<td class="c" style="font-weight:800;">' + money(g.total) + '</td></tr>').join('')
        + '<tr class="sub-socios"><td>SUBTOTAL SOCIOS — con descuento</td><td class="c">' + d.nSocios + '</td>'
        +   '<td class="c" style="font-weight:800;">' + money(d.totalSocios) + '</td></tr>'
        + (d.externos.length
            ? '<tr class="sub-ext"><td>PERSONAS AJENAS AL FONDO — sin descuento</td><td class="c">' + d.externos.length + '</td>'
              + '<td class="c" style="font-weight:800;">' + money(d.totalExternos) + '</td></tr>'
            : '')
        + '</tbody><tfoot><tr><td>TOTAL JUNTADO</td><td class="c">' + d.aportes.length + '</td>'
        + '<td class="c">' + money(d.total) + '</td></tr></tfoot></table>';

    const fileName = 'Colecta - ' + motivo.replace(/[\\/:*?"<>|]/g, ' ').substring(0, 60).trim() + ' - ' + fechaVis.replace(/\//g, '-');

    const html =
        '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>' + esc(fileName) + '</title><style>'
        + '* { margin:0; padding:0; box-sizing:border-box; }'
        + 'body { font-family:Arial,Helvetica,sans-serif; font-size:9px; color:#000; padding:10px;'
        +   ' -webkit-print-color-adjust:exact; print-color-adjust:exact; }'
        + '* { -webkit-print-color-adjust:exact; print-color-adjust:exact; }'
        + 'h1 { font-size:14px; text-align:center; font-weight:900; letter-spacing:1px; }'
        + '.sub0 { text-align:center; font-size:8.5px; margin:2px 0 4px; font-weight:600; color:#334155; }'
        + '.motivo { text-align:center; font-size:11px; font-weight:900; color:#9d174d; border:1.5px solid #f9a8d4; background:#fdf2f8; border-radius:4px; padding:6px; margin:6px 0 8px; }'
        + '.kpis { display:flex; gap:6px; margin-bottom:10px; }'
        + '.kpi { flex:1; border:1px solid #cbd5e1; border-radius:4px; padding:5px 6px; text-align:center; }'
        + '.kpi b { display:block; font-size:13px; color:#0f172a; }'
        + '.kpi span { font-size:7px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; font-weight:700; }'
        // Las áreas NO se marcan como "no partir": con muchos aportantes la tabla
        // supera el alto de la hoja y el navegador la recorta en vez de pasarla a
        // la página siguiente. Se deja que se parta y se cuida dónde: el
        // encabezado no se separa de sus filas, y ninguna fila se corta al medio.
        + '.area { margin-bottom:10px; }'
        + '.areahead { break-after:avoid; page-break-after:avoid; }'
        + '.tbl thead { display:table-header-group; }'   /* la cabecera se repite en cada hoja */
        + '.tbl tfoot { display:table-row-group; }'
        + '.tbl tr, .resumen tr { break-inside:avoid; page-break-inside:avoid; }'
        + '.nota, .firmas, .footer, .kpis { break-inside:avoid; page-break-inside:avoid; }'
        + '.areahead { background:#9d174d; color:#fff; padding:4px 8px; font-size:9.5px; font-weight:900; display:flex; justify-content:space-between; border-radius:3px 3px 0 0; }'
        + '.areahead.ext { background:#b45309; }'
        + '.aviso-ext { background:#fffbeb; border:1px solid #fcd34d; border-top:none; padding:4px 8px; font-size:7.5px; color:#92400e; }'
        + '.resumen .sub-socios td { background:#fdf2f8; font-weight:800; }'
        + '.resumen .sub-ext td { background:#fffbeb; color:#92400e; font-weight:800; }'
        // Filas como bloques en grilla. Cada .fila es un bloque independiente:
        // el navegador las reparte de a una entre las hojas y no descarta ninguna.
        + '.salto { page-break-after:always; break-after:page; height:0; overflow:hidden; }'
        + '.fila { display:grid; border:1px solid #cbd5e1; border-top:none;'
        +   ' break-inside:avoid; page-break-inside:avoid; }'
        + '.fila.soc { grid-template-columns: 6% 32% 16% 12% 19% 15%; }'
        + '.fila.ext { grid-template-columns: 6% 38% 21% 13% 22%; }'
        + '.fila > span { padding:3px 4px; font-size:8px; border-right:1px solid #cbd5e1;'
        +   ' overflow-wrap:anywhere; word-break:break-word; min-width:0; }'
        + '.fila > span:last-child { border-right:none; }'
        + '.fila.cab { background:#e2e8f0; border-top:1px solid #94a3b8; }'
        + '.fila.cab > span { font-size:7px; font-weight:700; text-transform:uppercase;'
        +   ' letter-spacing:.04em; text-align:center; }'
        + '.fila.cab > span:nth-child(2) { text-align:left; }'
        + '.fila.sub { background:#fdf2f8; }'
        + '.fila.sub.ext { background:#fffbeb; }'
        + '.fila.sub > span { font-weight:800; font-size:7.5px; }'
        + '.fila.sub .lbl { grid-column:1 / -2; }'
        + '.fila .c { text-align:center; }'
        + '.fila .nom { font-weight:700; }'
        + '.fila .pts { font-weight:900; text-align:center; }'
        + '.tbl { width:100%; border-collapse:collapse; table-layout:fixed; }'
        + '.tbl th { background:#e2e8f0; border:1px solid #94a3b8; padding:3px 4px; font-size:7px; text-transform:uppercase; letter-spacing:.04em; }'
        + '.tbl td { border:1px solid #cbd5e1; padding:3px 4px; font-size:8px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }'
        + '.tbl .c { text-align:center; } .tbl .nom { font-weight:700; } .tbl .pts { font-weight:900; }'
        + '.tbl tfoot .sub td { background:#fdf2f8; font-weight:800; font-size:7.5px; }'
        + '.resumen { width:100%; border-collapse:collapse; margin-top:6px; }'
        + '.resumen th { background:#0f172a; color:#fff; border:1px solid #0f172a; padding:4px; font-size:7.5px; text-transform:uppercase; }'
        + '.resumen td { border:1px solid #94a3b8; padding:4px; font-size:8.5px; }'
        + '.resumen tfoot td { background:#9d174d; color:#fff; font-weight:900; }'
        + '.nota { margin-top:8px; border:1px dashed #cbd5e1; border-radius:4px; padding:6px 8px; font-size:8px; color:#334155; line-height:1.45; }'
        + '.firmas { display:flex; gap:30px; margin-top:24px; }'
        + '.firma { flex:1; text-align:center; font-size:8px; color:#334155; }'
        + '.firma .linea { border-top:1px solid #000; margin-bottom:3px; height:1px; }'
        + '.footer { text-align:center; font-size:7.5px; color:#94a3b8; margin-top:10px; border-top:1px dashed #cbd5e1; padding-top:4px; }'
        // size:auto en vez de forzar oficio: si la impresora tiene carta o A4, un
        // tamaño fijo hace que el navegador escale o recorte, y lo que se pierde
        // es justamente el final de la hoja (nota, firmas y pie).
        + '@media print {'
        +   '@page { margin:10mm; size:auto; }'
        +   'html, body { height:auto !important; overflow:visible !important; }'
        +   'body { padding:0 !important; }'
        +   '.page { max-width:none !important; padding:0 !important; box-shadow:none !important; overflow:visible !important; }'
        +   '.firmas { margin-top:18px; }'
            /* En pantalla los nombres largos se recortan con "…" (overflow:hidden),
               pero al IMPRIMIR esa combinación con table-layout:fixed hace que el
               navegador DESCARTE filas enteras al partir la tabla entre páginas —
               por eso la numeración saltaba, por ejemplo del 40 al 42.
               En papel se prefiere el nombre completo en dos líneas antes que
               perder una fila, así que se deja fluir el texto. */
        +   '.resumen { table-layout:auto !important; }'
        +   '.resumen td, .resumen th { overflow:visible !important; white-space:normal !important;'
        +     ' text-overflow:clip !important; word-break:break-word; }'
        +   '.resumen { break-inside:avoid; page-break-inside:avoid; }'
        + '}'
        + '@media screen { body { background:#ddd; } .page { background:#fff; max-width:860px; margin:0 auto; padding:14px; box-shadow:0 2px 12px rgba(0,0,0,.2); } }'
        + '<\/style></head><body><div class="page">'
        + '<h1>COMPROBANTE DE COLECTA SOLIDARIA</h1>'
        + '<div class="sub0">FONDO DE SOLIDARIDAD &mdash; CASINO DE PUERTO VARAS &nbsp;|&nbsp; LEY 17312 DEL 29/07/70</div>'
        + '<div class="motivo">' + esc(d.motivo) + '</div>'
        + '<div class="kpis">'
        +   '<div class="kpi"><b>' + d.aportes.length + '</b><span>Aportes</span></div>'
        +   '<div class="kpi"><b>' + money(d.totalSocios) + '</b><span>Socios · con descuento</span></div>'
        +   '<div class="kpi"><b>' + money(d.totalExternos) + '</b><span>Ajenos · sin descuento</span></div>'
        +   '<div class="kpi"><b>' + money(d.total) + '</b><span>Total juntado</span></div>'
        +   '<div class="kpi"><b>' + esc(rango) + '</b><span>Período de los aportes</span></div>'
        + '</div>'
        + secciones
        + bloqueExternos
        + '<div class="areahead" style="border-radius:3px 3px 0 0;">RESUMEN DE LA COLECTA</div>'
        + resumen
        + '<div class="nota"><b>Respaldo del descuento:</b> a cada <b>socio</b> de este comprobante se le descontó el monto '
        +   'indicado de su <b>balance a recibir</b> del período, y el descuento le aparece en su aplicación con el motivo '
        +   'de la colecta.'
        +   (d.externos.length
                ? ' Las <b>' + d.externos.length + ' persona(s) ajenas al fondo</b> del bloque naranjo aportaron '
                  + money(d.totalExternos) + ' <b>sin descuento alguno</b>: no tienen saldo en el fondo y entregaron el '
                  + 'dinero directamente. Se listan solo para dejar constancia de lo recaudado.'
                : '')
        +   ' El total juntado <b>no se abona</b> al balance del socio beneficiado: se le entrega aparte.'
        +   '<br><b>Este comprobante lista ' + (n + nExt) + ' de ' + d.aportes.length + ' aportes</b>'
        +   ((n + nExt) === d.aportes.length ? '.' : ' — <b style="color:#b91c1c;">faltan aportes, avisar a la administración.</b>')
        +   '</div>'
        + '<div class="firmas">'
        +   '<div class="firma"><div class="linea"></div>Administración del Fondo</div>'
        +   '<div class="firma"><div class="linea"></div>Recibí conforme</div>'
        + '</div>'
        + '<div class="footer">Emitido el ' + fechaVis + ' a las ' + horaVis + ' &middot; Sistema Integral Fondo Solidario</div>'
        + '</div></body></html>';

    return { html, fileName, datos: d };
}

// Imprimir / guardar como PDF
function don_imprimirColecta(motivo) {
    const r = _donComprobanteHTML(motivo);
    if (!r) { showToast('Esta colecta no tiene aportes', 'error'); return; }
    printHTML(r.html, r.fileName);
}

// CSV plano por si se quiere abrir en Excel
function _donCSV(motivo) {
    const d = _donDatosColecta(motivo);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lineas = [['Colecta', 'Origen', 'Area', 'Nombre', 'RUT', 'Fecha', 'Registrado por', 'Aporte'].map(q).join(';')];
    d.areas.forEach(g => g.filas.forEach(f => {
        lineas.push([d.motivo, 'Socio (con descuento)', g.nombre, f.nombre, f.rut, _donFechaVis(f.fecha), f.autor, f.monto].map(q).join(';'));
    }));
    d.externos.forEach(f => {
        lineas.push([d.motivo, 'Ajeno al fondo (sin descuento)', f.area, f.nombre, '', _donFechaVis(f.fecha), f.autor, f.monto].map(q).join(';'));
    });
    lineas.push(['', '', '', '', '', '', 'SUBTOTAL SOCIOS', d.totalSocios].map(q).join(';'));
    if (d.externos.length) lineas.push(['', '', '', '', '', '', 'SUBTOTAL EXTERNOS', d.totalExternos].map(q).join(';'));
    lineas.push(['', '', '', '', '', '', 'TOTAL JUNTADO', d.total].map(q).join(';'));
    return '﻿' + lineas.join('\r\n');   // BOM para que Excel respete los acentos
}

// Guardar la copia como archivo en Documentación (bucket 'documentos').
// Sube el comprobante HTML y el CSV; ambos quedan descargables desde ahí.
async function don_guardarCopia(motivo) {
    const r = _donComprobanteHTML(motivo);
    if (!r) { showToast('Esta colecta no tiene aportes', 'error'); return; }
    if (!confirm(`¿Guardar la copia de "${motivo}"?\n\nQuedará en Documentación → Generales como comprobante (HTML) y planilla (CSV), aunque después se reinicien las ausencias.`)) return;

    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : {};
    const quien = sesion.ini ? (sesion.ini + (sesion.area ? ' (' + sesion.area + ')' : '')) : 'Administración';
    const stamp = Date.now();
    const safe = r.fileName.replace(/[^a-zA-Z0-9._ -]/g, '_');

    toggleLoader(true, 'Guardando copia...');
    try {
        const archivos = [
            { nombre: safe + '.html', cuerpo: r.html, mime: 'text/html;charset=utf-8' },
            { nombre: safe + '.csv',  cuerpo: _donCSV(motivo), mime: 'text/csv;charset=utf-8' }
        ];
        for (const f of archivos) {
            const blob = new Blob([f.cuerpo], { type: f.mime });
            const path = 'donaciones/' + stamp + '_' + f.nombre.replace(/[^a-zA-Z0-9._-]/g, '_');
            const up = await dbSoc.storage.from('documentos').upload(path, blob, { contentType: f.mime, upsert: false });
            if (up.error) throw up.error;
            await dbSoc.from('documentos').insert({
                id: crypto.randomUUID(), socio_id: null, socio_nombre: null, categoria: 'general',
                nombre_archivo: f.nombre, storage_path: path, mime: f.mime, tamano: blob.size, subido_por: quien
            });
        }
        if (typeof sbAuditLog === 'function') sbAuditLog('Respaldar Colecta', {
            detalle: 'Copia guardada: ' + motivo + ' — ' + r.datos.aportes.length + ' aportes, ' + _donMoneda(r.datos.total),
            datos: { motivo, aportes: r.datos.aportes.length, total: r.datos.total }
        });
        showToast('Copia guardada en Documentación ✅', 'success');
    } catch(e) {
        showToast('No se pudo guardar la copia: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}

// ¿Hay aportes registrados sin copia guardada? Lo usa el aviso antes de
// reiniciar ausencias, que borra la tabla `extras` y con ella los aportes.
async function don_colectasSinCopia() {
    try {
        if (!_donAportes.length) await don_cargarAportes();
        if (!_donAportes.length) return [];
        const motivos = [...new Set(_donAportes.map(a => don_motivoDe(a.detalle)))];
        const { data } = await dbSoc.from('documentos').select('nombre_archivo').like('storage_path', 'donaciones/%');
        const guardados = (data || []).map(d => String(d.nombre_archivo || ''));
        return motivos.filter(m => {
            const clave = 'Colecta - ' + m.replace(/[\\/:*?"<>|]/g, ' ').substring(0, 60).trim();
            return !guardados.some(g => g.indexOf(clave) === 0);
        });
    } catch(e) { return []; }
}

// ══════════════════════════════════════════════════════════════════════
// EGRESO DE LA COLECTA — sacar el dinero de la caja
//
// Lo que aportan los socios no sale de su bolsillo: se les descuenta del
// balance, así que esa plata ya está FÍSICAMENTE en la caja. Cuando se le
// entrega al beneficiado, ese efectivo sale — y si no se registra, el arqueo
// deja de cuadrar. Esta pantalla hace ese retiro contra el conteo de caja.
//
// Lo que aportaron las personas ajenas al fondo NO pasó por la caja (lo
// entregaron directo), así que el monto viene precargado con el subtotal de
// socios, que es lo que de verdad hay que sacar del conteo.
// ══════════════════════════════════════════════════════════════════════
const DON_TIPO_ENTREGA = 'DONACION_ENTREGA';
const DON_MARCA_ENT = ' [entrega]';

// Entregas ya registradas de una colecta (para no pagar dos veces)
function don_entregasDe(motivo) {
    return (_donAportes || []).filter(a => don_esEntrega(a.tipo) && don_motivoDe(a.detalle) === motivo)
        .map(a => ({ monto: Number(a.monto) || 0, fecha: String(a.fecha || '').substring(0, 10), autor: a.autor || '' }));
}

function don_abrirEgreso(motivoPre) {
    const sel = document.getElementById('donEgrColecta');
    if (!sel) return;
    const motivos = [...new Set((_donAportes || []).filter(a => don_esAporte(a.tipo))
        .map(a => don_motivoDe(a.detalle)))].sort((x, y) => x.localeCompare(y, 'es'));
    if (!motivos.length) { showToast('No hay colectas registradas todavía', 'error'); return; }
    sel.innerHTML = motivos.map(m => `<option value="${_donEsc(m)}">${_donEsc(m.length > 80 ? m.slice(0, 80) + '…' : m)}</option>`).join('');
    if (motivoPre && motivos.indexOf(motivoPre) >= 0) sel.value = motivoPre;
    const f = document.getElementById('donEgrFecha');
    if (f) f.value = new Date().toISOString().split('T')[0];
    don_egrRenderBilletes();
    don_egrColectaCambio();
    document.getElementById('modalDonEgreso').style.display = 'block';
}

function don_cerrarEgreso() {
    const m = document.getElementById('modalDonEgreso');
    if (m) m.style.display = 'none';
}

// Al elegir la colecta se muestran sus totales y se precarga el monto
function don_egrColectaCambio() {
    const motivo = document.getElementById('donEgrColecta')?.value || '';
    const d = _donDatosColecta(motivo);
    const entregas = don_entregasDe(motivo);
    const yaEntregado = entregas.reduce((t, e) => t + e.monto, 0);

    const info = document.getElementById('donEgrInfo');
    if (info) {
        info.innerHTML =
            '<div style="display:flex;justify-content:space-between;gap:10px;"><span>Total juntado</span><b>' + _donMoneda(d.total) + '</b></div>'
            + '<div style="display:flex;justify-content:space-between;gap:10px;color:#15803d;"><span>De socios <small>(está en la caja)</small></span><b>' + _donMoneda(d.totalSocios) + '</b></div>'
            + (d.totalExternos
                ? '<div style="display:flex;justify-content:space-between;gap:10px;color:#b45309;"><span>De personas ajenas <small>(no pasó por caja)</small></span><b>' + _donMoneda(d.totalExternos) + '</b></div>'
                : '')
            + (yaEntregado
                ? '<div style="display:flex;justify-content:space-between;gap:10px;color:#b91c1c;margin-top:5px;border-top:1px dashed #fca5a5;padding-top:5px;"><span>⚠ Ya se retiró de la caja</span><b>' + _donMoneda(yaEntregado) + '</b></div>'
                : '');
    }
    const inp = document.getElementById('donEgrMonto');
    if (inp) {
        const sugerido = Math.max(0, d.totalSocios - yaEntregado);
        inp.value = sugerido ? new Intl.NumberFormat('es-CL').format(sugerido) : '';
    }
    // Limpiar el desglose al cambiar de colecta
    AQ_DENOMINACIONES.forEach(den => {
        const c = document.getElementById('donEgrBil-' + den);
        if (c) c.value = '';
    });
    don_egrTotalBilletes();
}

function don_egrRenderBilletes() {
    const cont = document.getElementById('donEgrBilletes');
    if (!cont) return;
    const fmt = v => '$' + Number(v).toLocaleString('es-CL');
    cont.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;">'
        + AQ_DENOMINACIONES.map(den =>
            '<div style="display:flex;align-items:center;gap:6px;">'
            + '<span style="flex:1;font-size:0.78em;font-weight:700;color:#475569;">' + fmt(den) + '</span>'
            + '<input type="text" inputmode="numeric" id="donEgrBil-' + den + '" placeholder="0" '
            +   'oninput="don_egrTotalBilletes()" '
            +   'style="width:58px;padding:6px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:0.85em;'
            +   'font-weight:700;text-align:center;color:#0f172a;background:white;box-sizing:border-box;">'
            + '</div>').join('')
        + '</div>';
}

function don_egrLeerBilletes() {
    const bil = {};
    AQ_DENOMINACIONES.forEach(den => {
        const el = document.getElementById('donEgrBil-' + den);
        const n = Math.max(0, parseInt(String(el && el.value || '').replace(/\D/g, '')) || 0);
        if (n > 0) bil[den] = n;
    });
    return bil;
}

function don_egrTotalBilletes() {
    const bil = don_egrLeerBilletes();
    const total = Object.keys(bil).reduce((t, d) => t + Number(d) * bil[d], 0);
    const monto = parseInt(String(document.getElementById('donEgrMonto')?.value || '').replace(/\D/g, '')) || 0;
    const el = document.getElementById('donEgrBilTotal');
    if (!el) return total;
    if (!total) {
        el.innerHTML = '<span style="color:#94a3b8;font-weight:600;">Total del desglose: $0</span>';
    } else if (monto && total !== monto) {
        const dif = Math.abs(monto - total);
        el.innerHTML = 'Total del desglose: <b style="color:#b45309;">' + _donMoneda(total) + '</b>'
            + '<span style="color:#b45309;font-weight:700;"> · ' + (total > monto ? 'sobran ' : 'faltan ') + _donMoneda(dif) + '</span>';
    } else {
        el.innerHTML = 'Total del desglose: <b style="color:#166534;">' + _donMoneda(total) + '</b>'
            + (monto ? '<span style="color:#166534;font-weight:700;"> · coincide ✓</span>' : '');
    }
    return total;
}

function don_egrFmtMonto(input) {
    const n = parseInt(String(input.value || '').replace(/\D/g, '')) || 0;
    input.value = n ? new Intl.NumberFormat('es-CL').format(n) : '';
    don_egrTotalBilletes();
}

async function don_registrarEgreso() {
    const motivo = document.getElementById('donEgrColecta')?.value || '';
    const fecha = document.getElementById('donEgrFecha')?.value || new Date().toISOString().split('T')[0];
    const monto = parseInt(String(document.getElementById('donEgrMonto')?.value || '').replace(/\D/g, '')) || 0;
    const billetes = don_egrLeerBilletes();
    const totalBil = Object.keys(billetes).reduce((t, d) => t + Number(d) * billetes[d], 0);

    if (!motivo) { showToast('Elige la colecta', 'error'); return; }
    if (!monto) { showToast('Escribe el monto a retirar de la caja', 'error'); document.getElementById('donEgrMonto')?.focus(); return; }
    if (!totalBil) { showToast('Anota el desglose de billetes que sale de la caja', 'error'); return; }
    if (totalBil !== monto) { showToast('El desglose no cuadra con el monto', 'error'); return; }

    const entregas = don_entregasDe(motivo);
    if (entregas.length && !confirm('⚠️ Esta colecta YA tiene un retiro registrado por '
        + _donMoneda(entregas.reduce((t, e) => t + e.monto, 0))
        + '.\n\n¿Registrar otro retiro además de ese?')) return;

    if (!confirm('Se van a RETIRAR ' + _donMoneda(monto) + ' del conteo de caja.\n\n'
        + 'Colecta: ' + motivo + '\n\n'
        + 'El arqueo va a mostrar ese monto como retirado. ¿Confirmar?')) return;

    toggleLoader(true, 'Registrando egreso...');
    try {
        // 1) Descontar de la caja (mismo camino que un anticipo pagado)
        if (typeof aq_aplicarBilletesAnticipo === 'function') aq_aplicarBilletesAnticipo(billetes);

        // 2) Dejar constancia de la entrega. Va como extra con un tipo propio:
        //    no suma al total juntado ni descuenta a ningún socio.
        const res = await callApiSocios('registrarBatchExtras', {
            detalleExtras: [{
                id: DON_SOCIO_EXT,
                nombre: 'Entrega de colecta',
                fecha: fecha,
                tipo: DON_TIPO_ENTREGA,
                monto: monto,
                detalle: DON_PREFIJO + motivo + DON_MARCA_ENT
            }]
        });
        if (res && res.status === 'error') throw new Error(res.message || 'error');

        if (typeof sbAuditLog === 'function') sbAuditLog('Egreso de Donación', {
            detalle: 'Retiro de caja por colecta: ' + motivo + ' — ' + _donMoneda(monto),
            datos: { motivo, monto, billetes, fecha }
        });

        showToast('Egreso registrado y descontado de la caja ✅', 'success');
        don_cerrarEgreso();
        await don_cargarAportes();
    } catch(e) {
        showToast('No se pudo registrar: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}

// ══════════════════════════════════════════════════════════════════════
// EGRESO MANUAL — tarjeta en Anticipos y Ausencias
// El monto se escribe a mano: no lo decide la app. Solo descuenta de la
// CAJA; el balance del socio no se toca, porque los aportes ya se le
// descontaron a cada donante al registrarlos en Donaciones.
// ══════════════════════════════════════════════════════════════════════
function don_egrMInit() {
    const cont = document.getElementById('donEgrMBilletes');
    if (cont && !cont.dataset.listo) {
        const fmt = v => '$' + Number(v).toLocaleString('es-CL');
        cont.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;">'
            + AQ_DENOMINACIONES.map(den =>
                '<div style="display:flex;align-items:center;gap:6px;">'
                + '<span style="flex:1;font-size:0.78em;font-weight:700;color:#475569;">' + fmt(den) + '</span>'
                + '<input type="text" inputmode="numeric" id="donEgrMBil-' + den + '" placeholder="0" '
                +   'oninput="don_egrMTotal()" '
                +   'style="width:58px;padding:6px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:0.85em;'
                +   'font-weight:700;text-align:center;color:#0f172a;background:white;box-sizing:border-box;">'
                + '</div>').join('')
            + '</div>';
        cont.dataset.listo = '1';
    }
    const f = document.getElementById('donEgrMFecha');
    if (f && !f.value) f.value = new Date().toISOString().split('T')[0];
    // Si nunca se abrió la sección Donaciones, los aportes aún no están
    // cargados: se piden en segundo plano para poder sugerir las colectas y
    // detectar retiros repetidos. Las funciones de pintado salen solas si su
    // contenedor no existe.
    if (!(_donAportes || []).length && typeof don_cargarAportes === 'function') {
        don_cargarAportes().then(() => don_egrMInit()).catch(() => {});
    }
    // Sugerencias con las colectas que existen, sin obligar a elegir una.
    const dl = document.getElementById('donEgrMotivosLista');
    if (dl) {
        const motivos = [...new Set((_donAportes || []).filter(a => don_esAporte(a.tipo))
            .map(a => don_motivoDe(a.detalle)))].sort((x, y) => x.localeCompare(y, 'es'));
        dl.innerHTML = motivos.map(m => '<option value="' + _donEsc(m) + '"></option>').join('');
    }
    don_egrMTotal();
}

function don_egrMFmt(input) {
    const n = parseInt(String(input.value || '').replace(/\D/g, '')) || 0;
    input.value = n ? new Intl.NumberFormat('es-CL').format(n) : '';
    don_egrMTotal();
}

function don_egrMLeer() {
    const bil = {};
    AQ_DENOMINACIONES.forEach(den => {
        const el = document.getElementById('donEgrMBil-' + den);
        const n = Math.max(0, parseInt(String((el && el.value) || '').replace(/\D/g, '')) || 0);
        if (n > 0) bil[den] = n;
    });
    return bil;
}

function don_egrMTotal() {
    const bil = don_egrMLeer();
    const total = Object.keys(bil).reduce((t, d) => t + Number(d) * bil[d], 0);
    const monto = parseInt(String(document.getElementById('donEgrMMonto')?.value || '').replace(/\D/g, '')) || 0;
    const el = document.getElementById('donEgrMBilTotal');
    if (!el) return total;
    if (!total) {
        el.innerHTML = '<span style="color:#94a3b8;font-weight:600;">Total del desglose: $0</span>';
    } else if (monto && total !== monto) {
        const dif = Math.abs(monto - total);
        el.innerHTML = 'Total del desglose: <b style="color:#b45309;">' + _donMoneda(total) + '</b>'
            + '<span style="color:#b45309;font-weight:700;"> · ' + (total > monto ? 'sobran ' : 'faltan ') + _donMoneda(dif) + '</span>';
    } else {
        el.innerHTML = 'Total del desglose: <b style="color:#166534;">' + _donMoneda(total) + '</b>'
            + (monto ? '<span style="color:#166534;font-weight:700;"> · coincide ✓</span>' : '');
    }
    return total;
}

async function don_egresoManual() {
    const monto = parseInt(String(document.getElementById('donEgrMMonto')?.value || '').replace(/\D/g, '')) || 0;
    const motivo = don_normalizarMotivo(document.getElementById('donEgrMMotivo')?.value);
    const fecha = document.getElementById('donEgrMFecha')?.value || new Date().toISOString().split('T')[0];
    const billetes = don_egrMLeer();
    const totalBil = Object.keys(billetes).reduce((t, d) => t + Number(d) * billetes[d], 0);

    if (!monto)  { showToast('Escribe el monto a retirar', 'error'); document.getElementById('donEgrMMonto')?.focus(); return; }
    if (!motivo) { showToast('Escribe el motivo de la colecta', 'error'); document.getElementById('donEgrMMotivo')?.focus(); return; }
    if (!totalBil) { showToast('Anota el desglose de billetes que sale de la caja', 'error'); return; }
    if (totalBil !== monto) { showToast('El desglose no cuadra con el monto', 'error'); return; }

    // Si el motivo coincide con una colecta que ya tuvo retiro, se avisa.
    const previas = don_entregasDe(motivo);
    if (previas.length && !confirm('⚠️ "' + motivo + '" ya tiene un retiro registrado por '
        + _donMoneda(previas.reduce((t, e) => t + e.monto, 0)) + '.\n\n¿Registrar otro además de ese?')) return;

    if (!confirm('Se van a RETIRAR ' + _donMoneda(monto) + ' del conteo de caja.\n\n'
        + 'Motivo: ' + motivo + '\n\n'
        + 'No se descuenta del balance de ningún socio: los aportes ya se descontaron en Donaciones.\n\n'
        + '¿Confirmar?')) return;

    toggleLoader(true, 'Registrando egreso...');
    try {
        if (typeof aq_aplicarBilletesAnticipo === 'function') aq_aplicarBilletesAnticipo(billetes);

        const res = await callApiSocios('registrarBatchExtras', {
            detalleExtras: [{
                id: DON_SOCIO_EXT, nombre: 'Entrega de colecta', fecha: fecha,
                tipo: DON_TIPO_ENTREGA, monto: monto,
                detalle: DON_PREFIJO + motivo + DON_MARCA_ENT
            }]
        });
        if (res && res.status === 'error') throw new Error(res.message || 'error');

        if (typeof sbAuditLog === 'function') sbAuditLog('Egreso de Donación', {
            detalle: 'Retiro de caja: ' + motivo + ' — ' + _donMoneda(monto),
            datos: { motivo, monto, billetes, fecha }
        });

        showToast('Egreso registrado y descontado de la caja ✅', 'success');
        document.getElementById('donEgrMMonto').value = '';
        AQ_DENOMINACIONES.forEach(den => { const c = document.getElementById('donEgrMBil-' + den); if (c) c.value = ''; });
        don_egrMTotal();
        don_cargarAportes();
    } catch(e) {
        showToast('No se pudo registrar: ' + (e.message || e), 'error');
    } finally { toggleLoader(false); }
}
