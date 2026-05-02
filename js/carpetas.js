// ============================================================
// CARPETAS: BACKUPS, EXPORTAR/IMPORTAR Y ARCHIVERO LOCAL
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

function carpetas_renderArchivero() {
    const container = document.getElementById('carpetasContainer');
    if (!container) return;
    if (recArchivero.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#7f8c8d;padding:50px 20px;font-size:0.9em;">📭 No hay carpetas archivadas aún.<br><small style="font-size:0.85em;">Usa "Vaciar Nube y Archivar Todo" para crear una.</small></div>';
        return;
    }
    container.innerHTML = recArchivero.map((arc, idx) => `
        <div style="background:white;border-radius:12px;padding:16px;margin-bottom:10px;border:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div>
                <div style="font-weight:800;font-size:0.9em;color:#1e293b;">📁 ${arc.rango}</div>
                <div style="font-size:0.72em;color:#7f8c8d;margin-top:4px;">
                    Rec: <strong>${arc.totalRec}</strong> &nbsp;·&nbsp; Puntos: <strong>${arc.totalPtos}</strong>
                </div>
                ${arc.fechaArchivo ? '<div style="font-size:0.68em;color:#94a3b8;margin-top:2px;">Archivado: ' + new Date(arc.fechaArchivo).toLocaleString('es-CL') + '</div>' : ''}
            </div>
            <div style="display:flex;gap:6px;">
                <button onclick="carpetas_verArchivo(${idx})" style="background:var(--secondary);color:white;border:none;border-radius:8px;padding:7px 14px;font-size:0.8em;font-weight:700;cursor:pointer;">👁 Ver</button>
                <button onclick="carpetas_eliminarCarpeta(${idx})" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:8px;padding:7px 14px;font-size:0.8em;font-weight:700;cursor:pointer;">🗑</button>
            </div>
        </div>`).join('');
}

function carpetas_verArchivo(idx) {
    const arc = recArchivero[idx];
    document.getElementById('carpetaModalTitulo').textContent = arc.rango;
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
            return `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f0f0f0;font-size:0.85em;">
                <span style="font-weight:700;color:var(--secondary);">${t}</span>
                <span style="font-weight:700;">${formatearMoneda(r.monto)}</span>
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
                    <span style="color:#7f8c8d;">Divisor: <strong>${divVal || '—'}</strong></span>
                    <span style="color:#f59e0b;font-weight:800;">Punto Noche: ${formatearMoneda(puntoNoche)}</span>
                </div>
            </div>`;
    });

    document.getElementById('modalCarpeta').style.display = 'flex';
}

function carpetas_cerrarModal() {
    document.getElementById('modalCarpeta').style.display = 'none';
}

function carpetas_eliminarCarpeta(idx) {
    if (!confirm('¿Borrar esta carpeta? Se eliminará permanentemente de este equipo.')) return;
    recArchivero.splice(idx, 1);
    localStorage.setItem(CARPETAS_SK, JSON.stringify(recArchivero));
    carpetas_renderArchivero();
    showToast('Carpeta eliminada', 'error');
}

async function carpetas_exportarJson() {
    toggleLoader(true, 'Preparando backup...');
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
        showToast('Backup descargado correctamente', 'success');
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
            if (!confirm('¿Restaurar este backup?\n\nSobrescribirá los datos actuales en la nube. Esta acción no se puede deshacer.')) { e.target.value = ''; return; }
            toggleLoader(true, 'Restaurando backup...');
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

async function carpetas_vaciarYArchivar() {
    if (!recDatosRaw || recDatosRaw.length === 0) return showToast('No hay datos en la nube para archivar', 'error');
    if (!confirm('⚠️ VACIAR NUBE Y ARCHIVAR\n\nSe guardará una copia local de todo y se borrará la nube.\n\n¿Confirmar?')) return;

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

        // ── PASO 2: guardar en archivero local PRIMERO ────────────────
        recArchivero.push({
            rango,
            totalRec: formatearMoneda(totalR),
            totalPtos,
            data: JSON.parse(JSON.stringify(recDatosRaw)),
            divisores,
            fechaArchivo: new Date().toISOString()
        });
        localStorage.setItem(CARPETAS_SK, JSON.stringify(recArchivero));
        carpetas_renderArchivero(); // actualizar UI antes de tocar la nube

        // ── PASO 3: vaciar la nube ────────────────────────────────────
        await fetch(URL_RECAUDACIONES, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'importAll', data: { datos: [], notes, divisores: {} } })
        });

        try { localStorage.removeItem(CACHE_KEY_REC); } catch(e) {}

        // ── PASO 4: recargar vista de recaudación (no crítico) ────────
        try { await cargarRecaudaciones(); } catch(e) {}

        showToast('✅ Archivado y nube vaciada correctamente', 'success');
    } catch(e) {
        carpetas_renderArchivero(); // garantizar que la UI muestre el archivo si ya se guardó
        showToast('Error al vaciar nube (datos archivados localmente)', 'error');
        console.error('carpetas_vaciarYArchivar:', e);
    } finally {
        toggleLoader(false);
    }
}
