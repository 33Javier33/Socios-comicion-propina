// ============================================================
// CARPETAS: BACKUPS, EXPORTAR/IMPORTAR Y ARCHIVERO
// Almacena períodos archivados en Supabase + localStorage
// ============================================================

const CARPETAS_SK = 'carpetas_recaudacion_socios_v1';
let recArchivero = JSON.parse(localStorage.getItem(CARPETAS_SK) || '[]');

// Extrae el divisor máximo por fecha desde un array de registros
function carpetas_extractDivisores(datos) {
    const div = {};
    datos.forEach(r => {
        if (!r.divisor) return;
        const d = parseFloat(String(r.divisor).replace(',', '.'));
        if (d > 0) div[r.fecha] = div[r.fecha] ? Math.max(div[r.fecha], d) : d;
    });
    return div;
}

// Normaliza billetes a formato array [{denominacion, cantidad}]
function _carpetas_normBilletes(billetes) {
    if (!billetes) return [];
    if (Array.isArray(billetes)) {
        return billetes.filter(b => Number(b.cantidad) > 0);
    }
    if (typeof billetes === 'object') {
        return Object.entries(billetes)
            .map(([d, c]) => ({ denominacion: Number(d), cantidad: Number(c) }))
            .filter(b => b.cantidad > 0)
            .sort((a, b) => b.denominacion - a.denominacion);
    }
    return [];
}

// ── Cargar carpetas archivadas desde Supabase ─────────────────
async function carpetas_cargarDesdeSupabase() {
    try {
        const { data, error } = await dbSoc.from('periodos_archivados')
            .select('id, nombre, total_rec, datos, created_at, fecha_inicio, fecha_fin')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(row => ({
            _sbId: row.id,
            rango: row.nombre,
            totalRec: row.datos?.totalRec || formatearMoneda(Number(row.total_rec || 0)),
            totalPtos: row.datos?.totalPtos || '—',
            data: row.datos?.data || [],
            divisores: row.datos?.divisores || {},
            retiros: row.datos?.retiros || [],
            fechaInicio: row.fecha_inicio || null,
            fechaFin: row.fecha_fin || null,
            fechaArchivo: row.datos?.fechaArchivo || row.created_at
        }));
    } catch(e) {
        console.warn('[CARPETAS-SB] Error cargando desde Supabase:', e.message);
        return [];
    }
}

// ── Guardar una carpeta en Supabase ──────────────────────────
async function carpetas_guardarEnSupabase(arc) {
    const fechas = (arc.data || [])
        .map(r => r.fecha).filter(Boolean).sort();
    const fechaInicio = fechas[0] || new Date().toISOString().substring(0, 10);
    const fechaFin = fechas[fechas.length - 1] || fechaInicio;
    const totalRecNum = parseFloat(
        String(arc.totalRec || '0').replace(/[^\d,.-]/g, '').replace(',', '.')
    ) || 0;

    const { data, error } = await dbSoc.from('periodos_archivados').insert({
        nombre: arc.rango,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        total_rec: totalRecNum,
        datos: {
            rango: arc.rango,
            totalRec: arc.totalRec,
            totalPtos: arc.totalPtos,
            data: arc.data,
            divisores: arc.divisores,
            retiros: arc.retiros || [],
            fechaArchivo: arc.fechaArchivo
        }
    }).select('id').single();

    if (error) { console.error('[CARPETAS-SB] Error guardando en Supabase:', error.message); return null; }
    return data?.id || null;
}

