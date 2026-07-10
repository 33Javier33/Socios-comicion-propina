// ============================================================
// DOCUMENTACIÓN — documentos generales (reglamento, etc.) y por socio
// Usa Supabase Storage (bucket privado 'documentos') + tabla 'documentos'.
// ============================================================

let _docTab = 'generales';
let _docSocioSel = null;

function doc_init() {
    doc_setTab(_docTab);
}

function doc_setTab(tab) {
    _docTab = tab;
    ['generales', 'socios'].forEach(t => {
        const btn = document.getElementById('doc-tab-' + t);
        if (btn) {
            const on = t === tab;
            btn.style.background = on ? '#2563eb' : 'white';
            btn.style.color = on ? 'white' : '#2563eb';
        }
    });
    document.getElementById('doc-panel-generales').style.display = (tab === 'generales') ? 'block' : 'none';
    document.getElementById('doc-panel-socios').style.display = (tab === 'socios') ? 'block' : 'none';
    if (tab === 'generales') doc_cargarGenerales();
    else doc_renderBusquedaSocios();
}

function _docEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _docFechaVis(iso) {
    try { return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch(e) { return ''; }
}

// Renderiza una fila de documento (con Ver, Descargar y opcional Eliminar)
function _docFila(d, permitirBorrar) {
    const kb = d.tamano ? Math.round(d.tamano / 1024) : 0;
    const esPdf = (d.mime || '').indexOf('pdf') >= 0;
    const icon = esPdf ? '📄' : '🖼️';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;background:white;">
        <span style="font-size:1.3em;">${icon}</span>
        <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:0.86em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_docEsc(d.nombre_archivo || 'documento')}</div>
            <div style="font-size:0.72em;color:#64748b;margin-top:1px;">${kb} KB · ${_docFechaVis(d.created_at)}${d.subido_por ? ' · ' + _docEsc(d.subido_por) : ''}</div>
        </div>
        <button onclick="doc_ver('${d.storage_path}')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:7px;padding:5px 10px;font-size:0.76em;font-weight:700;cursor:pointer;">👁 Ver</button>
        ${permitirBorrar ? `<button onclick="doc_borrar('${d.id}','${d.storage_path}')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:7px;padding:5px 8px;font-size:0.76em;cursor:pointer;">🗑</button>` : ''}
    </div>`;
}

// ── Documentos generales ────────────────────────────────────
async function doc_cargarGenerales() {
    const cont = document.getElementById('doc-generales-lista');
    if (!cont) return;
    cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">⏳ Cargando...</div>';
    try {
        const { data } = await dbSoc.from('documentos').select('*').eq('categoria', 'general').order('created_at', { ascending: false });
        if (!data || !data.length) { cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">Sin documentos generales aún.</div>'; return; }
        cont.innerHTML = data.map(d => _docFila(d, true)).join('');
    } catch(e) { cont.innerHTML = '<div style="text-align:center;padding:20px;color:#dc2626;font-size:0.85em;">Error al cargar</div>'; }
}

async function doc_subirGeneral(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showToast('El archivo supera 20 MB', 'error'); return; }
    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : {};
    const quien = sesion.ini ? (sesion.ini + (sesion.area ? ' (' + sesion.area + ')' : '')) : 'Responsable';
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = 'general/' + Date.now() + '_' + safe;
    toggleLoader(true, 'Subiendo documento...');
    try {
        const up = await dbSoc.storage.from('documentos').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        await dbSoc.from('documentos').insert({
            id: crypto.randomUUID(), socio_id: null, socio_nombre: null, categoria: 'general',
            nombre_archivo: file.name, storage_path: path, mime: file.type, tamano: file.size, subido_por: quien
        });
        if (typeof sbAuditLog === 'function') sbAuditLog('Subir Documento', { detalle: 'Documento general: ' + file.name, datos: { nombre: file.name } });
        showToast('Documento subido ✅', 'success');
        doc_cargarGenerales();
    } catch(e) { showToast('No se pudo subir: ' + (e.message || e), 'error'); }
    finally { toggleLoader(false); }
}

// ── Documentos por socio ────────────────────────────────────
function doc_renderBusquedaSocios() {
    const term = (document.getElementById('doc-socio-buscar')?.value || '').toLowerCase().trim();
    const cont = document.getElementById('doc-socios-lista');
    if (!cont) return;
    if (_docSocioSel) { doc_verSocio(_docSocioSel); return; }
    let socios = (cacheSocios || []);
    if (term) socios = socios.filter(s => ((s.nombre || '') + ' ' + (s.apellido || '')).toLowerCase().includes(term));
    socios = socios.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')).slice(0, 40);
    if (!socios.length) { cont.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.85em;">Sin socios.</div>'; return; }
    cont.innerHTML = socios.map(s =>
        `<button onclick="doc_verSocio('${s.id}')" style="width:100%;text-align:left;background:white;border:1px solid #e2e8f0;border-radius:9px;padding:10px 12px;margin-bottom:6px;cursor:pointer;font-size:0.88em;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:9px;">
            ${avatarHTML(s.fotoUrl, s.nombre, 32)}
            <span>${_docEsc(s.nombre)} ${_docEsc(s.apellido)} <span style="font-weight:500;color:#94a3b8;font-size:0.85em;">· ${_docEsc(s.area || '')}</span></span>
        </button>`
    ).join('');
}

async function doc_verSocio(socioId) {
    _docSocioSel = socioId;
    const socio = (cacheSocios || []).find(s => s.id === socioId);
    const cont = document.getElementById('doc-socios-lista');
    if (!cont) return;
    cont.innerHTML = `<button onclick="doc_volverSocios()" style="background:none;border:1px solid #cbd5e1;color:#64748b;border-radius:8px;padding:5px 12px;font-size:0.8em;font-weight:700;cursor:pointer;margin-bottom:10px;">← Volver</button>
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;">${socio ? avatarHTML(socio.fotoUrl, socio.nombre, 36) : ''}<div style="font-weight:800;font-size:0.95em;color:#0f172a;">${socio ? _docEsc(socio.nombre + ' ' + socio.apellido) : 'Socio'}</div></div>
        <label style="display:flex;align-items:center;justify-content:center;gap:7px;background:#2563eb;color:white;border-radius:9px;padding:9px 12px;font-size:0.82em;font-weight:700;cursor:pointer;margin-bottom:12px;">
            📤 Enviar documento a este socio
            <input type="file" accept="application/pdf,image/*" onchange="doc_subirSocio(this,'${_docEsc(socioId)}')" style="display:none;">
        </label>
        <div style="font-size:0.72em;color:#94a3b8;margin:-6px 0 10px;text-align:center;">Le aparecerá en <b>Mis Documentos</b> dentro de su app.</div>
        <div id="doc-socio-docs" style="text-align:center;padding:16px;color:#94a3b8;font-size:0.85em;">⏳ Cargando...</div>`;
    try {
        const { data } = await dbSoc.from('documentos').select('*').eq('socio_id', String(socioId)).eq('categoria', 'socio').order('created_at', { ascending: false });
        const box = document.getElementById('doc-socio-docs');
        if (!data || !data.length) { box.innerHTML = '<div style="color:#94a3b8;font-size:0.85em;padding:10px;">Este socio no ha subido documentos.</div>'; return; }
        box.innerHTML = data.map(d => _docFila(d, true)).join('');
    } catch(e) {
        const box = document.getElementById('doc-socio-docs');
        if (box) box.innerHTML = '<div style="color:#dc2626;font-size:0.85em;padding:10px;">Error al cargar</div>';
    }
}

function doc_volverSocios() { _docSocioSel = null; doc_renderBusquedaSocios(); }

// El responsable sube un documento PARA un socio → le aparece en "Mis Documentos"
async function doc_subirSocio(input, socioId) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showToast('El archivo supera 20 MB', 'error'); return; }
    const socio = (cacheSocios || []).find(s => String(s.id) === String(socioId));
    const socioNombre = socio ? (socio.nombre + ' ' + socio.apellido).trim() : null;
    const sesion = typeof getSesionResponsableObj === 'function' ? getSesionResponsableObj() : {};
    const quien = sesion.ini ? ('Administración (' + sesion.ini + (sesion.area ? ' · ' + sesion.area : '') + ')') : 'Administración';
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = 'socio/' + socioId + '/' + Date.now() + '_' + safe;
    toggleLoader(true, 'Enviando documento...');
    try {
        const up = await dbSoc.storage.from('documentos').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        await dbSoc.from('documentos').insert({
            id: crypto.randomUUID(), socio_id: String(socioId), socio_nombre: socioNombre, categoria: 'socio',
            nombre_archivo: file.name, storage_path: path, mime: file.type, tamano: file.size, subido_por: quien
        });
        if (typeof sbAuditLog === 'function') sbAuditLog('Enviar Documento', { detalle: 'Documento a socio ' + (socioNombre || socioId) + ': ' + file.name, datos: { socioId, nombre: file.name } });
        showToast('Documento enviado al socio ✅', 'success');
        doc_verSocio(socioId);
    } catch(e) { showToast('No se pudo enviar: ' + (e.message || e), 'error'); }
    finally { toggleLoader(false); }
}

// ── Compartidas: ver (URL firmada) y borrar ─────────────────
async function doc_ver(path) {
    toggleLoader(true, 'Abriendo...');
    try {
        const { data, error } = await dbSoc.storage.from('documentos').createSignedUrl(path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
    } catch(e) { showToast('No se pudo abrir el documento', 'error'); }
    finally { toggleLoader(false); }
}

async function doc_borrar(id, path) {
    if (!confirm('¿Eliminar este documento? No se puede deshacer.')) return;
    toggleLoader(true, 'Eliminando...');
    try {
        await dbSoc.storage.from('documentos').remove([path]);
        await dbSoc.from('documentos').delete().eq('id', id);
        if (typeof sbAuditLog === 'function') sbAuditLog('Eliminar Documento', { detalle: 'Documento eliminado', datos: { id } });
        showToast('Documento eliminado', 'success');
        if (_docTab === 'generales') doc_cargarGenerales();
        else if (_docSocioSel) doc_verSocio(_docSocioSel);
    } catch(e) { showToast('No se pudo eliminar', 'error'); }
    finally { toggleLoader(false); }
}
