// ══════════════════════════════════════════════════════════════════════
// NUEVOS INGRESOS AL FONDO
//
// Lo que mandan los supervisores de área desde index3.html (Comunicación)
// llega acá. La administración lo revisa y decide:
//
//   · Aprobar  → se crea el socio en la tabla `socios` con lo que vino, y
//                el aviso queda enlazado al socio creado.
//   · Rechazar → queda con su motivo. No se borra nunca: el rastro de qué
//                se decidió y por qué es justamente lo que sirve después.
//
// Acá también se administra QUIÉN ENTRA a Comunicación y con qué clave.
// Esa parte NO toca la base directamente: pasa por la Edge Function
// `comunicacion-auth`, que es la única que ve los hash de los PIN.
//
// La clave de administración se ESCRIBE cada vez y no se guarda en ningún
// archivo. En `js/diario-pins.js` quedó escrita en el código
// ('pinadm_…'), y como el repositorio es público, cualquiera puede leerla
// y ponerle o quitarle el PIN a quien quiera. Acá eso no se repite.
// ══════════════════════════════════════════════════════════════════════

const _NI_AUTH_URL = _SB_URL_SOC + '/functions/v1/comunicacion-auth';

let _niLista = null;          // null = no consultado todavía
let _niHayTabla = true;
let _niFiltro = 'pendiente';  // pendiente | todos | aprobado | rechazado

function _niEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function _niFecha(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-CL',
            { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(iso).substring(0, 16); }
}
function _niQuien() {
    try {
        const s = (typeof getSesionResponsableObj === 'function') ? getSesionResponsableObj() : {};
        return s.ini ? (s.ini + (s.area ? ' (' + s.area + ')' : '')) : 'Administración';
    } catch (e) { return 'Administración'; }
}

// ── Traer lo que llegó ──────────────────────────────────────
async function ni_cargar(forzar) {
    if (_niLista && !forzar) return _niLista;
    try {
        const { data, error } = await dbSoc.from('nuevos_ingresos')
            .select('*').order('creado_en', { ascending: false });
        if (error) throw error;
        _niHayTabla = true;
        _niLista = data || [];
    } catch (e) {
        _niHayTabla = false;
        _niLista = [];
    }
    return _niLista;
}

function ni_abrir() {
    const m = document.getElementById('modalNuevosIngresos');
    if (!m) return;
    m.style.display = 'block';
    ni_render(true);
}
function ni_cerrar() {
    const m = document.getElementById('modalNuevosIngresos');
    if (m) m.style.display = 'none';
}

function ni_setFiltro(v, btn) {
    _niFiltro = v;
    document.querySelectorAll('.ni-filtro').forEach(b => b.classList.toggle('activo', b === btn));
    ni_render();
}

