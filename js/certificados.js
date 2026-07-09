// ============================================================
// CERTIFICADOS — generación multi-período y archivo
// ============================================================

let _certRegistros = [];
let _certPeriodos = [];           // períodos archivados en Supabase
let _certSocioSel = null;
let _certPeriodosGen = [];        // períodos generados para el socio seleccionado
let _certInicializado = false;

// ──────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ──────────────────────────────────────────────────────────

async function cert_init() {
    if (_certInicializado) return;
    _certInicializado = true;
    const lista = document.getElementById('cert-historial');
    if (lista) lista.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.88em;">⏳ Cargando...</div>';
    await Promise.all([cert_cargarPeriodos(), cert_cargarHistorial()]);
    cert_renderHistorial();
}

async function cert_recargar() {
    _certInicializado = false;
    _certSocioSel = null;
    _certPeriodosGen = [];
    const input = document.getElementById('cert-buscar-socio');
    if (input) input.value = '';
    const info = document.getElementById('cert-socio-info');
    if (info) { info.style.display = 'none'; info.innerHTML = ''; }
    const wrap = document.getElementById('cert-periodos-wrap');
    if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
    const btn = document.getElementById('cert-btn-generar');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
    await cert_init();
}

// ──────────────────────────────────────────────────────────
// CARGA DE DATOS
// ──────────────────────────────────────────────────────────

async function cert_cargarPeriodos() {
    try {
        const { data, error } = await dbSoc.from('periodos_archivados')
            .select('id, nombre, fecha_inicio, datos, created_at')
            .order('fecha_inicio', { ascending: true });
        if (error) throw error;
        _certPeriodos = (data || []).map(row => ({
            id: row.id,
            nombre: row.nombre || row.datos?.rango || '',
            valorPunto: _cert_parseMonto(row.datos?.totalPtos || '0'),
            fechaInicio: row.fecha_inicio || ''
        }));
    } catch(e) {
        console.warn('[CERT] Error cargando períodos:', e.message);
        _certPeriodos = [];
    }
}

async function cert_cargarHistorial() {
    try {
        const res = await callApiSocios('getCertificados', {});
        _certRegistros = Array.isArray(res.data) ? res.data : [];
    } catch(e) {
        console.warn('[CERT] Error cargando historial:', e.message);
        _certRegistros = [];
    }
}

function _cert_parseMonto(str) {
    return parseInt(String(str || '0').replace(/[^0-9]/g, '')) || 0;
}

// ──────────────────────────────────────────────────────────
// BÚSQUEDA DE SOCIO
// ──────────────────────────────────────────────────────────

function cert_buscarSocio() {
    const q = (document.getElementById('cert-buscar-socio')?.value || '').toLowerCase().trim();
    const results = document.getElementById('cert-socio-results');
    if (!results) return;
    if (!q) { results.innerHTML = ''; results.style.display = 'none'; return; }

    const matches = (cacheSocios || [])
        .filter(s => `${s.nombre} ${s.apellido}`.toLowerCase().includes(q))
        .slice(0, 8);

    if (!matches.length) {
        results.innerHTML = '<div style="padding:10px;color:#94a3b8;font-size:0.85em;text-align:center;">Sin resultados</div>';
        results.style.display = 'block';
        return;
    }
    results.style.display = 'block';
    results.innerHTML = matches.map(s =>
        `<div onclick="cert_seleccionarSocio('${_cert_esc(s.id)}')"
              style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:0.88em;display:flex;align-items:center;gap:9px;"
              onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            ${avatarHTML(s.fotoUrl, s.nombre, 32)}
            <div style="min-width:0;"><div style="font-weight:700;color:#0f172a;">${_cert_esc(s.nombre)} ${_cert_esc(s.apellido)}</div>
            <div style="font-size:0.75em;color:#64748b;">${s.puntos} pts · ${s.area || ''} · ${s.contrato || ''}</div></div>
        </div>`
    ).join('');
}