// ── Render del archivero (fusiona Supabase + localStorage) ────
// Nombre del mes del período archivado según la regla del 15 (15 del mes → 14 del
// siguiente). Ej: 15/06 al 14/07 → "Junio". Se usa la fecha de inicio del período.
const _MESES_ARCH = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function _mesNombreArchivo(arc) {
    let ini = arc.fechaInicio;
    if (!ini && Array.isArray(arc.data) && arc.data.length) {
        const fs = arc.data.map(r => r.fecha).filter(Boolean).sort();
        ini = fs[0];
    }
    if (!ini) return '';
    const d = new Date(String(ini).substring(0, 10) + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    let m = d.getMonth(), y = d.getFullYear();
    // Si la fecha de inicio es antes del día 15, el período empezó el mes anterior.
    if (d.getDate() < 15) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
    return _MESES_ARCH[m] + ' ' + y;
}

async function carpetas_renderArchivero() {
    const container = document.getElementById('carpetasContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;color:#7f8c8d;padding:30px 20px;font-size:0.85em;">Cargando carpetas...</div>';

    // Cargar desde Supabase
    const sbArcs = await carpetas_cargarDesdeSupabase();

    // Detectar cuáles localStorage no están en Supabase
    const sbRangos = new Set(sbArcs.map(a => a.rango));
    const localSoloRangos = recArchivero.filter(a => !sbRangos.has(a.rango));
    const haySoloLocal = localSoloRangos.length > 0;

    // Merge: Supabase primero, luego los que solo están locales
    const todos = [
        ...sbArcs.map(a => ({ ...a, _enSupabase: true })),
        ...localSoloRangos.map(a => ({ ...a, _enSupabase: false }))
    ];

    if (todos.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#7f8c8d;padding:50px 20px;font-size:0.9em;">📭 No hay carpetas archivadas aún.<br><small style="font-size:0.85em;">Usa "Vaciar Nube y Archivar Todo" para crear una.</small></div>';
        return;
    }

    // Botón para subir pendientes locales a Supabase
    const alertaLocal = haySoloLocal ? `
        <div style="background:#fff3cd;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div>
                <div style="font-weight:700;font-size:0.85em;color:#92400e;">⚠️ ${localSoloRangos.length} carpeta${localSoloRangos.length>1?'s':''} solo en este dispositivo</div>
                <div style="font-size:0.75em;color:#a16207;margin-top:2px;">No están en Supabase. Si cambias de navegador se perderán.</div>
            </div>
            <button onclick="carpetas_subirLocalASupabase()" style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:8px 14px;font-size:0.8em;font-weight:700;cursor:pointer;white-space:nowrap;">☁️ Subir a Supabase</button>
        </div>` : '';

    container.innerHTML = alertaLocal + todos.map((arc, idx) => {
        const sbBadge = arc._enSupabase
            ? `<span style="background:#dcfce7;color:#15803d;font-size:0.68em;font-weight:700;padding:2px 7px;border-radius:8px;">☁️ Supabase</span>`
            : `<span style="background:#fef9c3;color:#92400e;font-size:0.68em;font-weight:700;padding:2px 7px;border-radius:8px;">💾 Solo local</span>`;
        const _mesLbl = _mesNombreArchivo(arc);
        return `
        <div style="background:white;border-radius:12px;padding:16px;margin-bottom:10px;border:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div>
                <div style="font-weight:800;font-size:0.95em;color:#1e293b;">📁 ${_mesLbl || arc.rango}</div>
                ${_mesLbl ? `<div style="font-size:0.72em;color:#64748b;font-weight:600;margin-top:2px;">${arc.rango}</div>` : ''}
                <div style="font-size:0.72em;color:#374151;font-weight:600;margin-top:4px;">
                    Rec: <strong>${arc.totalRec}</strong> &nbsp;·&nbsp; Puntos: <strong>${arc.totalPtos}</strong>
                </div>
                <div style="margin-top:4px;display:flex;align-items:center;gap:5px;">
                    ${sbBadge}
                    ${arc.fechaArchivo ? '<span style="font-size:0.68em;color:#4b5563;">Archivado: ' + new Date(arc.fechaArchivo).toLocaleString('es-CL') + '</span>' : ''}
                </div>
            </div>
            <div style="display:flex;gap:6px;">
                <button onclick="carpetas_verArchivo(${idx})" data-todos='${JSON.stringify(todos).replace(/'/g,"&#39;")}' style="background:var(--secondary);color:white;border:none;border-radius:8px;padding:7px 14px;font-size:0.8em;font-weight:700;cursor:pointer;">👁 Ver</button>
                ${!arc._enSupabase ? `<button onclick="carpetas_subirUna(${idx})" style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:7px 10px;font-size:0.8em;font-weight:700;cursor:pointer;" title="Subir a Supabase">☁️</button>` : ''}
                <button onclick="carpetas_eliminarCarpeta(${idx})" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:8px;padding:7px 14px;font-size:0.8em;font-weight:700;cursor:pointer;">🗑</button>
            </div>
        </div>`;
    }).join('');

    // Guardar referencia global para que carpetas_verArchivo pueda leerla
    window._carpetasTodos = todos;
}

function carpetas_verArchivo(idx) {
    const todos = window._carpetasTodos || recArchivero;
    const arc = todos[idx];
    if (!arc) return;

    const _mesLbl = _mesNombreArchivo(arc);
    document.getElementById('carpetaModalTitulo').textContent = _mesLbl ? (_mesLbl + ' · ' + arc.rango) : arc.rango;
    const cont = document.getElementById('carpetaModalContenido');

    cont.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:0.68em;font-weight:800;color:#1e40af;text-transform:uppercase;margin-bottom:6px;">Recaudación Final</div>
                <div style="font-size:1.3em;font-weight:900;color:#1e293b;">${arc.totalRec}</div>
            </div>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:0.68em;font-weight:800;color:#b45309;text-transform:uppercase;margin-bottom:6px;">Total Puntos</div>
                <div style="font-size:1.3em;font-weight:900;color:#1e293b;">${arc.totalPtos}</div>
            </div>
        </div>`;

    // ── Recaudaciones por día ─────────────────────────────────
    const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const grouped = {};
    (arc.data || []).forEach(r => {
        let f = r.fecha; if (f && f.includes('T')) f = f.split('T')[0];
        if (!f) return;
        if (!grouped[f]) grouped[f] = [];
        grouped[f].push(r);
    });

    Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach(fecha => {
        const regs = grouped[fecha];
        const total = regs.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
        const divVal = (arc.divisores || {})[fecha] || 0;
        const puntoNoche = divVal > 0 ? total / divVal : 0;
        const p = fecha.split('-');
        const fechaVis = `${p[2]}/${p[1]}/${p[0]}`;
        const diaNom = DIAS[new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2])).getDay()];

        const tiposHtml = regs.map(r => {
            let t = r.tipo || 'Sin Tipo';
            if (t === 'Mesas') t = 'SalaDeJuegos';
            const arqueado = r.arqueado;
            const badgeHtml = arqueado
                ? `<span style="background:#dcfce7;color:#15803d;font-size:0.7em;font-weight:700;padding:2px 7px;border-radius:10px;">✅ En caja</span>`
                : `<span style="background:#fef9c3;color:#92400e;font-size:0.7em;font-weight:700;padding:2px 7px;border-radius:10px;">⚠️ Pendiente</span>`;
            const registradoPor = r.registrado_por_nombre
                ? `<span style="font-size:0.72em;color:#374151;font-weight:600;">👤 ${r.registrado_por_nombre}</span>` : '';
            const arqueadoAt = (arqueado && r.arqueado_at)
                ? `<span style="font-size:0.72em;color:#374151;font-weight:600;">🕐 ${new Date(r.arqueado_at).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>` : '';

            const billetes = _carpetas_normBilletes(r.billetes);
            const billetesHtml = billetes.length > 0
                ? `<div style="margin-top:6px;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.75em;">
                        <thead><tr style="background:#e2e8f0;">
                            <th style="padding:4px 8px;text-align:left;font-weight:700;color:#475569;">Denom.</th>
                            <th style="padding:4px 8px;text-align:center;font-weight:700;color:#475569;">Cant.</th>
                            <th style="padding:4px 8px;text-align:right;font-weight:700;color:#475569;">Subtotal</th>
                        </tr></thead>
                        <tbody>${billetes.map((b, i) => {
                            const sub = Number(b.denominacion||0) * Number(b.cantidad||0);
                            return `<tr style="border-top:1px solid #f0f0f0;${i%2===1?'background:#fafafa;':''}">
                                <td style="padding:3px 8px;color:#334155;">${formatearMoneda(b.denominacion)}</td>
                                <td style="padding:3px 8px;text-align:center;color:#334155;">${b.cantidad}</td>
                                <td style="padding:3px 8px;text-align:right;font-weight:600;color:#1e293b;">${formatearMoneda(sub)}</td>
                            </tr>`;
                        }).join('')}</tbody>
                        <tfoot><tr style="background:#1e293b;">
                            <td colspan="2" style="padding:4px 8px;color:#374151;font-size:0.85em;font-weight:700;">Total billetes</td>
                            <td style="padding:4px 8px;text-align:right;color:white;font-weight:800;">${formatearMoneda(billetes.reduce((s,b)=>s+Number(b.denominacion||0)*Number(b.cantidad||0),0))}</td>
                        </tr></tfoot>
                    </table></div>` : '';

            return `<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <span style="font-weight:700;color:var(--secondary);font-size:0.85em;">${t}</span>
                    <span style="font-weight:700;font-size:0.85em;">${formatearMoneda(r.monto)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${badgeHtml}${registradoPor}${arqueadoAt}</div>
                ${billetesHtml}
            </div>`;
        }).join('');

        cont.innerHTML += `
            <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <span style="font-size:0.68em;font-weight:800;background:var(--secondary);color:white;padding:2px 8px;border-radius:10px;margin-right:6px;">${diaNom}</span>
                        <span style="font-weight:700;font-size:0.85em;">📅 ${fechaVis}</span>
                    </div>
                    <span style="font-weight:900;color:var(--primary);font-size:0.9em;">${formatearMoneda(total)}</span>
                </div>
                <div style="padding:0 16px;">${tiposHtml}</div>
                <div style="background:#f8fafc;padding:10px 16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:0.8em;">
                    <span style="color:#374151;">Divisor: <strong>${divVal || '—'}</strong></span>
                    <span style="color:#f59e0b;font-weight:800;">Punto Noche: ${formatearMoneda(puntoNoche)}</span>
                </div>
            </div>`;
    });

    // ── Retiros de anticipos (desglose de billetes por socio) ─
    const retiros = arc.retiros || [];
    if (retiros.length > 0) {
        cont.innerHTML += `
            <div style="margin-top:20px;">
                <div style="font-size:0.8em;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">💵 Retiros de Anticipos — Desglose de Billetes</div>
                ${retiros.map(ret => {
                    const bils = _carpetas_normBilletes(ret.billetes);
                    const bilsHtml = bils.length > 0
                        ? `<div style="margin-top:6px;background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
                            <table style="width:100%;border-collapse:collapse;font-size:0.75em;">
                                <thead><tr style="background:#e9d5ff;">
                                    <th style="padding:4px 8px;text-align:left;font-weight:700;color:#6d28d9;">Denom.</th>
                                    <th style="padding:4px 8px;text-align:center;font-weight:700;color:#6d28d9;">Cant.</th>
                                    <th style="padding:4px 8px;text-align:right;font-weight:700;color:#6d28d9;">Subtotal</th>
                                </tr></thead>
                                <tbody>${bils.map((b,i) => {
                                    const sub = Number(b.denominacion||0)*Number(b.cantidad||0);
                                    return `<tr style="${i%2===1?'background:#faf5ff;':''}">
                                        <td style="padding:3px 8px;">${formatearMoneda(b.denominacion)}</td>
                                        <td style="padding:3px 8px;text-align:center;">${b.cantidad}</td>
                                        <td style="padding:3px 8px;text-align:right;font-weight:600;">${formatearMoneda(sub)}</td>
                                    </tr>`;
                                }).join('')}</tbody>
                                <tfoot><tr style="background:#6d28d9;">
                                    <td colspan="2" style="padding:4px 8px;color:#e9d5ff;font-size:0.85em;font-weight:700;">Total entregado</td>
                                    <td style="padding:4px 8px;text-align:right;color:white;font-weight:800;">${formatearMoneda(bils.reduce((s,b)=>s+Number(b.denominacion||0)*Number(b.cantidad||0),0))}</td>
                                </tr></tfoot>
                            </table></div>`
                        : `<span style="font-size:0.75em;color:#4b5563;">Sin desglose</span>`;
                    return `<div style="background:white;border:1px solid #e9d5ff;border-radius:10px;padding:12px;margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <span style="font-weight:700;color:#6d28d9;font-size:0.85em;">👤 ${ret.socio_nombre || ret.nombre || '—'}</span>
                            <span style="font-weight:800;color:#1e293b;font-size:0.9em;">${formatearMoneda(ret.monto)}</span>
                        </div>
                        ${ret.responsable ? `<div style="font-size:0.72em;color:#374151;font-weight:600;margin-bottom:4px;">Resp: ${ret.responsable}</div>` : ''}
                        ${bilsHtml}
                    </div>`;
                }).join('')}
            </div>`;
    }

    document.getElementById('modalCarpeta').style.display = 'flex';
}

function carpetas_cerrarModal() {
    document.getElementById('modalCarpeta').style.display = 'none';
}

async function carpetas_eliminarCarpeta(idx) {
    const todos = window._carpetasTodos || [];
    const arc = todos[idx];
    if (!arc) return;

    const enSupabase = arc._enSupabase;
    const msg = enSupabase
        ? '¿Borrar esta carpeta de Supabase Y de este dispositivo?'
        : '¿Borrar esta carpeta de este dispositivo?';
    if (!confirm(msg)) return;

    // Borrar de Supabase si corresponde
    if (enSupabase && arc._sbId) {
        const { error } = await dbSoc.from('periodos_archivados').delete().eq('id', arc._sbId);
        if (error) { showToast('Error al borrar de Supabase', 'error'); return; }
    }

    // Borrar de localStorage (buscar por rango)
    recArchivero = recArchivero.filter(a => a.rango !== arc.rango);
    localStorage.setItem(CARPETAS_SK, JSON.stringify(recArchivero));

    carpetas_renderArchivero();
    showToast('Carpeta eliminada', 'error');
}

async function carpetas_exportarJson() {
    toggleLoader(true, 'Preparando copia de seguridad...');
    try {
        const [resData, resNotes] = await Promise.all([
            fetch(`${URL_RECAUDACIONES}?action=get&t=${Date.now()}`).then(r => r.json()),
            fetch(`${URL_RECAUDACIONES}?action=getNotes&t=${Date.now()}`).then(r => r.json())
        ]);
        const datos = resData.data || [];
        const notes = resNotes.data || [];
        const divisores = carpetas_extractDivisores(datos);
        const backup = { datos, notes, divisores, archivero: recArchivero };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `BACKUP_RECAUDACION_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        showToast('Copia de seguridad descargada correctamente', 'success');
    } catch(e) {
        showToast('Error al exportar', 'error');
    } finally {
        toggleLoader(false);
    }
}

function carpetas_abrirImportar() {
    document.getElementById('carpetasJsonInput').click();
}

async function carpetas_importarJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const content = JSON.parse(ev.target.result);
            if (!confirm('¿Restaurar esta copia de seguridad?\n\nSobrescribirá los datos actuales en la nube. Esta acción no se puede deshacer.')) { e.target.value = ''; return; }
            toggleLoader(true, 'Restaurando copia de seguridad...');
            await fetch(URL_RECAUDACIONES, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'importAll', data: content })
            });
            if (content.archivero) {
                recArchivero = content.archivero;
                localStorage.setItem(CARPETAS_SK, JSON.stringify(recArchivero));
            }
            try { localStorage.removeItem(CACHE_KEY_REC); } catch(err) {}
            await cargarRecaudaciones();
            carpetas_renderArchivero();
            showToast('Sistema restaurado correctamente', 'success');
        } catch(err) {
            showToast('Error: JSON inválido o corrupto', 'error');
        } finally {
            toggleLoader(false);
            e.target.value = '';
        }
    };
    reader.readAsText(file);
}

// ── Subir una carpeta específica a Supabase ───────────────────
async function carpetas_subirUna(idx) {
    const todos = window._carpetasTodos || [];
    const arc = todos[idx];
    if (!arc || arc._enSupabase) return;
    toggleLoader(true, 'Subiendo a Supabase...');
    try {
        const id = await carpetas_guardarEnSupabase(arc);
        if (id) {
            showToast(`✅ Carpeta "${arc.rango}" subida a Supabase`, 'success');
            carpetas_renderArchivero();
        } else {
            showToast('Error al subir a Supabase', 'error');
        }
    } catch(e) {
        showToast('Error al subir a Supabase', 'error');
    } finally {
        toggleLoader(false);
    }
}

// ── Subir todas las carpetas locales que no están en Supabase ─
async function carpetas_subirLocalASupabase() {
    const sbArcs = await carpetas_cargarDesdeSupabase();
    const sbRangos = new Set(sbArcs.map(a => a.rango));
    const pendientes = recArchivero.filter(a => !sbRangos.has(a.rango));

    if (pendientes.length === 0) {
        showToast('Todas las carpetas ya están en Supabase', 'success');
        return;
    }

    toggleLoader(true, `Subiendo ${pendientes.length} carpeta(s)...`);
    let ok = 0;
    try {
        for (const arc of pendientes) {
            const id = await carpetas_guardarEnSupabase(arc);
            if (id) ok++;
        }
        showToast(`✅ ${ok} carpeta(s) subidas a Supabase`, 'success');
        carpetas_renderArchivero();
    } catch(e) {
        showToast('Error al subir carpetas', 'error');
    } finally {
        toggleLoader(false);
    }
}

// ── Archivar período actual y vaciar nube ─────────────────────
async function carpetas_vaciarYArchivar() {
    if (!recDatosRaw || recDatosRaw.length === 0) return showToast('No hay datos en la nube para archivar', 'error');
    if (!confirm('⚠️ VACIAR NUBE Y ARCHIVAR\n\nSe guardará una copia en Supabase y localmente, luego se borrará la nube.\n\n¿Confirmar?')) return;

    toggleLoader(true, 'Archivando...');
    try {
        // ── PASO 1: construir el archivo ──────────────────────────────
        const fechas = recDatosRaw
            .map(d => { let f = d.fecha; if (f && f.includes('T')) f = f.split('T')[0]; return f; })
            .filter(Boolean).sort();

        const totalR = recDatosRaw.reduce((s, d) => s + (parseFloat(d.monto) || 0), 0);
        const totalPtosEl = document.getElementById('recTotalPuntos');
        const totalPtos = totalPtosEl ? totalPtosEl.innerText : '$0';

        const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const fmtF = (f) => {
            if (!f) return '';
            const p = f.split('-');
            if (p.length !== 3) return f;
            const dia = DIAS[new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2])).getDay()];
            return `${dia} ${p[2]}/${p[1]}/${p[0]}`;
        };

        const rango = fechas.length
            ? `${fmtF(fechas[0])} — ${fmtF(fechas[fechas.length - 1])}`
            : new Date().toLocaleDateString('es-CL');

        const divisores = carpetas_extractDivisores(recDatosRaw);

        let notes = [];
        try {
            const resN = await fetch(`${URL_RECAUDACIONES}?action=getNotes&t=${Date.now()}`).then(r => r.json());
            notes = resN.data || [];
        } catch(e) {}

        // ── PASO 1b: leer retiros_anticipos con desglose de billetes ─
        let retiros = [];
        try {
            const { data: retData } = await dbSoc.from('retiros_anticipos')
                .select('firma, socio_nombre, monto, billetes, responsable');
            retiros = (retData || []).map(r => ({
                firma: r.firma,
                socio_nombre: r.socio_nombre,
                nombre: r.socio_nombre,
                monto: Number(r.monto || 0),
                billetes: r.billetes || {},
                responsable: r.responsable || ''
            }));
        } catch(e) { console.warn('[CARPETAS] Error leyendo retiros:', e.message); }

        // ── PASO 2: guardar en Supabase PRIMERO (fuente de verdad) ───
        const snapDatos = JSON.parse(JSON.stringify(recDatosRaw));
        const arcObj = {
            rango,
            totalRec: formatearMoneda(totalR),
            totalPtos,
            data: snapDatos,
            divisores,
            retiros,
            fechaArchivo: new Date().toISOString()
        };

        const sbId = await carpetas_guardarEnSupabase(arcObj);
        if (sbId) {
            showToast('✅ Guardado en Supabase', 'success');
        } else {
            showToast('⚠️ Supabase no disponible — guardado solo localmente', 'warning');
        }

        // ── PASO 2b: guardar también en localStorage ──────────────────
        recArchivero.push({ ...arcObj, _sbId: sbId });
        localStorage.setItem(CARPETAS_SK, JSON.stringify(recArchivero));
        carpetas_renderArchivero();

        // ── PASO 2c: respaldar en Google Sheets (no crítico) ─────────
        try {
            const responsable = getSesionResponsable();
            await callApiSocios('archivarCarpetaEnSheets', { rango, datos: snapDatos, responsable });
        } catch(eBk) { console.warn('Backup en Sheets falló (no crítico):', eBk); }

        // ── PASO 3: vaciar la nube ────────────────────────────────────
        await fetch(URL_RECAUDACIONES, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'importAll', data: { datos: [], notes, divisores: {} } })
        });

        try { localStorage.removeItem(CACHE_KEY_REC); } catch(e) {}
        try { await cargarRecaudaciones(); } catch(e) {}

        showToast('✅ Período archivado y nube vaciada', 'success');
    } catch(e) {
        carpetas_renderArchivero();
        showToast('Error al archivar (datos guardados localmente)', 'error');
        console.error('carpetas_vaciarYArchivar:', e);
    } finally {
        toggleLoader(false);
    }
}