async function ni_render(forzar) {
    const cont = document.getElementById('niLista');
    if (!cont) return;
    cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">⏳ Cargando…</div>';
    const lista = await ni_cargar(forzar);

    if (!_niHayTabla) {
        cont.innerHTML = '<div style="background:#fef3c7;border:1.5px solid #f59e0b;border-radius:10px;padding:12px 14px;">'
            + '<div style="font-weight:800;color:#92400e;font-size:0.9em;margin-bottom:4px;">Falta crear las tablas</div>'
            + '<div style="font-size:0.82em;color:#92400e;line-height:1.5;">Está <b>migracion-comunicacion.sql</b> en la raíz del repositorio: '
            + 'pégalo en Supabase → SQL Editor y vuelve a abrir esta sección.<br>'
            + 'Hasta entonces, la app de las áreas no puede mandar nada.</div></div>';
        _niPintarContador();
        return;
    }

    const vis = lista.filter(r => _niFiltro === 'todos' ? true : r.estado === _niFiltro);
    if (!vis.length) {
        cont.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.86em;">'
            + (_niFiltro === 'pendiente'
                ? 'No hay avisos por revisar. 👌'
                : 'Nada en «' + _niEsc(_niFiltro) + '».') + '</div>';
        _niPintarContador();
        return;
    }

    cont.innerHTML = vis.map(r => {
        const col = r.estado === 'aprobado' ? '#15803d' : (r.estado === 'rechazado' ? '#b91c1c' : '#b45309');
        const txt = r.estado === 'aprobado' ? 'Aprobado' : (r.estado === 'rechazado' ? 'Rechazado' : 'Pendiente');
        const dato = (etq, v) => v
            ? '<span style="font-size:0.75em;color:#64748b;">' + etq + ' <b style="color:inherit;">' + _niEsc(v) + '</b></span>'
            : '';
        return '<div class="card" style="padding:11px 13px;margin-bottom:8px;">'
            + '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;">'
            +   '<div style="flex:1;min-width:0;">'
            +     '<div style="font-weight:800;font-size:0.95em;">'
            +        _niEsc((r.nombre || '') + ' ' + (r.apellido || '')).trim() + '</div>'
            +     '<div style="font-size:0.74em;color:#64748b;margin-top:2px;">'
            +        'Lo envió <b>' + _niEsc(r.area || '—') + '</b>'
            +        (r.enviado_por ? ' · ' + _niEsc(r.enviado_por) : '')
            +        ' · ' + _niFecha(r.creado_en) + '</div>'
            +   '</div>'
            +   '<span style="background:' + col + '22;border:1px solid ' + col + ';color:' + col
            +     ';border-radius:20px;padding:1px 9px;font-size:0.7em;font-weight:800;white-space:nowrap;">' + txt + '</span>'
            + '</div>'
            + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:7px;">'
            +    dato('RUT', r.rut) + dato('Área', r.area_socio) + dato('Contrato', r.contrato)
            +    dato('Ingresa', r.fecha_ingreso) + dato('Correo', r.correo) + dato('Teléfono', r.telefono)
            + '</div>'
            + (r.observacion
                ? '<div style="font-size:0.8em;color:#475569;margin-top:7px;line-height:1.5;">'
                  + _niEsc(r.observacion) + '</div>' : '')
            + (r.estado === 'rechazado' && r.motivo
                ? '<div style="font-size:0.78em;color:#b91c1c;margin-top:6px;">Motivo: ' + _niEsc(r.motivo) + '</div>' : '')
            + (r.estado === 'aprobado'
                ? '<div style="font-size:0.78em;color:#15803d;margin-top:6px;">Creado como socio '
                  + _niEsc(r.socio_id || '—') + ' · ' + _niFecha(r.resuelto_en)
                  + (r.resuelto_por ? ' por ' + _niEsc(r.resuelto_por) : '') + '</div>' : '')
            + (r.estado === 'pendiente'
                ? '<div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap;">'
                  + '<button onclick="ni_aprobar(\'' + r.id + '\')" class="btn-card" '
                  +   'style="flex:1;background:#dcfce7;border:1px solid #86efac;color:#15803d;font-size:0.78em;padding:5px 10px;font-weight:800;">✓ Aprobar y crear socio</button>'
                  + '<button onclick="ni_rechazar(\'' + r.id + '\')" class="btn-card" '
                  +   'style="flex:1;background:#fee2e2;border:1px solid #fca5a5;color:#b91c1c;font-size:0.78em;padding:5px 10px;font-weight:800;">✕ Rechazar</button>'
                  + '</div>' : '')
            + '</div>';
    }).join('');
    _niPintarContador();
}

// Cuántos quedan por revisar, para el aviso del botón de la barra.
function _niPintarContador() {
    const n = (_niLista || []).filter(r => r.estado === 'pendiente').length;
    const b = document.getElementById('niBadge');
    if (b) { b.textContent = n; b.style.display = n ? 'inline-block' : 'none'; }
}
window.ni_refrescarContador = async function () {
    await ni_cargar(true);
    _niPintarContador();
};

// ── Aprobar: se crea el socio ───────────────────────────────
async function ni_aprobar(id) {
    const r = (_niLista || []).find(x => x.id === id);
    if (!r) return;
    const nom = ((r.nombre || '') + ' ' + (r.apellido || '')).trim();
    if (!confirm('Crear a ' + nom + ' como socio del Fondo.\n\n'
        + 'Área: ' + (r.area_socio || '—') + '\n'
        + 'Contrato: ' + (r.contrato || '—') + '\n'
        + 'Ingreso: ' + (r.fecha_ingreso || '—') + '\n\n'
        + 'Después puedes ajustar sus datos en Gestión de Socios. ¿Seguir?')) return;

    if (typeof toggleLoader === 'function') toggleLoader(true, 'Creando socio…');
    try {
        // El id del socio: el siguiente número libre, como en Gestión.
        let sid = null;
        try {
            const { data } = await dbSoc.from('socios').select('id');
            const nums = (data || []).map(x => parseInt(String(x.id).replace(/\D/g, ''), 10))
                                     .filter(x => Number.isFinite(x));
            sid = String((nums.length ? Math.max.apply(null, nums) : 0) + 1);
        } catch (e) { sid = String(Date.now()).slice(-6); }

        const { error: e1 } = await dbSoc.from('socios').insert({
            id: sid,
            nombre: r.nombre || '',
            apellido: r.apellido || '',
            area: r.area_socio || r.area || '',
            contrato: r.contrato || 'Planta',
            fecha_ingreso: r.fecha_ingreso || new Date().toISOString().slice(0, 10),
            puntos: 0,
            activo: true,
            rut: r.rut || null,
            correo: r.correo || null
        });
        if (e1) throw e1;

        const { error: e2 } = await dbSoc.from('nuevos_ingresos').update({
            estado: 'aprobado', socio_id: sid,
            resuelto_en: new Date().toISOString(), resuelto_por: _niQuien()
        }).eq('id', id);
        if (e2) throw e2;

        if (typeof sbAuditLog === 'function') sbAuditLog('Aprobar Ingreso', {
            idAfectado: sid,
            detalle: 'Nuevo socio desde Comunicación: ' + nom + ' · avisó ' + (r.area || '—'),
            datos: { socio_id: sid, aviso: id, area: r.area }
        });

        await ni_render(true);
        if (typeof fetchSociosDeGoogle === 'function') fetchSociosDeGoogle();
        if (typeof showToast === 'function') showToast('Socio ' + sid + ' creado ✅', 'success');
    } catch (e) {
        if (typeof showToast === 'function') showToast('No se pudo: ' + (e.message || e), 'error');
    } finally {
        if (typeof toggleLoader === 'function') toggleLoader(false);
    }
}