function cert_seleccionarSocio(id) {
    _certSocioSel = (cacheSocios || []).find(s => s.id === id) || null;
    const input = document.getElementById('cert-buscar-socio');
    if (input && _certSocioSel) input.value = `${_certSocioSel.nombre} ${_certSocioSel.apellido}`;
    const results = document.getElementById('cert-socio-results');
    if (results) { results.innerHTML = ''; results.style.display = 'none'; }

    const info = document.getElementById('cert-socio-info');
    if (info && _certSocioSel) {
        info.style.display = 'block';
        info.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">${avatarHTML(_certSocioSel.fotoUrl, _certSocioSel.nombre, 40)}<div><strong>${_cert_esc(_certSocioSel.nombre)} ${_cert_esc(_certSocioSel.apellido)}</strong>&nbsp;·&nbsp;${_certSocioSel.puntos} puntos&nbsp;·&nbsp;${_certSocioSel.contrato || _certSocioSel.area || ''}</div></div>`;
    }

    cert_generarListaPeriodos();
}

// ──────────────────────────────────────────────────────────
// GENERACIÓN Y RENDER DE PERÍODOS
// ──────────────────────────────────────────────────────────

function cert_generarListaPeriodos() {
    if (!_certSocioSel) return;

    const wrap = document.getElementById('cert-periodos-wrap');
    const fechaIngreso = _certSocioSel.fechaIngreso;

    if (!fechaIngreso) {
        if (wrap) { wrap.style.display = 'block'; wrap.innerHTML = '<div style="color:#dc2626;font-size:0.85em;padding:8px;">Sin fecha de ingreso registrada para este socio.</div>'; }
        return;
    }

    // Promedio de valor_punto de períodos archivados (para estimados)
    const vals = _certPeriodos.map(p => p.valorPunto).filter(v => v > 0);
    const promedio = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const puntos = Number(_certSocioSel.puntos || 0);

    // Primera fecha de inicio: el 15 del mes en o después de fechaIngreso
    let d = new Date(fechaIngreso + 'T12:00:00');
    if (isNaN(d.getTime())) {
        if (wrap) { wrap.style.display = 'block'; wrap.innerHTML = '<div style="color:#dc2626;font-size:0.85em;padding:8px;">Fecha de ingreso inválida.</div>'; }
        return;
    }
    if (d.getDate() < 15) {
        d = new Date(d.getFullYear(), d.getMonth(), 15);
    } else if (d.getDate() > 15) {
        d = new Date(d.getFullYear(), d.getMonth() + 1, 15);
    } else {
        d = new Date(d.getFullYear(), d.getMonth(), 15);
    }

    // Límite: 15 del período actualmente completado
    const hoy = new Date();
    const limiteInicio = hoy.getDate() >= 15
        ? new Date(hoy.getFullYear(), hoy.getMonth(), 15)
        : new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15);

    _certPeriodosGen = [];
    while (d <= limiteInicio) {
        const inicio = new Date(d);
        const fin = new Date(d.getFullYear(), d.getMonth() + 1, 14);
        const inicioISO = inicio.toISOString().slice(0, 10);

        const archivado = _certPeriodos.find(p => p.fechaInicio === inicioISO) || null;
        const valorPunto = archivado ? archivado.valorPunto : promedio;
        const tipo = archivado ? 'exacto' : 'estimado';

        _certPeriodosGen.push({
            inicio, fin, inicioISO,
            archivado, valorPunto, tipo,
            total: Math.round(puntos * valorPunto),
            checked: true
        });

        d = new Date(d.getFullYear(), d.getMonth() + 1, 15);
    }

    // Ordenar de la fecha más reciente a la más antigua (afecta lista, selección e impresión)
    _certPeriodosGen.reverse();

    cert_renderPeriodoLista();
}

