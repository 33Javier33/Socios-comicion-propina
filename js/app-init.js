// ============================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Si hay sesión activa, mostrar app directamente
    if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
        document.getElementById('loginOverlay').style.display = 'none';
        iniciarApp();
        return;
    }
    // Poblar selector de responsables
    responsables_poblarLoginSelector();
    // Si no hay sesión, mostrar login y enfocar PIN
    setTimeout(() => document.getElementById('pinInput').focus(), 300);
});

function iniciarApp() {
    const hoy = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fechaHoyBadge').textContent = hoy.toLocaleDateString('es-ES', opciones);
    const todayISO = hoy.toISOString().split('T')[0];
    document.getElementById('fechaAnticipo').value = todayISO;
    document.getElementById('fechaAusencia').value = todayISO;
    iniciarWatchdogInactividad();
    responsables_poblarSelector();
    // Mostrar badge responsable en header
    const rObj = getSesionResponsableObj();
    const rBadge = document.getElementById('sesionRespBadge');
    const rNombre = document.getElementById('sesionRespNombre');
    if (rBadge && rObj.ini) { rNombre.textContent = rObj.ini + ' (' + rObj.area + ')'; rBadge.style.display = 'block'; }
    if(!URL_SOCIOS || URL_SOCIOS.includes('PEGA_AQUI')) {
        alert('Falta configurar URL_SOCIOS');
    } else {
        precargarTodo();
    }
}

// Precarga paralela de TODOS los datos al entrar
async function precargarTodo() {
    fetchSociosDeGoogle();
    cargarRecaudaciones(true);
    cargarCredenciales(); // PINs personales desde Google Sheets

    await Promise.allSettled([
        fetch(URL_RECAUDACIONES + '?action=getNotes&t=' + Date.now())
            .then(r => r.json())
            .then(json => {
                const notas = (json.data||json.result||[]).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
                guardarCache(CACHE_KEY_NOTAS, notas);
            }).catch(() => {}),

        fetch(AQ_URL_GET)
            .then(r => r.json())
            .then(data => {
                if (data && data.totalAcumulado !== undefined) {
                    localStorage.setItem('fondo_cache_aq_esperado', JSON.stringify({ ts: Date.now(), data }));
                }
            }).catch(() => {}),
    ]);
}

function switchTab(tabName) {
    if (tabName === 'config') setTimeout(cfg_renderResponsables, 50);
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(b => b.classList.remove('active'));
    const fabRec = document.getElementById('fabRecAgregar');
    if(tabName === 'registro') { btns[0].classList.add('active'); fabRec.style.display = 'none'; aq_detenerSync(); }
    else if(tabName === 'gestion') {
        btns[1].classList.add('active'); fabRec.style.display = 'none'; aq_detenerSync();
        gestionSociosConMovimientos = {};
        gestionFiltroActivo = 'todos';
        ['Todos','Anticipos','Ausencias'].forEach((t,i) => {
            const btn = document.getElementById('filtroGestion'+t);
            const colores = ['var(--secondary)','var(--warning)','var(--danger)'];
            if(btn) { btn.style.background = i===0 ? colores[i] : 'white'; btn.style.color = i===0 ? 'white' : colores[i]; }
        });
        renderizarListaBusqueda();
        gestion_cargarTotalAnticipos();
    }
    else if(tabName === 'recaudacion') { btns[2].classList.add('active'); fabRec.style.display = 'flex'; aq_detenerSync(); cargarRecaudaciones(); }
    else if(tabName === 'config') { btns[5].classList.add('active'); fabRec.style.display = 'none'; aq_detenerSync(); cfg_limpiarCampos(); }
    else if(tabName === 'arqueo') { btns[3].classList.add('active'); fabRec.style.display = 'none'; aq_initSiNoIniciado(); aq_arrancarSync(); }
    else if(tabName === 'notas') { btns[4].classList.add('active'); fabRec.style.display = 'none'; aq_detenerSync(); notasCargar(); }
    else if(tabName === 'auditoria') { btns[6].classList.add('active'); fabRec.style.display = 'none'; aq_detenerSync(); auditoria_cargar(); }
}

function abrirModalRegistro() { document.getElementById('modalRegistro').style.display = 'block'; if(!isEditing) { document.getElementById('registroForm').reset(); document.getElementById('editId').value = ''; document.getElementById('modalTitle').innerText = 'Nuevo Socio'; document.getElementById('btnSubmit').innerText = 'Registrar Socio'; } }
function cerrarModalRegistro() { document.getElementById('modalRegistro').style.display = 'none'; isEditing = false; document.getElementById('registroForm').reset(); document.getElementById('editId').value = ''; document.getElementById('fechaInicioPuntos').value = ''; }

window.addEventListener('click', function(e) {
    ['aq-modalConteo','aq-modalBackup','aq-modalEdicion','aq-modalStats','modalCanje','modalEditarAnticipo','modalReinicioMes','modalAyudaCompleta','modalBuscadorIDs'].forEach(id => {
        const el = document.getElementById(id);
        if(el && e.target === el) el.style.display = 'none';
    });
    const am = document.getElementById('about-modal');
    if (am && e.target === am) am.style.display = 'none';
});

function toggleAbout(show) {
    document.getElementById('about-modal').style.display = show ? 'flex' : 'none';
}

// ── registroForm submit ───────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    const registroForm = document.getElementById('registroForm');
    if (registroForm) {
        registroForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const fechaInicioRaw = document.getElementById('fechaInicioPuntos').value;
            // Regla del día 15: siempre guardar el día 15 del mes seleccionado
            const fechaInicioVal = normalizarFechaInicioPuntos(fechaInicioRaw);
            const d = { Nombre: document.getElementById('nombre').value, Apellido: document.getElementById('apellido').value, FechaIngreso: document.getElementById('fechaIngreso').value, Area: document.getElementById('area').value, TipoContrato: document.getElementById('contrato').value, FechaInicioPuntos: fechaInicioVal || '' };
            const idEdit = document.getElementById('editId').value;
            toggleLoader(true, isEditing ? "Actualizando..." : "Guardando...");
            try {
                if (isEditing) { await callApiSocios('updateSocio', { socioId: idEdit, updates: d }); showToast('Socio actualizado', 'success'); }
                else { await callApiSocios('addSocio', { socio: d }); showToast('Socio registrado', 'success'); }
                cerrarModalRegistro(); fetchSociosDeGoogle();
            } catch (e) { showToast('Error al guardar', 'error'); } finally { toggleLoader(false); }
        });
    }
});
