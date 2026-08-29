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

// ── Tipos de archivo ────────────────────────────────────────
// Se acepta cualquier archivo (Word, Excel, PowerPoint, con o sin macros,
// PDF, imágenes, comprimidos, etc.). Los navegadores dejan `file.type` VACÍO
// en varios formatos de Office —sobre todo los de macros (.xlsm, .docm,
// .pptm)—, así que el MIME se deduce de la extensión cuando falta: sin
// contentType el archivo se sube como binario genérico y luego no se abre
// con la aplicación correcta.
const DOC_MIME_POR_EXT = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    docm: 'application/vnd.ms-word.document.macroEnabled.12',
    dot: 'application/msword',
    dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    dotm: 'application/vnd.ms-word.template.macroEnabled.12',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    xltm: 'application/vnd.ms-excel.template.macroEnabled.12',
    csv: 'text/csv',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
    rtf: 'application/rtf', txt: 'text/plain',
    zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', svg: 'image/svg+xml',
    mp4: 'video/mp4', mp3: 'audio/mpeg'
};
function _docExt(nombre) { const p = String(nombre || '').split('.'); return p.length > 1 ? p.pop().toLowerCase() : ''; }
function _docMime(file) {
    return file.type || DOC_MIME_POR_EXT[_docExt(file.name)] || 'application/octet-stream';
}
function _docTipo(nombre, mime) {
    const e = _docExt(nombre), m = String(mime || '').toLowerCase();
    if (e === 'pdf' || m.indexOf('pdf') >= 0) return { icono: '📄', etiqueta: 'PDF', previsualiza: true };
    if (['doc','docx','docm','dot','dotx','dotm','odt','rtf'].indexOf(e) >= 0 || m.indexOf('word') >= 0)
        return { icono: '📝', etiqueta: 'Word', previsualiza: false };
    if (['xls','xlsx','xlsm','xlsb','xlt','xltx','xltm','csv','ods'].indexOf(e) >= 0 || m.indexOf('excel') >= 0 || m.indexOf('spreadsheet') >= 0)
        return { icono: '📊', etiqueta: 'Excel', previsualiza: false };
    if (['ppt','pptx','pptm','pps','ppsx','odp'].indexOf(e) >= 0 || m.indexOf('powerpoint') >= 0 || m.indexOf('presentation') >= 0)
        return { icono: '📽️', etiqueta: 'PowerPoint', previsualiza: false };
    if (['zip','rar','7z','tar','gz'].indexOf(e) >= 0) return { icono: '🗜️', etiqueta: 'Comprimido', previsualiza: false };
    if (m.indexOf('image/') === 0 || ['png','jpg','jpeg','gif','webp','heic','svg','bmp'].indexOf(e) >= 0)
        return { icono: '🖼️', etiqueta: 'Imagen', previsualiza: true };
    if (m.indexOf('video/') === 0) return { icono: '🎬', etiqueta: 'Video', previsualiza: true };
    if (m.indexOf('audio/') === 0) return { icono: '🎵', etiqueta: 'Audio', previsualiza: true };
    if (['txt','md','log'].indexOf(e) >= 0) return { icono: '📃', etiqueta: 'Texto', previsualiza: true };
    return { icono: '📎', etiqueta: e ? e.toUpperCase() : 'Archivo', previsualiza: false };
}
function _docTamano(bytes) {
    const b = Number(bytes) || 0;
    if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(b / 1024)) + ' KB';
}

// Renderiza una fila de documento (con Ver/Abrir y opcional Eliminar)
function _docFila(d, permitirBorrar) {
    const t = _docTipo(d.nombre_archivo, d.mime);
    // Word/Excel/PowerPoint no se ven dentro del navegador: se descargan para
    // abrirlos con su programa. El botón lo dice para que no parezca un error.
    const txtBtn = t.previsualiza ? '👁 Ver' : '⬇ Abrir';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;background:white;">
        <span style="font-size:1.3em;">${t.icono}</span>
        <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:0.86em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_docEsc(d.nombre_archivo || 'documento')}</div>
            <div style="font-size:0.72em;color:#64748b;margin-top:1px;">${t.etiqueta} · ${_docTamano(d.tamano)} · ${_docFechaVis(d.created_at)}${d.subido_por ? ' · ' + _docEsc(d.subido_por) : ''}</div>
        </div>
        <button onclick="doc_ver('${d.storage_path}')" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:7px;padding:5px 10px;font-size:0.76em;font-weight:700;cursor:pointer;white-space:nowrap;">${txtBtn}</button>
        ${permitirBorrar ? `<button onclick="doc_borrar('${d.id}','${d.storage_path}')" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:7px;padding:5px 8px;font-size:0.76em;cursor:pointer;">🗑</button>` : ''}
    </div>`;
}

// Mensaje claro cuando el bucket rechaza el tipo de archivo.
function _docErrorSubida(e) {
    const msg = String((e && e.message) || e || '');
    if (/mime|content type|not allowed|invalid_mime/i.test(msg)) {
        return 'El almacenamiento no acepta este tipo de archivo. Hay que permitir todos los tipos en el bucket "documentos" de Supabase.';
    }
    if (/exceeded|too large|payload/i.test(msg)) return 'El archivo es demasiado grande para el almacenamiento.';
    return msg || 'error desconocido';
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
        const mime = _docMime(file);
        const up = await dbSoc.storage.from('documentos').upload(path, file, { contentType: mime, upsert: false });
        if (up.error) throw up.error;
        await dbSoc.from('documentos').insert({
            id: crypto.randomUUID(), socio_id: null, socio_nombre: null, categoria: 'general',
            nombre_archivo: file.name, storage_path: path, mime: mime, tamano: file.size, subido_por: quien
        });
        if (typeof sbAuditLog === 'function') sbAuditLog('Subir Documento', { detalle: 'Documento general: ' + file.name, datos: { nombre: file.name } });
        showToast('Documento subido ✅', 'success');
        doc_cargarGenerales();
    } catch(e) { showToast('No se pudo subir: ' + _docErrorSubida(e), 'error'); }
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
            📤 Enviar archivo a este socio
            <input type="file" onchange="doc_subirSocio(this,'${_docEsc(socioId)}')" style="display:none;">
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
        const mime = _docMime(file);
        const up = await dbSoc.storage.from('documentos').upload(path, file, { contentType: mime, upsert: false });
        if (up.error) throw up.error;
        await dbSoc.from('documentos').insert({
            id: crypto.randomUUID(), socio_id: String(socioId), socio_nombre: socioNombre, categoria: 'socio',
            nombre_archivo: file.name, storage_path: path, mime: mime, tamano: file.size, subido_por: quien
        });
        if (typeof sbAuditLog === 'function') sbAuditLog('Enviar Documento', { detalle: 'Documento a socio ' + (socioNombre || socioId) + ': ' + file.name, datos: { socioId, nombre: file.name } });
        showToast('Documento enviado al socio ✅', 'success');
        doc_verSocio(socioId);
    } catch(e) { showToast('No se pudo enviar: ' + _docErrorSubida(e), 'error'); }
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