// ── Rechazar: queda con su motivo ───────────────────────────
async function ni_rechazar(id) {
    const r = (_niLista || []).find(x => x.id === id);
    if (!r) return;
    const motivo = prompt('¿Por qué se rechaza este aviso?\n\n'
        + 'Queda guardado y lo ve el área que lo mandó.');
    if (motivo === null) return;
    if (!String(motivo).trim()) {
        if (typeof showToast === 'function') showToast('Hace falta el motivo', 'warning');
        return;
    }
    try {
        const { error } = await dbSoc.from('nuevos_ingresos').update({
            estado: 'rechazado', motivo: String(motivo).trim(),
            resuelto_en: new Date().toISOString(), resuelto_por: _niQuien()
        }).eq('id', id);
        if (error) throw error;
        if (typeof sbAuditLog === 'function') sbAuditLog('Rechazar Ingreso', {
            idAfectado: id,
            detalle: 'Aviso rechazado: ' + ((r.nombre || '') + ' ' + (r.apellido || '')).trim()
                   + ' · ' + String(motivo).trim()
        });
        await ni_render(true);
        if (typeof showToast === 'function') showToast('Rechazado', 'success');
    } catch (e) {
        if (typeof showToast === 'function') showToast('No se pudo: ' + (e.message || e), 'error');
    }
}

// ══════════════════════════════════════════════════════════════════════
// QUIÉN ENTRA A COMUNICACIÓN Y CON QUÉ CLAVE
//
// Todo pasa por la Edge Function. Desde acá NUNCA se puede ver un PIN:
// solo saber qué áreas tienen uno, ponerlo y quitarlo.
// ══════════════════════════════════════════════════════════════════════

let _niAdminPass = null;      // solo en memoria, mientras dure la pantalla

async function _niAuth(cuerpo) {
    try {
        const res = await fetch(_NI_AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + _SB_KEY_SOC,
                'apikey': _SB_KEY_SOC
            },
            body: JSON.stringify(Object.assign({ adminPass: _niAdminPass }, cuerpo || {}))
        });
        return await res.json();
    } catch (e) { return { ok: false, reason: 'Sin conexión' }; }
}

function ni_abrirClaves() {
    const m = document.getElementById('modalClavesAreas');
    if (!m) return;
    m.style.display = 'block';
    _niAdminPass = null;
    document.getElementById('niClavesBody').innerHTML =
        '<p style="font-size:0.85em;color:#475569;line-height:1.6;margin-bottom:12px;">'
        + 'Escribe la clave de administración. <b>No está guardada en la app</b>: '
        + 'vive solo como huella en Supabase, así que nadie puede sacarla del código.</p>'
        + '<p style="font-size:0.78em;color:#92400e;background:#fef3c7;border:1px solid #f59e0b;'
        + 'border-radius:8px;padding:8px 10px;line-height:1.5;margin-bottom:12px;">'
        + 'Si todavía no la has puesto, ejecuta <b>paso2b-clave-admin.sql</b> en Supabase.</p>'
        + '<input id="niPass" type="password" placeholder="Clave de administración" '
        + 'style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:9px;margin-bottom:10px;">'
        + '<div id="niPassErr" style="display:none;font-size:0.8em;color:#b91c1c;margin-bottom:9px;"></div>'
        + '<button onclick="ni_entrarClaves()" class="btn-action" style="width:100%;background:#1d4ed8;">Continuar</button>';
    setTimeout(() => { const i = document.getElementById('niPass'); if (i) i.focus(); }, 120);
}
function ni_cerrarClaves() {
    const m = document.getElementById('modalClavesAreas');
    if (m) m.style.display = 'none';
    _niAdminPass = null;     // no se queda dando vueltas en memoria
}