function cert_renderPeriodoLista() {
    const wrap = document.getElementById('cert-periodos-wrap');
    if (!wrap) return;

    if (!_certPeriodosGen.length) {
        wrap.style.display = 'block';
        wrap.innerHTML = '<div style="color:#dc2626;font-size:0.85em;padding:8px;">No hay períodos activos para este socio.</div>';
        return;
    }

    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const fmtD = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

    const filas = _certPeriodosGen.map((p, i) => {
        const badge = p.tipo === 'exacto'
            ? `<span style="font-size:0.6em;background:#dcfce7;color:#15803d;border-radius:4px;padding:1px 5px;font-weight:800;white-space:nowrap;">EXACTO</span>`
            : `<span style="font-size:0.6em;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;font-weight:800;white-space:nowrap;">ESTIMADO</span>`;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 6px;border-bottom:1px solid #f1f5f9;">
            <input type="checkbox" id="cert-p-${i}" ${p.checked ? 'checked' : ''}
                onchange="_certPeriodosGen[${i}].checked=this.checked;cert_actualizarTotal()"
                style="width:16px;height:16px;cursor:pointer;flex-shrink:0;accent-color:#1e3a5f;">
            <label for="cert-p-${i}" style="flex:1;cursor:pointer;min-width:0;">
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                    <span style="font-size:0.8em;font-weight:700;color:#0f172a;">${fmtD(p.inicio)} – ${fmtD(p.fin)}</span>
                    ${badge}
                </div>
                ${p.valorPunto > 0 ? `<div style="font-size:0.7em;color:#64748b;margin-top:1px;">${fmt(p.valorPunto)}/pto</div>` : ''}
            </label>
            <span style="font-size:0.88em;font-weight:800;color:${p.tipo==='exacto'?'#059669':'#92400e'};flex-shrink:0;">${fmt(p.total)}</span>
        </div>`;
    }).join('');

    // Años disponibles (de más reciente a más antiguo)
    const años = [...new Set(_certPeriodosGen.map(p => p.inicio.getFullYear()))].sort((a, b) => b - a);
    const añoBtns = años.map(a =>
        `<button onclick="cert_seleccionarAño(${a})"
            style="font-size:0.72em;padding:3px 9px;background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;border-radius:6px;cursor:pointer;font-weight:700;">${a}</button>`
    ).join('');

    wrap.style.display = 'block';
    wrap.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px;">
            <button onclick="cert_seleccionarUltimos(6)"  style="font-size:0.72em;padding:3px 9px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:6px;cursor:pointer;font-weight:700;">Últimos 6 meses</button>
            <button onclick="cert_seleccionarUltimos(12)" style="font-size:0.72em;padding:3px 9px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:6px;cursor:pointer;font-weight:700;">Últimos 12 meses</button>
            <button onclick="cert_toggleTodos(true)"  style="font-size:0.72em;padding:3px 9px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:6px;cursor:pointer;font-weight:700;">Todos</button>
            <button onclick="cert_toggleTodos(false)" style="font-size:0.72em;padding:3px 9px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;border-radius:6px;cursor:pointer;font-weight:700;">Ninguno</button>
            ${añoBtns}
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;max-height:280px;overflow-y:auto;">${filas}</div>
        <div style="margin-top:10px;background:#f0fdf4;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.8em;font-weight:700;color:#374151;">Total seleccionado</span>
            <span id="cert-total-valor" style="font-size:1.1em;font-weight:900;color:#14532d;">$0</span>
        </div>`;

    cert_actualizarTotal();
}

function cert_toggleTodos(checked) {
    _certPeriodosGen.forEach((p, i) => {
        p.checked = checked;
        const cb = document.getElementById('cert-p-' + i);
        if (cb) cb.checked = checked;
    });
    cert_actualizarTotal();
}

function cert_seleccionarUltimos(n) {
    const total = _certPeriodosGen.length;
    _certPeriodosGen.forEach((p, i) => {
        p.checked = i >= total - n;
        const cb = document.getElementById('cert-p-' + i);
        if (cb) cb.checked = p.checked;
    });
    cert_actualizarTotal();
}

function cert_seleccionarAño(año) {
    _certPeriodosGen.forEach((p, i) => {
        p.checked = p.inicio.getFullYear() === año;
        const cb = document.getElementById('cert-p-' + i);
        if (cb) cb.checked = p.checked;
    });
    cert_actualizarTotal();
}

function cert_actualizarTotal() {
    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const sel = _certPeriodosGen.filter(p => p.checked);
    const total = sel.reduce((s, p) => s + p.total, 0);
    const totalEl = document.getElementById('cert-total-valor');
    if (totalEl) totalEl.textContent = fmt(total);
    const btn = document.getElementById('cert-btn-generar');
    if (btn) { btn.disabled = sel.length === 0; btn.style.opacity = sel.length ? '1' : '0.4'; }
}

// ──────────────────────────────────────────────────────────
// GENERAR Y GUARDAR
// ──────────────────────────────────────────────────────────

let _certPendingPrint = null; // datos pendientes hasta confirmar firma

async function cert_generar() {
    if (!_certSocioSel) return;
    const sel = _certPeriodosGen.filter(p => p.checked);
    if (!sel.length) { showToast('Selecciona al menos un período', 'warning'); return; }

    const puntos = Number(_certSocioSel.puntos || 0);
    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const fmtD = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    const totalGeneral = sel.reduce((s, p) => s + p.total, 0);
    const estimados = sel.filter(p => p.tipo === 'estimado').length;

    if (!confirm(
        'GENERAR CERTIFICADO DE PAGO\n\n' +
        '👤 ' + _certSocioSel.nombre + ' ' + _certSocioSel.apellido + '\n' +
        '📌 Puntos: ' + puntos + '\n' +
        '📅 Períodos: ' + sel.length + (estimados ? ' (' + estimados + ' estimado' + (estimados > 1 ? 's' : '') + ')' : '') + '\n' +
        '💵 Total: ' + fmt(totalGeneral) + '\n\n¿Confirmar y guardar?'
    )) return;

    const periodosData = sel.map(p => ({
        nombre: `${fmtD(p.inicio)} A ${fmtD(p.fin)}`,
        fechaInicio: p.inicioISO,
        valorPunto: p.valorPunto,
        total: p.total,
        tipo: p.tipo
    }));

    toggleLoader(true, 'Guardando certificado...');
    try {
        const res = await callApiSocios('guardarCertificado', {
            socio_id: _certSocioSel.id,
            socio_nombre: _certSocioSel.nombre,
            socio_apellido: _certSocioSel.apellido,
            socio_puntos: puntos,
            periodos: periodosData,
            total_recibir: totalGeneral,
            responsable: ''   // se completará tras confirmar firma
        });
        if (res.status !== 'success') throw new Error(res.message || 'Error al guardar');
        if (res.data) _certRegistros.unshift(res.data);
        cert_renderHistorial();
        // Guardar datos para imprimir tras confirmar nombre+PIN
        _certPendingPrint = {
            recordId: res.data?.id || null,
            socio: _certSocioSel,
            periodos: periodosData,
            total: totalGeneral
        };
        cert_abrirModalFirma();
    } catch(e) {
        showToast('Error al guardar: ' + e.message, 'error');
    } finally {
        toggleLoader(false);
    }
}

// ──────────────────────────────────────────────────────────
// MODAL FIRMA
// ──────────────────────────────────────────────────────────

function cert_abrirModalFirma() {
    const modal = document.getElementById('cert-modal-firma');
    if (!modal) return;
    modal.style.display = 'flex';
    const nombre = document.getElementById('cert-firma-nombre');
    if (nombre) { nombre.value = ''; nombre.focus(); }
    const pin = document.getElementById('cert-firma-pin');
    if (pin) pin.value = '';
    const err = document.getElementById('cert-firma-error');
    if (err) err.style.display = 'none';
}

function cert_cerrarModalFirma() {
    const modal = document.getElementById('cert-modal-firma');
    if (modal) modal.style.display = 'none';
    _certPendingPrint = null;
}

function cert_confirmarFirma() {
    const nombreEl = document.getElementById('cert-firma-nombre');
    const pinEl = document.getElementById('cert-firma-pin');
    const errEl = document.getElementById('cert-firma-error');
    const nombre = (nombreEl?.value || '').trim();
    const pin = (pinEl?.value || '').trim();

    const mostrarError = msg => {
        if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    };

    if (!nombre) { mostrarError('Ingresa tu nombre completo.'); nombreEl?.focus(); return; }
    if (!pin) { mostrarError('Ingresa tu PIN.'); pinEl?.focus(); return; }

    // Validar PIN — buscar en credencialesCache del responsable en sesión
    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : {};
    const key = sesion.ini && sesion.area ? `${sesion.ini}|${sesion.area}` : '';
    const pinSesion = key ? (credencialesCache[key] || '') : '';
    const pinGlobal = localStorage.getItem(PIN_KEY) || PIN_DEFAULT;
    const pinValido = (pinSesion && pin === pinSesion) || (!pinSesion && pin === pinGlobal);

    if (!pinValido) {
        mostrarError('PIN incorrecto. Intenta nuevamente.');
        if (pinEl) { pinEl.value = ''; pinEl.focus(); }
        return;
    }

    // Actualizar el registro en Supabase con el nombre del responsable
    if (_certPendingPrint?.recordId) {
        callApiSocios('actualizarCertificadoResponsable', {
            id: _certPendingPrint.recordId,
            responsable: nombre
        }).catch(() => {});
        // Actualizar también en cache local
        const rec = _certRegistros.find(r => r.id === _certPendingPrint.recordId);
        if (rec) rec.responsable = nombre;
        cert_renderHistorial();
    }

    const datos = _certPendingPrint;
    cert_cerrarModalFirma();
    if (datos) cert_imprimir({ ...datos, responsable: nombre });
}

// ──────────────────────────────────────────────────────────
// HISTORIAL
// ──────────────────────────────────────────────────────────

function cert_renderHistorial() {
    const el = document.getElementById('cert-historial');
    const empty = document.getElementById('cert-historial-vacio');
    if (!el) return;

    if (!_certRegistros.length) {
        el.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const fmtDate = iso => {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        } catch(e) { return iso || ''; }
    };

    el.innerHTML = _certRegistros.map(r => {
        const periodos = Array.isArray(r.periodos) ? r.periodos : (r.periodo_nombre ? [{ nombre: r.periodo_nombre, tipo: 'exacto' }] : []);
        const nP = periodos.length;
        const conEst = periodos.some(p => p.tipo === 'estimado');
        return `
        <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);margin-bottom:8px;">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:0.92em;color:#0f172a;">${_cert_esc(r.socio_nombre)} ${_cert_esc(r.socio_apellido)}</div>
                <div style="font-size:0.72em;color:#374151;margin-top:2px;font-weight:600;">${nP} período${nP!==1?'s':''}${conEst?' · con estimados':''} · ${r.socio_puntos} pts</div>
                <div style="font-size:0.7em;color:#64748b;margin-top:2px;">${fmtDate(r.created_at)}${r.responsable?' · '+_cert_esc(r.responsable):''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:1.1em;font-weight:900;color:#059669;">${fmt(r.total_recibir)}</div>
                <div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end;">
                    <button onclick="cert_reimprimir('${r.id}')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:7px;padding:4px 10px;font-size:0.72em;font-weight:700;cursor:pointer;">🖨 Ver</button>
                    <button onclick="cert_eliminar('${r.id}')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:7px;padding:4px 10px;font-size:0.72em;font-weight:700;cursor:pointer;">🗑</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function cert_eliminar(id) {
    if (!confirm('¿Eliminar este certificado del historial?')) return;
    toggleLoader(true, 'Eliminando...');
    try {
        await callApiSocios('eliminarCertificado', { id });
        _certRegistros = _certRegistros.filter(r => r.id !== id);
        cert_renderHistorial();
        showToast('Eliminado', 'success');
    } catch(e) {
        showToast('Error al eliminar', 'error');
    } finally {
        toggleLoader(false);
    }
}

function cert_reimprimir(id) {
    const r = _certRegistros.find(c => c.id === id);
    if (!r) return;
    const periodos = Array.isArray(r.periodos) && r.periodos.length
        ? r.periodos
        : (r.periodo_nombre ? [{ nombre: r.periodo_nombre, valorPunto: r.valor_punto || 0, total: r.total_recibir, tipo: 'exacto' }] : []);
    // Buscar el RUT actual del socio (por id o por nombre) para incluirlo en el certificado
    const _sc = (cacheSocios || []).find(s => s.id === r.socio_id)
        || (cacheSocios || []).find(s => ((s.nombre || '') + ' ' + (s.apellido || '')).trim().toLowerCase() === ((r.socio_nombre || '') + ' ' + (r.socio_apellido || '')).trim().toLowerCase());
    cert_imprimir({
        socio: { nombre: r.socio_nombre, apellido: r.socio_apellido, puntos: r.socio_puntos, contrato: r.socio_contrato || '', rut: (_sc && _sc.rut) || '' },
        periodos,
        total: r.total_recibir,
        responsable: r.responsable || ''
    });
}

// ──────────────────────────────────────────────────────────
// IMPRESIÓN — formato A4 como certificado oficial
// ──────────────────────────────────────────────────────────

function cert_imprimir({ socio, periodos, total, responsable }) {
    const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
    const ahora = new Date();
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const fechaLarga = `Puerto Varas, ${ahora.getDate()} de ${meses[ahora.getMonth()]} de ${ahora.getFullYear()}`;
    const nombreCompleto = ((socio.nombre || '') + ' ' + (socio.apellido || '')).trim().toUpperCase();
    const hayEstimados = periodos.some(p => p.tipo === 'estimado');

    // Asegurar orden: fecha más reciente primero (también para certificados antiguos guardados)
    if (periodos.every(p => p.fechaInicio)) {
        periodos = periodos.slice().sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
    }

    const filas = periodos.map((p, i) => {
        const est = p.tipo === 'estimado' ? '<sup style="color:#b45309;font-size:0.7em;"> *</sup>' : '';
        return `<tr>
            <td style="padding:5px 8px;font-weight:700;white-space:nowrap;">${i + 1}.)</td>
            <td style="padding:5px 8px;white-space:nowrap;">${_cert_esc(p.nombre)}${est}</td>
            <td style="padding:5px 8px;text-align:right;font-weight:700;">${fmt(p.total)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificado — ${nombreCompleto}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{height:100%;}
body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#000;padding:20mm 22mm 15mm 22mm;
     display:flex;flex-direction:column;min-height:100%;}
h1{text-align:center;font-size:22pt;font-weight:900;letter-spacing:3px;margin-bottom:4mm;}
.sub{text-align:center;font-size:10pt;color:#333;margin-bottom:9mm;font-weight:600;}
.lugar{text-align:right;font-size:9.5pt;color:#555;margin-bottom:8mm;}
.cuerpo{font-size:10.5pt;line-height:1.7;margin-bottom:6mm;text-align:justify;}
table{width:100%;border-collapse:collapse;margin-top:3mm;}
thead tr{border-bottom:2px solid #000;}
thead th{padding:4px 8px;text-align:left;font-size:9.5pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;}
thead th:last-child{text-align:right;}
tbody tr:nth-child(even){background:#f7f7f7;}
tbody td{font-size:10pt;color:#000;}
.total-row{border-top:2px solid #000;padding:6px 8px;display:flex;justify-content:space-between;margin-top:2mm;font-size:12pt;font-weight:900;}
.nota{font-size:8.5pt;color:#92400e;margin-top:4mm;font-style:italic;}
.footer{margin-top:7mm;font-size:10.5pt;line-height:1.65;text-align:justify;}
.firmas{margin-top:auto;padding-top:10mm;display:flex;justify-content:space-around;
        page-break-inside:avoid;break-inside:avoid;}
.firma-box{text-align:center;width:44%;}
.firma-espacio{height:16mm;}
.firma-linea{border-top:1.5px solid #000;padding-top:5px;font-size:9.5pt;font-weight:700;text-transform:uppercase;}
.firma-sub{font-size:9pt;color:#555;margin-top:3px;}
.cert-toolbar{position:fixed;top:0;left:0;right:0;height:52px;background:#0f172a;display:flex;
    align-items:center;justify-content:space-between;padding:0 16px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.25);}
.cert-toolbar .tb-title{color:#e2e8f0;font-size:12pt;font-weight:700;}
.cert-toolbar button{border:none;border-radius:8px;padding:8px 16px;font-size:11pt;font-weight:800;cursor:pointer;margin-left:8px;}
.tb-print{background:#2563eb;color:white;}
.tb-close{background:#334155;color:#e2e8f0;}
@media screen{body{padding-top:72px;}}
@media print{@page{size:A4;margin:0;}body{padding:18mm 20mm 12mm 20mm;}.no-print{display:none !important;}}
</style></head><body>

<div class="cert-toolbar no-print">
    <span class="tb-title">📄 Vista previa del certificado</span>
    <div>
        <button class="tb-print" onclick="window.print()">🖨 Imprimir</button>
        <button class="tb-close" onclick="window.close()">✖ Cerrar</button>
    </div>
</div>

<h1>CERTIFICADO</h1>
<div class="sub">Comisión Propina Casino de Puerto Varas</div>
<div class="lugar">${fechaLarga}</div>

<p class="cuerpo">La Comisión del Fondo de Solidaridad de los Empleados del Casino de Juegos de
Puerto Varas, certifica que el(la) Sr./Sra. <strong>${nombreCompleto}</strong>${socio.rut ? ', RUT ' + _cert_esc(socio.rut) + ',' : ''} ha percibido
por concepto de propina, en los períodos que se señalan los siguientes valores:</p>

<table>
    <thead><tr>
        <th style="width:7%;">#</th>
        <th>PERÍODO</th>
        <th style="text-align:right;width:24%;">VALOR</th>
    </tr></thead>
    <tbody>${filas}</tbody>
</table>

${hayEstimados ? '<p class="nota">(*) Los valores marcados con asterisco son estimados basados en el promedio histórico de períodos disponibles.</p>' : ''}

<div class="total-row"><span>TOTAL A RECIBIR</span><span>${fmt(total)}</span></div>

<div class="footer">
    <p>Se deja constancia que los valores indicados no se encuentran afectos a ningún tipo de descuentos
    legales ni previsionales, de acuerdo a lo indicado en la Ley 17.312.</p>
    <br>
    <p>Se extiende el presente Certificado a solicitud del interesado, PARA LOS FINES QUE ESTIME CONVENIENTE.</p>
</div>

<div class="firmas">
    <div class="firma-box">
        <div class="firma-espacio"></div>
        <div class="firma-linea">${responsable ? _cert_esc(responsable) : 'Comisión Propinas'}</div>
        <div class="firma-sub">Comisión Propinas · Casino Pto. Varas</div>
    </div>
    <div class="firma-box">
        <div class="firma-espacio"></div>
        <div class="firma-linea">${nombreCompleto}</div>
        <div class="firma-sub">${_cert_esc(socio.contrato || socio.area || '')}</div>
    </div>
</div>

</body></html>`;

    const win = window.open('', '_blank', 'width=850,height=1000');
    if (!win) { showToast('Activa ventanas emergentes para ver el certificado', 'warning'); return; }
    win.document.write(html);
    win.document.close();
}

// ──────────────────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────────────────

function _cert_esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
