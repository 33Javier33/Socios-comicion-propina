// ============================================================
// CERTIFICADOS — generación y archivo de certificados de pago
// ============================================================

let _certRegistros = [];
let _certPeriodos = [];
let _certSocioSel = null;
let _certPeriodoSel = null;
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
    cert_renderPeriodos();
    cert_renderHistorial();
}

async function cert_recargar() {
    _certInicializado = false;
    _certSocioSel = null;
    _certPeriodoSel = null;
    const input = document.getElementById('cert-buscar-socio');
    if (input) input.value = '';
    const sel = document.getElementById('cert-periodo-select');
    if (sel) sel.value = '';
    cert_actualizarCalculo();
    await cert_init();
}

// ──────────────────────────────────────────────────────────
// CARGA DE DATOS
// ──────────────────────────────────────────────────────────

async function cert_cargarPeriodos() {
    try {
        const { data, error } = await dbSoc.from('periodos_archivados')
            .select('id, nombre, datos, created_at')
            .order('created_at', { ascending: false });
        if (error) throw error;
        _certPeriodos = (data || []).map(row => ({
            id: row.id,
            nombre: row.nombre || row.datos?.rango || '',
            totalPtos: row.datos?.totalPtos || '—',
            valorPunto: _cert_parseMonto(row.datos?.totalPtos || '0'),
            fechaArchivo: row.datos?.fechaArchivo || row.created_at
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

    if (matches.length === 0) {
        results.innerHTML = '<div style="padding:10px;color:#94a3b8;font-size:0.85em;text-align:center;">Sin resultados</div>';
        results.style.display = 'block';
        return;
    }

    results.style.display = 'block';
    results.innerHTML = matches.map(s =>
        `<div onclick="cert_seleccionarSocio('${_cert_esc(s.id)}')"
              style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:0.88em;"
              onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <div style="font-weight:700;color:#0f172a;">${_cert_esc(s.nombre)} ${_cert_esc(s.apellido)}</div>
            <div style="font-size:0.75em;color:#64748b;">${s.puntos} pts · ${s.area || ''} · ${s.contrato || ''}</div>
        </div>`
    ).join('');
}

function cert_seleccionarSocio(id) {
    _certSocioSel = (cacheSocios || []).find(s => s.id === id) || null;
    const input = document.getElementById('cert-buscar-socio');
    if (input && _certSocioSel) input.value = `${_certSocioSel.nombre} ${_certSocioSel.apellido}`;
    const results = document.getElementById('cert-socio-results');
    if (results) { results.innerHTML = ''; results.style.display = 'none'; }
    cert_actualizarCalculo();
}

// ──────────────────────────────────────────────────────────
// PERÍODOS
// ──────────────────────────────────────────────────────────

function cert_renderPeriodos() {
    const sel = document.getElementById('cert-periodo-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Selecciona un período —</option>';
    _certPeriodos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const fmt = v => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(v);
        opt.textContent = p.nombre + '  ·  ' + fmt(p.valorPunto) + '/pto';
        sel.appendChild(opt);
    });
}

function cert_seleccionarPeriodo() {
    const sel = document.getElementById('cert-periodo-select');
    const id = sel?.value || '';
    _certPeriodoSel = _certPeriodos.find(p => p.id === id) || null;
    cert_actualizarCalculo();
}

// ──────────────────────────────────────────────────────────
// CÁLCULO Y PREVIEW
// ──────────────────────────────────────────────────────────

function cert_actualizarCalculo() {
    const previewEl = document.getElementById('cert-preview');
    const btnGen = document.getElementById('cert-btn-generar');
    if (!previewEl) return;

    if (!_certSocioSel || !_certPeriodoSel) {
        previewEl.style.display = 'none';
        if (btnGen) { btnGen.disabled = true; btnGen.style.opacity = '0.4'; }
        return;
    }

    const puntos = Number(_certSocioSel.puntos || 0);
    const valorPunto = _certPeriodoSel.valorPunto;
    const total = Math.round(puntos * valorPunto);
    const fmt = v => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(v);

    previewEl.style.display = 'block';
    previewEl.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:80px;background:white;border-radius:10px;padding:10px;text-align:center;border:1px solid #bfdbfe;">
                <div style="font-size:0.65em;font-weight:800;color:#1e40af;text-transform:uppercase;margin-bottom:3px;">Puntos</div>
                <div style="font-size:1.4em;font-weight:900;color:#1e3a5f;">${puntos}</div>
            </div>
            <div style="display:flex;align-items:center;font-size:1.2em;color:#94a3b8;font-weight:700;">×</div>
            <div style="flex:1;min-width:80px;background:white;border-radius:10px;padding:10px;text-align:center;border:1px solid #fde68a;">
                <div style="font-size:0.65em;font-weight:800;color:#92400e;text-transform:uppercase;margin-bottom:3px;">Valor punto</div>
                <div style="font-size:1.05em;font-weight:900;color:#1e293b;">${fmt(valorPunto)}</div>
            </div>
            <div style="display:flex;align-items:center;font-size:1.2em;color:#94a3b8;font-weight:700;">=</div>
            <div style="flex:1;min-width:90px;background:#f0fdf4;border-radius:10px;padding:10px;text-align:center;border:2px solid #86efac;">
                <div style="font-size:0.65em;font-weight:800;color:#15803d;text-transform:uppercase;margin-bottom:3px;">Total</div>
                <div style="font-size:1.1em;font-weight:900;color:#14532d;">${fmt(total)}</div>
            </div>
        </div>
        <div style="font-size:0.78em;color:#64748b;text-align:center;padding:6px 0;">
            <strong style="color:#0f172a;">${_cert_esc(_certSocioSel.nombre)} ${_cert_esc(_certSocioSel.apellido)}</strong>
            &nbsp;·&nbsp; ${puntos} pts × ${fmt(valorPunto)} = <strong style="color:#059669;">${fmt(total)}</strong>
        </div>`;

    if (btnGen) { btnGen.disabled = false; btnGen.style.opacity = '1'; }
}

// ──────────────────────────────────────────────────────────
// GENERAR Y GUARDAR
// ──────────────────────────────────────────────────────────

async function cert_generar() {
    if (!_certSocioSel || !_certPeriodoSel) return;

    const puntos = Number(_certSocioSel.puntos || 0);
    const valorPunto = _certPeriodoSel.valorPunto;
    const total = Math.round(puntos * valorPunto);
    const fmt = v => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(v);

    const rObj = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : {};
    const responsable = rObj.ini ? `${rObj.ini}${rObj.area ? ' (' + rObj.area + ')' : ''}` : '';

    if (!confirm(
        'GENERAR CERTIFICADO DE PAGO\n\n' +
        '👤 Socio: ' + _certSocioSel.nombre + ' ' + _certSocioSel.apellido + '\n' +
        '📌 Puntos: ' + puntos + '\n' +
        '📁 Período: ' + _certPeriodoSel.nombre + '\n' +
        '💰 Valor punto: ' + fmt(valorPunto) + '\n' +
        '💵 Total a recibir: ' + fmt(total) + '\n\n' +
        '¿Confirmar y guardar?'
    )) return;

    toggleLoader(true, 'Guardando certificado...');
    try {
        const res = await callApiSocios('guardarCertificado', {
            socio_id: _certSocioSel.id,
            socio_nombre: _certSocioSel.nombre,
            socio_apellido: _certSocioSel.apellido,
            socio_puntos: puntos,
            periodo_id: _certPeriodoSel.id,
            periodo_nombre: _certPeriodoSel.nombre,
            valor_punto: valorPunto,
            total_recibir: total,
            responsable
        });
        if (res.status !== 'success') throw new Error(res.message || 'Error al guardar');
        showToast('✅ Certificado guardado', 'success');
        // Agregar al inicio de la lista local
        if (res.data) _certRegistros.unshift(res.data);
        cert_renderHistorial();
        cert_imprimir({ socio: _certSocioSel, periodo: _certPeriodoSel, total, valorPunto, responsable });
    } catch(e) {
        showToast('Error al guardar: ' + e.message, 'error');
    } finally {
        toggleLoader(false);
    }
}

// ──────────────────────────────────────────────────────────
// HISTORIAL
// ──────────────────────────────────────────────────────────

function cert_renderHistorial() {
    const el = document.getElementById('cert-historial');
    const empty = document.getElementById('cert-historial-vacio');
    if (!el) return;

    if (_certRegistros.length === 0) {
        el.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    const fmt = v => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(v);
    const fmtDate = iso => {
        try { const d = new Date(iso); return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' }); }
        catch(e) { return iso || ''; }
    };

    el.innerHTML = _certRegistros.map(r => `
        <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:0.92em;color:#0f172a;">${_cert_esc(r.socio_nombre)} ${_cert_esc(r.socio_apellido)}</div>
                <div style="font-size:0.72em;color:#374151;margin-top:2px;font-weight:600;">${_cert_esc(r.periodo_nombre)} &nbsp;·&nbsp; ${r.socio_puntos} pts × ${fmt(r.valor_punto)}</div>
                <div style="font-size:0.7em;color:#64748b;margin-top:2px;">${fmtDate(r.created_at)}${r.responsable ? ' · ' + _cert_esc(r.responsable) : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:1.1em;font-weight:900;color:#059669;">${fmt(r.total_recibir)}</div>
                <div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end;">
                    <button onclick="cert_reimprimir('${r.id}')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:7px;padding:4px 10px;font-size:0.72em;font-weight:700;cursor:pointer;">🖨 Ver</button>
                    <button onclick="cert_eliminar('${r.id}')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:7px;padding:4px 10px;font-size:0.72em;font-weight:700;cursor:pointer;">🗑</button>
                </div>
            </div>
        </div>`).join('');
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
    cert_imprimir({
        socio: { nombre: r.socio_nombre, apellido: r.socio_apellido, puntos: r.socio_puntos },
        periodo: { nombre: r.periodo_nombre, valorPunto: r.valor_punto },
        total: r.total_recibir,
        valorPunto: r.valor_punto,
        responsable: r.responsable || ''
    });
}

// ──────────────────────────────────────────────────────────
// IMPRESIÓN
// ──────────────────────────────────────────────────────────

function cert_imprimir({ socio, periodo, total, valorPunto, responsable }) {
    const fmt = v => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(v);
    const ahora = new Date();
    const _pad = n => String(n).padStart(2, '0');
    const fechaHoy = `${_pad(ahora.getDate())}/${_pad(ahora.getMonth()+1)}/${ahora.getFullYear()}`;
    const horaHoy = `${_pad(ahora.getHours())}:${_pad(ahora.getMinutes())}`;
    const puntos = Number(socio.puntos || 0);

    const dosCopias = !window.confirm('¿Cómo imprimir?\n\nOK → Una copia\nCancelar → Dos copias (original + duplicado)');

    function bloque(etiqueta) {
        return `<div style="font-size:10px;padding:8mm 6mm;font-family:'Courier New',monospace;max-width:80mm;box-sizing:border-box;${dosCopias?'margin-bottom:8px;border-bottom:2px dashed #999;':''}">
            <div style="text-align:center;margin-bottom:8px;">
                <div style="font-size:14px;font-weight:900;letter-spacing:0.5px;">FONDO DE SOLIDARIDAD</div>
                <div style="font-size:10px;color:#555;">CASINO DE PTO. VARAS · LEY 17312</div>
                <div style="font-size:9px;color:#888;margin-top:2px;font-weight:700;text-transform:uppercase;">Certificado de Pago · ${etiqueta}</div>
            </div>
            <hr style="border:none;border-top:1px dashed #999;margin:8px 0;">
            <div style="text-align:center;margin-bottom:8px;">
                <div style="font-size:13px;font-weight:900;text-transform:uppercase;">${((socio.nombre||'') + ' ' + (socio.apellido||'')).trim()}</div>
            </div>
            <table style="width:100%;font-size:9px;border-collapse:collapse;">
                <tr><td style="padding:3px 0;color:#555;width:50%;">Período</td><td style="text-align:right;font-weight:700;font-size:8px;">${(periodo.nombre||'').substring(0,40)}</td></tr>
                <tr><td style="padding:3px 0;color:#555;">Puntos del socio</td><td style="text-align:right;font-weight:900;font-size:12px;">${puntos}</td></tr>
                <tr><td style="padding:3px 0;color:#555;">Valor por punto</td><td style="text-align:right;font-weight:700;">${fmt(valorPunto)}</td></tr>
            </table>
            <hr style="border:none;border-top:1px dashed #999;margin:8px 0;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0;">
                <span style="font-size:11px;font-weight:900;text-transform:uppercase;">Total a recibir</span>
                <span style="font-size:16px;font-weight:900;color:#15803d;">${fmt(total)}</span>
            </div>
            <hr style="border:none;border-top:1px dashed #999;margin:8px 0;">
            <div style="font-size:8px;color:#777;text-align:center;margin-bottom:6px;">${fechaHoy} ${horaHoy}${responsable ? ' · ' + responsable : ''}</div>
            <div style="margin-top:24px;border-top:1px solid #000;padding-top:4px;text-align:center;font-size:8px;color:#555;">Firma del socio</div>
        </div>`;
    }

    const contenido = dosCopias
        ? bloque('ORIGINAL') + bloque('DUPLICADO')
        : bloque('ORIGINAL');

    const win = window.open('', '_blank', 'width=360,height=700');
    if (!win) { showToast('Activa ventanas emergentes para imprimir', 'warning'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificado</title>
        <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:white;}@media print{@page{size:80mm auto;margin:0;}}</style>
        </head><body>${contenido}
        <script>window.onload=function(){window.print();}<\/script></body></html>`);
    win.document.close();
}

// ──────────────────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────────────────

function _cert_esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