async function ni_entrarClaves() {
    const i = document.getElementById('niPass');
    const err = document.getElementById('niPassErr');
    _niAdminPass = (i && i.value) || '';
    const r = await _niAuth({ action: 'estado' });
    if (!r || !r.ok) {
        _niAdminPass = null;
        if (err) { err.textContent = (r && r.reason) || 'No se pudo comprobar.'; err.style.display = 'block'; }
        return;
    }
    _niPintarClaves(r.areas || []);
}

function _niPintarClaves(areas) {
    const conPin = {};
    areas.forEach(a => { conPin[a.area] = a; });

    // Las áreas salen de los socios: agregar un área es solo darle clave.
    const todas = [...new Set((cacheSocios || []).map(s => String(s.area || '').trim()).filter(Boolean))].sort();
    const norm = a => String(a || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, '').trim();

    document.getElementById('niClavesBody').innerHTML =
        '<p style="font-size:0.82em;color:#475569;line-height:1.55;margin-bottom:12px;">'
        + 'Cada área entra a <b>Comunicación</b> con su propia clave. '
        + 'Una vez puesta <b>no se puede ver</b>, ni desde acá: solo cambiarla o quitarla.</p>'
        + todas.map(a => {
            const k = norm(a);
            const tiene = !!conPin[k];
            const nuevo = tiene && conPin[k].sinEstrenar;
            return '<div class="card" style="padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:9px;flex-wrap:wrap;">'
                + '<div style="flex:1;min-width:0;">'
                +   '<div style="font-weight:800;font-size:0.9em;">' + _niEsc(a) + '</div>'
                +   '<div style="font-size:0.74em;color:' + (tiene ? '#15803d' : '#94a3b8') + ';margin-top:2px;">'
                +     (tiene ? (nuevo ? 'Tiene clave · sin estrenar' : 'Tiene clave · ya la usaron')
                             : 'Sin clave — todavía no puede entrar') + '</div>'
                + '</div>'
                + '<button onclick="ni_fijarClave(\'' + _niEsc(a) + '\')" class="btn-card" '
                +   'style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:0.76em;padding:4px 10px;">'
                +   (tiene ? 'Cambiar' : 'Poner clave') + '</button>'
                + (tiene ? '<button onclick="ni_quitarClave(\'' + _niEsc(a) + '\')" class="btn-card" '
                    + 'style="background:#fee2e2;border:1px solid #fca5a5;color:#b91c1c;font-size:0.76em;padding:4px 10px;">Quitar</button>' : '')
                + '</div>';
        }).join('')
        + '<p style="font-size:0.75em;color:#64748b;margin-top:10px;line-height:1.5;">'
        + 'La app de las áreas está en <b>/index3.html</b>. Pásales ese enlace y su clave.</p>';
}

async function ni_fijarClave(area) {
    const pin = prompt('Clave nueva para «' + area + '»\n\n4 a 8 dígitos. Anótala y pásasela al área: '
        + 'después de esto nadie puede volver a verla.');
    if (pin === null) return;
    if (!/^\d{4,8}$/.test(String(pin).trim())) {
        if (typeof showToast === 'function') showToast('Son 4 a 8 dígitos', 'warning');
        return;
    }
    const r = await _niAuth({ action: 'fijar', area: area, pin: String(pin).trim() });
    if (!r || !r.ok) {
        if (typeof showToast === 'function') showToast((r && r.reason) || 'No se pudo', 'error');
        return;
    }
    if (typeof sbAuditLog === 'function') sbAuditLog('Clave de Área', { detalle: 'Clave puesta para ' + area });
    if (typeof showToast === 'function') showToast('Clave puesta para ' + area, 'success');
    const e = await _niAuth({ action: 'estado' });
    if (e && e.ok) _niPintarClaves(e.areas || []);
}

async function ni_quitarClave(area) {
    if (!confirm('Quitarle el acceso a «' + area + '».\n\nDejará de poder entrar a Comunicación. ¿Seguir?')) return;
    const r = await _niAuth({ action: 'quitar', area: area });
    if (!r || !r.ok) {
        if (typeof showToast === 'function') showToast((r && r.reason) || 'No se pudo', 'error');
        return;
    }
    if (typeof sbAuditLog === 'function') sbAuditLog('Clave de Área', { detalle: 'Acceso quitado a ' + area });
    if (typeof showToast === 'function') showToast('Acceso quitado', 'success');
    const e = await _niAuth({ action: 'estado' });
    if (e && e.ok) _niPintarClaves(e.areas || []);
}
